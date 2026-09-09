#!/usr/bin/env node
// Doc-drift check: the plugin's skill surface is documented by hand in the READMEs,
// and hand prose goes silently stale when skills land, rename, or change invocation
// mode (a 2026-07 sweep found the root README missing the three newest skills). This
// cross-checks the docs against the actual plugin tree and fails on:
//   1. a skill missing from the plugin README's catalog table or the root README
//   2. a `/gs-superadmin:<name>` reference to a skill that doesn't exist
//   3. a catalog-table invocation label that contradicts the skill's
//      disable-model-invocation frontmatter ("slash only" vs "slash + natural language")
//   4. dev-branch-only content (dev-canary) mentioned outside its allowed files
//   5. a test runner — under plugins/gs-superadmin/test/ OR build/test-*.mjs — not
//      named inside AGENTS.md's verification-commands fence (the authoritative list;
//      F-181: enumerating only the plugin dir left the build/ suites unpoliced, and
//      matching the whole file let a mention in prose stand in for a battery line;
//      F-200: per-arm discovery floors, and only invocation lines — not fence
//      comment text — count as listed)
//   6. reappearance of files this repo deliberately removed from the shipped surface
//      (root VALIDATION.md, docs/archive/)
//   7. plugin.json version disagreeing with the CHANGELOG's newest entry (the release
//      invariant "bump + entry land together on dev" is otherwise manual)
//   8. a bare invisible codepoint in any tracked file — U+FEFF (F-130), plus raw NUL,
//      bidi overrides/isolates U+202A..202E/U+2066..2069, and zero-widths
//      U+200B..200F (F-138) — sources must spell the escape; a raw invisible is
//      unreviewable, formatter-fragile, and (bidi) can visually reorder review text
//      (F-201: genuine binaries — invalid UTF-8, never mere NUL presence — are
//      skipped and NAMED; the pass line counts files actually read)
//   9. a portability-rule definition outside doc-lib that is not on doc-lib's
//      sanctioned-duplicates list, and both directions of that list's freshness
//      (F-159 — the hand list went stale twice; same shape as check 5's runner list;
//      F-199: the prose lock matches full repo-root-relative paths, not basenames)
//  10. the ${CLAUDE_PLUGIN_ROOT} placeholder anywhere in a skill except setup's ONE
//      pinned first-run link fence (GP-B5 DS-43 inverted the check: skill fences
//      address bundled scripts through the workspace link `.gs-superadmin/plugin/…`,
//      so the placeholder — substituted by the loader only, silently empty in bash
//      AND PowerShell when a literal survives, F-175 — has exactly one legitimate
//      site), that pinned fence missing its surviving-literal warning (or spelling
//      the placeholder in brace form there, F-185), a trailing-backslash line
//      continuation inside any skill fence, unpairable/~~~ fences, the placeholder
//      or the retired `<plugin-root>` spelling in a skill's references/ files
//      (swept recursively, all extensions — F-202), the operating model's link
//      bullet missing, or ANY reference to the retired warning family by its
//      vocabulary (RETIRED_WARNING_PHRASES, data) outside setup's pinned warning
//      window — in a skill, a reference file, or the operating model (F-387
//      reopen: three pointer sentences survived a token-keyed deletion and told
//      the model to route around the link) — F-163/F-166, hardened by F-172,
//      inverted by DS-43, enumerated by vocabulary at F-387
//  11. a localeCompare call site in any tracked file whose second argument is not
//      a string-literal locale (F-141 — the fixture pin cannot catch the
//      dropped-locale mutant on an English-default machine; this can, everywhere)
//  12. a shipped plugins/gs-superadmin/scripts/*.mjs file with no row in
//      MAINTAINERS.md's Scripts table (shared libs may live in the prose above
//      it instead), or a table row naming a script that no longer exists
//      (F-243 — the table drifted CI-invisibly: manifest.mjs's verb list
//      predated exclude/block and domain-candidates.mjs had no row at all)
//  13. a bash-only command spelling where a reader pastes it: a trailing-backslash
//      continuation inside a fence in the hand-written repo docs (check 10 covers
//      the same class inside SKILL.md — F-256), or an inline `VAR=value command`
//      prefix with no `$env:` spelling beside it (F-255)
//  14. a skill that captures gs-admin output to a file with a RAW shell
//      redirect instead of routing through the shipped capture helper
//      (scripts/capture.mjs — writes UTF-8-no-BOM on every shell), or a
//      change in the SET of skills that invoke the helper (F-257, narrowed
//      by B5 W4/DS-17: the encoding rule the skills used to restate as
//      prose is now carried by the helper itself)
//  15. the journal-kind prose nickname ("plan-completion") appearing anywhere in
//      the shipped plugin without the emitter literal within a few lines (F-290 —
//      the T-4 v4 defect's exact input: prose taught the nickname as if it were
//      the label). Per-OCCURRENCE, literal read from the writer, CHANGELOG.md
//      exempt as append-only history
//  16. the token pre-flight family (F-221) drifting off its one-canon shape
//      (GP-B5 DS-31, bus F-312): the canon skill must carry the full statement
//      (formula included), every paraphrase skill the headline + pointer and
//      never the formula, and no skill outside the family may mention the
//      pre-flight — site list carried as data (TOKEN_PREFLIGHT)
//  17. a tracked .mjs under a dev-only strip path (dev/, the dev-canary skill): the
//      type gate runs on docs-drift.yml's FULL arm only because the release strip
//      removes nothing tsc reads — a claim that was a hand count in the workflow
//      comment (65 → 67 in one wave, W8.5 review) and is now held to the tree
//  18. shipped plugin content naming a dev-only strip path (dev/<File>.md, the
//      dev-canary skill) — a dangling pointer in the installed plugin (W9 review)
//  19. the defect-class registry (build/defect-classes.mjs, GP-B5 W10): every
//      mechanical row swept tree-wide with its allowance ledger checked both
//      ways, unreadable files failed by name, every scope floored, and the manual
//      class keys cross-checked with AGENTS.md's `Class:` bullets both ways
//  20. the refresh skill's post-upgrade migration note quoting upsert-batch's two
//      failures exactly as the script PRINTS them — the check executes the writer on
//      a scratch manifest and holds each copy-out line segment-wise to the real
//      stderr (F-388 round 2; F-392 reopen: a head-presence gate let a stale clause
//      through)
//  21. the documented build pipeline IS package.json's: the `npm run build` chain
//      CLAUDE.md and README.md spell out, the derived-generator list AGENTS.md's
//      fence and docs-drift.yml's Regenerate step carry, and the individual
//      `build:*` steps both READMEs enumerate — each held to the script, in order
//      (F-407: three files went stale when emit-reader-shapes joined the chain)
//
// Zero dependencies: Node built-ins only. Runs in .github/workflows/docs-drift.yml.

import { readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { ROOT, readJsonFile, assertScanCoverage } from "./lib.mjs";
import { MECHANICAL_CLASSES, MANUAL_CLASSES, REGISTERED_CLASS_KEYS, sweepDefectClasses, classKeysIn, isTest } from "./defect-classes.mjs";

const read = (p) => readFileSync(join(ROOT, p), "utf8");

const SKILLS_DIR = "plugins/gs-superadmin/skills";
const PLUGIN_README = "plugins/gs-superadmin/README.md";
const ROOT_README = "README.md";
const DEV_ONLY_SKILLS = new Set(["dev-canary"]);
// Invocation labels the plugin README's catalog table must use, verbatim.
const LABEL_SLASH_ONLY = "slash only";
const LABEL_MODEL_TOO = "slash + natural language";

let failures = 0;
const fail = (msg) => {
  failures++;
  console.error(msg);
};

const skills = readdirSync(join(ROOT, SKILLS_DIR), { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(ROOT, SKILLS_DIR, d.name, "SKILL.md")))
  .map((d) => d.name);
const userSkills = skills.filter((s) => !DEV_ONLY_SKILLS.has(s));

// Coverage floor (F-101): build/lib.mjs's assertScanCoverage — one copy for both
// markdown-scanning checks (GP-B5 W10; the twin lived here and in
// check-stale-facts byte-identically, the consumer-parity class in this lane).

// execFileSync-style argv (no shell): an unquoted `*.md` through a POSIX shell
// glob-expands to the six top-level files before git sees it (F-095).
const trackedMd = execFileSync("git", ["ls-files", "-z", "--", "*.md"], { cwd: ROOT, encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
assertScanCoverage(trackedMd);

// --- 1+2. Skill mentions and references resolve both ways -----------------------------
// Always compare extracted names for equality, never substring-match on the reference
// (a mention of "audit-deep" must not satisfy or masquerade as "audit").
const namesIn = (text) => new Set([...text.matchAll(/\/gs-superadmin:([a-z0-9-]+)/g)].map((m) => m[1]));
const pluginReadme = read(PLUGIN_README);
const rootReadme = read(ROOT_README);
const pluginMentions = namesIn(pluginReadme);
const rootMentions = namesIn(rootReadme);
for (const s of userSkills) {
  if (!pluginMentions.has(s))
    fail(`${PLUGIN_README}: skill "${s}" exists but is never mentioned — add it to the catalog table and a usage section`);
  if (!rootMentions.has(s))
    fail(`${ROOT_README}: skill "${s}" exists but is never mentioned — add it to the Everyday use list`);
}
const skillSet = new Set(skills);
for (const file of trackedMd) {
  const lines = read(file).split("\n");
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/\/gs-superadmin:([a-z0-9-]+)/g)) {
      if (!skillSet.has(m[1]))
        fail(`${file}:${i + 1}: references /gs-superadmin:${m[1]} but ${SKILLS_DIR}/${m[1]}/ does not exist`);
    }
  });
}

// --- 3. Catalog-table invocation labels match frontmatter ------------------------------
// A skill is slash-only when its frontmatter carries the actual key (a comment merely
// naming disable-model-invocation, as email-report's does, must not count).
const slashOnly = new Map(
  skills.map((s) => {
    const src = read(`${SKILLS_DIR}/${s}/SKILL.md`);
    const end = src.indexOf("\n---", 3);
    const fm = src.startsWith("---") && end !== -1 ? src.slice(3, end) : "";
    return [s, /^disable-model-invocation:\s*true\b/m.test(fm)];
  }),
);
const tableRows = pluginReadme
  .split("\n")
  .map((line, i) => ({ line, n: i + 1 }))
  .filter(({ line }) => line.trimStart().startsWith("|") && /\/gs-superadmin:([a-z0-9-]+)/.test(line));
for (const s of userSkills) {
  const rows = tableRows.filter(({ line }) => namesIn(line).has(s));
  if (rows.length === 0) {
    fail(`${PLUGIN_README}: skill "${s}" has no row in the skills-at-a-glance table`);
    continue;
  }
  const expected = slashOnly.get(s) ? LABEL_SLASH_ONLY : LABEL_MODEL_TOO;
  const wrong = slashOnly.get(s) ? LABEL_MODEL_TOO : LABEL_SLASH_ONLY;
  for (const { line, n } of rows) {
    if (!line.includes(expected) || line.includes(wrong))
      fail(
        `${PLUGIN_README}:${n}: "${s}" row must carry the invocation label "${expected}" ` +
          `(frontmatter disable-model-invocation: ${slashOnly.get(s)})`,
      );
  }
}

// --- 4. Dev-only content stays contained -----------------------------------------------
// dev-canary is a /dev-loop provenance marker stripped before release; user-facing
// docs must never describe it. CLAUDE.md and CONTRIBUTING.md may name it (they document
// the release ceremony that strips it), as may anything under dev/ and the skill itself.
const CANARY_ALLOWED = [/^CLAUDE\.md$/, /^CONTRIBUTING\.md$/, /^dev\//, new RegExp(`^${SKILLS_DIR}/dev-canary/`)];
for (const file of trackedMd) {
  if (CANARY_ALLOWED.some((re) => re.test(file))) continue;
  const lines = read(file).split("\n");
  lines.forEach((line, i) => {
    if (line.includes("dev-canary")) fail(`${file}:${i + 1}: mentions dev-canary — dev-only content must not leak into this doc`);
  });
}

// --- 5. Every test runner is listed in AGENTS.md ----------------------------------------
// Two homes, not one: suites live under plugins/gs-superadmin/test/ AND in build/ as
// build/test-*.mjs. Scanning only the first is what F-181 caught — build/ suites could
// be added or dropped from the battery with nothing failing. Matching is scoped to the
// verification-commands fence rather than the whole file, so the failure message ("is
// not in the verification-commands list") is literally what gets checked; a runner named
// only in surrounding prose no longer counts as listed.
const agents = read("AGENTS.md");
const BATTERY_ANCHOR = "node plugins/gs-superadmin/test/guard-fixtures.mjs";
// Built on the one shared pairer (F-183): a malformed fence in AGENTS.md now fails
// with its own message instead of silently shifting pairing parity — before the
// extraction, a ~~~ fence wrapping a backtick line upstream made this lookup return
// null with a misleading could-not-locate, and an unclosed trailing fence was
// invisible to every check on this file.
function batteryFence(md) {
  const lines = md.split("\n");
  const { problems, ok, ranges } = scanFenceMarkers(lines);
  for (const [i, why] of /** @type {FenceProblem[]} */ (problems)) {
    fail(`AGENTS.md:${i + 1}: ${why} — check 5 cannot trust any fence range until this line is unambiguous (F-183)`);
  }
  // The grammar-valid ranges are still searched on a red file — the battery
  // fence usually pairs fine even when an unrelated fence is refused, and
  // running check 5 against it avoids stacking a misleading could-not-locate
  // on top of the real per-line failures.
  for (const [open, close] of ranges) {
    const body = lines.slice(open + 1, close).join("\n");
    if (body.includes(BATTERY_ANCHOR)) return body;
  }
  if (ok) {
    // Fail loudly rather than silently checking nothing: an unfindable fence would make
    // every runner "uncovered" (noise) or, with a permissive default, none (a false pass).
    fail("AGENTS.md: could not locate the verification-commands fence (no fenced block contains " + BATTERY_ANCHOR + ") — check 5 cannot run");
  }
  return null;
}
const battery = batteryFence(agents);
const pluginRunners = readdirSync(join(ROOT, "plugins/gs-superadmin/test"), { withFileTypes: true })
  .filter((d) => d.isFile() && d.name.endsWith(".mjs"))
  .map((d) => d.name);
const buildRunners = readdirSync(join(ROOT, "build"), { withFileTypes: true })
  .filter((d) => d.isFile() && d.name.startsWith("test-") && d.name.endsWith(".mjs"))
  .map((d) => d.name);
const runners = [...pluginRunners, ...buildRunners];
// Per-arm coverage floors (F-200; F-101 precedent): the two arms collapse
// INDEPENDENTLY and neither throws on its own zero — build/ reads a dir that
// always exists, and the plugin arm's non-recursive readdir finds nothing if
// suites move into subfolders (renaming test/ outright throws loudly, but
// nesting does not) — so a single total floor let either arm's silent zero
// hide behind the other's count. An arm at zero is a broken enumeration or a
// reorganized tree this check no longer sees, never a tree with no suites;
// the floor makes the reorganization loud instead of recursing after it.
if (pluginRunners.length < 1)
  fail(`check 5: plugin arm found ${pluginRunners.length} runner(s) in plugins/gs-superadmin/test/ (build arm found ${buildRunners.length}) — the enumeration is broken, not the tree (F-200)`);
if (buildRunners.length < 1)
  fail(`check 5: build arm found ${buildRunners.length} build/test-*.mjs runner(s) (plugin arm found ${pluginRunners.length}) — the enumeration is broken, not the tree (F-200)`);
if (battery !== null) {
  // F-200: coverage means the runner appears on an INVOCATION line — trailing
  // `# …` comment text is cut from each fence line before matching, so a
  // battery line commented out with `#` stops counting as listed. The
  // jo-report*.mjs glob clause is the one sanctioned exception, matched
  // against the raw fence body: the literal lives only in the trailing
  // comment on the jo-report.mjs line, and four mode-sibling runners ride on
  // it (hoisting the glob onto a live line is an AGENTS.md change, tracked as
  // the cleaner follow-up).
  const batteryInvocations = battery.split("\n").map((l) => l.replace(/(^|\s)#.*$/, "$1"));
  for (const r of runners) {
    // AGENTS.md names jo-report mode siblings via the literal glob "jo-report*.mjs".
    // F-184: names match as path components ("/" + name), never bare substrings —
    // battery lines always cite runners as `node <dir>/<name>`, and a bare-substring
    // match let an unlisted runner whose name is a suffix of a listed one ("ops.mjs"
    // inside "manifest-ops.mjs") read as covered.
    const covered =
      batteryInvocations.some((l) => l.includes("/" + r)) ||
      (r.startsWith("jo-report") && battery.includes("jo-report*.mjs"));
    if (!covered)
      fail(
        `AGENTS.md: test runner ${r} is not in the verification-commands list (the authoritative suite list) — ` +
          `a runner named only in fence comment text does not count as listed (F-200)`,
      );
  }
}

// --- 6. Removed-from-shipped-surface files must not come back ---------------------------
for (const gone of ["VALIDATION.md", "docs/archive"]) {
  if (existsSync(join(ROOT, gone)))
    fail(`${gone}: reappeared — this was deliberately removed from the shipped repo (open items live in dev/VALIDATION.md)`);
}

// --- 7. plugin.json version and the CHANGELOG's newest entry move together --------------
const pluginVersion = JSON.parse(read("plugins/gs-superadmin/.claude-plugin/plugin.json")).version;
const changelogHead = read("plugins/gs-superadmin/CHANGELOG.md").match(/^## (\d+\.\d+\.\d+)/m)?.[1];
if (!changelogHead) fail("plugins/gs-superadmin/CHANGELOG.md: no '## <version>' entry heading found");
else if (changelogHead !== pluginVersion)
  fail(
    `plugins/gs-superadmin/CHANGELOG.md: newest entry is ${changelogHead} but plugin.json version is ${pluginVersion} — ` +
      "a version bump and its changelog entry must land together",
  );

// --- 8. No bare invisible codepoints in any tracked file (F-130, widened by F-138) ------
// A raw BOM inside a source literal is invisible and one formatter pass from
// silently degrading a strip regex to /^/ (twice found shipped: jo-report.mjs
// loadIndex and the change-request event validator). F-138 widened the sweep to
// the rest of the hazard family: raw NUL, the bidi overrides/isolates (which can
// visually REORDER what a reviewer reads), and the zero-widths — all invisible
// in review and all demonstrated (wave 2, live) to enter files via tool calls
// despite explicit intent. Sources must spell the escape. Every codepoint is
// built here via fromCharCode for the same reason — this file must never
// contain one. Baseline swept clean 2026-08-06 before the widening, so any hit
// is new. dev/FEEDBACK-archive.md is excluded as frozen record (same rationale
// as its CITATION_EXCLUDE in check-stale-facts): it quotes historical bytes
// verbatim.
const INVISIBLES = [[String.fromCharCode(0xfeff), "bare U+FEFF codepoint"]];
{
  const label = (cp, name) => `raw ${name} codepoint U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
  INVISIBLES.push([String.fromCharCode(0x0000), label(0x0000, "NUL")]);
  for (let cp = 0x202a; cp <= 0x202e; cp++) INVISIBLES.push([String.fromCharCode(cp), label(cp, "bidi-override")]);
  for (let cp = 0x2066; cp <= 0x2069; cp++) INVISIBLES.push([String.fromCharCode(cp), label(cp, "bidi-isolate")]);
  for (let cp = 0x200b; cp <= 0x200f; cp++) INVISIBLES.push([String.fromCharCode(cp), label(cp, "zero-width")]);
}
const BOM_EXCLUDE = new Set(["dev/FEEDBACK-archive.md"]);
const trackedAll = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

// ── check 5b (B5 W1 / B2 review): the third test home is closed by construction ──
// The repo-root test/ directory is the RIG lane (DS-22 — plumbing only,
// declared in build/check-imports.mjs), never a third suite home. A suite
// parked there would be exempt from check 5's battery-fence rule and from
// both workflows' step lists — the F-181 gap one directory over — so anything
// under test/ that is not a declared rig module fails, and a stale
// declaration entry fails the other way.
const RIG_MODULES = new Set(["test/rig.mjs"]);
for (const f of trackedAll) {
  if (!/^test\/.*\.mjs$/.test(f)) continue;
  if (!RIG_MODULES.has(f)) {
    fail(
      `${f}: repo-root test/ is the rig lane (plumbing only, DS-22) — suites live in ` +
        `plugins/gs-superadmin/test/ or build/test-*.mjs, where check 5 and the CI workflows ` +
        `enumerate them; a new rig module is a deliberate RIG_MODULES edit here AND a lane review ` +
        `in build/check-imports.mjs`,
    );
  }
}
for (const f of RIG_MODULES) {
  if (!trackedAll.includes(f)) {
    fail(`check 5b: RIG_MODULES names ${f}, which is not a tracked file — update the declaration with the rename/move`);
  }
}
// F-201: readFileSync-utf8 decodes binary LOSSILY instead of throwing, so the
// old catch-continue never actually skipped a binary — the first committed PNG
// would have turned this gate red once per NUL byte. Binary is discriminated
// on INVALID UTF-8 (lossy round-trip byte-length mismatch, or a decoded
// U+FFFD), never on NUL presence: a PNG must skip, but a source file carrying
// a stray raw NUL is a valid UTF-8 stream and exactly what this sweep exists
// to flag. Skips are counted AND named in the pass line — the coverage claim
// is files actually read, not files enumerated.
// F-211: that claim covers EVERY skip channel, not just the binary one. The
// BOM_EXCLUDE branch below (a declared exclusion, rationale at the top of this
// check) predates F-201 and used to `continue` before either counter, so one
// tracked file was silently absent from the arithmetic — 153 tracked against a
// pass line reading 152. Each channel now has its own named list, and the
// assertion after the loop locks the claim to the tree: any future branch that
// skips a file without recording it fails the gate rather than shrinking the
// count in silence.
const REPLACEMENT_CHAR = String.fromCharCode(0xfffd);
// The F-201 discriminator, single copy (F-294): utf8 decode is LOSSY and never
// throws on binary, so binary is detected on the round-trip byte-length
// mismatch or a decoded U+FFFD — never on a catch, never on NUL presence.
// Returns null for unreadable or genuinely-binary files; every text-scanning
// check reads through this rather than re-spelling a catch-continue that
// cannot fire on binary (check 15's did exactly that before this helper).
const readTextOrNull = (rel) => {
  let buf;
  try {
    buf = readFileSync(join(ROOT, rel));
  } catch {
    return null;
  }
  const text = buf.toString("utf8");
  if (Buffer.byteLength(text, "utf8") !== buf.length || text.includes(REPLACEMENT_CHAR)) return null;
  return text;
};
const check8Skipped = [];
const check8Excluded = [];
let check8Read = 0;
for (const f of trackedAll) {
  if (BOM_EXCLUDE.has(f)) {
    check8Excluded.push(f); // declared exclusion — named in the pass line, never silently dropped (F-211)
    continue;
  }
  const text = readTextOrNull(f);
  if (text === null) {
    check8Skipped.push(f); // unreadable, or invalid UTF-8 → genuine binary — named in the pass line, never silently dropped
    continue;
  }
  check8Read++;
  for (const [ch, what] of INVISIBLES) {
    let idx = text.indexOf(ch);
    while (idx !== -1) {
      const line = text.slice(0, idx).split("\n").length;
      fail(`${f}:${line}: ${what} — spell it as an escape (a formatter pass silently strips or mangles the raw form)`);
      idx = text.indexOf(ch, idx + 1);
    }
  }
}
// Accounting lock (F-211): every tracked file is read, skipped-as-binary, or
// declared-excluded — there is no fourth outcome. This is the mechanical half
// of the fix (AGENTS.md § Review-gate rules: lock the claim to the tree, do not
// just correct the prose), and it is what a future unaccounted `continue` trips.
if (check8Read + check8Skipped.length + check8Excluded.length !== trackedAll.length)
  fail(
    `check 8 accounting: ${trackedAll.length} tracked file(s) but ` +
      `${check8Read} read + ${check8Skipped.length} skipped + ${check8Excluded.length} excluded ` +
      `= ${check8Read + check8Skipped.length + check8Excluded.length} accounted — every skip must be counted AND named in the pass line`
  );

// --- 9. Sanctioned portability-duplicate list matches the tree (F-159) ------------------
// doc-lib.mjs's portability section is the single home for OS-portability rules, with
// a hand-enumerated list of sanctioned duplicate copies. That list went stale twice
// (F-151 by accumulation, F-158 inside a single batch), so it is enforced mechanically
// here — the same "prose list must match the tree" shape as check 5's runner list.
// Detection is by MECHANISM SIGNATURE in source text, never by export name: the copies
// rename freely (direntIsDir, readJsonFileTolerant, invokedDirectly) but cannot avoid
// the mechanism's characteristic source text. The classification rule — the whole
// difficulty, per F-159 — is that each needle must match only a file IMPLEMENTING the
// rule, never one merely using the mechanism's output: e.g. the BOM needle is the
// strip-regex spelling (replace-slash-caret-escape), which cannot match toCsv's
// emitted BOM string literal. Needles are built by concatenation so this file never
// contains one whole. Scope: tracked .mjs under plugins/gs-superadmin/ and build/,
// excluding test files — tests deliberately re-derive mechanisms as independent
// probes (the bus's Class B standard) and are not consumer surface.
const BS9 = String.fromCharCode(92); // backslash — keeps escape spellings out of this file
const DOC_LIB = "plugins/gs-superadmin/scripts/doc-lib.mjs";
/** @type {Array<[string, string[]]>} */
const SIGNATURES = [
  ["single-leading-BOM strip", ["replace(/^" + BS9 + "uFEFF"]],
  ["surrogate-safe slice (codePointSlice)", [BS9 + "uDC00-" + BS9 + "uDFFF"]],
  ["reparse-point dirent follow", ["isSymbolic" + "Link()"]],
  ["Windows rename retry", ["Atomics" + ".wait"]],
  ["CLI-entry realpath test", ["realpathSync(fileURL" + "ToPath"]],
  ["launcher-suffix strip", ["exe|cmd|" + "bat|ps1"]],
  ["NFC fold", ['normalize("NF' + 'C")']],
  ["POSIX apostrophe escape", ["'" + BS9 + BS9 + "''"]],
  // F-156 unified the doc-filename collision suffix into doc-lib's
  // docNameClaimer; a writer re-inlining its own suffix loop reopens the
  // half-shared-rule class. The needle is the suffix-append spelling — a
  // consumer merely calling the claimer never contains it.
  ["doc-filename collision suffix", ['+= "-du' + 'p"']],
  // F-289: two SHARED-DEFINITION rows (single-sourcing, not portability)
  // riding this check's engine — DS-13 single-sourced both into doc-lib and
  // proved it with an ad-hoc grep that nothing executed, so copy number two
  // would have landed unchallenged (the F-023 class). doc-lib is already
  // excluded as the primitives' home; neither row needs an allowance entry,
  // and test files re-derive both deliberately (Class B) outside this sweep.
  // The stub-marker needle is the distinctive marker core — a consumer
  // imports STUB_MARKER / STUB_MARKER_RE and never contains it (verified
  // against the whole tree at row-add time: production hits were doc-lib
  // only, everything else test files).
  ["stub-marker literal (T-3 single source)", ["Metadata-" + "only stub"]],
  // The regex-escape needle is the character-class source text — a consumer
  // calls escapeRe() and never spells the class.
  ["regex-escape character class (escapeRe)", ["[.*+?^${}()|[" + BS9 + "]" + BS9 + BS9 + "]"]],
  // DS-24 (GP-B5): the KB-doc fence-parse guard single-sourced as doc-lib's
  // parseDocJson. The needle is the raw primitive's call spelling — a
  // consumer of the SEMANTIC layer calls parseDocJson()/docJsonBody() and
  // never names extractFencedJson; a regrown fence→JSON.parse copy cannot
  // avoid it (renaming the local wrapper freely — the pre-DS-24 copies were
  // exactly that). jo-report.mjs holds the one sanctioned raw consumer: its
  // parseProgramDoc/parseTemplateDoc report the parse error's text into
  // parseErrors (A-4) instead of parseDocJson's null signal, and it also
  // re-exports the primitive as ER-1 public surface.
  ["KB-doc fence parse (parseDocJson single source, DS-24)", ["extractFenced" + "Json("]],
  // DS-24 review round: the no-recorded-name sentinel became doc-lib's
  // exported NO_NAME (writer describe-batch, readers docMeta/jo-report,
  // display fillers all import it). The needle is the literal — a consumer
  // imports NO_NAME and never spells it; docs written by earlier plugin
  // versions carry the string, so a respelled copy is a KB format break
  // (same class as the stub-marker row above).
  ["name-sentinel literal (T-3 single source, DS-24)", ["(none " + "recorded)"]],
  // DS-25 (GP-B5): the two build-lane renderers' shared T-9 core lives in
  // build/lib.mjs (since T-9 v4 the whole grammar — block parser included).
  // A re-inlined copy of the inline stash cannot avoid the NUL code-span
  // sentinel spelling, and a re-inlined pipe-cell split cannot avoid the PIPE
  // sentinel construction — both needles assembled so this file never
  // contains either whole. build/test-* is outside the sweep, so the T-9 pin
  // suite's own probe spellings never trip these.
  ["inline code-span sentinel (T-9 single source, DS-25)", [BS9 + "u0000" + "GSC"]],
  ["pipe-cell sentinel (T-9 single source, DS-25)", ['"PIPE" + String.fromCh' + "arCode(0)"]],
  // DS-42 / T-3 v4 (GP-B5 B11): the KB-doc envelope rule's read-side homes,
  // enumerated in doc-lib's T-3 header. The needle is the one-level unwrap's
  // type test as every production home spells it TODAY (payload.data /
  // json.data, with or without the array guard) — a copy-paste tripwire, not
  // a grammar: a FIFTH FILE that copies the spelling goes red until the T-3
  // header AND this map name it; a respelled unwrap (hoisted local,
  // destructure) or a second spelling inside a sanctioned file is the accepted
  // residual (A-2), stated in the header. doc-lib is outside the sweep as the
  // primitives' home (its own envelope reads — renderProgramDoc's unwrapData,
  // parseLiveDepsAreas — live there); test files re-derive the unwrap as
  // independent probes. Needle assembled so this file never contains it whole.
  ["KB-doc envelope unwrap (T-3 read-side homes, DS-42)", ['.data === "obj' + 'ect"']],
];
// file → the signature labels it is sanctioned to define. A file defining anything
// beyond its allowance (or absent from this map) fails; a file that stops defining
// an allowed signature also fails, so the list can rot in neither direction. Keep
// this map and the enumeration in doc-lib's portability header in step — the block
// below cross-checks that every file here is named there.
const SANCTIONED_PORTABILITY_COPIES = {
  "plugins/gs-superadmin/hooks/gs-admin-guard.mjs":
    ["single-leading-BOM strip", "reparse-point dirent follow", "launcher-suffix strip"],
  "plugins/gs-superadmin/scripts/journal-lib.mjs": ["surrogate-safe slice (codePointSlice)"],
  // GP-B5 DS-43: the workspace plugin-link writer is builtins-only by
  // declaration (RESTRICTED — it runs at every session start), so its lstat
  // is-a-link gate spells the reparse-point test itself. It never FOLLOWS a
  // dirent (the primitive's rule); it decides whether the link path IS a link
  // before the only removal call — a deliberate second home, not a regrown copy.
  "plugins/gs-superadmin/scripts/plugin-link.mjs": ["reparse-point dirent follow"],
  "plugins/gs-superadmin/scripts/extract-catalog.mjs": ["single-leading-BOM strip"],
  "build/extract-catalog.mjs": ["single-leading-BOM strip"],
  "plugins/gs-superadmin/scripts/render-cheatsheet.mjs": ["CLI-entry realpath test"],
  "build/render-cheatsheet.mjs": ["CLI-entry realpath test"],
  "plugins/gs-superadmin/skills/change-request/scripts/validate-request-event.mjs":
    ["single-leading-BOM strip"],
  // F-204 → DS-16 (B5 W3): the build lane's BOM-tolerant config read lives
  // once, in the lane's shared module (build/ cannot import doc-lib's
  // readJsonFile — declared lane graph). The two per-reader copies this row
  // replaces (build/check-instance-data.mjs, build/build-plugin-gs-superadmin.mjs)
  // now import it.
  // …and (DS-25) of both T-9 renderer sentinels: build/lib.mjs is the single
  // home of the inline code-span stash and the pipe-cell split the two
  // markdown generators share (the build lane cannot import doc-lib — same
  // lane rationale as the BOM row).
  // …and (GP-B5 W8/DS-47) of the CLI-entry realpath test: build/lib.mjs's
  // isMainModule guards the two markdown generators' mains so their renderer
  // layers import side-effect-free for the T-9 pins in test-wiki-html.mjs
  // (same lane rationale again — build/ cannot import doc-lib's copy).
  "build/lib.mjs": [
    "single-leading-BOM strip",
    "inline code-span sentinel (T-9 single source, DS-25)",
    "pipe-cell sentinel (T-9 single source, DS-25)",
    "CLI-entry realpath test",
  ],
  // DS-24: the one sanctioned raw consumer of extractFencedJson outside
  // doc-lib — jo-report.mjs's deliberate error-reporting fence-parse variant
  // (parseErrors, not parseDocJson's null signal) plus its ER-1 re-export of
  // the primitive.
  // …and (DS-42 / T-3 v4) one of the four read-side envelope-unwrap homes:
  // parseJourneyDoc's one-level `data` unwrap (plus liveEntriesFrom's array
  // collector, which spells the same type test over a live `jo p list` page —
  // the T-3 header lists it as outside the KB rule; file-granular here).
  "plugins/gs-superadmin/scripts/jo-report.mjs": [
    "KB-doc fence parse (parseDocJson single source, DS-24)",
    "KB-doc envelope unwrap (T-3 read-side homes, DS-42)",
  ],
  // DS-42 / T-3 v4: the other three read-side envelope-unwrap homes; the
  // per-home rationale lives ONCE, in doc-lib's T-3 header (the canon this
  // map enforces file-by-file).
  "plugins/gs-superadmin/scripts/describe-batch.mjs":
    ["KB-doc envelope unwrap (T-3 read-side homes, DS-42)"],
  "plugins/gs-superadmin/scripts/jo-report-deps.mjs":
    ["KB-doc envelope unwrap (T-3 read-side homes, DS-42)"],
  "plugins/gs-superadmin/scripts/tenant-deps.mjs":
    ["KB-doc envelope unwrap (T-3 read-side homes, DS-42)"],
};
// DOC_LIB is the primitives' home, not a copy — excluded up front so the pass
// line's read accounting stays exact (F-201).
// Repo-root test/ (the shared rig) IS in scope: the test-lane exemption's
// rationale — independent probes re-derive mechanisms — does not apply to a
// SHARED rig, so a portability rule growing there must be flagged like any
// other unsanctioned copy (B5 W1 / B2 review, finder B).
const sweep9 = trackedAll.filter(
  (f) =>
    f.endsWith(".mjs") &&
    (f.startsWith("plugins/gs-superadmin/") || f.startsWith("build/") || f.startsWith("test/")) &&
    !isTest(f) && // the registry's one test-lane predicate (F-378; check 19's scopes read the same)
    f !== DOC_LIB,
);
const sweep9Skipped = [];
let sweep9Read = 0;
for (const f of sweep9) {
  let src;
  try {
    src = readFileSync(join(ROOT, f), "utf8");
  } catch {
    sweep9Skipped.push(f); // named in the pass line, never silently dropped (F-201)
    continue;
  }
  sweep9Read++;
  const allowed = SANCTIONED_PORTABILITY_COPIES[f] ?? [];
  for (const [label, needles] of SIGNATURES) {
    if (!needles.some((n) => src.includes(n))) continue;
    if (allowed.includes(label)) continue;
    fail(
      `${f}: defines the "${label}" portability rule but is not sanctioned for it — import the ` +
        `doc-lib primitive instead (in build/, where doc-lib is an illegal cross-lane import, ` +
        `use build/lib.mjs's helper), or (deliberately) add the file to doc-lib's ` +
        `sanctioned-duplicates header AND SANCTIONED_PORTABILITY_COPIES in this check (F-159) — ` +
        `and if the file must also be import-restricted (self-contained/dual-lane), to ` +
        `build/check-imports.mjs's RESTRICTED table`,
    );
  }
}
for (const [f, labels] of Object.entries(SANCTIONED_PORTABILITY_COPIES)) {
  let src;
  try {
    src = readFileSync(join(ROOT, f), "utf8");
  } catch {
    fail(`${f}: on the sanctioned portability-duplicates list but not readable in the tree — prune the list (F-159)`);
    continue;
  }
  for (const label of labels) {
    const needles = SIGNATURES.find(([l]) => l === label)?.[1] ?? [];
    if (!needles.some((n) => src.includes(n))) {
      fail(
        `${f}: sanctioned for the "${label}" portability rule but no longer defines it — ` +
          `remove the entry here and from doc-lib's sanctioned-duplicates header (F-159)`,
      );
    }
  }
}
// Prose lock: every sanctioned copy must be NAMED in doc-lib's portability header
// enumeration (the region from the section rule to its first export), so the prose
// list and this map cannot drift apart silently. F-199: the match is the FULL
// repo-root-relative path with a leading component-boundary guard — basename
// matching let the two basename-colliding build/ entries ride on their
// plugin-local twins' mentions, so the enumeration could flatly disclaim the
// build/ copies and stay green. Each path must therefore appear verbatim on a
// single enumeration line.
{
  const docLibSrc = readFileSync(join(ROOT, DOC_LIB), "utf8");
  const secStart = docLibSrc.indexOf("── Portability primitives");
  // The enumeration window ends at whichever comes first after the section
  // banner: the first export, or the T-7 typedef block (B5 W0 placed it between
  // the enumeration and the first export). Without the earlier bound, a path
  // named only inside the T-7 JSDoc would satisfy this lock while the
  // enumeration it exists to keep fresh stays stale (the F-151/F-158 class).
  const enumEndCandidates = [docLibSrc.indexOf("export", secStart), docLibSrc.indexOf("/**", secStart)]
    .filter((i) => i !== -1);
  const enumBlock =
    secStart === -1 || enumEndCandidates.length === 0
      ? ""
      : docLibSrc.slice(secStart, Math.min(...enumEndCandidates));
  // True when p occurs in block at a position not preceded by a path character:
  // check 5's F-184 boundary rule adapted to repo-root-relative paths (which
  // carry no leading "/"), so `x/build/extract-catalog.mjs` in the prose can
  // never satisfy the entry for `build/extract-catalog.mjs`.
  const namedAsPath = (block, p) => {
    for (let i = block.indexOf(p); i !== -1; i = block.indexOf(p, i + 1)) {
      if (i === 0 || !/[A-Za-z0-9_./-]/.test(block[i - 1])) return true;
    }
    return false;
  };
  if (!enumBlock) {
    fail(`${DOC_LIB}: portability-primitives section header not found — check 9 cannot lock the sanctioned-duplicates prose to the tree (F-159)`);
  } else {
    for (const f of Object.keys(SANCTIONED_PORTABILITY_COPIES)) {
      if (!namedAsPath(enumBlock, f)) {
        fail(`${DOC_LIB}: the sanctioned-duplicates enumeration does not name ${f} (full repo-root-relative path, on one line), which SANCTIONED_PORTABILITY_COPIES sanctions — the F-151/F-158 staleness class (F-159/F-199)`);
      }
    }
  }
}

// ── check 10 (F-166, hardened F-172/F-175/F-185; INVERTED at GP-B5 DS-43): the ──
// F-163 shell rule, locked to the tree. Mechanism of record (F-175, verified
// against the plugins reference and a live load on this harness): the plugin
// LOADER substitutes `${CLAUDE_PLUGIN_ROOT}` into skill content before the
// model reads it, and the variable is exported only to hook/MCP processes —
// never to tool shells. So a LITERAL placeholder that survives into a shell
// (repo-tree read, pasted snippet) expands to empty in bash AND PowerShell
// alike. DS-43 removed the cause instead of policing the symptom: skill fences
// address bundled scripts through the workspace link `.gs-superadmin/plugin/…`
// (scripts/plugin-link.mjs, refreshed by the SessionStart hook), so the
// placeholder has exactly ONE legitimate site in any skill — setup's first-run
// link fence, where no link exists yet — and that site keeps the
// surviving-literal warning above it. Everywhere else the placeholder is the
// seven-skill warning family regrowing (F-163 → F-185, four rounds on one
// paragraph), and this check reds it BY NAME.
const PLUGIN_ROOT_VAR = "${CLAUDE_PLUGIN_ROOT}";
const PLUGIN_ROOT_BARE = "CLAUDE_PLUGIN_ROOT";
const RETIRED_REF_PLACEHOLDER = "<plugin-root>"; // setup's reference files' pre-DS-43 spelling
// The retired warning family's VOCABULARY, as data (F-387 reopen, tester round 1):
// the DS-43 rewrite deleted the six warnings by their token and left three
// sentences that POINTED at them by phrase ("the surviving-placeholder rule
// from step 2 applies to this fence too — substitute the plugin's root
// directory before running a command that still shows the literal") — each
// now instructing the opposite of the operating model's link bullet at the
// site a reader reaches first. A token check cannot see a reference to the
// rule it retired, so the family is enumerated here by what its members SAY.
// Permitted in exactly one place: setup's pinned warning window (the
// PROSE_WINDOW_LINES window above the one placeholder fence). Case-insensitive;
// no phrase is a word any skill uses for another purpose (census at add time:
// the three dangling sites + setup's window, nothing else in skills/,
// references/ or the operating model).
const RETIRED_WARNING_PHRASES = [
  "surviving-placeholder", "surviving placeholder", "surviving-literal", "surviving literal",
  "substitute the plugin's root", "shows the literal", "shows a literal", "placeholder rule", "run it as-is",
];
const retiredPhraseIn = (line) => {
  const l = line.toLowerCase();
  return RETIRED_WARNING_PHRASES.find((p) => l.includes(p)) ?? null;
};
const retiredPhraseFail = (rel, i, phrase, where) =>
  fail(
    `${rel}:${i + 1}: "${phrase}" — a reference to the surviving-literal warning family retired at DS-43 ${where}: ` +
      `fences run through .gs-superadmin/plugin and can never show a literal, and an ENOENT there means the link is ` +
      `missing (the operating model's link bullet) — a sentence telling the model to substitute a plugin root instead ` +
      `routes around the link (F-387 reopen); delete it, or if it is the pinned warning, keep it inside setup's window`,
  );
const OPERATING_MODEL = "plugins/gs-superadmin/templates/operating-model.md";
const WORKSPACE_LINK = ".gs-superadmin/plugin";
// Pin the SET of skill names, not a bare count (F-172): a count survives a
// same-commit swap (one skill drops the variable while another gains it), and
// its failure message reads as "adjust the number". Since DS-43 the set is
// exactly {setup} and the fence count in it exactly 1 — a second placeholder
// fence anywhere, setup included, is the family regrowing; update either
// deliberately (E3: banned everywhere except hooks.json + setup's link fence).
const EXPECTED_PLUGIN_ROOT_SKILLS = new Set(["setup"]);
const EXPECTED_PLUGIN_ROOT_FENCES_PER_SKILL = 1;
// The normative line's prose window is bounded (F-172): between the preceding
// fence and the variable fence, but never more than PROSE_WINDOW_LINES above the
// fence — an unbounded window degenerates to the whole file for skills whose
// variable fence is their first (or only) fence, where any unrelated
// bash/PowerShell sentence satisfies the match. Unchanged at DS-43: placement
// moves, the window never widens (F-166/F-172).
const PROSE_WINDOW_LINES = 14;

// ONE fence-grammar core for every fence consumer in this file (F-183): checks
// 5, 10, 13, and 14 must never disagree about what a fence is, so the mechanics
// live here exactly once. F-329 redesign: markers used to pair by even/odd
// POSITION with no character or length matching, so two stray delimiter-leading
// lines silently SHIFTED every range downstream — and the mis-pairing was LIVE
// on the shipped tree (report-template.md's 4-backtick wrappers paired into six
// phantom ranges). Pairing is now CommonMark's: an opener is a 3-plus backtick
// run at <=3 spaces of indent (info string allowed); its closer is a backtick
// run at least as LONG, at <=3 spaces of indent, with nothing else on the line;
// shorter runs inside are content (which is exactly how a 4-backtick wrapper
// carries ``` examples). Every shape the grammar cannot read one way fails at
// ITS OWN line (the F-328 round-3 lesson: a stateful model must never let one
// misread line silently reclassify a span):
//   - a ~~~ fence outside a backtick fence (unsupported in this tree),
//   - an indented (4-plus spaces, or tab) delimiter outside a fence — an
//     indented-code literal and a (list-nested) fence read the same to a
//     line-local grammar, and silently picking either side is the F-329 repro,
//   - a line-leading backtick run whose info string contains a backtick —
//     CommonMark says that is a paragraph (a line-leading code span), not an
//     opener, so treating it as one would let a single line open a phantom
//     span (the review round's addition to the single-stray argument),
//   - an opener-shaped line inside an open fence (same-or-longer run with an
//     info string) — the lost-closer signature,
//   - a fence still open at EOF, reported at its opener (generalizes the
//     F-183 odd-count hard fail: every single-stray-delimiter shape now ends
//     in one of these refusals — an odd toggle count can no longer pass).
// Declared limits, each with its direction: TWO stray bare ``` lines in prose
// form a grammatically legal phantom fence — silent, but bounded to their own
// span, where the old model shifted every range to EOF. The grammar is
// LINE-LOCAL and cannot see list containers, so a fence CommonMark would
// accept inside a deep list item (delimiter at 4-plus absolute spaces) is
// refused — loud, with the repo convention (delimiters at <=3 absolute
// spaces) as the remedy, never a silent pick between the two readings. And
// the <=3-spaces boundary is also spelled in check-stale-facts' line-local
// bus rules (BUS_FENCE_DELIM_RE / BUS_INDENT_RE) — deliberate duplication
// with comment-tier sync accepted (A-2): the two checkers scan disjoint
// corpora, so a divergence cannot misclassify the same line in both.
// Returns {problems, ok, ranges}: problems non-empty means the file is RED
// and possibly incompletely paired (an unclosed fence's content is in no
// range) — but every range returned IS a grammar-valid pair, so callers keep
// scanning them instead of going blind; ok is problems.length === 0. Each
// caller owns its failure messages.
//
// PINNING LEDGER (F-335→F-337; redesigned at F-338/F-339) — what pins WHAT:
//   - The GRAMMAR's behavior is pinned by FENCE_BATTERY in
//     build/sweep-fence-grammar.mjs: committed inputs → exact
//     {problems, ok, ranges} outputs, judged in-process against this
//     function's own source. The battery's discriminating power is not
//     trusted: the same tool derives every mutation site mechanically from
//     the source and kills every mutant against the battery in memory;
//     survivors must match its DECLARED_SURVIVORS exactly. The class list's
//     completeness claim has two halves (F-339 + its reopen): constructs
//     that occupy code of their own are residue-checked and red on arrival;
//     RELATIONS between constructs (guard order in if/else-if chains,
//     statement order) are generated as explicit classes whose boundary is
//     declared in the tool header, not residue-checkable at any granularity.
//     The suite's census gate RUNS that sweep on every run — no fingerprint
//     to update, no manual ritual to forget.
//   - The four CONSUMERS' use of the returned contract is pinned by the
//     suite's own always-running arms, enumerated in the scope boundary
//     below (that part is e2e by nature and stays in the suite).
// History that forced this design: five rounds (F-332 closer conjunct →
// F-335 sibling clauses → F-336 return statement → F-337 for header →
// F-339 destructure/guard classes) each found the construct the previous
// round's human-authored enumeration read through on the way to the one it
// was reading. What ended the recurrence was not a better enumeration but a
// CHECKED one (residue tiling against the source) with a judge cheap enough
// to run on every suite run (F-338) — an eye-shaped hole cannot ride along
// silently when the census itself is a standing check.
// Scope boundary, stated so the next sweep knows where the census ends: the
// census covers THIS function; each of the FOUR consumers' use of the
// contract is pinned by its own arm — check 5's suffix (G6) and withhold/
// fire (G15/G15b); fenceRanges' TWO call sites, check 10 (suffix G7,
// no-cascade G9) and check 13 (suffix G18); and check 14's ranges-only
// consumer reports nothing itself because a refused file is already red via
// check 10 (SKILL.md) or check 13 (references) — VERIFIED by probe (F-336
// round: a stray tilde appended to a reference file reds at its own line
// through check 13's caller), not assumed.
// Declared survivors: exactly the tool's DECLARED_SURVIVORS list (three
// equivalents, each with its reason there) — anything else a sweep leaves
// alive is a finding, not a recorded decision (F-327 precedent).
// Typed OUTSIDE the function (DS-42): the census slice starts at the `function`
// line, so this typedef is invisible to it, while a comment inside the body
// became five mutation sites (measured live). The consumers cast to it; a
// producer-side @returns is rejected by tsc (the arrays widen from their
// pushes) unless the body is annotated — which is exactly what must not happen.
/** @typedef {[number, string]} FenceProblem  one refused line: [lineIdx, reason] */
function scanFenceMarkers(lines) {
  const problems = []; // [lineIdx, reason] — each refused at its own line
  const ranges = [];
  let open = null; // { line, run }
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)(`{3,}|~{3,})(.*)$/.exec(lines[i]);
    if (!m) continue;
    const [, indent, run, rest] = m;
    const backtick = run[0] === "`";
    const flush = /^ {0,3}$/.test(indent);
    if (!open) {
      if (!backtick) problems.push([i, "~~~ fence markers are not supported — use plain ``` fences"]);
      else if (!flush)
        problems.push([i, "indented ``` delimiter outside any fence — this checker's grammar is line-local and cannot see list containers, so it cannot tell an indented-code literal from a list-nested fence; keep fence delimiters at 3 or fewer absolute spaces (the repo convention), or restructure the block (F-329)"]);
      else if (rest.includes("`"))
        problems.push([i, "line-leading backtick run with a backtick in its info string — CommonMark says this is NOT a fence opener (a paragraph starting with a code span reads exactly the same way), and silently picking either side lets one line open a phantom span; rework the line so it does not start with a delimiter run (F-329)"]);
      else open = { line: i, run: run.length };
    } else if (backtick && flush && run.length >= open.run) {
      if (rest.trim() === "") {
        ranges.push([open.line, i]);
        open = null;
      } else {
        problems.push([i, `fence-opener-shaped line inside the fence opened at line ${open.line + 1} — a lost closer upstream, or an unmarked nested fence; close the open fence, or wrap the example in a longer-run fence (\`\`\`\`) so delimiter and content cannot be confused (F-329)`]);
      }
    }
    // anything else inside an open fence — shorter runs, indented delimiters,
    // tilde runs — is ordinary fence content
  }
  if (open) problems.push([open.line, "``` fence opened here is never closed — an unclosed fence makes pairing undefined and silently hides content (F-183)"]);
  return { problems, ok: problems.length === 0, ranges };
}

// Fence ranges as [openLine, closeLine] pairs, from the shared grammar core
// above, failing LOUDLY on every line the grammar refuses (F-172) with the
// caller's own suffix. The grammar-valid ranges are returned even when the
// file is red: withholding them made every downstream per-file rule fire a
// SECOND, misleading failure (check 10's pinned-set message told the
// maintainer to shrink EXPECTED_PLUGIN_ROOT_SKILLS over a stray tilde), and
// scanning valid pairs on a red file can only find more, never less.
function fenceRanges(rel, lines, suffix = "an unreadable fence hides its content from check 10 (F-172)") {
  const { problems, ranges } = scanFenceMarkers(lines);
  for (const [i, why] of /** @type {FenceProblem[]} */ (problems)) {
    fail(`${rel}:${i + 1}: ${why} — ${suffix}`);
  }
  return ranges;
}

const pluginRootSkillsSeen = new Set();
let placeholderFences = 0;
for (const name of skills) {
  const rel = `${SKILLS_DIR}/${name}/SKILL.md`;
  const lines = read(rel).split(/\r?\n/);
  const ranges = fenceRanges(rel, lines);

  // (a) trailing-backslash continuations: bash line-continuation syntax that
  // Windows PowerShell parses as a literal backslash, executing the continuation
  // lines as separate broken commands.
  for (const [a, b] of ranges) {
    for (let i = a + 1; i < b; i++) {
      if (/\\\s*$/.test(lines[i])) {
        fail(
          `${rel}:${i + 1}: fenced command ends in a backslash line continuation — bash-only syntax; ` +
            `Windows PowerShell treats it as a literal backslash and runs the next line as its own ` +
            `broken command. Collapse the fence to a single-line command (F-163)`,
        );
      }
    }
  }

  // (b) the placeholder policy (DS-43, E3): no skill fences the placeholder
  // except setup's pinned first-run link fence, and prose never names it
  // outside that fence's warning window — the brace form in prose, or the
  // bare name anywhere else, is the retired seven-skill warning family
  // regrowing. Fences AND prose are swept, by name and line.
  const varFences = ranges.filter(([a, b]) => lines.slice(a + 1, b).some((l) => l.includes(PLUGIN_ROOT_VAR)));
  const inFence = (i) => ranges.some(([a, b]) => i > a && i < b);
  if (varFences.length) pluginRootSkillsSeen.add(name);
  placeholderFences += varFences.length;
  // Inside ANY fence, the bare spelling ($CLAUDE_PLUGIN_ROOT, $env:CLAUDE_PLUGIN_ROOT)
  // is wrong in every skill, setup included: the plugin loader substitutes only
  // the ${CLAUDE_PLUGIN_ROOT} form, so a bare spelling expands to empty in every
  // shell (F-394, Gate-2 review of 0.36.1 — the braced-only test left this hole).
  for (const [a, b] of ranges) {
    lines.slice(a + 1, b).forEach((l, k) => {
      if (l.includes(PLUGIN_ROOT_BARE) && !l.includes(PLUGIN_ROOT_VAR)) {
        fail(
          `${rel}:${a + 2 + k}: fence spells ${PLUGIN_ROOT_BARE} without braces — the plugin loader substitutes only the ` +
            `${PLUGIN_ROOT_VAR} form, so this expands to empty in every shell; address the script as node ${WORKSPACE_LINK}/scripts/<x>.mjs … (F-394)`,
        );
      }
    });
  }
  if (!EXPECTED_PLUGIN_ROOT_SKILLS.has(name)) {
    for (const [a] of varFences) {
      fail(
        `${rel}:${a + 1}: fence uses ${PLUGIN_ROOT_VAR} — since DS-43 skill fences address bundled scripts as ` +
          `node ${WORKSPACE_LINK}/scripts/<x>.mjs … (the workspace link scripts/plugin-link.mjs maintains at every ` +
          `session start); the placeholder is pinned to setup's first-run link fence only (E3 — the F-163→F-185 ` +
          `surviving-literal family must not regrow)`,
      );
    }
    lines.forEach((l, i) => {
      if (inFence(i)) return;
      if (l.includes(PLUGIN_ROOT_BARE)) {
        fail(
          `${rel}:${i + 1}: names ${PLUGIN_ROOT_BARE} in prose — the surviving-literal warning family was retired at ` +
            `DS-43 (F-163/F-166/F-175/F-185); plugin files the model reads are addressed as ${WORKSPACE_LINK}/…`,
        );
      }
      const phrase = retiredPhraseIn(l);
      if (phrase) retiredPhraseFail(rel, i, phrase, "outside the one skill that keeps it");
    });
    continue;
  }
  if (varFences.length !== EXPECTED_PLUGIN_ROOT_FENCES_PER_SKILL) {
    fail(
      `${rel}: ${varFences.length} fence(s) use ${PLUGIN_ROOT_VAR} (lines ${varFences.map(([a]) => a + 1).join(", ") || "none"}) — ` +
        `exactly ${EXPECTED_PLUGIN_ROOT_FENCES_PER_SKILL} is pinned: the first-run plugin-link fence, the one command that must ` +
        `run before the link exists; every other command goes through ${WORKSPACE_LINK}/… (DS-43, E3)`,
    );
  }
  if (!varFences.length) continue;
  // The pinned site keeps the surviving-literal warning in the bounded prose
  // window above it. The required elements match F-175's corrected wording:
  // the placeholder by name, BOTH shells, the expands-to-empty mechanism, and
  // the do-not-run-as-is instruction.
  const firstVarFence = varFences[0];
  const prevClose = ranges.filter(([, b]) => b < firstVarFence[0]).map(([, b]) => b).pop() ?? -1;
  const winStart = Math.max(prevClose + 1, firstVarFence[0] - PROSE_WINDOW_LINES);
  const prose = lines.slice(winStart, firstVarFence[0]).join(" ");
  const namesVar = prose.includes("CLAUDE_PLUGIN_ROOT");
  const braceFormInWindow = prose.includes(PLUGIN_ROOT_VAR);
  const namesBothShells = /\bbash\b/i.test(prose) && /PowerShell/i.test(prose);
  const namesMechanism = /(empty|expand|substitut)/i.test(prose);
  const namesInstruction = /as-is/i.test(prose);
  if (!(namesVar && namesBothShells && namesMechanism && namesInstruction)) {
    const missing = [
      !namesVar && "the CLAUDE_PLUGIN_ROOT placeholder",
      !namesBothShells && "both shells (bash and PowerShell)",
      !namesMechanism && "the expands-to-empty mechanism",
      !namesInstruction && "the do-not-run-as-is instruction",
    ]
      .filter(Boolean)
      .join(", ");
    fail(
      `${rel}: the prose within ${PROSE_WINDOW_LINES} lines above the first fence using ${PLUGIN_ROOT_VAR} ` +
        `(line ${firstVarFence[0] + 1}) does not name ${missing} — every skill fencing the variable must warn ` +
        `that a surviving literal placeholder must not be run as-is, and say why (F-163/F-166/F-175)`,
    );
  }
  // F-185: the warning prose must name the placeholder BARE, never in brace
  // form. The loader substitutes the brace form anywhere it appears in skill
  // content — including inside the very sentence warning about it — so a
  // brace-form spelling renders in a live session as the absolute plugin path
  // and garbles the one instruction the line exists to give, invisibly to any
  // repo-tree reviewer. Scoped to this window only: ordinary prose elsewhere
  // SHOULD keep the brace form, because there substitution to a real path is
  // exactly the desired rendering.
  if (braceFormInWindow) {
    fail(
      `${rel}: the prose within ${PROSE_WINDOW_LINES} lines above the first fence using ${PLUGIN_ROOT_VAR} ` +
        `(line ${firstVarFence[0] + 1}) spells the placeholder in brace form — the loader substitutes ` +
        `\${...} anywhere it appears, so in a live session this warning would render with the absolute ` +
        `path substituted into its own sentence and stop describing a literal; name it bare ` +
        `(CLAUDE_PLUGIN_ROOT) in the warning prose (F-175/F-185)`,
    );
  }
  // Outside the pinned fence and its warning window, setup itself must not
  // name the placeholder either: the brace form in prose renders as a path in
  // a live session and reads as a path to resolve elsewhere (the retired
  // Phase 3 lead sentence); the bare name is the warning family regrowing.
  lines.forEach((l, i) => {
    if (inFence(i) || (i >= winStart && i < firstVarFence[0])) return;
    if (l.includes(PLUGIN_ROOT_VAR)) {
      fail(`${rel}:${i + 1}: spells ${PLUGIN_ROOT_VAR} in prose outside the pinned link fence — plugin files are addressed as ${WORKSPACE_LINK}/… (DS-43, E3)`);
    } else if (l.includes(PLUGIN_ROOT_BARE)) {
      fail(`${rel}:${i + 1}: names ${PLUGIN_ROOT_BARE} outside the pinned link fence's warning window — one warning, one site (DS-43, E3)`);
    }
    const phrase = retiredPhraseIn(l);
    if (phrase) retiredPhraseFail(rel, i, phrase, "outside the pinned fence's warning window");
  });
}
{
  const missing = [...EXPECTED_PLUGIN_ROOT_SKILLS].filter((s) => !pluginRootSkillsSeen.has(s));
  if (missing.length) {
    fail(
      `check 10: the set of skills fencing ${PLUGIN_ROOT_VAR} changed — no longer fencing it: ${missing.join(", ")}; ` +
        `setup's first-run link fence is the only way a fresh workspace gets its ${WORKSPACE_LINK} link, so it cannot be ` +
        `retired without a replacement; if the change is genuine, update EXPECTED_PLUGIN_ROOT_SKILLS deliberately — ` +
        `never to make the check pass (F-166/F-172, DS-43)`,
    );
  }
}
// The session-loaded counterpart: the operating model must tell every later
// session what `.gs-superadmin/plugin` is (refreshed at every session start),
// what an ENOENT through it means (the link is missing or stale), and the
// remedy (/gs-superadmin:setup). Test the predicates against the ONE bullet
// that names the link — whole-file matching was satisfied by unrelated
// pre-existing mentions (F-172). The surviving-literal bullet it replaced
// must not creep back: the placeholder's name is banned from the file.
{
  const omLines = read(OPERATING_MODEL).split(/\r?\n/);
  const start = omLines.findIndex((l) => /^- /.test(l) && l.includes(WORKSPACE_LINK));
  let bullet = "";
  if (start !== -1) {
    let end = start + 1;
    while (end < omLines.length && /^ {2,}\S/.test(omLines[end])) end++;
    bullet = omLines.slice(start, end).join(" ");
  }
  if (!(bullet && /refresh/i.test(bullet) && /session start/i.test(bullet) && /ENOENT/.test(bullet) && /\/gs-superadmin:setup/.test(bullet))) {
    fail(
      `${OPERATING_MODEL}: missing (or incomplete) the plugin-link bullet — it must be a top-level bullet naming ` +
        `${WORKSPACE_LINK}, that the plugin refreshes it at every session start, that an ENOENT through it means the ` +
        `link is missing or stale, and /gs-superadmin:setup as the remedy (DS-43; it replaced the surviving-literal ` +
        `bullet of F-163/F-166/F-172/F-175)`,
    );
  }
  omLines.forEach((l, i) => {
    if (l.includes(PLUGIN_ROOT_BARE)) {
      fail(`${OPERATING_MODEL}:${i + 1}: names ${PLUGIN_ROOT_BARE} — the surviving-literal bullet was retired at DS-43; the link bullet is the one statement (E3)`);
    }
    const phrase = retiredPhraseIn(l);
    if (phrase) retiredPhraseFail(OPERATING_MODEL, i, phrase, "in the session-global doc");
  });
}
// Reference files under skills are read as plain files during execution — the
// loader's content substitution does NOT reach them, so a fenced placeholder
// there would ALWAYS survive as a literal. F-202: the sweep walks references/
// RECURSIVELY and reads every file regardless of extension — the rationale is
// substitution reach, which cares about neither nesting depth nor file type
// (the change-request examples are nested .json), so a flat .md-only listing
// left them invisible. DS-43: the retired `<plugin-root>` spelling (setup's
// reference files used it while SKILL.md carried the substitution caveat) is
// swept the same way, so the caveat cannot creep back — reference files
// address plugin files as `.gs-superadmin/plugin/…` like every fence.
// A skill's reference files are enumerated from the TRACKED tree (gate-3
// review round, F-350), the same universe every other check scans — check 13
// filters trackedMd for the same directory, and a working-tree walk had check
// 14 going red on an untracked scratch file no other check could see.
// Recursive and extension-agnostic by construction (the F-202 rationale).
const skillReferenceFiles = (name) => {
  const prefix = `${SKILLS_DIR}/${name}/references/`;
  return trackedAll.filter((f) => f.startsWith(prefix));
};
for (const name of skills) {
  for (const rel of skillReferenceFiles(name)) {
    const refSrc = read(rel);
    if (refSrc.includes(PLUGIN_ROOT_VAR)) {
      fail(
        `${rel}: contains ${PLUGIN_ROOT_VAR} — reference files are read outside ` +
          `the loader's substitution, so the literal always survives there; address the plugin file as ` +
          `${WORKSPACE_LINK}/… instead (F-172/F-202, DS-43)`,
      );
    }
    if (refSrc.includes(RETIRED_REF_PLACEHOLDER)) {
      fail(
        `${rel}: contains the retired ${RETIRED_REF_PLACEHOLDER} spelling — reference files address plugin files ` +
          `as ${WORKSPACE_LINK}/… since DS-43; the substitution caveat it needed must not creep back`,
      );
    }
    refSrc.split(/\r?\n/).forEach((l, i) => {
      const phrase = retiredPhraseIn(l);
      if (phrase) retiredPhraseFail(rel, i, phrase, "in a reference file (which no window ever permits)");
    });
  }
}

// --- 11. Every localeCompare call passes an explicit string-literal locale (F-141) ------
// F-128 pinned the report comparators to "en" and F-140 pinned the pin with a
// locale-divergent fixture pair — but the fixture lives in one suite, and the
// mutant that matters most (a comparator silently falling back to the ambient
// locale) is invisible on an English-default machine for every OTHER call site.
// This is the check-8/check-9 shape: encode the invariant as a tracked-file
// sweep so the mutant dies on every machine. Classification rule: a site is a
// CALL (needle is dot-name-openparen, built by concatenation so this file never
// contains one); its argument list is parsed by bracket depth and split on
// top-level commas; the second argument must open with a quote. An explicit
// `undefined` locale fails — that is exactly the F-140 mutant. Non-call
// mentions (prose, comments without parens) never match. Exclusions are the
// two bus files, which quote historical bare spellings verbatim as record.
const LC_NEEDLE = "." + "locale" + "Compare" + "(";
const LC_EXCLUDE = new Set(["dev/FEEDBACK.md", "dev/FEEDBACK-archive.md"]);
let lcCalls = 0;
for (const f of trackedAll) {
  if (LC_EXCLUDE.has(f)) continue;
  let text;
  try {
    text = readFileSync(join(ROOT, f), "utf8");
  } catch {
    continue;
  }
  let idx = text.indexOf(LC_NEEDLE);
  while (idx !== -1) {
    lcCalls++;
    // Parse the argument list: bracket-depth scan, top-level comma split.
    const args = [""];
    let depth = 1;
    let inStr = null;
    for (let j = idx + LC_NEEDLE.length; j < text.length && depth > 0; j++) {
      const c = text[j];
      if (inStr) {
        if (c === inStr && text[j - 1] !== "\\") inStr = null;
      } else if (c === '"' || c === "'" || c === "`") {
        inStr = c;
      } else if (c === "(" || c === "[" || c === "{") {
        depth++;
      } else if (c === ")" || c === "]" || c === "}") {
        depth--;
        if (depth === 0) break;
      } else if (c === "," && depth === 1) {
        args.push("");
        continue;
      }
      args[args.length - 1] += c;
    }
    const locale = (args[1] || "").trim();
    if (!/^["'`]/.test(locale)) {
      const line = text.slice(0, idx).split("\n").length;
      fail(
        `${f}:${line}: localeCompare without an explicit string-literal locale — an ambient-locale ` +
          `fallback sorts differently across machines; pass "en" (or the deliberate locale) explicitly (F-141)`,
      );
    }
    idx = text.indexOf(LC_NEEDLE, idx + 1);
  }
}

// --- 12. MAINTAINERS.md's Scripts table names every shipped script (F-243) ------
// Same shape as check 5's runner list: enumerate the tree, require a
// `scripts/<file>` row in the "## Scripts" section, both directions. Shared
// lib modules the scripts import are described in the prose above the table
// rather than as rows — they only need a backticked mention anywhere in the
// file.
const SCRIPTS_DIR = "plugins/gs-superadmin/scripts";
const MAINTAINERS = "plugins/gs-superadmin/MAINTAINERS.md";
const SHARED_LIBS = new Set(["doc-lib.mjs", "journal-lib.mjs"]);
const scriptFiles = readdirSync(join(ROOT, SCRIPTS_DIR)).filter((f) => f.endsWith(".mjs"));
const maintainersText = read(MAINTAINERS);
const scriptsSection = maintainersText.split(/^## Scripts$/m)[1]?.split(/\n## /)[0] ?? "";
let scriptRowsNamed = 0;
if (!scriptsSection) {
  fail(`${MAINTAINERS}: no "## Scripts" section found — the Scripts table is load-bearing for maintainers (F-243)`);
} else {
  for (const f of scriptFiles) {
    if (SHARED_LIBS.has(f)) {
      if (!maintainersText.includes(`\`${f}\``)) {
        fail(`${MAINTAINERS}: shared lib module ${f} is not mentioned anywhere — name it in the prose above the Scripts table (F-243)`);
      }
      continue;
    }
    if (!scriptsSection.includes(`\`scripts/${f}\``)) {
      fail(
        `${MAINTAINERS}: Scripts table has no row naming \`scripts/${f}\` — every shipped script gets a row, ` +
          `or a maintainer consulting the table re-derives (or hand-edits around) what the script owns (F-243)`
      );
    } else {
      scriptRowsNamed++;
    }
  }
  // Reverse direction: a row naming a retired script misdirects the same reader.
  for (const m of scriptsSection.matchAll(/`scripts\/([A-Za-z0-9._-]+\.mjs)`/g)) {
    if (!scriptFiles.includes(m[1])) {
      fail(`${MAINTAINERS}: Scripts table names \`scripts/${m[1]}\`, which does not exist in ${SCRIPTS_DIR} (F-243)`);
    }
  }
}

// Skipped-as-binary/unreadable files are named, not silently folded into the
// coverage claim (F-201) — the counts below are files actually READ. Declared
// exclusions get the same treatment (F-211) so the two counts plus the read
// count always reconcile against `git ls-files`.
const check8SkippedNote = check8Skipped.length
  ? ` [${check8Skipped.length} binary/unreadable file(s) NOT swept for invisibles: ${check8Skipped.join(", ")}]`
  : "";
const check8ExcludedNote = check8Excluded.length
  ? ` [${check8Excluded.length} declared exclusion(s) NOT swept for invisibles: ${check8Excluded.join(", ")}]`
  : "";
const sweep9SkippedNote = sweep9Skipped.length
  ? ` [${sweep9Skipped.length} file(s) NOT swept for portability duplicates: ${sweep9Skipped.join(", ")}]`
  : "";
// ── check 10 · link paths (F-398): every `.gs-superadmin/plugin/<path>` names a tracked plugin file ──
// DS-43 moved ~40 skill, reference and template fences from the placeholder to
// the workspace link, and the check above bans the placeholder — but nothing
// held the PATH after `.gs-superadmin/plugin/` to the tree. A renamed or moved
// script, or `plugins/` typed for `plugin/`, stayed green through every gate
// and failed live with MODULE_NOT_FOUND — which the operating model's link
// bullet teaches the model to read as a missing link, sending the user to
// re-run setup for a defect setup cannot fix. So every such token in the
// skills (SKILL.md + references), the templates and the operating model must
// name a TRACKED file under plugins/gs-superadmin/ (a trailing slash: a
// tracked directory). Grammar, stated so the next reader knows the edges: the
// path runs over [A-Za-z0-9_./<>-] and trailing sentence punctuation is
// dropped; a path containing <…> is a placeholder the prose fills in
// (`scripts/<x>.mjs`) and is not resolved; an empty path (the bare link,
// `.gs-superadmin/plugin/…`) names the mechanism, not a file.
// F-408 (Gate 2 for 0.36.2, A-9): the FIRST segment after `.gs-superadmin/`
// is parsed generically and held to the allowlist of real workspace entries
// below — not to the one typo the finding named (`plugins`). A matcher that
// enumerates misspellings needs a new tune per misspelling; a segment the
// tree does not know is red whatever it is spelled. The allowlist is the
// census of `.gs-superadmin/<entry>` names across the plugin's prose and
// scripts, kept here as data; a new workspace entry is admitted by naming it.
// Scope is the surfaces a session executes from — README/MAINTAINERS prose is
// deliberately not swept (F-398 as logged) — and, since F-408, every skill
// reference file at any extension, the same set the placeholder half sweeps.
const LINK_PATH_RE = /\.gs-superadmin\/([A-Za-z0-9_.<>-]+)(?:\/([A-Za-z0-9_./<>-]*))?/g;
const WORKSPACE_ENTRIES = new Set([
  "plugin", // the workspace link (DS-43) — the only entry whose path is resolved below
  "catalog.json", "version.json", "cheatsheet.md", "operating-model.md", "CONVENTIONS.md",
  "conventions", "scaffold", "tmp", "kb", ".keep",
  "ask-rules.json", "ask-overrides.json", "pipe-consumers.json", "active-change.json",
  "allow-rules-declined", "conventions-pack-declined", "upstream-reports", "upstream-reports-dir", "fortress-dir",
  "JOURNAL-unattributed.md",
]);
const linkPathDocs = [
  ...trackedMd.filter((f) => f.startsWith(`${SKILLS_DIR}/`) || f.startsWith("plugins/gs-superadmin/templates/")),
  ...trackedAll.filter((f) => /^plugins\/gs-superadmin\/skills\/[^/]+\/references\//.test(f) && !f.endsWith(".md")),
];
const trackedSet = new Set(trackedAll);
let linkPathTokens = 0;
for (const rel of linkPathDocs) {
  readFileSync(join(ROOT, rel), "utf8").split("\n").forEach((line, i) => {
    for (const m of line.matchAll(LINK_PATH_RE)) {
      const seg = m[1].replace(/[.,;:)]+$/, "");
      const p = (m[2] ?? "").replace(/[.,;:)]+$/, "");
      if (/[<>]/.test(seg)) continue; // `.gs-superadmin/<same…>` — prose placeholder, not an entry
      if (!WORKSPACE_ENTRIES.has(seg)) {
        fail(
          `${rel}:${i + 1}: \`.gs-superadmin/${seg}/${p}\` — \`${seg}\` is not a workspace entry this repo creates` +
            (seg === "plugins" ? " — the workspace link is `.gs-superadmin/plugin` (singular)" : "") +
            `; this path resolves to nothing live (F-398/F-408). A new entry is admitted by naming it in WORKSPACE_ENTRIES`,
        );
        continue;
      }
      if (seg !== "plugin") continue;
      if (!p || /[<>]/.test(p)) continue;
      linkPathTokens++;
      const target = `plugins/gs-superadmin/${p}`;
      const ok = p.endsWith("/") ? trackedAll.some((t) => t.startsWith(target)) : trackedSet.has(target);
      if (!ok) {
        fail(
          `${rel}:${i + 1}: \`.gs-superadmin/plugin/${p}\` names no tracked file under plugins/gs-superadmin/ (F-398) — ` +
            `live, that fence fails with MODULE_NOT_FOUND, which the operating model's link bullet misreads as a stale link; ` +
            `fix the path (or the tree), never the bullet`,
        );
      }
    }
  });
}

// ── check 11 (F-246): the guard's residual set has ONE source of record ──────
// hooks/guard-residuals.json is read by test/guard-fixtures.mjs (which derives
// the residual pins from it) and by this check (which holds the plugin README's
// user-facing copy to the same set). Before this, the set lived in three
// hand-synced copies — the hook comment, the fixture pins, and the README — of
// which only the first two were locked, so the README could go on promising a
// gap that had been closed. F-247 demonstrated it live: closing two residuals
// required editing all three by hand in one change.
//
// The README's prose stays human. What is compared is the id list in the
// `<!-- guard-residuals: … -->` anchor above the bullet, matched against the
// JSON EXACTLY and in BOTH directions, so an added, removed, or renamed
// residual fails here rather than drifting. Each id's `readmeMarker` must also
// appear in the prose, so the anchor cannot stay right while the sentence a
// user actually reads goes stale.
const residualsPath = "plugins/gs-superadmin/hooks/guard-residuals.json";
const guardResiduals = readJsonFile(join(ROOT, residualsPath)).residuals;
const anchor = /<!--\s*guard-residuals:\s*([^>]*?)\s*-->/.exec(pluginReadme);
if (!anchor) {
  console.error(
    `\ncheck 11: plugins/gs-superadmin/README.md carries no \`<!-- guard-residuals: … -->\` anchor. ` +
      `The guard's residual set is documented for users there and its ids must be machine-comparable ` +
      `against ${residualsPath} (F-246) — restore the anchor above the parsing-boundary bullet.`
  );
  process.exit(1);
}
const anchorIds = anchor[1].split(",").map((s) => s.trim()).filter(Boolean).sort();
const jsonIds = guardResiduals.map((r) => r.id).sort();
if (anchorIds.join("|") !== jsonIds.join("|")) {
  const missing = jsonIds.filter((i) => !anchorIds.includes(i));
  const extra = anchorIds.filter((i) => !jsonIds.includes(i));
  console.error(
    `\ncheck 11: the guard residual set drifted between ${residualsPath} and the plugin README anchor.` +
      (missing.length ? `\n  in the JSON but NOT in the README anchor: ${missing.join(", ")}` : "") +
      (extra.length ? `\n  in the README anchor but NOT in the JSON: ${extra.join(", ")}` : "") +
      `\nA residual added, closed, or renamed must move in BOTH — that is the whole point of F-246.`
  );
  process.exit(1);
}
// Search the RESIDUAL BLOCK, not the whole file (F-252). `pluginReadme.includes`
// was satisfied by the marker surviving ANYWHERE — a code fence, an unrelated
// aside, a changelog line — so the user-facing sentence could lose the gap
// entirely while the check stayed green, which is precisely what the error
// message below claims cannot happen. Same substring-anywhere weakness that was
// tightened in the derivation half of this check after drift mutant D5; this
// half was left untightened, so the fix landed on one instance and not its
// twin three lines away.
// The block is the anchor line plus the blockquote it sits in — lines starting
// with `>` — which is exactly the "What the guard is, and is not" callout a
// user reads. A marker re-added outside that quote no longer satisfies the check.
const readmeLines = pluginReadme.split(/\r?\n/);
const anchorLine = readmeLines.findIndex((l) => /<!--\s*guard-residuals:/.test(l));
const residualBlock = [];
for (let i = anchorLine; i < readmeLines.length; i++) {
  if (i > anchorLine && !/^\s*>/.test(readmeLines[i])) break;
  residualBlock.push(readmeLines[i]);
}
const residualBlockText = residualBlock.join("\n");
const staleMarkers = guardResiduals.filter((r) => !residualBlockText.includes(r.readmeMarker));
if (staleMarkers.length) {
  console.error(
    `\ncheck 11: ${staleMarkers.length} residual(s) whose readmeMarker no longer appears in the plugin README: ` +
      staleMarkers.map((r) => `${r.id} (expected "${r.readmeMarker}")`).join(", ") +
      `\nThe anchor ids matching is not enough — the sentence a user actually reads has to name the gap too.`
  );
  process.exit(1);
}
// The README's PIN CLAIM must match the pinned/unpinned split in the data
// (F-252). The block used to promise "`test/guard-fixtures.mjs` pins each one"
// while `nesting-depth` was deliberately unpinned — a doc-vs-tree contradiction
// inside the very block F-246 built to end doc-vs-tree contradictions, and one
// no check could catch because the readmeMarker test above only looks for each
// residual's own marker, never for what the block CLAIMS about pinning.
// Only the false direction is enforced, and deliberately so: the split wording
// stays true when every residual happens to be pinned, so requiring the stronger
// universal wording there would police style, not correctness. What is barred is
// the block claiming MORE than the data supports — and, either way, claiming
// nothing at all, since a deleted sentence is how this drifted in the first place.
const UNIVERSAL_PIN_CLAIM = "pins each one";
const SPLIT_PIN_CLAIM = "either pinned by a fixture";
const unpinnedResiduals = guardResiduals.filter((r) => !r.pinnedExample);
const hasUniversalClaim = residualBlockText.includes(UNIVERSAL_PIN_CLAIM);
const hasSplitClaim = residualBlockText.includes(SPLIT_PIN_CLAIM);
if (!hasUniversalClaim && !hasSplitClaim) {
  console.error(
    `\ncheck 11: the plugin README's residual block makes no claim about pinning at all ` +
      `(expected "${SPLIT_PIN_CLAIM}…" or "${UNIVERSAL_PIN_CLAIM}"). The sentence that tells a reader ` +
      `the list is measured rather than asserted is what keeps it honest — do not drop it.`
  );
  process.exit(1);
}
if (unpinnedResiduals.length && hasUniversalClaim) {
  console.error(
    `\ncheck 11: the plugin README's residual block claims "${UNIVERSAL_PIN_CLAIM}", but ` +
      `${unpinnedResiduals.length} residual(s) carry no fixture pin: ` +
      unpinnedResiduals.map((r) => r.id).join(", ") +
      `.\nAn unpinned residual is allowed (guard-residuals.json \`_pin_rule\` — it must state why), ` +
      `but the README must not promise a pin that does not exist. Say each one is ` +
      `"${SPLIT_PIN_CLAIM} … or carries a stated reason it is not".`
  );
  process.exit(1);
}
// The pins are only a lock if the fixtures really derive from the file. This is
// a TEXT heuristic and it is the weak half of the lock — deliberately matched on
// the quoted path as a call argument (`"guard-residuals.json")`), not on a bare
// mention, because the file's own comments name the path several times and a
// substring test therefore passed even with derivation broken (drift mutant D5,
// F-246 — the same decorative-assertion class as M60 in F-247). The LOAD-BEARING
// proof that the pins derive from the file is behavioral and lives in the
// fixture suite: mutating an entry in guard-residuals.json reds guard-fixtures
// (drift mutants D7/D8), which is impossible if the pins were hand-listed.
const guardFixtureSrc = readFileSync(join(ROOT, "plugins/gs-superadmin/test/guard-fixtures.mjs"), "utf8");
if (!/"guard-residuals\.json"\s*\)/.test(guardFixtureSrc)) {
  console.error(
    `\ncheck 11: test/guard-fixtures.mjs no longer reads guard-residuals.json, so the residual pins are ` +
      `hand-listed again and the F-246 lock is gone. Derive them from the file.`
  );
  process.exit(1);
}
// Same for the hook: its comment must POINT at the file rather than restate the
// list, or the copy this check exists to eliminate is quietly back.
if (!readFileSync(join(ROOT, "plugins/gs-superadmin/hooks/gs-admin-guard.mjs"), "utf8").includes("guard-residuals.json")) {
  console.error(
    `\ncheck 11: hooks/gs-admin-guard.mjs no longer points at guard-residuals.json for its residual list. ` +
      `The hook comment must reference the single source, not carry its own copy (F-246).`
  );
  process.exit(1);
}

// ── check 13 (F-255/F-256): bash-only command spellings where a reader pastes ──
// them. Check 10(a) bars trailing-backslash continuations inside SKILL.md fences;
// the identical class shipped unpoliced in the repo's OWN hand-written docs, where
// five of the eight instances were MUTATING commands — under PowerShell the
// backslash is a literal, so the first line runs as a complete command missing its
// value flags and the rest run as broken commands (F-256).
// Arm (b) is the sibling spelling: an inline `VAR=value command` prefix is bash
// syntax that PowerShell PARSES and then fails at RUNTIME on (F-182's correction to
// F-176), so the documented invocation silently does not happen. It reached the only
// documented way to refresh the relationships expected maps (F-255). The rule is not
// "never write the bash form" — it is that the `$env:` spelling sits beside it, which
// is what reference/mcp.md already did and what the two relationships sites now do.
//
// Scope: tracked .md outside the generated trees, minus SKILL.md (check 10 owns
// those, and its messages are guarded F-172 behavior), plus the .mjs sources under
// build/ and plugins/. dev/ is excluded deliberately — dev-branch-only working
// state, stripped at release, and its archive is a frozen record that must never be
// edited to satisfy a guard.
const CHECK13_GENERATED = /^(reference\/domains\/|wiki\/|plugins\/gs-superadmin\/reference\/|dev\/)/;
const check13Docs = trackedMd.filter((f) => !CHECK13_GENERATED.test(f) && !f.endsWith("SKILL.md"));
const check13Scripts = trackedAll.filter((f) => f.endsWith(".mjs") && !CHECK13_GENERATED.test(f));
let check13Fences = 0;
for (const f of check13Docs) {
  const lines = read(f).split(/\r?\n/);
  const ranges = fenceRanges(f, lines, "an unreadable fence hides its commands from this check exactly as it did from check 10 (F-172)");
  check13Fences += ranges.length;
  for (const [a, b] of ranges) {
    for (let i = a + 1; i < b; i++) {
      if (/\\\s*$/.test(lines[i])) {
        fail(
          `${f}:${i + 1}: fenced command ends in a backslash line continuation — bash-only syntax; ` +
            `Windows PowerShell treats it as a literal backslash and runs the first line as a COMPLETE ` +
            `command missing its remaining flags (mutating ones included). Collapse it to one line (F-256)`,
        );
      }
    }
  }
}
// The VAR name is captured so the required sibling names the SAME variable — a
// generic `$env:` mention elsewhere in the window must not satisfy a different one.
const ENV_PREFIX = /(?:^|[\s"'`(])([A-Z][A-Z0-9_]{2,})=\S*\s+(?:node|npm|npx|gs-admin)\b/;
const ENV_WINDOW_BEFORE = 2;
const ENV_WINDOW_AFTER = 6;
let check13EnvSites = 0;
for (const f of [...check13Docs, ...check13Scripts]) {
  const lines = read(f).split(/\r?\n/);
  lines.forEach((line, i) => {
    const m = ENV_PREFIX.exec(line);
    if (!m) return;
    check13EnvSites++;
    const win = lines.slice(Math.max(0, i - ENV_WINDOW_BEFORE), i + 1 + ENV_WINDOW_AFTER).join(" ");
    if (!win.includes(`$env:${m[1]}`)) {
      fail(
        `${f}:${i + 1}: documents \`${m[1]}=… <command>\` with no PowerShell spelling beside it — the inline ` +
          `prefix is bash-only and fails at runtime on the VAR=value token, so the command silently does not ` +
          `run. Add \`$env:${m[1]} = '…'; <command>\` within ${ENV_WINDOW_AFTER} lines (F-255)`,
      );
    }
  });
}

// ── check 14 (F-257, narrowed by B5 W4/DS-17): every gs-admin capture-to-file ──
// routes through the shipped capture helper (scripts/capture.mjs). A shell
// redirect's encoding depends on the shell — Windows PowerShell 5.1's `>`
// writes UTF-16 (or BOM'd UTF-8), which the later JSON.parse rejects, loudly
// in some readers and silently-degrading in the tolerant ones, which is worse.
// The check originally required each capturing skill to RESTATE that rule as
// prose within a few lines of the capture; DS-17 promoted the rule to
// construction (A-5) — the helper spawns the CLI itself and writes UTF-8
// without a BOM on every shell — so the check narrowed to what prose can no
// longer get wrong: a RAW `gs-admin … > file` capture anywhere in a skill is
// a failure outright, and the set of skills that invoke the helper is pinned
// as data (DS-20; the F-172 set-not-count rule). The original gap history
// stands: six skills captured, four stated the rule, two did not, and the gap
// survived three portability waves (deprecate's capture was an inline code
// span, not a fence — why this check reads LINES, not fences).
// ── The capture matcher: parse, don't rewrite (F-260 ×3, F-262, F-263) ───────
// `>` is overloaded five ways in these files — redirect operator, placeholder
// closer (`<id>`), Markdown blockquote marker, comparison, arrow fragment — and
// five rounds of destructive regex rewrites each moved the misclassification to
// the other side of a character-class boundary, because a character class
// cannot know whether it sits inside quotes, inside a code span, or in prose.
// Two grammars are present, so each is parsed by machinery that fits it, and
// the boundary knob the earlier rounds kept tuning no longer exists:
//   1. MARKDOWN layer (capCodeTexts): a fence line is command text whole; any
//      other line contributes only its inline `code spans`, with a leading
//      blockquote marker stripped first (structure, not shell). A line with no
//      backticks still scans whole — bare-prose captures keep the reach the old
//      line-scan had — and an unpairable backtick count scans whole too, the
//      LOUD direction. Prose apostrophes can no longer poison quote state, and
//      the blockquote case is structural rather than a lexical patch.
//   2. SHELL layer (capHasRedirect): one pass with quote state, matching what a
//      shell does — `>` and `<` inside '…' or "…" are literal, so the F-262
//      swallow shapes need no placeholder-content opinion at all. An UNQUOTED
//      `<tok>` is consumed atomically as a doc-convention placeholder — any
//      content except quotes and angles, non-space at both edges — so the
//      F-263 spellings (`<domain/id>`, `<field:value>`, `<a,b>`) are as
//      ordinary as `<id>`, with no separator list to grow. What remains
//      classifies by local context: `->` `=>` `>=` `<>` are arrows/comparisons,
//      `>&` is a stream dup, and `>`/`>>` with a following word (a placeholder
//      target included, F-260 third round) is the redirect this check exists
//      to find.
// Known residuals, each with its direction: an UNTERMINATED quote in command
// text quotes the rest of that text (as in a real shell, where such a command
// is broken — can hide a later `>`: silence, but only on a non-runnable line);
// an unquoted non-placeholder `<x` hard against a `>` reads as a placeholder
// (the doc convention's own ambiguity: silence, same broken-shell caveat);
// `>` garbage runs (`>>>`) read as captures — loud.
function capHasRedirect(t) {
  let i = 0;
  let quote = null;
  while (i < t.length) {
    const c = t[i];
    if (quote) {
      if (c === quote) quote = null;
      i++;
    } else if (c === "'" || c === '"') {
      quote = c;
      i++;
    } else if (c === "<") {
      const m = /^<[^<>"'\s][^<>"']*>/.exec(t.slice(i));
      if (m && !/\s>$/.test(m[0])) i += m[0].length;
      else i++;
    } else if (c === ">") {
      // A `>` at position 0 IS an operator (F-264): `> out.json gs-admin …` is
      // valid redirect-first shell and a real capture. The first version of
      // this lexer skipped it by accident (`"-=<!".includes("")` is true),
      // which doubled as an undocumented, unprovable blockquote guard — that
      // job belongs to capCodeTexts' structural strip, which this rule makes
      // load-bearing and mutation-distinguishable.
      const operatorPrev = i > 0 && "-=<!".includes(t[i - 1]);
      let j = i + 1;
      if (t[j] === ">") j++;
      if (!operatorPrev) {
        while (t[j] === " " || t[j] === "\t") j++;
        const target = t[j];
        if (target && target !== "=" && !"|&;>".includes(target)) return true;
      }
      i = j;
    } else {
      i++;
    }
  }
  return false;
}
function capCodeTexts(line, inFence) {
  if (inFence) return [line];
  // The blockquote strip is LOAD-BEARING for the no-backtick fallback path
  // (F-264): without it, a blockquote prose line mentioning gs-admin scans its
  // own marker as a redirect-first operator. It cannot be replaced by a lexer
  // rule — position-0 `>` is a real operator in command text (see
  // capHasRedirect) — which is exactly the structural/lexical division this
  // design exists to keep.
  const stripped = line.replace(/^\s*>+\s?/, "");
  if (!stripped.includes("`")) return [stripped];
  const seg = stripped.split("`");
  if (seg.length % 2 === 0) return [stripped]; // unpaired backtick: whole line, loud
  return seg.filter((_, k) => k % 2 === 1);
}
const CAPTURE_LINE = (line, inFence) =>
  capCodeTexts(line, inFence).some((t) => t.includes("gs-admin") && capHasRedirect(t));

// Self-test for the matcher, run before it is used on the tree (F-260). Every
// row is a case one of the rounds paid for — the table is the acceptance suite
// that carried the rewrite-era behaviour into the parsing design — plus the
// rows only a stateful parse can get right (prose apostrophe, quoted
// comparison). Rows fail the run outright rather than through fail(), so a
// broken matcher cannot report itself as a passing check. Each row carries the
// fence flag the real caller would pass for a line of that shape.
for (const [line, inFence, shouldMatch, why] of [
  // command-text shapes (fence lines in the tree)
  ["gs-admin --json re r list > .gs-superadmin/tmp/x.json", true, true, "path target"],
  ["gs-admin --json re r list > rules.json", true, true, "bare filename (F-260)"],
  ["gs-admin --json re r list >rules.json", true, true, "no space before target (F-260)"],
  ["gs-admin --json re r list>rules.json", true, true, "no space around the operator (F-260)"],
  ["gs-admin --json re r list >> .gs-superadmin/tmp/x.json", true, true, "append"],
  ["gs-admin --json re r list > <out-file>", true, true, "placeholder as redirect target (F-260, third round)"],
  ["gs-admin --json sc list > 'out dir/scorecards.json'", true, true, "quoted redirect target"],
  ["gs-admin --json re r list | jq 'select(.n < 5)' > cr-deps.json", true, true, "quoted comparison before a real redirect (F-262)"],
  ["gs-admin --json re r list --filter '<a' > cr-deps.json", true, true, "unbalanced quoted < before a real redirect (F-262)"],
  ["gs-admin --json re r describe --id <id> --format json", true, false, "placeholder mid-line"],
  ["gs-admin --json dm deps check --id <domain/id> --areas ALL", true, false, "slash placeholder (F-263)"],
  ["gs-admin --json re r list --filter <field:value> --cols <a,b>", true, false, "colon and comma placeholders (F-263)"],
  ["gs-admin --json re r list --search 'a > b' --limit 5", true, false, "quoted > is content, not a redirect (the rewrite era's stated residual, closed by quote state)"],
  ["gs-admin --json re r list --name <it's> --limit 5", true, false, "quote inside a placeholder falls to quote state, not a capture"],
  ["> out.json gs-admin --json re r list", true, true, "redirect-first shell (F-264: a position-0 > is an operator, not an accident)"],
  // markdown-layer shapes (prose lines in the tree)
  ["- Rules: `gs-admin re r edit --id <id> --new-name '<proposed>'`", false, false, "two placeholders in a code span"],
  ["2. `gs-admin re r edit --id <id> --new-name 'D.MM.DD.YYYY <old name>'`", false, false, "spaced placeholder (F-262 trap row)"],
  ["> Add `Bash(gs-admin:*)` to this workspace's permissions.allow", false, false, "blockquote marker is structure, not shell"],
  ["> gs-admin --json re r list writes nothing here", false, false, "blockquote before bare prose (F-264: only the structural strip excludes this)"],
  ["node script.mjs --command \"gs-admin --json jo p describe --id {id}\" --out-dir <slug>/journey", false, false, "double-quoted command, placeholder as last token"],
  ["Then it's captured: `gs-admin --json re r list > f.json`", false, true, "prose apostrophe must not poison the span's quote state"],
  ["gs-admin --json re r list > rules.json", false, true, "bare-prose capture keeps the old line-scan reach"],
]) {
  if (CAPTURE_LINE(line, inFence) !== shouldMatch) {
    console.error(
      `\ncheck 14 self-test: CAPTURE_LINE ${shouldMatch ? "missed" : "falsely matched"} the ${why} case ` +
        `— the capture matcher is wrong, so check 14's verdicts and its line citations cannot be trusted (F-260).\n  ${line}`,
    );
    process.exit(1);
  }
}
// Pin the SET, not a count (F-172): a count survives a same-commit swap and its
// message reads as "adjust the number". Update deliberately when a skill genuinely
// gains or loses a capture. This is the check's site list, carried as data
// (DS-20) — the skills whose captures route through the helper.
const CAPTURE_HELPER_SKILLS = new Set([
  "audit", "change-request", "deprecate", "deps-report", "email-report", "refresh", "setup",
]);
// A helper invocation is recognized by its INVOCATION GRAMMAR, not by the
// script's name alone (review round, B5 W4: a bare `capture.mjs` substring
// was satisfied by a `--normalize` remediation span — so a skill could lose
// its actual captures and stay green). A routed CAPTURE carries all four
// fixed elements of the shape the skills fence:
//   capture.mjs … --out … `--` separator … gs-admin
// A `--normalize <file>` span has neither --out nor gs-admin and does not
// count. And the routing PROOF must come from real code text — a fence line
// or a backticked code span — never capCodeTexts' whole-line prose fallback
// (release-gate round): that fallback is deliberately fail-SAFE for the ban
// prong above (over-matching a prose redirect is a loud false red), but
// fail-DANGEROUS here, where an unbacktick'd prose sentence carrying the
// four elements would keep certifying a skill whose real captures are gone.
// Prose contributes nothing to routing; an unpaired backtick likewise yields
// no code text, which can only make routing UNSEEN (a loud red), never
// falsely seen.
const helperCodeTexts = (line, inFence) => {
  if (inFence) return [line];
  const seg = line.replace(/^\s*>+\s?/, "").split("`");
  if (seg.length < 3 || seg.length % 2 === 0) return [];
  return seg.filter((_, k) => k % 2 === 1);
};
const HELPER_LINE = (line, inFence) =>
  helperCodeTexts(line, inFence).some(
    (t) =>
      t.includes("capture.mjs") && t.includes("--out") &&
      /(^|\s)--(\s|$)/.test(t) && t.includes("gs-admin"),
  );
const helperSkillsSeen = new Set();
// Paginate fences that must STATE their rows path (gate-3 F-351 round 4): the
// capture helper never guesses between candidate arrays, so a command whose
// envelope carries a second array beside the rows — empty on a quiet tenant,
// filled on one with something to report — needs `--items-path` on every
// shipped fence that sweeps it, or the sweep stops the day the block fills
// (the audit reports sweep, on the first tenant with an alert). This map is
// the data the rule points at; VALIDATION.md's census records the envelopes
// that belong here. Key = the command's tokens after `gs-admin --json`.
const PAGINATE_STATED_PATHS = { "rp list": "data.data" };
for (const name of skills) {
  // The skill's capture surface is its whole CONTENT: SKILL.md plus its
  // references/ files (DS-32 moved executable mechanics into references, and
  // a raw redirect written there reopens the F-257 class just as surely; a
  // helper invocation there is likewise real routing, so a skill whose last
  // SKILL.md capture migrates into a reference does not false-red the set).
  const skillFiles = [`${SKILLS_DIR}/${name}/SKILL.md`, ...skillReferenceFiles(name).filter((f) => f.endsWith(".md"))];
  let helperSeen = false;
  for (const rel of skillFiles) {
    const lines = read(rel).split(/\r?\n/);
    // Fence membership feeds the markdown layer; a file whose fences the
    // grammar refuses is already red via check 10 (SKILL.md) or check 13
    // (references), and the grammar-valid ranges stay scannable either way.
    const { ranges } = scanFenceMarkers(lines);
    const inFence = (i) => ranges.some(([a, b]) => i > a && i < b);
    const caps = lines.map((l, i) => (CAPTURE_LINE(l, inFence(i)) ? i + 1 : 0)).filter(Boolean);
    if (caps.length) {
      fail(
        `${rel}: captures gs-admin output with a raw shell redirect (line(s) ${caps.join(", ")}) — what \`>\` ` +
          `writes there depends on the shell (Windows PowerShell 5.1: UTF-16/BOM the later JSON.parse rejects). ` +
          `Route the capture through the shipped helper instead: ` +
          `node .gs-superadmin/plugin/scripts/capture.mjs --out <file> -- gs-admin <args…> ` +
          `— it writes UTF-8 without a BOM on every shell (F-257, DS-17)`,
      );
    }
    if (lines.some((l, i) => HELPER_LINE(l, inFence(i)))) helperSeen = true;
    lines.forEach((l, i) => {
      for (const t of helperCodeTexts(l, inFence(i))) {
        if (!t.includes("capture.mjs") || !t.includes("--paginate")) continue;
        const cmd = t.split(/\s--\s/)[1] ?? "";
        for (const [needle, path] of Object.entries(PAGINATE_STATED_PATHS)) {
          if (new RegExp("(^|\\s)" + needle.replace(/ /g, "\\s+") + "(\\s|$)").test(cmd) && !t.includes(`--items-path ${path}`)) {
            fail(
              `${rel}:${i + 1}: paginate fence over \`${needle}\` does not state its rows path — the envelope carries a ` +
                `second array beside the rows that fills on a tenant with something to report, and the helper never guesses; ` +
                `add --items-path ${path} (F-351)`,
            );
          }
        }
      }
    });
  }
  if (helperSeen) helperSkillsSeen.add(name);
}
for (const name of CAPTURE_HELPER_SKILLS) {
  if (!helperSkillsSeen.has(name)) {
    fail(
      `${SKILLS_DIR}/${name}/SKILL.md: no longer invokes the capture helper (scripts/capture.mjs), but is ` +
        `still listed in CAPTURE_HELPER_SKILLS — drop it from the set deliberately, so the list stays a ` +
        `statement about the tree rather than a stale hope (F-257)`,
    );
  }
}
for (const name of helperSkillsSeen) {
  if (!CAPTURE_HELPER_SKILLS.has(name)) {
    fail(
      `${SKILLS_DIR}/${name}/SKILL.md: gained a capture-helper invocation but is not in ` +
        `CAPTURE_HELPER_SKILLS — add it there deliberately, so the capture surface stays an enumerated ` +
        `statement about the tree (F-257)`,
    );
  }
}

// ── check 15 (F-290): the journal-kind prose nickname is never taught unpaired ──
// The T-4 v4 amendment exists because prose taught "plan-completion" as if it
// were the record's label; the emitter literal is read FROM the writer
// (scripts/journal.mjs's composeJournalEntry call), never hardcoded, so a
// future kind-literal change re-trips this check instead of silently reopening
// the gap. Pairing is per-OCCURRENCE with a proximity window — the finding
// prescribed file-level "contains both somewhere", but that passes the
// motivating case (journal.mjs held the literal 240 lines below a header
// teaching the nickname) and makes its own mutation proof ("red on that site
// alone") unsatisfiable, so the window is the load-bearing part. CHANGELOG.md
// is the single declared exemption (append-only history, the bus-archive
// standing). The nickname needle is assembled so a future scope widening can
// never make this file match itself.
const KIND_NICKNAME = "plan-" + "completion";
const KIND_EXEMPT = new Set(["plugins/gs-superadmin/CHANGELOG.md"]);
const KIND_WINDOW = 2; // lines either side of a nickname occurrence
let kindSites = 0;
{
  const journalSrc = read("plugins/gs-superadmin/scripts/journal.mjs");
  const m = /composeJournalEntry\(\{[\s\S]*?\bkind:\s*"([^"\n]+)"/.exec(journalSrc);
  if (!m) {
    fail(
      "check 15: cannot read the kind literal out of scripts/journal.mjs's composeJournalEntry call — " +
        "the check's source of record moved; repoint the extraction rather than hardcoding the literal (F-290)",
    );
  } else if (m[1].includes(KIND_NICKNAME)) {
    fail(
      `check 15: the kind literal read from scripts/journal.mjs ("${m[1]}") itself contains the prose ` +
        `nickname — the pairing rule would be satisfied vacuously everywhere (F-290)`,
    );
  } else {
    const kindLiteral = m[1];
    for (const f of trackedAll) {
      if (!f.startsWith("plugins/gs-superadmin/") || KIND_EXEMPT.has(f)) continue;
      // readTextOrNull, not a catch-continue (F-294): utf8 decode never
      // throws on binary — the old catch here was the F-201 dead-skip class
      // this file already documents at check 8. Genuine binaries (invalid
      // UTF-8) skip; text files always scan.
      const text15 = readTextOrNull(f);
      if (text15 === null) continue; // unreadable or genuine binary — cannot carry teachable prose
      const lines = text15.split(/\r?\n/);
      lines.forEach((line, i) => {
        if (!line.includes(KIND_NICKNAME)) return;
        kindSites++;
        const win = lines.slice(Math.max(0, i - KIND_WINDOW), i + 1 + KIND_WINDOW).join("\n");
        if (!win.includes(kindLiteral)) {
          fail(
            `${f}:${i + 1}: names the journal record by the prose nickname "${KIND_NICKNAME}" with no ` +
              `emitter literal ("${kindLiteral}") within ${KIND_WINDOW} lines — the nickname must never be ` +
              `readable as the label; that is the exact input that produced the T-4 v4 defect (F-290)`,
          );
        }
      });
    }
  }
}

// ── check 16 (GP-B5 DS-31, bus F-312): the token pre-flight family has ONE ──
// canon. The F-221 pre-flight (usable token life is far less than `whoami`
// prints — the CLI's half-life defect) shipped as TWO full hand-synced copies
// (setup + refresh) whose wording had already diverged, while the other two
// long-batch skills (email-report, deps-report) carried no pre-flight at all —
// the fix-one-copy-miss-the-sibling class (A-1) in prose form. C1's
// paraphrase-plus-pointer rule (AGENTS.md "Writing skills") is the cure:
// exactly one site carries the canonical statement, every other site a
// one-line paraphrase plus a pointer to the canon — never a full second copy
// (it drifts), never a bare pointer (context-blind). This check promotes the
// family to the checking tier (A-5) with the site list carried as data
// (contracts-as-data, check 14 / DS-20 precedent; the F-172 set-not-count
// rule):
//   (a) the canon skill carries the family headline AND the canon-only
//       formula fragment;
//   (b) every paraphrase skill carries the headline AND the pointer to the
//       canon, and does NOT carry the formula fragment — a full copy grown
//       back at a paraphrase site is the drift this check exists to end;
//   (c) both set directions: a listed skill that lost its pre-flight, and ANY
//       skill mentioning the pre-flight that is not in the family, each fail
//       — the family stays an enumerated statement about the tree.
// Markers are matched against whitespace-folded text (prose reflows freely;
// a marker must not stop matching because a sentence re-wrapped — parse the
// structure, don't tune the pattern, A-9).
// Family membership is RATIFIED SCOPING, not measured coverage (F-322): the
// four members are the skills whose batches run tens of minutes to hundreds
// of back-to-back calls (F-312 round); capture-helper use alone is not a
// long-batch proxy (audit's sweep is bounded and its deep mode prefers KB
// docs — deliberately outside, and the F-313..315 tester round used audit as
// the legitimate-outsider mutant). A new long-batch skill joins the family
// by being ADDED here — this check can hold the family honest, it cannot
// detect a skill that needs a pre-flight and lacks one.
const TOKEN_PREFLIGHT = {
  canonSkill: "setup",
  headline: "Token pre-flight (F-221",
  canonOnly: "remaining − 1800s", // the formula — canon-only by rule (b)
  pointer: "rule canon: setup Phase 1",
  paraphraseSkills: ["refresh", "email-report", "deps-report"],
};
let preflightSites = 0;
{
  const wsFold = (s) => s.replace(/\s+/g, " ");
  const family = new Set([TOKEN_PREFLIGHT.canonSkill, ...TOKEN_PREFLIGHT.paraphraseSkills]);
  // Family members must exist in the tree (check 14's CAPTURE_HELPER_SKILLS
  // direction, B7 review round): a skill removed or renamed while its family
  // entry survives would silently shrink the enforced surface while the pass
  // line still claims the full family.
  for (const name of family) {
    if (!skills.includes(name)) {
      fail(
        `check 16: TOKEN_PREFLIGHT names the skill "${name}", which does not exist under ${SKILLS_DIR} — ` +
          `drop it from the family deliberately, so the list stays a statement about the tree (DS-31, F-312)`,
      );
    }
  }
  for (const name of skills) {
    const rel = `${SKILLS_DIR}/${name}/SKILL.md`;
    const text = wsFold(read(rel));
    const mentions = /token pre-?flight/i.test(text);
    if (!family.has(name)) {
      if (mentions) {
        fail(
          `${rel}: mentions a token pre-flight but is not in check 16's TOKEN_PREFLIGHT family — a fifth ` +
            `site is a new copy to keep honest: add it as a paraphrase site deliberately (with the pointer ` +
            `to the canon), so the family stays an enumerated statement about the tree (DS-31, F-312)`,
        );
      }
      continue;
    }
    preflightSites++;
    if (!text.includes(TOKEN_PREFLIGHT.headline)) {
      fail(
        `${rel}: lost its "${TOKEN_PREFLIGHT.headline})" pre-flight — every TOKEN_PREFLIGHT family skill ` +
          `carries the family headline (canon or paraphrase); losing it silently ` +
          `reopens the mid-batch token-death class F-221 closed (DS-31, F-312, F-322)`,
      );
      continue;
    }
    if (name === TOKEN_PREFLIGHT.canonSkill) {
      if (!text.includes(TOKEN_PREFLIGHT.canonOnly)) {
        fail(
          `${rel}: the canon site no longer states the usable-life formula ("… ${TOKEN_PREFLIGHT.canonOnly}") — ` +
            `the canon must carry the full statement the paraphrase sites point at (DS-31, F-312)`,
        );
      }
    } else {
      if (!text.includes(TOKEN_PREFLIGHT.pointer)) {
        fail(
          `${rel}: paraphrase site has no pointer to the canon ("${TOKEN_PREFLIGHT.pointer}") — a paraphrase ` +
            `without its pointer is a free-floating copy that drifts exactly like the pre-DS-31 pair did ` +
            `(DS-31, F-312)`,
        );
      }
      if (text.includes(TOKEN_PREFLIGHT.canonOnly)) {
        fail(
          `${rel}: paraphrase site restates the canon-only formula ("… ${TOKEN_PREFLIGHT.canonOnly}") — that ` +
            `is a full second copy growing back; state the judgment in one line and point at the canon ` +
            `(rule: one canon per rule — GP-B5 C1; DS-31, F-312)`,
        );
      }
    }
  }
}

// --- 17. The dev-only strip removes nothing the type gate reads (W8.5 review) ----------
// docs-drift.yml runs `npm run typecheck` on its full arm only, on the claim that the
// release strip (dev/ + the dev-canary skill — the same two paths the workflow's
// `git rm` names) removes no file the base config's `**/*.mjs` include reaches, so
// the stripped arm's verdict would be identical. The claim lived in the YAML as a
// hand count (65, while the tree held 67); this is the claim itself, as data.
const DEV_ONLY_STRIP_PATHS = ["dev/", `${SKILLS_DIR}/dev-canary/`];
const strippedMjs = trackedAll.filter((f) => f.endsWith(".mjs") && DEV_ONLY_STRIP_PATHS.some((p) => f.startsWith(p)));
for (const f of strippedMjs) {
  fail(
    `${f}: a .mjs under a dev-only strip path — the type gate runs on docs-drift.yml's full arm only ` +
      `because the strip removes nothing tsc reads; this file makes the stripped tree a different program ` +
      `(move it out of ${DEV_ONLY_STRIP_PATHS.join(" / ")}, or run the gate on both arms)`,
  );
}

// --- 18. Shipped plugin content never points at a dev-only strip path (W9 review) ----
// The release strip removes dev/ and the dev-canary skill from the tree a user
// installs, so a shipped script's error text, a skill reference, or a shipped
// comment naming `dev/VALIDATION.md` (or any dev/ file, or the canary skill)
// is a dangling pointer exactly where and when it is read. Check 17 asks
// whether a file LIVES under a strip path; this asks whether a shipped file
// MENTIONS one. Scope = every tracked file under the plugin dir except the
// canary skill itself (stripped with the paths it names). The needle is the
// strip paths' own spellings: `dev/` followed by a capitalised file name (the
// dev dir's files — never `/dev/null`) and the canary skill's directory.
const SHIPPED_STRIP_REF = /\bdev\/[A-Z][A-Za-z-]*\.md\b|\bskills\/dev-canary\b/;
const shippedFiles = trackedAll.filter((f) => f.startsWith("plugins/gs-superadmin/") && !f.startsWith(`${SKILLS_DIR}/dev-canary/`));
let strippedRefsChecked = 0;
for (const f of shippedFiles) {
  if (!/\.(mjs|md|json|txt)$/.test(f)) continue;
  strippedRefsChecked++;
  const lines = read(f).split("\n");
  lines.forEach((line, i) => {
    const m = SHIPPED_STRIP_REF.exec(line);
    if (m)
      fail(
        `${f}:${i + 1}: shipped plugin content names a dev-only strip path (${m[0]}) — dev/ and the dev-canary skill are ` +
          `removed on the release branch, so a user of the installed plugin cannot follow it; point at a shipped home ` +
          `(MAINTAINERS.md, a skill reference) and keep the dev-branch material as its own note`,
      );
  });
}

// --- 19. The defect-class registry: every mechanical row swept, allowances live, ---
// --- manual keys cross-checked with AGENTS.md (GP-B5 W10 / B14) -----------------------
// build/defect-classes.mjs is the registry AS DATA: each MECHANICAL row is a
// pattern with zero false positives (a self-toggle, a % 2 pairing, a fence
// grammar spelling, a stdout write before process.exit, a hand-spelled atomic
// write, a hardcoded script-name prefix, a provenance literal) plus an
// ALLOWANCE map of sanctioned files with reasons. Both directions, like a
// survivor ledger (F-327): an unsanctioned hit reds naming file:line and the
// class; a sanctioned file that no longer carries the shape reds so the
// allowance cannot rot into a blind spot. MANUAL classes (no pattern) are
// registered by KEY here and carry their recipe as a `Class: <key>` bullet in
// AGENTS.md § Review-gate rules — cross-checked both ways so a key cannot
// exist in one home without the other (the check-5/check-12 shape). The class
// LIST is human input and this check never claims it complete (F-339): a new
// class arrives as a finding and gets a row or a bullet.
const sweep19 = sweepDefectClasses(trackedAll, (f) => {
  try {
    return readFileSync(join(ROOT, f), "utf8");
  } catch {
    return null; // reported by name below — never a hit, never a stale allowance (F-201)
  }
});
for (const f of sweep19.unreadable) {
  fail(`${f}: tracked and in scope for check 19 but could not be read — not swept (a lock, a dangling link, a race with checkout); re-run, never edit an allowance for it`);
}
// Coverage floor per scope (the F-095/F-101 signature, the assertScanCoverage
// shape): a scope predicate matching zero tracked files is a broken
// enumeration or a moved tree, never a clean sweep.
for (const [name, n] of Object.entries(sweep19.scopeCounts)) {
  if (n === 0) fail(`check 19 coverage: scope "${name}" matched 0 tracked files — the registry's scope predicates no longer see the tree (moved directory? renamed lane?); fix SCOPES in build/defect-classes.mjs, never delete the floor`);
}
for (const h of sweep19.hits) {
  fail(
    `${h.file}:${h.line}: ${h.why} — defect class "${h.key}" (${h.origin}): ${h.what}. Fix at the mechanism, ` +
      `or sanction this file in the row's allowance WITH the reason (build/defect-classes.mjs) — never by ` +
      `widening the pattern`,
  );
}
for (const s of sweep19.stale) {
  fail(
    `${s.file}: sanctioned in defect class "${s.key}"'s allowance but carries no instance of it any more — remove ` +
      `the allowance row (a stale allowance is where the next copy hides; the F-327 both-directions rule)`,
  );
}
const agentsClassKeys = classKeysIn(agents);
for (const m of MANUAL_CLASSES) {
  if (!agentsClassKeys.has(m.key)) {
    fail(
      `AGENTS.md: manual defect class "${m.key}" (build/defect-classes.mjs MANUAL_CLASSES) has no \`Class: ${m.key}\` ` +
        `bullet under § Review-gate rules — the recipe lives where review enforces it, the key where the checks ` +
        `read it; both or neither`,
    );
  }
}
for (const k of agentsClassKeys) {
  if (!REGISTERED_CLASS_KEYS.has(k)) {
    fail(
      `AGENTS.md: names \`Class: ${k}\` but no such defect class is registered in build/defect-classes.mjs — ` +
        `register it (a mechanical row or a MANUAL_CLASSES entry) or fix the spelling`,
    );
  }
}

// Self-check (F-258): the gate below is only a gate for the fail() calls ABOVE it,
// and a comment saying "add checks above this line" is exactly the kind of claim
// that rots. This reads this file's own source and refuses to pass if any fail()
// CALL sits below the gate — the regression that let two freshly added checks
// report their findings and exit 0. It runs before the gate and exits on its own,
// so a violation cannot be masked by the thing it is checking.
// Both needles are ASSEMBLED, never written whole (the check-instance-data
// convention): spelled literally, this block's own source would satisfy the search
// it performs — deleting the gate outright still exited 1, but the diagnosis named
// stray calls that were only the words inside these very messages.
{
  const selfSrc = readFileSync(fileURLToPath(import.meta.url), "utf8");
  const GATE_NEEDLE = "if (fail" + "ures) {";
  const CALL_RE = new RegExp("(?:^|[\\s;{}(])" + "fail" + "\\(", "gm");
  const gateAt = selfSrc.lastIndexOf(GATE_NEEDLE);
  const stray = [...selfSrc.matchAll(CALL_RE)].map((m) => m.index).filter((i) => i > gateAt);
  if (gateAt === -1 || stray.length) {
    const line = (i) => selfSrc.slice(0, i).split("\n").length;
    console.error(
      gateAt === -1
        ? `\ncheck-doc-drift self-check: the failure gate is gone from this file — every check in it now ` +
            `reports its findings and the run exits 0 anyway (F-258).`
        : `\ncheck-doc-drift self-check: ${stray.length} failure-raising call(s) sit BELOW the gate at line ` +
            `${line(gateAt)} (line(s) ${stray.map(line).join(", ")}) — those checks print their findings and ` +
            `the run still exits 0, which is how a guard goes quietly decorative (F-258). Move them above it.`,
    );
    process.exit(1);
  }
}

// ── check 20 (F-388 round 2 → F-392 reopen): the refresh migration note quotes what upsert-batch PRINTS ──
// Round 1 of F-388 wrote a migration note claiming failures the script did not
// produce; round 2 made the script fail and had this check hold the note's two
// copy-outs by their HEAD literals; the Gate-2 fix round then reworded the
// date failure and left the copy-out unchanged — and the head check stayed
// green, because a fabricated clause between two intact heads is invisible to a
// head-presence gate (the tester's M5). So the check now EXECUTES the writer:
// it builds a scratch manifest (a connectors domain indexed by the nested
// CLI-1.0.8 paths), feeds it flat CLI-1.0.9 rows the two ways the note
// describes, captures the real stderr of both failures, and holds every
// 4-space-indented "manifest.mjs: …" copy-out line in the note to one of them
// SEGMENT-WISE — split on the note's elision mark (…), each segment must appear
// in order in the real message — with each copy-out seated on its own failure
// and both failures quoted. The only placeholder the note may use is `N` in
// "N row(s)" (the fixture's row count is substituted). A paraphrase, a stale
// clause, or a missing copy-out reds by line. House rule 13 as a gate: prose
// about a script's behaviour is authored from executed output, and stays held
// to it.
const UPSERT_QUOTE_SKILL = "plugins/gs-superadmin/skills/refresh/SKILL.md";
const UPSERT_QUOTE_ROWS = 2;
let upsertCopyOutsHeld = 0;
{
  const script = join(ROOT, "plugins", "gs-superadmin", "scripts", "manifest.mjs");
  const scratch = mkdtempSync(join(tmpdir(), "gs-check20-"));
  try {
    const M = join(scratch, "acme-prod", "_manifest.json");
    const runM = (args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
    const row = (n) => ({ connectionId: `conn-${n}`, connectionName: `Acme ${n}`, connectionType: "S3" });
    const nested = join(scratch, "nested.json");
    const flat = join(scratch, "flat.json");
    const ns = [...Array(UPSERT_QUOTE_ROWS).keys()].map((i) => i + 1);
    writeFileSync(nested, JSON.stringify({ data: ns.map((n) => ({ pnpConnectionsInfo: { ...row(n), modifiedDateStr: `2026-01-0${n}T00:00:00Z` } })) }));
    writeFileSync(flat, JSON.stringify({ data: ns.map(row) }));
    const setup = [
      runM(["init", "--manifest", M, "--slug", "acme-prod", "--base-url", "https://acme.example"]),
      runM(["upsert-batch", "--manifest", M, "--file", nested, "--domain", "connectors", "--items-path", "data", "--id-field", "pnpConnectionsInfo.connectionId", "--name-field", "pnpConnectionsInfo.connectionName", "--date-field", "pnpConnectionsInfo.modifiedDateStr"]),
    ];
    // the two failures the note describes, in the order an operator meets them
    const failures = [
      runM(["upsert-batch", "--manifest", M, "--file", flat, "--domain", "connectors", "--items-path", "data", "--id-field", "pnpConnectionsInfo.connectionId", "--name-field", "pnpConnectionsInfo.connectionName"]),
      runM(["upsert-batch", "--manifest", M, "--file", flat, "--domain", "connectors", "--items-path", "data", "--id-field", "connectionId", "--name-field", "connectionName", "--allow-rekey", "--orphans-file", join(scratch, "orphans.json")]),
    ];
    if (setup.some((r) => r.status !== 0) || failures.some((r) => r.status !== 1 || !r.stderr.startsWith("manifest.mjs: "))) {
      fail(
        `check 20: could not execute upsert-batch's two migration failures on the scratch manifest (setup exits ${setup.map((r) => r.status).join("/")}, ` +
          `failure exits ${failures.map((r) => r.status).join("/")}) — the check's source of record is the writer's own stderr; repair the fixture run, never the skill (F-392)`,
      );
    } else {
      const messages = failures.map((r) => r.stderr.replace(/\r?\n$/, ""));
      const copyOuts = read(UPSERT_QUOTE_SKILL)
        .split(/\r?\n/)
        .map((line, i) => ({ line, lineNo: i + 1 }))
        .filter(({ line }) => /^ {4}manifest\.mjs: /.test(line));
      /** @type {Set<number>} */
      const taken = new Set();
      for (const { line, lineNo } of copyOuts) {
        const body = line.replace(/^ {4}/, "").split(" N row(s)").join(` ${UPSERT_QUOTE_ROWS} row(s)`);
        const segments = body.split("…").map((s) => s.trim()).filter(Boolean);
        const quotes = (m) => {
          let pos = 0;
          for (const seg of segments) {
            const at = m.indexOf(seg, pos);
            if (at < 0) return false;
            pos = at + seg.length;
          }
          return true;
        };
        const seat = messages.findIndex((m, i) => !taken.has(i) && quotes(m));
        if (seat < 0) {
          const closest = messages.map((m) => { let pos = 0, n = 0; for (const seg of segments) { const at = m.indexOf(seg, pos); if (at < 0) break; pos = at + seg.length; n++; } return n; });
          fail(
            `${UPSERT_QUOTE_SKILL}:${lineNo}: this copy-out is not a segment-wise quotation of any failure upsert-batch actually prints ` +
              `(${segments.length} segment(s); the closest real message matches ${Math.max(...closest)} in order) — the migration note quotes the ` +
              `writer's own stderr, with … marking every elision and N standing for the row count; re-quote it from a real run (F-392)`,
          );
        } else {
          taken.add(seat);
          upsertCopyOutsHeld++;
        }
      }
      if (taken.size < messages.length) {
        fail(
          `${UPSERT_QUOTE_SKILL}: the migration note quotes ${taken.size} of upsert-batch's ${messages.length} migration failures — both the ` +
            `stale-id-path failure and the absent-date-key failure must be quoted, each by its own copy-out line (F-392/F-393)`,
        );
      }
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

// ── check 21 (F-407, Gate 2 for 0.36.2): the documented build pipeline IS package.json's ──
// Three hand-maintained files and the drift workflow enumerate `npm run build`'s
// chain and its individual `build:*` steps; all of them went stale, unnoticed,
// when emit-reader-shapes joined the chain — the doc-vs-tree class the review-gate
// rule says prose alone never closes. The script is the fact; the sites are data.
const pkgScripts = readJsonFile(join(ROOT, "package.json")).scripts ?? {};
const buildChain = [...String(pkgScripts.build ?? "").matchAll(/node build\/([a-z-]+)\.mjs/g)].map((m) => m[1]);
const buildSteps = Object.keys(pkgScripts).filter((k) => k.startsWith("build:"));
const derivedChain = buildChain.filter((n) => n !== "extract-catalog");
if (buildChain.length < 2 || buildSteps.length < 2) fail("check 21: package.json's build script or its build:* steps could not be read");
const BUILD_CHAIN_SITES = [
  // arrow-chain: the comment after `npm run build`, continued over `#` lines, split on →
  { file: "CLAUDE.md", kind: "arrow-chain", label: "the Regenerating fence's `npm run build   #` comment" },
  { file: "README.md", kind: "arrow-chain", label: "the upgrade fence's `npm run build` comment" },
  // derived-list: the generators CI's drift job runs (everything but the extractor), in order
  { file: "AGENTS.md", kind: "derived-list", label: "the verification fence's derived-generators sentence", from: "derived generators CI's drift job runs", to: "```" },
  { file: ".github/workflows/docs-drift.yml", kind: "derived-list", label: "the Regenerate step", from: "Regenerate everything derived from the committed catalog", to: "- name:" },
  // steps: every `build:*` script name appears in the file
  { file: "CLAUDE.md", kind: "steps", label: "the individual-steps line" },
  { file: "README.md", kind: "steps", label: "the 'Steps can be run individually' sentence" },
];
let buildChainSites = 0;
for (const site of BUILD_CHAIN_SITES) {
  const text = readFileSync(join(ROOT, site.file), "utf8");
  if (site.kind === "arrow-chain") {
    // the FIRST `npm run build` comment that draws the chain with → (README also
    // comments the rebuild fence in prose, without a chain)
    const m = [...text.matchAll(/npm run build\s+#\s*([^\n]*(?:\n[ \t]*#[^\n]*)*)/g)].find((x) => x[1].includes("→"));
    const names = m ? m[1].split("→").map((t) => t.replace(/#/g, "").trim()).filter(Boolean) : [];
    if (JSON.stringify(names) !== JSON.stringify(buildChain)) {
      fail(`check 21: ${site.file} — ${site.label} lists [${names.join(" → ")}] but package.json's build runs [${buildChain.join(" → ")}] (F-407)`);
      continue;
    }
  } else if (site.kind === "derived-list") {
    const i = text.indexOf(site.from);
    const j = i === -1 ? -1 : text.indexOf(site.to, i + site.from.length);
    const region = i === -1 || j === -1 ? "" : text.slice(i, j);
    const names = [...region.matchAll(/\b(extract-catalog|build-[a-z-]+|emit-[a-z-]+)\b/g)].map((m) => m[1]).filter((n, k, a) => a.indexOf(n) === k);
    if (!region || JSON.stringify(names) !== JSON.stringify(derivedChain)) {
      fail(`check 21: ${site.file} — ${site.label} names [${names.join(", ")}] but package.json's build derives [${derivedChain.join(", ")}] after the extractor (F-407)`);
      continue;
    }
  } else {
    const missing = buildSteps.filter((k) => !text.includes(k));
    if (missing.length) {
      fail(`check 21: ${site.file} — ${site.label} never names ${missing.map((k) => `\`npm run ${k}\``).join(", ")} (F-407)`);
      continue;
    }
  }
  buildChainSites++;
}

// ── check 22 (F-429, fourth pass): no runnable line in a skill or template names ──
// a default domain FOLDER where the workspace's recording decides the name.
// Three hand sweeps each missed one shape (a lookup, then a --domain, then an
// --out-dir), because the vocabulary lived in five scripts and the sweep was a
// grep. The vocabulary is doc-lib's RECORDED_LANES — read out of its source text
// here, the way check 15 reads journal.mjs's kind literal (the build lane may
// not import the plugin) — and the criterion is the tester's: a RUNNABLE line
// (a fence line, or an inline code span that is a command) naming a folder as a
// --domain value, an --out-dir segment, or a <slug>/<folder> path. Prose that
// merely mentions a folder — "with `--domain journey` it auto-selects …" — is
// not a command and passes. There is no allowance: the remedy is always a
// `<journey-domain>`-style placeholder that the naming rule resolves.
const DOC_LIB_REL = "plugins/gs-superadmin/scripts/doc-lib.mjs";
const laneBlock = /export const RECORDED_LANES = Object\.freeze\(\{([\s\S]*?)\n\}\);/.exec(read(DOC_LIB_REL));
const laneFolders = laneBlock ? [...laneBlock[1].matchAll(/folder: "([a-z0-9-]+)"/g)].map((m) => m[1]) : [];
if (laneFolders.length < 5) {
  fail(`check 22: could not read the \`folder:\` literals out of ${DOC_LIB_REL}'s RECORDED_LANES (got ${laneFolders.length}) — the table moved or its shape changed; fix the reader, never the sweep`);
}
// The reader above admits only [a-z0-9-] folder names, so the alternation needs
// no escaping; longest first, so `journey-email-templates` wins over `journey`.
const folderAlt = laneFolders.slice().sort((a, b) => b.length - a.length).join("|");
const DOMAIN_LITERAL_RES = laneFolders.length
  ? [
      new RegExp(`(?:^|\\s)--(?:domain|out-dir)\\s+"?(?:<slug>/)?(${folderAlt})(?=["'\\s/]|$)`),
      new RegExp(`<slug>/(${folderAlt})(?=/|["'\\s]|$)`),
    ]
  : [];
const isCommandText = (t) => /^\s*"?(?:node|gs-admin)\s/.test(t) || t.includes(".gs-superadmin/plugin/scripts/");
const domainLiteralIn = (t) => {
  if (!isCommandText(t)) return null;
  for (const re of DOMAIN_LITERAL_RES) { const m = re.exec(t); if (m) return m[1]; }
  return null;
};
// Self-test, run before the tree (F-260's pattern): rows fail the run outright.
// Skipped when the vocabulary could not be read — that failure is already
// recorded above and must reach the gate, not be pre-empted here.
for (const [text, inFence, expect, why] of laneFolders.length ? [
  ['node ".gs-superadmin/plugin/scripts/program-doc.mjs" --out-dir <slug>/journey <file …>', false, "journey", "the reference line that reopened F-429 (inline command span)"],
  ["node .gs-superadmin/plugin/scripts/manifest.mjs upsert-batch --manifest <slug>/_manifest.json --domain journey-email-templates --file x.json --partial", true, "journey-email-templates", "a fenced --domain literal"],
  ["node .gs-superadmin/plugin/scripts/describe-batch.mjs --manifest <slug>/_manifest.json --domain <journey-domain> --out-dir <slug>/<journey-domain>", true, null, "placeholders are the remedy"],
  ["--domain journey-email-templates", false, null, "a prose span describing the literal-keyed fallback is not a command"],
  ["gs-admin --json jo p list > <slug>/journey/x.json", true, "journey", "a <slug>/<folder> path segment in a command"],
  ["node .gs-superadmin/plugin/scripts/audit.mjs --domain rules --out-dir <slug>/audit-2026.md", true, null, "audit's user-facing enum and a non-folder path are not folders"],
  ["node .gs-superadmin/plugin/scripts/x.mjs --out-dir <slug>/report-reports", true, null, "a workspace's own longer name is not the default folder (word boundary)"],
] : []) {
  const got = capCodeTexts(text, inFence).map(domainLiteralIn).find((v) => v) ?? null;
  if (got !== expect) {
    console.error(`check 22 self-test: ${why} — expected ${JSON.stringify(expect)}, got ${JSON.stringify(got)} for ${JSON.stringify(text)}`);
    process.exit(2);
  }
}
const RUNNABLE_DOC_PREFIXES = ["plugins/gs-superadmin/skills/", "plugins/gs-superadmin/templates/"];
let runnableLinesSwept = 0;
let runnableDocsSwept = 0;
for (const rel of trackedMd.filter((p) => RUNNABLE_DOC_PREFIXES.some((pre) => p.startsWith(pre)))) {
  const lines = read(rel).split(/\r?\n/);
  const ranges = fenceRanges(rel, lines, "an unreadable fence hides its commands from check 22");
  const inFence = (i) => ranges.some(([a, b]) => i > a && i < b);
  runnableDocsSwept++;
  lines.forEach((line, i) => {
    const texts = capCodeTexts(line, inFence(i)).filter(isCommandText);
    if (!texts.length) return;
    runnableLinesSwept++;
    for (const t of texts) {
      const hit = domainLiteralIn(t);
      if (hit)
        fail(
          `${rel}:${i + 1}: a runnable line names the default domain folder \`${hit}\` literally — the workspace's recording decides that name ` +
            `(setup's naming rule; F-429). Use a placeholder the reader resolves (\`<journey-domain>\`-style, from report's byDomain or the ` +
            `4a summary's \`domains\`) and say where it comes from; a create-fresh line belongs in setup Phase 4, which names the recording itself`,
        );
    }
  });
}

// The fail() gate sits HERE, after the last check, and must stay last (F-258).
// It used to sit immediately after check 12 — with four checks and the pass line
// below it — so any fail() raised further down printed its message and then let the
// run print "Doc-drift check passed" and exit 0. Checks are appended at the bottom
// by habit, which is exactly where the gate did not reach: the two checks added with
// F-255/F-256/F-257 landed there and were mutation-proved to REPORT while exiting 0.
// Anything added below this line is unguarded; add checks above it.
if (failures) {
  console.error(`\n${failures} doc-drift failure(s). Docs must match the plugin tree — see messages above.`);
  process.exit(1);
}

const passLine =
  `Doc-drift check passed: check 19: ${MECHANICAL_CLASSES.length} defect-class rows swept over ${sweep19.filesSwept} files, ` +
  `0 unsanctioned hits, ${sweep19.allowLive}/${sweep19.allowRows} allowance rows live, ${MANUAL_CLASSES.length} manual classes cross-checked with AGENTS.md; ` +
  `${userSkills.length} skills documented with correct invocation labels, ` +
  `${runners.length} test runners listed in the battery fence (${pluginRunners.length} plugin test/ + ${buildRunners.length} build/test-*), ` +
  `dev-only content contained (no .mjs under the ${DEV_ONLY_STRIP_PATHS.length} strip paths; ${strippedRefsChecked} shipped files name none of them), plugin version ${pluginVersion} ` +
  `matches the changelog (${trackedMd.length} tracked .md scanned, ${check8Read} files read and swept for ${INVISIBLES.length} invisible-codepoint classes, ` +
  `${sweep9Read} of ${sweep9.length} files swept for portability-duplicate definitions, ` +
  `${lcCalls} localeCompare call sites locale-pinned, ` +
  `check 22: ${runnableLinesSwept} runnable line(s) in ${runnableDocsSwept} skill/template doc(s) name none of the ${laneFolders.length} default domain folders literally, ` +
  `${scriptRowsNamed} of ${scriptFiles.length} shipped scripts named in the MAINTAINERS Scripts table (rest are shared libs), ` +
  `${placeholderFences} placeholder fence(s) in ${pluginRootSkillsSeen.size} skill(s) (setup's pinned link fence; every other skill fence addresses scripts through ${WORKSPACE_LINK}), ` +
  `${check13Fences} hand-written doc fence(s) free of bash line continuations and ` +
  `${check13EnvSites} inline env-var prefix(es) carrying a $env: spelling, ` +
  `${helperSkillsSeen.size} capturing skills route through the capture helper with zero raw redirects, ` +
  `${kindSites} journal-kind nickname site(s) paired with the emitter literal, ` +
  `${preflightSites} token pre-flight sites held to one canon (${TOKEN_PREFLIGHT.canonSkill} + ` +
  `${TOKEN_PREFLIGHT.paraphraseSkills.length} paraphrase-plus-pointer), ` +
  `${upsertCopyOutsHeld} upsert-batch failure copy-out(s) held segment-wise to the writer's own stderr, ` +
  `${linkPathTokens} workspace-link path(s) held to tracked plugin files (F-398), ` +
  `${buildChainSites} of ${BUILD_CHAIN_SITES.length} build-pipeline enumeration(s) held to package.json's build script (F-407), ` +
  `${guardResiduals.length} guard residual(s) single-sourced and matched to the README anchor).` +
  check8SkippedNote +
  check8ExcludedNote +
  sweep9SkippedNote;

// Naming half of the F-211 lock: counting a skip is not enough — the claim is
// that every skipped file is NAMED in the line a reader actually sees. Checked
// against the rendered string, so dropping a note fragment fails the gate
// instead of quietly shrinking what the pass line discloses.
const unnamed = [...check8Skipped, ...check8Excluded, ...sweep9Skipped].filter((f) => !passLine.includes(f));
if (unnamed.length) {
  console.error(
    `\ncheck 8/9 accounting: ${unnamed.length} skipped file(s) not named in the pass line: ${unnamed.join(", ")} — ` +
      `every skip must be counted AND named.`
  );
  process.exit(1);
}
console.log(passLine);
