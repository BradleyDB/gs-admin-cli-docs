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
//
// Each case copies the real checker into a scratch git repo under the OS temp
// dir (the checker roots itself at its own script location and scans that
// repo's `git ls-files`), so the checker runs unmodified — except case 5,
// which deliberately mutates the scratch COPY. Zero dependencies.

import { appendFileSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ROOT } from "./lib.mjs";
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
function runRig(files, opts = {}) {
  const rig = mkdtempSync(join(tmpdir(), "instance-data-test-"));
  try {
    mkdirSync(join(rig, "build"));
    copyFileSync(CHECKER, join(rig, "build", "check-instance-data.mjs"));
    // lib.mjs rides along beside the copied script (DS-16): the script under
    // test imports it, and the copy's own location roots ROOT at the rig.
    copyFileSync(join(ROOT, "build", "lib.mjs"), join(rig, "build", "lib.mjs"));
    if (opts.appendToChecker) appendFileSync(join(rig, "build", "check-instance-data.mjs"), opts.appendToChecker);
    for (const [rel, content] of Object.entries(files)) writeFileSync(join(rig, rel), content);
    execSync("git init -q", { cwd: rig });
    // -c core.autocrlf=false: the rig never checks files out again, and a global
    // autocrlf=true otherwise spams LF/CRLF warnings into every test run.
    execSync("git -c core.autocrlf=false add -A", { cwd: rig });
    for (const [rel, content] of Object.entries(opts.untracked ?? {})) writeFileSync(join(rig, rel), content);
    return spawnSync(process.execPath, [join(rig, "build", "check-instance-data.mjs")], {
      cwd: rig,
      encoding: "utf8",
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
  ok("private-pattern failure names the pattern source", res.stderr.includes("private pattern 1"));
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
    ok("F-423: run from a worktree, the checker loads the MAIN checkout's private pattern and fails on the leak", res2.status === 1 && res2.stderr.includes("private pattern 1") && res2.stderr.includes("leak.md"));
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
  // rm`s dev/ and the canary from the index with no commit, then runs this
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

if (failures.length) {
  console.error(`test-check-instance-data: ${failures.length} FAILED, ${passed} passed`);
  for (const f of failures) console.error(`  FAIL: ${f}`);
  process.exit(1);
}
console.log(`test-check-instance-data: all ${passed} checks passed`);
