// ─────────────────────────────────────────────────────────────────────────────
// engagement-query.mjs — the ONE aggregation path over a T-10 engagement
// snapshot (ENG-4). Given a snapshot, a filter state and a query, runQuery
// returns rows. The open-rate report calls it, the page pre-render will call
// it, and every dashboard page will carry this file's exact bytes inline, so
// the browser recomputes a panel with the code that computed the report.
//
// PURE, and written in the JavaScript a browser also runs: no import of any
// kind (not even a node: builtin), no process, no file, no clock. The import
// gate holds it to that (build/check-imports.mjs, RESTRICTED), and
// test/engagement-query.mjs loads these bytes in a context with no Node
// globals and runs the same queries there.
//
// What lives here, each exactly once:
//   SOURCES     where every number is read from: object, standing filters, date
//               field, the flag fields and the value that counts. The adapter
//               (engagement.mjs) BUILDS ITS QUERIES from this table, and the
//               glossary renders from it, so a formula shown to an admin is the
//               formula that was run.
//   METRICS     the metric registry: what each metric counts, how a rate is
//               calculated, what it depends on, what is done after the read,
//               its caveats and how it compares with the Gainsight UI. The
//               adapter counts from it, runQuery computes from it, and the
//               glossary and the caveats block render from it.
//   the T-10 read floor (openSnapshot, clickAvailability, readClicked,
//               programClickAvailability, readResponses, accountAvailability,
//               healthAvailability): the only accessors of the optional
//               metrics and tables. A not-tracked metric has NO value through
//               them: not 0, not the stored count.
//   MASK_RULES  what is taken out of an error message before it is stored
//               (addresses, ids, long numbers), as data. The adapter masks
//               with them at fetch time and again when it builds the snapshot.
//   runQuery    filter on any dimension, pick the fact table by grain, re-add
//               the additive measures, derive rates (null, never 0, on a zero
//               denominator), apply the uniques rules (exact per program; per
//               month where pre-computed; no value otherwise), and say which
//               rows were carried forward.
//
// The snapshot's shape is the T-10 contract, frozen at its producer
// (engagement.mjs's header); this file reads it and never changes it.
//
// Citations: ENG-n are work items and Rnn rulings of the maintainer's
// unpublished JO-dashboards plan; F-nnn are findings. The decision each
// produced is stated beside the token.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {import("./engagement.mjs").T10Snapshot} T10Snapshot
 * @typedef {import("./engagement.mjs").TrackingState} TrackingState
 * @typedef {import("./engagement.mjs").T10ClickAvailability} T10ClickAvailability
 */

export const T10_SCHEMA_VERSION = 1;

const deepFreeze = (o) => {
  if (o && typeof o === "object" && !(o instanceof RegExp)) {
    for (const v of Object.values(o)) deepFreeze(v);
    Object.freeze(o);
  }
  return o;
};

// ── Where the numbers come from ──────────────────────────────────────────────
// `flags` are in the order the adapter groups by them. A flag is SET when its
// field holds `value`; anything else, a null included, is not set.
export const SOURCES = deepFreeze({
  log: {
    object: "email_log_v2",
    what: "the delivery log: one row per email attempt",
    standing: [{ field: "Source", op: "EQ", value: "Advanced Outreach" }, { field: "AddressType", op: "EQ", value: "To" }],
    dateField: "ExecutedDate",
    programField: "SourceId",
    templateField: "EmailTemplateId",
    addressField: "LowerCaseEmailId",
    flags: {
      wentOut: { field: "IsSent", value: "YES" },
      opened: { field: "IsOpened", value: "YES" },
      bounced: { field: "IsBounced", value: "YES" },
      rejected: { field: "IsRejected", value: "YES" },
      unsubscribed: { field: "IsUnsubscribed", value: "YES" },
      spam: { field: "IsSpam", value: "YES" },
    },
    clicks: { countField: "LinkClickedCount", detailField: "LinkClickedJson" },
    // Why a bounce happened, as the mail service worded it. The text holds
    // addresses and ids, so it is never stored unmasked (MASK_RULES), and it is
    // COUNTED server-side by category (one CONTAINS filter per category, which
    // this STRING field takes: measured S3b) rather than read as text.
    bounce: { typeField: "BounceType", reasonField: "BouncedReason", reasonFilterable: true },
    lookups: {
      company: { through: "GsCompanyId", to: "company", leaf: "Gsid" },
      person: { through: "GsPersonId", to: "person", leaf: "Gsid" },
    },
  },
  steps: {
    object: "ao_emails",
    what: "the Journey Orchestrator send log, read only with step detail: one row per email attempt, with its step and variant",
    standing: [{ field: "AddressType", op: "EQ", value: "To" }],
    dateField: "CreatedAt",
    programField: "AdvancedOutreachId",
    templateField: "EmailTemplateId",
    addressField: "ToAddress",
    flags: {
      wentOut: { field: "EmailSend", value: true },
      opened: { field: "EmailOpened", value: true },
      bounced: { field: "Bounce", value: true },
      rejected: { field: "Rejected", value: true },
      unsubscribed: { field: "Unsubscribed", value: true },
      spam: { field: "Spam", value: true },
    },
    clicks: { flagField: "EmailClicked" },
    lookups: {
      participant: { through: "GsParticipantId", to: "ao_participants", leaf: "Gsid" },
      logRow: { through: "EmailLogId", to: "email_log_v2", leaf: "Gsid" },
    },
  },
  survey: {
    object: "survey_participant",
    what: "one row per survey participant",
    // Test participants are left out, as the UI's program analytics leaves them out (F-474).
    standing: [{ field: "TestParticipant", op: "EQ", value: false }],
    dateField: "RespondedDate",
    responded: { field: "Responded", op: "EQ", value: true },
    statusField: "ResponseStatus",
    statuses: { submitted: "Submitted", partiallySubmitted: "Partially Submitted" },
    lookups: { program: { through: "AOParticipantId", to: "ao_participants", leaf: "AdvancedOutreachId" } },
  },
  // Health (HLT-1). Neither object has a date every row carries, so both are read all time.
  failedParticipants: {
    object: "ao_failed_participants",
    what: "one row per participant a program could not process, with the reason",
    standing: [],
    programField: "AdvancedOutreachId",
    // A JSON-path field: its schema declares it neither filterable nor groupable (measured S3b: CONTAINS,
    // DOES_NOT_CONTAINS and STARTS_WITH are all refused), so failures are COUNTED per program (COUNT of rows,
    // SUM of occurrences) with no breakdown by reason, and a capped plain-row sample is read for discovery.
    reasonField: "FailureReasons",
    reasonFilterable: false,
    occurrencesField: "OccurrenceCount",
  },
  participants: {
    object: "ao_participants",
    what: "one row per participant of a program",
    standing: [],
    programField: "AdvancedOutreachId",
    stateField: "ParticipantState",
  },
});

// ── Error messages: masked before they are stored (HLT-1) ────────────────────
// A bounce or failure reason is free text from a mail server or the product,
// and it names people: addresses, ids, reference numbers. The rules are data,
// applied in this order; each replaces what it matches with a placeholder, so
// two messages that differ only in whom they name become one message and are
// counted together. A placeholder matches no rule, so masking twice changes
// nothing.
/** @type {ReadonlyArray<{id: string, what: string, re: RegExp, as: string}>} */
export const MASK_RULES = Object.freeze([
  { id: "email", what: "an email address, with its angle brackets when it has them", re: /<?[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+>?/g, as: "<email>" },
  { id: "uuid", what: "a UUID", re: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, as: "<id>" },
  { id: "ipv4", what: "an IPv4 address", re: /\b\d{1,3}(?:\.\d{1,3}){3}\b/g, as: "<ip>" },
  { id: "token", what: "a run of 12 or more letters, digits, hyphens or underscores that holds both a letter and a digit (a record id, a message id)", re: /\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{12,}\b/g, as: "<id>" },
  { id: "number", what: "a run of 5 or more digits", re: /\d{5,}/g, as: "<number>" },
].map((r) => Object.freeze(r)));
export const MASK_MAX_LENGTH = 300;
/**
 * One raw error message → the text that may be stored: every MASK_RULES match
 * replaced, white space collapsed, cut to MASK_MAX_LENGTH. Null for no text.
 * @param {unknown} raw
 * @returns {?string}
 */
export function maskMessage(raw) {
  if (typeof raw !== "string") return null;
  let text = raw;
  for (const rule of MASK_RULES) text = text.replace(rule.re, rule.as);
  text = text.replace(/\s+/g, " ").trim();
  if (!text) return null;
  const points = Array.from(text);
  return points.length > MASK_MAX_LENGTH ? `${points.slice(0, MASK_MAX_LENGTH).join("")}...` : text;
}

// ── Failure categories (HLT-1, S3b; ruled 2026-10-04 and 2026-10-05) ────────
// A bounce or failure reason often carries a VALUE (the address, the field),
// which makes every row unique though the reason is one. A category names the
// product wording up to the value: the server counts the rows whose text
// CONTAINS the pattern, and the snapshot keeps the category's LABEL in place
// of the text, the tail CUT (never masked and kept: an address is exactly what
// the mask can miss). "Other" is the total less every category, counted, with
// a capped masked sample kept for discovery (terminal only, never on a page).
// Patterns must be DISJOINT: a server-side count cannot do first-match-wins,
// so two patterns that match one message count it twice and "Other" reads
// below zero; the adapter flags that as a list defect and never clamps it.
// The SHIPPED list is empty: the real wordings are Gainsight product text,
// captured from a tenant's own messages at V2 (never written from memory),
// and the only reason they may ship is that they carry no tenant value. A
// tenant adds its own on top (the adapter's --failure-categories file), and
// names expected failures (--expected-reason), which become categories flagged
// `expected`, so a page can leave them out of headline counts without hiding them.
// Each entry: {id, label, pattern, definition, expected?}.
/** @type {Readonly<{bounceReasons: ReadonlyArray<FailureCategory>, participantFailures: ReadonlyArray<FailureCategory>}>} */
export const FAILURE_CATEGORIES = deepFreeze({ bounceReasons: [], participantFailures: [] });
/** @typedef {{id: string, label: string, pattern: string, definition: string, expected?: boolean}} FailureCategory */
export const OTHER_CATEGORY = "other";
export const FAILURE_PARTS = Object.freeze(["bounceReasons", "participantFailures"]);
/**
 * What is wrong with a category list, in words; empty when it may be used.
 * Ids and patterns are unique, every field is text, and no pattern is inside
 * another (the one overlap that can be seen without the messages).
 * @param {unknown} list
 * @returns {string[]}
 */
export function validateCategories(list) {
  const problems = [];
  if (!Array.isArray(list)) return ["the category list must be an array"];
  const ids = new Set();
  const patterns = [];
  list.forEach((c, i) => {
    const at = `category ${i + 1}`;
    if (!c || typeof c !== "object" || Array.isArray(c)) return problems.push(`${at} is not an object`);
    for (const k of ["id", "label", "pattern", "definition"]) if (typeof c[k] !== "string" || !c[k].trim()) problems.push(`${at}: ${k} must be non-empty text`);
    if (typeof c.id === "string" && c.id.trim() === OTHER_CATEGORY) problems.push(`${at}: the id "${OTHER_CATEGORY}" is reserved for the uncategorised remainder`);
    if ("expected" in c && typeof c.expected !== "boolean") problems.push(`${at}: expected must be true or false`);
    const extra = Object.keys(c).filter((k) => !["id", "label", "pattern", "definition", "expected"].includes(k));
    if (extra.length) problems.push(`${at}: unknown key(s) ${extra.join(", ")}`);
    if (typeof c.id === "string") {
      if (ids.has(c.id)) problems.push(`${at}: id "${c.id}" is used twice`);
      ids.add(c.id);
    }
    if (typeof c.pattern === "string" && c.pattern.trim()) patterns.push({ at, pattern: c.pattern.trim().toLowerCase() });
  });
  for (const a of patterns) for (const b of patterns) {
    if (a === b) continue;
    if (a.pattern === b.pattern) { if (a.at < b.at) problems.push(`${a.at} and ${b.at} have the same pattern`); }
    else if (b.pattern.includes(a.pattern)) problems.push(`${a.at}'s pattern is inside ${b.at}'s: patterns must be disjoint (a server-side count cannot do first-match-wins)`);
  }
  return problems;
}
/**
 * The category table a pull counts with: the shipped list for the part, then
 * the tenant's own entries, each normalized to {id, label, pattern, definition, expected}.
 * @param {"bounceReasons"|"participantFailures"} part
 * @param {ReadonlyArray<FailureCategory>} [extra]
 * @returns {FailureCategory[]}
 */
export function categoryTable(part, extra = []) {
  if (!FAILURE_PARTS.includes(part)) throw new Error(`engagement query: no failure categories for "${part}"`);
  const list = [...FAILURE_CATEGORIES[part], ...extra].map((c) => ({ id: c.id.trim(), label: c.label.trim(), pattern: c.pattern.trim(), definition: c.definition.trim(), expected: c.expected === true }));
  const problems = validateCategories(list);
  if (problems.length) throw new Error(`engagement query: the ${part} category list is not usable: ${problems.join("; ")}`);
  return list;
}

// R18: click figures count content links. The rules are data; a link no rule
// names is content. The adapter classifies with them at fetch time, beside the
// tenant's own unsubscribe links (a run input, echoed in meta.params).
/** @type {ReadonlyArray<{kind: "mailto"|"unsubscribe", re: RegExp}>} */
export const NON_CONTENT_LINK_RULES = Object.freeze([
  { kind: "mailto", re: /^mailto:/i },
  { kind: "unsubscribe", re: /unsubscribe|opt[-_]?out|email[-_]?preferences|manage[-_]?preferences/i },
]);

// ── The metric registry ──────────────────────────────────────────────────────
// kind "count":    an additive measure of the send tables. `counts` is the flag
//                  conditions an attempt must meet ([] = every attempt); null
//                  means it is not a flag count (clicked, read from link detail).
//                  `match: "any"` means ONE condition is enough (the default
//                  is all of them): an attempt meeting two still counts once.
// kind "rate":     numerator ÷ denominator, both metric ids; null on a zero
//                  denominator, never 0.
// kind "distinct": an exact distinct count per program; never added up.
// kind "response": a survey count or rate, program level.
// `tracking` names the optional metric whose tracking state the value carries.
const METRIC_LIST = [
  {
    id: "sent", label: "Sent", kind: "count", source: "log", counts: [],
    definition: "Every email attempt in the period, whether or not it went out. Every recipient and every repeat send counts.",
    uiParity: "The program analytics page in Gainsight labels the went-out count \"Sent\". This figure is every attempt, so it is the higher of the two whenever an attempt bounced at send or was rejected.",
  },
  {
    id: "delivered", label: "Delivered", kind: "count", source: "log",
    counts: [{ flag: "wentOut", is: true }, { flag: "bounced", is: false }],
    definition: "Attempts that went out and did not bounce. An attempt that went out and bounced afterwards counts as bounced, not delivered.",
    uiParity: "The program analytics page in Gainsight subtracts every bounce event from its own \"Sent\" for \"Delivered\", including bounces on attempts that never went out, so it reads lower than this figure.",
  },
  {
    id: "bounced", label: "Bounced", kind: "count", source: "log", counts: [{ flag: "bounced", is: true }],
    definition: "Attempts flagged as bounced, counted as events, whether or not the attempt went out.",
    uiParity: "Matches the bounce count in Gainsight. The classic Journey Analytics view shows a lower bounce percentage, on a basis that could not be determined.",
  },
  { id: "rejected", label: "Rejected", kind: "count", source: "log", counts: [{ flag: "rejected", is: true }], definition: "Attempts the mail service rejected.", uiParity: null },
  { id: "unsubscribed", label: "Unsubscribed", kind: "count", source: "log", counts: [{ flag: "unsubscribed", is: true }], definition: "Attempts whose recipient unsubscribed from that email.", uiParity: null },
  { id: "spamComplaints", label: "Spam complaints", kind: "count", source: "log", counts: [{ flag: "spam", is: true }], definition: "Attempts whose recipient marked the email as spam.", uiParity: null },
  {
    // HLT-1 (ruled 2026-10-04): what the error rate counts. Not bounced plus rejected: an attempt flagged both is one failure.
    id: "failed", label: "Send failures", kind: "count", source: "log", match: "any", counts: [{ flag: "bounced", is: true }, { flag: "rejected", is: true }],
    definition: "Attempts that bounced or were rejected, each counted once even when both flags are set.",
    caveats: ["failures-are-send-failures"],
    uiParity: null,
  },
  {
    id: "opened", label: "Opened", kind: "count", source: "log", counts: [{ flag: "opened", is: true }],
    definition: "Attempts flagged as opened. An open is an image-pixel load.",
    caveats: ["opens-are-pixel-loads"],
    uiParity: "Matches the opened count in Gainsight.",
  },
  {
    id: "clicked", label: "Clicked", kind: "count", source: "log", counts: null, tracking: "clicks",
    definition: "Attempts with at least one click on a content link. Unsubscribe and mailto links do not count.",
    afterRead: ["content-links", "unsubscribe-input"],
    caveats: ["clicks-content-only", "click-tracking-states"],
    uiParity: "Will rarely match Gainsight, whose clicked figure also counts unsubscribe and mailto clicks.",
  },
  { id: "openRate", label: "Open rate", kind: "rate", numerator: "opened", denominator: "delivered", definition: "The share of delivered attempts that were opened.", caveats: ["opens-are-pixel-loads", "delivered-small-groups"], uiParity: "Follows the formula of the Dynamic Program analytics view, on this report's Delivered." },
  { id: "clickRate", label: "Click rate", kind: "rate", numerator: "clicked", denominator: "delivered", tracking: "clicks", definition: "The share of delivered attempts with a content-link click.", caveats: ["clicks-content-only", "click-tracking-states", "delivered-small-groups"], uiParity: "Will rarely match Gainsight: content links only." },
  { id: "deliveredRate", label: "Delivered rate", kind: "rate", numerator: "delivered", denominator: "sent", definition: "The share of attempts that went out and did not bounce.", uiParity: null },
  { id: "bounceRate", label: "Bounce rate", kind: "rate", numerator: "bounced", denominator: "sent", definition: "Bounce events as a share of attempts.", uiParity: "The classic Journey Analytics view shows a lower bounce percentage, on a basis that could not be determined." },
  { id: "rejectedRate", label: "Rejected rate", kind: "rate", numerator: "rejected", denominator: "sent", definition: "Rejected attempts as a share of attempts.", uiParity: null },
  { id: "unsubscribeRate", label: "Unsubscribe rate", kind: "rate", numerator: "unsubscribed", denominator: "sent", definition: "Unsubscribes as a share of attempts.", uiParity: null },
  { id: "spamRate", label: "Spam complaint rate", kind: "rate", numerator: "spamComplaints", denominator: "sent", definition: "Spam complaints as a share of attempts.", uiParity: null },
  { id: "errorRate", label: "Error rate", kind: "rate", numerator: "failed", denominator: "sent", definition: "Attempts that bounced or were rejected, as a share of attempts.", caveats: ["failures-are-send-failures"], uiParity: null },
  {
    id: "uniqueRecipients", label: "Unique recipients", kind: "distinct", source: "log", distinctOf: "person", field: "people",
    definition: "Distinct people the program emailed, exact per program.",
    afterRead: ["distinct-never-summed"], caveats: ["uniques-scope"],
    uiParity: "Close to the Contacts figure in Gainsight.",
  },
  {
    id: "accountsReached", label: "Accounts reached", kind: "distinct", source: "log", distinctOf: "company", field: "accounts",
    definition: "Distinct companies the program emailed, exact per program. Sends with no company link reach no account.",
    afterRead: ["distinct-never-summed"], caveats: ["uniques-scope"], uiParity: null,
  },
  {
    id: "participantRecords", label: "Participant records", kind: "distinct", source: "steps", distinctOf: "participant", field: "participantRecords",
    definition: "Distinct participant records the program emailed. One person can be a participant more than once. Counted only with step detail.",
    afterRead: ["distinct-never-summed"], caveats: ["uniques-scope"],
    uiParity: "The Participants figure in Gainsight.",
  },
  { id: "submitted", label: "Submitted", kind: "response", source: "survey", status: "submitted", tracking: "responses", definition: "Survey participants of the program whose response is Submitted.", caveats: ["responses-program-level", "responses-all-time"], uiParity: "Matches the program's analytics page in Gainsight." },
  { id: "partiallySubmitted", label: "Partially submitted", kind: "response", source: "survey", status: "partiallySubmitted", tracking: "responses", definition: "Survey participants of the program whose response is Partially Submitted.", caveats: ["responses-program-level", "responses-all-time"], uiParity: "Matches the program's analytics page in Gainsight." },
  { id: "anyResponse", label: "Any response", kind: "response", source: "survey", status: "any", tracking: "responses", definition: "Submitted plus Partially submitted.", caveats: ["responses-program-level", "responses-all-time"], uiParity: null },
  { id: "surveyParticipants", label: "Survey participants", kind: "response", source: "survey", status: "participants", tracking: "responses", definition: "Every survey participant of the program, all time. It is the response rate's denominator.", caveats: ["responses-program-level", "responses-all-time"], uiParity: "Matches the program's analytics page in Gainsight." },
  { id: "responseRate", label: "Response rate", kind: "response", source: "survey", status: "rate", numerator: "anyResponse", denominator: "surveyParticipants", tracking: "responses", definition: "The share of the program's survey participants with any response, all time.", caveats: ["responses-program-level", "responses-all-time"], uiParity: null },
];
export const METRICS = deepFreeze(METRIC_LIST.map((m) => ({ counts: undefined, match: "all", afterRead: [], caveats: [], tracking: null, ...m })));
const METRIC = Object.freeze(Object.fromEntries(METRICS.map((m) => [m.id, m])));
/** @param {string} id @returns {*} the registry entry; an unknown id is refused */
export function metric(id) {
  const m = METRIC[id];
  if (!m) throw new Error(`engagement query: unknown metric "${id}" — the registry has ${METRICS.map((x) => x.id).join(", ")}`);
  return m;
}
const FLAG_COUNTS = METRICS.filter((m) => m.kind === "count" && m.counts);
// The additive measures a send row carries, in the order the snapshot writes them.
export const SEND_MEASURES = Object.freeze(METRICS.filter((m) => m.kind === "count").map((m) => m.id));
/**
 * The measures one attempt adds to, from its flags: the registry's `counts`
 * rules, which the adapter counts with. `clicked` is not a flag count.
 * @param {Object<string, boolean>} flags wentOut, opened, bounced, rejected, unsubscribed, spam
 * @returns {string[]} measure ids
 */
export const measuresCounted = (flags) => FLAG_COUNTS.filter((m) => m.counts[m.match === "any" ? "some" : "every"]((c) => !!flags[c.flag] === c.is)).map((m) => m.id);

// ── Tracking states (R1b, R19) ───────────────────────────────────────────────
/**
 * The roll-up of several templates' click states: tracked only when EVERY one
 * is, not-tracked only when every one is, and any mix (or nothing) is unknown.
 * The ONE statement of it: the adapter rolls a program up with it, and
 * runQuery rolls up whatever a filter leaves in a group.
 * @param {{tracked: number, notTracked: number, unknown: number}} tally
 * @returns {TrackingState}
 */
export function rollUpTracking(tally) {
  const counted = tally.tracked + tally.notTracked + tally.unknown;
  return counted && tally.tracked === counted ? "tracked" : counted && tally.notTracked === counted ? "not-tracked" : "unknown";
}
const tallyOf = (states) => {
  const tally = { tracked: 0, notTracked: 0, unknown: 0 };
  for (const s of states) tally[s === "tracked" ? "tracked" : s === "not-tracked" ? "notTracked" : "unknown"]++;
  return tally;
};

// ── T-10 read floor ──────────────────────────────────────────────────────────
// The accessors every reader of a snapshot goes through. A not-tracked metric
// has NO value here: not 0, not the stored count — null.
/**
 * @param {unknown} json a parsed snapshot file
 * @returns {T10Snapshot}
 */
export function openSnapshot(json) {
  const s = /** @type {any} */ (json);
  if (!s || typeof s !== "object" || Array.isArray(s)) throw new Error("engagement snapshot: not an object — refusing to read it (T-10)");
  if (s.schemaVersion !== T10_SCHEMA_VERSION)
    throw new Error(`engagement snapshot: schemaVersion ${JSON.stringify(s.schemaVersion)} is not ${T10_SCHEMA_VERSION} — refusing to read it (T-10); re-pull with this plugin version, or update the plugin`);
  if (s.kind !== "engagement") throw new Error(`engagement snapshot: kind ${JSON.stringify(s.kind)} is not "engagement" — refusing to read it (T-10)`);
  return s;
}
const UNKNOWN_CLICKS = deepFreeze({ state: "unknown", evidence: { clickHistory: { everClicked: false, firstMonth: null, lastMonth: null }, linkSettings: null } });
/** @returns {T10ClickAvailability} a template the snapshot does not list is unknown */
export const clickAvailability = (snapshot, templateId) => snapshot.meta.metricAvailability.clicks.templates[templateId] ?? UNKNOWN_CLICKS;
/**
 * A send row's click count with its tracking state.
 * @param {T10Snapshot} snapshot
 * @param {{templateId: ?string, clicked: number}} row
 * @returns {{state: TrackingState, value: ?number}}
 */
export function readClicked(snapshot, row) {
  const { state } = clickAvailability(snapshot, row.templateId);
  return { state, value: state === "not-tracked" ? null : row.clicked };
}
/**
 * Whether the snapshot holds the account grain, and the reason when it does
 * not. A reader shows the reason wherever account data would be; it never
 * shows the empty table as "no accounts". A snapshot made before the switch
 * existed carries no marker and pulled the grain.
 * @param {T10Snapshot} snapshot
 * @returns {{pulled: boolean, reason: ?"accounts-off"}}
 */
export const accountAvailability = (snapshot) => snapshot.meta.accounts ?? { pulled: true, reason: null };
/**
 * Whether the snapshot holds health facts (facts.health), and for each part of
 * them whether it could be read. A pull that ran without health says so
 * (reason "health-off"). A snapshot made before health facts existed carries
 * no marker: it holds none, and its send rows carry no failure count.
 * A reader shows the reason wherever a health figure would be; it never shows
 * a missing part as "no failures".
 * @param {T10Snapshot} snapshot
 * @returns {{pulled: boolean, reason: ?string, asOf: ?string, dayWindow: ?{start: string, endExclusive: string}, parts: Object<string, {pulled: boolean, reason: ?string}>}}
 */
export const healthAvailability = (snapshot) => snapshot.meta.health ?? { pulled: false, reason: "predates-health", asOf: null, dayWindow: null, parts: {} };
/** @returns {{state: TrackingState, templates: {tracked: number, notTracked: number, unknown: number}}} */
export const programClickAvailability = (snapshot, programId) =>
  snapshot.meta.metricAvailability.clicks.programs[programId] ?? { state: "unknown", templates: { tracked: 0, notTracked: 0, unknown: 0 } };
/**
 * A program's survey responses with their tracking state: Submitted,
 * Partially submitted and Any response, on ONE basis per call.
 *   no months   basis "all-time": the counts and the denominator, both all
 *               time. This is the only pair a response rate is computed from.
 *   months      basis "months": the counts of those response months, for a
 *               trend or a date filter. participants is null: the denominator
 *               has no month, so these counts never sit beside it.
 * @param {T10Snapshot} snapshot
 * @param {string} programId
 * @param {?string[]} [months] response months to count
 * @returns {{state: TrackingState, basis: "all-time"|"months", submitted: ?number, partiallySubmitted: ?number, anyResponse: ?number, participants: ?number}}
 */
export function readResponses(snapshot, programId, months = null) {
  const state = snapshot.meta.metricAvailability.responses.programs[programId]?.state ?? "unknown";
  /** @type {"all-time"|"months"} */
  const basis = months ? "months" : "all-time";
  const none = { state, basis, submitted: null, partiallySubmitted: null, anyResponse: null, participants: null };
  if (state === "not-tracked") return none;
  if (!months) {
    const all = snapshot.facts.responseParticipants.find((r) => r.programId === programId);
    return all ? { state, basis, submitted: all.submitted, partiallySubmitted: all.partiallySubmitted, anyResponse: all.submitted + all.partiallySubmitted, participants: all.participants } : none;
  }
  const keep = new Set(months);
  const rows = snapshot.facts.responses.filter((r) => r.programId === programId && keep.has(r.month));
  const submitted = rows.reduce((s, r) => s + r.submitted, 0);
  const partiallySubmitted = rows.reduce((s, r) => s + r.partiallySubmitted, 0);
  return { state, basis, submitted, partiallySubmitted, anyResponse: submitted + partiallySubmitted, participants: null };
}

// ── Why a cell has no value ──────────────────────────────────────────────────
// A null value always says why. `accounts-off` and `step-detail-off` are the
// snapshot's own markers (meta.accounts.reason, meta.participantRecords.reason).
// Every id here is classified by the page runtime (dashboard-runtime.mjs:
// LACKS, NOT_LACKS, LACKS_LATER), and its suite reds an id that is in none.
export const REASONS = deepFreeze({
  "zero-denominator": "Nothing to divide by: the denominator is 0, so there is no rate (not a 0%).",
  "not-tracked": "Not tracked: no link in this email is click-tracked, so there is no click figure.",
  "no-survey": "This program sent no survey.",
  "not-additive": "A distinct count is exact per program and is never added across programs.",
  "per-program-only": "A distinct count exists per program, and per program and month; it is not available at this level of detail.",
  "needs-full-window-or-one-month": "Distinct counts were computed for the whole window and for each single month. For any other date range there is no exact figure.",
  "class-not-pulled": "Distinct counts were pulled for all recipients and for external recipients, not for internal recipients alone.",
  "not-pulled": "The snapshot holds no figure for this.",
  "program-level-only": "Survey responses are counted per program; they are not available at this level of detail.",
  "all-time-basis-only": "The response rate is computed all time only: its denominator has no date, so no rate exists for a date range.",
  "accounts-off": "Account data was not pulled for this snapshot: the pull ran with accounts off, because ranking every account is most of a pull's cost.",
  "step-detail-off": "Counted only with step detail, which this pull ran without.",
  "measure-not-in-snapshot": "This snapshot was made before this figure was counted. Pull again to get it.",
  "predates-health": "This snapshot was made before health data was pulled. Pull again to get it.",
  "health-off": "Health data was not pulled for this snapshot: the pull ran without it.",
  "not-in-previous": "The earlier pull this one continues from read none, so the months carried from it have none. A full pull reads them.",
  "call-failed": "The call that reads this did not return, so there is no figure. Nothing else in the pull is affected.",
  "no-schema": "This tenant does not have the object this is read from.",
  "no-kb": "Schedules are read from the knowledge base, and this pull ran without one.",
  "too-large": "This has more rows than the pull can read within its budget, so it was not read. Narrow the programs or the window, or pull again when the budget allows.",
  "all-time": "This figure is all time: the object it is read from carries no date on every row, so the date filter does not apply to it.",
  "not-filterable": "This tenant's object does not allow a filter on the reason field, so participant failures are counted per program with no breakdown by reason.",
  // What a dashboard PAGE does not carry, though the pull may hold it (DSH-2).
  "accounts-not-on-page": "Account detail is not part of this page.",
  "tab-off": "This tab is turned off for this page, so what it shows is not part of the page.",
  "no-internal-domain": "No internal email domain is named for this dashboard, so every recipient counts as external and there is nothing to leave out.",
  "test-accounts-need-accounts": "Accounts named as test accounts are not left out: this filter works by email domain, and the pull holds no account data to subtract them with.",
});
/** @param {?string} id @returns {string} the reason in words; an id the table lacks is shown as itself */
export const reasonText = (id) => (id == null ? "" : REASONS[id] ?? `No value (${id}).`);

// In the order a status list reads best: what is running first.
export const STATUS_LABELS = deepFreeze({ PROCESSING: "Active", PAUSE: "Paused", NEW: "Draft", STOP: "Stopped" });
/** @param {string} status @returns {string} the status as the Gainsight UI words it */
export const statusLabel = (status) => STATUS_LABELS[status] ?? String(status);

// ── The query ────────────────────────────────────────────────────────────────
/**
 * @typedef {object} EngagementFilters
 * @property {?string[]} [months]        YYYY-MM; absent = every month of the window
 * @property {?string[]} [programs]      program ids
 * @property {?string[]} [statuses]      a program matches when ANY of its statuses is listed (R23)
 * @property {?Array<?string>} [supergroups]
 * @property {?Array<?string>} [groups]
 * @property {?string[]} [models]
 * @property {?string[]} [audiences]
 * @property {"all"|"external"|"internal"} [recipientClass]  default "all"
 * @property {?Array<?string>} [templates]  template ids
 * @property {?string[]} [accounts]       account keys
 * @property {?Array<"account"|"other"|"no-company-link">} [accountBuckets]  with the account grain; absent = every bucket, so sums equal the program's
 *
 * @typedef {object} EngagementQuery
 * @property {string[]} [groupBy]   any of DIMENSIONS; [] = one row for everything
 * @property {string[]} metrics     registry ids
 * @property {Array<{metric?: string, dim?: string, label?: string, dir?: "asc"|"desc"}>} [sort]  by a metric's value, a dimension's name, or a label field (stepOrder); nulls sort last
 * @property {Array<{metric: string, gte?: number, gt?: number, lte?: number}>} [having]  a row whose value is null fails
 * @property {number} [limit]
 *
 * @typedef {{value: ?number, state?: TrackingState, why?: string, basis?: "all-time"|"months"}} EngagementCell
 * @typedef {object} EngagementRow
 * @property {Object<string, ?string>} key      one entry per groupBy dimension
 * @property {Object<string, *>} label          names for the key, and what the dimension tables say about it
 * @property {Object<string, EngagementCell>} cells   one per requested metric
 * @property {boolean} carried                  some of what it adds up was carried forward from an earlier pull
 * @property {boolean} incomplete               it includes the incomplete period
 * @typedef {object} EngagementResult
 * @property {"byTemplate"|"byStep"|"byAccount"} table   the fact table the grain picked
 * @property {?{reason: string}} unavailable    set, with no rows, when the snapshot does not hold that table
 * @property {EngagementRow[]} rows
 * @property {?EngagementRow} total             everything the filters keep, as one row; distinct counts are never totalled
 * @property {{months: string[], fullWindow: boolean, programs: number, programsHiddenByStatus: number}} scope
 */
export const DIMENSIONS = Object.freeze(["program", "template", "step", "variant", "account", "month", "recipientClass", "supergroup", "group", "model", "audience"]);
const STEP_DIMS = ["step", "variant"];

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const has = (list, v) => !list || list.includes(v);

/**
 * Run one query over a snapshot.
 * @param {T10Snapshot} snapshot
 * @param {EngagementFilters} filters
 * @param {EngagementQuery} query
 * @returns {EngagementResult}
 */
export function runQuery(snapshot, filters, query) {
  const f = filters ?? {};
  const groupBy = query.groupBy ?? [];
  for (const d of groupBy) if (!DIMENSIONS.includes(d)) throw new Error(`engagement query: unknown dimension "${d}" — group by any of ${DIMENSIONS.join(", ")}`);
  const defs = query.metrics.map(metric);
  for (const h of query.having ?? []) if (!query.metrics.includes(h.metric)) throw new Error(`engagement query: having names "${h.metric}", which the query does not compute`);
  for (const s of query.sort ?? []) {
    if (s.metric && !query.metrics.includes(s.metric)) throw new Error(`engagement query: sort names "${s.metric}", which the query does not compute`);
    if (s.dim && !groupBy.includes(s.dim)) throw new Error(`engagement query: sort names dimension "${s.dim}", which the query does not group by`);
  }
  const cls = f.recipientClass ?? "all";
  if (!["all", "external", "internal"].includes(cls)) throw new Error(`engagement query: recipientClass must be all, external or internal (got "${cls}")`);

  // The fact table, by grain. One table per grain, so nothing is counted twice.
  const wantsAccount = groupBy.includes("account") || !!f.accounts || !!f.accountBuckets;
  const wantsStep = groupBy.some((d) => STEP_DIMS.includes(d));
  const wantsTemplate = groupBy.includes("template") || !!f.templates;
  if (wantsAccount && (wantsStep || wantsTemplate)) throw new Error("engagement query: no fact table holds accounts beside templates or steps — query them separately");
  /** @type {"byTemplate"|"byStep"|"byAccount"} */
  const table = wantsAccount ? "byAccount" : wantsStep ? "byStep" : "byTemplate";

  const dims = snapshot.dimensions;
  const allMonths = dims.months;
  const months = f.months ? allMonths.filter((m) => f.months.includes(m)) : allMonths;
  const monthSet = new Set(months);
  const fullWindow = months.length === allMonths.length;
  const programById = new Map(dims.programs.map((p) => [p.id, p]));
  const programOk = (p) =>
    has(f.programs, p.id) && has(f.supergroups, p.supergroup) && has(f.groups, p.group) && has(f.models, p.model) && has(f.audiences, p.audienceType);
  const beforeStatus = dims.programs.filter(programOk);
  const kept = beforeStatus.filter((p) => !f.statuses || p.statuses.some((s) => f.statuses.includes(s)));
  const keptIds = new Set(kept.map((p) => p.id));
  const scope = { months, fullWindow, programs: kept.length, programsHiddenByStatus: beforeStatus.length - kept.length };
  const empty = (reason) => ({ table, unavailable: { reason }, rows: [], total: null, scope });
  if (table === "byAccount" && !accountAvailability(snapshot).pulled) return empty(accountAvailability(snapshot).reason ?? "not-pulled");
  if (table === "byStep" && !snapshot.meta.stepDetail) return empty("step-detail-off");

  const templateById = new Map(dims.templates.map((t) => [t.id, t]));
  const accountById = new Map(dims.accounts.map((a) => [a.key, a]));
  const stepByKey = new Map((dims.steps ?? []).map((s) => [JSON.stringify([s.programId, s.stepId, s.variantId]), s]));
  const incompleteMonth = String(snapshot.meta.incompleteFrom).slice(0, 7);

  const facts = /** @type {any[]} */ (snapshot.facts[table] ?? []).filter(
    (r) =>
      monthSet.has(r.month) && keptIds.has(r.programId) && (cls === "all" || r.recipientClass === cls) &&
      has(f.templates, r.templateId ?? null) && has(f.accountBuckets, r.bucket) && (!f.accounts || (r.bucket === "account" && f.accounts.includes(r.accountKey))),
  );

  const keyOf = {
    program: (r) => r.programId,
    template: (r) => r.templateId ?? null,
    step: (r) => r.stepId ?? null,
    variant: (r) => r.variantId ?? null,
    account: (r) => (r.bucket === "account" ? r.accountKey : r.bucket),
    month: (r) => r.month,
    recipientClass: (r) => r.recipientClass,
    supergroup: (r) => programById.get(r.programId)?.supergroup ?? null,
    group: (r) => programById.get(r.programId)?.group ?? null,
    model: (r) => programById.get(r.programId)?.model ?? null,
    audience: (r) => programById.get(r.programId)?.audienceType ?? null,
  };
  const newGroup = (key) => ({ key, rows: [], sums: Object.fromEntries(SEND_MEASURES.map((k) => [k, 0])), absent: new Set(), programs: new Set(), months: new Set(), carried: false });
  const addTo = (g, r) => {
    g.rows.push(r);
    // A row from a snapshot made before a measure existed does not carry it: no figure, never a 0.
    for (const k of SEND_MEASURES) {
      if (r[k] == null) g.absent.add(k);
      else g.sums[k] += r[k];
    }
    g.programs.add(r.programId);
    g.months.add(r.month);
    if (r.provenance === "carried") g.carried = true;
  };
  const groups = new Map();
  const all = newGroup({});
  const groupFor = (r) => {
    const key = Object.fromEntries(groupBy.map((d) => [d, keyOf[d](r)]));
    const k = JSON.stringify(groupBy.map((d) => key[d]));
    if (!groups.has(k)) groups.set(k, newGroup(key));
    return groups.get(k);
  };
  for (const r of facts) {
    addTo(groupFor(r), r);
    addTo(all, r);
  }
  // A survey response can land in a month its program sent nothing. When a
  // response metric is asked for at program or month level, such a month is a
  // row too, with no sends: a trend never drops a response for want of a send.
  if (defs.some((d) => d.kind === "response") && table === "byTemplate" && !f.templates && groupBy.every((d) => d === "program" || d === "month")) {
    for (const r of snapshot.facts.responses) {
      if (!monthSet.has(r.month) || !keptIds.has(r.programId)) continue;
      for (const g of [groupFor(r), all]) {
        g.programs.add(r.programId);
        g.months.add(r.month);
        if (r.provenance === "carried") g.carried = true;
      }
    }
  }

  // Clicks: the stored count never stands in for a not-tracked template's.
  const clicksOf = (g) => {
    let value = 0;
    const states = [];
    if (table === "byAccount") {
      // Account rows name no template: each program's own roll-up decides.
      const stateOf = new Map([...g.programs].map((p) => [p, programClickAvailability(snapshot, p).state]));
      for (const r of g.rows) if (stateOf.get(r.programId) !== "not-tracked") value += r.clicked;
      states.push(...stateOf.values());
    } else {
      const seen = new Map();
      for (const r of g.rows) {
        const c = readClicked(snapshot, r);
        if (c.value != null) value += c.value;
        seen.set(r.templateId ?? null, r.templateId == null ? "unknown" : c.state);
      }
      states.push(...seen.values());
    }
    const state = rollUpTracking(tallyOf(states));
    return state === "not-tracked" ? { value: null, state, why: "not-tracked" } : { value, state };
  };

  // Distinct counts: exact per program, for the whole window or one month.
  const uniqueRows = new Map(snapshot.facts.uniques.map((u) => [JSON.stringify([u.programId, u.scope, u.month]), u]));
  const narrowed = !!f.templates || table !== "byTemplate" || groupBy.some((d) => d !== "program" && d !== "month");
  const uniquesOf = (def, g, isTotal) => {
    if (isTotal || !groupBy.includes("program")) return { value: null, why: "not-additive" };
    if (narrowed) return { value: null, why: "per-program-only" };
    if (cls === "internal") return { value: null, why: "class-not-pulled" };
    const month = groupBy.includes("month") ? g.key.month : fullWindow ? null : months.length === 1 ? months[0] : undefined;
    if (month === undefined) return { value: null, why: "needs-full-window-or-one-month" };
    const row = uniqueRows.get(JSON.stringify([g.key.program, month == null ? "window" : "month", month]));
    const value = (cls === "external" ? row?.external : row)?.[def.field] ?? null;
    if (value != null) return { value };
    return { value: null, why: def.field === "participantRecords" ? snapshot.meta.participantRecords?.reason ?? "not-pulled" : "not-pulled" };
  };

  // Survey responses: program level, and a rate on the all-time basis only.
  const responsesOf = (def, g, isTotal) => {
    const byProgramOnly = groupBy.every((d) => d === "program" || d === "month");
    if (table !== "byTemplate" || f.templates || (!isTotal && !byProgramOnly)) return { value: null, why: "program-level-only" };
    // Every program the filters keep answers for the group, not only those with
    // a send in it: a survey program with no response in a month reads 0 there.
    const programs = "program" in g.key ? [g.key.program] : [...keptIds];
    const monthsAsked = groupBy.includes("month") ? [g.key.month] : fullWindow ? null : months;
    const reads = programs.map((p) => readResponses(snapshot, p, monthsAsked));
    const tracked = reads.filter((r) => r.state !== "not-tracked");
    // Not the click rule: a program that sent no survey adds a real 0 to a
    // sum, so only a program whose responses could not be read makes it unknown.
    /** @type {TrackingState} */
    const state = reads.every((r) => r.state === "not-tracked") ? "not-tracked" : reads.some((r) => r.state === "unknown") ? "unknown" : "tracked";
    /** @type {"all-time"|"months"} */
    const basis = monthsAsked ? "months" : "all-time";
    if (state === "not-tracked") return { value: null, state, why: "no-survey", basis };
    // A program whose figures could not be read adds nothing; when none could, there is no value.
    const sum = (k) => {
      const read = tracked.map((r) => r[k]).filter((v) => v != null);
      return read.length ? read.reduce((s, v) => s + v, 0) : null;
    };
    const cell = (value) => (value == null ? { value: null, state, why: "not-pulled", basis } : { value, state, basis });
    if (def.status === "participants" || def.status === "rate") {
      if (basis === "months") return { value: null, state, why: "all-time-basis-only", basis };
      const participants = sum("participants");
      if (def.status === "participants" || participants == null) return cell(participants);
      return participants ? cell(sum("anyResponse") / participants) : { value: null, state, why: "zero-denominator", basis };
    }
    return cell(sum(def.status === "any" ? "anyResponse" : def.status));
  };

  const cellOf = (def, g, isTotal) => {
    if (def.kind === "count") return def.tracking === "clicks" ? clicksOf(g) : g.absent.has(def.id) ? { value: null, why: "measure-not-in-snapshot" } : { value: g.sums[def.id] };
    if (def.kind === "rate") {
      const num = cellOf(metric(def.numerator), g, isTotal);
      const den = cellOf(metric(def.denominator), g, isTotal);
      const state = num.state ? { state: num.state } : {};
      if (num.value == null) return { value: null, ...state, why: num.why };
      // Null, never 0, on a zero denominator.
      if (!den.value) return { value: null, ...state, why: "zero-denominator" };
      return { value: num.value / den.value, ...state };
    }
    if (def.kind === "distinct") return uniquesOf(def, g, isTotal);
    return responsesOf(def, g, isTotal);
  };
  const labelOf = (g) => {
    const label = {};
    const k = g.key;
    if ("program" in k) {
      const p = programById.get(k.program);
      Object.assign(label, { program: p?.name ?? null, statuses: p?.statuses ?? [], model: p?.modelName ?? p?.model ?? null });
    }
    if ("template" in k) {
      label.template = templateById.get(k.template)?.name ?? null;
      // Step name and order are set only where the template sits on exactly one step of that program.
      const use = "program" in k ? templateById.get(k.template)?.uses.find((u) => u.programId === k.program) : null;
      Object.assign(label, { stepName: use?.stepName ?? null, stepOrder: use?.stepOrder ?? null, stepCount: use?.stepCount ?? null });
    }
    if ("step" in k) {
      const any = g.rows[0];
      const s = stepByKey.get(JSON.stringify([any.programId, any.stepId, any.variantId]));
      const sameStep = (dims.steps ?? []).find((x) => x.programId === any.programId && x.stepId === any.stepId);
      Object.assign(label, { step: (s ?? sameStep)?.name ?? null, stepOrder: (s ?? sameStep)?.order ?? null, template: templateById.get(any.templateId)?.name ?? null, templateId: any.templateId ?? null });
    }
    if ("variant" in k) {
      const any = g.rows[0];
      label.variant = stepByKey.get(JSON.stringify([any.programId, any.stepId, any.variantId]))?.variantName ?? null;
    }
    if ("account" in k) label.account = k.account === "other" ? "All other accounts" : k.account === "no-company-link" ? "No company link" : accountById.get(k.account)?.name ?? null;
    return label;
  };
  const rowOf = (g, isTotal) => ({
    key: g.key,
    label: isTotal ? {} : labelOf(g),
    cells: Object.fromEntries(defs.map((def) => [def.id, cellOf(def, g, isTotal)])),
    carried: g.carried,
    incomplete: [...g.months].some((m) => m >= incompleteMonth),
  });

  let rows = [...groups.values()].map((g) => rowOf(g, false));
  for (const h of query.having ?? []) {
    rows = rows.filter((r) => {
      const v = r.cells[h.metric].value;
      return v != null && (h.gte == null || v >= h.gte) && (h.gt == null || v > h.gt) && (h.lte == null || v <= h.lte);
    });
  }
  const sortValue = (r, s) => (s.metric ? r.cells[s.metric].value : s.label ? r.label[s.label] : r.label[s.dim] ?? r.key[s.dim]);
  const sortKeys = [...(query.sort ?? []), ...groupBy.map((dim) => ({ dim, dir: /** @type {"asc"} */ ("asc") }))];
  rows.sort((a, b) => {
    for (const s of sortKeys) {
      const [x, y] = [sortValue(a, s), sortValue(b, s)];
      if (x == null || y == null) {
        if (x == null && y == null) continue;
        return x == null ? 1 : -1; // nulls last, whatever the direction
      }
      const c = typeof x === "number" && typeof y === "number" ? cmp(x, y) : cmp(String(x).toLowerCase(), String(y).toLowerCase()) || cmp(String(x), String(y));
      if (c) return s.dir === "desc" ? -c : c;
    }
    return cmp(JSON.stringify(a.key), JSON.stringify(b.key));
  });
  if (query.limit != null) rows = rows.slice(0, query.limit);
  return { table, unavailable: null, rows, total: rowOf(all, true), scope };
}

// ── Cron: the days a schedule fires (HLT-1, S3b) ─────────────────────────────
// A small, day-grain reader of the Quartz-style expressions a schedule carries
// (sec min hour day-of-month month day-of-week [year]). It answers ONE
// question: on which calendar days does this schedule fire? From that come the
// day the program was last due and how far apart its runs are. The hour is
// ignored: a run due on a day sends on that day, and a run due today is not
// judged until tomorrow. Built-ins only (Date.UTC), no time zone arithmetic:
// the zone can move a fire by hours, never by the day a send is bucketed in
// beyond the one-day grace the rule already gives.
// Supported: `*`, `?`, lists, ranges, steps (`a/n`, `*/n`, `a-b/n`), month
// and weekday names, `L` as the last day of the month, `X#n` (the nth X of the
// month), `XL` (the last X of the month). Anything else reads as unreadable,
// and the rule then falls back to the flat threshold and says so.
const MONTH_NAMES = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
const DOW_NAMES = { SUN: 1, MON: 2, TUE: 3, WED: 4, THU: 5, FRI: 6, SAT: 7 };
const dayNumber = (day) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / 86400000;
const dayText = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
/** One cron field → a Set of its values, null for "any", or undefined when it cannot be read. */
function cronField(spec, min, max, names = null) {
  if (spec === "*" || spec === "?") return null;
  const out = new Set();
  const num = (t) => (names && names[t.toUpperCase()] != null ? names[t.toUpperCase()] : /^\d+$/.test(t) ? Number(t) : undefined);
  for (const part of spec.split(",")) {
    const m = /^(\*|[A-Za-z0-9]+)(?:-([A-Za-z0-9]+))?(?:\/(\d+))?$/.exec(part);
    if (!m) return undefined;
    const from = m[1] === "*" ? min : num(m[1]);
    const to = m[2] != null ? num(m[2]) : m[3] != null || m[1] === "*" ? max : from;
    const step = m[3] != null ? Number(m[3]) : 1;
    if (from == null || to == null || from < min || to > max || from > to || step < 1) return undefined;
    for (let v = from; v <= to; v += step) out.add(v);
  }
  return out.size ? out : undefined;
}
/**
 * Read a cron expression into a day matcher.
 * @param {unknown} expr
 * @returns {{readable: boolean, matches: ?((day: string) => boolean)}}
 */
export function readCron(expr) {
  const none = { readable: false, matches: null };
  if (typeof expr !== "string" || !expr.trim()) return none;
  const f = expr.trim().split(/\s+/);
  if (f.length < 6 || f.length > 7) return none;
  const [, , , domSpec, monthSpec, dowSpec, yearSpec = "*"] = f;
  const months = cronField(monthSpec, 1, 12, MONTH_NAMES);
  const years = cronField(yearSpec, 1970, 2199);
  if (months === undefined || years === undefined) return none;
  // Day of month: a set, "any", or L (the last day).
  let dom = null;
  let lastDay = false;
  if (domSpec === "L") lastDay = true;
  else if ((dom = cronField(domSpec, 1, 31)) === undefined) return none;
  // Day of week: a set, "any", nth-of-month, or last-of-month.
  let dow = null;
  let nth = null;
  let lastDow = null;
  const nthMatch = /^([A-Za-z0-9]+)#([1-5])$/.exec(dowSpec);
  const lastMatch = /^([A-Za-z0-9]+)L$/.exec(dowSpec);
  if (nthMatch) {
    const d = cronField(nthMatch[1], 1, 7, DOW_NAMES);
    if (!d || d.size !== 1) return none;
    nth = { dow: [...d][0], n: Number(nthMatch[2]) };
  } else if (lastMatch) {
    const d = cronField(lastMatch[1], 1, 7, DOW_NAMES);
    if (!d || d.size !== 1) return none;
    lastDow = [...d][0];
  } else if ((dow = cronField(dowSpec, 1, 7, DOW_NAMES)) === undefined) return none;
  const domAny = domSpec === "*" || domSpec === "?";
  const dowAny = dowSpec === "*" || dowSpec === "?";
  const matches = (day) => {
    const y = Number(day.slice(0, 4));
    const m = Number(day.slice(5, 7));
    const d = Number(day.slice(8, 10));
    if (months && !months.has(m)) return false;
    if (years && !years.has(y)) return false;
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 1; // 1 = Sunday, as Quartz counts
    const domOk = lastDay ? d === daysInMonth(y, m) : domAny || dom.has(d);
    const dowOk = nth ? weekday === nth.dow && Math.ceil(d / 7) === nth.n : lastDow != null ? weekday === lastDow && d + 7 > daysInMonth(y, m) : dowAny || dow.has(weekday);
    // Quartz: one of the two is `?`; with both given, either matching fires.
    if (!domAny && !dowAny && !lastDay && !nth && lastDow == null) return domOk || dowOk;
    return domOk && dowOk;
  };
  return { readable: true, matches };
}
// How far back the calculator looks for a fire: enough for an annual schedule and the one before it.
const CRON_LOOKBACK_DAYS = 800;
/**
 * When a schedule was last due before a day, and how far apart its runs are.
 * A run due ON `asOf` is not counted: it may not have fired yet that day.
 * @param {unknown} expr
 * @param {string} asOf YYYY-MM-DD
 * @returns {{readable: boolean, lastDue: ?string, previousDue: ?string, periodDays: ?number}}
 *   periodDays: the days between the last two fires; null when the one before is more than CRON_LOOKBACK_DAYS back
 */
export function cronLastDue(expr, asOf) {
  const { readable, matches } = readCron(expr);
  if (!readable) return { readable: false, lastDue: null, previousDue: null, periodDays: null };
  const end = dayNumber(asOf);
  let lastDue = null;
  let previousDue = null;
  for (let n = end - 1; n >= end - CRON_LOOKBACK_DAYS; n--) {
    if (!matches(dayText(n))) continue;
    if (lastDue == null) lastDue = n;
    else { previousDue = n; break; }
  }
  return { readable: true, lastDue: lastDue == null ? null : dayText(lastDue), previousDue: previousDue == null ? null : dayText(previousDue), periodDays: lastDue != null && previousDue != null ? lastDue - previousDue : null };
}

// ── Health: silent programs (HLT-1, S3b) ─────────────────────────────────────
// There is no "last send" figure to ask the server for, so the snapshot holds
// each program's last send DAY inside a recent day window (meta.health.dayWindow)
// and the rules are applied here, where the threshold is a reader's choice.
// The rules, ruled 2026-10-04 (HLT-1 ruling 3), one per kind of program:
//   recurring, readable cron   from the cron, when the program was last due
//                              and whether a send is logged since: none →
//                              "Possible silent failure" (a run can fire with
//                              nobody qualifying, or something is wrong; we
//                              cannot tell in advance). A period longer than
//                              the day window cannot be judged and says so.
//                              With the schedule's last-run result read live
//                              at the pull: failed → "Schedule run failed";
//                              succeeded → stays possible, "last run succeeded"
//                              beside it; not read → the KB's result and date.
//   recurring, unreadable cron the flat threshold, and it says so
//   one-time                   its own list, never a silent one: last send,
//                              the months it sent in, how many templates
//   no schedule, unknown, no doc  judged against its own history (a STARTING
//                              rule, read by Bradley at V2's Y6): a program
//                              that sends in fewer than half the closed months
//                              is late only past its longest gap between send
//                              months; one that sends most months, or with
//                              fewer than three months of history, is late at
//                              the flat threshold. Label: "No recent sends".
//   Active with no send in the window at all  listed apart from the alarms
//                              (it may be newly activated; there is no
//                              activation date)
export const SILENT_DAYS_DEFAULT = 30;
const ACTIVE_STATUS = "PROCESSING";
// Months of history before a program's own cadence can be read from it.
const HISTORY_MIN_MONTHS = 3;
export const SILENT_LISTS = deepFreeze({
  "possible-silent-failure": "Possible silent failure",
  "schedule-run-failed": "Schedule run failed",
  "no-recent-sends": "No recent sends",
  "one-time": "One-time and ad-hoc programs",
  "no-sends-in-window": "Active, no sends in this window",
  "cannot-judge": "Cannot judge: period longer than the window",
  ok: "Sending as expected",
});
const ALARM_LISTS = Object.freeze(["possible-silent-failure", "schedule-run-failed", "no-recent-sends"]);
const monthEnd = (ym) => `${ym}-${String(daysInMonth(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)))).padStart(2, "0")}`;
const monthsApart = (a, b) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
/**
 * The rules over plain inputs, so the adapter (which decides which flagged
 * programs to read live) and every reader of a snapshot apply ONE rule.
 * @param {{asOf: string, dayWindow: {start: string, endExclusive: string}, days: number, incompleteMonth: string, months: string[],
 *   programs: Array<{programId: string, name: ?string, statuses: string[], selected: boolean, lastSendDay: ?string, lastSendMonth: ?string,
 *     schedule: ?{classification: string, cronExpression: ?string}, lastRun: ?{lastRunSuccess: ?boolean, asOf: ?string, source: string}, sentMonths: string[], templates: number}>}} input
 * @returns {Array<{programId: string, name: ?string, statuses: string[], selected: boolean, lastSendDay: ?string, lastSendMonth: ?string, daysSilent: ?number, list: string, label: string, rule: string, detail: Object<string, *>}>}
 */
export function judgeSilence({ asOf, dayWindow, days, incompleteMonth, months, programs }) {
  const asOfN = dayNumber(asOf);
  const windowDays = dayNumber(dayWindow.endExclusive) - dayNumber(dayWindow.start);
  const closedMonths = months.filter((m) => m < incompleteMonth);
  const out = [];
  for (const p of programs) {
    if (!p.statuses.includes(ACTIVE_STATUS)) continue;
    const daysSilent = p.lastSendDay ? asOfN - dayNumber(p.lastSendDay) : null;
    // Days since the last send: exact inside the day window, else at least the days since that month ended.
    const daysSince = daysSilent ?? (p.lastSendMonth ? Math.max(windowDays, asOfN - dayNumber(monthEnd(p.lastSendMonth))) : null);
    const base = { programId: p.programId, name: p.name, statuses: p.statuses, selected: p.selected, lastSendDay: p.lastSendDay, lastSendMonth: p.lastSendMonth, daysSilent };
    const row = (list, rule, detail) => out.push({ ...base, list, label: SILENT_LISTS[list], rule, detail });
    const sentMonths = [...new Set(p.sentMonths ?? [])].sort();
    if (!p.selected) { row("no-sends-in-window", "no-sends", { windowMonths: months.length }); continue; }
    const cls = p.schedule?.classification ?? null;
    if (cls === "one-time") { row("one-time", "one-time", { monthsSent: sentMonths.length, templates: p.templates ?? 0, daysSince }); continue; }
    const flat = (list, rule, extra = {}) => {
      const silent = daysSince == null || daysSince >= days;
      row(silent ? list : "ok", rule, { threshold: days, daysSince, ...extra });
    };
    if (cls === "recurring") {
      const due = cronLastDue(p.schedule?.cronExpression, asOf);
      if (!due.readable || due.lastDue == null) { flat("possible-silent-failure", "flat", { cronUnreadable: true }); continue; }
      if (due.periodDays == null || due.periodDays > windowDays || due.lastDue < dayWindow.start) {
        row("cannot-judge", "cadence", { lastDue: due.lastDue, periodDays: due.periodDays, windowDays });
        continue;
      }
      const sentSince = p.lastSendDay != null && p.lastSendDay >= due.lastDue;
      const detail = { lastDue: due.lastDue, periodDays: due.periodDays, daysOverdue: asOfN - dayNumber(due.lastDue), sentSince };
      if (sentSince) { row("ok", "cadence", detail); continue; }
      const lr = p.lastRun ?? null;
      const lastRun = lr ? { lastRunSuccess: lr.lastRunSuccess, asOf: lr.asOf, source: lr.source } : null;
      if (lastRun?.source === "live" && lastRun.lastRunSuccess === false) row("schedule-run-failed", "cadence", { ...detail, lastRun });
      else row("possible-silent-failure", "cadence", { ...detail, lastRun, note: lastRun?.source === "live" && lastRun.lastRunSuccess === true ? "last run succeeded" : lastRun ? "last run result from the knowledge base" : "last run result not read" });
      continue;
    }
    // Event-driven, hand-fed or unknown: its own history.
    const sentClosed = sentMonths.filter((m) => closedMonths.includes(m));
    const rare = sentClosed.length >= HISTORY_MIN_MONTHS && sentClosed.length * 2 < closedMonths.length;
    if (!rare) { flat("no-recent-sends", sentClosed.length < HISTORY_MIN_MONTHS ? "flat" : "history", { monthsWithSends: sentClosed.length, closedMonths: closedMonths.length, usual: "most months" }); continue; }
    const gaps = sentClosed.slice(1).map((m, i) => monthsApart(sentClosed[i], m));
    const longestGapMonths = Math.max(...gaps);
    const allowedDays = longestGapMonths * 31;
    row(daysSince == null || daysSince > allowedDays ? "no-recent-sends" : "ok", "history", { monthsWithSends: sentClosed.length, closedMonths: closedMonths.length, longestGapMonths, allowedDays, daysSince });
  }
  return out;
}
/**
 * The silent-program lists over a snapshot (the reader's rule; the threshold
 * `days` is the flat one). `rows` is the alarm list: every Active program
 * judged silent under its rule, longest silent first. `lists` holds every
 * judged program by list id, the alarms included.
 * @param {T10Snapshot} snapshot
 * @param {{days?: number}} [opts]
 * @returns {{unavailable: ?{reason: string}, asOf: ?string, days: number, windowDays: ?number, rows: Array<*>, lists: Object<string, Array<*>>}}
 */
export function silentPrograms(snapshot, { days = SILENT_DAYS_DEFAULT } = {}) {
  const h = healthAvailability(snapshot);
  const part = h.parts.lastSends;
  const lists = () => Object.fromEntries(Object.keys(SILENT_LISTS).map((k) => [k, []]));
  if (!h.pulled || !part?.pulled || !h.asOf || !h.dayWindow) return { unavailable: { reason: (!h.pulled ? h.reason : part?.reason) ?? "not-pulled" }, asOf: h.asOf, days, windowDays: null, rows: [], lists: lists() };
  const windowDays = dayNumber(h.dayWindow.endExclusive) - dayNumber(h.dayWindow.start);
  if (!Number.isInteger(days) || days < 1 || days > windowDays)
    throw new Error(`engagement query: silent-program days must be a whole number from 1 to ${windowDays}, the days of sends this snapshot holds by day (got ${days})`);
  const schedule = new Map(snapshot.dimensions.programs.map((p) => [p.id, p.schedule ?? null]));
  // The last-run result: a live read at this pull first, else the KB's.
  const lastRun = new Map();
  for (const r of /** @type {any[]} */ (snapshot.facts.health?.schedules ?? [])) {
    const source = r.source ?? "kb";
    const have = lastRun.get(r.programId);
    if (!have || (source === "live" && have.source !== "live")) lastRun.set(r.programId, { lastRunSuccess: r.lastRunSuccess, asOf: r.asOf, source });
  }
  const sentMonths = new Map();
  for (const r of snapshot.facts.byTemplate) {
    if (!sentMonths.has(r.programId)) sentMonths.set(r.programId, new Set());
    if (r.sent > 0) sentMonths.get(r.programId).add(r.month);
  }
  const templates = new Map();
  for (const t of snapshot.dimensions.templates) for (const u of t.uses) templates.set(u.programId, (templates.get(u.programId) ?? 0) + 1);
  const judged = judgeSilence({
    asOf: h.asOf, dayWindow: h.dayWindow, days, incompleteMonth: String(snapshot.meta.incompleteFrom).slice(0, 7), months: snapshot.dimensions.months,
    programs: /** @type {any[]} */ (snapshot.facts.health?.lastSends ?? []).map((r) => ({ ...r, schedule: schedule.get(r.programId) ?? null, lastRun: lastRun.get(r.programId) ?? null, sentMonths: [...(sentMonths.get(r.programId) ?? [])], templates: templates.get(r.programId) ?? 0 })),
  });
  const order = (a, b) => (a.daysSilent == null ? (b.daysSilent == null ? 0 : -1) : b.daysSilent == null ? 1 : b.daysSilent - a.daysSilent) || cmp(a.programId, b.programId);
  const byList = lists();
  for (const r of judged) byList[r.list].push(r);
  for (const k of Object.keys(byList)) byList[k].sort(order);
  // Longest silent first: a last send before the day window, then by days.
  const rows = judged.filter((r) => ALARM_LISTS.includes(r.list)).sort(order);
  return { unavailable: null, asOf: h.asOf, days, windowDays, rows, lists: byList };
}

// ── How a cell is shown ──────────────────────────────────────────────────────
// One renderer of the three tracking states (R1b): a tracked 0 is an ordinary
// 0; not-tracked is words, never a number; unknown is the value with a marker.
export const NO_VALUE = "—";
export const NOT_TRACKED = "Not tracked";
export const UNKNOWN_MARK = "(tracking unknown)";
const isRate = (def) => def.kind === "rate" || def.status === "rate";
/**
 * @param {string} metricId
 * @param {EngagementCell} cell
 * @returns {string}
 */
export function formatCell(metricId, cell) {
  const def = metric(metricId);
  if (cell.value == null) return cell.why === "not-tracked" ? NOT_TRACKED : NO_VALUE;
  const shown = isRate(def) ? `${(cell.value * 100).toFixed(1)}%` : String(cell.value);
  return cell.state === "unknown" ? `${shown} ${UNKNOWN_MARK}` : shown;
}

// ── The glossary: every number, verifiable on its own ────────────────────────
const condText = (c) => `${c.field} ${{ EQ: "=", NE: "is not", GT: ">" }[c.op] ?? c.op} ${typeof c.value === "string" ? JSON.stringify(c.value) : String(c.value)}`;
const lookupText = (l) => `${l.to}.${l.leaf}, through ${l.through}`;
const flagText = (src, def) =>
  def.counts.length ? def.counts.map((c) => `${src.flags[c.flag].field} ${c.is ? "=" : "is not"} ${src.flags[c.flag].value}`).join(def.match === "any" ? " or " : " and ") : "every row (no field condition)";
const AFTER_READ = {
  "content-links": () =>
    `Each clicked link is classified after the read. A link is not content when it matches ${NON_CONTENT_LINK_RULES.map((r) => `/${r.re.source}/ (${r.kind})`).join(" or ")}; every other link is content.`,
  "unsubscribe-input": (snapshot) => {
    const links = snapshot?.meta?.params?.unsubscribeLinks ?? [];
    return links.length
      ? `This pull also treated links on ${links.join(", ")} as unsubscribe links (the --unsubscribe-link input).`
      : "No unsubscribe link of the tenant's own was named for this pull (--unsubscribe-link), so only the generic wordings above are left out.";
  },
  "distinct-never-summed": () => "A distinct count is asked for per program, for the whole window and for each month. It is never added across programs or months.",
};
/**
 * One registry entry as an admin can rebuild it in a Gainsight report: the
 * object, the field or fields and the value that counts, the filters every
 * count carries, the date field, the calculation, and what is done after the
 * read. Rendered from SOURCES and METRICS; nothing here is written twice.
 * @param {string} id
 * @param {?T10Snapshot} [snapshot] names this pull's inputs and whether step detail was read
 * @returns {{id: string, label: string, definition: string, object: string, fields: string, filters: string[], dateField: string, calculation: string, zeroDenominator: ?string, afterRead: string[], perStep: ?string, uiParity: ?string, caveats: string[]}}
 *   perStep: where the per-step rows of the same measure are read from, when the snapshot carries step detail
 */
export function describeMetric(id, snapshot = null) {
  const def = metric(id);
  const stepDetail = !!snapshot?.meta?.stepDetail;
  const base = { id: def.id, label: def.label, definition: def.definition, uiParity: def.uiParity ?? null, caveats: [...def.caveats], zeroDenominator: null, perStep: null };
  const afterRead = def.afterRead.map((a) => AFTER_READ[a](snapshot));
  if (def.kind === "rate" || def.status === "rate") {
    const num = metric(def.numerator);
    const den = metric(def.denominator);
    const parts = [describeMetric(num.id, snapshot), describeMetric(den.id, snapshot)];
    return {
      ...base,
      object: parts[0].object,
      fields: `${num.label}: ${parts[0].fields}. ${den.label}: ${parts[1].fields}.`,
      filters: parts[0].filters,
      dateField: parts[0].dateField,
      calculation: `${num.label} ÷ ${den.label}`,
      zeroDenominator: `Blank, never 0%, when ${den.label} is 0.`,
      // What is done to its two parts after the read is stated on their own entries.
      afterRead,
    };
  }
  const src = SOURCES[def.source];
  const filters = src.standing.map(condText);
  if (def.kind === "response") {
    const allTime = `None for the all-time figures (no date filter). Monthly counts are bucketed by ${src.dateField}.`;
    const attributed = `Attributed to the program through ${lookupText(src.lookups.program)}.`;
    if (def.status === "participants") return { ...base, object: src.object, fields: "every row of the program (no field condition)", filters, dateField: allTime, calculation: "COUNT of rows", afterRead: [attributed, ...afterRead] };
    const one = (s) => `${condText(src.responded)} and ${src.statusField} = ${JSON.stringify(src.statuses[s])}`;
    const fields = def.status === "any" ? `${one("submitted")}, plus ${one("partiallySubmitted")}` : one(def.status);
    return { ...base, object: src.object, fields, filters, dateField: allTime, calculation: def.status === "any" ? "Submitted + Partially submitted" : "COUNT of rows", afterRead: [attributed, ...afterRead] };
  }
  if (def.kind === "distinct") {
    return {
      ...base, object: src.object, fields: `distinct ${lookupText(src.lookups[def.distinctOf])}`, filters,
      dateField: src.dateField, calculation: "COUNT DISTINCT, per program", afterRead,
    };
  }
  const steps = SOURCES.steps;
  const fields = def.counts ? flagText(src, def) : `${src.clicks.countField} > 0, then each link in ${src.clicks.detailField}`;
  const stepFields = def.counts ? flagText(steps, def) : `${steps.clicks.flagField} = true, kept only where the same send has a content-link click in ${src.object}`;
  return {
    ...base, object: src.object, fields, filters, dateField: src.dateField, calculation: "COUNT of rows", afterRead,
    perStep: stepDetail ? `${steps.object}: ${stepFields}; filter ${steps.standing.map(condText).join(" and ")}; date field ${steps.dateField}` : null,
  };
}
/**
 * The glossary of the metrics an output shows, in registry order, each rate
 * with the two metrics it divides (so no formula names a part the glossary
 * does not explain).
 * @param {string[]} ids registry ids
 * @param {?T10Snapshot} [snapshot]
 */
export function glossary(ids, snapshot = null) {
  const want = new Set(ids.flatMap((id) => [id, metric(id).numerator, metric(id).denominator].filter(Boolean)));
  return METRICS.filter((m) => want.has(m.id)).map((m) => describeMetric(m.id, snapshot));
}
/**
 * What holds for every send figure of this pull, stated once beside the
 * glossary: how recipients are classed.
 * @param {?T10Snapshot} snapshot
 * @returns {string[]}
 */
export function glossaryNotes(snapshot) {
  const domains = snapshot?.meta?.params?.internalDomains ?? [];
  return [
    domains.length
      ? `Internal recipients are addresses ending in ${domains.map((d) => `@${d}`).join(" or ")}. External figures are all recipients minus internal ones; distinct counts are asked for external recipients on their own.`
      : "No internal domain was named for this pull (--internal-domain), so every recipient counts as external.",
  ];
}

// ── Caveats ──────────────────────────────────────────────────────────────────
// A metric names its caveats by id; a snapshot carries its own as {id, detail}.
// The text of both is here, once. A caveat the table lacks is shown with its
// id and detail rather than dropped.
const list = (xs) => xs.join(", ");
export const CAVEATS = Object.freeze({
  // Metric caveats.
  "opens-are-pixel-loads": () => "Opens are image-pixel loads. Apple Mail Privacy Protection and security scanners inflate them, and blocked images hide real ones. Compare programs with each other, not with an outside benchmark.",
  "delivered-small-groups": () => "Open rate and click rate divide by Delivered (went out and did not bounce). A send that was opened and bounced afterwards counts as opened and not delivered, which can lift the rate of a very small group.",
  "clicks-content-only": () => "Click figures count content links only. Unsubscribe and mailto clicks are left out, so they will rarely match the Gainsight UI.",
  "click-tracking-states": () => `Click tracking may not be enabled. "${NOT_TRACKED}" means no link in the email is click-tracked, so there is no figure. "${UNKNOWN_MARK}" means the data cannot tell whether clicks are tracked: the figure is shown, and a 0 there may not be a real 0. A program reads tracked only when every one of its templates is.`,
  "uniques-scope": () => `Unique recipients, accounts reached and participant records are exact per program, for the whole window and for each single month. They are never added across programs or months, and show ${NO_VALUE} for any other date range.`,
  "responses-program-level": () => "Survey responses are counted per program, with test participants left out. They match the program's analytics page in Gainsight. The survey's own analytics page counts every program that ever sent the survey, deleted ones included, and includes test responses, so it reads higher.",
  "failures-are-send-failures": () => "Send failures and the error rate count attempts that bounced or were rejected. A participant a program could not process never becomes an attempt, so it is not in the rate; those are counted separately, with their reasons.",
  "responses-all-time": () => "Survey response figures and the response rate are all time, not limited to the report's window: the denominator has no date.",
  // Every snapshot.
  "incomplete-period": (d) => `Sends on or after ${d.from} are provisional: opens keep arriving, so the recent period reads low.`,
  "status-is-today": () => "Program status is today's status. There is no status history.",
  // The snapshot's own.
  "carried-forward-months": (d) => `${list(d.months ?? [])} ${(d.months ?? []).length === 1 ? "was" : "were"} carried forward from the pull of ${d.previousPulledAt}, not read again. Opens that arrived after that pull are not counted: a pull that continues from an earlier snapshot reads only the last ${d.repullMonths} month(s) again.`,
  "deleted-programs-excluded": (d) => `${d.programs} deleted program(s), with ${d.sent} send(s) in the window, are left out.`,
  "participant-records-not-pulled": (d) => `Participant records are blank. ${reasonText(d.reason)}`,
  "accounts-not-pulled": (d) => `There is no account data in this report. ${reasonText(d.reason)} Accounts reached per program is counted either way.`,
  "recipient-class-not-configured": () => "No internal domain was named for this pull, so every recipient counts as external and internal recipients are not separated.",
  "step-names-unavailable": (d) => `${d.programs} program(s) have no full doc in the knowledge base, so their emails are listed by template name, without step names.`,
  "responses-unreadable": (d) => `The survey object (${d.object}) could not be read on this tenant, so survey responses are unknown for every program.`,
  "reconciliation-mismatch": (d) => `RECONCILIATION FAILED in closed months (${list(d.checks ?? [])}): tables that must add up to the same totals do not. Treat the numbers as unreliable and pull again before using them.`,
  "incomplete-period-drift": (d) => `The tables differ slightly in the incomplete period, from ${d.from} (${list((d.checks ?? []).map((c) => `${c.id}: ${c.drift}`))}). This is not a failure: that period was still being written while the calls ran one after another. Closed months are compared separately.`,
  "health-incomplete": (d) => `Some health data could not be read (${list((d.parts ?? []).map((p) => `${p.part}: ${reasonText(p.reason)}`))}). What is missing is shown as missing, never as "no failures".`,
  "schedules-from-kb": (d) =>
    `Schedule configuration and last-run results come from the knowledge base, as of the date each program was last documented${d.oldest ? ` (the oldest is ${d.oldest})` : ""}. The knowledge base is refreshed when a program's configuration changes, so a run that began failing after that date is not shown here unless the program was documented again. ` +
    (d.liveRead ? `${d.liveRead} program(s) flagged as possibly silent had their last-run result read live at this pull${d.cap != null ? ` (at most ${d.cap} are)` : ""}${d.flagged > d.liveRead ? `; ${d.flagged - d.liveRead} more flagged program(s) were not, and show the knowledge base's result` : ""}.` : "No program's last-run result was read live at this pull."),
  "health-all-time": (d) => `${list(d.parts ?? [])} are all time: the objects they are read from carry no date on every row, so the date filter does not apply to them.`,
  "participant-failures-no-breakdown": (d) => `Participant failures are counted per program with no breakdown by reason. ${reasonText(d.reason)}${d.expectedReasons ? ` The ${d.expectedReasons} expected reason(s) named for this pull could not be counted apart for the same reason.` : ""}`,
  "failure-categories-overlap": (d) => `The failure category list overlaps: ${d.rows} "Other" row(s) in ${list(d.parts ?? [])} count below zero. Two patterns match the same message, so a message is counted twice; fix the list. Nothing was clamped.`,
  "step-names-as-of": (d) => `Step names come from the knowledge base, as of the date each program was last documented${d.oldest ? ` (the oldest is ${d.oldest})` : ""}. A step renamed since then shows its earlier name.`,
  "test-accounts-not-on-steps": (d) => `${d.accounts} test account(s) are counted as internal recipients in the template and account tables, not in the step table: the step log carries no company link, so its internal figures are by email domain alone.`,
  // From the honesty counts.
  "cc-copies-excluded": (d) => `${d.count} CC copies are left out: only "To" recipients are counted.`,
  "other-sources-excluded": (d) => `${d.count} email(s) sent by other Gainsight features are left out: only Journey Orchestrator sends are counted.`,
  "unselected-programs": (d) => `${d.programs} other program(s) with ${d.sent} send(s) in the window were not selected for this pull.`,
  "no-template-id": (d) => `${d.sent} send(s) name no template. They are counted in their program, on a row with no template.`,
  "test-participants-excluded": (d) => `${d.count} test participant(s) are left out of the survey figures.`,
  "click-detail-unreadable": (d) => `${d.count} clicked send(s) had link detail that could not be read; they count as not clicked.`,
});
/**
 * One caveat in words.
 * @param {string} id
 * @param {Object<string, *>} [detail]
 * @returns {string}
 */
export const caveatText = (id, detail = {}) => (CAVEATS[id] ? CAVEATS[id](detail) : `${id}: ${JSON.stringify(detail)}`);
// The snapshot's own caveats that are about its health tables: an output that
// shows none of them does not carry these.
const HEALTH_CAVEATS = Object.freeze(["health-incomplete", "schedules-from-kb", "health-all-time", "participant-failures-no-breakdown", "failure-categories-overlap"]);
/**
 * The caveats block of any output over this snapshot: the snapshot's own
 * (failures first), what the pull left out, the incomplete period, and the
 * caveats of the metrics shown.
 * @param {T10Snapshot} snapshot
 * @param {string[]} metricIds the metrics the output shows
 * @param {{health?: boolean}} [shows] health: the output shows health tables (bounce reasons, failures, silent programs, schedules)
 * @returns {Array<{id: string, text: string}>}
 */
export function caveatsFor(snapshot, metricIds, { health = false } = {}) {
  const out = [];
  const push = (id, detail) => {
    if (!out.some((c) => c.id === id)) out.push({ id, text: caveatText(id, detail) });
  };
  const own = [...snapshot.caveats].sort((a, b) => Number(b.id === "reconciliation-mismatch") - Number(a.id === "reconciliation-mismatch"));
  for (const c of own) if (health || !HEALTH_CAVEATS.includes(c.id)) push(c.id, c.detail);
  push("incomplete-period", { from: snapshot.meta.incompleteFrom });
  for (const id of metricIds) for (const c of metric(id).caveats) push(c, {});
  for (const id of metricIds) {
    const def = metric(id);
    for (const part of [def.numerator, def.denominator].filter(Boolean)) for (const c of metric(part).caveats) push(c, {});
  }
  push("status-is-today", {});
  const h = snapshot.honesty ?? {};
  const ex = h.excluded ?? {};
  if (ex.ccCopies) push("cc-copies-excluded", { count: ex.ccCopies });
  if (ex.nonJoSources) push("other-sources-excluded", { count: ex.nonJoSources });
  if (ex.unselectedPrograms?.programs) push("unselected-programs", ex.unselectedPrograms);
  if (h.noTemplateId?.sent) push("no-template-id", h.noTemplateId);
  if (h.responses?.testParticipantsExcluded && metricIds.some((id) => metric(id).kind === "response")) push("test-participants-excluded", { count: h.responses.testParticipantsExcluded });
  const unread = (h.clicks?.unreadable ?? 0) + (h.clicks?.detailMissing ?? 0);
  if (unread && metricIds.some((id) => metric(id).tracking === "clicks")) push("click-detail-unreadable", { count: unread });
  return out;
}
/**
 * The "data pulled" line every output carries (R4).
 * @param {T10Snapshot} snapshot
 * @returns {string}
 */
export function dataPulledLine(snapshot) {
  const m = snapshot.meta;
  return `Data pulled ${m.pulledAt}${m.timeZone ? ` (${m.timeZone})` : ""} from ${m.tenantHost}. Window ${m.window.from} to ${m.window.to}; sends on or after ${m.incompleteFrom} are provisional.`;
}
