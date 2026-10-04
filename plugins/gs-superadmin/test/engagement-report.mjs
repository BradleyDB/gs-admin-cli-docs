#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// engagement-report.mjs (test) — fixtures for scripts/engagement-report.mjs
// (ENG-3), the open-rate report, driven as the skill drives it: through the
// real processes, over the fictional tenant and the stand-in CLI.
//
//   plan  →  run  →  report        (the `report` mode's three script steps)
//
// Snapshots come from the real producer: the committed fixture snapshot
// (accounts and step detail on), a default pull made here (both off, the
// adapter's defaults), a selective refresh (carried months) and a pull that
// named its programs. Expectations are derived independently (R-10): the
// program table is held to a direct count of the fictional tenant's rows, and
// the pure builder's output is pinned to a committed golden
// (report-golden.md; `--write-golden` regenerates it).
//
// Run:  node plugins/gs-superadmin/test/engagement-report.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { makeTempDir, removeTempDir, writeFiles, runNode } from "../../../test/rig.mjs";
import { buildReport } from "../scripts/engagement-report.mjs";
import { openSnapshot, caveatsFor, reasonText, NOT_TRACKED, UNKNOWN_MARK, NO_VALUE } from "../scripts/engagement-query.mjs";
import { buildTenant, kbFiles } from "./fixtures/engagement/acme-tenant.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN = join(HERE, "..");
const REPORT = join(PLUGIN, "scripts", "engagement-report.mjs");
const ENGINE = join(PLUGIN, "scripts", "engagement.mjs");
const FAKE = join(HERE, "fixtures", "engagement", "fake-gs-admin.mjs");
const GOLDEN_SNAPSHOT = join(HERE, "fixtures", "engagement", "snapshot-acme.json");
const GOLDEN = join(HERE, "fixtures", "engagement", "report-golden.md");
const WRITE_GOLDEN = process.argv.includes("--write-golden");
const BOM = String.fromCharCode(0xfeff);
const BOM_RE = new RegExp("^" + BOM);
const GENERATED = "2026-09-15T16:00:00.000Z";

let failures = 0;
let ran = 0;
function check(label, cond, detail) {
  ran++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log(`      ${JSON.stringify(detail)?.slice(0, 1500)}`);
  }
}
/** The rows of the markdown table under a heading, as arrays of cell text. */
function tableUnder(md, heading) {
  const lines = md.split("\n");
  const start = lines.findIndex((l) => l === heading);
  if (start === -1) return null;
  const rows = [];
  for (let i = start + 1; i < lines.length && !(lines[i].startsWith("## ") || (rows.length && !lines[i].startsWith("|"))); i++) {
    if (lines[i].startsWith("|")) rows.push(lines[i].slice(1, -1).split(/(?<!\\)\|/).map((c) => c.trim()));
  }
  return rows.length ? { headers: rows[0], rows: rows.slice(2) } : null;
}
const section = (md, heading) => {
  const from = md.indexOf(`\n${heading}\n`);
  if (from === -1) return null;
  const next = md.indexOf("\n## ", from + 1);
  return md.slice(from + 1, next === -1 ? undefined : next);
};

const ROOT = makeTempDir("gs-superadmin-engagement-report");
try {
  const WS = join(ROOT, "ws");
  writeFiles(WS, { ".gs-superadmin/.keep": "" });
  writeFiles(join(ROOT, "kb"), kbFiles("acme-prod"));
  writeFiles(join(ROOT, "kb-other"), { "acme-sbx/_manifest.json": JSON.stringify({ slug: "acme-sbx", baseUrl: "https://acme--sbx.gainsightcloud.com", environment: "sandbox", inventory: {} }) });
  const KB = join(ROOT, "kb", "acme-prod");
  const STATE = join(ROOT, "fake-state");
  writeFiles(STATE, { ".keep": "" });
  const callsMade = () => (existsSync(join(STATE, "argv.jsonl")) ? readFileSync(join(STATE, "argv.jsonl"), "utf8").split("\n").filter(Boolean).length : 0);
  const adapter = (mode, flags, tenant = {}) => {
    const r = runNode(ENGINE, [mode, "--workspace", WS, "--bin", FAKE, "--kb", KB, "--page-size", "400", ...flags], { env: { ...process.env, FAKE_STATE: STATE, FAKE_TENANT: JSON.stringify(tenant) } });
    let json = null;
    try { json = JSON.parse(r.stdout); } catch { /* failure path */ }
    return { code: r.status, json, stderr: r.stderr };
  };
  const report = (args) => {
    const r = runNode(REPORT, [...args, "--generated-at", GENERATED]);
    let json = null;
    try { json = JSON.parse(r.stdout); } catch { /* failure path */ }
    return { code: r.status, json, stderr: r.stderr, md: json?.report && existsSync(json.report) ? readFileSync(json.report, "utf8") : null };
  };
  let seq = 0;
  const outDir = () => join(ROOT, `out-${++seq}`);
  const snapshotFile = (name, s) => {
    const p = join(ROOT, `${name}.json`);
    writeFileSync(p, JSON.stringify(s));
    return p;
  };
  const GOLD = openSnapshot(JSON.parse(readFileSync(GOLDEN_SNAPSHOT, "utf8")));

  // ══ The mode end to end: plan, run, report — with the adapter's defaults ══
  const base = ["--today", "2026-09-15", "--pulled-at", "2026-09-15T09:00:00-07:00", "--from", "2026-06", "--internal-domain", "acme.com", "--unsubscribe-link", "https://www.acme.com/mail-settings"];
  const offPath = join(ROOT, "off.json");
  {
    const plan = adapter("plan", [...base, "--run", "rep-1"]);
    const afterPlan = callsMade();
    check("plan prints the cost before anything is pulled: calls and seconds, whether they fit the token, and what accounts and step detail would add though both are off",
      plan.code === 0 && plan.json?.estimate?.thisRun?.calls > 0 && plan.json.estimate.token.fits === true && plan.json.estimate.accounts.on === false && plan.json.estimate.accounts.addsCalls > 0 &&
        plan.json.estimate.stepDetail.on === false && plan.json.estimate.stepDetail.addsCalls > 0 && !existsSync(offPath), plan.json ?? plan.stderr);
    const run = adapter("run", [...base, "--run", "rep-1", "--out", offPath]);
    check("run with the same --run continues the plan's run: the calls plan made are not made again, and the snapshot is written",
      run.code === 0 && run.json?.ok === true && run.json.calls.reused >= afterPlan - 1 && callsMade() - afterPlan === run.json.calls.made && existsSync(offPath) && run.json.accounts === null && run.json.accountData.reason === "accounts-off",
      [run.json?.calls, afterPlan, callsMade(), run.stderr?.slice(-300)]);
  }
  const OFF = openSnapshot(JSON.parse(readFileSync(offPath, "utf8")));
  const dir1 = outDir();
  const first = report(["--snapshot", offPath, "--kb", KB, "--report", dir1]);
  check("the report runs over that snapshot, exits 0, and its ONE stdout document is the summary: where the report is, the pull's time, the window, what is shown and hidden, and whether account data is there",
    first.code === 0 && first.json?.ok === true && first.json.mode === "report" && first.json.pulledAt === OFF.meta.pulledAt && isDeepStrictEqual(first.json.window, { from: "2026-06", to: "2026-09" }) &&
      first.json.counts.programsInSnapshot === 5 && first.json.counts.programsShown === 4 && first.json.counts.programsHiddenByStatus === 1 && isDeepStrictEqual(first.json.accountData, { pulled: false, reason: "accounts-off" }) &&
      first.json.counts.watchListPrograms === null && first.json.reconciliation.closedMonthsOk === true && first.json.report.endsWith("engagement-2026-09-15.md"), first.json ?? first.stderr);
  const md1 = first.md ?? "";
  check("every output carries \"data pulled\" (R4): the pull's date and time, the tenant, the window and the provisional period, in the header",
    md1.includes(`- freshness: Data pulled ${OFF.meta.pulledAt}`) && md1.includes("from acme.gainsightcloud.com") && md1.includes("sends on or after 2026-09-01 are provisional") && md1.includes("- tenant: acme-prod (https://acme.gainsightcloud.com, production)"));
  check("every output carries the caveats block (R4), and it is the registry's: the same texts caveatsFor gives for the metrics shown",
    (() => {
      const block = section(md1, "## Caveats & data gaps") ?? "";
      const want = caveatsFor(OFF, ["sent", "opened", "openRate", "clicked", "clickRate", "uniqueRecipients", "accountsReached", "participantRecords", "submitted", "responseRate"]);
      return want.length >= 10 && want.every((c) => block.includes(`- ${c.text}`)) && block.includes("Opens are image-pixel loads");
    })());

  // ── Accounts off (the default): the marker's reason where the watch list would be ──
  {
    const watch = section(md1, "## Account watch list") ?? "";
    check("accounts off: where the watch list would be, the report shows the reason from the snapshot's marker and how to turn it on (--accounts) — no table, no empty list, no zero",
      watch.includes(reasonText(OFF.meta.accounts.reason)) && OFF.meta.accounts.reason === "accounts-off" && watch.includes("`--accounts`") && !watch.includes("|") && !/\b0\b/.test(watch) && !/No account/.test(watch) && watch.startsWith("## Account watch list\n\nNot included."), watch);
    check("accounts off: accounts REACHED per program is still shown — it is not the account table",
      tableUnder(md1, "## Programs").rows.filter((r) => r[0] !== "All programs shown").every((r) => /^\d+$/.test(r[tableUnder(md1, "## Programs").headers.indexOf("Accounts reached")])));
    const p = tableUnder(md1, "## Programs");
    const col = p.headers.indexOf("Participant records");
    check("step detail off: the participant-records column is blank, never 0, and the note under the table says why, from the snapshot's marker, and how to turn it on (--step-detail)",
      p.rows.every((r) => r[col] === NO_VALUE) && section(md1, "## Programs").includes(reasonText(OFF.meta.participantRecords.reason)) && section(md1, "## Programs").includes("`--step-detail`"), p.rows.map((r) => r[col]));
    const byTpl = report(["--snapshot", offPath, "--report", outDir(), "--by-template"]);
    check("per-step rows appear only when the snapshot carries step detail: with it off, --by-template gives the template table and NO step table",
      byTpl.code === 0 && byTpl.md.includes("## Emails by template") && !byTpl.md.includes("## Emails by step") && byTpl.json.counts.stepRows === null && byTpl.json.counts.templateRows > 0);
    check("F-481: the summary names the one or two caveats to lead with, chosen by the script in a fixed order; on a clean full pull with an internal domain that is the provisional period alone",
      isDeepStrictEqual(first.json.leadCaveats, ["sends on or after 2026-09-01 are provisional"]));
    const footer = /\nRe-run: `([^`]+)`\n/.exec(md1)?.[1];
    check("F-480: the report's Re-run code span holds the command and nothing else — exactly the summary's rerun, ending at its last argument — and the explanation sits outside it, beside the snapshot path",
      footer === first.json.rerun && !/\(|\)/.test(footer.split(" --snapshot ")[1]) && footer.endsWith(`--report ${dir1.replace(/\\/g, "/")}`) === first.json.rerun.endsWith(`--report ${dir1.replace(/\\/g, "/")}`) && /^- snapshot: .* \(the Re-run command at the foot of this report rebuilds it from this file; it pulls nothing\)$/m.test(md1),
      [footer, first.json.rerun]);
    check("without --by-template there is no per-template table", !md1.includes("## Emails by template") && first.json.counts.templateRows === null);
  }

  // ══ The program table, held to the tenant's own rows ══════════════════════
  {
    const tenant = buildTenant();
    const months = new Set(OFF.dimensions.months);
    const want = new Map();
    for (const r of tenant.tables.email_log_v2) {
      if (r.Source !== "Advanced Outreach" || r.AddressType !== "To" || !months.has(r.ExecutedDate.slice(0, 7))) continue;
      const m = want.get(r.SourceId) ?? { sent: 0, delivered: 0, opened: 0, people: new Set(), accounts: new Set() };
      m.sent++;
      if (r.IsSent === "YES" && r.IsBounced !== "YES") m.delivered++;
      if (r.IsOpened === "YES") m.opened++;
      if (r.GsPersonId) m.people.add(r.GsPersonId);
      if (r.GsCompanyId) m.accounts.add(r.GsCompanyId);
      want.set(r.SourceId, m);
    }
    const all = report(["--snapshot", offPath, "--report", outDir(), "--all"]);
    const t = tableUnder(all.md, "## Programs");
    const at = (row, h) => row[t.headers.indexOf(h)];
    const nameOf = Object.fromEntries(OFF.dimensions.programs.map((p) => [p.name, p.id]));
    const body = t.rows.filter((r) => r[0] !== "All programs shown");
    check("R2b: the per-program table shows sent, unique recipients, accounts reached, delivered, opened and open rate side by side, in that order",
      isDeepStrictEqual(t.headers.slice(0, 8), ["Program", "Status", "Sent", "Unique recipients", "Accounts reached", "Delivered", "Opened", "Open rate"]), t.headers);
    check("oracle: for every program, those six figures equal a direct count of the fictional tenant's delivery-log rows (distinct people and companies included), and the open rate is opened over delivered to one decimal",
      body.length === 5 && body.every((r) => {
        const w = want.get(nameOf[r[0]]);
        return Number(at(r, "Sent")) === w.sent && Number(at(r, "Unique recipients")) === w.people.size && Number(at(r, "Accounts reached")) === w.accounts.size && Number(at(r, "Delivered")) === w.delivered &&
          Number(at(r, "Opened")) === w.opened && at(r, "Open rate") === `${((w.opened / w.delivered) * 100).toFixed(1)}%`;
      }), body);
    const last = t.rows.find((r) => r[0] === "All programs shown");
    check("the total row adds the additive measures and shows a dash for the three distinct counts — they are never summed",
      Number(at(last, "Sent")) === [...want.values()].reduce((s, w) => s + w.sent, 0) && at(last, "Unique recipients") === NO_VALUE && at(last, "Accounts reached") === NO_VALUE && at(last, "Participant records") === NO_VALUE);
    check("rows are sorted by sends, largest first", isDeepStrictEqual(body.map((r) => Number(at(r, "Sent"))), body.map((r) => Number(at(r, "Sent"))).sort((a, b) => b - a)));
    const head = tableUnder(all.md, "## Headline by status");
    check("the headline by status covers every program in the snapshot whatever the status shown, a program with two statuses is counted under each, and the report says so",
      isDeepStrictEqual(head.rows.map((r) => [r[0], r[1]]), [["Active", "4"], ["Paused", "1"], ["Draft", "1"], ["All programs", "5"]]) && Number(head.rows[3][2]) === [...want.values()].reduce((s, w) => s + w.sent, 0) &&
        Number(tableUnder(md1, "## Headline by status").rows[3][2]) === Number(head.rows[3][2]) && section(all.md, "## Headline by status").includes("counted in both rows"), head.rows);
  }

  // ══ Status: what is shown, and what is hidden ═════════════════════════════
  {
    const names = (r) => tableUnder(r.md, "## Programs").rows.map((x) => x[0]).filter((n) => n !== "All programs shown");
    const paused = report(["--snapshot", offPath, "--report", outDir(), "--include-paused"]);
    const all = report(["--snapshot", offPath, "--report", outDir(), "--all"]);
    check("status never limits the pull (R23), it decides what shows: Active programs by default, and the report states how many it hides and how to see them",
      names(first).length === 4 && !names(first).includes("Acme Renewal Dynamic") && section(md1, "## Programs").includes("Showing Active programs: 4 of 5. 1 hidden by status") && section(md1, "## Programs").includes("`--all`") && section(md1, "## Programs").includes("`--include-paused`"));
    check("--include-paused adds Paused programs (a program matches when any of its statuses is shown), and --all shows every status",
      names(paused).includes("Acme Renewal Dynamic") && paused.json.counts.programsHiddenByStatus === 0 && isDeepStrictEqual(paused.json.statusesShown, ["PROCESSING", "PAUSE"]) && names(all).length === 5 && all.json.statusesShown === "all" &&
        tableUnder(paused.md, "## Programs").rows.find((r) => r[0] === "Acme Renewal Dynamic")[1] === "Paused, Draft");
    const both = report(["--snapshot", offPath, "--report", outDir(), "--all", "--include-paused"]);
    check("--all with --include-paused is refused", both.code === 1 && /not both/.test(both.stderr));
    const namedPath = join(ROOT, "named.json");
    const named = adapter("run", [...base, "--run", "rep-named", "--name", "Acme Renewal Dynamic", "--out", namedPath]);
    const namedReport = report(["--snapshot", namedPath, "--report", outDir()]);
    check("a pull that named its programs (--name) shows them whatever their status: a named paused program is never hidden by the default",
      named.code === 0 && namedReport.code === 0 && isDeepStrictEqual(names(namedReport), ["Acme Renewal Dynamic"]) && namedReport.json.statusesShown === "all" && /The pull named its programs/.test(namedReport.md) && namedReport.json.unmatchedNames.length === 0, [named.stderr?.slice(-200), namedReport.json]);
    const mixedPath = join(ROOT, "mixed.json");
    const mixed = adapter("run", [...base, "--run", "rep-mixed", "--name", "p-nps", "--name", "Acme Renewl Dynamic", "--out", mixedPath]);
    const mixedReport = report(["--snapshot", mixedPath, "--report", outDir()]);
    check("--name takes a program's id as well as its name (email-report's vocabulary), and a name that matched no program is said first in the caveats, never passed over",
      mixed.code === 0 && isDeepStrictEqual(names(mixedReport), ["Acme NPS Survey"]) && isDeepStrictEqual(mixedReport.json.unmatchedNames, ["Acme Renewl Dynamic"]) &&
        section(mixedReport.md, "## Caveats & data gaps").split("\n")[2].startsWith('- No program with sends in the window is named "Acme Renewl Dynamic"') &&
        isDeepStrictEqual(mixedReport.json.leadCaveats, ['no program with sends in the window is named "Acme Renewl Dynamic"', "sends on or after 2026-09-01 are provisional"]), [mixed.stderr?.slice(-200), mixedReport.json]);
  }

  // ══ The full report: accounts and step detail on (the committed fixture snapshot) ══
  {
    const built = buildReport(GOLD, { byTemplate: true, all: true });
    const text = [...built.sections, "## Caveats & data gaps", "", ...built.caveats.map((c) => `- ${c}`), ""].join("\n\n").replace(/\n\n\n+/g, "\n\n");
    if (WRITE_GOLDEN) writeFileSync(GOLDEN, text);
    check("golden: the report over the fixture snapshot (every status, by template, accounts and step detail on) equals the committed golden, byte for byte",
      text === readFileSync(GOLDEN, "utf8").replace(/\r\n/g, "\n"));
    const full = report(["--snapshot", GOLDEN_SNAPSHOT, "--report", outDir(), "--by-template", "--all", "--csv-dir", join(ROOT, "csv")]);
    const md = full.md ?? "";
    check("the written report holds every section the pure builder produced, under the shared report header and above the re-run line",
      full.code === 0 && built.sections.every((s) => md.includes(s)) && md.startsWith("# Email engagement report\n") && md.includes("- mode: report · args: --by-template --all") && /\nRe-run: `node .*engagement-report\.mjs.* --snapshot /.test(md) && md.includes("it pulls nothing"));
    const tpl = tableUnder(md, "## Emails by template");
    const cell = (name, h) => tpl.rows.find((r) => r[2] === name)[tpl.headers.indexOf(h)];
    check("per-template rows show the template and the step it sits on: order and name where it is on one step, how many where it is on several, and why not where the KB has no design",
      isDeepStrictEqual(tpl.headers.slice(0, 3), ["Program", "Step", "Template"]) && cell("Acme Welcome", "Step") === "1. Welcome" && cell("Acme Day 7", "Step") === "2. Day 7 check-in" && cell("Acme Renewal", "Step") === "(on 2 steps)" &&
        /no full KB doc/.test(cell("Acme Unlisted", "Step")) && tpl.rows.some((r) => r[2] === "(no template)"), tpl.rows.map((r) => r.slice(0, 3)));
    check("R1b: the three click-tracking states read differently — a tracked 0 is 0 and 0.0%, not tracked is words with no number, unknown is the value with its marker",
      cell("Acme NPS Request", "Clicked") === "0" && cell("Acme NPS Request", "Click rate") === "0.0%" && cell("Acme Renewal Thanks", "Clicked") === NOT_TRACKED && cell("Acme Renewal Thanks", "Click rate") === NOT_TRACKED &&
        cell("Acme Day 7", "Clicked") === `0 ${UNKNOWN_MARK}` && cell("Acme Day 7", "Click rate") === `0.0% ${UNKNOWN_MARK}` && /^\d+$/.test(cell("Acme Welcome", "Clicked")));
    const steps = tableUnder(md, "## Emails by step");
    check("with step detail in the snapshot, per-step rows appear: step, variant and template names, one row per step and variant",
      isDeepStrictEqual(steps.headers.slice(0, 4), ["Program", "Step", "Variant", "Template"]) && steps.rows.filter((r) => r[1] === "1. Welcome").length === 2 && steps.rows.some((r) => r[1] === "2. Renewal reminder" && r[3] === "Acme Renewal") &&
        steps.rows.length === new Set(GOLD.facts.byStep.map((r) => JSON.stringify([r.programId, r.stepId, r.variantId]))).size && full.json.counts.stepRows === steps.rows.length, steps.rows.map((r) => r.slice(0, 4)));
    const resp = tableUnder(md, "## Survey responses (all time)");
    const rp = GOLD.facts.responseParticipants[0];
    check("survey responses: only programs that sent a survey, on the all-time basis, with the rate from the all-time pair — and the section says it is all time",
      resp.rows.length === 1 && isDeepStrictEqual(resp.rows[0], ["Acme NPS Survey", String(rp.participants), String(rp.submitted), String(rp.partiallySubmitted), String(rp.submitted + rp.partiallySubmitted), `${(((rp.submitted + rp.partiallySubmitted) / rp.participants) * 100).toFixed(1)}%`]) &&
        section(md, "## Survey responses (all time)").includes("all time, not limited to the report's window"), resp.rows);

    // The watch list: two signals per program, the snapshot's own numbers.
    const watch = section(md, "## Account watch list");
    const rules = GOLD.meta.params.accounts;
    const A = GOLD.facts.byAccount.filter((r) => r.bucket === "account" && r.programId === "p-onboard");
    const per = new Map();
    for (const r of A) {
      const m = per.get(r.accountKey) ?? { sent: 0, delivered: 0, opened: 0, bounced: 0 };
      for (const k of Object.keys(m)) m[k] += r[k];
      per.set(r.accountKey, m);
    }
    const nameOf = Object.fromEntries(GOLD.dimensions.accounts.map((a) => [a.key, a.name]));
    const wantLow = [...per].filter(([, m]) => m.delivered >= rules.lowEngagementMinDelivered).sort((a, b) => a[1].opened / a[1].delivered - b[1].opened / b[1].delivered || b[1].delivered - a[1].delivered || (a[0] < b[0] ? -1 : 1)).slice(0, rules.lowEngagement).map(([k]) => nameOf[k]);
    const wantBounce = [...per].filter(([, m]) => m.bounced > 0).sort((a, b) => b[1].bounced - a[1].bounced || (a[0] < b[0] ? -1 : 1)).slice(0, rules.mostBounces).map(([k]) => nameOf[k]);
    const onboard = watch.slice(watch.indexOf("### Acme Onboarding Chain"), watch.indexOf("### ", watch.indexOf("### Acme Onboarding Chain") + 4));
    const tables = onboard.split("\n\n").filter((b) => b.startsWith("|")).map((b) => b.split("\n").slice(2).map((l) => l.split("|")[1].trim()));
    check("the watch list has two signals per program — the lowest open rates among accounts with at least N delivered, and the most bounce events — with the counts and the minimum the snapshot was pulled with",
      watch.includes(`the ${rules.lowEngagement} lowest open rates among accounts with at least ${rules.lowEngagementMinDelivered} delivered, and the ${rules.mostBounces} accounts with the most bounce events`) &&
        onboard.includes("Low engagement:") && onboard.includes("Deliverability:") && isDeepStrictEqual(tables[0], wantLow) && isDeepStrictEqual(tables[1], wantBounce) && full.json.counts.watchListPrograms >= 2, [tables, wantLow, wantBounce]);
    check("the watch list names accounts only: no roll-up row (\"All other accounts\", \"No company link\") is ranked in it",
      !watch.includes("All other accounts") && !watch.includes("No company link"));

    // The glossary.
    const gloss = section(md, "## How each number is calculated");
    const entries = gloss.split("\n### ").slice(1);
    check(`the formula glossary is rendered for every metric the report shows (${entries.length}), each with its object, the fields and the value that counts, the filters every count carries, the date field and the calculation`,
      entries.length === full.json.counts.metricsExplained && entries.length >= 15 && entries.every((e) => ["- Read from: `", "- Counts: ", "- Filters on every count: ", "- Date field: ", "- Calculation: "].every((part) => e.includes(part))) &&
        ["Sent", "Delivered", "Opened", "Open rate", "Clicked", "Click rate", "Unique recipients", "Accounts reached", "Participant records", "Bounced", "Response rate"].every((label) => entries.some((e) => e.startsWith(`${label}\n`))),
      entries.map((e) => e.split("\n")[0]));
    const entry = (label) => entries.find((e) => e.startsWith(`${label}\n`));
    check("glossary: Delivered is the attempts that went out and did not bounce, open and click rate divide by it with the zero-denominator rule stated, and the per-step source is given because this snapshot has step detail",
      entry("Delivered").includes("- Counts: IsSent = YES and IsBounced is not YES") && entry("Delivered").includes('- Filters on every count: Source = "Advanced Outreach"; AddressType = "To"') && entry("Delivered").includes("- Date field: ExecutedDate") &&
        entry("Delivered").includes("- Per-step rows are read from: ao_emails: EmailSend = true and Bounce is not true") && entry("Open rate").includes("- Calculation: Opened ÷ Delivered. Blank, never 0%, when Delivered is 0.") &&
        entry("Click rate").includes("- Calculation: Clicked ÷ Delivered.") && entry("Clicked").includes("www.acme.com/mail-settings") && entry("Submitted").includes("- Filters on every count: TestParticipant = false") &&
        gloss.includes("Internal recipients are addresses ending in @acme.com"));
    check("glossary: no runnable command per metric — formulas and their sources only", !/gs-admin|rp run|--where-filters/.test(gloss));

    // CSVs.
    const csvDir = join(ROOT, "csv");
    const files = readdirSync(csvDir).sort();
    const csvOf = (name) => readFileSync(join(csvDir, name), "utf8");
    const lines = (name) => csvOf(name).replace(BOM_RE, "").trimEnd().split("\r\n");
    const programsCsv = lines("engagement-programs.csv");
    const h = programsCsv[0].split(",");
    const nps = programsCsv.find((l) => l.startsWith("p-nps,")).split(",");
    const renew = lines("engagement-templates.csv").find((l) => l.includes("tpl-renew-b")).split(",");
    const th = lines("engagement-templates.csv")[0].split(",");
    check("--csv-dir writes one CSV per table plus the glossary and the caveats, each with the BOM Excel needs, and the summary lists them",
      isDeepStrictEqual(files, ["engagement-caveats.csv", "engagement-glossary.csv", "engagement-programs.csv", "engagement-status.csv", "engagement-steps.csv", "engagement-templates.csv", "engagement-watch-list.csv"]) &&
        files.every((f) => csvOf(f).startsWith(BOM)) && isDeepStrictEqual([...full.json.csvFiles].sort(), files) && lines("engagement-caveats.csv").length === built.caveats.length + 1 && lines("engagement-glossary.csv").length === entries.length + 1);
    check("CSV cells are numbers a spreadsheet can use: a rate is a fraction, a metric with no value is blank (never 0), and the tracking state has its own column",
      programsCsv.length === 6 && Number(nps[h.indexOf("openRate")]) > 0 && Number(nps[h.indexOf("openRate")]) < 1 && nps[h.indexOf("click_tracking")] === "tracked" && nps[h.indexOf("clicked")] === "0" &&
        renew[th.indexOf("clicked")] === "" && renew[th.indexOf("clickRate")] === "" && renew[th.indexOf("click_tracking")] === "not-tracked" && nps[h.indexOf("response_tracking")] === "tracked" && nps[h.indexOf("includes_incomplete_period")] === "no", [h, nps, renew]);
    check("the watch-list CSV carries both signals", lines("engagement-watch-list.csv").some((l) => l.includes(",low engagement,")) && lines("engagement-watch-list.csv").some((l) => l.includes(",deliverability,")));
    const none = report(["--snapshot", GOLDEN_SNAPSHOT, "--report", outDir()]);
    check("without --csv-dir no CSV is written", none.json.csvDir === null && none.json.csvFiles.length === 0);
  }

  // ══ Recipients, carried months, reconciliation ═══════════════════════════
  {
    const ext = report(["--snapshot", GOLDEN_SNAPSHOT, "--report", outDir(), "--all", "--exclude-internal"]);
    const all = report(["--snapshot", GOLDEN_SNAPSHOT, "--report", outDir(), "--all"]);
    const sent = (r, name) => Number(tableUnder(r.md, "## Programs").rows.find((x) => x[0] === name)[2]);
    const extSent = GOLD.facts.byTemplate.filter((r) => r.programId === "p-onboard" && r.recipientClass === "external").reduce((s, r) => s + r.sent, 0);
    check("--exclude-internal leaves internal recipients out of every send figure, uses the external distinct counts, and the report says so in its header and its caveats",
      sent(ext, "Acme Onboarding Chain") === extSent && sent(all, "Acme Onboarding Chain") > extSent && ext.md.includes("- recipients: external only; internal domains: acme.com") && all.md.includes("- recipients: all; internal domains: acme.com") &&
        section(ext.md, "## Caveats & data gaps").includes("Internal recipients are left out") && !tableUnder(ext.md, "## Programs").rows.some((r) => r[0] === "Acme Internal Pilot") &&
        ext.json.counts.programsShown === tableUnder(ext.md, "## Programs").rows.length - 1 && ext.json.counts.programsShown === 4 && section(ext.md, "## Programs").includes("Showing every status: 4 program(s). 1 more has no send to the recipients shown.") &&
        Number(tableUnder(ext.md, "## Programs").rows.find((x) => x[0] === "Acme Onboarding Chain")[3]) === GOLD.facts.uniques.find((u) => u.programId === "p-onboard" && u.scope === "window").external.people);

    const prevPath = join(ROOT, "prev.json");
    const selPath = join(ROOT, "sel.json");
    const prevRun = adapter("run", ["--today", "2026-08-15", "--pulled-at", "2026-08-15T09:00:00-07:00", "--from", "2026-05", "--to", "2026-08", "--internal-domain", "acme.com", "--run", "rep-prev", "--out", prevPath], { cutoff: "2026-08-16" });
    const selRun = adapter("run", ["--today", "2026-09-15", "--pulled-at", "2026-09-15T09:00:00-07:00", "--from", "2026-05", "--internal-domain", "acme.com", "--previous", prevPath, "--run", "rep-sel", "--out", selPath]);
    const sel = report(["--snapshot", selPath, "--report", outDir(), "--csv-dir", join(ROOT, "csv-sel")]);
    const SEL = JSON.parse(readFileSync(selPath, "utf8"));
    check("a report over a selective refresh carries the carried-forward caveat — which months, the pull they came from, the horizon — and says the refresh was selective",
      prevRun.code === 0 && selRun.code === 0 && SEL.meta.refresh.mode === "selective" && sel.code === 0 && sel.md.includes("- pull: selective (") &&
        SEL.meta.refresh.carriedMonths.every((m) => section(sel.md, "## Caveats & data gaps").includes(m)) && section(sel.md, "## Caveats & data gaps").includes("carried forward from the pull of 2026-08-15T09:00:00-07:00") &&
        isDeepStrictEqual(sel.json.pull.carriedMonths, SEL.meta.refresh.carriedMonths) && sel.json.leadCaveats[0] === `${SEL.meta.refresh.carriedMonths.length} month(s) carried forward from an earlier pull, not read again` && sel.json.leadCaveats.length === 2 && readFileSync(join(ROOT, "csv-sel", "engagement-programs.csv"), "utf8").includes(",yes,"), [selRun.stderr?.slice(-200), sel.json?.pull]);
    check("a full pull's report carries no carried-forward caveat", !md1.includes("carried forward"));

    const failed = structuredClone(GOLD);
    failed.reconciliation.ok = false;
    failed.reconciliation.checks[1] = { ...failed.reconciliation.checks[1], ok: false, mismatches: 2 };
    failed.caveats.push({ id: "reconciliation-mismatch", detail: { checks: ["accounts-sum-to-program"] } });
    const bad = report(["--snapshot", snapshotFile("failed", failed), "--report", outDir()]);
    check("a closed-month reconciliation mismatch is a FAILURE the report leads with: a banner before any table, the caveat first in the block, and the summary names the failed check",
      bad.code === 0 && bad.md.indexOf("RECONCILIATION FAILED") < bad.md.indexOf("## Headline by status") && bad.md.indexOf("RECONCILIATION FAILED") > 0 && section(bad.md, "## Caveats & data gaps").split("\n")[2].startsWith("- RECONCILIATION FAILED") &&
        bad.json.reconciliation.closedMonthsOk === false && /^reconciliation FAILED/.test(bad.json.leadCaveats[0]) && isDeepStrictEqual(bad.json.reconciliation.failedChecks, ["accounts-sum-to-program"]), bad.json?.reconciliation);
    const drifting = structuredClone(GOLD);
    drifting.reconciliation.checks[0] = { ...drifting.reconciliation.checks[0], drift: 3 };
    drifting.caveats.push({ id: "incomplete-period-drift", detail: { from: "2026-09-01", checks: [{ id: "templates-sum-to-program", drift: 3 }] } });
    const drift = report(["--snapshot", snapshotFile("drift", drifting), "--report", outDir()]);
    check("drift in the incomplete period is NOT a failure: no banner, a caveat that says so, and the summary reports it apart from the closed months",
      drift.code === 0 && !drift.md.includes("RECONCILIATION FAILED") && /This is not a failure/.test(section(drift.md, "## Caveats & data gaps")) && drift.json.reconciliation.closedMonthsOk === true &&
        isDeepStrictEqual(drift.json.reconciliation.incompletePeriodDrift, [{ id: "templates-sum-to-program", drift: 3 }]));
  }

  // ══ Refusals, hostile names, never overwriting ════════════════════════════
  {
    const again = report(["--snapshot", offPath, "--kb", KB, "--report", dir1]);
    check("a second report into the same directory never overwrites the first", again.code === 0 && again.json.report.endsWith("engagement-2026-09-15-2.md") && readFileSync(first.json.report, "utf8") === md1);
    const future = report(["--snapshot", snapshotFile("v2", { ...GOLD, schemaVersion: 2 }), "--report", outDir()]);
    check("the report reads T-10 through the read floor: a snapshot of another schemaVersion is refused loudly, and nothing is written",
      future.code === 1 && /schemaVersion 2 is not 1/.test(future.stderr) && future.json === null);
    const wrongKb = report(["--snapshot", offPath, "--kb", join(ROOT, "kb-other", "acme-sbx"), "--report", outDir()]);
    check("a KB of another tenant is refused: a report never carries one tenant's name over another's numbers", wrongKb.code === 1 && /belongs to acme--sbx\.gainsightcloud\.com but the snapshot was pulled from acme\.gainsightcloud\.com/.test(wrongKb.stderr));
    const noKb = report(["--snapshot", offPath, "--report", outDir()]);
    check("without --kb the tenant line names the host the snapshot was pulled from", noKb.md.includes("- tenant: acme.gainsightcloud.com (https://acme.gainsightcloud.com, unknown)"));
    const missing = report(["--snapshot", join(ROOT, "nope.json"), "--report", outDir()]);
    const usage = runNode(REPORT, ["--report", outDir()]);
    check("a missing snapshot and a missing flag each fail with exit 1 and a message naming what is wrong", missing.code === 1 && /file not found/.test(missing.stderr) && usage.status === 1 && /usage: engagement-report\.mjs --snapshot/.test(usage.stderr));
    const hostile = structuredClone(GOLD);
    hostile.dimensions.programs.find((p) => p.id === "p-onboard").name = "CS|Risk|Onboarding <b>x</b>\n=1+1";
    const h = report(["--snapshot", snapshotFile("hostile", hostile), "--report", outDir(), "--csv-dir", join(ROOT, "csv-hostile")]);
    const row = h.md.split("\n").find((l) => l.includes("CS\\|Risk"));
    check("a program name full of pipes and a line break stays one table cell in the markdown and one quoted field in the CSV",
      h.code === 0 && !!row && row.split(/(?<!\\)\|/).length === tableUnder(h.md, "## Programs").headers.length + 2 && row.includes("<br>") && readFileSync(join(ROOT, "csv-hostile", "engagement-programs.csv"), "utf8").includes('"CS|Risk|Onboarding <b>x</b>\n=1+1"'));
  }

  // ══ The skill's prose (house rule 18) ═════════════════════════════════════
  {
    const skill = readFileSync(join(PLUGIN, "skills", "email-engagement", "SKILL.md"), "utf8");
    const bare = skill.split("\n").filter((l) => /refresh/i.test(l) && !/\/gs-superadmin:email-engagement refresh\b/.test(l));
    check("the skill never writes the word for its later pull-again mode bare: another skill of that name exists, so every mention carries this skill's name in front",
      bare.length === 0, bare);
    const flags = (text) => new Set([...text.matchAll(/--[a-z][a-z-]+/g)].map((m) => m[0]));
    const adapterFlags = flags(readFileSync(ENGINE, "utf8"));
    const reportFlags = flags(readFileSync(REPORT, "utf8"));
    const skillOnly = new Set(["--snapshot", "--csv", "--xlsx", "--slug"]);
    const fence = skill.slice(skill.indexOf("### 6 — Final report")).split("```")[1];
    const rules = skill.slice(skill.indexOf("Substitute from the step-4 summary JSON"));
    const placeholders = [...new Set([...fence.matchAll(/<[a-zA-Z ]+>/g)].map((m) => m[0]))];
    check("F-481: every placeholder of the final block has a substitution rule, and none asks the reader to choose: the Caveats line is filled from the summary's leadCaveats",
      placeholders.length >= 12 && placeholders.every((ph) => rules.includes(`\`${ph}\``)) && fence.includes("<N> — <lead>") && rules.includes("`leadCaveats`") && !/most affect/.test(skill), placeholders.filter((ph) => !rules.includes(`\`${ph}\``)));
    const table = (heading) => [...(skill.split(heading)[1] ?? "").split("\n\n")[1].matchAll(/^\| `(--[a-z-]+)/gm)].map((m) => m[1]);
    const pullFlags = table("Pull flags");
    const repFlags = table("Report flags");
    check("every flag the skill passes through exists in the script it is passed to, in that script's own spelling: pull flags in the adapter, report flags in the report script",
      pullFlags.length >= 9 && pullFlags.every((f) => adapterFlags.has(f)) && repFlags.length === 4 && repFlags.every((f) => reportFlags.has(f)) && ["--internal-domain", "--unsubscribe-link", "--accounts", "--step-detail"].every((f) => pullFlags.includes(f)) &&
        [...flags(skill)].every((f) => adapterFlags.has(f) || reportFlags.has(f) || skillOnly.has(f)), [pullFlags, repFlags, [...flags(skill)].filter((f) => !adapterFlags.has(f) && !reportFlags.has(f) && !skillOnly.has(f))]);
  }

  // ══ One aggregation path (house rule 11) ══════════════════════════════════
  {
    const src = readFileSync(REPORT, "utf8").replace(/\/\/.*$/gm, "");
    check("the report never aggregates on its own: its source reads no fact table, sums nothing and divides nothing — every figure is a runQuery cell",
      !/\.facts\b/.test(src) && !/\.reduce\(/.test(src) && !/SEND_MEASURES/.test(src) && !/[\w)\]]\s\/\s[\w(]/.test(src) && /runQuery\(/.test(src), [src.match(/[\w)\]]\s\/\s[\w(].{0,30}/)?.[0]]);
  }
} finally {
  removeTempDir(ROOT);
}

if (failures) {
  console.log(`\nengagement-report: ${failures} FAILED of ${ran}`);
  process.exit(1);
}
console.log(`\nengagement-report: all ${ran} checks passed`);
