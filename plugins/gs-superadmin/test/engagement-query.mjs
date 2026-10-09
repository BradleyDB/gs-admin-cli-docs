#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// engagement-query.mjs (test) — fixtures for scripts/engagement-query.mjs
// (ENG-4): the one aggregation path over a T-10 snapshot, its metric registry,
// the glossary and caveats rendered from it, and the T-10 read floor's use.
//
// Snapshots come from the REAL producer, never hand-built:
//   GOLD  test/fixtures/engagement/snapshot-acme.json (accounts on, step detail
//         on, all three click-tracking states, both recipient classes);
//   OFF   a pull with the adapter's defaults (no account grain, no step detail);
//   SEL   a selective refresh over an earlier pull (carried-forward months).
// OFF and SEL are pulled here through the real process and the stand-in CLI.
//
// Expectations are derived independently (R-10): ORACLE sums below walk the
// snapshot's fact rows with a hand-written predicate per case, and one check
// counts the fictional tenant's own rows. Named cases are also pinned to a
// committed golden (query-golden.json); `--write-golden` regenerates it.
//
// The module must run where a browser runs it: the suite loads its bytes in a
// context with no Node globals and repeats the golden cases there.
//
// Run:  node plugins/gs-superadmin/test/engagement-query.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import vm from "node:vm";
import { makeTempDir, removeTempDir, writeFiles, runNode } from "../../../test/rig.mjs";
import * as Q from "../scripts/engagement-query.mjs";
import { buildQuery } from "../scripts/engagement.mjs";
import { buildTenant, kbFiles } from "./fixtures/engagement/acme-tenant.mjs";

const {
  runQuery, metric, METRICS, SOURCES, SEND_MEASURES, CAVEATS, REASONS, DIMENSIONS, formatCell, glossary, glossaryNotes, describeMetric, caveatsFor, caveatText, dataPulledLine,
  reasonText, statusLabel, openSnapshot, programClickAvailability, readResponses, accountAvailability, rollUpTracking, measuresCounted, NO_VALUE, NOT_TRACKED, UNKNOWN_MARK,
} = Q;

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN = join(HERE, "..");
const MODULE = join(PLUGIN, "scripts", "engagement-query.mjs");
const ENGINE = join(PLUGIN, "scripts", "engagement.mjs");
const FAKE = join(HERE, "fixtures", "engagement", "fake-gs-admin.mjs");
const GOLDEN_SNAPSHOT = join(HERE, "fixtures", "engagement", "snapshot-acme.json");
const GOLDEN = join(HERE, "fixtures", "engagement", "query-golden.json");
const WRITE_GOLDEN = process.argv.includes("--write-golden");

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
const throws = (fn, re) => {
  try {
    fn();
  } catch (e) {
    return re.test(e.message);
  }
  return false;
};

const ROOT = makeTempDir("gs-superadmin-engagement-query");
try {
  // ── The snapshots ──────────────────────────────────────────────────────────
  const GOLD = openSnapshot(JSON.parse(readFileSync(GOLDEN_SNAPSHOT, "utf8")));
  const WS = join(ROOT, "ws");
  writeFiles(WS, { ".gs-superadmin/.keep": "" });
  writeFiles(join(ROOT, "kb"), kbFiles("acme-prod"));
  const KB = join(ROOT, "kb", "acme-prod");
  const pull = (run, flags, tenant = {}) => {
    const out = join(ROOT, `${run}.json`);
    const r = runNode(ENGINE, ["run", "--workspace", WS, "--bin", FAKE, "--kb", KB, "--page-size", "400", "--internal-domain", "acme.com", "--run", run, "--out", out, ...flags], { env: { ...process.env, FAKE_TENANT: JSON.stringify(tenant) } });
    if (r.status !== 0) throw new Error(`fixture pull ${run} failed (${r.status}): ${r.stderr.slice(-600)}`);
    return { path: out, snapshot: openSnapshot(JSON.parse(readFileSync(out, "utf8"))) };
  };
  const OFF = pull("off", ["--today", "2026-09-15", "--pulled-at", "2026-09-15T09:00:00-07:00", "--from", "2026-06"]).snapshot;
  const prev = pull("prev", ["--today", "2026-08-15", "--pulled-at", "2026-08-15T09:00:00-07:00", "--from", "2026-05", "--to", "2026-08"], { cutoff: "2026-08-16" });
  const SEL = pull("sel", ["--today", "2026-09-15", "--pulled-at", "2026-09-15T09:00:00-07:00", "--from", "2026-05", "--previous", prev.path]).snapshot;
  check("fixtures: the three snapshots are what the cases need — accounts and step detail on; both off; a selective refresh with carried months",
    accountAvailability(GOLD).pulled && GOLD.meta.stepDetail && !accountAvailability(OFF).pulled && !OFF.meta.stepDetail && SEL.meta.refresh.mode === "selective" && SEL.meta.refresh.carriedMonths.length > 0,
    [OFF.meta.accounts, SEL.meta.refresh]);

  // ── The oracle: straight sums over fact rows, one hand-written predicate per case ──
  const zero = () => Object.fromEntries(SEND_MEASURES.map((k) => [k, 0]));
  const sumRows = (rows) => rows.reduce((m, r) => { for (const k of SEND_MEASURES) m[k] += r[k]; return m; }, zero());
  const additive = ["sent", "delivered", "bounced", "rejected", "unsubscribed", "spamComplaints", "opened"];
  const values = (row, ids = additive) => Object.fromEntries(ids.map((id) => [id, row.cells[id].value]));
  const pick = (m, ids = additive) => Object.fromEntries(ids.map((id) => [id, m[id]]));
  const T = GOLD.facts.byTemplate;
  const statusOf = (id) => GOLD.dimensions.programs.find((p) => p.id === id).statuses;
  const total = (filters, table = "byTemplate") => runQuery(GOLD, filters, { groupBy: table === "byAccount" ? ["account"] : table === "byStep" ? ["step"] : [], metrics: additive }).total;

  // ── Each filter, alone ─────────────────────────────────────────────────────
  /** @type {Array<[string, *, (r: *) => boolean]>} */
  const cases = [
    ["no filter", {}, () => true],
    ["months", { months: ["2026-07", "2026-08"] }, (r) => r.month === "2026-07" || r.month === "2026-08"],
    ["programs", { programs: ["p-onboard", "p-nps"] }, (r) => r.programId === "p-onboard" || r.programId === "p-nps"],
    ["statuses (a program matches when ANY of its statuses is listed)", { statuses: ["NEW"] }, (r) => statusOf(r.programId).includes("NEW")],
    ["statuses, several", { statuses: ["PROCESSING", "PAUSE"] }, (r) => statusOf(r.programId).some((s) => s === "PROCESSING" || s === "PAUSE")],
    ["recipientClass external", { recipientClass: "external" }, (r) => r.recipientClass === "external"],
    ["recipientClass internal", { recipientClass: "internal" }, (r) => r.recipientClass === "internal"],
    ["templates", { templates: ["tpl-welcome"] }, (r) => r.templateId === "tpl-welcome"],
    ["templates, the sends that name none", { templates: [null] }, (r) => r.templateId == null],
    ["models", { models: ["DRIPV2"] }, (r) => ["p-onboard", "p-pilot", "p-unlisted"].includes(r.programId)],
    ["audiences", { audiences: ["USER"] }, (r) => r.programId === "p-pilot"],
    ["groups (none assigned yet: null is a value)", { groups: [null] }, () => true],
    ["supergroups, one no program has", { supergroups: ["Surveys"] }, () => false],
    // Combinations.
    ["months + recipientClass", { months: ["2026-09"], recipientClass: "external" }, (r) => r.month === "2026-09" && r.recipientClass === "external"],
    ["months + programs + recipientClass", { months: ["2026-06", "2026-07"], programs: ["p-onboard"], recipientClass: "internal" }, (r) => (r.month === "2026-06" || r.month === "2026-07") && r.programId === "p-onboard" && r.recipientClass === "internal"],
    ["statuses + templates + months", { statuses: ["PROCESSING"], templates: ["tpl-welcome", "tpl-nps"], months: ["2026-08"] }, (r) => statusOf(r.programId).includes("PROCESSING") && ["tpl-welcome", "tpl-nps"].includes(r.templateId) && r.month === "2026-08"],
    ["audiences + recipientClass + models", { audiences: ["CUSTOMER"], recipientClass: "external", models: ["DRIPV2", "CSAT_SURVEY_V2"] }, (r) => ["p-onboard", "p-unlisted", "p-nps"].includes(r.programId) && r.recipientClass === "external"],
  ];
  for (const [name, filters, pred] of cases) {
    const got = values(total(filters));
    const want = pick(sumRows(T.filter(pred)));
    check(`filter: ${name} — the additive measures equal a straight sum of the rows the predicate keeps`, isDeepStrictEqual(got, want) && (name.includes("no program has") || want.sent > 0 || name.includes("none assigned")), { got, want });
  }
  check("filter: months that are not in the window keep nothing, and an unknown program keeps nothing (never everything)",
    total({ months: ["2031-01"] }).cells.sent.value === 0 && total({ programs: ["p-nope"] }).cells.sent.value === 0);

  // ── The fact table is picked by grain, and the grains agree ───────────────
  const A = GOLD.facts.byAccount;
  const S = GOLD.facts.byStep;
  check("grain: grouping by account reads byAccount, by step or variant reads byStep, anything else reads byTemplate",
    runQuery(GOLD, {}, { groupBy: ["account"], metrics: ["sent"] }).table === "byAccount" && runQuery(GOLD, {}, { groupBy: ["program", "step"], metrics: ["sent"] }).table === "byStep" &&
      runQuery(GOLD, {}, { groupBy: ["variant"], metrics: ["sent"] }).table === "byStep" && runQuery(GOLD, {}, { groupBy: ["program", "month"], metrics: ["sent"] }).table === "byTemplate" &&
      runQuery(GOLD, { accountBuckets: ["account"] }, { groupBy: ["program"], metrics: ["sent"] }).table === "byAccount");
  check("grain: accounts beside templates or steps is refused — no table holds both, and joining two would double-count",
    throws(() => runQuery(GOLD, {}, { groupBy: ["account", "template"], metrics: ["sent"] }), /no fact table holds accounts beside templates or steps/) &&
      throws(() => runQuery(GOLD, { templates: ["tpl-welcome"] }, { groupBy: ["account"], metrics: ["sent"] }), /no fact table/));
  for (const p of GOLD.dimensions.programs) {
    const byT = values(runQuery(GOLD, { programs: [p.id] }, { groupBy: ["program"], metrics: additive }).rows[0]);
    const byA = values(runQuery(GOLD, { programs: [p.id] }, { groupBy: ["account"], metrics: additive }).total);
    const byS = values(runQuery(GOLD, { programs: [p.id] }, { groupBy: ["step"], metrics: additive }).total, ["sent", "delivered", "opened", "bounced"]);
    check(`grain: ${p.id} — the program's total is the same from the template table, the account table (every bucket) and the step table`,
      isDeepStrictEqual(byT, pick(sumRows(T.filter((r) => r.programId === p.id)))) && isDeepStrictEqual(byA, byT) && isDeepStrictEqual(byS, pick(byT, ["sent", "delivered", "opened", "bounced"])), { byT, byA, byS });
  }
  {
    const named = runQuery(GOLD, { accountBuckets: ["account"] }, { groupBy: ["account"], metrics: ["sent"] });
    const oneKey = GOLD.dimensions.accounts[0].key;
    const one = runQuery(GOLD, { accounts: [oneKey] }, { groupBy: ["account", "month"], metrics: ["sent", "opened"] });
    check("account grain: every bucket is a row (named accounts by name, the two roll-up rows by what they are), and a bucket filter keeps only the named ones",
      runQuery(GOLD, {}, { groupBy: ["account"], metrics: ["sent"] }).rows.some((r) => r.key.account === "other" && r.label.account === "All other accounts") &&
        runQuery(GOLD, {}, { groupBy: ["account"], metrics: ["sent"] }).rows.some((r) => r.key.account === "no-company-link" && r.label.account === "No company link") &&
        named.rows.length === GOLD.dimensions.accounts.length && named.rows.every((r) => r.label.account?.startsWith("Acme Customer")) &&
        named.total.cells.sent.value === A.filter((r) => r.bucket === "account").reduce((s, r) => s + r.sent, 0));
    check("account grain: an account filter keeps that account's rows only",
      one.total.cells.sent.value === A.filter((r) => r.accountKey === oneKey).reduce((s, r) => s + r.sent, 0) && one.rows.every((r) => r.key.account === oneKey) && one.total.cells.sent.value > 0);
  }
  check("step grain: one row per program, step and variant, with the step's name and order from the dimension table, and the template it sent",
    (() => {
      const r = runQuery(GOLD, {}, { groupBy: ["program", "step", "variant"], metrics: ["sent"] });
      const welcome = r.rows.filter((x) => x.key.program === "p-onboard" && x.label.step === "Welcome");
      return r.rows.length === new Set(S.map((x) => JSON.stringify([x.programId, x.stepId, x.variantId]))).size && welcome.length === 2 && welcome.every((x) => x.label.stepOrder === 1 && x.label.template === "Acme Welcome" && x.label.variant) &&
        welcome.reduce((s, x) => s + x.cells.sent.value, 0) === S.filter((x) => x.programId === "p-onboard" && x.templateId === "tpl-welcome").reduce((s, x) => s + x.sent, 0);
    })());
  check("template grain: a row names its template, and the step it sits on only where the template is on exactly one step of that program",
    (() => {
      const rows = runQuery(GOLD, {}, { groupBy: ["program", "template"], metrics: ["sent"] }).rows;
      const at = (t) => rows.find((r) => r.key.template === t).label;
      return isDeepStrictEqual([at("tpl-day7").stepName, at("tpl-day7").stepOrder, at("tpl-day7").stepCount], ["Day 7 check-in", 2, 1]) && at("tpl-renew").stepName === null && at("tpl-renew").stepCount === 2 &&
        at("tpl-unlisted").stepCount === 0 && rows.some((r) => r.key.template === null && r.label.template === null);
    })());

  {
    // One template sent by two programs, on a different step in each (the dimension keeps a use per program).
    const shared = structuredClone(GOLD);
    shared.dimensions.templates.find((t) => t.id === "tpl-welcome").uses.push({ programId: "p-unlisted", stepName: "Intro", stepOrder: 4, stepCount: 1 });
    for (const r of shared.facts.byTemplate) if (r.programId === "p-unlisted") r.templateId = "tpl-welcome";
    const rows = runQuery(shared, { templates: ["tpl-welcome"] }, { groupBy: ["program", "template"], metrics: ["sent"] }).rows;
    const of = (p) => rows.find((r) => r.key.program === p)?.label;
    check("template grain: a template two programs send is named with the step of THAT program in each row, and with no step when the row spans programs",
      rows.length === 2 && of("p-onboard").stepName === "Welcome" && of("p-onboard").stepOrder === 1 && of("p-unlisted").stepName === "Intro" && of("p-unlisted").stepOrder === 4 &&
        runQuery(shared, {}, { groupBy: ["template"], metrics: ["sent"] }).rows.find((r) => r.key.template === "tpl-welcome").label.stepName === null, rows.map((r) => r.label));
  }

  // ── Against the tenant's own rows (not the snapshot's) ────────────────────
  {
    const tenant = buildTenant();
    const months = new Set(GOLD.dimensions.months);
    const want = new Map();
    for (const r of tenant.tables.email_log_v2) {
      if (r.Source !== "Advanced Outreach" || r.AddressType !== "To" || !months.has(r.ExecutedDate.slice(0, 7))) continue;
      const m = want.get(r.SourceId) ?? { sent: 0, delivered: 0, opened: 0, external: 0 };
      m.sent++;
      if (r.IsSent === "YES" && r.IsBounced !== "YES") m.delivered++;
      if (r.IsOpened === "YES") m.opened++;
      if (!r.LowerCaseEmailId.endsWith("@acme.com")) m.external++;
      want.set(r.SourceId, m);
    }
    const rows = runQuery(GOLD, {}, { groupBy: ["program"], metrics: ["sent", "delivered", "opened", "openRate"] }).rows;
    const ext = runQuery(GOLD, { recipientClass: "external" }, { groupBy: ["program"], metrics: ["sent"] }).rows;
    check("oracle: per program, sent, delivered, opened and the open rate equal a direct count of the fictional tenant's delivery-log rows; external sent equals the rows whose address is not internal",
      rows.length === 5 && rows.every((r) => {
        const w = want.get(r.key.program);
        return r.cells.sent.value === w.sent && r.cells.delivered.value === w.delivered && r.cells.opened.value === w.opened && r.cells.openRate.value === w.opened / w.delivered;
      }) && ext.every((r) => r.cells.sent.value === want.get(r.key.program).external),
      rows.map((r) => [r.key.program, values(r, ["sent", "delivered", "opened"]), want.get(r.key.program)]));
  }

  // ── Rates ──────────────────────────────────────────────────────────────────
  {
    const r = runQuery(GOLD, { programs: ["p-onboard"] }, { groupBy: ["program"], metrics: ["openRate", "deliveredRate", "bounceRate", "rejectedRate", "unsubscribeRate", "spamRate"] }).rows[0].cells;
    const m = sumRows(T.filter((x) => x.programId === "p-onboard"));
    check("rates: open rate divides by delivered; the delivered, bounce, rejected, unsubscribe and spam rates divide by sent",
      r.openRate.value === m.opened / m.delivered && r.deliveredRate.value === m.delivered / m.sent && r.bounceRate.value === m.bounced / m.sent && r.rejectedRate.value === m.rejected / m.sent &&
        r.unsubscribeRate.value === m.unsubscribed / m.sent && r.spamRate.value === m.spamComplaints / m.sent, r);
    // A program whose every attempt bounced: delivered 0, opened 0.
    const dead = structuredClone(GOLD);
    for (const x of dead.facts.byTemplate) if (x.programId === "p-unlisted") Object.assign(x, { delivered: 0, opened: 0, clicked: 0 });
    const cells = runQuery(dead, { programs: ["p-unlisted"] }, { groupBy: ["program"], metrics: ["delivered", "openRate", "clickRate", "bounceRate"] }).rows[0].cells;
    check("rates: a zero denominator gives NO rate — null with the reason, shown as a dash, never 0% — while a rate with a real denominator beside it is still computed",
      cells.delivered.value === 0 && cells.openRate.value === null && cells.openRate.why === "zero-denominator" && formatCell("openRate", cells.openRate) === NO_VALUE &&
        cells.clickRate.value === null && cells.clickRate.why === "zero-denominator" && cells.bounceRate.value !== null, cells);
    check("rates: a filter that keeps no row gives null rates, never 0%", runQuery(GOLD, { months: ["2031-01"] }, { groupBy: [], metrics: ["openRate", "bounceRate"] }).total.cells.openRate.value === null);
  }

  // ── Uniques: exact per program; per month where pre-computed; no value otherwise ──
  {
    const U = GOLD.facts.uniques;
    const ids = ["uniqueRecipients", "accountsReached", "participantRecords"];
    const win = (p) => U.find((u) => u.programId === p && u.scope === "window");
    const mon = (p, m) => U.find((u) => u.programId === p && u.scope === "month" && u.month === m);
    const full = runQuery(GOLD, {}, { groupBy: ["program"], metrics: ids });
    check("uniques: over the whole window, each program's three distinct counts are the snapshot's window row, exactly",
      full.rows.length === 5 && full.rows.every((r) => isDeepStrictEqual(values(r, ids), { uniqueRecipients: win(r.key.program).people, accountsReached: win(r.key.program).accounts, participantRecords: win(r.key.program).participantRecords })));
    check("uniques are never summed across programs: the total row has no value for any of them, and neither has a query that does not group by program",
      ids.every((id) => full.total.cells[id].value === null && full.total.cells[id].why === "not-additive") &&
        ids.every((id) => runQuery(GOLD, {}, { groupBy: ["month"], metrics: ids }).rows.every((r) => r.cells[id].value === null && r.cells[id].why === "not-additive")) &&
        full.rows.reduce((s, r) => s + r.cells.uniqueRecipients.value, 0) > 0);
    const single = runQuery(GOLD, { months: ["2026-07"] }, { groupBy: ["program"], metrics: ids });
    check("uniques: for a single month, the month row; grouped by program and month, each month's row",
      single.rows.every((r) => r.cells.uniqueRecipients.value === mon(r.key.program, "2026-07").people && r.cells.accountsReached.value === mon(r.key.program, "2026-07").accounts) &&
        runQuery(GOLD, {}, { groupBy: ["program", "month"], metrics: ids }).rows.every((r) => r.cells.uniqueRecipients.value === mon(r.key.program, r.key.month).people && r.cells.participantRecords.value === mon(r.key.program, r.key.month).participantRecords));
    const two = runQuery(GOLD, { months: ["2026-07", "2026-08"] }, { groupBy: ["program"], metrics: ids });
    check("uniques: for any other date range there is NO figure — null with the reason, shown as a dash — never the sum of two months",
      two.rows.length > 0 && two.rows.every((r) => ids.every((id) => r.cells[id].value === null && r.cells[id].why === "needs-full-window-or-one-month" && formatCell(id, r.cells[id]) === NO_VALUE)));
    const ext = runQuery(GOLD, { recipientClass: "external" }, { groupBy: ["program"], metrics: ids });
    const int = runQuery(GOLD, { recipientClass: "internal" }, { groupBy: ["program"], metrics: ids });
    check("uniques: the external filter reads the external counts; the internal filter has none, and says so (a distinct count cannot be had by subtraction)",
      ext.rows.every((r) => r.cells.uniqueRecipients.value === win(r.key.program).external.people && r.cells.accountsReached.value === win(r.key.program).external.accounts) &&
        ext.rows.some((r) => r.cells.uniqueRecipients.value !== win(r.key.program).people) && int.rows.length > 0 && int.rows.every((r) => r.cells.uniqueRecipients.value === null && r.cells.uniqueRecipients.why === "class-not-pulled"));
    check("uniques: a template filter, a template grouping or the account grain has no distinct count",
      [runQuery(GOLD, { templates: ["tpl-welcome"] }, { groupBy: ["program"], metrics: ids }), runQuery(GOLD, {}, { groupBy: ["program", "template"], metrics: ids }), runQuery(GOLD, { accountBuckets: ["account"] }, { groupBy: ["program"], metrics: ids })]
        .every((r) => r.rows.length > 0 && r.rows.every((x) => ids.every((id) => x.cells[id].value === null && x.cells[id].why === "per-program-only"))));
    const off = runQuery(OFF, {}, { groupBy: ["program"], metrics: ids });
    check("participant records with step detail off: no value, never 0, and the reason is the snapshot's own marker; the other two counts are still there",
      off.rows.length > 0 && off.rows.every((r) => r.cells.participantRecords.value === null && r.cells.participantRecords.why === OFF.meta.participantRecords.reason && r.cells.uniqueRecipients.value > 0) &&
        OFF.meta.participantRecords.reason === "step-detail-off" && reasonText("step-detail-off").includes("step detail"));
  }

  // ── Clicks: three tracking states, and no value under not-tracked ─────────
  {
    const byTpl = runQuery(GOLD, {}, { groupBy: ["template"], metrics: ["clicked", "clickRate", "delivered"] }).rows;
    const at = (t) => byTpl.find((r) => r.key.template === t).cells;
    check("clicks: a tracked template with no click reads 0 and 0.0% — a real zero",
      isDeepStrictEqual(at("tpl-nps").clicked, { value: 0, state: "tracked" }) && at("tpl-nps").clickRate.value === 0 && formatCell("clicked", at("tpl-nps").clicked) === "0" && formatCell("clickRate", at("tpl-nps").clickRate) === "0.0%");
    check("clicks: a not-tracked template has NO value — not 0 — and reads \"Not tracked\"; its rate has none either",
      at("tpl-renew-b").clicked.value === null && at("tpl-renew-b").clicked.state === "not-tracked" && at("tpl-renew-b").clickRate.value === null && formatCell("clicked", at("tpl-renew-b").clicked) === NOT_TRACKED &&
        formatCell("clickRate", at("tpl-renew-b").clickRate) === NOT_TRACKED);
    check("clicks: an unknown template shows its value with the marker, never a bare number",
      at("tpl-day7").clicked.state === "unknown" && at("tpl-day7").clicked.value === 0 && formatCell("clicked", at("tpl-day7").clicked) === `0 ${UNKNOWN_MARK}` && formatCell("clickRate", at("tpl-day7").clickRate) === `0.0% ${UNKNOWN_MARK}` &&
        byTpl.find((r) => r.key.template === null).cells.clicked.state === "unknown");
    const byProgram = runQuery(GOLD, {}, { groupBy: ["program"], metrics: ["clicked", "clickRate"] }).rows;
    check("clicks: with no filter, a program's state is the snapshot's own roll-up (tracked only when every template is), for every program",
      byProgram.length === 5 && byProgram.every((r) => r.cells.clicked.state === programClickAvailability(GOLD, r.key.program).state) && new Set(byProgram.map((r) => r.cells.clicked.state)).size >= 2,
      byProgram.map((r) => [r.key.program, r.cells.clicked.state]));
    check("clicks: the roll-up follows the filter — p-onboard is unknown as a whole, tracked once the filter leaves only its tracked template",
      runQuery(GOLD, { programs: ["p-onboard"] }, { groupBy: ["program"], metrics: ["clicked"] }).rows[0].cells.clicked.state === "unknown" &&
        isDeepStrictEqual(runQuery(GOLD, { programs: ["p-onboard"], templates: ["tpl-welcome"] }, { groupBy: ["program"], metrics: ["clicked"] }).rows[0].cells.clicked, { value: T.filter((r) => r.templateId === "tpl-welcome").reduce((s, r) => s + r.clicked, 0), state: "tracked" }));
    // The stored count of a not-tracked template must never surface, even were it non-zero.
    const seeded = structuredClone(GOLD);
    for (const x of seeded.facts.byTemplate) if (x.templateId === "tpl-renew-b") x.clicked = 5;
    for (const x of seeded.facts.byStep) if (x.templateId === "tpl-renew-b") x.clicked = 5;
    const renew = runQuery(seeded, { programs: ["p-renew"] }, { groupBy: ["program"], metrics: ["clicked"] }).rows[0].cells.clicked;
    check("clicks: a not-tracked template's stored count never stands in — seeded with 5 a row, the template still has no value, in the template and the step table, and its program's figure leaves it out",
      runQuery(seeded, { templates: ["tpl-renew-b"] }, { groupBy: ["template"], metrics: ["clicked"] }).rows[0].cells.clicked.value === null &&
        runQuery(seeded, { programs: ["p-renew"] }, { groupBy: ["step"], metrics: ["clicked"] }).rows.filter((r) => r.label.templateId === "tpl-renew-b").every((r) => r.cells.clicked.value === null) &&
        renew.state === "unknown" && renew.value === T.filter((r) => r.templateId === "tpl-renew").reduce((s, r) => s + r.clicked, 0), renew);
    const acc = runQuery(GOLD, { accountBuckets: ["account"] }, { groupBy: ["program", "account"], metrics: ["clicked"] }).rows;
    check("clicks at the account grain carry the program's roll-up, since an account row names no template",
      acc.length > 0 && acc.every((r) => r.cells.clicked.state === programClickAvailability(GOLD, r.key.program).state));
    const across = runQuery(GOLD, { accountBuckets: ["account"] }, { groupBy: ["account"], metrics: ["clicked"] }).rows;
    const programsOf = (key) => [...new Set(GOLD.facts.byAccount.filter((r) => r.accountKey === key).map((r) => r.programId))];
    const mixed = across.filter((r) => new Set(programsOf(r.key.account).map((p) => programClickAvailability(GOLD, p).state)).size > 1);
    check("clicks at the account grain, one account across several programs: the state is the roll-up of ALL of them — an account a tracked and an unknown program both send to reads unknown, whichever comes first",
      mixed.length > 0 && mixed.every((r) => r.cells.clicked.state === "unknown") && across.every((r) => r.cells.clicked.state === rollUpTracking({ tracked: 0, notTracked: 0, unknown: 0, ...Object.fromEntries(["tracked", "unknown"].map((st) => [st, programsOf(r.key.account).filter((p) => programClickAvailability(GOLD, p).state === st).length])) })),
      across.map((r) => [r.key.account, r.cells.clicked.state, programsOf(r.key.account)]));
    check("rollUpTracking: all tracked is tracked, all not-tracked is not-tracked, any mix and nothing at all are unknown",
      rollUpTracking({ tracked: 2, notTracked: 0, unknown: 0 }) === "tracked" && rollUpTracking({ tracked: 0, notTracked: 3, unknown: 0 }) === "not-tracked" && rollUpTracking({ tracked: 1, notTracked: 1, unknown: 0 }) === "unknown" &&
        rollUpTracking({ tracked: 1, notTracked: 0, unknown: 1 }) === "unknown" && rollUpTracking({ tracked: 0, notTracked: 0, unknown: 0 }) === "unknown");
  }

  // ── Survey responses: program level, and a rate on the all-time basis only ──
  {
    const ids = ["submitted", "partiallySubmitted", "anyResponse", "surveyParticipants", "responseRate"];
    const all = readResponses(GOLD, "p-nps");
    const rows = runQuery(GOLD, {}, { groupBy: ["program"], metrics: ids }).rows;
    const nps = rows.find((r) => r.key.program === "p-nps").cells;
    check("responses: per program over the whole window, the all-time counts with the all-time denominator, and the rate from that one pair",
      nps.submitted.value === all.submitted && nps.partiallySubmitted.value === all.partiallySubmitted && nps.anyResponse.value === all.submitted + all.partiallySubmitted && nps.surveyParticipants.value === all.participants &&
        nps.responseRate.value === (all.submitted + all.partiallySubmitted) / all.participants && ids.every((id) => nps[id].basis === "all-time" && nps[id].state === "tracked") && formatCell("responseRate", nps.responseRate).endsWith("%"), nps);
    const other = rows.find((r) => r.key.program === "p-onboard").cells;
    check("responses: a program that sent no survey has no value for any of them — never 0",
      ids.every((id) => other[id].value === null && other[id].state === "not-tracked" && formatCell(id, other[id]) === NO_VALUE));
    const months = runQuery(GOLD, { months: ["2026-07"] }, { groupBy: ["program"], metrics: ids }).rows.find((r) => r.key.program === "p-nps").cells;
    const m = readResponses(GOLD, "p-nps", ["2026-07"]);
    check("responses: under a date filter, the months' counts and NO rate and NO denominator — a window count never sits beside the all-time denominator",
      months.submitted.value === m.submitted && months.submitted.basis === "months" && months.responseRate.value === null && months.responseRate.why === "all-time-basis-only" && months.surveyParticipants.value === null);
    const trend = runQuery(GOLD, { programs: ["p-nps"] }, { groupBy: ["program", "month"], metrics: ["anyResponse", "responseRate"] }).rows;
    check("responses: grouped by month, each response month's own count (the trend), with no rate",
      trend.length > 0 && trend.every((r) => r.cells.anyResponse.value === readResponses(GOLD, "p-nps", [r.key.month]).anyResponse && r.cells.responseRate.value === null) &&
        trend.reduce((s, r) => s + r.cells.anyResponse.value, 0) === GOLD.facts.responses.filter((r) => r.programId === "p-nps").reduce((s, r) => s + r.submitted + r.partiallySubmitted, 0));
    check("responses are program level: no value by template, by step, at the account grain or under a template filter",
      [runQuery(GOLD, {}, { groupBy: ["program", "template"], metrics: ids }), runQuery(GOLD, {}, { groupBy: ["step"], metrics: ids }), runQuery(GOLD, {}, { groupBy: ["account"], metrics: ids }), runQuery(GOLD, { templates: ["tpl-nps"] }, { groupBy: ["program"], metrics: ids })]
        .every((r) => r.rows.every((x) => ids.every((id) => x.cells[id].value === null && x.cells[id].why === "program-level-only"))));
    const unread = structuredClone(GOLD);
    unread.meta.metricAvailability.responses.programs["p-pilot"].state = "unknown";
    check("responses: a sum over a survey program and programs that sent none is TRACKED (no survey adds a real 0), in a total and in a trend; it is unknown only when a program's responses could not be read",
      runQuery(GOLD, {}, { groupBy: ["program"], metrics: ids }).total.cells.anyResponse.state === "tracked" && runQuery(GOLD, {}, { groupBy: ["month"], metrics: ["anyResponse"] }).rows.every((r) => r.cells.anyResponse.state === "tracked") &&
        formatCell("anyResponse", runQuery(GOLD, {}, { groupBy: [], metrics: ["anyResponse"] }).total.cells.anyResponse) === String(all.submitted + all.partiallySubmitted) &&
        runQuery(unread, {}, { groupBy: [], metrics: ["anyResponse"] }).total.cells.anyResponse.state === "unknown" && runQuery(GOLD, { programs: ["p-onboard", "p-pilot"] }, { groupBy: [], metrics: ["anyResponse"] }).total.cells.anyResponse.state === "not-tracked");
    const tot = runQuery(GOLD, {}, { groupBy: ["program"], metrics: ids }).total.cells;
    check("responses: the total adds the programs that sent a survey (the all-time table is additive across programs)",
      tot.surveyParticipants.value === GOLD.facts.responseParticipants.reduce((s, r) => s + r.participants, 0) && tot.anyResponse.value === GOLD.facts.responseParticipants.reduce((s, r) => s + r.submitted + r.partiallySubmitted, 0));
  }

  // ── A table the snapshot does not hold ─────────────────────────────────────
  {
    const acc = runQuery(OFF, {}, { groupBy: ["program", "account"], metrics: ["sent", "openRate"] });
    const step = runQuery(OFF, {}, { groupBy: ["step"], metrics: ["sent"] });
    check("accounts not pulled: an account query returns NO rows and the reason from the snapshot's own marker — never an empty table that reads as \"no accounts\"",
      acc.rows.length === 0 && acc.total === null && acc.unavailable?.reason === OFF.meta.accounts.reason && acc.unavailable.reason === "accounts-off" && /accounts off/.test(reasonText(acc.unavailable.reason)));
    check("a snapshot made before the account switch existed (no marker) is read as holding accounts: the same query returns rows",
      (() => {
        const legacy = structuredClone(GOLD);
        delete legacy.meta.accounts;
        const r = runQuery(legacy, {}, { groupBy: ["account"], metrics: ["sent"] });
        return r.unavailable === null && r.rows.length > 0;
      })());
    check("step detail off: a step query returns no rows and says why", step.rows.length === 0 && step.unavailable?.reason === "step-detail-off");
    check("accounts REACHED is still there with accounts off: it is a distinct count per program, not the account table",
      runQuery(OFF, {}, { groupBy: ["program"], metrics: ["accountsReached"] }).rows.every((r) => r.cells.accountsReached.value != null));
  }

  // ── Row provenance, and the incomplete period ─────────────────────────────
  {
    const carriedMonths = SEL.meta.refresh.carriedMonths;
    const byMonth = runQuery(SEL, {}, { groupBy: ["month"], metrics: ["sent"] }).rows;
    const facts = SEL.facts.byTemplate;
    check("provenance: a row that adds up carried-forward facts says so; a row over re-pulled months does not",
      byMonth.filter((r) => r.carried).length > 0 && byMonth.every((r) => r.carried === facts.some((x) => x.month === r.key.month && x.provenance === "carried")) &&
        byMonth.filter((r) => r.carried).every((r) => carriedMonths.includes(r.key.month)) && runQuery(SEL, { months: SEL.meta.refresh.pulledMonths }, { groupBy: ["program"], metrics: ["sent"] }).rows.every((r) => !r.carried) &&
        runQuery(SEL, {}, { groupBy: ["program"], metrics: ["sent"] }).rows.some((r) => r.carried) && runQuery(GOLD, {}, { groupBy: ["program"], metrics: ["sent"] }).rows.every((r) => !r.carried));
    const inc = GOLD.meta.incompleteFrom.slice(0, 7);
    check("incomplete period: a row is marked when it includes sends on or after incompleteFrom's month",
      runQuery(GOLD, {}, { groupBy: ["month"], metrics: ["sent"] }).rows.every((r) => r.incomplete === (r.key.month >= inc)) && runQuery(GOLD, { months: ["2026-06"] }, { groupBy: ["program"], metrics: ["sent"] }).rows.every((r) => !r.incomplete) &&
        runQuery(GOLD, {}, { groupBy: ["program"], metrics: ["sent"] }).rows.some((r) => r.incomplete));
  }

  // ── Scope, sort, having, limit, refusals ──────────────────────────────────
  {
    const active = runQuery(GOLD, { statuses: ["PROCESSING"] }, { groupBy: ["program"], metrics: ["sent"] });
    check("scope: the result says how many programs the status filter hides, the months it covers and whether that is the whole window",
      active.scope.programs === 4 && active.scope.programsHiddenByStatus === 1 && active.scope.fullWindow === true && runQuery(GOLD, { months: ["2026-06"] }, { groupBy: [], metrics: ["sent"] }).scope.fullWindow === false &&
        runQuery(GOLD, { programs: ["p-renew"], statuses: ["PROCESSING"] }, { groupBy: [], metrics: ["sent"] }).scope.programsHiddenByStatus === 1);
    const desc = runQuery(GOLD, {}, { groupBy: ["program"], metrics: ["sent", "openRate"], sort: [{ metric: "sent", dir: "desc" }] }).rows.map((r) => r.cells.sent.value);
    const byName = runQuery(GOLD, {}, { groupBy: ["program"], metrics: ["sent"], sort: [{ dim: "program" }] }).rows.map((r) => r.label.program);
    const nullsLast = runQuery(GOLD, {}, { groupBy: ["template"], metrics: ["clicked"], sort: [{ metric: "clicked", dir: "asc" }] }).rows.map((r) => r.cells.clicked.value);
    const nullsLastDesc = runQuery(GOLD, {}, { groupBy: ["template"], metrics: ["clicked"], sort: [{ metric: "clicked", dir: "desc" }] }).rows.map((r) => r.cells.clicked.value);
    check("sort: by a metric in either direction, by a dimension's name, and a row with no value sorts last whichever the direction",
      isDeepStrictEqual(desc, [...desc].sort((a, b) => b - a)) && isDeepStrictEqual(byName, [...byName].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))) && nullsLast[nullsLast.length - 1] === null && nullsLastDesc[nullsLastDesc.length - 1] === null &&
        nullsLast.indexOf(null) === nullsLast.length - 1, { desc, byName, nullsLast, nullsLastDesc });
    const order = runQuery(GOLD, { programs: ["p-onboard"] }, { groupBy: ["program", "template"], metrics: ["sent"], sort: [{ label: "stepOrder" }] }).rows.map((r) => r.label.stepOrder);
    check("sort: by a label field — templates in the order of the steps they sit on", isDeepStrictEqual(order, [1, 2]), order);
    const having = runQuery(GOLD, { accountBuckets: ["account"] }, { groupBy: ["account"], metrics: ["delivered", "openRate"], having: [{ metric: "delivered", gte: 12 }], sort: [{ metric: "openRate", dir: "asc" }], limit: 3 });
    const perAccount = new Map();
    for (const r of A.filter((x) => x.bucket === "account")) perAccount.set(r.accountKey, { delivered: (perAccount.get(r.accountKey)?.delivered ?? 0) + r.delivered, opened: (perAccount.get(r.accountKey)?.opened ?? 0) + r.opened });
    const wantLow = [...perAccount].filter(([, m]) => m.delivered >= 12).map(([k, m]) => [k, m.opened / m.delivered]).sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 3).map(([, rate]) => rate);
    check("having and limit: the lowest open rates among accounts with at least N delivered, cut to the first three — the watch list's query",
      having.rows.length === 3 && isDeepStrictEqual(having.rows.map((r) => r.cells.openRate.value), wantLow) && having.rows.every((r) => r.cells.delivered.value >= 12), [having.rows.map((r) => r.cells), wantLow]);
    check("refusals: an unknown metric, an unknown dimension, a sort or a having on something the query does not compute, and a bad recipient class each fail loudly",
      throws(() => runQuery(GOLD, {}, { groupBy: [], metrics: ["opens"] }), /unknown metric "opens"/) && throws(() => runQuery(GOLD, {}, { groupBy: ["status"], metrics: ["sent"] }), /unknown dimension "status"/) &&
        throws(() => runQuery(GOLD, {}, { groupBy: [], metrics: ["sent"], sort: [{ metric: "opened" }] }), /sort names "opened"/) && throws(() => runQuery(GOLD, {}, { groupBy: [], metrics: ["sent"], having: [{ metric: "opened", gte: 1 }] }), /having names "opened"/) &&
        throws(() => runQuery(GOLD, {}, { groupBy: ["program"], metrics: ["sent"], sort: [{ dim: "month" }] }), /does not group by/) && throws(() => runQuery(GOLD, { recipientClass: /** @type {*} */ ("everyone") }, { groupBy: [], metrics: ["sent"] }), /recipientClass must be/));
    check("every dimension the engine names can be grouped by, alone, over the table it belongs to",
      DIMENSIONS.every((d) => {
        const r = runQuery(GOLD, {}, { groupBy: [d], metrics: ["sent"] });
        return r.unavailable === null && r.rows.reduce((s, x) => s + x.cells.sent.value, 0) === r.total.cells.sent.value && r.total.cells.sent.value === sumRows(T).sent;
      }));
  }

  // ── The registry: one statement, three readers ────────────────────────────
  {
    check("registry: every metric has a label and a plain-language definition; every rate names two registry metrics; every caveat a metric names has its text",
      METRICS.every((m) => m.label && m.definition && m.definition.endsWith(".")) && METRICS.filter((m) => m.numerator).every((m) => metric(m.numerator) && metric(m.denominator)) &&
        METRICS.every((m) => m.caveats.every((c) => typeof CAVEATS[c] === "function")) && METRICS.length === new Set(METRICS.map((m) => m.id)).size);
    check("registry: the send measures are the snapshot's own, in its order, and the count rules decide what one attempt adds to",
      isDeepStrictEqual([...SEND_MEASURES], Object.keys(T[0]).filter((k) => typeof T[0][k] === "number")) &&
        isDeepStrictEqual(measuresCounted({ wentOut: true, opened: true }), ["sent", "delivered", "opened"]) && isDeepStrictEqual(measuresCounted({ wentOut: true, bounced: true, opened: true }), ["sent", "bounced", "failed", "opened"]) &&
        isDeepStrictEqual(measuresCounted({}), ["sent"]) && isDeepStrictEqual(measuresCounted({ bounced: true, rejected: true, unsubscribed: true, spam: true }), ["sent", "bounced", "rejected", "unsubscribed", "spamComplaints", "failed"]));
    const all = glossary(METRICS.map((m) => m.id), GOLD);
    check("glossary: every metric has all five parts — the object, the field or fields and the value that counts, the filters every count carries, the date field, and the calculation — and every rate says what a zero denominator gives",
      all.length === METRICS.length && all.every((e) => e.object && e.fields && Array.isArray(e.filters) && e.filters.length > 0 && e.dateField && e.calculation) &&
        all.filter((e) => metric(e.id).numerator).every((e) => /never 0%/.test(e.zeroDenominator)) && all.filter((e) => !metric(e.id).numerator).every((e) => e.zeroDenominator === null));
    const g = Object.fromEntries(all.map((e) => [e.id, e]));
    const where = (family, extra = {}) => buildQuery({ family, cls: "all", window: { start: "2026-06-01", end: "2026-07-01" }, ...extra }).where;
    const said = (c) => `${c.field} = ${typeof c.value === "string" ? JSON.stringify(c.value) : c.value}`;
    const ran = (conds, c) => conds.some((w) => w.leftOperand.fieldName === c.field && w.operator === c.op && w.rightOperand.value === c.value);
    check("glossary = what ran: the filters and the date field each entry states are the ones the adapter's own query carries, for the delivery log, the step log and the survey object",
      SOURCES.log.standing.every((c) => ran(where("template"), c) && g.sent.filters.includes(said(c))) && where("template").some((w) => w.leftOperand.fieldName === g.sent.dateField && w.operator === "GTE") &&
        where("template").some((w) => w.leftOperand.fieldName === g.sent.dateField && w.operator === "LT") &&
        SOURCES.steps.standing.every((c) => ran(where("step"), c) && g.participantRecords.filters.includes(said(c))) && where("participants-window").some((w) => w.leftOperand.fieldName === g.participantRecords.dateField) &&
        SOURCES.survey.standing.every((c) => ran(where("resp-total"), c) && ran(where("resp-participants"), c) && ran(where("resp-month"), c) && g.submitted.filters.includes(said(c))) &&
        ran(where("resp-total"), SOURCES.survey.responded) && where("resp-month").some((w) => w.leftOperand.fieldName === SOURCES.survey.dateField) && g.submitted.dateField.includes(SOURCES.survey.dateField),
      [g.sent.filters, g.participantRecords.filters, g.submitted.filters]);
    const grouped = (family) => buildQuery({ family, cls: "all", window: { start: "2026-06-01", end: "2026-07-01" }, of: "people" });
    check("glossary = what ran: the flag fields a count names are the ones the adapter groups by, and the distinct counts go through the lookups named",
      Object.values(SOURCES.log.flags).every((f) => grouped("template").group.some((x) => x.name === f.field)) && Object.values(SOURCES.steps.flags).every((f) => grouped("step").group.some((x) => x.name === f.field)) &&
        g.delivered.fields === "IsSent = YES and IsBounced is not YES" && g.opened.fields === "IsOpened = YES" && g.sent.fields.startsWith("every row") && g.bounced.perStep.includes("Bounce = true") &&
        g.delivered.perStep.startsWith("ao_emails: EmailSend = true and Bounce is not true") && g.uniqueRecipients.fields === "distinct person.Gsid, through GsPersonId" &&
        grouped("uniques-window").show[0].fieldPath.hops[0].through === "GsPersonId" && g.accountsReached.fields.includes("GsCompanyId") && g.participantRecords.object === "ao_emails" && g.responseRate.object === "survey_participant");
    check("glossary: a rate states its numerator and its denominator by name, and what is done after the read is stated: content-link classification with its patterns, the tenant's unsubscribe input, and distinct counts never summed",
      g.openRate.calculation === "Opened ÷ Delivered" && g.clickRate.calculation === "Clicked ÷ Delivered" && g.bounceRate.calculation === "Bounced ÷ Sent" && g.responseRate.calculation === "Any response ÷ Survey participants" &&
        g.openRate.fields.includes("IsOpened = YES") && g.openRate.fields.includes("IsBounced is not YES") && g.clicked.afterRead.some((a) => a.includes("mailto") && a.includes("unsubscribe|opt")) &&
        g.clicked.afterRead.some((a) => a.includes("www.acme.com/mail-settings")) && describeMetric("clicked", OFF).afterRead.some((a) => /No unsubscribe link of the tenant's own/.test(a)) &&
        g.uniqueRecipients.afterRead.some((a) => /never added/.test(a)) && g.submitted.afterRead.some((a) => a.includes("AOParticipantId")) && /RespondedDate/.test(g.submitted.dateField));
    check("glossary: the per-step source appears only when the snapshot carries step detail; a rate's glossary brings the two metrics it divides; the recipient-class note names this pull's domains",
      describeMetric("delivered", OFF).perStep === null && describeMetric("delivered", null).perStep === null && isDeepStrictEqual(glossary(["openRate"], GOLD).map((e) => e.id), ["delivered", "opened", "openRate"]) &&
        glossaryNotes(GOLD)[0].includes("@acme.com") && /No internal domain/.test(glossaryNotes(/** @type {*} */ ({ meta: { params: { internalDomains: [] } } }))[0]));
    check("UI differences are stated where they exist: Sent and Delivered against the program analytics page, the classic view's bounce percentage, content-link clicks",
      /every attempt/.test(g.sent.uiParity) && /subtracts every bounce event/.test(g.delivered.uiParity) && /classic Journey Analytics/.test(g.bounced.uiParity) && /classic Journey Analytics/.test(g.bounceRate.uiParity) && /rarely match/.test(g.clicked.uiParity));
  }

  // ── Health: the error rate, and what a reader is told when health is missing (HLT-1) ──
  {
    const { healthAvailability, silentPrograms, maskMessage, MASK_RULES } = Q;
    const of = (rows, k) => rows.reduce((x, r) => x + r[k], 0);
    const byProgram = runQuery(GOLD, {}, { groupBy: ["program"], metrics: ["sent", "bounced", "rejected", "failed", "errorRate"] });
    check("health: the error rate is send failures over Sent — per program it equals a straight sum of the rows' failed over their sent, and so does the total",
      byProgram.rows.length > 2 && byProgram.rows.some((r) => r.cells.failed.value > 0) &&
        byProgram.rows.every((r) => {
          const rows = GOLD.facts.byTemplate.filter((x) => x.programId === r.key.program);
          return r.cells.failed.value === of(rows, "failed") && r.cells.errorRate.value === of(rows, "failed") / of(rows, "sent");
        }) && byProgram.total.cells.errorRate.value === of(GOLD.facts.byTemplate, "failed") / of(GOLD.facts.byTemplate, "sent"));
    const byStep = runQuery(GOLD, { recipientClass: "external" }, { groupBy: ["step"], metrics: ["failed", "errorRate"] });
    const byAccount = runQuery(GOLD, { months: [GOLD.dimensions.months[0]] }, { groupBy: ["account"], metrics: ["failed", "errorRate"] });
    check("health: the error rate follows every filter and grain like any send measure — by step for external recipients, by account for one month — and has no value, never 0%, where nothing was sent",
      byStep.table === "byStep" && byStep.rows.some((r) => r.cells.errorRate.value > 0) && byAccount.table === "byAccount" && byAccount.rows.every((r) => r.cells.failed.value != null) &&
        runQuery(GOLD, { months: ["2031-01"] }, { groupBy: [], metrics: ["errorRate"] }).total.cells.errorRate.why === "zero-denominator");
    check("health: one attempt with both flags is one failure — the count rule is any-of, where every other count is all-of",
      isDeepStrictEqual(measuresCounted({ bounced: true, rejected: true }), ["sent", "bounced", "rejected", "failed"]) && isDeepStrictEqual(measuresCounted({ rejected: true }), ["sent", "rejected", "failed"]) && !measuresCounted({ wentOut: true, opened: true }).includes("failed"));
    const old = /** @type {any} */ ({ ...GOLD, meta: { ...GOLD.meta, health: undefined }, facts: { ...GOLD.facts, health: undefined, byTemplate: GOLD.facts.byTemplate.map(({ failed: _f, ...r }) => r) } });
    const oq = runQuery(old, {}, { groupBy: ["program"], metrics: ["sent", "failed", "errorRate"] });
    check("health: a snapshot made before failures were counted has NO failure figure — null with the reason, shown as a dash, never 0 — while Sent beside it still reads; and its health marker reads as not pulled",
      oq.rows.length > 2 && oq.rows.every((r) => r.cells.failed.value === null && r.cells.failed.why === "measure-not-in-snapshot" && r.cells.errorRate.value === null && r.cells.errorRate.why === "measure-not-in-snapshot" && r.cells.sent.value > 0) &&
        formatCell("errorRate", oq.rows[0].cells.errorRate) === NO_VALUE && oq.total.cells.failed.value === null && isDeepStrictEqual(healthAvailability(old), { pulled: false, reason: "predates-health", asOf: null, dayWindow: null, parts: {} }) &&
        silentPrograms(old).unavailable.reason === "predates-health" && ["measure-not-in-snapshot", "predates-health", "call-failed", "no-schema", "no-kb", "too-large", "all-time", "not-filterable"].every((r) => REASONS[r]));
    const g = Object.fromEntries(glossary(["failed", "errorRate"], GOLD).map((e) => [e.id, e]));
    check("health glossary: send failures state both flags joined by OR, on the delivery log and per step; the error rate names its numerator and denominator",
      g.failed.fields === "IsBounced = YES or IsRejected = YES" && /Bounce = true or Rejected = true/.test(g.failed.perStep) && g.errorRate.calculation === "Send failures ÷ Sent" && /never 0%/.test(g.errorRate.zeroDenominator) && g.sent && g.failed.object === "email_log_v2");
    check("health caveats: an output that shows no health table does not carry the health caveats; one that does carries them, and the send-failure caveat rides the metric",
      !caveatsFor(GOLD, ["sent", "openRate"]).some((c) => c.id === "schedules-from-kb" || c.id === "health-incomplete") && caveatsFor(GOLD, ["errorRate"], { health: true }).some((c) => c.id === "schedules-from-kb") &&
        caveatsFor(GOLD, ["errorRate"]).some((c) => c.id === "failures-are-send-failures") && /participantStates: The call that reads this did not return/.test(caveatText("health-incomplete", { parts: [{ part: "participantStates", reason: "call-failed" }] })));
    const silent = silentPrograms(GOLD);
    const npsRow = Object.values(silent.lists).flat().find((r) => r.programId === "p-nps");
    check("health: the health signals read the snapshot's own tables (F-491) — over this four-month golden the monthly-ingest survey program synced on its due day (ingest on-schedule, never an alarm), and with one closed month of sends in three, all of them recent, it has NO history to judge by yet: Cannot judge yet (too-new), never an alarm (F-491, 2026-10-08: the flat threshold had read a two-month-old program as No recent sends); the lists are the health lists under both names, and every signal carries its state",
      silent.unavailable === null && silent.asOf === "2026-09-15" && silent.windowDays === 90 && isDeepStrictEqual(silent.rows, []) && npsRow.list === "cannot-judge" && npsRow.signals.why === "too-new" && npsRow.signals.ingest.state === "on-schedule" && npsRow.signals.sends.state === "no-history" && npsRow.signals.sends.rule === "none" && npsRow.signals.sends.daysSince >= 30 && Q.CANNOT_JUDGE_REASONS["too-new"].length > 0 &&
        ["schedule", "ingest", "admissions", "entry", "steps", "sends"].every((k) => typeof npsRow.signals[k].state === "string") && Object.keys(silent.lists).join() === Object.keys(Q.HEALTH_LISTS).join() && Q.SILENT_LISTS === Q.HEALTH_LISTS && Q.programHealth === silentPrograms && silent.lists.ok.length >= 2);
    check("health: the masking rules are exported as data (five: the host rule is gone, F-492 ruled 2026-10-08 — a mail host is product text as often as a recipient's, and the samples never leave the workspace), a URL's scheme, host and path are protected from the id and number rules (its query is not), and a masked text is stable under masking",
      MASK_RULES.length === 5 && !MASK_RULES.some((r) => r.id === "host") && Q.MASK_PROTECTED.id === "url-path" && maskMessage("to bo@c02.example.com ref 1234567") === "to <email> ref <number>" && maskMessage(maskMessage("to bo@c02.example.com ref 1234567")) === "to <email> ref <number>" && maskMessage("via mx.recipient-corp.example") === "via mx.recipient-corp.example" &&
        maskMessage("550 Invalid Recipient - https://community.mimecast.com/docs/DOC-1369#550 [") === "550 Invalid Recipient - https://community.mimecast.com/docs/DOC-1369#550 [" && maskMessage("see https://help.example.com/articles/12345678?t=abcDEF123456xyz") === "see https://help.example.com/articles/12345678?<id>");
    // The failure categories (S3b): bounces shipped empty, the refusals as the measured product wordings; validated as data, "other" reserved.
    check("health: the shipped bounce category table is empty (the captured wordings await the ruling), the shipped refusal table is the nine measured product wordings, each with its KIND (business rule, bad address, program error; F-491, 2026-10-08) and the expected flag derived from it, the step table the seven, the table is frozen data, and a tenant's own list is validated — unique ids, text in every field, disjoint patterns, no reserved id",
      isDeepStrictEqual(Q.FAILURE_CATEGORIES.bounceReasons, []) && Q.FAILURE_CATEGORIES.participantFailures.length === 9 && Q.FAILURE_CATEGORIES.participantFailures.filter((c) => c.kind === "business-rule").length === 6 && Q.FAILURE_CATEGORIES.participantFailures.filter((c) => c.kind === "bad-address").map((c) => c.id).join() === "bounce-list,bounced-at-send,no-email" && Q.FAILURE_CATEGORIES.participantFailures.every((c) => Q.FAILURE_KINDS.includes(c.kind) && !("expected" in c)) &&
        Q.STEP_FAILURE_CATEGORIES.length === 7 && Q.STEP_FAILURE_CATEGORIES.some((c) => c.state === "SYSTEM_ERROR") && Q.STEP_FAILURE_CATEGORIES.filter((c) => c.kind === "program-error").map((c) => c.id).join() === "step-action-failed,platform-error" && Q.STEP_FAILURE_CATEGORIES.filter((c) => c.kind === "bad-address").map((c) => c.id).join() === "bounce-drop,reject-drop,bounce-list-at-send" &&
        Q.categoryTable("participantFailures").every((c) => c.expected === (c.kind === "business-rule")) && Q.categoryTable("participantFailures", [{ id: "x", label: "X", pattern: "zz", definition: "d", expected: true }])[9].kind === "business-rule" && Q.categoryTable("bounceReasons", [{ id: "y", label: "Y", pattern: "yy", definition: "d" }])[0].kind === "bad-address" &&
        Q.validateCategories([{ id: "a", label: "A", pattern: "p", definition: "d", kind: "odd" }]).some((m) => /kind must be one of/.test(m)) && Q.validateCategories([{ id: "a", label: "A", pattern: "p", definition: "d", kind: "bad-address", expected: true }]).some((m) => /contradicts/.test(m)) && Object.isFrozen(Q.FAILURE_CATEGORIES) && Q.OTHER_CATEGORY === "other" && Q.validateCategories([]).length === 0 &&
        Q.validateCategories([{ id: "a", label: "A", pattern: "x y", definition: "d" }, { id: "b", label: "B", pattern: "y", definition: "d" }]).some((p) => /disjoint/.test(p)) && Q.categoryTable("bounceReasons", [{ id: "a", label: " A ", pattern: " p ", definition: "d" }])[0].label === "A" &&
        throws(() => Q.categoryTable(/** @type {any} */ ("steps")), /no failure categories/) && throws(() => Q.categoryTable("bounceReasons", [{ id: "other", label: "A", pattern: "p", definition: "d" }]), /reserved/));
  }

  // ── The cron calculator (HLT-1 S3b): on which days a schedule fires ──────
  {
    const { readCron, cronLastDue } = Q;
    const fires = (expr, from, to) => { const m = readCron(expr).matches; const out = []; for (let n = Date.parse(from); n <= Date.parse(to); n += 86400000) { const d = new Date(n).toISOString().slice(0, 10); if (m(d)) out.push(d); } return out; };
    check("cron: a weekly schedule fires on its weekday — every Monday of September 2026 — and the day it was last due before a Tuesday is the day before, with a seven-day period",
      isDeepStrictEqual(fires("0 0 8 ? * MON *", "2026-09-01", "2026-09-30"), ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"]) && isDeepStrictEqual(cronLastDue("0 0 8 ? * MON *", "2026-09-15"), { readable: true, lastDue: "2026-09-14", previousDue: "2026-09-07", periodDays: 7 }));
    check("cron: a run due ON the day is not counted (it may not have fired yet): on a Monday the last due Monday is the one before",
      cronLastDue("0 0 8 ? * MON *", "2026-09-14").lastDue === "2026-09-07");
    check("cron: monthly on a day, every N months from a month, the last day of the month, the nth weekday, the last weekday, weekday lists and ranges, names and numbers",
      isDeepStrictEqual(fires("0 0 9 1 * ? *", "2026-08-01", "2026-09-30"), ["2026-08-01", "2026-09-01"]) && isDeepStrictEqual(fires("0 0 9 1 1/3 ? *", "2026-01-01", "2026-12-31"), ["2026-01-01", "2026-04-01", "2026-07-01", "2026-10-01"]) &&
        isDeepStrictEqual(fires("0 0 9 L * ? *", "2026-02-01", "2026-03-31"), ["2026-02-28", "2026-03-31"]) && isDeepStrictEqual(fires("0 0 9 ? * TUE#2 *", "2026-09-01", "2026-09-30"), ["2026-09-08"]) && isDeepStrictEqual(fires("0 0 9 ? * FRIL *", "2026-09-01", "2026-09-30"), ["2026-09-25"]) &&
        isDeepStrictEqual(fires("0 0 9 ? * MON,WED-FRI *", "2026-09-14", "2026-09-20"), ["2026-09-14", "2026-09-16", "2026-09-17", "2026-09-18"]) && isDeepStrictEqual(fires("0 0 9 ? * 2 *", "2026-09-14", "2026-09-20"), ["2026-09-14"]) && isDeepStrictEqual(fires("0 30 6 15 SEP ? 2026", "2026-09-01", "2026-09-30"), ["2026-09-15"]) &&
        isDeepStrictEqual(fires("0 0 9 1/10 * ? *", "2026-09-01", "2026-09-30"), ["2026-09-01", "2026-09-11", "2026-09-21"]) && isDeepStrictEqual(fires("0 0 9 * * ? *", "2026-09-29", "2026-10-01"), ["2026-09-29", "2026-09-30", "2026-10-01"]) && isDeepStrictEqual(cronLastDue("0 0 9 1 1/3 ? *", "2026-09-15"), { readable: true, lastDue: "2026-07-01", previousDue: "2026-04-01", periodDays: 91 }));
    check("cron: what it cannot read says so (never a guess): a sixth weekday of the month, a bad range, a day 32, five fields, empty, not text, a weekday name it does not know — and a schedule that fires only once in two years has no period",
      ["0 0 9 ? * MON#6 *", "0 0 9 ? * FRI-MON *", "0 0 9 32 * ? *", "0 9 * * *", "", null, "0 0 9 ? * FUNDAY *", "0 0 9 1 * ? * *"].every((e) => readCron(e).readable === false && cronLastDue(e, "2026-09-15").readable === false) &&
        isDeepStrictEqual(cronLastDue("0 0 9 15 SEP ? 2026", "2026-09-16"), { readable: true, lastDue: "2026-09-15", previousDue: null, periodDays: null }) && cronLastDue("0 0 9 15 SEP ? 2031", "2026-09-16").lastDue === null);
  }

  // ── Caveats and "data pulled" ─────────────────────────────────────────────
  {
    const adapterSource = readFileSync(ENGINE, "utf8");
    const emitted = [...adapterSource.matchAll(/caveats\.push\(\{ id: "([a-z-]+)"/g)].map((m) => m[1]);
    check(`caveats: every caveat the adapter can write into a snapshot (${emitted.length} ids, read from its source) has its text here, and both of its "not pulled" reasons have theirs`,
      emitted.length >= 9 && emitted.every((id) => typeof CAVEATS[id] === "function") && ["accounts-off", "step-detail-off"].every((r) => REASONS[r] && adapterSource.includes(`"${r}"`)), emitted.filter((id) => !CAVEATS[id]));
    const shown = ["sent", "delivered", "opened", "openRate", "clicked", "clickRate", "uniqueRecipients", "submitted"];
    const gold = caveatsFor(GOLD, shown);
    const texts = (list) => list.map((c) => c.text).join("\n");
    check("caveats: every output carries the incomplete period with its date, the opens caveat, the click caveats, the uniques rule, the survey grain, status-is-today, and what the pull left out — each once",
      ["incomplete-period", "opens-are-pixel-loads", "delivered-small-groups", "clicks-content-only", "click-tracking-states", "uniques-scope", "responses-program-level", "status-is-today", "cc-copies-excluded", "other-sources-excluded", "no-template-id", "test-participants-excluded", "step-names-unavailable"]
        .every((id) => gold.filter((c) => c.id === id).length === 1) && texts(gold).includes(GOLD.meta.incompleteFrom) && texts(gold).includes(`${GOLD.honesty.excluded.ccCopies} CC copies`), gold.map((c) => c.id));
    check("caveats: only what the output shows — with no click or survey metric shown, their caveats are absent", (() => {
      const few = caveatsFor(GOLD, ["sent", "opened", "openRate"]).map((c) => c.id);
      return !few.includes("clicks-content-only") && !few.includes("responses-program-level") && !few.includes("test-participants-excluded") && few.includes("opens-are-pixel-loads") && few.includes("delivered-small-groups");
    })());
    const sel = caveatsFor(SEL, shown);
    const carried = sel.find((c) => c.id === "carried-forward-months");
    check("caveats: a selective refresh carries the carried-forward caveat — the months, the pull they came from, and the horizon",
      !!carried && SEL.meta.refresh.carriedMonths.every((m) => carried.text.includes(m)) && carried.text.includes(SEL.meta.refresh.previousPulledAt) && /last 2 month/.test(carried.text) && !gold.some((c) => c.id === "carried-forward-months"), carried);
    const off = caveatsFor(OFF, shown);
    check("caveats: with accounts and step detail off, both say so with the reason in words",
      off.some((c) => c.id === "accounts-not-pulled" && /accounts off/.test(c.text)) && off.some((c) => c.id === "participant-records-not-pulled" && /step detail/.test(c.text)));
    const failed = structuredClone(GOLD);
    failed.caveats.push({ id: "incomplete-period-drift", detail: { from: "2026-09-01", checks: [{ id: "templates-sum-to-program", drift: 3 }] } }, { id: "reconciliation-mismatch", detail: { checks: ["accounts-sum-to-program"] } });
    const fc = caveatsFor(failed, shown);
    check("caveats: a closed-month mismatch is a FAILURE and leads the block; drift in the incomplete period is stated as not a failure",
      fc[0].id === "reconciliation-mismatch" && /RECONCILIATION FAILED/.test(fc[0].text) && fc[0].text.includes("accounts-sum-to-program") &&
        /not a failure/.test(fc.find((c) => c.id === "incomplete-period-drift").text) && fc.find((c) => c.id === "incomplete-period-drift").text.includes("templates-sum-to-program: 3"));
    check("caveats: one this module has no text for is shown with its id and detail, never dropped",
      caveatText("some-new-caveat", { n: 2 }) === 'some-new-caveat: {"n":2}' && caveatsFor({ ...GOLD, caveats: [{ id: "some-new-caveat", detail: { n: 2 } }] }, []).some((c) => c.text === 'some-new-caveat: {"n":2}'));
    check("data pulled: the line every output carries names the pull's date and time, the time zone when the snapshot has one, the tenant, the window and the provisional period",
      dataPulledLine(GOLD) === "Data pulled 2026-09-15T09:00:00-07:00 from acme.gainsightcloud.com. Window 2026-06 to 2026-09; sends on or after 2026-09-01 are provisional (opens keep arriving), and bounces and unsubscribes on sends since 2026-08-01 can still change (the 2 months a refresh reads again)." &&
        Q.provisionalText({ ...GOLD.meta, refresh: { ...GOLD.meta.refresh, repullMonths: 1 } }) === "sends on or after 2026-09-01 are provisional (opens keep arriving)" && isDeepStrictEqual(Q.provisionalSpan(GOLD.meta), { from: "2026-09-01", flagsFrom: "2026-08-01", repullMonths: 2 }) &&
        dataPulledLine(/** @type {*} */ ({ meta: { ...GOLD.meta, timeZone: "America/Denver" } })).includes("(America/Denver)"), dataPulledLine(GOLD));
    check("reasons and statuses: a reason the table lacks is shown as itself; statuses read as the Gainsight UI words them, and an unknown one as itself",
      reasonText("brand-new") === "No value (brand-new)." && reasonText(null) === "" && statusLabel("PROCESSING") === "Active" && statusLabel("NEW") === "Draft" && statusLabel("PAUSE") === "Paused" && statusLabel("STOP") === "Stopped" && statusLabel("ARCHIVED") === "ARCHIVED");
  }

  // ── The golden cases, and the same bytes with no Node around them ─────────
  {
    /** @type {Array<[string, *, *, *]>} */
    const CASES = [
      ["programs", GOLD, {}, { groupBy: ["program"], metrics: ["sent", "uniqueRecipients", "accountsReached", "delivered", "opened", "openRate", "clicked", "clickRate", "participantRecords", "responseRate"], sort: [{ metric: "sent", dir: "desc" }] }],
      ["programs, active, external, one month", GOLD, { statuses: ["PROCESSING"], recipientClass: "external", months: ["2026-08"] }, { groupBy: ["program"], metrics: ["sent", "uniqueRecipients", "openRate", "clickRate"] }],
      ["templates", GOLD, {}, { groupBy: ["program", "template"], metrics: ["sent", "delivered", "opened", "openRate", "clicked", "clickRate"], sort: [{ dim: "program" }, { label: "stepOrder" }] }],
      ["steps", GOLD, {}, { groupBy: ["program", "step", "variant"], metrics: ["sent", "openRate", "clicked"] }],
      ["accounts of one program", GOLD, { programs: ["p-onboard"] }, { groupBy: ["account"], metrics: ["sent", "delivered", "opened", "openRate", "bounced", "bounceRate"], sort: [{ metric: "sent", dir: "desc" }] }],
      ["trend", GOLD, {}, { groupBy: ["month"], metrics: ["sent", "openRate", "bounceRate", "anyResponse"] }],
      ["accounts off", OFF, {}, { groupBy: ["program", "account"], metrics: ["sent"] }],
      ["programs, accounts and step detail off", OFF, {}, { groupBy: ["program"], metrics: ["sent", "uniqueRecipients", "accountsReached", "participantRecords", "openRate", "clickRate"] }],
    ];
    const render = (mod, [, snapshot, filters, query]) => {
      const r = mod.runQuery(snapshot, filters, query);
      const line = (row) => ({ key: row.key, label: row.label, carried: row.carried, incomplete: row.incomplete, cells: Object.fromEntries(query.metrics.map((id) => [id, { ...row.cells[id], shown: mod.formatCell(id, row.cells[id]) }])) });
      return { table: r.table, unavailable: r.unavailable, scope: r.scope, rows: r.rows.map(line), total: r.total ? line(r.total) : null };
    };
    const produced = Object.fromEntries(CASES.map((c) => [c[0], render(Q, c)]));
    if (WRITE_GOLDEN) writeFileSync(GOLDEN, JSON.stringify(produced, null, 1) + "\n");
    const golden = JSON.parse(readFileSync(GOLDEN, "utf8"));
    for (const [name] of CASES) check(`golden: ${name}`, isDeepStrictEqual(JSON.parse(JSON.stringify(produced[name])), golden[name]));
    check("golden: the file holds exactly the cases run (a retired case is deleted, never left to rot)", isDeepStrictEqual(Object.keys(golden), CASES.map((c) => c[0])));

    // The page will carry this file's exact bytes. Load them where there is no
    // Node: no process, no require, no Buffer, no module system.
    const source = readFileSync(MODULE, "utf8");
    const names = [...source.matchAll(/^export (?:const|function) (\w+)/gm)].map((m) => m[1]);
    const context = vm.createContext({});
    let bare = null;
    let loadError = null;
    try {
      bare = vm.runInContext(`${source.replace(/^export /gm, "")}\n;({ ${names.join(", ")} })`, context);
    } catch (e) {
      loadError = String(e);
    }
    check("browser-safe: the module has no import or require of any kind, and its bytes load in a context with no Node globals",
      !/^\s*import[\s{(]/m.test(source.replace(/\/\*[\s\S]*?\*\//g, "")) && !/\brequire\(/.test(source) && bare !== null && isDeepStrictEqual(names.sort(), Object.keys(Q).sort()), loadError ?? names.filter((n) => !(n in Q)));
    if (bare) {
      const there = Object.fromEntries(CASES.map((c) => [c[0], JSON.parse(JSON.stringify(render(bare, c)))]));
      check("browser-safe: every golden case computed by those bytes, with no Node around them, equals the golden — the page and the report cannot disagree",
        isDeepStrictEqual(there, golden));
      check("browser-safe: the glossary, the caveats and the read floor run there too",
        JSON.stringify(bare.glossary(["openRate", "clicked"], GOLD)) === JSON.stringify(glossary(["openRate", "clicked"], GOLD)) && JSON.stringify(bare.caveatsFor(SEL, ["sent", "clicked"])) === JSON.stringify(caveatsFor(SEL, ["sent", "clicked"])) &&
          bare.openSnapshot(GOLD) === GOLD && bare.accountAvailability(OFF).reason === "accounts-off" && JSON.stringify(bare.silentPrograms(GOLD)) === JSON.stringify(Q.silentPrograms(GOLD)) && bare.healthAvailability(GOLD).pulled === true &&
          bare.maskMessage("to bo@c02.example.com") === "to <email>");
    }
  }
} finally {
  removeTempDir(ROOT);
}

if (failures) {
  console.log(`\nengagement-query: ${failures} FAILED of ${ran}`);
  process.exit(1);
}
console.log(`\nengagement-query: all ${ran} checks passed`);
