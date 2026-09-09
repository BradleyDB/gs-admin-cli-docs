#!/usr/bin/env node
// Fixture tests for build/check-strict-list.mjs (GP-B5 W8/DS-46, review
// round): the strictNullChecks ratchet's gate must go red on both invariants
// it claims, or a green run proves nothing (the DS-18 pattern — every gate is
// pinned by mutants). Each arm points the gate at a scratch config through the
// STRICT_CONFIG override; the scratch config extends the real base by absolute
// path and lists real files by absolute path, so the gate's own ROOT-relative
// normalization is what is under test, not a copy of it. Needs `npm ci`
// (tsc), like the gate.
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { ROOT } from "./lib.mjs";

const GATE = join(ROOT, "build", "check-strict-list.mjs");
let passed = 0;
const failures = [];
const ok = (name, cond, detail) => {
  if (cond) passed++;
  else { failures.push(name); if (detail) console.error("  " + String(detail).slice(0, 600)); }
};
const run = (config) => spawnSync(process.execPath, [GATE], {
  cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20,
  env: { ...process.env, ...(config ? { STRICT_CONFIG: config } : {}) },
});
const abs = (rel) => join(ROOT, rel).split("\\").join("/");
const config = (dir, name, files) => {
  const p = join(dir, name);
  // typeRoots pinned to the repo's node_modules: the base config's
  // `types: ["node"]` resolves from the CONFIG's directory, and a temp-dir
  // config would otherwise fail on TS2688 before the gate's own logic runs.
  writeFileSync(p, JSON.stringify({
    extends: abs("tsconfig.json"),
    compilerOptions: { strictNullChecks: true, typeRoots: [abs("node_modules/@types")] },
    include: [],
    files: files.map(abs),
  }));
  return p;
};

const scratch = mkdtempSync(join(tmpdir(), "strict-list-test-"));
try {
  // Control: the committed config is closure-exact and floor-complete.
  const control = run(null);
  ok("control: the committed tsconfig.strict.json passes (closure exact, floor present)",
    control.status === 0 && /closure exact/.test(control.stdout), control.stdout + control.stderr);

  // CLOSURE: a config listing only capture.mjs still type-checks doc-lib.mjs
  // and journal-lib.mjs through capture's imports — the gate must name both.
  const closure = run(config(scratch, "closure.json", ["plugins/gs-superadmin/scripts/capture.mjs"]));
  ok("closure: a listed file pulling unlisted imports into the strict program goes red, naming the unlisted files",
    closure.status === 1 && /doc-lib\.mjs, which tsconfig\.strict\.json does not list/.test(closure.stderr) &&
      /journal-lib\.mjs, which tsconfig\.strict\.json does not list/.test(closure.stderr),
    closure.stdout + closure.stderr);

  // FLOOR: a config that IS closure-exact (journal-lib imports nothing) but
  // has dropped doc-lib.mjs and capture.mjs from the list — the ratchet's
  // never-leaves rule must catch the retreat by name.
  const floor = run(config(scratch, "floor.json", ["plugins/gs-superadmin/scripts/journal-lib.mjs"]));
  ok("floor: a floor file dropped from the list goes red, naming it, even when the shrunken program is closure-exact",
    floor.status === 1 && /doc-lib\.mjs is in STRICT_FLOOR but not in tsconfig\.strict\.json/.test(floor.stderr) &&
      /capture\.mjs is in STRICT_FLOOR but not in tsconfig\.strict\.json/.test(floor.stderr) &&
      !/does not list/.test(floor.stderr),
    floor.stdout + floor.stderr);

  // A stale path in the list is a loud tsc error, never a silent shrink.
  const stale = run(config(scratch, "stale.json", [
    "plugins/gs-superadmin/scripts/doc-lib.mjs", "plugins/gs-superadmin/scripts/capture.mjs",
    "plugins/gs-superadmin/scripts/journal-lib.mjs", "plugins/gs-superadmin/scripts/zz-gone.mjs",
  ]));
  ok("stale: a listed path that does not exist goes red", stale.status === 1, stale.stdout + stale.stderr);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`✗ ${failures.length} assertion(s) failed:`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error(`(${passed} passed)`);
  process.exit(1);
}
console.log(`✓ strict-list gate fixtures: ${passed}/${passed} assertions passed`);
