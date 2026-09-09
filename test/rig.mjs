// ─────────────────────────────────────────────────────────────────────────────
// test/rig.mjs — the shared test rig (GP-B5 DS-22): temp-dir lifecycle +
// spawnSync plumbing ONLY, for both test lanes (plugins/gs-superadmin/test/
// and build/test-*.mjs).
//
// SCOPE RULE (R-10, the seam register's test-lane exemption — carve-out quoted
// verbatim; the rig must never grow past it):
//
//   "Refactorable at the RIG level only: a shared harness could own temp-dir
//    lifecycle/spawn plumbing while assertions stay independently derived
//    (taxonomy #5: 'it standardizes the rig, not the honesty'). D1 decides;
//    the exemption's rationale must survive any consolidation."
//
// And the exemption's own rationale, from the same register entry (check 9's
// exclusion text): "tests deliberately re-derive mechanisms as independent
// probes (the bus's Class B standard) and are not consumer surface." — "an
// independent probe that re-derives the expectation catches a shared-helper
// bug that a helper-importing test would inherit silently."
//
// Consequences of that rule, spelled out:
//   - NO assertion logic here, ever — no check()/ok() helpers, no expectation
//     builders, no output matchers. Each suite derives and owns its verdicts.
//   - NO re-exports of the primitives under test (doc-lib etc.) — a suite that
//     reached its subject through the rig would inherit the rig's resolution
//     bugs invisibly.
//   - Existing suites are NOT migrated onto this rig wholesale (DS-22 build
//     note): a suite adopts it only when a later wave touches that suite
//     anyway.
//
// This file ships nowhere (not plugin surface, not build surface); it is repo
// test infrastructure. Import topology: declared as its own lane ("test-rig",
// imports nothing local) in build/check-imports.mjs; both test lanes may
// import it.
//
// Spawning follows the T-7 convention (doc-lib portability header): argv
// arrays, shell:false — never a shell string.
//
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync, execFileSync } from "node:child_process";

// ── Temp-dir lifecycle ───────────────────────────────────────────────────────

// Fresh directory under the OS temp dir. Caller owns removal (try/finally
// around removeTempDir — the suites' idiom).
export function makeTempDir(prefix) {
  return mkdtempSync(join(tmpdir(), `${prefix}-`));
}

// Bounded-retry removal: on the windows CI leg a just-exited child (or an AV
// scan window) can hold the rig dir and make an unretried rmSync throw from a
// finally — which both flakes a green run AND masks the suite's real FAIL
// summary on a red one (B2 review, finder A). Retries absorb the transient
// hold; a final failure is reported LOUDLY but does not replace the suite's
// own verdict — a leaked dir under the OS temp root is the lesser harm.
export function removeTempDir(dir) {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  } catch (e) {
    console.error(`rig: could not remove temp dir ${dir} (${e?.code ?? e}) — leaked, but the suite verdict stands`);
  }
}

// ── Fixture-tree writing ─────────────────────────────────────────────────────

// files: { "rel/path": string | Buffer }. Parent directories are created.
// Strings are written as UTF-8 exactly as given (no BOM, no EOL rewriting) —
// encoding variants are the SUITE's business: pass a Buffer.
export function writeFiles(root, files) {
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
}

// ── Spawn plumbing ───────────────────────────────────────────────────────────

// spawnSync a Node script with argv-array discipline. Returns the spawnSync
// result ({ status, stdout, stderr, … }), utf8-decoded. opts passes through
// (cwd, env, input, …); env defaults to the parent's.
export function runNode(scriptPath, args = [], opts = {}) {
  return spawnSync(process.execPath, [scriptPath, ...args], { encoding: "utf8", ...opts });
}

// ── Scratch git repos (for checks that root themselves and run git ls-files) ─

// git init + add everything currently in dir. -c core.autocrlf=false and
// -c core.safecrlf=false: the rig never checks files out again, and a global
// autocrlf=true (or a copied .gitattributes normalizing on add) otherwise
// spams LF/CRLF warnings into every run (test-check-instance-data precedent).
export function initScratchGitRepo(dir) {
  execFileSync("git", ["init", "-q"], { cwd: dir });
  gitAddAll(dir);
}

export function gitAddAll(dir) {
  execFileSync("git", ["-c", "core.autocrlf=false", "-c", "core.safecrlf=false", "add", "-A"], { cwd: dir });
}

// Tracked files of a real repo checkout, as repo-relative POSIX paths
// (argv-array execFileSync — an unquoted pathspec through a shell glob-expands
// at the repo root on POSIX, the F-095 doctrine). Internal: consumed by
// copyTrackedTree; not exported until a suite needs it directly.
function listTrackedFiles(repoRoot) {
  return execFileSync("git", ["ls-files", "-z"], { cwd: repoRoot, encoding: "utf8" })
    .split("\0")
    .filter(Boolean)
    .map((f) => f.replace(/\\/g, "/"));
}

// Copy the WORKING-TREE version of every tracked file (optionally filtered)
// from a real checkout into destDir, preserving relative paths. Returns the
// copied list. Working-tree versions on purpose: a suite testing an edited
// checker must see the edit, not HEAD.
/**
 * @param {string} repoRoot
 * @param {string} destDir
 * @param {(rel: string) => boolean} [filter] repo-relative POSIX path → keep?
 *   (the default keeps everything; declared here because the checker infers
 *   `() => boolean` from the zero-arg default alone — TypeScript 7 rejects a
 *   one-arg caller against that inference, W8.5/DS-51)
 * @returns {string[]} the copied repo-relative paths
 */
export function copyTrackedTree(repoRoot, destDir, filter = () => true) {
  const files = listTrackedFiles(repoRoot).filter(filter);
  for (const rel of files) {
    const abs = join(destDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    copyFileSync(join(repoRoot, rel), abs);
  }
  return files;
}

// ── In-memory snapshot/restore (mutation-rig lifecycle) ──────────────────────

// Snapshot files as Buffers BEFORE a mutation pass; restore() puts the exact
// bytes back. This is the A-11 restore discipline as plumbing (in-memory
// snapshot, never `git checkout`): a mutation rig that restores via git
// silently discards any uncommitted state it was actually testing.
export function snapshotFiles(paths) {
  const saved = paths.map((p) => [p, readFileSync(p)]);
  return {
    restore() {
      for (const [p, buf] of saved) writeFileSync(p, buf);
    },
  };
}
