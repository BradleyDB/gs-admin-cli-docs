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
  // Health (HLT-1). The all-time totals carry no date; the dated reads below use the one date each object
  // keeps on every row (measured 2026-10-07: both DATETIME, filterable and groupable by month and day).
  failedParticipants: {
    object: "ao_failed_participants",
    what: "one row per participant a program could not admit (refused at entry), with the reason",
    standing: [],
    programField: "AdvancedOutreachId",
    // A JSON-path field: its schema declares it neither filterable nor groupable (measured S3b: CONTAINS,
    // DOES_NOT_CONTAINS and STARTS_WITH are all refused), so refusals are COUNTED per program (COUNT of rows,
    // SUM of occurrences) with no server-side breakdown by reason, and a capped per-program sample of the most
    // recent rows is read for the breakdown, labelled as a sample (F-484, F-491).
    reasonField: "FailureReasons",
    reasonFilterable: false,
    occurrencesField: "OccurrenceCount",
    // The last time the SAME participant was refused again: a record modified in the window is a refusal
    // that is still happening (measured 2026-10-07: records with several occurrences modified that day).
    dateField: "ModifiedAt",
  },
  participants: {
    object: "ao_participants",
    what: "one row per participant of a program",
    standing: [],
    programField: "AdvancedOutreachId",
    stateField: "ParticipantState",
    // When the participant was admitted (CreatedAt) and last moved (ModifiedAt): both filterable, groupable
    // by month and day (measured 2026-10-07).
    createdField: "CreatedAt",
    dateField: "ModifiedAt",
    // Why a participant fell off at a STEP (a CTA step that failed, a bounce drop, a record delete): a
    // STRING field that takes CONTAINS (measured 2026-10-07), so step failures are counted by category
    // server-side like bounce reasons. The entry refusals live on ao_failed_participants, not here.
    reasonField: "FailureReasons",
    reasonFilterable: true,
    // The state the platform leaves a participant in when a step errors on its side (measured 2026-10-07:
    // "Failed to evaluate condition, Reason: null" and two orchestration-engine errors).
    errorState: "SYSTEM_ERROR",
  },
  // Each program's participant sources and when each last synced: the one heartbeat of an ingest that this
  // tenant records (the schedule's own run-state fields are unset even on healthy daily programs; measured
  // 2026-10-07). One row per source version; the active version of each is what counts.
  sources: {
    object: "ao_participant_source_configuration",
    what: "one row per participant source of a program, with the time it last synced",
    standing: [{ field: "ActiveVersion", op: "EQ", value: true }, { field: "Deleted", op: "EQ", value: false }],
    programField: "AdvancedOutreachId",
    typeField: "ParticipantSourceType",
    syncedField: "LastSyncedOn",
    operationField: "ParticipantOperationType",
  },
});

// ── Error messages: masked before they are stored (HLT-1) ────────────────────
// A bounce or failure reason is free text from a mail server or the product,
// and it names people: addresses, ids, reference numbers. The rules are data,
// applied in this order; each replaces what it matches with a placeholder, so
// two messages that differ only in whom they name become one message and are
// counted together. A placeholder matches no rule, so masking twice changes
// nothing. What is NOT masked, and why (F-492, ruled 2026-10-08): a mail host
// (an organisation's mail server, a vendor's help site) is product text as often
// as it is a recipient's — the host rule took 7 of 30 captured bounce wordings
// (Microsoft's dotted diagnostic codes, vendors' help links) — and the samples
// it would protect are terminal-only and never leave the workspace; and the
// scheme, host and path of a URL (MASK_PROTECTED) SUPPRESS the token and
// number rules alone, because a help link's path reads as one long id — the
// email, uuid and ipv4 rules run over the whole text, a URL's path included
// (F-492, second reopen: the first fix cut the span out before ANY rule ran,
// so an address inside a URL's path was stored).
/** @type {ReadonlyArray<{id: string, what: string, re: RegExp, as: string}>} */
export const MASK_RULES = Object.freeze([
  { id: "email", what: "an email address, with its angle brackets when it has them", re: /<?[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+>?/g, as: "<email>" },
  { id: "uuid", what: "a UUID", re: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, as: "<id>" },
  { id: "ipv4", what: "an IPv4 address", re: /\b\d{1,3}(?:\.\d{1,3}){3}\b/g, as: "<ip>" },
  // The id character class covers what mail gateways write (F-492): letters, digits, `-`, `_`, `.`, `+`, `/`, `=`.
  { id: "token", what: "a run of 12 or more letters, digits, hyphens, underscores, dots, plus, slash or equals signs that holds both a letter and a digit (a record id, a message id), outside a URL's scheme, host and path", re: /(?<![A-Za-z0-9._+/=-])(?=[A-Za-z0-9._+/=-]*\d)(?=[A-Za-z0-9._+/=-]*[A-Za-z])[A-Za-z0-9._+/=-]{12,}(?![A-Za-z0-9._+/=-])/g, as: "<id>" },
  { id: "number", what: "a run of 5 or more digits, outside a URL's scheme, host and path", re: /\d{5,}/g, as: "<number>" },
].map((r) => Object.freeze(r)));
// Where the rules it names do not run: a URL up to its query or fragment (the
// scheme, host and path a vendor's help link is made of). The query and the
// fragment ARE masked: a tracking id lives there. Only the rules `suppresses`
// names stop at the span; every other rule runs over the whole text.
export const MASK_PROTECTED = Object.freeze({ id: "url-path", what: "a URL's scheme, host and path, up to its query or fragment", re: /https?:\/\/[^\s?#<>"'\]\[)(]+/g, suppresses: Object.freeze(["token", "number"]) });
export const MASK_MAX_LENGTH = 300;
/**
 * One raw error message → the text that may be stored: every MASK_RULES match
 * replaced (the rules the protected span suppresses stop at a URL's scheme,
 * host and path; the rest run over the whole text), white space collapsed,
 * cut to MASK_MAX_LENGTH. Null for no text.
 * @param {unknown} raw
 * @returns {?string}
 */
export function maskMessage(raw) {
  if (typeof raw !== "string") return null;
  const everywhere = MASK_RULES.filter((r) => !MASK_PROTECTED.suppresses.includes(r.id));
  const mask = (rules, s) => { for (const rule of rules) s = s.replace(rule.re, rule.as); return s; };
  // The protected spans are found on the RAW text (a host the ipv4 rule masks must not end its span early): inside a
  // span only the rules that run everywhere apply; between spans every rule does.
  let text = "";
  let at = 0;
  for (const m of raw.matchAll(MASK_PROTECTED.re)) {
    text += mask(MASK_RULES, raw.slice(at, m.index)) + mask(everywhere, m[0]);
    at = m.index + m[0].length;
  }
  text += mask(MASK_RULES, raw.slice(at));
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
// The SHIPPED lists hold Gainsight product text only, captured from a tenant's
// own messages (never written from memory): the only reason a wording may ship
// is that it carries no tenant value. Bounce reasons ship EMPTY (the captured
// list awaits Bradley's ruling on which entries are product text). The entry
// refusals ship the wordings measured on 2026-10-07 and 2026-10-08 (500 of a
// month's refused participants held the first eight; the ninth was read from
// the most repeated refusals of the largest program).
// Every category has a KIND (FAILURE_KINDS; Bradley, 2026-10-08, F-491): a
// BUSINESS RULE working as configured (already in the list, unique criteria,
// met the advanced criteria, unsubscribed, opted out), a BAD ADDRESS (a null or
// invalid address, a bounce, the bounce list — "if their email is bad we would
// expect it to bounce ... it's not the same as 'participant with unique criteria
// exists'"), or a PROGRAM ERROR (a step that cannot run, the platform's own
// error). `expected` is derived, one meaning everywhere: the kind is a business
// rule. The lists read the kind: a program errors only on program errors; at
// entry anything that is not a business rule is "not expected by design" (a
// null address is a data problem, ruled 2026-10-07).
// A tenant adds its own on top (the adapter's --failure-categories file, with a
// `kind`, or `expected: true` for a business rule), and names expected failures
// (--expected-reason), which become business-rule categories, so a page can
// leave them out of headline counts without hiding them.
// Each entry: {id, label, pattern, definition, kind}.
// A pattern names the INVARIANT core of a product wording, never the text the
// platform fills in per program (the mapped field's label, the value, the step
// name): F-484, redesigned a second time 2026-10-08, when the null-address
// wording was found with three field labels on one tenant ("Recipient Email
// Address field", "Custom field", "Manager Email Address field").
// The fourth kind, "unknown", is never a category's: it is the kind of a text
// NO category matches (category UNCLASSIFIED_CATEGORY), one label in every
// table and list, flagged as needing investigation and reported so the shipped
// list can learn the wording. It is never folded into a known kind.
export const FAILURE_KINDS = Object.freeze(["business-rule", "bad-address", "program-error", "unknown"]);
/** The kind of a text no category matches; a tenant's list may not use it. */
export const UNKNOWN_KIND = "unknown";
/** @type {Readonly<{bounceReasons: ReadonlyArray<FailureCategory>, participantFailures: ReadonlyArray<FailureCategory>}>} */
export const FAILURE_CATEGORIES = deepFreeze({
  bounceReasons: [],
  participantFailures: [
    { id: "already-in-list", label: "Already in the participant list", pattern: "Participant already exists in participant list", definition: "The participant is already in the program, so the source did not add them again.", kind: "business-rule" },
    { id: "unique-criteria", label: "Unique criteria already met", pattern: "Participant with unique criteria already exists", definition: "A participant with the same unique criteria is already in the program.", kind: "business-rule" },
    { id: "advanced-criteria", label: "Met the advanced criteria", pattern: "Participant has met the advanced criteria", definition: "The program's advanced criteria excluded the participant, as configured.", kind: "business-rule" },
    { id: "unsubscribed", label: "Unsubscribed from a category", pattern: "Participant has unsubscribed from one or more categories", definition: "The recipient has unsubscribed from an email category the program sends.", kind: "business-rule" },
    { id: "global-opt-out", label: "On the global opt-out", pattern: "Participant part of Global Opt Out", definition: "The recipient is on the tenant's global opt-out list.", kind: "business-rule" },
    { id: "bounce-list", label: "On the bounce list", pattern: "Participant part of Bounce list", definition: "The recipient's address is on the tenant's bounce list: it bounced before.", kind: "bad-address" },
    { id: "opt-out-at-send", label: "Opted out at the send step", pattern: "GlobalOptOut recipient(to) email", definition: "The recipient was on the global opt-out when the Send Email step ran.", kind: "business-rule" },
    { id: "bounced-at-send", label: "Bounced at the send step", pattern: "Bounced recipient(to) email", definition: "The recipient's address had bounced when the Send Email step ran.", kind: "bad-address" },
    // The wording is a template, "<field label> field contains Invalid value {<value>} for <TYPE> data type": the label
    // names the field the program maps (the recipient's address, a manager's, a custom field) and varies per program,
    // so the pattern is the invariant core (F-484, 2026-10-08). The masked text keeps the label, so a reader sees which.
    { id: "invalid-field-value", label: "Invalid or missing value in a mapped field", pattern: "contains Invalid value", definition: "A field the program maps (most often the recipient's email address) holds no value or an invalid one on the participant record: a data problem at the source. The wording names the field.", kind: "bad-address" },
  ],
});
/** @typedef {{id: string, label: string, pattern: string, definition: string, kind?: string, expected?: boolean}} FailureCategory */
// "other" is the counted REMAINDER of a tenant's own list (the bounce reasons: total less the categories, an
// open world of mail-server text). "unclassified" is a PRODUCT wording the shipped list does not know (an entry
// refusal, a step failure): kind unknown, the same label in every table and list, named by the pull so the list
// can learn it (F-484, 2026-10-08). The two are never the same thing.
export const OTHER_CATEGORY = "other";
export const UNCLASSIFIED_CATEGORY = "unclassified";
export const FAILURE_PARTS = Object.freeze(["bounceReasons", "participantFailures"]);
/**
 * A category's kind: its own, else a business rule when it was flagged expected, else a program error. The ONE
 * fallback rule (F-501): a STORED row (`stored`) may carry the kind "unknown"; a category never does.
 * @param {*} c @param {{stored?: boolean}} [opts]
 */
export const kindOf = (c, { stored = false } = {}) => (FAILURE_KINDS.includes(c?.kind) && (stored || c.kind !== UNKNOWN_KIND) ? c.kind : c?.expected === true ? "business-rule" : "program-error");
/** The one meaning of `expected`: the kind is a business rule working. */
export const isExpectedKind = (kind) => kind === "business-rule";
// Why a participant who got IN fell off at a step (ao_participants.FailureReasons,
// counted server-side with CONTAINS; F-491, Bradley's fourth condition). Each
// text category names the product wording the measured tenant writes; the
// platform error is a participant STATE, not a text. The Send Email step's own
// drops (a reject, the bounce list, an opt-out) were read on 2026-10-08 from the
// uncategorised text of six programs the list had read as erring.
/** @type {ReadonlyArray<{id: string, label: string, pattern?: string, state?: string, definition: string, kind: string}>} */
export const STEP_FAILURE_CATEGORIES = deepFreeze([
  { id: "step-action-failed", label: "A step's action failed", pattern: "creation failed at step", definition: "A step could not perform its action (a CTA could not be created: invalid or missing field values).", kind: "program-error" },
  { id: "platform-error", label: "Platform error", state: "SYSTEM_ERROR", definition: "The platform could not execute a step for the participant (a condition failed to evaluate; an engine error). Clusters on dates mark an outage or a maintenance window.", kind: "program-error" },
  { id: "bounce-drop", label: "Dropped after a bounce", pattern: "Email is Bounce, participant is dropped", definition: "The participant's email bounced and the program dropped them, as configured.", kind: "bad-address" },
  { id: "reject-drop", label: "Dropped after a reject", pattern: "Email is Reject, participant is dropped", definition: "The recipient's mail server rejected the email and the program dropped the participant, as configured.", kind: "bad-address" },
  { id: "bounce-list-at-send", label: "On the bounce list at the send step", pattern: "Recipient on Gainsight bounce list", definition: "The recipient's address was on the tenant's bounce list when the Send Email step ran.", kind: "bad-address" },
  { id: "opt-out-at-send", label: "Opted out at the send step", pattern: "Recipient has opted out", definition: "The recipient had opted out when the Send Email step ran.", kind: "business-rule" },
  { id: "record-delete", label: "Dropped with the deleted record", pattern: "as part of Record Delete operation", definition: "The base object record was deleted, so the participant was removed.", kind: "business-rule" },
]);
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
    if (typeof c.id === "string" && c.id.trim() === UNCLASSIFIED_CATEGORY) problems.push(`${at}: the id "${UNCLASSIFIED_CATEGORY}" is reserved for a wording no category matches`);
    if ("expected" in c && typeof c.expected !== "boolean") problems.push(`${at}: expected must be true or false`);
    if ("kind" in c && (!FAILURE_KINDS.includes(c.kind) || c.kind === UNKNOWN_KIND)) problems.push(`${at}: kind must be one of ${FAILURE_KINDS.filter((k) => k !== UNKNOWN_KIND).join(", ")} ("${UNKNOWN_KIND}" is the kind of a text no category matches, never a category's)`);
    if (typeof c.kind === "string" && typeof c.expected === "boolean" && c.expected !== isExpectedKind(c.kind)) problems.push(`${at}: expected ${c.expected} contradicts kind "${c.kind}" (expected means a business rule; leave one of the two out)`);
    const extra = Object.keys(c).filter((k) => !["id", "label", "pattern", "definition", "expected", "kind"].includes(k));
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
 * the tenant's own entries, each normalized to {id, label, pattern, definition, kind, expected}
 * (a bounce category with no kind is a bad address, whatever its expected flag
 * says, unless flagged expected: true, a business rule — F-495; any other with
 * none is a business rule when flagged expected, else a program error).
 * @param {"bounceReasons"|"participantFailures"} part
 * @param {ReadonlyArray<FailureCategory>} [extra]
 * @returns {Array<{id: string, label: string, pattern: string, definition: string, kind: string, expected: boolean}>}
 */
export function categoryTable(part, extra = []) {
  if (!FAILURE_PARTS.includes(part)) throw new Error(`engagement query: no failure categories for "${part}"`);
  const problems = validateCategories([...FAILURE_CATEGORIES[part], ...extra]);
  const list = [...FAILURE_CATEGORIES[part], ...extra].map((c) => {
    const kind = part === "bounceReasons" && c.kind == null ? (c.expected === true ? "business-rule" : "bad-address") : kindOf(c);
    return { id: c.id.trim(), label: c.label.trim(), pattern: c.pattern.trim(), definition: c.definition.trim(), kind, expected: isExpectedKind(kind) };
  });
  problems.push(...validateCategories(list).filter((p) => !problems.includes(p)));
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
// R19: what a template's own link settings say about click tracking, read from
// its `jo email template --id` payload at the sanctioned fetch (doc-lib
// readLinkTracking, written into the KB doc; TPL-1). Only link-map entries
// present in the current content count, and system links (the rules above)
// are left out: a tracked content link means a never-clicked template's 0% is
// real; content links with none tracked means "Not tracked"; no readable
// content link (an empty map, every entry stale) means the flag cannot be read.
export const LINK_READINGS = Object.freeze(["tracked-link-present", "links-none-tracked", "unreadable"]);

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
 * @returns {{pulled: boolean, reason: ?string, asOf: ?string, dayWindow: ?{start: string, endExclusive: string}, parts: Object<string, {pulled: boolean, reason: ?string, basis?: string}>, categories?: Object<string, *>, samples?: Object<string, {cap: number, sampled: number, carried: number, notSampled: Array<{programId: string, reason: string}>, programs?: string[], window?: {start: string, endExclusive: string}, counts?: Object<string, number>}>}}
 */
export const healthAvailability = (snapshot) => snapshot.meta.health ?? { pulled: false, reason: "predates-health", asOf: null, dayWindow: null, parts: {} };
/**
 * Whether the snapshot holds template content (dimensions.templates[].content:
 * subject, body, the content-as-of date, the link-tracking reading; TPL-1),
 * and whether a PAGE may show it. A pull made with a knowledge base reads it
 * (pulled, content); one made without says so (reason "no-kb"); a page that
 * withholds the text keeps the performance rows and says the text is not on
 * the page (reason "templates-not-on-page", content false). A snapshot made
 * before template content existed carries no marker: a reader shows the reason
 * wherever the Templates tab would be, never an empty table.
 * @param {T10Snapshot} snapshot
 * @returns {{pulled: boolean, reason: ?string, content: boolean, source: ?string}}
 */
export const templateAvailability = (snapshot) => snapshot.meta.templates ?? { pulled: false, reason: "templates-not-pulled", content: false, source: null };
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
  "no-kb": "This is read from the knowledge base (schedules, step names, template content), and this pull ran without one.",
  "too-large": "This has more rows than the pull can read within its budget, so it was not read. Narrow the programs or the window, or pull again when the budget allows.",
  "all-time": "This figure is all time: the object it is read from carries no date on every row, so the date filter does not apply to it.",
  "not-filterable": "This tenant's object does not allow a filter on the reason field, so participant failures are counted per program with no breakdown by reason.",
  // What a dashboard PAGE does not carry, though the pull may hold it (DSH-2).
  "accounts-not-on-page": "Account detail is not part of this page.",
  "tab-off": "This tab is turned off for this page, so what it shows is not part of the page.",
  "no-internal-domain": "No internal email domain is named for this dashboard, so every recipient counts as external and there is nothing to leave out.",
  "test-accounts-need-accounts": "Accounts named as test accounts are not left out: this filter works by email domain, and the pull holds no account data to subtract them with.",
  "templates-not-pulled": "Template content is not in this snapshot: it was made before template content was read from the knowledge base. Pull again to get it.",
  "templates-not-on-page": "Template text (subjects and bodies) and the keyword search are not part of this page.",
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
 * The programs the global filters keep, and how many the status filter hides:
 * the ONE reading of the program filters, which runQuery and every view share.
 * @param {T10Snapshot} snapshot @param {EngagementFilters} f
 */
function keptPrograms(snapshot, f) {
  const programOk = (p) =>
    has(f.programs, p.id) && has(f.supergroups, p.supergroup) && has(f.groups, p.group) && has(f.models, p.model) && has(f.audiences, p.audienceType);
  const beforeStatus = snapshot.dimensions.programs.filter(programOk);
  const kept = beforeStatus.filter((p) => !f.statuses || p.statuses.some((s) => f.statuses.includes(s)));
  return { kept, keptIds: new Set(kept.map((p) => p.id)), hiddenByStatus: beforeStatus.length - kept.length };
}
const monthsKept = (snapshot, f) => (f.months ? snapshot.dimensions.months.filter((m) => f.months.includes(m)) : snapshot.dimensions.months);
const closedMonthsOf = (snapshot) => {
  const incomplete = String(snapshot.meta.incompleteFrom).slice(0, 7);
  return snapshot.dimensions.months.filter((m) => m < incomplete);
};

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
  const months = monthsKept(snapshot, f);
  const monthSet = new Set(months);
  const fullWindow = months.length === allMonths.length;
  const programById = new Map(dims.programs.map((p) => [p.id, p]));
  const { kept, keptIds, hiddenByStatus } = keptPrograms(snapshot, f);
  const scope = { months, fullWindow, programs: kept.length, programsHiddenByStatus: hiddenByStatus };
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
      // The subject (TPL-1): the template's current text as the knowledge base holds it; null when the snapshot has none.
      Object.assign(label, { stepName: use?.stepName ?? null, stepOrder: use?.stepOrder ?? null, stepCount: use?.stepCount ?? null, subject: templateById.get(k.template)?.content?.subject ?? null });
    }
    if ("step" in k) {
      const any = g.rows[0];
      const s = stepByKey.get(JSON.stringify([any.programId, any.stepId, any.variantId]));
      const sameStep = (dims.steps ?? []).find((x) => x.programId === any.programId && x.stepId === any.stepId);
      Object.assign(label, { step: (s ?? sameStep)?.name ?? null, stepOrder: (s ?? sameStep)?.order ?? null, template: templateById.get(any.templateId)?.name ?? null, templateId: any.templateId ?? null, subject: templateById.get(any.templateId)?.content?.subject ?? null });
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

// ── Health: per-program signals, and the lists derived from them (HLT-1) ────
// Redesigned 2026-10-07 (F-491; Bradley's ruling that day). "Stopped working"
// is four conditions, each read from ITS OWN data, never inferred from the
// schedule: (1) the schedule has ended, or its participant sync is disabled;
// (2) it runs but admits nobody; (3) the only participants arriving are refused
// for a reason that is NOT expected by design; (4) the program itself errors
// (a participant who got in falls off at a step). What the measured tenant
// records, and what it does not:
//   - the participant source's last sync time is the one heartbeat of an
//     ingest (facts.health.sources); the schedule's run-state fields are unset
//     even on programs that run daily, so no run result is ever read from them
//   - admissions are the participants created per day (facts.health.admissions)
//   - refusals are counted exactly per program and month
//     (facts.health.entryFailures) and split by reason from a per-program
//     SAMPLE of the most REPEATED ones still happening in the day window
//     (facts.health.failureSamples; F-484, redesigned 2026-10-08: the newest
//     page of the largest program held only its Send Email step's wordings and
//     hid the null-address wording that dominates it), because the reason
//     field takes no filter; the shipped expected list is the product's own
//     wordings (FAILURE_CATEGORIES.participantFailures), each with a KIND
//   - step failures are counted server-side by category per program and
//     month (facts.health.stepFailures); the platform's own error is a state
//   - sends are judged against the program's OWN history for every program: an
//     ingest cron says nothing about when a program sends (the starting rule
//     of 2026-10-04, read by Bradley at Y6: fewer than half the closed months
//     → late only past the longest gap; otherwise the flat threshold)
//   - a one-off program (no recurring schedule) with no participant still
//     moving is FINISHED, never late (Bradley, 2026-10-07: "if all the
//     participants have made it through the final step, or dropped")
// Each program gets every signal with a "cannot tell" state where its data was
// not read, and ONE list, the most urgent signal first.
export const SILENT_DAYS_DEFAULT = 30;
// Due days with no admission before an ingest that runs reads "admitting nobody"
// (a setup question, defaulted; Bradley 2026-10-07). Fewer due days in the window
// than this is "too few to judge", never an alarm.
export const QUIET_DUE_DAYS_DEFAULT = 5;
const ACTIVE_STATUS = "PROCESSING";
// Months of history before a program's own cadence can be read from it.
const HISTORY_MIN_MONTHS = 3;
// Participant states still moving through a program. REVIEW is a draft's
// (measured 2026-10-07: 135 never-published programs held all but 252 of a
// million REVIEW participants, and no Active program held one), so it is not.
export const IN_FLIGHT_STATES = Object.freeze(["ACTIVE", "PAUSED"]);
export const HEALTH_LISTS = deepFreeze({
  "schedule-ended": "Schedule ended",
  "sync-disabled": "Participant sync disabled",
  "ingest-overdue": "Participant sync overdue",
  "failing-entries": "Only refused participants arriving",
  "admitting-nobody": "Admitting nobody",
  "step-errors": "Step errors this period",
  "no-recent-sends": "No recent sends",
  finished: "Finished campaign",
  "no-sends-in-window": "Active, no sends in this window",
  // Why a program cannot be judged is in its signals (CANNOT_JUDGE_REASONS).
  "cannot-judge": "Cannot judge yet",
  ok: "Working as expected",
});
// Why a program lands on "Cannot judge yet" (signals.why): its ingest period is
// longer than the window (a longer --health-lookback-days reads it); the
// documented schedule ended before its source last synced, so the KB doc is
// behind the tenant (a refresh reads it); or it is NEW — fewer than
// HISTORY_MIN_MONTHS closed months of sends, all of them recent — so its own
// cadence cannot be read yet (F-491, 2026-10-08: a program two months old with
// one cohort behind it read "No recent sends" under the flat threshold).
export const CANNOT_JUDGE_REASONS = deepFreeze({
  "period-longer-than-window": "the ingest period is longer than the window",
  "doc-stale": "the documented schedule ended before the source's last sync",
  "too-new": "fewer than three months of sends, all recent",
  // F-491, redesigned 2026-10-08: a schedule the pull does not HAVE is never guessed. The KB is the one source of
  // schedules; a program it does not document (created after its last journey capture) or a pull made without a KB
  // leaves the schedule, the ingest and the finished signals undecided, and the snapshot names the programs.
  "no-doc": "the knowledge base has no doc for this program, so its schedule is unknown to this pull (refresh the KB for it)",
  "no-kb": "this pull ran without a knowledge base, so no program's schedule is known to it",
});
/** The lists table under the name S4b's plan reads it by. */
export const SILENT_LISTS = HEALTH_LISTS;
const ALARM_LISTS = Object.freeze(["schedule-ended", "sync-disabled", "ingest-overdue", "failing-entries", "admitting-nobody", "step-errors", "no-recent-sends"]);
// A stored category row's kind: its own (F-491, 2026-10-08; "unknown" included), else read off its expected flag (a
// snapshot made before kinds) — kindOf's one rule, never a second copy (F-501).
const rowKind = (r) => kindOf(r, { stored: true });
const monthEnd = (ym) => `${ym}-${String(daysInMonth(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)))).padStart(2, "0")}`;
const monthsApart = (a, b) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
// An epoch-millisecond time (what the describe payload carries) or an ISO text → its day; 0 and null are "none".
const dayOfTime = (t) => (typeof t === "number" && t > 0 ? dayText(Math.floor(t / 86400000)) : typeof t === "string" && /^\d{4}-\d\d-\d\d/.test(t) ? t.slice(0, 10) : null);
/**
 * The last `n` days a cron was due before `asOf` (newest first), never before
 * `floor`. Empty when the cron cannot be read.
 * @param {unknown} expr
 * @param {string} asOf YYYY-MM-DD
 * @param {number} n
 * @param {string} floor YYYY-MM-DD
 * @returns {string[]}
 */
export function dueDaysBefore(expr, asOf, n, floor) {
  const { readable, matches } = readCron(expr);
  if (!readable) return [];
  const out = [];
  for (let d = dayNumber(asOf) - 1; d >= dayNumber(floor) && out.length < n; d--) if (matches(dayText(d))) out.push(dayText(d));
  return out;
}
/**
 * The rules over plain inputs, so the adapter (which decides which programs
 * to sample) and every reader of a snapshot apply ONE rule. A null input part
 * means "not read": its signal says so and never alarms.
 * @param {{asOf: string, dayWindow: {start: string, endExclusive: string}, days: number, quietDueDays?: number, incompleteMonth: string, months: string[],
 *   programs: Array<{programId: string, name: ?string, statuses: string[], selected: boolean, lastSendDay: ?string, lastSendMonth: ?string,
 *     schedule: ?{classification: string, cronExpression: ?string, startTime?: ?number, endTime?: ?number, asOf?: ?string}, syncDisabled?: ?boolean,
 *     kbSource?: string, docModifiedAt?: ?string,
 *     sources: ?Array<{type: ?string, lastSyncedOn: ?string}>, admissionDays: ?Array<{day: string, participants: number}>,
 *     entryFailures: ?{window: {participants: number, occurrences: number}, recent?: ?number, sample: ?{rows: number, expected: number, unexpected: number, uncategorised: number, byKind?: Object<string, number>}},
 *     stepFailures: ?Array<{month: string, category: string, kind?: string, expected: boolean, participants: number}>, participants: ?number, inFlight: ?number,
 *     sentMonths: string[], templates: number}>}} input
 * @returns {Array<{programId: string, name: ?string, statuses: string[], selected: boolean, lastSendDay: ?string, lastSendMonth: ?string, daysSilent: ?number, list: string, label: string, signals: Object<string, *>}>}
 */
export function judgeHealth({ asOf, dayWindow, days, quietDueDays = QUIET_DUE_DAYS_DEFAULT, incompleteMonth, months, programs }) {
  const asOfN = dayNumber(asOf);
  const windowDays = dayNumber(dayWindow.endExclusive) - dayNumber(dayWindow.start);
  const closedMonths = months.filter((m) => m < incompleteMonth);
  // The period step failures are judged over: the current month and the one before it.
  const recentMonths = months.filter((m) => m <= incompleteMonth).slice(-2);
  const out = [];
  for (const p of programs) {
    if (!p.statuses.includes(ACTIVE_STATUS)) continue;
    const daysSilent = p.lastSendDay ? asOfN - dayNumber(p.lastSendDay) : null;
    // Days since the last send: exact inside the day window, else at least the days since that month ended.
    const daysSince = daysSilent ?? (p.lastSendMonth ? Math.max(windowDays, asOfN - dayNumber(monthEnd(p.lastSendMonth))) : null);
    const base = { programId: p.programId, name: p.name, statuses: p.statuses, selected: p.selected, lastSendDay: p.lastSendDay, lastSendMonth: p.lastSendMonth, daysSilent };

    // (1) The schedule, from the KB doc: recurring (with its cron, start and end), ended, not started, one-time, none;
    // "undocumented" when the KB has no doc for the program and "unknown" when the pull had no KB at all — states no
    // list decision may derive from (F-491, redesigned 2026-10-08: a missing input is never read as a one-off).
    const cls = p.schedule?.classification ?? null;
    // The doc is BEHIND the tenant when the program was modified after the doc was written: still judged by the doc
    // (a platform event can bump every program's modified date at once), but said so, and offered a narrow refresh.
    const docBehind = p.schedule != null && p.docModifiedAt != null && p.schedule.asOf != null && String(p.docModifiedAt) > String(p.schedule.asOf);
    const endDay = dayOfTime(p.schedule?.endTime);
    const startDay = dayOfTime(p.schedule?.startTime);
    const due = cls === "recurring" ? cronLastDue(p.schedule?.cronExpression, asOf) : null;
    // The ingest heartbeat: the newest sync among the program's active sources (read before the schedule is
    // judged, because a sync AFTER a documented end says the doc is behind the tenant, not that the schedule ended).
    const syncs = p.sources == null ? null : p.sources.map((s) => dayOfTime(s.lastSyncedOn)).filter(Boolean).sort();
    const lastSync = syncs?.length ? syncs[syncs.length - 1] : null;
    const ended = endDay != null && endDay < asOf;
    const schedule =
      p.syncDisabled === true ? { state: "disabled" }
        : cls === "recurring" ? (ended && lastSync != null && lastSync > endDay ? { state: "doc-stale", endDay, lastSync } : ended ? { state: "ended", endDay } : startDay && startDay > asOf ? { state: "not-started", startDay }
          : { state: "recurring", readable: due.readable, lastDue: due.lastDue, periodDays: due.periodDays, endDay })
          : cls === "one-time" ? { state: "one-time" } : cls == null ? (p.kbSource === "kb" ? { state: "undocumented" } : { state: "unknown" }) : { state: "none", classification: cls };
    if (docBehind) Object.assign(schedule, { docBehind: true, asOf: p.schedule.asOf, modifiedAt: p.docModifiedAt });

    // (1, continued) The heartbeat against the cron's last due day. A schedule the pull does not have decides nothing.
    let ingest;
    if (p.sources == null) ingest = { state: "not-read" };
    else if (schedule.state === "undocumented") ingest = { state: "cannot-judge", why: "no-doc", lastSync };
    else if (schedule.state === "unknown") ingest = { state: "cannot-judge", why: "no-kb", lastSync };
    else if (schedule.state === "disabled" || schedule.state === "ended" || schedule.state === "not-started") ingest = { state: "stopped", lastSync };
    else if (schedule.state === "doc-stale") ingest = { state: "cannot-judge", why: "doc-stale", lastSync, endDay };
    else if (schedule.state === "recurring") {
      if (!due.readable || due.lastDue == null) ingest = { state: "cadence-unreadable", lastSync };
      else if (due.periodDays == null || due.periodDays > windowDays || due.lastDue < dayWindow.start) ingest = { state: "cannot-judge", why: "period-longer-than-window", lastSync, lastDue: due.lastDue, periodDays: due.periodDays, windowDays };
      else if (lastSync == null) ingest = { state: "never-synced", lastDue: due.lastDue };
      else if (lastSync >= due.lastDue) ingest = { state: "on-schedule", lastSync, lastDue: due.lastDue };
      else ingest = { state: "overdue", lastSync, lastDue: due.lastDue, daysOverdue: asOfN - dayNumber(due.lastDue) };
    } else ingest = lastSync ? { state: "one-time", lastSync } : { state: "never-synced" };

    // (2) Admissions: participants created over the last N due days of a recurring ingest; over the whole day window otherwise.
    let admissions;
    const admitted = (since) => (p.admissionDays ?? []).filter((a) => since == null || a.day >= since).reduce((s, a) => s + (a.participants ?? 0), 0);
    const lastAdmissionDay = (p.admissionDays ?? []).map((a) => a.day).sort().pop() ?? null;
    if (p.admissionDays == null) admissions = { state: "not-read" };
    else if (schedule.state === "recurring" && schedule.readable && due.lastDue != null) {
      const dueDays = dueDaysBefore(p.schedule.cronExpression, asOf, quietDueDays, dayWindow.start);
      const since = dueDays[dueDays.length - 1] ?? null;
      const n = since == null ? 0 : admitted(since);
      admissions = dueDays.length < quietDueDays ? { state: "too-few-due-days", dueDays: dueDays.length, quietDueDays, admitted: n, lastAdmissionDay }
        : { state: n > 0 ? "admitting" : "none", since, dueDays: dueDays.length, quietDueDays, admitted: n, lastAdmissionDay };
    } else admissions = { state: admitted(null) > 0 ? "admitting" : "none-in-window", admitted: admitted(null), lastAdmissionDay };

    // (3) Refusals at entry: the exact count over the window, the count still happening in the day window
    // (null on a snapshot that did not store it), and the sampled split by kind.
    const ef = p.entryFailures;
    const entry = ef == null ? { state: "not-read" }
      : !(ef.window?.participants > 0) ? { state: "none" }
        : ef.recent === 0 ? { state: "none-recent", participants: ef.window.participants, occurrences: ef.window.occurrences, recent: 0 }
          : ef.sample == null ? { state: "unsampled", participants: ef.window.participants, occurrences: ef.window.occurrences, recent: ef.recent ?? null }
            : { state: ef.sample.unexpected > 0 ? "unexpected" : "expected-only", participants: ef.window.participants, occurrences: ef.window.occurrences, recent: ef.recent ?? null, sample: ef.sample };

    // (4) Step failures this period, by KIND: a program error (a step that cannot run, the platform's own error) is
    // an error, and so is a wording the shipped list does not know (kind unknown: the most actionable state, never
    // folded into a known one; F-484 2026-10-08); a bad address and a business rule are the program doing as told.
    const sf = p.stepFailures;
    let steps;
    if (sf == null) steps = { state: "not-read" };
    else {
      const recent = sf.filter((r) => recentMonths.includes(r.month) && r.participants > 0);
      const bad = recent.filter((r) => ["program-error", UNKNOWN_KIND].includes(rowKind(r)));
      const byCategory = {};
      for (const r of bad) byCategory[r.category] = (byCategory[r.category] ?? 0) + r.participants;
      const byKind = {};
      for (const r of recent) byKind[rowKind(r)] = (byKind[rowKind(r)] ?? 0) + r.participants;
      const unclassified = bad.filter((r) => rowKind(r) === UNKNOWN_KIND).reduce((s, r) => s + r.participants, 0);
      steps = bad.length ? { state: "errors", months: recentMonths, participants: bad.reduce((s, r) => s + r.participants, 0), unclassified, byCategory, byKind } : { state: "none", months: recentMonths, byKind };
    }

    // Sends, against the program's own history (every program). A NEW program — fewer than HISTORY_MIN_MONTHS
    // closed months of sends, every one of them recent — has no history to judge by yet; a program with as few
    // months of sends that are NOT recent (sent twice, a year ago) is judged by the flat threshold.
    const sentMonths = [...new Set(p.sentMonths ?? [])].sort();
    const sentClosed = sentMonths.filter((m) => closedMonths.includes(m));
    const rare = sentClosed.length >= HISTORY_MIN_MONTHS && sentClosed.length * 2 < closedMonths.length;
    const recentMonthsForHistory = [...closedMonths.slice(-HISTORY_MIN_MONTHS), incompleteMonth];
    const isNew = sentClosed.length < HISTORY_MIN_MONTHS && sentMonths.length > 0 && sentMonths.every((m) => recentMonthsForHistory.includes(m));
    let sends;
    if (!p.selected) sends = { state: "none-in-window", windowMonths: months.length };
    else if (isNew) sends = { state: "no-history", rule: "none", monthsWithSends: sentClosed.length, firstSendMonth: sentMonths[0], daysSince, historyMinMonths: HISTORY_MIN_MONTHS };
    else if (!rare) sends = { state: daysSince == null || daysSince >= days ? "late" : "ok", rule: sentClosed.length < HISTORY_MIN_MONTHS ? "flat" : "history", threshold: days, daysSince, monthsWithSends: sentClosed.length, closedMonths: closedMonths.length, usual: "most months" };
    else {
      const gaps = sentClosed.slice(1).map((m, i) => monthsApart(sentClosed[i], m));
      const longestGapMonths = Math.max(...gaps);
      const allowedDays = longestGapMonths * 31;
      sends = { state: daysSince == null || daysSince > allowedDays ? "late" : "ok", rule: "history", monthsWithSends: sentClosed.length, closedMonths: closedMonths.length, longestGapMonths, allowedDays, daysSince };
    }
    // A DOCUMENTED one-off (nothing recurring, not stopped) whose participants have all finished or dropped is a
    // finished campaign. A program whose schedule the pull does not have is never a one-off by default (F-491).
    const oneOff = ["one-time", "none"].includes(schedule.state);
    const finished = oneOff && p.inFlight === 0 && (p.participants ?? 0) > 0;
    // What would stop a judgment (CANNOT_JUDGE_REASONS), if nothing more urgent decides the list first; a program
    // that lands on another list carries no why (F-498: a finished one-off two months old is judged, not too new).
    const why = ingest.state === "cannot-judge" ? ingest.why : sends.state === "no-history" ? "too-new" : null;

    // ONE list per program, the most urgent signal first. A program whose schedule the pull does not have (no doc,
    // no KB) is judged on its own data for the alarms above the line (its steps, its sends in the window) and is
    // otherwise Cannot judge yet BEFORE its send history is read as late: whether a quiet program is a finished
    // one-off or a stalled recurring one is exactly what the schedule tells apart (F-491, redesigned 2026-10-08).
    const noSchedule = ["no-doc", "no-kb"].includes(why);
    const list =
      !p.selected ? "no-sends-in-window"
        : schedule.state === "ended" ? "schedule-ended"
          : schedule.state === "disabled" ? "sync-disabled"
            : ingest.state === "overdue" || (ingest.state === "never-synced" && schedule.state === "recurring") ? "ingest-overdue"
              : admissions.state === "none" && entry.state === "unexpected" ? "failing-entries"
                : admissions.state === "none" ? "admitting-nobody"
                  : steps.state === "errors" ? "step-errors"
                    : finished ? "finished"
                      : noSchedule ? "cannot-judge"
                        : sends.state === "late" ? "no-recent-sends"
                          : why != null ? "cannot-judge"
                            : "ok";
    const signals = { schedule, ingest, admissions, entry, steps, sends, finished: p.inFlight == null ? null : finished, why: list === "cannot-judge" ? why : null, templates: p.templates ?? 0, monthsSent: sentMonths.length };
    out.push({ ...base, list, label: HEALTH_LISTS[list], signals });
  }
  return out;
}
/**
 * Every Active program's health signals and list, over a snapshot (the
 * reader's rule). `rows` is the alarm list, longest silent first; `lists`
 * holds every judged program by list id, the alarms included. The thresholds
 * are the reader's: `days` (the flat send threshold) and `quietDueDays` (the
 * due days with no admission before "admitting nobody"; the pull's own setting
 * when it recorded one).
 * @param {T10Snapshot} snapshot
 * @param {{days?: number, quietDueDays?: number}} [opts]
 * @returns {{unavailable: ?{reason: string}, asOf: ?string, days: number, quietDueDays: number, windowDays: ?number, rows: Array<*>, lists: Object<string, Array<*>>}}
 */
export function programHealth(snapshot, { days = SILENT_DAYS_DEFAULT, quietDueDays = snapshot.meta?.params?.health?.quietDueDays ?? QUIET_DUE_DAYS_DEFAULT } = {}) {
  const h = healthAvailability(snapshot);
  const part = h.parts.lastSends;
  const lists = () => Object.fromEntries(Object.keys(HEALTH_LISTS).map((k) => [k, []]));
  if (!h.pulled || !part?.pulled || !h.asOf || !h.dayWindow) return { unavailable: { reason: (!h.pulled ? h.reason : part?.reason) ?? "not-pulled" }, asOf: h.asOf, days, quietDueDays, windowDays: null, rows: [], lists: lists() };
  const windowDays = dayNumber(h.dayWindow.endExclusive) - dayNumber(h.dayWindow.start);
  if (!Number.isInteger(days) || days < 1 || days > windowDays)
    throw new Error(`engagement query: silent-program days must be a whole number from 1 to ${windowDays}, the days of sends this snapshot holds by day (got ${days})`);
  if (!Number.isInteger(quietDueDays) || quietDueDays < 1) throw new Error(`engagement query: quiet due days must be a whole number >= 1 (got ${quietDueDays})`);
  const H = /** @type {any} */ (snapshot.facts.health ?? {});
  const read = (name) => (h.parts[name]?.pulled ? H[name] ?? [] : null);
  const byProgram = (rows) => {
    if (rows == null) return null;
    const m = new Map();
    for (const r of rows) m.set(r.programId, [...(m.get(r.programId) ?? []), r]);
    return m;
  };
  const program = new Map(snapshot.dimensions.programs.map((p) => [p.id, p]));
  // Whether this pull had a KB at all (honesty.kb, F-491; the step-names source on a snapshot made before it).
  const kbSource = snapshot.honesty?.kb?.source ?? snapshot.honesty?.stepNames?.source ?? "none";
  const sources = byProgram(read("sources"));
  const admissions = byProgram(read("admissions"));
  const entryRows = byProgram(read("entryFailures"));
  const stepRows = byProgram(read("stepFailures"));
  const states = byProgram(read("participantStates"));
  // The refusal sample's split by category: the categorised sample table (entrySamples, which a page carries) first, the
  // text sample table (failureSamples; terminal only, emptied on a page) on a snapshot made before entrySamples existed.
  const samples = byProgram(read("failureSamples"));
  const entrySamples = byProgram(read("entrySamples"));
  const notSampled = new Set((h.samples?.participantFailures?.notSampled ?? []).map((x) => x.programId));
  // The refusals still happening in the day window, per program (F-484: the count the samples are picked from,
  // stored with its window); null on a snapshot that stored none or stored another window's.
  const sampleMeta = h.samples?.participantFailures;
  const recentCounts = sampleMeta?.counts && sampleMeta.window?.start === h.dayWindow.start && sampleMeta.window?.endExclusive === h.dayWindow.endExclusive ? sampleMeta.counts : null;
  const inWindow = new Set(snapshot.dimensions.months);
  const sentMonths = new Map();
  for (const r of snapshot.facts.byTemplate) {
    if (!sentMonths.has(r.programId)) sentMonths.set(r.programId, new Set());
    if (r.sent > 0) sentMonths.get(r.programId).add(r.month);
  }
  const templates = new Map();
  for (const t of snapshot.dimensions.templates) for (const u of t.uses) templates.set(u.programId, (templates.get(u.programId) ?? 0) + 1);
  const judged = judgeHealth({
    asOf: h.asOf, dayWindow: h.dayWindow, days, quietDueDays, incompleteMonth: String(snapshot.meta.incompleteFrom).slice(0, 7), months: snapshot.dimensions.months,
    programs: /** @type {any[]} */ (H.lastSends ?? []).map((r) => {
      const p = program.get(r.programId);
      const entries = entryRows?.get(r.programId)?.filter((x) => inWindow.has(x.month)) ?? null;
      const window = entries ? entries.reduce((s, x) => ({ participants: s.participants + x.participants, occurrences: s.occurrences + x.occurrences }), { participants: 0, occurrences: 0 }) : null;
      const sampleRows = entrySamples ? entrySamples.get(r.programId) ?? [] : (samples?.get(r.programId) ?? []).filter((x) => x.part === "participantFailures");
      // The split by KIND: a business rule is expected; a bad address, a program error and an UNCLASSIFIED wording
      // (kind unknown, F-484 2026-10-08) are not; the unclassified are counted apart as well, so a list row can say
      // the cause needs investigation. A row stored before kinds (category null) reads unclassified too.
      const sample = (entrySamples ?? samples) == null || !sampleRows.length || notSampled.has(r.programId) ? null : sampleRows.reduce((s, x) => {
        const n = x.participants ?? x.count ?? 1;
        const kind = x.category == null || x.category === OTHER_CATEGORY || x.category === UNCLASSIFIED_CATEGORY ? UNKNOWN_KIND : rowKind(x);
        s.byKind[kind] = (s.byKind[kind] ?? 0) + n;
        return { ...s, rows: s.rows + n, expected: s.expected + (kind === "business-rule" ? n : 0), unexpected: s.unexpected + (kind !== "business-rule" ? n : 0), unclassified: s.unclassified + (kind === UNKNOWN_KIND ? n : 0) };
      }, { rows: 0, expected: 0, unexpected: 0, unclassified: 0, byKind: {} });
      const st = states?.get(r.programId) ?? null;
      return {
        ...r,
        schedule: p?.schedule ?? null, syncDisabled: p?.syncScheduleDisabled ?? null,
        // Whether the pull had a KB (an undocumented program is told apart from a pull without one), and when the
        // list said the program was last modified (a doc older than that is behind the tenant); F-491.
        kbSource: kbSource, docModifiedAt: p?.modifiedAt ?? null,
        sources: sources == null ? null : sources.get(r.programId) ?? [],
        admissionDays: admissions == null ? null : admissions.get(r.programId) ?? [],
        entryFailures: entryRows == null ? null : { window, recent: recentCounts ? recentCounts[r.programId] ?? 0 : null, sample },
        stepFailures: stepRows == null ? null : stepRows.get(r.programId) ?? [],
        participants: st == null ? null : st.reduce((s, x) => s + x.participants, 0),
        inFlight: st == null ? null : st.filter((x) => IN_FLIGHT_STATES.includes(x.state)).reduce((s, x) => s + x.participants, 0),
        sentMonths: [...(sentMonths.get(r.programId) ?? [])], templates: templates.get(r.programId) ?? 0,
      };
    }),
  });
  const order = (a, b) => (a.daysSilent == null ? (b.daysSilent == null ? 0 : -1) : b.daysSilent == null ? 1 : b.daysSilent - a.daysSilent) || cmp(a.programId, b.programId);
  const byList = lists();
  for (const r of judged) byList[r.list].push(r);
  for (const k of Object.keys(byList)) byList[k].sort(order);
  const rows = judged.filter((r) => ALARM_LISTS.includes(r.list)).sort(order);
  return { unavailable: null, asOf: h.asOf, days, quietDueDays, windowDays, rows, lists: byList };
}
/** programHealth under the name S4b's plan reads it by. */
export const silentPrograms = programHealth;

// ── Views beyond a table (DSH-4) ─────────────────────────────────────────────
// Every figure a dashboard page draws is computed HERE: the page lays out what
// comes back and never adds, divides or counts a fact row itself (house rule
// 11). One function per view kind, each over the same global filters runQuery
// takes. What a filter cannot narrow says so in the result: a health signal is
// judged over the pull's own day window (monthsIgnored), an all-time total
// carries its basis.
// The usual (a KPI's and a category's "change against the usual"): the same
// figure over the window's CLOSED months, per month for a count, as itself for
// a rate. The current month is never in it (opens keep arriving).
/**
 * Headline figures (a kpi panel): each metric over everything the filters
 * keep, the usual beside it and the change against it, and for a rate the
 * denominator's count as send-size context (R2b). "Since last pull" is null
 * until a refresh carries a delta (PUB-1); the page says so.
 * @param {T10Snapshot} snapshot
 * @param {EngagementFilters} filters
 * @param {{metrics: string[]}} query
 * @returns {{tiles: Array<{id: string, label: string, cell: EngagementCell, usual: ?{value: number, perMonth: boolean, closedMonths: number}, change: ?{kind: "points"|"ratio", value: ?number}, denominator: ?{id: string, label: string, cell: EngagementCell}, sinceLastPull: null}>, scope: *, incomplete: boolean, carried: boolean, previousPulledAt: ?string}}
 */
export function kpiView(snapshot, filters, query) {
  const f = filters ?? {};
  const now = runQuery(snapshot, f, { groupBy: [], metrics: query.metrics });
  const closed = closedMonthsOf(snapshot);
  const usualRun = closed.length ? runQuery(snapshot, { ...f, months: closed }, { groupBy: [], metrics: query.metrics }) : null;
  const dens = [...new Set(query.metrics.map((id) => metric(id).denominator).filter(Boolean))];
  const context = dens.length ? runQuery(snapshot, f, { groupBy: [], metrics: dens }).total.cells : {};
  const months = now.scope.months.length;
  const tiles = query.metrics.map((id) => {
    const def = metric(id);
    const cell = now.total.cells[id];
    const rate = isRate(def);
    const u = usualRun?.total.cells[id] ?? null;
    const usual = u && u.value != null ? { value: rate ? u.value : u.value / closed.length, perMonth: !rate, closedMonths: closed.length } : null;
    let change = null;
    if (usual && cell.value != null) change = rate ? { kind: "points", value: (cell.value - usual.value) * 100 } : { kind: "ratio", value: usual.value && months ? cell.value / months / usual.value : null };
    const den = def.denominator ? { id: def.denominator, label: metric(def.denominator).label, cell: context[def.denominator] } : null;
    return { id, label: def.label, cell, usual, change, denominator: den, sinceLastPull: null };
  });
  return { tiles, scope: now.scope, incomplete: now.total.incomplete, carried: now.total.carried, previousPulledAt: snapshot.meta.refresh?.previousPulledAt ?? null };
}

/**
 * The health tables as a PAGE may carry them (aggregates only; ruled
 * 2026-10-05): the categorised rows and the counted remainders, never a
 * distinct message and never the samples. A row read as text (category null:
 * a snapshot made before categories, or a reason the pull could not count by
 * category) folds into the per-key "other" row with its count added; the
 * sample table is emptied. Every count a reader computes is the same over the
 * folded tables. Returns a NEW object; the snapshot is not touched.
 * @param {*} health facts.health
 */
export function healthForPage(health) {
  if (!health || typeof health !== "object") return health;
  const out = { ...health };
  const isText = (r) => r.category == null || r.category === OTHER_CATEGORY;
  const fold = (rows, keyOf, add) => {
    const keep = [];
    const folded = new Map();
    for (const r of rows) {
      if (!isText(r)) { keep.push(r); continue; }
      const k = keyOf(r);
      const row = folded.get(k);
      if (row) add(row, r);
      else folded.set(k, { ...r, message: null, category: OTHER_CATEGORY });
    }
    return [...keep, ...folded.values()];
  };
  if (Array.isArray(health.bounceReasons)) out.bounceReasons = fold(health.bounceReasons, (r) => JSON.stringify([r.programId, r.templateId ?? null, r.month, r.recipientClass, r.bounceType ?? null, r.provenance, r.pulledAt]), (a, r) => { a.count += r.count; });
  if (Array.isArray(health.participantFailures)) out.participantFailures = fold(health.participantFailures, (r) => r.programId, (a, r) => { a.participants += r.participants; a.occurrences += r.occurrences; });
  if ("failureSamples" in health) out.failureSamples = [];
  return out;
}

// Uncategorised failures over this share of the total are a SIGNAL the page states (ruled 2026-10-05: "a few percent").
export const OTHER_SHARE_FLAG = 0.05;
// The label of the schedule audit for a documented program with no schedule (engagement.mjs NO_SCHEDULE; spelled here
// because this module imports nothing).
const NO_SCHEDULE_CLASSIFICATION = "no schedule captured";
const UNCLASSIFIED_NAMED = Object.freeze({ label: "Unclassified wording", definition: "A wording no category knows: treated as a failure needing investigation, never as a business rule or a known error.", kind: UNKNOWN_KIND });
const OTHER_NAMED = Object.freeze({ label: "Other", definition: "Text no category of this dashboard's list matches: the counted remainder.", kind: UNKNOWN_KIND });
/** The category table a snapshot was counted with: the pull's echo (the tenant's list included) first, then the shipped list. */
const categoryLookup = (snapshot, part, shipped) => {
  const byId = new Map();
  for (const c of [...(snapshot.meta.params?.health?.categories?.[part] ?? []), ...shipped]) if (c && typeof c.id === "string" && !byId.has(c.id)) byId.set(c.id, c);
  return byId;
};
const namedCategory = (id, table, fallback) => {
  const c = table.get(id);
  const kind = c ? (FAILURE_KINDS.includes(c.kind) ? c.kind : kindOf(c)) : fallback.kind;
  return { id, label: c?.label ?? fallback.label, definition: c?.definition ?? fallback.definition, kind, expected: isExpectedKind(kind) };
};
const sumBy = (rows, field) => rows.reduce((s, r) => s + (r[field] ?? 0), 0);
/**
 * Why sends and participants fail (a health-reasons panel): bounce reasons by
 * category over the months and recipients kept, each beside its usual and the
 * change against it, with the "Other" remainder and whether it is over the
 * share worth stating; refusals at entry (the exact totals over the months
 * kept and all time, and the split by category: exact where the pull counted
 * by category, else the SAMPLE, labelled); step failures by category over the
 * months kept. Every category carries its definition (never tenant text) and
 * its kind; `expected` is a business rule working, which a page shows behind a
 * toggle. A part the pull did not read says so.
 * @param {T10Snapshot} snapshot
 * @param {EngagementFilters} filters
 * @param {{otherShareFlag?: number}} [opts]
 */
export function healthReasonsView(snapshot, filters, { otherShareFlag = OTHER_SHARE_FLAG } = {}) {
  const f = filters ?? {};
  const h = healthAvailability(snapshot);
  if (!h.pulled) return { unavailable: { reason: h.reason ?? "not-pulled" }, asOf: null, bounces: null, entry: null, steps: null, recipientClass: f.recipientClass ?? "all" };
  const { keptIds } = keptPrograms(snapshot, f);
  const months = monthsKept(snapshot, f);
  const monthSet = new Set(months);
  const closed = closedMonthsOf(snapshot);
  const cls = f.recipientClass ?? "all";
  const H = /** @type {any} */ (snapshot.facts.health ?? {});
  const part = (name) => (h.parts[name]?.pulled ? { rows: H[name] ?? [], unavailable: null, basis: h.parts[name].basis ?? null } : { rows: null, unavailable: { reason: h.parts[name]?.reason ?? "not-pulled" }, basis: null });
  const remainder = (id) => id == null || id === OTHER_CATEGORY;
  const byCategory = (rows, idOf, measures, table, fallbackForText) => {
    const out = new Map();
    for (const r of rows) {
      const id = idOf(r);
      if (!out.has(id)) out.set(id, { ...namedCategory(id, table, id === UNCLASSIFIED_CATEGORY ? UNCLASSIFIED_NAMED : fallbackForText), ...Object.fromEntries(measures.map((m) => [m, 0])) });
      for (const m of measures) out.get(id)[m] += r[m] ?? 0;
    }
    return [...out.values()].sort((a, b) => cmp(a.label.toLowerCase(), b.label.toLowerCase()) || cmp(a.id, b.id));
  };

  // Bounces: by category, this period against the usual.
  let bounces;
  {
    const p = part("bounceReasons");
    if (p.rows == null) bounces = { unavailable: p.unavailable, basis: null, total: 0, months: months.length, closedMonths: closed.length, categories: [], other: null };
    else {
      const table = categoryLookup(snapshot, "bounceReasons", FAILURE_CATEGORIES.bounceReasons);
      const inScope = p.rows.filter((r) => keptIds.has(r.programId) && (cls === "all" || r.recipientClass === cls));
      const period = inScope.filter((r) => monthSet.has(r.month));
      const closedRows = inScope.filter((r) => closed.includes(r.month));
      const idOf = (r) => (remainder(r.category) ? OTHER_CATEGORY : r.category);
      const sumOf = (rows, id) => sumBy(rows.filter((r) => idOf(r) === id), "count");
      const withUsual = (c) => {
        const usual = closed.length ? sumOf(closedRows, c.id) / closed.length : null;
        return { ...c, usualPerMonth: usual, change: usual && months.length ? c.count / months.length / usual : null };
      };
      const ids = [...new Set(inScope.map(idOf))];
      const named = ids.filter((id) => id !== OTHER_CATEGORY).map((id) => withUsual({ ...namedCategory(id, table, OTHER_NAMED), count: sumOf(period, id) })).sort((a, b) => b.count - a.count || cmp(a.label, b.label));
      const total = sumBy(period, "count");
      const other = withUsual({ id: OTHER_CATEGORY, ...OTHER_NAMED, expected: false, count: sumOf(period, OTHER_CATEGORY) });
      bounces = { unavailable: null, basis: p.basis, total, months: months.length, closedMonths: closed.length, categories: named, other: { ...other, share: total ? other.count / total : null, overThreshold: total > 0 && other.count / total > otherShareFlag } };
    }
  }
  // Refusals at entry: exact totals, and the split by category, exact or a sample.
  let entry;
  {
    const windowPart = part("entryFailures");
    const allPart = part("participantFailures");
    const samplePart = part("entrySamples");
    const table = categoryLookup(snapshot, "participantFailures", FAILURE_CATEGORIES.participantFailures);
    const totals = (rows) => ({ participants: sumBy(rows, "participants"), occurrences: sumBy(rows, "occurrences") });
    const window = windowPart.rows == null ? null : totals(windowPart.rows.filter((r) => keptIds.has(r.programId) && monthSet.has(r.month)));
    const allRows = allPart.rows == null ? null : allPart.rows.filter((r) => keptIds.has(r.programId));
    const counted = !!h.categories?.participantFailures?.counted;
    let split = null;
    if (counted && allRows) split = { exact: true, basis: "all-time", rows: byCategory(allRows.filter((r) => !remainder(r.category)), (r) => r.category, ["participants", "occurrences"], table, OTHER_NAMED), other: totals(allRows.filter((r) => remainder(r.category))) };
    else if (samplePart.rows != null) {
      const sampled = samplePart.rows.filter((r) => keptIds.has(r.programId));
      split = { exact: false, basis: "sample", rows: byCategory(sampled, (r) => (remainder(r.category) ? UNCLASSIFIED_CATEGORY : r.category), ["participants", "occurrences"], table, UNCLASSIFIED_NAMED), programsSampled: new Set(sampled.map((r) => r.programId)).size, other: null };
    }
    entry = {
      unavailable: window == null && allRows == null ? allPart.unavailable ?? windowPart.unavailable : null,
      window, windowMonths: months.length, allTime: allRows == null ? null : totals(allRows), allTimeBasis: allPart.basis,
      counted, split, splitUnavailable: split ? null : samplePart.unavailable ?? allPart.unavailable,
    };
  }
  // Step failures this period, by category.
  let steps;
  {
    const p = part("stepFailures");
    if (p.rows == null) steps = { unavailable: p.unavailable, basis: null, months: months.length, categories: [] };
    else {
      const table = new Map(STEP_FAILURE_CATEGORIES.map((c) => [c.id, c]));
      const rows = p.rows.filter((r) => keptIds.has(r.programId) && monthSet.has(r.month) && r.participants > 0);
      steps = { unavailable: null, basis: p.basis, months: months.length, categories: byCategory(rows, (r) => (remainder(r.category) ? UNCLASSIFIED_CATEGORY : r.category), ["participants"], table, UNCLASSIFIED_NAMED).sort((a, b) => b.participants - a.participants || cmp(a.label, b.label)) };
    }
  }
  return { unavailable: null, asOf: h.asOf, bounces, entry, steps, recipientClass: cls };
}

/**
 * Program health (a health-silent panel): programHealth's lists narrowed to
 * the programs the filters keep. A program the pull judged that the snapshot's
 * program table does not list (an Active program with no send in the pull)
 * passes every filter but the status one. The date filter does not apply: a
 * signal is judged over the pull's own day window, and the result says so.
 * @param {T10Snapshot} snapshot
 * @param {EngagementFilters} filters
 * @param {{days?: number, quietDueDays?: number}} [opts]
 */
export function healthSilentView(snapshot, filters, opts = {}) {
  const f = filters ?? {};
  const base = programHealth(snapshot, opts);
  const common = { labels: HEALTH_LISTS, alarmLists: ALARM_LISTS, cannotJudgeReasons: CANNOT_JUDGE_REASONS, monthsIgnored: !!f.months };
  if (base.unavailable) return { ...base, counts: Object.fromEntries(Object.keys(HEALTH_LISTS).map((k) => [k, 0])), ...common };
  const { keptIds } = keptPrograms(snapshot, f);
  const known = new Set(snapshot.dimensions.programs.map((p) => p.id));
  const programFilters = !!(f.programs || f.supergroups || f.groups || f.models || f.audiences);
  const keep = (r) => (known.has(r.programId) ? keptIds.has(r.programId) : !programFilters && (!f.statuses || r.statuses.some((s) => f.statuses.includes(s))));
  const lists = Object.fromEntries(Object.entries(base.lists).map(([k, rows]) => [k, rows.filter(keep)]));
  return { ...base, rows: base.rows.filter(keep), lists, counts: Object.fromEntries(Object.entries(lists).map(([k, v]) => [k, v.length])), ...common };
}

/**
 * Schedules (a health-schedules panel): each kept program's schedule as the
 * knowledge base documents it, with the day it is as of and whether that day
 * is older than the dashboard's staleness threshold counted back from the
 * pull; a program with no KB doc is a row that says so.
 * @param {T10Snapshot} snapshot
 * @param {EngagementFilters} filters
 * @param {{staleAfterDays: number}} opts
 */
export function healthSchedulesView(snapshot, filters, { staleAfterDays }) {
  const f = filters ?? {};
  const h = healthAvailability(snapshot);
  const part = h.parts.schedules;
  if (!h.pulled || !part?.pulled) return { unavailable: { reason: (!h.pulled ? h.reason : part?.reason) ?? "not-pulled" }, rows: [], staleAfterDays, cutoff: null, pulledDay: null, undocumented: 0 };
  if (!Number.isInteger(staleAfterDays) || staleAfterDays < 1) throw new Error(`engagement query: stale-after days must be a whole number >= 1 (got ${staleAfterDays})`);
  const { kept } = keptPrograms(snapshot, f);
  const pulledDay = String(snapshot.meta.pulledAt).slice(0, 10);
  const cutoff = dayText(dayNumber(pulledDay) - staleAfterDays);
  const byProgram = new Map();
  for (const r of /** @type {any[]} */ (snapshot.facts.health?.schedules ?? [])) byProgram.set(r.programId, [...(byProgram.get(r.programId) ?? []), r]);
  const rows = [];
  for (const p of kept) {
    const base = { programId: p.id, name: p.name, statuses: p.statuses, syncDisabled: p.syncScheduleDisabled ?? null };
    const own = byProgram.get(p.id) ?? [];
    if (!own.length) { rows.push({ ...base, documented: false, classification: null, cronExpression: null, timeZoneName: null, startDay: null, endDay: null, asOf: null, stale: null, source: null }); continue; }
    for (const s of own) {
      const asOf = dayOfTime(s.asOf);
      rows.push({ ...base, documented: true, classification: s.classification, cronExpression: s.cronExpression ?? null, timeZoneName: s.timeZoneName ?? null, startDay: dayOfTime(s.startTime), endDay: dayOfTime(s.endTime), asOf, stale: asOf == null ? null : asOf < cutoff, source: s.source ?? "kb" });
    }
  }
  rows.sort((a, b) => cmp(String(a.name ?? a.programId).toLowerCase(), String(b.name ?? b.programId).toLowerCase()) || cmp(a.programId, b.programId));
  return { unavailable: null, rows, staleAfterDays, cutoff, pulledDay, undocumented: rows.filter((r) => !r.documented).length, stale: rows.filter((r) => r.stale).length };
}

/**
 * One-time and ad-hoc programs (a health-one-time panel): the kept programs
 * whose documented schedule does not recur, each with its last send, the
 * months it sent in, its templates and its sends over the last `months`
 * months (never "finished": a one-off can be reused). Read from the program
 * dimension's schedule, which rides every pull made with a KB; a program whose
 * schedule the pull does not have is counted, never listed as a one-off.
 * @param {T10Snapshot} snapshot
 * @param {EngagementFilters} filters
 * @param {{months: number}} opts
 */
export function healthOneTimeView(snapshot, filters, { months: n }) {
  const f = filters ?? {};
  if (!Number.isInteger(n) || n < 1) throw new Error(`engagement query: one-time history months must be a whole number >= 1 (got ${n})`);
  const { kept } = keptPrograms(snapshot, f);
  const cls = f.recipientClass ?? "all";
  const allMonths = snapshot.dimensions.months;
  const history = allMonths.slice(-Math.min(n, allMonths.length));
  const h = healthAvailability(snapshot);
  const lastSends = h.pulled && h.parts.lastSends?.pulled ? new Map(/** @type {any[]} */ (snapshot.facts.health?.lastSends ?? []).map((r) => [r.programId, r])) : null;
  const templates = new Map();
  for (const t of snapshot.dimensions.templates) for (const u of t.uses) templates.set(u.programId, (templates.get(u.programId) ?? 0) + 1);
  const sentByMonth = new Map();
  for (const r of snapshot.facts.byTemplate) {
    if (cls !== "all" && r.recipientClass !== cls) continue;
    const m = sentByMonth.get(r.programId) ?? new Map();
    m.set(r.month, (m.get(r.month) ?? 0) + r.sent);
    sentByMonth.set(r.programId, m);
  }
  const rows = [];
  let scheduleUnknown = 0;
  for (const p of kept) {
    const c = p.schedule?.classification ?? null;
    if (c == null) { scheduleUnknown++; continue; }
    if (c !== "one-time" && c !== NO_SCHEDULE_CLASSIFICATION) continue;
    const m = sentByMonth.get(p.id) ?? new Map();
    const monthsWithSends = [...m].filter(([, v]) => v > 0).map(([k]) => k).sort();
    const ls = lastSends?.get(p.id) ?? null;
    rows.push({
      programId: p.id, name: p.name, statuses: p.statuses, classification: c,
      lastSendDay: ls?.lastSendDay ?? null, lastSendMonth: ls ? ls.lastSendMonth : monthsWithSends[monthsWithSends.length - 1] ?? null,
      monthsWithSends: monthsWithSends.length, templates: templates.get(p.id) ?? 0, history: history.map((month) => ({ month, sent: m.get(month) ?? 0 })),
    });
  }
  rows.sort((a, b) => cmp(b.lastSendMonth ?? "", a.lastSendMonth ?? "") || cmp(b.lastSendDay ?? "", a.lastSendDay ?? "") || cmp(String(a.name ?? a.programId).toLowerCase(), String(b.name ?? b.programId).toLowerCase()));
  return { unavailable: null, rows, historyMonths: history, scheduleUnknown, lastSendBasis: lastSends ? "day" : "month" };
}

// ── Templates: content, performance per template, in-page search (TPL-1, TPL-2) ──
// The Templates tab's one engine function per kind (house rule 11): the view
// (each template the filters keep, its figures from runQuery, the programs and
// steps that send it with their own figures, its content's dates and flag),
// the search over the stored text, and the content a drawer shows. The page
// lays these out and never reads a fact row itself.
export const TEMPLATE_VIEW_METRICS = Object.freeze(["sent", "delivered", "opened", "openRate", "clicked", "clickRate", "bounced"]);
// The survey figures beside a program that sends the template: program level, as the registry defines them.
const TEMPLATE_PROGRAM_METRICS = Object.freeze(["surveyParticipants", "anyResponse", "responseRate"]);
export const SEARCH_SNIPPET_DEFAULT = 50;
// The search primitives, mirroring scripts/jo-report-search.mjs (email-report
// `search`) so the page and the skill find the same templates: the text and
// the term NFC-folded, one case-insensitive regex per term (whole word =
// lookarounds on [A-Za-z0-9_], never \b, so "c++" keeps a sane boundary), the
// FIRST occurrence per field, and ±radius characters of context with white
// space collapsed. This module imports nothing (a page runs its bytes), so
// three primitives doc-lib owns — the NFC fold, the regex escape and the
// surrogate-safe slice — are spelled here again as a sanctioned copy
// (build/check-doc-drift.mjs SANCTIONED_PORTABILITY_COPIES, doc-lib's
// sanctioned-duplicates header). The sync mechanism is the differential in
// test/engagement-query.mjs: the same terms and options through both searches
// over one fixture knowledge base must give the same matches (A-2, A-6).
const foldNfc = (s) => String(s).normalize("NFC");
const escapeForRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const sliceCodePoints = (s, start, end) => String(s).slice(start, end).replace(/^[\uDC00-\uDFFF]/, "").replace(/[\uD800-\uDBFF]$/, "");
/** @param {string} term @param {{wholeWord?: boolean}} [opts] */
export function compileSearchTerm(term, { wholeWord = false } = {}) {
  const esc = escapeForRegExp(foldNfc(term));
  return new RegExp(wholeWord ? `(?<![A-Za-z0-9_])${esc}(?![A-Za-z0-9_])` : esc, "i");
}
/** ±radius characters around a match of the FOLDED text, one line, ASCII ellipses where cut. */
export function searchSnippet(text, start, end, radius = SEARCH_SNIPPET_DEFAULT) {
  const s = Math.max(0, start - radius);
  const e = Math.min(text.length, end + radius);
  const body = sliceCodePoints(text, s, e).replace(/\s+/g, " ").trim();
  return (s > 0 ? "..." : "") + body + (e < text.length ? "..." : "");
}
/** The searchable fields of one template of the snapshot, in report order: the same fields email-report searches. */
export function searchableTemplateFields(t) {
  const fields = [];
  if (t?.name) fields.push({ field: "title", text: t.name });
  const c = t?.content;
  if (c?.subject) fields.push({ field: "subject", text: c.subject });
  if (c?.body) fields.push({ field: "body", text: c.body });
  for (const v of c?.variants ?? []) {
    const name = v.name ?? "(unnamed)";
    if (v.subject) fields.push({ field: `variant "${name}" subject`, text: v.subject });
    if (v.body) fields.push({ field: `variant "${name}" body`, text: v.body });
  }
  return fields;
}
/**
 * Keyword search over the templates the filters keep (TPL-2, R14): several
 * terms, any or all (`allTerms`), substring or whole word, case-insensitive,
 * a snippet per field and term. Matching runs on the STORED text, which holds
 * tokens as their field labels (TPL-1): a term inside a raw token key matches
 * in email-report, which searches the knowledge base's raw text, and not
 * here; every other term matches alike (the differential test says so).
 * @param {T10Snapshot} snapshot
 * @param {EngagementFilters} filters
 * @param {string[]} terms
 * @param {{wholeWord?: boolean, allTerms?: boolean, snippet?: number}} [opts]
 * @returns {{terms: string[], wholeWord: boolean, allTerms: boolean, snippet: number, searched: number, matched: Array<{templateId: string, matches: Array<{field: string, term: string, snippet: string, hit: string}>}>}}
 */
export function searchTemplateContent(snapshot, filters, terms, { wholeWord = false, allTerms = false, snippet = SEARCH_SNIPPET_DEFAULT } = {}) {
  const uniqueTerms = [...new Set((terms ?? []).map((t) => String(t)).filter((t) => t.trim()))];
  if (!Number.isInteger(snippet) || snippet < 1) throw new Error(`engagement query: the snippet radius must be a whole number >= 1 (got ${snippet})`);
  const matchers = uniqueTerms.map((term) => ({ term, re: compileSearchTerm(term, { wholeWord }) }));
  const kept = runQuery(snapshot, filters ?? {}, { groupBy: ["template"], metrics: ["sent"] }).rows.map((r) => r.key.template).filter((id) => id != null);
  const byId = new Map(snapshot.dimensions.templates.map((t) => [t.id, t]));
  const matched = [];
  let searched = 0;
  for (const id of kept) {
    const fields = searchableTemplateFields(byId.get(id));
    if (!fields.length || !uniqueTerms.length) continue;
    searched++;
    const matches = [];
    const matchedTerms = new Set();
    for (const { field, text } of fields) {
      const folded = foldNfc(text);
      for (const { term, re } of matchers) {
        const m = re.exec(folded);
        if (!m) continue;
        matchedTerms.add(term);
        matches.push({ field, term, snippet: searchSnippet(folded, m.index, m.index + m[0].length, snippet), hit: m[0] });
      }
    }
    if (!matches.length) continue;
    if (allTerms && matchedTerms.size < uniqueTerms.length) continue;
    matched.push({ templateId: id, matches });
  }
  return { terms: uniqueTerms, wholeWord, allTerms, snippet, searched, matched };
}
/**
 * The content a drawer shows for one template: subject, body and variants as
 * rendered plain text, the content-as-of date, the last-modified date and the
 * "edited after last send" flag. Null when the snapshot holds no content for it.
 * @param {T10Snapshot} snapshot
 * @param {string} templateId
 */
export function templateContent(snapshot, templateId) {
  const t = snapshot.dimensions.templates.find((x) => x.id === templateId);
  if (!t?.content) return null;
  const c = t.content;
  return { templateId: t.id, name: t.name ?? null, subject: c.subject ?? null, body: c.body ?? null, bodyIncluded: !!c.bodyIncluded, variants: c.variants ?? [], asOf: c.asOf ?? null, modified: c.modified ?? null, editedAfterLastSend: c.editedAfterLastSend ?? null, lastSendMonth: t.lastSendMonth ?? null, source: c.source ?? null };
}
/**
 * The Templates tab (a templates panel): one row per template the filters
 * keep (a send with no template id is counted apart), most sent first, each
 * with the view's figures, the programs that send it with their own figures
 * and the program's survey figures beside them, the steps and variants that
 * send it when the pull carries step detail (R21), its content's dates and
 * flag, and, under a search, its matches. `content.available` says whether
 * the text may be shown here (a leaders' page withholds it unless the spec
 * opts in); the figures draw either way.
 * @param {T10Snapshot} snapshot
 * @param {EngagementFilters} filters
 * @param {{terms?: string[], wholeWord?: boolean, allTerms?: boolean, snippet?: number, sort?: {by: string, dir?: "asc"|"desc"}}} [opts]
 */
export function templatesView(snapshot, filters, opts = {}) {
  const f = filters ?? {};
  const avail = templateAvailability(snapshot);
  const base = { metrics: TEMPLATE_VIEW_METRICS, programMetrics: TEMPLATE_PROGRAM_METRICS, stepDetail: !!snapshot.meta.stepDetail };
  if (!avail.pulled) return { ...base, unavailable: { reason: avail.reason ?? "templates-not-pulled" }, content: { available: false, reason: avail.reason ?? "templates-not-pulled" }, rows: [], total: null, search: null, noTemplate: null, scope: null };
  const content = avail.content ? { available: true, reason: null } : { available: false, reason: avail.reason ?? "templates-not-on-page" };
  const byTemplate = runQuery(snapshot, f, { groupBy: ["template"], metrics: TEMPLATE_VIEW_METRICS, sort: [{ metric: "sent", dir: "desc" }] });
  const perProgram = runQuery(snapshot, f, { groupBy: ["program", "template"], metrics: TEMPLATE_VIEW_METRICS, sort: [{ metric: "sent", dir: "desc" }] });
  const perStep = snapshot.meta.stepDetail ? runQuery(snapshot, f, { groupBy: ["program", "step", "variant"], metrics: TEMPLATE_VIEW_METRICS, sort: [{ dim: "program" }, { label: "stepOrder" }, { metric: "sent", dir: "desc" }] }) : null;
  const surveys = runQuery(snapshot, f, { groupBy: ["program"], metrics: [...TEMPLATE_PROGRAM_METRICS] });
  const surveyOf = new Map(surveys.rows.map((r) => [r.key.program, r.cells]));
  const search = content.available && opts.terms?.length ? searchTemplateContent(snapshot, f, opts.terms, opts) : null;
  const matchesOf = search ? new Map(search.matched.map((m) => [m.templateId, m.matches])) : null;
  const byId = new Map(snapshot.dimensions.templates.map((t) => [t.id, t]));
  const noTemplate = byTemplate.rows.find((r) => r.key.template == null) ?? null;
  const rows = byTemplate.rows.filter((r) => r.key.template != null && (!matchesOf || matchesOf.has(r.key.template))).map((r) => {
    const id = r.key.template;
    const t = byId.get(id);
    const programs = perProgram.rows.filter((p) => p.key.template === id).map((p) => ({
      programId: p.key.program, name: p.label.program ?? null, statuses: p.label.statuses ?? [], stepName: p.label.stepName ?? null, stepOrder: p.label.stepOrder ?? null, stepCount: p.label.stepCount ?? null,
      cells: p.cells, survey: surveyOf.get(p.key.program) ?? null, carried: p.carried, incomplete: p.incomplete,
      steps: perStep ? perStep.rows.filter((s) => s.key.program === p.key.program && s.label.templateId === id).map((s) => ({ stepId: s.key.step, step: s.label.step ?? null, stepOrder: s.label.stepOrder ?? null, variantId: s.key.variant, variant: s.label.variant ?? null, cells: s.cells, carried: s.carried, incomplete: s.incomplete })) : null,
    }));
    const c = t?.content ?? null;
    return {
      templateId: id, name: r.label.template ?? t?.name ?? null, cells: r.cells, carried: r.carried, incomplete: r.incomplete, programs, lastSendMonth: t?.lastSendMonth ?? null,
      content: c ? { subject: content.available ? c.subject ?? null : null, asOf: c.asOf ?? null, modified: c.modified ?? null, editedAfterLastSend: c.editedAfterLastSend ?? null, bodyIncluded: !!c.bodyIncluded, variants: (c.variants ?? []).length } : null,
      matches: matchesOf?.get(id) ?? null,
    };
  });
  // The viewer's sort: a metric's value, the name, or the last send month; most sent first by default. Nulls last.
  const sort = opts.sort ?? null;
  if (sort?.by) {
    const dir = sort.dir === "asc" ? 1 : -1;
    const keyOf = (row) => (sort.by === "name" ? String(row.name ?? row.templateId).toLowerCase() : sort.by === "lastSend" ? row.lastSendMonth : TEMPLATE_VIEW_METRICS.includes(sort.by) ? row.cells[sort.by].value : null);
    rows.sort((a, b) => {
      const [x, y] = [keyOf(a), keyOf(b)];
      if (x == null || y == null) return x == null && y == null ? 0 : x == null ? 1 : -1;
      const c = typeof x === "number" && typeof y === "number" ? x - y : x < y ? -1 : x > y ? 1 : 0;
      return c ? c * dir : cmp(a.templateId, b.templateId);
    });
  }
  return { ...base, unavailable: null, content, rows, total: byTemplate.total, search, noTemplate: noTemplate ? { cells: noTemplate.cells } : null, scope: byTemplate.scope, templatesKept: byTemplate.rows.filter((r) => r.key.template != null).length };
}

// ── What is provisional, stated once (F-493) ─────────────────────────────────
// Two windows move after a pull: opens keep arriving on sends from the first
// of the current month, and bounces and unsubscribes keep landing on the months
// a refresh reads again (the last repullMonths months). Every output names both.
const monthsBack = (ym, n) => {
  let y = Number(ym.slice(0, 4));
  let m = Number(ym.slice(5, 7)) - n;
  while (m < 1) { m += 12; y--; }
  return `${y}-${String(m).padStart(2, "0")}`;
};
/**
 * @param {*} meta T10Meta
 * @returns {{from: string, flagsFrom: string, repullMonths: number}} from: sends on or after it are provisional; flagsFrom: the first day the flags can still change on
 */
export function provisionalSpan(meta) {
  const repullMonths = meta.refresh?.repullMonths ?? meta.params?.repullMonths ?? 2;
  const flagsFrom = `${monthsBack(meta.window.to, repullMonths - 1)}-01`;
  return { from: meta.incompleteFrom, flagsFrom: flagsFrom < meta.incompleteFrom ? flagsFrom : meta.incompleteFrom, repullMonths };
}
/** The provisional clause every output carries, from the pull's own re-pull horizon. */
export function provisionalText(meta) {
  const s = provisionalSpan(meta);
  return `sends on or after ${s.from} are provisional (opens keep arriving)${s.flagsFrom < s.from ? `, and bounces and unsubscribes on sends since ${s.flagsFrom} can still change (the ${s.repullMonths} month${s.repullMonths === 1 ? "" : "s"} a refresh reads again)` : ""}`;
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
  "incomplete-period": (d) => `Sends on or after ${d.from} are provisional: opens keep arriving, so the recent period reads low.${d.flagsFrom && d.flagsFrom < d.from ? ` Bounces and unsubscribes on sends since ${d.flagsFrom} can still change too: a refresh reads those months again.` : ""}`,
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
    `Schedule configuration (the cron, its start and end dates) comes from the knowledge base, as of the date each program was last documented${d.oldest ? ` (the oldest is ${d.oldest})` : ""}; the knowledge base is refreshed when a program's configuration changes. ` +
    "Whether a schedule is still running is read from each participant source's last sync time at this pull, never from the schedule's own run-state fields: on the measured tenant those are unset even on programs that run daily. " +
    "A documented schedule that ended before its source last synced is read as documentation behind the tenant (Cannot judge yet), never as an ended schedule.",
  "failure-samples-capped": (d) => `${d.notSampled} program(s) with ${d.part === "participantFailures" ? "refused participants" : "uncategorised bounce text"} were not sampled this pull: the sample reads at most ${d.cap} programs a pull, most failures first (about ${d.secondsEach} seconds each). Their text is carried from the previous pull where it had one. Raise --sample-programs to read them.`,
  "failure-samples-sampled": () => "The breakdown of refused participants by reason is a SAMPLE: one page per program of the refusals still happening in the day window, the most repeated first, because the reason field takes no filter on this tenant. The totals beside it are exact. Each sampled text carries how many participants it refused and how many times in all.",
  "unclassified-wordings": (d) =>
    [
      d.wordings || d.stepParticipants
        ? `${d.wordings} entry-refusal wording(s) in the samples of ${d.programs} program(s) match no known category and are labelled "unclassified" (kind unknown): ${d.participants} sampled participant(s), ${d.occurrences} refusal(s) in all${d.stepParticipants ? `, plus ${d.stepParticipants} participant(s) who fell off at a step for a reason the shipped list does not name` : ""}. ` +
          "An unknown product wording is treated as a failure needing investigation, never as a business rule or a known error. Read the texts in the snapshot's failureSamples table (terminal only; they never reach a page) and report them with /gs-superadmin:report-bug so the shipped list can learn them, or add them to this tenant's --failure-categories file."
        : "",
      d.bounceWordings
        ? `${d.bounceWordings} bounce wording(s) in the samples of ${d.bouncePrograms} program(s) match no category of this dashboard's list and are counted as "other" (mail-server text, which no shipped list carries): the only remedy is this tenant's --failure-categories file, read from the snapshot's failureSamples table (terminal only).`
        : "",
    ].filter(Boolean).join(" "),
  "kb-behind-tenant": (d) =>
    `The knowledge base is behind the tenant for ${d.undocumented + d.behind} selected program(s): ${d.undocumented} ${d.undocumented === 1 ? "has" : "have"} no doc (created after the KB's last journey capture) and ${d.behind} ${d.behind === 1 ? "was" : "were"} modified after ${d.behind === 1 ? "its" : "their"} doc was written. ` +
    "An undocumented program's schedule is unknown to this pull, so it reads Cannot judge yet (no doc) and is never read as a one-off; a program with a doc behind the tenant is judged from that doc and flagged. " +
    `Run /gs-superadmin:refresh for these programs only (the plan wrote their keys to ${d.keysFile ?? "the run directory"}; about ${d.refreshSeconds ?? "?"} seconds) and pull again.`,
  "health-all-time": (d) => `${list(d.parts ?? [])} are all time: the objects they are read from carry no date on every row, so the date filter does not apply to them.`,
  "participant-failures-no-breakdown": (d) => `Participant failures are counted per program with no breakdown by reason. ${reasonText(d.reason)}${d.expectedReasons ? ` The ${d.expectedReasons} expected reason(s) named for this pull could not be counted apart for the same reason.` : ""}`,
  "failure-categories-overlap": (d) => `The failure category list overlaps: ${d.rows} "Other" row(s) in ${list(d.parts ?? [])} count below zero. Two patterns match the same message, so a message is counted twice; fix the list. Nothing was clamped.`,
  "step-names-as-of": (d) => `Step names come from the knowledge base, as of the date each program was last documented${d.oldest ? ` (the oldest is ${d.oldest})` : ""}. A step renamed since then shows its earlier name.`,
  // Template content (TPL-1): the knowledge base's text, as of the day each doc was read.
  "template-content-current": (d) => `Template subjects and bodies are each template's CURRENT text as the knowledge base holds it${d.oldest ? ` (the oldest doc is as of ${d.oldest})` : ""}, not a copy of what was sent: a template edited after its last send may differ from what recipients got, and the "edited after last send" flag says which. Tokens are shown as their field labels.`,
  "template-content-missing": (d) => `${d.missing} of ${d.referenced} template(s) the sends reference have no doc in the knowledge base, so their text and link settings are not in this snapshot. The plan lists them; the skill's gap-fill fetches each one by id and files it in the knowledge base.`,
  "template-content-behind": (d) => `${d.behind} template doc(s) were read before the month of the template's last send, so the text may predate what was sent. The next gap-fill reads them again.`,
  "template-link-readings-missing": (d) => `${d.count} never-clicked template(s) have no link-tracking reading in the knowledge base (their docs predate it), so their click tracking reads unknown. The next gap-fill reads them again.`,
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
const HEALTH_CAVEATS = Object.freeze(["health-incomplete", "schedules-from-kb", "kb-behind-tenant", "health-all-time", "participant-failures-no-breakdown", "failure-categories-overlap", "failure-samples-capped", "failure-samples-sampled", "unclassified-wordings"]);
// The snapshot's own caveats that are about template content (TPL-1): an output that shows no template text does not carry these.
const TEMPLATE_CAVEATS = Object.freeze(["template-content-current", "template-content-missing", "template-content-behind", "template-link-readings-missing"]);
/**
 * The caveats block of any output over this snapshot: the snapshot's own
 * (failures first), what the pull left out, the incomplete period, and the
 * caveats of the metrics shown.
 * @param {T10Snapshot} snapshot
 * @param {string[]} metricIds the metrics the output shows
 * @param {{health?: boolean, templates?: boolean}} [shows] health: the output shows health tables (bounce reasons, failures, silent programs, schedules); templates: it shows template text (subjects, bodies, the Templates tab)
 * @returns {Array<{id: string, text: string}>}
 */
export function caveatsFor(snapshot, metricIds, { health = false, templates = false } = {}) {
  const out = [];
  const push = (id, detail) => {
    if (!out.some((c) => c.id === id)) out.push({ id, text: caveatText(id, detail) });
  };
  const own = [...snapshot.caveats].sort((a, b) => Number(b.id === "reconciliation-mismatch") - Number(a.id === "reconciliation-mismatch"));
  for (const c of own) if ((health || !HEALTH_CAVEATS.includes(c.id)) && (templates || !TEMPLATE_CAVEATS.includes(c.id))) push(c.id, c.detail);
  push("incomplete-period", provisionalSpan(snapshot.meta));
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
  return `Data pulled ${m.pulledAt}${m.timeZone ? ` (${m.timeZone})` : ""} from ${m.tenantHost}. Window ${m.window.from} to ${m.window.to}; ${provisionalText(m)}.`;
}
