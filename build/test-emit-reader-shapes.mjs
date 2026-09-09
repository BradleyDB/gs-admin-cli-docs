#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// test-emit-reader-shapes.mjs — the reader-shapes emitter's own suite
// (CLI-adoption arm, 2026-09-04). Pins, each with the mutant that must go red:
//
//   1. the committed data/reader-shapes.json equals a fresh emission byte for
//      byte (the local twin of CI's rebuild-and-diff), carries the emitter's
//      SCHEMA_VERSION (the cross-repo contract version — 3 at the Gate 2 review
//      for 0.36.2; the assertion imports the constant, so read the emitter's
//      header for the number, never this prose) and the catalog's cliVersion,
//      joins every real command to the catalog,
//      and lists at least one key per command with every floor key present;
//   2. the emission is byte-stable across two runs (a non-deterministic trace
//      would make the drift check flap);
//   3. the emitter REFUSES a trace whose command is not in the catalog
//      (a stub tracer via READER_SHAPES_TRACER) — a renamed CLI command
//      cannot silently drop out of the map;
//   4. the tracer's own reds, driven from outside through its test-only
//      mutation flags: a phantom floor key, a phantom enumerated file, and a
//      dropped reader each fail the tracer suite — so "floor ⊆ observed" and
//      the enumeration closure are teeth, not prose;
//   5. the tracer path the emitter spawns exists in the tree (declaration
//      rot: a rename cannot silently retire the measurement).
//
// Run:  node build/test-emit-reader-shapes.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, readJsonFile } from "./lib.mjs";
import { makeTempDir, removeTempDir } from "../test/rig.mjs";
import { SCHEMA_VERSION, TRACER, OUTPUT, joinCatalog } from "./emit-reader-shapes.mjs";

const EMITTER = join(ROOT, "build", "emit-reader-shapes.mjs");
const TRACER_PATH = join(ROOT, TRACER);

let failures = 0;
let passed = 0;
function check(label, cond, detail) {
  if (cond) { passed++; return; }
  failures++;
  console.log(`FAIL  ${label}`);
  if (detail !== undefined) console.log(`      ${JSON.stringify(detail)?.slice(0, 800)}`);
}
const run = (args, env = {}) => spawnSync(process.execPath, args, { encoding: "utf8", env: { ...process.env, ...env }, maxBuffer: 64 * 1024 * 1024 });

const tmp = makeTempDir("gs-reader-shapes");
try {
  // ── 1 + 2: fresh emission vs committed; stability ─────────────────────────
  const outA = join(tmp, "a.json");
  const outB = join(tmp, "b.json");
  const ra = run([EMITTER, "--out", outA]);
  check("emitter: exits 0 and reports the emission", ra.status === 0 && /reader shapes emitted/.test(ra.stdout), { status: ra.status, stderr: ra.stderr, stdout: ra.stdout });
  const rb = run([EMITTER, "--out", outB]);
  check("emitter: byte-stable across two runs", rb.status === 0 && readFileSync(outA, "utf8") === readFileSync(outB, "utf8"));
  const committedPath = join(ROOT, OUTPUT);
  check(`emitter: ${OUTPUT} is committed`, existsSync(committedPath));
  if (existsSync(committedPath) && ra.status === 0) {
    check(`emitter: committed ${OUTPUT} equals a fresh emission byte for byte (run: npm run build:reader-shapes)`,
      readFileSync(committedPath, "utf8") === readFileSync(outA, "utf8"));
  }
  if (ra.status === 0) {
    const emitted = readJsonFile(outA);
    const catalog = readJsonFile(join(ROOT, "data", "catalog.json"));
    check("emitted: schemaVersion is the frozen contract version", emitted.schemaVersion === SCHEMA_VERSION, emitted.schemaVersion);
    check("emitted: cliVersion is the catalog pin", emitted.cliVersion === catalog.meta.cliVersion, [emitted.cliVersion, catalog.meta.cliVersion]);
    check("emitted: the GENERATED banner is present", typeof emitted._generated === "string" && emitted._generated.startsWith("GENERATED FILE"));
    check("emitted: the path grammar rides in the file", emitted.pathGrammar && "a.cfg{}" in emitted.pathGrammar && "a.*" in emitted.pathGrammar);
    check("emitted: every file field and every row field is described in `fields` (a reader needs nothing from this repo)",
      emitted.fields && Object.keys(emitted).every((k) => k in emitted.fields.file) && (emitted.commands ?? []).every((c) => Object.keys(c).every((k) => k in emitted.fields.row)),
      { file: Object.keys(emitted).filter((k) => !(k in (emitted.fields?.file ?? {}))), row: [...new Set((emitted.commands ?? []).flatMap((c) => Object.keys(c)).filter((k) => !(k in (emitted.fields?.row ?? {}))))] });
    const cmds = emitted.commands ?? [];
    check("emitted: the 14-row floor from F-012 holds (≥ 14 commands)", cmds.length >= 14, cmds.map((c) => c.command));
    const real = cmds.filter((c) => !c.command.startsWith("*"));
    check("emitted: every real command joined to a catalog id / actionKey / mcpTool", real.every((c) => c.catalog?.id && c.catalog?.actionKey && c.catalog?.mcpTool), real.filter((c) => !c.catalog?.id).map((c) => c.command));
    check("emitted: the two symbolic commands carry no catalog ref and a note", cmds.filter((c) => c.command.startsWith("*")).every((c) => c.catalog === null && typeof c.note === "string"));
    check("emitted: every command lists at least one key, no floor key is missing, no path is unprobed",
      cmds.every((c) => c.keys.length > 0 && c.floorMissing.length === 0 && c.probes.unprobed === 0),
      cmds.filter((c) => c.floorMissing.length || c.probes.unprobed).map((c) => [c.command, c.floorMissing, c.probes]));
    check("emitted: keys are sorted and unique (byte-stability by construction)",
      cmds.every((c) => c.keys.join("\n") === [...new Set(c.keys)].sort().join("\n")));
    const conn = cmds.find((c) => c.command === "cn list");
    check("emitted: the connector row reads BOTH shapes (F-388 landed): nested and flat keys",
      conn?.keys.includes("pnpConnectionsInfo.connectionId") === true && conn?.keys.includes("connectionId") === true, conn?.keys);
    const dd = cmds.find((c) => c.command === "dd t describe");
    check("emitted: the designer row reads the F-343 summary keys at leaf depth",
      ["data._tasks[].taskId", "data._tasks[]._object", "data._tasks[]._connType"].every((k) => dd?.keys.includes(k)));
    check("emitted (F-390 item 2): the designer drilldown tables are visible — _taskFieldDetail named, the prefix walk's tables enumerated under data.*",
      dd?.keys.includes("data._taskFieldDetail") === true && ["_taskFieldFormula", "_taskS3Export", "_taskPivotConditions"].every((t) => dd?.enumerated?.["data.*"]?.includes(t)), { keys: dd?.keys.filter((k) => k.includes("_task")), enumerated: dd?.enumerated });
    check("emitted (F-390 item 3): the plugin-authored _kb composite is in pluginKeys and absent from keys",
      (dd?.pluginKeys.length ?? 0) > 0 && dd?.pluginAuthored.includes("data._kb") && !dd?.keys.some((k) => k.includes("_kb")) && cmds.every((c) => c.keys.every((k) => !c.pluginAuthored.some((p) => k.startsWith(p)))));
    const deps = cmds.find((c) => c.command === "dm deps check");
    check("emitted (F-390 item 4b): walk-derived segments collapse to `*` — no fixture area name survives in keys; areas listed under enumerated",
      deps?.keys.includes("data.dependents.*[].entityId") === true && !deps?.keys.some((k) => /dependents\.(RULE|REPORT|C360)/.test(k)) && deps?.enumerated?.["data.dependents.*"]?.includes("RULE") === true, deps?.keys);
    const jobs = cmds.find((c) => c.command === "cn jobs");
    check("emitted (F-390 item 4c): alternates are recorded — jobName → _jobName", jobs?.alternates?.jobName?.includes("_jobName") === true, jobs?.alternates);
    check("emitted (F-390 round 2, i): every alternates path, both sides, is a key — string equality, no rule to know",
      cmds.every((c) => Object.entries(c.alternates).flatMap(([p, qs]) => [p, ...qs]).every((x) => c.keys.includes(x))),
      cmds.map((c) => [c.command, Object.entries(c.alternates).flatMap(([p, qs]) => [p, ...qs]).filter((x) => !c.keys.includes(x))]).filter(([, d]) => d.length));
    const rules = cmds.find((c) => c.command === "re r describe");
    check("emitted (F-390 round 2, ii): the child path carries its own fallback — filters.conditions → conditions",
      rules?.alternates?.["data.criteriaDetails[].filters.conditions"]?.includes("data.criteriaDetails[].conditions") === true, rules?.alternates);
    const tpl = cmds.find((c) => c.command === "jo e template");
    check("emitted (F-390 round 2, iii): both body-chain sites measured — htmlContent → editorContent on the template AND on variants[]",
      tpl?.alternates?.["data.emailTemplate.htmlContent"]?.includes("data.emailTemplate.editorContent") === true && tpl?.alternates?.["data.variants[].htmlContent"]?.includes("data.variants[].editorContent") === true, tpl?.alternates);
    check("emitted (F-390 round 2, iii): alternatesUnmeasured is an array on every row and never overlaps a measured entry",
      cmds.every((c) => Array.isArray(c.alternatesUnmeasured) && c.alternatesUnmeasured.every((k) => c.keys.includes(k) && !(k in c.alternates))));
    check("emitted (F-390 round 2): no caller-supplied name is a contract key — <itemsPath> / <idField> placeholders, no liteObjects / rows / rid",
      cmds.every((c) => !c.keys.some((k) => /\b(liteObjects|rid)\b/.test(k) || k.startsWith("data.rows"))) && cmds.find((c) => c.command === "*indexed-list")?.keys.includes("data.<itemsPath>[].<idField>") === true && "<name>" in emitted.pathGrammar);
    const pag = cmds.find((c) => c.command === "*paginated-list");
    check("emitted (F-390 item 1): the five continuation signals are visible under the paginate scanner's walk",
      ["totalPages", "lastPage", "nextAvailable", "nextPage", "pageNumber"].every((k) => pag?.enumerated?.["data.*"]?.includes(k)), pag?.enumerated);
    check("emitted (F-390 round 2, item 6): recognized name-sets read off doc-lib — 13 names, all under enumerated; the _task prefix and the BIONIC_RULE predicate on their rows",
      pag?.recognized?.[0]?.kind === "name-set" && pag.recognized[0].names.length === 13 && pag.recognized[0].names.every((n) => Object.values(pag.enumerated).flat().includes(n)) &&
        dd?.recognized?.some((r) => r.kind === "prefix" && r.prefix === "_task") === true && cmds.find((c) => c.command === "re c describe")?.recognized?.some((r) => r.kind === "value-predicate") === true,
      { pag: pag?.recognized, dd: dd?.recognized });
    check("emitted: embedded-JSON reads are spelled with {} (stepJson, config)",
      cmds.find((c) => c.command === "jo p describe")?.keys.some((k) => k.includes("stepJson{}")) === true);
    check("emitted: rule-outs and the enumeration ride in the file; describe-batch is a traced module, not a rule-out",
      Array.isArray(emitted.ruleOuts) && emitted.ruleOuts.length > 0 && !emitted.ruleOuts.some((r) => r.file.includes("describe-batch")) && dd?.modules.includes("scripts/describe-batch.mjs") && Array.isArray(emitted.enumeration?.files) && emitted.enumeration.files.length >= 14);
    check("emitted: residuals are stated, never omitted", Array.isArray(emitted.residuals) && emitted.residuals.length >= 5 && !emitted.residuals.some((r) => r.startsWith("EMITTED WITH --fast")));
  }

  // ── 3: the emitter refuses an unknown command (stub tracer) ───────────────
  const stub = join(tmp, "stub-tracer.mjs");
  writeFileSync(stub, `process.stdout.write(JSON.stringify({ commands: [{ command: "zz nope", readers: [], modules: [], keys: ["a"], walks: [], embedded: [], floor: [], probes: { fixtures: 1, runs: 1 } }], ruleOuts: [], enumeration: { files: [] }, residuals: [] }));\n`);
  const r3 = run([EMITTER, "--out", join(tmp, "c.json")], { READER_SHAPES_TRACER: stub });
  check("emitter (mutant): a command missing from the catalog is refused, exit 1, named", r3.status === 1 && /zz nope/.test(r3.stderr) && !existsSync(join(tmp, "c.json")), { status: r3.status, stderr: r3.stderr });
  // joinCatalog in memory: an empty key list and a lost floor key are refusals too
  const cat = readJsonFile(join(ROOT, "data", "catalog.json"));
  const empty = joinCatalog({ commands: [{ command: "cn list", readers: [], modules: [], keys: [], walks: [], embedded: [], floor: [], probes: {} }], ruleOuts: [], enumeration: {}, residuals: [] }, cat);
  check("emitter (mutant): an empty key list is refused", empty.problems.some((p) => /observed no keys/.test(p)), empty.problems);
  // Gate 2 for 0.36.2: the floor rule lives in the tracer only — a trace
  // without floorMissing is refused, never re-derived with a weaker rule.
  check("emitter (mutant): a trace lacking floorMissing is refused (no second floor rule in the emitter)", empty.problems.some((p) => /lacks floorMissing/.test(p)), empty.problems);
  const lost = joinCatalog({ commands: [{ command: "cn list", readers: [], modules: [], keys: ["x"], walks: [], embedded: [], floor: ["pnpConnectionsInfo.connectionId"], floorMissing: ["pnpConnectionsInfo.connectionId"], probes: { unprobed: 0 } }], ruleOuts: [], enumeration: {}, residuals: [] }, cat);
  check("emitter (mutant): a floor key the tracer reports missing is refused", lost.problems.some((p) => /no longer reads floor key/.test(p)), lost.problems);
  const fast = joinCatalog({ commands: [{ command: "cn list", readers: [], modules: [], keys: ["x"], walks: [], embedded: [], floor: [], floorMissing: [], alternatesUnmeasured: [], recognized: [], probes: { unprobed: 3 } }], ruleOuts: [], enumeration: {}, residuals: [] }, cat);
  check("emitter (mutant): an emission with unprobed paths (a --fast trace) is refused", fast.problems.some((p) => /unprobed path/.test(p)), fast.problems);
  const dangle = joinCatalog({ commands: [{ command: "cn list", readers: [], modules: [], keys: ["x"], walks: [], embedded: [], floor: [], floorMissing: [], alternates: { x: ["data.RULE[].y"] }, alternatesUnmeasured: [], recognized: [], probes: { unprobed: 0 } }], ruleOuts: [], enumeration: {}, residuals: [] }, cat);
  check("emitter (mutant): an alternates side that is not a key (an uncollapsed spelling) is refused", dangle.problems.some((p) => /alternates that are not keys/.test(p)), dangle.problems);
  const m4 = run([TRACER_PATH, "--fast", "--mutate-recognized", "*paginated-list:totalWidgets"]);
  check("tracer (mutant): a recognized name the corpus does not carry fails the suite (a Set that grew before its fixture)", m4.status === 1 && /FAIL  recognized: \*paginated-list/.test(m4.stdout), { status: m4.status, tail: m4.stdout.slice(-400) });

  // ── 4: the tracer's reds, from outside (--fast: the in-process assertions are what these mutants target) ──
  const m1 = run([TRACER_PATH, "--fast", "--mutate-floor", "cn list:pnpConnectionsInfo.nope"]);
  check("tracer (mutant): a floor key the reader does not read fails the suite", m1.status === 1 && /FAIL  floor: cn list/.test(m1.stdout), { status: m1.status, tail: m1.stdout.slice(-400) });
  const m2 = run([TRACER_PATH, "--fast", "--mutate-enumeration", "scripts/phantom-reader.mjs"]);
  check("tracer (mutant): a JSON-parsing script with no row and no rule-out fails the enumeration closure", m2.status === 1 && /uncovered/.test(m2.stdout) && /phantom-reader/.test(m2.stdout), { status: m2.status, tail: m2.stdout.slice(-400) });
  const m3 = run([TRACER_PATH, "--fast", "--mutate-drop-reader", "jo dd list"]);
  check("tracer (mutant): a command whose readers never run fails 'at least one key'", m3.status === 1 && /FAIL  trace: jo dd list/.test(m3.stdout), { status: m3.status, tail: m3.stdout.slice(-400) });

  // ── 5: declaration rot ────────────────────────────────────────────────────
  check(`emitter: the tracer it spawns exists in the tree (${TRACER})`, existsSync(TRACER_PATH));
  check("emitter: the preload the tracer loads exists in the tree", existsSync(join(ROOT, "plugins/gs-superadmin/test/fixtures/trace-preload.mjs")));
} finally {
  removeTempDir(tmp);
}

console.log(`\n${failures === 0 ? "All" : `${passed} of ${passed + failures}`} emit-reader-shapes checks passed${failures ? ` — ${failures} FAILED` : ""}`);
process.exitCode = failures === 0 ? 0 : 1;
