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
//               programClickAvailability, readResponses, accountAvailability):
//               the only accessors of the optional metrics. A not-tracked
//               metric has NO value through them: not 0, not the stored count.
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
});

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
export const METRICS = deepFreeze(METRIC_LIST.map((m) => ({ counts: undefined, afterRead: [], caveats: [], tracking: null, ...m })));
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
export const measuresCounted = (flags) => FLAG_COUNTS.filter((m) => m.counts.every((c) => !!flags[c.flag] === c.is)).map((m) => m.id);

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
  const newGroup = (key) => ({ key, rows: [], sums: Object.fromEntries(SEND_MEASURES.map((k) => [k, 0])), programs: new Set(), months: new Set(), carried: false });
  const addTo = (g, r) => {
    g.rows.push(r);
    for (const k of SEND_MEASURES) g.sums[k] += r[k];
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
    if (def.kind === "count") return def.tracking === "clicks" ? clicksOf(g) : { value: g.sums[def.id] };
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
const flagText = (src, counts) =>
  counts.length ? counts.map((c) => `${src.flags[c.flag].field} ${c.is ? "=" : "is not"} ${src.flags[c.flag].value}`).join(" and ") : "every row (no field condition)";
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
  const fields = def.counts ? flagText(src, def.counts) : `${src.clicks.countField} > 0, then each link in ${src.clicks.detailField}`;
  const stepFields = def.counts ? flagText(steps, def.counts) : `${steps.clicks.flagField} = true, kept only where the same send has a content-link click in ${src.object}`;
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
/**
 * The caveats block of any output over this snapshot: the snapshot's own
 * (failures first), what the pull left out, the incomplete period, and the
 * caveats of the metrics shown.
 * @param {T10Snapshot} snapshot
 * @param {string[]} metricIds the metrics the output shows
 * @returns {Array<{id: string, text: string}>}
 */
export function caveatsFor(snapshot, metricIds) {
  const out = [];
  const push = (id, detail) => {
    if (!out.some((c) => c.id === id)) out.push({ id, text: caveatText(id, detail) });
  };
  const own = [...snapshot.caveats].sort((a, b) => Number(b.id === "reconciliation-mismatch") - Number(a.id === "reconciliation-mismatch"));
  for (const c of own) push(c.id, c.detail);
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
