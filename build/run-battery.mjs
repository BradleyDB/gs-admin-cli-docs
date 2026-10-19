#!/usr/bin/env node
// run-battery.mjs — the committed runner for the verbatim CI battery (F-569).
//
// Every `run:` step of the two CI workflows (WORKFLOWS below) is run, in file
// order, in a TEMPORARY WORKTREE of a committed ref — never in the working
// tree. The battery mutates the tree it runs on: docs-drift's stripped
// rehearsal arm `git rm`s the dev-only set, the regenerate steps rewrite
// generated files, and the drift job's bus-header fetch is shallow. Run by
// hand in a checkout, those steps deleted dev/ from the working tree and
// left the clone shallow (the two damaged trees F-569 records); a worktree
// takes the first two harmlessly and the runner substitutes the third away
// (SUBSTITUTIONS). The step list is READ from the YAML, so the battery here
// and the battery in CI cannot drift apart: a PR that passes this runner's
// summary and then fails CI is a runner defect, not a PR defect.
//
//   node build/run-battery.mjs [--ref <git ref>] [--tree full|stripped]
//                              [--steps <match,...>] [--list] [--keep]
//                              [--log <file>] [--worktree-dir <dir>]
//
//   --ref      the commit to test (default HEAD — the COMMITTED tip; uncommitted
//              edits are not in the battery, and the runner says so when it
//              sees them)
//   --tree     which docs-drift matrix arm to run: `full` (default — what a PR
//              or dev push runs) or `stripped` (the release-tree rehearsal: the
//              strip step runs, in the worktree)
//   --steps    run only the steps whose name contains one of the comma-separated
//              matches (case-insensitive); the summary says the run was filtered
//   --list     print the step table (what would run, what is skipped and why)
//              and exit — the extractor's view, which build/test-run-battery.mjs
//              holds to the tree
//   --keep     leave the worktree in place after the run (the path is printed)
//   --log      the log file (default: <os tmpdir>/gs-battery-<stamp>.log)
//   --repo     the repository to run in (default: this checkout) — the
//              self-test's seam, documented so nobody re-derives it
//
// Output: one line per step on the console as it finishes, with its wall time;
// each step's full output goes to the log, stamped START/PASS/FAIL per step.
// The last stdout line is the ONE-LINE SUMMARY the handoff note quotes:
//
//   battery: PASS - 54/54 steps run (2 ci-only skipped), tree full, ref d674e7c, 51m12s
//   battery: FAIL at step 17/54 "Doc-lib direct fixtures" - 16 passed before it, tree full, ref d674e7c, 12m03s
//   battery: INCOMPLETE - 53/54 steps run, 1 skipped for a missing command (claude), tree full, ref d674e7c, 50m01s
//
// Exit code: 0 PASS; 1 FAIL (the first red step stops the run); 2 INCOMPLETE,
// a refusal, or a guard the runner makes on itself (the working tree changed,
// the repository went shallow).
//
// PUBLIC REPO: nothing machine-specific reaches the log or the summary. Every
// absolute path of the worktree, the repository and the user's home directory
// is masked in captured output (`<worktree>`, `<repo>`, `<home>`), so the log
// can be quoted on the bus as it is.
//
// Zero dependencies: Node built-ins only (AGENTS.md tenet 5).
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, rmSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { tmpdir, homedir } from "node:os";
import { spawnSync, execFileSync } from "node:child_process";
import { ROOT, isMainModule, maskLocalPaths } from "./lib.mjs";

/** The CI workflows whose `run:` steps ARE the battery, in the order they run. */
export const WORKFLOWS = [".github/workflows/validate-plugin.yml", ".github/workflows/docs-drift.yml"];

/**
 * Steps that exist only for GitHub's runner — skipped by exact step name, each
 * with its reason. An allow-list carried as data (AGENTS.md § Review-gate
 * rules, "contracts as data"): a step renamed in the YAML drops out of this
 * table and RUNS, which is loud (its `$GITHUB_OUTPUT` fails), never silent.
 * @type {Record<string, string>}
 */
export const CI_ONLY_STEPS = {
  "Decide whether any plugin-affecting path changed":
    "the path gate of the pull_request trigger — it writes $GITHUB_OUTPUT from the PR's merge commit; the local battery runs every job",
  "Install Claude Code":
    "CI installs the CLI into a fresh runner; locally the `claude` on PATH is the one the validate step uses",
};

/**
 * Steps that are CI-only by what they DO, whatever their name: a global
 * install changes the machine the battery runs on, and a renamed step would
 * otherwise drop out of CI_ONLY_STEPS and run it (the review of F-569 caught
 * this: the name table's "a renamed step runs, which is loud" holds for the
 * path gate, not for an install that silently succeeds).
 * @type {Array<{find: RegExp, why: string}>}
 */
export const CI_ONLY_TEXT = [
  { find: /\bnpm\s+(?:install|i|add)\s+(?:-g|--global)\b|\bnpm\s+(?:-g|--global)\s+(?:install|i|add)\b/, why: "a global npm install changes the machine, not the tree; CI installs into a fresh runner" },
];

/**
 * Text substitutions applied to a step's `run:` text before it runs — each
 * the smallest edit that makes a CI step safe on a shared object store, with
 * the measurement that put it here. The runner prints every substitution it
 * applied, so a verbatim claim never hides one.
 * @type {Array<{find: RegExp, replace: string, why: string}>}
 */
export const SUBSTITUTIONS = [
  {
    find: /(\bgit fetch\b[^\n]*?)\s--depth[= ]\d+/g,
    replace: "$1",
    why:
      "a worktree shares the repository's object store and .git/shallow, so a depth-limited fetch in the worktree " +
      "makes the WHOLE repository shallow (measured twice, 2026-10-15 and 2026-10-17: history walks read wrong, " +
      "merge-tree refused 'unrelated histories'); the full fetch reads the same bus header",
  },
];

/** The tree arms docs-drift's matrix declares; `full` is what a PR or dev push runs. */
export const TREES = ["full", "stripped"];

// ── YAML step extraction ─────────────────────────────────────────────────────
// A deliberately small reader of the subset the two workflows use: `jobs:` at
// column 0, job keys at indent 2, `steps:` at indent 4, list items at indent 6
// (`- key: value`), item keys at indent 8, and `run: |` blocks at indent 10 or
// more. Anything outside that subset is refused by name, never guessed around.

/**
 * @typedef {object} Step
 * @property {string} workflow repo-relative workflow path
 * @property {string} job the job key
 * @property {string} name the step's `name:` (or `<job> step <n>` when absent)
 * @property {string} [cond] the step's `if:` expression, when it has one
 * @property {string} run the `run:` text, verbatim from the YAML
 */

/**
 * The `run:` steps of one workflow file, in order.
 * @param {string} text the YAML
 * @param {string} workflow names the file in a refusal
 * @returns {Step[]}
 */
export function extractSteps(text, workflow) {
  const lines = text.split(/\r?\n/);
  /** @type {Step[]} */
  const steps = [];
  let inJobs = false;
  let job = "";
  let inSteps = false;
  /** @type {{name?: string, cond?: string, run?: string, uses?: string} | null} */
  let item = null;
  let n = 0;
  const indentOf = (/** @type {string} */ l) => l.length - l.trimStart().length;
  const close = () => {
    if (!item) return;
    n++;
    if (item.run !== undefined) {
      steps.push({ workflow, job, name: item.name ?? `${job} step ${n}`, cond: item.cond, run: item.run });
    } else if (item.uses === undefined) {
      throw new Error(`${workflow}: step ${n} of job ${job} (${item.name ?? "unnamed"}) has neither run: nor uses: — not a shape this reader knows`);
    }
    item = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.replace(/\s+$/, "");
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const ind = indentOf(line);
    if (ind === 0) { close(); inSteps = false; inJobs = /^jobs:\s*$/.test(line); continue; }
    if (!inJobs) continue;
    if (ind === 2) { close(); inSteps = false; job = line.trim().replace(/:$/, ""); n = 0; continue; }
    if (ind === 4) { close(); inSteps = /^steps:\s*$/.test(line.trim()); continue; }
    if (!inSteps) continue;
    if (ind === 6) {
      if (!line.trim().startsWith("- ")) throw new Error(`${workflow}:${i + 1}: expected a step list item ("- ") at indent 6`);
      close();
      item = {};
      i = readKey(line.trim().slice(2), i);
      continue;
    }
    if (ind === 8 && item) { i = readKey(line.trim(), i); continue; }
    if (ind > 8 && item) continue; // a nested mapping (with:, env:) — read by readKey when it matters
    throw new Error(`${workflow}:${i + 1}: unexpected indent ${ind} inside steps — not a shape this reader knows`);
  }
  close();
  return steps;

  /**
   * Read one `key: value` of the current item; a block scalar consumes the
   * following deeper-indented lines. Returns the index of the last line read.
   * @param {string} kv
   * @param {number} i
   */
  function readKey(kv, i) {
    const m = kv.match(/^([A-Za-z_-]+):(?:\s+(.*))?$/);
    if (!m) throw new Error(`${workflow}:${i + 1}: expected "key: value", got "${kv}"`);
    const [, key, valueRaw] = m;
    const value = valueRaw ?? "";
    if (!item) throw new Error(`${workflow}:${i + 1}: key outside a step item`);
    if (key === "run") {
      if (/^[|>][-+]?$/.test(value)) {
        if (value[0] === ">") throw new Error(`${workflow}:${i + 1}: a folded (>) run: block — the battery reads literal (|) blocks or one-line scalars only`);
        const body = [];
        let j = i + 1;
        let blockIndent = -1;
        for (; j < lines.length; j++) {
          const l = lines[j].replace(/\s+$/, "");
          if (!l.trim()) { body.push(""); continue; }
          const li = indentOf(l);
          if (blockIndent === -1) blockIndent = li;
          if (li < blockIndent || li <= 8) break;
          body.push(l.slice(blockIndent));
        }
        while (body.length && body[body.length - 1] === "") body.pop();
        item.run = body.join("\n") + (value.endsWith("-") ? "" : "\n");
        return j - 1;
      }
      if (!value) throw new Error(`${workflow}:${i + 1}: empty run:`);
      item.run = unquote(value) + "\n";
      return i;
    }
    if (key === "name") item.name = unquote(value);
    else if (key === "if") item.cond = unquote(value);
    else if (key === "uses") item.uses = value;
    return i;
  }
}

/** @param {string} v a YAML scalar as written */
function unquote(v) {
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
  return t;
}

// ── `if:` evaluation ─────────────────────────────────────────────────────────
// Step-level conditions in the two workflows are disjunctions/conjunctions of
// `<context> == '<literal>'` (or !=). `matrix.tree` is the chosen arm; every
// GitHub context (github.*, inputs.*, needs.*) reads as the empty string — a
// local run is no GitHub event. An expression outside that grammar is refused
// by name: a step the runner cannot decide is never silently skipped or run.

/**
 * @param {string} expr
 * @param {{tree: string}} ctx
 * @returns {boolean}
 */
export function evaluateIf(expr, ctx) {
  const e = expr.trim().replace(/^\$\{\{\s*/, "").replace(/\s*\}\}$/, "");
  const orTerms = e.split("||");
  return orTerms.some((term) =>
    term.split("&&").every((atom) => {
      const m = atom.trim().match(/^([A-Za-z_][\w.-]*)\s*(==|!=)\s*'([^']*)'$/);
      if (!m) throw new Error(`if: "${expr}" — the clause "${atom.trim()}" is not "<context> == '<literal>'"; the runner evaluates nothing it cannot read`);
      const [, lhs, op, lit] = m;
      let value;
      if (lhs === "matrix.tree") value = ctx.tree;
      else if (/^(github|inputs|needs|env|vars|secrets|runner|job|steps)\./.test(lhs)) value = "";
      else throw new Error(`if: "${expr}" — unknown context "${lhs}"`);
      return op === "==" ? value === lit : value !== lit;
    }),
  );
}

// ── The plan: which steps run, which are skipped and why ─────────────────────

/**
 * @typedef {object} PlannedStep
 * @property {Step} step
 * @property {"run" | "ci-only" | "if-false" | "filtered"} decision
 * @property {string} [why]
 * @property {string} run the text that will run (substitutions applied)
 * @property {string[]} substituted the `why` of each substitution applied
 */

/**
 * @param {Step[]} steps
 * @param {{tree: string, matches?: string[]}} opts
 * @returns {PlannedStep[]}
 */
export function plan(steps, opts) {
  const matches = (opts.matches ?? []).map((m) => m.toLowerCase()).filter(Boolean);
  return steps.map((step) => {
    /** @type {PlannedStep} */
    const p = { step, decision: "run", run: step.run, substituted: [] };
    if (Object.hasOwn(CI_ONLY_STEPS, step.name)) return { ...p, decision: "ci-only", why: CI_ONLY_STEPS[step.name] };
    const byText = CI_ONLY_TEXT.find((t) => t.find.test(step.run));
    if (byText) return { ...p, decision: "ci-only", why: byText.why };
    if (step.cond !== undefined && !evaluateIf(step.cond, { tree: opts.tree })) return { ...p, decision: "if-false", why: `if: ${step.cond}` };
    if (matches.length && !matches.some((m) => step.name.toLowerCase().includes(m))) return { ...p, decision: "filtered", why: "--steps" };
    for (const s of SUBSTITUTIONS) {
      const next = p.run.replace(s.find, s.replace);
      if (next !== p.run) { p.run = next; p.substituted.push(s.why); }
    }
    return p;
  });
}

/**
 * The planned battery of the repository at `repo`: every `run:` step of the
 * WORKFLOWS, each with its decision.
 * @param {string} repo the repository root
 * @param {{tree: string, matches?: string[]}} opts
 * @returns {PlannedStep[]}
 */
export function readPlan(repo, opts) {
  /** @type {Step[]} */
  const steps = [];
  for (const wf of WORKFLOWS) {
    const file = join(repo, wf);
    if (!existsSync(file)) throw new Error(`${wf} not found under the repository — the battery is read from the CI workflows`);
    steps.push(...extractSteps(readFileSync(file, "utf8"), wf));
  }
  const names = new Set();
  for (const s of steps) {
    const key = `${s.workflow}#${s.job}#${s.name}`;
    if (names.has(key)) throw new Error(`${s.workflow}: two steps named "${s.name}" in job ${s.job} — the summary names steps, so names are unique`);
    names.add(key);
  }
  return plan(steps, opts);
}

// ── Running ──────────────────────────────────────────────────────────────────

/** The bash that runs a step: Git's own on win32 (never WSL's System32 bash), `bash` elsewhere. */
export function findBash() {
  if (process.env.GS_BATTERY_SHELL) return process.env.GS_BATTERY_SHELL;
  if (process.platform === "win32") {
    try {
      const execPath = execFileSync("git", ["--exec-path"], { encoding: "utf8" }).trim();
      // <git>/mingw64/libexec/git-core → <git>/bin/bash.exe
      const gitRoot = resolve(execPath, "..", "..", "..");
      for (const cand of [join(gitRoot, "bin", "bash.exe"), join(gitRoot, "usr", "bin", "bash.exe")]) if (existsSync(cand)) return cand;
    } catch { /* fall through to PATH */ }
  }
  return "bash";
}

/** @param {number} ms */
export const fmtDuration = (ms) => {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m ? `${m}m${String(s % 60).padStart(2, "0")}s` : `${s}s`;
};

const stamp = () => new Date().toISOString().slice(11, 19);

/**
 * Run the planned steps in `cwd`, logging to `logFile`. Returns the outcome.
 * @param {PlannedStep[]} planned
 * @param {{cwd: string, logFile: string, mask: (s: string) => string, bash: string}} env
 */
export function runSteps(planned, env) {
  const toRun = planned.filter((p) => p.decision === "run");
  const log = (/** @type {string} */ s) => appendFileSync(env.logFile, s.endsWith("\n") ? s : s + "\n");
  let passed = 0;
  /** @type {{index: number, name: string, tail: string} | null} */
  let failed = null;
  /** @type {Array<{name: string, command: string}>} */
  const missing = [];
  const scriptFile = join(dirname(env.logFile), basename(env.logFile, ".log") + ".step.sh");
  for (let k = 0; k < toRun.length; k++) {
    const p = toRun[k];
    const label = `${k + 1}/${toRun.length} ${p.step.name}`;
    const firstWord = p.run.trim().split(/\s+/)[0] ?? "";
    if (!commandExists(firstWord, env)) {
      missing.push({ name: p.step.name, command: firstWord });
      log(`[${stamp()}] SKIP ${label} — command not found: ${firstWord}`);
      console.log(`  skip  ${label} (command not found: ${firstWord})`);
      continue;
    }
    for (const why of p.substituted) log(`[${stamp()}] SUBSTITUTED in "${p.step.name}": ${why}`);
    log(`[${stamp()}] START ${label}\n${p.run.trimEnd().split("\n").map((l) => "    $ " + l).join("\n")}`);
    writeFileSync(scriptFile, p.run, "utf8");
    const t0 = Date.now();
    const r = spawnSync(env.bash, ["--noprofile", "--norc", "-eo", "pipefail", scriptFile], {
      cwd: env.cwd, encoding: "utf8", maxBuffer: 256 << 20, env: { ...process.env },
    });
    const ms = Date.now() - t0;
    const out = env.mask((r.stdout ?? "") + (r.stderr ?? ""));
    if (out.trim()) log(out.split("\n").map((l) => "    " + l).join("\n"));
    if (r.status === 0) {
      passed++;
      log(`[${stamp()}] PASS ${label} (${fmtDuration(ms)})`);
      console.log(`  pass  ${label} (${fmtDuration(ms)})`);
    } else {
      const status = r.status === null ? `signal ${r.signal}` : `exit ${r.status}`;
      log(`[${stamp()}] FAIL ${label} (${status}, ${fmtDuration(ms)})`);
      console.log(`  FAIL  ${label} (${status}, ${fmtDuration(ms)})`);
      const tail = out.trimEnd().split("\n").slice(-25).join("\n");
      failed = { index: k + 1, name: p.step.name, tail };
      break;
    }
  }
  rmSync(scriptFile, { force: true });
  return { total: toRun.length, passed, failed, missing };
}

/**
 * Is the first word of a step a command bash will find? Only a plain command
 * name is looked up (`command -v`); shell keywords, builtins, assignments and
 * anything with shell syntax in it are bash's business and read as present.
 * "Could not look" is its own state (A-4): a step whose tool is absent is
 * reported SKIPPED by name and the summary reads INCOMPLETE, never PASS.
 * @param {string} cmd @param {{cwd: string, bash: string}} env
 */
function commandExists(cmd, env) {
  if (!/^[A-Za-z][\w.-]*$/.test(cmd)) return true;
  if (/^(node|npm|npx|git|echo|printf|for|while|if|case|set|exit|true|false|export|cd|test)$/.test(cmd)) return true;
  const r = spawnSync(env.bash, ["--noprofile", "--norc", "-c", `command -v -- "$1"`, "bash", cmd], { cwd: env.cwd, encoding: "utf8" });
  return r.status === 0;
}

// ── The CLI ──────────────────────────────────────────────────────────────────

/** @param {string[]} argv */
export function parseArgs(argv) {
  const o = { ref: "HEAD", tree: "full", matches: /** @type {string[]} */ ([]), list: false, keep: false, log: "", repo: "", worktreeDir: "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => { const v = argv[++i]; if (v === undefined) throw new Error(`${a} needs a value`); return v; };
    if (a === "--ref") o.ref = next();
    else if (a === "--tree") { o.tree = next(); if (!TREES.includes(o.tree)) throw new Error(`--tree must be one of ${TREES.join(", ")}`); }
    else if (a === "--steps") o.matches.push(...next().split(","));
    else if (a === "--list") o.list = true;
    else if (a === "--keep") o.keep = true;
    else if (a === "--log") o.log = next();
    else if (a === "--repo") o.repo = next();
    else if (a === "--worktree-dir") o.worktreeDir = next();
    else throw new Error(`unknown argument ${a}`);
  }
  return o;
}

/** @param {string} repo @param {string[]} args */
const git = (repo, args) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();

/**
 * @param {ReturnType<typeof parseArgs>} o
 * @returns {number} the exit code
 */
export function main(o) {
  const repo = resolve(o.repo || ROOT);
  const planned = readPlan(repo, { tree: o.tree, matches: o.matches });
  if (o.list) {
    for (const p of planned) {
      const tag = p.decision === "run" ? "run     " : p.decision.padEnd(8);
      console.log(`${tag} ${p.step.workflow.replace(".github/workflows/", "")}  ${p.step.job}  ${p.step.name}${p.why ? `  [${p.why.length > 70 ? p.why.slice(0, 67) + "..." : p.why}]` : ""}`);
    }
    const counts = Object.fromEntries(["run", "ci-only", "if-false", "filtered"].map((d) => [d, planned.filter((p) => p.decision === d).length]));
    console.log(`battery plan: ${counts.run} to run, ${counts["ci-only"]} ci-only, ${counts["if-false"]} off this arm (tree ${o.tree}), ${counts.filtered} filtered`);
    return 0;
  }

  const sha = git(repo, ["rev-parse", "--short", o.ref]);
  const dirtyBefore = git(repo, ["status", "--porcelain", "--untracked-files=no"]);
  if (dirtyBefore) console.log(`note: the working tree has uncommitted changes to tracked files; the battery runs the committed ${o.ref} (${sha}), not those edits`);
  const shallowBefore = git(repo, ["rev-parse", "--is-shallow-repository"]) === "true";

  // The stamp carries the pid: two runs started in one second must not share a log or a worktree.
  const stampId = new Date().toISOString().replace(/[-:]/g, "").replace(/\..*/, "").replace("T", "-") + `-${process.pid}`;
  const logFile = resolve(o.log || join(tmpdir(), `gs-battery-${stampId}.log`));
  mkdirSync(dirname(logFile), { recursive: true });
  const worktree = resolve(o.worktreeDir || join(tmpdir(), `gs-battery-${stampId}`));
  const mask = (/** @type {string} */ s) => maskLocalPaths(s, [[worktree, "<worktree>"], [repo, "<repo>"], [homedir(), "<home>"]]);
  writeFileSync(logFile, `battery ${stampId} — tree ${o.tree}, ref ${o.ref} (${sha}), worktree <worktree>\n`);

  // The temp worktree: a detached checkout of the ref, removed in finally.
  execFileSync("git", ["-c", "core.longpaths=true", "worktree", "add", "--detach", worktree, o.ref], { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  console.log(`battery: tree ${o.tree}, ref ${o.ref} (${sha}); steps run in a temporary worktree; log: ${logFile}`);
  const t0 = Date.now();
  /** @type {ReturnType<typeof runSteps>} */
  let out;
  try {
    out = runSteps(planned, { cwd: worktree, logFile, mask, bash: findBash() });
  } finally {
    if (o.keep) console.log(`worktree kept (--keep): ${worktree}`);
    else {
      const rm = spawnSync("git", ["worktree", "remove", "--force", worktree], { cwd: repo, encoding: "utf8" });
      if (rm.status !== 0) console.error(`battery: could not remove the worktree (${(rm.stderr ?? "").trim()}); remove it by hand: git worktree remove --force <that path>`);
      spawnSync("git", ["worktree", "prune"], { cwd: repo, encoding: "utf8" });
    }
  }
  const elapsed = fmtDuration(Date.now() - t0);

  // Guards the runner makes on ITSELF (the judge of "never the working tree").
  const guards = [];
  const dirtyAfter = git(repo, ["status", "--porcelain", "--untracked-files=no"]);
  if (dirtyAfter !== dirtyBefore) guards.push("the working tree's tracked files changed during the run — the battery touched the checkout, which it must never do");
  const shallowAfter = git(repo, ["rev-parse", "--is-shallow-repository"]) === "true";
  if (shallowAfter && !shallowBefore) guards.push("the repository became SHALLOW during the run (a depth-limited fetch reached the shared object store); repair: git fetch --unshallow origin");

  const ciOnly = planned.filter((p) => p.decision === "ci-only").length;
  const filtered = planned.filter((p) => p.decision === "filtered").length;
  const tail = `tree ${o.tree}, ref ${sha}, ${elapsed}${filtered ? ` (filtered to ${out.total} of ${out.total + filtered} steps)` : ""}`;
  let code = 0;
  let summary;
  if (out.failed) {
    summary = `battery: FAIL at step ${out.failed.index}/${out.total} "${out.failed.name}" - ${out.passed} passed before it, ${tail}`;
    console.log(out.failed.tail.split("\n").map((l) => "    " + l).join("\n"));
    code = 1;
  } else if (out.missing.length) {
    summary = `battery: INCOMPLETE - ${out.passed}/${out.total} steps run, ${out.missing.length} skipped for a missing command (${out.missing.map((m) => m.command).join(", ")}), ${tail}`;
    code = 2;
  } else {
    summary = `battery: PASS - ${out.passed}/${out.total} steps run (${ciOnly} ci-only skipped), ${tail}`;
  }
  for (const g of guards) { console.error(`battery: GUARD: ${g}`); code = 2; }
  appendFileSync(logFile, summary + "\n");
  console.log(summary);
  return code;
}

if (isMainModule(import.meta.url)) {
  try {
    process.exitCode = main(parseArgs(process.argv.slice(2)));
  } catch (e) {
    console.error(`run-battery: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 2;
  }
}
