// fake-gs-admin.mjs — a spawnable stand-in `gs-admin` for the engagement suite
// (ENG-2), answering from the fictional acme tenant in ./acme-tenant.mjs. The
// suite drives most scenarios through an in-process transport over the same
// answer(); this file is the same brain behind a real process, for the arms
// that are about the PROCESS: exit codes, resume across invocations, the token
// stop, and one-call-at-a-time.
//
// Environment:
//   FAKE_TENANT  JSON — the buildTenant() variant
//   FAKE_FAULTS  JSON — applyFaults() rules
//   FAKE_STATE   a directory: fault counters persist in faults.json, every
//                invocation appends its argv to argv.jsonl, and a lock file
//                marks a call in flight (a second call that finds it records
//                an overlap — the suite asserts there is none); saved reports
//                (rp create / update, NAT-2) persist in reports.json
import { readFileSync, writeFileSync, appendFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { buildTenant, answer, applyFaults } from "./acme-tenant.mjs";

const argv = process.argv.slice(2);
const state = process.env.FAKE_STATE;
const lock = state ? join(state, "in-flight.lock") : null;
if (state) {
  appendFileSync(join(state, "argv.jsonl"), JSON.stringify({ argv, overlap: existsSync(lock) }) + "\n");
  writeFileSync(lock, String(process.pid));
}

let res = null;
const rules = process.env.FAKE_FAULTS ? JSON.parse(process.env.FAKE_FAULTS) : [];
if (rules.length && state) {
  const file = join(state, "faults.json");
  const counts = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  res = applyFaults(rules, counts, argv);
  writeFileSync(file, JSON.stringify(counts));
}
let warning = "";
if (res?.warn) { warning = res.stderr; res = null; }
if (!res) {
  const tenant = buildTenant(process.env.FAKE_TENANT ? JSON.parse(process.env.FAKE_TENANT) : {});
  // Saved reports persist across invocations in the state folder (NAT-2).
  const reportsFile = state ? join(state, "reports.json") : null;
  if (reportsFile && existsSync(reportsFile)) for (const r of JSON.parse(readFileSync(reportsFile, "utf8"))) tenant.reports.set(r.id, r);
  res = answer(argv, tenant);
  if (reportsFile && tenant.reports.size) writeFileSync(reportsFile, JSON.stringify([...tenant.reports.values()]));
}

if (lock) rmSync(lock, { force: true });
const stderr = [warning, res.stderr].filter(Boolean).join("\n");
if (stderr) process.stderr.write(stderr + "\n");
// Exit in the write callback: stdout is asynchronous when it is a pipe, and a
// print-then-exit loses everything past the first chunk (F-356).
process.stdout.write(res.stdout ? res.stdout + "\n" : "", () => process.exit(res.status));
