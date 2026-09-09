#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// emit-reader-shapes.mjs — writes data/reader-shapes.json, the plugin's
// READ SURFACE: for every CLI command whose output a KB reader indexes, the
// payload keys the readers actually dereference (CLI-adoption arm, D1–D3,
// 2026-09-04).
//
// Source of the keys: plugins/gs-superadmin/test/trace-reader-shapes.mjs
// --json — a MEASUREMENT (every reader run over the shared fixture corpus
// under a recording Proxy; see the tracer's header), spawned here because the
// build lane may not import plugin code (build/check-imports.mjs LAYERS).
// This emitter adds what only the build lane knows: the catalog join (command
// → id / actionKey / mcpTool / endpoints from data/catalog.json), the pin the
// map was measured against, and the banner.
//
// Who reads the file: the gs-fortress watch, at every CLI audit
// (impact-checklist item 11) — `git show dev:data/reader-shapes.json` at the
// audited explorer commit, then, for each upstream handler file that changed,
// the keys of the commands routing to it, at leaf depth. A key projected
// away, renamed or re-nested is a Bucket A break. The file is therefore a
// CROSS-REPO CONTRACT: `schemaVersion` bumps on any shape change to THIS
// file's structure, and the fortress reader refuses a version it does not
// know. Two readers, two repos — never a quiet patch.
//
// Guarded like every generated file: CI's docs-drift "Regenerate everything"
// step runs this emitter and `git diff --exit-code` refuses a committed copy
// that differs. A reader that reads a new key, or stops reading an old one,
// changes this file in the PR that changed the reader — the sync signal lands
// in this repo's own review, before the other repo ever looks.
//
//   node build/emit-reader-shapes.mjs [--out <path>]      (npm run build:reader-shapes)
//
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { ROOT, readJsonFile, isMainModule } from "./lib.mjs";

// schemaVersion 2 (2026-09-05, the F-390 verdict): keys are CONCRETE (walk-derived
// segments collapse to `*`), and rows gained enumerated / alternates /
// pluginAuthored / pluginKeys / floorMissing; the file gained `fields`. A
// reader that knows only 1 must refuse 2 — the fortress item 11 names the
// version it reads.
// schemaVersion 3 (2026-09-05, the F-390 round-2 verdict): alternates are spelled
// exactly as keys and join by string equality; rows gained alternatesUnmeasured
// (measured-none vs never-measured) and recognized (name-set / prefix / value
// predicates read off the reader's source); caller-supplied names are `<name>`
// placeholders in the path grammar.
export const SCHEMA_VERSION = 3;
export const TRACER = "plugins/gs-superadmin/test/trace-reader-shapes.mjs";
export const OUTPUT = "data/reader-shapes.json";

/** The path grammar the `keys` are spelled in — copied into the file so a reader needs no other document. */
export const PATH_GRAMMAR = {
  "a.b.c": "object keys, dot-joined, from the payload root — every named segment is one the reader's code dereferences (recorded even when absent from the fixture)",
  "a.items[]": "an array element (every element is one path; the index is collapsed)",
  "a.cfg{}": "the object PARSED from the JSON string at a.cfg (embedded JSON the reader JSON.parses)",
  "a.*": "the reader enumerated a's keys (Object.keys / entries / spread / JSON.stringify) — a walk: every key under a is read; a segment spelled `*` mid-path was reached only through such a walk (the fixture's names for it are under `enumerated`)",
  "[]": "the payload root is itself an array",
  "<name>": "a caller-supplied or tenant-recorded name the reader dereferences (the KB manifest's <idField>, an --items-path's <itemsPath>) — the reader reads whatever was recorded; the literal is never a contract",
};

/** Every field of the file and of a command row — so a reader in another repo needs nothing from this one. */
export const FIELDS = {
  file: {
    _generated: "the GENERATED banner (regenerate with npm run build:reader-shapes)",
    schemaVersion: "this file's structure version — a cross-repo contract; refuse a version you do not know",
    cliVersion: "the CLI pin the corpus and the readers were measured against (data/catalog.json meta.cliVersion)",
    what: "one paragraph: what this file is and who reads it",
    pathGrammar: "how `keys`, `floor`, `embedded` and `pluginKeys` are spelled",
    fields: "this dictionary",
    commands: "one row per CLI command whose output a KB reader indexes (see `row`)",
    ruleOuts: "scripts that parse JSON but read no tenant CLI output, each with why — the enumeration's complement",
    enumeration: "the JSON-parsing-script enumeration: pattern, dirs, files — every file is a row's module or a rule-out (closure proved by the tracer)",
    residuals: "the measurement's stated limits — read before trusting a row",
  },
  row: {
    command: "the catalog shortPath (`re r describe`) — or a symbolic command: `*indexed-list` (every indexed list command) / `*paginated-list` (every paginated capture)",
    catalog: "the command's catalog join: id, actionKey (the manifest action — resolve its handler in the audited package), mcpTool, endpoints; null for a symbolic command",
    readers: "the reader functions and helper chains that produced the row (prose, for humans)",
    modules: "the plugin script files this row covers in the enumeration closure",
    keys: "the read surface: CONCRETE paths the code dereferences, plus walk markers (`a.*`); a `*` segment mid-path is a walk-derived hop. A key here projected away, renamed or re-nested upstream is a break unless an alternate survives",
    walks: "the subset of keys that are walk markers",
    enumerated: "per walk marker, the fixture keys the enumeration touched — the corpus's names, not the code's; a name-set reader (membership over Object.keys) shows its recognized names here",
    alternates: "path → the paths the reader fell back to when that path was absent (measured by deletion, credited against the run the path was present in — a child gets its own credit); both sides are spelled exactly as keys are, so they join by string equality. A rename that leaves an alternate standing is survivable at that site",
    alternatesUnmeasured: "named keys no run ever deleted (absent from every fixture): for these, an empty alternates entry means NOT MEASURED, never 'no fallback' — read the reader before calling one a break",
    recognized: "how the row's reader recognizes keys WITHOUT dereferencing them, read off its source: kind name-set (the Sets and every name — each asserted under enumerated), prefix (a rename keeping the prefix is read), value-predicate (the literal). Invisible to the trace by construction; here so a Set that grows goes red until the corpus carries the name. A DECLARED SUBSET, not a closed enumeration — an empty or absent `recognized` does NOT mean the row's reader has no recognizer; see residuals for what is known undeclared",
    embedded: "paths whose STRING value the reader JSON.parses (spelled with {} in keys)",
    pluginAuthored: "path prefixes the PLUGIN writes into the KB doc body (never CLI output)",
    pluginKeys: "reads under pluginAuthored prefixes — kept out of keys; never compare an upstream diff against them",
    floor: "the finding-backed keys the tracer's own suite refuses to lose (natural spelling; satisfied by name or under the walk that enumerates it)",
    floorMissing: "floor keys the current measurement does NOT satisfy — always empty in a committed file (the emitter refuses otherwise)",
    note: "row-specific caveats (optional)",
    probes: "fixtures traced, reader runs (populated + deletion + bare), and unprobed paths (always 0 in a committed file)",
  },
};

const argv = process.argv.slice(2);
const outIdx = argv.indexOf("--out");
const OUT_PATH = outIdx !== -1 && argv[outIdx + 1] ? resolve(argv[outIdx + 1]) : join(ROOT, OUTPUT);
// Test-only override: a stub tracer proves the emitter's refusals without editing the real one.
const tracerPath = process.env.READER_SHAPES_TRACER ? resolve(process.env.READER_SHAPES_TRACER) : join(ROOT, TRACER);

const fail = (msg) => {
  console.error(`emit-reader-shapes: ${msg}`);
  process.exitCode = 1;
};

/**
 * @param {{commands: Array<Record<string, *>>, ruleOuts: *, enumeration: *, residuals: string[]}} trace
 * @param {{meta: {cliVersion: string}, commands: Array<Record<string, *>>}} catalog
 */
export function joinCatalog(trace, catalog) {
  const byShort = new Map(catalog.commands.map((c) => [c.shortPath, c]));
  const problems = [];
  const commands = trace.commands.map((o) => {
    /** @type {null | {id: string, actionKey: string, mcpTool: string, endpoints: *}} */
    let ref = null;
    if (!o.command.startsWith("*")) {
      const c = byShort.get(o.command);
      if (!c) problems.push(`reader command ${JSON.stringify(o.command)} is not a shortPath in data/catalog.json — a renamed or removed CLI command must be re-declared in ${TRACER} before the map is rebuilt`);
      else ref = { id: c.id, actionKey: c.actionKey, mcpTool: c.mcpTool, endpoints: c.endpoints ?? [] };
    }
    if (!Array.isArray(o.keys) || o.keys.length === 0) problems.push(`reader command ${JSON.stringify(o.command)} observed no keys — the trace is empty, not the reader`);
    // The floor test lives in the tracer (floorSatisfied is walk-aware: a
    // floor key under an enumerated segment is satisfied); a trace without
    // floorMissing is refused, never re-derived here with a second, weaker
    // rule (Gate 2 for 0.36.2: the old `??` fallback was dead for a real trace
    // and would have reported 14 walk-satisfied floor keys as lost if reached).
    if (!Array.isArray(o.floorMissing)) problems.push(`reader command ${JSON.stringify(o.command)} lacks floorMissing — the tracer predates schema ${SCHEMA_VERSION}`);
    const missing = o.floorMissing ?? [];
    if (missing.length) problems.push(`reader command ${JSON.stringify(o.command)} no longer reads floor key(s) ${missing.join(", ")} — a finding-backed key stopped being read`);
    if ((o.probes?.unprobed ?? 0) > 0) problems.push(`reader command ${JSON.stringify(o.command)} has ${o.probes.unprobed} unprobed path(s) — a --fast trace is never emitted; run the tracer in full`);
    // join integrity (schema 3): every alternates path, both sides, must be a key spelled identically
    const keySet = new Set(o.keys ?? []);
    const dangling = Object.entries(o.alternates ?? {}).flatMap(([p, qs]) => [p, ...qs]).filter((x) => !keySet.has(x));
    if (dangling.length) problems.push(`reader command ${JSON.stringify(o.command)} has alternates that are not keys (${dangling.slice(0, 4).join(", ")}${dangling.length > 4 ? ", …" : ""}) — both sides must be spelled as keys are`);
    if (!Array.isArray(o.alternatesUnmeasured) || !Array.isArray(o.recognized)) problems.push(`reader command ${JSON.stringify(o.command)} lacks alternatesUnmeasured / recognized — the tracer predates schema ${SCHEMA_VERSION}`);
    return {
      command: o.command,
      catalog: ref,
      readers: o.readers,
      modules: o.modules,
      keys: o.keys,
      walks: o.walks ?? [],
      enumerated: o.enumerated ?? {},
      alternates: o.alternates ?? {},
      alternatesUnmeasured: o.alternatesUnmeasured ?? [],
      recognized: o.recognized ?? [],
      embedded: o.embedded ?? [],
      pluginAuthored: o.pluginAuthored ?? [],
      pluginKeys: o.pluginKeys ?? [],
      floor: o.floor ?? [],
      floorMissing: missing,
      ...(o.note ? { note: o.note } : {}),
      probes: o.probes,
    };
  });
  return { commands, problems };
}

/** @param {ReturnType<typeof joinCatalog>["commands"]} commands  @param {*} trace  @param {string} cliVersion */
export function assemble(commands, trace, cliVersion) {
  return {
    _generated: "GENERATED FILE — do not edit by hand. Regenerate with: npm run build:reader-shapes (build/emit-reader-shapes.mjs).",
    schemaVersion: SCHEMA_VERSION,
    cliVersion,
    what: "The plugin's READ SURFACE: for each CLI command whose JSON output a KB reader indexes, the payload keys the readers dereference — measured by running every reader over the shared fixture corpus under a recording Proxy with a deletion closure (plugins/gs-superadmin/test/trace-reader-shapes.mjs). Consumed by the gs-fortress CLI-watch audit (impact-checklist item 11): a key here that an upstream release projects away, renames or re-nests is a silent zero in the plugin — unless `alternates` names a surviving fallback, and unless the key is in `alternatesUnmeasured`, where the absence of a fallback was never measured. `recognized` names what a reader matches without dereferencing. `fields` describes every field; `residuals` states what the measurement cannot see.",
    pathGrammar: PATH_GRAMMAR,
    fields: FIELDS,
    commands,
    ruleOuts: trace.ruleOuts,
    enumeration: trace.enumeration,
    residuals: trace.residuals,
  };
}

if (isMainModule(import.meta.url)) {
  let trace;
  try {
    const raw = execFileSync(process.execPath, [tracerPath, "--json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    trace = JSON.parse(raw);
  } catch (e) {
    fail(`the tracer failed or printed no JSON (${tracerPath}): ${String(e.stderr ?? e.message).slice(0, 800)}`);
  }
  if (trace) {
    const catalog = readJsonFile(join(ROOT, "data", "catalog.json"));
    const { commands, problems } = joinCatalog(trace, catalog);
    if (problems.length) {
      for (const p of problems) fail(p);
    } else {
      const out = assemble(commands, trace, catalog.meta.cliVersion);
      mkdirSync(dirname(OUT_PATH), { recursive: true });
      writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + "\n", "utf8");
      const keys = commands.reduce((a, c) => a + c.keys.length, 0);
      console.log(`reader shapes emitted (CLI ${catalog.meta.cliVersion}): ${commands.length} commands, ${keys} keys → ${OUT_PATH}`);
    }
  }
}
