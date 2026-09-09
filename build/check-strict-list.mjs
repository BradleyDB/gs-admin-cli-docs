#!/usr/bin/env node
// check-strict-list.mjs — the strictNullChecks ratchet's two invariants, as a
// gate (GP-B5 W8/DS-46, review round). tsconfig.strict.json is the ratchet's
// RECORD (AGENTS.md tenet 5: "a file enters the strict list and never
// leaves"), but the record is not the surface by itself:
//   1. CLOSURE — tsc checks every file the listed ones import, so a listed
//      file that imports an unlisted .mjs pulls it into strict checking with
//      no admission, and a listed file dropping that import silently removes
//      it again. The program's local file set must EQUAL the `files` list;
//      a transitive file is admitted by naming it, never by accident.
//   2. FLOOR — the never-leaves rule as data: every path in STRICT_FLOOR must
//      be in the list. Removing a line from tsconfig.strict.json goes red
//      here until the floor is edited too — a deliberate two-place change,
//      never a quiet retreat (the SANCTIONED_* pattern).
// Runs the strict program ONCE (`--listFiles` type-checks as it lists), so
// `npm run typecheck` pays no extra tsc pass for the closure. tsc is the
// checker-only devDependency (tenet 5 carve-out): this gate runs only where
// `npm run typecheck` runs — it spawns tsc and imports nothing from it.
import { existsSync } from "node:fs";
import { join, resolve, relative, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT } from "./lib.mjs";

const CONFIG = process.env.STRICT_CONFIG ? resolve(process.env.STRICT_CONFIG) : join(ROOT, "tsconfig.strict.json");
const TSC = join(ROOT, "node_modules", "typescript", "lib", "tsc.js");
// The ratchet's floor — what may never leave. Grows with every admission.
const STRICT_FLOOR = [
  "plugins/gs-superadmin/scripts/doc-lib.mjs",
  "plugins/gs-superadmin/scripts/capture.mjs",
  "plugins/gs-superadmin/scripts/journal-lib.mjs",
  "plugins/gs-superadmin/scripts/manifest.mjs",
];

const fail = (msg) => { console.error(`check-strict-list: ${msg}`); process.exit(1); };
if (!existsSync(TSC)) fail("typescript is not installed — run `npm ci` first (the checker-only devDependency, AGENTS.md tenet 5)");
if (!existsSync(CONFIG)) fail(`${CONFIG} not found`);

const norm = (p) => {
  const r = relative(ROOT, resolve(p)).split("\\").join("/");
  return process.platform === "win32" ? r.toLowerCase() : r;
};
const tsc = (args) => spawnSync(process.execPath, [TSC, "-p", CONFIG, ...args], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 });

// The resolved `files` list, from tsc itself (the config carries comments, so
// no hand JSON parse). showConfig prints each file RELATIVE TO THE CONFIG'S
// DIRECTORY, not the cwd — resolve against dirname(CONFIG) (CI caught a
// cwd-relative resolution: the self-test's temp-dir config resolved to a
// path outside the tree on Linux, while Windows passed by a depth
// coincidence between the temp dir and the repo).
const shown = tsc(["--showConfig"]);
if (shown.status !== 0) fail(`tsc --showConfig failed:\n${shown.stdout}${shown.stderr}`);
const listed = (JSON.parse(shown.stdout).files ?? []).map((p) => norm(resolve(dirname(CONFIG), p)));
if (!listed.length) fail(`${CONFIG} lists no files — the ratchet's record is empty`);

// One strict run: type-check + the program's file list. The output interleaves
// the program's file lines with diagnostics, and a diagnostic line STARTS with
// a file path (`plugins/…/capture.mjs(353,38): error TS2322: …`) — under
// TypeScript 7 a grep for the plugin path read 3 listed files + 29 such lines
// (W8.5/DS-51, measured). The `error TS` exclusion below is what keeps the
// closure comparison reading only the program's files; the path-suffix test
// alone is not it (a diagnostic can end in a file name).
const run = tsc(["--listFiles"]);
const lines = (run.stdout + run.stderr).split(/\r?\n/).filter(Boolean);
const programFiles = lines.filter((l) => /\.(mjs|js|ts)$/i.test(l.trim()) && !/error TS\d+/.test(l)).map((l) => l.trim());
const errors = lines.filter((l) => /error TS\d+/.test(l));
const local = programFiles.map(norm).filter((p) => !p.startsWith("..") && !p.startsWith("node_modules/"));
if (run.status !== 0 || errors.length) {
  for (const e of errors) console.error(e);
  fail(`strictNullChecks reports ${errors.length} error(s) in the ratchet's files (above)`);
}

const problems = [];
const listedSet = new Set(listed);
for (const f of local) {
  if (!listedSet.has(f)) problems.push(`the strict program checks ${f}, which tsconfig.strict.json does not list — a listed file imports it. Admit it explicitly (add it to \`files\` and STRICT_FLOOR here) or it is strict by accident and leaves the moment the import does`);
}
const localSet = new Set(local);
for (const f of listed) {
  if (!localSet.has(f)) problems.push(`tsconfig.strict.json lists ${f}, but the strict program did not check it — the path is stale`);
}
for (const f of STRICT_FLOOR) {
  if (!listedSet.has(norm(join(ROOT, f)))) problems.push(`${f} is in STRICT_FLOOR but not in tsconfig.strict.json — a file never leaves the strict list (AGENTS.md tenet 5); restore it, or edit the floor here deliberately`);
}
if (problems.length) {
  for (const p of problems) console.error(`check-strict-list: ${p}`);
  process.exit(1);
}
console.log(`check-strict-list: strictNullChecks green over ${local.length} file(s); the strict program's local files equal the ${listed.length} listed (closure exact); floor ${STRICT_FLOOR.length}/${STRICT_FLOOR.length} present`);
