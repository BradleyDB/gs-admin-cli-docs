#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// tenant-deps.mjs (test) — fixture tests for scripts/tenant-deps.mjs (ER-11).
//
// Covers: every per-domain extractor (rules taskDetails/criteriaDetails/
// _flatMappings/action-mapping connections + SET_SCOREV2 refs; report
// sourceDetails/showFields incl. calculated nesting/where filters; connector
// job connection/target/task fields; data-designer tasks; journey-dataset
// schema rows), the connection registry (id↔name↔type expansion, exact vs
// type-level matches, internal MDA/GAINSIGHT_API exclusion from type-level),
// generic row matching on names AND labels AND aliases, the all-areas
// dm-deps-check parser, the JO reuse path (parseJourneyDoc → ER-7
// usageCandidates), and an end-to-end run over a synthetic KB (report +
// per-domain CSVs + summary JSON + caveats). All data fictional (acme).
//
// Run:  node plugins/gs-superadmin/test/tenant-deps.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, symlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import {
  parseSummaryObject,
  extractRuleUsages,
  extractReportUsages,
  extractJobUsages,
  extractDesignerUsages,
  DESIGNER_BLIND_REASONS,
  extractDatasetUsages,
  extractConnection,
  CONNECTION_SHAPES,
  extractExternalAction,
  collectScorecardMeasures,
  expandConnectionTerms,
  matchConnection,
  matchRow,
  fieldCandidates,
  journeyUsageRows,
  normalizeCondition,
  INTERNAL_CONNECTIONS,
  RULE_CONNECTION_SITES,
} from "../scripts/tenant-deps.mjs";
import { parseLiveDepsAreas, parseLiveDeps, prepFieldTerm, compileAliasPrefix, addNearMisses } from "../scripts/jo-report-deps.mjs";
import { parseJourneyDoc } from "../scripts/jo-report.mjs";
import { renderProgramDoc } from "../scripts/doc-lib.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "tenant-deps.mjs");
const ROOT = join(tmpdir(), `gs-superadmin-tenant-deps-${process.pid}`);
rmSync(ROOT, { recursive: true, force: true });
mkdirSync(ROOT, { recursive: true });

let failures = 0;
function check(label, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) {
    failures++;
    console.log(`      ${JSON.stringify(detail)?.slice(0, 400)}`);
  }
}

// ── fixture payloads (fictional acme tenant) ─────────────────────────────────
// ONE corpus, shared with the reader-shape tracer (test/trace-reader-shapes.mjs):
// the payload objects live in test/fixtures/reader-payloads.mjs and are imported
// here — a fixture edited for a suite is the same fixture the tracer measures.
import { RULE_EXT, RULE_SC_LEVEL, RULE_ALIAS, RULE_INACTIVE, RULE_CALLOUT, EXT_ACTION_DOC, RULE_MIXED, EXT_DOLLAR_DOC, RULE_DOLLAR, REPORT_MDA, REPORT_SFDC, JOB, LEGACY_TASK, DESIGNER_LEGACY, DESIGNER_LIVE_SUMMARY, DESIGNER_HYBRID, HYBRID_DERIVED_TASK, DESIGNER_BODY, DESIGNER, DATASET, CONN_1, CONN_2, CONN_SNOW, SCORECARD, JOURNEY_PAYLOAD, CONN_FLAT_S3, JOB_S3, DEPS_CHECK, T1, DESIGNER_COMPOSITE } from "./fixtures/reader-payloads.mjs";

// ── unit: extractors ─────────────────────────────────────────────────────────

{
  const { asset, rows, scorecardRefs } = extractRuleUsages(RULE_EXT);
  check("rule: asset id/name/status", asset.id === "rule-ext-1" && asset.status === "active", asset);
  const src = rows.filter((r) => r.usage === "source object");
  check("rule: source-object rows for extract tasks only (join skipped)", src.length === 2, src);
  check(
    "rule: task connection is TYPE-only",
    src[0].connection?.type === "SFDC" && src[0].connection?.id === null,
    src[0]
  );
  const filt = rows.filter((r) => r.usage === "filter");
  check(
    "rule: criteriaDetails condition normalized (name+label, object name+label)",
    filt.length === 1 && filt[0].fieldName === "Arr__gc" && filt[0].fieldLabel === "ARR" && filt[0].objectName === "company" && filt[0].objectLabel === "Company",
    filt
  );
  check(
    "rule: DATA_SYNC write target + source column rows",
    rows.some((r) => r.usage === "write target" && r.objectName === "company" && r.fieldName === "CSM") &&
      rows.some((r) => r.usage === "source column (mapping)" && r.fieldName === "Csm Name"),
    rows
  );
  check(
    "rule: REST_API action target row",
    rows.some((r) => r.usage === "action target" && r.objectName === "Call To Action" && r.fieldName === "Name"),
    rows
  );
  check(
    "rule: SET_SCOREV2 JSON-map yields scorecard+measure refs",
    scorecardRefs.scorecardIds.has("sc-1") && scorecardRefs.measureIds.has("m-1"),
    scorecardRefs
  );
  const connRows = rows.filter((r) => r.usage === "connection reference (action mapping)");
  check(
    "rule: action-mapping connections aggregated per id/type",
    connRows.length === 2 && connRows.some((r) => r.connection?.id === "conn-sfdc-1" && r.connection?.type === "SFDC"),
    connRows
  );
  const inactive = extractRuleUsages(RULE_INACTIVE);
  check("rule: inactive status", inactive.asset.status === "inactive", inactive.asset);
}

// ── unit: External Action callouts (F-217) ───────────────────────────────────

{
  const { rows } = extractRuleUsages(RULE_CALLOUT);
  const callouts = rows.filter((r) => r.usage === "external action callout");
  check(
    "rule: External Action callout parsed from params, aggregated per configId/connection pair (F-217)",
    callouts.length === 1 &&
      callouts[0].extAction?.id === "ext-lic-1" &&
      callouts[0].connection?.id === "conn-rest-1" &&
      /2 action step/.test(callouts[0].detail),
    callouts
  );
  check(
    "rule: callout rule's mapping walk sees only internal refs (the F-217 miss shape)",
    !rows.some((r) => r.usage === "connection reference (action mapping)" && r.connection?.id === "conn-rest-1"),
    rows.filter((r) => r.usage === "connection reference (action mapping)")
  );
  const ea = extractExternalAction(EXT_ACTION_DOC);
  check(
    "extractExternalAction: configId/name/config.connectionId",
    ea?.id === "ext-lic-1" && ea?.name === "Acme License Assigner" && ea?.connectionId === "conn-rest-1",
    ea
  );
  check("extractExternalAction: shapeless payload → null", extractExternalAction({ result: true, data: {} }) === null, null);
  // F-228: stub docs hold the RAW list row — no data wrapper — and the
  // wrapped-only read parsed every one to null on a stub-crawled tenant.
  const eaStub = extractExternalAction({ configId: "ext-lic-1", name: "Acme License Assigner", connectionId: "conn-rest-1" });
  check(
    "extractExternalAction: raw stub row (no data wrapper) parses (F-228)",
    eaStub?.id === "ext-lic-1" && eaStub?.name === "Acme License Assigner" && eaStub?.connectionId === "conn-rest-1",
    eaStub
  );
  const eaStubCfg = extractExternalAction({ configId: "ext-2", name: "Acme Nested", config: { connectionId: "conn-x" } });
  check("extractExternalAction: raw row with nested config.connectionId parses (F-228)", eaStubCfg?.connectionId === "conn-x", eaStubCfg);

  // F-229 / F-235: the mixed-step rule — evidence-honest label for the
  // connectionId-only step; space-bearing configId round-trips intact.
  const mixed = extractRuleUsages(RULE_MIXED);
  const soft = mixed.rows.filter((r) => r.usage === "action-step connection reference");
  check(
    "rule: connectionId-only params wears the evidence-honest label, never the callout kind (F-229)",
    soft.length === 1 && soft[0].connection?.id === "conn-s3-9" && soft[0].extAction === null && soft[0].stepCount === 1,
    soft
  );
  const spaced = mixed.rows.find((r) => r.usage === "external action callout");
  check(
    "rule: space-bearing configId round-trips the aggregation key intact (F-235)",
    spaced?.extAction?.id === "ext spaced 9" && spaced?.connection?.id === "conn-spaced-9",
    spaced
  );

  // F-236: table ↔ extractor correspondence, both directions — a parse walk
  // added without a table entry, or a table site the extractor no longer
  // emits, both go red here (the caveat is derived from the table).
  const emitted = new Set();
  for (const payload of [RULE_EXT, RULE_CALLOUT, RULE_MIXED])
    for (const r of extractRuleUsages(payload).rows)
      if (r.connection || r.extAction) emitted.add(r.usage);
  const claimed = new Set(RULE_CONNECTION_SITES.flatMap((s) => s.usages));
  check(
    "sites table ↔ extractor correspondence, both directions (F-236)",
    [...claimed].every((u) => emitted.has(u)) && [...emitted].every((u) => claimed.has(u)),
    { emitted: [...emitted].sort(), claimed: [...claimed].sort() }
  );

  const extReg = [ea];
  const [byName] = expandConnectionTerms(["acme license assigner"], [], extReg);
  check("expandConnectionTerms: External Action NAME resolves to its configId (F-217)", byName.extIds.has("ext-lic-1"), byName);
  const [byId] = expandConnectionTerms(["EXT-LIC-1"], [], extReg);
  check("expandConnectionTerms: External Action id term case-folds into extIds", byId.extIds.has("ext-lic-1"), byId);
  check(
    "expandConnectionTerms: naming an action does NOT expand to its connection (asks who calls the action, not who uses its connection)",
    byName.ids.size === 0 && byName.nameTypes.size === 0,
    byName
  );
  const calloutRow = {
    usage: "external action callout",
    objectName: null, objectLabel: null, fieldName: null, fieldLabel: null, altFields: [],
    connection: { id: "conn-rest-1", name: null, type: null },
    extAction: { id: "ext-lic-1", name: null },
    detail: "",
  };
  check(
    "matchRow: External Action term matches a callout row exact via extIds",
    matchRow(calloutRow, { connTerms: [byName] }).some((m) => m.kind === "connection" && m.quality === "exact"),
    matchRow(calloutRow, { connTerms: [byName] })
  );
  const [connTerm] = expandConnectionTerms(["acme license api"], [{ id: "conn-rest-1", name: "Acme License API", type: "REST_API" }], extReg);
  check(
    "matchRow: naming the REST connection matches the same callout row (connection edge)",
    matchRow(calloutRow, { connTerms: [connTerm] }).some((m) => m.kind === "connection" && m.quality === "exact"),
    connTerm
  );
}

{
  const { asset, rows } = extractReportUsages(REPORT_MDA);
  check("report: asset", asset.id === "rep-1" && asset.name === "Acme ARR by CSM" && asset.status === null, asset);
  check(
    "report: source object carries connection",
    rows.some((r) => r.usage === "source object" && r.objectName === "company" && r.connection?.type === "MDA"),
    rows
  );
  check(
    "report: show field rows incl. alias + calculated nesting",
    rows.some((r) => r.usage === "show field" && r.fieldName === "Arr__gc" && r.altFields.includes("FF_Arr")) &&
      rows.some((r) => r.usage === "show field (calculated)" && r.fieldName === "Csm_Name__gc"),
    rows
  );
  check("report: group-by row", rows.some((r) => r.usage === "group by" && r.fieldName === "Csm_Name__gc"), rows);
  check(
    "report: where filter row",
    rows.some((r) => r.usage === "filter" && r.fieldName === "Status__gc" && r.detail.includes("where")),
    rows
  );
}

{
  const { asset, rows } = extractJobUsages(JOB);
  check("job: asset enabled", asset.id === "job-1" && asset.status === "enabled", asset);
  check(
    "job: connection row carries id+name+type",
    rows.some((r) => r.usage === "job connection" && r.connection?.id === "conn-sfdc-1" && r.connection?.name === "Acme Prod SFDC" && r.connection?.type === "SFDC"),
    rows
  );
  check(
    "job: target object name+label",
    rows.some((r) => r.usage === "job target object" && r.objectName === "gs_pricebook" && r.objectLabel === "GS Pricebook"),
    rows
  );
  check(
    "job: task source object + field mapping with alias",
    rows.some((r) => r.usage === "job source object" && r.objectName === "Pricebook2") &&
      rows.some((r) => r.usage === "job field mapping" && r.fieldName === "Id" && r.altFields.includes("price_book_id__gs")),
    rows
  );
}

{
  // F-342: the LIVE shape — the envelope must be unwrapped for anything to parse.
  const { asset, rows } = extractDesignerUsages(DESIGNER);
  check("designer (enveloped, live shape): asset resolves through the data envelope (F-342)",
    asset.id === "dd-1" && asset.name === "Acme CTA Rollup", asset);
  check(
    "designer (enveloped): source object + show field + criteria condition",
    rows.some((r) => r.usage === "source object" && r.objectName === "call_to_action") &&
      rows.some((r) => r.usage === "show field" && r.fieldName === "Name") &&
      rows.some((r) => r.usage === "filter" && r.fieldName === "Arr__gc" && r.objectName === "company"),
    rows
  );
  // A bare body (older or hand-written doc) still parses — the unwrap falls back.
  const bare = extractDesignerUsages(DESIGNER_BODY);
  check("designer (bare body): still parses identically", JSON.stringify(bare) === JSON.stringify({ asset, rows }), bare.asset);
  // An array-valued `data` is not an envelope — it must not be indexed as one.
  const arr = extractDesignerUsages({ result: true, data: [DESIGNER_BODY] });
  check("designer: array-valued data is not unwrapped (asset null, no rows)", arr.asset.id === null && arr.rows.length === 0, arr);

  // F-343: the LIVE-summary generation — the common 1.0.8 shape. Rows must come
  // out of the summarizer's normalized keys; a task whose _object is "" (a
  // merge step) yields nothing; the blind-field marker rides the row.
  const sum = extractDesignerUsages(DESIGNER_LIVE_SUMMARY);
  check("designer (live-summary, F-343): asset resolves", sum.asset.id === "dd-2" && sum.asset.name === "Acme Company Health", sum.asset);
  check(
    "designer (live-summary): source-object rows from _object/_connType for the two extracts and the label-only pivot, none for the merge task with _object \"\"",
    sum.rows.length === 3 && sum.rows.every((r) => r.usage === "source object") && sum.rows[0].objectName === "company" &&
      sum.rows[0].objectLabel === null && sum.rows[0].connection?.type === "MDA" && sum.rows[0].connection?.id === null,
    sum.rows
  );
  // F-345: the compound display value splits into identifier + label.
  check(
    "designer (live-summary, F-345): \"Account Record (accountrec__gc)\" → objectName accountrec__gc, objectLabel Account Record",
    sum.rows[1].objectName === "accountrec__gc" && sum.rows[1].objectLabel === "Account Record",
    sum.rows[1]
  );
  // DS-45: a label-only value on a DERIVED task is the label alone — the row
  // carries it as objectLabel with objectName null, never as the name.
  check(
    "designer (live-summary, DS-45): label-only _object on a derived task → objectName null, objectLabel the label",
    sum.rows[2].objectName === null && sum.rows[2].objectLabel === "Acme Sponsor Tracking" && sum.rows[2].connection?.type === "MDA",
    sum.rows[2]
  );
  // Review round (W8): the RULES reader on the 1.0.8 task shape — a SIMPLE/SOF
  // rule's `_configTasks` row is summarizeTask's output (`_object` display
  // value, `_connType`), the same emitter the designer reader parses; taken
  // whole it matched neither term spelling (the F-345 class, one domain over).
  const sof = extractRuleUsages({
    result: true,
    data: {
      ruleDetails: {
        ruleId: "rule-sof-1", ruleName: "Acme|LOAD| Company Health", active: true,
        _configTasks: [
          { taskId: "t1", taskName: "Companies", taskType: "mdaExtract", _parents: "", _object: "Acme Company (acme_company__gc)", _connType: "MDA", _fieldCount: 3, _filterCount: 0, _groupByCount: 0, _index: 1 },
          { taskId: "t2", taskName: "Merge", taskType: "join", _parents: "t1", _object: "", _connType: "", _fieldCount: 5, _filterCount: 0, _groupByCount: 0, _index: 2 },
        ],
      },
    },
  });
  const sofSrc = sof.rows.filter((r) => r.usage === "source object");
  check(
    "rules (1.0.8 _configTasks row, review W8): the compound _object splits into name + label and _connType is the connection; the derived join row is skipped",
    sofSrc.length === 1 && sofSrc[0].objectName === "acme_company__gc" && sofSrc[0].objectLabel === "Acme Company" && sofSrc[0].connection?.type === "MDA",
    sof.rows
  );
  check(
    "rules (1.0.8 row): both term spellings and the connection type match the split row",
    matchRow(sofSrc[0], { objectTerms: [{ term: "acme_company__gc", lowered: "acme_company__gc" }] }).length === 1 &&
      matchRow(sofSrc[0], { objectTerms: [{ term: "Acme Company", lowered: "acme company" }] }).length === 1 &&
      matchRow(sofSrc[0], { objectTerms: [{ term: "Acme Company (acme_company__gc)", lowered: "acme company (acme_company__gc)" }] }).length === 0,
    sofSrc[0]
  );
  // The emitter's branches, inverted with the task type as the second input
  // (DS-45): bare+extract is a name; compound splits; a bare value on a
  // derived (or typeless) task is a label alone; bare+extract stays a name
  // even when it was a label — the format's collapsed branch, pinned as such.
  check(
    "parseSummaryObject: bare+extract / compound / label-only (derived, typeless) / bare+extract collapsed / empty / parenthesis-bearing label",
    JSON.stringify([
      parseSummaryObject("company", "mdaExtract"), parseSummaryObject("Company (company)", "mdaExtract"),
      parseSummaryObject("Company", "pivot"), parseSummaryObject("Company"), parseSummaryObject("Company", "mdaExtract"),
      parseSummaryObject("", "merge"), parseSummaryObject(undefined), parseSummaryObject("Rollup (v2) (rollup_v2__gc)", "join"),
    ]) === JSON.stringify([
      { name: "company", label: null }, { name: "company", label: "Company" },
      { name: null, label: "Company" }, { name: null, label: "Company" }, { name: "Company", label: null },
      { name: null, label: null }, { name: null, label: null }, { name: "rollup_v2__gc", label: "Rollup (v2)" },
    ]),
    [parseSummaryObject("Company", "pivot"), parseSummaryObject("Company", "mdaExtract"), parseSummaryObject("Rollup (v2) (rollup_v2__gc)", "join")]
  );
  check(
    "designer (live-summary): the row is marked field-blind and its detail carries the live taskName/taskType and the counts, not names",
    sum.rows[0].fieldNamesUnavailable === true &&
      /^task "Companies" \(mdaExtract\) — 4 field\(s\), 1 filter\(s\); names not in this payload \(summary task shape\)$/.test(sum.rows[0].detail),
    sum.rows[0].detail
  );
  // HYBRID (1.0.4 docs): summary keys plus the spread detail — the detail wins
  // nothing over the summary keys for object/type, and the field/filter rows return.
  const full = extractDesignerUsages(DESIGNER_HYBRID);
  check(
    "designer (hybrid 1.0.4 shape): source object + show field + filter rows, not field-blind",
    full.rows.some((r) => r.usage === "source object" && r.objectName === "call_to_action" && r.connection?.type === "MDA" && r.connection?.id === "MDA" && !r.fieldNamesUnavailable) &&
      full.rows.some((r) => r.usage === "show field" && r.fieldName === "Name") &&
      full.rows.some((r) => r.usage === "filter" && r.fieldName === "Arr__gc"),
    full.rows
  );
  // A DERIVED hybrid task (B12 tester's deferred observation 1): `_object`
  // carries the upstream TASK ID, and so does queryInfo.objectName. The split
  // files it as a label (derived → label), the queryInfo fallback fills the
  // name with the same value, and the render is what it was before DS-45 —
  // name "t1", no parenthetical (the cell hides a label equal to the name).
  // Pinned so the legacy fallback cannot be narrowed unknowingly; whether a
  // task-id self-reference belongs in the table at all is pre-existing.
  const hybrid = extractDesignerUsages({ result: true, data: { templateId: "dd-h", name: "H", _tasks: [HYBRID_DERIVED_TASK] } });
  const hybridSrc = hybrid.rows.filter((r) => r.usage === "source object");
  check(
    "designer (hybrid 1.0.4 shape, derived task): the task-id `_object` fills the name from queryInfo and the split label equals it — the pre-DS-45 render, unchanged",
    hybridSrc.length === 1 && hybridSrc[0].objectName === "t1" && hybridSrc[0].objectLabel === "t1" && hybridSrc[0].connection?.type === "MDA",
    hybrid.rows
  );
  // Precedence: a summarizer key that disagrees with the nested detail wins
  // (it is what the CLI resolved from ALL the object-name spellings).
  const prec = extractDesignerUsages({ result: true, data: { templateId: "dd-p", name: "P", _tasks: [{ ...LEGACY_TASK, _object: "company_override", _connType: "SFDC" }] } });
  check(
    "designer: summarizer _object/_connType take precedence over queryInfo/connectionDetails",
    prec.rows.find((r) => r.usage === "source object")?.objectName === "company_override" && prec.rows.find((r) => r.usage === "source object")?.connection?.type === "SFDC",
    prec.rows.find((r) => r.usage === "source object")
  );
  // Unknown future shape: parses, yields nothing — the caveat's job (e2e below).
  const weird = extractDesignerUsages({ result: true, data: { templateId: "dd-w", name: "W", _tasks: [{ id: "t1", brandNewKey: 1 }] } });
  check("designer (unknown task shape): asset resolves, zero rows, no throw", weird.asset.id === "dd-w" && weird.rows.length === 0, weird);
}

{
  const { asset, rows } = extractDatasetUsages(DATASET);
  check("dataset: asset from objectName/label", asset.id === "acme_mbo_tracking" && asset.name === "Acme MBO Tracking", asset);
  check(
    "dataset: object + field rows (displayName is the label)",
    rows.some((r) => r.usage === "dataset object" && r.objectName === "acme_mbo_tracking") &&
      rows.some((r) => r.usage === "dataset field" && r.fieldName === "Arr__gc" && r.fieldLabel === "ARR"),
    rows
  );
}

check(
  "connection: pnpConnectionsInfo parsed; garbage → null",
  extractConnection(CONN_1)?.name === "Acme Prod SFDC" && extractConnection({ foo: 1 }) === null && extractConnection(null) === null,
  extractConnection(CONN_1)
);
check(
  "connection (F-388): the FLAT 1.0.9 row parses to exactly the entry its nested twin would",
  isDeepStrictEqual(extractConnection(CONN_FLAT_S3), { id: "conn-s3-9", name: "Acme S3 Drop", type: "S3", status: "AUTHORIZED", auth: "ACCESS_KEY" }) &&
    isDeepStrictEqual(extractConnection({ pnpConnectionsInfo: CONN_FLAT_S3 }), extractConnection(CONN_FLAT_S3)),
  extractConnection(CONN_FLAT_S3)
);
check(
  "connection (F-388): the shape list is DATA walked nested-first then flat; a root with neither id nor name falls through, and neither root anywhere → null",
  CONNECTION_SHAPES.map((s) => s.shape).join(",") === "nested,flat" &&
    extractConnection({ pnpConnectionsInfo: { connectionType: "SFDC" } }) === null &&
    extractConnection({ connectionType: "SFDC" }) === null &&
    extractConnection({ pnpConnectionsInfo: { connectionType: "SFDC" }, connectionId: "conn-x" })?.id === "conn-x" &&
    extractConnection({ pnpConnectionsInfo: { connectionId: "conn-n" }, connectionId: "conn-f" })?.id === "conn-n",
  null
);

{
  const m = collectScorecardMeasures(SCORECARD, "Acme Scorecard");
  check(
    "scorecard: measure map by levelType (GROUP never a measure)",
    m.measureName["m-1"] === "Adoption" && m.measureCard["m-1"] === "Acme Scorecard" && m.measureGroup["m-1"] === "Engagement" && !m.measureName["g-1"],
    m
  );
}

// ── unit: connection term expansion + matching ───────────────────────────────

{
  const registry = [extractConnection(CONN_1), extractConnection(CONN_2), extractConnection(CONN_SNOW)];
  const [byName] = expandConnectionTerms(["acme prod sfdc"], registry);
  check("conn terms: name resolves to id + type", byName.ids.has("conn-sfdc-1") && byName.nameTypes.has("sfdc"), byName);
  check(
    "conn match: id ref → exact",
    matchConnection({ id: "conn-sfdc-1", name: null, type: "SFDC" }, byName)?.quality === "exact",
    null
  );
  check(
    "conn match: type-only ref via name term → type-level",
    matchConnection({ id: null, name: null, type: "SFDC" }, byName)?.quality === "type-level",
    null
  );
  check(
    "conn match: OTHER connection of same type is NOT exact",
    matchConnection({ id: "conn-sfdc-2", name: "Acme Sandbox SFDC", type: "SFDC" }, byName)?.quality === "type-level",
    null
  );
  const [byType] = expandConnectionTerms(["SNOWFLAKE"], registry);
  check("conn match: direct type term → exact", matchConnection({ id: null, name: null, type: "SNOWFLAKE" }, byType)?.quality === "exact", null);
  const [byId] = expandConnectionTerms(["conn-snow-1"], registry);
  check("conn match: GUID term → exact + type-level expansion", matchConnection({ id: "conn-snow-1", name: null, type: null }, byId)?.quality === "exact" && byId.nameTypes.has("snowflake"), byId);
  // internal types never match via type-level expansion, only explicitly
  const mdaRegistry = [{ id: "mda-conn", name: "Acme Internal", type: "MDA" }];
  const [byMdaName] = expandConnectionTerms(["acme internal"], mdaRegistry);
  check(
    "conn match: internal type excluded from type-level expansion",
    matchConnection({ id: null, name: null, type: "MDA" }, byMdaName) === null && INTERNAL_CONNECTIONS.has("MDA"),
    null
  );
  const [explicitMda] = expandConnectionTerms(["MDA"], mdaRegistry);
  check("conn match: explicit internal term still matches", matchConnection({ id: null, name: null, type: "MDA" }, explicitMda)?.quality === "exact", null);
}

// ── unit: generic row matching ───────────────────────────────────────────────

{
  const terms = {
    objectTerms: [{ term: "Company", lowered: "company" }],
    fieldTerms: [{ term: "ARR", lowered: "arr" }, { term: "price_book_id__gs", lowered: "price_book_id__gs" }],
    connTerms: [],
  };
  const byLabel = matchRow(
    { usage: "filter", objectName: "company_person", objectLabel: "Company", fieldName: "Arr__gc", fieldLabel: "ARR", altFields: [], connection: null },
    terms
  );
  check(
    "matchRow: object label + field label both match",
    byLabel.some((m) => m.kind === "object" && m.term === "Company") && byLabel.some((m) => m.kind === "field" && m.term === "ARR"),
    byLabel
  );
  const byAlias = matchRow(
    { usage: "job field mapping", objectName: null, objectLabel: null, fieldName: "Id", fieldLabel: "Price Book ID", altFields: ["price_book_id__gs"], connection: null },
    terms
  );
  check("matchRow: alias (altFields) matches a field term", byAlias.some((m) => m.kind === "field" && m.term === "price_book_id__gs"), byAlias);
  check(
    "matchRow: no substring",
    matchRow({ usage: "x", objectName: "company_person", objectLabel: null, fieldName: "Arr_Total__gc", fieldLabel: "ARR Total", altFields: [], connection: null }, terms).length === 0,
    null
  );
}

// ── unit: alias-aware field matching through matchRow (ER-22) ────────────────
// The primitives are jo-report-deps.mjs's (their own suite covers them);
// these prove matchRow wires them over this script's field surface.

{
  const fieldRow = (fieldName, over = {}) =>
    ({ usage: "source column (mapping)", objectName: null, objectLabel: null, fieldName, fieldLabel: null, altFields: [], connection: null, ...over });
  const aliasTerms = {
    objectTerms: [],
    fieldTerms: [prepFieldTerm("Renewal Amount")],
    connTerms: [],
    aliasPrefix: compileAliasPrefix("^[A-Z]_"),
  };
  const hit = matchRow(fieldRow("A_Renewal Amount"), aliasTerms);
  check(
    "matchRow: task-alias prefixed field matches its unprefixed term, carrying how + full candidate",
    hit.length === 1 && hit[0].kind === "field" && hit[0].how === "task-alias" && hit[0].candidate === "A_Renewal Amount",
    hit
  );
  check(
    "matchRow: separator equivalence (`A_Renewal_Amount` for term 'Renewal Amount')",
    matchRow(fieldRow("A_Renewal_Amount"), aliasTerms)[0]?.how === "task-alias" &&
      matchRow(fieldRow("Renewal_Amount"), aliasTerms)[0]?.how === "separator-equivalent",
    null
  );
  check(
    "matchRow: alias mode is still NEVER substring (traps stay unmatched)",
    matchRow(fieldRow("Renewal Amount Total"), aliasTerms).length === 0 &&
      matchRow(fieldRow("AB_Renewal Amount"), aliasTerms).length === 0 &&
      matchRow(fieldRow("X_Renewal"), aliasTerms).length === 0,
    null
  );
  check(
    "matchRow: without aliasPrefix the prefixed field does NOT match (today's behavior)",
    matchRow(fieldRow("A_Renewal Amount"), { ...aliasTerms, aliasPrefix: null }).length === 0,
    null
  );
  check(
    "matchRow: alias applies to altFields too (the existing alias hook, extended not replaced)",
    matchRow(fieldRow("Other", { altFields: ["B_Renewal Amount"] }), aliasTerms)[0]?.candidate === "B_Renewal Amount",
    null
  );
  const near = new Map();
  addNearMisses(near, fieldCandidates(fieldRow("Legacy_Renewal_Amount_Flag")), aliasTerms.fieldTerms);
  addNearMisses(near, fieldCandidates(fieldRow("Churn Score")), aliasTerms.fieldTerms);
  check(
    "addNearMisses over fieldCandidates: word-sharing non-match reported per term; unrelated names are not",
    near.get("Renewal Amount")?.size === 1 && near.get("Renewal Amount").has("Legacy_Renewal_Amount_Flag"),
    [...(near.get("Renewal Amount") ?? [])]
  );
}

check(
  "normalizeCondition: leftOperand unwrap keeps object label",
  (() => {
    const n = normalizeCondition({
      leftOperand: { fieldName: "F", label: "Field", objectName: "o", objectLabel: "Object" },
      comparisonOperator: "IN",
      filterAlias: "B",
    });
    return n.fieldName === "F" && n.fieldLabel === "Field" && n.objectName === "o" && n.objectLabel === "Object" && n.filterAlias === "B";
  })(),
  null
);

// ── unit: all-areas live-deps parser (shared jo-report-deps primitive) ───────

{
  const payload = DEPS_CHECK;
  const parsed = parseLiveDepsAreas(JSON.stringify(payload));
  check(
    "liveDeps: ALL areas kept (not just JO)",
    parsed.complete && Object.keys(parsed.areas).sort().join(",") === "C360,JOURNEY_ORCHESTRATOR,REPORT,RULE" && parsed.areas.RULE[0].columns[0] === "ARR",
    parsed
  );
  check("liveDeps: garbage → null", parseLiveDepsAreas("nope") === null && parseLiveDepsAreas("{}") === null, null);
  const incomplete = parseLiveDepsAreas(JSON.stringify({ data: { objectName: "x", progressStatus: { overallStatus: "INIT" }, dependents: { RULE: [] } } }));
  check("liveDeps: incomplete flagged", incomplete && incomplete.complete === false, incomplete);
  // the JO-scoped view is a filtered delegation of the same primitive — the
  // two must agree entity-for-entity
  const jo = parseLiveDeps(JSON.stringify(payload));
  check(
    "liveDeps: parseLiveDeps delegates to the all-areas primitive",
    JSON.stringify(jo.dependents) === JSON.stringify(parsed.areas.JOURNEY_ORCHESTRATOR) && jo.complete === parsed.complete,
    jo
  );
}

// ── unit: JO reuse path ──────────────────────────────────────────────────────

{
  const { doc } = renderProgramDoc(JOURNEY_PAYLOAD, { key: "journey/prog-1" });
  const { entry } = parseJourneyDoc(doc, "journey/prog-1.md");
  const rows = journeyUsageRows(entry);
  check(
    "journey: renderProgramDoc→parseJourneyDoc→usageCandidates rows",
    entry.depth === "full" &&
      rows.some((r) => r.usage === "filter" && r.objectName === "company" && r.fieldName === "Arr__gc") &&
      rows.some((r) => r.usage === "projected/show field" && r.fieldName === "recipientEmailAddress"),
    { depth: entry.depth, rows }
  );
}

// ── e2e: synthetic KB → report + CSVs + summary JSON ─────────────────────────

const KB = join(ROOT, "acme-prod");
const doc = (domain, base, name, payload, extraBullets = []) => {
  mkdirSync(join(KB, domain), { recursive: true });
  const md = [
    `# ${name}`,
    "",
    `- key: ${domain}/${base}`,
    `- id: ${base}`,
    `- name: ${name}`,
    ...extraBullets,
    "",
    "```json",
    JSON.stringify(payload, null, 1),
    "```",
    "",
  ].join("\n");
  writeFileSync(join(KB, domain, `${base}.md`), md, "utf8");
};
doc("rules-engine", "rule-ext-1", "Acme|LOAD| CSM to Company", RULE_EXT);
doc("rules-engine", "rule-sc-2", "Acme Scorecard Grade Setter", RULE_SC_LEVEL);
doc("rules-engine", "rule-snow-1", "Acme Snowflake Pull", RULE_INACTIVE);
doc("rules-engine", "rule-alias-1", "Acme|DATA| Renewal Amount v2", RULE_ALIAS);
doc("rules-engine", "rule-callout-1", "Acme License Callout", RULE_CALLOUT);
doc("rules-engine", "rule-mixed-1", "Acme Mixed Steps", RULE_MIXED);
doc("rules-engine", "rule-dollar-1", "Acme Dollar Callout", RULE_DOLLAR);
doc("rules-engine-external-actions", "ext-lic-1", "Acme License Assigner", EXT_ACTION_DOC);
doc("rules-engine-external-actions", "ext-dollar-1", "Send Dollar Webhook", EXT_DOLLAR_DOC);
doc("connectors", "conn-rest-1", "Acme License API", {
  pnpConnectionsInfo: { connectionId: "conn-rest-1", connectionName: "Acme License API", connectionType: "REST_API", connectionStatus: "ACTIVE", authorizationType: "NoAuth" },
});
doc("report", "rep-1", "Acme ARR by CSM", REPORT_MDA);
doc("report", "rep-sfdc-1", "Acme Open Opportunities", REPORT_SFDC);
doc("connectors-jobs", "job-1", "Acme Pricebook Sync", JOB);
// All three designer generations live in the e2e KB (F-342/F-343): the legacy
// bare doc, the live-summary doc (matches --object Company via _object; its
// rows are field-blind, which the --field term below turns into a caveat), and
// the hybrid 1.0.4-shape doc.
doc("data-designer", "dd-1", "Acme CTA Rollup", DESIGNER_LEGACY);
doc("data-designer", "dd-2", "Acme Company Health", DESIGNER_LIVE_SUMMARY);
doc("data-designer", "dd-3", "Acme CTA Rollup (full)", DESIGNER_HYBRID);
doc("journey-data-designer", "acme_mbo_tracking", "Acme MBO Tracking", DATASET);
doc("connectors", "conn-sfdc-1", "Acme Prod SFDC", CONN_1);
doc("connectors", "conn-sfdc-2", "Acme Sandbox SFDC", CONN_2);
doc("connectors", "conn-snow-1", "Acme Snowflake", CONN_SNOW);
// F-388: one FLAT (CLI 1.0.9) connector doc beside the four nested ones, plus a
// job on it — the mixed KB; its own e2e arm runs below.
doc("connectors", "conn-s3-9", "Acme S3 Drop", CONN_FLAT_S3);
doc("connectors-jobs", "job-s3-9", "Acme S3 Usage Load", JOB_S3);
doc("scorecard", "sc-1", "Acme Scorecard", SCORECARD);
// F-341: a scorecard doc whose `- id:` bullet is an inline code span, the
// shape four domains' KB docs actually carry. The scorecard-level rule above
// scores sc-9 by bare GSID; the registry keyed on this doc must resolve it.
writeFileSync(
  join(KB, "scorecard", "sc-9.md"),
  "# Acme Grade Card\n\n- key: `scorecard/sc-9`\n- id: `sc-9`\n- name: Acme Grade Card\n\n```json\n" +
    JSON.stringify({ result: true, data: { scorecardId: "sc-9", name: "Acme Grade Card", children: [] } }, null, 1) +
    "\n```\n",
  "utf8"
);
mkdirSync(join(KB, "journey"), { recursive: true });
writeFileSync(join(KB, "journey", "prog-1.md"), renderProgramDoc(JOURNEY_PAYLOAD, { key: "journey/prog-1" }).doc, "utf8");
writeFileSync(
  join(KB, "_manifest.json"),
  JSON.stringify({
    slug: "acme-prod",
    baseUrl: "https://acme.gainsightcloud.com",
    environment: "sandbox",
    inventory: {
      "journey/prog-1": { domain: "journey", id: "prog-1", depth: "full", last_verified: "2026-07-01T00:00:00.000Z" },
      "journey/prog-stub": { domain: "journey", id: "prog-stub", depth: "metadata", last_verified: "2026-07-02T00:00:00.000Z" },
      "rules-engine/rule-ext-1": { domain: "rules-engine", id: "rule-ext-1", depth: "full", last_verified: "2026-07-03T00:00:00.000Z" },
    },
  }),
  "utf8"
);
const CAPTURE = join(ROOT, "deps-check-company.json");
writeFileSync(
  CAPTURE,
  JSON.stringify({
    result: true,
    data: {
      objectName: "company",
      progressStatus: { overallStatus: "COMPLETED" },
      dependents: {
        RULE: [
          { entityId: "rule-ext-1", entityName: "Acme|LOAD| CSM to Company", columnReferences: [{ displayName: "ARR" }] },
          { entityId: "rule-undoc-9", entityName: "Acme Undocumented Rule" },
        ],
        REPORT: [{ entityId: "rep-1", entityName: "Acme ARR by CSM" }],
        SCORECARD: [
          { entityId: "sc-1", entityName: "Acme Scorecard" },
          { entityId: "sc-other", entityName: "Acme Other Scorecard" },
        ],
        C360: [{ entityId: "layout-1", entityName: "Acme C360 Layout" }],
      },
    },
  }),
  "utf8"
);

const REPORT_DIR = join(ROOT, "reports");
const CSV_DIR = join(ROOT, "csv");
const res = spawnSync(
  process.execPath,
  [
    SCRIPT,
    "--kb", KB,
    "--object", "Company",
    "--field", "ARR",
    "--connection", "Acme Prod SFDC",
    "--live-deps", CAPTURE,
    "--report", REPORT_DIR,
    "--csv-dir", CSV_DIR,
  ],
  { encoding: "utf8" }
);
check("e2e: exit 0", res.status === 0, { status: res.status, stderr: res.stderr?.slice(0, 400) });
let summary = null;
try {
  summary = JSON.parse(res.stdout);
} catch { /* not JSON: summary stays null and the next check names it */ }
check("e2e: stdout is summary JSON", summary?.ok === true && summary?.mode === "tenant-deps", res.stdout?.slice(0, 300));
check(
  "e2e: per-domain counts (rules 7 scanned/2 matched, reports 2/2, jobs 1/1, designers 3/3 across all three task generations, datasets 1/1, journeys 1/1)",
  summary &&
    summary.counts.rulesScanned === 7 &&
    summary.counts.rulesMatched === 2 &&
    summary.counts.reportsMatched === 2 &&
    summary.counts.jobsMatched === 1 &&
    summary.counts.designersScanned === 3 &&
    summary.counts.designersYielding === 3 &&
    summary.counts.designersMatched === 3 &&
    summary.counts.datasetsMatched === 1 &&
    summary.counts.journeysMatched === 1,
  summary?.counts
);
check(
  "e2e: registry (4 nested + 1 flat, F-388) + matched connection + scorecard edges (measure + scorecard-level) + live capture counted",
  summary && summary.counts.connectionsRegistry === 5 && summary.counts.connectionsMatched === 1 && summary.counts.scorecardEdges === 3 && summary.counts.liveCaptures === 1, // 3 since F-341: sc-1 measure row + sc-9 (documented, backticked id) + sc-8 (undocumented) scorecard-level rows
  summary?.counts
);
check(
  "e2e: External Action registry loaded (both actions, incl. the $-named one); none matched by unrelated terms (F-217)",
  summary && summary.counts.externalActionsRegistry === 2 && summary.counts.externalActionsMatched === 0,
  summary?.counts
);
const reportFile = summary?.reportPath;
check("e2e: report file written", reportFile && existsSync(reportFile), reportFile);
const md = reportFile && existsSync(reportFile) ? readFileSync(reportFile, "utf8") : "";
check(
  "e2e F-343: the --field term surfaces the designer field-blind caveat with its reason breakdown (summary-shape tasks carry counts, not names; 3 rows since the DS-45 label-only pivot joined the fixture)",
  md.includes("Data designers: 3 row(s) carry no system field name — 3 from the CLI's summary task shape (no drilldown ingested — counts only) —"),
  md.match(/.*carry no system field name.*/)?.[0]?.slice(0, 260)
);
check(
  "e2e F-343 (negative control): a KB whose designer docs all yield rows carries NO yield-honesty caveat",
  !md.includes("yielded ZERO usage rows"),
  md.match(/.*yielded ZERO.*/)?.[0]
);
check(
  "e2e F-343: the live-summary designer matches --object Company via _object and lists the counts-only detail",
  /| Acme Company Health |.*| source object | company |.*names not in this payload (summary task shape)/.test(md),
  md.match(/| Acme Company Health |.*/)?.[0]?.slice(0, 260)
);
check("e2e: tenant-wide H1 (not the JO title)", md.startsWith("# Tenant-wide dependency report"), md.slice(0, 80));
check("e2e: header identifies the fixture tenant", md.includes("acme-prod") && md.includes("acme.gainsightcloud.com"), null);
check(
  "e2e: freshness from manifest last_verified range",
  md.includes("KB last_verified 2026-07-01 → 2026-07-03"),
  md.match(/freshness.*/)?.[0]
);
check(
  "e2e: rule matched on object + field + connection (exact via action-mapping id)",
  // mdCell escapes pipes inside table cells — assert the rendered form
  md.includes("Acme\\|LOAD\\| CSM to Company") && md.includes("connection `Acme Prod SFDC`"),
  md.match(/.*CSM to Company.*/)?.[0]?.slice(0, 200)
);
check(
  "e2e: SFDC-sourced report matched type-level with label",
  md.includes("Acme Open Opportunities") && md.includes("(type-level)"),
  null
);
check(
  "e2e: scorecard section resolves the measure via the matching rule",
  md.includes("Adoption") && md.includes("Acme Scorecard") && md.includes("Engagement"),
  null
);
check(
  "e2e: scorecard-level scoring rule surfaces the card even with no measure mapping",
  md.includes("(scorecard-level)") && md.includes("Acme Scorecard Grade Setter"),
  md.slice(md.indexOf("## Scorecards"), md.indexOf("## Scorecards") + 600)
);
check(
  "e2e F-341: a scorecard documented with a backtick-quoted `- id:` resolves by TITLE in the scorecard-level row",
  md.includes("Acme Grade Card") && !md.includes("`sc-9` (unresolved)"),
  md.slice(md.indexOf("## Scorecards"), md.indexOf("## Scorecards") + 600)
);
check(
  "e2e F-341 scope: a scorecard with NO doc still renders as an unresolved id (the other, correct failure mode)",
  md.includes("`sc-8` (unresolved)"),
  md.slice(md.indexOf("## Scorecards"), md.indexOf("## Scorecards") + 600)
);
check(
  "e2e: live section renders all areas with per-domain verdicts",
  md.includes("Live dependents of `company`") &&
    md.includes("area not scanned by this tool") &&
    md.includes("Acme Undocumented Rule") &&
    /RULE \|.*rule-ext-1.*\| yes/.test(md.replace(/\s+/g, " ")),
  null
);
check(
  "e2e: SCORECARD live verdict is per-dependent (covered card yes, unrelated card no)",
  /sc-1.*\| yes — see the scorecard section/.test(md.replace(/\s+/g, " ")) &&
    /sc-other.*\| no — not set by any matching scoring rule/.test(md.replace(/\s+/g, " ")),
  md.slice(md.indexOf("Live dependents"))
);
check(
  "e2e: caveats — journey stub count, type-level note, ambiguity (2 SFDC connections), corroboration hint",
  md.includes("1 journey doc(s) are metadata-only stubs") &&
    md.includes("type-level") &&
    md.includes("2 documented SFDC connections") &&
    md.includes("dm deps check"),
  md.slice(md.indexOf("## Caveats"))
);
check("e2e: mandatory caveats section present", md.includes("## Caveats & data gaps"), null);
for (const f of [
  "tenant-deps-rules.csv",
  "tenant-deps-journeys.csv",
  "tenant-deps-reports.csv",
  "tenant-deps-connector-jobs.csv",
  "tenant-deps-data-designers.csv",
  "tenant-deps-journey-datasets.csv",
  "tenant-deps-scorecards.csv",
  "tenant-deps-live-dependents.csv",
  "tenant-deps-caveats.csv", // F-388: every caveat rides the CSV/XLSX path
])
  check(`e2e: CSV ${f} written with data rows`, existsSync(join(CSV_DIR, f)) && readFileSync(join(CSV_DIR, f), "utf8").trim().split("\r\n").length > 1, f);
check(
  "e2e: rules CSV quotes the piped asset name",
  readFileSync(join(CSV_DIR, "tenant-deps-rules.csv"), "utf8").includes('"Acme|LOAD| CSM to Company"'),
  null
);

// ── e2e: External Action callouts (F-217, the PV-6 step-5 shape offline) ─────
// Naming the External Action (by name) and naming the REST connection it
// calls through must BOTH find the callout rule — the two spellings of the
// question "what breaks if I re-point this".

{
  const byAction = spawnSync(
    process.execPath,
    [SCRIPT, "--kb", KB, "--connection", "Acme License Assigner", "--report", REPORT_DIR],
    { encoding: "utf8" }
  );
  const aSummary = JSON.parse(byAction.stdout);
  const aMd = readFileSync(aSummary.reportPath, "utf8");
  check(
    "e2e F-217: External Action NAME term finds the callout rule (was the confident zero)",
    byAction.status === 0 && aSummary.counts.rulesMatched === 1 && aSummary.counts.externalActionsMatched === 1,
    aSummary.counts
  );
  check(
    "e2e F-217: callout row resolved — usage, action name+id in detail, connection name from registry",
    aMd.includes("external action callout") &&
      aMd.includes('calling external action "Acme License Assigner" (ext-lic-1)') &&
      aMd.includes("Acme License API"),
    aMd.match(/.*external action callout.*/)?.[0]?.slice(0, 300)
  );
  check(
    "e2e F-217: External actions section + summary line list the matched action",
    aMd.includes("## External actions — 1 matching external action asset(s)") &&
      aMd.includes("- external actions resolved: Acme License Assigner"),
    aMd.match(/.*external actions resolved.*/)?.[0]
  );
  check(
    "e2e F-217/F-236: reference-site caveat is DERIVED from RULE_CONNECTION_SITES",
    aMd.includes(`read from ${RULE_CONNECTION_SITES.length} sites`) &&
      RULE_CONNECTION_SITES.every((s) => aMd.includes(s.site)),
    aMd.match(/.*sites.*/)?.[0]?.slice(0, 250)
  );
  check(
    "e2e F-228 non-fire: parse-honesty caveat absent while ext-action docs parse",
    !aMd.includes("parsed to 0 registry entries"),
    null
  );

  const byConn = spawnSync(
    process.execPath,
    [SCRIPT, "--kb", KB, "--connection", "Acme License API", "--report", REPORT_DIR],
    { encoding: "utf8" }
  );
  const cSummary = JSON.parse(byConn.stdout);
  check(
    "e2e F-217: REST connection term finds the same callout rule via the connection edge",
    byConn.status === 0 && cSummary.counts.rulesMatched === 1 && cSummary.counts.connectionsMatched === 1,
    cSummary.counts
  );

  const byConfigId = spawnSync(
    process.execPath,
    [SCRIPT, "--kb", KB, "--connection", "ext-lic-1", "--report", REPORT_DIR],
    { encoding: "utf8" }
  );
  const idSummary = JSON.parse(byConfigId.stdout);
  check(
    "e2e F-217: bare configId term finds the callout rule (the PV-6 repro spelling)",
    byConfigId.status === 0 && idSummary.counts.rulesMatched === 1 && idSummary.counts.externalActionsMatched === 1,
    idSummary.counts
  );

  // F-230: the resolved detail is re-rendered from structured parts — a
  // $-bearing KB action name must land verbatim (the old String.replace
  // recomposition expanded "$&" into the matched phrase).
  const byDollar = spawnSync(
    process.execPath,
    [SCRIPT, "--kb", KB, "--connection", "ext-dollar-1", "--report", REPORT_DIR],
    { encoding: "utf8" }
  );
  const dSummary = JSON.parse(byDollar.stdout);
  const dMd = readFileSync(dSummary.reportPath, "utf8");
  check(
    "e2e F-230: $-bearing action name renders verbatim (no GetSubstitution expansion)",
    byDollar.status === 0 && dMd.includes('calling external action "Send $& Webhook" (ext-dollar-1)'),
    dMd.match(/.*ext-dollar-1.*/)?.[0]?.slice(0, 300)
  );

  // F-229: the connectionId-only step surfaces in a report under the
  // evidence-honest label.
  const bySoft = spawnSync(
    process.execPath,
    [SCRIPT, "--kb", KB, "--connection", "conn-s3-9", "--report", REPORT_DIR],
    { encoding: "utf8" }
  );
  const sSummary = JSON.parse(bySoft.stdout);
  const sMd = readFileSync(sSummary.reportPath, "utf8");
  check(
    "e2e F-229: connectionId-only action step reports as action-step connection reference",
    bySoft.status === 0 && sSummary.counts.rulesMatched === 1 && sMd.includes("action-step connection reference"),
    sMd.match(/.*conn-s3-9.*/)?.[0]?.slice(0, 200)
  );
}

// ── e2e: all-unparseable ext-action domain must say so (F-228) ───────────────
{
  const KB2 = join(ROOT, "acme-unparseable");
  const doc2 = (domain, base, name, payload) => {
    mkdirSync(join(KB2, domain), { recursive: true });
    writeFileSync(
      join(KB2, domain, `${base}.md`),
      `# ${name}\n\n- key: ${domain}/${base}\n- id: ${base}\n- name: ${name}\n\n\`\`\`json\n${JSON.stringify(payload, null, 1)}\n\`\`\`\n`,
      "utf8"
    );
  };
  doc2("rules-engine", "rule-callout-1", "Acme License Callout", RULE_CALLOUT);
  doc2("rules-engine-external-actions", "ext-weird-1", "Acme Weird Shape", { totallyNewShape: { v: 2 } });
  // Same shape for the CONNECTION registry (DS-24 review round: connStats was
  // computed and discarded, so this domain's confident zero had no caveat).
  doc2("connectors", "conn-weird-1", "Acme Weird Connector", { totallyNewConnShape: { v: 2 } });
  // Third registry lane (gate-3 F-349): the scorecard registry's {docs, parsed}
  // pair was computed and never read — an all-unparseable scorecard domain
  // rendered every measure a matched rule scores as unresolved with no caveat.
  // Written with a BROKEN fence so parseDocJson fails (the lane's signature is
  // docs>0 && parsed===0; a parseable weird shape still parses).
  mkdirSync(join(KB2, "scorecard"), { recursive: true });
  writeFileSync(join(KB2, "scorecard", "sc-weird-1.md"), "# Acme Weird Scorecard\n\n- key: scorecard/sc-weird-1\n- id: sc-weird-1\n- name: Acme Weird Scorecard\n\n```json\n{ not json\n```\n", "utf8");
  // F-343 yield honesty: a designer doc that PARSES but whose task shape the
  // reader does not understand — the all-parsed-zero-yield signature.
  doc2("data-designer", "dd-weird-1", "Acme Weird Designer", { result: true, data: { templateId: "dd-w", name: "Acme Weird Designer", _tasks: [{ id: "t1", brandNewTaskKey: 1 }] } });
  const r2 = spawnSync(
    process.execPath,
    [SCRIPT, "--kb", KB2, "--connection", "conn-rest-1", "--report", join(ROOT, "rep2")],
    { encoding: "utf8" }
  );
  const s2 = JSON.parse(r2.stdout);
  const md2 = readFileSync(s2.reportPath, "utf8");
  check(
    "e2e F-228: all-unparseable ext-action domain surfaces the parse-honesty caveat",
    r2.status === 0 && md2.includes("parsed to 0 registry entries"),
    md2.match(/.*registry entries.*/)?.[0]?.slice(0, 200)
  );
  check(
    "e2e F-228 (DS-24 review): all-unparseable connectors domain surfaces its own parse-honesty caveat",
    r2.status === 0 && md2.includes("connectors doc(s) parsed to 0 registry entries"),
    md2.match(/.*connectors doc.*/)?.[0]?.slice(0, 200)
  );
  check(
    "e2e F-349: all-unparseable scorecard domain surfaces the registry parse-honesty caveat (third lane, one table)",
    r2.status === 0 && md2.includes("scorecard doc(s) parsed to 0 registry entries") && /measure names cannot be resolved/.test(md2),
    md2.match(/.*scorecard doc.*/)?.[0]?.slice(0, 200)
  );
  check(
    "e2e F-388: the all-unparseable caveat now names the remedy (re-capture with the installed CLI), and the JSON counts carry docs 1 / unparsed 1 for the lane",
    /All 1 connectors doc\(s\) parsed to 0 registry entries — .*Re-capture the connectors domain with the installed CLI/.test(md2) &&
      s2.counts.connectionsDocs === 1 && s2.counts.connectionsUnparsed === 1 && s2.counts.connectionsRegistry === 0,
    { counts: s2.counts, line: md2.match(/.*connectors doc\(s\).*/)?.[0]?.slice(0, 300) }
  );
  check(
    "e2e F-343: a domain whose parsed docs ALL yield zero usage rows surfaces the yield-honesty caveat",
    r2.status === 0 && md2.includes("Data designers: ALL 1 parsed doc(s) yielded ZERO usage rows before any term matching") &&
      s2.counts.designersScanned === 1 && s2.counts.designersYielding === 0,
    md2.match(/.*yielded ZERO usage rows.*/)?.[0]?.slice(0, 220)
  );
  check(
    "e2e F-343: the rollup table carries the 'docs yielding usages' column (0/1 for the weird designer)",
    md2.includes("docs yielding usages") && /\| Data designers \| 1\/1 \| 0\/1 \|/.test(md2),
    md2.match(/\| Data designers \|.*/)?.[0]
  );
}

// ── e2e F-388: the flat 1.0.9 connection row in a MIXED KB ───────────────────
// The main KB carries four nested connector docs and one flat one (CONN_FLAT_S3):
// the long-lived-workspace case the probe measured SILENT before the fix
// (registry non-empty from the nested docs, the flat connection matched
// nothing — no Connections row, no type-level rule rows, no id resolution —
// and no caveat). Both spellings of the flat connection must resolve, its
// dependency rows appear, and the shortfall caveat must NOT fire: nothing is
// missing. The nested control is the main run above (Acme Prod SFDC → matched 1).
{
  const runConn = (term, dir) => {
    const r = spawnSync(process.execPath, [SCRIPT, "--kb", KB, "--connection", term, "--report", join(ROOT, dir), "--csv-dir", join(ROOT, `${dir}-csv`)], { encoding: "utf8" });
    const s = r.status === 0 ? JSON.parse(r.stdout) : null;
    return {
      code: r.status,
      s,
      md: s ? readFileSync(s.reportPath, "utf8") : "",
      csv: s ? readFileSync(join(ROOT, `${dir}-csv`, "tenant-deps-caveats.csv"), "utf8") : "",
    };
  };
  const byName = runConn("Acme S3 Drop", "rep-f388-name");
  check(
    "e2e F-388: a --connection term naming the FLAT connection resolves it (registry 5 = 4 nested + 1 flat, matched 1) and its Connections row carries id, type, status and auth",
    byName.code === 0 && byName.s.counts.connectionsRegistry === 5 && byName.s.counts.connectionsMatched === 1 &&
      /\| Acme S3 Drop \| conn-s3-9 \| S3 \| AUTHORIZED \| ACCESS_KEY \|/.test(byName.md),
    byName.md.match(/.*Acme S3 Drop.*/)?.[0]?.slice(0, 200)
  );
  check(
    "e2e F-388: the flat connection's dependency rows appear (the connector job on it, exact via connectionDetails.connectionId)",
    byName.s?.counts.jobsMatched === 1 && /\| Acme S3 Usage Load \(job-s3-9\) \| enabled \| job connection \|/.test(byName.md),
    byName.md.match(/.*Acme S3 Usage Load.*/)?.[0]?.slice(0, 200)
  );
  check(
    "e2e F-388 (negative pin): a KB whose connector docs ALL parse carries NO shortfall caveat on either surface, and the JSON counts read docs 5 / unparsed 0",
    byName.code === 0 && !byName.md.includes("parsed to no connection") && !byName.md.includes("parsed to 0 registry entries") &&
      !byName.csv.includes("parsed to no connection") && byName.s.counts.connectionsDocs === 5 && byName.s.counts.connectionsUnparsed === 0,
    { counts: byName.s?.counts, caveat: byName.md.match(/.*parsed to.*/)?.[0] }
  );
  const byId = runConn("conn-s3-9", "rep-f388-id");
  check(
    "e2e F-388: the flat connection's ID spelling resolves to the same connection and the same job rows",
    byId.code === 0 && byId.s.counts.connectionsMatched === 1 && byId.s.counts.jobsMatched === 1 && byId.md.includes("Acme S3 Drop"),
    byId.s?.counts
  );
}

// ── e2e F-388: the PARTIAL registry shortfall — counted, reported, remedied ──
// One garbage connector doc among parseable ones (nested + flat). Before F-388
// the lanes fired on the all-fail signature only, so this case was silent. The
// caveat must name the count and the remedy on the markdown surface AND in the
// caveats CSV (the workbook path), and the JSON counts must carry the pair.
// Same table, every lane (F-349): the External Action lane gets the identical
// arrangement and must report its own shortfall by construction.
{
  const KB3 = join(ROOT, "kb-f388-shortfall");
  const doc3 = (domain, base, name, payload) => {
    mkdirSync(join(KB3, domain), { recursive: true });
    writeFileSync(
      join(KB3, domain, `${base}.md`),
      `# ${name}\n\n- key: ${domain}/${base}\n- id: ${base}\n- name: ${name}\n\n\`\`\`json\n${JSON.stringify(payload, null, 1)}\n\`\`\`\n`,
      "utf8"
    );
  };
  doc3("connectors", "conn-sfdc-1", "Acme Prod SFDC", CONN_1);
  doc3("connectors", "conn-s3-9", "Acme S3 Drop", CONN_FLAT_S3);
  doc3("connectors", "conn-weird-1", "Acme Weird Connector", { totallyNewConnShape: { v: 3 } });
  doc3("rules-engine-external-actions", "ext-lic-1", "Acme License Assigner", EXT_ACTION_DOC);
  doc3("rules-engine-external-actions", "ext-weird-1", "Acme Weird Shape", { totallyNewShape: { v: 3 } });
  doc3("connectors-jobs", "job-s3-9", "Acme S3 Usage Load", JOB_S3);
  writeFileSync(join(KB3, "_manifest.json"), JSON.stringify({ slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "sandbox", inventory: {} }), "utf8");
  const r3 = spawnSync(process.execPath, [SCRIPT, "--kb", KB3, "--connection", "Acme S3 Drop", "--report", join(ROOT, "rep3"), "--csv-dir", join(ROOT, "csv3")], { encoding: "utf8" });
  const s3 = r3.status === 0 ? JSON.parse(r3.stdout) : null;
  const md3 = s3 ? readFileSync(s3.reportPath, "utf8") : "";
  const csv3 = existsSync(join(ROOT, "csv3", "tenant-deps-caveats.csv")) ? readFileSync(join(ROOT, "csv3", "tenant-deps-caveats.csv"), "utf8") : "";
  const CONN_SHORTFALL = "1 of 3 connectors doc(s) parsed to no connection — those connections are absent from the registry";
  check(
    "e2e F-388: one unparseable connector doc among parseable ones → the Caveats section names 1 of 3 and the remedy (re-capture with the installed CLI, or inspect the payload shape)",
    r3.status === 0 && md3.includes(CONN_SHORTFALL) && /Re-capture the connectors domain with the installed CLI/.test(md3),
    { status: r3.status, stderr: r3.stderr?.slice(0, 200), line: md3.match(/.*connectors doc\(s\).*/)?.[0]?.slice(0, 300) }
  );
  check(
    "e2e F-388 (consumer-parity): the same shortfall line is on the CSV/XLSX surface (tenant-deps-caveats.csv) and the JSON counts carry docs 3 / unparsed 1 / registry 2",
    csv3.includes(CONN_SHORTFALL) && s3?.counts.connectionsDocs === 3 && s3?.counts.connectionsUnparsed === 1 && s3?.counts.connectionsRegistry === 2,
    { counts: s3?.counts, csv: csv3.slice(0, 300) }
  );
  check(
    "e2e F-388: the parseable docs still resolve in the same run — the flat connection matched, with its job row (a shortfall is reported, never fatal)",
    s3?.counts.connectionsMatched === 1 && s3?.counts.jobsMatched === 1,
    s3?.counts
  );
  check(
    "e2e F-388/F-349: the External Action lane reports its own partial shortfall from the same table (1 of 2, with the remedy)",
    md3.includes("1 of 2 rules-engine-external-actions doc(s) parsed to no External Action") && /Re-capture the rules-engine-external-actions domain/.test(md3) &&
      s3?.counts.externalActionsDocs === 2 && s3?.counts.externalActionsUnparsed === 1,
    md3.match(/.*external-actions doc\(s\).*/)?.[0]?.slice(0, 300)
  );
}

// ── e2e F-345: a labelled designer source object matches BOTH term spellings ──
// The compound "_object" display value must match a term spelled as the system
// name AND one spelled as the label. Negative pin (the tester's point): the yield
// column stays healthy either way — it is NOT the instrument for a mis-parsed
// value, so the assertion is on the match, not on the caveat.
// One --object run → { summary, report markdown } (shared by the F-345 and
// DS-45 arms below; the report dir keeps each arm's output apart).
const runObj = (term, dir) => {
  const r = spawnSync(process.execPath, [SCRIPT, "--kb", KB, "--object", term, "--report", join(ROOT, dir)], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`tenant-deps --object ${term} exited ${r.status}: ${r.stderr}`);
  const s = JSON.parse(r.stdout);
  return { s, md: readFileSync(s.reportPath, "utf8") };
};
{
  for (const [term, how] of [["accountrec__gc", "system name"], ["Account Record", "label"]]) {
    const { s, md } = runObj(term, "rep-f345");
    check(
      `e2e F-345: --object spelled as the ${how} matches the labelled designer task (compound _object split)`,
      s.counts.designersMatched === 1 && /\| Acme Company Health[^|]*\|.*\| source object \| accountrec__gc \("Account Record"\) \|/.test(md),
      md.match(/\| Acme Company Health \|.*/)?.[0]?.slice(0, 240) ?? s.counts
    );
    check(
      `e2e F-345 (negative pin, ${how}): the yield column and caveat are NOT what catches this — 3/3 yielding, no caveat`,
      s.counts.designersYielding === 3 && !md.includes("yielded ZERO usage rows"),
      s.counts
    );
  }
}

// ── e2e DS-45: a LABEL-ONLY designer source object ───────────────────────────
// The live-summary doc's pivot task carries `_object: "Sponsor Tracking"` — a
// label with no system name behind it. A term spelled as the label matches,
// and the row's object cell shows the dash where the name would be: that is
// the report saying no system name is on record. A term spelled as a system
// name cannot match this row — there is none to match — and the run says so
// by matching nothing (the identifier column never carries the display value).
{
  {
    const { s, md } = runObj("Acme Sponsor Tracking", "rep-ds45");
    check(
      "e2e DS-45: --object spelled as the label matches the label-only task; its object cell reads — (\"Acme Sponsor Tracking\") — no system name on record",
      s.counts.designersMatched === 1 && /\| Acme Company Health[^|]*\|.*\| source object \| — \("Acme Sponsor Tracking"\) \|/.test(md),
      md.match(/\| Acme Company Health \|.*/)?.[0]?.slice(0, 240) ?? s.counts
    );
  }
  {
    const { s, md } = runObj("acme_sponsor_tracking__gc", "rep-ds45");
    check(
      "e2e DS-45: --object spelled as a system name does NOT match the label-only task — the summary shape carries no system name for it, so no spelling of one can",
      s.counts.designersMatched === 0 && !/Sponsor Tracking/.test(md),
      s.counts
    );
  }
}

// ── e2e: --alias-prefix (ER-22 acceptance shape, offline) ────────────────────
// The unprefixed term finds ZERO rules exact-only, and exactly the aliased
// rule with the flag — the offline mirror of the live Test 6 baseline
// (0-of-N without aliasing → the aliased dependents with it).

{
  const bare = spawnSync(
    process.execPath,
    [SCRIPT, "--kb", KB, "--field", "Renewal Amount", "--report", REPORT_DIR],
    { encoding: "utf8" }
  );
  const bareSummary = JSON.parse(bare.stdout);
  const bareMd = readFileSync(bareSummary.reportPath, "utf8");
  check(
    "e2e alias: exact-only run misses the aliased rule (0 matched) but says so — EXACT-ONLY caveat + honest not-in-force header note (F-307)",
    bare.status === 0 && bareSummary.counts.rulesMatched === 0 && bareSummary.aliasPrefix === null &&
      bareMd.includes("Field matching ran EXACT-ONLY") && bareMd.includes("field aliasing not in force"),
    bareSummary.counts
  );

  const aliased = spawnSync(
    process.execPath,
    [SCRIPT, "--kb", KB, "--field", "Renewal Amount", "--alias-prefix", "^[A-Z]_", "--report", REPORT_DIR, "--csv-dir", join(ROOT, "csv-alias")],
    { encoding: "utf8" }
  );
  const aSummary = JSON.parse(aliased.stdout);
  const aMd = readFileSync(aSummary.reportPath, "utf8");
  check(
    "e2e alias: --alias-prefix finds the aliased rule — exactly one asset, one row (traps unmatched)",
    aliased.status === 0 && aSummary.counts.rulesMatched === 1 && aSummary.counts.rulesRows === 1 && aSummary.aliasPrefix === "^[A-Z]_",
    aSummary.counts
  );
  check(
    "e2e alias: match column prints the full prefixed candidate; header names the pattern and credits the FLAG, not the conventions (F-308)",
    aMd.includes("task-alias `A_Renewal Amount`") &&
      aMd.includes("task-alias prefix stripping (`^[A-Z]_`, from the explicit `--alias-prefix` flag)") &&
      !aMd.includes("from the tenant conventions") &&
      aMd.includes("space↔underscore separator equivalence"),
    aMd.split("\n").filter((l) => l.includes("task-alias")).slice(0, 3)
  );
  check(
    "e2e alias: near-miss caveat lists the word-sharing traps, never counted",
    aMd.includes("Possible related fields (NOT counted) for `Renewal Amount`") &&
      aMd.includes("Renewal Amount Total") && aMd.includes("AB_Renewal Amount") &&
      aSummary.counts.nearMissFields >= 2,
    aMd.slice(aMd.indexOf("Possible related"), aMd.indexOf("Possible related") + 300)
  );
  check(
    "e2e alias: rules CSV matched column carries the mechanism + candidate",
    readFileSync(join(ROOT, "csv-alias", "tenant-deps-rules.csv"), "utf8").includes("field:Renewal Amount (task-alias `A_Renewal Amount`)"),
    null
  );
  check(
    "e2e alias: aliasMatchedRows counted in the summary (JO-mode symmetry)",
    aSummary.counts.aliasMatchedRows === 1,
    aSummary.counts
  );

  // gating: a near-miss on a row that ALSO matched an --object term must
  // still be listed (the near-miss gate is field-match absence, never
  // any-match absence) — the write-target row matches object
  // 'renewal_summary' and its field name is a near-miss of the term
  const mixed = spawnSync(
    process.execPath,
    [SCRIPT, "--kb", KB, "--object", "renewal_summary", "--field", "Renewal Amount", "--alias-prefix", "^[A-Z]_", "--report", REPORT_DIR],
    { encoding: "utf8" }
  );
  const mixedMd = readFileSync(JSON.parse(mixed.stdout).reportPath, "utf8");
  check(
    "e2e alias: near-miss survives on an object-matched row (gate is field-match absence)",
    mixed.status === 0 && mixedMd.includes("Possible related fields (NOT counted) for `Renewal Amount`") &&
      mixedMd.includes("Active_Renewal_Amount__gc"),
    mixedMd.slice(mixedMd.indexOf("Possible related"), mixedMd.indexOf("Possible related") + 250)
  );
  const badRe = spawnSync(
    process.execPath,
    [SCRIPT, "--kb", KB, "--field", "x", "--alias-prefix", "([", "--report", REPORT_DIR],
    { encoding: "utf8" }
  );
  check("e2e alias: invalid --alias-prefix regex exits 1", badRe.status === 1 && /not a valid regular expression/.test(badRe.stderr), badRe.stderr?.slice(0, 200));
}

// ── e2e: conventions self-read (GP-B5 DS-27) ─────────────────────────────────
// The script reads .gs-superadmin/CONVENTIONS.md itself (walking up from
// --kb): declared → aliasing on with NO flag; malformed → exact-only + loud
// caveat (withheld, never guessed); an explicit --alias-prefix overrides the
// declared pattern.
{
  const WS = join(ROOT, "conv-ws");
  const KBC = join(WS, "acme-conv");
  mkdirSync(join(WS, ".gs-superadmin"), { recursive: true });
  const CONV = join(WS, ".gs-superadmin", "CONVENTIONS.md");
  const docC = (domain, base, name, payload) => {
    mkdirSync(join(KBC, domain), { recursive: true });
    writeFileSync(
      join(KBC, domain, `${base}.md`),
      `# ${name}\n\n- key: ${domain}/${base}\n- id: ${base}\n- name: ${name}\n\n\`\`\`json\n${JSON.stringify(payload, null, 1)}\n\`\`\`\n`,
      "utf8"
    );
  };
  docC("rules-engine", "rule-alias-1", "Acme|DATA| Renewal Amount v2", RULE_ALIAS);
  // The heading carries the real-workspace trailing suffix (F-305): earlier
  // rounds of these skills provisioned it this way, so the e2e path is locked
  // against re-anchoring the heading match to end-of-line.
  const CONV_SECTION = (bullet) =>
    `# Build Standards\n\n## Field aliasing (machine-readable — read by the deps skills)\n\n_intro prose_\n\n${bullet}\n\n_Example value (delete this line once the bullet above is filled in): \`^[A-Z]_\`._\n`;
  const runConv = (...extra) =>
    spawnSync(process.execPath, [SCRIPT, "--kb", KBC, "--field", "Renewal Amount", "--report", join(WS, "reports"), ...extra], { encoding: "utf8" });

  writeFileSync(CONV, CONV_SECTION("- task-alias-prefix-regex: `^[A-Z]_`"), "utf8");
  const conv = runConv();
  const convSummary = JSON.parse(conv.stdout);
  const convMd = readFileSync(convSummary.reportPath, "utf8");
  check(
    "e2e conventions: declared pattern read by the SCRIPT — aliased rule found with no --alias-prefix, header names the pattern",
    conv.status === 0 && convSummary.counts.rulesMatched === 1 && convSummary.aliasPrefix === "^[A-Z]_" &&
      convMd.includes("task-alias prefix stripping (`^[A-Z]_`, from the tenant conventions)"),
    convSummary
  );
  check(
    "e2e conventions: re-run footer stays argv-faithful (no --alias-prefix injected for a conventions-supplied pattern)",
    !convMd.slice(convMd.indexOf("Re-run")).includes("--alias-prefix"),
    convMd.slice(convMd.indexOf("Re-run"), convMd.indexOf("Re-run") + 300)
  );

  const overridden = runConv("--alias-prefix", "^Z_");
  const oSummary = JSON.parse(overridden.stdout);
  check(
    "e2e conventions: explicit --alias-prefix OVERRIDES the declared convention (Z_ strips nothing here → 0 matched)",
    overridden.status === 0 && oSummary.counts.rulesMatched === 0 && oSummary.aliasPrefix === "^Z_",
    oSummary
  );
  check(
    "e2e conventions: the override run's Summary line credits the FLAG — never the losing declared source (F-308)",
    (() => {
      const oMd = readFileSync(oSummary.reportPath, "utf8");
      return oMd.includes("(`^Z_`, from the explicit `--alias-prefix` flag)") && !oMd.includes("from the tenant conventions");
    })(),
    oSummary.reportPath
  );

  // review round: the blank explicit is the exact-only OPT-OUT — the declared
  // convention must NOT activate, and the caveat names the override
  const optOut = runConv("--alias-prefix", "");
  const ooS = JSON.parse(optOut.stdout);
  const ooMd = readFileSync(ooS.reportPath, "utf8");
  check(
    "e2e conventions: --alias-prefix '' opts out — declared convention not applied, caveat names the override",
    optOut.status === 0 && ooS.counts.rulesMatched === 0 && ooS.aliasPrefix === null &&
      ooMd.includes("disabled by an empty --alias-prefix override"),
    ooS
  );
  check(
    "e2e conventions: opted-out Summary terms line never claims nothing was declared (F-307)",
    ooMd.split("\n").some((l) => l.startsWith("- terms:") && l.includes("disabled by an empty --alias-prefix override")) &&
      !ooMd.includes("no field-aliasing convention supplied"),
    ooMd.split("\n").find((l) => l.startsWith("- terms:"))
  );

  writeFileSync(CONV, CONV_SECTION("- task-alias-prefix-regex: ^[A-Z]_"), "utf8");
  const malformed = runConv();
  const mSummary = JSON.parse(malformed.stdout);
  const mMd = readFileSync(mSummary.reportPath, "utf8");
  check(
    "e2e conventions: MALFORMED bullet → withheld (exact-only, 0 matched), warning + ONE coherent caveat naming the malformation — never guessed",
    malformed.status === 0 && mSummary.counts.rulesMatched === 0 && mSummary.aliasPrefix === null &&
      mSummary.warnings.some((w) => /MALFORMED/.test(w)) && mMd.includes("MALFORMED") &&
      /field matching ran EXACT-ONLY/i.test(mMd),
    { warnings: mSummary.warnings, counts: mSummary.counts }
  );
  check(
    "e2e conventions: malformed-declaration Summary terms line says MALFORMED, never 'no convention supplied' (F-307)",
    mMd.split("\n").some((l) => l.startsWith("- terms:") && l.includes("MALFORMED")) &&
      !mMd.includes("no field-aliasing convention supplied"),
    mMd.split("\n").find((l) => l.startsWith("- terms:"))
  );

  writeFileSync(CONV, CONV_SECTION("- task-alias-prefix-regex: "), "utf8");
  const unset = runConv();
  const uSummary = JSON.parse(unset.stdout);
  check(
    "e2e conventions: template-shape empty bullet → exact-only with the no-convention caveat (the italic example line is never read)",
    unset.status === 0 && uSummary.counts.rulesMatched === 0 && uSummary.aliasPrefix === null &&
      readFileSync(uSummary.reportPath, "utf8").includes("Field matching ran EXACT-ONLY"),
    uSummary.counts
  );
}

// ── e2e: --terms-file intake (GP-B5 DS-28; F-162 lineage) ────────────────────
// The skill's on-disk work list: file terms must reproduce the inline-flag
// run, merge with inline flags, tolerate a BOM — and every malformed shape
// must refuse the WHOLE file loudly (a typo'd kind silently dropped would be
// a confidently narrower report).
{
  const TDIR = join(ROOT, "terms-files");
  mkdirSync(TDIR, { recursive: true });
  const tf = (name, content) => {
    const p = join(TDIR, name);
    writeFileSync(p, content, "utf8");
    return p;
  };
  const runTd = (...args) =>
    spawnSync(process.execPath, [SCRIPT, "--kb", KB, ...args, "--report", REPORT_DIR], { encoding: "utf8" });

  const viaFile = runTd("--terms-file", tf("terms.json", JSON.stringify({ objects: ["renewal_summary"], fields: ["Renewal Amount"] })), "--alias-prefix", "^[A-Z]_");
  const viaFlags = runTd("--object", "renewal_summary", "--field", "Renewal Amount", "--alias-prefix", "^[A-Z]_");
  const fS = JSON.parse(viaFile.stdout);
  const gS = JSON.parse(viaFlags.stdout);
  check(
    "e2e terms-file: file-supplied terms reproduce the inline-flag run's counts",
    viaFile.status === 0 && JSON.stringify(fS.counts) === JSON.stringify(gS.counts) && fS.counts.rulesMatched >= 1,
    { file: fS.counts, flags: gS.counts }
  );

  const merged = runTd("--terms-file", tf("merge.json", JSON.stringify({ fields: ["Renewal Amount"] })), "--field", "Renewal Amount", "--object", "renewal_summary", "--alias-prefix", "^[A-Z]_");
  const mS = JSON.parse(merged.stdout);
  check(
    "e2e terms-file: file terms MERGE with inline flags; overlaps dedupe with the warning",
    merged.status === 0 && JSON.stringify(mS.counts) === JSON.stringify(gS.counts) && mS.warnings.some((w) => /duplicate term/.test(w)),
    mS.warnings
  );

  const bommed = runTd("--terms-file", tf("bom.json", String.fromCharCode(0xfeff) + JSON.stringify({ fields: ["Renewal Amount"] })));
  check("e2e terms-file: BOM'd file (PS 5.1 Out-File) parses (T-7 read boundary)", bommed.status === 0, bommed.stderr?.slice(0, 200));

  // F-306: every refusal on this surface names the script the operator
  // invoked — never jo-report.mjs, whose shared `fail` these diagnostics
  // used to borrow. The prefix assertion rides the shared helper so every
  // present and future refusal case inherits it.
  const refuse = (label, res, re) =>
    check(
      `e2e terms-file: ${label}`,
      res.status === 1 && re.test(res.stderr) &&
        res.stderr.startsWith("tenant-deps.mjs: ") && !res.stderr.includes("jo-report.mjs:"),
      res.stderr?.slice(0, 250)
    );
  refuse("EMPTY file refused loudly (never an empty scan)", runTd("--terms-file", tf("empty.json", "")), /cannot parse/);
  refuse("missing file refused loudly", runTd("--terms-file", join(TDIR, "nope.json")), /cannot parse/);
  refuse('unknown key (singular "connection" typo) refuses the WHOLE file', runTd("--terms-file", tf("badkey.json", JSON.stringify({ connection: ["X"] }))), /unknown key "connection".*allowed keys/);
  refuse("non-array kind value refused", runTd("--terms-file", tf("notarray.json", JSON.stringify({ fields: "Renewal Amount" }))), /JSON array of term strings/);
  refuse("non-object top level refused", runTd("--terms-file", tf("notobject.json", JSON.stringify(["a", "b"]))), /JSON object/);
  refuse("blank term from the file refused (non-empty rule covers the file lane)", runTd("--terms-file", tf("blank.json", JSON.stringify({ fields: [" "] }))), /non-empty/);
  refuse("empty object → still the at-least-one-term usage rule", runTd("--terms-file", tf("zero.json", JSON.stringify({}))), /usage:/);
}

// usage errors
const noTerms = spawnSync(process.execPath, [SCRIPT, "--kb", KB, "--report", REPORT_DIR], { encoding: "utf8" });
check(
  "e2e: no terms → exit 1 + usage naming THIS script, not jo-report.mjs (F-306)",
  noTerms.status === 1 && noTerms.stderr.includes("usage:") &&
    noTerms.stderr.startsWith("tenant-deps.mjs: ") && !noTerms.stderr.includes("jo-report.mjs:"),
  noTerms.stderr?.slice(0, 200)
);
const emptyTerm = spawnSync(process.execPath, [SCRIPT, "--kb", KB, "--object", "  ", "--report", REPORT_DIR], { encoding: "utf8" });
check("e2e: blank term → exit 1", emptyTerm.status === 1, emptyTerm.stderr?.slice(0, 200));

// F-310: a --kb that does not exist REFUSES before any work. This surface
// used to accept it — exit 0, ok:true, 0/0 scanned in every domain, and a
// WRITTEN report asserting nothing depends on the terms, with no caveat
// naming the cause: for an impact-analysis tool, a mistyped slug was
// indistinguishable from a genuine no-dependents answer. The refusal runs
// doc-lib's requireKbDir — the same one copy jo-report deps mode runs — and
// names this script (F-306).
{
  const badKbReport = join(ROOT, "f310-report-never-written");
  const badKb = spawnSync(
    process.execPath,
    [SCRIPT, "--kb", join(ROOT, "no-such-kb"), "--field", "Renewal Amount", "--report", badKbReport],
    { encoding: "utf8" }
  );
  check(
    "e2e: nonexistent --kb → exit 1, names the flag and path, prefixed by THIS script (F-310)",
    badKb.status === 1 && /--kb .*no-such-kb: directory not found/.test(badKb.stderr) &&
      badKb.stderr.startsWith("tenant-deps.mjs: ") && !badKb.stderr.includes("jo-report.mjs:"),
    badKb.stderr?.slice(0, 250)
  );
  check(
    "e2e: nonexistent --kb writes NOTHING — no report dir, no summary JSON on stdout (F-310)",
    !existsSync(badKbReport) && badKb.stdout === "",
    { dirExists: existsSync(badKbReport), stdout: badKb.stdout?.slice(0, 120) }
  );
}

// F-311: the --live-deps intake contract on THIS surface — the loop lived as
// a hand-copied twin of jo-report-deps's and is now the one shared
// readLiveDepsCaptures. The warn-and-skip arms were previously locked only
// on the sibling suite: a bad file warns and is SKIPPED (run still exits 0,
// report still written — never a hard failure), an unreadable path warns,
// and a non-COMPLETED capture for an un-requested object warns twice (async
// honesty + object mismatch) while still counting as a capture.
{
  const badFile = join(ROOT, "live-deps-unparseable.json");
  writeFileSync(badFile, "{ nope", "utf8");
  const initOther = join(ROOT, "live-deps-init-other.json");
  writeFileSync(
    initOther,
    JSON.stringify({ result: true, data: { objectName: "widget", progressStatus: { overallStatus: "INIT" }, dependents: { RULE: [] } } }),
    "utf8"
  );
  const warnRun = spawnSync(
    process.execPath,
    [
      SCRIPT, "--kb", KB, "--object", "Company",
      "--live-deps", badFile,
      "--live-deps", join(ROOT, "live-deps-absent.json"),
      "--live-deps", initOther,
      "--report", join(ROOT, "reports-live-warn"),
    ],
    { encoding: "utf8" }
  );
  const wS = warnRun.status === 0 ? JSON.parse(warnRun.stdout) : null;
  check(
    "e2e live-deps intake: bad/absent/incomplete-mismatched captures WARN and are skipped or flagged — exit 0, report written (F-311)",
    warnRun.status === 0 && wS?.ok === true && existsSync(wS.reportPath) &&
      wS.warnings.some((w) => /live-deps-unparseable\.json: not a recognizable/.test(w)) &&
      wS.warnings.some((w) => /live-deps-absent\.json: unreadable/.test(w)) &&
      wS.warnings.some((w) => /live-deps-init-other\.json: progressStatus is not COMPLETED/.test(w)) &&
      wS.warnings.some((w) => /live-deps-init-other\.json: payload is for object 'widget', which is not among the --object terms/.test(w)),
    wS?.warnings ?? warnRun.stderr?.slice(0, 300)
  );
  check(
    "e2e live-deps intake: only the parseable capture is counted (skips are real skips) (F-311)",
    wS?.counts?.liveCaptures === 1,
    wS?.counts?.liveCaptures
  );
}

// ── wave-2 portability: quote caveat + junction-tolerant CLI entry ───────────
{
  // F-123: an apostrophe-bearing term makes the emitted hints carry the bash
  // escape and pushes the one PowerShell-conversion caveat; the earlier clean
  // runs above must not have carried it (checked on the main e2e report).
  const apoDir = join(ROOT, "reports-apo");
  const apo = spawnSync(process.execPath, [SCRIPT, "--kb", KB, "--object", "O'Brien Co", "--report", apoDir], { encoding: "utf8" });
  const apoSummary = JSON.parse(apo.stdout);
  const apoMd = readFileSync(apoSummary.reportPath, "utf8");
  check("caveat: apostrophe term pins the bash escape + caveat (F-123)", apo.status === 0 && apoMd.includes("'O'\\''Brien Co'") && apoMd.includes("bash apostrophe escape"), apoMd.split("\n").filter((l) => l.includes("apostrophe")).join(" | "));
  const cleanMd = readFileSync(JSON.parse(res.stdout).reportPath, "utf8");
  check("caveat: absent for cleanly-quoted runs (F-123)", !cleanMd.includes("bash apostrophe escape"), null);
}
{
  // F-117: invoked through a junction/symlink the CLI entry must still run
  // (usage failure), never exit 0 silently. "junction" works unprivileged on
  // Windows; on POSIX the type argument is ignored.
  const linkDir = join(ROOT, "scripts-link");
  let linked = true;
  // F-137: only errors that mean "this environment cannot create links" may
  // downgrade to the skipped-PASS branch; anything else is a coding error.
  try { symlinkSync(dirname(SCRIPT), linkDir, "junction"); }
  catch (e) { if (["EPERM", "EACCES", "ENOSYS"].includes(e?.code)) linked = false; else throw e; }
  if (linked) {
    const viaLink = spawnSync(process.execPath, [join(linkDir, "tenant-deps.mjs")], { encoding: "utf8" });
    check("cli-entry: junction invocation still runs main (usage, exit 1) (F-117)", viaLink.status === 1 && /usage/.test(viaLink.stderr), { status: viaLink.status, stderr: viaLink.stderr?.slice(0, 120) });
  } else {
    check("cli-entry: junction invocation still runs main (F-117) [link creation unavailable — skipped]", true, null);
  }
}

// ── W9 (GP-B5 B13): the designer COMPOSITE — drilldown-derived field rows ────
// Key sets authored from the routed handler at CLI 1.0.8 and confirmed live
// 2026-09-02 (extract + join + freeForm; the `--field` detail's row keys; the
// "(MAX)" aggregation suffix; duplicate labels on one task). Fictional values.
{
  const out = extractDesignerUsages(DESIGNER_COMPOSITE);
  const by = (usage, pred) => out.rows.filter((r) => r.usage === usage && (!pred || pred(r)));
  const arr = by("show field", (r) => r.fieldName === "Arr__gc" && /t1|Companies/.test(r.detail) && r.detail.includes("show field"));
  check(
    "W9 composite: an aggregated show field row carries the system name, the label, the suffixed spelling as an alias, the field's own source object and connection",
    arr.length === 1 && arr[0].fieldLabel === "ARR" && arr[0].altFields.includes("ARR (MAX)") && arr[0].objectName === "company" && arr[0].objectLabel === "Company" && arr[0].connection?.type === "MDA" && !arr[0].fieldNamesUnavailable,
    arr
  );
  const names = by("show field", (r) => r.fieldLabel === "Name");
  check(
    "W9 composite: duplicate label — the FIRST row gets the detail (system name), the SECOND stays label-only with reason duplicate-label (never the first field's name) but carries the TASK's object like every label-only row",
    names.length === 2 && names[0].fieldName === "Name" && !names[0].fieldNamesUnavailable && names[1].fieldName === null && names[1].fieldNamesUnavailable === true && names[1].fieldNamesReason === "duplicate-label" && names[1].objectName === "company" && names[1].objectLabel === "Company",
    names
  );
  const extra = by("show field", (r) => r.fieldLabel === "Extra");
  check(
    "W9 composite: a field the CLI refused under every spelling is label-only with reason field-unresolvable naming the refusal (a recorded gap, distinct from a retryable failure)",
    extra.length === 1 && extra[0].fieldName === null && extra[0].fieldNamesReason === "field-unresolvable" && /field unresolvable by the CLI: exit 1: No field found/.test(extra[0].detail),
    extra
  );
  const score = by("show field", (r) => r.fieldLabel === "Score");
  check(
    "W9 composite: a detail on file WITHOUT a Field Name row (calculated field) is blind with reason no-system-name — never 'detail missing'",
    score.length === 1 && score[0].fieldName === null && score[0].fieldNamesReason === "no-system-name" && /detail on file, no Field Name row/.test(score[0].detail) && score[0].altFields.length === 0,
    score
  );
  const fieldList = by("field list");
  check(
    "W9 composite: a join task whose Fields row did not parse emits its own 'field list' row with reason unparsed-field-list (a derived task has no source-object row to carry it)",
    fieldList.length === 1 && fieldList[0].fieldNamesReason === "unparsed-field-list" && /Bad Join/.test(fieldList[0].detail) && /0 qualifying split/.test(fieldList[0].detail),
    fieldList
  );
  const stageConn = by("show field", (r) => r.fieldName === "LifecycleStage__gc");
  check(
    "W9 composite: a field whose Connection row differs from the task's type carries its own connection; one equal to the task's type keeps the task's connection object",
    stageConn.length === 1 && stageConn[0].connection?.type === "SFDC" && stageConn[0].connection?.id === null && arr[0].connection === by("source object", (r) => /Companies/.test(r.detail))[0].connection,
    stageConn
  );
  check(
    "W9 closure: every blind reason emitted by the composite fixture is a key of DESIGNER_BLIND_REASONS, and EVERY key is exercised by at least one row (each reason has a fixture)",
    (() => {
      const emitted = new Set([...out.rows, ...extractDesignerUsages(DESIGNER_LIVE_SUMMARY).rows].filter((r) => r.fieldNamesUnavailable).map((r) => r.fieldNamesReason));
      const keys = Object.keys(DESIGNER_BLIND_REASONS);
      return [...emitted].every((k) => keys.includes(k)) && keys.every((k) => emitted.has(k)) && keys.every((k) => typeof DESIGNER_BLIND_REASONS[k].caveat === "string" && typeof DESIGNER_BLIND_REASONS[k].note === "function");
    })(),
    { emitted: [...new Set(out.rows.filter((r) => r.fieldNamesUnavailable).map((r) => r.fieldNamesReason))], keys: Object.keys(DESIGNER_BLIND_REASONS) }
  );
  const stage = by("show field", (r) => r.fieldLabel === "Lifecycle Stage" && r.detail.includes("Companies"));
  check(
    "W9 composite: a field whose detail FAILED stays label-only with the failure named and reason field-detail-missing",
    stage.length === 1 && stage[0].fieldName === null && stage[0].fieldNamesUnavailable === true && stage[0].fieldNamesReason === "field-detail-missing" && /field detail failed: exit 1: no field/.test(stage[0].detail),
    stage
  );
  const bareName = by("show field", (r) => r.fieldName === "Name" && r.detail.includes("Companies"));
  check(
    "W9 composite: a bare Source Object equal to the task's system object is filed as that name (with the task's label), not as a label",
    bareName.length === 1 && bareName[0].objectName === "company" && bareName[0].objectLabel === "Company",
    bareName
  );
  const stageJoin = by("show field", (r) => r.fieldName === "LifecycleStage__gc");
  check(
    "W9 composite: join-task field rows come from the `Fields (src)` detail rows; a bare Source Object NOT equal to the task's object is filed as a LABEL; the differing alias is an altFields candidate",
    stageJoin.length === 1 && stageJoin[0].objectName === null && stageJoin[0].objectLabel === "Account Record" && stageJoin[0].altFields.includes("Stage") && stageJoin[0].detail.includes("join field"),
    stageJoin
  );
  const filters = by("filter");
  check(
    "W9 composite: criteria rows resolve their label through the task's field details (system name on the resolved side; a FIELD-typed rhs is a second row; label-only sides carry the label-only-carrier reason)",
    filters.some((r) => r.fieldLabel === "ARR" && r.fieldName === "Arr__gc" && /GREATER_THAN, alias A/.test(r.detail)) &&
      filters.some((r) => r.fieldLabel === "Lifecycle Stage" && r.fieldName === "LifecycleStage__gc" && /Merge/.test(r.detail)) &&
      filters.some((r) => r.fieldLabel === "Email" && r.fieldName === "Email"),
    filters
  );
  const joins = by("join condition", (r) => /Merge/.test(r.detail));
  check(
    "W9 composite: join conditions yield one row per side, split at the last dot (object label + field), whole spelling as an alias; unresolved sides are label-only-carrier",
    joins.length === 2 && joins[0].objectLabel === "Companies" && joins[0].fieldLabel === "Gsid" && joins[0].altFields.includes("Companies.Gsid") && joins[0].fieldNamesReason === "label-only-carrier" && joins[1].fieldLabel === "CompanyId__gc",
    joins
  );
  const src = by("source object");
  check(
    "W9 composite: source-object rows — t1 NOT blind (named field rows exist); t2 blind with reason task-drilldown-missing naming the failure; t3/t4 emit none (derived, no object)",
    src.length === 2 && src.some((r) => /Companies/.test(r.detail) && !r.fieldNamesUnavailable) &&
      src.some((r) => /Users/.test(r.detail) && r.fieldNamesUnavailable === true && r.fieldNamesReason === "task-drilldown-missing" && /task drilldown failed: exit 1: boom/.test(r.detail)),
    src
  );
  check(
    "W9 composite (control): the same body WITHOUT _kb reads as a summary-only doc — every task row field-blind with reason summary-shape, no drilldown rows",
    (() => { const p = JSON.parse(JSON.stringify(DESIGNER_COMPOSITE)); delete p.data._kb; const o = extractDesignerUsages(p); return o.rows.every((r) => r.usage === "source object") && o.rows.every((r) => r.fieldNamesUnavailable === true && r.fieldNamesReason === "summary-shape"); })(),
    null
  );
  check(
    "W9 composite (control): a composite of another version is ignored like no composite",
    (() => { const p = JSON.parse(JSON.stringify(DESIGNER_COMPOSITE)); p.data._kb.version = 2; return extractDesignerUsages(p).rows.every((r) => r.usage === "source object"); })(),
    null
  );
  // Enumeration closure (Addendum 3): doc-lib's DESIGNER_TASK_TABLES (the
  // list as DATA) and its DesignerTaskDetail typedef both name exactly the
  // CLI's 14 tables — derived from emptyTaskFields at the pin and re-derived
  // at every adoption, never from the arms above.
  const TABLES_AT_PIN = ["_taskDetailRows", "_taskShowFields", "_taskFieldDetail", "_taskFieldFormula", "_taskFieldCase", "_taskJoinConditions", "_taskUnionMerged", "_taskUnionOther", "_taskS3Export", "_taskS3FieldOrder", "_taskCriteriaExpressionRows", "_taskCriteriaConditions", "_taskPivotColumns", "_taskPivotConditions"];
  const { DESIGNER_TASK_TABLES } = await import("../scripts/doc-lib.mjs");
  const docLibSrc = readFileSync(join(dirname(SCRIPT), "doc-lib.mjs"), "utf8");
  const declared = /@typedef \{object\} DesignerTaskDetail[\s\S]*?\*\//.exec(docLibSrc)?.[0] ?? "";
  const declaredKeys = [...declared.matchAll(/\[(_task[A-Za-z0-9]+)\]/g)].map((m) => m[1]);
  check(
    "W9 closure: DESIGNER_TASK_TABLES and the DesignerTaskDetail typedef (both in doc-lib) name exactly the 14 `_task*` tables the CLI projects (emptyTaskFields at pin 1.0.8)",
    isDeepStrictEqual([...DESIGNER_TASK_TABLES].sort(), [...TABLES_AT_PIN].sort()) && isDeepStrictEqual([...declaredKeys].sort(), [...TABLES_AT_PIN].sort()) && isDeepStrictEqual(Object.keys(T1).sort(), [...TABLES_AT_PIN].sort()),
    { DESIGNER_TASK_TABLES, declaredKeys }
  );

  // e2e on its own KB: a --field term spelled as the SYSTEM name matches the
  // composite (impossible before W9), the caveat breaks the blind rows down by
  // reason, and a label spelling still matches.
  const KB4 = join(ROOT, "acme-w9");
  for (const d of ["data-designer", "rules-engine", "report", "connectors", "connectors-jobs", "scorecard", "journey", "journey-data-designer", "rules-engine-external-actions"]) mkdirSync(join(KB4, d), { recursive: true });
  writeFileSync(join(KB4, "_manifest.json"), JSON.stringify({ slug: "acme-w9", baseUrl: "https://acme--w9.gainsightcloud.com", inventory: {} }));
  writeFileSync(join(KB4, "data-designer", "dd-4.md"), `# Acme Composite Rollup\n\n> Full describe doc (designer doc-mode) — test fixture.\n\n- key: data-designer/dd-4\n- id: dd-4\n- name: Acme Composite Rollup\n\n\`\`\`json\n${JSON.stringify(DESIGNER_COMPOSITE, null, 1)}\n\`\`\`\n`);
  writeFileSync(join(KB4, "data-designer", "dd-2.md"), `# Acme Company Health\n\n- key: data-designer/dd-2\n- id: dd-2\n- name: Acme Company Health\n\n\`\`\`json\n${JSON.stringify(DESIGNER_LIVE_SUMMARY, null, 1)}\n\`\`\`\n`);
  const runW9 = (args, dir) => {
    const r = spawnSync(process.execPath, [SCRIPT, "--kb", KB4, ...args, "--report", join(ROOT, dir)], { encoding: "utf8" });
    let s = null; try { s = JSON.parse(r.stdout); } catch { /* usage path */ }
    const md4 = s?.reportPath && existsSync(s.reportPath) ? readFileSync(s.reportPath, "utf8") : "";
    return { code: r.status, s, md: md4, stderr: r.stderr };
  };
  const bySys = runW9(["--field", "Arr__gc"], "rep-w9-sys");
  check(
    "W9 e2e: a --field term spelled as the SYSTEM name matches the composite's drilled rows (show field + criteria, both tasks) and nothing in the summary-only doc",
    bySys.code === 0 && /\| Acme Composite Rollup \(dd-4\) \|.*\| show field \|.*\| Arr__gc \("ARR"\) \|/.test(bySys.md) && /\| filter \|.*\| Arr__gc \("ARR"\) \|/.test(bySys.md) && !/Acme Company Health/.test(bySys.md),
    bySys.md.match(/.*dd-4.*/g)?.slice(0, 4) ?? bySys.stderr
  );
  check(
    "W9 e2e: the blind-row caveat breaks the count down by reason (summary-shape rows from dd-2; the composite's task-drilldown-missing, duplicate-label, field-detail-missing, label-only carriers)",
    /Data designers: \d+ row\(s\) carry no system field name — .*from the CLI's summary task shape.*; .*from the task's --task-id drilldown is missing.*; .*from the field's --field detail is missing.*; .*from a duplicate label on the task.*; .*from the drilldown table carries a display label/.test(bySys.md),
    bySys.md.match(/.*carry no system field name.*/)?.[0]?.slice(0, 400)
  );
  const byLabel = runW9(["--field", "Lifecycle Stage"], "rep-w9-label");
  check(
    "W9 e2e: a LABEL spelling matches the failed-detail row (label-only) AND the join-resolved row (system name), each with its own field cell",
    byLabel.code === 0 && /\| — \("Lifecycle Stage"\) \|/.test(byLabel.md) && /\| LifecycleStage__gc \("Lifecycle Stage"\) \|/.test(byLabel.md),
    byLabel.md.match(/.*Lifecycle Stage.*/g)?.slice(0, 4)
  );
  const byObj = runW9(["--object", "gsuser"], "rep-w9-obj");
  check(
    "W9 e2e: --object still matches the drilldown-less task's source-object row (t2, blind with the failure named) and the per-field source object of a field on another task (Email → gsuser)",
    byObj.code === 0 && /\| source object \| gsuser \|.*task drilldown failed/.test(byObj.md) && /\| show field \| gsuser \("User"\) \| Email \|/.test(byObj.md),
    byObj.md.match(/.*gsuser.*/g)?.slice(0, 4)
  );
}

// ── F-429: KB folders resolve from the manifest's recordings, not from default
// names. A workspace that recorded `connections` / `report-reports` /
// `connector-jobs` (the DS-32 spellings) used to read 0 docs in all three lanes
// with no caveat, because the lookup was DOMAINS' literal names. The negative
// half is every fixture above: no domains_indexed → defaults, unchanged.
{
  const KB5 = join(ROOT, "acme-renamed");
  const doc5 = (domain, base, name, payload) => {
    mkdirSync(join(KB5, domain), { recursive: true });
    writeFileSync(
      join(KB5, domain, `${base}.md`),
      `# ${name}\n\n- key: ${domain}/${base}\n- id: ${base}\n- name: ${name}\n\n\`\`\`json\n${JSON.stringify(payload, null, 1)}\n\`\`\`\n`,
      "utf8"
    );
  };
  doc5("connections", "conn-snow-r", "Acme Snowflake", CONN_SNOW);
  doc5("report-reports", "rep-r", "Acme ARR by CSM", REPORT_MDA);
  doc5("connector-jobs", "job-r", "Acme S3 Usage Load", JOB_S3);
  const stamp = (idField, listCommand) => ({ at: "2026-01-01T00:00:00.000Z", idField, itemsPath: null, describeCommand: null, listCommand });
  writeFileSync(
    join(KB5, "_manifest.json"),
    JSON.stringify({
      slug: "acme-renamed",
      baseUrl: "https://acme--renamed.gainsightcloud.com",
      inventory: {},
      domains_indexed: {
        connections: stamp("connectionId", "gs-admin --json cn list"),
        "report-reports": stamp("reportId", "gs-admin --json rp list"),
        "connector-jobs": stamp("jobId", "gs-admin --json cn jobs"),
      },
    })
  );
  const r5 = spawnSync(process.execPath, [SCRIPT, "--kb", KB5, "--connection", "Snowflake", "--report", join(ROOT, "rep-f429")], { encoding: "utf8" });
  let s5 = null;
  try { s5 = JSON.parse(r5.stdout); } catch { /* usage path */ }
  check(
    "F-429: the three renamed lanes are READ (connections, reports, jobs each see their doc) — resolved from domains_indexed's recorded list commands, alias spellings (`rp list`) included",
    r5.status === 0 && s5?.counts?.connectionsDocs === 1 && s5?.counts?.reportsScanned === 1 && s5?.counts?.jobsScanned === 1,
    s5 ? JSON.stringify({ counts: s5.counts, dirs: s5.domainDirs }).slice(0, 400) : r5.stderr.slice(0, 300)
  );
  check(
    "F-429: the JSON says which folder each lane read and why — recorded lanes carry `manifest recording`, unrecorded ones `default (no recording)`",
    s5?.domainDirs?.connections === "connections" && s5?.domainDirs?.reports === "report-reports" && s5?.domainDirs?.jobs === "connector-jobs" &&
      s5?.domainDirBasis?.connections === "manifest recording" && s5?.domainDirs?.rules === "rules-engine" && s5?.domainDirBasis?.rules === "default (no recording)",
    JSON.stringify({ dirs: s5?.domainDirs, basis: s5?.domainDirBasis })
  );
  check(
    "F-429: a lane resolved away from its default is named in the warnings",
    (s5?.warnings ?? []).some((w) => /resolved from the manifest's recordings, differing from the defaults: .*connections → connections \(default connectors\)/.test(w)),
    JSON.stringify(s5?.warnings)
  );
  // F-429 second pass (consumer-parity, the reopen reason): the resolver's
  // warnings reached the stdout summary ONLY — the markdown report a reader
  // opens and the caveats CSV the workbook is built from said nothing about a
  // lane read from a non-default folder. The property, not a list: EVERY
  // entry of the summary's `warnings` is in the markdown AND in
  // tenant-deps-caveats.csv, and caveatCount counts them.
  // The CSV cell is quoted, so an inner double quote is doubled (RFC 4180);
  // compare against the unescaped text, the same bytes a workbook shows.
  const parity = (summary, mdText, csvText) => (summary?.warnings ?? []).every((w) => mdText.includes(w) && csvText.replace(/""/g, '"').includes(w));
  const r5c = spawnSync(process.execPath, [SCRIPT, "--kb", KB5, "--connection", "Snowflake", "--report", join(ROOT, "rep-f429c"), "--csv-dir", join(ROOT, "csv-f429c")], { encoding: "utf8" });
  let s5c = null;
  try { s5c = JSON.parse(r5c.stdout); } catch { /* usage path */ }
  const md5c = s5c?.reportPath ? readFileSync(s5c.reportPath, "utf8") : "";
  const csv5c = existsSync(join(ROOT, "csv-f429c", "tenant-deps-caveats.csv")) ? readFileSync(join(ROOT, "csv-f429c", "tenant-deps-caveats.csv"), "utf8") : "";
  check(
    "F-429 parity: every summary warning (the folder-resolution line included) is in the markdown Caveats section AND in tenant-deps-caveats.csv, and caveatCount counts it",
    r5c.status === 0 && (s5c?.warnings?.length ?? 0) >= 1 && parity(s5c, md5c, csv5c) && s5c.caveatCount >= s5c.warnings.length && md5c.includes("## Caveats & data gaps"),
    { warnings: s5c?.warnings, caveatCount: s5c?.caveatCount, mdHas: (s5c?.warnings ?? []).map((w) => md5c.includes(w)), csvHas: (s5c?.warnings ?? []).map((w) => csv5c.includes(w)) }
  );
  // Ambiguity (the DS-32 shape — a probe registration beside the real domain,
  // both recording `cn list`): the resolver says so, reads the domain whose
  // folder holds docs (the probe sorts FIRST by name, so a sorted-first pick
  // would read the empty one), and the ambiguity line reaches all three
  // surfaces like any other warning.
  const m5 = JSON.parse(readFileSync(join(KB5, "_manifest.json"), "utf8"));
  m5.domains_indexed["aaa-conn-probe"] = stamp("connectionId", "gs-admin --json connectors list");
  writeFileSync(join(KB5, "_manifest.json"), JSON.stringify(m5));
  const r5d = spawnSync(process.execPath, [SCRIPT, "--kb", KB5, "--connection", "Snowflake", "--report", join(ROOT, "rep-f429d"), "--csv-dir", join(ROOT, "csv-f429d")], { encoding: "utf8" });
  let s5d = null;
  try { s5d = JSON.parse(r5d.stdout); } catch { /* usage path */ }
  const md5d = s5d?.reportPath ? readFileSync(s5d.reportPath, "utf8") : "";
  const csv5d = existsSync(join(ROOT, "csv-f429d", "tenant-deps-caveats.csv")) ? readFileSync(join(ROOT, "csv-f429d", "tenant-deps-caveats.csv"), "utf8") : "";
  check(
    "F-429 ambiguity: two domains recording cn list → basis 'ambiguous', the domain with docs on disk is read (not the probe that sorts first), and the ambiguity line names both, the pick and why",
    r5d.status === 0 && s5d?.domainDirs?.connections === "connections" && s5d?.domainDirBasis?.connections === "manifest recording (ambiguous)" && s5d?.counts?.connectionsDocs === 1 &&
      (s5d?.warnings ?? []).some((w) => /lane connections: 2 domains record "connectors list" \(aaa-conn-probe, connections\) — reading connections \(its folder holds 1 doc\(s\) on disk\)/.test(w)),
    { dirs: s5d?.domainDirs, basis: s5d?.domainDirBasis, warnings: s5d?.warnings, stderr: r5d.stderr.slice(0, 200) }
  );
  check(
    "F-429 ambiguity parity: the ambiguity line is in the markdown AND the caveats CSV (every warning, again)",
    parity(s5d, md5d, csv5d) && /2 domains record "connectors list"/.test(md5d) && /2 domains record "connectors list"/.test(csv5d.replace(/""/g, '"')),
    { mdHas: (s5d?.warnings ?? []).map((w) => md5d.includes(w)), csvHas: (s5d?.warnings ?? []).map((w) => csv5d.includes(w)) }
  );
}

rmSync(ROOT, { recursive: true, force: true });
console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL PASS");
process.exit(failures ? 1 : 0);
