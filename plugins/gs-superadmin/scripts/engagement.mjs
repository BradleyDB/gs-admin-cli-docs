#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// engagement.mjs — the `jo-engagement` source adapter (ENG-1, ENG-2): reads a
// tenant's Journey Orchestrator send log through read-only `gs-admin` calls and
// reduces it to ONE file, the T-10 engagement snapshot, which every later
// layer reads (query engine, report, pages, refresh runner).
//
// Subcommands:
//   plan    the cheap tenant-wide calls, then an estimate of the rest (calls and
//           seconds, full and selective, and what step detail and the account
//           grain each add, whether on or off) against the token's remaining life
//   fetch   every call, one at a time, one payload file per call; resumable
//   reduce  fetched files → the snapshot; a pure function of the run directory
//   run     plan, fetch and reduce in order
//
// What the code enforces, so no caller has to remember it (each has a named
// test in test/engagement.mjs; the measurements behind them were taken on
// CLI 1.0.10):
//   - Every `rp run` passes --page-size (rpRunArgv is the one builder). Omitted,
//     the CLI returns 50 rows; the cut is silent and there is no total. A result
//     as long as the page is treated as truncated and the call is split.
//   - Every date window carries both bounds, on a date no row lacks:
//     ExecutedDate on email_log_v2, CreatedAt on ao_emails. A null date acts as
//     later than any date, so a single-sided bound pulls in every undated row.
//   - Nothing groups or aggregates on a LOOKUP field: it resolves to the
//     target's name, which is empty, and collapses the groups. A fieldPath to
//     the target's Gsid is used instead, and validateQuery refuses the rest.
//   - Every field a query names is checked against `rp schema` first: a filter
//     on a field the schema lacks is silently dropped by the CLI, which widens
//     the query instead of failing it.
//   - No query shows a field it also groups by. The CLI keys a field by its
//     object and name alone, aggregation ignored, and drops a show field whose
//     key a group-by field has: silently when another show field is left, and
//     with a refusal when none is. validateQuery refuses such a query first.
//   - A unit that is still a full page at one program, one day and one flag
//     partition is cut by the recipient's address (contains a character, or
//     does not): the measures are additive, so any cut of the sends adds up.
//   - A lookup path decides WHICH account or person a send belongs to, never
//     whether the send is counted. The server drops every row whose lookup is
//     null from a call that groups or aggregates through that lookup, so the
//     program totals come from a call that names no lookup, each distinct
//     count is asked through its own lookup alone, and the sends with no
//     company link are read by their own calls (GsCompanyId IS_NULL).
//   - A timed-out call is retried once on its own, then split. A "network
//     outage" that survives one retry is a query-shape error and is not retried.
//   - Calls run one at a time (parallel calls produced false errors), and a
//     not-found is re-checked once before it is believed.
//   - Every command is checked against the catalog before it is spawned, and a
//     catalogued-mutating one is refused (the mutation guard cannot see inside
//     this process). The adapter's whole command set is ENGAGEMENT_READ_PATHS.
//   - The default source is email_log_v2, filtered to Source = "Advanced
//     Outreach" and AddressType = "To". ao_emails is read only with step detail.
//   - Click detail is read per send from LinkClickedJson, classified at fetch
//     time: the clicker's IP and the URLs never reach disk, only the counts of
//     content and other links. Unsubscribe and mailto links are not content;
//     a tenant whose unsubscribe link carries none of the generic wording names
//     it with --unsubscribe-link (a link or a host), a run parameter.
//   - Account is the finest grain. No address, person id or send id reaches the
//     snapshot; unique counts are pulled as aggregates.
//   - Unique counts are never summed across programs or months.
//   - The account grain is optional and OFF unless --accounts is passed: it is
//     most of a pull's calls. Without it the account table and the account
//     dimension are empty and the snapshot says why (meta.accounts); accounts
//     REACHED per program, a distinct count, is pulled either way. Turning it on
//     over a snapshot that holds none is a full refresh.
//   - Nothing is read from a previous snapshot that the refresh could never
//     carry facts from (another tenant's, or one built under earlier metric
//     definitions): usablePrevious is the one gate, and fetch and reduce see
//     the previous snapshot only through it.
//
// Step names come from the tenant KB (jo-report's parser over the program
// docs), never from a second describe loop: a program the KB lacks a full doc
// for has its sends reported under template names alone, and the count is in
// the snapshot's honesty stats.
//
// Citations: ENG-n / SPK-n / HLT-n / DSH-n / TPL-n / PUB-n are work items and
// Rnn are rulings of the maintainer's unpublished JO-dashboards plan; the
// decision each produced is stated beside the token (CONTRIBUTING, "Reading the
// citations in code comments").
//
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────

// ── T-10 · engagement snapshot (producer-owned contract) ─────────────────────
/**
 * FROZEN (ENG-1, 2026-10-03). The snapshot is a FACT MODEL: dimension tables,
 * one additive fact table per grain, row provenance, per-program unique
 * counts, and per-template availability of the optional metrics.
 *
 * Contract-freeze rule: an ADDITIVE field rides the change that needs it, with
 * this typedef and its pin in test/contract-conformance.mjs updated in the same
 * change. Removing or re-typing a field, or changing what a measure counts,
 * bumps schemaVersion and is never a tuning edit.
 *
 * What each measure counts (email_log_v2, Source = "Advanced Outreach",
 * AddressType = "To"; R16-R22):
 *   sent            every attempt whose ExecutedDate falls in the month
 *   delivered       attempts that went out and did not bounce: IsSent = YES and
 *                   IsBounced not YES (on the step table, EmailSend true and
 *                   Bounce not true). An attempt that went out and bounced
 *                   afterwards counts as bounced, not delivered.
 *   bounced         attempts with IsBounced = YES (events, whether or not the
 *                   attempt went out)
 *   rejected / unsubscribed / spamComplaints   IsRejected / IsUnsubscribed / IsSpam = YES
 *   opened          attempts with IsOpened = YES
 *   clicked         attempts with at least one CONTENT-link click
 * Rates are a reader's job (count ÷ sent, or ÷ delivered for open and click
 * rate) and are null, never 0, on a zero denominator.
 *
 * @typedef {"tracked"|"not-tracked"|"unknown"} TrackingState
 *   tracked: a 0 is a real 0. not-tracked: no value may be shown. unknown: the
 *   value is shown with a marker. Never inferred from zero clicks alone (R1b).
 * @typedef {"internal"|"external"} RecipientClass
 * @typedef {"pulled"|"carried"} RowProvenance  carried = copied from the
 *   previous snapshot by a selective refresh; pulledAt says when it was pulled
 *
 * @typedef {object} T10SendMeasures
 * @property {number} sent
 * @property {number} delivered
 * @property {number} bounced
 * @property {number} rejected
 * @property {number} unsubscribed
 * @property {number} spamComplaints
 * @property {number} opened
 * @property {number} clicked
 *
 * @typedef {object} T10RowBase
 * @property {string} programId
 * @property {string} month            YYYY-MM, the ExecutedDate month
 * @property {RecipientClass} recipientClass
 * @property {RowProvenance} provenance
 * @property {string} pulledAt
 *
 * @typedef {T10RowBase & T10SendMeasures & {templateId: ?string}} T10TemplateRow
 * @typedef {T10RowBase & T10SendMeasures & {stepId: ?string, variantId: ?string, templateId: ?string}} T10StepRow
 * @typedef {T10RowBase & T10SendMeasures & {bucket: "account"|"other"|"no-company-link", accountKey: ?string}} T10AccountRow
 *   bucket "other" is every account the selection left out, and "no-company-link"
 *   every send with no company: one row each per program × month × class, so the
 *   account table always sums to the program total
 * @typedef {{programId: string, month: string, submitted: number, partiallySubmitted: number, provenance: RowProvenance, pulledAt: string}} T10ResponseRow
 *   month is the RESPONSE month (RespondedDate)
 * @typedef {{people: ?number, accounts: ?number, participantRecords: ?number}} T10UniqueCounts
 * @typedef {T10UniqueCounts & {programId: string, scope: "window"|"month", month: ?string, external: T10UniqueCounts, provenance: RowProvenance, pulledAt: string}} T10UniquesRow
 *   exact per program; never additive across programs or months
 *
 * @typedef {object} T10Facts
 * @property {T10TemplateRow[]} byTemplate        always present (R21)
 * @property {T10StepRow[]} [byStep]              only when meta.stepDetail
 * @property {T10AccountRow[]} byAccount          empty when the account grain was not pulled (meta.accounts)
 * @property {T10ResponseRow[]} responses
 * @property {Array<{programId: string, participants: number, submitted: number, partiallySubmitted: number}>} responseParticipants
 *   the response rate's ONE basis, all time: the program's survey_participant
 *   rows (the denominator) and how many of them are Submitted and Partially
 *   submitted (additive across programs; it has no month). TEST PARTICIPANTS
 *   ARE NOT COUNTED, here or in the monthly rows: rows flagged TestParticipant
 *   are left out, as the UI's program analytics leaves them out. The monthly
 *   `responses` rows are for trends and the date filter, never for the rate.
 * @property {T10UniquesRow[]} uniques
 *
 * @typedef {object} T10Dimensions
 * @property {Array<{id: string, name: ?string, statuses: string[], model: ?string, modelName: ?string, audienceType: ?string, supergroup: ?string, group: ?string, folderId: ?string}>} programs
 *   statuses is a LIST (a Dynamic Program edited while live carries two);
 *   supergroup and group are null until the grouping resolver fills them (DSH-5)
 * @property {Array<{id: string, name: ?string, uses: Array<{programId: string, stepName: ?string, stepOrder: ?number, stepCount: number}>}>} templates
 *   stepName and stepOrder are set only when the template sits on exactly ONE
 *   step of that program's design (stepCount 1); 0 = no design in the KB
 * @property {Array<{programId: string, stepId: ?string, name: ?string, order: ?number, templateId: ?string, variantId: ?string, variantName: ?string}>} [steps]
 *   only when meta.stepDetail
 * @property {Array<{key: string, name: ?string}>} accounts   the selected accounts; key is opaque. Empty when the account grain was not pulled (meta.accounts)
 * @property {string[]} months
 *
 * @typedef {object} T10ClickAvailability
 * @property {TrackingState} state
 * @property {{clickHistory: {everClicked: boolean, firstMonth: ?string, lastMonth: ?string}, linkSettings: ?{reading: "tracked-link-present"|"links-none-tracked"|"unreadable", asOf: ?string}}} evidence
 *   R19: click history decides first; then the template's link-settings reading,
 *   which a later layer supplies (TPL-1); with neither, unknown
 * @typedef {object} T10Availability
 * @property {{templates: Object<string, T10ClickAvailability>, programs: Object<string, {state: TrackingState, templates: {tracked: number, notTracked: number, unknown: number}}>}} clicks
 *   the program roll-up is tracked only when EVERY one of its templates is,
 *   not-tracked only when every one is, and any mix is unknown, so a tracked
 *   program's 0% is a real 0% (R1b); the counts say what the mix is
 * @property {{programs: Object<string, {state: TrackingState, evidence: {surveyParticipants: ?number}}>}} responses
 *
 * @typedef {object} T10Meta
 * @property {"jo-engagement"} source
 * @property {Object<string, *>} params            the run's parameters, echoed
 * @property {string} pulledAt                    ISO 8601 with a UTC offset
 * @property {?string} timeZone
 * @property {string} tenantHost
 * @property {?string} cliVersion
 * @property {?string} pluginVersion
 * @property {{from: string, to: string, start: string, endExclusive: string}} window
 * @property {string} incompleteFrom              sends on or after this day are provisional
 * @property {{object: string, field: string, grain: "month", stepDetail: ?{object: string, field: string}}} dateBasis
 * @property {boolean} stepDetail
 * @property {{pulled: boolean, reason: ?"accounts-off"}} [accounts]
 *   whether the account grain was pulled. When it was not (the run's choice:
 *   it is most of a pull's cost), facts.byAccount and dimensions.accounts are
 *   empty, the accounts-sum-to-program check is absent, and a reader shows the
 *   reason; it never shows an empty account list as "no accounts". Accounts
 *   reached per program (facts.uniques) is pulled either way. ABSENT on a
 *   snapshot made before the switch existed, which always pulled the grain:
 *   read it through accountAvailability, never directly.
 * @property {{pulled: boolean, reason: ?"step-detail-off"}} participantRecords
 *   why T10UniqueCounts.participantRecords is null when it is (a reader shows
 *   the reason; it never shows a 0)
 * @property {{mode: "full"|"selective", why: string, repullMonths: number, pulledMonths: string[], carriedMonths: string[], carriedPrograms: number, fullPrograms: number, previousPulledAt: ?string}} refresh
 * @property {T10Availability} metricAvailability
 *
 * @typedef {object} T10Snapshot
 * @property {1} schemaVersion
 * @property {"engagement"} kind
 * @property {T10Meta} meta
 * @property {T10Dimensions} dimensions
 * @property {T10Facts} facts
 * @property {Object<string, *>} honesty           what was seen, excluded and could not be read
 * @property {{ok: boolean, checks: Array<{id: string, ok: boolean, compared: number, mismatches: number, examples: Array<Object<string, *>>, drift: number, driftExamples: Array<Object<string, *>>}>}} reconciliation
 *   ok, mismatches and examples are about CLOSED months only. A difference in a
 *   month on or after meta.incompleteFrom is counted in drift: that month is
 *   still being written while the calls are made one after another, so two
 *   calls minutes apart can disagree without anything being wrong.
 * @property {Array<{id: string, detail: Object<string, *>}>} caveats   this snapshot's own; metric caveats live with the metric definitions
 */

// ── The source-adapter interface ("JO first, pluggable") ─────────────────────
/**
 * One adapter per data source; only `jo-engagement` ships. A second source
 * implements the same three steps and writes its own snapshot kind.
 * @typedef {object} EngagementSourceAdapter
 * @property {string} id
 * @property {(ctx: *) => object} plan     the cheap calls, then the estimate
 * @property {(ctx: *) => object} fetch    every call, to payload files
 * @property {(input: *) => T10Snapshot} reduce   pure
 */

// ── The transport seam ───────────────────────────────────────────────────────
/**
 * The one seam between WHICH calls to make and HOW a call is executed. Only
 * the CLI transport ships (one `gs-admin` process per call). A workspace with
 * other access adds a transport without touching plan or reduce. The fetch
 * layer owns the payload file: a transport returns bytes, never writes them,
 * because click payloads are stripped before anything reaches disk.
 * @typedef {object} EngagementTransport
 * @property {string} name
 * @property {number} concurrency   calls it can hold in flight; the fetch loop uses 1 regardless
 * @property {(req: {id: string, argv: string[], timeoutMs: number}) => TransportResult} run
 * @typedef {{ok: boolean, status: ?number, stdout: string, stderr: string, timedOut: boolean, ms: number}} TransportResult
 */
import { readFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  makeCliHelpers, findWorkspaceDir, findWorkspaceCatalog, makeCommandResolver, assertReadOnlyCommand,
  resolveCliArgv, isAuthDeath, readJsonFile, writeFileAtomicSync, isMainModule, stripBom, cmpKey, termKey,
  readKbIdentity,
} from "./doc-lib.mjs";
import { printable } from "./journal-lib.mjs";
import { buildIndex } from "./jo-report.mjs";

const here = dirname(fileURLToPath(import.meta.url));

export const T10_SCHEMA_VERSION = 1;
export const SEND_MEASURES = Object.freeze(["sent", "delivered", "bounced", "rejected", "unsubscribed", "spamComplaints", "opened", "clicked"]);

const LOG = "email_log_v2";
const JO_LOG = "ao_emails";
const SURVEY = "survey_participant";
const COMPANY = "company";
const JO_SOURCE = "Advanced Outreach";
const SERVER_PAGE_MAX = 5000;
// An IN list this long was measured to work; nothing longer was tried.
const IN_BATCH = 50;
const NAME_BATCH = 200;
// `jo p list --limit 1000` returned a whole tenant in one page; a loop still
// paging after this many has an envelope it cannot read.
const MAX_LIST_PAGES = 100;

// The adapter's whole command surface, by canonical catalog path. Whether a
// command MUTATES is read from the catalog (tenet 6); this list is only which
// reads the adapter issues, so anything else is refused whatever its flag.
export const ENGAGEMENT_READ_PATHS = new Set(["whoami", "report run", "report schema", "journey programs list", "journey programs describe"]);

// ── Dates (day and month strings; UTC arithmetic, no time zone in play) ──────
const DAY_MS = 86400000;
const pad2 = (n) => String(n).padStart(2, "0");
const dayMs = (s) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
const fmtDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const isDay = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && fmtDay(dayMs(s)) === s;
const isMonth = (s) => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
export const addDays = (s, n) => fmtDay(dayMs(s) + n * DAY_MS);
const daysBetween = (a, b) => Math.round((dayMs(b) - dayMs(a)) / DAY_MS);
export const addMonths = (ym, n) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + n, 1)).toISOString().slice(0, 7);
const monthStart = (ym) => `${ym}-01`;
export function monthsBetween(from, to) {
  const out = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) out.push(m);
  return out;
}
const monthWindow = (from, to) => ({ start: monthStart(from), end: monthStart(addMonths(to, 1)) });

/**
 * `--sent-since <date | Nd | Nm>` → the day it names, or null when it names none.
 * @param {string} spec
 * @param {string} today YYYY-MM-DD
 * @returns {?string}
 */
export function parseSentSince(spec, today) {
  if (isDay(spec)) return spec;
  const d = /^(\d+)d$/.exec(String(spec));
  if (d) return addDays(today, -Number(d[1]));
  const m = /^(\d+)m$/.exec(String(spec));
  if (m) {
    const ym = addMonths(today.slice(0, 7), -Number(m[1]));
    const last = Number(fmtDay(dayMs(monthStart(addMonths(ym, 1))) - DAY_MS).slice(8, 10));
    return `${ym}-${pad2(Math.min(Number(today.slice(8, 10)), last))}`;
  }
  return null;
}

function localIsoWithOffset(d) {
  const off = -d.getTimezoneOffset();
  const abs = Math.abs(off);
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}` +
    `${off >= 0 ? "+" : "-"}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`
  );
}

// ── whoami: the token pre-flight's input ─────────────────────────────────────
// `gs-admin whoami` exits 0 in every state, so the LINES decide, never the
// exit code: "Token: valid (expires in Ns)", "Token: expired", "Token: none …".
/**
 * @param {string} text
 * @returns {{tokenState: "valid"|"expired"|"none"|"unreadable", expiresInSeconds: ?number, baseUrl: ?string, host: ?string}}
 */
export function parseWhoami(text) {
  const t = String(text ?? "");
  const valid = /^Token:\s*valid \(expires in (\d+)s\)/m.exec(t);
  const tokenState = valid ? "valid" : /^Token:\s*expired/m.test(t) ? "expired" : /^Token:\s*none/m.test(t) ? "none" : "unreadable";
  const url = /^Base URL:\s*(\S+)/m.exec(t)?.[1] ?? null;
  let host = null;
  try {
    host = url ? new URL(url).host.toLowerCase() : null;
  } catch { /* "(not set)" and friends: no host */ }
  return { tokenState, expiresInSeconds: valid ? Number(valid[1]) : null, baseUrl: host ? url : null, host };
}

// ── Failure classes (stderr is text; a failure is exit 1 with empty stdout) ──
/**
 * @param {{stdout?: string, stderr?: string, timedOut?: boolean}} r a FAILED call
 * @returns {"auth-expired"|"timeout"|"not-found"|"outage"|"other"}
 */
export function classifyFailure(r) {
  const stderr = String(r.stderr ?? "");
  if (isAuthDeath({ ok: false, stdout: String(r.stdout ?? ""), stderr })) return "auth-expired";
  if (r.timedOut || /The query has timed out/.test(stderr)) return "timeout";
  if (/\bnot found\b/i.test(stderr)) return "not-found";
  // Reads as transient, and is one once. Reproduced after a retry it is a
  // query-shape error (an aggregate the server cannot run), never an outage.
  if (/could not be established due to a network outage/.test(stderr)) return "outage";
  return "other";
}

// ── Click detail: LinkClickedJson, classified and stripped ───────────────────
// R18: click rate counts content links. The rules are data; a link no rule
// names is content. A link that cannot be read counts as neither.
/** @type {ReadonlyArray<{kind: "mailto"|"unsubscribe", re: RegExp}>} */
export const NON_CONTENT_LINK_RULES = Object.freeze([
  { kind: "mailto", re: /^mailto:/i },
  { kind: "unsubscribe", re: /unsubscribe|opt[-_]?out|email[-_]?preferences|manage[-_]?preferences/i },
]);
// The tenant's own unsubscribe link (--unsubscribe-link, repeatable): a link or
// a host, held as `host` or `host/path`. Which page a tenant unsubscribes on is
// a fact about the tenant, so it is an input and never a wider pattern here.
const asUrl = (raw) => {
  try {
    return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
};
const hostAndPath = (u) => ({ host: u.hostname.toLowerCase(), path: u.pathname.replace(/\/+$/, "").toLowerCase() });
/**
 * One --unsubscribe-link value → `host` or `host/path` (lower case; scheme,
 * query and trailing slash dropped), or null when it names no web host.
 * @param {unknown} value
 * @returns {?string}
 */
export function parseUnsubscribeLink(value) {
  const raw = String(value ?? "").trim();
  const u = raw ? asUrl(raw) : null;
  if (!u || !/^https?:$/.test(u.protocol) || u.username || u.password || !u.hostname.includes(".")) return null;
  const { host, path } = hostAndPath(u);
  return host + path;
}
/**
 * Whether a clicked link is one the tenant named: the same host or a subdomain
 * of it, and, when the value has a path, that path or anything under it. Whole
 * path segments only: `/prefs` names `/prefs/topics`, never `/prefs-guide`.
 * @param {unknown} url
 * @param {ReadonlyArray<string>} links parseUnsubscribeLink's output
 */
export function matchesUnsubscribeLink(url, links) {
  if (!links.length || typeof url !== "string" || !url.trim()) return false;
  const u = asUrl(url.trim());
  // A user part means it was never a web link (mailto:cs@host parses as one).
  if (!u || u.username || u.password) return false;
  const { host, path } = hostAndPath(u);
  return links.some((link) => {
    const cut = link.indexOf("/");
    const h = cut === -1 ? link : link.slice(0, cut);
    const p = cut === -1 ? "" : link.slice(cut);
    return (host === h || host.endsWith(`.${h}`)) && (!p || path === p || path.startsWith(`${p}/`));
  });
}
/**
 * @param {unknown} url
 * @param {ReadonlyArray<string>} [unsubscribeLinks] the tenant's own (params.unsubscribeLinks)
 * @returns {"content"|"mailto"|"unsubscribe"|"unreadable"}
 */
export function classifyLink(url, unsubscribeLinks = []) {
  if (typeof url !== "string" || !url.trim()) return "unreadable";
  for (const rule of NON_CONTENT_LINK_RULES) if (rule.re.test(url)) return rule.kind;
  return matchesUnsubscribeLink(url, unsubscribeLinks) ? "unsubscribe" : "content";
}
/**
 * One send's LinkClickedJson → link counts. The value arrives as a wrapper
 * string, `{type=json, value=[…], null=true}`, with the JSON array inside; a
 * bare JSON array is read too. Each entry carries the clicker's `ip`: nothing
 * of an entry is returned, only what its url classifies as. `byInput` counts
 * the links the tenant's own unsubscribe input named: 0 across a whole pull
 * means the input matched nothing.
 * @param {unknown} raw
 * @param {ReadonlyArray<string>} [unsubscribeLinks]
 * @returns {{content: number, other: number, byInput: number, unreadable: boolean}}
 */
export function readLinkClicks(raw, unsubscribeLinks = []) {
  if (typeof raw !== "string") return { content: 0, other: 0, byInput: 0, unreadable: true };
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  let entries = null;
  if (start !== -1 && end > start) {
    try {
      entries = JSON.parse(raw.slice(start, end + 1));
    } catch { /* unreadable below */ }
  }
  if (!Array.isArray(entries)) return { content: 0, other: 0, byInput: 0, unreadable: true };
  let content = 0;
  let other = 0;
  let byInput = 0;
  for (const e of entries) {
    if (classifyLink(e?.url, unsubscribeLinks) === "content") content++;
    else other++;
    if (matchesUnsubscribeLink(e?.url, unsubscribeLinks)) byInput++;
  }
  return { content, other, byInput, unreadable: false };
}

// ── Field specs, aliases and cells ───────────────────────────────────────────
const cond = (fieldName, operator, value) => ({ leftOperand: { fieldName }, operator, rightOperand: { value } });
const hop = (leaf, through, to) => ({ fieldPath: { leaf, hops: [{ through, to }] } });
const byMonth = (name) => ({ name, summarize: "Month" });
const countOf = { name: "Gsid", aggregation: "COUNT" };
const distinct = (path) => ({ ...path, aggregation: "COUNT_DISTINCT" });
const PATH = {
  company: hop("Gsid", "GsCompanyId", COMPANY),
  person: hop("Gsid", "GsPersonId", "person"),
  surveyProgram: hop("AdvancedOutreachId", "AOParticipantId", "ao_participants"),
  participant: hop("Gsid", "GsParticipantId", "ao_participants"),
  logRow: hop("Gsid", "EmailLogId", LOG),
};
// How the CLI names result columns (read off the response samples).
const col = {
  field: (obj, name) => `${obj}_${name}`,
  month: (obj, name) => `summarize_month_of_${obj}_${name}`,
  count: (obj) => `count_of_${obj}_Gsid`,
  hop: (p) => `${p.fieldPath.hops[0].to}_${p.fieldPath.hops[0].through}__gr_${p.fieldPath.leaf}`,
  distinct: (p) => `count_distinct_of_${p.fieldPath.hops[0].to}_${p.fieldPath.leaf}`,
};
// A null group value comes back with no `v` key at all.
const cellValue = (cell) => (cell && typeof cell === "object" && "v" in cell ? cell.v : null);
const cellNumber = (cell) => {
  const v = cell && typeof cell === "object" ? cell.v ?? cell.k : null;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};
// Month buckets: `k` is the sortable YYYY-MM-DD; `v` and `fv` are display forms.
const cellMonth = (cell) => {
  const k = cell && typeof cell === "object" ? cell.k : null;
  return typeof k === "string" && /^\d{4}-\d{2}/.test(k) ? k.slice(0, 7) : null;
};
const str = (v) => (v == null ? null : String(v));
const yes = (cell) => cellValue(cell) === "YES";
const truthy = (cell) => cellValue(cell) === true;
// email_log_v2 flags are YES/NO strings; ao_emails flags are booleans.
const logFlags = (row) => ({
  delivered: yes(row[col.field(LOG, "IsSent")]) && !yes(row[col.field(LOG, "IsBounced")]), opened: yes(row[col.field(LOG, "IsOpened")]), bounced: yes(row[col.field(LOG, "IsBounced")]),
  rejected: yes(row[col.field(LOG, "IsRejected")]), unsubscribed: yes(row[col.field(LOG, "IsUnsubscribed")]), spam: yes(row[col.field(LOG, "IsSpam")]),
});
const joFlags = (row) => ({
  delivered: truthy(row[col.field(JO_LOG, "EmailSend")]) && !truthy(row[col.field(JO_LOG, "Bounce")]), opened: truthy(row[col.field(JO_LOG, "EmailOpened")]), bounced: truthy(row[col.field(JO_LOG, "Bounce")]),
  rejected: truthy(row[col.field(JO_LOG, "Rejected")]), unsubscribed: truthy(row[col.field(JO_LOG, "Unsubscribed")]), spam: truthy(row[col.field(JO_LOG, "Spam")]),
});
const logKey = (row) => ({ programId: str(cellValue(row[col.field(LOG, "SourceId")])), month: cellMonth(row[col.month(LOG, "ExecutedDate")]), n: cellNumber(row[col.count(LOG)]) });
const logUniqueCounts = (row) => ({ people: cellNumber(row[col.distinct(PATH.person)]), accounts: cellNumber(row[col.distinct(PATH.company)]) });

// One reader per call family: a result row → plain fields. These are the ONLY
// code that names a result column, so the reader-shape trace
// (test/trace-reader-shapes.mjs) measures the adapter's whole read surface by
// running them. Parse, don't validate: a cell that is not there reads as null.
export const ROW_READERS = Object.freeze({
  totals: (row) => logKey(row),
  "uniques-month": (row) => ({ ...logKey(row), ...logUniqueCounts(row) }),
  "uniques-window": (row) => ({ programId: str(cellValue(row[col.field(LOG, "SourceId")])), ...logUniqueCounts(row) }),
  "sent-since": (row) => ({ programId: str(cellValue(row[col.field(LOG, "SourceId")])) }),
  classes: (row) => ({ source: cellValue(row[col.field(LOG, "Source")]), addressType: cellValue(row[col.field(LOG, "AddressType")]), n: cellNumber(row[col.count(LOG)]) }),
  template: (row) => ({ ...logKey(row), templateId: str(cellValue(row[col.field(LOG, "EmailTemplateId")])), templateName: str(cellValue(row[col.field(LOG, "EmailTemplateName")])), flags: logFlags(row) }),
  account: (row) => ({ ...logKey(row), accountKey: str(cellValue(row[col.hop(PATH.company)])), flags: logFlags(row) }),
  "account-nolink": (row) => ({ ...logKey(row), flags: logFlags(row) }),
  "click-attr": (row) => ({ ...logKey(row), templateId: str(cellValue(row[col.field(LOG, "EmailTemplateId")])), accountKey: str(cellValue(row[col.hop(PATH.company)])), sendId: str(cellValue(row[col.field(LOG, "Gsid")])) }),
  "click-attr-nolink": (row) => ({ ...logKey(row), templateId: str(cellValue(row[col.field(LOG, "EmailTemplateId")])), sendId: str(cellValue(row[col.field(LOG, "Gsid")])) }),
  // Read at FETCH time: what reaches disk is the send's id and its link counts.
  // The links are classified with the run's own unsubscribe links (the second argument).
  "click-json": (row, unsubscribeLinks = []) => ({ id: str(cellValue(row[col.field(LOG, "Gsid")])), ...readLinkClicks(cellValue(row[col.field(LOG, "LinkClickedJson")]), unsubscribeLinks) }),
  "resp-month": (row) => ({ programId: str(cellValue(row[col.hop(PATH.surveyProgram)])), month: cellMonth(row[col.month(SURVEY, "RespondedDate")]), status: cellValue(row[col.field(SURVEY, "ResponseStatus")]), n: cellNumber(row[col.count(SURVEY)]) }),
  "resp-participants": (row) => ({ programId: str(cellValue(row[col.hop(PATH.surveyProgram)])), n: cellNumber(row[col.count(SURVEY)]) }),
  "resp-unattributed": (row) => ({ n: cellNumber(row[col.count(SURVEY)]) }),
  "resp-test": (row) => ({ programId: str(cellValue(row[col.hop(PATH.surveyProgram)])), n: cellNumber(row[col.count(SURVEY)]) }),
  "resp-total": (row) => ({ programId: str(cellValue(row[col.hop(PATH.surveyProgram)])), status: cellValue(row[col.field(SURVEY, "ResponseStatus")]), n: cellNumber(row[col.count(SURVEY)]) }),
  "account-names": (row) => ({ key: str(cellValue(row[col.field(COMPANY, "Gsid")])), name: str(cellValue(row[col.field(COMPANY, "Name")])) }),
  step: (row) => ({
    programId: str(cellValue(row[col.field(JO_LOG, "AdvancedOutreachId")])), month: cellMonth(row[col.month(JO_LOG, "CreatedAt")]), n: cellNumber(row[col.count(JO_LOG)]),
    stepId: str(cellValue(row[col.field(JO_LOG, "StepId")])), templateId: str(cellValue(row[col.field(JO_LOG, "EmailTemplateId")])),
    variantId: str(cellValue(row[col.field(JO_LOG, "EmailTemplateVarianceId")])), variantName: str(cellValue(row[col.field(JO_LOG, "EmailTemplateVarianceName")])), flags: joFlags(row),
  }),
  "step-click": (row) => ({ sendId: str(cellValue(row[col.hop(PATH.logRow)])), stepId: str(cellValue(row[col.field(JO_LOG, "StepId")])), variantId: str(cellValue(row[col.field(JO_LOG, "EmailTemplateVarianceId")])) }),
  "participants-month": (row) => ({ programId: str(cellValue(row[col.field(JO_LOG, "AdvancedOutreachId")])), month: cellMonth(row[col.month(JO_LOG, "CreatedAt")]), participants: cellNumber(row[col.distinct(PATH.participant)]) }),
  "participants-window": (row) => ({ programId: str(cellValue(row[col.field(JO_LOG, "AdvancedOutreachId")])), participants: cellNumber(row[col.distinct(PATH.participant)]) }),
});

// ── Queries, as data ─────────────────────────────────────────────────────────
// A unit descriptor says WHAT is asked: family, class, window, program batch.
// buildQuery turns it into a field-spec; rpRunArgv turns that into argv.
// The last rung of the split ladder (F-472): the address field of each send
// log, and the characters a unit is cut on, one per level. CONTAINS and
// DOES_NOT_CONTAINS on the same character are each other's complement, so the
// two halves hold every send once. Only a character ever reaches a filter.
const ADDRESS_FIELD = { [LOG]: "LowerCaseEmailId", [JO_LOG]: "ToAddress" };
// Letters and digits only: a punctuation mark could read as a pattern wildcard.
const ADDRESS_CUTS = [..."aeiornsltmcdhupbgkyfwvjzxq0123456789"];
const LOG_FLAGS = ["IsSent", "IsOpened", "IsBounced", "IsRejected", "IsUnsubscribed", "IsSpam"];
const JO_FLAGS = ["EmailSend", "EmailOpened", "Bounce", "Rejected", "Unsubscribed", "Spam"];
const suffix = (domain) => (domain.startsWith("@") ? domain : `@${domain}`);

function logWhere(d, { source = true } = {}) {
  if (!d.window?.start || !d.window?.end) throw new Error(`engagement: ${d.family} has no two-sided window`);
  const w = [];
  if (source) w.push(cond("Source", "EQ", JO_SOURCE), cond("AddressType", "EQ", "To"));
  w.push(cond("ExecutedDate", "GTE", d.window.start), cond("ExecutedDate", "LT", d.window.end));
  if (d.programs) w.push(cond("SourceId", "IN", d.programs));
  if (d.cls === "internal") w.push(cond("LowerCaseEmailId", "ENDS_WITH", suffix(d.domain)));
  if (d.cls === "external") for (const dom of d.domains) w.push(cond("LowerCaseEmailId", "DOES_NOT_CONTAINS", suffix(dom)));
  for (const p of d.partition ?? []) w.push(cond(p.field, p.op, p.value));
  return w;
}
function joWhere(d) {
  if (!d.window?.start || !d.window?.end) throw new Error(`engagement: ${d.family} has no two-sided window`);
  const w = [cond("AddressType", "EQ", "To"), cond("CreatedAt", "GTE", d.window.start), cond("CreatedAt", "LT", d.window.end)];
  if (d.programs) w.push(cond("AdvancedOutreachId", "IN", d.programs));
  if (d.cls === "internal") w.push(cond("ToAddress", "ENDS_WITH", suffix(d.domain)));
  if (d.cls === "external") for (const dom of d.domains) w.push(cond("ToAddress", "DOES_NOT_CONTAINS", suffix(dom)));
  for (const p of d.partition ?? []) w.push(cond(p.field, p.op, p.value));
  return w;
}
// One lookup per call (F-473): a call that counts through two lookups drops the
// sends that lack either one, so each distinct count is asked on its own.
const uniqueShow = (d) => [distinct(d.of === "accounts" ? PATH.company : PATH.person)];
const noCompany = () => cond("GsCompanyId", "IS_NULL");
// Survey figures leave out test participants, as the UI's program analytics
// does (F-474). EQ on a boolean is the filter shape measured on this object
// (Responded EQ true); a row whose flag is null would be left out with the tests.
const notTest = () => cond("TestParticipant", "EQ", false);

// family → {object, how it may be split, the query}. `split` is the order a
// truncated or twice-timed-out unit is cut in; uniques are distinct counts, so
// they are never cut inside a month, and a whole-window count never by time.
const FAMILIES = {
  // The program totals: every send, through no lookup. Which programs have
  // sends, and what the template table must sum to, are read from this.
  totals: { object: LOG, split: ["programs", "day"], query: (d) => ({ group: [{ name: "SourceId" }, byMonth("ExecutedDate")], show: [countOf], where: logWhere(d) }) },
  "uniques-month": { object: LOG, split: ["programs", "month"], query: (d) => ({ group: [{ name: "SourceId" }, byMonth("ExecutedDate")], show: uniqueShow(d), where: logWhere(d) }) },
  "uniques-window": { object: LOG, split: ["programs"], query: (d) => ({ group: [{ name: "SourceId" }], show: uniqueShow(d), where: logWhere(d) }) },
  "sent-since": { object: LOG, split: ["programs", "day"], query: (d) => ({ group: [{ name: "SourceId" }], show: [countOf], where: logWhere(d) }) },
  classes: { object: LOG, split: ["day"], query: (d) => ({ group: [{ name: "Source" }, { name: "AddressType" }], show: [countOf], where: logWhere(d, { source: false }) }) },
  template: {
    object: LOG, split: ["programs", "day", "flags", "address"], flags: ["IsOpened", "IsSent"],
    query: (d) => ({
      group: [{ name: "SourceId" }, { name: "EmailTemplateId" }, { name: "EmailTemplateName" }, byMonth("ExecutedDate"), ...LOG_FLAGS.map((name) => ({ name }))],
      show: [countOf], where: logWhere(d),
    }),
  },
  account: {
    object: LOG, split: ["programs", "day", "flags", "address"], flags: ["IsOpened", "IsSent"],
    query: (d) => ({ group: [{ name: "SourceId" }, PATH.company, byMonth("ExecutedDate"), ...LOG_FLAGS.map((name) => ({ name }))], show: [countOf], where: logWhere(d) }),
  },
  // The sends with no company link, which the account call above never returns.
  "account-nolink": {
    object: LOG, split: ["programs", "day", "flags", "address"], flags: ["IsOpened", "IsSent"],
    query: (d) => ({ group: [{ name: "SourceId" }, byMonth("ExecutedDate"), ...LOG_FLAGS.map((name) => ({ name }))], show: [countOf], where: [...logWhere(d), noCompany()] }),
  },
  // Clicked sends, twice: who and when (grouped, so the month is the server's
  // bucket like every other fact), and what was clicked (plain rows, the one
  // shape LinkClickedJson is known to come back in). Joined on the row's Gsid.
  // The count is of a field the query does not group by: COUNT of Gsid beside
  // a group on Gsid is dropped by the CLI, which then refuses the call (F-471).
  "click-attr": {
    object: LOG, split: ["programs", "day", "address"],
    query: (d) => ({ group: [{ name: "SourceId" }, { name: "EmailTemplateId" }, byMonth("ExecutedDate"), PATH.company, { name: "Gsid" }], show: [{ name: "LinkClickedCount", aggregation: "COUNT" }], where: [...logWhere(d), cond("LinkClickedCount", "GT", 0)] }),
  },
  "click-attr-nolink": {
    object: LOG, split: ["programs", "day", "address"],
    query: (d) => ({ group: [{ name: "SourceId" }, { name: "EmailTemplateId" }, byMonth("ExecutedDate"), { name: "Gsid" }], show: [{ name: "LinkClickedCount", aggregation: "COUNT" }], where: [...logWhere(d), cond("LinkClickedCount", "GT", 0), noCompany()] }),
  },
  "click-json": {
    object: LOG, split: ["programs", "day", "address"], sanitize: "clicks",
    query: (d) => ({ group: [], show: [{ name: "Gsid" }, { name: "LinkClickedJson" }], where: [...logWhere(d), cond("LinkClickedCount", "GT", 0)] }),
  },
  "resp-month": {
    object: SURVEY, split: ["day"],
    query: (d) => ({
      group: [PATH.surveyProgram, byMonth("RespondedDate"), { name: "ResponseStatus" }], show: [countOf],
      where: [cond("Responded", "EQ", true), notTest(), cond("RespondedDate", "GTE", d.window.start), cond("RespondedDate", "LT", d.window.end)],
    }),
  },
  "resp-participants": { object: SURVEY, split: [], query: () => ({ group: [PATH.surveyProgram], show: [countOf], where: [notTest()] }) },
  // The test participants left out, per program: an honesty count.
  "resp-test": { object: SURVEY, split: [], query: () => ({ group: [PATH.surveyProgram], show: [countOf], where: [cond("TestParticipant", "EQ", true)] }) },
  // Survey rows no program owns: the calls above go through the participant
  // lookup, so they never return these.
  "resp-unattributed": { object: SURVEY, split: [], query: () => ({ group: [], show: [countOf], where: [cond("AOParticipantId", "IS_NULL")] }) },
  // All time, like the denominator above: resp-month's query without its month
  // bucket and its window, so the two count a response the same way.
  "resp-total": { object: SURVEY, split: [], query: () => ({ group: [PATH.surveyProgram, { name: "ResponseStatus" }], show: [countOf], where: [cond("Responded", "EQ", true), notTest()] }) },
  "account-names": { object: COMPANY, split: ["keys"], query: (d) => ({ group: [], show: [{ name: "Gsid" }, { name: "Name" }], where: [cond("Gsid", "IN", d.keys)] }) },
  // Step detail only (R21): the JO send log, windowed on CreatedAt.
  step: {
    object: JO_LOG, split: ["programs", "day", "flags", "address"], flags: ["EmailOpened", "EmailSend"], boolFlags: true,
    query: (d) => ({
      group: [{ name: "AdvancedOutreachId" }, { name: "StepId" }, { name: "EmailTemplateId" }, { name: "EmailTemplateVarianceId" }, { name: "EmailTemplateVarianceName" }, byMonth("CreatedAt"), ...JO_FLAGS.map((name) => ({ name }))],
      show: [countOf], where: joWhere(d),
    }),
  },
  "step-click": {
    object: JO_LOG, split: ["programs", "day", "address"],
    query: (d) => ({ group: [{ name: "AdvancedOutreachId" }, { name: "StepId" }, { name: "EmailTemplateVarianceId" }, PATH.logRow], show: [countOf], where: [...joWhere(d), cond("EmailClicked", "EQ", true)] }),
  },
  "participants-month": { object: JO_LOG, split: ["programs", "month"], query: (d) => ({ group: [{ name: "AdvancedOutreachId" }, byMonth("CreatedAt")], show: [distinct(PATH.participant)], where: joWhere(d) }) },
  "participants-window": { object: JO_LOG, split: ["programs"], query: (d) => ({ group: [{ name: "AdvancedOutreachId" }], show: [distinct(PATH.participant)], where: joWhere(d) }) },
};

export function buildQuery(d) {
  const fam = FAMILIES[d.family];
  if (!fam) throw new Error(`engagement: unknown call family "${d.family}"`);
  return { object: fam.object, ...fam.query(d) };
}

/**
 * The ONE builder of `rp run` argv: --page-size is always passed, because
 * without it the CLI returns 50 rows and says nothing.
 * @param {{object: string, show: Array<*>, group: Array<*>, where: Array<*>}} q
 * @param {number} pageSize
 * @returns {string[]}
 */
export function rpRunArgv(q, pageSize) {
  const argv = ["--json", "rp", "run", "--object", q.object, "--show-fields", JSON.stringify(q.show)];
  if (q.group.length) argv.push("--group-by", JSON.stringify(q.group));
  if (q.where.length) argv.push("--where-filters", JSON.stringify({ conditions: q.where }));
  argv.push("--page-size", String(pageSize));
  return argv;
}

// How the CLI keys a field when it compares show fields with group-by fields:
// object and field name, nothing else. A lookup path is keyed by the object
// its last hop lands on and its leaf; an aggregation or a date bucket keeps
// the key of the field under it.
const fieldKey = (object, e) => (e.fieldPath ? `${e.fieldPath.hops[e.fieldPath.hops.length - 1].to}::${e.fieldPath.leaf}` : `${object}::${e.name}`);
/**
 * Every field a query names must exist (an unknown filter field is dropped
 * silently, widening the query), nothing may group or aggregate on a
 * LOOKUP by name (it resolves to an empty name and collapses the groups), and
 * nothing may be shown that is also grouped by (the CLI drops that show field,
 * whatever its aggregation, and refuses the call when none is left).
 * @param {{object: string, show: Array<*>, group: Array<*>, where: Array<*>}} q
 * @param {Map<string, string>} types fieldName → dataType, from `rp schema`
 * @returns {string[]} problems; empty when the query is safe to run
 */
export function validateQuery(q, types) {
  const problems = [];
  const need = (name, role) => {
    if (!types.has(name)) problems.push(`${q.object}.${name} (${role}) is not in the object's schema`);
  };
  for (const c of q.where) need(c.leftOperand.fieldName, "filter");
  for (const [role, entries] of /** @type {Array<[string, Array<*>]>} */ ([["group-by", q.group], ["show", q.show]])) {
    for (const e of entries) {
      if (e.fieldPath) {
        for (const h of e.fieldPath.hops) need(h.through, `${role} lookup hop`);
        continue;
      }
      need(e.name, role);
      if (types.get(e.name) === "LOOKUP" && (role === "group-by" || e.aggregation))
        problems.push(`${q.object}.${e.name} is a LOOKUP and may not be grouped or aggregated by name — use a fieldPath to the target's Gsid`);
    }
  }
  const grouped = new Set(q.group.map((e) => fieldKey(q.object, e)));
  for (const e of q.show) {
    if (grouped.has(fieldKey(q.object, e)))
      problems.push(`${fieldKey(q.object, e).replace("::", ".")} is shown and grouped by — the CLI drops a show field that a group-by field names, whatever its aggregation; show a field the query does not group by`);
  }
  return problems;
}

/** `rp schema` payload → fieldName → dataType, or null when the object has no schema. */
export function schemaTypes(payload) {
  const fields = payload?.data?.fields;
  if (!Array.isArray(fields) || !fields.length) return null;
  return new Map(fields.filter((f) => f && typeof f.fieldName === "string").map((f) => [f.fieldName, String(f.dataType ?? "")]));
}

function unitArgv(d, pageSize) {
  if (d.family === "whoami") return ["whoami"];
  if (d.family === "programs") return ["--json", "jo", "p", "list", "--limit", "1000", "--page", String(d.page)];
  if (d.family === "schema") return ["--json", "rp", "schema", "--object", d.object];
  if (d.family === "describe") return ["--json", "jo", "p", "describe", "--id", d.programId];
  return rpRunArgv(buildQuery(d), pageSize);
}
const unitId = (d, argv) => `${d.family}-${createHash("sha1").update(JSON.stringify(argv)).digest("hex").slice(0, 12)}`;

/**
 * Cut a unit that came back full, or timed out twice, into smaller ones.
 * Returns null when nothing is left to cut on.
 * @param {*} d a unit descriptor
 * @returns {?Array<*>}
 */
export function splitUnit(d) {
  const fam = FAMILIES[d.family];
  for (const how of fam?.split ?? []) {
    if (how === "programs" && d.programs && d.programs.length > 1) {
      const mid = Math.ceil(d.programs.length / 2);
      return [{ ...d, programs: d.programs.slice(0, mid) }, { ...d, programs: d.programs.slice(mid) }];
    }
    if (how === "keys" && d.keys && d.keys.length > 1) {
      const mid = Math.ceil(d.keys.length / 2);
      return [{ ...d, keys: d.keys.slice(0, mid) }, { ...d, keys: d.keys.slice(mid) }];
    }
    if (how === "day" && d.window && daysBetween(d.window.start, d.window.end) > 1) {
      const mid = addDays(d.window.start, Math.floor(daysBetween(d.window.start, d.window.end) / 2));
      return [{ ...d, window: { start: d.window.start, end: mid } }, { ...d, window: { start: mid, end: d.window.end } }];
    }
    if (how === "month" && d.window) {
      // On a month boundary only: a distinct count cut inside a month is wrong.
      const months = monthsBetween(d.window.start.slice(0, 7), addDays(d.window.end, -1).slice(0, 7));
      if (months.length > 1 && d.window.start.endsWith("-01")) {
        const mid = monthStart(months[Math.ceil(months.length / 2)]);
        return [{ ...d, window: { start: d.window.start, end: mid } }, { ...d, window: { start: mid, end: d.window.end } }];
      }
    }
    if (how === "flags") {
      const field = fam.flags[(d.partition ?? []).length];
      if (field) {
        const yes = fam.boolFlags ? true : "YES";
        const rest = fam.boolFlags ? { field, op: "EQ", value: false } : { field, op: "NE", value: "YES" }; // NE keeps nulls
        return [{ ...d, partition: [...(d.partition ?? []), { field, op: "EQ", value: yes }] }, { ...d, partition: [...(d.partition ?? []), rest] }];
      }
    }
    if (how === "address") {
      const field = ADDRESS_FIELD[fam.object];
      const cut = ADDRESS_CUTS[(d.partition ?? []).filter((p) => p.field === field).length];
      if (field && cut) return [{ ...d, partition: [...(d.partition ?? []), { field, op: "CONTAINS", value: cut }] }, { ...d, partition: [...(d.partition ?? []), { field, op: "DOES_NOT_CONTAINS", value: cut }] }];
    }
  }
  return null;
}

// ── The read-only gate ───────────────────────────────────────────────────────
class EngagementRefusal extends Error {}
/**
 * (argv) → null when the command may run, else why not. Built on the shared
 * gate (doc-lib assertReadOnlyCommand): unresolved, catalog-mutating,
 * ask-override, read-shape and write-endpoint checks, in that order.
 * @param {{catalog: *, hooksDir: string}} args
 * @returns {(argv: string[]) => ?string}
 */
export function makeGate({ catalog, hooksDir }) {
  const resolver = makeCommandResolver(catalog);
  return (argv) => {
    const { cmd, rest } = resolver.resolveTokens(argv);
    try {
      assertReadOnlyCommand({
        matched: cmd, rest, hooksDir, printable,
        fail: (msg) => { throw new EngagementRefusal(msg); },
        isRead: (_verb, matched) => ENGAGEMENT_READ_PATHS.has(matched?.path),
        shapeNoun: "one of the engagement adapter's reads",
        runsNoun: "the engagement adapter's read-only pulls",
      });
      return null;
    } catch (e) {
      if (e instanceof EngagementRefusal) return e.message;
      throw e;
    }
  };
}

/**
 * The CLI transport: one `gs-admin` process per call, argv array, no shell.
 * @param {{cliArgv: string[], env?: NodeJS.ProcessEnv}} args
 * @returns {EngagementTransport}
 */
export function cliTransport({ cliArgv, env }) {
  return {
    name: "cli",
    concurrency: 1,
    run({ argv, timeoutMs }) {
      const t0 = Date.now();
      const res = spawnSync(cliArgv[0], [...cliArgv.slice(1), ...argv], { encoding: "utf8", timeout: timeoutMs, maxBuffer: 256 * 1024 * 1024, env: env ?? process.env });
      const timedOut = /** @type {NodeJS.ErrnoException | undefined} */ (res.error)?.code === "ETIMEDOUT";
      return {
        ok: !res.error && res.status === 0,
        status: res.status,
        stdout: stripBom(res.stdout ?? ""),
        stderr: String(res.stderr ?? "") + (res.error && !timedOut ? `\n${res.error.message}` : ""),
        timedOut,
        ms: Date.now() - t0,
      };
    },
  };
}

// ── Parameters ───────────────────────────────────────────────────────────────
/**
 * Fill every tunable. The defaults are the plan's (window: the last 12 full
 * months plus the current one; re-pull horizon 2 months; account selection
 * 20 busiest, 15 low-engagement of at least 10 delivered, 15 most bounces).
 * @param {*} raw
 * @returns {*} the params object the run echoes into the snapshot
 */
export function resolveParams(raw) {
  // The local date, like pulledAt: a UTC date is a day ahead every evening west of Greenwich.
  const clock = new Date();
  const today = raw.today ?? `${clock.getFullYear()}-${pad2(clock.getMonth() + 1)}-${pad2(clock.getDate())}`;
  if (!isDay(today)) throw new Error(`--today must be YYYY-MM-DD (got "${today}")`);
  const to = raw.to ?? today.slice(0, 7);
  const from = raw.from ?? addMonths(to, -12);
  if (!isMonth(from) || !isMonth(to) || from > to) throw new Error(`the window must be --from YYYY-MM --to YYYY-MM with from <= to (got ${from}..${to})`);
  const domains = [...new Set((raw.internalDomains ?? []).map((d) => String(d).trim().toLowerCase().replace(/^@/, "")).filter(Boolean))].sort();
  const unsubscribeLinks = [...new Set((raw.unsubscribeLinks ?? []).map((v) => {
    const link = parseUnsubscribeLink(v);
    if (!link) throw new Error(`--unsubscribe-link takes a link or a host (https://www.example.com/page, or links.example.net) — got "${printable(String(v), 80)}"`);
    return link;
  }))].sort();
  const pageSize = raw.pageSize ?? SERVER_PAGE_MAX;
  if (!Number.isInteger(pageSize) || pageSize < 2 || pageSize > SERVER_PAGE_MAX) throw new Error(`--page-size must be 2..${SERVER_PAGE_MAX} (got ${raw.pageSize})`);
  const repullMonths = raw.repullMonths ?? 2;
  if (!Number.isInteger(repullMonths) || repullMonths < 1) throw new Error(`--repull-months must be >= 1 (got ${raw.repullMonths})`);
  let sentSince = null;
  if (raw.sentSince != null) {
    const date = parseSentSince(raw.sentSince, today);
    if (!date) throw new Error(`--sent-since takes a date (YYYY-MM-DD), a day count (90d) or a month count (3m) — got "${raw.sentSince}"`);
    sentSince = { spec: String(raw.sentSince), date };
  }
  const acc = raw.accounts ?? {};
  const whole = (v, dflt, name) => {
    const n = v ?? dflt;
    if (!Number.isInteger(n) || n < 0) throw new Error(`${name} must be a whole number >= 0 (got ${v})`);
    return n;
  };
  const timeoutMs = raw.timeoutMs ?? 300000;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) throw new Error(`--timeout-ms must be a number >= 1000 (got ${raw.timeoutMs})`);
  const incompleteFrom = raw.incompleteFrom ?? monthStart(today.slice(0, 7));
  if (!isDay(incompleteFrom)) throw new Error(`--incomplete-from must be YYYY-MM-DD (got "${incompleteFrom}")`);
  return {
    today,
    window: { from, to, ...{ start: monthStart(from), endExclusive: monthStart(addMonths(to, 1)) } },
    selector: {
      names: [...new Set((raw.names ?? []).map((s) => String(s).trim()).filter(Boolean))],
      ids: [...new Set((raw.ids ?? []).map((s) => String(s).trim()).filter(Boolean))],
      sentSince,
    },
    internalDomains: domains,
    unsubscribeLinks,
    stepDetail: !!raw.stepDetail,
    accounts: {
      busiest: whole(acc.busiest, 20, "--accounts-busiest"),
      lowEngagement: whole(acc.lowEngagement, 15, "--accounts-low"),
      mostBounces: whole(acc.mostBounces, 15, "--accounts-bounce"),
      lowEngagementMinDelivered: whole(acc.lowEngagementMinDelivered, 10, "--accounts-low-min-delivered"),
      pinned: [...new Set((acc.pinned ?? []).map((s) => String(s).trim()).filter(Boolean))].sort(),
      names: acc.names !== false,
      // The account grain: off unless asked for (it is most of a pull's calls).
      pull: acc.pull === true,
    },
    incompleteFrom,
    repullMonths,
    forceFull: !!raw.forceFull,
    pageSize,
    timeoutMs,
    tokenMarginSeconds: raw.tokenMarginSeconds ?? 30,
    pulledAt: raw.pulledAt ?? localIsoWithOffset(new Date()),
    timeZone: raw.pulledAt ? raw.timeZone ?? null : raw.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
  };
}

/** A file of ids, one per line. Another tool may have written it with CRLF. */
export function parseIdList(text) {
  return stripBom(String(text)).split("\n").map((l) => l.replace(/\r$/, "").trim()).filter(Boolean);
}

// ── Program selection and the refresh decision (shared by fetch and reduce) ──
/** The pages of jo p list → id → program. */
export function listedPrograms(pages) {
  const out = new Map();
  for (const page of pages) {
    const rows = page?.data?.advancedOutreaches;
    for (const p of Array.isArray(rows) ? rows : []) {
      const id = str(p?.advancedOutreachId);
      if (!id) continue;
      const st = p.advancedOutreachStatus;
      out.set(id, {
        id, name: str(p.advancedOutreachName),
        statuses: (Array.isArray(st) ? st : [st]).filter((s) => typeof s === "string" && s),
        model: str(p.advancedOutreachModel), modelName: str(p.advancedOutreachModelName),
        audienceType: str(p.advancedOutreachType), supergroup: null, group: null, folderId: str(p.folderId),
      });
    }
  }
  return out;
}
/** A jo p describe payload → the same program fields; describe carries the status as a string. */
export function describedProgram(payload) {
  const ao = payload?.data?.advancedOutreach;
  if (!ao || typeof ao !== "object") return null;
  const st = ao.advancedOutreachStatus;
  return {
    id: str(ao.advancedOutreachId), name: str(ao.advancedOutreachName),
    statuses: (Array.isArray(st) ? st : [st]).filter((s) => typeof s === "string" && s),
    model: str(ao.advancedOutreachModel), modelName: str(ao.advancedOutreachModelName),
    audienceType: str(ao.advancedOutreachType), supergroup: null, group: null, folderId: str(ao.folderId),
  };
}

/** Whether jo p list has a page after this one, by its envelope. */
export function listHasMore(payload, page) {
  const data = payload?.data ?? {};
  const rows = Array.isArray(data.advancedOutreaches) ? data.advancedOutreaches.length : 0;
  return !(!rows || data.lastPage === true || (typeof data.totalPages === "number" && page >= data.totalPages));
}

/** program × month attempts and distinct counts, from the cheap tenant-wide call. */
function readBase(units, stats) {
  const base = new Map();
  for (const u of units) {
    if (u.family !== "totals" || u.cls !== "all") continue;
    for (const row of u.rows) {
      stats.seen++;
      const { programId, month, n } = ROW_READERS.totals(row);
      if (programId == null || month == null || n == null) { stats.unreadable++; continue; }
      stats.parsed++;
      const k = JSON.stringify([programId, month]);
      // A split unit's leaves each carry part of a program-month.
      base.set(k, { programId, month, sent: (base.get(k)?.sent ?? 0) + n, accounts: null });
    }
  }
  // Distinct accounts per program-month, for the row estimates only.
  for (const u of units) {
    if (u.family !== "uniques-month" || u.cls !== "all" || u.of !== "accounts") continue;
    for (const row of u.rows) {
      const r = ROW_READERS["uniques-month"](row);
      const b = base.get(JSON.stringify([r.programId, r.month]));
      if (b) b.accounts = r.accounts;
    }
  }
  return base;
}

/**
 * Which programs are in the pull. Status never limits it (R23): every program
 * with sends in the window that the selector picks is in. An id with sends
 * that `jo p list` lacks is described once it is seen; "not found" twice means
 * deleted (excluded and counted), and a program the list merely missed is in.
 * @returns {{selected: Map<string, *>, deleted: Set<string>, pendingDescribes: string[], unselected: Set<string>}}
 */
export function decidePrograms({ listed, base, describes, selector, sentSinceIds }) {
  const withSends = new Set([...base.values()].filter((b) => b.sent > 0).map((b) => b.programId));
  const wantNames = new Set(selector.names.map(termKey));
  const wantIds = new Set(selector.ids);
  const picks = (p) =>
    (!wantNames.size && !wantIds.size ? true : wantIds.has(p.id) || (p.name != null && wantNames.has(termKey(p.name)))) &&
    (!selector.sentSince || sentSinceIds.has(p.id));
  const selected = new Map();
  const deleted = new Set();
  const unselected = new Set();
  const pendingDescribes = [];
  for (const id of [...withSends].sort(cmpKey)) {
    let program = listed.get(id);
    if (!program) {
      const d = describes.get(id);
      if (d === undefined) { pendingDescribes.push(id); continue; }
      if (d === null) { deleted.add(id); continue; }
      program = d;
    }
    if (picks(program)) selected.set(id, program);
    else unselected.add(id);
  }
  return { selected, deleted, pendingDescribes, unselected };
}

const sameList = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Clicks are classified at fetch time, so everything a snapshot says about
// clicks (the clicked counts and each template's click history) was decided
// under the unsubscribe links it was pulled with.
/**
 * Why a previous snapshot can never be continued from, or null when it can.
 * The ONE statement of it: decideRefresh gives it as the reason for a full
 * refresh, and usablePrevious withholds the snapshot from every other read.
 * @param {T10Snapshot} previous
 * @param {string} tenantHost
 * @returns {?string}
 */
function unusableWhy(previous, tenantHost) {
  // A snapshot from before the reconciliation checks carried drift counted
  // Delivered differently and held no send without a company link: its months
  // cannot sit beside this build's. (Only snapshots made before T-10 froze.)
  if ((previous.reconciliation?.checks ?? []).some((c) => !("drift" in c))) return "the previous snapshot was built under earlier metric definitions";
  if (previous.meta?.tenantHost !== tenantHost) return "the previous snapshot is another tenant's";
  return null;
}
/**
 * The previous snapshot as this pull may read it: this tenant's, built under
 * the current definitions, or nothing. Fetch and reduce read the previous
 * snapshot ONLY through this, so what a refresh could never carry facts from
 * gives it no click history, no name and no account selection either, on a
 * full refresh as on a selective one.
 * @param {?T10Snapshot} previous
 * @param {string} tenantHost
 * @returns {?T10Snapshot}
 */
export const usablePrevious = (previous, tenantHost) => (previous && !unusableWhy(previous, tenantHost) ? previous : null);
// The account selection as decideRefresh compares it: names are a display
// choice, and the switch itself is compared through the snapshot's marker.
const accountSelection = (a) => {
  const { names: _n, pull: _p, ...rest } = a ?? {};
  return rest;
};
const sameUnsubscribeLinks = (previous, params) => sameList(previous?.meta?.params?.unsubscribeLinks ?? [], params.unsubscribeLinks ?? []);
/**
 * Full or selective. Selective needs a previous snapshot that the new pull
 * can extend without re-deriving anything: same tenant, same class split, same
 * unsubscribe links, same step-detail switch, same account selection, and a
 * window that reaches back at least as far. Months on or after the earlier of (the re-pull horizon's
 * first month, the month the previous snapshot was pulled in) are re-pulled;
 * older ones are carried, for the programs the previous snapshot already held.
 * @returns {{mode: "full"|"selective", why: string, pulledMonths: string[], carriedMonths: string[], carriedPrograms: Set<string>, previousPulledAt: ?string}}
 */
export function decideRefresh({ params, previous, tenantHost, selectedIds }) {
  const months = monthsBetween(params.window.from, params.window.to);
  // previousPulledAt names the pull this one continues from: none, when the snapshot given cannot be continued from.
  const full = (why) => ({ mode: /** @type {"full"} */ ("full"), why, pulledMonths: months, carriedMonths: [], carriedPrograms: new Set(), previousPulledAt: usablePrevious(previous, tenantHost)?.meta?.pulledAt ?? null });
  if (params.forceFull) return full("a full refresh was asked for");
  if (!previous) return full("no previous snapshot");
  const pm = previous.meta;
  const pp = pm.params ?? {};
  const unusable = unusableWhy(previous, tenantHost);
  if (unusable) return full(unusable);
  if (!sameList(pp.internalDomains ?? [], params.internalDomains)) return full("the internal domains changed");
  if (!sameUnsubscribeLinks(previous, params)) return full("the unsubscribe links changed");
  if (!!pm.stepDetail !== params.stepDetail) return full("the step-detail switch changed");
  // An account table is whole or absent: its rows are never carried beside months that have none.
  if (accountAvailability(previous).pulled !== params.accounts.pull)
    return full(params.accounts.pull ? "accounts were switched on and the previous snapshot holds none, so every table is pulled again" : "accounts were switched off, so every table is pulled again without them");
  if (params.accounts.pull && !sameList(accountSelection(pp.accounts), accountSelection(params.accounts))) return full("the account selection changed");
  if (pm.window.from > params.window.from) return full("the previous snapshot's window starts later than this one");
  const horizonStart = addMonths(params.window.to, -(params.repullMonths - 1));
  const prevPulledMonth = String(pm.pulledAt).slice(0, 7);
  const firstPulled = [horizonStart, prevPulledMonth, params.window.to].sort()[0];
  const carriedMonths = months.filter((m) => m < firstPulled);
  if (!carriedMonths.length) return full("no month is older than the re-pull horizon");
  const prevIds = new Set((previous.dimensions?.programs ?? []).map((p) => p.id));
  return {
    mode: "selective", why: `months before ${firstPulled} are carried from the snapshot pulled ${pm.pulledAt}`,
    pulledMonths: months.filter((m) => m >= firstPulled), carriedMonths,
    carriedPrograms: new Set(selectedIds.filter((id) => prevIds.has(id))), previousPulledAt: pm.pulledAt,
  };
}

/**
 * R24, per program over its pulled months: the busiest accounts by sends, the
 * lowest open rates among accounts with enough delivered, the most bounce
 * events, and every pinned account. An account picked twice takes one slot.
 * @param {Map<string, {sent: number, delivered: number, opened: number, bounced: number}>} perAccount
 * @param {{busiest: number, lowEngagement: number, mostBounces: number, lowEngagementMinDelivered: number, pinned: string[]}} rules
 * @returns {Set<string>}
 */
export function selectAccounts(perAccount, rules) {
  const rows = [...perAccount].map(([key, m]) => ({ key, ...m }));
  const top = (list, cmp, n) => list.sort((a, b) => cmp(a, b) || cmpKey(a.key, b.key)).slice(0, n).map((r) => r.key);
  const picked = new Set([
    ...top([...rows], (a, b) => b.sent - a.sent, rules.busiest),
    ...top(rows.filter((r) => r.delivered >= rules.lowEngagementMinDelivered && r.delivered > 0), (a, b) => a.opened / a.delivered - b.opened / b.delivered || b.delivered - a.delivered, rules.lowEngagement),
    ...top(rows.filter((r) => r.bounced > 0), (a, b) => b.bounced - a.bounced, rules.mostBounces),
  ]);
  for (const key of rules.pinned) if (perAccount.has(key)) picked.add(key);
  return picked;
}

// ── The plan: which units a run makes ────────────────────────────────────────
function batches(ids, size = IN_BATCH) {
  const out = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}
// Programs packed so one call's rows stay under the page. The estimate is the
// program-month's distinct accounts times a few flag combinations, never more
// than its attempts; a pack that still comes back full is split by fetch.
function packByRows(items, pageSize) {
  const cap = Math.max(1, Math.floor(pageSize * 0.8));
  const out = [];
  let cur = [];
  let rows = 0;
  for (const it of items) {
    if (cur.length && (rows + it.est > cap || cur.length >= IN_BATCH)) { out.push(cur); cur = []; rows = 0; }
    cur.push(it.id);
    rows += it.est;
  }
  if (cur.length) out.push(cur);
  return out;
}

/**
 * Every fact unit of a run, derived from the base call and the refresh
 * decision. Pure: the same inputs give the same list, which is what makes a
 * run resumable (a unit's id is a hash of its argv).
 * @returns {Array<*>} unit descriptors
 */
export function planUnits({ params, base, selectedIds, refresh, surveyAvailable }) {
  const units = [];
  const whole = monthWindow(params.window.from, params.window.to);
  const isFull = refresh.mode === "full";
  const fullPrograms = selectedIds.filter((id) => !refresh.carriedPrograms.has(id));
  const pulled = refresh.pulledMonths;
  const pulledSpan = monthWindow(pulled[0], pulled[pulled.length - 1]);
  const oldMonths = isFull ? [] : refresh.carriedMonths;
  const oldSpan = oldMonths.length ? monthWindow(oldMonths[0], oldMonths[oldMonths.length - 1]) : null;
  // Small families cover the whole window whenever any program needs its old
  // months; reduce keeps only the months each program is pulled for.
  const smallSpan = isFull || fullPrograms.length ? whole : pulledSpan;
  const domains = params.internalDomains;
  const sentIn = (id, m) => base.get(JSON.stringify([id, m]))?.sent ?? 0;

  units.push({ family: "uniques-month", cls: "all", of: "people", window: whole });
  for (const of of ["people", "accounts"]) units.push({ family: "uniques-window", cls: "all", of, window: whole });
  units.push({ family: "classes", cls: "all", window: smallSpan });
  for (const of of domains.length ? ["people", "accounts"] : []) {
    units.push({ family: "uniques-window", cls: "external", of, domains, window: whole });
    units.push({ family: "uniques-month", cls: "external", of, domains, window: smallSpan });
  }
  // Template grain: tenant-wide, one call per pulled month; old months only
  // for the programs the previous snapshot did not hold.
  for (const m of pulled) units.push({ family: "template", cls: "all", window: monthWindow(m, m) });
  if (!isFull && oldSpan) for (const b of batches(fullPrograms)) units.push({ family: "template", cls: "all", window: oldSpan, programs: b });
  // Account grain: batched by program, month by month.
  const accountMonth = (m, ids) => {
    const items = ids.filter((id) => sentIn(id, m) > 0).map((id) => {
      const b = base.get(JSON.stringify([id, m]));
      return { id, est: Math.min(b.sent, Math.max(1, b.accounts ?? b.sent) * 4) };
    });
    for (const b of packByRows(items, params.pageSize)) units.push({ family: "account", cls: "all", window: monthWindow(m, m), programs: b });
  };
  const accounts = params.accounts.pull;
  if (accounts) {
    for (const m of pulled) accountMonth(m, selectedIds);
    for (const m of oldMonths) accountMonth(m, fullPrograms);
    units.push({ family: "account-nolink", cls: "all", window: smallSpan });
  }
  units.push({ family: "click-attr", cls: "all", window: smallSpan });
  units.push({ family: "click-attr-nolink", cls: "all", window: smallSpan });
  units.push({ family: "click-json", cls: "all", window: smallSpan });
  for (const domain of domains) {
    units.push({ family: "template", cls: "internal", domain, window: smallSpan });
    if (accounts) {
      units.push({ family: "account", cls: "internal", domain, window: smallSpan });
      units.push({ family: "account-nolink", cls: "internal", domain, window: smallSpan });
    }
    units.push({ family: "click-attr", cls: "internal", domain, window: smallSpan });
    units.push({ family: "click-attr-nolink", cls: "internal", domain, window: smallSpan });
  }
  if (surveyAvailable) {
    units.push({ family: "resp-month", cls: "all", window: smallSpan });
    units.push({ family: "resp-participants", cls: "all" });
    units.push({ family: "resp-total", cls: "all" });
    units.push({ family: "resp-unattributed", cls: "all" });
    units.push({ family: "resp-test", cls: "all" });
  }
  if (params.stepDetail) {
    const stepMonth = (m, ids) => {
      for (const b of batches(ids.filter((id) => sentIn(id, m) > 0))) units.push({ family: "step", cls: "all", window: monthWindow(m, m), programs: b });
    };
    for (const m of pulled) stepMonth(m, selectedIds);
    for (const m of oldMonths) stepMonth(m, fullPrograms);
    const spanUnits = (ids, span) => {
      for (const b of batches(ids)) {
        units.push({ family: "step-click", cls: "all", window: span, programs: b });
        units.push({ family: "participants-month", cls: "all", window: span, programs: b });
        for (const domain of domains) units.push({ family: "step", cls: "internal", domain, window: span, programs: b });
        if (domains.length) units.push({ family: "participants-month", cls: "external", domains, window: span, programs: b });
      }
    };
    spanUnits(selectedIds, pulledSpan);
    if (oldSpan) spanUnits(fullPrograms, oldSpan);
    for (const b of batches(selectedIds)) {
      units.push({ family: "participants-window", cls: "all", window: whole, programs: b });
      if (domains.length) units.push({ family: "participants-window", cls: "external", domains, window: whole, programs: b });
    }
  }
  return units;
}

// Seconds per call, by family: medians measured on CLI 1.0.10, rounded up. An
// estimate, printed as one; the token check before each call is what decides.
const CALL_SECONDS = { whoami: 1, programs: 2, schema: 2, describe: 3, "uniques-month": 13, "uniques-window": 23, "account-names": 4 };
/**
 * How many calls a planned unit is expected to take. One, unless its rows will
 * not fit a page: an account-grain unit holding a program-month that reaches
 * more accounts than a page is split until every leaf fits, and each split
 * costs the call that came back full. The tree is priced from the cheap
 * tenant-wide call: about one row and a half per account reached (never more
 * rows than sends), leaves half a page full, two calls per leaf, and two more
 * for every rung the ladder climbs before the address cut (the window halved
 * down to one day, then the two flags), as when the sends sit on one day.
 * Measured against four real pulls, this lands within 2x of the calls made.
 * @param {*} u a planned unit
 * @param {Map<string, {sent: number, accounts: ?number}>} base
 * @param {number} pageSize
 * @returns {number}
 */
export function expectedCalls(u, base, pageSize) {
  if (u.family !== "account" || u.cls !== "all" || !u.programs) return 1;
  const month = u.window.start.slice(0, 7);
  const rungs = Math.ceil(Math.log2(Math.max(2, daysBetween(u.window.start, u.window.end)))) + 2;
  let calls = 0;
  let fits = false;
  for (const id of u.programs) {
    const b = base.get(JSON.stringify([id, month]));
    const rows = b ? Math.min(b.sent, Math.ceil(Math.max(1, b.accounts ?? b.sent) * 1.5)) : 0;
    if (rows >= pageSize) calls += 1 + 2 * rungs + 2 * Math.ceil(rows / (pageSize / 2));
    else fits = true;
  }
  return calls + (fits || !calls ? 1 : 0);
}
const priced = (units, base, pageSize) => units.map((u) => ({ family: u.family, calls: expectedCalls(u, base, pageSize) }));
export const estimateCalls = (units, base, pageSize) => priced(units, base, pageSize).reduce((s, u) => s + u.calls, 0);
export const estimateSeconds = (units, base, pageSize) => priced(units, base, pageSize).reduce((s, u) => s + u.calls * (CALL_SECONDS[u.family] ?? 7), 0);
const familyCounts = (units, base, pageSize) => {
  const out = {};
  for (const u of priced(units, base, pageSize)) out[u.family] = (out[u.family] ?? 0) + u.calls;
  return out;
};

// ── Fetch ────────────────────────────────────────────────────────────────────
function readFetchLog(runDir) {
  const records = new Map();
  let unreadable = 0;
  const path = join(runDir, "fetch-log.jsonl");
  if (!existsSync(path)) return { records, unreadable };
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line);
      records.set(rec.id, rec);
    } catch {
      unreadable++; // a torn last line from an interrupted run: that call is simply re-made
    }
  }
  return { records, unreadable };
}

const TEXT_FAMILIES = new Set(["whoami"]);
const isRpRun = (d) => d.family in FAMILIES;

/**
 * Run the calls. One at a time; each answer goes to its own file under
 * `<runDir>/calls/`, and a call whose file is already there is not made again.
 * Stops cleanly (status "token-expired") when the next call would outlast the
 * token or the CLI says the token died; the run directory stays resumable.
 * @param {{params: *, runDir: string, transport: EngagementTransport, gate: (argv: string[]) => ?string, kbDir?: ?string, previous?: ?T10Snapshot, phase?: "plan"|"all", now?: () => number, onCall?: (line: string) => void}} ctx
 * @returns {*} the fetch summary (also written to `<runDir>/status.json`)
 */
export function fetchEngagement(ctx) {
  const { params, runDir, transport, gate, kbDir = null, previous: given = null, phase = "all", now = Date.now, onCall = () => {} } = ctx;
  mkdirSync(join(runDir, "calls"), { recursive: true });
  const { records } = readFetchLog(runDir);
  const logPath = join(runDir, "fetch-log.jsonl");
  const counts = { made: 0, reused: 0, split: 0, retried: 0 };
  const failed = [];
  /** @type {?{reason: string, detail: string}} */
  let stop = null;
  let deadline = null;
  const record = (rec) => {
    appendFileSync(logPath, JSON.stringify(rec) + "\n");
    records.set(rec.id, rec);
    return rec;
  };
  const types = new Map(); // object → Map(field → type) | null

  const execute = (d, id, argv) => {
    const refusal = gate(argv);
    if (refusal) throw new EngagementRefusal(refusal);
    if (isRpRun(d)) {
      const problems = validateQuery(buildQuery(d), types.get(FAMILIES[d.family].object) ?? new Map());
      if (problems.length) throw new EngagementRefusal(`refusing to run the ${d.family} query: ${problems.join("; ")}`);
    }
    for (let attempt = 1; ; attempt++) {
      if (deadline != null && now() + params.tokenMarginSeconds * 1000 > deadline) {
        stop = { reason: "token-expired", detail: "the token would expire before the next call returns" };
        return null;
      }
      const r = transport.run({ id, argv, timeoutMs: params.timeoutMs });
      counts.made++;
      onCall(`${id} ${r.ok ? "ok" : "failed"} (${r.ms} ms)`);
      // Non-empty stderr is not a failure: the CLI warns there and exits 0.
      if (r.ok) {
        const file = `calls/${id}.${TEXT_FAMILIES.has(d.family) ? "txt" : "json"}`;
        if (TEXT_FAMILIES.has(d.family)) {
          writeFileAtomicSync(join(runDir, file), r.stdout);
          return record({ ...d, id, status: "ok", file, attempt });
        }
        let payload;
        try {
          payload = JSON.parse(r.stdout);
        } catch {
          failed.push({ id, family: d.family, kind: "unparseable" });
          record({ ...d, id, status: "failed", kind: "unparseable", attempt });
          return null;
        }
        const rows = Array.isArray(payload) ? payload.length : null;
        // As long as the page: the server cut it and said nothing.
        const truncated = isRpRun(d) && rows != null && rows >= params.pageSize;
        if (FAMILIES[d.family]?.sanitize === "clicks" && Array.isArray(payload)) {
          payload = payload.map((row) => ROW_READERS["click-json"](row, params.unsubscribeLinks));
        }
        writeFileAtomicSync(join(runDir, file), JSON.stringify(payload));
        return record({ ...d, id, status: "ok", file, rows, truncated, attempt, ...(r.stderr.trim() ? { warning: printable(r.stderr, 200) } : {}) });
      }
      const kind = classifyFailure(r);
      if (kind === "auth-expired") {
        stop = { reason: "token-expired", detail: "the CLI reported the token expired" };
        return null;
      }
      // Once more, on its own, before anything is concluded from it.
      if (attempt === 1 && (kind === "timeout" || kind === "outage" || kind === "not-found")) { counts.retried++; continue; }
      if (kind === "timeout") return record({ ...d, id, status: "split", kind, attempt });
      if (kind === "not-found" && d.family === "describe") {
        const file = `calls/${id}.json`;
        writeFileAtomicSync(join(runDir, file), JSON.stringify({ notFound: true }));
        return record({ ...d, id, status: "ok", file, notFound: true, attempt });
      }
      const failure = { id, family: d.family, kind: kind === "outage" ? "shape-error" : kind, stderr: printable(r.stderr, 300) };
      failed.push(failure);
      record({ ...d, ...failure, status: "failed", attempt });
      return null;
    }
  };

  /** Run one unit, splitting as needed. Returns the ok, complete leaf records. */
  const runUnit = (d) => {
    if (stop) return [];
    const argv = unitArgv(d, params.pageSize);
    const id = unitId(d, argv);
    const prior = records.get(id);
    let rec;
    if (prior && ((prior.status === "ok" && existsSync(join(runDir, prior.file))) || prior.status === "split")) {
      counts.reused++;
      rec = prior;
    } else rec = execute(d, id, argv);
    if (!rec) return [];
    if (rec.status === "ok" && !rec.truncated) return [rec];
    const kids = splitUnit(d);
    if (!kids) {
      const failure = { id, family: d.family, kind: rec.truncated ? "truncated" : "timeout", stderr: "nothing left to split on" };
      failed.push(failure);
      return [];
    }
    counts.split++;
    return kids.flatMap(runUnit);
  };
  const load = (rec) => (rec.file.endsWith(".txt") ? readFileSync(join(runDir, rec.file), "utf8") : readJsonFile(join(runDir, rec.file)));
  const rowsOf = (recs) => recs.map((rec) => ({ ...rec, rows: load(rec) }));
  const conclude = (extra) => {
    const status = stop ? stop.reason : failed.length ? "partial" : "ok";
    const summary = { status, ...(stop ? { stopped: stop.detail } : {}), calls: counts, failed, ...extra };
    writeFileAtomicSync(join(runDir, "status.json"), JSON.stringify({ status, phase, failed, calls: counts }, null, 2));
    return summary;
  };

  // Phase A: the token, the program list, the schemas, the cheap base call.
  const who = runUnit({ family: "whoami" });
  if (!who.length) return conclude({});
  const whoami = parseWhoami(load(who[0]));
  if (whoami.tokenState !== "valid") {
    stop = { reason: "token-expired", detail: `whoami reports the token as ${whoami.tokenState} — run \`gs-admin login\`, then re-run to resume` };
    return conclude({ whoami });
  }
  // The deadline counts from when whoami was READ, so a resumed run re-reads it.
  if (records.get(who[0].id) && counts.made === 0) {
    const fresh = execute({ family: "whoami" }, who[0].id, ["whoami"]);
    if (!fresh) return conclude({ whoami });
    Object.assign(whoami, parseWhoami(load(fresh)));
    if (whoami.tokenState !== "valid") {
      stop = { reason: "token-expired", detail: `whoami reports the token as ${whoami.tokenState} — run \`gs-admin login\`, then re-run to resume` };
      return conclude({ whoami });
    }
  }
  deadline = now() + whoami.expiresInSeconds * 1000;
  if (!whoami.host) throw new EngagementRefusal("whoami shows no Base URL — the CLI has no tenant selected");
  let kbHost = null;
  if (kbDir) {
    const warnings = [];
    try {
      kbHost = new URL(readKbIdentity(kbDir, warnings).baseUrl).host.toLowerCase();
    } catch { /* an unreadable manifest: nothing to compare against */ }
    if (kbHost && kbHost !== whoami.host)
      throw new EngagementRefusal(`the KB at ${kbDir} belongs to ${kbHost} but the CLI is on ${whoami.host} — switch tenants or pass the matching --kb`);
  }

  const pages = [];
  for (let page = 1; !stop; page++) {
    if (page > MAX_LIST_PAGES) throw new EngagementRefusal(`jo p list was still returning rows after ${MAX_LIST_PAGES} pages — its paging envelope (lastPage / totalPages) is not being read; refusing to page on`);
    const got = runUnit({ family: "programs", page });
    if (!got.length) break;
    const payload = load(got[0]);
    pages.push(payload);
    if (!listHasMore(payload, page)) break;
  }
  const objects = [LOG, SURVEY, ...(params.stepDetail ? [JO_LOG] : []), ...(params.accounts.pull && params.accounts.names ? [COMPANY] : [])];
  for (const object of objects) {
    const got = runUnit({ family: "schema", object });
    if (got.length) types.set(object, schemaTypes(load(got[0])));
  }
  if (stop || failed.length) return conclude({ whoami });
  if (!types.get(LOG)) throw new EngagementRefusal(`${LOG} has no schema on this tenant — the delivery log cannot be read`);
  if (params.stepDetail && !types.get(JO_LOG)) throw new EngagementRefusal(`${JO_LOG} has no schema on this tenant — step detail cannot be pulled`);
  const surveyAvailable = !!types.get(SURVEY);

  const whole = monthWindow(params.window.from, params.window.to);
  const baseUnits = [
    ...rowsOf(runUnit({ family: "totals", cls: "all", window: whole })),
    ...(stop ? [] : rowsOf(runUnit({ family: "uniques-month", cls: "all", of: "accounts", window: whole }))),
  ];
  let sentSinceIds = new Set();
  if (params.selector.sentSince && !stop) {
    const since = rowsOf(runUnit({ family: "sent-since", cls: "all", window: { start: params.selector.sentSince.date, end: addDays(params.today, 1) } }));
    sentSinceIds = new Set(since.flatMap((u) => u.rows.map((row) => ROW_READERS["sent-since"](row).programId)).filter(Boolean));
  }
  if (stop || failed.length) return conclude({ whoami });

  // Phase B: an id with sends that the list lacks is described before it is
  // called deleted (and re-checked once, by the retry in execute).
  const base = readBase(baseUnits, { seen: 0, parsed: 0, unreadable: 0 });
  const listed = listedPrograms(pages);
  const describes = new Map();
  let decision = decidePrograms({ listed, base, describes, selector: params.selector, sentSinceIds });
  for (const id of decision.pendingDescribes) {
    const got = runUnit({ family: "describe", programId: id });
    if (!got.length) break;
    describes.set(id, got[0].notFound ? null : describedProgram(load(got[0])));
  }
  if (stop || failed.length) return conclude({ whoami });
  decision = decidePrograms({ listed, base, describes, selector: params.selector, sentSinceIds });
  const selectedIds = [...decision.selected.keys()];
  const refresh = decideRefresh({ params, previous: given, tenantHost: whoami.host, selectedIds });
  const previous = usablePrevious(given, whoami.host);
  const units = planUnits({ params, base, selectedIds, refresh, surveyAvailable });

  // The estimates plan prints: this run, a full one, and what step detail and the account grain each add.
  const fullUnits = refresh.mode === "full" ? units : planUnits({ params, base, selectedIds, refresh: decideRefresh({ params, previous: null, tenantHost: whoami.host, selectedIds }), surveyAvailable });
  const without = planUnits({ params: { ...params, stepDetail: false }, base, selectedIds, refresh, surveyAvailable });
  const withStep = planUnits({ params: { ...params, stepDetail: true }, base, selectedIds, refresh, surveyAvailable });
  // The account grain's cost: this run's plan without it, against the plan WITH it. Turning it on over a
  // previous snapshot that holds none is a full refresh, so that side is planned under the refresh it would get.
  const withAccounts = { ...params, accounts: { ...params.accounts, pull: true } };
  const accountsOff = planUnits({ params: { ...params, accounts: { ...params.accounts, pull: false } }, base, selectedIds, refresh, surveyAvailable });
  const accountsOn = planUnits({ params: withAccounts, base, selectedIds, refresh: decideRefresh({ params: withAccounts, previous: given, tenantHost: whoami.host, selectedIds }), surveyAvailable });
  // Calls and seconds include the splits a program-month too large for a page will force.
  const calls = (list) => estimateCalls(list, base, params.pageSize);
  const seconds = (list) => estimateSeconds(list, base, params.pageSize);
  const estimate = {
    mode: refresh.mode, why: refresh.why,
    thisRun: { calls: calls(units), seconds: seconds(units), units: units.length, byFamily: familyCounts(units, base, params.pageSize) },
    full: { calls: calls(fullUnits), seconds: seconds(fullUnits) },
    stepDetail: { on: params.stepDetail, addsCalls: calls(withStep) - calls(without), addsSeconds: seconds(withStep) - seconds(without) },
    // What the account grain costs, printed whether it is on or off (its name lookups are not counted: how many depends on the selection).
    accounts: { on: params.accounts.pull, addsCalls: calls(accountsOn) - calls(accountsOff), addsSeconds: seconds(accountsOn) - seconds(accountsOff) },
    token: { expiresInSeconds: whoami.expiresInSeconds, fits: seconds(units) + params.tokenMarginSeconds <= whoami.expiresInSeconds },
  };
  const programs = { listed: listed.size, selected: selectedIds.length, deleted: decision.deleted.size, unselected: decision.unselected.size };
  writeFileAtomicSync(join(runDir, "plan.json"), JSON.stringify({ estimate, programs, refresh: { ...refresh, carriedPrograms: [...refresh.carriedPrograms] } }, null, 2));
  if (kbDir && !existsSync(join(runDir, "kb-steps.json"))) writeFileAtomicSync(join(runDir, "kb-steps.json"), JSON.stringify(readKbSteps(kbDir)));
  if (phase === "plan") return conclude({ whoami, estimate, programs });

  // Phase C: the facts.
  const accountRecs = [];
  for (const d of units) {
    const got = runUnit(d);
    if (d.family === "account" && d.cls === "all") accountRecs.push(...got);
    if (stop) break;
  }
  if (stop || failed.length) return conclude({ whoami, estimate, programs });

  // Phase D: names for the accounts the selection keeps, and no others.
  if (params.accounts.names && types.get(COMPANY)) {
    const keys = selectedAccountKeys({ params, units: rowsOf(accountRecs), selected: decision.selected, refresh, previous });
    const nameFailures = failed.length;
    for (const b of batches(keys, NAME_BATCH)) {
      runUnit({ family: "account-names", cls: "all", keys: b });
      if (stop) break;
    }
    // A name that could not be read is a blank name, never a failed pull.
    failed.splice(nameFailures);
  }
  return conclude({ whoami, estimate, programs });
}

// Step names and order per program, from the KB's program docs through the one
// parser of that payload (jo-report). Only email steps are kept.
function readKbSteps(kbDir) {
  const { index, warnings } = buildIndex({ kbDir });
  const programs = {};
  for (const p of Object.values(index.programs)) {
    if (p.depth !== "full") continue;
    programs[p.id] = p.steps
      .filter((s) => s.emailTemplateId != null || s.variantTemplateIds.length)
      .map((s) => ({ stepId: str(s.stepId), stepName: s.stepName ?? null, order: typeof s.order === "number" ? s.order : null, templateIds: [...new Set([s.emailTemplateId, ...s.variantTemplateIds].filter(Boolean))] }));
  }
  return { source: "kb", programs, warnings: warnings.length };
}

// ── Reduce ───────────────────────────────────────────────────────────────────
const zero = () => ({ sent: 0, delivered: 0, bounced: 0, rejected: 0, unsubscribed: 0, spamComplaints: 0, opened: 0, clicked: 0 });
const anyNonZero = (m) => SEND_MEASURES.some((k) => m[k] !== 0);
function addFlags(m, n, f) {
  m.sent += n;
  if (f.delivered) m.delivered += n;
  if (f.bounced) m.bounced += n;
  if (f.rejected) m.rejected += n;
  if (f.unsubscribed) m.unsubscribed += n;
  if (f.spam) m.spamComplaints += n;
  if (f.opened) m.opened += n;
}
// A table keyed by a JSON array, each entry holding the all-recipients and
// internal-recipients measures; external is derived (the measures are additive).
const cellOf = (table, key) => {
  const k = JSON.stringify(key);
  let e = table.get(k);
  if (!e) table.set(k, (e = { key, all: zero(), internal: zero() }));
  return e;
};

/** account → its measures over a program's pulled months, from account-grain units. */
function accountTotals(units, accept) {
  const perProgram = new Map();
  for (const u of units) {
    if (u.family !== "account" || u.cls !== "all") continue;
    for (const row of u.rows) {
      const { programId: p, month: m, n, accountKey: account, flags } = ROW_READERS.account(row);
      if (p == null || m == null || n == null || account == null || !accept(p, m)) continue;
      if (!perProgram.has(p)) perProgram.set(p, new Map());
      const acc = perProgram.get(p);
      if (!acc.has(account)) acc.set(account, zero());
      addFlags(acc.get(account), n, flags);
    }
  }
  return perProgram;
}
const previousSelection = (previous) => {
  const out = new Map();
  for (const r of previous?.facts?.byAccount ?? []) {
    if (r.bucket !== "account") continue;
    if (!out.has(r.programId)) out.set(r.programId, new Set());
    out.get(r.programId).add(r.accountKey);
  }
  return out;
};
// The selection per program. A program carried from the previous snapshot
// keeps the accounts that snapshot selected, so each one's row series stays
// whole across carried and pulled months; ranking is redone on a full pull.
function selectionFor({ params, units, selected, refresh, previous }) {
  const windowMonths = new Set(monthsBetween(params.window.from, params.window.to));
  const pulled = new Set(refresh.pulledMonths);
  const accept = (p, m) => selected.has(p) && (refresh.carriedPrograms.has(p) ? pulled.has(m) : windowMonths.has(m));
  const totals = accountTotals(units, accept);
  const prev = previousSelection(previous);
  const out = new Map();
  for (const p of selected.keys()) {
    const acc = totals.get(p) ?? new Map();
    if (refresh.carriedPrograms.has(p)) out.set(p, new Set([...(prev.get(p) ?? []), ...params.accounts.pinned.filter((k) => acc.has(k))]));
    else out.set(p, selectAccounts(acc, params.accounts));
  }
  return out;
}
function selectedAccountKeys(args) {
  const all = new Set();
  for (const set of selectionFor(args).values()) for (const k of set) all.add(k);
  return [...all].sort(cmpKey);
}

/**
 * R19, per template. Click history decides first; then the link-settings
 * reading; with neither, unknown. Zero clicks alone decide nothing.
 * @param {{everClicked: boolean, reading: ?string}} e
 * @returns {TrackingState}
 */
export function decideClickState({ everClicked, reading }) {
  if (everClicked) return "tracked";
  if (reading === "tracked-link-present") return "tracked";
  if (reading === "links-none-tracked") return "not-tracked";
  return "unknown";
}

/**
 * Fetched payloads → the T-10 snapshot. Pure: no clock, no file, no call.
 * @param {{params: *, whoami: *, programPages: Array<*>, describes: Map<string, *>, units: Array<*>, kbSteps?: *, previous?: ?T10Snapshot, linkSettings?: *, surveyAvailable: boolean, calls?: *, cliVersion?: ?string, pluginVersion?: ?string}} input
 * @returns {T10Snapshot}
 */
export function reduceEngagement(input) {
  const { params, whoami, programPages, describes, units, kbSteps = null, previous: given = null, linkSettings = null, surveyAvailable, calls = {}, cliVersion = null, pluginVersion = null } = input;
  const pulledAt = params.pulledAt;
  const windowMonths = monthsBetween(params.window.from, params.window.to);
  const inWindow = new Set(windowMonths);
  const rowStats = { seen: 0, parsed: 0, unreadable: 0 };
  const of = (family, cls) => units.filter((u) => u.family === family && (cls == null || u.cls === cls));

  // Programs and the refresh decision — the same functions fetch planned with.
  const listed = listedPrograms(programPages);
  const base = readBase(units, rowStats);
  const sentSinceIds = new Set(of("sent-since").flatMap((u) => u.rows.map((row) => ROW_READERS["sent-since"](row).programId)).filter(Boolean));
  const decision = decidePrograms({ listed, base, describes, selector: params.selector, sentSinceIds });
  if (decision.pendingDescribes.length) throw new Error(`engagement reduce: ${decision.pendingDescribes.length} program id(s) with sends were never described — the fetch is incomplete`);
  const { selected, deleted, unselected } = decision;
  const refresh = decideRefresh({ params, previous: given, tenantHost: whoami.host, selectedIds: [...selected.keys()] });
  // From here on the previous snapshot is this tenant's own history, or nothing.
  const previous = usablePrevious(given, whoami.host);
  const pulledSet = new Set(refresh.pulledMonths);
  const carriedSet = new Set(refresh.carriedMonths);
  const pulledFor = (p) => (refresh.carriedPrograms.has(p) ? pulledSet : inWindow);
  const accept = (p, m) => selected.has(p) && pulledFor(p).has(m);

  // ── Template grain ──
  const excluded = { ccCopies: 0, nonJoSources: 0, deletedPrograms: { programs: deleted.size, sent: 0 }, unselectedPrograms: { programs: unselected.size, sent: 0 } };
  const tplTable = new Map();
  const tplNames = new Map(); // templateId → Map(name → sends)
  let noTemplateSent = 0;
  for (const u of of("template")) {
    for (const row of u.rows) {
      rowStats.seen++;
      const { programId: p, month: m, n, templateId: t, templateName: name, flags } = ROW_READERS.template(row);
      if (p == null || m == null || n == null) { rowStats.unreadable++; continue; }
      rowStats.parsed++;
      if (!accept(p, m)) {
        if (u.cls === "all" && inWindow.has(m)) {
          if (deleted.has(p)) excluded.deletedPrograms.sent += n;
          else if (unselected.has(p)) excluded.unselectedPrograms.sent += n;
        }
        continue;
      }
      addFlags(cellOf(tplTable, [p, t, m])[u.cls === "internal" ? "internal" : "all"], n, flags);
      if (u.cls !== "all") continue;
      if (t == null) noTemplateSent += n;
      else {
        if (!tplNames.has(t)) tplNames.set(t, new Map());
        if (name) tplNames.get(t).set(name, (tplNames.get(t).get(name) ?? 0) + n);
      }
    }
  }

  // ── Account grain ──
  const accTable = new Map();
  for (const u of of("account")) {
    for (const row of u.rows) {
      rowStats.seen++;
      const { programId: p, month: m, n, accountKey, flags } = ROW_READERS.account(row);
      if (p == null || m == null || n == null) { rowStats.unreadable++; continue; }
      rowStats.parsed++;
      if (!accept(p, m)) continue;
      addFlags(cellOf(accTable, [p, accountKey, m])[u.cls === "internal" ? "internal" : "all"], n, flags);
    }
  }

  // The sends with no company link: their own bucket, from their own calls.
  for (const u of of("account-nolink")) {
    for (const row of u.rows) {
      rowStats.seen++;
      const { programId: p, month: m, n, flags } = ROW_READERS["account-nolink"](row);
      if (p == null || m == null || n == null) { rowStats.unreadable++; continue; }
      rowStats.parsed++;
      if (!accept(p, m)) continue;
      addFlags(cellOf(accTable, [p, null, m])[u.cls === "internal" ? "internal" : "all"], n, flags);
    }
  }

  // ── Clicks: who and when, joined to what was clicked, on the send's id ──
  const linksById = new Map();
  for (const u of of("click-json")) for (const r of u.rows) if (r?.id != null) linksById.set(r.id, r);
  const clicks = { clickedSends: 0, withContentClick: 0, nonContentOnly: 0, unreadable: 0, detailMissing: 0, byUnsubscribeInput: 0 };
  const sendMonth = new Map(); // send id → [programId, templateId, month, account], for step detail
  const internalSends = new Set();
  // A clicked send is in exactly one of the two families: with a company link, or without.
  const clickFamilies = ["click-attr", "click-attr-nolink"];
  for (const family of clickFamilies) for (const u of of(family, "internal")) for (const row of u.rows) internalSends.add(ROW_READERS[family](row).sendId);
  for (const u of clickFamilies.flatMap((family) => of(family, "all"))) {
    for (const row of u.rows) {
      const { programId: p, month: m, sendId: id, templateId: t, accountKey: account = null } = ROW_READERS[u.family](row);
      if (p == null || m == null || id == null || !accept(p, m)) continue;
      clicks.clickedSends++;
      const links = linksById.get(id);
      if (!links) { clicks.detailMissing++; continue; }
      if (links.unreadable) { clicks.unreadable++; continue; }
      if (links.byInput) clicks.byUnsubscribeInput++;
      if (!links.content) { clicks.nonContentOnly++; continue; }
      clicks.withContentClick++;
      sendMonth.set(id, [p, t, m, account]);
      const slots = internalSends.has(id) ? ["all", "internal"] : ["all"];
      for (const s of slots) {
        cellOf(tplTable, [p, t, m])[s].clicked += 1;
        if (params.accounts.pull) cellOf(accTable, [p, account, m])[s].clicked += 1;
      }
    }
  }

  // ── Rows, with the class split ──
  const deficits = [];
  const provenance = { provenance: /** @type {RowProvenance} */ ("pulled"), pulledAt };
  const emit = (table, fields) => {
    const rows = [];
    for (const e of table.values()) {
      const ext = zero();
      for (const k of SEND_MEASURES) {
        ext[k] = e.all[k] - e.internal[k];
        if (ext[k] < 0) { deficits.push({ key: e.key, month: e.key[e.key.length - 1], measure: k, left: e.internal[k], right: e.all[k] }); ext[k] = 0; }
      }
      if (anyNonZero(e.internal)) rows.push({ ...fields(e.key), recipientClass: "internal", ...e.internal, ...provenance });
      if (anyNonZero(ext)) rows.push({ ...fields(e.key), recipientClass: "external", ...ext, ...provenance });
    }
    return rows;
  };
  const carried = (rows) => (rows ?? []).filter((r) => refresh.carriedPrograms.has(r.programId) && carriedSet.has(r.month)).map((r) => ({ ...r, provenance: "carried" }));
  const byKeys = (...keys) => (a, b) => {
    for (const k of keys) {
      const c = cmpKey(a[k] ?? "", b[k] ?? "");
      if (c) return c;
    }
    return 0;
  };

  const byTemplate = [...emit(tplTable, ([programId, templateId, month]) => ({ programId, templateId, month })), ...carried(previous?.facts?.byTemplate)]
    .sort(byKeys("programId", "month", "templateId", "recipientClass"));

  const selection = selectionFor({ params, units, selected, refresh, previous });
  const bucketTable = new Map();
  for (const e of accTable.values()) {
    const [p, account, m] = e.key;
    const bucket = account == null ? "no-company-link" : selection.get(p)?.has(account) ? "account" : "other";
    const target = cellOf(bucketTable, [p, bucket, bucket === "account" ? account : null, m]);
    for (const k of SEND_MEASURES) { target.all[k] += e.all[k]; target.internal[k] += e.internal[k]; }
  }
  const byAccount = [...emit(bucketTable, ([programId, bucket, accountKey, month]) => ({ programId, bucket, accountKey, month })), ...carried(previous?.facts?.byAccount)]
    .sort(byKeys("programId", "month", "bucket", "accountKey", "recipientClass"));

  // ── Step grain (step detail only) ──
  let byStep = null;
  const stepSeen = new Map();
  if (params.stepDetail) {
    const stepTable = new Map();
    for (const u of of("step")) {
      for (const row of u.rows) {
        rowStats.seen++;
        const { programId: p, month: m, n, stepId, variantId, variantName, templateId, flags } = ROW_READERS.step(row);
        if (p == null || m == null || n == null) { rowStats.unreadable++; continue; }
        rowStats.parsed++;
        if (!accept(p, m)) continue;
        addFlags(cellOf(stepTable, [p, stepId, variantId, templateId, m])[u.cls === "internal" ? "internal" : "all"], n, flags);
        if (u.cls === "all") stepSeen.set(JSON.stringify([p, stepId, variantId]), { programId: p, stepId, variantId, templateId, variantName });
      }
    }
    for (const u of of("step-click")) {
      for (const row of u.rows) {
        const { sendId: send, stepId, variantId } = ROW_READERS["step-click"](row);
        const hit = sendMonth.get(send);
        if (!hit) continue; // not a content click, or outside the program's pulled months
        const [p, t, m] = hit;
        for (const s of internalSends.has(send) ? ["all", "internal"] : ["all"]) cellOf(stepTable, [p, stepId, variantId, t, m])[s].clicked += 1;
      }
    }
    byStep = [...emit(stepTable, ([programId, stepId, variantId, templateId, month]) => ({ programId, stepId, variantId, templateId, month })), ...carried(previous?.facts?.byStep)]
      .sort(byKeys("programId", "month", "stepId", "variantId", "recipientClass"));
  }

  // ── Uniques: exact per program, never additive ──
  const noDomains = !params.internalDomains.length;
  const uniqueCounts = (family, cls, monthly) => {
    const out = new Map();
    for (const u of of(family, cls)) {
      for (const row of u.rows) {
        const r = ROW_READERS[family](row);
        if (r.programId == null || (monthly && r.month == null)) continue;
        // One call per lookup: each fills its own count for the program.
        const k = JSON.stringify([r.programId, monthly ? r.month : null]);
        out.set(k, { ...out.get(k), ...Object.fromEntries(Object.entries(r).filter(([, v]) => v != null)) });
      }
    }
    return out;
  };
  const both = (family, monthly) => ({ all: uniqueCounts(family, "all", monthly), ext: uniqueCounts(family, "external", monthly) });
  // A program none of whose sends has the link is in no row of that call: 0.
  const logCounts = (r) => ({ people: r?.people ?? 0, accounts: r?.accounts ?? 0 });
  const partCount = (map, key) => (params.stepDetail ? map.get(key)?.participants ?? 0 : null);
  const uniques = [];
  const uw = both("uniques-window", false);
  const um = both("uniques-month", true);
  const pw = both("participants-window", false);
  const pmn = both("participants-month", true);
  const uniqueRow = (programId, scope, month, log, part) => {
    const key = JSON.stringify([programId, month]);
    const all = { ...logCounts(log.all.get(key)), participantRecords: partCount(part.all, key) };
    // With no internal domain declared, nobody is known to be internal.
    const external = noDomains ? { ...all } : { ...logCounts(log.ext.get(key)), participantRecords: partCount(part.ext, key) };
    return { programId, scope, month, ...all, external, ...provenance };
  };
  for (const p of selected.keys()) {
    uniques.push(uniqueRow(p, "window", null, uw, pw));
    for (const m of windowMonths) if (pulledFor(p).has(m) && (base.get(JSON.stringify([p, m]))?.sent ?? 0) > 0) uniques.push(uniqueRow(p, "month", m, um, pmn));
  }
  uniques.push(...carried((previous?.facts?.uniques ?? []).filter((r) => r.scope === "month")));
  uniques.sort(byKeys("programId", "scope", "month"));

  // ── Responses ──
  const respTable = new Map();
  const respStats = { otherStatus: 0, unattributed: 0, testParticipantsExcluded: 0 };
  for (const u of of("resp-month")) {
    for (const row of u.rows) {
      const { programId: p, month: m, status, n: count } = ROW_READERS["resp-month"](row);
      const n = count ?? 0;
      if (p == null || m == null || !accept(p, m)) continue;
      const k = JSON.stringify([p, m]);
      if (!respTable.has(k)) respTable.set(k, { programId: p, month: m, submitted: 0, partiallySubmitted: 0, ...provenance });
      if (status === "Submitted") respTable.get(k).submitted += n;
      else if (status === "Partially Submitted") respTable.get(k).partiallySubmitted += n;
      else respStats.otherStatus += n;
    }
  }
  const responses = [...respTable.values(), ...carried(previous?.facts?.responses)].sort(byKeys("programId", "month"));
  const participantsByProgram = new Map();
  for (const u of of("resp-participants")) {
    for (const row of u.rows) {
      const { programId: p, n: count } = ROW_READERS["resp-participants"](row);
      const n = count ?? 0;
      // A participant that names no program: its lookup is set, its program is
      // not. Unattributed too, beside the rows with no participant at all.
      if (p == null) respStats.unattributed += n;
      else if (selected.has(p)) participantsByProgram.set(p, n);
    }
  }
  for (const u of of("resp-unattributed")) for (const row of u.rows) respStats.unattributed += ROW_READERS["resp-unattributed"](row).n ?? 0;
  for (const u of of("resp-test")) {
    for (const row of u.rows) {
      const { programId: p, n } = ROW_READERS["resp-test"](row);
      if (p != null && selected.has(p)) respStats.testParticipantsExcluded += n ?? 0;
    }
  }
  // The same program's Submitted and Partially submitted, all time: with the
  // denominator they are the response rate's one basis.
  const totalsByProgram = new Map();
  for (const u of of("resp-total")) {
    for (const row of u.rows) {
      const { programId: p, status, n: count } = ROW_READERS["resp-total"](row);
      if (p == null || !selected.has(p)) continue;
      if (!totalsByProgram.has(p)) totalsByProgram.set(p, { submitted: 0, partiallySubmitted: 0 });
      if (status === "Submitted") totalsByProgram.get(p).submitted += count ?? 0;
      else if (status === "Partially Submitted") totalsByProgram.get(p).partiallySubmitted += count ?? 0;
    }
  }
  const responseParticipants = [...participantsByProgram]
    .map(([programId, participants]) => ({ programId, participants, submitted: totalsByProgram.get(programId)?.submitted ?? 0, partiallySubmitted: totalsByProgram.get(programId)?.partiallySubmitted ?? 0 }))
    .sort(byKeys("programId"));

  // ── Availability of the optional metrics ──
  // Click history carries from the previous snapshot only when it was
  // classified under the same unsubscribe links as this pull.
  const prevClick = (sameUnsubscribeLinks(previous, params) ? previous?.meta?.metricAvailability?.clicks?.templates : null) ?? {};
  const history = new Map();
  for (const r of byTemplate) {
    if (r.templateId == null) continue;
    if (!history.has(r.templateId)) history.set(r.templateId, { everClicked: false, firstMonth: null, lastMonth: null });
    if (r.clicked > 0) {
      const h = history.get(r.templateId);
      h.everClicked = true;
      h.firstMonth = h.firstMonth == null || r.month < h.firstMonth ? r.month : h.firstMonth;
      h.lastMonth = h.lastMonth == null || r.month > h.lastMonth ? r.month : h.lastMonth;
    }
  }
  const clickTemplates = {};
  for (const [t, h] of [...history].sort((a, b) => cmpKey(a[0], b[0]))) {
    // A click the previous snapshot saw still counts after its month has left the window.
    const was = prevClick[t]?.evidence?.clickHistory;
    if (was?.everClicked) {
      h.everClicked = true;
      h.firstMonth = [h.firstMonth, was.firstMonth].filter(Boolean).sort()[0] ?? null;
      h.lastMonth = [h.lastMonth, was.lastMonth].filter(Boolean).sort().pop() ?? null;
    }
    const ls = linkSettings?.[t] ?? null;
    const reading = ["tracked-link-present", "links-none-tracked", "unreadable"].includes(ls?.reading) ? ls.reading : null;
    clickTemplates[t] = { state: decideClickState({ everClicked: h.everClicked, reading }), evidence: { clickHistory: h, linkSettings: reading ? { reading, asOf: ls.asOf ?? null } : null } };
  }
  const clickPrograms = {};
  const responsePrograms = {};
  for (const p of [...selected.keys()].sort(cmpKey)) {
    const tally = { tracked: 0, notTracked: 0, unknown: 0 };
    for (const t of new Set(byTemplate.filter((r) => r.programId === p).map((r) => r.templateId))) {
      const state = t == null ? "unknown" : clickTemplates[t].state;
      tally[state === "tracked" ? "tracked" : state === "not-tracked" ? "notTracked" : "unknown"]++;
    }
    const counted = tally.tracked + tally.notTracked + tally.unknown;
    clickPrograms[p] = { state: counted && tally.tracked === counted ? "tracked" : counted && tally.notTracked === counted ? "not-tracked" : "unknown", templates: tally };
    // A program with survey participants sent a survey, so a 0 is a real 0.
    // None, on a readable object, means it sent no survey. An unreadable
    // object decides nothing.
    const n = surveyAvailable ? participantsByProgram.get(p) ?? 0 : null;
    responsePrograms[p] = { state: n == null ? "unknown" : n > 0 ? "tracked" : "not-tracked", evidence: { surveyParticipants: n } };
  }

  // ── Reconciliation, over the pulled months ──
  const pulledOnly = (rows) => rows.filter((r) => r.provenance === "pulled");
  const sumBy = (rows, keyOf) => {
    const out = new Map();
    for (const r of rows) {
      const k = JSON.stringify(keyOf(r));
      if (!out.has(k)) out.set(k, zero());
      for (const m of SEND_MEASURES) out.get(k)[m] += r[m];
    }
    return out;
  };
  // A month on or after incompleteFrom is still being written while the calls
  // are made, so a difference there is drift, reported with its size; a
  // difference in a closed month is a failure.
  const incompleteMonth = params.incompleteFrom.slice(0, 7);
  const check = (id, pairs, compared = pairs.length) => {
    const bad = pairs.filter((p) => p.left !== p.right);
    const closed = bad.filter((p) => p.month < incompleteMonth);
    const drift = bad.filter((p) => p.month >= incompleteMonth);
    const shown = (list) => list.slice(0, 10).map(({ month: _m, ...rest }) => rest);
    return { id, ok: !closed.length, compared, mismatches: closed.length, examples: shown(closed), drift: drift.length, driftExamples: shown(drift) };
  };
  const tplByPm = sumBy(pulledOnly(byTemplate), (r) => [r.programId, r.month]);
  const accByPm = sumBy(pulledOnly(byAccount), (r) => [r.programId, r.month]);
  const checks = [
    check("templates-sum-to-program", [...tplByPm].map(([k, m]) => ({ key: JSON.parse(k), month: JSON.parse(k)[1], measure: "sent", left: m.sent, right: base.get(k)?.sent ?? null }))),
    ...(params.accounts.pull ? [check("accounts-sum-to-program", [...tplByPm].flatMap(([k, m]) => SEND_MEASURES.map((measure) => ({ key: JSON.parse(k), month: JSON.parse(k)[1], measure, left: accByPm.get(k)?.[measure] ?? 0, right: m[measure] }))))] : []),
    check("internal-within-all", deficits, tplTable.size + accTable.size),
    // Within SENT, not delivered: an attempt that went out, was clicked and bounced afterwards is clicked and not delivered.
    check("clicked-within-sent", pulledOnly(byTemplate).map((r) => ({ key: [r.programId, r.templateId, r.month, r.recipientClass], month: r.month, measure: "clicked", left: Math.min(r.clicked, r.sent), right: r.clicked }))),
  ];
  if (byStep) {
    const stepByPtm = sumBy(pulledOnly(byStep), (r) => [r.programId, r.templateId, r.month]);
    const tplByPtm = sumBy(pulledOnly(byTemplate), (r) => [r.programId, r.templateId, r.month]);
    checks.push(check("steps-sum-to-template", [...tplByPtm].flatMap(([k, m]) => ["sent", "delivered", "opened", "bounced"].map((measure) => ({ key: JSON.parse(k), month: JSON.parse(k)[2], measure, left: stepByPtm.get(k)?.[measure] ?? 0, right: m[measure] })))));
  }
  const reconciliation = { ok: checks.every((c) => c.ok), checks };

  // ── Dimensions ──
  const design = kbSteps?.programs ?? {};
  const pickName = (names) => [...(names ?? [])].sort((a, b) => b[1] - a[1] || cmpKey(a[0], b[0]))[0]?.[0] ?? null;
  const prevTemplates = new Map((previous?.dimensions?.templates ?? []).map((t) => [t.id, t]));
  const templateIds = [...new Set(byTemplate.map((r) => r.templateId).filter((t) => t != null))].sort(cmpKey);
  const templates = templateIds.map((id) => ({
    id,
    name: pickName(tplNames.get(id)) ?? prevTemplates.get(id)?.name ?? null,
    uses: [...new Set(byTemplate.filter((r) => r.templateId === id).map((r) => r.programId))].sort(cmpKey).map((programId) => {
      const steps = (design[programId] ?? []).filter((s) => s.templateIds.includes(id));
      const one = steps.length === 1 ? steps[0] : null;
      return { programId, stepName: one?.stepName ?? null, stepOrder: one?.order ?? null, stepCount: steps.length };
    }),
  }));
  const names = new Map((previous?.dimensions?.accounts ?? []).map((a) => [a.key, a.name]));
  let namesResolved = 0;
  for (const u of of("account-names")) {
    for (const row of u.rows) {
      const { key, name } = ROW_READERS["account-names"](row);
      if (key == null) continue;
      names.set(key, name);
      namesResolved++;
    }
  }
  const accountKeys = [...new Set(byAccount.filter((r) => r.bucket === "account").map((r) => r.accountKey))].sort(cmpKey);
  // Steps seen in this pull, over the carried programs' steps from the previous one.
  const stepRows = new Map();
  for (const s of previous?.dimensions?.steps ?? []) if (refresh.carriedPrograms.has(s.programId)) stepRows.set(JSON.stringify([s.programId, s.stepId, s.variantId]), s);
  for (const [k, s] of stepSeen) {
    const d = (design[s.programId] ?? []).find((x) => x.stepId === s.stepId);
    stepRows.set(k, { programId: s.programId, stepId: s.stepId, name: d?.stepName ?? null, order: d?.order ?? null, templateId: s.templateId, variantId: s.variantId, variantName: s.variantName });
  }
  const dimensions = {
    programs: [...selected.values()].sort(byKeys("id")),
    templates,
    ...(params.stepDetail ? { steps: [...stepRows.values()].sort(byKeys("programId", "stepId", "variantId")) } : {}),
    accounts: accountKeys.map((key) => ({ key, name: params.accounts.names ? names.get(key) ?? null : null })),
    months: windowMonths,
  };

  // ── Honesty and this snapshot's own caveats ──
  for (const u of of("classes")) {
    for (const row of u.rows) {
      const { source, addressType, n } = ROW_READERS.classes(row);
      if (source !== JO_SOURCE) excluded.nonJoSources += n ?? 0;
      else if (addressType !== "To") excluded.ccCopies += n ?? 0;
    }
  }
  const withDesign = [...selected.keys()].filter((p) => design[p]).length;
  const honesty = {
    excluded,
    rows: rowStats,
    calls,
    noTemplateId: { sent: noTemplateSent },
    // Counted from the account grain: not known when that grain was not pulled.
    noCompanyLink: { sent: !params.accounts.pull ? null : byAccount.filter((r) => r.bucket === "no-company-link" && r.provenance === "pulled").reduce((s, r) => s + r.sent, 0) },
    stepNames: { source: kbSteps ? "kb" : "none", programsWithDesign: withDesign, programsWithout: selected.size - withDesign },
    accountNames: { requested: params.accounts.names ? accountKeys.length : 0, resolved: namesResolved },
    clicks,
    responses: { available: surveyAvailable, ...respStats },
  };
  const caveats = [];
  if (refresh.mode === "selective") caveats.push({ id: "carried-forward-months", detail: { months: refresh.carriedMonths, repullMonths: params.repullMonths, previousPulledAt: refresh.previousPulledAt } });
  if (deleted.size) caveats.push({ id: "deleted-programs-excluded", detail: excluded.deletedPrograms });
  if (!params.stepDetail) caveats.push({ id: "participant-records-not-pulled", detail: { reason: "step-detail-off" } });
  if (!params.accounts.pull) caveats.push({ id: "accounts-not-pulled", detail: { reason: "accounts-off" } });
  if (noDomains) caveats.push({ id: "recipient-class-not-configured", detail: {} });
  if (selected.size - withDesign) caveats.push({ id: "step-names-unavailable", detail: { programs: selected.size - withDesign, source: kbSteps ? "kb" : "none" } });
  if (!surveyAvailable) caveats.push({ id: "responses-unreadable", detail: { object: SURVEY } });
  if (!reconciliation.ok) caveats.push({ id: "reconciliation-mismatch", detail: { checks: checks.filter((c) => !c.ok).map((c) => c.id) } });
  if (checks.some((c) => c.drift)) caveats.push({ id: "incomplete-period-drift", detail: { from: params.incompleteFrom, checks: checks.filter((c) => c.drift).map((c) => ({ id: c.id, drift: c.drift })) } });

  const facts = { byTemplate, ...(byStep ? { byStep } : {}), byAccount, responses, responseParticipants, uniques };
  return {
    schemaVersion: T10_SCHEMA_VERSION,
    kind: "engagement",
    meta: {
      source: "jo-engagement",
      params: { window: { from: params.window.from, to: params.window.to }, selector: params.selector, internalDomains: params.internalDomains, unsubscribeLinks: params.unsubscribeLinks, stepDetail: params.stepDetail, accounts: params.accounts, repullMonths: params.repullMonths, pageSize: params.pageSize },
      pulledAt,
      timeZone: params.timeZone,
      tenantHost: whoami.host,
      cliVersion,
      pluginVersion,
      window: params.window,
      incompleteFrom: params.incompleteFrom,
      dateBasis: { object: LOG, field: "ExecutedDate", grain: "month", stepDetail: params.stepDetail ? { object: JO_LOG, field: "CreatedAt" } : null },
      stepDetail: params.stepDetail,
      accounts: { pulled: params.accounts.pull, reason: params.accounts.pull ? null : "accounts-off" },
      participantRecords: { pulled: params.stepDetail, reason: params.stepDetail ? null : "step-detail-off" },
      refresh: {
        mode: refresh.mode, why: refresh.why, repullMonths: params.repullMonths, pulledMonths: refresh.pulledMonths, carriedMonths: refresh.carriedMonths,
        carriedPrograms: refresh.carriedPrograms.size, fullPrograms: selected.size - refresh.carriedPrograms.size, previousPulledAt: refresh.previousPulledAt,
      },
      metricAvailability: { clicks: { templates: clickTemplates, programs: clickPrograms }, responses: { programs: responsePrograms } },
    },
    dimensions,
    facts,
    honesty,
    reconciliation,
    caveats,
  };
}

/**
 * The run directory → reduce's input. Refuses a run that did not finish: a
 * snapshot is built from a complete pull or not at all.
 * @param {string} runDir
 * @param {{previous?: ?T10Snapshot, linkSettings?: *, cliVersion?: ?string, pluginVersion?: ?string}} [opts]
 */
export function loadRun(runDir, opts = {}) {
  const status = readJsonFile(join(runDir, "status.json"));
  if (status.status !== "ok" || status.phase !== "all")
    throw new Error(`engagement reduce: the run at ${runDir} is not complete (status ${status.status}, phase ${status.phase}) — re-run fetch to resume it`);
  const { params } = readJsonFile(join(runDir, "run.json"));
  // A run started before the account switch existed pulled the account grain.
  if (params.accounts && params.accounts.pull === undefined) params.accounts.pull = true;
  const { records } = readFetchLog(runDir);
  const ok = [...records.values()].filter((r) => r.status === "ok" && !r.truncated);
  const read = (r) => (r.file.endsWith(".txt") ? readFileSync(join(runDir, r.file), "utf8") : readJsonFile(join(runDir, r.file)));
  const one = (family) => ok.filter((r) => r.family === family);
  const describes = new Map(one("describe").map((r) => [r.programId, r.notFound ? null : describedProgram(read(r))]));
  const kbPath = join(runDir, "kb-steps.json");
  const survey = one("schema").find((r) => r.object === SURVEY);
  return {
    params,
    whoami: parseWhoami(read(one("whoami")[0])),
    programPages: one("programs").sort((a, b) => a.page - b.page).map(read),
    describes,
    units: ok.filter((r) => r.family in FAMILIES).map((r) => ({ ...r, rows: read(r) })),
    kbSteps: existsSync(kbPath) ? readJsonFile(kbPath) : null,
    previous: opts.previous ?? null,
    linkSettings: opts.linkSettings ?? null,
    surveyAvailable: !!(survey && schemaTypes(read(survey))),
    // Counted from the log, so a run resumed three times reads like one that never stopped.
    calls: { answered: ok.length, split: [...records.values()].filter((r) => r.truncated || r.status === "split").length, retried: [...records.values()].filter((r) => r.attempt > 1).length },
    cliVersion: opts.cliVersion ?? null,
    pluginVersion: opts.pluginVersion ?? null,
  };
}

// ── T-10 read floor ──────────────────────────────────────────────────────────
// The accessors every reader of a snapshot goes through until the shared query
// engine (ENG-4) takes them over. A not-tracked metric has NO value here: not
// 0, not the stored count — null.
/**
 * @param {unknown} json a parsed snapshot file
 * @returns {T10Snapshot}
 */
export function openSnapshot(json) {
  const s = /** @type {any} */ (json);
  if (!s || typeof s !== "object" || Array.isArray(s)) throw new Error("engagement snapshot: not an object — refusing to read it (T-10)");
  if (s.schemaVersion !== T10_SCHEMA_VERSION)
    throw new Error(`engagement snapshot: schemaVersion ${JSON.stringify(s.schemaVersion)} is not ${T10_SCHEMA_VERSION} — refusing to read it (T-10); re-pull with this plugin version, or update the plugin`);
  if (s.kind !== "engagement") throw new Error(`engagement snapshot: kind ${JSON.stringify(s.kind)} is not "engagement" — refusing to read it (T-10)`);
  return s;
}
const UNKNOWN_CLICKS = Object.freeze({ state: "unknown", evidence: { clickHistory: { everClicked: false, firstMonth: null, lastMonth: null }, linkSettings: null } });
/** @returns {T10ClickAvailability} a template the snapshot does not list is unknown */
export const clickAvailability = (snapshot, templateId) => snapshot.meta.metricAvailability.clicks.templates[templateId] ?? UNKNOWN_CLICKS;
/**
 * A send row's click count with its tracking state.
 * @param {T10Snapshot} snapshot
 * @param {{templateId: ?string, clicked: number}} row
 * @returns {{state: TrackingState, value: ?number}}
 */
export function readClicked(snapshot, row) {
  const { state } = clickAvailability(snapshot, row.templateId);
  return { state, value: state === "not-tracked" ? null : row.clicked };
}
/**
 * Whether the snapshot holds the account grain, and the reason when it does
 * not. A reader shows the reason wherever account data would be; it never
 * shows the empty table as "no accounts". A snapshot made before the switch
 * existed carries no marker and pulled the grain.
 * @param {T10Snapshot} snapshot
 * @returns {{pulled: boolean, reason: ?"accounts-off"}}
 */
export const accountAvailability = (snapshot) => snapshot.meta.accounts ?? { pulled: true, reason: null };
/** @returns {{state: TrackingState, templates: {tracked: number, notTracked: number, unknown: number}}} */
export const programClickAvailability = (snapshot, programId) =>
  snapshot.meta.metricAvailability.clicks.programs[programId] ?? { state: "unknown", templates: { tracked: 0, notTracked: 0, unknown: 0 } };
/**
 * A program's survey responses with their tracking state: Submitted,
 * Partially submitted and Any response, on ONE basis per call.
 *   no months   basis "all-time": the counts and the denominator, both all
 *               time. This is the only pair a response rate is computed from.
 *   months      basis "months": the counts of those response months, for a
 *               trend or a date filter. participants is null: the denominator
 *               has no month, so these counts never sit beside it.
 * @param {T10Snapshot} snapshot
 * @param {string} programId
 * @param {?string[]} [months] response months to count
 * @returns {{state: TrackingState, basis: "all-time"|"months", submitted: ?number, partiallySubmitted: ?number, anyResponse: ?number, participants: ?number}}
 */
export function readResponses(snapshot, programId, months = null) {
  const state = snapshot.meta.metricAvailability.responses.programs[programId]?.state ?? "unknown";
  /** @type {"all-time"|"months"} */
  const basis = months ? "months" : "all-time";
  const none = { state, basis, submitted: null, partiallySubmitted: null, anyResponse: null, participants: null };
  if (state === "not-tracked") return none;
  if (!months) {
    const all = snapshot.facts.responseParticipants.find((r) => r.programId === programId);
    return all ? { state, basis, submitted: all.submitted, partiallySubmitted: all.partiallySubmitted, anyResponse: all.submitted + all.partiallySubmitted, participants: all.participants } : none;
  }
  const keep = new Set(months);
  const rows = snapshot.facts.responses.filter((r) => r.programId === programId && keep.has(r.month));
  const submitted = rows.reduce((s, r) => s + r.submitted, 0);
  const partiallySubmitted = rows.reduce((s, r) => s + r.partiallySubmitted, 0);
  return { state, basis, submitted, partiallySubmitted, anyResponse: submitted + partiallySubmitted, participants: null };
}

/** @type {EngagementSourceAdapter} */
export const joEngagementAdapter = {
  id: "jo-engagement",
  plan: (ctx) => fetchEngagement({ ...ctx, phase: "plan" }),
  fetch: (ctx) => fetchEngagement({ ...ctx, phase: "all" }),
  reduce: reduceEngagement,
};

// ── CLI ──────────────────────────────────────────────────────────────────────
const USAGE =
  "usage: engagement.mjs <plan|fetch|run> [--workspace <dir>] [--run <id>] [--kb <slugDir>] [--from YYYY-MM --to YYYY-MM] " +
  "[--name <program>]... [--ids-file <file>] [--sent-since <date|Nd|Nm>] [--internal-domain <domain>]... [--unsubscribe-link <link|host>]... [--step-detail] [--accounts] " +
  "[--previous <snapshot.json>] [--full] [--out <snapshot.json>]  |  engagement.mjs reduce --run-dir <dir> --out <snapshot.json> [--previous <file>] [--link-settings <file>]";
const EXIT = { ok: 0, failed: 1, "token-expired": 3, partial: 4 };

async function main() {
  const [mode, ...argv] = process.argv.slice(2);
  const helpers = makeCliHelpers("engagement.mjs", argv);
  const { opt, finish } = helpers;
  /** @type {import("./doc-lib.mjs").FailFn} */
  const fail = helpers.fail;
  if (!["plan", "fetch", "reduce", "run"].includes(mode)) fail(USAGE);
  const all = (name) => argv.flatMap((t, i) => (t === name && argv[i + 1] !== undefined ? [argv[i + 1]] : []));
  const int = (name) => (opt(name) === undefined ? undefined : Number(opt(name)));
  const readSnapshot = (path) => {
    try {
      return openSnapshot(readJsonFile(resolve(path)));
    } catch (e) {
      return fail(`--previous ${path}: ${e instanceof Error ? e.message : e}`);
    }
  };
  let pluginVersion = null;
  try {
    pluginVersion = readJsonFile(join(here, "..", ".claude-plugin", "plugin.json")).version ?? null;
  } catch { /* a copy without its manifest still reduces */ }

  if (mode === "reduce") {
    const runDir = opt("--run-dir");
    const outPath = opt("--out");
    if (!runDir || !outPath) fail(USAGE);
    const run = readJsonFile(join(resolve(runDir), "run.json"));
    const prevPath = opt("--previous") ?? run.previousPath;
    const linkPath = opt("--link-settings");
    let snapshot;
    try {
      snapshot = reduceEngagement(loadRun(resolve(runDir), { previous: prevPath ? readSnapshot(prevPath) : null, linkSettings: linkPath ? readJsonFile(resolve(linkPath)) : null, cliVersion: run.cliVersion, pluginVersion }));
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
    }
    writeFileAtomicSync(resolve(outPath), JSON.stringify(snapshot));
    await finish(reduceSummary(snapshot, resolve(outPath)));
  }

  const wsDir = opt("--workspace") ? resolve(opt("--workspace")) : findWorkspaceDir(process.cwd());
  if (!wsDir || !existsSync(join(wsDir, ".gs-superadmin"))) fail("no gs-superadmin workspace here (no .gs-superadmin/ in this directory or above it) — run from a workspace or pass --workspace <dir>");
  const catalog = findWorkspaceCatalog(wsDir, join(here, "..", "reference", "catalog.json"));
  if (!catalog) fail("no catalog found (workspace or bundled) — cannot verify the adapter's commands are read-only; refusing");
  const idsFile = opt("--ids-file");
  const pinFile = opt("--pin-accounts-file");
  // A flag that shapes the account grain says nothing while the grain is off: refuse it rather than drop it.
  const accountFlags = ["--accounts-busiest", "--accounts-low", "--accounts-bounce", "--accounts-low-min-delivered", "--pin-accounts-file", "--no-account-names"].filter((f) => argv.includes(f));
  if (accountFlags.length && !argv.includes("--accounts")) fail(`${accountFlags.join(", ")} only applies with --accounts (the account grain is off unless asked for; plan prints what it adds)`);
  let params;
  try {
    params = resolveParams({
      today: opt("--today"), from: opt("--from"), to: opt("--to"),
      names: all("--name"), ids: idsFile ? parseIdList(readFileSync(resolve(idsFile), "utf8")) : [], sentSince: opt("--sent-since"),
      internalDomains: all("--internal-domain"), unsubscribeLinks: all("--unsubscribe-link"), stepDetail: argv.includes("--step-detail"),
      accounts: {
        busiest: int("--accounts-busiest"), lowEngagement: int("--accounts-low"), mostBounces: int("--accounts-bounce"), lowEngagementMinDelivered: int("--accounts-low-min-delivered"),
        pinned: pinFile ? parseIdList(readFileSync(resolve(pinFile), "utf8")) : [], names: !argv.includes("--no-account-names"), pull: argv.includes("--accounts"),
      },
      incompleteFrom: opt("--incomplete-from"), repullMonths: int("--repull-months"), forceFull: argv.includes("--full"),
      pageSize: int("--page-size"), timeoutMs: int("--timeout-ms"), pulledAt: opt("--pulled-at"), timeZone: opt("--time-zone"),
    });
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }
  if (mode === "run" && !opt("--out")) fail(`run needs --out <snapshot.json> — ${USAGE}`);
  const prevPath = opt("--previous") ? resolve(opt("--previous")) : null;
  const previous = prevPath ? readSnapshot(prevPath) : null;
  const runId = opt("--run") ?? params.pulledAt.replace(/[^0-9]/g, "").slice(0, 14);
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) fail(`--run must be a plain name (letters, digits, . _ -), got "${printable(runId, 40)}"`);
  const runDir = join(wsDir, ".gs-superadmin", "tmp", "engagement", runId);
  const runFile = join(runDir, "run.json");
  // A resumed run keeps the parameters (and the pull time) it started with.
  const { pulledAt: _a, timeZone: _b, ...stable } = params;
  if (existsSync(runFile)) {
    const started = readJsonFile(runFile);
    const { pulledAt: _c, timeZone: _d, ...was } = started.params;
    if (JSON.stringify(was) !== JSON.stringify(stable)) fail(`the run at ${runDir} was started with different parameters — pass the same flags to resume it, or a new --run`);
    // The previous snapshot decides the plan (selective or full): payloads of two plans must never be reduced together.
    if ((started.previousPath ?? null) !== prevPath) fail(`the run at ${runDir} was started with a different --previous — pass the same one to resume it, or a new --run`);
    params = started.params;
  } else {
    writeFileAtomicSync(runFile, JSON.stringify({ params, previousPath: prevPath, cliVersion: catalog.meta?.cliVersion ?? null }, null, 2));
  }
  const kbDir = opt("--kb") ? resolve(opt("--kb")) : null;
  if (kbDir && !existsSync(kbDir)) fail(`--kb ${opt("--kb")}: directory not found`);

  let summary;
  try {
    summary = fetchEngagement({
      params, runDir, kbDir, previous, phase: mode === "plan" ? "plan" : "all",
      transport: cliTransport({ cliArgv: resolveCliArgv({ binOpt: opt("--bin"), fail }) }),
      gate: makeGate({ catalog, hooksDir: join(here, "..", "hooks") }),
      onCall: (line) => console.error(`engagement.mjs: ${line}`),
    });
  } catch (e) {
    if (e instanceof EngagementRefusal) fail(e.message);
    throw e;
  }
  const out = { ok: summary.status === "ok", mode, runDir, ...summary, whoami: summary.whoami ? { tokenState: summary.whoami.tokenState, expiresInSeconds: summary.whoami.expiresInSeconds, host: summary.whoami.host } : undefined };
  if (summary.status !== "ok" || mode !== "run") await finish(out, EXIT[summary.status] ?? EXIT.failed);

  const outPath = resolve(opt("--out"));
  const linkPath = opt("--link-settings");
  const snapshot = reduceEngagement(loadRun(runDir, { previous, linkSettings: linkPath ? readJsonFile(resolve(linkPath)) : null, cliVersion: catalog.meta?.cliVersion ?? null, pluginVersion }));
  writeFileAtomicSync(outPath, JSON.stringify(snapshot));
  await finish({ ...out, ...reduceSummary(snapshot, outPath) });
}

// What a caller is told about a snapshot: counts and verdicts, never rows.
function reduceSummary(s, outPath) {
  return {
    ok: true,
    out: outPath,
    pulledAt: s.meta.pulledAt,
    window: s.meta.window,
    refresh: s.meta.refresh,
    programs: s.dimensions.programs.length,
    templates: s.dimensions.templates.length,
    // Null, never 0, when the account grain was not pulled; accountData says why.
    accounts: accountAvailability(s).pulled ? s.dimensions.accounts.length : null,
    accountData: accountAvailability(s),
    rows: Object.fromEntries(Object.entries(s.facts).map(([k, v]) => [k, v.length])),
    reconciled: s.reconciliation.ok,
    reconciliation: s.reconciliation.checks.map((c) => ({ id: c.id, ok: c.ok, compared: c.compared, mismatches: c.mismatches, drift: c.drift })),
    excluded: s.honesty.excluded,
    caveats: s.caveats.map((c) => c.id),
  };
}

if (isMainModule(import.meta.url)) {
  main().catch((e) => {
    console.error(`engagement.mjs: ${e?.stack ?? e}`);
    process.exit(1);
  });
}
