// ─────────────────────────────────────────────────────────────────────────────
// acme-tenant.mjs — the fictional acme tenant behind the engagement suites
// (ENG-1, ENG-2): a small deterministic dataset plus `answer()`, a stand-in
// for the five reads scripts/engagement.mjs issues (whoami, jo p list,
// jo p describe, rp schema, rp run).
//
// Why a query engine in a fixture: the adapter's pitfalls are properties of
// how the server ANSWERS, so a canned payload per call would certify the
// reader against itself (Class: reader-shape). `answer()` reproduces the
// behaviours the spike measured on CLI 1.0.10 — every one is read off the
// scrubbed response samples and the notes beside them, never invented:
//   - `rp run --json` prints a BARE array; no envelope, no total, no paging
//   - no --page-size returns 50 rows; -1 returns the server maximum; N returns
//     N; the cut is silent
//   - a group value that is null comes back with NO `v` key
//   - month buckets are {k: YYYY-MM-DD, v: MM-01-YYYY, fv: Mon-YYYY}; rows are
//     not returned in date order
//   - a null date acts as later than any date: GTE keeps it, LT drops it
//   - grouping on a LOOKUP field resolves to the target's name, which is
//     empty, and collapses every row into one group
//   - a where-filter on a field the schema lacks is silently dropped
//   - an unknown operator fails with "The filter operator cannot be left blank."
//   - a failure is exit 1, empty stdout, text on stderr
//   - a call that names a lookup path as a group-by or an aggregate DROPS every
//     row whose lookup is null: it comes back neither as a null group nor in a
//     count (measured on a production tenant, F-473; a PLAIN null field does
//     come back, as a group with no `v`)
//   - before a request is sent, a show field whose object and field name a
//     group-by field also has is DROPPED, whatever its aggregation, with a
//     warning on stderr; when no show field is left the request is refused
//     (read off the CLI's dist/artifacts/validators/report.js at 1.0.10:
//     normalizeGroupByDedup, then assertShowFieldsNonEmpty)
//   - a field typed JSONSTRING cannot be grouped by or distinct-counted: the
//     call fails with the "network outage" text; plain rows of it are returned
//   - a WHERE condition on a field whose schema says filterable: false fails
//     with "Unrecognized data type found in Filter or Ranking fields" (measured
//     2026-10-07 on ao_failed_participants.FailureReasons with CONTAINS,
//     DOES_NOT_CONTAINS and STARTS_WITH; the field is a JSON-path extraction
//     and its schema declares it neither filterable nor groupable — S3b)
//   - CONTAINS on a filterable STRING field works in a plain count and in a
//     grouped call alike, and DOES_NOT_CONTAINS is its complement (measured
//     on email_log_v2.BouncedReason, S3b); IN and NOT_IN on the company LOOKUP
//     work, and NOT_IN KEEPS rows whose company is null (measured S3b: IN plus
//     NOT_IN equals the plain count on a window holding order 10^4 null rows)
//   - SUM is an aggregation: `sum_of_<obj>_<Field>`, a numeric cell (measured S3b)
//   - day buckets are summarize_day_of_<obj>_<Field> with k = YYYY-MM-DD
//   - a bounce reason comes back in `fv`, and in `v` too on only some rows
// Every behaviour above was measured on a real tenant. Two are still ASSUMED,
// measured only where they have nothing to act on: DOES_NOT_CONTAINS keeps a
// row whose field is null (the measured tenant has no in-scope send with a null
// address, and the month measured for bounce reasons had no bounce with a null
// reason). The failed participant's FailureReasons shape was measured at the
// spot check (Y3): plain text in {v, fv}, one product sentence per cell; the
// fixture also writes one row as a JSON array of texts, which the reader takes.
// Values are fictional throughout (acme.com is the tenant's own domain, the
// customers live under example.com); the SHAPES are the tenant's.
//
// Not a runner: it lives under test/fixtures/ so check-doc-drift's battery
// enumeration (non-recursive over test/) never lists it.
// Zero dependencies — no imports at all.
// ─────────────────────────────────────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, "0");
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthsBetween(from, to) {
  const out = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  for (;;) {
    const ym = `${y}-${pad(m)}`;
    if (ym > to) break;
    out.push(ym);
    m++;
    if (m === 13) { m = 1; y++; }
  }
  return out;
}

export const JO_SOURCE = "Advanced Outreach";
export const INTERNAL_DOMAIN = "acme.com";
const FIRST_MONTH = "2025-08";
const LAST_MONTH = "2026-09";

// ── Programs ─────────────────────────────────────────────────────────────────
// `steps` is the program's design: what a KB doc and `jo p describe` carry.
// tpl-renew sits on two steps of p-renew (the reuse case: no single step name).
const PROGRAMS = [
  {
    id: "p-onboard", name: "Acme Onboarding Chain", model: "DRIPV2", modelName: "Email Chain", statuses: ["PROCESSING"], type: "CUSTOMER", folderId: "101",
    months: monthsBetween(FIRST_MONTH, LAST_MONTH), accounts: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], perAccount: 2, internalOn: 0,
    // Its last scheduled run FAILED (the health facts read this from the KB doc).
    schedules: [{ type: "CRON", cronExpression: "0 0 8 ? * MON *", lastRunSuccess: false, lastSuccessTime: 1756712400000, nextRunTime: 1757926800000, runningNow: false, timeZoneName: "America/Los_Angeles", jobType: "PARTICIPANT_SYNC", startTime: 1767225600000, endTime: 1830297600000 }],
    steps: [
      { stepId: "st-ob-1", stepName: "Welcome", order: 1, templateId: "tpl-welcome", variants: ["var-welcome-a", "var-welcome-b"] },
      { stepId: "st-ob-2", stepName: "Day 7 check-in", order: 2, templateId: "tpl-day7", variants: ["var-day7"] },
    ],
  },
  {
    id: "p-nps", name: "Acme NPS Survey", model: "CSAT_SURVEY_V2", modelName: "CSAT Survey", statuses: ["PROCESSING"], type: "CUSTOMER", folderId: "101",
    months: ["2025-10", "2026-01", "2026-04", "2026-07"], accounts: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], perAccount: 1, survey: true,
    schedules: [{ type: "CRON", cronExpression: "0 0 9 1 * ? *", lastRunSuccess: true, lastSuccessTime: 1756717200000, nextRunTime: 1759309200000, runningNow: false, timeZoneName: "America/Los_Angeles", jobType: "PARTICIPANT_SYNC", startTime: 1767225600000, endTime: 1830297600000 }],
    steps: [{ stepId: "st-nps-1", stepName: "Survey email", order: 1, templateId: "tpl-nps", variants: ["var-nps"] }],
  },
  {
    id: "p-renew", name: "Acme Renewal Dynamic", model: "DYNAMIC_PROGRAM", modelName: "Dynamic Program", statuses: ["PAUSE", "NEW"], type: "CUSTOMER", folderId: "202",
    months: monthsBetween("2026-03", LAST_MONTH), accounts: [2, 3, 4, 5, 6, 7], perAccount: 1,
    steps: [
      { stepId: "st-rn-1", stepName: "Renewal notice", order: 1, templateId: "tpl-renew", variants: ["var-renew"] },
      { stepId: "st-rn-2", stepName: "Renewal reminder", order: 2, templateId: "tpl-renew", variants: ["var-renew"] },
      { stepId: "st-rn-3", stepName: "Renewal thanks", order: 3, templateId: "tpl-renew-b", variants: ["var-renew-b"] },
    ],
  },
  {
    id: "p-promo", name: "Acme Old Promo", model: "SIMPLE_PROGRAM", modelName: "Simple Program", statuses: ["STOP"], type: "CUSTOMER", folderId: "202",
    months: ["2025-11", "2025-12"], accounts: [0, 1, 2, 3, 4, 5, 6, 7], perAccount: 2,
    steps: [{ stepId: "st-pr-1", stepName: "Promo", order: 1, templateId: "tpl-promo", variants: ["var-promo"] }],
  },
  {
    id: "p-pilot", name: "Acme Internal Pilot", model: "DRIPV2", modelName: "Email Chain", statuses: ["PROCESSING"], type: "USER", folderId: "303",
    months: monthsBetween("2026-06", LAST_MONTH), internalOnly: true,
    steps: [{ stepId: "st-pl-1", stepName: "Pilot note", order: 1, templateId: null, variants: [null] }],
  },
  { id: "p-draft", name: "Acme Draft Program", model: "DRIPV2", modelName: "Email Chain", statuses: ["NEW"], type: "CUSTOMER", folderId: "303", months: [], steps: [] },
];
// In the send log but NOT in `jo p list`: one that still describes (the list
// missed it) and one that is gone (deleted).
const UNLISTED = { id: "p-unlisted", name: "Acme Unlisted Program", model: "DRIPV2", modelName: "Email Chain", statuses: ["PROCESSING"], type: "CUSTOMER", folderId: "303", months: ["2026-08"], accounts: [0, 1, 2], perAccount: 2, steps: [{ stepId: "st-ul-1", stepName: "Unlisted note", order: 1, templateId: "tpl-unlisted", variants: ["var-unlisted"] }] };
const DELETED = { id: "p-gone", name: "Acme Deleted Program", months: ["2026-01"], accounts: [0, 1, 2, 3, 4], perAccount: 1, steps: [{ stepId: "st-gn-1", templateId: "tpl-gone", variants: ["var-gone"] }] };

// Only with the ownSiteUnsub variant (F-470): a program whose emails' unsubscribe
// link is a mail-settings page on acme's OWN site, worded so that no generic
// unsubscribe pattern matches it. tpl-prefs is clicked on that link alone;
// tpl-prefs-mix also has content clicks, one of them on a page of the same
// site whose path merely begins with the same characters.
const OWN_SITE = {
  id: "p-prefs", name: "Acme Preferences Chain", model: "DRIPV2", modelName: "Email Chain", statuses: ["PROCESSING"], type: "CUSTOMER", folderId: "404",
  months: monthsBetween("2026-06", LAST_MONTH), accounts: [0, 1, 2, 3, 4, 5], perAccount: 2,
  steps: [
    { stepId: "st-pf-1", stepName: "Prefs note", order: 1, templateId: "tpl-prefs", variants: ["var-prefs"] },
    { stepId: "st-pf-2", stepName: "Prefs follow-up", order: 2, templateId: "tpl-prefs-mix", variants: ["var-prefs-mix"] },
  ],
};
// Only with the massDay variant (F-472): one program sends to sixty accounts on
// ONE day, so a single program-day holds more accounts than a small page.
const BLAST = {
  id: "p-blast", name: "Acme Mass Send", model: "DRIPV2", modelName: "Email Chain", statuses: ["PROCESSING"], type: "CUSTOMER", folderId: "505",
  months: ["2026-07"], steps: [{ stepId: "st-bl-1", stepName: "Announcement", order: 1, templateId: "tpl-blast", variants: ["var-blast"] }],
};
// Only with the silent variant (HLT-1): an Active program whose last send is
// months back (before the day window the health facts read), and an Active
// program that has never sent anything in the window at all.
const QUIET = {
  id: "p-quiet", name: "Acme Quiet Chain", model: "DRIPV2", modelName: "Email Chain", statuses: ["PROCESSING"], type: "CUSTOMER", folderId: "606",
  months: ["2026-02"], accounts: [0, 1], perAccount: 1, steps: [{ stepId: "st-qt-1", stepName: "Quiet note", order: 1, templateId: "tpl-quiet", variants: ["var-quiet"] }],
};
const NEVER = { id: "p-never", name: "Acme Never Sent", model: "DRIPV2", modelName: "Email Chain", statuses: ["PROCESSING"], type: "CUSTOMER", folderId: "606", months: [], steps: [] };
// Only with the cadence variant (HLT-1 S3b, the cadence-aware silent rule).
// Each is Active and documented in the KB (kbFiles takes the variant):
//   p-quarter   a quarterly schedule the audit's humanizer does not read (the
//               scheduleType says RECURRING; the cron steps months): last sent
//               in July, next due in October, so it is NOT a silent failure in
//               September though the flat 30-day rule would flag it
//   p-sporadic  no schedule (hand-fed), sends about every third month: judged
//               against its own history, its 60-odd quiet days are its habit
//   p-once      a ONE-TIME schedule that sent in one month: never on a silent list
//   p-lapsed    no schedule, sent every month until June and nothing since:
//               "No recent sends" under its own history
const QUARTER = {
  id: "p-quarter", name: "Acme Quarterly Review", model: "DRIPV2", modelName: "Email Chain", statuses: ["PROCESSING"], type: "CUSTOMER", folderId: "707",
  months: ["2025-10", "2026-01", "2026-04", "2026-07"], accounts: [0, 1, 2], perAccount: 1,
  schedules: [{ type: "RECURRING", cronExpression: "0 0 9 1 1/3 ? *", lastRunSuccess: true, lastSuccessTime: 1751360400000, nextRunTime: 1759309200000, runningNow: false, timeZoneName: "America/Los_Angeles", jobType: "PARTICIPANT_SYNC" }],
  steps: [{ stepId: "st-qr-1", stepName: "Quarterly note", order: 1, templateId: "tpl-quarter", variants: ["var-quarter"] }],
};
const SPORADIC = {
  id: "p-sporadic", name: "Acme Sporadic Outreach", model: "DRIPV2", modelName: "Email Chain", statuses: ["PROCESSING"], type: "CUSTOMER", folderId: "707",
  months: ["2025-10", "2026-01", "2026-04", "2026-07"], accounts: [3, 4], perAccount: 1,
  steps: [{ stepId: "st-sp-1", stepName: "Sporadic note", order: 1, templateId: "tpl-sporadic", variants: ["var-sporadic"] }],
};
const ONCE = {
  id: "p-once", name: "Acme One-time Announcement", model: "SIMPLE_PROGRAM", modelName: "Simple Program", statuses: ["PROCESSING"], type: "CUSTOMER", folderId: "707",
  months: ["2026-03"], accounts: [5, 6, 7], perAccount: 1,
  schedules: [{ type: "ONE-TIME", cronExpression: null, lastRunSuccess: true, lastSuccessTime: 1741000000000, nextRunTime: 0, runningNow: false, timeZoneName: "America/Los_Angeles", jobType: "PARTICIPANT_SYNC" }],
  steps: [{ stepId: "st-on-1", stepName: "Announcement", order: 1, templateId: "tpl-once", variants: ["var-once"] }],
};
const LAPSED = {
  id: "p-lapsed", name: "Acme Lapsed Digest", model: "DRIPV2", modelName: "Email Chain", statuses: ["PROCESSING"], type: "CUSTOMER", folderId: "707",
  months: monthsBetween("2025-09", "2026-06"), accounts: [8, 9], perAccount: 1,
  steps: [{ stepId: "st-lp-1", stepName: "Digest", order: 1, templateId: "tpl-lapsed", variants: ["var-lapsed"] }],
};
const CADENCE = [QUARTER, SPORADIC, ONCE, LAPSED];
// Only with the signals variant (HLT-1 F-491, the health signals). Each is Active and documented in the KB.
// `lastSync` is the participant source's LastSyncedOn (the ingest heartbeat); `endTime` ends a schedule.
//   p-ended     weekly schedule that ENDED on 2026-08-01, synced last in July: "Schedule ended"
//   p-overdue   daily cron, last synced 2026-08-20 though due daily: "Participant sync overdue"
//   p-nobody    daily cron, synced yesterday, but no participant created since July: "Admitting nobody"
//   p-refused   like p-nobody, and its recent refusals carry the UNEXPECTED null-email wording: "Only refused participants arriving"
//   p-steperr   daily cron, synced, admitting; its dropped participants carry the CTA step failure and a
//               platform error this month: "Step errors this period"
//   p-disabled  the list says its participant sync is disabled: "Participant sync disabled"
const DAILY = "0 0 8 * * ? *";
const sched = (cron, extra = {}) => ({ type: "CRON", cronExpression: cron, lastRunSuccess: false, lastSuccessTime: 0, lastFailureTime: 0, failingSince: 0, nextRunTime: 0, runningNow: false, timeZoneName: "America/Los_Angeles", jobType: "PARTICIPANT_SYNC", startTime: 1767225600000, endTime: 1830297600000, ...extra });
const ENDED = { id: "p-ended", name: "Acme Ended Chain", model: "DRIPV2", modelName: "Email Chain", statuses: ["PROCESSING"], type: "CUSTOMER", folderId: "808", months: monthsBetween("2026-03", "2026-07"), accounts: [0, 1], perAccount: 1, lastSync: "2026-07-27 08:01:00", schedules: [sched("0 0 8 ? * MON *", { endTime: 1785542400000 })], steps: [{ stepId: "st-en-1", stepName: "Ended note", order: 1, templateId: "tpl-ended", variants: ["var-ended"] }] };
const OVERDUE = { id: "p-overdue", name: "Acme Overdue Chain", model: "DRIPV2", modelName: "Email Chain", statuses: ["PROCESSING"], type: "CUSTOMER", folderId: "808", months: monthsBetween("2026-06", LAST_MONTH), accounts: [2, 3], perAccount: 1, lastSync: "2026-08-20 08:01:00", schedules: [sched(DAILY)], steps: [{ stepId: "st-ov-1", stepName: "Overdue note", order: 1, templateId: "tpl-overdue", variants: ["var-overdue"] }] };
const NOBODY = { id: "p-nobody", name: "Acme Nobody Chain", model: "DRIPV2", modelName: "Email Chain", statuses: ["PROCESSING"], type: "CUSTOMER", folderId: "808", months: monthsBetween("2026-05", "2026-07"), accounts: [4, 5], perAccount: 1, lastSync: "2026-09-14 08:01:00", schedules: [sched(DAILY)], steps: [{ stepId: "st-nb-1", stepName: "Nobody note", order: 1, templateId: "tpl-nobody", variants: ["var-nobody"] }] };
const REFUSED = { id: "p-refused", name: "Acme Refused Chain", model: "DRIPV2", modelName: "Email Chain", statuses: ["PROCESSING"], type: "CUSTOMER", folderId: "808", months: monthsBetween("2026-05", "2026-07"), accounts: [6, 7], perAccount: 1, lastSync: "2026-09-14 08:01:00", schedules: [sched(DAILY)], steps: [{ stepId: "st-rf-1", stepName: "Refused note", order: 1, templateId: "tpl-refused", variants: ["var-refused"] }] };
const STEPERR = { id: "p-steperr", name: "Acme Step Error Chain", model: "DRIPV2", modelName: "Email Chain", statuses: ["PROCESSING"], type: "CUSTOMER", folderId: "808", months: monthsBetween("2026-06", LAST_MONTH), accounts: [8, 9], perAccount: 2, fixedDay: "14", lastSync: "2026-09-14 08:01:00", schedules: [sched(DAILY)], stepErrors: true, steps: [{ stepId: "st-se-1", stepName: "Step error note", order: 1, templateId: "tpl-steperr", variants: ["var-steperr"] }] };
const DISABLED = { id: "p-disabled", name: "Acme Disabled Chain", model: "DRIPV2", modelName: "Email Chain", statuses: ["PROCESSING"], type: "CUSTOMER", folderId: "808", months: monthsBetween("2026-06", LAST_MONTH), accounts: [10, 11], perAccount: 1, lastSync: "2026-09-14 08:01:00", syncDisabled: true, schedules: [sched(DAILY)], steps: [{ stepId: "st-di-1", stepName: "Disabled note", order: 1, templateId: "tpl-disabled", variants: ["var-disabled"] }] };
const SIGNALS = [ENDED, OVERDUE, NOBODY, REFUSED, STEPERR, DISABLED];
// What the product writes on a participant who got in and fell off at a STEP (ao_participants.FailureReasons;
// measured 2026-10-07), by the participant's state. `kind` is the oracle's key.
export const STEP_REASONS = {
  DROP: [
    { kind: "bounce-drop", text: (step) => `Email is Bounce, participant is dropped from process at step '${step}'` },
    { kind: "cta-failed", text: () => "CTA creation failed at step 'Create CTA', Reason: 'Found invalid IDs in fields : OwnerId'" },
  ],
  KNOCKED_OFF: [{ kind: "record-delete", text: () => "Participant was dropped from the journey as part of Record Delete operation. The base object record that got deleted was of type: Company_Person" }],
  SYSTEM_ERROR: [{ kind: "platform-error", text: () => "Failed to evaluate condition, Reason: null" }],
};
const BLAST_ACCOUNTS = Array.from({ length: 60 }, (_, i) => ({ Gsid: `co-b${pad(i + 1)}`, Name: `Acme Blast Customer ${pad(i + 1)}` }));
const BLAST_NAMES = ["ann", "bo", "cy", "dee", "eli", "fay", "gus", "hal", "ivy", "jo", "kit", "lou", "max", "ned", "oz", "pru", "quin", "roy", "sy", "tu"];
export const OWN_SITE_UNSUBSCRIBE = "https://www.acme.com/mail-settings";

const TEMPLATE_NAMES = {
  "tpl-welcome": "Acme Welcome", "tpl-day7": "Acme Day 7", "tpl-nps": "Acme NPS Request", "tpl-renew": "Acme Renewal",
  "tpl-renew-b": "Acme Renewal Thanks", "tpl-promo": "Acme Promo", "tpl-unlisted": "Acme Unlisted", "tpl-gone": "Acme Gone",
  "tpl-prefs": "Acme Prefs", "tpl-prefs-mix": "Acme Prefs Follow-up", "tpl-blast": "Acme Announcement", "tpl-quiet": "Acme Quiet",
  "tpl-quarter": "Acme Quarterly", "tpl-sporadic": "Acme Sporadic", "tpl-once": "Acme One-time", "tpl-lapsed": "Acme Digest",
  "tpl-ended": "Acme Ended", "tpl-overdue": "Acme Overdue", "tpl-nobody": "Acme Nobody", "tpl-refused": "Acme Refused", "tpl-steperr": "Acme Step Error", "tpl-disabled": "Acme Disabled",
};
// Click behaviour per template (the five R19 fixtures ride on these):
//   content — content-link clicks are recorded
//   unsub   — the only clicks ever recorded are on the unsubscribe link
//   none    — never clicked at all
//   ownsite — the only clicks ever recorded are on the own-site unsubscribe page
//   ownsite-mix — that page, and content links too
const CLICK_MODE = {
  "tpl-welcome": "content", "tpl-promo": "content", "tpl-unlisted": "content", "tpl-gone": "content",
  "tpl-renew": "unsub", "tpl-day7": "none", "tpl-nps": "none", "tpl-renew-b": "none",
  "tpl-prefs": "ownsite", "tpl-prefs-mix": "ownsite-mix", "tpl-blast": "content",
};

const ACCOUNTS = Array.from({ length: 12 }, (_, i) => ({ Gsid: `co-${pad(i + 1)}`, Name: `Acme Customer ${pad(i + 1)}` }));
const INTERNAL_PEOPLE = [
  { id: "pe-int-1", email: `ann@${INTERNAL_DOMAIN}` },
  { id: "pe-int-2", email: `raj@${INTERNAL_DOMAIN}` },
  { id: "pe-int-3", email: `lee@${INTERNAL_DOMAIN}` },
];

// ── Raw error messages (HLT-1) ──────────────────────────────────────────────
// What a mail service writes for a bounce: free text that NAMES the recipient
// and carries ids. Every address and id here is fictional. `kind` is the
// oracle's key: which message a row is, written by the generator that chose it.
// "unknown-user-local" carries an address the email mask cannot see (no dot
// after the @, no digit in it): the category CUTS it where the mask would keep it.
export const BOUNCE_REASONS = [
  { kind: "unknown-user", text: (email, n) => `550 5.1.1 <${email}>: Recipient address rejected: User unknown in virtual mailbox table (ref ${8842100000 + n})` },
  { kind: "policy", text: (email, n) => `smtp;554 5.7.1 Message for ${email} blocked by policy at 203.0.113.${n % 250}, id=4f9a2c1e-0000-4000-8000-${String(100000000000 + n)}` },
  { kind: "mailbox-full", text: () => "452 4.2.2 Mailbox full" },
  { kind: "none", text: () => null },
  { kind: "unknown-user-local", text: (email) => `550 5.1.1 <${email.split("@")[0]}@localhost>: Recipient address rejected: User unknown in virtual mailbox table` },
];
const bounceReason = (n) => BOUNCE_REASONS[n % BOUNCE_REASONS.length];
// FICTIONAL failure categories, in the shape the adapter's table takes (S3b):
// a pattern the server counts with CONTAINS, the label a row keeps instead of
// its text, and the one-sentence definition a page shows. The shipped list in
// engagement-query.mjs is EMPTY until V2 captures the product wordings; this
// list proves the mechanism over the fictional tenant. "Mailbox full" and a
// bounce with no reason are in no category: they are the "Other" rows.
export const FIXTURE_BOUNCE_CATEGORIES = [
  { id: "user-unknown", label: "Recipient address rejected: user unknown", pattern: "User unknown in virtual mailbox table", definition: "The receiving mail server says the address does not exist." },
  { id: "blocked-by-policy", label: "Message blocked by policy", pattern: "blocked by policy", definition: "The receiving mail server refused the message under a policy of its own." },
];
// Which category each bounce kind lands in, written by hand: the oracle's half.
export const FIXTURE_BOUNCE_KIND_CATEGORY = { "unknown-user": "user-unknown", "unknown-user-local": "user-unknown", policy: "blocked-by-policy", "mailbox-full": null, none: null };
// What the product writes for a participant it refused at entry. The first two are the shipped EXPECTED
// wordings (measured 2026-10-07); the others carry a value the mask must take out.
export const FAILURE_REASONS = [
  { kind: "already-in-list", text: () => "Participant already exists in participant list" },
  { kind: "invalid-email", text: (i) => `Email address first.last${i}@c0${(i % 9) + 1}.example.com is invalid` },
  { kind: "unique-criteria", text: () => "Participant with unique criteria already exists" },
  { kind: "no-company", text: (i) => `Participant 1P02ACMEX${String(1000000 + i)}ZQ has no company` },
  // One row carries its reasons as a JSON array of texts.
  { kind: "array", text: () => JSON.stringify(["Missing required field: Email", "Duplicate participant"]) },
];
// The UNEXPECTED refusal (a data problem), as the product writes it.
export const NULL_EMAIL_REASON = "Recipient Email Address field contains Invalid value {null} for EMAIL data type";
const PARTICIPANT_STATES = ["ACTIVE", "COMPLETED", "ACTIVE", "COMPLETED", "DROP", "ACTIVE", "SYSTEM_ERROR", "COMPLETED", "KNOCKED_OFF"];
// When the platform's own errors happened on this tenant: one incident, long before any window the suites pull.
const PLATFORM_INCIDENT = "2025-06-20T03:00:00.000Z";

const wrapClicks = (entries) => `{type=json, value=${JSON.stringify(entries)}, null=true}`;
const LINKS = {
  content: (n) => ({ url: "https://www.example.com/guide/getting-started", clickedCount: 1 + (n % 2), ip: `203.0.113.${n % 250}` }),
  unsub: (n) => ({ url: "https://mail.example.com/unsubscribe?t=abc", clickedCount: 1, ip: `203.0.113.${n % 250}` }),
  mailto: (n) => ({ url: "mailto:cs@acme.com", clickedCount: 1, ip: `203.0.113.${n % 250}` }),
  ownsite: (n) => ({ url: `${OWN_SITE_UNSUBSCRIBE}/topics?u=${n}`, clickedCount: 1, ip: `203.0.113.${n % 250}` }),
  // Content, on the same site: its path only BEGINS like the unsubscribe page's.
  lookalike: (n) => ({ url: `${OWN_SITE_UNSUBSCRIBE}-guide`, clickedCount: 1, ip: `203.0.113.${n % 250}` }),
};
const CONTENT_KINDS = new Set(["content", "lookalike"]);

/**
 * Build the tenant. Variants (all optional) reshape it for one scenario:
 *   cutoff          "YYYY-MM-DD" — sends on or after this day do not exist yet
 *   lateOpens       true — every unopened delivered send before 2026-07 is now opened
 *   token           {state: "valid"|"expired"|"none", seconds}
 *   dropSchemaField {object, field} — the schema (and so the filter) lacks it
 *   noSurveyObject  true — survey_participant has no schema at all
 *   listMax         number — `jo p list` returns at most this many rows a page
 *   serverMax       number — the row cap --page-size -1 resolves to (default 5000)
 *   rawClickJson    true — LinkClickedJson is a plain JSON array, no wrapper
 *   listNoEnvelope  true — `jo p list` repeats its rows on every page and says nothing about paging
 *   noClicksFrom    "YYYY-MM-DD" — no click is recorded on a send from this day on
 *   extraJoRow      true — the JO send log holds one send the delivery log lacks
 *   ownSiteUnsub    true — one more program, whose unsubscribe link is a page on acme's own site
 *   massDay         true — one more program, which sends to sixty accounts on a single day
 *   massMonth       "YYYY-MM" — the month of that day (default 2026-07)
 *   orphanClicks    true — the sends with no company link are clicked on a content link (F-473)
 *   bothFlags       true — some attempts that bounced at send are ALSO flagged rejected (one failure, two flags)
 *   silent          true — two more Active programs: one whose last send is months back, one with no send at all
 *   noHealthObjects true — ao_failed_participants and ao_participants have no schema
 *   cadence         true — four more Active, documented programs for the cadence-aware silent rules (see CADENCE)
 *   manyFailures    number — that many more failed participants on p-onboard, each with a distinct value in its reason
 *   outsiderFailures number — that many refused participants on the DRAFT program (never selected: no sends), all
 *                   refused this month — more than a sample page holds (F-484's class: a tenant-wide page is theirs)
 *   signals         true — six more Active, documented programs, one per health signal (see SIGNALS)
 */
export function buildTenant(variant = {}) {
  const log = [];
  const joLog = [];
  const participants = new Map();
  const surveyRows = [];
  let n = 0;
  const cutoff = variant.cutoff ?? "9999-12-31";

  const send = (program, step, month, { account, person, email, source = JO_SOURCE, addressType = "To", onDay = null }) => {
    n++;
    const day = onDay ?? program.fixedDay ?? pad((n % 27) + 1);
    const executed = `${month}-${day}T10:00:00.000Z`;
    if (executed.slice(0, 10) >= cutoff) return;
    const tpl = step.templateId;
    const sent = n % 11 !== 0;
    const bounced = sent ? n % 37 === 0 : n % 2 === 0;
    const rejected = (!sent && !bounced) || (!!variant.bothFlags && !sent && bounced && n % 4 === 0);
    let opened = sent && n % 3 !== 0;
    if (variant.lateOpens && sent && month < "2026-07") opened = true;
    const mode = CLICK_MODE[tpl] ?? "none";
    let kinds = null;
    if (sent && opened && mode.startsWith("ownsite") && n % 2 === 0) {
      if (mode === "ownsite") kinds = ["ownsite"];
      else kinds = n % 3 === 0 ? ["content", "ownsite"] : n % 3 === 1 ? ["lookalike"] : ["ownsite"];
    } else if (sent && opened && n % 5 === 0 && mode !== "none" && !mode.startsWith("ownsite") && executed.slice(0, 10) < (variant.noClicksFrom ?? "9999-12-31")) {
      if (mode === "unsub") kinds = ["unsub"];
      else if (n % 15 === 0) kinds = ["unsub"];
      else if (n % 25 === 0) kinds = ["mailto"];
      else if (n % 35 === 0) kinds = ["content", "unsub"];
      else kinds = ["content"];
    }
    if (variant.orphanClicks && account == null && sent && opened && (program.id === "p-onboard" || program.id === "p-pilot")) kinds = ["content"];
    const links = kinds && kinds.map((k) => LINKS[k](n));
    const gsid = `log-${String(n).padStart(5, "0")}`;
    const row = {
      Gsid: gsid, Source: source, SourceId: program.id, SourceName: program.name, AddressType: addressType,
      EmailTemplateId: tpl, EmailTemplateName: tpl ? TEMPLATE_NAMES[tpl] : null,
      ExecutedDate: executed, SentDate: sent ? executed : null,
      IsSent: sent ? "YES" : "NO", IsOpened: opened ? "YES" : "NO", IsBounced: bounced ? "YES" : "NO",
      IsRejected: rejected ? "YES" : "NO", IsUnsubscribed: sent && n % 53 === 0 ? "YES" : "NO", IsSpam: sent && n % 97 === 0 ? "YES" : "NO",
      BounceType: bounced ? (n % 3 === 0 ? "SOFT_BOUNCE" : "HARD_BOUNCE") : null,
      BouncedReason: bounced ? bounceReason(n).text(email, n) : null,
      LowerCaseEmailId: email, GsCompanyId: account, GsPersonId: person,
      LinkClickedCount: links ? links.reduce((a, l) => a + l.clickedCount, 0) : 0,
      LinkClickedJson: links ? (variant.rawClickJson ? JSON.stringify(links) : wrapClicks(links)) : null,
      // Oracle-only (underscore keys are invisible to answer()): what the row's
      // clicks ARE, written by the generator that chose them.
      _contentClick: !!kinds && kinds.some((k) => CONTENT_KINDS.has(k)),
      _bounceKind: bounced ? bounceReason(n).kind : null,
    };
    log.push(row);
    if (source !== JO_SOURCE || addressType !== "To") return;
    // The JO send log mirrors each To-row of a JO program, with the step and
    // variant the delivery log lacks. A person re-enters p-onboard every six
    // months, so participant records outnumber people.
    // The step-error program admits its people afresh every month (so its admissions are recent).
    const entry = program.id === "p-onboard" ? Math.floor(program.months.indexOf(month) / 6) : program.stepErrors ? program.months.indexOf(month) : 0;
    const parId = `par-${program.id}-${person}-${entry}`;
    if (!participants.has(parId)) {
      // The state cycles; a one-off program's participants have all finished (p-once: a finished campaign).
      // The lapsed digest keeps people in flight (so it is late, not finished).
      const state = program.id === "p-once" ? "COMPLETED" : program.id === "p-lapsed" ? "ACTIVE" : PARTICIPANT_STATES[participants.size % PARTICIPANT_STATES.length];
      // Admitted (CreatedAt) at the first send; a participant who fell off at a step carries the product's
      // wording and was last touched when it fell (the platform's errors at the one incident; the step-error
      // program's this month). The underscore key is the oracle's.
      const reasons = STEP_REASONS[state] ?? null;
      const reason = reasons ? reasons[program.stepErrors ? 1 % reasons.length : 0] : null;
      const modified = state === "SYSTEM_ERROR" ? (program.stepErrors ? "2026-09-12T03:00:00.000Z" : PLATFORM_INCIDENT) : executed;
      participants.set(parId, { Gsid: parId, AdvancedOutreachId: program.id, ParticipantState: state, ParticipantSourceType: "QUERY_BUILDER", CreatedAt: executed, ModifiedAt: modified, FailureReasons: reason ? reason.text(step.stepName ?? "Step") : null, _stepKind: reason?.kind ?? null });
    }
    const variantId = step.variants[n % step.variants.length];
    joLog.push({
      Gsid: `jo-${String(n).padStart(5, "0")}`, AdvancedOutreachId: program.id, StepId: step.stepId,
      EmailTemplateId: tpl, EmailTemplateVarianceId: variantId, EmailTemplateVarianceName: variantId ? `${variantId} name` : null,
      CreatedAt: executed, EmailSendTime: sent ? executed : null,
      EmailSend: sent, EmailOpened: opened, Bounce: bounced, Rejected: rejected,
      Unsubscribed: row.IsUnsubscribed === "YES", Spam: row.IsSpam === "YES", EmailClicked: !!links,
      AddressType: "To", ToAddress: email, EmailLogId: gsid, GsParticipantId: parId,
    });
    if (program.survey) {
      const responded = sent && n % 4 === 0;
      const partial = responded && n % 12 === 0;
      // One response in three lands the month AFTER the send.
      const respMonth = n % 3 === 0 ? monthsBetween(month, "2099-12")[1] : month;
      surveyRows.push({
        Gsid: `sp-${String(n).padStart(5, "0")}`, AOParticipantId: parId, Responded: responded,
        RespondedDate: responded ? `${respMonth}-${day}T12:00:00.000Z` : null,
        ResponseStatus: responded ? (partial ? "Partially Submitted" : "Submitted") : sent ? "Not Responded" : "Undelivered Or Bounced",
        SurveyOpened: responded || n % 2 === 0,
      });
    }
  };

  const listed = [...PROGRAMS, ...(variant.ownSiteUnsub ? [OWN_SITE] : []), ...(variant.massDay ? [BLAST] : []), ...(variant.silent ? [QUIET, NEVER] : []), ...(variant.cadence ? CADENCE : []), ...(variant.signals ? SIGNALS : [])];
  // A variant's program goes last, so every other send keeps its number.
  for (const program of [...PROGRAMS, UNLISTED, DELETED, ...(variant.ownSiteUnsub ? [OWN_SITE] : []), ...(variant.silent ? [QUIET] : []), ...(variant.cadence ? CADENCE : []), ...(variant.signals ? SIGNALS : [])]) {
    for (const month of program.months) {
      for (const step of program.steps) {
        if (program.internalOnly) {
          for (const p of INTERNAL_PEOPLE) send(program, step, month, { account: null, person: p.id, email: p.email });
          continue;
        }
        for (const a of program.accounts) {
          for (let k = 0; k < program.perAccount; k++) {
            const person = `pe-${pad(a + 1)}-${k}`;
            send(program, step, month, { account: ACCOUNTS[a].Gsid, person, email: `user${k}@c${pad(a + 1)}.example.com` });
          }
        }
        // One internal recipient rides a customer program (the class split),
        // and one send has no company link at all (its own bucket).
        if (program.internalOn != null) send(program, step, month, { account: ACCOUNTS[program.internalOn].Gsid, person: INTERNAL_PEOPLE[0].id, email: INTERNAL_PEOPLE[0].email });
        if (program.id === "p-onboard") send(program, step, month, { account: null, person: "pe-orphan", email: "orphan@nolink.example.org" });
      }
      // CC copies and a non-JO source: both must be left out and counted.
      if (program.id === "p-onboard") {
        send(program, program.steps[0], month, { account: ACCOUNTS[0].Gsid, person: "pe-cc", email: "cc@c01.example.com", addressType: "CC" });
        send({ id: "cockpit-1", name: "Cockpit", months: [] }, { templateId: null, variants: [null] }, month, { account: ACCOUNTS[1].Gsid, person: "pe-02-0", email: "user0@c02.example.com", source: "COCKPIT" });
      }
    }
  }
  if (variant.massDay) {
    for (const [i, a] of BLAST_ACCOUNTS.entries()) send(BLAST, BLAST.steps[0], variant.massMonth ?? "2026-07", { account: a.Gsid, person: `pe-b${pad(i + 1)}`, email: `${BLAST_NAMES[i % BLAST_NAMES.length]}${i}@b${pad(i + 1)}.example.org`, onDay: "14" });
  }
  // A survey response that no JO program owns (another distribution channel).
  surveyRows.push({ Gsid: "sp-other", AOParticipantId: null, Responded: true, RespondedDate: "2026-07-09T12:00:00.000Z", ResponseStatus: "Submitted", SurveyOpened: true });

  // Responses to p-nps from before any window the suites pull: its all-time
  // counts are larger than any window's, as on a program older than the window.
  for (const [i, status] of ["Submitted", "Submitted", "Partially Submitted", null].entries()) {
    const parId = `par-p-nps-early-${i}`;
    participants.set(parId, { Gsid: parId, AdvancedOutreachId: "p-nps", ParticipantState: "COMPLETED", ParticipantSourceType: "QUERY_BUILDER", CreatedAt: `2025-03-0${i + 1}T09:00:00.000Z`, ModifiedAt: `2025-03-1${i}T12:00:00.000Z`, FailureReasons: null, _stepKind: null });
    surveyRows.push({ Gsid: `sp-early-${i}`, AOParticipantId: parId, Responded: status != null, RespondedDate: status ? `2025-03-1${i}T12:00:00.000Z` : null, ResponseStatus: status ?? "Not Responded", SurveyOpened: true });
  }

  // Test participants of p-nps (F-474): three rows the survey figures leave out,
  // one of them a submitted response inside the window.
  for (const [i, status] of ["Submitted", null, null].entries()) {
    const parId = `par-p-nps-test-${i}`;
    participants.set(parId, { Gsid: parId, AdvancedOutreachId: "p-nps", ParticipantState: "COMPLETED", ParticipantSourceType: "QUERY_BUILDER", CreatedAt: "2026-07-15T09:00:00.000Z", ModifiedAt: "2026-07-20T12:00:00.000Z", FailureReasons: null, _stepKind: null });
    surveyRows.push({ Gsid: `sp-test-${i}`, AOParticipantId: parId, Responded: status != null, RespondedDate: status ? "2026-07-20T12:00:00.000Z" : null, ResponseStatus: status ?? "Not Responded", SurveyOpened: true, TestParticipant: true });
  }
  for (const r of surveyRows) if (!("TestParticipant" in r)) r.TestParticipant = false;

  // Participants the programs refused at entry: one row each, with the reason as the product wrote it and
  // the day the same participant was LAST refused (ModifiedAt moves when the key is refused again; measured).
  // p-gone's are a deleted program's and must be left out. The refusals of the window's months are spread
  // over July to September 2026 so the per-month table and the samples' recency have something to read.
  const failedParticipants = [];
  const refusedOn = (i) => `2026-0${7 + (i % 3)}-${pad(1 + (i % 27))}T06:00:00.000Z`;
  for (const [programId, count] of /** @type {Array<[string, number]>} */ ([["p-onboard", 7], ["p-renew", 4], ["p-gone", 2]])) {
    for (let i = 0; i < count; i++) {
      const reason = FAILURE_REASONS[(i + (programId === "p-renew" ? 1 : 0)) % FAILURE_REASONS.length];
      failedParticipants.push({ Gsid: `fp-${programId}-${i}`, AdvancedOutreachId: programId, FailureReasons: reason.text(i), OccurrenceCount: 1 + (i % 3), ModifiedAt: refusedOn(i), _failureKind: reason.kind });
    }
  }
  // The large variant: most failures share one wording with a distinct value in each (F-484's class).
  for (let i = 0; i < (variant.manyFailures ?? 0); i++) {
    failedParticipants.push({ Gsid: `fp-many-${i}`, AdvancedOutreachId: "p-onboard", FailureReasons: FAILURE_REASONS[1].text(1000 + i), OccurrenceCount: 1, ModifiedAt: refusedOn(i), _failureKind: FAILURE_REASONS[1].kind });
  }
  // The outsider (F-484 reopened): the draft program, never selected, refused more participants this month
  // than a sample page holds — a tenant-wide first page would be all theirs.
  for (let i = 0; i < (variant.outsiderFailures ?? 0); i++) {
    failedParticipants.push({ Gsid: `fp-outsider-${i}`, AdvancedOutreachId: "p-draft", FailureReasons: FAILURE_REASONS[0].text(i), OccurrenceCount: 1, ModifiedAt: `2026-09-14T0${i % 10}:00:00.000Z`, _failureKind: FAILURE_REASONS[0].kind });
  }
  // The signals variant's refusals: p-refused's recent ones carry the UNEXPECTED null-email wording beside
  // expected ones; p-nobody's are all expected (and older).
  if (variant.signals) {
    for (let i = 0; i < 12; i++) failedParticipants.push({ Gsid: `fp-refused-${i}`, AdvancedOutreachId: "p-refused", FailureReasons: i % 3 === 0 ? FAILURE_REASONS[0].text(i) : NULL_EMAIL_REASON, OccurrenceCount: 1 + i, ModifiedAt: `2026-09-${pad(2 + i)}T06:00:00.000Z`, _failureKind: i % 3 === 0 ? "already-in-list" : "null-email" });
    for (let i = 0; i < 6; i++) failedParticipants.push({ Gsid: `fp-nobody-${i}`, AdvancedOutreachId: "p-nobody", FailureReasons: FAILURE_REASONS[i % 2 === 0 ? 0 : 2].text(i), OccurrenceCount: 1 + i, ModifiedAt: `2026-09-${pad(2 + i)}T06:00:00.000Z`, _failureKind: FAILURE_REASONS[i % 2 === 0 ? 0 : 2].kind });
  }
  // Each program's participant sources with the time they last synced (the ingest heartbeat; F-491): one
  // active row per documented program, plus one superseded version of p-onboard's that the standing filter
  // must leave out. A program with no `lastSync` has never synced.
  const sourceRows = [];
  const syncOf = (p) => p.lastSync ?? (p.id === "p-onboard" ? "2026-09-14 08:02:11" : p.id === "p-nps" ? "2026-09-01 09:03:40" : p.id === "p-quarter" ? "2026-07-01 09:00:12" : p.id === "p-once" ? "2026-03-01 09:00:00" : p.id === "p-renew" ? "2026-03-02 10:00:00" : null);
  for (const p of listed) {
    if (!p.steps.length) continue;
    sourceRows.push({ Gsid: `psc-${p.id}`, AdvancedOutreachId: p.id, ParticipantSourceType: p.schedules ? "QUERY_BUILDER" : "CSV", LastSyncedOn: syncOf(p), ActiveVersion: true, Deleted: false, ParticipantOperationType: "ADD_ALL_PARTICIPANT_IN_POWER_LIST" });
  }
  sourceRows.push({ Gsid: "psc-p-onboard-v1", AdvancedOutreachId: "p-onboard", ParticipantSourceType: "QUERY_BUILDER", LastSyncedOn: "2025-12-01 08:00:00", ActiveVersion: false, Deleted: false, ParticipantOperationType: "ADD_ALL_PARTICIPANT_IN_POWER_LIST" });

  if (variant.extraJoRow) joLog.push({ ...joLog.find((r) => r.AdvancedOutreachId === "p-onboard" && r.CreatedAt.startsWith("2026-08")), Gsid: "jo-extra", EmailLogId: null });

  // A JSON-path field (JSONSTRING) is declared neither filterable nor groupable, as the real schema declares it (S3b).
  const fields = (names, types = {}) => names.map((fieldName) => {
    const dataType = types[fieldName] ?? "STRING";
    const json = dataType === "JSONSTRING";
    return { fieldName, dataType, meta: { filterable: !json, groupable: !json, aggregatable: true } };
  });
  const schemas = {
    email_log_v2: fields(
      ["Gsid", "Source", "SourceId", "SourceName", "AddressType", "EmailTemplateId", "EmailTemplateName", "ExecutedDate", "SentDate", "IsSent", "IsOpened", "IsBounced", "IsRejected", "IsUnsubscribed", "IsSpam", "BounceType", "BouncedReason", "LowerCaseEmailId", "GsCompanyId", "GsPersonId", "LinkClickedCount", "LinkClickedJson"],
      { Gsid: "GSID", ExecutedDate: "DATETIME", SentDate: "DATETIME", LowerCaseEmailId: "EMAIL", GsCompanyId: "LOOKUP", GsPersonId: "LOOKUP", LinkClickedCount: "NUMBER" }
    ),
    ao_emails: fields(
      ["Gsid", "AdvancedOutreachId", "StepId", "EmailTemplateId", "EmailTemplateVarianceId", "EmailTemplateVarianceName", "CreatedAt", "EmailSendTime", "EmailSend", "EmailOpened", "Bounce", "Rejected", "Unsubscribed", "Spam", "EmailClicked", "AddressType", "ToAddress", "EmailLogId", "GsParticipantId"],
      { Gsid: "GSID", CreatedAt: "DATETIME", EmailSendTime: "DATETIME", EmailSend: "BOOLEAN", EmailOpened: "BOOLEAN", Bounce: "BOOLEAN", Rejected: "BOOLEAN", Unsubscribed: "BOOLEAN", Spam: "BOOLEAN", EmailClicked: "BOOLEAN", EmailLogId: "LOOKUP", GsParticipantId: "LOOKUP" }
    ),
    survey_participant: fields(
      ["Gsid", "AOParticipantId", "Responded", "RespondedDate", "ResponseStatus", "SurveyOpened", "TestParticipant"],
      { Gsid: "GSID", AOParticipantId: "LOOKUP", Responded: "BOOLEAN", RespondedDate: "DATETIME", SurveyOpened: "BOOLEAN", TestParticipant: "BOOLEAN" }
    ),
    company: fields(["Gsid", "Name"], { Gsid: "GSID" }),
    ao_failed_participants: fields(["Gsid", "AdvancedOutreachId", "FailureReasons", "OccurrenceCount", "ModifiedAt"], { Gsid: "GSID", FailureReasons: "JSONSTRING", OccurrenceCount: "NUMBER", ModifiedAt: "DATETIME" }),
    // FailureReasons is a plain STRING here (filterable: CONTAINS works), unlike the refusal object's JSON-path field (measured 2026-10-07).
    ao_participants: fields(["Gsid", "AdvancedOutreachId", "ParticipantState", "ParticipantSourceType", "CreatedAt", "ModifiedAt", "FailureReasons"], { Gsid: "GSID", CreatedAt: "DATETIME", ModifiedAt: "DATETIME" }),
    ao_participant_source_configuration: fields(["Gsid", "AdvancedOutreachId", "ParticipantSourceType", "LastSyncedOn", "ActiveVersion", "Deleted", "ParticipantOperationType"], { Gsid: "GSID", LastSyncedOn: "DATETIME", ActiveVersion: "BOOLEAN", Deleted: "BOOLEAN" }),
  };
  if (variant.noHealthObjects) { delete schemas.ao_failed_participants; delete schemas.ao_participants; delete schemas.ao_participant_source_configuration; }
  if (variant.dropSchemaField) {
    const { object, field } = variant.dropSchemaField;
    schemas[object] = schemas[object].filter((f) => f.fieldName !== field);
  }
  if (variant.noSurveyObject) delete schemas.survey_participant;

  const tables = { email_log_v2: log, ao_emails: joLog, survey_participant: surveyRows, company: variant.massDay ? [...ACCOUNTS, ...BLAST_ACCOUNTS] : ACCOUNTS, ao_participants: [...participants.values()], ao_failed_participants: failedParticipants, ao_participant_source_configuration: sourceRows };
  const byGsid = Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, new Map(rows.map((r) => /** @type {[string, *]} */ ([r.Gsid, r])))]));
  const token = variant.token ?? { state: "valid", seconds: 3200 };
  return {
    variant, tables, schemas, byGsid, token,
    baseUrl: "https://acme.gainsightcloud.com",
    listed,
    describable: new Map([...listed, UNLISTED].map((p) => [p.id, p])),
    serverMax: variant.serverMax ?? 5000,
    listMax: variant.listMax ?? 1000,
  };
}

// What `jo p describe` returns for a program, and what a KB doc embeds: the
// design as an embedded-JSON stepJson whose email action is embedded AGAIN.
export function programPayload(p) {
  const stepJson = p.steps.map((s) => ({
    stepId: s.stepId, stepName: s.stepName ?? null, order: s.order ?? null, stepType: "EMAIL",
    emailActionJson: JSON.stringify({ emailTemplateId: s.templateId, emailTemplateName: s.templateId ? TEMPLATE_NAMES[s.templateId] : null, variantMappings: [] }),
  }));
  return {
    result: true,
    requestId: "00000000-0000-4000-8000-000000000001",
    data: {
      advancedOutreach: {
        advancedOutreachId: p.id, advancedOutreachName: p.name, advancedOutreachModel: p.model, advancedOutreachModelName: p.modelName,
        advancedOutreachType: p.type, advancedOutreachStatus: p.statuses[0], folderId: p.folderId, stepJson: JSON.stringify(stepJson),
        // A schedule sits on the participant source, as embedded JSON; the source carries its last sync too.
        ...(p.schedules ? { participantSourceConfigurations: [{ participantSourceConfigurationId: `psc-${p.id}`, participantSourceType: "QUERY", lastSyncedOn: p.lastSync ? Date.parse(p.lastSync.replace(" ", "T") + "Z") : null, scheduleInfo: JSON.stringify({ schedules: p.schedules }) }] } : {}),
      },
      versions: [],
    },
  };
}
export const listedPrograms = () => PROGRAMS;

// A tenant KB folder, as writeFiles() input: the manifest plus one full program
// doc per listed program that has a design — except p-promo, which the KB has
// no doc for (its template gets no step name), and p-unlisted, which the list
// never showed setup.
export function kbFiles(slug = "acme-prod", variant = {}) {
  const files = {
  };
  const inventory = {};
  for (const p of [...PROGRAMS, ...(variant.cadence ? CADENCE : []), ...(variant.signals ? SIGNALS : [])]) {
    if (!p.steps.length || p.id === "p-promo") continue;
    files[`${slug}/journey/${p.id}.md`] = [
      `# ${p.name}`, "",
      "> Full describe doc — generated by describe-batch.mjs, captured 2026-01-15T00:00:00.000Z.", "",
      `- key: journey/${p.id}`, `- id: ${p.id}`, `- name: ${p.name}`, "",
      "```json", JSON.stringify(programPayload(p), null, 2), "```", "",
    ].join("\n");
    // When the doc was last checked against the tenant: what a schedule result read from it is "as of".
    inventory[`journey/${p.id}`] = { last_verified: p.id === "p-onboard" ? "2026-09-01T00:00:00.000Z" : "2026-08-20T00:00:00.000Z" };
  }
  files[`${slug}/_manifest.json`] = JSON.stringify({ slug, baseUrl: "https://acme.gainsightcloud.com", environment: "production", created: "2026-01-01T00:00:00.000Z", last_refresh: null, inventory }, null, 2);
  return files;
}

// ── The stand-in CLI ─────────────────────────────────────────────────────────
const REQUEST_ID = "Request ID: 00000000-0000-4000-8000-000000000000";
export const FAULT_TEXT = {
  timeout: `Error: The query has timed out. Reduce data by applying filters.\n${REQUEST_ID}`,
  unfilterable: `Error: Unrecognized data type found in Filter or Ranking fields. Modify the data type to run the report.\n${REQUEST_ID}`,
  "not-found": `Error: Advanced Outreach not found\n${REQUEST_ID}`,
  auth: "Error: Access token has expired. Run `gs-admin login` to re-authenticate.",
  outage: `Error: The communication with the external API could not be established due to a network outage. Try again later. If the issue persists, contact Gainsight Support for further assistance.\n${REQUEST_ID}`,
  generic: `Error: The request could not be processed. Contact Gainsight Support for more information.\n${REQUEST_ID}`,
};
const WARN_TEXT = "[report] normalizeGroupByDedup: removed 1 showField(s) already present in groupByFields.";

const flagValue = (argv, name) => {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
};
const fail = (stderr, status = 1) => ({ status, stdout: "", stderr });
const ok = (payload, stderr = "") => ({ status: 0, stdout: typeof payload === "string" ? payload : JSON.stringify(payload), stderr });

const numCell = (v) => ({ k: v, v, s: "", fv: String(v) });
const monthCell = (iso) => {
  if (iso == null) return { fv: "" };
  const y = iso.slice(0, 4);
  const m = iso.slice(5, 7);
  return { k: `${y}-${m}-01`, v: `${m}-01-${y}`, fv: `${MON[Number(m) - 1]}-${y}` };
};
const dayCell = (iso) => {
  if (iso == null) return { fv: "" };
  const [y, m, d] = [iso.slice(0, 4), iso.slice(5, 7), iso.slice(8, 10)];
  return { k: `${y}-${m}-${d}`, v: `${m}-${d}-${y}`, fv: `${d}-${MON[Number(m) - 1]}-${y}` };
};
const plainCell = (v, type) => {
  if (v == null) return { fv: "" };
  if (type === "NUMBER") return numCell(v);
  if (type === "DATETIME") return { k: v, v, fv: v.slice(0, 10) };
  if (typeof v === "boolean") return { k: v, v, fv: v ? "Yes" : "No" };
  return { v, fv: String(v) };
};

function hopValue(tenant, row, fieldPath) {
  const hop = fieldPath.hops[0];
  const id = row[hop.through];
  if (id == null) return null;
  const target = tenant.byGsid[hop.to]?.get(id);
  if (target) return target[fieldPath.leaf] ?? null;
  // A lookup target this fixture does not materialise (person): its Gsid is
  // the id the row carries.
  return fieldPath.leaf === "Gsid" ? id : null;
}

function evalCond(row, c, types) {
  const name = c?.leftOperand?.fieldName;
  if (!types.has(name)) return true; // unknown field: the condition is silently dropped
  const x = row[name];
  const val = c?.rightOperand?.value;
  const day = (v) => String(v).slice(0, 10);
  switch (c.operator) {
    case "EQ": return x === val;
    case "NE": return x !== val; // keeps nulls
    case "IN": return Array.isArray(val) && val.includes(x);
    case "NOT_IN": return !(Array.isArray(val) && val.includes(x)); // keeps nulls (measured on the company lookup)
    case "GT": return typeof x === "number" && x > val;
    case "GTE": return x == null ? true : day(x) >= val; // a null date acts as later than any date
    case "LT": return x == null ? false : day(x) < val;
    case "CONTAINS": return typeof x === "string" && x.includes(val);
    case "DOES_NOT_CONTAINS": return !(typeof x === "string" && x.includes(val));
    case "ENDS_WITH": return typeof x === "string" && x.endsWith(val);
    case "IS_NULL": return x == null;
    case "IS_NOT_NULL": return x != null;
    default: throw new Error(`Error: The filter operator cannot be left blank.\n${REQUEST_ID}`);
  }
}

function rpRun(argv, tenant) {
  const object = flagValue(argv, "--object");
  const schema = tenant.schemas[object];
  if (!schema) return fail(FAULT_TEXT.generic);
  const types = new Map(schema.map((f) => [f.fieldName, f.dataType]));
  const limit = flagValue(argv, "--limit");
  if (limit !== undefined && Number(limit) > 2000) return fail(`Error: --limit ${limit} exceeds the server cap of 2000. Reduce --limit to 2000 or lower.`);
  let show, group, where;
  try {
    show = JSON.parse(flagValue(argv, "--show-fields") ?? "[]");
    group = JSON.parse(flagValue(argv, "--group-by") ?? "[]");
    where = JSON.parse(flagValue(argv, "--where-filters") ?? '{"conditions":[]}');
  } catch {
    return fail("Error: whereFilters must be object");
  }
  if (!where || typeof where !== "object" || Array.isArray(where)) return fail("Error: whereFilters must be object");
  // The CLI's request normalizer, before anything is sent: keyed by object and
  // field name alone (a lookup path by its target object and leaf).
  const keyOf = (e) => (e.fieldPath ? `${e.fieldPath.hops[e.fieldPath.hops.length - 1].to}::${e.fieldPath.leaf}` : `${object}::${e.name}`);
  let dedupWarning = "";
  if (group.length) {
    const grouped = new Set(group.map(keyOf));
    const kept = show.filter((e) => !grouped.has(keyOf(e)));
    if (kept.length < show.length) dedupWarning = `[report] normalizeGroupByDedup: removed ${show.length - kept.length} showField(s) already present in groupByFields.`;
    show = kept;
  }
  if (!show.length) return fail(`${dedupWarning ? `${dedupWarning}\n` : ""}Error: Report must have at least one entry in showFields (spec §2.1, EMPTY_SHOW_ME_FIELDS).`);
  // A JSON-typed field can be shown, never grouped by or distinct-counted: the
  // server fails with a text that reads like an outage.
  if ([...group, ...show.filter((e) => e.aggregation === "COUNT_DISTINCT")].some((e) => !e.fieldPath && types.get(e.name) === "JSONSTRING")) return fail(FAULT_TEXT.outage);
  // A condition on a field the schema declares not filterable fails whatever the operator (measured S3b).
  const filterable = new Map(schema.map((f) => [f.fieldName, f.meta?.filterable !== false]));
  if ((where.conditions ?? []).some((c) => filterable.has(c?.leftOperand?.fieldName) && !filterable.get(c.leftOperand.fieldName))) return fail(FAULT_TEXT.unfilterable);
  let rows;
  try {
    rows = tenant.tables[object].filter((r) => (where.conditions ?? []).every((c) => evalCond(r, c, types)));
  } catch (e) {
    return fail(e.message);
  }
  // A lookup path in a group-by or an aggregate is an inner join: a row whose
  // lookup is null is gone from the whole answer.
  for (const e of [...group, ...show.filter((x) => x.aggregation)]) {
    if (e.fieldPath) rows = rows.filter((r) => hopValue(tenant, r, e.fieldPath) != null);
  }

  const groupKeyAndCell = (g, row) => {
    if (g.fieldPath) {
      const hop = g.fieldPath.hops[0];
      const v = hopValue(tenant, row, g.fieldPath);
      return [`${hop.to}_${hop.through}__gr_${g.fieldPath.leaf}`, v == null ? { fv: "" } : { v, fv: String(v) }];
    }
    if (g.summarize === "Month") return [`summarize_month_of_${object}_${g.name}`, monthCell(row[g.name])];
    if (g.summarize === "Day") return [`summarize_day_of_${object}_${g.name}`, dayCell(row[g.name])];
    // Grouping on a LOOKUP resolves to the target's name field, which is empty:
    // no `v`, and every row lands in ONE group.
    if (types.get(g.name) === "LOOKUP") return [`${object}_${g.name}__gr_Name`, { fv: "" }];
    return [`${object}_${g.name}`, plainCell(row[g.name], types.get(g.name) === "NUMBER" ? "NUMBER" : null)];
  };
  const aggregate = (s, members) => {
    if (s.aggregation === "COUNT") return [`count_of_${object}_${s.name}`, numCell(members.length)];
    if (s.aggregation === "SUM") return [`sum_of_${object}_${s.name}`, numCell(members.reduce((x, r) => x + (typeof r[s.name] === "number" ? r[s.name] : 0), 0))];
    if (s.aggregation === "COUNT_DISTINCT") {
      if (s.fieldPath) {
        const hop = s.fieldPath.hops[0];
        const set = new Set(members.map((r) => hopValue(tenant, r, s.fieldPath)).filter((v) => v != null));
        return [`count_distinct_of_${hop.to}_${s.fieldPath.leaf}`, numCell(set.size)];
      }
      if (types.get(s.name) === "LOOKUP") return [`count_distinct_of_${object}_Name`, numCell(members.length ? 1 : 0)];
      return [`count_distinct_of_${object}_${s.name}`, numCell(new Set(members.map((r) => r[s.name]).filter((v) => v != null)).size)];
    }
    throw new Error(`Error: The aggregation function selected is not valid. Supported function is [SUM, MIN, MAX, COUNT, COUNT_DISTINCT, AVG, MEDIAN].\n${REQUEST_ID}`);
  };

  let out;
  try {
    if (group.length || show.every((s) => s.aggregation)) {
      const groups = new Map();
      for (const row of rows) {
        const cells = group.map((g) => groupKeyAndCell(g, row));
        const key = JSON.stringify(cells.map(([, c]) => ("k" in c ? c.k : "v" in c ? c.v : null)));
        if (!groups.has(key)) groups.set(key, { cells, members: [] });
        groups.get(key).members.push(row);
      }
      if (!group.length && !groups.size) groups.set("[]", { cells: [], members: [] });
      out = [...groups.values()].map(({ cells, members }) => Object.fromEntries(/** @type {Array<[string, *]>} */ ([...cells, ...show.map((s) => aggregate(s, members))])));
    } else {
      out = rows.map((row) =>
        Object.fromEntries(show.map((s) => (s.fieldPath ? groupKeyAndCell(s, row) : [`${object}_${s.name}`, plainCell(row[s.name], types.get(s.name))])))
      );
    }
  } catch (e) {
    return fail(e.message);
  }
  // A bounce reason is in `fv` on every row and in `v` on only some of them.
  for (const r of out) {
    const cell = r[`${object}_BouncedReason`];
    if (cell && typeof cell.v === "string" && cell.v.length % 2 === 1) delete cell.v;
  }
  out.reverse(); // rows are not returned in any useful order
  // --order-by sorts by a SHOWN field (measured 2026-10-07 on a DATETIME, DESC); an entry that is not shown fails.
  const orderBy = flagValue(argv, "--order-by");
  if (orderBy !== undefined) {
    let entries;
    try { entries = JSON.parse(orderBy); } catch { return fail("Error: orderBy must be an array"); }
    for (const e of entries) {
      if (![...show, ...group].some((s) => s.name === e.name)) return fail(`Error: orderBy entry ${e.name} must exist in showFields or groupBy (spec §10.14).\n${REQUEST_ID}`);
      const key = `${object}_${e.name}`;
      const val = (r) => r[key]?.k ?? r[key]?.v ?? "";
      out.sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0) * (e.order === "DESC" ? -1 : 1));
    }
  }
  const ps = flagValue(argv, "--page-size");
  const size = ps === undefined ? 50 : Number(ps) === -1 ? tenant.serverMax : Math.min(Number(ps), tenant.serverMax);
  return ok(out.slice(0, size), dedupWarning);
}

/**
 * Answer one invocation. `argv` is everything after the program word.
 * @param {string[]} argv
 * @param {ReturnType<typeof buildTenant>} tenant
 * @returns {{status: number, stdout: string, stderr: string}}
 */
export function answer(argv, tenant) {
  const words = argv.filter((t) => !t.startsWith("-"));
  if (words[0] === "whoami") {
    const t = tenant.token;
    const line = t.state === "valid" ? `Token: valid (expires in ${t.seconds}s)` : t.state === "expired" ? "Token: expired" : "Token: none — run 'gs-admin login'";
    return ok(`Base URL: ${tenant.baseUrl}\nAuth mode: not configured — run 'gs-admin login'\n${line}`);
  }
  if (tenant.token.state !== "valid") return fail(FAULT_TEXT.auth);
  if (words[0] === "rp" && words[1] === "run") return rpRun(argv, tenant);
  if (words[0] === "rp" && words[1] === "schema") {
    const object = flagValue(argv, "--object");
    const fields = tenant.schemas[object];
    return ok(fields ? { data: { objectName: object, fields } } : { data: {} });
  }
  if (words[0] === "jo" && words[1] === "p" && words[2] === "list") {
    const limit = Math.min(Number(flagValue(argv, "--limit") ?? 20), tenant.listMax);
    const page = Number(flagValue(argv, "--page") ?? 1);
    const all = tenant.listed;
    const rows = all.slice((page - 1) * limit, page * limit).map((p) => ({
      advancedOutreachId: p.id, advancedOutreachName: p.name, modified_date: 0, advancedOutreachModelName: p.modelName, folderId: p.folderId,
      advancedOutreachStatus: p.statuses, advancedOutreachType: p.type, advancedOutreachModel: p.model, gsid: `gs-${p.id}`, testrun: false,
      // What the list says of the participant sync (measured 2026-10-07: a boolean on every row).
      participantSyncScheduleDisabled: p.syncDisabled === true,
    }));
    if (tenant.variant.listNoEnvelope) return ok({ result: true, requestId: "r", data: { advancedOutreaches: all.slice(0, limit).map((p) => ({ advancedOutreachId: p.id, advancedOutreachName: p.name, advancedOutreachStatus: p.statuses })) } });
    const totalPages = Math.ceil(all.length / limit);
    return ok({ result: true, requestId: "r", data: { advancedOutreaches: rows, pageNumber: page, limit, lastPage: page >= totalPages, totalPages, totalRecords: all.length } });
  }
  if (words[0] === "jo" && words[1] === "p" && words[2] === "describe") {
    const p = tenant.describable.get(flagValue(argv, "--id"));
    return p ? ok(programPayload(p)) : fail(FAULT_TEXT["not-found"]);
  }
  return fail(`Error: command ${words.join(" ")} is not faked`);
}

/**
 * Fault injection, shared by the spawned fake and the in-process transport.
 * A rule fires on the invocations whose space-joined argv contains `match`
 * (every string of it, when it is a list):
 * the first `skip` pass, the next `times` fail (default 1), the rest pass.
 * `counts` is the caller's state (a plain object the spawned fake persists).
 * @param {Array<{match: string | string[], kind: string, skip?: number, times?: number}>} rules
 * @param {Record<string, number>} counts
 * @param {string[]} argv
 * @returns {{status: number, stdout: string, stderr: string, warn?: boolean} | null}
 */
export function applyFaults(rules, counts, argv) {
  const line = argv.join(" ");
  for (const [i, rule] of rules.entries()) {
    if (![].concat(rule.match).every((m) => line.includes(m))) continue;
    const seen = (counts[i] = (counts[i] ?? 0) + 1);
    const skip = rule.skip ?? 0;
    if (seen <= skip || seen > skip + (rule.times ?? 1)) continue;
    if (rule.kind === "warn") return { status: 0, stdout: "", stderr: WARN_TEXT, warn: true };
    return fail(FAULT_TEXT[rule.kind]);
  }
  return null;
}
