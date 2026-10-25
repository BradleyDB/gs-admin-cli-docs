#!/usr/bin/env node
// Fixture tests for dev/hooks/pre-push — the leak gate between a clone and GitHub
// (F-584): WHICH commits the hook gates, judged independently of the hook's own
// reading, through real `git push --dry-run` runs with the hook installed.
//
// The judge (the F-584 builder brief, hb-20261024-02): a local bare repository
// stands in for origin; for each probe state the set of commits the hook gates (its
// own `pre-push:   <sha> <label>` lines) is compared with the set the receiving
// remote actually lacks, computed here from the bare repository's refs with
// `git rev-list <tip> --not <every sha its refs hold>`, plus the tip (gated in any
// case). The hook's comment block states the claim and its limits; this suite
// pins the claim within those limits:
//   1. A new ref over two new commits gates both, oldest first; a fast-forward of
//      an existing ref gates the one new commit; a new name over a commit the
//      remote already holds gates the tip alone (the "tip in any case" rule).
//   2. Tracking refs play no part (the hb-20261024-02 S3 and S3b probes): another
//      remote's tracking ref, or a stale tracking ref of the receiving remote,
//      pointing at the new commits leaves the gated set unchanged.
//   3. Fail closed (S4): when the remote holds a branch tip this clone has not
//      fetched (another clone pushed), a --force push is REFUSED naming the ref and
//      the recovery (`git fetch --tags <remote>`), nothing gated; after the fetch the
//      same push gates exactly the commits the remote lacks. A remote whose refs
//      cannot be read is refused on its own line (the hook run directly, since git
//      itself refuses an unreachable remote before any hook runs).
//   4. A multi-ref push gates each ref's own set (the ref list on stdin is never
//      consumed by a gate); a deletion gates nothing; an annotated tag gates its
//      peeled commit; a tag of a blob is refused as having no tree.
//   5. A planted private string (the kickoff's fictional PLANT, never a real one)
//      in an intermediate commit under a clean tip is refused on THAT commit
//      ("(pushed commit)"), the clean tip never reached; a planted tip is refused
//      as "(tip)"; and PLANT appears in no output of any run.
//   6. main stays blocked without ALLOW_MAIN_PUSH=1 and is gated with it.
//   7. Leftovers: after every group of runs `git worktree list` shows the clone alone
//      and no new gacd-prepush-* folder sits in the temp directory.
//   8. The judge is THIS clone's checker, staged beside the pushed tree: a pushed commit
//      whose own build/check-instance-data.mjs is a no-op and which carries a plant is
//      refused all the same, and a plant in the pushed build/lib.mjs is found.
// Every git run here is isolated from the developer's global and system config
// (GIT_CONFIG_GLOBAL points at an empty file, GIT_CONFIG_NOSYSTEM) and runs in the C
// locale, so a push.followTags or core.hooksPath setting, or a translated git message,
// cannot sway a verdict.
// The dev arm's doc gates (check-doc-drift, check-stale-facts on refs/heads/dev)
// run only when the pushed tree carries those scripts; the fixture tree does not,
// so that arm is read, not run, here. A keyboard Ctrl-C mid-gate is the tester's
// live arm.
//
// dev/hooks/pre-push ships nowhere (dev/ is stripped at release), so on a tree
// without it this suite has nothing to test and says so, exit 0. Zero dependencies.

import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { ROOT } from "./lib.mjs";
import { makeTempDir, removeTempDir, writeFiles, copyTrackedTree } from "../test/rig.mjs";

const HOOK = join(ROOT, "dev", "hooks", "pre-push");
if (!existsSync(HOOK)) {
  console.log("test-pre-push-hook: dev/hooks/pre-push is not in this tree (dev/ is stripped from a release tree) — nothing to test, 0 checks, exit 0");
  process.exit(0);
}

// Fictional, never a real org string; the suite's private pattern and the string
// planted in files. The real gate scans this file: the string is not a tenant URL,
// a user path or an email, and no private pattern of this repo names it. Assembled
// from parts so the literal is in no tracked file (hb-20261025-01's Noticed item 1:
// with the literal committed, a kickoff that named it as the pattern had every tree
// from that commit on refused, and an arm's refusal did not tell the plant from this line).
const PLANT = ["zz", "planted" + "org", "x"].join("-");

let passed = 0;
/** @type {string[]} */
const failures = [];
/** @param {string} name @param {boolean} cond @param {string} [detail] */
const ok = (name, cond, detail = "") => {
  if (cond) passed++;
  else failures.push(detail ? `${name} — ${detail}` : name);
};

// ── git plumbing: argv arrays; identity, signing and line endings pinned; the
// developer's global and system config shut out and the locale pinned to C ──
const GIT_PINS = [
  "-c", "core.autocrlf=false", "-c", "core.safecrlf=false",
  "-c", "user.name=rig", "-c", "user.email=rig@example.com",
  "-c", "commit.gpgsign=false", "-c", "tag.gpgsign=false",
  "-c", "init.defaultBranch=trunk",
];
/** Set once the scratch directory exists: an empty global config file inside it. */
let EMPTY_GITCONFIG = "";
/** The environment every git run (and the hook under it) sees. @param {Record<string, string>} [extra] */
function gitEnv(extra = {}) {
  const env = { ...process.env };
  // Windows names are case-insensitive: drop every spelling of what this suite pins.
  for (const k of Object.keys(env)) if (/^(private_instance_patterns|require_private_patterns|allow_main_push|git_config_global|git_config_nosystem|git_config_parameters|git_config_count|git_config_(key|value)_\d+|lc_all|lang|language)$/i.test(k)) delete env[k];
  return { ...env, GIT_CONFIG_GLOBAL: EMPTY_GITCONFIG, GIT_CONFIG_NOSYSTEM: "1", LC_ALL: "C", ...extra };
}
/** @param {string} cwd @param {string[]} args @param {{ env?: Record<string, string>, input?: string }} [opts] */
function git(cwd, args, opts = {}) {
  return spawnSync("git", [...GIT_PINS, ...args], { cwd, encoding: "utf8", env: gitEnv(), ...opts });
}
/** @param {string} cwd @param {...string} args */
function gitOk(cwd, ...args) {
  const r = git(cwd, args);
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} in ${cwd} failed (${r.status}): ${r.stderr}`);
  return r.stdout.trim();
}
/** Commit the given files (written then added) in cwd; returns the commit sha.
 * @param {string} cwd @param {Record<string, string>} files @param {string} msg */
function commit(cwd, files, msg) {
  writeFiles(cwd, files);
  gitOk(cwd, "add", "-A");
  gitOk(cwd, "commit", "-q", "-m", msg);
  return gitOk(cwd, "rev-parse", "HEAD");
}

// The environment every push runs with: the isolated git environment plus the suite's
// private pattern.
/** @param {Record<string, string>} [extra] */
const pushEnv = (extra = {}) => gitEnv({ PRIVATE_INSTANCE_PATTERNS: PLANT, ...extra });

// The set the hook gated, from its own per-commit lines, in order.
/** @param {string} stderr */
const gated = (stderr) => [...stderr.matchAll(/^pre-push: {3}([0-9a-f]{40}) /gm)].map((m) => m[1]);
// The counts the hook announced per ref: { "refs/heads/x": 2, ... }.
/** @param {string} stderr */
const announced = (stderr) => Object.fromEntries([...stderr.matchAll(/^pre-push: gating the (\d+) pushed tree\(s\) of (\S+) /gm)].map((m) => [m[2], Number(m[1])]));
// Independent of the hook: what the receiving remote lacks of <tip>'s history, oldest
// first, from the bare repository's own refs (tags peeled) — then the tip, last.
/** @param {string} clone @param {string} bare @param {string} tip */
function remoteLacksPlusTip(clone, bare, tip) {
  const held = gitOk(bare, "for-each-ref", "--format=%(objectname) %(*objectname)").split(/\s+/).filter(Boolean);
  const lacks = gitOk(clone, "rev-list", "--reverse", tip, ...held.map((s) => `^${s}`)).split("\n").filter(Boolean);
  return lacks.includes(tip) ? lacks : [...lacks, tip];
}
/** @param {string[]} a @param {string[]} b */
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
/** @param {{ stdout: string, stderr: string }} r */
const absent = (r) => !r.stdout.includes(PLANT) && !r.stderr.includes(PLANT);
/** @param {{ stdout: string, stderr: string }} r */
const out = (r) => (r.stderr + "\n" + r.stdout).replace(/\s+/g, " ").slice(0, 600);

const scratch = makeTempDir("pre-push-hook-test");
EMPTY_GITCONFIG = join(scratch, "gitconfig-empty");
writeFiles(scratch, { "gitconfig-empty": "" });
const tmp = tmpdir();
const prepushDirs = () => readdirSync(tmp).filter((n) => n.startsWith("gacd-prepush-"));
const dirsBefore = prepushDirs();
try {
  // ── the stand-in remote and the clones ─────────────────────────────────────
  const bare = join(scratch, "origin.git");
  mkdirSync(bare);
  gitOk(bare, "init", "-q", "--bare");
  const seed = join(scratch, "seed");
  mkdirSync(seed);
  gitOk(seed, "init", "-q");
  // The pushing clone's checker is what the hook stages beside every pushed tree, so
  // the fixture tree carries this repo's two files (working-tree versions).
  copyTrackedTree(ROOT, seed, (rel) => rel === "build/check-instance-data.mjs" || rel === "build/lib.mjs");
  const c0 = commit(seed, { "README.md": "a clean fixture tree\n" }, "c0");
  gitOk(seed, "remote", "add", "origin", bare);
  gitOk(seed, "push", "-q", "origin", "trunk", `${c0}:refs/heads/main`, `${c0}:refs/heads/gone`);

  const A = join(scratch, "A"); // the clone under test: the hook installed
  gitOk(scratch, "clone", "-q", bare, A);
  const hooksDir = join(A, ".git", "hooks");
  mkdirSync(hooksDir, { recursive: true });
  copyFileSync(HOOK, join(hooksDir, "pre-push"));
  chmodSync(join(hooksDir, "pre-push"), 0o755);
  const B = join(scratch, "B"); // another clone of the same remote, no hook
  gitOk(scratch, "clone", "-q", bare, B);

  /** A dry-run push from A through the installed hook.
   * @param {string[]} args @param {Record<string, string>} [extraEnv] */
  const push = (args, extraEnv = {}) =>
    git(A, ["-c", `core.hooksPath=${hooksDir}`, "push", "--dry-run", ...args], { env: pushEnv(extraEnv) });
  /** Leftover check after a run. @param {string} label */
  const clean = (label) => {
    const wts = gitOk(A, "worktree", "list").split("\n").filter(Boolean);
    const fresh = prepushDirs().filter((n) => !dirsBefore.includes(n));
    ok(`${label}: no temporary worktree or gacd-prepush-* folder left behind`, wts.length === 1 && fresh.length === 0, `${wts.length} worktree(s), ${fresh.join(",")}`);
  };

  // ── 1. which commits: new ref, fast-forward, new name over a held commit ───
  gitOk(A, "switch", "-q", "-c", "t1");
  const c1 = commit(A, { "a.md": "one\n" }, "c1");
  const c2 = commit(A, { "b.md": "two\n" }, "c2");
  let r = push(["origin", "t1"]);
  ok("1a a new ref over two new commits passes", r.status === 0 && /new branch/.test(r.stderr + r.stdout), out(r));
  ok("1a the gated set is exactly what the remote lacks, oldest first, tip last", same(gated(r.stderr), remoteLacksPlusTip(A, bare, c2)) && same(gated(r.stderr), [c1, c2]), gated(r.stderr).join(","));
  ok("1a the announced count matches", announced(r.stderr)["refs/heads/t1"] === 2, JSON.stringify(announced(r.stderr)));
  ok("1a the pass line is printed", /Instance-data check passed/.test(r.stderr), out(r));
  clean("1a");

  gitOk(A, "switch", "-q", "trunk");
  const c3 = commit(A, { "c.md": "three\n" }, "c3");
  r = push(["origin", "trunk"]);
  ok("1b a fast-forward of an existing ref gates the one new commit", r.status === 0 && same(gated(r.stderr), remoteLacksPlusTip(A, bare, c3)) && same(gated(r.stderr), [c3]), out(r));
  clean("1b");

  r = push(["origin", `${c0}:refs/heads/alias`]);
  ok("1c a new name over a commit the remote holds gates the tip alone", r.status === 0 && same(gated(r.stderr), [c0]) && announced(r.stderr)["refs/heads/alias"] === 1, out(r));
  clean("1c");

  // ── 2. tracking refs play no part (S3, S3b) ────────────────────────────────
  gitOk(A, "update-ref", "refs/remotes/zzfork/probe", c2);
  r = push(["origin", "t1"]);
  ok("2a another remote's tracking ref at the new commits leaves the gated set unchanged (S3)", r.status === 0 && same(gated(r.stderr), [c1, c2]), out(r));
  gitOk(A, "update-ref", "-d", "refs/remotes/zzfork/probe");
  gitOk(A, "update-ref", "refs/remotes/origin/t1", c2);
  r = push(["origin", "t1"]);
  ok("2b a stale tracking ref of the receiving remote at the new commits leaves the gated set unchanged (S3b)", r.status === 0 && same(gated(r.stderr), [c1, c2]), out(r));
  gitOk(A, "update-ref", "-d", "refs/remotes/origin/t1");
  // The remote's tags: an annotated tag is peeled to its commit; a tag of a blob is
  // dropped as holding no history. A plain fetch auto-follows only tags that point at
  // fetched commits, so the blob tag's target stays unfetched and the hook — which
  // cannot tell a missing blob from a missing commit — refuses with the --tags
  // recovery, which then brings it; after that neither tag changes the set.
  gitOk(B, "tag", "-a", "-m", "the other clone's tag", "v-other", c0);
  const otherBlob = git(B, ["hash-object", "-w", "--stdin"], { input: "a blob tagged on the remote\n" }).stdout.trim();
  gitOk(B, "tag", "-a", "-m", "a blob tag on the remote", "blob-other", otherBlob);
  gitOk(B, "push", "-q", "origin", "v-other", "blob-other");
  gitOk(A, "fetch", "-q", "origin");
  r = push(["origin", "t1"]);
  ok("2c a remote tag whose target a plain fetch did not bring is refused naming the tag and the --tags recovery", r.status !== 0 && gated(r.stderr).length === 0 && r.stderr.includes("refs/tags/blob-other at " + otherBlob.slice(0, 12)) && r.stderr.includes("git fetch --tags origin, then push again"), out(r));
  gitOk(A, "fetch", "-q", "--tags", "origin");
  r = push(["origin", "t1"]);
  ok("2d after the --tags fetch the annotated tag (peeled) and the blob tag leave the set unchanged", r.status === 0 && same(gated(r.stderr), [c1, c2]) && same(gated(r.stderr), remoteLacksPlusTip(A, bare, c2)), out(r));
  clean("2");

  // ── 1d. a remote with no refs yet: the whole history is new; and the PUSH url
  // is what is read (git hands the hook the push URL as $2; the fetch URL can differ) ─
  {
    const emptyBare = join(scratch, "empty.git");
    mkdirSync(emptyBare);
    gitOk(emptyBare, "init", "-q", "--bare");
    gitOk(A, "remote", "add", "zzempty", emptyBare);
    const r2 = push(["zzempty", "t1"]);
    ok("1d an empty remote lacks everything: every commit of the ref is gated, oldest first", r2.status === 0 && same(gated(r2.stderr), [c0, c1, c2]) && announced(r2.stderr)["refs/heads/t1"] === 3, out(r2));
    gitOk(A, "remote", "remove", "zzempty");
    clean("1d");
    gitOk(A, "remote", "set-url", "--push", "origin", emptyBare);
    const r3 = push(["origin", "t1"]);
    ok("1e with a push URL apart from the fetch URL, the set is read from the push URL (origin's fetch side holds c0; the push side holds nothing)", r3.status === 0 && same(gated(r3.stderr), [c0, c1, c2]), out(r3));
    gitOk(A, "config", "--unset", "remote.origin.pushurl"); // (set-url --push --delete reads its argument as a regex; a Windows path is not one)
    ok("1e (setup) the push URL is removed again", !gitOk(A, "remote", "get-url", "--push", "origin").includes("empty.git"));
    clean("1e");
  }

  // ── 3. fail closed (S4): the remote holds a tip this clone has not fetched ─
  gitOk(B, "switch", "-q", "trunk");
  const c4 = commit(B, { "d.md": "four, from the other clone\n" }, "c4");
  gitOk(B, "push", "-q", "origin", "trunk");
  r = push(["--force", "origin", "trunk"]);
  ok("3a a --force over a remote tip this clone lacks is refused, nothing gated", r.status !== 0 && gated(r.stderr).length === 0 && !/Instance-data check passed/.test(r.stderr), out(r));
  ok("3a the refusal names the ref, the commit and the recovery", r.stderr.includes("has not fetched") && r.stderr.includes("refs/heads/trunk at " + c4.slice(0, 12)) && r.stderr.includes("git fetch --tags origin, then push again"), out(r));
  clean("3a");
  gitOk(A, "fetch", "-q", "origin");
  r = push(["--force", "origin", "trunk"]);
  ok("3b after the fetch the same --force gates exactly what the remote lacks", r.status === 0 && same(gated(r.stderr), remoteLacksPlusTip(A, bare, c3)) && same(gated(r.stderr), [c3]) && /forced update/.test(r.stderr + r.stdout), out(r));
  clean("3b");
  // An unreadable remote: git refuses the push before any hook when it cannot connect,
  // so the hook's own refusal is reached by running it directly with the ref list on
  // stdin (what git would pass) and a remote nobody can read.
  const direct = git(A, ["-c", `alias.rig-hook=!sh "${join(hooksDir, "pre-push").replace(/\\/g, "/")}"`, "rig-hook", join(scratch, "no-such-remote.git"), "x"], {
    env: pushEnv(),
    input: `refs/heads/trunk ${c3} refs/heads/trunk ${c4}\n`,
  });
  ok("3c a remote whose refs cannot be read is refused on its own line, nothing gated", direct.status !== 0 && direct.stderr.includes("could not read the refs of") && gated(direct.stderr).length === 0, out(direct));
  clean("3c");

  // ── 4. several refs, a deletion, tags ──────────────────────────────────────
  // --force: trunk is behind the other clone's c4 now, and git drops a non-fast-forward
  // ref before any hook runs; the hook still gates only what the remote lacks ([c3]).
  r = push(["--force", "origin", "t1", "trunk"]);
  const ann = announced(r.stderr);
  ok("4a a multi-ref push gates each ref's own set (the stdin ref list is never consumed)", r.status === 0 && ann["refs/heads/t1"] === 2 && ann["refs/heads/trunk"] === 1 && same([...gated(r.stderr)].sort(), [c1, c2, c3].sort()), out(r));
  clean("4a");
  r = push(["origin", ":refs/heads/gone"]);
  ok("4b a deletion gates nothing and passes", r.status === 0 && gated(r.stderr).length === 0 && !/gating the/.test(r.stderr) && /deleted/.test(r.stderr + r.stdout), out(r));
  gitOk(A, "tag", "-a", "-m", "an annotated tag", "v-rig", c3);
  r = push(["origin", "v-rig"]);
  ok("4c an annotated tag gates its peeled commit as the tip", r.status === 0 && same(gated(r.stderr), [c3]) && /new tag/.test(r.stderr + r.stdout), out(r));
  const blob = git(A, ["hash-object", "-w", "--stdin"], { input: "a blob, not a commit\n" }).stdout.trim();
  gitOk(A, "tag", "-a", "-m", "a tag of a blob", "blob-rig", blob);
  r = push(["origin", "blob-rig"]);
  ok("4d a tag of a blob is refused as having no tree to gate", r.status !== 0 && r.stderr.includes("does not point at a commit") && gated(r.stderr).length === 0, out(r));
  clean("4");

  // ── 5. a planted string: intermediate commit, tip, S3 with a plant ─────────
  gitOk(A, "switch", "-q", "-c", "t2", c3);
  const c5 = commit(A, { "notes.md": `--kb ${PLANT}\n` }, "c5 carries the plant");
  gitOk(A, "rm", "-q", "notes.md");
  gitOk(A, "commit", "-q", "-m", "c6 clean tip");
  const c6 = gitOk(A, "rev-parse", "HEAD");
  r = push(["origin", "t2"]);
  ok("5a a planted intermediate commit under a clean tip is refused on that commit", r.status !== 0 && r.stderr.includes(`check-instance-data failed on refs/heads/t2 (pushed commit) (${c5})`), out(r));
  ok("5a the clean tip is never reached and the plant is in no output", !gated(r.stderr).includes(c6) && absent(r), out(r));
  clean("5a");
  gitOk(A, "update-ref", "refs/remotes/zzfork/probe", c6);
  r = push(["origin", "t2"]);
  ok("5b the same refusal with another remote's tracking ref at the clean tip (S3 with a plant)", r.status !== 0 && r.stderr.includes(`check-instance-data failed on refs/heads/t2 (pushed commit) (${c5})`) && absent(r), out(r));
  gitOk(A, "update-ref", "-d", "refs/remotes/zzfork/probe");
  gitOk(A, "switch", "-q", "-c", "t3", c3);
  const c7 = commit(A, { "tip.md": `--kb ${PLANT}\n` }, "c7 planted tip");
  r = push(["origin", "t3"]);
  ok("5c a planted tip is refused as the tip", r.status !== 0 && r.stderr.includes(`check-instance-data failed on refs/heads/t3 (tip) (${c7})`) && absent(r), out(r));
  // A replacement ref makes rev-list and a checkout see a clean stand-in while the push
  // sends the real object; the hook ignores replacements, so the planted tip is still refused.
  const c7clean = gitOk(A, "commit-tree", `${c3}^{tree}`, "-p", c3, "-m", "a clean stand-in for c7");
  gitOk(A, "replace", c7, c7clean);
  r = push(["origin", "t3"]);
  ok("5d a git replace of the planted tip by a clean commit does not change what is gated", r.status !== 0 && r.stderr.includes(`check-instance-data failed on refs/heads/t3 (tip) (${c7})`) && absent(r), out(r));
  gitOk(A, "replace", "-d", c7);
  // The two files the hook stages beside the pushed tree are scanned in their PUSHED
  // versions like any other tracked file: a plant in build/lib.mjs is refused.
  gitOk(A, "switch", "-q", "-c", "t4", c3);
  const libPath = join(A, "build", "lib.mjs");
  const libText = readFileSync(libPath, "utf8");
  writeFiles(A, { "build/lib.mjs": libText + `// --kb ${PLANT}\n` });
  gitOk(A, "add", "-A");
  gitOk(A, "commit", "-q", "-m", "c8 plants in lib.mjs");
  const c8 = gitOk(A, "rev-parse", "HEAD");
  writeFiles(A, { "build/lib.mjs": libText });
  gitOk(A, "add", "-A");
  gitOk(A, "commit", "-q", "-m", "c9 clean tip");
  r = push(["origin", "t4"]);
  ok("5e a plant in the pushed tree's own build/lib.mjs (an intermediate commit) is refused on that commit", r.status !== 0 && r.stderr.includes(`check-instance-data failed on refs/heads/t4 (pushed commit) (${c8})`) && absent(r), out(r));
  // A pushed tree whose own checker is a no-op, carrying a plant: the judge is the
  // checker of the checkout the push runs from (its working tree as it stands — the
  // hook's stated limit 5), so the push is made from trunk, whose checker is this repo's,
  // and is refused all the same.
  gitOk(A, "switch", "-q", "-c", "t5", c3);
  const c10 = commit(A, { "build/check-instance-data.mjs": "process.exit(0);\n", "notes.md": `--kb ${PLANT}\n` }, "c10 a no-op checker and a plant");
  gitOk(A, "switch", "-q", "trunk");
  r = push(["origin", `${c10}:refs/heads/t5`]);
  ok("5f a pushed tree whose own checker is a no-op is judged by the pushing checkout's checker and refused", r.status !== 0 && r.stderr.includes(`check-instance-data failed on refs/heads/t5 (tip) (${c10})`) && absent(r), out(r));
  // The same push made FROM that tree is judged by its no-op and passes: the limit, pinned,
  // so a reader of this suite sees what the hook does and does not promise.
  gitOk(A, "switch", "-q", "t5");
  r = push(["origin", "t5"]);
  ok("5g (the stated limit) the same push made from a checkout standing on the no-op checker is judged by it", r.status === 0 && gated(r.stderr).includes(c10) && !/Instance-data check passed/.test(r.stderr), out(r));
  gitOk(A, "switch", "-q", "trunk");
  clean("5");

  // ── 6. main ────────────────────────────────────────────────────────────────
  r = push(["origin", `${c3}:refs/heads/main`]);
  ok("6a a push to main is blocked without the override, nothing gated", r.status !== 0 && r.stderr.includes("direct push to main blocked") && gated(r.stderr).length === 0, out(r));
  r = push(["origin", `${c3}:refs/heads/main`], { ALLOW_MAIN_PUSH: "1" });
  ok("6b with ALLOW_MAIN_PUSH=1 main's tree is gated like any ref", r.status === 0 && same(gated(r.stderr), [c3]), out(r));
  clean("6");

  // ── 7. nothing reached the remote ──────────────────────────────────────────
  const heads = gitOk(bare, "for-each-ref", "--format=%(refname)").split("\n").sort();
  ok("7 every push above was a dry run: the remote holds the seeded refs and the other clone's pushes alone", same(heads, ["refs/heads/gone", "refs/heads/main", "refs/heads/trunk", "refs/tags/blob-other", "refs/tags/v-other"]), heads.join(","));
} finally {
  removeTempDir(scratch);
}

if (failures.length) {
  console.error(`test-pre-push-hook: ${failures.length} FAILED, ${passed} passed`);
  for (const f of failures) console.error(`  FAIL: ${f}`);
  process.exit(1);
}
console.log(`test-pre-push-hook: all ${passed} checks passed`);
