#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// jo-report-deps.mjs — `deps` mode of the JO email-report (ER-7).
//
// Object/field usage report over every in-scope program's participant
// sources: mapping usage classifies as **projected/show field**, query-filter
// usage classifies as **filter** (with the comparison operator) — the
// distinction the Gainsight UI never shows. Scoped to JO participant sources
// by design (ER-11 is the tenant-wide superset). Loaded by jo-report.mjs's
// dispatcher (contract C3) — never invoked directly by the skill.
//
//   jo-report.mjs deps --index <er-index.json> [--object <o>]... [--field <f>]...
//     [--kb <slugDir>] [--scan-tokens] [--live-deps <deps-check.json>]...
//     [--all | --active-only] [--include-paused]
//     --report <dir> [--csv-dir <dir>]
//
// Semantics (requirements confirmed S3, 2026-07-12):
// - ≥1 of --object/--field required. Matching is case-insensitive EXACT
//   against system name OR label: object terms against condition objectName;
//   field terms against condition fieldName/fieldLabel, standard-mapping keys
//   and column values, and customMappings string values. No substring.
// - --alias-prefix '<regex>' (ER-21/ER-23, ruled P-2 2026-07-16) turns on
//   alias-aware FIELD matching: a candidate field name whose leading
//   task-alias prefix matches the regex (the tenant's conventions doc
//   declares it — e.g. tasks lettered `X_`) is ALSO compared with the prefix
//   stripped, and space/underscore are treated as equivalent separators.
//   Still exact-ci, NEVER substring; the prefix stays in every output row
//   (it names the originating task) and the match column says how the hit
//   happened. Near-miss candidates (name contains the term's words but never
//   matched) are listed in a "possible related fields (not counted)" caveat.
//   The convention is read by the SCRIPT itself (GP-B5 DS-27:
//   readAliasConvention below, from the workspace's
//   .gs-superadmin/CONVENTIONS.md, walking up from the KB dir — or, for one
//   tenant that differs, its own <slug>/CONVENTIONS.md override, F-450 a);
//   --alias-prefix is the explicit override. Unset → exact-only (the S3
//   behavior above) plus a no-convention caveat; malformed → exact-only plus
//   a loud caveat naming why — a pattern is never inferred from tenant data
//   (A-4). The shared primitives
//   below are the ONE implementation — tenant-deps.mjs (ER-22) imports them.
// - Default scope is active-only (PROCESSING; PAUSE via --include-paused);
//   --all widens to every program (status shown on every row either way).
//   --active-only is the explicit spelling of the default; combining it with
//   --all is an error.
// - --scan-tokens (rewired ER-19, ruled P-2 2026-07-16): tokens are resolved
//   through each program's OWN bindings (C1 v2 step tokens[], both program
//   generations) BEFORE matching — a --field term matches the binding's label
//   OR its field API name OR the objectName-qualified spelling (exact-ci,
//   composing with --alias-prefix and separator equivalence). Each row says
//   WHICH handle hit and always carries the raw token id + its location in
//   the captured template text as evidence. Calc-bound tokens match on label
//   only and are flagged "calc field — source not resolvable"; SurveyToken
//   and literal-value tokens are never match candidates. The pre-ER-19
//   literal text compare (inner text / dot-segment vs the term) is kept as a
//   secondary path for tenants whose tokens are field-name-style.
//   Off by default — free-text search is search mode's job.
// - Programs matching a --object at object level but NONE of the --field
//   terms are presented in a separate "Object-level matches" section. A
//   program matching both keeps its object-matched condition rows in the
//   main usage table (matched on the object term) — never hidden.
// - C1 mappings carry NO object names (only conditions do) — an honesty
//   caveat states that show-field usage cannot be attributed to objects.
// - Participant-source provenance (ER-20, ruled P-2 2026-07-16): every report
//   resolves — at REPORT time, never at index time — what each matched
//   program's participant source actually pulls, to the RESOLVABLE CEILING:
//     DATA_DESIGNER → the KB doc(s) whose FILENAME is the collectionId, in
//       journey-data-designer/ (field dictionary) and data-management/
//       (label + description); matched mapping columns are tied to the DD's
//       field dictionary. A missing doc is a caveat naming the fetch, never
//       an empty column.
//     CSV → the collectionId IS the uploaded filename — displayed as-is.
//     QUERY_BUILDER → a Power List: the source's `ruleId` names a hidden rule
//       (ruleType ADVANCED_OUTREACH_QUERY_BUILDER — `re r list` never returns
//       it, `re r describe --id` does) whose raw `data.taskDetails[]` carry
//       the objects, connection and output fields the list reads. Resolved
//       to the rule's KB doc in the rules lane (refresh/setup register and
//       document them from the program docs — F-487); the list's FILTERS are
//       not returned by the CLI (criteriaDetails null, every derived view
//       empty, --task-id a no-op — measured 2026-10-06, upstream KI-027), so
//       a match means the list READS the object, never how it filters it.
//       The pre-F-487 text ("no CLI surface", "collectionId == ruleId") was
//       false on both counts.
//     QUERY → a dynamic program's participant query: no CLI command returns
//       it (config.filters is empty, the collection id describes as neither a
//       rule nor a template) — only the program's dynamic fields and branch
//       conditions name objects, and the report says so.
//   Beyond the sources, two program-level surfaces name objects and fields
//   on EVERY source type and are scanned as usage rows (F-487):
//   aoConfiguration.dynamicFields[] (DYNAMIC_QUERY_V2: object + field + its
//   own filter conditions; SURVEY_QUERY: a survey question) and the flow
//   canvas's branch conditions (nodes[].outPorts[].conditions[]: a participant
//   custom field, or a dynamic field joined by id).
//   The KB path comes from --kb <slugDir> when given; otherwise it is derived
//   from the index (docPaths are recorded slug-relative, so index.slug
//   resolved against the CWD is the KB dir when it exists — the same
//   assumption kbDocDisplayPath already makes). The external-connection hop
//   is OUT OF REACH and the report says so: DD designs have no CLI describe,
//   dataset columns carry no lookup provenance, and the feeding system is
//   NEVER inferred from payload text (payloads mention connector names in
//   unrelated UI metadata — a known red herring). The index stays a faithful
//   projection (C1 v2 raw pointers only); resolution logic lives here.
// - --live-deps (added S5-V, finding F2 remedy): captured
//   `gs-admin --json dm deps check --name '<object>' --areas
//   JOURNEY_ORCHESTRATOR` payloads (one file per object; the check is ASYNC —
//   re-run the capture until progressStatus.overallStatus is COMPLETED). The
//   report renders each object's live JO dependents with their referenced
//   columns and reconciles them against the KB scan — mapping/SELECT-side
//   usage the KB scan structurally cannot see (the dominant kind in practice)
//   becomes visible rows instead of a warning. Follows --live-list's
//   capture-file precedent: this script never invokes the CLI itself.
//
// Summary JSON lists the distinct objects touched so the agent can
// corroborate live via
//   gs-admin --json dm deps check --name '<object>' --areas JOURNEY_ORCHESTRATOR
// (pass the captured payloads back in via --live-deps).
//
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  parseFlags,
  C3_REPEATABLE,
  C3_BOOLEAN,
  loadIndex,
  isActive,
  writeModeReport,
  mdTable,
  toCsv,
  emitSummary,
  fail,
  canonicalTokenKey,
  tokenKeyVariants,
  kbDocDisplayPath,
} from "./jo-report.mjs";
// Doc primitives shared with every KB reader (tenant-deps precedent) — the
// provenance resolver parses DD/object docs straight from the KB. docBaseName
// is the doc WRITERS' first-choice id→filename rule, but writers claim names
// through docNameClaimer, which appends -dup when case-colliding ids fight
// over one filename (F-125/F-156) — so the computed name CAN disagree with
// how a doc was stored, and the resolver verifies each doc's `- key:` bullet
// (topBullets) before trusting it (F-198).
import { normalizeText, parseDocJson, docH1, NO_NAME, docBaseName, topBullets, RECORDED_LANES } from "./doc-lib.mjs";
// Portability primitives (doc-lib): NFC fold on every compare (F-127), the
// one term compare/dedup key (F-197), BOM strip for captured payloads
// (F-118), the one sq/caveat copy (F-123), pinned comparators (F-128).
import { normTerm, termKey, sq, shq, cmpName, cmpKey, escapeRe, findWorkspaceDir, requireKbDir, parseLiveDepsAreas } from "./doc-lib.mjs";

// A JSON.parse'd index inherits Object.prototype — id-keyed lookups must be
// own-property checks (same rationale as the other modes).
const own = (obj, key) => (obj != null && Object.hasOwn(obj, key) ? obj[key] : undefined);

// ── matching primitives (exported for tests) ─────────────────────────────────

// Case-insensitive EXACT equality of a value against one pre-lowered term
// (confirmed S3: no substring matching). toLowerCase on both sides — terms
// are lowered once by the caller. Both sides NFC-fold first (F-127): an NFD
// value (macOS tooling emits them routinely) must equal its NFC spelling;
// normTerm is idempotent, so folding an already-folded term is safe.
export const eqTerm = (value, loweredTerm) =>
  value != null && normTerm(String(value)).trim().toLowerCase() === normTerm(String(loweredTerm));

// ── alias-aware field matching (ER-21/ER-22/ER-23 — the ONE shared
//    implementation; tenant-deps.mjs imports these, never re-implements) ─────

// '--alias-prefix' regex source → compiled RegExp (anchored to the start so
// "leading prefix" can never become an interior match), or null when absent.
// The pattern is TENANT DATA (read from the workspace conventions doc by
// readAliasConvention below, GP-B5 DS-27 — the skills used to hand-parse it;
// --alias-prefix stays as the explicit override) — nothing tenant-specific
// lives in this file.
export function compileAliasPrefix(source) {
  if (source == null || String(source).trim() === "") return null;
  const src = String(source);
  try {
    return new RegExp(src.startsWith("^") ? src : `^(?:${src})`);
  } catch (e) {
    throw new Error(`--alias-prefix '${src}' is not a valid regular expression (${e.message})`);
  }
}

// ── tenant conventions read (GP-B5 DS-27) ────────────────────────────────────
// The field-aliasing convention lives in the workspace's
// `.gs-superadmin/CONVENTIONS.md` — the default for every tenant of the
// workspace — or, for one tenant that differs, in a `<slug>/CONVENTIONS.md`
// override beside its KB (F-450 a, ruled 2026-09-15: one company, one set of
// conventions is the norm; the per-tenant file is the exception). Every
// result carries `home` ("tenant" | "workspace") naming which was read, and
// `path`. It is a `## Field aliasing` section whose
// `- task-alias-prefix-regex:` bullet carries the pattern as ONE inline-code
// value (the shipped templates/CONVENTIONS.md shape). Both deps surfaces read
// it through here. The guardrail that used to be skill prose is behavioral
// now (A-4): a missing or malformed declaration WITHHOLDS aliasing — matching
// runs exact-only with a caveat; a pattern is NEVER inferred from tenant data.
// Returns one of:
//   { status: "declared", pattern, prefix, path } — pattern is the regex
//     SOURCE and prefix its compiled form (compiled once, here — the
//     validate-then-recompile split invited drift)
//   { status: "unset", why[, path] }       — nothing declared (no workspace,
//     file, section, or bullet, or an empty value): not an error, but the
//     why is SURFACED by resolveAliasPrefix below — "could not look" must
//     never read as "looked, found nothing" (F-218 class, review round)
//   { status: "malformed", why, path }     — a bullet-shaped declaration
//     exists but cannot be read as one column-0 `- ` bullet with one
//     inline-code compilable value: callers run exact-only AND surface the
//     why, loudly
export function readAliasConvention(startDir) {
  if (startDir == null) return { status: "unset", why: "no KB directory to locate the workspace from" };
  // Workspace = nearest ancestor carrying .gs-superadmin/ — the one shared
  // F-232 walk-up (doc-lib findWorkspaceDir; review round — this was about
  // to be the walk's third hand copy).
  const wsDir = findWorkspaceDir(startDir);
  if (!wsDir) return { status: "unset", why: "no .gs-superadmin workspace at or above the KB directory" };
  // Home (F-450 a): the tenant directory is the KB path's first segment
  // under the workspace (`<ws>/<slug>/…`); its CONVENTIONS.md, when it
  // EXISTS, is the home whatever it contains — an unset or malformed
  // declaration is reported against it, never silently completed from the
  // workspace file (two files must never read as one declaration). Only a
  // MISSING tenant file falls through to the workspace default. A start
  // directory AT the workspace root has no tenant and reads the default.
  const tenantDir = tenantDirOf(startDir, wsDir);
  const tenantPath = tenantDir ? join(tenantDir, "CONVENTIONS.md") : null;
  const home = tenantPath && existsSync(tenantPath) ? "tenant" : "workspace";
  const path = home === "tenant" ? tenantPath : join(wsDir, ".gs-superadmin", "CONVENTIONS.md");
  return { ...readAliasConventionFile(path), home };
}
// The ancestor of startDir whose parent is the workspace dir — the tenant
// (slug) directory — or null when startDir IS the workspace dir, lies outside
// it, or sits under the workspace's own `.gs-superadmin/` control directory
// (review round: that directory is a first-level child too, and its
// CONVENTIONS.md IS the workspace default — reporting it as a tenant override
// would be the F-307 false-provenance class inverted).
function tenantDirOf(startDir, wsDir) {
  const ws = resolve(String(wsDir));
  let dir = resolve(String(startDir));
  if (dir === ws) return null;
  const control = join(ws, ".gs-superadmin");
  for (;;) {
    const up = dirname(dir);
    if (up === ws) return dir === control ? null : dir;
    if (up === dir) return null;
    dir = up;
  }
}
// One CONVENTIONS.md file, parsed — the grammar below is unchanged by the
// home rule; every result carries the path it was read from.
function readAliasConventionFile(path) {
  let text;
  try {
    text = normalizeText(readFileSync(path, "utf8"));
  } catch {
    return { status: "unset", why: "no readable CONVENTIONS.md in the tenant directory or the workspace", path };
  }
  // Section: from the `## Field aliasing` heading (title matched
  // case-insensitively) to the next level-1/level-2 heading. The TITLE is the anchor,
  // not the whole line (F-305): real workspaces carry trailing text on this
  // heading — earlier rounds of these skills wrote `## Field aliasing
  // (machine-readable — …)` themselves — and a present section reported as
  // absent silently drops real dependents. Mirroring the bullet grammar's
  // near-grammar arm, a heading-LIKE line naming the title at the wrong
  // level or spacing is loudly MALFORMED, never silently unset; so is an
  // ambiguous pair of title-matching headings.
  const lines = text.split("\n");
  // Fenced blocks are OPAQUE to this read (self-review of the F-319 round):
  // a pasted example inside the section can carry `# comment` lines and
  // bullet-shaped text — those must neither end the section, anchor one, nor
  // read as the declaration. The mask is the CommonMark fence grammar, not a
  // spelling toggle (F-323 — a column-0-backtick-only mask let a tilde or
  // 3-space-indented fence's example bullet read as the tenant's live
  // declaration, false provenance through a narrower door than F-319): a
  // fence OPENS on up-to-3-space indent + 3+ backticks or 3+ tildes with an
  // optional info string (a backtick opener's info string may not contain a
  // backtick — that line is inline code, not a fence), and CLOSES only on
  // the same character, at least the opener's length, up-to-3-space indent,
  // nothing but whitespace after. An unclosed fence masks to end-of-file
  // (the section falls to "no bullet" → unset). Both fence lines are masked.
  // 4+-space-indented fence spellings are indented code to CommonMark, not
  // fences — they stay prose here, where the column-0 bullet/heading anchors
  // can't read them anyway.
  // PINNING LEDGER (F-326/F-327 — recorded per the F-321 precedent so no
  // claim outruns a measurement): every conditional below is pinned by a
  // named suite check EXCEPT these mutant classes, deliberately unpinned:
  //   · opener-line mask disabled — INERT: a fence-delimiter line satisfies
  //     none of the bullet/heading anchors, so unmasking it changes nothing.
  //   · closer minimum length (either branch) — EQUIVALENT MUTANT: the
  //     length rule (close >= open, and openers are always 3+) already
  //     rejects a shortened closer.
  //   · closer indent TIGHTENED (allowance removed) — SAFE-DIRECTION: it can
  //     only prevent closes, which masks more and fails toward unset.
  // Anything else that survives a mutation sweep is a finding, not a
  // recorded decision.
  const fenced = [];
  {
    let open = null; // { ch, len } of the opening fence while inside one
    for (const l of lines) {
      if (open) {
        fenced.push(true);
        const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(l);
        if (close && close[1][0] === open.ch && close[1].length >= open.len) open = null;
      } else {
        const m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(l);
        if (m && !(m[1][0] === "`" && m[2].includes("`"))) {
          open = { ch: m[1][0], len: m[1].length };
          fenced.push(true);
        } else fenced.push(false);
      }
    }
  }
  const titleMatches = lines.reduce((acc, l, i) => (!fenced[i] && /^##\s+field aliasing\b/i.test(l) ? [...acc, i] : acc), []);
  let start;
  // F-309: when the bare-title tiebreak below passes over other
  // title-matching headings, every WITHHELD outcome's why discloses them —
  // the tiebreak is on heading SHAPE, never content, so an empty bare
  // section can win over a suffixed one whose bullet is filled in, and a
  // why that only describes the winning section misleads about the file.
  let skippedWhy = "";
  if (titleMatches.length === 1) start = titleMatches[0];
  else if (titleMatches.length > 1) {
    // Prefer the one bare-title heading if exactly one exists (`## Field
    // aliasing` next to `## Field aliasing history` is not ambiguous).
    const bare = titleMatches.filter((i) => /^##\s+field aliasing\s*$/i.test(lines[i]));
    if (bare.length === 1) {
      start = bare[0];
      const skipped = titleMatches.filter((i) => i !== start);
      skippedWhy =
        `; NOTE the bare \`## Field aliasing\` heading governs when several match the title — ` +
        `${skipped.length} other title-matching heading${skipped.length > 1 ? "s" : ""} ` +
        `(line ${skipped.map((i) => i + 1).join(", ")}) ${skipped.length > 1 ? "were" : "was"} not read`;
    } else
      return {
        status: "malformed",
        why: `${titleMatches.length} \`## Field aliasing\` headings — ambiguous, none read`,
        path,
      };
  } else {
    const nearHeading = lines.find((l, i) => !fenced[i] && /^#{1,6}\s*field aliasing/i.test(l));
    if (nearHeading)
      return {
        status: "malformed",
        why: "a Field aliasing heading exists but not as a `## Field aliasing` level-2 heading — respell it in the template's form",
        path,
      };
    return { status: "unset", why: "no `## Field aliasing` section", path };
  }
  // Every withheld outcome from the CHOSEN section carries the tiebreak
  // disclosure (F-309) — declared outcomes name their pattern and path, so
  // the disclosure rides only the whys.
  const withheld = (res) => (skippedWhy ? { ...res, why: res.why + skippedWhy } : res);
  // Section extent is markdown sectioning parsed as grammar (F-319): a `##`
  // section ends at the next heading of level 1 or 2 — a later `# Appendix`
  // must never leak its bullets into this section (the gate-2 review
  // reproduced a deprecated appendix pattern silently driving matching, and
  // an empty bare section displacing a real suffixed declaration via the
  // F-309 tiebreak). `###`+ subsections stay IN-section by the same grammar,
  // documented at the template's one-section rule.
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++)
    if (!fenced[i] && /^#{1,2}\s/.test(lines[i])) { end = i; break; }
  // Bullet grammar: `- task-alias-prefix-regex:` at line start. The template's
  // italic example line (`_Example value …_`) is not a bullet and never parses.
  const values = [];
  for (let i = start + 1; i < end; i++) {
    if (fenced[i]) continue;
    const m = /^-\s*task-alias-prefix-regex:(.*)$/.exec(lines[i]);
    if (m) values.push(m[1].trim());
  }
  if (!values.length) {
    // A bullet-LIKE line (any marker, any indent) that failed the strict
    // grammar is a PRESENT-but-broken declaration — loud, never silently
    // unset (review round: a `* ` marker or a nested bullet read as "no
    // convention declared"). Blockquoted mentions (`> …`) stay prose.
    const nearGrammar = lines.slice(start + 1, end).find((l, k) => !fenced[start + 1 + k] && /^\s*[-*+]\s*task-alias-prefix-regex:/.test(l));
    if (nearGrammar)
      return withheld({
        status: "malformed",
        why: "a task-alias-prefix-regex line exists but not as a `- task-alias-prefix-regex:` bullet at line start — respell it in the template's form",
        path,
      });
    return withheld({ status: "unset", why: "no `- task-alias-prefix-regex:` bullet in the section", path });
  }
  if (values.length > 1)
    return withheld({ status: "malformed", why: `${values.length} task-alias-prefix-regex bullets — ambiguous, none used`, path });
  if (values[0] === "") return withheld({ status: "unset", why: "task-alias-prefix-regex value is empty (org does not alias)", path });
  const code = /^`([^`]+)`$/.exec(values[0]);
  if (!code)
    return withheld({ status: "malformed", why: "the value is not a single inline-code span (write it as `regex`)", path });
  let prefix;
  try {
    prefix = compileAliasPrefix(code[1]);
  } catch (e) {
    // compileAliasPrefix's message names the --alias-prefix FLAG — wrong
    // frame for a value read from a file (review round): point at the
    // declared pattern instead, keeping the engine detail.
    return withheld({ status: "malformed", why: e.message.replace(/^--alias-prefix\s+/, "the declared pattern "), path });
  }
  // "declared" IMPLIES compiled (F-318): the inline-code grammar accepts any
  // 1+ characters, but compileAliasPrefix returns null for a whitespace-only
  // value — a declared/prefix-null pair lets the active render and the
  // exact-only matching contradict each other (the F-307/F-308
  // false-provenance class, reproduced in the gate-2 review). A blank code
  // span is a present-but-broken declaration, never an active one.
  if (!prefix)
    return withheld({
      status: "malformed",
      why: "the declared pattern is blank (whitespace-only inline code) — declare a real pattern, or spell \"org does not alias\" as an empty value with no code span",
      path,
    });
  return { status: "declared", pattern: code[1], prefix, path };
}

// The alias pattern IN FORCE for one run — the single resolution rule both
// deps surfaces share. Returns { source, origin, prefix, note, unsetWhy }:
// source is the regex source in force (headers/summaries), origin names
// WHICH precedence arm supplied it — "flag" (explicit --alias-prefix) or
// "convention" (the declared read), null when nothing is in force — so
// renderers state provenance from the resolution instead of hardcoding it
// (F-308: the active Summary line credited the conventions for a pattern
// they never supplied). prefix is the compiled RegExp or null, note a
// warning string when the convention is MALFORMED (surfaced in warnings AND
// caveats), unsetWhy the specific exact-only reason when no pattern is in
// force — threaded into the exact-only caveat so "could not look" (no
// workspace, unreadable file) is never reported as "looked and found
// nothing declared" (A-4/F-218, review round).
export function resolveAliasPrefix({ explicit, hasFieldTerms, kbDir }) {
  // An EXPLICIT --alias-prefix always wins, INCLUDING the blank spelling:
  // `--alias-prefix ''` is the exact-only opt-out (compileAliasPrefix('')
  // → null — the pre-DS-27 semantics; review round: the first version let a
  // blank explicit fall through to the conventions read, leaving no flag
  // value that could disable a declared convention). An invalid explicit
  // value THROWS — the caller fails loudly as before.
  if (explicit != null) {
    const prefix = compileAliasPrefix(explicit);
    return prefix
      ? { source: String(explicit), origin: "flag", prefix, note: null, unsetWhy: null }
      : { source: null, origin: null, prefix: null, note: null, unsetWhy: "aliasing disabled by an empty --alias-prefix override" };
  }
  if (!hasFieldTerms) return { source: null, origin: null, prefix: null, note: null, unsetWhy: null };
  const conv = readAliasConvention(kbDir);
  if (conv.status === "declared")
    return { source: conv.pattern, origin: "convention", prefix: conv.prefix, note: null, unsetWhy: null, home: conv.home, path: conv.path };
  if (conv.status === "malformed")
    return {
      source: null,
      origin: null,
      prefix: null,
      unsetWhy: null,
      note:
        `field-aliasing convention in ${conv.path} is MALFORMED (${conv.why}) — field matching ran EXACT-ONLY; ` +
        `fix the declaration or pass --alias-prefix explicitly (a pattern is never guessed from tenant data)`,
    };
  return { source: null, origin: null, prefix: null, note: null, unsetWhy: conv.why, home: conv.home ?? null, path: conv.path ?? null };
}

// Space↔underscore separator equivalence (ruled P-2: `X_Company GSID` and
// `X_Company_GSID` both occur in real task-built field names). Character
// mapping only — runs are NOT collapsed, so this stays exact-shaped.
const sepEquiv = (lowered) => lowered.replace(/_/g, " ");

// One --field term, prepared once per run: lowered + separator-normalized
// forms for matching, and per-word regexes for the near-miss check (words of
// ≥4 chars — all words when none qualify — matched on word boundaries so
// "term" can't hit "determine").
export function prepFieldTerm(term) {
  const lowered = normTerm(String(term)).trim().toLowerCase(); // NFC fold (F-127)
  const loweredSep = sepEquiv(lowered);
  const words = loweredSep.split(/ +/).filter(Boolean);
  const significant = words.filter((w) => w.length >= 4);
  const nearRes = (significant.length ? significant : words).map(
    (w) => new RegExp(`(?<![a-z0-9])${escapeRe(w)}(?![a-z0-9])`)
  );
  return { term, lowered, loweredSep, nearRes };
}

// One candidate value vs one prepared term → null | { how }. Without an
// alias prefix this IS eqTerm (today's behavior, byte-for-byte). With one:
//   "exact"                — plain exact-ci equality (unchanged rule)
//   "separator-equivalent" — equal once _ and space are interchangeable
//   "task-alias"           — equal after stripping the leading conventions-
//                            declared prefix from the CANDIDATE (terms are
//                            never stripped; the prefix is optional signal —
//                            unprefixed candidates compare as always)
// NEVER substring, in any mode.
export function fieldTermMatch(value, prepped, aliasPrefix = null) {
  if (value == null) return null;
  const orig = normTerm(String(value)).trim(); // NFC fold (F-127) — prepFieldTerm folded the term side
  const lowered = orig.toLowerCase();
  if (lowered === prepped.lowered) return { how: "exact" };
  if (!aliasPrefix) return null;
  if (sepEquiv(lowered) === prepped.loweredSep) return { how: "separator-equivalent" };
  const m = aliasPrefix.exec(orig);
  if (m && m[0].length > 0 && m[0].length < orig.length) {
    const stripped = orig.slice(m[0].length).toLowerCase();
    if (stripped === prepped.lowered || sepEquiv(stripped) === prepped.loweredSep) return { how: "task-alias" };
  }
  return null;
}

// Near-miss (the "third case" neither exact nor alias-stripping catches, e.g.
// a differently-named field on the same source object): a NON-matching
// candidate whose name contains every significant word of the term. These are
// LISTED for human judgment, never counted as matches — the visible middle
// ground between a silent miss and the substring trap.
export function isNearMiss(value, prepped) {
  if (value == null || !prepped.nearRes.length) return false;
  const v = sepEquiv(normTerm(String(value)).trim().toLowerCase()); // NFC fold (F-127)
  return prepped.nearRes.every((re) => re.test(v));
}

// Render "how the hit happened" for match columns/CSVs: exact hits stay the
// bare term; alias-mode hits name the mechanism and the full candidate (the
// prefix is signal — it names the originating task, so it is always shown).
export const matchHowLabel = (how, candidate) =>
  !how || how === "exact" ? "exact" : `${how} \`${candidate}\``;

// Accumulate near-misses for one row's candidate values into a term→Set map
// (the ONE collection rule for both deps surfaces — gate on the FIELD terms
// not matching, never on object/connection matches, so a row that matched an
// --object term still surfaces its field near-misses).
export function addNearMisses(map, candidates, fieldTerms) {
  for (const prepped of fieldTerms)
    for (const v of candidates)
      if (v != null && isNearMiss(v, prepped)) {
        if (!map.has(prepped.term)) map.set(prepped.term, new Set());
        map.get(prepped.term).add(String(v).trim());
      }
}

// The header line naming the field-matching semantics in force. Alias rules
// are only claimed when they can actually run (field terms present) — a
// --alias-prefix with no --field terms already warns, and the header must
// not contradict that warning.
// Takes the resolveAliasPrefix RESULT, not just the source string, so the
// no-alias reason has ONE owner (F-307: this line asserted "no field-aliasing
// convention supplied" for states — a declaration read and found MALFORMED,
// a valid declaration disabled by --alias-prefix '' — where that is false).
// It quotes the resolution's own unsetWhy and defers malformed detail to the
// Caveats, which carry the full note verbatim. The ACTIVE arm renders the
// pattern's provenance from the resolution's origin, never hardcoded (F-308:
// an explicit --alias-prefix was credited to "the tenant conventions" even
// when no conventions section exists — the same false-provenance class F-307
// closed for the inactive states, on both deps surfaces).
export function aliasMatchingLine(aliasRes, hasFieldTerms) {
  const { source, origin, note, unsetWhy, home } = aliasRes ?? {};
  // The convention's HOME rides its provenance (F-450 a): the workspace
  // default is shared by every tenant, the tenant file is not.
  const conventionHome = home === "tenant" ? "the tenant's own CONVENTIONS.md override" : "the workspace CONVENTIONS.md, shared by every tenant";
  if (source && hasFieldTerms)
    return (
      `case-insensitive exact match on system name or label, with task-alias prefix stripping ` +
      `(\`${source}\`, from ${origin === "flag" ? "the explicit `--alias-prefix` flag" : `the tenant conventions — ${conventionHome}`}) ` +
      `and space↔underscore separator equivalence — never substring`
    );
  const base = "case-insensitive exact match on system name or label";
  if (!hasFieldTerms) return base;
  if (note) return `${base} (declared field-aliasing convention MALFORMED — aliasing withheld; see Caveats)`;
  // The unset arm names the home it read when one was read (F-450 a, review
  // round): an existing tenant file that declares nothing SHADOWS a workspace
  // declaration, and a line that only says "not in force" sent the operator to
  // edit the wrong file.
  const readFrom = home ? `, read from ${conventionHome}` : "";
  return `${base} (field aliasing not in force: ${unsetWhy ?? "no field-aliasing convention supplied"}${readFrom})`;
}

// The ER-21/ER-23 honesty caveats, worded ONCE for both deps surfaces:
// without an aliasing convention the exact-only matcher is blind to
// task-alias-prefixed fields (never silently); with one, near-misses are
// shown to the human but never counted. nearMisses: [{term, names[]}].
export function aliasFieldCaveats({ hasFieldTerms, aliasActive, nearMisses = [], conventionNote = null, unsetWhy = null, unsetHome = null, unsetPath = null }) {
  const caveats = [];
  // A MALFORMED convention already states "ran EXACT-ONLY" with its why —
  // the generic exact-only caveat would restate it in different words
  // (review round: the same fact three ways reads as a bug).
  if (conventionNote) caveats.push(conventionNote);
  else if (hasFieldTerms && !aliasActive)
    caveats.push(
      `Field matching ran EXACT-ONLY — no tenant field-aliasing convention is in force ` +
        `(${unsetWhy ?? "none declared"}), so fields ` +
        `carrying a task-alias prefix (a tenant build standard can prefix every task-built field, e.g. \`X_<field>\`) ` +
        `did NOT match their unprefixed names and real dependents may be missing from this report. If the tenant ` +
        (unsetHome === "tenant"
          ? `aliases fields, declare the pattern in the \`## Field aliasing\` section of the tenant's own ${unsetPath ?? "<slug>/CONVENTIONS.md"} — ` +
            `that file exists and OVERRIDES the workspace CONVENTIONS.md for this tenant (a workspace declaration is not read while it exists; ` +
            `delete the tenant file to fall back) — this `
          : `aliases fields, declare the pattern in the workspace CONVENTIONS.md \`## Field aliasing\` section (or in a \`<slug>/CONVENTIONS.md\` ` +
            `override when only this tenant aliases — the report reads that file first) — this `) +
        `report reads it itself — or re-run with \`--alias-prefix '<regex>'\`.`
    );
  for (const nm of nearMisses) {
    const shown = nm.names.slice(0, 12);
    caveats.push(
      `Possible related fields (NOT counted) for \`${nm.term}\`: ${shown.map((n) => `\`${n}\``).join(", ")}` +
        `${nm.names.length > shown.length ? ` (+${nm.names.length - shown.length} more)` : ""} — ` +
        `field names containing the term's words that matched neither exactly nor via task-alias; ` +
        `listed for human judgment, never counted as usage.`
    );
  }
  return caveats;
}

// All string values of one customMappings entry (shallow — the entry shape
// beyond {id} is undocumented; every string is a match candidate).
const customStrings = (entry) =>
  Object.values(entry && typeof entry === "object" ? entry : {}).filter((v) => typeof v === "string");

// ── usage extraction (exported for tests) ────────────────────────────────────

// The pointer a QUERY_BUILDER source resolves by: its rule id, and only as a
// fallback the collection id (equal on most sources, NOT all — F-487).
export const powerListRuleId = (src) =>
  src?.ruleId != null ? String(src.ruleId) : src?.participantSourceCollectionId != null ? String(src.participantSourceCollectionId) : null;

// One in-scope program → its candidate usage rows (before term matching).
// Condition rows carry the object name; mapping rows never do (C1 fact).
// Every source-derived row keeps a reference to its source entry (sourceRef)
// so the ER-20 provenance pass can resolve the matched rows' sources without
// re-deriving which source a row came from (labels are not unique).
// `powerLists` (F-487) is a resolver `(ruleId) => PowerList | null` over the
// rules lane's KB docs (makePowerListResolver): a QUERY_BUILDER source whose
// rule doc is on disk contributes the objects, connection and output fields
// its tasks read; an unresolved one contributes nothing here and is named in
// the provenance caveats, never silently. Program-level rows (dynamic
// fields, branch conditions) carry no sourceRef — they are not a source.
export function usageCandidates(program, { powerLists = null, objects = null } = {}) {
  const rows = [];
  for (const src of Array.isArray(program.sources) ? program.sources : []) {
    if (!src || typeof src !== "object") continue;
    const srcLabel = src.name ?? src.configId ?? "(unnamed source)";
    if (classifySource(src) === "power-list" && typeof powerLists === "function") {
      const pl = powerLists(powerListRuleId(src));
      if (pl && !pl.problem) for (const r of powerListRows(pl)) rows.push({ ...r, source: srcLabel, sourceRef: src });
    }
    for (const c of Array.isArray(src.conditions) ? src.conditions : [])
      rows.push({
        kind: "condition",
        usage: "filter",
        source: srcLabel,
        sourceRef: src,
        objectName: c.objectName ?? null,
        fieldName: c.fieldName ?? null,
        fieldLabel: c.fieldLabel ?? null,
        detail: `operator ${c.comparisonOperator ?? "unknown"}${c.filterAlias ? `, alias ${c.filterAlias}` : ""}`,
      });
    const std = src.mappings?.standard;
    if (std && typeof std === "object" && !Array.isArray(std))
      for (const [key, value] of Object.entries(std))
        rows.push({
          kind: "mapping",
          usage: "projected/show field",
          source: srcLabel,
          sourceRef: src,
          objectName: null,
          fieldName: key,
          fieldLabel: typeof value === "string" ? value : value == null ? null : JSON.stringify(value),
          detail: `standard mapping ${key} ← ${typeof value === "string" ? value : JSON.stringify(value)}`,
        });
    for (const entry of Array.isArray(src.mappings?.custom) ? src.mappings.custom : [])
      rows.push({
        kind: "custom",
        usage: "projected/show field (custom)",
        source: srcLabel,
        sourceRef: src,
        objectName: null,
        fieldName: entry?.fieldName ?? entry?.name ?? entry?.id ?? null,
        fieldLabel: null,
        strings: customStrings(entry),
        detail: `custom mapping${entry?.id ? ` ${entry.id}` : ""}`,
      });
  }
  // Program-level surfaces (F-487) — read on every source type.
  const dynamics = Array.isArray(program.dynamicFields) ? program.dynamicFields.filter((d) => d && typeof d === "object") : [];
  const dynById = new Map(dynamics.filter((d) => d.fieldId != null).map((d) => [String(d.fieldId), d]));
  for (const d of dynamics) {
    const label = d.label ?? d.fieldLabel ?? d.fieldId ?? "(unlabeled)";
    rows.push({
      kind: "dynamic-field",
      usage: "dynamic field",
      source: "(program) dynamic field",
      sourceRef: null,
      objectName: d.objectName ?? null,
      objectLabel: d.objectLabel ?? null,
      fieldName: d.fieldName ?? null,
      fieldLabel: d.fieldLabel ?? d.label ?? null,
      detail: d.survey
        ? `dynamic field "${label}" (${d.criterionType ?? "SURVEY_QUERY"}) — survey ${d.survey.surveyId ?? "?"}, question ${d.survey.questionId ?? "?"}`
        : `dynamic field "${label}" (${d.criterionType ?? "unknown type"})`,
    });
    for (const c of Array.isArray(d.conditions) ? d.conditions : [])
      rows.push({
        kind: "condition",
        usage: "dynamic-field filter",
        source: "(program) dynamic field",
        sourceRef: null,
        objectName: c.objectName ?? null,
        fieldName: c.fieldName ?? null,
        fieldLabel: c.fieldLabel ?? null,
        detail: `dynamic field "${label}": operator ${c.comparisonOperator ?? "unknown"}${c.filterAlias ? `, alias ${c.filterAlias}` : ""}`,
      });
  }
  for (const step of Array.isArray(program.steps) ? program.steps : [])
    for (const b of Array.isArray(step?.branchConditions) ? step.branchConditions : []) {
      if (!b || typeof b !== "object") continue;
      // a dynamic-field operand names its object/field through the program's
      // dynamicFields; a participant custom field names them directly
      const dyn = b.fieldId != null ? dynById.get(String(b.fieldId)) ?? null : null;
      rows.push({
        kind: "branch-condition",
        usage: "branch condition",
        source: `(program) step "${step.stepName ?? step.stepId ?? "?"}"`,
        sourceRef: null,
        objectName: dyn ? dyn.objectName ?? null : b.objectName ?? null,
        objectLabel: dyn ? dyn.objectLabel ?? null : null,
        fieldName: dyn ? dyn.fieldName ?? null : b.fieldName ?? null,
        fieldLabel: b.label ?? (dyn ? dyn.label ?? null : null),
        detail:
          `port "${b.port ?? "?"}"${b.alias ? `, alias ${b.alias}` : ""}, operator ${b.operator ?? "unknown"}` +
          (b.leftType === "DYNAMIC_QUERY_V2" ? (dyn ? ` (dynamic field ${b.fieldId})` : ` (dynamic field ${b.fieldId ?? "?"} — not declared on the program)`) : ""),
      });
    }
  // ONE canonicalization point over EVERY row kind that names an object
  // (F-487 second reopen, Redesign, invariant A): a Power List task or output
  // field, a dynamic field, a branch condition, a filter condition — each
  // row's object reference goes through the one registry, so a system name,
  // a label or a GSID term reaches the same programs whatever the row kind.
  if (typeof objects === "function")
    for (const r of rows) {
      if (r.objectName == null) continue;
      const o = canonicalObject(r.objectName, objects, r.objectLabel);
      r.objectName = o.objectName;
      r.objectLabel = o.objectLabel;
      r.objectAliases = o.objectAliases;
    }
  return rows;
}

// ── F-487: Power List (QUERY_BUILDER) rule docs ──────────────────────────────

export const POWER_LIST_RULE_TYPE = "ADVANCED_OUTREACH_QUERY_BUILDER";
// Connection ids that name the Gainsight platform itself, not an external
// system — kept as the row's connection TYPE so a --connection term still
// matches them (tenant-deps' INTERNAL_CONNECTIONS warns on them).
const INTERNAL_CONNECTION_IDS = new Set(["GAINSIGHT_API", "MDA"]);

// Is this `re r describe` payload a Power List's rule? The rules lane holds
// both kinds side by side once refresh/setup document Power Lists (one
// describe command, one folder): the type is the one discriminator.
export function isPowerListPayload(payload) {
  const data = payload?.data && typeof payload.data === "object" ? payload.data : payload;
  const rd = data?.ruleDetails && typeof data.ruleDetails === "object" ? data.ruleDetails : null;
  return rd != null && (rd.ruleType === POWER_LIST_RULE_TYPE || rd.sourceType === POWER_LIST_RULE_TYPE);
}

// `re r describe` payload of a Power List rule → what the list reads.
// Shape (measured 2026-10-06, CLI 1.0.10, seven rules on a production
// tenant; F-487): data.taskDetails[] — NOT under ruleDetails, where the
// Rules Engine reader looks — each {taskId, datasetName, schemaObject,
// connectionId, outputFields[], childrenTaskIds[]}. schemaObject is an SFDC
// API name, a Gainsight object GSID, or a PRIOR task's id (merge/filter
// tasks read upstream datasets, not objects). connectionId is a connector
// GUID (resolved to a name through the connectors lane by the caller),
// GAINSIGHT_API for a Gainsight object, null on derived tasks. Every output
// field's meta names the ORIGINAL object and field it came from
// (originalObjectName / originalFieldName — a lookup path lands on the
// related object, e.g. Account via Contact), with originalObjectLabel on
// Gainsight objects. criteriaDetails is null and every `_…` derived view
// is empty: the list's filters are not in the payload (KI-027).
/**
 * One `data.taskDetails[]` row of a Power List rule's `re r describe` payload
 * (CLI 1.0.10, measured 2026-10-06). Declared so the tsc gate rejects a read
 * of an undeclared key (the F-343 M5 lock, the reader-shape recipe): an
 * upstream rename fails HERE, in CI, before it reaches a tenant. Re-derive at
 * every CLI adoption from a captured Power List describe.
 * @typedef {object} PowerListTask
 * @property {string} [taskId]          "t1", "t5", …
 * @property {string|null} [datasetName]
 * @property {string|null} [name]
 * @property {string|null} [schemaObject]  an SFDC API name, a Gainsight object GSID, or a prior taskId
 * @property {string|null} [connectionId]  a connector GUID, "GAINSIGHT_API", or null on a derived task
 * @property {PowerListOutputField[]} [outputFields]
 */
/**
 * @typedef {object} PowerListOutputField
 * @property {string} [fieldName]
 * @property {string} [field]
 * @property {string} [label]
 * @property {string} [outputFieldName]
 * @property {{originalObjectName?: string, originalFieldName?: string, originalObjectLabel?: string, originalSchemaType?: string, originalPathMetaData?: {path?: {relationshipName?: string}}}} [meta]
 */
export function extractPowerList(payload) {
  const data = payload?.data && typeof payload.data === "object" ? payload.data : payload ?? {};
  const rd = data?.ruleDetails && typeof data.ruleDetails === "object" ? data.ruleDetails : {};
  /** @type {PowerListTask[]} */
  const rawTasks = Array.isArray(data?.taskDetails) ? data.taskDetails.filter((t) => t && typeof t === "object") : [];
  const taskIds = new Set(rawTasks.map((t) => (t.taskId != null ? String(t.taskId) : null)).filter(Boolean));
  const tasks = [];
  const seenFields = new Set();
  for (const t of rawTasks) {
    const schemaObject = t.schemaObject != null ? String(t.schemaObject) : null;
    const derived = schemaObject != null && taskIds.has(schemaObject);
    const connId = t.connectionId != null ? String(t.connectionId) : null;
    /** @type {PowerListOutputField[]} */
    const outputs = Array.isArray(t.outputFields) ? t.outputFields.filter((f) => f && typeof f === "object") : [];
    let objectLabel = null;
    const fields = [];
    for (const f of outputs) {
      const meta = f.meta && typeof f.meta === "object" ? f.meta : {};
      const objectName = meta.originalObjectName != null ? String(meta.originalObjectName) : derived ? null : schemaObject;
      if (objectName == null) continue; // a derived task's own alias — the upstream task owns the field
      const rawField = meta.originalFieldName ?? f.fieldName ?? f.field ?? null;
      // A lookup-path field is spelled as the SOQL path from the task's
      // object (`Account.CaseSafeID__c` read through Contact → Account, or
      // `A.B.Field` through two hops) while originalObjectName already names
      // the RELATED object the field lives on — the row carries the field's
      // own API name (the LAST segment: an API name never contains a dot) on
      // its own object, the full path kept beside it. A --field term is
      // exact, never substring (F-487 reopen, instance 2: one stripped hop
      // left `B.Field` behind).
      const fieldName = typeof rawField === "string" && rawField.includes(".") ? rawField.slice(rawField.lastIndexOf(".") + 1) : rawField;
      // originalObjectLabel is the task's BASE object's label even on a
      // lookup field (F-487 reopen, instance 1b) — it is only the base
      // object's label, never the related object's, and the registry is
      // what labels a Gainsight object (powerListRows canonicalizes).
      const label = meta.originalObjectLabel ?? null;
      if (objectLabel == null && !derived && label != null && objectName === schemaObject) objectLabel = String(label);
      const key = `${objectName}\u0000${fieldName ?? ""}`;
      if (seenFields.has(key)) continue;
      seenFields.add(key);
      fields.push({
        objectName,
        objectLabel: label != null && objectName === schemaObject ? String(label) : null,
        fieldName: fieldName != null ? String(fieldName) : null,
        fieldPath: typeof rawField === "string" && rawField !== fieldName ? rawField : null,
        fieldLabel: f.label ?? f.outputFieldName ?? null,
        schemaType: meta.originalSchemaType ?? null,
      });
    }
    tasks.push({
      taskId: t.taskId != null ? String(t.taskId) : null,
      datasetName: t.datasetName ?? t.name ?? null,
      objectName: derived ? null : schemaObject,
      objectLabel,
      derived,
      upstreamTaskId: derived ? schemaObject : null,
      connection: connId == null ? null : INTERNAL_CONNECTION_IDS.has(connId) ? { id: connId, name: null, type: connId } : { id: connId, name: null, type: null },
      fields,
    });
  }
  return {
    id: rd.ruleId != null ? String(rd.ruleId) : null,
    name: rd.ruleName ?? null,
    active: typeof rd.active === "boolean" ? rd.active : null,
    ruleType: rd.ruleType ?? rd.sourceType ?? null,
    tasks,
    // stated as data so every renderer says the same thing (KI-027)
    filtersReadable: Array.isArray(data?.criteriaDetails) && data.criteriaDetails.length > 0,
  };
}

// ── F-487 reopen: the Gainsight object registry ──────────────────────────────
// A Power List names a Gainsight object by its GSID (schemaObject, and
// meta.originalObjectName on a field); the KB's data-management lane records
// every object's GSID, system name and label. Identities are canonical, not
// payload-shaped: every object a list reads is reachable by every spelling
// the KB records for it, and the row carries the system name with the label
// and GSID beside it — never the task's base-object label on a lookup target.
//
// One data-management doc → { gsid, name, label, dbName } or null. Full
// describe docs carry the four as `- objectId:` / `- name:` / `- label:` /
// `- dbName:` bullets (scalarBullets of data{…}; the payload's shape is the
// CLI's `dm o describe` detail root `$.data`, measured on a live KB
// 2026-10-06: objectId, name, dbName, label, …); a shallow-crawl stub carries
// the `dm o list` row (`$.data.liteObjects[]`: name, label, …) whose scalars
// are its bullets. Bullets first — no JSON.parse per doc on a 600-object lane
// — the fence only when no bullet names the object.
/**
 * The identity keys of a `dm o describe` detail root (`$.data`) or a `dm o
 * list` row (`$.data.liteObjects[]`) — declared so the tsc gate rejects a read
 * of an undeclared key (the F-343 M5 lock, the reader-shape recipe).
 * @typedef {object} DmObjectIdentity
 * @property {string} [objectId]   the GSID (describe only; a list row carries none)
 * @property {string} [gsid]
 * @property {string} [name]       the system name
 * @property {string} [objectName]
 * @property {string} [label]
 * @property {string} [objectLabel]
 * @property {string} [dbName]
 */
export function extractObjectIdentity(payload) {
  /** @type {DmObjectIdentity|null} */
  const d = payload?.data && typeof payload.data === "object" && !Array.isArray(payload.data) ? payload.data : payload;
  if (!d || typeof d !== "object") return null;
  const name = d.name ?? d.objectName ?? null;
  const gsid = d.objectId ?? d.gsid ?? null;
  if (name == null && gsid == null) return null;
  return {
    gsid: gsid != null ? String(gsid) : null,
    name: name != null ? String(name) : null,
    label: d.label != null ? String(d.label) : d.objectLabel != null ? String(d.objectLabel) : null,
    dbName: d.dbName != null ? String(d.dbName) : null,
  };
}
// One data-management doc → the object's identity AS THE KB KEYS IT (F-487
// second reopen, Redesign): the system name is the doc's `- id:` bullet — the
// manifest key `data-management/<id>`, the lane's recorded idField `name` —
// never a `- name:` bullet (the renderer writes the manifest's DISPLAY name
// as the first `- name:`, and on real KBs that is the label: 579 of 594 docs
// on one production KB, the sandbox KB alike — a value the fixture's shape
// check could not see). The GSID, label and dbName are the payload's own
// scalars (`- objectId:` / `- label:` / `- dbName:` bullets, scalarBullets of
// data{…}; a shallow stub carries the list row's label and no GSID). The
// fence is read only when the doc carries no `- id:` bullet (a hand-built doc).
export function docObjectIdentity(md) {
  const text = normalizeText(String(md ?? ""));
  const b = topBullets(text);
  const strip = (v) => (typeof v === "string" ? v.replace(/^`|`$/g, "").trim() : v);
  const id = strip(b.id);
  if (id == null || id === "" || id === NO_NAME) {
    const fromFence = extractObjectIdentity(parseDocJson(text));
    return fromFence && fromFence.name ? fromFence : null;
  }
  const gsid = strip(b.objectId ?? b.gsid);
  return { gsid: gsid || null, name: id, label: strip(b.label) || null, dbName: strip(b.dbName) || null };
}
// The registry over one folder: `resolve(ref)` → entry for a GSID, a system
// name, a label or a dbName (case-insensitive, NFC), null when the KB does
// not know the object (an SFDC object, or a Gainsight object the lane never
// listed). `stats` says what was read, for the caveats.
export function makeObjectResolver({ kbDir, folder = RECORDED_LANES.objects.folder }) {
  const byKey = new Map();
  const stats = { docs: 0, parsed: 0, folderPresent: false };
  const add = (e) => {
    if (!e) return;
    stats.parsed++;
    for (const k of [e.gsid, e.name, e.label, e.dbName]) if (k) { const kk = termKey(k); if (!byKey.has(kk)) byKey.set(kk, e); }
  };
  if (kbDir != null) {
    let files = null;
    try { files = readdirSync(join(kbDir, folder)).filter((f) => f.endsWith(".md")); } catch { files = null; }
    if (files) {
      stats.folderPresent = true;
      for (const f of files) {
        stats.docs++;
        let text;
        try { text = readFileSync(join(kbDir, folder, f), "utf8"); } catch { continue; }
        add(docObjectIdentity(text));
      }
    }
  }
  const resolve = (ref) => (ref == null || ref === "" ? null : byKey.get(termKey(String(ref))) ?? null);
  resolve.stats = stats;
  resolve.folder = folder;
  resolve.size = stats.parsed; // objects, not spellings
  return resolve;
}
// One object reference (a GSID, a name, an SFDC API name) → the canonical
// identity the row carries: the system name, the label and every other
// spelling as aliases; an unknown reference passes through unchanged.
export function canonicalObject(ref, objects, fallbackLabel = null) {
  const e = typeof objects === "function" && ref != null ? objects(ref) : null;
  if (!e) return { objectName: ref ?? null, objectLabel: fallbackLabel ?? null, objectAliases: [] };
  const aliases = [e.gsid, e.dbName, ref].filter((a) => a && a !== e.name && a !== e.label);
  return { objectName: e.name ?? ref, objectLabel: e.label ?? fallbackLabel ?? null, objectAliases: [...new Set(aliases)] };
}

// A Power List's usage rows — the objects its tasks read (with the
// connection), then the fields its output carries, each tied to the
// original object, AS THE PAYLOAD NAMES THEM. `source`/`sourceRef` are stamped
// by the caller, and canonicalization is the caller's one post-pass over
// every row kind (usageCandidates) — never here, never per kind (F-487
// second reopen, Redesign).
export function powerListRows(pl) {
  const rows = [];
  const plName = pl.name ?? pl.id ?? "(unnamed Power List)";
  for (const t of Array.isArray(pl.tasks) ? pl.tasks : []) {
    if (t.objectName != null) {
      rows.push({
        kind: "power-list-object",
        usage: "Power List source object",
        objectName: t.objectName,
        objectLabel: t.objectLabel ?? null,
        fieldName: null,
        fieldLabel: null,
        connection: t.connection ?? null,
        detail: `Power List "${plName}" task "${t.datasetName ?? t.taskId ?? "?"}"${t.connection ? ` via connection ${t.connection.type ?? t.connection.id}` : ""}`,
      });
    }
    for (const f of t.fields) {
      rows.push({
        kind: "power-list-field",
        usage: "Power List output field",
        objectName: f.objectName,
        objectLabel: f.objectLabel ?? null,
        fieldName: f.fieldName,
        fieldLabel: f.fieldLabel,
        connection: t.connection ?? null,
        detail: `Power List "${plName}" task "${t.datasetName ?? t.taskId ?? "?"}"${f.schemaType ? ` (${f.schemaType})` : ""}${f.fieldPath ? `, path ${f.fieldPath}` : ""}`,
      });
    }
  }
  return rows;
}

// KB doc (rules lane) → PowerList, or null when the doc is not a Power List
// rule (a Rules Engine rule under the same folder) or unparseable.
export function parsePowerListDoc(md) {
  const text = normalizeText(String(md ?? ""));
  const json = parseDocJson(text);
  if (json == null || !isPowerListPayload(json)) return null;
  return extractPowerList(json);
}

// Locate a KB doc by asset id under one folder, the way the DD provenance
// lookup does (F-129 case-insensitive fallback, F-198 wrong-id detection):
// { path, rel } or { reason: "missing" | "fs-error" | "wrong-id", … }. The
// F-198 check runs on the TEXT the caller read, so a doc is read once.
export function locateKbDoc(kbDir, folder, id) {
  const base = docBaseName(id);
  const file = `${base}.md`;
  let rel = `${folder}/${file}`;
  let path = join(kbDir, folder, file);
  if (!existsSync(path)) {
    let found = null;
    try {
      found = readdirSync(join(kbDir, folder)).find((f) => f.toLowerCase() === file.toLowerCase()) ?? null;
    } catch (e) {
      if (e?.code !== "ENOENT") return { reason: "fs-error", rel, detail: `${e.code ?? "error"}: ${e.message}` };
    }
    if (found == null) return { reason: "missing", rel };
    rel = `${folder}/${found}`;
    path = join(kbDir, folder, found);
  }
  return { path, rel, base };
}
// The F-198 half: does the doc at this name belong to the requested id?
// Returns the other id on a real collision, null when the doc is trusted.
export function kbDocCollidesWith(text, id, { kbDir, folder, base }) {
  const keyId = docKeyId(normalizeText(text));
  if (keyId == null || keyId === id) return null;
  let collided = keyId.toLowerCase() !== id.toLowerCase();
  if (!collided) {
    const dupRe = new RegExp(`^${escapeRe(base)}(?:-dup)+\\.md$`, "i");
    try {
      collided = readdirSync(join(kbDir, folder)).some((f) => dupRe.test(f));
    } catch { /* a doc was just read from this folder — fail open to the F-129 behavior */ }
  }
  return collided ? keyId : null;
}

// Resolver over the rules lane: ruleId → PowerList | { problem } (cached;
// `problems` collects every unresolved id once for the caveats). `folder`
// is the workspace's RECORDED rules folder (the index carries it; the
// RECORDED_LANES default when nothing is recorded).
export function makePowerListResolver({ kbDir, folder = RECORDED_LANES.rules.folder }) {
  const cache = new Map();
  const problems = []; // { ruleId, reason, rel, detail?, otherId? }
  const resolve = (ruleId) => {
    if (ruleId == null || ruleId === "") return null;
    if (cache.has(ruleId)) return cache.get(ruleId);
    let out;
    if (kbDir == null) out = { problem: { ruleId, reason: "no-kb", rel: null } };
    else {
      const loc = locateKbDoc(kbDir, folder, ruleId);
      if (loc.reason) out = { problem: { ruleId, ...loc } };
      else {
        let text = null;
        try { text = readFileSync(loc.path, "utf8"); } catch { text = null; }
        const otherId = text == null ? null : kbDocCollidesWith(text, ruleId, { kbDir, folder, base: loc.base });
        if (text == null) out = { problem: { ruleId, reason: "unparseable", rel: loc.rel } };
        else if (otherId != null) out = { problem: { ruleId, reason: "wrong-id", rel: loc.rel, otherId } };
        else {
          const pl = parsePowerListDoc(text);
          out = pl == null
            ? { problem: { ruleId, reason: "not-a-power-list", rel: loc.rel } }
            : { ...pl, docPath: kbDocDisplayPath(loc.path) };
        }
      }
    }
    if (out.problem) problems.push(out.problem);
    cache.set(ruleId, out);
    return out;
  };
  resolve.problems = problems;
  resolve.folder = folder;
  return resolve;
}

// Which field term (if any) a candidate row matches. Prepared terms
// (prepFieldTerm) in; { term, how, candidate } out — term is the ORIGINAL
// term text (for the "matched term" column), candidate the value that hit
// (so alias hits can print the full prefixed name).
export function matchFieldTerm(row, fieldTerms, aliasPrefix = null) {
  for (const prepped of fieldTerms) {
    const candidates = row.kind === "custom" ? row.strings : [row.fieldName, row.fieldLabel];
    for (const value of candidates) {
      const m = fieldTermMatch(value, prepped, aliasPrefix);
      if (m) return { term: prepped.term, how: m.how, candidate: String(value).trim() };
    }
  }
  return null;
}

// Any row naming an object matches it — filter conditions, and since F-487
// Power List task objects / output fields, dynamic fields and branch
// conditions; mapping rows carry none (C1 fact) and never match. A Gainsight
// object in a Power List is carried as its GSID with the label beside it, so
// the label is a candidate too (the way tenant-deps' matchRow reads it).
export function matchObjectTerm(row, objectTerms) {
  for (const { term, lowered } of objectTerms)
    if (eqTerm(row.objectName, lowered) || eqTerm(row.objectLabel, lowered) || (Array.isArray(row.objectAliases) && row.objectAliases.some((a) => eqTerm(a, lowered)))) return term;
  return null;
}

// ${...} tokens in one text — inner text plus its dot-segments are the exact-
// match candidates (a field term "Name" must hit ${Account.Name}).
export function tokenCandidates(text) {
  const out = [];
  if (typeof text !== "string") return out;
  for (const m of text.matchAll(/\$\{([^}]+)\}/g)) {
    const inner = m[1].trim();
    out.push({ token: m[0], candidates: [inner, ...inner.split(".").map((s) => s.trim())] });
  }
  return out;
}

// The scannable texts of one C1 template entry (location labels mirror the
// search-mode field names).
const templateTexts = (tpl) => [
  { location: "subject", text: tpl.subject },
  { location: "body", text: tpl.body },
  ...(tpl.variants ?? []).flatMap((v) => [
    { location: `variant "${v.name ?? "(unnamed)"}" subject`, text: v.subject },
    { location: `variant "${v.name ?? "(unnamed)"}" body`, text: v.body },
  ]),
];

// Every ${...} spelling a binding key can take in text — built on the shared
// token-id grammar in jo-report.mjs (tokenKeyVariants), so the resolver's key
// matching and this locator can never disagree on the gs- prefix rule.
export const tokenSpellings = (key) => tokenKeyVariants(key).map((s) => `\${${s}}`);

// --scan-tokens (ER-19): two scan paths, one row shape. Every row carries the
// raw token id + location as evidence, plus WHICH handle matched and how.
// (a) BINDING-RESOLVED — the ER-19 fix: each in-scope program's step
//     tokens[] (C1 v2, both generations) supplies the GUID→field join; a
//     --field term matches the binding's label / field API name /
//     objectName-qualified spelling (calc-bound: label only, flagged;
//     survey/literal tokens: structurally never candidates). Matched
//     bindings are located in the step's captured template texts; a binding
//     whose token can't be located still rows (the binding is evidence).
// (b) TOKEN-TEXT — the pre-ER-19 literal compare of ${...} inner text /
//     dot-segments, kept for tenants whose tokens are field-name-style.
// One row per program×template×location×token×term; binding rows win dedup.
export function scanTokens(index, programs, fieldTerms, aliasPrefix = null) {
  const rows = [];
  const missing = new Set();
  const metadataOnly = new Set();
  const seen = new Set();
  const push = (r) => {
    // the token component of the dedup key is CANONICALIZED (gs- prefix
    // dropped via the shared grammar) so a binding-path row and a token-text
    // row for the same physical token can't survive as two rows when their
    // spellings differ — binding rows run first, so they win
    const canon = canonicalTokenKey(String(r.token).replace(/^\$\{/, "").replace(/\}$/, ""));
    const key = [r.program.id, r.template?.id ?? "", r.location, canon, r.term].join("\u0000");
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(r);
  };
  // per-template memo of scannable texts + their ${...} candidates: both
  // scan paths read it, and a template shared by many programs parses once
  const scannableCache = new Map();
  const scannableFor = (tpl) => {
    let entry = scannableCache.get(tpl);
    if (!entry) {
      entry = templateTexts(tpl).map((t) => ({ ...t, candidates: tokenCandidates(t.text) }));
      scannableCache.set(tpl, entry);
    }
    return entry;
  };

  for (const p of programs) {
    // (a) binding-resolved
    for (const step of Array.isArray(p.steps) ? p.steps : []) {
      const stepTplIds = [step?.emailTemplateId, ...(step?.variantTemplateIds ?? [])].filter(Boolean);
      for (const tok of Array.isArray(step?.tokens) ? step.tokens : []) {
        if (!tok || tok.kind === "survey" || tok.kind === "literal") continue;
        // term-independent per-token facts, computed once (not per term)
        const raw = `\${${tok.tokenKey}}`;
        const spellings = tokenSpellings(tok.tokenKey);
        const handles =
          tok.kind === "calc"
            ? [["label", tok.label]] // calc: the label is the only resolvable handle
            : [
                ["label", tok.label],
                ["field name", tok.fieldName],
                ["object-qualified", tok.objectName != null && tok.fieldName != null ? `${tok.objectName}.${tok.fieldName}` : null],
              ];
        for (const prepped of fieldTerms) {
          let hit = null;
          for (const [handle, value] of handles) {
            const m = value != null ? fieldTermMatch(value, prepped, aliasPrefix) : null;
            if (m) {
              hit = { handle, how: m.how, candidate: String(value).trim() };
              break;
            }
          }
          if (!hit) continue;
          let located = false;
          let docsSeen = 0;
          for (const tplId of stepTplIds) {
            const tpl = own(index.templates, tplId);
            if (!tpl) {
              missing.add(tplId);
              continue;
            }
            docsSeen++;
            if (tpl.bodyIncluded !== true) metadataOnly.add(tplId);
            for (const { location, text } of scannableFor(tpl)) {
              if (typeof text !== "string" || !spellings.some((s) => text.includes(s))) continue;
              located = true;
              push({ program: p, template: tpl, location, token: raw, term: prepped.term, ...hit, calc: tok.kind === "calc" });
            }
          }
          if (!located)
            // the binding itself is evidence — a token that can't be located
            // (missing/metadata-only doc) still rows, with an honest label
            push({
              program: p,
              template: null,
              location: docsSeen
                ? "(bound in program; not located in captured template text)"
                : "(bound in program; template doc missing)",
              token: raw,
              term: prepped.term,
              ...hit,
              calc: tok.kind === "calc",
            });
        }
      }
    }
    // (b) token-text
    for (const tplId of own(index.links?.programToTemplates, p.id) ?? []) {
      const tpl = own(index.templates, tplId);
      if (!tpl) {
        missing.add(tplId);
        continue;
      }
      // metadata-only docs have no captured body — the scan below sees only
      // the subject, and that partial coverage must be caveated, not silent
      if (tpl.bodyIncluded !== true) metadataOnly.add(tplId);
      for (const { location, candidates: textTokens } of scannableFor(tpl))
        for (const { token, candidates } of textTokens)
          for (const prepped of fieldTerms) {
            let m = null;
            let cand = null;
            for (const c of candidates) {
              m = fieldTermMatch(c, prepped, aliasPrefix);
              if (m) {
                cand = c;
                break;
              }
            }
            if (!m) continue;
            push({
              program: p, template: tpl, location, token, term: prepped.term,
              handle: "token text", how: m.how, candidate: String(cand).trim(), calc: false,
            });
          }
    }
  }
  return { rows, missingTemplates: [...missing].sort(), metadataOnlyTemplates: [...metadataOnly].sort() };
}

// ── core scan (exported for tests) ───────────────────────────────────────────

// index + terms → field-level rows, object-level-only programs, token rows,
// near-miss candidates (alias mode only). Pure — no I/O, no process state.
export function scanDeps(
  index,
  { objectTerms = [], fieldTerms = [], all = false, includePaused = false, tokens = false, aliasPrefix = null, powerLists = null, objects = null } = {}
) {
  // termKey, not raw trim/lower (F-197): eqTerm happens to re-fold its term
  // side, but every `lowered` producer routes through the one key rule so no
  // consumer can inherit an unfolded spelling.
  const oTerms = objectTerms.map((term) => ({ term, lowered: termKey(term) }));
  const fTerms = fieldTerms.map(prepFieldTerm);

  const programs = Object.values(index.programs ?? {})
    .filter((p) => p && typeof p === "object" && (all || isActive(p, { includePaused })))
    .sort((a, b) => cmpName(a.name, b.name) || cmpKey(a.id, b.id)); // pinned locale (F-128)

  const fieldRows = [];
  const objectRowsByProgram = new Map(); // program id → condition rows matching an object term
  // near-misses (alias mode only): term → Set of NON-matching candidate field
  // names that contain the term's words — listed in a caveat, never counted
  const nearMissByTerm = new Map();
  for (const p of programs) {
    for (const row of usageCandidates(p, { powerLists, objects })) {
      const fMatch = fTerms.length ? matchFieldTerm(row, fTerms, aliasPrefix) : null;
      const oTerm = oTerms.length ? matchObjectTerm(row, oTerms) : null;
      if (fMatch)
        fieldRows.push({
          program: p, ...row,
          matchedTerm: fMatch.term, matchedHow: fMatch.how, matchedCandidate: fMatch.candidate,
          matchedOn: "field",
        });
      else if (oTerm && !fTerms.length)
        // object-only run: object-matching condition rows ARE the main rows
        fieldRows.push({ program: p, ...row, matchedTerm: oTerm, matchedOn: "object" });
      else if (oTerm) {
        if (!objectRowsByProgram.has(p.id)) objectRowsByProgram.set(p.id, { program: p, rows: [] });
        objectRowsByProgram.get(p.id).rows.push({ ...row, matchedTerm: oTerm });
      }
      if (!fMatch && aliasPrefix && fTerms.length)
        addNearMisses(nearMissByTerm, row.kind === "custom" ? row.strings : [row.fieldName, row.fieldLabel], fTerms);
    }
  }

  let tokenResult = { rows: [], missingTemplates: [], metadataOnlyTemplates: [] };
  if (tokens && fTerms.length) tokenResult = scanTokens(index, programs, fTerms, aliasPrefix);

  // Object-level-only section: programs with object-term condition matches
  // but ZERO field-term rows anywhere (incl. token rows). A program with
  // BOTH keeps its object-matched rows in the main table — never dropped.
  const fieldMatchedPrograms = new Set([
    ...fieldRows.map((r) => r.program.id),
    ...tokenResult.rows.map((r) => r.program.id),
  ]);
  const objectLevel = [];
  for (const e of objectRowsByProgram.values()) {
    if (fieldMatchedPrograms.has(e.program.id))
      for (const row of e.rows) fieldRows.push({ program: e.program, ...row, matchedOn: "object" });
    else objectLevel.push(e);
  }
  // restore per-program grouping after the append above (sort is stable)
  const order = new Map(programs.map((p, i) => [p.id, i]));
  fieldRows.sort((a, b) => order.get(a.program.id) - order.get(b.program.id));

  const objectsTouched = [
    ...new Set(
      [...fieldRows, ...objectLevel.flatMap((e) => e.rows)]
        .map((r) => r.objectName)
        .filter((o) => o != null && o !== "")
    ),
  ].sort();

  // Every unreadable Power List rule any IN-SCOPE program references, from
  // the scan itself — never from the provenance of the programs that matched
  // (F-487 second reopen, Redesign, invariant B): a program whose only match
  // runs through an unreadable list matches nothing, and its absence must be
  // said whatever the terms were. One record per rule id, the referencing
  // programs with it.
  const powerListProblems = [];
  if (typeof powerLists === "function") {
    const byRule = new Map();
    for (const p of programs)
      for (const src of Array.isArray(p.sources) ? p.sources : []) {
        if (!src || typeof src !== "object" || classifySource(src) !== "power-list") continue;
        const ruleId = powerListRuleId(src);
        if (ruleId == null) continue;
        const pl = powerLists(ruleId);
        if (pl && !pl.problem) continue;
        let rec = byRule.get(ruleId);
        if (!rec) {
          rec = { ...(pl?.problem ?? { ruleId, reason: "missing", rel: null }), sourceName: src.name ?? src.configId ?? "(unnamed source)", programs: [] };
          byRule.set(ruleId, rec);
        }
        if (!rec.programs.some((q) => q.id === p.id)) rec.programs.push({ id: p.id, name: p.name ?? null });
      }
    powerListProblems.push(...[...byRule.values()].sort((a, b) => cmpKey(a.ruleId, b.ruleId)));
  }

  return {
    programs,
    fieldRows,
    powerListProblems,
    tokenRows: tokenResult.rows,
    missingTemplates: tokenResult.missingTemplates,
    metadataOnlyTemplates: tokenResult.metadataOnlyTemplates,
    objectLevel,
    objectsTouched,
    nearMisses: [...nearMissByTerm.entries()].map(([term, names]) => ({ term, names: [...names].sort() })),
  };
}

// ── live dm-deps-check reconciliation (exported for tests) ───────────────────

// One captured `dm deps check` payload → { objectName, complete,
// areas: { <AREA>: [{id, name, columns[]}] } } across ALL dependency areas.
// The single copy of the dm-deps-check payload anatomy — the JO-scoped view
// below and tenant-deps.mjs (ER-11) both consume this, so a CLI payload
// change is edited once. Defensive: a payload this can't recognize returns
// null (the caller warns and skips — a bad capture must never sink the
// KB-side report). Columns prefer the human displayName, falling back to
// the API fieldName/name.
// parseLiveDepsAreas lives in doc-lib (F-320): capture.mjs --wait gates on
// the readers' own acceptance rule, and its import closure is
// doc-lib/journal-lib only — hosting the payload anatomy in the shared layer
// gives the poller and both report surfaces the ONE copy. Re-exported here so
// this file remains the deps-parsing surface its consumers import from.
export { parseLiveDepsAreas, depsCaptureReadiness } from "./doc-lib.mjs";

// JO-scoped view of the same payload: { objectName, complete,
// dependents:[{id, name, columns[]}] }. A structurally valid payload with no
// JOURNEY_ORCHESTRATOR area is an ANSWER — the scan found zero JO dependents
// — not a malformed capture (F-320): the old null here made readLiveDepsCaptures
// warn "not a recognizable dm-deps-check payload — skipped", withholding the
// coverage softening the capture had earned. Only an unrecognizable payload
// (parseLiveDepsAreas null) returns null.
export function parseLiveDeps(text) {
  const all = parseLiveDepsAreas(text);
  if (!all) return null;
  const jo = all.areas.JOURNEY_ORCHESTRATOR;
  return { objectName: all.objectName, complete: all.complete, dependents: Array.isArray(jo) ? jo : [] };
}

// The one --live-deps file-intake loop for both deps surfaces (bus F-311 —
// it lived as a hand-copied twin in each script, an undeclared keep-in-sync
// pair of the same genus as the pre-F-310 --kb checks). The CONTRACT is
// shared: an unreadable or unrecognizable file WARNS and is skipped (never a
// hard failure — the KB-side report still renders), a non-COMPLETED capture
// warns loudly (async check — never silently trusted), and a payload for an
// object outside the --object terms warns. The two surfaces differ only in
// what they parameterize: `parse` (parseLiveDeps for the JO-scoped mode,
// parseLiveDepsAreas for the tenant-wide one) and `matchesObjectTerm` (each
// caller keeps its own documented term compare — termKey/F-197 vs
// eqTerm/F-148 — both NFC-folding, shaped to that caller's term objects).
// Returns the parsed captures; callers transform from there.
export function readLiveDepsCaptures(files, { parse, matchesObjectTerm }, warnings) {
  const captures = [];
  for (const file of files ?? []) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch (e) {
      warnings.push(`--live-deps ${file}: unreadable (${e.message}) — skipped`);
      continue;
    }
    const parsed = parse(text);
    if (!parsed) {
      warnings.push(`--live-deps ${file}: not a recognizable dm-deps-check payload — skipped`);
      continue;
    }
    if (!parsed.complete)
      warnings.push(`--live-deps ${file}: progressStatus is not COMPLETED — the check is async; re-run the capture until it completes`);
    if (parsed.objectName && !matchesObjectTerm(parsed.objectName))
      warnings.push(`--live-deps ${file}: payload is for object '${parsed.objectName}', which is not among the --object terms`);
    captures.push(parsed);
  }
  return captures;
}

// Live dependents × the KB scan: each dependent gets the index's status (or
// an honest "not in KB") and whether the KB-side report also surfaced it —
// a "no" row IS the F2 payoff: real mapping/SELECT-side usage the KB scan
// structurally cannot see. "Surfaced" matches scanDeps's own notion of
// matched (fieldMatchedPrograms): field rows AND token rows, plus the
// object-level section — a token-only match renders in the report above and
// must not be relabeled live-only here.
export function reconcileLiveDeps(live, index, result) {
  const matchedIds = new Set([
    ...result.fieldRows.map((r) => r.program.id),
    ...result.tokenRows.map((r) => r.program.id),
    ...result.objectLevel.map((e) => e.program.id),
  ]);
  const rows = live.dependents.map((dep) => {
    const p = dep.id != null ? own(index.programs, dep.id) : undefined;
    return {
      id: dep.id,
      name: dep.name ?? p?.name ?? "(unnamed)",
      status: p ? statusCell(p) : "not in KB",
      inKbReport: dep.id != null && matchedIds.has(dep.id),
      columns: dep.columns,
    };
  });
  return {
    objectName: live.objectName,
    complete: live.complete,
    rows,
    liveOnly: rows.filter((r) => !r.inKbReport).length,
  };
}

// ── ER-20: participant-source provenance (exported for tests) ────────────────
// Resolution happens here, at report time — the index carries only the raw
// C1 v2 pointers (participantSourceCollectionId / participantSourceType /
// participantOperationType). NOT a tenant-deps.mjs reuse: tenant-deps
// resolves the connector registry; this is a KB-doc lookup by collectionId
// (the doc filename IS the collectionId — verified P-2).

// The two read-only fetches that (re)create a Data Designer's KB docs —
// named in the missing-doc caveat so the gap is actionable, never silent.
// sq (doc-lib) is the one quoting rule (F-123 — this file's ":the escape rule
// lives in exactly one place" claim is finally true).
export const DD_DOC_LOOKUPS = [
  { folder: RECORDED_LANES.datasets.folder, fetch: (id) => `gs-admin --json jo dd get --name ${sq(id)}` },
  { folder: RECORDED_LANES.objects.folder, fetch: (id) => `gs-admin --json dm o describe --name ${sq(id)}` },
];
// The same two lookups over the folders a workspace RECORDED for those lanes
// (F-429: the folder name is per-workspace data; the index carries the
// resolution) — the literals above are the no-recording defaults.
export const ddDocLookups = ({ datasets = null, objects = null } = {}) => [
  { ...DD_DOC_LOOKUPS[0], folder: datasets ?? DD_DOC_LOOKUPS[0].folder, kind: "designer" },
  { ...DD_DOC_LOOKUPS[1], folder: objects ?? DD_DOC_LOOKUPS[1].folder, kind: "dm" },
];

// Fence → parsed payload body (null on absence/malformation), with the
// describe envelope ({result, data:{…}}) unwrapped when present — both KB doc
// families read through this one guard. The fence-parse half is doc-lib's
// parseDocJson (GP-B5 DS-24 — the recorded post-S9 consolidation, executed);
// the one-level unwrap + object enforcement stay HERE, a home the T-3
// envelope rule cites. Exported for the DS-24 differential corpus in
// test/doc-lib-fixtures.mjs, which pins this composition per corpus doc.
export function docJsonBody(text) {
  const json = parseDocJson(text);
  if (json == null) return null;
  const body = json.data && typeof json.data === "object" && !Array.isArray(json.data) ? json.data : json;
  return body && typeof body === "object" && !Array.isArray(body) ? body : null;
}

// journey-data-designer/<collectionId>.md → { label, objectName, fields[] }.
// Doc shape: H1 title, "## Raw" fenced JSON {objectName, label, fieldCount,
// fields[{fieldName, displayName, dataType}]} (top-level in observed docs;
// an enveloped payload unwraps the same way). null on anything unparseable —
// the caller treats that as an unreadable doc (caveat, never a crash).
export function parseDesignerFieldsDoc(md) {
  const text = normalizeText(String(md ?? ""));
  const json = docJsonBody(text);
  if (json == null) return null;
  const fields = (Array.isArray(json.fields) ? json.fields : [])
    .filter((f) => f && typeof f === "object")
    .map((f) => ({ fieldName: f.fieldName ?? null, displayName: f.displayName ?? null, dataType: f.dataType ?? null }));
  return { label: json.label ?? docH1(text), objectName: json.objectName ?? null, fields };
}

// data-management/<collectionId>.md → { label, description, dataStore,
// columns[] } (columns in the SAME shape as the designer doc's fields, so
// they can stand in as the field dictionary when the designer doc is absent).
// Doc shape: H1 + bullets + fenced describe JSON {result, data:{label,
// description, dataStore, columns[{name, label, type}]}}.
export function parseDmObjectDoc(md) {
  const text = normalizeText(String(md ?? ""));
  const data = docJsonBody(text);
  if (data == null) return null;
  const columns = (Array.isArray(data.columns) ? data.columns : [])
    .filter((c) => c && typeof c === "object")
    .map((c) => ({ fieldName: c.name ?? null, displayName: c.label ?? null, dataType: c.type ?? null }));
  return { label: data.label ?? docH1(text), description: data.description ?? null, dataStore: data.dataStore ?? null, columns };
}

// Source → provenance kind. Observed type domain (live census 2026-10-06,
// 1,686 source rows of one production tenant — F-487): QUERY_BUILDER is the
// dominant type (Power Lists — participantOperationType
// ADD_ALL_PARTICIPANT_IN_POWER_LIST[_AND_ANY_IN_FUTURE]; every row carries a
// `ruleId`, 23% of them differing from the collectionId), CSV is common
// (collectionId IS the uploaded filename), QUERY (a dynamic program's own
// participant query) and DATA_DESIGNER are rare. Anything else renders
// pointers verbatim.
export function classifySource(src) {
  const t = src?.participantSourceType ?? src?.type ?? null;
  if (t === "DATA_DESIGNER") return "data-designer";
  if (t === "CSV") return "csv";
  if (t === "QUERY_BUILDER") return "power-list";
  if (t === "QUERY") return "query";
  return "other";
}

// Matched rows → the distinct (program, source) pairs to resolve, each with
// the columns to tie to the field dictionary. A column is `matched: true`
// when a field term actually hit it (row.matchedCandidate); rows that reached
// the report via an object term only contribute their condition field names
// as `matched: false` — the tie still renders, labeled as a source column,
// never as a field-term match. Covers the main usage rows AND the
// object-level section — every source the report names gets its provenance.
// Token rows are template-derived, not source-derived: nothing here.
export function collectProvenanceSources(result) {
  const map = new Map(); // sourceRef → { program, source, matchedColumns:Map(col→matched) }
  const add = (program, row) => {
    const ref = row.sourceRef;
    if (!ref || typeof ref !== "object") return;
    let e = map.get(ref);
    if (!e) {
      e = { program, source: ref, matchedColumns: new Map() };
      map.set(ref, e);
    }
    const col = row.matchedCandidate ?? row.fieldName ?? row.fieldLabel;
    if (col == null || String(col).trim() === "") return;
    const key = String(col).trim();
    e.matchedColumns.set(key, (e.matchedColumns.get(key) ?? false) || row.matchedCandidate != null);
  };
  for (const r of result.fieldRows) add(r.program, r);
  for (const e of result.objectLevel) for (const row of e.rows) add(e.program, row);
  // Every program a report matches carries a provenance entry for its
  // source(s) (F-487 reopen, instance 3): a program matched only through a
  // program-level row (a dynamic field, a branch condition — sourceRef null)
  // has no source row to hang on, so its sources are added here with no
  // matched columns — that is how a dynamic program's QUERY cell is reached.
  const programLevel = new Map();
  for (const r of result.fieldRows) if (!r.sourceRef) programLevel.set(r.program.id, r.program);
  for (const e of result.objectLevel) if (e.rows.some((row) => !row.sourceRef)) programLevel.set(e.program.id, e.program);
  for (const program of programLevel.values())
    for (const src of Array.isArray(program.sources) ? program.sources : [])
      if (src && typeof src === "object" && !map.has(src)) map.set(src, { program, source: src, matchedColumns: new Map() });
  return [...map.values()].map((e) => ({
    ...e,
    matchedColumns: [...e.matchedColumns.entries()]
      .map(([column, matched]) => ({ column, matched }))
      .sort((a, b) => cmpKey(a.column, b.column)), // pinned locale (F-128)
  }));
}

// Report columns × the DD's field dictionary → ties (e.g. custom mapping
// 'Renewal ID' ↔ DD field RenewalId). Columns are `{column, matched}` (bare
// strings accepted as matched — the unit-test/simple-caller form); each tie
// carries the flag so rendering can distinguish a field-term match from a
// source column that reached the report via an object term. Matching is the
// ER-21 semantics in BOTH directions — the task-alias prefix can sit on the
// mapping column (`A_Renewal ID` ↔ DD `Renewal ID`) or on the DD output
// column itself (`Renewal ID` ↔ DD `A_Renewal ID`) — never substring.
export function tieToFieldDictionary(columns, fields, aliasPrefix = null) {
  const ties = [];
  for (const c of Array.isArray(columns) ? columns : []) {
    const { column, matched } = typeof c === "string" ? { column: c, matched: true } : c;
    const prepped = prepFieldTerm(column);
    for (const f of Array.isArray(fields) ? fields : []) {
      let how = null;
      for (const v of [f.fieldName, f.displayName]) {
        if (v == null) continue;
        const fwd = fieldTermMatch(v, prepped, aliasPrefix);
        const m = fwd ?? fieldTermMatch(column, prepFieldTerm(v), aliasPrefix);
        if (m) {
          how = m.how;
          break;
        }
      }
      if (how) ties.push({ column, matched, fieldName: f.fieldName, displayName: f.displayName, dataType: f.dataType, how });
    }
  }
  return ties;
}

// `- key: <domain>/<id>` bullet of a describe-batch doc → the id part, or
// null when the doc carries no key bullet (hand-built and mangled-id fixture
// docs have none). A backtick-quoted value arrives already unwrapped —
// topBullets parses that grammar once for every reader (F-341; this site
// used to carry its own copy); only the leading domain segment is dropped, so
// an id with its own slashes survives intact. (F-198 — the doc's own identity
// claim.)
function docKeyId(text) {
  const raw = topBullets(text).key;
  if (raw == null) return null;
  const val = String(raw).trim();
  if (val === "") return null;
  const slash = val.indexOf("/");
  return slash === -1 ? val : val.slice(slash + 1);
}

// Resolve provenance for every collected (program, source) pair. kbDir null
// means the KB could not be located (only DATA_DESIGNER lookups need it —
// CSV/Power-List rendering is pointer-only). Each collectionId is looked up
// ONCE (programs share Data Designers): docs are read+parsed once, and every
// missing OR unparseable doc is recorded once with its re-fetch command — a
// doc that exists but cannot be parsed must caveat exactly like a missing
// one, never sit silently behind a cell that promises a caveat. Returns
// entries plus the aggregate facts the caveats section reports.
export function resolveProvenance(entries, { kbDir = null, aliasPrefix = null, powerLists = null, ddFolders = null, objects = null } = {}) {
  const out = [];
  let kbNeeded = false;
  // Power Lists resolve through the rules-lane resolver (F-487); a caller
  // that passes none gets one over the default folder, so a direct call
  // (the suite) resolves the same way the CLI entry does.
  const resolvePl = typeof powerLists === "function" ? powerLists : makePowerListResolver({ kbDir });
  const ddLookups = ddDocLookups(ddFolders ?? {});
  // collectionId → { designer, dm, docs[], problems[{folder, path, fetch,
  // reason:"missing"|"unparseable"}], sourceName, programName }
  const ddCache = new Map();
  const lookupDd = (collectionId, src, program) => {
    let hit = ddCache.get(collectionId);
    if (hit) return hit;
    hit = {
      designer: null,
      dm: null,
      docs: [],
      problems: [],
      sourceName: src.name ?? src.configId ?? "(unnamed source)",
      programName: program.name ?? program.id,
    };
    for (const { folder, fetch, kind: lookupKind } of ddLookups) {
      // Locating is the shared locateKbDoc (F-487 lifted it out so the Power
      // List lookup reads the rules lane by the same rules): the WRITER's
      // first-choice filename rule (docBaseName), the case-insensitive
      // fallback before "missing" (F-129 — Windows/macOS fold case at the
      // filesystem, Linux would emit a false re-fetch hint), and ENOENT as
      // the only "missing" — any other listing error is a real filesystem
      // problem reported as one (F-198). `rel` is the spelling actually read.
      const loc = locateKbDoc(kbDir, folder, collectionId);
      if (loc.reason === "fs-error") {
        hit.problems.push({ folder, path: loc.rel, fetch: fetch(collectionId), reason: "fs-error", detail: loc.detail });
        continue;
      }
      if (loc.reason === "missing") {
        hit.problems.push({ folder, path: loc.rel, fetch: fetch(collectionId), reason: "missing" });
        continue;
      }
      const { path, rel, base } = loc;
      let parsed = null;
      let text = null;
      try {
        text = readFileSync(path, "utf8");
        parsed = lookupKind === "designer" ? parseDesignerFieldsDoc(text) : parseDmObjectDoc(text);
      } catch {
        parsed = null;
      }
      if (parsed == null) {
        hit.problems.push({ folder, path: rel, fetch: fetch(collectionId), reason: "unparseable" });
        continue;
      }
      // F-198: verify the doc belongs to the REQUESTED asset before trusting
      // it. docNameClaimer gives a case-colliding id pair <name>.md and
      // <name>-dup.md — but this reader (and the F-129 fallback, and Windows'
      // own case-folding) computes <name>.md for BOTH ids, so the collision
      // loser would silently be attributed the WINNER's label, description,
      // dataStore and field dictionary. Every describe-batch doc carries
      // `- key: <domain>/<id>`: an exact id match — or an absent bullet
      // (hand-built KBs, the C5 mangled-id docs) — is trusted as today. On a
      // case-insensitively-equal mismatch the -dup sibling is the tiebreak:
      // present → a collision really happened at this stem and the doc read
      // is the other id's (honest unresolved, never the winner's data);
      // absent → the F-129 benign case (one asset, differently-cased
      // spelling) resolves as before. Honest residual: a collision whose
      // loser doc was never written is indistinguishable from the benign
      // case and still mis-attributes. (kbDocCollidesWith is the one copy.)
      const otherId = kbDocCollidesWith(text, collectionId, { kbDir, folder, base });
      if (otherId != null) {
        hit.problems.push({ folder, path: rel, fetch: fetch(collectionId), reason: "wrong-id", otherId });
        continue;
      }
      hit.docs.push(kbDocDisplayPath(path));
      if (lookupKind === "designer") hit.designer = parsed;
      else hit.dm = parsed;
    }
    ddCache.set(collectionId, hit);
    return hit;
  };
  for (const e of entries) {
    const src = e.source;
    const kind = classifySource(src);
    const collectionId = src.participantSourceCollectionId ?? null;
    const entry = {
      program: e.program,
      source: src,
      kind,
      collectionId,
      operationType: src.participantOperationType ?? null,
      resolved: false,
      label: null,
      description: null,
      dataStore: null,
      docs: [],
      fields: [],
      ties: [],
      note: null,
      // F-487: the Power List's rule id and what its doc says it reads; the
      // object registry rides the entry so the cell and detail render
      // canonical names (F-487 reopen)
      ruleId: kind === "power-list" ? powerListRuleId(src) : null,
      powerList: null,
      objects: typeof objects === "function" ? objects : null,
    };
    if (kind === "power-list") {
      if (entry.ruleId == null) entry.note = "no ruleId or collectionId recorded in the payload";
      else if (kbDir == null) {
        kbNeeded = true;
        entry.note = "KB directory unavailable — pass --kb (see caveats)";
      } else {
        const pl = resolvePl(entry.ruleId);
        if (pl && !pl.problem) {
          entry.resolved = true;
          entry.label = pl.name ?? src.name ?? null;
          entry.powerList = pl;
          if (pl.docPath) entry.docs = [pl.docPath];
        } else {
          const reason = pl?.problem?.reason ?? "missing";
          entry.note =
            reason === "wrong-id" ? "doc on disk belongs to a different id (case collision)"
              : reason === "fs-error" ? "KB folder unreadable (error named in caveats)"
                : reason === "not-a-power-list" ? "KB doc at this id is not a Power List rule (see caveats)"
                  : reason === "unparseable" ? "KB doc unparseable (see caveats)"
                    : "KB doc missing — run /gs-superadmin:refresh (see caveats)";
        }
      }
    } else if (kind === "query") {
      entry.note = "dynamic program — its participant query is not returned by any CLI command";
    }
    if (kind === "data-designer") {
      if (collectionId == null) entry.note = "no collectionId recorded in the payload";
      else if (kbDir == null) {
        kbNeeded = true;
        entry.note = "KB directory unavailable — pass --kb (see caveats)";
      } else {
        const dd = lookupDd(collectionId, src, e.program);
        entry.docs = dd.docs;
        if (dd.designer || dd.dm) {
          entry.resolved = true;
          entry.label = dd.dm?.label ?? dd.designer?.label ?? src.name ?? null;
          entry.description = dd.dm?.description ?? null;
          entry.dataStore = dd.dm?.dataStore ?? null;
          entry.fields = dd.designer?.fields?.length ? dd.designer.fields : dd.dm?.columns ?? [];
          entry.ties = tieToFieldDictionary(e.matchedColumns, entry.fields, aliasPrefix);
        } else
          // most-honest problem wins the cell (F-198): a wrong-id doc or a
          // filesystem error must never be dressed as a missing doc
          entry.note = dd.problems.some((p) => p.reason === "wrong-id")
            ? "doc on disk belongs to a different id (case collision)"
            : dd.problems.some((p) => p.reason === "fs-error")
              ? "KB folder unreadable (error named in caveats)"
              : dd.problems.some((p) => p.reason === "unparseable")
                ? "KB doc unparseable (re-fetch named in caveats)"
                : "KB doc missing (fetch named in caveats)";
      }
    }
    out.push(entry);
  }
  // one problem record per (collectionId, folder) — never per program
  const missingDocs = [...ddCache.entries()].flatMap(([collectionId, hit]) =>
    hit.problems.map((p) => ({
      collectionId,
      ...p,
      sourceName: hit.sourceName,
      programName: hit.programName,
      resolved: Boolean(hit.designer || hit.dm),
    }))
  );
  // one record per unresolved Power List rule id (F-487), with the FIRST
  // program/source that named it — the resolver dedupes by id
  const seenPl = new Set();
  const powerListProblems = [];
  for (const e of out) {
    if (e.kind !== "power-list" || e.resolved || e.ruleId == null || seenPl.has(e.ruleId)) continue;
    seenPl.add(e.ruleId);
    const problem = resolvePl.problems.find((p) => p.ruleId === e.ruleId) ?? { ruleId: e.ruleId, reason: kbDir == null ? "no-kb" : "missing", rel: null };
    powerListProblems.push({ ...problem, sourceName: e.source.name ?? e.source.configId ?? "(unnamed source)", programName: e.program.name ?? e.program.id });
  }
  return { entries: out, missingDocs, powerListProblems, kbNeeded, powerListFolder: resolvePl.folder };
}

// ── report assembly ──────────────────────────────────────────────────────────

const programCell = (p) => `${p.name ?? "(unnamed)"} (${p.id})`;
const statusCell = (p) => `${p.status ?? "unknown"} (${p.statusSource === "live" ? "live" : "kb"})`;

// "matched term" cell: exact hits stay the bare term (today's rendering);
// alias-mode hits say HOW — e.g. `Renewal ID (task-alias `X_Renewal ID`)` —
// with the full prefixed candidate, since the prefix names the source task.
const matchedCell = (r) =>
  r.matchedHow && r.matchedHow !== "exact" ? `${r.matchedTerm} (${matchHowLabel(r.matchedHow, r.matchedCandidate)})` : r.matchedTerm;

function usageTable(rows) {
  return mdTable(
    ["program", "status", "source", "usage", "object", "field", "matched term", "detail"],
    rows.map((r) => [
      programCell(r.program),
      statusCell(r.program),
      r.source,
      r.usage,
      r.objectName ?? "—",
      r.fieldLabel && r.fieldLabel !== r.fieldName ? `${r.fieldName ?? "—"} ("${r.fieldLabel}")` : r.fieldName ?? "—",
      matchedCell(r),
      r.detail,
    ])
  );
}

// "matched via" cell (ER-19): which handle hit — binding label / field name /
// object-qualified / literal token text — with the candidate value, the alias
// mechanism when one applied, and the calc flag (label-only match).
export const tokenMatchedVia = (r) =>
  `${r.handle ?? "token text"}${r.how && r.how !== "exact" ? ` (${matchHowLabel(r.how, r.candidate)})` : r.candidate != null ? ` \`${r.candidate}\`` : ""}${r.calc ? " — calc field, source not resolvable" : ""}`;

function tokenTable(rows) {
  return mdTable(
    ["program", "status", "template", "location", "token", "matched term", "matched via"],
    rows.map((r) => [
      programCell(r.program),
      statusCell(r.program),
      r.template ? `${r.template.title ?? "(untitled)"} (${r.template.id})` : "— (binding evidence only)",
      r.location,
      `\`${r.token}\``,
      r.term,
      tokenMatchedVia(r),
    ])
  );
}

function objectLevelTable(entries) {
  return mdTable(
    ["program", "status", "object(s)", "fields its filters actually reference"],
    entries.map((e) => [
      programCell(e.program),
      statusCell(e.program),
      [...new Set(e.rows.map((r) => r.objectName))].join(", "),
      [...new Set(e.rows.map((r) => r.fieldName ?? r.fieldLabel).filter(Boolean))].join(", ") || "—",
    ])
  );
}

// One provenance cell per resolved entry (ER-20), in markdown (report table)
// or plain form (CSV — no markup to strip, no "see detail below" pointing at
// a detail block a CSV doesn't have). Honest per kind: everything
// unresolvable says WHY.
export function provenanceCell(e, { md = true } = {}) {
  const id = e.collectionId != null ? (md ? `\`${e.collectionId}\`` : e.collectionId) : "—";
  if (e.kind === "data-designer")
    return e.resolved
      ? md
        ? `Data Designer **${e.label ?? "(unlabeled)"}** (${id}) — see detail below`
        : `Data Designer "${e.label ?? "(unlabeled)"}" (${id})`
      : `Data Designer ${id} — ${e.note}`;
  if (e.kind === "csv") return e.collectionId != null ? `CSV upload: ${e.collectionId}` : `CSV upload — ${e.note ?? "filename not recorded"}`;
  if (e.kind === "power-list") {
    const rid = e.ruleId != null ? (md ? `\`${e.ruleId}\`` : e.ruleId) : "—";
    if (!e.resolved) return `Power List ${rid} — ${e.note ?? "unresolved"}`;
    const objects = powerListObjectsSummary(e.powerList, e.objects ?? null);
    return md
      ? `Power List **${e.label ?? "(unnamed)"}** (rule ${rid}) — reads ${objects}; filters not returned by the CLI — see detail below`
      : `Power List "${e.label ?? "(unnamed)"}" (rule ${e.ruleId}) — reads ${objects}; filters not returned by the CLI`;
  }
  if (e.kind === "query") return `Dynamic query ${id} — ${e.note}`;
  const t = e.source.participantSourceType ?? e.source.type ?? "unknown";
  return md ? `source type \`${t}\` — no resolution rule; collectionId ${id}` : `source type ${t} — no resolution rule; collectionId ${id}`;
}

// "Contact (SFDC connection 74b…), Company (Gainsight)" — the objects a Power
// List's tasks read, each with where it reads them from (F-487). Derived
// tasks (merge/filter) read upstream datasets and are not objects.
export function powerListObjectsSummary(pl, objects = null) {
  const parts = [];
  const seen = new Set();
  for (const t of Array.isArray(pl?.tasks) ? pl.tasks : []) {
    if (t.objectName == null) continue;
    const o = canonicalObject(t.objectName, objects, t.objectLabel);
    const obj = o.objectLabel && o.objectLabel !== o.objectName ? `${o.objectLabel} (${o.objectName})` : o.objectName;
    const via = t.connection
      ? t.connection.type && INTERNAL_CONNECTION_IDS.has(t.connection.type) ? "Gainsight" : `connection ${t.connection.name ?? t.connection.id}`
      : "no connection recorded";
    const key = `${obj}\u0000${via}`;
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(`${obj} via ${via}`);
  }
  return parts.length ? parts.join(", ") : "no source object (tasks carry none)";
}

function provenanceSection(provenance) {
  const lines = [
    "## Participant-source provenance",
    "",
    "Where each matched program's participant source gets its data — resolved at report time from the KB, to the resolvable ceiling (see caveats for exactly where resolution stops).",
    "",
    mdTable(
      ["program", "status", "source", "source type", "provenance"],
      provenance.entries.map((e) => [
        programCell(e.program),
        statusCell(e.program),
        e.source.name ?? e.source.configId ?? "(unnamed source)",
        e.source.participantSourceType ?? e.source.type ?? "—",
        provenanceCell(e),
      ])
    ),
  ];
  // DD detail, deduped by collectionId (several programs can share one DD)
  const byDd = new Map();
  for (const e of provenance.entries) {
    if (e.kind !== "data-designer" || !e.resolved) continue;
    let d = byDd.get(e.collectionId);
    if (!d) {
      d = { ...e, programs: new Set(), ties: [] };
      byDd.set(e.collectionId, d);
    }
    d.programs.add(programCell(e.program));
    d.ties.push(...e.ties);
  }
  if (byDd.size) {
    lines.push("", "### Data Designer detail");
    for (const d of byDd.values()) {
      lines.push(
        "",
        `- **${d.label ?? "(unlabeled)"}** (\`${d.collectionId}\`) — used by ${[...d.programs].join("; ")}`,
        `  - description: ${d.description ?? NO_NAME}${d.dataStore ? ` · data store: ${d.dataStore}` : ""}`,
        `  - KB doc${d.docs.length === 1 ? "" : "s"}: ${d.docs.join(", ")}`
      );
      const seen = new Set();
      const ties = d.ties.filter((t) => {
        const k = `${t.column}\u0000${t.fieldName}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      if (ties.length)
        lines.push(
          `  - report column ↔ field dictionary: ` +
            ties
              .map(
                (t) =>
                  `\`${t.column}\` ↔ \`${t.fieldName ?? t.displayName}\` ` +
                  `(${t.displayName && t.displayName !== t.fieldName ? `"${t.displayName}", ` : ""}${t.dataType ?? "type unknown"})` +
                  `${t.how !== "exact" ? ` [${t.how}]` : ""}` +
                  // honesty: a column that reached the report via an object
                  // term was never matched by a field term — say so
                  `${t.matched === false ? " (source column — no field-term match)" : ""}`
              )
              .join(", ")
        );
      else if (d.fields.length)
        lines.push(`  - report column ↔ field dictionary: no dictionary field matched the report column(s) — field dictionary has ${d.fields.length} field(s)`);
    }
  }
  // Power List detail (F-487), deduped by rule id (program versions share
  // lists): each task's object, connection and output-field count, and the
  // standing fact that the filters are not in the payload.
  const byPl = new Map();
  for (const e of provenance.entries) {
    if (e.kind !== "power-list" || !e.resolved) continue;
    let d = byPl.get(e.ruleId);
    if (!d) {
      d = { ...e, programs: new Set() };
      byPl.set(e.ruleId, d);
    }
    d.programs.add(programCell(e.program));
  }
  if (byPl.size) {
    lines.push("", "### Power List detail");
    for (const d of byPl.values()) {
      const pl = d.powerList;
      lines.push(
        "",
        `- **${d.label ?? "(unnamed)"}** (rule \`${d.ruleId}\`${pl.active === false ? ", inactive" : ""}) — used by ${[...d.programs].join("; ")}`,
        `  - KB doc: ${d.docs.join(", ") || "—"}`
      );
      for (const t of pl.tasks) {
        const where = t.connection
          ? t.connection.type && INTERNAL_CONNECTION_IDS.has(t.connection.type) ? "Gainsight" : `connection ${t.connection.name ?? t.connection.id}`
          : null;
        const to = canonicalObject(t.objectName, d.objects, t.objectLabel);
        lines.push(
          t.derived
            ? `  - task "${t.datasetName ?? t.taskId ?? "?"}": derived from task ${t.upstreamTaskId} — ${t.fields.length} output field(s)`
            : `  - task "${t.datasetName ?? t.taskId ?? "?"}": ${to.objectLabel && to.objectLabel !== to.objectName ? `${to.objectLabel} (\`${to.objectName}\`)` : `\`${to.objectName ?? "?"}\``}` +
              `${where ? ` via ${where}` : ""} — ${t.fields.length} output field(s)` +
              (t.fields.length
                ? `: ${t.fields.slice(0, 12).map((f) => {
                    const fo = canonicalObject(f.objectName, d.objects, f.objectLabel);
                    return `${fo.objectName !== to.objectName ? `${fo.objectName}.` : ""}${f.fieldName ?? f.fieldLabel}`;
                  }).join(", ")}${t.fields.length > 12 ? ", …" : ""}`
                : "")
        );
      }
      lines.push(`  - filters: not returned by the CLI (\`re r describe\` carries no criteria for this rule type) — the list may filter these objects in ways this report cannot see`);
    }
  }
  return lines.join("\n");
}

function buildCaveats(index, opts, result, provenance) {
  const caveats = [];
  // same non-object guard as scanDeps — a malformed index entry the scan
  // tolerates must not crash the caveats step
  const allPrograms = Object.values(index.programs ?? {}).filter((p) => p && typeof p === "object");
  if (!opts.all) {
    const excluded = allPrograms.length - result.programs.length;
    if (excluded > 0)
      caveats.push(
        `Scope: active programs only — ${excluded} of ${allPrograms.length} program(s) NOT scanned. ` +
          `A schema change can still break inactive programs someone later reactivates; re-run with --all for full coverage.`
      );
  }
  // stale statuses matter in every scope: --all still renders a status column
  // (and the default scope is derived from statuses), so never gate this
  const kbStatusCount = allPrograms.filter((p) => p.statusSource !== "live").length;
  if (kbStatusCount > 0)
    caveats.push(
      `${kbStatusCount} of ${allPrograms.length} program statuses are KB-cached ` +
        `(${kbStatusCount === allPrograms.length ? "no" : "partial"} live sweep) — the scope and every status shown may rely on stale statuses; verify before acting.`
    );
  const stubIds = new Set(index.gaps?.stubs ?? []);
  const scannedStubs = result.programs.filter((p) => stubIds.has(p.id)).length;
  if (scannedStubs)
    caveats.push(`${scannedStubs} in-scope program doc(s) are stubs — participant sources unknown, not scannable.`);
  if (opts.objectTerms.length) {
    const covered = opts.liveObjects ?? new Set();
    // termKey on the lookup side too (F-197): the coverage set is termKey'd,
    // and a raw-lowered NFD or padded term here read a completed capture as
    // missing coverage — firing the strong caveat AND dropping the
    // read-together caveat in the same report that renders the live section.
    const uncovered = opts.objectTerms.filter((t) => !covered.has(termKey(t)));
    if (uncovered.length)
      caveats.push(
        `--object matching reads FILTER CONDITIONS, Power List task objects and output fields, dynamic fields and ` +
          `branch conditions (F-487) — C1 mappings carry no object names, so a program whose only use of an object is a ` +
          `CSV/Data Designer source's mapping (query-SELECT side) is INVISIBLE here, and in practice that can be the ` +
          `dominant usage kind on those source types (S5-V live validation found every JO dependent of the acceptance ` +
          `object was mapping-side: \`dm deps check\` named them all while this view showed none). Treat an empty ` +
          `--object result as "no usage found in the surfaces listed", never "no usage". Objects without live coverage ` +
          `in this run: ${uncovered.map((o) => `\`${o}\``).join(", ")} — capture each with the corroboration command ` +
          `below and pass it back via \`--live-deps <file>\` to render the object-level truth in this report. A rendered ` +
          `live section whose payload objectName differs from the term does NOT count as its coverage (the term may be ` +
          `the object's label — re-capture with the exact system name), and neither does an incomplete capture.`
      );
    else
      caveats.push(
        `The participant-source table above reads filter conditions, Power List objects/fields, dynamic fields and ` +
          `branch conditions (C1 mappings carry no object names); the "Live dependents" section(s) supply the ` +
          `mapping/SELECT-side usage from \`dm deps check\` — read them together.`
      );
  }
  // ER-21/ER-23 honesty pair — shared wording (aliasFieldCaveats) so the two
  // deps surfaces can never drift on what they disclaim.
  caveats.push(
    ...aliasFieldCaveats({
      hasFieldTerms: opts.fieldTerms.length > 0,
      aliasActive: Boolean(opts.aliasPrefix),
      nearMisses: result.nearMisses ?? [],
      conventionNote: opts.aliasConventionNote ?? null,
      unsetWhy: opts.aliasUnsetWhy ?? null,
      unsetHome: opts.aliasUnsetHome ?? null,
      unsetPath: opts.aliasUnsetPath ?? null,
    })
  );
  if (opts.fieldTerms.length && !opts.tokens)
    caveats.push(`Email-body \${...} tokens were NOT scanned — re-run with --scan-tokens to include rendered-in-email usage.`);
  // ER-19 (ruled P-2): the old "0 token hits is NOT evidence" caveat is
  // REPLACED — the scan now resolves GUID tokens through program bindings, so
  // the true remaining limit is KB coverage, stated below. The claim is only
  // made when the index actually carries binding data: an index built by a
  // pre-C1v2 plugin has NO step tokens[] field, and asserting bindings were
  // resolved against it would be falsely reassuring.
  if (opts.tokens) {
    const scannedSteps = result.programs.flatMap((p) => (Array.isArray(p.steps) ? p.steps : []));
    const preV2 = scannedSteps.length > 0 && !scannedSteps.some((s) => s && typeof s === "object" && "tokens" in s);
    if (preV2)
      caveats.push(
        `--scan-tokens: NO step in this index carries token bindings (the "tokens" field is absent) — the index was ` +
          `likely built by a plugin older than 0.22.0, so binding resolution could not run and only literal token text ` +
          `was matched. Re-run \`jo-report.mjs index\` with the current plugin before trusting token results.`
      );
    else
      caveats.push(
        `--scan-tokens resolves each program's own token bindings to their bound field (both program generations) and ` +
          `also matches literal token text. Coverage limit: token rows fire only for programs whose journey docs are ` +
          `full-depth in the KB, and locations come from templates with captured KB docs — bindings in stub program docs ` +
          `are invisible, and missing/metadata-only template docs are counted in their own caveats when present.`
      );
  }
  if (result.missingTemplates.length)
    caveats.push(
      `--scan-tokens: ${result.missingTemplates.length} referenced template(s) have no KB doc — their tokens could not be scanned ` +
        `(fetch each with \`gs-admin --json jo email template --id '<id>'\`).`
    );
  if (result.metadataOnlyTemplates?.length)
    caveats.push(
      `--scan-tokens: ${result.metadataOnlyTemplates.length} scanned template doc(s) are metadata-only (no captured body) — ` +
        `subjects were scanned but body/variant tokens could not be seen; a token miss there is silent.`
    );
  // ER-20 provenance honesty set (ruled P-2, 2026-07-16)
  if (provenance?.preV2)
    caveats.push(
      `Participant-source provenance could NOT be resolved: no source in this index carries provenance pointers ` +
        `(the \`participantSourceCollectionId\` field is absent) — the index was likely built by a plugin older than ` +
        `0.22.0 (C1 v2). Re-run \`jo-report.mjs index\` with the current plugin.`
    );
  if (provenance?.result?.kbNeeded)
    caveats.push(
      `Data Designer provenance was NOT resolved this run: the tenant KB directory could not be located ` +
        `(index slug \`${index.slug ?? "unknown"}\` does not exist relative to the working directory) — ` +
        `re-run with \`--kb <slugDir>\` pointing at the tenant KB.`
    );
  if (provenance?.result?.missingDocs?.length) {
    // one caveat per Data Designer, naming the exact fetch per problem doc —
    // a missing/unreadable DD doc must be actionable, never an empty column
    // (ruled). resolveProvenance already dedupes per (collectionId, folder).
    const byId = new Map();
    for (const m of provenance.result.missingDocs) {
      if (!byId.has(m.collectionId)) byId.set(m.collectionId, []);
      byId.get(m.collectionId).push(m);
    }
    for (const [id, ms] of byId) {
      // "is missing" only when every problem is a plain doc gap — a wrong-id
      // doc or a filesystem error is NOT a missing doc and must not be
      // dressed as one (F-198)
      const plainGap = ms.every((m) => m.reason === "missing" || m.reason === "unparseable");
      const item = (m) =>
        m.reason === "unparseable"
          ? `\`${m.path}\` — exists but could not be parsed; re-fetch with \`${m.fetch}\``
          : m.reason === "wrong-id"
            ? `\`${m.path}\` — the doc at this filename belongs to a different id (\`${m.otherId}\`, case collision); fetch this one with \`${m.fetch}\``
            : m.reason === "fs-error"
              ? `\`${m.path}\` — could not be checked (${m.detail}); fix the filesystem problem and re-run`
              : `\`${m.path}\` — fetch with \`${m.fetch}\``;
      caveats.push(
        `Data Designer \`${id}\` (source '${ms[0].sourceName}' of ${ms[0].programName}) ` +
          (plainGap ? `is missing ${ms.length === DD_DOC_LOOKUPS.length ? "its KB docs" : `a KB doc`}: ` : `has KB doc problems: `) +
          ms.map(item).join("; ") +
          (ms[0].resolved
            ? ` — the Data Designer still resolved from its other doc; fetching fills in the remaining detail.`
            : ms.every((m) => m.reason === "fs-error")
              ? ``
              : ` — then document via describe-batch and re-run.`)
      );
    }
  }
  // Unresolved Power Lists (F-487; from the SCAN since the second reopen —
  // every in-scope program, whatever matched): one caveat per rule id naming
  // the programs that reference it and the remedy — refresh re-documents
  // every referenced rule whose doc is not readable on disk.
  if (result.powerListProblems?.length) {
    const folder = opts.powerLists?.folder ?? RECORDED_LANES.rules.folder;
    for (const p of result.powerListProblems) {
      const what =
        p.reason === "no-kb" ? `could not be looked up — the KB directory was not located (re-run with \`--kb <slugDir>\`)`
          : p.reason === "wrong-id" ? `\`${p.rel}\` belongs to a different id (\`${p.otherId}\`, case collision)`
            : p.reason === "fs-error" ? `\`${p.rel}\` could not be checked (${p.detail}); fix the filesystem problem and re-run`
              : p.reason === "not-a-power-list" ? `\`${p.rel}\` exists but is not a Power List rule doc (ruleType is not ${POWER_LIST_RULE_TYPE})`
                : p.reason === "unparseable" ? `\`${p.rel}\` exists but could not be parsed`
                  : `has no readable KB doc under ${folder}/`;
      const who = p.programs.map((q) => `${q.name ?? "(unnamed)"} (${q.id})`).join("; ");
      caveats.push(
        `Power List rule \`${p.ruleId}\` (source '${p.sourceName}', referenced by ${p.programs.length} in-scope program(s): ${who}) ${what} — ` +
          `those programs' Power List objects, connection and output fields are NOT in this report, so an --object or --field search cannot match them through that source ` +
          `and their absence from the tables above is not evidence. ` +
          `Run \`/gs-superadmin:refresh\` (its Power List step re-documents every referenced rule whose doc is not readable on disk, whatever the manifest says; ` +
          `the one-off fetch is \`gs-admin --json re r describe --id ${sq(p.ruleId)}\`, documented via describe-batch into the rules domain), then re-run.`
      );
    }
  }
  if (provenance?.result?.entries?.length) {
    // standing where-resolution-stops caveat (ruled) — the per-kind sentences
    // only claim limits about source kinds this report actually contains
    const kinds = new Set(provenance.result.entries.map((e) => e.kind));
    const parts = [
      `Where provenance resolution STOPS (by design, ruled P-2 2026-07-16): resolution ends at the participant ` +
        `source's own asset — the external-connection hop is UNREACHABLE via the CLI and is never guessed.`,
    ];
    if (kinds.has("data-designer"))
      parts.push(
        `A Data Designer *design* has no describe surface (only its produced dataset does) and dataset columns carry ` +
          `no lookup provenance, so which external system feeds a Data Designer is stated only when the DD's own ` +
          `name/label/description says it, and is never inferred from payload text (payloads mention connector names ` +
          `in unrelated UI metadata).`
      );
    if (kinds.has("power-list") && provenance.objects && provenance.objects.size === 0)
      caveats.push(
        `Gainsight objects named by Power Lists could NOT be canonicalized: the KB holds no readable data-management doc ` +
          `(folder ${provenance.objects.folder}/: ${provenance.objects.stats.folderPresent ? `${provenance.objects.stats.docs} doc(s), ${provenance.objects.stats.parsed} with an object identity` : "absent"}) — ` +
          `those rows carry the GSID the payload names and only a GSID or payload-label term matches them; index the data-management domain (setup) and re-run for system-name matching.`
      );
    if (kinds.has("power-list"))
      parts.push(
        `A Power List (QUERY_BUILDER source) resolves to the objects, connection and output fields its rule's tasks READ ` +
          `(the rule is hidden from \`re r list\` and described by its \`ruleId\`); its FILTER criteria are not returned by the ` +
          `CLI (\`re r describe\` carries no criteria for this rule type — upstream KI-027), so a match means the list reads the ` +
          `object, never how it filters it, and a filter on an object the list does not read is invisible.`
      );
    if (kinds.has("query"))
      parts.push(
        `A dynamic program's own participant query (QUERY source) is returned by no CLI command — only the program's ` +
          `dynamic fields and branch conditions name objects, and they are scanned as usage rows; the query itself is unseen.`
      );
    caveats.push(parts.join(" "));
  }
  // A COMPLETED capture is the corroboration this caveat asks for, so its
  // object leaves the list, whichever list names it (#28 — the tenant-wide
  // surface got the same rule in #31). termKey'd like the coverage set (F-197).
  const liveCovered = opts.liveObjects ?? new Set();
  const corroborate = (result.objectsTouched.length ? result.objectsTouched : opts.objectTerms).filter(
    (o) => !liveCovered.has(termKey(o))
  );
  if (corroborate.length)
    caveats.push(
      `KB-derived, JO-scoped view — corroborate live and cross-area with ` +
        corroborate.map((o) => `\`gs-admin --json dm deps check --name ${sq(o)} --areas JOURNEY_ORCHESTRATOR\``).join(", ") +
        `; discrepancies belong in this section.`
    );
  return caveats;
}

// ── CLI entry (dispatcher contract: export run(argv)) ────────────────────────
// sq/shq are the doc-lib copies (F-123) — the escape rule lives in exactly one
// place, now for the whole plugin rather than per file.

const USAGE =
  "usage: jo-report.mjs deps --index <er-index.json> [--object <o>]... [--field <f>]... " +
  "[--kb <slugDir>] [--alias-prefix <regex>] [--scan-tokens] [--live-deps <deps-check.json>]... [--all | --active-only] [--include-paused] " +
  "--report <dir> [--csv-dir <dir>] (at least one --object/--field)";

export async function run(argv) {
  let flags;
  try {
    flags = parseFlags(argv, {
      repeatable: [...C3_REPEATABLE, "live-deps"],
      boolean: [...C3_BOOLEAN, "scan-tokens"],
    });
  } catch (e) {
    fail(`${e.message}\n${USAGE}`);
  }
  const rawObjects = flags.object ?? [];
  const rawFields = flags.field ?? [];
  if (!flags.index || !flags.report || (!rawObjects.length && !rawFields.length)) fail(USAGE);
  if (flags.all && flags["active-only"]) fail(`--all and --active-only contradict each other\n${USAGE}`);
  // an empty term can never exact-match anything — a confidently empty
  // report, so reject loudly; duplicates dedupe with a warning (search's
  // rule), case-insensitively since matching is too (first spelling wins)
  if ([...rawObjects, ...rawFields].some((t) => !String(t).trim())) fail("--object/--field terms must be non-empty");
  const dedupeTerms = (list) => {
    const seen = new Set();
    return list.filter((t) => {
      const k = termKey(t); // NFC fold first (F-197) — NFD/NFC spellings are the same term, exactly as matching treats them
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };
  const objectTerms = dedupeTerms(rawObjects);
  const fieldTerms = dedupeTerms(rawFields);
  const warnings = [];
  const dups = rawObjects.length - objectTerms.length + (rawFields.length - fieldTerms.length);
  if (dups) warnings.push(`${dups} duplicate --object/--field term(s) dropped`);

  const opts = {
    objectTerms,
    fieldTerms,
    all: flags.all === true,
    includePaused: flags["include-paused"] === true,
    tokens: flags["scan-tokens"] === true,
  };
  if (opts.tokens && !fieldTerms.length)
    warnings.push("--scan-tokens has no effect without --field terms (tokens are matched against field terms only)");

  // --kb (ER-20): the tenant KB dir for Data Designer doc lookups. Explicit
  // flag wins and must exist (a bad path silently degrading to "unresolved"
  // would be a silent wrong answer); otherwise derived from the index — C1
  // docPaths are slug-relative, so index.slug resolved against the CWD is the
  // KB dir exactly when it exists (kbDocDisplayPath's assumption). The gate
  // is doc-lib's requireKbDir — the one copy both deps surfaces run (F-310).
  requireKbDir(flags.kb, fail);

  // Fail-fast (F-321): an invalid EXPLICIT --alias-prefix refuses BEFORE the
  // index load — the C1 index can run to ~100 MB, and this validation needs
  // nothing but the flag (origin/main compiled it at flag parse; DS-27's
  // unification moved the only compile after loadIndex). resolveAliasPrefix
  // below recompiles the same tiny regex through the one shared
  // compileAliasPrefix, so the two calls cannot drift.
  if (flags["alias-prefix"] != null) {
    try {
      compileAliasPrefix(flags["alias-prefix"]);
    } catch (e) {
      fail(`${e.message}\n${USAGE}`);
    }
  }

  const index = loadIndex(flags.index);
  const kbDir = flags.kb ?? (index.slug && existsSync(resolve(String(index.slug))) ? String(index.slug) : null);

  // Alias pattern in force (ER-21/ER-23; DS-27): explicit --alias-prefix wins
  // — an invalid EXPLICIT regex fails loudly, a silently-dropped pattern
  // would be a silent exact-only run — otherwise the workspace conventions
  // read (readAliasConvention above; malformed → exact-only, surfaced, never
  // guessed).
  let aliasRes = null;
  try {
    // kbDir is OPTIONAL in this mode — with no --kb and an unresolvable
    // index slug, fall back to the cwd so the workspace walk-up still runs
    // (review round: the pre-DS-27 skill prose read CONVENTIONS.md relative
    // to the session cwd with no KB dir at all; anchoring the read solely on
    // the KB-doc-lookup parameter silently disabled aliasing).
    aliasRes = resolveAliasPrefix({ explicit: flags["alias-prefix"], hasFieldTerms: fieldTerms.length > 0, kbDir: kbDir ?? "." });
  } catch (e) {
    fail(`${e.message}\n${USAGE}`);
  }
  const aliasPrefix = aliasRes.prefix;
  opts.aliasPrefix = aliasPrefix;
  opts.aliasConventionNote = aliasRes.note;
  opts.aliasUnsetWhy = aliasRes.unsetWhy;
  opts.aliasUnsetHome = aliasRes.home ?? null;
  opts.aliasUnsetPath = aliasRes.path ?? null;
  if (aliasRes.note) warnings.push(aliasRes.note);
  if (aliasPrefix && !fieldTerms.length)
    warnings.push("--alias-prefix has no effect without --field terms (aliasing applies to field matching only)");

  // F-487: Power List rule docs live in the rules lane; the folder is the
  // one the index build resolved from the workspace's recordings (the report
  // modes read the index, never the KB folders), the lane default otherwise.
  // One resolver serves the scan (usage rows) and the provenance pass.
  const powerLists = makePowerListResolver({ kbDir, folder: index.domains?.dirs?.rules ?? RECORDED_LANES.rules.folder });
  opts.powerLists = powerLists;
  // The Gainsight object registry (F-487 reopen): identities a Power List
  // names by GSID are canonicalized through the data-management lane, so a
  // system name, a label or a GSID term all reach the same programs.
  const objects = makeObjectResolver({ kbDir, folder: index.domains?.dirs?.objects ?? RECORDED_LANES.objects.folder });
  opts.objects = objects;
  const ddFolders = { datasets: index.domains?.dirs?.datasets ?? null, objects: index.domains?.dirs?.objects ?? null };
  const result = scanDeps(index, opts);

  // ER-20: resolve provenance for every source the report names. Pre-C1v2
  // indexes carry no pointers at all — that is a loud caveat, never a quiet
  // table of empty cells.
  const scannedSources = result.programs
    .flatMap((p) => (Array.isArray(p.sources) ? p.sources : []))
    .filter((s) => s && typeof s === "object");
  const provPreV2 = scannedSources.length > 0 && !scannedSources.some((s) => Object.hasOwn(s, "participantSourceCollectionId"));
  const provSources = provPreV2 ? [] : collectProvenanceSources(result);
  const provResult = provSources.length ? resolveProvenance(provSources, { kbDir, aliasPrefix, powerLists, ddFolders, objects }) : null;
  const provenance = { preV2: provPreV2, result: provResult, objects };

  // --live-deps: captured dm-deps-check payloads → reconciled live sections.
  // The intake loop (warn-and-skip contract) is the shared
  // readLiveDepsCaptures (F-311); this mode parameterizes the JO-scoped
  // parser and its termKey compare (F-197 — a raw compare warned on NFD/NFC
  // or padded spellings of the very object the capture was for), then
  // reconciles each capture against the KB scan.
  const liveDeps = readLiveDepsCaptures(
    flags["live-deps"],
    { parse: parseLiveDeps, matchesObjectTerm: (name) => objectTerms.some((t) => termKey(t) === termKey(name)) },
    warnings
  ).map((parsed) => reconcileLiveDeps(parsed, index, result));
  // Coverage (which --object terms may drop the strong filter-only caveat)
  // counts COMPLETE captures only: an INIT/partial capture still renders its
  // section — with the incompleteness banner — but must not soften the caveat.
  // termKey'd (F-197): the uncovered filter in buildCaveats keys on termKey,
  // so an unfolded producer here made a completed capture invisible to it.
  opts.liveObjects = new Set(
    liveDeps.filter((l) => l.complete).map((l) => termKey(l.objectName ?? "")).filter(Boolean)
  );

  const caveats = buildCaveats(index, opts, result, provenance);

  const scopeLine = opts.all
    ? `all programs (--all)`
    : `active programs (PROCESSING${opts.includePaused ? " + PAUSE" : ""})`;
  // The report header must name the matching semantics in force — with an
  // alias pattern, exactly which one; without, that none was supplied (ER-23).
  const matchingLine = aliasMatchingLine(aliasRes, fieldTerms.length > 0);
  const summarySection = [
    "## Summary",
    "",
    `- terms: ${[...objectTerms.map((t) => `object \`${t}\``), ...fieldTerms.map((t) => `field \`${t}\``)].join(", ")} — ${matchingLine}`,
    `- scope: ${scopeLine} — ${result.programs.length} program(s) scanned (of ${Object.keys(index.programs ?? {}).length} in the index)`,
    `- field-level usage rows: ${result.fieldRows.length}${opts.tokens ? ` · email-token rows: ${result.tokenRows.length}` : ""}`,
    `- programs with object-level-only matches: ${result.objectLevel.length}`,
    `- distinct objects touched: ${result.objectsTouched.length ? result.objectsTouched.join(", ") : "none"}`,
  ].join("\n");

  const sections = [summarySection];
  sections.push(
    result.fieldRows.length
      ? ["## Usage (participant sources)", "", usageTable(result.fieldRows)].join("\n")
      : "## Usage (participant sources)\n\n_no participant-source usage matched — check the caveats below for what was not scannable_"
  );
  if (opts.tokens)
    sections.push(
      result.tokenRows.length
        ? ["## Email-token usage (--scan-tokens)", "", tokenTable(result.tokenRows)].join("\n")
        : "## Email-token usage (--scan-tokens)\n\n_no ${...} tokens matched the field terms_"
    );
  if (result.objectLevel.length)
    sections.push(
      [
        "## Object-level matches (no field-term hit)",
        "",
        "These programs filter on a matched object but none of the given field terms — the object is in use even though the specific fields were not found.",
        "",
        objectLevelTable(result.objectLevel),
      ].join("\n")
    );
  if (provResult) sections.push(provenanceSection(provResult));
  for (const live of liveDeps) {
    const lines = [
      `## Live dependents of \`${live.objectName ?? "(unknown object)"}\` (dm deps check)`,
      "",
      `Gainsight's own dependency scan — the object-level truth, including mapping/SELECT-side usage the participant-source scan above cannot see. ` +
        `${live.rows.length} JO dependent(s); ${live.rows.length - live.liveOnly} also matched above; ${live.liveOnly} live-only.`,
      "",
    ];
    if (!live.complete)
      lines.push("**⚠ capture incomplete** — the check's progressStatus was not COMPLETED; this list may be partial. Re-capture and re-run.", "");
    lines.push(
      live.rows.length
        ? mdTable(
            ["program", "status", "in KB report above?", "referenced columns"],
            live.rows.map((r) => [
              `${r.name} (${r.id ?? "id unknown"})`,
              r.status,
              r.inKbReport ? "yes" : "no — mapping/SELECT-side only",
              r.columns.join(", ") || "—",
            ])
          )
        : "_no JO dependents reported live_"
    );
    sections.push(lines.join("\n"));
  }

  const modeArgs = [
    ...objectTerms.map((t) => `--object ${shq(t)}`),
    ...fieldTerms.map((t) => `--field ${shq(t)}`),
    flags.kb != null ? `--kb ${shq(flags.kb)}` : null,
    // argv-faithful: the flag appears only when the user passed it — a
    // conventions-supplied pattern is re-read from CONVENTIONS.md on re-run
    flags["alias-prefix"] != null ? `--alias-prefix ${shq(flags["alias-prefix"])}` : null,
    opts.tokens ? "--scan-tokens" : null,
    ...(flags["live-deps"] ?? []).map((f) => `--live-deps ${shq(f)}`),
    opts.all ? "--all" : null,
    opts.includePaused ? "--include-paused" : null,
  ].filter(Boolean);
  // The shared tail (rerun line, POSIX-quote caveat, report write, CSV dir)
  // lives in jo-report.mjs — F-362; the corroborate/DD re-fetch hints inside
  // caveats and the section hints are scanned for the caveat along with it
  const { outPath, csvDir } = writeModeReport({ mode: "deps", flags, modeArgs, sections, caveats, warnings, index });
  if (csvDir) {
    writeFileSync(
      join(csvDir, "deps-usages.csv"),
      toCsv(
        ["program_id", "program_name", "status", "status_source", "source", "usage_class", "object", "field", "label", "matched_term", "matched_how", "detail"],
        result.fieldRows.map((r) => [
          r.program.id, r.program.name, r.program.status, r.program.statusSource,
          r.source, r.usage, r.objectName, r.fieldName, r.fieldLabel, r.matchedTerm,
          matchHowLabel(r.matchedHow, r.matchedCandidate),
          r.detail,
        ])
      ),
      "utf8"
    );
    // token rows have their own column meanings (template/location/token), so
    // they get their own CSV rather than overloading the usages columns
    if (opts.tokens)
      writeFileSync(
        join(csvDir, "deps-tokens.csv"),
        toCsv(
          ["program_id", "program_name", "status", "status_source", "template_id", "template_title", "location", "token", "matched_term", "matched_via"],
          result.tokenRows.map((r) => [
            r.program.id, r.program.name, r.program.status, r.program.statusSource,
            r.template?.id, r.template?.title, r.location, r.token, r.term,
            tokenMatchedVia(r),
          ])
        ),
        "utf8"
      );
    if (liveDeps.length)
      writeFileSync(
        join(csvDir, "deps-live-dependents.csv"),
        toCsv(
          ["object", "program_id", "program_name", "status", "in_kb_report", "referenced_columns", "capture_complete"],
          liveDeps.flatMap((live) =>
            live.rows.map((r) => [
              live.objectName, r.id, r.name, r.status, r.inKbReport ? "yes" : "no", r.columns.join("; "), live.complete ? "yes" : "no",
            ])
          )
        ),
        "utf8"
      );
    writeFileSync(
      join(csvDir, "deps-object-level.csv"),
      toCsv(
        ["program_id", "program_name", "status", "objects", "fields_referenced"],
        result.objectLevel.map((e) => [
          e.program.id,
          e.program.name,
          e.program.status,
          [...new Set(e.rows.map((r) => r.objectName))].join("; "),
          [...new Set(e.rows.map((r) => r.fieldName ?? r.fieldLabel).filter(Boolean))].join("; "),
        ])
      ),
      "utf8"
    );
    // ER-20: one row per matched (program, source) with its resolved
    // provenance — mirrors the report's provenance section
    if (provResult)
      writeFileSync(
        join(csvDir, "deps-sources.csv"),
        toCsv(
          ["program_id", "program_name", "status", "source", "source_type", "operation_type", "collection_id", "rule_id", "provenance", "dd_label", "dd_description", "dd_kb_docs", "column_ties"],
          provResult.entries.map((e) => [
            e.program.id,
            e.program.name,
            e.program.status,
            e.source.name ?? e.source.configId,
            e.source.participantSourceType ?? e.source.type,
            e.operationType,
            e.collectionId,
            e.ruleId,
            provenanceCell(e, { md: false }),
            e.label,
            e.description,
            e.docs.join("; "),
            e.ties.map((t) => `${t.column} <-> ${t.fieldName ?? t.displayName}`).join("; "),
          ])
        ),
        "utf8"
      );
  }

  emitSummary({
    mode: "deps",
    reportPath: outPath,
    ...(csvDir ? { csvDir } : {}),
    counts: {
      programsIndexed: Object.keys(index.programs ?? {}).length,
      programsScanned: result.programs.length,
      fieldUsageRows: result.fieldRows.length,
      filterRows: result.fieldRows.filter((r) => r.kind === "condition").length,
      showFieldRows: result.fieldRows.filter((r) => r.kind !== "condition").length,
      aliasMatchedRows: result.fieldRows.filter((r) => r.matchedHow && r.matchedHow !== "exact").length,
      nearMissFields: (result.nearMisses ?? []).reduce((n, e) => n + e.names.length, 0),
      tokenRows: result.tokenRows.length,
      tokenBindingRows: result.tokenRows.filter((r) => r.handle && r.handle !== "token text").length,
      objectLevelPrograms: result.objectLevel.length,
      provenanceSources: provResult?.entries.length ?? 0,
      ddResolved: provResult?.entries.filter((e) => e.kind === "data-designer" && e.resolved).length ?? 0,
      ddDocsMissing: provResult?.missingDocs.length ?? 0,
      csvSources: provResult?.entries.filter((e) => e.kind === "csv").length ?? 0,
      powerListSources: provResult?.entries.filter((e) => e.kind === "power-list").length ?? 0,
      // F-487: Power Lists resolved to their rule doc vs. unresolved rule ids
      // (one per id — the remedy caveat names each), plus the usage rows the
      // new surfaces contributed, so a run can see whether they fired at all
      powerListsResolved: provResult?.entries.filter((e) => e.kind === "power-list" && e.resolved).length ?? 0,
      powerListRulesMissing: result.powerListProblems.length, // from the scan of every in-scope program (second reopen)
      // F-487 reopen: the registry the Power List object identities were canonicalized through
      objectRegistryDocs: objects.stats.docs,
      objectRegistrySize: objects.size,
      powerListRows: result.fieldRows.filter((r) => r.kind === "power-list-object" || r.kind === "power-list-field").length,
      dynamicFieldRows: result.fieldRows.filter((r) => r.kind === "dynamic-field" || r.usage === "dynamic-field filter").length,
      branchConditionRows: result.fieldRows.filter((r) => r.kind === "branch-condition").length,
      querySources: provResult?.entries.filter((e) => e.kind === "query").length ?? 0,
      liveDependents: liveDeps.reduce((n, l) => n + l.rows.length, 0),
      liveOnlyDependents: liveDeps.reduce((n, l) => n + l.liveOnly, 0),
    },
    aliasPrefix: aliasRes.source,
    ...(liveDeps.length
      ? {
          liveDeps: liveDeps.map((l) => ({
            objectName: l.objectName,
            complete: l.complete,
            dependents: l.rows.length,
            liveOnly: l.liveOnly,
          })),
        }
      : {}),
    objectsTouched: result.objectsTouched,
    caveatCount: caveats.length,
    warnings,
  });
}
