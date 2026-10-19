#!/usr/bin/env node
// Fixture tests for build/run-battery.mjs (F-569): the battery runner's claims,
// each pinned where a mutant would be silent — the steps run in a TEMPORARY
// WORKTREE and the working tree is byte-unchanged after a run (the two damaged
// trees F-569 records), the depth-limited fetch is substituted away, the first
// red stops the run, CI-only steps are skipped by name with their reason, the
// `if:` arms follow the chosen tree, a missing command reads INCOMPLETE, an
// expression the evaluator cannot read is refused by name, and — on the REAL
// tree — every test runner on disk is invoked by some CI step (the F-402
// class: a suite listed in AGENTS.md's fence and never run in CI).
//
// The scratch repository's two workflow files use the YAML subset the real
// ones use; the extractor's reading of the REAL files is the closure arm.
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT } from "./lib.mjs";
import { readPlan, extractSteps, evaluateIf, CI_ONLY_STEPS, WORKFLOWS } from "./run-battery.mjs";
import { makeTempDir, removeTempDir, writeFiles, runNode, initScratchGitRepo } from "../test/rig.mjs";

const RUNNER = join(ROOT, "build", "run-battery.mjs");
let passed = 0;
const failures = [];
const ok = (name, cond, detail) => {
  if (cond) passed++;
  else { failures.push(name); console.error(`FAIL: ${name}`); if (detail) console.error("  " + String(detail).slice(0, 1200)); }
};
// The scratch repo's committer is the fictional tenant's address (AGENTS.md "Data hygiene": the instance-data gate reads any other address as real).
const git = (dir, args) => execFileSync("git", ["-c", "user.name=rig", "-c", "user.email=rig@acme.com", "-c", "commit.gpgsign=false", ...args], { cwd: dir, encoding: "utf8" }).trim();

// The fixture workflows: one CI-only step by its real name, a step whose
// `--depth=1` must be substituted away, a step that WRITES into the tree, a
// stripped-arm step that `git rm`s dev/ (the destructive one), a step gated on
// a GitHub context, a failing step and a step that must never run after it,
// and a step whose tool is absent.
const VALIDATE_YML = `name: validate-plugin

on:
  pull_request:
  push:
    branches: [main, dev]

jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      run: \${{ steps.decide.outputs.run }}
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 2
      - name: Decide whether any plugin-affecting path changed
        id: decide
        env:
          EVENT: \${{ github.event_name }}
        run: |
          echo "run=true" >> "$GITHUB_OUTPUT"

  validate:
    needs: changes
    if: needs.changes.outputs.run == 'true'
    strategy:
      fail-fast: false
      matrix:
        os: \${{ fromJSON('["ubuntu-latest"]') }}
    runs-on: \${{ matrix.os }}
    defaults:
      run:
        shell: bash
    steps:
      - uses: actions/checkout@v7
      # A comment between steps.
      - name: Echo a depth-limited fetch
        run: echo git fetch --no-tags --depth=1 origin +refs/heads/dev:refs/remotes/origin/dev
      - name: Write into the tree
        run: |
          # a comment inside the block
          node -e "require('fs').writeFileSync('generated.txt', 'rewritten by the battery')"
          cat tracked.txt
          node -e "console.log('cwd=' + process.cwd())"
      - name: Install Claude Code
        run: exit 9

  manifests:
    needs: changes
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - name: Tool that is absent
        run: no-such-tool-f569 --version
`;

const DRIFT_YML = `name: docs-drift

on:
  pull_request:

jobs:
  drift:
    strategy:
      matrix:
        tree: \${{ fromJSON('["full"]') }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - name: Strip dev-only content (release-tree rehearsal arm)
        if: matrix.tree == 'stripped'
        run: |
          git rm -r -q -- dev
          test ! -e dev/FEEDBACK.md
      - name: Keep going
        run: echo keep-going
      - name: Full-arm only
        if: matrix.tree == 'full'
        run: echo full-arm
      - name: No dev-only content on main
        if: github.base_ref == 'main' || github.ref == 'refs/heads/main' || matrix.tree == 'stripped'
        run: test ! -e dev
      - name: Failing step
        run: |
          echo about to fail
          exit 7
      - name: After the failure
        run: echo MUST-NOT-RUN
`;

const scratch = makeTempDir("f569-battery");
try {
  writeFiles(scratch, {
    ".github/workflows/validate-plugin.yml": VALIDATE_YML,
    ".github/workflows/docs-drift.yml": DRIFT_YML,
    "tracked.txt": "committed content\n",
    "generated.txt": "committed generated\n",
    "dev/FEEDBACK.md": "# bus\n",
  });
  initScratchGitRepo(scratch);
  git(scratch, ["commit", "-q", "-m", "fixture"]);
  const sha = git(scratch, ["rev-parse", "--short", "HEAD"]);
  const statusBefore = git(scratch, ["status", "--porcelain"]);
  const run = (args) => runNode(RUNNER, ["--repo", scratch, ...args], { cwd: scratch, maxBuffer: 64 << 20 });
  const lastLine = (s) => s.trim().split(/\r?\n/).pop() ?? "";

  // ── A. the plan (--list): decisions by name, per tree ───────────────────
  const full = readPlan(scratch, { tree: "full" });
  const byName = (list, name) => list.find((p) => p.step.name === name);
  ok("A1 every run: step is extracted in file order", full.map((p) => p.step.name).join("|") ===
    ["Decide whether any plugin-affecting path changed", "Echo a depth-limited fetch", "Write into the tree", "Install Claude Code", "Tool that is absent",
      "Strip dev-only content (release-tree rehearsal arm)", "Keep going", "Full-arm only", "No dev-only content on main", "Failing step", "After the failure"].join("|"),
    full.map((p) => p.step.name).join("|"));
  ok("A2 the CI-only steps are skipped by exact name with the table's reason",
    byName(full, "Install Claude Code")?.decision === "ci-only" && byName(full, "Install Claude Code")?.why === CI_ONLY_STEPS["Install Claude Code"] &&
    byName(full, "Decide whether any plugin-affecting path changed")?.decision === "ci-only");
  ok("A3 full tree: the stripped-arm steps are off, the full-arm step is on", byName(full, "Strip dev-only content (release-tree rehearsal arm)")?.decision === "if-false" &&
    byName(full, "No dev-only content on main")?.decision === "if-false" && byName(full, "Full-arm only")?.decision === "run");
  const stripped = readPlan(scratch, { tree: "stripped" });
  ok("A4 stripped tree: the strip and the main-only check run, the full-arm step is off", byName(stripped, "Strip dev-only content (release-tree rehearsal arm)")?.decision === "run" &&
    byName(stripped, "No dev-only content on main")?.decision === "run" && byName(stripped, "Full-arm only")?.decision === "if-false");
  ok("A5 the depth-limited fetch is substituted away and the substitution is recorded",
    !byName(full, "Echo a depth-limited fetch")?.run.includes("--depth") && byName(full, "Echo a depth-limited fetch")?.substituted.length === 1 &&
    byName(full, "Keep going")?.substituted.length === 0);
  ok("A6 a block scalar keeps its lines and drops its indent", byName(full, "Write into the tree")?.run === '# a comment inside the block\nnode -e "require(\'fs\').writeFileSync(\'generated.txt\', \'rewritten by the battery\')"\ncat tracked.txt\nnode -e "console.log(\'cwd=\' + process.cwd())"\n',
    JSON.stringify(byName(full, "Write into the tree")?.run));
  ok("A7 --steps filters by case-insensitive substring and marks the rest filtered",
    readPlan(scratch, { tree: "full", matches: ["KEEP", "echo a depth"] }).filter((p) => p.decision === "run").map((p) => p.step.name).join("|") === "Echo a depth-limited fetch|Keep going");
  const list = run(["--list"]);
  ok("A8 --list prints the table and the plan line", list.status === 0 && /^run\s+docs-drift\.yml\s+drift\s+Keep going$/m.test(list.stdout) &&
    /^ci-only\s+validate-plugin\.yml\s+validate\s+Install Claude Code/m.test(list.stdout) && /^battery plan: 7 to run, 2 ci-only, 2 off this arm \(tree full\), 0 filtered$/m.test(list.stdout),
    list.stdout + list.stderr);
  ok("A9 evaluateIf reads the grammar the workflows use and refuses what it cannot",
    evaluateIf("matrix.tree == 'full'", { tree: "full" }) === true && evaluateIf("matrix.tree != 'full'", { tree: "full" }) === false &&
    evaluateIf("github.base_ref == 'main' || matrix.tree == 'stripped'", { tree: "stripped" }) === true &&
    evaluateIf("github.base_ref == 'main' || github.ref == 'refs/heads/main'", { tree: "full" }) === false &&
    evaluateIf("matrix.tree == 'full' && github.event_name != 'schedule'", { tree: "full" }) === true &&
    (() => { try { evaluateIf("contains(github.ref, 'x')", { tree: "full" }); return false; } catch (e) { return /contains\(github\.ref/.test(String(e)); } })());

  // ── B. a full-tree run: the worktree, the substitution, fail-fast, the log ─
  const logB = join(scratch, "..", `f569-battery-B-${process.pid}.log`);
  const wtB = join(scratch, "..", `f569-battery-wt-B-${process.pid}`);
  const B = run(["--log", logB, "--worktree-dir", wtB]);
  const logText = existsSync(logB) ? readFileSync(logB, "utf8") : "";
  // 7 steps planned on the full arm; the absent tool (3/7) is skipped, so 4 pass before the red 6/7.
  ok("B1 exit 1 and the summary names the first red step, its index and the count before it", B.status === 1 &&
    lastLine(B.stdout) === `battery: FAIL at step 6/7 "Failing step" - 4 passed before it, tree full, ref ${sha}, ${lastLine(B.stdout).match(/, (\d+m\d\ds|\d+s)$/)?.[1]}`,
    B.stdout + B.stderr);
  ok("B2 the step after the red one never ran (fail-fast)", !logText.includes("MUST-NOT-RUN") && !B.stdout.includes("After the failure"), logText.slice(-600));
  ok("B3 the working tree is byte-unchanged after the run (the steps ran in the worktree)",
    readFileSync(join(scratch, "generated.txt"), "utf8") === "committed generated\n" && git(scratch, ["status", "--porcelain"]) === statusBefore,
    git(scratch, ["status", "--porcelain"]));
  ok("B4 the worktree was removed and the repository is not shallow", !existsSync(wtB) && git(scratch, ["rev-parse", "--is-shallow-repository"]) === "false" &&
    !git(scratch, ["worktree", "list"]).includes("f569-battery-wt-B"));
  ok("B5 the log stamps START and PASS/FAIL per step with times and records the substitution",
    /\[\d\d:\d\d:\d\d\] START 1\/7 Echo a depth-limited fetch/.test(logText) && /\[\d\d:\d\d:\d\d\] PASS 1\/7 Echo a depth-limited fetch \((\d+m\d\ds|\d+s)\)/.test(logText) &&
    /\[\d\d:\d\d:\d\d\] FAIL 6\/7 Failing step \(exit 7, (\d+m\d\ds|\d+s)\)/.test(logText) && /SUBSTITUTED in "Echo a depth-limited fetch"/.test(logText) &&
    /\[\d\d:\d\d:\d\d\] SKIP 3\/7 Tool that is absent — command not found: no-such-tool-f569/.test(logText) &&
    /^\s+\$ echo git fetch --no-tags origin \+refs\/heads\/dev:refs\/remotes\/origin\/dev$/m.test(logText) && !/--depth/.test(logText), logText);
  // The step prints its cwd (the worktree's absolute path, in Node's spelling);
  // the log must carry the token in its place. The first sweep's M10 (mask
  // removed) SURVIVED because no fixture step printed a path — the arm was
  // vacuous; the cwd line is what makes it bite.
  ok("B6 the step ran the COMMITTED tree in a masked location: the worktree's own path is masked in the log and no absolute path of the worktree or the repository reaches it",
    logText.includes("committed content") && /^\s+cwd=<worktree>$/m.test(logText) &&
    !logText.includes(scratch) && !logText.includes(scratch.replace(/\\/g, "/")) && !logText.includes(wtB) && !logText.includes(wtB.replace(/\\/g, "/")),
    logText);
  ok("B7 the red step's output tail is shown on the console", B.stdout.includes("about to fail"), B.stdout);

  // ── C. the stripped arm: the destructive step runs in the worktree only ──
  const C = run(["--tree", "stripped", "--steps", "Strip,Keep going,No dev-only"]);
  ok("C1 the strip ran (and its survivor check passed) in the worktree; the summary says filtered", C.status === 0 &&
    /^battery: PASS - 3\/3 steps run \(2 ci-only skipped\), tree stripped, ref \w+, (\d+m\d\ds|\d+s) \(filtered to 3 of 8 steps\)$/.test(lastLine(C.stdout)), C.stdout + C.stderr);
  ok("C2 dev/ is still in the working tree after the stripped arm", existsSync(join(scratch, "dev", "FEEDBACK.md")) && git(scratch, ["status", "--porcelain"]) === statusBefore);

  // ── D. a missing command is INCOMPLETE, never PASS ──────────────────────
  const D = run(["--steps", "Tool that is absent,Keep going"]);
  ok("D1 exit 2 and the summary names the missing command", D.status === 2 &&
    /^battery: INCOMPLETE - 1\/2 steps run, 1 skipped for a missing command \(no-such-tool-f569\), tree full/.test(lastLine(D.stdout)), D.stdout + D.stderr);

  // ── E. the dirty-tree note and the committed ref ────────────────────────
  writeFileSync(join(scratch, "tracked.txt"), "uncommitted edit\n");
  const E = run(["--steps", "Write into the tree"]);
  ok("E1 an uncommitted edit is named and the battery ran the committed content", E.status === 0 && /uncommitted changes to tracked files; the battery runs the committed HEAD/.test(E.stdout) &&
    !E.stdout.includes("uncommitted edit"), E.stdout);
  const logE = readFileSync(lastLineLog(E.stdout), "utf8");
  ok("E2 the log shows the committed file, not the edit", logE.includes("committed content") && !logE.includes("uncommitted edit"));
  git(scratch, ["checkout", "--", "tracked.txt"]);

  // ── F. refusals: an unreadable if:, a missing workflow, bad arguments ────
  writeFileSync(join(scratch, ".github/workflows/docs-drift.yml"), DRIFT_YML.replace("if: matrix.tree == 'full'", "if: contains(github.ref, 'x')"));
  const F1 = run(["--list"]);
  ok("F1 an if: outside the grammar is refused by name, exit 2, nothing run", F1.status === 2 && /contains\(github\.ref, 'x'\)/.test(F1.stderr) && F1.stdout === "", F1.stdout + F1.stderr);
  writeFileSync(join(scratch, ".github/workflows/docs-drift.yml"), DRIFT_YML);
  const F2 = run(["--tree", "sideways"]);
  ok("F2 an unknown tree is refused", F2.status === 2 && /--tree must be one of full, stripped/.test(F2.stderr));
  ok("F3 a folded run: block is refused rather than misread", (() => { try { extractSteps("jobs:\n  j:\n    steps:\n      - name: x\n        run: >\n          echo a\n", "f.yml"); return false; } catch (e) { return /folded/.test(String(e)); } })());
  ok("F4 a step with neither run: nor uses: is refused", (() => { try { extractSteps("jobs:\n  j:\n    steps:\n      - name: x\n        with:\n          a: b\n", "f.yml"); return false; } catch (e) { return /neither run: nor uses:/.test(String(e)); } })());
} finally {
  removeTempDir(scratch);
}

// ── G. the REAL tree: every runner on disk is invoked by some CI step ─────
{
  const real = readPlan(ROOT, { tree: "full" });
  const runText = real.map((p) => p.step.run).join("\n");
  const pluginRunners = readdirSync(join(ROOT, "plugins/gs-superadmin/test")).filter((n) => n.endsWith(".mjs"));
  const buildRunners = readdirSync(join(ROOT, "build")).filter((n) => n.startsWith("test-") && n.endsWith(".mjs"));
  const uncovered = [...pluginRunners.map((n) => "plugins/gs-superadmin/test/" + n), ...buildRunners.map((n) => "build/" + n)]
    .filter((rel) => !(runText.includes(rel) || (rel.includes("/jo-report") && runText.includes("jo-report*.mjs"))));
  ok("G1 every test runner on disk is invoked by a CI step (closure with the tree; the F-402 class)", uncovered.length === 0, uncovered.join(", "));
  ok("G2 the two workflows read without a refusal and every step has a unique name", real.length > 20 && new Set(real.map((p) => p.step.workflow + p.step.job + p.step.name)).size === real.length);
  ok("G3 the CI-only table names steps that exist in the workflows (no rot)", Object.keys(CI_ONLY_STEPS).every((n) => real.some((p) => p.step.name === n)), Object.keys(CI_ONLY_STEPS).join(", "));
  ok("G4 the workflow list is the two CI files", WORKFLOWS.length === 2 && WORKFLOWS.every((w) => existsSync(join(ROOT, w))));
}

/** The log path the runner printed on its first console line. @param {string} stdout */
function lastLineLog(stdout) {
  const m = stdout.match(/; log: (.+)$/m);
  if (!m) throw new Error("the runner did not print its log path");
  return m[1].trim();
}

console.log(`test-run-battery: ${passed} passed, ${failures.length} failed`);
if (failures.length) { console.error("failed: " + failures.join("; ")); process.exitCode = 1; }
