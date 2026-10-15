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
// pages, the refresh lock and its resumable state, the interview's preview, the
// native-report plan and its read-backs. It never runs a mutating command.
//
// Verbs (each prints ONE JSON summary; exit codes below):
//   new <slug> [--fast-path] [--title <t>] [--owner <o>]
//                        a draft from the defaults; the fast path has `next`
//                        answer every question but the closing step with the
//                        question's own default, through its own apply (F-512)
//   next <slug> [--question <id>]
//                        the next unanswered question of the QUESTIONS table,
//                        with its options (a placeholder option with its
//                        follow-ups) and what it needs handed over (a judgment
//                        node's input file, the minutes a switch costs); the
//                        tenant statement the first time; the closing step's
//                        block once every setting is answered; --question <id>
//                        one settled question again (the closing step's "go
//                        back"), changing nothing
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
//   status <slug>        the last pull and its age, the lock, a stopped run (no
//                        "next due": refreshes are manual, ruled 2026-10-12)
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
//   account [<slug>] (--account-id <GSID> | --account-name <name>) [--last <Nd|Nm>]
//                        one account's emails by program and day (ACC-2): the
//                        adapter's account-history pull (90 days unless asked,
//                        at most 24 months), a timeline file and a page of its
//                        own; with a dashboard named, its recipient classes and
//                        look, reconciled against its latest snapshot; a name
//                        matching several accounts, or none exactly, is a pick
//                        list (exit 6) and pulls nothing
//   native-plan <slug> [--test-prefix] [--no-schema]
//                        NAT-1: which panels a Gainsight report can carry (the
//                        tenant's schema read first) and the exact rp create /
//                        rp update line for each — PRINTED, never run: the
//                        skill issues each as its own command so the guard asks;
//                        the plan written to native/plan.json
//   native-record <slug> --panel <page id>/<panel id>
//                        NAT-2: after a planned line ran, the report's id read
//                        back (rp describe) and recorded through the spec writer
//   native-verify <slug> [--panel <page id>/<panel id>]
//                        NAT-2: each recorded report read back (rp run-saved)
//                        against its plan; the UI columns still to add
//   costs | questions    the two tables, as data, for a reader (the asks and
//                        options with the ruled placeholder letters where a
//                        figure comes from the plan)
//
// Common flags: --kb <tenant KB folder> (else the one KB of the workspace),
// --workspace <dir>, --bin <gs-admin entry>, --by <holder>, --take-over,
// --today YYYY-MM-DD, --now <ISO>.
//
// Exit codes: 0 ok · 1 refused or failed · 3 token-expired (resumable) ·
// 4 partial (resumable) · 5 wrong-tenant · 6 needs-pick (account: a pick list).
//
// What the code enforces:
//   - The tenant: before any call, `whoami`'s host must equal the spec's
//     tenantHost, or the refresh is refused (exit 5). A production dashboard is
//     never refreshed from a sandbox by accident.
//   - The lock: a workspace file beside the spec; a second refresh is refused
//     naming the holder and the time; a lock older than LOCK_STALE_MS is stale
//     and taken over. No cross-machine lock is attempted.
//   - The login: a pull longer than the login is NOT refused (F-513, ruled
//     2026-10-12). It runs as far as the token allows, the adapter stops it
//     cleanly when the next call would outlast the token, and the next run
//     after a login continues it; the summary and the stop say how many logins
//     of an hour a pull of this size takes. A pending run whose parameters moved
//     since it stopped is abandoned and planned afresh (F-512).
//   - Re-documentation: ONE staleness predicate (the adapter's kbGap: a
//     program's list modified_date against its doc's manifest last_verified,
//     modified since documented, never age) and ONE re-documenter (the
//     manifest and describe-batch scripts, as the knowledge-base skills run
//     them), capped per refresh, off-switchable; the template gap the same way.
//   - A display-only change rebuilds from the last snapshot; a re-selection of
//     the customer lists reduces the last run directory again when the latest
//     pull was FULL and its run directory is a finished pull; otherwise the
//     pages are rebuilt and the change says the lists are ranked at the next
//     full refresh, with its line (F-529).
//
// Citations: DSH-n / PUB-n / UX-n are work items and Rnn rulings of the
// maintainer's unpublished JO-dashboards plan; the decision each produced is
// stated beside the token.
//
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync, copyFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { makeCliHelpers, findWorkspaceDir, findWorkspaceCatalog, makeCommandResolver, resolveCliArgv, readJsonFile, writeFileAtomicSync, isMainModule, readKbIdentity, cmpKey, RECORDED_LANES } from "./doc-lib.mjs";
import { printable } from "./journal-lib.mjs";
import {
  specStore, SpecRefusal, holderName, openSpec, SPEC_DESCRIPTIONS, PRESETS, TABS, DEFAULT_ACCOUNT_LISTS, defaultSpec,
  accountLists, accountFields, kbSettings, windowOf, presetPanels, PUBLISH_TARGET_NAME_RE, defaultPublish,
} from "./dashboard-spec.mjs";
import {
  resolveParams, prepareRun, runParamsMoved, fetchEngagement, reduceEngagement, loadRun, cliTransport, makeGate, parseWhoami, addMonths, monthsBetween, pickSchedule, describedProgram, EngagementRefusal, ROW_READERS, rpRunArgv, buildQuery,
  resolveAccountParams, reduceAccountTimeline, loadAccountRun, accountResolutionText, timelineSummary,
  reduceWithStore, rankFromStore, readAccountStore, accountStorePath, accountStoreFits, isAccountStoreFile, writeSnapshotAndStore,
} from "./engagement.mjs";
import { applyGroups, programTraitsOf, suggestionTable } from "./dashboard-groups.mjs";
import { buildPage, buildTimelinePage, inlinedSources, pageFileName, buildDatasets, datasetsDirName, artifactContentOf } from "./dashboard-page.mjs";
import { COPY_LINES, ENTRY_COMMAND, HOW_TO_REFRESH_TEXT } from "./dashboard-runtime.mjs";
import { nativePlan, commandLine, describedReportId, readBack, dashboardSteps, NATIVE_OBJECT, TEST_PREFIX } from "./dashboard-native.mjs";
import { writeReport, ReportRefusal } from "./engagement-report.mjs";
import * as engine from "./engagement-query.mjs";
import { validateTheme, readLogo, LOGO_MAX_BYTES } from "./dashboard-theme.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const MANIFEST_SCRIPT = join(here, "manifest.mjs");
const DESCRIBE_BATCH_SCRIPT = join(here, "describe-batch.mjs");
// 6 (ACC-2): the account was not found by its GSID, or its name matched several accounts or none exactly — a pick list; nothing was pulled.
export const EXIT = Object.freeze({ ok: 0, failed: 1, "token-expired": 3, partial: 4, "wrong-tenant": 5, "needs-pick": 6 });
// Files this command owns, inside the dashboard's folder (beside the spec writer's two).
export const SNAPSHOTS_DIR = "snapshots";
// Where the leaders' copy goes (PUB-3): the per-machine map of a publish target's NAME to a folder, in the
// workspace's own settings (git-ignored with the rest of .gs-superadmin/; ruled 2026-10-14: a spec holds no machine
// path). Its one writer is `publish-target`. The artifact form of the leaders' page sits in PUBLISH_DIR.
export const PUBLISH_TARGETS_FILE = "publish-targets.json";
export const PUBLISH_DIR = "publish";
export const PREVIEW_DIR = "preview";
export const REPORTS_DIR = "reports";
// An account's timeline (ACC-2): its page and its file, one per account, beside the dashboard's pages (or in the
// knowledge base's reports-adhoc folder when no dashboard is named).
export const ACCOUNTS_DIR = "accounts";
export const LOCK_FILE = "refresh.lock";
export const STATE_FILE = "refresh-state.json";
export const INTERVIEW_FILE = "interview-state.json";
export const SUGGESTION_FILE = "group-suggestion-input.json";
// Not frozen: keep a year of monthly pulls; a lock older than two hours is stale (PUB-1 defaults).
export const KEEP_SNAPSHOTS = 13;
export const LOCK_STALE_MS = 2 * 60 * 60 * 1000;
// The tenant's own failure-category file, beside the KB's manifest (a spec holds no path): passed to the adapter when present.
export const CATEGORIES_FILE = "failure-categories.json";
// Refreshes are manual (ruled 2026-10-12, F-511 ruling 11): no cadence is read here, no "next due" is computed, and
// the spec's refresh.cadence and freshness.maxAgeDays stay in T-11 unread.
// A gs-admin login lasts about an hour and the CLI never refreshes it (reference/auth.md): what a pull longer than
// one login costs is said in LOGINS of this length (F-513, ruled 2026-10-12: the pull checkpoints across logins).
export const LOGIN_SECONDS = 3600;
/** How many logins a pull of `seconds` takes, at least one. */
export const loginsFor = (seconds) => Math.max(1, Math.ceil((seconds ?? 0) / LOGIN_SECONDS));
// What a failed call's kind means to the admin reading a stop (F-519): the adapter's kinds, in words.
const FAILURE_WHY = Object.freeze({ timeout: "timed out on the server twice (a server timeout)", truncated: "came back as a full page that cannot be cut smaller", "shape-error": "was refused by the server (a query-shape error)", "not-found": "was answered 'not found' twice", unparseable: "answered with something that is not JSON", refused: "was refused before it was made", other: "failed" });
/**
 * A partial stop's failures in words: the family, the programs the call named, the cause, and the runs it has failed
 * in so far (a resume retries it; a timeout that recurs run after run is said to recur, so the admin can tell a
 * transient one from a call the server will not answer).
 * @param {Array<{family: string, kind: string, programs?: number, runs?: number}>} failed
 */
export const failedText = (failed = []) =>
  failed.length
    ? `${plural(failed.length, "call")} failed: ${failed.map((f) => `${f.family}${f.programs != null ? ` (${plural(f.programs, "program")})` : ""} ${FAILURE_WHY[f.kind] ?? f.kind}${(f.runs ?? 1) > 1 ? ` in ${f.runs} runs so far` : ""}`).join("; ")}`
    : "a call failed";
export class DashboardRefusal extends Error {
  /** @param {string} message @param {string} [code] @param {Record<string, *>} [details] fields the failure summary carries beside the error */
  constructor(message, code = "failed", details = {}) { super(message); this.code = code; this.details = details; }
}
const refuse = (msg, code = "failed", details = {}) => { throw new DashboardRefusal(msg, code, details); };
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
/** The health pull is on when any page's Health tab is on (the one rule: the adapter's --health, a tab change's cost, a change's price). */
const healthPulled = (spec) => spec.pages.some((pg) => pg.tabs.some((t) => t.id === "health" && t.enabled));
const notStartedText = (from, thisMonth) => `sources[0].params.window.from (${from}) is a month that has not started (this month is ${thisMonth}): the window must start in this month or before — answer the window again, or change it with change <slug> 'sources.0.params.window.from="YYYY-MM"'`;
export function adapterParams(spec, { today, forceFull = false, healthOnly = false, lookbackDays = null, categories = {}, preview = false }) {
  const p = src(spec);
  const w = windowOf(p);
  const thisMonth = today.slice(0, 7);
  // A window's first month must have started (F-537): a since or fixed month after this one (a typo, 2026-12 for
  // 2025-12) is refused here, naming the setting, before it reaches the adapter's window check as an uncaught error.
  if (w.kind !== "rolling" && w.from > thisMonth) refuse(notStartedText(w.from, thisMonth));
  const to = w.kind === "fixed" ? w.to : thisMonth;
  const from = w.kind === "rolling" ? addMonths(to, -(p.windowMonths - 1)) : w.from;
  const windowDays = monthsBetween(from, to).length * 31;
  const healthOn = !preview && healthPulled(spec);
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
// `reselect` ranks the customer lists again from the account store beside the latest snapshot (a rebuild, F-548);
// when that snapshot has no store of its own the pages are rebuilt and the lists are ranked by the next refresh;
// `identity` cannot change. Every SPEC_DESCRIPTIONS path has exactly one cost (the suite holds it both
// ways), and the page's LACKS rows must agree with it (the suite holds that too).
export const COST_KINDS = Object.freeze({
  pull: "the next refresh pulls everything again",
  reselect: "the customer lists are ranked again from the account store beside the last pull (a rebuild, no pull); when the last pull has no store of its own (made before it, or the store gone), the pages are rebuilt and the lists are ranked by the next refresh, one full pull",
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
// A publish setting is a rebuild (PUB-3): every rebuild publishes, and the rebuild keeps the About tab's Publishing line true.
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
  const healthMoved = healthPulled(before) !== healthPulled(after);
  // The silent threshold reaches the pull only as the derived lookback's floor: while the longest schedule period
  // (from the last plan) is above both the old and the new value, the lookback does not move and the change is the
  // page's starting threshold alone, a rebuild. With no plan yet, the pull side is assumed.
  const silentMoved = longestPeriodDays == null || Math.max(before.health?.silentDays ?? 0, after.health?.silentDays ?? 0) > longestPeriodDays;
  const changed = [...byCovered.values()].map((c) => (c.path === "pages[].tabs[].enabled" && !healthMoved ? { ...c, cost: "rebuild" } : c.path === "health.silentDays" && !silentMoved ? { ...c, cost: "rebuild" } : c)).sort((x, y) => cmpKey(x.path, y.path));
  const consequence = changed.length ? changed.map((c) => c.cost).sort((x, y) => COST_RANK[y] - COST_RANK[x])[0] : null;
  return { changed, consequence };
}

// ── The questions table (DSH-3, ruled 2026-10-05; every wording ruled 2026-10-12 at S5-V's I0, F-511) ──
// One row per question, as DATA: its id (the ask-once key), its wording in the user's terms (a string, or a function
// of the context when the ask quotes the plan's minutes), its kind, its options (from the context), the spec path it
// fills, a skip rule, whether it is a JUDGMENT node (prose decides; the script hands over the input and takes the
// answer back), and its DEFAULT: the option the ask names as the default, which the fast path applies through the
// same `apply` the interview uses (F-512: one source for a default, never two). The script decides order,
// validation, skipping and ask-once; the skill reads the question aloud and passes the answer back. `apply(value,
// ctx)` returns the sets for the spec writer (which validates the whole draft) and anything to say back.
//
// Placeholder options (F-511 ruling 6): an option whose id holds `<key>` carries `followUps`, one per value it needs
// ({key, kind, ask}); the skill asks each in turn and COMPOSES the value by replacing every `<key>` in the id with the
// answer (a `list` follow-up's lines as a JSON list, a `boolean` as true or false), so the admin never sees the id
// grammar. `composeAnswer` is that rule, as code, for the suite and for a reader.
const listValue = (v) => (Array.isArray(v) ? v : typeof v === "string" && v.trim().startsWith("[") ? JSON.parse(v) : String(v ?? "").split(/[,\n]/).map((s) => s.trim()).filter(Boolean));
const noneValue = (v) => (Array.isArray(v) ? v.length === 0 : ["none", "", "[]"].includes(String(v ?? "").trim().toLowerCase()));
const boolValue = (v) => { const s = String(v).trim().toLowerCase(); if (["yes", "y", "true", "on"].includes(s)) return true; if (["no", "n", "false", "off"].includes(s)) return false; refuse(`"${printable(String(v), 40)}" is not yes or no`); };
const jsonValue = (v) => { if (typeof v !== "string") return v; try { return JSON.parse(v); } catch { return refuse(`the value is not JSON: ${printable(v, 80)}`); } };
const wholeValue = (v, what, min = 0) => { const n = Number(String(v).trim()); if (!Number.isInteger(n) || n < min) refuse(`${what} must be a whole number${min ? ` of at least ${min}` : ""} (got "${printable(String(v), 20)}")`); return n; };
const secondsText = (s) => (s == null ? "an unknown time (no plan yet)" : `about ${plural(minutesOf(s), "minute")}`);
/** Minutes with one decimal under ten (a per-month rate on a small tenant is often under a minute). */
const minutesFine = (seconds) => { const m = seconds / 60; return m >= 10 ? String(Math.round(m)) : String(Math.max(0.1, Math.round(m * 10) / 10)); };
/**
 * What the bounce categories cost a refresh with Health on, said plainly from the plan (F-504: calls multiply by the
 * recipient classes — all, each internal domain, the test accounts, the test accounts on each domain). Quoted on the
 * tabs question (ruled 2026-10-12: K4's quote lives there).
 * @param {?{categoryCalls?: {bounce: {categories: number, classes: number, calls: number, seconds: number}}}} health estimate.health
 */
export const categoryCostText = (health) => {
  const b = health?.categoryCalls?.bounce;
  if (!b || !b.categories) return "";
  return ` The ${plural(b.categories, "bounce category", "bounce categories")} in the workspace's category file cost ${plural(b.calls, "counted call")} a refresh (${b.categories} × ${plural(b.classes, "recipient class", "recipient classes")}: all, each internal domain, the test accounts, and the test accounts on each domain; ${secondsText(b.seconds)}).`;
};
const execPage = (spec) => spec.pages.findIndex((p) => p.preset === "exec");
const pageTitle = (pg) => (pg.preset === "exec" ? "leaders'" : "admin");
/** The ruled placeholder letter when the plan has not priced a figure yet (the `questions` verb; never at `next`, which plans first). */
const N = (plan, pick, letter) => { const v = plan ? pick(plan) : null; return v == null ? letter : v; };
const mins = (plan, pick, letter) => { const v = plan ? pick(plan) : null; return v == null ? `about ${letter} minutes` : `about ${plural(minutesOf(v), "minute")}`; };
/** The characteristic rules the group proposal leads with, from the plan's program list (F-512: the fast path's grouping). */
export function defaultGroupRules(programs) {
  const models = new Map();
  for (const p of programs ?? []) if (p.model) models.set(p.model, p.modelName ?? p.model);
  return {
    rules: [
      { kind: "characteristic", level: "supergroup", characteristic: "recurring", is: true, label: "Recurring" },
      { kind: "characteristic", level: "supergroup", characteristic: "recurring", is: false, label: "One-off" },
      ...[...models.entries()].sort((a, b) => cmpKey(a[0], b[0])).map(([model, label]) => ({ kind: "characteristic", level: "group", characteristic: "model", is: model, label })),
    ],
    overrides: {},
  };
}
/**
 * The follow-up rule as code: every `<key>` in the option's id replaced by its answer (a list as a JSON list, a
 * boolean as true or false, a number or text as written). A list answered "none" is the empty list.
 * @param {{id: string, followUps?: Array<{key: string, kind: string}>}} option
 * @param {Record<string, *>} answers by key
 */
export function composeAnswer(option, answers) {
  let out = option.id;
  for (const f of option.followUps ?? []) {
    if (!(f.key in answers)) refuse(`the follow-up "${f.key}" of ${option.id} has no answer`);
    const a = answers[f.key];
    const text = f.kind === "list" ? JSON.stringify(noneValue(a) ? [] : listValue(a)) : f.kind === "boolean" ? String(boolValue(a)) : String(a).trim();
    out = out.split(`<${f.key}>`).join(text);
  }
  return out;
}
// The manual-refresh statement (the ruled wording of 2026-10-13, F-511 instance 27) is the runtime's HOW_TO_REFRESH_TEXT:
// one data structure the About tab draws stepped and the closing step and the save summary carry as a paragraph.
/** The closing step (ruling 19): the three action rows read as ONE step, with the estimate, the login and the manual-refresh statement. */
export const CLOSING_ASK = (ctx) => {
  const e = ctx?.plan?.estimate ?? null;
  const left = ctx?.tokenSecondsLeft ?? e?.token?.expiresInSeconds ?? null;
  const fits = e && left != null ? e.full.seconds + 30 <= left : null;
  // A pull longer than the login is not refused: it checkpoints across logins (F-513), so the ask says how many. The
  // clause is the same for a new dashboard's first refresh and an edit's forced re-pull (F-518 b).
  const login = (what) => (left == null || !e ? "your login has about T minutes left" : fits ? `your login has about ${plural(minutesOf(left), "minute")} left, enough for it` : `your login has about ${plural(minutesOf(left), "minute")} left, so ${what} will take about ${plural(loginsFor(e.full.seconds), "login")} of an hour: it runs as far as each login allows, stops, and continues when you log in and run it again`);
  const slug = ctx?.spec?.slug ?? "<slug>";
  const edit = ctx?.edit ?? null;
  const head = edit
    ? `Ready to save this edit. ${edit.consequence == null ? "Nothing changed against the saved dashboard." : `Compared with the saved dashboard it changes ${plural(edit.changed.length, "setting")} (${edit.changed.map((c) => c.path).join(", ")}): ${edit.consequence === "pull" ? `the next refresh pulls everything again, about ${N(e, (x) => minutesOf(x.full.seconds), "M")} minutes; ${login("the refresh")}` : edit.consequence === "reselect" ? (edit.reselect ? reselectText(edit.reselect, edit.reselect.line) : "the customer lists are ranked again from the account store (a rebuild, no pull)") : "the pages are rebuilt from the data already pulled, no pull"}.`}`
    : `Ready to save. A full refresh with these settings is about ${N(e, (x) => x.full.calls, "N")} calls and ${mins(e, (x) => x.full.seconds, "M")} on this tenant; ${login("the first refresh")}.`;
  return `${head} ${HOW_TO_REFRESH_TEXT(slug, ctx?.kb ?? null)}`;
};
/** A dry run's minutes: the full pull less what customer lists, health and step detail add (the preview pulls none of them). */
const dryRunSeconds = (e) => (e ? Math.max(60, e.full.seconds - (e.accounts?.on ? e.accounts.addsSeconds : 0) - (e.health?.on ? e.health.addsSeconds : 0) - (e.stepDetail?.on ? e.stepDetail.addsSeconds : 0)) : null);
export const CLOSING_OPTIONS = (ctx) => {
  const e = ctx?.plan?.estimate ?? null;
  const dryDone = (ctx?.answered ?? []).includes("dry-run");
  const edit = ctx?.edit ?? null;
  // On an edit (F-516) the first option DOES the edit's consequence: the pull, a re-selection or a rebuild; with nothing
  // changed there is nothing to do but close the edit or go back.
  const first = !edit
    ? { id: "save-now", text: `Save and run the first refresh now (${mins(e, (x) => x.full.seconds, "M")})`, answers: [["dry-run", "no"], ["estimate", "yes"], ["save", "yes"]] }
    : edit.consequence == null ? null
      : edit.consequence === "pull" ? { id: "save-now", text: `Save and run the refresh now (${mins(e, (x) => x.full.seconds, "M")})`, answers: [["dry-run", "no"], ["estimate", "yes"], ["save", "yes"]] }
        : { id: "save-now", text: edit.consequence === "reselect" ? (edit.reselect && !edit.reselect.rank ? "Save and rebuild the pages now (no pull; the customer lists are ranked at the next refresh)" : "Save and rank the customer lists again now (no pull)") : "Save and rebuild the pages now (no pull)", answers: [["dry-run", "no"], ["estimate", "yes"], ["save", "yes"]] };
  // On an edit with a pull already made, the preview is rebuilt from the last pull with no call (the themed preview
  // UX-2 promises, at no login cost); a new dashboard's dry run is the cheap program-level pull.
  const previewFromPull = edit && ctx?.hasSnapshot;
  return [
    ...(first ? [first] : []),
    ...(dryDone ? [] : [{ id: "dry-run", text: previewFromPull ? "Preview the pages first (rebuilt from the last pull with these settings; no call)" : `Run a dry run first (a quick program-level pull, ${mins(e, dryRunSeconds, "D")}, rendered as preview pages)`, answers: [["dry-run", "yes"]] }]),
    { id: "save-only", text: edit ? (edit.consequence == null ? "Close the edit (nothing changed)" : `Save only, ${edit.consequence === "pull" ? "refresh" : "rebuild"} later`) : "Save only, refresh later", answers: [["dry-run", "no"], ["estimate", "yes"], ["save", "later"]] },
    { id: "go-back", text: "Go back and change a setting", answers: [] },
  ];
};
export const QUESTIONS = Object.freeze([
  {
    id: "tenant", kind: "preflight", path: "tenantHost", judgment: false,
    // A statement, said to the user at the start of `dashboard new` (ruling 1): `next` confirms the host and returns it filled in.
    ask: "This dashboard is for <tenant>, the CLI's active tenant, whose knowledge base it reads.",
    options: () => [],
    say: (host) => `This dashboard is for ${host}, the CLI's active tenant, whose knowledge base it reads.`,
  },
  {
    id: "programs", kind: "choice", path: "sources[].params.selector", judgment: false, default: "sent-90d",
    ask: "Which programs go on the dashboard? By default, every program that sent in the last 90 days. You can widen that to 180 days or a year, take every program that sent in the reporting period, start from a date, or name the programs. This chooses the programs; the next question chooses the months the pages cover.",
    options: () => [
      { id: "sent-90d", text: "The last 90 days (the default)" }, { id: "sent-180d", text: "180 days" }, { id: "sent-365d", text: "The last year" },
      { id: "window", text: "Every program that sent in the reporting period" },
      { id: "since:<date>", text: "Since a date you give", followUps: [{ key: "date", kind: "text", ask: "Which date? Programs that sent on or after it are included (YYYY-MM-DD)." }] },
      { id: "names:<programs>", text: "Named programs (names or ids, one per line)", followUps: [{ key: "programs", kind: "list", ask: "Which programs? Give their names or ids, one per line." }] },
    ],
    apply: (v) => {
      const s = String(v).trim();
      const sel = (sentSince, names = []) => ({ sets: [["sources.0.params.selector", { sentSince, names, ids: [] }]] });
      if (s === "window") return sel(null);
      if (/^sent-\d+d$/.test(s)) return sel(s.slice(5));
      if (s.startsWith("since:")) return sel(s.slice(6).trim());
      if (s.startsWith("names:")) return sel(null, listValue(s.slice(6).trim()));
      return refuse(`"${printable(s, 40)}" is not one of the options (sent-90d, sent-180d, sent-365d, window, since:<date>, names:<programs>)`);
    },
  },
  {
    // Directly after the programs (ruling 5); the plan it needs is the one the grouping proposal reads too.
    id: "window", kind: "choice", path: "sources[].params.window.kind", judgment: false, needsPlan: true, default: "rolling:13",
    ask: (ctx) => {
      const e = ctx?.plan?.estimate ?? null;
      const months = ctx?.params ? monthsBetween(ctx.params.from, ctx.params.to).length : 13;
      const perMonth = e && months ? e.full.seconds / months : null;
      const M = perMonth == null ? "M" : minutesFine(perMonth);
      const N13 = perMonth == null ? "N" : String(minutesOf(perMonth * 13));
      const two = perMonth == null ? "24 × M" : String(minutesOf(perMonth * 24));
      return `Which months should the pages cover? By default the last 12 full months plus the current one, moving forward with each refresh. You can cover a set number of months instead, fix a start and end month that never move, or take everything from a start month up to now. On this tenant a first pull takes about ${M} minutes for each month covered, so the default's 13 months is about ${N13} minutes and two years would be about ${two} minutes. Later refreshes re-pull only recent months, so they are much shorter whatever you choose.`;
    },
    options: (ctx) => {
      const e = ctx?.plan?.estimate ?? null;
      const months = ctx?.params ? monthsBetween(ctx.params.from, ctx.params.to).length : 13;
      const n13 = e && months ? `about ${plural(minutesOf((e.full.seconds / months) * 13), "minute")}` : "about N minutes";
      return [
        { id: "rolling:13", text: `The last 12 full months plus this one, moving with each refresh (the default, ${n13})` },
        { id: "rolling:<months>", text: "The last N months, moving with each refresh", followUps: [{ key: "months", kind: "number", ask: "How many months, counting the current one?" }] },
        { id: "fixed:<from>:<to>", text: "A fixed start month and end month", followUps: [{ key: "from", kind: "text", ask: "The start month? (YYYY-MM)" }, { key: "to", kind: "text", ask: "The end month? (YYYY-MM)" }] },
        { id: "since:<from>", text: "Everything from a start month up to now", followUps: [{ key: "from", kind: "text", ask: "The start month? (YYYY-MM)" }] },
      ];
    },
    apply: (v, ctx) => {
      const s = String(v).trim();
      const m = s.match(/^(rolling):(\d+)$/) ?? s.match(/^(fixed):(\d{4}-\d{2}):(\d{4}-\d{2})$/) ?? s.match(/^(since):(\d{4}-\d{2})$/);
      if (!m) refuse(`"${printable(s, 40)}" is not rolling:<months>, fixed:<from>:<to> or since:<from> (months as YYYY-MM)`);
      if (m[1] !== "rolling" && ctx?.today && m[2] > ctx.today.slice(0, 7)) refuse(notStartedText(m[2], ctx.today.slice(0, 7)));
      if (m[1] === "rolling") return { sets: [["sources.0.params.window", { kind: "rolling" }], ["sources.0.params.windowMonths", Number(m[2])]] };
      if (m[1] === "fixed") return { sets: [["sources.0.params.window", { kind: "fixed", from: m[2], to: m[3] }]] };
      return { sets: [["sources.0.params.window", { kind: "since", from: m[2] }]] };
    },
  },
  {
    id: "grouping", kind: "json", path: "groups", judgment: true, needsPlan: true, default: (ctx) => JSON.stringify(defaultGroupRules(ctx.programs)),
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
    id: "internal-domains", kind: "list", path: "sources[].params.internalDomains[]", judgment: false, default: "none",
    ask: "Which email domains are the company's own? Recipients on them are internal, and the pages can leave them out. List them, or say none. Each domain you list adds a few minutes to every refresh with Health on once this tenant has bounce categories (about 3 minutes per domain where this was measured).",
    options: () => [{ id: "<domains>", text: "List the company's domains", followUps: [{ key: "domains", kind: "list", ask: "Which domains? One per line (acme.com)." }] }, { id: "none", text: "None: every recipient counts as external (a caveat says so)" }],
    apply: (v) => ({ sets: [["sources.0.params.internalDomains", noneValue(v) ? [] : listValue(v)]] }),
  },
  {
    id: "test-accounts", kind: "list", path: "sources[].params.testAccounts[]", judgment: false, default: "none",
    ask: "Are there test accounts whose sends should count as internal? A test account is a company record in Gainsight (an \"Acme Test\" account whose contacts are employees' alternate addresses), not an email address. Name the accounts or give their company GSIDs, or say none; a name is looked up once, and if it matches more than one account you pick. Test accounts add a few minutes to every refresh with Health on once this tenant has bounce categories, a little more for each internal domain.",
    // One follow-up per value the option NEEDS (ruling 6; F-511 instance 21): GSIDs and names are two options, not
    // one option that asks for both.
    options: () => [
      { id: '{"ids": <ids>, "names": []}', text: "Give their company GSIDs", followUps: [{ key: "ids", kind: "list", ask: "The company GSIDs of the test accounts, one per line." }] },
      { id: '{"ids": [], "names": <names>}', text: "Name the accounts (each is looked up once)", followUps: [{ key: "names", kind: "list", ask: "The names of the test accounts, one per line." }] },
      { id: "none", text: "None" },
    ],
    apply: (v, ctx) => {
      if (noneValue(v)) return { sets: [["sources.0.params.testAccounts", []]] };
      const s = typeof v === "string" ? v.trim() : v;
      // The composed form ({ids, names}); the written form (ids and name:<name>, comma-separated) is still read.
      const j = typeof s === "string" && s.startsWith("{") ? jsonValue(s) : typeof s === "object" ? s : null;
      const given = j ? [...listValue(j.ids ?? []), ...listValue(j.names ?? []).map((n) => `name:${n}`)] : listValue(s);
      const ids = [];
      const notes = [];
      for (const g of given) {
        if (!g.startsWith("name:")) { ids.push(g); continue; }
        const name = g.slice(5).trim();
        const found = ctx.lookupCompany(name);
        if (found.length === 1) { ids.push(found[0].key); notes.push(`"${name}" is ${found[0].key}`); }
        else refuse(found.length ? `"${name}" matches ${found.length} accounts: ${found.map((f) => `${f.name} (${f.key})`).join("; ")} — pick one and give its GSID` : `no account is named "${name}"`);
      }
      if (!ids.length) return { sets: [["sources.0.params.testAccounts", []]] };
      return { sets: [["sources.0.params.testAccounts", [...new Set(ids)].sort(cmpKey)]], notes };
    },
  },
  {
    id: "unsubscribe-links", kind: "list", path: "sources[].params.unsubscribeLinks[]", judgment: false, default: "none",
    ask: "Does the company use a page of its own, or an outside service, for unsubscribe links? Click rate counts clicks on content links only, so the unsubscribe link has to be told apart. Any link whose address contains \"unsubscribe\", \"opt-out\" or \"preferences\" is recognised on its own, which covers Gainsight's standard link; you only need to add a page whose address has none of those words, such as `https://www.acme.com/email-settings`. Give the link as it appears in the emails, or say none. Give the page, not the bare domain: `acme.com` alone would exclude every link to the company's site. Changing this later means the next refresh pulls everything again.",
    options: () => [{ id: "<links>", text: "Give the link as it appears in the emails", followUps: [{ key: "links", kind: "list", ask: "The unsubscribe page's link, as it appears in the emails; one per line if there are several." }] }, { id: "none", text: "None: the standard link is recognised on its own" }],
    apply: (v) => ({ sets: [["sources.0.params.unsubscribeLinks", noneValue(v) ? [] : listValue(v)]] }),
  },
  {
    id: "failure-settings", kind: "json", path: "sources[].params.quietDueDays", judgment: false, needsPlan: true, default: "default",
    ask: (ctx) => {
      const s = ctx?.plan?.estimate?.health?.samples ?? null;
      // "Programs with failures": the programs whose refusals or bounce text a pull would read; the two parts are
      // counted apart by the plan, so the larger part is quoted, never their sum (a program can be in both).
      const n = s ? Math.max(s.participantFailures?.withFailures ?? 0, s.bounceReasons?.withFailures ?? 0) : null;
      const sec = s ? (s.participantFailures?.secondsBeyondCap ?? 0) + (s.bounceReasons?.secondsBeyondCap ?? 0) : null;
      return `Two health settings. How many days may a scheduled program run without admitting anyone before it is listed as "Admitting nobody"? The default is 5 days. Do you want to change that threshold? How many programs should each refresh read failure messages from? The refresh reads a page of the actual failure wordings from the programs with the most failures, so a new wording can be spotted and added to the categories; only programs whose failures changed since the last pull are read again. The default is 25 programs. On this tenant ${n ?? "N"} programs have failures; reading all of them would add ${sec == null ? "about M minutes" : sec === 0 ? "no time" : `about ${plural(minutesOf(sec), "minute")}`} to a first pull. Do you want to change that number?`;
    },
    options: () => [
      { id: "default", text: "Keep both defaults: 5 due days, 25 programs (the default)" },
      { id: "set:<quietDueDays>:<samplePrograms>", text: "Change one or both", followUps: [{ key: "quietDueDays", kind: "text", ask: "How many due days before a program is listed as \"Admitting nobody\"? (a number, or keep)" }, { key: "samplePrograms", kind: "text", ask: "How many programs should each refresh read failure messages from? (a number, or keep)" }] },
    ],
    apply: (v) => {
      const s = String(v).trim();
      if (s === "default") return { sets: [["sources.0.params.quietDueDays", 5], ["sources.0.params.samplePrograms", 25]] };
      const m = s.match(/^set:([^:]*):([^:]*)$/);
      if (m) {
        const keep = (x) => ["", "keep"].includes(x.trim().toLowerCase());
        return { sets: [["sources.0.params.quietDueDays", keep(m[1]) ? 5 : wholeValue(m[1], "the due days", 1)], ["sources.0.params.samplePrograms", keep(m[2]) ? 25 : wholeValue(m[2], "the number of programs", 0)]] };
      }
      const j = jsonValue(s);
      return { sets: [["sources.0.params.quietDueDays", j.quietDueDays ?? 5], ["sources.0.params.samplePrograms", j.samplePrograms ?? 25]] };
    },
  },
  {
    id: "look", kind: "json", path: "theme", judgment: true, default: "skip",
    ask: "Do you have brand guidelines to apply to the pages? If not, the default look is used. You can name a guidelines file (markdown, JSON, CSS or a PDF) or paste the values. What a brand can change: the page colours, the chart colours, a system font stack (no web fonts, since the pages make no network request), the corner radius, and a logo from a local PNG or JPEG file. Layout, spacing and the status colours stay as they are. A colour that would not read is replaced by the default and shown with the reason, and the dry-run preview renders in the theme.",
    // The two brand paths are the prose's: it reads the file or the pasted values, extracts the tokens and answers with the JSON theme; `skip` is the answer as it is; `clear` (an edit) returns the default look.
    options: () => [{ id: "skip", text: "Skip: use the default look (the default)" }, { id: "file", text: "Name a guidelines file (markdown, JSON, CSS or a PDF)" }, { id: "values", text: "Paste the values" }],
    apply: (v, ctx) => {
      const s = typeof v === "string" ? v.trim() : v;
      if (s === "skip") return { sets: [], notes: ["the default look"] };
      if (s === "clear") return { sets: [["theme", undefined]], notes: ["the default look"] };
      if (s === "file" || s === "values") refuse(`"${s}" names the brand path, not the brand: read the ${s === "file" ? "file" : "pasted values"}, extract the tokens and answer with the JSON theme (or skip)`);
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
    id: "tabs", kind: "json", path: "pages[].tabs[].enabled", judgment: false, needsPlan: true, default: "default",
    ask: (ctx) => {
      const h = ctx?.plan?.estimate?.health ?? null;
      const n = h ? `about ${plural(minutesOf(h.addsSeconds), "minute")}` : "about N minutes";
      const b = h?.categoryCalls?.bounce ?? null;
      const m = !h ? "M of that for the bounce categories" : b?.categories ? `about ${plural(minutesOf(b.seconds), "minute")} of that for the bounce categories` : "none of it for bounce categories yet: this tenant has no category file";
      return `Which tabs should the admin and leader pages carry? — Engagement and About are always on. — Health shows error rates, failure reasons, silent programs and schedules, and is on the admin page by default. Health adds ${n} to each refresh on this tenant (${m}); it is one pull shared by both pages, so turning it on for leaders as well costs no extra time, and only turning it off on both pages saves it.${categoryCostText(h)} Turning Health on later means the next refresh pulls everything again. — Templates shows each email's performance, its text and a keyword search. On for the admin page only, by default. Templates adds no time to the pull. Do you want to change any of these?`;
    },
    options: (ctx) => {
      const pages = ctx?.spec?.pages ?? [];
      const template = `{${pages.map((pg) => `"${pg.id}": {"health": <${pg.id}.health>, "templates": <${pg.id}.templates>}`).join(", ")}}`;
      return [
        { id: "default", text: "Keep the defaults: admins Health and Templates, leaders neither (the default)" },
        { id: template, text: "Change them", followUps: pages.flatMap((pg) => [{ key: `${pg.id}.health`, kind: "boolean", ask: `Health on the ${pageTitle(pg)} page?` }, { key: `${pg.id}.templates`, kind: "boolean", ask: `Templates on the ${pageTitle(pg)} page?` }]) },
      ];
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
    id: "customer-lists", kind: "boolean", path: "accounts.pull", judgment: false, needsPlan: true, default: "no",
    ask: (ctx) => {
      const a = ctx?.plan?.estimate?.accounts ?? null;
      const base = ctx?.plan?.estimate?.full?.seconds ?? null;
      const withLists = a && base != null ? secondsText(base + (a.on ? 0 : a.addsSeconds)) : "about N minutes";
      const without = a && base != null ? secondsText(a.on ? base - a.addsSeconds : base) : "about M minutes";
      return `Do you want this dashboard to tell you the top customers that aren't opening or are bouncing, or only how each program is doing? The customer lists are three lists across programs: the most engaged, the least engaged and the most bounced accounts, each account with its programs underneath, plus an in-page account view. Without them the dashboard still has every program, template and step figure, and how many accounts each program reached. Adding the lists makes the first pull ${withLists} instead of ${without} on a tenant this size. You can add them later by editing the dashboard and refreshing; that refresh pulls everything again. Looking a company up outside the page needs a gs-admin login, so a leader sees a customer only through the page's account view.`;
    },
    options: () => [{ id: "no", text: "Only how each program is doing (the default)" }, { id: "yes", text: "The customer lists too" }],
    apply: (v) => ({ sets: [["accounts.pull", boolValue(v)]] }),
  },
  {
    // After the customer lists and skipped while they are off (ruling 15).
    id: "leader-names", kind: "boolean", path: "pages[].accountNames", judgment: false, default: "no", skip: (ctx) => execPage(ctx.spec) < 0 || !ctx.spec.accounts.pull,
    ask: "May the leaders' page carry the customer lists, with account names? The leaders' page is the copy that travels: a shared folder, an attachment, a hosted page. With names off it holds program and template names, counts, rates and the About text, and no account rows. With names on it carries the customer lists as the admin page does, which is a question for whoever decides where customer names may be hosted. This adds no time to the refresh; the leaders' page simply keeps the rows the admin page already has. You can change this later with a rebuild, no pull. Default no.",
    options: () => [{ id: "no", text: "No, keep customer names off the leaders' page (the default)" }, { id: "yes", text: "Yes" }],
    apply: (v, ctx) => ({ sets: [[`pages.${execPage(ctx.spec)}.accountNames`, boolValue(v)]] }),
  },
  {
    id: "customer-list-detail", kind: "json", path: "accounts.lists[]", judgment: false, default: "default", skip: (ctx) => !ctx.spec.accounts.pull,
    ask: (() => {
      const by = Object.fromEntries(DEFAULT_ACCOUNT_LISTS.map((l) => [l.kind, l]));
      return `How should the customer lists be built? Three lists are made across programs: the ${by["most-engaged"].n} most engaged, the ${by["least-engaged"].n} least engaged and the ${by["most-bounced"].n} most bounced accounts. Each needs at least ${by["most-engaged"].floor} delivered emails across programs before an account can appear, so one unopened email is not a risk; on a program that sends about once per contact, the least-engaged list uses at least 3 delivered and no open instead. You can change the size and the floor of each list, and you can add "per segment" lists, which rank the same lists within each value of a company field you name, such as Industry or Segment. Do you want to change the defaults?`;
    })(),
    options: () => [
      { id: "default", text: "Keep the three lists as described (the default)" },
      // A list with no delivered floor says so, never "at least 0 delivered" (F-511 instance 23).
      { id: `sizes:${DEFAULT_ACCOUNT_LISTS.map((l) => `<${l.kind}>`).join("|")}`, text: "Change a list's size or floor", followUps: DEFAULT_ACCOUNT_LISTS.map((l) => ({ key: l.kind, kind: "text", ask: `The ${l.n} ${l.kind.replace("-", " ")} accounts, ${l.floor > 0 ? `with at least ${l.floor} delivered` : "with no delivered floor"}: give a new size and floor as two numbers (size floor; 0 for no floor), or keep.` })) },
      { id: "segments:<field>|<lists>", text: "Add per-segment lists", followUps: [{ key: "field", kind: "text", ask: "Which company field? (Industry, Segment, …)" }, { key: "lists", kind: "text", ask: "Which lists per segment: most engaged, least engaged, most bounced, or all?" }] },
    ],
    apply: (v, ctx) => {
      const s = String(v).trim();
      const defaults = () => DEFAULT_ACCOUNT_LISTS.map((l) => ({ ...l }));
      if (s === "default") return { sets: [["accounts.lists", defaults()], ["accounts.fields", []]] };
      if (s.startsWith("sizes:")) {
        const parts = s.slice(6).split("|");
        if (parts.length !== DEFAULT_ACCOUNT_LISTS.length) refuse(`sizes: takes one answer per list (${DEFAULT_ACCOUNT_LISTS.map((l) => l.kind).join(", ")}), separated by |`);
        const lists = DEFAULT_ACCOUNT_LISTS.map((l, i) => {
          const a = parts[i].trim();
          if (["", "keep"].includes(a.toLowerCase())) return { ...l };
          const m = a.match(/^(\d+)\s+(?:floor\s+)?(\d+)$/);
          if (!m) refuse(`the ${l.kind.replace("-", " ")} list: give a size and a floor as two numbers (25 10), or keep (got "${printable(a, 20)}")`);
          return { ...l, n: Number(m[1]), floor: Number(m[2]) };
        });
        return { sets: [["accounts.lists", lists], ["accounts.fields", accountFields(ctx.spec)]] };
      }
      if (s.startsWith("segments:")) {
        const cut = s.indexOf("|");
        const field = (cut < 0 ? s.slice(9) : s.slice(9, cut)).trim();
        const which = cut < 0 ? "all" : s.slice(cut + 1).trim().toLowerCase();
        if (!field) refuse("segments: needs the company field to rank within");
        const kinds = which === "all" || which === "" ? DEFAULT_ACCOUNT_LISTS.map((l) => l.kind) : DEFAULT_ACCOUNT_LISTS.map((l) => l.kind).filter((k) => which.includes(k.replace("-", " ")) || which.includes(k));
        if (!kinds.length) refuse(`segments: names no list (most engaged, least engaged, most bounced, or all; got "${printable(which, 40)}")`);
        const current = accountLists(ctx.spec).filter((l) => !l.per || l.per !== field);
        return { sets: [["accounts.lists", [...current, ...kinds.map((k) => ({ ...DEFAULT_ACCOUNT_LISTS.find((l) => l.kind === k), per: field }))]], ["accounts.fields", [...new Set([...accountFields(ctx.spec), field])]]], notes: [`${plural(kinds.length, "per-segment list")} added, ranked within each ${field}`] };
      }
      const j = jsonValue(s);
      return { sets: [["accounts.fields", Array.isArray(j.fields) ? j.fields : []], ["accounts.lists", Array.isArray(j.lists) ? j.lists : defaults()]] };
    },
  },
  {
    id: "step-detail", kind: "boolean", path: "sources[].params.stepDetail", judgment: false, needsPlan: true, default: "no",
    ask: (ctx) => {
      const s = ctx?.plan?.estimate?.stepDetail ?? null;
      return `Do you want step detail? By default the figures are per program and per email, read from the delivery log. Step detail reads a second log that records which step of a program and which A/B variant each send came from, so the pages also show rows per step and per variant, and the participant-records count. It is one switch for the whole dashboard. On this tenant it adds ${s ? `about ${plural(minutesOf(s.addsSeconds), "minute")}` : "about N minutes"} to each refresh. Off by default; turning it on later means the next refresh pulls everything again.`;
    },
    options: (ctx) => {
      const s = ctx?.plan?.estimate?.stepDetail ?? null;
      return [{ id: "no", text: "No step detail (the default)" }, { id: "yes", text: `Add step detail (${s ? `about ${plural(minutesOf(s.addsSeconds), "minute")}` : "about N minutes"} per refresh)` }];
    },
    apply: (v) => ({ sets: [["sources.0.params.stepDetail", boolValue(v)]] }),
  },
  {
    id: "expected-reasons", kind: "list", path: "sources[].params.expectedReasons[]", judgment: false, default: "none",
    ask: "Are there participant-failure reasons that are expected by design on this tenant? Some reasons a participant is refused are a business rule doing its job. These six are recognised already and counted apart from real failures, never hidden: Already in the participant list; Unique criteria already met; Met the advanced criteria; Unsubscribed from a category; On the global opt-out; Opted out at the send step. If this tenant has a wording of its own that should count the same way, give the fixed part of its text. Most people say none here and add one later, when the Health tab's \"Other\" line shows it. Marking a reason expected changes only how it is labelled: a program that admits nobody for the due days you set earlier is still flagged as \"Admitting nobody\", whatever the reasons were.",
    options: () => [{ id: "none", text: "None (the default)" }, { id: "add:<wordings>", text: "Add a wording", followUps: [{ key: "wordings", kind: "list", ask: "The fixed part of each wording, one per line." }] }],
    apply: (v) => {
      const s = typeof v === "string" ? v.trim() : v;
      if (noneValue(s)) return { sets: [["sources.0.params.expectedReasons", []]] };
      return { sets: [["sources.0.params.expectedReasons", listValue(typeof s === "string" && s.startsWith("add:") ? s.slice(4).trim() : s)]] };
    },
  },
  // Where the leaders' copy goes (PUB-3/PUB-4, ruled 2026-10-13 at X1: a synced shared folder by default). The folder
  // is the MACHINE's (ruled 2026-10-14): an answer with a folder writes the workspace's publish-targets file through
  // its one writer, never the spec. The fast path keeps the shared-folder target with no folder yet, and every refresh
  // then says so with the line that sets one. The claude.ai artifact target is NOT offered (ruled 2026-10-14 at S7-V,
  // F-526: a real leaders' page is far more than one turn of a Claude session can read, and the Artifact tool reads a
  // file whole before publishing it, so every publish takes several turns); T-11 keeps the value and the runner its
  // code (backlog LTR-23), so a dashboard already set to it still publishes through the skill's step L2.
  {
    id: "leaders-copy", kind: "choice", path: "publish.target", judgment: false, default: "folder-later",
    ask: "Where should the leaders' page go after each refresh? By default the refresh copies it into a shared folder you name, such as a OneDrive, SharePoint or network folder synced to this computer, overwriting the same file every time, so a leader bookmarks one file or the folder once; its tables go beside it as CSV files. A refresh that fails or stops copies nothing and leaves the last copy where it was. The folder is kept on this computer only, never in the dashboard, so an exported dashboard carries no path. Or keep it in the workspace only. Viewers pay nothing either way: the leaders' copy is a file, so opening it runs no query and no session.",
    options: () => [
      { id: "folder:<folder>", text: "A shared folder: give it now", followUps: [{ key: "folder", kind: "text", ask: "The folder's full path on this computer (it must exist)." }] },
      { id: "folder-later", text: "A shared folder, set later (the default)" },
      { id: "none", text: "The workspace only" },
    ],
    apply: (v, ctx) => {
      const s = String(v).trim();
      const folderCopy = defaultPublish(ctx.spec.slug);
      const keep = ctx.spec.publish.target === "file-copy" ? ctx.spec.publish : folderCopy;
      if (s === "none") return { sets: [["publish", { target: "none", config: {} }]] };
      if (s === "folder-later") return { sets: [["publish", keep]], notes: [`the leaders' copy goes to the shared folder named "${keep.config.to}" once this computer has one: ${ENTRY_COMMAND} publish-target ${keep.config.to} <folder>${ctx.kb ? ` --kb ${ctx.kb}` : ""}`] };
      if (s.startsWith("folder:")) return { sets: [["publish", keep]], publishTarget: { name: keep.config.to, folder: s.slice(7).trim() } };
      return refuse(`leaders-copy: answer folder:<folder>, folder-later or none (got "${printable(s, 40)}")`);
    },
  },
  // The closing step (ruling 19): three action rows the script keeps, which the skill presents as ONE step from the
  // `closing` block `next` returns beside them (the ruled ask, the four options and the answers each one stands for).
  {
    id: "dry-run", kind: "action", path: null, judgment: false, needsPlan: true,
    ask: CLOSING_ASK,
    options: () => [{ id: "yes", text: "Run the dry run now (a quick program-level pull, rendered as preview pages)" }, { id: "no", text: "Skip the preview" }],
  },
  {
    id: "estimate", kind: "action", path: null, judgment: false, needsPlan: true,
    ask: CLOSING_ASK,
    options: (ctx) => {
      const e = ctx?.plan?.estimate ?? null;
      // The login's life as read NOW (F-511 instance 25), never the plan's reading from earlier; a pull longer than it
      // is said in logins (F-513), not refused.
      const left = ctx?.tokenSecondsLeft ?? e?.token?.expiresInSeconds ?? null;
      const login = e && left != null ? (e.full.seconds + 30 <= left ? `your login (${plural(minutesOf(left), "minute")} left) covers it` : `your login (${plural(minutesOf(left), "minute")} left) does not cover it: about ${plural(loginsFor(e.full.seconds), "login")} in all, the pull continuing after each`) : "";
      return [{ id: "yes", text: e ? `Confirm: ${e.full.calls} calls, ${secondsText(e.full.seconds)}; ${login}${e.kb ? `; the knowledge base is behind on ${e.kb.undocumented + e.kb.behind} program(s) (${secondsText(e.kb.refreshSeconds)} to re-document)` : ""}${e.templates?.planned ? `; ${e.templates.planned} template(s) to fetch (${secondsText(e.templates.seconds)})` : ""}` : "Confirm (no plan could be made)" }, { id: "no", text: "Not yet: change a setting first (answer it again)" }];
    },
  },
  {
    id: "save", kind: "action", path: null, judgment: false, needsPlan: true,
    ask: CLOSING_ASK,
    options: (ctx) => [{ id: "yes", text: ctx?.edit ? "Save the edit and do what it needs now (the refresh, or the rebuild)" : "Save and run the first refresh now" }, { id: "later", text: `Save only; refresh later with: ${COPY_LINES.refresh(ctx?.spec?.slug ?? "<slug>", ctx?.kb ?? null)}` }],
  },
]);
const questionById = (id) => QUESTIONS.find((q) => q.id === id) ?? refuse(`no question is called "${printable(String(id), 40)}" (${QUESTIONS.map((q) => q.id).join(", ")})`);
/** A question's wording for a context (a function of the plan's figures, or a plain string). */
export const askText = (q, ctx) => (typeof q.ask === "function" ? q.ask(ctx) : q.ask);
/** A question's default answer for a context (the option the ask names as the default). */
export const defaultAnswer = (q, ctx) => (typeof q.default === "function" ? q.default(ctx) : q.default);

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
  // The native-report verbs' reads (NAT-2): their own command set, every create and update refused (A-5).
  const nativeGate = makeGate({ catalog, hooksDir: join(here, "..", "hooks"), readPaths: NATIVE_READ_PATHS, shapeNoun: "one of the native-report verbs' reads", runsNoun: "read-only calls only (a report is created or updated by its own visible command, which the guard asks about)" });
  const identity = readKbIdentity(kbDir, []);
  return {
    wsDir, kbDir, store, catalog, today, todayGiven: opt("--today") !== undefined, nowMs, pluginVersion, binOpt, gate, nativeGate, live, identity,
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
/** `base`, or `base-2`, `base-3`, …: the first name no entry of `dir` holds (with `ext` for a file). */
function freshName(dir, base, ext = "") {
  let name = base;
  for (let n = 2; existsSync(join(dir, `${name}${ext}`)); n++) name = `${base}-${n}`;
  return name;
}
// A snapshot's file name is its pull's LOCAL time with the offset dropped, so a name is no order (F-544): a clock moved
// back (the repeated DST hour, westward travel) or an import from a zone east names a later pull earlier. The order is
// the instant its pulledAt parses to, read from the file (once per file and version: the cache key is the path, the
// modification time and the size); two pulls of one instant keep their names' order, the collision suffix last.
const pulledAtCache = new Map();
function snapshotInstant(path) {
  const st = statSync(path);
  const key = `${path}\0${st.mtimeMs}\0${st.size}`;
  if (!pulledAtCache.has(key)) {
    let at = NaN;
    try { at = Date.parse(readJsonFile(path)?.meta?.pulledAt); } catch { /* unreadable: ordered first, never the latest */ }
    pulledAtCache.set(key, Number.isFinite(at) ? at : -Infinity);
  }
  return pulledAtCache.get(key);
}
const suffixOf = (f) => Number(/-(\d+)\.json$/.exec(f)?.[1] ?? 1);
function snapshotFiles(ctx, slug) {
  const dir = join(dirOf(ctx, slug), SNAPSHOTS_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => /\.json$/.test(f) && !f.startsWith("preview") && !isAccountStoreFile(f)).map((f) => ({ f, path: join(dir, f) })).map((x) => ({ ...x, at: snapshotInstant(x.path) }))
    .sort((a, b) => a.at - b.at || cmpKey(a.f.replace(/-\d+\.json$/, ".json"), b.f.replace(/-\d+\.json$/, ".json")) || suffixOf(a.f) - suffixOf(b.f)).map((x) => x.path);
}
// ── A run directory's owner (F-535) ──────────────────────────────────────────
// Every run directory a dashboard makes is named dash-<slug>-<core>[-<n>][-lb<days>]: the core is plan-, preview- or
// account- with ten hex digits (stableRunId, the account timeline), or a pull's second-resolution stamp; -<n> a name
// taken in the same second (freshName), -lb<days> a plan re-made on a moved lookback (appended after; the grammar
// takes the two suffixes in either order). A slug may hold hyphens, so a name PREFIX
// is no owner (renewals would own dash-renewals-emea-…). The owner is read back from the name by that one grammar:
// the slug is the longest head whose rest is exactly one core and its suffixes, and a core can sit in no suffix, so
// the reading is exact.
const RUN_NAME_RE = /^dash-(.+)-(?:(plan|preview|account)-[0-9a-f]{10}|\d{8}T\d{6})(?:-\d+)?(?:-lb\d+)?(?:-\d+)?$/;
/** @returns {?{slug: string, kind: "plan"|"preview"|"account"|"pull"}} the dashboard a run directory belongs to and its kind */
export function runOwner(name) {
  const m = RUN_NAME_RE.exec(String(name));
  return m ? { slug: m[1], kind: /** @type {*} */ (m[2] ?? "pull") } : null;
}
/** This dashboard's run directories that hold a pull or its plan (a first refresh lives in the interview's plan directory): never a dry run's or an account timeline's. */
function pullRunDirs(ctx, slug) {
  const root = join(ctx.wsDir, ".gs-superadmin", "tmp", "engagement");
  return existsSync(root) ? readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory() && runOwner(d.name)?.slug === slug && ["plan", "pull"].includes(runOwner(d.name)?.kind ?? "")).map((d) => d.name) : [];
}
const latestSnapshotPath = (ctx, slug) => snapshotFiles(ctx, slug).at(-1) ?? null;
const openSnapshotFile = (path) => engine.openSnapshot(readJsonFile(path));
/** One account store per dashboard, the latest snapshot's (ruled 2026-10-15, F-548): every other store in its snapshots folder is removed. */
function pruneStores(ctx, slug, keep) {
  const dir = join(dirOf(ctx, slug), SNAPSHOTS_DIR);
  if (!existsSync(dir)) return [];
  const gone = readdirSync(dir).filter((f) => isAccountStoreFile(f) && join(dir, f) !== keep);
  for (const f of gone) rmSync(join(dir, f), { force: true });
  return gone;
}
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
    // Said at the takeover, so a run refused later (the budget) still leaves a record of whose lock it took.
    ctx.log(`took over a stale refresh lock of "${slug}" held by ${held.by ?? "unknown"} since ${held.at}`);
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
/**
 * The refresh line a stopped or refused refresh prints as its remedy (F-523): the entry command's own line with
 * `--kb` and THE RUN'S FLAGS, so the line runs as printed. The refusal also carries it as `remedy {login, line}`,
 * and the entry-command suite executes every remedy it can provoke.
 */
export const refreshRemedy = (ctx, slug, { full = false, healthOnly = false } = {}) => `${COPY_LINES.refresh(slug, basename(ctx.kbDir))}${full ? " --full" : ""}${healthOnly ? " --health-only" : ""}`;
const remedyOf = (line, login) => ({ remedy: { login, line } });
/** Any other verb's line, as a remedy prints it: the entry command, the words, `--kb` (F-523). */
const entryLine = (ctx, ...words) => `${ENTRY_COMMAND} ${words.join(" ")} --kb ${basename(ctx.kbDir)}`;
function preflight(ctx, spec, { owner = "this dashboard", again = null } = {}) {
  const r = ctx.live().run({ id: "whoami", argv: ["whoami"], timeoutMs: 60000 });
  if (!r.ok) refuse(`gs-admin whoami failed: ${r.stderr.trim() || `exit ${r.status}`}`);
  const who = parseWhoami(r.stdout);
  if (!who.host) refuse("whoami shows no Base URL — the CLI has no tenant selected");
  if (who.host !== spec.tenantHost) refuse(`the CLI is on ${who.host}, and ${owner} belongs to ${spec.tenantHost} — switch tenants (gs-admin config --base-url …) or pick the ${owner === "this dashboard" ? "dashboard" : "knowledge base"} of that tenant; nothing was called`, "wrong-tenant");
  if (who.tokenState !== "valid") refuse(`whoami reports the token as ${who.tokenState} — run \`gs-admin login\`, then run ${again ? `\`${again}\`` : "this"} again`, "token-expired", again ? remedyOf(again, true) : {});
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
  // The account store beside the previous snapshot (F-548): a selective refresh with accounts carries every account's
  // older months from it; with none of its own, the adapter's decideRefresh makes the refresh full and says why.
  const previousStore = previousPath ? readAccountStore(accountStorePath(previousPath)) : null;
  // A resumed run keeps the day it was planned on unless --today was given (F-483), as the adapter's own CLI does.
  const { runDir, params, resumed } = prepareRun({ wsDir: ctx.wsDir, runId, params: paramsOn(ctx.today), previousPath, cliVersion: ctx.catalog.meta?.cliVersion ?? null, todayGiven: ctx.todayGiven, reparams: paramsOn });
  const summary = fetchEngagement({ params, runDir, kbDir: ctx.kbDir, previous, previousStore, phase, transport: ctx.live(), gate: ctx.gate, onCall: (line) => ctx.log(`${phase === "plan" ? "plan" : "pull"} ${line}`) });
  return { runDir, params, resumed, summary, previous, previousStore, categoriesFile };
}
/** The plan twice when the derived lookback moves (ENG-2 item 3): the second plan is the one the pull resumes. */
function planWithLookback(ctx, args) {
  const first = runAdapter(ctx, { ...args, phase: "plan" });
  if (first.summary.status !== "ok") return first;
  const longest = first.summary.estimate?.health?.lookback?.longestPeriodDays ?? null;
  const derived = Math.max(args.spec.health.silentDays, longest ?? 0);
  // What the lookback came from, said on a tie as well (the longest period equal to the spec's threshold reads as
  // derived from it, not as "nothing derived"; the first sitting's note of 2026-10-12): the longest schedule period when
  // it reached the floor, else null (the spec's silentDays stands on its own).
  const derivedFrom = longest != null && longest >= args.spec.health.silentDays ? longest : null;
  if (!first.params.health.pull || derived === first.params.health.lookbackDays) return { ...first, lookbackDays: first.params.health.lookbackDays, lookbackDerivedFrom: first.params.health.pull ? derivedFrom : null };
  const second = runAdapter(ctx, { ...args, phase: "plan", lookbackDays: derived, runId: `${args.runId}-lb${derived}` });
  return { ...second, lookbackDays: second.params.health.lookbackDays, lookbackDerivedFrom: derivedFrom };
}
// The tenant's failure categories reach the pull (runAdapter passes them), so they are in the key (F-543): a category
// file edited the same day after a plan names a new run, never a resume prepareRun refuses as other flags.
const stableRunId = (ctx, spec, what) => `dash-${spec.slug}-${what}-${sha(adapterParams(spec, { today: ctx.today, categories: categoriesFor(ctx).categories }))}`;
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
  // The knowledge-base folder's name rides every page, so its copy lines carry --kb (F-503).
  const built = spec.pages.map((pg) => buildPage({ spec, snapshot, pageId: pg.id, ...sources, delta, kb: basename(ctx.kbDir) }));
  const refused = built.filter((b) => b.report.refused);
  // All or nothing: a refused page leaves every last good page as it was.
  if (refused.length) refuse(`page "${refused[0].report.page}": ${refused[0].report.refused} — no page was replaced`);
  mkdirSync(outDir, { recursive: true });
  for (const b of built) { writeFileAtomicSync(join(outDir, b.report.file), b.html); b.report.written = true; }
  for (const b of built) if (b.report.warning) ctx.log(`page "${b.report.page}": ${b.report.warning}`);
  return built.map((b) => ({ ...b.report, path: join(outDir, b.report.file) }));
}
/** A list as the spec and the pull's echo both hold it, for comparing the two. */
const listKey = (l) => JSON.stringify([l.kind, l.n, l.floor, l.per ?? null]);
/**
 * The customer lists follow the saved spec on every build (F-548, F-530: the pages, the report and the About tab read
 * one ranking): when the spec's lists are not the ones this snapshot was ranked with, they are ranked again from the
 * snapshot's account store with no pull, and the snapshot is rewritten in place. Null when nothing was ranked: the lists
 * already agree, the pull holds no accounts, or the snapshot has no store of its own (the next refresh ranks them).
 */
function rankChangedLists(spec, snapshot, snapshotPath) {
  if (spec.accounts?.pull === false || !engine.accountAvailability(snapshot).pulled) return null;
  const want = accountLists(spec);
  if (want.map(listKey).join() === (snapshot.meta.params?.accounts?.lists ?? []).map(listKey).join()) return null;
  const store = readAccountStore(accountStorePath(snapshotPath));
  if (!accountStoreFits(store, snapshot)) return null;
  const { snapshot: ranked, newlyKept } = rankFromStore({ snapshot, store, lists: want });
  writeFileAtomicSync(snapshotPath, JSON.stringify(ranked));
  return { snapshot: ranked, newlyKept: newlyKept.length, unnamed: ranked.meta.params.accounts.names ? ranked.dimensions.accounts.filter((a) => newlyKept.includes(a.key) && a.name == null).length : 0 };
}
function rebuildFrom(ctx, { spec, snapshotPath, previousPath, outDir }) {
  const opened = openSnapshotFile(snapshotPath);
  const listsRanked = rankChangedLists(spec, opened, snapshotPath);
  const pulled = listsRanked?.snapshot ?? opened;
  const previous = previousPath ? openSnapshotFile(previousPath) : null;
  const { snapshot, resolution } = applyGroups(pulled, spec.groups, { previous });
  const delta = computeDelta(spec, snapshot, previous);
  const pages = buildPages(ctx, { spec, snapshot, delta, outDir });
  return { pages, ungrouped: resolution.line, delta: delta ? { previousPulledAt: delta.previousPulledAt, closedMonths: delta.closedMonths.length, programs: delta.programs } : null, pulledAt: snapshot.meta.pulledAt, listsRanked: listsRanked ? { newlyKept: listsRanked.newlyKept, unnamed: listsRanked.unnamed } : null, publish: publishLeaders(ctx, { spec, snapshot }) };
}

// ── The leaders' copy, published (PUB-3; ruled 2026-10-13 at X1, 2026-10-14 at S7's kickoff) ──────────────────
// Script-only and LLM-free: the runner publishes after the pages are written, never before, and only reads them, so
// a publish that fails never touches the workspace's latest-*.html. A failed or stopped refresh never reaches this.
//   none             nothing;
//   file-copy        the leaders' page copied into the folder this machine maps the target's NAME to, under the
//                    spec's file name, the SAME name every time (written beside it under a temporary name, then
//                    renamed over it, so a synced folder never holds half a file); with `datedCopies` a copy named
//                    with the pull's date beside it; with `datasets` the page's tables as CSV files in a data folder
//                    beside it (written in the workspace first, then copied the same way);
//   claude-artifact  the leaders' page written in an artifact's content form for the skill to publish (only Claude
//                    can), with the link to update when one was recorded.
/** @returns {{targets: Object<string, {folder: string}>}} the workspace's publish targets ({} when none is set) */
function readPublishTargets(ctx) {
  const file = join(ctx.wsDir, ".gs-superadmin", PUBLISH_TARGETS_FILE);
  const raw = readJsonOr(file, null);
  if (raw == null) return { targets: {} };
  if (!raw || typeof raw !== "object" || !raw.targets || typeof raw.targets !== "object") refuse(`${file} must be {"targets": {"<name>": {"folder": "<path>"}}}: write it with publish-target <name> <folder>`);
  return { targets: raw.targets };
}
/** The ONE writer of the publish targets (A-10): a target's name and an existing folder on this machine. */
function writePublishTarget(ctx, name, folder) {
  if (!PUBLISH_TARGET_NAME_RE.test(String(name ?? ""))) refuse(`a publish target's name is letters, digits, dot, dash or underscore, at most 40 (got "${printable(String(name ?? ""), 40)}")`);
  const f = String(folder ?? "").trim();
  if (!f || !isAbsolute(f)) refuse(`the folder for "${name}" must be a full path on this computer (got "${printable(f, 120)}")`);
  let isDir = false;
  try { isDir = statSync(f).isDirectory(); } catch { /* missing: said below */ }
  if (!isDir) refuse(`the folder for "${name}" does not exist or is not a folder: ${f} — create it (or let the sync client create it) first`);
  const file = join(ctx.wsDir, ".gs-superadmin", PUBLISH_TARGETS_FILE);
  const { targets } = readPublishTargets(ctx);
  const next = { targets: { ...targets, [name]: { folder: resolve(f) } } };
  writeJson(file, next);
  return { name, folder: resolve(f), file };
}
/**
 * Copy a file into a folder through the one atomic-write primitive (written beside the destination under a temporary
 * name, then put in its place; a failed replace removes its temporary file), so a synced folder never holds half a file.
 */
function copyInto(src, dir, name) {
  const dest = join(dir, name);
  writeFileAtomicSync(dest, readFileSync(src));
  return dest;
}
/** Remove the CSV files of the dashboard's OWN data folder in the workspace that this publish did not write (a panel removed since). */
function pruneDataFolder(dir, keep) {
  for (const f of existsSync(dir) ? readdirSync(dir) : []) if (/\.csv$/i.test(f) && !keep.includes(f)) rmSync(join(dir, f), { force: true });
}
// What this dashboard last wrote into the shared folder (F-532): the page, its data folder and the data files, as ONE
// record beside the spec, written when a copy is whole. The shared folder is not the dashboard's: a file there is ours
// only when this record names it, so the prune removes a data file the last publish wrote and this one does not (a
// panel removed since), never another dashboard's file or a leader's own copy; and a copy the last publish wrote that
// this one does not replace (the file renamed, another target, the data files switched off) is named, not deleted.
export const PUBLISH_RECORD_FILE = "published.json";
const readPublishRecord = (dir) => { try { const r = readJsonOr(join(dir, PUBLISH_RECORD_FILE), null); return r && typeof r.file === "string" ? r : null; } catch { return null; } };
/** The copies the last publish wrote that this one no longer updates (null `now`: the dashboard publishes to no folder now). */
function noLongerUpdated(prev, now) {
  if (!prev) return [];
  const out = [];
  if (!now || resolve(prev.file) !== resolve(now.file)) out.push(prev.file);
  if (prev.data?.folder && (!now?.data || resolve(prev.data.folder) !== resolve(now.data.folder))) out.push(prev.data.folder);
  return out;
}
const noLongerText = (paths) => `the earlier copy is no longer updated by this dashboard and was left where it is: ${paths.join(", ")} — remove it from the shared folder when no one reads it, or point its readers at the new file`;
const copyFault = (e) => (e && typeof e === "object" && "code" in e ? `${e.code}: ${e instanceof Error ? e.message : e}` : String(e));
/**
 * Publish the leaders' page(s) of a dashboard as its spec says, from the pages as they stand in the workspace.
 * Never refuses: a publish that cannot be made, for any reason (a malformed targets file included), is said in what it
 * returns and on stderr, and the pull, the snapshot and the pages it follows stand (S7 review).
 * @param {*} ctx @param {{spec: *, snapshot: *}} args the snapshot the pages were built from (its groups applied)
 */
function publishLeaders(ctx, args) {
  try {
    return publishLeadersOrThrow(ctx, args);
  } catch (e) {
    const why = `the leaders' copy could not be published: ${e instanceof Error ? e.message : String(e)}; the pages in the workspace are untouched`;
    ctx.log(why);
    return { target: args.spec.publish?.target ?? "none", published: false, why };
  }
}
function publishLeadersOrThrow(ctx, { spec, snapshot }) {
  const pub = spec.publish ?? { target: "none", config: {} };
  const leaders = spec.pages.filter((pg) => pg.preset === "exec");
  const dir = dirOf(ctx, spec.slug);
  const prev = readPublishRecord(dir);
  // The publish moved off the shared folder: the copy there is said once (on this result), and the record goes with it.
  let offFolder = {};
  if (pub.target !== "file-copy" && prev) {
    const stale = noLongerUpdated(prev, null);
    rmSync(join(dir, PUBLISH_RECORD_FILE), { force: true });
    offFolder = { noLongerUpdated: stale, note: noLongerText(stale) };
    ctx.log(`the leaders' copy: ${offFolder.note}`);
  }
  if (pub.target === "none" || !leaders.length) return { target: pub.target, published: false, why: pub.target === "none" ? "the dashboard publishes nowhere: its pages are files in the workspace" : "the dashboard has no leaders' page", ...offFolder };
  const page = leaders[0];
  const local = join(dir, pageFileName(page.id));
  if (!existsSync(local)) return { target: pub.target, published: false, why: `no leaders' page to publish yet (${local}): run \`${refreshRemedy(ctx, spec.slug)}\` first` };
  if (pub.target === "claude-artifact") {
    // Fix (i) of X1's two: the page's CONTENT, never its whole document, so the artifact does not nest a document.
    const outDir = join(dir, PUBLISH_DIR);
    mkdirSync(outDir, { recursive: true });
    const file = join(outDir, pageFileName(page.id).replace(/\.html$/, ".artifact.html"));
    writeFileAtomicSync(file, artifactContentOf(readFileSync(local, "utf8")));
    const url = pub.config.url ?? null;
    ctx.log(`the leaders' page is ready to publish as a claude.ai artifact: ${file} (/gs-superadmin:email-engagement publishes it${url ? ` to ${url}` : ""})`);
    return { ...offFolder, target: "claude-artifact", published: false, ready: true, file, url, title: `${spec.title} · ${page.title}`, capabilities: { downloads: true }, next: `Claude publishes this file as a claude.ai artifact (a target no longer offered: the Artifact tool reads the whole file first, several turns at a real page's size): /gs-superadmin:email-engagement publish ${spec.slug}${url ? `; it updates ${url}` : "; record the new link afterwards with " + entryLine(ctx, "change", spec.slug, `'publish.config.url="<link>"'`)}` };
  }
  // file-copy
  const c = pub.config;
  const folder = readPublishTargets(ctx).targets[c.to]?.folder ?? null;
  const setLine = entryLine(ctx, "publish-target", c.to, "<folder>");
  if (!folder) {
    const why = `no folder is set for the publish target "${c.to}" on this computer: set one with \`${setLine}\` (the folder stays on this computer; the dashboard names only "${c.to}")`;
    ctx.log(`the leaders' copy was not published: ${why}`);
    return { target: "file-copy", to: c.to, published: false, why, remedy: { login: false, line: setLine } };
  }
  let isDir = false;
  try { isDir = statSync(folder).isDirectory(); } catch { /* said below */ }
  if (!isDir) {
    const why = `the folder for "${c.to}" is not there: ${folder} — is the synced folder still on this computer? Set another with \`${setLine}\`; the pages in the workspace are untouched`;
    ctx.log(`the leaders' copy was not published: ${why}`);
    return { target: "file-copy", to: c.to, folder, published: false, why };
  }
  // The data folder is written in the workspace first (an admin can open it there too), all files or none, and only
  // when there is somewhere to copy it; a file of a panel removed since is pruned here and in the shared folder.
  let datasets = null;
  if (c.datasets) {
    const files = buildDatasets({ spec, snapshot, pageId: page.id, kb: basename(ctx.kbDir) });
    const localData = join(dir, datasetsDirName(pageFileName(page.id)));
    mkdirSync(localData, { recursive: true });
    for (const f of files) writeFileAtomicSync(join(localData, f.name), f.text);
    pruneDataFolder(localData, files.map((f) => f.name));
    datasets = { local: localData, files: files.map((f) => f.name) };
  }
  // `published` is true only when the WHOLE copy was replaced: the page, the dated copy and every data file (F-527).
  // A copy that fails part-way says what this publish replaced and what it did not (`partial`), the exit staying 0.
  const destData = datasets ? join(folder, datasetsDirName(c.file)) : null;
  const datedName = c.datedCopies ? c.file.replace(/\.html$/i, `-${String(snapshot.meta.pulledAt).slice(0, 10)}.html`) : null;
  const planned = [join(folder, c.file), ...(datedName ? [join(folder, datedName)] : []), ...(datasets ? datasets.files.map((name) => join(destData, name)) : [])];
  const replaced = [];
  const out = { target: "file-copy", to: c.to, folder, file: join(folder, c.file), published: false, partial: null, dated: null, datasets: null, why: null };
  try {
    replaced.push(copyInto(local, folder, c.file));
    if (datedName) replaced.push((out.dated = copyInto(local, folder, datedName)));
    if (datasets && destData) {
      mkdirSync(destData, { recursive: true });
      for (const name of datasets.files) replaced.push(copyInto(join(datasets.local, name), destData, name));
      out.datasets = { folder: destData, files: datasets.files };
    }
    out.published = true;
  } catch (e) {
    const notReplaced = planned.filter((f) => !replaced.includes(f));
    if (replaced.length) out.partial = { replaced, notReplaced };
    out.why = `${replaced.length ? `the copy is not whole: ${replaced.length} of ${planned.length} files were replaced and ${notReplaced.length} still hold the previous publish (${notReplaced.map((f) => basename(f)).join(", ")}), because ` : ""}a copy into ${folder} failed (${copyFault(e)}): a file locked by the sync client, or the folder moved; the pages in the workspace are untouched — run \`${entryLine(ctx, "publish", spec.slug)}\` to try again`;
    ctx.log(`the leaders' copy: ${out.why}`);
    return out;
  }
  // Pruning a stale data file comes after the copy is whole, and only a file the last publish of THIS dashboard wrote
  // there (its record): one that cannot be removed leaves the copy whole and is said.
  const sameData = prev?.data?.folder && destData && resolve(prev.data.folder) === resolve(destData);
  const stale = sameData ? prev.data.files.filter((f) => !datasets.files.includes(f)) : [];
  const leftStale = [];
  for (const f of stale) {
    try { rmSync(join(destData, f), { force: true }); } catch (e) { leftStale.push(f); out.why = `the copy is whole, but a data file no panel writes any more could not be removed from ${destData} (${copyFault(e)}): it is stale; remove it by hand`; ctx.log(`the leaders' copy: ${out.why}`); }
  }
  const record = { file: out.file, data: datasets && destData ? { folder: destData, files: [...datasets.files, ...leftStale] } : null, at: new Date(ctx.nowMs).toISOString() };
  const moved = noLongerUpdated(prev, record);
  if (moved.length) { out.noLongerUpdated = moved; out.note = noLongerText(moved); ctx.log(`the leaders' copy: ${out.note}`); }
  writeJson(join(dir, PUBLISH_RECORD_FILE), record);
  ctx.log(`the leaders' copy was published: ${out.file} (the same file each time)${out.dated ? `, and ${out.dated}` : ""}${out.datasets ? `, with ${out.datasets.files.length} CSV files in ${out.datasets.folder}` : ""}`);
  return out;
}
// ── Native Gainsight reports (NAT-1, NAT-2; S8) ─────────────────────────────
// The plan (which panels a Gainsight report can carry, and the exact line for each) is dashboard-native.mjs's, pure.
// These verbs own its files and make its READS only: the tenant's schema, a saved report by name or id, a saved
// report's rows. The lines that create or update a report are printed, NEVER run: the skill issues each one as its
// own visible command, so the mutation guard asks (house rule 4; tenets 1 and 3), and the gate below refuses any
// command outside NATIVE_READ_PATHS, a catalogued-mutating one first (A-5). The CLI cannot delete a report: what no
// panel plans any more is listed for the UI.
export const NATIVE_DIR = "native";
export const NATIVE_PLAN_FILE = "plan.json";
/** The reads the native verbs may make, each catalogued non-mutating. */
export const NATIVE_READ_PATHS = new Set(["whoami", "report schema", "report describe", "report run-saved"]);
function nativeRead(ctx, argv, id) {
  const why = ctx.nativeGate(argv);
  if (why) refuse(why);
  return ctx.live().run({ id, argv, timeoutMs: 120000 });
}
const nativeDir = (ctx, slug) => join(dirOf(ctx, slug), NATIVE_DIR);
/** The workspace-relative file a planned line writes the CLI's answer to (the line runs from the workspace folder). */
const nativeOutFile = (ctx, slug, entry) => relative(ctx.wsDir, join(nativeDir(ctx, slug), `${entry.page}-${entry.panel}.${entry.action}.json`)).split(sep).join("/");
function readNativeSchema(ctx) {
  const r = nativeRead(ctx, ["--json", "rp", "schema", "--object", NATIVE_OBJECT], "native-schema");
  if (!r.ok) refuse(`gs-admin rp schema --object ${NATIVE_OBJECT} failed: ${printable(r.stderr.trim() || `exit ${r.status}`, 300)}`);
  let fields = null;
  try { fields = JSON.parse(r.stdout)?.data?.fields ?? null; } catch { /* said below */ }
  if (!Array.isArray(fields) || !fields.length) refuse(`rp schema --object ${NATIVE_OBJECT} returned no field list — refusing to plan reports against a schema it cannot read`);
  return fields.filter((f) => f && typeof f.fieldName === "string").map((f) => ({ fieldName: f.fieldName, dataType: String(f.dataType ?? "") }));
}
/** The plan as a reader needs it: per report its verdict, what it leaves out and why, the UI steps, and its line. */
function planSummary(ctx, slug, plan, spec) {
  const reports = plan.entries.filter((e) => e.payload).map((e) => ({
    panel: e.key, title: e.title, status: e.status, action: e.action, name: e.name, ...(e.sameAs ? { sameAs: e.sameAs } : {}), reportId: e.reportId ?? null,
    // A panel sharing a report that exists already, but not yet recorded under its own key (it was added after the
    // report was created): native-record records it with no command to run.
    ...(e.action === "shared" && e.reportId && !(spec.native?.reports ?? []).some((r) => r.panel === e.key && r.reportId === e.reportId) ? { unrecorded: true } : {}),
    leftOut: e.leftOut.map((l) => `${l.label}: ${l.text}`), uiSteps: e.uiSteps.map((s) => s.text),
    ...(e.action === "create" || e.action === "update" ? { command: commandLine(e, nativeOutFile(ctx, slug, e)) } : {}),
    ...(e.action === "update" ? { warning: "rp update replaces the report's columns: the calculated and formula columns added in the UI go, and are added again from uiSteps" } : {}),
  }));
  const notNative = plan.entries.filter((e) => !e.payload).map((e) => ({ panel: e.key, title: e.title, why: e.reasons.map((r) => `${r.text}${r.detail ? ` (${r.detail})` : ""}`).join("; ") }));
  return { reports, notNative };
}
function verbNativePlan(ctx, slug, rest) {
  const spec = savedSpec(ctx, slug);
  const prefix = rest.includes("--test-prefix") ? TEST_PREFIX : "";
  let schema = null;
  if (!rest.includes("--no-schema")) {
    preflight(ctx, spec, { again: entryLine(ctx, "native-plan", slug, ...(prefix ? ["--test-prefix"] : [])) });
    schema = readNativeSchema(ctx);
  }
  const plan = nativePlan(spec, { prefix, schema });
  const dir = nativeDir(ctx, slug);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, NATIVE_PLAN_FILE);
  writeJson(file, { kind: "native-plan", slug, tenantHost: spec.tenantHost, at: new Date(ctx.nowMs).toISOString(), ...plan });
  const { reports, notNative } = planSummary(ctx, slug, plan, spec);
  return {
    ok: true, mode: "native-plan", slug, prefix, schemaChecked: plan.schemaChecked, counts: plan.counts, reports, notNative, dashboardSteps: plan.dashboardSteps, cleanup: plan.cleanup, planFile: file,
    next: plan.schemaChecked
      ? `issue each report's command as its own command (the guard asks for each), then record it: ${entryLine(ctx, "native-record", slug, "--panel", "<panel>")}; then read them back: ${entryLine(ctx, "native-verify", slug)}`
      : `a plan made without the tenant's schema is for reading only: run ${entryLine(ctx, "native-plan", slug, ...(prefix ? ["--test-prefix"] : []))} after gs-admin login before issuing any command`,
  };
}
function verbNativeRecord(ctx, slug, opt) {
  const spec = savedSpec(ctx, slug);
  const key = opt("--panel");
  if (!key) refuse(`native-record needs --panel <page id>/<panel id> — the panel whose report was just created or updated (native-plan lists them)`);
  if (ctx.store.readDraft(slug)) refuse(`"${slug}" has a draft in progress — save or discard it first, so recording a report never saves someone's unfinished edit`);
  const planFile = join(nativeDir(ctx, slug), NATIVE_PLAN_FILE);
  const plan = readJsonOr(planFile, null);
  const planned = plan?.entries?.find((e) => e.key === key && ["create", "update", "shared"].includes(e.action)) ?? null;
  // A shared panel is recorded under the report of the panel it shares, once that one has an id.
  const entry = planned?.action === "shared" ? plan.entries.find((e) => e.key === planned.sameAs) ?? null : planned;
  if (!entry || (planned?.action === "shared" && !planned.reportId)) refuse(planned?.action === "shared" ? `"${key}" shares the report of "${planned.sameAs}", which has no id yet — record that one first` : `no create or update is planned for "${key}" — run ${entryLine(ctx, "native-plan", slug)} first; it lists the panels and their lines`);
  if (!plan.schemaChecked) refuse(`the plan was made without the tenant's schema (--no-schema): plan again after gs-admin login before recording`);
  // The plan must still be the dashboard's: a spec changed since would record a report the panel no longer matches.
  const now = nativePlan(spec, { prefix: plan.prefix ?? "" }).entries.find((e) => e.key === entry.key);
  if (!now || now.hash !== entry.hash) refuse(`the dashboard changed since the plan was made: "${key}" now plans another report — run ${entryLine(ctx, "native-plan", slug)} again`);
  preflight(ctx, spec, { again: entryLine(ctx, "native-record", slug, "--panel", key) });
  const byId = entry.action === "update" || planned?.action === "shared" || (entry.action === "unchanged" && !!entry.reportId);
  const r = nativeRead(ctx, byId ? ["--json", "rp", "describe", "--id", entry.reportId] : ["--json", "rp", "describe", "--name", entry.name], "native-describe");
  let described = null;
  try { described = r.ok ? JSON.parse(r.stdout) : null; } catch { /* said below */ }
  const reportId = describedReportId(described);
  if (!reportId) refuse(`the report "${entry.name}" was not found ${entry.action === "update" ? `by its id ${entry.reportId}` : "by its exact name"}: did its ${entry.action} line run and succeed? (${printable(r.stderr.trim() || "no id in the answer", 300)})`);
  if (byId && reportId !== entry.reportId) refuse(`rp describe --id ${entry.reportId} answered another report (${reportId}) — nothing recorded`);
  // An update renames the report to the planned name (--new-name), so a report that still has another name was not
  // updated. When the plan keeps the name, the name cannot tell: the summary says the update is confirmed by name only.
  const nowName = described?.data?.reportName ?? described?.reportName ?? null;
  if (entry.action === "update" && typeof nowName === "string" && nowName !== entry.name) refuse(`the report ${reportId} still has the name "${printable(nowName, 120)}", not "${printable(entry.name, 120)}": did its update line run and succeed? Nothing recorded`);
  // The panel and every panel that shares its report, under one id and the first's fingerprint.
  const keys = planned?.action === "shared" ? [key] : [key, ...plan.entries.filter((e) => e.action === "shared" && e.sameAs === key).map((e) => e.key)];
  const records = keys.map((k) => ({ panel: k, reportId, name: entry.name, planHash: entry.hash }));
  const kept = (spec.native?.reports ?? []).filter((x) => !keys.includes(x.panel));
  ctx.store.startDraft(slug, { by: ctx.by, takeOver: ctx.takeOver });
  try {
    ctx.store.setDraft(slug, { sets: [["native.reports", [...kept, ...records]]], by: ctx.by, takeOver: ctx.takeOver });
  } catch (e) {
    ctx.store.discardDraft(slug);
    if (e instanceof SpecRefusal) refuse(e.message);
    throw e;
  }
  ctx.store.save(slug);
  return {
    ok: true, mode: "native-record", slug, panel: key, action: entry.action, reportId, name: entry.name, recorded: keys, uiSteps: entry.uiSteps.map((s) => s.text),
    confirmed: entry.action === "create" ? "found by its exact name" : typeof nowName === "string" ? "its name is the planned one (a change that keeps the name cannot be told from no change: read it back with native-verify)" : "the report exists (its name was not in the answer)",
    note: "recorded through the spec writer; the About tab counts the reports at the next rebuild or refresh",
  };
}
function verbNativeVerify(ctx, slug, opt) {
  const spec = savedSpec(ctx, slug);
  const only = opt("--panel") ?? null;
  const recorded = (spec.native?.reports ?? []).filter((x) => !only || x.panel === only);
  if (!recorded.length) refuse(only ? `no report is recorded for "${only}"` : `no native report is recorded for "${slug}" yet — create them from ${entryLine(ctx, "native-plan", slug)} and record each with native-record`);
  preflight(ctx, spec, { again: entryLine(ctx, "native-verify", slug, ...(only ? ["--panel", only] : [])) });
  const plan = readJsonOr(join(nativeDir(ctx, slug), NATIVE_PLAN_FILE), null) ?? nativePlan(spec);
  const dir = join(nativeDir(ctx, slug), "verify");
  mkdirSync(dir, { recursive: true });
  const reports = [];
  for (const rec of recorded.filter((x, i, all) => all.findIndex((y) => y.reportId === x.reportId) === i)) {
    const entry = plan.entries.find((e) => e.key === rec.panel && e.payload) ?? null;
    const r = nativeRead(ctx, ["--json", "rp", "run-saved", "--id", rec.reportId, "--page-size", "50"], `native-verify-${rec.reportId}`);
    if (!r.ok) { reports.push({ panel: rec.panel, reportId: rec.reportId, ok: false, why: `rp run-saved failed: ${printable(r.stderr.trim() || `exit ${r.status}`, 300)}` }); continue; }
    const file = join(dir, `${String(rec.panel).replace(/[^A-Za-z0-9._-]/g, "_")}.json`);
    writeFileAtomicSync(file, r.stdout);
    let rows = null;
    try { rows = JSON.parse(r.stdout); } catch { /* readBack says so */ }
    const back = entry ? readBack(rows, entry) : { ok: false, why: "no planned report for this panel: run native-plan to compare", rows: Array.isArray(rows) ? rows.length : 0, missing: [], uiPending: [] };
    reports.push({ panel: rec.panel, reportId: rec.reportId, name: rec.name ?? null, file, ...back });
  }
  return { ok: reports.every((x) => x.ok), mode: "native-verify", slug, reports, uiPending: reports.filter((x) => x.uiPending?.length).map((x) => ({ panel: x.panel, columns: x.uiPending })), dashboardSteps: plan.dashboardSteps ?? dashboardSteps(spec), cleanup: plan.cleanup ?? [] };
}
/** Publish the pages as they stand, with no pull and no rebuild (the manual publish, R8; a publish setting's change). */
function publishNow(ctx, slug, spec) {
  const latest = latestSnapshotPath(ctx, slug);
  if (!latest) return { publish: { target: spec.publish.target, published: false, why: `no snapshot of "${slug}" yet: run \`${refreshRemedy(ctx, slug)}\` first` } };
  const { snapshot } = applyGroups(openSnapshotFile(latest), spec.groups);
  return { publish: publishLeaders(ctx, { spec, snapshot }) };
}
function verbPublish(ctx, slug) {
  const spec = savedSpec(ctx, slug);
  return { ok: true, mode: "publish", slug, ...publishNow(ctx, slug, spec) };
}
function verbPublishTarget(ctx, positional) {
  const [name, ...rest] = positional;
  if (!name) return { ok: true, mode: "publish-target", file: join(ctx.wsDir, ".gs-superadmin", PUBLISH_TARGETS_FILE), targets: readPublishTargets(ctx).targets };
  return { ok: true, mode: "publish-target", ...writePublishTarget(ctx, name, rest.join(" ")) };
}

// ── The verbs ────────────────────────────────────────────────────────────────
/** The questions an admin answers (neither the tenant statement nor the closing step's action rows). */
const SETTING_QUESTIONS = QUESTIONS.filter((q) => !["preflight", "action"].includes(q.kind)).map((q) => q.id);
function verbNew(ctx, slug, opt, argv) {
  const r = ctx.store.startDraft(slug, { title: opt("--title") ?? null, owner: opt("--owner") ?? null, by: ctx.by, takeOver: ctx.takeOver });
  const fastPath = argv.includes("--fast-path");
  if (fastPath && r.state === "new") {
    // The standard program-health dashboard (F-512): `next` answers every question but the closing step with the
    // question's own default, through its own apply, in order (so the plan the defaults need is made on the way, and a
    // skip rule reads the answers before it); the look is skipped, never asked twice; the tenant is still checked.
    saveInterviewState(ctx, slug, { ...interviewState(ctx, slug), fastPath: true });
  }
  let answered = r.answered;
  if (r.state === "editing-saved") {
    // An edit starts from the saved spec, so every setting it holds IS answered (F-516): `next` goes to the closing
    // step, which says what the edit changes and costs; `next --question <id>` is the way to change one setting.
    answered = ctx.store.setDraft(slug, { answered: SETTING_QUESTIONS, by: ctx.by, takeOver: ctx.takeOver }).answered;
  }
  // --fast-path applies to a NEW dashboard: an edit starts from the saved settings and a resumed draft keeps its own; said, never dropped in silence.
  const fastPathIgnored = fastPath && r.state !== "new" ? `--fast-path applies to a new dashboard only (this is ${r.state === "resumed" ? "a resumed draft, which keeps its answers" : "an edit, which starts from the saved settings"}); ignored` : null;
  return { ok: true, mode: "new", slug, state: r.state, fastPath: fastPath && r.state === "new", ...(fastPathIgnored ? { fastPathIgnored } : {}), by: r.by, answered, next: nextQuestionId(ctx, slug), ...(r.state === "editing-saved" ? { hint: `an edit of the saved dashboard: next goes to the closing step; next --question <id> changes one setting (${SETTING_QUESTIONS.join(", ")})` } : {}) };
}
function interviewState(ctx, slug) { return readJsonOr(join(dirOf(ctx, slug), INTERVIEW_FILE), { plan: null, preview: null }); }
function saveInterviewState(ctx, slug, state) { mkdirSync(dirOf(ctx, slug), { recursive: true }); writeJson(join(dirOf(ctx, slug), INTERVIEW_FILE), state); }
/**
 * The interview's plan keys. ONE plan serves the window question and the grouping proposal (ruled 2026-10-12): the
 * LOOSE key leaves the reporting window out, so the window answer does not force a second plan before the proposal;
 * the questions quote their minutes from that plan (a figure per month, or a switch's cost, scales with the window).
 * The EXACT key is the adapter's parameters as they are: the closing step is priced on it, and re-plans when needed.
 */
const planKeys = (ctx, spec) => {
  const p = adapterParams(spec, { today: ctx.today, categories: categoriesFor(ctx).categories });
  const { from: _f, to: _t, ...loose } = p;
  return { exact: sha(p), loose: sha(loose) };
};
/** The interview's context: the draft's spec, what is answered, and the plan and preview snapshot when they exist. */
function interviewContext(ctx, slug, { draft }) {
  const spec = draft.spec;
  const state = interviewState(ctx, slug);
  const keys = planKeys(ctx, spec);
  const planRun = state.plan?.run ? join(ctx.wsDir, ".gs-superadmin", "tmp", "engagement", state.plan.run) : null;
  const planThere = planRun && existsSync(join(planRun, "plan.json"));
  const exact = planThere && state.plan.hash === keys.exact;
  const plan = planThere && (exact || state.plan.loose === keys.loose) ? readJsonFile(join(planRun, "plan.json")) : null;
  const previewPath = state.preview?.snapshot && existsSync(state.preview.snapshot) ? state.preview.snapshot : null;
  // An EDIT of a saved dashboard (F-516): what the draft changes against the saved spec and what that costs, from the
  // same table `change` reads; the closing step says it and its first option does it. Computed once, by the first
  // reader that asks (it reads the saved spec and the last plan's run directories).
  const savedRaw = ctx.store.readSaved(slug);
  let edit;
  // The preview snapshot is megabytes on a real tenant: parsed once, and only by a reader that asks for it.
  let preview;
  return {
    spec, answered: draft.answered, plan, planExact: exact ? plan : null, planRun, previewPath, fastPath: !!state.fastPath, kb: basename(ctx.kbDir), today: ctx.today,
    get edit() { return savedRaw ? (edit ??= (() => { const saved = openSpec(savedRaw); const lp = lastPlan(ctx, slug); const cost = changeCost(saved, spec, { longestPeriodDays: lp?.estimate?.health?.lookback?.longestPeriodDays ?? null }); return { saved, ...cost, ...(cost.consequence === "reselect" ? { reselect: { ...reselectReadiness(ctx, slug), line: refreshRemedy(ctx, slug) } } : {}) }; })()) : null; },
    get hasSnapshot() { return !!latestSnapshotPath(ctx, slug); },
    get preview() { return previewPath ? (preview ??= openSnapshotFile(previewPath)) : null; },
    params: adapterParams(spec, { today: ctx.today }), programs: plan ? readJsonOr(join(planRun, "programs.json"), []) : [],
    suggestionFile: join(dirOf(ctx, slug), SUGGESTION_FILE),
    lookupCompany: (name) => lookupCompany(ctx, spec, name),
    readLogoFile: (file) => readLogoFile(ctx, file),
  };
}
/** The plan for the interview (cheap calls only), kept until the pull-affecting answers move; writes the programs list and the group-suggestion input. */
function ensurePlan(ctx, slug, ictx, { exact = false } = {}) {
  if (exact ? ictx.planExact : ictx.plan) return ictx;
  const spec = ictx.spec;
  preflight(ctx, spec);
  const runId = stableRunId(ctx, spec, "plan");
  const r = runAdapter(ctx, { spec, runId, phase: "plan", previousPath: null });
  if (r.summary.status !== "ok") refuse(`the plan did not finish: ${r.summary.stopped ?? r.summary.status} — ${r.summary.status === "token-expired" ? `run gs-admin login, then ask for the next question again: \`${entryLine(ctx, "next", slug)}\`` : `ask for the next question again (\`${entryLine(ctx, "next", slug)}\`); if it fails again, the failed list is in the run directory`}`, r.summary.status === "token-expired" ? "token-expired" : "partial", remedyOf(entryLine(ctx, "next", slug), r.summary.status === "token-expired"));
  // The program list and the sends per program, from the plan's own reads: what the grouping proposal is made from.
  // The traits are the ones the rules resolve over at the pull (F-515 b): the same schedule reading and the same
  // months-with-sends rule the reducer applies, so the proposal's counts are the page's.
  const run = loadRunLightly(r.runDir, r.params.today);
  const programs = run.programs;
  const traits = programTraitsOf(programs, {}, run.monthsWithSends);
  const table = suggestionTable({ traits, sent: run.sent, tenantHost: spec.tenantHost, pulledAt: null, window: { from: r.params.window.from, to: r.params.window.to } });
  writeJson(join(r.runDir, "programs.json"), programs);
  mkdirSync(dirOf(ctx, slug), { recursive: true });
  writeJson(join(dirOf(ctx, slug), SUGGESTION_FILE), table);
  const keys = planKeys(ctx, spec);
  saveInterviewState(ctx, slug, { ...interviewState(ctx, slug), plan: { run: runId, hash: keys.exact, loose: keys.loose, at: new Date(ctx.nowMs).toISOString() } });
  const plan = readJsonFile(join(r.runDir, "plan.json"));
  return { ...ictx, plan, planExact: plan, planRun: r.runDir, programs };
}
/**
 * The plan's program list, sends per program and months with sends per program, read from the run directory's payloads
 * through the adapter's own readers (no fact call). Each program's schedule is the ONE the reducer gives the program
 * dimension (`pickSchedule`: a one-run window reads one-time, F-502), so the traits the proposal is built from are the
 * traits the rules resolve over (F-515 b).
 */
function loadRunLightly(runDir, today) {
  const log = readFileSync(join(runDir, "fetch-log.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.status === "ok");
  const read = (r) => readJsonFile(join(runDir, r.file));
  const pages = log.filter((r) => r.family === "programs").sort((a, b) => a.page - b.page).map(read);
  const listed = [...pages.flatMap((pg) => pg?.data?.advancedOutreaches ?? [])];
  const kb = readJsonOr(join(runDir, "kb-steps.json"), null);
  const sent = new Map();
  const months = new Map();
  for (const r of log.filter((x) => x.family === "totals" && x.cls === "all")) {
    for (const row of read(r)) {
      const t = ROW_READERS.totals(row);
      if (t.programId == null || t.n == null) continue;
      sent.set(t.programId, (sent.get(t.programId) ?? 0) + t.n);
      if (t.n > 0 && t.month) (months.get(t.programId) ?? months.set(t.programId, new Set()).get(t.programId)).add(t.month);
    }
  }
  const rows = listed.filter((p) => sent.has(String(p.advancedOutreachId))).map((p) => {
    const st = p.advancedOutreachStatus;
    return { id: String(p.advancedOutreachId), name: p.advancedOutreachName ?? null, statuses: (Array.isArray(st) ? st : [st]).filter(Boolean), model: p.advancedOutreachModel ?? null, modelName: p.advancedOutreachModelName ?? null, audienceType: p.advancedOutreachType ?? null, folderId: p.folderId != null ? String(p.folderId) : null };
  });
  // A program with sends the list missed is described live by the plan and pulled (the reducer selects it): it is a
  // row of the proposal too, so the file's programs are the snapshot's (F-515).
  const known = new Set(rows.map((p) => p.id));
  for (const r of log.filter((x) => x.family === "describe" && !x.notFound)) {
    const d = describedProgram(read(r));
    if (d && d.id != null && sent.has(d.id) && !known.has(d.id)) { rows.push({ id: d.id, name: d.name, statuses: d.statuses, model: d.model, modelName: d.modelName, audienceType: d.audienceType, folderId: d.folderId }); known.add(d.id); }
  }
  // The plan's own selection (the selector applied: `--sent-since`, names; deleted programs out) is the set the rules
  // resolve over at the pull; a plan written before it recorded the set (none now) falls back to every program with sends.
  const selected = readJsonOr(join(runDir, "plan.json"), null)?.selectedIds ?? null;
  const programs = rows.filter((p) => !selected || selected.includes(p.id)).map((p) => ({ ...p, supergroup: null, group: null, schedule: pickSchedule(kb?.schedules?.[p.id] ?? null, today) })).sort((a, b) => cmpKey(a.id, b.id));
  return { programs, sent, monthsWithSends: Object.fromEntries([...months].map(([id, m]) => [id, m.size])) };
}
function lookupCompany(ctx, spec, name) {
  preflight(ctx, spec);
  // The adapter's one company search (ACC-1's account-lookup family): a name is looked up one way everywhere.
  const argv = rpRunArgv(buildQuery({ family: "account-lookup", by: "name", match: "EQ", value: name }), 50);
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
function verbNext(ctx, slug, { questionId = null } = {}) {
  const draft = ctx.store.readDraft(slug);
  if (!draft) refuse(ctx.store.readSaved(slug) ? `"${slug}" is saved; to change it use change, or start an edit with new ${slug}` : `no draft "${slug}" — start one with new ${slug}`);
  // Another holder's draft is refused here too (ruled 2026-10-05, DSH-1 item 8): startDraft claims it or refuses.
  ctx.store.startDraft(slug, { by: ctx.by, takeOver: ctx.takeOver });
  let ictx = interviewContext(ctx, slug, { draft: ctx.store.readDraft(slug) });
  if (questionId) {
    // One settled question again, with its options as they stand (the closing step's "go back"): nothing is changed.
    const q = questionById(questionId);
    if (q.kind === "preflight" || q.kind === "action") refuse(`"${q.id}" is not a question to go back to (${QUESTIONS.filter((x) => !["preflight", "action"].includes(x.kind)).map((x) => x.id).join(", ")})`);
    if (q.needsPlan) ictx = ensurePlan(ctx, slug, ictx);
    return { ok: true, mode: "next", slug, question: { id: q.id, ask: askText(q, ictx), kind: q.kind, judgment: q.judgment, path: q.path, options: q.options(ictx), ...(q.input ? { input: q.input(ictx) } : {}) }, again: true };
  }
  const skipped = [];
  const defaulted = [];
  let said = null;
  for (const q of QUESTIONS) {
    if (ictx.answered.includes(q.id)) continue;
    if (q.skip && q.skip(ictx)) { skipped.push(q.id); continue; }
    if (q.id === "tenant") {
      const who = preflight(ctx, ictx.spec);
      ctx.store.setDraft(slug, { answered: ["tenant"], by: ctx.by, takeOver: ctx.takeOver });
      ictx = { ...ictx, answered: [...ictx.answered, "tenant"] };
      said = q.say(who.host);
      ctx.log(`tenant ${who.host} confirmed; token valid for ${who.expiresInSeconds} s`);
      continue;
    }
    // The closing step is priced on the exact settings; every other question reads the one loose plan. An edit that
    // needs no pull (a rebuild, a re-selection, nothing changed) is not planned: there is no pull to price.
    const noPullEdit = ictx.edit && ictx.edit.consequence !== "pull";
    if (q.needsPlan && !(q.kind === "action" && noPullEdit)) ictx = ensurePlan(ctx, slug, ictx, { exact: q.kind === "action" });
    if (ictx.fastPath && q.kind !== "action") {
      // The fast path: this question's own default, through its own apply (F-512).
      applyAnswer(ctx, slug, q, defaultAnswer(q, ictx), ictx);
      defaulted.push(q.id);
      ictx = interviewContext(ctx, slug, { draft: ctx.store.readDraft(slug) });
      continue;
    }
    const done = ictx.answered.filter((id) => QUESTIONS.some((x) => x.id === id));
    // The closing step reads the login's remaining life now (a local token read), not the plan's reading from earlier.
    if (q.kind === "action") ictx = { ...ictx, tokenSecondsLeft: preflight(ctx, ictx.spec).expiresInSeconds };
    return {
      ok: true, mode: "next", slug, ...(said ? { said } : {}), ...(defaulted.length ? { defaulted } : {}),
      question: { id: q.id, ask: askText(q, ictx), kind: q.kind, judgment: q.judgment, path: q.path, options: q.options(ictx), ...(q.input ? { input: q.input(ictx) } : {}) },
      ...(q.kind === "action" ? { closing: { ask: CLOSING_ASK(ictx), options: CLOSING_OPTIONS(ictx) } } : {}),
      progress: { answered: done.length, skipped, remaining: QUESTIONS.filter((x) => !done.includes(x.id) && !skipped.includes(x.id)).length },
      ...(ictx.plan ? { estimate: { full: ictx.plan.estimate.full, thisRun: ictx.plan.estimate.thisRun, token: ictx.plan.estimate.token, programs: ictx.plan.programs } } : {}),
    };
  }
  return { ok: true, mode: "next", slug, ...(said ? { said } : {}), ...(defaulted.length ? { defaulted } : {}), question: null, progress: { answered: ictx.answered.length, skipped, remaining: 0 }, done: true, hint: `every question is answered: save ${slug}` };
}
/** One answer, as the interview and the fast path both apply it: validated, through the writer, the ask-once key marked. */
function applyAnswer(ctx, slug, q, value, ictx) {
  const choices = q.options(ictx);
  if (q.kind === "choice" && !choices.some((o) => o.id === String(value).trim()) && !choices.some((o) => o.id.includes("<") && String(value).trim().startsWith(o.id.split("<")[0].replace(/:$/, "")))) refuse(`"${printable(String(value), 40)}" is not one of the options: ${choices.map((o) => o.id).join(", ")}`);
  const r = q.apply(value, ictx);
  // A folder given for the leaders' copy is the MACHINE's: written to the workspace's publish targets, never the spec.
  const target = r.publishTarget ? writePublishTarget(ctx, r.publishTarget.name, r.publishTarget.folder) : null;
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
  return { set: sets.map(([p]) => p), notes: [...(r.notes ?? []), ...(d.notes ?? [])], ...(r.replaced ? { replaced: r.replaced } : {}), ...(target ? { publishTarget: target } : {}) };
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
  const r = applyAnswer(ctx, slug, q, value, ictx);
  return { ok: true, mode: "answer", slug, question: q.id, ...r, next: nextQuestionId(ctx, slug) };
}
function verbAction(ctx, slug, q, value, ictx) {
  const yes = String(value).trim().toLowerCase();
  const mark = (extra = {}) => { const d = ctx.store.setDraft(slug, { answered: [q.id], by: ctx.by, takeOver: ctx.takeOver }); return { ok: true, mode: "answer", slug, question: q.id, answered: d.answered, next: nextQuestionId(ctx, slug), ...extra }; };
  if (q.id === "dry-run") {
    if (yes !== "yes") return mark({ preview: null });
    const spec = ictx.spec;
    const lastPull = ictx.edit ? latestSnapshotPath(ctx, slug) : null;
    if (lastPull) {
      // An edit's preview: the draft's settings over the LAST PULL, no call (the review of 2026-10-12: a dry run that
      // pulls for an edit that needs no pull spends login minutes on nothing; a pull-cost edit still previews what the
      // last pull holds, said so).
      const pulled = openSnapshotFile(lastPull);
      const previewDir = join(dirOf(ctx, slug), PREVIEW_DIR);
      const { snapshot, resolution } = applyGroups(pulled, spec.groups);
      const pages = buildPages(ctx, { spec, snapshot, delta: null, outDir: previewDir });
      saveInterviewState(ctx, slug, { ...interviewState(ctx, slug), preview: { run: null, snapshot: lastPull, at: new Date(ctx.nowMs).toISOString() } });
      return mark({ preview: { snapshot: lastPull, fromLastPull: true, pages: pages.map((p) => ({ page: p.page, path: p.path, megabytes: p.megabytes, warning: p.warning })), pulledAt: snapshot.meta.pulledAt, programs: snapshot.dimensions.programs.length, ungrouped: resolution.line, calls: { made: 0, reused: 0 }, themed: !!spec.theme, note: ictx.edit.consequence === "pull" ? "built from the last pull: a setting that needs a new pull shows the data as last pulled" : null } });
    }
    preflight(ctx, spec);
    const runId = stableRunId(ctx, spec, "preview");
    const r = runAdapter(ctx, { spec, runId, phase: "all", previousPath: null, preview: true });
    if (r.summary.status !== "ok") refuse(`the dry run did not finish: ${r.summary.stopped ?? r.summary.status}; answer dry-run yes again to resume it: \`${entryLine(ctx, "answer", slug, "dry-run", "yes")}\``, r.summary.status === "token-expired" ? "token-expired" : "partial", remedyOf(entryLine(ctx, "answer", slug, "dry-run", "yes"), r.summary.status === "token-expired"));
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
    // An edit that needs no pull has no pull to price: confirmed as it stands (F-516).
    if (ictx.edit && ictx.edit.consequence !== "pull") return yes === "yes" ? mark({ confirmed: true, estimate: null, edit: { changed: ictx.edit.changed, consequence: ictx.edit.consequence } }) : { ok: true, mode: "answer", slug, question: q.id, confirmed: false, estimate: null, next: nextQuestionId(ctx, slug), hint: "answer the setting to change (next --question <id>), then estimate again" };
    const withPlan = ensurePlan(ctx, slug, ictx, { exact: true });
    if (yes !== "yes") return { ok: true, mode: "answer", slug, question: q.id, confirmed: false, estimate: withPlan.plan.estimate, next: nextQuestionId(ctx, slug), hint: "answer the setting to change, then estimate again" };
    // The login's remaining life as read NOW, and the logins a pull of this size takes (F-511 instance 25; F-513).
    const left = preflight(ctx, ictx.spec).expiresInSeconds;
    const full = withPlan.plan.estimate.full;
    return mark({ confirmed: true, estimate: { full, token: { expiresInSeconds: left, fits: full.seconds + 30 <= left, loginsNeeded: loginsFor(full.seconds) }, kb: withPlan.plan.estimate.kb, templates: withPlan.plan.estimate.templates } });
  }
  // save: the first refresh continues the closing step's plan (its cheap calls are not made again) when that plan was
  // made on the exact settings and the dashboard has no snapshot yet (the first sitting's note of 2026-10-12).
  const planRun = ictx.planExact && ictx.planRun && !latestSnapshotPath(ctx, slug) ? basename(ictx.planRun) : null;
  const edit = ictx.edit;
  const saved = verbSave(ctx, slug);
  if (yes !== "yes") return { ...saved, mode: "answer", question: q.id, refresh: null, done: null, hint: edit && edit.consequence !== "pull" ? (edit.consequence == null ? "nothing changed" : edit.consequence === "reselect" ? (edit.reselect?.rank ? `rebuild ${slug} when ready: it ranks the changed customer lists from the account store, with no pull` : `rebuild ${slug} shows the other changes when ready; the changed customer lists are ranked at the next refresh (\`${refreshRemedy(ctx, slug)}\`)`) : `rebuild ${slug} when ready`) : `refresh ${slug} when ready` };
  try {
    // An edit DOES its consequence (F-516): the pull, a re-selection of the lists, or a rebuild; nothing when nothing changed.
    if (edit) {
      const spec = savedSpec(ctx, slug);
      const done = edit.consequence == null ? { kind: "nothing", done: false, why: "nothing changed" } : doConsequence(ctx, slug, spec, edit.consequence);
      return { ...saved, mode: "answer", question: q.id, edit: { changed: edit.changed, consequence: edit.consequence }, done, refresh: done.kind === "refresh" ? done : null };
    }
    return { ...saved, mode: "answer", question: q.id, refresh: verbRefresh(ctx, slug, { full: false, healthOnly: false, planRun }) };
  } catch (e) {
    // The dashboard IS saved; only its first refresh stopped. The refusal says so and keeps its exit code.
    if (e instanceof DashboardRefusal) throw new DashboardRefusal(`the dashboard "${slug}" is saved; its ${edit ? "refresh" : "first refresh"} stopped: ${e.message}`, e.code, e.details);
    throw e;
  }
}
/** What a saved change needs, done: the pull, a re-selection of the customer lists from the account store, or a rebuild. */
function doConsequence(ctx, slug, spec, consequence) {
  if (consequence === "pull") return { kind: "refresh", ...verbRefresh(ctx, slug, { full: false, healthOnly: false }) };
  if (consequence === "reselect") return { kind: "reselect", ...reselectFromStore(ctx, slug, spec) };
  const files = snapshotFiles(ctx, slug);
  return files.length ? { kind: "rebuild", ...rebuildFrom(ctx, { spec, snapshotPath: files.at(-1), previousPath: files.at(-2) ?? null, outDir: dirOf(ctx, slug) }) } : { kind: "rebuild", done: false, why: `no snapshot yet: run \`${refreshRemedy(ctx, slug)}\`` };
}
/** The last plan this dashboard made (null until one exists): the minutes of a full refresh and the longest schedule period come from it. */
function lastPlan(ctx, slug) {
  const root = join(ctx.wsDir, ".gs-superadmin", "tmp", "engagement");
  const state = readJsonOr(join(dirOf(ctx, slug), STATE_FILE), null);
  // The plan of the run the LATEST SNAPSHOT was pulled from (its directory is the one whose run.json carries that pull
  // time), else a stopped run's, else the most recent run directory by its clock; never a dry run's (its preview
  // parameters price nothing a refresh does: the S5-V second sitting's "about 72 minutes" was read from one).
  // This dashboard's own runs, by the exact owner its name reads back to (F-535): never another dashboard whose slug
  // extends this one, never a dry run's or an account timeline's plan.
  const runs = pullRunDirs(ctx, slug);
  const latest = latestSnapshotPath(ctx, slug);
  // The run whose pull time IS the latest snapshot's (an exact key, as the re-selection matches it).
  const pulledAt = latest ? readJsonOr(latest, null)?.meta?.pulledAt ?? null : null;
  const pulledFrom = pulledAt ? runs.find((d) => readJsonOr(join(root, d, "run.json"), null)?.params?.pulledAt === pulledAt) ?? null : null;
  const byClock = runs.map((d) => ({ d, at: (() => { try { return statSync(join(root, d, "run.json")).mtimeMs; } catch { return 0; } })() })).sort((a, b) => b.at - a.at).map((x) => x.d);
  const plan = [pulledFrom, state?.run ?? null, ...byClock].filter(Boolean).map((d) => readJsonOr(join(root, d, "plan.json"), null)).find(Boolean);
  return plan ?? null;
}
function verbSave(ctx, slug) {
  const r = ctx.store.save(slug);
  rmSync(join(dirOf(ctx, slug), INTERVIEW_FILE), { force: true });
  // The manual-refresh statement in the admin's terms, for the skill's final report (F-511 instance 26).
  return { ok: true, mode: "save", slug, path: r.path, replaced: r.replaced, pages: r.pages, notes: r.notes, pullAgainLine: COPY_LINES.refresh(slug, basename(ctx.kbDir)), pullAgainText: HOW_TO_REFRESH_TEXT(slug, basename(ctx.kbDir)) };
}
function verbList(ctx) {
  const dashboards = ctx.store.listDashboards().map((d) => {
    const latest = d.saved ? latestSnapshotPath(ctx, d.slug) : null;
    // What the latest pull holds, in a line a reader can judge a question against (F-534): its time, window, selection and program count.
    const snap = latest ? readJsonOr(latest, null) : null;
    const holds = snap?.meta ? (({ pulledAt, window, selection }) => ({ pulledAt, window, selection, programs: snap.dimensions?.programs?.length ?? 0 }))(heldBy(snap, "all")) : null;
    return { ...d, lastPull: latest ? basename(latest).replace(/\.json$/, "") : null, holds, pages: d.saved ? d.pages.filter((p) => existsSync(join(dirOf(ctx, d.slug), pageFileName(p)))) : [] };
  });
  return { ok: true, mode: "list", tenantHost: ctx.store.tenantHost, kb: basename(ctx.kbDir), dashboards };
}
function verbStatus(ctx, slug) {
  const spec = savedSpec(ctx, slug);
  const latest = latestSnapshotPath(ctx, slug);
  const snapshot = latest ? openSnapshotFile(latest) : null;
  const pulledMs = snapshot ? Date.parse(snapshot.meta.pulledAt) : null;
  const ageDays = pulledMs != null ? Math.floor((ctx.nowMs - pulledMs) / 86400000) : null;
  const state = readJsonOr(join(dirOf(ctx, slug), STATE_FILE), null);
  // No "next due" and no staleness: refreshes are manual (ruled 2026-10-12), and the age says what the pages say.
  return {
    ok: true, mode: "status", slug, title: spec.title,
    lastPull: snapshot ? { pulledAt: snapshot.meta.pulledAt, ageDays, mode: snapshot.meta.refresh.mode, programs: snapshot.dimensions.programs.length, file: latest } : null,
    snapshots: snapshotFiles(ctx, slug).length, pages: spec.pages.map((p) => ({ page: p.id, file: join(dirOf(ctx, slug), pageFileName(p.id)), present: existsSync(join(dirOf(ctx, slug), pageFileName(p.id))) })),
    lock: lockState(ctx, slug), resumable: state ? { run: state.run, startedAt: state.startedAt, by: state.by } : null, draft: !!ctx.store.readDraft(slug),
  };
}
function verbRefresh(ctx, slug, { full, healthOnly, planRun = null }) {
  const spec = savedSpec(ctx, slug);
  const dir = dirOf(ctx, slug);
  // The tenant and the token, before any call, before the lock.
  const who = preflight(ctx, spec, { again: refreshRemedy(ctx, slug, { full, healthOnly }) });
  let state = readJsonOr(join(dir, STATE_FILE), null);
  const previousPath = latestSnapshotPath(ctx, slug);
  const runsRoot = join(ctx.wsDir, ".gs-superadmin", "tmp", "engagement");
  // A pending run whose PARAMETERS moved (a pull setting changed between the save and the pull: F-512, reopened
  // 2026-10-12) cannot be continued: it is abandoned here, by the adapter's own rule, and the pull is planned afresh.
  // Only a run started with the same settings is resumed.
  let abandoned = null;
  if (state) {
    const pendingRun = join(runsRoot, state.run);
    if (!existsSync(join(pendingRun, "run.json"))) { abandoned = { run: state.run, why: "its run directory is gone" }; }
    else {
      const { categories } = categoriesFor(ctx);
      const paramsOn = (today) => resolveParams(adapterParams(spec, { today, forceFull: !!state.full, healthOnly: !!state.healthOnly, categories }));
      const diff = runParamsMoved(pendingRun, { params: paramsOn(ctx.today), previousPath, todayGiven: ctx.todayGiven, reparams: paramsOn });
      if (diff.moved.length) abandoned = { run: state.run, why: `${diff.moved.join(", ")} moved since it started` };
    }
    if (abandoned) { ctx.log(`the pending refresh of "${slug}" (run ${state.run}) is abandoned: ${abandoned.why}; planning afresh`); rmSync(join(dir, STATE_FILE), { force: true }); state = null; }
  }
  // A refresh that stopped (token, a failed call) resumes its run: the same run id, the same previous snapshot.
  const resuming = state && state.previousPath === previousPath && state.full === full && state.healthOnly === healthOnly;
  // A stopped run is resumed with the flags it was started with, never silently abandoned for a new one.
  if (state && !resuming && state.previousPath === previousPath) {
    const again = refreshRemedy(ctx, slug, { full: !!state.full, healthOnly: !!state.healthOnly });
    refuse(`a stopped refresh of "${slug}" (run ${state.run}, started ${state.startedAt} by ${state.by}${state.full ? ", --full" : ""}${state.healthOnly ? ", --health-only" : ""}) is waiting to resume: run it again with the same flags, \`${again}\`, or remove ${join(dir, STATE_FILE)} to start over`, "failed", remedyOf(again, false));
  }
  // The interview's plan continues as this run (the save's first refresh): the run keeps the plan's own directory and
  // prepareRun resumes it, so the plan's cheap calls are reused instead of made again (nothing is renamed).
  const continuesPlan = planRun && !resuming && !previousPath && !full && !healthOnly && existsSync(join(runsRoot, planRun, "plan.json"));
  // A fresh run's name is stamped to the second; a directory of that name may already exist (a run abandoned or stopped
  // in the same second: CI's runner did it on 2026-10-12), and prepareRun would then refuse the "fresh" run as another
  // run's. A fresh name is one no directory holds.
  const runId = resuming ? state.run : continuesPlan ? planRun : freshName(runsRoot, `dash-${slug}-${snapshotStamp(new Date(ctx.nowMs).toISOString())}`);
  const lock = takeLock(ctx, slug, runId);
  const takenOver = lock.takenOver ? { lockTakenOver: { by: lock.takenOver.by ?? null, at: lock.takenOver.at ?? null } } : {};
  try {
    writeJson(join(dir, STATE_FILE), { run: runId, startedAt: new Date(ctx.nowMs).toISOString(), by: ctx.by, previousPath, full, healthOnly });
    // The plan, with the derived lookback. The pull is NOT held to the login (F-513, ruled 2026-10-12): it runs as far
    // as the token allows, the adapter stops it cleanly when the next call would outlast the token, and the next run
    // after a login continues it. What is said is how many logins a pull of this size takes.
    const planned = planWithLookback(ctx, { spec, runId, previousPath, forceFull: full, healthOnly });
    const stopped = (r, logins = null) => {
      const code = r.summary.status === "token-expired" ? "token-expired" : r.summary.status === "partial" ? "partial" : "failed";
      const made = r.summary.calls ? ` after ${plural(r.summary.calls.made, "call")} this run${r.summary.calls.reused ? ` (${r.summary.calls.reused} reused from before)` : ""}` : "";
      // The logins still needed, when known: none left means the next run only finishes (the reduce and the pages).
      const more = code !== "token-expired" || logins == null ? "" : logins === 0 ? " — every call is made: the next run finishes it" : ` — about ${plural(logins, "more login")} of an hour to finish`;
      // A partial stop says what failed and that the next run retries it (F-519): the family, the programs the call
      // named, the cause and the runs it has failed in; never an empty slot.
      const why = code === "partial" ? failedText(r.summary.failed) : r.summary.stopped ?? r.summary.status;
      const again = refreshRemedy(ctx, slug, { full, healthOnly });
      const next = code === "failed" ? "" : ` — ${code === "token-expired" ? "run gs-admin login, then " : ""}run \`${again}\` again: it ${code === "partial" ? "retries what failed and " : ""}continues where it stopped; the last good pages are untouched`;
      refuse(`the ${healthOnly ? "health-only " : ""}refresh stopped${made}: ${why}${next}${more}${lock.takenOver ? `; a stale lock held by ${lock.takenOver.by ?? "unknown"} since ${lock.takenOver.at} was taken over` : ""}`, code, { ...takenOver, ...(abandoned ? { abandoned } : {}), ...(code === "failed" ? {} : remedyOf(again, code === "token-expired")) });
    };
    if (planned.summary.status !== "ok") stopped(planned);
    const estimate = planned.summary.estimate;
    const redoc = kbSettings(spec).redocument;
    const redocSeconds = redoc.enabled ? Math.min(redoc.cap, (estimate.kb?.programs?.length ?? 0)) * 3 + Math.min(Math.max(0, redoc.cap - (estimate.kb?.programs?.length ?? 0)), estimate.templates?.planned ?? 0) * 3 : 0;
    // The price is THIS run's (F-518 a): a resumed run's remainder, the plan's units whose answers are not on disk
    // yet, never the whole plan; the share already made is what the resume reuses.
    const remaining = estimate.thisRun.remaining ?? estimate.thisRun;
    const needed = remaining.seconds + redocSeconds + 30;
    const planSeconds = estimate.thisRun.seconds + redocSeconds + 30;
    const budget = { neededSeconds: needed, planSeconds, continuing: !!resuming, loginSecondsLeft: who.expiresInSeconds, fitsThisLogin: needed <= who.expiresInSeconds, loginsNeeded: loginsFor(needed) };
    const beyond = `it will run as far as the login allows (about ${plural(budget.loginsNeeded, "login")} of an hour in all) and continue after the next login`;
    if (resuming) ctx.log(`continuing the refresh of "${slug}" (run ${runId}): about ${plural(minutesOf(needed), "minute")} of its ${plural(minutesOf(planSeconds), "minute")} remain, the calls already made are reused; the login has ${plural(minutesOf(who.expiresInSeconds), "minute")} left${budget.fitsThisLogin ? ", enough for it" : `: ${beyond}`}`);
    else if (!budget.fitsThisLogin) ctx.log(`the refresh needs about ${plural(minutesOf(needed), "minute")} and the login has ${plural(minutesOf(who.expiresInSeconds), "minute")} left: ${beyond}`);
    // Re-documentation first (the fetch then re-reads the moved knowledge base: the run's KB copy is stamped). A login
    // that dies under it is the same stop as one that dies under the pull: exit 3, resumable, "log in, then run again".
    const redocumented = redocument(ctx, { spec, estimate, runDir: planned.runDir });
    if (redocumented.aborted?.reason === "auth") {
      const again = refreshRemedy(ctx, slug, { full, healthOnly });
      refuse(`the refresh stopped during re-documentation (${plural(redocumented.calls, "describe")} made): the login expired — run gs-admin login, then run \`${again}\` again: it continues where it stopped; the last good pages are untouched${lock.takenOver ? `; a stale lock held by ${lock.takenOver.by ?? "unknown"} since ${lock.takenOver.at} was taken over` : ""}`, "token-expired", { ...takenOver, ...(abandoned ? { abandoned } : {}), redocumented, ...remedyOf(again, true) });
    }
    // The pull.
    const pulledRun = runAdapter(ctx, { spec, runId: basename(planned.runDir), phase: "all", previousPath, forceFull: full, healthOnly, lookbackDays: planned.lookbackDays });
    // What the stop says is still needed is the adapter's remainder over the records as they stand (F-518), priced the
    // way the resume's opening line is; never the plan's calls less this run's counts, which count unforeseen cuts.
    if (pulledRun.summary.status !== "ok") {
      // A stop before the adapter's plan point carries none: it made no planned unit yet, so the remainder the plan
      // priced just before is still the remainder (only the cheap preliminaries, never in the plan's units, were made).
      const left = pulledRun.summary.remaining ?? estimate.thisRun.remaining ?? null;
      stopped(pulledRun, left == null ? null : left.calls === 0 ? 0 : loginsFor(left.seconds));
    }
    const reduced = reduceWithStore(loadRun(pulledRun.runDir, { previous: pulledRun.previous, previousStore: pulledRun.previousStore, cliVersion: ctx.catalog.meta?.cliVersion ?? null, pluginVersion: ctx.pluginVersion }));
    const pulled = reduced.snapshot;
    const previous = pulledRun.previous;
    const { snapshot, resolution } = applyGroups(pulled, spec.groups, { previous });
    // The snapshot, then retention, then the pages (all or nothing), then the state is cleared.
    mkdirSync(join(dir, SNAPSHOTS_DIR), { recursive: true });
    // The same second-resolution stamp names the snapshot; a second pull stamped in the same second never overwrites the first.
    const snapshotPath = join(dir, SNAPSHOTS_DIR, `${freshName(join(dir, SNAPSHOTS_DIR), snapshotStamp(snapshot.meta.pulledAt), ".json")}.json`);
    // The account store beside it (F-548), written first; one store per dashboard, so the earlier ones go.
    const accountStore = writeSnapshotAndStore(snapshotPath, { snapshot, store: reduced.store });
    pruneStores(ctx, slug, accountStore);
    const pruned = pruneSnapshots(ctx, slug);
    const delta = computeDelta(spec, snapshot, previous);
    const pages = buildPages(ctx, { spec, snapshot, delta, outDir: dir });
    rmSync(join(dir, STATE_FILE), { force: true });
    // The leaders' copy, after the pages are written and the run is closed: a publish that fails is said, never undone.
    const published = publishLeaders(ctx, { spec, snapshot });
    return {
      ok: true, mode: "refresh", slug, status: "ok", run: basename(pulledRun.runDir), resumed: !!resuming, full, healthOnly, budget, ...(abandoned ? { abandoned } : {}),
      pull: { mode: snapshot.meta.refresh.mode, why: snapshot.meta.refresh.why, pulledAt: snapshot.meta.pulledAt, programs: snapshot.dimensions.programs.length, calls: pulledRun.summary.calls, reconciled: snapshot.reconciliation.ok, health: engine.healthAvailability(snapshot).pulled, accounts: engine.accountAvailability(snapshot).pulled, lookbackDays: planned.lookbackDays, lookbackDerivedFrom: planned.lookbackDerivedFrom ?? null },
      redocumented, snapshot: snapshotPath, accountStore, pruned, ungrouped: resolution.line, kbBehind: snapshot.honesty?.kb ?? null,
      delta: delta ? { previousPulledAt: delta.previousPulledAt, closedMonths: delta.closedMonths.length, programs: delta.programs, metrics: Object.fromEntries(Object.entries(delta.metrics).map(([k, v]) => [k, v.change])) } : null,
      pages: pages.map((p) => ({ page: p.page, path: p.path, megabytes: p.megabytes, warning: p.warning })),
      lockTakenOver: lock.takenOver ? { by: lock.takenOver.by, at: lock.takenOver.at } : null,
      caveats: snapshot.caveats.map((c) => c.id),
      publish: published,
    };
  } finally {
    lock.release();
  }
}
function verbRebuild(ctx, slug) {
  const spec = savedSpec(ctx, slug);
  const files = snapshotFiles(ctx, slug);
  if (!files.length) refuse(`no snapshot of "${slug}" yet — run \`${refreshRemedy(ctx, slug)}\` first`, "failed", remedyOf(refreshRemedy(ctx, slug), false));
  const r = rebuildFrom(ctx, { spec, snapshotPath: files.at(-1), previousPath: files.at(-2) ?? null, outDir: dirOf(ctx, slug) });
  return { ok: true, mode: "rebuild", slug, pulledAt: r.pulledAt, ungrouped: r.ungrouped, delta: r.delta, pages: r.pages.map((p) => ({ page: p.page, path: p.path, megabytes: p.megabytes, warning: p.warning })), publish: r.publish };
}
/**
 * Whether a change of the customer lists can rank them now (F-548, which replaced F-529's narrow path): from the account
 * store beside the latest snapshot, with no pull. Not when there is no pull yet, when the latest pull holds no accounts,
 * or when the latest snapshot has no store of its own (made before the store, or its store gone): then the next refresh
 * is the one full pull that starts the store, and the change says so with its line. The store itself is not returned
 * (it is megabytes; rebuildFrom reads it), so this can ride an edit's context.
 * @returns {{rank: boolean, why: ?string, latest: ?string}}
 */
function reselectReadiness(ctx, slug) {
  const latest = latestSnapshotPath(ctx, slug);
  if (!latest) return { rank: false, latest: null, why: "the dashboard has no pull yet: its first refresh ranks the lists" };
  const snapshot = openSnapshotFile(latest);
  if (!engine.accountAvailability(snapshot).pulled) return { rank: false, latest, why: `the latest pull (${snapshot.meta.pulledAt}) holds no accounts: the lists are ranked by the first pull with customer lists on` };
  if (accountStoreFits(readAccountStore(accountStorePath(latest)), snapshot)) return { rank: true, latest, why: null };
  return {
    rank: false, latest,
    why: snapshot.meta.accountStore
      ? `the account store beside the latest snapshot (${snapshot.meta.pulledAt}) is missing or is not that snapshot's, so the customer lists need one full pull to rank again, and the next refresh is that pull`
      : `the latest snapshot (${snapshot.meta.pulledAt}) was made before the account store: the customer lists need one full pull to start ranking on every refresh, and the next refresh is that pull`,
  };
}
/** What a list change does, said before it runs (`change`'s consequenceText, the edit's closing ask and its option). */
const reselectText = (r, line) => (r.rank ? "the customer lists are ranked again from the account store beside the last pull (a rebuild, no pull)" : `the pages are rebuilt with no pull, and the changed customer lists are ranked at the next refresh (\`${line}\`): ${r.why}`);
/**
 * A change of the customer lists, done (ruled 2026-10-05; F-548): the pages are rebuilt, and rebuildFrom ranks the
 * changed lists from the account store with no pull. With no store of the latest snapshot's own, the lists wait for the
 * next refresh (the one full pull that starts the store), said with its line and minutes, and every other changed
 * setting of the same change still lands. `done` is true only when the lists were ranked.
 */
function reselectFromStore(ctx, slug, spec) {
  const r = reselectReadiness(ctx, slug);
  const files = snapshotFiles(ctx, slug);
  const rebuilt = files.length ? rebuildFrom(ctx, { spec, snapshotPath: files.at(-1), previousPath: files.at(-2) ?? null, outDir: dirOf(ctx, slug) }) : null;
  const pages = rebuilt ? { pages: rebuilt.pages.map((p) => ({ page: p.page, path: p.path })), publish: rebuilt.publish } : {};
  if (!r.rank) {
    const line = refreshRemedy(ctx, slug);
    const plan = lastPlan(ctx, slug);
    const fullMinutes = plan?.estimate?.full?.seconds != null ? minutesOf(plan.estimate.full.seconds) : null;
    return {
      done: false, ranked: false, rebuilt: !!rebuilt, why: r.why, fullRefreshMinutes: fullMinutes,
      text: `The change is saved. The customer lists were not ranked again: ${r.why}. They are ranked at the next refresh (a full pull this once, ${fullMinutes != null ? `about ${plural(fullMinutes, "minute")}` : "a full pull's time"}): \`${line}\`. ${rebuilt ? "The pages were rebuilt with the other changes." : "There are no pages to rebuild yet."}`,
      remedy: { login: false, line },
      ...pages,
    };
  }
  const snapshot = openSnapshotFile(r.latest);
  const lists = snapshot.honesty?.accountSelection?.lists?.map((l) => ({ kind: l.kind, kept: l.kept.length, ...(l.per ? { per: l.per, segment: l.segment } : {}), ...(l.notRanked ? { notRanked: l.notRanked } : {}) })) ?? [];
  const unnamed = rebuilt?.listsRanked?.unnamed ?? 0;
  return {
    done: true, ranked: true, rebuilt: true, snapshot: r.latest, lists,
    text: `The change is saved and the customer lists were ranked again from the account store beside the last pull (${snapshot.meta.pulledAt}), with no pull; the pages were rebuilt.${unnamed ? ` ${plural(unnamed, "account")} new to the lists show${unnamed === 1 ? "s" : ""} its key until the next refresh reads ${unnamed === 1 ? "its name" : "their names"}.` : ""}`,
    ...pages,
  };
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
  // A value the pull would refuse (a window that has not started, F-537) is refused before anything is saved.
  try { adapterParams(d.draft.spec, { today: ctx.today }); } catch (e) { if (!had) ctx.store.discardDraft(slug); throw e; }
  const plan = lastPlan(ctx, slug);
  const { changed, consequence } = changeCost(saved, d.draft.spec, { longestPeriodDays: plan?.estimate?.health?.lookback?.longestPeriodDays ?? null });
  // The pull's minutes are priced for the spec AFTER the change (F-511 instance 24), from the last plan's parts.
  const seconds = pullSecondsAfter(plan, saved, d.draft.spec);
  const says = consequence == null ? "nothing changed" : consequence === "pull" ? `the next refresh pulls everything again, ${seconds != null ? `about ${plural(minutesOf(seconds), "minute")}${seconds > LOGIN_SECONDS ? ` (about ${plural(loginsFor(seconds), "login")} of an hour)` : ""}` : "a first pull's time (no plan yet)"}` : consequence === "reselect" ? reselectText(reselectReadiness(ctx, slug), refreshRemedy(ctx, slug)) : "rebuild only (no pull)";
  const summary = { ok: true, mode: "change", slug, by: started.by, draftHadEarlierChanges: had, changed, consequence, consequenceText: says, pullSeconds: consequence === "pull" ? seconds : null, costTable: COST_KINDS, dryRun };
  if (dryRun) {
    if (!had) ctx.store.discardDraft(slug);
    return { ...summary, saved: false, done: null };
  }
  if (!changed.length) { if (!had) ctx.store.discardDraft(slug); return { ...summary, saved: false, done: null }; }
  let savedNow;
  try {
    savedNow = ctx.store.save(slug);
  } catch (e) {
    // A save the writer refuses (another dashboard's publish file, F-532) leaves no draft this change started.
    if (!had) ctx.store.discardDraft(slug);
    if (e instanceof SpecRefusal) refuse(e.message);
    throw e;
  }
  const spec = openSpec(savedNow.spec);
  const done = doConsequence(ctx, slug, spec, consequence);
  return { ...summary, saved: true, previousCopy: `${savedNow.path}.previous`, done };
}
/**
 * A full pull's seconds for the spec AFTER a change, from the last plan made on the spec BEFORE it: the plan prices each
 * switch (customer lists, Health, step detail) whether it is on or off, so a flipped switch adds or removes its part,
 * and a rolling window's months scale the rest (the window ask says a first pull scales with the months). Null with no
 * plan. A change the plan cannot price this way (the programs, a fixed window) keeps the plan's figure.
 * @param {?*} plan the last plan's summary (plan.json)
 */
export function pullSecondsAfter(plan, before, after) {
  const e = plan?.estimate;
  if (!e?.full?.seconds) return null;
  let seconds = e.full.seconds;
  // The window's scale first, on the plan's own figure; then the flipped switches, each priced by the plan as it stands
  // (its addsSeconds is for the plan's window, never scaled).
  const wb = windowOf(src(before));
  const wa = windowOf(src(after));
  if (wb.kind === "rolling" && wa.kind === "rolling" && src(before).windowMonths !== src(after).windowMonths && src(before).windowMonths > 0) seconds = (seconds / src(before).windowMonths) * src(after).windowMonths;
  const flip = (part, was, now) => { if (!part || was === now) return; seconds += now ? (part.on ? 0 : part.addsSeconds) : -(part.on ? part.addsSeconds : 0); };
  flip(e.accounts, !!before.accounts.pull, !!after.accounts.pull);
  flip(e.health, healthPulled(before), healthPulled(after));
  flip(e.stepDetail, !!src(before).stepDetail, !!src(after).stepDetail);
  return Math.max(0, Math.round(seconds));
}
function verbReport(ctx, slug, opt, argv) {
  savedSpec(ctx, slug); // a saved dashboard, or the refusal naming the draft
  const latest = latestSnapshotPath(ctx, slug);
  if (!latest) refuse(`no snapshot of "${slug}" yet — run \`${refreshRemedy(ctx, slug)}\` first`, "failed", remedyOf(refreshRemedy(ctx, slug), false));
  const snapshot = openSnapshotFile(latest);
  const ageDays = Math.floor((ctx.nowMs - Date.parse(snapshot.meta.pulledAt)) / 86400000);
  const reportDir = join(dirOf(ctx, slug), REPORTS_DIR);
  let summary;
  try {
    summary = writeReport({ snapPath: latest, reportDir, kb: ctx.kbDir, csvDir: opt("--csv-dir") ?? null, scriptPath: join(here, "engagement-report.mjs"), opts: { byTemplate: argv.includes("--by-template"), excludeInternal: argv.includes("--exclude-internal"), includePaused: argv.includes("--include-paused"), all: argv.includes("--all") } });
  } catch (e) {
    if (e instanceof ReportRefusal) refuse(e.message);
    throw e;
  }
  // The snapshot's age and the minutes a pull would take: the skill says both and offers the pull (no cadence is read;
  // ruled 2026-10-12). The pull it offers is the ROUTINE refresh (F-534): priced from the last plan when that plan was a
  // routine (selective) one, its own run's figure; after only a full pull no routine refresh has been priced yet, so the
  // figure is null and the full pull's minutes ride beside it for the skill's wording.
  const plan = lastPlan(ctx, slug);
  const refreshSeconds = plan?.estimate?.mode === "selective" && plan.estimate.thisRun?.seconds != null ? plan.estimate.thisRun.seconds : null;
  const refreshMinutes = refreshSeconds != null ? minutesOf(refreshSeconds) : null;
  const fullRefreshMinutes = plan?.estimate?.full?.seconds != null ? minutesOf(plan.estimate.full.seconds) : null;
  return { ...summary, mode: "report", slug, snapshotAgeDays: ageDays, refreshMinutes, refreshSeconds, fullRefreshMinutes, held: heldBy(snapshot, summary.statusesShown) };
}
/**
 * What a dashboard's snapshot holds, for the question it is asked (F-534): the pull's selection and window in words and
 * every program it holds (id, name, statuses), each marked `shown` when the report's status filter shows it. The skill
 * checks the programs a question names against these: one not held is not on the dashboard (its selection or its
 * window left it out), one held but not shown is hidden by its status.
 * @param {*} snapshot @param {string[]|"all"} statusesShown
 */
function heldBy(snapshot, statusesShown) {
  // The snapshot's selector is the adapter's resolved one (engagement.mjs resolveParams): sentSince is {spec, date}.
  const sel = snapshot.meta.params?.selector ?? {};
  const selection = sel.names?.length || sel.ids?.length ? `the programs it names (${[...(sel.names ?? []), ...(sel.ids ?? [])].join(", ")})` : sel.sentSince ? `the programs that sent since ${sel.sentSince.date} (${sel.sentSince.spec}, counted back from the pull's day)` : "every program that sent in the window";
  return {
    pulledAt: snapshot.meta.pulledAt, window: { from: snapshot.meta.window.from, to: snapshot.meta.window.to }, selection,
    programs: snapshot.dimensions.programs.map((p) => ({ id: p.id, name: p.name ?? null, statuses: p.statuses ?? [], shown: statusesShown === "all" || !Array.isArray(statusesShown) || (p.statuses ?? []).some((x) => statusesShown.includes(x)) })),
  };
}
function verbExport(ctx, slug, opt, argv) {
  if (!opt("--out")) refuse("export needs --out <file>");
  const r = ctx.store.exportSpec(slug, opt("--out"));
  let snapshot = null;
  let accountStore = null;
  const latest = latestSnapshotPath(ctx, slug);
  if (argv.includes("--with-snapshot")) {
    if (!latest) refuse(`no snapshot of "${slug}" to export beside the spec — run \`${refreshRemedy(ctx, slug)}\` first, or export without --with-snapshot`, "failed", remedyOf(refreshRemedy(ctx, slug), false));
    snapshot = r.out.replace(/\.json$/i, "") + ".snapshot.json";
    copyFileSync(latest, snapshot);
    // The account store goes with its snapshot (F-548), beside it under the same rule, so the import ranks the customer
    // lists on its first refresh with no full pull.
    if (existsSync(accountStorePath(latest))) copyFileSync(accountStorePath(latest), (accountStore = accountStorePath(snapshot)));
  }
  const noStore = snapshot && !accountStore && engine.accountAvailability(openSnapshotFile(latest)).pulled;
  return { ok: true, mode: "export", slug, out: r.out, tenantHost: r.tenantHost, snapshot, accountStore, hint: snapshot ? `import --file <the export> --snapshot <the snapshot> on the other machine${accountStore ? " (the account store beside the snapshot goes with it)" : ""}: its first refresh is then ${noStore ? "a full pull, since the snapshot has no account store beside it to rank the customer lists from" : "selective, with a delta"}` : null };
}
function verbImport(ctx, opt, argv) {
  if (!opt("--file")) refuse("import needs --file <export>");
  const sibling = resolve(opt("--file")).replace(/\.json$/i, "") + ".snapshot.json";
  const snapPath = opt("--snapshot") ? resolve(opt("--snapshot")) : existsSync(sibling) ? sibling : null;
  // The snapshot is opened and its tenant checked BEFORE the spec is written (F-540): a refused snapshot leaves nothing
  // written, a spec replaced under --replace included.
  let pulled = null;
  const checkSnapshot = (spec) => {
    if (!snapPath) return;
    try { pulled = openSnapshotFile(snapPath); } catch (e) { refuse(`the snapshot ${snapPath} cannot be read (${e instanceof Error ? e.message : e}) — nothing was imported`); }
    if (pulled.meta.tenantHost !== spec.tenantHost) refuse(`the snapshot was pulled from ${pulled.meta.tenantHost}, and the dashboard belongs to ${spec.tenantHost} — nothing was imported`);
  };
  const r = ctx.store.importSpec({ file: opt("--file"), slug: opt("--slug") ?? null, replace: argv.includes("--replace"), beforeWrite: checkSnapshot });
  let snapshot = null;
  let accountStore = null;
  if (snapPath && pulled) {
    mkdirSync(join(dirOf(ctx, r.slug), SNAPSHOTS_DIR), { recursive: true });
    snapshot = join(dirOf(ctx, r.slug), SNAPSHOTS_DIR, `${freshName(join(dirOf(ctx, r.slug), SNAPSHOTS_DIR), snapshotStamp(pulled.meta.pulledAt), ".json")}.json`);
    copyFileSync(snapPath, snapshot);
    // Its account store, when one is beside it (F-548): the first refresh then carries every account's older months.
    if (existsSync(accountStorePath(snapPath))) copyFileSync(accountStorePath(snapPath), (accountStore = accountStorePath(snapshot)));
  }
  return { ok: true, mode: "import", slug: r.slug, path: r.path, snapshot, accountStore, exportedAt: r.exportedAt, ...(r.publishRenamed ? { publishRenamed: { ...r.publishRenamed, text: `The leaders' copy of "${r.slug}" goes to ${r.publishRenamed.to}, not ${r.publishRenamed.from}: ${r.publishRenamed.why}.` } } : {}) };
}
function verbHealth(ctx, slug, opt) {
  const programId = opt("--program");
  if (!programId) refuse("health needs --program <id>");
  savedSpec(ctx, slug);
  const latest = latestSnapshotPath(ctx, slug);
  if (!latest) refuse(`no snapshot of "${slug}" yet — run \`${refreshRemedy(ctx, slug)}\` first`, "failed", remedyOf(refreshRemedy(ctx, slug), false));
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

/**
 * An account's timeline (ACC-2): one account's emails by program and day, pulled on demand (a static page cannot
 * pull), reduced, and built into a page of its own. With a dashboard named, the dashboard's recipient classes and
 * company fields decide the pull, its latest snapshot is what the timeline is reconciled against, its look is the
 * page's, and the files sit beside its pages; without one, the flags decide and the files go to reports-adhoc. The
 * tenant is checked before any call; the pull is the adapter's, one call at a time, resumable after a login. A name
 * that matches several accounts, or none exactly, is a pick list (exit 6): nothing is pulled and nothing guessed.
 */
function verbAccount(ctx, slug, opt, argv) {
  const spec = slug ? savedSpec(ctx, slug) : null;
  const given = ["--internal-domain", "--test-account", "--account-field"].filter((f) => argv.includes(f));
  if (spec && given.length) refuse(`${given.join(", ")}: the dashboard "${slug}" decides who is internal and which company fields are read; leave the flags out, or name no dashboard`);
  if (spec) preflight(ctx, spec);
  else {
    let host = null;
    try { host = new URL(ctx.identity?.baseUrl).host.toLowerCase(); } catch { /* no tenant recorded: refused below */ }
    if (!host) refuse(`the knowledge base ${basename(ctx.kbDir)} records no tenant (its manifest has no baseUrl) — run /gs-superadmin:setup`);
    preflight(ctx, { tenantHost: host }, { owner: `the knowledge base ${basename(ctx.kbDir)}` });
  }
  const all = (name) => argv.flatMap((t, i) => (t === name && argv[i + 1] !== undefined ? [argv[i + 1]] : []));
  const raw = (today) => ({
    today, account: { id: opt("--account-id") ?? null, name: opt("--account-name") ?? null }, last: opt("--last"),
    internalDomains: spec ? src(spec).internalDomains : all("--internal-domain"), testAccounts: spec ? src(spec).testAccounts : all("--test-account"),
    fields: spec ? accountFields(spec) : all("--account-field"),
  });
  let params;
  try { params = resolveAccountParams(raw(ctx.today)); } catch (e) { refuse(e instanceof Error ? e.message : String(e)); }
  // The same line run again (after a login) continues the same run; another account, lookback or day is a new one.
  const runId = `${slug ? `dash-${slug}` : "adhoc"}-account-${sha({ account: params.account, last: params.lastSpec, internalDomains: params.internalDomains, testAccounts: params.testAccounts, fields: params.fields, today: params.today })}`;
  const prepared = prepareRun({ wsDir: ctx.wsDir, runId, params, previousPath: null, cliVersion: ctx.catalog.meta?.cliVersion ?? null, todayGiven: ctx.todayGiven, reparams: (today) => resolveAccountParams(raw(today)) });
  const summary = fetchEngagement({ params: prepared.params, runDir: prepared.runDir, kbDir: ctx.kbDir, phase: "all", transport: ctx.live(), gate: ctx.gate, onCall: (line) => ctx.log(`account ${line}`) });
  if (summary.status === "token-expired") refuse(`the login ran out before the pull did (${summary.stopped ?? "the token expired"}): run gs-admin login, then run the same line again; it continues where it stopped`, "token-expired", { calls: summary.calls });
  if (summary.status !== "ok") refuse(`${failedText(summary.failed)}: run the same line again; it retries the call and continues`, "partial", { calls: summary.calls, failed: summary.failed });
  const said = accountResolutionText(summary.resolution);
  if (said) refuse(said, "needs-pick", { resolution: summary.resolution });
  const againstPath = spec ? latestSnapshotPath(ctx, slug) : null;
  const timeline = reduceAccountTimeline(loadAccountRun(prepared.runDir, { against: againstPath ? openSnapshotFile(againstPath) : null, cliVersion: ctx.catalog.meta?.cliVersion ?? null, pluginVersion: ctx.pluginVersion }));
  const outDir = spec ? join(dirOf(ctx, slug), ACCOUNTS_DIR) : join(ctx.kbDir, "reports-adhoc");
  mkdirSync(outDir, { recursive: true });
  const built = buildTimelinePage({ timeline, ...inlinedSources(), slug: slug ?? null, kb: basename(ctx.kbDir), theme: spec?.theme ?? null });
  const page = join(outDir, built.report.file);
  const file = join(outDir, built.report.file.replace(/[.]html$/, ".json"));
  writeFileAtomicSync(file, JSON.stringify(timeline));
  writeFileAtomicSync(page, built.html);
  if (built.report.warning) ctx.log(`account timeline page: ${built.report.warning}`);
  return { ...timelineSummary(timeline, file), mode: "account", slug: slug ?? null, page, megabytes: built.report.megabytes, againstSnapshot: againstPath ? basename(againstPath) : null, calls: summary.calls };
}

// ── CLI ──────────────────────────────────────────────────────────────────────
const USAGE =
  "usage: dashboard.mjs <new|next|answer|change|save|list|status|refresh|rebuild|publish|publish-target|report|export|import|health|account|native-plan|native-record|native-verify|costs|questions> [<slug>] [...] " +
  "[native-plan: [--test-prefix] [--no-schema]] [native-record: --panel <page id>/<panel id>] [native-verify: [--panel <page id>/<panel id>]] " +
  "[publish-target: [<target name> <folder>]] " +
  "[account: (--account-id <GSID> | --account-name <name>) [--last <Nd|Nm>] (with no <slug>: [--internal-domain <d>]... [--test-account <id>]... [--account-field <f>]...)] " +
  "[--kb <tenant KB folder>] [--workspace <dir>] [--bin <gs-admin entry>] [--by <holder>] [--take-over] [--today YYYY-MM-DD] [next: --question <id>]";
const VERBS = ["new", "next", "answer", "change", "save", "list", "status", "refresh", "rebuild", "publish", "publish-target", "report", "export", "import", "health", "account", "native-plan", "native-record", "native-verify", "costs", "questions"];
async function main() {
  const [verb, ...rest] = process.argv.slice(2);
  const helpers = makeCliHelpers("dashboard.mjs", rest);
  const { opt, finish } = helpers;
  /** @type {import("./doc-lib.mjs").FailFn} */
  const fail = helpers.fail;
  if (!VERBS.includes(verb)) fail(USAGE);
  if (verb === "costs") await finish({ ok: true, mode: "costs", kinds: COST_KINDS, costs: COSTS, adapterMapping: ADAPTER_MAPPING });
  if (verb === "questions") {
    // The table for a reader: the asks and options as the interview words them, with the ruled placeholder letters
    // where a figure comes from the plan (N, M, D, T), over a spec of the defaults; the closing step beside its rows.
    const rctx = { spec: defaultSpec({ slug: "<slug>", tenantHost: "<tenant>" }), plan: null, answered: [], programs: [], params: null };
    await finish({
      ok: true, mode: "questions",
      questions: QUESTIONS.map((q) => ({ id: q.id, kind: q.kind, judgment: q.judgment, path: q.path, ask: askText(q, rctx), options: q.options(rctx), ...(q.default !== undefined ? { default: typeof q.default === "function" ? "(from the plan)" : q.default } : {}), needsPlan: !!q.needsPlan, hasSkipRule: !!q.skip })),
      closing: { rows: QUESTIONS.filter((q) => q.kind === "action").map((q) => q.id), ask: CLOSING_ASK(rctx), options: CLOSING_OPTIONS(rctx) },
    });
  }
  const positional = rest.filter((t, i) => !t.startsWith("--") && !(i > 0 && rest[i - 1].startsWith("--") && !["--fast-path", "--take-over", "--dry-run", "--full", "--health-only", "--with-snapshot", "--replace", "--by-template", "--exclude-internal", "--include-paused", "--all", "--test-prefix", "--no-schema"].includes(rest[i - 1])));
  try {
    const ctx = openContext(rest, opt);
    const slug = positional[0];
    const needSlug = () => { if (!slug) refuse(`${verb} needs <slug> — ${USAGE}`); return slug; };
    let out;
    switch (verb) {
      case "new": out = verbNew(ctx, needSlug(), opt, rest); break;
      case "next": out = verbNext(ctx, needSlug(), { questionId: opt("--question") ?? null }); break;
      case "answer": { needSlug(); if (!positional[1]) refuse(`answer needs <slug> <question id> <value>`); out = verbAnswer(ctx, slug, positional[1], positional.slice(2).join(" ")); break; }
      case "change": out = verbChange(ctx, needSlug(), positional.slice(1), rest.includes("--dry-run")); break;
      case "save": out = verbSave(ctx, needSlug()); break;
      case "list": out = verbList(ctx); break;
      case "status": out = verbStatus(ctx, needSlug()); break;
      case "refresh": out = verbRefresh(ctx, needSlug(), { full: rest.includes("--full"), healthOnly: rest.includes("--health-only") }); break;
      case "rebuild": out = verbRebuild(ctx, needSlug()); break;
      case "publish": out = verbPublish(ctx, needSlug()); break;
      case "publish-target": out = verbPublishTarget(ctx, positional); break;
      case "report": out = verbReport(ctx, needSlug(), opt, rest); break;
      case "export": out = verbExport(ctx, needSlug(), opt, rest); break;
      case "import": out = verbImport(ctx, opt, rest); break;
      case "health": out = verbHealth(ctx, needSlug(), opt); break;
      case "account": out = verbAccount(ctx, slug ?? null, opt, rest); break;
      case "native-plan": out = verbNativePlan(ctx, needSlug(), rest); break;
      case "native-record": out = verbNativeRecord(ctx, needSlug(), opt); break;
      case "native-verify": out = verbNativeVerify(ctx, needSlug(), opt); break;
      default: fail(USAGE);
    }
    await finish(out);
  } catch (e) {
    if (e instanceof DashboardRefusal) await finish({ ok: false, mode: verb, status: e.code, error: e.message, ...e.details }, EXIT[e.code] ?? EXIT.failed);
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
