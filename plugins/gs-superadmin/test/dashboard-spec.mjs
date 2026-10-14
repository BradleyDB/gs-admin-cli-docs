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
  defaultSpec, validateSpec, describeSpec, describePanel, openSpec, setPath, kbTenantHost, presetPanels, panelKnobs, SPEC_DESCRIPTIONS, SPEC_FILE, DRAFT_FILE, T11_SCHEMA_VERSION,
  ADAPTERS, FILTERS, TABS, CADENCES, PANEL_TYPES, PRESETS, HEALTH_PANEL_TYPES, TEMPLATE_PANEL_TYPES, KNOBBED_PANEL_TYPES, DATE_DEFAULTS, pageTemplateContent,
  FRESHNESS_BY_CADENCE, windowOf, accountLists, accountFields, kbSettings, specStore, SpecRefusal,
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
  // The Templates tab is on, so the list gives it its panel (F-486, since TPL-2), with the snippet knob set.
  { id: "templates", tab: "templates", type: "templates", title: "Emails: text and search", knobs: { snippet: 40 } },
];
const CHANGES = /** @type {Array<[string, *]>} */ ([
  ["title", "Acme program health"], ["owner", "Acme CS Ops"], ["purpose", "Which programs need attention this month."],
  ["sources.0.params.selector.sentSince", "90d"], ["sources.0.params.internalDomains", ["acme.com"]], ["sources.0.params.unsubscribeLinks", ["https://www.acme.com/mail-settings"]],
  ["sources.0.params.pinnedAccounts", ["co-01"]], ["accounts.pull", true], ["groups.rules", RULES], ["groups.overrides.p-pilot", { group: "Pilots" }],
  ["health.silentDays", 45], ["pages.0.panels", PANELS], ["refresh.ownerNote", "Run on the first Monday."],
  // The fixture's admin page keeps a status default of its own (Active), so the pages hold one page with a default and one without.
  ["pages.0.statusDefault", ["PROCESSING"]],
]);

try {
  // ── draft, set, resume, save ───────────────────────────────────────────────
  const started = run("draft", ["--slug", "program-health", "--title", "Program health", "--owner", "Acme CS Ops"]);
  check("draft: a new draft is the defaults — one admin and one exec page, monthly, accounts and step detail off — bound to the KB's own tenant",
    started.code === 0 && started.json?.state === "new" && isDeepStrictEqual(started.json.answered, []) && existsSync(draftAt(KB, "program-health")) && !existsSync(specAt(KB, "program-health")) &&
      isDeepStrictEqual(readJson(draftAt(KB, "program-health")).spec, defaultSpec({ slug: "program-health", title: "Program health", owner: "Acme CS Ops", tenantHost: "acme.gainsightcloud.com" })), started.json ?? started.stderr);
  {
    const d = defaultSpec({ slug: "x", tenantHost: "acme.gainsightcloud.com" });
    check("defaults: 13 months (a rolling window), 2 months read again, R24's per-program account numbers OFF (0, ruled 2026-10-05) with the three cross-program lists of 25 and no company field, the knowledge base re-documented up to 50 per refresh, silent after 30 days, stale after 45 (monthly's), every status on both pages (the admin page opens on every program that sent, ruled 2026-10-05), the admin page on the whole window and the leaders' page on closed months, Health and Templates off on the exec page, About on both, no panel of their own (the presets' draw)",
      d.sources[0].params.windowMonths === 13 && isDeepStrictEqual(d.sources[0].params.window, { kind: "rolling" }) && d.sources[0].params.repullMonths === 2 && d.sources[0].params.stepDetail === false && d.sources[0].params.quietDueDays === 5 && d.sources[0].params.samplePrograms === 25 && isDeepStrictEqual(d.sources[0].params.expectedReasons, []) &&
        isDeepStrictEqual(d.accounts, { pull: false, busiest: 0, lowEngagement: 0, mostBounces: 0, lowEngagementMinDelivered: 10, lists: [{ kind: "most-engaged", n: 25, floor: 10 }, { kind: "least-engaged", n: 25, floor: 10 }, { kind: "most-bounced", n: 25, floor: 0 }], fields: [] }) &&
        isDeepStrictEqual(d.kb, { redocument: { enabled: true, cap: 50 } }) && FRESHNESS_BY_CADENCE.monthly === 45 &&
        d.health.silentDays === 30 && d.freshness.maxAgeDays === 45 && d.refresh.cadence === "monthly" && isDeepStrictEqual(d.pages.map((p) => [p.preset, p.statusDefault, p.dateDefault, p.tabs.filter((t) => t.enabled).map((t) => t.id).join(), p.panels.length]), [["admin", null, "window", "engagement,health,templates,about", 0], ["exec", null, "closed-months", "engagement,about", 0]]) &&
        d.pages[1].accountNames === false && d.publish.target === "none" && validateSpec(d).problems.length === 0);
    // The presets' own panels (DSH-4, choice A of 2026-10-09): valid as specs, every on tab given at least one, the health set shared.
    const withPreset = (i) => { const s = structuredClone(d); s.pages[i].panels = structuredClone(presetPanels(d.pages[i])); return s; };
    const adminPanels = presetPanels(d.pages[0]);
    const execPanels = presetPanels(d.pages[1]);
    check("presets: the admin preset's panels are the ruled set — headline figures, two charts, Programs, Emails, Steps, Survey responses, the three cross-program customer lists, then the health set (send health, program health, failure reasons, schedules, one-time programs, error rate by program), then the templates view (TPL-2), then the one-account view (ACC-2: drawn on the Engagement tab after the lists, last in the list so every earlier panel keeps its place); the leaders' preset's are headline figures, the two charts, By group, the top and lowest ten by open rate, with the health set and the templates view drawn only when their tabs are on; both validate as a spec's own panels",
      isDeepStrictEqual(adminPanels.map((p) => `${p.tab}:${p.type}:${p.id}`), ["engagement:kpi:headline", "engagement:line:open-rate-trend", "engagement:bar:sends-by-month", "engagement:table:programs", "engagement:table:emails", "engagement:table:steps", "engagement:table:survey-responses", "engagement:watchlist:most-engaged", "engagement:watchlist:least-engaged", "engagement:watchlist:most-bounced", "health:kpi:send-health", "health:health-silent:program-health", "health:health-reasons:failure-reasons", "health:health-schedules:schedules", "health:health-one-time:one-time", "health:table:error-rate", "templates:templates:templates", "engagement:account:account-view"]) &&
        isDeepStrictEqual(execPanels.map((p) => `${p.tab}:${p.type}:${p.id}`), ["engagement:kpi:headline", "engagement:line:open-rate-trend", "engagement:bar:sends-by-month", "engagement:table:by-group", "engagement:table:top-open-rate", "engagement:table:lowest-open-rate"]) &&
        validateSpec(withPreset(0)).problems.length === 0 && validateSpec(withPreset(1)).problems.length === 0 &&
        (() => { const s = structuredClone(d); s.pages[1].tabs.find((t) => t.id === "health").enabled = true; s.pages[1].tabs.find((t) => t.id === "templates").enabled = true; return presetPanels(s.pages[1]).filter((p) => p.tab === "health").map((p) => p.id).join() === adminPanels.filter((p) => p.tab === "health").map((p) => p.id).join() && presetPanels(s.pages[1]).filter((p) => p.tab === "templates").map((p) => p.id).join() === "templates"; })(),
      [adminPanels.map((p) => p.id), validateSpec(withPreset(0)).problems, validateSpec(withPreset(1)).problems]);
    check("every panel type has its meaning as data (the account view, ACC-2, a query type among them), the four health types and the templates type each declare their knobs with a check, a default and a sentence (the knobbed table is the five, each with its tab), and the three cross-program customer lists carry a delivered floor and rank 25 (ruled 2026-10-05; labels never say churn)",
      isDeepStrictEqual(Object.keys(PANEL_TYPES), ["kpi", "bar", "line", "table", "watchlist", "account", "health-silent", "health-reasons", "health-schedules", "health-one-time", "templates"]) && isDeepStrictEqual(Object.keys(HEALTH_PANEL_TYPES), ["health-silent", "health-reasons", "health-schedules", "health-one-time"]) &&
        isDeepStrictEqual(Object.keys(TEMPLATE_PANEL_TYPES), ["templates"]) && TEMPLATE_PANEL_TYPES.templates.tab === "templates" && isDeepStrictEqual(Object.keys(KNOBBED_PANEL_TYPES), [...Object.keys(HEALTH_PANEL_TYPES), "templates"]) && Object.values(KNOBBED_PANEL_TYPES).every((t) => ["health", "templates"].includes(t.tab)) &&
        Object.values(KNOBBED_PANEL_TYPES).every((t) => Object.values(t.knobs).every((k) => ["whole", "boolean"].includes(k.kind) && typeof k.default === "function" && typeof k.say(k.default(d)) === "string" && k.say(k.default(d)).length > 10)) &&
        isDeepStrictEqual(Object.keys(DATE_DEFAULTS), ["window", "closed-months"]) &&
        adminPanels.filter((p) => p.type === "watchlist").every((p) => p.query.limit === 25 && p.query.groupBy.join() === "account" && p.query.having.length === 1 && !/churn/i.test(p.title)) &&
        isDeepStrictEqual(panelKnobs(d, { type: "health-silent", knobs: {} }), { days: 30 }) && isDeepStrictEqual(panelKnobs(d, { type: "health-schedules", knobs: {} }), { staleAfterDays: 45 }) && isDeepStrictEqual(panelKnobs(d, { type: "health-one-time", knobs: { months: 3 } }), { months: 3 }) && isDeepStrictEqual(panelKnobs(d, { type: "health-reasons", knobs: {} }), { showExpected: false }) && isDeepStrictEqual(panelKnobs(d, { type: "health-silent" }), { days: 30 }) &&
        isDeepStrictEqual(panelKnobs(d, { type: "templates", knobs: {} }), { snippet: 50 }) && isDeepStrictEqual(panelKnobs(d, { type: "templates", knobs: { snippet: 80 } }), { snippet: 80 }));
    check("pages[].templateContent (TPL-2, additive): the admin preset writes it on, the exec preset off, a spec written before it existed takes the preset's, and a value that is not a switch is refused",
      d.pages[0].templateContent === true && d.pages[1].templateContent === false && pageTemplateContent({ preset: "exec" }) === false && pageTemplateContent({ preset: "admin" }) === true && pageTemplateContent({ preset: "exec", templateContent: true }) === true &&
        (() => { const s = structuredClone(d); delete s.pages[0].templateContent; return validateSpec(s).problems.length === 0; })() && (() => { const s = structuredClone(d); /** @type {any} */ (s).pages[1].templateContent = "yes"; return validateSpec(s).problems.some((p) => p.path === "pages[1].templateContent"); })() &&
        /template text \(subjects, bodies, the keyword search\) is on the page/.test(describeSpec(d).find((x) => x.label === "Pages").text[0]) && /is not on the page/.test(describeSpec(d).find((x) => x.label === "Pages").text[1 + adminPanels.length]));
    const bad = (edit) => { const s = structuredClone(d); s.pages[0].panels = structuredClone(adminPanels); edit(s); return validateSpec(s).problems.map((p) => `${p.path}: ${p.problem}`); };
    check("a health-typed panel with no knobs at all is accepted and takes the defaults, as the typedef marks them optional; knobs set to null is refused as a mistake",
      bad((s) => { delete s.pages[0].panels[11].knobs; }).length === 0 && bad((s) => { s.pages[0].panels[11].knobs = null; }).some((p) => /panels\[11\]\.knobs: must be an object \(an empty one, or none, takes the defaults: days\)/.test(p)),
      [bad((s) => { delete s.pages[0].panels[11].knobs; }), bad((s) => { s.pages[0].panels[11].knobs = null; })]);
    check("a health-typed panel is checked per type at change (ruled 2026-10-05, option B): a knob the type lacks, a value out of range, a query on a health view, knobs on a query panel, a health view off the health tab, a kpi grouped by something, a line not by month, a bar by two dimensions, a watchlist not by account, a chart mixing a rate with a count, and a date default outside the two are each refused by their field",
      bad((s) => { s.pages[0].panels[11].knobs = { days: 0, weeks: 1 }; }).join("|").includes("pages[0].panels[11].knobs.days: must be a whole number from 1 to 366") && bad((s) => { s.pages[0].panels[11].knobs = { weeks: 1 }; }).some((p) => /knobs\.weeks: is not a knob of a health-silent panel \(days\)/.test(p)) &&
        bad((s) => { s.pages[0].panels[11].query = { metrics: ["sent"] }; }).some((p) => /panels\[11\]\.query: is not a field of a health-silent panel/.test(p)) && bad((s) => { s.pages[0].panels[3].knobs = {}; }).some((p) => /panels\[3\]\.knobs: is not a field of a table panel/.test(p)) &&
        bad((s) => { s.pages[0].panels[11].tab = "engagement"; }).some((p) => /panels\[11\]\.tab: must be health/.test(p)) && bad((s) => { s.pages[0].panels[0].query.groupBy = ["program"]; }).some((p) => /panels\[0\]\.query\.groupBy: must be empty on a kpi panel/.test(p)) &&
        bad((s) => { s.pages[0].panels[1].query.groupBy = ["program"]; }).some((p) => /panels\[1\]\.query\.groupBy: must be \["month"\] on a line panel/.test(p)) && bad((s) => { s.pages[0].panels[2].query.groupBy = ["month", "program"]; }).some((p) => /panels\[2\]\.query\.groupBy: must name exactly one dimension on a bar panel/.test(p)) &&
        bad((s) => { s.pages[0].panels[7].query.groupBy = ["program"]; }).some((p) => /panels\[7\]\.query\.groupBy: must be \["account"\]/.test(p)) && bad((s) => { s.pages[0].panels[2].query.metrics = ["sent", "openRate"]; }).some((p) => /panels\[2\]\.query\.metrics: must be all rates or all counts on a bar panel/.test(p)) &&
        bad((s) => { s.pages[0].dateDefault = "all-time"; }).some((p) => /pages\[0\]\.dateDefault: must be one of window, closed-months/.test(p)) && bad((s) => { s.pages[0].panels[13].knobs = { staleAfterDays: true }; }).some((p) => /knobs\.staleAfterDays: must be a whole number/.test(p)) && bad((s) => { s.pages[0].panels[12].knobs = { showExpected: "yes" }; }).some((p) => /knobs\.showExpected: must be true or false/.test(p)),
      [bad((s) => { s.pages[0].panels[11].knobs = { days: 0, weeks: 1 }; }), bad((s) => { s.pages[0].panels[7].query.groupBy = ["program"]; })]);
    // The one-account view (ACC-2) is panel 17 of the admin preset: a query panel, checked per type like the charts.
    check("the one-account view (ACC-2) is a query panel checked per type: by program and month (or one of the two) and nothing else — grouped by account, or by anything but those two, it is refused by its field; its sentence on the About tab names it",
      adminPanels[17].type === "account" && bad(() => {}).length === 0 && bad((s) => { s.pages[0].panels[17].query.groupBy = ["month"]; }).length === 0 &&
        bad((s) => { s.pages[0].panels[17].query.groupBy = ["account"]; }).some((p) => /panels\[17\]\.query\.groupBy: must be \["program", "month"\], \["month"\] or \["program"\] on an account panel/.test(p)) &&
        bad((s) => { s.pages[0].panels[17].query.groupBy = ["program", "template"]; }).some((p) => /panels\[17\]\.query\.groupBy: must be/.test(p)) && bad((s) => { s.pages[0].panels[17].knobs = {}; }).some((p) => /panels\[17\]\.knobs: is not a field of an account panel/.test(p)) &&
        describePanel(d, adminPanels[17]) === `"One account, month by month" on the engagement tab: one account at a time, picked from the accounts the page carries (with the line for its day-by-day timeline beside it), as a table of Sent, Delivered, Opened, Open rate, Bounced by program and month.`,
      [bad((s) => { s.pages[0].panels[17].query.groupBy = ["account"]; }), describePanel(d, adminPanels[17])]);
    check("the templates view (TPL-2) is checked per type the same way: its snippet knob is a whole number from 10 to 300, a knob it lacks is refused, a query on it is refused, and off the templates tab it is refused by its field",
      bad((s) => { s.pages[0].panels[16].knobs = { snippet: 5 }; }).some((p) => /panels\[16\]\.knobs\.snippet: must be a whole number from 10 to 300/.test(p)) && bad((s) => { s.pages[0].panels[16].knobs = { radius: 5 }; }).some((p) => /knobs\.radius: is not a knob of a templates panel \(snippet\)/.test(p)) &&
        bad((s) => { s.pages[0].panels[16].query = { metrics: ["sent"] }; }).some((p) => /panels\[16\]\.query: is not a field of a templates panel/.test(p)) && bad((s) => { s.pages[0].panels[16].tab = "engagement"; }).some((p) => /panels\[16\]\.tab: must be templates: a templates panel is the templates view/.test(p)) &&
        bad((s) => { s.pages[0].panels[16].knobs = { snippet: 120 }; }).length === 0 && bad((s) => { delete s.pages[0].panels[16].knobs; }).length === 0,
      [bad((s) => { s.pages[0].panels[16].knobs = { snippet: 5 }; }), bad((s) => { s.pages[0].panels[16].tab = "engagement"; })]);
    check("F-486: a list of panels that leaves an on tab with none is refused by name (Templates included since TPL-2 gave it its panel type), an empty list takes the preset's, and a page may still turn a tab off",
      bad((s) => { s.pages[0].panels = s.pages[0].panels.filter((p) => p.tab !== "health"); }).join("|").includes("pages[0].panels: lists no panel for the health tab, which is on") && bad((s) => { s.pages[0].panels = s.pages[0].panels.filter((p) => p.tab !== "engagement"); }).some((p) => /lists no panel for the engagement tab/.test(p)) &&
        bad((s) => { s.pages[0].panels = s.pages[0].panels.filter((p) => p.tab !== "templates"); }).some((p) => /lists no panel for the templates tab, which is on/.test(p)) &&
        bad((s) => { s.pages[0].panels = []; }).length === 0 && bad((s) => { s.pages[0].tabs.find((t) => t.id === "health").enabled = false; s.pages[0].panels = s.pages[0].panels.filter((p) => p.tab !== "health"); }).length === 0 && bad((s) => { s.pages[0].tabs.find((t) => t.id === "templates").enabled = false; s.pages[0].panels = s.pages[0].panels.filter((p) => p.tab !== "templates"); }).length === 0);
    check("describePanel says each panel exactly: a query panel's type, metrics, grouping and top-N, a health view's type and every knob's sentence from the type's own table, so a knob cannot sit in a spec without words for it",
      describePanel(d, adminPanels[3]) === `"Programs" on the engagement tab: a table of Sent, Unique recipients, Accounts reached, Delivered, Opened, Open rate, Clicked, Click rate, Bounced, Send failures, Error rate by program.` &&
        describePanel(d, execPanels[4]) === `"Top programs by open rate" on the engagement tab: a table of Sent, Open rate by program, the top 10 by Open rate.` &&
        // F-508: the direction names the end of the ranking a limit keeps, pinned on both preset directions.
        describePanel(d, execPanels[5]) === `"Lowest open rates" on the engagement tab: a table of Sent, Open rate by program, the 10 lowest by Open rate.` &&
        describePanel(d, adminPanels.find((p) => p.id === "least-engaged")).endsWith("by account, the 25 lowest by Open rate.") && describePanel(d, adminPanels.find((p) => p.id === "most-engaged")).endsWith("by account, the top 25 by Open rate.") && describePanel(d, adminPanels.find((p) => p.id === "most-bounced")).endsWith("by account, the top 25 by Bounced.") &&
        [...adminPanels, ...execPanels].filter((p) => p.query?.limit != null).every((p) => describePanel(d, p).includes(p.query.sort?.[0]?.dir === "asc" ? `the ${p.query.limit} lowest by` : `the top ${p.query.limit} by`)) &&
        describePanel(d, adminPanels[11]) === `"Program health" on the health tab: ${PANEL_TYPES["health-silent"]}; the no-send threshold starts at 30 days (14, 30, 60 and 90 are one click away).` &&
        describePanel(d, { ...adminPanels[14], knobs: { months: 12 } }).endsWith("each program's sends over the last 12 months.") && describeSpec(d).find((x) => x.label === "Pages").text.length === 2 + adminPanels.length + execPanels.length &&
        describePanel(d, adminPanels[16]) === `"Emails: text and search" on the templates tab: ${PANEL_TYPES.templates}; a search hit shows 50 characters of context either side.` && describePanel(d, { ...adminPanels[16], knobs: { snippet: 40 } }).endsWith("shows 40 characters of context either side.") &&
        describeSpec(d).find((x) => x.label === "Pages").text[0].includes("Starts on the whole window, with the current month marked provisional.") && describeSpec(d).find((x) => x.label === "Pages").text[1 + adminPanels.length].includes("Starts on the closed months, with the current month one click away."),
      [describePanel(d, adminPanels[3]), describePanel(d, execPanels[4]), describePanel(d, adminPanels[11])]);
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
      validateSpec(defaultSpec({ slug: "x", tenantHost: "acme.gainsightcloud.com" })).notes.some((n) => /accounts\.pull is false: the account-selection numbers and the customer lists are kept and unused/.test(n)), valid.json ?? valid.stderr);
  const shown = run("show", ["--slug", "program-health"]);
  const line = (label) => shown.json?.settings.find((x) => x.label === label)?.text.join(" ") ?? "";
  check("show: the spec in words, one entry per setting — the programs selector, the internal domain, the unsubscribe link, accounts on with its numbers, each group rule in order, the silent threshold, each page's tabs and status default, the cadence",
    shown.code === 0 && /programs that have sent since 90 days before each refresh/.test(line("Programs")) && /acme\.com are internal/.test(line("Internal recipients")) && /www\.acme\.com\/mail-settings are unsubscribe clicks/.test(line("Unsubscribe link")) &&
      /Customer lists are on: across programs over the whole window, the 25 most engaged \(at least 10 delivered\), the 25 least engaged \(at least 10 delivered\), the 25 most bounced; every kept account has its own rows/.test(line("Accounts")) && !/Per program as well/.test(line("Accounts")) && /1\. Supergroup "Surveys": programs that send a survey\./.test(line("Groups")) && /1 program placed by hand/.test(line("Groups")) &&
      /The last 13 months, the current one included/.test(line("Window")) && /re-documents the programs the knowledge base is behind on .* up to 50 assets per refresh/.test(line("Knowledge base")) && /5 due days admitting nobody/.test(line("Failure settings")) &&
      /no send in 45 days/.test(line("Silent programs")) && /Shows Active programs at first/.test(line("Pages")) && /programs of every status at first/.test(line("Pages")) && /3 panels/.test(line("Pages")) && /No panel of its own: the exec preset's 6 panels/.test(line("Pages")) && /every month.*first Monday/.test(line("Refresh")), shown.json?.settings ?? shown.stderr);
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
  check("list: every dashboard of the KB with whether it is saved and whether a draft is in progress, its title and pages — and no cadence (ruled 2026-10-12: refreshes are manual; F-511 instance 22)",
    listed.code === 0 && listed.json?.tenantHost === "acme.gainsightcloud.com" && isDeepStrictEqual(listed.json.dashboards.find((d) => d.slug === "program-health"), { slug: "program-health", saved: true, draft: false, title: "Acme program health", pages: ["admin", "exec"], draftBy: null, draftUpdatedAt: null, draftAnswered: null }) && !JSON.stringify(listed.json).includes("cadence"), listed.json ?? listed.stderr);
  // ── The draft's holder (ruled 2026-10-05, DSH-1 item 8) ───────────────────
  {
    const mine = run("draft", ["--slug", "held", "--by", "ana"]);
    const theirs = run("draft", ["--slug", "held", "--by", "ben"]);
    const theirSet = set("held", [["title", "Ben's"]], ["--by", "ben"]);
    const resumedByAna = run("draft", ["--slug", "held", "--by", "ana"]);
    const taken = run("draft", ["--slug", "held", "--by", "ben", "--take-over"]);
    const nowBen = set("held", [["title", "Ben's"]], ["--by", "ben"]);
    const lst = run("list", []).json?.dashboards.find((d) => d.slug === "held");
    check("a draft records its holder; another holder's draft (or set) is refused naming the holder and the time without --take-over, the same holder resumes it, a take-over records whom it was taken from and the new holder continues; list shows the draft's holder and date",
      mine.code === 0 && mine.json?.by === "ana" && theirs.code === 1 && /held by ana \(last changed /.test(theirs.stderr) && theirSet.code === 1 && /held by ana/.test(theirSet.stderr) && resumedByAna.code === 0 && resumedByAna.json?.state === "resumed" &&
        taken.code === 0 && taken.json?.by === "ben" && taken.json.takenOverFrom === "ana" && nowBen.code === 0 && lst?.draft === true && lst.draftBy === "ben" && typeof lst.draftUpdatedAt === "string" && lst.draftAnswered === 0,
      [mine.json, theirs.stderr?.slice(-200), taken.json, lst]);
    const drafted = readJson(draftAt(KB, "held"));
    check("the holder is the draft file's own field (`by`), beside startedAt and updatedAt; the spec inside is untouched by it", drafted.by === "ben" && !("by" in drafted.spec) && validateSpec(drafted.spec).problems.length === 0);
    run("save", ["--slug", "held"]);
  }
  // ── The additive fields (S5): the window kind, the customer lists and company fields, the knowledge base ──
  {
    const base = defaultSpec({ slug: "x", tenantHost: "acme.gainsightcloud.com" });
    const withSet = (edit) => { const s = structuredClone(base); edit(s); return validateSpec(s).problems.map((p) => `${p.path}: ${p.problem}`); };
    check("the window kind: rolling, fixed {from, to} and since {from} are each valid; an unknown kind, a month not as YYYY-MM, a fixed window ending before it starts, and a field the kind lacks are refused by field; the sentence says each kind; a spec with no window field is rolling",
      withSet((s) => { s.sources[0].params.window = { kind: "fixed", from: "2025-01", to: "2025-12" }; }).length === 0 && withSet((s) => { s.sources[0].params.window = { kind: "since", from: "2024-07" }; }).length === 0 &&
        withSet((s) => { s.sources[0].params.window = { kind: "weekly" }; }).some((p) => /params\.window: must be/.test(p)) && withSet((s) => { s.sources[0].params.window = { kind: "fixed", from: "2025-13", to: "2025-12" }; }).some((p) => /window\.from: must be a month/.test(p)) &&
        withSet((s) => { s.sources[0].params.window = { kind: "fixed", from: "2025-12", to: "2025-01" }; }).some((p) => /window\.to: must not be earlier/.test(p)) && withSet((s) => { s.sources[0].params.window = { kind: "rolling", from: "2025-01" }; }).some((p) => /window\.from: is not a field of a rolling window/.test(p)) &&
        (() => { const s = structuredClone(base); s.sources[0].params.window = { kind: "fixed", from: "2025-01", to: "2025-12" }; return /The months from 2025-01 to 2025-12, the same every refresh/.test(describeSpec(s).find((x) => x.label === "Window").text[0]); })() &&
        (() => { const s = structuredClone(base); s.sources[0].params.window = { kind: "since", from: "2024-07" }; return /Every month from 2024-07 to the current one/.test(describeSpec(s).find((x) => x.label === "Window").text[0]); })() &&
        (() => { const s = structuredClone(base); delete s.sources[0].params.window; return validateSpec(s).problems.length === 0 && isDeepStrictEqual(windowOf(s.sources[0].params), { kind: "rolling" }); })());
    check("the customer lists are data: each {kind, n, floor, per?}; an unknown kind, a size of 0, a per that names no company field, and an unknown key are refused by field; a company field must be an API name; a spec with neither field takes the three defaults and no field",
      withSet((s) => { s.accounts.lists = [{ kind: "most-bounced", n: 10, floor: 0 }]; }).length === 0 && withSet((s) => { s.accounts.fields = ["Industry"]; s.accounts.lists = [{ kind: "least-engaged", n: 5, floor: 3, per: "Industry" }]; }).length === 0 &&
        withSet((s) => { s.accounts.lists = [{ kind: "churn", n: 10, floor: 0 }]; }).some((p) => /lists\[0\]\.kind: must be one of most-engaged, least-engaged, most-bounced/.test(p)) && withSet((s) => { s.accounts.lists = [{ kind: "most-bounced", n: 0, floor: 0 }]; }).some((p) => /lists\[0\]\.n: must be a whole number from 1/.test(p)) &&
        withSet((s) => { s.accounts.lists = [{ kind: "most-engaged", n: 5, floor: 1, per: "Region" }]; }).some((p) => /lists\[0\]\.per: must name one of accounts\.fields/.test(p)) && withSet((s) => { s.accounts.lists = [{ kind: "most-engaged", n: 5, floor: 1, top: 1 }]; }).some((p) => /lists\[0\]\.top: is not a field of a customer list/.test(p)) &&
        withSet((s) => { s.accounts.fields = ["Industry Name"]; }).some((p) => /fields\[0\]: must be a company field's API name/.test(p)) &&
        (() => { const s = structuredClone(base); delete s.accounts.lists; delete s.accounts.fields; return validateSpec(s).problems.length === 0 && accountLists(s).length === 3 && accountLists(s)[1].kind === "least-engaged" && accountFields(s).length === 0; })());
    check("the knowledge-base settings: kb.redocument {enabled, cap}; a cap below 0 and an unknown key are refused; absent is on with a cap of 50; the sentence says what a refresh re-documents",
      withSet((s) => { s.kb = { redocument: { enabled: false, cap: 0 } }; }).length === 0 && withSet((s) => { s.kb = { redocument: { enabled: true, cap: -1 } }; }).some((p) => /kb\.redocument\.cap: must be a whole number from 0/.test(p)) && withSet((s) => { s.kb = { redocument: { enabled: true, cap: 5, budget: 1 } }; }).some((p) => /kb\.redocument\.budget: is not a field/.test(p)) &&
        (() => { const s = structuredClone(base); delete s.kb; return validateSpec(s).problems.length === 0 && isDeepStrictEqual(kbSettings(s), { redocument: { enabled: true, cap: 50 } }); })() &&
        /leaves the knowledge base alone/.test(describeSpec({ ...base, kb: { redocument: { enabled: false, cap: 50 } } }).find((x) => x.label === "Knowledge base").text[0]));
    check("the failure settings: quietDueDays (1 up), samplePrograms (0 up) and expectedReasons (texts, no repeat) are checked; absent is valid; freshness by cadence is data (weekly 10, monthly 45, quarterly 120, manual the validator's upper bound)",
      withSet((s) => { s.sources[0].params.quietDueDays = 0; }).some((p) => /quietDueDays: must be a whole number from 1/.test(p)) && withSet((s) => { s.sources[0].params.expectedReasons = ["a", "a"]; }).some((p) => /expectedReasons: lists a value twice/.test(p)) &&
        (() => { const s = structuredClone(base); delete s.sources[0].params.quietDueDays; delete s.sources[0].params.samplePrograms; delete s.sources[0].params.expectedReasons; return validateSpec(s).problems.length === 0; })() &&
        isDeepStrictEqual(FRESHNESS_BY_CADENCE, { weekly: 10, monthly: 45, quarterly: 120, manual: 3660 }) && validateSpec({ ...base, freshness: { maxAgeDays: FRESHNESS_BY_CADENCE.manual } }).problems.length === 0);
    // The verbs as functions: the entry command imports them and never spawns the writer; the store refuses a folder that is no KB.
    const store = specStore(KB);
    check("specStore: the writer's verbs are functions (draft, set, validate, save, list, export, import) over one KB folder, each refusing with a SpecRefusal the CLI prints as one line; a folder that is no KB is refused at the store",
      typeof store.startDraft === "function" && typeof store.setDraft === "function" && typeof store.save === "function" && typeof store.exportSpec === "function" && typeof store.importSpec === "function" && typeof store.listDashboards === "function" && store.tenantHost === "acme.gainsightcloud.com" &&
        (() => { try { specStore(join(ROOT, "bare", "nokb")); return false; } catch (e) { return e instanceof SpecRefusal && /no _manifest\.json there/.test(e.message); } })() &&
        (() => { try { store.setDraft("program-health", { sets: [["title", "x"]] }); return false; } catch (e) { return e instanceof SpecRefusal && /no draft of "program-health"/.test(e.message); } })());
  }
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
        // Freshness is kept in the contract and read by nothing (ruled 2026-10-12): its sentence says so, with the value.
        return isDeepStrictEqual(diff, ["Freshness"]) && /^7 days; not read by the pages/.test(describeSpec(other).find((d) => d.label === "Freshness").text[0]) && /not read: refreshes are run by hand/.test(said.find((d) => d.label === "Refresh").text[0]);
      })(), said.filter((d) => !d.text.length));
    check("every value of an enum has its meaning as data: adapters, filters, tabs, cadences, panel types, presets — and a panel's metrics are the engine's own registry",
      [ADAPTERS, FILTERS, TABS, CADENCES, PANEL_TYPES].every((e) => Object.values(e).every((m) => typeof m === "string" && m.length > 5)) && Object.values(PRESETS).every((p) => p.meaning.length > 10 && isDeepStrictEqual(Object.keys(p.page.tabs), Object.keys(TABS))) &&
        isDeepStrictEqual(Object.keys(TABS), ["engagement", "health", "templates", "about"]) && leafPaths(base).length > 60 && base.pages[0].panels.filter((p) => p.query).every((p) => p.query.metrics.every((m) => METRICS.some((x) => x.id === m))) && base.pages[0].panels.some((p) => p.type === "templates"));
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
