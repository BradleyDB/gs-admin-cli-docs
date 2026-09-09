#!/usr/bin/env node
// Import-graph check: the repo's import topology, declared ONCE as data and
// mechanically enforced (GP-B5 W0, DS-14/DS-20). The topology was previously
// held in scattered comments — prose-held prohibition, the weakest tier
// (F-157/F-267): construction cannot carry a prohibition, so this is checked.
//
// The LAYERS/RESTRICTED/SANCTIONED_DYNAMIC tables below are the declaration of
// record — which lanes exist, who may import whom, which files import nothing
// (or builtins only) and why. Every tracked .mjs file must belong to a lane;
// every real import edge (static, re-export, or dynamic) must be permitted by
// the declaration; bare package specifiers are forbidden everywhere (the
// zero-dependency tenet, AGENTS.md design tenet 5). An edge or file the
// declaration does not cover FAILS — extending the graph is a deliberate,
// reviewed edit to this file. (Register ids cited in the tables — R-1/R-2/R-3,
// F-numbers — name the tenet/finding record behind each rule; the `why`
// strings are self-sufficient without the archive.)
//
// Anti-silent-shrink teeth, each mutation-proved at review:
//   - per-lane discovery floors (F-200 pattern) — a lexer regression that
//     under-scans cannot pass as "no violations";
//   - every RESTRICTED / SANCTIONED_DYNAMIC path must exist in the tracked
//     set — a rename cannot silently retire the rule it declares;
//   - EDGE_FLOORS keys must name declared lanes — a lane rename cannot
//     silently disable its floor;
//   - a `from "…"` match whose literal cannot be keyed back, and a dynamic
//     import with no resolvable literal, are FAILURES, never skips.
import { readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, readJsonFile } from "./lib.mjs";
import { maskCode } from "./defect-classes.mjs";

// ── The declaration (data of record) ─────────────────────────────────────────
// Lanes are keyed by repo-root-relative path prefix (longest prefix wins).
// `mayImport` lists the lanes a file in this lane may import local files from
// (its own lane included only if listed — nothing is implicit).
const LAYERS = {
  build: {
    prefix: "build/",
    mayImport: ["build", "test-rig"],
    why: "generators + checks + their fixtures; may share within build/ and use the test rig, never reach into the plugin",
  },
  "test-rig": {
    prefix: "test/",
    mayImport: [],
    why:
      "shared test rig (DS-22): temp-dir + spawnSync plumbing only, imported by both test lanes; " +
      "assertions stay in the suites (R-10 carve-out, quoted verbatim in test/rig.mjs)",
  },
  "plugin-scripts": {
    prefix: "plugins/gs-superadmin/scripts/",
    mayImport: ["plugin-scripts"],
    why: "shipped plugin scripts; shared helpers live in doc-lib/journal-lib inside the lane",
  },
  "plugin-hooks": {
    prefix: "plugins/gs-superadmin/hooks/",
    mayImport: [],
    why: "the guard hook imports no local module statically (tenet; R-1) — see SANCTIONED_DYNAMIC",
  },
  "plugin-test": {
    prefix: "plugins/gs-superadmin/test/",
    mayImport: ["plugin-scripts", "test-rig", "plugin-test"],
    why:
      "fixture suites import the scripts they pin (plus the shared test rig — dev-only reach outside " +
      "the plugin dir; tests are not consumer surface, R-10); the guard hook is driven by spawn, never imported; " +
      "own-lane imports are the shared payload corpus and the trace engine under test/fixtures/ (CLI-adoption arm, " +
      "2026-09-04) — one set of fixture bytes for the suites AND the reader-shape tracer, never per-suite copies",
  },
  "skill-scripts": {
    prefix: "plugins/gs-superadmin/skills/",
    mayImport: [],
    why: "skill-local scripts are self-contained (F-130) — a skill dir must work when read in isolation",
  },
};

// Per-file restrictions, tighter than the lane rule. mode "none": the file
// imports NOTHING at all, not even node: builtins. mode "builtins": node:
// builtins only — no local imports, no bare packages.
const RESTRICTED = {
  "plugins/gs-superadmin/scripts/journal-lib.mjs": {
    mode: "none",
    id: "F-157",
    why:
      "the guard lazy-imports this module as a unit; any import here (even a builtin) widens the " +
      "syntax-failure surface that would degrade ALL guard journal writes to the systemMessage alert",
  },
  "plugins/gs-superadmin/hooks/gs-admin-guard.mjs": {
    mode: "builtins",
    id: "R-1",
    why:
      "tenet-locked: the PreToolUse mutation-gate path is fully self-contained; its only local " +
      "reach is the sanctioned lazy journal-lib load below",
  },
  "build/extract-catalog.mjs": {
    mode: "builtins",
    id: "R-3",
    why: "dual-lane emitter: ships as a generated verbatim copy into the plugin, standalone by contract",
  },
  "build/render-cheatsheet.mjs": {
    mode: "builtins",
    id: "R-3",
    why: "dual-lane emitter: same pairing as extract-catalog (byte-identity is the seam)",
  },
  "plugins/gs-superadmin/scripts/extract-catalog.mjs": {
    mode: "builtins",
    id: "R-3",
    why: "generated verbatim copy of build/extract-catalog.mjs (must stay import-free like its source)",
  },
  "plugins/gs-superadmin/scripts/render-cheatsheet.mjs": {
    mode: "builtins",
    id: "R-3",
    why: "generated verbatim copy of build/render-cheatsheet.mjs (must stay import-free like its source)",
  },
  "plugins/gs-superadmin/scripts/plugin-link.mjs": {
    mode: "builtins",
    id: "DS-43",
    why:
      "the workspace plugin-link writer runs at every plugin session start (hooks.json SessionStart) — " +
      "a local import would widen the syntax-failure surface of the one script every session depends on",
  },
  "build/defect-classes.mjs": {
    mode: "none",
    id: "W10",
    why:
      "the defect-class registry as data (GP-B5 W10): check-doc-drift executes its rows and check-stale-facts " +
      "reads its keys; the stale-facts rig copies it beside the checker exactly as it copies lib.mjs, so a local " +
      "import here would dangle at spawn time — and a builtin is not needed for a table",
  },
  "build/lib.mjs": {
    mode: "builtins",
    id: "DS-16",
    why:
      "the build lane's shared module: four scratch-rig harnesses copy exactly this one file beside the " +
      "script under test, so a local import here would break them all at spawn time — and every build " +
      "generator (this check included) loads it, so it must never reach test plumbing",
  },
};

// Build-lane root-preamble rule (DS-16): the repo-root preamble lives once, in
// build/lib.mjs's ROOT — a build-lane file re-spelling it reopens the F-267
// class the module closed. The two R-3 dual-lane emitters keep their own by
// tenet (they may not import the module). The needle is the PREAMBLE shape
// (dirname-wrapped fileURLToPath), assembled so this file never contains it
// whole; a bare fileURLToPath(import.meta.url) read stays legal (e.g.
// check-doc-drift's self-source scan).
const PREAMBLE_NEEDLE = "dirname(fileURLToPath(import" + ".meta.url)";
const PREAMBLE_HOMES = new Set(["build/lib.mjs", "build/extract-catalog.mjs", "build/render-cheatsheet.mjs"]);

// The one sanctioned dynamic local edge (R-2): the guard's lazy journal-lib
// load inside its fail-open try block. Degraded-failure mode is pinned by
// guard-fixtures ("missing journal-lib degrades to systemMessage alert").
const SANCTIONED_DYNAMIC = [
  {
    from: "plugins/gs-superadmin/hooks/gs-admin-guard.mjs",
    to: "plugins/gs-superadmin/scripts/journal-lib.mjs",
  },
];

// Per-lane local-edge discovery floors: the scan must find at least this many
// local edges per lane, or the lexer has silently shrunk (F-200). Floors sit
// below the current counts, well above zero. Keyed by the SPEC SHAPE the
// lexer sees (redesigned at B5 W8 per A-9 — the third hand tune of this
// family, W1 total, W3 total → tail, W8 tail, so the model changed instead):
//   total   — every local edge the lane yields (the W1 shape, unchanged);
//   sibling — specs spelled "./…" (same-directory imports);
//   parent  — specs spelled "../…" one level up;
//   deep    — specs spelled "../../…" or further (the plugin suites' reach
//             to the shared test rig).
// Why shapes: the regression class these teeth exist for is a lexer that
// stops SEEING one spelling of a specifier while the others survive — e.g.
// every "../test/rig.mjs" edge dropped while the "./lib.mjs" hub edges keep
// the total healthy (B2 review, finder B; W3 review, finders A/B/C). W3
// guarded that with a "tail" (edges outside the dominant target) — a
// target-dominance PROXY for shape, which any deliberate non-hub edge of a
// different shape perturbed: W8's two sibling generator imports lifted the
// tail past the "drop every ../ spec" mutant and forced a re-baseline (the
// W8 review round). A per-shape count is immune to growth in the OTHER
// shapes and to hub growth alike: the mutant zeroes its shape outright, so
// the kill is structural, and a floor re-baselines only when a lane
// deliberately retires its last edges of one shape — rare, and deliberate.
// Baselines at B5 W8 (live tallies, printed on the pass line): build 24
// (./21 ../3), plugin-scripts 29 (./29), plugin-test 27 (../19 ../../5).
const EDGE_FLOORS = {
  build: { total: 17, sibling: 15, parent: 2 },
  "plugin-scripts": { total: 18, sibling: 20 },
  "plugin-test": { total: 15, parent: 15, deep: 3 },
};
const SHAPE_SPELLING = { sibling: "./", parent: "../", deep: "../../" };
const specShape = (spec) =>
  spec.startsWith("../../") ? "deep" : spec.startsWith("../") ? "parent" : spec.startsWith("./") ? "sibling" : "other";

// ── Source scan: extract real import edges ───────────────────────────────────
// A small lexer walks each file tracking line/block comments, string literals,
// template literals, and regex literals, then records:
//   - static imports / re-exports:  import … from "spec" · export … from "spec"
//   - side-effect imports:          import "spec"
//   - dynamic imports:              import( <arg> ) — resolved from the arg's
//     string/template literals (node: exempt; template prefixes resolve as
//     lane-wildcard edges)
// The code view is the registry's maskCode (build/defect-classes.mjs) — ONE
// lexer for the tree (F-385): this file used to carry its own, which handled
// regex-vs-division by token but scanned a template body to the next backtick,
// so a nested template inside `${ … }` closed the outer one early and left the
// lexer in template mode over real code (the guard's tail from its line 1536,
// jo-report-program.mjs 218-365) where an import would have gone unseen.
// maskCode keeps every delimiter and blanks every body (strings, regexes,
// comments, whole templates), so the literal records are read straight off the
// view: a kept quote or backtick is a delimiter and the next one in the view is
// its close. Backstops: unkeyable matches are failures, and the floors above
// bound the blast radius.

function stripToCode(src) {
  // Returns src with comments, string/template bodies, and regex bodies
  // replaced by spaces (delimiters kept so edges stay findable), plus the
  // string and template literals with their offsets.
  const code = maskCode(src.split("\n")).join("\n");
  const strings = [];   // { start, value }  — '…' / "…"
  const templates = []; // { start, value }  — `…` raw body, ${} kept verbatim
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c !== '"' && c !== "'" && c !== "`") continue;
    let close = code.indexOf(c, i + 1);
    if (c !== "`") { // a string never crosses a raw newline (the mask resets there)
      const nl = code.indexOf("\n", i);
      if (nl >= 0 && (close < 0 || close > nl)) close = nl;
    }
    const end = close < 0 ? src.length : close;
    (c === "`" ? templates : strings).push({ start: i, value: src.slice(i + 1, end).replace(/\\([\s\S])/g, "$1") });
    i = end;
  }
  return { code, strings, templates };
}

// Edge kinds: static | dynamic (string-literal target) | dynamic-template
// (template literal; resolved by its static prefix directory) |
// unkeyable-static / dynamic-unresolvable (always problems).
function extractEdges(src) {
  const { code, strings, templates } = stripToCode(src);
  const stringAt = (offset) => strings.find((s) => s.start === offset);
  const edges = [];
  const staticRe = /\b(?:import|export)\b[\s\w$*{},]*?\bfrom\s*(["'])/g;
  const sideRe = /\bimport\s*(["'])/g;
  for (const re of [staticRe, sideRe]) {
    let m;
    while ((m = re.exec(code))) {
      const quoteOffset = m.index + m[0].length - 1;
      const lit = stringAt(quoteOffset);
      if (lit) edges.push({ spec: lit.value, kind: "static" });
      else edges.push({ spec: null, kind: "unkeyable-static", offset: quoteOffset });
    }
  }
  const dynRe = /\bimport\s*\(/g;
  let dm;
  while ((dm = dynRe.exec(code))) {
    let depth = 1;
    let j = dm.index + dm[0].length;
    const argStart = j;
    while (j < code.length && depth > 0) {
      if (code[j] === "(") depth++;
      else if (code[j] === ")") depth--;
      j++;
    }
    const inArg = (s) => s.start >= argStart && s.start < j;
    const strLits = strings.filter(inArg);
    const tplLits = templates.filter(inArg);
    // node: builtins are legal in dynamic position everywhere the lane allows
    // builtins (the guard's own fail-open shape) — same exemption as static.
    if (strLits.some((s) => s.value.startsWith("node:"))) continue;
    const mjsStr = strLits.find((s) => s.value.includes(".mjs"));
    const mjsTpl = tplLits.find((s) => s.value.includes(".mjs"));
    if (mjsStr) edges.push({ spec: mjsStr.value, kind: "dynamic" });
    else if (mjsTpl) edges.push({ spec: mjsTpl.value, kind: "dynamic-template" });
    else edges.push({ spec: null, kind: "dynamic-unresolvable" });
  }
  return edges;
}

// ── Enumerate tracked .mjs files and classify ────────────────────────────────
// argv-array execFileSync, no shell — a shell spelling would glob-expand the
// pathspec at ROOT on POSIX CI (the F-095 doctrine the other checks carry);
// do not "simplify" this to execSync.
const tracked = execFileSync("git", ["ls-files", "-z", "--", "*.mjs"], { cwd: ROOT, encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .map((f) => f.replace(/\\/g, "/"));

if (tracked.length < 30 || !tracked.some((f) => f.includes("/"))) {
  console.error(
    `✗ coverage floor: git ls-files returned ${tracked.length} tracked .mjs files` +
      ` (nested: ${tracked.filter((f) => f.includes("/")).length}) — the enumeration has shrunk`
  );
  process.exit(1);
}

const laneOf = (rel) => {
  let best = null;
  for (const [name, lane] of Object.entries(LAYERS)) {
    if (rel.startsWith(lane.prefix) && (!best || lane.prefix.length > LAYERS[best].prefix.length)) best = name;
  }
  return best;
};

const problems = [];
const laneEdgeCounts = Object.fromEntries(Object.keys(LAYERS).map((k) => [k, 0]));
// Per-lane per-SHAPE tallies feed the shape floors (specShape above).
const laneShapeCounts = Object.fromEntries(Object.keys(LAYERS).map((k) => [k, { sibling: 0, parent: 0, deep: 0, other: 0 }]));
const fileSet = new Set(tracked);
const byBasename = new Map();
for (const f of tracked) {
  const b = posix.basename(f);
  if (!byBasename.has(b)) byBasename.set(b, []);
  byBasename.get(b).push(f);
}
let sanctionedDynamicSeen = 0;

// Declaration self-checks: a stale path or lane key must fail loudly, never
// silently retire the rule it declares (mutation-proved at review).
for (const p of Object.keys(RESTRICTED)) {
  if (!fileSet.has(p)) problems.push(`declaration rot: RESTRICTED names ${p}, which is not a tracked file — update the declaration with the rename`);
}
for (const s of SANCTIONED_DYNAMIC) {
  for (const p of [s.from, s.to]) {
    if (!fileSet.has(p)) problems.push(`declaration rot: SANCTIONED_DYNAMIC names ${p}, which is not a tracked file`);
  }
}
for (const lane of Object.keys(EDGE_FLOORS)) {
  if (!(lane in LAYERS)) problems.push(`declaration rot: EDGE_FLOORS names lane "${lane}", which is not declared in LAYERS — its floor is dead`);
}
for (const p of PREAMBLE_HOMES) {
  if (!fileSet.has(p)) problems.push(`declaration rot: PREAMBLE_HOMES names ${p}, which is not a tracked file — update the declaration with the rename`);
}
// Every declared lane must have at least one tracked member: a renamed or
// relocated directory must fail here, not silently leave an empty lane whose
// mayImport grants still appear in other lanes' lists (B2 review, finder B —
// same rot class as the RESTRICTED/SANCTIONED_DYNAMIC path checks above).
for (const [name, lane] of Object.entries(LAYERS)) {
  if (!tracked.some((f) => f.startsWith(lane.prefix))) {
    problems.push(`declaration rot: lane "${name}" (prefix ${lane.prefix}) matches no tracked file — update the declaration with the rename/move`);
  }
}

for (const rel of tracked) {
  const lane = laneOf(rel);
  if (!lane) {
    problems.push(`${rel}: not covered by any declared lane — add it to a lane in build/check-imports.mjs (deliberately) or move it`);
    continue;
  }
  const src = readFileSync(join(ROOT, rel), "utf8");
  if (lane === "build" && !PREAMBLE_HOMES.has(rel) && src.includes(PREAMBLE_NEEDLE)) {
    problems.push(
      `${rel}: re-spells the repo-root preamble (F-267 class) — import { ROOT } from "./lib.mjs" instead; ` +
        `only the DS-16 home and the R-3 dual-lane emitters may carry their own (PREAMBLE_HOMES in this check)`,
    );
  }
  const edges = extractEdges(src);
  const restricted = RESTRICTED[rel];

  if (restricted?.mode === "none" && edges.length > 0) {
    problems.push(`${rel}: declared no-import (${restricted.id}) but has ${edges.length} import(s): ${edges.map((e) => e.spec ?? `<${e.kind}>`).join(", ")}`);
    continue;
  }

  for (const e of edges) {
    if (e.kind === "unkeyable-static") {
      problems.push(`${rel}: an import/export-from specifier at offset ${e.offset} could not be keyed back to a literal — the scan is desynced on this file`);
      continue;
    }
    if (e.kind === "dynamic-unresolvable") {
      problems.push(`${rel}: dynamic import whose argument carries no resolvable literal (node:, .mjs string, or .mjs template) — name the target in a literal so the graph stays checkable`);
      continue;
    }
    const spec = e.spec;
    if (spec.startsWith("node:")) continue; // builtins: allowed everywhere except mode "none" (handled above)
    // Resolve the target file (or, for a template edge, its directory's lane).
    let target = null;
    let targetLane = null;
    let label = spec;
    if (e.kind === "dynamic-template") {
      // `./jo-report-${mode}.mjs` — resolve the static prefix's directory and
      // record a wildcard edge into that directory's lane.
      const prefix = spec.split("$")[0];
      if (!prefix.includes("/") || !prefix.startsWith(".")) {
        problems.push(`${rel}: dynamic template import \`${spec}\` has no resolvable relative directory prefix — make the prefix a relative path`);
        continue;
      }
      const dir = posix.join(posix.dirname(rel), posix.dirname(prefix + "x"));
      targetLane = laneOf(dir + "/");
      label = `\`${spec}\` (wildcard into ${dir}/)`;
    } else if (spec.startsWith(".")) {
      target = posix.join(posix.dirname(rel), spec);
    } else if (spec.endsWith(".mjs")) {
      // dynamic import assembled with join(...): a bare .mjs basename literal —
      // unique-match it against the tracked set.
      const hits = byBasename.get(spec) ?? [];
      if (hits.length === 1) target = hits[0];
      else {
        problems.push(`${rel}: dynamic import of "${spec}" is ${hits.length === 0 ? "an unknown file" : `ambiguous (${hits.join(", ")})`} — use a path literal`);
        continue;
      }
    } else {
      problems.push(`${rel}: bare specifier "${spec}" — packages are forbidden (zero-dependency tenet 5)`);
      continue;
    }
    if (target != null) {
      if (!fileSet.has(target)) {
        problems.push(`${rel}: import "${spec}" resolves to ${target}, which is not a tracked file`);
        continue;
      }
      targetLane = laneOf(target);
    }
    laneEdgeCounts[lane]++;
    laneShapeCounts[lane][specShape(spec)]++;
    const sanctioned =
      target != null && SANCTIONED_DYNAMIC.some((s) => s.from === rel && s.to === target && e.kind === "dynamic");
    if (sanctioned) { sanctionedDynamicSeen++; continue; }
    if (restricted?.mode === "builtins") {
      problems.push(`${rel}: declared builtin-only (${restricted.id}) but imports ${target ?? label}`);
      continue;
    }
    if (!LAYERS[lane].mayImport.includes(targetLane)) {
      problems.push(`${rel} (lane ${lane}): undeclared edge to ${target ?? label} (lane ${targetLane}) — lane may import [${LAYERS[lane].mayImport.join(", ") || "nothing"}]`);
    }
  }
}

// ── Discovery floors ─────────────────────────────────────────────────────────
for (const [lane, floors] of Object.entries(EDGE_FLOORS)) {
  const total = laneEdgeCounts[lane] ?? 0;
  if (total < floors.total) {
    problems.push(`discovery floor: lane ${lane} yielded ${total} local edge(s), floor is ${floors.total} — the import scan has silently shrunk`);
  }
  for (const [shape, floor] of Object.entries(floors)) {
    if (shape === "total") continue;
    if (!(shape in SHAPE_SPELLING)) {
      problems.push(`declaration rot: EDGE_FLOORS.${lane} names shape "${shape}", which specShape never yields — its floor is dead`);
      continue;
    }
    const seen = laneShapeCounts[lane]?.[shape] ?? 0;
    if (seen < floor) {
      problems.push(
        `discovery floor: lane ${lane} yielded ${seen} ${shape}-relative ("${SHAPE_SPELLING[shape]}…") edge(s) ` +
          `(${total} total), floor is ${floor} — the scan has stopped seeing that spec spelling while the others survive`,
      );
    }
  }
}
const shapeLine = (l) =>
  ["sibling", "parent", "deep"].filter((s) => laneShapeCounts[l][s]).map((s) => `${SHAPE_SPELLING[s]}${laneShapeCounts[l][s]}`).join(" ");
if (sanctionedDynamicSeen !== SANCTIONED_DYNAMIC.length) {
  problems.push(`discovery floor: found ${sanctionedDynamicSeen}/${SANCTIONED_DYNAMIC.length} sanctioned dynamic edge(s) — the guard's lazy journal-lib load must be visible to this scan`);
}

// ── Manifest half of tenet 5 (GP-B5 DS-42 carve-out) ─────────────────────────
// The import scan above enforces "nothing imports a package"; this enforces
// "no package is declared" — package.json may carry exactly the ratified
// checker-only devDependencies (AGENTS.md tenet 5 names them; this list is the
// data it points at) and no runtime dependency field at all. Both directions
// fail: an extra entry (creep) and a missing one (the tsc gate silently gone).
const ALLOWED_DEV_DEPENDENCIES = ["@types/node", "typescript"];
const RUNTIME_DEPENDENCY_FIELDS = ["dependencies", "peerDependencies", "optionalDependencies", "bundleDependencies", "bundledDependencies"];
// The Node typings major tracks the Node major CI runs the gate on — the ONE
// Dependabot ignore (.github/dependabot.yml) is a pin to the runtime, and the
// rule "lift it in the same change that moves CI's Node major" was prose only
// (W8.5 review): every `node-version:` in these workflows must equal the
// @types/node major, in both directions.
const CI_WORKFLOWS_WITH_NODE = [".github/workflows/docs-drift.yml", ".github/workflows/validate-plugin.yml"];
{
  const pkg = readJsonFile(join(ROOT, "package.json"));
  const typesMajor = /^(\d+)\./.exec(String(pkg.devDependencies?.["@types/node"] ?? ""))?.[1];
  for (const wf of CI_WORKFLOWS_WITH_NODE) {
    const nodeVersions = [...readFileSync(join(ROOT, wf), "utf8").matchAll(/^\s*node-version:\s*["']?(\d+)/gm)].map((m) => m[1]);
    if (!nodeVersions.length) problems.push(`${wf}: no node-version line found — the @types/node major is pinned to CI's Node major and this file is where that major is read from (widen CI_WORKFLOWS_WITH_NODE only with a file that sets it)`);
    for (const v of nodeVersions) {
      if (v !== typesMajor) problems.push(`${wf}: node-version ${v} but package.json pins @types/node major ${typesMajor ?? "(unparseable)"} — the typings major tracks CI's Node major (dependabot.yml's one ignore); move both in the same change`);
    }
  }
  for (const field of RUNTIME_DEPENDENCY_FIELDS) {
    if (pkg[field] !== undefined) {
      problems.push(`package.json: "${field}" is declared — runtime packages are forbidden (zero-dependency tenet 5; the one carve-out is the checker-only devDependencies)`);
    }
  }
  const declared = Object.keys(pkg.devDependencies ?? {}).sort();
  const extra = declared.filter((d) => !ALLOWED_DEV_DEPENDENCIES.includes(d));
  const missing = ALLOWED_DEV_DEPENDENCIES.filter((d) => !declared.includes(d));
  if (extra.length) {
    problems.push(`package.json: devDependencies beyond the ratified checker-only set: ${extra.join(", ")} — tenet 5's carve-out names exactly ${ALLOWED_DEV_DEPENDENCIES.join(" + ")}; widen ALLOWED_DEV_DEPENDENCIES here AND the tenet, or drop the package`);
  }
  if (missing.length) {
    problems.push(`package.json: ratified checker-only devDependencies missing: ${missing.join(", ")} — the tsc gate cannot run; restore them, or retire the carve-out in AGENTS.md tenet 5 AND here together`);
  }
}

if (problems.length) {
  console.error(`✗ check-imports: ${problems.length} problem(s)\n`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(
  `✓ check-imports: ${tracked.length} tracked .mjs files classified across ${Object.keys(LAYERS).length} lanes; ` +
    `${Object.values(laneEdgeCounts).reduce((a, b) => a + b, 0)} local edges all declared ` +
    `(floors met — ${Object.keys(EDGE_FLOORS).map((l) => `${l} ${laneEdgeCounts[l]} (${shapeLine(l)})`).join(", ")}; ` +
    `${sanctionedDynamicSeen} sanctioned dynamic); package.json declares exactly the ${ALLOWED_DEV_DEPENDENCIES.length} ratified checker-only devDependencies and no runtime dependency field; @types/node major equals node-version in ${CI_WORKFLOWS_WITH_NODE.length} workflows`
);
