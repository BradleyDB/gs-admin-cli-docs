#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// dashboard-spec.mjs (test) — fixtures for scripts/dashboard-spec.mjs (DSH-1):
// the dashboard spec (T-11) and its one writer, driven as a real process over
// throwaway KB folders of the fictional acme tenant.
//
// The fixture spec (test/fixtures/engagement/spec-acme.json, which the T-11
// contract pin also reads) is BUILT HERE through the writer's own verbs —
// draft, set, save — from the list of changes below, and must equal the
// committed file. `--write-golden` regenerates it instead of comparing.
//
// Run:  node plugins/gs-superadmin/test/dashboard-spec.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { makeTempDir, removeTempDir, writeFiles, runNode } from "../../../test/rig.mjs";
import {
  defaultSpec, validateSpec, describeSpec, openSpec, setPath, kbTenantHost, SPEC_DESCRIPTIONS, SPEC_FILE, DRAFT_FILE, T11_SCHEMA_VERSION,
  ADAPTERS, FILTERS, TABS, CADENCES, PANEL_TYPES, PRESETS,
} from "../scripts/dashboard-spec.mjs";
import { METRICS } from "../scripts/engagement-query.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = join(HERE, "..", "scripts");
const SCRIPT = join(SCRIPTS, "dashboard-spec.mjs");
const GOLDEN = join(HERE, "fixtures", "engagement", "spec-acme.json");
const WRITE_GOLDEN = process.argv.includes("--write-golden");

let failures = 0;
let total = 0;
function check(label, cond, detail) {
  total++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log(`      ${JSON.stringify(detail)?.slice(0, 1400)}`);
  }
}

const manifest = (slug, baseUrl) => JSON.stringify({ slug, baseUrl, environment: "production", created: "2026-01-01T00:00:00.000Z", last_refresh: null, inventory: {} }, null, 2);
const ROOT = makeTempDir("gs-superadmin-dashboard-spec");
// Three KB folders: the tenant's, a second machine's copy of the same tenant, and another tenant's.
writeFiles(ROOT, {
  "one/acme-prod/_manifest.json": manifest("acme-prod", "https://acme.gainsightcloud.com"),
  "two/acme-prod/_manifest.json": manifest("acme-prod", "https://acme.gainsightcloud.com"),
  "sbx/acme-sbx/_manifest.json": manifest("acme-sbx", "https://acme--sbx.gainsightcloud.com"),
  "bare/nokb/readme.txt": "not a KB",
});
const KB = join(ROOT, "one", "acme-prod");
const KB2 = join(ROOT, "two", "acme-prod");
const SBX = join(ROOT, "sbx", "acme-sbx");
const run = (mode, args, kb = KB) => {
  const r = runNode(SCRIPT, [mode, "--kb", kb, ...args]);
  let json = null;
  try { json = JSON.parse(r.stdout); } catch { /* failure path */ }
  return { code: r.status, json, stderr: r.stderr };
};
const set = (slug, pairs, extra = [], kb = KB) => run("set", ["--slug", slug, ...pairs.flatMap(([path, value]) => ["--set", `${path}=${JSON.stringify(value)}`]), ...extra], kb);
const specAt = (kb, slug) => join(kb, "dashboards", slug, SPEC_FILE);
const draftAt = (kb, slug) => join(kb, "dashboards", slug, DRAFT_FILE);
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

// What the fixture spec is, as the changes an interview would make to the defaults.
const RULES = [
  { kind: "characteristic", level: "supergroup", characteristic: "sendsSurveys", is: true, label: "Surveys" },
  { kind: "characteristic", level: "supergroup", characteristic: "audience", is: "USER", label: "Internal" },
  { kind: "characteristic", level: "supergroup", characteristic: "recurring", is: true, label: "Recurring" },
  { kind: "folder", level: "supergroup", folders: [{ id: "202", label: "Renewals" }] },
  { kind: "characteristic", level: "group", characteristic: "model", is: "CSAT_SURVEY_V2", label: "CSAT", within: "Surveys" },
  { kind: "namePattern", level: "group", match: "segment", delimiter: " ", index: 1 },
];
const PANELS = [
  { id: "programs", tab: "engagement", type: "table", title: "Programs", query: { groupBy: ["program"], metrics: ["sent", "uniqueRecipients", "delivered", "opened", "openRate"], sort: [{ metric: "sent", dir: "desc" }] }, columns: ["sent", "openRate"] },
  { id: "error-rate", tab: "health", type: "table", title: "Error rate by program", query: { groupBy: ["program"], metrics: ["sent", "failed", "errorRate", "bounceRate", "rejectedRate"], sort: [{ metric: "errorRate", dir: "desc" }], having: [{ metric: "sent", gte: 1 }], limit: 25 } },
];
const CHANGES = /** @type {Array<[string, *]>} */ ([
  ["title", "Acme program health"], ["owner", "Acme CS Ops"], ["purpose", "Which programs need attention this month."],
  ["sources.0.params.selector.sentSince", "90d"], ["sources.0.params.internalDomains", ["acme.com"]], ["sources.0.params.unsubscribeLinks", ["https://www.acme.com/mail-settings"]],
  ["sources.0.params.pinnedAccounts", ["co-01"]], ["accounts.pull", true], ["groups.rules", RULES], ["groups.overrides.p-pilot", { group: "Pilots" }],
  ["health.silentDays", 45], ["pages.0.panels", PANELS], ["refresh.ownerNote", "Run on the first Monday."],
]);

try {
  // ── draft, set, resume, save ───────────────────────────────────────────────
  const started = run("draft", ["--slug", "program-health", "--title", "Program health", "--owner", "Acme CS Ops"]);
  check("draft: a new draft is the defaults — one admin and one exec page, monthly, accounts and step detail off — bound to the KB's own tenant",
    started.code === 0 && started.json?.state === "new" && isDeepStrictEqual(started.json.answered, []) && existsSync(draftAt(KB, "program-health")) && !existsSync(specAt(KB, "program-health")) &&
      isDeepStrictEqual(readJson(draftAt(KB, "program-health")).spec, defaultSpec({ slug: "program-health", title: "Program health", owner: "Acme CS Ops", tenantHost: "acme.gainsightcloud.com" })), started.json ?? started.stderr);
  {
    const d = defaultSpec({ slug: "x", tenantHost: "acme.gainsightcloud.com" });
    check("defaults: 13 months, 2 months read again, R24's account numbers kept but unused, silent after 30 days, stale after 45, Active only on the admin page and every status on the exec page, Health and Templates off on the exec page, About on both",
      d.sources[0].params.windowMonths === 13 && d.sources[0].params.repullMonths === 2 && d.sources[0].params.stepDetail === false && isDeepStrictEqual(d.accounts, { pull: false, busiest: 20, lowEngagement: 15, mostBounces: 15, lowEngagementMinDelivered: 10 }) &&
        d.health.silentDays === 30 && d.freshness.maxAgeDays === 45 && d.refresh.cadence === "monthly" && isDeepStrictEqual(d.pages.map((p) => [p.preset, p.statusDefault, p.tabs.filter((t) => t.enabled).map((t) => t.id).join()]), [["admin", ["PROCESSING"], "engagement,health,templates,about"], ["exec", null, "engagement,about"]]) &&
        d.pages[1].accountNames === false && d.publish.target === "none" && validateSpec(d).problems.length === 0);
  }
  const first = set("program-health", CHANGES.slice(0, 6), ["--answered", "purpose", "--answered", "programs"]);
  check("set: several fields in one call, each a path and a JSON value, with the answers they settle marked as answered",
    first.code === 0 && isDeepStrictEqual(first.json.set, CHANGES.slice(0, 6).map((c) => c[0])) && isDeepStrictEqual(first.json.answered, ["purpose", "programs"]) && readJson(draftAt(KB, "program-health")).spec.sources[0].params.selector.sentSince === "90d", first.json ?? first.stderr);
  const resumed = run("draft", ["--slug", "program-health"]);
  check("draft resume: asking for the draft again returns the one in progress, with what was answered and every value set so far — nothing is restarted",
    resumed.code === 0 && resumed.json?.state === "resumed" && isDeepStrictEqual(resumed.json.answered, ["purpose", "programs"]) && resumed.json.title === "Acme program health" && readJson(draftAt(KB, "program-health")).spec.owner === "Acme CS Ops");
  const second = set("program-health", CHANGES.slice(6), ["--answered", "programs", "--answered", "grouping"]);
  check("set: an answer marked twice is recorded once; a list is appended to by its next index or set as a whole; a keyed map takes a new key",
    second.code === 0 && isDeepStrictEqual(second.json.answered, ["purpose", "programs", "grouping"]) && isDeepStrictEqual(readJson(draftAt(KB, "program-health")).spec.groups.overrides, { "p-pilot": { group: "Pilots" } }), second.json ?? second.stderr);

  // ── set refuses what would leave an invalid spec, and writes nothing ───────
  {
    const before = readFileSync(draftAt(KB, "program-health"), "utf8");
    const REFUSED = /** @type {Array<[Array<[string, *]>, RegExp]>} */ ([
      [[["refresh.cadence", "daily"]], /refresh\.cadence must be one of weekly, monthly, quarterly, manual/],
      [[["colour", "blue"]], /colour is not a field of the dashboard spec/],
      [[["sources.0.params.window", 13]], /sources\[0\]\.params\.window is not a field/],
      [[["sources.0.params.unsubscribeLinks", ["not a host"]]], /sources\[0\]\.params\.unsubscribeLinks\[0\] must be a link or a host/],
      [[["sources.0.params.selector.sentSince", "last quarter"]], /sentSince must be a date/],
      [[["pages.0.tabs.3.enabled", false]], /pages\[0\]\.tabs the About tab cannot be turned off/],
      [[["pages.1.statusDefault", ["ACTIVE"]]], /pages\[1\]\.statusDefault\[0\] must be one of PROCESSING, PAUSE, NEW, STOP/],
      [[["pages.0.panels.0.query.metrics", ["sent", "openrate"]]], /pages\[0\]\.panels\[0\]\.query\.metrics\[1\] is not a metric the engine computes/],
      [[["pages.0.panels.0.query.groupBy", ["campaign"]]], /pages\[0\]\.panels\[0\]\.query\.groupBy\[0\] must be one of/],
      [[["pages.1.panels", [{ ...PANELS[1], id: "h" }]]], /pages\[1\]\.panels\[0\]\.tab is the health tab, which this page has turned off/],
      [[["groups.rules.0.kind", "regex"]], /groups\.rules\[0\]\.kind must be one of/],
      [[["refresh.ownerNote", "C:\\Users\\someone\\notes.txt"]], /refresh\.ownerNote holds a path on this machine/],
      [[["publish", { target: "share", config: { dir: ["", "home", "shared-drive", "dashboards"].join("/") } }]], /publish\.config\.dir holds a path on this machine|publish\.target must be "none"/],
      [[["accounts.busiest", -1]], /accounts\.busiest must be a whole number from 0/],
      [[["slug", "other"]], /slug cannot be changed with set/],
      [[["tenantHost", "evil.example.com"]], /tenantHost cannot be changed/],
      [[["pages.5.title", "x"]], /"pages" is a list of 2; "5" is not an index into it/],
      [[["__proto__.polluted", true]], /not a field path/],
    ]);
    const wrong = REFUSED.map(([pairs]) => /** @type {[string, {code: number, json: *, stderr: string}]} */ ([pairs[0][0], set("program-health", pairs)])).filter(([, r], i) => r.code !== 1 || !REFUSED[i][1].test(r.stderr)).map(([path, r]) => [path, r.code, r.stderr.slice(0, 300)]);
    check(`set refuses a change that would leave an invalid spec, naming the field: ${REFUSED.length} cases — an unknown value, an unknown field, a link the adapter would refuse, About turned off, an unknown metric or dimension, a panel on a tab that is off, a path on this machine, the slug, the tenant — and the draft is byte for byte what it was`,
      wrong.length === 0 && readFileSync(draftAt(KB, "program-health"), "utf8") === before && /** @type {any} */ ({}).polluted === undefined, wrong);
    const notJson = run("set", ["--slug", "program-health", "--set", "title=Renewals"]);
    check("set: a value that is not JSON is refused with how to write it, and setting nothing at all is refused", notJson.code === 1 && /the value is not JSON/.test(notJson.stderr) && run("set", ["--slug", "program-health"]).code === 1 && run("set", ["--slug", "no-such", "--set", "title=\"x\""]).code === 1);
  }

  // ── validate, show, save ───────────────────────────────────────────────────
  const valid = run("validate", ["--slug", "program-health"]);
  check("validate: a valid draft passes with exit 0; with accounts off it NOTES that the selection numbers are unused, without calling it a problem",
    valid.code === 0 && valid.json?.ok === true && valid.json.which === "draft" && valid.json.problems.length === 0 && valid.json.notes.length === 0 &&
      validateSpec(defaultSpec({ slug: "x", tenantHost: "acme.gainsightcloud.com" })).notes.some((n) => /accounts\.pull is false: the four account-selection numbers are kept and unused/.test(n)), valid.json ?? valid.stderr);
  const shown = run("show", ["--slug", "program-health"]);
  const line = (label) => shown.json?.settings.find((x) => x.label === label)?.text.join(" ") ?? "";
  check("show: the spec in words, one entry per setting — the programs selector, the internal domain, the unsubscribe link, accounts on with its numbers, each group rule in order, the silent threshold, each page's tabs and status default, the cadence",
    shown.code === 0 && /programs that have sent since 90 days before each refresh/.test(line("Programs")) && /acme\.com are internal/.test(line("Internal recipients")) && /www\.acme\.com\/mail-settings are unsubscribe clicks/.test(line("Unsubscribe link")) &&
      /20 busiest accounts, the 15 lowest open rates among accounts with at least 10 delivered, and the 15 with the most bounces/.test(line("Accounts")) && /1\. Supergroup "Surveys": programs that send a survey\./.test(line("Groups")) && /1 program placed by hand/.test(line("Groups")) &&
      /no send in 45 days/.test(line("Silent programs")) && /Shows Active programs at first/.test(line("Pages")) && /programs of every status at first/.test(line("Pages")) && /2 panels/.test(line("Pages")) && /every month.*first Monday/.test(line("Refresh")), shown.json?.settings ?? shown.stderr);
  const saved = run("save", ["--slug", "program-health"]);
  const spec = existsSync(specAt(KB, "program-health")) ? readJson(specAt(KB, "program-health")) : null;
  check("save: the draft becomes the saved spec and the draft is gone; the saved file is the spec alone, with no draft wrapper",
    saved.code === 0 && saved.json?.replaced === false && !!spec && !existsSync(draftAt(KB, "program-health")) && spec.kind === "dashboard-spec" && !("answered" in spec) && isDeepStrictEqual(saved.json.pages, ["admin", "exec"]), saved.json ?? saved.stderr);
  if (WRITE_GOLDEN && spec) writeFileSync(GOLDEN, JSON.stringify(spec, null, 2) + "\n");
  const golden = existsSync(GOLDEN) ? readFileSync(GOLDEN, "utf8") : "";
  check("fixture specs round-trip: the spec built through draft, set and save is byte for byte the committed fixture spec, and the fixture reads back as a valid spec that equals the defaults plus the changes made",
    !!spec && readFileSync(specAt(KB, "program-health"), "utf8") === golden && openSpec(JSON.parse(golden)).slug === "program-health" && (() => {
      const want = defaultSpec({ slug: "program-health", title: "Program health", owner: "Acme CS Ops", tenantHost: "acme.gainsightcloud.com" });
      for (const [path, value] of CHANGES) setPath(want, path, value);
      return isDeepStrictEqual(spec, want);
    })());
  {
    const editing = run("draft", ["--slug", "program-health"]);
    const changed = set("program-health", [["health.silentDays", 60]]);
    const reshown = run("show", ["--slug", "program-health"]);
    check("edit: a draft over a saved spec starts from the saved spec; the saved one is untouched until save, and show reads the draft's value while --saved reads the saved one",
      editing.json?.state === "editing-saved" && changed.code === 0 && readJson(specAt(KB, "program-health")).health.silentDays === 45 && /no send in 60 days/.test(reshown.json.settings.find((x) => x.label === "Silent programs").text[0]) &&
        /no send in 45 days/.test(run("show", ["--slug", "program-health", "--saved"]).json.settings.find((x) => x.label === "Silent programs").text[0]));
    const resaved = run("save", ["--slug", "program-health"]);
    check("save over a saved spec replaces it and says so", resaved.json?.replaced === true && readJson(specAt(KB, "program-health")).health.silentDays === 60);
    // Back to the fixture's value, so the export below is the fixture.
    run("draft", ["--slug", "program-health"]); set("program-health", [["health.silentDays", 45]]); run("save", ["--slug", "program-health"]);
  }
  {
    writeFiles(KB, { "dashboards/broken/spec.json": JSON.stringify({ ...spec, slug: "broken", refresh: { cadence: "hourly", ownerNote: null }, extra: 1 }), "dashboards/future/spec.json": JSON.stringify({ ...spec, slug: "future", schemaVersion: 2 }) });
    const broken = run("validate", ["--slug", "broken"]);
    const future = run("validate", ["--slug", "future"]);
    check("validate: an invalid spec is refused with exit 1 and every problem named by its field; a spec of an unknown version is refused loudly, like a snapshot's",
      broken.code === 1 && broken.json?.ok === false && isDeepStrictEqual(broken.json.problems.map((p) => p.path).sort(), ["extra", "refresh.cadence"]) && future.code === 1 && /schemaVersion/.test(future.json.problems[0].path) && /refusing to read it \(T-11\)/.test(future.json.problems[0].problem) &&
        T11_SCHEMA_VERSION === 1 && (() => { try { openSpec({ ...spec, schemaVersion: 2 }); return false; } catch (e) { return /refusing to read it \(T-11\)/.test(e.message); } })(), [broken.json, future.json]);
    const noExport = run("export", ["--slug", "broken", "--out", join(ROOT, "broken.json")]);
    check("show and export refuse an invalid saved spec rather than describe or carry it, each in one line that names the field — never a stack trace",
      run("show", ["--slug", "broken"]).code === 1 && noExport.code === 1 && /refresh\.cadence must be one of/.test(noExport.stderr) && !/\n\s+at /.test(noExport.stderr) && !existsSync(join(ROOT, "broken.json")), noExport.stderr);
    check("a tenant's host may carry a port (it is what a URL gives); an email domain may not",
      validateSpec({ ...spec, tenantHost: "acme.localhost.test:8443" }).problems.length === 0 && validateSpec({ ...spec, tenantHost: "https://acme.gainsightcloud.com" }).problems.some((p) => p.path === "tenantHost") &&
        validateSpec({ ...spec, sources: [{ ...spec.sources[0], params: { ...spec.sources[0].params, internalDomains: ["acme.com:80"] } }] }).problems.some((p) => p.path === "sources[0].params.internalDomains[0]"));
  }

  // ── export, import ─────────────────────────────────────────────────────────
  const exportFile = join(ROOT, "handover", "program-health.export.json");
  writeFiles(ROOT, { "handover/.keep": "" });
  const exported = run("export", ["--slug", "program-health", "--out", exportFile]);
  const envelope = existsSync(exportFile) ? readFileSync(exportFile, "utf8") : "";
  check("export: one portable file — the spec in an envelope naming its tenant — that carries no path of this machine: not the KB's, not the temp dir's, no drive letter, no home directory",
    exported.code === 0 && JSON.parse(envelope).kind === "dashboard-spec-export" && JSON.parse(envelope).tenantHost === "acme.gainsightcloud.com" && isDeepStrictEqual(JSON.parse(envelope).spec, readJson(specAt(KB, "program-health"))) &&
      !envelope.includes(ROOT) && !envelope.includes(ROOT.replace(/\\/g, "/")) && !envelope.includes(JSON.stringify(ROOT).slice(1, -1)) && !/[A-Za-z]:\\\\|\/Users\/|\/home\/|\\\\Users\\\\/.test(envelope), exported.json ?? exported.stderr);
  const imported = run("import", ["--file", exportFile], KB2);
  check("export then import reproduces an identical spec: on a second KB folder of the same tenant the imported spec.json is byte for byte the original",
    imported.code === 0 && imported.json?.slug === "program-health" && readFileSync(specAt(KB2, "program-health"), "utf8") === readFileSync(specAt(KB, "program-health"), "utf8"), imported.json ?? imported.stderr);
  const wrongTenant = run("import", ["--file", exportFile], SBX);
  check("importing onto a different tenant is refused before anything is written, naming both tenants",
    wrongTenant.code === 1 && /exported from acme\.gainsightcloud\.com, and this KB belongs to acme--sbx\.gainsightcloud\.com/.test(wrongTenant.stderr) && !existsSync(join(SBX, "dashboards")), wrongTenant.stderr);
  {
    const forged = join(ROOT, "forged.json");
    writeFileSync(forged, JSON.stringify({ ...JSON.parse(envelope), tenantHost: "acme--sbx.gainsightcloud.com" }));
    check("the tenant check reads the SPEC's tenant, not the envelope's label: an export relabelled for the sandbox is still refused there",
      run("import", ["--file", forged], SBX).code === 1 && !existsSync(join(SBX, "dashboards")));
    const again = run("import", ["--file", exportFile], KB2);
    const replaced = run("import", ["--file", exportFile, "--replace"], KB2);
    const beside = run("import", ["--file", exportFile, "--slug", "program-health-copy"], KB2);
    check("import never overwrites silently: a dashboard already saved under the slug is refused unless --replace is passed, and --slug imports beside it under the new name",
      again.code === 1 && /already saved here/.test(again.stderr) && replaced.code === 0 && beside.code === 0 && readJson(specAt(KB2, "program-health-copy")).slug === "program-health-copy");
    run("draft", ["--slug", "program-health"], KB2);
    check("import refuses to land on a draft in progress", (() => { const r = run("import", ["--file", exportFile, "--replace"], KB2); return r.code === 1 && /a draft of "program-health" is in progress/.test(r.stderr); })());
    writeFileSync(join(ROOT, "notexport.json"), JSON.stringify(spec));
    writeFileSync(join(ROOT, "badexport.json"), JSON.stringify({ kind: "dashboard-spec-export", spec: { ...spec, pages: [] } }));
    check("import refuses a file that is not an export, and an export whose spec is not valid, naming the field",
      run("import", ["--file", join(ROOT, "notexport.json")], KB2).code === 1 && (() => { const r = run("import", ["--file", join(ROOT, "badexport.json")], KB2); return r.code === 1 && /pages must list at least one page/.test(r.stderr); })());
  }

  // ── list, and the refusals around the KB ───────────────────────────────────
  const listed = run("list", []);
  check("list: every dashboard of the KB with whether it is saved and whether a draft is in progress, its title, cadence and pages",
    listed.code === 0 && listed.json?.tenantHost === "acme.gainsightcloud.com" && isDeepStrictEqual(listed.json.dashboards.find((d) => d.slug === "program-health"), { slug: "program-health", saved: true, draft: false, title: "Acme program health", cadence: "monthly", pages: ["admin", "exec"] }), listed.json ?? listed.stderr);
  check("a folder that is not a tenant KB is refused, as are a missing --kb, a missing --slug, a slug that is not a plain name and an unknown mode; kbTenantHost reads the tenant from the manifest",
    run("draft", ["--slug", "x"], join(ROOT, "bare", "nokb")).code === 1 && runNode(SCRIPT, ["draft", "--slug", "x"]).status === 1 && run("draft", []).code === 1 && run("draft", ["--slug", "../up"]).code === 1 && run("frobnicate", ["--slug", "x"]).code === 1 &&
      kbTenantHost(KB) === "acme.gainsightcloud.com" && kbTenantHost(SBX) === "acme--sbx.gainsightcloud.com");

  // ── One writer; every field described ──────────────────────────────────────
  {
    const others = readdirSync(SCRIPTS).filter((f) => f.endsWith(".mjs") && f !== "dashboard-spec.mjs").filter((f) => { const src = readFileSync(join(SCRIPTS, f), "utf8"); return src.includes(SPEC_FILE) || src.includes(DRAFT_FILE) || /dashboards["'`/\\]/.test(src); });
    const own = readFileSync(SCRIPT, "utf8");
    check("the spec writer is the ONLY writer of spec files: no other shipped script names the spec file, the draft file or the dashboards folder, and inside the writer every write goes through one function",
      others.length === 0 && (own.match(/writeFileAtomicSync\(/g) ?? []).length === 1 && !/writeFileSync\(/.test(own) && (own.match(/writeSpecFile\(/g) ?? []).length >= 5, others);
    const leafPaths = (v, at = "") => (Array.isArray(v) ? v.flatMap((x, i) => leafPaths(x, `${at}[${i}]`)) : v && typeof v === "object" ? Object.entries(v).flatMap(([k, x]) => leafPaths(x, at ? `${at}.${k}` : k)) : [at]);
    const base = JSON.parse(golden);
    const SPOTS = ["", "sources[0]", "sources[0].params", "sources[0].params.selector", "globalFilters[0]", "accounts", "groups", "health", "pages[0]", "pages[0].tabs[0]", "freshness", "refresh", "publish", "native"];
    const at = (o, path) => path.split(/[.[\]]+/).filter(Boolean).reduce((x, k) => x[k], o);
    const undetected = SPOTS.filter((spot) => {
      const copy = structuredClone(base);
      (spot ? at(copy, spot) : copy).surprise = 1;
      return !validateSpec(copy).problems.some((p) => p.path === (spot ? `${spot}.surprise` : "surprise"));
    });
    check(`every field is described: a key no description covers is refused wherever it is added (${SPOTS.length} places, the top level to a tab), so a field cannot sit in a spec without a sentence that says what it does`, undetected.length === 0, undetected);
    // An EMPTY object or list has no leaf of its own: it is still refused when nothing describes it (the sweep found this unpinned).
    const emptyOnes = /** @type {Array<[string, *]>} */ ([["surprise", {}], ["surprise", []], ["s", {}]]).filter(([k, v]) => !validateSpec({ ...base, [k]: v }).problems.some((p) => p.path === k));
    const inner = structuredClone(base);
    inner.sources[0].params.extras = [];
    check("an unknown field that holds an empty object or an empty list is refused like any other, at the top level and inside a source; a known field may be empty",
      emptyOnes.length === 0 && validateSpec(inner).problems.some((p) => p.path === "sources[0].params.extras") && validateSpec({ ...base, groups: { rules: [], overrides: {} } }).problems.length === 0, emptyOnes);
    const said = describeSpec(base);
    check("describeSpec: every setting of the fixture reads as at least one sentence, in the table's order; the description is rendered from the spec — change a value and its sentence changes, and nothing else does",
      said.length === SPEC_DESCRIPTIONS.length && said.every((d) => d.label && d.text.length > 0 && d.text.every((t) => typeof t === "string" && t.trim().length > 3)) && (() => {
        const other = structuredClone(base);
        other.freshness.maxAgeDays = 7;
        const diff = describeSpec(other).filter((d, i) => !isDeepStrictEqual(d.text, said[i].text)).map((d) => d.label);
        return isDeepStrictEqual(diff, ["Freshness"]) && /more than 7 days old/.test(describeSpec(other).find((d) => d.label === "Freshness").text[0]);
      })(), said.filter((d) => !d.text.length));
    check("every value of an enum has its meaning as data: adapters, filters, tabs, cadences, panel types, presets — and a panel's metrics are the engine's own registry",
      [ADAPTERS, FILTERS, TABS, CADENCES, PANEL_TYPES].every((e) => Object.values(e).every((m) => typeof m === "string" && m.length > 5)) && Object.values(PRESETS).every((p) => p.meaning.length > 10 && isDeepStrictEqual(Object.keys(p.page.tabs), Object.keys(TABS))) &&
        isDeepStrictEqual(Object.keys(TABS), ["engagement", "health", "templates", "about"]) && leafPaths(base).length > 60 && base.pages[0].panels.every((p) => p.query.metrics.every((m) => METRICS.some((x) => x.id === m))));
  }
  {
    const o = { list: [1, 2], map: { a: { b: 1 } }, n: null };
    setPath(o, "list.2", 3); setPath(o, "list.0", 9); setPath(o, "map.a.b", 2); setPath(o, "map.c", { d: 1 }); setPath(o, "n", "set");
    const throws = (path) => { try { setPath({ list: [1], map: {}, v: 1 }, path, 1); return false; } catch { return true; } };
    check("setPath: sets an existing field, appends to a list by its next index, adds a key to an object — and refuses a gap in a list, a path through a plain value or a missing container, an empty path, and the object's own machinery",
      isDeepStrictEqual(o, { list: [9, 2, 3], map: { a: { b: 2 }, c: { d: 1 } }, n: "set" }) && ["list.5", "v.x", "map.nope.x", "", "list.x", "__proto__.a", "map.constructor.a", "a..b"].every(throws));
  }
} finally {
  removeTempDir(ROOT);
}

console.log(failures ? `\ndashboard-spec: ${failures} FAILED of ${total}` : `\ndashboard-spec: all ${total} checks passed`);
process.exit(failures ? 1 : 0);
