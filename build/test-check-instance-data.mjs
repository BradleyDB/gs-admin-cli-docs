#!/usr/bin/env node
// Fixture tests for build/check-instance-data.mjs — the leak gate that keeps
// tenant/instance/org data out of this maybe-open-sourced repo.
//
// What this pins (F-178: the gate used to skip ANY NUL-bearing file as "binary",
// so a UTF-16LE capture — what a Windows PowerShell 5.1 `>` redirect writes by
// default — bypassed the scan entirely while the success message claimed full
// coverage):
//   1. A UTF-16LE-with-BOM file carrying a tenant-qualified URL FAILS the gate.
//   2. Same for UTF-16BE-with-BOM.
//   3. Plain UTF-8 with the same string still fails (regex baseline).
//   4. A clean tree passes, UTF-16 files count as scanned (non-ASCII intact),
//      and a genuinely binary file is counted AND named in the success message
//      — the gate never silently overstates its coverage.
//   5. The gate scans ITSELF (F-203 removed the self-exclusion): a leaky slug
//      pasted into the gate's own source goes red like anywhere else.
//   6. A BOM'd gs-admin-explorer.config.json is parsed, not hard-failed
//      (F-204), and its private patterns fire on tracked files.
//   7. The pass line surfaces the loaded private-pattern count (F-204), so
//      deleting the config stops being invisible.
//   8. Every spelling of a local user path fails, not just the drive-letter one
//      (F-254): UNC share, WSL UNC, drive-less USERPROFILE-relative fragment and
//      the POSIX forms — while `<name>` placeholders and generic example paths
//      still pass, which is what the old drive-letter anchor was protecting.
//   9. The other half of that widening (F-259): a `home`/`Users` segment inside a
//      URL, a repo-relative path or an API route is NOT a machine path and must
//      PASS. Case 8 alone is satisfied by a matcher that flags everything.
//  10. Casing (F-261): the WINDOWS arms match the segment in any casing —
//      lowercase and all-caps drive/UNC/drive-less spellings are the same real
//      path on a case-insensitive filesystem — while the POSIX arm stays exact
//      on purpose (case-sensitive filesystems; real roots are /home and /Users),
//      so lowercase `/users/...` and REST-route docs keep passing.
//  11. Coverage is asserted (F-424): an empty index over a committed tree and a
//      tracked file missing from disk each FAIL the gate as a named coverage
//      shortfall — never "0 of 0 tracked files scanned", exit 0, and never an
//      uncaught ENOENT stack trace — while a file HEAD commits that the index
//      lacks WARNS on its own line (an intended staged deletion, the
//      release-strip rehearsal's, looks the same as a broken checkout).
//  12. Private patterns reach CI through the environment (the gate's header says
//      why): PRIVATE_INSTANCE_PATTERNS loads one regex per line (blank lines and #
//      comments skipped, entries named by their LINE in the variable), patterns
//      are deduplicated across the file and the environment, a private hit from
//      either source is reported with the matched text redacted, a GENERIC hit's
//      text and every printed file path have the private strings masked out, a
//      tracked path that matches a private pattern is itself a finding, an
//      invalid or empty-matching regex is refused by position without being
//      echoed, and REQUIRE_PRIVATE_PATTERNS turns a run with zero private
//      patterns from the F-423 warning into a refusal — while a run without that
//      flag (a fork's or Dependabot's PR, which get no secrets) keeps warning and
//      passing.
//  13. Masking is by SPANS over the whole line or path, never by re-matching a
//      pattern on a printed fragment (F-583, reopen 1): a lookbehind pattern, a
//      pattern wider than the generic match, a context-bound pattern (`--kb <name>`)
//      recurring bare in a URL on the same line or in the file's path or in another
//      file, and a pattern that is a prefix of another all leave the string out of
//      every printed line; a generic hit on a line with a private hit prints no text;
//      and the no-pattern message tells a comments-only variable apart from an empty
//      one.
//  14. The review of that fix (2026-10-24): a generic hit on a CLEAN line still prints
//      its text, with structural tokens (https, gainsightcloud) never learned as
//      literals; literal spans are found over the original string, so a line whose
//      lower-casing changes its length (U+0130) masks the right characters; a
//      lookaround-only private pattern (zero-length matches) is refused, not run.
//
// Each case copies the real checker into a scratch git repo under the OS temp
// dir (the checker roots itself at its own script location and scans that
// repo's `git ls-files`), so the checker runs unmodified — except case 5,
// which deliberately mutates the scratch COPY. Zero dependencies.

import { appendFileSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { ROOT, literalSpans, maskLocalPaths } from "./lib.mjs";
import { spawnSync, execSync } from "node:child_process";

const CHECKER = join(ROOT, "build", "check-instance-data.mjs");

// Assembled from fragments so THIS test file never contains a non-fictional
// tenant-qualified URL on one line — the real gate scans this file too.
const LEAKY_HOST = "leaky" + "corp" + ".gainsight" + "cloud.com";

let passed = 0;
const failures = [];
const ok = (name, cond) => {
  if (cond) passed++;
  else failures.push(name);
};

const utf16le = (s) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(s, "utf16le")]);
const utf16be = (s) => Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(s, "utf16le").swap16()]);

// files: { relPath: Buffer|string }. Returns the spawnSync result of running the
// checker copy inside a fresh scratch git repo containing exactly those files.
// opts.untracked: files written AFTER `git add` so they stay untracked — how the
// git-ignored gs-admin-explorer.config.json exists in the real repo (F-204).
// opts.appendToChecker: text appended to the scratch checker COPY before add —
// the self-scan mutant rig (F-203); the repo's checker is never touched.
// opts.env: environment variables for the checker run (case 12). The two the
// checker reads are CLEARED from the inherited environment first, so a developer
// shell or CI step that happens to carry them cannot change any other case.
// opts.args: (rig) => extra argv for the checker (case 16: the hook's --extra,
// --extra-private, --no-tree and --root), given the rig's path for file arguments.
function runRig(files, opts = {}) {
  const rig = mkdtempSync(join(tmpdir(), "instance-data-test-"));
  try {
    mkdirSync(join(rig, "build"));
    copyFileSync(CHECKER, join(rig, "build", "check-instance-data.mjs"));
    // lib.mjs rides along beside the copied script (DS-16): the script under
    // test imports it, and the copy's own location roots ROOT at the rig.
    copyFileSync(join(ROOT, "build", "lib.mjs"), join(rig, "build", "lib.mjs"));
    if (opts.appendToChecker) appendFileSync(join(rig, "build", "check-instance-data.mjs"), opts.appendToChecker);
    for (const [rel, content] of Object.entries(files)) {
      mkdirSync(dirname(join(rig, rel)), { recursive: true }); // case 12 commits files under subfolders
      writeFileSync(join(rig, rel), content);
    }
    execSync("git init -q", { cwd: rig });
    // -c core.autocrlf=false: the rig never checks files out again, and a global
    // autocrlf=true otherwise spams LF/CRLF warnings into every test run.
    execSync("git -c core.autocrlf=false add -A", { cwd: rig });
    for (const [rel, content] of Object.entries(opts.untracked ?? {})) writeFileSync(join(rig, rel), content);
    // Windows environment names are case-insensitive, so the inherited copy may spell
    // either variable in any casing — drop every spelling, not just the canonical one.
    const env = { ...process.env };
    for (const k of Object.keys(env)) if (/^(private_instance_patterns|require_private_patterns)$/i.test(k)) delete env[k];
    return spawnSync(process.execPath, [join(rig, "build", "check-instance-data.mjs"), ...(opts.args ? opts.args(rig) : [])], {
      cwd: rig,
      encoding: "utf8",
      env: { ...env, ...(opts.env ?? {}) },
    });
  } finally {
    rmSync(rig, { recursive: true, force: true });
  }
}

// ── 1. UTF-16LE capture file with a tenant URL: decoded, scanned, FAILS ──────
{
  const res = runRig({ "capture.json": utf16le(`{"url":"https://${LEAKY_HOST}/v1"}\n`) });
  ok("utf16le tenant URL fails the gate", res.status === 1);
  ok("utf16le failure names the file", res.stderr.includes("capture.json"));
  ok("utf16le failure names the check", res.stderr.includes("tenant-qualified"));
}

// ── 2. UTF-16BE variant: same outcome ────────────────────────────────────────
{
  const res = runRig({ "capture-be.txt": utf16be(`see https://${LEAKY_HOST}/x\n`) });
  ok("utf16be tenant URL fails the gate", res.status === 1);
  ok("utf16be failure names the file", res.stderr.includes("capture-be.txt"));
}

// ── 3. UTF-8 baseline: the regexes themselves still fire ─────────────────────
{
  const res = runRig({ "notes.md": `endpoint: ${LEAKY_HOST}\n` });
  ok("utf8 tenant URL fails the gate", res.status === 1);
}

// ── 4. Clean tree: UTF-16 scanned (not "binary"), real binary counted+named ──
{
  const res = runRig({
    "readme.md": "fixtures use acme-prod.gainsightcloud.com\n",
    "clean-utf16.txt": utf16le("Renouvellement Québec — nothing sensitive\n"),
    "assets.bin": Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02, 0x00]),
  });
  ok("clean tree passes", res.status === 0);
  ok("success message counts the skipped binary", res.stdout.includes("1 binary file(s) NOT scanned"));
  ok("success message names the skipped binary", res.stdout.includes("assets.bin"));
  // 5 tracked (the checker scans itself since F-203, plus its lib.mjs import —
  // DS-16) minus the binary = 4 of 5.
  ok("scanned/tracked accounting excludes only the binary", res.stdout.includes("4 of 5 tracked files scanned"));
  // F-204: no config in this rig → the pass line must say so, not stay identical.
  ok("success message shows zero private patterns without a config", res.stdout.includes("0 private pattern(s) loaded"));
}

// ── 5. Self-scan (F-203): a leaky slug inside the gate's own source goes red ─
{
  const res = runRig({}, { appendToChecker: `\n// probe: https://${LEAKY_HOST}/self\n` });
  ok("slug inside the gate itself fails the gate", res.status === 1);
  // Assert the CHECKER's own verdict phrasing, not just the filename: a
  // module-load crash (e.g. a missing lib.mjs copy) also exits 1 with the
  // checker's path in the stack, which would fake this case green (W3 review,
  // finder A).
  ok("self-scan failure names the gate file", res.stderr.includes("build/check-instance-data.mjs"));
  ok("self-scan failure is the gate's own verdict, not a load crash", res.stderr.includes("tenant-qualified"));
}

// ── 6. BOM'd config (F-204): parsed, patterns enforced — not a parse error ───
// The pattern string is assembled from fragments (same convention as LEAKY_HOST)
// and is a clearly fictional slug, never a real tenant string.
const PRIVATE_SLUG = "zeta" + "corp" + "-internal";
const bomConfig = String.fromCharCode(0xfeff) + JSON.stringify({ privateInstancePatterns: [PRIVATE_SLUG] });
{
  const res = runRig(
    { "notes.md": `mentions ${PRIVATE_SLUG} here\n` },
    { untracked: { "gs-admin-explorer.config.json": bomConfig } },
  );
  ok("BOM'd config does not hard-fail the parse", !res.stderr.includes("Could not parse"));
  ok("private pattern from BOM'd config fires", res.status === 1);
  ok("private-pattern failure names the file", res.stderr.includes("notes.md"));
  ok("private-pattern failure names the pattern source", res.stderr.includes("private pattern (local gs-admin-explorer.config.json entry 1)"));
  // Case 12's redaction rule applies to the file's patterns too: the matched
  // string is the thing that must not appear anywhere, a log included.
  ok("private-pattern failure does not echo the matched string", !res.stderr.includes(PRIVATE_SLUG) && res.stderr.includes("[match redacted]"));
}

// ── 7. Pass line surfaces the private-pattern count (F-204) ──────────────────
{
  const res = runRig(
    { "clean.md": "nothing sensitive\n" },
    { untracked: { "gs-admin-explorer.config.json": bomConfig } },
  );
  ok("clean tree with BOM'd config passes", res.status === 0);
  ok("success message counts loaded private patterns", res.stdout.includes("1 private pattern(s) loaded"));
}

// ── 8. Local user paths: every spelling, not just the drive-letter one (F-254) ─
// The username is assembled from fragments for the same reason LEAKY_HOST is: the
// real gate scans this file, and a literal `\Users\<alnum>` written here would be a
// finding rather than a fixture. In source the segment is always followed by an
// escape or `${`, never by an alphanumeric, so nothing below matches the checker's
// own pattern.
const LEAKY_USER = "dev" + "user";
{
  const spellings = {
    "UNC share": `see \\\\fileserver\\Users\\${LEAKY_USER}\\notes.txt for the run log\n`,
    "WSL UNC": `opened \\\\wsl$\\Ubuntu\\home\\${LEAKY_USER}\\repo/build.log\n`,
    "drive-less relative": `path was Users\\${LEAKY_USER}\\Desktop\\proj\n`,
    "drive letter": `C:\\Users\\${LEAKY_USER}\\Desktop\\proj\n`,
    "posix Users": `at /Users/${LEAKY_USER}/dev/repo\n`,
    "posix home": `at /home/${LEAKY_USER}/dev/repo\n`,
  };
  for (const [label, content] of Object.entries(spellings)) {
    const res = runRig({ "trace.md": content });
    ok(`${label} user path fails the gate`, res.status === 1);
    ok(`${label} failure names the check`, res.stderr.includes("local user path"));
  }
  // The placeholders and example paths the docs are full of must keep passing —
  // widening the matcher is only safe if this half holds.
  const res = runRig({
    "docs.md":
      "config lives at C:\\Users\\<name>\\.gs-admin, or ~/.gs-admin\n" +
      "clone into /path/to/repo (POSIX) or /Users/<name>/dev\n" +
      "the home directory is $HOME; on Windows use $env:USERPROFILE\n",
  });
  ok("placeholder and example paths still pass", res.status === 0);
}

// ── 9. `home`/`Users` inside a URL, a repo path or a route is NOT a leak (F-259) ─
// The negative half of case 8. A matcher anchored only on the segment satisfies
// every assertion in case 8 while failing the gate on ordinary documentation — the
// defect this pins. These strings are written literally: they must not match the
// shipped matcher, and the real gate scans this file, so a regression here reds
// twice over (this case, and the gate's own run against this file).
{
  const res = runRig({
    "docs.md":
      "see https://support.example.com/home/getting-started for the guide\n" +
      "docs live in reference/home/index.md and wiki/Users/overview.html\n" +
      "a route like app/home/page.tsx, and GET /api/v2/home/summary\n",
  });
  ok("docs-shaped home/Users segments pass the gate", res.status === 0);
  ok("docs-shaped run reports no user-path finding", !res.stderr.includes("local user path"));
  // URI forms whose path starts at a single slash (F-259, second round): the
  // scheme's last letter plus its colon is drive-letter-shaped, so an unanchored
  // arm (a) reads `file:/home/x` as drive `e:`. These are the exact strings the
  // tester re-opened on.
  const uri = runRig({
    "links.md":
      "local copy at file:/home/getting-started\n" +
      "a missing-slash typo: https:/home/getting-started\n" +
      "and note:/home/summary in the same class\n",
  });
  ok("single-slash URI paths pass the gate", uri.status === 0);
  ok("single-slash URI run reports no user-path finding", !uri.stderr.includes("local user path"));
}

// ── 10. Casing (F-261): Windows arms fold case, the POSIX arm does not ────────
// Positives use the same fragment convention as case 8 (segment never followed
// by an alphanumeric in THIS file's source, so the gate's self-scan stays clean).
{
  const spellings = {
    "lowercase drive": `path was c:\\users\\${LEAKY_USER}\\notes.txt\n`,
    "all-caps drive": `logged at C:\\USERS\\${LEAKY_USER}\\DESKTOP\\RUN.LOG\n`,
    "lowercase UNC share": `see \\\\fileserver\\users\\${LEAKY_USER}\\notes.txt\n`,
    "lowercase drive-less relative": `trace shows users\\${LEAKY_USER}\\Desktop\\proj\n`,
  };
  for (const [label, content] of Object.entries(spellings)) {
    const res = runRig({ "trace.md": content });
    ok(`${label} user path fails the gate`, res.status === 1);
    ok(`${label} failure names the check`, res.stderr.includes("local user path"));
  }
  // The deliberate NEGATIVE half: POSIX is case-sensitive and its real home
  // roots are exactly /home and /Users, so lowercase `/users/...` — the shape of
  // REST-route documentation — must keep passing. A whole-regex /i would red
  // both lines below, which is the F-259 docs-shaped class reopening.
  const res = runRig({
    "api.md":
      `the list endpoint is GET /users/123 (paginated)\n` +
      `a lowercase posix-looking path /users/${LEAKY_USER}/dev is not a home root\n`,
  });
  ok("lowercase posix users segment passes the gate", res.status === 0);
  ok("lowercase posix run reports no user-path finding", !res.stderr.includes("local user path"));
}

// ── F-423: the config is resolved from the MAIN checkout when run in a worktree,
// and a run with no private pattern says so on its own stderr line ────────────
{
  // (a) warning line: no config anywhere → the pass line still says 0 loaded
  // (pinned above), and stderr now carries a WARNING naming the weaker run.
  const res = runRig({ "clean.md": "nothing here\n" });
  ok("F-423: a run with no private pattern warns on stderr, on its own line", res.status === 0 && /^WARNING: no private pattern loaded/m.test(res.stderr));
  // (b) worktree: the rig's main checkout carries the (untracked) config; a
  // worktree of it does not — the checker run FROM THE WORKTREE must still load
  // the main checkout's pattern and fail on the leak the worktree carries.
  const rig = mkdtempSync(join(tmpdir(), "instance-data-worktree-"));
  try {
    mkdirSync(join(rig, "build"));
    copyFileSync(CHECKER, join(rig, "build", "check-instance-data.mjs"));
    copyFileSync(join(ROOT, "build", "lib.mjs"), join(rig, "build", "lib.mjs"));
    writeFileSync(join(rig, "clean.md"), "nothing here\n");
    execSync("git init -q", { cwd: rig });
    execSync("git -c core.autocrlf=false add -A", { cwd: rig });
    execSync('git -c user.email=t@example.com -c user.name=t commit -q -m base', { cwd: rig });
    writeFileSync(join(rig, "gs-admin-explorer.config.json"), JSON.stringify({ privateInstancePatterns: ["zzprivateorg"] }));
    const wt = join(rig, "wt");
    execSync(`git worktree add -q -b leak "${wt}"`, { cwd: rig });
    writeFileSync(join(wt, "leak.md"), "mentions zzprivateorg by name\n");
    execSync("git -c core.autocrlf=false add -A", { cwd: wt });
    const res2 = spawnSync(process.execPath, [join(wt, "build", "check-instance-data.mjs")], { cwd: wt, encoding: "utf8" });
    ok("F-423: run from a worktree, the checker loads the MAIN checkout's private pattern and fails on the leak", res2.status === 1 && res2.stderr.includes("private pattern (local gs-admin-explorer.config.json entry 1)") && res2.stderr.includes("leak.md"));
    ok("F-423: the worktree run does not warn about a missing config (it found the main checkout's)", !/^WARNING: no private pattern loaded/m.test(res2.stderr));
  } finally {
    rmSync(rig, { recursive: true, force: true });
  }
}

// ── F-424: coverage is asserted — a scan that read fewer files than the tree
// carries FAILS, naming each unread file, instead of passing "0 of 0" ─────────
// Three shortfall sources, one refusal. (a) is the tester's measured shape: a
// checkout whose index came up empty (MAX_PATH-failed clone) while HEAD commits
// the tree. (b) is the sibling the tester did not list — a single staged
// deletion — with the same rig passing once the deletion is unstaged, so the
// shortfall arm is what fails it. (c) is a tracked file gone from disk (sparse
// checkout, `rm` without `git rm`): before F-424 that crashed with a stack
// trace, exit 1 by accident, no verdict.
{
  const mkRig = () => {
    const rig = mkdtempSync(join(tmpdir(), "instance-data-coverage-"));
    mkdirSync(join(rig, "build"));
    copyFileSync(CHECKER, join(rig, "build", "check-instance-data.mjs"));
    copyFileSync(join(ROOT, "build", "lib.mjs"), join(rig, "build", "lib.mjs"));
    writeFileSync(join(rig, "one.md"), "nothing here\n");
    writeFileSync(join(rig, "two.md"), "nothing here either\n");
    execSync("git init -q", { cwd: rig });
    execSync("git -c core.autocrlf=false add -A", { cwd: rig });
    return rig;
  };
  const runIn = (rig) => spawnSync(process.execPath, [join(rig, "build", "check-instance-data.mjs")], { cwd: rig, encoding: "utf8" });
  const commit = (rig) => execSync('git -c user.email=t@example.com -c user.name=t commit -q -m base', { cwd: rig });
  // (a) empty index, populated HEAD
  let rig = mkRig();
  try {
    commit(rig);
    execSync("git rm -r -q --cached .", { cwd: rig });
    const res = runIn(rig);
    ok("F-424: an empty index over a committed tree FAILS the gate", res.status === 1);
    ok("F-424: the empty-index failure is a coverage verdict, not a load crash", /^ERROR: coverage shortfall/m.test(res.stderr) && res.stderr.includes("index is empty"));
    // 4 committed: one.md, two.md, and the checker + lib.mjs copies the rig tracks.
    ok("F-424: the empty-index failure counts the committed files it did not scan", res.stderr.includes("HEAD commits 4 file(s)"));
    ok("F-424: no pass line is printed on a shortfall", !res.stdout.includes("Instance-data check passed"));
  } finally {
    rmSync(rig, { recursive: true, force: true });
  }
  // (b) a staged deletion WARNS on its own line, naming the file — it passes,
  // because an intended deletion (docs-drift's release-strip rehearsal `git
  // rm`s the dev-only set from the index with no commit, then runs this
  // gate) is indistinguishable from a broken checkout; unstaging it clears the
  // warning on the same rig, so the warning arm is what produced it.
  rig = mkRig();
  try {
    commit(rig);
    execSync("git rm -q --cached one.md", { cwd: rig });
    const res = runIn(rig);
    ok("F-424: a staged deletion passes but WARNS on its own stderr line, naming the file", res.status === 0 && /^WARNING: 1 file\(s\) HEAD commits are absent from the index/m.test(res.stderr) && res.stderr.includes("one.md") && !res.stderr.includes("two.md"));
    ok("F-424: the staged-deletion pass line counts only what was scanned", res.stdout.includes("3 of 3 tracked files scanned"));
    execSync("git reset -q", { cwd: rig });
    const res2 = runIn(rig);
    ok("F-424: the same rig passes with no warning once the deletion is unstaged", res2.status === 0 && !/HEAD commits are absent/.test(res2.stderr) && res2.stdout.includes("4 of 4 tracked files scanned"));
  } finally {
    rmSync(rig, { recursive: true, force: true });
  }
  // (c) tracked file absent from the working tree
  rig = mkRig();
  try {
    rmSync(join(rig, "two.md"));
    const res = runIn(rig);
    ok("F-424: a tracked file missing from the working tree FAILS the gate as a coverage verdict", res.status === 1 && /^ERROR: coverage shortfall/m.test(res.stderr) && res.stderr.includes("two.md (tracked, absent from the working tree)"));
    ok("F-424: the missing-file failure is a verdict, not an uncaught ENOENT", !res.stderr.includes("ENOENT"));
  } finally {
    rmSync(rig, { recursive: true, force: true });
  }
}

// ── 12. Private patterns from the environment (CI's secret), redacted hits,
// REQUIRE_PRIVATE_PATTERNS ─────────────────────────────────────────────────────
// The pattern is assembled from fragments like PRIVATE_SLUG and is fictional.
const ENV_SLUG = "omega" + "corp" + "-ws";
{
  // (a) a pattern from the environment fires, is named by position and source,
  // and the matched text is redacted.
  const res = runRig({ "notes.md": `the ${ENV_SLUG} folder\n` }, { env: { PRIVATE_INSTANCE_PATTERNS: ENV_SLUG } });
  ok("env pattern fires on a tracked file", res.status === 1 && res.stderr.includes("notes.md"));
  ok("env pattern hit names its source and line", res.stderr.includes("private pattern (environment PRIVATE_INSTANCE_PATTERNS line 1)"));
  ok("env pattern hit does not echo the matched string", !res.stderr.includes(ENV_SLUG) && res.stderr.includes("[match redacted]"));
  // (b) one regex per line, named by its LINE in the variable; blank lines and #
  // comments are skipped; the pass line counts the environment's patterns apart from
  // the file's; REQUIRE with a pattern present changes nothing.
  const clean = runRig(
    { "clean.md": "nothing sensitive\n" },
    { env: { REQUIRE_PRIVATE_PATTERNS: "1", PRIVATE_INSTANCE_PATTERNS: `\n# the org name\n${ENV_SLUG}\n\n` } },
  );
  ok("env list with blanks and comments loads exactly one pattern, and REQUIRE is satisfied", clean.status === 0 && clean.stdout.includes("1 private pattern(s) loaded (0 from gs-admin-explorer.config.json, 1 from PRIVATE_INSTANCE_PATTERNS"));
  ok("a run with an env pattern does not warn about a missing private list", !/^WARNING: no private pattern loaded/m.test(clean.stderr));
  const lineNo = runRig({ "notes.md": `the ${ENV_SLUG} folder\n` }, { env: { PRIVATE_INSTANCE_PATTERNS: `# comment\n\n${ENV_SLUG}` } });
  ok("a hit names the pattern's LINE in the variable, not its index among the kept lines", lineNo.status === 1 && lineNo.stderr.includes("environment PRIVATE_INSTANCE_PATTERNS line 3)"));
  // (c) file and environment combine, each source's hit attributed to it; a pattern
  // both sources name is compiled once and counted under the file.
  const both = runRig(
    { "notes.md": `${PRIVATE_SLUG} and ${ENV_SLUG}\n` },
    { untracked: { "gs-admin-explorer.config.json": bomConfig }, env: { PRIVATE_INSTANCE_PATTERNS: ENV_SLUG } },
  );
  ok("file and env patterns both fire, each attributed to its source", both.status === 1 && both.stderr.includes("private pattern (local gs-admin-explorer.config.json entry 1)") && both.stderr.includes("private pattern (environment PRIVATE_INSTANCE_PATTERNS line 1)"));
  const bothClean = runRig(
    { "clean.md": "nothing sensitive\n" },
    { untracked: { "gs-admin-explorer.config.json": bomConfig }, env: { PRIVATE_INSTANCE_PATTERNS: ENV_SLUG } },
  );
  ok("pass line counts both sources", bothClean.status === 0 && bothClean.stdout.includes("2 private pattern(s) loaded (1 from gs-admin-explorer.config.json, 1 from PRIVATE_INSTANCE_PATTERNS"));
  const dup = runRig(
    { "notes.md": `${PRIVATE_SLUG} once\n` },
    { untracked: { "gs-admin-explorer.config.json": bomConfig }, env: { PRIVATE_INSTANCE_PATTERNS: PRIVATE_SLUG } },
  );
  ok("a pattern named by both sources is compiled once and reports its hit once", dup.status === 1 && (dup.stderr.match(/\[match redacted\]/g) ?? []).length === 1 && dup.stderr.includes("entry 1)") && !dup.stderr.includes("line 1)"));
  const dupClean = runRig(
    { "clean.md": "nothing sensitive\n" },
    { untracked: { "gs-admin-explorer.config.json": bomConfig }, env: { PRIVATE_INSTANCE_PATTERNS: PRIVATE_SLUG } },
  );
  ok("a pattern named by both sources counts once, under the file", dupClean.stdout.includes("1 private pattern(s) loaded (1 from gs-admin-explorer.config.json, 0 from PRIVATE_INSTANCE_PATTERNS"));
  // (d) REQUIRE_PRIVATE_PATTERNS: zero patterns is a refusal, not a warning — also
  // when the variable is set but holds nothing but comments; "false" (what the
  // workflow passes on a fork's or Dependabot's PR) keeps the warning-and-pass.
  const required = runRig({ "clean.md": "nothing sensitive\n" }, { env: { REQUIRE_PRIVATE_PATTERNS: "true" } });
  ok("REQUIRE with zero private patterns refuses the run", required.status === 1 && /^ERROR: no private pattern loaded/m.test(required.stderr) && !required.stdout.includes("Instance-data check passed"));
  const onlyComments = runRig({ "clean.md": "nothing sensitive\n" }, { env: { REQUIRE_PRIVATE_PATTERNS: "true", PRIVATE_INSTANCE_PATTERNS: "# nothing here\n\n#\n" } });
  ok("REQUIRE with a variable of only comments and blanks refuses the run", onlyComments.status === 1 && /^ERROR: no private pattern loaded/m.test(onlyComments.stderr));
  const fork = runRig({ "clean.md": "nothing sensitive\n" }, { env: { REQUIRE_PRIVATE_PATTERNS: "false" } });
  ok("REQUIRE=false (a fork's run) warns and passes as before", fork.status === 0 && /^WARNING: no private pattern loaded/m.test(fork.stderr));
  // (e) an invalid regex, or one that matches the empty string, is refused by
  // position and source and never echoed; a non-array file list is refused too.
  const bad = runRig({ "clean.md": "nothing sensitive\n" }, { env: { PRIVATE_INSTANCE_PATTERNS: "valid-one\n(unclosed[" } });
  ok("an invalid env regex is refused and named by line", bad.status === 1 && bad.stderr.includes("private pattern (environment PRIVATE_INSTANCE_PATTERNS line 2) is not a valid regular expression"));
  ok("the invalid regex itself is not echoed", !bad.stderr.includes("(unclosed["));
  const empty = runRig({ "clean.md": "nothing sensitive\n" }, { env: { PRIVATE_INSTANCE_PATTERNS: `${ENV_SLUG}|` } });
  ok("a pattern that matches the empty string is refused, not run", empty.status === 1 && empty.stderr.includes("line 1) matches the empty string") && !empty.stderr.includes("[match redacted]"));
  const notArray = runRig({ "clean.md": "nothing sensitive\n" }, { untracked: { "gs-admin-explorer.config.json": JSON.stringify({ privateInstancePatterns: PRIVATE_SLUG }) } });
  ok("a non-array privateInstancePatterns is refused with a verdict, not a stack trace", notArray.status === 1 && notArray.stderr.includes("must be an array of regex strings") && !notArray.stderr.includes("TypeError"));
  // (f) the private strings are masked out of everything the gate prints: a GENERIC
  // hit whose text carries one (a tenant URL on the org's slug) shows "[redacted]"
  // in its place, and a tracked PATH that carries one is a finding of its own,
  // printed masked — on the failure line, on the coverage line and in the pass
  // line's binary list.
  const generic = runRig({ "notes.md": `see https://${ENV_SLUG}.gainsight` + `cloud.com/x\n` }, { env: { PRIVATE_INSTANCE_PATTERNS: ENV_SLUG } });
  // Since F-583's first reopen (case 13, rule 3) a generic hit on a line that carries a
  // private hit prints no text at all; both checks still report.
  ok("a generic hit on a line with a private hit prints no text, and both checks report", generic.status === 1 && !generic.stderr.includes(ENV_SLUG) && generic.stderr.includes("tenant-qualified Gainsight URL: [match redacted]") && generic.stderr.includes("private pattern (environment PRIVATE_INSTANCE_PATTERNS line 1): [match redacted]"));
  const path = runRig({ [`kb/${ENV_SLUG}-prod/notes.md`]: "nothing sensitive in the content\n" }, { env: { PRIVATE_INSTANCE_PATTERNS: ENV_SLUG } });
  ok("a tracked path that matches a private pattern is a finding", path.status === 1 && path.stderr.includes("in the file path"));
  ok("the offending path is printed masked", !path.stderr.includes(ENV_SLUG) && path.stderr.includes("kb/[redacted]-prod/notes.md"));
  const binPath = runRig({ [`kb/${ENV_SLUG}-prod/assets.bin`]: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]) }, { env: { PRIVATE_INSTANCE_PATTERNS: ENV_SLUG } });
  ok("a binary under a private-named folder fails on its path and is never named in clear", binPath.status === 1 && !binPath.stderr.includes(ENV_SLUG) && !binPath.stdout.includes(ENV_SLUG));
}

// ── 13. Spans, not fragments (F-583 reopen 1): the tester's leaking probes ─────
// Every output of every run below is searched for the planted string; "absent" means
// 0 hits in stdout and stderr together. HOST is the fictional-shaped tenant host built
// from fragments so this file never carries one on a line.
{
  const HOST = ENV_SLUG + ".gainsight" + "cloud.com";
  const url = `see https://${HOST}/x\n`;
  const absent = (res) => !(res.stdout + res.stderr).includes(ENV_SLUG);
  // P1: a lookbehind pattern — the fragment the URL check matched starts AFTER the
  // lookbehind's context, so re-matching the fragment alone found nothing.
  const p1 = runRig({ "notes.md": url }, { env: { PRIVATE_INSTANCE_PATTERNS: `(?<=https://)${ENV_SLUG}` } });
  ok("P1 lookbehind pattern: the private hit fires and the string is absent from all output", p1.status === 1 && p1.stderr.includes("[match redacted]") && absent(p1));
  ok("P1: the generic URL hit on that line prints no text", !p1.stderr.includes(".gainsight" + "cloud.com\""));
  // P2: a pattern wider than the generic match (it includes the path after the host).
  const p2 = runRig({ "notes.md": url }, { env: { PRIVATE_INSTANCE_PATTERNS: `${ENV_SLUG}\\.gainsight` + `cloud\\.com/x` } });
  ok("P2 pattern wider than the fragment: the string is absent from all output", p2.status === 1 && absent(p2));
  // P3: the incident's shape — a context-bound pattern, and the bare string recurring
  // in a URL on the same line, which the pattern alone never matches.
  const p3 = runRig({ "notes.md": `--kb ${ENV_SLUG} then https://${HOST}/x\n` }, { env: { PRIVATE_INSTANCE_PATTERNS: `--kb\\s+${ENV_SLUG}` } });
  ok("P3 context-bound pattern, bare recurrence in a URL on the same line: absent from all output", p3.status === 1 && absent(p3));
  // P3b: the same pattern, the bare string in the FILE'S PATH (no pattern matches the
  // path; the literal learned from the content hit masks it).
  const p3b = runRig({ [`kb/${ENV_SLUG}-prod/notes.md`]: `--kb ${ENV_SLUG}\n` }, { env: { PRIVATE_INSTANCE_PATTERNS: `--kb\\s+${ENV_SLUG}` } });
  ok("P3b context-bound pattern, bare recurrence in the path: path printed masked, string absent", p3b.status === 1 && p3b.stderr.includes("kb/[redacted]-prod/notes.md:1:") && absent(p3b));
  // P3c: the literal learned in one file masks a generic hit in ANOTHER file (the scan
  // collects before it prints).
  const p3c = runRig({ "a.md": `--kb ${ENV_SLUG}\n`, "b.md": url }, { env: { PRIVATE_INSTANCE_PATTERNS: `--kb\\s+${ENV_SLUG}` } });
  ok("P3c a literal learned from one file masks a generic hit in another file", p3c.status === 1 && p3c.stderr.includes("b.md:1: tenant-qualified") && absent(p3c));
  // P9: a pattern that is a prefix of another — the union of spans leaves no remainder.
  const prefix = ENV_SLUG.slice(0, 7);
  const rest = ENV_SLUG.slice(7);
  const p9 = runRig({ "notes.md": `the ${ENV_SLUG} folder\n` }, { env: { PRIVATE_INSTANCE_PATTERNS: `${prefix}\n${ENV_SLUG}` } });
  ok("P9 prefix pattern beside the full one: no remainder of the string is printed", p9.status === 1 && absent(p9) && !p9.stderr.includes(`[redacted]${rest}`));
  // Rule 3 directly: a generic hit on a line with a private hit prints no text, while a
  // generic hit on a CLEAN line in the same file still prints its (masked) text.
  const r3 = runRig({ "notes.md": `${url}see https://acme.gainsight` + `cloud.com/y and ${ENV_SLUG}\n` }, { env: { PRIVATE_INSTANCE_PATTERNS: ENV_SLUG } });
  ok("rule 3: line 1 (private hit) prints redacted; line 2's acme host is fictional and passes", r3.status === 1 && r3.stderr.includes("notes.md:1: tenant-qualified Gainsight URL: [match redacted]") && absent(r3));
  // Noticed (2): comments-only variable is told apart from an empty one.
  const onlyComments = runRig({ "clean.md": "nothing sensitive\n" }, { env: { REQUIRE_PRIVATE_PATTERNS: "true", PRIVATE_INSTANCE_PATTERNS: "# only a comment" } });
  ok("a comments-only variable is named as such, not as empty", onlyComments.status === 1 && onlyComments.stderr.includes("holds no pattern line (blank or comment lines only)"));
  const unset = runRig({ "clean.md": "nothing sensitive\n" }, { env: { REQUIRE_PRIVATE_PATTERNS: "true" } });
  ok("an unset variable is named as empty or unset", unset.status === 1 && unset.stderr.includes("is empty or unset"));
}

// ── 14. The fix's review: clean-line generic hits keep their text, the stoplist, the
// Unicode span bug, lookaround-only patterns ──────────────────────────────────────
{
  const HOST = ENV_SLUG + ".gainsight" + "cloud.com";
  const absent = (res) => !(res.stdout + res.stderr).includes(ENV_SLUG);
  // (a) A generic hit on a CLEAN line prints its text (the one thing a regression to
  // "redact everything" would break), and the context tokens of a private pattern that
  // fired elsewhere (https, gainsightcloud) are NOT learned as literals, so that text is
  // intact; only the private string itself is masked wherever it recurs.
  const clean = runRig(
    { "a.md": `see https://${HOST}/x\n`, "b.md": `endpoint: https://${LEAKY_HOST}/v1 and ${ENV_SLUG}-prod\n` },
    { env: { PRIVATE_INSTANCE_PATTERNS: `https://${ENV_SLUG}\\.gainsight` + `cloud\\.com` } },
  );
  ok("a generic hit on a clean line prints its text, structural tokens unmasked", clean.status === 1 && clean.stderr.includes(`b.md:1: tenant-qualified Gainsight URL: "${LEAKY_HOST}"`));
  ok("the private string learned from a.md is masked where it recurs bare in b.md's path-like text, and absent from all output", absent(clean));
  // (b) U+0130 lower-cases to two code units: a span found by index in a lower-cased
  // copy would land three characters late on this line.
  const dotted = runRig(
    { "a.md": `--kb ${ENV_SLUG}\n`, "b.md": `İİİ see https://${HOST}/x\n` },
    { env: { PRIVATE_INSTANCE_PATTERNS: `--kb\\s+${ENV_SLUG}` } },
  );
  ok("a literal span on a line whose lower-casing changes its length masks the right characters", dotted.status === 1 && absent(dotted) && dotted.stderr.includes(`"[redacted].gainsight` + `cloud.com"`));
  // (c) A lookaround-only pattern matches zero characters: refused by position, pattern
  // not echoed, nothing printed in clear.
  const look = runRig({ [`kb/${ENV_SLUG}/notes.md`]: `the ${ENV_SLUG} folder\n` }, { env: { PRIVATE_INSTANCE_PATTERNS: `(?=${ENV_SLUG})` } });
  ok("a lookaround-only private pattern is refused as matching zero characters", look.status === 1 && look.stderr.includes("matches zero characters at a tracked file's path") && absent(look));
}

// ── 15. One literal finder in lib.mjs (F-585): maskLocalPaths and the gate's learned
// literals both call literalSpans ─────────────────────────────────────────────────
{
  // (a) The judge for the masker: the algorithm maskLocalPaths had before (longest path
  // first, both slash spellings, case-folded on win32, replaced in place pass by pass),
  // kept here as the reference, must agree with the span-based one over inputs that
  // exercise every axis: nesting (a home folder inside a repo path), both slash
  // spellings, mixed case, repeats, a token that could itself look like a path.
  const oldMask = (text, pairs) => {
    const ci = process.platform === "win32";
    let out = text;
    const sorted = [...pairs].filter(([p]) => p).sort((a, b) => b[0].length - a[0].length);
    for (const [p, token] of sorted) {
      for (const spelling of new Set([p, p.replace(/\\/g, "/"), p.replace(/\//g, "\\")])) {
        const hay = ci ? out.toLowerCase() : out;
        const needle = ci ? spelling.toLowerCase() : spelling;
        let next = "";
        let from = 0;
        for (let at = hay.indexOf(needle); at !== -1; at = hay.indexOf(needle, from)) {
          next += out.slice(from, at) + token;
          from = at + needle.length;
        }
        out = next + out.slice(from);
      }
    }
    return out;
  };
  // The paths are assembled from fragments (the real gate scans this file, and a user path
  // spelled out on one line is exactly what it refuses).
  const U = "Us" + "ers";
  const home = ["C:", U, "pat"].join("\\");
  const repo = [home, "work", "repo"].join("\\");
  const wt = [home, "AppData", "Local", "Temp", "wt-abc"].join("\\");
  /** @type {Array<[string, string]>} */
  const pairs = [[wt, "<worktree>"], [repo, "<repo>"], [home, "<home>"], ["", "<empty>"]];
  const texts = [
    `cwd ${repo}\\build\\x.mjs and ${repo.replace(/\\/g, "/")}/lib.mjs`,
    `${home}\\other ${home.toLowerCase()}\\other ${repo.toUpperCase()}\\Y`,
    `${wt}/a ${wt}\\b ${repo} ${home} ${home}`,
    `nothing to mask here /${"ho" + "me"}/pat/x c:/${U.toLowerCase()}/pat`,
    `${repo}${repo}${home}`,
    `mixed ${repo.replace(/\\/g, "/").replace("pat", "Pat").replace("repo", "REPO")}/z and ${home.replace(/\\/g, "/")}/`,
  ];
  const disagreements = texts.filter((t) => maskLocalPaths(t, pairs) !== oldMask(t, pairs)).map((t) => [t, maskLocalPaths(t, pairs), oldMask(t, pairs)]);
  ok("F-585 maskLocalPaths on literalSpans agrees with the pass-by-pass reference over every axis (nesting, slashes, case, repeats)", disagreements.length === 0 && maskLocalPaths(texts[0], pairs).includes("<repo>\\build\\x.mjs") && !maskLocalPaths(texts[4], pairs).includes("Users"));
  // (b) The finder itself: a nested literal takes the longer's token at one start; spans
  // that overlap merge and spans that only touch stay apart; a case-folded search over a
  // line whose folding changes its length (U+0130 lower-cases to two code units) lands on
  // the right characters.
  const spans = literalSpans("ab abc ABC x", /** @type {Array<[string, string]>} */ ([["ab", "A"], ["abc", "B"]]), { caseInsensitive: true });
  ok("F-585 literalSpans: the longest literal at a start wins its token, and overlapping spans merge", spans.length === 3 && spans[0].token === "A" && spans[0].end === 2 && spans[1].token === "B" && spans[1].start === 3 && spans[1].end === 6 && spans[2].token === "B" && spans[2].start === 7 && spans[2].end === 10);
  const dotted = `İİİ see ${ENV_SLUG} here`;
  const sp = literalSpans(dotted, /** @type {Array<[string, string]>} */ ([[ENV_SLUG.toUpperCase(), ""]]), { caseInsensitive: true });
  ok("F-585 literalSpans: a literal on a line whose lower-casing grows is found at its ORIGINAL index", sp.length === 1 && sp[0].start === dotted.indexOf(ENV_SLUG) && sp[0].end === dotted.indexOf(ENV_SLUG) + ENV_SLUG.length);
  ok("F-585 literalSpans: case-sensitive by default, and an empty literal matches nothing", literalSpans("Ab ab", /** @type {Array<[string, string]>} */ ([["ab", ""]])).length === 1 && literalSpans("Ab ab", /** @type {Array<[string, string]>} */ ([["", ""]])).length === 0);
}

// ── 16. Beside the tree (F-588) and from outside it (F-589): --extra, --extra-private,
// --no-tree, --root ─────────────────────────────────────────────────────────────────
{
  const LEAKY_MAIL = "ops@" + "leakycorp" + ".net";
  // (a) An extra text is scanned with every check and named by its label; the private string
  // in it is redacted and learned (it masks the tree's clean-line URL too).
  const msg = runRig(
    { "clean.md": "nothing sensitive\n" },
    { untracked: { "msg.txt": `fix the --kb ${ENV_SLUG} folder\n` }, env: { PRIVATE_INSTANCE_PATTERNS: ENV_SLUG }, args: (rig) => ["--extra", "commit abc123 message", join(rig, "msg.txt")] },
  );
  ok("--extra: a private hit in an extra text is a finding named by its label, redacted", msg.status === 1 && msg.stderr.includes("commit abc123 message:1: private pattern (environment PRIVATE_INSTANCE_PATTERNS line 1): [match redacted]") && !(msg.stdout + msg.stderr).includes(ENV_SLUG));
  const mail = runRig(
    { "clean.md": "nothing sensitive\n" },
    { untracked: { "msg.txt": `ping ${LEAKY_MAIL} about it\n` }, env: { PRIVATE_INSTANCE_PATTERNS: ENV_SLUG }, args: (rig) => ["--extra", "commit abc123 message", join(rig, "msg.txt")] },
  );
  ok("--extra: the generic checks run on an extra text too (a non-fictional email in a commit message is a finding)", mail.status === 1 && mail.stderr.includes(`commit abc123 message:1: email address: "${LEAKY_MAIL}"`));
  // (b) --extra-private: the private patterns alone — an identity line carries an email by
  // design and passes the generic email check; a private string in it still fails.
  const ident = runRig(
    { "clean.md": "nothing sensitive\n" },
    { untracked: { "id.txt": `Pat Example <${LEAKY_MAIL}>\n` }, env: { PRIVATE_INSTANCE_PATTERNS: ENV_SLUG }, args: (rig) => ["--extra-private", "commit abc123 identities", join(rig, "id.txt")] },
  );
  ok("--extra-private: an identity with a non-fictional address passes (the private patterns alone run on it)", ident.status === 0 && ident.stdout.includes("1 extra text(s) scanned beside the tree"));
  const identHit = runRig(
    { "clean.md": "nothing sensitive\n" },
    { untracked: { "id.txt": `Pat ${ENV_SLUG} <${LEAKY_MAIL}>\n` }, env: { PRIVATE_INSTANCE_PATTERNS: ENV_SLUG }, args: (rig) => ["--extra-private", "commit abc123 identities", join(rig, "id.txt")] },
  );
  ok("--extra-private: a private string in an identity is a finding, redacted", identHit.status === 1 && identHit.stderr.includes("commit abc123 identities:1: private pattern") && !(identHit.stdout + identHit.stderr).includes(ENV_SLUG));
  // (c) --no-tree: the extras alone, no tree read, no coverage refusal on an empty index.
  const nameOnly = runRig(
    { "leak.md": `the ${ENV_SLUG} folder\n` },
    { untracked: { "ref.txt": "refs/heads/clean-name\n" }, env: { PRIVATE_INSTANCE_PATTERNS: ENV_SLUG }, args: (rig) => ["--no-tree", "--extra", "ref name", join(rig, "ref.txt")] },
  );
  ok("--no-tree: only the extras are scanned (a leaking tree is not read; a clean name passes)", nameOnly.status === 0 && nameOnly.stdout.includes("0 of 0 tracked files scanned") && nameOnly.stdout.includes("1 extra text(s)"));
  const nameHit = runRig(
    { "clean.md": "nothing sensitive\n" },
    { untracked: { "ref.txt": `refs/heads/zz-${ENV_SLUG}\n` }, env: { PRIVATE_INSTANCE_PATTERNS: ENV_SLUG }, args: (rig) => ["--no-tree", "--extra", "ref name", join(rig, "ref.txt")] },
  );
  ok("--no-tree: a ref name carrying a private string is a finding, the name redacted", nameHit.status === 1 && nameHit.stderr.includes("ref name:1: private pattern") && !(nameHit.stdout + nameHit.stderr).includes(ENV_SLUG));
  // (d) An extra that cannot be read is a refusal, never a pass.
  const gone = runRig({ "clean.md": "nothing sensitive\n" }, { env: { PRIVATE_INSTANCE_PATTERNS: ENV_SLUG }, args: (rig) => ["--extra", "commit abc123 message", join(rig, "no-such.txt")] });
  ok("an extra text that cannot be read refuses the run", gone.status === 1 && gone.stderr.includes("cannot be read") && !gone.stdout.includes("Instance-data check passed"));
  // (e) --root: the tree scanned is the one named, not the one the script sits in (F-589:
  // the hook stages the checker outside the pushed tree). A second rig stands for the
  // pushed tree; the checker copy in the first rig scans it and finds its plant.
  const other = mkdtempSync(join(tmpdir(), "instance-data-root-"));
  try {
    writeFileSync(join(other, "notes.md"), `--kb ${ENV_SLUG}\n`);
    execSync("git init -q", { cwd: other });
    execSync("git -c core.autocrlf=false add -A", { cwd: other });
    const rooted = runRig({ "clean.md": "nothing sensitive\n" }, { env: { PRIVATE_INSTANCE_PATTERNS: ENV_SLUG }, args: () => ["--root", other] });
    ok("--root: the named tree is scanned (its plant found) while the script's own tree is not", rooted.status === 1 && rooted.stderr.includes("notes.md:1: private pattern") && !(rooted.stdout + rooted.stderr).includes(ENV_SLUG));
    const rootedClean = runRig({ "leak.md": `the ${ENV_SLUG} folder\n` }, { env: { PRIVATE_INSTANCE_PATTERNS: ENV_SLUG }, args: (rig) => ["--root", rig] });
    ok("--root naming the script's own tree is the bare run", rootedClean.status === 1 && rootedClean.stderr.includes("leak.md:1: private pattern"));
  } finally {
    rmSync(other, { recursive: true, force: true });
  }
}

if (failures.length) {
  console.error(`test-check-instance-data: ${failures.length} FAILED, ${passed} passed`);
  for (const f of failures) console.error(`  FAIL: ${f}`);
  process.exit(1);
}
console.log(`test-check-instance-data: all ${passed} checks passed`);
