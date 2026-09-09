#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// jo-report-deps.mjs (test) — fixture tests for scripts/jo-report-deps.mjs
// (ER-7 of the email-report program).
//
// Covers: the S3-confirmed exact case-insensitive name-OR-label matching (no
// substring), show-field vs filter classification on synthetic source
// configs (standard mapping keys/values, customMappings strings, condition
// name/label with operator detail), the active-only default scope vs --all
// vs --include-paused, the separate object-level-only section (a program
// with BOTH keeps its object-matched rows in the main table), ${...} token
// scanning behind --scan-tokens (dot-segment matching, variant locations,
// missing-template and metadata-only caveats), the mappings-carry-no-objects
// and dm-deps-check-corroboration caveats, report/CSV output through the C3
// dispatcher, and usage errors. ER-20 participant-source provenance: KB doc
// parsers (designer field dictionary + dm object doc), source classification,
// field-dictionary ties (alias-aware, both directions), report-time
// resolution of DATA_DESIGNER/CSV/QUERY_BUILDER sources, the missing-doc and
// where-resolution-stops caveats, --kb + the derive-from-slug fallback, and
// the pre-C1v2 rebuild caveat. F-197 termKey routing (NFD/padded term dedupe,
// the --live-deps objectName warning, the live coverage set) and F-198 doc
// identity (case-collision loser honest-unresolved, fs-error vs missing, the
// found-spelling problem path).
// Fixture is a hand-built C1 v1 index under the OS temp dir; all data
// fictional.
//
// Run:  node plugins/gs-superadmin/test/jo-report-deps.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import {
  eqTerm,
  compileAliasPrefix,
  readAliasConvention,
  resolveAliasPrefix,
  aliasMatchingLine,
  prepFieldTerm,
  fieldTermMatch,
  isNearMiss,
  usageCandidates,
  matchFieldTerm,
  matchObjectTerm,
  tokenCandidates,
  scanTokens,
  tokenSpellings,
  tokenMatchedVia,
  scanDeps,
  parseLiveDeps,
  parseLiveDepsAreas,
  reconcileLiveDeps,
  parseDesignerFieldsDoc,
  parseDmObjectDoc,
  classifySource,
  collectProvenanceSources,
  tieToFieldDictionary,
  resolveProvenance,
} from "../scripts/jo-report-deps.mjs";
import { parseJourneyDoc } from "../scripts/jo-report.mjs";
import { docBaseName, docNameClaimer } from "../scripts/doc-lib.mjs";

const JO_REPORT = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "jo-report.mjs");
const ROOT = join(tmpdir(), `gs-superadmin-jo-report-deps-${process.pid}`);
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

// ── matching primitives ──────────────────────────────────────────────────────

check("eqTerm: exact case-insensitive", eqTerm("ARR", "arr") && eqTerm("arr", "arr") && eqTerm("  ARR ", "arr"), null);
check("eqTerm: NO substring (S3 rule)", !eqTerm("ARR Total", "arr") && !eqTerm("ARR", "ar"), null);
check("eqTerm: null never matches", !eqTerm(null, "arr") && !eqTerm(undefined, ""), null);
{
  // F-127: NFD value equals its NFC spelling on every compare chokepoint —
  // codepoints via fromCharCode (the F-130 rule).
  const nfdCafe = "Cafe" + String.fromCharCode(0x301);
  const nfcCafeLower = "caf" + String.fromCharCode(0xe9);
  check("eqTerm: NFD value equals NFC term (F-127)", eqTerm(nfdCafe, nfcCafeLower), null);
  check("fieldTermMatch: NFD candidate hits NFC-prepped term (F-127)", fieldTermMatch(nfdCafe, prepFieldTerm("Caf" + String.fromCharCode(0xe9)))?.how === "exact", null);
}

// ── alias-aware field matching (ER-21/ER-22 shared primitives) ───────────────

{
  check("compileAliasPrefix: absent/blank → null (exact-only mode)", compileAliasPrefix(undefined) === null && compileAliasPrefix("") === null && compileAliasPrefix("  ") === null, null);
  let threw = null;
  try { compileAliasPrefix("(["); } catch (e) { threw = e.message; }
  check("compileAliasPrefix: invalid regex throws (never silently exact-only)", /not a valid regular expression/.test(threw ?? ""), threw);
  const alias = compileAliasPrefix("^[A-Z]_");
  const unanchored = compileAliasPrefix("[A-Z]_");
  const t = prepFieldTerm("Renewal ID");

  check("fieldTermMatch: exact hit needs no alias", fieldTermMatch("renewal id", t)?.how === "exact" && fieldTermMatch(" Renewal ID ", t, alias)?.how === "exact", null);
  check("fieldTermMatch: without alias, prefixed/underscored candidates do NOT match (today's behavior)", fieldTermMatch("A_Renewal ID", t) === null && fieldTermMatch("Renewal_ID", t) === null, null);
  check("fieldTermMatch: task-alias strip (prefix on the CANDIDATE only)", fieldTermMatch("A_Renewal ID", t, alias)?.how === "task-alias" && fieldTermMatch("B_Renewal ID", t, alias)?.how === "task-alias", null);
  check("fieldTermMatch: separator equivalence (space↔underscore)", fieldTermMatch("Renewal_ID", t, alias)?.how === "separator-equivalent" && fieldTermMatch("A_Renewal_ID", t, alias)?.how === "task-alias", null);
  check(
    "fieldTermMatch: separator equivalence works term-side too",
    fieldTermMatch("X_Contract Value", prepFieldTerm("Contract_Value"), alias)?.how === "task-alias",
    null
  );
  check(
    "fieldTermMatch: NEVER substring, even in alias mode",
    fieldTermMatch("Renewal IDX", t, alias) === null &&
      fieldTermMatch("X_Renewal", t, alias) === null &&
      fieldTermMatch("Q_Renewal ID Extra", t, alias) === null &&
      fieldTermMatch("Big Renewal ID Report", t, alias) === null,
    null
  );
  check("fieldTermMatch: prefix pattern is applied as declared (case-sensitive `^[A-Z]_`; `AB_` is not `[A-Z]_`)", fieldTermMatch("a_Renewal ID", t, alias) === null && fieldTermMatch("AB_Renewal ID", t, alias) === null, null);
  check("fieldTermMatch: unanchored pattern is auto-anchored (no interior stripping)", fieldTermMatch("X_Renewal ID", t, unanchored)?.how === "task-alias" && fieldTermMatch("RenewalX_ ID", t, unanchored) === null, null);
  check("fieldTermMatch: candidate that is ONLY a prefix never matches", fieldTermMatch("A_", prepFieldTerm("A_"), alias)?.how === "exact" && fieldTermMatch("A_", t, alias) === null, null);

  check(
    "isNearMiss: related-but-different name contains the term's significant words",
    isNearMiss("Most_Recent_Related_Renewal_Stage", t) === true && isNearMiss("Renewal IDX", t) === true,
    null
  );
  check(
    "isNearMiss: word-boundary matching — no shared word means no near-miss",
    isNearMiss("Contract Amount", t) === false && isNearMiss("determine", prepFieldTerm("term")) === false && isNearMiss(null, t) === false,
    null
  );
}

// ── readAliasConvention / resolveAliasPrefix (GP-B5 DS-27) ───────────────────
// The scripts read the tenant's field-aliasing convention themselves; the
// grammar is the shipped templates/CONVENTIONS.md shape. Missing/unset →
// exact-only; malformed → exact-only + surfaced why; NEVER a guessed pattern.
{
  const WS = join(ROOT, "conv-ws");
  const KB = join(WS, "acme-kb");
  mkdirSync(join(WS, ".gs-superadmin"), { recursive: true });
  mkdirSync(join(KB, "rules-engine"), { recursive: true });
  const CONV = join(WS, ".gs-superadmin", "CONVENTIONS.md");
  // The section body mirrors the template's hazards: intro prose, a QUOTED
  // instruction line repeating the bullet key (must never parse — the bullet
  // grammar is line-anchored), and the italic example line carrying a
  // backticked regex (must never be read as the value).
  const SECTION = (bullet) =>
    "# Build Standards\n\n## Naming\n\n- rules: stuff\n\n## Field aliasing\n\n_intro prose about aliasing_\n\n" +
    "> as the docs say, fill in `- task-alias-prefix-regex: ` with your pattern\n\n" +
    bullet + "\n\n_Example value (delete this line once the bullet above is filled in): `^[A-Z]_`._\n\n## Next section\n\n- other: x\n";

  check("readAliasConvention: null startDir → unset", readAliasConvention(null).status === "unset", readAliasConvention(null));
  {
    const r = readAliasConvention(KB);
    check("readAliasConvention: workspace without CONVENTIONS.md → unset naming the file", r.status === "unset" && /CONVENTIONS\.md/.test(r.why), r);
  }
  writeFileSync(CONV, "# Build Standards\n\n## Naming\n\n- x\n", "utf8");
  check("readAliasConvention: no Field aliasing section → unset naming the section", (() => { const r = readAliasConvention(KB); return r.status === "unset" && /Field aliasing/.test(r.why); })(), readAliasConvention(KB));
  writeFileSync(CONV, SECTION("- task-alias-prefix-regex: "), "utf8");
  check(
    "readAliasConvention: empty bullet (the shipped template shape) → unset — neither the quoted key line nor the italic example is ever read as the value",
    (() => { const r = readAliasConvention(KB); return r.status === "unset" && /empty/.test(r.why); })(),
    readAliasConvention(KB)
  );
  writeFileSync(CONV, SECTION("- task-alias-prefix-regex: `^[A-Z]_`"), "utf8");
  check("readAliasConvention: declared → the inline-code value, compilable", (() => { const r = readAliasConvention(KB); return r.status === "declared" && r.pattern === "^[A-Z]_"; })(), readAliasConvention(KB));
  check("readAliasConvention: walk-up from a KB SUBDIR finds the workspace", readAliasConvention(join(KB, "rules-engine")).status === "declared", null);
  writeFileSync(CONV, String.fromCharCode(0xfeff) + SECTION("- task-alias-prefix-regex: `^[A-Z]_`"), "utf8");
  check("readAliasConvention: BOM'd CONVENTIONS.md (PS 5.1 Out-File) still parses (T-7 read boundary)", readAliasConvention(KB).status === "declared", readAliasConvention(KB));
  writeFileSync(CONV, SECTION("- task-alias-prefix-regex: `^[A-Z]_`").replace("## Field aliasing", "## FIELD ALIASING"), "utf8");
  check("readAliasConvention: heading title matched case-insensitively", readAliasConvention(KB).status === "declared", readAliasConvention(KB));
  writeFileSync(CONV, SECTION("- task-alias-prefix-regex: ^[A-Z]_"), "utf8");
  check("readAliasConvention: bare (non-inline-code) value → MALFORMED, withheld", (() => { const r = readAliasConvention(KB); return r.status === "malformed" && /inline-code/.test(r.why); })(), readAliasConvention(KB));
  writeFileSync(CONV, SECTION("- task-alias-prefix-regex: `([`"), "utf8");
  check("readAliasConvention: uncompilable regex value → MALFORMED naming the regex error", (() => { const r = readAliasConvention(KB); return r.status === "malformed" && /regular expression/.test(r.why); })(), readAliasConvention(KB));
  writeFileSync(CONV, SECTION("- task-alias-prefix-regex: `^A_`\n- task-alias-prefix-regex: `^B_`"), "utf8");
  check("readAliasConvention: two bullets → MALFORMED (ambiguous), none used", (() => { const r = readAliasConvention(KB); return r.status === "malformed" && /ambiguous/.test(r.why); })(), readAliasConvention(KB));
  writeFileSync(CONV, "# B\n\n## Other\n\n- task-alias-prefix-regex: `^[A-Z]_`\n\n## Field aliasing\n\n_prose_\n", "utf8");
  check("readAliasConvention: a bullet OUTSIDE the section is never read", (() => { const r = readAliasConvention(KB); return r.status === "unset" && /bullet/.test(r.why); })(), readAliasConvention(KB));

  // F-318: "declared" IMPLIES compiled — a whitespace-only code span passes
  // the inline-code grammar but compiles to null; pre-fix it returned
  // declared/prefix-null and the report claimed active stripping while
  // matching ran exact-only (self-contradictory, the F-307/F-308 class).
  writeFileSync(CONV, SECTION("- task-alias-prefix-regex: ` `"), "utf8");
  check(
    "readAliasConvention: whitespace-only code span → MALFORMED naming the blank value, never declared (F-318)",
    (() => { const r = readAliasConvention(KB); return r.status === "malformed" && /blank/.test(r.why); })(),
    readAliasConvention(KB)
  );
  // F-319: markdown sectioning parsed as grammar — the section ends at the
  // next level-1/level-2 heading, so a bullet under a later `# Appendix` is
  // never read as this declaration…
  writeFileSync(CONV, "# B\n\n## Field aliasing\n\n_prose only_\n\n# Appendix — deprecated standards\n\n- task-alias-prefix-regex: `^X_`\n", "utf8");
  check(
    "readAliasConvention: a bullet under a later level-1 heading is never read (F-319)",
    (() => { const r = readAliasConvention(KB); return r.status === "unset" && /bullet/.test(r.why); })(),
    readAliasConvention(KB)
  );
  // …while a ### SUBSECTION stays in-section by the same grammar (documented
  // at the template's one-section rule).
  writeFileSync(CONV, "# B\n\n## Field aliasing\n\n_prose_\n\n### Details\n\n- task-alias-prefix-regex: `^S_`\n\n## Next\n\n- x\n", "utf8");
  check(
    "readAliasConvention: a bullet inside a ### subsection is still in-section (F-319)",
    (() => { const r = readAliasConvention(KB); return r.status === "declared" && r.pattern === "^S_"; })(),
    readAliasConvention(KB)
  );
  // The displacement interplay the gate-2 review reproduced: an empty bare
  // section followed by an appendix bullet must not leak the appendix
  // pattern (pre-fix it returned declared ^LEAK_); the bare-title tiebreak
  // still governs (F-309, disclosed), so the outcome is unset-with-disclosure.
  writeFileSync(
    CONV,
    "# B\n\n## Field aliasing (machine-readable)\n\n- task-alias-prefix-regex: `^REAL_`\n\n## Field aliasing\n\n_prose_\n\n# Appendix\n\n- task-alias-prefix-regex: `^LEAK_`\n",
    "utf8"
  );
  check(
    "readAliasConvention: empty bare section + appendix bullet → unset with tiebreak disclosure, never the leaked pattern (F-319)",
    (() => { const r = readAliasConvention(KB); return r.status === "unset" && /bullet/.test(r.why) && /not read/.test(r.why); })(),
    readAliasConvention(KB)
  );
  // Fence opacity (self-review of the F-319 round): a pasted example inside
  // the section — a bash `# comment` line, a bullet-shaped example — must
  // neither end the section early nor read as the declaration; the REAL
  // bullet below the fence still reads.
  writeFileSync(
    CONV,
    "# B\n\n## Field aliasing\n\n_prose_\n\n```\n# example comment\n- task-alias-prefix-regex: `^FAKE_`\n```\n\n- task-alias-prefix-regex: `^R_`\n\n## Next\n\n- x\n",
    "utf8"
  );
  check(
    "readAliasConvention: fenced example is opaque — real bullet below it still reads",
    (() => { const r = readAliasConvention(KB); return r.status === "declared" && r.pattern === "^R_"; })(),
    readAliasConvention(KB)
  );
  writeFileSync(
    CONV,
    "# B\n\n## Field aliasing\n\n_prose_\n\n```\n- task-alias-prefix-regex: `^FAKE_`\n```\n\n## Next\n\n- x\n",
    "utf8"
  );
  check(
    "readAliasConvention: a fenced bullet alone is never the declaration",
    (() => { const r = readAliasConvention(KB); return r.status === "unset" && /bullet/.test(r.why); })(),
    readAliasConvention(KB)
  );
  // F-323: the mask is the CommonMark fence GRAMMAR, not a column-0-backtick
  // spelling toggle — a tilde or up-to-3-space-indented fence's example
  // bullet must be as opaque as a backtick one (pre-fix each leaked as
  // status=declared with the example pattern silently in force).
  writeFileSync(
    CONV,
    "# B\n\n## Field aliasing\n\n_prose_\n\n~~~\n- task-alias-prefix-regex: `^TILDE_`\n~~~\n\n## Next\n\n- x\n",
    "utf8"
  );
  check(
    "readAliasConvention: a tilde-fenced bullet is never the declaration (F-323)",
    (() => { const r = readAliasConvention(KB); return r.status === "unset" && /bullet/.test(r.why); })(),
    readAliasConvention(KB)
  );
  writeFileSync(
    CONV,
    "# B\n\n## Field aliasing\n\n_prose_\n\n~~~markdown\n- task-alias-prefix-regex: `^TILDE_`\n~~~\n\n## Next\n\n- x\n",
    "utf8"
  );
  check(
    "readAliasConvention: a tilde fence with an info string masks too (F-323)",
    (() => { const r = readAliasConvention(KB); return r.status === "unset" && /bullet/.test(r.why); })(),
    readAliasConvention(KB)
  );
  writeFileSync(
    CONV,
    "# B\n\n## Field aliasing\n\n_prose_\n\n   ```\n- task-alias-prefix-regex: `^FENCED_`\n   ```\n\n## Next\n\n- x\n",
    "utf8"
  );
  check(
    "readAliasConvention: a 3-space-indented fence masks — its column-0 bullet never reads (F-323)",
    (() => { const r = readAliasConvention(KB); return r.status === "unset" && /bullet/.test(r.why); })(),
    readAliasConvention(KB)
  );
  // Grammar edges that keep the mask honest in BOTH directions: an unclosed
  // fence masks to end-of-file (fails toward unset, as the design rule says);
  // a 4-backtick opener is not closed by an interior ``` line (closer must be
  // at least the opener's length, same character) — and a REAL bullet after
  // the proper closer still reads, so the mask ends exactly where the
  // grammar says, never a line late.
  writeFileSync(
    CONV,
    "# B\n\n## Field aliasing\n\n_prose_\n\n```\n- task-alias-prefix-regex: `^UNCLOSED_`\n\n## Next\n\n- x\n",
    "utf8"
  );
  check(
    "readAliasConvention: an unclosed fence masks to end-of-file → unset (F-323)",
    (() => { const r = readAliasConvention(KB); return r.status === "unset" && /bullet/.test(r.why); })(),
    readAliasConvention(KB)
  );
  writeFileSync(
    CONV,
    "# B\n\n## Field aliasing\n\n_prose_\n\n````\nexample:\n```\n- task-alias-prefix-regex: `^INNER_`\n````\n\n- task-alias-prefix-regex: `^AFTER_`\n\n## Next\n\n- x\n",
    "utf8"
  );
  check(
    "readAliasConvention: interior ``` cannot close a 4-backtick fence; the real bullet after the true closer reads (F-323)",
    (() => { const r = readAliasConvention(KB); return r.status === "declared" && r.pattern === "^AFTER_"; })(),
    readAliasConvention(KB)
  );
  // F-326: every refinement arm of the fence grammar pinned, one check per
  // arm — the F-324 lesson one level down (an unpinned arm of a self-review
  // addition is how the leak class comes back). The character-match arm is
  // the only one whose regression opens a LEAK; the rest fail toward unset,
  // but each is pinned anyway so the mutant list is derived from the arm
  // enumeration, not hand-picked.
  // (1) closer character-match: a backtick fence nested inside a tilde fence
  // — the single most common reason a human reaches for ~~~ — must not close
  // the tilde fence; its bullet stays masked.
  writeFileSync(
    CONV,
    "# B\n\n## Field aliasing\n\n_prose_\n\n~~~\nexample:\n```\n- task-alias-prefix-regex: `^EX_`\n```\n~~~\n\n## Next\n\n- x\n",
    "utf8"
  );
  check(
    "readAliasConvention: a backtick fence nested in a tilde fence stays masked — wrong-char lines never close (F-326)",
    (() => { const r = readAliasConvention(KB); return r.status === "unset" && /bullet/.test(r.why); })(),
    readAliasConvention(KB)
  );
  // (2) closer indent: a 4+-space-indented same-char line is fence CONTENT,
  // not a closer.
  writeFileSync(
    CONV,
    "# B\n\n## Field aliasing\n\n_prose_\n\n```\n    ```\n- task-alias-prefix-regex: `^IND_`\n```\n\n## Next\n\n- x\n",
    "utf8"
  );
  check(
    "readAliasConvention: a 4-space-indented ``` inside a fence does not close it (F-326)",
    (() => { const r = readAliasConvention(KB); return r.status === "unset" && /bullet/.test(r.why); })(),
    readAliasConvention(KB)
  );
  // (3) backtick-opener info-string rule, pinned POSITIVELY: a line starting
  // with ``` whose remainder carries a backtick is inline code, not a fence
  // opener — it must not swallow the section's real bullet.
  writeFileSync(
    CONV,
    "# B\n\n## Field aliasing\n\n_prose_\n\n```js uses `backticks` inline\n\n- task-alias-prefix-regex: `^R2_`\n\n## Next\n\n- x\n",
    "utf8"
  );
  check(
    "readAliasConvention: a ```-prefixed line with a backtick in its info string is prose — the real bullet still reads (F-326)",
    (() => { const r = readAliasConvention(KB); return r.status === "declared" && r.pattern === "^R2_"; })(),
    readAliasConvention(KB)
  );
  // (4) closer trailing-junk rule: a same-char line with trailing text is
  // fence content, not a closer.
  writeFileSync(
    CONV,
    "# B\n\n## Field aliasing\n\n_prose_\n\n```\n``` not a closer\n- task-alias-prefix-regex: `^TJ_`\n```\n\n## Next\n\n- x\n",
    "utf8"
  );
  check(
    "readAliasConvention: a ``` line with trailing text does not close a fence (F-326)",
    (() => { const r = readAliasConvention(KB); return r.status === "unset" && /bullet/.test(r.why); })(),
    readAliasConvention(KB)
  );
  // (5) opener indent, pinned POSITIVELY: a 4+-space-indented fence spelling
  // is indented code to CommonMark — prose to this read; it must not open a
  // mask that swallows the real bullet.
  writeFileSync(
    CONV,
    "# B\n\n## Field aliasing\n\n_prose_\n\n    ``` indented code, not a fence\n\n- task-alias-prefix-regex: `^R3_`\n\n## Next\n\n- x\n",
    "utf8"
  );
  check(
    "readAliasConvention: a 4-space-indented fence spelling is prose — the real bullet still reads (F-326)",
    (() => { const r = readAliasConvention(KB); return r.status === "declared" && r.pattern === "^R3_"; })(),
    readAliasConvention(KB)
  );
  // (6) opener minimum length: a bare 2-backtick line is prose, never an
  // opener — under a shortened minimum it would open a phantom fence that
  // the REAL ``` opener then closes, unmasking the fenced example bullet
  // (the sweep's A2 mutant: not fail-toward-unset after all).
  writeFileSync(
    CONV,
    "# B\n\n## Field aliasing\n\n_prose_\n\n``\n```\n- task-alias-prefix-regex: `^SHORT_`\n```\n\n## Next\n\n- x\n",
    "utf8"
  );
  check(
    "readAliasConvention: a bare 2-backtick line is prose — the backtick fence after it still masks its bullet (F-326)",
    (() => { const r = readAliasConvention(KB); return r.status === "unset" && /bullet/.test(r.why); })(),
    readAliasConvention(KB)
  );
  // F-327: the alternation carries TWO independent minimum-length
  // quantifiers — the F-326 round mutated both at once, so only the backtick
  // half was really pinned. The tilde twin of the phantom-opener leak:
  writeFileSync(
    CONV,
    "# B\n\n## Field aliasing\n\n_prose_\n\n~~\n~~~\n- task-alias-prefix-regex: `^EX_`\n~~~\n\n## Next\n\n- x\n",
    "utf8"
  );
  check(
    "readAliasConvention: a bare 2-tilde line is prose — the tilde fence after it still masks its bullet (F-327)",
    (() => { const r = readAliasConvention(KB); return r.status === "unset" && /bullet/.test(r.why); })(),
    readAliasConvention(KB)
  );
  // Two more single-conditional pins the finer granularity exposes (found by
  // the F-327 round's split sweep, not previously named by either role):
  // the info-string backtick exclusion is scoped to BACKTICK openers by its
  // character conjunct — a tilde opener whose info string carries a backtick
  // must still open (drop the conjunct and its bullet leaks) …
  writeFileSync(
    CONV,
    "# B\n\n## Field aliasing\n\n_prose_\n\n~~~see `x` for the shape\n- task-alias-prefix-regex: `^TI_`\n~~~\n\n## Next\n\n- x\n",
    "utf8"
  );
  check(
    "readAliasConvention: a tilde opener with a backtick in its info string still opens — the exclusion is backtick-openers-only (F-327)",
    (() => { const r = readAliasConvention(KB); return r.status === "unset" && /bullet/.test(r.why); })(),
    readAliasConvention(KB)
  );
  // … and the closer alternation's TILDE branch is load-bearing in the
  // declared direction: a real bullet after a properly closed tilde fence
  // must read (drop the branch and the fence masks to EOF, losing it).
  writeFileSync(
    CONV,
    "# B\n\n## Field aliasing\n\n_prose_\n\n~~~\n- task-alias-prefix-regex: `^IN_`\n~~~\n\n- task-alias-prefix-regex: `^OUT_`\n\n## Next\n\n- x\n",
    "utf8"
  );
  check(
    "readAliasConvention: a tilde closer really closes — the real bullet after it reads (F-327)",
    (() => { const r = readAliasConvention(KB); return r.status === "declared" && r.pattern === "^OUT_"; })(),
    readAliasConvention(KB)
  );
  // F-321: an invalid EXPLICIT --alias-prefix refuses at flag-parse time,
  // BEFORE the index load — order observed via a nonexistent --index: the
  // regex error, not the index-load failure, must be the one reported.
  {
    const rr = spawnSync(
      process.execPath,
      [JO_REPORT, "deps", "--index", join(ROOT, "no-such-index.json"), "--field", "X", "--alias-prefix", "(", "--report", join(ROOT, "f321-report")],
      { encoding: "utf8" }
    );
    check(
      "deps: invalid --alias-prefix fails before the index load (F-321)",
      rr.status === 1 && /regular expression/.test(rr.stderr) && !/no-such-index/.test(rr.stderr),
      (rr.stderr || "").slice(0, 300)
    );
  }

  // F-305 — the heading TITLE is the anchor, not the whole line: real
  // workspaces (provisioned by earlier rounds of these skills) suffix the
  // heading, and a present section must never be reported absent.
  writeFileSync(CONV, SECTION("- task-alias-prefix-regex: `^[A-Z]_`").replace("## Field aliasing", "## Field aliasing (machine-readable — read by the deps skills)"), "utf8");
  check(
    "readAliasConvention: heading with TRAILING TEXT still anchors the section (F-305 — the real-workspace shape)",
    (() => { const r = readAliasConvention(KB); return r.status === "declared" && r.pattern === "^[A-Z]_"; })(),
    readAliasConvention(KB)
  );
  writeFileSync(CONV, SECTION("- task-alias-prefix-regex: `^[A-Z]_`").replace("## Field aliasing", "### Field aliasing"), "utf8");
  check(
    "readAliasConvention: WRONG-LEVEL heading (###) → MALFORMED naming the required form, never 'no section' (F-305)",
    (() => { const r = readAliasConvention(KB); return r.status === "malformed" && /level-2/.test(r.why); })(),
    readAliasConvention(KB)
  );
  writeFileSync(CONV, SECTION("- task-alias-prefix-regex: `^[A-Z]_`").replace("## Field aliasing", "##Field aliasing"), "utf8");
  check(
    "readAliasConvention: no-space `##Field aliasing` → MALFORMED, not unset (F-305 near-grammar arm)",
    readAliasConvention(KB).status === "malformed",
    readAliasConvention(KB)
  );
  writeFileSync(CONV, SECTION("- task-alias-prefix-regex: `^[A-Z]_`") + "\n## Field aliasing history\n\n_prose_\n", "utf8");
  check(
    "readAliasConvention: a bare-title heading next to a suffixed one is NOT ambiguous — the bare title wins (F-305)",
    readAliasConvention(KB).status === "declared",
    readAliasConvention(KB)
  );
  writeFileSync(
    CONV,
    "# B\n\n## Field aliasing (old)\n\n- task-alias-prefix-regex: `^A_`\n\n## Field aliasing (new)\n\n- task-alias-prefix-regex: `^B_`\n",
    "utf8"
  );
  check(
    "readAliasConvention: two suffixed title headings, no bare one → MALFORMED (ambiguous), none read (F-305)",
    (() => { const r = readAliasConvention(KB); return r.status === "malformed" && /ambiguous/.test(r.why); })(),
    readAliasConvention(KB)
  );

  // near-grammar declarations are LOUD, never silently unset (review round)
  writeFileSync(CONV, SECTION("* task-alias-prefix-regex: `^[A-Z]_`"), "utf8");
  check("readAliasConvention: a `*`-marker bullet → MALFORMED (present-but-broken is loud, not unset)", (() => { const r = readAliasConvention(KB); return r.status === "malformed" && /line start/.test(r.why); })(), readAliasConvention(KB));
  writeFileSync(CONV, SECTION("  - task-alias-prefix-regex: `^[A-Z]_`"), "utf8");
  check("readAliasConvention: an INDENTED bullet → MALFORMED, not unset", readAliasConvention(KB).status === "malformed", readAliasConvention(KB));

  // resolution precedence (the one rule both deps surfaces share)
  writeFileSync(CONV, SECTION("- task-alias-prefix-regex: `^[A-Z]_`"), "utf8");
  check("resolveAliasPrefix: explicit --alias-prefix WINS over a declared convention", resolveAliasPrefix({ explicit: "^Z_", hasFieldTerms: true, kbDir: KB }).source === "^Z_", null);
  check("resolveAliasPrefix: explicit EMPTY '' is the exact-only OPT-OUT — the convention is NOT read", (() => { const r = resolveAliasPrefix({ explicit: "", hasFieldTerms: true, kbDir: KB }); return r.prefix === null && r.source === null && /disabled by an empty/.test(r.unsetWhy ?? ""); })(), null);
  check("resolveAliasPrefix: no explicit → the declared convention, compiled once at the read", (() => { const r = resolveAliasPrefix({ explicit: null, hasFieldTerms: true, kbDir: KB }); return r.source === "^[A-Z]_" && r.prefix instanceof RegExp && r.note === null && r.unsetWhy === null; })(), null);
  check("resolveAliasPrefix: no field terms → no read, exact-only", (() => { const r = resolveAliasPrefix({ explicit: null, hasFieldTerms: false, kbDir: KB }); return r.prefix === null && r.source === null; })(), null);
  check("resolveAliasPrefix: unset carries its WHY (could-not-look is never 'nothing declared')", resolveAliasPrefix({ explicit: null, hasFieldTerms: true, kbDir: null }).unsetWhy === "no KB directory to locate the workspace from", resolveAliasPrefix({ explicit: null, hasFieldTerms: true, kbDir: null }));
  writeFileSync(CONV, SECTION("- task-alias-prefix-regex: ^X_"), "utf8");
  check("resolveAliasPrefix: malformed convention → withheld + note naming MALFORMED (never guessed)", (() => { const r = resolveAliasPrefix({ explicit: null, hasFieldTerms: true, kbDir: KB }); return r.prefix === null && /MALFORMED/.test(r.note ?? ""); })(), null);
  writeFileSync(CONV, SECTION("- task-alias-prefix-regex: `([`"), "utf8");
  check("resolveAliasPrefix: an uncompilable DECLARED pattern names the pattern, not the flag", (() => { const r = resolveAliasPrefix({ explicit: null, hasFieldTerms: true, kbDir: KB }); return /the declared pattern/.test(r.note ?? "") && !/--alias-prefix '/.test(r.note ?? ""); })(), null);
  {
    let threw = null;
    try { resolveAliasPrefix({ explicit: "([", hasFieldTerms: true, kbDir: KB }); } catch (e) { threw = e.message; }
    check("resolveAliasPrefix: invalid EXPLICIT regex still throws loudly", /not a valid regular expression/.test(threw ?? ""), threw);
  }

  // F-307 — the Summary/header matching line renders from the RESOLUTION
  // RESULT (one owner for the reason), so three distinct no-alias states
  // never collapse into "no convention supplied".
  writeFileSync(CONV, SECTION("- task-alias-prefix-regex: `^[A-Z]_`"), "utf8");
  check(
    "aliasMatchingLine: declared+active names the pattern and the mechanisms",
    (() => { const l = aliasMatchingLine(resolveAliasPrefix({ explicit: null, hasFieldTerms: true, kbDir: KB }), true); return /task-alias prefix stripping/.test(l) && /\^\[A-Z\]_/.test(l); })(),
    null
  );
  check(
    "aliasMatchingLine: '' opt-out over a VALID declaration names the override, never 'no convention supplied' (F-307)",
    (() => { const l = aliasMatchingLine(resolveAliasPrefix({ explicit: "", hasFieldTerms: true, kbDir: KB }), true); return /disabled by an empty/.test(l) && !/no field-aliasing convention supplied/.test(l); })(),
    aliasMatchingLine(resolveAliasPrefix({ explicit: "", hasFieldTerms: true, kbDir: KB }), true)
  );
  writeFileSync(CONV, SECTION("- task-alias-prefix-regex: ^X_"), "utf8");
  check(
    "aliasMatchingLine: MALFORMED declaration says so and defers to Caveats, never 'no convention supplied' (F-307)",
    (() => { const l = aliasMatchingLine(resolveAliasPrefix({ explicit: null, hasFieldTerms: true, kbDir: KB }), true); return /MALFORMED/.test(l) && /Caveats/.test(l) && !/no field-aliasing convention supplied/.test(l); })(),
    aliasMatchingLine(resolveAliasPrefix({ explicit: null, hasFieldTerms: true, kbDir: KB }), true)
  );
  writeFileSync(CONV, "# Build Standards\n\n## Naming\n\n- x\n", "utf8");
  check(
    "aliasMatchingLine: genuinely-unset quotes the resolution's own why (which section is missing)",
    (() => { const l = aliasMatchingLine(resolveAliasPrefix({ explicit: null, hasFieldTerms: true, kbDir: KB }), true); return /field aliasing not in force/.test(l) && /## Field aliasing/.test(l); })(),
    aliasMatchingLine(resolveAliasPrefix({ explicit: null, hasFieldTerms: true, kbDir: KB }), true)
  );
  check(
    "aliasMatchingLine: no field terms → bare exact-match line, no alias claim either way",
    aliasMatchingLine(resolveAliasPrefix({ explicit: null, hasFieldTerms: false, kbDir: KB }), false) === "case-insensitive exact match on system name or label",
    null
  );

  // F-308 — the ACTIVE arm renders provenance from the resolution's origin,
  // never hardcoded: an explicit --alias-prefix was credited to "the tenant
  // conventions" even when no conventions section exists at all (and when it
  // overrode a valid declaration, the line named the LOSING source). Shared
  // renderer — locks both deps surfaces at once.
  writeFileSync(CONV, "# Build Standards\n\n## Naming\n\n- x\n", "utf8"); // NO Field aliasing section
  check(
    "aliasMatchingLine: explicit flag with NO conventions section credits the FLAG, never the conventions (F-308)",
    (() => { const l = aliasMatchingLine(resolveAliasPrefix({ explicit: "^Q_", hasFieldTerms: true, kbDir: KB }), true); return l.includes("(`^Q_`, from the explicit `--alias-prefix` flag)") && !l.includes("from the tenant conventions"); })(),
    aliasMatchingLine(resolveAliasPrefix({ explicit: "^Q_", hasFieldTerms: true, kbDir: KB }), true)
  );
  writeFileSync(CONV, SECTION("- task-alias-prefix-regex: `^[A-Z]_`"), "utf8");
  check(
    "aliasMatchingLine: explicit flag OVER a valid declaration names the WINNING source — the flag (F-308)",
    (() => { const l = aliasMatchingLine(resolveAliasPrefix({ explicit: "^Q_", hasFieldTerms: true, kbDir: KB }), true); return l.includes("(`^Q_`, from the explicit `--alias-prefix` flag)") && !l.includes("from the tenant conventions"); })(),
    null
  );
  check(
    "aliasMatchingLine: a conventions-declared pattern still credits the conventions (F-308 regression guard)",
    (() => { const l = aliasMatchingLine(resolveAliasPrefix({ explicit: null, hasFieldTerms: true, kbDir: KB }), true); return l.includes("(`^[A-Z]_`, from the tenant conventions)") && !l.includes("--alias-prefix` flag"); })(),
    null
  );

  // F-309 — the bare-title tiebreak is on heading SHAPE, never content, so an
  // EMPTY bare section wins over a suffixed one carrying the valid bullet.
  // The behaviour stands (the bare heading is the template's canonical shape;
  // preferring content could activate a stale pattern from e.g. a history
  // section) — but every WITHHELD outcome must disclose the skipped
  // candidates, so the why describes the FILE, not just the winning section.
  writeFileSync(
    CONV,
    "# B\n\n## Field aliasing\n\n_prose, no bullet_\n\n## Field aliasing (machine-readable — read by the deps skills)\n\n- task-alias-prefix-regex: `^[A-Z]_`\n",
    "utf8"
  );
  check(
    "readAliasConvention: empty bare section beats a suffixed one WITH the bullet — still unset, but the why DISCLOSES the skipped heading (F-309)",
    (() => { const r = readAliasConvention(KB); return r.status === "unset" && /bullet in the section/.test(r.why) && /bare `## Field aliasing` heading governs/.test(r.why) && /line 7/.test(r.why); })(),
    readAliasConvention(KB)
  );
  writeFileSync(
    CONV,
    "# B\n\n## Field aliasing (old)\n\n- task-alias-prefix-regex: `^A_`\n\n## Field aliasing\n\n- task-alias-prefix-regex: \n",
    "utf8"
  );
  check(
    "readAliasConvention: empty-VALUE unset in the winning bare section also discloses the skipped heading (F-309)",
    (() => { const r = readAliasConvention(KB); return r.status === "unset" && /empty/.test(r.why) && /governs/.test(r.why) && /line 3/.test(r.why); })(),
    readAliasConvention(KB)
  );
  writeFileSync(CONV, SECTION("- task-alias-prefix-regex: `^[A-Z]_`") + "\n## Field aliasing history\n\n_prose_\n", "utf8");
  check(
    "readAliasConvention: a DECLARED outcome from the winning bare section carries no disclosure noise (F-309)",
    (() => { const r = readAliasConvention(KB); return r.status === "declared" && r.pattern === "^[A-Z]_"; })(),
    readAliasConvention(KB)
  );
}

check(
  "tokenCandidates: inner text + dot-segments",
  JSON.stringify(tokenCandidates("Hi ${Account.Name}!")[0]) ===
    JSON.stringify({ token: "${Account.Name}", candidates: ["Account.Name", "Account", "Name"] }),
  tokenCandidates("Hi ${Account.Name}!")
);
check("tokenCandidates: no tokens / non-string", tokenCandidates("plain").length === 0 && tokenCandidates(null).length === 0, null);
check(
  "tokenSpellings: gs- prefix flexibility in both directions",
  JSON.stringify(tokenSpellings("subj::gs-X").sort()) === JSON.stringify(["${subj::X}", "${subj::gs-X}"]) &&
    JSON.stringify(tokenSpellings("embd::Y").sort()) === JSON.stringify(["${embd::Y}", "${embd::gs-Y}"]) &&
    tokenSpellings("gs-Z").includes("${gs-Z}") && tokenSpellings("gs-Z").includes("${Z}"),
  { a: tokenSpellings("subj::gs-X"), b: tokenSpellings("embd::Y"), c: tokenSpellings("gs-Z") }
);

// ── fixture: a hand-built C1 v1 index ────────────────────────────────────────

const program = (id, name, status, over = {}) => ({
  id, name, status, statusSource: "kb", model: "DYNAMIC_PROGRAM", modelName: "Program",
  startDate: null, depth: "full", docPath: `fixture-tenant/journey/${id}.md`, lastVerified: null,
  schedules: [], steps: [], sources: [], ...over,
});
const condition = (objectName, fieldName, fieldLabel, over = {}) => ({
  objectName, fieldName, fieldLabel, comparisonOperator: "EQUALS", filterAlias: "A", ...over,
});

const SRC_FULL = {
  configId: "cfg-1",
  type: "DYNAMIC_QUERY_V2",
  name: "Src A",
  mappings: {
    standard: { recipientEmailAddress: "Nominee Email" },
    custom: [{ id: "gsid-1", fieldName: "Csm_Name__gc", label: "CSM Name" }],
  },
  conditions: [
    condition("Company", "Arr__gc", "ARR", { comparisonOperator: "GREATER_THAN", filterAlias: "F1" }),
    condition("Company", "Status__gc", "Company Status"),
  ],
};

const INDEX = {
  generatedAt: "2026-07-12T00:00:00.000Z", liveSweepAt: null,
  slug: "fixture-tenant", baseUrl: "https://fixture-tenant.example.com", environment: "sandbox",
  programs: {
    // field + object matches via conditions AND mappings
    "prog-filter": program("prog-filter", "Filter Program", "PROCESSING", { sources: [SRC_FULL] }),
    // touches Company but on OTHER fields → object-level-only candidate
    "prog-objonly": program("prog-objonly", "Object Only", "PROCESSING", {
      sources: [{ configId: "cfg-2", type: "DYNAMIC_QUERY_V2", name: "Src B", mappings: { standard: {}, custom: [] }, conditions: [condition("Company", "Industry__gc", "Industry")] }],
    }),
    // linked templates carry ${...} tokens; no participant sources
    "prog-token": program("prog-token", "Token Program", "PROCESSING"),
    // matching condition but inactive → only visible with --all
    "prog-inactive": program("prog-inactive", "Inactive Program", "STOP", {
      sources: [{ configId: "cfg-3", type: "DYNAMIC_QUERY_V2", name: "Src C", mappings: { standard: {}, custom: [] }, conditions: [condition("Company", "Arr__gc", "ARR")] }],
    }),
    // matching condition, paused → joins via --include-paused
    "prog-paused": program("prog-paused", "Paused Program", "PAUSE", {
      sources: [{ configId: "cfg-4", type: "DYNAMIC_QUERY_V2", name: "Src D", mappings: { standard: {}, custom: [] }, conditions: [condition("Company", "Arr__gc", "ARR")] }],
    }),
  },
  templates: {
    "tpl-tok": {
      id: "tpl-tok", title: "Token Template", subject: "Your ${Company.Arr__gc} report", folderId: null, active: true,
      body: "Hi ${Account.Name}, your ARR is ${Company.Arr__gc}.",
      variants: [{ name: "Variant B", subject: null, body: "V ${Account.Name} v" }],
      docPath: "fixture-tenant/journey-email-templates/tpl-tok.md", bodyIncluded: true,
    },
    // metadata-only doc: body never captured → token scan sees subject only
    "tpl-meta": {
      id: "tpl-meta", title: "Metadata Only", subject: "No tokens here", folderId: null, active: true,
      body: "", variants: [],
      docPath: "fixture-tenant/journey-email-templates/tpl-meta.md", bodyIncluded: false,
    },
  },
  links: {
    templateToPrograms: { "tpl-tok": ["prog-token"], "tpl-missing": ["prog-token"], "tpl-meta": ["prog-token"] },
    programToTemplates: { "prog-token": ["tpl-tok", "tpl-missing", "tpl-meta"] },
  },
  gaps: { referencedTemplatesMissing: ["tpl-missing"], stubs: [], liveOnly: [], kbOnly: [], statusDrift: [] },
  parseErrors: [],
};
const INDEX_PATH = join(ROOT, "er-index.json");
writeFileSync(INDEX_PATH, JSON.stringify(INDEX));

// ── usage extraction + classification ────────────────────────────────────────

{
  const rows = usageCandidates(INDEX.programs["prog-filter"]);
  check(
    "usageCandidates: conditions → filter, mappings → projected/show field, custom → custom class",
    rows.filter((r) => r.usage === "filter").length === 2 &&
      rows.filter((r) => r.usage === "projected/show field").length === 1 &&
      rows.filter((r) => r.usage === "projected/show field (custom)").length === 1,
    rows.map((r) => r.usage)
  );
  check(
    "usageCandidates: filter detail carries the comparison operator",
    rows.find((r) => r.fieldName === "Arr__gc")?.detail === "operator GREATER_THAN, alias F1",
    rows.find((r) => r.fieldName === "Arr__gc")
  );
  const t = (term) => [prepFieldTerm(term)];
  check("matchFieldTerm: condition by system name (result carries term/how/candidate)", (() => { const m = matchFieldTerm(rows[0], t("ARR__GC")); return m?.term === "ARR__GC" && m?.how === "exact" && m?.candidate === "Arr__gc"; })(), matchFieldTerm(rows[0], t("ARR__GC")));
  check("matchFieldTerm: condition by label", matchFieldTerm(rows[0], t("arr"))?.term === "arr", null);
  check("matchFieldTerm: NO substring on names/labels", matchFieldTerm(rows[0], t("Ar")) === null && matchFieldTerm(rows[0], t("Arr__g")) === null, null);
  const mapping = rows.find((r) => r.kind === "mapping");
  check("matchFieldTerm: mapping by standard-field key", matchFieldTerm(mapping, t("recipientemailaddress")) !== null, mapping);
  check("matchFieldTerm: mapping by source-column value", matchFieldTerm(mapping, t("Nominee Email")) !== null, mapping);
  const custom = rows.find((r) => r.kind === "custom");
  check("matchFieldTerm: customMappings string values", matchFieldTerm(custom, t("csm name")) !== null && matchFieldTerm(custom, t("Csm_Name__gc")) !== null, custom);
  const ot = (term) => [{ term, lowered: term.toLowerCase() }];
  check("matchObjectTerm: conditions only (mappings carry no objects)", matchObjectTerm(rows[0], ot("company")) === "company" && matchObjectTerm(mapping, ot("company")) === null, null);
}

// ── scanDeps semantics (S3 requirements) ─────────────────────────────────────

{
  const r = scanDeps(INDEX, { fieldTerms: ["ARR"] });
  check(
    "scanDeps: active-only default — inactive/paused matches invisible",
    r.programs.length === 3 && r.fieldRows.length === 1 && r.fieldRows[0].program.id === "prog-filter",
    { programs: r.programs.map((p) => p.id), rows: r.fieldRows.map((x) => x.program.id) }
  );
  const all = scanDeps(INDEX, { fieldTerms: ["ARR"], all: true });
  check(
    "scanDeps: --all widens to every program",
    all.programs.length === 5 && all.fieldRows.some((x) => x.program.id === "prog-inactive") && all.fieldRows.some((x) => x.program.id === "prog-paused"),
    all.fieldRows.map((x) => x.program.id)
  );
  const paused = scanDeps(INDEX, { fieldTerms: ["ARR"], includePaused: true });
  check(
    "scanDeps: --include-paused adds PAUSE without --all",
    paused.programs.length === 4 && paused.fieldRows.some((x) => x.program.id === "prog-paused") && !paused.fieldRows.some((x) => x.program.id === "prog-inactive"),
    paused.fieldRows.map((x) => x.program.id)
  );
}

{
  // object + field terms: field hits in the main rows; object-touching
  // programs without a field hit in the separate object-level bucket; a
  // program with BOTH keeps its object-matched rows in the main table
  const r = scanDeps(INDEX, { objectTerms: ["Company"], fieldTerms: ["ARR"] });
  check(
    "scanDeps: object-level-only programs separated; both-matched program keeps object rows in main table",
    r.fieldRows.length === 2 && r.fieldRows.every((x) => x.program.id === "prog-filter") &&
      r.fieldRows.some((x) => x.matchedOn === "field" && x.fieldName === "Arr__gc") &&
      r.fieldRows.some((x) => x.matchedOn === "object" && x.fieldName === "Status__gc" && x.matchedTerm === "Company") &&
      r.objectLevel.length === 1 && r.objectLevel[0].program.id === "prog-objonly",
    { fieldRows: r.fieldRows.map((x) => [x.program.id, x.fieldName, x.matchedOn]), objectLevel: r.objectLevel.map((e) => e.program.id) }
  );
  check(
    "scanDeps: object-level entry names the fields its filters DO reference",
    r.objectLevel[0].rows.some((row) => row.fieldName === "Industry__gc"),
    r.objectLevel[0].rows
  );
  check("scanDeps: objectsTouched aggregates both buckets", JSON.stringify(r.objectsTouched) === JSON.stringify(["Company"]), r.objectsTouched);
  // object-only run: object-matching condition rows ARE the main rows
  const oOnly = scanDeps(INDEX, { objectTerms: ["Company"] });
  check(
    "scanDeps: object-only run reports condition rows directly (no object-level bucket)",
    oOnly.fieldRows.length === 3 && oOnly.fieldRows.every((x) => x.matchedOn === "object") && oOnly.objectLevel.length === 0,
    { rows: oOnly.fieldRows.map((x) => [x.program.id, x.fieldName]), objectLevel: oOnly.objectLevel.length }
  );
}

{
  // --scan-tokens: dot-segment exact match, variant location, missing doc
  const fTerms = [prepFieldTerm("Name")];
  const { rows, missingTemplates, metadataOnlyTemplates } = scanTokens(INDEX, [INDEX.programs["prog-token"]], fTerms);
  check(
    "scanTokens: ${Account.Name} hits field term 'Name' via dot-segment, in body and variant",
    rows.length === 2 && rows.every((r) => r.token === "${Account.Name}") &&
      rows.some((r) => r.location === "body") && rows.some((r) => r.location === 'variant "Variant B" body'),
    rows.map((r) => [r.location, r.token])
  );
  check("scanTokens: missing linked template reported, not silently skipped", JSON.stringify(missingTemplates) === JSON.stringify(["tpl-missing"]), missingTemplates);
  check("scanTokens: metadata-only template reported (body not scannable)", JSON.stringify(metadataOnlyTemplates) === JSON.stringify(["tpl-meta"]), metadataOnlyTemplates);
  const full = scanDeps(INDEX, { fieldTerms: ["Arr__gc"], tokens: true });
  check(
    "scanDeps: token rows found for ${Company.Arr__gc} (subject + body), field rows independent",
    full.tokenRows.length === 2 && full.tokenRows.every((r) => r.program.id === "prog-token") && full.fieldRows.length === 1,
    { tokens: full.tokenRows.map((r) => [r.location, r.token]), fields: full.fieldRows.length }
  );
  const noTokens = scanDeps(INDEX, { fieldTerms: ["Arr__gc"] });
  check("scanDeps: tokens NOT scanned without the flag", noTokens.tokenRows.length === 0, noTokens.tokenRows);
  // a token hit counts as a field match → suppresses the object-level bucket
  const suppress = scanDeps(INDEX, {
    objectTerms: ["Company"], fieldTerms: ["Name"], tokens: true,
  });
  check(
    "scanDeps: token hit suppresses that program's object-level entry (prog-token has no conditions; others still bucket)",
    !suppress.objectLevel.some((e) => e.program.id === "prog-token") && suppress.objectLevel.some((e) => e.program.id === "prog-filter"),
    suppress.objectLevel.map((e) => e.program.id)
  );
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
  const { res, summary } = runCli("deps", "--index", INDEX_PATH, "--object", "Company", "--field", "ARR", "--report", rDir, "--csv-dir", cDir);
  check(
    "cli: exit 0 + C2 summary keys + objectsTouched for dm deps check corroboration",
    res.status === 0 && summary?.ok === true && summary?.mode === "deps" && typeof summary?.reportPath === "string" &&
      JSON.stringify(summary?.objectsTouched) === JSON.stringify(["Company"]) && "caveatCount" in summary,
    { status: res.status, stderr: res.stderr, stdout: res.stdout?.slice(0, 300) }
  );
  check(
    "cli: counts (3 scanned, 2 field rows = filters incl. the object-matched one, 1 object-level program)",
    summary?.counts?.programsScanned === 3 && summary?.counts?.fieldUsageRows === 2 && summary?.counts?.filterRows === 2 && summary?.counts?.objectLevelPrograms === 1,
    summary?.counts
  );
  const md = readFileSync(summary.reportPath, "utf8");
  check(
    "cli: field-level row shows usage class, object.field, operator detail",
    md.includes("| filter | Company |") && md.includes('Arr__gc ("ARR")') && md.includes("operator GREATER_THAN"),
    md.split("\n").filter((l) => l.includes("filter"))
  );
  check(
    "cli: object-level section separate with the fields actually referenced",
    md.includes("## Object-level matches (no field-term hit)") && md.includes("Object Only (prog-objonly)") && md.includes("Industry__gc"),
    null
  );
  check(
    "cli: caveats — scope, stale statuses, mappings-carry-no-objects, tokens hint, dm deps check corroboration",
    md.includes("active programs only — 2 of 5 program(s) NOT scanned") &&
      md.includes("statuses are KB-cached") &&
      md.includes("C1 mappings carry no object names") &&
      md.includes("--scan-tokens") &&
      md.includes("dm deps check --name 'Company' --areas JOURNEY_ORCHESTRATOR"),
    { caveatCount: summary?.caveatCount }
  );
  check(
    "cli: --object caveat states filter-conditions-only matching and how to read an empty result (S5-V wording)",
    md.includes("FILTER-CONDITIONS-ONLY") && md.includes('"no FILTER usage found"'),
    null
  );
  const csv = readFileSync(join(cDir, "deps-usages.csv"), "utf8");
  const objCsv = readFileSync(join(cDir, "deps-object-level.csv"), "utf8");
  check(
    "cli: usages CSV row carries class/object/field/label/term/how",
    csv.startsWith("\uFEFF" + "program_id,program_name,status,status_source,source,usage_class,object,field,label,matched_term,matched_how,detail\r\n") &&
      csv.includes("prog-filter") && csv.includes("filter") && csv.includes("Arr__gc") && csv.includes("exact"),
    csv.slice(0, 300)
  );
  check("cli: object-level CSV lists the no-field-hit program", objCsv.includes("prog-objonly") && objCsv.includes("Industry__gc"), objCsv);
}

{
  const all = runCli("deps", "--index", INDEX_PATH, "--field", "ARR", "--all", "--report", join(ROOT, "r2"));
  const md = readFileSync(all.summary.reportPath, "utf8");
  check(
    "cli: --all scans everything, status column shows inactive states",
    all.summary?.counts?.programsScanned === 5 && all.summary?.counts?.fieldUsageRows === 3 && md.includes("STOP (kb)") && md.includes("PAUSE (kb)"),
    all.summary?.counts
  );
  check(
    "cli: --all drops the scope caveat but keeps the stale-status caveat (statuses shown on every row)",
    !md.includes("active programs only") && !md.includes("re-run with --all") && md.includes("statuses are KB-cached"),
    md.split("\n").filter((l) => l.includes("Scope") || l.includes("KB-cached"))
  );
  const mapping = runCli("deps", "--index", INDEX_PATH, "--field", "Nominee Email", "--report", join(ROOT, "r3"));
  const mdMap = readFileSync(mapping.summary.reportPath, "utf8");
  check(
    "cli: mapping match classifies projected/show field",
    mapping.summary?.counts?.showFieldRows === 1 && mdMap.includes("projected/show field") && mdMap.includes("standard mapping recipientEmailAddress ← Nominee Email"),
    mapping.summary?.counts
  );
}

{
  const tok = runCli("deps", "--index", INDEX_PATH, "--field", "Name", "--scan-tokens", "--report", join(ROOT, "r4"), "--csv-dir", join(ROOT, "c4"));
  const md = readFileSync(tok.summary.reportPath, "utf8");
  check(
    "cli: --scan-tokens emits the token section + missing-template + metadata-only caveats",
    tok.summary?.counts?.tokenRows === 2 && md.includes("## Email-token usage (--scan-tokens)") && md.includes("${Account.Name}") &&
      md.includes("1 referenced template(s) have no KB doc") &&
      md.includes("1 scanned template doc(s) are metadata-only"),
    tok.summary?.counts
  );
  // ER-19 (ruled): the S5-V "0 token hits is NOT evidence" caveat is
  // REPLACED by the true coverage limit — leaving it on a working scan would
  // be its own lie.
  check(
    "cli: --scan-tokens caveat is the ER-19 coverage wording, S5-V wording retired",
    md.includes("resolves each program's own token bindings") && md.includes("Coverage limit") &&
      !md.includes("0 token hits is NOT evidence"),
    null
  );
  const tokCsv = readFileSync(join(ROOT, "c4", "deps-tokens.csv"), "utf8");
  const usagesCsv = readFileSync(join(ROOT, "c4", "deps-usages.csv"), "utf8");
  check(
    "cli: token rows land in their own deps-tokens.csv (+matched_via), never mixed into the usages columns",
    tokCsv.startsWith("\uFEFF" + "program_id,program_name,status,status_source,template_id,template_title,location,token,matched_term,matched_via\r\n") &&
      tokCsv.includes("${Account.Name}") && tokCsv.includes("token text") &&
      !usagesCsv.includes("email token") && !usagesCsv.includes("${Account.Name}"),
    tokCsv.slice(0, 400)
  );
}

// ── ER-19: binding-resolved --scan-tokens (the Test-4 known-answer shape) ────
// Programs built by RUNNING parseJourneyDoc on synthetic docs of BOTH
// generations, so the C1 v2 step tokens[] these rows depend on can't drift
// from the parser. Mirrors the live known-answer test: a field provably bound
// into subjects and bodies must produce token rows naming those locations.
{
  const jDoc = (id, name, ao) =>
    [`# ${name}`, "", `- key: journey/${id}`, `- id: ${id}`, `- name: ${name}`, "", "```json", JSON.stringify({ result: true, data: { advancedOutreach: ao } }), "```", ""].join("\n");
  // flow-canvas generation (the flow-canvas SURVEY_ACTION shape)
  const flowAo = {
    advancedOutreachId: "prog-mir", advancedOutreachName: "Acme Mirror Campaign", advancedOutreachStatus: ["PROCESSING"],
    advancedOutreachModel: "DYNAMIC_PROGRAM",
    stepJson: JSON.stringify({
      nodes: [{
        type: "SURVEY_ACTION", id: "mir1", name: "Survey 1",
        surveyIdFromEmailActionV2: "SVY-77",
        actionConfig: JSON.stringify({
          globalConfigInfo: { surveyInfo: { surveyId: "SVY-77", surveyName: "Acme Intake Survey" } },
          emailTemplateId: "tpl-mir", emailTemplateName: "Mirror Email",
          variantMappings: [{
            templateId: "tpl-mir",
            variantTokenMapping: [
              { id: "subj::gs-mirh", tokenType: "STANDARD", tokenMapping: { name: "subj::gs-mirh", value: { type: "FIELD", fieldConfig: { field: "dv901", objectName: "ao_participant_custom_fields" }, label: "Vendor Portal Provider" } } },
              { id: "embd::gs-mirb", tokenType: "STANDARD", tokenMapping: { name: "embd::gs-mirb", value: { type: "FIELD", fieldConfig: { field: "dv901", objectName: "ao_participant_custom_fields" }, label: "Vendor Portal Provider" } } },
              { id: "embd::gs-mirc", tokenType: "STANDARD", tokenMapping: { name: "embd::gs-mirc", value: { type: "DYNAMIC_QUERY_V2", fieldConfig: { fieldId: "calc-9" }, label: "Owner Name Calc" } } },
              { id: "gs-mir-svy", tokenType: "SurveyToken", surveyToken: { tokenType: "SURVEY", language: "en_us" } },
              { id: "unsubscribeText", tokenType: "STANDARD", tokenMapping: { name: "unsubscribeText", value: { type: "value", valueType: "STRING", value: "unsub" } } },
            ],
          }],
        }),
      }],
    }),
    participantSourceConfigurations: [{
      participantSourceConfigurationId: "cfg-pf", participantSourceType: "DATA_DESIGNER", participantSourceName: "Mirror Query",
      customMappings: JSON.stringify({ dv901: { fieldName: "Vendor Portal Provider" } }),
    }],
  };
  // classic generation (variantTokenMapping OBJECT shape)
  const classicAo = {
    advancedOutreachId: "prog-cb", advancedOutreachName: "Classic Binder", advancedOutreachStatus: ["PROCESSING"],
    advancedOutreachModel: "DRIPV2",
    stepJson: JSON.stringify([{
      stepId: "s1", stepType: "ACTION", actionType: "OUTBOUND_CALL", outboundAction: "SEND_EMAIL", stepName: "Send", order: 1,
      emailActionJson: JSON.stringify({
        emailTemplateId: "tpl-cb", emailTemplateName: "CB Email",
        variantMappings: [{
          variantTokenMapping: {
            templateId: "tpl-cb",
            tokenMapping: { tokens: [{ name: "embd::gs-cb1", value: { type: "field", field: "dv901", fieldLabel: "Vendor Portal Provider", objectName: "participantscustomcollection", valueType: "STRING" } }] },
            surveyTokenMappings: [],
          },
        }],
      }),
    }]),
  };
  const pf = parseJourneyDoc(jDoc("prog-mir", "Acme Mirror Campaign", flowAo), "kb/journey/prog-mir.md").entry;
  const cb = parseJourneyDoc(jDoc("prog-cb", "Classic Binder", classicAo), "kb/journey/prog-cb.md").entry;
  const IX = {
    slug: "fixture-tenant", baseUrl: "unknown", environment: "sandbox", generatedAt: "2026-07-17T00:00:00.000Z", liveSweepAt: null,
    programs: { "prog-mir": pf, "prog-cb": cb },
    templates: {
      "tpl-mir": {
        id: "tpl-mir", title: "Mirror Email", subject: "Updated process with ${subj::gs-mirh}", folderId: null, active: true,
        body: "Your provider is ${embd::gs-mirb}. Your CSM: ${embd::gs-mirc}. Take it: ${gs-mir-svy}", variants: [], tokens: [],
        docPath: "fixture-tenant/journey-email-templates/tpl-mir.md", bodyIncluded: true,
      },
      "tpl-cb": {
        id: "tpl-cb", title: "CB Email", subject: "Plain subject", folderId: null, active: true,
        body: "Hello ${embd::gs-cb1}, welcome.", variants: [], tokens: null,
        docPath: "fixture-tenant/journey-email-templates/tpl-cb.md", bodyIncluded: true,
      },
    },
    links: {
      templateToPrograms: { "tpl-mir": ["prog-mir"], "tpl-cb": ["prog-cb"] },
      programToTemplates: { "prog-mir": ["tpl-mir"], "prog-cb": ["tpl-cb"] },
    },
    gaps: { referencedTemplatesMissing: [], stubs: [], liveOnly: [], kbOnly: [], statusDrift: [] },
    parseErrors: [],
  };

  // the reproduction: --object + --field + --scan-tokens must return token
  // rows naming BOTH subject and body locations (was tokenRows: 0)
  const r = scanDeps(IX, { objectTerms: ["ao_participant_custom_fields"], fieldTerms: ["Vendor Portal Provider"], tokens: true });
  const locs = r.tokenRows.filter((x) => x.program.id === "prog-mir").map((x) => x.location);
  check(
    "ER-19 known answer: bound field fires token rows in subject AND body (label handle, raw ids kept)",
    r.tokenRows.length >= 3 && locs.includes("subject") && locs.includes("body") &&
      r.tokenRows.some((x) => x.token === "${subj::gs-mirh}" && x.handle === "label" && x.candidate === "Vendor Portal Provider") &&
      r.tokenRows.some((x) => x.token === "${embd::gs-mirb}"),
    r.tokenRows.map((x) => [x.program.id, x.location, x.token, x.handle])
  );
  check(
    "ER-19: classic-generation binding fires too",
    r.tokenRows.some((x) => x.program.id === "prog-cb" && x.token === "${embd::gs-cb1}" && x.location === "body"),
    r.tokenRows.filter((x) => x.program.id === "prog-cb")
  );
  check(
    "ER-19: participant-source row persists independently (fieldUsageRows unaffected)",
    r.fieldRows.length === 1 && r.fieldRows[0].kind === "custom" && r.fieldRows[0].program.id === "prog-mir",
    r.fieldRows.map((x) => [x.program.id, x.kind])
  );
  check(
    "ER-19: survey and literal tokens are never candidates (no rows, no errors)",
    !r.tokenRows.some((x) => x.token.includes("gs-mir-svy") || x.token.includes("unsubscribeText")),
    r.tokenRows.map((x) => x.token)
  );
  // field API name and objectName-qualified handles
  const byField = scanDeps(IX, { fieldTerms: ["dv901"], tokens: true });
  check(
    "ER-19: field API name handle matches (reports which handle hit)",
    byField.tokenRows.some((x) => x.handle === "field name" && x.candidate === "dv901"),
    byField.tokenRows.map((x) => [x.handle, x.candidate])
  );
  const byQualified = scanDeps(IX, { fieldTerms: ["ao_participant_custom_fields.dv901"], tokens: true });
  check(
    "ER-19: objectName-qualified handle matches",
    byQualified.tokenRows.some((x) => x.handle === "object-qualified" && x.candidate === "ao_participant_custom_fields.dv901"),
    byQualified.tokenRows.map((x) => [x.handle, x.candidate])
  );
  // calc-bound: label-only match, flagged
  const byCalc = scanDeps(IX, { fieldTerms: ["Owner Name Calc"], tokens: true });
  check(
    "ER-19: calc-bound token matches by label only and carries the calc flag",
    byCalc.tokenRows.length >= 1 && byCalc.tokenRows.every((x) => x.calc === true && x.handle === "label") &&
      /calc field, source not resolvable/.test(tokenMatchedVia(byCalc.tokenRows[0])),
    byCalc.tokenRows.map((x) => [x.token, x.handle, x.calc])
  );
  // S7 alias/separator composition reaches binding handles
  const bySep = scanDeps(IX, { fieldTerms: ["Vendor_Portal_Provider"], tokens: true, aliasPrefix: compileAliasPrefix("^[A-Z]_") });
  check(
    "ER-19: separator-equivalence (S7 alias rules) composes with binding handles",
    bySep.tokenRows.some((x) => x.how === "separator-equivalent"),
    bySep.tokenRows.map((x) => [x.candidate, x.how])
  );
  // a binding whose token isn't in any captured text still rows as evidence
  const IX2 = JSON.parse(JSON.stringify(IX));
  IX2.templates["tpl-cb"].body = "no tokens in this body";
  const noText = scanDeps(IX2, { fieldTerms: ["Vendor Portal Provider"], tokens: true });
  check(
    "ER-19: binding not locatable in captured text still rows (binding evidence)",
    noText.tokenRows.some((x) => x.program.id === "prog-cb" && x.template === null && /not located in captured template text/.test(x.location)),
    noText.tokenRows.filter((x) => x.program.id === "prog-cb").map((x) => x.location)
  );

  // dedup across the two scan paths: a FIELD-NAME-STYLE token that both the
  // binding path and the token-text path match must collapse to ONE row even
  // when the binding key and the in-text spelling differ by the gs- prefix
  // (the dedup key canonicalizes the token via the shared grammar; the
  // binding row runs first and wins)
  const IX3 = JSON.parse(JSON.stringify(IX));
  IX3.programs["prog-cb"].steps[0].tokens = [
    // field-name-style token: the TEXT spelling drops the gs- prefix, so the
    // token-text path independently matches the same physical token
    { tokenKey: "gs-Renewal_ID", kind: "field", label: "Renewal_ID", objectName: "obj", fieldName: "Renewal_ID", fieldId: null, survey: null },
  ];
  IX3.templates["tpl-cb"].body = "Your id is ${Renewal_ID}, thanks.";
  const dedup = scanDeps(IX3, { fieldTerms: ["Renewal_ID"], tokens: true });
  const cbRows = dedup.tokenRows.filter((x) => x.program.id === "prog-cb");
  check(
    "ER-19: binding row + token-text row for the same physical token collapse to ONE (binding wins)",
    cbRows.length === 1 && cbRows[0].handle !== "token text" && cbRows[0].location === "body",
    cbRows.map((x) => [x.token, x.handle, x.location])
  );

  // pre-C1v2 index (steps carry NO tokens field at all): the binding-claiming
  // caveat must be replaced by a loud rebuild-the-index caveat
  const IX4 = JSON.parse(JSON.stringify(IX));
  for (const p of Object.values(IX4.programs)) for (const s of p.steps) delete s.tokens;
  const IX4_PATH = join(ROOT, "er-index-prev2.json");
  writeFileSync(IX4_PATH, JSON.stringify(IX4));
  const preV2 = runCli("deps", "--index", IX4_PATH, "--field", "Vendor Portal Provider", "--scan-tokens", "--report", join(ROOT, "r-prev2"));
  const preV2Md = readFileSync(preV2.summary.reportPath, "utf8");
  check(
    "ER-19: pre-C1v2 index → rebuild-the-index caveat, never a false binding-resolution claim",
    preV2.res.status === 0 && preV2Md.includes("NO step in this index carries token bindings") &&
      !preV2Md.includes("resolves each program's own token bindings"),
    preV2Md.split("\n").filter((l) => l.includes("scan-tokens")).slice(0, 3)
  );
}

{
  const noTerms = runCli("deps", "--index", INDEX_PATH, "--report", join(ROOT, "r5"));
  check("cli: no --object/--field exits 1 with usage", noTerms.res.status === 1 && /usage/.test(noTerms.res.stderr), noTerms.res.stderr);
  const both = runCli("deps", "--index", INDEX_PATH, "--field", "x", "--all", "--active-only", "--report", join(ROOT, "r6"));
  check("cli: --all + --active-only contradict → exit 1", both.res.status === 1 && /contradict/.test(both.res.stderr), both.res.stderr);
  const empty = runCli("deps", "--index", INDEX_PATH, "--field", "  ", "--report", join(ROOT, "r7"));
  check("cli: blank term exits 1 (exact match on nothing = confidently empty report)", empty.res.status === 1 && /non-empty/.test(empty.res.stderr), empty.res.stderr);
  const dup = runCli("deps", "--index", INDEX_PATH, "--field", "ARR", "--field", "arr", "--report", join(ROOT, "r8"));
  check(
    "cli: duplicate terms deduped with a warning — case-insensitively, like matching",
    dup.res.status === 0 && dup.summary?.warnings?.some((w) => /duplicate/.test(w)) && dup.summary?.counts?.fieldUsageRows === 1,
    dup.summary?.warnings
  );
  const tokNoField = runCli("deps", "--index", INDEX_PATH, "--object", "Company", "--scan-tokens", "--report", join(ROOT, "r9"));
  check(
    "cli: --scan-tokens without --field warns (tokens match field terms only)",
    tokNoField.res.status === 0 && tokNoField.summary?.warnings?.some((w) => /--scan-tokens/.test(w)),
    tokNoField.summary?.warnings
  );
  // F-197: an NFD spelling of an NFC term is the SAME term — the dedupe key
  // is termKey'd, so the pair collapses with the duplicate warning and the
  // args line + re-run footer emit --field once each (raw-lowered dedupe let
  // both survive: doubled TOKEN rows, term listed twice, footer twice).
  // Codepoints via fromCharCode - the source stays ASCII (F-130 rule).
  const nfcCafe = "Caf" + String.fromCharCode(0xe9); // precomposed e-acute (NFC)
  const nfdCafe = "Cafe" + String.fromCharCode(0x301); // e + combining acute (NFD)
  const dupNfd = runCli("deps", "--index", INDEX_PATH, "--field", nfcCafe, "--field", nfdCafe, "--report", join(ROOT, "r-nfd-dup"));
  const mdNfd = readFileSync(dupNfd.summary.reportPath, "utf8");
  check(
    "cli: NFD duplicate of an NFC --field term dedupes with the warning (F-197)",
    dupNfd.res.status === 0 && dupNfd.summary?.warnings?.some((w) => /1 duplicate/.test(w)) &&
      (mdNfd.match(/--field '?Caf/g) ?? []).length === 2, // the TERM-carrying flag: args line + re-run footer, once each (the duplicate-drop caveat also says "--field", F-429 second pass, and carries no term)
    { warnings: dupNfd.summary?.warnings, fieldMentions: (mdNfd.match(/--field '?Caf/g) ?? []).length }
  );
}

// ── --alias-prefix: alias-aware field matching (ER-21/ER-23) ─────────────────
// Acceptance-shaped fixture (all data fictional): the same field exists
// unprefixed in one program and task-alias-prefixed in another — an exact-only
// run finds 1 of 2; an alias-aware run must find both, with NO new false
// positives from the deliberately similar-but-unrelated names.

{
  const src = (cfg, customs, conditions = []) => ({
    configId: cfg, type: "DYNAMIC_QUERY_V2", name: `Src ${cfg}`,
    mappings: { standard: {}, custom: customs }, conditions,
  });
  const ALIAS_INDEX = {
    ...INDEX,
    programs: {
      "prog-plain": program("prog-plain", "Plain Renewal Program", "PROCESSING", {
        sources: [src("cfg-p", [{ id: "gsid-p", fieldName: "Renewal ID" }])],
      }),
      "prog-aliased": program("prog-aliased", "Aliased Renewal Program", "PROCESSING", {
        sources: [src("cfg-a", [{ id: "gsid-a", fieldName: "A_Renewal ID" }])],
      }),
      // similar-but-unrelated names: none may ever match 'Renewal ID'
      "prog-traps": program("prog-traps", "Trap Program", "PROCESSING", {
        sources: [src("cfg-t", [
          { id: "gsid-t1", fieldName: "Renewal IDX" },
          { id: "gsid-t2", fieldName: "X_Renewal" },
          { id: "gsid-t3", fieldName: "AB_Renewal ID" },
          { id: "gsid-t4", fieldName: "Q_Renewal ID Extra" },
          { id: "gsid-t5", fieldName: "Most_Recent_Related_Renewal_Stage" },
          { id: "gsid-t6", fieldName: "Contract Amount" },
        ])],
      }),
      // separator equivalence (real docs carry both `X_Foo Bar` and `X_Foo_Bar`)
      "prog-sep": program("prog-sep", "Separator Program", "PROCESSING", {
        sources: [src("cfg-s", [], [condition("Deal", "B_Contract_Value", null)])],
      }),
      "prog-sep2": program("prog-sep2", "Separator Program 2", "PROCESSING", {
        sources: [src("cfg-s2", [], [condition("Deal", "Contract_Value", null)])],
      }),
    },
    templates: {}, links: { templateToPrograms: {}, programToTemplates: {} },
    gaps: { referencedTemplatesMissing: [], stubs: [], liveOnly: [], kbOnly: [], statusDrift: [] },
  };
  const ALIAS_PATH = join(ROOT, "er-index-alias.json");
  writeFileSync(ALIAS_PATH, JSON.stringify(ALIAS_INDEX));
  const alias = compileAliasPrefix("^[A-Z]_");

  const before = scanDeps(ALIAS_INDEX, { fieldTerms: ["Renewal ID"] });
  check(
    "scanDeps: WITHOUT --alias-prefix the aliased dependent is missed (today's behavior, unchanged) and no near-miss list appears",
    before.fieldRows.length === 1 && before.fieldRows[0].program.id === "prog-plain" && before.nearMisses.length === 0,
    before.fieldRows.map((r) => r.program.id)
  );
  const after = scanDeps(ALIAS_INDEX, { fieldTerms: ["Renewal ID"], aliasPrefix: alias });
  check(
    "scanDeps: WITH --alias-prefix BOTH dependents return (the ER-21 acceptance shape) — and nothing else",
    after.fieldRows.length === 2 &&
      after.fieldRows.some((r) => r.program.id === "prog-plain" && r.matchedHow === "exact") &&
      after.fieldRows.some((r) => r.program.id === "prog-aliased" && r.matchedHow === "task-alias" && r.matchedCandidate === "A_Renewal ID"),
    after.fieldRows.map((r) => [r.program.id, r.matchedHow, r.matchedCandidate])
  );
  check(
    "scanDeps: near-misses listed (word-sharing traps) but NEVER counted as rows",
    after.nearMisses.length === 1 && after.nearMisses[0].term === "Renewal ID" &&
      after.nearMisses[0].names.includes("Most_Recent_Related_Renewal_Stage") &&
      !after.nearMisses[0].names.includes("Contract Amount") &&
      !after.fieldRows.some((r) => r.program.id === "prog-traps"),
    after.nearMisses
  );
  const sep = scanDeps(ALIAS_INDEX, { fieldTerms: ["Contract Value"], aliasPrefix: alias });
  check(
    "scanDeps: separator equivalence — `B_Contract_Value` and `Contract_Value` both hit 'Contract Value'",
    sep.fieldRows.length === 2 &&
      sep.fieldRows.some((r) => r.program.id === "prog-sep" && r.matchedHow === "task-alias") &&
      sep.fieldRows.some((r) => r.program.id === "prog-sep2" && r.matchedHow === "separator-equivalent"),
    sep.fieldRows.map((r) => [r.program.id, r.matchedHow])
  );

  const cli = runCli("deps", "--index", ALIAS_PATH, "--field", "Renewal ID", "--alias-prefix", "^[A-Z]_", "--report", join(ROOT, "ra1"), "--csv-dir", join(ROOT, "ca1"));
  const md = readFileSync(cli.summary.reportPath, "utf8");
  check(
    "cli: --alias-prefix run — both rows, counts split, pattern named in the header line, provenance names the FLAG not the conventions (F-308)",
    cli.res.status === 0 && cli.summary?.counts?.fieldUsageRows === 2 && cli.summary?.counts?.aliasMatchedRows === 1 &&
      cli.summary?.aliasPrefix === "^[A-Z]_" &&
      md.includes("task-alias prefix stripping (`^[A-Z]_`, from the explicit `--alias-prefix` flag)") &&
      !md.includes("from the tenant conventions") &&
      md.includes("space↔underscore separator equivalence"),
    { counts: cli.summary?.counts, aliasPrefix: cli.summary?.aliasPrefix }
  );
  check(
    "cli: the match column says HOW (full prefixed candidate printed — the prefix names the task)",
    md.includes("Renewal ID (task-alias `A_Renewal ID`)") && md.includes("A_Renewal ID"),
    md.split("\n").filter((l) => l.includes("task-alias"))
  );
  check(
    "cli: near-miss caveat lists but does not count",
    md.includes("Possible related fields (NOT counted) for `Renewal ID`") && md.includes("Most_Recent_Related_Renewal_Stage") &&
      md.includes("never counted as usage") && cli.summary?.counts?.nearMissFields >= 1,
    null
  );
  const csv = readFileSync(join(ROOT, "ca1", "deps-usages.csv"), "utf8");
  check(
    "cli: CSV matched_how carries the mechanism + candidate (shared matchHowLabel rendering)",
    csv.includes("task-alias `A_Renewal ID`") && csv.includes("exact"),
    csv.slice(0, 400)
  );
  check("cli: re-run footer + args line carry --alias-prefix", md.includes("--alias-prefix"), null);

  // --alias-prefix with NO --field terms: aliasing can't run — the header
  // must not claim it is in force (that would contradict the warning)
  const noField = runCli("deps", "--index", ALIAS_PATH, "--object", "Company", "--alias-prefix", "^[A-Z]_", "--report", join(ROOT, "ra4"));
  const mdNoField = readFileSync(noField.summary.reportPath, "utf8");
  check(
    "cli: --alias-prefix without --field warns and the header does NOT claim alias matching",
    noField.summary?.warnings?.some((w) => /--alias-prefix has no effect/.test(w)) &&
      !mdNoField.includes("task-alias prefix stripping") &&
      !mdNoField.includes("field aliasing not in force"),
    { warnings: noField.summary?.warnings }
  );

  const bare = runCli("deps", "--index", ALIAS_PATH, "--field", "Renewal ID", "--report", join(ROOT, "ra2"));
  const mdBare = readFileSync(bare.summary.reportPath, "utf8");
  check(
    "cli: degrade — no --alias-prefix keeps today's rows PLUS the conventions-unavailable caveat (never a silent exact-only run)",
    bare.summary?.counts?.fieldUsageRows === 1 && bare.summary?.aliasPrefix === null &&
      mdBare.includes("Field matching ran EXACT-ONLY") && mdBare.includes("field aliasing not in force"),
    bare.summary?.counts
  );
  const badRe = runCli("deps", "--index", ALIAS_PATH, "--field", "x", "--alias-prefix", "([", "--report", join(ROOT, "ra3"));
  check("cli: invalid --alias-prefix regex exits 1", badRe.res.status === 1 && /not a valid regular expression/.test(badRe.res.stderr), badRe.res.stderr);
}

// ── --live-deps: dm-deps-check reconciliation (S5-V F2 remedy) ───────────────

const liveDepsPayload = (objectName, dependents, overallStatus = "COMPLETED") => ({
  result: true,
  data: {
    objectName,
    dependents: { JOURNEY_ORCHESTRATOR: dependents, RULE: [] },
    progressStatus: { overallStatus, areaStatusMap: {} },
  },
});
const dependent = (id, name, cols) => ({
  entityId: id,
  entityName: name,
  columnReferences: cols.map((c) => ({ name: c.toLowerCase(), dbName: c.toLowerCase(), displayName: c, fieldName: c.replace(/ /g, "_") })),
});

{
  const parsed = parseLiveDeps(JSON.stringify(liveDepsPayload("Company", [dependent("prog-filter", "Filter Program", ["Person ID"])])));
  check(
    "parseLiveDeps: object, COMPLETED flag, dependents with displayName columns",
    parsed?.objectName === "Company" && parsed?.complete === true && parsed?.dependents?.[0]?.id === "prog-filter" && parsed?.dependents?.[0]?.columns?.[0] === "Person ID",
    parsed
  );
  check("parseLiveDeps: unrecognizable payloads return null, never throw", parseLiveDeps("{ not json") === null && parseLiveDeps('{"data":{"foo":1}}') === null, null);

  // parseLiveDeps is the JO-filtered view of the all-areas primitive
  // (parseLiveDepsAreas, added for ER-11's tenant-wide scan) — the primitive
  // keeps every area, the view returns null when JO is absent.
  const areasParsed = parseLiveDepsAreas(JSON.stringify(liveDepsPayload("Company", [dependent("prog-filter", "Filter Program", ["Person ID"])])));
  check(
    "parseLiveDepsAreas: all areas kept; JO view delegates to it",
    Object.keys(areasParsed.areas).sort().join(",") === "JOURNEY_ORCHESTRATOR,RULE" &&
      JSON.stringify(areasParsed.areas.JOURNEY_ORCHESTRATOR) === JSON.stringify(parsed.dependents),
    areasParsed
  );
  // F-320: a structurally valid payload with no JOURNEY_ORCHESTRATOR area is
  // an ANSWER (zero JO dependents), not a malformed capture — the old null
  // here made "no JO dependents" warn as "not a recognizable dm-deps-check
  // payload — skipped", withholding the coverage softening.
  const noJo = parseLiveDeps('{"data":{"objectName":"x","dependents":{"RULE":[]},"progressStatus":{"overallStatus":"COMPLETED"}}}');
  check(
    "parseLiveDeps: valid payload with no JOURNEY_ORCHESTRATOR area = zero JO dependents",
    noJo?.objectName === "x" && noJo?.complete === true && Array.isArray(noJo?.dependents) && noJo.dependents.length === 0,
    noJo
  );

  // F-118: a BOM-prefixed --live-deps capture (the PowerShell-redirect normal
  // case on Windows) parses instead of silently degrading the report to a
  // KB-only view. BOM built via fromCharCode — never a literal (F-130 rule).
  const bommed = parseLiveDepsAreas(String.fromCharCode(0xfeff) + JSON.stringify(liveDepsPayload("Company", [dependent("prog-filter", "Filter Program", ["Person ID"])])));
  check("parseLiveDepsAreas: BOM-prefixed capture parses (F-118)", bommed?.objectName === "Company" && bommed?.complete === true, bommed);

  // reconcileLiveDeps must use scanDeps's own notion of "matched": a program
  // whose only KB-side match is a --scan-tokens row is IN the report above
  // and must not be relabeled live-only (S5-V post-rider review fix).
  const live = parseLiveDeps(JSON.stringify(liveDepsPayload("Company", [dependent("prog-token", "Token Program", ["Person ID"])])));
  const rec = reconcileLiveDeps(live, INDEX, {
    fieldRows: [],
    tokenRows: [{ program: INDEX.programs["prog-token"] }],
    objectLevel: [],
  });
  check(
    "reconcileLiveDeps: token-only KB matches count as inKbReport (consistent with scanDeps)",
    rec.rows[0]?.inKbReport === true && rec.liveOnly === 0 && rec.rows[0]?.status === "PROCESSING (kb)",
    rec.rows[0]
  );
}

{
  const fLive = join(ROOT, "live-deps-company.json");
  writeFileSync(
    fLive,
    JSON.stringify(
      liveDepsPayload("Company", [
        dependent("prog-filter", "Filter Program", ["Person ID", "Company ID"]),
        dependent("prog-live-9", "Mapping Side Journey", ["Company ID"]),
      ])
    )
  );
  const live = runCli("deps", "--index", INDEX_PATH, "--object", "Company", "--live-deps", fLive, "--all", "--report", join(ROOT, "r10"), "--csv-dir", join(ROOT, "c10"));
  const md = readFileSync(live.summary.reportPath, "utf8");
  check(
    "cli: --live-deps renders the live-dependents section with KB reconciliation",
    live.res.status === 0 &&
      md.includes("## Live dependents of `Company` (dm deps check)") &&
      md.includes("2 JO dependent(s); 1 also matched above; 1 live-only") &&
      md.includes("no — mapping/SELECT-side only") &&
      md.includes("not in KB") &&
      md.includes("Person ID, Company ID"),
    md.split("\n").filter((l) => l.includes("dependent") || l.includes("prog-live-9")).slice(0, 4)
  );
  check(
    "cli: live coverage swaps the filter-only caveat for the read-together note",
    !md.includes("Objects without live coverage") && md.includes("read them together"),
    null
  );
  check(
    "cli: live counts + liveDeps summary keys and the live CSV",
    live.summary?.counts?.liveDependents === 2 && live.summary?.counts?.liveOnlyDependents === 1 &&
      live.summary?.liveDeps?.[0]?.objectName === "Company" &&
      readFileSync(join(ROOT, "c10", "deps-live-dependents.csv"), "utf8").startsWith(
        "\uFEFF" + "object,program_id,program_name,status,in_kb_report,referenced_columns,capture_complete\r\n"
      ),
    live.summary
  );
  check(
    "cli: re-run footer carries --live-deps",
    md.includes("--live-deps") && live.summary?.counts !== undefined,
    null
  );

  const fInit = join(ROOT, "live-deps-init.json");
  writeFileSync(fInit, JSON.stringify(liveDepsPayload("Widget", [], "INIT")));
  const init = runCli("deps", "--index", INDEX_PATH, "--object", "Company", "--live-deps", fInit, "--all", "--report", join(ROOT, "r11"));
  const mdInit = readFileSync(init.summary.reportPath, "utf8");
  check(
    "cli: incomplete capture warns + renders the incompleteness note; object mismatch warns",
    init.summary?.warnings?.some((w) => /not COMPLETED/.test(w)) &&
      init.summary?.warnings?.some((w) => /not among the --object terms/.test(w)) &&
      mdInit.includes("capture incomplete"),
    init.summary?.warnings
  );
  // An INCOMPLETE capture for the requested object renders its section (with
  // the banner) but must NOT count as coverage — the strong filter-only
  // caveat survives (S5-V post-rider review fix).
  const fInitSame = join(ROOT, "live-deps-init-company.json");
  writeFileSync(fInitSame, JSON.stringify(liveDepsPayload("Company", [], "INIT")));
  const initSame = runCli("deps", "--index", INDEX_PATH, "--object", "Company", "--live-deps", fInitSame, "--all", "--report", join(ROOT, "r13"));
  const mdInitSame = readFileSync(initSame.summary.reportPath, "utf8");
  check(
    "cli: incomplete capture for the term does NOT soften the strong caveat",
    mdInitSame.includes("capture incomplete") && mdInitSame.includes("FILTER-CONDITIONS-ONLY") && !mdInitSame.includes("read them together"),
    initSame.summary?.warnings
  );

  const fBadLive = join(ROOT, "live-deps-bad.json");
  writeFileSync(fBadLive, "{ nope");
  const bad = runCli("deps", "--index", INDEX_PATH, "--object", "Company", "--live-deps", fBadLive, "--all", "--report", join(ROOT, "r12"));
  check(
    "cli: unparseable --live-deps file warns and is skipped — KB-side report still written",
    bad.res.status === 0 && bad.summary?.warnings?.some((w) => /not a recognizable/.test(w)) && bad.summary?.reportPath,
    bad.summary?.warnings
  );

  // F-197: a completed capture must count as coverage for its --object term
  // across NFC/NFD and padding — the term is padded NFC, the payload
  // objectName NFD. Raw-lowered compares fired the false "Objects without
  // live coverage" caveat AND the false objectName warning while DROPPING
  // the read-together caveat, in the same report that renders the live
  // section. Codepoints via fromCharCode (F-130 rule).
  const nfcTerm = " Caf" + String.fromCharCode(0xe9) + " "; // padded, precomposed
  const nfdName = "Caf" + String.fromCharCode(0x65, 0x301); // e + combining acute
  const fNfd = join(ROOT, "live-deps-nfd.json");
  writeFileSync(fNfd, JSON.stringify(liveDepsPayload(nfdName, [])));
  const nfd = runCli("deps", "--index", INDEX_PATH, "--object", nfcTerm, "--live-deps", fNfd, "--all", "--report", join(ROOT, "r-nfd-cov"));
  const mdNfdCov = readFileSync(nfd.summary.reportPath, "utf8");
  check(
    "cli: NFD/padded spellings — completed capture counts as coverage, no false objectName warning (F-197)",
    nfd.res.status === 0 &&
      !nfd.summary?.warnings?.some((w) => /not among the --object terms/.test(w)) &&
      !mdNfdCov.includes("Objects without live coverage") &&
      mdNfdCov.includes("read them together"),
    { warnings: nfd.summary?.warnings, caveatLines: mdNfdCov.split("\n").filter((l) => l.includes("live coverage") || l.includes("read them together")) }
  );
}

// ── ER-20: participant-source provenance (report-time resolution) ────────────
// Fixture mirrors the live acceptance shape (all data fictional): a
// DATA_DESIGNER source whose collectionId resolves to KB docs (the doc
// FILENAME is the collectionId, in journey-data-designer/ and
// data-management/), a CSV source (collectionId IS the uploaded filename), a
// QUERY_BUILDER Power List, and a DD whose KB docs are missing. Programs are
// built by RUNNING parseJourneyDoc so the three C1 v2 provenance fields
// provably flow payload → index → report.
{
  const KB = join(ROOT, "fixture-tenant"); // named as the index slug — the derive-fallback test depends on it
  mkdirSync(join(KB, "journey-data-designer"), { recursive: true });
  mkdirSync(join(KB, "data-management"), { recursive: true });
  const designerDoc = [
    "# Mirror Query", "",
    "- id: `mirror_query`", "- key: `journey-data-designer/mirror_query`", "- domain: journey-data-designer", "",
    "## Key fields",
    '- objectName: "mirror_query"', '- label: "Mirror Query"', "- fieldCount: 3", "",
    "## Raw",
    "```json",
    JSON.stringify(
      {
        objectName: "mirror_query", label: "Mirror Query", fieldCount: 3,
        fields: [
          { fieldName: "RenewalId", displayName: "Renewal ID", dataType: "SFDCID" },
          { fieldName: "AcctName", displayName: "Account Name", dataType: "STRING" },
          { fieldName: "RenewalIdx", displayName: "Renewal Index", dataType: "NUMBER" },
        ],
      },
      null,
      2
    ),
    "```", "",
  ].join("\n");
  const dmDoc = [
    "# Mirror Query", "",
    "- key: data-management/mirror_query", "- id: mirror_query",
    "- label: Mirror Query", "- description: Created for ACME-1", "",
    "```json",
    JSON.stringify({
      result: true,
      data: {
        label: "Mirror Query", description: "Created for ACME-1", dataStore: "REDSHIFT",
        columns: [{ name: "RenewalId", label: "Renewal ID", type: "string" }],
      },
    }),
    "```", "",
  ].join("\n");
  writeFileSync(join(KB, "journey-data-designer", "mirror_query.md"), designerDoc);
  writeFileSync(join(KB, "data-management", "mirror_query.md"), dmDoc);

  // F-129: a collectionId whose casing differs from the on-disk doc name must
  // still resolve (case-insensitive directory fallback) instead of emitting a
  // false reason:"missing" on Linux. Probed through resolveProvenance with a
  // MIXED-case collectionId over the lowercase docs above — on Windows the FS
  // folds it anyway; the fallback is what makes Linux behave the same.
  {
    const entries = [{
      program: { id: "prog-case", name: "Case Program" },
      source: { participantSourceType: "DATA_DESIGNER", participantSourceCollectionId: "Mirror_Query", name: "Mirror Query" },
      matchedColumns: [],
    }];
    const got = resolveProvenance(entries, { kbDir: KB });
    check("F-129: mixed-case collectionId resolves via directory fallback", got.entries[0]?.resolved === true && got.missingDocs.length === 0, { resolved: got.entries[0]?.resolved, missing: got.missingDocs });
    // a genuinely absent doc still reports missing — the fallback must not
    // resurrect nonexistent docs
    const ghost = resolveProvenance([{ program: { id: "p-g", name: "G" }, source: { participantSourceType: "DATA_DESIGNER", participantSourceCollectionId: "truly_absent_query", name: "G" }, matchedColumns: [] }], { kbDir: KB });
    check("F-129: genuinely absent doc still reports missing", ghost.entries[0]?.resolved === false && ghost.missingDocs.some((m) => m.reason === "missing"), ghost.missingDocs);
  }

  const dd = parseDesignerFieldsDoc(designerDoc);
  check(
    "ER-20 parseDesignerFieldsDoc: label + field dictionary (fieldName/displayName/dataType)",
    dd?.label === "Mirror Query" && dd.fields.length === 3 && dd.fields[0].fieldName === "RenewalId" && dd.fields[0].displayName === "Renewal ID" && dd.fields[0].dataType === "SFDCID",
    dd
  );
  const dm = parseDmObjectDoc(dmDoc);
  check(
    "ER-20 parseDmObjectDoc: label + description + columns in the dictionary shape",
    dm?.label === "Mirror Query" && dm.description === "Created for ACME-1" && dm.dataStore === "REDSHIFT" && dm.columns[0]?.fieldName === "RenewalId" && dm.columns[0]?.displayName === "Renewal ID",
    dm
  );
  check(
    "ER-20 parsers: unparseable docs return null, never throw",
    parseDesignerFieldsDoc("# no fence here") === null && parseDmObjectDoc("```json\n{ nope\n```") === null && parseDesignerFieldsDoc(null) === null,
    null
  );
  check(
    "ER-20 classifySource: DATA_DESIGNER / CSV / QUERY_BUILDER / everything else",
    classifySource({ participantSourceType: "DATA_DESIGNER" }) === "data-designer" &&
      classifySource({ participantSourceType: "CSV" }) === "csv" &&
      classifySource({ participantSourceType: "QUERY_BUILDER" }) === "power-list" &&
      classifySource({ participantSourceType: "QUERY" }) === "other" &&
      classifySource({}) === "other",
    null
  );
  const alias20 = compileAliasPrefix("^[A-Z]_");
  const ties = tieToFieldDictionary(["Renewal ID", "A_Renewal ID"], dd.fields, alias20);
  check(
    "ER-20 tieToFieldDictionary: exact + task-alias (prefix on the mapping column) tie to the SAME dictionary field, never substring",
    ties.filter((t) => t.fieldName === "RenewalId").length === 2 &&
      ties.some((t) => t.column === "Renewal ID" && t.how === "exact") &&
      ties.some((t) => t.column === "A_Renewal ID" && t.how === "task-alias") &&
      !ties.some((t) => t.fieldName === "RenewalIdx"),
    ties
  );
  check(
    "ER-20 tieToFieldDictionary: task-alias prefix on the DICTIONARY side ties too (both directions)",
    tieToFieldDictionary(["Task Col"], [{ fieldName: "B_Task Col", displayName: "B_Task Col", dataType: "STRING" }], alias20).length === 1 &&
      tieToFieldDictionary(["Task Col"], [{ fieldName: "B_Task Col", displayName: "B_Task Col", dataType: "STRING" }], null).length === 0,
    null
  );

  // programs through parseJourneyDoc — the acceptance path payload → index
  const jDoc20 = (id, name, sources) =>
    [`# ${name}`, "", `- key: journey/${id}`, `- id: ${id}`, `- name: ${name}`, "", "```json",
      JSON.stringify({ result: true, data: { advancedOutreach: {
        advancedOutreachId: id, advancedOutreachName: name, advancedOutreachStatus: ["PROCESSING"],
        advancedOutreachModel: "DRIPV2", stepJson: JSON.stringify([]),
        participantSourceConfigurations: sources,
      } } }),
      "```", ""].join("\n");
  const srcPayload = (cfg, type, name, collectionId, operationType, custom) => ({
    participantSourceConfigurationId: cfg, participantSourceType: type, participantSourceName: name,
    participantSourceCollectionId: collectionId, participantOperationType: operationType,
    customMappings: JSON.stringify(custom),
  });
  const entryOf = (id, name, sources) => parseJourneyDoc(jDoc20(id, name, sources), `fixture-tenant/journey/${id}.md`).entry;
  const pDd = entryOf("prog-dd", "DD Provenance Program", [
    srcPayload("cfg-dd", "DATA_DESIGNER", "Mirror Query", "mirror_query", "ADD_ALL_PARTICIPANT_FROM_QUERY", { ye1: { fieldName: "Renewal ID" }, ye2: { fieldName: "A_Renewal ID" } }),
  ]);
  const pCsv = entryOf("prog-csv", "CSV Upload Program", [
    srcPayload("cfg-csv", "CSV", "ACME upload", "ACME-360 upload_pt1.csv", "ADD_ALL_PARTICIPANT_FROM_CSV", { ye3: { fieldName: "Renewal ID" } }),
  ]);
  const pPl = entryOf("prog-pl", "Power List Program", [
    srcPayload("cfg-pl", "QUERY_BUILDER", "PL Query", "0f0e0d0c-1111-2222-3333-444455556666", "ADD_ALL_PARTICIPANT_IN_POWER_LIST", { ye4: { fieldName: "Renewal ID" } }),
  ]);
  const pGhost = entryOf("prog-ghost", "Ghost DD Program", [
    srcPayload("cfg-g", "DATA_DESIGNER", "Ghost Query", "ghost_query", null, { ye5: { fieldName: "Renewal ID" } }),
  ]);
  check(
    "ER-20 acceptance: all three provenance fields flow payload → index source entry",
    pDd.sources[0].participantSourceCollectionId === "mirror_query" &&
      pDd.sources[0].participantSourceType === "DATA_DESIGNER" &&
      pDd.sources[0].participantOperationType === "ADD_ALL_PARTICIPANT_FROM_QUERY",
    pDd.sources[0]
  );

  const IX20 = {
    slug: "fixture-tenant", baseUrl: "unknown", environment: "sandbox",
    generatedAt: "2026-07-17T00:00:00.000Z", liveSweepAt: null,
    programs: { "prog-dd": pDd, "prog-csv": pCsv, "prog-pl": pPl, "prog-ghost": pGhost },
    templates: {}, links: { templateToPrograms: {}, programToTemplates: {} },
    gaps: { referencedTemplatesMissing: [], stubs: [], liveOnly: [], kbOnly: [], statusDrift: [] },
    parseErrors: [],
  };
  const IX20_PATH = join(ROOT, "er-index-er20.json");
  writeFileSync(IX20_PATH, JSON.stringify(IX20));

  const scan20 = scanDeps(IX20, { fieldTerms: ["Renewal ID"], aliasPrefix: alias20 });
  const collected = collectProvenanceSources(scan20);
  check(
    "ER-20 collectProvenanceSources: one entry per matched source, matched columns gathered (both spellings, matched:true)",
    collected.length === 4 &&
      collected
        .find((e) => e.program.id === "prog-dd")
        ?.matchedColumns.map((c) => `${c.column}:${c.matched}`)
        .join("|") === "A_Renewal ID:true|Renewal ID:true",
    collected.map((e) => [e.program.id, e.matchedColumns])
  );

  const p1 = runCli("deps", "--index", IX20_PATH, "--field", "Renewal ID", "--alias-prefix", "^[A-Z]_", "--kb", KB, "--report", join(ROOT, "rp1"), "--csv-dir", join(ROOT, "cp1"));
  const mdP = readFileSync(p1.summary.reportPath, "utf8");
  check(
    "ER-20 cli: provenance section renders all four kinds honestly",
    p1.res.status === 0 && mdP.includes("## Participant-source provenance") &&
      mdP.includes("Data Designer **Mirror Query** (`mirror_query`)") &&
      mdP.includes("CSV upload: ACME-360 upload_pt1.csv") &&
      mdP.includes("Power List `0f0e0d0c-1111-2222-3333-444455556666` — not resolvable via CLI") &&
      mdP.includes("Data Designer `ghost_query` — KB doc missing"),
    { status: p1.res.status, stderr: p1.res.stderr?.slice(0, 300) }
  );
  check(
    "ER-20 cli: DD detail — description + KB doc links + field-dictionary ties (exact and task-alias)",
    mdP.includes("description: Created for ACME-1") && mdP.includes("data store: REDSHIFT") &&
      /KB docs: .*journey-data-designer.*mirror_query\.md/.test(mdP) &&
      mdP.includes('`Renewal ID` ↔ `RenewalId` ("Renewal ID", SFDCID)') &&
      mdP.includes("`A_Renewal ID` ↔ `RenewalId`") && mdP.includes("[task-alias]"),
    mdP.split("\n").filter((l) => l.includes("↔") || l.includes("KB doc"))
  );
  check(
    "ER-20 cli: missing DD doc caveats name BOTH fetches — never an empty column",
    mdP.includes("Data Designer `ghost_query`") &&
      mdP.includes("jo dd get --name 'ghost_query'") &&
      mdP.includes("dm o describe --name 'ghost_query'") &&
      mdP.includes("describe-batch"),
    mdP.split("\n").filter((l) => l.includes("ghost_query"))
  );
  check(
    "ER-20 cli: standing where-resolution-stops caveat renders (connection hop unreachable, never guessed)",
    mdP.includes("Where provenance resolution STOPS") && mdP.includes("UNREACHABLE") &&
      mdP.includes("never inferred from payload text") && mdP.includes("no CLI surface"),
    null
  );
  check(
    "ER-20 cli: summary counts (4 sources: 1 DD resolved, 1 DD with 2 missing docs, 1 CSV, 1 power list)",
    p1.summary?.counts?.provenanceSources === 4 && p1.summary?.counts?.ddResolved === 1 &&
      p1.summary?.counts?.ddDocsMissing === 2 && p1.summary?.counts?.csvSources === 1 &&
      p1.summary?.counts?.powerListSources === 1,
    p1.summary?.counts
  );
  check("ER-20 cli: re-run footer carries --kb", mdP.includes("--kb"), null);
  const srcCsv = readFileSync(join(ROOT, "cp1", "deps-sources.csv"), "utf8");
  check(
    "ER-20 cli: deps-sources.csv mirrors the provenance section (pointers, provenance, ties)",
    srcCsv.startsWith("\uFEFF" + "program_id,program_name,status,source,source_type,operation_type,collection_id,provenance,dd_label,dd_description,dd_kb_docs,column_ties\r\n") &&
      srcCsv.includes("mirror_query") && srcCsv.includes("Created for ACME-1") &&
      srcCsv.includes("Renewal ID <-> RenewalId") && srcCsv.includes("ADD_ALL_PARTICIPANT_IN_POWER_LIST"),
    srcCsv.slice(0, 500)
  );

  // KB dir derived from index.slug relative to the CWD (kbDocDisplayPath's
  // own assumption) when --kb is absent
  const runCliCwd = (cwd, ...args) => {
    const res = spawnSync(process.execPath, [JO_REPORT, ...args], { encoding: "utf8", cwd });
    let summary = null;
    try { summary = JSON.parse(res.stdout); } catch { /* asserted by callers */ }
    return { res, summary };
  };
  const p2 = runCliCwd(ROOT, "deps", "--index", IX20_PATH, "--field", "Renewal ID", "--report", join(ROOT, "rp2"));
  const mdP2 = readFileSync(p2.summary.reportPath, "utf8");
  check(
    "ER-20 cli: no --kb — KB dir derived from index.slug when it exists relative to the CWD",
    p2.res.status === 0 && p2.summary?.counts?.ddResolved === 1 && mdP2.includes("Data Designer **Mirror Query**"),
    p2.summary?.counts
  );
  // ...and when the slug does NOT exist relative to the CWD: honest cell +
  // caveat; pointer-only kinds (CSV / power list) still render
  const p3 = runCli("deps", "--index", IX20_PATH, "--field", "Renewal ID", "--report", join(ROOT, "rp3"));
  const mdP3 = readFileSync(p3.summary.reportPath, "utf8");
  check(
    "ER-20 cli: KB unreachable → --kb caveat + honest DD cells; CSV/power-list provenance unaffected",
    p3.summary?.counts?.ddResolved === 0 && mdP3.includes("KB directory unavailable") &&
      mdP3.includes("--kb <slugDir>") && mdP3.includes("CSV upload: ACME-360 upload_pt1.csv"),
    p3.summary?.counts
  );
  const badKb = runCli("deps", "--index", IX20_PATH, "--field", "x", "--kb", join(ROOT, "no-such-dir"), "--report", join(ROOT, "rp4"));
  check("ER-20 cli: --kb pointing nowhere exits 1 (never a silent unresolved run)", badKb.res.status === 1 && /--kb/.test(badKb.res.stderr), badKb.res.stderr);

  // pre-C1v2 index: sources carry no provenance pointers at all → loud
  // rebuild caveat, no provenance section (mirror of ER-19's pre-v2 rule)
  const IXPRE = JSON.parse(JSON.stringify(IX20));
  for (const p of Object.values(IXPRE.programs))
    for (const s of p.sources) {
      delete s.participantSourceCollectionId;
      delete s.participantSourceType;
      delete s.participantOperationType;
    }
  const IXPRE_PATH = join(ROOT, "er-index-er20-prev2.json");
  writeFileSync(IXPRE_PATH, JSON.stringify(IXPRE));
  const pre = runCli("deps", "--index", IXPRE_PATH, "--field", "Renewal ID", "--kb", KB, "--report", join(ROOT, "rp5"));
  const mdPre = readFileSync(pre.summary.reportPath, "utf8");
  check(
    "ER-20 cli: pre-C1v2 index → rebuild-the-index caveat, no provenance section, no false claims",
    pre.res.status === 0 && mdPre.includes("no source in this index carries provenance pointers") &&
      !mdPre.includes("## Participant-source provenance") && pre.summary?.counts?.provenanceSources === 0,
    mdPre.split("\n").filter((l) => l.includes("provenance")).slice(0, 3)
  );

  // ── review-fix regressions (S9 pre-merge review) ───────────────────────────
  // A second fixture index so the counts asserted above stay untouched:
  // corrupt doc (exists-but-unparseable), one absent DD shared by TWO
  // programs, a partial-present DD (designer doc only), a docBaseName-mangled
  // collectionId, an object-only tie, and a CSV-only standing caveat.
  writeFileSync(join(KB, "journey-data-designer", "corrupt_query.md"), "# Corrupt Query\n\n```json\n{ this is not json\n```\n");
  writeFileSync(
    join(KB, "journey-data-designer", "half_query.md"),
    ["# Half Query", "", "## Raw", "```json", JSON.stringify({ objectName: "half_query", label: "Half Query", fieldCount: 1, fields: [{ fieldName: "HalfCol", displayName: "Half Col", dataType: "STRING" }] }), "```", ""].join("\n")
  );
  const mangledId = "Mangled Query";
  writeFileSync(
    join(KB, "journey-data-designer", `${docBaseName(mangledId)}.md`),
    ["# Mangled Query", "", "## Raw", "```json", JSON.stringify({ objectName: mangledId, label: "Mangled Query", fieldCount: 0, fields: [] }), "```", ""].join("\n")
  );
  const srcWithCondition = (cfg, collectionId) => ({
    participantSourceConfigurationId: cfg, participantSourceType: "DATA_DESIGNER", participantSourceName: "Cond Query",
    participantSourceCollectionId: collectionId, participantOperationType: null,
    config: JSON.stringify({ filters: { conditions: [{ leftOperand: { objectName: "AcmeObj", fieldName: "RenewalId", label: "Renewal ID Filter" }, comparisonOperator: "EQUALS", filterAlias: "A" }] } }),
  });
  const IX20B = {
    ...IX20,
    programs: {
      "prog-corrupt": entryOf("prog-corrupt", "Corrupt Doc Program", [srcPayload("cfg-cor", "DATA_DESIGNER", "Corrupt Query", "corrupt_query", null, { c1: { fieldName: "Renewal ID" } })]),
      "prog-ghostA": entryOf("prog-ghostA", "Ghost Shared A", [srcPayload("cfg-ga", "DATA_DESIGNER", "Ghost Shared", "ghost2_query", null, { g1: { fieldName: "Renewal ID" } })]),
      "prog-ghostB": entryOf("prog-ghostB", "Ghost Shared B", [srcPayload("cfg-gb", "DATA_DESIGNER", "Ghost Shared", "ghost2_query", null, { g2: { fieldName: "Renewal ID" } })]),
      "prog-half": entryOf("prog-half", "Half Doc Program", [srcPayload("cfg-h", "DATA_DESIGNER", "Half Query", "half_query", null, { h1: { fieldName: "Renewal ID" } })]),
      "prog-mangle": entryOf("prog-mangle", "Mangled Id Program", [srcPayload("cfg-m", "DATA_DESIGNER", "Mangled Query", mangledId, null, { m1: { fieldName: "Renewal ID" } })]),
      "prog-obj": entryOf("prog-obj", "Object Only Program", [srcWithCondition("cfg-o", "mirror_query")]),
      "prog-csvonly": entryOf("prog-csvonly", "Csv Only Program", [srcPayload("cfg-co", "CSV", "Csv Only upload", "ACME-361 upload_pt2.csv", "ADD_ALL_PARTICIPANT_FROM_CSV", { co1: { fieldName: "Csv Only Field" } })]),
    },
  };
  const IX20B_PATH = join(ROOT, "er-index-er20b.json");
  writeFileSync(IX20B_PATH, JSON.stringify(IX20B));

  const fx = runCli("deps", "--index", IX20B_PATH, "--field", "Renewal ID", "--kb", KB, "--report", join(ROOT, "rp6"));
  const mdFx = readFileSync(fx.summary.reportPath, "utf8");
  check(
    "review-fix C1: exists-but-unparseable DD doc → honest cell + re-fetch caveat (never a promised-but-absent caveat)",
    mdFx.includes("Data Designer `corrupt_query` — KB doc unparseable (re-fetch named in caveats)") &&
      mdFx.includes("exists but could not be parsed; re-fetch with `gs-admin --json jo dd get --name 'corrupt_query'`"),
    mdFx.split("\n").filter((l) => l.includes("corrupt_query")).slice(0, 4)
  );
  check(
    "review-fix C2: one absent DD shared by two programs → ONE caveat, plural wording, each fetch hint once",
    (mdFx.match(/jo dd get --name 'ghost2_query'/g) ?? []).length === 1 &&
      mdFx.split("\n").filter((l) => l.startsWith("- Data Designer `ghost2_query`")).length === 1 &&
      /Data Designer `ghost2_query` [^\n]*missing its KB docs/.test(mdFx),
    mdFx.split("\n").filter((l) => l.includes("ghost2_query")).slice(0, 4)
  );
  check(
    "review-fix C8: partial-present DD resolves AND caveats softly (no re-document demand for resolved provenance)",
    mdFx.includes("Data Designer **Half Query** (`half_query`)") &&
      mdFx.includes("dm o describe --name 'half_query'") &&
      /Data Designer `half_query` [^\n]*still resolved from its other doc/.test(mdFx) &&
      !/Data Designer `half_query` [^\n]*then document via describe-batch/.test(mdFx),
    mdFx.split("\n").filter((l) => l.includes("half_query")).slice(0, 5)
  );
  check(
    "review-fix C5: collectionId is looked up via docBaseName (the writer's filename rule) — mangled id resolves",
    mdFx.includes("Data Designer **Mangled Query**"),
    mdFx.split("\n").filter((l) => l.includes("Mangled")).slice(0, 3)
  );
  check(
    "review-fix C7: field-term run ties carry NO source-column disclaimer",
    !mdFx.includes("(source column — no field-term match)"),
    null
  );
  const fxObj = runCli("deps", "--index", IX20B_PATH, "--object", "AcmeObj", "--kb", KB, "--report", join(ROOT, "rp7"));
  const mdObj = readFileSync(fxObj.summary.reportPath, "utf8");
  check(
    "review-fix C7: object-only run ties render as report columns WITH the source-column disclaimer",
    mdObj.includes("report column ↔ field dictionary") &&
      mdObj.includes("`RenewalId` ↔ `RenewalId`") &&
      mdObj.includes("(source column — no field-term match)"),
    mdObj.split("\n").filter((l) => l.includes("report column")).slice(0, 3)
  );
  const fxCsv = runCli("deps", "--index", IX20B_PATH, "--field", "Csv Only Field", "--kb", KB, "--report", join(ROOT, "rp8"));
  const mdCsvOnly = readFileSync(fxCsv.summary.reportPath, "utf8");
  check(
    "review-fix C6: CSV-only run keeps the standing STOPS caveat but claims nothing about DDs or Power Lists",
    mdCsvOnly.includes("Where provenance resolution STOPS") && mdCsvOnly.includes("UNREACHABLE") &&
      !mdCsvOnly.includes("Data Designer *design*") && !mdCsvOnly.includes("no CLI surface at all"),
    mdCsvOnly.split("\n").filter((l) => l.includes("STOPS")).slice(0, 2)
  );
  const fxCsvDir = join(ROOT, "cp2");
  const fx2 = runCli("deps", "--index", IX20_PATH, "--field", "Renewal ID", "--alias-prefix", "^[A-Z]_", "--kb", KB, "--report", join(ROOT, "rp9"), "--csv-dir", fxCsvDir);
  const srcCsv2 = readFileSync(join(fxCsvDir, "deps-sources.csv"), "utf8");
  check(
    "review-fix C10: deps-sources.csv provenance is the plain form — no markdown, no dangling 'see detail below'",
    fx2.res.status === 0 && srcCsv2.includes('Data Designer ""Mirror Query"" (mirror_query)') &&
      !srcCsv2.includes("see detail below") && !srcCsv2.includes("**") && !srcCsv2.includes("`"),
    srcCsv2.split("\r\n").filter((l) => l.includes("mirror_query")).slice(0, 2)
  );
}

// ── F-198: doc identity — the reader must never trust a case-collision
// winner's doc for the loser id ─────────────────────────────────────────────
{
  // Case-colliding DD ids share a computed filename; docNameClaimer (the way
  // describe-batch claims names — one claimer per output dir) gives the loser
  // <name>-dup.md, which NO reader path ever computes. Before F-198 the
  // reader resolved the WINNER's doc for BOTH ids (via fs case-folding on
  // Windows, via the F-129 fallback elsewhere) — wrong label/description/
  // fields with resolved:true and an empty missingDocs. The fix verifies the
  // doc's own `- key:` bullet; the -dup sibling is the collision tiebreak.
  const KBC = join(ROOT, "collision-kb");
  const ddDirC = join(KBC, "journey-data-designer");
  mkdirSync(ddDirC, { recursive: true });
  const claim = docNameClaimer(ddDirC);
  const ddDocC = (id, label, fields) =>
    [`# ${label}`, "", `- key: journey-data-designer/${id}`, `- id: ${id}`, "", "## Raw", "```json",
      JSON.stringify({ objectName: id, label, fieldCount: fields.length, fields }), "```", ""].join("\n");
  writeFileSync(join(ddDirC, `${claim("Renewal_DD")}.md`), ddDocC("Renewal_DD", "Winner Query", [{ fieldName: "WinCol", displayName: "Win Col", dataType: "STRING" }]));
  writeFileSync(join(ddDirC, `${claim("renewal_dd")}.md`), ddDocC("renewal_dd", "Loser Query", [{ fieldName: "LoseCol", displayName: "Lose Col", dataType: "STRING" }]));
  const entryFor = (id) => ({
    program: { id: `p-${id}`, name: `P ${id}` },
    source: { participantSourceType: "DATA_DESIGNER", participantSourceCollectionId: id, name: id },
    matchedColumns: [],
  });
  const got = resolveProvenance([entryFor("Renewal_DD"), entryFor("renewal_dd")], { kbDir: KBC });
  const winner = got.entries[0];
  const loser = got.entries[1];
  check(
    "F-198: collision winner resolves from its own doc",
    winner.resolved === true && winner.label === "Winner Query" && winner.fields.some((f) => f.fieldName === "WinCol"),
    { resolved: winner.resolved, label: winner.label }
  );
  check(
    "F-198: collision loser is UNRESOLVED with the honest note — never the winner's data",
    loser.resolved === false && loser.note === "doc on disk belongs to a different id (case collision)" &&
      loser.label === null && loser.fields.length === 0 &&
      got.missingDocs.some((m) => m.collectionId === "renewal_dd" && m.reason === "wrong-id" && m.otherId === "Renewal_DD"),
    { resolved: loser.resolved, note: loser.note, label: loser.label, missing: got.missingDocs }
  );

  // e2e: the collision surfaces as an honest provenance cell + a caveat
  // naming the other id and the fetch for the requested one
  const IXC = {
    slug: "collision-kb", baseUrl: "unknown", environment: "sandbox",
    generatedAt: "2026-08-08T00:00:00.000Z", liveSweepAt: null,
    programs: {
      "prog-loser": program("prog-loser", "Loser Program", "PROCESSING", {
        sources: [{
          configId: "cfg-l", type: "DATA_DESIGNER", name: "Loser Source",
          participantSourceType: "DATA_DESIGNER", participantSourceCollectionId: "renewal_dd",
          mappings: { standard: {}, custom: [{ id: "g1", fieldName: "Lose Col" }] }, conditions: [],
        }],
      }),
    },
    templates: {}, links: { templateToPrograms: {}, programToTemplates: {} },
    gaps: { referencedTemplatesMissing: [], stubs: [], liveOnly: [], kbOnly: [], statusDrift: [] },
    parseErrors: [],
  };
  const IXC_PATH = join(ROOT, "er-index-collision.json");
  writeFileSync(IXC_PATH, JSON.stringify(IXC));
  const ce = runCli("deps", "--index", IXC_PATH, "--field", "Lose Col", "--kb", KBC, "--report", join(ROOT, "r-coll"));
  const mdColl = readFileSync(ce.summary.reportPath, "utf8");
  check(
    "F-198 cli: honest cell + collision caveat naming the other id and the requested id's fetch",
    ce.res.status === 0 && mdColl.includes("doc on disk belongs to a different id (case collision)") &&
      mdColl.includes("belongs to a different id (`Renewal_DD`, case collision)") &&
      mdColl.includes("jo dd get --name 'renewal_dd'") &&
      !mdColl.includes("Winner Query"),
    mdColl.split("\n").filter((l) => l.includes("collision") || l.includes("renewal_dd")).slice(0, 5)
  );

  // F-198 sub-defect: a real filesystem error (ENOTDIR — the KB folder path
  // is a FILE) must surface as one, never as "missing" plus a re-fetch hint
  // for docs that may be there all along.
  const KBE = join(ROOT, "fs-error-kb");
  mkdirSync(KBE, { recursive: true });
  writeFileSync(join(KBE, "journey-data-designer"), "not a directory");
  writeFileSync(join(KBE, "data-management"), "not a directory");
  const fsErr = resolveProvenance([entryFor("whatever_query")], { kbDir: KBE });
  check(
    "F-198: ENOTDIR on the KB folder reports fs-error with the code, not a false missing",
    fsErr.entries[0]?.resolved === false &&
      fsErr.entries[0]?.note === "KB folder unreadable (error named in caveats)" &&
      fsErr.missingDocs.length === 2 && fsErr.missingDocs.every((m) => m.reason === "fs-error" && /ENOTDIR/.test(String(m.detail))),
    { note: fsErr.entries[0]?.note, missing: fsErr.missingDocs }
  );

  // F-198 sub-defect: when the doc parses only under a differently-cased
  // on-disk name and is corrupt, the problem must name the spelling actually
  // read. The F-129 fallback (which discovers that spelling) only runs on
  // case-SENSITIVE filesystems (the ubuntu CI leg) — a case-folding fs
  // (Windows, default APFS) resolves the computed spelling directly, so
  // there the computed name IS the one read and this pins that instead.
  // Which world we are in is probed from the fs, never assumed per platform.
  const KBF = join(ROOT, "found-spelling-kb");
  mkdirSync(join(KBF, "journey-data-designer"), { recursive: true });
  writeFileSync(join(KBF, "journey-data-designer", "case_corrupt.md"), "# Case Corrupt\n\n```json\n{ nope\n```\n");
  const fnd = resolveProvenance([entryFor("Case_Corrupt")], { kbDir: KBF });
  const fsFolds = existsSync(join(KBF, "journey-data-designer", "CASE_CORRUPT.MD"));
  const expectPath = fsFolds ? "journey-data-designer/Case_Corrupt.md" : "journey-data-designer/case_corrupt.md";
  check(
    "F-198: unparseable problem names the spelling actually read (found spelling once the F-129 fallback ran)",
    fnd.missingDocs.some((m) => m.reason === "unparseable" && m.path === expectPath),
    { missing: fnd.missingDocs, expectPath }
  );
}

{
  // F-123: an apostrophe-bearing object term makes the corroborate hint carry
  // the bash escape and pushes the one PowerShell-conversion caveat.
  const apo = runCli("deps", "--index", INDEX_PATH, "--object", "O'Brien Co", "--report", join(ROOT, "r-apo"));
  const mdApo = readFileSync(apo.summary.reportPath, "utf8");
  check("caveat: apostrophe term pins the bash escape + caveat (F-123)", mdApo.includes("'O'\\''Brien Co'") && mdApo.includes("bash apostrophe escape"), mdApo.split("\n").filter((l) => l.includes("apostrophe")).join(" | "));
  const cleanRun = runCli("deps", "--index", INDEX_PATH, "--object", "Company", "--report", join(ROOT, "r-clean2"));
  const mdClean = readFileSync(cleanRun.summary.reportPath, "utf8");
  check("caveat: absent for cleanly-quoted runs (F-123)", !mdClean.includes("bash apostrophe escape"), null);
}

// ── F-362 output-identity lock (A-6) ──────────────────────────────────────────
// The rendered report and every CSV of one deps run (the r1 shape plus --scan-tokens, so the token CSV is locked too),
// byte-for-byte against fixtures CAPTURED ON THE PRE-HOIST TREE (B17,
// 2026-09-03) and committed under test/fixtures/jo-report/deps/. The
// mode's shared tail — rerun line, POSIX-quote caveat, renderReport, report
// write, CSV-dir prep — was hoisted into jo-report.mjs's writeModeReport
// under this lock, which must pass unchanged. Normalized before compare: the
// `generated:` timestamp, and on the Re-run line ONLY this run's absolute
// paths (temp root, dispatcher script) with their OS quoting and separators.
// CSVs are committed LF-only and BOM-less; the compare re-adds the BOM and
// CRLF the writer emits, so both are asserted exactly, not normalized away.
// Refresh (after a REVIEWED behaviour change only — review the git diff):
//   JO_REPORT_EXPECTED_REFRESH=1 node plugins/gs-superadmin/test/jo-report-deps.mjs
//   PowerShell: $env:JO_REPORT_EXPECTED_REFRESH = '1'; node plugins/gs-superadmin/test/jo-report-deps.mjs
// (the inline VAR=value prefix is bash-only — F-255).
{
  const EXPECTED = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "jo-report", "deps");
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
    const { res, summary } = runCli("deps", "--index", INDEX_PATH, "--object", "Company", "--field", "ARR", "--scan-tokens", "--report", rDir, "--csv-dir", cDir);
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
  check("lock: exit 0 and the report file is named deps-<date>.md", a.res.status === 0 && /^deps-\d{4}-\d{2}-\d{2}(-\d+)?\.md$/.test(basename(String(a.summary?.reportPath))), { status: a.res.status, reportPath: a.summary?.reportPath, stderr: a.res.stderr });
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
console.log(failures ? `\n${failures} failure(s)` : "\nAll jo-report-deps checks passed");
process.exit(failures ? 1 : 0);
