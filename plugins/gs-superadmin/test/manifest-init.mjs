#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// manifest-init.mjs — tests for scripts/manifest.mjs `init` (environment field)
//
// Covers: create-with-environment, legacy create (no field), backfill on
// re-init, never-overwrite of a recorded value, and invalid-value rejection.
// Fixtures live under the OS temp dir; no real state is touched.
//
// Run:  node plugins/gs-superadmin/test/manifest-init.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, rmSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "manifest.mjs");
const ROOT = join(tmpdir(), `gs-superadmin-manifest-fixtures-${process.pid}`);
rmSync(ROOT, { recursive: true, force: true });
mkdirSync(ROOT, { recursive: true });

function init(manifest, args) {
  const res = spawnSync(
    process.execPath,
    [SCRIPT, "init", "--manifest", manifest, ...args],
    { encoding: "utf8" }
  );
  let json = null;
  try {
    json = JSON.parse(res.stdout);
  } catch { /* non-JSON output (failure path) */ }
  return { code: res.status, json, stderr: res.stderr.trim() };
}

let failures = 0;
function check(label, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) {
    failures++;
    console.log(`      ${JSON.stringify(detail)}`);
  }
}

const mA = join(ROOT, "a", "_manifest.json");
const mB = join(ROOT, "b", "_manifest.json");
const mC = join(ROOT, "c", "_manifest.json");

// Create with environment
let r = init(mA, ["--slug", "a", "--base-url", "https://a.example", "--environment", "production"]);
check("create with --environment", r.code === 0 && r.json?.environment === "production", r);
check("environment persisted to disk", JSON.parse(readFileSync(mA, "utf8")).environment === "production", readFileSync(mA, "utf8"));

// Legacy create (no environment)
r = init(mB, ["--slug", "b", "--base-url", "https://b.example"]);
check("create without --environment → null", r.code === 0 && r.json?.environment === null, r);

// Backfill on re-init
r = init(mB, ["--slug", "b", "--base-url", "https://b.example", "--environment", "sandbox"]);
check("re-init backfills missing environment", r.code === 0 && r.json?.existed === true && r.json?.environment === "sandbox", r);

// Never overwrite a recorded value
r = init(mA, ["--slug", "a", "--base-url", "https://a.example", "--environment", "sandbox"]);
check("re-init never overwrites recorded environment", r.code === 0 && r.json?.environment === "production", r);

// Invalid value rejected
r = init(mC, ["--slug", "c", "--base-url", "https://c.example", "--environment", "staging"]);
check("invalid environment rejected (exit 1)", r.code === 1 && /production or sandbox/.test(r.stderr), r);

rmSync(ROOT, { recursive: true, force: true });

console.log(failures ? `\n${failures} failure(s)` : "\nAll manifest init checks passed");
process.exit(failures ? 1 : 0);
