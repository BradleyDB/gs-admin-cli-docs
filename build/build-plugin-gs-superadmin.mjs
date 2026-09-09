// ─────────────────────────────────────────────────────────────────────────────
// build-plugin-gs-superadmin.mjs
//
// data/catalog.json → plugins/gs-superadmin/reference/
//   cheatsheet.md     slim always-loadable command map
//   catalog.json      straight copy (bundled for offline use; also consumed by
//                     hooks/gs-admin-guard.mjs, the CLI-side mutation guard)
//   ask-rules.json    mutating MCP tools → permissions.ask entries for .claude/settings.json
//   version.json      pinned cliVersion for the drift guard
//
// Zero dependencies — Node built-ins only. Re-run after `npm run build:catalog`.
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync, copyFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { renderCheatsheet, REPO_BANNER, REPO_FOOTER } from "./render-cheatsheet.mjs";
import { ROOT, readJsonFile } from "./lib.mjs";

const CATALOG_PATH = join(ROOT, "data", "catalog.json");
const OUT = join(ROOT, "plugins", "gs-superadmin", "reference");

// MCP server name: read from local config (same resolution as extract-catalog), default "gs-admin".
// The BOM-tolerant parse lives in build/lib.mjs readJsonFile (F-118/F-204 — this reader's own
// strip copy retired at B5 W3/DS-16). A PRESENT-but-unparseable config warns loudly and names the
// file instead of silently reverting to the default; an ABSENT config stays silent — it is
// git-ignored and optional.
let MCP_SERVER = "gs-admin";
const cfgPath = join(ROOT, "gs-admin-explorer.config.json");
if (existsSync(cfgPath)) {
  try {
    const cfg = readJsonFile(cfgPath);
    if (cfg.mcpServerName) MCP_SERVER = cfg.mcpServerName;
  } catch (e) {
    console.warn(
      `WARNING: gs-admin-explorer.config.json exists but could not be parsed (${e.message}) — ` +
        `using default mcpServerName "${MCP_SERVER}" (F-204)`
    );
  }
}

mkdirSync(OUT, { recursive: true });

const catalog = readJsonFile(CATALOG_PATH);
const { meta, commands } = catalog;
// Reuse the catalog's timestamp so rebuilding from an unchanged catalog is a no-op in git
const NOW = meta.generatedAt ?? new Date().toISOString();

// ── 1. catalog.json — straight copy ─────────────────────────────────────────
copyFileSync(CATALOG_PATH, join(OUT, "catalog.json"));
console.log("✓ reference/catalog.json");

// ── 2. version.json ──────────────────────────────────────────────────────────
writeFileSync(
  join(OUT, "version.json"),
  JSON.stringify(
    {
      _generated: "GENERATED FILE — do not edit by hand. Regenerate with: npm run build:plugin:gs-superadmin.",
      cliVersion: meta.cliVersion,
      generatedAt: NOW,
    },
    null,
    2
  ) + "\n"
);
console.log("✓ reference/version.json");

// ── 3. ask-rules.json ────────────────────────────────────────────────────────
// MCP tool names are stable identifiers, so static permissions.ask entries fit.
// The CLI lane is enforced by hooks/gs-admin-guard.mjs (parses commands against
// the bundled catalog), so no Bash patterns are generated. Because `ask` prompts
// instead of blocking, no domain carve-outs are needed — even `login` just asks.
const mcpTools = new Set();
for (const cmd of commands) {
  if (!cmd.mutating) continue;
  if (cmd.mcpTool && !cmd.mcpHidden) {
    mcpTools.add(`mcp__${MCP_SERVER}__${cmd.mcpTool}`);
  }
}

const askRules = {
  _generated: "GENERATED FILE — do not edit by hand. Regenerate with: npm run build:plugin:gs-superadmin.",
  generated: NOW,
  cliVersion: meta.cliVersion,
  mcpServer: MCP_SERVER,
  note: "Merge mcpTools into permissions.ask in .claude/settings.json (append-only; never remove unrelated entries). Mutating CLI commands are guarded by the plugin's PreToolUse hook (which also journals approved mutations on PostToolUse), not by settings patterns.",
  mcpTools: [...mcpTools].sort(),
};

writeFileSync(join(OUT, "ask-rules.json"), JSON.stringify(askRules, null, 2) + "\n");
console.log(`✓ reference/ask-rules.json  (${askRules.mcpTools.length} MCP tools)`);

// ── 4. cheatsheet.md ─────────────────────────────────────────────────────────
// The emitter lives in render-cheatsheet.mjs (shared with the workspace lane —
// the verbatim copy shipped in plugin scripts/ renders .gs-superadmin/cheatsheet.md
// from the workspace catalog at setup). Only the banner/footer differ per lane.
const cheatsheet = renderCheatsheet(catalog, { banner: REPO_BANNER, footer: REPO_FOOTER });
writeFileSync(join(OUT, "cheatsheet.md"), cheatsheet);
console.log(`✓ reference/cheatsheet.md  (${cheatsheet.split("\n").length} lines)`);

// ── 5. scripts/ — verbatim copies of the repo's dual-lane scripts ────────────
// extract-catalog.mjs: so setup can generate the workspace catalog from the
// installed CLI's own dist/artifacts/*.json (invoked with --out; the bundled
// reference/catalog.json is the fallback when generation fails).
// render-cheatsheet.mjs: so setup can render the workspace cheatsheet from that
// generated catalog with the exact emitter that produced the bundled copy.
// Copied at build time to keep a single source of truth for each.
const SCRIPTS = join(ROOT, "plugins", "gs-superadmin", "scripts");
mkdirSync(SCRIPTS, { recursive: true });
copyFileSync(join(ROOT, "build", "extract-catalog.mjs"), join(SCRIPTS, "extract-catalog.mjs"));
console.log("✓ scripts/extract-catalog.mjs  (copied from build/)");
copyFileSync(join(ROOT, "build", "render-cheatsheet.mjs"), join(SCRIPTS, "render-cheatsheet.mjs"));
console.log("✓ scripts/render-cheatsheet.mjs  (copied from build/)");

console.log(`\nDone. Plugin reference bundle written to plugins/gs-superadmin/reference/`);
