// ─────────────────────────────────────────────────────────────────────────────
// build-wiki.mjs
//
// Assembles a single self-contained wiki/index.html from:
//   - data/catalog.json                 (the command/tool catalog → interactive browser)
//   - reference/*.md                     (concept docs → "Guide" pages)
//   - reference/workflows/*.md           (walkthroughs → "Workflows" pages)
//   - build/wiki-assets/app.css | app.js (inlined; the wiki has no runtime deps)
//
// Renders markdown through the build lane's shared T-9 grammar (build/lib.mjs:
// parseBlocks + renderInlineCore — no external packages) and rewrites
// cross-document .md links into the wiki's hash routes.
// ─────────────────────────────────────────────────────────────────────────────

// ── T-9 · Markdown renderer contract ─────────────────────────────────────────
/**
 * FROZEN (B5 P1, 2026-08-16; v2 B1, 2026-08-16; v3 B11, 2026-09-01 — the
 * "two independent implementations" clause replaced by the DS-25 as-landed
 * shape; v4 S-D2, 2026-09-05 — the "two deliberately separate BLOCK parsers"
 * clause retired: Bradley adopted the wiki-output rethink's direction A,
 * one block grammar, in the GP-18 session).
 * The grammar both build-lane renderers consume is SINGLE code in
 * build/lib.mjs: parseBlocks (blocks — headings h1-h6, paragraphs, fenced
 * code, tables with \| escape + row-width normalization, ordered/unordered
 * lists incl. one nesting level, blockquotes incl. block structure, hr; the
 * former eight per-side axes are decided once in the table on that function)
 * and renderInlineCore (code spans stashed before emphasis/links, the GFM \|
 * prose unescape, guarded emphasis) with per-side hooks. What stays per
 * generator: link routing (resolveLink — the deliberate per-page difference,
 * fixture-locked in each suite), the inline wrapper's extras (this file's
 * `_underscore_` emphasis; the comparison page's titled and balanced-paren
 * links) and the block→HTML LAYOUT (renderBlocks here; the comparison
 * generator's enriched renderers). Fail-loudly on an unplaceable block
 * (F-061) is a throw from the parser or renderer, never a dropped block.
 * The grammar is locked by absolute pins with in-memory mutants in
 * build/test-wiki-html.mjs (no differential — nothing is left to differ);
 * a grammar change is a change to lib.mjs, and both committed pages
 * rebuild under check-doc-drift's rebuild-and-diff.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT, readJsonFile, isMainModule, renderInlineCore, escapeHtml, parseBlocks, noticeParagraphs, NOTICE_HEADING } from "./lib.mjs";

const REF = join(ROOT, "reference");
const ASSETS = join(ROOT, "build", "wiki-assets");

// ── Markdown renderer ────────────────────────────────────────────────────────
// Parsing is build/lib.mjs's parseBlocks (T-9 v4); this file owns the wiki's
// link routing, its inline extras, and the block→HTML layout below.

// Resolve a relative .md link (from a doc in `baseDir`) to a wiki hash route.
function resolveLink(url, baseDir) {
  url = url.trim();
  if (/^(https?:|mailto:)/.test(url)) return { href: url, ext: true };
  const parts = url.split("#");
  const path = parts[0];
  const anchor = parts[1];
  if (!path) return { href: "#" + (anchor || ""), ext: false };
  const stack = baseDir.split("/").filter(Boolean);
  for (const seg of path.split("/")) {
    if (seg === "..") stack.pop();
    else if (seg === "." || seg === "") continue;
    else stack.push(seg);
  }
  const frag = anchor ? "#" + anchor : "";
  // Out-of-corpus target (F-082): the app has no hash route for anything
  // outside reference/, so a #/doc/ rewrite would be a dead in-app link.
  // Emit a plain relative href instead — wiki/ sits one level below the repo
  // root, so "../<path>" resolves in a checkout, and the outbound-anchor
  // check in test-wiki-html.mjs validates it like any other file link.
  if (stack[0] !== "reference") {
    return { href: "../" + stack.join("/") + frag, ext: false };
  }
  const rel = stack.join("/").replace(/^reference\//, "").replace(/\.md$/, "");
  // The comparison guide is a standalone sibling page, deliberately not a
  // DOC_ORDER doc — #/doc/comparison-guide would hit the app's Not-found
  // fallback (F-077's corrected scope). Same mapping as app.js's
  // COMPARISON_GUIDE const.
  if (rel === "comparison-guide") return { href: "comparison-guide.html" + frag, ext: false };
  let href;
  if (rel === "domains/index" || rel === "domains") href = "#/home";
  else if (rel.startsWith("domains/")) href = "#/domain/" + rel.slice("domains/".length);
  else if (rel === "workflows/index" || rel === "workflows") href = "#/workflows";
  else if (rel.startsWith("workflows/")) href = "#/workflow/" + rel.slice("workflows/".length);
  else href = "#/doc/" + rel;
  return { href, ext: false };
}

// Inline formatting — the stash/escape/unescape/emphasis/restore core is the
// shared renderInlineCore in build/lib.mjs (T-9, GP-B5 DS-25); this wrapper
// carries only the wiki-side grammar: the resolveLink-routed link pass and
// the underscore-emphasis rule.
function renderInline(text, baseDir) {
  return renderInlineCore(text, {
    renderLinks: (t) =>
      t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, txt, u) => {
        const link = resolveLink(u, baseDir);
        return '<a href="' + link.href + '"' + (link.ext ? ' target="_blank" rel="noopener"' : "") + ">" + txt + "</a>";
      }),
    // wiki-only inline rule: `_underscore_` emphasis with boundary guards.
    extraEmphasis: (t) => t.replace(/(^|[\s(])_([^_]+)_(?=$|[\s).,;:!?])/g, "$1<em>$2</em>"),
  });
}

// The wiki's block→HTML layout over the shared block list: compact markup
// (no whitespace between list items or table cells — the app injects it
// into #content as-is). A block type this switch does not know is a THROW
// (F-061): the parser's typedef and this switch grow together.
function renderList(b, baseDir) {
  const tag = b.ordered ? "ol" : "ul";
  let html = "<" + tag + ">";
  for (const it of b.items) {
    html += "<li>" + renderInline(it.text, baseDir);
    if (it.children.length) {
      const ctag = it.childOrdered ? "ol" : "ul";
      html += "<" + ctag + ">" + it.children.map((c) => "<li>" + renderInline(c, baseDir) + "</li>").join("") + "</" + ctag + ">";
    }
    html += "</li>";
  }
  return html + "</" + tag + ">";
}

function renderBlocks(blocks, baseDir) {
  const inline = (t) => renderInline(t, baseDir);
  const out = [];
  for (const b of blocks) {
    switch (b.type) {
      case "code": out.push("<pre><code>" + escapeHtml(b.text) + "</code></pre>"); break;
      case "hr": out.push("<hr>"); break;
      case "h1": case "h2": case "h3": case "h4": case "h5": case "h6":
        out.push("<" + b.type + ">" + inline(b.text) + "</" + b.type + ">");
        break;
      case "table": {
        let t = "<table><thead><tr>" + b.header.map((c) => "<th>" + inline(c) + "</th>").join("") + "</tr></thead><tbody>";
        for (const r of b.body) t += "<tr>" + b.header.map((_, ci) => "<td>" + inline(r[ci] || "") + "</td>").join("") + "</tr>";
        out.push(t + "</tbody></table>");
        break;
      }
      case "quote": out.push("<blockquote>" + renderBlocks(b.blocks, baseDir) + "</blockquote>"); break;
      case "list": out.push(renderList(b, baseDir)); break;
      case "p": out.push("<p>" + inline(b.text) + "</p>"); break;
      default:
        throw new Error(`build-wiki: unhandled block type "${/** @type {{type: string}} */ (b).type}" — refusing to drop it silently`);
    }
  }
  return out.join("\n");
}

function mdToHtml(md, baseDir) {
  return renderBlocks(parseBlocks(md), baseDir);
}

// ── Gather docs + workflows ──────────────────────────────────────────────────
// The grammar layer above is exported for build/test-wiki-html.mjs's T-9
// pins (GP-B5 W8/DS-47): the suite imports the real renderer instead of
// compiling a source slice. The build itself runs behind isMainModule, so
// importing this module reads and writes nothing.
export { resolveLink, renderInline, mdToHtml };

const DOC_ORDER = [
  ["architecture", "Architecture"],
  ["auth", "Auth & Config"],
  ["mcp", "MCP Server"],
  ["lane2-runtime", "Lane 2 Runtime"],
  ["output-formats", "Output & Flags"],
  ["building-on-gs-admin", "Building On"],
];

function main() {
  const catalog = readJsonFile(join(ROOT, "data", "catalog.json"));
  const DOCS = DOC_ORDER.map(([slug, title]) => ({
    slug,
    title,
    html: mdToHtml(readFileSync(join(REF, slug + ".md"), "utf8"), "reference"),
  }));

  const wfDir = join(REF, "workflows");
  const firstH1 = (md) => (md.match(/^#\s+(.*)$/m)?.[1] || "Workflow").replace(/^Workflow:\s*/, "");
  const wfFiles = readdirSync(wfDir).filter((f) => /\.md$/.test(f) && f !== "index.md").sort();
  const WORKFLOWS = {
    index: { title: "Workflows", html: mdToHtml(readFileSync(join(wfDir, "index.md"), "utf8"), "reference/workflows") },
    items: wfFiles.map((f) => {
      const md = readFileSync(join(wfDir, f), "utf8");
      return { slug: f.replace(/\.md$/, ""), title: firstH1(md), html: mdToHtml(md, "reference/workflows") };
    }),
  };

  // GP-18: the currency / unaffiliated notice — README.md's blockquote
  // paragraphs (selected and ordered by lib.mjs's emitter, the [DATE] rule's
  // values computed from the catalog meta), rendered through this page's
  // inline wrapper so its support.gainsight.com links route like every other
  // external link here. Static markup in the shell, below <main>, so it
  // renders on every view without the app knowing it exists.
  const notice =
    `<footer class="notice"><h4>${escapeHtml(NOTICE_HEADING)}</h4>` +
    noticeParagraphs(readFileSync(join(ROOT, "README.md"), "utf8"), catalog.meta)
      .map((p) => "<p>" + renderInline(p, "reference") + "</p>")
      .join("") +
    "</footer>";

  // ── Assemble index.html ──────────────────────────────────────────────────────
  const css = readFileSync(join(ASSETS, "app.css"), "utf8");
  const js = readFileSync(join(ASSETS, "app.js"), "utf8");
  const json = (o) => JSON.stringify(o).replace(/</g, "\\u003c"); // make any </script> in data safe

  const html = `<!doctype html>
<!-- GENERATED FILE — do not edit by hand. Regenerate with: npm run build:wiki (build/build-wiki.mjs). -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>gs-admin Explorer — Gainsight Admin CLI &amp; MCP</title>
<style>
${css}
</style>
</head>
<body>
<div class="topbar">
  <a class="brand" href="#/home">gs-admin <span>Explorer</span></a>
  <span class="ver">v${catalog.meta.cliVersion}</span>
  <div class="search"><input id="searchbox" type="search" placeholder="Search commands, flags, MCP tools…" autocomplete="off" spellcheck="false"></div>
  <button class="iconbtn" id="themebtn" title="Toggle light / dark">◐</button>
</div>
<div class="shell">
  <nav class="sidebar" id="sidebar"></nav>
  <div class="contentcol">
    <main class="content" id="content"></main>
    ${notice}
  </div>
</div>
<script>
window.CATALOG=${json(catalog)};
window.DOCS=${json(DOCS)};
window.WORKFLOWS=${json(WORKFLOWS)};
</script>
<script>
${js}
</script>
</body>
</html>
`;

  const outDir = join(ROOT, "wiki");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), html, "utf8");
  const kb = (Buffer.byteLength(html, "utf8") / 1024).toFixed(0);
  console.log(`Wiki built → wiki/index.html (${kb} KB, self-contained)`);
  console.log(`  ${catalog.commands.length} commands · ${DOCS.length} guide pages · ${WORKFLOWS.items.length} workflows`);
}

if (isMainModule(import.meta.url)) main();
