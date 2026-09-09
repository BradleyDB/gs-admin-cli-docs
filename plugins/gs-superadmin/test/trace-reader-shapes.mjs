#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// trace-reader-shapes.mjs — MEASURES the payload keys every KB reader
// dereferences, per CLI command (CLI-adoption arm, D2/D3, 2026-09-04; round 2
// after the F-390 verdict, 2026-09-05).
//
// The problem it closes: the gs-fortress watch audits each new CLI version
// against a map of "which keys of which command's output does the plugin
// read" — a projection that drops one of those keys is a silent zero in
// deps-report (F-342/F-343 at 1.0.5, F-388 at 1.0.9). That map was a hand
// table in the OTHER repo, derived by grep and shallow twice (F-011, F-012).
// Here it is emitted from execution: every reader runs over the shared fixture
// corpus (test/fixtures/reader-payloads.mjs) under a recording Proxy
// (test/fixtures/trace-engine.mjs), and the record — through every helper and
// loop variable, by construction — is what build/emit-reader-shapes.mjs
// writes to data/reader-shapes.json. A reader change that reads a new key or
// stops reading an old one shows up as a diff of that file in the PR that
// made it.
//
// What a row carries (round 2 — the F-390 verdict's four items):
//   keys        paths the code NAMES (concrete: recorded even when absent from
//               the fixture) plus walk markers; a segment reached only through
//               an enumeration collapses to `*` (data.dependents.*[].entityId)
//   enumerated  per walk marker, the fixture keys the enumeration touched — a
//               reader sees them without mistaking them for named keys
//   alternates  deleting path p revealed these paths for the first time — p's
//               fallbacks (`jobName` → `_jobName`): a rename that leaves an
//               alternate standing is survivable; one that does not is a break
//   pluginKeys  paths under a PLUGIN-AUTHORED prefix (the designer `_kb`
//               composite describe-batch writes) — never CLI output, kept out
//               of `keys` so an upstream diff is never compared against them
//
// Two modes:
//   (default)  a suite: engine self-tests (each with its mutant), then the
//              real trace with its assertions — every command observed at
//              least one key; every FLOOR key still read (the anti-silent-
//              shrink ratchet: a floor key is one whose loss has a finding
//              behind it, and the list only grows); the reader ENUMERATION
//              closes both ways (every script that parses JSON is a traced
//              module or a named rule-out, and every named file exists);
//              every recorded path was PROBED (classified concrete or walk).
//   --json     print the observation as JSON on stdout (nothing else) for the
//              emitter. --fast skips the spawn-traced deletion probes (the
//              emitter's suite uses it for the mutant runs; the emission
//              itself never does). Test-only mutation flags prove the reds
//              from outside: --mutate-floor <command>:<path>,
//              --mutate-enumeration <file>, --mutate-drop-reader <command>.
//
// relationships-build.mjs exports nothing and runs on import; describe-batch's
// designer drilldown reader (~:549 / :584) is inline and unexported. Both are
// traced by SPAWNING the script under test/fixtures/trace-preload.mjs
// (NODE_OPTIONS=--import so the whole spawn tree records) — relationships-build
// over a temp KB, describe-batch over a temp workspace with the fake CLI at
// test/fixtures/fake-dd-cli.mjs (same engine, same grammar, same corpus).
//
// Run:  node plugins/gs-superadmin/test/trace-reader-shapes.mjs [--json] [--fast]
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { createRecorder, closure, collapseWalks, makeCollapser, applySymbols, floorSatisfied, isWalkOrOp, parsePath, expandFixture, collapseFixture, existsAt, deleteAt, deepClone } from "./fixtures/trace-engine.mjs";
import * as FX from "./fixtures/reader-payloads.mjs";
import {
  extractRuleUsages, extractReportUsages, extractJobUsages, extractDesignerUsages,
  extractDatasetUsages, extractConnection, extractExternalAction,
} from "../scripts/tenant-deps.mjs";
import { parseJourneyDoc } from "../scripts/jo-report.mjs";
import {
  renderTemplateDoc, collectScorecardMeasures, parseLiveDepsAreas, depsCaptureReadiness,
  findItemsArray, extractIds, decideEntryArray, renderProgramDoc, designerTaskFieldLabels,
} from "../scripts/doc-lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN = join(HERE, "..");
const REPO = join(PLUGIN, "..", "..");
const SCRIPTS = join(PLUGIN, "scripts");
const HOOKS = join(PLUGIN, "hooks");
const PRELOAD = join(HERE, "fixtures", "trace-preload.mjs");
const FAKE_DD = join(HERE, "fixtures", "fake-dd-cli.mjs");

const argv = process.argv.slice(2);
const JSON_MODE = argv.includes("--json");
const FAST = argv.includes("--fast");
const flag = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? null : argv[i + 1] ?? null;
};
const MUTATE_FLOOR = flag("--mutate-floor"); // "<command>:<path>"
const MUTATE_ENUM = flag("--mutate-enumeration"); // "<file>"
const MUTATE_DROP = flag("--mutate-drop-reader"); // "<command>"
const MUTATE_RECOGNIZED = flag("--mutate-recognized"); // "<command>:<name>" — a recognized name no fixture carries

// ── KB doc shape (describe-batch's; the same builder the suites use) ────────
const kbDoc = (key, id, name, payload) =>
  [
    `# ${name}`, "",
    "> Full describe doc — generated by describe-batch.mjs, captured 2026-01-15T00:00:00.000Z.", "",
    `- key: ${key}`, `- id: ${id}`, `- name: ${name}`, "",
    "```json", JSON.stringify(payload, null, 2), "```", "",
  ].join("\n");

const templatePayload = (emailTemplate, variants = []) => ({ result: true, data: { emailTemplate, variants } });
const journeyPayload = (ao) => ({ result: true, data: { advancedOutreach: ao } });

// ── The reader table ─────────────────────────────────────────────────────────
// One entry per CLI command whose output a KB reader indexes. `calls` are the
// reader entry points, each with the input mode the engine feeds it:
//   object  the fixture wrapped in the recording Proxy
//   text    JSON.stringify(fixture) — the parse hook wraps the parsed root
//   doc     kbDoc(fixture) — a KB doc whose fenced JSON the reader parses
// `floor` lists the finding-backed keys that must never stop being read —
// spelled in the engine's path grammar (trace-engine.mjs header). Add a key
// when a finding proves its loss is a silent zero; never remove one.
// `modules` names every script file this entry covers for the enumeration
// closure below (the reader's home and the consumers that call it).
// `pluginAuthored` names path prefixes the PLUGIN writes into the doc body —
// never CLI output — whose reads are reported apart from `keys`.
// A call's `symbols` rename the caller-supplied names the call itself passes
// (an --items-path, the recorded idField) to `<placeholders>` before the row is
// built — a computed-key dereference is not a payload contract.
/**
 * @typedef {{reader: string, mode: "object"|"text"|"doc", fn: (input: *) => *, symbols?: Array<{prefix?: string, segment?: string, as: string}>}} Call
 * @typedef {{command: string, readers: string[], modules: string[], calls: Call[], fixtures: Array<*>, floor: string[], pluginAuthored?: string[], note?: string}} Entry
 */
/** @type {Entry[]} */
const ENTRIES = [
  {
    command: "re r describe",
    readers: ["tenant-deps.mjs extractRuleUsages (→ conditionsOf, condRow, normalizeCondition, parseSummaryObject)", "relationships-build.mjs findRuleDetails (spawn-traced)"],
    modules: ["scripts/tenant-deps.mjs", "scripts/relationships-build.mjs"],
    calls: [{ reader: "extractRuleUsages", mode: "object", fn: extractRuleUsages }],
    fixtures: [FX.RULE_EXT, FX.RULE_SC_LEVEL, FX.RULE_ALIAS, FX.RULE_INACTIVE, FX.RULE_CALLOUT, FX.RULE_MIXED, FX.RULE_DOLLAR],
    floor: [
      "data.ruleDetails.ruleId", "data.ruleDetails.taskDetails[].object", "data.ruleDetails.taskDetails[].connectionType",
      "data.ruleDetails._flatMappings[].tgtField", "data.criteriaDetails[].filters.conditions[].leftOperand.fieldName",
      "data.gsRuleMetaActionDetails[].actionInfo.params.configId",
    ],
  },
  {
    command: "re c describe",
    readers: ["relationships-build.mjs chain walk (spawn-traced)"],
    modules: ["scripts/relationships-build.mjs"],
    calls: [],
    fixtures: [],
    floor: ["data.chainDetails.tasks[]._ruleName", "data.chainDetails.tasks[].type", "data.chainDetails.tasks[].name"],
  },
  {
    command: "re r describe-external-action",
    readers: ["tenant-deps.mjs extractExternalAction"],
    modules: ["scripts/tenant-deps.mjs"],
    calls: [{ reader: "extractExternalAction", mode: "object", fn: extractExternalAction }],
    fixtures: [FX.EXT_ACTION_DOC, FX.EXT_DOLLAR_DOC, FX.EXT_ACTION_STUB],
    floor: ["data.configId", "data.config.connectionId", "configId", "config.connectionId"],
  },
  {
    command: "rp describe",
    readers: ["tenant-deps.mjs extractReportUsages (→ inner fieldRows walk, conditionsOf, condRow)"],
    modules: ["scripts/tenant-deps.mjs"],
    calls: [{ reader: "extractReportUsages", mode: "object", fn: extractReportUsages }],
    fixtures: [FX.REPORT_MDA, FX.REPORT_SFDC],
    floor: [
      "data.reportId", "data.sourceDetails.objectName", "data.showFields[].fieldName",
      "data.showFields[].expressionDetails.expression.arguments[].fieldName", "data.whereFilters.conditions[].leftOperand.fieldName",
    ],
  },
  {
    command: "dd t describe",
    readers: [
      "tenant-deps.mjs extractDesignerUsages (→ parseSummaryObject, conditionsOf, condRow; doc-lib designerDocProgress / designerTaskFieldLabels)",
      "describe-batch.mjs designer doc-mode: the --task-id drilldown (Object.entries over the level's body, the _task* prefix) and the --field detail (_taskFieldDetail) — spawn-traced with the fake CLI",
      "doc-lib.mjs designerTaskFieldLabels (the drilldown's tables → field labels; describe-batch calls it)",
    ],
    modules: ["scripts/tenant-deps.mjs", "scripts/describe-batch.mjs"],
    calls: [
      { reader: "extractDesignerUsages", mode: "object", fn: extractDesignerUsages },
      { reader: "designerTaskFieldLabels (drilldown body)", mode: "object", fn: (p) => designerTaskFieldLabels(p?.data ?? p) },
    ],
    fixtures: [FX.DESIGNER_LEGACY, FX.DESIGNER_LIVE_SUMMARY, FX.DESIGNER_HYBRID, FX.DESIGNER, FX.DESIGNER_COMPOSITE, FX.DESIGNER_DRILLDOWN.tasks.t1, FX.DESIGNER_DRILLDOWN.tasks.t3],
    floor: [
      "data.templateId", "data._tasks[].taskId", "data._tasks[].taskName", "data._tasks[].taskType", "data._tasks[]._object", "data._tasks[]._connType",
      "_tasks[].queryInfo.objectName", "_tasks[].connectionDetails.connectionType",
      "data._taskDetailRows[]._key", "data._taskDetailRows[]._value", "data._taskShowFields[]._field", "data._taskFieldDetail",
    ],
    pluginAuthored: ["data._kb", "_kb"],
    note: "The `_kb` composite under the template body is written by describe-batch (renderDesignerDoc) from the drilldown levels — plugin-authored, never CLI output; its reads are in pluginKeys. The drilldown's fourteen `_task*` tables are read by a prefix walk (see enumerated under `data.*`) and four of them by name (floor).",
  },
  {
    command: "cn jobs",
    readers: ["tenant-deps.mjs extractJobUsages"],
    modules: ["scripts/tenant-deps.mjs"],
    calls: [{ reader: "extractJobUsages", mode: "object", fn: extractJobUsages }],
    fixtures: [FX.JOB, FX.JOB_S3],
    floor: ["jobId", "connectionDetails.connectionId", "properties.APPLICATION_DATA_TARGET_OBJECT_NAME", "taskInfo[].objectName", "taskInfo[].fieldInfoList[].fieldName"],
  },
  {
    command: "cn list",
    readers: ["tenant-deps.mjs extractConnection (walks CONNECTION_SHAPES — nested pnpConnectionsInfo at CLI 1.0.8, flat at 1.0.9; F-388)"],
    modules: ["scripts/tenant-deps.mjs"],
    calls: [{ reader: "extractConnection", mode: "object", fn: extractConnection }],
    fixtures: [FX.CONN_1, FX.CONN_2, FX.CONN_SNOW, FX.CONN_FLAT_S3],
    floor: ["pnpConnectionsInfo.connectionId", "pnpConnectionsInfo.connectionName", "pnpConnectionsInfo.connectionType", "connectionId", "connectionName", "connectionType"],
    note: "Both row shapes are read as data since F-388 (plugin 0.36.1): the nested 1.0.8 row and the flat 1.0.9 row. The flat keys are floor.",
  },
  {
    command: "jo dd list",
    readers: ["tenant-deps.mjs extractDatasetUsages"],
    modules: ["scripts/tenant-deps.mjs"],
    calls: [{ reader: "extractDatasetUsages", mode: "object", fn: extractDatasetUsages }],
    fixtures: [FX.DATASET],
    floor: ["objectName", "fields[].fieldName", "fields[].displayName"],
  },
  {
    command: "jo p describe",
    readers: ["jo-report.mjs parseJourneyDoc (→ embedded, classicStep / nodeStep, normCondition, normSchedule)", "doc-lib.mjs renderProgramDoc (→ compactProgramPayload; the writer's read)", "relationships-build.mjs program token scan (spawn-traced)"],
    // doc-lib.mjs is listed because `calls` RUNS renderProgramDoc here — it was covered by
    // other rows' declarations, so nothing red, but a row's modules must name the files ITS
    // own calls execute (F-399).
    modules: ["scripts/doc-lib.mjs", "scripts/jo-report.mjs", "scripts/relationships-build.mjs"],
    calls: [
      { reader: "parseJourneyDoc", mode: "doc", fn: (doc) => parseJourneyDoc(doc, "kb/journey/x.md") },
      { reader: "renderProgramDoc", mode: "object", fn: (p) => renderProgramDoc(p) },
    ],
    fixtures: [
      FX.JOURNEY_PAYLOAD,
      journeyPayload(FX.makeAo({ id: "prog-1", name: "Test Program", status: "PROCESSING", tplId: "tpl-aaa", tplName: "Welcome & Hello", variantId: "tpl-bbb" })),
      journeyPayload(FX.JOURNEY_NODES_AO),
    ],
    floor: [
      "data.advancedOutreach.advancedOutreachId", "data.advancedOutreach.stepJson",
      "data.advancedOutreach.participantSourceConfigurations[].config{}.filters.conditions[].leftOperand.fieldName",
    ],
  },
  {
    command: "jo e template",
    readers: ["doc-lib.mjs renderTemplateDoc (→ bodyOf, templateTokens, dateOf; template-doc.mjs and describe-batch.mjs call it)"],
    modules: ["scripts/doc-lib.mjs"],
    calls: [{ reader: "renderTemplateDoc", mode: "object", fn: (p) => renderTemplateDoc(p) }],
    fixtures: [
      templatePayload(FX.TEMPLATE_MAIN), templatePayload(FX.TEMPLATE_FALLBACK),
      templatePayload(FX.TEMPLATE_VARIANTS, [FX.TEMPLATE_VARIANT_B]), templatePayload(FX.TEMPLATE_TOKENS),
    ],
    floor: ["data.emailTemplate.templateId", "data.emailTemplate.subject", "data.emailTemplate.plainTextContent"],
  },
  {
    command: "sc measures",
    readers: ["doc-lib.mjs collectScorecardMeasures (any-depth walk; tenant-deps and relationships-build call it)"],
    modules: ["scripts/doc-lib.mjs", "scripts/relationships-build.mjs"],
    calls: [{ reader: "collectScorecardMeasures", mode: "object", fn: (p) => collectScorecardMeasures(p, "card") }],
    fixtures: [FX.SCORECARD, FX.SCORECARD_CARD.payload],
    floor: ["[].children[].measureId", "[].children[].levelType", "[].children[].name"],
  },
  {
    command: "dm deps check",
    readers: ["doc-lib.mjs parseLiveDepsAreas (strict envelope; tenant-deps --live-deps, jo-report-deps --live-deps, capture --wait via depsCaptureReadiness)"],
    modules: ["scripts/doc-lib.mjs", "scripts/jo-report-deps.mjs", "scripts/capture.mjs"],
    calls: [
      { reader: "parseLiveDepsAreas", mode: "text", fn: parseLiveDepsAreas },
      { reader: "depsCaptureReadiness", mode: "text", fn: depsCaptureReadiness },
    ],
    fixtures: [FX.DEPS_CHECK],
    floor: ["data.objectName", "data.progressStatus.overallStatus", "data.dependents", "data.dependents.*[].entityId", "data.dependents.*[].entityName"],
  },
  {
    command: "*indexed-list",
    readers: ["doc-lib.mjs findItemsArray + extractIds (the KB indexer: manifest.mjs upsert-batch; domain-candidates.mjs check)"],
    modules: ["scripts/doc-lib.mjs", "scripts/manifest.mjs"],
    calls: [
      { reader: "findItemsArray (auto-locate) → extractIds", mode: "object", fn: (p) => extractIds(findItemsArray(p, undefined, "rid"), "rid"), symbols: [{ segment: "rid", as: "<idField>" }] },
      { reader: "findItemsArray (itemsPath)", mode: "object", fn: (p) => extractIds(findItemsArray(p, "data.rows", "rid"), "rid"), symbols: [{ prefix: "data.rows", as: "data.<itemsPath>" }, { segment: "rid", as: "<idField>" }] },
    ],
    fixtures: [FX.INDEXER_PAYLOAD],
    floor: ["data.<itemsPath>[].<idField>", "data.*[].<idField>"],
    note: "Every indexed list command, handler-less ones included (jo p list selects its row keys via the manifest endpoint.body.showFields). The row keys are tenant-recorded (idField / nameField / dateField in the KB _manifest.json) and the rows array is the recorded itemsPath — spelled <idField> / <itemsPath>: the reader dereferences whatever the manifest recorded, so the literal is never a contract; the envelope walk is the fixed part.",
  },
  {
    command: "*paginated-list",
    readers: ["doc-lib.mjs scanListEnvelope / decideEntryArray (capture.mjs --paginate; er-count.mjs)"],
    modules: ["scripts/doc-lib.mjs", "scripts/capture.mjs"],
    calls: [
      { reader: "decideEntryArray", mode: "object", fn: (p) => decideEntryArray(p) },
      { reader: "decideEntryArray (itemsPath)", mode: "object", fn: (p) => decideEntryArray(p, { itemsPath: "data.liteObjects" }), symbols: [{ prefix: "data.liteObjects", as: "data.<itemsPath>" }] },
    ],
    fixtures: [FX.LIST_PAGE_ROWS, FX.LIST_PAGE_TOTALS, FX.LIST_PAGE_PAGEINFO, FX.LIST_PAGE_SIGNALS],
    floor: ["data.pageInfo.totalRecords", "data.pageInfo.pageSize", "data.totalPages", "data.lastPage", "data.nextAvailable", "data.nextPage", "data.pageNumber"],
    note: "Any paginated list capture: the envelope spine (root, data, pageInfo) and the total / page-signal key sets scanListEnvelope recognizes by NAME-SET membership over Object.keys — `recognized` carries the three Sets read off doc-lib's source, every name is asserted present under enumerated, and the rows array a caller names is <itemsPath>.",
  },
];

// Readers that recognize keys WITHOUT dereferencing them — a name-set, a prefix
// predicate, a value predicate — are invisible to the Proxy (F-390 round 2, item 6):
// they appear as walks with the fixture's names under `enumerated`, and nothing
// would go red if the recognized set grew. So the recognized set is read off the
// reader's SOURCE (a literal, asserted present — a rename fails loudly) and emitted
// on the row as `recognized`; for a name-set the tracer asserts every name is under
// the row's enumerated, so adding a name to the Set reds until the corpus carries it.
/** @type {Array<{command: string, kind: "name-set"|"prefix"|"value-predicate", source: string, consts?: string[], literal?: string, prefix?: string, where: string}>} */
const RECOGNIZED = [
  { command: "*paginated-list", kind: "name-set", source: "scripts/doc-lib.mjs", consts: ["ROW_TOTAL_KEYS", "PAGE_SIGNAL_KEYS", "PAGEINFO_ONLY_KEYS"], where: "scanListEnvelope — totals and continuation signals anywhere on the spine; returned / limit / pageSize only inside a pageInfo object" },
  { command: "dd t describe", kind: "prefix", source: "scripts/describe-batch.mjs", literal: 'k.startsWith("_task")', prefix: "_task", where: "the --task-id level's top-level keys (Object.entries, minus _tasks and _taskCount) — a rename that keeps the prefix is read, one that drops it is not" },
  { command: "re c describe", kind: "value-predicate", source: "scripts/relationships-build.mjs", literal: 'type === "BIONIC_RULE"', where: "the chain walk names a task from `_ruleName`, else from `name` when `type` equals the literal" },
];
/** Read a `const NAME = new Set([...])` literal off a source file; refuse loudly when it is not there (a renamed Set must fail, never read as empty). */
function readNameSet(file, name) {
  const src = readFileSync(join(PLUGIN, file), "utf8");
  const m = new RegExp(`const ${name} = new Set\\(\\[([^\\]]*)\\]\\)`).exec(src);
  if (!m) throw new Error(`recognized: ${file} no longer carries \`const ${name} = new Set([…])\` — re-declare the row's recognized set`);
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}
function resolveRecognized() {
  return RECOGNIZED.map((r) => {
    if (r.kind === "name-set") {
      const sets = Object.fromEntries((r.consts ?? []).map((c) => [c, readNameSet(r.source, c)]));
      const names = [...new Set(Object.values(sets).flat())].sort();
      if (MUTATE_RECOGNIZED && MUTATE_RECOGNIZED.startsWith(`${r.command}:`)) names.push(MUTATE_RECOGNIZED.slice(r.command.length + 1));
      return { command: r.command, kind: r.kind, source: r.source, sets, names, where: r.where };
    }
    const src = readFileSync(join(PLUGIN, r.source), "utf8");
    if (!src.includes(/** @type {string} */ (r.literal))) throw new Error(`recognized: ${r.source} no longer carries the literal ${r.literal} — re-declare the row's recognized predicate`);
    return { command: r.command, kind: r.kind, source: r.source, literal: r.literal, ...(r.prefix ? { prefix: r.prefix } : {}), where: r.where };
  });
}

// relationships-build.mjs — spawn-traced over a temp KB. Each doc is labelled
// with the command whose output it holds; the preload attributes every read
// of that doc's fenced JSON to the label.
const SPAWN = {
  script: join(SCRIPTS, "relationships-build.mjs"),
  docs: [
    { command: "re r describe", domain: "rules-engine", id: "rule-ext-1", name: "Acme|LOAD| CSM to Company", fixture: FX.RULE_EXT },
    { command: "re r describe", domain: "rules-engine", id: "rule-sc-2", name: "Acme Scorecard Grade Setter", fixture: FX.RULE_SC_LEVEL },
    { command: "re c describe", domain: "rules-engine-chains", id: FX.CHAIN.id, name: FX.CHAIN.name, fixture: FX.CHAIN.payload },
    { command: "sc measures", domain: "scorecard", id: FX.SCORECARD_CARD.id, name: FX.SCORECARD_CARD.name, fixture: FX.SCORECARD_CARD.payload },
    { command: "jo p describe", domain: "journey", id: "prog-1", name: "Acme Onboarding", fixture: FX.JOURNEY_PAYLOAD },
  ],
  templates: [{ id: "tpl-aaa", name: "Welcome & Hello" }],
  maxRuns: 220,
};

// Scripts that parse JSON but read no tenant CLI output — each named with why.
// A rule-out is true of the WHOLE file or it is not a rule-out (F-390 verdict
// item 2: describe-batch's drilldown reader hid behind one).
const RULE_OUTS = [
  { file: "scripts/extract-catalog.mjs", why: "reads the installed PACKAGE's manifests (the catalog), not tenant output — impact-checklist item 5's territory" },
  { file: "scripts/render-cheatsheet.mjs", why: "renders the catalog" },
  { file: "scripts/er-count.mjs", why: "the ER index's page counter — its list-page read is decideEntryArray (the *paginated-list entry)" },
  { file: "scripts/er-gaps.mjs", why: "the ER index's gap work-list — reads the index, never a payload" },
  { file: "scripts/jo-report-program.mjs", why: "reads the C1 index parseJourneyDoc builds — never a payload" },
  { file: "scripts/jo-report-search.mjs", why: "reads the C1 index" },
  { file: "scripts/jo-report-audit-active.mjs", why: "reads the C1 index" },
  { file: "scripts/journal.mjs", why: "the guard journal" },
  { file: "scripts/journal-lib.mjs", why: "the guard journal's writer" },
  { file: "scripts/plugin-link.mjs", why: "the SessionStart hook — parses its OWN child's summary (scaffold.mjs check --json, F-396), never tenant output; the child hashes template files and parses no JSON at all" },
  { file: "hooks/gs-admin-guard.mjs", why: "hook stdin + the catalog — never tenant output" },
];
const ENUM_RE = /JSON\.parse|parseDocJson|extractFencedJson|parseLiveDepsAreas/;

// ── Suite plumbing ───────────────────────────────────────────────────────────
let failures = 0;
let passed = 0;
function check(label, cond, detail) {
  if (cond) {
    passed++;
    if (!JSON_MODE) console.log(`PASS  ${label}`);
    return;
  }
  failures++;
  // F-402: in --json mode stdout is the emission; a FAIL goes to stderr so
  // the emitter's "printed no JSON" path reports it, never a corrupt document.
  const say = JSON_MODE ? console.error : console.log;
  say(`FAIL  ${label}`);
  if (detail !== undefined) say(`      ${JSON.stringify(detail)?.slice(0, 600)}`);
}

// ── Engine self-tests (each with the mutant that must NOT pass) ──────────────
function selfTests() {
  const rec = createRecorder();
  rec.installParseHook();
  const traceFull = (label, fixture, fn, mode = "object", opts) =>
    closure(rec, label, fixture, (fx) => fn(mode === "text" ? JSON.stringify(fx) : rec.wrap(fx, "", label)), opts);
  const trace = (label, fixture, fn, mode, opts) => traceFull(label, fixture, fn, mode, opts).keys;

  // (a) a `??` chain: populated reads a only; the deletion probe reveals b and c
  const chainFull = traceFull("t-chain", { a: 1, b: 2, c: 3 }, (p) => p.a ?? p.b ?? p.c);
  check("engine: `a ?? b ?? c` — deletion lineage walks the whole chain", chainFull.keys.join(",") === "a,b,c", chainFull.keys);
  check("engine: the chain's alternates are recorded (a → b, b → c)", JSON.stringify(chainFull.alternates) === JSON.stringify({ a: ["b"], b: ["c"] }), chainFull.alternates);
  check("engine: every key of the chain is CONCRETE (read while absent)", chainFull.concrete.join(",") === "a,b,c", chainFull.concrete);
  const chainMutant = trace("t-chain-m", { a: 1, b: 2, c: 3 }, (p) => p.a ?? p.c);
  check("engine (mutant): a reader that stops reading b no longer records b", !chainMutant.includes("b") && chainMutant.includes("c"), chainMutant);

  // (b) helpers and loop variables under other names
  const helper = (row) => row.name;
  const loops = trace("t-loop", { items: [{ name: "x", id: 1 }] }, (p) => p.items.map((it) => helper(it)));
  check("engine: a helper reading a loop variable records items[].name", loops.join(",") === "items,items[].name", loops);

  // (c) embedded JSON string → parsed root keys under path{}
  const emb = trace("t-emb", { cfg: JSON.stringify({ x: 1, y: { z: 2 } }) }, (p) => JSON.parse(p.cfg).y.z);
  check("engine: an embedded JSON string's keys record under cfg{}", emb.join(",") === "cfg,cfg{}.y,cfg{}.y.z", emb);

  // (d) a text reader: the parsed root is the payload root
  const text = trace("t-text", { data: { k: 1 } }, (s) => JSON.parse(s).data.k, "text");
  check("engine: a text reader's parse records from the payload root", text.join(",") === "data,data.k", text);

  // (e) enumeration = a walk marker; enumerated keys are NOT concrete and collapse to *
  const walkFull = traceFull("t-walk", { m: { p: 1, q: 2 } }, (p) => Object.entries(p.m).map(([, v]) => v));
  check("engine: Object.entries records a `.*` walk marker", walkFull.keys.includes("m.*") && walkFull.keys.includes("m"), walkFull.keys);
  check("engine: keys reached only through the enumeration are not concrete", walkFull.concrete.join(",") === "m", walkFull.concrete);
  const collapsed = collapseWalks(walkFull.keys, walkFull.concrete);
  check("engine: collapseWalks folds enumerated children into `*` and lists them under enumerated",
    collapsed.keys.join(",") === "m,m.*" && JSON.stringify(collapsed.enumerated) === JSON.stringify({ "m.*": ["p", "q"] }), collapsed);
  // a key read BOTH by name and under a walk stays concrete
  const mixedFull = traceFull("t-mixed", { m: { p: { id: 1 }, q: { id: 2 } } }, (p) => { Object.keys(p.m); return p.m.p.id; });
  const mixed = collapseWalks(mixedFull.keys, mixedFull.concrete);
  check("engine: a walk child ALSO named by the code stays concrete (m.p.id kept; q collapses)",
    mixed.keys.includes("m.p") && mixed.keys.includes("m.p.id") && !mixed.keys.includes("m.q") && mixed.enumerated["m.*"].join(",") === "q", mixed);
  const mixedMutant = traceFull("t-mixed-m", { m: { p: { id: 1 } } }, (p) => Object.keys(p.m).length);
  check("engine (mutant): a reader that stops naming m.p loses the concrete key (collapses to m.*)", !collapseWalks(mixedMutant.keys, mixedMutant.concrete).keys.includes("m.p"));

  // (f) wrapped-or-bare envelope: the bare probe takes the other arm
  const env = trace("t-env", { data: { id: 7 } }, (p) => (p.data ?? p).id);
  check("engine: wrapped-or-bare — both arms observed (data.id and bare id)", env.includes("data.id") && env.includes("id"), env);

  // (g) the `in` operator and Object.hasOwn are reads
  const hasIn = trace("t-in", { k: 1 }, (p) => ("k" in p) && Object.hasOwn(p, "j"));
  check("engine: `in` and Object.hasOwn record the probed keys", hasIn.includes("k") && hasIn.includes("j"), hasIn);

  // (h) a refusing reader keeps what it read before throwing
  const refuse = trace("t-refuse", { data: { id: 1 } }, (p) => { if (!p.data?.templateId) throw new Error("no id"); return p.data.id; });
  check("engine: a reader that throws still records the keys it read first", refuse.includes("data") && refuse.includes("data.templateId"), refuse);

  // (i) path grammar round trips through [] and {}
  const tree = expandFixture({ rows: [{ cfg: JSON.stringify({ a: { b: 1 } }) }, { cfg: JSON.stringify({ a: { b: 2 } }) }] }, new Set(["rows[].cfg"]));
  check("engine: existsAt sees inside an embedded string via {}", existsAt(tree, "rows[].cfg{}.a.b") && !existsAt(tree, "rows[].cfg{}.a.zz"));
  const n = deleteAt(tree, "rows[].cfg{}.a.b");
  const back = collapseFixture(tree);
  check("engine: deleteAt through [] and {} deletes every instance and collapses back to strings",
    n === 2 && JSON.parse(back.rows[0].cfg).a.b === undefined && typeof back.rows[1].cfg === "string", back);
  check("engine: parsePath tokenizes ops in order", JSON.stringify(parsePath("a.b[]{}.c")) === JSON.stringify([{ name: "a", ops: [] }, { name: "b", ops: ["[]", "{}"] }, { name: "c", ops: [] }]));
  check("engine: a walk marker or op-terminated path is not deletable", !existsAt({ a: { b: 1 } }, "a.*") && !existsAt({ a: [1] }, "a[]") && isWalkOrOp("a.*") && isWalkOrOp("a[]") && !isWalkOrOp("a.b"));
  check("engine: deepClone round-trips", JSON.stringify(deepClone({ a: [1, { b: null }] })) === JSON.stringify({ a: [1, { b: null }] }));
  // (l) attribution against the lineage baseline, not a running union: the child gets its own credit
  const attr = traceFull("t-attr", { x: { filters: { conditions: [1] } } }, (p) => p.x?.filters?.conditions ?? p.x?.conditions);
  check("engine: a parent deletion and a child deletion each earn the fallback (filters → conditions AND filters.conditions → conditions)",
    attr.alternates["x.filters"]?.includes("x.conditions") && attr.alternates["x.filters.conditions"]?.includes("x.conditions"), attr.alternates);
  check("engine: a three-arm chain is nested, not flattened onto the head (a → b, b → c)", JSON.stringify(chainFull.alternates) === JSON.stringify({ a: ["b"], b: ["c"] }));
  // (m) probed: a key absent from every fixture is never deleted, so it is reported unmeasured — never "no alternates"
  const unm = traceFull("t-unm", { a: 1 }, (p) => p.a ?? p.b);
  check("engine: `probed` lists only the paths that were actually deleted (a; never b, which no fixture carried)", unm.probed.join(",") === "a" && unm.keys.includes("b"), unm);
  // (n) symbols: a caller-supplied path becomes a placeholder, prefix and segment rules
  check("engine: applySymbols — prefix and segment", applySymbols("data.liteObjects[].id", [{ prefix: "data.liteObjects", as: "data.<itemsPath>" }]) === "data.<itemsPath>[].id" && applySymbols("data.rows[].rid", [{ segment: "rid", as: "<idField>" }]) === "data.rows[].<idField>" && applySymbols("data.other", [{ prefix: "data.liteObjects", as: "x" }]) === "data.other");
  // (o) the collapser is ONE rule for every side: an alternates pair spelled raw joins the collapsed keys
  const coll = makeCollapser(["m", "m.*", "m.p", "m.p.id", "m.q", "m.q.id", "m.q.title"], ["m", "m.p", "m.p.id", "m.q.id", "m.q.title"]);
  check("engine: makeCollapser spells an alternates side exactly as the key (m.q.title → m.*.title, joins m.*.id's sibling)", coll.collapse("m.q.title") === "m.*.title" && coll.collapse("m.p.id") === "m.p.id" && coll.enumerated()["m.*"].join(",") === "q");
  // (k) a floor spelled by name is satisfied under its walk, and only when the name was enumerated
  const fkeys = ["data", "data.*", "data.*.id"];
  const fenum = { "data.*": ["rows", "totalPages"] };
  check("engine: floorSatisfied accepts a natural spelling whose segment the walk enumerated", floorSatisfied("data.totalPages", fkeys, fenum) && floorSatisfied("data.rows.id", fkeys, fenum) && floorSatisfied("data.*.id", fkeys, fenum));
  check("engine (mutant): floorSatisfied refuses a name the walk never enumerated", !floorSatisfied("data.nextPage", fkeys, fenum) && !floorSatisfied("data.rows.zz", fkeys, fenum));

  // (j) determinism — two closures over the same reader agree byte for byte
  const d1 = traceFull("t-det-1", FX.REPORT_MDA, extractReportUsages);
  const d2 = traceFull("t-det-2", FX.REPORT_MDA, extractReportUsages);
  check("engine: the closure is deterministic (two runs, identical keys / concrete / alternates)", JSON.stringify(d1) === JSON.stringify(d2));
  rec.uninstallParseHook();
}

// ── Observation shape ────────────────────────────────────────────────────────
/** @typedef {{command: string, readers: string[], modules: string[], raw: Set<string>, concrete: Set<string>, alternates: Record<string, string[]>, probed: Set<string>, embedded: Set<string>, floor: string[], pluginAuthored: string[], note?: string, probes: {fixtures: number, runs: number, unprobed: number}}} Obs */

/** @param {Entry} e  @returns {Obs} */
const newObs = (e) => ({
  command: e.command, readers: e.readers, modules: e.modules.slice().sort(), raw: new Set(), concrete: new Set(), alternates: {}, probed: new Set(),
  embedded: new Set(), floor: e.floor.slice().sort(), pluginAuthored: (e.pluginAuthored ?? []).slice().sort(),
  ...(e.note ? { note: e.note } : {}), probes: { fixtures: e.fixtures.length, runs: 0, unprobed: 0 },
});
const mergeAlternates = (into, from) => {
  for (const [p, qs] of Object.entries(from)) into[p] = [...new Set([...(into[p] ?? []), ...qs])].sort();
};

// ── The in-process trace ─────────────────────────────────────────────────────
function traceInProcess() {
  const rec = createRecorder();
  rec.installParseHook();
  /** @type {Map<string, Obs>} */
  const out = new Map();
  for (const e of ENTRIES) {
    const o = newObs(e);
    const dropped = MUTATE_DROP === e.command;
    for (const call of dropped ? [] : e.calls) {
      const label = `${e.command} · ${call.reader}`;
      for (const fx of e.fixtures) {
        const execute = (raw) => {
          if (call.mode === "object") return call.fn(rec.wrap(raw, "", label));
          if (call.mode === "text") return call.fn(JSON.stringify(raw));
          return call.fn(kbDoc("x/x", "x", "x", raw));
        };
        const bare = call.mode === "doc" ? [{}] : [{}, []];
        const r = closure(rec, label, fx, execute, { bare });
        const sym = (p) => applySymbols(p, call.symbols ?? []);
        for (const k of r.keys) o.raw.add(sym(k));
        for (const k of r.concrete) o.concrete.add(sym(k));
        for (const k of r.probed) o.probed.add(sym(k));
        for (const k of r.embedded) o.embedded.add(sym(k));
        mergeAlternates(o.alternates, Object.fromEntries(Object.entries(r.alternates).map(([p, qs]) => [sym(p), qs.map(sym)])));
        o.probes.runs += r.runs;
      }
    }
    out.set(e.command, o);
  }
  rec.uninstallParseHook();
  return out;
}

// ── Spawn tracing (shared plumbing) ──────────────────────────────────────────
/** Run a script under the preload with NODE_OPTIONS so its whole spawn tree records; merge the per-pid files. */
function runUnderPreload(root, labels, script, args, extraEnv = {}) {
  const labelsPath = join(root, "labels.json");
  const tracePrefix = join(root, "trace");
  writeFileSync(labelsPath, JSON.stringify(labels), "utf8");
  for (const f of readdirSync(root)) if (f.startsWith("trace.") && f.endsWith(".json")) rmSync(join(root, f), { force: true });
  const nodeOptions = `--import ${JSON.stringify(pathToFileURL(PRELOAD).href)}`;
  const res = spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, NODE_OPTIONS: nodeOptions, TRACE_LABELS: labelsPath, TRACE_OUT: tracePrefix, ...extraEnv },
  });
  if (res.status !== 0) throw new Error(`spawn-trace of ${script} failed (exit ${res.status}): ${(res.stderr || res.stdout).slice(0, 800)}`);
  /** @type {Record<string, string[]>} */
  const merged = {};
  for (const f of readdirSync(root)) {
    if (!(f.startsWith("trace.") && f.endsWith(".json"))) continue;
    const part = JSON.parse(readFileSync(join(root, f), "utf8"));
    for (const [label, paths] of Object.entries(part)) merged[label] = [...new Set([...(merged[label] ?? []), ...paths])].sort();
  }
  return merged;
}

/** Fold one spawn observation into the command rows, classifying concrete-ness against the fixtures the label was read from. */
function foldSpawn(out, obs, fixturesByLabel, { deleted = null } = {}) {
  for (const [label, paths] of Object.entries(obs)) {
    const emb = label.endsWith(" embedded");
    const command = emb ? label.slice(0, -" embedded".length) : label;
    const o = out.get(command);
    if (!o) continue;
    if (emb) {
      for (const p of paths) o.embedded.add(p);
      continue;
    }
    const trees = (fixturesByLabel[command] ?? []).map((fx) => expandFixture(fx, new Set(obs[`${command} embedded`] ?? [])));
    for (const p of paths) {
      o.raw.add(p);
      if (isWalkOrOp(p)) continue;
      // concrete: read while absent from every fixture this label was read from, or read while it was the deleted path
      if (p === deleted || !trees.some((t) => existsAt(t, p))) o.concrete.add(p);
    }
  }
}

// ── relationships-build.mjs over a temp KB ───────────────────────────────────
/** @param {Map<string, Obs>} out */
function traceRelationshipsBuild(out) {
  const root = join(tmpdir(), `gs-superadmin-trace-rb-${process.pid}`);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  const slug = "acme-trace";
  const kb = join(root, slug);
  const manifestPath = join(kb, "_manifest.json");
  const outDir = join(root, "relationships");

  /** @param {Array<{command: string, domain: string, id: string, name: string, fixture: *}>} docs */
  const writeKb = (docs) => {
    rmSync(kb, { recursive: true, force: true });
    mkdirSync(kb, { recursive: true });
    const inventory = {};
    const labels = {};
    for (const d of docs) {
      mkdirSync(join(kb, d.domain), { recursive: true });
      labels[JSON.stringify(d.fixture, null, 2)] = d.command;
      writeFileSync(join(kb, d.domain, `${d.id}.md`), kbDoc(`${d.domain}/${d.id}`, d.id, d.name, d.fixture), "utf8");
      inventory[`${d.domain}/${d.id}`] = { id: d.id, domain: d.domain, name: d.name, status: "documented", depth: "full", last_verified: "2026-01-15T00:00:00.000Z" };
    }
    for (const t of SPAWN.templates) inventory[`journey-email-templates/${t.id}`] = { id: t.id, domain: "journey-email-templates", name: t.name, status: "pending" };
    writeFileSync(manifestPath, JSON.stringify({ slug, baseUrl: "https://acme--sbx.gainsightcloud.com", environment: "sandbox", created: "2026-01-15T00:00:00.000Z", last_refresh: null, inventory }, null, 2), "utf8");
    return labels;
  };
  const runOnce = (docs) => runUnderPreload(root, writeKb(docs), SPAWN.script, ["--manifest", manifestPath, "--out-dir", outDir, "--date", "2026-01-15"]);
  const fixturesByLabel = {};
  for (const d of SPAWN.docs) (fixturesByLabel[d.command] ??= []).push(d.fixture);

  let runs = 0;
  const base = runOnce(SPAWN.docs);
  runs++;
  foldSpawn(out, base, fixturesByLabel);
  const spawnCommands = [...new Set(SPAWN.docs.map((d) => d.command))];
  let unprobed = 0;
  if (!FAST) {
    for (const [i, d] of SPAWN.docs.entries()) {
      const emb = new Set(base[`${d.command} embedded`] ?? []);
      const tree = expandFixture(d.fixture, emb);
      const paths = (base[d.command] ?? []).slice().sort().filter((p) => existsAt(tree, p));
      const baseline = new Set(base[d.command] ?? []); // the run with p present — never a running union
      for (const p of paths) {
        if (runs >= SPAWN.maxRuns) { unprobed++; continue; }
        const variant = deepClone(tree);
        deleteAt(variant, p);
        const docs = SPAWN.docs.map((x, j) => (j === i ? { ...x, fixture: collapseFixture(variant) } : x));
        const got = runOnce(docs);
        runs++;
        out.get(d.command)?.probed.add(p);
        foldSpawn(out, got, { ...fixturesByLabel, [d.command]: docs.filter((x) => x.command === d.command).map((x) => x.fixture) }, { deleted: p });
        const revealed = (got[d.command] ?? []).filter((q) => !baseline.has(q) && !isWalkOrOp(q) && q !== p);
        if (revealed.length) mergeAlternates(out.get(d.command).alternates, { [p]: revealed });
      }
    }
  } else {
    for (const c of spawnCommands) unprobed += (base[c] ?? []).filter((p) => !isWalkOrOp(p)).length;
  }
  for (const c of spawnCommands) {
    const o = out.get(c);
    if (o) { o.probes.runs += runs; o.probes.unprobed += unprobed; }
  }
  rmSync(root, { recursive: true, force: true });
  return { runs, observedLabels: Object.keys(base).filter((l) => !l.endsWith(" embedded")) };
}

// ── describe-batch.mjs (designer doc-mode) over a temp workspace + the fake CLI
function traceDescribeBatch(out) {
  const root = join(tmpdir(), `gs-superadmin-trace-db-${process.pid}`);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(root, ".gs-superadmin"), { recursive: true });
  copyFileSync(join(REPO, "data", "catalog.json"), join(root, ".gs-superadmin", "catalog.json"));
  const slug = "acme-dd";
  const manifestPath = join(root, slug, "_manifest.json");
  const manifest = (verb, args) => {
    const r = spawnSync(process.execPath, [join(SCRIPTS, "manifest.mjs"), verb, "--manifest", manifestPath, ...args], { encoding: "utf8" });
    if (r.status !== 0) throw new Error(`manifest ${verb} failed: ${r.stderr}`);
  };
  const command = "dd t describe";
  const DD = FX.DESIGNER_DRILLDOWN;
  // the three levels, as paths inside the DESIGNER_DRILLDOWN object and as the payloads themselves
  const LEVEL_PATHS = ["template", ...Object.keys(DD.tasks).map((t) => `tasks.${t}`), ...Object.entries(DD.fields).flatMap(([t, m]) => Object.keys(m).map((f) => `fields.${t}.${f}`))];
  const levels = (dd) => [dd.template, ...Object.values(dd.tasks), ...Object.values(dd.fields).flatMap((m) => Object.values(m))];
  const labelsFor = (dd) => Object.fromEntries(levels(dd).map((p) => [JSON.stringify(p), command]));
  // F-410: the manifest never depends on the variant — the upserted list is built
  // from the unmodified module-level fixture — so init + upsert-batch run ONCE and
  // every run starts from a snapshot of that pristine manifest instead of two
  // Node cold starts per probe (53 probes → 106 spawns, ~7.7 s of the tracer).
  // describe-batch marks each entry documented/failed as it runs, so the restore
  // is a fresh write of the snapshot, not a skip: the slug dir is removed whole
  // (describe-batch writes docs under it) and the manifest re-created inside it.
  rmSync(join(root, slug), { recursive: true, force: true });
  manifest("init", ["--slug", slug, "--base-url", "https://acme--sbx.gainsightcloud.com", "--environment", "sandbox"]);
  const list = join(root, "dd-list.json");
  writeFileSync(list, JSON.stringify({ data: [{ templateId: DD.templateId, name: DD.template.data.name }] }), "utf8"); // the ORIGINAL's name: a variant may have lost its `data`
  manifest("upsert-batch", ["--file", list, "--domain", "data-designer", "--id-field", "templateId", "--name-field", "name"]);
  const pristineManifest = readFileSync(manifestPath, "utf8");
  const runOnce = (dd) => {
    rmSync(join(root, slug), { recursive: true, force: true });
    mkdirSync(join(root, slug), { recursive: true });
    writeFileSync(manifestPath, pristineManifest, "utf8");
    const override = join(root, "dd-override.json");
    writeFileSync(override, JSON.stringify(dd), "utf8");
    return runUnderPreload(root, labelsFor(dd), join(SCRIPTS, "describe-batch.mjs"),
      ["--manifest", manifestPath, "--domain", "data-designer", "--out-dir", join(root, slug, "data-designer"), "--bin", FAKE_DD, "--command", "gs-admin --json dd t describe --template-id {id}", "--spawn-budget", "40"],
      { FAKE_DD_OVERRIDE: override });
  };
  let runs = 0;
  const base = runOnce(DD);
  runs++;
  foldSpawn(out, base, { [command]: levels(DD) });
  const o = out.get(command);
  let unprobed = 0;
  const seen = (base[command] ?? []).filter((p) => !isWalkOrOp(p));
  if (!FAST) {
    // one deletion per path, applied to EVERY level that carries it (the label unifies three shapes);
    // every path present somewhere is deleted once — classification AND an alternates measurement
    const baseline = new Set(base[command] ?? []);
    for (const p of seen.slice().sort()) {
      const whole = expandFixture(DD, new Set());
      let removed = 0;
      for (const L of LEVEL_PATHS) removed += deleteAt(whole, `${L}.${p}`);
      if (removed === 0) { o.concrete.add(p); continue; } // read while absent from every level
      const variant = collapseFixture(whole);
      const got = runOnce(variant);
      runs++;
      o.probed.add(p);
      foldSpawn(out, got, { [command]: levels(variant) }, { deleted: p });
      const revealed = (got[command] ?? []).filter((q) => !baseline.has(q) && !isWalkOrOp(q) && q !== p);
      if (revealed.length) mergeAlternates(o.alternates, { [p]: revealed });
    }
  } else unprobed += seen.filter((p) => !o.concrete.has(p)).length;
  o.probes.runs += runs;
  o.probes.unprobed += unprobed;
  rmSync(root, { recursive: true, force: true });
  return { runs, observed: (base[command] ?? []).length };
}

function enumerateReaders() {
  const files = [];
  for (const [dir, prefix] of [[SCRIPTS, "scripts/"], [HOOKS, "hooks/"]]) {
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".mjs")).sort()) {
      if (ENUM_RE.test(readFileSync(join(dir, f), "utf8"))) files.push(prefix + f);
    }
  }
  if (MUTATE_ENUM) files.push(MUTATE_ENUM);
  return files.sort();
}

// ── Finalize a row: collapse walks, split plugin-authored, sort ──────────────
function finalize(o, recognizedAll) {
  // ONE collapse for every field of the row (F-390 round 2, mechanism i) —
  // through the engine's collapseWalks, the fold the self-checks pin (Gate 2
  // for 0.36.2: this used to re-spell it, so the pinned fold never shipped).
  const { keys: collapsed, enumerated, collapser: c } = collapseWalks([...o.raw], o.concrete);
  const isPlugin = (k) => o.pluginAuthored.some((pre) => k === pre || k.startsWith(`${pre}.`) || k.startsWith(`${pre}[`));
  const keys = collapsed.filter((k) => !isPlugin(k));
  const keySet = new Set(keys);
  const pluginKeys = collapsed.filter(isPlugin);
  /** @type {Record<string, Set<string>>} */
  const alt = {};
  for (const [p, qs] of Object.entries(o.alternates)) {
    const cp = c.collapse(p);
    if (isPlugin(cp) || !keySet.has(cp)) continue;
    for (const q of qs) {
      const cq = c.collapse(q);
      if (cq === cp || isPlugin(cq) || !keySet.has(cq)) continue;
      (alt[cp] ??= new Set()).add(cq);
    }
  }
  const alternates = Object.fromEntries(Object.keys(alt).sort().map((p) => [p, [...alt[p]].sort()]));
  const probedCollapsed = new Set([...o.probed].map(c.collapse));
  // measured-none vs never-measured (F-390 round 2, mechanism iii): a named key never deleted has no alternates MEASUREMENT
  const alternatesUnmeasured = keys.filter((k) => !isWalkOrOp(k) && !probedCollapsed.has(k) && !(k in alternates));
  const enumeratedOut = Object.fromEntries(Object.keys(enumerated).filter((w) => !isPlugin(w)).map((w) => [w, enumerated[w]]));
  const recognized = recognizedAll.filter((r) => r.command === o.command).map(({ command, ...rest }) => rest);
  return {
    command: o.command,
    readers: o.readers,
    modules: o.modules,
    keys,
    walks: keys.filter((k) => k === "*" || k.endsWith(".*")),
    enumerated: enumeratedOut,
    alternates,
    alternatesUnmeasured,
    recognized,
    embedded: [...new Set([...o.embedded].map(c.collapse))].filter((k) => !isPlugin(k)).sort(),
    pluginAuthored: o.pluginAuthored,
    pluginKeys,
    floor: o.floor,
    floorMissing: o.floor.filter((f) => !floorSatisfied(f, keys, enumeratedOut)),
    ...(o.note ? { note: o.note } : {}),
    probes: o.probes,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────
// F-402: the engine self-tests and the assertions below run in BOTH modes —
// a --json measurement that skipped them let a reader with no ENTRIES row
// and no rule-out regenerate data/reader-shapes.json green (Gate 2 for 0.36.2).
selfTests();

const observations = traceInProcess();
const rb = traceRelationshipsBuild(observations);
const db = traceDescribeBatch(observations);
if (MUTATE_FLOOR) {
  const [cmd, ...rest] = MUTATE_FLOOR.split(":");
  const o = observations.get(cmd);
  if (o) o.floor = [...o.floor, rest.join(":")].sort();
}
const recognizedAll = resolveRecognized();
const rows = [...observations.values()].map((o) => finalize(o, recognizedAll));
const enumeration = enumerateReaders();
const covered = new Set([...ENTRIES.flatMap((e) => e.modules), ...RULE_OUTS.map((r) => r.file)]);

const result = {
  commands: rows,
  ruleOuts: RULE_OUTS,
  enumeration: { pattern: ENUM_RE.source, dirs: ["plugins/gs-superadmin/scripts", "plugins/gs-superadmin/hooks"], files: enumeration },
  residuals: [
    "Coverage is the fixture corpus plus the probes (single-deletion lineages to depth 3 in-process; one deletion per path for the spawn-traced scripts; bare {} / []): a branch no fixture and no probe reaches is unobserved. A reader that reads a key only from a payload shape no fixture carries is invisible until its fixture exists in test/fixtures/reader-payloads.mjs.",
    "A walk (`.*`) reads every key at that depth; `enumerated` lists the fixture keys it touched — those names are the corpus's, not the code's. A key under a walk that the code ALSO names stays concrete.",
    "`alternates` come from deletion, credited against the run in which the deleted path was present (never a running union): they name what the reader fell back to when that path was absent — a rename that leaves an alternate standing is survivable at that site, not necessarily elsewhere. Both sides are spelled exactly as `keys` are, so they join by string equality. `alternatesUnmeasured` lists the named keys no run ever deleted (absent from every fixture — a key that is itself a fallback is usually one): for those, 'no alternates' means NOT MEASURED, not 'none'.",
    "`pluginKeys` are reads of plugin-authored subtrees (the designer `_kb` composite) that live in the KB doc body, never in CLI output; an upstream diff is never compared against them.",
    "A reader that recognizes keys WITHOUT dereferencing them — by NAME-SET membership (scanListEnvelope's three Sets), by a PREFIX (describe-batch's `_task` walk), by a VALUE predicate (the chain walk's `type === \"BIONIC_RULE\"`) — is invisible to the Proxy: the trace shows the walk and the fixture's names under `enumerated`. `recognized` carries the set / prefix / predicate read off the reader's SOURCE (asserted present — a rename fails loudly), and for a name-set every name is asserted under `enumerated`, so a Set that grows reds until the corpus carries the new name.",
    "`recognized` is a DECLARED SUBSET, not a closed enumeration: unlike `keys`, whose JSON-parsing-script enumeration closes both ways, the recognizers are a hand list (RECOGNIZED in test/trace-reader-shapes.mjs) with no census proving it complete, so an ABSENT recognizer is not evidence a row has none. Known undeclared today (F-399): doc-lib's compactProgramPayload, which the `jo p describe` row runs, recognizes payload keys by a 42-name geometry Set and a `.toLowerCase()` (doc-lib.mjs:503), by the regex `/powerlist/i` that decides what is kept verbatim (:499), and by the suffix rule `/json$/i` that decides which string values are parsed as embedded JSON (:514, mitigated — jo-report.mjs:397 also names `stepJson` explicitly); also ID_NAME_KEYS (:565) and VOLATILE_KEY (:240), and relationships-build's POP_TYPES (:427) / KNOWN_REST_AREAS (:455), which degrade loudly by that script's never-silently-drop rule. These cannot be declared as `name-set` today because that kind asserts every name under `enumerated` and the corpus carries 2 of 42 and 0 of 6.",
    "A caller-supplied or tenant-recorded name the reader dereferences (an --items-path, the manifest's idField) is spelled `<name>`: the literal the tracer passed is never a payload contract.",
    "A reader that deep-clones a sub-object through JSON.stringify/JSON.parse attributes the clone's reads to the payload root.",
    FAST
      ? "EMITTED WITH --fast: the spawn-traced deletion probes were skipped, so spawn-traced paths not already classified count as unprobed (kept as recorded) — never commit a --fast emission."
      : "Every recorded path was probed (unprobed = 0 on every row).",
  ],
};

{
  // ── Assertions over the real trace (both modes — F-402) ──────────────────
  for (const o of result.commands) {
    check(`trace: ${o.command} — at least one key observed (${o.keys.length} keys, ${o.probes.runs} runs)`, o.keys.length > 0, o);
    check(`floor: ${o.command} — every finding-backed key still read, by name or under its walk (${o.floor.length} floor keys)`, o.floorMissing.length === 0, { missing: o.floorMissing, keys: o.keys, enumerated: o.enumerated });
    if (!FAST) check(`probes: ${o.command} — every recorded path classified (unprobed = 0)`, o.probes.unprobed === 0, o.probes);
    check(`split: ${o.command} — no plugin-authored path in keys`, o.keys.every((k) => !o.pluginAuthored.some((pre) => k === pre || k.startsWith(`${pre}.`))), o.keys.filter((k) => o.pluginAuthored.some((pre) => k.startsWith(pre))));
    const dangling = Object.entries(o.alternates).flatMap(([p, qs]) => [p, ...qs]).filter((x) => !o.keys.includes(x));
    check(`join: ${o.command} — every alternates path, both sides, is a key (string equality)`, dangling.length === 0, dangling);
    for (const r of o.recognized) {
      if (r.kind !== "name-set") continue;
      const enumeratedAll = new Set(Object.values(o.enumerated).flat());
      const missing = r.names.filter((n) => !enumeratedAll.has(n));
      check(`recognized: ${o.command} — every name in ${Object.keys(r.sets).join("/")} is carried by the corpus (under enumerated)`, missing.length === 0, { missing });
    }
  }
  const idx = result.commands.find((o) => o.command === "*indexed-list");
  check("symbols: caller-supplied names are placeholders, never contract keys (<itemsPath>, <idField>; no liteObjects, rows or rid anywhere in keys)",
    result.commands.every((o) => !o.keys.some((k) => /\b(liteObjects|rid)\b/.test(k) || k.startsWith("data.rows"))) && idx?.keys.includes("data.<itemsPath>[].<idField>"), idx?.keys);
  const tpl = result.commands.find((o) => o.command === "jo e template");
  check("attribution: the variant site's body chain is measured like the template's (htmlContent → editorContent at both)",
    tpl?.alternates?.["data.emailTemplate.htmlContent"]?.includes("data.emailTemplate.editorContent") && tpl?.alternates?.["data.variants[].htmlContent"]?.includes("data.variants[].editorContent"), tpl?.alternates);
  const rules = result.commands.find((o) => o.command === "re r describe");
  check("attribution: the child path gets its own credit (filters.conditions → conditions, not only filters → conditions)",
    rules?.alternates?.["data.criteriaDetails[].filters.conditions"]?.includes("data.criteriaDetails[].conditions") === true, rules?.alternates);
  const dd = result.commands.find((o) => o.command === "dd t describe");
  check("dd t describe: the drilldown's prefix walk shows every _task* table under enumerated data.*",
    ["_taskFieldFormula", "_taskS3Export", "_taskPivotConditions", "_taskFieldCase"].every((t) => dd?.enumerated?.["data.*"]?.includes(t)), dd?.enumerated);
  check("dd t describe: the _kb composite is in pluginKeys, not keys", (dd?.pluginKeys.length ?? 0) > 0 && dd?.pluginKeys.every((k) => k.startsWith("data._kb") || k.startsWith("_kb")) && !dd?.keys.some((k) => k.includes("_kb")), dd?.pluginKeys.slice(0, 5));
  const jobs = result.commands.find((o) => o.command === "cn jobs");
  check("cn jobs: the jobName → _jobName fallback is an alternate", jobs?.alternates?.jobName?.includes("_jobName") === true, jobs?.alternates);
  const deps = result.commands.find((o) => o.command === "dm deps check");
  check("dm deps check: the per-area keys collapse to the walk (data.dependents.*[].entityId), fixture areas listed under enumerated",
    deps?.keys.includes("data.dependents.*[].entityId") && !deps?.keys.some((k) => k.startsWith("data.dependents.RULE")) && deps?.enumerated?.["data.dependents.*"]?.includes("RULE"), { keys: deps?.keys, enumerated: deps?.enumerated });
  check("spawn: relationships-build.mjs traced every labelled doc (rules, chain, scorecard, program)",
    ["re r describe", "re c describe", "sc measures", "jo p describe"].every((c) => rb.observedLabels.includes(c)), rb);
  check(`spawn: describe-batch.mjs designer doc-mode traced the drilldown levels (${db.observed} paths on the dd t describe label)`, db.observed > 0 && (FAST || dd?.keys.includes("data._taskFieldDetail")), db);
  const uncovered = enumeration.filter((f) => !covered.has(f));
  check(`enumeration: every script that parses JSON is a traced module or a named rule-out (${enumeration.length} files)`, uncovered.length === 0, { uncovered });
  const missingFiles = [...covered].filter((f) => !existsSync(join(PLUGIN, f)));
  check("enumeration: every traced module and rule-out names a file that exists (declaration rot)", missingFiles.length === 0, { missingFiles });
  const traced = ENTRIES.flatMap((e) => e.modules).filter((m) => !enumeration.includes(m));
  check("enumeration: every traced module is itself enumerated (a module that stopped parsing JSON is a retired row)", traced.length === 0, { traced });
}
if (JSON_MODE) {
  if (failures) {
    console.error(`trace-reader-shapes --json: ${failures} of ${passed + failures} checks FAILED — no emission written (the FAIL lines above)`);
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
} else {
  console.log(`\n${failures === 0 ? "All" : `${passed} of ${passed + failures}`} reader-shape trace checks passed${failures ? ` — ${failures} FAILED` : ""}`);
  process.exitCode = failures === 0 ? 0 : 1;
}
