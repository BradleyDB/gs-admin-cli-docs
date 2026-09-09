#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// jo-report-search.mjs (test) — fixture tests for scripts/jo-report-search.mjs
// (ER-4 of the email-report program).
//
// Covers: matching primitives (substring vs --whole-word incl. regex-special
// terms, snippet trimming), the S2-confirmed multi-term semantics (OR default
// naming the matched term; --all-terms = AND), hits in variant bodies, token
// text matching as ordinary body text, --active-only / --include-paused
// scoping via the shared isActive rule, the mandatory caveats (unsearched
// referenced templates + metadata-only docs + stub programs), report/CSV
// output through the C3 dispatcher, and usage errors. Fixture is a hand-built
// C1 v1 index (the frozen contract) under the OS temp dir; all data fictional.
//
// Run:  node plugins/gs-superadmin/test/jo-report-search.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { compileTerm, findMatch, makeSnippet, searchableFields, searchTemplates, hitCsvRow, SEARCH_HITS_HEADER } from "../scripts/jo-report-search.mjs";

const JO_REPORT = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "jo-report.mjs");
const ROOT = join(tmpdir(), `gs-superadmin-jo-report-search-${process.pid}`);
rmSync(ROOT, { recursive: true, force: true });
mkdirSync(ROOT, { recursive: true });

let failures = 0;
function check(label, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) {
    failures++;
    console.log(`      ${JSON.stringify(detail)?.slice(0, 400)}`);
  }
}

// ── fixture: a hand-built C1 v1 index ────────────────────────────────────────

const program = (id, name, status, over = {}) => ({
  id, name, status, statusSource: "kb", model: "DRIPV2", modelName: "Email Chain",
  startDate: null, depth: "full", docPath: `fixture-tenant/journey/${id}.md`, lastVerified: null,
  schedules: [], steps: [], sources: [], ...over,
});
const template = (id, title, subject, body, over = {}) => ({
  id, title, subject, folderId: null, active: true, body,
  variants: [], docPath: `fixture-tenant/journey-email-templates/${id}.md`, bodyIncluded: true, ...over,
});

// tpl-hello: "renewal(s)" but never a bare word "renew"; a ${token}; "c++"
// for the whole-word regex-escape case; a long tail so snippets truncate.
const helloBody =
  "Start of body. Your renewal notice for ${Account.Name} covers all renewals, using c++ daily. " +
  "PAD ".repeat(80);
const INDEX = {
  generatedAt: "2026-07-12T00:00:00.000Z", liveSweepAt: null,
  slug: "fixture-tenant", baseUrl: "https://fixture-tenant.example.com", environment: "sandbox",
  programs: {
    "prog-active": program("prog-active", "Active Program", "PROCESSING"),
    "prog-paused": program("prog-paused", "Paused Program", "PAUSE"),
    "prog-stopped": program("prog-stopped", "Stopped Program", "STOP"),
    "prog-stub": program("prog-stub", "Stub Program", null, { depth: "stub" }),
  },
  templates: {
    "tpl-hello": template("tpl-hello", "Welcome Hello", "Your renewal is due", helloBody, {
      variants: [{ name: "Variant B", subject: "V-B subject", body: "the zebra keyword lives in this variant body only." }],
    }),
    "tpl-paused": template("tpl-paused", "Paused Template", "subj", "uniqmarker in a paused-only template"),
    "tpl-stopped": template("tpl-stopped", "Stopped Template", "subj", "zebra appears here too"),
    "tpl-nobody": template("tpl-nobody", "Metadata Only renewal", null, "", { bodyIncluded: false }),
  },
  links: {
    templateToPrograms: { "tpl-hello": ["prog-active"], "tpl-paused": ["prog-paused"], "tpl-stopped": ["prog-stopped"] },
    programToTemplates: { "prog-active": ["tpl-hello"], "prog-paused": ["tpl-paused"], "prog-stopped": ["tpl-stopped"] },
  },
  gaps: { referencedTemplatesMissing: ["tpl-missing-1", "tpl-missing-2"], stubs: ["prog-stub"], liveOnly: [], kbOnly: [], statusDrift: [] },
  parseErrors: [],
};
const INDEX_PATH = join(ROOT, "er-index.json");
writeFileSync(INDEX_PATH, JSON.stringify(INDEX));

// ── matching primitives ──────────────────────────────────────────────────────

check("findMatch: case-insensitive substring", JSON.stringify(findMatch("Big Renewals", "renew")) === JSON.stringify({ start: 4, end: 9 }), findMatch("Big Renewals", "renew"));
check("findMatch: whole-word rejects mid-word", findMatch("all renewals here", "renew", { wholeWord: true }) === null, null);
check("findMatch: whole-word accepts exact word", findMatch("a renewal b", "renewal", { wholeWord: true })?.start === 2, findMatch("a renewal b", "renewal", { wholeWord: true }));
check("findMatch: whole-word with regex-special term (c++)", findMatch("using c++ here", "c++", { wholeWord: true })?.start === 6, null);
check("findMatch: whole-word non-word boundary chars ok", findMatch("renewal-x", "renewal", { wholeWord: true })?.start === 0, null);
check("findMatch: null/empty inputs", findMatch(null, "x") === null && findMatch("x", "") === null, null);
// Unicode case folding can change string length ("İ".toLowerCase() is two
// code units) — offsets must come from matching the ORIGINAL text, or the
// snippet window shifts
check("findMatch: offsets survive length-changing case folds", findMatch("İİ renewal", "RENEWAL")?.start === 3, findMatch("İİ renewal", "RENEWAL"));
check("compileTerm: one regex per term, case-insensitive", compileTerm("re+new").test("big RE+NEW here") && !compileTerm("re+new").test("renew"), null);

{
  const text = "A".repeat(200) + " renewal " + "B".repeat(200);
  const m = findMatch(text, "renewal");
  const wide = makeSnippet(text, m.start, m.end, 80);
  const tight = makeSnippet(text, m.start, m.end, 5);
  // ASCII "..." ellipses deliberately (F-124 — snippets land in CSV cells)
  check("makeSnippet: ellipses both sides, bounded by radius", wide.startsWith("...") && wide.endsWith("...") && wide.length <= 80 * 2 + "renewal".length + 8, { len: wide.length });
  check("makeSnippet: --snippet radius shrinks context", tight.length < wide.length && tight.includes("renewal"), tight);
  check("makeSnippet: whitespace runs collapsed", !/\s{2}/.test(makeSnippet("a\n\n  b renewal c\t\td", 7, 14, 80)), null);
}

// ── wave-2 portability: NFC folding + surrogate-safe snippets ────────────────
{
  // F-127: NFC term vs NFD text (macOS tooling emits NFD routinely) and the
  // converse must both match; codepoints via fromCharCode (the F-130 rule).
  const combining = String.fromCharCode(0x301);
  const eAcute = String.fromCharCode(0xe9);
  const nfdText = "Cafe" + combining + " renewal campaign";
  const nfcTerm = "Caf" + eAcute;
  check("findMatch: NFC term hits NFD text (F-127)", findMatch(nfdText, nfcTerm) !== null, findMatch(nfdText, nfcTerm));
  check("findMatch: NFD term hits NFC text (F-127)", findMatch("Caf" + eAcute + " renewal", "Cafe" + combining) !== null, null);
}
{
  // F-131: a radius boundary through an astral char drops the dangling half —
  // never a lone surrogate (which renders as U+FFFD in reports/CSVs).
  const emoji = String.fromCharCode(0xd83d, 0xde00);
  const astralText = emoji.repeat(30) + "TERM" + emoji.repeat(30);
  const mm = findMatch(astralText, "TERM");
  const snip = makeSnippet(astralText, mm.start, mm.end, 5);
  const hasLone = [...snip].some((c) => { const cp = c.codePointAt(0); return cp >= 0xd800 && cp <= 0xdfff; });
  check("makeSnippet: surrogate-safe edges (F-131)", !hasLone && snip.includes("TERM"), JSON.stringify(snip));
}

check("searchableFields: title/subject/body + variant subject/body", JSON.stringify(searchableFields(INDEX.templates["tpl-hello"]).map((f) => f.field)) === JSON.stringify(["title", "subject", "body", 'variant "Variant B" subject', 'variant "Variant B" body']), searchableFields(INDEX.templates["tpl-hello"]).map((f) => f.field));
check("searchableFields: metadata-only doc → no body field", !searchableFields(INDEX.templates["tpl-nobody"]).some((f) => f.field === "body"), null);

// ── searchTemplates semantics (S2 requirements) ──────────────────────────────

{
  const { hits } = searchTemplates(INDEX, ["zebra"]);
  const hello = hits.find((h) => h.template.id === "tpl-hello");
  check("search: hit in VARIANT body, field names the variant", hello?.matches.some((m) => m.field === 'variant "Variant B" body' && m.term === "zebra"), hello?.matches);
  check("search: OR across templates (stopped body also hits)", hits.some((h) => h.template.id === "tpl-stopped"), hits.map((h) => h.template.id));
  check("search: programs attached with status + active flag", hello?.programs.length === 1 && hello.programs[0].id === "prog-active" && hello.programs[0].status === "PROCESSING" && hello.programs[0].active === true, hello?.programs);
}

{
  const { hits } = searchTemplates(INDEX, ["zebra", "uniqmarker"]);
  const ids = hits.map((h) => h.template.id).sort();
  check("search: multi-term OR default — any term is a hit", ids.includes("tpl-hello") && ids.includes("tpl-paused") && ids.includes("tpl-stopped"), ids);
  const paused = hits.find((h) => h.template.id === "tpl-paused");
  check("search: each match row names its term", paused?.matches.every((m) => m.term === "uniqmarker"), paused?.matches);
}

{
  const { hits } = searchTemplates(INDEX, ["zebra", "renewal"], { allTerms: true });
  const ids = hits.map((h) => h.template.id);
  check("search: --all-terms (AND) keeps only templates matching every term", JSON.stringify(ids) === JSON.stringify(["tpl-hello"]), ids);
}

{
  const sub = searchTemplates(INDEX, ["renew"]).hits.map((h) => h.template.id).sort();
  check("search: substring default — 'renew' hits renewal/renewals/title", sub.includes("tpl-hello") && sub.includes("tpl-nobody"), sub);
  const ww = searchTemplates(INDEX, ["renew"], { wholeWord: true }).hits;
  check("search: --whole-word — bare 'renew' appears nowhere as a word", ww.length === 0, ww.map((h) => h.template.id));
  const token = searchTemplates(INDEX, ["account.name"]).hits;
  check("search: token text (${Account.Name}) matches as ordinary body text", token.some((h) => h.template.id === "tpl-hello" && h.matches.some((m) => m.field === "body")), token.map((h) => h.template.id));
}

{
  const zebraActive = searchTemplates(INDEX, ["zebra"], { activeOnly: true }).hits.map((h) => h.template.id);
  check("search: --active-only drops STOP-only templates, keeps PROCESSING", JSON.stringify(zebraActive) === JSON.stringify(["tpl-hello"]), zebraActive);
  const pausedDropped = searchTemplates(INDEX, ["uniqmarker"], { activeOnly: true }).hits;
  const pausedKept = searchTemplates(INDEX, ["uniqmarker"], { activeOnly: true, includePaused: true }).hits;
  check("search: PAUSE-only template excluded unless --include-paused", pausedDropped.length === 0 && pausedKept.length === 1, { dropped: pausedDropped.length, kept: pausedKept.length });
  const orphanDropped = searchTemplates(INDEX, ["metadata only"], { activeOnly: true }).hits;
  check("search: --active-only drops templates used by no program", orphanDropped.length === 0, orphanDropped.map((h) => h.template.id));
}

{
  // an index is JSON.parse'd, so id-keyed lookups must be own-property
  // checks: a template id shadowing an Object.prototype member must not
  // resolve links/programs through the prototype chain (a Function has no
  // .map → the whole run would crash)
  const protoIdx = {
    ...INDEX,
    templates: { constructor: template("constructor", "Proto Template", "subj", "zebra in a weird-id template") },
    links: { templateToPrograms: {}, programToTemplates: {} },
  };
  let hits = null;
  let threw = null;
  try { hits = searchTemplates(protoIdx, ["zebra"]).hits; } catch (e) { threw = e.message; }
  check("search: template id 'constructor' never hits the prototype chain", threw === null && hits?.length === 1 && hits[0].programs.length === 0, { threw, hits: hits?.map((h) => h.template.id) });
  const dup = searchTemplates(INDEX, ["zebra", "zebra"], { allTerms: true }).hits;
  check("search: duplicate terms cannot make --all-terms unsatisfiable (unit)", dup.length === 2, dup.map((h) => h.template.id));
}

// ── CLI end-to-end through the dispatcher ────────────────────────────────────

const runCli = (...args) => {
  const res = spawnSync(process.execPath, [JO_REPORT, ...args], { encoding: "utf8" });
  let summary = null;
  try { summary = JSON.parse(res.stdout); } catch { /* asserted by callers */ }
  return { res, summary };
};

{
  const rDir = join(ROOT, "r1");
  const cDir = join(ROOT, "c1");
  const { res, summary } = runCli("search", "--index", INDEX_PATH, "--query", "zebra", "--report", rDir, "--csv-dir", cDir);
  check("cli: exit 0 + C2 summary keys", res.status === 0 && summary?.ok === true && summary?.mode === "search" && typeof summary?.reportPath === "string" && "counts" in summary && "caveatCount" in summary && Array.isArray(summary?.warnings), { status: res.status, stderr: res.stderr, stdout: res.stdout?.slice(0, 300) });
  check("cli: counts (2 templates matched)", summary?.counts?.templatesMatched === 2 && summary?.counts?.terms === 1 && summary?.counts?.templatesIndexed === 4, summary?.counts);
  const md = readFileSync(summary.reportPath, "utf8");
  check("cli: report header + hit sections", md.includes("# JO report — search") && md.includes("### Welcome Hello (tpl-hello)") && md.includes("Active Program (PROCESSING, active)"), md.slice(0, 600));
  check("cli: caveat — unsearched referenced templates with fetch hint", md.includes("2 template id(s) referenced by programs have no KB doc and were NOT searched") && md.includes("jo email template --id"), md);
  check("cli: caveat — metadata-only docs + stub programs + KB scope", md.includes("metadata-only") && md.includes("stubs (steps unknown)") && md.includes("KB scope:") && summary.caveatCount >= 4, { caveatCount: summary?.caveatCount });
  const hitsCsv = readFileSync(join(cDir, "search-hits.csv"), "utf8");
  const progCsv = readFileSync(join(cDir, "search-template-programs.csv"), "utf8");
  // ER-13: ONE row per matched template (2 rows for 2 templates), per-field
  // booleans + per-field snippet columns
  const hitLines = hitsCsv.trim().split("\r\n");
  check(
    "cli: hits CSV is one row per template with per-field boolean/snippet columns (ER-13)",
    hitsCsv.startsWith("\uFEFF" + SEARCH_HITS_HEADER.join(",") + "\r\n") && hitLines.length === 3 &&
      hitsCsv.includes("tpl-hello") && hitsCsv.includes("tpl-stopped"),
    hitsCsv.slice(0, 400)
  );
  // ER-14: 'zebra' hits tpl-hello only in a VARIANT body — its subject never
  // matched, yet the row must still carry the subject as a plain attribute
  const helloLine = hitLines.find((l) => l.startsWith("tpl-hello"));
  check(
    "cli: subject present on every row regardless of match; variant hit sets variants_matched, not body (ER-14)",
    helloLine?.includes("Your renewal is due") && helloLine?.includes("false,false,false,true") &&
      helloLine?.includes('variant ""Variant B"" body:'),
    helloLine
  );
  // ER-14: subjects in the summary JSON too
  check(
    "cli: summary hitTemplates sample carries id/title/subject/terms (ER-14)",
    summary?.hitTemplates?.length === 2 &&
      summary.hitTemplates.some((h) => h.id === "tpl-hello" && h.subject === "Your renewal is due" && h.termsMatched.includes("zebra")),
    summary?.hitTemplates
  );
  check("cli: programs CSV carries status + active", progCsv.includes("prog-active") && progCsv.includes("PROCESSING") && progCsv.includes("true"), progCsv);
  // ER-16: 2 hits but each with its own single program — links and distinct
  // count agree here; the N-links-1-program case is tested separately below
  check(
    "cli: counts carry templateProgramLinks + distinctProgramsReferenced, never a bare programsReferenced (ER-16)",
    summary?.counts?.templateProgramLinks === 2 && summary?.counts?.distinctProgramsReferenced === 2 &&
      !("programsReferenced" in (summary?.counts ?? {})),
    summary?.counts
  );
}

{
  // snippet width flag: same query, tighter radius → shorter snippet cell
  const wide = runCli("search", "--index", INDEX_PATH, "--query", "PAD PAD", "--report", join(ROOT, "r2"));
  const tight = runCli("search", "--index", INDEX_PATH, "--query", "PAD PAD", "--snippet", "5", "--report", join(ROOT, "r3"));
  const line = (s) => readFileSync(s.summary.reportPath, "utf8").split("\n").find((l) => l.includes("| body | PAD PAD |"));
  check("cli: --snippet shrinks the snippet", line(wide)?.length > line(tight)?.length && line(tight)?.includes("..."), { wide: line(wide)?.length, tight: line(tight)?.length });
  const bad = runCli("search", "--index", INDEX_PATH, "--query", "x", "--snippet", "nope", "--report", join(ROOT, "r4"));
  check("cli: non-integer --snippet exits 1", bad.res.status === 1 && /--snippet/.test(bad.res.stderr), bad.res.stderr);
}

{
  const allTerms = runCli("search", "--index", INDEX_PATH, "--query", "zebra", "--query", "renewal", "--all-terms", "--report", join(ROOT, "r5"));
  check("cli: --all-terms filters to templates matching every term", allTerms.summary?.counts?.templatesMatched === 1, allTerms.summary?.counts);
  const ww = runCli("search", "--index", INDEX_PATH, "--query", "renew", "--whole-word", "--report", join(ROOT, "r6"));
  const md = readFileSync(ww.summary.reportPath, "utf8");
  check("cli: --whole-word zero-hit report still renders with caveats", ww.summary?.counts?.templatesMatched === 0 && md.includes("_no templates matched") && md.includes("## Caveats & data gaps"), ww.summary?.counts);
  check("cli: semantics named in the report header args", md.includes("--whole-word"), md.slice(0, 500));
}

{
  const noQuery = runCli("search", "--index", INDEX_PATH, "--report", join(ROOT, "r7"));
  check("cli: missing --query exits 1 with usage", noQuery.res.status === 1 && /usage/.test(noQuery.res.stderr), noQuery.res.stderr);
  const noIndex = runCli("search", "--query", "x", "--report", join(ROOT, "r8"));
  check("cli: missing --index exits 1 with usage", noIndex.res.status === 1 && /usage/.test(noIndex.res.stderr), noIndex.res.stderr);
  const empty = runCli("search", "--index", INDEX_PATH, "--query", "", "--report", join(ROOT, "r9"));
  check("cli: empty --query term exits 1 (never a confident zero-hit report)", empty.res.status === 1 && /non-empty/.test(empty.res.stderr), { status: empty.res.status, stderr: empty.res.stderr });
  const blank = runCli("search", "--index", INDEX_PATH, "--query", "   ", "--report", join(ROOT, "r10"));
  check("cli: whitespace-only --query term exits 1", blank.res.status === 1 && /non-empty/.test(blank.res.stderr), blank.res.stderr);
}

{
  // duplicate terms: deduped with a warning, and --all-terms stays satisfiable
  const dup = runCli("search", "--index", INDEX_PATH, "--query", "zebra", "--query", "zebra", "--all-terms", "--report", join(ROOT, "r11"));
  check("cli: duplicate --query deduped (counts.terms 1, warning, hits intact)", dup.summary?.counts?.terms === 1 && dup.summary?.counts?.templatesMatched === 2 && dup.summary?.warnings?.some((w) => /duplicate/.test(w)), { counts: dup.summary?.counts, warnings: dup.summary?.warnings });
}

{
  // --active-only honesty: caveat names KB-cached statuses, and a PARTIAL
  // live sweep (some programs live, some not) must not suppress it
  const allKb = runCli("search", "--index", INDEX_PATH, "--query", "zebra", "--active-only", "--report", join(ROOT, "r12"));
  const mdAllKb = readFileSync(allKb.summary.reportPath, "utf8");
  check("cli: --active-only + all-KB statuses → 'no live sweep' caveat", mdAllKb.includes("4 of 4 program statuses are KB-cached") && mdAllKb.includes("no live sweep"), null);
  const partial = structuredClone(INDEX);
  partial.programs["prog-active"].statusSource = "live";
  const partialPath = join(ROOT, "er-index-partial.json");
  writeFileSync(partialPath, JSON.stringify(partial));
  const partialRun = runCli("search", "--index", partialPath, "--query", "zebra", "--active-only", "--report", join(ROOT, "r13"));
  const mdPartial = readFileSync(partialRun.summary.reportPath, "utf8");
  check("cli: --active-only + PARTIAL live sweep still caveats stale statuses", mdPartial.includes("3 of 4 program statuses are KB-cached") && mdPartial.includes("partial live sweep"), mdPartial.split("\n").filter((l) => l.includes("KB-cached")));
}

{
  // F-429 second pass (consumer-parity): an index built on a workspace whose
  // journey domain was recorded under another name carries the build's
  // warnings; a report mode built from it — search here, the fold is
  // writeModeReport's and every mode shares it — carries them in its markdown
  // Caveats section AND its <mode>-caveats.csv, prefixed "index build:". The
  // hand-built INDEX above has no `warnings` (an older index) and adds nothing.
  const MOVED = "KB folders resolved from the manifest's recordings, differing from the defaults: journey → jo-programs-x (default journey)";
  const INDEX2_PATH = join(ROOT, "er-index-renamed.json");
  writeFileSync(INDEX2_PATH, JSON.stringify({ ...INDEX, domains: { dirs: { journey: "jo-programs-x", templates: "journey-email-templates" }, basis: { journey: "manifest recording", templates: "default (no recording)" } }, warnings: [MOVED] }));
  const rDir = join(ROOT, "r-renamed");
  const cDir = join(ROOT, "c-renamed");
  const { res, summary } = runCli("search", "--index", INDEX2_PATH, "--query", "zebra", "--report", rDir, "--csv-dir", cDir);
  const md = res.status === 0 ? readFileSync(summary.reportPath, "utf8") : "";
  const csv = res.status === 0 ? readFileSync(join(cDir, "search-caveats.csv"), "utf8") : "";
  check(
    "cli F-429 parity: the index build's folder-resolution warning reaches the report's Caveats section AND search-caveats.csv, counted in caveatCount",
    res.status === 0 && md.includes(`- index build: ${MOVED}`) && csv.includes(`index build: ${MOVED}`) && summary.caveatCount >= 1,
    { status: res.status, stderr: res.stderr, mdHas: md.includes(MOVED), csvHas: csv.includes(MOVED) }
  );
  const plain = runCli("search", "--index", INDEX_PATH, "--query", "zebra", "--report", join(ROOT, "r-plain"), "--csv-dir", join(ROOT, "c-plain"));
  check(
    "cli F-429 parity: an index without a warnings field (older build) adds no index-build caveat",
    plain.res.status === 0 && !readFileSync(plain.summary.reportPath, "utf8").includes("index build:"),
    plain.res.stderr
  );
}

{
  // ER-13 unit: multi-term, multi-field hit collapses to ONE row; snippets
  // name their term; terms_matched comma-joins
  const { hits } = searchTemplates(INDEX, ["zebra", "renewal"]);
  const hello = hits.find((h) => h.template.id === "tpl-hello");
  const row = hitCsvRow(hello, { multiTerm: true });
  const col = (name) => row[SEARCH_HITS_HEADER.indexOf(name)];
  check(
    "hitCsvRow: one row — booleans true for subject+body+variants, false for title (multi-term)",
    col("title_matched") === "false" && col("subject_matched") === "true" && col("body_matched") === "true" && col("variants_matched") === "true",
    row
  );
  check(
    "hitCsvRow: terms_matched joins the matched terms; per-field snippets carry [term] prefixes",
    col("terms_matched") === "zebra, renewal" || col("terms_matched") === "renewal, zebra",
    col("terms_matched")
  );
  check(
    "hitCsvRow: snippet columns are per-field; variant snippets name their location",
    col("subject_snippet").includes("[renewal]") && col("body_snippet").includes("[renewal]") &&
      col("variant_snippets").includes('variant "Variant B" body:') && col("variant_snippets").includes("[zebra]"),
    { subject: col("subject_snippet"), variants: col("variant_snippets") }
  );
  check("hitCsvRow: single-term rows omit the [term] prefix", !hitCsvRow(searchTemplates(INDEX, ["zebra"]).hits.find((h) => h.template.id === "tpl-hello")).join(",").includes("[zebra]"), null);
  // ER-14 unit: a body-only hit still carries the subject attribute
  const { hits: bodyOnly } = searchTemplates(INDEX, ["uniqmarker"]);
  const pausedRow = hitCsvRow(bodyOnly.find((h) => h.template.id === "tpl-paused"));
  check(
    "hitCsvRow: body-only match carries the subject attribute with subject_matched false (ER-14)",
    pausedRow[SEARCH_HITS_HEADER.indexOf("subject")] === "subj" && pausedRow[SEARCH_HITS_HEADER.indexOf("subject_matched")] === "false",
    pausedRow
  );
}

{
  // ER-16: N templates → ONE distinct program. The links count and the
  // distinct count must diverge, and the markdown must state both.
  const shared = program("prog-one", "Shared Program", "PROCESSING");
  const INDEX2 = {
    ...INDEX,
    programs: { "prog-one": shared },
    templates: {
      "tpl-a": template("tpl-a", "Gadget A", "subj A", "the gadget word"),
      "tpl-b": template("tpl-b", "Gadget B", "subj B", "the gadget word again"),
    },
    links: {
      templateToPrograms: { "tpl-a": ["prog-one"], "tpl-b": ["prog-one"] },
      programToTemplates: { "prog-one": ["tpl-a", "tpl-b"] },
    },
    gaps: { referencedTemplatesMissing: [], stubs: [], liveOnly: [], kbOnly: [], statusDrift: [] },
  };
  const INDEX2_PATH = join(ROOT, "er-index-links.json");
  writeFileSync(INDEX2_PATH, JSON.stringify(INDEX2));
  const { summary } = runCli("search", "--index", INDEX2_PATH, "--query", "gadget", "--report", join(ROOT, "r14"));
  const md = readFileSync(summary.reportPath, "utf8");
  check(
    "cli: 2 template→program links to ONE program report distinct=1, links=2 (ER-16)",
    summary?.counts?.templateProgramLinks === 2 && summary?.counts?.distinctProgramsReferenced === 1,
    summary?.counts
  );
  check(
    "cli: markdown summary states both numbers so links can't read as programs (ER-16)",
    md.includes("1 distinct program(s), via 2 template→program link(s)"),
    md.split("\n").filter((l) => l.includes("programs referenced"))
  );
}

{
  // ER-15 (search side): subjects/snippets resolve via the template's AUTHOR
  // labels; the standing author-label caveat + predates-metadata caveat fire.
  // ER-17 (search side): program-context rows name the bound survey.
  const surveyStep = {
    order: 1, stepId: "s1", stepName: "Send", stepType: "ACTION", actionType: "OUTBOUND_CALL",
    outboundAction: "SEND_EMAIL", emailTemplateId: "tpl-pp", emailTemplateName: "PP",
    variantTemplateIds: [], tokens: [], boundAssets: [{ type: "SURVEY", id: "SVY-5", name: "NPS Survey" }], timer: null,
  };
  const INDEX3 = {
    ...INDEX,
    programs: { "prog-svy": program("prog-svy", "Survey Program", "PROCESSING", { steps: [surveyStep] }) },
    templates: {
      "tpl-pp": template("tpl-pp", "Pulse Notice", "Your ${subj::gs-pp} data is live", "pulseword body ${subj::gs-pp} tail", {
        tokens: [{ tokenKey: "subj::gs-pp", displayName: "Product Name", defaultValue: "Your Product", tokenType: "STANDARD", variant: "Default", survey: null }],
      }),
      "tpl-old": template("tpl-old", "Old Doc pulseword", "old subj", "no tokens recorded"),
    },
    links: {
      templateToPrograms: { "tpl-pp": ["prog-svy"] },
      programToTemplates: { "prog-svy": ["tpl-pp"] },
    },
    gaps: { referencedTemplatesMissing: [], stubs: [], liveOnly: [], kbOnly: [], statusDrift: [] },
  };
  const INDEX3_PATH = join(ROOT, "er-index-tokens.json");
  writeFileSync(INDEX3_PATH, JSON.stringify(INDEX3));
  const cDir = join(ROOT, "c15");
  const { summary } = runCli("search", "--index", INDEX3_PATH, "--query", "pulseword", "--report", join(ROOT, "r15"), "--csv-dir", cDir);
  const md = readFileSync(summary.reportPath, "utf8");
  check(
    "cli tokens: markdown subject renders {Product Name} (author label), raw id gone",
    md.includes("Your {Product Name} data is live") && !md.includes("${subj::gs-pp}"),
    md.split("\n").filter((l) => l.includes("subject"))
  );
  check(
    "cli tokens: snippet resolves the token inline",
    md.includes("pulseword body {Product Name} tail"),
    md.split("\n").filter((l) => l.includes("pulseword"))
  );
  check(
    "cli tokens: standing author-label caveat + predates-metadata caveat (tpl-old)",
    md.includes("AUTHOR's labels") && /1 template doc\(s\) predate token metadata/.test(md),
    md.split("\n").filter((l) => l.startsWith("- ")).slice(-6)
  );
  check(
    "cli survey: program-context row names the bound survey (ER-17), no URLs",
    md.includes("Survey Program (PROCESSING, active) — survey: NPS Survey") && !md.includes("SurveyResponse"),
    md.split("\n").filter((l) => l.includes("used by"))
  );
  const hitsCsv = readFileSync(join(cDir, "search-hits.csv"), "utf8");
  const progCsv = readFileSync(join(cDir, "search-template-programs.csv"), "utf8");
  check("cli tokens: CSV subject + snippets resolved too", hitsCsv.includes("Your {Product Name} data is live") && hitsCsv.includes("pulseword body {Product Name} tail") && !hitsCsv.includes("${subj::gs-pp}"), hitsCsv.slice(0, 400));
  check("cli survey: programs CSV gains survey_name", progCsv.startsWith("\uFEFF" + "template_id,template_title,program_id,program_name,status,active,survey_name\r\n") && progCsv.includes("NPS Survey"), progCsv);
  check("cli tokens: summary hitTemplates subject resolved", summary?.hitTemplates?.some((h) => h.id === "tpl-pp" && h.subject === "Your {Product Name} data is live"), summary?.hitTemplates);
}

{
  // F-123: an apostrophe-bearing term makes the rerun line carry the bash
  // escape AND pushes the one PowerShell-conversion caveat; a cleanly-quoted
  // run must not carry it.
  const apo = runCli("search", "--index", INDEX_PATH, "--query", "O'Brien Renewal", "--report", join(ROOT, "rq1"));
  const mdApo = readFileSync(apo.summary.reportPath, "utf8");
  check("caveat: apostrophe term pins the bash escape + caveat (F-123)", mdApo.includes("'O'\\''Brien Renewal'") && mdApo.includes("bash apostrophe escape"), mdApo.split("\n").filter((l) => l.includes("O'Brien") || l.includes("apostrophe")).join(" | "));
  const cleanRun = runCli("search", "--index", INDEX_PATH, "--query", "renewal", "--report", join(ROOT, "rq2"));
  const mdClean = readFileSync(cleanRun.summary.reportPath, "utf8");
  check("caveat: absent for cleanly-quoted runs (F-123)", !mdClean.includes("bash apostrophe escape"), null);

  // F-142: a backslash-bearing value in the rerun line comes out
  // single-quoted (bash eats unquoted backslashes silently) and — carrying
  // no apostrophe — draws no PowerShell caveat. Cross-platform by using a
  // backslash-bearing TERM; on Windows the resolve()'d --index path in the
  // same line exercises the identical rule.
  const bsRun = runCli("search", "--index", INDEX_PATH, "--query", "Acme\\Renewal", "--report", join(ROOT, "rq3"));
  const mdBs = readFileSync(bsRun.summary.reportPath, "utf8");
  check("rerun: backslash-bearing term is single-quoted in the rerun line (F-142)", mdBs.includes("'Acme\\Renewal'"), mdBs.split("\n").filter((l) => l.includes("Renewal") && l.includes("--query")).join(" | "));
  check("rerun: quoted backslash draws no PowerShell caveat (F-142)", !mdBs.includes("bash apostrophe escape"), null);
}

// ── F-362 output-identity lock (A-6) ──────────────────────────────────────────
// The rendered report and every CSV of one search run (the r1 shape),
// byte-for-byte against fixtures CAPTURED ON THE PRE-HOIST TREE (B17,
// 2026-09-03) and committed under test/fixtures/jo-report/search/. The
// mode's shared tail — rerun line, POSIX-quote caveat, renderReport, report
// write, CSV-dir prep — was hoisted into jo-report.mjs's writeModeReport
// under this lock, which must pass unchanged. Normalized before compare: the
// `generated:` timestamp, and on the Re-run line ONLY this run's absolute
// paths (temp root, dispatcher script) with their OS quoting and separators.
// CSVs are committed LF-only and BOM-less; the compare re-adds the BOM and
// CRLF the writer emits, so both are asserted exactly, not normalized away.
// Refresh (after a REVIEWED behaviour change only — review the git diff):
//   JO_REPORT_EXPECTED_REFRESH=1 node plugins/gs-superadmin/test/jo-report-search.mjs
//   PowerShell: $env:JO_REPORT_EXPECTED_REFRESH = '1'; node plugins/gs-superadmin/test/jo-report-search.mjs
// (the inline VAR=value prefix is bash-only — F-255).
{
  const EXPECTED = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "jo-report", "search");
  const lf = (s) => s.replace(/\r\n/g, "\n");
  const scrub = (text, abs, tag) => text.split(`'${abs}`).join(tag).split(abs).join(tag);
  const normalizeMd = (md) =>
    md
      .replace(/^- generated: .*$/m, "- generated: <generated>")
      .replace(/^Re-run: `(.*)`$/m, (_, cmd) => {
        let c = scrub(cmd, JO_REPORT, "<jo-report>");
        c = scrub(c, ROOT, "<root>");
        // a scrubbed token's closing quote and this OS's separators
        c = c.replace(/<(jo-report|root)>([^\s']*)'?/g, (_m, tag, rest) => `<${tag}>${rest.replace(/\\/g, "/")}`);
        return "Re-run: `" + c + "`";
      });
  const firstDiff = (x, y) => {
    const xl = x.split("\n"), yl = y.split("\n");
    const i = xl.findIndex((l, k) => l !== yl[k]);
    return i === -1 ? null : { line: i + 1, got: xl[i], want: yl[i] };
  };
  const runLock = () => {
    const rDir = join(ROOT, "lock-r"); // both runs share the dirs: run 2 takes the -2 report suffix, overwrites the CSVs
    const cDir = join(ROOT, "lock-c");
    const { res, summary } = runCli("search", "--index", INDEX_PATH, "--query", "zebra", "--report", rDir, "--csv-dir", cDir);
    const md = summary?.reportPath ? readFileSync(summary.reportPath, "utf8") : "";
    const csvs = Object.fromEntries(readdirSync(cDir).sort().map((f) => [f, readFileSync(join(cDir, f), "utf8")]));
    return { res, summary, md, norm: normalizeMd(md), csvs };
  };
  const a = runLock();
  const b = runLock();
  if (process.env.JO_REPORT_EXPECTED_REFRESH) {
    mkdirSync(EXPECTED, { recursive: true });
    writeFileSync(join(EXPECTED, "expected-report.md"), a.norm);
    for (const [f, text] of Object.entries(a.csvs)) writeFileSync(join(EXPECTED, `expected-${f}`), lf(text).replace(/^\uFEFF/, ""));
    console.log("      (expected fixtures refreshed from this run)");
  }
  check("lock: exit 0 and the report file is named search-<date>.md", a.res.status === 0 && /^search-\d{4}-\d{2}-\d{2}(-\d+)?\.md$/.test(basename(String(a.summary?.reportPath))), { status: a.res.status, reportPath: a.summary?.reportPath, stderr: a.res.stderr });
  check("lock: LF-only report; no run-specific path survives normalization", !a.md.includes("\r") && !a.norm.includes(ROOT) && !a.norm.includes(JO_REPORT), a.norm.split("\n").filter((l) => l.startsWith("Re-run")));
  check("lock: determinism — a second run normalizes to the same bytes (report + CSVs)", a.norm === b.norm && JSON.stringify(a.csvs) === JSON.stringify(b.csvs), firstDiff(a.norm, b.norm));
  const want = lf(readFileSync(join(EXPECTED, "expected-report.md"), "utf8"));
  check("lock: report byte-identical to the committed expected (EOL-normalized)", a.norm === want, firstDiff(a.norm, want));
  const expectedCsvs = readdirSync(EXPECTED).filter((f) => f.endsWith(".csv")).map((f) => f.replace(/^expected-/, "")).sort();
  check("lock: the CSV set is exactly the committed set", JSON.stringify(Object.keys(a.csvs)) === JSON.stringify(expectedCsvs), { got: Object.keys(a.csvs), want: expectedCsvs });
  for (const f of expectedCsvs) {
    const wantCsv = "\uFEFF" + lf(readFileSync(join(EXPECTED, `expected-${f}`), "utf8")).replace(/\n/g, "\r\n");
    check(`lock: ${f} byte-identical to the committed expected (BOM + CRLF re-added)`, a.csvs[f] === wantCsv, firstDiff(String(a.csvs[f]), wantCsv));
  }
}

rmSync(ROOT, { recursive: true, force: true });
console.log(failures ? `\n${failures} failure(s)` : "\nAll jo-report-search checks passed");
process.exit(failures ? 1 : 0);
