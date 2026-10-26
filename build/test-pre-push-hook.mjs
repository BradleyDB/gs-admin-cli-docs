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
//   8. The judge is THIS clone's checker, staged OUTSIDE the pushed tree (F-589): a pushed
//      commit whose own build/check-instance-data.mjs is a no-op and which carries a plant
//      is refused all the same, a plant in the pushed build/lib.mjs is found, and a tree
//      that tracks a symlink at the old staging path, with its own checker behind it, is
//      refused on its plant with the tree's module never run.
//   9. Beside the trees (F-588): a plant in an intermediate commit's MESSAGE, in an author
//      NAME, in an annotated TAG's message, or in a pushed ref's NAME is refused — the name
//      before the hook prints it anywhere. The judge: for every commit the push would
//      publish, the RAW object git stores (`git cat-file -p`) either carries PLANT or not;
//      the hook refuses exactly on the oldest carrier. A non-fictional address in an
//      identity passes (the private patterns alone run there), in a message it does not.
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

import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
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
  // The same push made FROM that tree: the checker standing in that checkout predates the hook's gates (it knows
  // none of the arguments — here a one-line no-op), so the hook refuses it by name before anything is gated — the
  // stated limit 5, pinned as a refusal, never a pass under a checker that cannot judge (the review's item 6).
  gitOk(A, "switch", "-q", "t5");
  r = push(["origin", "t5"]);
  ok("5g (the stated limit) a push made from a checkout whose checker predates the gates is refused outright, naming the checker and the recovery, nothing gated", r.status !== 0 && r.stderr.includes("predates the hook's gates") && r.stderr.includes("pull dev into this branch") && gated(r.stderr).length === 0 && !/gating the/.test(r.stderr), out(r));
  gitOk(A, "switch", "-q", "trunk");
  clean("5");

  // ── 6. main ────────────────────────────────────────────────────────────────
  r = push(["origin", `${c3}:refs/heads/main`]);
  ok("6a a push to main is blocked without the override, nothing gated", r.status !== 0 && r.stderr.includes("direct push to main blocked") && gated(r.stderr).length === 0, out(r));
  r = push(["origin", `${c3}:refs/heads/main`], { ALLOW_MAIN_PUSH: "1" });
  ok("6b with ALLOW_MAIN_PUSH=1 main's tree is gated like any ref", r.status === 0 && same(gated(r.stderr), [c3]), out(r));
  clean("6");

  // ── 8. the staging path cannot be pre-planted by the pushed tree (F-589) ───
  // A tree tracking a symlink at the hook's former staging path (.gacd-prepush-gate/),
  // pointing at a checker of its own that prints a marker and exits 0, plus a plant: the
  // checker is staged outside every worktree now, so the plant is found and the marker
  // never prints. On a clone that checks symlinks out as symlinks (ubuntu) the link is
  // real; on this host it is a text file — refused either way, and meaningful there.
  gitOk(A, "switch", "-q", "-c", "t6", c3);
  const linkBlob = git(A, ["hash-object", "-w", "--stdin"], { input: "../sub/check-instance-data.mjs" }).stdout.trim();
  writeFiles(A, { "sub/check-instance-data.mjs": "console.log('MARKER-the-trees-own-checker-ran'); process.exit(0);\n", "sub/lib.mjs": "export const ROOT = '';\n", "notes.md": `--kb ${PLANT}\n` });
  gitOk(A, "add", "-A");
  gitOk(A, "update-index", "--add", "--cacheinfo", `120000,${linkBlob},.gacd-prepush-gate/check-instance-data.mjs`);
  gitOk(A, "commit", "-q", "-m", "c11 a symlink at the old staging path");
  const c11 = gitOk(A, "rev-parse", "HEAD");
  r = push(["origin", "t6"]);
  ok("8a a pushed tree tracking a symlink at the old staging path, its own checker behind it, is judged by this clone's checker from outside the tree and refused on its plant; the tree's module never runs", r.status !== 0 && r.stderr.includes(`check-instance-data failed on refs/heads/t6 (tip) (${c11})`) && !/MARKER-the-trees-own-checker-ran/.test(r.stderr + r.stdout) && absent(r), out(r));
  clean("8a");

  // ── 9. beside the trees (F-588): messages, identities, tag objects, ref names ─
  // The judge: of the commits a push would publish (the remote's own refs, as above), the
  // ones whose RAW object (`git cat-file -p`: headers, identities, message) carries PLANT.
  /** @param {string} tip */
  const carriers = (tip) => remoteLacksPlusTip(A, bare, tip).filter((s) => gitOk(A, "cat-file", "-p", s).includes(PLANT));
  const LEAKY_MAIL = "ops@" + "leakycorp" + ".net";
  gitOk(A, "switch", "-q", "-c", "t7", c3);
  const c12 = commit(A, { "m.md": "clean\n" }, `c12 names the --kb ${PLANT} folder in its message`);
  const c13 = commit(A, { "n.md": "clean too\n" }, "c13 clean tip");
  r = push(["origin", "t7"]);
  ok("9a a plant in an intermediate commit's MESSAGE under clean trees is refused on that commit, named as its message", r.status !== 0 && r.stderr.includes(`check-instance-data failed on refs/heads/t7 (pushed commit) (${c12})`) && /commit [0-9a-f]{12} message:1: private pattern/.test(r.stderr) && same(carriers(c13), [c12]) && absent(r), out(r));
  clean("9a");
  gitOk(A, "switch", "-q", "-c", "t8", c3);
  writeFiles(A, { "o.md": "clean\n" });
  gitOk(A, "add", "-A");
  gitOk(A, "-c", `user.name=Pat ${PLANT}`, "commit", "-q", "-m", "c14 a planted author");
  const c14 = gitOk(A, "rev-parse", "HEAD");
  r = push(["origin", "t8"]);
  ok("9b a plant in the author's name is refused on that commit, named as its identities", r.status !== 0 && r.stderr.includes(`(tip) (${c14})`) && /commit [0-9a-f]{12} identities:1: private pattern/.test(r.stderr) && same(carriers(c14), [c14]) && absent(r), out(r));
  clean("9b");
  gitOk(A, "switch", "-q", "-c", "t9", c3);
  writeFiles(A, { "p.md": "clean\n" });
  gitOk(A, "add", "-A");
  gitOk(A, "-c", `user.email=${LEAKY_MAIL}`, "commit", "-q", "-m", "c15 a non-fictional committer address");
  const c15 = gitOk(A, "rev-parse", "HEAD");
  r = push(["origin", "t9"]);
  ok("9c an identity's own non-fictional address passes (the private patterns alone judge identities)", r.status === 0 && same(gated(r.stderr), remoteLacksPlusTip(A, bare, c15)) && gated(r.stderr).includes(c15) && /2 extra text\(s\) scanned beside the tree/.test(r.stderr), out(r));
  const c16 = commit(A, { "q.md": "clean\n" }, `c16 asks ${LEAKY_MAIL} about it`);
  r = push(["origin", "t9"]);
  ok("9d the same address in a commit MESSAGE is refused (every check runs on a message)", r.status !== 0 && r.stderr.includes(`(tip) (${c16})`) && r.stderr.includes(`message:1: email address: "${LEAKY_MAIL}"`), out(r));
  clean("9d");
  gitOk(A, "tag", "-a", "-m", `release notes mention --kb ${PLANT}`, "v-planted", c3);
  r = push(["origin", "v-planted"]);
  ok("9e an annotated tag whose message carries the plant is refused on the tag object (its body), nothing gated", r.status !== 0 && /check-instance-data failed on the tag object [0-9a-f]{12} of refs\/tags\/v-planted/.test(r.stderr) && /tag [0-9a-f]{12} body:1: private pattern/.test(r.stderr) && gated(r.stderr).length === 0 && gitOk(A, "cat-file", "-p", "v-planted").includes(PLANT) && absent(r), out(r));
  gitOk(A, "-c", `user.name=Pat ${PLANT}`, "tag", "-a", "-m", "a clean message", "v-tagger", c3);
  r = push(["origin", "v-tagger"]);
  ok("9f a plant in the tagger's name is refused on the tag object (its header)", r.status !== 0 && /check-instance-data failed on the tag object [0-9a-f]{12} of refs\/tags\/v-tagger/.test(r.stderr) && /tag [0-9a-f]{12} header:\d+: private pattern/.test(r.stderr) && absent(r), out(r));
  clean("9f");
  r = push(["origin", `${c3}:refs/heads/zz-${PLANT}-x`]);
  const hookLines = r.stderr.split("\n").filter((l) => l.startsWith("pre-push:"));
  ok("9g a ref NAME carrying the plant is refused before the hook prints the name anywhere: no gating line, the hook's lines free of it", r.status !== 0 && hookLines.some((l) => l.includes("the name of a pushed ref carries text")) && !hookLines.some((l) => l.includes("gating the")) && hookLines.every((l) => !l.includes(PLANT)) && !r.stdout.includes(PLANT), out(r));
  clean("9g");
  // The review's items 1 to 4: a tag message git accepts with a NUL byte, or beginning with the two bytes of a UTF-16
  // mark, is decoded as UTF-8 and scanned (the tree's binary sniff would read an empty text or a wrong decoding); a
  // tag of a tag is peeled and the inner object gated; the name STORED in a tag object is gated with its header,
  // whatever ref name the push uses.
  // (the file is not named nul.txt: on Windows that name is the NUL device, and nothing is written)
  writeFiles(A, { "zero-byte-message.txt": Buffer.from(`release notes --kb ${PLANT}\0tail\n`, "utf8") });
  gitOk(A, "tag", "-a", "-F", join(A, "zero-byte-message.txt"), "v-nul", c3);
  r = push(["origin", "v-nul"]);
  ok("9h a tag message carrying a NUL byte is still scanned (never read as a binary and skipped): refused on the tag object", r.status !== 0 && r.stderr.includes("check-instance-data failed on the tag object") && absent(r), out(r));
  writeFiles(A, { "bom.txt": Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(`--kb ${PLANT}\n`, "utf8")]) });
  gitOk(A, "tag", "-a", "-F", join(A, "bom.txt"), "v-bom", c3);
  r = push(["origin", "v-bom"]);
  ok("9i a tag message beginning with the two bytes of a UTF-16 mark is decoded as UTF-8 and the plant found: refused on the tag object", r.status !== 0 && r.stderr.includes("check-instance-data failed on the tag object") && absent(r), out(r));
  gitOk(A, "tag", "-a", "-m", `inner notes --kb ${PLANT}`, "v-inner", c3);
  gitOk(A, "tag", "-a", "-m", "a clean outer tag", "v-outer", "v-inner");
  r = push(["origin", "v-outer"]);
  ok("9j a tag of a tag: the inner tag object the push carries is gated too (peeled object by object), refused on it", r.status !== 0 && r.stderr.includes("check-instance-data failed on the tag object") && gated(r.stderr).length === 0 && absent(r), out(r));
  gitOk(A, "tag", "-a", "-m", "a clean message", `zz-${PLANT}-named`, c3);
  gitOk(A, "tag", "v-alias", `refs/tags/zz-${PLANT}-named`);
  r = push(["origin", "v-alias"]);
  ok("9k the name STORED in a tag object (not the ref name the push uses) is gated with the object's header: refused, the stored name unprinted", r.status !== 0 && r.stderr.includes("check-instance-data failed on the tag object") && absent(r), out(r));
  clean("9k");
  // The review's item 5: the pushed tree cannot supply the checker's private list. The MAIN checkout's config
  // (A's, untracked and excluded) holds the real pattern; the pushed tree force-adds a decoy config whose one
  // pattern matches nothing, beside a plant; the push runs with NO environment pattern. The main config must judge.
  writeFiles(A, { "gs-admin-explorer.config.json": JSON.stringify({ privateInstancePatterns: [PLANT] }) });
  writeFiles(join(A, ".git", "info"), { exclude: "gs-admin-explorer.config.json\n" });
  gitOk(A, "switch", "-q", "-c", "t10", c3);
  writeFiles(A, { "notes.md": `--kb ${PLANT}\n` });
  gitOk(A, "add", "-A");
  gitOk(A, "add", "-f", "gs-admin-explorer.config.json");
  gitOk(A, "-c", "core.autocrlf=false", "commit", "-q", "-m", "c17 a decoy config and a plant");
  // The tracked copy is the decoy; the working copy stays the real one for the main checkout's lookup.
  writeFiles(A, { "gs-admin-explorer.config.json": JSON.stringify({ privateInstancePatterns: ["zz-nothing-matches-anything"] }) });
  gitOk(A, "add", "-f", "gs-admin-explorer.config.json");
  gitOk(A, "commit", "-q", "--amend", "--no-edit");
  writeFiles(A, { "gs-admin-explorer.config.json": JSON.stringify({ privateInstancePatterns: [PLANT] }) });
  const c17 = gitOk(A, "rev-parse", "HEAD");
  const noEnv = /** @type {Record<string, string>} */ (gitEnv());
  delete noEnv.PRIVATE_INSTANCE_PATTERNS;
  r = git(A, ["-c", `core.hooksPath=${hooksDir}`, "push", "--dry-run", "origin", "t10"], { env: noEnv });
  ok("9l a pushed tree that force-adds a decoy config does not supply the checker's private list: the main checkout's config judges (the hit attributed to the local config's entry 1) and the plant is refused", r.status !== 0 && r.stderr.includes(`check-instance-data failed on refs/heads/t10 (tip) (${c17})`) && r.stderr.includes("private pattern (local gs-admin-explorer.config.json entry 1): [match redacted]") && absent(r), out(r));
  gitOk(A, "checkout", "-q", "--", "gs-admin-explorer.config.json");
  gitOk(A, "switch", "-q", "trunk");
  rmSync(join(A, "gs-admin-explorer.config.json"), { force: true });
  rmSync(join(A, ".git", "info", "exclude"), { force: true });
  clean("9l");

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
