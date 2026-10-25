#!/usr/bin/env node
// Instance-data check: nothing tenant-, instance-, or org-specific may ever be
// committed — this repo may be open-sourced. Fixtures and doc examples use fictional
// tenants (the acme-prod pattern); live findings and upstream bug reports are archived
// locally outside any git repo. This scans every tracked file for tenant-qualified
// Gainsight URLs, local user paths, and email addresses, and fails with file:line
// messages, same style as check-stale-facts.mjs.
//
// The patterns here are deliberately GENERIC so this check itself never contains a
// sensitive string. Org-specific strings to detect (real tenant slugs, org names,
// the workspace folder names that `--kb <folder>` puts into bus prose) come from two
// places that never enter git history: the git-ignored gs-admin-explorer.config.json
// under "privateInstancePatterns" (see gs-admin-explorer.config.example.json) for
// local runs, and the PRIVATE_INSTANCE_PATTERNS environment variable, which the
// docs-drift workflow fills from a repository secret, for CI.
//
// Zero dependencies: Node built-ins only. Runs in .github/workflows/docs-drift.yml.

import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, resolve } from "node:path";
import { ROOT, readJsonFile } from "./lib.mjs";

// The gate scans its own source too (F-203): the detection regexes never match
// their escaped spellings, and every example string in this file sticks to the
// fictional acme pattern — the same fragment convention
// build/test-check-instance-data.mjs uses — so a real slug pasted into a hint
// or comment here goes red like anywhere else instead of shipping unflagged.

// Fictional/placeholder tenant subdomains are legitimate in fixtures and docs.
const FICTIONAL_SUBDOMAIN = /^(?:acme|devon|example)[a-z0-9-]*$|^your[-_]?[a-z-]*$/i;
// Fictional email domains are legitimate anywhere; SECURITY.md's advisory contact is
// the one deliberate real address (that file is exempt from the email check only).
const FICTIONAL_EMAIL_DOMAIN = /^(?:[a-z0-9-]+\.)*(?:acme\.com|example\.(?:com|org|net))$/i;

// what → shown in the failure line; ok(match) → true means the match is legitimate;
// redact → the failure line never shows the matched text (private patterns).
/** @type {{ what: string, re: RegExp, ok: (m: RegExpMatchArray) => boolean, hint: string, skipFiles?: string[], redact?: boolean }[]} */
const CHECKS = [
  {
    what: "tenant-qualified Gainsight URL",
    re: /\b([A-Za-z0-9][A-Za-z0-9_-]*)\.gainsightcloud\.com\b/g,
    ok: (m) => FICTIONAL_SUBDOMAIN.test(m[1]),
    hint: "use a fictional tenant (acme-prod pattern) or a your-company placeholder",
  },
  {
    // Anchored on how a machine path is ROOTED, not on the presence of a
    // `Users`/`home` segment. F-254 widened this to catch three spellings the old
    // drive-letter anchor missed; F-259 is what that widening cost — a bare segment
    // match also fires on `example.com/home/x`, `app/home/page.tsx` and any
    // `/api/…/home/…` route, i.e. text identifying nobody, under a message telling
    // the author their machine path leaks. Three roots, each spelled out:
    //   (a) drive letter or UNC share, at any depth — C:\Users\<name>,
    //       \\host\Users\<name>, \\wsl$\<distro>\home\<name>. The UNC root is
    //       BACKSLASH-ONLY on purpose: allowing `//` makes every https:// URL whose
    //       path starts /home/ a match, which is the F-259 defect itself.
    //   (b) absolute POSIX at a token boundary — /Users/<name>, /home/<name>.
    //   (c) drive-less Windows-relative at a token boundary — Users\<name>\…, the
    //       shape a pasted log line or stack trace carries. Backslash separator only,
    //       for the same reason as (a): `reference/home/index.md` is not a leak.
    // F-178 fixed which files get scanned; this is what the scan matches once it
    // reads them.
    // Username must start alphanumeric so placeholders like C:\Users\<name> pass.
    what: "local user path",
    // The `\b` on the drive letter is load-bearing and both ancestor matchers carried
    // it (F-259, second round): without it any letter-then-colon mid-word starts arm
    // (a), so a URI with a single-slash path — `file:/home/…`, a `https:/home/…` typo —
    // matches as drive `e:`/`s:`. Docs text failing a leak gate is the pressure this
    // whole entry exists to remove, so the anchor stays even though `\b` reads like
    // decoration next to a character class.
    // (The `\b` binds to the DRIVE alternative only — hoisting it in front of the
    // group kills the UNC arm, whose first character is a backslash with a space
    // before it, i.e. no word boundary. Caught by case 8, which is what it is for.)
    // The Windows arms (a) and (c) match the segment in ANY casing (F-261):
    // Windows filesystems are case-insensitive, so `c:\users\...`, `C:\USERS\...`
    // and a lowercase UNC share path are the same real path as the canonical
    // spelling, and share paths in particular are typed lowercase. Spelled as
    // per-letter classes, not a whole-regex /i and not an inline modifier group,
    // so the arm stays portable and nothing else changes meaning. The POSIX arm
    // (b) is EXACT on purpose: those filesystems are case-sensitive, the real
    // home roots are precisely /home (Linux) and /Users (macOS), and a
    // case-folded arm (b) would flag REST-route documentation - the docs-shaped
    // false-positive class F-259 just closed.
    re: /(?:\b[A-Za-z]:|\\\\[^\\/\s"'`]+)(?:[\\/][^\\/\s"'`]+)*?[\\/](?:[Uu][Ss][Ee][Rr][Ss]|[Hh][Oo][Mm][Ee])[\\/]([A-Za-z0-9][A-Za-z0-9._-]*)|(?:^|[\s"'`(=])\/(?:Users|home)\/([A-Za-z0-9][A-Za-z0-9._-]*)|(?:^|[\s"'`(=])(?:[Uu][Ss][Ee][Rr][Ss]|[Hh][Oo][Mm][Ee])\\([A-Za-z0-9][A-Za-z0-9._-]*)/g,
    ok: () => false,
    hint: "real machine paths identify a contributor/tenant — use /path/to/... or <name> placeholders",
  },
  {
    what: "email address",
    re: /\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g,
    ok: (m) => FICTIONAL_EMAIL_DOMAIN.test(m[2]),
    skipFiles: ["SECURITY.md"],
    hint: "use a fictional address (cs@acme.com pattern)",
  },
];

// Optional git-ignored local config with private org-specific patterns. The
// count of loaded patterns is surfaced in the pass line — deleting the config
// must not be invisible (F-204). The BOM-tolerant parse lives in build/lib.mjs
// readJsonFile (F-118/F-204 — this reader's own strip copy retired at B5
// W3/DS-16); a PRESENT-but-unparseable config still hard-fails loudly.
let privatePatternCount = 0;
// The config is git-ignored and lives in the MAIN checkout's root, so a
// `git worktree` (which /dev-loop recommends for branch surgery and the
// merge-readiness pass) has none beside its own build/ — and this checker
// used to run there with the private list silently empty, inside a PASS line
// (F-423: a worktree push of dev passed with "0 private pattern(s) loaded"
// while the same tree failed from the main checkout). Resolve the config from
// ROOT first, then from the main checkout that the worktree's common git dir
// belongs to; and say on its own stderr line when no private pattern loaded
// at all, so a weaker run never reads like a full one.
const cfgCandidates = [join(ROOT, "gs-admin-explorer.config.json")];
try {
  const common = execSync("git rev-parse --git-common-dir", { cwd: ROOT, encoding: "utf8" }).trim();
  const mainRoot = join(resolve(ROOT, common), "..");
  if (resolve(mainRoot) !== resolve(ROOT)) cfgCandidates.push(join(mainRoot, "gs-admin-explorer.config.json"));
} catch { /* not a git checkout: ROOT only */ }
const cfgPath = cfgCandidates.find((p) => existsSync(p));
let filePatterns = [];
if (cfgPath) {
  try {
    filePatterns = readJsonFile(cfgPath).privateInstancePatterns ?? [];
  } catch (e) {
    console.error(`Could not parse gs-admin-explorer.config.json: ${e.message}`);
    process.exit(1);
  }
}
// The second source of private patterns is the environment: PRIVATE_INSTANCE_PATTERNS,
// one case-insensitive regex per line (blank lines and `#` comments ignored). The
// docs-drift workflow fills it from a repository secret, so CI enforces the
// org-specific list without the list ever entering the tree; GitHub masks the
// secret's value in logs and withholds it from pull requests opened from forks,
// whose runs therefore keep the generic patterns (and the WARNING below). Until
// 2026-10 CI ran with no private pattern at all, and one machine's git-ignored
// config was the only place the list lived — a workspace folder name pasted into
// bus prose passed every gate for twelve days. REQUIRE_PRIVATE_PATTERNS=1 (or
// `true`) turns "zero private patterns loaded" from the F-423 warning into a
// refusal; the workflow sets it only when the secret is present, so the owner's
// pushes can never run weak unnoticed while a fork's PR still passes.
const envPatterns = (process.env.PRIVATE_INSTANCE_PATTERNS ?? "")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));
const requirePrivate = /^(1|true)$/i.test((process.env.REQUIRE_PRIVATE_PATTERNS ?? "").trim());
// A private-pattern hit never echoes the matched text (redact: true): the hit's
// whole point is that the string must not appear anywhere, a CI log included.
const addPrivate = (patterns, source) =>
  patterns.forEach((p, i) => {
    let re;
    try {
      re = new RegExp(p, "gi");
    } catch (e) {
      // V8's message quotes the pattern ("Invalid regular expression: /…/gi: Unterminated
      // character class"); keep only the reason after the last ": " so the private
      // string is not echoed by the very gate that exists to keep it out of logs.
      const why = String(e.message).split(": ").pop();
      console.error(`private pattern ${i + 1} (${source}) is not a valid regular expression: ${why}`);
      process.exit(1);
    }
    CHECKS.push({
      what: `private pattern ${i + 1} (${source})`,
      re,
      ok: () => false,
      hint: "org-specific string — remove it before committing",
      redact: true,
    });
  });
addPrivate(filePatterns, "local gs-admin-explorer.config.json");
addPrivate(envPatterns, "environment PRIVATE_INSTANCE_PATTERNS");
privatePatternCount = filePatterns.length + envPatterns.length;

const files = execSync("git ls-files -z", { cwd: ROOT, encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

// Coverage is ASSERTED, never only reported (F-424). The pass line used to say
// "N of M tracked files scanned" with N and M taken from whatever the index
// held — and a checkout whose index came up empty (a clone or worktree that
// failed on Windows MAX_PATH left "0 of 0", exit 0) passed the push. Three
// ways the scan can cover less than the tree the push carries, each on its
// own stderr line, never inside the pass sentence:
//   - an empty index — FAILS: no tree has nothing to scan;
//   - a tracked file absent from the working tree (sparse checkout, a file
//     removed without `git rm`) — FAILS: the index claims it and nothing read it;
//   - a file HEAD commits that the index lacks — WARNS, naming the files: a
//     broken checkout and an intended staged deletion look identical here,
//     and one caller is intended by design (docs-drift's release-strip
//     rehearsal `git rm`s the dev-only set from the index, no commit, then
//     runs this gate on exactly the release tree). The pushed tip still
//     carries the files, so the operator is told which ones went unread.
// Unborn HEAD (a fresh rig with no commit) diffs against the empty tree and
// lists no deletion, so the fixture repos need no special case.
const unscanned = []; // the failing kind
const stagedDeletions = execSync("git diff --cached --name-only --no-renames --diff-filter=D -z", { cwd: ROOT, encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const nameSome = (list) => list.slice(0, 5).join(", ") + (list.length > 5 ? `, … and ${list.length - 5} more` : "");
if (files.length === 0) {
  console.error(
    `ERROR: coverage shortfall — the index is empty (no tracked file at all)` +
      (stagedDeletions.length ? ` while HEAD commits ${stagedDeletions.length} file(s)` : "") +
      `. A clone or worktree whose checkout failed (Windows MAX_PATH) leaves exactly this; ` +
      `run the gate from a complete checkout of the tree being pushed (F-424).`,
  );
  process.exit(1);
}

// Decode a tracked file for scanning, or return null for genuine binary. A NUL-byte
// sniff alone would skip UTF-16 files too (every other byte is NUL) — and UTF-16LE
// is exactly what a Windows PowerShell 5.1 `>` redirect writes by default, so a
// committed capture file carrying real tenant names would bypass this gate entirely.
// A leak gate must scan what a contributor's default shell produces: BOM'd UTF-16
// is decoded and scanned; only NUL-bearing files WITHOUT a UTF-16 BOM are binary.
function decodeTracked(buf) {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe)
    return buf.subarray(2).toString("utf16le");
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff)
    return Buffer.from(buf.subarray(2)).swap16().toString("utf16le");
  if (buf.includes(0)) return null; // binary
  return buf.toString("utf8");
}

let failures = 0;
const skippedBinary = [];
for (const file of files) {
  let buf;
  try {
    buf = readFileSync(join(ROOT, file));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    unscanned.push(`${file} (tracked, absent from the working tree)`);
    continue;
  }
  const text = decodeTracked(buf);
  if (text === null) {
    skippedBinary.push(file);
    continue;
  }
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    for (const { what, re, ok, hint, skipFiles, redact } of CHECKS) {
      if (skipFiles?.includes(file)) continue;
      for (const m of line.matchAll(re)) {
        if (!ok(m)) {
          failures++;
          const shown = redact ? "[match redacted]" : `"${m[0].trim()}"`;
          console.error(`${file}:${i + 1}: ${what}: ${shown} — ${hint}`);
        }
      }
    }
  });
}

if (failures) {
  console.error(
    `\n${failures} instance-data finding(s). Nothing tenant-, instance-, or org-specific may be committed — see "Data hygiene" in AGENTS.md.`,
  );
  process.exit(1);
}
// Findings first (a leak is the more urgent verdict), then coverage (F-424):
// a tracked file nothing read is refused as a gate run, each named; a file
// HEAD commits that the index lacks is named on its own WARNING line — both
// outside the pass sentence.
if (unscanned.length) {
  console.error(
    `ERROR: coverage shortfall — ${unscanned.length} tracked file(s) were NOT scanned:\n` +
      unscanned.map((u) => `  ${u}`).join("\n") +
      `\nA sparse or partial checkout, or a file removed without git rm. Run the gate from a complete checkout ` +
      `of the tree being pushed; a scan that read fewer files than the index lists cannot vouch for it (F-424).`,
  );
  process.exit(1);
}
if (stagedDeletions.length) {
  console.error(
    `WARNING: ${stagedDeletions.length} file(s) HEAD commits are absent from the index and were NOT scanned: ${nameSome(stagedDeletions)} — ` +
      `a partial checkout or staged deletions. Unless the deletions are intended (the release-strip rehearsal's are), ` +
      `this is a weaker run than the tree the push carries (F-424).`,
  );
}
// Skipped-as-binary files are named, not silently dropped from "N tracked files
// contain no …" — a coverage claim that quietly excludes files overstates the gate.
const skippedNote = skippedBinary.length
  ? ` ${skippedBinary.length} binary file(s) NOT scanned: ${skippedBinary.join(", ")}.`
  : "";
if (privatePatternCount === 0) {
  const weak =
    "no private pattern loaded — gs-admin-explorer.config.json was not found beside build/ or in the main checkout " +
    "and PRIVATE_INSTANCE_PATTERNS is empty, so this run checked the generic patterns ONLY " +
    "(a bare org slug with no tenant URL beside it passes).";
  if (requirePrivate) {
    // The caller declared that private patterns exist for this run (the workflow
    // sets REQUIRE_PRIVATE_PATTERNS only when its secret is present), so running
    // without them is a broken gate, not a weaker one — refuse rather than pass.
    console.error(`ERROR: ${weak} REQUIRE_PRIVATE_PATTERNS is set, so a run without them is refused.`);
    process.exit(1);
  }
  console.error(`WARNING: ${weak} If this machine keeps private patterns, this is a weaker run than the one you rely on (F-423).`);
}
console.log(
  `Instance-data check passed: ${files.length - skippedBinary.length} of ${files.length} tracked files scanned, ` +
    `${privatePatternCount} private pattern(s) loaded (${filePatterns.length} from gs-admin-explorer.config.json, ` +
    `${envPatterns.length} from PRIVATE_INSTANCE_PATTERNS), no tenant/instance/org-specific data.${skippedNote}`,
);
