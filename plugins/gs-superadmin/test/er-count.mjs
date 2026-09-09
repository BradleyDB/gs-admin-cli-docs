#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// er-count.mjs (test) — fixtures for scripts/er-count.mjs (GP-B5 DS-29).
//
// Covers: the largest-array selection on a jo-p-list-shaped envelope, the
// no-descent traversal contract (a list entry's own nested array must never
// outvote the entry array — the shipped counter measures arrays but does not
// walk into them), BOM tolerance (PS 5.1 redirects prepend one; the pre-DS-29
// transcription carried its own strip for exactly this), the no-arrays → 0
// case, and the failure-honesty contract: missing argument, extra argument,
// missing file, and malformed JSON each refuse loudly with exit 1 naming
// er-count.mjs — an unreadable page must be a FAILED sweep page, never
// "0 entries" (the silent under-count would end the sweep early and report a
// subset of PROCESSING programs as all of them).
//
// Fixtures live under the OS temp dir (shared rig) — no real state.
//
// Run:  node plugins/gs-superadmin/test/er-count.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeTempDir, removeTempDir, writeFiles, runNode } from "../../../test/rig.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "er-count.mjs");

let failures = 0;
function check(label, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) {
    failures++;
    console.log(`      ${JSON.stringify(detail)}`);
  }
}

const ROOT = makeTempDir("er-count-test");
try {
  writeFiles(ROOT, {
    // jo p list shape: rows at data.advancedOutreaches[], totals as siblings
    // (the measured envelope — census 2026-09-01/02; the pre-F-354 fixture
    // carried a fictional non-empty `aliases` sibling, which pinned the old
    // "largest array" GUESS: under the shared decision a second non-empty spine
    // array of a different length is a bundle and is refused — see bundle.json).
    "plist.json": JSON.stringify({
      data: {
        advancedOutreaches: [{ id: "p1" }, { id: "p2" }, { id: "p3" }],
        totalRecords: 3,
        totalPages: 1,
        pageNumber: 1,
      },
    }),
    // No-descent contract: 2 entries, the first carrying a 7-element nested
    // array. The count is 2 — a traversal that walks into entries prints 7.
    "nested.json": JSON.stringify({
      data: { rows: [{ steps: [1, 2, 3, 4, 5, 6, 7] }, { steps: [] }] },
    }),
    "no-arrays.json": JSON.stringify({ data: { total: 12, info: { ok: true } } }),
    // Spine rule (gate-3 F-351): a larger array OFF the spine (nested under a
    // non-data object) is not the entry array — the count is the spine rows.
    "off-spine.json": JSON.stringify({ data: { rows: [{ id: 1 }, { id: 2 }], meta: { columns: [1, 2, 3, 4, 5, 6] } } }),
    // F-354: rows NOWHERE on the spine — the shape capture refuses; this script
    // printed a silent 0 for it (dev @ bb24cc9 printed 3). One decision now.
    "no-spine.json": JSON.stringify({ result: { payload: { rows: [{ id: 1 }, { id: 2 }, { id: 3 }] } }, pageInfo: { totalRecords: 3 } }),
    // F-355: the jo-cta-options bundle shape (measured key names + lengths) —
    // this script answered 98 where capture refused.
    // F-351 round 4: the rp list envelope with a FILLED root-level alerts side
    // block — two distinct lengths on the spine: refused unless the rows path
    // is stated (the audit skill's reports fence states it).
    "rp-alert.json": JSON.stringify({ alerts: [{ level: "warn", message: "x" }], data: { data: [{ id: 1 }, { id: 2 }], pageInfo: { totalRecords: 2, pageSize: 200 } } }),
    // F-351 round 4: the tester's mirror — a CLI _rows view beside a data-level
    // array. Refused (both directions), never decided.
    "mirror.json": JSON.stringify({ _rows: Array.from({ length: 200 }, (_, i) => ({ id: i })), data: { facets: [{ f: 1 }, { f: 2 }, { f: 3 }] } }),
    "bundle.json": JSON.stringify({
      ctaTypes: Array(15).fill(0), ctaPriorities: Array(3).fill(0), ctaStatuses: Array(8).fill(0), ctaReasons: Array(57).fill(0),
      snoozeReasons: Array(3).fill(0), dueDateSkipOptions: Array(4).fill(0), commentOptions: Array(3).fill(0),
      entityTypes: Array(3).fill(0), userPools: Array(2).fill(0), flat: Array(98).fill(0),
    }),
    "bommed.json": Buffer.from("\uFEFF" + JSON.stringify({ items: [1, 2, 3, 4, 5] }), "utf8"),
    "broken.json": "{ not json",
  });
  const run = (...args) => runNode(SCRIPT, args, { cwd: ROOT });

  let r = run("plist.json");
  check("jo-p-list envelope: prints the entry-array length", r.status === 0 && r.stdout.trim() === "3", r);

  r = run("nested.json");
  check("no-descent: a nested array inside an entry never outvotes the entry array", r.status === 0 && r.stdout.trim() === "2", r);

  r = run("no-arrays.json");
  check("payload with no arrays prints 0", r.status === 0 && r.stdout.trim() === "0", r);

  r = run("off-spine.json");
  check("F-351 spine rule: a larger array off the envelope spine never outvotes the rows", r.status === 0 && r.stdout.trim() === "2", r);

  r = run("no-spine.json");
  check("F-354: rows only off the spine is REFUSED — exit 1 naming the off-spine path, never a silent 0",
    r.status === 1 && r.stdout.trim() === "" && /result\.payload\.rows/.test(r.stderr) && /FAILED sweep page/.test(r.stderr) && /er-count\.mjs/.test(r.stderr), r);
  r = run("no-spine.json", "--items-path", "result.payload.rows");
  check("F-354: --items-path names the rows array and the count is printed", r.status === 0 && r.stdout.trim() === "3", r);

  r = run("rp-alert.json");
  check("F-351 round 4: rp list with a filled alerts block is REFUSED unstated (two distinct lengths), exit 1, candidates named", r.status === 1 && r.stdout.trim() === "" && /"data\.data" \(2\), "alerts" \(1\)/.test(r.stderr), r);
  r = run("rp-alert.json", "--items-path", "data.data");
  check("F-351 round 4: the stated rows path decides it — 2", r.status === 0 && r.stdout.trim() === "2", r);
  r = run("mirror.json");
  check("F-351 round 4: the tester's mirror is REFUSED — never 3, never 200", r.status === 1 && r.stdout.trim() === "" && /"_rows" \(200\), "data\.facets" \(3\)/.test(r.stderr), r);
  r = run("mirror.json", "--items-path", "_rows");
  check("F-351 round 4: --items-path decides the mirror", r.status === 0 && r.stdout.trim() === "200", r);

  r = run("bundle.json");
  check("F-355: the bundle shape is REFUSED with the candidates largest first (the same reason capture prints), never 98",
    r.status === 1 && r.stdout.trim() === "" && /"flat" \(98\), "ctaReasons" \(57\)/.test(r.stderr) && /--items-path/.test(r.stderr) && !/e\.g\./.test(r.stderr), r);
  r = run("bundle.json", "--items-path", "ctaReasons");
  check("F-355: --items-path decides the bundle", r.status === 0 && r.stdout.trim() === "57", r);
  r = run("bundle.json", "--items-path", "nope");
  check("--items-path naming no array refuses, exit 1", r.status === 1 && /names no array/.test(r.stderr), r);
  r = run("bundle.json", "--items-path", "a[0]");
  check("--items-path must be a dotted key path", r.status === 1 && /dotted key path/.test(r.stderr), r);

  r = run("bommed.json");
  check("BOM'd payload (PS 5.1 redirect reality) parses and counts", r.status === 0 && r.stdout.trim() === "5", r);

  r = run();
  check("missing argument refuses with usage naming the script", r.status === 1 && /er-count\.mjs: usage/.test(r.stderr), r);

  r = run("plist.json", "extra.json");
  check("extra argument refuses with usage", r.status === 1 && /usage/.test(r.stderr), r);

  r = run("absent.json");
  check("missing file refuses loudly, naming the file, never printing a count",
    r.status === 1 && r.stderr.includes("absent.json") && /failed sweep page/.test(r.stderr) && r.stdout.trim() === "", r);

  r = run("broken.json");
  check("malformed JSON refuses loudly as a failed sweep page, not 0",
    r.status === 1 && r.stderr.includes("broken.json") && /failed sweep page/.test(r.stderr) && r.stdout.trim() === "", r);
} finally {
  removeTempDir(ROOT);
}

console.log("");
if (failures > 0) {
  console.log(`${failures} er-count check(s) FAILED`);
  process.exit(1);
}
console.log("All er-count checks passed");
