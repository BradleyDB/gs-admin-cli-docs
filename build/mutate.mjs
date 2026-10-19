#!/usr/bin/env node
// mutate.mjs — the committed mutation-sweep runner (F-569): the bus's copy-out
// ceremony as one command, with the predictions read BEFORE anything runs.
//
//   node build/mutate.mjs <suite.mjs> <mutants.json> [--root <dir>]
//                         [--timeout <seconds>] [--stop-on-mismatch]
//
// <mutants.json> is the prediction file, written before the run:
//
//   {
//     "source": "decision points of build/run-battery.mjs plan() (code census, 2026-10-18)",
//     "mutants": [
//       { "id": "M1", "file": "build/run-battery.mjs",
//         "find": "cwd: worktree", "replace": "cwd: repo",
//         "pred": "KILL", "pin": "test-run-battery: the working tree is unchanged after a run" }
//     ]
//   }
//
// `source` names the ENUMERATION SOURCE (AGENTS.md § Review-gate rules,
// "Verification must be able to surprise", rule 1): where the mutants come
// from — the code's decision points, a spec oracle, prior rounds' repros —
// never the arms just written. Every mutant carries `pred` (KILL or SURVIVE)
// and `find`, a literal that must occur EXACTLY ONCE in `file` (repo-relative;
// a sweep over an ambiguous edit measures nothing); `replace` may be empty
// (a deletion). `pin` names the arm expected to catch it (optional, copied
// into the row).
//
// What runs: the file is validated whole and its sha256 taken (refused before
// any suite run when a mutant is malformed); the suite runs once UNMUTATED
// (a red control makes every mutant "killed" — refused); then per mutant the
// edit is applied, the suite runs, the file's original bytes are restored and
// verified, and the verdict is KILLED (suite exit non-zero) or SURVIVED.
// A verdict that differs from `pred` is MISMATCH — the information, never a
// row to edit. Interruption restores the file (exit and SIGINT handlers).
//
// Output: the copy-out in the bus convention (4-space-indented rows, the
// header line naming the source and the prediction file's hash), then the
// one-line summary:
//
//   mutate: 5 of 5 mutants run - 4 killed, 1 survived; 0 MISMATCH, 0 not applied (suite build/test-run-battery.mjs)
//
// (the summary's verdict counts are lowercase so that, quoted indented on the
// bus, the line is not read as a copy-out row owing a pred: token)
//
// Exit code: 0 when every verdict matched its prediction and every mutant
// applied; 1 on a MISMATCH or an unapplied mutant; 2 on a refusal.
//
// PUBLIC REPO: paths in rows are repo-relative; the repository root and the
// user's home directory are masked in evidence lines (`<repo>`, `<home>`).
//
// Zero dependencies: Node built-ins only (AGENTS.md tenet 5).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { ROOT, isMainModule, readJsonFile, maskLocalPaths } from "./lib.mjs";

export const PREDICTIONS = ["KILL", "SURVIVE"];

/**
 * @typedef {object} Mutant
 * @property {string} id
 * @property {string} file repo-relative
 * @property {string} find literal text, exactly one occurrence
 * @property {string} replace
 * @property {"KILL" | "SURVIVE"} pred
 * @property {string} [pin] the arm expected to catch it
 */

/**
 * Validate a prediction file's parsed JSON. Throws naming the first defect.
 * @param {unknown} json
 * @param {string} root
 * @returns {{source: string, mutants: Mutant[]}}
 */
export function validateMutants(json, root) {
  if (!json || typeof json !== "object" || Array.isArray(json)) throw new Error("the prediction file is not a JSON object");
  const o = /** @type {Record<string, unknown>} */ (json);
  if (typeof o.source !== "string" || !o.source.trim()) throw new Error('the prediction file names no "source" — where the mutants were enumerated from (the code\'s decision points, a spec oracle); never the arms just written');
  if (!Array.isArray(o.mutants) || !o.mutants.length) throw new Error('the prediction file has no "mutants" array');
  const ids = new Set();
  /** @type {Mutant[]} */
  const out = [];
  o.mutants.forEach((raw, k) => {
    const m = /** @type {Record<string, unknown>} */ (raw && typeof raw === "object" ? raw : {});
    const at = `mutant ${k + 1}${typeof m.id === "string" ? ` (${m.id})` : ""}`;
    for (const key of ["id", "file", "find"]) {
      if (typeof m[key] !== "string" || !(/** @type {string} */ (m[key])).length) throw new Error(`${at}: "${key}" must be a non-empty string`);
    }
    if (typeof m.replace !== "string") throw new Error(`${at}: "replace" must be a string (empty deletes the found text)`);
    const id = /** @type {string} */ (m.id);
    if (ids.has(id)) throw new Error(`${at}: duplicate id`);
    ids.add(id);
    if (!PREDICTIONS.includes(/** @type {string} */ (m.pred)))
      throw new Error(`${at}: "pred" must be KILL or SURVIVE, written before the run — a sweep with no prediction is a vacuity check, not this ceremony`);
    if (m.find === m.replace) throw new Error(`${at}: "find" and "replace" are equal — not a mutation`);
    const file = /** @type {string} */ (m.file).replace(/\\/g, "/");
    if (/^(\/|[A-Za-z]:)/.test(file) || file.split("/").includes("..")) throw new Error(`${at}: "file" must be repo-relative (${file})`);
    if (!existsSync(join(root, file))) throw new Error(`${at}: ${file} does not exist under the root`);
    if (m.pin !== undefined && typeof m.pin !== "string") throw new Error(`${at}: "pin" must be a string when given`);
    out.push({ id, file, find: /** @type {string} */ (m.find), replace: /** @type {string} */ (m.replace), pred: /** @type {"KILL"|"SURVIVE"} */ (m.pred), pin: /** @type {string|undefined} */ (m.pin) });
  });
  return { source: o.source.trim(), mutants: out };
}

/** How many times `find` occurs in `text` (non-overlapping). */
export function countOccurrences(text, find) {
  let n = 0;
  for (let i = text.indexOf(find); i !== -1; i = text.indexOf(find, i + find.length)) n++;
  return n;
}

/**
 * The evidence line of a suite run: the first line that reads as a failure,
 * else the last non-empty line; masked and clipped.
 * @param {string} output @param {(s: string) => string} mask
 */
export function evidenceLine(output, mask) {
  const lines = output.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  // A suite's own verdict line first (FAIL: …, not ok …); a thrown error's
  // line next (which may be a stack frame quoting source); else the last line.
  const hit = lines.find((l) => /^(FAIL\b|not ok\b)/.test(l)) ??
    lines.find((l) => /\b(FAIL|FAILED|Error|AssertionError|not ok|MISMATCH)\b/.test(l)) ?? lines[lines.length - 1] ?? "(no output)";
  const masked = mask(hit);
  return masked.length > 160 ? masked.slice(0, 157) + "..." : masked;
}

/** @param {string[]} argv */
export function parseArgs(argv) {
  const o = { suite: "", mutants: "", root: "", timeout: 0, stopOnMismatch: false };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => { const v = argv[++i]; if (v === undefined) throw new Error(`${a} needs a value`); return v; };
    if (a === "--root") o.root = next();
    else if (a === "--timeout") { o.timeout = Number(next()); if (!Number.isFinite(o.timeout) || o.timeout < 0) throw new Error("--timeout must be a number of seconds"); }
    else if (a === "--stop-on-mismatch") o.stopOnMismatch = true;
    else if (a.startsWith("--")) throw new Error(`unknown argument ${a}`);
    else positional.push(a);
  }
  if (positional.length !== 2) throw new Error("usage: node build/mutate.mjs <suite.mjs> <mutants.json> [--root <dir>] [--timeout <seconds>] [--stop-on-mismatch]");
  [o.suite, o.mutants] = positional;
  return o;
}

/**
 * @param {ReturnType<typeof parseArgs>} o
 * @returns {number} the exit code
 */
export function main(o) {
  const root = resolve(o.root || ROOT);
  const suiteAbs = resolve(root, o.suite);
  const suiteRel = relative(root, suiteAbs).replace(/\\/g, "/");
  if (!existsSync(suiteAbs)) throw new Error(`suite ${o.suite} not found under the root`);
  const predFile = resolve(o.mutants);
  const predBytes = readFileSync(predFile);
  const sha = createHash("sha256").update(predBytes).digest("hex").slice(0, 12);
  const { source, mutants } = validateMutants(readJsonFile(predFile), root);
  const mask = (/** @type {string} */ s) => maskLocalPaths(s, [[root, "<repo>"], [homedir(), "<home>"]]);
  const runSuite = () =>
    spawnSync(process.execPath, [suiteAbs], { cwd: root, encoding: "utf8", maxBuffer: 256 << 20, timeout: o.timeout ? o.timeout * 1000 : undefined });

  // The control: the suite must be green before any mutant, or every mutant
  // "kills" and the sweep measures nothing.
  const control = runSuite();
  if (control.status !== 0) {
    console.error(`mutate: the suite is red UNMUTATED (${control.status === null ? `signal ${control.signal}` : `exit ${control.status}`}) — a sweep over a red suite measures nothing:`);
    console.error(evidenceLine((control.stdout ?? "") + (control.stderr ?? ""), mask));
    return 2;
  }

  /** @type {{file: string, bytes: Buffer} | null} */
  let applied = null;
  const restore = () => {
    if (!applied) return;
    writeFileSync(join(root, applied.file), applied.bytes);
    applied = null;
  };
  process.on("exit", restore);
  const onSignal = () => { restore(); process.exit(130); };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  const rows = [];
  let killed = 0, survived = 0, mismatches = 0, notApplied = 0;
  for (const m of mutants) {
    const abs = join(root, m.file);
    const original = readFileSync(abs);
    const text = original.toString("utf8");
    const n = countOccurrences(text, m.find);
    if (n !== 1) {
      notApplied++;
      rows.push(`    ${m.id} NOT-APPLIED pred:${m.pred} — "find" occurs ${n} time(s) in ${m.file}, not exactly once`);
      continue;
    }
    applied = { file: m.file, bytes: original };
    writeFileSync(abs, text.replace(m.find, () => m.replace), "utf8");
    const r = runSuite();
    restore();
    const after = readFileSync(abs);
    if (!after.equals(original)) throw new Error(`${m.file} was not restored byte for byte after ${m.id} — stop and inspect the file`);
    const out = (r.stdout ?? "") + (r.stderr ?? "");
    const verdict = r.status === 0 ? "SURVIVED" : "KILLED";
    if (verdict === "KILLED") killed++; else survived++;
    const matched = (verdict === "KILLED") === (m.pred === "KILL");
    if (!matched) mismatches++;
    const how = r.status === null ? `signal ${r.signal}` : `exit ${r.status}`;
    const evidence = verdict === "KILLED" ? evidenceLine(out, mask) : `suite ${how}`;
    rows.push(`    ${m.id} ${verdict} pred:${m.pred}${matched ? "" : " MISMATCH"} — ${m.file}: ${JSON.stringify(m.find)} -> ${JSON.stringify(m.replace)}${m.pin ? ` [${m.pin}]` : ""} — ${evidence}`);
    if (!matched && o.stopOnMismatch) { rows.push(`    (stopped at the first MISMATCH: --stop-on-mismatch)`); break; }
  }
  process.off("exit", restore);
  process.off("SIGINT", onSignal);
  process.off("SIGTERM", onSignal);

  const run = killed + survived;
  console.log(`    sweep (source: ${source}) — suite ${suiteRel} — ${mutants.length} mutants, predictions read from ${mask(predFile).split(/[\\/]/).pop()} (sha256 ${sha}) before the control run`);
  for (const row of rows) console.log(row);
  // Lowercase verdict counts on purpose: the bus gate (check-stale-facts, W10
  // rule 2) reads an indented line spelling KILLED/SURVIVED as a copy-out ROW
  // owing a pred: token; the summary is a count, and it is quoted indented.
  const summary = `mutate: ${run} of ${mutants.length} mutants run - ${killed} killed, ${survived} survived; ${mismatches} MISMATCH, ${notApplied} not applied (suite ${suiteRel})`;
  console.log(summary);
  return mismatches || notApplied ? 1 : 0;
}

if (isMainModule(import.meta.url)) {
  try {
    process.exitCode = main(parseArgs(process.argv.slice(2)));
  } catch (e) {
    console.error(`mutate: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 2;
  }
}
