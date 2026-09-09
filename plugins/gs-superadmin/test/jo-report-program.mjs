#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// jo-report-program.mjs (test) — fixture tests for scripts/jo-report-program.mjs
// (ER-5 of the email-report program).
//
// Covers: the resolution ladder (exact id → exact ci name → substring;
// multi-match → ambiguities[], never guessed; not-found → warning; two
// queries resolving to one program dedupe), shallow default (step-flow table,
// email steps title+subject only, NO bodies), --deep body/variant passthrough
// to markdown (S2-confirmed: full bodies inline, no truncation), the C2 CSV
// rule (body_chars + doc path, never body text), missing-template fetch
// hints, stub-program caveats, and usage errors. Fixture is a hand-built
// C1 v1 index under the OS temp dir; all data fictional.
//
// Run:  node plugins/gs-superadmin/test/jo-report-program.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { resolveProgram, renderProgram, fencedBlock } from "../scripts/jo-report-program.mjs";

const JO_REPORT = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "jo-report.mjs");
const ROOT = join(tmpdir(), `gs-superadmin-jo-report-program-${process.pid}`);
rmSync(ROOT, { recursive: true, force: true });
mkdirSync(ROOT, { recursive: true });

let failures = 0;
function check(label, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) {
    failures++;
    console.log(`      ${JSON.stringify(detail)?.slice(0, 400)}`);
  }
}

// ── fixture: a hand-built C1 v1 index ────────────────────────────────────────

const step = (order, over = {}) => ({
  order, stepId: `s${order}`, stepName: null, stepType: null, actionType: null,
  outboundAction: null, emailTemplateId: null, emailTemplateName: null,
  variantTemplateIds: [], timer: null, ...over,
});
const FULL_BODY = 'FULL_BODY_MARKER — the entire plain-text body, with | pipes, "quotes" and\ntwo lines.';
const VARIANT_BODY = "VARIANT_BODY_MARKER text of the doc-variant.";
const ALT_BODY = "ALT_BODY_MARKER body of the variant-mapped template.";
const INDEX = {
  generatedAt: "2026-07-12T00:00:00.000Z", liveSweepAt: null,
  slug: "fixture-tenant", baseUrl: "https://fixture-tenant.example.com", environment: "sandbox",
  programs: {
    "prog-1": {
      id: "prog-1", name: "Renewal Outreach | Enterprise", status: "PROCESSING", statusSource: "kb",
      model: "DRIPV2", modelName: "Email Chain", startDate: 1670000000000, depth: "full",
      docPath: "fixture-tenant/journey/prog-1.md", lastVerified: null, schedules: [], sources: [],
      steps: [
        step(1, { stepName: "Start", stepType: "START" }),
        step(2, {
          stepName: "Send Email", stepType: "ACTION", actionType: "OUTBOUND_CALL", outboundAction: "SEND_EMAIL",
          emailTemplateId: "tpl-main", emailTemplateName: "Main Template", variantTemplateIds: ["tpl-main", "tpl-alt"],
          // C1 v2 (ER-15/ER-17): program-side bindings + bound survey
          tokens: [
            { tokenKey: "subj::gs-p1", kind: "field", label: "Bound Label", objectName: "obj", fieldName: "f1", fieldId: null, survey: null },
          ],
          boundAssets: [{ type: "SURVEY", id: "SVY-9", name: "Renewal Survey" }],
        }),
        step(3, { stepName: "Wait", stepType: "TIMER", timer: { timerType: "SINGLE", timerValue: "P3D", uiTimerValue: "3 days" } }),
        step(4, {
          stepName: "Send Missing", stepType: "ACTION", actionType: "OUTBOUND_CALL", outboundAction: "SEND_EMAIL",
          emailTemplateId: "tpl-gone", emailTemplateName: "Gone Template",
        }),
        // applyEmailRefs can yield variantTemplateIds with NO primary
        // emailTemplateId — the first variant must not be promoted to primary
        step(5, {
          stepName: "Variant Only", stepType: "ACTION", actionType: "OUTBOUND_CALL", outboundAction: "SEND_EMAIL",
          variantTemplateIds: ["tpl-alt"],
        }),
        step(6, { stepName: "End", stepType: "END" }),
      ],
    },
    "prog-2": {
      id: "prog-2", name: "Renewal Outreach | SMB", status: "PAUSE", statusSource: "kb",
      model: "DYNAMIC_PROGRAM", modelName: null, startDate: null, depth: "full",
      docPath: "fixture-tenant/journey/prog-2.md", lastVerified: null, schedules: [], sources: [], steps: [step(1, { stepType: "START" })],
    },
    "prog-stub": {
      id: "prog-stub", name: "Stubby", status: null, statusSource: "kb", model: null, modelName: null,
      startDate: null, depth: "stub", docPath: "fixture-tenant/journey/prog-stub.md", lastVerified: null,
      schedules: [], sources: [], steps: [],
    },
  },
  templates: {
    "tpl-main": {
      id: "tpl-main", title: "Main Template", subject: "Hello there ${subj::gs-p1}", folderId: null, active: true,
      body: FULL_BODY, variants: [{ name: "Variant B", subject: "VB subj", body: VARIANT_BODY }],
      // author labels (C1 v2): the program's "Bound Label" must WIN over
      // "Author Label" in program context; the author-only token renders in
      // the Tokens table as unbound
      tokens: [
        { tokenKey: "subj::gs-p1", displayName: "Author Label", defaultValue: "Dflt", tokenType: "STANDARD", variant: "Default", survey: null },
        { tokenKey: "embd::gs-author-only", displayName: "Author Only", defaultValue: null, tokenType: "STANDARD", variant: "Default", survey: null },
      ],
      docPath: "fixture-tenant/journey-email-templates/tpl-main.md", bodyIncluded: true,
    },
    "tpl-alt": {
      id: "tpl-alt", title: "Alt Template", subject: "Alt subject", folderId: null, active: true,
      body: ALT_BODY, variants: [], docPath: "fixture-tenant/journey-email-templates/tpl-alt.md", bodyIncluded: true,
    },
  },
  links: {
    templateToPrograms: { "tpl-main": ["prog-1"], "tpl-alt": ["prog-1"], "tpl-gone": ["prog-1"] },
    programToTemplates: { "prog-1": ["tpl-alt", "tpl-gone", "tpl-main"] },
  },
  gaps: { referencedTemplatesMissing: ["tpl-gone"], stubs: ["prog-stub"], liveOnly: [], kbOnly: [], statusDrift: [] },
  parseErrors: [],
};
const INDEX_PATH = join(ROOT, "er-index.json");
writeFileSync(INDEX_PATH, JSON.stringify(INDEX));

// ── resolution ladder ────────────────────────────────────────────────────────

check("resolve: exact id wins first", resolveProgram(INDEX, "prog-1").resolvedBy === "id" && resolveProgram(INDEX, "prog-1").matches[0].id === "prog-1", resolveProgram(INDEX, "prog-1"));
{
  const r = resolveProgram(INDEX, "renewal outreach | enterprise");
  check("resolve: exact name, case-insensitive", r.resolvedBy === "name" && r.matches.length === 1 && r.matches[0].id === "prog-1", r);
}
{
  const r = resolveProgram(INDEX, "Renewal Outreach");
  check("resolve: substring multi-match returned, never guessed", r.resolvedBy === "substring" && r.matches.length === 2, r.matches.map((m) => m.id));
}
{
  const r = resolveProgram(INDEX, "smb");
  check("resolve: unique substring resolves", r.resolvedBy === "substring" && r.matches.length === 1 && r.matches[0].id === "prog-2", r);
}
check("resolve: no match → empty", resolveProgram(INDEX, "does-not-exist").matches.length === 0 && resolveProgram(INDEX, "does-not-exist").resolvedBy === null, null);
{
  // JSON.parse'd programs{} inherits Object.prototype — a query naming a
  // prototype member must fall through the ladder, never "resolve" to it
  const r = resolveProgram(INDEX, "constructor");
  check("resolve: 'constructor' never resolves via the prototype chain", r.matches.length === 0 && r.resolvedBy === null, r);
}

// ── rendering units ──────────────────────────────────────────────────────────

check("fencedBlock: plain body gets a 3-backtick fence", fencedBlock("hello").startsWith("```text\n"), fencedBlock("hello"));
check("fencedBlock: body containing ``` gets a longer fence", fencedBlock("a\n```\nb").startsWith("````text\n"), fencedBlock("a\n```\nb"));

{
  const shallow = renderProgram(INDEX.programs["prog-1"], INDEX, { deep: false });
  check("render shallow: step table with title + subject, no body", shallow.section.includes("email: Main Template") && shallow.section.includes("subject: Hello there") && !shallow.section.includes("FULL_BODY_MARKER"), shallow.section.slice(0, 500));
  check("render shallow: timer + missing-doc detail lines", shallow.section.includes("timer: 3 days") && shallow.section.includes("email: Gone Template (no KB doc)"), shallow.section);
  check("render: email rows — 2 (step 2) + 1 (missing) + 1 (variant-only) = 4", shallow.emailRows.length === 4 && shallow.emailRows.filter((r) => r.role === "variant").length === 2 && shallow.emailRows.find((r) => r.templateId === "tpl-gone")?.bodyChars === null, shallow.emailRows);
  check("render: variant-only step never promotes its variant to primary", shallow.emailRows.find((r) => r.stepOrder === 5)?.role === "variant" && shallow.section.includes("email (variant-mapped only): Alt Template"), shallow.emailRows.find((r) => r.stepOrder === 5));
  check("render: missing template id collected", [...shallow.missingIds].join(",") === "tpl-gone", [...shallow.missingIds]);
  // ER-15: the program binding WINS over the template's author label in
  // program context, in the shallow step table too
  check("render shallow: subject resolves via the PROGRAM binding, not the author label", shallow.section.includes("subject: Hello there {Bound Label}") && !shallow.section.includes("{Author Label}") && !shallow.section.includes("${subj::gs-p1}"), shallow.section.slice(0, 600));
  // ER-17: survey column in the step table (name only, no URL)
  check("render shallow: step-table survey column carries the bound survey name", shallow.section.includes("| Renewal Survey |") && !shallow.section.includes("SurveyResponse"), shallow.section);
  check("render: email rows carry the ER-17 trio (bound rows) and false/blank on unbound steps", shallow.emailRows.find((r) => r.stepOrder === 2)?.surveyBound === true && shallow.emailRows.find((r) => r.stepOrder === 2)?.surveyNames === "Renewal Survey" && shallow.emailRows.find((r) => r.stepOrder === 2)?.surveyIds === "SVY-9" && shallow.emailRows.find((r) => r.stepOrder === 4)?.surveyBound === false && shallow.emailRows.find((r) => r.stepOrder === 4)?.surveyNames === "", shallow.emailRows.map((r) => [r.stepOrder, r.surveyBound, r.surveyNames]));
  const deep = renderProgram(INDEX.programs["prog-1"], INDEX, { deep: true });
  check("render deep: full body passthrough (no truncation)", deep.section.includes(FULL_BODY) && deep.section.includes(ALT_BODY), null);
  check("render deep: doc-variant name + subject + body", deep.section.includes("Variant: Variant B") && deep.section.includes("VB subj") && deep.section.includes(VARIANT_BODY), null);
  check("render deep: missing template → fetch hint, not silence", deep.section.includes("no KB doc — body not available") && deep.section.includes("jo email template --id 'tpl-gone'"), null);
  // ER-17: deep section names the survey with its id
  check("render deep: Survey: <name> (<id>) line", deep.section.includes("Survey: Renewal Survey (SVY-9)"), deep.section);
  // ER-15: the per-email Tokens table — raw id → label → bound source →
  // default; author-only tokens shown as unbound
  check("render deep: Tokens table rows (bound + author-only)", deep.section.includes("| subj::gs-p1 | Bound Label | obj.f1 | Dflt |") && deep.section.includes("| embd::gs-author-only | Author Only | (template author label — no program binding) | — |"), deep.section);
  const stub = renderProgram(INDEX.programs["prog-stub"], INDEX, { deep: true });
  check("render: stub program flagged, no step table", stub.section.includes("stub") && stub.section.includes("step flow not captured") && stub.emailRows.length === 0, stub.section);
}

// ── CLI end-to-end through the dispatcher ────────────────────────────────────

const runCli = (...args) => {
  const res = spawnSync(process.execPath, [JO_REPORT, ...args], { encoding: "utf8" });
  let summary = null;
  try { summary = JSON.parse(res.stdout); } catch { /* asserted by callers */ }
  return { res, summary };
};

{
  const rDir = join(ROOT, "r-shallow");
  const cDir = join(ROOT, "c-shallow");
  const { res, summary } = runCli("program", "--index", INDEX_PATH, "--name", "prog-1", "--report", rDir, "--csv-dir", cDir);
  check("cli shallow: exit 0 + C2 summary keys + counts", res.status === 0 && summary?.ok === true && summary?.mode === "program" && summary?.counts?.requested === 1 && summary?.counts?.resolved === 1 && summary?.counts?.emailRows === 4 && summary?.counts?.templatesMissing === 1, { status: res.status, stderr: res.stderr, counts: summary?.counts });
  const md = readFileSync(summary.reportPath, "utf8");
  check("cli shallow: program header bullets (status/active/model)", md.includes("## Renewal Outreach | Enterprise".replace("|", "|")) && md.includes("status: PROCESSING (kb) — active: yes") && md.includes("model: Email Chain (`DRIPV2`)"), md.slice(0, 700));
  check("cli shallow: bodies omitted + --deep caveat", !md.includes("FULL_BODY_MARKER") && md.includes("re-run with `--deep`"), null);
  check("cli shallow: missing-template caveat with fetch hint", md.includes("1 referenced template(s) have no KB doc") && md.includes("tpl-gone"), md);
  check("cli shallow: KB-cached status caveat scoped to resolved programs", md.includes("1 of 1 resolved program status(es) are KB-cached"), null);
  const steps = readFileSync(join(cDir, "program-steps.csv"), "utf8");
  const emails = readFileSync(join(cDir, "program-emails.csv"), "utf8");
  check("cli: steps CSV one row per step", steps.trim().split("\r\n").length === 1 + 6, steps);
  check("cli: emails CSV — C2 body substitution (body_chars + doc path, never body)", !emails.includes("FULL_BODY_MARKER") && emails.includes(`,${FULL_BODY.length},`) && emails.includes("fixture-tenant/journey-email-templates/tpl-main.md"), emails);
  check("cli: emails CSV — variant-mapped row present", emails.includes("variant") && emails.includes("tpl-alt"), emails);
  // C2 v2: the ER-17 trio is part of the header; NO body column without the flag
  check("cli: emails CSV header — survey trio present, body column ABSENT by default", emails.startsWith("\uFEFF" + "program_id,program_name,step_order,step_name,role,template_id,template_title,subject,survey_bound,survey_name,survey_id,body_chars,kb_doc_path\r\n") && emails.includes("true,Renewal Survey,SVY-9"), emails.split("\r\n")[0]);
  // ER-15: the CSV subject column resolves via the program binding
  check("cli: emails CSV subject resolved to {Bound Label}", emails.includes("Hello there {Bound Label}") && !emails.includes("${subj::gs-p1}"), emails);
  // ER-15: predates-token-metadata caveat scoped to touched templates
  // (tpl-alt has no tokens[]; tpl-main does)
  const mdCaveat = readFileSync(summary.reportPath, "utf8");
  check("cli: predates-token-metadata caveat fires for the token-less touched template", /1 template doc\(s\) predate token metadata/.test(mdCaveat), null);
}

// ── ER-18 (--addbody, C2 v2): opt-in full-body column ────────────────────────
{
  const cDirOff = join(ROOT, "c-nobody");
  const cDirOn = join(ROOT, "c-addbody");
  const off = runCli("program", "--index", INDEX_PATH, "--name", "prog-1", "--report", join(ROOT, "r-nb"), "--csv-dir", cDirOff);
  const on = runCli("program", "--index", INDEX_PATH, "--name", "prog-1", "--addbody", "--report", join(ROOT, "r-ab"), "--csv-dir", cDirOn);
  check("cli --addbody: both runs exit 0", off.res.status === 0 && on.res.status === 0, { off: off.res.stderr, on: on.res.stderr });
  const offCsv = readFileSync(join(cDirOff, "program-emails.csv"), "utf8");
  const onCsv = readFileSync(join(cDirOn, "program-emails.csv"), "utf8");
  const offLines = offCsv.split("\r\n");
  const onLines = onCsv.split("\r\n");
  check("cli --addbody: ADDS one trailing body column — header otherwise identical", onLines[0] === `${offLines[0]},body`, { off: offLines[0], on: onLines[0] });
  // every no-flag line is a strict prefix of its --addbody line (the flag
  // adds a column, it never changes existing cells)
  check("cli --addbody: existing columns byte-identical to the no-flag run", offLines.slice(1).every((l, i) => l === "" || (onLines[i + 1] ?? "").startsWith(`${l},`) || onLines[i + 1] === l), { off: offLines.slice(1, 3), on: onLines.slice(1, 3) });
  check("cli --addbody: full body text present (variant-mapped rows included)", onCsv.includes("FULL_BODY_MARKER") && onCsv.includes("ALT_BODY_MARKER") && !offCsv.includes("FULL_BODY_MARKER"), null);
  // round-trip: a body carrying newline + comma + quote survives RFC-4180
  const parsed = (() => {
    // minimal RFC-4180 parse of the whole document into cells
    const rows = [];
    let row = [], cell = "", q = false;
    for (let i = 0; i < onCsv.length; i++) {
      const c = onCsv[i];
      if (q) {
        if (c === '"' && onCsv[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') q = false;
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\r" && onCsv[i + 1] === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; i++; }
      else cell += c;
    }
    return rows;
  })();
  const header = parsed[0];
  const bodyIdx = header.indexOf("body");
  const mainRow = parsed.find((r) => r[header.indexOf("template_id")] === "tpl-main" && r[header.indexOf("role")] === "primary");
  check("cli --addbody: newline+comma+quote body round-trips through a CSV parser", bodyIdx === header.length - 1 && mainRow?.[bodyIdx] === FULL_BODY, { got: mainRow?.[bodyIdx] });
}

{
  const { summary } = runCli("program", "--index", INDEX_PATH, "--name", "prog-1", "--deep", "--report", join(ROOT, "r-deep"));
  const md = readFileSync(summary.reportPath, "utf8");
  check("cli deep: full body + variants in markdown", md.includes(FULL_BODY) && md.includes(VARIANT_BODY) && md.includes(ALT_BODY), null);
  check("cli deep: no shallow caveat", !md.includes("re-run with `--deep`"), null);
}

{
  const rDir = join(ROOT, "r-ambig");
  const { res, summary } = runCli("program", "--index", INDEX_PATH, "--name", "Renewal Outreach", "--report", rDir);
  check("cli ambiguity: exit 0, ambiguities[] listed with id/name/status", res.status === 0 && summary?.ambiguities?.length === 1 && summary.ambiguities[0].matches.length === 2 && summary.ambiguities[0].matches.every((m) => m.id && m.name && "status" in m), summary?.ambiguities);
  check("cli ambiguity: nothing resolved → no report written", summary?.reportPath === null && summary?.counts?.resolved === 0 && !existsSync(rDir) && summary?.warnings?.some((w) => /not guessed/.test(w)), { reportPath: summary?.reportPath, warnings: summary?.warnings });
}

{
  const { summary } = runCli("program", "--index", INDEX_PATH, "--name", "prog-1", "--name", "Renewal Outreach", "--name", "nope", "--report", join(ROOT, "r-mixed"));
  check("cli mixed: resolved sibling still reports; ambiguous + notFound counted", summary?.counts?.resolved === 1 && summary?.counts?.ambiguous === 1 && summary?.counts?.notFound === 1 && typeof summary?.reportPath === "string", summary?.counts);
  const dedup = runCli("program", "--index", INDEX_PATH, "--name", "prog-1", "--name", "renewal outreach | enterprise", "--report", join(ROOT, "r-dedup"));
  check("cli dedup: two queries → one program, notFound 0", dedup.summary?.counts?.requested === 2 && dedup.summary?.counts?.resolved === 1 && dedup.summary?.counts?.notFound === 0, dedup.summary?.counts);
}

{
  const { summary } = runCli("program", "--index", INDEX_PATH, "--name", "Stubby", "--report", join(ROOT, "r-stub"));
  const md = readFileSync(summary.reportPath, "utf8");
  check("cli stub: caveat + section text", md.includes("stub") && md.includes("step flow not captured") && summary?.caveatCount >= 1, { caveatCount: summary?.caveatCount });
}

{
  const noName = runCli("program", "--index", INDEX_PATH, "--report", join(ROOT, "r-usage"));
  check("cli: missing --name exits 1 with usage", noName.res.status === 1 && /usage/.test(noName.res.stderr), noName.res.stderr);
  const noIndex = runCli("program", "--name", "x", "--report", join(ROOT, "r-usage2"));
  check("cli: missing --index exits 1 with usage", noIndex.res.status === 1 && /usage/.test(noIndex.res.stderr), noIndex.res.stderr);
  // an empty --name would substring-match every named program in the tenant
  const empty = runCli("program", "--index", INDEX_PATH, "--name", "", "--report", join(ROOT, "r-usage3"));
  check("cli: empty --name exits 1 (never matches everything)", empty.res.status === 1 && /non-empty/.test(empty.res.stderr), { status: empty.res.status, stderr: empty.res.stderr });
}

// ── F-362: the caveat scan reaches the FETCH_HINT lines in sections ──────────
// A missing template whose id carries an apostrophe puts the bash escape (via the
// deep section's sq()-quoted FETCH_HINT) into
// the report's sections/caveats while the rerun line stays clean — the
// consumer-side pin that program mode scans the emitted text, not only the
// rerun (the shared tail's unified scan; the definition-site pins are in
// test/jo-report.mjs).
{
  const INDEX_APO = {
    ...INDEX,
    programs: {
      "prog-apo": {
        id: "prog-apo", name: "Apostrophe Program", status: "PROCESSING", statusSource: "kb",
        model: "DRIPV2", modelName: "Email Chain", startDate: null, depth: "full",
        docPath: "fixture-tenant/journey/prog-apo.md", lastVerified: null, schedules: [], sources: [],
        steps: [step(1, { stepName: "Send", stepType: "ACTION", actionType: "OUTBOUND_CALL", outboundAction: "SEND_EMAIL", emailTemplateId: "tpl-o'gone", emailTemplateName: "O'Gone" })],
      },
    },
    links: { templateToPrograms: {}, programToTemplates: { "prog-apo": ["tpl-o'gone"] } },
    gaps: { referencedTemplatesMissing: ["tpl-o'gone"], stubs: [], liveOnly: [], kbOnly: [], statusDrift: [] },
  };
  const INDEX_APO_PATH = join(ROOT, "er-index-apo.json");
  writeFileSync(INDEX_APO_PATH, JSON.stringify(INDEX_APO));
  const apo = runCli("program", "--index", INDEX_APO_PATH, "--name", "prog-apo", "--deep", "--report", join(ROOT, "r-apo")); // --deep: the sq()-quoted FETCH_HINT is a deep-section line
  const mdApo = readFileSync(apo.summary.reportPath, "utf8");
  const rerunApo = mdApo.split("\n").find((l) => l.startsWith("Re-run:")) ?? "";
  check("caveat: escape in a FETCH_HINT (section/caveat) with a clean rerun line still draws the PowerShell caveat (F-123, F-362)", mdApo.includes("'tpl-o'\\''gone'") && !rerunApo.includes("'\\''") && mdApo.includes("bash apostrophe escape"), { rerunApo, lines: mdApo.split("\n").filter((l) => l.includes("gone") || l.includes("apostrophe")) });
}

// ── F-362 output-identity lock (A-6) ──────────────────────────────────────────
// The rendered report and every CSV of one program run (the r-shallow shape),
// byte-for-byte against fixtures CAPTURED ON THE PRE-HOIST TREE (B17,
// 2026-09-03) and committed under test/fixtures/jo-report/program/. The
// mode's shared tail — rerun line, POSIX-quote caveat, renderReport, report
// write, CSV-dir prep — was hoisted into jo-report.mjs's writeModeReport
// under this lock, which must pass unchanged. Normalized before compare: the
// `generated:` timestamp, and on the Re-run line ONLY this run's absolute
// paths (temp root, dispatcher script) with their OS quoting and separators.
// CSVs are committed LF-only and BOM-less; the compare re-adds the BOM and
// CRLF the writer emits, so both are asserted exactly, not normalized away.
// Refresh (after a REVIEWED behaviour change only — review the git diff):
//   JO_REPORT_EXPECTED_REFRESH=1 node plugins/gs-superadmin/test/jo-report-program.mjs
//   PowerShell: $env:JO_REPORT_EXPECTED_REFRESH = '1'; node plugins/gs-superadmin/test/jo-report-program.mjs
// (the inline VAR=value prefix is bash-only — F-255).
{
  const EXPECTED = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "jo-report", "program");
  const lf = (s) => s.replace(/\r\n/g, "\n");
  const scrub = (text, abs, tag) => text.split(`'${abs}`).join(tag).split(abs).join(tag);
  const normalizeMd = (md) =>
    md
      .replace(/^- generated: .*$/m, "- generated: <generated>")
      .replace(/^Re-run: `(.*)`$/m, (_, cmd) => {
        let c = scrub(cmd, JO_REPORT, "<jo-report>");
        c = scrub(c, ROOT, "<root>");
        // a scrubbed token's closing quote and this OS's separators
        c = c.replace(/<(jo-report|root)>([^\s']*)'?/g, (_m, tag, rest) => `<${tag}>${rest.replace(/\\/g, "/")}`);
        return "Re-run: `" + c + "`";
      });
  const firstDiff = (x, y) => {
    const xl = x.split("\n"), yl = y.split("\n");
    const i = xl.findIndex((l, k) => l !== yl[k]);
    return i === -1 ? null : { line: i + 1, got: xl[i], want: yl[i] };
  };
  const runLock = () => {
    const rDir = join(ROOT, "lock-r"); // both runs share the dirs: run 2 takes the -2 report suffix, overwrites the CSVs
    const cDir = join(ROOT, "lock-c");
    const { res, summary } = runCli("program", "--index", INDEX_PATH, "--name", "prog-1", "--report", rDir, "--csv-dir", cDir);
    const md = summary?.reportPath ? readFileSync(summary.reportPath, "utf8") : "";
    const csvs = Object.fromEntries(readdirSync(cDir).sort().map((f) => [f, readFileSync(join(cDir, f), "utf8")]));
    return { res, summary, md, norm: normalizeMd(md), csvs };
  };
  const a = runLock();
  const b = runLock();
  if (process.env.JO_REPORT_EXPECTED_REFRESH) {
    mkdirSync(EXPECTED, { recursive: true });
    writeFileSync(join(EXPECTED, "expected-report.md"), a.norm);
    for (const [f, text] of Object.entries(a.csvs)) writeFileSync(join(EXPECTED, `expected-${f}`), lf(text).replace(/^\uFEFF/, ""));
    console.log("      (expected fixtures refreshed from this run)");
  }
  check("lock: exit 0 and the report file is named program-<date>.md", a.res.status === 0 && /^program-\d{4}-\d{2}-\d{2}(-\d+)?\.md$/.test(basename(String(a.summary?.reportPath))), { status: a.res.status, reportPath: a.summary?.reportPath, stderr: a.res.stderr });
  check("lock: LF-only report; no run-specific path survives normalization", !a.md.includes("\r") && !a.norm.includes(ROOT) && !a.norm.includes(JO_REPORT), a.norm.split("\n").filter((l) => l.startsWith("Re-run")));
  check("lock: determinism — a second run normalizes to the same bytes (report + CSVs)", a.norm === b.norm && JSON.stringify(a.csvs) === JSON.stringify(b.csvs), firstDiff(a.norm, b.norm));
  const want = lf(readFileSync(join(EXPECTED, "expected-report.md"), "utf8"));
  check("lock: report byte-identical to the committed expected (EOL-normalized)", a.norm === want, firstDiff(a.norm, want));
  const expectedCsvs = readdirSync(EXPECTED).filter((f) => f.endsWith(".csv")).map((f) => f.replace(/^expected-/, "")).sort();
  check("lock: the CSV set is exactly the committed set", JSON.stringify(Object.keys(a.csvs)) === JSON.stringify(expectedCsvs), { got: Object.keys(a.csvs), want: expectedCsvs });
  for (const f of expectedCsvs) {
    const wantCsv = "\uFEFF" + lf(readFileSync(join(EXPECTED, `expected-${f}`), "utf8")).replace(/\n/g, "\r\n");
    check(`lock: ${f} byte-identical to the committed expected (BOM + CRLF re-added)`, a.csvs[f] === wantCsv, firstDiff(String(a.csvs[f]), wantCsv));
  }
}

rmSync(ROOT, { recursive: true, force: true });
console.log(failures ? `\n${failures} failure(s)` : "\nAll jo-report-program checks passed");
process.exit(failures ? 1 : 0);
