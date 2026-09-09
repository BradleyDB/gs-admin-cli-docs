#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// tenant-deps.mjs — tenant-wide dependency search over the KB (ER-11).
//
// Given object(s), field(s), and/or external connection(s), report every
// documented tenant asset that depends on them — rules, journey programs,
// reports, connector jobs, data designers (+ journey datasets), and scorecards
// (via matching rules' SET_SCOREV2 linkage) — with the dependency kind
// (source object, filter, show field, write target, job field mapping, …) and
// asset status where known. The tenant-wide superset of jo-report's JO-scoped
// `deps` mode (ER-7), which stays JO-only by design.
//
//   node tenant-deps.mjs --kb <slugDir> [--object <o>]... [--field <f>]...
//     [--connection <c>]... [--terms-file <terms.json>] [--alias-prefix <regex>]
//     [--live-deps <deps-check.json>]...
//     --report <dir> [--csv-dir <dir>]
//
// --terms-file (GP-B5 DS-28; F-162 lineage): a JSON object
// { "objects"?: [...], "fields"?: [...], "connections"?: [...] } of term
// strings — the deps-report skill's on-disk work list, shell-neutral so
// multi-term requests (names with |, spaces, quotes) never ride argv
// quoting. BOM-tolerant read; merges with inline flags; unknown keys and
// non-string entries refuse the whole file loudly (A-4).
//
// Semantics (requirements confirmed S6, 2026-07-16):
// - ≥1 of --object/--field/--connection required. Matching is case-insensitive
//   EXACT against system name OR label (ER-7 precedent; no substring):
//   object terms against objectName/objectLabel, field terms against
//   fieldName/fieldLabel(+aliases), connection terms against connection
//   name, id, OR type (e.g. 'Acme Prod SFDC', a GUID, 'SNOWFLAKE').
// - --alias-prefix '<regex>' (ER-22/ER-23, ruled P-2 2026-07-16): alias-aware
//   FIELD matching via the shared jo-report-deps primitives — candidate field
//   names whose leading task-alias prefix matches the tenant-conventions
//   regex also compare with the prefix stripped, space↔underscore are
//   equivalent separators, still exact-ci, NEVER substring. The prefix stays
//   in every output row (it names the originating task); near-misses are
//   listed in a not-counted caveat. The convention is read by the SCRIPT
//   itself (GP-B5 DS-27: jo-report-deps readAliasConvention, from the
//   workspace's .gs-superadmin/CONVENTIONS.md, walking up from --kb) —
//   --alias-prefix is the explicit override. Missing/unset → exact-only plus
//   a conventions-unavailable caveat; malformed → exact-only plus a loud
//   caveat naming why. A pattern is never inferred from tenant data (A-4).
// - Connector KB docs (`cn list` rows — NESTED under `pnpConnectionsInfo`
//   at CLI 1.0.8, FLAT at top level from 1.0.9; both shapes read, see
//   CONNECTION_SHAPES / F-388) are the connection registry: they resolve
//   id↔name↔type, so any spelling of a connection finds the same assets. A term that names a specific connection also matches
//   assets that record only the connection TYPE (rules' task detail keeps
//   no connection id) — those rows are labeled `type-level`, never passed
//   off as exact, and a caveat states the ambiguity when the tenant has
//   more than one connection of that type.
// - External Action docs (`rules-engine-external-actions` domain) are a
//   second registry (F-217): a --connection term naming an External Action
//   (by name or configId) finds every rule that calls it, and a term naming
//   a REST connection finds the rules calling through it via External Action
//   callouts — both read from the action's `params` block, which the
//   per-field mapping walk never sees (those fields are internal MDA refs).
// - MDA / GAINSIGHT_API are the internal platform, not external connections;
//   an explicit internal term still matches, with a warning.
// - ALL assets are scanned regardless of status (impact analysis: an
//   inactive rule can be reactivated after the schema change) — the status
//   column says what's live, the scan never silently narrows.
// - Scorecards have no object/field reads of their own; their exposure rides
//   on rules' SET_SCOREV2 actions (relationships-build.mjs precedent), so the
//   scorecard section lists scorecard/measure ← matching rule edges.
// - --live-deps: captured `gs-admin --json dm deps check --name '<object>'`
//   payloads (the check is ASYNC — re-capture until
//   progressStatus.overallStatus is COMPLETED). Unlike ER-7's JO-only
//   ingestion, ALL dependency areas are rendered and reconciled against the
//   matching domain's KB results; areas this tool does not scan are shown
//   as-is, never dropped. This script never invokes the CLI itself.
//
// Reads KB docs directly (relationships-build.mjs precedent — no persistent
// index artifact); doc read-side primitives and the JO parser are imported
// from doc-lib.mjs / jo-report.mjs / jo-report-deps.mjs, never re-implemented.
//
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { parseDocJson, docMeta, normalizeText, listMdFiles, designerDocProgress, designerTaskFieldLabels, splitTrailingGroup, laneTable } from "./doc-lib.mjs";
// Portability primitives (doc-lib): NFC fold on term dedup (F-127), the one
// sq/shq/caveat copy (F-123), pinned comparators (F-128), junction-tolerant
// CLI-entry test (F-117).
import { normTerm, sq, shq, POSIX_QUOTE_CAVEAT, needsPosixQuoteCaveat, cmpName, cmpKey, isMainModule, readJsonFile, makeCliHelpers, requireKbDir, readKbIdentity, collectScorecardMeasures, resolveRecordedDomains } from "./doc-lib.mjs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
import {
  parseFlags,
  parseJourneyDoc,
  renderReport,
  mdTable,
  toCsv,
  reportPath,
  emitSummary,
  nowIso,
} from "./jo-report.mjs";
import {
  eqTerm,
  usageCandidates,
  parseLiveDepsAreas,
  readLiveDepsCaptures,
  // ER-21/ER-22's ONE shared alias-aware field-matching implementation —
  // both skills change together, by design (never re-implement here). The
  // presentation pieces (match-how labels, header line, honesty caveats,
  // near-miss collection) are shared too, so the two reports can't drift.
  resolveAliasPrefix,
  compileAliasPrefix,
  prepFieldTerm,
  fieldTermMatch,
  matchHowLabel,
  addNearMisses,
  aliasMatchingLine,
  aliasFieldCaveats,
} from "./jo-report-deps.mjs";

// ── domain constants ─────────────────────────────────────────────────────────

// Lane identity (F-429): the canonical catalog path of the list command whose
// rows each lane's docs were captured from, and the folder name used only when
// nothing is recorded. Both come from doc-lib's RECORDED_LANES — the one home
// (F-429 fourth pass) — keyed the way this script reports them (domainDirs /
// domainDirBasis keep `journeys`). Validated against the catalog at run time
// — a path the installed catalog no longer carries is said out loud, never
// silently defaulted.
const { lanes: LANE_LIST_PATHS, defaults: DOMAINS } = laneTable({
  rules: "rules",
  journeys: "journey",
  reports: "reports",
  jobs: "jobs",
  designers: "designers",
  datasets: "datasets",
  connections: "connections",
  scorecards: "scorecards",
  extActions: "extActions",
});
export { DOMAINS, LANE_LIST_PATHS };

/**
 * @param {string} kbDir
 * @param {string[]} warnings  appended to when a lane resolves away from its default or cannot resolve
 * @returns {{ laneDirs: Record<string, string>, laneBasis: Record<string, string> }}
 */
export function resolveLaneDirs(kbDir, warnings) {
  let domainsIndexed = {};
  let inventory = null;
  try {
    const m = readJsonFile(join(kbDir, "_manifest.json"));
    if (m && typeof m === "object" && m.domains_indexed && typeof m.domains_indexed === "object") domainsIndexed = m.domains_indexed;
    if (m && typeof m === "object" && m.inventory && typeof m.inventory === "object") inventory = m.inventory;
  } catch { /* readKbIdentity already warned about an unreadable manifest */ }
  // doc-lib resolveRecordedDomains — the one home of the lane → folder fold
  // (and of the ambiguity tie-break, which reads the inventory).
  const res = resolveRecordedDomains({
    startDir: kbDir,
    domainsIndexed,
    inventory,
    lanes: LANE_LIST_PATHS,
    defaults: DOMAINS,
    bundledCatalogPath: join(here, "..", "reference", "catalog.json"),
  });
  warnings.push(...res.warnings);
  return { laneDirs: res.dirs, laneBasis: res.basis };
}

// Internal platform references — the Gainsight data store and API, not
// external connections (S6 requirement). Explicit terms still match, with a
// warning; type-level expansion never touches these.
export const INTERNAL_CONNECTIONS = new Set(["MDA", "GAINSIGHT_API"]);

// dm-deps-check dependency areas → the domain of THIS scan they reconcile
// against. Areas absent here (connector areas, C360, …) render as-is in the
// live section with no KB-side verdict — shown, never dropped.
export const AREA_DOMAIN = {
  RULE: "rules",
  JOURNEY_ORCHESTRATOR: "journeys",
  REPORT: "reports",
  SC_REPORT: "reports",
  DATA_DESIGNER: "designers",
  SCORECARD: "scorecards",
};

// ── shared row helpers ───────────────────────────────────────────────────────

// One generic usage row. Extractors below produce these ONLY through row();
// matching never needs domain knowledge. Declared where produced (A-7, GP-B5
// DS-42) so every reader — the report lanes and the suites — is checked
// against one shape.
/**
 * @typedef {object} UsageRow
 * @property {string}   usage        the row kind label (e.g. "source object")
 * @property {?string}  objectName
 * @property {?string}  objectLabel
 * @property {?string}  fieldName
 * @property {?string}  fieldLabel
 * @property {string[]} altFields    aliases / custom-mapping strings
 * @property {?{id: ?string, name: ?string, type: ?string}} connection
 * @property {?{id: ?string, name: ?string}} extAction
 * @property {string}   detail
 * @property {number}   [stepCount]  action-step rows only (F-230 structured part)
 * @property {boolean}  [fieldNamesUnavailable]  the row carries NO system field
 *                                   name — a --field term spelled as a system name
 *                                   cannot match it (designer rows: the summary
 *                                   task shape, F-343; or a composite item whose
 *                                   per-field detail is missing — W9)
 * @property {string}   [fieldNamesReason]  WHY, one of DESIGNER_BLIND_REASONS'
 *                                   keys — the caveat breaks the count down by it
 */
/**
 * @param {string} usage
 * @param {Partial<UsageRow>} [over]
 * @returns {UsageRow}
 */
const row = (usage, over = {}) => ({
  usage,
  objectName: null,
  objectLabel: null,
  fieldName: null,
  fieldLabel: null,
  altFields: [],
  connection: null,
  extAction: null,
  detail: "",
  ...over,
});

// Filter-condition normalization: same leftOperand-unwrapping rule as
// jo-report.mjs's normCondition (keep in sync), plus the object LABEL, which
// this script matches and jo-report's C1 shape deliberately drops.
export function normalizeCondition(c) {
  const lo = c?.leftOperand && typeof c.leftOperand === "object" ? c.leftOperand : {};
  return {
    objectName: c.objectName ?? lo.objectName ?? null,
    objectLabel: c.objectLabel ?? lo.objectLabel ?? null,
    fieldName: c.fieldName ?? lo.fieldName ?? null,
    fieldLabel: c.fieldLabel ?? lo.fieldLabel ?? lo.label ?? null,
    comparisonOperator: c.comparisonOperator ?? null,
    filterAlias: c.filterAlias ?? c.alias ?? null,
  };
}

const condRow = (c, extra = "") => {
  const n = normalizeCondition(c);
  return row("filter", {
    objectName: n.objectName,
    objectLabel: n.objectLabel,
    fieldName: n.fieldName,
    fieldLabel: n.fieldLabel,
    detail:
      `operator ${n.comparisonOperator ?? "unknown"}` +
      (n.filterAlias ? `, alias ${n.filterAlias}` : "") +
      (extra ? ` (${extra})` : ""),
  });
};

// Conditions live under either {filters:{conditions}} (rules criteriaDetails,
// JO source config) or {conditions} directly (report where/having filters).
const conditionsOf = (x) => {
  const list = x?.filters?.conditions ?? x?.conditions;
  return Array.isArray(list) ? list.filter((c) => c && typeof c === "object") : [];
};

// ── per-domain extractors (exported for tests) ───────────────────────────────

// Rule connection-reference parse sites (F-236). The report's coverage
// caveat is DERIVED from this table, and the fixture suite pins the
// correspondence BOTH ways — every site's usages are emitted by a fixture
// exercising all sites, and every connection-bearing row usage the extractor
// emits is claimed by a site — so the caveat can never again assert a
// measured coverage boundary that was not measured (the wrong "only place"
// comment that became F-217 is the precedent). Add a parse walk → add its
// row usage(s) here, or the suite goes red.
export const RULE_CONNECTION_SITES = [
  { site: "fetch-task `connectionType`", usages: ["source object"] },
  { site: "per-field action-mapping `connectionId`/`connectionType`", usages: ["connection reference (action mapping)"] },
  { site: "action-step `params` (`configId` + `connectionId`)", usages: ["external action callout", "action-step connection reference"] },
];


// rules-engine describe payload → { asset, rows, scorecardRefs }.
// Sources of truth inside the payload (verified on CLI v1.0.4, live KB survey
// 2026-07-16): taskDetails[] carries the fetch-task object + connectionType
// (never a connection id); criteriaDetails[].filters.conditions[] carries the
// rule's filter conditions (the derived _filterConditions/_taskCriteria* arrays
// are empty in every observed doc — never read those); _flatMappings carries
// the action field mappings (srcObject is a TASK name, not an object — src
// columns are field-only candidates); gsRuleMetaActionDetails carries TWO
// distinct connection-reference sites (F-217): the per-field action-mapping
// source connectionId/Type, AND — for External Action (REST_API callout)
// steps — the action's `params` block, which records the External Action's
// configId and the connection it calls through. The two never overlap: a
// callout's field mappings reference only internal sources (GAINSIGHT_API /
// MDA), so reading mappings alone misses exactly the rules that reach an
// external system. SET_SCOREV2 linkage rules are
// copied from relationships-build.mjs (keep in sync): tgtField `scorecard` →
// srcField is a scorecard GSID; `measure` → a measure GSID; `score`/`measure`
// MAY carry a JSON-map string { "<scorecardGSID>": "<measureGSID>", … }.
export function extractRuleUsages(payload) {
  const data = payload?.data && typeof payload.data === "object" ? payload.data : {};
  const rd = data.ruleDetails && typeof data.ruleDetails === "object" ? data.ruleDetails : {};
  const asset = {
    id: rd.ruleId ?? null,
    name: rd.ruleName ?? null,
    status: rd.active === false ? "inactive" : rd.active === true ? "active" : null,
  };
  const rows = [];

  const tasks = Array.isArray(rd.taskDetails) ? rd.taskDetails : Array.isArray(rd._configTasks) ? rd._configTasks : [];
  for (const t of tasks) {
    if (!t || typeof t !== "object") continue;
    // Two task generations (review round, W8 — the F-345 class one domain
    // over): the 1.0.4 raw task spells object / objectLabel / connectionType;
    // a 1.0.8 row is summarizeTask's output — the SAME emitter the designer
    // reader parses (rules-list-mapper.js maps the SIMPLE/SOF task through it,
    // and the complex-rule rows are built by it) — so `_object` is the
    // FORMATTED display value and the connection is `_connType`. One split
    // helper for both readers (A-1); the raw keys win where present.
    const summary = parseSummaryObject(t._object, t.type || t.taskType);
    const objectName = nonEmpty(t.object) ?? summary.name ?? null;
    const objectLabel = nonEmpty(t.objectLabel) ?? summary.label ?? null;
    const connType = t.connectionType || t._connType || null;
    if (!objectName && !objectLabel && !connType) continue; // join/freeForm task — nothing referenced
    rows.push(
      row("source object", {
        objectName,
        objectLabel,
        connection: connType ? { id: null, name: null, type: connType } : null,
        detail: `task "${t.taskName ?? t._taskName ?? t.taskId ?? "?"}" (${t.taskType || t.type || "unknown type"})`,
      })
    );
  }

  for (const crit of Array.isArray(data.criteriaDetails) ? data.criteriaDetails : [])
    for (const c of conditionsOf(crit))
      rows.push(condRow(c, `criteria ${crit?.criteriaName ?? crit?.criteriaId ?? "?"}`));

  const scorecardRefs = { scorecardIds: new Set(), measureIds: new Set() };
  const jsonMap = (v) => {
    if (typeof v !== "string" || !v.trim().startsWith("{")) return null;
    try {
      const o = JSON.parse(v.trim());
      return o && typeof o === "object" && !Array.isArray(o) ? o : null;
    } catch {
      return null;
    }
  };
  for (const m of Array.isArray(rd._flatMappings) ? rd._flatMappings : []) {
    if (!m || typeof m !== "object") continue;
    if (m.actionType === "DATA_SYNC" || m.actionType === "BULK_API") {
      if (m.tgtObject && m.tgtField)
        rows.push(
          row("write target", {
            objectName: m.tgtObject,
            fieldName: m.tgtField,
            detail: `← ${m.srcField ?? "?"} (${m.actionType}, area ${m.areaName ?? "?"})`,
          })
        );
      if (m.srcField)
        rows.push(
          row("source column (mapping)", {
            fieldName: m.srcField,
            detail: `task-relative column of "${m.srcObject ?? "?"}" → ${m.tgtObject ?? "?"}.${m.tgtField ?? "?"}`,
          })
        );
    } else if (m.actionType === "REST_API") {
      if (m.tgtObject && m.tgtField)
        rows.push(
          row("action target", {
            objectName: m.tgtObject,
            fieldName: m.tgtField,
            detail: `← ${m.srcField ?? "?"} (REST_API, area ${m.areaName ?? "?"})`,
          })
        );
    } else if (m.actionType === "SET_SCOREV2") {
      const map = jsonMap(m.srcField);
      if (m.tgtField === "scorecard" && m.srcField && !map) scorecardRefs.scorecardIds.add(m.srcField);
      else if (m.tgtField === "measure" && m.srcField && !map) scorecardRefs.measureIds.add(m.srcField);
      else if ((m.tgtField === "score" || m.tgtField === "measure") && map)
        for (const k of Object.keys(map)) {
          scorecardRefs.scorecardIds.add(k);
          scorecardRefs.measureIds.add(map[k]);
        }
    }
  }

  // Per-field source connections from the action mappings. NOT the only place
  // a rule payload records a connection ID (the comment that used to say so
  // was wrong, and load-bearing — F-217): External Action callouts record
  // theirs in the action's params block. Aggregated per distinct key so a
  // wide mapping never floods the report.
  //
  // One traversal, two visitors (F-234): the mapping walk and the callout
  // walk used to be token-for-token duplicate traversals of the same
  // data.gsRuleMetaActionDetails subtree — a traversal fix (cycle guard,
  // depth cap) applied to one would give the two reference sites different
  // reach, the exact divergence class F-217 fixed. Missing the params walk
  // was PV-6's step-5 failure: rules calling an external system read as
  // "nothing depends on this connection".
  //
  // Both aggregation keys join their parts with a NUL delimiter (F-235):
  // extAgg used a space, which mis-splits any id ever containing one —
  // GUID-ness is observed, commented, and enforced by nothing. The delimiter
  // char is BUILT (String.fromCharCode), never spelled as an escape, so no
  // tool layer can mangle the escape into a literal NUL in this source.
  const SEP = String.fromCharCode(0);
  const connAgg = new Map(); // key: connectionId + SEP + connectionType → mapped-field count
  const extAgg = new Map(); // key: configId + SEP + connectionId → action-step count
  (function walk(node) {
    if (Array.isArray(node)) {
      for (const x of node) walk(x);
      return;
    }
    if (!node || typeof node !== "object") return;
    const f = node.source?.field;
    if (f && typeof f === "object" && (f.connectionId || f.connectionType)) {
      const key = `${f.connectionId ?? ""}${SEP}${f.connectionType ?? ""}`;
      connAgg.set(key, (connAgg.get(key) ?? 0) + 1);
    }
    const p = node.params;
    if (p && typeof p === "object" && !Array.isArray(p) && (p.configId || p.connectionId)) {
      const key = `${p.configId ?? ""}${SEP}${p.connectionId ?? ""}`;
      extAgg.set(key, (extAgg.get(key) ?? 0) + 1);
    }
    for (const k of Object.keys(node)) if (node[k] && typeof node[k] === "object") walk(node[k]);
  })(data.gsRuleMetaActionDetails);
  for (const [key, count] of connAgg) {
    const [id, type] = key.split(SEP);
    rows.push(
      row("connection reference (action mapping)", {
        connection: { id: id || null, name: null, type: type || null },
        detail: `${count} mapped source field(s)`,
      })
    );
  }
  // External Action callouts (F-217): the action's `params` block is where a
  // rule records WHICH External Action it calls (params.configId → a
  // rules-engine-external-actions asset) and the connection it calls through
  // (params.connectionId).
  // The callout KIND label is gated on the callout's defining datum,
  // params.configId (F-229, Bradley's ruling): a connectionId-only params
  // node is a REAL rule→connection edge whose kind is unproven (a
  // non-callout step type can record one), so it is still emitted — wearing
  // the evidence-honest label "action-step connection reference" instead.
  // Rows carry stepCount as structured data (F-230): the report's rules lane
  // re-renders the human-facing detail from these parts after name
  // resolution — never by String.replace over prose, which corrupted output
  // on $-bearing KB names (GetSubstitution) and went silently no-op when
  // either side's wording drifted.
  for (const [key, count] of extAgg) {
    const [configId, connectionId] = key.split(SEP);
    rows.push(
      row(configId ? "external action callout" : "action-step connection reference", {
        extAction: configId ? { id: configId, name: null } : null,
        connection: connectionId ? { id: connectionId, name: null, type: null } : null,
        stepCount: count,
        detail: `${count} action step(s)${configId ? ` calling external action ${configId}` : ""}`,
      })
    );
  }


  return { asset, rows, scorecardRefs };
}

// Report describe payload → { asset, rows }. sourceDetails is the report's
// object + connection; showFields/groupBy/orderBy/drillDown are field
// descriptors (calculated fields nest more descriptors under
// expressionDetails.expression.arguments — walked, deduped); where/having
// filters are leftOperand conditions. NOTE: SFDC-sourced reports carry a
// workspace-style connectionId (`SFDC_<org>`), not a KB connector GUID —
// connection matching for reports usually lands on the TYPE.
export function extractReportUsages(payload) {
  const d = payload?.data && typeof payload.data === "object" ? payload.data : {};
  const asset = {
    id: d.reportId ?? null,
    name: d.reportName ?? null,
    status: d.deleted === true ? "deleted" : null,
  };
  const rows = [];
  const sd = d.sourceDetails && typeof d.sourceDetails === "object" ? d.sourceDetails : null;
  const srcConn = sd && (sd.connectionId || sd.connectionType)
    ? { id: sd.connectionId ?? null, name: null, type: sd.connectionType ?? null }
    : null;
  if (sd && (sd.objectName || srcConn))
    rows.push(
      row("source object", {
        objectName: sd.objectName ?? null,
        objectLabel: sd.objectLabel ?? null,
        connection: srcConn,
        detail: sd.dataStoreType ? `data store ${sd.dataStoreType}` : "",
      })
    );

  const seen = new Set();
  const fieldRows = (list, usage) => {
    (function walk(node, depth) {
      if (Array.isArray(node)) {
        for (const x of node) walk(x, depth);
        return;
      }
      if (!node || typeof node !== "object") return;
      if (node.fieldName) {
        const key = `${usage}\u0000${node.objectName ?? ""}\u0000${node.fieldName}`;
        if (!seen.has(key)) {
          seen.add(key);
          rows.push(
            row(depth ? `${usage} (calculated)` : usage, {
              objectName: node.objectName ?? null,
              objectLabel: node.objectLabel ?? null,
              fieldName: node.fieldName,
              fieldLabel: node.label ?? node.displayName ?? null,
              altFields: node.fieldAlias ? [node.fieldAlias] : [],
            })
          );
        }
      }
      // nested descriptors of calculated fields; fieldPath lookup chains are
      // deliberately NOT walked (lookup internals, not report surface)
      const args = node.expressionDetails?.expression?.arguments;
      if (Array.isArray(args)) walk(args, depth + 1);
    })(list, 0);
  };
  fieldRows(d.showFields, "show field");
  fieldRows(d.groupByFields, "group by");
  fieldRows(d.orderByFields, "order by");
  fieldRows(d.drillDownFields, "drill-down field");
  for (const c of conditionsOf(d.whereFilters)) rows.push(condRow(c, "where"));
  for (const c of conditionsOf(d.havingFilters)) rows.push(condRow(c, "having"));
  return { asset, rows };
}

// Connector-job payload → { asset, rows }. connectionDetails names the
// connection (id + name + type — the richest connection record any dependent
// carries); properties name the Gainsight target object; taskInfo[] carries
// the external source objects and their per-field mappings.
export function extractJobUsages(payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  const cd = p.connectionDetails && typeof p.connectionDetails === "object" ? p.connectionDetails : {};
  const conn =
    cd.connectionId || cd.connectionName || cd.connectorType
      ? { id: cd.connectionId ?? null, name: cd.connectionName ?? null, type: cd.connectorType ?? null }
      : null;
  const asset = {
    id: p.jobId ?? null,
    name: p.jobName ?? p._jobName ?? null,
    status: p.disabled === true ? "disabled" : p.disabled === false ? "enabled" : null,
  };
  const rows = [];
  if (conn) rows.push(row("job connection", { connection: conn, detail: cd.connectionStatus ? `connection status ${cd.connectionStatus}` : "" }));
  const props = p.properties && typeof p.properties === "object" ? p.properties : {};
  if (props.APPLICATION_DATA_TARGET_OBJECT_NAME || props.APPLICATION_DATA_TARGET_OBJECT)
    rows.push(
      row("job target object", {
        objectName: props.APPLICATION_DATA_TARGET_OBJECT_NAME ?? null,
        objectLabel: props.APPLICATION_DATA_TARGET_OBJECT ?? null,
        detail: "Gainsight object this job loads",
      })
    );
  for (const t of Array.isArray(p.taskInfo) ? p.taskInfo : []) {
    if (!t || typeof t !== "object") continue;
    if (t.objectName)
      rows.push(
        row("job source object", {
          objectName: t.objectName,
          connection: conn,
          detail: `task "${t.taskName ?? t.taskId ?? "?"}"`,
        })
      );
    for (const f of Array.isArray(t.fieldInfoList) ? t.fieldInfoList : []) {
      if (!f || typeof f !== "object" || !f.fieldName) continue;
      rows.push(
        row("job field mapping", {
          objectName: t.objectName ?? null,
          fieldName: f.fieldName,
          fieldLabel: f.label ?? null,
          altFields: f.fieldAlias ? [f.fieldAlias] : [],
          connection: conn,
          detail: f.fieldAlias ? `→ ${f.fieldAlias}` : "",
        })
      );
    }
  }
  return { asset, rows };
}

// Data-designer template payload → { asset, rows }. THREE task shapes exist in
// KBs and all three are read (parse, don't validate — A-3), with one
// precedence rule per fact so no generation is silently dropped:
//   LIVE-summary (CLI 1.0.6+ `dd t describe`, the common case — F-343,
//     confirmed on a live tenant 2026-09-01): task-detail.js summarizeTask's
//     row — taskId, taskName, taskType, `_parents` plus the normalized
//     `_object` / `_connType` / `_fieldCount` / `_filterCount` / `_groupByCount`
//     keys and NO queryInfo / connectionDetails. Field NAMES are not in this
//     payload — counts only (the per-task drilldown `--task-id` has them).
//   HYBRID (the CLI 1.0.4 describe — data-designer/common/shared.js
//     summarizeTaskForRow spread the RAW task and added the `_` keys; docs
//     written at that pin are still in KBs, confirmed by the B12 tester on a
//     real KB 2026-09-02): the raw keys PLUS queryInfo.{objectName, show[],
//     criteria} and connectionDetails PLUS `_object` / `_connType` / counts.
//     That summarizer had NO kind test — `_object` is `qi.objectName` whatever
//     the task — so a DERIVED hybrid task carries its upstream TASK ID in
//     `_object` and in queryInfo.objectName alike; the split files it as a
//     label, the queryInfo fallback fills the name with the same value, and
//     the row renders exactly as it did before DS-45 (pinned). Whether such a
//     task-id self-reference should be a source-object row at all is a
//     pre-existing question, not this wave's.
//   LEGACY (the 1.0.4 describe, before task-detail.js existed — the docs the
//     KB still carries): a raw task with id / name / type, queryInfo /
//     connectionDetails, and no `_` keys.
// F-342 fixed the envelope (the handler wraps the template one level and
// describe-batch fences the RAW payload); F-343 found this loop reading only
// the LEGACY task shape, so every LIVE-summary doc yielded zero rows while the
// suite certified the legacy fixture. Class fix: the reader DECLARES the
// external producer's shape (DesignerTask below, authored from the handler
// source at the pin — the T-5 pattern for an external emitter) and the repo's
// tsc gate rejects a read of any key it does not declare; the fixture carries
// all three generations; and scanDomain's yield honesty stat + caveat make an
// all-docs-yield-nothing domain LOUD instead of a confident zero (A-4).
/**
 * One `_tasks[]` entry, any generation. Authored from the installed CLI at pin
 * 1.0.8 AND confirmed against one live read-only `dd t describe` (2026-09-01):
 * the action routes through handlers/data-designer.js's re-export to
 * handlers/data-preparation/templates/describe/index.js, whose summarizeTask
 * (common/task-detail.js) emits the LIVE-summary keys below — NOT the
 * look-alike handlers/data-designer/template.js module, which is not on the
 * routed path (its summarizeTaskForRow would have spelled id/name/type). The
 * legacy keys are the 1.0.4-era describe (no task-detail.js yet; raw task
 * spread). Re-derive at every CLI adoption — follow the manifest's handler
 * pointer, then the re-export chain — a key renamed upstream must fail HERE.
 * @typedef {object} DesignerTask
 * @property {string} [taskId]           live summary (task-detail.js summarizeTask)
 * @property {string} [taskName]
 * @property {string} [taskType]         e.g. "mdaExtract"
 * @property {string} [_parents]         live summary: parent task ids joined ", "; "" when none
 * @property {string} [_object]          summarizer: a FORMATTED display value, not an
 *                                       identifier (F-345). Its four-branch grammar
 *                                       and the split live ONCE, at parseSummaryObject
 *                                       below — parse it there, with the task's type;
 *                                       never compare it whole.
 * @property {string} [_connType]        summarizer: connection type; "" when unknown
 * @property {number|"?"} [_fieldCount]  summarizer: "?" when no field array exists
 * @property {number|"?"} [_filterCount]
 * @property {number} [_groupByCount]
 * @property {string} [id]               legacy raw task (1.0.4-era docs)
 * @property {string} [name]
 * @property {string} [type]
 * @property {*}      [parents]
 * @property {string} [objectLabel]      legacy raw task: the SOF object label
 * @property {{objectName?: string, show?: Array<{fieldName?: string, label?: string,
 *             objectName?: string, objectLabel?: string}>, criteria?: *}} [queryInfo]
 * @property {{connectionId?: string, connectionName?: string, connectionType?: string}} [connectionDetails]
 */
const nonEmpty = (v) => (typeof v === "string" && v.trim() ? v : undefined);
const isCount = (v) => typeof v === "number";
// The summarizer's `_object` is a display string, built by task-detail.js
// summarizeTask from THREE inputs — the task's object label, its object name,
// and its kind (taskKind: a type containing "extract" is an extract; join /
// union / pivot / freeform and anything else is derived):
//   label + name        → "Label (name)"   (exactly ONE trailing parenthesized group)
//   label, no name      → "Label"          (the label ALONE)
//   no label, extract   → "name"           (the bare system name)
//   no label, derived   → ""
// Split it back into {name, label} so the matcher sees identifiers (F-345:
// taken whole, "Company (company)" matched neither the name nor the label —
// and the row still counted as yielding, so the yield column could not see it).
// A parenthesis-free value needs the kind (DS-45, W8): on a DERIVED task it
// can only be a label alone — the no-label branch writes "" there — so it is
// returned as the LABEL with name null (an identifier column never carries a
// display value; the matcher already matches labels). On an EXTRACT it is
// read as the bare name: that is the emitter's common branch, and its
// degenerate sibling (an extract carrying a label but no object name — a task
// with nothing to extract from) prints the same bytes, so the two cannot be
// told apart. That is the format's one collapsed branch, stated here rather
// than guessed at from the spelling.
// Split ambiguity by construction (tester, W7 round 4): a bare system name
// that itself ended in a parenthesized group would split into label + name.
// Unreachable at pin 1.0.8 — system object names are parenthesis-free
// identifiers and the emitter appends exactly one trailing group — so the
// parser reads the LAST group as the name; a label may carry its own
// parentheses ("Rollup (v2) (rollup_v2__gc)") and splits correctly.
export const parseSummaryObject = (v, taskType) => {
  const s = nonEmpty(v);
  if (s === undefined) return { name: null, label: null };
  const g = splitTrailingGroup(s); // the one trailing-group primitive (doc-lib, W9)
  if (g) return { name: g.group, label: g.base };
  const extract = String(taskType ?? "").toLowerCase().includes("extract");
  return extract ? { name: s.trim(), label: null } : { name: null, label: s.trim() };
};
// ── The composite's drilldown tables (GP-B5 W9, CLI 1.0.8) ──────────────────
// The task-level tables are typed ONCE, at the KB doc contract's home
// (doc-lib's DesignerTaskDetail + DESIGNER_TASK_TABLES — the T-5 pattern for
// an external emitter, tsc-gated); this reader consumes them through that
// type. The `--field` detail is a `{_key, _value}` row list; the reader
// consumes these keys (buildFieldDetail's spellings, verbatim):
/** @typedef {import("./doc-lib.mjs").DesignerTaskDetail} DesignerTaskDetail */
export const DESIGNER_FIELD_DETAIL_KEYS = Object.freeze({
  name: "Field Name",
  label: "Display Name",
  alias: "Field Alias (output header)",
  object: "Source Object",
  connection: "Connection",
});
// Why a designer row carries no system field name — the caveat's breakdown
// vocabulary (A-4: the count says WHICH mechanism, never a bare number). Each
// entry carries the caveat phrase AND the per-row note fragment so a reason
// can never be added to one and not the other; the emit sites go through
// blindRow() below, which refuses a key outside this table, and the report
// renders the breakdown from the OBSERVED keys with an explicit "other"
// bucket so the parts always sum to the total (W9 review round).
/** @type {Readonly<Record<string, {caveat: string, note: (task?: *, field?: *) => string}>>} */
export const DESIGNER_BLIND_REASONS = Object.freeze({
  "summary-shape": {
    caveat: "the CLI's summary task shape (no drilldown ingested — counts only)",
    note: () => "names not in this payload (summary task shape)",
  },
  "task-drilldown-missing": {
    caveat: "the task's --task-id drilldown is missing from the doc (failed or not yet run)",
    note: (t) => `names not on file (task drilldown ${t?.status === "failed" ? `failed: ${t.error ?? "?"}` : "not yet run"})`,
  },
  "field-detail-missing": {
    caveat: "the field's --field detail is missing (failed or not yet run)",
    note: (t, f) => (f?.status === "failed" ? `field detail failed: ${f.error ?? "?"}` : "field detail not on file"),
  },
  "field-unresolvable": {
    caveat: "the CLI refused every spelling of the field's label with its not-found sentence (a recorded gap at this pin)",
    note: (t, f) => `field unresolvable by the CLI: ${f?.error ?? "?"}`,
  },
  "no-system-name": {
    caveat: "the field's --field detail is on file but carries no Field Name row (a calculated field with no backing system field)",
    note: () => "detail on file, no Field Name row",
  },
  "duplicate-label": {
    caveat: "a duplicate label on the task (the CLI's --field resolves the first match only)",
    note: () => "duplicate label — the CLI's per-field detail reaches only the first",
  },
  "unparsed-field-list": {
    caveat: "the join task's field list did not parse (see the doc's _kb)",
    note: (t) => `names not on file (${t?.fieldListUnparsed ?? "field list unparsed"})`,
  },
  "label-only-carrier": {
    caveat: "the drilldown table carries a display label with no per-field detail (criteria / join / union columns)",
    note: () => "label-only column",
  },
});
/** @param {string} reason */
const blindRow = (reason) => {
  if (!Object.hasOwn(DESIGNER_BLIND_REASONS, reason)) throw new Error(`unknown designer blind reason: ${reason}`);
  return { fieldNamesUnavailable: true, fieldNamesReason: reason };
};
// "Source Object" off a field detail: "Label (name)" when both exist and
// differ, else the one that exists (label first) — the same trailing-group
// grammar as the summary object, parsed by the same primitive. The bare case
// is the DS-45 ambiguity again — decided by the TASK's summary object, never
// guessed: a bare value equal to the task's system object name IS that name;
// anything else is filed as a label (an identifier column never carries a
// display value).
const fieldSourceObject = (v, taskObjectName, taskObjectLabel) => {
  const s = nonEmpty(v);
  if (s === undefined) return { name: null, label: null };
  const g = splitTrailingGroup(s);
  if (g) return { name: g.group, label: g.base };
  const bare = s.trim();
  if (taskObjectName && bare.toLowerCase() === String(taskObjectName).toLowerCase()) return { name: taskObjectName, label: taskObjectLabel ?? null };
  return { name: null, label: bare };
};
export function extractDesignerUsages(payload) {
  const outer = payload && typeof payload === "object" ? payload : {};
  const p = outer.data && typeof outer.data === "object" && !Array.isArray(outer.data) ? outer.data : outer;
  const asset = { id: p.templateId ?? null, name: p.name ?? null, status: null };
  /** @type {UsageRow[]} */
  const rows = [];
  // The W9 composite, when the doc carries one (null for summary-only /
  // legacy docs — every row below then reads exactly as before W9).
  const kb = designerDocProgress(p)?.kb ?? null;
  for (const raw of Array.isArray(p._tasks) ? p._tasks : []) {
    if (!raw || typeof raw !== "object") continue;
    const t = /** @type {DesignerTask} */ (raw);
    // Live summary spells taskName/taskId/taskType; legacy raw tasks name/id/type.
    const taskLabel = `task "${t.taskName ?? t.name ?? t.taskId ?? t.id ?? "?"}"`;
    const taskId = t.taskId ?? t.id ?? null;
    // The type is read in the EMITTER's own order (task-detail.js:587,
    // `t.type || t.taskType`) — ONE expression feeds both the display and the
    // kind parseSummaryObject needs (review round, W8); every generation on
    // record carries one spelling, so the order is a faithfulness pin, not
    // a behavior change.
    const rawType = t.type || t.taskType || "";
    const taskType = rawType || "unknown type";
    const cd = t.connectionDetails && typeof t.connectionDetails === "object" ? t.connectionDetails : {};
    const q = t.queryInfo && typeof t.queryInfo === "object" ? t.queryInfo : {};
    // Precedence per fact: the summarizer's normalized key (present on every
    // 1.0.8 row, "" when unknown) first, then the nested detail (legacy/full).
    const summaryObj = parseSummaryObject(t._object, rawType);
    const objectName = summaryObj.name ?? nonEmpty(q.objectName) ?? null;
    const objectLabel = summaryObj.label ?? nonEmpty(t.objectLabel) ?? null;
    const connType = nonEmpty(t._connType) ?? nonEmpty(cd.connectionType) ?? null;
    const conn = cd.connectionId || connType ? { id: cd.connectionId ?? null, name: cd.connectionName ?? null, type: connType } : null;
    const show = Array.isArray(q.show) ? q.show : [];
    const conds = conditionsOf(q.criteria);

    // ── W9: rows from the composite's drilldowns, per item honesty ─────────
    const tid = taskId != null ? String(taskId) : null;
    const tdet = kb && tid && kb.taskDetails[tid] ? kb.taskDetails[tid] : null;
    const tstat = kb && tid ? kb.tasks[tid] ?? null : null;
    const fstat = kb && tid ? kb.fields[tid] ?? {} : {};
    const fdet = kb && tid ? kb.fieldDetails[tid] ?? {} : {};
    /** @type {UsageRow[]} */
    const drillRows = [];
    let namedFieldRows = 0;
    let labelCount = 0;
    // label → field-detail rows / status (case-insensitive — the composite's
    // own keying, which mirrors the CLI's resolver) for the criteria/join
    // resolution below.
    const detailByLabel = new Map(Object.entries(fdet).map(([k, v]) => [k.trim().toLowerCase(), v]));
    const statusByLabel = new Map(Object.entries(fstat).map(([k, v]) => [k.trim().toLowerCase(), v]));
    // The field's own connection: the detail's Connection row is
    // `connectionType || connectionId` — when it names the task's own type the
    // task's fuller {id, name, type} is kept (one connection, one spelling in
    // the report); a different value is a type/id of its own.
    const fieldConnection = (c) => (c === null ? conn : conn && conn.type === c ? conn : { id: null, name: null, type: c });
    const detailFacts = (rowsOf) => {
      const by = {};
      for (const r of Array.isArray(rowsOf) ? rowsOf : []) if (r && typeof r === "object" && typeof r._key === "string" && !(r._key in by)) by[r._key] = r._value;
      const name = nonEmpty(by[DESIGNER_FIELD_DETAIL_KEYS.name]) ?? null;
      const label = nonEmpty(by[DESIGNER_FIELD_DETAIL_KEYS.label]) ?? null;
      const alias = nonEmpty(by[DESIGNER_FIELD_DETAIL_KEYS.alias]) ?? null;
      const src = fieldSourceObject(by[DESIGNER_FIELD_DETAIL_KEYS.object], objectName, objectLabel);
      return { name, label, alias, src, connection: fieldConnection(nonEmpty(by[DESIGNER_FIELD_DETAIL_KEYS.connection]) ?? null) };
    };
    // ONE row shape for every drilled field (W9 review round: two literals
    // had already drifted on the object cell): facts come from the detail
    // where it exists; the object falls back to the TASK's object (known
    // from the summary row whether or not the field's detail is on file).
    const fieldRow = (usage, { label, name = null, alias = null, src = null, connection = conn, detail, blind = null, extraAlt = [] }) =>
      row(usage, {
        objectName: src?.name ?? (src?.label ? null : objectName),
        objectLabel: src?.label ?? (src?.name ? null : objectLabel),
        fieldName: name,
        fieldLabel: label,
        altFields: [...extraAlt, ...(alias && alias !== name && alias !== label ? [alias] : [])].filter((x) => x && x !== name && x !== label),
        connection,
        detail,
        ...(blind ? blindRow(blind) : {}),
      });
    if (kb && tid && tdet) {
      const { labels } = designerTaskFieldLabels(tdet);
      labelCount = labels.length;
      const seen = new Map(); // lowercase label → occurrences so far
      for (const l of labels) {
        const key = l.label.trim().toLowerCase();
        const nth = (seen.get(key) ?? 0) + 1;
        seen.set(key, nth);
        const st = statusByLabel.get(key);
        const det = nth === 1 ? detailByLabel.get(key) : undefined;
        const labelWithSuffix = l.suffix ? `${l.label} (${l.suffix})` : l.label;
        const f = det ? detailFacts(det) : null;
        const why =
          nth > 1 ? "duplicate-label"
          : f ? (f.name ? null : "no-system-name")
          : st?.status === "failed" && st.permanent === true ? "field-unresolvable"
          : "field-detail-missing";
        if (f?.name) namedFieldRows++;
        const note = why ? DESIGNER_BLIND_REASONS[why].note(tstat, st) : "";
        drillRows.push(
          fieldRow("show field", {
            label: f?.label ?? l.label,
            name: f?.name ?? null,
            alias: f?.alias ?? null,
            src: f?.src ?? null,
            connection: f?.connection ?? conn,
            extraAlt: labelWithSuffix !== (f?.label ?? l.label) ? [labelWithSuffix] : [],
            detail: `${taskLabel} (${l.source} field${l.suffix ? `, ${l.suffix}` : ""}${note ? `; ${note}` : ""})`,
            blind: why,
          })
        );
      }
      // A join task whose `Fields (<src>)` row did not parse has field names
      // on file that this reader could not enumerate — say so as its own row
      // (a derived task has no source-object row to carry the reason on).
      if (typeof tstat?.fieldListUnparsed === "string")
        drillRows.push(
          fieldRow("field list", {
            label: null,
            detail: `${taskLabel} (${DESIGNER_BLIND_REASONS["unparsed-field-list"].note(tstat, null)})`,
            blind: "unparsed-field-list",
          })
        );
      // Criteria conditions: label-first columns, resolved through this
      // task's field details where the label is on file.
      const resolveLabel = (v) => {
        const s = nonEmpty(v);
        if (s === undefined) return null;
        const det = detailByLabel.get(s.trim().toLowerCase());
        const f = det ? detailFacts(det) : null;
        return { label: s.trim(), facts: f };
      };
      for (const c of Array.isArray(tdet._taskCriteriaConditions) ? tdet._taskCriteriaConditions : []) {
        if (!c || typeof c !== "object") continue;
        const sides = [resolveLabel(c._lhsField), c._rhsType === "FIELD" ? resolveLabel(c._rhsValue) : null].filter((x) => x !== null);
        for (const side of sides)
          drillRows.push(
            fieldRow("filter", {
              label: side.label,
              name: side.facts?.name ?? null,
              src: side.facts?.src ?? null,
              connection: side.facts?.connection ?? conn,
              detail: `operator ${c._operator || "unknown"}${c._alias ? `, alias ${c._alias}` : ""} (${taskLabel})`,
              blind: side.facts?.name ? null : "label-only-carrier",
            })
          );
      }
      // Join conditions: "<object>.<field>" per side — the object part is a
      // task/object display name, the field part name-first; the whole
      // spelling is an altFields candidate and the split is at the LAST dot.
      for (const jc of Array.isArray(tdet._taskJoinConditions) ? tdet._taskJoinConditions : []) {
        if (!jc || typeof jc !== "object") continue;
        for (const side of [jc._left, jc._right]) {
          const s = nonEmpty(side);
          if (s === undefined) continue;
          const dot = s.lastIndexOf(".");
          const obj = dot > 0 ? s.slice(0, dot) : null;
          const fld = dot > -1 ? s.slice(dot + 1) : s;
          const res = resolveLabel(fld);
          drillRows.push(
            fieldRow("join condition", {
              label: fld,
              name: res?.facts?.name ?? null,
              src: { name: null, label: obj },
              extraAlt: [s],
              detail: `${jc._left} ${jc._op || "EQ"} ${jc._right} (${taskLabel})`,
              blind: res?.facts?.name ? null : "label-only-carrier",
            })
          );
        }
      }
    }

    // Summary-only rows know HOW MANY fields/filters a task has but not which.
    // Say so on the row (A-4) — the report turns it into a caveat when --field
    // terms are in play — rather than emit nothing and read as "no usage".
    // With a composite, the source-object row is blind only when the task's
    // drilldown produced NO system-named field row; the reason names the
    // level that is missing.
    const summaryBlind = !show.length && !conds.length && (isCount(t._fieldCount) || isCount(t._filterCount));
    const fieldNamesUnavailable = summaryBlind && namedFieldRows === 0;
    const blindReason = !fieldNamesUnavailable ? null
      : !kb || !tid ? "summary-shape"
      : !tdet ? "task-drilldown-missing"
      : typeof tstat?.fieldListUnparsed === "string" && labelCount === 0 ? "unparsed-field-list"
      : "field-detail-missing";
    const countNote = blindReason
      ? ` — ${t._fieldCount ?? "?"} field(s), ${t._filterCount ?? "?"} filter(s); ${DESIGNER_BLIND_REASONS[blindReason].note(tstat, null)}`
      : "";
    // A label-only source object (DS-45) is still a source object: the row
    // carries the label with objectName null, and renders its name cell as
    // the dash — the report's way of saying no system name is on record.
    if (objectName || objectLabel)
      rows.push(
        row("source object", {
          objectName,
          objectLabel,
          connection: conn,
          detail: `${taskLabel} (${taskType})${countNote}`,
          ...(blindReason ? blindRow(blindReason) : {}),
        })
      );
    rows.push(...drillRows);
    for (const f of show) {
      if (!f || typeof f !== "object" || !f.fieldName) continue;
      rows.push(
        row("show field", {
          objectName: f.objectName ?? objectName,
          objectLabel: f.objectLabel ?? null,
          fieldName: f.fieldName,
          fieldLabel: f.label ?? null,
          connection: conn,
          detail: taskLabel,
        })
      );
    }
    for (const c of conds) rows.push(condRow(c, taskLabel));
  }
  return { asset, rows };
}

// Journey-data-designer dataset doc → { asset, rows }. These docs are the
// dataset's OWN schema — no source lineage is recorded, so a hit means "this
// dataset exposes that object/field", not where it came from (caveated).
export function extractDatasetUsages(payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  const asset = { id: p.objectName ?? null, name: p.label ?? p.objectName ?? null, status: null };
  const rows = [];
  if (p.objectName)
    rows.push(row("dataset object", { objectName: p.objectName, objectLabel: p.label ?? null, detail: `${p.fieldCount ?? "?"} field(s)` }));
  for (const f of Array.isArray(p.fields) ? p.fields : []) {
    if (!f || typeof f !== "object" || !f.fieldName) continue;
    rows.push(
      row("dataset field", {
        objectName: p.objectName ?? null,
        fieldName: f.fieldName,
        fieldLabel: f.displayName ?? null,
      })
    );
  }
  return { asset, rows };
}

// JO program (C1 entry from parseJourneyDoc) → generic rows, via ER-7's own
// candidate extractor so the two views can never disagree about what a
// participant source references. C1 mapping rows carry no object names
// (ER-7's standing caveat) — that honesty note is inherited here.
export function journeyUsageRows(entry) {
  return usageCandidates(entry).map((c) =>
    row(c.usage, {
      objectName: c.objectName ?? null,
      fieldName: c.fieldName ?? null,
      fieldLabel: c.fieldLabel ?? null,
      altFields: Array.isArray(c.strings) ? c.strings : [],
      detail: `source "${c.source}" — ${c.detail}`,
    })
  );
}

// External-action doc (rules-engine-external-actions domain) → registry entry
// {id, name, connectionId} (or null). TWO shapes (F-228): a describe-wrapped
// payload keeps configId/name at data.* and the connection at
// data.config.connectionId; a STUB doc holds the raw list row with no data
// wrapper — the same top-level posture extractConnection reads — with
// configId/name at the top and the connection at config.connectionId or
// connectionId. On a stub-crawled tenant (setup stubs any domain >100 assets
// until --deep runs) the wrapped-only read parsed every doc to null, so
// extRegistry came back empty with no signal and an External Action name as
// a --connection term found nothing. url/headers are masked by the doc
// generator — never read them (F-217).
export function extractExternalAction(payload) {
  const wrapped = payload?.data && typeof payload.data === "object" && !Array.isArray(payload.data);
  const d = wrapped
    ? payload.data
    : payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload
      : {};
  if (d.configId == null && d.name == null) return null;
  return {
    id: d.configId ?? null,
    name: d.name ?? null,
    // The nested read's own default is the OUTER `??` (an absent nested id
    // falls through to the top-level one either way — null and undefined
    // alike); TypeScript 7 flags a `?? null` that only ever feeds another
    // `??` as a dead default (TS2871, W8.5/DS-51), so it carries none.
    connectionId:
      (d.config && typeof d.config === "object" ? d.config.connectionId : null) ?? d.connectionId ?? null,
  };
}

// Connector doc → registry entry {id, name, type, status, auth} (or null).
//
// TWO row shapes exist in KBs and both are read (F-388, Class: reader-shape —
// the F-343 three-generation precedent, shape list as DATA, never a second
// if-branch). Where the five fields live depends on the CLI that captured
// the doc, and the plugin runs whatever CLI the workspace has installed while
// the repo pin stays where it is — so this reader follows the user's CLI, not
// the pin. Derived from the CLI package source at two pins (the handler's own
// header comment + the manifest's columns/fieldsCatalog paths), NOT from a
// captured payload — the capture is the CP-6 live arm the maintainers bank (repo validation ledger):
//   NESTED — `cn list` at CLI 1.0.8 (`/v1/api/connector/ipaas/connections`):
//     `data: [{ pnpConnectionsInfo: { connectionId, connectionName,
//     connectionType, ... }, properties: {} }]`, manifest paths
//     `$.pnpConnectionsInfo.<field>`. STILL the shape of
//     `re r list-rest-connections` and the data-preparation S3 connection
//     discovery at 1.0.9 (gs-fortress audit-1.0.9 §1.11, upstream KI-011:
//     two shapes on three surfaces) — never drop or rename this arm.
//   FLAT — `cn list` from CLI 1.0.9 (`/v2/api/duct/connection/connections`):
//     `data: [{ connectionId, connectionName, connectionType,
//     connectionStatus, authorizationType, ... }]`, manifest paths
//     `$.<field>`; no `pnpConnectionsInfo` key, and the `modifiedDateStr`
//     column is gone with no top-level replacement.
// Walk order: nested first (the pin's shape and the other two surfaces'),
// then flat. A payload carrying neither id nor name at either root is null —
// counted by the caller and reported through REGISTRY_LANES, never silent.
/**
 * One `cn list` row at either root — the five fields the manifest renders.
 * Declared so the tsc gate rejects a read of an undeclared key (the F-343 M5
 * lock): an upstream rename fails HERE, in CI, before it reaches a tenant.
 * Re-derive at every CLI adoption from handlers/connectors.js's header
 * comment and connectors.json's fieldsCatalog.
 * @typedef {object} ConnectionRow
 * @property {string} [connectionId]
 * @property {string} [connectionName]
 * @property {string} [connectionType]      e.g. "SFDC", "SNOWFLAKE", "S3", "REST_API"
 * @property {string} [connectionStatus]
 * @property {string} [authorizationType]
 */
/** @type {ReadonlyArray<{shape: "nested" | "flat", root: (payload: *) => *}>} */
export const CONNECTION_SHAPES = [
  { shape: "nested", root: (payload) => payload?.pnpConnectionsInfo },
  { shape: "flat", root: (payload) => payload },
];
export function extractConnection(payload) {
  for (const { root } of CONNECTION_SHAPES) {
    const raw = root(payload);
    if (!raw || typeof raw !== "object") continue;
    const info = /** @type {ConnectionRow} */ (raw);
    if (info.connectionId == null && info.connectionName == null) continue;
    return {
      id: info.connectionId ?? null,
      name: info.connectionName ?? null,
      type: info.connectionType ?? null,
      status: info.connectionStatus ?? null,
      auth: info.authorizationType ?? null,
    };
  }
  return null;
}

// The scorecard measure walk lives in doc-lib (GP-B5 W10 review round); this
// re-export keeps the suite's and any caller's import path stable.
export { collectScorecardMeasures };

// ── term matching (exported for tests) ───────────────────────────────────────

// Connection terms expand against the registry so name/id/type spellings all
// find the same assets: a term equal to a registry connection's name or id
// contributes that connection's id (exact matches) AND its type (type-level
// matches — assets like rules record only the type). Direct type terms match
// ref types exactly.
// NFC fold on every compare-path lowercase in this file (F-148 — both sides,
// eqTerm's own rule): stored sets, direct compares, and term prep all fold, so
// an NFD spelling can never false-miss on a path eqTerm doesn't own.
export function expandConnectionTerms(terms, registry, extActions = []) {
  return terms.map((term) => {
    const lowered = normTerm(term).trim().toLowerCase();
    const ids = new Set();
    const nameTypes = new Set();
    for (const c of registry) {
      if (eqTerm(c.id, lowered) || eqTerm(c.name, lowered)) {
        if (c.id != null) ids.add(normTerm(String(c.id)).toLowerCase());
        if (c.type != null) nameTypes.add(normTerm(String(c.type)).toLowerCase());
      }
    }
    // External Actions resolve the same way a connection does (F-217): a term
    // equal to an action's name or configId contributes that configId, so
    // either spelling finds the rules that call it. Deliberately NOT expanded
    // to the action's own connection — naming an action asks "who calls THIS
    // action", not "who uses its connection".
    const extIds = new Set();
    for (const ea of extActions) {
      if (eqTerm(ea.id, lowered) || eqTerm(ea.name, lowered)) {
        if (ea.id != null) extIds.add(normTerm(String(ea.id)).toLowerCase());
      }
    }
    return { term, lowered, ids, nameTypes, extIds };
  });
}

/**
 * One term match on a row (GP-B5 DS-42 — declared where produced, A-7):
 * kind = "object" | "field" | "connection"; field matches carry how /
 * candidate, connection matches carry quality ("exact" | "type-level").
 * @typedef {{kind: string, term: *, quality?: string, how?: string, candidate?: string}} MatchHit
 */

// One row's external-action ref vs one expanded term → null | {term, quality}.
// Exact only: a callout records the specific configId, so there is no
// type-level analogue here.
export function matchExtAction(ea, expandedTerm) {
  if (!ea) return null;
  const id = ea.id != null ? normTerm(String(ea.id)).toLowerCase() : null; // NFC fold (F-148)
  if (id && (id === expandedTerm.lowered || expandedTerm.extIds?.has(id))) return { term: expandedTerm.term, quality: "exact" };
  if (eqTerm(ea.name, expandedTerm.lowered)) return { term: expandedTerm.term, quality: "exact" };
  return null;
}

// One row's connection ref vs one expanded term → null | {term, quality}.
// quality: "exact" (id/name/direct-type equality) or "type-level" (the term
// named a specific connection; the asset recorded only that connection's
// type). Internal types are never matched via type-level expansion.
export function matchConnection(conn, expandedTerm) {
  if (!conn) return null;
  const id = conn.id != null ? normTerm(String(conn.id)).toLowerCase() : null; // NFC fold (F-148)
  if (id && (id === expandedTerm.lowered || expandedTerm.ids.has(id))) return { term: expandedTerm.term, quality: "exact" };
  if (eqTerm(conn.name, expandedTerm.lowered)) return { term: expandedTerm.term, quality: "exact" };
  const type = conn.type != null ? normTerm(String(conn.type)).toUpperCase() : null; // NFC fold (F-148)
  if (type && eqTerm(type, expandedTerm.lowered)) return { term: expandedTerm.term, quality: "exact" };
  if (type && !INTERNAL_CONNECTIONS.has(type) && expandedTerm.nameTypes.has(type.toLowerCase()))
    return { term: expandedTerm.term, quality: "type-level" };
  return null;
}

// One generic row vs all terms → matches [{kind, term, quality?, how?,
// candidate?}]. Object terms match objectName OR objectLabel; field terms
// match fieldName OR fieldLabel OR any altFields entry (aliases,
// custom-mapping strings) — via the shared alias-aware primitive, so an
// aliasPrefix (compiled, or null) widens field matching identically in both
// skills; field matches carry how/candidate for the match column.
export function matchRow(r, { objectTerms = [], fieldTerms = [], connTerms = [], aliasPrefix = null }) {
  /** @type {MatchHit[]} */
  const matches = [];
  for (const t of objectTerms)
    if (eqTerm(r.objectName, t.lowered) || eqTerm(r.objectLabel, t.lowered)) {
      matches.push({ kind: "object", term: t.term });
      break;
    }
  outer: for (const t of fieldTerms)
    for (const value of fieldCandidates(r)) {
      const m = fieldTermMatch(value, t, aliasPrefix);
      if (m) {
        matches.push({ kind: "field", term: t.term, how: m.how, candidate: String(value).trim() });
        break outer;
      }
    }
  for (const t of connTerms) {
    // A callout row carries both refs — the connection it calls through AND
    // the External Action it calls (F-217); a term naming either matches.
    const m = matchConnection(r.connection, t) ?? matchExtAction(r.extAction, t);
    if (m) {
      matches.push({ kind: "connection", ...m });
      break;
    }
  }
  return matches;
}

// This row's field-match candidate surface — matchRow's field loop and the
// near-miss collection must always look at the same values.
export const fieldCandidates = (r) => [r.fieldName, r.fieldLabel, ...r.altFields];

// ── main ─────────────────────────────────────────────────────────────────────

// Live dm-deps-check ingestion is the shared jo-report-deps.mjs primitive
// (parseLiveDepsAreas) — one copy of the payload anatomy for the JO mode and
// this scan.

// ONE table drives the whole dependent-domain surface: scan order, section
// titles, per-domain CSV names, counts, and caveats all iterate its keys — a
// domain added here appears everywhere, and a key missing anywhere is
// impossible. `journeyDoc: true` marks the one domain whose docs go through
// parseJourneyDoc (single parse; stubs are not payload failures) instead of
// the generic fence-JSON extractor.
const DOMAIN_TABLE = {
  rules: { dir: DOMAINS.rules, title: "Rules Engine", csv: "tenant-deps-rules.csv", extract: extractRuleUsages },
  journeys: { dir: DOMAINS.journeys, title: "Journey programs", csv: "tenant-deps-journeys.csv", journeyDoc: true },
  reports: { dir: DOMAINS.reports, title: "Reports", csv: "tenant-deps-reports.csv", extract: extractReportUsages },
  jobs: { dir: DOMAINS.jobs, title: "Connector jobs", csv: "tenant-deps-connector-jobs.csv", extract: extractJobUsages },
  designers: { dir: DOMAINS.designers, title: "Data designers", csv: "tenant-deps-data-designers.csv", extract: extractDesignerUsages },
  datasets: { dir: DOMAINS.datasets, title: "Journey datasets (journey-data-designer)", csv: "tenant-deps-journey-datasets.csv", extract: extractDatasetUsages },
};

// shq/sq are the doc-lib copies (F-123) — one escape rule for the plugin.
const USAGE =
  "usage: tenant-deps.mjs --kb <slugDir> [--object <o>]... [--field <f>]... [--connection <c>]... " +
  "[--terms-file <terms.json>] " +
  "[--alias-prefix <regex>] [--live-deps <deps-check.json>]... --report <dir> [--csv-dir <dir>] " +
  "(at least one term, inline or from --terms-file)";

export async function run(argv) {
  // Diagnostics name THIS script (F-306): fail is minted here with
  // tenant-deps.mjs's own name — doc-lib's makeCliHelpers is the one
  // implementation — never borrowed from jo-report.mjs, whose instance
  // prefixes its own name.
  const { fail } = makeCliHelpers("tenant-deps.mjs", argv);
  let flags;
  try {
    flags = parseFlags(argv, { repeatable: ["object", "field", "connection", "live-deps"], boolean: [] });
  } catch (e) {
    fail(`${e.message}\n${USAGE}`);
  }
  const rawObjects = [...(flags.object ?? [])];
  const rawFields = [...(flags.field ?? [])];
  const rawConns = [...(flags.connection ?? [])];
  // --terms-file (GP-B5 DS-28; F-162 lineage — a skill's on-disk work list is
  // shell-neutral, so a multi-term request never rides argv quoting): a JSON
  // object { "objects"?: [...], "fields"?: [...], "connections"?: [...] } of
  // term strings, read BOM-tolerantly (readJsonFile — PS 5.1 Out-File writes
  // a BOM). File terms merge with any inline flags; the dedupe below folds
  // overlaps. Validation is loud (A-4): an unknown key (e.g. the singular
  // "connection") or a non-string entry refuses the WHOLE file — a typo'd
  // kind silently dropped would be a confidently narrower report.
  if (flags["terms-file"] != null) {
    let parsed;
    try {
      parsed = readJsonFile(flags["terms-file"]);
    } catch (e) {
      fail(`--terms-file ${flags["terms-file"]}: cannot parse (${e.message})`);
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
      fail(`--terms-file must contain a JSON object { "objects"?: [...], "fields"?: [...], "connections"?: [...] } — nothing was scanned`);
    const buckets = { objects: rawObjects, fields: rawFields, connections: rawConns };
    for (const key of Object.keys(parsed)) {
      if (!Object.hasOwn(buckets, key))
        fail(`--terms-file: unknown key "${key}" — allowed keys: objects, fields, connections (each a JSON array of term strings); nothing was scanned`);
      if (!Array.isArray(parsed[key]) || !parsed[key].every((t) => typeof t === "string"))
        fail(`--terms-file: "${key}" must be a JSON array of term strings; nothing was scanned`);
      buckets[key].push(...parsed[key]);
    }
  }
  if (!flags.kb || !flags.report || (!rawObjects.length && !rawFields.length && !rawConns.length)) fail(USAGE);
  if ([...rawObjects, ...rawFields, ...rawConns].some((t) => !String(t).trim()))
    fail("--object/--field/--connection terms must be non-empty (inline or in --terms-file)");
  // A --kb that does not exist REFUSES before any work (F-310; doc-lib's
  // requireKbDir — the one gate jo-report deps mode already ran). This
  // surface used to accept it and write a report claiming zero dependents
  // — for impact analysis, the answer that gets a field dropped.
  requireKbDir(flags.kb, fail);
  // Fail-fast (F-321): an invalid EXPLICIT --alias-prefix refuses before any
  // KB doc reads — the same contract as jo-report deps mode (where the cost
  // was a full index load; here it is the registry doc loops). No heavy
  // observable precedes the old site on this surface, so this arm is pinned
  // by the shared compileAliasPrefix and the jo-report-side order test.
  if (flags["alias-prefix"] != null) {
    try {
      compileAliasPrefix(flags["alias-prefix"]);
    } catch (e) {
      fail(String(e.message));
    }
  }
  const warnings = [];
  const dedupe = (list) => {
    const seen = new Set();
    return list.filter((t) => {
      const k = normTerm(String(t)).trim().toLowerCase(); // NFC fold (F-127) — NFD/NFC spellings are the same term
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };
  const objectTermsRaw = dedupe(rawObjects);
  const fieldTermsRaw = dedupe(rawFields);
  const connTermsRaw = dedupe(rawConns);
  const dups = rawObjects.length + rawFields.length + rawConns.length - objectTermsRaw.length - fieldTermsRaw.length - connTermsRaw.length;
  if (dups) warnings.push(`${dups} duplicate term(s) dropped`);
  for (const t of connTermsRaw)
    if (INTERNAL_CONNECTIONS.has(normTerm(t).trim().toUpperCase())) // NFC fold (F-148) — uniform with every other compare path
      warnings.push(`--connection ${t}: internal platform reference (Gainsight data store/API), not an external connection — matching anyway`);

  const kbDir = resolve(flags.kb);

  // tenant identity from the KB manifest (ER-2 fallback rule) — ONE copy for
  // both deps surfaces (doc-lib readKbIdentity — GP-B5 W10, F-361: this and
  // jo-report's buildIndex had drifted by a word and by the inventory guard;
  // the stricter guard won, so a non-object `inventory` reads as {} here too).
  const { slug, baseUrl, environment, inventory } = readKbIdentity(kbDir, warnings);

  // KB folder per lane, resolved from the manifest (F-429). A lane's identity
  // is the list command that produced its docs; its FOLDER NAME is
  // per-workspace data (`connections` on one workspace built by this plugin,
  // `connectors` on another — likewise `connector-jobs`/`connectors-jobs`,
  // `report-reports`/`report`). Before this, DOMAINS' default names were the
  // lookup, and three lanes read 0 docs on the first workspace with no
  // caveat: the registry-honesty caveats fire on docs-that-did-not-parse,
  // never on a folder that was never opened. Resolution: the manifest's
  // domains_indexed[<name>].listCommand → canonical catalog path (doc-lib
  // recordedDomainsByPath, the same table domain-candidates' diff reads) →
  // the lane whose LIST_PATH matches. No recording → the default name, as
  // before (a domain never indexed has nothing to read). No catalog → the
  // defaults, said out loud. The resolution is reported in the JSON
  // (domainDirs / domainDirBasis); its warnings — a lane read from a
  // non-default folder, an ambiguity that left a domain unscanned, a
  // no-catalog fallback — ride `warnings`, which the write-outputs block below
  // folds into the caveats, so the markdown report and the caveats CSV carry
  // them too (F-429 second pass: the first pass left them on stdout only).
  const { laneDirs, laneBasis } = resolveLaneDirs(kbDir, warnings);
  for (const k of Object.keys(DOMAIN_TABLE)) DOMAIN_TABLE[k].dir = laneDirs[k];

  // KB doc readers (relationships-build return contracts). The fence-parse
  // guard and KbDocMeta resolution are doc-lib's parseDocJson/docMeta
  // (GP-B5 DS-24 — the copies this file and relationships-build hand-synced
  // are collapsed); docs-vs-parsed honesty stats stay HERE (A-3/F-228).
  const listDocs = (domain) => listMdFiles(join(kbDir, domain)) ?? [];
  const docText = (path) => normalizeText(readFileSync(path, "utf8"));

  // connection registry (+ matched connection assets)
  const registry = [];
  const connStats = { docs: 0, parsed: 0 };
  for (const path of listDocs(laneDirs.connections)) {
    connStats.docs++;
    const payload = parseDocJson(docText(path));
    if (!payload) continue;
    const c = extractConnection(payload);
    if (!c) continue;
    connStats.parsed++;
    registry.push(c);
  }

  // external-action registry (F-217) — resolves configId ↔ name so an
  // External Action can be named as a --connection term the way a connection
  // can. The domain may be absent on tenants that never adopted it; an empty
  // registry just means callout ids render unresolved.
  const extRegistry = [];
  const extStats = { docs: 0, parsed: 0 };
  for (const path of listDocs(laneDirs.extActions)) {
    extStats.docs++;
    const payload = parseDocJson(docText(path));
    if (!payload) continue;
    const ea = extractExternalAction(payload);
    if (!ea) continue;
    extStats.parsed++;
    extRegistry.push(ea);
  }
  const extNameById = new Map(extRegistry.filter((ea) => ea.id != null).map((ea) => [String(ea.id), ea.name]));
  const connNameById = new Map(registry.filter((c) => c.id != null).map((c) => [String(c.id), c.name]));

  // Alias pattern in force (ER-22/ER-23; DS-27): explicit --alias-prefix wins
  // — an invalid EXPLICIT regex fails loudly, never degrades silently —
  // otherwise the workspace conventions read (jo-report-deps
  // readAliasConvention, walking up from the KB dir; malformed → exact-only,
  // surfaced, never guessed).
  let aliasRes = null;
  try {
    aliasRes = resolveAliasPrefix({ explicit: flags["alias-prefix"], hasFieldTerms: fieldTermsRaw.length > 0, kbDir });
  } catch (e) {
    fail(`${e.message}\n${USAGE}`);
  }
  const aliasPrefix = aliasRes.prefix;
  if (aliasRes.note) warnings.push(aliasRes.note);
  if (aliasPrefix && !fieldTermsRaw.length)
    warnings.push("--alias-prefix has no effect without --field terms (aliasing applies to field matching only)");

  const mk = (list) => list.map((term) => ({ term, lowered: normTerm(term).trim().toLowerCase() })); // NFC fold (F-148)
  const terms = {
    objectTerms: mk(objectTermsRaw),
    fieldTerms: fieldTermsRaw.map(prepFieldTerm),
    connTerms: expandConnectionTerms(connTermsRaw, registry, extRegistry),
    aliasPrefix,
  };
  const matchedConnections = registry.filter((c) =>
    terms.connTerms.some((t) => matchConnection({ id: c.id, name: c.name, type: c.type }, t)?.quality === "exact")
  );
  const matchedExtActions = extRegistry.filter((ea) => terms.connTerms.some((t) => matchExtAction(ea, t)));
  // type-level ambiguity: a name/id term whose type has >1 registry connection
  const typeAmbiguity = [];
  for (const t of terms.connTerms) {
    for (const type of t.nameTypes) {
      const sameType = registry.filter((c) => normTerm(String(c.type ?? "")).toLowerCase() === type); // NFC fold (F-148)
      if (sameType.length > 1) typeAmbiguity.push({ term: t.term, type: type.toUpperCase(), count: sameType.length });
    }
  }

  // ── scan the dependent domains ─────────────────────────────────────────────
  const results = {}; // domainKey → { assets: [{asset, rows(matched, with .matches)}], stats }
  // near-misses (alias mode only): term → Set of NON-matching field names that
  // contain the term's words — a not-counted caveat, never rows
  const nearMissByTerm = new Map();
  for (const [domainKey, spec] of Object.entries(DOMAIN_TABLE)) {
    // yielding / blindFieldRows (F-343, A-3 yield honesty): how
    // many PARSED docs produced at least one usage row BEFORE term matching.
    // A domain whose parsed docs all yield nothing is the signature of a
    // reader that no longer understands the payload shape (F-342/F-343 were
    // exactly that) — it must surface as a caveat, never as a confident zero.
    const stats = { docs: 0, parsed: 0, stubs: 0, yielding: 0, blindFieldRows: 0, /** @type {Record<string, number>} */ blindByReason: {}, matchedAssets: 0, rows: 0 };
    const assets = [];
    for (const path of listDocs(spec.dir)) {
      stats.docs++;
      const text = docText(path);
      let out;
      if (spec.journeyDoc) {
        // journeys parse ONCE through the shared JO parser — parseDocJson would be
        // a discarded second JSON.parse of the largest-payload domain. A stub
        // is not a payload failure (its own caveat below); only a doc with
        // parse errors counts against `parsed`.
        const { entry, parseErrors } = parseJourneyDoc(text, path);
        if (entry.depth !== "full") {
          if (!parseErrors.length) stats.stubs++;
          continue;
        }
        stats.parsed++;
        out = {
          asset: { id: entry.id, name: entry.name, status: entry.status ? `${entry.status} (kb)` : null },
          rows: journeyUsageRows(entry),
        };
      } else {
        const payload = parseDocJson(text);
        if (!payload) continue;
        stats.parsed++;
        out = spec.extract(payload);
        // Callout/action-step rows come out of the extractor with bare GUIDs
        // — resolve display names from the two registries (F-217; the
        // connectionId-only rows joined at F-229). Matching never depends on
        // this; an unresolved id renders as-is. The human-facing detail is
        // RE-RENDERED once from the row's structured parts (stepCount,
        // extAction) after resolution (F-230) — the old String.replace
        // recomposition expanded GetSubstitution $-patterns in KB action
        // names into corrupted prose, and went silently no-op whenever
        // either side's wording drifted.
        if (domainKey === "rules")
          for (const r of out.rows) {
            if (r.usage !== "external action callout" && r.usage !== "action-step connection reference") continue;
            if (r.extAction && r.extAction.name == null) {
              const nm = extNameById.get(String(r.extAction.id));
              if (nm != null) r.extAction.name = nm;
            }
            if (r.connection && r.connection.name == null && r.connection.id != null)
              r.connection.name = connNameById.get(String(r.connection.id)) ?? null;
            if (r.extAction && typeof r.stepCount === "number") {
              r.detail =
                `${r.stepCount} action step(s) calling external action ` +
                (r.extAction.name != null ? `"${r.extAction.name}" (${r.extAction.id})` : `${r.extAction.id}`);
            }
          }
      }
      if (out.rows.length) stats.yielding++;
      for (const r of out.rows) {
        if (r.fieldNamesUnavailable !== true) continue;
        stats.blindFieldRows++;
        const why = r.fieldNamesReason ?? "(unstated)"; // never guessed — an unstated reason lands in the "other" bucket
        stats.blindByReason[why] = (stats.blindByReason[why] ?? 0) + 1;
      }
      const matched = [];
      for (const r of out.rows) {
        const matches = matchRow(r, terms);
        if (matches.length) matched.push({ ...r, matches });
        // near-miss gate is on the FIELD terms not matching — a row that
        // matched an --object/--connection term still surfaces its field
        // near-misses (same rule as the JO deps mode's scanDeps)
        if (aliasPrefix && terms.fieldTerms.length && !matches.some((m) => m.kind === "field"))
          addNearMisses(nearMissByTerm, fieldCandidates(r), terms.fieldTerms);
      }
      if (matched.length) {
        // id/name fallbacks come from the doc bullets — resolved only for
        // matched docs (topBullets re-splits the whole text; most docs match
        // nothing on a tenant-wide scan)
        const meta = docMeta(text);
        const asset = {
          domain: domainKey,
          id: out.asset.id ?? meta.id,
          name: out.asset.name ?? meta.name ?? "(unnamed)",
          status: out.asset.status,
          docPath: path,
        };
        stats.matchedAssets++;
        stats.rows += matched.length;
        assets.push({ asset, rows: matched, scorecardRefs: out.scorecardRefs });
      }
    }
    assets.sort(
      (a, b) =>
        cmpName(a.asset.name, b.asset.name) || cmpKey(a.asset.id, b.asset.id) // pinned locale (F-128)
    );
    results[domainKey] = { assets, stats };
  }

  // journey stub accounting for the caveat (scanDomain can't see why a doc was skipped)
  let journeyStubs = 0;
  for (const [key, e] of Object.entries(inventory))
    if ((e.domain ?? key.split("/")[0]) === laneDirs.journeys && e.depth === "metadata") journeyStubs++;

  // ── scorecard linkage for matched rules ────────────────────────────────────
  const measures = { measureName: {}, measureCard: {}, measureGroup: {} };
  const scorecardNames = {}; // scorecard doc id → display name (relationships-build precedent)
  const scStats = { docs: 0, parsed: 0 };
  for (const path of listDocs(laneDirs.scorecards)) {
    scStats.docs++;
    const text = docText(path);
    const meta = docMeta(text);
    const cardName = meta.name ?? meta.id ?? "(unnamed scorecard)";
    if (meta.id) scorecardNames[meta.id] = cardName;
    const payload = parseDocJson(text);
    if (!payload) continue;
    scStats.parsed++;
    collectScorecardMeasures(payload, cardName, measures);
  }
  const scorecardRows = []; // { scorecard, measure, group, rule, ruleId, resolved }
  // per-dependent live-verdict lookups: every scorecard id/name a MATCHED rule scores
  const matchedScorecardIds = new Set();
  const matchedScorecardNames = new Set();
  for (const { asset, scorecardRefs } of results.rules.assets) {
    if (!scorecardRefs) continue;
    const ruleCards = new Set(); // scorecard names this rule already surfaced via a measure row
    for (const mid of scorecardRefs.measureIds) {
      const name = measures.measureName[mid];
      const card = measures.measureCard[mid] ?? "(unresolved scorecard)";
      ruleCards.add(card);
      matchedScorecardNames.add(card);
      scorecardRows.push({
        scorecard: card,
        measure: name ?? `\`${mid}\` (unresolved)`,
        group: measures.measureGroup[mid] ?? "",
        rule: asset.name,
        ruleId: asset.id,
        resolved: Boolean(name),
      });
    }
    // scorecard-level refs (tgtField "scorecard" — a grade set with no measure
    // mapping): surface the card itself when no measure row already names it
    // for this rule, or the edge is invisible in an impact report.
    for (const scId of scorecardRefs.scorecardIds) {
      matchedScorecardIds.add(scId);
      const card = scorecardNames[scId];
      if (card) matchedScorecardNames.add(card);
      if (card && ruleCards.has(card)) continue;
      scorecardRows.push({
        scorecard: card ?? `\`${scId}\` (unresolved)`,
        measure: "(scorecard-level)",
        group: "",
        rule: asset.name,
        ruleId: asset.id,
        resolved: Boolean(card),
      });
    }
  }
  // Pairwise, never a joined composite (F-144): collation treats a NUL
  // delimiter as completely ignorable, so a joined key gave the sort
  // nothing to separate the fields with.
  scorecardRows.sort((a, b) => cmpKey(a.scorecard, b.scorecard) || cmpKey(a.measure, b.measure)); // pinned locale (F-128)

  // ── live dm-deps-check payloads ────────────────────────────────────────────
  const matchedIds = {};
  for (const [domainKey, r] of Object.entries(results))
    matchedIds[domainKey] = new Set(r.assets.map((a) => String(a.asset.id)));
  // Intake loop (warn-and-skip contract) is the shared readLiveDepsCaptures
  // (F-311); this surface parameterizes the all-areas parser and its eqTerm
  // compare (NFC fold both sides, F-148) and consumes the parsed captures
  // directly.
  const liveDeps = readLiveDepsCaptures(
    flags["live-deps"],
    { parse: parseLiveDepsAreas, matchesObjectTerm: (name) => terms.objectTerms.some((t) => eqTerm(name, t.lowered)) },
    warnings
  );

  // ── freshness from the manifest inventory ──────────────────────────────────
  const scannedDomains = new Set(Object.values(DOMAINS));
  const verifiedDates = [];
  for (const [key, e] of Object.entries(inventory)) {
    if (!scannedDomains.has(e.domain ?? key.split("/")[0])) continue;
    if (e.last_verified) verifiedDates.push(String(e.last_verified));
  }
  verifiedDates.sort();
  const freshness = verifiedDates.length
    ? `all data KB-cached; KB last_verified ${verifiedDates[0].slice(0, 10)} → ${verifiedDates[verifiedDates.length - 1].slice(0, 10)}`
    : "all data KB-cached; capture dates unknown (no manifest inventory)";

  // ── report assembly ────────────────────────────────────────────────────────
  const termLine = [
    ...terms.objectTerms.map((t) => `object \`${t.term}\``),
    ...terms.fieldTerms.map((t) => `field \`${t.term}\``),
    ...terms.connTerms.map((t) => `connection \`${t.term}\``),
  ].join(", ");

  const domainKeys = Object.keys(DOMAIN_TABLE);
  // "docs yielding usages" = parsed docs the extractor got ≥1 row out of, before
  // any term matching (F-343 yield honesty): a low or zero number here is a
  // reader/shape problem, not a tenant fact.
  const rollup = mdTable(
    ["domain", "docs scanned", "docs yielding usages", "matching assets", "usage rows"],
    domainKeys.map((k) => [
      DOMAIN_TABLE[k].title,
      `${results[k].stats.parsed}/${results[k].stats.docs}`,
      `${results[k].stats.yielding}/${results[k].stats.parsed}`,
      results[k].stats.matchedAssets,
      results[k].stats.rows,
    ])
  );
  // Header names the matching semantics in force — the exact alias pattern
  // when one is active, or that none was supplied (ER-23 degrade honesty;
  // shared wording with the JO deps mode).
  const matchingLine = aliasMatchingLine(aliasRes, terms.fieldTerms.length > 0);
  const summarySection = [
    "## Summary",
    "",
    `- terms: ${termLine} — ${matchingLine}`,
    `- scope: ALL documented assets regardless of status (impact analysis never narrows silently)`,
    matchedConnections.length
      ? `- connections resolved: ${matchedConnections.map((c) => `${c.name ?? c.id} (${c.type ?? "?"}${c.status ? `, ${c.status}` : ""})`).join("; ")}`
      : null,
    matchedExtActions.length
      ? `- external actions resolved: ${matchedExtActions.map((ea) => `${ea.name ?? ea.id}`).join("; ")}`
      : null,
    "",
    rollup,
  ]
    .filter((l) => l !== null)
    .join("\n");
  const sections = [summarySection];

  const connCell = (r) => {
    if (!r.connection) return "—";
    const c = r.connection;
    const label = c.name ?? c.id ?? c.type ?? "—";
    return c.type && label !== c.type ? `${label} (${c.type})` : label;
  };
  const matchCell = (r) =>
    r.matches
      .map(
        (m) =>
          `${m.kind} \`${m.term}\`` +
          (m.quality === "type-level" ? " (type-level)" : "") +
          (m.how && m.how !== "exact" ? ` (${matchHowLabel(m.how, m.candidate)})` : "")
      )
      .join("; ");
  const fieldCell = (r) =>
    r.fieldLabel && r.fieldLabel !== r.fieldName ? `${r.fieldName ?? "—"} ("${r.fieldLabel}")` : r.fieldName ?? "—";
  const objCell = (r) =>
    r.objectLabel && r.objectLabel !== r.objectName ? `${r.objectName ?? "—"} ("${r.objectLabel}")` : r.objectName ?? "—";

  for (const k of domainKeys) {
    const { assets, stats } = results[k];
    const title = `## ${DOMAIN_TABLE[k].title} — ${stats.matchedAssets} matching asset(s)`;
    if (!assets.length) {
      sections.push(`${title}\n\n_no matches in ${stats.parsed} scanned doc(s)_`);
      continue;
    }
    sections.push(
      [
        title,
        "",
        mdTable(
          ["asset", "status", "usage", "object", "field", "connection", "matched", "detail"],
          assets.flatMap(({ asset, rows: rs }) =>
            rs.map((r) => [
              `${asset.name} (${asset.id ?? "id unknown"})`,
              asset.status ?? "—",
              r.usage,
              objCell(r),
              fieldCell(r),
              connCell(r),
              matchCell(r),
              r.detail,
            ])
          )
        ),
      ].join("\n")
    );
  }

  if (matchedConnections.length)
    sections.push(
      [
        `## Connections — ${matchedConnections.length} matching connection asset(s)`,
        "",
        mdTable(
          ["connection", "id", "type", "status", "auth"],
          matchedConnections.map((c) => [c.name ?? "—", c.id ?? "—", c.type ?? "—", c.status ?? "—", c.auth ?? "—"])
        ),
      ].join("\n")
    );

  if (matchedExtActions.length)
    sections.push(
      [
        `## External actions — ${matchedExtActions.length} matching external action asset(s)`,
        "",
        "Rules reach these via External Action callout steps; the rules calling each are in the Rules Engine section above (usage `external action callout`).",
        "",
        mdTable(
          ["external action", "id (configId)", "calls through connection"],
          matchedExtActions.map((ea) => {
            const cn = ea.connectionId != null ? connNameById.get(String(ea.connectionId)) : null;
            return [ea.name ?? "—", ea.id ?? "—", ea.connectionId ? (cn ? `${cn} (${ea.connectionId})` : ea.connectionId) : "—"];
          })
        ),
      ].join("\n")
    );

  sections.push(
    scorecardRows.length
      ? [
          `## Scorecards — scored by matching rules (SET_SCOREV2)`,
          "",
          "Scorecards have no object/field reads of their own; these edges show which scorecard measures the MATCHING rules above set — the downstream blast radius of a schema change feeding those rules.",
          "",
          mdTable(
            ["scorecard", "measure", "group", "set by rule"],
            scorecardRows.map((s) => [s.scorecard, s.measure, s.group || "—", `${s.rule} (${s.ruleId ?? "id unknown"})`])
          ),
        ].join("\n")
      : "## Scorecards — scored by matching rules (SET_SCOREV2)\n\n_no matching rule carries scoring actions_"
  );

  for (const live of liveDeps) {
    const lines = [
      `## Live dependents of \`${live.objectName ?? "(unknown object)"}\` (dm deps check)`,
      "",
      "Gainsight's own dependency scan — object-level truth across ALL areas, including ones this KB scan does not cover.",
      "",
    ];
    if (!live.complete)
      lines.push("**⚠ capture incomplete** — the check's progressStatus was not COMPLETED; this list may be partial. Re-capture and re-run.", "");
    const areaRows = [];
    for (const [area, deps] of Object.entries(live.areas)) {
      const domainKey = AREA_DOMAIN[area] ?? null;
      for (const dep of deps) {
        let verdict = "area not scanned by this tool";
        if (domainKey === "scorecards")
          // per-dependent: THIS scorecard must be one a matching rule scores —
          // a coarse any-scoring-rule check would mark unrelated scorecards covered
          verdict =
            (dep.id != null && matchedScorecardIds.has(dep.id)) || (dep.name != null && matchedScorecardNames.has(dep.name))
              ? "yes — see the scorecard section"
              : "no — not set by any matching scoring rule";
        else if (domainKey && matchedIds[domainKey])
          // the matchedIds guard keeps an AREA_DOMAIN value that drifts from
          // DOMAIN_TABLE's keys reading as unscanned, never as a false "no"
          verdict =
            dep.id != null && matchedIds[domainKey].has(String(dep.id))
              ? "yes"
              : "no — usage kind not visible in KB docs, or asset not documented";
        areaRows.push([area, `${dep.name ?? "(unnamed)"} (${dep.id ?? "id unknown"})`, verdict, dep.columns.join(", ") || "—"]);
      }
    }
    lines.push(areaRows.length ? mdTable(["area", "dependent", "in KB report above?", "referenced columns"], areaRows) : "_no dependents reported live_");
    sections.push(lines.join("\n"));
  }

  // ── caveats ────────────────────────────────────────────────────────────────
  const caveats = [];
  for (const k of domainKeys) {
    const { stats } = results[k];
    // journey stubs are not payload failures — they carry their own caveat below
    const miss = stats.docs - stats.parsed - stats.stubs;
    if (miss > 0)
      caveats.push(`${DOMAIN_TABLE[k].title}: ${miss} of ${stats.docs} doc(s) had no parseable describe payload — their usage is invisible to this scan.`);
    // Yield honesty (F-343, the F-228 pattern one layer up): every doc PARSED
    // but the extractor found a usage in NONE of them. A parsed-but-yieldless
    // domain is the signature of a payload whose shape this reader no longer
    // understands — a describe-output change between CLI pins (F-342 was the
    // envelope, F-343 the task rows) — never proof that nothing depends on
    // the term. Fires on the all-zero signature only: one empty asset among
    // yielding ones is ordinary.
    if (stats.parsed > 0 && stats.yielding === 0)
      caveats.push(
        `${DOMAIN_TABLE[k].title}: ALL ${stats.parsed} parsed doc(s) yielded ZERO usage rows before any term matching — ` +
          `the payload shape is probably not the one this reader expects (a CLI describe-output change between pins; F-342/F-343 were exactly this). ` +
          `${DOMAIN_TABLE[k].title} dependencies are NOT proven absent by this scan — inspect one doc's fenced payload against the extractor before trusting the zero.`
      );
  }
  // Designer rows without a system field name (F-343 summary shape; W9
  // composite items whose detail is missing): a --field term spelled as a
  // system name cannot match them. Say which rows are blind AND WHY (the
  // reason vocabulary is DESIGNER_BLIND_REASONS) instead of letting a zero
  // under --field read as "no designer uses it". Label spellings still match
  // wherever a label is on the row.
  if (results.designers.stats.blindFieldRows > 0 && terms.fieldTerms.length) {
    const by = results.designers.stats.blindByReason;
    // Rendered from the OBSERVED keys, in the table's order, with anything
    // outside the table in an explicit "other" bucket — the parts always sum
    // to the total (W9 review round).
    const known = Object.keys(DESIGNER_BLIND_REASONS).filter((k) => by[k]);
    const other = Object.entries(by).filter(([k]) => !Object.hasOwn(DESIGNER_BLIND_REASONS, k)).reduce((a, [, n]) => a + n, 0);
    const breakdown = [
      ...known.map((k) => `${by[k]} from ${DESIGNER_BLIND_REASONS[k].caveat}`),
      ...(other ? [`${other} for an unlisted reason (a reader bug — report it)`] : []),
    ].join("; ");
    caveats.push(
      `Data designers: ${results.designers.stats.blindFieldRows} row(s) carry no system field name — ${breakdown} — ` +
        `a --field term spelled as a system name cannot match those rows (a label spelling still matches where the row carries one); ` +
        `source-object and connection-type rows still match --object / --connection terms.`
    );
  }
  if (journeyStubs > 0)
    caveats.push(`${journeyStubs} journey doc(s) are metadata-only stubs — participant sources unknown, not scannable.`);
  caveats.push(
    "All statuses and payloads are KB-cached (see the freshness line) — nothing here was fetched live; re-crawl stale domains before acting on status columns."
  );
  // ER-22/ER-23 honesty pair — shared wording (aliasFieldCaveats) with the JO
  // deps mode, so the two reports can never drift on what they disclaim
  caveats.push(
    ...aliasFieldCaveats({
      hasFieldTerms: terms.fieldTerms.length > 0,
      aliasActive: Boolean(aliasPrefix),
      nearMisses: [...nearMissByTerm.entries()].map(([term, names]) => ({ term, names: [...names].sort() })),
      conventionNote: aliasRes.note,
      unsetWhy: aliasRes.unsetWhy,
    })
  );
  if (terms.objectTerms.length)
    caveats.push(
      "JO participant-source mapping rows carry no object names (C1 fact, inherited from the deps mode) — a journey using a matched object only via mappings shows under --field terms or in the live section, never under --object."
    );
  if (results.datasets.stats.matchedAssets > 0)
    caveats.push(
      "Journey-dataset docs carry no source lineage — a dataset hit means the dataset EXPOSES that object/field, not that the field originates there."
    );
  // Registry parse honesty (F-228): a registry domain whose docs ALL fail to
  // parse must never be silent — External Action names would not resolve, a
  // name/configId --connection term would find nothing, and callout
  // configIds would render unresolved: an F-217-shaped confident miss.
  // docs>0 && parsed===0 is the all-unparseable signature (stub-shaped docs
  // parse since F-228, so an unknown future payload shape is the likely
  // cause).
  // The three registry lanes are ONE table (gate-3 review round, F-349): the
  // DS-24 round added this guard for connectors and left scorecards — the
  // third lane with the identical {docs, parsed} pair — silent, so a
  // scorecard domain whose docs all fail to parse rendered every measure
  // unresolved with no caveat. A lane added here gets the caveat by
  // construction; a lane's stats pair computed anywhere else is the defect.
  // Two signatures per lane (F-388): ALL docs unparsed (docs>0 && parsed===0
  // — a workspace whose CLI emitted a shape this reader never knew), and the
  // PARTIAL shortfall (0 < parsed < docs — a long-lived KB re-captured after
  // a CLI upgrade: the old-shape docs still parse, so the registry is
  // non-empty and the missing entries would otherwise be a SILENT miss; the
  // F-388 probe measured exactly that — a flat `cn list` doc beside nested
  // ones matched nothing and no caveat fired). Both name the remedy. The same
  // table feeds the summary JSON's per-lane docs/unparsed counts, and the
  // caveats CSV carries every caveat, so the markdown, JSON and CSV/XLSX
  // surfaces cannot disagree on a shortfall (consumer-parity).
  /** @type {ReadonlyArray<{stats: {docs: number, parsed: number}, dir: string, key: string, entry: string, consequence: string, noun: string}>} */
  const REGISTRY_LANES = [
    { stats: extStats, dir: laneDirs.extActions, key: "externalActions", entry: "External Action", consequence: "External Action names cannot be resolved, a --connection term naming one cannot match, and callout configIds render unresolved", noun: "External Actions" },
    { stats: connStats, dir: laneDirs.connections, key: "connections", entry: "connection", consequence: "connection names cannot be expanded to ids or types, a --connection name term cannot match, and connection ids render unresolved", noun: "connections" },
    { stats: scStats, dir: laneDirs.scorecards, key: "scorecards", entry: "scorecard", consequence: "measure names cannot be resolved, so every scorecard row a matched rule scores renders `(unresolved)`", noun: "scorecards" },
  ];
  const registryRemedy = (dir) => `Re-capture the ${dir} domain with the installed CLI (a doc's row shape follows the CLI version that captured it), or inspect a doc's payload shape`;
  for (const { stats, dir, entry, consequence, noun } of REGISTRY_LANES) {
    if (stats.docs > 0 && stats.parsed === 0)
      caveats.push(
        `All ${stats.docs} ${dir} doc(s) parsed to 0 registry entries — ${consequence}. ${registryRemedy(dir)} before trusting any zero that involves ${noun}.`
      );
    else if (stats.parsed > 0 && stats.parsed < stats.docs)
      caveats.push(
        `${stats.docs - stats.parsed} of ${stats.docs} ${dir} doc(s) parsed to no ${entry} — those ${noun} are absent from the registry, so for them ${consequence}. ${registryRemedy(dir)}.`
      );
  }
  if (terms.connTerms.length) {
    caveats.push(
      "Rules record only the connection TYPE per fetch task (no connection id); SFDC-sourced reports carry a workspace-style connection id (`SFDC_<org>`), not a KB connector GUID. Rows marked `type-level` mean the asset references the TYPE of the named connection — the specific connection identity is not recorded in the asset."
    );
    // Reference-site honesty (F-217): name what was parsed, so a zero reads
    // as "zero in these sites", never as a tenant fact about sites nobody
    // read. The site list is DERIVED from RULE_CONNECTION_SITES (F-236) —
    // claim and code are one fact, and the fixture suite asserts the
    // table↔extractor correspondence.
    caveats.push(
      `Rule connection references are read from ${RULE_CONNECTION_SITES.length} sites: ` +
        RULE_CONNECTION_SITES.map((s) => s.site).join(", ") +
        ". A connection recorded anywhere else in a rule payload is invisible to this scan."
    );
    for (const a of typeAmbiguity)
      caveats.push(
        `Connection term \`${a.term}\`: the tenant has ${a.count} documented ${a.type} connections — type-level rows for this term may belong to any of them.`
      );
  }
  const objectsTouched = [
    ...new Set(
      domainKeys
        .flatMap((k) => results[k].assets.flatMap((a) => a.rows.map((r) => r.objectName)))
        .filter((o) => o != null && o !== "")
    ),
  ].sort();
  const corroborate = terms.objectTerms.length ? terms.objectTerms.map((t) => t.term) : objectsTouched.slice(0, 5);
  if (corroborate.length)
    caveats.push(
      "KB-derived view — corroborate live and cross-area with " +
        corroborate.map((o) => `\`gs-admin --json dm deps check --name ${sq(o)}\``).join(", ") +
        " (async — re-capture until COMPLETED), then pass each capture back via `--live-deps <file>`."
    );

  // ── write outputs ──────────────────────────────────────────────────────────
  const modeArgs = [
    // Terms are spelled INLINE even for a --terms-file run (deliberate,
    // DS-28): the scratch file may be gone at re-run time, and the deduped
    // inline spelling reproduces the same effective term set either way.
    ...objectTermsRaw.map((t) => `--object ${shq(t)}`),
    ...fieldTermsRaw.map((t) => `--field ${shq(t)}`),
    ...connTermsRaw.map((t) => `--connection ${shq(t)}`),
    // argv-faithful: the flag appears only when the user passed it — a
    // conventions-supplied pattern is re-read from CONVENTIONS.md on re-run
    ...(flags["alias-prefix"] != null ? [`--alias-prefix ${shq(flags["alias-prefix"])}`] : []),
    ...(flags["live-deps"] ?? []).map((f) => `--live-deps ${shq(f)}`),
  ];
  const rerun = [
    "node",
    shq(process.argv[1] ?? "tenant-deps.mjs"),
    `--kb ${shq(flags.kb)}`,
    ...modeArgs,
    `--report ${shq(flags.report)}`,
    flags["csv-dir"] ? `--csv-dir ${shq(flags["csv-dir"])}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  // One caveat when any emitted hint carries the bash apostrophe escape —
  // detection on the emitted text (doc-lib, F-123): rerun line + the
  // corroborate hints already inside caveats + section-embedded hints
  if (needsPosixQuoteCaveat(rerun, sections.join("\n"), caveats.join("\n"))) caveats.push(POSIX_QUOTE_CAVEAT);
  // Run-level warnings LEAD the caveats (F-429 second pass, consumer-parity):
  // `warnings` — the lane → folder resolution and its ambiguities, the
  // duplicate-term drop, the internal-connection and --alias-prefix notes —
  // used to reach the stdout summary only, so the markdown report a reader
  // opens and the caveats CSV the workbook is built from said nothing about a
  // lane read from a non-default folder or a domain left unscanned. One fold,
  // here, after the last `warnings.push` can run: every surface the deps-report
  // skill tells a consumer to read carries the same list (the summary keeps
  // `warnings` as the run-level view; caveatCount counts everything). A
  // warning a caveat already restates verbatim (the alias convention note,
  // which aliasFieldCaveats carries for both deps surfaces) is not doubled.
  caveats.unshift(...warnings.filter((w) => !caveats.includes(w)));

  const md = renderReport({
    mode: "tenant-deps",
    title: "Tenant-wide dependency report",
    slug,
    baseUrl,
    environment,
    generatedAt: nowIso(),
    argsLine: modeArgs.join(" "),
    freshness,
    sections,
    caveats,
    rerun,
  });
  mkdirSync(resolve(flags.report), { recursive: true });
  const outPath = reportPath(flags.report, "tenant-deps");
  writeFileSync(outPath, md, "utf8");

  let csvDir = null;
  if (flags["csv-dir"]) {
    csvDir = resolve(flags["csv-dir"]);
    mkdirSync(csvDir, { recursive: true });
    const HEAD = ["asset_id", "asset_name", "status", "usage_class", "object", "object_label", "field", "field_label", "connection", "connection_type", "matched", "detail"];
    for (const k of domainKeys) {
      if (!results[k].assets.length) continue;
      writeFileSync(
        join(csvDir, DOMAIN_TABLE[k].csv),
        toCsv(
          HEAD,
          results[k].assets.flatMap(({ asset, rows: rs }) =>
            rs.map((r) => [
              asset.id,
              asset.name,
              asset.status,
              r.usage,
              r.objectName,
              r.objectLabel,
              r.fieldName,
              r.fieldLabel,
              r.connection?.name ?? r.connection?.id,
              r.connection?.type,
              r.matches
                .map(
                  (m) =>
                    `${m.kind}:${m.term}` +
                    (m.quality === "type-level" ? " (type-level)" : "") +
                    (m.how && m.how !== "exact" ? ` (${matchHowLabel(m.how, m.candidate)})` : "")
                )
                .join("; "),
              r.detail,
            ])
          )
        ),
        "utf8"
      );
    }
    if (scorecardRows.length)
      writeFileSync(
        join(csvDir, "tenant-deps-scorecards.csv"),
        toCsv(
          ["scorecard", "measure", "measure_group", "rule", "rule_id", "measure_resolved"],
          scorecardRows.map((s) => [s.scorecard, s.measure, s.group, s.rule, s.ruleId, s.resolved ? "yes" : "no"])
        ),
        "utf8"
      );
    // Every caveat rides the CSV/XLSX path too (F-388, consumer-parity): the
    // deps-report skill builds the workbook from this directory, one sheet per
    // CSV, and a workbook reader never saw the markdown's Caveats section —
    // a registry shortfall (or any other honesty caveat) was invisible there.
    writeFileSync(join(csvDir, "tenant-deps-caveats.csv"), toCsv(["caveat"], caveats.map((c) => [c])), "utf8");
    if (liveDeps.length)
      writeFileSync(
        join(csvDir, "tenant-deps-live-dependents.csv"),
        toCsv(
          ["object", "area", "dependent_id", "dependent_name", "referenced_columns", "capture_complete"],
          liveDeps.flatMap((live) =>
            Object.entries(live.areas).flatMap(([area, deps]) =>
              deps.map((dep) => [live.objectName, area, dep.id, dep.name, dep.columns.join("; "), live.complete ? "yes" : "no"])
            )
          )
        ),
        "utf8"
      );
  }

  emitSummary({
    mode: "tenant-deps",
    reportPath: outPath,
    ...(csvDir ? { csvDir } : {}),
    counts: Object.fromEntries([
      ...domainKeys.flatMap((k) => [
        [`${k}Scanned`, results[k].stats.parsed],
        [`${k}Yielding`, results[k].stats.yielding],
        [`${k}Matched`, results[k].stats.matchedAssets],
        [`${k}Rows`, results[k].stats.rows],
      ]),
      ["connectionsRegistry", registry.length],
      ["connectionsMatched", matchedConnections.length],
      ["externalActionsRegistry", extRegistry.length],
      ["externalActionsMatched", matchedExtActions.length],
      // per-lane docs-vs-parsed honesty on the JSON surface too (F-388) —
      // derived from the same REGISTRY_LANES table as the caveats
      ...REGISTRY_LANES.flatMap(({ stats, key }) => [
        [`${key}Docs`, stats.docs],
        [`${key}Unparsed`, stats.docs - stats.parsed],
      ]),
      ["scorecardEdges", scorecardRows.length],
      ["liveCaptures", liveDeps.length],
      // same observability keys as the JO deps mode's summary
      [
        "aliasMatchedRows",
        domainKeys.reduce(
          (n, k) =>
            n +
            results[k].assets.reduce(
              (m, a) => m + a.rows.filter((r) => r.matches.some((x) => x.kind === "field" && x.how && x.how !== "exact")).length,
              0
            ),
          0
        ),
      ],
      ["nearMissFields", [...nearMissByTerm.values()].reduce((n, s) => n + s.size, 0)],
    ]),
    aliasPrefix: aliasRes.source,
    objectsTouched,
    // F-429: which KB folder each lane was read from, and why — so a zero in
    // counts can be traced to the folder it came from.
    domainDirs: laneDirs,
    domainDirBasis: laneBasis,
    caveatCount: caveats.length,
    warnings,
  });
}

// Runnable AND importable (tests import the extractors without side effects).
// isMainModule (doc-lib, F-117), not a bare href compare: argv[1] through a
// junction/symlink otherwise never equals the realpath'd import.meta.url and
// the CLI exits 0 having produced nothing.
if (isMainModule(import.meta.url)) {
  run(process.argv.slice(2));
}
