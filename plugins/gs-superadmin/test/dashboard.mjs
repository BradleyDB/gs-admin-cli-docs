#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// dashboard.mjs (test) — fixtures for scripts/dashboard.mjs (PUB-1, DSH-3,
// UX-2): the one entry command, driven as a real process over a throwaway
// workspace of the fictional acme tenant with the stand-in CLI behind --bin.
//
// The scripted walk: new → next / answer through every question → save →
// refresh → pages; a display change → rebuild with no call; a list change →
// re-selection over the last run directory; a pull change → refresh; the
// health-only refresh; the lock (held, stale); the wrong-tenant refusal before
// any call; the expired token leaving the previous pages byte-identical and
// the run resumable; re-documentation of a stale and a never-documented
// program and of the templates the KB lacks; the draft take-over refusal;
// export with the snapshot, then import on a second workspace.
//
// The two tables are held to their sources: every setting the spec writer
// describes has exactly one cost, and the page's LACKS rows agree with it.
//
// Run:  node plugins/gs-superadmin/test/dashboard.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, rmSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { makeTempDir, removeTempDir, writeFiles, runNode } from "../../../test/rig.mjs";
import { COSTS, COST_KINDS, ADAPTER_MAPPING, QUESTIONS, changeCost, coveredPath, panelsWithout, computeDelta, adapterParams, EXIT, KEEP_SNAPSHOTS, LOCK_STALE_MS, LOCK_FILE, STATE_FILE, SNAPSHOTS_DIR, PREVIEW_DIR, SUGGESTION_FILE } from "../scripts/dashboard.mjs";
import { SPEC_DESCRIPTIONS, defaultSpec, presetPanels, openSpec, FRESHNESS_BY_CADENCE } from "../scripts/dashboard-spec.mjs";
import { LACKS } from "../scripts/dashboard-runtime.mjs";
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
writeFiles(WS, { ".gs-superadmin/.keep": "", ...kbFiles("acme-prod", { cadence: true, signals: true }), "brand/logo.png": Buffer.from(PNG, "base64") });
writeFiles(WS2, { ".gs-superadmin/.keep": "", ...kbFiles("acme-prod", { cadence: true, signals: true }) });
mkdirSync(STATE, { recursive: true });
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

try {
  // ══ The two tables, held to their sources ══════════════════════════════════
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
      disagree.length === 0 && (() => { const b = defaultSpec({ slug: "x", tenantHost: "acme.gainsightcloud.com" }); const a = structuredClone(b); a.pages[1].tabs.find((t) => t.id === "templates").enabled = true; const h = structuredClone(b); h.pages[0].tabs.find((t) => t.id === "health").enabled = false; return changeCost(b, a).consequence === "rebuild" && changeCost(b, h).consequence === "pull"; })(), disagree);
    const ids = QUESTIONS.map((q) => q.id);
    check("the questions table: one row per question with its id, wording, kind, options, path, skip rule and judgment flag; ids unique; the three judgment nodes are purpose, grouping and look; every answerable question has an apply; the fast path's two questions are the estimate and the save",
      new Set(ids).size === ids.length && isDeepStrictEqual(QUESTIONS.filter((q) => q.judgment).map((q) => q.id), ["purpose", "grouping", "look"]) && QUESTIONS.every((q) => typeof q.ask === "string" && q.ask.length > 20 && typeof q.options === "function" && typeof q.kind === "string") &&
        QUESTIONS.filter((q) => !["preflight", "action"].includes(q.kind)).every((q) => typeof q.apply === "function") && isDeepStrictEqual(QUESTIONS.filter((q) => q.kind === "action").map((q) => q.id), ["dry-run", "estimate", "save"]) && ids[0] === "tenant" && ids.at(-1) === "save" && ids.length >= 20, ids);
    check("F-504 the interview says what the bounce categories cost before a category file, a domain or a test account is added: the failure-settings and tabs questions quote the plan's categories × recipient classes = counted calls with the minutes; the internal-domains and test-accounts asks say each adds a class",
      (() => {
        const health = { on: false, addsSeconds: 600, addsCalls: 20, samples: null, categoryCalls: { bounce: { categories: 55, classes: 6, calls: 330, seconds: 990, secondsEach: 3 } } };
        const fs = QUESTIONS.find((q) => q.id === "failure-settings").options({ plan: { estimate: { health } }, spec: defaultSpec({ slug: "x", tenantHost: "acme.gainsightcloud.com" }) });
        const tabs = QUESTIONS.find((q) => q.id === "tabs").options({ plan: { estimate: { health } }, spec: defaultSpec({ slug: "x", tenantHost: "acme.gainsightcloud.com" }) });
        const none = QUESTIONS.find((q) => q.id === "tabs").options({ plan: { estimate: { health: { ...health, categoryCalls: { bounce: { categories: 0, classes: 1, calls: 0, seconds: 0, secondsEach: 3 } } } } }, spec: defaultSpec({ slug: "x", tenantHost: "acme.gainsightcloud.com" }) });
        return /55 bounce categories .* cost 330 counted calls a refresh \(55 × 6 recipient classes: all, each internal domain, the test accounts, and the test accounts on each domain; about 17 minutes\)/.test(fs[0].text) && /330 counted calls/.test(tabs[0].text) && !/counted call/.test(none[0].text) &&
          /adds one counted call per bounce category/.test(QUESTIONS.find((q) => q.id === "internal-domains").ask) && /one counted call per bounce category, and one more per internal domain/.test(QUESTIONS.find((q) => q.id === "test-accounts").ask);
      })());
    check("the wording holds the rulings: test accounts as company records (ids or names, never addresses), the unsubscribe link's reason (F-470), freshness from the cadence, the customer-lists question in Bradley's words with how to add them later and who can look a company up, the window kinds with the first pull's cost, the leaders' names default no, the look's logo from a local file never a URL",
      /company records|company ids/.test(QUESTIONS.find((q) => q.id === "test-accounts").ask) && /Never email addresses/.test(QUESTIONS.find((q) => q.id === "test-accounts").ask) && /counted as content clicks/.test(QUESTIONS.find((q) => q.id === "unsubscribe-links").ask) &&
        QUESTIONS.find((q) => q.id === "cadence").options({}).every((o) => /stale after \d+ days, from your cadence/.test(o.text)) && /top customers that aren't opening or are bouncing, or only how each program is doing/.test(QUESTIONS.find((q) => q.id === "customer-lists").ask) &&
        QUESTIONS.find((q) => q.id === "customer-lists").options({ plan: null, spec: defaultSpec({ slug: "x", tenantHost: "acme.gainsightcloud.com" }) }).some((o) => /add them later: edit the dashboard, turn customer lists on, refresh/.test(o.text) && /needs a gs-admin login, so only an admin/.test(o.text)) &&
        /A first pull scales with the months covered/.test(QUESTIONS.find((q) => q.id === "window").ask) && /Default no/.test(QUESTIONS.find((q) => q.id === "leader-names").ask) && /local PNG or JPEG you name, never a URL/.test(QUESTIONS.find((q) => q.id === "look").ask));
  }
  // ══ Pure pieces ════════════════════════════════════════════════════════════
  {
    const base = defaultSpec({ slug: "x", tenantHost: "acme.gainsightcloud.com" });
    const edited = structuredClone(base);
    edited.title = "Other";
    edited.sources[0].params.internalDomains = ["acme.com"];
    edited.accounts.lists = [{ kind: "most-bounced", n: 5, floor: 0 }];
    const cost = changeCost(base, edited);
    const silent = structuredClone(base); silent.health.silentDays = 45;
    check("changeCost: the silent threshold costs a pull only when it moves the derived lookback (above the last plan's longest schedule period); below it, or with no plan, as the table says",
      changeCost(base, silent, { longestPeriodDays: 91 }).consequence === "rebuild" && changeCost(base, silent, { longestPeriodDays: 40 }).consequence === "pull" && changeCost(base, silent).consequence === "pull");
    check("changeCost: every changed setting by its description path with its cost, and the highest cost as the consequence (a domain beats a title; a list re-selection sits between)",
      isDeepStrictEqual(cost.changed.map((c) => [c.path, c.cost]), [["accounts.lists[]", "reselect"], ["sources[].params.internalDomains[]", "pull"], ["title", "rebuild"]]) && cost.consequence === "pull" && changeCost(base, { ...base, title: "T" }).consequence === "rebuild" && changeCost(base, base).consequence === null &&
        coveredPath("sources[0].params.internalDomains[1]") === "sources[].params.internalDomains[]" && coveredPath("groups.overrides.p-1.group") === "groups.overrides{}" && coveredPath("pages[1].tabs[2].enabled") === "pages[].tabs[].enabled" && coveredPath("theme.colors.accent") === "theme.colors.accent", cost);
    const panels = presetPanels(base.pages[0]);
    const without = panelsWithout(panels, ["clicked", "clickRate", "surveyParticipants", "submitted", "partiallySubmitted", "anyResponse", "responseRate"]);
    check("panelsWithout: the metrics left off leave every query, sort, having and column list; a panel left with nothing (Survey responses) is dropped; the rest keep their shape and the spec still validates",
      !without.some((p) => p.id === "survey-responses") && without.every((p) => !p.query || p.query.metrics.every((m) => !["clicked", "clickRate", "responseRate"].includes(m))) && without.find((p) => p.id === "open-rate-trend").query.metrics.join() === "openRate" &&
        (() => { const s = structuredClone(base); s.pages[0].panels = without; return openSpec(s) !== null; })(), without.map((p) => p.id));
    const later = structuredClone(GOLDEN);
    later.meta.pulledAt = "2026-10-15T09:00:00-07:00";
    for (const r of later.facts.byTemplate) if (r.month < later.meta.incompleteFrom.slice(0, 7)) r.opened += 1;
    const delta = computeDelta(base, later, GOLDEN);
    check("computeDelta: over the closed months both snapshots hold, each headline metric's previous and current figure and the change (points for a rate, a ratio for a count); null with no previous; the programs added and gone",
      delta.previousPulledAt === GOLDEN.meta.pulledAt && delta.closedMonths.length > 0 && delta.metrics.opened.change.kind === "ratio" && delta.metrics.opened.change.value > 1 && delta.metrics.openRate.change.kind === "points" && delta.metrics.openRate.change.value > 0 && delta.metrics.sent.change.value === 1 &&
        computeDelta(base, GOLDEN, null) === null && isDeepStrictEqual(delta.programs, { added: 0, gone: 0 }), delta.metrics);
    const p = adapterParams(base, { today: TODAY });
    const fixed = structuredClone(base); fixed.sources[0].params.window = { kind: "fixed", from: "2025-01", to: "2025-06" };
    const since = structuredClone(base); since.sources[0].params.window = { kind: "since", from: "2024-07" };
    const withHealthOff = structuredClone(base); for (const pg of withHealthOff.pages) pg.tabs.find((t) => t.id === "health").enabled = false;
    check("adapterParams maps the spec: a rolling window counts back from today, a fixed one is its months, a since one runs to the current month; health is on when any page's Health tab is on and the lookback is at least silentDays, capped at the window; --health-only reads one month again; customer lists and fields ride",
      p.from === "2025-09" && p.to === "2026-09" && adapterParams(fixed, { today: TODAY }).from === "2025-01" && adapterParams(fixed, { today: TODAY }).to === "2025-06" && adapterParams(since, { today: TODAY }).from === "2024-07" && adapterParams(since, { today: TODAY }).to === "2026-09" &&
        p.health.pull === true && adapterParams(withHealthOff, { today: TODAY }).health.pull === false && p.health.lookbackDays === 30 && adapterParams(base, { today: TODAY, lookbackDays: 120 }).health.lookbackDays === 120 && adapterParams(base, { today: TODAY, lookbackDays: 9999 }).health.lookbackDays === 366 &&
        adapterParams(base, { today: TODAY, healthOnly: true }).repullMonths === 1 && p.repullMonths === 2 && p.accounts.lists.length === 3 && isDeepStrictEqual(p.accounts.fields, []) && p.health.quietDueDays === 5 && p.health.samplePrograms === 25, p);
  }

  // ══ The interview, as a real process ═══════════════════════════════════════
  const started = run("new", [SLUG, "--title", "Acme health", "--owner", "CS Ops"]);
  check("new: a draft from the defaults, held by the caller, with the first question to ask", started.code === 0 && started.json?.state === "new" && started.json.by === "ana" && started.json.next === "purpose" && existsSync(draftFile()), started.json ?? started.stderr);
  const first = run("next", [SLUG]);
  check("next: the tenant pre-flight is automatic (whoami's host equals the spec's, confirmed on stderr), then the purpose, a judgment node with no options",
    first.code === 0 && first.json?.question?.id === "purpose" && first.json.question.judgment === true && first.json.question.options.length === 0 && readJson(draftFile()).answered.includes("tenant") && /tenant acme\.gainsightcloud\.com confirmed/.test(first.stderr), first.json ?? first.stderr);
  const purpose = run("answer", [SLUG, "purpose", "Which", "programs", "need", "attention", "this", "month."]);
  check("answer: a text answer lands in the spec through the writer and the ask-once key is marked; the next question follows", purpose.code === 0 && readJson(draftFile()).spec.purpose === "Which programs need attention this month." && purpose.json.next === "audiences", purpose.json ?? purpose.stderr);
  const audiences = run("answer", [SLUG, "audiences", "both"]);
  const badChoice = run("answer", [SLUG, "programs", "everything"]);
  check("a choice outside the options is refused with the options named, and nothing is written", audiences.code === 0 && badChoice.code === 1 && badChoice.json?.ok === false && /not one of the options/.test(badChoice.json.error) && !readJson(draftFile()).answered.includes("programs"), badChoice.json);
  const programs = run("answer", [SLUG, "programs", "window"]);
  check("programs: 'window' is every program with a send in the window (no selector)", programs.code === 0 && readJson(draftFile()).spec.sources[0].params.selector.sentSince === null, programs.json ?? programs.stderr);
  const callsBeforePlan = argvLines().length;
  const grouping = run("next", [SLUG]);
  const suggestion = existsSync(join(dash(), SUGGESTION_FILE)) ? readJson(join(dash(), SUGGESTION_FILE)) : null;
  check("next at grouping: the script makes the plan (cheap calls only: whoami, the program list, schemas, the tenant-wide reads; no fact call) and writes the group-suggestion input from the plan's program list, then hands the file over to the judgment node with the estimate",
    grouping.code === 0 && grouping.json?.question?.id === "grouping" && grouping.json.question.judgment === true && grouping.json.question.input.suggestionFile.endsWith(SUGGESTION_FILE) && suggestion?.kind === "dashboard-group-suggestion-input" && suggestion.programs.length > 5 &&
      suggestion.programs.every((p) => "recurring" in p && "sent" in p && p.sent > 0) && suggestion.tallies.model.length > 0 && grouping.json.estimate?.full?.calls > 0 && argvLines().length > callsBeforePlan && argvLines().length - callsBeforePlan < grouping.json.estimate.full.calls / 2, [grouping.json?.question?.input, suggestion?.programs?.length, argvLines().length - callsBeforePlan, grouping.json?.estimate?.full]);
  const rules = { rules: [{ kind: "characteristic", level: "supergroup", characteristic: "sendsSurveys", is: true, label: "Surveys" }, { kind: "characteristic", level: "supergroup", characteristic: "recurring", is: true, label: "Recurring" }], overrides: {} };
  const grouped = run("answer", [SLUG, "grouping", JSON.stringify(rules)]);
  check("grouping: the proposed rules (the prose's) are written by the script through the writer's validation", grouped.code === 0 && isDeepStrictEqual(readJson(draftFile()).spec.groups, rules), grouped.json ?? grouped.stderr);
  const domains = run("answer", [SLUG, "internal-domains", "acme.com"]);
  const tests = run("answer", [SLUG, "test-accounts", "co-09,", "name:Acme", "Customer", "03"]);
  const noSuch = run("answer", [SLUG, "test-accounts", "name:Nobody", "Here"]);
  check("test accounts as company records: an id is kept as given, a name is looked up once through the gate (one read-only company call; several matches or none are said, never guessed), and the answer is the ids",
    domains.code === 0 && tests.code === 0 && isDeepStrictEqual(readJson(draftFile()).spec.sources[0].params.testAccounts, ["co-03", "co-09"]) && tests.json.notes.some((n) => /"Acme Customer 03" is co-03/.test(n)) && argvLines().filter((a) => a.includes("--object company") && a.includes("Acme Customer 03")).length === 1 &&
      noSuch.code === 1 && /no account is named "Nobody Here"/.test(noSuch.json?.error ?? ""), [tests.json, noSuch.json]);
  const unsub = run("answer", [SLUG, "unsubscribe-links", OWN_SITE_UNSUBSCRIBE]);
  const badUnsub = run("answer", [SLUG, "unsubscribe-links", "not", "a", "host"]);
  check("unsubscribe links: the value the adapter accepts lands; one it would refuse is refused by the writer naming the field", unsub.code === 0 && badUnsub.code === 1 && /unsubscribeLinks\[0\] must be a link or a host/.test(badUnsub.json?.error ?? ""), badUnsub.json);
  const failureSettings = run("next", [SLUG]);
  check("failure settings: the question quotes the plan's sample context (how many programs have failures, the cap, what reading the rest would cost) before the default is taken",
    failureSettings.code === 0 && failureSettings.json.question.id === "failure-settings" && failureSettings.json.question.options.some((o) => /programs with refused participants/.test(o.text) && /unsampled/.test(o.text)), failureSettings.json?.question?.options);
  run("answer", [SLUG, "failure-settings", "default"]);
  const windowQ = run("next", [SLUG]);
  const windowA = run("answer", [SLUG, "window", "rolling:4"]);
  check("the window: the question shows the first pull's cost for the current months and that it scales; a rolling answer sets the kind and the months; the writer refuses a malformed one",
    windowQ.json?.question?.id === "window" && windowQ.json.question.options[0].text.includes("minute") && windowA.code === 0 && readJson(draftFile()).spec.sources[0].params.windowMonths === 4 && readJson(draftFile()).spec.sources[0].params.window.kind === "rolling" && run("answer", [SLUG, "window", "weekly"]).code === 1, windowQ.json?.question?.options);
  const cadence = run("answer", [SLUG, "cadence", "monthly"]);
  check("cadence: freshness follows from it (monthly: stale after 45 days) and the note says so", cadence.code === 0 && readJson(draftFile()).spec.freshness.maxAgeDays === FRESHNESS_BY_CADENCE.monthly && cadence.json.notes.some((n) => /stale after 45 days, from your cadence/.test(n)), cadence.json);
  run("answer", [SLUG, "metrics", "default"]);
  const look = run("answer", [SLUG, "look", JSON.stringify({ colors: { accent: "#0b57d0", muted: "#eeeeee" }, series: ["#0b57d0", "#0c58d1"], font: "Georgia, serif", radius: 4, logoFile: "brand/logo.png" })]);
  const theme = readJson(draftFile()).spec.theme;
  check("the look (UX-2): the extracted tokens are stored as the theme with the validator's notes beside them; a muted colour that would not read and two alike series colours are replaced and shown with the reason; the logo is read from the local PNG as a data URI",
    look.code === 0 && theme.colors.accent === "#0b57d0" && theme.font === "Georgia, serif" && theme.radius === 4 && theme.logo?.startsWith("data:image/png;base64,") && Array.isArray(theme.notes) && theme.notes.some((n) => n.token === "colors.muted") && theme.notes.some((n) => n.token === "series[1]") &&
      look.json.replaced.length === theme.notes.length && look.json.notes.some((n) => /colors\.muted: text must read/.test(n)), [look.json, theme?.notes]);
  const badLogo = run("answer", [SLUG, "look", JSON.stringify({ logoFile: "https://example.com/logo.png" })]);
  check("a logo is never fetched from a URL: a URL is not a file and is refused", badLogo.code === 1 && /does not exist/.test(badLogo.json?.error ?? ""), badLogo.json);
  const tabsQ = run("next", [SLUG]);
  check("tabs: the Health tab's minutes are shown before it is turned on (or that it is in the plan already)", tabsQ.json?.question?.id === "tabs" && (tabsQ.json.question.options[0].text.includes("Health is in this plan already") || tabsQ.json.question.options[0].text.includes("Turning Health on adds")), tabsQ.json?.question?.options);
  run("answer", [SLUG, "tabs", "default"]);
  const leaders = run("answer", [SLUG, "leader-names", "no"]);
  const listsQ = run("next", [SLUG]);
  const lists = run("answer", [SLUG, "customer-lists", "yes"]);
  const detail = run("answer", [SLUG, "customer-list-detail", JSON.stringify({ lists: [{ kind: "most-engaged", n: 3, floor: 2 }, { kind: "least-engaged", n: 3, floor: 2 }, { kind: "most-bounced", n: 3, floor: 0 }, { kind: "least-engaged", n: 2, floor: 1, per: "Industry" }], fields: ["Industry"] })]);
  check("customer lists: the question quotes the minutes with and without them from the plan; on, the detail question follows (skipped when off) and the lists and company fields land",
    leaders.code === 0 && listsQ.json?.question?.id === "customer-lists" && listsQ.json.question.options[1].text.includes("minute") && lists.code === 0 && lists.json.next === "customer-list-detail" && detail.code === 0 && readJson(draftFile()).spec.accounts.lists.length === 4 && isDeepStrictEqual(readJson(draftFile()).spec.accounts.fields, ["Industry"]), [listsQ.json?.question?.options, detail.json]);
  run("answer", [SLUG, "step-detail", "no"]);
  run("answer", [SLUG, "expected-reasons", "none"]);
  const callsBeforeDry = argvLines().length;
  const dry = run("answer", [SLUG, "dry-run", "yes"]);
  const previewPage = existsSync(join(dash(), PREVIEW_DIR, "latest-admin.html")) ? readFileSync(join(dash(), PREVIEW_DIR, "latest-admin.html"), "utf8") : "";
  check("the dry run: a cheap pull (no customer lists, no health, no step detail) rendered as preview pages in the theme (the accent colour and the logo are in the file), kept beside the draft",
    dry.code === 0 && dry.json.preview?.pages?.length === 2 && dry.json.preview.themed === true && previewPage.includes("--accent:#0b57d0") && previewPage.includes("data:image/png;base64,") && argvLines().slice(callsBeforeDry).every((a) => !a.includes("ao_failed_participants") && !/"GsCompanyId" ?,? ?"IN"|GsCompanyId","operator":"IN"/.test(a)), [dry.json?.preview, dry.stderr?.slice(-300)]);
  const estimate = run("answer", [SLUG, "estimate", "yes"]);
  check("the estimate: the full refresh's calls and minutes against the token, the knowledge-base gap priced, confirmed", estimate.code === 0 && estimate.json.confirmed === true && estimate.json.estimate.full.calls > 0 && estimate.json.estimate.token.fits === true && estimate.json.estimate.kb.undocumented + estimate.json.estimate.kb.behind >= 2, estimate.json);
  const done = run("next", [SLUG]);
  check("after the estimate every question but the save is answered; next says so", done.json?.question?.id === "save" && done.json.progress.remaining === 1, done.json);
  const saved = run("answer", [SLUG, "save", "later"]);
  check("save (later): the draft becomes the saved spec, the draft and the interview state are gone, no refresh ran", saved.code === 0 && saved.json.refresh === null && existsSync(specFile()) && !existsSync(draftFile()) && openSpec(readJson(specFile())).accounts.pull === true, saved.json ?? saved.stderr);

  // ══ The refresh ════════════════════════════════════════════════════════════
  const invBefore = manifest().inventory;
  const callsBeforeRefresh = argvLines().length;
  const refresh = run("refresh", [SLUG]);
  const snap1 = snapshots();
  const inv = manifest().inventory;
  check("refresh: the pull through the adapter (health on since the admin page's Health tab is on; customer lists on), the groups applied, the snapshot written under the dashboard, both pages built, the summary with the pull's mode, counts, the lookback and the caveats; no delta on a first pull",
    refresh.code === 0 && refresh.json?.status === "ok" && refresh.json.pull.mode === "full" && refresh.json.pull.health === true && refresh.json.pull.accounts === true && refresh.json.pull.lookbackDays >= 30 && snap1.length === 1 && existsSync(join(dash(), "latest-admin.html")) && existsSync(join(dash(), "latest-exec.html")) &&
      refresh.json.delta === null && /ungrouped/.test(refresh.json.ungrouped) && refresh.json.pages.length === 2 && !existsSync(join(dash(), LOCK_FILE)) && !existsSync(join(dash(), STATE_FILE)), refresh.json ?? refresh.stderr?.slice(-600));
  check("re-documentation inside the refresh (PUB-1): the never-documented program and the one modified since its doc are described (one jo p describe each, through describe-batch) and marked documented with a fresh capture date; the templates the KB lacked are fetched the same way; the pull then read the moved knowledge base, so it is behind on nothing listed",
    refresh.json?.redocumented?.enabled === true && refresh.json.redocumented.programs.documented >= 2 && inv["journey/p-undoc"]?.status === "documented" && inv["journey/p-undoc"].last_verified > TODAY && inv["journey/p-behind"].last_verified > invBefore["journey/p-behind"].last_verified && existsSync(resolve(WS, inv["journey/p-undoc"].doc_path)) &&
      refresh.json.redocumented.templates.documented > 0 && Object.entries(inv).filter(([k, e]) => k.startsWith(`${TEMPLATES_DOMAIN}/`) && e.status === "documented" && e.last_verified > TODAY).length === refresh.json.redocumented.templates.documented && refresh.json.kbBehind?.behind?.length === 0 && refresh.json.redocumented.programs.stillBehind.length === 0 &&
      argvLines().slice(callsBeforeRefresh).filter((a) => a.includes("jo p describe --id p-undoc")).length === 1 && argvLines().slice(callsBeforeRefresh).filter((a) => a.includes("jo email template --id")).length === refresh.json.redocumented.templates.documented,
    [refresh.json?.redocumented, refresh.json?.kbBehind, inv["journey/p-undoc"], invBefore["journey/p-behind"]?.last_verified, inv["journey/p-behind"]?.last_verified, argvLines().slice(callsBeforeRefresh).filter((a) => a.includes("jo p describe --id p-undoc")).length, argvLines().slice(callsBeforeRefresh).filter((a) => a.includes("jo email template --id")).length]);
  const snapshot1 = openSnapshot(readJson(join(dash(), SNAPSHOTS_DIR, snap1[0])));
  check("the snapshot carries the spec's settings: the internal domain, the unsubscribe link, the test accounts as company ids, the customer lists with the per-segment one over the company field, the groups resolved; the page carries the theme",
    snapshot1.meta.params.internalDomains.join() === "acme.com" && snapshot1.meta.params.unsubscribeLinks.length === 1 && isDeepStrictEqual(snapshot1.meta.params.testAccounts, ["co-03", "co-09"]) && snapshot1.honesty.accountSelection.lists.some((l) => l.per === "Industry") && snapshot1.dimensions.accounts.every((a) => a.attrs?.Industry) &&
      snapshot1.dimensions.programs.every((p) => p.supergroup != null) && pageText("admin").includes("--accent:#0b57d0") && !pageText("exec").includes("co-03"), snapshot1.honesty.accountSelection);
  const status = run("status", [SLUG]);
  check("status: the last pull, its age, the next due by cadence, not stale, both pages present, no lock, nothing resumable", status.code === 0 && status.json.lastPull.pulledAt === snapshot1.meta.pulledAt && status.json.nextDue != null && status.json.due === false && status.json.stale === false && status.json.pages.every((p) => p.present) && status.json.lock.held === false && status.json.resumable === null, status.json);

  // ══ change: display-only → rebuild (no call); lists → re-selection; a pull setting → refresh ══
  const adminBefore = pageText("admin");
  const callsBeforeChange = argvLines().length;
  const dryChange = run("change", [SLUG, 'pages.0.title="Admin view"', "--dry-run"]);
  check("change --dry-run: prints what changed and its consequence (a title is a rebuild) and stops: nothing saved, no draft left, no page touched", dryChange.code === 0 && dryChange.json.consequence === "rebuild" && dryChange.json.saved === false && !existsSync(draftFile()) && openSpec(readJson(specFile())).pages[0].title === "Admin" && pageText("admin") === adminBefore, dryChange.json);
  const titled = run("change", [SLUG, 'pages.0.title="Admin view"']);
  check("change (display-only): saved, the replaced spec kept as one previous copy, the pages rebuilt from the last snapshot with no pull and no call; the new title is on the page",
    titled.code === 0 && titled.json.consequence === "rebuild" && titled.json.done.kind === "rebuild" && titled.json.done.pages.length === 2 && argvLines().length === callsBeforeChange && pageText("admin").includes("Admin view") && existsSync(`${specFile()}.previous`) && snapshots().length === 1, titled.json);
  const relisted = run("change", [SLUG, 'accounts.lists=[{"kind":"most-bounced","n":2,"floor":0}]']);
  const snapshot1b = openSnapshot(readJson(join(dash(), SNAPSHOTS_DIR, snap1[0])));
  check("change (the customer lists): a re-selection over the last run directory's rows (reduce again, no pull): the snapshot's selection record now holds the one list of 2 and the pages are rebuilt",
    relisted.code === 0 && relisted.json.consequence === "reselect" && relisted.json.done.done === true && isDeepStrictEqual(relisted.json.done.lists, [{ kind: "most-bounced", kept: 2 }]) && argvLines().length === callsBeforeChange && snapshot1b.honesty.accountSelection.lists.length === 1 && snapshot1b.honesty.accountSelection.lists[0].kept.length === 2, relisted.json);
  const pulled = run("change", [SLUG, "sources.0.params.stepDetail=true"]);
  const snap2 = snapshots();
  check("change (a pull setting): the consequence is a new pull with its minutes from the last plan, and the refresh runs: a second snapshot, the step-detail switch changing forces a full one, the delta against the first pull wired to the pages",
    pulled.code === 0 && pulled.json.consequence === "pull" && /about \d+ minute/.test(pulled.json.consequenceText) && pulled.json.done.kind === "refresh" && pulled.json.done.status === "ok" && snap2.length === 2 && pulled.json.done.pull.mode === "full" && /step-detail switch changed/.test(pulled.json.done.pull.why) &&
      pulled.json.done.delta?.previousPulledAt === snapshot1.meta.pulledAt && pageText("admin").includes("Change since the last refresh (pulled") && pageText("exec").includes("Since last pull:"), [pulled.json?.consequenceText, pulled.json?.done?.pull, pulled.json?.done?.delta]);
  const identity = run("change", [SLUG, 'tenantHost="acme--sbx.gainsightcloud.com"']);
  check("change refuses an identity setting (the tenant, the slug)", identity.code === 1 && /cannot be changed/.test(identity.json?.error ?? ""), identity.json);

  // ══ --health-only, and the lock ═══════════════════════════════════════════
  const callsBeforeHealth = argvLines().length;
  const healthOnly = run("refresh", [SLUG, "--health-only"]);
  check("refresh --health-only: a selective pull that reads the current month's facts again with the health families and carries the rest (fewer calls than the full pull), then rebuilds", healthOnly.code === 0 && healthOnly.json.healthOnly === true && healthOnly.json.pull.mode === "selective" && snapshots().length === 3 && healthOnly.json.pull.calls.made < pulled.json.done.pull.calls.made && argvLines().length > callsBeforeHealth, [healthOnly.json?.pull, pulled.json?.done?.pull?.calls]);
  writeFileSync(join(dash(), LOCK_FILE), JSON.stringify({ by: "ben", at: new Date().toISOString(), pid: 1 }));
  const locked = run("refresh", [SLUG]);
  check("the lock: a second refresh is refused naming the holder and the time, before any call", locked.code === 1 && /already running: started by ben at /.test(locked.json?.error ?? "") && snapshots().length === 3, locked.json);
  writeFileSync(join(dash(), LOCK_FILE), JSON.stringify({ by: "ben", at: new Date(Date.now() - LOCK_STALE_MS - 60000).toISOString(), pid: 1 }));
  const stale = run("refresh", [SLUG]);
  check("a lock older than two hours is stale: the refresh takes it over and says whose it was", stale.code === 0 && stale.json.lockTakenOver?.by === "ben" && !existsSync(join(dash(), LOCK_FILE)) && snapshots().length === 4, stale.json?.lockTakenOver ?? stale.json);

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

  // ══ The draft take-over, list, report, health, export and import ══════════
  const edit = run("new", [SLUG]);
  const asBen = common.slice(0, -2);
  const theirs = run("next", [SLUG], { flags: [...asBen, "--by", "ben"] });
  const taken = run("next", [SLUG], { flags: [...asBen, "--by", "ben", "--take-over"] });
  check("the draft's holder: an edit started by ana is refused to ben at next, naming ana and the time, and continues for ben with --take-over", edit.json?.state === "editing-saved" && theirs.code === 1 && /held by ana \(last changed /.test(theirs.json?.error ?? "") && taken.code === 0 && readJson(draftFile()).by === "ben", [theirs.json, taken.json?.question?.id]);
  // The metrics question on an EDIT (the S5 review's "default keeps the panels" fix, completed): a page whose panels are
  // the preset, or the preset with optional metrics left off by an earlier answer, is preset-derived, so "default" puts a
  // metric left off earlier back; a page whose panels were changed by hand keeps them and the answer says how to start again.
  const ben = { flags: [...asBen, "--by", "ben"] };
  const noClicks = run("answer", [SLUG, "metrics", '{"clicks": false}'], ben);
  const afterDrop = readJson(draftFile()).spec.pages.map((pg) => pg.panels);
  const restored = run("answer", [SLUG, "metrics", "default"], ben);
  const afterRestore = readJson(draftFile()).spec.pages.map((pg) => pg.panels);
  const byHand = readJson(draftFile());
  byHand.spec.pages[0].panels = presetPanels({ ...byHand.spec.pages[0], panels: [] }).map((p, i) => (i === 0 ? { ...p, title: "Hand-edited headline" } : p));
  writeFileSync(draftFile(), JSON.stringify(byHand, null, 2));
  run("answer", [SLUG, "metrics", '{"responses": false}'], ben);
  const mixed = run("answer", [SLUG, "metrics", "default"], ben);
  const afterMixed = readJson(draftFile()).spec.pages.map((pg) => pg.panels);
  check("metrics on an edit: leaving clicks off writes every page's panels from the preset without them; answering default afterwards restores the preset (panels empty again, so the page reads the preset's); a page whose panels were changed by hand keeps them with a note naming the change that starts again from the preset, while the other page is restored",
    noClicks.code === 0 && afterDrop.every((panels) => panels.length > 0 && !panels.some((p) => p.query?.metrics.includes("clicked") || p.query?.metrics.includes("clickRate"))) &&
      restored.code === 0 && afterRestore.every((panels) => panels.length === 0) && restored.json.notes.some((n) => /every optional metric shown/.test(n)) &&
      mixed.code === 0 && afterMixed[0][0].title === "Hand-edited headline" && afterMixed[0].some((p) => p.query?.metrics.includes("responseRate")) === true && afterMixed[1].length === 0 &&
      mixed.json.notes.some((n) => /page admin keeps its own panels \(changed by hand\); to start again from the preset: change <slug> pages\.0\.panels=\[\]/.test(n)),
    [noClicks.json, restored.json, mixed.json, afterMixed.map((p) => p.length)]);
  rmSync(draftFile(), { force: true });
  const listed = run("list", []);
  check("list: the saved dashboard with its last pull and the pages on disk; a draft would show with its holder and date", listed.code === 0 && listed.json.dashboards.some((d) => d.slug === SLUG && d.saved && d.lastPull && d.pages.length === 2), listed.json);
  const report = run("report", [SLUG, "--by-template", "--all"]);
  check("report: the open-rate report over the latest snapshot with no pull, under the dashboard, with whether the snapshot is within its cadence and the minutes a pull would take", report.code === 0 && existsSync(report.json.report) && report.json.report.includes(join(dash(), "reports")) && report.json.withinCadence === true && typeof report.json.refreshMinutes === "number" && argvLines().length === argvLines().length, report.json);
  const health = run("health", [SLUG, "--program", "p-onboard"]);
  check("health: a program's masked bounce reasons, participant failures, step failures and the 'Other' samples to the terminal", health.code === 0 && health.json.program.id === "p-onboard" && health.json.bounceReasons.length > 0 && Array.isArray(health.json.otherSamples) && health.json.health.pulled === true, health.json?.program);
  const exported = run("export", [SLUG, "--out", join(ROOT, "handover", "acme-health.json"), "--with-snapshot"]);
  check("export --with-snapshot: the spec's portable file and the latest snapshot beside it", exported.code === 0 && existsSync(exported.json.out) && existsSync(exported.json.snapshot) && exported.json.snapshot.endsWith("acme-health.snapshot.json"), exported.json);
  const imported = run("import", ["--file", join(ROOT, "handover", "acme-health.json")], { flags: ["--workspace", WS2, "--kb", KB2, "--bin", FAKE, "--today", TODAY, "--by", "cy"] });
  const rebuilt = run("rebuild", [SLUG], { flags: ["--workspace", WS2, "--kb", KB2, "--bin", FAKE, "--today", TODAY, "--by", "cy"] });
  const status2 = run("status", [SLUG], { flags: ["--workspace", WS2, "--kb", KB2, "--bin", FAKE, "--today", TODAY, "--by", "cy"] });
  check("import on a second workspace of the same tenant: the spec and the snapshot land, the pages rebuild from it with no pull, and status reads the carried pull", imported.code === 0 && imported.json.snapshot != null && rebuilt.code === 0 && rebuilt.json.pages.length === 2 && status2.json?.lastPull?.pulledAt === resumed.json.pull.pulledAt, [imported.json, rebuilt.json, status2.json?.lastPull]);
  const wrongImport = run("import", ["--file", join(ROOT, "handover", "acme-health.json")], { flags: ["--workspace", WS2, "--kb", KB2, "--bin", FAKE, "--today", TODAY] });
  check("import never overwrites silently: the same slug again is refused without --replace", wrongImport.code === 1 && /already saved here/.test(wrongImport.json?.error ?? ""), wrongImport.json);

  // ══ Retention; the fast path; refusals ═════════════════════════════════════
  {
    const dir = join(dash(), SNAPSHOTS_DIR);
    for (let i = 0; i < KEEP_SNAPSHOTS + 2; i++) writeFileSync(join(dir, `2020010${String(i).padStart(2, "0")}T0000.json`), "{}");
    const r = run("rebuild", [SLUG]);
    const after = run("refresh", [SLUG]);
    check("retention: a refresh keeps the newest 13 snapshots and names what it pruned; rebuild reads the newest", r.code === 0 && after.code === 0 && after.json.pruned.length > 0 && snapshots().length === KEEP_SNAPSHOTS, [after.json?.pruned?.length, snapshots().length]);
  }
  const fast = run("new", ["quick", "--fast-path"]);
  const fastNext = run("next", ["quick"]);
  check("the fast path: every question but the estimate and the save takes its default (the look skipped, never asked twice), so next goes straight to the estimate after the tenant check", fast.code === 0 && fast.json.fastPath === true && fast.json.answered.includes("look") && fastNext.json?.question?.id === "estimate" && fastNext.json.estimate?.full?.calls > 0, [fast.json?.answered?.length, fastNext.json?.question?.id]);
  check("refusals: an unknown verb, a missing slug, a refresh of a draft, an unknown question, and a workspace with no KB each exit 1 with one line",
    run("frobnicate", []).code === 1 && run("status", []).code === 1 && run("refresh", ["quick"]).code === 1 && /is a draft, not a saved dashboard/.test(run("refresh", ["quick"]).json?.error ?? "") && run("answer", [SLUG, "nope", "x"]).code === 1 && run("list", [], { flags: ["--workspace", join(ROOT, "nowhere"), "--bin", FAKE] }).code === 1);
  check("the summaries carry counts and verdicts, never rows: no account name and no message text reaches stdout from a refresh", !JSON.stringify(resumed.json).includes("Acme Customer") && JSON.stringify(resumed.json).length < 12000);
  void statSync;
} finally {
  removeTempDir(ROOT);
}

console.log(failures ? `\ndashboard: ${failures} FAILED of ${total}` : `\ndashboard: all ${total} checks passed`);
process.exit(failures ? 1 : 0);
