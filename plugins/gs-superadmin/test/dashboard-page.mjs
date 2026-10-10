#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// dashboard-page.mjs (test) — fixtures for the dashboard page (DSH-2, DSH-4):
// scripts/dashboard-page.mjs (the builder) and scripts/dashboard-runtime.mjs
// (what every page inlines), over the fictional tenant.
//
// Snapshots come from the real producer: the committed fixture snapshot
// (accounts, step detail and health on), three pulls made here through the
// stand-in CLI (the adapter's defaults, so accounts off and no health; one with
// no internal domain; the signals tenant with health on, one program per
// health list) and edits of the committed one for the states a pull cannot
// give on demand (a snapshot that predates a figure, a part that failed, a
// trend with carried months). Larger ones are generated: several hundred
// programs for the program list, and one big enough to pass both size limits.
//
// A PAGE IS READ THE WAY A BROWSER READS IT: its two inlined scripts and its
// embedded data are taken out of the built HTML and run in a context with no
// Node globals. Expectations are derived independently (R-10): the engine is
// run here on the ORIGINAL snapshot with filters written by hand, and the
// page's answer for the same filter state, given as a URL hash, must equal it.
//
// Golden pages (`--write-golden` regenerates): the pre-rendered default view
// of each preset over the fixture snapshot, byte for byte.
//
// Run:  node plugins/gs-superadmin/test/dashboard-page.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import vm from "node:vm";
import { makeTempDir, removeTempDir, writeFiles, runNode } from "../../../test/rig.mjs";
import { buildPage, pageModel, pageSnapshot, packTable, inlinedSources, pageFileName, aboutSettings, PAGE_BUDGET, TOKENS } from "../scripts/dashboard-page.mjs";
import { createDashboard, mount, unpackSnapshot, unpackTable, csvCell, csvText, esc, LACKS, NOT_LACKS, NEEDS, COPY_LINES, ENTRY_COMMAND, HEALTH_DAY_OPTIONS, PAGE_MODEL_VERSION } from "../scripts/dashboard-runtime.mjs";
import * as engine from "../scripts/engagement-query.mjs";
import { openSpec, SPEC_DESCRIPTIONS, PRESETS, presetPanels, describeSpec } from "../scripts/dashboard-spec.mjs";
import { applyGroups } from "../scripts/dashboard-groups.mjs";
import { kbFiles, FIXTURE_BOUNCE_CATEGORIES } from "./fixtures/engagement/acme-tenant.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN = join(HERE, "..");
const BUILDER = join(PLUGIN, "scripts", "dashboard-page.mjs");
const ADAPTER = join(PLUGIN, "scripts", "engagement.mjs");
const FAKE = join(HERE, "fixtures", "engagement", "fake-gs-admin.mjs");
const SNAPSHOT_FILE = join(HERE, "fixtures", "engagement", "snapshot-acme.json");
const SPEC_FILE = join(HERE, "fixtures", "engagement", "spec-acme.json");
const GOLDEN_PAGE = (id) => join(HERE, "fixtures", "engagement", `page-golden-${id}.html`);
const WRITE_GOLDEN = process.argv.includes("--write-golden");
const { runQuery, reasonText, formatCell, REASONS, NO_VALUE } = engine;
const SOURCES = inlinedSources();
const MB = 1024 * 1024;

let failures = 0;
let ran = 0;
function check(label, cond, detail) {
  ran++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log(`      ${JSON.stringify(detail)?.slice(0, 1500)}`);
  }
}
const plain = (v) => JSON.parse(JSON.stringify(v));
const throwsWith = (fn, re) => {
  try {
    fn();
    return false;
  } catch (e) {
    return re.test(String(e?.message ?? e));
  }
};

// ── Reading a built page as a browser would ──────────────────────────────────
function loadPage(html) {
  const scripts = [...html.matchAll(/<script type="module">\n([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const data = html.match(/<script type="application\/json" id="gs-data">([\s\S]*?)<\/script>/)?.[1] ?? "";
  // No Node globals: only what a page's own document gives the script.
  const context = vm.createContext({ document: { getElementById: (id) => (id === "gs-data" ? { textContent: data } : null) } });
  for (const s of scripts) vm.runInContext(`(function () { "use strict";\n${s.replace(/^export /gm, "")}\n})();`, context);
  const call = (expr) => JSON.parse(vm.runInContext(`JSON.stringify((function (app) { return ${expr}; })(globalThis.__gsDashboard))`, context) ?? "null");
  return { scripts, data, call, prerender: html.match(/<fieldset id="gs-root" class="gs-root" disabled>([\s\S]*?)<\/fieldset>\n<script type="application\/json"/)?.[1] ?? null };
}
const panelRun = (page, panelId, hash) => page.call(`app.run(app.panels.find((p) => p.id === ${JSON.stringify(panelId)}), app.stateFromHash(${JSON.stringify(hash)}))`);
const unescape = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&dagger;/g, "+").replace(/&amp;/g, "&");
const textOf = (h) => unescape(h.replace(/<sup[^>]*>[\s\S]*?<\/sup>/g, "").replace(/<[^>]+>/g, "")).trim();
const panelHtml = (html, id) => html.match(new RegExp(`<section class="gs-panel" data-panel="${id}"[^>]*>([\\s\\S]*?)</section>`))?.[1] ?? null;
const paneHtml = (html, id) => {
  const after = html.split(`<section class="gs-pane" data-pane="${id}"`)[1];
  return after ? after.split(/<section class="gs-pane"|<footer class="gs-foot">/)[0] : null;
};
const filterHtml = (html, title) => (html.split(`<div class="gs-f"><span class="gs-f-title">${title}</span>`)[1] ?? "").split(`<div class="gs-f">`)[0] || null;
const rowsOf = (section, part = "tbody") => [...(section.match(new RegExp(`<${part}>([\\s\\S]*?)</${part}>`))?.[1] ?? "").matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => textOf(c[1])));
/** Every row of a section's tables, attributes allowed on the row. */
const anyRows = (section) => [...section.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => textOf(c[1])));
const lacksIn = (html) => [...html.matchAll(/data-lack="([^"]+)"/g)].map((m) => m[1]);
/** A page's markup without its inlined scripts, and the notices drawn in it. */
const markupOf = (html) => html.replace(/<script type="module">\n[\s\S]*?<\/script>/g, "");
const drawn = (html) => lacksIn(markupOf(html));
// Tags as a page writes them (lower case): a JSDoc type such as Object<string, …> in an inlined comment is not one. The
// search form (TPL-2) is the one form a page holds, and it posts nowhere: its submit is read in the page.
const NO_NETWORK = /\b(href|src|action|data|poster|formaction)\s*=\s*["']?\s*[hH][tT][tT][pP][sS]?:\/\/|url\(\s*["']?[hH][tT][tT][pP]|\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|(?<!\{)\bimport\s*\(|^\s*import\s|<link\b|<img\b|<iframe\b|<object\b|<embed\b|<form\b(?![^>]*data-search)|\ssrc=|url\(|@import|<base\b|http-equiv/m;
/** A string as it sits in a page's embedded data. */
const inData = (text) => JSON.stringify(text).slice(1, -1).replace(/[<>&]/g, (c) => "\\u00" + c.charCodeAt(0).toString(16));
/** RFC 4180, written here on its own: the page's CSV builder is the thing under test. */
/** The lines a templates-view export holds: one per template, then one per program under it, then one per step and variant. */
const countLines = (rows) => { let n = 0; for (const r of rows) { n += 1; for (const p of r.programs) n += 1 + (p.steps?.length ?? 0); } return n; };
function parseCsv(text) {
  const rows = [[""]];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const row = rows[rows.length - 1];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (row[row.length - 1] += '"'), i++;
      else if (c === '"') quoted = false;
      else row[row.length - 1] += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") row.push("");
    else if (c === "\r" && text[i + 1] === "\n") rows.push([""]), i++;
    else row[row.length - 1] += c;
  }
  return rows.slice(0, -1);
}

// ── Fixtures ─────────────────────────────────────────────────────────────────
const SPEC = openSpec(JSON.parse(readFileSync(SPEC_FILE, "utf8")));
const PULLED = engine.openSnapshot(JSON.parse(readFileSync(SNAPSHOT_FILE, "utf8")));
const GOLD = applyGroups(PULLED, SPEC.groups).snapshot;
const specWith = (edit) => {
  const s = structuredClone(SPEC);
  edit(s);
  return openSpec(s);
};
// The ruled defaults: every status on the admin page, no panel of their own (the presets' draw), the exec page on closed months.
const SPEC_DEFAULTS = specWith((s) => { s.pages[0].panels = []; s.pages[0].statusDefault = null; });
const build = (spec, snapshot, pageId = "admin", budget) => buildPage({ spec, snapshot: applyGroups(snapshot, spec.groups).snapshot, pageId, ...SOURCES, ...(budget ? { budget } : {}) });
/** @type {any[]} */
const accountPanels = [
  { id: "watch", tab: "engagement", type: "watchlist", title: "Low engagement", query: { groupBy: ["program", "account"], metrics: ["delivered", "opened", "openRate"], sort: [{ metric: "openRate", dir: "asc" }], having: [{ metric: "delivered", gte: 1 }], limit: 15 } },
  { id: "accounts", tab: "engagement", type: "table", title: "Accounts", query: { groupBy: ["account"], metrics: ["sent", "delivered", "bounced"], sort: [{ metric: "sent", dir: "desc" }] } },
];
const SPEC_ACCOUNTS = specWith((s) => {
  s.pages[0].panels.push(...accountPanels);
  s.sources[0].params.testAccounts = ["co-09"];
});
/** A snapshot of the fixture's shape with `programs` programs: generated, for size and for the program list. */
function generated({ programs: count, templates = 1, months = 4, measure = 7 }) {
  const monthList = Array.from({ length: months }, (_, i) => `${2025 + Math.floor((8 + i) / 12)}-${String(((8 + i) % 12) + 1).padStart(2, "0")}`);
  const statuses = [["PROCESSING"], ["PAUSE"], ["STOP"], ["PROCESSING", "NEW"]];
  const words = ["Onboarding", "Renewal", "Adoption", "Survey", "Webinar", "Churn risk", "Expansion"];
  const programs = Array.from({ length: count }, (_, i) => ({ id: `p-${String(i).padStart(4, "0")}`, name: `Acme ${words[i % words.length]} ${String(i).padStart(4, "0")}`, statuses: statuses[i % statuses.length], model: "DRIPV2", modelName: "Email Chain", audienceType: "CUSTOMER", supergroup: null, group: null, folderId: String(200 + (i % 9)) }));
  const tpls = Array.from({ length: templates }, (_, t) => ({ id: `tpl-${t}`, name: `Acme Email ${t}`, uses: [] }));
  const byTemplate = [];
  for (const p of programs) for (const t of tpls) for (const month of monthList) for (const recipientClass of ["external", "internal"]) {
    const sent = measure * 100000 + byTemplate.length % 89999;
    byTemplate.push({ programId: p.id, templateId: t.id, month, recipientClass, sent, delivered: sent - 1000, bounced: 600, rejected: 400, unsubscribed: 120, spamComplaints: 11, failed: 1000, opened: sent - 200000, clicked: 123456, provenance: "pulled", pulledAt: PULLED.meta.pulledAt });
  }
  const meta = { ...PULLED.meta, window: { ...PULLED.meta.window, from: monthList[0], to: monthList[months - 1] }, incompleteFrom: `${monthList[months - 1]}-01`, stepDetail: false, accounts: { pulled: false, reason: "accounts-off" }, health: { pulled: false, reason: "health-off", asOf: null, dayWindow: null, parts: {} }, metricAvailability: { clicks: { templates: {}, programs: {} }, responses: { programs: {} } } };
  const health = Object.fromEntries(Object.keys(PULLED.facts.health).map((k) => [k, []]));
  return engine.openSnapshot({ ...PULLED, meta, dimensions: { programs, templates: tpls, accounts: [], months: monthList }, facts: { byTemplate, byAccount: [], responses: [], responseParticipants: [], uniques: [], health }, caveats: [] });
}

const ROOT = makeTempDir("gs-superadmin-dashboard-page");
try {
  // Three pulls through the stand-in CLI: the adapter's defaults (accounts off, no health); one with no internal
  // domain; the signals tenant with health on (one program per health list) and the fixture's bounce categories.
  const WS = join(ROOT, "ws");
  writeFiles(WS, { ".gs-superadmin/.keep": "" });
  writeFiles(join(ROOT, "kb"), kbFiles("acme-prod"));
  writeFiles(join(ROOT, "kb-signals"), kbFiles("acme-prod", { cadence: true, signals: true }));
  writeFiles(join(ROOT, "fake-state"), { ".keep": "" });
  const CATS = join(ROOT, "categories.json");
  writeFileSync(CATS, JSON.stringify({ bounceReasons: FIXTURE_BOUNCE_CATEGORIES }));
  const pull = (name, flags, { kb = join(ROOT, "kb", "acme-prod"), variant = {} } = {}) => {
    const out = join(ROOT, `${name}.json`);
    const r = runNode(ADAPTER, ["run", "--workspace", WS, "--bin", FAKE, "--kb", kb, "--page-size", "400", "--today", "2026-09-15", "--pulled-at", "2026-09-15T09:00:00-07:00", "--from", "2026-06", "--run", name, "--out", out, ...flags], { env: { ...process.env, FAKE_STATE: join(ROOT, "fake-state"), FAKE_TENANT: JSON.stringify(variant) } });
    if (r.status !== 0 || !existsSync(out)) throw new Error(`the fixture pull "${name}" failed: ${r.stderr}`);
    return engine.openSnapshot(JSON.parse(readFileSync(out, "utf8")));
  };
  const OFF = pull("page-off", ["--internal-domain", "acme.com"]);
  const NO_DOMAIN = pull("page-nodomain", []);
  const SIGNALS = pull("page-signals", ["--internal-domain", "acme.com", "--health", "--failure-categories", CATS], { kb: join(ROOT, "kb-signals", "acme-prod"), variant: { silent: true, cadence: true, signals: true } });
  check("the fixtures are what they are named for: the default pull holds no account data, no step detail and no health data and says so itself; the other pull was given no internal domain and carries the marker for it; the signals pull holds health with every part read and one program on each alarm list",
    engine.accountAvailability(OFF).reason === "accounts-off" && OFF.meta.stepDetail === false && engine.healthAvailability(OFF).pulled === false && engine.healthAvailability(OFF).reason === "health-off" && !OFF.caveats.some((c) => c.id === "recipient-class-not-configured") && NO_DOMAIN.caveats.some((c) => c.id === "recipient-class-not-configured") &&
      engine.healthAvailability(SIGNALS).pulled === true && Object.values(engine.healthAvailability(SIGNALS).parts).every((p) => p.pulled) && engine.healthSilentView(SIGNALS, {}, { days: 30 }).rows.length === 6,
    [OFF.meta.accounts, NO_DOMAIN.caveats, engine.healthSilentView(SIGNALS, {}, { days: 30 }).counts]);

  const ADMIN = build(SPEC_ACCOUNTS, PULLED);
  const EXEC = build(SPEC_ACCOUNTS, PULLED, "exec");
  const admin = loadPage(ADMIN.html);
  const exec = loadPage(EXEC.html);
  // Both presets, every default panel, over the signals pull (health on) and over the fixture.
  const ADMIN_P = build(SPEC_DEFAULTS, SIGNALS);
  const EXEC_P = build(SPEC_DEFAULTS, SIGNALS, "exec");
  const adminP = loadPage(ADMIN_P.html);
  const execP = loadPage(EXEC_P.html);
  const reached = new Set([...drawn(ADMIN.html), ...drawn(EXEC.html), ...drawn(ADMIN_P.html), ...drawn(EXEC_P.html)]);

  // ══ One aggregation path (house rule 11) ══════════════════════════════════
  {
    check("the page inlines the query engine byte for byte: its first script is engagement-query.mjs exactly as the file is on disk, followed only by the line that hands it to the page",
      admin.scripts.length === 2 && admin.scripts[0].startsWith(`${SOURCES.engineSource}\n;globalThis.__gsEngine = {`) && ADMIN.html.split(SOURCES.engineSource).length === 2 && SOURCES.engineSource === readFileSync(join(PLUGIN, "scripts", "engagement-query.mjs"), "utf8"),
      [admin.scripts.length, admin.scripts[0]?.slice(0, 80)]);
    check("the page inlines the runtime byte for byte too, followed only by its start line; the code that drew the pre-render in Node is the code the browser runs",
      admin.scripts[1] === `${SOURCES.runtimeSource}\n;boot(globalThis);\n` && SOURCES.runtimeSource === readFileSync(join(PLUGIN, "scripts", "dashboard-runtime.mjs"), "utf8"), admin.scripts[1]?.slice(-60));
    const handed = admin.scripts[0].slice(SOURCES.engineSource.length).match(/\{ ([^}]*) \}/)?.[1].split(", ") ?? [];
    check("every export of the engine is handed to the page, by name: the list is read from the module, never written by hand", isDeepStrictEqual(handed, Object.keys(engine).sort()) && handed.includes("runQuery") && handed.includes("healthReasonsView"), handed);
    for (const [name, file] of [["runtime", "dashboard-runtime.mjs"], ["builder", "dashboard-page.mjs"]]) {
      const src = readFileSync(join(PLUGIN, "scripts", file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
      const calls = [...src.matchAll(/(\w+)\.(runQuery|kpiView|health\w+View|templatesView|searchTemplateContent|templateContent)\(/g)].map((m) => m[1]);
      check(`the ${name} never aggregates on its own: its source sums nothing, reads no measure list and never walks a fact table's rows; every figure is a cell the engine computed (runQuery, the kpi view, the four health views, the templates view and its search)`,
        !/\.reduce\((?!\(n, s\) => n \+ s\.params\.)/.test(src) && !/SEND_MEASURES/.test(src) && !/facts\.by\w+\.(map|filter|forEach|find|some)/.test(src) && !/\.(sent|delivered|opened|bounced|count|participants)\s*[+\-/*]/.test(src) && calls.every((c) => c === "engine") && (name !== "runtime" || calls.length >= 8),
        [calls, src.match(/\.reduce\(.{0,60}/)?.[0]]);
    }
    check("the runtime imports nothing, so a browser can run its bytes as they are; neither inlined file holds text that would end a script element early",
      !/^\s*import\s/m.test(SOURCES.runtimeSource) && !/\brequire\(/.test(SOURCES.runtimeSource) && !/<\/script|<!--/i.test(SOURCES.runtimeSource + SOURCES.engineSource));
    check("a source that would end the page's script element is refused, naming the file, and no page is built",
      throwsWith(() => buildPage({ spec: SPEC, snapshot: GOLD, pageId: "admin", engineSource: SOURCES.engineSource, runtimeSource: `${SOURCES.runtimeSource}\n// </script>` }), /dashboard-runtime\.mjs holds text that would end/));
  }

  // ══ The headless check: the page's inlined engine against the engine in Node ══
  {
    const groupOf = (level) => [...new Set(GOLD.dimensions.programs.map((p) => p[level]))].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
    const [supergroups, groups] = [groupOf("supergroup"), groupOf("group")];
    const active = ["PROCESSING"];
    // [the state as a URL hash, the same state as filters written by hand]
    /** @type {Array<[string, any]>} */
    const states = [
      ["", { recipientClass: "all", statuses: active }],
      ["s=all", { recipientClass: "all" }],
      ["s=PAUSE,NEW", { recipientClass: "all", statuses: ["PAUSE", "NEW"] }],
      ["m=2026-07..2026-08", { recipientClass: "all", statuses: active, months: ["2026-07", "2026-08"] }],
      ["m=2026-09..2026-09&s=all", { recipientClass: "all", months: ["2026-09"] }],
      ["m=2026-08..2026-06&s=all", { recipientClass: "all", months: ["2026-06", "2026-07", "2026-08"] }],
      ["p=p-nps,p-onboard&s=all", { recipientClass: "all", programs: ["p-nps", "p-onboard"] }],
      ["px=p-nps&s=all", { recipientClass: "all", programs: GOLD.dimensions.programs.map((p) => p.id).filter((id) => id !== "p-nps") }],
      ["p=&s=all", { recipientClass: "all", programs: [] }],
      ["rc=external", { recipientClass: "external", statuses: active }],
      [`sg=${supergroups.indexOf("Surveys")}&s=all`, { recipientClass: "all", supergroups: ["Surveys"] }],
      [`sg=${supergroups.indexOf("Internal")}&g=${groups.indexOf("Pilots")}&s=all`, { recipientClass: "all", supergroups: ["Internal"], groups: ["Pilots"] }],
      [`m=2026-07..2026-09&px=p-pilot&rc=external&s=PROCESSING,PAUSE`, { recipientClass: "external", statuses: ["PROCESSING", "PAUSE"], months: ["2026-07", "2026-08", "2026-09"], programs: GOLD.dimensions.programs.map((p) => p.id).filter((id) => id !== "p-pilot") }],
    ];
    // The query panels: the templates view (no query) is held to the engine's templatesView in its own section.
    const panels = SPEC_ACCOUNTS.pages[0].panels.filter((p) => p.query);
    const differs = [];
    for (const [hash, filters] of states) for (const panel of panels) {
      const inPage = panelRun(admin, panel.id, hash);
      const extra = panel.type === "watchlist" ? { accountBuckets: ["account"] } : {};
      const inNode = plain(runQuery(GOLD, { ...filters, ...extra }, panel.query));
      if (!isDeepStrictEqual(inPage, inNode)) differs.push([hash, panel.id]);
    }
    check(`the page filters correctly: for ${states.length} filter states, each given to the page as a URL hash and to Node as filters written by hand, every one of the page's ${panels.length} panels returns from its inlined engine and its embedded data exactly the rows the engine returns in Node over the original snapshot`,
      differs.length === 0 && supergroups.includes("Surveys") && groups.includes("Pilots"), differs);
    const narrowed = panelRun(admin, "programs", "p=p-nps,p-onboard&s=all");
    check("the comparison can fail: the states are not all one view. A program filter leaves two rows where the default leaves four, and an empty program list leaves none",
      narrowed.rows.length === 2 && panelRun(admin, "programs", "").rows.length === 4 && panelRun(admin, "programs", "p=&s=all").rows.length === 0 && panelRun(admin, "programs", "s=all").rows.length === 5);
    const oneAccount = panelRun(admin, "accounts", "a=co-02&s=all");
    check("the account choice narrows the panels that list accounts, and no other: with one account picked the account table holds that account alone, equal to the engine's own answer, and the program table is untouched",
      isDeepStrictEqual(oneAccount, plain(runQuery(GOLD, { recipientClass: "all", accounts: ["co-02"] }, accountPanels[1].query))) && oneAccount.rows.length === 1 && oneAccount.rows[0].label.account === "Acme Customer 02" &&
        isDeepStrictEqual(panelRun(admin, "programs", "a=co-02&s=all"), panelRun(admin, "programs", "s=all")), oneAccount.rows);
    check("a hash someone mangled or wrote for another dashboard never breaks the page: unknown programs, months, statuses, tabs, positions and thresholds are dropped and the rest is kept",
      isDeepStrictEqual(admin.call(`app.stateFromHash("t=nope&m=1999-01..2026-08&p=ghost,p-nps&sg=99&g=-1&s=PAUSE,BOGUS&rc=maybe&a=nobody&hd=7&he=2&ts=bogus&td=up&tpl=ghost&%E0%A4%A=1&junk")`), { tab: "engagement", from: "2026-06", to: "2026-08", programs: ["p-nps"], sg: null, g: null, statuses: ["PAUSE"], external: false, account: null, hd: null, he: false, q: "", qa: false, qw: false, ts: null, td: null, tpl: null }) &&
        // An empty or non-numeric position is no position: never the first group by accident.
        isDeepStrictEqual(admin.call(`[app.stateFromHash("sg=&g=").sg, app.stateFromHash("sg=&g=").g, app.stateFromHash("sg=x&g=1.5").sg, app.stateFromHash("sg=x&g=1.5").g, app.stateFromHash("sg=0").sg]`), [null, null, null, null, 0]),
      admin.call(`app.stateFromHash("t=nope&m=1999-01..2026-08&p=ghost,p-nps&sg=99&g=-1&s=PAUSE,BOGUS&rc=maybe&a=nobody&junk")`));
    const trips = states.map(([hash]) => [hash, admin.call(`app.hashOf(app.stateFromHash(${JSON.stringify(hash)}))`)]);
    check("the filter state lives in the URL hash and comes back from it: every state written as a hash reads back as the same state, and the default state is an empty hash",
      trips.every(([hash, back]) => isDeepStrictEqual(admin.call(`app.stateFromHash(${JSON.stringify(back)})`), admin.call(`app.stateFromHash(${JSON.stringify(hash)})`))) && admin.call(`app.hashOf(app.defaultState())`) === "", trips);
    const full = admin.call(`app.hashOf(app.clean({ ...app.defaultState(), tab: "about", programs: ["p-nps"], sg: app.supergroups.indexOf("Internal"), g: app.groups.indexOf("Pilots"), statuses: null, external: true, account: "co-02", from: "2026-07" }))`);
    const names = [...GOLD.dimensions.programs.map((p) => p.name), ...supergroups, ...groups, ...GOLD.dimensions.accounts.map((a) => a.name)];
    check("the hash holds ids only: program ids, an account key, status codes, months and positions in the group lists; no program name, account name or group label is in it",
      /^[A-Za-z0-9=&.,%_-]+$/.test(full) && full.includes("p=p-nps") && full.includes("a=co-02") && /sg=\d&g=\d/.test(full) && names.every((n) => !full.includes(n) && !full.includes(encodeURIComponent(n))), full);
  }

  // ══ The pre-rendered default view, and the golden pages ═══════════════════
  {
    check("the pre-render is the page's own default view: what Node wrote into the file is byte for byte what the page's inlined code renders for the default state, on every page built above",
      [admin, exec, adminP, execP].every((p) => !!p.prerender && p.prerender === p.call(`app.renderApp(app.defaultState(), null)`)));
    const expected = runQuery(GOLD, { recipientClass: "all", statuses: ["PROCESSING"] }, SPEC.pages[0].panels[0].query);
    const shownCols = SPEC.pages[0].panels[0].columns;
    const table = rowsOf(panelHtml(ADMIN.html, "programs"));
    check("the pre-render matches the engine's default output: the program table's rows are the engine's rows for the page's starting filters, in its order, each cell as the engine formats it, under the columns the panel starts with",
      table.length === expected.rows.length && expected.rows.length === 4 &&
        expected.rows.every((r, i) => table[i][0].startsWith(r.label.program) && isDeepStrictEqual(table[i].slice(1), shownCols.map((id) => formatCell(id, r.cells[id])))) &&
        isDeepStrictEqual(rowsOf(panelHtml(ADMIN.html, "programs"), "thead")[0], ["Program", ...shownCols.map((id) => engine.metric(id).label)]) &&
        isDeepStrictEqual(rowsOf(panelHtml(ADMIN.html, "programs"), "tfoot")[0].slice(1), shownCols.map((id) => formatCell(id, expected.total.cells[id]))),
      [table, expected.rows.map((r) => r.label.program)]);
    check("the page reads without JavaScript: the default view is in the markup, its controls are switched off until the script runs (a control never does nothing), and a line says what needs JavaScript",
      /<fieldset id="gs-root" class="gs-root" disabled>/.test(ADMIN.html) && /<noscript><p>[^<]*JavaScript[^<]*<\/p><\/noscript>/.test(ADMIN.html) && ADMIN.html.indexOf("<table>") > 0 && ADMIN.html.indexOf("<table>") < ADMIN.html.indexOf("<script"));
    check("every view shows when the data was pulled (R4): the line is the engine's own, at the top of the page, before anything else",
      [ADMIN, EXEC, ADMIN_P, EXEC_P].every((b) => { const pre = loadPage(b.html).prerender; const line = esc(engine.dataPulledLine(applyGroups(b === ADMIN_P || b === EXEC_P ? SIGNALS : PULLED, SPEC.groups).snapshot)); return pre.includes(line) && pre.indexOf(line) < pre.indexOf("gs-filters") && /<p class="gs-pulled">Data pulled /.test(pre); }));
    const closed = admin.call(`app.renderPanel(app.panels.find((p) => p.id === "programs"), app.stateFromHash("m=2026-06..2026-08"), null)`);
    check("the incomplete period is marked (R4): a row that includes the provisional month carries a mark and the table says from when; a view of closed months alone carries neither",
      (panelHtml(ADMIN.html, "programs").match(/<sup title="Includes the provisional period">\*<\/sup>/g) ?? []).length === [...expected.rows, expected.total].filter((r) => r.incomplete).length && expected.rows.some((r) => r.incomplete) && expected.rows.some((r) => !r.incomplete) && panelHtml(ADMIN.html, "programs").includes(`* Includes the provisional period: sends on or after ${GOLD.meta.incompleteFrom} are provisional (opens keep arriving), and bounces and unsubscribes on sends since 2026-08-01 can still change`) &&
        rowsOf(closed).length > 0 && !closed.includes("<sup") && !closed.includes("provisional"), closed.slice(-300));
    check("a page is byte-stable: the same spec and snapshot build the same bytes, with no clock in them, both presets", build(SPEC_ACCOUNTS, PULLED).html === ADMIN.html && build(SPEC_DEFAULTS, SIGNALS, "exec").html === EXEC_P.html);
    // The golden pages: the pre-rendered default view of each preset over the FIXTURE snapshot (the presets' own panels).
    for (const id of ["admin", "exec"]) {
      const pre = loadPage(build(SPEC_DEFAULTS, PULLED, id).html).prerender;
      if (WRITE_GOLDEN) writeFileSync(GOLDEN_PAGE(id), pre);
      const golden = existsSync(GOLDEN_PAGE(id)) ? readFileSync(GOLDEN_PAGE(id), "utf8") : null;
      check(`golden page (${id}): the ${id} preset's pre-rendered default view over the fixture snapshot is byte for byte the committed golden (a fixed pulledAt; regenerate with --write-golden)`, golden !== null && pre === golden, golden === null ? "no golden file" : [pre.length, golden.length, [...pre].findIndex((c, i) => c !== golden[i])]);
    }
  }

  // ══ Tokens only (R28): every colour and font from the token block ══════════
  {
    const style = ADMIN.html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
    const tokenBlocks = [...TOKENS.matchAll(/:root\{([^}]*)\}/g)].map((m) => m[1]);
    const rest = style.replace(TOKENS, "");
    const noVars = (s) => s.replace(/var\(--[\w-]+\)/g, "");
    const literalColour = /#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?)\(|:\s*(red|blue|green|black|white|gray|grey|orange|yellow|purple|silver|navy|teal|aqua|maroon|olive|lime|fuchsia|crimson|gold)\b/;
    check("the page's style sheet declares every colour, font and radius once in the token block, with a dark set beside it, and no rule outside it holds a literal colour or font: the whole sheet after the token block references tokens only",
      style.startsWith(TOKENS) && tokenBlocks.length === 4 && !literalColour.test(noVars(rest)) && !/font(-family)?\s*:(?![^;]*(var\(--font\)|var\(--mono\)|inherit))/.test(rest.replace(/font-size/g, "").replace(/font-weight/g, "").replace(/font-style/g, "").replace(/font-variant[^;]*/g, "")) && /--series-1:#/.test(TOKENS) && /--font:/.test(TOKENS) && /@media \(prefers-color-scheme:dark\)\{:root\{--fg:/.test(TOKENS),
      noVars(rest).match(literalColour)?.[0]);
    check("the status tokens (stale, error, warning, ok, the two tracking states) sit in their own block apart from the brand-facing ones, light and dark, so a brand theme never touches them",
      tokenBlocks.filter((b) => /--status-/.test(b)).length === 2 && tokenBlocks.filter((b) => /--status-/.test(b)).every((b) => b.split(";").filter(Boolean).every((d) => d.trim().startsWith("--status-"))) && tokenBlocks.filter((b) => !/--status-/.test(b)).length === 2 &&
        ["stale", "error", "warn", "ok", "not-tracked", "unknown"].every((k) => tokenBlocks.filter((b) => /--status-/.test(b)).every((b) => b.includes(`--status-${k}:`))));
    // The runtime's SVG and inline-style emitters: every fill, stroke and style value is a token or a keyword.
    const src = SOURCES.runtimeSource;
    const values = [...src.matchAll(/\b(fill|stroke|style)="([^"]*)"/g)].map((m) => m[2]).map((v) => v.replace(/\$\{[^}]*\}/g, "").replace(/var\(--[\w-]+\)/g, ""));
    check("the runtime's chart emitters take every colour from the token block: no fill, stroke or inline style in its source names a literal colour, and it names no font at all",
      values.length >= 5 && values.every((v) => !literalColour.test(v) && /^[a-z:;\s-]*$/.test(v)) && !/font(-family)?\s*:/.test(src) && !/#[0-9a-fA-F]{6}\b|\b(rgba?|hsla?)\(/.test(src.replace(/&#\d+;/g, "")), values.filter((v) => literalColour.test(v) || !/^[a-z:;\s-]*$/.test(v)));
  }

  // ══ The ruled defaults: every status with badges and "running now"; the leaders' page on closed months ══
  {
    const preA = loadPage(build(SPEC_DEFAULTS, PULLED).html);
    const statusBoxes = (html) => [...html.matchAll(/data-f="status" value="([A-Z]+)"( checked)?>/g)].map((m) => m[1] + (m[2] ?? ""));
    check("the admin preset opens on every program that sent, with status badges on every row, and a one-click 'Running now' preset in the status filter (ruled 2026-10-05): every status box is ticked, nothing is hidden by status, and the preset narrows the view to Active programs",
      isDeepStrictEqual(statusBoxes(preA.prerender), ["PROCESSING checked", "PAUSE checked", "NEW checked"]) && preA.prerender.includes("5 programs shown. 0 programs hidden by status (showing every status).") && /data-act="running">Running now</.test(preA.prerender) &&
        rowsOf(panelHtml(preA.prerender, "programs")).every((r) => r[0].includes("Active") || r[0].includes("Paused") || r[0].includes("Draft")) && rowsOf(panelHtml(preA.prerender, "programs")).length === 5 &&
        preA.call(`app.regions.summary(app.clean({ ...app.defaultState(), statuses: ["PROCESSING"] }))`).includes("4 programs shown. 1 program hidden by status (showing Active)") && /data-act="running" aria-pressed="true"/.test(preA.call(`app.regions.filters(app.clean({ ...app.defaultState(), statuses: ["PROCESSING"] }))`)) &&
        preA.call(`app.hashOf(app.clean({ ...app.defaultState(), statuses: ["PROCESSING"] }))`) === "s=PROCESSING",
      statusBoxes(preA.prerender));
    const preE = loadPage(build(SPEC_DEFAULTS, PULLED, "exec").html);
    check("the leaders' preset opens on the closed months with the current month one click away (pages[].dateDefault, ruled 2026-10-05): the default state ends on August, the Months filter offers 'Include 2026-09 (provisional)', clicking it is the state ending on September, which then offers 'Closed months only'; the admin preset opens on the whole window with the mark",
      isDeepStrictEqual([preE.call(`app.defaultState().from`), preE.call(`app.defaultState().to`)], ["2026-06", "2026-08"]) && /data-act="months-current">Include 2026-09 \(provisional\)</.test(preE.prerender) && !preE.prerender.includes("Closed months only") &&
        /data-act="months-closed">Closed months only</.test(preE.call(`app.regions.filters(app.clean({ ...app.defaultState(), to: "2026-09" }))`)) && preE.call(`app.hashOf(app.clean({ ...app.defaultState(), to: "2026-09" }))`) === "m=2026-06..2026-09" && isDeepStrictEqual(preE.call(`app.filtersOf(app.defaultState()).months`), ["2026-06", "2026-07", "2026-08"]) &&
        preA.call(`app.defaultState().to`) === "2026-09" && preA.prerender.includes("Includes the provisional period") && /data-act="months-closed">Closed months only</.test(preA.prerender) && preE.call(`app.model.page.dateDefault`) === "closed-months" && preA.call(`app.model.page.dateDefault`) === "window",
      [preE.call(`app.defaultState()`), preE.prerender.match(/data-act="months-[a-z]+">[^<]*</g)]);
    const old = structuredClone(SPEC_DEFAULTS);
    for (const p of old.pages) delete p.dateDefault;
    check("dateDefault is additive on T-11: a spec written before it existed opens and each page takes its preset's months", openSpec(old) !== null && loadPage(build(openSpec(old), PULLED, "exec").html).call(`app.defaultState().to`) === "2026-08" && loadPage(build(openSpec(old), PULLED).html).call(`app.defaultState().to`) === "2026-09");
  }

  // ══ The filter bar ════════════════════════════════════════════════════════
  {
    const pre = admin.prerender;
    const listed = [...pre.matchAll(/<label class="gs-prog"><input type="checkbox" data-f="program" value="([^"]+)" checked> <span class="gs-prog-name">([^<]*)<\/span> ([\s\S]*?)<\/label>/g)].map((m) => ({ id: m[1], name: unescape(m[2]), badges: [...m[3].matchAll(/<span class="gs-badge[^"]*">([^<]*)<\/span>/g)].map((b) => unescape(b[1])) }));
    const byId = new Map(GOLD.dimensions.programs.map((p) => [p.id, p]));
    check("the program filter is a scrollable, searchable list of every program in the snapshot, each with its status and group badges, with select all, select none and 'N of M selected'",
      listed.length === 5 && listed.every((l) => byId.get(l.id).name === l.name && isDeepStrictEqual(l.badges, [...byId.get(l.id).statuses.map(engine.statusLabel), `${byId.get(l.id).supergroup} / ${byId.get(l.id).group}`])) &&
        /<input type="search" data-f="search"/.test(pre) && /data-act="all">Select all</.test(pre) && /data-act="none">Select none</.test(pre) && pre.includes(`data-region="count">5 of 5 selected<`) && /\.gs-proglist\{max-height:\d+px;overflow:auto/.test(ADMIN.html),
      listed);
    check("the date filter is month-granular: a from and a to, each offering exactly the snapshot's months, starting on the whole window on an admin page",
      isDeepStrictEqual([...pre.split(`data-f="from">`)[1].split("</select>")[0].matchAll(/<option value="([^"]+)"( selected)?>/g)].map((m) => m[1] + (m[2] ?? "")), ["2026-06 selected", "2026-07", "2026-08", "2026-09"]) &&
        isDeepStrictEqual([...pre.split(`data-f="to">`)[1].split("</select>")[0].matchAll(/<option value="([^"]+)"( selected)?>/g)].map((m) => m[1] + (m[2] ?? "")), ["2026-06", "2026-07", "2026-08", "2026-09 selected"]));
    const hidden = GOLD.dimensions.programs.filter((p) => !p.statuses.includes("PROCESSING")).length;
    const statusBoxes = (html) => [...html.matchAll(/data-f="status" value="([A-Z]+)"( checked)?>/g)].map((m) => m[1] + (m[2] ?? ""));
    check("the status filter starts from each page's default in the spec: the fixture's admin page on Active only, its leaders' page on every status (R23), and each page says how many programs the status filter hides",
      hidden === 1 && isDeepStrictEqual(statusBoxes(pre), ["PROCESSING checked", "PAUSE", "NEW"]) && pre.includes(`4 programs shown. ${hidden} program hidden by status (showing Active).`) &&
        isDeepStrictEqual(statusBoxes(exec.prerender), ["PROCESSING checked", "PAUSE checked", "NEW checked"]) && exec.prerender.includes("5 programs shown. 0 programs hidden by status (showing every status)."),
      [statusBoxes(pre), pre.match(/<p class="gs-summary"[^>]*>([^<]*)/)?.[1]]);
    check("the 'hidden by status' line follows the filters: with Paused added nothing is hidden, and with only Draft four programs are",
      admin.call(`app.regions.summary(app.stateFromHash("s=PROCESSING,PAUSE"))`).includes("0 programs hidden by status (showing Active, Paused)") && admin.call(`app.regions.summary(app.stateFromHash("s=NEW"))`).includes("4 programs hidden by status (showing Draft)"));
    check("the group filter offers the dashboard's own supergroups, and once one is chosen only the groups inside it",
      /<select data-f="sg"><option value="" selected>Every supergroup<\/option>/.test(pre) && admin.call(`app.supergroups`).length >= 3 &&
        isDeepStrictEqual([...admin.call(`app.regions.groupOptions(app.stateFromHash("sg=" + app.supergroups.indexOf("Surveys")))`).matchAll(/>([^<]+)<\/option>/g)].map((m) => m[1]), ["Every group", "CSAT"]));
    check("the recipients toggle is offered, starts where the spec says and can be used: the pull named an internal domain",
      /<input type="checkbox" data-f="external"> Leave out internal recipients \(by email domain\)<\/label>/.test(pre) && admin.call(`app.stateFromHash("rc=external").external`) === true);
    const noStatus = build(specWith((s) => { s.globalFilters.find((f) => f.id === "status").enabled = false; s.globalFilters.find((f) => f.id === "recipientClass").default = "external"; }), PULLED);
    check("which filters a page offers is the spec's choice: a filter the spec turns off is not drawn, the page's status default still applies and is still stated, and the recipients filter starts where the spec says",
      !loadPage(noStatus.html).prerender.includes(`data-f="status"`) && loadPage(noStatus.html).prerender.includes("1 program hidden by status (showing Active)") && /data-f="external" checked>/.test(loadPage(noStatus.html).prerender) && loadPage(noStatus.html).call(`app.filtersOf(app.defaultState()).recipientClass`) === "external");
  }

  // ══ What a page can lack: one table, one function, one renderer ═══════════
  const OFF_ADMIN = build(SPEC_ACCOUNTS, OFF);
  for (const id of drawn(OFF_ADMIN.html)) reached.add(id);
  {
    const off = OFF_ADMIN.html;
    const text = reasonText("accounts-off");
    const [watch, view, filter] = [panelHtml(off, "watch"), panelHtml(off, "accounts"), filterHtml(off, "Account")];
    check("accounts off: where the watch list would be, the page shows the snapshot's own reason and nothing else: no table, no zero, no download button",
      !!watch && lacksIn(watch).join() === "accounts-off" && watch.includes(esc(text)) && !/<table|data-csv|<td/.test(watch) && watch.startsWith("<h2>Low engagement</h2><div class=\"gs-notice\""), watch);
    check("accounts off: the account view shows the same reason in its place, never an empty table",
      !!view && lacksIn(view).join() === "accounts-off" && view.includes(esc(text)) && !/<table|data-csv|<td/.test(view), view);
    check("accounts off: where the account filter would be there is the reason and no control, and on the same pages with accounts pulled there is the control and no notice",
      !!filter && lacksIn(filter).join() === "accounts-off" && filter.includes(esc(text)) && !/<select|<input/.test(filter) &&
        /<select data-f="account"><option value="" selected>Every account on this page<\/option><option value="co-01">Acme Customer 01<\/option>/.test(filterHtml(ADMIN.html, "Account")) && lacksIn(filterHtml(ADMIN.html, "Account")).length === 0 && /<table>/.test(panelHtml(ADMIN.html, "watch")),
      filter);
    const changeLine = COPY_LINES.change("program-health", "accounts.pull", "true");
    check("the notice says what it would take, on an admin page: a new pull, the setting to turn on by its name in the spec's own descriptions and by its path, and the deterministic entry command's line to copy (ruled 2026-10-05, Z0 choice 2): `change <slug> <path>=<json>` built from the setting's path, true for a switch",
      watch.includes(esc(NEEDS.pull)) && watch.includes(`Turn on &quot;Accounts&quot; in this dashboard's settings (<span class="gs-path">accounts.pull</span>).`) &&
        watch.includes(`<code>${esc(changeLine)}</code> <button type="button" data-copy="${esc(changeLine)}">Copy</button>`) && /data-needs="pull"/.test(watch) && changeLine === "node .gs-superadmin/plugin/scripts/dashboard.mjs change program-health accounts.pull=true" && ENTRY_COMMAND === "node .gs-superadmin/plugin/scripts/dashboard.mjs",
      watch);
    check("it reads as information, not as an error: a note, with no error role, no alert and no error wording",
      /<div class="gs-notice" role="note"/.test(watch) && !/role="alert"|error|Error|failed|warning/.test(watch) && /\.gs-notice\{[^}]*background:var\(--note\)/.test(off));
    const toggle = filterHtml(off, "Recipients");
    check("accounts off with test accounts named in the spec: beside the recipients toggle the page says they are not left out, since the filter works by email domain; with accounts pulled, or with no test account named, it says nothing there",
      lacksIn(toggle).join() === "test-accounts-need-accounts" && toggle.includes(esc(reasonText("test-accounts-need-accounts"))) && lacksIn(filterHtml(ADMIN.html, "Recipients")).length === 0 && lacksIn(filterHtml(build(SPEC, OFF).html, "Recipients")).length === 0, toggle);
    check("with accounts off the page embeds no account row and no account name, and its other panels are untouched: the program table equals the engine's over the same snapshot",
      OFF_ADMIN.report.rows.byAccount === undefined && isDeepStrictEqual(panelRun(loadPage(off), "programs", "s=all"), plain(runQuery(applyGroups(OFF, SPEC.groups).snapshot, { recipientClass: "all" }, SPEC.pages[0].panels[0].query))));
  }
  {
    // The table panel takes the engine's result and nothing else.
    const app = createDashboard(engine, pageModel(SPEC_ACCOUNTS, GOLD, SPEC_ACCOUNTS.pages[0]));
    const real = app.run(app.panels.find((p) => p.id === "accounts"), app.defaultState());
    const forged = { ...real, unavailable: { reason: "accounts-off" } };
    const drawnNotice = app.renderTablePanel(app.panels.find((p) => p.id === "accounts"), forged, ["sent"]);
    check("the table panel can draw only the notice when the engine says unavailable: handed a result that says so AND still carries rows and a total, it draws no table, no figure and no download button",
      real.rows.length > 0 && lacksIn(drawnNotice).join() === "accounts-off" && !/<table|<td|data-csv|data-col/.test(drawnNotice) && /<table>/.test(app.renderTablePanel(app.panels.find((p) => p.id === "accounts"), real, ["sent"])), drawnNotice);
    const unknown = app.renderTablePanel(app.panels[0], { ...real, unavailable: { reason: "some-future-reason" } }, ["sent"]);
    check("a reason the table has no row for is still stated in its place, in the engine's words, with no how-to it cannot stand behind and still no table",
      unknown.includes(esc(reasonText("some-future-reason"))) && !/gs-notice-how|data-copy|<table/.test(unknown) && app.lackFacts("some-future-reason").known === false);
    check("the facts come from one function: reason, the engine's wording, pull or rebuild, the setting and the line; a lack that depends on the data asks the caller which it is; a figure the snapshot predates and a health part the pull lost each get the refresh line",
      isDeepStrictEqual(app.lackFacts("accounts-off"), { reason: "accounts-off", text: reasonText("accounts-off"), known: true, needs: "pull", needsText: NEEDS.pull, setting: { path: "accounts.pull", how: "on", label: "Accounts" }, line: COPY_LINES.change("program-health", "accounts.pull", "true") }) &&
        app.lackFacts("tab-off", { held: true }).needs === "rebuild" && app.lackFacts("tab-off", { held: false }).needs === "pull" && app.lackFacts("measure-not-in-snapshot").line === COPY_LINES.refresh("program-health") && app.lackFacts("measure-not-in-snapshot").setting === null &&
        app.lackFacts("call-failed").line === "node .gs-superadmin/plugin/scripts/dashboard.mjs refresh program-health" && app.lackFacts("no-internal-domain").line === "node .gs-superadmin/plugin/scripts/dashboard.mjs change program-health sources[].params.internalDomains[]=");
    // The actions seam (ruled 2026-10-05; the local app is LTR-10): a button when the page has one behind it, the copy line when it does not.
    const withActions = createDashboard(engine, { ...pageModel(SPEC_ACCOUNTS, GOLD, SPEC_ACCOUNTS.pages[0]), actions: { base: "http://127.0.0.1:1/", token: "never-in-markup" } });
    const button = withActions.renderNotice(withActions.lackFacts("accounts-off"));
    const copy = app.renderNotice(app.lackFacts("accounts-off"));
    check("the actions seam: with `actions` set on the page model the notice draws a button that would run the line (and the token never reaches the markup); with it null, as on every page built here, the notice draws the copy line; the built pages carry null",
      /<button type="button" class="gs-action" data-action="[^"]*change program-health accounts\.pull=true" data-action-base="http:\/\/127\.0\.0\.1:1\/">Do it now</.test(button) && !button.includes("never-in-markup") && !button.includes("data-copy") &&
        /data-copy="[^"]*change program-health accounts\.pull=true">Copy</.test(copy) && !copy.includes("gs-action") && admin.call(`app.model.actions`) === null && execP.call(`app.model.actions`) === null, button);
  }
  {
    // A leaders' page: the statement, without the how-to.
    const execAccounts = build(specWith((s) => { s.pages[1].panels.push({ ...accountPanels[1] }); }), PULLED, "exec");
    for (const id of drawn(execAccounts.html)) reached.add(id);
    const view = panelHtml(execAccounts.html, "accounts");
    check("a leaders' page gets the statement without the how-to: where account detail would be it says it is not part of the page, with no setting, no 'pull' or 'rebuild' and no line to copy",
      lacksIn(view).join() === "accounts-not-on-page" && view.includes(esc(reasonText("accounts-not-on-page"))) && !/gs-notice-how|gs-notice-line|data-copy|<code>|gs-path/.test(view) && /data-needs=""/.test(view) && !/<table/.test(view), view);
    const names = PULLED.dimensions.accounts.flatMap((a) => [a.name, a.key]);
    // As a pull that pinned accounts echoes them: by key, in meta.params.
    const pinned = structuredClone(PULLED);
    pinned.meta.params.accounts.pinned = ["co-01"];
    const execPinned = build(SPEC, pinned, "exec");
    check("a page that may not name accounts carries no account data at all: no account row, name or key is anywhere in the file, the pinned accounts' keys included, and the same snapshot's admin page does carry them",
      names.every((n) => !execAccounts.html.includes(n)) && execAccounts.report.rows.byAccount === undefined && names.every((n) => ADMIN.html.includes(n)) && ADMIN.report.rows.byAccount === PULLED.facts.byAccount.length &&
        !execPinned.html.includes("co-01") && loadPage(execPinned.html).call(`app.snapshot.meta.params.accounts.pinned`).length === 0 && loadPage(build(SPEC, pinned).html).call(`app.snapshot.meta.params.accounts.pinned`).join() === "co-01");
    const namesOffTest = build(specWith((s) => { s.pages[0].accountNames = false; s.pages[0].panels.push({ ...accountPanels[1] }); s.sources[0].params.testAccounts = ["co-09"]; }), PULLED);
    check("a page that merely leaves accounts off is not short of a pull: with test accounts named and the pull holding accounts, the recipients toggle carries no 'needs a new pull' notice, and the account slot says the page left them off",
      lacksIn(filterHtml(namesOffTest.html, "Recipients")).length === 0 && lacksIn(filterHtml(namesOffTest.html, "Account")).join() === "accounts-not-on-page", filterHtml(namesOffTest.html, "Recipients"));
    const adminNoNames = build(specWith((s) => { s.pages[0].panels.push({ ...accountPanels[1] }); s.pages[0].accountNames = false; }), PULLED);
    for (const id of drawn(adminNoNames.html)) reached.add(id);
    const how = panelHtml(adminNoNames.html, "accounts");
    check("the same lack on an admin page carries the how-to, and it is only a rebuild: the pull holds the accounts, the page was told not to name them",
      lacksIn(how).join() === "accounts-not-on-page" && how.includes(esc(NEEDS.rebuild)) && how.includes(`<span class="gs-path">pages[].accountNames</span>`) && /data-needs="rebuild"/.test(how) && PULLED.dimensions.accounts.every((a) => !adminNoNames.html.includes(a.name)), how);
    check("a pull that read no accounts keeps its own reason on every page, so the page says what it would really take (a new pull), not that the page left them out",
      lacksIn(panelHtml(build(specWith((s) => { s.pages[1].panels.push({ ...accountPanels[1] }); }), OFF, "exec").html, "accounts")).join() === "accounts-off");
  }
  {
    // A tab is on, offered or absent.
    const healthOff = specWith((s) => { s.pages[0].tabs.find((t) => t.id === "health").enabled = false; s.pages[0].tabs.find((t) => t.id === "templates").enabled = false; s.pages[0].panels = s.pages[0].panels.filter((p) => p.tab !== "health" && p.tab !== "templates"); });
    const offered = build(healthOff, PULLED);
    for (const id of drawn(offered.html)) reached.add(id);
    const tabButtons = (html) => [...html.matchAll(/<button type="button" class="gs-tab([^"]*)" data-tab="([a-z]+)"[^>]*>([^<]*)<\/button>/g)].map((m) => `${m[2]}:${m[1].trim()}:${m[3]}`);
    check("a tab has three states. On an admin page a tab the spec turns off is OFFERED: still in the tab row, dimmed and marked off; the tabs that are on are plain",
      isDeepStrictEqual(tabButtons(offered.html), ["engagement:is-current:Engagement", "health:is-offered:Health (off)", "templates:is-offered:Templates (off)", "about::About"]) && /\.gs-tab\.is-offered\{opacity:\.6/.test(offered.html) &&
        isDeepStrictEqual(tabButtons(ADMIN.html), ["engagement:is-current:Engagement", "health::Health", "templates::Templates", "about::About"]), tabButtons(offered.html));
    const pane = paneHtml(offered.html, "health");
    check("opening an offered tab opens the notice and nothing else: what the tab is for, that it is off for this page, what it would take and the line to copy. The pull holds health data, so for Health it is only a rebuild",
      lacksIn(pane).join() === "tab-off" && pane.includes(`<p class="gs-notice-head">${esc("Health: error rates, error messages, silent programs and schedule failures")}</p>`) && pane.includes(esc(reasonText("tab-off"))) && pane.includes(esc(NEEDS.rebuild)) &&
        pane.includes(`<span class="gs-path">pages[].tabs[].enabled</span>`) && pane.includes("data-copy=") && !/<table|gs-panel/.test(pane) && loadPage(offered.html).call(`app.stateFromHash("t=health").tab`) === "health", pane);
    const LEGACY = { ...PULLED, meta: { ...PULLED.meta, templates: undefined } };
    check("whether turning a tab on is a rebuild or a new pull is read from the pull: over a snapshot with no health data the Health tab needs a new pull; Templates is a rebuild over a pull that holds template content and a new pull over a snapshot made before it existed",
      paneHtml(build(healthOff, OFF).html, "health").includes(esc(NEEDS.pull)) && !paneHtml(build(healthOff, OFF).html, "health").includes(esc(NEEDS.rebuild)) && paneHtml(offered.html, "templates").includes(esc(NEEDS.rebuild)) && paneHtml(build(healthOff, LEGACY).html, "templates").includes(esc(NEEDS.pull)));
    check("on a leaders' page a tab that is off is ABSENT: no button, no pane, no notice; the fixture's leaders' page has Engagement and About and nothing of Health or Templates",
      isDeepStrictEqual(tabButtons(EXEC.html), ["engagement:is-current:Engagement", "about::About"]) && !EXEC.html.includes(`data-pane="health"`) && !EXEC.html.includes(`data-pane="templates"`) && !drawn(EXEC.html).includes("tab-off") && exec.call(`app.stateFromHash("t=health").tab`) === "engagement");
    // F-486: an on tab with nothing to draw is refused by the writer; over a snapshot made before template content existed the templates panel draws the snapshot's own reason.
    const legacyAdmin = build(SPEC_ACCOUNTS, LEGACY);
    for (const id of drawn(legacyAdmin.html)) reached.add(id);
    const legacyPane = paneHtml(legacyAdmin.html, "templates");
    check("F-486: a spec that lists panels but leaves an on tab with none is refused by the writer (Templates included since TPL-2), so no on tab stands empty; and over a snapshot made before template content existed the Templates tab's panel draws the notice (a new pull with this plugin, with the refresh line), never an empty table and never a bare heading",
      lacksIn(legacyPane).join() === "templates-not-pulled" && legacyPane.includes(esc(reasonText("templates-not-pulled"))) && legacyPane.includes(esc(COPY_LINES.refresh("program-health"))) && /data-type="templates"/.test(legacyPane) && !/<table|gs-muted">Templates/.test(legacyPane) && !legacyPane.includes("gs-path") &&
        throwsWith(() => specWith((s) => { s.pages[0].panels = s.pages[0].panels.filter((p) => p.tab !== "health"); }), /lists no panel for the health tab, which is on/) && throwsWith(() => specWith((s) => { s.pages[0].panels = s.pages[0].panels.filter((p) => p.tab !== "templates"); }), /lists no panel for the templates tab, which is on/), legacyPane);

    // ── The Templates tab (TPL-2): the templates view over the fixture, its search, its drawer, and what a page may withhold ──
    {
      const tpanel = (page, hash) => page.call(`app.renderPanel(app.panels.find((p) => p.type === "templates"), app.stateFromHash(${JSON.stringify(hash)}), null)`);
      const mainRows = (html) => [...(html ?? "").matchAll(/<tr data-template="([^"]+)">([\s\S]*?)<\/tr>/g)].map((m) => ({ id: m[1], cells: [...m[2].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => textOf(c[1])) }));
      const f0 = admin.call(`app.filtersOf(app.defaultState())`);
      const view = engine.templatesView(GOLD, f0, { snippet: 40 });
      const pre = panelHtml(ADMIN.html, "templates");
      check("the Templates tab draws the templates panel (TPL-2): a search form, a sortable table with one row per template the filters keep in the engine's order — the name with its Text button, how many programs send it, its last send month, whether it was edited after its last send with the text's as-of day, and the metrics as the engine formats them — the programs under each row and, with step detail, their steps and variants; the total row; and no drawer, mark or snippet until asked",
        pre !== null && /data-type="templates"/.test(ADMIN.html) && /<form class="gs-search" data-search>/.test(pre) && isDeepStrictEqual(mainRows(pre).map((r) => r.id), view.rows.map((r) => r.templateId)) && view.rows.length > 0 &&
          mainRows(pre).every((r, i) => { const v = view.rows[i]; return r.cells[0].startsWith(v.name) && r.cells[1] === String(v.programs.length) && r.cells[2] === (v.lastSendMonth ?? NO_VALUE) && r.cells.slice(4).join("|") === view.metrics.map((id) => formatCell(id, v.cells[id])).join("|"); }) &&
          (pre.match(/<tr class="gs-sub">/g) ?? []).length === view.rows.flatMap((r) => r.programs).length && (pre.match(/<tr class="gs-sub gs-sub2">/g) ?? []).length === view.rows.flatMap((r) => r.programs).flatMap((p) => p.steps ?? []).length &&
          /Everything the filters keep/.test(pre) && !/<mark>|gs-drawer|gs-snippet/.test(pre) && mainRows(pre).find((r) => r.id === "tpl-nps").cells[3] === "yes, on 2026-08-10 (text as of 2026-09-01)" && mainRows(tpanel(admin, "t=templates&s=all")).find((r) => r.id === "tpl-unlisted").cells[3] === NO_VALUE,
        mainRows(pre));
      const renew = tpanel(admin, "t=templates&s=all&p=p-renew");
      check("a template reused on two steps aggregates across them and still drills down per step: under the renewal program its row says it is on 2 steps and two step rows follow, each with its own figures; the filters narrow the view to that program's templates, the engine's rows",
        isDeepStrictEqual(mainRows(renew).map((r) => r.id), engine.templatesView(GOLD, { recipientClass: "all", programs: ["p-renew"] }).rows.map((r) => r.templateId)) && /on 2 steps/.test(renew) && (renew.split('data-template="tpl-renew"')[1].split('data-template="tpl-renew-b"')[0].match(/gs-sub2/g) ?? []).length === 2, mainRows(renew));
      const searched = tpanel(admin, "t=templates&s=all&q=renewal");
      const both = tpanel(admin, "t=templates&s=all&q=acme%20survey&qa=1");
      const whole = tpanel(admin, "t=templates&s=all&q=renew&qw=1");
      check("the search narrows the rows to the templates whose subject or body holds the words (q= in the hash), marks each hit in a snippet naming the field, and says how many of the searched templates matched; all the words (qa=1) and whole words (qw=1) narrow further; a miss says so; every match set is the engine's own; the state round-trips through the hash",
        isDeepStrictEqual(mainRows(searched).map((r) => r.id), ["tpl-renew", "tpl-renew-b"]) && /<mark>renewal<\/mark>/.test(searched) && /<mark>Renewal<\/mark>/.test(searched) && /gs-snippet"><span class="gs-muted">subject:<\/span>/.test(searched) && /2 emails of 5 searched hold any of "renewal"/.test(searched) && searched.includes('value="renewal"') &&
          isDeepStrictEqual(mainRows(both).map((r) => r.id), ["tpl-nps"]) && /hold all of "acme", "survey"/.test(both) && mainRows(whole).length === 0 && /No email matches the search/.test(whole) && /as whole words/.test(whole) &&
          isDeepStrictEqual(mainRows(searched).map((r) => r.id), engine.templatesView(GOLD, { recipientClass: "all" }, { terms: ["renewal"], snippet: 40 }).rows.map((r) => r.templateId)) &&
          admin.call(`app.hashOf(app.stateFromHash("t=templates&s=all&q=renewal%20now&qa=1&qw=1&ts=openRate&td=asc&tpl=tpl-nps"))`) === "t=templates&s=all&q=renewal%20now&qa=1&qw=1&ts=openRate&td=asc&tpl=tpl-nps", [mainRows(searched), mainRows(both), mainRows(whole)]);
      const sorted = tpanel(admin, "t=templates&s=all&ts=name&td=asc");
      check("the column headings sort (ts= and td= in the hash): by name ascending the rows are in name order and the heading says so; by a metric, the engine's order with nulls last; an unknown key is dropped",
        isDeepStrictEqual(mainRows(sorted).map((r) => r.id), engine.templatesView(GOLD, { recipientClass: "all" }, { sort: { by: "name", dir: "asc" } }).rows.map((r) => r.templateId)) && /aria-sort="ascending"><button type="button" class="gs-sort is-on" data-tsort="name">Email &#9650;/.test(sorted) &&
          isDeepStrictEqual(mainRows(tpanel(admin, "t=templates&s=all&ts=openRate")).map((r) => r.id), engine.templatesView(GOLD, { recipientClass: "all" }, { sort: { by: "openRate", dir: "desc" } }).rows.map((r) => r.templateId)) && admin.call(`app.stateFromHash("ts=bogus&td=asc").ts`) === null, mainRows(sorted));
      const drawer = tpanel(admin, "t=templates&s=all&tpl=tpl-nps");
      check("Text opens the drawer (tpl= in the hash): the template's name, its subject with tokens as field labels, the day the text is as of, the caveat that it is the current text and not necessarily what was sent, the last-modified day and the edited-after-last-send flag, the body in a pre-wrap block, the variants, and a Close button; an unknown id opens nothing",
        /<section class="gs-drawer" data-drawer="tpl-nps">/.test(drawer) && drawer.includes("How is {Product Name} working for you?") && /as of 2026-09-01: not necessarily what was sent/.test(drawer) && /edited after it: yes, on 2026-08-10/.test(drawer) && /<pre class="gs-body">Hi there,\n\nTell us how \{Product Name\}/.test(drawer) && /data-act="tpl-close"/.test(drawer) &&
          !/gs-drawer/.test(tpanel(admin, "t=templates&s=all&tpl=ghost")) && /<h4>Variant: Variant B<\/h4>/.test(tpanel(admin, "t=templates&s=all&tpl=tpl-welcome")), drawer?.slice(0, 600));
      const presetAdmin = build(SPEC_DEFAULTS, PULLED);
      const emails = panelHtml(presetAdmin.html, "emails");
      const withText = (id) => !!GOLD.dimensions.templates.find((t) => t.id === id)?.content;
      check("the Emails and Steps tables link to a template's text: a template cell carries the Text button that opens its drawer on the Templates tab when the page holds that template's text, and not otherwise; the leaders' page, with no templates panel, carries none",
        (emails.match(/data-open-template="tpl-/g) ?? []).length === runQuery(GOLD, { recipientClass: "all" }, /** @type {any} */ (PRESETS.admin.panels.find((p) => p.id === "emails")).query).rows.filter((r) => withText(r.key.template)).length && !/data-open-template="tpl-unlisted"/.test(emails) && /data-open-template="tpl-welcome"/.test(emails) &&
          /data-open-template="tpl-welcome"/.test(panelHtml(presetAdmin.html, "steps")) && !/data-open-template/.test(markupOf(EXEC_P.html)) && !/data-open-template/.test(markupOf(EXEC.html)), emails?.match(/data-open-template="[^"]+"/g));
      const execTemplates = build(specWith((s) => { s.pages[1].tabs.find((t) => t.id === "templates").enabled = true; }), PULLED, "exec");
      for (const id of drawn(execTemplates.html)) reached.add(id);
      const execPane = paneHtml(execTemplates.html, "templates");
      const adminNoText = build(specWith((s) => { s.pages[0].templateContent = false; }), PULLED);
      for (const id of drawn(adminNoText.html)) reached.add(id);
      check("a leaders' page carries no template text unless the spec opts in (TPL-2): with its Templates tab on, the exec page draws the performance table and, where the search would be, says the text is not on the page (the statement alone: no setting, no line), its data holds no subject or body, and nothing opens a drawer; the same lack on an admin page that turned the text off says what it would take: turn on pages[].templateContent, a rebuild",
        mainRows(execPane).length > 0 && lacksIn(execPane).join() === "templates-not-on-page" && !/data-search|gs-drawer|data-open-template|gs-path/.test(execPane) && !execTemplates.html.includes("How is {Product Name}") && !execTemplates.html.includes(inData("Tell us how")) && ADMIN.html.includes(inData("Tell us how")) &&
          loadPage(execTemplates.html).call(`app.stateFromHash("t=templates&tpl=tpl-nps").tpl`) === null && mainRows(execPane).find((r) => r.id === "tpl-nps").cells[3] === NO_VALUE &&
          lacksIn(paneHtml(adminNoText.html, "templates")).join() === "templates-not-on-page" && paneHtml(adminNoText.html, "templates").includes(`<span class="gs-path">pages[].templateContent</span>`) && paneHtml(adminNoText.html, "templates").includes(esc(NEEDS.rebuild)) && !adminNoText.html.includes(inData("Tell us how")),
        [lacksIn(execPane), execPane?.slice(0, 300)]);
      const hostile = admin.call(`app.renderApp(app.stateFromHash("t=templates&s=all&tpl=tpl-day7&q=alert"), null)`);
      check("a hostile template body renders inert: the legacy doc's literal script element and raw token reach the drawer and the search snippet as text only — once the escaped spans are stripped no script, image or handler remains and the no-network rule holds over the rendered view — and the page reads the body back exactly as the snapshot holds it",
        /gs-drawer" data-drawer="tpl-day7"/.test(hostile) && hostile.includes(esc("<script>alert(1)</script>")) && hostile.includes(esc("${unresolved::token}")) && !/<script|<img|onerror=/.test(hostile.replace(/&lt;[\s\S]*?&gt;/g, "")) && !NO_NETWORK.test(hostile.replace(/&lt;[\s\S]*?&gt;/g, "")) && /<mark>alert<\/mark>/.test(hostile) &&
          admin.call(`app.snapshot.dimensions.templates.find((t) => t.id === "tpl-day7").content.body`) === GOLD.dimensions.templates.find((t) => t.id === "tpl-day7").content.body);
      const csv = admin.call(`app.csvOf(app.panels.find((p) => p.type === "templates"), app.stateFromHash("t=templates&s=all"), null)`);
      const parsed = parseCsv(csv.text);
      const all = engine.templatesView(GOLD, { recipientClass: "all" }, { snippet: 40 });
      const csvSearched = admin.call(`app.csvOf(app.panels.find((p) => p.type === "templates"), app.stateFromHash("t=templates&s=all&q=renewal"), null)`).text;
      check("the templates view's export is its view (R27): one line per template, then one per program under it and one per step and variant with step detail, the search as drawn, every figure the engine's own with its tracking state beside a click figure, and the file named for the dashboard, page, panel and pull",
        isDeepStrictEqual(parsed[0].slice(0, 9), ["Email", "Template id", "Program", "Status", "Step", "Variant", "Last send", "Edited after last send", "Text as of"]) && parsed.length === 1 + countLines(all.rows) &&
          parsed[1][0] === all.rows[0].name && parsed[1][1] === all.rows[0].templateId && String(parsed[1][9]) === String(all.rows[0].cells.sent.value) && parsed[0].includes("Clicked tracking") && csv.filename === "program-health-admin-templates-20260915T0900.csv" &&
          csvSearched.split("\n").some((l) => l.startsWith("Acme Renewal,")) && !csvSearched.includes("Acme Welcome"), [parsed[0], parsed[1]]);
      // Wired: the form, the Text buttons and the headings, against a stand-in document.
      const wired = (() => { const listeners = {}; const painted = {}; const replaced = []; const root = { disabled: true, innerHTML: null, addEventListener: (type, fn) => { listeners[type] = fn; }, querySelectorAll: () => [], querySelector: (sel) => { const name = sel.match(/data-region="(\w+)"/)?.[1]; return name ? { set innerHTML(v) { painted[name] = v; } } : null; } }; mount(createDashboard(engine, pageModel(SPEC_ACCOUNTS, GOLD, SPEC_ACCOUNTS.pages[0])), root, { document: {}, localStorage: { getItem: () => null, setItem: () => {} }, location: { hash: "#t=templates&s=all" }, history: { replaceState: (a, b, url) => replaced.push(url) }, addEventListener: () => {} }); return { listeners, painted, replaced }; })();
      wired.listeners.submit({ preventDefault: () => {}, target: { closest: () => ({ querySelector: (sel) => (sel.includes('"q"') ? { value: " renewal " } : { checked: sel.includes('"qa"') }) }) } });
      wired.listeners.click({ target: { closest: () => ({ hasAttribute: (n) => n === "data-open-template", getAttribute: (n) => (n === "data-open-template" ? "tpl-nps" : null) }) } });
      const sortClick = () => wired.listeners.click({ target: { closest: () => ({ hasAttribute: (n) => n === "data-tsort", getAttribute: (n) => (n === "data-tsort" ? "name" : null) }) } });
      sortClick();
      const afterFirstSort = wired.replaced.at(-1);
      sortClick();
      check("the search form, the Text buttons and the sort headings are wired: a submit reads the words and the two boxes into the state and rewrites the address, a Text click opens the drawer on the Templates tab, a heading click sorts and a second click flips the direction",
        isDeepStrictEqual(wired.replaced.slice(0, 2), ["#t=templates&s=all&q=renewal&qa=1", "#t=templates&s=all&q=renewal&qa=1&tpl=tpl-nps"]) && afterFirstSort === "#t=templates&s=all&q=renewal&qa=1&ts=name&tpl=tpl-nps" && wired.replaced.at(-1) === "#t=templates&s=all&q=renewal&qa=1&ts=name&td=desc&tpl=tpl-nps" && /data-drawer="tpl-nps"/.test(wired.painted.panes), wired.replaced);
      check("the About tab's How-to names the Templates tab and the search on a page that has them, and the caveats block carries the template-content caveats there; the leaders' page, with no templates panel, carries neither; a leaders' page with the tab on says it carries no text",
        /The Templates tab lists each email/.test(markupOf(ADMIN.html)) && /Search finds the emails/.test(markupOf(ADMIN.html)) && ADMIN.html.includes('data-caveat="template-content-current"') && ADMIN.html.includes('data-caveat="template-content-missing"') && !EXEC.html.includes('data-caveat="template-content-current"') && !/The Templates tab lists/.test(markupOf(EXEC.html)) && /This page carries no email text/.test(markupOf(execTemplates.html)));
    }
    const messages = [...new Set(PULLED.facts.health.bounceReasons.map((r) => r.message))].filter((m) => m != null);
    // A sample text that IS a shipped category's product wording (the params echo carries the pattern) is not tenant text; the rest must reach no page.
    const samples = [...new Set(PULLED.facts.health.failureSamples.map((r) => r.message))].filter((m) => !engine.FAILURE_CATEGORIES.participantFailures.some((c) => m.toLowerCase().includes(c.pattern.toLowerCase())));
    const offPage = loadPage(offered.html);
    check("a page whose Health tab is off carries no health table (an empty bounce-reason table, its copy of the snapshot saying why; the category LABELS still appear, as the category definitions the params echo and a tooltip carry, which is product wording), and a page with the tab on carries every row; the failure SAMPLES (the masked text behind the other rows) are on NO page, the Health tab on or off, and the page's copy holds an empty sample table (ruled 2026-10-05: terminal only)",
      messages.length >= 2 && offPage.call(`app.snapshot.facts.health.bounceReasons.length`) === 0 && exec.call(`app.snapshot.facts.health.bounceReasons.length`) === 0 && messages.every((m) => ADMIN.html.includes(inData(m))) && offPage.call(`app.snapshot.meta.health`).reason === "tab-off" && admin.call(`app.snapshot.facts.health.bounceReasons.length`) === PULLED.facts.health.bounceReasons.length &&
        samples.length > 2 && samples.some((m) => inData(m) !== m) && samples.every((m) => !ADMIN.html.includes(inData(m)) && !offered.html.includes(inData(m)) && !EXEC.html.includes(inData(m)) && !ADMIN_P.html.includes(inData(m))) && admin.call(`app.snapshot.facts.health.failureSamples.length`) === 0 && PULLED.facts.health.failureSamples.length > 2,
      { messages: messages.length, samples: samples.length, adminSamples: admin.call(`app.snapshot.facts.health.failureSamples.length`) });
    const noEngagement = loadPage(build(specWith((s) => { s.pages[0].tabs.find((t) => t.id === "engagement").enabled = false; s.pages[0].panels = []; }), PULLED).html);
    check("a panel of a tab that is not on is not part of the page: with Engagement off and no panel listed, the preset's engagement panels are not built, the health set and the templates view are, the page opens on the first tab that is on, and Engagement is offered as a rebuild (every pull holds it)",
      !noEngagement.prerender.includes(`data-panel="programs"`) && noEngagement.call(`app.panels.map((p) => p.tab)`).every((t) => t === "health" || t === "templates") && noEngagement.call(`app.panels.length`) === 7 && noEngagement.call(`app.defaultState().tab`) === "health" && paneHtml(noEngagement.prerender, "engagement").includes(esc(NEEDS.rebuild)) && ADMIN.html.includes(`data-panel="error-rate"`));
  }
  {
    // The recipients toggle with no internal domain.
    const page = build(SPEC, NO_DOMAIN);
    for (const id of drawn(page.html)) reached.add(id);
    const toggle = filterHtml(page.html, "Recipients");
    const loaded = loadPage(page.html);
    check("no internal domain configured: the recipients toggle is drawn switched off with the reason beside it, never a control that does nothing; what it would take is a new pull with the domains filled in, and the line to copy ends at the = sign with the notice saying what to put there",
      /<input type="checkbox" data-f="external" disabled>/.test(toggle) && lacksIn(toggle).join() === "no-internal-domain" && toggle.includes(esc(reasonText("no-internal-domain"))) && toggle.includes(esc(NEEDS.pull)) && toggle.includes(`Fill in &quot;Internal recipients&quot;`) && toggle.includes(`<span class="gs-path">sources[].params.internalDomains[]</span>`) &&
        toggle.includes("sources[].params.internalDomains[]=</code>") && toggle.includes("ends at the = sign: put the value there"), toggle);
    check("and it cannot be switched on from outside either: a hash asking for external recipients is read as everyone, and a spec whose toggle starts on external starts on everyone here",
      loaded.call(`app.stateFromHash("rc=external").external`) === false && loaded.call(`app.filtersOf(app.stateFromHash("rc=external")).recipientClass`) === "all" &&
        loadPage(build(specWith((s) => { s.globalFilters.find((f) => f.id === "recipientClass").default = "external"; }), NO_DOMAIN).html).call(`app.defaultState().external`) === false);
  }
  {
    // The other rows of the table, each reached by a fixture.
    const stepSpec = specWith((s) => { s.pages[0].panels.push({ id: "steps", tab: "engagement", type: "table", title: "Steps", query: { groupBy: ["program", "step"], metrics: ["sent", "openRate"] } }); });
    const steps = build(stepSpec, OFF);
    for (const id of drawn(steps.html)) reached.add(id);
    check("a panel by step over a pull without step detail shows the reason and the switch that would add it, and over a pull with step detail it shows the table",
      lacksIn(panelHtml(steps.html, "steps")).join() === "step-detail-off" && panelHtml(steps.html, "steps").includes(`<span class="gs-path">sources[].params.stepDetail</span>`) && !/<table/.test(panelHtml(steps.html, "steps")) && /<table>/.test(panelHtml(build(stepSpec, PULLED).html, "steps")));
    // As a snapshot made before send failures were counted looks: no `failed` on its rows.
    const before = structuredClone(PULLED);
    for (const r of before.facts.byTemplate) delete r.failed;
    const old = build(SPEC, before);
    for (const id of drawn(old.html)) reached.add(id);
    const panel = paneHtml(old.html, "health");
    const cells = rowsOf(panel);
    check("a figure the snapshot predates is never a zero: its cells show no value, and under the table the page says why once, with the line that pulls again (no setting to change)",
      cells.length > 0 && cells.every((r) => r[2] === NO_VALUE && r[3] === NO_VALUE && r[1] !== NO_VALUE) && lacksIn(panel).join() === "measure-not-in-snapshot" && panel.includes(`<p class="gs-notice-head">Send failures, Error rate</p>`) &&
        panel.includes(`<code>${esc(COPY_LINES.refresh("program-health"))}</code>`) && !panel.includes("gs-path") && panel.includes(`title="${esc(reasonText("measure-not-in-snapshot"))}"`), [cells, lacksIn(panel)]);
    const uniq = panelHtml(build(specWith((s) => { s.pages[0].panels[0].columns = ["sent", "uniqueRecipients"]; }), PULLED).html, "programs");
    check("a reason that is a property of the figure, not something a setting supplies, is said plainly under the table with no how-to: the total of a distinct count is never added up",
      uniq.includes(`<p class="gs-note"><strong>Unique recipients:</strong> ${esc(reasonText("not-additive"))}</p>`) && lacksIn(uniq).length === 0 && rowsOf(uniq, "tfoot")[0][2] === NO_VALUE);
    // The health rows: a pull without health, a snapshot that predates health, a part the earlier pull lacked, a call that failed.
    const healthPanel = (snapshot) => build(SPEC_DEFAULTS, snapshot);
    const noHealth = healthPanel(OFF);
    for (const id of drawn(noHealth.html)) reached.add(id);
    const predates = structuredClone(PULLED);
    delete predates.meta.health;
    delete predates.facts.health;
    const predatesPage = healthPanel(predates);
    for (const id of drawn(predatesPage.html)) reached.add(id);
    const partial = structuredClone(PULLED);
    partial.meta.health.parts.bounceReasons = { pulled: false, reason: "call-failed" };
    partial.meta.health.parts.schedules = { pulled: false, reason: "not-in-previous" };
    partial.facts.health.bounceReasons = [];
    partial.facts.health.schedules = [];
    const partialPage = healthPanel(partial);
    for (const id of drawn(partialPage.html)) reached.add(id);
    check("the health views over a pull that read no health, and over a snapshot that predates health, draw the snapshot's own reason in each panel's place with the refresh line, never an empty table; a part a later call lost, or an earlier pull lacked, says so in that part's place while the other parts draw",
      ["program-health", "failure-reasons", "schedules"].every((id) => lacksIn(panelHtml(noHealth.html, id)).join() === "health-off" && !/<table/.test(panelHtml(noHealth.html, id)) && panelHtml(noHealth.html, id).includes(esc(COPY_LINES.refresh("program-health")))) &&
        ["program-health", "failure-reasons", "schedules"].every((id) => lacksIn(panelHtml(predatesPage.html, id)).join() === "predates-health") && lacksIn(panelHtml(partialPage.html, "schedules")).join() === "not-in-previous" &&
        lacksIn(panelHtml(partialPage.html, "failure-reasons")).includes("call-failed") && /<table/.test(panelHtml(partialPage.html, "failure-reasons")) && partialPage.html.includes(`data-banner="health"`) && /<table/.test(panelHtml(partialPage.html, "program-health")),
      [lacksIn(paneHtml(noHealth.html, "health")), lacksIn(paneHtml(partialPage.html, "health"))]);
    check("a health pull that was asked for and did not complete is flagged at PAGE level, not only inside the tab (ruled 2026-10-04), decided from the spec: a page whose Health tab is on carries the banner naming the part and its reason; the same snapshot's leaders' page, whose tab is off, carries none; a complete pull carries none; a pull with no health behind an on tab says so",
      /<div class="gs-banner gs-banner-health" role="status" data-banner="health">Some health data could not be read \(bounceReasons: The call that reads this did not return/.test(partialPage.html) && !markupOf(build(SPEC_DEFAULTS, partial, "exec").html).includes(`data-banner="health"`) && !markupOf(ADMIN_P.html).includes(`data-banner="health"`) && !markupOf(ADMIN.html).includes(`data-banner="health"`) &&
        /data-banner="health">The Health tab is on for this page, but the pull holds no health data\. Health data was not pulled/.test(noHealth.html) && !markupOf(build(specWith((x) => { x.pages[0].tabs.find((t) => t.id === "health").enabled = false; x.pages[0].panels = x.pages[0].panels.filter((pn) => pn.tab !== "health"); }), OFF).html).includes(`data-banner="health"`),
      partialPage.html.match(/data-banner="health">[^<]*/)?.[0]);
  }
  {
    // Closed both ways.
    const ids = Object.keys(REASONS);
    const rows = LACKS.map((r) => r.reason);
    const classes = [rows, Object.keys(NOT_LACKS)];
    const homes = (id) => classes.filter((c) => c.includes(id)).length;
    check("every reason the engine can give is classified exactly once: it has a row in the table of what a page can lack, or it is a property of the figure or the tenant; and neither list names a reason the engine does not have",
      ids.every((id) => homes(id) === 1) && classes.flat().every((id) => ids.includes(id)) && new Set(rows).size === rows.length, [ids.filter((id) => homes(id) !== 1), classes.flat().filter((id) => !ids.includes(id))]);
    const unavailable = new Set([
      runQuery(OFF, {}, accountPanels[1].query).unavailable?.reason, runQuery(OFF, {}, { groupBy: ["step"], metrics: ["sent"] }).unavailable?.reason,
      runQuery(pageSnapshot(PULLED, SPEC.pages[1]), {}, accountPanels[1].query).unavailable?.reason, engine.healthSilentView(OFF, {}, { days: 30 }).unavailable?.reason, engine.healthReasonsView(OFF, {}).unavailable?.reason,
    ]);
    check("every reason the engine gives for a table or view it does not hold has a row: accounts off, step detail off, accounts left off a page, health not pulled",
      unavailable.size === 4 && [...unavailable].every((id) => rows.includes(id)), [...unavailable]);
    check("every row is reached by a fixture: across the pages built above, each reason of the table was drawn at least once, and nothing was drawn that the table does not hold",
      rows.every((id) => reached.has(id)) && [...reached].every((id) => rows.includes(id)), [rows.filter((id) => !reached.has(id)), [...reached].filter((id) => !rows.includes(id))]);
    const covered = SPEC_DESCRIPTIONS.flatMap((d) => d.covers);
    const real = (path) => path.replace(/\[\]$/, "").split(/\[\]\.|\./).reduce((at, key) => (Array.isArray(at) ? at[0] : at)?.[key], SPEC) !== undefined;
    check("every setting a row names is a real field of the dashboard spec that a description covers, so a notice can never point at a setting that does not exist; a row that named one is refused when a page is built",
      LACKS.filter((r) => r.setting).every((r) => covered.includes(r.setting.path) && real(r.setting.path) && ["on", "fill"].includes(r.setting.how)) && LACKS.every((r) => ["pull", "rebuild", "by-data"].includes(r.needs) && ["change", "refresh"].includes(r.line)) && Object.keys(NEEDS).join() === "pull,rebuild",
      LACKS.filter((r) => r.setting && !(covered.includes(r.setting.path) && real(r.setting.path))));
    check("the reason wording lives in the engine and nowhere else: the runtime's table holds ids, and no sentence of the engine's reasons is written out in the runtime or the builder",
      Object.values(REASONS).every((sentence) => !SOURCES.runtimeSource.includes(sentence) && !readFileSync(BUILDER, "utf8").includes(sentence)));
  }

  // ══ The panel types (DSH-4): kpi, line, bar, watchlist over the presets ════
  {
    /** @type {import("../scripts/engagement-query.mjs").EngagementFilters} */
    const filters = { recipientClass: "all" }; // SPEC_DEFAULTS: every status, the whole window on the admin page
    const gold = applyGroups(SIGNALS, SPEC.groups).snapshot;
    const kpiPanel = presetPanels(SPEC_DEFAULTS.pages[0]).find((p) => p.id === "headline");
    const view = engine.kpiView(gold, filters, kpiPanel.query);
    const tiles = [...panelHtml(ADMIN_P.html, "headline").matchAll(/<div class="gs-kpi" data-metric="(\w+)">([\s\S]*?)<\/div>/g)].map((m) => ({ id: m[1], text: textOf(m[2]), html: m[2] }));
    check("the kpi panel draws one tile per metric with the engine's own figure, the usual beside it (per month for a count, as itself for a rate) with the change against it, the denominator's count beside every rate as send-size context (R2b), and the 'since last pull' line in its no-previous-pull state (S5 fills the numbers)",
      tiles.map((t) => t.id).join() === kpiPanel.query.metrics.join() && tiles.every((t, i) => t.text.includes(formatCell(t.id, { ...view.tiles[i].cell, state: "tracked" }).replace(/ \(tracking unknown\)$/, "")) && t.text.includes("Usual") && t.text.includes("Since last pull: no previous pull to compare with.")) &&
        tiles.find((t) => t.id === "openRate").text.includes(`Delivered ${formatCell("delivered", view.tiles.find((t) => t.id === "openRate").denominator.cell)}`) && /pts against the usual|level with the usual/.test(tiles.find((t) => t.id === "openRate").text) && /the usual/.test(tiles.find((t) => t.id === "sent").text) && tiles.find((t) => t.id === "sent").text.includes("Usual a month:") &&
        /gs-kpi-value"><sup|<sup title="Includes the provisional period">\*<\/sup>/.test(tiles[0].html) && panelHtml(ADMIN_P.html, "headline").includes("gs-note-clicks") && panelHtml(ADMIN_P.html, "headline").includes(`data-csv="headline"`),
      tiles.map((t) => t.text));
    // The charts: hand-drawn SVG, tokens only, the provisional month shaded, a table underneath.
    const line = panelHtml(ADMIN_P.html, "open-rate-trend");
    const trend = runQuery(gold, filters, presetPanels(SPEC_DEFAULTS.pages[0]).find((p) => p.id === "open-rate-trend").query);
    const bar = panelHtml(ADMIN_P.html, "sends-by-month");
    check("the line panel is one SVG with a polyline per drawn series, a dot per month with the figure in its tooltip, the provisional month shaded, four month labels, a direct label on each series' last point, a legend naming the tracking state of a series that is unknown, and the same rows as a table underneath (the fallback) with the download button",
      /<svg class="gs-chart" viewBox="0 0 640 260" role="img" aria-label="Open rate by month">/.test(line) && (line.match(/<polyline class="gs-svg-line"/g) ?? []).length === 2 && (line.match(/<circle class="gs-svg-dot/g) ?? []).length === trend.rows.length * 2 &&
        (line.match(/<rect class="gs-svg-provisional"/g) ?? []).length === trend.rows.filter((r) => r.incomplete).length && trend.rows.some((r) => r.incomplete) && trend.rows.every((r) => line.includes(`>${r.key.month}${r.incomplete ? "*" : ""}</text>`)) &&
        line.includes(`<title>${esc(`${trend.rows[0].key.month}: Open rate ${formatCell("openRate", { value: trend.rows[0].cells.openRate.value })}`)}</title>`) && (line.match(/class="gs-svg-label"/g) ?? []).length === 2 && /<ul class="gs-legend">.*Open rate.*Click rate.*\(tracking unknown\)/.test(line) &&
        /<details class="gs-fallback" data-fallback="open-rate-trend"><summary>As a table<\/summary>/.test(line) && isDeepStrictEqual(rowsOf(line, "thead")[0], ["Month", "Open rate", "Click rate"]) && rowsOf(line).length === trend.rows.length && line.includes(`data-csv="open-rate-trend"`) && line.includes("gs-note-clicks"),
      [(line.match(/<polyline/g) ?? []).length, (line.match(/<circle/g) ?? []).length, line.match(/<ul class="gs-legend">[\s\S]*?<\/ul>/)?.[0]]);
    const sends = runQuery(gold, filters, presetPanels(SPEC_DEFAULTS.pages[0]).find((p) => p.id === "sends-by-month").query);
    check("the bar panel draws one bar per metric per month, each from a token with the figure in its tooltip, a y axis in whole numbers, the provisional month shaded, and the same rows as a table",
      (bar.match(/<rect class="gs-svg-bar" style="fill:var\(--series-[123]\)"/g) ?? []).length === sends.rows.length * 3 && bar.includes(`<title>${esc(`${sends.rows[0].key.month}: Sent ${sends.rows[0].cells.sent.value}`)}</title>`) && (bar.match(/class="gs-svg-tick"/g) ?? []).length === 5 + sends.rows.length && (bar.match(/<rect class="gs-svg-provisional"/g) ?? []).length === 1 &&
        isDeepStrictEqual(rowsOf(bar, "thead")[0], ["Month", "Sent", "Delivered", "Opened"]) && rowsOf(bar).length === sends.rows.length && !/%</.test(bar.match(/<text[^>]*class="gs-svg-tick"[^>]*>[^<]*<\/text>/)?.[0] ?? ""),
      (bar.match(/<rect class="gs-svg-bar"[^>]*>/g) ?? []).slice(0, 2));
    // A trend across a definition boundary is labelled; a carried-forward month is marked.
    const boundary = structuredClone(PULLED);
    for (const r of boundary.facts.byTemplate) if (r.month === "2026-06") delete r.failed;
    for (const r of boundary.facts.byTemplate) if (r.month === "2026-07") r.provenance = "carried";
    const bPage = build(specWith((s) => { s.pages[0].panels.push({ id: "errors", tab: "engagement", type: "line", title: "Error rate", query: { groupBy: ["month"], metrics: ["errorRate"] } }); }), boundary);
    const bLine = panelHtml(bPage.html, "errors");
    check("a trend across a boundary is labelled: where the first month was pulled before the figure was counted, the line starts at the first month that has it, the gap is never bridged, and a note says from when the figure is counted; a carried-forward month's dot is drawn hollow with the dagger note",
      /gs-note-boundary">Error rate is counted from 2026-07: the months before were pulled before this figure existed/.test(bLine) && (bLine.match(/<circle/g) ?? []).length === 3 && (bLine.match(/<polyline/g) ?? []).length === 1 && !bLine.includes('points="') === false &&
        (bLine.match(/gs-svg-carried/g) ?? []).length === 1 && bLine.includes("&dagger; Includes months carried forward") && bLine.includes(">2026-07†</text>") && lacksIn(bLine).join() === "measure-not-in-snapshot", bLine.match(/<p class="gs-note[^"]*">[^<]*/g));
    // The watch list: accounts ranked across programs, each account's programs underneath.
    const most = presetPanels(SPEC_DEFAULTS.pages[0]).find((p) => p.id === "most-engaged");
    const wl = build(specWith((s) => { s.pages[0].panels = []; s.pages[0].statusDefault = null; }), PULLED);
    const wlHtml = panelHtml(wl.html, "most-engaged");
    const ranked = runQuery(GOLD, { recipientClass: "all", accountBuckets: ["account"] }, most.query);
    const detail = runQuery(GOLD, { recipientClass: "all", accounts: ranked.rows.map((r) => r.key.account), accountBuckets: ["account"] }, { groupBy: ["account", "program"], metrics: most.query.metrics, sort: [{ metric: "delivered", dir: "desc" }] });
    const wlRows = anyRows(wlHtml).slice(1);
    check("the cross-program watch list (ruled 2026-10-05): the accounts the engine ranks over every program under the floor and the top-N, each with how many programs touched it and its figures, and underneath each the per-program rows from a second engine call; the 'all other accounts' and 'no company link' rows never rank; the title never says churn",
      ranked.rows.length > 0 && ranked.rows.every((r) => !["other", "no-company-link"].includes(r.key.account)) && wlRows.filter((r) => !r[1] === false || r[1] !== "").length >= ranked.rows.length &&
        ranked.rows.every((r, i) => { const top = wlRows.find((row) => row[0].startsWith(r.label.account) && row[1] === String(detail.rows.filter((d) => d.key.account === r.key.account).length)); return !!top && top[2] === formatCell("delivered", r.cells.delivered) && top[4] === formatCell("openRate", { ...r.cells.openRate, state: "tracked" }).replace(/ \(tracking unknown\)$/, "") && i >= 0; }) &&
        detail.rows.every((d) => wlRows.some((row) => row[0].startsWith(d.label.program) && row[2] === formatCell("delivered", d.cells.delivered))) && (wlHtml.match(/<tr class="gs-sub">/g) ?? []).length === detail.rows.length && !/All other accounts|No company link/.test(wlHtml) && !/churn/i.test(wlHtml) &&
        wlHtml.includes("Ranked over the whole window") && panelHtml(wl.html, "least-engaged").includes("possible bad contacts or disengagement") && panelHtml(wl.html, "most-bounced") !== null,
      [wlRows.slice(0, 4), ranked.rows.map((r) => [r.key.account, r.cells.delivered.value])]);
    check("the watch list over a narrower month range says it re-ranks the embedded rows (the pull selected the accounts over the whole window), and over a pull with accounts off each of the three lists shows the accounts-off notice",
      loadPage(wl.html).call(`app.renderPanel(app.panels.find((p) => p.id === "most-engaged"), app.stateFromHash("m=2026-07..2026-08"), null)`).includes("the pull selected these accounts over the whole window, so this is a re-ranking of the embedded rows") &&
        ["most-engaged", "least-engaged", "most-bounced"].every((id) => lacksIn(panelHtml(ADMIN_P.html, id)).join() === "accounts-off"));
    const wlCsv = parseCsv(loadPage(wl.html).call(`app.csvOf(app.panels.find((p) => p.id === "most-engaged"), app.defaultState(), null).text`));
    check("the cross-program watch list's export is its view (R27): one line per ranked account carrying how many programs touched it, then one per program underneath with the program's status, every figure the engine's own, in the drawn order",
      isDeepStrictEqual(wlCsv[0], ["Account", "Program", "Status", "Programs", ...most.query.metrics.flatMap((id) => (engine.metric(id).tracking ? [engine.metric(id).label, `${engine.metric(id).label} tracking`] : [engine.metric(id).label]))]) &&
        wlCsv.length === 1 + ranked.rows.length + detail.rows.length &&
        ranked.rows.every((r) => { const i = wlCsv.findIndex((line) => line[0] === r.label.account && line[1] === ""); const own = detail.rows.filter((d) => d.key.account === r.key.account); return i > 0 && wlCsv[i][3] === String(own.length) && wlCsv[i][4] === String(r.cells.delivered.value) && own.every((d, j) => wlCsv[i + 1 + j][0] === r.label.account && wlCsv[i + 1 + j][1] === d.label.program && wlCsv[i + 1 + j][3] === "" && wlCsv[i + 1 + j][4] === String(d.cells.delivered.value)); }),
      [wlCsv.slice(0, 5), most.query.metrics]);
    // Every panel of both presets renders, with no empty section and no unknown type.
    const sections = (html) => [...html.matchAll(/<section class="gs-panel" data-panel="([\w-]+)" data-type="([\w-]+)">([\s\S]*?)<\/section>/g)].map((m) => ({ id: m[1], type: m[2], body: m[3] }));
    check("every panel of the admin preset and of the leaders' preset renders over the signals pull, under its own type, each with a table, a chart or a notice (never a bare heading), and the download button on every panel that has rows",
      sections(ADMIN_P.html).map((s) => s.id).join() === presetPanels(SPEC_DEFAULTS.pages[0]).map((p) => p.id).join() && sections(EXEC_P.html).map((s) => s.id).join() === presetPanels(SPEC_DEFAULTS.pages[1]).map((p) => p.id).join() &&
        [...sections(ADMIN_P.html), ...sections(EXEC_P.html)].every((s) => /<table|<svg|gs-notice|gs-kpis/.test(s.body) && textOf(s.body).length > 20 && (/gs-notice/.test(s.body) && !/<table/.test(s.body) ? !s.body.includes("data-csv") : s.body.includes(`data-csv="${s.id}"`))),
      [sections(ADMIN_P.html).map((s) => s.id), sections(EXEC_P.html).map((s) => s.id)]);
    check("the leaders' preset over the signals pull: By group is the engine's rows by supergroup and group, the top and lowest ten carry Sent beside every rate (send-size context), and the page holds neither customer lists nor health panels",
      isDeepStrictEqual(rowsOf(panelHtml(EXEC_P.html, "by-group"), "thead")[0], ["Supergroup", "Group", "Sent", "Delivered", "Open rate"]) && rowsOf(panelHtml(EXEC_P.html, "by-group")).length === runQuery(gold, { recipientClass: "all", months: ["2026-06", "2026-07", "2026-08"] }, presetPanels(SPEC_DEFAULTS.pages[1]).find((p) => p.id === "by-group").query).rows.length &&
        isDeepStrictEqual(rowsOf(panelHtml(EXEC_P.html, "top-open-rate"), "thead")[0], ["Program", "Sent", "Open rate"]) && !EXEC_P.html.includes(`data-panel="most-engaged"`) && !EXEC_P.html.includes(`data-type="health-`));
  }

  // ══ The Health tab's views, over the signals pull ═════════════════════════
  {
    const gold = applyGroups(SIGNALS, SPEC.groups).snapshot;
    const ph = panelHtml(ADMIN_P.html, "program-health");
    const view = engine.healthSilentView(gold, { recipientClass: "all" }, { days: 45 });
    const alarmRows = anyRows(ph.split("<details")[0]).slice(1);
    check("program health (health-silent): the alarms the engine lists, longest silent first, each with its last send, days silent and the signal that put it there in words; the other lists collapsed with their counts (Active with no sends in this window, Finished, Cannot judge yet with why, Working as expected); the threshold chips 14 / 30 / 60 / 90 with the spec's own value (45) among them and on; judged as of the pull's day over the day window",
      view.rows.length === 6 && alarmRows.length === 6 && alarmRows.every((r, i) => r[0].startsWith(view.rows[i].name) && r[2] === String(view.rows[i].daysSilent)) && /Participant sync overdue: last synced 2026-08-20, due 2026-09-14/.test(ph) && /Admitting nobody: 0 participants over the last 5 due days/.test(ph) && /Only refused participants arriving/.test(ph) && /Schedule ended 2026-08-01/.test(ph) && /Participant sync disabled/.test(ph) && /Step errors this period: \d+ participants \(/.test(ph) &&
        ph.includes(`<summary>Active, no sends in this window (${view.counts["no-sends-in-window"]})</summary>`) && ph.includes(`<summary>Cannot judge yet (${view.counts["cannot-judge"]})</summary>`) && /Cannot judge yet: (fewer than three months|the knowledge base has no doc|the documented schedule ended)/.test(ph) && ph.includes(`<summary>Working as expected (${view.counts.ok})</summary>`) &&
        isDeepStrictEqual([...ph.matchAll(/data-act="hd" data-days="(\d+)" aria-pressed="(true|false)">/g)].map((m) => `${m[1]}:${m[2]}`), ["14:false", "30:false", "45:true", "60:false", "90:false"]) && ph.includes("Judged as of 2026-09-15 over the last 90 days of sends") && ph.includes(`data-csv="program-health"`) && /<tr title="schedule: [a-z-]+ · ingest: /.test(ph),
      [alarmRows, view.counts]);
    const at60 = adminP.call(`app.renderPanel(app.panels.find((p) => p.id === "program-health"), app.stateFromHash("hd=60"), null)`);
    check("the threshold is adjustable in the page (ruled 2026-10-04): the hash carries hd=60, the 60 chip is on, the view is the engine's at 60 days (fewer late sends than at 30), the spec's own value is the default and leaves the hash, a value not offered is dropped, and a value over the day window is never asked of the engine",
      /data-days="60" aria-pressed="true"/.test(at60) && adminP.call(`app.stateFromHash("hd=60").hd`) === 60 && adminP.call(`app.hashOf(app.stateFromHash("hd=60"))`) === "hd=60" && adminP.call(`app.hashOf(app.stateFromHash("hd=45"))`) === "" && adminP.call(`app.stateFromHash("hd=50").hd`) === null && adminP.call(`app.healthDayChoices`).join() === "14,30,45,60,90" &&
        engine.healthSilentView(gold, { recipientClass: "all" }, { days: 90 }).counts["no-recent-sends"] <= view.counts["no-recent-sends"] && HEALTH_DAY_OPTIONS.join() === "14,30,60,90" && adminP.call(`app.stateFromHash("hd=60").hd`) === 60);
    // A pull holding fewer days than the spec's threshold: the page offers only the thresholds the window holds and starts on the longest, never asking the engine for more days than it has.
    const shortWindow = structuredClone(SIGNALS);
    const [endY, endM, endD] = shortWindow.meta.health.dayWindow.endExclusive.split("-").map(Number);
    const endEx = Date.UTC(endY, endM - 1, endD);
    shortWindow.meta.health.dayWindow.start = new Date(endEx - 20 * 86400000).toISOString().slice(0, 10);
    const shortPage = build(SPEC_DEFAULTS, engine.openSnapshot(shortWindow));
    const shortApp = loadPage(shortPage.html);
    check("a threshold the pull cannot judge falls back: over a 20-day day window with the spec's 45-day threshold the page builds, offers 14 days alone, starts on it with the chip on, and a hash asking for 45 or 60 is dropped (the engine refuses a threshold over its window)",
      shortApp.call(`app.healthDayChoices`).join() === "14" && /data-days="14" aria-pressed="true"/.test(panelHtml(shortPage.html, "program-health")) && panelHtml(shortPage.html, "program-health").includes("over the last 20 days of sends") &&
        shortApp.call(`app.stateFromHash("hd=45").hd`) === null && shortApp.call(`app.stateFromHash("hd=60").hd`) === null && throwsWith(() => engine.healthSilentView(engine.openSnapshot(shortWindow), {}, { days: 45 }), /days/),
      [shortApp.call(`app.healthDayChoices`), shortWindow.meta.health.dayWindow]);
    const fr = panelHtml(ADMIN_P.html, "failure-reasons");
    const reasons = engine.healthReasonsView(gold, { recipientClass: "all" });
    const defOf = (id) => [...FIXTURE_BOUNCE_CATEGORIES, ...engine.FAILURE_CATEGORIES.participantFailures, ...engine.STEP_FAILURE_CATEGORIES].find((c) => c.id === id)?.definition;
    check("failure reasons (health-reasons): bounce categories each with its count this period, the usual a month and the change, the Other line with its share; every category's tooltip is its DEFINITION from the category table (never tenant text); expected failures (business rules) are behind a toggle, named on one line with their counts; refusals at entry as exact totals with the all-time figure's tooltip and the split labelled a sample; step failures by category",
      reasons.bounces.categories.every((c) => fr.includes(`${esc(c.label)} <span class="gs-mark gs-info" title="${esc(c.definition)}">`) && c.definition === defOf(c.id)) && fr.includes(`${Math.round(reasons.bounces.other.share * 100)}% of bounces`) && /<th scope="col" class="gs-num">Usual a month<\/th><th scope="col" class="gs-num">Change<\/th>/.test(fr) &&
        !fr.includes(`<td>${esc("Already in the participant list")}`) && /gs-note-expected">\d+ expected failure kinds? behind the toggle: .*Already in the participant list \d+/.test(fr) && /<input type="checkbox" data-f="he"> Show expected failures/.test(fr) &&
        fr.includes(`${reasons.entry.window.participants} participants refused in the 4 months shown (${reasons.entry.window.occurrences} refusals); all time ${reasons.entry.allTime.participants} <span class="gs-mark gs-info" title="${esc(reasonText("all-time"))}">`) && /<h4>By reason, a sample /.test(fr) && fr.includes("the totals above are exact, the split is not") &&
        reasons.steps.categories.filter((c) => !c.expected).every((c) => fr.includes(`${esc(c.label)} <span class="gs-mark gs-info" title="${esc(c.definition)}">`)) && fr.includes("needs investigation") && fr.includes(`data-csv="failure-reasons"`),
      [reasons.bounces.categories.map((c) => c.id), fr.match(/gs-note-expected">[^<]*/)?.[0]]);
    const shownExpected = adminP.call(`app.renderPanel(app.panels.find((p) => p.id === "failure-reasons"), app.stateFromHash("he=1"), null)`);
    check("the toggle shows the expected failures as their own rows (he=1 in the hash), kind 'business rule', and the hidden-line disappears",
      shownExpected.includes(`<td>${esc("Already in the participant list")} <span class="gs-mark gs-info"`) && /<td>business rule<\/td>/.test(shownExpected) && !shownExpected.includes("gs-note-expected") && /data-f="he" checked>/.test(shownExpected) && adminP.call(`app.hashOf(app.stateFromHash("he=1"))`) === "he=1");
    check("the 'Other' line is a SIGNAL (ruled 2026-10-05): when uncategorised bounces exceed a few percent the panel says so and names the terminal line that shows the masked samples (`health <slug> --program <id>`), with the copy button; when they do not, there is no signal",
      reasons.bounces.other.overThreshold === true && /data-signal="other"><p>Uncategorised bounce text is \d+% of bounces, over a few percent: the masked samples are in the terminal, never on a page\.<\/p>/.test(fr) && fr.includes(`<code>${esc(COPY_LINES.health("program-health", "<program id>"))}</code>`) && COPY_LINES.health("x", "p-1") === "node .gs-superadmin/plugin/scripts/dashboard.mjs health x --program p-1" &&
        (() => {
          const few = structuredClone(PULLED);
          for (const r of few.facts.health.bounceReasons) if (r.category !== "other") r.count = 500;
          const page = build(SPEC_DEFAULTS, few).html;
          return engine.healthReasonsView(few, {}).bounces.other.overThreshold === false && !panelHtml(page, "failure-reasons").includes('data-signal="other"') && panelHtml(page, "failure-reasons").includes("% of bounces");
        })(), fr.match(/data-signal="other">[\s\S]{0,300}/)?.[0]);
    const sch = panelHtml(ADMIN_P.html, "schedules");
    const schView = engine.healthSchedulesView(gold, { recipientClass: "all" }, { staleAfterDays: 45 });
    const stale20 = build(specWith((s) => { s.pages[0].panels = []; s.pages[0].statusDefault = null; s.pages[0].panels = presetPanels(s.pages[0]).map((p) => (p.id === "schedules" ? { ...p, knobs: { staleAfterDays: 20 } } : p)); }), SIGNALS);
    check("schedules (health-schedules): every kept program's schedule as the KB documents it with its as-of day; a row older than the dashboard's staleness threshold (freshness.maxAgeDays, 45) carries the stale badge, and a panel whose knob says 20 days marks more; a program with no KB doc says so in its row; sync disabled is badged",
      anyRows(sch).length === schView.rows.length + 1 && (sch.match(/gs-badge-stale/g) ?? []).length === schView.stale && sch.includes(`stale past 45 days before the pull of 2026-09-15 (${schView.stale} stale rows`) && sch.includes("no doc in the knowledge base") && /gs-badge-error">sync disabled</.test(sch) &&
        (panelHtml(stale20.html, "schedules").match(/gs-badge-stale/g) ?? []).length === engine.healthSchedulesView(gold, { recipientClass: "all" }, { staleAfterDays: 20 }).stale && engine.healthSchedulesView(gold, {}, { staleAfterDays: 20 }).stale > schView.stale && sch.includes(`data-csv="schedules"`),
      [schView.stale, (sch.match(/gs-badge-stale/g) ?? []).length]);
    const ot = panelHtml(ADMIN_P.html, "one-time");
    const otView = engine.healthOneTimeView(gold, { recipientClass: "all" }, { months: 6 });
    check("one-time and ad-hoc programs (health-one-time): the programs whose documented schedule does not recur, each with its last send, months with sends, templates and a mini bar chart of its last six months (tokens only), never called finished, and the programs whose schedule the pull does not have counted apart",
      anyRows(ot).length === otView.rows.length + 1 && otView.rows.length > 0 && otView.rows.every((r) => ot.includes(esc(r.name))) && (ot.match(/<svg class="gs-mini"/g) ?? []).length === otView.rows.length && ot.includes(`Last ${otView.historyMonths.length} months`) && /Never "finished"/.test(ot) && !/finished campaign/i.test(ot.replace(/Never "finished"/, "")) &&
        (otView.scheduleUnknown ? ot.includes(`${otView.scheduleUnknown} program${otView.scheduleUnknown === 1 ? " has" : "s have"} no schedule known to this pull`) : true) && ot.includes(`data-csv="one-time"`), [otView.rows.map((r) => r.programId), otView.scheduleUnknown]);
    check("the health views' CSVs export the view (R27): program health one row per judged program with its list and why, failure reasons one row per category with its table, schedules and one-time programs one row each; and the kpi and chart panels export the engine's rows",
      (() => {
        const csv = (id, hash = "") => parseCsv(adminP.call(`app.csvOf(app.panels.find((p) => p.id === ${JSON.stringify(id)}), app.stateFromHash(${JSON.stringify(hash)}), null).text`));
        const sil = csv("program-health");
        const fail = csv("failure-reasons");
        return isDeepStrictEqual(sil[0], ["Program", "Status", "List", "Last send", "Days silent", "Why"]) && sil.length === 1 + Object.values(view.counts).reduce((a, b) => a + b, 0) && sil.some((r) => r[2] === "Participant sync overdue") &&
          isDeepStrictEqual(fail[0], ["Table", "Reason", "Kind", "Expected", "Count", "Usual a month", "Change"]) && fail.some((r) => r[0] === "Bounce reasons" && r[1] === "Other") && fail.some((r) => r[0] === "Refused at entry (a sample)") && fail.some((r) => r[0] === "Step failures") &&
          csv("schedules")[0][0] === "Program" && csv("one-time")[0].includes("Templates") && isDeepStrictEqual(csv("headline")[0], ["Sent", "Delivered", "Opened", "Open rate", "Click rate", "Click rate tracking"]) && csv("open-rate-trend").length === 5 && csv("open-rate-trend")[0][0] === "Month";
      })());
  }

  // ══ The three tracking states, the notes beside click and response columns, Sent beside every rate ══
  {
    const spec = specWith((s) => { s.pages[0].panels = [{ id: "emails", tab: "engagement", type: "table", title: "Emails", query: { groupBy: ["template"], metrics: ["sent", "clicked", "clickRate", "openRate"] }, columns: ["clicked", "clickRate", "openRate"] }, ...SPEC.pages[0].panels.slice(1)]; s.pages[0].statusDefault = null; });
    const page = build(spec, PULLED);
    const html = panelHtml(page.html, "emails");
    const rows = anyRows(html);
    // The template cell carries the Text button that opens the template's drawer (TPL-2); its label is not the name.
    const byName = Object.fromEntries(rows.slice(1).map((r) => [r[0].replace(/ Text$/, ""), r]));
    const states = Object.fromEntries(Object.entries(PULLED.meta.metricAvailability.clicks.templates).map(([k, v]) => [k, v.state]));
    const nameOf = (id) => PULLED.dimensions.templates.find((t) => t.id === id).name;
    check("the three tracking states look different (R1b): a tracked template with no click shows a plain 0 and 0.0%; a not-tracked template shows the words 'Not tracked' in a muted label and no number; an unknown one shows the figure with the '(tracking unknown)' marker whose tooltip explains it",
      states["tpl-nps"] === "tracked" && byName[nameOf("tpl-nps")][2] === "0" && byName[nameOf("tpl-nps")][3] === "0.0%" && states["tpl-renew-b"] === "not-tracked" && byName[nameOf("tpl-renew-b")][2] === "Not tracked" && byName[nameOf("tpl-renew-b")][3] === "Not tracked" &&
        html.includes(`<span class="gs-not-tracked">Not tracked</span>`) && states["tpl-day7"] === "unknown" && /^\d+ \(tracking unknown\)$/.test(byName[nameOf("tpl-day7")][2]) && html.includes(`<span class="gs-mark gs-unknown" title="${esc(engine.caveatText("click-tracking-states"))}">(tracking unknown)</span>`),
      byName);
    check("Sent stands beside every rate (R2b): a panel that starts without it shows it anyway once a rate is shown, its column box is ticked and disabled with the reason, and a view that hides every rate may hide it",
      isDeepStrictEqual(rows[0], ["Email", "Sent", "Clicked", "Click rate", "Open rate"]) && /data-col="emails" value="sent" checked disabled title="Shown beside every rate">/.test(html) &&
        loadPage(page.html).call(`app.visibleCols(app.panels.find((p) => p.id === "emails"), { cols: { emails: ["clicked"] } })`).join() === "clicked" && loadPage(page.html).call(`app.visibleCols(app.panels.find((p) => p.id === "emails"), { cols: { emails: ["openRate"] } })`).join() === "sent,openRate", [rows[0], html.match(/data-col="emails" value="sent"[^>]*>/)?.[0]]);
    check("wherever a click column shows, the note that click tracking may not be enabled and that clicks count content links only (will not match the Gainsight UI, R18) stands under the table; wherever a response column shows, the survey-analytics caveat does (R20); a table with neither carries neither",
      html.includes(`<p class="gs-note gs-note-clicks">${esc(engine.caveatText("clicks-content-only"))} ${esc(engine.caveatText("click-tracking-states"))}</p>`) && panelHtml(ADMIN_P.html, "survey-responses").includes(`<p class="gs-note gs-note-responses">${esc(engine.caveatText("responses-program-level"))} ${esc(engine.caveatText("responses-all-time"))}</p>`) &&
        !panelHtml(ADMIN.html, "programs").includes("gs-note-clicks") && !panelHtml(ADMIN.html, "programs").includes("gs-note-responses") && !panelHtml(ADMIN_P.html, "survey-responses").includes("gs-note-clicks"));
    const survey = panelHtml(ADMIN_P.html, "survey-responses");
    check("an all-time figure carries a tooltip saying what all time means and why (ruled 2026-10-04): the survey participants and response rate cells on their all-time basis are marked; the program with a survey is the only row",
      /\(all time\)<\/span>/.test(survey) && survey.includes(`<span class="gs-mark" title="${esc(engine.caveatText("responses-all-time"))}">(all time)</span>`) && rowsOf(survey).length === 1 && rowsOf(survey)[0][0].startsWith("Acme NPS Survey"), rowsOf(survey));
  }

  // ══ The About tab (R26): generated from the registry, the spec and the snapshot ══
  {
    const about = paneHtml(ADMIN_P.html, "about");
    const execAbout = paneHtml(EXEC_P.html, "about");
    const used = [...new Set(presetPanels(SPEC_DEFAULTS.pages[0]).flatMap((p) => p.query?.metrics ?? []))];
    const entries = engine.glossary(used, SIGNALS);
    check("Definitions: every metric the page's panels show (the parts a rate divides included), from the metric registry, in registry order; on the admin page each shows its object, fields, standing filters, date field and calculation (the formula glossary, ruled 2026-10-03), none of that text written in the page's source as prose",
      entries.length > 10 && entries.every((e) => about.includes(`<dt data-metric="${e.id}">${esc(e.label)}</dt><dd>${esc(e.definition)}<ul class="gs-formula"><li data-part="object">Read from: <code>${esc(e.object)}</code></li><li data-part="fields">Counts: ${esc(e.fields)}</li><li data-part="filters">Filters on every count: ${esc(e.filters.length ? e.filters.join("; ") : "none")}</li><li data-part="dateField">Date field: ${esc(e.dateField)}</li><li data-part="calculation">Calculation: ${esc(e.calculation)}`)) &&
        [...about.matchAll(/<dt data-metric="(\w+)">/g)].map((m) => m[1]).join() === entries.map((e) => e.id).join() && entries.every((e) => !SOURCES.runtimeSource.includes(e.definition) && !readFileSync(BUILDER, "utf8").includes(e.definition) && !SOURCES.runtimeSource.includes(e.fields)) && about.includes(esc(engine.glossaryNotes(SIGNALS)[0])),
      entries.map((e) => e.id).filter((id) => !about.includes(`<dt data-metric="${id}">`)));
    check("the leaders' About keeps the plain definition and the formula only: no object, fields or filters, every metric shown still defined",
      !execAbout.includes("gs-formula") && !execAbout.includes("Read from:") && engine.glossary([...new Set(presetPanels(SPEC_DEFAULTS.pages[1]).flatMap((p) => p.query.metrics))], SIGNALS).every((e) => execAbout.includes(`<dt data-metric="${e.id}">${esc(e.label)}</dt><dd>${esc(e.definition)} <span class="gs-muted">Calculation: ${esc(e.calculation)}`)));
    // Change a spec value and a registry entry: the About text changes.
    const changedSpec = specWith((s) => { s.pages[0].panels = []; s.pages[0].statusDefault = null; s.freshness.maxAgeDays = 7; s.purpose = "A changed purpose."; });
    const changedAbout = paneHtml(build(changedSpec, SIGNALS).html, "about");
    const def = engine.metric("openRate").definition;
    const patched = loadPage(ADMIN_P.html.split(def).join("A CHANGED DEFINITION FOR THE TEST"));
    check("the About tab is generated from the asset, never hand-written: change a spec value and its sentence changes (freshness 7 days, a new purpose) while the rest stays; change a registry entry (the inlined engine's bytes) and the definition on the page changes with it",
      about.includes("more than 45 days old") && changedAbout.includes("more than 7 days old") && changedAbout.includes("A changed purpose.") && !about.includes("A changed purpose.") && about.split("<dd>").length === changedAbout.split("<dd>").length &&
        patched.call(`app.renderAbout()`).includes("A CHANGED DEFINITION FOR THE TEST") && !patched.call(`app.renderAbout()`).includes(def) && about.includes(esc(def)));
    const settings = describeSpec(SPEC_DEFAULTS);
    // One supergroup rule alone leaves most programs ungrouped at both levels.
    const sparse = specWith((x) => { x.pages[0].panels = []; x.pages[0].statusDefault = null; x.groups.rules = [x.groups.rules[0]]; x.groups.overrides = {}; });
    const sparseAbout = paneHtml(build(sparse, SIGNALS).html, "about");
    const sparseExecAbout = paneHtml(build(sparse, SIGNALS, "exec").html, "about");
    check("This dashboard's settings: the spec's own description (describeSpec), every setting with its sentences, each group rule with the count it matched and a rule that matched nothing flagged, the Ungrouped bucket prominent on the admin page with the programs named, and whether accounts were pulled",
      settings.every((d) => about.includes(`<dt>${esc(d.label)}</dt>`)) && about.includes(esc(settings.find((d) => d.label === "Silent programs").text[0])) && /<ol><li data-rule-matched="\d+">Supergroup &quot;Surveys&quot;: programs that send a survey\. Matched \d+ programs?\.<\/li>/.test(about) && paneHtml(build(specWith((s) => { s.pages[0].panels = []; s.pages[0].statusDefault = null; s.groups.rules.push({ kind: "manual", level: "group", programIds: ["p-ghost"], label: "Ghost" }); }), PULLED).html, "about").includes(`<li data-rule-matched="0">Group &quot;Ghost&quot;: 1 program(s) picked by hand. <strong class="gs-no-match">Matched nothing.</strong></li>`) && !about.includes("gs-no-match") &&
        about.includes(`<p class="gs-ungrouped">Every program is grouped.</p>`) && /<p class="gs-ungrouped is-prominent"><strong>Ungrouped: \d+ programs?<\/strong>: Acme [^<]*\.<\/p>/.test(sparseAbout) && !/is-prominent/.test(sparseExecAbout) && /<p class="gs-ungrouped"><strong>Ungrouped: \d+ programs?<\/strong>\.<\/p>/.test(sparseExecAbout) && about.includes(esc(reasonText("accounts-off"))),
      about.match(/<ol>[\s\S]*?<\/ol>/)?.[0]);
    const domain = "acme.com";
    const link = "www.acme.com/mail-settings";
    check("on a page with sourceDetail off the recipients sentences keep their meaning and DROP the internal-domain and unsubscribe-link values (ruled 2026-10-05): the leaders' About names neither value, its embedded parameters carry neither, and the admin About carries both",
      !execAbout.includes(domain) && !execAbout.includes(link) && execAbout.includes("Addresses at the company&#39;s own 1 email domain are internal.") && execAbout.includes("Clicks on the tenant&#39;s own 1 unsubscribe link are unsubscribe clicks, not content clicks.") &&
        execP.call(`app.snapshot.meta.params.internalDomains`).length === 0 && execP.call(`app.snapshot.meta.params.unsubscribeLinks`).length === 0 && execP.call(`app.snapshot.meta.params.redactedOnPage`).join() === "internalDomains,unsubscribeLinks" && !EXEC_P.html.includes(link) &&
        about.includes(`Addresses at ${domain} are internal.`) && about.includes(link) && adminP.call(`app.snapshot.meta.params.internalDomains`).join() === domain && isDeepStrictEqual(aboutSettings(SPEC_DEFAULTS, SPEC_DEFAULTS.pages[0]).map((d) => d.text), describeSpec(SPEC_DEFAULTS).map((d) => d.text)),
      [execAbout.match(/own[^<]*/g)]);
    check("Where the data came from, Caveats and How to refresh: the pull's time, tenant, window, provisional start, refresh mode, step detail, accounts, health and versions from the snapshot's meta; the caveats block from the engine with the health caveats because the Health tab is on (and without them on the leaders' page); the refresh line as the entry command on the admin page, a sentence on the leaders' page; the How to use section names what this page offers",
      about.includes("<dt>Pulled at</dt><dd>2026-09-15T09:00:00-07:00</dd>") && about.includes("<dt>Tenant</dt><dd>acme.gainsightcloud.com</dd>") && about.includes("<dt>Health data</dt><dd>pulled, judged as of 2026-09-15</dd>") && /<dt>Versions<\/dt><dd>CLI [^<]*, plugin [^<]*, snapshot schema 1<\/dd>/.test(about) &&
        about.includes(`<li data-caveat="schedules-from-kb">`) && !execAbout.includes(`<li data-caveat="schedules-from-kb">`) && execAbout.includes(`<li data-caveat="incomplete-period">`) && engine.caveatsFor(SIGNALS, used, { health: true }).every((c) => about.includes(`<li data-caveat="${c.id}">${esc(c.text)}</li>`)) &&
        about.includes(`<h2>How to refresh</h2><p>Run <code>${esc(COPY_LINES.refresh("program-health"))}</code> from the workspace, with a gs-admin login; the /gs-superadmin:email-engagement skill runs the same command.</p>`) && execAbout.includes("An admin refreshes this page every month") && !execAbout.includes("dashboard.mjs") &&
        about.includes("<h2>How to use this page</h2>") && about.includes("the no-send threshold has buttons (14, 30, 45, 60, 90 days)") && !execAbout.split("<h2>How to use this page</h2>")[1].split("</section>")[0].includes("no-send threshold") && about.includes(`&quot;${engine.NOT_TRACKED}&quot; means no link in the email is click-tracked`),
      about.match(/<h2>Where the data came from<\/h2>[\s\S]*?<\/dl>/)?.[0]);
    check("a caveats footer is on every page, every tab: the same caveats block, collapsed, under the panes", [ADMIN, EXEC, ADMIN_P, EXEC_P].every((b) => /<footer class="gs-foot"><details class="gs-caveats-foot"><summary>Caveats \(\d+\)<\/summary><ul class="gs-caveats">/.test(b.html)) && (markupOf(ADMIN_P.html).match(/<ul class="gs-caveats">/g) ?? []).length === 2);
  }

  // ══ The stale banner ═══════════════════════════════════════════════════════
  {
    const app = createDashboard(engine, pageModel(SPEC_DEFAULTS, GOLD, SPEC_DEFAULTS.pages[0]));
    const fresh = app.renderStale();
    app.setClock(() => Date.parse("2026-10-01T00:00:00Z"));
    const within = app.renderStale();
    app.setClock(() => Date.parse("2026-12-01T00:00:00Z"));
    const stale = app.renderStale();
    check("a stale banner shows once the data is past the spec's freshness (45 days), read from a clock the page gets at mount: in Node, with no clock, the pre-render carries an empty region; 16 days after the pull nothing; 77 days after, the banner with the age, the cadence and the threshold, and the refresh line on an admin page",
      fresh === "" && ADMIN_P.html.includes(`<div data-region="stale"></div>`) && within === "" && /<div class="gs-banner gs-banner-stale" role="status" data-banner="stale">Stale: this data was pulled 76 days ago\. The dashboard is refreshed every month and is stale after 45 days\. <code>node \.gs-superadmin\/plugin\/scripts\/dashboard\.mjs refresh program-health<\/code><\/div>/.test(stale) &&
        !createDashboard(engine, { ...pageModel(SPEC_DEFAULTS, GOLD, SPEC_DEFAULTS.pages[1]), actions: null }).renderStale().includes("gs-banner"), stale);
    const execApp = createDashboard(engine, pageModel(SPEC_DEFAULTS, GOLD, SPEC_DEFAULTS.pages[1]));
    execApp.setClock(() => Date.parse("2026-12-01T00:00:00Z"));
    check("on a leaders' page the stale banner carries no command", execApp.renderStale().includes("Stale: this data was pulled 76 days ago") && !execApp.renderStale().includes("dashboard.mjs"));
  }

  // ══ Column show and hide (R1) ═════════════════════════════════════════════
  {
    const app = createDashboard(engine, pageModel(SPEC, GOLD, SPEC.pages[0]));
    const panel = app.panels[0];
    const heads = (ui) => rowsOf(panelHtml(`<section class="gs-pane">${app.renderPanel(panel, app.defaultState(), ui)}`, "programs"), "thead")[0];
    const toggles = [...panelHtml(ADMIN.html, "programs").matchAll(/data-col="programs" value="(\w+)"( checked)?( disabled[^>]*)?>/g)].map((m) => m[1] + (m[2] ?? ""));
    check("every table lets a viewer show or hide any column: the panel starts on the columns its spec names, the list offers every metric of its query, and a viewer's choice replaces the start (Sent stays while a rate shows)",
      isDeepStrictEqual(heads(null), ["Program", "Sent", "Open rate"]) && isDeepStrictEqual(toggles, ["sent checked", "uniqueRecipients", "delivered", "opened", "openRate checked"]) &&
        isDeepStrictEqual(heads({ cols: { programs: ["opened", "sent", "not-a-metric"] } }), ["Program", "Sent", "Opened"]) && isDeepStrictEqual(heads({ cols: { programs: [] } }), ["Program"]) && isDeepStrictEqual(heads({ cols: { programs: ["openRate"] } }), ["Program", "Sent", "Open rate"]), [heads(null), toggles]);
    // In a browser: listeners, storage and the address, against a stand-in document.
    const drive = (storage, hash = "") => {
      const listeners = {};
      const boxes = [{ value: "PROCESSING", checked: true }, { value: "PAUSE", checked: true }, { value: "NEW", checked: false }].map((b) => ({ ...b, getAttribute: (n) => (n === "data-f" ? "status" : null) }));
      const painted = {};
      const root = {
        disabled: true, innerHTML: null,
        addEventListener: (type, fn) => { listeners[type] = fn; },
        querySelectorAll: (sel) => (sel === '[data-f="status"]' ? boxes : sel === "[data-col]" ? [{ value: "opened", checked: true, getAttribute: () => "programs" }, { value: "sent", checked: false, getAttribute: () => "programs" }] : []),
        querySelector: (sel) => { const name = sel.match(/data-region="(\w+)"/)?.[1]; return name ? { set innerHTML(v) { painted[name] = v; } } : null; },
      };
      const replaced = [];
      const g = { document: {}, localStorage: storage, location: { hash }, history: { replaceState: (a, b, url) => replaced.push(url) }, addEventListener: () => {}, Date: { now: () => Date.parse("2026-09-20T00:00:00Z") } };
      mount(app, root, g);
      return { root, listeners, boxes, painted, replaced };
    };
    const blocked = { getItem: () => { throw new Error("storage is blocked"); }, setItem: () => { throw new Error("storage is blocked"); } };
    const a = drive(blocked);
    check("a browser that blocks storage still gets a working page: reading and writing the column choice are both wrapped, nothing throws, the pre-render is left as it is and the controls are switched on; the stale region is painted from the browser's clock (fresh here)",
      a.root.disabled === false && a.root.innerHTML === null && a.painted.stale === "" && (a.listeners.change({ target: { getAttribute: (n) => (n === "data-col" ? "programs" : null) } }), /<th scope="col" class="gs-num">Opened<\/th>/.test(panelHtml(a.painted.panes, "programs")) && !/class="gs-num">Sent<\/th>/.test(panelHtml(a.painted.panes, "programs"))), a.painted.panes?.slice(0, 200));
    const kept = new Map();
    const b = drive({ getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, v) });
    b.listeners.change({ target: { getAttribute: (n) => (n === "data-col" ? "programs" : null) } });
    const c = drive({ getItem: (k) => kept.get(k) ?? null, setItem: () => {} });
    check("the column choice is remembered per viewer, per dashboard, page and table, and is drawn when the page is opened again; a stored value that is not a list is ignored",
      isDeepStrictEqual([...kept], [[`gs-dashboard.program-health.admin.programs.columns`, `["opened"]`]]) && /class="gs-num">Opened<\/th>/.test(panelHtml(c.root.innerHTML, "programs")) && !/class="gs-num">Sent<\/th>/.test(panelHtml(c.root.innerHTML, "programs")) &&
        drive({ getItem: () => `{"not":"a list"}`, setItem: () => {} }).root.innerHTML === null, [...kept]);
    b.listeners.change({ target: { getAttribute: (n) => (n === "data-f" ? "status" : null) } });
    check("changing a filter redraws the views and the summary and rewrites the address in place, with no navigation: two status boxes ticked become that state's hash",
      isDeepStrictEqual(b.replaced, ["#s=PROCESSING,PAUSE"]) && b.painted.summary.includes("0 programs hidden by status") && rowsOf(panelHtml(b.painted.panes, "programs")).length === 5, [b.replaced, b.painted.summary]);
    const d = drive({ getItem: () => null, setItem: () => {} }, "#s=all&t=about");
    check("a page opened on a hash draws that state at once, in place of the pre-render",
      typeof d.root.innerHTML === "string" && d.root.innerHTML.includes("showing every status") && /data-pane="about">/.test(d.root.innerHTML) && /data-pane="engagement" hidden>/.test(d.root.innerHTML));
    const appAll = createDashboard(engine, pageModel(SPEC_DEFAULTS, GOLD, SPEC_DEFAULTS.pages[0]));
    const e = (() => { const listeners = {}; const painted = {}; const replaced = []; const root = { disabled: true, innerHTML: null, addEventListener: (type, fn) => { listeners[type] = fn; }, querySelectorAll: () => [], querySelector: (sel) => { const name = sel.match(/data-region="(\w+)"/)?.[1]; return name ? { set innerHTML(v) { painted[name] = v; } } : null; } }; mount(appAll, root, { document: {}, localStorage: { getItem: () => null, setItem: () => {} }, location: { hash: "" }, history: { replaceState: (a, b, url) => replaced.push(url) }, addEventListener: () => {} }); return { listeners, painted, replaced }; })();
    e.listeners.click({ target: { closest: () => ({ hasAttribute: (n) => n === "data-act", getAttribute: (n) => (n === "data-act" ? "running" : null) }) } });
    check("the 'Running now' preset and the health controls are wired: a click on Running now narrows the state to Active programs and rewrites the address", isDeepStrictEqual(e.replaced, ["#s=PROCESSING"]) && e.painted.summary.includes("showing Active"));
    const src = SOURCES.runtimeSource;
    check("storage is touched in one place only, inside try and catch: the two calls in the runtime sit in the store that wraps them",
      src.split("localStorage").length === 3 + src.split("in localStorage").length - 1 && /try \{\s*const v = g\.localStorage\.getItem\(key\);[\s\S]{0,80}\} catch \{/.test(src) && /try \{\s*g\.localStorage\.setItem\(key, JSON\.stringify\(value\)\);\s*\} catch \{/.test(src));
  }

  // ══ Download CSV (R27) ════════════════════════════════════════════════════
  {
    const hash = "m=2026-07..2026-08&px=p-pilot&s=all&rc=external";
    /** @type {any} */
    const filters = { recipientClass: "external", months: ["2026-07", "2026-08"], programs: GOLD.dimensions.programs.map((p) => p.id).filter((id) => id !== "p-pilot") };
    const panel = SPEC.pages[0].panels[0];
    const out = admin.call(`app.csvOf(app.panels.find((p) => p.id === "programs"), app.stateFromHash(${JSON.stringify(hash)}), { cols: { programs: ["sent", "delivered", "openRate"] } })`);
    const expected = runQuery(GOLD, filters, panel.query);
    const table = parseCsv(out.text);
    check("an export of a filtered view equals the engine's rows for that view: one line per row, every row, in the engine's order, each figure the engine's own (a rate as a fraction, an absent value blank), under the visible columns only",
      isDeepStrictEqual(table[0], ["Program", "Status", "Sent", "Delivered", "Open rate"]) && table.length === expected.rows.length + 1 && expected.rows.length === 4 &&
        expected.rows.every((r, i) => isDeepStrictEqual(table[i + 1], [r.label.program, r.label.statuses.map(engine.statusLabel).join(", "), String(r.cells.sent.value), String(r.cells.delivered.value), r.cells.openRate.value == null ? "" : String(Number(r.cells.openRate.value.toFixed(4)))])),
      [table, expected.rows.map((r) => r.cells.openRate)]);
    check("the file's name carries the dashboard, the page, the table and when the data was pulled (R4)", out.filename === "program-health-admin-programs-20260915T0900.csv", out.filename);
    const clickPanel = { ...panel, query: { ...panel.query, metrics: ["sent", "clickRate"] }, columns: undefined };
    const clickApp = createDashboard(engine, pageModel(SPEC, GOLD, SPEC.pages[0]));
    const clicks = parseCsv(clickApp.csvOf(clickPanel, { ...clickApp.defaultState(), statuses: null }, null).text);
    const clickRows = runQuery(GOLD, { recipientClass: "all" }, clickPanel.query).rows;
    check("a metric with a tracking state exports the state beside the figure, so a blank is never read as a zero: each row's click rate rides with tracked, not-tracked or unknown",
      isDeepStrictEqual(clicks[0], ["Program", "Status", "Sent", "Click rate", "Click rate tracking"]) && clickRows.every((r, i) => clicks[i + 1][4] === r.cells.clickRate.state && (r.cells.clickRate.value == null) === (clicks[i + 1][3] === "")) && new Set(clicks.slice(1).map((r) => r[4])).size > 1, clicks);
    check("a table with nothing to export has no file: over a pull with accounts off the account table's export is null, and its section has no button to press",
      loadPage(OFF_ADMIN.html).call(`app.csvOf(app.panels.find((p) => p.id === "accounts"), app.defaultState(), null)`) === null && !panelHtml(OFF_ADMIN.html, "accounts").includes("data-csv"));
    check("the ONE CSV builder neutralises what a spreadsheet would run: a text cell starting with =, +, -, @, a tab or a carriage return gets a leading apostrophe; a number is written as a number, a negative one included; quotes, commas and line breaks are quoted",
      isDeepStrictEqual(["=1+1", "+1", "-1", "@x", "\tx", "\rx", "safe=1", " =1"].map(csvCell), ["'=1+1", "'+1", "'-1", "'@x", "'\tx", `"'\rx"`, "safe=1", " =1"]) && csvCell(-5) === "-5" && csvCell(0.6667) === "0.6667" && csvCell(null) === "" && csvCell(NaN) === "" &&
        csvCell(`=HYPERLINK("x","y")`) === `"'=HYPERLINK(""x"",""y"")"` && csvText(["a", "b"], [["1,2", "x\ny"]]) === `a,b\r\n"1,2","x\ny"\r\n`);
    check("every panel with rows has the button and there is one builder behind them all: each drawn panel has exactly one Download CSV button when it has a table or a chart and none when it is a notice, and the runtime joins cells with a comma in one place",
      [...ADMIN_P.html.matchAll(/<section class="gs-panel" data-panel="([\w-]+)"[^>]*>[\s\S]*?<\/section>/g)].every((m) => (m[0].match(/data-csv="/g) ?? []).length === (/<table|<svg class="gs-chart"|gs-kpis/.test(m[0]) ? 1 : 0)) && (ADMIN_P.html.match(/>Download CSV</g) ?? []).length >= 10 && SOURCES.runtimeSource.split("csvText(").length === 2 && SOURCES.runtimeSource.split("new g.Blob(").length === 2 && SOURCES.runtimeSource.includes("text: csvText(headers, rows)"));
  }

  // ══ Hostile names render inert ════════════════════════════════════════════
  {
    const LS = String.fromCharCode(0x2028);
    const hostile = structuredClone(PULLED);
    const evil = [`</script><script>alert(1)</script>`, `"><img src=x onerror=alert(1)>`, `=HYPERLINK("x","y")`, `+1 & 'quoted' ${LS}<!-- `, `<b>bold</b>`];
    hostile.dimensions.programs.forEach((p, i) => { p.name = evil[i]; });
    hostile.dimensions.accounts[0].name = `@SUM(1)<i>`;
    hostile.dimensions.accounts[1].name = `\t<svg onload=alert(1)>`;
    const spec = specWith((s) => {
      s.title = `Acme <u>title</u> & "more"`;
      s.pages[0].title = `<em>Admin</em>`;
      s.pages[0].panels[0].title = `<h1>Programs</h1>`;
      s.pages[0].panels.push({ ...accountPanels[1] });
      s.groups.overrides["p-pilot"] = { supergroup: `<a href=x>sg</a>`, group: `<script>g</script>` };
    });
    const built = build(spec, hostile);
    const html = built.html;
    const loaded = loadPage(html);
    const markup = html.replace(/<script type="module">\n[\s\S]*?<\/script>/g, "").replace(/<script type="application\/json" id="gs-data">[\s\S]*?<\/script>/, "").replace(/<style>[\s\S]*?<\/style>/, "");
    check("a hostile name cannot end the page's script or start another: the file still has exactly its three script elements, and the embedded data holds no angle bracket, ampersand or line separator at all",
      (html.match(/<script/g) ?? []).length === 3 && (html.match(/<\/script>/g) ?? []).length === 3 && !/[<>&]/.test(loaded.data) && !loaded.data.includes(LS) && loaded.scripts.length === 2);
    check("a hostile name renders inert: outside the page's own scripts no tag, attribute or comment a tenant string asked for exists; each is there as text (the chart titles, the About tab and the health views included)",
      !/<script|<img|<b>|<i>|<u>|<em>|<h1>Programs|<a href|<!--|onerror=alert\(1\)>|onload=/.test(markup.replace(/&lt;[\s\S]*?&gt;/g, "")) && !/<(img|b|i|u|em|a|script)[\s>]/.test(markup) && !/<svg[^>]*onload/.test(markup) &&
        evil.every((name) => markup.includes(esc(name))) && markup.includes(esc(`<h1>Programs</h1>`)) && markup.includes(esc(`<script>g</script>`)) && html.includes(`<title>Acme &lt;u&gt;title&lt;/u&gt; &amp; "more" · &lt;em&gt;Admin&lt;/em&gt;</title>`),
      markup.match(/<(img|b|i|u|em|a|script)[\s>].{0,40}/)?.[0]);
    check("and nothing is lost to the escaping: the page reads every hostile name back exactly as the snapshot holds it",
      isDeepStrictEqual(loaded.call(`app.snapshot.dimensions.programs.map((p) => p.name)`), evil) && loaded.call(`app.snapshot.dimensions.accounts[1].name`) === hostile.dimensions.accounts[1].name && loaded.call(`app.model.title`) === spec.title);
    const csv = parseCsv(loaded.call(`app.csvOf(app.panels.find((p) => p.id === "programs"), { ...app.defaultState(), statuses: null }, null).text`)).slice(1).map((r) => r[0]);
    const accountsCsv = parseCsv(loaded.call(`app.csvOf(app.panels.find((p) => p.id === "accounts"), { ...app.defaultState(), statuses: null }, null).text`)).slice(1).map((r) => r[0]);
    check("a hostile name exports neutralised: the formula-shaped program and account names arrive in the CSV with a leading apostrophe, and the others arrive unchanged",
      csv.includes(`'=HYPERLINK("x","y")`) && csv.includes(`'+1 & 'quoted' ${LS}<!-- `) && csv.includes(evil[0]) && csv.includes(evil[4]) && accountsCsv.includes(`'@SUM(1)<i>`) && accountsCsv.includes(`'\t<svg onload=alert(1)>`) && !csv.some((c) => /^[=+\-@\t\r]/.test(c)) && !accountsCsv.some((c) => /^[=+\-@\t\r]/.test(c)), [csv, accountsCsv]);
    check("a hostile name never reaches the address: the hash of a state that selects those programs holds their ids and nothing else", /^[A-Za-z0-9=&.,%_-]+$/.test(loaded.call(`app.hashOf(app.clean({ ...app.defaultState(), programs: ["p-nps", "p-pilot"], sg: 0 }))`)));
    check("every tenant string reaches the page through the one escaper: it turns the five characters that could change markup into entities",
      esc(`<a b="c" d='e'>&`) === "&lt;a b=&quot;c&quot; d=&#39;e&#39;&gt;&amp;" && esc(null) === "" && esc(5) === "5");
    // The health views over hostile names: the signals pull with every program renamed.
    const hostileHealth = structuredClone(SIGNALS);
    hostileHealth.dimensions.programs.forEach((p, i) => { p.name = evil[i % evil.length] + i; });
    for (const r of hostileHealth.facts.health.lastSends) r.name = evil[0];
    const hh = markupOf(build(SPEC_DEFAULTS, hostileHealth).html).replace(/<script type="application\/json" id="gs-data">[\s\S]*?<\/script>/, "").replace(/<style>[\s\S]*?<\/style>/, "");
    check("the health views render a hostile program name inert too", !/<script|<img|onerror=/.test(hh.replace(/&lt;[\s\S]*?&gt;/g, "")) && hh.includes(esc(evil[0])));
  }

  // ══ No network request, no dependency ═════════════════════════════════════
  {
    const pages = { admin: ADMIN.html, exec: EXEC.html, off: OFF_ADMIN.html, adminPreset: ADMIN_P.html, execPreset: EXEC_P.html };
    const bad = NO_NETWORK;
    check("a page asks the network for nothing: no http(s):// source appears anywhere in it (a link named as TEXT on the About tab is not a source), and it holds no call, tag or style that could fetch, load, import or post",
      Object.values(pages).every((h) => !bad.test(h)) && bad.test(`<img src="x">`) && bad.test("fetch (x)") && bad.test(`import("x")`) && bad.test(`href="https://x"`) && bad.test("url(https://x)") && !bad.test("Clicks on https://www.acme.com/x are unsubscribe clicks"), Object.entries(pages).map(([k, h]) => [k, h.match(bad)?.[0]]));
    check("and it ran that way: every page above was loaded and queried in a context that has no fetch, no XMLHttpRequest, no timers and no Node globals, with only its own embedded data to read",
      admin.call(`[typeof fetch, typeof XMLHttpRequest, typeof process, typeof require, typeof setTimeout]`).join() === "undefined,undefined,undefined,undefined,undefined" && admin.call(`app.snapshot.dimensions.programs.length`) === 5 && adminP.call(`app.snapshot.dimensions.programs.length`) === SIGNALS.dimensions.programs.length);
    check("the export makes no request either: the file is a Blob the page builds from its embedded data and hands to the browser to save",
      /new g\.Blob\(\[BOM \+ out\.text\]/.test(SOURCES.runtimeSource) && /a\.download = out\.filename/.test(SOURCES.runtimeSource) && /createObjectURL/.test(SOURCES.runtimeSource));
  }

  // ══ The embedded data ═════════════════════════════════════════════════════
  {
    const trips = [];
    for (const [name, snapshot, spec, pageIndex] of /** @type {Array<[string, any, any, number]>} */ ([["admin", GOLD, SPEC_ACCOUNTS, 0], ["exec", GOLD, SPEC_ACCOUNTS, 1], ["accounts off", applyGroups(OFF, SPEC.groups).snapshot, SPEC, 0], ["no domain", applyGroups(NO_DOMAIN, SPEC.groups).snapshot, SPEC, 0], ["signals", applyGroups(SIGNALS, SPEC.groups).snapshot, SPEC_DEFAULTS, 0]])) {
      const model = plain(pageModel(spec, snapshot, spec.pages[pageIndex]));
      if (!isDeepStrictEqual(unpackSnapshot(model.snapshot), plain(pageSnapshot(snapshot, spec.pages[pageIndex])))) trips.push(name);
    }
    check("the embedded data unpacks to exactly the snapshot the page was given: every dimension, every fact table of every grain and every health table, after a trip through JSON, on five pages", trips.length === 0, trips);
    const data = pageModel(SPEC_ACCOUNTS, GOLD, SPEC_ACCOUNTS.pages[0]).snapshot;
    const t = data.facts.byTemplate;
    check("the data is embedded compactly, one fact table per grain: each table is columns, not rows; ids, months and other text go through a dictionary that names each value once; measures are plain lists of numbers",
      ["byTemplate", "byStep", "byAccount", "responses", "responseParticipants", "uniques"].every((k) => typeof data.facts[k].n === "number" && !Array.isArray(data.facts[k])) && t.n === PULLED.facts.byTemplate.length &&
        isDeepStrictEqual([...t.c.programId.d].sort(), [...new Set(PULLED.facts.byTemplate.map((r) => r.programId))].sort()) && t.c.programId.i.length === t.n && t.c.programId.i.every(Number.isInteger) && t.c.month.d.length <= 4 &&
        Array.isArray(t.c.sent) && t.c.sent.every((v) => typeof v === "number") && data.facts.byAccount.c.accountKey.i.includes(-1) && isDeepStrictEqual(Object.keys(data.facts.uniques.c.external.o), ["people", "accounts", "participantRecords"]),
      Object.keys(t.c));
    const account = data.facts.byAccount;
    const buckets = new Set(unpackTable(account).map((r) => r.bucket));
    check("the account table holds each program's selected accounts plus the 'all other accounts' and 'no company link' rows (R24), so its totals stay exact: per program its rows add up to the program's own sent",
      buckets.has("account") && buckets.has("other") && buckets.has("no-company-link") &&
        GOLD.dimensions.programs.every((p) => runQuery(unpackSnapshot(plain(data)), { programs: [p.id] }, { groupBy: ["account"], metrics: ["sent"] }).total.cells.sent.value === runQuery(GOLD, { programs: [p.id] }, { groupBy: [], metrics: ["sent"] }).total.cells.sent.value));
    const ragged = [{ a: "x", n: 1 }, { a: null, n: 2, extra: { k: 1 } }, { a: "x", n: 3, extra: null, list: ["p", "q"] }];
    check("packing is lossless on awkward rows too: a null, a key only some rows have, a nested object, a nested list and an empty table all come back as they went in",
      isDeepStrictEqual(unpackTable(plain(packTable(ragged))), ragged) && isDeepStrictEqual(unpackTable(packTable([])), []) && isDeepStrictEqual(Object.keys(unpackTable(plain(packTable(ragged)))[0]), ["a", "n"]), unpackTable(plain(packTable(ragged))));
    const odd = { ...GOLD, facts: { ...GOLD.facts, extra: null, flags: [1, 2], nested: { note: "x", rows: GOLD.facts.responses } }, dimensions: { ...GOLD.dimensions, note: 5 } };
    check("a member of the snapshot that is not a table is carried as it is: a null, a number, a list of plain values and a nested group all come back unchanged (an additive field never breaks a build)",
      isDeepStrictEqual(unpackSnapshot(plain(pageModel(SPEC, /** @type {any} */ (odd), SPEC.pages[0]).snapshot)), plain(pageSnapshot(/** @type {any} */ (odd), SPEC.pages[0]))), Object.keys(pageModel(SPEC, /** @type {any} */ (odd), SPEC.pages[0]).snapshot.facts));
    check("a page built by another version of the builder is refused by the runtime, loudly, rather than drawn wrong",
      throwsWith(() => createDashboard(engine, { ...pageModel(SPEC, GOLD, SPEC.pages[0]), v: PAGE_MODEL_VERSION + 1 }), new RegExp(`reads version ${PAGE_MODEL_VERSION} — build the page again`)) && throwsWith(() => createDashboard(engine, { ...pageModel(SPEC, GOLD, SPEC.pages[0]), snapshot: { ...pageModel(SPEC, GOLD, SPEC.pages[0]).snapshot, schemaVersion: 2 } }), /T-10/));
    // Aggregates only on a page (Z7, ruled 2026-10-05): the health share of a page is bounded.
    const healthBytes = (report) => Object.entries(report.tables).filter(([k]) => k.startsWith("health.")).reduce((s, [, t]) => s + t.bytes, 0);
    const text = structuredClone(SIGNALS);
    text.facts.health.bounceReasons = Array.from({ length: 40000 }, (_, i) => ({ ...SIGNALS.facts.health.bounceReasons[0], message: `550 5.1.1 <email>: user unknown, reference <number>, incident ${i} of the day on a long line of text`, category: null, count: 1 }));
    text.facts.health.failureSamples = Array.from({ length: 5000 }, (_, i) => ({ programId: "p-nps", part: "bounceReasons", message: `sample text number ${i} with a long masked tail <email> <id>`, category: "unclassified", kind: "unknown", count: 1 }));
    const textPage = build(SPEC_DEFAULTS, text);
    check("a page embeds the health AGGREGATES only (ruled 2026-10-05): the categorised rows, the counted remainders, states, last sends, schedules, admissions, entry and step failures and the category samples — never every distinct message and never the sample table. Forty thousand distinct bounce messages fold into the per-key Other rows, five thousand samples into none, and the health share of the admin page over the signals pull stays under the bound",
      textPage.report.rows["health.bounceReasons"] < 100 && textPage.report.rows["health.failureSamples"] === undefined && !textPage.html.includes("sample text number") && !textPage.html.includes("incident 7 of the day") && healthBytes(ADMIN_P.report) / ADMIN_P.report.bytes.data < 0.6 && healthBytes(ADMIN_P.report) < 0.2 * MB &&
        loadPage(textPage.html).call(`app.snapshot.facts.health.bounceReasons.every((r) => r.category != null)`) === true, [textPage.report.rows, healthBytes(ADMIN_P.report), ADMIN_P.report.bytes.data]);
  }

  // ══ Several hundred programs ══════════════════════════════════════════════
  {
    const many = generated({ programs: 400 });
    const started = Date.now();
    const built = build(SPEC, many);
    const page = loadPage(built.html);
    const took = Date.now() - started;
    const labels = (page.prerender.match(/<label class="gs-prog">/g) ?? []).length;
    const names = [...many.dimensions.programs].map((p) => p.name).sort();
    const hits = page.call(`app.programMatches("renewal 00")`);
    const listedNames = page.call(`app.programs.map((p) => p.name)`);
    check("the program list handles several hundred programs: all 400 are in the list, in name order, each with its badges, and the page builds, loads and answers in seconds",
      labels === 400 && isDeepStrictEqual(listedNames, names) && (page.prerender.match(/<span class="gs-badge">Active<\/span>/g) ?? []).length >= 200 && built.html.includes(`data-region="count">400 of 400 selected<`) && took < 20000, [labels, took]);
    check("the search finds programs by any part of the name, whatever the letter case: the matches are exactly the programs whose name holds the text, an empty search shows all, and a miss shows none",
      hits.length === 400 && isDeepStrictEqual(listedNames.filter((_, i) => hits[i]), names.filter((n) => n.toLowerCase().includes("renewal 00"))) && hits.filter(Boolean).length > 5 && hits.filter(Boolean).length < 400 &&
        page.call(`app.programMatches("  ")`).every(Boolean) && !page.call(`app.programMatches("zzz-no-such")`).some(Boolean) && page.call(`app.programMatches("P-0399")`).filter(Boolean).length === 1, hits.filter(Boolean).length);
    const some = many.dimensions.programs.filter((p, i) => i % 3 === 0).map((p) => p.id);
    const most = many.dimensions.programs.filter((p, i) => i % 50 !== 0).map((p) => p.id);
    const [h1, h2] = [page.call(`app.hashOf(app.clean({ ...app.defaultState(), programs: ${JSON.stringify(some)} }))`), page.call(`app.hashOf(app.clean({ ...app.defaultState(), programs: ${JSON.stringify(most)} }))`)];
    check("a large selection stays a short address: the hash lists whichever is shorter, the programs kept or the programs left out, and reads back as the same selection either way",
      h1.startsWith("p=") && h2.startsWith("px=") && h2.split(",").length === 8 && isDeepStrictEqual(page.call(`app.stateFromHash(${JSON.stringify(h2)}).programs`).sort(), [...most].sort()) && isDeepStrictEqual(page.call(`app.stateFromHash(${JSON.stringify(h1)}).programs`).sort(), [...some].sort()) &&
        page.call(`app.regions.count(app.stateFromHash(${JSON.stringify(h2)}))`) === "392 of 400 selected", [h1.length, h2]);
    check("with every program selected and filtered by status, the program table still equals the engine's over the generated snapshot",
      isDeepStrictEqual(panelRun(page, "programs", "s=PAUSE"), plain(runQuery(applyGroups(many, SPEC.groups).snapshot, { recipientClass: "all", statuses: ["PAUSE"] }, SPEC.pages[0].panels[0].query))) && panelRun(page, "programs", "s=PAUSE").rows.length === 100);
  }

  // ══ The page-size report, the warning and the refusal ═════════════════════
  {
    const r = ADMIN.report;
    check("the builder measures every page and reports it: the total is the file's real size in bytes, with what the data, the engine, the runtime and the pre-render each take, and the rows of each embedded table",
      r.bytes.total === Buffer.byteLength(ADMIN.html, "utf8") && r.bytes.engine === Buffer.byteLength(SOURCES.engineSource) && r.bytes.runtime === Buffer.byteLength(SOURCES.runtimeSource) && r.bytes.data === Buffer.byteLength(admin.data) && r.bytes.prerender === Buffer.byteLength(admin.prerender) &&
        r.rows.byTemplate === 30 && r.rows.byAccount === 67 && r.rows["health.bounceReasons"] === PULLED.facts.health.bounceReasons.length && r.rows["health.schedules"] === PULLED.facts.health.schedules.length && r.rows["health.sources"] === PULLED.facts.health.sources.length && Object.keys(r.tables).length === 17 && r.tables.byAccount.bytes > 0 && r.tables.byAccount.bytes < r.bytes.data && r.megabytes === Number((r.bytes.total / MB).toFixed(2)) && r.warning === null && r.refused === null && r.file === "latest-admin.html" && pageFileName("exec") === "latest-exec.html" &&
          // The template text's share (TPL-2): the template dimension is reported like a table, and the exec page's copy, with the text withheld, is smaller.
          r.rows["dimensions.templates"] === PULLED.dimensions.templates.length && r.tables["dimensions.templates"].bytes > 0 && EXEC.report.tables["dimensions.templates"].bytes < r.tables["dimensions.templates"].bytes, r);
    check("the budget is 5 MB to warn and 15 MB to refuse a leaders' page, under the 16 MB a hosted page may be", PAGE_BUDGET.warnBytes === 5 * MB && PAGE_BUDGET.refuseExecBytes === 15 * MB && PAGE_BUDGET.refuseExecBytes < 16e6);
    // One oversized snapshot, written to disk and built through the real process with the real budget.
    const big = generated({ programs: 400, templates: 30, months: 13, measure: 9 });
    const bigPath = join(ROOT, "big.json");
    writeFileSync(bigPath, JSON.stringify(big));
    const out = join(ROOT, "big-out");
    const run = runNode(BUILDER, ["--spec", SPEC_FILE, "--snapshot", bigPath, "--out-dir", out], { maxBuffer: 64 * MB });
    let json = null;
    try { json = JSON.parse(run.stdout); } catch { /* failure path */ }
    const [a, e] = [json?.pages?.find((p) => p.page === "admin"), json?.pages?.find((p) => p.page === "exec")];
    check("an oversized fixture triggers the size warning: its admin page is over 5 MB, so it is written, and the report and stderr both say how big it is and what would make it smaller",
      !!a && a.bytes.total > PAGE_BUDGET.warnBytes && a.written === true && existsSync(join(out, "latest-admin.html")) && readFileSync(join(out, "latest-admin.html")).length === a.bytes.total && /over the 5 MB budget.*Most of it is byTemplate \(\d+(\.\d+)? MB\).*Narrow the programs or the window\.$/.test(a.warning) && a.refused === null && run.stderr.includes(`page "admin": the page is ${a.megabytes} MB, over the 5 MB budget`),
      [a?.megabytes, a?.warning, run.stderr.slice(0, 300)]);
    check("a leaders' page over 15 MB is refused: it is not written, the summary names it and says why, and the run exits 1 though the admin page was written",
      !!e && e.bytes.total > PAGE_BUDGET.refuseExecBytes && e.written === false && !existsSync(join(out, "latest-exec.html")) && /over the 15 MB a leaders' page may be; it was not written/.test(e.refused) && e.warning === null && run.status === 1 && json.ok === false && isDeepStrictEqual(json.refused, ["exec"]),
      [e?.megabytes, e?.refused, run.status]);
    const small = build(SPEC, PULLED, "exec", { warnBytes: 1000, refuseExecBytes: 2000 });
    const warned = build(SPEC, PULLED, "admin", { warnBytes: 1000, refuseExecBytes: 2000 });
    // F-485: the health tables sit one level down; they are counted, and the warning names what is large and the remedy that follows.
    const heavy = structuredClone(PULLED);
    heavy.facts.health.bounceReasons = Array.from({ length: 80000 }, (_, i) => ({ ...PULLED.facts.health.bounceReasons[1], templateId: `tpl-${i}`, message: `Recipient address rejected: user unknown, on a line of product text long enough to weigh, number ${i}`, category: "user-unknown" }));
    const heavyPage = build(SPEC, heavy);
    check("F-485: a page whose size is its health tables says so: the report counts them, the warning names the largest table with its megabytes and the remedy is the Health tab, not customer lists; a page that is large for another reason gets that reason's remedy",
      heavyPage.report.rows["health.bounceReasons"] === 80000 && heavyPage.report.bytes.total > PAGE_BUDGET.warnBytes && /Most of it is health\.bounceReasons \(\d+(\.\d+)? MB\)/.test(heavyPage.report.warning) && /The Health tab's data makes the size: turn the tab off for this page/.test(heavyPage.report.warning) && !/customer lists/.test(heavyPage.report.warning) &&
        /Customer lists make the size/.test(build(SPEC, PULLED, "admin", { warnBytes: 1000, refuseExecBytes: 2000 }).report.warning) === (Object.entries(build(SPEC, PULLED).report.tables).sort((x, y) => y[1].bytes - x[1].bytes)[0][0] === "byAccount"), heavyPage.report.warning);
    check("the two limits are separate: an admin page over both is warned about and still built, never refused; a leaders' page over the refusal limit comes back with no page at all",
      small.html === null && !!small.report.refused && warned.html !== null && !!warned.report.warning && warned.report.refused === null);
  }

  // ══ The command, and what it refuses ══════════════════════════════════════
  {
    const out = join(ROOT, "pages");
    const run = runNode(BUILDER, ["--spec", SPEC_FILE, "--snapshot", SNAPSHOT_FILE, "--out-dir", out]);
    let json = null;
    try { json = JSON.parse(run.stdout); } catch { /* failure path */ }
    check("the command builds one file per page of the spec and prints one JSON summary with the size report; what it writes is what the pure builder returns",
      run.status === 0 && json?.ok === true && isDeepStrictEqual(json.pages.map((p) => [p.page, p.file, p.written]), [["admin", "latest-admin.html", true], ["exec", "latest-exec.html", true]]) && json.pages.every((p) => p.bytes.total > 0 && p.megabytes >= 0) && json.budget.warnMegabytes === 5 &&
        readFileSync(join(out, "latest-admin.html"), "utf8") === build(SPEC, PULLED).html && readFileSync(join(out, "latest-exec.html"), "utf8") === build(SPEC, PULLED, "exec").html && json.ungrouped === "0 new programs ungrouped", json ?? run.stderr);
    const one = runNode(BUILDER, ["--spec", SPEC_FILE, "--snapshot", SNAPSHOT_FILE, "--out-dir", join(ROOT, "one"), "--page", "exec"]);
    check("--page builds that page alone, and a page the spec does not have is refused by name", one.status === 0 && existsSync(join(ROOT, "one", "latest-exec.html")) && !existsSync(join(ROOT, "one", "latest-admin.html")) &&
      runNode(BUILDER, ["--spec", SPEC_FILE, "--snapshot", SNAPSHOT_FILE, "--out-dir", join(ROOT, "none"), "--page", "ghost"]).stderr.includes("--page ghost: the spec has no such page (it has admin, exec)"));
    const grouped = loadPage(readFileSync(join(out, "latest-admin.html"), "utf8")).call(`app.snapshot.dimensions.programs.map((p) => [p.id, p.supergroup, p.group])`);
    check("the page's groups are the spec's as it is now: the fixture snapshot holds no group, and every program on the page carries the supergroup and group the spec's rules give it",
      PULLED.dimensions.programs.every((p) => p.supergroup === null) && isDeepStrictEqual(grouped, GOLD.dimensions.programs.map((p) => [p.id, p.supergroup, p.group])) && grouped.every((g) => g[1] && g[2]), grouped);
    const otherTenant = join(ROOT, "other.json");
    writeFileSync(otherTenant, JSON.stringify({ ...PULLED, meta: { ...PULLED.meta, tenantHost: "acme--sbx.gainsightcloud.com" } }));
    const wrong = runNode(BUILDER, ["--spec", SPEC_FILE, "--snapshot", otherTenant, "--out-dir", join(ROOT, "wrong")]);
    check("a dashboard is never built from another tenant's data: a snapshot pulled from a different host than the spec's is refused, naming both, and nothing is written",
      wrong.status === 1 && wrong.stderr.includes("the spec belongs to acme.gainsightcloud.com and the snapshot was pulled from acme--sbx.gainsightcloud.com") && !existsSync(join(ROOT, "wrong")), wrong.stderr);
    const badSnap = join(ROOT, "bad.json");
    writeFileSync(badSnap, JSON.stringify({ ...PULLED, schemaVersion: 2 }));
    const badSpec = join(ROOT, "bad-spec.json");
    writeFileSync(badSpec, JSON.stringify({ ...SPEC, extra: 1 }));
    check("it reads both contracts through their loud readers and changes neither: an unknown snapshot version and an invalid spec are each refused with the reader's own message; a missing flag prints the usage",
      /schemaVersion 2 is not 1/.test(runNode(BUILDER, ["--spec", SPEC_FILE, "--snapshot", badSnap, "--out-dir", out]).stderr) && /dashboard spec: extra is not a field/.test(runNode(BUILDER, ["--spec", badSpec, "--snapshot", SNAPSHOT_FILE, "--out-dir", out]).stderr) &&
        /usage: dashboard-page\.mjs --spec <file> --snapshot <file> --out-dir <dir>/.test(runNode(BUILDER, ["--spec", SPEC_FILE]).stderr) && isDeepStrictEqual(JSON.parse(readFileSync(SPEC_FILE, "utf8")), plain(SPEC)) && isDeepStrictEqual(JSON.parse(readFileSync(SNAPSHOT_FILE, "utf8")), plain(PULLED)));
    check("a panel the engine cannot answer stops the build, naming the page: a table asking for accounts beside templates is refused before any file exists",
      throwsWith(() => build(specWith((s) => { s.pages[0].panels.push({ id: "bad", tab: "engagement", type: "table", title: "Bad", query: { groupBy: ["account", "template"], metrics: ["sent"] } }); }), PULLED), /dashboard page "admin": engagement query: no fact table holds accounts beside templates/) &&
        throwsWith(() => buildPage({ spec: SPEC, snapshot: GOLD, pageId: "ghost", ...SOURCES }), /the spec has no page "ghost"/));
    const bare = build(specWith((s) => { s.pages[0].panels = []; }), PULLED);
    check("a page whose spec lists no panel shows the preset's panels (every on tab given its own), the Templates tab's among them: the preset's templates view draws over the pulled content with the engine's rows",
      isDeepStrictEqual(rowsOf(panelHtml(bare.html, "programs"), "thead")[0], ["Program", .../** @type {any} */ (PRESETS.admin.panels.find((p) => p.id === "programs")).columns.map((id) => engine.metric(id).label)]) && /data-panel="templates" data-type="templates"/.test(paneHtml(bare.html, "templates")) && lacksIn(paneHtml(bare.html, "templates")).length === 0 &&
        [...paneHtml(bare.html, "templates").matchAll(/<tr data-template="([^"]+)">/g)].map((m) => m[1]).join() === engine.templatesView(applyGroups(PULLED, SPEC_DEFAULTS.groups).snapshot, loadPage(bare.html).call(`app.filtersOf(app.defaultState())`)).rows.map((r) => r.templateId).join() &&
        loadPage(bare.html).call(`app.panels.length`) === presetPanels(SPEC_DEFAULTS.pages[0]).length);
  }
} finally {
  removeTempDir(ROOT);
}

if (failures) {
  console.log(`\ndashboard-page: ${failures} FAILED of ${ran}`);
  process.exit(1);
}
console.log(`\ndashboard-page: all ${ran} checks passed`);
