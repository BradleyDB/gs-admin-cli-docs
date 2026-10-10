#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// engagement-report.mjs — the open-rate report (ENG-3): one T-10 engagement
// snapshot → a markdown report, and CSVs when asked. Read-only: it reads the
// snapshot file and writes report files; it makes no gs-admin call.
//
//   node engagement-report.mjs --snapshot <snapshot.json> --report <dir>
//        [--kb <slugDir>] [--csv-dir <dir>] [--by-template] [--exclude-internal]
//        [--include-paused | --all]
//
// EVERY number in the report comes from engagement-query.mjs's runQuery (the
// one aggregation path, ENG-4): this file chooses queries and lays out their
// rows, and never adds, divides or counts a fact row itself. The glossary and
// the caveats block are rendered from that module's metric registry, so the
// formulas shown are the ones that computed the numbers. The report document
// (header, the mandatory "Caveats & data gaps" section, the re-run footer),
// the markdown tables and the CSV writer are jo-report.mjs's.
//
// What it shows:
//   - a "data pulled" line and the caveats block, always (R4);
//   - a headline by status over every program in the snapshot;
//   - one row per program: sent, unique recipients, accounts reached,
//     delivered, opened and open rate side by side (R2b), then clicks with
//     their tracking state (R1b) and participant records;
//   - survey responses per program, where a program sent a survey (R20);
//   - with --by-template, one row per program and template, with the step it
//     sits on; and one row per step and variant when the snapshot carries step
//     detail (R21);
//   - the account watch list (two signals per program) when the snapshot holds
//     account data, and the snapshot's own reason in its place when it does
//     not: never an empty list, never a zero.
//
// Status never limits the pull (R23). The per-program tables show Active
// programs unless the pull itself named programs; --include-paused adds
// Paused, --all shows every status, and the report says how many it hides.
//
// Stdout is ONE JSON summary; the model reads that and the finished report,
// never the snapshot.
//
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { makeCliHelpers, readJsonFile, readKbIdentity, isMainModule, shq, termKey } from "./doc-lib.mjs";
import { renderReport, reportPath, mdTable, toCsv, nowIso, ACTIVE_STATUSES } from "./jo-report.mjs";
import {
  openSnapshot, accountAvailability, runQuery, formatCell, glossary, glossaryNotes, caveatsFor, dataPulledLine, provisionalText, reasonText, statusLabel, metric, NO_VALUE, STATUS_LABELS,
} from "./engagement-query.mjs";

/** @typedef {import("./engagement.mjs").T10Snapshot} T10Snapshot */

const USAGE =
  "usage: engagement-report.mjs --snapshot <snapshot.json> --report <dir> [--kb <slugDir>] [--csv-dir <dir>] [--by-template] [--exclude-internal] [--include-paused | --all]";

// The columns of each table, as registry ids: what is shown is what the
// glossary explains.
const STATUS_METRICS = ["sent", "delivered", "opened", "openRate", "clicked", "clickRate"];
const PROGRAM_METRICS = ["sent", "uniqueRecipients", "accountsReached", "delivered", "opened", "openRate", "clicked", "clickRate", "bounced", "participantRecords"];
const PROGRAM_CSV_METRICS = [...PROGRAM_METRICS, "bounceRate", "rejected", "unsubscribed", "spamComplaints", "surveyParticipants", "submitted", "partiallySubmitted", "anyResponse", "responseRate"];
const RESPONSE_METRICS = ["surveyParticipants", "submitted", "partiallySubmitted", "anyResponse", "responseRate"];
const EMAIL_METRICS = ["sent", "delivered", "opened", "openRate", "clicked", "clickRate", "bounced"];
const LOW_METRICS = ["sent", "delivered", "opened", "openRate"];
const BOUNCE_METRICS = ["sent", "bounced", "bounceRate"];
const labels = (ids) => ids.map((id) => metric(id).label);
const shown = (row, ids) => ids.map((id) => formatCell(id, row.cells[id]));
// CSV cells are numbers a spreadsheet can use: a rate as a fraction, blank
// when there is no value. The tracking state rides in its own column.
const csvValues = (row, ids) => ids.map((id) => (row.cells[id].value == null ? "" : metric(id).kind === "rate" || metric(id).status === "rate" ? Number(row.cells[id].value.toFixed(4)) : row.cells[id].value));
const statusList = (row) => (row.label.statuses ?? []).map(statusLabel).join(", ");
const whyNotes = (rows, ids) => [...new Set(rows.flatMap((r) => ids.map((id) => r.cells[id]).filter((c) => c.value == null && c.why && c.why !== "not-tracked").map((c) => c.why)))];

/**
 * The step a template sits on in a program: "2. Day 7 check-in" when it is on
 * exactly one step, how many when it is on several, and why not when the KB
 * holds no design for the program.
 */
function stepOf(label) {
  if (label.stepCount === 1) return `${label.stepOrder != null ? `${label.stepOrder}. ` : ""}${label.stepName ?? "(unnamed step)"}`;
  if (label.stepCount > 1) return `(on ${label.stepCount} steps)`;
  return "(no step name: the program has no full KB doc)";
}

/**
 * Snapshot → the report's sections, CSV tables and counts. Pure: no file, no
 * clock. Every figure is a runQuery cell.
 * @param {T10Snapshot} snapshot
 * @param {{byTemplate?: boolean, excludeInternal?: boolean, includePaused?: boolean, all?: boolean}} [opts]
 */
export function buildReport(snapshot, opts = {}) {
  const meta = snapshot.meta;
  const recipientClass = opts.excludeInternal ? /** @type {"external"} */ ("external") : /** @type {"all"} */ ("all");
  const selector = meta.params?.selector ?? {};
  // A pull that named its programs shows them whatever their status.
  const named = !!(selector.names?.length || selector.ids?.length);
  const statuses = opts.all || named ? null : [...ACTIVE_STATUSES, ...(opts.includePaused ? ["PAUSE"] : [])];
  const filters = { recipientClass, statuses };
  const q = (extra, query) => runQuery(snapshot, { ...filters, ...extra }, query);
  const sections = [];
  const csv = {};
  const used = new Set();
  const use = (ids) => {
    for (const id of ids) used.add(id);
    return ids;
  };

  // ── Headline by status: every program in the snapshot, whatever the status filter ──
  const order = Object.keys(STATUS_LABELS);
  const rank = (s) => (order.includes(s) ? order.indexOf(s) : order.length);
  const everyStatus = [...new Set(snapshot.dimensions.programs.flatMap((p) => p.statuses))].sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : 1));
  const statusRows = everyStatus.map((s) => {
    const r = runQuery(snapshot, { recipientClass, statuses: [s] }, { groupBy: [], metrics: use(STATUS_METRICS) });
    return { status: s, programs: r.scope.programs, row: r.total };
  });
  const overall = runQuery(snapshot, { recipientClass }, { groupBy: [], metrics: STATUS_METRICS });
  sections.push(
    [
      "## Headline by status",
      "",
      mdTable(["Status", "Programs", ...labels(STATUS_METRICS)], [
        ...statusRows.map((s) => [statusLabel(s.status), s.programs, ...shown(s.row, STATUS_METRICS)]),
        ["All programs", overall.scope.programs, ...shown(overall.total, STATUS_METRICS)],
      ]),
      "",
      "A program that carries two statuses (one edited while live) is counted in both rows, so the status rows can add up to more than the last row.",
    ].join("\n"),
  );
  csv["engagement-status"] = {
    headers: ["status", "programs", ...STATUS_METRICS, "click_tracking"],
    rows: [...statusRows.map((s) => [statusLabel(s.status), s.programs, ...csvValues(s.row, STATUS_METRICS), s.row.cells.clicked.state]), ["All programs", overall.scope.programs, ...csvValues(overall.total, STATUS_METRICS), overall.total.cells.clicked.state]],
  };

  // ── Programs ──
  const programs = q({}, { groupBy: ["program"], metrics: use(PROGRAM_CSV_METRICS), sort: [{ metric: "sent", dir: "desc" }] });
  // A program the status filter keeps can still have no row: every one of its sends went to a recipient the report leaves out.
  const noRow = programs.scope.programs - programs.rows.length;
  const noRowNote = noRow > 0 ? ` ${noRow} more ${noRow === 1 ? "has" : "have"} no send to the recipients shown.` : "";
  const scopeLine = (statuses
    ? `Showing ${statuses.map(statusLabel).join(" and ")} programs: ${programs.rows.length} of ${snapshot.dimensions.programs.length}. ${programs.scope.programsHiddenByStatus} hidden by status (\`--all\` shows every status${opts.includePaused ? "" : ", `--include-paused` adds Paused"}).`
    : `Showing every status: ${programs.rows.length} program(s).${named ? " The pull named its programs, so none is hidden by status." : ""}`) + noRowNote;
  const notes = whyNotes(programs.rows, PROGRAM_METRICS);
  const blankNotes = notes.map((why) =>
    why === "step-detail-off"
      ? `Participant records are blank (${NO_VALUE}): ${reasonText(meta.participantRecords?.reason ?? why)} To count them, pull again with \`--step-detail\`.`
      : `${NO_VALUE}: ${reasonText(why)}`,
  );
  sections.push(
    [
      "## Programs",
      "",
      scopeLine,
      "",
      programs.rows.length
        ? mdTable(["Program", "Status", ...labels(PROGRAM_METRICS)], [
            ...programs.rows.map((r) => [r.label.program ?? r.key.program, statusList(r), ...shown(r, PROGRAM_METRICS)]),
            ["All programs shown", "", ...shown(programs.total, PROGRAM_METRICS)],
          ])
        : "_No program with sends in the window matches the status shown._",
      "",
      `Unique recipients, accounts reached and participant records are exact per program and are never added up, so the last row shows ${NO_VALUE} for them.`,
      ...blankNotes,
    ].join("\n"),
  );
  csv["engagement-programs"] = {
    headers: ["program_id", "program", "statuses", "model", ...PROGRAM_CSV_METRICS, "click_tracking", "response_tracking", "includes_carried_months", "includes_incomplete_period"],
    rows: programs.rows.map((r) => [r.key.program, r.label.program, statusList(r), r.label.model, ...csvValues(r, PROGRAM_CSV_METRICS), r.cells.clicked.state, r.cells.submitted.state, r.carried ? "yes" : "no", r.incomplete ? "yes" : "no"]),
  };

  // ── Survey responses (all time), for the programs that sent one ──
  const surveyRows = programs.rows.filter((r) => r.cells.surveyParticipants.state !== "not-tracked");
  if (surveyRows.length) {
    sections.push(
      [
        "## Survey responses (all time)",
        "",
        mdTable(["Program", ...labels(RESPONSE_METRICS)], surveyRows.map((r) => [r.label.program ?? r.key.program, ...shown(r, RESPONSE_METRICS)])),
        "",
        "These figures are all time, not limited to the report's window. Programs that sent no survey are not listed.",
      ].join("\n"),
    );
  }

  // ── Emails by template, and by step when the snapshot carries step detail ──
  let templates = null;
  if (opts.byTemplate) {
    templates = q({}, { groupBy: ["program", "template"], metrics: use(EMAIL_METRICS), sort: [{ dim: "program" }, { label: "stepOrder" }, { metric: "sent", dir: "desc" }] });
    // The subject (TPL-2): the template's current text as the knowledge base holds it, from the engine's own label; a
    // dash where the snapshot holds no content for it (the caveats say why).
    sections.push(
      [
        "## Emails by template",
        "",
        mdTable(["Program", "Step", "Template", "Subject", ...labels(EMAIL_METRICS)], templates.rows.map((r) => [r.label.program ?? r.key.program, stepOf(r.label), r.label.template ?? r.key.template ?? "(no template)", r.label.subject ?? NO_VALUE, ...shown(r, EMAIL_METRICS)])),
      ].join("\n"),
    );
    csv["engagement-templates"] = {
      headers: ["program_id", "program", "template_id", "template", "subject", "step_name", "step_order", "steps_using_template", ...EMAIL_METRICS, "click_tracking"],
      rows: templates.rows.map((r) => [r.key.program, r.label.program, r.key.template, r.label.template, r.label.subject, r.label.stepName, r.label.stepOrder, r.label.stepCount, ...csvValues(r, EMAIL_METRICS), r.cells.clicked.state]),
    };
  }
  let steps = null;
  if (opts.byTemplate && meta.stepDetail) {
    steps = q({}, { groupBy: ["program", "step", "variant"], metrics: EMAIL_METRICS, sort: [{ dim: "program" }, { label: "stepOrder" }, { metric: "sent", dir: "desc" }] });
    sections.push(
      [
        "## Emails by step",
        "",
        mdTable(["Program", "Step", "Variant", "Template", "Subject", ...labels(EMAIL_METRICS)], steps.rows.map((r) => [
          r.label.program ?? r.key.program,
          r.label.step != null ? `${r.label.stepOrder != null ? `${r.label.stepOrder}. ` : ""}${r.label.step}` : `(no step name in the KB: ${r.key.step ?? "no step id"})`,
          r.label.variant ?? r.key.variant ?? "",
          r.label.template ?? r.label.templateId ?? "(no template)",
          r.label.subject ?? NO_VALUE,
          ...shown(r, EMAIL_METRICS),
        ])),
      ].join("\n"),
    );
    csv["engagement-steps"] = {
      headers: ["program_id", "program", "step_id", "step", "step_order", "variant_id", "variant", "template_id", "template", "subject", ...EMAIL_METRICS, "click_tracking"],
      rows: steps.rows.map((r) => [r.key.program, r.label.program, r.key.step, r.label.step, r.label.stepOrder, r.key.variant, r.label.variant, r.label.templateId, r.label.template, r.label.subject, ...csvValues(r, EMAIL_METRICS), r.cells.clicked.state]),
    };
  }

  // ── The account watch list, or the snapshot's reason in its place ──
  const accounts = accountAvailability(snapshot);
  let watched = 0;
  if (!accounts.pulled) {
    sections.push(
      ["## Account watch list", "", `Not included. ${reasonText(accounts.reason ?? "not-pulled")}`, "", "To include it, pull again with `--accounts`. That pull reads every table again and takes longer; `plan` prints how much before it starts."].join("\n"),
    );
  } else {
    const rules = meta.params?.accounts ?? {};
    const low = rules.lowEngagement ?? 15;
    const most = rules.mostBounces ?? 15;
    const minDelivered = rules.lowEngagementMinDelivered ?? 10;
    const parts = ["## Account watch list", "", `Per program, among the accounts this snapshot kept: the ${low} lowest open rates among accounts with at least ${minDelivered} delivered, and the ${most} accounts with the most bounce events.`];
    const csvRows = [];
    use([...LOW_METRICS, ...BOUNCE_METRICS]);
    for (const p of programs.rows) {
      const scope = { programs: [p.key.program], accountBuckets: /** @type {Array<"account">} */ (["account"]) };
      const lowRows = q(scope, { groupBy: ["account"], metrics: LOW_METRICS, having: [{ metric: "delivered", gte: Math.max(1, minDelivered) }], sort: [{ metric: "openRate", dir: "asc" }, { metric: "delivered", dir: "desc" }], limit: low }).rows;
      const bounceRows = q(scope, { groupBy: ["account"], metrics: BOUNCE_METRICS, having: [{ metric: "bounced", gt: 0 }], sort: [{ metric: "bounced", dir: "desc" }], limit: most }).rows;
      if (!lowRows.length && !bounceRows.length) continue;
      watched++;
      const name = (r) => r.label.account ?? r.key.account;
      parts.push("", `### ${p.label.program ?? p.key.program}`);
      if (lowRows.length) parts.push("", "Low engagement:", "", mdTable(["Account", ...labels(LOW_METRICS)], lowRows.map((r) => [name(r), ...shown(r, LOW_METRICS)])));
      if (bounceRows.length) parts.push("", "Deliverability:", "", mdTable(["Account", ...labels(BOUNCE_METRICS)], bounceRows.map((r) => [name(r), ...shown(r, BOUNCE_METRICS)])));
      for (const r of lowRows) csvRows.push([p.key.program, p.label.program, "low engagement", r.key.account, r.label.account, ...csvValues(r, LOW_METRICS), "", ""]);
      for (const r of bounceRows) csvRows.push([p.key.program, p.label.program, "deliverability", r.key.account, r.label.account, r.cells.sent.value, "", "", "", ...csvValues(r, ["bounced", "bounceRate"])]);
    }
    if (!watched) parts.push("", "_No account of the programs shown meets either signal._");
    sections.push(parts.join("\n"));
    csv["engagement-watch-list"] = { headers: ["program_id", "program", "signal", "account_key", "account", "sent", "delivered", "opened", "openRate", "bounced", "bounceRate"], rows: csvRows };
  }

  // ── The glossary: each number, rebuildable in a Gainsight report ──
  const ids = [...used];
  const entries = glossary(ids, snapshot);
  sections.push(
    [
      "## How each number is calculated",
      "",
      "Every figure above can be checked on its own: build a report in Gainsight on the object named, with the filters and the date field named, and count the rows.",
      "",
      ...glossaryNotes(snapshot),
      ...entries.flatMap((e) => [
        "",
        `### ${e.label}`,
        "",
        e.definition,
        "",
        `- Read from: \`${e.object}\``,
        `- Counts: ${e.fields}`,
        `- Filters on every count: ${e.filters.length ? e.filters.join("; ") : "none"}`,
        `- Date field: ${e.dateField}`,
        `- Calculation: ${e.calculation}${e.zeroDenominator ? `. ${e.zeroDenominator}` : ""}`,
        ...e.afterRead.map((a) => `- After the read: ${a}`),
        ...(e.perStep ? [`- Per-step rows are read from: ${e.perStep}`] : []),
        ...(e.uiParity ? [`- Against the Gainsight UI: ${e.uiParity}`] : []),
      ]),
    ].join("\n"),
  );
  csv["engagement-glossary"] = {
    headers: ["metric", "definition", "object", "counts", "filters", "date_field", "calculation", "zero_denominator", "after_the_read", "per_step_rows", "against_the_gainsight_ui"],
    rows: entries.map((e) => [e.label, e.definition, e.object, e.fields, e.filters.join("; "), e.dateField, e.calculation, e.zeroDenominator ?? "", e.afterRead.join(" "), e.perStep ?? "", e.uiParity ?? ""]),
  };

  // The template-content caveats ride the report that shows subjects (--by-template).
  const caveats = caveatsFor(snapshot, ids, { templates: !!opts.byTemplate }).map((c) => c.text);
  // A --name that matched nothing is said, never passed over: the pull holds only what matched.
  const known = new Set(snapshot.dimensions.programs.flatMap((p) => [termKey(p.id), ...(p.name != null ? [termKey(p.name)] : [])]));
  const unmatchedNames = (selector.names ?? []).filter((n) => !known.has(termKey(n)));
  if (unmatchedNames.length) caveats.unshift(`No program with sends in the window is named ${unmatchedNames.map((n) => `"${n}"`).join(", ")}: nothing was pulled for ${unmatchedNames.length === 1 ? "it" : "them"}. A name must match exactly; a program with no send in the window is not in the pull.`);
  if (opts.excludeInternal) caveats.push("Internal recipients are left out of every send figure (`--exclude-internal`). Survey figures and the status of click tracking are not split by recipient.");
  // The one or two caveats a reader should hear first, chosen HERE in a fixed
  // order so two runs over one snapshot name the same ones (F-481). The last
  // entry applies to every snapshot, so the list is never empty.
  const own = (id) => snapshot.caveats.find((c) => c.id === id)?.detail;
  const carriedMonths = own("carried-forward-months")?.months?.length ?? 0;
  const leadCaveats = [
    own("reconciliation-mismatch") ? "reconciliation FAILED in closed months: treat the numbers as unreliable" : null,
    unmatchedNames.length ? `no program with sends in the window is named ${unmatchedNames.map((n) => `"${n}"`).join(", ")}` : null,
    carriedMonths ? `${carriedMonths} month(s) carried forward from an earlier pull, not read again` : null,
    own("recipient-class-not-configured") ? "no internal domain was named, so internal recipients are not separated" : null,
    own("deleted-programs-excluded") ? `${own("deleted-programs-excluded").programs} deleted program(s) left out` : null,
    provisionalText(meta),
  ].filter(Boolean).slice(0, 2);
  return {
    sections,
    caveats,
    leadCaveats,
    csv,
    counts: {
      programsInSnapshot: snapshot.dimensions.programs.length,
      programsShown: programs.rows.length,
      programsHiddenByStatus: programs.scope.programsHiddenByStatus,
      templateRows: templates?.rows.length ?? null,
      stepRows: steps?.rows.length ?? null,
      watchListPrograms: accounts.pulled ? watched : null,
      metricsExplained: entries.length,
    },
    statusesShown: statuses,
    unmatchedNames,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const { opt, fail, finish } = makeCliHelpers("engagement-report.mjs", argv);
  const flag = (name) => argv.includes(name);
  const snapPath = opt("--snapshot");
  const reportDir = opt("--report");
  if (!snapPath || !reportDir) fail(USAGE);
  if (flag("--all") && flag("--include-paused")) fail("--all already shows every status — pass --include-paused or --all, not both");
  if (!existsSync(resolve(snapPath))) fail(`--snapshot ${snapPath}: file not found`);
  let snapshot;
  try {
    snapshot = openSnapshot(readJsonFile(resolve(snapPath)));
  } catch (e) {
    fail(`--snapshot ${snapPath}: ${e instanceof Error ? e.message : e}`);
  }
  const meta = snapshot.meta;
  // The tenant label comes from the KB when one is named, and a KB of another
  // tenant is refused: a report must never carry one tenant's name over
  // another's numbers.
  let identity = { slug: meta.tenantHost, baseUrl: `https://${meta.tenantHost}`, environment: "unknown" };
  const kb = opt("--kb");
  if (kb) {
    if (!existsSync(resolve(kb))) fail(`--kb ${kb}: directory not found`);
    const id = readKbIdentity(resolve(kb), []);
    let host = null;
    try {
      host = new URL(id.baseUrl).host.toLowerCase();
    } catch { /* an unreadable manifest names no tenant */ }
    if (host && host !== meta.tenantHost) fail(`the KB at ${kb} belongs to ${host} but the snapshot was pulled from ${meta.tenantHost} — pass the matching --kb`);
    if (host) identity = { slug: id.slug ?? meta.tenantHost, baseUrl: id.baseUrl, environment: id.environment ?? "unknown" };
  }

  const opts = { byTemplate: flag("--by-template"), excludeInternal: flag("--exclude-internal"), includePaused: flag("--include-paused"), all: flag("--all") };
  const built = buildReport(snapshot, opts);
  const modeArgs = [opts.byTemplate ? "--by-template" : null, opts.excludeInternal ? "--exclude-internal" : null, opts.includePaused ? "--include-paused" : null, opts.all ? "--all" : null].filter(Boolean);
  const csvDirOpt = opt("--csv-dir");
  const rerun = ["node", shq(process.argv[1] ?? "engagement-report.mjs"), `--snapshot ${shq(snapPath)}`, kb ? `--kb ${shq(kb)}` : null, ...modeArgs, `--report ${shq(reportDir)}`, csvDirOpt ? `--csv-dir ${shq(csvDirOpt)}` : null].filter(Boolean).join(" ");
  const generatedAt = opt("--generated-at") ?? nowIso();
  const failed = !snapshot.reconciliation.ok;
  const md = renderReport({
    mode: "report",
    title: "Email engagement report",
    slug: identity.slug,
    baseUrl: identity.baseUrl,
    environment: identity.environment,
    generatedAt,
    argsLine: modeArgs.join(" "),
    freshness: dataPulledLine(snapshot),
    sections: [
      [
        ...(failed ? ["> **RECONCILIATION FAILED.** Tables that must add up to the same totals do not, in months that are closed. Treat every number below as unreliable and pull again.", ""] : []),
        `- pull: ${meta.refresh.mode} (${meta.refresh.why})`,
        `- recipients: ${opts.excludeInternal ? "external only" : "all"}${meta.params?.internalDomains?.length ? `; internal domains: ${meta.params.internalDomains.join(", ")}` : "; no internal domain was named"}`,
        `- snapshot: ${snapPath} (the Re-run command at the foot of this report rebuilds it from this file; it pulls nothing)`,
      ].join("\n"),
      ...built.sections,
    ],
    caveats: built.caveats,
    // The command alone: the shared renderer puts this inside a code span, and
    // what a code span holds is what gets copied and run (F-480).
    rerun,
  });
  mkdirSync(resolve(reportDir), { recursive: true });
  const outPath = reportPath(reportDir, "engagement", generatedAt.slice(0, 10));
  writeFileSync(outPath, md, "utf8");

  let csvDir = null;
  const csvFiles = [];
  if (csvDirOpt) {
    csvDir = resolve(csvDirOpt);
    mkdirSync(csvDir, { recursive: true });
    const tables = { ...built.csv, "engagement-caveats": { headers: ["caveat"], rows: built.caveats.map((c) => [c]) } };
    for (const [name, t] of Object.entries(tables)) {
      writeFileSync(join(csvDir, `${name}.csv`), toCsv(t.headers, t.rows), "utf8");
      csvFiles.push(`${name}.csv`);
    }
  }
  const accounts = accountAvailability(snapshot);
  const drift = snapshot.reconciliation.checks.filter((c) => c.drift).map((c) => ({ id: c.id, drift: c.drift }));
  await finish({
    ok: true,
    mode: "report",
    report: outPath,
    csvDir,
    csvFiles,
    snapshot: resolve(snapPath),
    pulledAt: meta.pulledAt,
    window: { from: meta.window.from, to: meta.window.to },
    incompleteFrom: meta.incompleteFrom,
    pull: { mode: meta.refresh.mode, why: meta.refresh.why, carriedMonths: meta.refresh.carriedMonths },
    statusesShown: built.statusesShown ?? "all",
    unmatchedNames: built.unmatchedNames,
    counts: built.counts,
    accountData: accounts,
    stepDetail: meta.stepDetail,
    participantRecords: meta.participantRecords,
    // Closed-month mismatches are a failure; drift in the incomplete period is not.
    reconciliation: { closedMonthsOk: snapshot.reconciliation.ok, failedChecks: snapshot.reconciliation.checks.filter((c) => !c.ok).map((c) => c.id), incompletePeriodDrift: drift },
    caveatCount: built.caveats.length,
    leadCaveats: built.leadCaveats,
    rerun,
  });
}

if (isMainModule(import.meta.url)) {
  main().catch((e) => {
    console.error(`engagement-report.mjs: ${e?.stack ?? e}`);
    process.exit(1);
  });
}
