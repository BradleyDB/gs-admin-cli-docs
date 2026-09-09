#!/usr/bin/env node
// Fixture tests for build/render-cheatsheet.mjs — the ONE cheatsheet emitter
// shared by the repo build (bundled reference/cheatsheet.md) and the workspace
// lane (the verbatim copy in plugin scripts/, invoked by /gs-superadmin:setup).
//
// What this pins:
//   1. Same-catalog-in → same-cheatsheet-out: rendering data/catalog.json with
//      the repo banner/footer reproduces the committed bundled cheatsheet
//      byte-for-byte (the GP-2 done-when).
//   2. The shipped plugin copy is byte-identical to build/render-cheatsheet.mjs
//      (single-emitter guarantee — no drifting second copy).
//   3. The plugin copy, invoked as a CLI the way setup invokes it, produces a
//      body byte-identical to the bundled cheatsheet — only the banner and
//      footer lines (which name the regeneration path) differ.
//   4. Rendering behaviors on a synthetic catalog: pipe escaping + newline
//      collapsing in global-flag descriptions, alias rendering, hidden MCP
//      tools, short-form suppression, mutating column, unknown-domain append
//      with a warning, CLI failure modes (missing args, not-a-catalog input).
//
// Zero dependencies. CLI runs execute the PLUGIN copy in a temp dir; the repo
// tree is never touched.

import {
  readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, symlinkSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { ROOT } from "./lib.mjs";
import { spawnSync } from "node:child_process";
import { renderCheatsheet, REPO_BANNER, REPO_FOOTER } from "./render-cheatsheet.mjs";

const PLUGIN_COPY = join(ROOT, "plugins", "gs-superadmin", "scripts", "render-cheatsheet.mjs");
const BUNDLED = join(ROOT, "plugins", "gs-superadmin", "reference", "cheatsheet.md");

let passed = 0;
const failures = [];
const ok = (name, cond) => {
  if (cond) passed++;
  else failures.push(name);
};

// ── 1. Repo-lane parity: same catalog in → the committed bundled cheatsheet ──
// (REPO_BANNER/REPO_FOOTER are imported from the emitter itself — one
// definition shared by the build script and this test. This assertion overlaps
// CI's rebuild-and-diff step; it stays because it makes the suite meaningful
// standalone, and a failure here names the emitter rather than "drift".)
const catalog = JSON.parse(readFileSync(join(ROOT, "data", "catalog.json"), "utf8"));
const repoRender = renderCheatsheet(catalog, { banner: REPO_BANNER, footer: REPO_FOOTER });
const bundled = readFileSync(BUNDLED, "utf8");
ok("repo lane reproduces committed reference/cheatsheet.md byte-for-byte", repoRender === bundled);

// ── 2. Single-emitter guarantee: plugin copy is verbatim ─────────────────────
ok(
  "plugin scripts/render-cheatsheet.mjs is byte-identical to build/render-cheatsheet.mjs",
  readFileSync(PLUGIN_COPY, "utf8") === readFileSync(join(ROOT, "build", "render-cheatsheet.mjs"), "utf8")
);

// ── 3. Workspace lane: CLI run of the plugin copy, body identical ────────────
function runCli(args, cwd) {
  return spawnSync(process.execPath, [PLUGIN_COPY, ...args], { encoding: "utf8", cwd });
}

{
  const rig = mkdtempSync(join(tmpdir(), "cheatsheet-test-"));
  try {
    const out = join(rig, "cheatsheet.md");
    const res = runCli(["--catalog", join(ROOT, "data", "catalog.json"), "--out", out], rig);
    ok("workspace lane exits 0 on the real catalog", res.status === 0);
    const ws = existsSync(out) ? readFileSync(out, "utf8") : "";
    const wsLines = ws.split("\n");
    const bLines = bundled.split("\n");
    ok("workspace output has the same line count as the bundled cheatsheet", wsLines.length === bLines.length);
    // Body = everything except line 0 (banner) and the footer line (3rd from end:
    // "---", footer, trailing ""). Compare byte-for-byte.
    const body = (ls) => ls.slice(1, -2).join("\n");
    ok("workspace body is byte-identical to the bundled body", body(wsLines) === body(bLines));
    ok(
      "workspace banner names the setup lane, not the repo build",
      wsLines[0].includes("GENERATED FILE") && wsLines[0].includes("render-cheatsheet.mjs") && !wsLines[0].includes("npm run")
    );
    ok(
      "workspace footer names the setup lane, not the repo build",
      wsLines[wsLines.length - 2].includes("render-cheatsheet.mjs") && !wsLines[wsLines.length - 2].includes("npm run")
    );
  } finally {
    rmSync(rig, { recursive: true, force: true });
  }
}

// ── 4. Rendering behaviors on a synthetic catalog ────────────────────────────
const FIXTURE_CATALOG = {
  meta: { cliVersion: "9.9.9-test", counts: { totalCliCommands: 3, mcpTools: 2 } },
  globalFlags: [
    { flag: "--json", description: "Output as | pipe-bearing\nmulti-line JSON" },
    { name: "profile", description: "flagless input" },
  ],
  domains: [
    { namespace: "journey", title: "Journey Orchestrator", aliases: ["jo"], description: "Programs & emails" },
    { namespace: "mystery", title: "Mystery Domain", aliases: [] },
  ],
  commands: [
    { domain: "journey", path: "jo p list", shortPath: "jo p list", mcpTool: "journey_p_list", mcpHidden: false, mutating: false },
    { domain: "journey", path: "journey program save", shortPath: "jo p save", mcpTool: "journey_p_save", mcpHidden: false, mutating: true },
    { domain: "mystery", path: "mystery run", shortPath: "mystery run", mcpTool: "mystery_run", mcpHidden: true, mutating: false },
  ],
};

{
  const warnings = [];
  const md = renderCheatsheet(FIXTURE_CATALOG, { warn: (m) => warnings.push(m) });
  ok("header cites the fixture version and counts", md.includes("> Generated from CLI v9.9.9-test · 3 commands / 2 MCP tools"));
  ok("global-flag pipe is escaped and newline collapsed", md.includes("| `--json` | Output as \\| pipe-bearing multi-line JSON |"));
  ok("flagless global input renders as `name` _(input)_", md.includes("| `profile` _(input)_ | flagless input |"));
  ok("domain alias renders in the heading", md.includes("## Journey Orchestrator (alias: `jo`)"));
  ok("domain description renders italicized", md.includes("_Programs & emails_"));
  ok("same short path renders as em dash", md.includes("| `gs-admin jo p list` | — | `journey_p_list` |  |"));
  ok(
    "distinct short path + mutating flag render",
    md.includes("| `gs-admin journey program save` | `gs-admin jo p save` | `journey_p_save` | ⚠️ yes |")
  );
  ok("hidden MCP tool renders as em dash", md.includes("| `gs-admin mystery run` | — | — |  |"));
  ok("unknown domain is appended, not dropped", md.includes("## Mystery Domain"));
  ok("unknown domain emits a warning", warnings.length === 1 && warnings[0].includes('"mystery"'));
  ok("unknown domain warning does not fire for ordered domains", !warnings.some((w) => w.includes('"journey"')));
  const mdDefault = renderCheatsheet(FIXTURE_CATALOG, { warn: () => {} });
  ok("default (workspace) banner/footer are used when none passed", mdDefault.startsWith("<!-- GENERATED FILE") && mdDefault.includes("/gs-superadmin:setup"));
}

// ── 5. CLI failure modes ─────────────────────────────────────────────────────
{
  const rig = mkdtempSync(join(tmpdir(), "cheatsheet-test-"));
  try {
    const resNoArgs = runCli([], rig);
    ok("CLI without args exits non-zero with usage", resNoArgs.status === 1 && resNoArgs.stderr.includes("Usage:"));

    const notCatalog = join(rig, "not-catalog.json");
    writeFileSync(notCatalog, JSON.stringify({ hello: "world" }));
    const resBad = runCli(["--catalog", notCatalog, "--out", join(rig, "x.md")], rig);
    ok("CLI on a non-catalog JSON exits non-zero, names the problem", resBad.status === 1 && resBad.stderr.includes("does not look like"));
    ok("CLI on a non-catalog JSON writes nothing", !existsSync(join(rig, "x.md")));

    const resMissing = runCli(["--catalog", join(rig, "absent.json"), "--out", join(rig, "y.md")], rig);
    ok("CLI on a missing catalog exits non-zero", resMissing.status === 1 && resMissing.stderr.includes("Could not read"));

    // BOM tolerance: a BOM-prefixed catalog still parses (PowerShell redirects).
    const bomCatalog = join(rig, "bom.json");
    writeFileSync(bomCatalog, String.fromCharCode(0xfeff) + JSON.stringify(FIXTURE_CATALOG));
    const resBom = runCli(["--catalog", bomCatalog, "--out", join(rig, "bom.md")], rig);
    ok("CLI tolerates a UTF-8 BOM on the catalog", resBom.status === 0 && existsSync(join(rig, "bom.md")));

    // F-208(a): invokedDirectly's two-sided realpath, pinned on BOTH sides —
    // build/ previously had zero symlink fixtures, so this hand-kept copy of
    // the doc-lib isMainModule rule was untested on either side. Junction the
    // scripts dir; the linked spelling must still run main (usage, exit 1)
    // under a bare spawn (argv1 side) AND under --preserve-symlinks-main
    // (self side, the F-149 half — the loader keeps the linked spelling in
    // import.meta.url there, so a one-sided compare silently no-ops, exit 0).
    // "junction" works unprivileged on Windows; the type is ignored on POSIX.
    // F-137 rule: only cannot-create-links errors may downgrade to a skip.
    const linkDir = join(rig, "scripts-link");
    let linked = true;
    try { symlinkSync(dirname(PLUGIN_COPY), linkDir, "junction"); }
    catch (e) { if (["EPERM", "EACCES", "ENOSYS"].includes(e?.code)) linked = false; else throw e; }
    if (linked) {
      const viaLink = spawnSync(process.execPath, [join(linkDir, "render-cheatsheet.mjs")], { encoding: "utf8", cwd: rig });
      ok("junction invocation still runs main (usage, exit 1) (F-208)", viaLink.status === 1 && viaLink.stderr.includes("Usage:"));
      const viaLinkPreserve = spawnSync(process.execPath, ["--preserve-symlinks-main", join(linkDir, "render-cheatsheet.mjs")], { encoding: "utf8", cwd: rig });
      ok("junction invocation still runs main under --preserve-symlinks-main (F-208)", viaLinkPreserve.status === 1 && viaLinkPreserve.stderr.includes("Usage:"));
    } else {
      ok("junction invocation fixtures (F-208) [link creation unavailable — skipped]", true);
    }
  } finally {
    rmSync(rig, { recursive: true, force: true });
  }
}

// ── report ───────────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`✗ ${failures.length} assertion(s) failed:`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error(`(${passed} passed)`);
  process.exit(1);
}
console.log(`✓ render-cheatsheet fixtures: ${passed}/${passed} assertions passed`);
