#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// dashboard-native.mjs (test) — fixtures for scripts/dashboard-native.mjs
// (NAT-1): which panels of a dashboard a Gainsight report can carry, the exact
// `rp create` / `rp update` line for each, and the readers NAT-2's record and
// read-back steps use.
//
// Expectations are written BY HAND (never read back from the mapper): each
// preset panel's verdict and why, the conditions an admin adds in the UI, and
// the payload rules of the report domain's notes (reference/domains/report.md),
// checked by a validator written here on its own. The lines are parsed back
// with a shell-word reader written here, and the saved reports are run through
// the stand-in CLI (test/fixtures/engagement/acme-tenant.mjs: rp create,
// describe and run-saved modelled on the CLI's report handler at the pin), whose
// figures must equal a straight count of the fictional tenant's rows.
//
// Run:  node plugins/gs-superadmin/test/dashboard-native.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { nativePlan, panelNative, nativeFigure, commandLine, describedReportId, readBack, planHash, dashboardSteps, reportName, panelKey, NOT_NATIVE, NATIVE_OBJECT, TEST_PREFIX } from "../scripts/dashboard-native.mjs";
import { openSpec, presetPanels } from "../scripts/dashboard-spec.mjs";
import { buildTenant, answer, JO_SOURCE, INTERNAL_DOMAIN } from "./fixtures/engagement/acme-tenant.mjs";
import { shellWords, MARK } from "./fixtures/engagement/shell-words.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SPEC_FILE = join(HERE, "fixtures", "engagement", "spec-acme.json");

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

// A spec on the presets' own panels (the ruled defaults), and one with a page of hand-picked panels.
const SPEC = openSpec(JSON.parse(readFileSync(SPEC_FILE, "utf8")));
const PRESET_SPEC = (() => { const s = structuredClone(SPEC); for (const p of s.pages) p.panels = []; return openSpec(s); })();
const ADMIN = PRESET_SPEC.pages.find((p) => p.preset === "admin");
const EXEC = PRESET_SPEC.pages.find((p) => p.preset === "exec");
const LOG_FIELDS = buildTenant().schemas.email_log_v2;

const flag = (argv, name) => { const i = argv.indexOf(name); return i < 0 ? undefined : argv[i + 1]; };

/**
 * The report domain's payload rules (reference/domains/report.md, Domain notes), written here on their own: arrays of
 * objects each with one of name | formula | fieldPath; the CLI can author no formula, so a native payload carries
 * none; a filter is {leftOperand: {fieldName}, operator, rightOperand: {value}} with a known operator and no BTW and
 * no date literal (relative literals take EQ, and the CLI keeps no literal at all); no field is both shown and grouped
 * (the CLI drops it, F-471); a pivot only on a GRID of two group-bys or more, exactly one pivoted; a KPI with no
 * group-by and one show field; every field the payload names is on the object's schema, and none it filters is a
 * picklist (option ids, never labels).
 * @returns {string[]} what is wrong
 */
function payloadProblems(p, schema = LOG_FIELDS) {
  const problems = [];
  const types = new Map(schema.map((f) => [f.fieldName, f.dataType]));
  const entry = (e, where) => {
    if (!e || typeof e !== "object" || Array.isArray(e)) return problems.push(`${where}: not an object`);
    const kinds = ["name", "formula", "fieldPath"].filter((k) => k in e);
    if (kinds.length !== 1) problems.push(`${where}: carries ${kinds.join("+") || "none"} of name | formula | fieldPath`);
    if ("formula" in e) problems.push(`${where}: a formula (the CLI cannot author one: its grammar is not the UI's)`);
    if (e.name && !types.has(e.name)) problems.push(`${where}: ${e.name} is not on ${p.object}`);
  };
  if (p.object !== "email_log_v2") problems.push(`object ${p.object}`);
  if (!Array.isArray(p.showFields) || !p.showFields.length) problems.push("showFields empty");
  (p.showFields ?? []).forEach((e, i) => entry(e, `showFields[${i}]`));
  (p.groupBy ?? []).forEach((e, i) => entry(e, `groupBy[${i}]`));
  const grouped = new Set((p.groupBy ?? []).map((g) => g.name));
  for (const s of p.showFields ?? []) if (grouped.has(s.name)) problems.push(`${s.name} is shown and grouped by`);
  const pivots = (p.groupBy ?? []).filter((g) => g.pivoted).length;
  if (pivots && !(p.displayType === "GRID" && p.groupBy.length >= 2 && pivots === 1)) problems.push("pivot rules");
  if (p.displayType === "KPI" && ((p.groupBy ?? []).length || p.showFields.length > 1)) problems.push("KPI rules");
  const conditions = p.whereFilters?.conditions;
  if (!Array.isArray(conditions)) problems.push("whereFilters.conditions not a list");
  for (const c of conditions ?? []) {
    if (!isDeepStrictEqual(Object.keys(c).sort(), ["leftOperand", "operator", "rightOperand"])) problems.push(`condition keys ${Object.keys(c)}`);
    if (!["EQ", "NE", "IN", "NOT_IN", "GT", "GTE", "LT", "LTE", "CONTAINS", "DOES_NOT_CONTAINS", "ENDS_WITH", "STARTS_WITH", "IS_NULL", "IS_NOT_NULL"].includes(c.operator)) problems.push(`operator ${c.operator}`);
    if (c.operator === "BTW" || "dateLiteral" in (c.rightOperand ?? {}) || "filterValue" in c) problems.push("a date literal or BTW");
    const t = types.get(c.leftOperand?.fieldName);
    if (!t) problems.push(`filter on ${c.leftOperand?.fieldName}, not on ${p.object}`);
    if (/PICKLIST|MULTISELECT/.test(t ?? "") && !["IN", "NOT_IN", "IS_NULL", "IS_NOT_NULL"].includes(c.operator)) problems.push(`picklist ${c.leftOperand.fieldName} with ${c.operator}`);
    if ("alias" in c || "expression" in (p.whereFilters ?? {})) problems.push("an alias or expression (the CLI assigns them)");
  }
  return problems;
}

// ══ The verdict per preset panel, by hand ════════════════════════════════════
{
  const plan = nativePlan(PRESET_SPEC);
  const by = Object.fromEntries(plan.entries.map((e) => [e.key, e]));
  // [key, status, the reason (not) or the figures left out with theirs (partial)] — the expectation, written out.
  const expected = [
    ["admin/headline", "partial", ["clickRate:content-clicks"]],
    ["admin/open-rate-trend", "partial", ["clickRate:content-clicks"]],
    ["admin/sends-by-month", "native", []],
    ["admin/programs", "partial", ["uniqueRecipients:uniques", "accountsReached:uniques", "clicked:content-clicks", "clickRate:content-clicks"]],
    ["admin/emails", "partial", ["clickRate:content-clicks"]],
    ["admin/steps", "not", ["step-names"]],
    ["admin/survey-responses", "not", ["no-native-figure"]],
    ["admin/most-engaged", "not", ["account-selection"]],
    ["admin/least-engaged", "not", ["account-selection"]],
    ["admin/most-bounced", "not", ["account-selection"]],
    ["admin/send-health", "native", []],
    ["admin/program-health", "not", ["health"]],
    ["admin/failure-reasons", "not", ["health"]],
    ["admin/schedules", "not", ["health"]],
    ["admin/one-time", "not", ["health"]],
    ["admin/error-rate", "native", []],
    ["admin/templates", "not", ["template-text"]],
    ["admin/account-view", "not", ["account-selection"]],
    ["exec/headline", "partial", ["clickRate:content-clicks"]],
    ["exec/open-rate-trend", "partial", ["clickRate:content-clicks"]],
    ["exec/sends-by-month", "native", []],
    ["exec/by-group", "not", ["program-groups"]],
    ["exec/top-open-rate", "native", []],
    ["exec/lowest-open-rate", "native", []],
  ];
  const got = plan.entries.map((e) => [e.key, e.status, e.status === "not" ? e.reasons.map((r) => r.reason) : e.leftOut.map((l) => `${l.metric}:${l.reason}`)]);
  check("NAT-1 every preset panel of both pages gets the verdict written out by hand: native when the delivery log carries every figure, partial with each figure left out and its reason (content-link clicks, the distinct-count rules), not native with the panel's reason (step names, the customer lists, the program groups, the health tables, the template text, survey participants)",
    isDeepStrictEqual(got, expected), got.filter((g, i) => !isDeepStrictEqual(g, expected[i])));
  check("NAT-1 a panel that is not native carries a reason sentence and NO payload, never a guessed one; every reason it can give is a sentence of the table",
    plan.entries.filter((e) => e.status === "not").every((e) => e.payload === null && e.reasons.length === 1 && e.reasons[0].text === NOT_NATIVE[e.reasons[0].reason] && typeof e.reasons[0].text === "string") &&
      plan.entries.flatMap((e) => e.leftOut).every((l) => l.text === NOT_NATIVE[l.reason]), plan.entries.filter((e) => e.status === "not" && e.payload));
  const withPayload = plan.entries.filter((e) => e.payload);
  check("NAT-1 every payload the plan writes keeps the report domain's rules (one of name | formula | fieldPath per entry and never a formula, nothing both shown and grouped, filters {leftOperand, operator, rightOperand} with no BTW and no date literal, every field on email_log_v2's schema, a GRID), checked by a validator written on its own",
    withPayload.length === 12 && withPayload.every((e) => payloadProblems(e.payload).length === 0 && e.payload.displayType === "GRID" && e.payload.object === NATIVE_OBJECT), withPayload.map((e) => [e.key, payloadProblems(e.payload)]).filter(([, p]) => p.length));
  const standing = [{ leftOperand: { fieldName: "Source" }, operator: "EQ", rightOperand: { value: JO_SOURCE } }, { leftOperand: { fieldName: "AddressType" }, operator: "EQ", rightOperand: { value: "To" } }];
  check("NAT-1 every report counts what the dashboard counts: the delivery log's Journey Orchestrator rows sent To (the two standing filters), one COUNT of the rows as its one native column, labelled as the dashboard labels it; programs by name and id, emails by name and id, months by ExecutedDate's month",
    withPayload.every((e) => isDeepStrictEqual(e.payload.whereFilters.conditions.slice(0, 2), standing) && e.payload.showFields.length === 1 && e.payload.showFields[0].name === "Gsid" && e.payload.showFields[0].aggregation === "COUNT") &&
      isDeepStrictEqual(by["admin/programs"].payload.groupBy, [{ name: "SourceName", displayName: "Program" }, { name: "SourceId", displayName: "Program id" }]) &&
      isDeepStrictEqual(by["admin/emails"].payload.groupBy.map((g) => g.name), ["SourceName", "SourceId", "EmailTemplateName", "EmailTemplateId"]) &&
      isDeepStrictEqual(by["admin/sends-by-month"].payload.groupBy, [{ name: "ExecutedDate", summarize: "Month", displayName: "Month" }]) && by["admin/headline"].payload.groupBy.length === 0,
    withPayload.map((e) => [e.key, e.payload.showFields, e.payload.groupBy]));
}

// ══ What the admin adds in the UI: the conditions and the formulas, by hand ═══
{
  const plan = nativePlan(PRESET_SPEC);
  const by = Object.fromEntries(plan.entries.map((e) => [e.key, e]));
  const headline = by["admin/headline"];
  check("NAT-1 a rate needs a formula column added in the UI, with the formula to add; each count beyond Sent is a calculated column whose condition is the dashboard's own (Delivered: went out AND did not bounce; Opened: opened), written from the registry",
    isDeepStrictEqual(headline.uiColumns, ["Delivered", "Opened", "Open rate"]) &&
      headline.uiSteps.some((s) => s.kind === "calculated-column" && s.column === "Delivered" && s.text.includes('1 when IsSent = "YES" AND IsBounced is not "YES", else 0')) &&
      headline.uiSteps.some((s) => s.kind === "calculated-column" && s.column === "Opened" && s.text.includes('1 when IsOpened = "YES", else 0')) &&
      headline.uiSteps.some((s) => s.kind === "formula-column" && s.column === "Open rate" && s.text.includes('"Opened" ÷ "Delivered", left empty when "Delivered" is 0')),
    headline.uiSteps);
  const err = by["admin/error-rate"];
  check("NAT-1 a count that holds on EITHER flag (Send failures: bounced OR rejected, each attempt once) is a calculated column with OR, never a filter (the CLI's filters are AND only); the panel's floor, its sort and its top N are UI steps, never a guessed order-by or having alias",
    err.uiSteps.some((s) => s.column === "Send failures" && s.text.includes('1 when IsBounced = "YES" OR IsRejected = "YES", else 0')) &&
      err.uiSteps.some((s) => s.kind === "floor" && s.text.includes('"Sent" is at least 1')) && err.uiSteps.some((s) => s.kind === "sort" && s.text.includes('Sort by "Error rate", highest first')) &&
      !("orderBy" in err.payload) && !("havingFilters" in err.payload) && !("limit" in err.payload) &&
      by["exec/top-open-rate"].uiSteps.some((s) => s.kind === "top" && s.text === "Show the first 10 rows") && by["exec/lowest-open-rate"].uiSteps.some((s) => s.text === 'Sort by "Open rate", lowest first'),
    err.uiSteps);
  // One count, all of whose conditions hold together: the report carries it natively, its conditions in the filter.
  const custom = (metrics, groupBy = ["program"]) => panelNative(PRESET_SPEC, ADMIN, /** @type {any} */ ({ id: "x", tab: "engagement", type: "table", title: "X", query: { groupBy, metrics } }));
  const bounced = custom(["bounced"]);
  const delivered = custom(["delivered"]);
  const failed = custom(["failed"]);
  check("NAT-1 a panel of ONE count whose conditions all hold together is native in full: the report counts it, its conditions in the report's filter (set = EQ, not set = NE, which keeps a null as the dashboard's 'not set' does), labelled with its name, nothing left to add; a one-count panel that needs OR keeps Sent and adds the count in the UI",
    bounced.status === "native" && bounced.payload.showFields[0].displayName === "Bounced" && isDeepStrictEqual(bounced.payload.whereFilters.conditions.slice(2), [{ leftOperand: { fieldName: "IsBounced" }, operator: "EQ", rightOperand: { value: "YES" } }]) && bounced.uiColumns.length === 0 &&
      isDeepStrictEqual(delivered.payload.whereFilters.conditions.slice(2), [{ leftOperand: { fieldName: "IsSent" }, operator: "EQ", rightOperand: { value: "YES" } }, { leftOperand: { fieldName: "IsBounced" }, operator: "NE", rightOperand: { value: "YES" } }]) &&
      failed.payload.showFields[0].displayName === "Sent" && failed.payload.whereFilters.conditions.length === 2 && isDeepStrictEqual(failed.uiColumns, ["Send failures"]),
    [bounced.payload?.whereFilters, delivered.payload?.whereFilters, failed.uiColumns]);
  const capped = panelNative(PRESET_SPEC, ADMIN, { id: "y", tab: "engagement", type: "table", title: "Y", query: { groupBy: ["program"], metrics: ["sent", "bounced"], having: [{ metric: "bounced", lte: 5 }, { metric: "sent", gt: 2 }] } });
  check("NAT-1 every floor kind the engine takes (at least, above, at most) becomes its own UI step, in the panel's order",
    isDeepStrictEqual(capped.uiSteps.filter((s) => s.kind === "floor").map((s) => s.text.match(/is (.*?) \(/)?.[1]), ["at most 5", "above 2"]), capped.uiSteps);
  const each = (d) => custom(["sent"], [d]);
  check("NAT-1 each dimension a report cannot group by is refused with its own reason: step and variant (step names), account (the customer lists), recipient class (the pull's split), supergroup and group (the dashboard's rules), model and audience (the program list); and each figure kind: a distinct count, a survey figure, a content-link click",
    ["step", "variant", "account", "recipientClass", "supergroup", "group", "model", "audience"].map((d) => each(d).reasons[0]?.reason).join() === "step-names,step-names,account-selection,recipient-class,program-groups,program-groups,program-list,program-list" &&
      ["uniqueRecipients", "accountsReached", "participantRecords", "submitted", "responseRate", "clicked", "clickRate"].map((id) => nativeFigure(id)).map((f) => (f.kind === "not" ? f.reason : f.kind)).join() === "uniques,uniques,uniques,survey-object,survey-object,content-clicks,content-clicks");
}

// ══ The tenant's schema: a missing field or a picklist filter is refused, never guessed ══
{
  const dropped = buildTenant({ dropSchemaField: { object: "email_log_v2", field: "AddressType" } }).schemas.email_log_v2;
  const picklist = LOG_FIELDS.map((f) => (f.fieldName === "Source" ? { ...f, dataType: "PICKLIST" } : f));
  const sent = /** @type {any} */ ({ id: "s", tab: "engagement", type: "table", title: "Sent by program", query: { groupBy: ["program"], metrics: ["sent"] } });
  const missing = panelNative(PRESET_SPEC, ADMIN, sent, { schema: dropped });
  const pick = panelNative(PRESET_SPEC, ADMIN, sent, { schema: picklist });
  const fine = panelNative(PRESET_SPEC, ADMIN, sent, { schema: LOG_FIELDS });
  check("NAT-1 with the tenant's schema in hand, a report naming a field the delivery log lacks is not native (the CLI would drop the filter silently and widen the report: the spike's fact 9), and a filter on a picklist is not native (its values are option ids, never guessed); on the fixture's schema the panel is native",
    missing.status === "not" && missing.reasons[0].reason === "field-missing" && missing.reasons[0].detail === "AddressType" && !missing.payload &&
      pick.status === "not" && pick.reasons[0].reason === "picklist-filter" && pick.reasons[0].detail === "Source" && fine.status === "native" && nativePlan(PRESET_SPEC, { schema: LOG_FIELDS }).schemaChecked === true && nativePlan(PRESET_SPEC).schemaChecked === false,
    [missing.reasons, pick.reasons, fine.status]);
}

// ══ The lines, read back as a shell reads them ═══════════════════════════════
{
  const plan = nativePlan(PRESET_SPEC, { prefix: TEST_PREFIX });
  const creates = plan.entries.filter((e) => e.action === "create");
  const lines = creates.map((e) => ({ e, line: commandLine(e, `acme-prod/dashboards/${PRESET_SPEC.slug}/native/${e.page}-${e.panel}.json`) }));
  const parsed = lines.map(({ e, line }) => ({ e, words: shellWords(line) }));
  check("NAT-1 each create line is `gs-admin --json rp create` (the global flag before the subcommand) with every value single-quoted: read back as a shell reads it, its words carry no bare shell metacharacter, and its flags give back the payload exactly; its output goes to a file beside the dashboard (no report body in a session)",
    parsed.length === 9 && parsed.every(({ e, words }) => {
      const out = words.indexOf(`${MARK}>`);
      const argv = words.slice(0, out);
      return isDeepStrictEqual(argv.slice(0, 4), ["gs-admin", "--json", "rp", "create"]) && !argv.some((w) => w.includes(MARK)) && flag(argv, "--name") === e.payload.name &&
        flag(argv, "--object") === "email_log_v2" && isDeepStrictEqual(JSON.parse(flag(argv, "--show-fields")), e.payload.showFields) && isDeepStrictEqual(JSON.parse(flag(argv, "--group-by") ?? "[]"), e.payload.groupBy) &&
        isDeepStrictEqual(JSON.parse(flag(argv, "--where-filters")), e.payload.whereFilters) && flag(argv, "--display-type") === "GRID" && words.length === out + 2 && words[out + 1].endsWith(`${e.page}-${e.panel}.json`);
    }), lines.slice(0, 2).map((l) => l.line));
  check("NAT-1 a test run's names start ZZ|TEST| (sandbox reports a person can find and remove), and the pipe characters in them are inside the quotes; a name with a quote in it survives the shell intact",
    creates.every((e) => e.name.startsWith(TEST_PREFIX)) && lines.every(({ line }) => line.includes(`--name 'ZZ|TEST|`)) &&
      (() => { const s = structuredClone(PRESET_SPEC); s.title = "Acme's \"health\" | $HOME"; const e = { ...panelNative(openSpec(s), ADMIN, presetPanels(ADMIN)[0], { prefix: TEST_PREFIX }), action: "create" }; const w = shellWords(commandLine(e, "f.json")); return flag(w, "--name") === `${TEST_PREFIX}Acme's "health" | $HOME - Admin - This period` && !w.slice(0, -2).some((x) => x.includes(MARK)); })());
  const upd = { ...plan.entries.find((e) => e.key === "admin/programs"), action: "update", reportId: "rpt-0042" };
  const uw = shellWords(commandLine(upd, "u.json"));
  check("NAT-1 an update line names the recorded report by id and carries the whole shape again (object, show fields, group-by, filters, display), with the name as --new-name: what rp update needs to rebuild the report on the object's live schema",
    isDeepStrictEqual(uw.slice(0, 6), ["gs-admin", "--json", "rp", "update", "--id", "rpt-0042"]) && flag(uw, "--new-name") === upd.payload.name && flag(uw, "--object") === "email_log_v2" && JSON.parse(flag(uw, "--show-fields")).length === 1 && flag(uw, "--display-type") === "GRID", uw);
}

// ══ Re-runs: unchanged, changed, shared, cleaned up ══════════════════════════
{
  const first = nativePlan(PRESET_SPEC);
  const creates = first.entries.filter((e) => e.action === "create");
  const shared = first.entries.filter((e) => e.action === "shared");
  check("NAT-1 two panels that save the SAME report (the same payload and the same UI steps, whatever their names) share one: the leaders' headline, trend and sends-by-month share the admin page's; two that differ only in their sort do not",
    isDeepStrictEqual(shared.map((e) => [e.key, e.sameAs]), [["exec/headline", "admin/headline"], ["exec/open-rate-trend", "admin/open-rate-trend"], ["exec/sends-by-month", "admin/sends-by-month"]]) &&
      first.entries.find((e) => e.key === "exec/lowest-open-rate").action === "create" && first.counts.create === 9, shared.map((e) => e.key));
  // Recorded as NAT-2 records them: every created report, with its fingerprint; a shared panel under the same id.
  const spec = structuredClone(PRESET_SPEC);
  spec.native.reports = creates.map((e, i) => ({ panel: e.key, reportId: `rpt-${i}`, name: e.name, planHash: e.hash }));
  for (const s of shared) spec.native.reports.push({ panel: s.key, reportId: spec.native.reports.find((r) => r.panel === s.sameAs).reportId, name: s.name, planHash: creates.find((c) => c.key === s.sameAs).hash });
  const again = nativePlan(openSpec(spec));
  check("NAT-1 a re-run skips every report already created and recorded with its fingerprint: nothing to create, nothing to update, the shared panels still shared, nothing to clean up",
    again.counts.create === 0 && again.counts.update === 0 && again.counts.unchanged === 9 && again.counts.shared === 3 && again.cleanup.length === 0, again.counts);
  // A changed panel (a title edited: the name moves) → update; a panel gone → its report listed for the UI.
  const moved = structuredClone(spec);
  moved.pages[0].panels = presetPanels(moved.pages[0]).filter((p) => p.id !== "error-rate").map((p) => (p.id === "programs" ? { ...p, title: "All programs" } : p));
  const changed = nativePlan(openSpec(moved));
  const prog = changed.entries.find((e) => e.key === "admin/programs");
  check("NAT-1 a changed panel is an update of its recorded report (rp update by id, the new name), and a recorded report no panel plans any more is listed for cleanup in the UI with its id and name (the CLI cannot delete a report)",
    prog.action === "update" && prog.reportId === spec.native.reports.find((r) => r.panel === "admin/programs").reportId && prog.name.endsWith(" - All programs") &&
      isDeepStrictEqual(changed.cleanup, [{ panel: "admin/error-rate", reportId: spec.native.reports.find((r) => r.panel === "admin/error-rate").reportId, name: spec.native.reports.find((r) => r.panel === "admin/error-rate").name }]), [prog.action, changed.cleanup]);
  check("NAT-1 the fingerprint is stable and moves with any change to what is saved: the same payload gives the same eight hex digits, a changed filter value another",
    planHash({ a: 1, b: [2] }) === planHash({ a: 1, b: [2] }) && /^[0-9a-f]{8}$/.test(planHash({})) && planHash(creates[0].payload) !== planHash({ ...creates[0].payload, whereFilters: { conditions: [] } }));
}

// ══ The dashboard's global filters become dashboard filters set in the UI ════
{
  const steps = dashboardSteps(PRESET_SPEC);
  check("NAT-1 the instructions say the page's global filters are dashboard filters the admin sets in the UI: the months on ExecutedDate (the reports carry no date filter, as the CLI can save no relative date), the programs on SourceName or SourceId, status not on the log, the internal domains by address, the groups not in Gainsight; and that the reports go on a dashboard by hand",
    steps.length >= 6 && /dashboard filter on ExecutedDate/.test(steps[1]) && /saved with no date filter/.test(steps[1]) && /SourceName or SourceId/.test(steps[2]) && /status is not on the delivery log/.test(steps[3]) &&
      steps.some((s) => s.includes(`does not contain "${INTERNAL_DOMAIN}"`)) && steps.some((s) => /program groups are its own rules/.test(s)) && /the CLI has no dashboard command/.test(steps[0]), steps);
}

// ══ Saved and read back through the stand-in CLI: the figures equal a straight count ══
{
  const tenant = buildTenant();
  const run = (argv) => answer(argv, tenant);
  const plan = nativePlan(PRESET_SPEC, { prefix: TEST_PREFIX, schema: tenant.schemas.email_log_v2 });
  const entry = plan.entries.find((e) => e.key === "admin/programs");
  const words = shellWords(commandLine(entry, "out.json"));
  const created = run(words.slice(1, words.indexOf(`${MARK}>`)));
  const described = run(["--json", "rp", "describe", "--name", entry.name]);
  const id = describedReportId(JSON.parse(described.stdout));
  const saved = run(["--json", "rp", "run-saved", "--id", id, "--page-size", "500"]);
  const rows = JSON.parse(saved.stdout);
  // The oracle: the delivery log's JO rows sent To, counted per program, straight from the fixture's table.
  const oracle = new Map();
  for (const r of tenant.tables.email_log_v2) if (r.Source === JO_SOURCE && r.AddressType === "To") oracle.set(r.SourceId, (oracle.get(r.SourceId) ?? 0) + 1);
  const back = readBack(rows, entry);
  check("NAT-2 over the stand-in: the planned line saves a report (exit 0), its id is read back by its exact name through rp describe (data.reportId), and run-saved answers rows keyed by column label with string values — each program's Sent equal to a straight count of the fictional tenant's rows; the UI columns not yet added are named as pending",
    created.status === 0 && typeof id === "string" && rows.length === oracle.size && rows.every((r) => r.Sent === String(oracle.get(r["Program id"]))) && back.ok && back.rows === rows.length && isDeepStrictEqual(back.uiPending, entry.uiColumns) && back.missing.length === 0,
    [created.stderr, described.stdout?.slice(0, 200), rows.slice(0, 2), back]);
  // The admin adds the UI columns (the stand-in's report carries them from here on): nothing is pending.
  tenant.reports.get(id).uiColumns = entry.uiColumns.map((label) => ({ label, value: "12.34%" }));
  const after = readBack(JSON.parse(run(["--json", "rp", "run-saved", "--id", id]).stdout), entry);
  const none = readBack({ nope: 1 }, entry);
  const lost = readBack([{ Program: "x", "Program id": "p", Wrong: "1" }], entry);
  const empty = readBack([], entry);
  check("NAT-2 a read-back with no rows is not ok: nothing could be checked, and a report whose filters match nothing on a tenant reads exactly that way (the review's finding)",
    !empty.ok && empty.rows === 0 && /returned no rows/.test(empty.why ?? ""), empty);
  check("NAT-2 read back after the admin added the UI columns: none pending; an answer that is not rows, or that lacks a planned column, is not ok and says why; a describe answer with no reportId gives no id (never a guess at another key)",
    after.ok && after.uiPending.length === 0 && !none.ok && /not a list of rows/.test(none.why) && !lost.ok && /no column "Sent"/.test(lost.why) && describedReportId({ data: { id: "x" } }) === null && describedReportId({ reportId: "r1" }) === "r1",
    [after, none, lost]);
  const dup = run(words.slice(1, words.indexOf(`${MARK}>`)));
  const filtered = { ...panelNative(PRESET_SPEC, ADMIN, { id: "b", tab: "engagement", type: "table", title: "Bounced by program", query: { groupBy: ["program"], metrics: ["bounced"] } }, { prefix: TEST_PREFIX }), action: "create" };
  const fw = shellWords(commandLine(filtered, "b.json"));
  run(fw.slice(1, fw.indexOf(`${MARK}>`)));
  const fid = describedReportId(JSON.parse(run(["--json", "rp", "describe", "--name", filtered.name]).stdout));
  const frows = JSON.parse(run(["--json", "rp", "run-saved", "--id", fid, "--page-size", "500"]).stdout);
  const bounceOracle = new Map();
  for (const r of tenant.tables.email_log_v2) if (r.Source === JO_SOURCE && r.AddressType === "To" && r.IsBounced === "YES") bounceOracle.set(r.SourceId, (bounceOracle.get(r.SourceId) ?? 0) + 1);
  check("NAT-2 over the stand-in: saving the same name twice is refused (a report name is unique per tenant), and a one-count report whose conditions sit in its filter (Bounced) reads back each program's bounces equal to a straight count",
    dup.status !== 0 && frows.length === bounceOracle.size && frows.every((r) => r.Bounced === String(bounceOracle.get(r["Program id"]))), [dup.stderr, frows.slice(0, 2)]);
}

check("NAT-1 the names and keys: a report's name is the prefix, the dashboard's title, the page's and the panel's; a panel's key is the page's id and the panel's (the two pages' panels never share a key)",
  reportName(PRESET_SPEC, ADMIN, { title: "Programs" }, TEST_PREFIX) === `${TEST_PREFIX}${PRESET_SPEC.title} - ${ADMIN.title} - Programs` && panelKey(ADMIN, { id: "headline" }) !== panelKey(EXEC, { id: "headline" }));

console.log(failures ? `\ndashboard-native: ${failures} FAILED of ${total}` : `\ndashboard-native: all ${total} checks passed`);
process.exit(failures ? 1 : 0);
