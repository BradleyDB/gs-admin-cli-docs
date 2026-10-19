#!/usr/bin/env node
// Fixture tests for build/mutate.mjs (F-569): the mutation-sweep runner's
// claims — a prediction file is validated WHOLE before any run (a mutant
// with no pred, a duplicate id, an absolute path, an equal find/replace are
// refused with nothing executed), a red control run is refused, a `find`
// that does not occur exactly once is NOT-APPLIED, each mutant's verdict is
// KILLED or SURVIVED with MISMATCH where the prediction differs, the file is
// restored byte for byte after every mutant, the copy-out carries the source
// and the prediction file's hash, and the exit code is 1 on any MISMATCH.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib.mjs";
import { makeTempDir, removeTempDir, writeFiles, runNode } from "../test/rig.mjs";

const MUTATE = join(ROOT, "build", "mutate.mjs");
let passed = 0;
const failures = [];
const ok = (name, cond, detail) => {
  if (cond) passed++;
  else { failures.push(name); console.error(`FAIL: ${name}`); if (detail) console.error("  " + String(detail).slice(0, 1200)); }
};

const LIB = "export const add = (a, b) => a + b;\nexport const neg = (a) => -a;\nexport const twice = (a) => a + a;\n";
const SUITE = [
  'import { add, twice } from "./lib.mjs";',
  'if (add(1, 2) !== 3) { console.error("FAIL: add(1, 2) is " + add(1, 2)); process.exit(1); }',
  'if (twice(4) !== 8) { console.error("FAIL: twice(4) is " + twice(4)); process.exit(1); }',
  'console.log("suite: 2 passed");',
  "",
].join("\n");
const predictions = (mutants, source = "decision points of lib.mjs (code census)") => JSON.stringify({ source, mutants }, null, 2);

const scratch = makeTempDir("f569-mutate");
try {
  writeFiles(scratch, { "lib.mjs": LIB, "suite.mjs": SUITE });
  const run = (predJson, args = []) => {
    writeFileSync(join(scratch, "mutants.json"), predJson);
    return runNode(MUTATE, ["suite.mjs", join(scratch, "mutants.json"), "--root", scratch, ...args], { cwd: ROOT });
  };
  const libBytes = readFileSync(join(scratch, "lib.mjs"));
  const lastLine = (s) => s.trim().split(/\r?\n/).pop() ?? "";

  // ── A. the sweep: KILLED, SURVIVED, MISMATCH, rows, summary, exit ───────
  const A = run(predictions([
    { id: "M1", file: "lib.mjs", find: "a + b", replace: "a - b", pred: "KILL", pin: "suite: add(1, 2)" },
    { id: "M2", file: "lib.mjs", find: "=> -a", replace: "=> a", pred: "SURVIVE", pin: "nothing pins neg" },
    { id: "M3", file: "lib.mjs", find: "a + a", replace: "a * a", pred: "SURVIVE" },
  ]));
  ok("A1 the header names the source, the suite, the count and the prediction file's hash", /^    sweep \(source: decision points of lib\.mjs \(code census\)\) — suite suite\.mjs — 3 mutants, predictions read from mutants\.json \(sha256 [0-9a-f]{12}\) before the control run$/m.test(A.stdout), A.stdout + A.stderr);
  ok("A2 a killed mutant's row carries pred:KILL and the suite's failing line", /^    M1 KILLED pred:KILL — lib\.mjs: "a \+ b" -> "a - b" \[suite: add\(1, 2\)\] — FAIL: add\(1, 2\) is -1$/m.test(A.stdout), A.stdout);
  ok("A3 a surviving mutant predicted to survive is matched", /^    M2 SURVIVED pred:SURVIVE — lib\.mjs: "=> -a" -> "=> a" \[nothing pins neg\] — suite exit 0$/m.test(A.stdout), A.stdout);
  ok("A4 a killed mutant predicted to survive is MISMATCH", /^    M3 KILLED pred:SURVIVE MISMATCH — lib\.mjs: "a \+ a" -> "a \* a" — FAIL: twice\(4\) is 16$/m.test(A.stdout), A.stdout);
  ok("A5 the summary counts (lowercase verdicts: not a copy-out row to the bus gate) and the exit code is 1 on a MISMATCH", A.status === 1 && lastLine(A.stdout) === "mutate: 3 of 3 mutants run - 2 killed, 1 survived; 1 MISMATCH, 0 not applied (suite suite.mjs)", lastLine(A.stdout));
  ok("A6 the file is restored byte for byte", readFileSync(join(scratch, "lib.mjs")).equals(libBytes));
  const A2 = run(predictions([
    { id: "M1", file: "lib.mjs", find: "a + b", replace: "a - b", pred: "KILL" },
    { id: "M2", file: "lib.mjs", find: "=> -a", replace: "=> a", pred: "SURVIVE" },
  ]));
  ok("A7 every verdict matched: exit 0", A2.status === 0 && lastLine(A2.stdout) === "mutate: 2 of 2 mutants run - 1 killed, 1 survived; 0 MISMATCH, 0 not applied (suite suite.mjs)", A2.stdout + A2.stderr);
  const A3 = run(predictions([
    { id: "M1", file: "lib.mjs", find: "a + b", replace: "a - b", pred: "SURVIVE" },
    { id: "M2", file: "lib.mjs", find: "=> -a", replace: "=> a", pred: "SURVIVE" },
  ]), ["--stop-on-mismatch"]);
  ok("A8 --stop-on-mismatch stops after the first MISMATCH and says so", A3.status === 1 && /M1 KILLED pred:SURVIVE MISMATCH/.test(A3.stdout) && !/^    M2 /m.test(A3.stdout) && /stopped at the first MISMATCH/.test(A3.stdout) &&
    /^mutate: 1 of 2 mutants run/m.test(A3.stdout), A3.stdout);

  // ── B. not applied: find occurs 0 or 2 times ────────────────────────────
  const B = run(predictions([
    { id: "M1", file: "lib.mjs", find: "(a)", replace: "(x)", pred: "KILL" },
    { id: "M2", file: "lib.mjs", find: "nowhere", replace: "x", pred: "KILL" },
    { id: "M3", file: "lib.mjs", find: "a + b", replace: "a - b", pred: "KILL" },
  ]));
  ok("B1 an ambiguous or absent find is NOT-APPLIED with its count, the rest still run, exit 1", B.status === 1 &&
    /^    M1 NOT-APPLIED pred:KILL — "find" occurs 2 time\(s\) in lib\.mjs, not exactly once$/m.test(B.stdout) && /^    M2 NOT-APPLIED pred:KILL — "find" occurs 0 time/m.test(B.stdout) &&
    /^    M3 KILLED pred:KILL/m.test(B.stdout) && lastLine(B.stdout) === "mutate: 1 of 3 mutants run - 1 killed, 0 survived; 0 MISMATCH, 2 not applied (suite suite.mjs)", B.stdout + B.stderr);

  // ── C. refusals before anything runs ────────────────────────────────────
  const refused = (json, re, name) => {
    const r = run(json);
    ok(name, r.status === 2 && re.test(r.stderr) && !/sweep \(source/.test(r.stdout), r.stdout + r.stderr);
  };
  refused(predictions([{ id: "M1", file: "lib.mjs", find: "a + b", replace: "a - b" }]), /"pred" must be KILL or SURVIVE, written before the run/, "C1 a mutant with no pred is refused");
  refused(predictions([{ id: "M1", file: "lib.mjs", find: "a + b", replace: "a - b", pred: "MAYBE" }]), /"pred" must be KILL or SURVIVE/, "C2 an unknown pred is refused");
  refused(predictions([{ id: "M1", file: "lib.mjs", find: "a + b", replace: "a - b", pred: "KILL" }, { id: "M1", file: "lib.mjs", find: "=> -a", replace: "=> a", pred: "KILL" }]), /duplicate id/, "C3 a duplicate id is refused");
  refused(predictions([{ id: "M1", file: "lib.mjs", find: "a + b", replace: "a + b", pred: "KILL" }]), /"find" and "replace" are equal/, "C4 an edit that changes nothing is refused");
  refused(predictions([{ id: "M1", file: "../lib.mjs", find: "a + b", replace: "a - b", pred: "KILL" }]), /must be repo-relative/, "C5 a path climbing out of the root is refused");
  refused(predictions([{ id: "M1", file: "missing.mjs", find: "a + b", replace: "a - b", pred: "KILL" }]), /missing\.mjs does not exist/, "C6 a file that does not exist is refused");
  refused(predictions([{ id: "M1", file: "lib.mjs", find: "a + b", replace: "a - b", pred: "KILL" }], ""), /names no "source"/, "C7 a prediction file with no enumeration source is refused");
  refused("[]", /not a JSON object/, "C8 a non-object prediction file is refused");
  // A red control: break the suite's subject before any mutant.
  writeFileSync(join(scratch, "lib.mjs"), LIB.replace("a + b", "a - b"));
  const red = run(predictions([{ id: "M1", file: "lib.mjs", find: "a - b", replace: "a + b", pred: "KILL" }]));
  ok("C9 a suite that is red unmutated is refused — a sweep over a red suite measures nothing", red.status === 2 && /red UNMUTATED/.test(red.stderr) && /FAIL: add\(1, 2\) is -1/.test(red.stderr) && !/sweep \(source/.test(red.stdout), red.stdout + red.stderr);
  writeFileSync(join(scratch, "lib.mjs"), libBytes);
  const usage = runNode(MUTATE, ["suite.mjs"], { cwd: ROOT });
  ok("C10 the usage line on a missing argument", usage.status === 2 && /usage: node build\/mutate\.mjs <suite\.mjs> <mutants\.json>/.test(usage.stderr));
} finally {
  removeTempDir(scratch);
}

console.log(`test-mutate: ${passed} passed, ${failures.length} failed`);
if (failures.length) { console.error("failed: " + failures.join("; ")); process.exitCode = 1; }
