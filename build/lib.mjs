// build/lib.mjs — the build lane's shared module (GP-B5 W3, DS-16).
//
// Owns the lane's shared mechanics — the two every build-lane script used to
// re-derive per file (root preamble, BOM-tolerant config read) plus the T-9
// markdown grammar the two markdown generators share: the inline core since
// GP-B5 DS-25 (escapeHtml / splitPipeRow / renderInlineCore below) and, since
// the S-D2 unification (2026-09-05, T-9 v4), the ONE block parser
// (parseBlocks below) — each generator keeps only its link routing and its
// block→HTML layout:
// the repo-root preamble (previously ×16 hand copies in 3 spellings — the
// F-267 cwd-relative class; a build-lane file re-spelling it goes red in
// build/check-imports.mjs's PREAMBLE_HOMES rule) and the BOM-tolerant
// config read (previously two per-reader copies, F-204 — retired into
// readJsonFile below at B5 W3; check-doc-drift check 9 polices re-inlined
// strip copies).
//
// HARD EXCLUSION — the dual-lane emitters must NOT import this module:
//   build/extract-catalog.mjs and build/render-cheatsheet.mjs are the
//   tenet-locked pair whose generated verbatim plugin copies ship standalone
//   (byte-identity is the seam). They keep their own preamble and strip
//   spellings. Enforced by construction: build/check-imports.mjs lists both in
//   RESTRICTED (mode "builtins", id R-3) — an import edge from either to this
//   file goes red in CI.
//
// Scope note: this is the BUILD lane's home. The plugin's portability
// primitives live in plugins/gs-superadmin/scripts/doc-lib.mjs and build/ may
// not import them (declared lane graph, build/check-imports.mjs) — which is
// why readJsonFile here is a sanctioned duplicate of doc-lib's rule, named in
// doc-lib's sanctioned-duplicates enumeration and policed by
// build/check-doc-drift.mjs check 9.
import { readFileSync, realpathSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The repo root. This file lives directly in build/, so its own location
// derives the root once for the whole lane; consumers import the constant
// instead of re-spelling the preamble. Build-dir assets are spelled
// join(ROOT, "build", …) — deliberately no second path export to drift.
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Coverage floor for the two markdown-scanning checks (F-101; hoisted here at
// GP-B5 W10 from byte-identical copies in check-doc-drift and check-stale-facts
// — the consumer-parity class the wave's own seeding sweep found in its lane).
// A guard that scans too few files still exits 0 and still prints a confident
// pass line — which is exactly how F-095 survived from inception: every Linux
// CI run scanned 6 files and read as green. The shell-glob regression collapses
// the tracked list to the top-level .md files ONLY, so require the scan to have
// reached into subdirectories and to clear a conservative absolute floor.
// Raise/lower MIN_TRACKED_MD deliberately if the repo's doc set genuinely
// changes size; never delete the check to make it pass.
export const MIN_TRACKED_MD = 40;
/** @param {string[]} tracked repo-root-relative .md paths from git ls-files */
export function assertScanCoverage(tracked) {
  const nested = tracked.filter((f) => f.includes("/")).length;
  if (nested > 0 && tracked.length >= MIN_TRACKED_MD) return;
  console.error(
    `coverage floor: git ls-files returned ${tracked.length} tracked .md file(s), ${nested} of them nested — ` +
      `expected at least ${MIN_TRACKED_MD}, including files in subdirectories. This is the F-095 signature: ` +
      `the \`*.md\` pathspec reached a shell and was glob-expanded against the repo root before git saw it, ` +
      `so the scan silently shrank to the top-level files. Keep the ls-files call on execFileSync (argv, no ` +
      `shell) — do not "simplify" it back to execSync.`,
  );
  process.exit(1);
}

// BOM-tolerant JSON file read (F-118/F-204): strips exactly ONE leading
// U+FEFF (never global — F-113) before parsing, because PowerShell 5.1
// editors/redirects prepend one. Fail direction is the CALLER's: this helper
// only removes the BOM false-negative, it never catches (same contract as
// doc-lib's readJsonFile — T-7).
export function readJsonFile(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

// CLI-entry ("run as main") test \u2014 the build lane's copy of doc-lib.mjs's
// isMainModule (F-117/F-149): realpath BOTH sides (the ESM loader resolves
// import.meta.url through junctions/symlinks but leaves argv[1] as typed, and
// --preserve-symlinks-main inverts that), case-fold on win32, and any
// resolution error means "not the CLI entry" (an import must never crash on a
// weird argv). GP-B5 W8/DS-47: the two markdown generators export their
// renderer layers for the T-9 pins in build/test-wiki-html.mjs and run their
// mains only behind this test, so importing one writes nothing. build/ may not import doc-lib
// (declared lane graph), so this is a sanctioned duplicate: named in doc-lib's
// sanctioned-duplicates enumeration and policed by build/check-doc-drift.mjs
// check 9 ("CLI-entry realpath test" \u2014 the same row that sanctions the two
// render-cheatsheet.mjs copies).
export function isMainModule(importMetaUrl) {
  if (!process.argv[1]) return false;
  try {
    const self = realpathSync(fileURLToPath(importMetaUrl));
    const argv1 = realpathSync(resolve(process.argv[1]));
    return process.platform === "win32" ? self.toLowerCase() === argv1.toLowerCase() : self === argv1;
  } catch {
    return false;
  }
}

// ── The T-9 shared renderer core (GP-B5 DS-25 partial collapse) ─────────────
// Bradley-approved shape (2026-09-01), measurement-driven: the corpus
// differential in build/test-wiki-html.mjs found FULL on-corpus agreement
// between the two build-lane renderers, so what WAS character-near-identical
// hand-synced copy — the inline core and the two cell/row sentinels — became
// single code here. The BLOCK grammars stayed two parsers then, differing on
// eight fixture-pinned off-corpus axes; the S-D2 unification (2026-09-05,
// T-9 v4, Bradley: "pull off the bandaid") collapsed those too — parseBlocks
// at the end of this file is the one block parser, each former axis decided
// once (the decision table sits on the function) and pinned as an absolute
// block expectation with an in-memory mutant in build/test-wiki-html.mjs.
// The T-9 contract itself lives in build/build-wiki.mjs's frozen header.

// The 4-entity HTML escape both renderers use (previously two independently
// spelled copies — a char-class replace and a chained replaceAll — equal on
// every input; the char-class spelling survives).
export const escapeHtml = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// GFM table-row cell split with the \| escape carried through: escaped
// pipes are stashed behind an untypeable NUL-delimited sentinel before the
// split and restored per cell (F-078/F-080). Used by parseBlocks' table
// branch below — the sentinel is built from charCodes, never a raw NUL
// byte in source, and check-doc-drift check 9 sweeps for re-spelled copies.
export const splitPipeRow = (line) => {
  const PIPE = String.fromCharCode(0) + "PIPE" + String.fromCharCode(0);
  return line
    .trim()
    .replaceAll("\\|", PIPE)
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim().replaceAll(PIPE, "|"));
};

// The shared inline core: code spans are stashed behind a NUL-delimited
// sentinel BEFORE escaping, links, and emphasis — span contents are never
// touched (F-076), and because the sentinel cannot be typed in markdown,
// prose ABOUT the marker itself can never collide with a stashed span
// (the F-071 defect; untypeability is a requirement, not an aesthetic).
// **strong** and the guarded *em* regex run identically for both callers;
// never-issued sentinel indices restore untouched (?? m), not as
// "undefined". Per-side grammar arrives as hooks and ONLY these two —
// an unknown or missing hook throws (A-4: a misspelled hook must never be
// a silent no-op):
//   renderLinks(text)   REQUIRED — each side's link pass(es) over escaped
//                       text (routing is deliberately different per side and
//                       fixture-locked in each side's own suite).
//   extraEmphasis(text) optional — runs AFTER **strong**/*em*, BEFORE the
//                       sentinel restore (build-wiki's _underscore_ rule).
// The GFM `\|` prose unescape (F-080: a backslash-pipe outside a table cell
// renders as a literal pipe, never a visible backslash) runs here for both
// sides, immediately post-escape and ahead of the link pass — the position
// build-wiki's hook used to hold alone; the S-D2 unification (T-9 v4) moved
// it into the core so the comparison page follows the same GFM rule (table
// cells never reach here escaped — splitPipeRow restores them).
// Operation ORDER is fixed here on purpose — order is exactly what must not
// drift per side; the absolute pins in test-wiki-html.mjs lock the
// order-sensitive cases (with one grammar there is no cross-agreement to
// hide behind, so the pins ARE the format lock).
export function renderInlineCore(text, hooks) {
  const { renderLinks, extraEmphasis, ...unknown } = hooks;
  const stray = Object.keys(unknown);
  if (typeof renderLinks !== "function" || stray.length)
    throw new Error(
      "renderInlineCore: " +
        (stray.length ? "unknown hook(s) " + stray.join(", ") : "renderLinks hook is required")
    );
  const codes = [];
  text = text.replace(/`([^`]+)`/g, (_, c) => {
    codes.push("<code>" + escapeHtml(c) + "</code>");
    return "\u0000GSC" + (codes.length - 1) + "\u0000";
  });
  text = escapeHtml(text);
  text = text.replaceAll("\\|", "|");
  text = renderLinks(text);
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, "$1<em>$2</em>");
  if (extraEmphasis) text = extraEmphasis(text);
  text = text.replace(/\u0000GSC(\d+)\u0000/g, (m, n) => codes[n] ?? m);
  return text;
}

// ── The T-9 shared BLOCK grammar (S-D2 unification, 2026-09-05, T-9 v4) ─────
// The one markdown block parser both build-lane generators consume. It emits
// a typed block list (T-9 v4 typedefs below); each generator renders that
// list to HTML in its own layout and applies its own inline wrapper (link
// routing is the per-page difference). Before this function existed the two
// generators each parsed blocks (build-wiki.mjs direct-to-HTML, the
// comparison generator to this AST) and a 350-line differential held them
// equal on the corpus while eight off-corpus axes were allowed to differ.
// Those axes are decided ONCE here — the table is the record:
//
//   axis                  decision (CommonMark/GFM unless noted)
//   list-nesting          2-space-indented markers nest as children (the wiki
//                         used to flatten them)
//   table-detection       a table row STARTS with a pipe; separator rows are
//                         dropped wherever they sit; a run with no data row
//                         throws (fail loud — a page with a silently dropped
//                         table passed the drift check forever); the wiki's
//                         pipe-anywhere lookahead is gone (F-080 spirit)
//   blockquote            `>` must be followed by whitespace or end of line —
//                         a wrapped ">= 50 rows" line is prose (F-069/F-070)
//   hr-forms              ---, ***, ___ (three or more), optional whitespace
//   fence-close           a closing fence is a BARE ``` line (trailing text
//                         keeps the line inside the fence)
//   paragraph-interrupts  only "1. " — not any number — interrupts a
//                         paragraph, so a wrapped "173. …" stays prose;
//                         bullets, headings, fences, tables, quotes, hr do
//   heading-whitespace    space OR tab after the #-run; text trimmed
//   inline-pipe-unescape  moved into renderInlineCore above (both sides)
//   list markers          `-` or `*` bullets at column 0 (an indented marker
//                         outside a list is prose; inside one, 2+ spaces
//                         make it a child); an item's continuation is an
//                         INDENTED line (2+ spaces) — an unindented line ends
//                         the list (the wiki's lazy continuation is gone)
//   paragraph lines       trimmed and joined with one space; the first line
//                         is consumed unconditionally (an indented "  # x"
//                         is prose, and the parser can never stall)
//
// Every row above is an absolute pin with an in-memory mutant in
// build/test-wiki-html.mjs; the rebuild-and-diff of both committed pages is
// the A-6 lock that the collapse changed no shipped byte (the corpus never
// exercised an axis — the differential proved that before the collapse).
// A block this parser cannot place is a THROW, never a dropped block
// (F-061): the comparison generator turns it into its fail() collector, the
// wiki build exits non-zero on the stack trace.
//
// ── T-9 v4 · block typedefs ─────────────────────────────────────────────────
/**
 * @typedef {{ text: string, children: string[], childOrdered?: boolean }} ListItem
 * @typedef {{ type: "hr" }
 *   | { type: "h1" | "h2" | "h3" | "h4" | "h5" | "h6", text: string }
 *   | { type: "code", text: string }
 *   | { type: "table", header: string[], body: string[][] }
 *   | { type: "quote", blocks: Block[] }
 *   | { type: "list", ordered: boolean, items: ListItem[] }
 *   | { type: "p", text: string }} Block
 */
const HR_RE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const HEADING_RE = /^(#{1,6})[ \t]+(.*?)\s*$/;
const QUOTE_RE = /^\s*>(\s|$)/;
const TOP_MARKER_RE = /^(?:([-*])|(\d+)\.)[ \t]+(.*)$/;
const CHILD_MARKER_RE = /^ {2,}([-*]|\d+\.)[ \t]+(.*)$/;
const SEPARATOR_ROW_RE = /^\|[\s:|-]+\|?$/;
// A separator-shaped line ANYWHERE (leading pipe or not) — the paragraph
// branch refuses it (F-409); with a leading pipe it is a table's delimiter row.
const SEPARATOR_SHAPED_RE = /^[\s:|-]+$/;
// What ends a paragraph short of a blank line: heading, fence, table row,
// quote, bullet, "1. ", hr. Any-number ordered markers are deliberately NOT
// here (see the decision table). Every alternative here is a line one of the
// block branches above the paragraph branch CONSUMES — an interrupt no branch
// takes would stall the parser, so the paragraph loop below also consumes
// its first line unconditionally (progress by construction, not by regex
// agreement).
const PARAGRAPH_INTERRUPT_RE = /^(?:#{1,6}[ \t]|```|\||\s*>(\s|$)|[-*][ \t]|1\.[ \t]|\s*(-{3,}|\*{3,}|_{3,})\s*$)/;
/**
 * @param {string} md
 * @returns {Block[]}
 */
export function parseBlocks(md) {
  const lines = md.split(/\r?\n/);
  /** @type {Block[]} */
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) { i++; continue; }
    if (HR_RE.test(line)) { blocks.push({ type: "hr" }); i++; continue; }
    const h = line.match(HEADING_RE);
    if (h) {
      blocks.push({ type: /** @type {"h1"} */ (`h${h[1].length}`), text: h[2] });
      i++;
      continue;
    }
    if (line.startsWith("```")) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) buf.push(lines[i++]);
      i++; // the bare closing fence (or end of input)
      blocks.push({ type: "code", text: buf.join("\n") });
      continue;
    }
    if (line.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith("|")) rows.push(lines[i++].trim());
      // A separator row must contain a dash: an all-blank row like "|  |  |"
      // is a (blank) header, not a separator — dropping it would silently
      // promote the first body row into the <thead> (F-068). GFM's \| escape
      // carries a literal pipe through the cell split.
      const cells = rows.filter((r) => !(SEPARATOR_ROW_RE.test(r) && r.includes("-"))).map(splitPipeRow);
      if (!cells.length) throw new Error("table has only separator rows — nothing to render");
      blocks.push({ type: "table", header: cells[0], body: cells.slice(1) });
      continue;
    }
    if (QUOTE_RE.test(line)) {
      const buf = [];
      while (i < lines.length && QUOTE_RE.test(lines[i])) buf.push(lines[i++].replace(/^\s*>[ \t]?/, ""));
      blocks.push({ type: "quote", blocks: parseBlocks(buf.join("\n")) });
      continue;
    }
    const start = line.match(TOP_MARKER_RE);
    if (start) {
      const ordered = start[2] !== undefined;
      // Items of one list share their marker kind: an ordered marker ends a
      // bullet list and vice versa, and a change of bullet character starts a
      // new list (CommonMark) — the next loop pass opens it.
      const topMarker = ordered ? /^\d+\.[ \t]+(.*)$/ : new RegExp("^\\" + start[1] + "[ \\t]+(.*)$");
      /** @type {ListItem[]} */
      const items = [];
      while (i < lines.length) {
        const top = lines[i].match(topMarker);
        if (top) { items.push({ text: top[1], children: [] }); i++; continue; }
        const child = items.length && lines[i].match(CHILD_MARKER_RE);
        if (child) {
          const it = items[items.length - 1];
          it.childOrdered = /\d/.test(child[1]);
          it.children.push(child[2]);
          i++;
          continue;
        }
        if (items.length && /^ {2,}\S/.test(lines[i])) {
          const it = items[items.length - 1];
          if (it.children.length) it.children[it.children.length - 1] += " " + lines[i].trim();
          else it.text += " " + lines[i].trim();
          i++;
          continue;
        }
        break;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }
    // A line that reached this branch IS paragraph text, whatever the
    // interrupt regex says about it — consume it first, then extend.
    const buf = [];
    do {
      // F-409 (Gate 2 for 0.36.2): a separator-shaped line — a run of space,
      // colon, pipe and dash carrying both a dash and a pipe — is never prose;
      // it is the delimiter row of a table whose rows do not start with a
      // pipe (the one shape this grammar does not read). Folding it into a
      // paragraph would ship the dashes as text through a green rebuild
      // (bare pipes stay prose — F-080). Loud, like every other unplaceable.
      if (SEPARATOR_SHAPED_RE.test(lines[i]) && lines[i].includes("-") && lines[i].includes("|"))
        throw new Error(`a table separator row outside a table (${JSON.stringify(lines[i].trim())}) — GFM tables here start every row, the header included, with a pipe`);
      buf.push(lines[i].trim());
      i++;
    } while (i < lines.length && !/^\s*$/.test(lines[i]) && !PARAGRAPH_INTERRUPT_RE.test(lines[i]));
    blocks.push({ type: "p", text: buf.join(" ") });
  }
  return blocks;
}

// ── GP-18 · the Gainsight currency / unaffiliated notice (S-D2, 2026-09-05) ──
// Both generated wiki pages carry the notice the READMEs gained at GP-17
// (Gainsight's one condition on the going-public approval) — VERBATIM, and
// by construction: this emitter reads README.md's blockquote at build time
// through the shared parser above, selects the paragraphs by their bold
// leads, and substitutes the [DATE] rule's values from the catalog meta, so
// the wiki never has wording of its own (rung 0 — a README edit changes the
// rebuilt pages, and check-doc-drift's rebuild-and-diff reds until they are
// rebuilt; the notice text exists in exactly one hand-maintained place).
// The date is COMPUTED, never a literal: data/catalog.json meta.generatedAt's
// date, cited with the pinned package (check-stale-facts holds the README's
// literal to the same stamp, and scans .md only — the wiki's copy is held by
// this substitution plus the drift check, not by widening that scan).
// Selection and order are layout decisions Bradley made on the S-D2 mockup:
// the Currency group first (the requested wording), then the Unaffiliated
// paragraph; "Support expectations" stays README-only. A lead paragraph
// carries every following lead-less paragraph with it (the second Currency
// paragraph has no bold lead of its own). Missing blockquote, missing lead,
// or a Currency paragraph without the date/pin phrases to substitute is a
// THROW — a notice that silently lost its date would pass every check.
export const NOTICE_HEADING = "Notice";
export const NOTICE_LEADS = ["Currency.", "Unaffiliated community project."];
// The blockquote's leads that stay README-only (F-405): declared, so an
// undeclared lead is a build failure rather than a silently ignored group.
export const README_ONLY_LEADS = ["Support expectations."];
const DATE_PHRASE_RE = /last updated on \d{4}-\d{2}-\d{2}/;
const PIN_PHRASE_RE = /`@gainsight\/gs-admin-cli@\d+\.\d+\.\d+`/;
/**
 * @param {string} readmeMd  the root README's markdown
 * @param {{ generatedAt: string, cliPackage?: string, cliVersion: string }} meta  data/catalog.json meta
 * @returns {string[]}  the notice paragraphs as MARKDOWN text, date + pin substituted, in footer order
 */
export function noticeParagraphs(readmeMd, meta) {
  const date = String(meta.generatedAt ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`notice: catalog meta.generatedAt is not a date: ${JSON.stringify(meta.generatedAt)}`);
  const pin = `\`${meta.cliPackage ?? "@gainsight/gs-admin-cli"}@${meta.cliVersion}\``;
  const quote = parseBlocks(readmeMd).find(
    (b) => b.type === "quote" && b.blocks.some((p) => p.type === "p" && p.text.startsWith(`**${NOTICE_LEADS[0]}**`)),
  );
  if (!quote || quote.type !== "quote") throw new Error(`notice: README.md has no blockquote carrying a **${NOTICE_LEADS[0]}** paragraph`);
  // F-405 (Gate 2 for 0.36.2): the blockquote's structure is DECLARED, never
  // inferred. Every block must be a paragraph; every bold lead must be one
  // this emitter knows (NOTICE_LEADS, emitted, or README_ONLY_LEADS, kept to
  // the README); a lead-less paragraph may follow an EMITTED lead only (it
  // rides with it — the second Currency paragraph). Anything else is a THROW,
  // so an edit to the blockquote that nobody declared fails the build instead
  // of silently changing — or silently not changing — the published notice
  // (the Gate 2 verifier measured four silent variants against the old loop).
  /** @type {Map<string, string[]>} */
  const groups = new Map();
  let current = null;
  for (const b of quote.blocks) {
    if (b.type !== "p")
      throw new Error(`notice: README.md's notice blockquote carries a ${b.type} block — only paragraphs are emitted; keep the blockquote to paragraphs`);
    const lead = b.text.match(/^\*\*([^*]+)\*\*/);
    if (lead) {
      current = lead[1];
      if (!NOTICE_LEADS.includes(current) && !README_ONLY_LEADS.includes(current))
        throw new Error(`notice: README.md's blockquote opens an undeclared lead **${current}** — add it to NOTICE_LEADS (emitted) or README_ONLY_LEADS (README-only) in build/lib.mjs`);
      if (groups.has(current)) throw new Error(`notice: README.md's blockquote opens **${current}** twice`);
      groups.set(current, []);
    } else if (current === null || README_ONLY_LEADS.includes(current)) {
      throw new Error(
        `notice: a lead-less paragraph in README.md's blockquote follows ${current === null ? "no lead" : `the README-only **${current}**`} — it would be silently dropped from the wiki; give it a declared lead`,
      );
    }
    groups.get(current).push(b.text);
  }
  const out = [];
  for (const lead of NOTICE_LEADS) {
    const paras = groups.get(lead);
    if (!paras) throw new Error(`notice: README.md's blockquote has no **${lead}** paragraph`);
    out.push(...paras);
  }
  const currency = out[0];
  if (!DATE_PHRASE_RE.test(currency) || !PIN_PHRASE_RE.test(currency))
    throw new Error("notice: the Currency paragraph no longer carries the 'last updated on <date>' phrase and the `@gainsight/gs-admin-cli@<pin>` citation — the [DATE] rule has nothing to substitute");
  out[0] = currency.replace(DATE_PHRASE_RE, `last updated on ${date}`).replace(PIN_PHRASE_RE, pin);
  return out;
}
