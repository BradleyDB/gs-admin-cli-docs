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
 * @typedef {object} T11Panel                     a panel is a QUERY for the engine (R2)
 * @property {string} id
 * @property {"engagement"|"health"|"templates"} tab
 * @property {"kpi"|"bar"|"line"|"table"|"watchlist"} type
 * @property {string} title
 * @property {{groupBy?: string[], metrics: string[], sort?: Array<{metric?: string, dim?: string, label?: string, dir?: "asc"|"desc"}>, having?: Array<{metric: string, gte?: number, gt?: number, lte?: number}>, limit?: number}} query
 * @property {string[]} [columns]                  the metrics shown at first; a viewer can show or hide any (R1)
 *
 * @typedef {object} T11Page                      one per audience
 * @property {string} id
 * @property {"admin"|"exec"} preset
 * @property {string} title
 * @property {?string[]} statusDefault             the statuses shown at first (R23); null = every status
 * @property {Array<{id: "engagement"|"health"|"templates"|"about", enabled: boolean}>} tabs   all four, in order; About is always on (R26)
 * @property {T11Panel[]} panels
 * @property {boolean} accountNames                whether the page may name accounts (off on an exec page unless opted in)
 * @property {boolean} sourceDetail                whether a definition also shows its object, fields and filters
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
 * @property {{pull: boolean, busiest: number, lowEngagement: number, mostBounces: number, lowEngagementMinDelivered: number}} accounts
 *   pull maps onto the adapter's own switch; the four numbers are R24's selection and are unused while pull is false
 * @property {T11Groups} groups
 * @property {{silentDays: number}} health         an Active program with no send in this many days is silent
 * @property {T11Page[]} pages
 * @property {{maxAgeDays: number}} freshness      a page older than this shows a stale banner
 * @property {{cadence: "weekly"|"monthly"|"quarterly"|"manual", ownerNote: ?string}} refresh
 * @property {{target: "none", config: Object<string, never>}} publish   "none" until a publishing path exists
 * @property {{reports: Array<{panel: string, reportId: string, name?: string}>}} native   reports created in Gainsight from this spec
 */
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { makeCliHelpers, readJsonFile, writeFileAtomicSync, isMainModule, readKbIdentity, cmpKey } from "./doc-lib.mjs";
import { printable } from "./journal-lib.mjs";
import { parseUnsubscribeLink, parseSentSince } from "./engagement.mjs";
import { METRICS, DIMENSIONS, STATUS_LABELS, statusLabel, SILENT_DAYS_DEFAULT } from "./engagement-query.mjs";
import { validateGroups, describeRule, UNGROUPED } from "./dashboard-groups.mjs";

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
export const CADENCES = Object.freeze({ weekly: "every week", monthly: "every month", quarterly: "every quarter", manual: "only when someone asks" });
export const PANEL_TYPES = Object.freeze({ kpi: "a headline figure", bar: "a bar chart", line: "a monthly trend", table: "a table", watchlist: "a ranked short list" });
// A preset is what a new page of that audience starts as; every value can be changed afterwards.
export const PRESETS = Object.freeze({
  admin: {
    meaning: "for the people who run the programs: every tab, per-program and per-email detail, account names",
    page: { statusDefault: ["PROCESSING"], tabs: { engagement: true, health: true, templates: true, about: true }, accountNames: true, sourceDetail: true },
  },
  exec: {
    meaning: "for leaders who read the numbers: Engagement and About, every status, no account names",
    page: { statusDefault: null, tabs: { engagement: true, health: false, templates: false, about: true }, accountNames: false, sourceDetail: false },
  },
});
const STATUSES = Object.keys(STATUS_LABELS);
const METRIC_IDS = METRICS.map((m) => m.id);

const pageOf = (id, preset, title) => {
  const p = PRESETS[preset].page;
  return { id, preset, title, statusDefault: p.statusDefault ? [...p.statusDefault] : null, tabs: Object.keys(TABS).map((tab) => ({ id: tab, enabled: p.tabs[tab] })), panels: [], accountNames: p.accountNames, sourceDetail: p.sourceDetail };
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
    sources: [{ adapter: "jo-engagement", params: { windowMonths: 13, selector: { sentSince: null, names: [], ids: [] }, internalDomains: [], unsubscribeLinks: [], testAccounts: [], pinnedAccounts: [], stepDetail: false, repullMonths: 2 } }],
    globalFilters: [{ id: "dateRange", enabled: true }, { id: "programs", enabled: true }, { id: "group", enabled: true }, { id: "status", enabled: true }, { id: "recipientClass", enabled: true, default: "all" }],
    accounts: { pull: false, busiest: 20, lowEngagement: 15, mostBounces: 15, lowEngagementMinDelivered: 10 },
    groups: { rules: [], overrides: {} },
    health: { silentDays: SILENT_DAYS_DEFAULT },
    pages: /** @type {T11Page[]} */ (/** @type {unknown} */ ([pageOf("admin", "admin", "Admin"), pageOf("exec", "exec", "Leadership")])),
    freshness: { maxAgeDays: 45 },
    refresh: { cadence: "monthly", ownerNote: null },
    publish: { target: "none", config: {} },
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
  { covers: ["sources[].params.windowMonths"], label: "Window", say: (s) => each(s, (x) => x.sources).map(({ params: p }) => `The last ${plural(p.windowMonths, "month")}, the current one included. The current month is provisional: opens keep arriving.`) },
  { covers: ["sources[].params.internalDomains[]"], label: "Internal recipients", say: (s) => each(s, (x) => x.sources).map(({ params: p }) => (p.internalDomains.length ? `Addresses at ${p.internalDomains.join(", ")} are internal.` : "No internal domain is named, so every recipient counts as external.")) },
  { covers: ["sources[].params.unsubscribeLinks[]"], label: "Unsubscribe link", say: (s) => each(s, (x) => x.sources).map(({ params: p }) => (p.unsubscribeLinks.length ? `Clicks on ${p.unsubscribeLinks.join(", ")} are unsubscribe clicks, not content clicks.` : "No unsubscribe link of the tenant's own is named; only the usual unsubscribe wordings are left out of click figures.")) },
  { covers: ["sources[].params.testAccounts[]", "sources[].params.pinnedAccounts[]"], label: "Named accounts", say: (s) => each(s, (x) => x.sources).map(({ params: p }) => `${plural(p.testAccounts.length, "test account")} and ${plural(p.pinnedAccounts.length, "pinned account")}. Named accounts are always kept as their own rows when accounts are pulled.`) },
  { covers: ["sources[].params.stepDetail"], label: "Step detail", say: (s) => each(s, (x) => x.sources).map(({ params: p }) => (p.stepDetail ? "On: every table can be read per step and per variant, and participant records are counted. Each refresh takes longer for it." : "Off: emails are reported per template, with the step's name where a template sits on one step. Turning it on adds step, variant and participant-record figures and makes each refresh longer.")) },
  { covers: ["sources[].params.repullMonths"], label: "Months read again", say: (s) => each(s, (x) => x.sources).map(({ params: p }) => `A refresh reads the last ${plural(p.repullMonths, "month")} again and keeps earlier months as they were last read.`) },
  { covers: ["globalFilters[].id", "globalFilters[].enabled", "globalFilters[].default"], label: "Filters", say: (s) => each(s, (x) => x.globalFilters).map((f) => `${FILTERS[f.id] ?? f.id}${f.enabled ? "" : " (not offered)"}${f.default ? `; starts on ${f.default === "external" ? "external recipients only" : "everyone"}` : ""}.`) },
  {
    covers: ["accounts.pull", "accounts.busiest", "accounts.lowEngagement", "accounts.mostBounces", "accounts.lowEngagementMinDelivered"], label: "Accounts",
    say: (s) => [
      s.accounts.pull
        ? `Customer lists are on: per program, the ${s.accounts.busiest} busiest accounts, the ${s.accounts.lowEngagement} lowest open rates among accounts with at least ${s.accounts.lowEngagementMinDelivered} delivered, and the ${s.accounts.mostBounces} with the most bounces. Every other account is in one "all other accounts" row, so totals stay exact.`
        : "Customer lists are off: the dashboard shows how each program is doing and how many accounts each reached, not which customers are not opening or are bouncing. Turning them on adds, per program, the busiest accounts, the lowest open rates and the most bounces, and makes a pull take several times longer; the refresh that adds them reads every table again.",
    ],
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
    covers: ["pages[].id", "pages[].preset", "pages[].title", "pages[].statusDefault", "pages[].statusDefault[]", "pages[].tabs[].id", "pages[].tabs[].enabled", "pages[].panels[]", "pages[].accountNames", "pages[].sourceDetail"], label: "Pages",
    say: (s) => each(s, (x) => x.pages).map((p) =>
      `"${p.title}" (${p.id}): ${PRESETS[p.preset]?.meaning ?? p.preset}. Tabs: ${listed(p.tabs.filter((t) => t.enabled).map((t) => t.id), "none")}. ` +
      `Shows ${p.statusDefault ? `${p.statusDefault.map(statusLabel).join(" and ")} programs` : "programs of every status"} at first; the others are one click away. ` +
      `${plural(p.panels.length, "panel")}. Account names ${p.accountNames ? "may show" : "never show"}; definitions ${p.sourceDetail ? "show" : "do not show"} the object, fields and filters behind each number.`),
  },
  { covers: ["freshness.maxAgeDays"], label: "Freshness", say: (s) => [`A page shows a stale banner once its data is more than ${plural(s.freshness.maxAgeDays, "day")} old.`] },
  { covers: ["refresh.cadence", "refresh.ownerNote"], label: "Refresh", say: (s) => [`Refreshed ${CADENCES[s.refresh.cadence] ?? s.refresh.cadence}; a refresh can also be run at any time.${s.refresh.ownerNote ? ` ${s.refresh.ownerNote}` : ""}`] },
  { covers: ["publish.target", "publish.config"], label: "Publishing", say: (s) => [s.publish.target === "none" ? "Not published anywhere: the pages are files in the workspace." : `Published to ${s.publish.target}.`] },
  { covers: ["native.reports[]"], label: "Gainsight reports", say: (s) => [`${plural(s.native.reports.length, "report")} created in Gainsight from this dashboard.`] },
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
    if (s.accounts.pull === false) notes.push("accounts.pull is false: the four account-selection numbers are kept and unused until customer lists are turned on.");
  }
  problems.push(...validateGroups(s.groups));
  if (obj(s.health, "health")) whole(s.health.silentDays, "health.silentDays", 1, 366);

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
    const tabs = Array.isArray(pg.tabs) ? pg.tabs : [];
    if (tabs.map((t) => t?.id).join() !== Object.keys(TABS).join()) bad(`${at}.tabs`, `must list the four tabs once each, in order: ${Object.keys(TABS).join(", ")} (turn one off with enabled: false)`);
    tabs.forEach((t, j) => { if (isObj(t)) bool(t.enabled, `${at}.tabs[${j}].enabled`); });
    const on = new Set(tabs.filter((t) => t?.enabled === true).map((t) => t.id));
    if (tabs.length && !on.has("about")) bad(`${at}.tabs`, "the About tab cannot be turned off: every page carries its own definitions and settings");
    if (tabs.length && on.size < 2) bad(`${at}.tabs`, "a page needs at least one tab besides About");
    bool(pg.accountNames, `${at}.accountNames`);
    bool(pg.sourceDetail, `${at}.sourceDetail`);
    if (!Array.isArray(pg.panels)) { bad(`${at}.panels`, "must be a list (an empty one takes the preset's panels)"); continue; }
    const panelIds = new Set();
    for (const [j, pn] of pg.panels.entries()) {
      const pat = `${at}.panels[${j}]`;
      if (!obj(pn, pat)) continue;
      for (const k of Object.keys(pn)) if (!["id", "tab", "type", "title", "query", "columns"].includes(k)) bad(`${pat}.${k}`, "is not a field of a panel (id, tab, type, title, query, columns)");
      if (!SLUG_RE.test(String(pn.id ?? ""))) bad(`${pat}.id`, "must be lower-case letters, digits and hyphens");
      else if (panelIds.has(pn.id)) bad(`${pat}.id`, "is used by two panels of this page");
      panelIds.add(pn.id);
      if (!["engagement", "health", "templates"].includes(pn.tab)) bad(`${pat}.tab`, "must be engagement, health or templates");
      else if (!on.has(pn.tab)) bad(`${pat}.tab`, `is the ${pn.tab} tab, which this page has turned off`);
      if (!(pn.type in PANEL_TYPES)) bad(`${pat}.type`, `must be one of ${Object.keys(PANEL_TYPES).join(", ")}`);
      text(pn.title, `${pat}.title`, { max: 120 });
      const q = pn.query;
      if (!obj(q, `${pat}.query`)) continue;
      for (const k of Object.keys(q)) if (!["groupBy", "metrics", "sort", "having", "limit"].includes(k)) bad(`${pat}.query.${k}`, "is not a field of a query (groupBy, metrics, sort, having, limit)");
      const groupBy = q.groupBy ?? [];
      if (!Array.isArray(groupBy)) bad(`${pat}.query.groupBy`, "must be a list of dimensions");
      else groupBy.forEach((d, k) => { if (!DIMENSIONS.includes(d)) bad(`${pat}.query.groupBy[${k}]`, `must be one of ${DIMENSIONS.join(", ")}`); });
      const metrics = Array.isArray(q.metrics) ? q.metrics : [];
      if (!metrics.length) bad(`${pat}.query.metrics`, "must list at least one metric");
      metrics.forEach((m, k) => { if (!METRIC_IDS.includes(m)) bad(`${pat}.query.metrics[${k}]`, `is not a metric the engine computes (${METRIC_IDS.join(", ")})`); });
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
  }

  if (obj(s.freshness, "freshness")) whole(s.freshness.maxAgeDays, "freshness.maxAgeDays", 1, 3660);
  if (obj(s.refresh, "refresh")) {
    if (!(s.refresh.cadence in CADENCES)) bad("refresh.cadence", `must be one of ${Object.keys(CADENCES).join(", ")}`);
    text(s.refresh.ownerNote, "refresh.ownerNote", { nullable: true, max: 600 });
  }
  if (obj(s.publish, "publish")) {
    if (s.publish.target !== "none") bad("publish.target", `must be "none": no publishing path exists yet`);
    if (!isObj(s.publish.config) || Object.keys(s.publish.config).length) bad("publish.config", "must be an empty object while the target is none");
  }
  if (obj(s.native, "native")) {
    if (!Array.isArray(s.native.reports)) bad("native.reports", "must be a list");
    else s.native.reports.forEach((r, i) => { if (!isObj(r) || !isText(r.panel) || !isText(r.reportId) || Object.keys(r).some((k) => !["panel", "reportId", "name"].includes(k))) bad(`native.reports[${i}]`, "must be {panel, reportId, name?}: the panel a Gainsight report was created from, and the report's id"); });
  }
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

// ── Files: the one writer ────────────────────────────────────────────────────
const dashboardDir = (kbDir, slug) => join(kbDir, DASHBOARDS_DIR, slug);
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

const USAGE =
  "usage: dashboard-spec.mjs <draft|set|validate|save|show|export|import|list> --kb <tenant KB folder> [--slug <slug>] " +
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
  const kbDir = resolve(opt("--kb"));
  if (!existsSync(join(kbDir, "_manifest.json"))) fail(`--kb ${opt("--kb")}: no _manifest.json there — pass the tenant's KB folder (the one /gs-superadmin:setup created)`);
  const tenantHost = kbTenantHost(kbDir);
  if (!tenantHost) fail(`--kb ${opt("--kb")}: its manifest names no tenant (baseUrl) — a dashboard belongs to one tenant`);
  const read = (path, what) => {
    try {
      return readJsonFile(path);
    } catch (e) {
      return fail(`${what} at ${path} cannot be read: ${e instanceof Error ? e.message : e}`);
    }
  };
  const problemsText = (problems) => problems.map((p) => `${p.path || "(spec)"} ${p.problem}`).join("; ");

  if (mode === "list") {
    const root = join(kbDir, DASHBOARDS_DIR);
    const slugs = existsSync(root) ? readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort(cmpKey) : [];
    const dashboards = slugs.map((slug) => {
      const saved = existsSync(specPath(kbDir, slug)) ? read(specPath(kbDir, slug), "the spec") : null;
      return { slug, saved: !!saved, draft: existsSync(draftPath(kbDir, slug)), title: saved?.title ?? null, cadence: saved?.refresh?.cadence ?? null, pages: Array.isArray(saved?.pages) ? saved.pages.map((p) => p.id) : [] };
    }).filter((d) => d.saved || d.draft);
    await finish({ ok: true, mode, tenantHost, dashboards });
  }

  if (mode === "import") {
    if (!opt("--file")) fail(USAGE);
    const file = read(resolve(opt("--file")), "the export");
    if (!isObj(file) || file.kind !== EXPORT_KIND || !isObj(file.spec)) fail(`--file ${opt("--file")}: not a dashboard spec export (its kind is not "${EXPORT_KIND}")`);
    const spec = file.spec;
    if (opt("--slug")) spec.slug = opt("--slug");
    const { problems } = validateSpec(spec);
    if (problems.length) fail(`the exported spec is not valid here: ${problemsText(problems)}`);
    // Before anything is written: a spec is refreshed from ONE tenant.
    if (spec.tenantHost !== tenantHost) fail(`this dashboard was exported from ${spec.tenantHost}, and this KB belongs to ${tenantHost} — a spec is never imported onto another tenant (its programs, groups and accounts are that tenant's)`);
    if (existsSync(draftPath(kbDir, spec.slug))) fail(`a draft of "${spec.slug}" is in progress here — save or delete it first, or import under another --slug`);
    if (existsSync(specPath(kbDir, spec.slug)) && !argv.includes("--replace")) fail(`a dashboard "${spec.slug}" is already saved here — pass --replace to overwrite it, or --slug <other> to import beside it`);
    writeSpecFile(specPath(kbDir, spec.slug), spec);
    await finish({ ok: true, mode, slug: spec.slug, tenantHost, path: specPath(kbDir, spec.slug), exportedAt: file.exportedAt ?? null });
  }

  const slug = opt("--slug");
  if (!slug) fail(`--slug <slug> is required — ${USAGE}`);
  if (!SLUG_RE.test(slug)) fail(`--slug must be lower-case letters, digits and hyphens (got "${printable(slug, 40)}")`);
  const [saved, draft] = [specPath(kbDir, slug), draftPath(kbDir, slug)];
  const readDraft = () => {
    const d = read(draft, "the draft");
    if (!isObj(d) || d.kind !== "dashboard-spec-draft" || !isObj(d.spec)) fail(`the draft at ${draft} is not a dashboard spec draft`);
    return d;
  };
  const summary = (d) => ({ slug, path: draft, answered: d.answered, title: d.spec.title, startedAt: d.startedAt, updatedAt: d.updatedAt });

  if (mode === "draft") {
    if (existsSync(draft)) await finish({ ok: true, mode, state: "resumed", ...summary(readDraft()) });
    const from = existsSync(saved) ? read(saved, "the saved spec") : null;
    const now = new Date().toISOString();
    const d = { kind: "dashboard-spec-draft", spec: from ?? defaultSpec({ slug, title: opt("--title") ?? null, owner: opt("--owner") ?? null, tenantHost }), answered: [], startedAt: now, updatedAt: now };
    const { problems } = validateSpec(d.spec);
    if (problems.length) fail(`cannot start the draft: ${problemsText(problems)}`);
    writeSpecFile(draft, d);
    await finish({ ok: true, mode, state: from ? "editing-saved" : "new", ...summary(d) });
  }

  if (mode === "set") {
    if (!existsSync(draft)) fail(`no draft of "${slug}" — start one with: dashboard-spec.mjs draft --kb <kb> --slug ${slug}`);
    const d = readDraft();
    const sets = all("--set");
    const answered = all("--answered");
    if (!sets.length && !answered.length) fail(`nothing to set — pass --set <path>=<json> and/or --answered <key>`);
    for (const key of answered) if (!/^[a-z0-9][a-z0-9-]*$/.test(key)) fail(`--answered takes a plain key (lower-case letters, digits, hyphens), got "${printable(key, 40)}"`);
    for (const pair of sets) {
      const cut = pair.indexOf("=");
      if (cut < 1) fail(`--set takes <path>=<json> (got "${printable(pair, 80)}")`);
      let value;
      try {
        value = JSON.parse(pair.slice(cut + 1));
      } catch {
        fail(`--set ${pair.slice(0, cut)}: the value is not JSON — quote text ("Renewals"), and write lists and objects as JSON`);
      }
      try {
        setPath(d.spec, pair.slice(0, cut), value);
      } catch (e) {
        fail(e instanceof Error ? e.message : String(e));
      }
    }
    if (d.spec.slug !== slug) fail(`slug cannot be changed with set: the dashboard's folder is named for it (export it and import it under the new slug)`);
    if (d.spec.tenantHost !== tenantHost) fail(`tenantHost cannot be changed: this KB belongs to ${tenantHost}`);
    // The whole draft, not the touched field: a change is refused when what it leaves is not a valid spec.
    const { problems, notes } = validateSpec(d.spec);
    if (problems.length) fail(`not saved — ${problemsText(problems)}`);
    d.answered = [...new Set([...d.answered, ...answered])];
    d.updatedAt = new Date().toISOString();
    writeSpecFile(draft, d);
    await finish({ ok: true, mode, set: sets.map((p) => p.slice(0, p.indexOf("="))), notes, ...summary(d) });
  }

  const useSaved = argv.includes("--saved") || !existsSync(draft);
  if (["validate", "show"].includes(mode)) {
    if (useSaved && !existsSync(saved)) fail(`no dashboard "${slug}" here: neither a saved spec nor a draft`);
    const spec = useSaved ? read(saved, "the saved spec") : readDraft().spec;
    const { problems, notes } = validateSpec(spec);
    if (mode === "validate") await finish({ ok: !problems.length, mode, slug, which: useSaved ? "saved" : "draft", problems, notes }, problems.length ? 1 : 0);
    if (problems.length) fail(`the ${useSaved ? "saved spec" : "draft"} is not valid: ${problemsText(problems)}`);
    await finish({ ok: true, mode, slug, which: useSaved ? "saved" : "draft", answered: useSaved ? null : readDraft().answered, settings: describeSpec(spec).map((d) => ({ label: d.label, text: d.text })), notes });
  }

  if (mode === "save") {
    if (!existsSync(draft)) fail(`no draft of "${slug}" to save`);
    const d = readDraft();
    const { problems, notes } = validateSpec(d.spec);
    if (problems.length) fail(`not saved — ${problemsText(problems)}`);
    const replaced = existsSync(saved);
    writeSpecFile(saved, d.spec);
    rmSync(draft, { force: true });
    await finish({ ok: true, mode, slug, path: saved, replaced, notes, pages: d.spec.pages.map((p) => p.id) });
  }

  // export
  if (!opt("--out")) fail(USAGE);
  if (!existsSync(saved)) fail(`no saved dashboard "${slug}" to export${existsSync(draft) ? " (a draft exists: save it first)" : ""}`);
  // A valid spec holds no machine path, so the export is the spec itself.
  const spec = read(saved, "the saved spec");
  const invalid = validateSpec(spec).problems;
  if (invalid.length) fail(`the saved spec is not valid, so it is not exported: ${problemsText(invalid)}`);
  writeSpecFile(resolve(opt("--out")), { kind: EXPORT_KIND, exportVersion: 1, exportedAt: new Date().toISOString(), tenantHost: spec.tenantHost, spec });
  await finish({ ok: true, mode, slug, out: resolve(opt("--out")), tenantHost: spec.tenantHost });
}

if (isMainModule(import.meta.url)) {
  main().catch((e) => {
    console.error(`dashboard-spec.mjs: ${e?.stack ?? e}`);
    process.exit(1);
  });
}
