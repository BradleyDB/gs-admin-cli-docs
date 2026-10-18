// fake-gs-admin.mjs — a spawnable stand-in `gs-admin` for the engagement suite
// (ENG-2), answering from the fictional acme tenant in ./acme-tenant.mjs. The
// suite drives most scenarios through an in-process transport over the same
// answer(); this file is the same brain behind a real process, for the arms
// that are about the PROCESS: exit codes, resume across invocations, the token
// stop, and one-call-at-a-time.
//
// Environment:
//   FAKE_TENANT  JSON — the buildTenant() variant
//   FAKE_FAULTS  JSON — applyFaults() rules; a rule of kind "deny-delete" is a
//                HOOK, not a fault (F-557's arm): when the call matches, the
//                named file is made undeletable by its owner on Windows (an
//                icacls deny of DELETE on the file and of DELETE_CHILD on its
//                folder, to Everyone — what a handle that forbids delete does
//                to a lock mid-refresh; the test removes both) and the call then
//                answers as usual; on POSIX, where no per-file rule forbids an
//                unlink while the folder stays writable, it does nothing
//   FAKE_STATE   a directory: fault counters persist in faults.json, every
//                invocation appends its argv to argv.jsonl, and a lock file
//                marks a call in flight (a second call that finds it records
//                an overlap — the suite asserts there is none); saved reports
//                (rp create / update, NAT-2) persist in reports.json
import { readFileSync, writeFileSync, appendFileSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { buildTenant, answer, applyFaults } from "./acme-tenant.mjs";

const argv = process.argv.slice(2);
const state = process.env.FAKE_STATE;
const lock = state ? join(state, "in-flight.lock") : null;
if (state) {
  appendFileSync(join(state, "argv.jsonl"), JSON.stringify({ argv, overlap: existsSync(lock) }) + "\n");
  writeFileSync(lock, String(process.pid));
}

let res = null;
const allRules = process.env.FAKE_FAULTS ? JSON.parse(process.env.FAKE_FAULTS) : [];
// The deny-delete hooks fire here, once per matching call, and never reach applyFaults (they answer nothing).
for (const r of allRules.filter((x) => x.kind === "deny-delete")) {
  if (![].concat(r.match).every((m) => argv.join(" ").includes(m))) continue;
  // Both halves, since Windows allows a delete through EITHER the file's DELETE right or its folder's DELETE_CHILD:
  // the folder's deny is on the folder alone (not inherited), so its other files stay deletable and replaceable.
  if (process.platform === "win32" && existsSync(r.path)) for (const [target, right] of [[dirname(r.path), "DC"], [r.path, "DE"]]) spawnSync("icacls", [target, "/deny", `*S-1-1-0:(${right})`], { encoding: "utf8" });
}
const rules = allRules.filter((x) => x.kind !== "deny-delete");
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
