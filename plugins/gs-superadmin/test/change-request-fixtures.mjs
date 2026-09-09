#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// change-request-fixtures.mjs — offline checks for the change-request skill
//
// The skill itself is LLM-executed; what CAN be checked deterministically is
// the contract plumbing it depends on:
//   1. the vendored request-event validator accepts the vendored sample events
//      and the fixture request event (producer/consumer stay in agreement);
//   2. the validator rejects malformed events loudly (unknown schema version,
//      missing field) — the skill's stop-on-invalid step relies on this;
//   3. the fixture ticket's handoff block parses and equals request-event.json
//      (the ticket and the event are two renderings of one request);
//   4. every file the skill references exists where SKILL.md says it does.
//
// Run:  node plugins/gs-superadmin/test/change-request-fixtures.mjs
// Zero dependencies — Node built-ins only. No temp state outside tmpdir.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = join(HERE, "..", "skills", "change-request");
const VALIDATOR = join(SKILL, "scripts", "validate-request-event.mjs");
const FIXTURES = join(HERE, "fixtures", "change-request");
const TMP = join(tmpdir(), `gs-superadmin-change-request-fixtures-${process.pid}`);
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

let failures = 0;
function check(label, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) {
    failures++;
    console.log(`      ${JSON.stringify(detail)}`);
  }
}

function validate(...files) {
  const res = spawnSync(process.execPath, [VALIDATOR, ...files], { encoding: "utf8" });
  return { code: res.status, out: res.stdout.trim(), err: res.stderr.trim() };
}

// 1 — vendored samples + fixture event all pass the vendored validator
const valid = [
  join(SKILL, "references", "examples", "request-event.sample.json"),
  join(SKILL, "references", "examples", "request-event.minimal.sample.json"),
  join(SKILL, "references", "examples", "request-event.config-change.sample.json"),
  join(FIXTURES, "request-event.json"),
];
let r = validate(...valid);
check("vendored samples + fixture event validate", r.code === 0, r);

// 2a — unknown schema version is rejected loudly (never coerced)
const fixtureEvent = JSON.parse(readFileSync(join(FIXTURES, "request-event.json"), "utf8"));
const v2 = { ...fixtureEvent, schema: "request-event/v2" };
const v2Path = join(TMP, "unknown-schema.json");
writeFileSync(v2Path, JSON.stringify(v2));
r = validate(v2Path);
check("unknown schema version rejected (exit 1)", r.code === 1 && /schema/.test(r.err), r);

// 2b — a missing required field is rejected
const { justification: _omitted, ...noJustification } = fixtureEvent;
const missingPath = join(TMP, "missing-field.json");
writeFileSync(missingPath, JSON.stringify(noJustification));
r = validate(missingPath);
check("missing required field rejected (exit 1)", r.code === 1 && /justification/.test(r.err), r);

// 3 — the ticket's handoff block is the same event as request-event.json
const ticket = readFileSync(join(FIXTURES, "ticket.md"), "utf8");
const block = ticket.match(/\{code:json\}\s*([\s\S]*?)\s*\{code\}/);
check("ticket.md contains a handoff block", Boolean(block), "no {code:json}…{code} section found");
if (block) {
  let handoff = null;
  try {
    handoff = JSON.parse(block[1]);
  } catch (e) {
    check("handoff block parses as JSON", false, e.message);
  }
  if (handoff) {
    check(
      "handoff block equals request-event.json",
      JSON.stringify(handoff) === JSON.stringify(fixtureEvent),
      { handoffId: handoff.id, eventId: fixtureEvent.id }
    );
  }
}

// 4 — everything SKILL.md points at exists on disk
const referenced = [
  join(SKILL, "SKILL.md"),
  join(SKILL, "references", "request-event-schema.md"),
  join(SKILL, "references", "jira-ticket-anatomy.md"),
  join(SKILL, "references", "plan-template.md"),
  join(SKILL, "references", "completion-comment-template.md"),
  VALIDATOR,
  join(HERE, "..", "scripts", "journal.mjs"),
  join(HERE, "..", "scripts", "journal-lib.mjs"),
  join(FIXTURES, "kb", "acme-prod", "_manifest.json"),
  join(FIXTURES, "expected-plan.md"),
  join(FIXTURES, "expected-completion-comment.md"),
];
for (const f of referenced) {
  check(`exists: ${f.slice(f.indexOf("gs-superadmin"))}`, existsSync(f), f);
}

// The vendored docs still carry the frozen-contract markers
const schemaDoc = readFileSync(join(SKILL, "references", "request-event-schema.md"), "utf8");
check("vendored schema doc is v1 with canonical-source note",
  schemaDoc.includes('"request-event/v1"') && schemaDoc.includes("BradleyDB/CS_GTM_Tools"), null);
const anatomyDoc = readFileSync(join(SKILL, "references", "jira-ticket-anatomy.md"), "utf8");
check("vendored anatomy doc carries canonical-source note",
  anatomyDoc.includes("BradleyDB/CS_GTM_Tools") && anatomyDoc.includes("Handoff block"), null);

// 5 — change journal + trace-back (SA-2): the two JOURNAL.md writers agree, and
// the trace-back fixtures tell one coherent story about the same change.
// (Header parity between the hook and the SKILL.md fence is checked in
// guard-fixtures.mjs against the header the hook ACTUALLY writes at runtime —
// not against source text — so it isn't re-checked here.)

const skillDoc = readFileSync(join(SKILL, "SKILL.md"), "utf8");
const hookSrc = readFileSync(join(HERE, "..", "hooks", "gs-admin-guard.mjs"), "utf8");
check("SKILL.md execution step references the completion-comment template",
  skillDoc.includes("completion-comment-template.md"), null);

// The marker and the plan-completion entry (kind `change-plan execution`) go
// through scripts/journal.mjs —
// the executing LLM must invoke the verbs, never transcribe file contents.
check("SKILL.md execution step starts attribution via journal.mjs change-start",
  skillDoc.includes('.gs-superadmin/plugin/scripts/journal.mjs change-start'), null);
// F-040: the abort path no longer carries its own change-end — step 5 routes
// every stop into step 6's bookkeeping (partial outcome, stale marks, marker
// clear), so the invariant is one change-end plus the explicit routing text.
check("SKILL.md clears the marker via journal.mjs change-end (step-5 stops route through step 6)",
  (skillDoc.match(/\.gs-superadmin\/plugin\/scripts\/journal\.mjs change-end/g) ?? []).length >= 1 &&
  /still complete[\s\S]{0,40}step 6's bookkeeping with `--outcome partial`/.test(skillDoc), null);
check("SKILL.md appends the plan-completion (kind `change-plan execution`) entry via journal.mjs journal-append",
  skillDoc.includes('.gs-superadmin/plugin/scripts/journal.mjs journal-append'), null);
check("SKILL.md no longer hand-transcribes the marker JSON",
  !skillDoc.includes('"started_at"'), null);
check("SKILL.md no longer hand-transcribes the journal header",
  !skillDoc.includes("# Change journal —"), null);
check("SKILL.md no longer hand-transcribes the completion entry body",
  !skillDoc.includes("- kind: change-plan execution"), null);

// The hook's SYSTEM_AREAS map is a hand-copy of the component vocabulary in the
// vendored (frozen-contract) jira-ticket-anatomy.md §2 — the catalog has no
// component field to derive it from. Tie the copies together: every component
// the hook can emit must exist in the vendored table, so a contract re-vendor
// that renames or drops a component fails here instead of drifting silently.
const areasBlock = hookSrc.match(/const SYSTEM_AREAS = \{([\s\S]*?)\};/);
check("hook declares the SYSTEM_AREAS map", Boolean(areasBlock), null);
if (areasBlock) {
  const components = [...areasBlock[1].matchAll(/"(gs-[a-z-]+)"/g)].map((m) => m[1]);
  check("SYSTEM_AREAS map is non-empty", components.length >= 6, components);
  for (const c of components) {
    check(`system-area \`${c}\` exists in the vendored anatomy component table`,
      anatomyDoc.includes(`| \`${c}\` |`), c);
  }
}

// The expected completion comment must trace the same change as the expected plan:
// same created asset, same plan file, and a findable journal reference.
const expectedPlan = readFileSync(join(FIXTURES, "expected-plan.md"), "utf8");
const expectedComment = readFileSync(join(FIXTURES, "expected-completion-comment.md"), "utf8");
const createdAsset = "CTA|DRIVE|CSM Enterprise NPS Below 6 Risk Alert";
check("expected comment names the plan's created asset",
  expectedPlan.includes(createdAsset) && expectedComment.includes(createdAsset), null);
check("expected comment cites the plan file",
  expectedComment.includes("acme-prod/changes/2026-07-02-enterprise-nps-risk-cta.md"), null);
check("expected comment carries a journal reference with an entry timestamp",
  /changes\/JOURNAL\.md \(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\)/.test(expectedComment), null);
check("expected comment is for the fixture ticket",
  expectedComment.includes("CSOPS-142"), null);

// 6 — build-standards enforcement (live Finding J): the conventions-trigger rule is
// stated VERBATIM everywhere it is taught (skill, plan template, operating model,
// conventions index — all loaded into the same session, so they must agree), and the
// plan header discloses the conventions actually consulted plus the rule data-source
// mode ("Select an Object" via `set-source` escapes only through a LOSSY in-place
// conversion — live-verified on 1.0.7, F-104/PV-5; the honest header line is
// the forcing function that makes the skill load `query-building.md` before choosing).
const TRIGGER =
  "Choosing or altering a rule's data source is dataset work — load `query-building.md` first.";
const planTemplate = readFileSync(join(SKILL, "references", "plan-template.md"), "utf8");
const operatingModel = readFileSync(join(HERE, "..", "templates", "operating-model.md"), "utf8");
const conventionsIndex = readFileSync(join(HERE, "..", "templates", "conventions", "index.md"), "utf8");
for (const [name, text] of [
  ["SKILL.md", skillDoc],
  ["plan-template.md", planTemplate],
  ["operating-model.md", operatingModel],
  ["conventions/index.md", conventionsIndex],
]) {
  check(`data-source trigger rule verbatim in ${name}`, text.includes(TRIGGER), TRIGGER);
}
check("plan template header carries the Conventions consulted line",
  planTemplate.includes("- **Conventions consulted:** ⟨conventions-consulted⟩"), null);
check("plan template defines the honest empty value for Conventions consulted",
  planTemplate.includes("none — pack not adopted"), null);
check("plan template header carries the Data-source mode line with exactly the two modes",
  planTemplate.includes("set-source-template (Prepare Dataset)") &&
    planTemplate.includes("set-source (single-object — conversion is LOSSY, justification required)"), null);
check("SKILL.md states the lossy-conversion facts and the Prepare-Dataset equivalent",
  skillDoc.includes("conversion is LOSSY") &&
    skillDoc.includes("REPLACES") &&
    skillDoc.includes("never script") &&
    skillDoc.includes("set-source-template") &&
    skillDoc.includes("Prepare Dataset"), null);
check("SKILL.md names the Finding-J misclassification (set-source treated as rule authoring)",
  skillDoc.includes("misclassified `re r set-source`"), null);
check("expected plan demonstrates the Conventions consulted header line",
  expectedPlan.includes("- **Conventions consulted:** conventions/"), null);
check("expected plan demonstrates the Data-source mode header line (justified single-object)",
  expectedPlan.includes("- **Data-source mode:** set-source (single-object — conversion is LOSSY, justification required):"), null);
check("operating model states the set-source fact with the same terms as SKILL.md",
  operatingModel.includes('"Select an Object"') && skillDoc.includes('"Select an Object"') &&
    operatingModel.includes("set-source-template") && operatingModel.includes("Prepare Dataset"), null);

// 7 — journal outcome wording: the operating model quotes the hook's outcome
// strings verbatim; lock doc and hook together so a rewording in either file
// fails here instead of stranding the other.
for (const s of [
  "completed (success event; no exit code reported)",
  "FAILED (tool call failed",
  "not verified (harness reported no exit status)",
]) {
  check(`journal outcome wording agreed between hook and operating model: "${s}"`,
    hookSrc.includes(s) && operatingModel.includes(s), s);
}

// The fixture KB manifest has the shape scripts/manifest.mjs expects
const manifest = JSON.parse(readFileSync(join(FIXTURES, "kb", "acme-prod", "_manifest.json"), "utf8"));
check("fixture manifest shape (slug/baseUrl/environment/inventory)",
  manifest.slug === "acme-prod" &&
    typeof manifest.baseUrl === "string" &&
    ["production", "sandbox"].includes(manifest.environment) &&
    typeof manifest.inventory === "object" &&
    Object.values(manifest.inventory).every((e) => e.id && e.domain && e.status === "documented" && e.last_verified),
  manifest);

// …and every inventory entry's KB doc actually exists where the skill's impact-analysis
// step greps for it (<slug>/<domain>/<id>.md) — a metadata-only fixture would let the
// offline check pass while the KB walk finds nothing.
for (const entry of Object.values(manifest.inventory)) {
  const doc = join(FIXTURES, "kb", "acme-prod", entry.domain, `${entry.id}.md`);
  check(`KB doc exists for ${entry.domain}/${entry.id}`, existsSync(doc), doc);
}

rmSync(TMP, { recursive: true, force: true });

console.log(failures ? `\n${failures} failure(s)` : "\nAll change-request fixture checks passed");
process.exit(failures ? 1 : 0);
