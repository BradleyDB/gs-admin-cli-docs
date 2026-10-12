#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// dashboard.mjs — the ONE deterministic entry command of an engagement
// dashboard (PUB-1, DSH-3; ruled 2026-10-05): everything mechanical about a
// dashboard goes through its verbs, with no model in the loop. It IMPORTS the
// five scripts it composes — the spec writer (dashboard-spec.mjs), the
// adapter (engagement.mjs), the grouping resolver (dashboard-groups.mjs), the
// page builder (dashboard-page.mjs) and the report (engagement-report.mjs) —
// and never spawns them. Every durable file keeps its one writer: the spec
// and its draft are the spec writer's, the pull's payloads the adapter's run
// directory's, the knowledge base's docs and manifest the describe-batch and
// manifest scripts' (spawned, as every skill spawns them: they have no other
// front door). What this file owns, and writes atomically: the snapshots, the
// pages, the refresh lock and its resumable state, the interview's preview.
//
// Verbs (each prints ONE JSON summary; exit codes below):
//   new <slug> [--fast-path] [--title <t>] [--owner <o>]
//                        a draft from the defaults; the fast path answers every
//                        question but the estimate with the defaults
//   next <slug>          the next unanswered question of the QUESTIONS table,
//                        with its options and what it needs handed over (a
//                        judgment node's input file, the minutes a switch costs)
//   answer <slug> <id> <value>
//                        validates through the spec writer, writes, marks the
//                        ask-once key; an action question acts (the dry run, the
//                        estimate, the save and first refresh)
//   change <slug> <path>=<json>... [--dry-run]
//                        set through the writer; prints what changed and its
//                        consequence from the COSTS table (in-page, "rebuild
//                        only", or "the next refresh pulls everything again,
//                        about N minutes"); saves; then DOES that consequence.
//                        --dry-run prints and stops
//   save <slug>          the draft becomes the saved spec
//   list                 saved dashboards and drafts (a draft with its holder and date)
//   status <slug>        the last pull, its age, the next due by cadence, the lock
//   refresh <slug> [--full] [--health-only]
//                        the pull (token pre-flight, the tenant check, the lock,
//                        re-documentation, the adapter, groups, retention, pages,
//                        the delta); a failed or partial refresh NEVER touches
//                        the last good pages
//   rebuild <slug>       the pages again from the latest snapshot, no pull
//   report <slug> [--by-template] [--exclude-internal] [--include-paused | --all] [--csv-dir <dir>]
//                        the open-rate report over the latest snapshot, no pull
//   export <slug> --out <file> [--with-snapshot]
//   import --file <file> [--slug <as>] [--replace] [--snapshot <file>]
//   health <slug> --program <id>
//                        a program's masked messages and the "Other" samples,
//                        to the terminal (never a page)
//   costs | questions    the two tables, as data, for a reader
//
// Common flags: --kb <tenant KB folder> (else the one KB of the workspace),
// --workspace <dir>, --bin <gs-admin entry>, --by <holder>, --take-over,
// --today YYYY-MM-DD, --now <ISO>.
//
// Exit codes: 0 ok · 1 refused or failed · 3 token-expired (resumable) ·
// 4 partial (resumable) · 5 wrong-tenant.
//
// What the code enforces:
//   - The tenant: before any call, `whoami`'s host must equal the spec's
//     tenantHost, or the refresh is refused (exit 5). A production dashboard is
//     never refreshed from a sandbox by accident.
//   - The lock: a workspace file beside the spec; a second refresh is refused
//     naming the holder and the time; a lock older than LOCK_STALE_MS is stale
//     and taken over. No cross-machine lock is attempted.
//   - The budget: the plan's seconds plus the re-documentation's are held to
//     the token's remaining life before the first fact call.
//   - Re-documentation: ONE staleness predicate (the adapter's kbGap: a
//     program's list modified_date against its doc's manifest last_verified,
//     modified since documented, never age) and ONE re-documenter (the
//     manifest and describe-batch scripts, as the knowledge-base skills run
//     them), capped per refresh, off-switchable; the template gap the same way.
//   - A display-only change rebuilds from the last snapshot; a re-selection of
//     the customer lists reduces the last run directory again when it is still
//     there, else the next pull says so.
//
// Citations: DSH-n / PUB-n / UX-n are work items and Rnn rulings of the
// maintainer's unpublished JO-dashboards plan; the decision each produced is
// stated beside the token.
//
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, unlinkSync, copyFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { makeCliHelpers, findWorkspaceDir, findWorkspaceCatalog, makeCommandResolver, resolveCliArgv, readJsonFile, writeFileAtomicSync, isMainModule, readKbIdentity, cmpKey, RECORDED_LANES } from "./doc-lib.mjs";
import { printable } from "./journal-lib.mjs";
import {
  specStore, SpecRefusal, holderName, openSpec, SPEC_DESCRIPTIONS, PRESETS, TABS, CADENCES, FRESHNESS_BY_CADENCE, DEFAULT_ACCOUNT_LISTS,
  accountLists, accountFields, kbSettings, windowOf, presetPanels,
} from "./dashboard-spec.mjs";
import { resolveParams, prepareRun, fetchEngagement, reduceEngagement, loadRun, cliTransport, makeGate, parseWhoami, addMonths, monthsBetween, EngagementRefusal, ROW_READERS, rpRunArgv } from "./engagement.mjs";
import { applyGroups, programTraitsOf, suggestionTable } from "./dashboard-groups.mjs";
import { buildPage, inlinedSources, pageFileName } from "./dashboard-page.mjs";
import { writeReport, ReportRefusal } from "./engagement-report.mjs";
import * as engine from "./engagement-query.mjs";
import { validateTheme, readLogo, LOGO_MAX_BYTES } from "./dashboard-theme.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const MANIFEST_SCRIPT = join(here, "manifest.mjs");
const DESCRIBE_BATCH_SCRIPT = join(here, "describe-batch.mjs");
export const EXIT = Object.freeze({ ok: 0, failed: 1, "token-expired": 3, partial: 4, "wrong-tenant": 5 });
// Files this command owns, inside the dashboard's folder (beside the spec writer's two).
export const SNAPSHOTS_DIR = "snapshots";
export const PREVIEW_DIR = "preview";
export const REPORTS_DIR = "reports";
export const LOCK_FILE = "refresh.lock";
export const STATE_FILE = "refresh-state.json";
export const INTERVIEW_FILE = "interview-state.json";
export const SUGGESTION_FILE = "group-suggestion-input.json";
// Not frozen: keep a year of monthly pulls; a lock older than two hours is stale (PUB-1 defaults).
export const KEEP_SNAPSHOTS = 13;
export const LOCK_STALE_MS = 2 * 60 * 60 * 1000;
// The tenant's own failure-category file, beside the KB's manifest (a spec holds no path): passed to the adapter when present.
export const CATEGORIES_FILE = "failure-categories.json";
// The cadence in days, for "next due" and the freshness line.
export const CADENCE_DAYS = Object.freeze({ weekly: 7, monthly: 30, quarterly: 91, manual: null });
export class DashboardRefusal extends Error {
  constructor(message, code = "failed") { super(message); this.code = code; }
}
const refuse = (msg, code = "failed") => { throw new DashboardRefusal(msg, code); };
const isText = (v) => typeof v === "string" && v.trim() !== "";
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const minutesOf = (seconds) => (seconds == null ? null : Math.max(1, Math.round(seconds / 60)));
const sha = (v) => createHash("sha1").update(JSON.stringify(v)).digest("hex").slice(0, 10);
const src = (spec) => spec.sources[0].params;

// ── The adapter mapping: which setting reaches the pull, and how ─────────────
// Data, so the COSTS table derives "needs a pull" from it (ruled 2026-10-04: the pull side is derived, never restated by
// hand). Each row names the spec's setting by its SPEC_DESCRIPTIONS path and the adapter parameter it becomes.
export const ADAPTER_MAPPING = Object.freeze([
  { path: "sources[].params.windowMonths", to: "window (--from)" },
  { path: "sources[].params.window.kind", to: "window (--from, --to)" },
  { path: "sources[].params.window.from", to: "window (--from)" },
  { path: "sources[].params.window.to", to: "window (--to)" },
  { path: "sources[].params.selector.sentSince", to: "--sent-since" },
  { path: "sources[].params.selector.names[]", to: "--name" },
  { path: "sources[].params.selector.ids[]", to: "--name (ids)" },
  { path: "sources[].params.internalDomains[]", to: "--internal-domain" },
  { path: "sources[].params.unsubscribeLinks[]", to: "--unsubscribe-link" },
  { path: "sources[].params.testAccounts[]", to: "--test-account" },
  { path: "sources[].params.pinnedAccounts[]", to: "--pin-accounts-file" },
  { path: "sources[].params.stepDetail", to: "--step-detail" },
  { path: "sources[].params.repullMonths", to: "--repull-months" },
  { path: "sources[].params.quietDueDays", to: "--quiet-due-days" },
  { path: "sources[].params.samplePrograms", to: "--sample-programs" },
  { path: "sources[].params.expectedReasons[]", to: "--expected-reason" },
  { path: "accounts.pull", to: "--accounts" },
  { path: "accounts.busiest", to: "--accounts-busiest" },
  { path: "accounts.lowEngagement", to: "--accounts-low" },
  { path: "accounts.mostBounces", to: "--accounts-bounce" },
  { path: "accounts.lowEngagementMinDelivered", to: "--accounts-low-min-delivered" },
  { path: "accounts.fields[]", to: "--account-field" },
  { path: "pages[].tabs[].enabled", to: "--health (when any page's Health tab is on)" },
  { path: "health.silentDays", to: "--health-lookback-days (the floor of the derived lookback)" },
]);
/**
 * The adapter's parameters from a spec (the runner maps the spec: PUB-1). The window kind decides --from/--to; the
 * health pull is on when any page's Health tab is on; the lookback is DERIVED (ENG-2 item 3): the longest schedule
 * period among the programs (the plan reports it), at least health.silentDays, capped at the window.
 * @param {*} spec a valid spec
 * @param {{today: string, forceFull?: boolean, healthOnly?: boolean, lookbackDays?: ?number, categories?: *, preview?: boolean}} opts
 */
export function adapterParams(spec, { today, forceFull = false, healthOnly = false, lookbackDays = null, categories = {}, preview = false }) {
  const p = src(spec);
  const w = windowOf(p);
  const thisMonth = today.slice(0, 7);
  const to = w.kind === "fixed" ? w.to : thisMonth;
  const from = w.kind === "rolling" ? addMonths(to, -(p.windowMonths - 1)) : w.from;
  const windowDays = monthsBetween(from, to).length * 31;
  const healthOn = !preview && spec.pages.some((pg) => pg.tabs.some((t) => t.id === "health" && t.enabled));
  const silent = spec.health.silentDays;
  const lookback = Math.max(1, Math.min(366, windowDays, Math.max(silent, lookbackDays ?? silent)));
  return {
    today, from, to,
    names: p.selector.names, ids: p.selector.ids, sentSince: p.selector.sentSince ?? undefined,
    internalDomains: p.internalDomains, unsubscribeLinks: p.unsubscribeLinks, testAccounts: p.testAccounts,
    stepDetail: preview ? false : p.stepDetail,
    accounts: {
      pull: preview ? false : spec.accounts.pull, busiest: spec.accounts.busiest, lowEngagement: spec.accounts.lowEngagement, mostBounces: spec.accounts.mostBounces, lowEngagementMinDelivered: spec.accounts.lowEngagementMinDelivered,
      lists: accountLists(spec), fields: accountFields(spec), pinned: p.pinnedAccounts, names: true,
    },
    health: { pull: healthOn, lookbackDays: lookback, categories, expectedReasons: p.expectedReasons ?? [], samplePrograms: p.samplePrograms ?? 25, quietDueDays: p.quietDueDays ?? 5 },
    repullMonths: healthOnly ? 1 : p.repullMonths,
    forceFull,
  };
}

// ── The per-setting cost table (ruled 2026-10-04 and 2026-10-05, DSH-1 item 11) ──
// What changing a setting costs, as DATA: `pull` (the next refresh pulls everything again) is DERIVED from the
// adapter mapping above; `rebuild` is a page rebuilt from the last snapshot with no pull; `in-page` is a starting value
// a viewer can also change on the page (the saved value is what a page starts on, so the rebuild applies it);
// `reselect` re-ranks the customer lists over the last run directory's rows (a rebuild) when it is still there, else
// the next pull; `identity` cannot change. Every SPEC_DESCRIPTIONS path has exactly one cost (the suite holds it both
// ways), and the page's LACKS rows must agree with it (the suite holds that too).
export const COST_KINDS = Object.freeze({
  pull: "the next refresh pulls everything again",
  reselect: "the customer lists are ranked again over the last pull's rows (a rebuild); when those rows are gone, the next refresh",
  rebuild: "the pages are rebuilt from the last snapshot, with no pull",
  "in-page": "a starting value a viewer can also change on the page; the pages are rebuilt so they start on it",
  identity: "cannot be changed: it names the dashboard or its tenant",
});
const IN_PAGE_PATHS = ["globalFilters[].default", "health.silentDays", "pages[].statusDefault", "pages[].statusDefault[]", "pages[].dateDefault", "pages[].panels[]"];
const RESELECT_PATHS = ["accounts.lists[]"];
const IDENTITY_PATHS = ["schemaVersion", "kind", "slug", "tenantHost", "sources[].adapter"];
export const COSTS = Object.freeze(Object.fromEntries(SPEC_DESCRIPTIONS.flatMap((d) => d.covers).map((path) => {
  const kind = IDENTITY_PATHS.includes(path) ? "identity" : RESELECT_PATHS.includes(path) ? "reselect" : ADAPTER_MAPPING.some((m) => m.path === path) ? "pull" : IN_PAGE_PATHS.includes(path) ? "in-page" : "rebuild";
  return [path, kind];
})));
// health.silentDays reaches the pull as the lookback's floor AND is the page's starting threshold: a change costs a pull.
const COST_RANK = { identity: 0, "in-page": 1, rebuild: 2, reselect: 3, pull: 4 };
/** A real path of a spec (`sources[0].params.internalDomains[1]`) → the SPEC_DESCRIPTIONS path that covers it. */
export function coveredPath(realPath) {
  // A real path in either grammar: the leaves' (`pages[0].title`) or the writer's dotted one (`pages.0.title`, what
  // `change` takes and a page's copy line names, F-503).
  const norm = String(realPath).replace(/\[\d+\]/g, "[]").replace(/\.\d+(?=\.|$)/g, "[]").replace(/^groups\.overrides\..*$/, "groups.overrides{}");
  const covers = SPEC_DESCRIPTIONS.flatMap((d) => d.covers);
  if (covers.includes(norm)) return norm;
  // An emptied or filled list or map is the whole container's path: the description covers its items.
  if (covers.includes(`${norm}[]`)) return `${norm}[]`;
  if (covers.includes(`${norm}{}`)) return `${norm}{}`;
  const whole = covers.filter((c) => /(\[\]|\{\})$/.test(c)).find((w) => norm.startsWith(`${w}.`) || norm.startsWith(`${w}[`));
  if (whole) return whole;
  return covers.find((c) => norm.startsWith(`${c}.`)) ?? null;
}
/** Every leaf of a value → its real path (list indexes spelled). */
function leavesOf(value, at = "", out = []) {
  if (Array.isArray(value)) { if (!value.length) out.push([at, "[]"]); value.forEach((v, i) => leavesOf(v, `${at}[${i}]`, out)); }
  else if (value && typeof value === "object") { if (!Object.keys(value).length) out.push([at, "{}"]); for (const [k, v] of Object.entries(value)) leavesOf(v, at ? `${at}.${k}` : k, out); }
  else out.push([at, JSON.stringify(value)]);
  return out;
}
/**
 * What changed between two specs and what it costs: every changed setting (by its description path) with its cost,
 * and the highest cost as the consequence.
 * @returns {{changed: Array<{path: string, cost: string, from: *, to: *}>, consequence: ?string}}
 */
export function changeCost(before, after, { longestPeriodDays = null } = {}) {
  const a = new Map(leavesOf(before));
  const b = new Map(leavesOf(after));
  const paths = new Set([...a.keys(), ...b.keys()].filter((k) => a.get(k) !== b.get(k)));
  const byCovered = new Map();
  for (const real of paths) {
    const covered = coveredPath(real) ?? real;
    const cost = COSTS[covered] ?? "rebuild";
    if (!byCovered.has(covered)) byCovered.set(covered, { path: covered, cost, examples: [] });
    if (byCovered.get(covered).examples.length < 3) byCovered.get(covered).examples.push(real);
  }
  // A tab switch reaches the pull only through Health (--health is on when any page's Health tab is): a tab change
  // that leaves the health pull as it was (Templates, or a second page's Health tab) is a rebuild.
  const healthMoved = (() => { try { return adapterParams(before, { today: "2026-01-01" }).health.pull !== adapterParams(after, { today: "2026-01-01" }).health.pull; } catch { return true; } })();
  // The silent threshold reaches the pull only as the derived lookback's floor: while the longest schedule period
  // (from the last plan) is above both the old and the new value, the lookback does not move and the change is the
  // page's starting threshold alone, a rebuild. With no plan yet, the pull side is assumed.
  const silentMoved = longestPeriodDays == null || Math.max(before.health?.silentDays ?? 0, after.health?.silentDays ?? 0) > longestPeriodDays;
  const changed = [...byCovered.values()].map((c) => (c.path === "pages[].tabs[].enabled" && !healthMoved ? { ...c, cost: "rebuild" } : c.path === "health.silentDays" && !silentMoved ? { ...c, cost: "rebuild" } : c)).sort((x, y) => cmpKey(x.path, y.path));
  const consequence = changed.length ? changed.map((c) => c.cost).sort((x, y) => COST_RANK[y] - COST_RANK[x])[0] : null;
  return { changed, consequence };
}

// ── The questions table (DSH-3, ruled 2026-10-05) ────────────────────────────
// One row per question, as DATA: its id (the ask-once key), its wording in the user's terms, its kind, its options
// (static, or from the context), the spec path it fills, a skip rule, and whether it is a JUDGMENT node (prose
// decides; the script hands over the input and takes the answer back). The script decides order, validation,
// skipping and ask-once; the skill reads the question aloud and passes the answer back. `apply(value, ctx)` returns
// the sets for the spec writer (which validates the whole draft) and anything to say back.
const listValue = (v) => (Array.isArray(v) ? v : typeof v === "string" && v.trim().startsWith("[") ? JSON.parse(v) : String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean));
const boolValue = (v) => { const s = String(v).trim().toLowerCase(); if (["yes", "y", "true", "on"].includes(s)) return true; if (["no", "n", "false", "off"].includes(s)) return false; refuse(`"${printable(String(v), 40)}" is not yes or no`); };
const jsonValue = (v) => { if (typeof v !== "string") return v; try { return JSON.parse(v); } catch { return refuse(`the value is not JSON: ${printable(v, 80)}`); } };
const secondsText = (s) => (s == null ? "an unknown time (no plan yet)" : `about ${plural(minutesOf(s), "minute")}`);
/**
 * What the bounce categories cost a refresh with Health on, said plainly from the plan (F-504: calls multiply by the
 * recipient classes — all, each internal domain, the test accounts, the test accounts on each domain).
 * @param {?{categoryCalls?: {bounce: {categories: number, classes: number, calls: number, seconds: number}}}} health estimate.health
 */
const categoryCostText = (health) => {
  const b = health?.categoryCalls?.bounce;
  if (!b || !b.categories) return "";
  return ` The ${plural(b.categories, "bounce category", "bounce categories")} in the workspace's category file cost ${plural(b.calls, "counted call")} a refresh (${b.categories} × ${plural(b.classes, "recipient class", "recipient classes")}: all, each internal domain, the test accounts, and the test accounts on each domain; ${secondsText(b.seconds)}).`;
};
const execPage = (spec) => spec.pages.findIndex((p) => p.preset === "exec");
const tabsOf = (spec) => spec.pages.map((pg) => ({ page: pg.id, preset: pg.preset, health: pg.tabs.find((t) => t.id === "health").enabled, templates: pg.tabs.find((t) => t.id === "templates").enabled }));
export const QUESTIONS = Object.freeze([
  {
    id: "tenant", kind: "preflight", path: "tenantHost", judgment: false,
    ask: "Which tenant is this dashboard for? The CLI's active tenant must be the one the knowledge base belongs to.",
    options: () => [],
  },
  {
    id: "purpose", kind: "text", path: "purpose", judgment: true,
    ask: "What decision should this dashboard support? Say it in a sentence or two, in your own words (it is shown on the About tab).",
    options: () => [],
    apply: (v) => ({ sets: [["purpose", String(v).trim()]] }),
  },
  {
    id: "audiences", kind: "choice", path: "pages[]", judgment: false,
    ask: "Who reads it? Admins get a page with every tab and per-email detail; leaders get a page with the headline figures, charts and the programs by group.",
    options: () => [{ id: "both", text: "Admins and leaders: one page each (the default)" }, { id: "admins", text: "Admins only" }, { id: "leaders", text: "Leaders only" }],
    apply: (v, ctx) => {
      const keep = v === "both" ? ["admin", "exec"] : v === "admins" ? ["admin"] : v === "leaders" ? ["exec"] : refuse(`"${v}" is not one of both, admins, leaders`);
      return { sets: [["pages", ctx.spec.pages.filter((pg) => keep.includes(pg.preset))]] };
    },
  },
  {
    id: "programs", kind: "choice", path: "sources[].params.selector", judgment: false,
    ask: "Which programs? The cheapest way to cut a big tenant down is programs that have sent since a date; otherwise every program that sent in the window, or named programs.",
    options: () => [
      { id: "sent-90d", text: "Programs that sent in the last 90 days (the default)" }, { id: "sent-180d", text: "Programs that sent in the last 180 days" }, { id: "sent-365d", text: "Programs that sent in the last year" },
      { id: "window", text: "Every program with a send in the reporting window" }, { id: "since:<YYYY-MM-DD>", text: "Programs that sent since a date you give" }, { id: "names:<JSON list>", text: "Named programs (exact names or ids, as a JSON list)" },
    ],
    apply: (v) => {
      const s = String(v).trim();
      const sel = (sentSince, names = []) => ({ sets: [["sources.0.params.selector", { sentSince, names, ids: [] }]] });
      if (s === "window") return sel(null);
      if (/^sent-\d+d$/.test(s)) return sel(s.slice(5));
      if (s.startsWith("since:")) return sel(s.slice(6).trim());
      if (s.startsWith("names:")) return sel(null, listValue(s.slice(6).trim()));
      return refuse(`"${printable(s, 40)}" is not one of the options (sent-90d, sent-180d, sent-365d, window, since:<date>, names:<list>)`);
    },
  },
  {
    id: "grouping", kind: "json", path: "groups", judgment: true, needsPlan: true,
    ask: "Is there an organizational structure to follow: folders, a naming convention, a program field? If not, groups are proposed from the programs' characteristics (surveys, recurring or one-off, model, audience) in two levels, for you to confirm or edit as a table. Folder names are not available from Gainsight: a folder group shows its id until you label it.",
    options: () => [{ id: "<JSON {rules, overrides?}>", text: "The group rules as proposed or edited (the script writes them)" }, { id: "none", text: "No grouping: every program in one group" }, { id: "folders:<JSON {id: label}>", text: "Group by folder, with the labels you give (names are unavailable)" }],
    input: (ctx) => ({ suggestionFile: ctx.suggestionFile }),
    apply: (v, ctx) => {
      const s = typeof v === "string" ? v.trim() : v;
      if (s === "none") return { sets: [["groups", { rules: [], overrides: {} }]] };
      if (typeof s === "string" && s.startsWith("folders:")) {
        const labels = jsonValue(s.slice(8).trim());
        const ids = [...new Set((ctx.programs ?? []).map((p) => p.folderId).filter(Boolean))].sort(cmpKey);
        const folders = ids.map((id) => ({ id, ...(isText(labels?.[id]) ? { label: labels[id] } : {}) }));
        if (!folders.length) refuse("no program of the selection carries a folder id, so there is nothing to group by folder");
        return { sets: [["groups", { rules: [{ kind: "folder", level: "supergroup", folders }], overrides: {} }]], notes: [`${plural(folders.length, "folder")} grouped; ${folders.filter((f) => !f.label).length} unlabelled (they read "Folder <id>")`] };
      }
      const g = jsonValue(s);
      if (!g || typeof g !== "object" || !Array.isArray(g.rules)) refuse("the grouping answer must be {rules: [...], overrides?: {...}}, none, or folders:{...}");
      return { sets: [["groups", { rules: g.rules, overrides: g.overrides ?? {} }]] };
    },
  },
  {
    id: "internal-domains", kind: "list", path: "sources[].params.internalDomains[]", judgment: false,
    ask: "Which email domains are the company's own? Recipients on them are internal, and the pages can leave them out. Give a comma-separated list, or none. Each domain adds one counted call per bounce category to a refresh with Health on (the estimate says how many).",
    options: () => [{ id: "<domains>", text: "acme.com, acme.co.uk" }, { id: "none", text: "No internal domain: every recipient counts as external (a caveat says so)" }],
    apply: (v) => ({ sets: [["sources.0.params.internalDomains", String(v).trim().toLowerCase() === "none" ? [] : listValue(v)]] }),
  },
  {
    id: "test-accounts", kind: "list", path: "sources[].params.testAccounts[]", judgment: false,
    ask: "Are there test accounts: company records (an \"Acme Test\" account whose contacts are employees' alternate addresses) whose sends should count as internal? Give company ids, or names as name:<the account's name> (looked up once; several matches are shown, never guessed). Never email addresses. Test accounts add one counted call per bounce category, and one more per internal domain, to a refresh with Health on.",
    options: () => [{ id: "<ids or name:...>", text: "co-123, name:Acme Test" }, { id: "none", text: "No test account" }],
    apply: (v, ctx) => {
      if (String(v).trim().toLowerCase() === "none") return { sets: [["sources.0.params.testAccounts", []]] };
      const given = listValue(v);
      const ids = [];
      const notes = [];
      for (const g of given) {
        if (!g.startsWith("name:")) { ids.push(g); continue; }
        const found = ctx.lookupCompany(g.slice(5).trim());
        if (found.length === 1) { ids.push(found[0].key); notes.push(`"${g.slice(5).trim()}" is ${found[0].key}`); }
        else refuse(found.length ? `"${g.slice(5).trim()}" matches ${found.length} accounts: ${found.map((f) => `${f.name} (${f.key})`).join("; ")} — give the id` : `no account is named "${g.slice(5).trim()}"`);
      }
      return { sets: [["sources.0.params.testAccounts", [...new Set(ids)].sort(cmpKey)]], notes };
    },
  },
  {
    id: "unsubscribe-links", kind: "list", path: "sources[].params.unsubscribeLinks[]", judgment: false,
    ask: "Is an outside domain or a page on the company's own site used for unsubscribes? Without it, a tenant whose unsubscribe link lacks the usual wording has those clicks counted as content clicks. Give the page's link as the emails print it (a bare host names every page on it, so never the company's own domain alone). Changing this later forces a full refresh.",
    options: () => [{ id: "<links>", text: "https://www.acme.com/mail-settings" }, { id: "none", text: "The usual unsubscribe wordings are enough" }],
    apply: (v) => ({ sets: [["sources.0.params.unsubscribeLinks", String(v).trim().toLowerCase() === "none" ? [] : listValue(v)]] }),
  },
  {
    id: "failure-settings", kind: "json", path: "sources[].params.quietDueDays", judgment: false, needsPlan: true,
    ask: "Two health settings. Due days: how many due days may an ingest run admitting nobody before the program is listed as \"Admitting nobody\" (default 5)? Sample programs: how many programs may a pull sample for failure text, most failures first (default 25)?",
    options: (ctx) => {
      const s = ctx.plan?.estimate?.health?.samples;
      const categories = categoryCostText(ctx.plan?.estimate?.health);
      const context = s ? `This selection has ${s.participantFailures?.withFailures ?? "an unknown number of"} programs with refused participants and ${s.bounceReasons?.withFailures ?? "an unknown number of"} with bounce text; the cap of ${s.cap} leaves ${(s.participantFailures?.beyondCap ?? 0) + (s.bounceReasons?.beyondCap ?? 0)} unsampled, about ${plural(minutesOf((s.participantFailures?.secondsBeyondCap ?? 0) + (s.bounceReasons?.secondsBeyondCap ?? 0)), "minute")} to read them all.` : "The plan has not priced the samples yet.";
      return [{ id: "<JSON {quietDueDays, samplePrograms}>", text: `{"quietDueDays": 5, "samplePrograms": 25}. ${context}${categories}` }, { id: "default", text: "5 due days, 25 programs" }];
    },
    apply: (v) => {
      if (String(v).trim() === "default") return { sets: [["sources.0.params.quietDueDays", 5], ["sources.0.params.samplePrograms", 25]] };
      const j = jsonValue(v);
      return { sets: [["sources.0.params.quietDueDays", j.quietDueDays ?? 5], ["sources.0.params.samplePrograms", j.samplePrograms ?? 25]] };
    },
  },
  {
    id: "window", kind: "choice", path: "sources[].params.window.kind", judgment: false, needsPlan: true,
    ask: "What period should the pages cover? Rolling: the last N months counted back from each refresh. Fixed: a start and end month, the same every refresh. Since: every month from a start month to the current one. A first pull scales with the months covered.",
    options: (ctx) => {
      const months = monthsBetween(ctx.params.from, ctx.params.to).length;
      const sec = ctx.plan?.estimate?.full?.seconds ?? null;
      const per = sec != null && months ? ` (${secondsText(sec)} for ${plural(months, "month")} on this tenant, about ${plural(minutesOf(sec / months), "minute")} a month)` : "";
      return [{ id: "rolling:13", text: `Rolling: the last 12 full months plus this one (the default)${per}` }, { id: "rolling:<N>", text: "Rolling: the last N months" }, { id: "fixed:<YYYY-MM>:<YYYY-MM>", text: "Fixed: from a month to a month" }, { id: "since:<YYYY-MM>", text: "Since a month, to the current one (all time from then)" }];
    },
    apply: (v) => {
      const s = String(v).trim();
      const m = s.match(/^(rolling):(\d+)$/) ?? s.match(/^(fixed):(\d{4}-\d{2}):(\d{4}-\d{2})$/) ?? s.match(/^(since):(\d{4}-\d{2})$/);
      if (!m) refuse(`"${printable(s, 40)}" is not rolling:<N>, fixed:<YYYY-MM>:<YYYY-MM> or since:<YYYY-MM>`);
      if (m[1] === "rolling") return { sets: [["sources.0.params.window", { kind: "rolling" }], ["sources.0.params.windowMonths", Number(m[2])]] };
      if (m[1] === "fixed") return { sets: [["sources.0.params.window", { kind: "fixed", from: m[2], to: m[3] }]] };
      return { sets: [["sources.0.params.window", { kind: "since", from: m[2] }]] };
    },
  },
  {
    id: "cadence", kind: "choice", path: "refresh.cadence", judgment: false,
    ask: "How often is it refreshed? Monthly is the default; a refresh can also be run at any time. The pages show a stale banner after the freshness that follows from the cadence.",
    options: () => Object.entries(CADENCES).map(([id, text]) => ({ id, text: `${id}: ${text}; stale after ${plural(FRESHNESS_BY_CADENCE[id], "day")}, from your cadence` })),
    apply: (v, ctx) => {
      if (!(v in CADENCES)) refuse(`"${v}" is not one of ${Object.keys(CADENCES).join(", ")}`);
      // Freshness follows the cadence unless it was typed (ruled 2026-10-05).
      return { sets: [["refresh.cadence", v], ...(ctx.answered.includes("freshness") ? [] : [["freshness.maxAgeDays", FRESHNESS_BY_CADENCE[v]]])], notes: [`stale after ${plural(FRESHNESS_BY_CADENCE[v], "day")}, from your cadence`] };
    },
  },
  {
    id: "metrics", kind: "json", path: "pages[].panels[]", judgment: false,
    ask: "Which optional metrics should the pages show? Click rate counts content-link clicks only (never unsubscribe or mailto links), so it rarely matches the Gainsight UI, and click tracking is often off: a tracked 0% is a real 0%, \"Not tracked\" is never shown as 0%, and an unknown state is shown with a marker. Survey responses are per program on the all-time basis. Each can be left off every page.",
    options: (ctx) => {
      const avail = ctx.preview?.meta?.metricAvailability;
      const states = avail ? `From the dry run: click tracking reads ${Object.entries(avail.clicks.programs).reduce((acc, [, p]) => { acc[p.state] = (acc[p.state] ?? 0) + 1; return acc; }, {})["tracked"] ?? 0} program(s) tracked, ${Object.values(avail.clicks.programs).filter((p) => p.state === "not-tracked").length} not tracked, ${Object.values(avail.clicks.programs).filter((p) => p.state === "unknown").length} unknown; surveys on ${Object.values(avail.responses.programs).filter((p) => p.state === "tracked").length} program(s).` : "The tracking states are read from the first pull (or the dry run).";
      return [{ id: "default", text: `Show both, each with its tracking state (the default). ${states}` }, { id: "<JSON {clicks, responses}>", text: '{"clicks": false, "responses": true} leaves click columns off every page' }];
    },
    apply: (v, ctx) => {
      const want = String(v).trim() === "default" ? { clicks: true, responses: true } : jsonValue(v);
      const drop = [...(want.clicks === false ? OPTIONAL_METRICS.clicks : []), ...(want.responses === false ? OPTIONAL_METRICS.responses : [])];
      const sets = [];
      const notes = [];
      for (const [i, pg] of ctx.spec.pages.entries()) {
        const preset = presetPanels({ ...pg, panels: [] });
        // A page whose panels are the preset, or the preset with optional metrics left off by an earlier answer, is
        // PRESET-DERIVED: this answer rewrites it from the preset, so a metric left off earlier comes back. A page
        // whose panels were changed by hand (`change pages.N.panels=…`) keeps them: the answer cannot tell which of
        // its panels to put back, and says how to start again from the preset.
        const derived = !pg.panels.length || OPTIONAL_METRIC_DROPS.some((d) => isDeepStrictEqual(pg.panels, panelsWithout(preset, d)));
        if (!derived) { notes.push(`page ${pg.id} keeps its own panels (changed by hand); to start again from the preset: change <slug> pages.${i}.panels=[]`); continue; }
        // The preset itself is written as no panels (the page reads the preset's); a drop is written out.
        const next = drop.length ? panelsWithout(preset, drop) : [];
        if (!isDeepStrictEqual(pg.panels, next)) sets.push([`pages.${i}.panels`, next]);
      }
      notes.unshift(drop.length ? `left off every page: ${drop.join(", ")}` : "every optional metric shown");
      return { sets, notes };
    },
  },
  {
    id: "look", kind: "json", path: "theme", judgment: true,
    ask: "Do you have brand guidelines, or a brand design skill? If not, the default look is used. Brand input arrives as data (a file you name, pasted values, or the output of your own brand skill, which you run); the candidate tokens are extracted from it and stored as the theme; a token that would not read is replaced by the default and shown with the reason; the dry-run preview renders in the theme. A logo comes from a local PNG or JPEG you name, never a URL.",
    options: () => [{ id: "skip", text: "The default look (the fast path's default; never asked twice)" }, { id: "<JSON theme>", text: '{"colors": {"accent": "#0b57d0", ...}, "series": ["#0b57d0", ...], "font": "Georgia, serif", "radius": 4, "logoFile": "brand/logo.png"}' }, { id: "clear", text: "Back to the default look" }],
    apply: (v, ctx) => {
      const s = typeof v === "string" ? v.trim() : v;
      if (s === "skip") return { sets: [], notes: ["the default look"] };
      if (s === "clear") return { sets: [["theme", undefined]], notes: ["the default look"] };
      const theme = jsonValue(s);
      if (!theme || typeof theme !== "object" || Array.isArray(theme)) refuse("the look answer must be a JSON object of theme tokens, skip, or clear");
      const { logoFile, ...rest } = theme;
      if (isText(logoFile)) rest.logo = ctx.readLogoFile(logoFile);
      const { notes } = validateTheme({ ...rest, notes: [] });
      // The validator's notes are stored with the theme (T-11 theme.notes), so the About tab and a later edit see them.
      return { sets: [["theme", { ...rest, notes }]], notes: notes.map((n) => `${n.token}: ${n.reason} (given ${JSON.stringify(n.given)}, now ${JSON.stringify(n.replacedWith)})`), replaced: notes };
    },
  },
  {
    id: "tabs", kind: "json", path: "pages[].tabs[].enabled", judgment: false, needsPlan: true,
    ask: "Which tabs does each page carry? Engagement and About are always on. Health (error rates, failure reasons, silent programs, schedules) and Templates (each email's performance, text and keyword search) are on for admins and off for leaders by default. Turning Health on later makes the next refresh a full one.",
    options: (ctx) => {
      const h = ctx.plan?.estimate?.health;
      const cost = h ? `${h.on ? `Health is in this plan already.` : `Turning Health on adds ${secondsText(h.addsSeconds)} to each refresh (${h.addsCalls} calls).`}${categoryCostText(h)}` : "The minutes Health adds are priced once a plan exists.";
      return [{ id: "default", text: `The presets: admins every tab, leaders Engagement and About. ${cost}` }, { id: "<JSON per page>", text: JSON.stringify(Object.fromEntries(tabsOf(ctx.spec).map((t) => [t.page, { health: t.health, templates: t.templates }]))) }];
    },
    apply: (v, ctx) => {
      if (String(v).trim() === "default") return { sets: ctx.spec.pages.map((pg, i) => [`pages.${i}.tabs`, Object.keys(TABS).map((tab) => ({ id: tab, enabled: PRESETS[pg.preset].page.tabs[tab] }))]) };
      const want = jsonValue(v);
      const sets = ctx.spec.pages.map((pg, i) => {
        const w = want?.[pg.id] ?? {};
        return [`pages.${i}.tabs`, pg.tabs.map((t) => ({ id: t.id, enabled: t.id === "health" && "health" in w ? !!w.health : t.id === "templates" && "templates" in w ? !!w.templates : t.enabled }))];
      });
      return { sets };
    },
  },
  {
    id: "leader-names", kind: "boolean", path: "pages[].accountNames", judgment: false, skip: (ctx) => execPage(ctx.spec) < 0,
    ask: "May the leaders' copy name customers? Default no: the leaders' page then holds program and template names, counts, rates and the About text, and no account rows at all.",
    options: () => [{ id: "no", text: "No (the default)" }, { id: "yes", text: "Yes: the leaders' page may carry the customer lists with account names" }],
    apply: (v, ctx) => ({ sets: [[`pages.${execPage(ctx.spec)}.accountNames`, boolValue(v)]] }),
  },
  {
    id: "customer-lists", kind: "boolean", path: "accounts.pull", judgment: false, needsPlan: true,
    ask: "Do you want this dashboard to tell you the top customers that aren't opening or are bouncing, or only how each program is doing? You can add them later.",
    options: (ctx) => {
      const a = ctx.plan?.estimate?.accounts;
      const base = ctx.plan?.estimate?.full?.seconds ?? null;
      const cost = a ? `Adding the customer lists makes the first pull ${secondsText((base ?? 0) + (a.on ? 0 : a.addsSeconds))} instead of ${secondsText(a.on ? (base ?? 0) - a.addsSeconds : base)} on a tenant this size.` : "The cost is priced once a plan exists.";
      return [
        { id: "no", text: `Only how each program is doing (the default). Kept without the lists: every program, template and step number, and how many accounts each program reached. ${cost}` },
        { id: "yes", text: `The customer lists too: across programs, the most engaged, the least engaged and the most bounced accounts, with each account's programs underneath and an in-page account view. ${cost} To add them later: edit the dashboard, turn customer lists on, refresh (that refresh pulls every table again). Looking a company up needs a gs-admin login, so only an admin can run the account command; anyone else sees a company only through the page's account view, which exists only when accounts were pulled, and only for the accounts kept.` },
      ];
    },
    apply: (v) => ({ sets: [["accounts.pull", boolValue(v)]] }),
  },
  {
    id: "customer-list-detail", kind: "json", path: "accounts.lists[]", judgment: false, skip: (ctx) => !ctx.spec.accounts.pull,
    ask: "The three customer lists are 25 most engaged, 25 least engaged and 25 most bounced, each with a delivered floor of 10 across programs (so one unopened email is not a risk); on a program that sends about once per contact the least-engaged signal is at least 3 delivered and no open. Keep them, or give your own lists and any company fields for \"per segment\" lists.",
    options: () => [{ id: "default", text: `The three defaults: ${DEFAULT_ACCOUNT_LISTS.map((l) => `${l.n} ${l.kind.replace("-", " ")} (floor ${l.floor})`).join(", ")}` }, { id: "<JSON {lists, fields}>", text: '{"lists": [{"kind": "least-engaged", "n": 10, "floor": 5, "per": "Industry"}], "fields": ["Industry"]}' }],
    apply: (v) => {
      if (String(v).trim() === "default") return { sets: [["accounts.lists", DEFAULT_ACCOUNT_LISTS.map((l) => ({ ...l }))], ["accounts.fields", []]] };
      const j = jsonValue(v);
      return { sets: [["accounts.fields", Array.isArray(j.fields) ? j.fields : []], ["accounts.lists", Array.isArray(j.lists) ? j.lists : DEFAULT_ACCOUNT_LISTS.map((l) => ({ ...l }))]] };
    },
  },
  {
    id: "step-detail", kind: "boolean", path: "sources[].params.stepDetail", judgment: false, needsPlan: true,
    ask: "Step detail: one dashboard-wide switch that adds per-step and per-variant rows and participant records, from a second send log. Off by default.",
    options: (ctx) => {
      const s = ctx.plan?.estimate?.stepDetail;
      return [{ id: "no", text: "Off (the default): emails per template, with the step's name where a template sits on one step" }, { id: "yes", text: `On: ${s ? `adds ${secondsText(s.addsSeconds)} to each refresh (${s.addsCalls} calls)` : "the minutes it adds are priced once a plan exists"}` }];
    },
    apply: (v) => ({ sets: [["sources.0.params.stepDetail", boolValue(v)]] }),
  },
  {
    id: "expected-reasons", kind: "list", path: "sources[].params.expectedReasons[]", judgment: false,
    ask: "Are there participant-failure wordings that are expected by design on this tenant (a business rule working as configured)? They are counted apart, never hidden. Give the wording's invariant core, or none.",
    options: () => [{ id: "none", text: "None beyond the shipped list (the default)" }, { id: "<wordings>", text: "A comma-separated list, or a JSON list" }],
    apply: (v) => ({ sets: [["sources.0.params.expectedReasons", String(v).trim().toLowerCase() === "none" ? [] : listValue(v)]] }),
  },
  {
    id: "dry-run", kind: "action", path: null, judgment: false,
    ask: "Dry run: a cheap program-level pull (no customer lists, no health, no step detail) rendered as preview pages in the theme, so you can see the result on real data before the first full refresh.",
    options: () => [{ id: "yes", text: "Run it now (minutes, with the login)" }, { id: "no", text: "Skip the preview" }],
  },
  {
    id: "estimate", kind: "action", path: null, judgment: false, needsPlan: true,
    ask: "The cost of a full refresh with these settings, against the login: confirm, or go back and change a setting.",
    options: (ctx) => {
      const e = ctx.plan?.estimate;
      return [{ id: "yes", text: e ? `Confirm: ${e.full.calls} calls, ${secondsText(e.full.seconds)}; the login ${e.token.fits ? "covers it" : "does NOT cover it (log in again first)"}${e.kb ? `; the knowledge base is behind on ${e.kb.undocumented + e.kb.behind} program(s) (${secondsText(e.kb.refreshSeconds)} to re-document)` : ""}${e.templates?.planned ? `; ${e.templates.planned} template(s) to fetch (${secondsText(e.templates.seconds)})` : ""}` : "Confirm (no plan could be made)" }, { id: "no", text: "Not yet: change a setting first (answer it again)" }];
    },
  },
  {
    id: "save", kind: "action", path: null, judgment: false,
    ask: "Save the dashboard and run its first refresh?",
    options: () => [{ id: "yes", text: "Save and refresh now" }, { id: "later", text: "Save only; refresh later with: refresh <slug>" }],
  },
]);
const questionById = (id) => QUESTIONS.find((q) => q.id === id) ?? refuse(`no question is called "${printable(String(id), 40)}" (${QUESTIONS.map((q) => q.id).join(", ")})`);
/** The preset's panels with some metrics left off every query (the metrics question): a panel left with no metric is dropped. */
/** The optional metric groups the metrics question can leave off, by the answer's key. */
export const OPTIONAL_METRICS = Object.freeze({ clicks: Object.freeze(["clicked", "clickRate"]), responses: Object.freeze(["surveyParticipants", "submitted", "partiallySubmitted", "anyResponse", "responseRate"]) });
/** Every drop an earlier metrics answer could have written (the empty one, each group, both): what a preset-derived panel list equals. */
const OPTIONAL_METRIC_DROPS = Object.freeze([[], [...OPTIONAL_METRICS.clicks], [...OPTIONAL_METRICS.responses], [...OPTIONAL_METRICS.clicks, ...OPTIONAL_METRICS.responses]]);
export function panelsWithout(panels, drop) {
  const gone = new Set(drop);
  return panels.flatMap((p) => {
    if (!p.query) return [p];
    const metrics = p.query.metrics.filter((m) => !gone.has(m));
    if (!metrics.length) return [];
    const q = { ...p.query, metrics };
    if (q.sort) q.sort = q.sort.filter((s) => !s.metric || metrics.includes(s.metric));
    if (q.having) q.having = q.having.filter((h) => metrics.includes(h.metric));
    const columns = p.columns ? p.columns.filter((c) => metrics.includes(c)) : undefined;
    return [{ ...p, query: q, ...(columns ? { columns } : {}) }];
  }).map((p) => (p.columns && !p.columns.length ? (({ columns: _c, ...rest }) => rest)(p) : p));
}

// ── The context every verb works in ──────────────────────────────────────────
function openContext(argv, opt) {
  const wsDir = opt("--workspace") ? resolve(opt("--workspace")) : findWorkspaceDir(process.cwd());
  if (!wsDir || !existsSync(join(wsDir, ".gs-superadmin"))) refuse("no gs-superadmin workspace here (no .gs-superadmin/ in this directory or above it) — run from a workspace or pass --workspace <dir>");
  let kbDir = opt("--kb") ? resolve(opt("--kb")) : null;
  if (!kbDir) {
    const found = readdirSync(wsDir, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(wsDir, d.name, "_manifest.json"))).map((d) => join(wsDir, d.name));
    if (found.length !== 1) refuse(found.length ? `this workspace holds ${found.length} tenant KB folders (${found.map((f) => basename(f)).join(", ")}) — pass --kb <the one this dashboard belongs to>` : "no tenant KB folder in this workspace (no */_manifest.json) — run /gs-superadmin:setup first");
    kbDir = found[0];
  }
  const store = specStore(kbDir);
  const catalog = findWorkspaceCatalog(wsDir, join(here, "..", "reference", "catalog.json"));
  if (!catalog) refuse("no catalog found (workspace or bundled) — cannot verify the adapter's commands are read-only; refusing");
  const today = opt("--today") ?? (() => { const c = new Date(); return `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, "0")}-${String(c.getDate()).padStart(2, "0")}`; })();
  const nowMs = opt("--now") ? Date.parse(opt("--now")) : Date.now();
  if (!Number.isFinite(nowMs)) refuse(`--now must be an ISO date-time (got "${printable(opt("--now") ?? "", 40)}")`);
  let pluginVersion = null;
  try { pluginVersion = readJsonFile(join(here, "..", ".claude-plugin", "plugin.json")).version ?? null; } catch { /* a copy without its manifest */ }
  const binOpt = opt("--bin") ?? null;
  let transport = null;
  const live = () => {
    if (!transport) transport = cliTransport({ cliArgv: resolveCliArgv({ binOpt, fail: (m) => refuse(m) }) });
    return transport;
  };
  const gate = makeGate({ catalog, hooksDir: join(here, "..", "hooks") });
  const identity = readKbIdentity(kbDir, []);
  return {
    wsDir, kbDir, store, catalog, today, todayGiven: opt("--today") !== undefined, nowMs, pluginVersion, binOpt, gate, live, identity,
    by: holderName(opt("--by") ?? null), takeOver: argv.includes("--take-over"),
    log: (line) => console.error(`dashboard.mjs: ${line}`),
  };
}
const dirOf = (ctx, slug) => ctx.store.paths(slug).dir;
const writeJson = (path, value) => writeFileAtomicSync(path, JSON.stringify(value, null, 2) + "\n");
const readJsonOr = (path, fallback = null) => (existsSync(path) ? readJsonFile(path) : fallback);
const savedSpec = (ctx, slug) => {
  const raw = ctx.store.readSaved(slug);
  if (!raw) refuse(ctx.store.readDraft(slug) ? `"${slug}" is a draft, not a saved dashboard yet — finish the questions (next/answer) and save it, or change it with --dry-run` : `no dashboard "${slug}" in ${basename(ctx.kbDir)} — list shows the ones there`);
  return openSpec(raw);
};
// ── Snapshots: the latest, the one before, retention ─────────────────────────
const snapshotStamp = (pulledAt) => String(pulledAt).replace(/[^0-9T]/g, "").slice(0, 15);
function snapshotFiles(ctx, slug) {
  const dir = join(dirOf(ctx, slug), SNAPSHOTS_DIR);
  return existsSync(dir) ? readdirSync(dir).filter((f) => /\.json$/.test(f) && !f.startsWith("preview")).sort(cmpKey).map((f) => join(dir, f)) : [];
}
const latestSnapshotPath = (ctx, slug) => snapshotFiles(ctx, slug).at(-1) ?? null;
const openSnapshotFile = (path) => engine.openSnapshot(readJsonFile(path));
function pruneSnapshots(ctx, slug) {
  const files = snapshotFiles(ctx, slug);
  const pruned = files.slice(0, Math.max(0, files.length - KEEP_SNAPSHOTS));
  for (const f of pruned) unlinkSync(f);
  return pruned.map((f) => basename(f));
}
// ── The lock ─────────────────────────────────────────────────────────────────
function takeLock(ctx, slug, run) {
  const path = join(dirOf(ctx, slug), LOCK_FILE);
  let takenOver = null;
  if (existsSync(path)) {
    const held = readJsonOr(path, {});
    const age = ctx.nowMs - Date.parse(held.at ?? 0);
    if (Number.isFinite(age) && age < LOCK_STALE_MS) refuse(`a refresh of "${slug}" is already running: started by ${held.by ?? "unknown"} at ${held.at} (${plural(Math.round(age / 60000), "minute")} ago) — wait for it, or remove ${path} if you know it died`);
    takenOver = held;
  }
  writeJson(path, { by: ctx.by, at: new Date(ctx.nowMs).toISOString(), pid: process.pid, run });
  return { path, release: () => rmSync(path, { force: true }), takenOver };
}
const lockState = (ctx, slug) => {
  const path = join(dirOf(ctx, slug), LOCK_FILE);
  if (!existsSync(path)) return { held: false };
  const held = readJsonOr(path, {});
  const age = ctx.nowMs - Date.parse(held.at ?? 0);
  return { held: true, by: held.by ?? null, at: held.at ?? null, stale: !Number.isFinite(age) || age >= LOCK_STALE_MS, run: held.run ?? null };
};
// ── The tenant and the token, before any call ────────────────────────────────
function preflight(ctx, spec) {
  const r = ctx.live().run({ id: "whoami", argv: ["whoami"], timeoutMs: 60000 });
  if (!r.ok) refuse(`gs-admin whoami failed: ${r.stderr.trim() || `exit ${r.status}`}`);
  const who = parseWhoami(r.stdout);
  if (!who.host) refuse("whoami shows no Base URL — the CLI has no tenant selected");
  if (who.host !== spec.tenantHost) refuse(`the CLI is on ${who.host}, and this dashboard belongs to ${spec.tenantHost} — switch tenants (gs-admin config --base-url …) or pick the dashboard of that tenant; nothing was called`, "wrong-tenant");
  if (who.tokenState !== "valid") refuse(`whoami reports the token as ${who.tokenState} — run \`gs-admin login\`, then run this again`, "token-expired");
  return who;
}
function categoriesFor(ctx) {
  const path = join(ctx.kbDir, CATEGORIES_FILE);
  if (!existsSync(path)) return { file: null, categories: {} };
  const c = readJsonFile(path);
  if (!c || typeof c !== "object" || Array.isArray(c)) refuse(`${path} must hold an object {bounceReasons: [...], participantFailures: [...]}`);
  return { file: path, categories: c };
}
// ── The plan and the pull, through the adapter ───────────────────────────────
function runAdapter(ctx, { spec, runId, phase, previousPath, forceFull = false, healthOnly = false, preview = false, lookbackDays = null }) {
  const { categories, file: categoriesFile } = categoriesFor(ctx);
  const paramsOn = (today) => resolveParams(adapterParams(spec, { today, forceFull, healthOnly, lookbackDays, categories, preview }));
  const previous = previousPath ? openSnapshotFile(previousPath) : null;
  // A resumed run keeps the day it was planned on unless --today was given (F-483), as the adapter's own CLI does.
  const { runDir, params, resumed } = prepareRun({ wsDir: ctx.wsDir, runId, params: paramsOn(ctx.today), previousPath, cliVersion: ctx.catalog.meta?.cliVersion ?? null, todayGiven: ctx.todayGiven, reparams: paramsOn });
  const summary = fetchEngagement({ params, runDir, kbDir: ctx.kbDir, previous, phase, transport: ctx.live(), gate: ctx.gate, onCall: (line) => ctx.log(`${phase === "plan" ? "plan" : "pull"} ${line}`) });
  return { runDir, params, resumed, summary, previous, categoriesFile };
}
/** The plan twice when the derived lookback moves (ENG-2 item 3): the second plan is the one the pull resumes. */
function planWithLookback(ctx, args) {
  const first = runAdapter(ctx, { ...args, phase: "plan" });
  if (first.summary.status !== "ok") return first;
  const longest = first.summary.estimate?.health?.lookback?.longestPeriodDays ?? null;
  const derived = Math.max(args.spec.health.silentDays, longest ?? 0);
  if (!first.params.health.pull || derived === first.params.health.lookbackDays) return { ...first, lookbackDays: first.params.health.lookbackDays };
  const second = runAdapter(ctx, { ...args, phase: "plan", lookbackDays: derived, runId: `${args.runId}-lb${derived}` });
  return { ...second, lookbackDays: second.params.health.lookbackDays, lookbackDerivedFrom: longest };
}
const stableRunId = (ctx, spec, what) => `dash-${spec.slug}-${what}-${sha(adapterParams(spec, { today: ctx.today }))}`;
// ── Re-documentation, with no model (PUB-1 ruling; TPL-1 choice 3) ───────────
function journeyDomain(ctx) {
  const manifest = readJsonOr(join(ctx.kbDir, "_manifest.json"), {});
  const resolver = makeCommandResolver(ctx.catalog);
  for (const [name, rec] of Object.entries(manifest.domains_indexed ?? {})) {
    if (typeof rec?.listCommand === "string" && resolver.resolveLine(rec.listCommand)?.path === RECORDED_LANES.journey.path) return name;
  }
  return RECORDED_LANES.journey.folder;
}
function runScript(ctx, script, args) {
  const r = spawnSync(process.execPath, [script, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch { /* a refusal prints no JSON */ }
  return { ok: r.status === 0, status: r.status, json, stderr: String(r.stderr ?? "").trim() };
}
/**
 * The knowledge base beside the pull: re-document the selected programs the plan found the KB behind on (modified
 * since documented, or never documented: the adapter's kbGap, the ONE predicate) and fetch the templates it lacks,
 * through the manifest and describe-batch scripts (the ONE re-documenter, as the knowledge-base skills run it),
 * under one per-refresh cap. Returns what was done and what is left for next time.
 */
function redocument(ctx, { spec, estimate, runDir }) {
  const settings = kbSettings(spec).redocument;
  const out = { enabled: settings.enabled, cap: settings.cap, programs: { behind: (estimate.kb?.undocumented ?? 0) + (estimate.kb?.behind ?? 0), unlisted: estimate.kb?.unlisted ?? 0, documented: 0, failed: 0, remaining: 0, stillBehind: [] }, templates: { planned: estimate.templates?.planned ?? 0, documented: 0, failed: 0, remaining: 0 }, calls: 0, aborted: null };
  if (!settings.enabled) { out.programs.remaining = out.programs.behind; out.templates.remaining = out.templates.planned; return out; }
  let budget = settings.cap;
  const manifestPath = join(ctx.kbDir, "_manifest.json");
  const bin = ctx.binOpt ? ["--bin", ctx.binOpt] : [];
  const batch = (args, left) => {
    const r = runScript(ctx, DESCRIBE_BATCH_SCRIPT, [...args, "--limit", String(left), ...bin]);
    if (!r.ok && !r.json) refuse(`describe-batch refused: ${r.stderr.slice(-400)}`);
    const s = r.json ?? {};
    // describe-batch's summary: documented and failed are counts, failures the list, moreRemaining and aborted as its header says.
    const documented = Number(s.documented ?? 0);
    const failed = Number(s.failed ?? (Array.isArray(s.failures) ? s.failures.length : 0));
    out.calls += documented + failed;
    return { documented, failed, moreRemaining: !!s.moreRemaining, aborted: s.aborted ?? null, failures: s.failures ?? [] };
  };
  // Programs first: the ones the list holds (an unlisted program has no row to register and stays named).
  const kb = estimate.kb ?? {};
  if (budget > 0 && kb.keysFile && existsSync(kb.keysFile)) {
    const domain = journeyDomain(ctx);
    if (kb.undocumented > 0 && kb.listFile && existsSync(kb.listFile)) {
      const reg = runScript(ctx, MANIFEST_SCRIPT, ["upsert-batch", "--manifest", manifestPath, "--domain", domain, "--file", kb.listFile, "--id-field", "advancedOutreachId", "--name-field", "advancedOutreachName", "--partial"]);
      if (!reg.ok) refuse(`manifest upsert-batch refused: ${reg.stderr.slice(-400)}`);
    }
    const marked = runScript(ctx, MANIFEST_SCRIPT, ["mark", "--manifest", manifestPath, "--keys-file", kb.keysFile, "--status", "stale"]);
    if (!marked.ok) refuse(`manifest mark refused: ${marked.stderr.slice(-400)}`);
    const r = batch(["--manifest", manifestPath, "--domain", domain, "--command", "gs-admin --json jo p describe --id {id}", "--doc-mode", "program", "--out-dir", join(ctx.kbDir, domain), "--keys-file", kb.keysFile], budget);
    out.programs.documented = r.documented;
    out.programs.failed = r.failed;
    out.programs.remaining = Math.max(0, out.programs.behind - out.programs.unlisted - r.documented);
    budget = Math.max(0, budget - r.documented - r.failed);
    if (r.aborted) out.aborted = { step: "programs", ...r.aborted };
    const keys = readJsonOr(kb.keysFile, []);
    const inv = readJsonOr(manifestPath, {}).inventory ?? {};
    out.programs.stillBehind = keys.filter((k) => inv[k]?.status !== "documented").map((k) => String(k).split("/").pop());
  } else out.programs.remaining = Math.max(0, out.programs.behind - out.programs.unlisted);
  // Then the templates the KB lacks, through email-report's own gap-fill commands, with what is left of the cap.
  const t = estimate.templates ?? {};
  if (!out.aborted && budget > 0 && t.planned > 0 && t.keysFile && existsSync(t.keysFile) && t.domain) {
    if (t.listFile && existsSync(t.listFile)) {
      const reg = runScript(ctx, MANIFEST_SCRIPT, ["upsert-batch", "--manifest", manifestPath, "--domain", t.domain, "--file", t.listFile, "--id-field", t.idField, "--partial"]);
      if (!reg.ok) refuse(`manifest upsert-batch (templates) refused: ${reg.stderr.slice(-400)}`);
    }
    if (t.staleKeysFile && existsSync(t.staleKeysFile)) {
      const marked = runScript(ctx, MANIFEST_SCRIPT, ["mark", "--manifest", manifestPath, "--keys-file", t.staleKeysFile, "--status", "stale"]);
      if (!marked.ok) refuse(`manifest mark (templates) refused: ${marked.stderr.slice(-400)}`);
    }
    const r = batch(["--manifest", manifestPath, "--domain", t.domain, "--command", "gs-admin --json jo email template --id {id}", "--doc-mode", "template", "--out-dir", join(ctx.kbDir, t.domain), "--keys-file", t.keysFile], budget);
    out.templates.documented = r.documented;
    out.templates.failed = r.failed;
    out.templates.remaining = Math.max(0, t.planned - r.documented);
    if (r.aborted) out.aborted = { step: "templates", ...r.aborted };
  } else out.templates.remaining = t.planned ?? 0;
  out.capped = out.programs.remaining + out.templates.remaining > 0 && settings.cap > 0;
  void runDir;
  return out;
}
// ── The delta against the previous snapshot (PUB-1; the exec strip) ──────────
export function computeDelta(spec, current, previous) {
  if (!previous) return null;
  const closedOf = (s) => s.dimensions.months.filter((m) => m < s.meta.incompleteFrom.slice(0, 7));
  const common = closedOf(current).filter((m) => closedOf(previous).includes(m));
  const ids = [...new Set(spec.pages.flatMap((pg) => presetPanels(pg).filter((p) => p.type === "kpi" && p.query).flatMap((p) => p.query.metrics)))];
  const metrics = {};
  for (const id of ids) {
    const def = engine.metric(id);
    const rate = def.kind === "rate" || def.status === "rate";
    const at = (s) => (common.length ? engine.runQuery(s, { months: common }, { groupBy: [], metrics: [id] }).total.cells[id].value : null);
    const cur = at(current);
    const prev = at(previous);
    const change = cur == null || prev == null ? null : rate ? { kind: "points", value: (cur - prev) * 100 } : { kind: "ratio", value: prev === 0 ? null : cur / prev };
    metrics[id] = { previous: prev, current: cur, change };
  }
  const prevIds = new Set(previous.dimensions.programs.map((p) => p.id));
  const curIds = new Set(current.dimensions.programs.map((p) => p.id));
  return { previousPulledAt: previous.meta.pulledAt, closedMonths: common, metrics, programs: { added: [...curIds].filter((id) => !prevIds.has(id)).length, gone: [...prevIds].filter((id) => !curIds.has(id)).length } };
}
// ── The pages ────────────────────────────────────────────────────────────────
function buildPages(ctx, { spec, snapshot, delta, outDir }) {
  const sources = inlinedSources();
  const built = spec.pages.map((pg) => buildPage({ spec, snapshot, pageId: pg.id, ...sources, delta }));
  const refused = built.filter((b) => b.report.refused);
  // All or nothing: a refused page leaves every last good page as it was.
  if (refused.length) refuse(`page "${refused[0].report.page}": ${refused[0].report.refused} — no page was replaced`);
  mkdirSync(outDir, { recursive: true });
  for (const b of built) { writeFileAtomicSync(join(outDir, b.report.file), b.html); b.report.written = true; }
  for (const b of built) if (b.report.warning) ctx.log(`page "${b.report.page}": ${b.report.warning}`);
  return built.map((b) => ({ ...b.report, path: join(outDir, b.report.file) }));
}
function rebuildFrom(ctx, { spec, snapshotPath, previousPath, outDir }) {
  const pulled = openSnapshotFile(snapshotPath);
  const previous = previousPath ? openSnapshotFile(previousPath) : null;
  const { snapshot, resolution } = applyGroups(pulled, spec.groups, { previous });
  const delta = computeDelta(spec, snapshot, previous);
  const pages = buildPages(ctx, { spec, snapshot, delta, outDir });
  return { pages, ungrouped: resolution.line, delta: delta ? { previousPulledAt: delta.previousPulledAt, closedMonths: delta.closedMonths.length, programs: delta.programs } : null, pulledAt: snapshot.meta.pulledAt };
}

// ── The verbs ────────────────────────────────────────────────────────────────
function verbNew(ctx, slug, opt, argv) {
  const r = ctx.store.startDraft(slug, { title: opt("--title") ?? null, owner: opt("--owner") ?? null, by: ctx.by, takeOver: ctx.takeOver });
  let answered = r.answered;
  if (argv.includes("--fast-path") && r.state !== "resumed") {
    // The standard program-health dashboard: every question but the estimate and the save takes its default (the look
    // skipped, never asked twice); the tenant is still checked at next.
    const skip = QUESTIONS.filter((q) => !["tenant", "estimate", "save"].includes(q.id)).map((q) => q.id);
    answered = ctx.store.setDraft(slug, { answered: skip, by: ctx.by, takeOver: ctx.takeOver }).answered;
  }
  return { ok: true, mode: "new", slug, state: r.state, fastPath: argv.includes("--fast-path"), by: r.by, answered, next: nextQuestionId(ctx, slug) };
}
function interviewState(ctx, slug) { return readJsonOr(join(dirOf(ctx, slug), INTERVIEW_FILE), { plan: null, preview: null }); }
function saveInterviewState(ctx, slug, state) { mkdirSync(dirOf(ctx, slug), { recursive: true }); writeJson(join(dirOf(ctx, slug), INTERVIEW_FILE), state); }
/** The interview's context: the draft's spec, what is answered, and the plan and preview snapshot when they exist. */
function interviewContext(ctx, slug, { draft }) {
  const spec = draft.spec;
  const state = interviewState(ctx, slug);
  const planRun = state.plan?.run ? join(ctx.wsDir, ".gs-superadmin", "tmp", "engagement", state.plan.run) : null;
  const plan = planRun && existsSync(join(planRun, "plan.json")) && state.plan.hash === sha(adapterParams(spec, { today: ctx.today })) ? readJsonFile(join(planRun, "plan.json")) : null;
  const previewPath = state.preview?.snapshot && existsSync(state.preview.snapshot) ? state.preview.snapshot : null;
  // The preview snapshot is megabytes on a real tenant: parsed once, and only by the question that reads it (metrics).
  let preview;
  return {
    spec, answered: draft.answered, plan, planRun, previewPath, get preview() { return previewPath ? (preview ??= openSnapshotFile(previewPath)) : null; },
    params: adapterParams(spec, { today: ctx.today }), programs: plan ? readJsonOr(join(planRun, "programs.json"), []) : [],
    suggestionFile: join(dirOf(ctx, slug), SUGGESTION_FILE),
    lookupCompany: (name) => lookupCompany(ctx, spec, name),
    readLogoFile: (file) => readLogoFile(ctx, file),
  };
}
/** The plan for the interview (cheap calls only), kept until the pull-affecting answers move; writes the programs list and the group-suggestion input. */
function ensurePlan(ctx, slug, ictx) {
  if (ictx.plan) return ictx;
  const spec = ictx.spec;
  preflight(ctx, spec);
  const runId = stableRunId(ctx, spec, "plan");
  const r = runAdapter(ctx, { spec, runId, phase: "plan", previousPath: null });
  if (r.summary.status !== "ok") refuse(`the plan did not finish: ${r.summary.stopped ?? r.summary.status} — ${r.summary.status === "token-expired" ? "run gs-admin login, then ask for the next question again" : "ask for the next question again; if it fails again, the failed list is in the run directory"}`, r.summary.status === "token-expired" ? "token-expired" : "partial");
  // The program list and the sends per program, from the plan's own reads: what the grouping proposal is made from.
  const run = loadRunLightly(r.runDir);
  const programs = run.programs;
  const traits = programTraitsOf(programs, {});
  const table = suggestionTable({ traits, sent: run.sent, tenantHost: spec.tenantHost, pulledAt: null, window: { from: r.params.window.from, to: r.params.window.to } });
  writeJson(join(r.runDir, "programs.json"), programs);
  mkdirSync(dirOf(ctx, slug), { recursive: true });
  writeJson(join(dirOf(ctx, slug), SUGGESTION_FILE), table);
  saveInterviewState(ctx, slug, { ...interviewState(ctx, slug), plan: { run: runId, hash: sha(adapterParams(spec, { today: ctx.today })), at: new Date(ctx.nowMs).toISOString() } });
  return { ...ictx, plan: readJsonFile(join(r.runDir, "plan.json")), planRun: r.runDir, programs };
}
/** The plan's program list and sends per program, read from the run directory's payloads through the adapter's own readers (no fact call). */
function loadRunLightly(runDir) {
  const log = readFileSync(join(runDir, "fetch-log.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.status === "ok");
  const read = (r) => readJsonFile(join(runDir, r.file));
  const pages = log.filter((r) => r.family === "programs").sort((a, b) => a.page - b.page).map(read);
  const listed = [...pages.flatMap((pg) => pg?.data?.advancedOutreaches ?? [])];
  const kb = readJsonOr(join(runDir, "kb-steps.json"), null);
  const sent = new Map();
  for (const r of log.filter((x) => x.family === "totals" && x.cls === "all")) for (const row of read(r)) { const t = ROW_READERS.totals(row); if (t.programId != null && t.n != null) sent.set(t.programId, (sent.get(t.programId) ?? 0) + t.n); }
  const programs = listed.filter((p) => sent.has(String(p.advancedOutreachId))).map((p) => {
    const st = p.advancedOutreachStatus;
    const doc = kb?.schedules?.[p.advancedOutreachId] ?? null;
    const first = doc?.schedules?.[0] ?? null;
    return {
      id: String(p.advancedOutreachId), name: p.advancedOutreachName ?? null, statuses: (Array.isArray(st) ? st : [st]).filter(Boolean), model: p.advancedOutreachModel ?? null, modelName: p.advancedOutreachModelName ?? null,
      audienceType: p.advancedOutreachType ?? null, folderId: p.folderId != null ? String(p.folderId) : null, supergroup: null, group: null,
      schedule: doc ? { classification: doc.schedules.some((s) => s.classification === "recurring") ? "recurring" : doc.schedules.some((s) => s.classification === "one-time") ? "one-time" : doc.schedules.length ? doc.schedules[0].classification : "no schedule captured", cronExpression: first?.cronExpression ?? null, timeZoneName: first?.timeZoneName ?? null, asOf: doc.asOf ?? null } : null,
    };
  }).sort((a, b) => cmpKey(a.id, b.id));
  return { programs, sent };
}
function lookupCompany(ctx, spec, name) {
  preflight(ctx, spec);
  const argv = rpRunArgv({ object: "company", group: [], show: [{ name: "Gsid" }, { name: "Name" }], where: [{ leftOperand: { fieldName: "Name" }, operator: "EQ", rightOperand: { value: name } }] }, 50);
  const refusal = ctx.gate(argv);
  if (refusal) refuse(refusal);
  const r = ctx.live().run({ id: "lookup", argv, timeoutMs: 120000 });
  if (!r.ok) refuse(`the account lookup failed: ${r.stderr.trim() || `exit ${r.status}`}`);
  let rows;
  try { rows = JSON.parse(r.stdout); } catch { refuse("the account lookup's answer is not JSON"); }
  return (Array.isArray(rows) ? rows : []).map((row) => ROW_READERS["account-names"](row)).filter((a) => a.key).map((a) => ({ key: a.key, name: a.name }));
}
function readLogoFile(ctx, file) {
  const path = resolve(ctx.wsDir, file);
  if (!existsSync(path)) refuse(`the logo file ${file} does not exist (a local PNG or JPEG, never a URL)`);
  const bytes = readFileSync(path);
  if (bytes.length > LOGO_MAX_BYTES) refuse(`the logo ${file} is ${Math.round(bytes.length / 1024)} KB; the cap is ${LOGO_MAX_BYTES / 1024} KB before encoding`);
  const type = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? "image/png" : bytes[0] === 0xff && bytes[1] === 0xd8 ? "image/jpeg" : null;
  if (!type) refuse(`the logo ${file} is not a PNG or a JPEG by its bytes (an SVG is never accepted: it can carry script)`);
  const uri = `data:${type};base64,${bytes.toString("base64")}`;
  const r = readLogo(uri);
  if (r.ok === false) refuse(`the logo ${file}: ${r.problem}`);
  return uri;
}
function nextQuestionId(ctx, slug) {
  const draft = ctx.store.readDraft(slug);
  if (!draft) return null;
  const ictx = interviewContext(ctx, slug, { draft });
  // The tenant pre-flight is never asked: next makes it on its way to the first question.
  return QUESTIONS.find((q) => q.kind !== "preflight" && !draft.answered.includes(q.id) && !(q.skip && q.skip(ictx)))?.id ?? null;
}
function verbNext(ctx, slug) {
  const draft = ctx.store.readDraft(slug);
  if (!draft) refuse(ctx.store.readSaved(slug) ? `"${slug}" is saved; to change it use change, or start an edit with new ${slug}` : `no draft "${slug}" — start one with new ${slug}`);
  // Another holder's draft is refused here too (ruled 2026-10-05, DSH-1 item 8): startDraft claims it or refuses.
  ctx.store.startDraft(slug, { by: ctx.by, takeOver: ctx.takeOver });
  let ictx = interviewContext(ctx, slug, { draft: ctx.store.readDraft(slug) });
  const skipped = [];
  for (const q of QUESTIONS) {
    if (draft.answered.includes(q.id)) continue;
    if (q.skip && q.skip(ictx)) { skipped.push(q.id); continue; }
    if (q.id === "tenant") {
      const who = preflight(ctx, ictx.spec);
      ctx.store.setDraft(slug, { answered: ["tenant"], by: ctx.by, takeOver: ctx.takeOver });
      ictx = { ...ictx, answered: [...ictx.answered, "tenant"] };
      ctx.log(`tenant ${who.host} confirmed; token valid for ${who.expiresInSeconds} s`);
      continue;
    }
    if (q.needsPlan) ictx = ensurePlan(ctx, slug, ictx);
    const done = ictx.answered.filter((id) => QUESTIONS.some((x) => x.id === id));
    return {
      ok: true, mode: "next", slug, question: { id: q.id, ask: q.ask, kind: q.kind, judgment: q.judgment, path: q.path, options: q.options(ictx), ...(q.input ? { input: q.input(ictx) } : {}) },
      progress: { answered: done.length, skipped, remaining: QUESTIONS.filter((x) => !done.includes(x.id) && !skipped.includes(x.id)).length },
      ...(ictx.plan ? { estimate: { full: ictx.plan.estimate.full, thisRun: ictx.plan.estimate.thisRun, token: ictx.plan.estimate.token, programs: ictx.plan.programs } } : {}),
    };
  }
  return { ok: true, mode: "next", slug, question: null, progress: { answered: ictx.answered.length, skipped, remaining: 0 }, done: true, hint: `every question is answered: save ${slug}` };
}
function verbAnswer(ctx, slug, id, value) {
  const q = questionById(id);
  if (q.kind === "preflight") refuse("the tenant is checked by next, not answered");
  const draft = ctx.store.readDraft(slug);
  if (!draft) refuse(`no draft "${slug}" — start one with new ${slug}`);
  ctx.store.startDraft(slug, { by: ctx.by, takeOver: ctx.takeOver });
  let ictx = interviewContext(ctx, slug, { draft: ctx.store.readDraft(slug) });
  if (q.kind === "action") return verbAction(ctx, slug, q, value, ictx);
  if (q.id === "grouping" && !ictx.plan) ictx = ensurePlan(ctx, slug, ictx);
  const choices = q.options(ictx);
  if (q.kind === "choice" && !choices.some((o) => o.id === String(value).trim()) && !choices.some((o) => o.id.includes("<") && String(value).trim().startsWith(o.id.split("<")[0].replace(/:$/, "")))) refuse(`"${printable(String(value), 40)}" is not one of the options: ${choices.map((o) => o.id).join(", ")}`);
  const r = q.apply(value, ictx);
  const sets = (r.sets ?? []).filter(([, v]) => v !== undefined);
  // A value of undefined clears the field (the theme back to the default): the writer removes it.
  const unset = (r.sets ?? []).filter(([, v]) => v === undefined).map(([p]) => p);
  let d;
  try {
    d = ctx.store.setDraft(slug, { sets, unset, answered: [q.id], by: ctx.by, takeOver: ctx.takeOver });
  } catch (e) {
    if (e instanceof SpecRefusal) refuse(`${q.id}: ${e.message}`);
    throw e;
  }
  return { ok: true, mode: "answer", slug, question: q.id, set: sets.map(([p]) => p), notes: [...(r.notes ?? []), ...(d.notes ?? [])], ...(r.replaced ? { replaced: r.replaced } : {}), next: nextQuestionId(ctx, slug) };
}
function verbAction(ctx, slug, q, value, ictx) {
  const yes = String(value).trim().toLowerCase();
  const mark = (extra = {}) => { const d = ctx.store.setDraft(slug, { answered: [q.id], by: ctx.by, takeOver: ctx.takeOver }); return { ok: true, mode: "answer", slug, question: q.id, answered: d.answered, next: nextQuestionId(ctx, slug), ...extra }; };
  if (q.id === "dry-run") {
    if (yes !== "yes") return mark({ preview: null });
    const spec = ictx.spec;
    preflight(ctx, spec);
    const runId = stableRunId(ctx, spec, "preview");
    const r = runAdapter(ctx, { spec, runId, phase: "all", previousPath: null, preview: true });
    if (r.summary.status !== "ok") refuse(`the dry run did not finish: ${r.summary.stopped ?? r.summary.status}; answer dry-run yes again to resume it`, r.summary.status === "token-expired" ? "token-expired" : "partial");
    const pulled = reduceEngagement(loadRun(r.runDir, { cliVersion: ctx.catalog.meta?.cliVersion ?? null, pluginVersion: ctx.pluginVersion }));
    const previewDir = join(dirOf(ctx, slug), PREVIEW_DIR);
    mkdirSync(previewDir, { recursive: true });
    const snapshotPath = join(previewDir, "preview-snapshot.json");
    writeFileAtomicSync(snapshotPath, JSON.stringify(pulled));
    const { snapshot, resolution } = applyGroups(pulled, spec.groups);
    const pages = buildPages(ctx, { spec, snapshot, delta: null, outDir: previewDir });
    saveInterviewState(ctx, slug, { ...interviewState(ctx, slug), preview: { run: runId, snapshot: snapshotPath, at: new Date(ctx.nowMs).toISOString() } });
    return mark({ preview: { snapshot: snapshotPath, pages: pages.map((p) => ({ page: p.page, path: p.path, megabytes: p.megabytes, warning: p.warning })), pulledAt: snapshot.meta.pulledAt, programs: snapshot.dimensions.programs.length, ungrouped: resolution.line, calls: r.summary.calls, themed: !!spec.theme } });
  }
  if (q.id === "estimate") {
    const withPlan = ensurePlan(ctx, slug, ictx);
    if (yes !== "yes") return { ok: true, mode: "answer", slug, question: q.id, confirmed: false, estimate: withPlan.plan.estimate, next: nextQuestionId(ctx, slug), hint: "answer the setting to change, then estimate again" };
    return mark({ confirmed: true, estimate: { full: withPlan.plan.estimate.full, token: withPlan.plan.estimate.token, kb: withPlan.plan.estimate.kb, templates: withPlan.plan.estimate.templates } });
  }
  // save
  const saved = verbSave(ctx, slug);
  if (yes !== "yes") return { ...saved, mode: "answer", question: q.id, refresh: null, hint: `refresh ${slug} when ready` };
  try {
    return { ...saved, mode: "answer", question: q.id, refresh: verbRefresh(ctx, slug, { full: false, healthOnly: false }) };
  } catch (e) {
    // The dashboard IS saved; only its first refresh stopped. The refusal says so and keeps its exit code.
    if (e instanceof DashboardRefusal) throw new DashboardRefusal(`the dashboard "${slug}" is saved; its first refresh stopped: ${e.message}`, e.code);
    throw e;
  }
}
/** The last plan this dashboard made (null until one exists): the minutes of a full refresh and the longest schedule period come from it. */
function lastPlan(ctx, slug) {
  const root = join(ctx.wsDir, ".gs-superadmin", "tmp", "engagement");
  const state = readJsonOr(join(dirOf(ctx, slug), STATE_FILE), null);
  const runs = existsSync(root) ? readdirSync(root).filter((x) => x.startsWith(`dash-${slug}-`)).sort(cmpKey) : [];
  const newestFirst = [...runs].reverse();
  const plan = (state?.run ? [state.run, ...newestFirst] : newestFirst).map((d) => readJsonOr(join(root, d, "plan.json"), null)).find(Boolean);
  return plan ?? null;
}
const lastPlanMinutes = (ctx, slug) => { const plan = lastPlan(ctx, slug); return plan?.estimate?.full?.seconds != null ? minutesOf(plan.estimate.full.seconds) : null; };
function verbSave(ctx, slug) {
  const r = ctx.store.save(slug);
  rmSync(join(dirOf(ctx, slug), INTERVIEW_FILE), { force: true });
  return { ok: true, mode: "save", slug, path: r.path, replaced: r.replaced, pages: r.pages, notes: r.notes };
}
function verbList(ctx) {
  const dashboards = ctx.store.listDashboards().map((d) => {
    const latest = d.saved ? latestSnapshotPath(ctx, d.slug) : null;
    return { ...d, lastPull: latest ? basename(latest).replace(/\.json$/, "") : null, pages: d.saved ? d.pages.filter((p) => existsSync(join(dirOf(ctx, d.slug), pageFileName(p)))) : [] };
  });
  return { ok: true, mode: "list", tenantHost: ctx.store.tenantHost, kb: basename(ctx.kbDir), dashboards };
}
function verbStatus(ctx, slug) {
  const spec = savedSpec(ctx, slug);
  const latest = latestSnapshotPath(ctx, slug);
  const snapshot = latest ? openSnapshotFile(latest) : null;
  const pulledMs = snapshot ? Date.parse(snapshot.meta.pulledAt) : null;
  const ageDays = pulledMs != null ? Math.floor((ctx.nowMs - pulledMs) / 86400000) : null;
  const cadenceDays = CADENCE_DAYS[spec.refresh.cadence];
  const nextDue = pulledMs != null && cadenceDays ? new Date(pulledMs + cadenceDays * 86400000).toISOString() : null;
  const state = readJsonOr(join(dirOf(ctx, slug), STATE_FILE), null);
  return {
    ok: true, mode: "status", slug, title: spec.title, cadence: spec.refresh.cadence,
    lastPull: snapshot ? { pulledAt: snapshot.meta.pulledAt, ageDays, mode: snapshot.meta.refresh.mode, programs: snapshot.dimensions.programs.length, file: latest } : null,
    nextDue, due: nextDue ? ctx.nowMs >= Date.parse(nextDue) : snapshot == null,
    stale: ageDays != null ? ageDays > spec.freshness.maxAgeDays : null, staleAfterDays: spec.freshness.maxAgeDays,
    snapshots: snapshotFiles(ctx, slug).length, pages: spec.pages.map((p) => ({ page: p.id, file: join(dirOf(ctx, slug), pageFileName(p.id)), present: existsSync(join(dirOf(ctx, slug), pageFileName(p.id))) })),
    lock: lockState(ctx, slug), resumable: state ? { run: state.run, startedAt: state.startedAt, by: state.by } : null, draft: !!ctx.store.readDraft(slug),
  };
}
function verbRefresh(ctx, slug, { full, healthOnly }) {
  const spec = savedSpec(ctx, slug);
  const dir = dirOf(ctx, slug);
  // The tenant and the token, before any call, before the lock.
  const who = preflight(ctx, spec);
  const state = readJsonOr(join(dir, STATE_FILE), null);
  const previousPath = latestSnapshotPath(ctx, slug);
  // A refresh that stopped (token, a failed call) resumes its run: the same run id, the same previous snapshot.
  const resuming = state && state.previousPath === previousPath && state.full === full && state.healthOnly === healthOnly;
  // A stopped run is resumed with the flags it was started with, never silently abandoned for a new one.
  if (state && !resuming && state.previousPath === previousPath) refuse(`a stopped refresh of "${slug}" (run ${state.run}, started ${state.startedAt} by ${state.by}${state.full ? ", --full" : ""}${state.healthOnly ? ", --health-only" : ""}) is waiting to resume: run it again with the same flags, or remove ${join(dir, STATE_FILE)} to start over`);
  const runId = resuming ? state.run : `dash-${slug}-${snapshotStamp(new Date(ctx.nowMs).toISOString())}`;
  const lock = takeLock(ctx, slug, runId);
  try {
    writeJson(join(dir, STATE_FILE), { run: runId, startedAt: new Date(ctx.nowMs).toISOString(), by: ctx.by, previousPath, full, healthOnly });
    // The plan, with the derived lookback; then the budget: the pull plus the re-documentation against the token.
    const planned = planWithLookback(ctx, { spec, runId, previousPath, forceFull: full, healthOnly });
    const stopped = (r) => { const code = r.summary.status === "token-expired" ? "token-expired" : r.summary.status === "partial" ? "partial" : "failed"; refuse(`the ${healthOnly ? "health-only " : ""}refresh stopped: ${r.summary.stopped ?? r.summary.status}${code === "failed" ? "" : ` — ${code === "token-expired" ? "run gs-admin login, then" : ""} run refresh ${slug} again to resume it; the last good pages are untouched`}`, code); };
    if (planned.summary.status !== "ok") stopped(planned);
    const estimate = planned.summary.estimate;
    const redoc = kbSettings(spec).redocument;
    const redocSeconds = redoc.enabled ? Math.min(redoc.cap, (estimate.kb?.programs?.length ?? 0)) * 3 + Math.min(Math.max(0, redoc.cap - (estimate.kb?.programs?.length ?? 0)), estimate.templates?.planned ?? 0) * 3 : 0;
    const needed = estimate.thisRun.seconds + redocSeconds + 30;
    if (needed > who.expiresInSeconds) refuse(`the refresh needs about ${plural(minutesOf(needed), "minute")} (${estimate.thisRun.calls} calls${redocSeconds ? ` plus re-documentation` : ""}) and the login has ${plural(minutesOf(who.expiresInSeconds), "minute")} left — run gs-admin login, then run refresh ${slug} again (it resumes)`, "token-expired");
    // Re-documentation first (the fetch then re-reads the moved knowledge base: the run's KB copy is stamped).
    const redocumented = redocument(ctx, { spec, estimate, runDir: planned.runDir });
    // The pull.
    const pulledRun = runAdapter(ctx, { spec, runId: basename(planned.runDir), phase: "all", previousPath, forceFull: full, healthOnly, lookbackDays: planned.lookbackDays });
    if (pulledRun.summary.status !== "ok") stopped(pulledRun);
    const pulled = reduceEngagement(loadRun(pulledRun.runDir, { previous: pulledRun.previous, cliVersion: ctx.catalog.meta?.cliVersion ?? null, pluginVersion: ctx.pluginVersion }));
    const previous = pulledRun.previous;
    const { snapshot, resolution } = applyGroups(pulled, spec.groups, { previous });
    // The snapshot, then retention, then the pages (all or nothing), then the state is cleared.
    mkdirSync(join(dir, SNAPSHOTS_DIR), { recursive: true });
    const snapshotPath = join(dir, SNAPSHOTS_DIR, `${snapshotStamp(snapshot.meta.pulledAt)}.json`);
    writeFileAtomicSync(snapshotPath, JSON.stringify(snapshot));
    const pruned = pruneSnapshots(ctx, slug);
    const delta = computeDelta(spec, snapshot, previous);
    const pages = buildPages(ctx, { spec, snapshot, delta, outDir: dir });
    rmSync(join(dir, STATE_FILE), { force: true });
    return {
      ok: true, mode: "refresh", slug, status: "ok", run: basename(pulledRun.runDir), resumed: !!resuming, full, healthOnly,
      pull: { mode: snapshot.meta.refresh.mode, why: snapshot.meta.refresh.why, pulledAt: snapshot.meta.pulledAt, programs: snapshot.dimensions.programs.length, calls: pulledRun.summary.calls, reconciled: snapshot.reconciliation.ok, health: engine.healthAvailability(snapshot).pulled, accounts: engine.accountAvailability(snapshot).pulled, lookbackDays: planned.lookbackDays, lookbackDerivedFrom: planned.lookbackDerivedFrom ?? null },
      redocumented, snapshot: snapshotPath, pruned, ungrouped: resolution.line, kbBehind: snapshot.honesty?.kb ?? null,
      delta: delta ? { previousPulledAt: delta.previousPulledAt, closedMonths: delta.closedMonths.length, programs: delta.programs, metrics: Object.fromEntries(Object.entries(delta.metrics).map(([k, v]) => [k, v.change])) } : null,
      pages: pages.map((p) => ({ page: p.page, path: p.path, megabytes: p.megabytes, warning: p.warning })),
      lockTakenOver: lock.takenOver ? { by: lock.takenOver.by, at: lock.takenOver.at } : null,
      caveats: snapshot.caveats.map((c) => c.id),
    };
  } finally {
    lock.release();
  }
}
function verbRebuild(ctx, slug) {
  const spec = savedSpec(ctx, slug);
  const files = snapshotFiles(ctx, slug);
  if (!files.length) refuse(`no snapshot of "${slug}" yet — run refresh ${slug} first`);
  const r = rebuildFrom(ctx, { spec, snapshotPath: files.at(-1), previousPath: files.at(-2) ?? null, outDir: dirOf(ctx, slug) });
  return { ok: true, mode: "rebuild", slug, pulledAt: r.pulledAt, ungrouped: r.ungrouped, delta: r.delta, pages: r.pages.map((p) => ({ page: p.page, path: p.path, megabytes: p.megabytes, warning: p.warning })) };
}
/** A re-selection of the customer lists over the last run directory's rows (ruled 2026-10-05): reduce again with the new lists, no pull. */
function reselectFromRun(ctx, slug, spec) {
  const state = readJsonOr(join(dirOf(ctx, slug), STATE_FILE), null);
  const latest = latestSnapshotPath(ctx, slug);
  if (!latest) return { done: false, why: "no snapshot yet" };
  const current = openSnapshotFile(latest);
  // The run the latest snapshot came from: its directory is named for the pull it made.
  const candidates = existsSync(join(ctx.wsDir, ".gs-superadmin", "tmp", "engagement")) ? readdirSync(join(ctx.wsDir, ".gs-superadmin", "tmp", "engagement")).filter((d) => d.startsWith(`dash-${slug}-`) && !d.includes("-plan-") && !d.includes("-preview-")) : [];
  const runDir = candidates.map((d) => join(ctx.wsDir, ".gs-superadmin", "tmp", "engagement", d)).find((d) => { try { const run = readJsonOr(join(d, "run.json"), null); return run?.params?.pulledAt === current.meta.pulledAt; } catch { return false; } }) ?? null;
  void state;
  if (!runDir || !existsSync(join(runDir, "status.json"))) return { done: false, why: "the last pull's rows are no longer in the workspace: the next refresh selects the lists" };
  const run = readJsonOr(join(runDir, "run.json"), {});
  const input = loadRun(runDir, { previous: run.previousPath && existsSync(run.previousPath) ? openSnapshotFile(run.previousPath) : null, cliVersion: run.cliVersion ?? null, pluginVersion: ctx.pluginVersion });
  input.params.accounts.lists = accountLists(spec);
  const pulled = reduceEngagement(input);
  const previous = input.previous;
  const { snapshot } = applyGroups(pulled, spec.groups, { previous });
  writeFileAtomicSync(latest, JSON.stringify(snapshot));
  const delta = computeDelta(spec, snapshot, previous);
  const pages = buildPages(ctx, { spec, snapshot, delta, outDir: dirOf(ctx, slug) });
  return { done: true, snapshot: latest, lists: snapshot.honesty?.accountSelection?.lists?.map((l) => ({ kind: l.kind, kept: l.kept.length })) ?? [], pages: pages.map((p) => ({ page: p.page, path: p.path })) };
}
function verbChange(ctx, slug, pairs, dryRun) {
  const saved = savedSpec(ctx, slug);
  if (!pairs.length) refuse("nothing to change — pass <path>=<json>, like accounts.pull=true");
  // The pairs are read before any draft exists, so a malformed one leaves nothing behind.
  const sets = pairs.map((pair) => {
    const cut = pair.indexOf("=");
    if (cut < 1) refuse(`change takes <path>=<json> (got "${printable(pair, 80)}")`);
    const path = pair.slice(0, cut).replace(/\[\]/g, "").replace(/\[(\d+)\]/g, ".$1");
    let value;
    try { value = JSON.parse(pair.slice(cut + 1)); } catch { refuse(`change ${path}: the value is not JSON — quote text ("Renewals"), and write lists and objects as JSON`); }
    for (const id of IDENTITY_PATHS) if (coveredPath(path) === id) refuse(`${path} ${COST_KINDS.identity}`);
    return [path, value];
  });
  const had = !!ctx.store.readDraft(slug);
  const started = ctx.store.startDraft(slug, { by: ctx.by, takeOver: ctx.takeOver });
  let d;
  try {
    d = ctx.store.setDraft(slug, { sets, by: ctx.by, takeOver: ctx.takeOver });
  } catch (e) {
    if (!had) ctx.store.discardDraft(slug);
    if (e instanceof SpecRefusal) refuse(e.message);
    throw e;
  }
  const plan = lastPlan(ctx, slug);
  const { changed, consequence } = changeCost(saved, d.draft.spec, { longestPeriodDays: plan?.estimate?.health?.lookback?.longestPeriodDays ?? null });
  const minutes = plan?.estimate?.full?.seconds != null ? minutesOf(plan.estimate.full.seconds) : null;
  const says = consequence == null ? "nothing changed" : consequence === "pull" ? `the next refresh pulls everything again, ${minutes != null ? `about ${plural(minutes, "minute")}` : "a first pull's time (no plan yet)"}` : consequence === "reselect" ? "the customer lists are ranked again over the last pull's rows (a rebuild), or the next refresh when those rows are gone" : "rebuild only (no pull)";
  const summary = { ok: true, mode: "change", slug, by: started.by, draftHadEarlierChanges: had, changed, consequence, consequenceText: says, costTable: COST_KINDS, dryRun };
  if (dryRun) {
    if (!had) ctx.store.discardDraft(slug);
    return { ...summary, saved: false, done: null };
  }
  if (!changed.length) { if (!had) ctx.store.discardDraft(slug); return { ...summary, saved: false, done: null }; }
  const savedNow = ctx.store.save(slug);
  const spec = openSpec(savedNow.spec);
  let done;
  if (consequence === "pull") done = { kind: "refresh", ...verbRefresh(ctx, slug, { full: false, healthOnly: false }) };
  else if (consequence === "reselect") done = { kind: "reselect", ...reselectFromRun(ctx, slug, spec) };
  else {
    const files = snapshotFiles(ctx, slug);
    done = files.length ? { kind: "rebuild", ...rebuildFrom(ctx, { spec, snapshotPath: files.at(-1), previousPath: files.at(-2) ?? null, outDir: dirOf(ctx, slug) }) } : { kind: "rebuild", done: false, why: `no snapshot yet: run refresh ${slug}` };
  }
  return { ...summary, saved: true, previousCopy: `${savedNow.path}.previous`, done };
}
function verbReport(ctx, slug, opt, argv) {
  const spec = savedSpec(ctx, slug);
  const latest = latestSnapshotPath(ctx, slug);
  if (!latest) refuse(`no snapshot of "${slug}" yet — run refresh ${slug} first`);
  const snapshot = openSnapshotFile(latest);
  const ageDays = Math.floor((ctx.nowMs - Date.parse(snapshot.meta.pulledAt)) / 86400000);
  const cadenceDays = CADENCE_DAYS[spec.refresh.cadence];
  const reportDir = join(dirOf(ctx, slug), REPORTS_DIR);
  let summary;
  try {
    summary = writeReport({ snapPath: latest, reportDir, kb: ctx.kbDir, csvDir: opt("--csv-dir") ?? null, scriptPath: join(here, "engagement-report.mjs"), opts: { byTemplate: argv.includes("--by-template"), excludeInternal: argv.includes("--exclude-internal"), includePaused: argv.includes("--include-paused"), all: argv.includes("--all") } });
  } catch (e) {
    if (e instanceof ReportRefusal) refuse(e.message);
    throw e;
  }
  return { ...summary, mode: "report", slug, snapshotAgeDays: ageDays, withinCadence: cadenceDays ? ageDays <= cadenceDays : true, cadence: spec.refresh.cadence, staleAfterDays: spec.freshness.maxAgeDays, refreshMinutes: lastPlanMinutes(ctx, slug) };
}
function verbExport(ctx, slug, opt, argv) {
  if (!opt("--out")) refuse("export needs --out <file>");
  const r = ctx.store.exportSpec(slug, opt("--out"));
  let snapshot = null;
  if (argv.includes("--with-snapshot")) {
    const latest = latestSnapshotPath(ctx, slug);
    if (!latest) refuse(`no snapshot of "${slug}" to export beside the spec — run refresh ${slug} first, or export without --with-snapshot`);
    snapshot = r.out.replace(/\.json$/i, "") + ".snapshot.json";
    copyFileSync(latest, snapshot);
  }
  return { ok: true, mode: "export", slug, out: r.out, tenantHost: r.tenantHost, snapshot, hint: snapshot ? "import --file <the export> --snapshot <the snapshot> on the other machine: its first refresh is then selective, with a delta" : null };
}
function verbImport(ctx, opt, argv) {
  if (!opt("--file")) refuse("import needs --file <export>");
  const r = ctx.store.importSpec({ file: opt("--file"), slug: opt("--slug") ?? null, replace: argv.includes("--replace") });
  const sibling = resolve(opt("--file")).replace(/\.json$/i, "") + ".snapshot.json";
  const snapPath = opt("--snapshot") ? resolve(opt("--snapshot")) : existsSync(sibling) ? sibling : null;
  let snapshot = null;
  if (snapPath) {
    const s = openSnapshotFile(snapPath);
    if (s.meta.tenantHost !== r.spec.tenantHost) refuse(`the snapshot was pulled from ${s.meta.tenantHost}, and the dashboard belongs to ${r.spec.tenantHost} — not imported`);
    mkdirSync(join(dirOf(ctx, r.slug), SNAPSHOTS_DIR), { recursive: true });
    snapshot = join(dirOf(ctx, r.slug), SNAPSHOTS_DIR, `${snapshotStamp(s.meta.pulledAt)}.json`);
    copyFileSync(snapPath, snapshot);
  }
  return { ok: true, mode: "import", slug: r.slug, path: r.path, snapshot, exportedAt: r.exportedAt };
}
function verbHealth(ctx, slug, opt) {
  const programId = opt("--program");
  if (!programId) refuse("health needs --program <id>");
  savedSpec(ctx, slug);
  const latest = latestSnapshotPath(ctx, slug);
  if (!latest) refuse(`no snapshot of "${slug}" yet — run refresh ${slug} first`);
  const s = openSnapshotFile(latest);
  const program = s.dimensions.programs.find((p) => p.id === programId);
  if (!program) refuse(`no program ${programId} in the latest snapshot of "${slug}"`);
  const h = s.facts.health ?? {};
  const of = (table) => (h[table] ?? []).filter((r) => r.programId === programId);
  // Terminal only: the masked messages and the sample texts never reach a page (ruled 2026-10-05).
  return {
    ok: true, mode: "health", slug, program: { id: program.id, name: program.name, statuses: program.statuses }, pulledAt: s.meta.pulledAt, health: engine.healthAvailability(s),
    bounceReasons: of("bounceReasons").map((r) => ({ month: r.month, templateId: r.templateId, bounceType: r.bounceType, category: r.category ?? null, message: r.message, count: r.count })),
    participantFailures: of("participantFailures"), entrySamples: of("entrySamples"), stepFailures: of("stepFailures"),
    otherSamples: of("failureSamples").map((r) => ({ part: r.part, category: r.category ?? null, kind: r.kind ?? null, message: r.message, count: r.count ?? null, occurrences: r.occurrences ?? null })),
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────
const USAGE =
  "usage: dashboard.mjs <new|next|answer|change|save|list|status|refresh|rebuild|report|export|import|health|costs|questions> [<slug>] [...] " +
  "[--kb <tenant KB folder>] [--workspace <dir>] [--bin <gs-admin entry>] [--by <holder>] [--take-over] [--today YYYY-MM-DD]";
const VERBS = ["new", "next", "answer", "change", "save", "list", "status", "refresh", "rebuild", "report", "export", "import", "health", "costs", "questions"];
async function main() {
  const [verb, ...rest] = process.argv.slice(2);
  const helpers = makeCliHelpers("dashboard.mjs", rest);
  const { opt, finish } = helpers;
  /** @type {import("./doc-lib.mjs").FailFn} */
  const fail = helpers.fail;
  if (!VERBS.includes(verb)) fail(USAGE);
  if (verb === "costs") await finish({ ok: true, mode: "costs", kinds: COST_KINDS, costs: COSTS, adapterMapping: ADAPTER_MAPPING });
  if (verb === "questions") await finish({ ok: true, mode: "questions", questions: QUESTIONS.map((q) => ({ id: q.id, kind: q.kind, judgment: q.judgment, path: q.path, ask: q.ask, needsPlan: !!q.needsPlan, hasSkipRule: !!q.skip })) });
  const positional = rest.filter((t, i) => !t.startsWith("--") && !(i > 0 && rest[i - 1].startsWith("--") && !["--fast-path", "--take-over", "--dry-run", "--full", "--health-only", "--with-snapshot", "--replace", "--by-template", "--exclude-internal", "--include-paused", "--all"].includes(rest[i - 1])));
  try {
    const ctx = openContext(rest, opt);
    const slug = positional[0];
    const needSlug = () => { if (!slug) refuse(`${verb} needs <slug> — ${USAGE}`); return slug; };
    let out;
    switch (verb) {
      case "new": out = verbNew(ctx, needSlug(), opt, rest); break;
      case "next": out = verbNext(ctx, needSlug()); break;
      case "answer": { needSlug(); if (!positional[1]) refuse(`answer needs <slug> <question id> <value>`); out = verbAnswer(ctx, slug, positional[1], positional.slice(2).join(" ")); break; }
      case "change": out = verbChange(ctx, needSlug(), positional.slice(1), rest.includes("--dry-run")); break;
      case "save": out = verbSave(ctx, needSlug()); break;
      case "list": out = verbList(ctx); break;
      case "status": out = verbStatus(ctx, needSlug()); break;
      case "refresh": out = verbRefresh(ctx, needSlug(), { full: rest.includes("--full"), healthOnly: rest.includes("--health-only") }); break;
      case "rebuild": out = verbRebuild(ctx, needSlug()); break;
      case "report": out = verbReport(ctx, needSlug(), opt, rest); break;
      case "export": out = verbExport(ctx, needSlug(), opt, rest); break;
      case "import": out = verbImport(ctx, opt, rest); break;
      case "health": out = verbHealth(ctx, needSlug(), opt); break;
      default: fail(USAGE);
    }
    await finish(out);
  } catch (e) {
    if (e instanceof DashboardRefusal) await finish({ ok: false, mode: verb, status: e.code, error: e.message }, EXIT[e.code] ?? EXIT.failed);
    if (e instanceof SpecRefusal || e instanceof EngagementRefusal || e instanceof ReportRefusal) await finish({ ok: false, mode: verb, status: "failed", error: e.message }, EXIT.failed);
    throw e;
  }
}

if (isMainModule(import.meta.url)) {
  main().catch((e) => {
    console.error(`dashboard.mjs: ${e?.stack ?? e}`);
    process.exit(1);
  });
}
