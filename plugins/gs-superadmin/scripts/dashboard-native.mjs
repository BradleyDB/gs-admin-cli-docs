// ─────────────────────────────────────────────────────────────────────────────
// dashboard-native.mjs — which panels of an engagement dashboard Gainsight's
// own reports can carry, and the exact `gs-admin rp create` / `rp update` line
// for each one that can (NAT-1); the readers NAT-2's record and read-back steps
// use. PURE: nothing is read, written or spawned here. The entry command
// (dashboard.mjs native-plan / native-record / native-verify) owns the files
// and the read-only calls; the mutating lines this module writes are only ever
// TEXT — the skill issues each one as its own visible command, so the mutation
// guard asks (house rule 4; AGENTS.md tenets 1 and 3). No script runs them.
//
// What a native report can carry, as measured (the spike's (e), 2026-10-02, on
// CLI 1.0.10; read off the CLI's report handler at the pin):
//   - COUNT reports over the delivery log, grouped by program, email or month:
//     a GRID report. The CLI cannot author a ratio or a conditional column
//     (its formula grammar differs from the one UI-saved reports use, and a raw
//     expression is refused client-side), so every figure beyond the report's
//     one COUNT column is a CALCULATED column the admin adds in the Gainsight
//     UI, with the condition or the formula this module writes out. After that
//     `rp run-saved` reads the report back: rows keyed by column LABEL, every
//     value a display-formatted string (shapes/e-3).
//   - No date literal: the CLI's filter builder (enrichFilterConditions) keeps
//     a condition's value only, so a relative window (LAST_N_MONTHS, used with
//     EQ, never BTW) cannot be saved through it, and a fixed one would go
//     stale. The dashboard's months, like its other global filters (programs,
//     status, groups, the internal recipients), are DASHBOARD filters the admin
//     sets in the Gainsight UI; the steps say which.
//   - Program status, the dashboard's groups, step names, template text, the
//     distinct counts' rules, content-link clicks, survey responses and the
//     health tables are not on the delivery log (or not in the form a report
//     reads): a panel that needs one gets that reason, never a guessed payload.
// Every field name, standing filter and flag condition is read from the
// engine's SOURCES and METRICS (A-1): the formula an admin is told to add is
// the one the dashboard computes.
//
// Citations: NAT-n are work items and Rnn rulings of the maintainer's
// unpublished JO-dashboards plan; F-nnn are findings.
// ─────────────────────────────────────────────────────────────────────────────

import { SOURCES, metric } from "./engagement-query.mjs";
import { presetPanels } from "./dashboard-spec.mjs";
import { shellWord } from "./dashboard-runtime.mjs";

/**
 * @typedef {import("./dashboard-spec.mjs").T11Spec} T11Spec
 * @typedef {import("./dashboard-spec.mjs").T11Page} T11Page
 * @typedef {import("./dashboard-spec.mjs").T11Panel} T11Panel
 *
 * One panel's entry in a native plan. `payload` is what the report is saved with (null when not native); `hash`,
 * `name`, `columns` and `uiColumns` are set with it; `action`, `sameAs` and `reportId` are nativePlan's.
 * @typedef {object} NativeEntry
 * @property {string} key  "<page id>/<panel id>"
 * @property {string} page
 * @property {string} panel
 * @property {string} title
 * @property {string} type
 * @property {"native"|"partial"|"not"} status
 * @property {Array<{reason: string, text: string, detail?: string}>} reasons
 * @property {Array<{metric: string, label: string, reason: string, text: string}>} leftOut
 * @property {?{name: string, object: string, showFields: Array<*>, groupBy: Array<*>, whereFilters: {conditions: Array<*>}, displayType: string}} payload
 * @property {Array<{kind: string, column: string, text: string}>} uiSteps
 * @property {string} [hash]
 * @property {string} [name]
 * @property {string[]} [columns]
 * @property {string[]} [uiColumns]
 * @property {"create"|"update"|"unchanged"|"shared"|"none"} [action]
 * @property {string} [sameAs]
 * @property {?string} [reportId]
 */

const LOG = SOURCES.log;
/** The object every native report reads: the delivery log, the dashboard's default source (R21). */
export const NATIVE_OBJECT = LOG.object;
/** The name prefix of a test run's reports (sandbox only; NAT-2): Gainsight's convention for a throwaway asset. */
export const TEST_PREFIX = "ZZ|TEST|";
/** The display every native report is saved with: a grid, the shape the spike proved; a chart is the admin's choice in the UI. */
export const NATIVE_DISPLAY = "GRID";

/**
 * How each dimension a panel groups by reads on the delivery log: the field the dashboard groups by (from SOURCES)
 * and its name beside it, so a report row reads as a name and stays exact when two names are alike. A dimension not
 * here is not on the log in a form a report can group by; NOT_NATIVE says why.
 */
export const NATIVE_DIMENSIONS = Object.freeze({
  program: Object.freeze([{ name: "SourceName", displayName: "Program" }, { name: LOG.programField, displayName: "Program id" }]),
  template: Object.freeze([{ name: "EmailTemplateName", displayName: "Email" }, { name: LOG.templateField, displayName: "Email id" }]),
  month: Object.freeze([{ name: LOG.dateField, summarize: "Month", displayName: "Month" }]),
});

/** Why a panel or a figure cannot be a native report's, in the admin's words: one sentence per reason, as data. */
export const NOT_NATIVE = Object.freeze({
  "step-names": "needs step and variant names, which the dashboard reads from the knowledge base and the step-detail log; the delivery log has no step",
  "account-selection": "needs the customer lists the pull ranks (each account's rank across programs, with a floor), which a report cannot reproduce",
  "recipient-class": "needs the internal and external split the pull makes (one filtered read per internal domain); a report can leave internal recipients out with a dashboard filter, never split by it",
  "program-groups": "needs the dashboard's own program groups, which are its rules, not data in Gainsight",
  "program-list": "needs the program's model or audience from the program list, which the delivery log does not carry",
  "content-clicks": "needs content-link clicks, which the pull classifies from each send's link detail after the read (unsubscribe and mailto links left out); the delivery log's own click count includes them",
  uniques: "needs the distinct-count rules (exact per program, never added across programs); a report's total row would add them",
  "survey-object": "reads survey participants, a different object from the delivery log; one report reads one object",
  health: "needs the health tables the pull builds: failure counts by category, masked messages and schedules from the knowledge base",
  "template-text": "needs each email's text, which comes from the knowledge base, never the delivery log",
  "no-native-figure": "has no figure a report on the delivery log can carry",
  "field-missing": "names a field this tenant's delivery log does not have (read from rp schema), so the CLI would drop the filter silently",
  "picklist-filter": "filters a picklist field, whose values must be option ids; the plan does not guess them",
});
const DIMENSION_REASONS = Object.freeze({ step: "step-names", variant: "step-names", account: "account-selection", recipientClass: "recipient-class", supergroup: "program-groups", group: "program-groups", model: "program-list", audience: "program-list" });
const TYPE_REASONS = Object.freeze({ watchlist: "account-selection", account: "account-selection", templates: "template-text", "health-silent": "health", "health-reasons": "health", "health-schedules": "health", "health-one-time": "health" });

/** A delivery-log condition as the CLI's where-filter takes it (`{leftOperand: {fieldName}, operator, rightOperand: {value}}`). */
const condition = (field, op, value) => ({ leftOperand: { fieldName: field }, operator: op, rightOperand: { value } });
/** The standing filters every count carries (Source, AddressType), from SOURCES. */
const standing = () => LOG.standing.map((s) => condition(s.field, s.op, s.value));
/** A flag condition of the registry, as a where-filter: set is EQ the value; not set is NE (which keeps a null, as "not set" means). */
const flagCondition = (c) => condition(LOG.flags[c.flag].field, c.is ? "EQ" : "NE", LOG.flags[c.flag].value);
/** A flag condition in words for the UI's calculated field: `IsSent = "YES"` / `IsBounced is not "YES"`. */
const flagWords = (c) => `${LOG.flags[c.flag].field} ${c.is ? "=" : "is not"} "${LOG.flags[c.flag].value}"`;

/**
 * What a figure takes on a delivery-log report: a COUNT of the attempts that meet its conditions (`counts`, AND or
 * OR), a ratio of two such counts, or a reason it cannot be carried.
 * @param {string} id
 * @returns {{kind: "count", id: string, label: string, counts: Array<{flag: string, is: boolean}>, match: "all"|"any"} | {kind: "rate", id: string, label: string, numerator: string, denominator: string} | {kind: "not", id: string, label: string, reason: string}}
 */
export function nativeFigure(id) {
  const m = metric(id);
  if (m.kind === "count" && m.source === "log" && Array.isArray(m.counts)) return { kind: "count", id, label: m.label, counts: m.counts, match: m.match };
  if (m.kind === "count") return { kind: "not", id, label: m.label, reason: "content-clicks" };
  if (m.kind === "rate") {
    const parts = [nativeFigure(m.numerator), nativeFigure(m.denominator)];
    const bad = parts.find((p) => p.kind !== "count");
    if (bad) return { kind: "not", id, label: m.label, reason: bad.kind === "not" ? bad.reason : "no-native-figure" };
    return { kind: "rate", id, label: m.label, numerator: m.numerator, denominator: m.denominator };
  }
  if (m.kind === "distinct") return { kind: "not", id, label: m.label, reason: "uniques" };
  return { kind: "not", id, label: m.label, reason: "survey-object" };
}

/** The key a panel's report is recorded under in T-11 `native.reports[].panel`: the page and the panel, so the two pages' panels never share one. */
export const panelKey = (page, panel) => `${page.id}/${panel.id}`;
/** A report's name: the prefix (empty, or the test prefix), the dashboard, the page and the panel, as titled. */
export const reportName = (spec, page, panel, prefix = "") => `${prefix}${spec.title} - ${page.title} - ${panel.title}`;

/**
 * A stable fingerprint of what a report is saved with (FNV-1a over its JSON): a recorded report whose fingerprint
 * differs from the plan's is a changed panel (rp update); the same fingerprint, unchanged (skipped).
 * @param {*} payload
 */
export function planHash(payload) {
  let h = 0x811c9dc5;
  const text = JSON.stringify(payload);
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * One panel's native verdict: what a report on the delivery log can carry of it, and the steps in the Gainsight UI
 * that complete it. `status` native (every figure), partial (some figures left out, each with its reason), or not
 * (the panel's type or grouping needs what the log does not hold, or no figure is left).
 * @param {T11Spec} spec @param {T11Page} page @param {T11Panel} panel
 * @param {{prefix?: string, schema?: ?Array<{fieldName: string, dataType: string}>}} [opts] `schema`: rp schema's
 *   fields of the delivery log; with it every field the report names is checked (the CLI drops an unknown filter
 *   field silently, the spike's fact 9), and a picklist filter is refused (its values are option ids)
 * @returns {NativeEntry}
 */
export function panelNative(spec, page, panel, { prefix = "", schema = null } = {}) {
  const key = panelKey(page, panel);
  const base = { key, page: page.id, panel: panel.id, title: panel.title, type: panel.type };
  /** @type {(reason: string, detail?: ?string) => NativeEntry} */
  const not = (reason, detail = null) => ({ ...base, status: /** @type {const} */ ("not"), reasons: [{ reason, text: NOT_NATIVE[reason], ...(detail ? { detail } : {}) }], payload: null, uiSteps: [], leftOut: [] });
  if (TYPE_REASONS[panel.type]) return not(TYPE_REASONS[panel.type]);
  const query = panel.query ?? { groupBy: [], metrics: [] };
  const groupBy = query.groupBy ?? [];
  const badDim = groupBy.find((d) => !NATIVE_DIMENSIONS[d]);
  if (badDim) return not(DIMENSION_REASONS[badDim] ?? "no-native-figure", badDim);
  const figures = (query.metrics ?? []).map(nativeFigure);
  const leftOut = figures.filter((f) => f.kind === "not").map((f) => ({ metric: f.id, label: f.label, reason: f.kind === "not" ? f.reason : "", text: f.kind === "not" ? NOT_NATIVE[f.reason] : "" }));
  const kept = figures.filter((f) => f.kind !== "not");
  if (!kept.length) return { ...not("no-native-figure"), leftOut };
  // The counts the kept figures need, in the panel's order: its own counts, then each rate's two parts.
  /** @type {string[]} */
  const counts = [];
  for (const f of kept) for (const id of f.kind === "rate" ? [f.numerator, f.denominator] : [f.id]) if (!counts.includes(id)) counts.push(id);
  const countOf = (id) => /** @type {{kind: "count", id: string, label: string, counts: Array<{flag: string, is: boolean}>, match: "all"|"any"}} */ (nativeFigure(id));
  // The report's ONE native column: every attempt (Sent) — or, when the panel needs exactly one count whose conditions
  // all hold together (AND), that count itself, its conditions in the report's filter, so nothing is left to add.
  const only = counts.length === 1 ? countOf(counts[0]) : null;
  const filtered = !!only && only.counts.length > 0 && only.match === "all";
  const baseCount = filtered && only ? only : countOf("sent");
  const where = { conditions: [...standing(), ...(filtered && only ? only.counts.map(flagCondition) : [])] };
  const showFields = [{ name: "Gsid", aggregation: "COUNT", displayName: baseCount.label }];
  const groupFields = groupBy.flatMap((d) => NATIVE_DIMENSIONS[d].map((g) => ({ ...g })));
  // Each other count is a calculated column in the UI (a SUM of 1 where the conditions hold), each rate a formula.
  /** @type {Array<{kind: string, column: string, text: string}>} */
  const uiSteps = [];
  for (const id of counts) {
    if (id === baseCount.id) continue;
    const c = countOf(id);
    const when = c.counts.length ? c.counts.map(flagWords).join(c.match === "any" ? " OR " : " AND ") : "every row";
    uiSteps.push({ kind: "calculated-column", column: c.label, text: `Add a calculated column "${c.label}": the SUM of a field that is 1 when ${when}, else 0 (${c.label}: ${metric(id).definition})` });
  }
  for (const f of kept) {
    if (f.kind !== "rate") continue;
    uiSteps.push({ kind: "formula-column", column: f.label, text: `Add a formula column "${f.label}" = "${metric(f.numerator).label}" ÷ "${metric(f.denominator).label}", left empty when "${metric(f.denominator).label}" is 0 (the dashboard shows no rate on nothing, never 0%)` });
  }
  // What a report cannot save through the CLI: the panel's sort, its top N and its floor (each would name a column
  // the UI adds, or an alias the plan does not guess), said as steps.
  for (const h of query.having ?? []) {
    const bound = h.gte != null ? `at least ${h.gte}` : h.gt != null ? `above ${h.gt}` : h.lte != null ? `at most ${h.lte}` : null;
    if (bound) uiSteps.push({ kind: "floor", column: metric(h.metric).label, text: `Show only the rows where "${metric(h.metric).label}" is ${bound} (a filter on the column in the UI)` });
  }
  for (const s of query.sort ?? []) {
    const by = s.metric ? metric(s.metric).label : NATIVE_DIMENSIONS[s.dim ?? ""]?.[0]?.displayName ?? s.dim ?? s.label ?? null;
    const order = s.metric ? (s.dir === "asc" ? "lowest first" : "highest first") : s.dir === "desc" ? "Z to A" : "A to Z";
    if (by) uiSteps.push({ kind: "sort", column: by, text: `Sort by "${by}", ${order}` });
  }
  if (query.limit) uiSteps.push({ kind: "top", column: "", text: `Show the first ${query.limit} rows` });
  if (panel.type !== "table" && panel.type !== "kpi") uiSteps.push({ kind: "chart", column: "", text: `Switch the report's visualization to a ${panel.type === "line" ? "line" : "bar"} chart if wanted (it is saved as a grid)` });
  const name = reportName(spec, page, panel, prefix);
  const payload = { name, object: NATIVE_OBJECT, showFields, groupBy: groupFields, whereFilters: where, displayType: NATIVE_DISPLAY };
  // The schema check, when the tenant's schema is in hand: every field the report names exists, and no filter is on
  // a picklist (option ids, never labels — the report domain's notes).
  if (schema) {
    const types = new Map(schema.map((f) => [String(f.fieldName).toLowerCase(), String(f.dataType)]));
    const named = [...showFields.map((f) => f.name), ...groupFields.map((f) => f.name), ...where.conditions.map((c) => c.leftOperand.fieldName)];
    const missing = named.filter((n) => !types.has(n.toLowerCase()));
    if (missing.length) return { ...not("field-missing", [...new Set(missing)].join(", ")), leftOut };
    const picklist = where.conditions.map((c) => c.leftOperand.fieldName).filter((n) => /PICKLIST|MULTISELECT/i.test(types.get(n.toLowerCase()) ?? ""));
    if (picklist.length) return { ...not("picklist-filter", picklist.join(", ")), leftOut };
  }
  const columns = [...groupFields.map((g) => g.displayName), baseCount.label];
  return { ...base, status: /** @type {"partial"|"native"} */ (leftOut.length ? "partial" : "native"), reasons: [], leftOut, payload, hash: planHash(payload), name, columns, uiColumns: uiSteps.filter((s) => s.kind === "calculated-column" || s.kind === "formula-column").map((s) => s.column), uiSteps };
}

/** What the dashboard's global filters become on a Gainsight dashboard: steps the admin takes in the UI, in words. */
export function dashboardSteps(spec) {
  const p = spec.sources[0]?.params ?? {};
  const w = p.window ?? { kind: "rolling" };
  const months = w.kind === "fixed" ? `from ${w.from} to ${w.to}` : w.kind === "since" ? `from ${w.from} to now` : `the last ${p.windowMonths ?? 13} months, the current one included (a "last N months" filter, which moves with the calendar)`;
  const sel = p.selector ?? {};
  const since = typeof sel.sentSince === "string" ? (/^(\d+)d$/.test(sel.sentSince) ? `in the last ${sel.sentSince.slice(0, -1)} days` : /^(\d+)m$/.test(sel.sentSince) ? `in the last ${sel.sentSince.slice(0, -1)} months` : `since ${sel.sentSince}`) : null;
  const programs = sel.names?.length || sel.ids?.length ? `the ${(sel.names?.length ?? 0) + (sel.ids?.length ?? 0)} programs the dashboard names` : since ? `the programs that sent ${since} (the dashboard selects them again at each refresh; a report covers every Journey Orchestrator program)` : "every program that sent in the window";
  const steps = [
    `Put the reports on a Gainsight dashboard (the CLI has no dashboard command): add each report by its name.`,
    `Months: add a dashboard filter on ${LOG.dateField} for ${months}. The reports are saved with no date filter, so without it they count every month the log holds.`,
    `Programs: the dashboard covers ${programs}; add a dashboard filter on SourceName or ${LOG.programField} to narrow the reports the same way.`,
    `Status: program status is not on the delivery log, so the reports cover programs of every status; the dashboard's status filter has no report equivalent.`,
  ];
  if ((p.internalDomains ?? []).length) steps.push(`Internal recipients: to leave them out, add a dashboard filter on ${LOG.addressField} that does not contain ${p.internalDomains.map((d) => `"${d}"`).join(" and ")}.`);
  if ((p.testAccounts ?? []).length) steps.push(`Test accounts: their sends count as internal on the dashboard; a report can leave them out with a filter on GsCompanyId not in their company ids.`);
  steps.push(`Groups: the dashboard's program groups are its own rules, not data in Gainsight; a report cannot group by them.`);
  return steps;
}

/**
 * The plan for a whole dashboard: every panel of every page with its verdict, what each recorded report needs
 * (created, updated, unchanged), two panels that would save the SAME report sharing one, and the recorded reports
 * no panel plans any more (for the UI: the CLI cannot delete a report).
 * @param {T11Spec} spec
 * @param {{prefix?: string, schema?: ?Array<{fieldName: string, dataType: string}>}} [opts]
 */
export function nativePlan(spec, { prefix = "", schema = null } = {}) {
  const recorded = new Map((spec.native?.reports ?? []).map((r) => [r.panel, r]));
  const entries = [];
  const firstOf = new Map(); // a payload's fingerprint, minus its name → the entry that saves it
  for (const page of spec.pages) {
    for (const panel of presetPanels(page)) {
      const e = panelNative(spec, page, panel, { prefix, schema });
      if (!e.payload) { entries.push({ ...e, action: "none" }); continue; }
      // Two panels share a report only when everything about it is the same: what is saved AND what the UI adds.
      const { name: _n, ...shape } = e.payload;
      const shapeKey = planHash({ shape, ui: e.uiSteps });
      const same = firstOf.get(shapeKey);
      const rec = recorded.get(e.key) ?? null;
      // A panel that saves the same report as an earlier one shares it, recorded or not: it never gets its own.
      if (same) { entries.push({ ...e, action: "shared", sameAs: same.key, reportId: same.reportId ?? null }); continue; }
      const action = !rec ? "create" : rec.planHash === e.hash ? "unchanged" : "update";
      const entry = { ...e, action, reportId: rec?.reportId ?? null };
      firstOf.set(shapeKey, entry);
      entries.push(entry);
    }
  }
  // A recorded report no planned report keeps (its panel is gone, no longer native, or now shares another's): the
  // CLI cannot delete a report, so it is listed for the UI.
  const kept = new Set(entries.filter((e) => e.action === "update" || e.action === "unchanged").map((e) => e.reportId));
  const seen = new Set();
  const cleanup = (spec.native?.reports ?? []).filter((r) => !kept.has(r.reportId) && !seen.has(r.reportId) && seen.add(r.reportId)).map((r) => ({ panel: r.panel, reportId: r.reportId, name: r.name ?? null }));
  const count = (a) => entries.filter((e) => e.action === a).length;
  return { object: NATIVE_OBJECT, prefix, schemaChecked: !!schema, entries, counts: { panels: entries.length, native: entries.filter((e) => e.status === "native").length, partial: entries.filter((e) => e.status === "partial").length, not: entries.filter((e) => e.status === "not").length, create: count("create"), update: count("update"), unchanged: count("unchanged"), shared: count("shared") }, dashboardSteps: dashboardSteps(spec), cleanup };
}

/**
 * The exact line for one planned report, as the skill issues it (single-quoted values; the CLI's output to a file
 * beside the dashboard, so no report body enters a session's context). `rp update` replaces the report's columns
 * wholesale: the calculated columns added in the UI must be added again, and the plan says so.
 * @param {*} entry a plan entry with action create or update
 * @param {string} outFile the workspace-relative file the CLI's output goes to
 */
export function commandLine(entry, outFile) {
  const p = entry.payload;
  const json = (v) => shellWord(JSON.stringify(v));
  const head = entry.action === "update" ? ["gs-admin", "--json", "rp", "update", "--id", shellWord(entry.reportId), "--new-name", shellWord(p.name)] : ["gs-admin", "--json", "rp", "create", "--name", shellWord(p.name)];
  const words = [...head, "--object", shellWord(p.object), "--show-fields", json(p.showFields), ...(p.groupBy.length ? ["--group-by", json(p.groupBy)] : []), "--where-filters", json(p.whereFilters), "--display-type", p.displayType];
  return `${words.join(" ")} > ${shellWord(outFile)}`;
}

/**
 * The id of a saved report from `rp describe`'s answer: `data.reportId` (the field the CLI's own update reads), or
 * null when it is not there — never a guess at another key.
 * @param {*} payload
 */
export function describedReportId(payload) {
  const d = payload?.data ?? payload;
  return d && typeof d === "object" && typeof d.reportId === "string" && d.reportId ? d.reportId : null;
}

/**
 * Reading a saved report back (`rp run-saved`, NAT-2 step 4): rows keyed by column label, every value a
 * display-formatted string. Which of the plan's columns came back, which UI columns are still to be added, and
 * whether every value is the string the shape promises. An answer with no rows is not ok (nothing could be checked).
 * @param {unknown} rows the CLI's answer
 * @param {{columns: string[], uiColumns: string[]}} entry
 */
export function readBack(rows, entry) {
  const list = Array.isArray(rows) ? rows : Array.isArray(/** @type {any} */ (rows)?.data) ? /** @type {any} */ (rows).data : null;
  if (!list) return { ok: false, why: "the answer is not a list of rows", rows: 0, missing: entry.columns, uiPending: entry.uiColumns };
  const labels = new Set(list.flatMap((r) => (r && typeof r === "object" ? Object.keys(r) : [])));
  const missing = list.length ? entry.columns.filter((c) => !labels.has(c)) : [];
  const uiPending = entry.uiColumns.filter((c) => !labels.has(c));
  const strings = list.every((r) => r && typeof r === "object" && Object.values(r).every((v) => v == null || typeof v === "string"));
  // No rows is not a pass: the columns cannot be checked, and a filter that matches nothing reads the same way.
  const why = !list.length ? "the report returned no rows: its columns cannot be checked (are its filters right for this tenant?)" : missing.length ? `the report has no column ${missing.map((c) => `"${c}"`).join(", ")}` : strings ? null : "a value is not the formatted string run-saved returns";
  return { ok: why === null, why, rows: list.length, missing, uiPending };
}
