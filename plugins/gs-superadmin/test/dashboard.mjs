#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// dashboard.mjs (test) — fixtures for scripts/dashboard.mjs (PUB-1, DSH-3,
// UX-2): the one entry command, driven as a real process over a throwaway
// workspace of the fictional acme tenant with the stand-in CLI behind --bin.
//
// The scripted walk: new → next / answer through every question in the ruled
// order (the tenant statement first, the placeholder options through their
// follow-ups, the closing step) → save with the first refresh → pages; a
// display change → rebuild with no call; a list change → re-selection over
// the last run directory; a pull change → refresh; the health-only refresh;
// the lock (held, stale, a takeover recorded on a budget refusal); the
// wrong-tenant refusal before any call; the expired token leaving the
// previous pages byte-identical and the run resumable; re-documentation of
// a stale and a never-documented program and of the templates the KB lacks;
// the draft take-over refusal; export with the snapshot, then import on a
// second workspace; the fast path equal to answering every question with its
// default (F-512); the R15 polish arms — re-documentation's doc_path spelled
// workspace-relative like its neighbours, judged against the skill's hand-run
// describe-batch line (F-556); a lock the release could not remove said on the
// summary and on a refusal, measured on Windows through the fake CLI's
// deny-delete hook and as the clean path elsewhere (F-557); the six verbs that
// need a snapshot reading the lock before refusing for want of one, under a
// live and a dead holder, held to the script's own census of sites (F-558).
//
// The tables are held to their sources: every setting the spec writer
// describes has exactly one cost, the page's LACKS rows agree with it, and
// every ask is the wording Bradley ruled (F-511, 2026-10-12), with the plan's
// figures where the ruling put them.
//
// Run:  node plugins/gs-superadmin/test/dashboard.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, rmSync, renameSync } from "node:fs";
import { join, dirname, resolve, isAbsolute, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { makeTempDir, removeTempDir, writeFiles, runNode } from "../../../test/rig.mjs";
import { COSTS, COST_KINDS, ADAPTER_MAPPING, QUESTIONS, CLOSING_ASK, CLOSING_OPTIONS, askText, defaultAnswer, composeAnswer, defaultGroupRules, categoryCostText, changeCost, changeValue, coveredPath, computeDelta, adapterParams, pullSecondsAfter, loginsFor, LOGIN_SECONDS, EXIT, KEEP_SNAPSHOTS, LOCK_STALE_MS, LOCK_FILE, STATE_FILE, PACE_FILE, SNAPSHOTS_DIR, PREVIEW_DIR, SUGGESTION_FILE, ACCOUNTS_DIR, PUBLISH_TARGETS_FILE, PUBLISH_DIR, NATIVE_READ_PATHS, runOwner, closingSelection, kbFolderOf } from "../scripts/dashboard.mjs";
import { spawnSync } from "node:child_process";
import { resolveGroups, programTraits } from "../scripts/dashboard-groups.mjs";
import { SPEC_DESCRIPTIONS, defaultSpec, openSpec, DEFAULT_ACCOUNT_LISTS, presetPanels } from "../scripts/dashboard-spec.mjs";
import { HOW_TO_REFRESH_RULED } from "./fixtures/engagement/ruled-text.mjs";
import { LACKS, HOW_TO_REFRESH_TEXT, COPY_LINES } from "../scripts/dashboard-runtime.mjs";
import { openSnapshot, listPhrase } from "../scripts/engagement-query.mjs";
import { nativePlan, TEST_PREFIX } from "../scripts/dashboard-native.mjs";
import { makeGate, resolveParams, CALL_SECONDS, readPaceFiles, writePaceFile, KB_PACE_FILE, KB_PULL_LOCK_FILE, PACE_MEMORY_CALLS, repriceEstimate } from "../scripts/engagement.mjs";
import { kbFiles, OWN_SITE_UNSUBSCRIBE, TEMPLATES_DOMAIN, buildTenant, FIXTURE_BOUNCE_CATEGORIES } from "./fixtures/engagement/acme-tenant.mjs";
import { splitRedirect } from "./fixtures/engagement/shell-words.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "..", "scripts", "dashboard.mjs");
const FAKE = join(HERE, "fixtures", "engagement", "fake-gs-admin.mjs");
const GOLDEN = JSON.parse(readFileSync(join(HERE, "fixtures", "engagement", "snapshot-acme.json"), "utf8"));
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const TODAY = "2026-09-15";
const SLUG = "acme-health";

let failures = 0;
let total = 0;
/** Lifted before the rig is removed, however the suite ends: the icacls denies the lock arms lay (F-565's ride-along). */
let lateCleanup = () => {};
function check(label, cond, detail) {
  total++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log(`      ${JSON.stringify(detail)?.slice(0, 1600)}`);
  }
}

const ROOT = makeTempDir("gs-superadmin-dashboard");
const WS = join(ROOT, "ws");
const KB = join(WS, "acme-prod");
const WS2 = join(ROOT, "ws2");
const KB2 = join(WS2, "acme-prod");
const STATE = join(ROOT, "fake-state");
// A folder standing for a synced shared folder (PUB-3's file-copy target), outside the workspace.
const SHARE = join(ROOT, "leaders-share");
writeFiles(WS, { ".gs-superadmin/.keep": "", ...kbFiles("acme-prod", { cadence: true, signals: true }), "brand/logo.png": Buffer.from(PNG, "base64") });
writeFiles(WS2, { ".gs-superadmin/.keep": "", ...kbFiles("acme-prod", { cadence: true, signals: true }) });
mkdirSync(STATE, { recursive: true });
mkdirSync(SHARE, { recursive: true });
const TENANT = { cadence: true, signals: true };
const common = ["--workspace", WS, "--kb", KB, "--bin", FAKE, "--today", TODAY, "--by", "ana"];
const run = (verb, args = [], { env = {}, tenant = TENANT, flags = common } = {}) => {
  const r = runNode(SCRIPT, [verb, ...args, ...flags], { env: { ...process.env, FAKE_STATE: STATE, FAKE_TENANT: JSON.stringify(tenant), ...env } });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch { /* a stack trace path */ }
  // The class behind F-534's reopen: a structured value printed into words. Every verb's output this suite makes is read.
  for (const out of [r.stdout, r.stderr]) if (/\[object [A-Z]\w*\]/.test(out ?? "")) objectWords.push(`${verb}: ${out.match(/.{0,80}\[object [A-Z]\w*\].{0,40}/)?.[0]}`);
  return { code: r.status, json, stderr: r.stderr };
};
/** @type {string[]} */
const objectWords = [];
const dash = (slug = SLUG, kb = KB) => join(kb, "dashboards", slug);
const draftFile = (slug = SLUG, kb = KB) => join(dash(slug, kb), "spec.draft.json");
const specFile = (slug = SLUG, kb = KB) => join(dash(slug, kb), "spec.json");
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const argvLines = () => (existsSync(join(STATE, "argv.jsonl")) ? readFileSync(join(STATE, "argv.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).argv.join(" ")) : []);
// The snapshots, never the account store beside the latest (F-548: `<stamp>.accounts.json`), which stores() lists.
const snapshots = (slug = SLUG, kb = KB) => (existsSync(join(dash(slug, kb), SNAPSHOTS_DIR)) ? readdirSync(join(dash(slug, kb), SNAPSHOTS_DIR)).filter((f) => f.endsWith(".json") && !f.endsWith(".accounts.json")).sort() : []);
const stores = (slug = SLUG, kb = KB) => (existsSync(join(dash(slug, kb), SNAPSHOTS_DIR)) ? readdirSync(join(dash(slug, kb), SNAPSHOTS_DIR)).filter((f) => f.endsWith(".accounts.json")).sort() : []);
const pageText = (page, slug = SLUG, kb = KB) => readFileSync(join(dash(slug, kb), `latest-${page}.html`), "utf8");
const manifest = (kb = KB) => readJson(join(kb, "_manifest.json"));
const runDirs = () => (existsSync(join(WS, ".gs-superadmin", "tmp", "engagement")) ? readdirSync(join(WS, ".gs-superadmin", "tmp", "engagement")) : []);
const q = (id) => QUESTIONS.find((x) => x.id === id);
const option = (id, optionId, ctx = {}) => q(id).options(ctx).find((o) => o.id === optionId) ?? q(id).options(ctx).find((o) => o.id.startsWith(optionId));
const base = () => defaultSpec({ slug: "x", tenantHost: "acme.gainsightcloud.com" });

// The ruled wordings (JO-DASHBOARDS-HANDOFF-PLAN.md, DSH-3, "Rulings (Bradley, 2026-10-12, at S5-V's I0)"), verbatim, with the
// plan's figures where the ruling put a letter. One fixture plan prices them; the same figures are expected in the text.
const PLAN = {
  estimate: {
    full: { calls: 150, seconds: 1132 }, thisRun: { calls: 150, seconds: 1132 }, token: { fits: true, expiresInSeconds: 3000 },
    health: { on: true, addsCalls: 60, addsSeconds: 600, samples: { cap: 25, participantFailures: { withFailures: 40, beyondCap: 15, secondsBeyondCap: 45 }, bounceReasons: { withFailures: 60, beyondCap: 35, secondsBeyondCap: 105 } }, categoryCalls: { bounce: { categories: 56, classes: 6, calls: 336, seconds: 1008, secondsEach: 3 } } },
    accounts: { on: false, addsCalls: 264, addsSeconds: 1800 }, stepDetail: { on: false, addsCalls: 45, addsSeconds: 300 },
  },
};
const PLAN_CTX = { plan: PLAN, spec: base(), params: { from: "2025-09", to: "2026-09" }, answered: [], programs: [], tokenSecondsLeft: 3000 };
const RULED = {
  tenant: "This dashboard is for <tenant>, the CLI's active tenant, whose knowledge base it reads.",
  programs: "Which programs go on the dashboard? By default, every program that sent in the last 90 days. You can widen that to 180 days or a year, take every program that sent in the reporting period, start from a date, or name the programs. This chooses the programs; the next question chooses the months the pages cover.",
  // 1132 s over 13 months: 1.5 minutes a month; 13 months about 19 minutes; two years about 35 minutes.
  window: "Which months should the pages cover? By default the last 12 full months plus the current one, moving forward with each refresh. You can cover a set number of months instead, fix a start and end month that never move, or take everything from a start month up to now. On this tenant a first pull takes about 1.5 minutes for each month covered, so the default's 13 months is about 19 minutes and two years would be about 35 minutes. Later refreshes re-pull only recent months, so they are much shorter whatever you choose.",
  "internal-domains": "Which email domains are the company's own? Recipients on them are internal, and the pages can leave them out. List them, or say none. Each domain you list adds a few minutes to every refresh with Health on once this tenant has bounce categories (about 3 minutes per domain where this was measured).",
  "test-accounts": "Are there test accounts whose sends should count as internal? A test account is a company record in Gainsight (an \"Acme Test\" account whose contacts are employees' alternate addresses), not an email address. Name the accounts or give their company GSIDs, or say none; a name is looked up once, and if it matches more than one account you pick. Test accounts add a few minutes to every refresh with Health on once this tenant has bounce categories, a little more for each internal domain.",
  "unsubscribe-links": "Does the company use a page of its own, or an outside service, for unsubscribe links? Click rate counts clicks on content links only, so the unsubscribe link has to be told apart. Any link whose address contains \"unsubscribe\", \"opt-out\" or \"preferences\" is recognised on its own, which covers Gainsight's standard link; you only need to add a page whose address has none of those words, such as `https://www.acme.com/email-settings`. Give the link as it appears in the emails, or say none. Give the page, not the bare domain: `acme.com` alone would exclude every link to the company's site. Changing this later means the next refresh pulls everything again.",
  // 60 programs (the larger of the two parts); 45 + 105 s beyond the cap = about 3 minutes.
  "failure-settings": "Two health settings. How many days may a scheduled program run without admitting anyone before it is listed as \"Admitting nobody\"? The default is 5 days. Do you want to change that threshold? How many programs should each refresh read failure messages from? The refresh reads a page of the actual failure wordings from the programs with the most failures, so a new wording can be spotted and added to the categories; only programs whose failures changed since the last pull are read again. The default is 25 programs. On this tenant 60 programs have failures; reading all of them would add about 3 minutes to a first pull. Do you want to change that number?",
  look: "Do you have brand guidelines to apply to the pages? If not, the default look is used. You can name a guidelines file (markdown, JSON, CSS or a PDF) or paste the values. What a brand can change: the page colours, the chart colours, a system font stack (no web fonts, since the pages make no network request), the corner radius, and a logo from a local PNG or JPEG file. Layout, spacing and the status colours stay as they are. A colour that would not read is replaced by the default and shown with the reason, and the dry-run preview renders in the theme.",
  // Health adds 600 s = 10 minutes, 1008 s of it (17 minutes) for the categories; K4's quote follows.
  tabs: "Which tabs should the admin and leader pages carry? — Engagement and About are always on. — Health shows error rates, failure reasons, silent programs and schedules, and is on the admin page by default. Health adds about 10 minutes to each refresh on this tenant (about 17 minutes of that for the bounce categories); it is one pull shared by both pages, so turning it on for leaders as well costs no extra time, and only turning it off on both pages saves it. The 56 bounce categories in the workspace's category file cost 336 counted calls a refresh (56 × 6 recipient classes: all, each internal domain, the test accounts, and the test accounts on each domain; about 17 minutes). Turning Health on later means the next refresh pulls everything again. — Templates shows each email's performance, its text and a keyword search. On for the admin page only, by default. Templates adds no time to the pull. Do you want to change any of these?",
  // 1132 + 1800 s = about 49 minutes with the lists; about 19 without.
  "customer-lists": "Do you want this dashboard to tell you the top customers that aren't opening or are bouncing, or only how each program is doing? The customer lists are three lists across programs: the most engaged, the least engaged and the most bounced accounts, each account with its programs underneath, plus an in-page account view. Without them the dashboard still has every program, template and step figure, and how many accounts each program reached. Adding the lists makes the first pull about 49 minutes instead of about 19 minutes on a tenant this size. You can add them later by editing the dashboard and refreshing; that refresh pulls everything again. Looking a company up outside the page needs a gs-admin login, so a leader sees a customer only through the page's account view.",
  "leader-names": "May the leaders' page carry the customer lists, with account names? The leaders' page is the copy that travels: a shared folder, an attachment, a hosted page. With names off it holds program and template names, counts, rates and the About text, and no account rows. With names on it carries the customer lists as the admin page does, which is a question for whoever decides where customer names may be hosted. This adds no time to the refresh; the leaders' page simply keeps the rows the admin page already has. You can change this later with a rebuild, no pull. Default no.",
  "customer-list-detail": "How should the customer lists be built? Three lists are made across programs: the 25 most engaged, the 25 least engaged and the 25 most bounced accounts. Each needs at least 10 delivered emails across programs before an account can appear, so one unopened email is not a risk; on a program that sends about once per contact, the least-engaged list uses at least 3 delivered and no open instead. You can change the size and the floor of each list, and you can add \"per segment\" lists, which rank the same lists within each value of a company field you name, such as Industry or Segment. Do you want to change the defaults?",
  "step-detail": "Do you want step detail? By default the figures are per program and per email, read from the delivery log. Step detail reads a second log that records which step of a program and which A/B variant each send came from, so the pages also show rows per step and per variant, and the participant-records count. It is one switch for the whole dashboard. On this tenant it adds about 5 minutes to each refresh. Off by default; turning it on later means the next refresh pulls everything again.",
  "expected-reasons": "Are there participant-failure reasons that are expected by design on this tenant? Some reasons a participant is refused are a business rule doing its job. These six are recognised already and counted apart from real failures, never hidden: Already in the participant list; Unique criteria already met; Met the advanced criteria; Unsubscribed from a category; On the global opt-out; Opted out at the send step. If this tenant has a wording of its own that should count the same way, give the fixed part of its text. Most people say none here and add one later, when the Health tab's \"Other\" line shows it. Marking a reason expected changes only how it is labelled: a program that admits nobody for the due days you set earlier is still flagged as \"Admitting nobody\", whatever the reasons were.",
  // 150 calls, about 19 minutes, 3000 s of login = about 50 minutes. The manual-refresh statement is Bradley's ruled
  // wording of 2026-10-13 (F-511 instance 27), verbatim, as one paragraph; the kb folder reads <kb> with none known.
  closing: "Ready to save. A full refresh with these settings is about 150 calls and about 19 minutes on this tenant; your login has about 50 minutes left, enough for it. " + HOW_TO_REFRESH_RULED("x", null),
};
const RULED_OPTIONS = {
  programs: ["The last 90 days (the default)", "180 days", "The last year", "Every program that sent in the reporting period", "Since a date you give", "Named programs (names or ids, one per line)"],
  window: ["The last 12 full months plus this one, moving with each refresh (the default, about 19 minutes)", "The last N months, moving with each refresh", "A fixed start month and end month", "Everything from a start month up to now"],
  look: ["Skip: use the default look (the default)", "Name a guidelines file (markdown, JSON, CSS or a PDF)", "Paste the values"],
  "customer-lists": ["Only how each program is doing (the default)", "The customer lists too"],
  "leader-names": ["No, keep customer names off the leaders' page (the default)", "Yes"],
  "customer-list-detail": ["Keep the three lists as described (the default)", "Change a list's size or floor", "Add per-segment lists"],
  "step-detail": ["No step detail (the default)", "Add step detail (about 5 minutes per refresh)"],
  "expected-reasons": ["None (the default)", "Add a wording"],
  // The dry run leaves health out: 1132 - 600 s is about 9 minutes.
  closing: ["Save and run the first refresh now (about 19 minutes)", "Run a dry run first (a quick program-level pull, about 9 minutes, rendered as preview pages)", "Save only, refresh later", "Go back and change a setting"],
};

try {
  // ══ The tables, held to their sources ═════════════════════════════════════
  {
    const covers = SPEC_DESCRIPTIONS.flatMap((d) => d.covers);
    const missing = covers.filter((p) => !(p in COSTS));
    const extra = Object.keys(COSTS).filter((p) => !covers.includes(p));
    check("the cost table covers every setting the spec writer describes, exactly once, with one of the five kinds (a setting with no cost is refused by construction: the table is built from the descriptions)",
      missing.length === 0 && extra.length === 0 && Object.values(COSTS).every((k) => k in COST_KINDS) && new Set(Object.keys(COSTS)).size === covers.length, { missing, extra });
    check("the pull side of the cost table is DERIVED from the adapter mapping (ruled 2026-10-04): every mapped path costs a pull, every pull-cost path is mapped, and a display-only setting (a title, a page's tabs, the theme) is a rebuild",
      ADAPTER_MAPPING.every((m) => COSTS[m.path] === "pull") && Object.entries(COSTS).filter(([, k]) => k === "pull").every(([p]) => ADAPTER_MAPPING.some((m) => m.path === p)) && COSTS.title === "rebuild" && COSTS["pages[].tabs[].id"] === "rebuild" && COSTS["theme.font"] === "rebuild" && COSTS["accounts.lists[]"] === "reselect" && COSTS["health.silentDays"] === "pull" && COSTS.slug === "identity");
    const disagree = LACKS.filter((row) => row.setting).map((row) => [row.reason, row.setting.path, row.needs, COSTS[row.setting.path]]).filter(([, , needs, cost]) => !(needs === "by-data" ? ["pull", "rebuild"].includes(cost) : cost === "pull" ? needs === "pull" : cost === "rebuild" || cost === "in-page" ? needs === "rebuild" : false));
    check("the page's LACKS rows agree with the cost table (A-2: two homes, one judge): a row that needs a pull names a pull-cost setting, a rebuild row a rebuild-cost one; the tab row is decided by data (a pull only when the health pull moves, which changeCost refines)",
      disagree.length === 0 && (() => { const b = base(); const a = structuredClone(b); a.pages[1].tabs.find((t) => t.id === "templates").enabled = true; const h = structuredClone(b); h.pages[0].tabs.find((t) => t.id === "health").enabled = false; return changeCost(b, a).consequence === "rebuild" && changeCost(b, h).consequence === "pull"; })(), disagree);
    const ids = QUESTIONS.map((x) => x.id);
    check("the questions table, as ruled 2026-10-12 (F-511): the tenant statement, programs, window, grouping, the recipients three, the failure settings, the look, the tabs, the customer lists then the leaders' names then the lists' detail, step detail, the expected reasons, the three action rows of the closing step; ids unique; purpose, audiences, cadence and metrics gone; exactly two judgment nodes (grouping, look); every answerable question has an apply and a default",
      isDeepStrictEqual(ids, ["tenant", "programs", "window", "grouping", "internal-domains", "test-accounts", "unsubscribe-links", "failure-settings", "look", "tabs", "customer-lists", "leader-names", "customer-list-detail", "step-detail", "expected-reasons", "leaders-copy", "dry-run", "estimate", "save"]) &&
        isDeepStrictEqual(QUESTIONS.filter((x) => x.judgment).map((x) => x.id), ["grouping", "look"]) && QUESTIONS.every((x) => typeof x.options === "function" && typeof x.kind === "string") &&
        QUESTIONS.filter((x) => !["preflight", "action"].includes(x.kind)).every((x) => typeof x.apply === "function" && x.default !== undefined), ids);
    const asks = Object.fromEntries(QUESTIONS.map((x) => [x.id, askText(x, PLAN_CTX)]));
    const off = Object.entries(RULED).filter(([id, text]) => id !== "closing" && asks[id] !== text).map(([id]) => id);
    check("every ask is the ruled wording, verbatim, with the plan's figures where the ruling put a letter (the per-month rate and the 13-month and two-year totals on the window; the programs with failures and the minutes to read them all; Health's minutes and the categories' share, with K4's category-cost quote on the tabs question; the first pull with and without the customer lists; step detail's minutes); the tenant row is the statement",
      off.length === 0 && asks.tenant === RULED.tenant && q("tenant").say("acme.gainsightcloud.com") === "This dashboard is for acme.gainsightcloud.com, the CLI's active tenant, whose knowledge base it reads.", off.map((id) => [id, asks[id]]));
    const closingAsk = CLOSING_ASK(PLAN_CTX);
    const closingOptions = CLOSING_OPTIONS(PLAN_CTX);
    check("the closing step (ruling 19): one ask with the calls, the minutes and the login's remaining minutes, the manual-refresh statement and that the pages say when the data was pulled; four options (save and refresh now, a dry run first with its minutes, save only, go back), each standing for the action rows it answers; the three action rows carry the same ask; a short login says so; a dry run already made drops its option",
      closingAsk === RULED.closing && isDeepStrictEqual(closingOptions.map((o) => o.text), RULED_OPTIONS.closing) && isDeepStrictEqual(closingOptions.map((o) => o.id), ["save-now", "dry-run", "save-only", "go-back"]) &&
        isDeepStrictEqual(closingOptions[0].answers, [["dry-run", "no"], ["estimate", "yes"], ["save", "yes"]]) && isDeepStrictEqual(closingOptions[1].answers, [["dry-run", "yes"]]) && isDeepStrictEqual(closingOptions[2].answers, [["dry-run", "no"], ["estimate", "yes"], ["save", "later"]]) && isDeepStrictEqual(closingOptions[3].answers, []) &&
        QUESTIONS.filter((x) => x.kind === "action").every((x) => askText(x, PLAN_CTX) === RULED.closing) && /your login has about 5 minutes left, so the first refresh will take about 1 login of an hour: it runs as far as each login allows, stops, and continues when you log in and run it again/.test(CLOSING_ASK({ ...PLAN_CTX, tokenSecondsLeft: 300 })) &&
        // F-513: a pull longer than one login is said in logins, never refused; the kb folder rides the command when known.
        /about 2 logins of an hour/.test(CLOSING_ASK({ ...PLAN_CTX, tokenSecondsLeft: 300, plan: { estimate: { ...PLAN.estimate, full: { calls: 700, seconds: 4300 } } } })) && CLOSING_ASK({ ...PLAN_CTX, kb: "acme-prod" }).endsWith(` ${HOW_TO_REFRESH_RULED("x", "acme-prod")}`) &&
        isDeepStrictEqual(CLOSING_OPTIONS({ ...PLAN_CTX, answered: ["dry-run"] }).map((o) => o.id), ["save-now", "save-only", "go-back"]), [closingAsk, closingOptions]);
    // F-511 instance 27: the three places that carry the How to refresh statement read ONE data (the runtime's
    // HOW_TO_REFRESH): the closing ask and the save summary's text here, the About tab in the page suite.
    check("F-511 instance 27: the manual-refresh statement is the ruled wording of 2026-10-13 verbatim, as one paragraph, with the folder and the slug filled in (and the ruling's <kb> with no folder known); the closing ask ends with it",
      HOW_TO_REFRESH_TEXT("x", "acme-prod") === HOW_TO_REFRESH_RULED("x", "acme-prod") && HOW_TO_REFRESH_TEXT("x", null) === HOW_TO_REFRESH_RULED("x", null) && closingAsk.endsWith(` ${HOW_TO_REFRESH_RULED("x", null)}`), HOW_TO_REFRESH_TEXT("x", "acme-prod"));
    // F-518 b: an edit's forced re-pull carries the same login clause as a new dashboard's first refresh.
    const editPullAsk = CLOSING_ASK({ ...PLAN_CTX, tokenSecondsLeft: 300, plan: { estimate: { ...PLAN.estimate, full: { calls: 700, seconds: 4300 } } }, edit: { changed: [{ path: "accounts.pull" }], consequence: "pull" } });
    check("F-518 b: an edit whose consequence is a pull prices it with the login clause of the new dashboard's closing step (the minutes, then the logins of an hour when the login does not cover it; 'enough for it' when it does)",
      /it changes 1 setting \(accounts\.pull\): the next refresh pulls everything again, about 72 minutes; your login has about 5 minutes left, so the refresh will take about 2 logins of an hour: it runs as far as each login allows, stops, and continues when you log in and run it again\./.test(editPullAsk) &&
        /about 19 minutes; your login has about 50 minutes left, enough for it\./.test(CLOSING_ASK({ ...PLAN_CTX, edit: { changed: [{ path: "accounts.pull" }], consequence: "pull" } })), editPullAsk);
    // F-590: the closing step says what its plan selected; an EMPTY selection enters the ask itself, the ruled wording
    // otherwise untouched (the count rides beside it as closing.selection for the skill to relay).
    const selSome = closingSelection({ ...PLAN_CTX, plan: { ...PLAN, programs: { listed: 7, selected: 3, deleted: 0, unselected: 4 } } });
    const selEmpty = closingSelection({ ...PLAN_CTX, plan: { ...PLAN, programs: { listed: 7, selected: 0, deleted: 0, unselected: 7 } } });
    check("F-590 closingSelection names the selection's count (3 programs of the 7 listed) beside the ruled ask, which is unchanged by it; an EMPTY selection says so in the ask itself (NO program, the pages would be empty, go back) before the save; null before a plan exists",
      selSome?.programs === 3 && selSome.text === "The selection holds 3 programs of the 7 listed on the tenant." && !CLOSING_ASK({ ...PLAN_CTX, plan: { ...PLAN, programs: { listed: 7, selected: 3 } } }).includes("selection holds") &&
        selEmpty?.programs === 0 && selEmpty.text === "The selection holds NO program: nothing sent in the window as the settings stand (7 programs listed on the tenant), so the pages would be empty — go back and widen the window or name the programs before saving." && CLOSING_ASK({ ...PLAN_CTX, plan: { ...PLAN, programs: { listed: 7, selected: 0 } } }).includes(` ${selEmpty.text} `) && closingSelection({ ...PLAN_CTX, plan: null }) === null,
      [selSome, selEmpty]);
    const optionTexts = Object.fromEntries(Object.keys(RULED_OPTIONS).filter((id) => id !== "closing").map((id) => [id, q(id).options(PLAN_CTX).map((o) => o.text)]));
    check("the options are the ruled ones, in order, with the default named first and the figures where the ruling put them",
      Object.entries(RULED_OPTIONS).filter(([id]) => id !== "closing").every(([id, texts]) => isDeepStrictEqual(optionTexts[id], texts)) && q("failure-settings").options(PLAN_CTX)[0].text === "Keep both defaults: 5 due days, 25 programs (the default)" && q("tabs").options(PLAN_CTX)[0].text === "Keep the defaults: admins Health and Templates, leaders neither (the default)",
      optionTexts);
    const placeholders = QUESTIONS.flatMap((x) => (x.judgment ? [] : x.options(PLAN_CTX).filter((o) => o.id.includes("<")).map((o) => ({ q: x.id, id: o.id, followUps: o.followUps }))));
    check("placeholder options (ruling 6): every option whose id holds a <key> carries one follow-up per key, each with its own ask and kind, on programs, window, internal domains, test accounts, unsubscribe links, failure settings, tabs (one per page and tab), the lists' detail and the expected reasons; a judgment node's options carry none (the prose composes)",
      placeholders.length >= 12 && placeholders.every((p) => Array.isArray(p.followUps) && p.followUps.length > 0 && [...p.id.matchAll(/<([^>]+)>/g)].every((m) => p.followUps.some((f) => f.key === m[1])) && p.followUps.every((f) => typeof f.ask === "string" && f.ask.length > 8 && ["text", "list", "number", "boolean"].includes(f.kind))) &&
        isDeepStrictEqual([...new Set(placeholders.map((p) => p.q))], ["programs", "window", "internal-domains", "test-accounts", "unsubscribe-links", "failure-settings", "tabs", "customer-list-detail", "expected-reasons", "leaders-copy"]) && option("tabs", "{", PLAN_CTX).followUps.length === 4 && q("grouping").options(PLAN_CTX).every((o) => !o.followUps),
      placeholders.map((p) => [p.q, p.id, p.followUps?.map((f) => f.key)]));
    check("F-511 instance 21: one follow-up per value an option NEEDS — the test accounts are two options (GSIDs, names), each with its one follow-up, plus none; an admin who gives GSIDs is never asked for names",
      isDeepStrictEqual(q("test-accounts").options(PLAN_CTX).map((o) => o.followUps?.map((f) => f.key) ?? null), [["ids"], ["names"], null]) && q("test-accounts").options(PLAN_CTX)[0].text === "Give their company GSIDs" && placeholders.every((p) => p.followUps.length === [...p.id.matchAll(/<([^>]+)>/g)].length));
    // F-514 (ruled 2026-10-12): the question tool shows four options; a question with more is asked in chat as a
    // numbered list (the skill's rule). The programs question keeps its six (ruling 4); every other list fits the tool.
    const over = QUESTIONS.filter((x) => !x.judgment && x.options(PLAN_CTX).length > 4).map((x) => [x.id, x.options(PLAN_CTX).length]);
    const skillText = readFileSync(join(HERE, "..", "skills", "email-engagement", "SKILL.md"), "utf8");
    check("F-514 every option list is held to the question tool's four, or to the skill's numbered-list rule: only the programs question exceeds four (its six as ruled), and the skill prose carries the rule for any question over four (a numbered list in chat, the reply a number, never \"Other\")",
      isDeepStrictEqual(over, [["programs", 6]]) && /more than four options/.test(skillText) && /numbered list/.test(skillText) && /never (offer |use |say )?"?Other"?/i.test(skillText), over);
    check("F-511 instance 23: a list with no delivered floor says so in its follow-up, never \"at least 0 delivered\"",
      option("customer-list-detail", "sizes:").followUps.find((f) => f.key === "most-bounced").ask.includes("with no delivered floor") && option("customer-list-detail", "sizes:").followUps.find((f) => f.key === "most-engaged").ask.includes("with at least 10 delivered") && !JSON.stringify(q("customer-list-detail").options(PLAN_CTX)).includes("at least 0 delivered"));
    // F-511 instance 24: a change's pull is priced for the spec AFTER the change, from the plan's priced parts.
    const b0 = base();
    const listsOn = structuredClone(b0); listsOn.accounts.pull = true;
    const healthOff = structuredClone(b0); for (const pg of healthOff.pages) pg.tabs.find((t) => t.id === "health").enabled = false;
    const wider = structuredClone(b0); wider.sources[0].params.windowMonths = 26;
    const stepOn = structuredClone(b0); stepOn.sources[0].params.stepDetail = true;
    check("F-511 instance 24: pullSecondsAfter prices a change from the last plan's parts — customer lists on adds their seconds, Health off removes its, step detail on adds its, a wider rolling window scales, and the plan made with the lists ON prices turning them off by removing them; null with no plan",
      pullSecondsAfter(PLAN, b0, listsOn) === 1132 + 1800 && pullSecondsAfter(PLAN, b0, healthOff) === 1132 - 600 && pullSecondsAfter(PLAN, b0, stepOn) === 1132 + 300 && pullSecondsAfter(PLAN, b0, wider) === Math.round((1132 / 13) * 26) && pullSecondsAfter(PLAN, b0, b0) === 1132 &&
        pullSecondsAfter({ estimate: { ...PLAN.estimate, full: { calls: 400, seconds: 3000 }, accounts: { on: true, addsCalls: 264, addsSeconds: 1800 } } }, listsOn, b0) === 3000 - 1800 && pullSecondsAfter(null, b0, listsOn) === null);
    // F-575 (the owed item): a plan's parts re-priced from its calls by family at the pace now; the switch costs scale by
    // the full pull's ratio; a plan without the counts is returned as it stands; pullSecondsAfter quotes the re-priced parts.
    const est = { mode: "full", full: { calls: 10, seconds: 20, byFamily: { programs: 10 } }, thisRun: { calls: 10, seconds: 20, byFamily: { programs: 10 } }, secondsPerCall: { programs: 2 }, accounts: { on: false, addsCalls: 2, addsSeconds: 4 }, health: { on: true, addsCalls: 1, addsSeconds: 6 }, stepDetail: { on: false, addsCalls: 0, addsSeconds: 0 } };
    const re = repriceEstimate(est, { programs: 4 });
    check("F-575 repriceEstimate: the full pull and this run re-priced family by family at the pace now (10 programs calls at 4 s: 40 for 20), the switch costs scaled by the same ratio (accounts 8, health 12), repriced true with the ratio 2; at the plan's own table the figure is reproduced; a plan without byFamily is returned unchanged (repriced false); null with none; pullSecondsAfter with a pace quotes the re-priced parts (40 + 8) and without one the plan's (20 + 4)",
      re.full.seconds === 40 && re.thisRun.seconds === 40 && re.accounts.addsSeconds === 8 && re.health.addsSeconds === 12 && re.repriced === true && re.ratio === 2 && repriceEstimate(est, { programs: 2 }).full.seconds === 20 && repriceEstimate({ ...est, full: { calls: 10, seconds: 20 } }, { programs: 4 }).repriced === false && repriceEstimate(null, {}) === null &&
        pullSecondsAfter({ estimate: est }, b0, listsOn, { programs: 4 }) === 48 && pullSecondsAfter({ estimate: est }, b0, listsOn) === 24,
      [re, pullSecondsAfter({ estimate: est }, b0, listsOn, { programs: 4 }), pullSecondsAfter({ estimate: est }, b0, listsOn)]);
    check("F-513 logins: a pull's seconds read as whole logins of an hour, at least one",
      loginsFor(0) === 1 && loginsFor(3600) === 1 && loginsFor(3601) === 2 && loginsFor(4327) === 2 && LOGIN_SECONDS === 3600);
    check("composeAnswer is the follow-up rule as code: each <key> replaced by its answer, a list as a JSON list (none as the empty list), a boolean as true or false, text as written; a missing answer is refused",
      composeAnswer(option("programs", "since:"), { date: "2026-05-01" }) === "since:2026-05-01" && composeAnswer(option("programs", "names:"), { programs: "Acme One\nAcme Two" }) === 'names:["Acme One","Acme Two"]' && composeAnswer(option("window", "rolling:<"), { months: 4 }) === "rolling:4" &&
        composeAnswer(option("window", "fixed:"), { from: "2025-01", to: "2025-06" }) === "fixed:2025-01:2025-06" && composeAnswer(option("internal-domains", "<domains>"), { domains: "none" }) === "[]" && composeAnswer(option("test-accounts", '{"ids": <ids>'), { ids: ["co-09"] }) === '{"ids": ["co-09"], "names": []}' && composeAnswer(option("test-accounts", '{"ids": [], "names"'), { names: "Acme Test" }) === '{"ids": [], "names": ["Acme Test"]}' &&
        composeAnswer(option("tabs", "{", PLAN_CTX), { "admin.health": "yes", "admin.templates": "no", "exec.health": true, "exec.templates": "off" }) === '{"admin": {"health": true, "templates": false}, "exec": {"health": true, "templates": false}}' && composeAnswer(option("failure-settings", "set:"), { quietDueDays: "keep", samplePrograms: "10" }) === "set:keep:10" &&
        composeAnswer(option("customer-list-detail", "sizes:"), { "most-engaged": "3 2", "least-engaged": "keep", "most-bounced": "5 0" }) === "sizes:3 2|keep|5 0" && (() => { try { composeAnswer(option("programs", "since:"), {}); return false; } catch (e) { return /has no answer/.test(e.message); } })());
    check("F-504 the category cost is quoted where ruled: on the tabs question (K4's bar moved there), from the plan's categories × recipient classes = counted calls with the minutes; nothing when the tenant has no category file; the internal-domains and test-accounts asks say a few minutes per domain and per test account instead of counted calls",
      /The 56 bounce categories in the workspace's category file cost 336 counted calls a refresh \(56 × 6 recipient classes: all, each internal domain, the test accounts, and the test accounts on each domain; about 17 minutes\)/.test(asks.tabs) && categoryCostText({ categoryCalls: { bounce: { categories: 0, classes: 1, calls: 0, seconds: 0 } } }) === "" &&
        !/counted call/.test(askText(q("tabs"), { ...PLAN_CTX, plan: { estimate: { ...PLAN.estimate, health: { ...PLAN.estimate.health, categoryCalls: { bounce: { categories: 0, classes: 1, calls: 0, seconds: 0 } } } } } })) && /none of it for bounce categories yet/.test(askText(q("tabs"), { ...PLAN_CTX, plan: { estimate: { ...PLAN.estimate, health: { ...PLAN.estimate.health, categoryCalls: null } } } })) &&
        !/counted call/.test(asks["internal-domains"]) && !/counted call/.test(asks["test-accounts"]) && !/counted call/.test(askText(q("failure-settings"), PLAN_CTX)));
    const letters = Object.fromEntries(QUESTIONS.map((x) => [x.id, askText(x, { spec: base(), plan: null, answered: [], programs: [], params: null })]));
    check("with no plan (the `questions` verb for a reader) each figure reads as the ruling's letter — M, N, D, T — and never as a number made up",
      /about M minutes for each month covered, so the default's 13 months is about N minutes and two years would be about 24 × M minutes/.test(letters.window) && /On this tenant N programs have failures; reading all of them would add about M minutes/.test(letters["failure-settings"]) && /Health adds about N minutes to each refresh on this tenant \(M of that for the bounce categories\)/.test(letters.tabs) &&
        /about N minutes instead of about M minutes/.test(letters["customer-lists"]) && /it adds about N minutes to each refresh/.test(letters["step-detail"]) && /about N calls and about M minutes on this tenant; your login has about T minutes left/.test(letters["dry-run"]) && /about D minutes, rendered/.test(CLOSING_OPTIONS({ spec: base(), plan: null, answered: [] })[1].text), letters);
    check("F-512 the fast path's defaults are the asks' labelled defaults, one source: programs sent-90d, the window rolling:13, grouping the characteristic rules from the plan's programs (Recurring / One-off at the top level, each model beneath), none for the recipients three and the expected reasons, both failure settings kept, the look skipped, the tabs' defaults, no customer lists, no step detail",
      defaultAnswer(q("programs"), PLAN_CTX) === "sent-90d" && defaultAnswer(q("window"), PLAN_CTX) === "rolling:13" && defaultAnswer(q("internal-domains"), PLAN_CTX) === "none" && defaultAnswer(q("test-accounts"), PLAN_CTX) === "none" && defaultAnswer(q("unsubscribe-links"), PLAN_CTX) === "none" &&
        defaultAnswer(q("failure-settings"), PLAN_CTX) === "default" && defaultAnswer(q("look"), PLAN_CTX) === "skip" && defaultAnswer(q("tabs"), PLAN_CTX) === "default" && defaultAnswer(q("customer-lists"), PLAN_CTX) === "no" && defaultAnswer(q("leader-names"), PLAN_CTX) === "no" && defaultAnswer(q("customer-list-detail"), PLAN_CTX) === "default" && defaultAnswer(q("step-detail"), PLAN_CTX) === "no" && defaultAnswer(q("expected-reasons"), PLAN_CTX) === "none" &&
        isDeepStrictEqual(JSON.parse(defaultAnswer(q("grouping"), { ...PLAN_CTX, programs: [{ id: "a", model: "DRIPV2", modelName: "Email Chain" }, { id: "b", model: "CSAT_SURVEY_V2", modelName: "CSAT Survey" }, { id: "c", model: "DRIPV2", modelName: "Email Chain" }] })), {
          rules: [{ kind: "characteristic", level: "supergroup", characteristic: "recurring", is: true, label: "Recurring" }, { kind: "characteristic", level: "supergroup", characteristic: "recurring", is: false, label: "One-off" }, { kind: "characteristic", level: "group", characteristic: "model", is: "CSAT_SURVEY_V2", label: "CSAT Survey" }, { kind: "characteristic", level: "group", characteristic: "model", is: "DRIPV2", label: "Email Chain" }], overrides: {},
        }) && defaultGroupRules([]).rules.length === 2);
  }
  // ══ Pure pieces ════════════════════════════════════════════════════════════
  {
    const b = base();
    const edited = structuredClone(b);
    edited.title = "Other";
    edited.sources[0].params.internalDomains = ["acme.com"];
    edited.accounts.lists = [{ kind: "most-bounced", n: 5, floor: 0 }];
    const cost = changeCost(b, edited);
    const silent = structuredClone(b); silent.health.silentDays = 45;
    check("changeCost: the silent threshold costs a pull only when it moves the derived lookback (above the last plan's longest schedule period); below it, or with no plan, as the table says",
      changeCost(b, silent, { longestPeriodDays: 91 }).consequence === "rebuild" && changeCost(b, silent, { longestPeriodDays: 40 }).consequence === "pull" && changeCost(b, silent).consequence === "pull");
    check("changeCost: every changed setting by its description path with its cost, and the highest cost as the consequence (a domain beats a title; a list re-selection sits between)",
      isDeepStrictEqual(cost.changed.map((c) => [c.path, c.cost]), [["accounts.lists[]", "reselect"], ["sources[].params.internalDomains[]", "pull"], ["title", "rebuild"]]) && cost.consequence === "pull" && changeCost(b, { ...b, title: "T" }).consequence === "rebuild" && changeCost(b, b).consequence === null &&
        coveredPath("sources[0].params.internalDomains[1]") === "sources[].params.internalDomains[]" && coveredPath("groups.overrides.p-1.group") === "groups.overrides{}" && coveredPath("pages[1].tabs[2].enabled") === "pages[].tabs[].enabled" && coveredPath("theme.colors.accent") === "theme.colors.accent", cost);
    const later = structuredClone(GOLDEN);
    later.meta.pulledAt = "2026-10-15T09:00:00-07:00";
    for (const r of later.facts.byTemplate) if (r.month < later.meta.incompleteFrom.slice(0, 7)) r.opened += 1;
    const delta = computeDelta(b, later, GOLDEN);
    check("computeDelta: over the closed months both snapshots hold, each headline metric's previous and current figure and the change (points for a rate, a ratio for a count); null with no previous; the programs added and gone",
      delta.previousPulledAt === GOLDEN.meta.pulledAt && delta.closedMonths.length > 0 && delta.metrics.opened.change.kind === "ratio" && delta.metrics.opened.change.value > 1 && delta.metrics.openRate.change.kind === "points" && delta.metrics.openRate.change.value > 0 && delta.metrics.sent.change.value === 1 &&
        computeDelta(b, GOLDEN, null) === null && isDeepStrictEqual(delta.programs, { added: 0, gone: 0 }), delta.metrics);
    const p = adapterParams(b, { today: TODAY });
    const fixed = structuredClone(b); fixed.sources[0].params.window = { kind: "fixed", from: "2025-01", to: "2025-06" };
    const since = structuredClone(b); since.sources[0].params.window = { kind: "since", from: "2024-07" };
    const withHealthOff = structuredClone(b); for (const pg of withHealthOff.pages) pg.tabs.find((t) => t.id === "health").enabled = false;
    check("adapterParams maps the spec: a rolling window counts back from today, a fixed one is its months, a since one runs to the current month; health is on when any page's Health tab is on and the lookback is at least silentDays, capped at the window; --health-only reads one month again; customer lists and fields ride",
      p.from === "2025-09" && p.to === "2026-09" && adapterParams(fixed, { today: TODAY }).from === "2025-01" && adapterParams(fixed, { today: TODAY }).to === "2025-06" && adapterParams(since, { today: TODAY }).from === "2024-07" && adapterParams(since, { today: TODAY }).to === "2026-09" &&
        p.health.pull === true && adapterParams(withHealthOff, { today: TODAY }).health.pull === false && p.health.lookbackDays === 30 && adapterParams(b, { today: TODAY, lookbackDays: 120 }).health.lookbackDays === 120 && adapterParams(b, { today: TODAY, lookbackDays: 9999 }).health.lookbackDays === 366 &&
        adapterParams(b, { today: TODAY, healthOnly: true }).repullMonths === 1 && p.repullMonths === 2 && p.accounts.lists.length === 3 && isDeepStrictEqual(p.accounts.fields, []) && p.health.quietDueDays === 5 && p.health.samplePrograms === 25, p);
  }

  // ══ The interview, as a real process, in the ruled order ═══════════════════
  const started = run("new", [SLUG, "--title", "Acme health", "--owner", "CS Ops"]);
  check("new: a draft from the defaults, held by the caller, with the first question to ask (the programs: no purpose, no audiences)", started.code === 0 && started.json?.state === "new" && started.json.by === "ana" && started.json.next === "programs" && existsSync(draftFile()), started.json ?? started.stderr);
  const first = run("next", [SLUG]);
  check("next: the tenant pre-flight is automatic (whoami's host equals the spec's, confirmed on stderr) and its STATEMENT is returned for the skill to say (ruling 1); then the programs question with its six options, the two placeholder ones carrying their follow-ups",
    first.code === 0 && first.json?.said === "This dashboard is for acme.gainsightcloud.com, the CLI's active tenant, whose knowledge base it reads." && first.json.question?.id === "programs" && first.json.question.judgment === false && first.json.question.options.length === 6 && first.json.question.options[4].followUps?.[0]?.key === "date" && first.json.question.options[5].followUps?.[0]?.kind === "list" &&
      readJson(draftFile()).answered.includes("tenant") && /tenant acme\.gainsightcloud\.com confirmed/.test(first.stderr) && argvLines().length === 1, first.json ?? first.stderr);
  const sinceDate = run("answer", [SLUG, "programs", composeAnswer(first.json.question.options[4], { date: "2026-05-01" })]);
  const badChoice = run("answer", [SLUG, "programs", "everything"]);
  check("programs through a follow-up: 'since a date' composed by the skill lands as the selector's date; a choice outside the options is refused with the options named, and nothing is written; the answer is not said twice (next does not repeat it)",
    sinceDate.code === 0 && readJson(draftFile()).spec.sources[0].params.selector.sentSince === "2026-05-01" && sinceDate.json.next === "window" && !run("next", [SLUG]).json?.said && badChoice.code === 1 && badChoice.json?.ok === false && /not one of the options/.test(badChoice.json.error) && readJson(draftFile()).spec.sources[0].params.selector.sentSince === "2026-05-01", badChoice.json);
  const programs = run("answer", [SLUG, "programs", "window"]);
  check("programs: 'window' is every program with a send in the window (no selector)", programs.code === 0 && readJson(draftFile()).spec.sources[0].params.selector.sentSince === null, programs.json ?? programs.stderr);
  const callsBeforePlan = argvLines().length;
  const windowQ = run("next", [SLUG]);
  check("next at the window (directly after the programs, ruling 5): the script makes the plan (cheap calls only: whoami, the program list, schemas, the tenant-wide reads; no fact call) and the ask quotes the per-month rate, the 13-month total and the two-year total from it; the default option carries the minutes",
    windowQ.code === 0 && windowQ.json?.question?.id === "window" && /a first pull takes about [\d.]+ minutes for each month covered, so the default's 13 months is about \d+ minutes and two years would be about \d+ minutes/.test(windowQ.json.question.ask) && /\(the default, about \d+ minutes\)/.test(windowQ.json.question.options[0].text) &&
      windowQ.json.estimate?.full?.calls > 0 && argvLines().length > callsBeforePlan && argvLines().length - callsBeforePlan < windowQ.json.estimate.full.calls / 2, [windowQ.json?.question?.ask, argvLines().length - callsBeforePlan]);
  const windowA = run("answer", [SLUG, "window", composeAnswer(windowQ.json.question.options[1], { months: 4 })]);
  const callsAfterWindow = argvLines().length;
  const grouping = run("next", [SLUG]);
  const suggestion = existsSync(join(dash(), SUGGESTION_FILE)) ? readJson(join(dash(), SUGGESTION_FILE)) : null;
  check("the window answered through its follow-up (rolling:4) sets the kind and the months; the writer refuses a malformed one; ONE plan serves the window and the grouping (ruled 2026-10-12): next at grouping makes no second plan although the window moved, hands over the suggestion file written from the plan's program list, with the estimate",
    windowA.code === 0 && readJson(draftFile()).spec.sources[0].params.windowMonths === 4 && readJson(draftFile()).spec.sources[0].params.window.kind === "rolling" && run("answer", [SLUG, "window", "weekly"]).code === 1 &&
      grouping.code === 0 && grouping.json?.question?.id === "grouping" && grouping.json.question.judgment === true && grouping.json.question.input.suggestionFile.endsWith(SUGGESTION_FILE) && argvLines().length === callsAfterWindow && suggestion?.kind === "dashboard-group-suggestion-input" && suggestion.programs.length > 5 &&
      suggestion.programs.every((x) => "recurring" in x && "sent" in x && x.sent > 0) && suggestion.tallies.model.length > 0 && grouping.json.estimate?.full?.calls > 0, [grouping.json?.question?.input, suggestion?.programs?.length, argvLines().length - callsAfterWindow]);
  const rules = { rules: [{ kind: "characteristic", level: "supergroup", characteristic: "sendsSurveys", is: true, label: "Surveys" }, { kind: "characteristic", level: "supergroup", characteristic: "recurring", is: true, label: "Recurring" }], overrides: {} };
  const grouped = run("answer", [SLUG, "grouping", JSON.stringify(rules)]);
  check("grouping: the proposed rules (the prose's) are written by the script through the writer's validation", grouped.code === 0 && isDeepStrictEqual(readJson(draftFile()).spec.groups, rules), grouped.json ?? grouped.stderr);
  const domainsQ = run("next", [SLUG]);
  const domains = run("answer", [SLUG, "internal-domains", composeAnswer(domainsQ.json.question.options[0], { domains: "acme.com" })]);
  const testsQ = run("next", [SLUG]);
  const byIds = run("answer", [SLUG, "test-accounts", composeAnswer(testsQ.json.question.options[0], { ids: "co-09" })]);
  const idsOnly = readJson(draftFile()).spec.sources[0].params.testAccounts;
  const byNames = run("answer", [SLUG, "test-accounts", composeAnswer(testsQ.json.question.options[1], { names: "Acme Customer 03" })]);
  const namesOnly = readJson(draftFile()).spec.sources[0].params.testAccounts;
  const noSuch = run("answer", [SLUG, "test-accounts", composeAnswer(testsQ.json.question.options[1], { names: "Nobody Here" })]);
  // Both forms at once, as the written form still reads (the walk keeps both accounts from here on).
  const tests = run("answer", [SLUG, "test-accounts", '{"ids": ["co-09"], "names": ["Acme Customer 03"]}']);
  check("internal domains through the list follow-up; test accounts through ONE follow-up each (F-511 instance 21): the GSIDs option asks for GSIDs alone and keeps them as given, the names option asks for names alone and looks each up once through the gate (one read-only company call; several matches or none are said, never guessed), and the answer is the ids",
    domainsQ.json?.question?.id === "internal-domains" && domains.code === 0 && isDeepStrictEqual(readJson(draftFile()).spec.sources[0].params.internalDomains, ["acme.com"]) && testsQ.json?.question?.id === "test-accounts" && testsQ.json.question.options.length === 3 &&
      byIds.code === 0 && isDeepStrictEqual(idsOnly, ["co-09"]) && byNames.code === 0 && isDeepStrictEqual(namesOnly, ["co-03"]) && byNames.json.notes.some((n) => /"Acme Customer 03" is co-03/.test(n)) && tests.code === 0 && isDeepStrictEqual(readJson(draftFile()).spec.sources[0].params.testAccounts, ["co-03", "co-09"]) &&
      argvLines().filter((a) => a.includes("--object company") && a.includes("Acme Customer 03")).length === 2 && noSuch.code === 1 && /no account is named "Nobody Here"/.test(noSuch.json?.error ?? ""), [byIds.json, byNames.json, noSuch.json]);
  const unsubQ = run("next", [SLUG]);
  const unsub = run("answer", [SLUG, "unsubscribe-links", composeAnswer(unsubQ.json.question.options[0], { links: OWN_SITE_UNSUBSCRIBE })]);
  const badUnsub = run("answer", [SLUG, "unsubscribe-links", composeAnswer(unsubQ.json.question.options[0], { links: "not a host" })]);
  check("unsubscribe links through the list follow-up: the value the adapter accepts lands; one it would refuse is refused by the writer naming the field", unsubQ.json?.question?.id === "unsubscribe-links" && unsub.code === 0 && readJson(draftFile()).spec.sources[0].params.unsubscribeLinks.length === 1 && badUnsub.code === 1 && /unsubscribeLinks\[0\] must be a link or a host/.test(badUnsub.json?.error ?? ""), badUnsub.json);
  const failureSettings = run("next", [SLUG]);
  const fsAnswer = run("answer", [SLUG, "failure-settings", composeAnswer(failureSettings.json.question.options[1], { quietDueDays: "keep", samplePrograms: "10" })]);
  check("failure settings (ruling 10): two questions in one ask, each ending in its question, with the plan's count of programs with failures and the minutes to read them all; 'keep' through the follow-up keeps a default while the other value is set",
    failureSettings.code === 0 && failureSettings.json.question.id === "failure-settings" && /On this tenant \d+ programs have failures; reading all of them would add (about \d+ minutes|no time) to a first pull\. Do you want to change that number\?$/.test(failureSettings.json.question.ask) && /Do you want to change that threshold\?/.test(failureSettings.json.question.ask) &&
      fsAnswer.code === 0 && readJson(draftFile()).spec.sources[0].params.quietDueDays === 5 && readJson(draftFile()).spec.sources[0].params.samplePrograms === 10, [failureSettings.json?.question?.ask, fsAnswer.json]);
  const lookQ = run("next", [SLUG]);
  const look = run("answer", [SLUG, "look", JSON.stringify({ colors: { accent: "#0b57d0", muted: "#eeeeee" }, series: ["#0b57d0", "#0c58d1"], font: "Georgia, serif", radius: 4, logoFile: "brand/logo.png" })]);
  const theme = readJson(draftFile()).spec.theme;
  check("the look (UX-2, ruling 13): three options (skip, a guidelines file, pasted values; no brand-skill path); the extracted tokens are stored as the theme with the validator's notes beside them; a muted colour that would not read and two alike series colours are replaced and shown with the reason; the logo is read from the local PNG as a data URI; the path names alone are refused (the prose answers with the tokens)",
    lookQ.json?.question?.id === "look" && isDeepStrictEqual(lookQ.json.question.options.map((o) => o.id), ["skip", "file", "values"]) && !/brand skill/i.test(lookQ.json.question.ask) && look.code === 0 && theme.colors.accent === "#0b57d0" && theme.font === "Georgia, serif" && theme.radius === 4 && theme.logo?.startsWith("data:image/png;base64,") && Array.isArray(theme.notes) && theme.notes.some((n) => n.token === "colors.muted") && theme.notes.some((n) => n.token === "series[1]") &&
      look.json.replaced.length === theme.notes.length && look.json.notes.some((n) => /colors\.muted: text must read/.test(n)) && /names the brand path, not the brand/.test(run("answer", [SLUG, "look", "file"]).json?.error ?? ""), [look.json, theme?.notes]);
  const badLogo = run("answer", [SLUG, "look", JSON.stringify({ logoFile: "https://example.com/logo.png" })]);
  check("a logo is never fetched from a URL: a URL is not a file and is refused", badLogo.code === 1 && /does not exist/.test(badLogo.json?.error ?? ""), badLogo.json);
  const tabsQ = run("next", [SLUG]);
  check("tabs (ruling 14): one bullet per tab with its default; Health's minutes from the plan with the categories' share and that the pull is shared by both pages; Templates adds no time; the change option carries one follow-up per page and tab",
    tabsQ.json?.question?.id === "tabs" && /— Engagement and About are always on\. — Health shows/.test(tabsQ.json.question.ask) && /Health adds about \d+ minutes to each refresh on this tenant \((about \d+ minutes of that for the bounce categories|none of it for bounce categories yet: this tenant has no category file)\); it is one pull shared by both pages/.test(tabsQ.json.question.ask) && /Templates adds no time to the pull\. Do you want to change any of these\?$/.test(tabsQ.json.question.ask) &&
      isDeepStrictEqual(tabsQ.json.question.options[1].followUps.map((f) => f.key), ["admin.health", "admin.templates", "exec.health", "exec.templates"]), tabsQ.json?.question);
  run("answer", [SLUG, "tabs", "default"]);
  const listsQ = run("next", [SLUG]);
  const lists = run("answer", [SLUG, "customer-lists", "yes"]);
  const leadersQ = run("next", [SLUG]);
  const leaders = run("answer", [SLUG, "leader-names", "no"]);
  const detailQ = run("next", [SLUG]);
  check("customer lists first (ruling 15), with the first pull's minutes with and without them in the ask; then the leaders' names, asked only once the lists are on; then the lists' detail",
    listsQ.json?.question?.id === "customer-lists" && /Adding the lists makes the first pull about \d+ minutes instead of about \d+ minutes on a tenant this size/.test(listsQ.json.question.ask) && lists.code === 0 && lists.json.next === "leader-names" && leadersQ.json?.question?.id === "leader-names" && leaders.code === 0 && readJson(draftFile()).spec.pages[1].accountNames === false && detailQ.json?.question?.id === "customer-list-detail", [listsQ.json?.question?.ask, lists.json?.next, leadersQ.json?.question?.id]);
  const sized = run("answer", [SLUG, "customer-list-detail", composeAnswer(detailQ.json.question.options[1], { "most-engaged": "3 2", "least-engaged": "3 2", "most-bounced": "keep" })]);
  const afterSizes = readJson(draftFile()).spec.accounts;
  const segmented = run("answer", [SLUG, "customer-list-detail", composeAnswer(detailQ.json.question.options[2], { field: "Industry", lists: "least engaged" })]);
  const afterSegments = readJson(draftFile()).spec.accounts;
  check("the lists' detail (ruling 16) through its follow-ups: a size and floor per list ('keep' leaves one), then a per-segment list over a company field, added beside the three (the field recorded); a malformed size is refused naming the list",
    sized.code === 0 && isDeepStrictEqual(afterSizes.lists.map((l) => [l.kind, l.n, l.floor]), [["most-engaged", 3, 2], ["least-engaged", 3, 2], ["most-bounced", 25, 0]]) && segmented.code === 0 && afterSegments.lists.length === 4 && isDeepStrictEqual(afterSegments.lists[3], { ...DEFAULT_ACCOUNT_LISTS.find((l) => l.kind === "least-engaged"), per: "Industry" }) && isDeepStrictEqual(afterSegments.fields, ["Industry"]) &&
      /the most engaged list: give a size and a floor as two numbers/.test(run("answer", [SLUG, "customer-list-detail", "sizes:lots|keep|keep|keep"]).json?.error ?? ""), [sized.json, segmented.json, afterSegments]);
  const stepQ = run("next", [SLUG]);
  run("answer", [SLUG, "step-detail", "no"]);
  const reasonsQ = run("next", [SLUG]);
  const added = run("answer", [SLUG, "expected-reasons", composeAnswer(reasonsQ.json.question.options[1], { wordings: "Custom wording of this tenant" })]);
  const reasonsAfterAdd = readJson(draftFile()).spec.sources[0].params.expectedReasons;
  run("answer", [SLUG, "expected-reasons", "none"]);
  check("step detail's ask quotes its minutes from the plan; the expected reasons name the six shipped ones and take a wording through the list follow-up, or none",
    stepQ.json?.question?.id === "step-detail" && /On this tenant it adds about \d+ minutes? to each refresh/.test(stepQ.json.question.ask) && reasonsQ.json?.question?.id === "expected-reasons" && /Already in the participant list; Unique criteria already met; Met the advanced criteria; Unsubscribed from a category; On the global opt-out; Opted out at the send step/.test(reasonsQ.json.question.ask) &&
      added.code === 0 && isDeepStrictEqual(reasonsAfterAdd, ["Custom wording of this tenant"]) && isDeepStrictEqual(readJson(draftFile()).spec.sources[0].params.expectedReasons, []), [stepQ.json?.question?.ask, added.json]);
  // The leaders' copy (PUB-3/PUB-4): asked last among the settings; a folder given is the MACHINE's, written to the
  // workspace's publish targets through its one writer, never to the spec; a folder that is not there is refused.
  const copyQ = run("next", [SLUG]);
  const missingFolder = run("answer", [SLUG, "leaders-copy", `folder:${join(ROOT, "no-such-folder")}`]);
  const asArtifact = run("answer", [SLUG, "leaders-copy", "artifact"]); // not offered since F-526: refused
  const draftArtifact = readJson(draftFile()).spec.publish;
  const toFolder = run("answer", [SLUG, "leaders-copy", composeAnswer(copyQ.json?.question?.options?.[0] ?? { id: "" }, { folder: SHARE })]);
  const targets = existsSync(join(WS, ".gs-superadmin", PUBLISH_TARGETS_FILE)) ? readJson(join(WS, ".gs-superadmin", PUBLISH_TARGETS_FILE)) : null;
  const draftPublish = readJson(draftFile()).spec.publish;
  check("PUB-3 the leaders' copy question: asked after the expected reasons, the shared folder first (the default: set later), the workspace only beside it (the artifact link withdrawn, F-526), with the cost sentence (viewers pay nothing); a folder given is written to the workspace's publish targets (the machine's), the spec naming only the target and the file; a folder that is not there is refused with nothing written; an artifact answer is refused as no option, writing nothing",
    copyQ.json?.question?.id === "leaders-copy" && isDeepStrictEqual(copyQ.json.question.options.map((o) => o.id), ["folder:<folder>", "folder-later", "none"]) && /Viewers pay nothing either way: the leaders' copy is a file, so opening it runs no query and no session\.$/.test(copyQ.json.question.ask) &&
      missingFolder.code === 1 && /does not exist or is not a folder/.test(missingFolder.json?.error ?? "") && asArtifact.code === 1 && draftArtifact.target !== "claude-artifact" &&
      toFolder.code === 0 && toFolder.json.publishTarget?.name === "leaders" && targets?.targets?.leaders?.folder === resolve(SHARE) && isDeepStrictEqual(draftPublish, { target: "file-copy", config: { to: "leaders", file: `${SLUG}-leaders.html`, datedCopies: false, datasets: true } }) && !JSON.stringify(readJson(draftFile()).spec).includes("leaders-share"),
    [copyQ.json?.question?.options, missingFolder.json, draftArtifact, toFolder.json, targets, draftPublish]);
  const callsBeforeClosing = argvLines().length;
  const closing = run("next", [SLUG]);
  check("the closing step (ruling 19): once every setting is answered, next returns the first action row WITH the closing block: the ruled ask priced on the exact settings (a new plan, since the pull-affecting answers moved), the login's remaining minutes read now, and the four options with the action answers each stands for",
    closing.code === 0 && closing.json?.question?.id === "dry-run" && closing.json.closing && /^Ready to save\. A full refresh with these settings is about \d+ calls and about \d+ minutes on this tenant; your login has about \d+ minutes left, enough for it\. /.test(closing.json.closing.ask) && closing.json.closing.ask.endsWith(` ${HOW_TO_REFRESH_RULED("acme-health", "acme-prod")}`) &&
      closing.json.question.ask === closing.json.closing.ask && isDeepStrictEqual(closing.json.closing.options.map((o) => o.id), ["save-now", "dry-run", "save-only", "go-back"]) && closing.json.closing.options.every((o) => Array.isArray(o.answers)) && argvLines().length > callsBeforeClosing && closing.json.progress.remaining === 3, closing.json);
  check("F-590 the closing step carries what its plan selected (closing.selection: the programs of the ones listed, with the one sentence), and with programs selected the ask stays the ruled wording", closing.json?.closing?.selection?.programs > 0 && closing.json.closing.selection.programs <= closing.json.closing.selection.listed && closing.json.closing.selection.text === `The selection holds ${closing.json.closing.selection.programs} programs of the ${closing.json.closing.selection.listed} listed on the tenant.` && !closing.json.closing.ask.includes("selection holds"), closing.json?.closing?.selection);
  const callsBeforeDry = argvLines().length;
  const dry = run("answer", [SLUG, "dry-run", "yes"]);
  const previewPage = existsSync(join(dash(), PREVIEW_DIR, "latest-admin.html")) ? readFileSync(join(dash(), PREVIEW_DIR, "latest-admin.html"), "utf8") : "";
  const afterDry = run("next", [SLUG]);
  check("the dry run: a cheap pull (no customer lists, no health, no step detail) rendered as preview pages in the theme (the accent colour and the logo are in the file), kept beside the draft; the closing step then offers no second dry run",
    dry.code === 0 && dry.json.preview?.pages?.length === 2 && dry.json.preview.themed === true && previewPage.includes("--accent:#0b57d0") && previewPage.includes("data:image/png;base64,") && argvLines().slice(callsBeforeDry).every((a) => !a.includes("ao_failed_participants") && !/"GsCompanyId" ?,? ?"IN"|GsCompanyId","operator":"IN"/.test(a)) &&
      afterDry.json?.question?.id === "estimate" && isDeepStrictEqual(afterDry.json.closing.options.map((o) => o.id), ["save-now", "save-only", "go-back"]), [dry.json?.preview, dry.stderr?.slice(-300), afterDry.json?.closing?.options]);
  const estimate = run("answer", [SLUG, "estimate", "yes"]);
  check("the estimate: the full refresh's calls and minutes against the token READ NOW (F-511 instance 25: whoami at the confirmation, not the plan's reading) with the logins a pull of this size takes, the knowledge-base gap priced, confirmed", estimate.code === 0 && estimate.json.confirmed === true && estimate.json.estimate.full.calls > 0 && estimate.json.estimate.token.fits === true && estimate.json.estimate.token.loginsNeeded === 1 && argvLines().at(-1) === "whoami" && estimate.json.estimate.kb.undocumented + estimate.json.estimate.kb.behind >= 2, estimate.json);
  const done = run("next", [SLUG]);
  check("after the estimate every question but the save is answered; next says so, the closing block still beside it", done.json?.question?.id === "save" && done.json.progress.remaining === 1 && done.json.closing?.options?.length === 3, done.json);
  const planDirsBeforeSave = runDirs().filter((d) => d.includes("-plan-"));
  const invBefore = manifest().inventory;
  const callsBeforeRefresh = argvLines().length;
  const saved = run("answer", [SLUG, "save", "yes"]);
  const refresh = { code: saved.code, json: saved.json?.refresh ?? null, stderr: saved.stderr };
  check("save (and refresh now): the draft becomes the saved spec, the draft and the interview state are gone, the summary carries the manual-refresh statement with the kb folder, and the first refresh CONTINUES the closing step's plan (the first sitting's note of 2026-10-12): the run keeps the plan's directory, so the plan's cheap calls are reused, not made again",
    saved.code === 0 && existsSync(specFile()) && !existsSync(draftFile()) && openSpec(readJson(specFile())).accounts.pull === true && saved.json.pullAgainText === HOW_TO_REFRESH_RULED(SLUG, "acme-prod") && saved.json.pullAgainLine.endsWith(`refresh ${SLUG} --kb acme-prod`) && refresh.json?.status === "ok" && refresh.json.resumed === false && refresh.json.pull.calls.reused > 0 && planDirsBeforeSave.some((d) => refresh.json.run.startsWith(d)) && runDirs().includes(refresh.json.run) && refresh.json.budget?.loginsNeeded === 1,
    [saved.json?.refresh?.pull?.calls, planDirsBeforeSave, runDirs()]);

  // ══ The refresh ════════════════════════════════════════════════════════════
  const snap1 = snapshots();
  const inv = manifest().inventory;
  check("refresh: the pull through the adapter (health on since the admin page's Health tab is on; customer lists on), the groups applied, the snapshot written under the dashboard, both pages built, the summary with the pull's mode, counts, the lookback and the caveats; no delta on a first pull",
    refresh.code === 0 && refresh.json?.status === "ok" && refresh.json.pull.mode === "full" && refresh.json.pull.health === true && refresh.json.pull.accounts === true && refresh.json.pull.lookbackDays >= 30 && snap1.length === 1 && existsSync(join(dash(), "latest-admin.html")) && existsSync(join(dash(), "latest-exec.html")) &&
      refresh.json.delta === null && /ungrouped/.test(refresh.json.ungrouped) && refresh.json.pages.length === 2 && !existsSync(join(dash(), LOCK_FILE)) && !existsSync(join(dash(), STATE_FILE)), refresh.json ?? refresh.stderr?.slice(-600));
  // F-575: the pull says its progress and keeps it, and a finished pull's measured pace prices the next plan.
  const runsRoot = join(WS, ".gs-superadmin", "tmp", "engagement");
  const progressLines = refresh.stderr.split("\n").filter((l) => l.includes("pull progress: "));
  const progressFile = () => readJson(join(runsRoot, refresh.json.run, "progress.json"));
  check("F-575 progress: the refresh says on stderr, at the first fact call and every tenth made call after, how many calls are made of about how many, the time elapsed and about how long is left — each remaining family at the pace THIS run measured for it, the plan's price for a family not yet seen (the line counts them; the first line names several, and against the stand-in's fast calls the last record's left is seconds, never the constants' minutes); never one of the per-call lines; the same figures in the run's progress.json",
    /^dashboard\.mjs: pull progress: 1 of about \d+ calls made this run · \d+ s elapsed · about \d+ (s|min) left \(\d+ (s|min) at this run's pace; the plan's \d+ (s|min) for \d+ famil(y|ies) not yet seen\)$/.test(progressLines[0] ?? "") && progressLines.length >= 2 && /^dashboard\.mjs: pull progress: 10 of about \d+ calls made this run · \d+ s elapsed · about \d+ (s|min) left/.test(progressLines[1] ?? "") && / left at this run's pace$/.test(progressLines.at(-1) ?? "") && progressLines.every((l) => /^dashboard\.mjs: pull progress: \d+ of about \d+ calls made this run · /.test(l)) &&
      Number.isInteger(progressFile().leftSeconds) && progressFile().leftSeconds < 30 && progressFile().unseenFamilies === 0 && progressFile().planSeconds === 0 && progressFile().made === Number(progressLines.at(-1)?.match(/progress: (\d+) of/)?.[1]) && progressFile().planned >= progressFile().made, [progressLines.slice(0, 2), progressLines.at(-1), progressFile()]);
  const kbPace = join(KB, KB_PACE_FILE);
  check("F-575 pace: a finished pull writes the seconds per call it measured, per family, beside the spec (pace.json, each family naming the run it was measured on) AND to the knowledge base's own engagement-pace.json at its root (the same families; the dashboards folder is the writer's to name), and the summary names both files",
    existsSync(join(dash(), PACE_FILE)) && Object.keys(readJson(join(dash(), PACE_FILE)).families).length >= 3 && Object.values(readJson(join(dash(), PACE_FILE)).families).every((x) => x.calls > 0 && x.seconds > 0 && x.run === refresh.json.run) && refresh.json.pace?.file === join(dash(), PACE_FILE) && refresh.json.pace.families >= 3 &&
      existsSync(kbPace) && refresh.json.pace.kbFile === kbPace && isDeepStrictEqual(Object.keys(readJson(kbPace).families).sort(), Object.keys(readJson(join(dash(), PACE_FILE)).families).sort()),
    [refresh.json?.pace, existsSync(join(dash(), PACE_FILE)) ? readJson(join(dash(), PACE_FILE)) : null]);
  // The overlay the plan reads: the knowledge base's file under the dashboard's own (the later wins), the constants under
  // both; a file that cannot be read is said and stands for nothing; a write merges family by family.
  const overlayDir = join(ROOT, "pace-overlay");
  mkdirSync(overlayDir, { recursive: true });
  writePaceFile(join(overlayDir, "kb.json"), "run-kb", { a: { calls: 2, seconds: 1 }, b: { calls: 1, seconds: 2 } });
  writePaceFile(join(overlayDir, "dash.json"), "run-dash", { b: { calls: 3, seconds: 5 }, zero: { calls: 1, seconds: 0 } });
  writePaceFile(join(overlayDir, "dash.json"), "run-dash-2", { c: { calls: 1, seconds: 7 } });
  writeFileSync(join(overlayDir, "broken.json"), "{not json");
  const said = [];
  check("F-575 pace overlay (the engine's one home): readPaceFiles lays the dashboard's file over the knowledge base's (b reads the dashboard's 5, a the knowledge base's 1), a later write merges by family (c joins b, run named per family), a 0-second family is never kept, and an unreadable file is said once and stands for nothing",
    isDeepStrictEqual(readPaceFiles([join(overlayDir, "kb.json"), join(overlayDir, "dash.json")]), { a: 1, b: 5, c: 7 }) && readJson(join(overlayDir, "dash.json")).families.b.run === "run-dash" && readJson(join(overlayDir, "dash.json")).families.c.run === "run-dash-2" && !("zero" in readJson(join(overlayDir, "dash.json")).families) &&
      isDeepStrictEqual(readPaceFiles([join(overlayDir, "broken.json"), join(overlayDir, "kb.json")], (l) => said.push(l)), { a: 1, b: 2 }) && said.length === 1 && /cannot be read/.test(said[0]) && readPaceFiles([join(overlayDir, "missing.json")]) === null,
    [readPaceFiles([join(overlayDir, "kb.json"), join(overlayDir, "dash.json")]), said]);
  // F-575 (4), the second reopen's redesign: a merge is the calls-weighted mean of the pace kept and the pace measured,
  // the kept weight capped at PACE_MEMORY_CALLS — never last writer wins. The arithmetic here is by hand.
  writePaceFile(join(overlayDir, "merge.json"), "run-1", { a: { calls: 2, seconds: 1 }, b: { calls: 100, seconds: 10 } });
  const merged = writePaceFile(join(overlayDir, "merge.json"), "run-2", { a: { calls: 2, seconds: 3 }, b: { calls: 50, seconds: 20 }, c: { calls: 1, seconds: 5 } });
  const m = readJson(join(overlayDir, "merge.json")).families;
  check("F-575 (4) the pace merge is the calls-weighted mean (a: 2 calls at 1 s then 2 at 3 s read 2 s over 4 calls), the kept weight capped at PACE_MEMORY_CALLS (b: 100 calls at 10 s weigh 50 against 50 at 20 s: 15 s, 50 calls kept), a family first seen taken as measured (c: 5 s, 1 call), every family naming the pull that moved it; the write hands back what the file holds and no failure",
    PACE_MEMORY_CALLS === 50 && m.a.seconds === 2 && m.a.calls === 4 && m.a.run === "run-2" && m.b.seconds === 15 && m.b.calls === 50 && m.b.run === "run-2" && m.c.seconds === 5 && m.c.calls === 1 && merged.written?.families.b.seconds === 15 && merged.left === null, m);
  mkdirSync(join(overlayDir, "dir.json"));
  const unwritable = writePaceFile(join(overlayDir, "dir.json"), "run-3", { a: { calls: 1, seconds: 1 } });
  check("F-563 a pace file that cannot be written (a folder in its place) is handed back as `left` (what 'pace file', the path, the cause, the one sentence), never thrown, with what it would have held beside it", unwritable.written?.families.a.seconds === 1 && unwritable.left?.what === "pace file" && unwritable.left.path === join(overlayDir, "dir.json") && typeof unwritable.left.why === "string" && unwritable.left.why.length > 0 && /^the pace file could not be written at .* and the run went on without it: /.test(unwritable.left.text), unwritable.left);
  check("the lookback says what it came from, a tie included (the first sitting's note): derivedFrom is the longest schedule period when it reached the threshold, else null with the threshold standing",
    (refresh.json?.pull?.lookbackDerivedFrom == null && refresh.json?.pull?.lookbackDays === 30) || (refresh.json?.pull?.lookbackDerivedFrom >= 30 && refresh.json.pull.lookbackDays === Math.min(366, refresh.json.pull.lookbackDerivedFrom)), refresh.json?.pull);
  check("re-documentation inside the refresh (PUB-1): the never-documented program and the one modified since its doc are described (one jo p describe each, through describe-batch) and marked documented with a fresh capture date; the templates the KB lacked are fetched the same way; the pull then read the moved knowledge base, so it is behind on nothing listed",
    refresh.json?.redocumented?.enabled === true && refresh.json.redocumented.programs.documented >= 2 && inv["journey/p-undoc"]?.status === "documented" && inv["journey/p-undoc"].last_verified > TODAY && inv["journey/p-behind"].last_verified > invBefore["journey/p-behind"].last_verified && existsSync(resolve(WS, inv["journey/p-undoc"].doc_path)) &&
      refresh.json.redocumented.templates.documented > 0 && Object.entries(inv).filter(([k, e]) => k.startsWith(`${TEMPLATES_DOMAIN}/`) && e.status === "documented" && e.last_verified > TODAY).length === refresh.json.redocumented.templates.documented && refresh.json.kbBehind?.behind?.length === 0 && refresh.json.redocumented.programs.stillBehind.length === 0 &&
      argvLines().slice(callsBeforeRefresh).filter((a) => a.includes("jo p describe --id p-undoc")).length === 1 && argvLines().slice(callsBeforeRefresh).filter((a) => a.includes("jo email template --id")).length === refresh.json.redocumented.templates.documented,
    [refresh.json?.redocumented, refresh.json?.kbBehind, inv["journey/p-undoc"], invBefore["journey/p-behind"]?.last_verified, inv["journey/p-behind"]?.last_verified]);
  const snapshot1 = openSnapshot(readJson(join(dash(), SNAPSHOTS_DIR, snap1[0])));
  check("the snapshot carries the spec's settings: the internal domain, the unsubscribe link, the test accounts as company ids, the customer lists with the per-segment one over the company field, the groups resolved; the page carries the theme and the data-pulled header with the age's region, and no stale banner",
    snapshot1.meta.params.internalDomains.join() === "acme.com" && snapshot1.meta.params.unsubscribeLinks.length === 1 && isDeepStrictEqual(snapshot1.meta.params.testAccounts, ["co-03", "co-09"]) && snapshot1.honesty.accountSelection.lists.some((l) => l.per === "Industry") && snapshot1.dimensions.accounts.every((a) => a.attrs?.Industry) &&
      snapshot1.dimensions.programs.every((x) => x.supergroup != null) && pageText("admin").includes("--accent:#0b57d0") && !pageText("exec").includes("co-03") && pageText("admin").includes(`<span data-region="age"></span>`) && pageText("admin").includes("These pages are not live") && !/gs-banner-stale|data-banner="stale"/.test(pageText("admin")), snapshot1.honesty.accountSelection);
  const status = run("status", [SLUG]);
  check("status: the last pull and its age, both pages present, no lock, nothing resumable; no 'next due', no cadence and no staleness (ruled 2026-10-12: refreshes are manual)", status.code === 0 && status.json.lastPull.pulledAt === snapshot1.meta.pulledAt && typeof status.json.lastPull.ageDays === "number" && status.json.pages.every((x) => x.present) && status.json.lock.held === false && status.json.resumable === null && !("nextDue" in status.json) && !("due" in status.json) && !("stale" in status.json) && !("staleAfterDays" in status.json) && !("cadence" in status.json), status.json);

  // ══ change: display-only → rebuild (no call); lists → re-selection; a pull setting → refresh ══
  const adminBefore = pageText("admin");
  const callsBeforeChange = argvLines().length;
  const dryChange = run("change", [SLUG, 'pages.0.title="Admin view"', "--dry-run"]);
  check("change --dry-run: prints what changed and its consequence (a title is a rebuild) and stops: nothing saved, no draft left, no page touched", dryChange.code === 0 && dryChange.json.consequence === "rebuild" && dryChange.json.saved === false && !existsSync(draftFile()) && openSpec(readJson(specFile())).pages[0].title === "Admin" && pageText("admin") === adminBefore, dryChange.json);
  const titled = run("change", [SLUG, 'pages.0.title="Admin view"']);
  check("change (display-only): saved, the replaced spec kept as one previous copy, the pages rebuilt from the last snapshot with no pull and no call; the new title is on the page",
    titled.code === 0 && titled.json.consequence === "rebuild" && titled.json.done.kind === "rebuild" && titled.json.done.pages.length === 2 && argvLines().length === callsBeforeChange && pageText("admin").includes("Admin view") && existsSync(`${specFile()}.previous`) && snapshots().length === 1, titled.json);
  const purposed = run("change", [SLUG, 'purpose="Which programs need attention this month."']);
  check("change (the purpose, no longer asked: ruling 2): a sentence set through change is a rebuild and shows on the About tab as its own paragraph",
    purposed.code === 0 && purposed.json.consequence === "rebuild" && pageText("admin").includes(`<p class="gs-purpose">Which programs need attention this month.</p>`) && argvLines().length === callsBeforeChange, purposed.json);
  const relisted = run("change", [SLUG, 'accounts.lists=[{"kind":"most-bounced","n":2,"floor":0}]']);
  const snapshot1b = openSnapshot(readJson(join(dash(), SNAPSHOTS_DIR, snap1[0])));
  check("change (the customer lists): a re-selection from the account store beside the last pull (F-548: no pull, no run directory): the snapshot's selection record now holds the one list of 2 and the pages are rebuilt",
    relisted.code === 0 && relisted.json.consequence === "reselect" && relisted.json.done.done === true && isDeepStrictEqual(relisted.json.done.lists, [{ kind: "most-bounced", kept: 2 }]) && argvLines().length === callsBeforeChange && snapshot1b.honesty.accountSelection.lists.length === 1 && snapshot1b.honesty.accountSelection.lists[0].kept.length === 2, relisted.json);
  // The last plan is the one the latest snapshot was pulled from (its run directory, the derived-lookback one), never
  // the preview's or an older plan's.
  const lastPlanBefore = JSON.parse(readFileSync(join(WS, ".gs-superadmin", "tmp", "engagement", refresh.json.run, "plan.json"), "utf8"));
  const priced = run("change", [SLUG, "sources.0.params.stepDetail=true", "--dry-run"]);
  // The quoted price is the last plan's parts at TODAY's pace (F-575, the owed item): the plan priced its families at
  // the pace known when it was made (the constants, before any pull); the pull it planned then wrote both pace files.
  // Priced here independently of the engine, from the files AS THE DRY RUN SAW THEM (before the pull below rewrites
  // them): the plan's own calls by family (full.byFamily) at the constants with the two pace files laid over them (the
  // dashboard's over the knowledge base's, a positive seconds figure only), and what step detail adds scaled by the
  // same ratio — never the plan's figure as written.
  const paceNow = (() => { const t = { ...CALL_SECONDS }; for (const f of [kbPace, join(dash(), PACE_FILE)]) for (const [fam, x] of Object.entries(readJson(f).families)) if (x.seconds > 0) t[fam] = x.seconds; return t; })();
  const pulled = run("change", [SLUG, "sources.0.params.stepDetail=true"]);
  const snap2 = snapshots();
  const fullNow = Math.round(Object.entries(lastPlanBefore.estimate.full.byFamily).reduce((s, [f, n]) => s + n * (paceNow[f] ?? 7), 0) * 100) / 100;
  const fullAtPlan = Math.round(Object.entries(lastPlanBefore.estimate.full.byFamily).reduce((s, [f, n]) => s + n * (lastPlanBefore.estimate.secondsPerCall[f] ?? 7), 0) * 100) / 100;
  const stepNow = Math.round(lastPlanBefore.estimate.stepDetail.addsSeconds * (fullNow / lastPlanBefore.estimate.full.seconds) * 100) / 100;
  check("change (a pull setting): the consequence is a new pull priced for the spec AFTER the change (F-511 instance 24: the last plan's seconds plus what step detail adds, not the old plan's figure) at TODAY's pace (F-575: the plan's calls by family at the pace files as they stand — a straight sum here, with the plan's recorded table reproducing its own figure exactly), and the refresh runs: a second snapshot, the step-detail switch changing forces a full one, the delta against the first pull wired to the pages",
    priced.code === 0 && Math.abs(fullAtPlan - lastPlanBefore.estimate.full.seconds) < 0.01 && fullNow !== lastPlanBefore.estimate.full.seconds && priced.json.pullSeconds === Math.round(fullNow + stepNow) && priced.json.consequenceText === `the next refresh pulls everything again, about ${Math.max(1, Math.round(priced.json.pullSeconds / 60)) === 1 ? "1 minute" : `${Math.max(1, Math.round(priced.json.pullSeconds / 60))} minutes`}` &&
      pulled.code === 0 && pulled.json.consequence === "pull" && /about \d+ minute/.test(pulled.json.consequenceText) && pulled.json.done.kind === "refresh" && pulled.json.done.status === "ok" && snap2.length === 2 && pulled.json.done.pull.mode === "full" && /step-detail switch changed/.test(pulled.json.done.pull.why) &&
      pulled.json.done.delta?.previousPulledAt === snapshot1.meta.pulledAt && pageText("admin").includes("Change since the last refresh (pulled") && pageText("exec").includes("Since last pull:"), [priced.json?.pullSeconds, { fullNow, fullAtPlan, stepNow, expected: Math.round(fullNow + stepNow), planFull: lastPlanBefore.estimate?.full?.seconds, planStep: lastPlanBefore.estimate?.stepDetail }, pulled.json?.consequenceText, pulled.json?.done?.pull]);
  const identity = run("change", [SLUG, 'tenantHost="acme--sbx.gainsightcloud.com"']);
  check("change refuses an identity setting (the tenant, the slug)", identity.code === 1 && /cannot be changed/.test(identity.json?.error ?? ""), identity.json);
  // F-576 (reopened on pages[].statusDefault, covered both bare and as a list): the judge is the writer's own covers,
  // not a hand list — EVERY path the writer covers as a list reads the comma form as a list, whatever else covers it.
  const listCovers = SPEC_DESCRIPTIONS.flatMap((d) => d.covers).filter((c) => c.endsWith("[]") && !c.includes("{}"));
  const concretePath = (cover) => cover.slice(0, -2).replace(/\[\]/g, ".0");
  const notLists = listCovers.filter((c) => !Array.isArray(changeValue(concretePath(c), "a,b")));
  check("F-576: the comma form is read as a list for EVERY path the writer covers as a list (the covers walked, not a hand list: the programs selector's two lists, the pinned accounts, a page's statusDefault — covered bare as well — among them); `none` empties; a scalar under the selector stays text",
    listCovers.length >= 10 && notLists.length === 0 && isDeepStrictEqual(changeValue("pages.0.statusDefault", "PROCESSING,PAUSED"), ["PROCESSING", "PAUSED"]) && isDeepStrictEqual(changeValue("sources.0.params.selector.ids", "p1,p2"), ["p1", "p2"]) && isDeepStrictEqual(changeValue("sources.0.params.selector.names", "none"), []) && changeValue("sources.0.params.selector.sentSince", "90d") === "90d" && changeValue("pages.0.title", "Admin view") === "Admin view",
    [listCovers.length, notLists, changeValue("pages.0.statusDefault", "PROCESSING,PAUSED")]);
  // F-576 (the second reopen): the writer's declaration is read BEFORE anything is parsed, so a one-item value that
  // happens to be JSON reaches a list setting as one item, never a scalar; `null` stays the writer's own empty.
  check("F-576 (second reopen) a one-item value that is valid JSON reaches a list setting as ONE item (a program named 2024 in selector.names, `true` in selector.ids, 7 in a page's statusDefault — refused later by the writer as a status, but a list), `null` is the writer's own empty for a page's statusDefault, a JSON array is handed over whole, a boolean kind still reads as one, and a text kind keeps JSON's reading of a quoted string",
    isDeepStrictEqual(changeValue("sources.0.params.selector.names", "2024"), ["2024"]) && isDeepStrictEqual(changeValue("sources.0.params.selector.ids", "true"), ["true"]) && isDeepStrictEqual(changeValue("pages.0.statusDefault", "7"), ["7"]) && changeValue("pages.0.statusDefault", "null") === null && isDeepStrictEqual(changeValue("accounts.lists", '[{"kind":"most-bounced","n":2,"floor":0}]'), [{ kind: "most-bounced", n: 2, floor: 0 }]) && changeValue("accounts.pull", "true") === true && changeValue("pages.0.title", '"Admin view"') === "Admin view" && isDeepStrictEqual(changeValue("sources.0.params.selector.names", '"Onboarding"'), ["Onboarding"]),
    [changeValue("sources.0.params.selector.names", "2024"), changeValue("sources.0.params.selector.ids", "true"), changeValue("pages.0.statusDefault", "7"), changeValue("accounts.lists", '[{"kind":"most-bounced","n":2,"floor":0}]'), changeValue("accounts.pull", "true"), changeValue("pages.0.title", '"Admin view"')]);

  // ══ --health-only, and the lock ═══════════════════════════════════════════
  const callsBeforeHealth = argvLines().length;
  const healthOnly = run("refresh", [SLUG, "--health-only"]);
  check("refresh --health-only: a selective pull that reads the current month's facts again with the health families and carries the rest (fewer calls than the full pull), then rebuilds", healthOnly.code === 0 && healthOnly.json.healthOnly === true && healthOnly.json.pull.mode === "selective" && snapshots().length === 3 && healthOnly.json.pull.calls.made < pulled.json.done.pull.calls.made && argvLines().length > callsBeforeHealth, [healthOnly.json?.pull, pulled.json?.done?.pull?.calls]);
  writeFileSync(join(dash(), LOCK_FILE), JSON.stringify({ by: "ben", at: new Date().toISOString(), pid: process.pid }));
  const locked = run("refresh", [SLUG]);
  check("the lock: a second refresh is refused naming the holder and the time, before any call", locked.code === 1 && /already running: started by ben at /.test(locked.json?.error ?? "") && snapshots().length === 3, locked.json);
  const staleAt = new Date(Date.now() - LOCK_STALE_MS - 60000).toISOString();
  writeFileSync(join(dash(), LOCK_FILE), JSON.stringify({ by: "ben", at: staleAt, pid: 1 }));
  // F-513: the budget gate is gone. A login shorter than the pull is not refused: the pull runs as far as the token
  // allows (here the stand-in CLI kills the token after six calls), stops with exit 3 keeping its calls, and the stop
  // says how many more logins it needs; the stale lock it took over is recorded in that refusal (the first sitting's note).
  // F-575 pricing: the plan prices from the dashboard's pace file. A fixture pace of every family at k times its constant
  // prices the same full pull at k times the price: two plans of one stopped run, the file rewritten between them (the
  // stand-in CLI's own measured pace, written by the pull above, is far under the constants, and this arm's login must
  // be shorter than the pull). The fixture covers every family the full pull above planned, not only the ones with a
  // fitted constant: a family with none is priced at the engine's flat 7 s until a pull measures it.
  const pulledFamilies = Object.keys(readJson(join(runsRoot, pulled.json.done.run, "plan.json")).estimate.thisRun.byFamily);
  const paceTable = (k) => ({ measuredAt: new Date().toISOString(), families: Object.fromEntries([...new Set([...Object.keys(CALL_SECONDS), ...pulledFamilies])].map((f) => [f, { calls: 1, seconds: (CALL_SECONDS[f] ?? 7) * k, run: "fixture" }])) });
  writeFileSync(join(dash(), PACE_FILE), JSON.stringify(paceTable(2)));
  const shortLogin = run("refresh", [SLUG], { tenant: { ...TENANT, token: { state: "valid", seconds: 60 } }, env: { FAKE_FAULTS: JSON.stringify([{ match: "rp run", kind: "auth", skip: 30, times: 9999 }]) } });
  check("F-513 a pull longer than the login is NOT refused at the gate: it starts (stderr says it will take more logins), stops cleanly on the token with exit 3 after the calls it could make, names the login to run and that the next run continues it, says about how many more logins, and keeps its run resumable; the stale lock it took over is recorded in the refusal and released; no snapshot",
    shortLogin.code === EXIT["token-expired"] && shortLogin.json?.status === "token-expired" && /the refresh stopped after \d+ calls this run/.test(shortLogin.json.error) && /run gs-admin login, then run `node .gs-superadmin.plugin.scripts.dashboard.mjs refresh acme-health --kb acme-prod` again: it continues where it stopped/.test(shortLogin.json.error) && /about \d+ more logins? of an hour to finish/.test(shortLogin.json.error) &&
      /will run as far as the login allows \(about \d+ logins? of an hour in all\)/.test(shortLogin.stderr) && isDeepStrictEqual(shortLogin.json.lockTakenOver, { by: "ben", at: staleAt }) && /a stale lock held by ben since/.test(shortLogin.json.error) && /took over a stale refresh lock of "acme-health" held by ben since/.test(shortLogin.stderr) && !existsSync(join(dash(), LOCK_FILE)) && existsSync(join(dash(), STATE_FILE)) && snapshots().length === 3, shortLogin.json);
  const stoppedState = readJson(join(dash(), STATE_FILE));
  const planA = readJson(join(runsRoot, stoppedState.pullRun ?? stoppedState.run, "plan.json"));
  const stoppedStatus = run("status", [SLUG]);
  check("F-575 status relays the stopped (or running) run's latest progress record (the skill answers 'how long is left' from it, never from the plan or the run directory)",
    stoppedStatus.code === 0 && typeof stoppedStatus.json.progress?.made === "number" && typeof stoppedStatus.json.progress.leftSeconds === "number" && stoppedStatus.json.progress.planned >= stoppedStatus.json.progress.made && typeof stoppedStatus.json.progress.at === "string", stoppedStatus.json?.progress);
  writeFileSync(join(dash(), PACE_FILE), JSON.stringify(paceTable(4)));
  writeFileSync(join(dash(), LOCK_FILE), JSON.stringify({ by: "ben", at: staleAt, pid: 1 }));
  const stale = run("refresh", [SLUG]);
  check("after a login the same refresh RESUMES the stopped pull to a completed one (F-513: save → stop → resume), reusing the calls made, and a lock older than two hours is stale: the refresh takes it over and says whose it was",
    stale.code === 0 && stale.json.resumed === true && stale.json.pull.calls.reused > 0 && stale.json.lockTakenOver?.by === "ben" && !existsSync(join(dash(), LOCK_FILE)) && !existsSync(join(dash(), STATE_FILE)) && snapshots().length === 4, stale.json?.lockTakenOver ?? stale.json);
  const planB = readJson(join(runsRoot, stale.json.run, "plan.json"));
  check("F-575 pricing: every price the plan quotes reads the dashboard's measured pace — the resume's plan, with the pace file at four times each constant, prices the full pull and this run at exactly twice the stopped run's plan (the file at twice), and the finished pull then writes the pace it measured over the fixture, family by family",
    planA.estimate.full.seconds > 0 && planB.estimate.full.seconds === 2 * planA.estimate.full.seconds && planB.estimate.thisRun.seconds === 2 * planA.estimate.thisRun.seconds &&
      Object.values(readJson(join(dash(), PACE_FILE)).families).some((x) => x.run === stale.json.run) && Object.values(readJson(join(dash(), PACE_FILE)).families).some((x) => x.run === "fixture"), [planA.estimate?.full, planB.estimate?.full, planA.estimate?.thisRun?.seconds, planB.estimate?.thisRun?.seconds]);
  // F-518 a: the resume prices the REMAINDER, never the whole plan: its budget is below the plan's by the reused share,
  // it says it is continuing, and the stopped run before it (nothing reused yet) priced the whole run.
  check("F-518 a: a resumed run's budget is the remainder (neededSeconds below the plan's seconds by the share already made, continuing true, the logins for the remainder), its stderr says it is continuing and what remains of what; the fresh run before it priced the whole plan (needed equal to the plan's)",
    stale.json.budget?.continuing === true && stale.json.budget.neededSeconds < stale.json.budget.planSeconds && stale.json.budget.neededSeconds > 0 && stale.json.budget.loginsNeeded === 1 &&
      /continuing the refresh of "acme-health" \(run [^)]+\): about \d+ minutes? of its \d+ minutes remain, the calls already made are reused; the login has \d+ minutes? left/.test(stale.stderr) &&
      shortLogin.json.budget == null && /the refresh needs about \d+ minutes/.test(shortLogin.stderr), [stale.json.budget, stale.stderr.split("\n").find((l) => l.includes("continuing"))]);
  // F-512 (reopened 2026-10-12): a pull-affecting change between a stopped pull and its resume. The pending run's
  // parameters moved, so it is abandoned and the pull planned afresh — never refused as "started with different
  // parameters", and no state file to remove by hand.
  // Both commands share one clock (`--now`), so the fresh run's second-stamped name COLLIDES with the abandoned run's
  // (what CI's fast runner did on 2026-10-12 with the wall clock): the fresh run must take a name no directory holds.
  const sameSecond = ["--now", "2026-09-15T18:00:00.000Z"];
  const stoppedAgain = run("refresh", [SLUG, "--full", ...sameSecond], { env: { FAKE_FAULTS: JSON.stringify([{ match: "rp run", kind: "auth", skip: 30, times: 9999 }]) } });
  const pendingRun = readJson(join(dash(), STATE_FILE)).run;
  const listsOff = run("change", [SLUG, "accounts.pull=false", ...sameSecond]);
  check("F-512 save → stop → a change of a pull setting → refresh to a COMPLETED pull: the change's own refresh abandons the pending run (its parameters moved), says so, plans afresh under a name no directory holds (the abandoned run's name plus a suffix when the clock gives the same second) and completes; the state file is gone and no hand-removal was needed",
    stoppedAgain.code === EXIT["token-expired"] && pendingRun != null && listsOff.code === 0 && listsOff.json.consequence === "pull" && listsOff.json.done.kind === "refresh" && listsOff.json.done.status === "ok" && listsOff.json.done.abandoned?.run === pendingRun && /accounts moved/.test(listsOff.json.done.abandoned.why) && listsOff.json.done.run !== pendingRun && listsOff.json.done.run.startsWith(`${pendingRun}-`) && !existsSync(join(dash(), STATE_FILE)) && snapshots().length === 5 && openSpec(readJson(specFile())).accounts.pull === false,
    [stoppedAgain.json?.status, pendingRun, listsOff.json?.done?.run, listsOff.json?.done?.abandoned, listsOff.json?.done?.status, listsOff.json?.error]);
  const listsBack = run("change", [SLUG, "accounts.pull=true"]);
  check("(the walk's lists back on for what follows)", listsBack.code === 0 && listsBack.json.done.status === "ok" && snapshots().length === 6, listsBack.json?.error);

  // ══ The wrong tenant, before any call; the expired token leaving the pages ══
  const callsBeforeWrong = argvLines().length;
  const wrong = run("refresh", [SLUG], { tenant: { ...TENANT, baseUrl: "https://acme--sbx.gainsightcloud.com" } });
  check("the tenant: with the CLI on another tenant the refresh is refused with its own exit code before any tenant call (whoami alone was made), naming both tenants", wrong.code === EXIT["wrong-tenant"] && wrong.json?.status === "wrong-tenant" && /acme--sbx\.gainsightcloud\.com, and this dashboard belongs to acme\.gainsightcloud\.com/.test(wrong.json.error) && argvLines().slice(callsBeforeWrong).every((a) => a === "whoami"), wrong.json);
  const pagesBefore = { admin: pageText("admin"), exec: pageText("exec") };
  const countBefore = snapshots().length;
  const expired = run("refresh", [SLUG, "--full"], { env: { FAKE_FAULTS: JSON.stringify([{ match: "rp run", kind: "auth", skip: 6, times: 9999 }]) } });
  check("the expired token: the refresh stops with exit 3, writes no snapshot, leaves both pages byte-identical, and records a resumable run", expired.code === EXIT["token-expired"] && expired.json?.status === "token-expired" && snapshots().length === countBefore && pageText("admin") === pagesBefore.admin && pageText("exec") === pagesBefore.exec && readJson(join(dash(), STATE_FILE)).full === true && !existsSync(join(dash(), LOCK_FILE)), expired.json);
  const resumedStatus = run("status", [SLUG]);
  const otherFlags = run("refresh", [SLUG]);
  check("a stopped run is never abandoned silently: a retry with other flags is refused naming the run, its flags and how to start over", otherFlags.code === 1 && /is waiting to resume: run it again with the same flags/.test(otherFlags.json?.error ?? "") && /--full/.test(otherFlags.json.error) && existsSync(join(dash(), STATE_FILE)), otherFlags.json);
  const resumed = run("refresh", [SLUG, "--full"]);
  check("after a login the same refresh resumes its run (status named it; the calls already answered are not made again) and finishes", resumedStatus.json?.resumable?.run != null && resumed.code === 0 && resumed.json.resumed === true && resumed.json.pull.calls.reused > 0 && snapshots().length === countBefore + 1 && !existsSync(join(dash(), STATE_FILE)), [resumedStatus.json?.resumable, resumed.json?.pull?.calls]);

  // ══ F-519: a call the adapter gave up on is a fresh attempt on the next run, never replayed as final ══
  // The survey participants count has nothing to split on. The stand-in times it out three times in a row (the fault
  // counter persists across invocations): the first run's attempt and retry fail, so the run stops partial naming the
  // call; the resume makes it afresh, its first attempt fails again (the third fault) and its retry answers.
  rmSync(join(STATE, "faults.json"), { force: true });
  const UNSPLITTABLE = '"to":"ao_participants"}]}}] --where-filters {"conditions":[{"leftOperand":{"fieldName":"TestParticipant"},"operator":"EQ","rightOperand":{"value":false}}]}';
  const countBeforeTimeout = snapshots().length;
  const timedOut = run("refresh", [SLUG], { env: { FAKE_FAULTS: JSON.stringify([{ match: UNSPLITTABLE, kind: "timeout", times: 3 }]) } });
  // The pull's own status: the run the state file names, or its re-planned twin (`<run>-lb<days>`, the one the pull resumes).
  const runStatus = () => {
    const root = join(WS, ".gs-superadmin", "tmp", "engagement");
    const run = readJson(join(dash(), STATE_FILE)).run;
    const all = readdirSync(root).filter((d) => d === run || d.startsWith(`${run}-lb`)).map((d) => join(root, d, "status.json")).filter(existsSync).map(readJson);
    return all.find((s) => s.phase === "all") ?? all[0] ?? null;
  };
  const partialStatus = timedOut.code === EXIT.partial && existsSync(join(dash(), STATE_FILE)) ? runStatus() : null;
  check("F-519: a refresh stopped on an unsplittable timeout exits 4 (partial, resumable) and its message says WHAT failed (the family, a server timeout), that the next run retries it, and has no empty slot; the run's status names the call with the run it failed in; the pages and the snapshots are untouched",
    timedOut.code === EXIT.partial && timedOut.json?.status === "partial" && /the refresh stopped after \d+ calls this run( \(\d+ reused from before\))?: 1 call failed: resp-participants timed out on the server twice \(a server timeout\) — run `node .gs-superadmin.plugin.scripts.dashboard.mjs refresh acme-health --kb acme-prod` again: it retries what failed and continues where it stopped; the last good pages are untouched/.test(timedOut.json.error) &&
      !/partial —  run/.test(timedOut.json.error) && partialStatus?.status === "partial" && partialStatus.failed.length === 1 && partialStatus.failed[0].family === "resp-participants" && partialStatus.failed[0].kind === "timeout" && partialStatus.failed[0].runs === 1 && snapshots().length === countBeforeTimeout,
    [timedOut.json?.error, partialStatus?.failed]);
  const retried = run("refresh", [SLUG], { env: { FAKE_FAULTS: JSON.stringify([{ match: UNSPLITTABLE, kind: "timeout", times: 3 }]) } });
  check("F-519: the resume RE-RUNS the failed call as a fresh attempt (the stand-in answering on its retry: calls.retried above 0) and completes the pull with exit 0, a new snapshot and no state file — one transient timeout cost one more run, not the dashboard",
    retried.code === 0 && retried.json?.status === "ok" && retried.json.resumed === true && retried.json.pull.calls.retried > 0 && retried.json.pull.calls.reused > 0 && snapshots().length === countBeforeTimeout + 1 && !existsSync(join(dash(), STATE_FILE)) &&
      argvLines().slice(-40).filter((a) => a.includes(UNSPLITTABLE)).length >= 2, [retried.json?.error, retried.json?.pull?.calls]);
  // A timeout that recurs run after run is said to recur: the second partial stop counts the runs.
  rmSync(join(STATE, "faults.json"), { force: true });
  const again = run("refresh", [SLUG, "--full"], { env: { FAKE_FAULTS: JSON.stringify([{ match: UNSPLITTABLE, kind: "timeout", times: 4 }]) } });
  const againTwice = run("refresh", [SLUG, "--full"], { env: { FAKE_FAULTS: JSON.stringify([{ match: UNSPLITTABLE, kind: "timeout", times: 4 }]) } });
  const recurringStatus = againTwice.code === EXIT.partial ? runStatus() : null;
  const answeredAtLast = run("refresh", [SLUG, "--full"]);
  check("F-519: a timeout that recurs across runs is reported as recurring — the second partial stop says the call failed in 2 runs so far, and the status's entry counts the same; a later run on which the server answers completes it",
    again.code === EXIT.partial && againTwice.code === EXIT.partial && / in 2 runs so far/.test(againTwice.json?.error ?? "") && !/ in 2 runs so far/.test(again.json?.error ?? "") && recurringStatus?.failed?.[0]?.runs === 2 && answeredAtLast.code === 0 && !existsSync(join(dash(), STATE_FILE)),
    [again.json?.error, againTwice.json?.error, recurringStatus?.failed]);

  // ══ F-523: every remedy line the entry command prints runs AS PRINTED ══
  // The class: a remedy line no check executes can name a command the same tool refuses (a stopped --full refresh
  // printed "run refresh <x> again", which the tool then refused for want of --full). So each stop and refusal this
  // suite can provoke is provoked, the line between backticks in its message is read out (it must equal the
  // summary's `remedy.line`), and that line is RUN — its words as printed, from the workspace folder, after the
  // "login" (the fault removed) — with only the stand-in's harness flags added. A line the tool then refuses fails.
  {
    const harness = ["--workspace", WS, "--bin", FAKE, "--today", TODAY, "--by", "ana"];
    const printed = (out) => /`(node \.gs-superadmin\/plugin\/scripts\/dashboard\.mjs [^`]+)`/.exec(out.json?.error ?? "")?.[1] ?? null;
    const runPrinted = (line) => {
      const words = line.split(" ");
      if (words.some((w) => /['"\\$]/.test(w)) || words[0] !== "node") return { code: -1, json: null };
      const r = runNode(SCRIPT, [...words.slice(2), ...harness], { cwd: WS, env: { ...process.env, FAKE_STATE: STATE, FAKE_TENANT: JSON.stringify(TENANT) } });
      let json = null;
      try { json = JSON.parse(r.stdout); } catch { /* a stack trace */ }
      return { code: r.status, json };
    };
    const cases = [];
    const record = (name, out, { login, flags }) => {
      const line = printed(out);
      const ran = line ? runPrinted(line) : { code: -1, json: null };
      cases.push({ name, stopped: out.code, line, same: line === out.json?.remedy?.line, login: out.json?.remedy?.login === login, flags: flags.every((f) => line?.split(" ").includes(f)) && line?.includes("--kb acme-prod"), ranCode: ran.code, ranError: ran.json?.error ?? null });
    };
    rmSync(join(STATE, "faults.json"), { force: true });
    // 1. The stop on the token, mid-pull, of a --full refresh (the instance F-523 reported).
    const tokenStop = run("refresh", [SLUG, "--full"], { env: { FAKE_FAULTS: JSON.stringify([{ match: "rp run", kind: "auth", skip: 6, times: 9999 }]) } });
    // 2. While it waits, a refresh without the flag is refused naming the run: its remedy carries the run's flag.
    const waiting = run("refresh", [SLUG]);
    record("waiting to resume", waiting, { login: false, flags: ["--full"] });
    record("the stop on the token (--full)", tokenStop, { login: true, flags: ["--full"] });
    // 3. The partial stop (a call that fails twice) of a --health-only refresh.
    rmSync(join(STATE, "faults.json"), { force: true });
    const partial = run("refresh", [SLUG, "--health-only"], { env: { FAKE_FAULTS: JSON.stringify([{ match: UNSPLITTABLE, kind: "timeout", times: 2 }]) } });
    record("the partial stop (--health-only)", partial, { login: false, flags: ["--health-only"] });
    // 4. The stop during re-documentation: a program documented before its last edit, and the login dying under its describe.
    const m = readJson(join(KB, "_manifest.json"));
    m.inventory["journey/p-behind"].last_verified = "2020-01-01T00:00:00.000Z";
    writeFileSync(join(KB, "_manifest.json"), JSON.stringify(m, null, 2));
    rmSync(join(STATE, "faults.json"), { force: true });
    const redoc = run("refresh", [SLUG, "--full"], { env: { FAKE_FAULTS: JSON.stringify([{ match: "jo p describe --id p-behind", kind: "auth", times: 9999 }]) } });
    record("the stop during re-documentation (--full)", redoc, { login: true, flags: ["--full"] });
    // 5. The refusal before any call, on a login already expired (the budget gate's place since F-513: whoami's token).
    const expiredLogin = run("refresh", [SLUG, "--health-only"], { tenant: { ...TENANT, token: { state: "expired" } } });
    record("the refusal on an expired login (--health-only)", expiredLogin, { login: true, flags: ["--health-only"] });
    rmSync(join(STATE, "faults.json"), { force: true });
    check("F-523 every remedy the refresh prints runs AS PRINTED: the waiting-to-resume refusal, the stop on the token, the partial stop, the stop during re-documentation and the refusal on an expired login each print the full line in backticks (the entry command, --kb and the run's own flags), equal to the summary's remedy.line, with login said where a login comes first; and each line, run as printed from the workspace folder after the login, is accepted and finishes (exit 0)",
      waiting.code === 1 && tokenStop.code === EXIT["token-expired"] && partial.code === EXIT.partial && redoc.code === EXIT["token-expired"] && /re-documentation/.test(redoc.json?.error ?? "") && expiredLogin.code === EXIT["token-expired"] &&
        cases.length === 5 && cases.every((c) => c.line && c.same && c.login && c.flags && c.ranCode === 0),
      { cases, codes: [waiting.code, tokenStop.code, partial.code, redoc.code, expiredLogin.code], redoc: redoc.json?.error });
  }

  // ══ An account's timeline (ACC-2): the dashboard's settings, its latest snapshot, a page of its own ══
  {
    const latest = readJson(join(dash(), SNAPSHOTS_DIR, snapshots().at(-1)));
    const spec = openSpec(readJson(specFile()));
    const kept = latest.dimensions.accounts.map((a) => a.key).find((k) => !spec.sources[0].params.testAccounts.includes(k) && latest.facts.byAccount.some((r) => r.accountKey === k && r.month === "2026-07" && r.sent > 0));
    const before = argvLines().length;
    const acct = run("account", [SLUG, "--account-id", kept]);
    const made = argvLines().slice(before);
    const page = join(dash(), ACCOUNTS_DIR, `account-${kept}.html`);
    const matches = acct.json?.reconciliation?.find((c) => c.id === "matches-dashboard");
    check("ACC-2 account <slug>: the tenant checked first (whoami), the adapter's account-history pull with the dashboard's recipient classes, a timeline file and a self-contained page beside the dashboard's pages, reconciled against its latest snapshot by recipient class — closed months equal",
      acct.code === 0 && acct.json.mode === "account" && acct.json.account.key === kept && made[0] === "whoami" && existsSync(page) && existsSync(page.replace(/[.]html$/, ".json")) && acct.json.againstSnapshot === snapshots().at(-1) &&
        matches?.ok === true && matches.compared > 0 && acct.json.against?.basis === "class" && isDeepStrictEqual(readJson(page.replace(/[.]html$/, ".json")).meta.params.internalDomains, spec.sources[0].params.internalDomains) &&
        made.every((a) => a === "whoami" || /^--json (rp (run|schema)|jo p (list|describe)) /.test(a)) && readFileSync(page, "utf8").includes(`dashboard.mjs account ${SLUG} --account-id ${kept} --kb acme-prod`),
      [kept, acct.json ?? acct.stderr.slice(-400)]);
    check("ACC-2 the timeline page takes the dashboard's look (its theme's tokens and logo, when the dashboard has them) and names no contact", !spec.theme || (readFileSync(page, "utf8").includes(spec.theme.logo ?? "") && !/[\w.+-]+@[\w-]+\.[\w.]+/.test(readFileSync(page, "utf8").split('<script type="module">')[0])));
    const pick = run("account", [SLUG, "--account-name", "Acme Customer 05"]);
    check("ACC-2 a name two accounts share answers with a pick list and its own exit code: each candidate's GSID and sends over the same days, nothing pulled and no page written",
      pick.code === EXIT["needs-pick"] && pick.json?.status === "needs-pick" && isDeepStrictEqual(pick.json.resolution?.candidates.map((c) => c.key), ["co-05", "co-13"]) && /pick one by its GSID/.test(pick.json.error) &&
        !existsSync(join(dash(), ACCOUNTS_DIR, "account-co-13.html")), pick.json);
    const flagged = run("account", [SLUG, "--account-id", kept, "--internal-domain", "other.example"]);
    check("ACC-2 with a dashboard named its settings decide who is internal: a recipient-class flag beside it is refused, naming why", flagged.code === 1 && /decides who is internal/.test(flagged.json?.error ?? ""), flagged.json);
    const beforeWrong = argvLines().length;
    const wrongTenant = run("account", [SLUG, "--account-id", kept], { tenant: { ...TENANT, baseUrl: "https://acme--sbx.gainsightcloud.com" } });
    check("ACC-2 the wrong tenant is refused before any tenant call, with its own exit code", wrongTenant.code === EXIT["wrong-tenant"] && argvLines().slice(beforeWrong).every((a) => a === "whoami"), wrongTenant.json);
    const stopped = run("account", [SLUG, "--account-id", kept, "--last", "6m"], { env: { FAKE_FAULTS: JSON.stringify([{ match: "rp run", kind: "auth", skip: 2, times: 9999 }]) } });
    const continued = run("account", [SLUG, "--account-id", kept, "--last", "6m"]);
    check("ACC-2 a timeline pull the login runs out under stops with exit 3 and the same line continues it after a login, reusing what it had",
      stopped.code === EXIT["token-expired"] && /run gs-admin login, then run the same line again/.test(stopped.json?.error ?? "") && continued.code === 0 && continued.json.calls.reused > 0 && continued.json.window.last === "6 months", [stopped.json, continued.json?.calls]);
    const adhoc = run("account", ["--account-id", "co-14", "--internal-domain", "acme.com"]);
    check("ACC-2 with no dashboard named the flags decide, the knowledge base's tenant is checked, nothing is reconciled, and the files go to reports-adhoc; an account nothing reached is a timeline of nothing, said",
      adhoc.code === 0 && adhoc.json.slug === null && adhoc.json.sent === 0 && adhoc.json.against === null && existsSync(join(KB, "reports-adhoc", "account-co-14.html")) && /No Journey Orchestrator email reached this account/.test(readFileSync(join(KB, "reports-adhoc", "account-co-14.html"), "utf8")), adhoc.json ?? adhoc.stderr.slice(-300));
  }

  // ══ An edit of the saved dashboard (F-516), the draft take-over, list, report, health, export and import ══
  const edit = run("new", [SLUG]);
  const asBen = common.slice(0, -2);
  const theirs = run("next", [SLUG], { flags: [...asBen, "--by", "ben"] });
  const taken = run("next", [SLUG], { flags: [...asBen, "--by", "ben", "--take-over"] });
  check("the draft's holder: an edit started by ana is refused to ben at next, naming ana and the time, and continues for ben with --take-over", edit.json?.state === "editing-saved" && theirs.code === 1 && /held by ana \(last changed /.test(theirs.json?.error ?? "") && taken.code === 0 && readJson(draftFile()).by === "ben", [theirs.json, taken.json?.question?.id]);
  // F-516: `new` over a saved spec marks every setting answered, so `next` goes straight to the closing step with
  // nothing re-asked; with nothing changed yet the step says so and offers no refresh; `next --question <id>` is the
  // way to change one setting, after which the closing step states the consequence and its first option DOES it.
  const callsBeforeEdit = argvLines().length;
  const editNext = run("next", [SLUG], { flags: [...asBen, "--by", "ben"] });
  check("F-516 new over a saved spec → next goes to the closing step with nothing re-asked: every setting marked answered (programs through expected-reasons), the first question returned is an action row with the closing block, the step says nothing changed and offers no refresh (close the edit, a dry run, go back), and no plan was made for it (no call)",
    edit.json.answered.length === 15 && edit.json.answered.includes("programs") && edit.json.answered.includes("leaders-copy") && !edit.json.answered.includes("tenant") && edit.json.next === "dry-run" && editNext.code === 0 && editNext.json.question?.id === "dry-run" && editNext.json.closing && /^Ready to save this edit\. Nothing changed against the saved dashboard\. Refreshes are manual/.test(editNext.json.closing.ask) &&
      isDeepStrictEqual(editNext.json.closing.options.map((o) => o.id), ["dry-run", "save-only", "go-back"]) && editNext.json.closing.options[1].text === "Close the edit (nothing changed)" && editNext.json.progress.remaining === 3 && argvLines().slice(callsBeforeEdit).every((a) => a === "whoami"), [edit.json, editNext.json?.closing, argvLines().slice(callsBeforeEdit)]);
  const backTo = run("next", [SLUG, "--question", "tabs"], { flags: [...asBen, "--by", "ben"] });
  const retabbed = run("answer", [SLUG, "tabs", composeAnswer(backTo.json.question.options[1], { "admin.health": "yes", "admin.templates": "no", "exec.health": "no", "exec.templates": "no" })], { flags: [...asBen, "--by", "ben"] });
  const editClosing = run("next", [SLUG], { flags: [...asBen, "--by", "ben"] });
  check("F-516 next --question <id> changes one setting on the edit (the Templates tab off: a rebuild) and the closing step then STATES the consequence — the setting changed, rebuild with no pull — and its first option is the rebuild, not a refresh; the estimate needs no plan",
    backTo.json?.question?.id === "tabs" && backTo.json.again === true && retabbed.code === 0 && editClosing.code === 0 && /^Ready to save this edit\. Compared with the saved dashboard it changes 1 setting \(pages\[\]\.tabs\[\]\.enabled\): the pages are rebuilt from the data already pulled, no pull\. Refreshes are manual/.test(editClosing.json.closing.ask) &&
      editClosing.json.closing.options[0].id === "save-now" && editClosing.json.closing.options[0].text === "Save and rebuild the pages now (no pull)" && isDeepStrictEqual(editClosing.json.closing.options.map((o) => o.id), ["save-now", "dry-run", "save-only", "go-back"]), [editClosing.json?.closing, retabbed.json?.error]);
  // The edit's preview is rebuilt from the LAST PULL with the draft's settings, no call (the review of 2026-10-12): the
  // closing step's option says so, and the preview pages carry the edit (the Templates tab gone from the admin page).
  const callsBeforePreview = argvLines().length;
  const editPreview = run("answer", [SLUG, "dry-run", "yes"], { flags: [...asBen, "--by", "ben"] });
  const previewAdmin = existsSync(join(dash(), PREVIEW_DIR, "latest-admin.html")) ? readFileSync(join(dash(), PREVIEW_DIR, "latest-admin.html"), "utf8") : "";
  check("F-516 the edit's dry run previews the draft over the last pull with NO call: the option reads 'Preview the pages first (rebuilt from the last pull …)', the preview is marked fromLastPull with 0 calls, the admin preview shows the Templates tab as offered (off), and the closing step then offers no second preview",
    /Preview the pages first \(rebuilt from the last pull/.test(editClosing.json.closing.options[1].text) && editPreview.code === 0 && editPreview.json.preview?.fromLastPull === true && editPreview.json.preview.calls.made === 0 && argvLines().length === callsBeforePreview && previewAdmin.length > 0 && /class="gs-tab is-offered" data-tab="templates"/.test(previewAdmin.replace(/<script[\s\S]*?<\/script>/g, "")) &&
      isDeepStrictEqual(run("next", [SLUG], { flags: [...asBen, "--by", "ben"] }).json?.closing?.options?.map((o) => o.id), ["save-now", "save-only", "go-back"]), [editClosing.json?.closing?.options?.[1], editPreview.json ?? editPreview.stderr?.slice(-300)]);
  const snapsBeforeEditSave = snapshots().length;
  const callsBeforeEditSave = argvLines().length;
  const editEstimate = run("answer", [SLUG, "estimate", "yes"], { flags: [...asBen, "--by", "ben"] });
  const editSaved = run("answer", [SLUG, "save", "yes"], { flags: [...asBen, "--by", "ben"] });
  check("F-516 the edit's save DOES its consequence: the rebuild runs (no tenant call beyond whoami, no snapshot), the Templates tab is off on the saved spec, the draft is gone, and the summary says what was done",
    editEstimate.code === 0 && editEstimate.json.confirmed === true && editEstimate.json.estimate === null && editSaved.code === 0 && editSaved.json.done?.kind === "rebuild" && editSaved.json.done.pages?.length === 2 && editSaved.json.edit?.consequence === "rebuild" && snapshots().length === snapsBeforeEditSave && !existsSync(draftFile()) && openSpec(readJson(specFile())).pages[0].tabs.find((t) => t.id === "templates").enabled === false &&
      argvLines().slice(callsBeforeEditSave).every((a) => a === "whoami"), [editEstimate.json, editSaved.json?.done, editSaved.json?.error]);
  const editPull = run("new", [SLUG]);
  run("next", [SLUG, "--question", "tabs"]);
  run("answer", [SLUG, "tabs", "default"]);
  const editPullClosing = run("next", [SLUG]);
  const editPullSaved = run("answer", [SLUG, "save", "later"]);
  check("F-516 an edit that needs a pull (the Templates tab back on is a rebuild; here the admin Health tab stays on and nothing else moved, so a pull-cost change is made through step detail off): the closing step prices the pull on a plan, names the next refresh, and 'save only' saves without pulling",
    editPull.json?.state === "editing-saved" && editPullClosing.code === 0 && editPullClosing.json.closing && editPullSaved.code === 0 && editPullSaved.json.done === null && !existsSync(draftFile()), [editPullClosing.json?.closing?.ask, editPullSaved.json?.error]);
  rmSync(draftFile(), { force: true });
  const listed = run("list", []);
  check("list: the saved dashboard with its last pull and the pages on disk; a draft would show with its holder and date", listed.code === 0 && listed.json.dashboards.some((d) => d.slug === SLUG && d.saved && d.lastPull && d.pages.length === 2), listed.json);
  const report = run("report", [SLUG, "--by-template", "--all"]);
  check("report: the open-rate report over the latest snapshot with no pull, under the dashboard, with the snapshot's age and the minutes a pull would take (no cadence is read: the skill says the age and offers the pull)", report.code === 0 && existsSync(report.json.report) && report.json.report.includes(join(dash(), "reports")) && typeof report.json.snapshotAgeDays === "number" && (report.json.refreshMinutes === null || typeof report.json.refreshMinutes === "number") && typeof report.json.fullRefreshMinutes === "number" && !("withinCadence" in report.json) && !("cadence" in report.json) && !("staleAfterDays" in report.json), report.json);
  const health = run("health", [SLUG, "--program", "p-onboard"]);
  check("health: a program's masked bounce reasons, participant failures, step failures and the 'Other' samples to the terminal", health.code === 0 && health.json.program.id === "p-onboard" && health.json.bounceReasons.length > 0 && Array.isArray(health.json.otherSamples) && health.json.health.pulled === true, health.json?.program);
  const exported = run("export", [SLUG, "--out", join(ROOT, "handover", "acme-health.json"), "--with-snapshot"]);
  check("export --with-snapshot: the spec's portable file and the latest snapshot beside it, with its account store beside that (F-548), so the import's first refresh ranks with no full pull", exported.code === 0 && existsSync(exported.json.out) && existsSync(exported.json.snapshot) && exported.json.snapshot.endsWith("acme-health.snapshot.json") &&
    exported.json.accountStore?.endsWith("acme-health.snapshot.accounts.json") && existsSync(exported.json.accountStore) && readJson(exported.json.accountStore).pulledAt === readJson(exported.json.snapshot).meta.pulledAt && /selective/.test(exported.json.hint), exported.json);
  const imported = run("import", ["--file", join(ROOT, "handover", "acme-health.json")], { flags: ["--workspace", WS2, "--kb", KB2, "--bin", FAKE, "--today", TODAY, "--by", "cy"] });
  const rebuilt = run("rebuild", [SLUG], { flags: ["--workspace", WS2, "--kb", KB2, "--bin", FAKE, "--today", TODAY, "--by", "cy"] });
  const status2 = run("status", [SLUG], { flags: ["--workspace", WS2, "--kb", KB2, "--bin", FAKE, "--today", TODAY, "--by", "cy"] });
  check("import carries the account store beside the snapshot into the dashboard's snapshots folder, paired with the imported snapshot (F-548)", imported.json?.accountStore != null && existsSync(imported.json.accountStore) && readJson(imported.json.accountStore).pulledAt === readJson(imported.json.snapshot).meta.pulledAt && imported.json.accountStore === imported.json.snapshot.replace(/[.]json$/, ".accounts.json"), imported.json);
  check("import on a second workspace of the same tenant: the spec and the snapshot land, the pages rebuild from it with no pull, and status reads the carried pull", imported.code === 0 && imported.json.snapshot != null && rebuilt.code === 0 && rebuilt.json.pages.length === 2 && status2.json?.lastPull?.pulledAt === readJson(join(dash(), SNAPSHOTS_DIR, snapshots().at(-1))).meta.pulledAt, [imported.json, rebuilt.json, status2.json?.lastPull]);
  const wrongImport = run("import", ["--file", join(ROOT, "handover", "acme-health.json")], { flags: ["--workspace", WS2, "--kb", KB2, "--bin", FAKE, "--today", TODAY] });
  check("import never overwrites silently: the same slug again is refused without --replace", wrongImport.code === 1 && /already saved here/.test(wrongImport.json?.error ?? ""), wrongImport.json);

  // ══ F-515: the proposal written from the suggestion file, through the rules ══
  {
    // The file the grouping node hands the prose (written at the closing step's exact plan): a two-level proposal
    // written FROM it — Recurring / One-off by `recurring`, one group per model CODE with the display name as its
    // label — resolves over the pulled snapshot to the counts the file gave, every program grouped at both levels
    // except those whose `recurring` the file itself calls unknown.
    const file = readJson(join(dash(), SUGGESTION_FILE));
    const proposal = {
      rules: [
        { kind: "characteristic", level: "supergroup", characteristic: "recurring", is: true, label: "Recurring" },
        { kind: "characteristic", level: "supergroup", characteristic: "recurring", is: false, label: "One-off" },
        ...file.tallies.model.filter((t) => t.value !== "(none)").map((t) => ({ kind: "characteristic", level: "group", characteristic: "model", is: t.value, label: t.label })),
      ],
      overrides: {},
    };
    const latest = openSnapshot(readJson(join(dash(), SNAPSHOTS_DIR, snapshots().at(-1))));
    const r = resolveGroups({ programs: programTraits(latest), groups: proposal });
    const matched = proposal.rules.map((_, i) => r.assignments.filter((a) => a.by.supergroup === `rule ${i + 1}` || a.by.group === `rule ${i + 1}`).length);
    const tallyOf = (key, value) => file.tallies[key].find((t) => String(t.value) === String(value))?.programs ?? 0;
    const unknownRecurring = file.programs.filter((p) => p.recurring === null).map((p) => p.id).sort();
    check("F-515 the proposal written from the suggestion file through the rules groups every program with the file's counts: the file's `model` is the code a rule tests (its `modelName` the label), its `recurring` is the trait the snapshot resolves (the one-run-window and months-with-sends rules applied at the plan), so Recurring / One-off and each model group match exactly the file's tallies, and only the programs the file calls unknown are ungrouped",
      file.programs.length === latest.dimensions.programs.length && file.programs.every((p) => typeof p.model === "string" && typeof p.modelName === "string") && file.notes.some((n) => /model CODE/.test(n)) && matched[0] === tallyOf("recurring", true) && matched[1] === tallyOf("recurring", false) &&
        proposal.rules.slice(2).every((rule, i) => matched[i + 2] === tallyOf("model", rule.is)) && isDeepStrictEqual([...r.ungrouped].sort(), unknownRecurring) && r.ungroupedWithin.length === 0 && matched.slice(2).reduce((a, b) => a + b, 0) === file.programs.length,
      { matched, tallies: file.tallies, ungrouped: r.ungrouped, unknownRecurring, programs: [file.programs.length, latest.dimensions.programs.length] });
    const answered = run("change", [SLUG, `groups=${JSON.stringify(proposal)}`]);
    check("the same proposal written through the writer (as the grouping node does) is accepted, a rebuild only; the About tab then shows each model rule by its display name with its count, and the Groups part once",
      answered.code === 0 && answered.json.consequence === "rebuild" && answered.json.done.kind === "rebuild" && /programs whose model is Email Chain\. Matched \d+ programs?\./.test(pageText("admin")) && !/whose model is DRIPV2/.test(pageText("admin")) && !pageText("admin").includes("<dt>Groups</dt>") && (pageText("admin").replace(/<script[\s\S]*?<\/script>/g, "").match(/Group rules, as they resolved/g) ?? []).length === 1,
      [answered.json?.error ?? answered.stderr?.slice(-600), answered.json?.done?.ungrouped]);
  }

  // ══ F-503: every copy line the pages emit runs as drawn in a workspace with TWO tenant KB folders ══
  {
    writeFiles(WS, { "acme-sbx/_manifest.json": JSON.stringify({ slug: "acme-sbx", baseUrl: "https://acme--sbx.gainsightcloud.com", environment: "sandbox", created: "2026-01-01T00:00:00.000Z", last_refresh: null, domains_indexed: {}, inventory: {} }) });
    // The pre-render's lines only: the inlined runtime SOURCE also holds the text `data-copy="…"`.
    const prerender = pageText("admin").replace(/<script[\s\S]*?<\/script>/g, "");
    const lines = [...new Set([...prerender.matchAll(/data-copy="([^"]*)"/g)].map((m) => m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")))];
    const fromWorkspace = (argv) => { const x = runNode(SCRIPT, [...argv, "--bin", FAKE, "--today", TODAY, "--by", "ana"], { cwd: WS, env: { ...process.env, FAKE_STATE: STATE, FAKE_TENANT: JSON.stringify(TENANT) } }); let json = null; try { json = JSON.parse(x.stdout); } catch { /* a stack */ } return { code: x.status, json, stderr: x.stderr }; };
    // A fill line is run with its value put where the line says (a change line's value after `=`; the account line's name between its empty quotes, ACC-2).
    // (the shell's part is simulated here: a pair in double quotes is one word with the quotes removed, F-536; the real shells judge it below in the R13 block)
    const asArgv = (line) => line.replace(/^node \.gs-superadmin\/plugin\/scripts\/dashboard\.mjs /, "").replace("<program id>", "p-onboard").replace("<domains>", "example.com").split(" ").map((t, i, all) => (t === "''" && all[i - 1] === "--account-name" ? "Acme Customer 01" : /^".*"$/.test(t) ? t.slice(1, -1) : t));
    const results = lines.map((line) => { const argv = asArgv(line); return { line, ...fromWorkspace(argv[0] === "change" ? [...argv, "--dry-run"] : argv) }; });
    const bare = fromWorkspace(asArgv(lines.find((l) => / refresh /.test(l))).filter((a, i, all) => !(a === "--kb" || all[i - 1] === "--kb")));
    check("F-503 every copy line the admin page emits (the How to refresh line, every notice's change line, the health line, the account timeline's line) carries --kb <folder> and runs as drawn from the workspace folder with two tenant KB folders present (a change line as a dry run, the refresh and health lines for real); the same refresh line without --kb is refused naming the two folders, as the tester saw",
      lines.length >= 1 && lines.some((l) => / refresh acme-health --kb acme-prod$/.test(l)) && lines.every((l) => / --kb acme-prod$/.test(l)) && results.every((x) => x.code === 0 && x.json?.ok === true) && bare.code === 1 && /holds 2 tenant KB folders \(acme-prod, acme-sbx\)/.test(bare.json?.error ?? ""),
      results.map((x) => [x.line, x.code, x.json?.error ?? x.stderr?.slice(-200)]));
    rmSync(join(WS, "acme-sbx"), { recursive: true, force: true });
  }

  // ══ PUB-3: the leaders' copy, published (offline: a temp folder stands for the synced shared folder) ══
  {
    const shared = join(SHARE, `${SLUG}-leaders.html`);
    const dataDir = join(SHARE, `${SLUG}-leaders-data`);
    const csvRows = (t) => t.replace(/^\uFEFF/, "").split("\r\n").filter(Boolean);
    const pub1 = refresh.json?.publish;
    // Later pulls have published since the first refresh: the folder holds the latest pull's files.
    const latestPulledAt = readJson(join(dash(), SNAPSHOTS_DIR, snapshots().at(-1))).meta.pulledAt;
    check("PUB-3 file-copy, the default: the save's first refresh copied the leaders' page into the folder this machine maps \"leaders\" to, under the spec's file name, byte for byte the workspace's latest-exec.html; the summary and stderr say where; the tables went beside it as CSV files with a definitions file, every one named with the dashboard's name first (<dashboard>-<panel>.csv, <dashboard>-definitions.csv: ruled at S7-V), each table's rows ending in the pull's time",
      pub1?.target === "file-copy" && pub1.published === true && pub1.file === shared && existsSync(shared) && readFileSync(shared, "utf8") === pageText("exec") && new RegExp(`the leaders' copy was published: .*${SLUG}-leaders\\.html \\(the same file each time\\)`).test(refresh.stderr) &&
        existsSync(join(dataDir, `${SLUG}-definitions.csv`)) && pub1.datasets?.files?.length >= 3 && pub1.datasets.files.every((f) => existsSync(join(dataDir, f)) && f.startsWith(`${SLUG}-`)) &&
        pub1.datasets.files.filter((f) => f !== `${SLUG}-definitions.csv`).every((f) => { const rows = csvRows(readFileSync(join(dataDir, f), "utf8")); return rows[0].endsWith(",Data pulled") && rows.slice(1).every((r) => r.endsWith(`,${latestPulledAt}`)); }) &&
        csvRows(readFileSync(join(dataDir, `${SLUG}-definitions.csv`), "utf8"))[1].startsWith(`pulled,Data pulled,${latestPulledAt}`),
      [pub1, refresh.stderr.split("\n").filter((l) => l.includes("leaders' copy"))]);
    // The same name, every time: a second pull overwrites it, and nothing else appears in the folder.
    const before = readdirSync(SHARE).sort();
    const again = run("rebuild", [SLUG]);
    check("PUB-3 the same file every time: a rebuild publishes again, overwriting the same file name (the folder holds the same names as before, and the file is the new page), never a new file per update",
      again.code === 0 && again.json.publish?.published === true && isDeepStrictEqual(readdirSync(SHARE).sort(), before) && before.length === 2 && readFileSync(shared, "utf8") === pageText("exec"), [before, readdirSync(SHARE), again.json?.publish]);
    // A failed or stopped refresh copies nothing: the shared copy is the one before (a marker planted in it stays, so a
    // copy of the unchanged pages would show too).
    const sharedBefore = "<!-- the copy before the stopped refresh -->";
    writeFileSync(shared, sharedBefore);
    rmSync(join(STATE, "faults.json"), { force: true });
    const stoppedPull = run("refresh", [SLUG, "--full"], { env: { FAKE_FAULTS: JSON.stringify([{ match: "rp run", kind: "auth", skip: 4, times: 9999 }]) } });
    const sharedAfterStop = readFileSync(shared, "utf8");
    rmSync(join(STATE, "faults.json"), { force: true });
    const finished = run("refresh", [SLUG, "--full"]);
    check("PUB-3 a stopped refresh copies nothing (the shared copy is byte for byte the one before, and the stop's summary carries no publish); the refresh that finishes it publishes",
      stoppedPull.code === EXIT["token-expired"] && stoppedPull.json?.publish === undefined && sharedAfterStop === sharedBefore && finished.code === 0 && finished.json.publish?.published === true && readFileSync(shared, "utf8") === pageText("exec"),
      [stoppedPull.code, finished.json?.publish]);
    // A copy that fails leaves the workspace's pages untouched, and says so: the destination file is a folder (a lock stands in).
    const pagesBefore = { admin: pageText("admin"), exec: pageText("exec") };
    rmSync(shared, { force: true });
    mkdirSync(shared);
    const failed = run("publish", [SLUG]);
    check("PUB-3 a copy that fails (here the destination cannot be replaced) is said in the summary and on stderr, names the fix, leaves no temporary file, and the workspace's pages are byte for byte untouched",
      failed.code === 0 && failed.json.publish?.published === false && /a copy into .* failed \(E[A-Z]+: /.test(failed.json.publish.why ?? "") && /dashboard\.mjs publish acme-health --kb acme-prod/.test(failed.json.publish.why) &&
        pageText("admin") === pagesBefore.admin && pageText("exec") === pagesBefore.exec && !readdirSync(SHARE).some((f) => f.includes(".tmp-")) && /the leaders' copy: .*failed/.test(failed.stderr),
      [failed.json?.publish, readdirSync(SHARE)]);
    rmSync(shared, { recursive: true, force: true });
    // F-527: a copy that fails AFTER the page was copied (a dataset CSV that cannot be replaced: a folder stands in for
    // a file a spreadsheet holds open) is not a publish: the flag is false, `partial` names what this publish replaced
    // and what still holds the previous one, the exit stays 0 (ruled), and the line to run again is in `why`.
    run("publish", [SLUG]);
    const dataFiles = readdirSync(dataDir).filter((f) => f.endsWith(".csv")).sort();
    const order = (run("publish", [SLUG]).json?.publish?.datasets?.files ?? []);
    const blocked = order[1];
    rmSync(join(dataDir, blocked), { force: true });
    mkdirSync(join(dataDir, blocked));
    const half = run("publish", [SLUG]);
    const hp = half.json?.publish ?? {};
    const notReplacedNames = (hp.partial?.notReplaced ?? []).map((f) => f.split(/[\\/]/).pop());
    check("F-527 a copy that fails after the page was copied reads published: false with a partial state: the page and the data files before the failing one are listed as replaced, the failing one and every one after it as not replaced (they hold the previous publish), the Leaders line's why says the copy is not whole and names them; exit 0, no temporary file left",
      half.code === 0 && hp.published === false && hp.partial?.replaced?.[0] === shared && hp.partial.replaced.length === 2 && notReplacedNames[0] === blocked && isDeepStrictEqual(notReplacedNames, order.slice(1)) &&
        /^the copy is not whole: 2 of \d+ files were replaced/.test(hp.why ?? "") && hp.why.includes(blocked) && /dashboard\.mjs publish acme-health --kb acme-prod/.test(hp.why) && !readdirSync(dataDir).some((f) => f.includes(".tmp-")) && dataFiles.length === order.length,
      [hp, order, dataFiles]);
    rmSync(join(dataDir, blocked), { recursive: true, force: true });
    // The manual publish (R8): the pages as they stand, no call.
    const callsBeforePublish = argvLines().length;
    const manual = run("publish", [SLUG]);
    check("PUB-3 the manual publish copies the pages as they stand with no gs-admin call at all (no whoami either: nothing is read from the tenant)",
      manual.code === 0 && manual.json.publish?.published === true && readFileSync(shared, "utf8") === pageText("exec") && argvLines().length === callsBeforePublish, manual.json);
    // Dated copies beside it, an option off by default; changing a publish setting publishes at once, with no pull and no rebuild.
    const dated = run("change", [SLUG, "publish.config.datedCopies=true"]);
    const datedName = `${SLUG}-leaders-${String(readJson(join(dash(), SNAPSHOTS_DIR, snapshots().at(-1))).meta.pulledAt).slice(0, 10)}.html`;
    check("PUB-3 dated copies (off by default): turning them on is a rebuild (no pull), which publishes at its end, and the copy named with the pull's date sits beside the same-name file",
      dated.code === 0 && dated.json.consequence === "rebuild" && dated.json.done?.kind === "rebuild" && dated.json.done.publish?.dated === join(SHARE, datedName) && existsSync(join(SHARE, datedName)) && existsSync(shared), [dated.json?.consequence, dated.json?.done]);
    run("change", [SLUG, "publish.config.datedCopies=false"]);
    rmSync(join(SHARE, datedName), { force: true });
    // No folder on this machine (a backup refresher's workspace before they set one): the refresh finishes and says why.
    const noTarget = run("publish", [SLUG], { flags: ["--workspace", WS, "--kb", KB, "--bin", FAKE, "--today", TODAY, "--by", "ana"], env: {} });
    const targetsFile = join(WS, ".gs-superadmin", PUBLISH_TARGETS_FILE);
    const savedTargets = readFileSync(targetsFile, "utf8");
    rmSync(targetsFile);
    const unmapped = run("publish", [SLUG]);
    writeFileSync(targetsFile, "{ not json");
    const malformed = run("publish", [SLUG]);
    writeFileSync(targetsFile, savedTargets);
    // A data file of a panel removed since is pruned from the dashboard's own data folder in the workspace. In the SHARED
    // folder only a file this dashboard's last publish wrote is removed (its publish record, F-532): a file it never
    // wrote (another dashboard's, a leader's own copy, S7's unprefixed names) is left where it is.
    for (const d of [dataDir, join(dash(), "latest-exec-data")]) for (const old of ["a-removed-panel.csv", "definitions.csv", "headline.csv"]) writeFileSync(join(d, old), "old");
    const pruned = run("publish", [SLUG]);
    const plantedKept = ["a-removed-panel.csv", "definitions.csv", "headline.csv"].every((old) => existsSync(join(dataDir, old)) && !existsSync(join(dash(), "latest-exec-data", old)));
    for (const old of ["a-removed-panel.csv", "definitions.csv", "headline.csv"]) rmSync(join(dataDir, old), { force: true });
    // A panel this dashboard published and no longer does (the leaders' Health tab on, then off: a rebuild each): its
    // data files leave the shared folder at the publish that stops writing them.
    const healthIdx = openSpec(readJson(specFile())).pages[1].tabs.findIndex((t) => t.id === "health");
    const withHealth = run("change", [SLUG, `pages.1.tabs.${healthIdx}.enabled=true`]);
    const addedFiles = (withHealth.json?.done?.publish?.datasets?.files ?? []).filter((f) => !(pruned.json?.publish?.datasets?.files ?? []).includes(f));
    // One of them a folder (a locked file stands in): its removal fails, the copy stays whole and says so.
    const stuckName = addedFiles[0] ?? "none.csv";
    rmSync(join(dataDir, stuckName), { force: true });
    mkdirSync(join(dataDir, stuckName, "inner"), { recursive: true });
    const withoutHealth = run("change", [SLUG, `pages.1.tabs.${healthIdx}.enabled=false`]);
    const stuck = withoutHealth.json?.done ?? {};
    rmSync(join(dataDir, stuckName), { recursive: true, force: true });
    const retried = run("publish", [SLUG]);
    check("PUB-3 when only the pruning of a stale data file fails, the copy is whole: published true, and the summary says the stale file could not be removed (the review's finding: never 'not whole' with nothing not replaced)",
      stuck.publish?.published === true && stuck.publish.partial === null && /the copy is whole, but a data file no panel writes any more could not be removed/.test(stuck.publish.why ?? ""), stuck.publish);
    check("PUB-3 a publish never refuses: a malformed publish-targets file is said (exit 0, not published, the pages untouched); F-532 a data file this dashboard published and no longer writes (the leaders' Health tab off again) is removed from the shared folder, while a file it never wrote there is left and the workspace's own data folder is pruned whole",
      malformed.code === 0 && malformed.json.publish?.published === false && /could not be published/.test(malformed.json.publish.why ?? "") &&
        pruned.code === 0 && pruned.json.publish?.published === true && plantedKept && existsSync(join(dataDir, `${SLUG}-definitions.csv`)) &&
        withHealth.code === 0 && addedFiles.length > 1 && withoutHealth.code === 0 && retried.code === 0 && addedFiles.every((f) => !existsSync(join(dataDir, f))),
      [malformed.json, pruned.json?.publish?.datasets, addedFiles, readdirSync(dataDir)]);
    // F-532: a publish change that leaves the old copy behind names it (the file renamed: the old page and its data
    // folder are no longer updated), and leaves it where it is.
    const renamedFile = run("change", [SLUG, `publish.config.file="${SLUG}-leaders-2.html"`]);
    const renamedBack = run("change", [SLUG, `publish.config.file="${SLUG}-leaders.html"`]);
    check("F-532 a publish change names the copy it no longer updates (the old page and its data folder, the file renamed) and leaves it in place; renamed back, the earlier name's copy is named in turn",
      renamedFile.code === 0 && isDeepStrictEqual(renamedFile.json.done.publish?.noLongerUpdated, [shared, dataDir]) && /no longer updated by this dashboard and was left where it is/.test(renamedFile.json.done.publish.note) && existsSync(shared) && existsSync(join(SHARE, `${SLUG}-leaders-2.html`)) &&
        renamedBack.code === 0 && isDeepStrictEqual(renamedBack.json.done.publish?.noLongerUpdated, [join(SHARE, `${SLUG}-leaders-2.html`), join(SHARE, `${SLUG}-leaders-2-data`)]),
      [renamedFile.json?.done?.publish, renamedBack.json?.done?.publish]);
    rmSync(join(SHARE, `${SLUG}-leaders-2.html`), { force: true });
    rmSync(join(SHARE, `${SLUG}-leaders-2-data`), { recursive: true, force: true });
    check("PUB-3 with no folder set for the target on this machine, nothing is copied and the summary says why, with the line that sets one (publish-target leaders <folder>) as its remedy",
      noTarget.code === 0 && unmapped.code === 0 && unmapped.json.publish?.published === false && /no folder is set for the publish target "leaders" on this computer/.test(unmapped.json.publish.why) && unmapped.json.publish.remedy?.line === "node .gs-superadmin/plugin/scripts/dashboard.mjs publish-target leaders <folder> --kb acme-prod", unmapped.json?.publish);
    const listed = run("publish-target", []);
    const badTarget = run("publish-target", ["../escape", SHARE]);
    check("PUB-3 publish-target lists the machine's targets, and refuses a name that is not a plain name",
      listed.code === 0 && listed.json.targets?.leaders?.folder === resolve(SHARE) && badTarget.code === 1 && /a publish target's name is letters/.test(badTarget.json?.error ?? ""), [listed.json, badTarget.json]);
    // The artifact target: the page in an artifact's content form for the skill to publish (no LLM in the runner).
    const toArtifact = run("change", [SLUG, 'publish={"target":"claude-artifact","config":{"url":null}}']);
    const artifactFile = join(dash(), PUBLISH_DIR, "latest-exec.artifact.html");
    const content = existsSync(artifactFile) ? readFileSync(artifactFile, "utf8") : "";
    check("PUB-3 claude-artifact: the runner writes the leaders' page in an artifact's content form (its title and style first, then the page's body: no doctype, html, head or body of its own, so the artifact does not nest a document), with the capability the page needs (downloads) and what Claude does next; nothing is copied to the folder",
      toArtifact.code === 0 && toArtifact.json.done?.publish?.target === "claude-artifact" && toArtifact.json.done.publish.file === artifactFile && /^<title>[^<]+<\/title>\n<style>/.test(content) && !/<!doctype|<html\b|<head>|<body\b|<\/body>|<\/html>/i.test(content) &&
        content.includes('<fieldset id="gs-root"') && (content.match(/<script type="module">/g) ?? []).length === 2 && pageText("exec").includes(content.slice(content.indexOf("<noscript>"))) && isDeepStrictEqual(toArtifact.json.done.publish.capabilities, { downloads: true }) && /\/gs-superadmin:email-engagement publish acme-health/.test(toArtifact.json.done.publish.next),
      [toArtifact.json?.done?.publish, content.slice(0, 120)]);
    const withUrl = run("change", [SLUG, 'publish.config.url="https://claude.ai/artifact/AbCdEf123456"']);
    const backToFolder = run("change", [SLUG, `publish=${JSON.stringify({ target: "file-copy", config: { to: "leaders", file: `${SLUG}-leaders.html`, datedCopies: false, datasets: true } })}`]);
    check("PUB-3 the artifact's link, once recorded, is what the next publish updates; and the target goes back to the shared folder the same way (each a rebuild, no pull)",
      withUrl.code === 0 && withUrl.json.done?.publish?.url === "https://claude.ai/artifact/AbCdEf123456" && backToFolder.code === 0 && backToFolder.json.done?.publish?.published === true, [withUrl.json?.done, backToFolder.json?.done]);
  }

  // ══ NAT-1 / NAT-2: native Gainsight reports, planned, created by "the user", recorded, read back ══
  {
    // The user's approved command, as the shell runs it from the workspace folder: the CLI (the stand-in here) with the
    // line's words, its output to the line's file. Never through the entry command: no script runs a create.
    const issue = (line) => {
      const { argv, file } = splitRedirect(line);
      const r = runNode(FAKE, argv.slice(1), { cwd: WS, env: { ...process.env, FAKE_STATE: STATE, FAKE_TENANT: JSON.stringify(TENANT) } });
      mkdirSync(dirname(join(WS, String(file))), { recursive: true });
      writeFileSync(join(WS, String(file)), r.stdout);
      return r.status;
    };
    const rpVerbs = (lines) => lines.map((l) => l.split(" ").filter((t) => !t.startsWith("--"))).filter((t) => t[0] === "rp" || t[0] === "whoami").map((t) => (t[0] === "rp" ? `rp ${t[1]}` : "whoami"));
    const before = argvLines().length;
    const plan = run("native-plan", [SLUG, "--test-prefix"]);
    const planCalls = rpVerbs(argvLines().slice(before));
    const saved = openSpec(readJson(specFile()));
    const expected = nativePlan(saved, { prefix: TEST_PREFIX, schema: buildTenant(TENANT).schemas.email_log_v2 });
    const toIssue = (plan.json?.reports ?? []).filter((r) => r.command);
    check("NAT-1 native-plan makes one whoami and one rp schema read and nothing else (no create, no update: it prints the lines, never runs them); its summary is the module's plan over the saved spec and the tenant's schema (the same verdicts, actions and counts), every create line `gs-admin --json rp create` with a ZZ|TEST| name and its output to a file beside the dashboard; the plan file written; every panel left out says why",
      plan.code === 0 && plan.json.schemaChecked === true && isDeepStrictEqual(planCalls, ["whoami", "rp schema"]) &&
        isDeepStrictEqual(plan.json.counts, expected.counts) && isDeepStrictEqual(plan.json.reports.map((r) => [r.panel, r.status, r.action]), expected.entries.filter((e) => e.payload).map((e) => [e.key, e.status, e.action])) &&
        toIssue.length === expected.counts.create && toIssue.length > 0 && toIssue.every((r) => r.command.startsWith(`gs-admin --json rp create --name 'ZZ|TEST|`) && r.command.includes(` > acme-prod/dashboards/${SLUG}/native/`)) && existsSync(plan.json.planFile) && plan.json.notNative.length > 0 && plan.json.notNative.every((n) => n.why.length > 20),
      [plan.json?.error ?? plan.stderr?.slice(-400), planCalls, plan.json?.counts, expected.counts]);
    // Recording before the create ran is refused (nothing to find by its name); so is recording over a draft in progress.
    const early = run("native-record", [SLUG, "--panel", toIssue[0]?.panel ?? "x"]);
    writeFileSync(draftFile(), JSON.stringify({ kind: "dashboard-spec-draft", spec: readJson(specFile()), answered: [], startedAt: "2026-09-15T09:00:00.000Z", updatedAt: "2026-09-15T09:00:00.000Z", by: "ana" }));
    const overDraft = run("native-record", [SLUG, "--panel", toIssue[0]?.panel ?? "x"]);
    rmSync(draftFile(), { force: true });
    check("NAT-2 native-record before its create line ran is refused (the report is not found by its exact name) and records nothing; over a draft in progress it is refused, so recording never saves someone's unfinished edit",
      early.code === 1 && /was not found by its exact name: did its create line run and succeed\?/.test(early.json?.error ?? "") && openSpec(readJson(specFile())).native.reports.length === 0 &&
        overDraft.code === 1 && /has a draft in progress/.test(overDraft.json?.error ?? ""), [early.json, overDraft.json]);
    // The user issues each line (its own command, behind the guard's ask in a session), then records it.
    const mark = argvLines().length;
    const results = toIssue.map((r) => ({ r, code: issue(r.command), rec: null }));
    for (const x of results) x.rec = run("native-record", [SLUG, "--panel", x.r.panel]);
    const calls = rpVerbs(argvLines().slice(mark));
    const recorded = openSpec(readJson(specFile())).native.reports;
    const sharedKeys = (plan.json?.reports ?? []).filter((r) => r.action === "shared");
    check("NAT-2 each create line, issued as its own command, saves a report; native-record reads its id back by its exact name (one whoami and one rp describe each, never a create) and records it through the spec writer with its fingerprint, and the panels that share it under the same id",
      results.every((x) => x.code === 0 && x.rec.code === 0 && /^rpt-\d{4}$/.test(x.rec.json.reportId)) && calls.filter((c) => c === "rp create").length === toIssue.length && calls.filter((c) => c === "rp describe").length === toIssue.length && !calls.includes("rp update") &&
        recorded.length === toIssue.length + sharedKeys.length && recorded.every((x) => /^[0-9a-f]{8}$/.test(x.planHash) && x.name.startsWith(TEST_PREFIX)) && sharedKeys.every((s) => recorded.find((x) => x.panel === s.panel)?.reportId === recorded.find((x) => x.panel === s.sameAs)?.reportId),
      [results.map((x) => [x.r.panel, x.code, x.rec.json?.error]), calls, recorded.length]);
    // A panel sharing an existing report but not recorded under its own key (added after the report was made): the
    // plan marks it unrecorded and native-record records it under that report's id, with no command to run.
    const firstShared = sharedKeys[0];
    run("change", [SLUG, `native.reports=${JSON.stringify(recorded.filter((x) => x.panel !== firstShared?.panel))}`]);
    const gap = run("native-plan", [SLUG, "--test-prefix"]);
    const gapEntry = (gap.json?.reports ?? []).find((r) => r.panel === firstShared?.panel);
    const createsBefore = argvLines().filter((l) => / rp create /.test(` ${l} `)).length;
    const filled = run("native-record", [SLUG, "--panel", firstShared?.panel ?? "x"]);
    check("NAT-2 a shared panel with no record of its own is marked unrecorded by the plan (no command printed), and native-record records it under the report it shares — read by id, never a create",
      !!firstShared && gapEntry?.action === "shared" && gapEntry.unrecorded === true && !gapEntry.command && filled.code === 0 && filled.json.reportId === recorded.find((x) => x.panel === firstShared.sameAs)?.reportId &&
        openSpec(readJson(specFile())).native.reports.some((x) => x.panel === firstShared.panel) && argvLines().filter((l) => / rp create /.test(` ${l} `)).length === createsBefore,
      [gapEntry, filled.json]);
    const again = run("native-plan", [SLUG, "--test-prefix"]);
    check("NAT-2 a re-run skips every report already created: nothing to create or update, every report unchanged or shared, no line printed, nothing to clean up",
      again.code === 0 && again.json.counts.create === 0 && again.json.counts.update === 0 && again.json.reports.every((r) => !r.command && ["unchanged", "shared"].includes(r.action)) && again.json.cleanup.length === 0, again.json?.counts);
    const verify = run("native-verify", [SLUG]);
    check("NAT-2 native-verify reads every recorded report back through rp run-saved (a report two panels share once): rows keyed by column label, every planned column there, and each report's UI columns named as still to be added",
      verify.code === 0 && verify.json.ok === true && verify.json.reports.length === toIssue.length && verify.json.reports.every((x) => x.ok && x.rows > 0 && x.missing.length === 0 && existsSync(x.file)) &&
        isDeepStrictEqual(verify.json.uiPending.map((x) => x.panel).sort(), expected.entries.filter((e) => e.action === "create" && e.uiColumns.length).map((e) => e.key).sort()), verify.json);
    // A changed panel: the plan says update, with its warning; recording before the update ran, or after the dashboard
    // moved again since the plan, is refused; after the update line ran, it records the new name and fingerprint.
    run("change", [SLUG, `pages.0.title=${JSON.stringify("Admin team")}`]);
    const changed = run("native-plan", [SLUG, "--test-prefix"]);
    const updates = (changed.json?.reports ?? []).filter((r) => r.action === "update");
    const beforeUpdate = run("native-record", [SLUG, "--panel", updates[0]?.panel ?? "x"]);
    run("change", [SLUG, `pages.0.title=${JSON.stringify("Admin crew")}`]);
    const moved = run("native-record", [SLUG, "--panel", updates[0]?.panel ?? "x"]);
    run("change", [SLUG, `pages.0.title=${JSON.stringify("Admin team")}`]);
    const updatedCode = issue(updates[0]?.command ?? "x > y");
    const afterUpdate = run("native-record", [SLUG, "--panel", updates[0]?.panel ?? "x"]);
    check("NAT-2 a changed panel (the page's title, in each report's name) plans an update of each of that page's reports by its recorded id (the other page's stay unchanged), with the warning that the UI's columns go; recording before the update line ran is refused (the report still has its old name), and so is recording after the dashboard moved again since the plan; once the line ran, the record keeps the id with the new name",
      changed.code === 0 && updates.length > 0 && isDeepStrictEqual(updates.map((r) => r.panel), toIssue.filter((r) => r.panel.startsWith(`${saved.pages[0].id}/`)).map((r) => r.panel)) && changed.json.reports.filter((r) => !r.panel.startsWith(`${saved.pages[0].id}/`) && r.action !== "shared").every((r) => r.action === "unchanged") && updates.every((r) => r.command.startsWith("gs-admin --json rp update --id rpt-") && /--new-name 'ZZ\|TEST\|[^']* - Admin team - /.test(r.command) && /calculated and formula columns added in the UI go/.test(r.warning)) &&
        beforeUpdate.code === 1 && /still has the name/.test(beforeUpdate.json?.error ?? "") && moved.code === 1 && /changed since the plan was made/.test(moved.json?.error ?? "") &&
        updatedCode === 0 && afterUpdate.code === 0 && afterUpdate.json.reportId === recorded.find((x) => x.panel === updates[0].panel)?.reportId && / - Admin team - /.test(openSpec(readJson(specFile())).native.reports.find((x) => x.panel === updates[0].panel)?.name ?? ""),
      [changed.json?.counts, beforeUpdate.json?.error, moved.json?.error, updatedCode, afterUpdate.json]);
    const blind = run("native-plan", [SLUG, "--test-prefix", "--no-schema"]);
    const blindRecord = run("native-record", [SLUG, "--panel", (blind.json?.reports ?? []).find((r) => r.action === "update")?.panel ?? "x"]);
    check("NAT-2 a plan made with --no-schema (no login needed) says it is for reading only, and recording from it is refused",
      blind.code === 0 && blind.json.schemaChecked === false && /for reading only/.test(blind.json.next) && blindRecord.code === 1 && /made without the tenant's schema/.test(blindRecord.json?.error ?? ""), [blind.json?.next, blindRecord.json?.error]);
    // The gate: the native verbs' reads, and nothing else — a catalogued-mutating command is refused before any spawn.
    const catalog = JSON.parse(readFileSync(join(HERE, "..", "reference", "catalog.json"), "utf8"));
    const gate = makeGate({ catalog, hooksDir: join(HERE, "..", "hooks"), readPaths: NATIVE_READ_PATHS });
    check("NAT-2 the native verbs' gate lets through whoami, rp schema, rp describe and rp run-saved, and refuses rp create and rp update as MUTATING (and a read it does not list), so no native verb can spawn a write",
      ["whoami", "--json rp schema --object email_log_v2", "--json rp describe --name x", "--json rp run-saved --id x"].every((l) => gate(l.split(" ")) === null) && /MUTATING/.test(gate(["--json", "rp", "create", "--name", "x"]) ?? "") && /MUTATING/.test(gate(["--json", "rp", "update", "--id", "x"]) ?? "") && gate(["--json", "jo", "p", "list"]) !== null);
  }

  // ══ R12-A: a list change over a routine refresh (F-529); run and snapshot identity (F-535, F-544); publish ownership
  // (F-532, F-540); a window that has not started (F-537) ══
  {
    const readSnap = () => readJson(join(dash(), SNAPSHOTS_DIR, snapshots().at(-1)));
    const rk = (s) => s.honesty.accountSelection.lists.map((l) => [l.kind, l.n, l.floor, l.kept.length, l.notRanked ?? null]);
    // A line a summary prints, run as printed from the workspace folder (F-523's rule).
    const asPrinted = (line) => { const x = runNode(SCRIPT, [...line.replace(/^node \S+dashboard\.mjs /, "").split(" "), "--bin", FAKE, "--today", TODAY, "--by", "ana"], { cwd: WS, env: { ...process.env, FAKE_STATE: STATE, FAKE_TENANT: JSON.stringify(TENANT) } }); let json = null; try { json = JSON.parse(x.stdout); } catch { /* a stack */ } return { code: x.status, json, stderr: x.stderr }; };
    rmSync(join(STATE, "faults.json"), { force: true });
    const routine = run("refresh", [SLUG]);
    const before = readSnap();
    const lists3 = [{ kind: "most-bounced", n: 3, floor: 0 }];
    const callsBefore = argvLines().length;
    const dryList = run("change", [SLUG, `accounts.lists=${JSON.stringify(lists3)}`, "--dry-run"]);
    const sel = run("change", [SLUG, 'title="Acme health lists"', `accounts.lists=${JSON.stringify(lists3)}`]);
    const afterSel = readSnap();
    check("F-548 (F-529's root) a list change over a SELECTIVE latest pull (a routine refresh) is ranked from the account store with no pull: the dry run says so; the change saves, exits 0, done and ranked true; the snapshot holds the changed list ranked over that pull's figures; the pages are rebuilt with the other change (the title); no call; one store, the latest snapshot's",
      routine.code === 0 && routine.json.pull.mode === "selective" && routine.json.accountStore?.endsWith(".accounts.json") && dryList.code === 0 && dryList.json.consequence === "reselect" && /ranked again from the account store/.test(dryList.json.consequenceText) &&
        sel.code === 0 && sel.json.saved === true && sel.json.done?.kind === "reselect" && sel.json.done.done === true && sel.json.done.ranked === true && sel.json.done.rebuilt === true && /ranked again from the account store/.test(sel.json.done.text) &&
        isDeepStrictEqual(rk(afterSel), [["most-bounced", 3, 0, 3, null]]) && afterSel.honesty.accountSelection.lists[0].rankedAt === before.meta.pulledAt && pageText("admin").includes("Acme health lists") && argvLines().length === callsBefore &&
        isDeepStrictEqual(stores(), [snapshots().at(-1).replace(/[.]json$/, ".accounts.json")]),
      [dryList.json?.consequenceText, sel.json?.done ?? sel.json?.error ?? sel.stderr?.slice(-400), rk(before), rk(afterSel), stores(), snapshots()]);
    // The store stays beside the snapshot (F-548): no page carries it, the leaders' page least of all. Every account in
    // the store but the kept ones would otherwise reach a page; the kept accounts are all a page names.
    const storeKeys = readJson(join(dash(), SNAPSHOTS_DIR, stores()[0])).accounts;
    // The settings name accounts too (the test accounts, any pinned one): those are the spec's, never the store's.
    const keptKeys = new Set([...afterSel.dimensions.accounts.map((a) => a.key), ...(afterSel.meta.params.testAccounts ?? []), ...(afterSel.meta.params.accounts.pinned ?? [])]);
    const unkept = storeKeys.filter((k) => !keptKeys.has(k));
    check("F-548 no page carries the account store: neither the admin page nor the leaders' page holds its kind or any account it holds that the lists did not keep (and the settings do not name)",
      unkept.length > 0 && ["admin", "exec"].every((p) => !pageText(p).includes("gs-superadmin/account-store") && unkept.every((k) => !pageText(p).includes(`"${k}"`))), [unkept.slice(0, 5), ["admin", "exec"].map((p) => { const t = pageText(p); const k = unkept.find((x) => t.includes(`"${x}"`)); return k ? t.slice(Math.max(0, t.indexOf(`"${k}"`) - 200), t.indexOf(`"${k}"`) + 40) : null; })]);
    // The judge, at the runner: a full refresh over the same stand-in data ranks the changed list to the same accounts,
    // in order; a routine refresh after it ranks them itself, to the same accounts again.
    const keptAfterChange = afterSel.honesty.accountSelection.lists.map((l) => l.kept);
    const fullAfter = run("refresh", [SLUG, "--full"]);
    const fullSnap = readSnap();
    const routineAfter = run("refresh", [SLUG]);
    const routineSnap = readSnap();
    check("F-548 the list ranked from the store equals a full refresh's over the same data (the same kept accounts, in order, and the same accounts kept on the page), and a routine refresh after it ranks the list itself to the same accounts: ranked by its own pull, carried from nothing",
      fullAfter.code === 0 && fullAfter.json.pull.mode === "full" && isDeepStrictEqual(fullSnap.honesty.accountSelection.lists.map((l) => l.kept), keptAfterChange) && isDeepStrictEqual(fullSnap.dimensions.accounts.map((a) => a.key), afterSel.dimensions.accounts.map((a) => a.key)) &&
        routineAfter.code === 0 && routineAfter.json.pull.mode === "selective" && isDeepStrictEqual(routineSnap.honesty.accountSelection.lists.map((l) => l.kept), keptAfterChange) && routineSnap.honesty.accountSelection.lists.every((l) => l.rankedAt === routineSnap.meta.pulledAt && l.carriedFrom == null && l.notRanked == null) && stores().length === 1,
      [fullAfter.json?.error ?? fullAfter.stderr?.slice(-300), keptAfterChange, fullSnap.honesty?.accountSelection?.lists?.map((l) => l.kept), routineSnap.honesty?.accountSelection?.lists?.map((l) => l.kept)]);
    // MIGRATION (Bradley's contract): the latest snapshot made as 0.54.0 made it (no account store, no marker).
    const latestPath = join(dash(), SNAPSHOTS_DIR, snapshots().at(-1));
    const as054 = readJson(latestPath);
    delete as054.meta.accountStore;
    writeFileSync(latestPath, JSON.stringify(as054));
    for (const f of stores()) rmSync(join(dash(), SNAPSHOTS_DIR, f));
    const migReport = run("report", [SLUG]);
    const oldChange = run("change", [SLUG, 'accounts.lists=[{"kind":"most-bounced","n":2,"floor":0}]', 'pages.0.title="Admin before the store"']);
    const aboutInWindow = pageText("admin");
    const migrate = asPrinted(oldChange.json?.done?.remedy?.line ?? "");
    const migrated = readSnap();
    const nextRoutine = run("refresh", [SLUG]);
    check("F-548 MIGRATION: over a snapshot made before the account store the report prices the refresh it offers as the full pull it will be, with why; a list change saves, rebuilds the other change, ranks nothing and says the lists need one full pull to start ranking on every refresh, with the plain refresh line and a full pull's minutes; that line run as printed is the full pull, said (pull.why) and priced above a routine one, exit 0, no hand step and no refusal; it writes the store and ranks the changed list; the refresh after it is selective",
      oldChange.code === 0 && oldChange.json.done.ranked === false && oldChange.json.done.rebuilt === true && /made before the account store: the customer lists need one full pull to start ranking on every refresh/.test(oldChange.json.done.why) && /refresh acme-health --kb acme-prod$/.test(oldChange.json.done.remedy.line) && typeof oldChange.json.done.fullRefreshMinutes === "number" && pageText("admin").includes("Admin before the store") &&
        migrate.code === 0 && migrate.json?.pull?.mode === "full" && /the customer lists need one full pull to start ranking on every refresh/.test(migrate.json.pull.why) && migrate.json.budget.planSeconds > routineAfter.json.budget.planSeconds && stores().length === 1 &&
        isDeepStrictEqual(rk(migrated), [["most-bounced", 2, 0, 2, null]]) && nextRoutine.code === 0 && nextRoutine.json.pull.mode === "selective" &&
        migReport.code === 0 && /start ranking on every refresh/.test(migReport.json.refreshFullOnce ?? "") && migReport.json.refreshMinutes === migReport.json.fullRefreshMinutes && typeof migReport.json.refreshMinutes === "number",
      [oldChange.json?.done ?? oldChange.json?.error, migrate.json?.pull ?? migrate.json?.error ?? migrate.stderr?.slice(-300), migrate.json?.budget, routineAfter.json?.budget, rk(migrated)]);
    // F-530, second reopen (redesigned at the 0.56.1 gate; ruled by Bradley 2026-10-16: what is shown is described): in
    // the window where a list change could not rank (no store), the About tab names the lists the pull RANKED — the
    // record's, which the panels and the report draw — and says the change is waiting; once the full pull ranked the new
    // list, the waiting line is gone and the About tab names the new list alone.
    const waitingLine = `A change of the customer lists is waiting for the next refresh: the 2 most bounced. Until then the pages show the lists the pull of ${String(as054.meta.pulledAt).slice(0, 10)} ranked.`;
    const rankedThen = as054.meta.params.accounts.lists.map(listPhrase);
    const migratedLists = readSnap().meta.params.accounts.lists;
    check("F-530 (reopened) the About tab in the no-store window describes what is shown: the lists the old snapshot was ranked with (named as the pull ranked them), with the waiting line naming the change (the 2 most bounced) and the pull it waits behind; after the full pull the About tab names the 2 most bounced alone, with no waiting line",
      aboutInWindow.includes(waitingLine) && rankedThen.every((p) => aboutInWindow.includes(p)) && !pageText("admin").includes("waiting for the next refresh") && pageText("admin").includes("the 2 most bounced") && migratedLists.length === 1,
      [aboutInWindow.includes(waitingLine), rankedThen, rankedThen.map((p) => aboutInWindow.includes(p)), pageText("admin").includes("waiting for the next refresh"), migratedLists]);
    // The edit screen (F-516's closing step) says the same over a routine refresh: its consequence and its first option.
    run("new", [SLUG]);
    const detail = run("next", [SLUG, "--question", "customer-list-detail"]);
    run("answer", [SLUG, "customer-list-detail", composeAnswer(detail.json.question.options[1], { "most-bounced": "4 1" })]);
    const editClose = run("next", [SLUG]);
    const editPreview = run("answer", [SLUG, "dry-run", "yes"]);
    const previewAdmin = editPreview.json?.preview?.pages?.find((p) => p.page === "admin")?.path;
    check("F-548 the edit's preview from the last pull (no call) ranks the draft's customer lists from the store in memory: its Most bounced panel states the draft's list (4, at least 1 delivered; the saved dashboard's one list, so the question offered that list alone), as its About tab does, and the saved snapshot is not rewritten",
      editPreview.code === 0 && editPreview.json.preview?.fromLastPull === true && !!previewAdmin && readFileSync(previewAdmin, "utf8").includes("The 4 most bounced (at least 1 delivered) across programs") && readSnap().meta.params.accounts.lists.every((l) => l.n !== 4),
      [editPreview.json?.preview ?? editPreview.json?.error, readSnap().meta.params.accounts.lists]);
    run("answer", [SLUG, "estimate", "yes"]);
    const editDone = run("answer", [SLUG, "save", "yes"]);
    check("F-548 the edit's closing step over a routine refresh: the ask says the customer lists are ranked again from the account store (a rebuild, no pull), the first option reads 'Save and rank the customer lists again now (no pull)', and the save's done says ranked true",
      editClose.code === 0 && /the customer lists are ranked again from the account store beside the last pull \(a rebuild, no pull\)/.test(editClose.json.closing.ask) && editClose.json.closing.options[0].text === "Save and rank the customer lists again now (no pull)" &&
        editDone.code === 0 && editDone.json.done?.kind === "reselect" && editDone.json.done.ranked === true && editDone.json.done.rebuilt === true, [editClose.json?.closing, editDone.json?.done ?? editDone.json?.error]);
    // F-530 reopened at B-V — the CLASS, not its three samples: with the lists set to one most-bounced list of 5 and no
    // floor, every text any surface renders about the customer lists names that list alone, its 5 and its floor (the
    // page's panel and its About tab's Pages and Accounts entries, the report, the edit's question, follow-ups and
    // closing ask), and an edit answered keep (or default) leaves the saved lists as they were.
    const one = run("change", [SLUG, 'accounts.lists=[{"kind":"most-bounced","n":5,"floor":0}]']);
    const visible = (html) => html.replace(/<script[\s\S]*?<\/script>/g, "");
    const listDds = (html) => [...visible(html).matchAll(/<dd>([^<]*customers[^<]*)<\/dd>/g)].map((m) => m[1]);
    const panelOf = (html, id) => visible(html).split(`data-panel="${id}"`)[1]?.split("</section>")[0] ?? "";
    const accountsDd = (html) => visible(html).match(/<dt>Accounts<\/dt>\s*<dd>([^<]*)<\/dd>/)?.[1] ?? "";
    const admin = pageText("admin");
    const oneReport = run("report", [SLUG]);
    const intro = oneReport.code === 0 ? (readFileSync(oneReport.json.report, "utf8").split("## Account watch list")[1] ?? "").split("\n").find((l) => l.startsWith("Across programs")) ?? "" : "";
    run("new", [SLUG]);
    const oneQ = run("next", [SLUG, "--question", "customer-list-detail"]);
    const sizes = oneQ.json?.question?.options?.find((o) => o.id.startsWith("sizes:"));
    run("answer", [SLUG, "customer-list-detail", composeAnswer(sizes, { "most-bounced": "keep" })]);
    const afterKeep = readJson(draftFile()).spec.accounts.lists;
    run("answer", [SLUG, "customer-list-detail", "default"]);
    const afterDefault = readJson(draftFile()).spec.accounts.lists;
    run("answer", [SLUG, "customer-list-detail", composeAnswer(sizes, { "most-bounced": "6 0" })]);
    const afterSix = readJson(draftFile()).spec.accounts.lists;
    const oneClose = run("next", [SLUG]);
    rmSync(draftFile(), { force: true });
    const texts = [...listDds(admin), accountsDd(admin), intro, oneQ.json?.question?.ask ?? "", ...(sizes?.followUps ?? []).map((f) => f.ask)];
    check("F-530 the class: one most-bounced list of 5 with no floor is the list every surface names — the About tab's three list panels (the most-bounced one 'the 5 most bounced', the other two 'no … list is kept') and its Accounts entry, the panel's note, the report's intro (its one reading, no low-cadence sentence), the edit's question and its one follow-up — and no list text says 25 or names another list; keep and default leave the saved list as it was, '6 0' changes it alone, and the closing ask counts one setting",
      one.code === 0 && one.json.done?.ranked === true && listDds(admin).length === 3 && listDds(admin).some((t) => /Most bounced customers.*the 5 most bounced, as the pull ranked it\./.test(t)) && listDds(admin).filter((t) => /no most engaged list is kept|no least engaged list is kept/.test(t)).length === 2 &&
        /the 5 most bounced/.test(accountsDd(admin)) && !/most engaged|least engaged/.test(accountsDd(admin)) && panelOf(admin, "most-bounced").includes("The 5 most bounced across programs over the whole window") &&
        /kept: the 5 most bounced\. Possible bad contacts: never a verdict on a customer\.$/.test(intro) &&
        /This dashboard makes 1 list across programs: the 5 most bounced\./.test(oneQ.json?.question?.ask ?? "") && oneQ.json.question.options[0].text === "Keep the lists as they are (the default)" && isDeepStrictEqual(sizes?.followUps?.map((f) => f.key), ["most-bounced"]) &&
        texts.every((t) => !/\b25\b/.test(t)) &&
        isDeepStrictEqual(afterKeep, [{ kind: "most-bounced", n: 5, floor: 0 }]) && isDeepStrictEqual(afterDefault, [{ kind: "most-bounced", n: 5, floor: 0 }]) && isDeepStrictEqual(afterSix, [{ kind: "most-bounced", n: 6, floor: 0 }]) &&
        /changes 1 setting \(accounts\.lists\[\]\)/.test(oneClose.json?.closing?.ask ?? ""),
      [one.json?.done ?? one.json?.error, listDds(admin), accountsDd(admin), intro, oneQ.json?.question?.ask, afterKeep, afterDefault, afterSix, oneClose.json?.closing?.ask?.slice(0, 200)]);
    // The tester's role-inverted line (F-530, B-V re-verification, N4; Bradley's ruling): the edit question's low-cadence
    // sentence is said only beside a least-engaged list, the rule the report's intro follows. Held both ways here (the
    // tester noted no suite asserted it); the builder's confirm.
    const LOW = "On a program that sends about once per contact, a least-engaged list uses at least 3 delivered and no open instead of its floor.";
    const detailAsk = (lists) => askText(q("customer-list-detail"), { ...PLAN_CTX, spec: { ...PLAN_CTX.spec, accounts: { ...PLAN_CTX.spec.accounts, lists } } });
    check("F-530 (the tester's role-inverted line, confirmed by the builder): the edit question's low-cadence sentence is said beside a least-engaged list and only there — absent over one most-bounced list, present over a most-bounced and a least-engaged list; the default lists keep the ruled wording",
      !detailAsk([{ kind: "most-bounced", n: 5, floor: 0 }]).includes(LOW) && detailAsk([{ kind: "most-bounced", n: 5, floor: 0 }, { kind: "least-engaged", n: 10, floor: 5 }]).includes(LOW) && askText(q("customer-list-detail"), PLAN_CTX) === RULED["customer-list-detail"],
      [detailAsk([{ kind: "most-bounced", n: 5, floor: 0 }]), detailAsk([{ kind: "most-bounced", n: 5, floor: 0 }, { kind: "least-engaged", n: 10, floor: 5 }])]);
    // F-544: snapshots are ordered by the instant their pull time parses to, never by the name. A pull an hour LATER
    // named EARLIER (the clock moved back: its local time with the offset dropped sorts first), and a same-second pair
    // whose collision suffix sorts before the plain name: the latest is the newest instant; retention trims the oldest.
    {
      const dir = join(dash(), SNAPSHOTS_DIR);
      const newest = readSnap();
      const later = structuredClone(newest);
      later.meta.pulledAt = new Date(Date.parse(newest.meta.pulledAt) + 3600000).toISOString();
      writeFileSync(join(dir, "20000101T000000.json"), JSON.stringify(later));
      const status = run("status", [SLUG]);
      check("F-544 the latest snapshot is the newest INSTANT: a pull an hour after the newest, named with a local time that sorts first, is the one status reads (the name order would read the older pull)",
        status.code === 0 && status.json.lastPull.pulledAt === later.meta.pulledAt && status.json.lastPull.file.endsWith("20000101T000000.json"), [status.json?.lastPull, later.meta.pulledAt]);
      rmSync(join(dir, "20000101T000000.json"));
    }
    // F-534: the dashboard report prices the ROUTINE refresh it offers (the last plan's own run, a selective one here),
    // never the full pull's figure, and carries what the snapshot holds, so a named program can be checked against it.
    const r534 = run("refresh", [SLUG]);
    const plan534 = r534.json?.run ? readJson(join(WS, ".gs-superadmin", "tmp", "engagement", r534.json.run, "plan.json")) : null;
    const mins = (sec) => Math.max(1, Math.round(sec / 60));
    const rep = run("report", [SLUG, "--csv-dir", join(ROOT, "r12", "report-csv")]);
    const repSnap = readSnap();
    const shown = rep.json?.held?.programs?.filter((x) => x.shown) ?? [];
    // The report quotes the plan's parts at TODAY's pace (F-575, the owed item): the refresh above wrote both pace
    // files after its plan, so the figure is the plan's calls by family at the files as they stand — summed here
    // independently of the engine, as the change check above does.
    const pace534 = (() => { const t = { ...CALL_SECONDS }; for (const f of [join(KB, KB_PACE_FILE), join(dash(), PACE_FILE)]) if (existsSync(f)) for (const [fam, x] of Object.entries(readJson(f).families)) if (x.seconds > 0) t[fam] = x.seconds; return t; })();
    const priceNow = (byFamily) => Math.round(Object.entries(byFamily ?? {}).reduce((s, [f, n]) => s + n * (pace534[f] ?? 7), 0) * 100) / 100;
    check("F-534 the dashboard report after a routine refresh: refreshMinutes is that refresh's own price (its plan's thisRun, below the full pull's seconds; fullRefreshMinutes the full pull's) at today's pace (F-575: the plan's calls by family at the pace files, a straight sum here), held names the pull's window and selection and every program it holds with its statuses, `shown` agreeing with the report's own count of programs shown, and --csv-dir writes the CSVs",
      rep.code === 0 && plan534?.estimate?.mode === "selective" && plan534.estimate.thisRun.seconds < plan534.estimate.full.seconds && rep.json.refreshSeconds === priceNow(plan534.estimate.thisRun.byFamily) && rep.json.refreshMinutes === mins(priceNow(plan534.estimate.thisRun.byFamily)) && rep.json.fullRefreshMinutes === mins(priceNow(plan534.estimate.full.byFamily)) && rep.json.held.programs.length === repSnap.dimensions.programs.length && rep.json.held.window.from === repSnap.meta.window.from && rep.json.held.window.to === repSnap.meta.window.to && typeof rep.json.held.selection === "string" &&
        shown.length === rep.json.counts.programsShown && rep.json.held.programs.some((x) => !x.shown) && rep.json.csvFiles.length > 0 && existsSync(join(ROOT, "r12", "report-csv")) && run("list", []).json?.dashboards?.find((d) => d.slug === SLUG)?.holds?.programs === repSnap.dimensions.programs.length,
      [rep.json?.refreshMinutes, rep.json?.fullRefreshMinutes, plan534?.estimate?.mode, plan534?.estimate?.thisRun?.seconds, plan534?.estimate?.full?.seconds, rep.json?.counts, shown.length, rep.json?.error]);
    // F-534 reopen (R12-A-V): a dashboard selected by "sent since" holds the adapter's RESOLVED selector ({spec, date},
    // from engagement.mjs resolveParams — never restated here), and held / holds say it in words. acme-health selects
    // the whole window, so its snapshot is copied with that selector and imported into the second workspace.
    const sinceSel = resolveParams({ sentSince: "90d", today: TODAY }).selector;
    writeFileSync(join(ROOT, "r12", "since.snapshot.json"), JSON.stringify({ ...repSnap, meta: { ...repSnap.meta, params: { ...repSnap.meta.params, selector: sinceSel } } }));
    const ws2 = ["--workspace", WS2, "--kb", KB2, "--bin", FAKE, "--today", TODAY, "--by", "cy"];
    const sinceExport = run("export", [SLUG, "--out", join(ROOT, "r12", "since.json")]);
    const sinceImport = run("import", ["--file", join(ROOT, "r12", "since.json"), "--slug", "acme-since", "--snapshot", join(ROOT, "r12", "since.snapshot.json")], { flags: ws2 });
    const sinceRep = run("report", ["acme-since"], { flags: ws2 });
    const sinceHolds = run("list", [], { flags: ws2 }).json?.dashboards?.find((d) => d.slug === "acme-since")?.holds;
    const sinceWords = `the programs that sent since ${sinceSel.sentSince.date} (90d, counted back from the pull's day)`;
    check("F-534 a dashboard selected by 'sent since' says its selection in words, in the report's held and in list's holds: the resolved date and the asked span, never a structured value",
      sinceExport.code === 0 && sinceImport.code === 0 && sinceRep.code === 0 && sinceRep.json.held.selection === sinceWords && sinceHolds?.selection === sinceWords,
      [sinceImport.json?.error, sinceRep.json?.held?.selection, sinceHolds?.selection]);
    // F-535: a dashboard whose slug another extends (acme, beside acme-health), saved with no pull: its change is priced
    // from no plan, never from acme-health's runs; and F-532: imported under another slug it publishes its own file.
    const exported = run("export", [SLUG, "--out", join(ROOT, "r12", "acme-health.json"), "--with-snapshot"]);
    const asAcme = run("import", ["--file", join(ROOT, "r12", "acme-health.json"), "--slug", "acme", "--snapshot", join(ROOT, "nope.json")]);
    const asAcmeOk = run("import", ["--file", exported.json?.out ?? "", "--slug", "acme"]);
    check("F-532 imported under another slug the dashboard takes its own publish file (acme-leaders.html, not acme-health's), and the import says so; F-540 a snapshot that cannot be opened refuses the import with nothing written first",
      exported.code === 0 && asAcme.code === 1 && /nothing was imported/.test(asAcme.json?.error ?? "") && asAcmeOk.code === 0 && asAcmeOk.json.publishRenamed?.to === "acme-leaders.html" && asAcmeOk.json.publishRenamed.from === "acme-health-leaders.html" && /goes to acme-leaders\.html, not acme-health-leaders\.html/.test(asAcmeOk.json.publishRenamed.text) && /** @type {*} */ (openSpec(readJson(specFile("acme"))).publish.config).file === "acme-leaders.html",
      [asAcme.json, asAcmeOk.json]);
    rmSync(join(dash("acme"), SNAPSHOTS_DIR), { recursive: true, force: true });
    const priced = run("change", ["acme", "health.silentDays=60", "--dry-run"]);
    check("F-535 a dashboard whose slug another's extends, with no pull of its own, prices a change from NO plan: never acme-health's run directories (dash-acme-health-… begins with dash-acme-)",
      priced.code === 0 && priced.json.consequence === "pull" && priced.json.pullSeconds === null && /a first pull's time \(no plan yet\)/.test(priced.json.consequenceText) && runDirs().some((d) => d.startsWith("dash-acme-health-")), priced.json);
    const owners = runDirs().map((d) => ({ d, o: runOwner(d) }));
    const slugs = new Set(readdirSync(join(KB, "dashboards")));
    check("F-535 every run directory the walk made reads back to its owner by the one grammar (a dashboard of this KB, a kind among plan, preview, account and pull); a slug that holds a core reads back whole; another name owns nothing",
      owners.length > 5 && owners.every(({ d, o }) => d.startsWith("adhoc-") || (o && slugs.has(o.slug) && ["plan", "preview", "account", "pull"].includes(o.kind))) &&
        isDeepStrictEqual(runOwner("dash-renewals-emea-20261015T120000"), { slug: "renewals-emea", kind: "pull" }) && isDeepStrictEqual(runOwner("dash-a-plan-0123456789-plan-abcdef0123-lb90-2"), { slug: "a-plan-0123456789", kind: "plan" }) && isDeepStrictEqual(runOwner("dash-q-20261015T120000-20261016T080000-3"), { slug: "q-20261015T120000", kind: "pull" }) && isDeepStrictEqual(runOwner("dash-acme-health-20260915T180000-2-lb91"), { slug: "acme-health", kind: "pull" }) && runOwner("dash-x") === null && runOwner("adhoc-account-0123456789") === null,
      owners.filter(({ d, o }) => !d.startsWith("adhoc-") && !(o && slugs.has(o.slug))));
    // F-532: two specs of one KB never share a target and file; the refusal names the other dashboard, case-blind.
    const specBefore = readFileSync(specFile("acme"), "utf8");
    const steal = run("change", ["acme", 'publish.config.file="acme-health-leaders.html"']);
    const stealCase = run("change", ["acme", 'publish.config.file="ACME-HEALTH-LEADERS.html"']);
    check("F-532 a publish file another dashboard of the KB publishes to is refused (case-blind: a Windows folder does not tell the cases apart), naming that dashboard; nothing is saved and no draft is left",
      steal.code === 1 && /the dashboard "acme-health"'s \(acme-health-leaders\.html in the target "leaders"\)/.test(steal.json?.error ?? "") && stealCase.code === 1 && /"acme-health"/.test(stealCase.json?.error ?? "") && readFileSync(specFile("acme"), "utf8") === specBefore && !existsSync(draftFile("acme")), [steal.json, stealCase.json]);
    // F-540: a snapshot of another tenant under --replace leaves the saved spec as it was.
    const bad = structuredClone(readSnap()); bad.meta.tenantHost = "acme--sbx.gainsightcloud.com";
    writeFileSync(join(ROOT, "r12", "other-tenant.snapshot.json"), JSON.stringify(bad));
    const replaced = run("import", ["--file", exported.json?.out ?? "", "--slug", "acme", "--replace", "--snapshot", join(ROOT, "r12", "other-tenant.snapshot.json")]);
    check("F-540 an import whose snapshot belongs to another tenant is refused before the spec is written: under --replace the saved spec is byte for byte as it was",
      replaced.code === 1 && /pulled from acme--sbx\.gainsightcloud\.com.*nothing was imported/.test(replaced.json?.error ?? "") && readFileSync(specFile("acme"), "utf8") === specBefore, replaced.json);
    // F-537: a window that has not started is refused at the answer and at change, naming the setting; never a stack.
    const future = run("change", ["acme", 'sources.0.params.window={"kind":"since","from":"2026-12"}']);
    check("F-537 a since month that has not started (2026-12 on 2026-09-15) is refused at change, naming sources[0].params.window.from, with no stack trace and nothing saved",
      future.code === 1 && /sources\[0\]\.params\.window\.from \(2026-12\) is a month that has not started \(this month is 2026-09\)/.test(future.json?.error ?? "") && readFileSync(specFile("acme"), "utf8") === specBefore && !existsSync(draftFile("acme")) && !/\n\s+at /.test(future.stderr) &&
        /has not started/.test((() => { try { q("window").apply("since:2027-01", { today: TODAY }); return ""; } catch (e) { return e.message; } })()) && (() => { try { q("window").apply("fixed:2026-01:2026-06", { today: TODAY }); return true; } catch { return false; } })(), future.json ?? future.stderr?.slice(-400));
    // F-539: a named dashboard with no pull yet: the account summary says so in the field the skill's Checks rule reads.
    const someAccount = readSnap().dimensions.accounts.map((a) => a.key).find((k) => readSnap().facts.byAccount.some((r) => r.accountKey === k && r.sent > 0));
    const noPullAcct = run("account", ["acme", "--account-id", someAccount]);
    const unknownAcct = run("account", ["acme", "--account-id", "co-nobody"]);
    check("F-539 an account timeline named with a dashboard that has no pull yet carries againstSnapshot null (the skill's 'not compared with the dashboard: it has no pull yet'), and an unknown GSID exits 6 with no candidates and an error to relay",
      noPullAcct.code === 0 && noPullAcct.json.againstSnapshot === null && noPullAcct.json.slug === "acme" && unknownAcct.code === EXIT["needs-pick"] && (unknownAcct.json?.resolution?.candidates ?? []).length === 0 && typeof unknownAcct.json?.error === "string" && unknownAcct.json.error.length > 0,
      [noPullAcct.json?.againstSnapshot, noPullAcct.json?.error, unknownAcct.code, unknownAcct.json]);
    rmSync(dash("acme"), { recursive: true, force: true });
    // F-533: a pull started by `change` that stops partial (exit 4) carries the refresh line as remedy.line; that line,
    // run as printed, finishes it, while re-issuing the change finds nothing to change (the reported failure).
    rmSync(join(STATE, "faults.json"), { force: true });
    const UNSPLIT = '"to":"ao_participants"}]}}] --where-filters {"conditions":[{"leftOperand":{"fieldName":"TestParticipant"},"operator":"EQ","rightOperand":{"value":false}}]}';
    const stop4 = run("change", [SLUG, "sources.0.params.repullMonths=3"], { env: { FAKE_FAULTS: JSON.stringify([{ match: UNSPLIT, kind: "timeout", times: 2 }]) } });
    const reissued = run("change", [SLUG, "sources.0.params.repullMonths=3"]);
    const finished = asPrinted(stop4.json?.remedy?.line ?? "");
    check("F-533 a pull-priced change that stops partial exits 4 with the refresh line as remedy.line; re-issuing the change finds nothing to change (exit 0, saved false: the failure the skill's old rule walked into), and the remedy line run as printed finishes the pull",
      stop4.code === EXIT.partial && /refresh acme-health --kb acme-prod$/.test(stop4.json?.remedy?.line ?? "") && reissued.code === 0 && reissued.json.saved === false && reissued.json.consequenceText === "nothing changed" && finished.code === 0 && finished.json?.status === "ok" && finished.json.resumed === true,
      [stop4.code, stop4.json?.remedy, reissued.json?.consequenceText, finished.json?.error ?? finished.stderr?.slice(-300)]);
    // F-538: the skill's narrow re-documentation line passes describe-batch the same --command and --doc-mode as the
    // entry command's own re-documenter (its twin), read from the script, never restated here.
    const src = readFileSync(SCRIPT, "utf8");
    const twinCommand = /"--command", "([^"]+)", "--doc-mode", "([^"]+)"/.exec(src.slice(src.indexOf("function redocument")))?.slice(1) ?? [];
    const skillDescribe = readFileSync(join(HERE, "..", "skills", "email-engagement", "SKILL.md"), "utf8").split("\n").filter((l) => /describe-batch\.mjs .*--keys-file <estimate\.kb\.keysFile>/.test(l));
    check("F-538 the skill's program re-documentation line carries the --command and --doc-mode the script twin passes (read from dashboard.mjs's redocument)",
      twinCommand.length === 2 && skillDescribe.length === 1 && skillDescribe[0].includes(`--command "${twinCommand[0]}"`) && skillDescribe[0].includes(`--doc-mode ${twinCommand[1]}`), [twinCommand, skillDescribe]);
  }

  // ══ Retention; the fast path (F-512); refusals ════════════════════════════
  {
    const dir = join(dash(), SNAPSHOTS_DIR);
    for (let i = 0; i < KEEP_SNAPSHOTS + 2; i++) writeFileSync(join(dir, `2020010${String(i).padStart(2, "0")}T0000.json`), "{}");
    const r = run("rebuild", [SLUG]);
    const after = run("refresh", [SLUG]);
    check("retention: a refresh keeps the newest 13 snapshots and names what it pruned; rebuild reads the newest", r.code === 0 && after.code === 0 && after.json.pruned.length > 0 && snapshots().length === KEEP_SNAPSHOTS, [after.json?.pruned?.length, snapshots().length]);
  }
  const fast = run("new", ["quick", "--fast-path"]);
  const fastNext = run("next", ["quick"]);
  const quick = readJson(draftFile("quick")).spec;
  check("the fast path (F-512): next answers every question but the closing step with the question's own default, through its own apply, and arrives at the closing step with the plan made on the way: the programs are those that sent in the last 90 days (not every program), the window the default, the recipients three none, the look skipped (never asked twice), no customer lists, no step detail; the leaders' names and the lists' detail skipped (lists off)",
    fast.code === 0 && fast.json.fastPath === true && fastNext.code === 0 && fastNext.json?.question?.id === "dry-run" && fastNext.json.closing?.options?.length === 4 && isDeepStrictEqual(fastNext.json.defaulted, ["programs", "window", "grouping", "internal-domains", "test-accounts", "unsubscribe-links", "failure-settings", "look", "tabs", "customer-lists", "step-detail", "expected-reasons", "leaders-copy"]) && isDeepStrictEqual(fastNext.json.progress.skipped, ["leader-names", "customer-list-detail"]) &&
      quick.sources[0].params.selector.sentSince === "90d" && quick.sources[0].params.windowMonths === 13 && isDeepStrictEqual(quick.sources[0].params.internalDomains, []) && quick.accounts.pull === false && quick.sources[0].params.stepDetail === false && !quick.theme && readJson(draftFile("quick")).answered.includes("look"), [fastNext.json?.defaulted, fastNext.json?.progress, quick.sources?.[0]?.params?.selector]);
  check("the fast path's grouping is the characteristic rules the proposal leads with: Recurring / One-off at the top level, each model among the selected programs beneath, so the standard dashboard is grouped (F-512 b); the rules are written through the writer",
    quick.groups.rules.length >= 3 && isDeepStrictEqual(quick.groups.rules.slice(0, 2).map((x) => [x.level, x.characteristic, x.is, x.label]), [["supergroup", "recurring", true, "Recurring"], ["supergroup", "recurring", false, "One-off"]]) && quick.groups.rules.slice(2).every((x) => x.level === "group" && x.characteristic === "model" && typeof x.is === "string" && typeof x.label === "string") && quick.groups.rules.some((x) => x.is === "DRIPV2" && x.label === "Email Chain"), quick.groups);
  // The same spec by hand: every question answered with its own default, in order, on a second draft.
  run("new", ["quick2"]);
  for (const x of QUESTIONS.filter((y) => !["preflight", "action"].includes(y.kind))) {
    if (["leader-names", "customer-list-detail"].includes(x.id)) continue;
    const value = x.id === "grouping" ? JSON.stringify(quick.groups) : defaultAnswer(x, PLAN_CTX);
    const a = run("answer", ["quick2", x.id, value]);
    if (a.code !== 0) console.log(`      (quick2 ${x.id}: ${a.json?.error ?? a.stderr?.slice(-200)})`);
  }
  const quick2 = readJson(draftFile("quick2")).spec;
  // The leaders' copy's file is named after the dashboard (two dashboards may share a folder): the slug apart, it too.
  const strip = (s) => { const { slug: _s, title: _t, ...rest } = s; return JSON.parse(JSON.stringify(rest).split(`"${s.slug}-leaders.html"`).join('"<slug>-leaders.html"')); };
  check("the fast-path spec EQUALS the spec of answering every question with its default by hand (one source for a default, never two), the slug and title apart",
    isDeepStrictEqual(strip(quick), strip(quick2)), [JSON.stringify(strip(quick)).slice(0, 400), JSON.stringify(strip(quick2)).slice(0, 400)]);
  // F-543: the tenant's failure categories edited the same day after the closing step's plan: the plan's run id carries
  // them, so the save's first refresh plans afresh instead of resuming a plan made without them (which prepareRun
  // refuses as "other flags", a remedy the dashboard cannot run).
  {
    run("new", ["cats", "--fast-path"]);
    run("next", ["cats"]);
    writeFileSync(join(KB, "failure-categories.json"), JSON.stringify({ bounceReasons: FIXTURE_BOUNCE_CATEGORIES, participantFailures: [] }));
    run("answer", ["cats", "dry-run", "no"]);
    run("answer", ["cats", "estimate", "yes"]);
    const quickSaved = run("answer", ["cats", "save", "yes"]);
    rmSync(dash("cats"), { recursive: true, force: true });
    rmSync(join(KB, "failure-categories.json"), { force: true });
    check("F-543 a category file written the same day after the plan: the save's first refresh completes (a new plan under a run id that carries the categories), never prepareRun's 'pass the same flags' refusal",
      quickSaved.code === 0 && quickSaved.json?.refresh?.status === "ok" && !/same flags|new --run/.test(quickSaved.json?.error ?? ""), quickSaved.json?.error ?? quickSaved.json?.refresh?.pull);
  }
  const questionsVerb = run("questions", []);
  check("the `questions` verb: every row with its ask and options as a reader sees them (the ruled letters where a figure comes from the plan), the defaults, and the closing step beside its three rows; `costs` the cost table",
    questionsVerb.code === 0 && questionsVerb.json.questions.length === QUESTIONS.length && questionsVerb.json.questions.find((x) => x.id === "window").ask.includes("about M minutes for each month covered") && questionsVerb.json.questions.find((x) => x.id === "programs").default === "sent-90d" && questionsVerb.json.questions.find((x) => x.id === "grouping").default === "(from the plan)" &&
      questionsVerb.json.questions.find((x) => x.id === "tabs").options[1].followUps.length === 4 && isDeepStrictEqual(questionsVerb.json.closing.rows, ["dry-run", "estimate", "save"]) && /your login has about T minutes left/.test(questionsVerb.json.closing.ask) && run("costs", []).json?.costs?.title === "rebuild", questionsVerb.json?.questions?.map((x) => x.id));
  // F-526: the claude.ai artifact target is not offered while backlog LTR-23 stands (ruled at S7-V): no question's ask
  // or option offers it, an answer that names it is refused, and neither the README's dashboard section nor the skill
  // states an artifact publish as one short session. T-11 keeps the value (the runner's checks above still drive it).
  {
    const readme = readFileSync(join(HERE, "..", "README.md"), "utf8");
    const dashboardSection = readme.slice(readme.indexOf("### The engagement dashboard"), readme.indexOf("## Tenant-wide dependency search"));
    const skill = readFileSync(join(HERE, "..", "skills", "email-engagement", "SKILL.md"), "utf8");
    const offered = (questionsVerb.json?.questions ?? []).filter((x) => /artifact/i.test(JSON.stringify([x.ask, x.options]))).map((x) => x.id);
    const named = run("answer", ["quick", "leaders-copy", "artifact"]);
    check("F-526 the artifact offer is withdrawn: no question of the interview offers a claude.ai artifact in its ask or its options, an answer naming it is refused as no option, the README's dashboard section has no artifact recipe, and no shipped prose (README, skill, the spec's About sentence) prices an artifact publish as one short session; the skill's step L2 says it is not offered",
      questionsVerb.code === 0 && offered.length === 0 && named.code === 1 && /"artifact" is not one of the options: folder:<folder>, folder-later, none/.test(named.json?.error ?? "") && dashboardSection.length > 1000 && !/artifact/i.test(dashboardSection) &&
        ![readme, skill, readFileSync(join(HERE, "..", "scripts", "dashboard-spec.mjs"), "utf8"), readFileSync(SCRIPT, "utf8")].some((t) => /one short (Claude )?session/i.test(t)) && /### L2 — Publish the artifact \(not offered/.test(skill),
      { offered, named: named.json?.error, section: dashboardSection.match(/.{0,80}artifact.{0,80}/i)?.[0] });
  }
  // F-528: native Gainsight reports are not offered while backlog LTR-26 stands (ruled at S8-V): the report builder
  // cannot finish what native-plan creates. The verbs, dashboard-native.mjs and T-11's `native` record stay (their own
  // suites drive them); what is refused is the OFFER, read over WHOLE files, never chosen spans (F-528-V: an offer in the
  // README's skill table and the skill's Step 1 router both passed a span-bounded check): the mode's words — "native"
  // and "Gainsight reports" — anywhere in the skill (its one not-offered sentence set aside), the plugin README (its
  // unrelated "native safety layer" set aside) or the repo README, and `rp create` / `rp update` anywhere in the skill
  // (the plugin README's guard section names them for its own reasons); a mode N section; a tenant-mutation exception
  // in the skill's description or ground rules; a native line in the CHANGELOG's 0.54.0 entry other than the one saying
  // it is not offered.
  {
    const offer = /\bnative\b|\bGainsight\s+reports\b/i;
    const readme = readFileSync(join(HERE, "..", "README.md"), "utf8");
    const readmeRead = readme.replace(/\bno native safety layer\b/, "");
    const repoReadme = readFileSync(join(HERE, "..", "..", "..", "README.md"), "utf8");
    const skill = readFileSync(join(HERE, "..", "skills", "email-engagement", "SKILL.md"), "utf8");
    const notOffered = /Native\s+Gainsight reports made from a dashboard are not offered[\s\S]*?say so and stop\./g;
    const skillRead = skill.replace(notOffered, "");
    const front = skill.slice(0, skill.indexOf("\n---", 4));
    const description = front.match(/^description: (.*)$/m)?.[1] ?? "";
    const hint = front.match(/^argument-hint: (.*)$/m)?.[1] ?? "";
    const modeList = skill.slice(skill.indexOf("Its modes:"), skill.indexOf("## Ground rules"));
    const groundRules = skill.slice(skill.indexOf("## Ground rules"), skill.indexOf("## Arguments"));
    const changelog = readFileSync(join(HERE, "..", "CHANGELOG.md"), "utf8");
    const at = changelog.indexOf("## 0.54.0");
    const entry = changelog.slice(at, changelog.indexOf("\n## ", at + 1)).split(/\n(?=- )/).filter((b) => !b.startsWith("- **Native Gainsight reports are not offered.**")).join("\n");
    const exception = /\b(except|but for|exception)\b|native|rp create|rp update/i;
    const where = (text) => text.match(new RegExp(`.{0,80}(?:${offer.source}).{0,80}`, "i"))?.[0];
    check("F-528 native reports are not offered: no word of the mode (native, Gainsight reports) anywhere in the skill but its one not-offered sentence, in the plugin README or in the repo README, and no rp create / rp update in the skill; no mode N section; the skill's description ends \"Never mutates the tenant.\" and neither it nor the ground rules carry an exception; the CHANGELOG's 0.54.0 entry names native reports only to say they are not offered",
      (skill.match(notOffered) ?? []).length === 1 && !offer.test(skillRead) && !/\brp\s+(?:create|update)\b/i.test(skill) && !/^##+ N\b/m.test(skill) && hint.length > 100 && modeList.length > 500 &&
        /Never mutates the tenant\.$/.test(description) && !exception.test(description) && /Read-only tenant\./.test(groundRules) && !exception.test(groundRules) &&
        readme.includes("### The engagement dashboard") && !offer.test(readmeRead) && repoReadme.includes("/gs-superadmin:email-engagement") && !offer.test(repoReadme) &&
        at >= 0 && /Native Gainsight reports are not offered/.test(changelog.slice(at)) && !/native/i.test(entry),
      { skill: where(skillRead), readme: where(readmeRead), repoReadme: where(repoReadme), description: description.slice(-160), rule: groundRules.match(/.{0,60}(except|but for|exception|native).{0,60}/i)?.[0], entry: entry.match(/.{0,80}native.{0,80}/i)?.[0] });
  }
  // ══ R13 polish round (2026-10-15): F-536 the value grammar, F-541 the repair path, F-545 the lock first, F-542 the restart ══
  {
    rmSync(join(STATE, "faults.json"), { force: true });
    const specBefore = readFileSync(specFile(), "utf8");
    // F-536: the parser, in process — JSON when it parses; a bare value by the setting's kind; @file; a cmd-literal pair.
    const refusal = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
    const groupsFile = join(ROOT, "groups-f536.json");
    writeFileSync(groupsFile, JSON.stringify({ rules: [], overrides: {} }));
    check("F-536 change's value: JSON when it parses (true, 45, a JSON list); otherwise by the setting's kind — a list as comma-separated items, trimmed, `none` empty, a shell-stripped [a,b] the same list; a yes/no setting as yes or no (anything else refused by name); any other setting the bare text; @<file> the file's JSON; a missing file a refusal naming it",
      changeValue("accounts.pull", "true") === true && changeValue("health.silentDays", "45") === 45 && isDeepStrictEqual(changeValue("sources.0.params.internalDomains", '["acme.com"]'), ["acme.com"]) &&
        isDeepStrictEqual(changeValue("sources.0.params.internalDomains", "acme.com, acme.co.uk"), ["acme.com", "acme.co.uk"]) && isDeepStrictEqual(changeValue("sources.0.params.internalDomains", "[acme.com,acme.co.uk]"), ["acme.com", "acme.co.uk"]) &&
        isDeepStrictEqual(changeValue("sources.0.params.internalDomains", "none"), []) && isDeepStrictEqual(changeValue("sources.0.params.testAccounts", "c-1"), ["c-1"]) &&
        changeValue("sources.0.params.stepDetail", "yes") === true && changeValue("accounts.pull", "no") === false && /is not yes or no/.test(refusal(() => changeValue("accounts.pull", "maybe")) ?? "") &&
        changeValue("title", "Renewals EMEA") === "Renewals EMEA" && changeValue("pages.1.title", "2026 plan") === "2026 plan" &&
        isDeepStrictEqual(changeValue("groups", `@${groupsFile}`), { rules: [], overrides: {} }) && /cannot read the value as JSON from .*missing-f536\.json/.test(refusal(() => changeValue("groups", `@${join(ROOT, "missing-f536.json")}`)) ?? ""),
      [refusal(() => changeValue("accounts.pull", "maybe")), changeValue("sources.0.params.internalDomains", "acme.com, acme.co.uk")]);
    // (the saved spec holds one domain, so two new ones are two changed items — the dry run's diff against the saved spec)
    const sq = run("change", [SLUG, "'sources.0.params.internalDomains=example.org,example.net'", "--dry-run"]);
    check("F-536 a pair wrapped in single quotes, as cmd passes it, is the same pair: a dry run names the internal domains changed with two items",
      sq.code === 0 && sq.json?.changed?.length === 1 && sq.json.changed[0].path === "sources[].params.internalDomains[]" && sq.json.changed[0].examples.length === 2, sq.json ?? sq.stderr?.slice(-300));
    // The judge, independent of the parser: the no-internal-domain line as the page prints it (the runtime's LACKS row
    // through COPY_LINES — test/dashboard-page.mjs holds the drawn page to this same line), the placeholder filled, run
    // through the REAL shells from the workspace folder — Git Bash everywhere, plus cmd and Windows PowerShell 5.1 on
    // Windows — as a dry run; each must deliver the pair whole (two items changed). The script's path stands in for
    // the workspace link the page's line assumes, in double quotes, the one spelling all three accept.
    const noDomainRow = LACKS.find((r) => r.reason === "no-internal-domain");
    const pageLine = COPY_LINES.change(SLUG, "sources.0.params.internalDomains", noDomainRow?.setting?.placeholder ?? "", "acme-prod");
    const shellLine = `node "${SCRIPT}" ${pageLine.replace(/^node \S+ /, "").replace("<domains>", "example.org,example.net")} --dry-run --bin "${FAKE}" --today ${TODAY} --by ana`;
    const shells = [
      { name: "bash", file: "f536.sh", script: `${shellLine}\n`, argv: (f) => ["bash", [f]] },
      ...(process.platform === "win32" ? [
        { name: "cmd", file: "f536.cmd", script: `@echo off\r\n${shellLine}\r\n`, argv: (f) => ["cmd.exe", ["/d", "/c", f]] },
        { name: "powershell", file: "f536.ps1", script: `${shellLine}\r\nexit $LASTEXITCODE\r\n`, argv: (f) => ["powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", f]] },
      ] : []),
    ].map((sh) => {
      const file = join(ROOT, sh.file);
      writeFileSync(file, sh.script);
      const [cmd, args] = /** @type {[string, string[]]} */ (sh.argv(file));
      const x = spawnSync(cmd, args, { cwd: WS, encoding: "utf8", env: { ...process.env, FAKE_STATE: STATE, FAKE_TENANT: JSON.stringify(TENANT) } });
      let json = null;
      try { json = JSON.parse(x.stdout); } catch { /* a refusal or a shell error */ }
      return { shell: sh.name, code: x.status, error: /** @type {?{code?: string}} */ (x.error)?.code ?? null, json, stderr: String(x.stderr ?? "").slice(-300) };
    });
    check("F-536 JUDGE (the real shells): the admin page's no-internal-domain line, as printed with the domains in place of <domains>, runs as a dry run from the workspace folder through Git Bash" + (process.platform === "win32" ? ", cmd and Windows PowerShell 5.1" : "") + ", and every shell delivers the pair whole: two internal domains changed, exit 0",
      /change acme-health "sources\.0\.params\.internalDomains=<domains>" --kb acme-prod$/.test(pageLine) && shells.length === (process.platform === "win32" ? 3 : 1) &&
        shells.every((s) => s.error === null && s.code === 0 && s.json?.ok === true && s.json.dryRun === true && s.json.changed?.length === 1 && s.json.changed[0].path === "sources[].params.internalDomains[]" && s.json.changed[0].examples.length === 2),
      [pageLine, ...shells.map((s) => [s.shell, s.code, s.error, s.json?.changed ?? s.json?.error ?? s.stderr])]);
    // F-541: a saved spec a tightened rule refuses (templates on, the preset's panels written out without the templates
    // tab's: valid under S4b, refused under S4c) is repaired through the writer, never by hand.
    const broken = JSON.parse(specBefore);
    broken.pages[0].tabs.find((t) => t.id === "templates").enabled = true;
    broken.pages[0].panels = presetPanels(broken.pages[0]).filter((p) => p.tab !== "templates");
    const brokenProblem = refusal(() => openSpec(broken));
    writeFileSync(specFile(), JSON.stringify(broken, null, 2) + "\n");
    const opened = run("new", [SLUG]);
    const other = run("change", [SLUG, "title=Acme repaired"]);
    const specAfterOther = readFileSync(specFile(), "utf8");
    const repaired = run("change", [SLUG, "pages.0.panels=[]"]);
    const repairedSpec = refusal(() => openSpec(readJson(specFile())));
    check("F-541 a saved spec this version's validator refuses opens as an edit naming the problem (new: problems + the repair line); a change of another setting is refused at the save naming the problem, nothing saved and no draft left; the repair itself (the panel list emptied) is saved through the writer, and the spec passes again",
      /pages\[0\]\.panels lists no panel for the templates tab/.test(brokenProblem ?? "") && opened.code === 0 && opened.json?.state === "editing-saved" && opened.json.problems?.length === 1 && /lists no panel for the templates tab/.test(opened.json.problems[0]) && /change acme-health <path>=<value>/.test(opened.json.repair) &&
        other.code === 1 && /not saved — pages\[0\]\.panels lists no panel for the templates tab/.test(other.json?.error ?? "") && !existsSync(draftFile()) &&
        repaired.code === 0 && repaired.json?.saved === true && ["rebuild", "in-page"].includes(repaired.json.consequence) && repairedSpec === null && !existsSync(draftFile()),
      [brokenProblem, opened.json?.problems, opened.json?.repair, other.json?.error ?? other.stderr?.slice(-300), repaired.json?.error ?? repaired.json?.consequence, repairedSpec]);
    // The draft `new` opened above is the one `other` and `repaired` took over (the same holder); back to the walk's spec.
    writeFileSync(specFile(), specBefore);
    rmSync(draftFile(), { force: true });
    check("(F-541 the other change was refused with the spec byte-equal)", specAfterOther === JSON.stringify(broken, null, 2) + "\n");
    // F-541, reopened at the 0.56.1 gate: the repair holds through the INTERVIEW too — new's own hint (next to the
    // closing step; next --question <id>) reaches the closing step, the dry-run answer lands, and the save is REFUSED
    // naming the problem; never a stack (the edit getter opened the saved spec strictly).
    writeFileSync(specFile(), JSON.stringify(broken, null, 2) + "\n");
    const reopened = run("new", [SLUG]);
    const toClosing = run("next", [SLUG]);
    const oneQuestion = run("next", [SLUG, "--question", "tabs"]);
    const noDryRun = run("answer", [SLUG, "dry-run", "no"]);
    const later = run("answer", [SLUG, "save", "later"]);
    const specAfterLater = readFileSync(specFile(), "utf8");
    const repairedAgain = run("change", [SLUG, "pages.0.panels=[]"]);
    check("F-541 (reopened) the interview over a refused saved spec: next reaches the closing step (exit 0, an action question), next --question tabs shows the question, answer dry-run no lands, and the save is REFUSED naming the problem (exit 1, a refusal, no stack), the spec untouched; the repair through change then saves",
      reopened.code === 0 && reopened.json?.state === "editing-saved" && toClosing.code === 0 && toClosing.json?.question?.kind === "action" && oneQuestion.code === 0 && oneQuestion.json?.question?.id === "tabs" && noDryRun.code === 0 &&
        later.code === 1 && /not saved — pages\[0\]\.panels lists no panel for the templates tab/.test(later.json?.error ?? "") && ![toClosing, oneQuestion, noDryRun, later].some((r) => /at openSpec|Error: dashboard spec:/.test(r.stderr ?? "")) &&
        specAfterLater === JSON.stringify(broken, null, 2) + "\n" && repairedAgain.code === 0 && repairedAgain.json?.saved === true && !existsSync(draftFile()),
      [toClosing.json?.question?.id ?? toClosing.json?.error ?? toClosing.stderr?.slice(-300), oneQuestion.json?.question?.id ?? oneQuestion.stderr?.slice(-200), noDryRun.json?.error ?? noDryRun.stderr?.slice(-200), later.json?.error ?? later.stderr?.slice(-300), repairedAgain.json?.error ?? repairedAgain.stderr?.slice(-200)]);
    // Two problems from a tightened rule (the reopen's polish instance), repaired one change at a time: the first change
    // is refused at the save naming the other problem but KEPT in the draft, the second builds on it and saves.
    const twice = JSON.parse(specBefore);
    for (const i of [0, 1]) {
      twice.pages[i].tabs.find((t) => t.id === "templates").enabled = true;
      twice.pages[i].panels = presetPanels(twice.pages[i]).filter((p) => p.tab !== "templates");
    }
    writeFileSync(specFile(), JSON.stringify(twice, null, 2) + "\n");
    rmSync(draftFile(), { force: true });
    const firstFix = run("change", [SLUG, "pages.0.panels=[]"]);
    const draftKept = existsSync(draftFile());
    const secondFix = run("change", [SLUG, "pages.1.panels=[]"]);
    check("F-541 (reopened) two problems repaired one change at a time: the first is refused at the save naming the other problem and says the change is kept in the draft (1 problem left of 2), the draft stays, the second builds on it (draftHadEarlierChanges) and saves, and the spec passes again with no draft left",
      firstFix.code === 1 && /not saved — pages\[1\]\.panels lists no panel for the templates tab.* — this change is kept in the draft \(1 problem left of 2\): change the remaining setting the same way, and the save follows$/.test(firstFix.json?.error ?? "") && draftKept &&
        secondFix.code === 0 && secondFix.json?.saved === true && secondFix.json.draftHadEarlierChanges === true && refusal(() => openSpec(readJson(specFile()))) === null && !existsSync(draftFile()),
      [firstFix.json?.error ?? firstFix.stderr?.slice(-300), draftKept, secondFix.json?.error ?? secondFix.stderr?.slice(-200)]);
    writeFileSync(specFile(), specBefore);
    rmSync(draftFile(), { force: true });
    // F-545: a second refresh during a live one, with a stopped run's state file present, is told "already running"
    // first — the lock is taken before the state file is read (the old order read the state first and said "waiting
    // to resume … or remove refresh-state.json", the F-545 failure).
    const stoppedRoutine = run("refresh", [SLUG], { env: { FAKE_FAULTS: JSON.stringify([{ match: "rp run", kind: "auth", skip: 30, times: 9999 }]) } });
    // A LIVE holder names a process of this machine (the reopen: a holder whose process is gone is dead at once).
    const liveLock = JSON.stringify({ by: "ben", at: new Date().toISOString(), pid: process.pid, run: "dash-acme-health-live" });
    writeFileSync(join(dash(), LOCK_FILE), liveLock);
    const during = run("refresh", [SLUG, "--full"]);
    check("F-545 during a live refresh (a fresh lock) with a stopped run's state file present, a second refresh with other flags is refused as already running, naming the holder, never as waiting to resume; the state file and the holder's lock are untouched",
      stoppedRoutine.code === EXIT["token-expired"] && existsSync(join(dash(), STATE_FILE)) && during.code === 1 && /already running: started by ben at /.test(during.json?.error ?? "") && !/waiting to resume/.test(during.json?.error ?? "") && !/refresh-state\.json/.test(during.json?.error ?? "") &&
        existsSync(join(dash(), STATE_FILE)) && readFileSync(join(dash(), LOCK_FILE), "utf8") === liveLock, during.json ?? during.stderr?.slice(-300));
    rmSync(join(dash(), LOCK_FILE), { force: true });
    rmSync(join(STATE, "faults.json"), { force: true });
    const finished = run("refresh", [SLUG]);
    check("(F-545 the stopped run then resumes and finishes once the lock is gone)", finished.code === 0 && finished.json?.resumed === true && !existsSync(join(dash(), STATE_FILE)) && !existsSync(join(dash(), LOCK_FILE)), finished.json?.error ?? finished.stderr?.slice(-300));
    // F-552: a rebuild, and a change's rebuild, take the refresh lock — refused while a refresh runs, never raced with it.
    const titleBefore = readJson(specFile()).pages[0].title;
    writeFileSync(join(dash(), LOCK_FILE), liveLock);
    const rebuildDuring = run("rebuild", [SLUG]);
    const changeDuring = run("change", [SLUG, "pages.0.title=Admin during a refresh"]);
    check("F-552 while a refresh holds the lock, rebuild is refused as already running (the holder named, 'run rebuild again when it finishes'), and a display change is SAVED but its rebuild refused the same way (exit 1, the message saying the change is saved); the holder's lock untouched",
      rebuildDuring.code === 1 && /already running: started by ben at .*run rebuild again when it finishes/.test(rebuildDuring.json?.error ?? "") && changeDuring.code === 1 && /^the change of "acme-health" is saved; its rebuild did not run: a refresh of "acme-health" is already running/.test(changeDuring.json?.error ?? "") && readJson(specFile()).pages[0].title === "Admin during a refresh" && readFileSync(join(dash(), LOCK_FILE), "utf8") === liveLock,
      [rebuildDuring.json?.error ?? rebuildDuring.stderr?.slice(-300), changeDuring.json?.error ?? changeDuring.stderr?.slice(-300)]);
    rmSync(join(dash(), LOCK_FILE), { force: true });
    const rebuildAfter = run("rebuild", [SLUG]);
    check("(F-552 the rebuild runs once the lock is gone, leaves none, and the page carries the saved change)", rebuildAfter.code === 0 && !existsSync(join(dash(), LOCK_FILE)) && pageText("admin").includes("Admin during a refresh"), rebuildAfter.json?.error ?? rebuildAfter.stderr?.slice(-200));
    run("change", [SLUG, `pages.0.title=${titleBefore}`]);
    // F-542: a resume whose derived health lookback moved since the run was planned — re-documentation moved the
    // knowledge base (here: a selected program's doc now carries a six-monthly schedule) — plans and pulls in a fresh
    // -lb<days> directory, and SAYS it starts again and why, never "the calls already made are reused".
    const stoppedFull = run("refresh", [SLUG, "--full"], { env: { FAKE_FAULTS: JSON.stringify([{ match: "rp run", kind: "auth", skip: 30, times: 9999 }]) } });
    const stateAfterStop = readJson(join(dash(), STATE_FILE));
    const docPath = join(KB, "journey", "p-onboard.md");
    const docBefore = readFileSync(docPath, "utf8");
    // The schedule sits in the doc's JSON-encoded scheduleInfo string (escaped quotes); p-onboard's weekly CRON becomes a
    // six-monthly RECURRING one (the type the schedule audit classifies recurring for a month-stepping cron, as p-quarter's).
    const sixMonthly = docBefore.replace(/type\\":\\"CRON\\",\\"cronExpression\\":\\"[^\\]*\\"/, 'type\\":\\"RECURRING\\",\\"cronExpression\\":\\"0 0 9 1 1/6 ? *\\"');
    if (sixMonthly === docBefore) throw new Error("F-542 scenario: p-onboard's doc carries no cronExpression to move");
    writeFileSync(docPath, sixMonthly);
    // Re-documentation writes the manifest (a mark), which moves the knowledge base's stamp the plan reads; the plan
    // re-reads the docs only when the stamp moved, so the manifest is rewritten here as the mark would.
    const manifestPath = join(KB, "_manifest.json");
    writeFileSync(manifestPath, JSON.stringify({ ...readJson(manifestPath), last_refresh: new Date().toISOString() }, null, 2) + "\n");
    rmSync(join(STATE, "faults.json"), { force: true });
    const moved = run("refresh", [SLUG, "--full"]);
    writeFileSync(docPath, docBefore);
    const restartLine = moved.stderr.split("\n").find((l) => /starts its pull again/.test(l)) ?? null;
    check("F-542 a stopped run records the lookback it was planned with; when the knowledge base's longest schedule period rises before the resume, the resume plans in a fresh -lb<days> directory and says it starts the pull again, from which lookback to which and why, with the whole pull's minutes — never that the calls already made are reused; the summary records the restart (resumed false, restarted from/run/lookbackDays, continuing false) and the pull ran at the new lookback",
      stoppedFull.code === EXIT["token-expired"] && stateAfterStop.lookbackDays != null && typeof stateAfterStop.pullRun === "string" && moved.code === 0 && moved.json?.resumed === false && moved.json.budget?.continuing === false &&
        // `from` names the directory the stopped run PULLED in (the state's pullRun; reopened at the 0.56.1 gate), never the base name
        moved.json.restarted?.from === stateAfterStop.pullRun && moved.json.restarted.lookbackDays.from === stateAfterStop.lookbackDays && moved.json.restarted.lookbackDays.to > stateAfterStop.lookbackDays &&
        // (the directory is named for the DERIVED lookback; the pull runs at the window-capped one, which `to` reports)
        moved.json.restarted.run.startsWith(`${stateAfterStop.run}-lb`) && moved.json.restarted.run !== stateAfterStop.pullRun && moved.json.run === moved.json.restarted.run && moved.json.pull.lookbackDays === moved.json.restarted.lookbackDays.to &&
        restartLine != null && new RegExp(`starts its pull again \\(run ${moved.json.restarted.run}, not ${stateAfterStop.pullRun}\\): the derived health lookback moved from ${stateAfterStop.lookbackDays} to ${moved.json.restarted.lookbackDays.to} days since the run was planned \\(the longest schedule period in the knowledge base changed\\), so none of the calls already made applies; about \\d+ minutes? in all; the login has`).test(restartLine) &&
        !/calls already made are reused/.test(moved.stderr) && !existsSync(join(dash(), STATE_FILE)),
      [stateAfterStop, moved.json?.restarted ?? moved.json?.error ?? moved.stderr?.slice(-400), restartLine]);
    const plain = run("refresh", [SLUG, "--full"], { env: { FAKE_FAULTS: JSON.stringify([{ match: "rp run", kind: "auth", skip: 30, times: 9999 }]) } });
    rmSync(join(STATE, "faults.json"), { force: true });
    const plainResume = run("refresh", [SLUG, "--full"]);
    check("(F-542 control: the same stop and resume with the knowledge base unchanged is a resume — the calls already made are reused, nothing restarted)",
      plain.code === EXIT["token-expired"] && plainResume.code === 0 && plainResume.json?.resumed === true && plainResume.json.restarted === undefined && plainResume.json.pull.calls.reused > 0 && /the calls already made are reused/.test(plainResume.stderr), plainResume.json?.error ?? plainResume.stderr?.slice(-300));
    // F-542, reopened at the 0.56.1 gate: the lookback moving BACK to the base before the resume — a run planned at the
    // raised lookback stops, the knowledge base's longest period drops — is a restart too (the pull runs in the base
    // directory, where no fact call was made), said as one: the state names the directory the stopped run pulled in.
    writeFileSync(docPath, sixMonthly);
    writeFileSync(manifestPath, JSON.stringify({ ...readJson(manifestPath), last_refresh: new Date().toISOString() }, null, 2) + "\n");
    const stoppedRaised = run("refresh", [SLUG, "--full"], { env: { FAKE_FAULTS: JSON.stringify([{ match: "rp run", kind: "auth", skip: 30, times: 9999 }]) } });
    const stateRaised = readJson(join(dash(), STATE_FILE));
    writeFileSync(docPath, docBefore);
    writeFileSync(manifestPath, JSON.stringify({ ...readJson(manifestPath), last_refresh: new Date().toISOString() }, null, 2) + "\n");
    rmSync(join(STATE, "faults.json"), { force: true });
    const back = run("refresh", [SLUG, "--full"]);
    const backLine = back.stderr.split("\n").find((l) => /starts its pull again/.test(l)) ?? null;
    check("F-542 (reopened) the lookback moving BACK before the resume is a restart: the state names the -lb directory the stopped run pulled in (pullRun), the resume pulls in the directory of the lower lookback (here the fixture's own derived one; the base directory when the longest period drops to the floor) and says it starts again (from the raised run to that run, the lookback from the raised days down), resumed false, continuing false; never 'the calls already made are reused'",
      stoppedRaised.code === EXIT["token-expired"] && typeof stateRaised.pullRun === "string" && /-lb\d+$/.test(stateRaised.pullRun) && back.code === 0 && back.json?.resumed === false && back.json.budget?.continuing === false &&
        back.json.restarted?.from === stateRaised.pullRun && back.json.restarted.run !== stateRaised.pullRun && back.json.restarted.run.startsWith(stateRaised.run) && back.json.restarted.lookbackDays.from > back.json.restarted.lookbackDays.to && back.json.pull.lookbackDays === back.json.restarted.lookbackDays.to &&
        backLine != null && new RegExp(`starts its pull again \\(run ${back.json.restarted.run}, not ${stateRaised.pullRun}\\): the derived health lookback moved from ${stateRaised.lookbackDays} to ${back.json.restarted.lookbackDays.to} days`).test(backLine) && !/calls already made are reused/.test(back.stderr) && !existsSync(join(dash(), STATE_FILE)),
      [stateRaised, back.json?.restarted ?? back.json?.error ?? back.stderr?.slice(-400), backLine]);
  }
  // ══ R15 polish round (2026-10-17): F-556 the doc_path spelling, F-557 a lock the release could not remove, F-558 the lock read before the no-snapshot refusal ══
  {
    rmSync(join(STATE, "faults.json"), { force: true });
    // F-556: a doc_path the dashboard's re-documentation records is WORKSPACE-RELATIVE, spelled as the neighbours
    // written by setup's stubs (the fixture's `<slug>/<domain>/<id>.md`) and by a hand-run describe-batch with the
    // skill's own --out-dir — never the absolute folder the dashboard knows. The judge is the hand-run writer: the
    // skill's line, run from the workspace over the same asset, records a byte-identical doc_path. This suite itself
    // runs from the repo, not the workspace, so the relative folder is proven to resolve from the workspace alone.
    const inv556 = manifest().inventory;
    const redocumented = Object.entries(inv556).filter(([, e]) => e.status === "documented" && typeof e.last_verified === "string" && e.last_verified > TODAY);
    const neighbour = inv556["journey/p-onboard"];
    const absolute = redocumented.filter(([, e]) => isAbsolute(String(e.doc_path ?? "")));
    const spelled = redocumented.filter(([, e]) => e.doc_path === `acme-prod/${e.domain}/${e.id}.md` && existsSync(resolve(WS, e.doc_path)));
    check("F-556 every entry the dashboard's re-documentation marked (programs and templates) records doc_path workspace-relative with forward slashes — acme-prod/<domain>/<id>.md, the fixture neighbours' spelling — and the file is there from the workspace; none is absolute (this suite runs from the repo, so the folder was resolved from the workspace, not the caller's directory)",
      redocumented.length >= 3 && absolute.length === 0 && spelled.length === redocumented.length && neighbour?.doc_path === "acme-prod/journey/p-onboard.md" && process.cwd() !== WS,
      [absolute.map(([k, e]) => [k, e.doc_path]), redocumented.filter(([k]) => !spelled.some(([s]) => s === k)).map(([k, e]) => [k, e.doc_path])]);
    // The judge: the skill's hand-run line (email-engagement, the re-documentation step), from the workspace, over p-undoc.
    const byDashboard = inv556["journey/p-undoc"]?.doc_path;
    mkdirSync(join(ROOT, "r15"), { recursive: true });
    const keys556 = join(ROOT, "r15", "keys.json");
    writeFileSync(keys556, JSON.stringify(["journey/p-undoc"]));
    const marked = runNode(join(HERE, "..", "scripts", "manifest.mjs"), ["mark", "--manifest", join(KB, "_manifest.json"), "--key", "journey/p-undoc", "--status", "stale"], { encoding: "utf8" });
    const byHand = runNode(join(HERE, "..", "scripts", "describe-batch.mjs"), ["--manifest", "acme-prod/_manifest.json", "--domain", "journey", "--command", "gs-admin --json jo p describe --id {id}", "--doc-mode", "program", "--out-dir", "acme-prod/journey", "--keys-file", keys556, "--limit", "1", "--bin", FAKE], { cwd: WS, encoding: "utf8", env: { ...process.env, FAKE_STATE: STATE, FAKE_TENANT: JSON.stringify(TENANT) } });
    const afterHand = manifest().inventory["journey/p-undoc"];
    check("F-556 JUDGE (the hand-run writer): the skill's describe-batch line run from the workspace with --out-dir acme-prod/journey over the same program records a doc_path byte-identical to the one the dashboard's re-documentation recorded",
      marked.status === 0 && byHand.status === 0 && typeof byDashboard === "string" && afterHand?.status === "documented" && afterHand.doc_path === byDashboard, [marked.stderr?.slice(-200), byHand.stderr?.slice(-300), byDashboard, afterHand?.doc_path]);
    // F-557: a refresh whose release could not remove its lock SAYS so — `lockLeft` on the summary (and appended to a
    // refusal), with the one sentence the skill relays — never nothing; the next refresh takes the lock over because
    // the process is gone. The arm: the fake CLI's deny-delete hook makes the lock undeletable mid-refresh on Windows
    // (a deny of DELETE on the file and DELETE_CHILD on its folder — what a handle that forbids delete does, VALIDATION
    // R14 R1); on POSIX no per-file rule forbids an unlink while the folder stays writable, so there the same run
    // proves the clean path: the lock removed and nothing said.
    const lockPath = join(dash(), LOCK_FILE);
    // Whether the deny-delete pair FORBIDS here, probed on a sibling file first: a process that overrides ACLs (an
    // elevated Windows runner with backup privileges — GitHub's windows-latest at the 0.56.3 cut, F-568) deletes
    // through it, and that run proves the clean path like POSIX does; `win` below means "the deny forbids".
    const probe = join(dash(), "x.probe");
    writeFileSync(probe, "");
    if (process.platform === "win32") for (const [t, right] of [[dash(), "DC"], [probe, "DE"]]) spawnSync("icacls", [t, "/deny", `*S-1-1-0:(${right})`], { encoding: "utf8" });
    let win = process.platform === "win32";
    try { rmSync(probe); win = false; } catch { /* the deny took */ }
    if (process.platform === "win32") for (const t of [dash(), probe]) spawnSync("icacls", [t, "/remove:d", "*S-1-1-0"], { encoding: "utf8" });
    rmSync(probe, { force: true });
    if (process.platform === "win32" && !win) console.log("NOTE  F-557: this process deletes through an icacls deny (elevated), so the dashboard arm asserts the clean path here, as on POSIX");
    const allowDelete = () => { if (process.platform === "win32") for (const t of [dash(), lockPath]) spawnSync("icacls", [t, "/remove:d", "*S-1-1-0"], { encoding: "utf8" }); };
    const hook = { match: "rp run", kind: "deny-delete", path: lockPath };
    const leftRun = run("refresh", [SLUG], { env: { FAKE_FAULTS: JSON.stringify([hook]) } });
    const leftRecord = existsSync(lockPath) ? readJson(lockPath) : null;
    allowDelete();
    const cured = run("refresh", [SLUG]);
    check(win
      ? "F-557 (Windows) a refresh whose lock could not be removed at the end still exits 0 and SAYS so: lockLeft names the path and the cause (EPERM) and carries the sentence the skill relays (taken over on its own by the next refresh, nothing to do); the lock stays on disk holding this run's record; and the next refresh, the handle gone, takes it over at once (lockTakenOver names it) and leaves none"
      : "F-557 (the clean path: POSIX, where a lock file cannot be made undeletable in a writable folder, or a Windows process that deletes through the deny) a refresh exits 0 with NO lockLeft, the lock removed, and the next refresh takes nothing over",
      win
        ? leftRun.code === 0 && leftRun.json?.lockLeft?.path === lockPath && leftRun.json.lockLeft.why === "EPERM" && /^the refresh lock could not be removed at the end \(EPERM\) and was left at .*: the next refresh, rebuild or change takes it over on its own, because this process is gone — nothing to do$/.test(leftRun.json.lockLeft.text) && leftRecord?.by === "ana" && cured.code === 0 && cured.json?.lockTakenOver?.by === "ana" && !existsSync(lockPath)
        : leftRun.code === 0 && !("lockLeft" in (leftRun.json ?? {})) && leftRecord === null && cured.code === 0 && cured.json?.lockTakenOver === null && !existsSync(lockPath),
      [leftRun.json?.lockLeft ?? leftRun.json?.error ?? leftRun.stderr?.slice(-300), leftRecord, cured.json?.lockTakenOver ?? cured.json?.error ?? cured.stderr?.slice(-300)]);
    // The refusal path: a refresh stopped by the token with the lock undeletable carries lockLeft and ends its error with the same sentence; the resume takes the lock over and finishes.
    rmSync(join(STATE, "faults.json"), { force: true });
    const leftStop = run("refresh", [SLUG, "--full"], { env: { FAKE_FAULTS: JSON.stringify([hook, { match: "rp run", kind: "auth", skip: 30, times: 9999 }]) } });
    const leftStopRecord = existsSync(lockPath) ? readJson(lockPath) : null;
    allowDelete();
    rmSync(join(STATE, "faults.json"), { force: true });
    const curedResume = run("refresh", [SLUG, "--full"]);
    check(win
      ? "F-557 (Windows) a refresh REFUSED (the token stop, exit 3) whose lock could not be removed carries lockLeft and ends its error with the same sentence; the resume takes the lock over (lockTakenOver names it) and finishes"
      : "F-557 (the clean path, as above) a refused refresh leaves no lock and says nothing of one; the resume finishes",
      leftStop.code === EXIT["token-expired"] && curedResume.code === 0 && curedResume.json?.resumed === true && !existsSync(lockPath) && (win
        ? leftStop.json?.lockLeft?.path === lockPath && /; the refresh lock could not be removed at the end \(EPERM\) and was left at .* — nothing to do$/.test(leftStop.json.error ?? "") && leftStopRecord?.by === "ana" && curedResume.json.lockTakenOver?.by === "ana"
        : !("lockLeft" in (leftStop.json ?? {})) && !/refresh lock could not be removed/.test(leftStop.json?.error ?? "") && leftStopRecord === null && curedResume.json.lockTakenOver === null),
      [leftStop.json?.error ?? leftStop.stderr?.slice(-300), leftStop.json?.lockLeft, curedResume.json?.lockTakenOver ?? curedResume.json?.error ?? curedResume.stderr?.slice(-300)]);
    // ══ F-563 — the run's bookkeeping, classified (the class entry; F-565 and F-575 (1), (2) fold in) ══
    // The judge, independent of the fixer's list: each bookkeeping file made unwritable in turn — the lock RECORD
    // under the deny (a rename over the lock needs DELETE on Windows), the progress record and the pace files as
    // FOLDERS at their paths (a rename over a folder fails on every platform) — and the run's exit and its one line or
    // summary read; against a control in which a DATA file (the run's status.json) is a folder and the run fails loudly.
    lateCleanup = allowDelete; // the denies come off in the suite's finally, before the rig is removed (F-565's test-hygiene ride-along)
    // (a) the lock record: the deny lands on the preflight's whoami call, before the run's name is recorded.
    rmSync(join(STATE, "faults.json"), { force: true });
    const recordRun = run("refresh", [SLUG], { env: { FAKE_FAULTS: JSON.stringify([{ match: "whoami", kind: "deny-delete", path: lockPath }]) } });
    const recordLeft = existsSync(lockPath) ? readJson(lockPath) : null;
    allowDelete();
    rmSync(join(STATE, "faults.json"), { force: true });
    const recordCured = run("refresh", [SLUG]);
    check(win
      ? "F-563 (a, Windows) a refresh whose lock RECORD cannot be written (a handle that forbids the rename, held past the retry) is REFUSED in one JSON line — exit 1, `error` naming the lock record and the remedy (run the line again), lockRecord {path, why EPERM}, the lock said left (its release fails under the same deny) — never a stack; the next refresh takes the dead lock over and finishes"
      : "F-563 (a, the clean path) the lock record is written and the refresh finishes; nothing said of the record",
      win
        ? recordRun.code === 1 && /could not be recorded \(EPERM\): a handle on .* forbids the write — run the line again once it is gone/.test(recordRun.json?.error ?? "") && recordRun.json?.lockRecord?.why === "EPERM" && recordRun.json?.lockLeft?.why === "EPERM" && !/^\s+at /m.test(recordRun.stderr) && recordLeft?.by === "ana" && recordLeft.run == null && recordCured.code === 0 && recordCured.json?.lockTakenOver?.by === "ana" && !existsSync(lockPath)
        : recordRun.code === 0 && !("lockRecord" in (recordRun.json ?? {})) && recordCured.code === 0 && !existsSync(lockPath),
      [recordRun.json?.error ?? recordRun.stderr?.slice(-400), recordRun.json?.lockRecord, recordLeft, recordCured.json?.lockTakenOver ?? recordCured.json?.error]);
    // (b) F-565 (1): a CRASH (a plain error, no refusal: a folder where the page goes) while the lock cannot be removed
    // says the lock left on stderr, synchronously, beside the stack.
    const adminPage = join(dash(), "latest-admin.html");
    rmSync(adminPage, { force: true });
    mkdirSync(adminPage);
    const crashRun = run("refresh", [SLUG], { env: { FAKE_FAULTS: JSON.stringify([hook]) } });
    const crashLeft = existsSync(lockPath) ? readJson(lockPath) : null;
    allowDelete();
    rmSync(join(STATE, "faults.json"), { force: true });
    rmSync(adminPage, { recursive: true, force: true });
    const crashCured = run("refresh", [SLUG]);
    check(win
      ? "F-565 (1, Windows) a refresh that CRASHES (a folder where its page goes: a plain error, no refusal) while the lock cannot be removed says the lock left on stderr beside the stack — 'dashboard.mjs: the refresh lock could not be removed at the end (EPERM)' — exits 1, the record stays; the next refresh takes it over and rebuilds the page"
      : "F-565 (1, the clean path) the same crash removes the lock and says nothing of one; the next refresh rebuilds the page",
      crashRun.code !== 0 && crashRun.json === null && /^\s+at /m.test(crashRun.stderr) && (win
        ? /^dashboard\.mjs: the refresh lock could not be removed at the end \(EPERM\) and was left at /m.test(crashRun.stderr) && crashLeft?.by === "ana" && crashCured.code === 0 && crashCured.json?.lockTakenOver?.by === "ana"
        : !/refresh lock could not be removed/.test(crashRun.stderr) && crashLeft === null && crashCured.code === 0 && crashCured.json?.lockTakenOver === null) && existsSync(adminPage) && !existsSync(lockPath),
      [crashRun.stderr?.slice(-500), crashLeft, crashCured.json?.lockTakenOver ?? crashCured.json?.error ?? crashCured.stderr?.slice(-300)]);
    // (c) F-575 (1): the progress record as a folder on a RESUME — each tick's write fails, said ONCE, the pull finishes.
    rmSync(join(STATE, "faults.json"), { force: true });
    const stopped563 = run("refresh", [SLUG, "--full"], { env: { FAKE_FAULTS: JSON.stringify([{ match: "rp run", kind: "auth", skip: 30, times: 9999 }]) } });
    const state563 = readJson(join(dash(), STATE_FILE));
    const progressPath563 = join(runsRoot, state563.pullRun ?? state563.run, "progress.json");
    rmSync(progressPath563, { force: true });
    mkdirSync(progressPath563);
    rmSync(join(STATE, "faults.json"), { force: true });
    const resumed563 = run("refresh", [SLUG, "--full"]);
    const saidOnce = resumed563.stderr.split("\n").filter((l) => l.includes("bookkeeping: the progress record could not be written"));
    check("F-575 (1) a progress record that cannot be written (a folder at its path) is said ONCE on stderr and once on the summary (bookkeepingLeft: what 'progress record', the path, the cause), the progress lines still print, and the resumed pull finishes (exit 0, the snapshot written) — never a stack, never a stop",
      stopped563.code === EXIT["token-expired"] && resumed563.code === 0 && resumed563.json?.resumed === true && saidOnce.length === 1 && /^dashboard\.mjs: pull bookkeeping: the progress record could not be written at .* and the run went on without it/.test(saidOnce[0]) && resumed563.json.bookkeepingLeft?.length === 1 && resumed563.json.bookkeepingLeft[0].what === "progress record" && resumed563.json.bookkeepingLeft[0].path === progressPath563 && resumed563.stderr.split("\n").filter((l) => l.includes("pull progress: ")).length >= 2 && existsSync(resumed563.json.snapshot),
      [resumed563.json?.bookkeepingLeft ?? resumed563.json?.error ?? resumed563.stderr?.slice(-400), saidOnce]);
    rmSync(progressPath563, { recursive: true, force: true });
    // (d) F-575 (2): the pace files as folders — the refresh finishes, its snapshot and pages written, both said once.
    rmSync(join(dash(), PACE_FILE), { force: true, recursive: true });
    mkdirSync(join(dash(), PACE_FILE));
    rmSync(kbPace, { force: true, recursive: true });
    mkdirSync(kbPace);
    const paceRun = run("refresh", [SLUG]);
    const paceSaid = paceRun.stderr.split("\n").filter((l) => l.includes("bookkeeping: the pace file could not be written"));
    rmSync(join(dash(), PACE_FILE), { recursive: true, force: true });
    rmSync(kbPace, { recursive: true, force: true });
    const paceCured = run("refresh", [SLUG]);
    check("F-575 (2) a refresh whose two pace files cannot be written (folders in their places) still finishes — exit 0, its snapshot and pages written — with `pace` null and both said once each (bookkeepingLeft: two 'pace file' entries, two stderr lines); the next refresh writes both again",
      paceRun.code === 0 && paceRun.json?.pace === null && paceRun.json.bookkeepingLeft?.length === 2 && paceRun.json.bookkeepingLeft.every((b) => b.what === "pace file") && paceSaid.length === 2 && existsSync(paceRun.json.snapshot) && paceRun.json.pages.length === 2 && paceCured.code === 0 && paceCured.json?.pace?.families >= 3 && existsSync(join(dash(), PACE_FILE)) && readJson(kbPace).families != null,
      [paceRun.json?.bookkeepingLeft ?? paceRun.json?.error ?? paceRun.stderr?.slice(-400), paceSaid.length]);
    // (e) the control: a DATA file (the run's status.json, which the reduce reads) as a folder — the run fails loudly.
    rmSync(join(STATE, "faults.json"), { force: true });
    const stoppedCtl = run("refresh", [SLUG, "--full"], { env: { FAKE_FAULTS: JSON.stringify([{ match: "rp run", kind: "auth", skip: 30, times: 9999 }]) } });
    const stateCtl = readJson(join(dash(), STATE_FILE));
    const statusPath = join(runsRoot, stateCtl.pullRun ?? stateCtl.run, "status.json");
    rmSync(statusPath, { force: true });
    mkdirSync(statusPath);
    rmSync(join(STATE, "faults.json"), { force: true });
    const snapsCtl = snapshots().length;
    const ctl = run("refresh", [SLUG, "--full"]);
    rmSync(statusPath, { recursive: true, force: true });
    const afterCtl = run("refresh", [SLUG, "--full"]);
    check("F-563 (the control) a DATA file the run keeps (status.json, which the reduce reads) made unwritable the same way FAILS the run loudly — a non-zero exit, no new snapshot — the line between bookkeeping and data holding; with the folder gone the same refresh resumes and finishes",
      stoppedCtl.code === EXIT["token-expired"] && ctl.code !== 0 && snapshots().length === snapsCtl && afterCtl.code === 0, [ctl.code, ctl.json?.error ?? ctl.stderr?.slice(-300), afterCtl.json?.error ?? afterCtl.stderr?.slice(-200)]);

    // ══ The pull lock per knowledge base (F-575 (3); F-581's race) ══
    const kbLockPath = join(KB, KB_PULL_LOCK_FILE);
    const callsBeforeKb = argvLines().length;
    writeFileSync(kbLockPath, JSON.stringify({ by: "ben", dashboard: "other-dash", run: "dash-other-dash-20260915T120000", at: new Date().toISOString(), pid: process.pid }));
    const kbHeld = run("refresh", [SLUG]);
    check("KB-1 a refresh while another dashboard's pull holds the knowledge base's pull lock (a live holder) is refused before any call, naming the holder — 'another pull is running over the knowledge base at …: the pull of the dashboard \"other-dash\" (run …) started by ben at … — wait for it' — the holder's lock untouched and this dashboard's own lock released",
      kbHeld.code === 1 && /^another pull is running over the knowledge base at .*: the pull of the dashboard "other-dash" \(run dash-other-dash-20260915T120000\) started by ben at .* \(\d+ minutes? ago, pid \d+\) — wait for it; a pull whose process is gone, or whose lock .* is older than two hours, is taken over on its own$/.test(kbHeld.json?.error ?? "") && argvLines().length === callsBeforeKb && readJson(kbLockPath).by === "ben" && !existsSync(lockPath), kbHeld.json?.error ?? kbHeld.stderr?.slice(-300));
    writeFileSync(kbLockPath, JSON.stringify({ by: "ben", dashboard: "other-dash", at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(), pid: 1 }));
    const kbStale = run("refresh", [SLUG]);
    check("KB-2 a knowledge-base pull lock older than two hours (or a dead holder's) is taken over and said (kbLockTakenOver names it, a stderr line too); the refresh finishes and leaves no knowledge-base lock and no dashboard lock behind",
      kbStale.code === 0 && kbStale.json?.kbLockTakenOver?.by === "ben" && /took over a stale pull lock of the knowledge base held by ben since/.test(kbStale.stderr) && !existsSync(kbLockPath) && !existsSync(lockPath), kbStale.json?.kbLockTakenOver ?? kbStale.json?.error ?? kbStale.stderr?.slice(-300));

    // ══ F-564: a relative --bin given from another directory reaches the re-documentation child resolved ══
    // A program is put behind the way the tenant does it — its doc moved aside (a status mark does not put one behind:
    // the R15 tester's note) — so the plan finds the knowledge base behind on a listed program and the batch runs.
    // The tell: handed the relative spelling raw, describe-batch (cwd the workspace) cannot find the CLI and the refresh
    // refuses "describe-batch refused: --bin not found"; resolved, the batch re-documents it and the refresh finishes.
    const relBin = relative(process.cwd(), FAKE);
    const onboardDoc = join(WS, "acme-prod", "journey", "p-onboard.md");
    renameSync(onboardDoc, `${onboardDoc}.aside`);
    const relRun = isAbsolute(relBin) ? null : run("refresh", [SLUG], { flags: ["--workspace", WS, "--kb", KB, "--bin", relBin, "--today", TODAY, "--by", "ana"] });
    if (!existsSync(onboardDoc)) renameSync(`${onboardDoc}.aside`, onboardDoc); else rmSync(`${onboardDoc}.aside`, { force: true });
    if (relRun) check("F-564 a --bin relative to the directory the admin runs from (this suite's cwd, not the workspace) reaches describe-batch, which runs FROM the workspace, resolved: the program whose doc was moved aside is re-documented through the child (documented at least 1, no '--bin not found' refusal) and the refresh finishes; the folder passed is said workspace-relative on the summary",
      process.cwd() !== WS && relRun.code === 0 && !/describe-batch refused/.test(relRun.json?.error ?? "") && relRun.json?.redocumented?.programs?.documented >= 1 && existsSync(onboardDoc) && relRun.json.redocumented.folder?.workspaceRelative === true && relRun.json.redocumented.folder.passed === "acme-prod/journey" && !("note" in relRun.json.redocumented.folder), [relBin, relRun.json?.redocumented ?? relRun.json?.error ?? relRun.stderr?.slice(-300)]);
    else console.log("SKIP  F-564 relative --bin: the fixture CLI sits on another drive than this suite's cwd, so no relative spelling of it exists here");
    if (process.platform === "win32") {
      const cross = kbFolderOf("D:\\ws", "E:\\kb\\acme-prod", "journey");
      const sameDrive = kbFolderOf("D:\\ws", "D:\\ws\\acme-prod", "journey");
      check("F-564 (Windows) kbFolderOf across drives says the folder could not be made workspace-relative (an absolute doc_path follows, resolving all the same); on one drive it is relative and says nothing", cross.workspaceRelative === false && isAbsolute(cross.folder) && /not under the workspace's drive/.test(cross.note ?? "") && sameDrive.workspaceRelative === true && sameDrive.folder === "acme-prod/journey" && sameDrive.note === null, [cross, sameDrive]);
    } else console.log("SKIP  F-564 kbFolderOf across drives: path.relative returns an absolute path only across Windows drives — measured on the Windows leg");

    // F-558: a verb that needs a snapshot and finds none reads the lock FIRST. On a dashboard with no snapshot yet
    // (imported, its first refresh "running" — a live lock of this process), every such verb says "already running …
    // run <verb> again when it finishes", never "no snapshot — run the refresh" about the refresh that is running;
    // a DEAD holder's lock stops nothing, and status says it is stale. The class is the check order over the verbs,
    // so the suite's list is held to the script's own census of no-snapshot sites, closed both ways.
    const first = "acme-first";
    const exported558 = run("export", [SLUG, "--out", join(ROOT, "r15", "acme-first.json")]);
    const imported558 = run("import", ["--file", join(ROOT, "r15", "acme-first.json"), "--slug", first]);
    const firstLock = join(dash(first), LOCK_FILE);
    const liveRecord = JSON.stringify({ by: "ben", at: new Date().toISOString(), pid: process.pid, run: "dash-acme-first-live" });
    writeFileSync(firstLock, liveRecord);
    const verbs558 = { rebuild: [first], report: [first], export: [first, "--out", join(ROOT, "r15", "first-x.json"), "--with-snapshot"], health: [first, "--program", "p-onboard"], publish: [first], change: [first, "pages.0.title=First during a refresh"] };
    const during558 = Object.fromEntries(Object.entries(verbs558).map(([v, a]) => [v, run(v, a)]));
    const running = (v, text) => new RegExp(`a refresh of "acme-first" is already running: started by ben at .* — run ${v} again when it finishes`).test(text);
    const refused = ["rebuild", "report", "export", "health"].every((v) => during558[v].code === 1 && running(v, during558[v].json?.error ?? "") && !/no snapshot/.test(during558[v].json?.error ?? ""));
    const publishSaid = during558.publish.code === 0 && during558.publish.json?.publish?.published === false && running("publish", during558.publish.json.publish.why) && !/no snapshot/.test(during558.publish.json.publish.why);
    const changeSaid = during558.change.code === 1 && /^the change of "acme-first" is saved; its rebuild did not run: /.test(during558.change.json?.error ?? "") && running("change", during558.change.json?.error ?? "") && !/no snapshot/.test(during558.change.json?.error ?? "") && readJson(specFile(first)).pages[0].title === "First during a refresh";
    check("F-558 on a dashboard with no snapshot yet whose first refresh holds the lock: rebuild, report, export --with-snapshot and health are refused 'already running … run <verb> again when it finishes' (exit 1), publish reports the same as its why (exit 0, published false), and a display change is saved but its rebuild refused the same way — none says 'no snapshot'; the holder's lock is untouched",
      exported558.code === 0 && imported558.code === 0 && snapshots(first).length === 0 && refused && publishSaid && changeSaid && readFileSync(firstLock, "utf8") === liveRecord,
      Object.fromEntries(Object.entries(during558).map(([v, r]) => [v, r.json?.error ?? r.json?.publish?.why ?? r.stderr?.slice(-200)])));
    // F-566: a refused export writes NOTHING — the --out file is absent after the refusal: refused as already running
    // (above), refused for want of a snapshot (below, the dead holder), refused as an unknown dashboard (the store's
    // own refusal, pinned by its wording: savedSpec's "no dashboard" line, before any write).
    const outDuring = join(ROOT, "r15", "first-x.json");
    const exportNone = run("export", ["zz-no-such", "--out", join(ROOT, "r15", "none-x.json")]);
    check("F-566 an export refused --with-snapshot while the first refresh runs has written nothing (no --out file, no .snapshot.json beside it), and an export of a dashboard that does not exist is refused before writing too", during558.export.code === 1 && !existsSync(outDuring) && !existsSync(outDuring.replace(/\.json$/, ".snapshot.json")) && exportNone.code === 1 && /no dashboard "zz-no-such"/.test(exportNone.json?.error ?? "") && !existsSync(join(ROOT, "r15", "none-x.json")), [existsSync(outDuring), exportNone.json?.error]);
    // A dead holder's lock (its process gone) stops nothing: the readers say "no snapshot" with the refresh as the remedy and leave the dead lock in place; status says it is stale; rebuild and a change take it over.
    const gonePid = spawnSync(process.execPath, ["-e", "process.exit(0)"]).pid;
    const deadRecord = JSON.stringify({ by: "dead", at: new Date().toISOString(), pid: gonePid, run: "dash-acme-first-dead" });
    writeFileSync(firstLock, deadRecord);
    const status558 = run("status", [first]);
    const readers = Object.fromEntries(["report", "export", "health", "publish"].map((v) => [v, run(v, verbs558[v])]));
    const noSnap = /^no snapshot of "acme-first" (yet|to export beside the spec) — run `[^`]*refresh acme-first --kb acme-prod` first/;
    const readersSaid = ["report", "export", "health"].every((v) => readers[v].code === 1 && noSnap.test(readers[v].json?.error ?? "") && String(readers[v].json?.remedy?.line ?? "").endsWith("refresh acme-first --kb acme-prod")) && readers.publish.code === 0 && readers.publish.json?.publish?.published === false && noSnap.test(readers.publish.json.publish.why);
    const deadUntouched = readFileSync(firstLock, "utf8") === deadRecord;
    check("F-566 an export refused for want of a snapshot (the holder dead, 'no snapshot … run the refresh first') has written nothing", readers.export.code === 1 && !existsSync(join(ROOT, "r15", "first-x.json")), [readers.export.json?.error, existsSync(join(ROOT, "r15", "first-x.json"))]);
    const rebuildDead = run("rebuild", [first]);
    const rebuildTookOver = !existsSync(firstLock);
    writeFileSync(firstLock, deadRecord);
    const changeDead = run("change", [first, "pages.0.title=First after the dead lock"]);
    check("F-558 a DEAD holder's lock (its process gone) stops nothing: status says held and stale; report, export --with-snapshot and health say 'no snapshot of acme-first yet — run <the refresh line> first' with remedy.line, publish the same as its why, and the dead lock is left as it was (they read, never take); rebuild takes it over (stderr says whose) and then says no snapshot, leaving no lock; a display change takes it over, is saved, and says its rebuild did not run for want of a snapshot (exit 0, done.done false)",
      status558.code === 0 && status558.json?.lock?.held === true && status558.json.lock.stale === true && status558.json.lock.by === "dead" && readersSaid && deadUntouched &&
        rebuildDead.code === 1 && noSnap.test(rebuildDead.json?.error ?? "") && /took over a stale refresh lock of "acme-first" held by dead/.test(rebuildDead.stderr) && rebuildTookOver &&
        changeDead.code === 0 && changeDead.json?.saved === true && changeDead.json.done?.kind === "rebuild" && changeDead.json.done.done === false && noSnap.test(changeDead.json.done.why) && !existsSync(firstLock) && readJson(specFile(first)).pages[0].title === "First after the dead lock",
      [status558.json?.lock, Object.fromEntries(Object.entries(readers).map(([v, r]) => [v, r.json?.error ?? r.json?.publish?.why])), rebuildDead.json?.error ?? rebuildDead.stderr?.slice(-300), changeDead.json?.done ?? changeDead.json?.error]);
    // JUDGE (the class, closed both ways): the script's own census of no-snapshot sites — every call of the three helpers outside their definitions — is exactly the six verbs this block drove, and the phrase "no snapshot of" is spelled on two lines of the script alone (the helper and the export's own words).
    const srcLines = readFileSync(SCRIPT, "utf8").split("\n");
    const sites = srcLines.filter((l) => /\b(refuseNoSnapshot|noSnapshotWhy|noSnapshotLine)\(ctx, slug/.test(l) && !/^\s*(function|const) (refuseNoSnapshot|noSnapshotWhy|noSnapshotLine)\b/.test(l) && !/alreadyRunningText\(/.test(l) && !/^\s*\/\//.test(l));
    const literal = srcLines.filter((l) => /no snapshot of "/.test(l) && !/^\s*(\/\/|\*)/.test(l));
    check("F-558 JUDGE: the script's census of no-snapshot sites (calls of the three helpers outside their definitions) is exactly six — publishNow, the change's rebuild, rebuild, report, export, health — the six verbs this block drove under a live lock, and 'no snapshot of' is spelled on two lines of the script alone (the helper and the export's own words), so no verb refuses for a missing snapshot without reading the lock first",
      sites.length === 6 && literal.length === 2, [sites.map((l) => l.trim().slice(0, 100)), literal.map((l) => l.trim().slice(0, 100))]);
  }
  check("refusals: an unknown verb, a missing slug, a refresh of a draft, an unknown question (purpose, dropped, among them), and a workspace with no KB each exit 1 with one line",
    run("frobnicate", []).code === 1 && run("status", []).code === 1 && run("refresh", ["quick"]).code === 1 && /is a draft, not a saved dashboard/.test(run("refresh", ["quick"]).json?.error ?? "") && run("answer", [SLUG, "nope", "x"]).code === 1 && /no question is called "purpose"/.test(run("answer", ["quick", "purpose", "x"]).json?.error ?? "") && run("list", [], { flags: ["--workspace", join(ROOT, "nowhere"), "--bin", FAKE] }).code === 1);
  check("the summaries carry counts and verdicts, never rows: no account name and no message text reaches stdout from a refresh", !JSON.stringify(resumed.json).includes("Acme Customer") && JSON.stringify(resumed.json).length < 12000);
  // F-581: an auth death the CLI reports while the token is live (a second gs-admin process on the machine) is read once
  // more before the run stops. The stand-in kills ONE rp run with the CLI's login wording while its whoami stays valid.
  rmSync(join(STATE, "faults.json"), { force: true });
  const callsBefore581 = argvLines().length;
  const liveToken = run("refresh", [SLUG], { env: { FAKE_FAULTS: JSON.stringify([{ match: "rp run", kind: "auth", skip: 3, times: 1 }]) } });
  const after581 = argvLines().slice(callsBefore581);
  check("F-581: a call the CLI answers with 'run gs-admin login' while whoami still reads the token valid is made once more after one whoami read, and the refresh completes (exit 0, the line said on stderr, a second whoami in the argv log); only a second death, or a whoami that reads expired, stops the run",
    liveToken.code === 0 && liveToken.json?.status === "ok" && /the CLI reported the token expired, but it reads live: trying once more/.test(liveToken.stderr) && after581.filter((a) => a === "whoami").length >= 2 && !/stopped: the token expired/.test(liveToken.stderr),
    [liveToken.code, liveToken.json?.status ?? liveToken.json?.error, liveToken.json?.pull?.calls, liveToken.stderr?.split("\n").filter((l) => /token/.test(l)).slice(0, 3)]);
  check("F-534 reopen's class: no output of any verb this suite ran (stdout or stderr) prints a structured value as \"[object …]\"", objectWords.length === 0, objectWords.slice(0, 5));
} finally {
  lateCleanup();
  removeTempDir(ROOT);
}

console.log(failures ? `\ndashboard: ${failures} FAILED of ${total}` : `\ndashboard: all ${total} checks passed`);
process.exit(failures ? 1 : 0);
