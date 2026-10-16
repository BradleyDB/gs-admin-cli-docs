#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// dashboard-spec.mjs — the dashboard spec (T-11) and its ONE writer (DSH-1).
//
// A dashboard is described once, in a spec file, and rebuilt from it at every
// refresh with no model in the loop: which programs to pull, how to group
// them, which pages exist and what each shows. This script is the only code
// that writes a spec file (a single writer for a durable file): the interview
// that fills a spec, and anything that records into one later, goes through
// its subcommands and never writes the JSON itself.
//
// Files, under the tenant's KB folder:
//   <kb>/dashboards/<slug>/spec.json        the saved spec a refresh reads
//   <kb>/dashboards/<slug>/spec.draft.json  a spec being written or edited
//
// Subcommands (all take --kb <tenant KB folder>; all but `list` take --slug):
//   draft     start a draft (from the defaults, or from the saved spec when
//             one exists) or resume the one in progress; prints what has been
//             answered so far, so an interview continues where it stopped
//   set       --set <path>=<json> (repeatable), --answered <key> (repeatable):
//             change the draft. The WHOLE draft is validated first; a change
//             that makes it invalid is refused, naming the field, and nothing
//             is written
//   validate  every problem, each with the path of its field ([--saved])
//   save      validate the draft, write it as the saved spec, remove the draft
//   show      the spec in words: one line per setting ([--saved])
//   list      the dashboards of this KB, saved and in draft
//   export    --out <file>: the saved spec as one portable file
//   import    --file <file> [--slug <as>] [--replace]: write an exported spec
//             into this KB — refused when it was exported from another tenant
//
// What the code enforces:
//   - A spec is PORTABLE: it holds no path on any machine (validate refuses
//     one, naming the field), so an export is the spec itself in an envelope
//     and an import reproduces it byte for byte.
//   - A spec belongs to ONE tenant (tenantHost, read from the KB's manifest
//     when the draft starts). Import compares it with the target KB's tenant
//     and refuses a mismatch: a production dashboard must never be refreshed
//     from a sandbox by accident.
//   - Every field is DESCRIBED: describeSpec renders each setting as a
//     sentence (a page's About tab is built from it), and validate refuses a
//     field no description covers, so an unknown or misspelt key cannot sit
//     in a spec unseen.
//   - Unknown versions are refused loudly, like a snapshot's.
//
// Citations: DSH-n / PUB-n / NAT-n are work items and Rnn rulings of the
// maintainer's unpublished JO-dashboards plan; the decision each produced is
// stated beside the token.
//
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────

// ── T-11 · dashboard spec (producer-owned contract) ──────────────────────────
/**
 * FROZEN (DSH-1, 2026-10-04). One spec holds every page of a dashboard, so one
 * pull feeds them all.
 *
 * Contract-freeze rule: an ADDITIVE field rides the change that needs it, with
 * this typedef, its description (SPEC_DESCRIPTIONS) and its pin in
 * test/contract-conformance.mjs updated in the same change. Removing or
 * re-typing a field bumps schemaVersion and is never a tuning edit.
 *
 * @typedef {object} T11Source
 * @property {"jo-engagement"} adapter
 * @property {object} params                       what the adapter is run with
 * @property {number} params.windowMonths          months reported, the current one included (13 = the last 12 full months and this one)
 * @property {{sentSince: ?string, names: string[], ids: string[]}} params.selector
 *   which programs: sentSince is a date or a relative span (90d, 3m) and keeps
 *   only programs with a send since then; names and ids name programs. All
 *   empty = every program with a send in the window. Status never limits it (R23).
 * @property {string[]} params.internalDomains     the company's own email domains (R5)
 * @property {string[]} params.unsubscribeLinks    the tenant's own unsubscribe link or host; each a value the adapter accepts
 * @property {string[]} params.testAccounts        account keys counted as test recipients
 * @property {string[]} params.pinnedAccounts      account keys always kept as their own rows (R24)
 * @property {boolean} params.stepDetail           the ONE step-detail switch (R21): step and variant rows, at the cost of a longer pull
 * @property {number} params.repullMonths          months read again by a refresh that continues from an earlier snapshot
 * @property {{kind: "rolling"} | {kind: "fixed", from: string, to: string} | {kind: "since", from: string}} [params.window]
 *   the reporting window's KIND (additive, S5; ruled 2026-10-04): rolling = the last windowMonths months counted
 *   back from each refresh's day (the default, and what an absent field means); fixed = the months from `from` to
 *   `to` (YYYY-MM, inclusive), the same every refresh; since = every month from `from` to the current one ("all time"
 *   from a date). The 36-month cap applies to the rolling kind only; a first pull scales with the months covered
 * @property {number} [params.quietDueDays]        due days an ingest may run admitting nobody before the program is listed as
 *   "Admitting nobody" (additive, S5; F-491 ruling 4, default 5); passed to the adapter as --quiet-due-days
 * @property {number} [params.samplePrograms]      programs a health pull may sample for failure text, most failures first
 *   (additive, S5; F-491 ruling 5, default 25); passed to the adapter as --sample-programs
 * @property {string[]} [params.expectedReasons]   the tenant's own expected participant-failure wordings (additive, S5;
 *   HLT-1 ruling 4): each becomes a category flagged expected, passed to the adapter as --expected-reason
 *
 * @typedef {object} T11GroupRule
 *   One rule fills one level. kind decides the other fields (dashboard-groups.mjs RULE_KINDS):
 *   characteristic {characteristic: model|audience|sendsSurveys|recurring, is, label} ·
 *   folder {folders: [{id, label?}]} · namePattern {match: contains|startsWith|endsWith, text, label}
 *   or {match: segment, delimiter, index} · programField {field, is, label} · manual {programIds, label}
 * @property {"characteristic"|"folder"|"namePattern"|"programField"|"manual"} kind
 * @property {"supergroup"|"group"} level
 * @property {string} [within]                     a group rule only: the supergroup it applies inside
 * @property {string} [label]
 * @property {string} [characteristic]
 * @property {string|boolean} [is]
 * @property {Array<{id: string, label?: string}>} [folders]
 * @property {"contains"|"startsWith"|"endsWith"|"segment"} [match]
 * @property {string} [text]
 * @property {string} [delimiter]
 * @property {number} [index]
 * @property {string} [field]
 * @property {string[]} [programIds]
 *
 * @typedef {object} T11Groups                    two levels: supergroup, then group (R7, R25)
 * @property {T11GroupRule[]} rules                applied in the listed order, each level on its own
 * @property {Object<string, {supergroup?: string, group?: string}>} overrides   per program id; decides before any rule
 *
 * @typedef {object} T11Panel                     a panel is a QUERY for the engine (R2), or one of the typed views (the health four, DSH-4, ruled 2026-10-05; the templates view, TPL-2)
 * @property {string} id
 * @property {"engagement"|"health"|"templates"} tab
 * @property {"kpi"|"bar"|"line"|"table"|"watchlist"|"account"|"health-silent"|"health-reasons"|"health-schedules"|"health-one-time"|"templates"} type
 *   kpi, bar, line, table, watchlist and account take a `query` (the engine's shape, checked per type: a kpi groups by
 *   nothing, a line by month alone, a bar by one dimension, a watchlist by account, an account view (additive, ACC-2:
 *   ONE account the viewer picks, from the accounts the page carries) by program and month); the four health-* types take
 *   `knobs` instead, each type its own few (HEALTH_PANEL_TYPES; additive, S4b; absent or empty takes the
 *   defaults), and sit on the health tab; the templates type (additive, TPL-2) takes `knobs` too
 *   (TEMPLATE_PANEL_TYPES) and sits on the templates tab
 * @property {string} title
 * @property {{groupBy?: string[], metrics: string[], sort?: Array<{metric?: string, dim?: string, label?: string, dir?: "asc"|"desc"}>, having?: Array<{metric: string, gte?: number, gt?: number, lte?: number}>, limit?: number}} [query]
 *   required on a query-typed panel, absent on a knobbed one
 * @property {{days?: number, showExpected?: boolean, staleAfterDays?: number, months?: number, snippet?: number}} [knobs]
 *   a health-typed panel's settings (additive, S4b): health-silent {days: the no-send threshold the page starts on;
 *   default the spec's health.silentDays}, health-reasons {showExpected: expected failures shown from the start;
 *   default false}, health-schedules {staleAfterDays: a schedule documented longer ago than this before the pull is
 *   marked stale; default 45}, health-one-time {months: of send history shown per program; default 6};
 *   a templates panel's (additive, TPL-2): {snippet: the characters of context either side of a search hit; default 50}
 * @property {string[]} [columns]                  the metrics shown at first; a viewer can show or hide any (R1)
 *
 * @typedef {object} T11Page                      one per audience
 * @property {string} id
 * @property {"admin"|"exec"} preset
 * @property {string} title
 * @property {?string[]} statusDefault             the statuses shown at first (R23); null = every status (the admin preset's, ruled 2026-10-05: every program that sent, with its badges)
 * @property {"window"|"closed-months"} [dateDefault]   the months shown at first (additive, S4b; ruled 2026-10-05): the whole window with the current month marked provisional (the admin preset), or the closed months with the current month one click away (the leaders' preset). Absent on a spec written before it existed: the preset's
 * @property {Array<{id: "engagement"|"health"|"templates"|"about", enabled: boolean}>} tabs   all four, in order; About is always on (R26)
 * @property {T11Panel[]} panels                   empty = the preset's panels (PRESETS[preset].panels, filtered to the tabs that are on); a list must give every on tab at least one panel (F-486)
 * @property {boolean} accountNames                whether the page may name accounts (off on an exec page unless opted in)
 * @property {boolean} sourceDetail                whether a definition also shows its object, fields and filters
 * @property {boolean} [templateContent]           whether the page carries template TEXT (subjects, bodies, the keyword search; additive, TPL-2): on by the admin preset, off by the exec preset unless opted in (a leaders' page carries no content by default). Absent on a spec written before it existed: the preset's. The performance rows of the Templates tab draw either way
 *
 * @typedef {object} T11AccountList            one cross-program customer list (additive, S5; DSH-2 ruling 4, 2026-10-05)
 * @property {"most-engaged"|"least-engaged"|"most-bounced"} kind
 * @property {number} n                            how many accounts the list keeps
 * @property {number} floor                        the delivered floor an account needs before it is ranked (most-engaged and
 *   least-engaged; bounces need none); on a program that sends about once per contact the least-engaged signal is
 *   "delivered at least 3 and opened 0" instead, decided by the pull and recorded
 * @property {?string} [per]                       a company field (one of accounts.fields): one list per value, "per segment"
 *
 * @typedef {object} T11Spec
 * @property {1} schemaVersion
 * @property {"dashboard-spec"} kind
 * @property {string} slug
 * @property {string} title
 * @property {?string} owner
 * @property {?string} purpose                     the decision the dashboard supports, in the owner's words
 * @property {string} tenantHost                   the tenant it is refreshed from; import and refresh refuse any other
 * @property {T11Source[]} sources
 * @property {Array<{id: "dateRange"|"programs"|"group"|"status"|"recipientClass", enabled: boolean, default?: string}>} globalFilters
 *   which filters the pages offer; recipientClass carries its starting value (all | external)
 * @property {{pull: boolean, busiest: number, lowEngagement: number, mostBounces: number, lowEngagementMinDelivered: number, lists?: T11AccountList[], fields?: string[]}} accounts
 *   pull maps onto the adapter's own switch; the four numbers are R24's PER-PROGRAM selection (0 = off, the default
 *   since the customer watch list was redesigned around the customer, ruled 2026-10-05) and are unused while pull is
 *   false. lists (additive, S5): the cross-program customer lists as DATA, selected at refresh over the whole window
 *   (the three defaults: 25 most engaged, 25 least engaged, 25 most bounced, each with a delivered floor of 10;
 *   absent = those). fields (additive, S5): the company fields read beside each kept account's name, a tenant's own,
 *   for "per segment" lists; absent = none
 * @property {T11Groups} groups
 * @property {{silentDays: number}} health         an Active program with no send in this many days is silent
 * @property {{redocument: {enabled: boolean, cap: number}}} [kb]   the knowledge base beside the pull (additive, S5;
 *   ruled 2026-10-05): a refresh re-documents the selected programs the KB is behind on (modified since documented, or
 *   never documented) and the email templates it lacks, with no model, up to `cap` per refresh (the rest next time);
 *   enabled false leaves the KB alone and marks what is stale. Absent = enabled, cap 50
 * @property {T11Page[]} pages
 * @property {{maxAgeDays: number}} freshness      a page older than this shows a stale banner
 * @property {{cadence: "weekly"|"monthly"|"quarterly"|"manual", ownerNote: ?string}} refresh
 * @property {T11Publish} publish   where the leaders' copy goes after a refresh (PUB-3, additive in S7: the targets
 *   file-copy and claude-artifact beside none)
 * @property {{reports: Array<{panel: string, reportId: string, name?: string, planHash?: string}>}} native   reports created in
 *   Gainsight from this spec (NAT-2): `panel` is "<page id>/<panel id>"; `planHash` (additive, S8) the fingerprint of
 *   what the report was saved with, so a re-run skips an unchanged panel and updates a changed one
 * @property {import("./dashboard-theme.mjs").Theme} [theme]   the pages' look (additive, UX-1, S4d): brand-facing token
 *   values only — text and surface colours (light, and dark or derived), chart series colours, a system font stack, a
 *   radius, an optional logo as a PNG or JPEG data URI of at most 200 KB — plus the validator's notes on any token it
 *   replaced. Absent means the default theme. The status colours are never part of it. Shape is checked here
 *   (dashboard-theme.mjs themeShapeProblems); contrast and distinguishability by validateTheme at build, which replaces
 *   a failing token with the default's and says so on the About tab
 */
import { existsSync, readdirSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { userInfo } from "node:os";
import { makeCliHelpers, readJsonFile, writeFileAtomicSync, isMainModule, readKbIdentity, cmpKey } from "./doc-lib.mjs";
import { printable } from "./journal-lib.mjs";
import { parseUnsubscribeLink, parseSentSince, ACCOUNT_LIST_KINDS, DEFAULT_ACCOUNT_LISTS } from "./engagement.mjs";
import { METRICS, DIMENSIONS, STATUS_LABELS, statusLabel, SILENT_DAYS_DEFAULT, LIST_KIND_WORDS, listPhrase } from "./engagement-query.mjs";
import { validateGroups, describeRule, UNGROUPED } from "./dashboard-groups.mjs";
import { themeShapeProblems, validateTheme, COLOR_KEYS, LOGO_MAX_BYTES } from "./dashboard-theme.mjs";

export const T11_SCHEMA_VERSION = 1;
export const SPEC_FILE = "spec.json";
export const DRAFT_FILE = "spec.draft.json";
const DASHBOARDS_DIR = "dashboards";

// ── The enums, each value with its meaning (a page's About tab renders them) ─
export const ADAPTERS = Object.freeze({ "jo-engagement": "Journey Orchestrator email engagement, read from the tenant's send log" });
export const FILTERS = Object.freeze({
  dateRange: "Date range: the months shown",
  programs: "Programs: a searchable list of every program in the dashboard",
  group: "Group: the dashboard's own supergroups and groups",
  status: "Status: Active, Paused, Draft or Stopped, as of the last refresh",
  recipientClass: "Recipients: everyone, or external recipients only (the company's own domains and test accounts left out)",
});
export const TABS = Object.freeze({
  engagement: "Engagement: sends, opens, clicks and responses",
  health: "Health: error rates, error messages, silent programs and schedule failures",
  templates: "Templates: each email's performance, content and keyword search",
  about: "About: definitions, how to use the page, this dashboard's settings and where the data came from",
});
/**
 * Where the leaders' copy goes (T-11 `publish`; PUB-3, ruled 2026-10-13 at X1 and 2026-10-14 at S7's kickoff).
 *   - "none": the pages stay in the workspace; config {}.
 *   - "file-copy" (the default): the leaders' page is copied after every successful refresh and rebuild into a
 *     folder, under the same file name every time. config {to, file, datedCopies, datasets}: `to` names a TARGET,
 *     never a folder — the folder is per machine, in the workspace's own settings
 *     (`.gs-superadmin/publish-targets.json`, written by `dashboard.mjs publish-target`), so a spec holds no machine
 *     path and exports cleanly; `file` is a bare file name ending .html; `datedCopies` adds a copy named with the
 *     pull's date beside it (off by default); `datasets` writes the page's tables as CSV files in a data folder
 *     beside it (on by default).
 *   - "claude-artifact": the refresh writes the page in an artifact's content form, and the skill publishes it as a
 *     claude.ai artifact (only Claude can). config {url}: the artifact's link once published (null before), so the
 *     same link is updated each time.
 * @typedef {{target: "none", config: {}} | {target: "file-copy", config: {to: string, file: string, datedCopies: boolean, datasets: boolean}} | {target: "claude-artifact", config: {url: ?string}}} T11Publish
 */
export const PUBLISH_TARGETS = Object.freeze({
  none: "the workspace only",
  "file-copy": "a shared folder, the same file each time",
  "claude-artifact": "a claude.ai artifact link",
});
/** A publish target's NAME (the folder is the machine's): letters, digits, dot, dash, underscore, at most 40. */
export const PUBLISH_TARGET_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;
/** The leaders' copy's file name: bare (no folder), ending .html. */
export const PUBLISH_FILE_RE = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,115}\.html$/;
const ARTIFACT_URL_RE = /^https:\/\/claude\.ai\/(?:code\/)?artifact\/[A-Za-z0-9_-]{6,64}$/;
/**
 * The default publish setting: the shared folder named "leaders", the file named after the dashboard.
 * @param {string} slug @returns {T11Publish}
 */
export const defaultPublish = (slug) => ({ target: /** @type {"file-copy"} */ ("file-copy"), config: { to: "leaders", file: `${slug}-leaders.html`, datedCopies: false, datasets: true } });
export const CADENCES = Object.freeze({ weekly: "every week", monthly: "every month", quarterly: "every quarter", manual: "only when someone asks" });
// How stale a page may be before its banner shows, from the cadence (ruled 2026-10-05, DSH-1 item 3): a typed
// value wins; the entry command's cadence question fills freshness from this unless freshness was answered.
// "manual" never goes stale on its own: the validator's upper bound stands in for never.
export const FRESHNESS_BY_CADENCE = Object.freeze({ weekly: 10, monthly: 45, quarterly: 120, manual: 3660 });
// The health-schedules panel's doc-age mark: a schedule documented more than this many days before the pull is marked (not frozen).
export const SCHEDULE_DOC_AGE_DAYS = 45;
// The reporting window's kinds (ruled 2026-10-04, DSH-1 item 4), each with its meaning.
export const WINDOW_KINDS = Object.freeze({ rolling: "the last N months, counted back from each refresh", fixed: "a fixed start and end month, the same every refresh", since: "every month from a start month to the current one" });
// The cross-program customer lists (DSH-2 ruling 4, 2026-10-05) are the adapter's data (engagement.mjs owns the
// mechanism); the writer re-exports them so the interview and the About tab read one table.
export { ACCOUNT_LIST_KINDS, DEFAULT_ACCOUNT_LISTS };
export const DEFAULT_KB = Object.freeze({ redocument: Object.freeze({ enabled: true, cap: 50 }) });
/** A spec's customer lists (T11Spec.accounts.lists; the defaults on a spec written before they existed). */
export const accountLists = (spec) => (Array.isArray(spec.accounts?.lists) ? spec.accounts.lists : DEFAULT_ACCOUNT_LISTS.map((l) => ({ ...l })));
/** A spec's company fields read beside each kept account's name (T11Spec.accounts.fields; none before they existed). */
export const accountFields = (spec) => (Array.isArray(spec.accounts?.fields) ? spec.accounts.fields : []);
/** A spec's knowledge-base settings (T11Spec.kb; the defaults on a spec written before they existed). */
export const kbSettings = (spec) => ({ redocument: { ...DEFAULT_KB.redocument, ...(spec.kb?.redocument ?? {}) } });
/** A source's window kind (T11Source.params.window; rolling on a spec written before it existed). */
export const windowOf = (params) => params.window ?? { kind: "rolling" };
export const PANEL_TYPES = Object.freeze({
  kpi: "headline figures, each beside the usual and the change against it",
  bar: "a bar chart",
  line: "a monthly trend",
  table: "a table",
  watchlist: "a ranked short list of accounts across programs, with each account's programs underneath",
  account: "one account at a time, picked from the accounts the page carries (with the line for its day-by-day timeline beside it), as a table",
  "health-silent": "program health: every Active program's signals and the one list it lands on, with the no-send threshold adjustable in the page",
  "health-reasons": "why sends and participants fail, by category, each against its usual, with expected failures (business rules working) behind a toggle",
  "health-schedules": "each program's schedule as the knowledge base documents it, with the day it is as of and a stale mark",
  "health-one-time": "one-time and ad-hoc programs with their send history",
  templates: "each email's performance per program and step, its current text, and keyword search over subjects and bodies",
});
export const DATE_DEFAULTS = Object.freeze({ window: "the whole window, with the current month marked provisional", "closed-months": "the closed months, with the current month one click away" });
// The typed health views (DSH-4, ruled 2026-10-05): each type's knobs, how each is checked, its default when the
// panel leaves it out, and the sentence the About tab says for it. A knob a type does not have is refused.
/** @type {Readonly<Object<string, {knobs: Object<string, {kind: "whole"|"boolean", min?: number, max?: number, default: (spec: any) => *, say: (v: *) => string}>}>>} */
export const HEALTH_PANEL_TYPES = Object.freeze({
  "health-silent": { knobs: { days: { kind: "whole", min: 1, max: 366, default: (spec) => spec.health.silentDays, say: (v) => `the no-send threshold starts at ${v} days (14, 30, 60 and 90 are one click away)` } } },
  "health-reasons": { knobs: { showExpected: { kind: "boolean", default: () => false, say: (v) => (v ? "expected failures are shown from the start" : "expected failures are behind a toggle") } } },
  // The doc-age mark's default is its own number (45), not the spec's freshness, which the pages no longer read (ruled 2026-10-12).
  "health-schedules": { knobs: { staleAfterDays: { kind: "whole", min: 1, max: 3660, default: () => SCHEDULE_DOC_AGE_DAYS, say: (v) => `a schedule documented more than ${v} days before the pull is marked stale` } } },
  "health-one-time": { knobs: { months: { kind: "whole", min: 1, max: 36, default: () => 6, say: (v) => `each program's sends over the last ${v} months` } } },
});
// The templates view (TPL-2): the one knobbed type of the templates tab, checked and described like the health four.
/** @type {Readonly<Object<string, {tab: string, knobs: Object<string, {kind: "whole"|"boolean", min?: number, max?: number, default: (spec: any) => *, say: (v: *) => string}>}>>} */
export const TEMPLATE_PANEL_TYPES = Object.freeze({
  templates: { tab: "templates", knobs: { snippet: { kind: "whole", min: 10, max: 300, default: () => 50, say: (v) => `a search hit shows ${v} characters of context either side` } } },
});
// Every knobbed type (a typed view: knobs, no query), with the tab each sits on.
export const KNOBBED_PANEL_TYPES = Object.freeze({ ...Object.fromEntries(Object.entries(HEALTH_PANEL_TYPES).map(([k, v]) => [k, { tab: "health", ...v }])), ...TEMPLATE_PANEL_TYPES });
export const QUERY_PANEL_TYPES = Object.freeze(["kpi", "bar", "line", "table", "watchlist", "account"]);
/** A knobbed panel's knobs (a health view's, the templates view's) with the spec's defaults filled in. */
export const panelKnobs = (spec, panel) => Object.fromEntries(Object.entries(KNOBBED_PANEL_TYPES[panel.type].knobs).map(([k, d]) => [k, panel.knobs?.[k] ?? d.default(spec)]));
// The default panels (DSH-4, Bradley's choice A of 2026-10-09): what a page shows when its spec lists none. The
// health set is one list both presets share; a leaders' page draws it only when its Health tab is turned on.
const HEALTH_PANELS = Object.freeze([
  { id: "send-health", tab: "health", type: "kpi", title: "Send health", query: { metrics: ["errorRate", "bounceRate", "rejectedRate", "unsubscribeRate", "spamRate"] } },
  { id: "program-health", tab: "health", type: "health-silent", title: "Program health", knobs: {} },
  { id: "failure-reasons", tab: "health", type: "health-reasons", title: "Why sends and participants fail", knobs: {} },
  { id: "schedules", tab: "health", type: "health-schedules", title: "Schedules", knobs: {} },
  { id: "one-time", tab: "health", type: "health-one-time", title: "One-time and ad-hoc programs", knobs: { months: 6 } },
  { id: "error-rate", tab: "health", type: "table", title: "Error rate by program", query: { groupBy: ["program"], metrics: ["sent", "failed", "errorRate", "bounced", "bounceRate", "rejected", "rejectedRate", "unsubscribed", "unsubscribeRate", "spamComplaints", "spamRate"], sort: [{ metric: "errorRate", dir: "desc" }], having: [{ metric: "sent", gte: 1 }] }, columns: ["sent", "failed", "errorRate", "bounceRate", "rejectedRate", "unsubscribeRate", "spamRate"] },
]);
// A customer list's panel: its id is the list's kind, and the page shows the pull's ranking of that list (the selection
// record's kept accounts, n, floor and segments; F-530). The query's sort orders a re-ranking under a narrowing filter;
// its having and limit apply only to a watch list that names no customer list.
/** A cross-program watch list whose id names a customer list's kind (the presets' three): it shows that list (F-530). */
export const isListPanel = (p) => p.type === "watchlist" && (p.query?.groupBy ?? []).join() === "account" && Object.hasOwn(ACCOUNT_LIST_KINDS, p.id);
const ACCOUNT_LIST = (id, title, sort, having) => ({ id, tab: "engagement", type: "watchlist", title, query: { groupBy: ["account"], metrics: ["delivered", "opened", "openRate", "bounced"], sort: [sort], having: [having], limit: 25 } });
// The Templates tab's one panel (TPL-2), on both presets; a leaders' page draws it only when its Templates tab is turned on.
const TEMPLATES_PANEL = /** @type {T11Panel} */ (Object.freeze({ id: "templates", tab: "templates", type: "templates", title: "Emails: text and search", knobs: {} }));
// A preset is what a new page of that audience starts as; every value can be changed afterwards.
export const PRESETS = Object.freeze({
  admin: {
    meaning: "for the people who run the programs: every tab, per-program and per-email detail, account names",
    page: { statusDefault: null, dateDefault: "window", tabs: { engagement: true, health: true, templates: true, about: true }, accountNames: true, sourceDetail: true, templateContent: true },
    panels: Object.freeze([
      { id: "headline", tab: "engagement", type: "kpi", title: "This period", query: { metrics: ["sent", "delivered", "opened", "openRate", "clickRate"] } },
      { id: "open-rate-trend", tab: "engagement", type: "line", title: "Open rate by month", query: { groupBy: ["month"], metrics: ["openRate", "clickRate"] } },
      { id: "sends-by-month", tab: "engagement", type: "bar", title: "Sends by month", query: { groupBy: ["month"], metrics: ["sent", "delivered", "opened"] } },
      { id: "programs", tab: "engagement", type: "table", title: "Programs", query: { groupBy: ["program"], metrics: ["sent", "uniqueRecipients", "accountsReached", "delivered", "opened", "openRate", "clicked", "clickRate", "bounced", "failed", "errorRate"], sort: [{ metric: "sent", dir: "desc" }] }, columns: ["sent", "uniqueRecipients", "delivered", "opened", "openRate"] },
      { id: "emails", tab: "engagement", type: "table", title: "Emails", query: { groupBy: ["program", "template"], metrics: ["sent", "delivered", "opened", "openRate", "clickRate"], sort: [{ metric: "sent", dir: "desc" }] } },
      { id: "steps", tab: "engagement", type: "table", title: "Steps", query: { groupBy: ["program", "step", "variant"], metrics: ["sent", "delivered", "opened", "openRate", "clickRate"], sort: [{ metric: "sent", dir: "desc" }] } },
      { id: "survey-responses", tab: "engagement", type: "table", title: "Survey responses", query: { groupBy: ["program"], metrics: ["surveyParticipants", "submitted", "partiallySubmitted", "anyResponse", "responseRate"], having: [{ metric: "anyResponse", gte: 0 }], sort: [{ metric: "responseRate", dir: "desc" }] } },
      // The parentheticals dropped from the three titles (ruled 2026-10-11, D0 choice 2).
      ACCOUNT_LIST("most-engaged", LIST_KIND_WORDS["most-engaged"].title, { metric: "openRate", dir: "desc" }, { metric: "delivered", gte: 10 }),
      ACCOUNT_LIST("least-engaged", LIST_KIND_WORDS["least-engaged"].title, { metric: "openRate", dir: "asc" }, { metric: "delivered", gte: 10 }),
      ACCOUNT_LIST("most-bounced", LIST_KIND_WORDS["most-bounced"].title, { metric: "bounced", dir: "desc" }, { metric: "bounced", gt: 0 }),
      ...HEALTH_PANELS,
      TEMPLATES_PANEL,
      // The in-page account view (ACC-2), drawn on the Engagement tab after the customer lists (a tab draws its panels in
      // this order): an account the lists kept, month by month, with no pull; its days are the account timeline's, a
      // pull of its own whose line the view carries. Last in the list, so every earlier panel keeps its place.
      { id: "account-view", tab: "engagement", type: "account", title: "One account, month by month", query: { groupBy: ["program", "month"], metrics: ["sent", "delivered", "opened", "openRate", "bounced"] } },
    ]),
  },
  exec: {
    meaning: "for leaders who read the numbers: Engagement and About, every status, no account names",
    page: { statusDefault: null, dateDefault: "closed-months", tabs: { engagement: true, health: false, templates: false, about: true }, accountNames: false, sourceDetail: false, templateContent: false },
    panels: Object.freeze([
      { id: "headline", tab: "engagement", type: "kpi", title: "Headline", query: { metrics: ["sent", "delivered", "openRate", "clickRate"] } },
      { id: "open-rate-trend", tab: "engagement", type: "line", title: "Open rate by month", query: { groupBy: ["month"], metrics: ["openRate", "clickRate"] } },
      { id: "sends-by-month", tab: "engagement", type: "bar", title: "Sends by month", query: { groupBy: ["month"], metrics: ["sent", "delivered", "opened"] } },
      { id: "by-group", tab: "engagement", type: "table", title: "By group", query: { groupBy: ["supergroup", "group"], metrics: ["sent", "delivered", "openRate"], sort: [{ metric: "sent", dir: "desc" }] } },
      { id: "top-open-rate", tab: "engagement", type: "table", title: "Top programs by open rate", query: { groupBy: ["program"], metrics: ["sent", "openRate"], having: [{ metric: "sent", gte: 10 }], sort: [{ metric: "openRate", dir: "desc" }], limit: 10 } },
      { id: "lowest-open-rate", tab: "engagement", type: "table", title: "Lowest open rates", query: { groupBy: ["program"], metrics: ["sent", "openRate"], having: [{ metric: "sent", gte: 10 }], sort: [{ metric: "openRate", dir: "asc" }], limit: 10 } },
      ...HEALTH_PANELS,
      TEMPLATES_PANEL,
    ]),
  },
});
/**
 * The panels a page draws: its own, or the preset's filtered to the tabs that are on.
 * @param {T11Page} page
 * @returns {T11Panel[]}
 */
export function presetPanels(page) {
  if (page.panels.length) return page.panels;
  const on = new Set(page.tabs.filter((t) => t.enabled).map((t) => String(t.id)));
  return /** @type {T11Panel[]} */ (PRESETS[page.preset].panels.filter((p) => on.has(p.tab)));
}
/** A page's starting months (T11Page.dateDefault; the preset's on a spec written before the field existed). */
export const pageDateDefault = (page) => page.dateDefault ?? PRESETS[page.preset].page.dateDefault;
/** Whether a page carries template text (T11Page.templateContent; the preset's on a spec written before the field existed). */
export const pageTemplateContent = (page) => page.templateContent ?? PRESETS[page.preset].page.templateContent;
const STATUSES = Object.keys(STATUS_LABELS);
const METRIC_IDS = METRICS.map((m) => m.id);
const metricLabel = (id) => METRICS.find((m) => m.id === id)?.label ?? id;
const isRateMetric = (id) => { const m = METRICS.find((x) => x.id === id); return !!m && (m.kind === "rate" || m.status === "rate"); };

const pageOf = (id, preset, title) => {
  const p = PRESETS[preset].page;
  return { id, preset, title, statusDefault: p.statusDefault ? [...p.statusDefault] : null, dateDefault: p.dateDefault, tabs: Object.keys(TABS).map((tab) => ({ id: tab, enabled: p.tabs[tab] })), panels: [], accountNames: p.accountNames, sourceDetail: p.sourceDetail, templateContent: p.templateContent };
};
/**
 * A new spec: every tunable at its default, one admin and one exec page.
 * @param {{slug: string, title?: ?string, owner?: ?string, tenantHost: string}} args
 * @returns {T11Spec}
 */
export function defaultSpec({ slug, title = null, owner = null, tenantHost }) {
  return {
    schemaVersion: T11_SCHEMA_VERSION,
    kind: "dashboard-spec",
    slug,
    title: title ?? slug,
    owner,
    purpose: null,
    tenantHost,
    sources: [{ adapter: "jo-engagement", params: { windowMonths: 13, window: { kind: "rolling" }, selector: { sentSince: null, names: [], ids: [] }, internalDomains: [], unsubscribeLinks: [], testAccounts: [], pinnedAccounts: [], stepDetail: false, repullMonths: 2, quietDueDays: 5, samplePrograms: 25, expectedReasons: [] } }],
    globalFilters: [{ id: "dateRange", enabled: true }, { id: "programs", enabled: true }, { id: "group", enabled: true }, { id: "status", enabled: true }, { id: "recipientClass", enabled: true, default: "all" }],
    // The per-program numbers are OFF (0) by default since the watch list was redesigned around the customer (ruled
    // 2026-10-05); the three cross-program lists are the default selection.
    accounts: { pull: false, busiest: 0, lowEngagement: 0, mostBounces: 0, lowEngagementMinDelivered: 10, lists: DEFAULT_ACCOUNT_LISTS.map((l) => ({ ...l })), fields: [] },
    groups: { rules: [], overrides: {} },
    health: { silentDays: SILENT_DAYS_DEFAULT },
    kb: { redocument: { ...DEFAULT_KB.redocument } },
    pages: /** @type {T11Page[]} */ (/** @type {unknown} */ ([pageOf("admin", "admin", "Admin"), pageOf("exec", "exec", "Leadership")])),
    freshness: { maxAgeDays: FRESHNESS_BY_CADENCE.monthly },
    refresh: { cadence: "monthly", ownerNote: null },
    publish: defaultPublish(slug),
    native: { reports: [] },
  };
}

// ── Every setting, in words ──────────────────────────────────────────────────
// One entry per setting: the normalized paths it covers (list indexes read
// `[]`, keyed maps `{}`), its label, and the sentence that states its value.
// describeSpec renders a spec through this table and validate refuses any
// field no entry covers, so a field cannot exist without a description.
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const listed = (xs, none) => (xs.length ? xs.join(", ") : none);
const each = (spec, path) => path(spec) ?? [];
/**
 * One panel in words, exactly: its type's meaning, and a health-typed panel's
 * knobs as the sentences HEALTH_PANEL_TYPES gives them (the About tab renders
 * this; a knob can never sit in a spec without its sentence).
 * @param {T11Spec} spec @param {T11Panel} panel
 */
export function describePanel(spec, panel) {
  const head = `"${panel.title}" on the ${panel.tab} tab: ${PANEL_TYPES[panel.type] ?? panel.type}`;
  if (panel.type in KNOBBED_PANEL_TYPES) {
    const knobs = panelKnobs(spec, panel);
    return `${head}; ${Object.entries(KNOBBED_PANEL_TYPES[panel.type].knobs).map(([k, d]) => d.say(knobs[k])).join("; ")}.`;
  }
  const q = panel.query ?? { metrics: [] };
  // A customer list's panel shows the list the pull ranked (F-530): it is described by the spec's lists of its kind,
  // which every build ranks to, never by the preset query's limit (reopened at B-V: "the top 25" beside a list of 5).
  if (isListPanel(panel)) {
    const lists = accountLists(spec).filter((l) => l.kind === panel.id);
    return `${head} of ${listed(q.metrics.map(metricLabel), "nothing")}: ${lists.length ? `${lists.map(listPhrase).join("; ")}, as the pull ranked ${lists.length === 1 ? "it" : "them"}` : `no ${LIST_KIND_WORDS[panel.id].words} list is kept (the customer lists name the lists the pull ranks)`}.`;
  }
  const by = q.groupBy?.length ? ` by ${q.groupBy.join(" and ")}` : "";
  // The sort's direction names the end of the ranking a limit keeps (F-508): "the 10 lowest by Open rate" is not "the top 10".
  const top = q.limit != null ? `, the ${q.sort?.[0]?.dir === "asc" ? `${q.limit} lowest` : `top ${q.limit}`}${q.sort?.[0]?.metric ? ` by ${metricLabel(q.sort[0].metric)}` : ""}` : "";
  return `${head} of ${listed(q.metrics.map(metricLabel), "nothing")}${by}${top}.`;
}
/** @type {ReadonlyArray<{covers: string[], label: string, say: (spec: any) => string[]}>} */
export const SPEC_DESCRIPTIONS = Object.freeze([
  { covers: ["schemaVersion", "kind", "slug"], label: "Dashboard", say: (s) => [`"${s.slug}", a dashboard spec of version ${s.schemaVersion}.`] },
  { covers: ["title"], label: "Title", say: (s) => [s.title] },
  { covers: ["owner"], label: "Owner", say: (s) => [s.owner ?? "No owner is named."] },
  { covers: ["purpose"], label: "Purpose", say: (s) => [s.purpose ?? "No purpose is recorded."] },
  { covers: ["tenantHost"], label: "Tenant", say: (s) => [`Refreshed from ${s.tenantHost}, and from no other tenant.`] },
  { covers: ["sources[].adapter"], label: "Data source", say: (s) => each(s, (x) => x.sources).map((src) => ADAPTERS[src.adapter] ?? String(src.adapter)).map((t) => `${t}.`) },
  {
    covers: ["sources[].params.selector.sentSince", "sources[].params.selector.names[]", "sources[].params.selector.ids[]"], label: "Programs",
    say: (s) => each(s, (x) => x.sources).map(({ params: p }) => {
      const sel = p.selector;
      const parts = [];
      if (sel.sentSince) parts.push(`programs that have sent since ${/^\d+[dm]$/.test(sel.sentSince) ? `${sel.sentSince.slice(0, -1)} ${sel.sentSince.endsWith("d") ? "days" : "months"} before each refresh` : sel.sentSince}`);
      if (sel.names.length || sel.ids.length) parts.push(`${plural(sel.names.length + sel.ids.length, "named program")}`);
      return `${parts.length ? `Only ${parts.join(", among ")}.` : "Every program with a send in the window."} A program's status never limits what is pulled; the status filter decides what shows.`;
    }),
  },
  {
    covers: ["sources[].params.windowMonths", "sources[].params.window.kind", "sources[].params.window.from", "sources[].params.window.to"], label: "Window",
    say: (s) => each(s, (x) => x.sources).map(({ params: p }) => {
      const w = windowOf(p);
      const span = w.kind === "fixed" ? `The months from ${w.from} to ${w.to}, the same every refresh.` : w.kind === "since" ? `Every month from ${w.from} to the current one.` : `The last ${plural(p.windowMonths, "month")}, the current one included.`;
      return `${span} The current month is provisional: opens keep arriving.`;
    }),
  },
  {
    covers: ["sources[].params.quietDueDays", "sources[].params.samplePrograms", "sources[].params.expectedReasons[]"], label: "Failure settings",
    say: (s) => each(s, (x) => x.sources).map(({ params: p }) => `A program whose ingest has run ${plural(p.quietDueDays ?? 5, "due day")} admitting nobody is listed as "Admitting nobody". A health pull samples failure text for at most ${plural(p.samplePrograms ?? 25, "program")}, most failures first. ${(p.expectedReasons ?? []).length ? `${plural(p.expectedReasons.length, "failure wording")} named as expected by design: ${p.expectedReasons.join("; ")}.` : "No failure wording of the tenant's own is named as expected."}`),
  },
  { covers: ["sources[].params.internalDomains[]"], label: "Internal recipients", say: (s) => each(s, (x) => x.sources).map(({ params: p }) => (p.internalDomains.length ? `Addresses at ${p.internalDomains.join(", ")} are internal.` : "No internal domain is named, so every recipient counts as external.")) },
  { covers: ["sources[].params.unsubscribeLinks[]"], label: "Unsubscribe link", say: (s) => each(s, (x) => x.sources).map(({ params: p }) => (p.unsubscribeLinks.length ? `Clicks on ${p.unsubscribeLinks.join(", ")} are unsubscribe clicks, not content clicks.` : "No unsubscribe link of the tenant's own is named; only the usual unsubscribe wordings are left out of click figures.")) },
  { covers: ["sources[].params.testAccounts[]", "sources[].params.pinnedAccounts[]"], label: "Named accounts", say: (s) => each(s, (x) => x.sources).map(({ params: p }) => `${plural(p.testAccounts.length, "test account")} and ${plural(p.pinnedAccounts.length, "pinned account")}. Named accounts are always kept as their own rows when accounts are pulled.`) },
  { covers: ["sources[].params.stepDetail"], label: "Step detail", say: (s) => each(s, (x) => x.sources).map(({ params: p }) => (p.stepDetail ? "On: every table can be read per step and per variant, and participant records are counted. Each refresh takes longer for it." : "Off: emails are reported per template, with the step's name where a template sits on one step. Turning it on adds step, variant and participant-record figures and makes each refresh longer.")) },
  { covers: ["sources[].params.repullMonths"], label: "Months read again", say: (s) => each(s, (x) => x.sources).map(({ params: p }) => `A refresh reads the last ${plural(p.repullMonths, "month")} again and keeps earlier months as they were last read.`) },
  { covers: ["globalFilters[].id", "globalFilters[].enabled", "globalFilters[].default"], label: "Filters", say: (s) => each(s, (x) => x.globalFilters).map((f) => `${FILTERS[f.id] ?? f.id}${f.enabled ? "" : " (not offered)"}${f.default ? `; starts on ${f.default === "external" ? "external recipients only" : "everyone"}` : ""}.`) },
  {
    covers: ["accounts.pull", "accounts.busiest", "accounts.lowEngagement", "accounts.mostBounces", "accounts.lowEngagementMinDelivered", "accounts.lists[]", "accounts.fields[]"], label: "Accounts",
    say: (s) => {
      const lists = accountLists(s).map(listPhrase);
      const perProgram = s.accounts.busiest + s.accounts.lowEngagement + s.accounts.mostBounces > 0
        ? ` Per program as well: the ${s.accounts.busiest} busiest accounts, the ${s.accounts.lowEngagement} lowest open rates among accounts with at least ${s.accounts.lowEngagementMinDelivered} delivered, and the ${s.accounts.mostBounces} with the most bounces.`
        : "";
      const fields = accountFields(s).length ? ` Each kept account also carries its ${accountFields(s).join(", ")}.` : "";
      return [
        s.accounts.pull
          ? `Customer lists are on: across programs over the whole window, ${listed(lists, "no list")}; every kept account has its own rows on every program it is on.${perProgram}${fields} Every other account is in one "all other accounts" row per program, so totals stay exact.`
          : `Customer lists are off: the dashboard shows how each program is doing and how many accounts each reached, not which customers are not opening or are bouncing. Turning them on adds ${listed(lists, "no list")} across programs${perProgram ? ", and the per-program lists" : ""}, and makes a pull take several times longer; the refresh that adds them reads every table again.`,
      ];
    },
  },
  {
    covers: ["groups.rules[]", "groups.overrides{}"], label: "Groups",
    say: (s) => [
      ...s.groups.rules.map((r, i) => `${i + 1}. ${describeRule(r)}`),
      `${plural(Object.keys(s.groups.overrides).length, "program")} placed by hand, ahead of any rule.`,
      `Rules apply in the order listed, supergroups first. A program no rule reaches is in "${UNGROUPED}".`,
    ],
  },
  { covers: ["health.silentDays"], label: "Silent programs", say: (s) => [`An Active program with no send in ${plural(s.health.silentDays, "day")} is listed as silent.`] },
  {
    covers: ["kb.redocument.enabled", "kb.redocument.cap"], label: "Knowledge base",
    say: (s) => [kbSettings(s).redocument.enabled
      ? `Each refresh re-documents the programs the knowledge base is behind on (modified since documented, or never documented) and fetches the email templates it lacks, up to ${plural(kbSettings(s).redocument.cap, "asset")} per refresh; the rest wait for the next one. What is still behind is marked on the page.`
      : "A refresh leaves the knowledge base alone; programs it is behind on are marked on the page."],
  },
  {
    covers: ["pages[].id", "pages[].preset", "pages[].title", "pages[].statusDefault", "pages[].statusDefault[]", "pages[].dateDefault", "pages[].tabs[].id", "pages[].tabs[].enabled", "pages[].panels[]", "pages[].accountNames", "pages[].sourceDetail", "pages[].templateContent"], label: "Pages",
    say: (s) => each(s, (x) => x.pages).flatMap((p) => [
      `"${p.title}" (${p.id}): ${PRESETS[p.preset]?.meaning ?? p.preset}. Tabs: ${listed(p.tabs.filter((t) => t.enabled).map((t) => t.id), "none")}. ` +
      `Shows ${p.statusDefault ? `${p.statusDefault.map(statusLabel).join(" and ")} programs` : "programs of every status"} at first; the others are one click away. ` +
      `Starts on ${DATE_DEFAULTS[pageDateDefault(p)] ?? pageDateDefault(p)}. ` +
      `${p.panels.length ? plural(p.panels.length, "panel") : `No panel of its own: the ${p.preset} preset's ${plural(presetPanels(p).length, "panel")}`}. Account names ${p.accountNames ? "may show" : "never show"}; definitions ${p.sourceDetail ? "show" : "do not show"} the object, fields and filters behind each number; ` +
      `template text (subjects, bodies, the keyword search) ${pageTemplateContent(p) ? "is on the page" : "is not on the page"}.`,
      ...presetPanels(p).map((pn) => `  ${describePanel(s, pn)}`),
    ]),
  },
  // Kept in the contract, read by nothing (ruled 2026-10-12, F-511 ruling 11): refreshes are manual, and the pages say
  // when the data was pulled instead of showing a staleness banner. The About tab does not list these two.
  { covers: ["freshness.maxAgeDays"], label: "Freshness", say: (s) => [`${plural(s.freshness.maxAgeDays, "day")}; not read by the pages, which say when their data was pulled instead.`] },
  { covers: ["refresh.cadence", "refresh.ownerNote"], label: "Refresh", say: (s) => [`${CADENCES[s.refresh.cadence] ?? s.refresh.cadence}; not read: refreshes are run by hand, whenever new numbers are wanted.${s.refresh.ownerNote ? ` ${s.refresh.ownerNote}` : ""}`] },
  {
    covers: ["publish.target", "publish.config", "publish.config.to", "publish.config.file", "publish.config.datedCopies", "publish.config.datasets", "publish.config.url"], label: "Publishing",
    say: (s) => {
      const c = /** @type {any} */ (s.publish.config);
      if (s.publish.target === "file-copy") return [`After every refresh and rebuild the leaders' page is copied, as ${c.file} (the same file each time), into the shared folder this machine names "${c.to}".${c.datedCopies ? " A copy named with the pull's date is kept beside it." : ""}${c.datasets ? " Its tables go beside it as CSV files, with a definitions file." : ""}`];
      if (s.publish.target === "claude-artifact") return [`The leaders' page is published as a claude.ai artifact after a refresh, by Claude in a session${c.url ? `, at ${c.url}` : "; not yet published"}; a target no longer offered, since the session must read the whole page first.`];
      return ["Not published anywhere: the pages are files in the workspace."];
    },
  },
  { covers: ["native.reports[]"], label: "Gainsight reports", say: (s) => [`${plural(s.native.reports.length, "report")} created in Gainsight from this dashboard.`] },
  // The look (UX-1, additive): what the theme sets and what the validator replaced, in words; the About tab shows it.
  {
    covers: ["theme.colors." + COLOR_KEYS.join(",theme.colors."), "theme.dark." + COLOR_KEYS.join(",theme.dark."), "theme.series[]", "theme.seriesDark[]", "theme.font", "theme.radius", "theme.logo", "theme.notes[]"].flatMap((c) => c.split(",")), label: "Look",
    say: (s) => {
      if (!s.theme) return ["The default look: neutral text and surfaces, the standard chart colours, the system font."];
      const t = s.theme;
      const { notes, derivedDark } = validateTheme(t);
      const set = [t.colors && `${plural(Object.keys(t.colors).length, "colour")} set for light`, t.dark ? `${plural(Object.keys(t.dark).length, "colour")} set for dark` : derivedDark && t.colors ? "dark derived from the light colours" : null, t.series && `${plural(t.series.length, "chart colour")}`, t.font && `the font stack "${t.font}"`, t.radius != null && `a ${t.radius}px corner radius`, t.logo && "a logo"].filter(Boolean);
      return [
        `A brand theme: ${set.length ? set.join(", ") : "nothing set"}; every token it leaves out takes the default.`,
        ...(notes.length ? [`${plural(notes.length, "token")} replaced by the default because it would not read: ${notes.map((n) => `${n.token} (${n.reason})`).join("; ")}.`] : ["Every token it sets passed the readability checks."]),
        ...(Array.isArray(t.notes) && t.notes.length ? [`${plural(t.notes.length, "note")} recorded when the theme was stored.`] : []),
      ];
    },
  },
]);
// `x[]` in a table covers the whole item, whatever it holds; `x{}` every keyed entry.
const COVERED = SPEC_DESCRIPTIONS.flatMap((d) => d.covers);
const WHOLE = COVERED.filter((c) => /(\[\]|\{\})$/.test(c));
const isCovered = (path) => COVERED.includes(path) || WHOLE.some((w) => path === w || path.startsWith(`${w}.`) || path.startsWith(`${w}[`));
// An EMPTY list or object holds no leaf of its own: it is a field when a description covers something inside it.
const isCoveredContainer = (path) => COVERED.some((c) => c === path || c.startsWith(`${path}.`) || c.startsWith(`${path}[`));
const KEYED = new Set(["groups.overrides"]);
// Every leaf of a value → its normalized path and its real one.
function leaves(value, norm = "", real = "", out = []) {
  if (Array.isArray(value)) {
    if (!value.length) out.push({ norm: `${norm}[]`, real, empty: true });
    value.forEach((v, i) => leaves(v, `${norm}[]`, `${real}[${i}]`, out));
  } else if (value && typeof value === "object") {
    const keyed = KEYED.has(norm);
    if (!Object.keys(value).length) out.push({ norm: keyed ? `${norm}{}` : norm, real, empty: true });
    for (const [k, v] of Object.entries(value)) leaves(v, keyed ? `${norm}{}` : norm ? `${norm}.${k}` : k, real ? `${real}.${k}` : k, out);
  } else out.push({ norm, real, empty: false });
  return out;
}
/**
 * The spec in words: one entry per setting, each a label and its sentences.
 * A page's About tab renders "this dashboard's configuration" from this, so a
 * spec someone edits shows up there at the next build.
 * @param {T11Spec} spec a VALID spec
 * @returns {Array<{label: string, covers: string[], text: string[]}>}
 */
export const describeSpec = (spec) => SPEC_DESCRIPTIONS.map((d) => ({ label: d.label, covers: d.covers, text: d.say(spec) }));

// ── Validation ───────────────────────────────────────────────────────────────
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const isText = (v) => typeof v === "string" && v.trim() !== "";
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
const HOST_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
// A tenant's host as a URL gives it: the same, with a port when the address carries one.
const TENANT_HOST_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d{1,5})?$/;
// A value that is a path on some machine: a drive letter, a UNC share, a home or system directory, a file URL.
const MACHINE_PATH_RE = /^(?:[A-Za-z]:[\\/]|\\\\[^\\]|~[\\/]|\/(?:Users|home|root|var|tmp|mnt|opt|etc|private|Volumes)\/|file:\/\/)/;
/**
 * Every problem of a spec, each with the path of the field it is about, and
 * notes: things that are valid and worth saying (a setting with no effect).
 * @param {unknown} input
 * @returns {{problems: Array<{path: string, problem: string}>, notes: string[]}}
 */
export function validateSpec(input) {
  const problems = [];
  const notes = [];
  const bad = (path, problem) => { problems.push({ path, problem }); };
  const s = /** @type {any} */ (input);
  if (!isObj(s)) return { problems: [{ path: "", problem: "a dashboard spec must be a JSON object (T-11)" }], notes };
  if (s.schemaVersion !== T11_SCHEMA_VERSION) return { problems: [{ path: "schemaVersion", problem: `is ${JSON.stringify(s.schemaVersion)}, not ${T11_SCHEMA_VERSION} — refusing to read it (T-11); update the plugin, or write the spec again with this version` }], notes };
  if (s.kind !== "dashboard-spec") bad("kind", `must be "dashboard-spec"`);

  // Shape first: a field no description covers is not a field of the spec.
  for (const leaf of leaves(s)) if (!isCovered(leaf.norm) && !(leaf.empty && isCoveredContainer(leaf.norm))) bad(leaf.real, "is not a field of the dashboard spec (T-11): nothing describes it, so no page could say what it does");
  // Portable: no string anywhere is a path on a machine.
  const scan = (v, path) => {
    if (typeof v === "string") { if (MACHINE_PATH_RE.test(v.trim())) bad(path, "holds a path on this machine; a spec must be portable (an export carries it to another)"); }
    else if (Array.isArray(v)) v.forEach((x, i) => scan(x, `${path}[${i}]`));
    else if (isObj(v)) for (const [k, x] of Object.entries(v)) scan(x, path ? `${path}.${k}` : k);
  };
  scan(s, "");

  const text = (v, path, { nullable = false, max = 200 } = {}) => {
    if (v == null && nullable) return;
    if (!isText(v)) bad(path, nullable ? "must be text, or null" : "must be text");
    else if (v.length > max) bad(path, `must be at most ${max} characters`);
  };
  const whole = (v, path, min, max = Number.MAX_SAFE_INTEGER) => { if (!Number.isInteger(v) || v < min || v > max) bad(path, `must be a whole number from ${min}${max === Number.MAX_SAFE_INTEGER ? "" : ` to ${max}`}`); };
  const bool = (v, path) => { if (typeof v !== "boolean") bad(path, "must be true or false"); };
  const texts = (v, path) => {
    if (!Array.isArray(v)) return bad(path, "must be a list");
    v.forEach((x, i) => { if (!isText(x)) bad(`${path}[${i}]`, "must be text"); });
    if (new Set(v).size !== v.length) bad(path, "lists a value twice");
  };
  const obj = (v, path) => (isObj(v) ? true : (bad(path, "must be an object"), false));

  if (!SLUG_RE.test(String(s.slug ?? ""))) bad("slug", "must be lower-case letters, digits and hyphens, starting with a letter or digit (it names the dashboard's folder)");
  text(s.title, "title", { max: 120 });
  text(s.owner, "owner", { nullable: true });
  text(s.purpose, "purpose", { nullable: true, max: 600 });
  if (!TENANT_HOST_RE.test(String(s.tenantHost ?? ""))) bad("tenantHost", "must be the tenant's host name (acme.gainsightcloud.com), lower case, with no scheme or path");

  if (!Array.isArray(s.sources) || !s.sources.length) bad("sources", "must list at least one source");
  for (const [i, src] of (Array.isArray(s.sources) ? s.sources : []).entries()) {
    const at = `sources[${i}]`;
    if (!obj(src, at)) continue;
    if (!(src.adapter in ADAPTERS)) bad(`${at}.adapter`, `must be one of ${Object.keys(ADAPTERS).join(", ")}`);
    const p = src.params;
    if (!obj(p, `${at}.params`)) continue;
    whole(p.windowMonths, `${at}.params.windowMonths`, 1, 36);
    // The window kind (additive): absent is rolling; fixed and since name their months (YYYY-MM) and are not capped.
    if (p.window !== undefined) {
      const w = p.window;
      const wat = `${at}.params.window`;
      if (!isObj(w) || !(w.kind in WINDOW_KINDS)) bad(wat, `must be {kind: rolling} (the last windowMonths months), {kind: fixed, from, to} or {kind: since, from}, each month as YYYY-MM`);
      else {
        const month = (v, path) => { if (typeof v !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) bad(path, "must be a month as YYYY-MM"); };
        const allowed = { rolling: ["kind"], fixed: ["kind", "from", "to"], since: ["kind", "from"] }[w.kind];
        for (const k of Object.keys(w)) if (!allowed.includes(k)) bad(`${wat}.${k}`, `is not a field of a ${w.kind} window (${allowed.join(", ")})`);
        if (w.kind !== "rolling") month(w.from, `${wat}.from`);
        if (w.kind === "fixed") { month(w.to, `${wat}.to`); if (typeof w.from === "string" && typeof w.to === "string" && w.from > w.to) bad(`${wat}.to`, "must not be earlier than from"); }
        if (w.kind === "since" && typeof w.from === "string" && w.from > "2100-12") bad(`${wat}.from`, "must be a month that has started");
      }
    }
    if (p.quietDueDays !== undefined) whole(p.quietDueDays, `${at}.params.quietDueDays`, 1, 3660);
    if (p.samplePrograms !== undefined) whole(p.samplePrograms, `${at}.params.samplePrograms`, 0, 100000);
    if (p.expectedReasons !== undefined) texts(p.expectedReasons, `${at}.params.expectedReasons`);
    if (obj(p.selector, `${at}.params.selector`)) {
      const since = p.selector.sentSince;
      // The adapter's own reading: a date, or a span counted back from each refresh's day.
      if (since != null && (typeof since !== "string" || parseSentSince(since, "2026-01-01") == null)) bad(`${at}.params.selector.sentSince`, "must be a date (YYYY-MM-DD), a day count (90d) or a month count (3m), or null");
      texts(p.selector.names, `${at}.params.selector.names`);
      texts(p.selector.ids, `${at}.params.selector.ids`);
    }
    texts(p.internalDomains, `${at}.params.internalDomains`);
    (Array.isArray(p.internalDomains) ? p.internalDomains : []).forEach((d, j) => { if (isText(d) && !HOST_RE.test(d.trim().toLowerCase().replace(/^@/, ""))) bad(`${at}.params.internalDomains[${j}]`, "must be an email domain (acme.com)"); });
    texts(p.unsubscribeLinks, `${at}.params.unsubscribeLinks`);
    // What the adapter would refuse is refused here, before a refresh meets it.
    (Array.isArray(p.unsubscribeLinks) ? p.unsubscribeLinks : []).forEach((l, j) => { if (isText(l) && parseUnsubscribeLink(l) == null) bad(`${at}.params.unsubscribeLinks[${j}]`, "must be a link or a host (https://www.example.com/page, or links.example.net): it names no web host"); });
    texts(p.testAccounts, `${at}.params.testAccounts`);
    texts(p.pinnedAccounts, `${at}.params.pinnedAccounts`);
    bool(p.stepDetail, `${at}.params.stepDetail`);
    whole(p.repullMonths, `${at}.params.repullMonths`, 1, 36);
  }

  if (!Array.isArray(s.globalFilters)) bad("globalFilters", "must be a list");
  else {
    const seen = new Set();
    for (const [i, f] of s.globalFilters.entries()) {
      const at = `globalFilters[${i}]`;
      if (!obj(f, at)) continue;
      if (!(f.id in FILTERS)) bad(`${at}.id`, `must be one of ${Object.keys(FILTERS).join(", ")}`);
      else if (seen.has(f.id)) bad(`${at}.id`, "is listed twice");
      seen.add(f.id);
      bool(f.enabled, `${at}.enabled`);
      if (f.id === "recipientClass" ? !["all", "external"].includes(f.default) : "default" in f) bad(`${at}.default`, f.id === "recipientClass" ? "must be all or external: what the recipients filter starts on" : "is only for the recipients filter");
    }
  }

  if (obj(s.accounts, "accounts")) {
    bool(s.accounts.pull, "accounts.pull");
    for (const k of ["busiest", "lowEngagement", "mostBounces", "lowEngagementMinDelivered"]) whole(s.accounts[k], `accounts.${k}`, 0, 500);
    // The cross-program lists (additive): each a kind, a size, a delivered floor and, for a per-segment list, one of the
    // company fields the spec names; absent takes the defaults.
    const fields = Array.isArray(s.accounts.fields) ? s.accounts.fields : [];
    if (s.accounts.fields !== undefined) {
      texts(s.accounts.fields, "accounts.fields");
      fields.forEach((f, i) => { if (isText(f) && !/^[A-Za-z][A-Za-z0-9_]*$/.test(f)) bad(`accounts.fields[${i}]`, "must be a company field's API name (letters, digits, underscores)"); });
    }
    if (s.accounts.lists !== undefined) {
      if (!Array.isArray(s.accounts.lists)) bad("accounts.lists", "must be a list of customer lists {kind, n, floor, per?} (an empty one keeps no cross-program list)");
      else s.accounts.lists.forEach((l, i) => {
        const lat = `accounts.lists[${i}]`;
        if (!obj(l, lat)) return;
        for (const k of Object.keys(l)) if (!["kind", "n", "floor", "per"].includes(k)) bad(`${lat}.${k}`, "is not a field of a customer list (kind, n, floor, per)");
        if (!(l.kind in ACCOUNT_LIST_KINDS)) bad(`${lat}.kind`, `must be one of ${Object.keys(ACCOUNT_LIST_KINDS).join(", ")}`);
        whole(l.n, `${lat}.n`, 1, 500);
        whole(l.floor, `${lat}.floor`, 0, 100000);
        if (l.per != null && (!isText(l.per) || !fields.includes(l.per))) bad(`${lat}.per`, "must name one of accounts.fields (the company field the list is split by), or be absent");
      });
    }
    if (s.accounts.pull === false) notes.push("accounts.pull is false: the account-selection numbers and the customer lists are kept and unused until customer lists are turned on.");
  }
  problems.push(...validateGroups(s.groups));
  if (obj(s.health, "health")) whole(s.health.silentDays, "health.silentDays", 1, 366);
  // The knowledge base beside the pull (additive): absent is on with a cap of 50.
  if (s.kb !== undefined && obj(s.kb, "kb")) {
    for (const k of Object.keys(s.kb)) if (k !== "redocument") bad(`kb.${k}`, "is not a field of kb (redocument)");
    if (obj(s.kb.redocument, "kb.redocument")) {
      for (const k of Object.keys(s.kb.redocument)) if (!["enabled", "cap"].includes(k)) bad(`kb.redocument.${k}`, "is not a field of kb.redocument (enabled, cap)");
      bool(s.kb.redocument.enabled, "kb.redocument.enabled");
      whole(s.kb.redocument.cap, "kb.redocument.cap", 0, 100000);
    }
  }

  if (!Array.isArray(s.pages) || !s.pages.length) bad("pages", "must list at least one page");
  const pageIds = new Set();
  for (const [i, pg] of (Array.isArray(s.pages) ? s.pages : []).entries()) {
    const at = `pages[${i}]`;
    if (!obj(pg, at)) continue;
    if (!SLUG_RE.test(String(pg.id ?? ""))) bad(`${at}.id`, "must be lower-case letters, digits and hyphens (it names the page's file)");
    else if (pageIds.has(pg.id)) bad(`${at}.id`, "is used by two pages");
    pageIds.add(pg.id);
    if (!(pg.preset in PRESETS)) bad(`${at}.preset`, `must be one of ${Object.keys(PRESETS).join(", ")}`);
    text(pg.title, `${at}.title`, { max: 120 });
    if (pg.statusDefault !== null) {
      if (!Array.isArray(pg.statusDefault) || !pg.statusDefault.length) bad(`${at}.statusDefault`, "must be a list of statuses, or null for every status");
      else pg.statusDefault.forEach((st, j) => { if (!STATUSES.includes(st)) bad(`${at}.statusDefault[${j}]`, `must be one of ${STATUSES.join(", ")}`); });
    }
    if (pg.dateDefault != null && !(pg.dateDefault in DATE_DEFAULTS)) bad(`${at}.dateDefault`, `must be one of ${Object.keys(DATE_DEFAULTS).join(", ")}: the months a page starts on`);
    const tabs = Array.isArray(pg.tabs) ? pg.tabs : [];
    if (tabs.map((t) => t?.id).join() !== Object.keys(TABS).join()) bad(`${at}.tabs`, `must list the four tabs once each, in order: ${Object.keys(TABS).join(", ")} (turn one off with enabled: false)`);
    tabs.forEach((t, j) => { if (isObj(t)) bool(t.enabled, `${at}.tabs[${j}].enabled`); });
    const on = new Set(tabs.filter((t) => t?.enabled === true).map((t) => t.id));
    if (tabs.length && !on.has("about")) bad(`${at}.tabs`, "the About tab cannot be turned off: every page carries its own definitions and settings");
    if (tabs.length && on.size < 2) bad(`${at}.tabs`, "a page needs at least one tab besides About");
    bool(pg.accountNames, `${at}.accountNames`);
    bool(pg.sourceDetail, `${at}.sourceDetail`);
    // Additive (TPL-2): absent takes the preset's; present, a switch.
    if (pg.templateContent !== undefined) bool(pg.templateContent, `${at}.templateContent`);
    if (!Array.isArray(pg.panels)) { bad(`${at}.panels`, "must be a list (an empty one takes the preset's panels)"); continue; }
    const panelIds = new Set();
    for (const [j, pn] of pg.panels.entries()) {
      const pat = `${at}.panels[${j}]`;
      if (!obj(pn, pat)) continue;
      for (const k of Object.keys(pn)) if (!["id", "tab", "type", "title", "query", "columns", "knobs"].includes(k)) bad(`${pat}.${k}`, "is not a field of a panel (id, tab, type, title, query, columns, knobs)");
      if (!SLUG_RE.test(String(pn.id ?? ""))) bad(`${pat}.id`, "must be lower-case letters, digits and hyphens");
      else if (panelIds.has(pn.id)) bad(`${pat}.id`, "is used by two panels of this page");
      panelIds.add(pn.id);
      if (!["engagement", "health", "templates"].includes(pn.tab)) bad(`${pat}.tab`, "must be engagement, health or templates");
      else if (!on.has(pn.tab)) bad(`${pat}.tab`, `is the ${pn.tab} tab, which this page has turned off`);
      if (!(pn.type in PANEL_TYPES)) { bad(`${pat}.type`, `must be one of ${Object.keys(PANEL_TYPES).join(", ")}`); continue; }
      text(pn.title, `${pat}.title`, { max: 120 });
      // A knobbed panel (a health view; the templates view, TPL-2): its knobs, checked per type, and no query (ruled
      // 2026-10-05: a mistake is caught here, never on the page); each sits on its own tab.
      if (pn.type in KNOBBED_PANEL_TYPES) {
        const own = KNOBBED_PANEL_TYPES[pn.type].tab;
        if (pn.tab !== own) bad(`${pat}.tab`, `must be ${own}: a ${pn.type} panel is ${own === "health" ? "a health view" : "the templates view"}`);
        if ("query" in pn) bad(`${pat}.query`, `is not a field of a ${pn.type} panel: a typed view takes knobs, not a query`);
        if ("columns" in pn) bad(`${pat}.columns`, `is not a field of a ${pn.type} panel`);
        const allowed = KNOBBED_PANEL_TYPES[pn.type].knobs;
        // Absent knobs take the defaults (the typedef marks them optional); null is a mistake, not an absence.
        if (pn.knobs === null) { bad(`${pat}.knobs`, `must be an object (an empty one, or none, takes the defaults: ${Object.keys(allowed).join(", ")})`); continue; }
        if (pn.knobs !== undefined && !obj(pn.knobs, `${pat}.knobs`)) continue;
        for (const [k, v] of Object.entries(pn.knobs ?? {})) {
          const d = allowed[k];
          if (!d) { bad(`${pat}.knobs.${k}`, `is not a knob of a ${pn.type} panel (${Object.keys(allowed).join(", ")})`); continue; }
          if (d.kind === "boolean") bool(v, `${pat}.knobs.${k}`);
          else whole(v, `${pat}.knobs.${k}`, d.min, d.max);
        }
        continue;
      }
      if ("knobs" in pn) bad(`${pat}.knobs`, `is not a field of ${/^[aeiou]/.test(pn.type) ? "an" : "a"} ${pn.type} panel: knobs belong to the typed views (${Object.keys(KNOBBED_PANEL_TYPES).join(", ")})`);
      const q = pn.query;
      if (!obj(q, `${pat}.query`)) continue;
      for (const k of Object.keys(q)) if (!["groupBy", "metrics", "sort", "having", "limit"].includes(k)) bad(`${pat}.query.${k}`, "is not a field of a query (groupBy, metrics, sort, having, limit)");
      const groupBy = q.groupBy ?? [];
      if (!Array.isArray(groupBy)) bad(`${pat}.query.groupBy`, "must be a list of dimensions");
      else {
        groupBy.forEach((d, k) => { if (!DIMENSIONS.includes(d)) bad(`${pat}.query.groupBy[${k}]`, `must be one of ${DIMENSIONS.join(", ")}`); });
        // The shape each chart kind can draw (one axis: a line or bar never mixes a rate with a count).
        if (pn.type === "kpi" && groupBy.length) bad(`${pat}.query.groupBy`, "must be empty on a kpi panel: a headline figure is everything the filters keep, as one row");
        if (pn.type === "line" && groupBy.join() !== "month") bad(`${pat}.query.groupBy`, 'must be ["month"] on a line panel: a monthly trend');
        if (pn.type === "bar" && groupBy.length !== 1) bad(`${pat}.query.groupBy`, "must name exactly one dimension on a bar panel: one bar group per value");
        if (pn.type === "watchlist" && !["account", "program,account"].includes(groupBy.join())) bad(`${pat}.query.groupBy`, 'must be ["account"] (across programs) or ["program", "account"] on a watchlist panel');
        if (pn.type === "account" && !["program,month", "month", "program"].includes(groupBy.join())) bad(`${pat}.query.groupBy`, 'must be ["program", "month"], ["month"] or ["program"] on an account panel: one account is the view, its programs and months the rows');
      }
      const metrics = Array.isArray(q.metrics) ? q.metrics : [];
      if (!metrics.length) bad(`${pat}.query.metrics`, "must list at least one metric");
      metrics.forEach((m, k) => { if (!METRIC_IDS.includes(m)) bad(`${pat}.query.metrics[${k}]`, `is not a metric the engine computes (${METRIC_IDS.join(", ")})`); });
      if ((pn.type === "line" || pn.type === "bar") && metrics.every((m) => METRIC_IDS.includes(m)) && new Set(metrics.map(isRateMetric)).size > 1) bad(`${pat}.query.metrics`, `must be all rates or all counts on a ${pn.type} panel: one axis, never two`);
      (Array.isArray(q.sort) ? q.sort : q.sort == null ? [] : (bad(`${pat}.query.sort`, "must be a list"), [])).forEach((x, k) => {
        if (!isObj(x) || (x.metric && !metrics.includes(x.metric)) || (x.dim && !groupBy.includes(x.dim)) || (x.dir && !["asc", "desc"].includes(x.dir))) bad(`${pat}.query.sort[${k}]`, "must sort by a metric the query computes, a dimension it groups by, or a label field, asc or desc");
      });
      (Array.isArray(q.having) ? q.having : q.having == null ? [] : (bad(`${pat}.query.having`, "must be a list"), [])).forEach((x, k) => {
        if (!isObj(x) || !metrics.includes(x.metric) || !["gte", "gt", "lte"].some((op) => typeof x[op] === "number")) bad(`${pat}.query.having[${k}]`, "must name a metric the query computes and a number to compare it with (gte, gt or lte)");
      });
      if (q.limit != null) whole(q.limit, `${pat}.query.limit`, 1, 5000);
      if (pn.columns != null) {
        if (!Array.isArray(pn.columns)) bad(`${pat}.columns`, "must be a list of the query's metrics");
        else pn.columns.forEach((c, k) => { if (!metrics.includes(c)) bad(`${pat}.columns[${k}]`, "must be one of the panel's own metrics"); });
      }
    }
    // F-486: a tab that is on draws its panels and nothing else, so a list that leaves an on tab empty is refused
    // (Templates included since TPL-2 gave it its panel type).
    if (pg.panels.length) for (const tab of ["engagement", "health", "templates"]) if (on.has(tab) && !pg.panels.some((p) => p?.tab === tab)) bad(`${at}.panels`, `lists no panel for the ${tab} tab, which is on: list one, or leave the list empty to take the preset's panels`);
  }

  if (obj(s.freshness, "freshness")) whole(s.freshness.maxAgeDays, "freshness.maxAgeDays", 1, 3660);
  if (obj(s.refresh, "refresh")) {
    if (!(s.refresh.cadence in CADENCES)) bad("refresh.cadence", `must be one of ${Object.keys(CADENCES).join(", ")}`);
    text(s.refresh.ownerNote, "refresh.ownerNote", { nullable: true, max: 600 });
  }
  if (obj(s.publish, "publish")) {
    const t = s.publish.target;
    const c = s.publish.config;
    const exactly = (keys) => isObj(c) && Object.keys(c).length === keys.length && keys.every((k) => Object.hasOwn(c, k));
    if (!(t in PUBLISH_TARGETS)) bad("publish.target", `must be one of ${Object.keys(PUBLISH_TARGETS).join(", ")}`);
    else if (t === "none") { if (!isObj(c) || Object.keys(c).length) bad("publish.config", "must be an empty object while the target is none"); }
    else if (t === "file-copy") {
      if (!exactly(["to", "file", "datedCopies", "datasets"])) bad("publish.config", "must be {to, file, datedCopies, datasets} for a file-copy target");
      else {
        if (typeof c.to !== "string" || !PUBLISH_TARGET_NAME_RE.test(c.to)) bad("publish.config.to", "must be a target's NAME (letters, digits, dot, dash or underscore, at most 40), never a folder: the folder is set on each machine with dashboard.mjs publish-target <name> <folder>");
        if (typeof c.file !== "string" || !PUBLISH_FILE_RE.test(c.file)) bad("publish.config.file", "must be a bare file name ending .html (no folder): the folder is the target's");
        if (typeof c.datedCopies !== "boolean") bad("publish.config.datedCopies", "must be true or false");
        if (typeof c.datasets !== "boolean") bad("publish.config.datasets", "must be true or false");
      }
    } else if (t === "claude-artifact") {
      if (!exactly(["url"])) bad("publish.config", "must be {url} for a claude-artifact target (url null until the first publish)");
      else if (c.url !== null && (typeof c.url !== "string" || !ARTIFACT_URL_RE.test(c.url))) bad("publish.config.url", "must be null or a claude.ai artifact link (https://claude.ai/artifact/<id>)");
    }
  }
  if (obj(s.native, "native")) {
    if (!Array.isArray(s.native.reports)) bad("native.reports", "must be a list");
    else s.native.reports.forEach((r, i) => { if (!isObj(r) || !isText(r.panel) || !isText(r.reportId) || Object.keys(r).some((k) => !["panel", "reportId", "name", "planHash"].includes(k)) || (r.name !== undefined && !isText(r.name)) || (r.planHash !== undefined && !(typeof r.planHash === "string" && /^[0-9a-f]{8}$/.test(r.planHash)))) bad(`native.reports[${i}]`, "must be {panel, reportId, name?, planHash?}: the panel a Gainsight report was created from (\"<page id>/<panel id>\"), the report's id, its name, and the fingerprint of what it was saved with"); });
  }
  // The look (UX-1, additive): absent is the default theme; present, its shape is checked here (a colour as #rrggbb,
  // a font stack, a PNG or JPEG logo under the cap); whether a colour READS is the theme validator's, at build.
  if (s.theme !== undefined) for (const p of themeShapeProblems(s.theme, "theme")) bad(p.path, p.problem);
  if (s.theme?.logo) notes.push(`theme.logo is embedded in every page as it is (at most ${LOGO_MAX_BYTES / 1024} KB before encoding).`);
  // One problem per field is enough to act on.
  const seenPaths = new Set();
  return { problems: problems.filter((p) => !seenPaths.has(p.path) && seenPaths.add(p.path)), notes };
}

/**
 * A parsed spec file → the spec, or a loud refusal.
 * @param {unknown} json
 * @returns {T11Spec}
 */
export function openSpec(json) {
  const { problems } = validateSpec(json);
  if (problems.length) throw new Error(`dashboard spec: ${problems.slice(0, 5).map((p) => `${p.path || "(spec)"} ${p.problem}`).join("; ")}${problems.length > 5 ? `; and ${problems.length - 5} more` : ""}`);
  return /** @type {T11Spec} */ (json);
}

// ── Changing a spec: one path, one JSON value ────────────────────────────────
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
/**
 * Set one field of a spec IN PLACE, by a dotted path with list indexes
 * (`pages.0.title`, `sources.0.params.stepDetail`, `groups.overrides.p-1`).
 * Only what the path names is created: a list index may be at most the list's
 * length (appending); every container before it must exist.
 * @param {*} spec
 * @param {string} path
 * @param {*} value
 */
export function setPath(spec, path, value) {
  const keys = String(path).split(".");
  if (!path || keys.some((k) => k === "" || FORBIDDEN_KEYS.has(k))) throw new Error(`--set ${printable(String(path), 80)}: not a field path (dotted keys and list indexes, like pages.0.title)`);
  let at = spec;
  for (const [i, key] of keys.entries()) {
    const last = i === keys.length - 1;
    if (Array.isArray(at)) {
      const n = Number(key);
      if (!/^\d+$/.test(key) || n > at.length) throw new Error(`--set ${path}: "${keys.slice(0, i).join(".")}" is a list of ${at.length}; "${key}" is not an index into it, or the next one`);
      if (last) at[n] = value;
      else if (at[n] === undefined) throw new Error(`--set ${path}: "${keys.slice(0, i + 1).join(".")}" does not exist yet — set it as a whole first`);
      else at = at[n];
    } else if (at && typeof at === "object") {
      if (last) at[key] = value;
      else if (!Object.hasOwn(at, key) || at[key] == null || typeof at[key] !== "object") throw new Error(`--set ${path}: "${keys.slice(0, i + 1).join(".")}" is not an object or a list — set it as a whole first`);
      else at = at[key];
    } else throw new Error(`--set ${path}: "${keys.slice(0, i).join(".")}" holds a plain value, not fields`);
  }
}

/**
 * Remove one field of a spec IN PLACE, by the same dotted path setPath takes. The containers before it must exist.
 * @param {*} spec @param {string} path
 */
export function unsetPath(spec, path) {
  const keys = String(path).split(".");
  if (!path || keys.some((k) => k === "" || FORBIDDEN_KEYS.has(k))) throw new Error(`--unset ${printable(String(path), 80)}: not a field path (dotted keys and list indexes, like theme)`);
  let at = spec;
  for (const key of keys.slice(0, -1)) {
    if (!at || typeof at !== "object" || !Object.hasOwn(at, key)) throw new Error(`--unset ${path}: "${key}" does not exist`);
    at = at[key];
  }
  const last = keys[keys.length - 1];
  if (Array.isArray(at)) at.splice(Number(last), 1);
  else if (at && typeof at === "object") delete at[last];
  else throw new Error(`--unset ${path}: not a field`);
}

// ── Files: the one writer ────────────────────────────────────────────────────
// Every verb below is a FUNCTION the entry command (dashboard.mjs) imports and
// the CLI at the foot calls: one writer, two front doors, never a spawn.
export const dashboardDir = (kbDir, slug) => join(kbDir, DASHBOARDS_DIR, slug);
const specPath = (kbDir, slug) => join(dashboardDir(kbDir, slug), SPEC_FILE);
const draftPath = (kbDir, slug) => join(dashboardDir(kbDir, slug), DRAFT_FILE);
// Every spec and draft byte on disk is written here, and nowhere else.
const writeSpecFile = (path, value) => writeFileAtomicSync(path, JSON.stringify(value, null, 2) + "\n");
/** The tenant a KB folder belongs to, from its manifest. */
export function kbTenantHost(kbDir) {
  const { baseUrl } = readKbIdentity(kbDir, []);
  try {
    return new URL(String(baseUrl)).host.toLowerCase();
  } catch {
    return null;
  }
}
const EXPORT_KIND = "dashboard-spec-export";
const DRAFT_KIND = "dashboard-spec-draft";
/** A refusal with a message for the person, never a stack: the CLI prints it and exits 1. */
export class SpecRefusal extends Error {}
const refuse = (msg) => { throw new SpecRefusal(msg); };
const problemsText = (problems) => problems.map((p) => `${p.path || "(spec)"} ${p.problem}`).join("; ");
/**
 * Who holds a draft (ruled 2026-10-05, DSH-1 item 8): the name given, else the
 * operating system's user name. A draft records it, and another holder's
 * draft is refused without a take-over.
 * @param {?string} [given]
 */
export function holderName(given = null) {
  if (isText(given)) return given.trim();
  const env = process.env.GS_SUPERADMIN_USER ?? process.env.USERNAME ?? process.env.USER;
  if (isText(env)) return env.trim();
  try {
    return userInfo().username || "unknown";
  } catch {
    return "unknown";
  }
}
/**
 * The spec store of one tenant KB folder: the verbs as functions over the
 * folder's spec and draft files.
 * @param {string} kbDir the tenant's KB folder (the one /gs-superadmin:setup created)
 */
/**
 * The tenant KB folder a saved spec or draft file belongs to (`<kb>/dashboards/<slug>/spec.json` → `<kb>`), or null
 * for a file that does not sit where this writer puts them. The page builder reads the folder's NAME from it for the
 * copy lines (F-503); only this writer knows the layout.
 * @param {string} file
 * @returns {?string}
 */
export function kbDirOfSpecFile(file) {
  const dir = dirname(resolve(file));
  return basename(dirname(dir)) === DASHBOARDS_DIR ? dirname(dirname(dir)) : null;
}
export function specStore(kbDir) {
  const kb = resolve(kbDir);
  if (!existsSync(join(kb, "_manifest.json"))) refuse(`--kb ${kbDir}: no _manifest.json there — pass the tenant's KB folder (the one /gs-superadmin:setup created)`);
  const tenantHost = kbTenantHost(kb);
  if (!tenantHost) refuse(`--kb ${kbDir}: its manifest names no tenant (baseUrl) — a dashboard belongs to one tenant`);
  const read = (path, what) => {
    try {
      return readJsonFile(path);
    } catch (e) {
      return refuse(`${what} at ${path} cannot be read: ${e instanceof Error ? e.message : e}`);
    }
  };
  const checkSlug = (slug) => {
    if (!isText(slug)) refuse("--slug <slug> is required");
    if (!SLUG_RE.test(slug)) refuse(`--slug must be lower-case letters, digits and hyphens (got "${printable(slug, 40)}")`);
    return slug;
  };
  const paths = (slug) => ({ dir: dashboardDir(kb, checkSlug(slug)), saved: specPath(kb, slug), draft: draftPath(kb, slug) });
  const readDraft = (slug) => {
    const { draft } = paths(slug);
    if (!existsSync(draft)) return null;
    const d = read(draft, "the draft");
    if (!isObj(d) || d.kind !== DRAFT_KIND || !isObj(d.spec)) refuse(`the draft at ${draft} is not a dashboard spec draft`);
    return d;
  };
  const readSaved = (slug) => {
    const { saved } = paths(slug);
    return existsSync(saved) ? read(saved, "the saved spec") : null;
  };
  // The holder's claim on a draft: the same holder continues it; another is refused without a take-over, which
  // records whom it was taken from. A draft written before holders existed has none and is open to anyone.
  const claim = (d, by, takeOver) => {
    if (isText(d.by) && isText(by) && d.by !== by) {
      if (!takeOver) refuse(`the draft of "${d.spec.slug}" is held by ${d.by} (last changed ${d.updatedAt}) — pass --take-over to continue it as ${by}, or wait for them`);
      d.takenOverFrom = d.by;
    }
    if (isText(by)) d.by = by;
  };
  // A dashboard's shared-folder copy is its own (F-532): two specs of this KB never publish to one target and file (a
  // copy published over another's, a prune deleting another's data files). The other saved dashboard a spec's publish
  // file would share, or null; the file compared case-blind (a Windows or macOS folder does not tell the cases apart).
  const publishTargetOf = (spec) => (spec?.publish?.target === "file-copy" && isObj(spec.publish.config) ? `${spec.publish.config.to}|${String(spec.publish.config.file).toLowerCase()}` : null);
  const publishClash = (spec) => {
    const mine = publishTargetOf(spec);
    if (!mine) return null;
    const root = join(kb, DASHBOARDS_DIR);
    const slugs = existsSync(root) ? readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== spec.slug).map((d) => d.name).sort(cmpKey) : [];
    return slugs.find((other) => existsSync(specPath(kb, other)) && publishTargetOf(read(specPath(kb, other), "the spec")) === mine) ?? null;
  };
  const clashText = (spec, other) => `the leaders' copy of "${spec.slug}" would go to the same file as the dashboard "${other}"'s (${spec.publish.config.file} in the target "${spec.publish.config.to}"): each dashboard publishes its own file, so one would overwrite the other's page — give this one another file (publish.config.file, say "${spec.slug}-leaders.html")`;
  const summary = (slug, d) => ({ slug, path: paths(slug).draft, answered: d.answered, title: d.spec.title, by: d.by ?? null, startedAt: d.startedAt, updatedAt: d.updatedAt, ...(d.takenOverFrom ? { takenOverFrom: d.takenOverFrom } : {}) });

  return {
    kbDir: kb,
    tenantHost,
    paths,
    readSaved,
    readDraft,
    /** Every dashboard of this KB, saved and in draft (a draft with its holder and date; ruled 2026-10-04). */
    listDashboards() {
      const root = join(kb, DASHBOARDS_DIR);
      const slugs = existsSync(root) ? readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort(cmpKey) : [];
      return slugs.map((slug) => {
        const saved = existsSync(specPath(kb, slug)) ? read(specPath(kb, slug), "the spec") : null;
        const draft = existsSync(draftPath(kb, slug)) ? read(draftPath(kb, slug), "the draft") : null;
        return {
          // No cadence here (ruled 2026-10-12, F-511 ruling 11; instance 22): refreshes are manual and nothing reads refresh.cadence.
          slug, saved: !!saved, draft: !!draft, title: saved?.title ?? draft?.spec?.title ?? null, pages: Array.isArray(saved?.pages) ? saved.pages.map((p) => p.id) : [],
          draftBy: draft?.by ?? null, draftUpdatedAt: draft?.updatedAt ?? null, draftAnswered: Array.isArray(draft?.answered) ? draft.answered.length : null,
        };
      }).filter((d) => d.saved || d.draft);
    },
    /** Start a draft from the defaults or the saved spec, or resume the one in progress (the same holder, or a take-over). */
    startDraft(slug, { title = null, owner = null, by = null, takeOver = false } = {}) {
      const { draft } = paths(slug);
      const existing = readDraft(slug);
      if (existing) {
        const before = JSON.stringify(existing);
        claim(existing, by, takeOver);
        if (JSON.stringify(existing) !== before) { existing.updatedAt = new Date().toISOString(); writeSpecFile(draft, existing); }
        return { state: "resumed", draft: existing, ...summary(slug, existing) };
      }
      const from = readSaved(slug);
      const now = new Date().toISOString();
      const d = { kind: DRAFT_KIND, spec: from ?? defaultSpec({ slug, title, owner, tenantHost }), answered: [], by: isText(by) ? by : null, startedAt: now, updatedAt: now };
      const { problems } = validateSpec(d.spec);
      // A saved spec this version's validator refuses (a rule tightened since it was saved, F-541) still opens as a
      // draft, with its problems named: the repair runs through the writer — a change may not add a problem (setDraft),
      // and the save is refused while any remains — never through a hand edit of the saved file. The defaults
      // themselves failing is a fault of this version, refused loudly.
      if (problems.length && !from) refuse(`cannot start the draft: ${problemsText(problems)}`);
      writeSpecFile(draft, d);
      return { state: from ? "editing-saved" : "new", draft: d, problems, ...summary(slug, d) };
    },
    /**
     * Change the draft: each set is [path, value]. The WHOLE draft is validated first; a change that makes it
     * invalid is refused, naming the field, and nothing is written.
     * @param {string} slug @param {{sets?: Array<[string, *]>, unset?: string[], answered?: string[], by?: ?string, takeOver?: boolean}} args
     */
    setDraft(slug, { sets = [], unset = [], answered = [], by = null, takeOver = false } = {}) {
      const { draft } = paths(slug);
      const d = readDraft(slug);
      if (!d) refuse(`no draft of "${slug}" — start one with: dashboard-spec.mjs draft --kb <kb> --slug ${slug}`);
      claim(d, by, takeOver);
      if (!sets.length && !unset.length && !answered.length) refuse("nothing to set — pass --set <path>=<json> and/or --answered <key>");
      for (const key of answered) if (!/^[a-z0-9][a-z0-9-]*$/.test(String(key))) refuse(`--answered takes a plain key (lower-case letters, digits, hyphens), got "${printable(String(key), 40)}"`);
      // The problems the draft already has (a saved spec a tightened rule refuses, F-541): a change is held to adding
      // none, not to clearing them all at once — the save is where every problem must be gone.
      const before = new Set(validateSpec(d.spec).problems.map((p) => `${p.path}\u0000${p.problem}`));
      for (const [path, value] of sets) {
        try {
          setPath(d.spec, path, value);
        } catch (e) {
          refuse(e instanceof Error ? e.message : String(e));
        }
      }
      // An optional field removed (the theme back to the default look): only a field that may be absent survives validation.
      for (const path of unset) {
        try {
          unsetPath(d.spec, path);
        } catch (e) {
          refuse(e instanceof Error ? e.message : String(e));
        }
      }
      if (d.spec.slug !== slug) refuse("slug cannot be changed with set: the dashboard's folder is named for it (export it and import it under the new slug)");
      if (d.spec.tenantHost !== tenantHost) refuse(`tenantHost cannot be changed: this KB belongs to ${tenantHost}`);
      // The whole draft, not the touched field: a change is refused when what it leaves is not a valid spec — or, on a
      // draft that already had problems, when it adds one (F-541); what remains is returned as `problems`.
      const { problems, notes } = validateSpec(d.spec);
      const added = problems.filter((p) => !before.has(`${p.path}\u0000${p.problem}`));
      if (added.length) refuse(`not saved — ${problemsText(added)}`);
      // A publish setting set to another dashboard's file is refused here, before the draft is written (F-532).
      const clash = sets.some(([p]) => String(p).startsWith("publish")) ? publishClash(d.spec) : null;
      if (clash) refuse(`not saved — ${clashText(d.spec, clash)}`);
      d.answered = [...new Set([...d.answered, ...answered])];
      d.updatedAt = new Date().toISOString();
      writeSpecFile(draft, d);
      return { set: sets.map(([p]) => p), notes, problems, draft: d, ...summary(slug, d) };
    },
    /** Every problem of the draft (or the saved spec), each with its field; and the notes. */
    validate(slug, { saved = false } = {}) {
      const { saved: savedAt } = paths(slug);
      const useSaved = saved || !readDraft(slug);
      if (useSaved && !existsSync(savedAt)) refuse(`no dashboard "${slug}" here: neither a saved spec nor a draft`);
      const d = useSaved ? null : readDraft(slug);
      const spec = useSaved ? readSaved(slug) : d.spec;
      const { problems, notes } = validateSpec(spec);
      return { which: useSaved ? "saved" : "draft", problems, notes, spec, answered: d ? d.answered : null };
    },
    /** The draft becomes the saved spec (the replaced spec is kept as one previous copy); the draft is removed. */
    save(slug) {
      const { saved, draft } = paths(slug);
      const d = readDraft(slug);
      if (!d) refuse(`no draft of "${slug}" to save`);
      const { problems, notes } = validateSpec(d.spec);
      if (problems.length) refuse(`not saved — ${problemsText(problems)}`);
      const clash = publishClash(d.spec);
      if (clash) refuse(`not saved — ${clashText(d.spec, clash)}`);
      const replaced = existsSync(saved);
      // The replaced spec stays as ONE previous copy (ruled 2026-10-04), so a change can be read back and undone by hand.
      if (replaced) writeSpecFile(`${saved}.previous`, read(saved, "the saved spec"));
      writeSpecFile(saved, d.spec);
      rmSync(draft, { force: true });
      return { path: saved, replaced, notes, pages: d.spec.pages.map((p) => p.id), spec: d.spec };
    },
    /** Remove a draft without saving it. */
    discardDraft(slug) {
      const { draft } = paths(slug);
      const had = existsSync(draft);
      rmSync(draft, { force: true });
      return { discarded: had };
    },
    /** The saved spec as one portable file: the spec in an envelope naming its tenant. A valid spec holds no machine path. */
    exportSpec(slug, outPath) {
      const { saved, draft } = paths(slug);
      if (!existsSync(saved)) refuse(`no saved dashboard "${slug}" to export${existsSync(draft) ? " (a draft exists: save it first)" : ""}`);
      const spec = read(saved, "the saved spec");
      const invalid = validateSpec(spec).problems;
      if (invalid.length) refuse(`the saved spec is not valid, so it is not exported: ${problemsText(invalid)}`);
      const envelope = { kind: EXPORT_KIND, exportVersion: 1, exportedAt: new Date().toISOString(), tenantHost: spec.tenantHost, spec };
      writeSpecFile(resolve(outPath), envelope);
      return { out: resolve(outPath), tenantHost: spec.tenantHost, spec };
    },
    /**
     * Write an exported spec into this KB; refused when it was exported from another tenant (the SPEC's tenant decides).
     * Imported under another slug, the dashboard takes its own publish file (F-532): the exported dashboard's default
     * file name becomes this slug's, and a file another dashboard of this KB publishes to is renamed the same way; the
     * rename is returned (`publishRenamed`) so the import says it. `beforeWrite(spec)` runs after every check and before
     * anything is written (F-540: the snapshot beside the export is checked there, so a refused one writes nothing).
     * @param {{file: *, slug?: ?string, replace?: boolean, beforeWrite?: (spec: *) => void}} args
     */
    importSpec({ file, slug = null, replace = false, beforeWrite = null }) {
      const envelope = typeof file === "string" ? read(resolve(file), "the export") : file;
      if (!isObj(envelope) || envelope.kind !== EXPORT_KIND || !isObj(envelope.spec)) refuse(`${typeof file === "string" ? `--file ${file}` : "the export"}: not a dashboard spec export (its kind is not "${EXPORT_KIND}")`);
      const spec = envelope.spec;
      const exportedSlug = spec.slug;
      if (slug) spec.slug = slug;
      let publishRenamed = null;
      if (spec.publish?.target === "file-copy" && isObj(spec.publish.config)) {
        /** @param {string} s @returns {string} the leaders' file a dashboard of that slug publishes by default */
        const fileOf = (s) => /** @type {*} */ (defaultPublish(s).config).file;
        const own = fileOf(spec.slug);
        const from = spec.publish.config.file;
        const renamedSlug = spec.slug !== exportedSlug && from === fileOf(exportedSlug);
        if (from !== own && (renamedSlug || publishClash(spec))) {
          spec.publish.config.file = own;
          publishRenamed = { from, to: own, why: renamedSlug ? `imported as "${spec.slug}", it publishes its own file, not "${exportedSlug}"'s` : `"${publishClash({ ...spec, publish: { ...spec.publish, config: { ...spec.publish.config, file: from } } })}" of this knowledge base already publishes to that file` };
        }
      }
      const { problems } = validateSpec(spec);
      if (problems.length) refuse(`the exported spec is not valid here: ${problemsText(problems)}`);
      // Before anything is written: a spec is refreshed from ONE tenant.
      if (spec.tenantHost !== tenantHost) refuse(`this dashboard was exported from ${spec.tenantHost}, and this KB belongs to ${tenantHost} — a spec is never imported onto another tenant (its programs, groups and accounts are that tenant's)`);
      const { saved, draft } = paths(spec.slug);
      if (existsSync(draft)) refuse(`a draft of "${spec.slug}" is in progress here — save or delete it first, or import under another --slug`);
      if (existsSync(saved) && !replace) refuse(`a dashboard "${spec.slug}" is already saved here — pass --replace to overwrite it, or --slug <other> to import beside it`);
      const clash = publishClash(spec);
      if (clash) refuse(`not imported — ${clashText(spec, clash)}`);
      if (beforeWrite) beforeWrite(spec);
      if (existsSync(saved)) writeSpecFile(`${saved}.previous`, read(saved, "the saved spec"));
      writeSpecFile(saved, spec);
      return { slug: spec.slug, path: saved, exportedAt: envelope.exportedAt ?? null, spec, publishRenamed };
    },
  };
}

const USAGE =
  "usage: dashboard-spec.mjs <draft|set|validate|save|show|export|import|list> --kb <tenant KB folder> [--slug <slug>] [--by <holder>] [--take-over] " +
  "[draft: --title <t> --owner <o>] [set: --set <path>=<json>... --answered <key>...] [validate|show: --saved] [export: --out <file>] [import: --file <file> [--slug <as>] [--replace]]";

async function main() {
  const [mode, ...argv] = process.argv.slice(2);
  const helpers = makeCliHelpers("dashboard-spec.mjs", argv);
  const { opt, finish } = helpers;
  /** @type {import("./doc-lib.mjs").FailFn} */
  const fail = helpers.fail;
  if (!["draft", "set", "validate", "save", "show", "export", "import", "list"].includes(mode)) fail(USAGE);
  const all = (name) => argv.flatMap((t, i) => (t === name && argv[i + 1] !== undefined ? [argv[i + 1]] : []));
  if (!opt("--kb")) fail(`--kb <tenant KB folder> is required — ${USAGE}`);
  let store;
  try {
    store = specStore(opt("--kb"));
  } catch (e) {
    if (e instanceof SpecRefusal) return fail(e.message);
    throw e;
  }
  const by = holderName(opt("--by") ?? null);
  const takeOver = argv.includes("--take-over");
  try {
    if (mode === "list") await finish({ ok: true, mode, tenantHost: store.tenantHost, dashboards: store.listDashboards() });
    if (mode === "import") {
      if (!opt("--file")) fail(USAGE);
      const r = store.importSpec({ file: opt("--file"), slug: opt("--slug") ?? null, replace: argv.includes("--replace") });
      await finish({ ok: true, mode, slug: r.slug, tenantHost: store.tenantHost, path: r.path, exportedAt: r.exportedAt });
    }
    const slug = opt("--slug");
    if (!slug) fail(`--slug <slug> is required — ${USAGE}`);
    if (mode === "draft") {
      const r = store.startDraft(slug, { title: opt("--title") ?? null, owner: opt("--owner") ?? null, by, takeOver });
      const { draft: _d, ...rest } = r;
      await finish({ ok: true, mode, ...rest });
    }
    if (mode === "set") {
      const sets = all("--set").map((pair) => {
        const cut = pair.indexOf("=");
        if (cut < 1) fail(`--set takes <path>=<json> (got "${printable(pair, 80)}")`);
        let value;
        try {
          value = JSON.parse(pair.slice(cut + 1));
        } catch {
          fail(`--set ${pair.slice(0, cut)}: the value is not JSON — quote text ("Renewals"), and write lists and objects as JSON`);
        }
        return /** @type {[string, *]} */ ([pair.slice(0, cut), value]);
      });
      const r = store.setDraft(slug, { sets, answered: all("--answered"), by, takeOver });
      const { draft: _d, ...rest } = r;
      await finish({ ok: true, mode, ...rest });
    }
    if (["validate", "show"].includes(mode)) {
      const r = store.validate(slug, { saved: argv.includes("--saved") });
      if (mode === "validate") await finish({ ok: !r.problems.length, mode, slug, which: r.which, problems: r.problems, notes: r.notes }, r.problems.length ? 1 : 0);
      if (r.problems.length) fail(`the ${r.which === "saved" ? "saved spec" : "draft"} is not valid: ${problemsText(r.problems)}`);
      await finish({ ok: true, mode, slug, which: r.which, answered: r.answered, settings: describeSpec(r.spec).map((d) => ({ label: d.label, text: d.text })), notes: r.notes });
    }
    if (mode === "save") {
      const r = store.save(slug);
      await finish({ ok: true, mode, slug, path: r.path, replaced: r.replaced, notes: r.notes, pages: r.pages });
    }
    // export
    if (!opt("--out")) fail(USAGE);
    const r = store.exportSpec(slug, opt("--out"));
    await finish({ ok: true, mode, slug, out: r.out, tenantHost: r.tenantHost });
  } catch (e) {
    if (e instanceof SpecRefusal) return fail(e.message);
    throw e;
  }
}

if (isMainModule(import.meta.url)) {
  main().catch((e) => {
    console.error(`dashboard-spec.mjs: ${e?.stack ?? e}`);
    process.exit(1);
  });
}
