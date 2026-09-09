#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// jo-report-audit-active.mjs — `audit-active` mode of the JO email-report
// (ER-6).
//
// Schedule/health audit of every active program in the index: one row per
// program×schedule with a recurring/one-time classification, the Quartz cron
// humanized, and next-run / last-success datetimes rendered in the program's
// own timezone; plus a per-program step table for every multi-step audited
// program. Loaded by jo-report.mjs's dispatcher (contract C3) — never invoked
// directly by the skill.
//
//   jo-report.mjs audit-active --index <er-index.json> [--include-paused]
//     --report <dir> [--csv-dir <dir>]
//
// Semantics (requirements confirmed S3, 2026-07-12):
// - Scope is PROCESSING only; PAUSE joins via --include-paused (the shared
//   isActive predicate). --active-only/--all are rejected loudly — silently
//   ignoring them would let a caller believe the scope changed.
// - Columns are the plan baseline: program, status (+source), type
//   (recurring/one-time), schedule (humanized), next run, last success,
//   last-run-success, running-now. Datetimes render in the schedule's
//   timeZoneName (UTC + a note when the zone is missing/unrecognized).
// - Recurring/one-time is CRON-DERIVED: literal ONE-TIME/RECURRING
//   scheduleType values are honored verbatim if ever observed (they never
//   were in the reference KB — only type:"CRON"); otherwise a cron the
//   humanizer recognizes as repeating classifies "recurring", and anything
//   else shows the raw scheduleType value unclassified. Nothing is guessed
//   beyond what the cron itself states.
// - The cron humanizer covers daily / weekly-on-DOW / monthly-on-day /
//   every-N-days. ANY other expression renders as the raw cron labeled
//   "(raw cron — pattern not recognized)" — never a guess (house rule 5).
// - Step tables: every audited program with >1 step (not just one-time ones —
//   confirmed S3). The "Per-step sends" column is the hard-coded literal
//   `not available via CLI` (house rule 5: send completion is never inferred).
//
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseFlags,
  loadIndex,
  isActive,
  writeModeReport,
  mdTable,
  toCsv,
  emitSummary,
  fail,
} from "./jo-report.mjs";
// Portability primitives (doc-lib): the one shq/caveat copy (F-123), pinned
// comparators (F-128), surrogate-safe truncation (F-131).
import { cmpName, cmpKey, codePointSlice } from "./doc-lib.mjs";

// House rule 5 literals — asserted verbatim by the tests. Never reword the
// sends literal without re-confirming with Bradley. RAW_CRON_LABEL is pure
// ASCII deliberately (F-124/F-087): it lands in CSV cells, which must stay
// readable even where a consumer strips the BOM toCsv now emits.
export const SENDS_LITERAL = "not available via CLI";
export const RAW_CRON_LABEL = "(raw cron - pattern not recognized)";

// ── cron humanizer (exported for tests) ──────────────────────────────────────

// Quartz day-of-week: 1=SUN … 7=SAT (per the Quartz spec; confirmed live in
// S5-V — every observed `2-6` schedule's own nextRunTime fell Mon–Fri).
const DOW_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const DOW_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDINALS = [null, "1st", "2nd", "3rd", "4th", "5th"];

const plainInt = (s, min, max) => {
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n >= min && n <= max ? n : null;
};

function dowIndex(field) {
  const up = field.toUpperCase();
  const byName = DOW_NAMES.indexOf(up);
  if (byName !== -1) return byName;
  const n = plainInt(field, 1, 7);
  return n == null ? null : n - 1;
}

function dowName(field) {
  const i = dowIndex(field);
  return i == null ? null : DOW_FULL[i];
}

// One comma-list item of the dow field: a single day ("MON"/"2") or an
// ASCENDING range ("2-6"/"MON-FRI") → display text, or null when it isn't one
// of those. Descending/wrap ranges (FRI-MON = Quartz set {FRI,SAT,SUN,MON})
// are rejected — the range prose would guess at their semantics, and the
// contract is raw passthrough for anything not clearly recognized. The range
// joiner is an ASCII hyphen (F-124): this text lands in CSV cells.
function dowItem(item) {
  const range = /^([^-]+)-([^-]+)$/.exec(item);
  if (range) {
    const a = dowIndex(range[1]);
    const b = dowIndex(range[2]);
    return a != null && b != null && a < b ? `${DOW_FULL[a]}-${DOW_FULL[b]}` : null;
  }
  return dowName(item);
}

// Quartz cron (sec min hour dom month dow [year]) → {recognized, text}.
// Recognized patterns are recurring by construction:
//   0 0 8 1/1 * ? *     → Daily at 08:00          (dom */1/1, dow ?/*)
//   0 0 8 ? * MON *     → Weekly on Monday at 08:00 (dow name/number list)
//   0 30 7 ? * 2-6 *    → Weekly on Monday–Friday at 07:30 (dow ranges; S5-V)
//   0 30 8 ? 1/1 TUE#3 * → Monthly on the 3rd Tuesday at 08:30 (nth dow; S5-V)
//   0 0 8 15 * ? *      → Monthly on day 15 at 08:00
//   0 0 8 1/3 * ? *     → Every 3 days (from day 1) at 08:00
// The month field accepts * and 1/1 (every month — observed live in S5-V).
// Anything else — L/W, non-zero seconds, restricted months/years, step
// minutes/hours — is {recognized:false}: the caller renders the raw
// expression with RAW_CRON_LABEL, never a guess.
export function humanizeCron(expr) {
  if (typeof expr !== "string" || !expr.trim()) return { recognized: false, text: null };
  const f = expr.trim().split(/\s+/);
  if (f.length < 6 || f.length > 7) return { recognized: false, text: null };
  const [sec, min, hour, dom, month, dow] = f;
  if (f.length === 7 && f[6] !== "*") return { recognized: false, text: null };
  if (sec !== "0" || (month !== "*" && month !== "1/1")) return { recognized: false, text: null };
  const m = plainInt(min, 0, 59);
  const h = plainInt(hour, 0, 23);
  if (m == null || h == null) return { recognized: false, text: null };
  const at = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

  if ((dom === "*" || dom === "1/1") && (dow === "?" || dow === "*"))
    return { recognized: true, text: `Daily at ${at}` };

  if (dom === "?" && dow !== "?" && dow !== "*") {
    const nth = /^([A-Za-z0-9]+)#([1-5])$/.exec(dow);
    if (nth) {
      const day = dowName(nth[1]);
      if (day != null)
        return { recognized: true, text: `Monthly on the ${ORDINALS[Number(nth[2])]} ${day} at ${at}` };
      return { recognized: false, text: null };
    }
    const days = dow.split(",").map(dowItem);
    if (days.every((d) => d != null))
      return { recognized: true, text: `Weekly on ${days.join(", ")} at ${at}` };
    return { recognized: false, text: null };
  }

  if (dow === "?") {
    const day = plainInt(dom, 1, 31);
    if (day != null) return { recognized: true, text: `Monthly on day ${day} at ${at}` };
    const step = /^(\d+)\/(\d+)$/.exec(dom);
    if (step) {
      const from = plainInt(step[1], 1, 31);
      const every = plainInt(step[2], 1, 31);
      if (from != null && every != null && every > 1)
        return { recognized: true, text: `Every ${every} days (from day ${from}) at ${at}` };
    }
  }
  return { recognized: false, text: null };
}

// The schedule cell for one C1 schedule entry: humanized text (+ timezone)
// when recognized, otherwise the raw cron with the not-recognized label, or
// an honest "no cron expression captured" when the entry has none.
export function scheduleCell(schedule) {
  const cron = schedule?.cronExpression;
  if (cron == null || cron === "") return "no cron expression captured";
  const h = humanizeCron(cron);
  if (h.recognized) return `${h.text}${schedule.timeZoneName ? ` ${schedule.timeZoneName}` : ""}`;
  return `\`${cron}\` ${RAW_CRON_LABEL}`;
}

// Recurring/one-time classification (confirmed S3: cron-derived). Literal
// ONE-TIME/RECURRING honored verbatim; a recognized cron is recurring by
// construction; everything else shows the raw scheduleType unclassified.
export function classifySchedule(schedule) {
  const st = schedule?.scheduleType;
  if (st === "ONE-TIME") return "one-time";
  if (st === "RECURRING") return "recurring";
  if (humanizeCron(schedule?.cronExpression).recognized) return "recurring";
  return st == null || st === "" ? "unknown" : String(st);
}

// ── timezone-aware datetime rendering (exported for tests) ───────────────────

// Epoch ms → "YYYY-MM-DD HH:mm:ss <zone>" in the schedule's own timezone
// (confirmed S1/ER-3: header timestamps are UTC, schedule datetimes render in
// the program's timeZoneName). Missing zone → UTC; a zone Intl rejects falls
// back to UTC with the problem stated in the cell, never silently re-zoned.
export function formatInTz(ms, tz) {
  if (ms == null || ms === "") return null;
  const n = Number(ms);
  if (!Number.isFinite(n)) return String(ms);
  // Epoch-0/negative values are "never ran / none scheduled" sentinels in real
  // scheduleInfo payloads (observed live in S5-V) — rendering them would show a
  // fake 1969/1970 datetime. Callers render null as "—".
  if (n <= 0) return null;
  const zone = tz || "UTC";
  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(new Date(n));
  } catch {
    // Pure ASCII deliberately (F-146, the F-124 label rule): this fallback
    // label lands in the next-run/last-success CSV columns, which must stay
    // readable even where a consumer strips the BOM toCsv emits.
    return `${new Date(n).toISOString()} (UTC - timezone '${tz}' unrecognized)`;
  }
  const g = Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  const hour = g.hour === "24" ? "00" : g.hour; // some ICU builds render midnight as 24
  return `${g.year}-${g.month}-${g.day} ${hour}:${g.minute}:${g.second} ${zone}`;
}

// ── core audit (exported for tests) ──────────────────────────────────────────

const bool = (v) => (v == null ? "—" : String(v));

// index → audited programs (shared isActive scope) + one row per
// program×schedule (schedule-less programs get one honest no-schedule row).
// Pure — no I/O, no process state.
export function buildAudit(index, { includePaused = false } = {}) {
  const programs = Object.values(index.programs ?? {})
    .filter((p) => p && typeof p === "object" && isActive(p, { includePaused }))
    .sort((a, b) => cmpName(a.name, b.name) || cmpKey(a.id, b.id)); // pinned locale (F-128)
  const rows = [];
  for (const p of programs) {
    const schedules = Array.isArray(p.schedules) ? p.schedules.filter((s) => s && typeof s === "object") : [];
    if (!schedules.length) {
      rows.push({ program: p, schedule: null, classification: "no schedule captured", cronRecognized: null });
      continue;
    }
    for (const s of schedules)
      rows.push({
        program: p,
        schedule: s,
        classification: classifySchedule(s),
        cronRecognized: s.cronExpression ? humanizeCron(s.cronExpression).recognized : null,
      });
  }
  return { programs, rows };
}

// ── report assembly ──────────────────────────────────────────────────────────

const statusCell = (p) => `${p.status ?? "unknown"} (${p.statusSource === "live" ? "live" : "kb"})`;

function mainTable(rows) {
  return mdTable(
    ["program", "status", "type", "schedule", "next run", "last success", "last run success", "running now"],
    rows.map((r) => {
      const p = r.program;
      const s = r.schedule;
      return [
        `${p.name ?? "(unnamed)"} (${p.id})`,
        statusCell(p),
        r.classification,
        s ? scheduleCell(s) : "—",
        s ? formatInTz(s.nextRunTime, s.timeZoneName) ?? "—" : "—",
        s ? formatInTz(s.lastSuccessTime, s.timeZoneName) ?? "—" : "—",
        s ? bool(s.lastRunSuccess) : "—",
        s ? bool(s.runningNow) : "—",
      ];
    })
  );
}

// One step-table cell for a C1 step timer: classic timers get their type +
// value; the flow-canvas exitTimer objects (kept verbatim by ER-1) render as
// visibly-truncated JSON rather than being interpreted.
// ASCII placeholder/ellipsis and a surrogate-safe truncation (F-124/F-131):
// this cell lands in CSV, and a 60-unit cut through an astral char would emit
// a lone surrogate.
export function timerCell(timer) {
  if (timer == null) return "--";
  if (typeof timer !== "object") return String(timer);
  if ("timerType" in timer || "timerValue" in timer || "uiTimerValue" in timer) {
    const v = timer.uiTimerValue ?? timer.timerValue;
    return [timer.timerType, v].filter((x) => x != null && x !== "").join(" ") || "--";
  }
  const raw = JSON.stringify(timer);
  return raw.length > 60 ? `${codePointSlice(raw, 0, 60)}...` : raw;
}

const templateCell = (s) => {
  const base = s.emailTemplateName ?? s.emailTemplateId ?? "—";
  const extra = (s.variantTemplateIds ?? []).length;
  return extra ? `${base} (+${extra} variant template(s))` : base;
};

function stepSection(p) {
  const table = mdTable(
    ["order", "step type", "step name", "email template", "timer", "Per-step sends"],
    p.steps.map((s) => [
      s.order,
      [s.stepType, s.actionType, s.outboundAction].filter(Boolean).join(" / ") || "—",
      s.stepName ?? "—",
      templateCell(s),
      timerCell(s.timer),
      SENDS_LITERAL,
    ])
  );
  return [`### ${p.name ?? "(unnamed)"} (${p.id}) — steps`, "", table].join("\n");
}

// Caveats computed from the index every run: the audit's scope depends
// entirely on statuses, so anything limiting status truth or step visibility
// must be stated.
function buildCaveats(index, { includePaused }, { programs, rows }) {
  const caveats = [];
  // same non-object guard as buildAudit — a malformed index entry the audit
  // tolerates must not crash the caveats step
  const allPrograms = Object.values(index.programs ?? {}).filter((p) => p && typeof p === "object");
  const kbStatusCount = allPrograms.filter((p) => p.statusSource !== "live").length;
  if (kbStatusCount > 0)
    caveats.push(
      `${kbStatusCount} of ${allPrograms.length} program statuses are KB-cached ` +
        `(${kbStatusCount === allPrograms.length ? "no" : "partial"} live sweep) — the audited set is scoped by status, ` +
        `so it may include stopped programs or miss newly-activated ones; verify before acting.`
    );
  const liveOnlyActive = (index.gaps?.liveOnly ?? []).filter((e) => isActive(e, { includePaused }));
  if (liveOnlyActive.length)
    caveats.push(
      `${liveOnlyActive.length} active program(s) exist live but have no KB doc (gaps.liveOnly) — ` +
        `not auditable here; gap-fill via \`jo p describe\` and re-index.`
    );
  const stubIds = new Set(index.gaps?.stubs ?? []);
  const auditedStubs = programs.filter((p) => stubIds.has(p.id)).length;
  if (auditedStubs)
    caveats.push(`${auditedStubs} audited program doc(s) are stubs — schedules and steps unknown for those rows.`);
  const unrecognized = rows.filter((r) => r.cronRecognized === false).length;
  if (unrecognized)
    caveats.push(
      `${unrecognized} schedule row(s) carry a cron the humanizer does not recognize — shown raw and labeled, never guessed.`
    );
  const noSchedule = rows.filter((r) => r.schedule == null).length;
  if (noSchedule)
    caveats.push(`${noSchedule} audited program(s) have no schedule captured in the KB payload.`);
  caveats.push(
    `Recurring/one-time is derived from the cron expression (only \`type:"CRON"\` was observed in schedule data; ` +
      `literal ONE-TIME/RECURRING would be honored verbatim). Per-step send counts are ${SENDS_LITERAL}.`
  );
  return caveats;
}

// ── CLI entry (dispatcher contract: export run(argv)) ────────────────────────

const USAGE =
  "usage: jo-report.mjs audit-active --index <er-index.json> [--include-paused] --report <dir> [--csv-dir <dir>]";

export async function run(argv) {
  let flags;
  try {
    flags = parseFlags(argv);
  } catch (e) {
    fail(`${e.message}\n${USAGE}`);
  }
  if (!flags.index || !flags.report) fail(USAGE);
  // audit-active is active-by-definition — silently accepting scope flags
  // would let a caller believe --all widened the audit
  if (flags["active-only"] || flags.all)
    fail(`audit-active always audits active programs (use --include-paused to add PAUSE)\n${USAGE}`);
  const includePaused = flags["include-paused"] === true;

  const index = loadIndex(flags.index);
  const audit = buildAudit(index, { includePaused });
  const { programs, rows } = audit;
  const caveats = buildCaveats(index, { includePaused }, audit);
  const multiStep = programs.filter((p) => (p.steps ?? []).length > 1);

  const summarySection = [
    "## Summary",
    "",
    `- scope: PROCESSING${includePaused ? " + PAUSE (--include-paused)" : ""} — ${programs.length} program(s) audited (of ${Object.keys(index.programs ?? {}).length} in the index)`,
    `- schedule rows: ${rows.filter((r) => r.schedule).length} (${rows.filter((r) => r.cronRecognized === true).length} recognized cron(s), ${rows.filter((r) => r.cronRecognized === false).length} unrecognized, ${rows.filter((r) => r.schedule == null).length} program(s) without a schedule)`,
    `- multi-step programs (step tables below): ${multiStep.length}`,
  ].join("\n");
  const tableSection = rows.length
    ? ["## Active programs — schedules", "", mainTable(rows)].join("\n")
    : "## Active programs — schedules\n\n_no programs matched the audit scope — check the caveats below_";
  const sections = [summarySection, tableSection];
  if (multiStep.length)
    sections.push(["## Step detail (multi-step programs)", "", ...multiStep.map(stepSection)].join("\n\n"));

  const modeArgs = includePaused ? ["--include-paused"] : [];
  // The shared tail (rerun line, POSIX-quote caveat, report write, CSV dir)
  // lives in jo-report.mjs — F-362
  const { outPath, csvDir } = writeModeReport({ mode: "audit-active", flags, modeArgs, sections, caveats, index });
  if (csvDir) {
    writeFileSync(
      join(csvDir, "audit-schedules.csv"),
      toCsv(
        ["program_id", "program_name", "status", "status_source", "type", "schedule", "cron", "cron_recognized", "next_run", "last_success", "last_run_success", "running_now", "timezone", "job_type"],
        rows.map((r) => {
          const p = r.program;
          const s = r.schedule;
          return [
            p.id,
            p.name,
            p.status,
            p.statusSource,
            r.classification,
            s ? scheduleCell(s) : "",
            s?.cronExpression ?? "",
            r.cronRecognized ?? "",
            s ? formatInTz(s.nextRunTime, s.timeZoneName) ?? "" : "",
            s ? formatInTz(s.lastSuccessTime, s.timeZoneName) ?? "" : "",
            s?.lastRunSuccess ?? "",
            s?.runningNow ?? "",
            s?.timeZoneName ?? "",
            s?.jobType ?? "",
          ];
        })
      ),
      "utf8"
    );
    writeFileSync(
      join(csvDir, "audit-steps.csv"),
      toCsv(
        ["program_id", "program_name", "order", "step_type", "action_type", "outbound_action", "step_name", "email_template_id", "email_template_name", "variant_template_count", "timer", "per_step_sends"],
        multiStep.flatMap((p) =>
          p.steps.map((s) => [
            p.id,
            p.name,
            s.order,
            s.stepType,
            s.actionType,
            s.outboundAction,
            s.stepName,
            s.emailTemplateId,
            s.emailTemplateName,
            (s.variantTemplateIds ?? []).length,
            timerCell(s.timer),
            SENDS_LITERAL,
          ])
        )
      ),
      "utf8"
    );
  }

  emitSummary({
    mode: "audit-active",
    reportPath: outPath,
    ...(csvDir ? { csvDir } : {}),
    counts: {
      programsIndexed: Object.keys(index.programs ?? {}).length,
      programsAudited: programs.length,
      scheduleRows: rows.filter((r) => r.schedule).length,
      cronsRecognized: rows.filter((r) => r.cronRecognized === true).length,
      cronsUnrecognized: rows.filter((r) => r.cronRecognized === false).length,
      programsWithoutSchedule: rows.filter((r) => r.schedule == null).length,
      multiStepPrograms: multiStep.length,
    },
    caveatCount: caveats.length,
    warnings: [],
  });
}
