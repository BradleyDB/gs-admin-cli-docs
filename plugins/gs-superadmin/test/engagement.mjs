#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// engagement.mjs (test) — fixtures for scripts/engagement.mjs (ENG-1, ENG-2).
//
// The subject is driven two ways over ONE fictional tenant
// (test/fixtures/engagement/acme-tenant.mjs, whose answer() reproduces the
// server behaviours measured on CLI 1.0.10):
//   - in process, through the transport seam, for everything about WHICH calls
//     are made and what reduce does with the answers;
//   - as a real process with the fake CLI behind --bin, for what is about the
//     PROCESS: exit codes, resume across invocations, one call at a time.
//
// Expectations are derived independently (R-10): the ORACLE below counts the
// fixture's rows directly, with no query, no paging and no reducer, and the
// snapshot must equal it. A reducer bug and a fixture bug would have to agree
// to pass.
//
// Every pitfall the plan lists and every fact the spike recorded has a check
// named for it here; LEDGER at the foot maps each to its label, and the suite
// fails when a ledger label matches no check that ran.
//
// `--write-golden` regenerates test/fixtures/engagement/snapshot-acme.json
// (the fixture snapshot the contract pin also reads) instead of comparing it.
//
// Run:  node plugins/gs-superadmin/test/engagement.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { makeTempDir, removeTempDir, writeFiles, runNode } from "../../../test/rig.mjs";
import {
  fetchEngagement, reduceEngagement, loadRun, resolveParams, makeGate, parseWhoami, parseSentSince, parseIdList,
  expectedCalls, classifyFailure, classifyLink, readLinkClicks, parseUnsubscribeLink, NON_CONTENT_LINK_RULES, validateQuery, buildQuery, splitUnit, selectAccounts, decideClickState,
  openSnapshot, readClicked, clickAvailability, programClickAvailability, readResponses, monthsBetween,
  SEND_MEASURES, T10_SCHEMA_VERSION, ENGAGEMENT_READ_PATHS, joEngagementAdapter,
} from "../scripts/engagement.mjs";
import { buildTenant, answer, applyFaults, kbFiles, FAULT_TEXT, OWN_SITE_UNSUBSCRIBE } from "./fixtures/engagement/acme-tenant.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN = join(HERE, "..");
const ENGINE = join(PLUGIN, "scripts", "engagement.mjs");
const FAKE = join(HERE, "fixtures", "engagement", "fake-gs-admin.mjs");
const GOLDEN = join(HERE, "fixtures", "engagement", "snapshot-acme.json");
const CATALOG = JSON.parse(readFileSync(join(PLUGIN, "reference", "catalog.json"), "utf8"));
const GATE = makeGate({ catalog: CATALOG, hooksDir: join(PLUGIN, "hooks") });
const WRITE_GOLDEN = process.argv.includes("--write-golden");

let failures = 0;
const ran = [];
function check(label, cond, detail) {
  ran.push(label);
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log(`      ${JSON.stringify(detail)?.slice(0, 1200)}`);
  }
}

const ROOT = makeTempDir("gs-superadmin-engagement");
const KB_DIR = join(ROOT, "kb", "acme-prod");
writeFiles(join(ROOT, "kb"), kbFiles("acme-prod"));
let runSeq = 0;
// Small selection numbers so the fixture's twelve accounts overflow them and
// the "all other accounts" row has something in it.
const ACC = { busiest: 3, lowEngagement: 2, mostBounces: 2, lowEngagementMinDelivered: 4 };
const TODAY = "2026-09-15";
const PULLED_AT = "2026-09-15T09:00:00-07:00";

/**
 * One pull through the in-process transport. Returns everything a check may want.
 * @param {{variant?: *, raw?: *, faults?: Array<*>, previous?: *, kb?: boolean, phase?: "all"|"plan", runDir?: ?string, now?: () => number, gate?: (argv: string[]) => ?string, linkSettings?: *}} [opts]
 */
function pull({ variant = {}, raw = {}, faults = [], previous = null, kb = false, phase = "all", runDir = null, now, gate = GATE, linkSettings = null } = {}) {
  const tenant = buildTenant(variant);
  const dir = runDir ?? join(ROOT, `run-${++runSeq}`);
  const argv = [];
  const counts = {};
  const transport = {
    name: "fake",
    concurrency: 1,
    run(req) {
      argv.push(req.argv);
      let r = applyFaults(faults, counts, req.argv);
      let warn = "";
      if (r?.warn) { warn = r.stderr; r = null; }
      r ??= answer(req.argv, tenant);
      return { ok: r.status === 0, status: r.status, stdout: r.stdout, stderr: [warn, r.stderr].filter(Boolean).join("\n"), timedOut: false, ms: 0 };
    },
  };
  const params = resolveParams({ today: TODAY, pulledAt: PULLED_AT, internalDomains: ["acme.com"], pageSize: 400, accounts: ACC, ...raw });
  mkdirSync(dir, { recursive: true });
  if (!existsSync(join(dir, "run.json"))) writeFileSync(join(dir, "run.json"), JSON.stringify({ params }));
  let summary = null;
  let error = null;
  try {
    summary = fetchEngagement({ params, runDir: dir, transport, gate, kbDir: kb ? KB_DIR : null, previous, phase, now });
  } catch (e) {
    error = e;
  }
  let snapshot = null;
  let input = null;
  if (summary?.status === "ok" && phase === "all") {
    input = loadRun(dir, { previous, linkSettings, cliVersion: "fixture", pluginVersion: "fixture" });
    snapshot = reduceEngagement(input);
  }
  return { tenant, params, summary, error, snapshot, input, argv, runDir: dir };
}

// ── The oracle: straight counts over the fixture's rows ──────────────────────
const isInternal = (email) => email.endsWith("@acme.com");
const blank = () => ({ sent: 0, delivered: 0, bounced: 0, rejected: 0, unsubscribed: 0, spamComplaints: 0, opened: 0, clicked: 0 });
function oracle(tenant, snapshot) {
  const months = new Set(snapshot.dimensions.months);
  const programs = new Set(snapshot.dimensions.programs.map((p) => p.id));
  const inScope = (r) => r.Source === "Advanced Outreach" && r.AddressType === "To" && months.has(r.ExecutedDate.slice(0, 7)) && programs.has(r.SourceId);
  const rows = tenant.tables.email_log_v2.filter(inScope);
  const tally = (keyOf) => {
    const out = new Map();
    for (const r of rows) {
      const k = keyOf(r).join("|");
      const m = out.get(k) ?? blank();
      m.sent++;
      if (r.IsSent === "YES" && r.IsBounced !== "YES") m.delivered++;
      if (r.IsBounced === "YES") m.bounced++;
      if (r.IsRejected === "YES") m.rejected++;
      if (r.IsUnsubscribed === "YES") m.unsubscribed++;
      if (r.IsSpam === "YES") m.spamComplaints++;
      if (r.IsOpened === "YES") m.opened++;
      if (r._contentClick) m.clicked++;
      out.set(k, m);
    }
    return out;
  };
  const cls = (r) => (isInternal(r.LowerCaseEmailId) ? "internal" : "external");
  const distinct = (list, f) => new Set(list.map(f).filter((v) => v != null)).size;
  const uniques = new Map();
  for (const p of programs) {
    const mine = rows.filter((r) => r.SourceId === p);
    const ext = mine.filter((r) => !r.LowerCaseEmailId.includes("@acme.com"));
    uniques.set(p, { people: distinct(mine, (r) => r.GsPersonId), accounts: distinct(mine, (r) => r.GsCompanyId), extPeople: distinct(ext, (r) => r.GsPersonId), extAccounts: distinct(ext, (r) => r.GsCompanyId) });
  }
  return {
    rows,
    byTemplate: tally((r) => [r.SourceId, r.EmailTemplateId, r.ExecutedDate.slice(0, 7), cls(r)]),
    byAccount: tally((r) => [r.SourceId, r.GsCompanyId, r.ExecutedDate.slice(0, 7), cls(r)]),
    byProgramMonth: tally((r) => [r.SourceId, r.ExecutedDate.slice(0, 7)]),
    uniques,
  };
}
const factMap = (rows, keyOf) => {
  const out = new Map();
  for (const r of rows) {
    const k = keyOf(r).join("|");
    const m = out.get(k) ?? blank();
    for (const x of SEND_MEASURES) m[x] += r[x];
    out.set(k, m);
  }
  return out;
};
const sameMap = (a, b) => isDeepStrictEqual([...a].sort(), [...b].sort());
const diffMap = (a, b) => [...new Set([...a.keys(), ...b.keys()])].filter((k) => !isDeepStrictEqual(a.get(k), b.get(k))).slice(0, 4).map((k) => ({ k, got: a.get(k), want: b.get(k) }));
const rpRuns = (argv) => argv.filter((a) => a.includes("rp") && a.includes("run"));
const flag = (a, name) => a[a.indexOf(name) + 1];
const parsed = (a) => ({
  object: flag(a, "--object"),
  show: JSON.parse(flag(a, "--show-fields")),
  group: a.includes("--group-by") ? JSON.parse(flag(a, "--group-by")) : [],
  where: a.includes("--where-filters") ? JSON.parse(flag(a, "--where-filters")).conditions : [],
});

try {
  // ══ The baseline pull: every later check compares against it ══════════════
  const base = pull({ kb: true });
  const S = base.snapshot;
  check("baseline: the pull completes and reduces", base.summary?.status === "ok" && !!S, base.summary ?? String(base.error));
  const O = oracle(base.tenant, S);

  // ── ENG-2 · reduce equals the oracle ──────────────────────────────────────
  check("Sent counts every attempt: byTemplate equals a straight count of the fixture's rows, per program × template × month × class, all eight measures (SPIKE fact 4: a non-sent attempt is still a send)",
    sameMap(factMap(S.facts.byTemplate, (r) => [r.programId, r.templateId, r.month, r.recipientClass]), O.byTemplate), diffMap(factMap(S.facts.byTemplate, (r) => [r.programId, r.templateId, r.month, r.recipientClass]), O.byTemplate));
  check("baseline is non-vacuous: non-sent attempts, bounces after delivery, opens, clicks, rejections and both classes all occur",
    O.rows.some((r) => r.IsSent === "NO") && O.rows.some((r) => r.IsSent === "YES" && r.IsBounced === "YES") && O.rows.some((r) => r._contentClick) && O.rows.some((r) => r.IsRejected === "YES") &&
      S.facts.byTemplate.some((r) => r.recipientClass === "internal") && S.facts.byTemplate.some((r) => r.recipientClass === "external"));
  check("reconciliation: every check passes on a clean pull, and each compared something",
    S.reconciliation.ok && S.reconciliation.checks.every((c) => c.ok && c.compared > 0), S.reconciliation.checks);
  check("the account table sums to the program total: selected + all other accounts + no company link, per program × month × class",
    sameMap(factMap(S.facts.byAccount, (r) => [r.programId, r.month, r.recipientClass]), factMap(S.facts.byTemplate, (r) => [r.programId, r.month, r.recipientClass])));
  check("internal plus external equals all: the two classes of a program-month sum to a straight count",
    sameMap(factMap(S.facts.byTemplate, (r) => [r.programId, r.month]), O.byProgramMonth), diffMap(factMap(S.facts.byTemplate, (r) => [r.programId, r.month]), O.byProgramMonth));
  {
    const selected = S.facts.byAccount.filter((r) => r.bucket === "account");
    const want = new Map([...O.byAccount].filter(([k]) => selected.some((r) => k === [r.programId, r.accountKey, r.month, r.recipientClass].join("|"))));
    check("account level comes from email_log_v2 through a fieldPath to the company's Gsid: each selected account's rows equal a straight count",
      selected.length > 0 && sameMap(factMap(selected, (r) => [r.programId, r.accountKey, r.month, r.recipientClass]), want));
    const perProgram = new Map();
    for (const r of selected) perProgram.set(r.programId, (perProgram.get(r.programId) ?? new Set()).add(r.accountKey));
    check("R24: a program carries at most busiest + low-engagement + most-bounces accounts, and an account picked twice takes one slot",
      [...perProgram.values()].every((s) => s.size <= ACC.busiest + ACC.lowEngagement + ACC.mostBounces) && [...perProgram.values()].some((s) => s.size >= ACC.busiest));
    check("R24: the 'all other accounts' row exists where the selection left accounts out", S.facts.byAccount.some((r) => r.bucket === "other" && r.accountKey === null && r.sent > 0));
    const orphan = O.rows.filter((r) => r.GsCompanyId == null && r.SourceId === "p-onboard").length;
    check("a row with no company link gets its own bucket, never lost (null group values come back with no v key)",
      orphan > 0 && S.facts.byAccount.filter((r) => r.bucket === "no-company-link" && r.programId === "p-onboard").reduce((s, r) => s + r.sent, 0) === orphan && S.honesty.noCompanyLink.sent > 0);
    check("no account dimension row without a fact row, and every selected account has its name", S.dimensions.accounts.length === new Set(selected.map((r) => r.accountKey)).size && S.dimensions.accounts.every((a) => /^Acme Customer \d\d$/.test(a.name)));
  }
  {
    const noTpl = O.rows.filter((r) => r.EmailTemplateId == null).length;
    check("a send with no template id keeps its own row (templateId null) and is counted", noTpl > 0 && S.honesty.noTemplateId.sent === noTpl && S.facts.byTemplate.some((r) => r.templateId === null));
  }
  {
    const win = S.facts.uniques.filter((r) => r.scope === "window");
    check("unique recipients are distinct people and accounts reached distinct companies, exact per program over the window, for all and for external recipients",
      win.length === S.dimensions.programs.length && win.every((r) => {
        const o = O.uniques.get(r.programId);
        return r.people === o.people && r.accounts === o.accounts && r.external.people === o.extPeople && r.external.accounts === o.extAccounts;
      }), win.map((r) => [r.programId, r.people, r.accounts, r.external, O.uniques.get(r.programId)]));
    const months = S.facts.uniques.filter((r) => r.scope === "month" && r.programId === "p-onboard");
    const sumMonths = months.reduce((s, r) => s + r.people, 0);
    check("uniques are never summed: a program's monthly people add up to MORE than its window people, and the snapshot stores both", months.length === 13 && sumMonths > win.find((r) => r.programId === "p-onboard").people);
    check("participant records are not pulled without step detail: null, never 0, with the reason in meta for a reader's tooltip",
      S.facts.uniques.every((r) => r.participantRecords === null && r.external.participantRecords === null) && isDeepStrictEqual(S.meta.participantRecords, { pulled: false, reason: "step-detail-off" }) && S.caveats.some((c) => c.id === "participant-records-not-pulled"));
  }
  {
    const want = new Map();
    const program = new Map(base.tenant.tables.ao_participants.map((p) => [p.Gsid, p.AdvancedOutreachId]));
    let participants = 0;
    const allTime = { submitted: 0, partiallySubmitted: 0 };
    for (const r of base.tenant.tables.survey_participant) {
      const p = program.get(r.AOParticipantId);
      if (p !== "p-nps") continue;
      participants++;
      if (r.Responded) allTime[r.ResponseStatus === "Submitted" ? "submitted" : "partiallySubmitted"]++;
      if (!r.Responded || !S.dimensions.months.includes(r.RespondedDate.slice(0, 7))) continue;
      const k = r.RespondedDate.slice(0, 7);
      const x = want.get(k) ?? { submitted: 0, partiallySubmitted: 0 };
      x[r.ResponseStatus === "Submitted" ? "submitted" : "partiallySubmitted"]++;
      want.set(k, x);
    }
    const got = new Map(S.facts.responses.map((r) => [r.month, { submitted: r.submitted, partiallySubmitted: r.partiallySubmitted }]));
    check("responses come from survey_participant, attributed per program: Submitted and Partially submitted by response month, and the program's participant rows as the denominator",
      want.size > 1 && sameMap(got, want) && S.facts.responseParticipants.length === 1 && S.facts.responseParticipants[0].participants === participants && S.honesty.responses.unattributed > 0, { got: [...got], want: [...want], rp: S.facts.responseParticipants });
    const inWindow = [...want.values()].reduce((a, x) => ({ submitted: a.submitted + x.submitted, partiallySubmitted: a.partiallySubmitted + x.partiallySubmitted }), { submitted: 0, partiallySubmitted: 0 });
    check("the response rate's basis is all time: responseParticipants carries the program's all-time Submitted and Partially submitted beside its all-time denominator, and both exceed the window's on a program older than the window",
      isDeepStrictEqual(S.facts.responseParticipants, [{ programId: "p-nps", participants, ...allTime }]) && allTime.submitted > inWindow.submitted && allTime.partiallySubmitted > inWindow.partiallySubmitted, { rp: S.facts.responseParticipants, allTime, inWindow });
    const r = readResponses(S, "p-nps");
    check("readResponses, no months: the all-time counts with the all-time denominator, one basis, state tracked",
      isDeepStrictEqual(r, { state: "tracked", basis: "all-time", ...allTime, anyResponse: allTime.submitted + allTime.partiallySubmitted, participants }), r);
    const m = readResponses(S, "p-nps", S.dimensions.months);
    const one = readResponses(S, "p-nps", ["2025-10"]);
    check("readResponses, with months: the window's counts and NO denominator (participants null), so a window numerator never sits beside the all-time denominator",
      isDeepStrictEqual(m, { state: "tracked", basis: "months", ...inWindow, anyResponse: inWindow.submitted + inWindow.partiallySubmitted, participants: null }) &&
        isDeepStrictEqual(one, { state: "tracked", basis: "months", ...want.get("2025-10"), anyResponse: want.get("2025-10").submitted + want.get("2025-10").partiallySubmitted, participants: null }), { m, one });
  }

  // ── Programs: who is in the pull ──────────────────────────────────────────
  const ids = S.dimensions.programs.map((p) => p.id);
  check("status never limits the pull (R23): the Stopped program and the Paused one are in, the draft with no sends is not", ids.includes("p-promo") && ids.includes("p-renew") && !ids.includes("p-draft"), ids);
  check("status is a LIST: a Dynamic Program edited while live carries two", isDeepStrictEqual(S.dimensions.programs.find((p) => p.id === "p-renew").statuses, ["PAUSE", "NEW"]));
  check("deleted programs (sends in the log, absent from jo p list, describe says not found) are excluded and counted",
    !ids.includes("p-gone") && isDeepStrictEqual(S.honesty.excluded.deletedPrograms, { programs: 1, sent: 5 }) && S.caveats.some((c) => c.id === "deleted-programs-excluded"), S.honesty.excluded);
  check("a not-found is re-checked once, on its own, before it is believed: the deleted program was described exactly twice", base.argv.filter((a) => a.includes("describe") && a.includes("p-gone")).length === 2);
  check("a program the list missed but describe finds is IN, with its status read from describe's string form", ids.includes("p-unlisted") && isDeepStrictEqual(S.dimensions.programs.find((p) => p.id === "p-unlisted").statuses, ["PROCESSING"]));
  check("CC copies carry AddressType = CC: left out by the To filter and counted; non-JO sources left out by the Source filter and counted",
    S.honesty.excluded.ccCopies === base.tenant.tables.email_log_v2.filter((r) => r.AddressType === "CC" && S.dimensions.months.includes(r.ExecutedDate.slice(0, 7))).length &&
      S.honesty.excluded.nonJoSources === base.tenant.tables.email_log_v2.filter((r) => r.Source !== "Advanced Outreach" && S.dimensions.months.includes(r.ExecutedDate.slice(0, 7))).length && S.honesty.excluded.ccCopies > 0 && S.honesty.excluded.nonJoSources > 0, S.honesty.excluded);
  check("the window is the last 12 full months plus the current one, and the month before it is not pulled", isDeepStrictEqual(S.dimensions.months, monthsBetween("2025-09", "2026-09")) && !S.facts.byTemplate.some((r) => r.month === "2025-08") && base.tenant.tables.email_log_v2.some((r) => r.ExecutedDate.startsWith("2025-08")));
  check("incompleteFrom defaults to the start of the current month; pulledAt carries a UTC offset", S.meta.incompleteFrom === "2026-09-01" && /[+-]\d\d:\d\d$/.test(S.meta.pulledAt));
  {
    const paged = pull({ variant: { listMax: 2 } });
    check("jo p list is paged by its envelope: three pages of two list every program", paged.argv.filter((a) => a.includes("list")).map((a) => flag(a, "--page")).join(",") === "1,2,3" && isDeepStrictEqual(paged.snapshot.dimensions.programs, base.snapshot.dimensions.programs.map((p) => p)));
  }

  // ── The calls themselves (what the engine builds, read off the argv) ─────
  const stepPull = pull({ kb: true, raw: { stepDetail: true } });
  const SS = stepPull.snapshot;
  const every = [...rpRuns(base.argv), ...rpRuns(stepPull.argv)];
  check("every rp run passes --page-size (omitted, the CLI returns 50 rows and says nothing)", every.length > 60 && every.every((a) => a.includes("--page-size") && Number(flag(a, "--page-size")) === 400));
  check("no rp run passes --limit (it does not bound the rows, and above 2000 it is refused client-side)", every.every((a) => !a.includes("--limit")));
  {
    const DATE = new Set(["ExecutedDate", "CreatedAt", "RespondedDate", "SentDate", "EmailSendTime", "FirstOpenDate"]);
    const bad = [];
    let dated = 0;
    for (const a of every) {
      const byField = new Map();
      for (const c of parsed(a).where) if (DATE.has(c.leftOperand.fieldName)) byField.set(c.leftOperand.fieldName, [...(byField.get(c.leftOperand.fieldName) ?? []), c.operator]);
      for (const [f, ops] of byField) {
        dated++;
        if (ops.sort().join(",") !== "GTE,LT" || !["ExecutedDate", "CreatedAt", "RespondedDate"].includes(f)) bad.push([f, ops]);
      }
    }
    check("every date window has both bounds, on ExecutedDate (email_log_v2), CreatedAt (ao_emails) or RespondedDate (responders only) — never on a send date, which non-sent attempts lack", dated > 60 && !bad.length, bad.slice(0, 3));
    const t = buildTenant({});
    const oneSided = JSON.parse(answer(["--json", "rp", "run", "--object", "email_log_v2", "--show-fields", '[{"name":"Gsid","aggregation":"COUNT"}]', "--where-filters", '{"conditions":[{"leftOperand":{"fieldName":"SentDate"},"operator":"GTE","rightOperand":{"value":"2026-09-01"}}]}', "--page-size", "10"], t).stdout)[0].count_of_email_log_v2_Gsid.v;
    check("the hazard the rule exists for: a single-sided bound on a send date also returns every undated (non-sent) attempt in the log's history", oneSided > t.tables.email_log_v2.filter((r) => r.SentDate && r.SentDate >= "2026-09-01").length);
  }
  {
    const types = (object) => new Map(base.tenant.schemas[object].map((f) => [f.fieldName, f.dataType]));
    const bad = every.filter((a) => {
      const q = parsed(a);
      const ty = types(q.object);
      return [...q.group, ...q.show.filter((s) => s.aggregation)].some((e) => e.name && ty.get(e.name) === "LOOKUP");
    });
    check("nothing groups or aggregates on a LOOKUP field by name; companies, people, participants and survey programs go through a fieldPath to the target",
      !bad.length && every.some((a) => flag(a, "--group-by")?.includes('"through":"GsCompanyId"')) && every.some((a) => flag(a, "--show-fields").includes('"through":"GsPersonId"')), bad.slice(0, 2));
    const t = buildTenant({});
    const collapsed = JSON.parse(answer(["--json", "rp", "run", "--object", "email_log_v2", "--show-fields", '[{"name":"Gsid","aggregation":"COUNT"}]', "--group-by", '[{"name":"GsCompanyId"}]', "--page-size", "400"], t).stdout);
    check("the hazard the rule exists for: grouping on the LOOKUP resolves to an empty name and collapses every row into one group", collapsed.length === 1 && !("v" in collapsed[0].email_log_v2_GsCompanyId__gr_Name));
    check("validateQuery refuses a LOOKUP grouped by name, and a field the schema lacks", validateQuery({ object: "email_log_v2", show: [], group: [{ name: "GsCompanyId" }], where: [] }, types("email_log_v2")).length === 1 && validateQuery({ object: "email_log_v2", show: [], group: [], where: [{ leftOperand: { fieldName: "Nope" }, operator: "EQ", rightOperand: { value: 1 } }] }, types("email_log_v2")).length === 1);
  }
  check("the default source is email_log_v2, filtered to Source = Advanced Outreach and AddressType = To; ao_emails is read only with step detail",
    rpRuns(base.argv).every((a) => ["email_log_v2", "survey_participant", "company"].includes(flag(a, "--object"))) && rpRuns(stepPull.argv).some((a) => flag(a, "--object") === "ao_emails") &&
      rpRuns(base.argv).filter((a) => flag(a, "--object") === "email_log_v2" && !flag(a, "--group-by")?.includes('"AddressType"')).every((a) => flag(a, "--where-filters").includes('"Advanced Outreach"') && flag(a, "--where-filters").includes('{"leftOperand":{"fieldName":"AddressType"},"operator":"EQ","rightOperand":{"value":"To"}}')));
  check("no call asks the server for what it cannot do: no MAX on a date, no formula, no pivot, and no content field (the send log holds none)",
    every.every((a) => !/"aggregation":"MAX"|"formula"|"pivoted"|EmailSubject|TextBody|HtmlBody/.test(a.join(" "))) && every.every((a) => parsed(a).show.every((s) => !s.aggregation || ["COUNT", "COUNT_DISTINCT"].includes(s.aggregation))));
  check("a subset of programs goes in one call with IN (account batches),",
    rpRuns(base.argv).some((a) => /"SourceId"\},"operator":"IN","rightOperand":\{"value":\["p-/.test(flag(a, "--where-filters"))));
  check("month buckets are read from k, whatever order the rows come back in (the fixture returns them reversed)", S.facts.byTemplate.every((r) => /^\d{4}-\d{2}$/.test(r.month)) && isDeepStrictEqual(S.facts.byTemplate.map((r) => r.programId), [...S.facts.byTemplate.map((r) => r.programId)].sort()));
  check("email_log_v2 flags are YES/NO strings and ao_emails flags are booleans: both reduce to the same counts (steps sum to their template)", SS.reconciliation.checks.find((c) => c.id === "steps-sum-to-template")?.ok === true && SS.reconciliation.checks.find((c) => c.id === "steps-sum-to-template").compared > 100);
  check("cost: plan estimates the calls and seconds of this run, of a full run, and what step detail adds, against the token's remaining life",
    base.summary.estimate.thisRun.calls > 30 && base.summary.estimate.thisRun.seconds > 0 && base.summary.estimate.stepDetail.addsCalls > 0 && base.summary.estimate.stepDetail.addsSeconds > 0 && base.summary.estimate.token.fits === true && base.summary.estimate.token.expiresInSeconds === 3200, base.summary.estimate);
  {
    const p = pull({ phase: "plan" });
    let refused = "";
    try { loadRun(p.runDir); } catch (e) { refused = e.message; }
    check("plan makes only the cheap tenant-wide calls, writes the estimate, and leaves a run reduce refuses", p.summary.status === "ok" && rpRuns(p.argv).length === 2 && existsSync(join(p.runDir, "plan.json")) && /not complete/.test(refused), [rpRuns(p.argv).length, refused]);
  }

  // ── Step detail (R21) ─────────────────────────────────────────────────────
  check("step detail adds facts.byStep and dimensions.steps and leaves the template table identical", SS.facts.byStep.length > 0 && SS.dimensions.steps.length > 0 && !("byStep" in S.facts) && !("steps" in S.dimensions) && isDeepStrictEqual(SS.facts.byTemplate, S.facts.byTemplate));
  check("the variant is on every step row; a step that sends two variants has both", new Set(SS.facts.byStep.filter((r) => r.stepId === "st-ob-1").map((r) => r.variantId)).size === 2);
  {
    const jo = stepPull.tenant.tables.ao_emails.filter((r) => SS.dimensions.months.includes(r.CreatedAt.slice(0, 7)) && r.AdvancedOutreachId !== "p-gone");
    const want = (p, f = (_row) => true) => new Set(jo.filter((r) => r.AdvancedOutreachId === p && f(r)).map((r) => r.GsParticipantId)).size;
    const win = SS.facts.uniques.filter((r) => r.scope === "window");
    check("participant records with step detail are distinct participants from the JO send log, for all and external recipients — and outnumber people where people re-enter",
      win.every((r) => r.participantRecords === want(r.programId) && r.external.participantRecords === want(r.programId, (x) => !x.ToAddress.includes("@acme.com"))) && win.find((r) => r.programId === "p-onboard").participantRecords > win.find((r) => r.programId === "p-onboard").people && SS.meta.participantRecords.pulled === true,
      win.map((r) => [r.programId, r.participantRecords, want(r.programId)]));
    const log = new Map(stepPull.tenant.tables.email_log_v2.map((r) => [r.Gsid, r]));
    const clicked = jo.filter((r) => log.get(r.EmailLogId)?._contentClick && r.AdvancedOutreachId === "p-onboard" && r.StepId === "st-ob-1").length;
    check("step-level clicks are content-link clicks too, joined through the send's delivery-log row", clicked > 0 && SS.facts.byStep.filter((r) => r.stepId === "st-ob-1").reduce((s, r) => s + r.clicked, 0) === clicked);
  }
  {
    const uses = (t, p) => SS.dimensions.templates.find((x) => x.id === t).uses.find((u) => u.programId === p);
    check("jo p describe embeds JSON as strings (stepJson, and emailActionJson inside it): step name and order come through the KB's one parser when the template sits on ONE step",
      isDeepStrictEqual(uses("tpl-welcome", "p-onboard"), { programId: "p-onboard", stepName: "Welcome", stepOrder: 1, stepCount: 1 }) && isDeepStrictEqual(uses("tpl-day7", "p-onboard"), { programId: "p-onboard", stepName: "Day 7 check-in", stepOrder: 2, stepCount: 1 }));
    check("a template reused on two steps of a program has no single step name (stepCount 2)", isDeepStrictEqual(uses("tpl-renew", "p-renew"), { programId: "p-renew", stepName: null, stepOrder: null, stepCount: 2 }));
    check("a program the KB has no full doc for keeps its template names from the send log and is counted, not described again",
      isDeepStrictEqual(uses("tpl-promo", "p-promo"), { programId: "p-promo", stepName: null, stepOrder: null, stepCount: 0 }) && SS.dimensions.templates.find((x) => x.id === "tpl-promo").name === "Acme Promo" && isDeepStrictEqual(SS.honesty.stepNames, { source: "kb", programsWithDesign: 4, programsWithout: 2 }) && !base.argv.some((a) => a.includes("describe") && a.includes("p-promo")));
    check("template ids come from the send log's EmailTemplateId, never from a template list: a template no KB doc names is still a dimension row", SS.dimensions.templates.some((t) => t.id === "tpl-unlisted"));
    check("step rows carry the step's name and order where the KB has the design", SS.dimensions.steps.find((s) => s.stepId === "st-ob-2")?.name === "Day 7 check-in" && SS.dimensions.steps.find((s) => s.stepId === "st-pr-1")?.name === null);
  }
  {
    const extra = pull({ variant: { extraJoRow: true }, raw: { stepDetail: true } });
    const c = extra.snapshot.reconciliation.checks.find((x) => x.id === "steps-sum-to-template");
    check("a seeded mismatch between the two logs is reported: one send only the JO log holds shows up in steps-sum-to-template, by program and month, and nowhere else",
      extra.snapshot.reconciliation.ok === false && c.mismatches >= 1 && c.examples[0].key[0] === "p-onboard" && c.examples[0].left === c.examples[0].right + 1 && extra.snapshot.reconciliation.checks.filter((x) => !x.ok).length === 1 && extra.snapshot.caveats.some((x) => x.id === "reconciliation-mismatch"), c);
  }

  // ── Seeded mismatches at reduce (the reducer is a pure function of its input) ──
  {
    const again = reduceEngagement(loadRun(base.runDir, { cliVersion: "fixture", pluginVersion: "fixture" }));
    check("reduce is pure: the same run directory reduces to the same snapshot, twice", isDeepStrictEqual(again, S));
    const input = loadRun(base.runDir, { cliVersion: "fixture", pluginVersion: "fixture" });
    // A closed month: a difference in the incomplete period would be drift (F-475).
    const unit = input.units.find((u) => u.family === "account" && u.cls === "all" && u.rows.length && u.window.start < "2026-09-01");
    unit.rows[0].count_of_email_log_v2_Gsid.v += 3;
    unit.rows[0].count_of_email_log_v2_Gsid.k += 3;
    const off = reduceEngagement(input);
    const c = off.reconciliation.checks.find((x) => x.id === "accounts-sum-to-program");
    check("a seeded mismatch is reported: three sends added to one account row fail accounts-sum-to-program for that program and month, with the two sides shown",
      off.reconciliation.ok === false && c.mismatches >= 1 && c.examples.some((e) => e.measure === "sent" && e.left === e.right + 3), c);
    const input2 = loadRun(base.runDir, {});
    const tu = input2.units.find((u) => u.family === "template" && u.cls === "all" && u.rows.length);
    tu.rows.pop();
    check("a seeded mismatch is reported: a template row lost in transit fails templates-sum-to-program against the cheap tenant-wide call", reduceEngagement(input2).reconciliation.checks.find((x) => x.id === "templates-sum-to-program").mismatches === 1);
  }

  // ── Row caps and splitting ────────────────────────────────────────────────
  {
    const small = pull({ kb: true, raw: { pageSize: 20 } });
    check("a result as long as the page is treated as truncated and split, by program, then by day, then by flag: a 20-row page reduces to the same facts as a 400-row one",
      small.summary?.status === "ok" && small.summary.calls.split > 20 && isDeepStrictEqual(small.snapshot.facts, S.facts) && small.snapshot.reconciliation.ok, small.summary);
    check("the truncated answer is kept as evidence and never reduced: its record says truncated", readFileSync(join(small.runDir, "fetch-log.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).some((r) => r.truncated === true && r.rows === 20));
    const t = buildTenant({});
    const dflt = JSON.parse(answer(["--json", "rp", "run", "--object", "email_log_v2", "--show-fields", '[{"name":"Gsid"}]'], t).stdout).length;
    check("the hazard the rule exists for: with no --page-size the same query returns 50 rows of hundreds, silently", dflt === 50);
    check("splitUnit never cuts a distinct count inside a month, and a whole-window distinct count never by time",
      splitUnit({ family: "uniques-month", window: { start: "2026-06-01", end: "2026-07-01" } }) === null && splitUnit({ family: "uniques-window", window: { start: "2025-09-01", end: "2026-10-01" } }) === null &&
        isDeepStrictEqual(splitUnit({ family: "uniques-month", window: { start: "2026-06-01", end: "2026-08-01" } }).map((u) => u.window), [{ start: "2026-06-01", end: "2026-07-01" }, { start: "2026-07-01", end: "2026-08-01" }]));
  }

  // ── Timeouts, outages, warnings, not-found ────────────────────────────────
  {
    // May's template unit, by the lower bound of its window (April's ends on the same day).
    const MAY_FROM = '"operator":"GTE","rightOperand":{"value":"2026-05-01"}';
    const once = pull({ faults: [{ match: ["EmailTemplateName", MAY_FROM], kind: "timeout", times: 1 }] });
    check("timeouts are transient: a timed-out call is retried once on its own and the run completes with the same facts, unsplit",
      once.summary.status === "ok" && once.summary.calls.retried === base.summary.calls.retried + 1 && once.summary.calls.split === 0 && isDeepStrictEqual(once.snapshot.facts, pull({}).snapshot.facts));
    const twice = pull({ faults: [{ match: ["EmailTemplateName", MAY_FROM], kind: "timeout", times: 2 }] });
    check("a call that times out again after its retry is split (two half-month windows here), and the facts are unchanged",
      twice.summary.status === "ok" && twice.summary.calls.split === 1 && isDeepStrictEqual(twice.snapshot.facts, once.snapshot.facts) && twice.argv.some((a) => a.join(" ").includes('"value":"2026-05-16"')), twice.summary);
    const blip = pull({ faults: [{ match: '"name":"Source"},{"name":"AddressType"}', kind: "outage", times: 1 }] });
    check("a 'network outage' that does not reproduce was transient: one retry, run complete", blip.summary.status === "ok" && blip.summary.calls.retried === base.summary.calls.retried + 1);
    const shape = pull({ faults: [{ match: '"name":"Source"},{"name":"AddressType"}', kind: "outage", times: 99 }] });
    let refused = "";
    try { loadRun(shape.runDir); } catch (e) { refused = e.message; }
    check("a reproducible 'network outage' is a query-shape error: retried once, never again, recorded as shape-error, and the run is partial — no snapshot is built from it",
      shape.summary.status === "partial" && shape.summary.failed.length === 1 && shape.summary.failed[0].kind === "shape-error" && shape.argv.filter((a) => a.join(" ").includes('"name":"Source"},{"name":"AddressType"}')).length === 2 && /not complete/.test(refused), shape.summary);
    const generic = pull({ faults: [{ match: "click-attr-never", kind: "generic" }, { match: '"LinkClickedJson"', kind: "generic", times: 99 }] });
    check("a generic refusal is not retried: one call, the unit fails, the run is partial", generic.summary.status === "partial" && generic.summary.failed[0].kind === "other" && generic.argv.filter((a) => a.join(" ").includes('"LinkClickedJson"')).length === 1);
    const warn = pull({ faults: [{ match: '"name":"Source"},{"name":"AddressType"}', kind: "warn" }] });
    check("non-empty stderr is not a failure: a warning with exit 0 is recorded on the call and changes nothing", warn.summary.status === "ok" && isDeepStrictEqual(warn.snapshot.facts, once.snapshot.facts) && readFileSync(join(warn.runDir, "fetch-log.jsonl"), "utf8").includes("normalizeGroupByDedup"));
    const falseNf = pull({ faults: [{ match: ["describe", "p-unlisted"], kind: "not-found", times: 1 }] });
    check("a seeded false not-found is re-checked and cleared: the program is in the snapshot, not among the deleted", falseNf.snapshot.dimensions.programs.some((p) => p.id === "p-unlisted") && falseNf.snapshot.honesty.excluded.deletedPrograms.programs === 1 && falseNf.argv.filter((a) => a.includes("describe") && a.includes("p-unlisted")).length === 2);
    check("classifyFailure sorts stderr into auth-expired / timeout / not-found / outage / other",
      isDeepStrictEqual(["auth", "timeout", "not-found", "outage", "generic"].map((k) => classifyFailure({ stderr: FAULT_TEXT[k] })), ["auth-expired", "timeout", "not-found", "outage", "other"]) && classifyFailure({ stderr: "", timedOut: true }) === "timeout");
  }

  // ── The token ────────────────────────────────────────────────────────────
  {
    const dead = pull({ variant: { token: { state: "expired" } } });
    check("token pre-flight: an expired token stops the run at whoami, before any tenant call", dead.summary.status === "token-expired" && dead.argv.length === 1 && /gs-admin login/.test(dead.summary.stopped));
    const dir = join(ROOT, "resume-in-process");
    const first = pull({ runDir: dir, faults: [{ match: "rp run", kind: "auth", skip: 12, times: 9999 }] });
    check("an expired token stops cleanly: status token-expired, the calls already made kept, nothing reduced", first.summary.status === "token-expired" && first.snapshot === null && first.summary.calls.made > 12 && first.summary.failed.length === 0, first.summary);
    const second = pull({ runDir: dir });
    check("…and stays resumable: the second run re-reads whoami, skips every call already answered, makes only the rest, and reduces to the baseline's facts",
      second.summary.status === "ok" && second.summary.calls.reused >= 12 && second.summary.calls.made - 1 + second.summary.calls.reused === base.summary.calls.made - base.summary.calls.retried && second.argv[0][0] === "whoami" && isDeepStrictEqual(second.snapshot.facts, pull({}).snapshot.facts), second.summary);
    let clock = 0;
    const short = pull({ variant: { token: { state: "valid", seconds: 60 } }, now: () => (clock += 5000) });
    check("a run that would outlast the token stops before the call that would cross it, and says so", short.summary.status === "token-expired" && /would expire/.test(short.summary.stopped) && short.argv.length < 12 && short.argv.length > 2, [short.summary, short.argv.length]);
    check("parseWhoami decides on the lines, never the exit code: valid with its seconds, expired, none, and the host from Base URL",
      isDeepStrictEqual(parseWhoami("Base URL: https://acme.gainsightcloud.com\nToken: valid (expires in 3252s)"), { tokenState: "valid", expiresInSeconds: 3252, baseUrl: "https://acme.gainsightcloud.com", host: "acme.gainsightcloud.com" }) &&
        parseWhoami("Base URL: (not set)\nToken: none — run 'gs-admin login'").tokenState === "none" && parseWhoami("Base URL: (not set)\nToken: none").host === null && parseWhoami("Token: expired").tokenState === "expired" && parseWhoami("").tokenState === "unreadable");
  }

  // ── Schema validation ─────────────────────────────────────────────────────
  {
    const t = buildTenant({ dropSchemaField: { object: "email_log_v2", field: "AddressType" } });
    const all = JSON.parse(answer(["--json", "rp", "run", "--object", "email_log_v2", "--show-fields", '[{"name":"Gsid","aggregation":"COUNT"}]', "--where-filters", '{"conditions":[{"leftOperand":{"fieldName":"AddressType"},"operator":"EQ","rightOperand":{"value":"To"}}]}', "--page-size", "10"], t).stdout)[0].count_of_email_log_v2_Gsid.v;
    check("the hazard the rule exists for: a where-filter on a field the schema lacks is silently dropped and the query widens (CC copies come back)", all === t.tables.email_log_v2.length);
    const p = pull({ variant: { dropSchemaField: { object: "email_log_v2", field: "AddressType" } } });
    check("every filter field is validated against rp schema first: the run refuses, naming the field, before any rp run is made", /email_log_v2\.AddressType \(filter\) is not in the object's schema/.test(String(p.error?.message)) && rpRuns(p.argv).length === 0, String(p.error?.message));
    const noSurvey = pull({ variant: { noSurveyObject: true } });
    check("an object with no schema is read as unavailable, not as empty: responses are unknown for every program and no survey call is made",
      noSurvey.summary.status === "ok" && Object.values(noSurvey.snapshot.meta.metricAvailability.responses.programs).every((x) => x.state === "unknown" && x.evidence.surveyParticipants === null) && !rpRuns(noSurvey.argv).some((a) => flag(a, "--object") === "survey_participant") && noSurvey.snapshot.caveats.some((c) => c.id === "responses-unreadable"));
  }

  // ── Selectors ─────────────────────────────────────────────────────────────
  {
    check("a CRLF id list works: parseIdList strips the carriage returns and a BOM", isDeepStrictEqual(parseIdList(String.fromCharCode(0xfeff) + "p-onboard\r\np-nps\r\n\r\n"), ["p-onboard", "p-nps"]));
    const byIds = pull({ raw: { ids: parseIdList("p-onboard\r\np-nps\r\n") } });
    check("…and the ids select exactly those programs, with no carriage return reaching a filter; the rest are counted as unselected",
      isDeepStrictEqual(byIds.snapshot.dimensions.programs.map((p) => p.id), ["p-nps", "p-onboard"]) && !byIds.argv.some((a) => a.join(" ").includes("\\r")) && byIds.snapshot.honesty.excluded.unselectedPrograms.programs === 4 && byIds.snapshot.honesty.excluded.unselectedPrograms.sent > 0);
    const byName = pull({ raw: { names: ["acme old promo"] } });
    check("--name selects by program name, case-insensitively", isDeepStrictEqual(byName.snapshot.dimensions.programs.map((p) => p.id), ["p-promo"]));
    const since = pull({ raw: { sentSince: "40d" } });
    const cut = "2026-08-06";
    const want = [...new Set(since.tenant.tables.email_log_v2.filter((r) => r.Source === "Advanced Outreach" && r.AddressType === "To" && r.ExecutedDate.slice(0, 10) >= cut && r.SourceId !== "p-gone").map((r) => r.SourceId))].sort();
    check("--sent-since picks only programs with a send since then, resolved from one cheap tenant-wide call, and is separate from the reporting window: the picked programs keep all 13 months",
      isDeepStrictEqual(since.snapshot.dimensions.programs.map((p) => p.id), want) && want.length >= 3 && !want.includes("p-promo") && since.snapshot.facts.byTemplate.some((r) => r.month === "2025-09") && since.snapshot.meta.params.selector.sentSince.date === cut, [since.snapshot.dimensions.programs.map((p) => p.id), want]);
    let bad = "";
    try { resolveParams({ today: TODAY, sentSince: "soon" }); } catch (e) { bad = e.message; }
    check("--sent-since takes a date, Nd or Nm, and refuses anything else", parseSentSince("2026-07-04", TODAY) === "2026-07-04" && parseSentSince("90d", TODAY) === "2026-06-17" && parseSentSince("3m", TODAY) === "2026-06-15" && parseSentSince("1m", "2026-03-31") === "2026-02-28" && parseSentSince("2026-02-30", TODAY) === null && /--sent-since takes/.test(bad));
  }

  // ── Click detail (R18) and the tracking state (R19) ──────────────────────
  {
    check("LinkClickedJson is unwrapped from its `{type=json, value=[…], null=true}` string, and a bare JSON array is read too",
      isDeepStrictEqual(readLinkClicks('{type=json, value=[{"url":"https://www.example.com/a","clickedCount":2,"ip":"203.0.113.7"}], null=true}'), { content: 1, other: 0, byInput: 0, unreadable: false }) &&
        isDeepStrictEqual(readLinkClicks('[{"url":"mailto:cs@acme.com","clickedCount":1,"ip":"203.0.113.7"}]'), { content: 0, other: 1, byInput: 0, unreadable: false }) && readLinkClicks("{type=json, value=, null=true}").unreadable === true && readLinkClicks(null).unreadable === true);
    check("click rate counts content links only: unsubscribe and mailto links are not content, and a link that cannot be read counts as neither",
      classifyLink("https://www.example.com/guide") === "content" && classifyLink("https://mail.example.com/unsubscribe?t=1") === "unsubscribe" && classifyLink("MAILTO:cs@acme.com") === "mailto" && classifyLink("https://x.example.com/email-preferences") === "unsubscribe" && classifyLink("") === "unreadable" && classifyLink(undefined) === "unreadable");
    const files = readdirSync(join(base.runDir, "calls")).map((f) => readFileSync(join(base.runDir, "calls", f), "utf8")).join("\n");
    check("the clicker's ip is dropped at fetch time, and so are the URLs: no payload file on disk holds either", !files.includes("203.0.113.") && !files.includes("example.com/guide") && !files.includes("unsubscribe?") && base.tenant.tables.email_log_v2.some((r) => r.LinkClickedJson?.includes("203.0.113.")));
    check("clicked sends are counted honestly: content, non-content only, unreadable and detail-missing add up to the clicked sends pulled",
      S.honesty.clicks.clickedSends === S.honesty.clicks.withContentClick + S.honesty.clicks.nonContentOnly + S.honesty.clicks.unreadable + S.honesty.clicks.detailMissing && S.honesty.clicks.nonContentOnly > 0 && S.honesty.clicks.withContentClick === O.rows.filter((r) => r._contentClick).length, S.honesty.clicks);
    const raw = pull({ variant: { rawClickJson: true } });
    check("a tenant whose LinkClickedJson has no wrapper reduces to the same facts", isDeepStrictEqual(raw.snapshot.facts, pull({}).snapshot.facts));

    // The five R19 fixtures, on one pull: no click is recorded from December
    // 2025 on, and TPL-1's reading (supplied here by hand) covers three templates.
    const linkSettings = {
      "tpl-nps": { reading: "tracked-link-present", asOf: "2026-09-01" },
      "tpl-renew-b": { reading: "links-none-tracked", asOf: "2026-09-01" },
      "tpl-renew": { reading: "links-none-tracked", asOf: "2026-09-01" },
      "tpl-welcome": { reading: "links-none-tracked", asOf: "2026-09-01" },
      "tpl-unlisted": { reading: "unreadable", asOf: "2026-09-01" },
    };
    const five = pull({ linkSettings }).snapshot;
    const R = JSON.parse(JSON.stringify(five));
    const row = (t, f = (_row) => true) => R.facts.byTemplate.find((r) => r.templateId === t && f(r));
    check("R19 fixture 1: content-link clicks in the period → tracked, and the count is the count", clickAvailability(R, "tpl-welcome").state === "tracked" && readClicked(R, row("tpl-welcome", (r) => r.clicked > 0)).value > 0);
    const hist = pull({ variant: { noClicksFrom: "2025-12-01" }, linkSettings }).snapshot;
    const quiet = hist.facts.byTemplate.find((r) => r.templateId === "tpl-promo" && r.month === "2025-12" && r.recipientClass === "external");
    check("R19 fixture 2: clicks in the template's history but none in the period → tracked at 0: a real 0",
      clickAvailability(hist, "tpl-promo").state === "tracked" && clickAvailability(hist, "tpl-promo").evidence.clickHistory.lastMonth === "2025-11" && quiet.delivered > 0 && isDeepStrictEqual(readClicked(hist, quiet), { state: "tracked", value: 0 }));
    check("R19 fixture 3: never clicked, and the link-settings reading shows a tracked link → tracked at 0",
      isDeepStrictEqual(readClicked(R, row("tpl-nps")), { state: "tracked", value: 0 }) && isDeepStrictEqual(clickAvailability(R, "tpl-nps").evidence, { clickHistory: { everClicked: false, firstMonth: null, lastMonth: null }, linkSettings: { reading: "tracked-link-present", asOf: "2026-09-01" } }));
    check("R19 fixture 4: never clicked, and the reading shows links but none tracked → not-tracked, with no value at all", isDeepStrictEqual(readClicked(R, row("tpl-renew-b")), { state: "not-tracked", value: null }));
    check("R19 fixture 5: never clicked, and no reading → unknown, the value shown beside its marker", isDeepStrictEqual(readClicked(R, row("tpl-day7")), { state: "unknown", value: 0 }) && clickAvailability(R, "tpl-day7").evidence.linkSettings === null);
    check("detection never guesses: an unreadable reading is unknown, and a template the snapshot does not list is unknown", clickAvailability(R, "tpl-unlisted").state === "tracked" && decideClickState({ everClicked: false, reading: "unreadable" }) === "unknown" && decideClickState({ everClicked: false, reading: null }) === "unknown" && clickAvailability(R, "tpl-never-seen").state === "unknown" && readClicked(R, { templateId: null, clicked: 0 }).state === "unknown");
    check("unsubscribe-link clicks never count as evidence: a template whose only recorded clicks are on the unsubscribe link has no click history, and its sends count 0 clicked",
      base.tenant.tables.email_log_v2.some((r) => r.EmailTemplateId === "tpl-renew" && r.LinkClickedCount > 0) && clickAvailability(S, "tpl-renew").state === "unknown" && clickAvailability(S, "tpl-renew").evidence.clickHistory.everClicked === false && S.facts.byTemplate.filter((r) => r.templateId === "tpl-renew").every((r) => r.clicked === 0));
    check("click history decides before the link settings: a clicked template stays tracked whatever the reading says", clickAvailability(R, "tpl-welcome").state === "tracked" && clickAvailability(R, "tpl-welcome").evidence.linkSettings.reading === "links-none-tracked");
    // ENG-1's accessor floor.
    const states = new Set(Object.values(R.meta.metricAvailability.clicks.templates).map((t) => t.state));
    check("each of the three tracking states round-trips through JSON", isDeepStrictEqual([...states].sort(), ["not-tracked", "tracked", "unknown"]) && isDeepStrictEqual(R, five));
    check("a tracked 0 reads as 0", readClicked(R, row("tpl-nps")).value === 0 && row("tpl-nps").clicked === 0);
    check("a not-tracked metric cannot be read as 0 by any accessor: readClicked gives null for every row of a not-tracked template, readResponses gives null for every figure of a not-tracked program",
      R.facts.byTemplate.filter((r) => r.templateId === "tpl-renew-b" || r.templateId === "tpl-renew").every((r) => readClicked(R, r).value === null) &&
        isDeepStrictEqual(readResponses(R, "p-onboard"), { state: "not-tracked", basis: "all-time", submitted: null, partiallySubmitted: null, anyResponse: null, participants: null }) &&
        isDeepStrictEqual(readResponses(R, "p-onboard", R.dimensions.months), { state: "not-tracked", basis: "months", submitted: null, partiallySubmitted: null, anyResponse: null, participants: null }));
    // The per-program roll-up (V0 shape 1), one check per case. Each reduces
    // the baseline run again under a link-settings reading that makes the mix.
    const rolled = (settings, p) => programClickAvailability(reduceEngagement(loadRun(base.runDir, { linkSettings: settings })), p);
    const none = (t) => ({ [t]: { reading: "links-none-tracked", asOf: "2026-09-01" } });
    check("roll-up, tracked + unknown: a program with one tracked template and one unknown reads unknown, and the counts say 1 and 1",
      isDeepStrictEqual(rolled(null, "p-onboard"), { state: "unknown", templates: { tracked: 1, notTracked: 0, unknown: 1 } }), rolled(null, "p-onboard"));
    check("roll-up, tracked + not-tracked: a program with one tracked template and one not-tracked reads unknown, never tracked and never not-tracked",
      isDeepStrictEqual(rolled(none("tpl-day7"), "p-onboard"), { state: "unknown", templates: { tracked: 1, notTracked: 1, unknown: 0 } }), rolled(none("tpl-day7"), "p-onboard"));
    check("roll-up, all tracked: a program reads tracked only when every one of its templates is, so its 0% is a real 0%",
      isDeepStrictEqual(rolled({ "tpl-day7": { reading: "tracked-link-present", asOf: "2026-09-01" } }, "p-onboard"), { state: "tracked", templates: { tracked: 2, notTracked: 0, unknown: 0 } }) &&
        isDeepStrictEqual(rolled(null, "p-promo"), { state: "tracked", templates: { tracked: 1, notTracked: 0, unknown: 0 } }), rolled(null, "p-promo"));
    check("roll-up, all not-tracked: a program reads not-tracked only when every one of its templates is",
      isDeepStrictEqual(rolled({ ...none("tpl-renew"), ...none("tpl-renew-b") }, "p-renew"), { state: "not-tracked", templates: { tracked: 0, notTracked: 2, unknown: 0 } }), rolled({ ...none("tpl-renew"), ...none("tpl-renew-b") }, "p-renew"));
    check("roll-up, not-tracked + unknown reads unknown; so does a program whose sends name no template, and one the snapshot does not list",
      isDeepStrictEqual(rolled(none("tpl-renew-b"), "p-renew"), { state: "unknown", templates: { tracked: 0, notTracked: 1, unknown: 1 } }) &&
        isDeepStrictEqual(programClickAvailability(R, "p-pilot"), { state: "unknown", templates: { tracked: 0, notTracked: 0, unknown: 1 } }) && programClickAvailability(R, "p-nobody").state === "unknown");
    check("responses: a program with survey participants is tracked, one with none on a readable object is not-tracked", R.meta.metricAvailability.responses.programs["p-nps"].state === "tracked" && R.meta.metricAvailability.responses.programs["p-onboard"].state === "not-tracked" && R.meta.metricAvailability.responses.programs["p-onboard"].evidence.surveyParticipants === 0);
    for (const bad of [{ ...R, schemaVersion: 2 }, { ...R, schemaVersion: "1" }, { ...R, schemaVersion: undefined }, { ...R, kind: "accountTimeline" }, null, []]) {
      let msg = "";
      try { openSnapshot(bad); } catch (e) { msg = e.message; }
      check(`a snapshot with an unknown schemaVersion is refused loudly (${JSON.stringify(bad?.schemaVersion)} / kind ${JSON.stringify(bad?.kind)})`, /refusing to read it \(T-10\)/.test(msg), msg);
    }
    check("openSnapshot returns a current snapshot unchanged", openSnapshot(R) === R && T10_SCHEMA_VERSION === 1);
  }

  // ── F-470 · the tenant's own unsubscribe link ─────────────────────────────
  {
    const page = `${OWN_SITE_UNSUBSCRIBE}/topics?u=7`;
    const INPUT = [OWN_SITE_UNSUBSCRIBE];
    const LINKS = [parseUnsubscribeLink(OWN_SITE_UNSUBSCRIBE)];
    const variant = { ownSiteUnsub: true };
    const off = pull({ variant });
    const on = pull({ variant, raw: { unsubscribeLinks: INPUT } });
    const A = off.snapshot;
    const B = on.snapshot;
    const tpl = (s) => factMap(s.facts.byTemplate, (r) => [r.programId, r.templateId, r.month, r.recipientClass]);
    const clicked = (s, t) => s.facts.byTemplate.filter((r) => r.templateId === t).reduce((x, r) => x + r.clicked, 0);
    const named = on.tenant.tables.email_log_v2.filter((r) => r.SourceId === "p-prefs" && r.LinkClickedJson?.includes(`${OWN_SITE_UNSUBSCRIBE}/`));
    check("F-470 fixture: the unsubscribe link is a page on the company's own site that no generic pattern matches, and sends were clicked on it",
      NON_CONTENT_LINK_RULES.every((rule) => !rule.re.test(page)) && named.length > 3 && named.some((r) => r.EmailTemplateId === "tpl-prefs"));
    check("F-470: without the input the own-site unsubscribe link reads as content: its clicks are counted, and the template clicked on nothing else reads tracked",
      classifyLink(page) === "content" && clicked(A, "tpl-prefs") > 0 && clickAvailability(A, "tpl-prefs").state === "tracked" && !sameMap(tpl(A), oracle(off.tenant, A).byTemplate) && A.honesty.clicks.byUnsubscribeInput === 0);
    check("F-470: with the input it reads as not content: every clicked count equals a straight count of the sends with a real content click",
      classifyLink(page, LINKS) === "unsubscribe" && sameMap(tpl(B), oracle(on.tenant, B).byTemplate) && clicked(B, "tpl-prefs") === 0 && clicked(B, "tpl-prefs-mix") > 0, diffMap(tpl(B), oracle(on.tenant, B).byTemplate));
    check("F-470: a template whose only clicks are on the named link reads unknown, never tracked, with no click history",
      clickAvailability(B, "tpl-prefs").state === "unknown" && clickAvailability(B, "tpl-prefs").evidence.clickHistory.everClicked === false && clickAvailability(B, "tpl-prefs-mix").state === "tracked" &&
        isDeepStrictEqual(programClickAvailability(B, "p-prefs"), { state: "unknown", templates: { tracked: 1, notTracked: 0, unknown: 1 } }));
    check("F-470: the honesty stats say what the input did: the sends clicked on a named link are counted, and those clicked on nothing else join the non-content-only count",
      B.honesty.clicks.byUnsubscribeInput === named.length && B.honesty.clicks.nonContentOnly - A.honesty.clicks.nonContentOnly === A.honesty.clicks.withContentClick - B.honesty.clicks.withContentClick && B.honesty.clicks.nonContentOnly > A.honesty.clicks.nonContentOnly, [A.honesty.clicks, B.honesty.clicks, named.length]);
    check("F-470: the input is echoed in meta.params, normalized (host and path, no scheme), and is empty when none was given",
      isDeepStrictEqual(B.meta.params.unsubscribeLinks, ["www.acme.com/mail-settings"]) && isDeepStrictEqual(A.meta.params.unsubscribeLinks, []));
    const files = readdirSync(join(on.runDir, "calls")).map((f) => readFileSync(join(on.runDir, "calls", f), "utf8")).join("\n");
    check("F-470: the named link's clicks are classified at fetch time like every other: no payload file holds a clicked URL", !files.includes("mail-settings") && files.includes('"byInput":1'));
    // The sibling the report did not list: the same site's OTHER pages stay content.
    check("F-470 sibling: a path that only begins like the named page stays content (whole segments match, never a prefix of one), and the look-alike's clicks are counted",
      classifyLink(`${OWN_SITE_UNSUBSCRIBE}-guide`, LINKS) === "content" && classifyLink("https://www.acme.com/", LINKS) === "content" && classifyLink("https://www.acme.com/pricing", LINKS) === "content" &&
        on.tenant.tables.email_log_v2.some((r) => r._contentClick && r.LinkClickedJson?.includes("-guide") && !r.LinkClickedJson.includes("/topics")));
    check("F-470: a named link matches whatever the scheme, letter case, query, trailing slash or sub-path, and on a subdomain of the named host; another site's page with the same path stays content",
      ["https://www.acme.com/mail-settings", "http://WWW.ACME.COM/Mail-Settings/", "https://www.acme.com/mail-settings?x=1#top", "www.acme.com/mail-settings/topics/weekly", "https://eu.www.acme.com/mail-settings"].every((u) => classifyLink(u, LINKS) === "unsubscribe") &&
        classifyLink("https://www.example.com/mail-settings", LINKS) === "content" && classifyLink("https://acme.com/mail-settings", LINKS) === "content");
    check("F-470: a value with no path names a whole host and its subdomains (an external preferences vendor), and nothing that merely ends in the same letters",
      classifyLink("https://links.example.net/u/abc", ["links.example.net"]) === "unsubscribe" && classifyLink("https://eu.links.example.net/", ["links.example.net"]) === "unsubscribe" && classifyLink("https://badlinks.example.net/u", ["links.example.net"]) === "content");
    check("F-470: the generic patterns are unchanged and still decide first: an unsubscribe wording needs no input, and mailto stays mailto on a named host",
      NON_CONTENT_LINK_RULES.length === 2 && classifyLink("https://mail.example.com/unsubscribe?t=1", LINKS) === "unsubscribe" && classifyLink("mailto:cs@acme.com", ["acme.com"]) === "mailto" && classifyLink("https://www.example.com/preferences-center") === "content");
    check("F-470: a mailto link to a named host is never counted as a link the input named", readLinkClicks('[{"url":"mailto:cs@acme.com","clickedCount":1}]', ["acme.com"]).byInput === 0 && readLinkClicks('[{"url":"https://www.acme.com/x","clickedCount":1}]', ["acme.com"]).byInput === 1);
    {
      // A run directory written before the input existed: its parameters have no list at all.
      const old = loadRun(pull({ previous: JSON.parse(JSON.stringify(pull({ variant: { cutoff: "2026-08-16" }, raw: { today: "2026-08-15", pulledAt: "2026-08-15T09:00:00-07:00" } }).snapshot)) }).runDir, {});
      const prevAgain = JSON.parse(JSON.stringify(pull({ variant: { cutoff: "2026-08-16" }, raw: { today: "2026-08-15", pulledAt: "2026-08-15T09:00:00-07:00" } }).snapshot));
      delete old.params.unsubscribeLinks;
      delete prevAgain.meta.params.unsubscribeLinks;
      check("F-470: parameters with no unsubscribe list at all read as none, not as a change: a selective pull still reduces as selective", reduceEngagement({ ...old, previous: prevAgain }).meta.refresh.mode === "selective");
    }
    const two = resolveParams({ today: TODAY, unsubscribeLinks: ["www.acme.com/mail-settings?x=1", "links.example.net", "https://WWW.acme.com/mail-settings/"] }).unsubscribeLinks;
    check("F-470: the input repeats; values are normalized, de-duplicated and sorted, so the same links in any spelling are the same run", isDeepStrictEqual(two, ["links.example.net", "www.acme.com/mail-settings"]));
    for (const bad of ["mail-settings", "mailto:cs@acme.com", "ftp://files.acme.com/x", "https://user@www.acme.com/x", " "]) {
      let msg = "";
      try { resolveParams({ today: TODAY, unsubscribeLinks: [bad] }); } catch (e) { msg = e.message; }
      check(`F-470: resolveParams refuses an --unsubscribe-link that names no web host (${JSON.stringify(bad)})`, /--unsubscribe-link takes a link or a host/.test(msg), msg);
    }
    // A change to the input forces a full refresh, and click evidence classified under the old input is not carried.
    const prevOwn = JSON.parse(JSON.stringify(pull({ variant: { ...variant, cutoff: "2026-08-16" }, raw: { today: "2026-08-15", pulledAt: "2026-08-15T09:00:00-07:00" } }).snapshot));
    const same = pull({ variant, previous: prevOwn }).snapshot;
    const changed = pull({ variant, raw: { unsubscribeLinks: INPUT }, previous: prevOwn }).snapshot;
    check("F-470: a change to the unsubscribe links forces a full refresh, and says so (carried months were classified under the old input)",
      same.meta.refresh.mode === "selective" && changed.meta.refresh.mode === "full" && /unsubscribe links changed/.test(changed.meta.refresh.why) && changed.facts.byTemplate.every((r) => r.provenance === "pulled") && isDeepStrictEqual(changed.facts, B.facts), changed.meta.refresh);
    check("F-470: click evidence classified under the old input is not carried: the template the previous snapshot called tracked on unsubscribe clicks reads unknown after the change, and tracked while the input is unchanged",
      clickAvailability(prevOwn, "tpl-prefs").state === "tracked" && clickAvailability(same, "tpl-prefs").state === "tracked" && clickAvailability(changed, "tpl-prefs").state === "unknown" && isDeepStrictEqual(changed.meta.metricAvailability, B.meta.metricAvailability));
    const back = pull({ variant, previous: JSON.parse(JSON.stringify(B)), phase: "plan" }).summary.estimate;
    check("F-470: dropping the input is a change too: a snapshot pulled with it is not carried into a run without it", back.mode === "full" && /unsubscribe links changed/.test(back.why), back);
  }

  // ── F-471 · nothing is shown that is also grouped by ──────────────────────
  {
    // The CLI's key, spelled here on its own (R-10): object and field name, a
    // lookup path by the object its last hop lands on and its leaf.
    const keyOf = (object, e) => (e.fieldPath ? `${e.fieldPath.hops.at(-1).to}::${e.fieldPath.leaf}` : `${object}::${e.name}`);
    const own = pull({ variant: { ownSiteUnsub: true }, raw: { unsubscribeLinks: [OWN_SITE_UNSUBSCRIBE] } });
    const all = [...every, ...rpRuns(own.argv)];
    const colliding = all.filter((a) => { const q = parsed(a); const g = new Set(q.group.map((e) => keyOf(q.object, e))); return q.show.some((e) => g.has(keyOf(q.object, e))); });
    const families = new Set([base, stepPull].flatMap((p) => readFileSync(join(p.runDir, "fetch-log.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))).map((r) => r.family));
    check("F-471: no call of any family, default or step detail, shows a field it also groups by (keyed as the CLI keys: object and field name, aggregation ignored)",
      all.length > 60 && colliding.length === 0 && ["click-attr", "click-json", "step-click", "account", "template", "step", "uniques-month", "resp-total", "participants-month"].every((x) => families.has(x)), colliding.slice(0, 2));
    const t = buildTenant({});
    const old = answer(["--json", "rp", "run", "--object", "email_log_v2", "--show-fields", '[{"name":"Gsid","aggregation":"COUNT"}]', "--group-by", '[{"name":"SourceId"},{"name":"Gsid"}]', "--page-size", "10"], t);
    const two = answer(["--json", "rp", "run", "--object", "email_log_v2", "--show-fields", '[{"name":"Gsid","aggregation":"COUNT"},{"name":"LinkClickedCount","aggregation":"COUNT"}]', "--group-by", '[{"name":"SourceId"},{"name":"Gsid"}]', "--page-size", "10"], t);
    check("the hazard the rule exists for: COUNT of Gsid beside a group on Gsid is dropped before the request is sent, and with no show field left the call is refused; with another left it is dropped with only a warning",
      old.status === 1 && old.stdout === "" && /normalizeGroupByDedup: removed 1 showField/.test(old.stderr) && /Report must have at least one entry in showFields/.test(old.stderr) && classifyFailure(old) === "other" &&
        two.status === 0 && /normalizeGroupByDedup: removed 1/.test(two.stderr) && Object.keys(JSON.parse(two.stdout)[0]).every((k) => k !== "count_of_email_log_v2_Gsid"), [old, two.stderr]);
    const types = (object) => new Map(t.schemas[object].map((x) => [x.fieldName, x.dataType]));
    const lookupPath = { fieldPath: { leaf: "Gsid", hops: [{ through: "EmailLogId", to: "email_log_v2" }] } };
    check("validateQuery refuses a query that shows what it groups by, plain or aggregated or through a lookup path, before it is run, and admits a count beside a path that lands on another object",
      validateQuery({ object: "email_log_v2", show: [{ name: "Gsid", aggregation: "COUNT" }], group: [{ name: "Gsid" }], where: [] }, types("email_log_v2")).some((p) => /shown and grouped by/.test(p)) &&
        validateQuery({ object: "email_log_v2", show: [{ name: "SourceId" }], group: [{ name: "SourceId" }], where: [] }, types("email_log_v2")).length === 1 &&
        validateQuery({ object: "email_log_v2", show: [{ ...lookupPath, aggregation: "COUNT_DISTINCT" }], group: [{ name: "Gsid" }], where: [] }, types("email_log_v2")).some((p) => /email_log_v2\.Gsid is shown and grouped by/.test(p)) &&
        validateQuery({ object: "ao_emails", show: [{ name: "Gsid", aggregation: "COUNT" }], group: [lookupPath], where: [] }, types("ao_emails")).length === 0);
    const warned = [base, stepPull].flatMap((p) => readFileSync(join(p.runDir, "fetch-log.jsonl"), "utf8").split("\n").filter((l) => l.includes("normalizeGroupByDedup")));
    check("F-471: no call draws the CLI's dropped-show-field warning: every show field the adapter asks for reaches the server", warned.length === 0, warned.slice(0, 1));
    check("F-471: the clicked-sends attribution completes and still counts by the send's id: one row per clicked send, counted on a field the query does not group by",
      rpRuns(base.argv).some((a) => flag(a, "--group-by")?.includes('{"name":"Gsid"}') && flag(a, "--show-fields") === '[{"name":"LinkClickedCount","aggregation":"COUNT"}]') && S.honesty.clicks.clickedSends > 0 && S.honesty.clicks.detailMissing === 0);
  }

  // ── F-472 · a program-day larger than the page ────────────────────────────
  {
    const big = pull({ variant: { massDay: true }, raw: { pageSize: 20 } });
    const B = big.snapshot;
    const day = big.tenant.tables.email_log_v2.filter((r) => r.SourceId === "p-blast");
    const partition = day.filter((r) => r.IsOpened === "YES" && r.IsSent === "YES");
    check("F-472 fixture: one program sends to sixty accounts on ONE day, and a single opened-and-sent partition of that day holds more accounts than the page",
      new Set(day.map((r) => r.ExecutedDate.slice(0, 10))).size === 1 && new Set(day.map((r) => r.GsCompanyId)).size === 60 && new Set(partition.map((r) => r.GsCompanyId)).size > 20);
    const OB = B ? oracle(big.tenant, B) : null;
    check("F-472: a program-day whose accounts exceed the page in one flag partition completes, and every total equals a straight count: template rows, and the account table per program × month × class",
      big.summary?.status === "ok" && !!B && B.reconciliation.ok && sameMap(factMap(B.facts.byTemplate, (r) => [r.programId, r.templateId, r.month, r.recipientClass]), OB.byTemplate) &&
        sameMap(factMap(B.facts.byAccount, (r) => [r.programId, r.month, r.recipientClass]), factMap(B.facts.byTemplate, (r) => [r.programId, r.month, r.recipientClass])) &&
        B.facts.byAccount.filter((r) => r.programId === "p-blast").reduce((x, r) => x + r.sent, 0) === 60, big.summary?.failed ?? String(big.error));
    const cuts = rpRuns(big.argv).flatMap((a) => parsed(a).where.filter((c) => c.leftOperand.fieldName === "LowerCaseEmailId" && ["CONTAINS", "DOES_NOT_CONTAINS"].includes(c.operator) && !String(c.rightOperand.value).startsWith("@")));
    check("F-472: the unit is cut by the recipient's address, below one program, one day and one flag partition, and only a single character ever reaches a filter",
      cuts.length > 1 && cuts.every((c) => String(c.rightOperand.value).length === 1) && cuts.some((c) => c.operator === "CONTAINS") && cuts.some((c) => c.operator === "DOES_NOT_CONTAINS"), cuts.slice(0, 3));
    const unit = { family: "account", cls: "all", programs: ["p-1"], window: { start: "2026-07-14", end: "2026-07-15" }, partition: [{ field: "IsOpened", op: "EQ", value: "YES" }, { field: "IsSent", op: "EQ", value: "YES" }] };
    const halves = splitUnit(unit);
    const again = splitUnit(halves[0]);
    check("splitUnit, the address rung: after program, day and flags, a unit is cut into the sends whose address contains a character and those whose address does not (each other's complement), then on the next character",
      isDeepStrictEqual(halves.map((h) => h.partition.at(-1)), [{ field: "LowerCaseEmailId", op: "CONTAINS", value: "a" }, { field: "LowerCaseEmailId", op: "DOES_NOT_CONTAINS", value: "a" }]) &&
        isDeepStrictEqual(again.map((h) => h.partition.at(-1)), [{ field: "LowerCaseEmailId", op: "CONTAINS", value: "e" }, { field: "LowerCaseEmailId", op: "DOES_NOT_CONTAINS", value: "e" }]) && halves.every((h) => h.partition.length === 3));
    const oneDay = { cls: "all", programs: ["p-1"], window: { start: "2026-07-14", end: "2026-07-15" } };
    check("F-472 siblings: the click families and the step families have the same last rung, on their own log's address field; a distinct count is still never cut by it",
      ["click-attr", "click-json"].every((family) => splitUnit({ family, ...oneDay })?.[0].partition[0].field === "LowerCaseEmailId") && splitUnit({ family: "step-click", ...oneDay })?.[0].partition[0].field === "ToAddress" &&
        splitUnit({ family: "step", ...oneDay, partition: [{ field: "EmailOpened", op: "EQ", value: true }, { field: "EmailSend", op: "EQ", value: true }] })?.[1].partition.at(-1).op === "DOES_NOT_CONTAINS" &&
        splitUnit({ family: "uniques-month", ...oneDay }) === null && splitUnit({ family: "participants-window", ...oneDay }) === null);
    let last = { family: "click-json", ...oneDay };
    let depth = 0;
    for (let next = splitUnit(last); next; next = splitUnit(last)) { last = next[0]; depth++; }
    check("the ladder still ends: when the characters run out there is nothing left to split on, and the unit fails loudly instead of looping", depth > 30 && depth < 60 && splitUnit(last) === null);
    const tiny = pull({ variant: { massDay: true }, raw: { pageSize: 2 }, phase: "all" });
    check("a unit no cut can bring under the page is still a failed unit and a partial run: no snapshot is built from a truncated answer",
      tiny.summary?.status === "partial" && tiny.snapshot === null && tiny.summary.failed.some((x) => x.kind === "truncated" && /nothing left to split on/.test(x.stderr)), tiny.summary?.status ?? String(tiny.error));
  }

  // ── F-473 · a lookup never decides whether a send is counted ──────────────
  {
    const t = base.tenant;
    const run = (group, show, where = []) => JSON.parse(answer(["--json", "rp", "run", "--object", "email_log_v2", "--show-fields", JSON.stringify(show), ...(group.length ? ["--group-by", JSON.stringify(group)] : []), "--where-filters", JSON.stringify({ conditions: where }), "--page-size", "5000"], t).stdout);
    const company = { fieldPath: { leaf: "Gsid", hops: [{ through: "GsCompanyId", to: "company" }] } };
    const count = [{ name: "Gsid", aggregation: "COUNT" }];
    const total = (rows) => rows.reduce((x, r) => x + r.count_of_email_log_v2_Gsid.v, 0);
    const nolink = t.tables.email_log_v2.filter((r) => r.GsCompanyId == null).length;
    check("the hazard the rule exists for: a call that groups or aggregates through a lookup path drops every row whose lookup is null — no null group, and not in the count — while a plain group on a field keeps them",
      nolink > 0 && total(run([company], count)) === t.tables.email_log_v2.length - nolink && run([company], count).every((r) => "v" in r.company_GsCompanyId__gr_Gsid) &&
        total(run([{ name: "SourceId" }], [...count, { ...company, aggregation: "COUNT_DISTINCT" }])) === t.tables.email_log_v2.length - nolink && total(run([{ name: "SourceId" }], count)) === t.tables.email_log_v2.length &&
        total(run([{ name: "SourceId" }], count, [{ leftOperand: { fieldName: "GsCompanyId" }, operator: "IS_NULL", rightOperand: {} }])) === nolink);
    const lookups = (a) => { const q = parsed(a); return [...q.group, ...q.show.filter((e) => e.aggregation)].filter((e) => e.fieldPath).map((e) => e.fieldPath.hops[0].through); };
    const twoOrCounted = every.filter((a) => flag(a, "--object") === "email_log_v2" && (new Set(lookups(a)).size > 1 || (lookups(a).length && parsed(a).show.some((e) => e.aggregation === "COUNT" && e.name === "Gsid") && !parsed(a).group.some((e) => e.fieldPath))));
    check("F-473: no call asks for a count of sends, or for two distinct counts, through a lookup: the program totals come from a call that names none, and people and accounts are each asked on their own",
      twoOrCounted.length === 0 && every.some((a) => { const q = parsed(a); return q.object === "email_log_v2" && !lookups(a).length && q.group.length === 2 && q.group[0].name === "SourceId" && q.group[1].summarize === "Month" && q.show.length === 1; }) &&
        every.some((a) => lookups(a).join() === "GsPersonId") && every.some((a) => lookups(a).join() === "GsCompanyId" && !parsed(a).group.some((e) => e.fieldPath)), twoOrCounted.slice(0, 1));
    const pilot = O.rows.filter((r) => r.SourceId === "p-pilot");
    check("F-473: a program whose EVERY send lacks a company link is still selected, its sends are in the template table and in its no-company-link rows, and it reaches 0 accounts",
      pilot.length > 0 && pilot.every((r) => r.GsCompanyId == null) && ids.includes("p-pilot") && S.facts.byTemplate.filter((r) => r.programId === "p-pilot").reduce((x, r) => x + r.sent, 0) === pilot.length &&
        S.facts.byAccount.filter((r) => r.programId === "p-pilot").every((r) => r.bucket === "no-company-link") && S.facts.byAccount.filter((r) => r.programId === "p-pilot").reduce((x, r) => x + r.sent, 0) === pilot.length &&
        S.facts.uniques.find((r) => r.programId === "p-pilot" && r.scope === "window").accounts === 0 && S.facts.uniques.find((r) => r.programId === "p-pilot" && r.scope === "window").people === 3);
    const all = O.rows.filter((r) => r.GsCompanyId == null).length;
    check("F-473: every send with no company link is counted once, in its program's no-company-link rows, and the honesty count says how many",
      S.honesty.noCompanyLink.sent === all && S.facts.byAccount.filter((r) => r.bucket === "no-company-link").reduce((x, r) => x + r.sent, 0) === all && all > 30);
    const variant = { orphanClicks: true };
    const oc = pull({ variant });
    const OC = oracle(oc.tenant, oc.snapshot);
    const orphanClicked = OC.rows.filter((r) => r.GsCompanyId == null && r._contentClick).length;
    check("F-473: a clicked send with no company link is attributed like any other: clicked counts equal a straight count, in the template table and in the no-company-link rows",
      orphanClicked > 0 && sameMap(factMap(oc.snapshot.facts.byTemplate, (r) => [r.programId, r.templateId, r.month, r.recipientClass]), OC.byTemplate) &&
        oc.snapshot.facts.byAccount.filter((r) => r.bucket === "no-company-link").reduce((x, r) => x + r.clicked, 0) === orphanClicked && oc.snapshot.honesty.clicks.clickedSends === OC.rows.filter((r) => r.LinkClickedCount > 0).length && oc.snapshot.reconciliation.ok,
      [orphanClicked, oc.snapshot.honesty.clicks]);
    check("F-473: survey rows that no program owns are counted by their own call (the calls through the participant lookup never return them)",
      S.honesty.responses.unattributed === base.tenant.tables.survey_participant.filter((r) => r.AOParticipantId == null).length && S.honesty.responses.unattributed > 0 && rpRuns(base.argv).some((a) => flag(a, "--object") === "survey_participant" && flag(a, "--where-filters").includes('"IS_NULL"')));
  }

  // ── Delivered (ruling 2026-10-03) ─────────────────────────────────────────
  {
    const after = O.rows.filter((r) => r.IsSent === "YES" && r.IsBounced === "YES").length;
    const sum = (k) => S.facts.byTemplate.reduce((x, r) => x + r[k], 0);
    check("Delivered is the attempts that went out and did not bounce: an attempt that went out and bounced afterwards is bounced, not delivered, and Sent still counts every attempt",
      after > 0 && sum("delivered") === O.rows.filter((r) => r.IsSent === "YES").length - after && sum("bounced") === O.rows.filter((r) => r.IsBounced === "YES").length && sum("sent") === O.rows.length && S.facts.byTemplate.every((r) => r.delivered + r.bounced <= r.sent));
    const stepSum = (k) => SS.facts.byStep.reduce((x, r) => x + r[k], 0);
    check("…and the step table agrees: its delivered is EmailSend true and Bounce not true, equal to the template table's", stepSum("delivered") === SS.facts.byTemplate.reduce((x, r) => x + r.delivered, 0) && stepSum("delivered") < stepSum("sent") - stepSum("bounced") + after + 1);
  }

  // ── F-475 · the incomplete period drifts; closed months fail ──────────────
  {
    const seed = (month) => {
      const input = loadRun(base.runDir, { cliVersion: "fixture", pluginVersion: "fixture" });
      const unit = input.units.find((u) => u.family === "template" && u.cls === "all" && u.rows.some((r) => r.summarize_month_of_email_log_v2_ExecutedDate.k.startsWith(month)));
      const row = unit.rows.find((r) => r.summarize_month_of_email_log_v2_ExecutedDate.k.startsWith(month));
      row.count_of_email_log_v2_Gsid.v += 2;
      row.count_of_email_log_v2_Gsid.k += 2;
      return reduceEngagement(input);
    };
    const now = seed("2026-09");
    const closed = seed("2026-08");
    const c = (snap, id) => snap.reconciliation.checks.find((x) => x.id === id);
    check("F-475: a difference in the incomplete period is drift, reported with its size, and does not fail the pull: two sends that arrived between two calls leave reconciled true",
      S.meta.incompleteFrom === "2026-09-01" && now.reconciliation.ok === true && c(now, "templates-sum-to-program").ok === true && c(now, "templates-sum-to-program").drift === 1 && c(now, "templates-sum-to-program").mismatches === 0 &&
        c(now, "templates-sum-to-program").driftExamples[0].left === c(now, "templates-sum-to-program").driftExamples[0].right + 2 && c(now, "accounts-sum-to-program").drift >= 1 &&
        isDeepStrictEqual(now.caveats.find((x) => x.id === "incomplete-period-drift")?.detail.from, "2026-09-01") && !now.caveats.some((x) => x.id === "reconciliation-mismatch"), now.reconciliation.checks);
    check("F-475: the same difference in a closed month is still a failure: reconciled false, the mismatch counted and shown, and no drift",
      closed.reconciliation.ok === false && c(closed, "templates-sum-to-program").mismatches === 1 && c(closed, "templates-sum-to-program").drift === 0 && closed.caveats.some((x) => x.id === "reconciliation-mismatch") && !closed.caveats.some((x) => x.id === "incomplete-period-drift"));
    check("F-475: a clean pull has no drift and no drift caveat, and every check carries the count", S.reconciliation.checks.every((x) => x.drift === 0 && x.driftExamples.length === 0) && !S.caveats.some((x) => x.id === "incomplete-period-drift"));
    const moved = pull({ raw: { incompleteFrom: "2026-08-10" } });
    const input = loadRun(moved.runDir, {});
    const tu = input.units.find((u) => u.family === "template" && u.cls === "all" && u.rows.some((r) => r.summarize_month_of_email_log_v2_ExecutedDate.k.startsWith("2026-08")));
    tu.rows.find((r) => r.summarize_month_of_email_log_v2_ExecutedDate.k.startsWith("2026-08")).count_of_email_log_v2_Gsid.v += 1;
    check("F-475: the boundary is meta.incompleteFrom's month, wherever it is set", reduceEngagement(input).reconciliation.ok === true && reduceEngagement(input).reconciliation.checks.find((x) => x.id === "templates-sum-to-program").drift === 1);
  }

  // ── F-476 · the estimate prices the splits ────────────────────────────────
  {
    const variant = { massDay: true };
    const raw = { pageSize: 50 };
    const full = pull({ variant, raw });
    const flat = pull({ raw });
    const within = (est, actual) => est <= actual * 2 && actual <= est * 2;
    check("F-476 fixture: at this page only the mass-send program-day splits; the same pull without it makes exactly the calls it plans",
      flat.summary.calls.split === 0 && flat.summary.estimate.thisRun.calls === flat.summary.estimate.thisRun.units && full.summary.calls.split > 3, [flat.summary.calls, full.summary.calls]);
    const planned = full.summary.estimate.thisRun;
    const afterPlan = full.summary.calls.made - (flat.summary.calls.made - flat.summary.estimate.thisRun.calls) ;
    check("F-476: plan prices the splits it will meet: on a tenant with a mass-send day the estimated calls are within 2x of the calls the facts actually took, and above the count of unsplit units",
      planned.calls > planned.units && within(planned.calls, afterPlan) && planned.byFamily.account > flat.summary.estimate.thisRun.byFamily.account + 3 && planned.seconds > flat.summary.estimate.thisRun.seconds, [planned, afterPlan, full.summary.calls]);
    const prev = JSON.parse(JSON.stringify(pull({ variant: { cutoff: "2026-08-16" }, raw: { ...raw, today: "2026-08-15", pulledAt: "2026-08-15T09:00:00-07:00" } }).snapshot));
    const sel = pull({ variant: { massDay: true, massMonth: "2026-09" }, raw, previous: prev });
    const selPlanned = sel.summary.estimate.thisRun;
    const selActual = sel.summary.calls.made - (flat.summary.calls.made - flat.summary.estimate.thisRun.calls);
    check("F-476: the selective refresh, the pull users run most, is priced the same way: its estimate is within 2x of what it took when the re-pull months hold the mass-send day",
      sel.snapshot.meta.refresh.mode === "selective" && sel.summary.calls.split > 3 && selPlanned.calls > selPlanned.units && within(selPlanned.calls, selActual), [selPlanned, selActual, sel.summary.calls]);
    const b = new Map([[JSON.stringify(["p", "2026-07"]), { sent: 9000, accounts: 6000 }], [JSON.stringify(["q", "2026-07"]), { sent: 40, accounts: 30 }], [JSON.stringify(["r", "2026-07"]), { sent: 9000, accounts: null }]]);
    const u = (programs) => ({ family: "account", cls: "all", window: { start: "2026-07-01", end: "2026-08-01" }, programs });
    check("expectedCalls: one call for a unit that fits; for a program-month over the page, the call that comes back full, two per rung down to one day and the two flags (seven rungs for a 31-day month), and two per half-page leaf; rows are 1.5 per account and never more than the sends; other families and classes are one call",
      expectedCalls(u(["q"]), b, 5000) === 1 && expectedCalls(u(["p"]), b, 5000) === 1 + 2 * 7 + 2 * Math.ceil(9000 / 2500) && expectedCalls(u(["p", "q"]), b, 5000) === 1 + 14 + 2 * 4 + 1 && expectedCalls(u(["r"]), b, 5000) === 1 + 14 + 2 * 4 &&
        expectedCalls(u(["nobody"]), b, 5000) === 1 && expectedCalls({ ...u(["p"]), cls: "internal" }, b, 5000) === 1 && expectedCalls({ family: "template", cls: "all", window: u([]).window }, b, 5000) === 1);
  }

  // ── Privacy (house rule 9) ────────────────────────────────────────────────
  {
    const text = JSON.stringify(SS);
    const leaks = ["@", "pe-0", "pe-int", "pe-orphan", "log-0", "jo-0", "par-p", "sp-0", "203.0.113", "https://", "mailto:"].filter((needle) => text.includes(needle));
    check("account is the finest detail: the snapshot holds no address, no person, participant or send id, no ip and no URL", leaks.length === 0 && text.includes("co-01"), leaks);
    check("no call asks for an address or a person as a column: they appear only inside filters and distinct counts",
      every.every((a) => { const q = parsed(a); return [...q.group, ...q.show.filter((s) => !s.aggregation)].every((e) => !["LowerCaseEmailId", "EmailId", "ToAddress", "GsPersonId"].includes(e.name) && e.fieldPath?.hops[0].to !== "person"); }));
  }

  // ── The read-only gate ────────────────────────────────────────────────────
  {
    const mutating = structuredClone(CATALOG);
    mutating.commands.find((c) => c.path === "report run").mutating = true;
    const p = pull({ gate: makeGate({ catalog: mutating, hooksDir: join(PLUGIN, "hooks") }) });
    check("the engine refuses any catalogued-mutating command before it is spawned: with `report run` flagged mutating, no rp run is ever made", /is MUTATING/.test(String(p.error?.message)) && rpRuns(p.argv).length === 0 && p.argv.length > 0, String(p.error?.message));
    check("the gate admits exactly the adapter's five reads and refuses the rest: a real mutating command, a read it never issues, and an unknown one",
      [...ENGAGEMENT_READ_PATHS].length === 5 && GATE(["whoami"]) === null && GATE(["--json", "rp", "run", "--object", "x"]) === null && GATE(["--json", "jo", "p", "describe", "--id", "x"]) === null &&
        /MUTATING/.test(GATE(["--json", "rp", "create", "--object", "x"])) && /not one of the engagement adapter's reads/.test(GATE(["--json", "rp", "list"])) && /not in the catalog/.test(GATE(["--json", "rp", "frobnicate"])));
    check("the adapter interface names plan, fetch and reduce, and only jo-engagement ships", joEngagementAdapter.id === "jo-engagement" && ["plan", "fetch", "reduce"].every((k) => typeof joEngagementAdapter[k] === "function"));
  }

  // ── Selective refresh ─────────────────────────────────────────────────────
  {
    const prevPull = pull({ variant: { cutoff: "2026-08-16" }, raw: { today: "2026-08-15", pulledAt: "2026-08-15T09:00:00-07:00" } });
    const prev = JSON.parse(JSON.stringify(prevPull.snapshot));
    const full = pull({});
    const sel = pull({ previous: prev });
    const F = full.snapshot;
    const L = sel.snapshot;
    check("selective refresh: with a previous snapshot the re-pull horizon is the current month and the one before, and older months are carried",
      L.meta.refresh.mode === "selective" && isDeepStrictEqual(L.meta.refresh.pulledMonths, ["2026-08", "2026-09"]) && isDeepStrictEqual(L.meta.refresh.carriedMonths, monthsBetween("2025-09", "2026-07")) && L.meta.refresh.previousPulledAt === "2026-08-15T09:00:00-07:00" && F.meta.refresh.mode === "full", L.meta.refresh);
    const totals = (s, table) => factMap(s.facts[table], (r) => [r.programId, r.month, r.recipientClass]);
    check("selective == full: the same totals as a full refresh over the same data, per program × month × class, in the template and the account table",
      sameMap(totals(L, "byTemplate"), totals(F, "byTemplate")) && sameMap(totals(L, "byAccount"), totals(F, "byAccount")) && sameMap(factMap(L.facts.byTemplate, (r) => [r.programId, r.templateId, r.month, r.recipientClass]), factMap(F.facts.byTemplate, (r) => [r.programId, r.templateId, r.month, r.recipientClass])), diffMap(totals(L, "byTemplate"), totals(F, "byTemplate")));
    const strip = (rows) => rows.map(({ provenance, pulledAt, ...r }) => r);
    check("selective == full: uniques, responses and the response denominator are identical too", isDeepStrictEqual(strip(L.facts.uniques), strip(F.facts.uniques)) && isDeepStrictEqual(strip(L.facts.responses), strip(F.facts.responses)) && isDeepStrictEqual(L.facts.responseParticipants, F.facts.responseParticipants));
    check("row provenance: carried rows say so and keep the date they were pulled; pulled rows carry this pull's",
      L.facts.byTemplate.every((r) => (r.month < "2026-08" ? r.provenance === "carried" && r.pulledAt === "2026-08-15T09:00:00-07:00" : r.provenance === "pulled" && r.pulledAt === PULLED_AT)) && L.facts.byTemplate.some((r) => r.provenance === "carried") && F.facts.byTemplate.every((r) => r.provenance === "pulled") &&
        L.facts.uniques.filter((r) => r.scope === "window").every((r) => r.provenance === "pulled") && L.facts.byAccount.some((r) => r.provenance === "carried"));
    const perProgram = new Set(rpRuns(sel.argv).flatMap((a) => parsed(a).where.filter((c) => c.operator === "IN" && c.leftOperand.fieldName === "SourceId").flatMap((c) => c.rightOperand.value)));
    const horizon = [...new Set(sel.tenant.tables.email_log_v2.filter((r) => r.ExecutedDate >= "2026-08-01" && r.Source === "Advanced Outreach" && r.AddressType === "To" && r.SourceId !== "p-gone").map((r) => r.SourceId))].sort();
    check("selective refresh pulls per-program calls only for the programs with sends in the horizon; the rest are carried untouched", isDeepStrictEqual([...perProgram].sort(), horizon) && !perProgram.has("p-promo") && !perProgram.has("p-nps") && L.dimensions.programs.some((p) => p.id === "p-promo"), [[...perProgram], horizon]);
    check("a selective refresh makes fewer calls than a full one — two months of template and account calls instead of thirteen — and plan prints both estimates",
      sel.summary.calls.made < full.summary.calls.made && sel.summary.estimate.mode === "selective" && sel.summary.estimate.thisRun.calls < sel.summary.estimate.full.calls && sel.summary.estimate.thisRun.byFamily.template === 2 + 1 && sel.summary.estimate.thisRun.byFamily.account === 2 + 1 && full.summary.estimate.thisRun.byFamily.template === 13 + 1, // + the one internal-domain call
      [sel.summary.calls.made, full.summary.calls.made, sel.summary.estimate.thisRun.byFamily]);
    check("a month that has left the window is dropped: the previous snapshot's first month is not carried", prev.dimensions.months[0] === "2025-08" && prev.facts.byTemplate.some((r) => r.month === "2025-08") && !L.facts.byTemplate.some((r) => r.month === "2025-08"));
    check("the carried-forward caveat names the months and the horizon", isDeepStrictEqual(L.caveats.find((c) => c.id === "carried-forward-months")?.detail, { months: monthsBetween("2025-09", "2026-07"), repullMonths: 2, previousPulledAt: "2026-08-15T09:00:00-07:00" }));
    const stateOf = (s) => Object.fromEntries(Object.entries(s.meta.metricAvailability.clicks.templates).map(([t, a]) => [t, a.state]));
    check("click evidence survives the carry: a template last clicked in a carried month is still tracked, every state equals the full refresh's, and the evidence reaches back to a month that has left the window",
      clickAvailability(L, "tpl-promo").state === "tracked" && isDeepStrictEqual(stateOf(L), stateOf(F)) && clickAvailability(L, "tpl-welcome").evidence.clickHistory.firstMonth === "2025-08" && clickAvailability(F, "tpl-welcome").evidence.clickHistory.firstMonth === "2025-09");
    const sameAccounts = (s) => [...new Set(s.facts.byAccount.filter((r) => r.bucket === "account" && r.programId === "p-onboard").map((r) => r.accountKey))].sort();
    check("a carried program keeps the accounts the previous snapshot selected, so each account's row series is whole across carried and pulled months", isDeepStrictEqual(sameAccounts(L), sameAccounts(prev)) && L.dimensions.accounts.every((a) => a.name));

    const late = pull({ variant: { lateOpens: true }, previous: prev }).snapshot;
    const lateFull = pull({ variant: { lateOpens: true } }).snapshot;
    const opened = (s, m) => s.facts.byTemplate.filter((r) => r.month === m).reduce((x, r) => x + r.opened, 0);
    check("carried months keep the counts of the pull that made them: opens arriving after it are not captured (the caveat's subject), while the re-pulled months do capture theirs",
      opened(late, "2026-03") === opened(prev, "2026-03") && opened(lateFull, "2026-03") > opened(late, "2026-03") && opened(late, "2026-08") === opened(lateFull, "2026-08"));

    const partialPrev = JSON.parse(JSON.stringify(pull({ variant: { cutoff: "2026-08-16" }, raw: { today: "2026-08-15", pulledAt: "2026-08-15T09:00:00-07:00", ids: ["p-onboard", "p-nps", "p-renew", "p-pilot", "p-unlisted"] } }).snapshot));
    const grown = pull({ previous: partialPrev });
    check("a program new to the snapshot is pulled for its whole window while the others are carried, and the totals still equal a full refresh",
      grown.snapshot.meta.refresh.mode === "selective" && grown.snapshot.meta.refresh.fullPrograms === 1 && sameMap(totals(grown.snapshot, "byTemplate"), totals(F, "byTemplate")) && sameMap(totals(grown.snapshot, "byAccount"), totals(F, "byAccount")) && grown.snapshot.facts.byTemplate.filter((r) => r.programId === "p-promo").every((r) => r.provenance === "pulled"), grown.snapshot.meta.refresh);
    const stale = JSON.parse(JSON.stringify(pull({ variant: { cutoff: "2026-06-16" }, raw: { today: "2026-06-15", pulledAt: "2026-06-15T09:00:00-07:00" } }).snapshot));
    const skipped = pull({ previous: stale }).snapshot;
    check("a skipped refresh re-pulls from the month the previous snapshot was pulled in, not only the horizon: that month was incomplete when it was pulled, and the months after it never were",
      isDeepStrictEqual(skipped.meta.refresh.pulledMonths, ["2026-06", "2026-07", "2026-08", "2026-09"]) && sameMap(totals(skipped, "byTemplate"), totals(F, "byTemplate")) && sameMap(totals(skipped, "byAccount"), totals(F, "byAccount")), skipped.meta.refresh);
    const reasons = [
      [{ raw: { forceFull: true } }, /asked for/],
      [{ raw: { internalDomains: ["acme.com", "example.net"] } }, /internal domains changed/],
      [{ raw: { unsubscribeLinks: [OWN_SITE_UNSUBSCRIBE] } }, /unsubscribe links changed/],
      [{ raw: { stepDetail: true } }, /step-detail switch changed/],
      [{ raw: { accounts: { ...ACC, busiest: 4 } } }, /account selection changed/],
      [{ raw: { from: "2025-06" } }, /starts later/],
    ].map(([o, re]) => [pull({ ...o, previous: prev, phase: "plan" }).summary.estimate, re]);
    check("a previous snapshot the new pull cannot extend forces a full refresh, and the reason is stated: forced, domains changed, unsubscribe links changed, step detail changed, selection changed, window reaches further back", reasons.every(([e, re]) => e.mode === "full" && re.test(e.why)), reasons.map(([e]) => e.why));
    const older = JSON.parse(JSON.stringify(prev));
    for (const c of older.reconciliation.checks) { delete c.drift; delete c.driftExamples; }
    const dated = pull({ previous: older, phase: "plan" }).summary.estimate;
    check("a snapshot built under earlier metric definitions (before Delivered changed and the no-company-link sends were read) is never carried from", dated.mode === "full" && /earlier metric definitions/.test(dated.why), dated);
    const foreign = pull({ previous: { ...prev, meta: { ...prev.meta, tenantHost: "acme-sbx.gainsightcloud.com" } }, phase: "plan" }).summary.estimate;
    check("another tenant's snapshot is never carried from", foreign.mode === "full" && /another tenant/.test(foreign.why), foreign);
  }

  // ── Small pure pieces ─────────────────────────────────────────────────────
  {
    const acc = new Map([["a", { sent: 9, delivered: 9, opened: 9, bounced: 0 }], ["b", { sent: 8, delivered: 8, opened: 1, bounced: 0 }], ["c", { sent: 2, delivered: 1, opened: 0, bounced: 1 }], ["d", { sent: 1, delivered: 1, opened: 1, bounced: 0 }]]);
    check("selectAccounts: busiest by sends, lowest open rate among accounts with enough delivered, most bounces, and pinned always — an account below the delivered minimum is never 'low engagement'",
      isDeepStrictEqual([...selectAccounts(acc, { busiest: 1, lowEngagement: 1, mostBounces: 1, lowEngagementMinDelivered: 5, pinned: ["d", "zz"] })].sort(), ["a", "b", "c", "d"]) && isDeepStrictEqual([...selectAccounts(acc, { busiest: 0, lowEngagement: 1, mostBounces: 0, lowEngagementMinDelivered: 5, pinned: [] })], ["b"]));
    const pinned = pull({ raw: { accounts: { ...ACC, busiest: 1, lowEngagement: 0, mostBounces: 0, pinned: ["co-10"] } } }).snapshot;
    check("accounts named in the spec are always kept as their own rows, whatever their rank", pinned.facts.byAccount.some((r) => r.programId === "p-onboard" && r.accountKey === "co-10" && r.bucket === "account"));
    const noNames = pull({ raw: { accounts: { ...ACC, names: false } } });
    check("account names are a name only when asked for: without them the key stays and no company call is made", noNames.snapshot.dimensions.accounts.every((a) => a.name === null && a.key) && !rpRuns(noNames.argv).some((a) => flag(a, "--object") === "company"));
    const noDomains = pull({ raw: { internalDomains: [] } }).snapshot;
    check("with no internal domain declared nobody is known to be internal: every row is external, external uniques equal all, and the snapshot says the split is not configured",
      noDomains.facts.byTemplate.every((r) => r.recipientClass === "external") && noDomains.facts.uniques.every((r) => r.external.people === r.people) && noDomains.caveats.some((c) => c.id === "recipient-class-not-configured"));
    const looping = pull({ variant: { listNoEnvelope: true } });
    check("the jo p list loop is bounded: a list that repeats its rows and names no last page is refused after 100 pages, never paged until the token runs out", /still returning rows after 100 pages/.test(String(looping.error?.message)) && looping.argv.filter((a) => a.includes("list")).length === 100, [String(looping.error?.message), looping.argv.length]);
    const d = new Date();
    check("the default today is the local date, like pulledAt", resolveParams({}).today === `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    let threw = "";
    try { buildQuery({ family: "template", cls: "all", window: { start: "2026-01-01" } }); } catch (e) { threw = e.message; }
    check("a query without a two-sided window cannot be built", /no two-sided window/.test(threw));
    for (const [raw, re] of /** @type {Array<[*, RegExp]>} */ ([[{ from: "2026-10", to: "2026-09" }, /window must be/], [{ pageSize: 6000 }, /--page-size must be/], [{ today: "09/15/2026" }, /--today must be/], [{ accounts: { busiest: -1 } }, /--accounts-busiest/], [{ timeoutMs: NaN }, /--timeout-ms must be/]])) {
      let msg = "";
      try { resolveParams({ today: TODAY, ...raw }); } catch (e) { msg = e.message; }
      check(`resolveParams refuses ${JSON.stringify(raw)}`, re.test(msg), msg);
    }
  }

  // ══ The process: exit codes, resume, one call at a time, the golden ═══════
  {
    const WS = join(ROOT, "ws");
    writeFiles(WS, { ".gs-superadmin/.keep": "" });
    const LINKS = join(ROOT, "link-settings.json");
    writeFileSync(LINKS, JSON.stringify({ "tpl-nps": { reading: "tracked-link-present", asOf: "2026-09-01" }, "tpl-renew-b": { reading: "links-none-tracked", asOf: "2026-09-01" } }));
    const common = ["--workspace", WS, "--bin", FAKE, "--kb", KB_DIR, "--today", TODAY, "--pulled-at", PULLED_AT, "--from", "2026-06", "--internal-domain", "acme.com", "--step-detail", "--page-size", "400",
      "--accounts-busiest", "3", "--accounts-low", "2", "--accounts-bounce", "2", "--accounts-low-min-delivered", "4", "--link-settings", LINKS, "--unsubscribe-link", OWN_SITE_UNSUBSCRIBE];
    const cli = (mode, extra, env) => {
      const r = runNode(ENGINE, [mode, ...common, ...extra], { env: { ...process.env, ...env } });
      let json = null;
      try { json = JSON.parse(r.stdout); } catch { /* failure path */ }
      return { code: r.status, json, stderr: r.stderr };
    };
    const state = join(ROOT, "fake-state");
    mkdirSync(state);
    const out = join(ROOT, "snapshot.json");
    const env = { FAKE_STATE: state };
    const stopped = cli("run", ["--run", "golden", "--out", out], { ...env, FAKE_FAULTS: JSON.stringify([{ match: "rp run", kind: "auth", skip: 15, times: 9999 }]) });
    check("exit codes: a run the token dies under exits 3 with status token-expired, writes no snapshot, and says how to resume", stopped.code === 3 && stopped.json?.status === "token-expired" && stopped.json.ok === false && !existsSync(out), stopped);
    const before = readFileSync(join(state, "argv.jsonl"), "utf8").split("\n").filter(Boolean).length;
    const resumed = cli("run", ["--run", "golden", "--out", out], env);
    const lines = readFileSync(join(state, "argv.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    check("resume skips calls already done: the second invocation of the same --run makes only what was left, exits 0, and writes the snapshot",
      resumed.code === 0 && resumed.json?.ok === true && resumed.json.calls.reused >= 15 && lines.length - before === resumed.json.calls.made && existsSync(out) && resumed.json.reconciled === true, resumed.json ?? resumed.stderr);
    check("gs-admin calls run one at a time: across both invocations no call started while another was in flight", lines.length >= 30 && lines.every((l) => l.overlap === false), [lines.length, lines.filter((l) => l.overlap).length]);
    check("the summary a caller sees carries counts and verdicts, never rows: bulk JSON does not reach stdout", JSON.stringify(resumed.json).length < 6000 && resumed.json.rows.byTemplate > 0 && !("facts" in resumed.json));
    const snap = JSON.parse(readFileSync(out, "utf8"));
    const golden = { ...snap, meta: { ...snap.meta, cliVersion: "fixture", pluginVersion: "fixture" } };
    check("the snapshot records the CLI and plugin versions it was pulled with", snap.meta.cliVersion === CATALOG.meta.cliVersion && snap.meta.pluginVersion === JSON.parse(readFileSync(join(PLUGIN, ".claude-plugin", "plugin.json"), "utf8")).version);
    if (WRITE_GOLDEN) writeFileSync(GOLDEN, JSON.stringify(golden, null, 1) + "\n");
    check("reduce produces the expected snapshot: the run through the real process, interrupted and resumed, equals the committed fixture snapshot (versions aside)", isDeepStrictEqual(golden, JSON.parse(readFileSync(GOLDEN, "utf8"))));
    const twin = pull({ kb: true, raw: { from: "2026-06", stepDetail: true, unsubscribeLinks: [OWN_SITE_UNSUBSCRIBE] }, linkSettings: JSON.parse(readFileSync(LINKS, "utf8")) }).snapshot;
    check("the two transports agree: the same pull in process reduces to the same snapshot as the CLI transport's", isDeepStrictEqual(twin, golden));
    check("the fixture snapshot shows all three tracking states and both recipient classes", new Set(Object.values(golden.meta.metricAvailability.clicks.templates).map((t) => t.state)).size === 3 && new Set(golden.facts.byStep.map((r) => r.recipientClass)).size === 2);

    const again = cli("reduce", ["--run-dir", join(WS, ".gs-superadmin", "tmp", "engagement", "golden"), "--out", join(ROOT, "again.json")], {});
    check("reduce runs on its own from the run directory and writes the same snapshot", again.code === 0 && isDeepStrictEqual(JSON.parse(readFileSync(join(ROOT, "again.json"), "utf8")), snap), again.json ?? again.stderr);
    const changed = cli("fetch", ["--run", "golden", "--sent-since", "30d"], env);
    check("a run directory is resumed only with the parameters it was started with", changed.code === 1 && /started with different parameters/.test(changed.stderr), changed.stderr);
    const otherLink = cli("fetch", ["--run", "golden", "--unsubscribe-link", "links.example.net"], env);
    check("F-470: the unsubscribe links are part of a run's identity: a run resumes only with the input it started with (its click payloads were classified under it), through the real process",
      otherLink.code === 1 && /started with different parameters/.test(otherLink.stderr) && isDeepStrictEqual(snap.meta.params.unsubscribeLinks, ["www.acme.com/mail-settings"]), otherLink.stderr);
    const badLink = cli("plan", ["--run", "bad-link", "--unsubscribe-link", "mail-settings"], env);
    check("F-470: a value that names no web host is refused at the command line, before any call", badLink.code === 1 && /--unsubscribe-link takes a link or a host/.test(badLink.stderr) && !existsSync(join(WS, ".gs-superadmin", "tmp", "engagement", "bad-link")), badLink.stderr);
    const otherPlan = cli("fetch", ["--run", "golden", "--previous", GOLDEN], env);
    check("a run directory is resumed only with the --previous it was started with: two plans' payloads are never reduced together", otherPlan.code === 1 && /started with a different --previous/.test(otherPlan.stderr), otherPlan.stderr);
    const planned = cli("plan", ["--run", "planned"], env);
    check("exit codes: plan exits 0 and prints the estimate, with what step detail adds", planned.code === 0 && planned.json?.estimate.stepDetail.on === true && planned.json.estimate.stepDetail.addsSeconds > 0 && planned.json.whoami.host === "acme.gainsightcloud.com", planned.json ?? planned.stderr);
    const failing = cli("fetch", ["--run", "partial"], { ...env, FAKE_FAULTS: JSON.stringify([{ match: '"LinkClickedJson"', kind: "generic", times: 99 }]) });
    check("exit codes: a run with a failed call exits 4 (partial), names the unit, and stays resumable", failing.code === 4 && failing.json?.status === "partial" && failing.json.failed[0].family === "click-json", failing.json ?? failing.stderr);
    const noWs = runNode(ENGINE, ["plan", "--workspace", join(ROOT, "nowhere"), "--bin", FAKE]);
    check("the adapter is inert outside a gs-superadmin workspace", noWs.status === 1 && /no gs-superadmin workspace here/.test(noWs.stderr));
    writeFiles(join(ROOT, "kb-other"), Object.fromEntries(Object.entries(kbFiles("acme-sbx")).map(([k, v]) => [k, v.replace("https://acme.gainsightcloud.com", "https://acme-sbx.gainsightcloud.com")])));
    const wrong = runNode(ENGINE, ["plan", "--workspace", WS, "--bin", FAKE, "--kb", join(ROOT, "kb-other", "acme-sbx"), "--today", TODAY, "--run", "wrong-tenant"]);
    check("a KB that belongs to another tenant is refused before any pull: step names never cross tenants", wrong.status === 1 && /belongs to acme-sbx\.gainsightcloud\.com but the CLI is on acme\.gainsightcloud\.com/.test(wrong.stderr), wrong.stderr);
    const mut = structuredClone(CATALOG);
    mut.commands.find((c) => c.path === "report run").mutating = true;
    const WS2 = join(ROOT, "ws-mutating");
    writeFiles(WS2, { ".gs-superadmin/catalog.json": JSON.stringify(mut) });
    const state2 = join(ROOT, "fake-state-2");
    mkdirSync(state2);
    const refusedRun = runNode(ENGINE, ["plan", "--workspace", WS2, "--bin", FAKE, "--today", TODAY, "--run", "refused"], { env: { ...process.env, FAKE_STATE: state2 } });
    check("the workspace catalog decides: where it flags `report run` mutating, the process exits 1 and no rp run reaches the CLI",
      refusedRun.status === 1 && /is MUTATING/.test(refusedRun.stderr) && !readFileSync(join(state2, "argv.jsonl"), "utf8").includes('"run"'), refusedRun.stderr);
  }

  // ── The ledger: every pitfall and every spike fact names its check ────────
  const LEDGER = {
    "pitfall: both bounds on a never-null date": "every date window has both bounds",
    "pitfall: MAX() on a DATETIME errors": "no call asks the server for what it cannot do",
    "pitfall: two group-by dimensions tenant-wide can time out": "a call that times out again after its retry is split",
    "pitfall: IN works on the id filter": "a subset of programs goes in one call with IN",
    "pitfall: null group values have no v key": "a row with no company link gets its own bucket",
    "pitfall: CC copies carry AddressType = CC": "CC copies carry AddressType = CC",
    "pitfall: deleted programs excluded and counted; Stopped ones not excluded": "deleted programs (sends in the log",
    "pitfall: content is not in the send log": "no call asks the server for what it cannot do",
    "pitfall: the template list cannot see nested folders": "template ids come from the send log's EmailTemplateId",
    "pitfall: a template's text is its current text (TPL-1's; S1 reads no text)": "no call asks the server for what it cannot do",
    "pitfall: parallel calls produce false errors": "gs-admin calls run one at a time",
    "pitfall: not-found re-checked once on its own": "a seeded false not-found is re-checked and cleared",
    "pitfall: CRLF id lists": "a CRLF id list works",
    "pitfall: account level from email_log_v2 by fieldPath; no-link bucket": "account level comes from email_log_v2 through a fieldPath",
    "pitfall: status is today's status, a list": "status is a LIST",
    "pitfall: cost against the token": "cost: plan estimates the calls and seconds",
    "fact 1: --page-size sets the rows; equal length is truncated": "a result as long as the page is treated as truncated and split",
    "fact 2: --limit above 2000 is refused client-side": "no rp run passes --limit",
    "fact 3: LOOKUP grouping resolves to an empty name": "nothing groups or aggregates on a LOOKUP field by name",
    "fact 4: non-sent rows are attempts; Sent counts all rows": "Sent counts every attempt",
    "fact 5: timeouts are unpredictable and transient": "timeouts are transient",
    "fact 6: a reproducible 'network outage' is a query-shape error": "a reproducible 'network outage' is a query-shape error",
    "fact 7: formula rejections are a generic error": "a generic refusal is not retried",
    "fact 8: stderr warnings with exit 0": "non-empty stderr is not a failure",
    "fact 9: an unknown filter field is silently dropped": "every filter field is validated against rp schema first",
    "fact 10: null dates act as later than any date; window on ExecutedDate / CreatedAt": "the hazard the rule exists for: a single-sided bound",
    "fact 11: month buckets keyed by k, rows unordered": "month buckets are read from k",
    "fact 12: null group values have no v key; boolean cells": "a send with no template id keeps its own row",
    "fact 13: a pivot changes the envelope": "no call asks the server for what it cannot do",
    "fact 14: email_log_v2 flags are YES/NO strings; filter Source": "email_log_v2 flags are YES/NO strings and ao_emails flags are booleans",
    "fact 15: jo p describe embeds JSON as strings": "jo p describe embeds JSON as strings",
    "fact 16: jo p list paging envelope; several statuses": "jo p list is paged by its envelope",
    "fact 17: CC copies are marked by AddressType": "the default source is email_log_v2",
  };
  for (const [what, label] of Object.entries(LEDGER)) {
    if (!ran.some((l) => l.startsWith(label))) {
      failures++;
      console.log(`FAIL  ledger: "${what}" names a check that did not run ("${label}")`);
    }
  }
  console.log(`PASS  ledger: ${Object.keys(LEDGER).length} pitfalls and spike facts each name a check that ran`);
} finally {
  removeTempDir(ROOT);
}

if (failures) {
  console.log(`\nengagement: ${failures} FAILED of ${ran.length}`);
  process.exit(1);
}
console.log(`\nengagement: all ${ran.length} checks passed`);
