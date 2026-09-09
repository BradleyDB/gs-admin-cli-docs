#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// jo-report-search.mjs — `search` mode of the JO email-report (ER-4).
//
// Keyword search across every KB email template's title / subject / body /
// variant subjects+bodies, reporting each hit with a snippet and the programs
// that use the template (name + status). Loaded by jo-report.mjs's dispatcher
// (contract C3) — never invoked directly by the skill.
//
//   jo-report.mjs search --index <er-index.json> --query '<term>' [--query …]
//     [--all-terms] [--whole-word] [--snippet <n>]
//     [--active-only] [--include-paused]
//     --report <dir> [--csv-dir <dir>]
//
// Semantics (requirements confirmed S2, 2026-07-12):
// - Multiple --query terms are OR'd: a template matching ANY term is a hit and
//   each match row names its term. --all-terms switches to AND — the template
//   must match every term somewhere across its searched fields (rows still
//   show per-term matches).
// - Matching is case-insensitive SUBSTRING by default ("renewal" also hits
//   "renewals"); --whole-word restricts terms to word boundaries. Token text
//   (e.g. ${Account.Name}) is ordinary body text — no special handling.
// - One match row per template × field × term (the FIRST occurrence in that
//   field), with ±--snippet chars of context (default 50 — Bradley, S5-V). Occurrence counts
//   are deliberately not reported — the report answers "which templates",
//   the KB doc answers "where exactly".
// - --active-only keeps only templates used by ≥1 active program (PROCESSING;
//   PAUSE joins via --include-paused — the shared isActive predicate).
// - search-hits.csv is ONE ROW PER TEMPLATE (ER-13, reshaped S7): per-field
//   match booleans (title/subject/body/variants) + per-field snippet columns,
//   terms_matched comma-joined. The template subject is a plain attribute
//   column on every row, matched or not (ER-14) — and is carried into the
//   summary JSON's hitTemplates sample for the same reason.
// - counts report templateProgramLinks (template→program link rows — what the
//   programs CSV holds) AND distinctProgramsReferenced (deduped program ids),
//   so N links to one program can never read as N programs (ER-16).
// - Tokens (ER-15): subjects and snippets resolve ${...} tokens via the
//   template's OWN tokens[] (author labels — search is template-centric and
//   cannot reach program bindings; a standing caveat says so). Matching runs
//   on the ORIGINAL text; only the rendered output resolves.
// - Surveys (ER-17): each program-context row names the survey(s) that
//   program binds to steps sending the template (markdown + programs CSV).
//
// Adds mode flags --all-terms / --whole-word / --snippet <n> on top of the C3
// surface (C3 allows additions; recorded in the plan's as-shipped notes).
//
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseFlags,
  C3_BOOLEAN,
  loadIndex,
  isActive,
  writeModeReport,
  mdTable,
  toCsv,
  emitSummary,
  fail,
  kbDocDisplayPath,
  renderTokens,
  stepSurveys,
  tokenMetadataCaveat,
} from "./jo-report.mjs";
// Portability primitives (doc-lib): NFC fold for the match path (F-127), the
// one shq/caveat copy (F-123), pinned comparators (F-128), surrogate-safe
// slicing (F-131).
import { normTerm, shq, cmpName, cmpKey, codePointSlice, escapeRe } from "./doc-lib.mjs";

// ── matching primitives (exported for tests) ─────────────────────────────────

// A JSON.parse'd index inherits Object.prototype, so id-keyed lookups must be
// own-property checks: a template or program literally named "constructor"
// must resolve to the DATA entry (or nothing), never to a prototype member.
const own = (obj, key) => (obj != null && Object.hasOwn(obj, key) ? obj[key] : undefined);

// One case-insensitive regex per term, compiled ONCE per run (not per
// template×field — a real index has ~600 templates × ~5 fields). Substring
// mode matches the escaped term anywhere; whole-word wraps it in lookarounds
// on [A-Za-z0-9_] rather than \b so terms that start/end with a non-word char
// ("c++", "24/7") still get sane boundaries. Matching runs on the ORIGINAL
// text (never a toLowerCase copy) so offsets feed makeSnippet exactly —
// Unicode case folding can change string length (e.g. "İ".toLowerCase() is
// two code units) and would shift indexOf-on-lowered offsets. The same
// offset-integrity rule governs the NFC fold (F-127): the TERM is folded
// here, and callers fold the TEXT once and use that same folded string for
// both exec and makeSnippet — never the raw original, whose offsets differ.
export function compileTerm(term, { wholeWord = false } = {}) {
  const esc = escapeRe(normTerm(term));
  return new RegExp(wholeWord ? `(?<![A-Za-z0-9_])${esc}(?![A-Za-z0-9_])` : esc, "i");
}

// First occurrence of term in text, or null. Convenience wrapper over
// compileTerm for one-off calls and tests; searchTemplates precompiles.
// Offsets refer to the NFC-folded text (F-127) — slice the folded string,
// not the raw one (normTerm is idempotent, so re-folding is safe).
export function findMatch(text, term, { wholeWord = false } = {}) {
  if (!text || !term) return null;
  const m = compileTerm(term, { wholeWord }).exec(normTerm(text));
  return m ? { start: m.index, end: m.index + m[0].length } : null;
}

// ±radius chars of context around a match, whitespace runs collapsed so a
// snippet is always one report-table line, ASCII ellipses marking truncation
// (F-124 — snippets land in CSV cells). codePointSlice keeps a radius
// boundary from cutting through a surrogate pair (F-131).
export function makeSnippet(text, start, end, radius = 50) {
  const s = Math.max(0, start - radius);
  const e = Math.min(text.length, end + radius);
  const body = codePointSlice(text, s, e).replace(/\s+/g, " ").trim();
  return (s > 0 ? "..." : "") + body + (e < text.length ? "..." : "");
}

// The searchable fields of one C1 template entry, in report order. Variant
// fields carry the variant name so a hit row says exactly where it landed.
export function searchableFields(tpl) {
  const fields = [];
  if (tpl.title) fields.push({ field: "title", text: tpl.title });
  if (tpl.subject) fields.push({ field: "subject", text: tpl.subject });
  if (tpl.body) fields.push({ field: "body", text: tpl.body });
  for (const v of tpl.variants ?? []) {
    const name = v.name ?? "(unnamed)";
    if (v.subject) fields.push({ field: `variant "${name}" subject`, text: v.subject });
    if (v.body) fields.push({ field: `variant "${name}" body`, text: v.body });
  }
  return fields;
}

// The survey name(s) a program binds to the steps that send this template
// (C1 boundAssets, SURVEY entries — ER-17). Sorted for stable rendering.
export function programSurveyNames(program, templateId) {
  const names = new Set();
  for (const s of program?.steps ?? []) {
    const ids = [s?.emailTemplateId, ...(s?.variantTemplateIds ?? [])];
    if (!ids.includes(templateId)) continue;
    for (const a of stepSurveys(s)) if (a.name) names.add(a.name);
  }
  return [...names].sort();
}

// Search is template-centric: only the template's own tokens[] (the AUTHOR
// labels) are reachable — the standing author-label caveat says so (ER-15).
const resolvedText = (text, tpl) => renderTokens(text, { templateTokens: tpl?.tokens ?? null });

// ── core search (exported for tests) ─────────────────────────────────────────

// index + terms → sorted hit list. Each hit: the template, its match rows
// (field/term/snippet), and the programs using it (with the shared active
// classification). Pure — no I/O, no process state.
export function searchTemplates(
  index,
  terms,
  { wholeWord = false, allTerms = false, activeOnly = false, includePaused = false, snippetRadius = 50 } = {}
) {
  // terms deduped here so --all-terms stays satisfiable when the caller
  // repeats a term (a Set of matched terms could never reach a length that
  // counts duplicates) and so repeated terms can't double every match row.
  const uniqueTerms = [...new Set(terms)];
  const matchers = uniqueTerms.map((term) => ({ term, re: compileTerm(term, { wholeWord }) }));
  const hits = [];
  let templatesSearched = 0;
  for (const tpl of Object.values(index.templates ?? {})) {
    const fields = searchableFields(tpl);
    if (!fields.length) continue;
    templatesSearched++;
    const matches = [];
    const matchedTerms = new Set();
    for (const { field, text } of fields) {
      // NFC-fold the text ONCE and use the folded string for BOTH exec and
      // makeSnippet — offsets are only valid on the string they were computed
      // against (F-127; the compileTerm comment states the rule).
      const folded = normTerm(text);
      for (const { term, re } of matchers) {
        const m = re.exec(folded);
        if (!m) continue;
        matchedTerms.add(term);
        matches.push({ field, term, snippet: makeSnippet(folded, m.index, m.index + m[0].length, snippetRadius) });
      }
    }
    if (!matches.length) continue;
    if (allTerms && matchedTerms.size < uniqueTerms.length) continue;

    const programs = (own(index.links?.templateToPrograms, tpl.id) ?? [])
      .map((pid) => own(index.programs, pid))
      .filter((p) => p && typeof p === "object")
      .map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        active: isActive(p, { includePaused }),
        // ER-17: program-context rows show the survey the program binds to
        // the steps sending this template (names only — no URLs, ruled)
        surveys: programSurveyNames(p, tpl.id),
      }));
    if (activeOnly && !programs.some((p) => p.active)) continue;
    hits.push({ template: tpl, matches, programs });
  }
  hits.sort((a, b) => cmpName(a.template.title, b.template.title) || cmpKey(a.template.id, b.template.id)); // pinned locale (F-128)
  return { hits, templatesSearched };
}

// ── per-template CSV rows (ER-13/ER-14 — exported for tests) ─────────────────

// One row per matched template. The field dimension lives in COLUMNS: match
// booleans + a snippet column per field. All variant subjects/bodies fold
// into one variants bucket (their snippet cell names each variant location).
export const SEARCH_HITS_HEADER = [
  "template_id", "template_title", "subject", "terms_matched",
  "title_matched", "subject_matched", "body_matched", "variants_matched",
  "title_snippet", "subject_snippet", "body_snippet", "variant_snippets",
];

// multiTerm: prefix each snippet with its [term] so a collapsed row still
// says which term produced which snippet (single-term runs stay clean).
// The title/subject/body literals mirror searchableFields' field names —
// keep in sync: a field added there without a column here would silently
// misfile into the variants bucket.
// Subjects and snippets resolve ${...} tokens via the template's author
// labels (ER-15 — matching still ran on the ORIGINAL text; a token truncated
// by the snippet window stays a raw fragment).
export function hitCsvRow(hit, { multiTerm = false } = {}) {
  const groups = { title: [], subject: [], body: [], variants: [] };
  for (const m of hit.matches)
    (groups[m.field === "title" || m.field === "subject" || m.field === "body" ? m.field : "variants"]).push(m);
  const snip = (list, withLocation = false) =>
    list
      .map((m) => `${withLocation ? `${m.field}: ` : ""}${multiTerm ? `[${m.term}] ` : ""}${resolvedText(m.snippet, hit.template)}`)
      .join(" | ");
  return [
    hit.template.id,
    hit.template.title,
    resolvedText(hit.template.subject, hit.template) ?? "", // ER-14: subject is an attribute of every row, match or not
    [...new Set(hit.matches.map((m) => m.term))].join(", "),
    String(groups.title.length > 0),
    String(groups.subject.length > 0),
    String(groups.body.length > 0),
    String(groups.variants.length > 0),
    snip(groups.title),
    snip(groups.subject),
    snip(groups.body),
    snip(groups.variants, true),
  ];
}

// ── report assembly ──────────────────────────────────────────────────────────

// Markdown lists cap at this many programs per template (the CSV always
// carries all of them); the cap is stated inline, never silent.
const MD_PROGRAM_CAP = 15;

const programLabel = (p) =>
  `${p.name ?? p.id} (${p.status ?? "status unknown"}${p.active ? ", active" : ""})` +
  (p.surveys?.length ? ` — survey: ${p.surveys.join(", ")}` : "");

function hitSection(hit) {
  const t = hit.template;
  const lines = [`### ${t.title ?? "(untitled)"} (${t.id})`, ""];
  if (t.subject) lines.push(`- subject: ${resolvedText(t.subject, t)}`);
  if (hit.programs.length) {
    const shown = hit.programs.slice(0, MD_PROGRAM_CAP).map(programLabel).join("; ");
    const more = hit.programs.length - MD_PROGRAM_CAP;
    lines.push(`- used by ${hit.programs.length} program(s): ${shown}${more > 0 ? `; +${more} more (full list in the CSV)` : ""}`);
  } else lines.push(`- used by: no indexed program references this template`);
  lines.push(`- KB doc: ${kbDocDisplayPath(t.docPath)}`, "");
  lines.push(mdTable(["field", "term", "snippet"], hit.matches.map((m) => [m.field, m.term, resolvedText(m.snippet, t)])));
  return lines.join("\n");
}

// Caveats are computed from the index every run (ER-4's honesty requirement):
// unsearched referenced templates, metadata-only docs, stub programs, and
// KB-cached statuses all limit what "no hits" can mean.
function buildCaveats(index, { activeOnly }) {
  const caveats = [];
  // ER-15 standing note: search is template-centric — token labels here are
  // the template AUTHOR's labels, never the program's bindings.
  if (Object.values(index.templates ?? {}).some((t) => t && typeof t === "object" && t.tokens != null))
    caveats.push(
      `Token labels in this report are the template AUTHOR's labels (and survey names), not program bindings — ` +
        `the same token can render differently inside a program (program mode resolves the bound labels).`
    );
  const tokenCaveat = tokenMetadataCaveat(index);
  if (tokenCaveat) caveats.push(tokenCaveat);
  const missing = index.gaps?.referencedTemplatesMissing ?? [];
  if (missing.length) {
    const sample = missing.slice(0, 5).join(", ");
    caveats.push(
      `${missing.length} template id(s) referenced by programs have no KB doc and were NOT searched — ` +
        `fetch each with \`gs-admin --json jo email template --id '<id>'\` ` +
        `(first ${Math.min(5, missing.length)}: ${sample}; full list in the index under gaps.referencedTemplatesMissing).`
    );
  }
  const noBody = Object.values(index.templates ?? {}).filter((t) => !t.bodyIncluded).length;
  if (noBody) caveats.push(`${noBody} KB template doc(s) are metadata-only (no captured body) — searched on title/subject only.`);
  const stubs = index.gaps?.stubs ?? [];
  if (stubs.length)
    caveats.push(`${stubs.length} program doc(s) are stubs (steps unknown) — "used by" program lists may be incomplete.`);
  // fires on PARTIAL live sweeps too: filtering is per-program, so one stale
  // KB status can silently drop a template even when other programs are live
  const allPrograms = Object.values(index.programs ?? {});
  const kbStatusCount = allPrograms.filter((p) => p.statusSource !== "live").length;
  if (activeOnly && kbStatusCount > 0)
    caveats.push(
      `--active-only: ${kbStatusCount} of ${allPrograms.length} program statuses are KB-cached ` +
        `(${kbStatusCount === allPrograms.length ? "no" : "partial"} live sweep) — active/inactive filtering may rely on stale statuses; verify before acting.`
    );
  caveats.push(
    `KB scope: only the ${Object.keys(index.templates ?? {}).length} template(s) with KB docs were searched — ` +
      `tenant templates never captured by a crawl are invisible here except via program references.`
  );
  return caveats;
}

// ── CLI entry (dispatcher contract: export run(argv)) ────────────────────────

const USAGE =
  "usage: jo-report.mjs search --index <er-index.json> --query <term> [--query …] " +
  "[--all-terms] [--whole-word] [--snippet <n>] [--active-only] [--include-paused] --report <dir> [--csv-dir <dir>]";

export async function run(argv) {
  let flags;
  try {
    flags = parseFlags(argv, { boolean: [...C3_BOOLEAN, "all-terms", "whole-word"] });
  } catch (e) {
    fail(`${e.message}\n${USAGE}`);
  }
  const rawTerms = flags.query ?? [];
  if (!flags.index || !rawTerms.length || !flags.report) fail(USAGE);
  // an empty/blank term would "search" successfully while matching nothing
  // (or make --all-terms unsatisfiable) — a confidently wrong report, so
  // reject it loudly; duplicates are dropped with a warning, not an error
  if (rawTerms.some((t) => !String(t).trim())) fail("--query terms must be non-empty");
  const terms = [...new Set(rawTerms)];
  const warnings = [];
  if (terms.length < rawTerms.length)
    warnings.push(`${rawTerms.length - terms.length} duplicate --query term(s) dropped`);
  let snippetRadius = 50;
  if (flags.snippet !== undefined) {
    snippetRadius = Number(flags.snippet);
    if (!Number.isInteger(snippetRadius) || snippetRadius < 1) fail(`--snippet must be a positive integer (got '${flags.snippet}')`);
  }
  const opts = {
    wholeWord: flags["whole-word"] === true,
    allTerms: flags["all-terms"] === true,
    activeOnly: flags["active-only"] === true,
    includePaused: flags["include-paused"] === true,
    snippetRadius,
  };

  const index = loadIndex(flags.index);
  const { hits, templatesSearched } = searchTemplates(index, terms, opts);
  const caveats = buildCaveats(index, opts);

  const semantics = [
    terms.length > 1 ? (opts.allTerms ? "all terms (AND)" : "any term (OR)") : null,
    opts.wholeWord ? "whole-word" : "substring",
    "case-insensitive",
    opts.activeOnly ? `active programs only${opts.includePaused ? " (incl. PAUSE)" : ""}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  // ER-16: distinct programs vs template→program links are different numbers;
  // report both so neither can be misread as the other.
  const templateProgramLinks = hits.reduce((n, h) => n + h.programs.length, 0);
  const distinctProgramsReferenced = new Set(hits.flatMap((h) => h.programs.map((p) => p.id))).size;
  const summarySection = [
    "## Summary",
    "",
    `- terms: ${terms.map((t) => `\`${t}\``).join(", ")} — ${semantics}`,
    `- templates searched: ${templatesSearched} (of ${Object.keys(index.templates ?? {}).length} in the index)`,
    `- templates matched: ${hits.length}`,
    `- programs referenced: ${distinctProgramsReferenced} distinct program(s), via ${templateProgramLinks} template→program link(s)`,
  ].join("\n");
  const hitsSection = hits.length
    ? ["## Hits", ...hits.map(hitSection)].join("\n\n")
    : "## Hits\n\n_no templates matched — check the caveats below for what was not searchable_";

  const modeArgs = [
    ...terms.map((t) => `--query ${shq(t)}`),
    opts.allTerms ? "--all-terms" : null,
    opts.wholeWord ? "--whole-word" : null,
    snippetRadius !== 50 ? `--snippet ${snippetRadius}` : null,
    opts.activeOnly ? "--active-only" : null,
    opts.includePaused ? "--include-paused" : null,
  ].filter(Boolean);
  // The shared tail (rerun line, POSIX-quote caveat, report write, CSV dir)
  // lives in jo-report.mjs — F-362; --query terms with apostrophes are the
  // realistic caveat trigger here
  const { outPath, csvDir } = writeModeReport({ mode: "search", flags, modeArgs, sections: [summarySection, hitsSection], caveats, warnings, index });
  if (csvDir) {
    writeFileSync(
      join(csvDir, "search-hits.csv"),
      toCsv(SEARCH_HITS_HEADER, hits.map((h) => hitCsvRow(h, { multiTerm: terms.length > 1 }))),
      "utf8"
    );
    writeFileSync(
      join(csvDir, "search-template-programs.csv"),
      toCsv(
        ["template_id", "template_title", "program_id", "program_name", "status", "active", "survey_name"],
        hits.flatMap((h) =>
          h.programs.map((p) => [h.template.id, h.template.title, p.id, p.name, p.status, p.active, (p.surveys ?? []).join(", ")])
        )
      ),
      "utf8"
    );
  }

  // ER-14: subjects belong in the summary too, not just markdown/CSV. Capped
  // sample — the report and CSV always carry the full set.
  const HIT_SAMPLE_CAP = 50;
  emitSummary({
    mode: "search",
    reportPath: outPath,
    ...(csvDir ? { csvDir } : {}),
    counts: {
      terms: terms.length,
      templatesIndexed: Object.keys(index.templates ?? {}).length,
      templatesSearched,
      templatesMatched: hits.length,
      matches: hits.reduce((n, h) => n + h.matches.length, 0),
      // ER-16: renamed from programsReferenced — that key read as a count of
      // distinct programs when it counted template→program LINKS.
      templateProgramLinks,
      distinctProgramsReferenced,
    },
    hitTemplates: hits.slice(0, HIT_SAMPLE_CAP).map((h) => ({
      id: h.template.id,
      title: h.template.title ?? null,
      subject: resolvedText(h.template.subject, h.template) ?? null,
      termsMatched: [...new Set(h.matches.map((m) => m.term))],
    })),
    ...(hits.length > HIT_SAMPLE_CAP
      ? { hitTemplatesNote: `first ${HIT_SAMPLE_CAP} of ${hits.length} — full list in the report and CSV` }
      : {}),
    caveatCount: caveats.length,
    warnings,
  });
}
