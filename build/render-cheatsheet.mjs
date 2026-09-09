// ─────────────────────────────────────────────────────────────────────────────
// render-cheatsheet.mjs
//
// The ONE cheatsheet emitter: renders a gs-admin cheatsheet.md from a
// catalog.json. Two callers, one body, so the two outputs can never drift:
//   - build/build-plugin-gs-superadmin.mjs imports renderCheatsheet() to write
//     the plugin's bundled reference/cheatsheet.md at repo build time;
//   - the verbatim copy shipped at plugins/gs-superadmin/scripts/ is invoked by
//     /gs-superadmin:setup to render .gs-superadmin/cheatsheet.md from the
//     workspace catalog generated from the user's installed CLI.
// Only the banner/footer lines (which name the regeneration path) differ
// between the two outputs; build/test-render-cheatsheet.mjs pins that.
//
// CLI: node render-cheatsheet.mjs --catalog <catalog.json> --out <cheatsheet.md>
//
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Banner/footer per lane. The workspace pair is the CLI default; the repo build
// imports REPO_BANNER/REPO_FOOTER (exported so the build script and its test
// share one definition), so the bundled reference/cheatsheet.md names the repo
// regeneration path instead.
const WORKSPACE_BANNER =
  "<!-- GENERATED FILE — do not edit by hand. Rendered from the workspace catalog by /gs-superadmin:setup (scripts/render-cheatsheet.mjs). -->";
const WORKSPACE_FOOTER =
  '_Regenerate: re-run `/gs-superadmin:setup`, or `node .gs-superadmin/plugin/scripts/render-cheatsheet.mjs --catalog .gs-superadmin/catalog.json --out .gs-superadmin/cheatsheet.md`._';
export const REPO_BANNER =
  "<!-- GENERATED FILE — do not edit by hand. Regenerate with: npm run build:plugin:gs-superadmin (build/build-plugin-gs-superadmin.mjs). -->";
export const REPO_FOOTER = "_Regenerate: `npm run build:plugin:gs-superadmin` in the gs-admin-cli-docs repo._";

export function renderCheatsheet(catalog, opts = {}) {
  const banner = opts.banner ?? WORKSPACE_BANNER;
  const footer = opts.footer ?? WORKSPACE_FOOTER;
  const warn = opts.warn ?? ((msg) => console.warn(msg));
  const { meta, globalFlags, domains, commands } = catalog;

  // Index domains by namespace for fast lookup
  const domainIndex = Object.fromEntries(domains.map((d) => [d.namespace, d]));

  // Group commands by domain
  const byDomain = new Map();
  for (const cmd of commands) {
    if (!byDomain.has(cmd.domain)) byDomain.set(cmd.domain, []);
    byDomain.get(cmd.domain).push(cmd);
  }

  const lines = [];

  function renderDomainSection(ns, domCmds) {
    const dom = domainIndex[ns];
    const aliases = dom?.aliases?.length ? ` (alias: \`${dom.aliases.join("`, `")}\`)` : "";
    lines.push(`## ${dom?.title ?? ns}${aliases}`);
    if (dom?.description) { lines.push(""); lines.push(`_${dom.description}_`); }
    lines.push("");
    lines.push("| Command | Short form | MCP tool | Mutating |");
    lines.push("|---------|------------|----------|:--------:|");
    for (const cmd of domCmds) {
      lines.push(renderCmdRow(cmd));
    }
    lines.push("");
  }

  function renderCmdRow(cmd) {
    const cliCmd = `\`gs-admin ${cmd.path}\``;
    const shortCmd = cmd.shortPath && cmd.shortPath !== cmd.path ? `\`gs-admin ${cmd.shortPath}\`` : "—";
    const mcp = cmd.mcpTool && !cmd.mcpHidden ? `\`${cmd.mcpTool}\`` : "—";
    const mut = cmd.mutating ? "⚠️ yes" : "";
    return `| ${cliCmd} | ${shortCmd} | ${mcp} | ${mut} |`;
  }

  lines.push(banner);
  lines.push("");
  lines.push("# gs-admin Cheatsheet");
  lines.push("");
  lines.push(`> Generated from CLI v${meta.cliVersion} · ${meta.counts.totalCliCommands} commands / ${meta.counts.mcpTools} MCP tools`);
  lines.push("> **Global flags go before the subcommand**: `gs-admin --json <ns> <cmd>`");
  lines.push("> **Single-quote every free-text value** — asset names carry `|` `&` spaces and other shell metacharacters (`;` `(` `)` `$`); single quotes neutralize all of them: `--search 'CS|Risk|Renewal|Alert'`");
  lines.push("> **Spell subcommands literally** — the guard can't inspect `gs-admin $cmd`; variables only in flag values/paths");
  lines.push("> **Switch instances**: `gs-admin config --base-url <url>` (tokens persist per tenant) · one-off override: `gs-admin --base-url <url> <ns> <cmd>`");
  // No current-state claims here that this generator cannot derive from its own
  // input (the catalog): the override list's contents live in a file this script
  // never reads, so the banner names the mechanism and the file, not its state.
  // "since CLI 1.0.8" is historical vintage (when the contract was written), not
  // the generated-at version — meta.cliVersion renders in the header line above.
  lines.push("> **Mutating column = the catalog's own flag** — a written upstream contract since CLI 1.0.8 (side effect iff flagged, regardless of HTTP verb; the old mislabeled-writer class — `re r run-now`, the schedule/subscribe writers, `re r set-source-template` — was closed there and flagged from then on). A blank cell still is not blanket safety: the residual non-mutating POSTs are read-shaped fetches, and a future release can mislabel — the guard fail-closes on unknown commands and the plugin's ask-override list (`hooks/ask-overrides.json`) forces the prompt on any verified mislabel");
  lines.push("");

  // Global flags
  lines.push("## Global Flags");
  lines.push("");
  lines.push("| Flag | Description |");
  lines.push("|------|-------------|");
  for (const gf of globalFlags) {
    const flagLabel = gf.flag ? `\`${gf.flag}\`` : `\`${gf.name}\` _(input)_`;
    const desc = (gf.description ?? "").replace(/\|/g, "\\|").replace(/\n+/g, " ");
    lines.push(`| ${flagLabel} | ${desc} |`);
  }
  lines.push("");

  // Per-domain sections
  const domainOrder = [
    "journey", "rules-engine", "data-management", "data-designer",
    "connectors", "scorecard", "report", "query", "runtime", "auth",
  ];

  for (const ns of domainOrder) {
    const domCmds = byDomain.get(ns);
    if (!domCmds || !domCmds.length) continue;
    renderDomainSection(ns, domCmds);
  }

  // Emit any domains that exist in the catalog but weren't in the ordered list
  const coveredDomains = new Set(domainOrder);
  for (const [ns, domCmds] of byDomain) {
    if (coveredDomains.has(ns)) continue;
    warn(`⚠  Unknown domain in catalog not in domainOrder: "${ns}" — appending to cheatsheet`);
    renderDomainSection(ns, domCmds);
  }

  lines.push("---");
  lines.push(footer);
  lines.push("");

  return lines.join("\n");
}

// ── CLI entry (the workspace lane; skipped when imported as a module) ────────
// Node's ESM loader realpath-resolves import.meta.url but leaves argv[1]
// as typed, so both sides must be realpath'd or an invocation through a
// symlink/junction (routine for CLAUDE_PLUGIN_ROOT: marketplace installs,
// OneDrive junctions, macOS /tmp) would silently skip the CLI block and
// exit 0 without writing anything. Both sides really are realpath'd — self
// too, not just argv[1]: under `node --preserve-symlinks-main` the loader
// keeps the linked spelling in import.meta.url, so a one-sided compare
// brings the silent no-op back (F-149). The plugin's scripts share this rule
// as doc-lib.mjs isMainModule (F-117); this file keeps its own copy by
// necessity — it is a build/ emitter copied verbatim into the plugin, so it
// cannot import plugin doc-lib. Keep the two in sync.
const invokedDirectly = (() => {
  if (!process.argv[1]) return false;
  try {
    const self = realpathSync(fileURLToPath(import.meta.url));
    const argv1 = realpathSync(resolve(process.argv[1]));
    return process.platform === "win32" ? self.toLowerCase() === argv1.toLowerCase() : self === argv1;
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  const argAfter = (flag) => {
    const i = process.argv.indexOf(flag);
    return i !== -1 ? process.argv[i + 1] : undefined;
  };
  const catalogPath = argAfter("--catalog");
  const outPath = argAfter("--out");
  if (!catalogPath || !outPath) {
    console.error("Usage: node render-cheatsheet.mjs --catalog <catalog.json> --out <cheatsheet.md>");
    process.exit(1);
  }
  let catalog;
  try {
    // Strip a UTF-8 BOM if present (PowerShell redirects prepend one).
    let text = readFileSync(catalogPath, "utf8");
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    catalog = JSON.parse(text);
  } catch (e) {
    console.error(`✗ Could not read catalog at ${catalogPath}: ${e.message}`);
    process.exit(1);
  }
  if (!catalog?.meta?.counts || !Array.isArray(catalog.commands) || !Array.isArray(catalog.domains) || !Array.isArray(catalog.globalFlags)) {
    console.error(`✗ ${catalogPath} does not look like a gs-admin catalog (missing meta.counts / commands / domains / globalFlags)`);
    process.exit(1);
  }
  const md = renderCheatsheet(catalog);
  mkdirSync(dirname(resolve(outPath)), { recursive: true });
  writeFileSync(outPath, md);
  console.log(`✓ cheatsheet rendered from CLI v${catalog.meta.cliVersion} catalog → ${outPath}`);
}
