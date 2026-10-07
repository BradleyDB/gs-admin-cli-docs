#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// dashboard-page.mjs (test) — fixtures for the dashboard page (DSH-2):
// scripts/dashboard-page.mjs (the builder) and scripts/dashboard-runtime.mjs
// (what every page inlines), over the fictional tenant.
//
// Snapshots come from the real producer: the committed fixture snapshot
// (accounts, step detail and health on) and two pulls made here through the
// stand-in CLI (the adapter's defaults, so accounts off; and one with no
// internal domain). Larger ones are generated: several hundred programs for
// the program list, and one big enough to pass both size limits.
//
// A PAGE IS READ THE WAY A BROWSER READS IT: its two inlined scripts and its
// embedded data are taken out of the built HTML and run in a context with no
// Node globals. Expectations are derived independently (R-10): the engine is
// run here on the ORIGINAL snapshot with filters written by hand, and the
// page's answer for the same filter state, given as a URL hash, must equal it.
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
import { buildPage, pageModel, pageSnapshot, packTable, inlinedSources, pageFileName, PAGE_BUDGET, DEFAULT_PANELS } from "../scripts/dashboard-page.mjs";
import { createDashboard, mount, unpackSnapshot, unpackTable, csvCell, csvText, esc, LACKS, NOT_LACKS, LACKS_LATER, NEEDS, COPY_LINES, PAGE_MODEL_VERSION } from "../scripts/dashboard-runtime.mjs";
import * as engine from "../scripts/engagement-query.mjs";
import { openSpec, SPEC_DESCRIPTIONS } from "../scripts/dashboard-spec.mjs";
import { applyGroups } from "../scripts/dashboard-groups.mjs";
import { kbFiles } from "./fixtures/engagement/acme-tenant.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN = join(HERE, "..");
const BUILDER = join(PLUGIN, "scripts", "dashboard-page.mjs");
const ADAPTER = join(PLUGIN, "scripts", "engagement.mjs");
const FAKE = join(HERE, "fixtures", "engagement", "fake-gs-admin.mjs");
const SNAPSHOT_FILE = join(HERE, "fixtures", "engagement", "snapshot-acme.json");
const SPEC_FILE = join(HERE, "fixtures", "engagement", "spec-acme.json");
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
const panelHtml = (html, id) => html.match(new RegExp(`<section class="gs-panel" data-panel="${id}">([\\s\\S]*?)</section>`))?.[1] ?? null;
const paneHtml = (html, id) => (html.split(`<section class="gs-pane" data-pane="${id}"`)[1] ?? "").split(`<section class="gs-pane"`)[0].split(`</div>\n`)[0] || null;
const filterHtml = (html, title) => (html.split(`<div class="gs-f"><span class="gs-f-title">${title}</span>`)[1] ?? "").split(`<div class="gs-f">`)[0] || null;
const rowsOf = (section, part = "tbody") => [...(section.match(new RegExp(`<${part}>([\\s\\S]*?)</${part}>`))?.[1] ?? "").matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => textOf(c[1])));
const lacksIn = (html) => [...html.matchAll(/data-lack="([^"]+)"/g)].map((m) => m[1]);
/** A page's markup without its inlined scripts, and the notices drawn in it. */
const markupOf = (html) => html.replace(/<script type="module">\n[\s\S]*?<\/script>/g, "");
const drawn = (html) => lacksIn(markupOf(html));
/** A string as it sits in a page's embedded data. */
const inData = (text) => JSON.stringify(text).slice(1, -1).replace(/[<>&]/g, (c) => "\\u00" + c.charCodeAt(0).toString(16));
/** RFC 4180, written here on its own: the page's CSV builder is the thing under test. */
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
  // Two pulls through the stand-in CLI: the adapter's defaults (accounts off), and one with no internal domain.
  const WS = join(ROOT, "ws");
  writeFiles(WS, { ".gs-superadmin/.keep": "" });
  writeFiles(join(ROOT, "kb"), kbFiles("acme-prod"));
  writeFiles(join(ROOT, "fake-state"), { ".keep": "" });
  const pull = (name, flags) => {
    const out = join(ROOT, `${name}.json`);
    const r = runNode(ADAPTER, ["run", "--workspace", WS, "--bin", FAKE, "--kb", join(ROOT, "kb", "acme-prod"), "--page-size", "400", "--today", "2026-09-15", "--pulled-at", "2026-09-15T09:00:00-07:00", "--from", "2026-06", "--run", name, "--out", out, ...flags], { env: { ...process.env, FAKE_STATE: join(ROOT, "fake-state"), FAKE_TENANT: "{}" } });
    if (r.status !== 0 || !existsSync(out)) throw new Error(`the fixture pull "${name}" failed: ${r.stderr}`);
    return engine.openSnapshot(JSON.parse(readFileSync(out, "utf8")));
  };
  const OFF = pull("page-off", ["--internal-domain", "acme.com"]);
  const NO_DOMAIN = pull("page-nodomain", []);
  check("the fixtures are what they are named for: the default pull holds no account data, no step detail and no health data and says so itself; the other pull was given no internal domain and carries the marker for it",
    engine.accountAvailability(OFF).reason === "accounts-off" && OFF.meta.stepDetail === false && engine.healthAvailability(OFF).pulled === false && !OFF.caveats.some((c) => c.id === "recipient-class-not-configured") && NO_DOMAIN.caveats.some((c) => c.id === "recipient-class-not-configured"),
    [OFF.meta.accounts, NO_DOMAIN.caveats]);

  const ADMIN = build(SPEC_ACCOUNTS, PULLED);
  const EXEC = build(SPEC_ACCOUNTS, PULLED, "exec");
  const admin = loadPage(ADMIN.html);
  const exec = loadPage(EXEC.html);
  const reached = new Set([...drawn(ADMIN.html), ...drawn(EXEC.html)]);

  // ══ One aggregation path (house rule 11) ══════════════════════════════════
  {
    check("the page inlines the query engine byte for byte: its first script is engagement-query.mjs exactly as the file is on disk, followed only by the line that hands it to the page",
      admin.scripts.length === 2 && admin.scripts[0].startsWith(`${SOURCES.engineSource}\n;globalThis.__gsEngine = {`) && ADMIN.html.split(SOURCES.engineSource).length === 2 && SOURCES.engineSource === readFileSync(join(PLUGIN, "scripts", "engagement-query.mjs"), "utf8"),
      [admin.scripts.length, admin.scripts[0]?.slice(0, 80)]);
    check("the page inlines the runtime byte for byte too, followed only by its start line; the code that drew the pre-render in Node is the code the browser runs",
      admin.scripts[1] === `${SOURCES.runtimeSource}\n;boot(globalThis);\n` && SOURCES.runtimeSource === readFileSync(join(PLUGIN, "scripts", "dashboard-runtime.mjs"), "utf8"), admin.scripts[1]?.slice(-60));
    const handed = admin.scripts[0].slice(SOURCES.engineSource.length).match(/\{ ([^}]*) \}/)?.[1].split(", ") ?? [];
    check("every export of the engine is handed to the page, by name: the list is read from the module, never written by hand", isDeepStrictEqual(handed, Object.keys(engine).sort()) && handed.includes("runQuery"), handed);
    for (const [name, file] of [["runtime", "dashboard-runtime.mjs"], ["builder", "dashboard-page.mjs"]]) {
      const src = readFileSync(join(PLUGIN, "scripts", file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
      const calls = [...src.matchAll(/(\w+)\.runQuery\(/g)].map((m) => m[1]);
      check(`the ${name} never aggregates on its own: its source sums nothing, reads no measure list and never walks a fact table's rows; every figure is a cell of the engine's runQuery`,
        !/\.reduce\((?!\(n, s\) => n \+ s\.params\.testAccounts)/.test(src) && !/SEND_MEASURES/.test(src) && !/facts\.by\w+\.(map|filter|forEach|find|some)/.test(src) && !/\.(sent|delivered|opened|bounced)\s*[+\-/*]/.test(src) && calls.every((c) => c === "engine") && (name !== "runtime" || calls.length === 2),
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
    const panels = SPEC_ACCOUNTS.pages[0].panels;
    const differs = [];
    for (const [hash, filters] of states) for (const panel of panels) {
      const inPage = panelRun(admin, panel.id, hash);
      const inNode = plain(runQuery(GOLD, filters, panel.query));
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
    check("a hash someone mangled or wrote for another dashboard never breaks the page: unknown programs, months, statuses, tabs and positions are dropped and the rest is kept",
      isDeepStrictEqual(admin.call(`app.stateFromHash("t=nope&m=1999-01..2026-08&p=ghost,p-nps&sg=99&g=-1&s=PAUSE,BOGUS&rc=maybe&a=nobody&%E0%A4%A=1&junk")`), { tab: "engagement", from: "2026-06", to: "2026-08", programs: ["p-nps"], sg: null, g: null, statuses: ["PAUSE"], external: false, account: null }) &&
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

  // ══ The pre-rendered default view ═════════════════════════════════════════
  {
    check("the pre-render is the page's own default view: what Node wrote into the file is byte for byte what the page's inlined code renders for the default state, on the admin page and on the leaders' page",
      !!admin.prerender && admin.prerender === admin.call(`app.renderApp(app.defaultState(), null)`) && !!exec.prerender && exec.prerender === exec.call(`app.renderApp(app.defaultState(), null)`));
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
    check("every view shows when the data was pulled: the line is the engine's own, at the top of the page",
      admin.prerender.includes(esc(engine.dataPulledLine(GOLD))) && admin.prerender.indexOf(esc(engine.dataPulledLine(GOLD))) < admin.prerender.indexOf("gs-filters"));
    const closed = admin.call(`app.renderPanel(app.panels.find((p) => p.id === "programs"), app.stateFromHash("m=2026-06..2026-08"), null)`);
    check("the incomplete period is marked (R4): a row that includes the provisional month carries a mark and the table says from when; a view of closed months alone carries neither",
      (panelHtml(ADMIN.html, "programs").match(/<sup title="Includes the incomplete period">\*<\/sup>/g) ?? []).length === [...expected.rows, expected.total].filter((r) => r.incomplete).length && expected.rows.some((r) => r.incomplete) && expected.rows.some((r) => !r.incomplete) &&panelHtml(ADMIN.html, "programs").includes(`* Includes sends on or after ${GOLD.meta.incompleteFrom}, which are provisional`) &&
        rowsOf(closed).length > 0 && !closed.includes("<sup") && !closed.includes("provisional"), closed.slice(-300));
    const again = build(SPEC_ACCOUNTS, PULLED);
    check("a page is byte-stable: the same spec and snapshot build the same bytes, with no clock in them", again.html === ADMIN.html);
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
    check("the date filter is month-granular: a from and a to, each offering exactly the snapshot's months, starting on the whole window",
      isDeepStrictEqual([...pre.split(`data-f="from">`)[1].split("</select>")[0].matchAll(/<option value="([^"]+)"( selected)?>/g)].map((m) => m[1] + (m[2] ?? "")), ["2026-06 selected", "2026-07", "2026-08", "2026-09"]) &&
        isDeepStrictEqual([...pre.split(`data-f="to">`)[1].split("</select>")[0].matchAll(/<option value="([^"]+)"( selected)?>/g)].map((m) => m[1] + (m[2] ?? "")), ["2026-06", "2026-07", "2026-08", "2026-09 selected"]));
    const hidden = GOLD.dimensions.programs.filter((p) => !p.statuses.includes("PROCESSING")).length;
    const statusBoxes = (html) => [...html.matchAll(/data-f="status" value="([A-Z]+)"( checked)?>/g)].map((m) => m[1] + (m[2] ?? ""));
    check("the status filter starts from each page's default in the spec: Active only on the admin page, every status on the leaders' page (R23), and each page says how many programs the status filter hides",
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
    check("the notice says what it would take, on an admin page: a new pull, the setting to turn on by its name in the spec's own descriptions and by its path, and a line to copy that names this dashboard",
      watch.includes(esc(NEEDS.pull)) && watch.includes(`Turn on &quot;Accounts&quot; in this dashboard's settings (<span class="gs-path">accounts.pull</span>).`) &&
        watch.includes(`<code>${COPY_LINES.edit("program-health")}</code> <button type="button" data-copy="${COPY_LINES.edit("program-health")}">Copy</button>`) && /data-needs="pull"/.test(watch) && COPY_LINES.edit("x") === "/gs-superadmin:email-engagement dashboard edit x",
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
    const drawn = app.renderTablePanel(app.panels.find((p) => p.id === "accounts"), forged, ["sent"]);
    check("the table panel can draw only the notice when the engine says unavailable: handed a result that says so AND still carries rows and a total, it draws no table, no figure and no download button",
      real.rows.length > 0 && lacksIn(drawn).join() === "accounts-off" && !/<table|<td|data-csv|data-col/.test(drawn) && /<table>/.test(app.renderTablePanel(app.panels.find((p) => p.id === "accounts"), real, ["sent"])), drawn);
    const unknown = app.renderTablePanel(app.panels[0], { ...real, unavailable: { reason: "some-future-reason" } }, ["sent"]);
    check("a reason the table has no row for is still stated in its place, in the engine's words, with no how-to it cannot stand behind and still no table",
      unknown.includes(esc(reasonText("some-future-reason"))) && !/gs-notice-how|data-copy|<table/.test(unknown) && app.lackFacts("some-future-reason").known === false);
    check("the facts come from one function: reason, the engine's wording, pull or rebuild, the setting and the line; a lack that depends on the data asks the caller which it is",
      isDeepStrictEqual(app.lackFacts("accounts-off"), { reason: "accounts-off", text: reasonText("accounts-off"), known: true, needs: "pull", needsText: NEEDS.pull, setting: { path: "accounts.pull", how: "on", label: "Accounts" }, line: COPY_LINES.edit("program-health") }) &&
        app.lackFacts("tab-off", { held: true }).needs === "rebuild" && app.lackFacts("tab-off", { held: false }).needs === "pull" && app.lackFacts("measure-not-in-snapshot").line === COPY_LINES.refresh("program-health") && app.lackFacts("measure-not-in-snapshot").setting === null);
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
    const healthOff = specWith((s) => { s.pages[0].tabs.find((t) => t.id === "health").enabled = false; s.pages[0].tabs.find((t) => t.id === "templates").enabled = false; s.pages[0].panels = s.pages[0].panels.filter((p) => p.tab !== "health"); });
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
    check("whether turning a tab on is a rebuild or a new pull is read from the pull: over a snapshot with no health data the Health tab needs a new pull, and Templates needs one over any snapshot yet",
      paneHtml(build(healthOff, OFF).html, "health").includes(esc(NEEDS.pull)) && !paneHtml(build(healthOff, OFF).html, "health").includes(esc(NEEDS.rebuild)) && paneHtml(offered.html, "templates").includes(esc(NEEDS.pull)));
    check("on a leaders' page a tab that is off is ABSENT: no button, no pane, no notice; the fixture's leaders' page has Engagement and About and nothing of Health or Templates",
      isDeepStrictEqual(tabButtons(EXEC.html), ["engagement:is-current:Engagement", "about::About"]) && !EXEC.html.includes(`data-pane="health"`) && !EXEC.html.includes(`data-pane="templates"`) && !drawn(EXEC.html).includes("tab-off") && exec.call(`app.stateFromHash("t=health").tab`) === "engagement");
    const messages = [...new Set(PULLED.facts.health.bounceReasons.map((r) => r.message))].filter((m) => m != null);
    const samples = [...new Set(PULLED.facts.health.failureSamples.map((r) => r.message))];
    const offPage = loadPage(offered.html);
    check("a page whose Health tab is off carries no health table (an empty bounce-reason table, its copy of the snapshot saying why; the category LABELS still appear, as the category definitions the params echo and a tooltip carry, which is product wording), and a page with the tab on carries every row; the failure SAMPLES (the masked text behind the other rows) are on NO page, the Health tab on or off, and the page's copy holds an empty sample table (ruled 2026-10-05: terminal only)",
      messages.length >= 2 && offPage.call(`app.snapshot.facts.health.bounceReasons.length`) === 0 && exec.call(`app.snapshot.facts.health.bounceReasons.length`) === 0 && messages.every((m) => ADMIN.html.includes(inData(m))) && offPage.call(`app.snapshot.meta.health`).reason === "tab-off" && admin.call(`app.snapshot.facts.health.bounceReasons.length`) === PULLED.facts.health.bounceReasons.length &&
        samples.length > 2 && samples.some((m) => inData(m) !== m) && samples.every((m) => !ADMIN.html.includes(inData(m)) && !offered.html.includes(inData(m)) && !EXEC.html.includes(inData(m))) && admin.call(`app.snapshot.facts.health.failureSamples.length`) === 0 && PULLED.facts.health.failureSamples.length > 2,
      { messages: messages.length, samples: samples.length, adminSamples: admin.call(`app.snapshot.facts.health.failureSamples.length`) });
    // The spec writer refuses a panel on a tab that is off, so the one panel that can meet an off tab is the default one.
    const noEngagement = loadPage(build(specWith((s) => { s.pages[0].tabs.find((t) => t.id === "engagement").enabled = false; s.pages[0].panels = []; }), PULLED).html);
    check("a panel of a tab that is not on is not part of the page: with Engagement off and no panel listed, the default table is not built, the page opens on the first tab that is on, and Engagement is offered as a rebuild (every pull holds it)",
      !noEngagement.prerender.includes(`data-panel="programs"`) && noEngagement.call(`app.panels.length`) === 0 && noEngagement.call(`app.defaultState().tab`) === "health" && paneHtml(noEngagement.prerender, "engagement").includes(esc(NEEDS.rebuild)) && ADMIN.html.includes(`data-panel="error-rate"`));
  }
  {
    // The recipients toggle with no internal domain.
    const page = build(SPEC, NO_DOMAIN);
    for (const id of drawn(page.html)) reached.add(id);
    const toggle = filterHtml(page.html, "Recipients");
    const loaded = loadPage(page.html);
    check("no internal domain configured: the recipients toggle is drawn switched off with the reason beside it, never a control that does nothing; what it would take is a new pull with the domains filled in",
      /<input type="checkbox" data-f="external" disabled>/.test(toggle) && lacksIn(toggle).join() === "no-internal-domain" && toggle.includes(esc(reasonText("no-internal-domain"))) && toggle.includes(esc(NEEDS.pull)) && toggle.includes(`Fill in &quot;Internal recipients&quot;`) && toggle.includes(`<span class="gs-path">sources[].params.internalDomains[]</span>`), toggle);
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
        panel.includes(`<code>${COPY_LINES.refresh("program-health")}</code>`) && !panel.includes("gs-path") && panel.includes(`title="${esc(reasonText("measure-not-in-snapshot"))}"`), [cells, lacksIn(panel)]);
    const uniq = panelHtml(build(specWith((s) => { s.pages[0].panels[0].columns = ["sent", "uniqueRecipients"]; }), PULLED).html, "programs");
    check("a reason that is a property of the figure, not something a setting supplies, is said plainly under the table with no how-to: the total of a distinct count is never added up",
      uniq.includes(`<p class="gs-note"><strong>Unique recipients:</strong> ${esc(reasonText("not-additive"))}</p>`) && lacksIn(uniq).length === 0 && rowsOf(uniq, "tfoot")[0][2] === NO_VALUE);
  }
  {
    // Closed both ways.
    const ids = Object.keys(REASONS);
    const rows = LACKS.map((r) => r.reason);
    const classes = [rows, Object.keys(NOT_LACKS), [...LACKS_LATER]];
    const homes = (id) => classes.filter((c) => c.includes(id)).length;
    check("every reason the engine can give is classified exactly once: it has a row in the table of what a page can lack, or it is a property of the figure, or it is a health reason no page reads yet; and none of the three lists names a reason the engine does not have",
      ids.every((id) => homes(id) === 1) && classes.flat().every((id) => ids.includes(id)) && new Set(rows).size === rows.length, [ids.filter((id) => homes(id) !== 1), classes.flat().filter((id) => !ids.includes(id))]);
    const unavailable = new Set([
      runQuery(OFF, {}, accountPanels[1].query).unavailable?.reason, runQuery(OFF, {}, { groupBy: ["step"], metrics: ["sent"] }).unavailable?.reason,
      runQuery(pageSnapshot(PULLED, SPEC.pages[1]), {}, accountPanels[1].query).unavailable?.reason,
    ]);
    check("every reason the engine gives for a table it does not hold has a row: accounts off, step detail off, and accounts left off a page",
      unavailable.size === 3 && [...unavailable].every((id) => rows.includes(id)), [...unavailable]);
    check("every row is reached by a fixture: across the pages built above, each reason of the table was drawn at least once, and nothing was drawn that the table does not hold",
      rows.every((id) => reached.has(id)) && [...reached].every((id) => rows.includes(id)), [rows.filter((id) => !reached.has(id)), [...reached].filter((id) => !rows.includes(id))]);
    const covered = SPEC_DESCRIPTIONS.flatMap((d) => d.covers);
    const real = (path) => path.replace(/\[\]$/, "").split(/\[\]\.|\./).reduce((at, key) => (Array.isArray(at) ? at[0] : at)?.[key], SPEC) !== undefined;
    check("every setting a row names is a real field of the dashboard spec that a description covers, so a notice can never point at a setting that does not exist; a row that named one is refused when a page is built",
      LACKS.filter((r) => r.setting).every((r) => covered.includes(r.setting.path) && real(r.setting.path) && ["on", "fill"].includes(r.setting.how)) && LACKS.every((r) => ["pull", "rebuild", "by-data"].includes(r.needs) && r.line in COPY_LINES) && Object.keys(NEEDS).join() === "pull,rebuild",
      LACKS.filter((r) => r.setting && !(covered.includes(r.setting.path) && real(r.setting.path))));
    check("the reason wording lives in the engine and nowhere else: the runtime's table holds ids, and no sentence of the engine's reasons is written out in the runtime or the builder",
      Object.values(REASONS).every((sentence) => !SOURCES.runtimeSource.includes(sentence) && !readFileSync(BUILDER, "utf8").includes(sentence)));
  }

  // ══ Column show and hide (R1) ═════════════════════════════════════════════
  {
    const app = createDashboard(engine, pageModel(SPEC, GOLD, SPEC.pages[0]));
    const panel = app.panels[0];
    const heads = (ui) => rowsOf(panelHtml(`<section class="gs-pane">${app.renderPanel(panel, app.defaultState(), ui)}`, "programs"), "thead")[0];
    const toggles = [...panelHtml(ADMIN.html, "programs").matchAll(/data-col="programs" value="(\w+)"( checked)?>/g)].map((m) => m[1] + (m[2] ?? ""));
    check("every table lets a viewer show or hide any column: the panel starts on the columns its spec names, the list offers every metric of its query, and a viewer's choice replaces the start",
      isDeepStrictEqual(heads(null), ["Program", "Sent", "Open rate"]) && isDeepStrictEqual(toggles, ["sent checked", "uniqueRecipients", "delivered", "opened", "openRate checked"]) &&
        isDeepStrictEqual(heads({ cols: { programs: ["opened", "sent", "not-a-metric"] } }), ["Program", "Sent", "Opened"]) && isDeepStrictEqual(heads({ cols: { programs: [] } }), ["Program"]), [heads(null), toggles]);
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
      const g = { document: {}, localStorage: storage, location: { hash }, history: { replaceState: (a, b, url) => replaced.push(url) }, addEventListener: () => {} };
      mount(app, root, g);
      return { root, listeners, boxes, painted, replaced };
    };
    const blocked = { getItem: () => { throw new Error("storage is blocked"); }, setItem: () => { throw new Error("storage is blocked"); } };
    const a = drive(blocked);
    check("a browser that blocks storage still gets a working page: reading and writing the column choice are both wrapped, nothing throws, the pre-render is left as it is and the controls are switched on",
      a.root.disabled === false && a.root.innerHTML === null && (a.listeners.change({ target: { getAttribute: (n) => (n === "data-col" ? "programs" : null) } }), /<th scope="col" class="gs-num">Opened<\/th>/.test(panelHtml(a.painted.panes, "programs")) && !/class="gs-num">Sent<\/th>/.test(panelHtml(a.painted.panes, "programs"))), a.painted.panes?.slice(0, 200));
    const kept = new Map();
    const b = drive({ getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, v) });
    b.listeners.change({ target: { getAttribute: (n) => (n === "data-col" ? "programs" : null) } });
    const c = drive({ getItem: (k) => kept.get(k) ?? null, setItem: () => {} });
    check("the column choice is remembered per viewer, per dashboard, page and table, and is drawn when the page is opened again; a stored value that is not a list is ignored",
      isDeepStrictEqual([...kept], [[`gs-dashboard.program-health.admin.programs.columns`, `["opened"]`]]) && /class="gs-num">Opened<\/th>/.test(panelHtml(c.root.innerHTML, "programs")) && !/class="gs-num">Sent<\/th>/.test(panelHtml(c.root.innerHTML, "programs")) &&
        drive({ getItem: () => `{"not":"a list"}`, setItem: () => {} }).root.innerHTML === null, [...kept]);
    b.listeners.change({ target: { getAttribute: (n) => (n === "data-f" ? "status" : null) } });
    check("changing a filter redraws the views and the summary and rewrites the address in place, with no navigation: two status boxes ticked become that state's hash",
      isDeepStrictEqual(b.replaced, ["#s=PROCESSING,PAUSE"]) && b.painted.summary.includes("0 programs hidden by status") && rowsOf(b.painted.panes).length === 5, [b.replaced, b.painted.summary]);
    const d = drive({ getItem: () => null, setItem: () => {} }, "#s=all&t=about");
    check("a page opened on a hash draws that state at once, in place of the pre-render",
      typeof d.root.innerHTML === "string" && d.root.innerHTML.includes("showing every status") && /data-pane="about">/.test(d.root.innerHTML) && /data-pane="engagement" hidden>/.test(d.root.innerHTML));
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
      loadPage(OFF_ADMIN.html).call(`app.csvOf(app.panels.find((p) => p.id === "accounts"), app.defaultState(), null)`) === null);
    check("the ONE CSV builder neutralises what a spreadsheet would run: a text cell starting with =, +, -, @, a tab or a carriage return gets a leading apostrophe; a number is written as a number, a negative one included; quotes, commas and line breaks are quoted",
      isDeepStrictEqual(["=1+1", "+1", "-1", "@x", "\tx", "\rx", "safe=1", " =1"].map(csvCell), ["'=1+1", "'+1", "'-1", "'@x", "'\tx", `"'\rx"`, "safe=1", " =1"]) && csvCell(-5) === "-5" && csvCell(0.6667) === "0.6667" && csvCell(null) === "" && csvCell(NaN) === "" &&
        csvCell(`=HYPERLINK("x","y")`) === `"'=HYPERLINK(""x"",""y"")"` && csvText(["a", "b"], [["1,2", "x\ny"]]) === `a,b\r\n"1,2","x\ny"\r\n`);
    check("every table panel has the button and there is one builder behind them all: each drawn table has exactly one Download CSV button, and the runtime joins cells with a comma in one place",
      [...ADMIN.html.matchAll(/<section class="gs-panel" data-panel="([\w-]+)">[\s\S]*?<\/section>/g)].every((m) => (m[0].match(/data-csv="/g) ?? []).length === (/<table>/.test(m[0]) ? 1 : 0)) && (ADMIN.html.match(/>Download CSV</g) ?? []).length >= 3 && SOURCES.runtimeSource.split("csvText(").length === 2 && SOURCES.runtimeSource.split("new g.Blob(").length === 2 && SOURCES.runtimeSource.includes("text: csvText(headers, rows)"));
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
    check("a hostile name renders inert: outside the page's own scripts no tag, attribute or comment a tenant string asked for exists; each is there as text",
      !/<script|<img|<svg|<b>|<i>|<u>|<em>|<h1>Programs|<a href|<!--|onerror=alert\(1\)>|onload=/.test(markup.replace(/&lt;[\s\S]*?&gt;/g, "")) && !/<(img|svg|b|i|u|em|a|script)[\s>]/.test(markup) &&
        evil.every((name) => markup.includes(esc(name))) && markup.includes(esc(`<h1>Programs</h1>`)) && markup.includes(esc(`<script>g</script>`)) && html.includes(`<title>Acme &lt;u&gt;title&lt;/u&gt; &amp; "more" · &lt;em&gt;Admin&lt;/em&gt;</title>`),
      markup.match(/<(img|svg|b|i|u|em|a|script)[\s>].{0,40}/)?.[0]);
    check("and nothing is lost to the escaping: the page reads every hostile name back exactly as the snapshot holds it",
      isDeepStrictEqual(loaded.call(`app.snapshot.dimensions.programs.map((p) => p.name)`), evil) && loaded.call(`app.snapshot.dimensions.accounts[1].name`) === hostile.dimensions.accounts[1].name && loaded.call(`app.model.title`) === spec.title);
    const csv = parseCsv(loaded.call(`app.csvOf(app.panels.find((p) => p.id === "programs"), { ...app.defaultState(), statuses: null }, null).text`)).slice(1).map((r) => r[0]);
    const accountsCsv = parseCsv(loaded.call(`app.csvOf(app.panels.find((p) => p.id === "accounts"), { ...app.defaultState(), statuses: null }, null).text`)).slice(1).map((r) => r[0]);
    check("a hostile name exports neutralised: the formula-shaped program and account names arrive in the CSV with a leading apostrophe, and the others arrive unchanged",
      csv.includes(`'=HYPERLINK("x","y")`) && csv.includes(`'+1 & 'quoted' ${LS}<!-- `) && csv.includes(evil[0]) && csv.includes(evil[4]) && accountsCsv.includes(`'@SUM(1)<i>`) && accountsCsv.includes(`'\t<svg onload=alert(1)>`) && !csv.some((c) => /^[=+\-@\t\r]/.test(c)) && !accountsCsv.some((c) => /^[=+\-@\t\r]/.test(c)), [csv, accountsCsv]);
    check("a hostile name never reaches the address: the hash of a state that selects those programs holds their ids and nothing else", /^[A-Za-z0-9=&.,%_-]+$/.test(loaded.call(`app.hashOf(app.clean({ ...app.defaultState(), programs: ["p-nps", "p-pilot"], sg: 0 }))`)));
    check("every tenant string reaches the page through the one escaper: it turns the five characters that could change markup into entities",
      esc(`<a b="c" d='e'>&`) === "&lt;a b=&quot;c&quot; d=&#39;e&#39;&gt;&amp;" && esc(null) === "" && esc(5) === "5");
  }

  // ══ No network request, no dependency ═════════════════════════════════════
  {
    const pages = { admin: ADMIN.html, exec: EXEC.html, off: OFF_ADMIN.html };
    // Tags as a page writes them (lower case): a JSDoc type such as Object<string, …> in an inlined comment is not one.
    const bad = /[hH][tT][tT][pP][sS]?:\/\/|\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|(?<!\{)\bimport\s*\(|^\s*import\s|<link\b|<img\b|<iframe\b|<object\b|<embed\b|<form\b|\ssrc=|url\(|@import|<base\b|http-equiv/m;
    check("a page asks the network for nothing: no http(s):// source appears anywhere in it, and it holds no call, tag or style that could fetch, load, import or post",
      Object.values(pages).every((h) => !bad.test(h)) && bad.test(`<img src="x">`) && bad.test("fetch (x)") && bad.test(`import("x")`), Object.entries(pages).map(([k, h]) => [k, h.match(bad)?.[0]]));
    check("and it ran that way: every page above was loaded and queried in a context that has no fetch, no XMLHttpRequest, no timers and no Node globals, with only its own embedded data to read",
      admin.call(`[typeof fetch, typeof XMLHttpRequest, typeof process, typeof require, typeof setTimeout]`).join() === "undefined,undefined,undefined,undefined,undefined" && admin.call(`app.snapshot.dimensions.programs.length`) === 5);
    check("the export makes no request either: the file is a Blob the page builds from its embedded data and hands to the browser to save",
      /new g\.Blob\(\[BOM \+ out\.text\]/.test(SOURCES.runtimeSource) && /a\.download = out\.filename/.test(SOURCES.runtimeSource) && /createObjectURL/.test(SOURCES.runtimeSource));
  }

  // ══ The embedded data ═════════════════════════════════════════════════════
  {
    const trips = [];
    for (const [name, snapshot, spec, pageIndex] of /** @type {Array<[string, any, any, number]>} */ ([["admin", GOLD, SPEC_ACCOUNTS, 0], ["exec", GOLD, SPEC_ACCOUNTS, 1], ["accounts off", applyGroups(OFF, SPEC.groups).snapshot, SPEC, 0], ["no domain", applyGroups(NO_DOMAIN, SPEC.groups).snapshot, SPEC, 0]])) {
      const model = plain(pageModel(spec, snapshot, spec.pages[pageIndex]));
      if (!isDeepStrictEqual(unpackSnapshot(model.snapshot), plain(pageSnapshot(snapshot, spec.pages[pageIndex])))) trips.push(name);
    }
    check("the embedded data unpacks to exactly the snapshot the page was given: every dimension, every fact table of every grain and every health table, after a trip through JSON, on four pages", trips.length === 0, trips);
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
      throwsWith(() => createDashboard(engine, { ...pageModel(SPEC, GOLD, SPEC.pages[0]), v: PAGE_MODEL_VERSION + 1 }), /reads version 1 — build the page again/) && throwsWith(() => createDashboard(engine, { ...pageModel(SPEC, GOLD, SPEC.pages[0]), snapshot: { ...pageModel(SPEC, GOLD, SPEC.pages[0]).snapshot, schemaVersion: 2 } }), /T-10/));
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
        r.rows.byTemplate === 30 && r.rows.byAccount === 67 && r.rows["health.bounceReasons"] === PULLED.facts.health.bounceReasons.length && r.rows["health.schedules"] === PULLED.facts.health.schedules.length && Object.keys(r.tables).length === 11 && r.tables.byAccount.bytes > 0 && r.tables.byAccount.bytes < r.bytes.data && r.megabytes === Number((r.bytes.total / MB).toFixed(2)) && r.warning === null && r.refused === null && r.file === "latest-admin.html" && pageFileName("exec") === "latest-exec.html", r);
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
    heavy.facts.health.bounceReasons = Array.from({ length: 40000 }, (_, i) => ({ ...PULLED.facts.health.bounceReasons[0], message: `550 5.1.1 <email>: user unknown, reference <number>, incident ${i} of the day on a long line of text` }));
    const heavyPage = build(SPEC, heavy);
    check("F-485: a page whose size is its health tables says so: the report counts them, the warning names the largest table with its megabytes and the remedy is the Health tab, not customer lists; a page that is large for another reason gets that reason's remedy",
      heavyPage.report.rows["health.bounceReasons"] === 40000 && heavyPage.report.bytes.total > PAGE_BUDGET.warnBytes && /Most of it is health\.bounceReasons \(\d+(\.\d+)? MB\)/.test(heavyPage.report.warning) && /The Health tab's data makes the size: turn the tab off for this page/.test(heavyPage.report.warning) && !/customer lists/.test(heavyPage.report.warning) &&
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
    check("a page whose spec lists no panel shows the one plain table every preset starts with, and a tab that is on with nothing to show yet says what it is for rather than standing empty",
      isDeepStrictEqual(rowsOf(panelHtml(bare.html, "programs"), "thead")[0], ["Program", ...DEFAULT_PANELS[0].query.metrics.map((id) => engine.metric(id).label)]) && rowsOf(panelHtml(EXEC.html, "programs")).length === 5 && paneHtml(bare.html, "templates").includes("Templates: each email&#39;s performance, content and keyword search"));
    const about = paneHtml(ADMIN.html, "about");
    check("the About tab is on every page and is generated: the data-pulled line and the registry's own definition of each metric the page shows, none of it written in the page's source",
      SPEC_ACCOUNTS.pages[0].panels.flatMap((p) => p.query.metrics).every((id) => about.includes(`<dt>${esc(engine.metric(id).label)}</dt><dd>${esc(engine.metric(id).definition)}</dd>`)) && about.includes(esc(engine.dataPulledLine(GOLD))) && EXEC.html.includes(`data-pane="about"`) &&
        engine.METRICS.every((m) => !SOURCES.runtimeSource.includes(m.definition)));
  }
} finally {
  removeTempDir(ROOT);
}

if (failures) {
  console.log(`\ndashboard-page: ${failures} FAILED of ${ran}`);
  process.exit(1);
}
console.log(`\ndashboard-page: all ${ran} checks passed`);
