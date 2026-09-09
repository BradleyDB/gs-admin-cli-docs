#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// sweep-twins.mjs — the consumer-parity class's INSTRUMENT (GP-B5 W10 / B14)
//
// Finds runs of identical (whitespace-normalized) lines shared by two
// production modules: the hand-copied-twin shape that produced F-306, F-310,
// F-311, F-349 and F-354/F-355 (a fix lands in one copy, the sibling drifts).
// The seeding run on dev @ 8220535 found the two deps surfaces' KB-identity
// read ALREADY drifted by one word (F-361), the two doc generators' whole main
// (F-360), the build lane's coverage-floor twin, and the scorecard walk
// declared "keep in sync" while its twin was an export.
//
// This is an INSTRUMENT, not a gate: its threshold (--min, default 5 lines)
// is a knob, and a knob is exactly what a defect-class ROW may not carry
// (build/defect-classes.mjs — a row is a pattern with zero false positives).
// The `Class: consumer-parity` recipe in AGENTS.md § Review-gate rules runs it
// per fix (~1 s) and pastes the run into the Fix note's `Sibling sweep:` line.
//
// Excluded by construction: test lanes (Class B — suites re-derive mechanisms
// as independent probes), the two generated verbatim copies (R-3 byte-identity
// is CI-enforced), the wiki bundle. Pairs whose sync mechanism is DECLARED
// print as "declared" with the mechanism; anything else is a candidate.
//
// Run:  node build/sweep-twins.mjs [--min <lines>] [--all]
//   --all  include the test lanes (noisy: rig boilerplate is identical by design)
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib.mjs";
import { isTest } from "./defect-classes.mjs";

const argv = process.argv.slice(2);
const minIdx = argv.indexOf("--min");
const MIN = minIdx === -1 ? 5 : Number.parseInt(argv[minIdx + 1], 10) || 5;
const ALL = argv.includes("--all");

// Pairs (or file sets) whose duplication is DECLARED, with the mechanism that
// keeps it honest — printed, never hidden. Keep this list short; it is not an
// allowance ledger (the tool is not a gate), it is the reader's context.
const DECLARED = [
  { files: ["build/lib.mjs", "plugins/gs-superadmin/scripts/doc-lib.mjs"], why: "isMainModule — the build lane cannot import doc-lib; check-doc-drift check 9's \"CLI-entry realpath test\" row sanctions both" },
  { files: ["plugins/gs-superadmin/hooks/gs-admin-guard.mjs", "plugins/gs-superadmin/scripts/doc-lib.mjs"], why: "the guard imports nothing (R-1); its catalog index / dirent follow / operator lookup copies are tenet-locked and named in doc-lib's sanctioned-duplicates header" },
  { files: ["plugins/gs-superadmin/hooks/gs-admin-guard.mjs", "plugins/gs-superadmin/scripts/journal.mjs"], why: "operator lookup — the guard imports nothing (R-1)" },
  // F-362's accepted residue (B17): declared here rather than in the bus entry
  // so the instrument, not prose, says what is known.
  { files: ["plugins/gs-superadmin/scripts/jo-report.mjs", "plugins/gs-superadmin/scripts/tenant-deps.mjs"], why: "normCondition / normalizeCondition — comment-only sync at tenant-deps' definition, different consumers (tenant-deps' carries objectLabel); and tenant-deps is a different report consumer (own H1, KB-derived header, a --kb rerun) — its write-report/csv-dir lines are the fs idiom, not the F-362 mode tail" },
  { files: ["plugins/gs-superadmin/scripts/capture.mjs", "plugins/gs-superadmin/scripts/describe-batch.mjs"], why: "the spawnSync failure-why block — two CLI spawners with different stdio contracts (capture streams stderr through; describe-batch captures it) sharing one timeout/exit spelling" },
];
// A declared pair is two DISTINCT files: an intra-file run in a declared file is
// never covered by a cross-module sync mechanism (W10 review round).
const declaredWhy = (a, b) => (a === b ? null : DECLARED.find((d) => d.files.includes(a) && d.files.includes(b))?.why ?? null);

const EXCLUDE = (f) =>
  f.startsWith("build/wiki-assets/") ||
  /^plugins\/gs-superadmin\/scripts\/(extract-catalog|render-cheatsheet)\.mjs$/.test(f) ||
  (!ALL && isTest(f));

// execFileSync argv, never execSync: an unquoted *.mjs through a POSIX shell is
// glob-expanded against the repo root before git sees it (F-095).
const files = execFileSync("git", ["ls-files", "-z", "--", "*.mjs"], { cwd: ROOT, encoding: "utf8" })
  .split("\0")
  .filter((f) => f && !EXCLUDE(f));

const norm = (l) => l.replace(/\s+/g, " ").trim();
// Lines that carry no design: short, structural, or import/export scaffolding.
const trivial = (l) =>
  l.length < 24 ||
  /^(import |export \{|\/\/|\* |\/\*\*|\}\)?;?$|\};?$|\);?$|\],?$|\}\)?,?$|break;$|continue;$|return;?$)/.test(l);

/** @type {Record<string, string[]>} */
const lines = Object.fromEntries(files.map((f) => [f, readFileSync(join(ROOT, f), "utf8").split(/\r?\n/).map(norm)]));
/** @type {Map<string, Array<[string, number]>>} */
const index = new Map();
for (const f of files) lines[f].forEach((l, i) => { if (trivial(l)) return; (index.get(l) ?? index.set(l, []).get(l)).push([f, i]); });

const runs = [];
for (let a = 0; a < files.length; a++) {
  for (let b = a; b < files.length; b++) {
    const fa = files[a], fb = files[b];
    const seen = new Set();
    lines[fa].forEach((l, i) => {
      if (trivial(l)) return;
      for (const [g, j] of index.get(l) ?? []) {
        if (g !== fb || (fa === fb && j <= i) || seen.has(`${i}:${j}`)) continue;
        let k = 0;
        while (i + k < lines[fa].length && j + k < lines[fb].length && lines[fa][i + k] === lines[fb][j + k]) { seen.add(`${i + k}:${j + k}`); k++; }
        const nontriv = lines[fa].slice(i, i + k).filter((x) => !trivial(x)).length;
        if (k >= MIN && nontriv >= Math.ceil(MIN * 0.6)) runs.push({ fa, ia: i + 1, fb, ib: j + 1, k, nontriv, why: declaredWhy(fa, fb) });
      }
    });
  }
}
runs.sort((x, y) => y.k - x.k);
const candidates = runs.filter((r) => !r.why);
console.log(`sweep-twins: ${files.length} module(s)${ALL ? " (test lanes included)" : ""}, runs of >= ${MIN} identical lines: ${runs.length} (${candidates.length} undeclared)`);
for (const r of runs) {
  console.log(`  ${String(r.k).padStart(3)} lines (${r.nontriv} non-trivial): ${r.fa}:${r.ia} == ${r.fb}:${r.ib}${r.why ? `  [declared: ${r.why}]` : ""}`);
}
if (!runs.length) console.log("  (none)");
