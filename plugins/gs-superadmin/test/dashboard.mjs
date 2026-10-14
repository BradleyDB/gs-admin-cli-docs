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
// default (F-512).
//
// The tables are held to their sources: every setting the spec writer
// describes has exactly one cost, the page's LACKS rows agree with it, and
// every ask is the wording Bradley ruled (F-511, 2026-10-12), with the plan's
// figures where the ruling put them.
//
// Run:  node plugins/gs-superadmin/test/dashboard.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { makeTempDir, removeTempDir, writeFiles, runNode } from "../../../test/rig.mjs";
import { COSTS, COST_KINDS, ADAPTER_MAPPING, QUESTIONS, CLOSING_ASK, CLOSING_OPTIONS, askText, defaultAnswer, composeAnswer, defaultGroupRules, categoryCostText, changeCost, coveredPath, computeDelta, adapterParams, pullSecondsAfter, loginsFor, LOGIN_SECONDS, EXIT, KEEP_SNAPSHOTS, LOCK_STALE_MS, LOCK_FILE, STATE_FILE, SNAPSHOTS_DIR, PREVIEW_DIR, SUGGESTION_FILE, ACCOUNTS_DIR, PUBLISH_TARGETS_FILE, PUBLISH_DIR } from "../scripts/dashboard.mjs";
import { resolveGroups, programTraits } from "../scripts/dashboard-groups.mjs";
import { SPEC_DESCRIPTIONS, defaultSpec, openSpec, DEFAULT_ACCOUNT_LISTS } from "../scripts/dashboard-spec.mjs";
import { HOW_TO_REFRESH_RULED } from "./fixtures/engagement/ruled-text.mjs";
import { LACKS, HOW_TO_REFRESH_TEXT } from "../scripts/dashboard-runtime.mjs";
import { openSnapshot } from "../scripts/engagement-query.mjs";
import { kbFiles, OWN_SITE_UNSUBSCRIBE, TEMPLATES_DOMAIN } from "./fixtures/engagement/acme-tenant.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "..", "scripts", "dashboard.mjs");
const FAKE = join(HERE, "fixtures", "engagement", "fake-gs-admin.mjs");
const GOLDEN = JSON.parse(readFileSync(join(HERE, "fixtures", "engagement", "snapshot-acme.json"), "utf8"));
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const TODAY = "2026-09-15";
const SLUG = "acme-health";

let failures = 0;
let total = 0;
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
  return { code: r.status, json, stderr: r.stderr };
};
const dash = (slug = SLUG, kb = KB) => join(kb, "dashboards", slug);
const draftFile = (slug = SLUG, kb = KB) => join(dash(slug, kb), "spec.draft.json");
const specFile = (slug = SLUG, kb = KB) => join(dash(slug, kb), "spec.json");
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const argvLines = () => (existsSync(join(STATE, "argv.jsonl")) ? readFileSync(join(STATE, "argv.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).argv.join(" ")) : []);
const snapshots = (slug = SLUG, kb = KB) => (existsSync(join(dash(slug, kb), SNAPSHOTS_DIR)) ? readdirSync(join(dash(slug, kb), SNAPSHOTS_DIR)).filter((f) => f.endsWith(".json")).sort() : []);
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
      /the most engaged list: give a size and a floor as two numbers/.test(run("answer", [SLUG, "customer-list-detail", "sizes:lots|keep|keep"]).json?.error ?? ""), [sized.json, segmented.json, afterSegments]);
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
  const asArtifact = run("answer", [SLUG, "leaders-copy", "artifact"]);
  const draftArtifact = readJson(draftFile()).spec.publish;
  const toFolder = run("answer", [SLUG, "leaders-copy", composeAnswer(copyQ.json?.question?.options?.[0] ?? { id: "" }, { folder: SHARE })]);
  const targets = existsSync(join(WS, ".gs-superadmin", PUBLISH_TARGETS_FILE)) ? readJson(join(WS, ".gs-superadmin", PUBLISH_TARGETS_FILE)) : null;
  const draftPublish = readJson(draftFile()).spec.publish;
  check("PUB-3 the leaders' copy question: asked after the expected reasons, the shared folder first (the default: set later), the artifact link and the workspace only beside it, with the cost sentence (viewers pay nothing); a folder given is written to the workspace's publish targets (the machine's), the spec naming only the target and the file; a folder that is not there is refused with nothing written; the artifact answer sets the artifact target with no link yet",
    copyQ.json?.question?.id === "leaders-copy" && isDeepStrictEqual(copyQ.json.question.options.map((o) => o.id), ["folder:<folder>", "folder-later", "artifact", "none"]) && /Viewers pay nothing either way: the leaders' copy is a file, so opening it runs no query and no session\.$/.test(copyQ.json.question.ask) &&
      missingFolder.code === 1 && /does not exist or is not a folder/.test(missingFolder.json?.error ?? "") && asArtifact.code === 0 && isDeepStrictEqual(draftArtifact, { target: "claude-artifact", config: { url: null } }) &&
      toFolder.code === 0 && toFolder.json.publishTarget?.name === "leaders" && targets?.targets?.leaders?.folder === resolve(SHARE) && isDeepStrictEqual(draftPublish, { target: "file-copy", config: { to: "leaders", file: `${SLUG}-leaders.html`, datedCopies: false, datasets: true } }) && !JSON.stringify(readJson(draftFile()).spec).includes("leaders-share"),
    [copyQ.json?.question?.options, missingFolder.json, draftArtifact, toFolder.json, targets, draftPublish]);
  const callsBeforeClosing = argvLines().length;
  const closing = run("next", [SLUG]);
  check("the closing step (ruling 19): once every setting is answered, next returns the first action row WITH the closing block: the ruled ask priced on the exact settings (a new plan, since the pull-affecting answers moved), the login's remaining minutes read now, and the four options with the action answers each stands for",
    closing.code === 0 && closing.json?.question?.id === "dry-run" && closing.json.closing && /^Ready to save\. A full refresh with these settings is about \d+ calls and about \d+ minutes on this tenant; your login has about \d+ minutes left, enough for it\. /.test(closing.json.closing.ask) && closing.json.closing.ask.endsWith(` ${HOW_TO_REFRESH_RULED("acme-health", "acme-prod")}`) &&
      closing.json.question.ask === closing.json.closing.ask && isDeepStrictEqual(closing.json.closing.options.map((o) => o.id), ["save-now", "dry-run", "save-only", "go-back"]) && closing.json.closing.options.every((o) => Array.isArray(o.answers)) && argvLines().length > callsBeforeClosing && closing.json.progress.remaining === 3, closing.json);
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
  check("change (the customer lists): a re-selection over the last run directory's rows (reduce again, no pull): the snapshot's selection record now holds the one list of 2 and the pages are rebuilt",
    relisted.code === 0 && relisted.json.consequence === "reselect" && relisted.json.done.done === true && isDeepStrictEqual(relisted.json.done.lists, [{ kind: "most-bounced", kept: 2 }]) && argvLines().length === callsBeforeChange && snapshot1b.honesty.accountSelection.lists.length === 1 && snapshot1b.honesty.accountSelection.lists[0].kept.length === 2, relisted.json);
  // The last plan is the one the latest snapshot was pulled from (its run directory, the derived-lookback one), never
  // the preview's or an older plan's.
  const lastPlanBefore = JSON.parse(readFileSync(join(WS, ".gs-superadmin", "tmp", "engagement", refresh.json.run, "plan.json"), "utf8"));
  const priced = run("change", [SLUG, "sources.0.params.stepDetail=true", "--dry-run"]);
  const pulled = run("change", [SLUG, "sources.0.params.stepDetail=true"]);
  const snap2 = snapshots();
  check("change (a pull setting): the consequence is a new pull priced for the spec AFTER the change (F-511 instance 24: the last plan's seconds plus what step detail adds, not the old plan's figure), and the refresh runs: a second snapshot, the step-detail switch changing forces a full one, the delta against the first pull wired to the pages",
    priced.code === 0 && priced.json.pullSeconds === lastPlanBefore.estimate.full.seconds + lastPlanBefore.estimate.stepDetail.addsSeconds && priced.json.consequenceText === `the next refresh pulls everything again, about ${Math.max(1, Math.round(priced.json.pullSeconds / 60))} minutes` &&
      pulled.code === 0 && pulled.json.consequence === "pull" && /about \d+ minute/.test(pulled.json.consequenceText) && pulled.json.done.kind === "refresh" && pulled.json.done.status === "ok" && snap2.length === 2 && pulled.json.done.pull.mode === "full" && /step-detail switch changed/.test(pulled.json.done.pull.why) &&
      pulled.json.done.delta?.previousPulledAt === snapshot1.meta.pulledAt && pageText("admin").includes("Change since the last refresh (pulled") && pageText("exec").includes("Since last pull:"), [priced.json?.pullSeconds, lastPlanBefore.estimate?.full, pulled.json?.consequenceText, pulled.json?.done?.pull]);
  const identity = run("change", [SLUG, 'tenantHost="acme--sbx.gainsightcloud.com"']);
  check("change refuses an identity setting (the tenant, the slug)", identity.code === 1 && /cannot be changed/.test(identity.json?.error ?? ""), identity.json);

  // ══ --health-only, and the lock ═══════════════════════════════════════════
  const callsBeforeHealth = argvLines().length;
  const healthOnly = run("refresh", [SLUG, "--health-only"]);
  check("refresh --health-only: a selective pull that reads the current month's facts again with the health families and carries the rest (fewer calls than the full pull), then rebuilds", healthOnly.code === 0 && healthOnly.json.healthOnly === true && healthOnly.json.pull.mode === "selective" && snapshots().length === 3 && healthOnly.json.pull.calls.made < pulled.json.done.pull.calls.made && argvLines().length > callsBeforeHealth, [healthOnly.json?.pull, pulled.json?.done?.pull?.calls]);
  writeFileSync(join(dash(), LOCK_FILE), JSON.stringify({ by: "ben", at: new Date().toISOString(), pid: 1 }));
  const locked = run("refresh", [SLUG]);
  check("the lock: a second refresh is refused naming the holder and the time, before any call", locked.code === 1 && /already running: started by ben at /.test(locked.json?.error ?? "") && snapshots().length === 3, locked.json);
  const staleAt = new Date(Date.now() - LOCK_STALE_MS - 60000).toISOString();
  writeFileSync(join(dash(), LOCK_FILE), JSON.stringify({ by: "ben", at: staleAt, pid: 1 }));
  // F-513: the budget gate is gone. A login shorter than the pull is not refused: the pull runs as far as the token
  // allows (here the stand-in CLI kills the token after six calls), stops with exit 3 keeping its calls, and the stop
  // says how many more logins it needs; the stale lock it took over is recorded in that refusal (the first sitting's note).
  const shortLogin = run("refresh", [SLUG], { tenant: { ...TENANT, token: { state: "valid", seconds: 60 } }, env: { FAKE_FAULTS: JSON.stringify([{ match: "rp run", kind: "auth", skip: 30, times: 9999 }]) } });
  check("F-513 a pull longer than the login is NOT refused at the gate: it starts (stderr says it will take more logins), stops cleanly on the token with exit 3 after the calls it could make, names the login to run and that the next run continues it, says about how many more logins, and keeps its run resumable; the stale lock it took over is recorded in the refusal and released; no snapshot",
    shortLogin.code === EXIT["token-expired"] && shortLogin.json?.status === "token-expired" && /the refresh stopped after \d+ calls this run/.test(shortLogin.json.error) && /run gs-admin login, then run `node .gs-superadmin.plugin.scripts.dashboard.mjs refresh acme-health --kb acme-prod` again: it continues where it stopped/.test(shortLogin.json.error) && /about \d+ more logins? of an hour to finish/.test(shortLogin.json.error) &&
      /will run as far as the login allows \(about \d+ logins? of an hour in all\)/.test(shortLogin.stderr) && isDeepStrictEqual(shortLogin.json.lockTakenOver, { by: "ben", at: staleAt }) && /a stale lock held by ben since/.test(shortLogin.json.error) && /took over a stale refresh lock of "acme-health" held by ben since/.test(shortLogin.stderr) && !existsSync(join(dash(), LOCK_FILE)) && existsSync(join(dash(), STATE_FILE)) && snapshots().length === 3, shortLogin.json);
  writeFileSync(join(dash(), LOCK_FILE), JSON.stringify({ by: "ben", at: staleAt, pid: 1 }));
  const stale = run("refresh", [SLUG]);
  check("after a login the same refresh RESUMES the stopped pull to a completed one (F-513: save → stop → resume), reusing the calls made, and a lock older than two hours is stale: the refresh takes it over and says whose it was",
    stale.code === 0 && stale.json.resumed === true && stale.json.pull.calls.reused > 0 && stale.json.lockTakenOver?.by === "ben" && !existsSync(join(dash(), LOCK_FILE)) && !existsSync(join(dash(), STATE_FILE)) && snapshots().length === 4, stale.json?.lockTakenOver ?? stale.json);
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
  check("report: the open-rate report over the latest snapshot with no pull, under the dashboard, with the snapshot's age and the minutes a pull would take (no cadence is read: the skill says the age and offers the pull)", report.code === 0 && existsSync(report.json.report) && report.json.report.includes(join(dash(), "reports")) && typeof report.json.snapshotAgeDays === "number" && typeof report.json.refreshMinutes === "number" && !("withinCadence" in report.json) && !("cadence" in report.json) && !("staleAfterDays" in report.json), report.json);
  const health = run("health", [SLUG, "--program", "p-onboard"]);
  check("health: a program's masked bounce reasons, participant failures, step failures and the 'Other' samples to the terminal", health.code === 0 && health.json.program.id === "p-onboard" && health.json.bounceReasons.length > 0 && Array.isArray(health.json.otherSamples) && health.json.health.pulled === true, health.json?.program);
  const exported = run("export", [SLUG, "--out", join(ROOT, "handover", "acme-health.json"), "--with-snapshot"]);
  check("export --with-snapshot: the spec's portable file and the latest snapshot beside it", exported.code === 0 && existsSync(exported.json.out) && existsSync(exported.json.snapshot) && exported.json.snapshot.endsWith("acme-health.snapshot.json"), exported.json);
  const imported = run("import", ["--file", join(ROOT, "handover", "acme-health.json")], { flags: ["--workspace", WS2, "--kb", KB2, "--bin", FAKE, "--today", TODAY, "--by", "cy"] });
  const rebuilt = run("rebuild", [SLUG], { flags: ["--workspace", WS2, "--kb", KB2, "--bin", FAKE, "--today", TODAY, "--by", "cy"] });
  const status2 = run("status", [SLUG], { flags: ["--workspace", WS2, "--kb", KB2, "--bin", FAKE, "--today", TODAY, "--by", "cy"] });
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
    const asArgv = (line) => line.replace(/^node \.gs-superadmin\/plugin\/scripts\/dashboard\.mjs /, "").replace("<program id>", "p-onboard").replace(/=$/, '=["example.com"]').split(" ").map((t, i, all) => (t === "''" && all[i - 1] === "--account-name" ? "Acme Customer 01" : t));
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
    check("PUB-3 file-copy, the default: the save's first refresh copied the leaders' page into the folder this machine maps \"leaders\" to, under the spec's file name, byte for byte the workspace's latest-exec.html; the summary and stderr say where; the tables went beside it as CSV files with a definitions file, each table's rows ending in the pull's time",
      pub1?.target === "file-copy" && pub1.published === true && pub1.file === shared && existsSync(shared) && readFileSync(shared, "utf8") === pageText("exec") && new RegExp(`the leaders' copy was published: .*${SLUG}-leaders\\.html \\(the same file each time\\)`).test(refresh.stderr) &&
        existsSync(join(dataDir, "definitions.csv")) && pub1.datasets?.files?.length >= 3 && pub1.datasets.files.every((f) => existsSync(join(dataDir, f))) &&
        pub1.datasets.files.filter((f) => f !== "definitions.csv").every((f) => { const rows = csvRows(readFileSync(join(dataDir, f), "utf8")); return rows[0].endsWith(",Data pulled") && rows.slice(1).every((r) => r.endsWith(`,${latestPulledAt}`)); }) &&
        csvRows(readFileSync(join(dataDir, "definitions.csv"), "utf8"))[1].startsWith(`pulled,Data pulled,${latestPulledAt}`),
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
    // A data file of a panel removed since is pruned, in the workspace and in the shared folder.
    for (const d of [dataDir, join(dash(), "latest-exec-data")]) writeFileSync(join(d, "a-removed-panel.csv"), "old");
    const pruned = run("publish", [SLUG]);
    check("PUB-3 a publish never refuses: a malformed publish-targets file is said (exit 0, not published, the pages untouched); and a data file no panel writes any more is removed from both data folders on the next publish",
      malformed.code === 0 && malformed.json.publish?.published === false && /could not be published/.test(malformed.json.publish.why ?? "") &&
        pruned.code === 0 && pruned.json.publish?.published === true && !existsSync(join(dataDir, "a-removed-panel.csv")) && !existsSync(join(dash(), "latest-exec-data", "a-removed-panel.csv")) && existsSync(join(dataDir, "definitions.csv")), [malformed.json, pruned.json?.publish]);
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
  const questionsVerb = run("questions", []);
  check("the `questions` verb: every row with its ask and options as a reader sees them (the ruled letters where a figure comes from the plan), the defaults, and the closing step beside its three rows; `costs` the cost table",
    questionsVerb.code === 0 && questionsVerb.json.questions.length === QUESTIONS.length && questionsVerb.json.questions.find((x) => x.id === "window").ask.includes("about M minutes for each month covered") && questionsVerb.json.questions.find((x) => x.id === "programs").default === "sent-90d" && questionsVerb.json.questions.find((x) => x.id === "grouping").default === "(from the plan)" &&
      questionsVerb.json.questions.find((x) => x.id === "tabs").options[1].followUps.length === 4 && isDeepStrictEqual(questionsVerb.json.closing.rows, ["dry-run", "estimate", "save"]) && /your login has about T minutes left/.test(questionsVerb.json.closing.ask) && run("costs", []).json?.costs?.title === "rebuild", questionsVerb.json?.questions?.map((x) => x.id));
  check("refusals: an unknown verb, a missing slug, a refresh of a draft, an unknown question (purpose, dropped, among them), and a workspace with no KB each exit 1 with one line",
    run("frobnicate", []).code === 1 && run("status", []).code === 1 && run("refresh", ["quick"]).code === 1 && /is a draft, not a saved dashboard/.test(run("refresh", ["quick"]).json?.error ?? "") && run("answer", [SLUG, "nope", "x"]).code === 1 && /no question is called "purpose"/.test(run("answer", ["quick", "purpose", "x"]).json?.error ?? "") && run("list", [], { flags: ["--workspace", join(ROOT, "nowhere"), "--bin", FAKE] }).code === 1);
  check("the summaries carry counts and verdicts, never rows: no account name and no message text reaches stdout from a refresh", !JSON.stringify(resumed.json).includes("Acme Customer") && JSON.stringify(resumed.json).length < 12000);
} finally {
  removeTempDir(ROOT);
}

console.log(failures ? `\ndashboard: ${failures} FAILED of ${total}` : `\ndashboard: all ${total} checks passed`);
process.exit(failures ? 1 : 0);
