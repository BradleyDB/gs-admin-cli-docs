#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// jo-report-audit-active.mjs (test) — fixture tests for
// scripts/jo-report-audit-active.mjs (ER-6 of the email-report program).
//
// Covers: the cron humanizer table (both crons observed in real data, the
// every-N/monthly patterns, and raw passthrough with the exact
// not-recognized label), the S3-confirmed cron-derived recurring/one-time
// classification (literal ONE-TIME/RECURRING honored verbatim),
// timezone-aware datetime rendering (incl. unrecognized-zone fallback),
// PROCESSING-only vs --include-paused scoping, step tables for every
// multi-step audited program with the hard-coded `not available via CLI`
// sends literal (house rule 5), the status/stub/liveOnly/unrecognized-cron
// caveats, report/CSV output through the C3 dispatcher, and usage errors.
// Fixture is a hand-built C1 v1 index under the OS temp dir; all data
// fictional.
//
// Run:  node plugins/gs-superadmin/test/jo-report-audit-active.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import {
  humanizeCron,
  classifySchedule,
  scheduleCell,
  formatInTz,
  timerCell,
  buildAudit,
  SENDS_LITERAL,
  RAW_CRON_LABEL,
} from "../scripts/jo-report-audit-active.mjs";

const JO_REPORT = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "jo-report.mjs");
const ROOT = join(tmpdir(), `gs-superadmin-jo-report-audit-${process.pid}`);
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

// ── cron humanizer table ─────────────────────────────────────────────────────

// [expr, expected text | null when not recognized]
const CRON_TABLE = [
  ["0 0 8 1/1 * ? *", "Daily at 08:00"], // observed daily form
  ["0 0 8 * * ? *", "Daily at 08:00"],
  ["0 30 17 * * ?", "Daily at 17:30"], // 6-field form
  ["0 0 8 ? * MON *", "Weekly on Monday at 08:00"], // observed weekly form
  ["0 0 8 ? * mon *", "Weekly on Monday at 08:00"], // case-insensitive day name
  ["0 15 9 ? * MON,WED,FRI *", "Weekly on Monday, Wednesday, Friday at 09:15"],
  ["0 0 8 ? * 2 *", "Weekly on Monday at 08:00"], // Quartz numeric 2 = MON
  ["0 0 8 15 * ? *", "Monthly on day 15 at 08:00"],
  ["0 0 8 1/3 * ? *", "Every 3 days (from day 1) at 08:00"],
  // S5-V live-observed forms (2026-07-16 sandbox audit)
  ["0 30 7 ? * 2-6 *", "Weekly on Monday-Friday at 07:30"], // numeric dow range (1=SUN); ASCII hyphen joiner (F-124 — lands in CSV)
  ["0 0 8 ? * MON-FRI *", "Weekly on Monday-Friday at 08:00"], // name dow range
  ["0 30 8 ? 1/1 TUE#3 *", "Monthly on the 3rd Tuesday at 08:30"], // nth weekday, month 1/1
  ["0 30 8 ? 1/1 SUN#1 *", "Monthly on the 1st Sunday at 08:30"],
  ["0 0 8 ? * 6#3 *", "Monthly on the 3rd Friday at 08:00"], // numeric nth weekday
  ["0 30 8 1 1/1 ? *", "Monthly on day 1 at 08:30"], // month 1/1 ≡ every month
  // unrecognized → raw passthrough (never guessed)
  ["0 0 8 ? * FRI-MON *", null], // descending/wrap range — Quartz set semantics, never guessed
  ["0 0 8 ? * 6-2 *", null], // numeric wrap range
  ["0 0 8 ? * 3-3 *", null], // equal endpoints
  ["0 0 8 ? * MON,6-2 *", null], // wrap range inside a list
  ["0 0/15 * * * ?", null], // step minutes
  ["0 0 8 L * ? *", null], // last-day-of-month
  ["0 0 8 ? * TUE#6 *", null], // nth out of range
  ["0 0 8 ? * 8#1 *", null], // dow out of range in nth form
  ["0 0 8 ? * 2-9 *", null], // range end out of range
  ["30 0 8 1/1 * ? *", null], // non-zero seconds
  ["0 0 8 1/1 2 ? *", null], // restricted month
  ["0 0 8 1/1 1/2 ? *", null], // month step other than 1/1
  ["0 0 8 1/1 * ? 2027", null], // restricted year
  ["not a cron", null],
  ["", null],
];
for (const [expr, want] of CRON_TABLE) {
  const got = humanizeCron(expr);
  const ok = want == null ? got.recognized === false && got.text === null : got.recognized === true && got.text === want;
  check(`humanizeCron: ${JSON.stringify(expr)} → ${want ?? "not recognized"}`, ok, got);
}

check(
  "scheduleCell: unrecognized cron renders raw with the EXACT label",
  scheduleCell({ cronExpression: "0 0/15 * * * ?" }) === `\`0 0/15 * * * ?\` ${RAW_CRON_LABEL}` &&
    // pure ASCII deliberately (F-124) — this label lands in CSV cells
    RAW_CRON_LABEL === "(raw cron - pattern not recognized)",
  scheduleCell({ cronExpression: "0 0/15 * * * ?" })
);
check(
  "scheduleCell: recognized cron carries the timezone",
  scheduleCell({ cronExpression: "0 0 8 1/1 * ? *", timeZoneName: "Asia/Kolkata" }) === "Daily at 08:00 Asia/Kolkata",
  scheduleCell({ cronExpression: "0 0 8 1/1 * ? *", timeZoneName: "Asia/Kolkata" })
);
check(
  "scheduleCell: no cron expression is stated honestly",
  scheduleCell({ cronExpression: null }) === "no cron expression captured",
  scheduleCell({ cronExpression: null })
);

// ── classification (S3: cron-derived; literals honored verbatim) ─────────────

check("classify: literal ONE-TIME → one-time", classifySchedule({ scheduleType: "ONE-TIME" }) === "one-time", null);
check("classify: literal RECURRING → recurring", classifySchedule({ scheduleType: "RECURRING" }) === "recurring", null);
check(
  "classify: CRON + recognized repeating cron → recurring",
  classifySchedule({ scheduleType: "CRON", cronExpression: "0 0 8 ? * MON *" }) === "recurring",
  null
);
check(
  "classify: CRON + unrecognized cron → raw value, unclassified",
  classifySchedule({ scheduleType: "CRON", cronExpression: "0 0 8 L * ? *" }) === "CRON",
  classifySchedule({ scheduleType: "CRON", cronExpression: "0 0 8 L * ? *" })
);
check("classify: no type, no cron → unknown", classifySchedule({}) === "unknown", classifySchedule({}));

// ── timezone rendering ───────────────────────────────────────────────────────

// 2026-07-13T02:30:00Z = 08:00 in Asia/Kolkata (+05:30, no DST)
const EPOCH = Date.UTC(2026, 6, 13, 2, 30, 0);
check(
  "formatInTz: renders in the schedule's own timezone",
  formatInTz(EPOCH, "Asia/Kolkata") === "2026-07-13 08:00:00 Asia/Kolkata",
  formatInTz(EPOCH, "Asia/Kolkata")
);
check(
  "formatInTz: missing timezone falls back to UTC",
  formatInTz(EPOCH, null) === "2026-07-13 02:30:00 UTC",
  formatInTz(EPOCH, null)
);
check(
  "formatInTz: unrecognized timezone → UTC with the problem stated, label pure ASCII (F-146)",
  // exact label pinned like RAW_CRON_LABEL: it lands in the next-run/
  // last-success CSV columns, so it is plain "-", never an em dash
  formatInTz(EPOCH, "Mars/Olympus_Mons")?.endsWith("(UTC - timezone 'Mars/Olympus_Mons' unrecognized)") &&
    [...formatInTz(EPOCH, "Mars/Olympus_Mons")].every((ch) => ch.charCodeAt(0) < 128),
  formatInTz(EPOCH, "Mars/Olympus_Mons")
);
check("formatInTz: null/non-numeric inputs", formatInTz(null, "UTC") === null && formatInTz("soon", "UTC") === "soon", null);
check(
  "formatInTz: epoch-0/negative sentinels render as absent, never 1969/1970",
  formatInTz(0, "America/Los_Angeles") === null && formatInTz(-1, "UTC") === null,
  formatInTz(0, "America/Los_Angeles")
);

// ── timer cells ──────────────────────────────────────────────────────────────

check(
  "timerCell: classic timer prefers uiTimerValue",
  timerCell({ timerType: "DAYS", timerValue: 3, uiTimerValue: "3 days" }) === "DAYS 3 days",
  timerCell({ timerType: "DAYS", timerValue: 3, uiTimerValue: "3 days" })
);
check("timerCell: null → ASCII placeholder (F-124 — lands in CSV)", timerCell(null) === "--", null);
{
  const verbatim = timerCell({ exit: { deep: "x".repeat(100) } });
  check("timerCell: flow-canvas exitTimer JSON is visibly truncated", verbatim.endsWith("...") && verbatim.length <= 63, verbatim);
}
{
  // F-131: the 60-unit truncation must never cut through a surrogate pair —
  // a lone half would land as U+FFFD in the CSV. 29 two-unit emoji put the
  // boundary mid-pair.
  const astral = timerCell({ note: "😀".repeat(40) });
  const lone = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(astral);
  check("timerCell: truncation is surrogate-safe (no lone half)", astral.endsWith("...") && !lone, astral);
}

// ── fixture: a hand-built C1 v1 index ────────────────────────────────────────

const step = (order, over = {}) => ({
  order, stepId: `s${order}`, stepName: `Step ${order}`, stepType: "ACTION", actionType: "OUTBOUND_CALL",
  outboundAction: "SEND_EMAIL", emailTemplateId: `tpl-${order}`, emailTemplateName: `Template ${order}`,
  variantTemplateIds: [], timer: null, ...over,
});
const program = (id, name, status, over = {}) => ({
  id, name, status, statusSource: "kb", model: "DRIPV2", modelName: "Email Chain",
  startDate: null, depth: "full", docPath: `fixture-tenant/journey/${id}.md`, lastVerified: null,
  schedules: [], steps: [], sources: [], ...over,
});
const schedule = (over = {}) => ({
  scheduleType: "CRON", cronExpression: "0 0 8 1/1 * ? *", nextRunTime: EPOCH, lastSuccessTime: EPOCH - 86400000,
  lastRunSuccess: true, runningNow: false, timeZoneName: "Asia/Kolkata", jobType: "ADVANCED_OUTREACH_SCHEDULE", ...over,
});

const INDEX = {
  generatedAt: "2026-07-12T00:00:00.000Z", liveSweepAt: null,
  slug: "fixture-tenant", baseUrl: "https://fixture-tenant.example.com", environment: "sandbox",
  programs: {
    // multi-step, daily cron, live status → step table + recognized row
    "prog-daily": program("prog-daily", "Daily Drip", "PROCESSING", {
      statusSource: "live",
      schedules: [schedule()],
      steps: [
        step(1, { variantTemplateIds: ["tpl-v1", "tpl-v2"] }),
        step(2, { stepType: "TIMER", actionType: null, outboundAction: null, emailTemplateId: null, emailTemplateName: null, timer: { timerType: "DAYS", timerValue: 2, uiTimerValue: "2 days" } }),
        step(3),
      ],
    }),
    // single-step, unrecognized cron → NO step table, raw cron row
    "prog-weird": program("prog-weird", "Weird Cron", "PROCESSING", {
      schedules: [schedule({ cronExpression: "0 0 8 L * ? *", timeZoneName: null })],
      steps: [step(1)],
    }),
    // multi-step, NO schedule → no-schedule row + step table
    "prog-nosched": program("prog-nosched", "No Schedule", "PROCESSING", {
      steps: [step(1), step(2)],
    }),
    // paused: excluded by default, joins via --include-paused
    "prog-paused": program("prog-paused", "Paused Program", "PAUSE", { schedules: [schedule()] }),
    // stopped + stub: never audited / caveat fodder
    "prog-stopped": program("prog-stopped", "Stopped Program", "STOP", { schedules: [schedule()] }),
    "prog-stub": program("prog-stub", "Stub Program", "PROCESSING", { depth: "stub" }),
  },
  templates: {},
  links: { templateToPrograms: {}, programToTemplates: {} },
  gaps: {
    referencedTemplatesMissing: [], stubs: ["prog-stub"],
    liveOnly: [{ id: "prog-live-only", name: "Live Only", status: "PROCESSING" }],
    kbOnly: [], statusDrift: [],
  },
  parseErrors: [],
};
const INDEX_PATH = join(ROOT, "er-index.json");
writeFileSync(INDEX_PATH, JSON.stringify(INDEX));

// ── buildAudit scoping ───────────────────────────────────────────────────────

{
  const { programs, rows } = buildAudit(INDEX);
  const ids = programs.map((p) => p.id);
  check(
    "buildAudit: PROCESSING only by default (stub included — status is PROCESSING)",
    ids.length === 4 && !ids.includes("prog-paused") && !ids.includes("prog-stopped") && ids.includes("prog-stub"),
    ids
  );
  check(
    "buildAudit: schedule-less programs get one honest no-schedule row",
    rows.filter((r) => r.schedule == null).length === 2 &&
      rows.find((r) => r.program.id === "prog-nosched")?.classification === "no schedule captured",
    rows.map((r) => [r.program.id, r.classification])
  );
  const paused = buildAudit(INDEX, { includePaused: true });
  check(
    "buildAudit: --include-paused adds PAUSE",
    paused.programs.length === 5 && paused.programs.some((p) => p.id === "prog-paused"),
    paused.programs.map((p) => p.id)
  );
}

// ── CLI end-to-end through the dispatcher ────────────────────────────────────

const runCli = (...args) => {
  const res = spawnSync(process.execPath, [JO_REPORT, ...args], { encoding: "utf8" });
  let summary = null;
  try { summary = JSON.parse(res.stdout); } catch { /* asserted by callers */ }
  return { res, summary };
};

{
  const rDir = join(ROOT, "r1");
  const cDir = join(ROOT, "c1");
  const { res, summary } = runCli("audit-active", "--index", INDEX_PATH, "--report", rDir, "--csv-dir", cDir);
  check(
    "cli: exit 0 + C2 summary keys",
    res.status === 0 && summary?.ok === true && summary?.mode === "audit-active" && typeof summary?.reportPath === "string" && "counts" in summary && "caveatCount" in summary && Array.isArray(summary?.warnings),
    { status: res.status, stderr: res.stderr, stdout: res.stdout?.slice(0, 300) }
  );
  check(
    "cli: counts (4 audited, 1 recognized cron, 1 unrecognized, 2 schedule-less, 2 multi-step)",
    summary?.counts?.programsAudited === 4 && summary?.counts?.cronsRecognized === 1 && summary?.counts?.cronsUnrecognized === 1 && summary?.counts?.programsWithoutSchedule === 2 && summary?.counts?.multiStepPrograms === 2,
    summary?.counts
  );
  const md = readFileSync(summary.reportPath, "utf8");
  check(
    "cli: main table row — humanized daily cron in the program's timezone",
    md.includes("Daily at 08:00 Asia/Kolkata") && md.includes("2026-07-13 08:00:00 Asia/Kolkata"),
    md.split("\n").filter((l) => l.includes("Daily Drip"))
  );
  check(
    "cli: unrecognized cron rendered raw with the exact label, never guessed",
    md.includes("`0 0 8 L * ? *` (raw cron - pattern not recognized)"),
    md.split("\n").filter((l) => l.includes("6#3"))
  );
  check(
    "cli: status column names its source (live vs kb)",
    md.includes("PROCESSING (live)") && md.includes("PROCESSING (kb)"),
    null
  );
  check(
    "cli: step tables for ALL multi-step audited programs (incl. schedule-less), none for single-step",
    md.includes("### Daily Drip (prog-daily) — steps") && md.includes("### No Schedule (prog-nosched) — steps") && !md.includes("### Weird Cron"),
    null
  );
  const sendsRows = md.split("\n").filter((l) => l.includes("not available via CLI"));
  check(
    "cli: 'Per-step sends' column is the hard-coded literal on every step row (house rule 5)",
    md.includes("Per-step sends") && sendsRows.length >= 5 && SENDS_LITERAL === "not available via CLI",
    { rows: sendsRows.length }
  );
  check(
    "cli: variant template count visible on the email step",
    md.includes("Template 1 (+2 variant template(s))"),
    null
  );
  check(
    "cli: caveats — KB-cached statuses (partial), liveOnly unauditable, stub, unrecognized cron, classification note",
    md.includes("5 of 6 program statuses are KB-cached") && md.includes("partial live sweep") &&
      md.includes("1 active program(s) exist live but have no KB doc") &&
      md.includes("1 audited program doc(s) are stubs") &&
      md.includes("1 schedule row(s) carry a cron the humanizer does not recognize") &&
      md.includes("Per-step send counts are not available via CLI"),
    { caveatCount: summary?.caveatCount }
  );
  const schedCsv = readFileSync(join(cDir, "audit-schedules.csv"), "utf8");
  const stepsCsv = readFileSync(join(cDir, "audit-steps.csv"), "utf8");
  check(
    "cli: schedules CSV carries classification + raw cron + tz-rendered datetimes",
    schedCsv.startsWith("\uFEFF" + "program_id,program_name,status,status_source,type,schedule,cron,cron_recognized,next_run,last_success,last_run_success,running_now,timezone,job_type\r\n") &&
      schedCsv.includes("recurring") && schedCsv.includes("0 0 8 L * ? *") && schedCsv.includes("2026-07-13 08:00:00 Asia/Kolkata"),
    schedCsv.slice(0, 300)
  );
  check(
    "cli: steps CSV rows only for multi-step programs, sends literal in every row",
    stepsCsv.includes("prog-daily") && stepsCsv.includes("prog-nosched") && !stepsCsv.includes("prog-weird") &&
      stepsCsv.split("\r\n").filter((l) => l.includes(SENDS_LITERAL)).length === 5,
    stepsCsv.slice(0, 300)
  );
}

{
  const paused = runCli("audit-active", "--index", INDEX_PATH, "--include-paused", "--report", join(ROOT, "r2"));
  check(
    "cli: --include-paused widens scope and is named in the report args",
    paused.summary?.counts?.programsAudited === 5 &&
      readFileSync(paused.summary.reportPath, "utf8").includes("PROCESSING + PAUSE (--include-paused)"),
    paused.summary?.counts
  );
}

{
  const noIndex = runCli("audit-active", "--report", join(ROOT, "r3"));
  check("cli: missing --index exits 1 with usage", noIndex.res.status === 1 && /usage/.test(noIndex.res.stderr), noIndex.res.stderr);
  const noReport = runCli("audit-active", "--index", INDEX_PATH);
  check("cli: missing --report exits 1 with usage", noReport.res.status === 1 && /usage/.test(noReport.res.stderr), noReport.res.stderr);
  const withAll = runCli("audit-active", "--index", INDEX_PATH, "--all", "--report", join(ROOT, "r4"));
  check(
    "cli: --all rejected loudly (audit is active-by-definition)",
    withAll.res.status === 1 && /always audits active/.test(withAll.res.stderr),
    withAll.res.stderr
  );
}

{
  // F-123: an apostrophe-bearing --report path makes the rerun line carry the
  // bash escape and pushes the one PowerShell-conversion caveat; the earlier
  // clean runs must not have carried it.
  const apoDir = join(ROOT, "r'apo");
  const apo = runCli("audit-active", "--index", INDEX_PATH, "--report", apoDir);
  const mdApo = readFileSync(apo.summary.reportPath, "utf8");
  check("caveat: apostrophe path pins the bash escape + caveat (F-123)", mdApo.includes("'\\''apo") && mdApo.includes("bash apostrophe escape"), mdApo.split("\n").filter((l) => l.includes("apostrophe")).join(" | "));
  const cleanRun = runCli("audit-active", "--index", INDEX_PATH, "--report", join(ROOT, "r-clean-caveat"));
  const mdClean = readFileSync(cleanRun.summary.reportPath, "utf8");
  check("caveat: absent for cleanly-quoted runs (F-123)", !mdClean.includes("bash apostrophe escape"), null);
}

// ── F-362 output-identity lock (A-6) ──────────────────────────────────────────
// The rendered report and every CSV of one audit-active run (no mode flags — the r1 shape),
// byte-for-byte against fixtures CAPTURED ON THE PRE-HOIST TREE (B17,
// 2026-09-03) and committed under test/fixtures/jo-report/audit-active/. The
// mode's shared tail — rerun line, POSIX-quote caveat, renderReport, report
// write, CSV-dir prep — was hoisted into jo-report.mjs's writeModeReport
// under this lock, which must pass unchanged. Normalized before compare: the
// `generated:` timestamp, and on the Re-run line ONLY this run's absolute
// paths (temp root, dispatcher script) with their OS quoting and separators.
// CSVs are committed LF-only and BOM-less; the compare re-adds the BOM and
// CRLF the writer emits, so both are asserted exactly, not normalized away.
// Refresh (after a REVIEWED behaviour change only — review the git diff):
//   JO_REPORT_EXPECTED_REFRESH=1 node plugins/gs-superadmin/test/jo-report-audit-active.mjs
//   PowerShell: $env:JO_REPORT_EXPECTED_REFRESH = '1'; node plugins/gs-superadmin/test/jo-report-audit-active.mjs
// (the inline VAR=value prefix is bash-only — F-255).
{
  const EXPECTED = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "jo-report", "audit-active");
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
    const { res, summary } = runCli("audit-active", "--index", INDEX_PATH, "--report", rDir, "--csv-dir", cDir);
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
  check("lock: exit 0 and the report file is named audit-active-<date>.md", a.res.status === 0 && /^audit-active-\d{4}-\d{2}-\d{2}(-\d+)?\.md$/.test(basename(String(a.summary?.reportPath))), { status: a.res.status, reportPath: a.summary?.reportPath, stderr: a.res.stderr });
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
console.log(failures ? `\n${failures} failure(s)` : "\nAll jo-report-audit-active checks passed");
process.exit(failures ? 1 : 0);
