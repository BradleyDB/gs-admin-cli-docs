#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// test-extract-catalog.mjs — direct suite for build/extract-catalog.mjs
// (GP-B5 DS-18; the dual-lane emitter had no suite of its own — only the
// rebuild-diff pinned it, which proves stability, not correctness).
//
// Two halves:
//   1. GENERATOR fixtures: run the emitter against a synthetic fictional
//      package (GS_ADMIN_PKG override, --out into a temp dir) and pin the
//      derivations its header promises — kebab flag naming, x-cli hidden/alias/
//      csv handling, path/shortPath/alias building, MCP tool naming + hidden,
//      example parse-vs-synthesis, afterHelpNotes, endpoint collection, counts
//      arithmetic, fail-loudly on an empty artifacts dir / wrong package root
//      (exit 1, never a near-empty catalog — the guard would prefer it).
//   2. T-1 CONTRACT CONFORMANCE against the COMMITTED data/catalog.json — the
//      probe class that caught the v2 contract defects, promoted to a suite
//      (B5 plan, DS-18 build notes): enumerate real key sets against the
//      frozen typedef instead of trusting prose.
//
// The two observed-vs-typedef discrepancies this suite's probes found
// (endpoint entries carry {name, method, path}; `char` is artifact-lane-only)
// were adjudicated as CONTRACT v3 (B2, 2026-08-16, Bradley-approved
// in-session): the frozen T-1 header now documents both, and the pins below
// assert them as contract, not as open questions.
//
// Run:  node build/test-extract-catalog.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib.mjs";
import { makeTempDir, removeTempDir, writeFiles, runNode } from "../test/rig.mjs";

const EMITTER = join(ROOT, "build", "extract-catalog.mjs");

let failures = 0;
let passed = 0;
function check(label, cond, detail) {
  if (cond) { passed++; return; }
  failures++;
  console.log(`FAIL  ${label}`);
  if (detail !== undefined) console.log(`      ${JSON.stringify(detail)}`);
}

// T-1 key sets, spelled from the frozen typedef (extract-catalog.mjs header).
// plugins/gs-superadmin/test/contract-conformance.mjs re-derives the same
// lists independently for the bundled catalog (R-10 — no shared assertion
// home exists across the two test lanes). A T-1 amendment updates both.
const T1_COMMAND_KEYS = [
  "id", "lane", "domain", "path", "shortPath", "group", "subGroup", "subSubGroup",
  "groupPath", "groupTitles", "name", "actionKey", "summary", "description",
  "mutating", "cliHidden", "mcpTool", "mcpHidden", "outputFormat", "flags",
  "examples", "afterHelpNotes", "endpoints",
].sort().join(",");
const T1_FLAG_KEYS = ["name", "flag", "char", "type", "required", "default", "enum", "csv", "description", "cliExposed"]
  .sort().join(",");
// Runtime/static flag shape: T-1's ten keys MINUS char (v3: char is
// artifact-lane-only).
const FLAG_KEYS_NO_CHAR = T1_FLAG_KEYS.split(",").filter((k) => k !== "char").join(",");

// ── Half 1: generator fixtures against a synthetic fictional package ─────────
const dir = makeTempDir("extract-catalog-test");
try {
  const pkg = join(dir, "pkg");
  writeFiles(pkg, {
    "package.json": JSON.stringify({ name: "@gainsight/gs-admin-cli", version: "0.0.0-fixture" }),
    "dist/artifacts/widgets.json": JSON.stringify({
      namespace: "widgets",
      aliases: ["wg"],
      description: "Fictional widgets domain (fixture)",
      version: "1.2.3",
      actions: {
        "list-things": {
          summary: "List things",
          cli: {
            group: "things", groupAlias: "t", name: "list", groupDescription: "Thing Ops",
            afterHelp: "Examples:\ngs-admin wg t list --limit 5",
          },
          input: {
            required: ["filter"],
            properties: {
              maxWait: { type: "number", description: "bounded wait" },
              filter: { type: "string", "x-cli": { alias: "-f" } },
              secret: { type: "string", "x-cli": { hidden: true } },
              mode: { enum: ["a", "b"] },
              cols: { type: "string", "x-cli": { csv: true, flag: "--columns" } },
            },
          },
          endpoint: { method: "GET", path: "/things" },
        },
        "save-thing": {
          summary: "Save a thing",
          mutating: true,
          cli: { group: "things", groupAlias: "t", name: "save", afterHelp: "CSV format:\nid,name" },
          mcp: { hidden: true },
          input: { required: ["thingId"], properties: { thingId: { type: "string" } } },
          endpoints: {
            create: { method: "POST", path: "/things" },
            update: { method: "PUT", path: "/things/{id}" },
          },
        },
        "sync-all": {
          summary: "Sync everything",
          mutating: true,
          cli: { name: "sync-all", hidden: true },
          mcp: { name: "widgets_custom_sync" },
        },
        // F-287 discriminator fixture: a ONE-KEY endpoints MAP. The name rule
        // branches on WHICH manifest field supplied the entries, never on
        // entry count — this action's single entry must keep its map key.
        ping: {
          summary: "Ping the service",
          cli: { name: "ping" },
          endpoints: { status: { method: "GET", path: "/status" } },
        },
      },
    }),
  });

  const outPath = join(dir, "out", "catalog.json");
  const res = runNode(EMITTER, ["--out", outPath], { env: { ...process.env, GS_ADMIN_PKG: pkg } });
  check("emitter exits 0 against the fixture package", res.status === 0, res.stderr);

  const raw = readFileSync(outPath, "utf8");
  check("output is UTF-8 with no BOM", raw.charCodeAt(0) !== 0xfeff && raw[0] === "{");
  check("output is pretty-printed at 2-space top-level indent", raw.includes('\n  "meta"'));
  const cat = JSON.parse(raw);

  // meta + counts arithmetic
  check("meta.cliVersion from the package", cat.meta.cliVersion === "0.0.0-fixture");
  check("meta.pkgResolvedVia names the env override", cat.meta.pkgResolvedVia === "GS_ADMIN_PKG env");
  const counts = cat.meta.counts;
  check("counts: 4 artifact + 12 runtime + 6 static",
    counts.artifactCommands === 4 && counts.runtimeCommands === 12 && counts.staticCommands === 6, counts);
  check("counts: totalCliCommands is the sum of the three lanes",
    counts.totalCliCommands === counts.artifactCommands + counts.runtimeCommands + counts.staticCommands);
  check("counts: totalCliCommands matches commands.length", counts.totalCliCommands === cat.commands.length);
  check("counts: domains matches domains.length", counts.domains === cat.domains.length && counts.domains === 3);
  check("counts: mcpTools equals commands with a non-null mcpTool",
    counts.mcpTools === cat.commands.filter((c) => c.mcpTool).length);
  // 3 artifact tools (save-thing is mcp-hidden) + 12 runtime; auth is CLI-only.
  check("counts: mcpTools value from the fixture shape", counts.mcpTools === 15, counts.mcpTools);

  const byKey = new Map(cat.commands.map((c) => [c.id, c]));
  const list = byKey.get("widgets:things:list");
  const save = byKey.get("widgets:things:save");
  const sync = byKey.get("widgets:sync-all");
  const ping = byKey.get("widgets:ping");
  check("artifact command ids derive namespace:groups:name", !!list && !!save && !!sync && !!ping,
    cat.commands.filter((c) => c.lane === "artifact").map((c) => c.id));

  // path/shortPath/groups
  check("path is the canonical space form", list?.path === "widgets things list");
  check("shortPath uses namespace + group aliases", list?.shortPath === "wg t list");
  check("groupTitles resolve from groupDescription", JSON.stringify(list?.groupTitles) === '["Thing Ops"]');
  check("groupless command has empty groupPath", sync?.groupPath === "" && sync?.path === "widgets sync-all");

  // flags
  const flagsByName = new Map(list.flags.map((f) => [f.name, f]));
  check("kebab flag naming (maxWait → --max-wait)", flagsByName.get("maxWait")?.flag === "--max-wait");
  check("x-cli alias becomes char without the dash", flagsByName.get("filter")?.char === "f");
  check("unaliased flag has char null", flagsByName.get("maxWait")?.char === null);
  check("x-cli hidden → flag null + cliExposed false",
    flagsByName.get("secret")?.flag === null && flagsByName.get("secret")?.cliExposed === false);
  check("x-cli explicit flag spelling honored", flagsByName.get("cols")?.flag === "--columns");
  check("x-cli csv recorded", flagsByName.get("cols")?.csv === true);
  check("enum recorded; enum-only property types as string",
    JSON.stringify(flagsByName.get("mode")?.enum) === '["a","b"]' && flagsByName.get("mode")?.type === "string");
  check("required from input.required", flagsByName.get("filter")?.required === true && flagsByName.get("maxWait")?.required === false);
  check("artifact flag objects carry exactly the T-1 ten keys",
    list.flags.every((f) => Object.keys(f).sort().join(",") === T1_FLAG_KEYS));

  // examples / afterHelp
  check("gs-admin lines in afterHelp become examples", JSON.stringify(list?.examples) === '["gs-admin wg t list --limit 5"]');
  check("example-bearing afterHelp leaves afterHelpNotes null", list?.afterHelpNotes === null);
  check("no examples → one synthesized from required flags",
    JSON.stringify(save?.examples) === '["gs-admin wg t save --thing-id <thing-id>"]', save?.examples);
  check("non-example afterHelp kept as notes", save?.afterHelpNotes === "CSV format:\nid,name");

  // mcp naming + hidden
  check("default MCP name is namespace_actionKey with dashes → underscores", list?.mcpTool === "widgets_list_things");
  check("mcp.name override honored", sync?.mcpTool === "widgets_custom_sync");
  check("mcp.hidden → mcpTool null + mcpHidden true", save?.mcpTool === null && save?.mcpHidden === true);

  // mutating / cliHidden
  check("mutating from the manifest action", save?.mutating === true && list?.mutating === false);
  check("cli.hidden → cliHidden", sync?.cliHidden === true && list?.cliHidden === false);

  // endpoints — the name rule branches on the manifest FIELD, never on entry
  // count (F-287: the first label here read "single endpoint collected as
  // name 'default'", which described a coincidence of the fixture, not the
  // mechanism — 65 of 69 single-entry actions in the real catalog are
  // map-keyed).
  check("singular `endpoint` manifest field collected as name 'default'",
    JSON.stringify(list?.endpoints) === '[{"name":"default","method":"GET","path":"/things"}]', list?.endpoints);
  check("endpoints map collected with names", save?.endpoints.length === 2 && save?.endpoints[0].name === "create");
  check("F-287: a ONE-KEY endpoints map keeps its map key, never 'default'",
    JSON.stringify(ping?.endpoints) === '[{"name":"status","method":"GET","path":"/status"}]', ping?.endpoints);

  // lanes beyond artifact
  check("12 runtime verbs, cliHidden, MCP-facing",
    cat.commands.filter((c) => c.lane === "runtime").every((c) => c.cliHidden && c.mcpTool) &&
      cat.commands.filter((c) => c.lane === "runtime").length === 12);
  check("6 static auth commands, CLI-only (mcpTool null)",
    cat.commands.filter((c) => c.lane === "static").every((c) => c.mcpTool === null));
  check("fixture domain metadata carried through",
    cat.domains[0].namespace === "widgets" && cat.domains[0].version === "1.2.3" && cat.domains[0].commandCount === 4);
  check("every fixture command carries exactly the T-1 command keys",
    cat.commands.every((c) => Object.keys(c).sort().join(",") === T1_COMMAND_KEYS));

  // ── fail-loudly probes ─────────────────────────────────────────────────────
  const emptyPkg = join(dir, "empty-pkg");
  writeFiles(emptyPkg, { "package.json": "{}", "dist/artifacts/.keep": "" });
  const empty = runNode(EMITTER, ["--out", join(dir, "never.json")], { env: { ...process.env, GS_ADMIN_PKG: emptyPkg } });
  check("empty artifacts dir exits 1 (never a near-empty catalog)", empty.status === 1);
  check("empty artifacts dir failure names the problem", /No artifact manifests/.test(empty.stderr), empty.stderr);

  const missing = runNode(EMITTER, ["--out", join(dir, "never2.json")], { env: { ...process.env, GS_ADMIN_PKG: join(dir, "nope") } });
  check("wrong package root exits 1", missing.status === 1);
  check("wrong package root failure prints resolution guidance", /Could not find @gainsight\/gs-admin-cli/.test(missing.stderr), missing.stderr);
} finally {
  removeTempDir(dir);
}

// ── Half 2: T-1 conformance against the COMMITTED catalog ────────────────────
{
  const cat = JSON.parse(readFileSync(join(ROOT, "data", "catalog.json"), "utf8"));
  // Non-empty floors FIRST: `every` over empty arrays is vacuously true, so a
  // regression that empties flags/endpoints tree-wide would pass every key-set
  // sweep below (B2 review, finder A).
  check("committed: non-vacuous — artifact commands exist",
    cat.commands.filter((c) => c.lane === "artifact").length > 0);
  check("committed: non-vacuous — endpoint entries exist",
    cat.commands.reduce((n, c) => n + c.endpoints.length, 0) > 0);
  check("committed: non-vacuous — artifact and runtime/static flags both exist",
    cat.commands.filter((c) => c.lane === "artifact").reduce((n, c) => n + c.flags.length, 0) > 0 &&
      cat.commands.filter((c) => c.lane !== "artifact").reduce((n, c) => n + c.flags.length, 0) > 0);
  check("committed: every command carries exactly the T-1 command keys",
    cat.commands.every((c) => Object.keys(c).sort().join(",") === T1_COMMAND_KEYS));
  check("committed: lane is the T-1 three-value union",
    cat.commands.every((c) => ["artifact", "runtime", "static"].includes(c.lane)));
  check("committed: artifact flags carry exactly the ten T-1 flag keys (char null-valued at the pin)",
    cat.commands.filter((c) => c.lane === "artifact")
      .every((c) => c.flags.every((f) => Object.keys(f).sort().join(",") === T1_FLAG_KEYS && f.char === null)));
  check("committed: runtime/static flags carry the nine keys without char (T-1 v3: char is artifact-lane-only)",
    cat.commands.filter((c) => c.lane !== "artifact")
      .every((c) => c.flags.every((f) => Object.keys(f).sort().join(",") === FLAG_KEYS_NO_CHAR)));
  check("committed: endpoint entries carry exactly name+method+path (T-1 v3)",
    cat.commands.every((c) => c.endpoints.every((e) => Object.keys(e).sort().join(",") === "method,name,path")));
  // F-287 value-rule projections onto the committed catalog (the manifest
  // field itself is not visible from the catalog, so the lock is the rule's
  // observable consequences): both name shapes exist among SINGLE-entry
  // arrays — which the count-based misreading forbade — and no MULTI-entry
  // array carries a "default" entry (the both-fields manifest combination,
  // absent at the pin; if it ever appears, re-derive before widening).
  {
    const singles = cat.commands.map((c) => c.endpoints).filter((e) => e.length === 1);
    check("committed (F-287): single-entry endpoint arrays exist in BOTH name shapes",
      singles.some((e) => e[0].name === "default") && singles.some((e) => e[0].name !== "default"));
    check("committed (F-287): no multi-entry endpoint array carries a 'default' entry at the pin",
      cat.commands.every((c) => c.endpoints.length <= 1 || c.endpoints.every((e) => e.name !== "default")));
  }
  check("committed: nullable command fields honor their T-1 types",
    cat.commands.every((c) =>
      (c.mcpTool === null || typeof c.mcpTool === "string") &&
      (c.outputFormat === null || typeof c.outputFormat === "string") &&
      (c.afterHelpNotes === null || typeof c.afterHelpNotes === "string") &&
      typeof c.mutating === "boolean" && typeof c.cliHidden === "boolean" && typeof c.mcpHidden === "boolean" &&
      Array.isArray(c.groupTitles) && Array.isArray(c.examples)));
  const counts = cat.meta.counts;
  check("committed: counts arithmetic holds",
    counts.totalCliCommands === counts.artifactCommands + counts.runtimeCommands + counts.staticCommands &&
      counts.totalCliCommands === cat.commands.length &&
      counts.domains === cat.domains.length &&
      counts.mcpTools === cat.commands.filter((c) => c.mcpTool).length);
  check("committed: globalFlags carry {flag, description}",
    cat.globalFlags.every((g) => Object.keys(g).sort().join(",") === "description,flag"));
  check("committed: valued global flags are marked by <[ in the spelling (resolver keys on this)",
    cat.globalFlags.some((g) => /[<[]/.test(g.flag)) && cat.globalFlags.some((g) => !/[<[]/.test(g.flag)));
}

if (failures) {
  console.log(`\ntest-extract-catalog: ${failures} FAILED, ${passed} passed`);
  process.exit(1);
}
console.log(`test-extract-catalog: all ${passed} checks passed`);
