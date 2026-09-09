#!/usr/bin/env node
// VENDORED COPY — do not edit here. Canonical: BradleyDB/CS_GTM_Tools main →
// task_mgr/scripts/validate-request-event.mjs (schema v1, vendored 2026-07-02).
// Validates request-event JSON files against request-event-schema.md (v1).
// Zero dependencies. Usage:
//   node scripts/validate-request-event.mjs <file.json> [more.json …]
//   node scripts/validate-request-event.mjs references/examples/*.json
// Exit 0 = all valid; exit 1 = any invalid.

import { readFileSync } from "node:fs";

const SOURCES = ["slack", "email", "meeting", "gainsight-skill", "manual"];
const CATEGORIES = ["config-change", "report-request", "data-quality", "feature-ask", "process", "question"];
const STATUSES = ["new", "triaged", "ticketed", "done", "declined"];
const ROLE_TIERS = ["ic", "manager", "exec"];
const FIELDS = [
  "schema", "id", "source", "source_link", "requester", "requested_at", "wanted_by",
  "summary", "body", "justification", "accounts", "category", "repeat_of",
  "requester_context", "status",
];

const isStr = (v) => typeof v === "string" && v.length > 0;
const isStrOrNull = (v) => v === null || isStr(v);
// Full ISO 8601 timestamp (date + time).
const isTimestamp = (v) => isStr(v) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) && !Number.isNaN(Date.parse(v));
// Date or timestamp.
const isDateish = (v) => isStr(v) && /^\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(Date.parse(v));

function validate(ev) {
  const errs = [];
  const err = (m) => errs.push(m);

  if (typeof ev !== "object" || ev === null || Array.isArray(ev)) return ["not a JSON object"];

  for (const f of FIELDS) if (!(f in ev)) err(`missing field: ${f} (use null/[]/"unknown" — never omit)`);
  for (const k of Object.keys(ev)) if (!FIELDS.includes(k)) err(`unknown field: ${k}`);
  if (errs.length) return errs; // don't type-check what's missing

  if (ev.schema !== "request-event/v1") err(`schema must be "request-event/v1", got ${JSON.stringify(ev.schema)}`);
  if (!isStr(ev.id)) err("id must be a non-empty string");
  if (!SOURCES.includes(ev.source)) err(`source must be one of ${SOURCES.join("|")}`);
  if (!isStr(ev.source_link)) err('source_link must be a non-empty string ("unknown" when truly none)');

  const r = ev.requester;
  if (typeof r !== "object" || r === null || !isStr(r.name) || !isStrOrNull(r.role) || !isStrOrNull(r.team)) {
    err('requester must be { name: str, role: str|null, team: str|null } with non-empty name ("unknown" ok)');
  }

  if (!isTimestamp(ev.requested_at)) err("requested_at must be an ISO 8601 timestamp");
  if (!(ev.wanted_by === null || ev.wanted_by === "asap" || isDateish(ev.wanted_by))) {
    err('wanted_by must be an ISO date, "asap", or null (= no date given)');
  }
  if (!isStr(ev.summary)) err("summary must be a non-empty string");
  if (!isStr(ev.body)) err("body must be a non-empty string");

  const j = ev.justification;
  if (!(j === null || (typeof j === "object" && isStr(j.text) && ["requester", "ai-inferred"].includes(j.stated_by)))) {
    err('justification must be null or { text: str, stated_by: "requester"|"ai-inferred" }');
  }

  if (!Array.isArray(ev.accounts) || ev.accounts.some((a) => typeof a !== "object" || a === null || !isStr(a.name) || !isStrOrNull(a.id))) {
    err("accounts must be an array of { name: str, id: str|null }");
  }
  if (!(ev.category === null || CATEGORIES.includes(ev.category))) {
    err(`category must be null or one of ${CATEGORIES.join("|")}`);
  }
  if (!Array.isArray(ev.repeat_of) || ev.repeat_of.some((p) => typeof p !== "object" || p === null || !isStr(p.ref) || !isDateish(p.date))) {
    err("repeat_of must be an array of { ref: str, date: ISO date }");
  }

  const rc = ev.requester_context;
  if (!(rc === null || (typeof rc === "object" && ROLE_TIERS.includes(rc.role_tier) && isStrOrNull(rc.book_arr_band) && isStrOrNull(rc.segment)))) {
    err('requester_context must be null or { role_tier: "ic"|"manager"|"exec", book_arr_band: str|null, segment: str|null }');
  }
  if (!STATUSES.includes(ev.status)) err(`status must be one of ${STATUSES.join("|")}`);

  return errs;
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: node scripts/validate-request-event.mjs <file.json> [more.json …]");
  process.exit(1);
}

let failed = false;
for (const file of files) {
  let errs;
  try {
    // Tolerate a UTF-8 BOM — common in Windows-authored files, fatal to JSON.parse.
    errs = validate(JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, "")));
  } catch (e) {
    errs = [`unreadable or invalid JSON: ${e.message}`];
  }
  if (errs.length) {
    failed = true;
    console.error(`✗ ${file}`);
    for (const m of errs) console.error(`    ${m}`);
  } else {
    console.log(`✓ ${file}`);
  }
}
// The script ends here, so the exit code rides process.exitCode and the
// per-file lines flush before the process ends — never process.exit after a
// stdout write (a macOS pipe drops what the first chunk did not carry; F-360).
process.exitCode = failed ? 1 : 0;
