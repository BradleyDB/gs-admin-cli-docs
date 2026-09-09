#!/usr/bin/env node
// Build wiki/comparison-guide.html from reference/comparison-guide.md.
//
// Renderer-grammar contract: this file is the second of the two build-lane
// markdown renderers bound by the T-9 contract in build/build-wiki.mjs's
// header. Since T-9 v4 (S-D2, 2026-09-05) the whole grammar — the block
// parser (parseBlocks) and the inline core — is SINGLE code in build/lib.mjs;
// what this file owns is its link routing (resolveLink), its inline extras
// (titled and balanced-paren links) and the enriched block→HTML renderers
// below. A parsing change is a lib.mjs change, pinned there and rebuilt into
// both committed pages under check-doc-drift's rebuild-and-diff.
//
// Zero dependencies (Node built-ins only). The renderers handle the block
// list the shared parser emits — h1/h2 structurally (title and section
// splits), h3–h6 as headings, paragraphs, pipe tables, dash/star and numbered
// lists (one nesting level), fenced code, blockquotes (with block content),
// hr, and inline bold/em/code/links — plus three structure-aware enrichments
// keyed to the document's shape (not its wording):
//
//   1. In the "What each approach is" section, an h3 ending in "(...)" renders
//      the paren text as a colored lane pill.
//   2. In the "Use-case guide" section, each h3 becomes a card, and a leading
//      all-bold "Use …" / "Split: …" verdict paragraph becomes the card's pill.
//   3. Any table cell that is entirely bold renders as a pill; table header
//      cells naming a lane get that lane's color.
//
// Lane classification is keyword-based: the word "both" (or M2M plus a
// CLI/plugin keyword) → both-lane, "M2M" alone → M2M lane, anything else →
// CLI+plugin lane. Output is deterministic (no timestamps) so CI can rebuild
// and diff.
//
// A block the renderer cannot place fails the build (non-zero exit) instead of
// vanishing: the CI drift check compares committed HTML to a rebuild, so a
// silently-dropped block would otherwise pass forever.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, isMainModule, readJsonFile, renderInlineCore, escapeHtml, parseBlocks, noticeParagraphs, NOTICE_HEADING } from "./lib.mjs";

const SRC = join(ROOT, "reference", "comparison-guide.md");
const OUT = join(ROOT, "wiki", "comparison-guide.html");

// Sections that get structure-aware enrichment, matched by h2 text.
const APPROACHES_H2 = "What each approach is";
const USECASES_H2 = "Use-case guide";

let buildFailed = false;
const fail = (msg) => {
  console.error(`build-comparison-html: ${msg}`);
  buildFailed = true;
};

// ---------------------------------------------------------------- inline md
// The shared 4-entity escape (build/lib.mjs) under this file's local name.
const esc = escapeHtml;

// The page lives at wiki/comparison-guide.html; the source at
// reference/comparison-guide.md. Relative links are resolved from the source
// dir and re-targeted to work from the output dir: reference docs route into
// the wiki app next door (they render there; raw .md paths would download),
// everything else gets a path correct relative to wiki/. A copy of the file
// shared outside a repo checkout still can't reach repo files — only absolute
// URLs could fix that, which are deliberately not minted before the public
// repo exists (GP-11).
function resolveLink(url) {
  url = url.trim();
  if (/^(https?:|mailto:|#)/.test(url)) return url;
  const [path, anchor] = url.split("#");
  const stack = ["reference"];
  for (const seg of path.split("/")) {
    if (seg === "..") stack.pop();
    else if (seg && seg !== ".") stack.push(seg);
  }
  const resolved = stack.join("/");
  const suffix = anchor ? "#" + anchor : "";
  const ref = resolved.match(/^reference\/(.+)\.md$/);
  if (ref) {
    const rel = ref[1];
    let route;
    if (rel === "domains/index" || rel === "domains") route = "#/home";
    else if (rel.startsWith("domains/")) route = "#/domain/" + rel.slice("domains/".length);
    else if (rel === "workflows/index" || rel === "workflows") route = "#/workflows";
    else if (rel.startsWith("workflows/")) route = "#/workflow/" + rel.slice("workflows/".length);
    else route = "#/doc/" + rel;
    return "index.html" + route;
  }
  return "../" + resolved + suffix;
}

// The stash/escape/emphasis/restore core is the shared renderInlineCore in
// build/lib.mjs (T-9, GP-B5 DS-25); this wrapper carries only the
// comparison-side grammar: the title-bearing and balanced-paren link forms,
// routed through this file's resolveLink.
function inline(s) {
  return renderInlineCore(s, {
    // Link with an optional "title" (quotes are already &quot; here), then the
    // plain form; URLs may carry one level of balanced parens.
    renderLinks: (s) =>
      s
        .replace(
          /\[([^\]]+)\]\(\s*(\S+?)\s+&quot;(.*?)&quot;\s*\)/g,
          (_, t, u, ti) => `<a href="${resolveLink(u)}" title="${ti}">${t}</a>`
        )
        .replace(
          /\[([^\]]+)\]\(((?:[^()]|\([^()]*\))+)\)/g,
          (_, t, u) => `<a href="${resolveLink(u)}">${t}</a>`
        ),
  });
}

const plain = (s) => s.replace(/\*\*|\*|`/g, "").trim();

// Word-boundary matches: "cli" must not match "client" — the M2M lane's own
// vocabulary ("client credentials", "client secret") is exactly where a bare
// substring test misfires. The both-lane fires on the literal word "both" or
// on M2M plus an assisted keyword; M2M alone is the M2M lane; anything else
// defaults to the CLI+plugin lane.
function lane(text) {
  const t = text.toLowerCase();
  const m2m = t.includes("m2m");
  const assisted = /\b(plugin|cli|gs-admin)\b/.test(t);
  if (/\bboth\b/.test(t) || (m2m && assisted)) return "ab";
  if (m2m) return "b";
  return "a";
}

const slug = (s) =>
  plain(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const seenSlugs = new Set();
function uniqueSlug(s) {
  const base = slug(s) || "section";
  let out = base;
  for (let n = 2; seenSlugs.has(out); n++) out = `${base}-${n}`;
  seenSlugs.add(out);
  return out;
}

// ---------------------------------------------------------------- renderers
function renderTable(block) {
  const laneClass = (cell) => {
    const t = plain(cell);
    if (!t) return "";
    if (/\bboth\b/i.test(t) || (/m2m/i.test(t) && /\b(gs-admin|plugin|cli)\b/i.test(t)))
      return ' class="col-ab"';
    if (/m2m/i.test(t)) return ' class="col-b"';
    if (/\b(gs-admin|plugin|cli)\b/i.test(t)) return ' class="col-a"';
    return "";
  };
  const head = block.header
    .map((c) => `<th${laneClass(c)}>${inline(c)}</th>`)
    .join("");
  // Rows are normalized to the header's width (pad short, truncate long),
  // matching build-wiki.mjs and GFM — a ragged <tr> never reaches the page.
  const body = block.body
    .map((row) => {
      const tds = block.header
        .map((_, idx) => {
          const c = row[idx] ?? "";
          const pill = c.match(/^\*\*([^*]+)\*\*$/);
          if (idx === 0)
            return `<td class="rowlabel">${pill ? inline(pill[1]) : inline(c)}</td>`;
          if (pill)
            return `<td><span class="pill ${lane(pill[1])}">${esc(plain(pill[1]))}</span></td>`;
          return `<td>${inline(c)}</td>`;
        })
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("\n          ");
  return `<div class="table-wrap">
      <table>
        <thead><tr>${head}</tr></thead>
        <tbody>
          ${body}
        </tbody>
      </table>
    </div>`;
}

function renderList(b) {
  const tag = b.ordered ? "ol" : "ul";
  const lis = b.items
    .map((it) => {
      let li = `      <li>${inline(it.text)}`;
      if (it.children.length) {
        const ctag = it.childOrdered ? "ol" : "ul";
        li +=
          `\n        <${ctag}>\n` +
          it.children.map((c) => `          <li>${inline(c)}</li>`).join("\n") +
          `\n        </${ctag}>\n      `;
      }
      return li + "</li>";
    })
    .join("\n");
  return `<${tag}>\n${lis}\n    </${tag}>`;
}

function renderBlock(b) {
  switch (b.type) {
    case "p": return `<p>${inline(b.text)}</p>`;
    case "list": return renderList(b);
    case "code": return `<pre><code>${esc(b.text)}</code></pre>`;
    case "quote": {
      const inner = b.blocks;
      if (inner.length === 1 && inner[0].type === "p")
        return `<div class="note">${inline(inner[0].text)}</div>`;
      return `<div class="note">${inner.map(renderBlock).filter(Boolean).join("\n    ")}</div>`;
    }
    case "table": return renderTable(b);
    case "h3": return `<h3>${inline(b.text)}</h3>`;
    case "h4": return `<h4>${inline(b.text)}</h4>`;
    case "h5": return `<h5>${inline(b.text)}</h5>`;
    case "h6": return `<h6>${inline(b.text)}</h6>`;
    case "hr": return "";
    default:
      fail(`unhandled block type "${b.type}" — refusing to drop it silently`);
      return "";
  }
}

// h3 with a trailing "(role)" → heading + role pill (approaches section only).
function renderApproachH3(text) {
  const m = text.match(/^(.*)\s+\(([^)]+)\)$/);
  if (!m) return `<h3>${inline(text)}</h3>`;
  return `<h3>${inline(m[1])} <span class="pill ${lane(m[1])}">${esc(plain(m[2]))}</span></h3>`;
}

// A verdict paragraph like "**Use the gs-admin CLI.**" → pill label.
// \b keeps "Used…"/"Splitting…" prose sentences out of the pill.
function verdictPill(text) {
  const m = text.match(/^\*\*(Use|Split)\b([^*]*)\*\*$/);
  if (!m) return null;
  let label = plain(text).replace(/\.$/, "");
  if (/^split/i.test(label)) label = label.replace(/^Split:\s*/i, "");
  else label = label.replace(/^Use\s+(the\s+)?/i, "");
  return `<span class="pill ${lane(label)}">${esc(label)}</span>`;
}

// ---------------------------------------------------------------- assemble
// The parse layer above (parseBlocks / inline / resolveLink) is exported for
// build/test-wiki-html.mjs's T-9 differential (GP-B5 W8/DS-47): the suite
// imports the real parser instead of compiling a source slice — the slice
// survives there only to seed in-memory mutants. The build itself runs
// behind isMainModule, so importing this module reads and writes nothing.
export { resolveLink, inline };

function renderSection(sec) {
  const isApproaches = sec.title === APPROACHES_H2;
  const isUsecases = sec.title === USECASES_H2;
  const parts = [];

  if (isUsecases) {
    // Each h3 starts a card; ONLY a leading verdict paragraph — the first
    // block after the h3 — becomes its pill. A verdict-shaped paragraph
    // later in a card stays in the body where the author put it. Blocks
    // before the first h3 render as ordinary section content.
    let card = null;
    let awaitingVerdict = false;
    const flush = () => { if (card) { parts.push(card + "\n    </div>"); card = null; } };
    for (const b of sec.blocks) {
      if (b.type === "h3") {
        flush();
        card = `<div class="usecase">\n      <div class="usecase-head"><h3>${inline(b.text)}</h3>__PILL__</div>`;
        awaitingVerdict = true;
      } else if (card) {
        const pill = awaitingVerdict && b.type === "p" ? verdictPill(b.text) : null;
        awaitingVerdict = false;
        // Function replacement: pill text must never be parsed for
        // $-substitution patterns.
        if (pill) card = card.replace("__PILL__", () => pill);
        else {
          const html = renderBlock(b);
          if (html) card += "\n      " + html;
        }
      } else {
        parts.push(renderBlock(b));
      }
    }
    flush();
  } else {
    for (const b of sec.blocks) {
      if (b.type === "h3" && isApproaches) parts.push(renderApproachH3(b.text));
      else parts.push(renderBlock(b));
    }
  }

  return `  <section id="${uniqueSlug(sec.title)}">
    <h2>${inline(sec.title)}</h2>
    ${parts.filter(Boolean).join("\n    ").replaceAll("__PILL__", "")}
  </section>`;
}

const css = String.raw`
  :root {
    --ground: #f6f8f8; --surface: #ffffff; --ink: #1c2628; --ink-soft: #4c5a5c;
    --border: #dbe3e2;
    --lane-a: #0e7c7b; --lane-a-soft: #e3f0ef;      /* CLI + plugin */
    --lane-b: #a65a2e; --lane-b-soft: #f4e9e1;      /* M2M OAuth */
    --lane-ab: #5b5f8a; --lane-ab-soft: #e9eaf3;    /* both */
    --code-bg: #eef2f1;
    --serif: "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
    --sans: "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", Arial, sans-serif;
    --mono: "Cascadia Code", Consolas, "SF Mono", Menlo, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --ground: #101617; --surface: #182022; --ink: #e4ecea; --ink-soft: #9fb0ae;
      --border: #2b3739; --lane-a: #45bdb2; --lane-a-soft: #14302f;
      --lane-b: #dd9a62; --lane-b-soft: #33251a; --lane-ab: #9ba0d4;
      --lane-ab-soft: #23253a; --code-bg: #1d2729;
    }
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
  body { background: var(--ground); color: var(--ink); font-family: var(--sans); font-size: 16px; line-height: 1.65; }
  .page { max-width: 46rem; margin: 0 auto; padding: 3.5rem 1.5rem 5rem; }
  .masthead { margin-bottom: 3rem; }
  .eyebrow { font-size: .72rem; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-soft); margin-bottom: .9rem; }
  h1 { font-family: var(--serif); font-size: 2.3rem; line-height: 1.15; font-weight: 600; text-wrap: balance; margin-bottom: 1rem; }
  .standfirst { color: var(--ink-soft); font-size: 1.05rem; max-width: 40rem; }
  .lane-key { display: flex; flex-wrap: wrap; gap: .6rem; margin-top: 1.4rem; }
  .pill { display: inline-block; font-size: .74rem; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; padding: .22rem .7rem; border-radius: 2px; white-space: nowrap; }
  .pill.a  { background: var(--lane-a-soft);  color: var(--lane-a); }
  .pill.b  { background: var(--lane-b-soft);  color: var(--lane-b); }
  .pill.ab { background: var(--lane-ab-soft); color: var(--lane-ab); }
  section { margin-top: 3.2rem; }
  h2 { font-family: var(--serif); font-size: 1.55rem; font-weight: 600; line-height: 1.25; text-wrap: balance; padding-bottom: .5rem; border-bottom: 1px solid var(--border); margin-bottom: 1.2rem; }
  h3 { font-family: var(--serif); font-size: 1.18rem; font-weight: 600; margin: 1.8rem 0 .6rem; text-wrap: balance; }
  h4, h5, h6 { font-family: var(--serif); font-size: 1.02rem; font-weight: 600; margin: 1.4rem 0 .5rem; text-wrap: balance; }
  p { margin-bottom: .9rem; max-width: 42rem; }
  p:last-child { margin-bottom: 0; }
  ul, ol { margin: 0 0 .9rem 1.2rem; max-width: 42rem; }
  li ul, li ol { margin: .45rem 0 0 1.2rem; }
  li { margin-bottom: .45rem; }
  strong { font-weight: 650; }
  a { color: var(--lane-a); }
  a:focus-visible { outline: 2px solid var(--lane-a); outline-offset: 2px; }
  code { font-family: var(--mono); font-size: .84em; background: var(--code-bg); padding: .1em .35em; border-radius: 3px; }
  pre { background: var(--code-bg); border: 1px solid var(--border); border-radius: 6px; padding: 1rem 1.2rem; overflow-x: auto; margin-bottom: .9rem; }
  pre code { background: none; padding: 0; font-size: .82rem; line-height: 1.55; }
  .table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); margin: 1.1rem 0; }
  table { border-collapse: collapse; width: 100%; font-size: .9rem; }
  th, td { text-align: left; vertical-align: top; padding: .65rem .85rem; border-bottom: 1px solid var(--border); }
  tr:last-child > td { border-bottom: none; }
  thead th { font-size: .74rem; letter-spacing: .07em; text-transform: uppercase; color: var(--ink-soft); background: var(--ground); border-bottom: 1px solid var(--border); }
  thead th.col-a { color: var(--lane-a); box-shadow: inset 0 3px 0 var(--lane-a); }
  thead th.col-b { color: var(--lane-b); box-shadow: inset 0 3px 0 var(--lane-b); }
  thead th.col-ab { color: var(--lane-ab); box-shadow: inset 0 3px 0 var(--lane-ab); }
  td.rowlabel { font-weight: 650; min-width: 11rem; }
  tbody tr:nth-child(even) { background: color-mix(in srgb, var(--ground) 55%, var(--surface)); }
  .usecase { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 1.15rem 1.3rem; margin-bottom: 1rem; }
  .usecase-head { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: .55rem; }
  .usecase-head h3 { margin: 0; font-size: 1.08rem; }
  .usecase p { font-size: .94rem; }
  .note { border-left: 3px solid var(--lane-a); background: var(--surface); border-radius: 0 6px 6px 0; padding: .8rem 1.1rem; margin: 1.1rem 0; font-size: .94rem; color: var(--ink-soft); }
  .note strong { color: var(--ink); }
  footer { margin-top: 4rem; padding-top: 1.2rem; border-top: 1px solid var(--border); font-size: .85rem; color: var(--ink-soft); font-style: italic; }
  footer.notice { font-style: normal; font-size: .88rem; }
  footer.notice .eyebrow { margin-bottom: .6rem; }
  footer.notice p { max-width: none; }
  footer.notice strong { color: var(--ink); }
  footer.notice + footer { margin-top: 1.5rem; }
  @media (max-width: 560px) { h1 { font-size: 1.8rem; } .page { padding-top: 2.2rem; } }
`;

function main() {
  const md = readFileSync(SRC, "utf8");
  // The shared parser THROWS on a block it cannot place (T-9 v4, F-061);
  // this generator's fail-loudly contract is the collector below — exit 1,
  // output unwritten — so the throw lands there instead of as a stack trace.
  /** @type {import("./lib.mjs").Block[]} */
  let blocks = [];
  try { blocks = parseBlocks(md); } catch (e) { fail(e instanceof Error ? e.message : String(e)); }

  const h1At = blocks.findIndex((b) => b.type === "h1");
  if (h1At === -1) fail("document has no h1 title");
  if (h1At > 0)
    fail(`${h1At} block(s) precede the h1 title and have no place in the layout`);
  // The typed block union (T-9 v4) needs the narrowing spelled: an h1 and a
  // paragraph both carry `text`, an hr does not.
  const textOf = (/** @type {import("./lib.mjs").Block} */ b) => ("text" in b ? b.text : "");
  const title = h1At >= 0 ? textOf(blocks[h1At]) : "Comparison guide";
  let idx = h1At + 1;
  const standfirst = blocks[idx]?.type === "p" ? textOf(blocks[idx++]) : "";

  // Everything between the standfirst and the first h2 renders as lead content.
  const lead = [];
  while (idx < blocks.length && blocks[idx].type !== "h2") {
    lead.push(blocks[idx]);
    idx++;
  }

  // Footer: a final lone-italic paragraph.
  let footer = "";
  const last = blocks[blocks.length - 1];
  if (last?.type === "p" && /^\*[^*]+\*$/.test(last.text)) {
    footer = last.text.replace(/^\*|\*$/g, "");
    blocks.pop();
  }

  // GP-18: the currency / unaffiliated notice — README.md's blockquote
  // paragraphs through lib.mjs's emitter (selection, order, the [DATE] rule
  // computed from the catalog meta — the one catalog read this page makes),
  // rendered through this page's own inline wrapper. Emitted as a second
  // footer above the italic source line, in the page's own eyebrow style.
  const notice = noticeParagraphs(readFileSync(join(ROOT, "README.md"), "utf8"), readJsonFile(join(ROOT, "data", "catalog.json")).meta);

  // Group the remainder into h2 sections.
  const sections = [];
  for (let i = idx; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type === "h2") sections.push({ title: b.text, blocks: [] });
    else if (sections.length) sections[sections.length - 1].blocks.push(b);
  }

  const html = `<!doctype html>
<!-- GENERATED FILE — do not edit by hand.
     Built by build/build-comparison-html.mjs from reference/comparison-guide.md.
     Regenerate: npm run build:comparison -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(plain(title))}</title>
<style>${css}</style>
</head>
<body>
<div class="page">

  <header class="masthead">
    <p class="eyebrow">Integration guide</p>
    <h1>${inline(title)}</h1>
    <p class="standfirst">${inline(standfirst)}</p>
    <div class="lane-key" aria-label="Color key">
      <span class="pill a">gs-admin CLI + plugin</span>
      <span class="pill b">M2M OAuth</span>
      <span class="pill ab">Plugin + M2M</span>
    </div>
  </header>

${lead.map(renderBlock).filter(Boolean).map((h) => `  ${h}`).join("\n")}

${sections.map(renderSection).join("\n\n")}

  <footer class="notice"><p class="eyebrow">${esc(NOTICE_HEADING)}</p>${notice.map((p) => `<p>${inline(p)}</p>`).join("")}</footer>

  <footer>${inline(footer)}</footer>

</div>
</body>
</html>
`;

  if (buildFailed) {
    process.exitCode = 1;
    console.error("build-comparison-html: FAILED — output not written");
  } else {
    writeFileSync(OUT, html);
    console.log(
      `Built wiki/comparison-guide.html (${(html.length / 1024).toFixed(1)} KB, ` +
      `${sections.length} sections) from reference/comparison-guide.md`
    );
  }
}

if (isMainModule(import.meta.url)) main();
