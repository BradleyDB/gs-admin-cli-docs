// ─────────────────────────────────────────────────────────────────────────────
// build-reference.mjs
//
// data/catalog.json → reference/domains/*.md  (one markdown file per domain)
// plus reference/domains/index.md (the domain map).
//
// These are the Claude-facing, grep-able command references. Zero dependencies.
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT, readJsonFile } from "./lib.mjs";

const catalog = readJsonFile(join(ROOT, "data", "catalog.json"));
const OUT = join(ROOT, "reference", "domains");
mkdirSync(OUT, { recursive: true });

// ── Markdown helpers ─────────────────────────────────────────────────────────
const cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();
const code = (s) => "`" + s + "`";

function flagsTable(flags) {
  if (!flags.length) return "_No flags._\n";
  const rows = flags.map((f) => {
    let flag = f.flag ? code(f.flag) : `${code(f.name)} _(input)_`;
    if (f.char) flag += ", " + code("-" + f.char);
    let desc = f.description || "";
    if (f.enum) desc += `${desc ? " " : ""}One of: ${f.enum.map(code).join(", ")}.`;
    if (f.csv) desc += " _(comma-separated)_";
    const def = f.default === null || f.default === undefined ? "—" : code(JSON.stringify(f.default));
    return `| ${flag} | ${code(f.type)} | ${f.required ? "✓" : ""} | ${def} | ${cell(desc)} |`;
  });
  return [
    "| Flag | Type | Req | Default | Description |",
    "|------|------|:---:|---------|-------------|",
    ...rows,
  ].join("\n") + "\n";
}

function endpointsLine(eps) {
  if (!eps.length) return "";
  return eps.map((e) => `${code(e.method + " " + e.path)}${e.name !== "default" ? ` _(${e.name})_` : ""}`).join(", ");
}

function renderNotes(notes) {
  if (!notes || !notes.length) return "";
  const items = notes.map((n) => {
    if (typeof n === "string") return `> - ${n}`;
    const spec = n.spec ? ` _(spec: ${n.spec})_` : "";
    return `> - **${n.topic}** — ${n.rule}${spec}`;
  });
  return `\n> **Domain notes (guidance for AI/agent consumers)**\n>\n${items.join("\n")}\n`;
}

function commandSection(cmd) {
  const lines = [];
  lines.push(`### ${code("gs-admin " + cmd.path)}`);
  if (cmd.shortPath !== cmd.path) lines.push(`*Short form:* ${code("gs-admin " + cmd.shortPath)}`);
  if (cmd.groupTitles?.length) lines.push(`*Path:* ${cmd.groupTitles.join(" › ")}`);
  lines.push("");
  lines.push(cmd.summary || "");
  if (cmd.description && cmd.description !== cmd.summary) {
    lines.push("");
    lines.push(cmd.description);
  }
  lines.push("");
  const meta = [];
  if (cmd.mcpTool) meta.push(`**MCP tool:** ${code(cmd.mcpTool)}`);
  else meta.push("**MCP tool:** _none (CLI-only)_");
  meta.push(`**Mutating:** ${cmd.mutating ? "yes ⚠️" : "no"}`);
  if (cmd.outputFormat) meta.push(`**Output:** ${code(cmd.outputFormat)}`);
  if (cmd.cliHidden) meta.push("**CLI:** _hidden_");
  const eps = endpointsLine(cmd.endpoints);
  if (eps) meta.push(`**Endpoint(s):** ${eps}`);
  lines.push(meta.join(" · "));
  lines.push("");
  lines.push("**Flags**");
  lines.push("");
  lines.push(flagsTable(cmd.flags));
  if (cmd.examples?.length) {
    lines.push("**Examples**");
    lines.push("");
    lines.push("```bash");
    lines.push(...cmd.examples);
    lines.push("```");
  }
  if (cmd.afterHelpNotes) {
    lines.push("");
    lines.push("**Notes**");
    lines.push("");
    lines.push("```");
    lines.push(cmd.afterHelpNotes.trimEnd());
    lines.push("```");
  }
  lines.push("");
  return lines.join("\n");
}

const BANNER =
  "<!-- GENERATED FILE — do not edit by hand. Regenerate with: npm run build:reference (build/build-reference.mjs). -->\n";

// ── Per-domain files ─────────────────────────────────────────────────────────
for (const domain of catalog.domains) {
  const cmds = catalog.commands
    .filter((c) => c.domain === domain.namespace)
    .sort((a, b) => a.path.localeCompare(b.path, "en"));

  const out = [];
  out.push(BANNER);
  const aliasStr = domain.aliases.length ? ` / ${domain.aliases.map(code).join(", ")}` : "";
  out.push(`# ${domain.title} (${code(domain.namespace)}${aliasStr})`);
  out.push("");
  out.push(domain.description);
  out.push(renderNotes(domain.notes));
  const plural = cmds.length === 1 ? "command" : "commands";
  out.push(`**${cmds.length} ${plural}.** ${domain.lane === "runtime" ? "_Lane 2 runtime — CLI-hidden, MCP-facing._" : domain.lane === "static" ? "_Auth & config — CLI-only._" : ""}`);
  out.push("");

  // Index table
  out.push("| Command | Summary | MCP tool |");
  out.push("|---------|---------|----------|");
  for (const c of cmds) {
    const anchor = c.path.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    out.push(`| [${code("gs-admin " + c.path)}](#gs-admin-${anchor}) | ${cell(c.summary)} | ${c.mcpTool ? code(c.mcpTool) : "—"} |`);
  }
  out.push("");
  out.push("---");
  out.push("");

  // Detail sections
  for (const c of cmds) out.push(commandSection(c));

  const file = join(OUT, `${domain.namespace}.md`);
  writeFileSync(file, out.join("\n").replace(/\n{3,}/g, "\n\n") + "\n", "utf8");
}

// ── Domain index ─────────────────────────────────────────────────────────────
const idx = [];
idx.push(BANNER);
idx.push("# gs-admin — Domain Reference Map");
idx.push("");
idx.push(`Generated from ${code(catalog.meta.cliPackage + "@" + catalog.meta.cliVersion)} on ${catalog.meta.generatedAt.slice(0, 10)}.`);
idx.push("");
idx.push(`**${catalog.meta.counts.totalCliCommands} CLI commands** · **${catalog.meta.counts.mcpTools} MCP tools** · **${catalog.meta.counts.domains} domains**`);
idx.push("");
idx.push("| Domain | Aliases | Commands | Reference |");
idx.push("|--------|---------|---------:|-----------|");
for (const d of catalog.domains) {
  idx.push(`| **${d.title}** (${code(d.namespace)}) | ${d.aliases.map(code).join(", ") || "—"} | ${d.commandCount} | [${d.namespace}.md](${d.namespace}.md) |`);
}
idx.push("");
writeFileSync(join(OUT, "index.md"), idx.join("\n") + "\n", "utf8");

console.log(`Reference generated: ${catalog.domains.length} domain files + index.md → reference/domains/`);
