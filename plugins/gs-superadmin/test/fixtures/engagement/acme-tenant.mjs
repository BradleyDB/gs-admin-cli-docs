// ─────────────────────────────────────────────────────────────────────────────
// acme-tenant.mjs — the fictional acme tenant behind the engagement suites
// (ENG-1, ENG-2): a small deterministic dataset plus `answer()`, a stand-in
// for the five reads scripts/engagement.mjs issues (whoami, jo p list,
// jo p describe, rp schema, rp run).
//
// Why a query engine in a fixture: the adapter's pitfalls are properties of
// how the server ANSWERS, so a canned payload per call would certify the
// reader against itself (Class: reader-shape). `answer()` reproduces the
// behaviours the spike measured on CLI 1.0.10 — every one is read off the
// scrubbed response samples and the notes beside them, never invented:
//   - `rp run --json` prints a BARE array; no envelope, no total, no paging
//   - no --page-size returns 50 rows; -1 returns the server maximum; N returns
//     N; the cut is silent
//   - a group value that is null comes back with NO `v` key
//   - month buckets are {k: YYYY-MM-DD, v: MM-01-YYYY, fv: Mon-YYYY}; rows are
//     not returned in date order
//   - a null date acts as later than any date: GTE keeps it, LT drops it
//   - grouping on a LOOKUP field resolves to the target's name, which is
//     empty, and collapses every row into one group
//   - a where-filter on a field the schema lacks is silently dropped
//   - an unknown operator fails with "The filter operator cannot be left blank."
//   - a failure is exit 1, empty stdout, text on stderr
//   - a call that names a lookup path as a group-by or an aggregate DROPS every
//     row whose lookup is null: it comes back neither as a null group nor in a
//     count (measured on a production tenant, F-473; a PLAIN null field does
//     come back, as a group with no `v`)
//   - before a request is sent, a show field whose object and field name a
//     group-by field also has is DROPPED, whatever its aggregation, with a
//     warning on stderr; when no show field is left the request is refused
//     (read off the CLI's dist/artifacts/validators/report.js at 1.0.10:
//     normalizeGroupByDedup, then assertShowFieldsNonEmpty)
// Every behaviour above was measured on a real tenant. One is still ASSUMED,
// measured only where it has nothing to act on: DOES_NOT_CONTAINS keeps a row
// whose field is null (the measured tenant has no in-scope send with a null
// address).
// Values are fictional throughout (acme.com is the tenant's own domain, the
// customers live under example.com); the SHAPES are the tenant's.
//
// Not a runner: it lives under test/fixtures/ so check-doc-drift's battery
// enumeration (non-recursive over test/) never lists it.
// Zero dependencies — no imports at all.
// ─────────────────────────────────────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, "0");
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthsBetween(from, to) {
  const out = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  for (;;) {
    const ym = `${y}-${pad(m)}`;
    if (ym > to) break;
    out.push(ym);
    m++;
    if (m === 13) { m = 1; y++; }
  }
  return out;
}

export const JO_SOURCE = "Advanced Outreach";
export const INTERNAL_DOMAIN = "acme.com";
const FIRST_MONTH = "2025-08";
const LAST_MONTH = "2026-09";

// ── Programs ─────────────────────────────────────────────────────────────────
// `steps` is the program's design: what a KB doc and `jo p describe` carry.
// tpl-renew sits on two steps of p-renew (the reuse case: no single step name).
const PROGRAMS = [
  {
    id: "p-onboard", name: "Acme Onboarding Chain", model: "DRIPV2", modelName: "Email Chain", statuses: ["PROCESSING"], type: "CUSTOMER", folderId: "101",
    months: monthsBetween(FIRST_MONTH, LAST_MONTH), accounts: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], perAccount: 2, internalOn: 0,
    steps: [
      { stepId: "st-ob-1", stepName: "Welcome", order: 1, templateId: "tpl-welcome", variants: ["var-welcome-a", "var-welcome-b"] },
      { stepId: "st-ob-2", stepName: "Day 7 check-in", order: 2, templateId: "tpl-day7", variants: ["var-day7"] },
    ],
  },
  {
    id: "p-nps", name: "Acme NPS Survey", model: "CSAT_SURVEY_V2", modelName: "CSAT Survey", statuses: ["PROCESSING"], type: "CUSTOMER", folderId: "101",
    months: ["2025-10", "2026-01", "2026-04", "2026-07"], accounts: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], perAccount: 1, survey: true,
    steps: [{ stepId: "st-nps-1", stepName: "Survey email", order: 1, templateId: "tpl-nps", variants: ["var-nps"] }],
  },
  {
    id: "p-renew", name: "Acme Renewal Dynamic", model: "DYNAMIC_PROGRAM", modelName: "Dynamic Program", statuses: ["PAUSE", "NEW"], type: "CUSTOMER", folderId: "202",
    months: monthsBetween("2026-03", LAST_MONTH), accounts: [2, 3, 4, 5, 6, 7], perAccount: 1,
    steps: [
      { stepId: "st-rn-1", stepName: "Renewal notice", order: 1, templateId: "tpl-renew", variants: ["var-renew"] },
      { stepId: "st-rn-2", stepName: "Renewal reminder", order: 2, templateId: "tpl-renew", variants: ["var-renew"] },
      { stepId: "st-rn-3", stepName: "Renewal thanks", order: 3, templateId: "tpl-renew-b", variants: ["var-renew-b"] },
    ],
  },
  {
    id: "p-promo", name: "Acme Old Promo", model: "SIMPLE_PROGRAM", modelName: "Simple Program", statuses: ["STOP"], type: "CUSTOMER", folderId: "202",
    months: ["2025-11", "2025-12"], accounts: [0, 1, 2, 3, 4, 5, 6, 7], perAccount: 2,
    steps: [{ stepId: "st-pr-1", stepName: "Promo", order: 1, templateId: "tpl-promo", variants: ["var-promo"] }],
  },
  {
    id: "p-pilot", name: "Acme Internal Pilot", model: "DRIPV2", modelName: "Email Chain", statuses: ["PROCESSING"], type: "USER", folderId: "303",
    months: monthsBetween("2026-06", LAST_MONTH), internalOnly: true,
    steps: [{ stepId: "st-pl-1", stepName: "Pilot note", order: 1, templateId: null, variants: [null] }],
  },
  { id: "p-draft", name: "Acme Draft Program", model: "DRIPV2", modelName: "Email Chain", statuses: ["NEW"], type: "CUSTOMER", folderId: "303", months: [], steps: [] },
];
// In the send log but NOT in `jo p list`: one that still describes (the list
// missed it) and one that is gone (deleted).
const UNLISTED = { id: "p-unlisted", name: "Acme Unlisted Program", model: "DRIPV2", modelName: "Email Chain", statuses: ["PROCESSING"], type: "CUSTOMER", folderId: "303", months: ["2026-08"], accounts: [0, 1, 2], perAccount: 2, steps: [{ stepId: "st-ul-1", stepName: "Unlisted note", order: 1, templateId: "tpl-unlisted", variants: ["var-unlisted"] }] };
const DELETED = { id: "p-gone", name: "Acme Deleted Program", months: ["2026-01"], accounts: [0, 1, 2, 3, 4], perAccount: 1, steps: [{ stepId: "st-gn-1", templateId: "tpl-gone", variants: ["var-gone"] }] };

// Only with the ownSiteUnsub variant (F-470): a program whose emails' unsubscribe
// link is a mail-settings page on acme's OWN site, worded so that no generic
// unsubscribe pattern matches it. tpl-prefs is clicked on that link alone;
// tpl-prefs-mix also has content clicks, one of them on a page of the same
// site whose path merely begins with the same characters.
const OWN_SITE = {
  id: "p-prefs", name: "Acme Preferences Chain", model: "DRIPV2", modelName: "Email Chain", statuses: ["PROCESSING"], type: "CUSTOMER", folderId: "404",
  months: monthsBetween("2026-06", LAST_MONTH), accounts: [0, 1, 2, 3, 4, 5], perAccount: 2,
  steps: [
    { stepId: "st-pf-1", stepName: "Prefs note", order: 1, templateId: "tpl-prefs", variants: ["var-prefs"] },
    { stepId: "st-pf-2", stepName: "Prefs follow-up", order: 2, templateId: "tpl-prefs-mix", variants: ["var-prefs-mix"] },
  ],
};
// Only with the massDay variant (F-472): one program sends to sixty accounts on
// ONE day, so a single program-day holds more accounts than a small page.
const BLAST = {
  id: "p-blast", name: "Acme Mass Send", model: "DRIPV2", modelName: "Email Chain", statuses: ["PROCESSING"], type: "CUSTOMER", folderId: "505",
  months: ["2026-07"], steps: [{ stepId: "st-bl-1", stepName: "Announcement", order: 1, templateId: "tpl-blast", variants: ["var-blast"] }],
};
const BLAST_ACCOUNTS = Array.from({ length: 60 }, (_, i) => ({ Gsid: `co-b${pad(i + 1)}`, Name: `Acme Blast Customer ${pad(i + 1)}` }));
const BLAST_NAMES = ["ann", "bo", "cy", "dee", "eli", "fay", "gus", "hal", "ivy", "jo", "kit", "lou", "max", "ned", "oz", "pru", "quin", "roy", "sy", "tu"];
export const OWN_SITE_UNSUBSCRIBE = "https://www.acme.com/mail-settings";

const TEMPLATE_NAMES = {
  "tpl-welcome": "Acme Welcome", "tpl-day7": "Acme Day 7", "tpl-nps": "Acme NPS Request", "tpl-renew": "Acme Renewal",
  "tpl-renew-b": "Acme Renewal Thanks", "tpl-promo": "Acme Promo", "tpl-unlisted": "Acme Unlisted", "tpl-gone": "Acme Gone",
  "tpl-prefs": "Acme Prefs", "tpl-prefs-mix": "Acme Prefs Follow-up", "tpl-blast": "Acme Announcement",
};
// Click behaviour per template (the five R19 fixtures ride on these):
//   content — content-link clicks are recorded
//   unsub   — the only clicks ever recorded are on the unsubscribe link
//   none    — never clicked at all
//   ownsite — the only clicks ever recorded are on the own-site unsubscribe page
//   ownsite-mix — that page, and content links too
const CLICK_MODE = {
  "tpl-welcome": "content", "tpl-promo": "content", "tpl-unlisted": "content", "tpl-gone": "content",
  "tpl-renew": "unsub", "tpl-day7": "none", "tpl-nps": "none", "tpl-renew-b": "none",
  "tpl-prefs": "ownsite", "tpl-prefs-mix": "ownsite-mix", "tpl-blast": "content",
};

const ACCOUNTS = Array.from({ length: 12 }, (_, i) => ({ Gsid: `co-${pad(i + 1)}`, Name: `Acme Customer ${pad(i + 1)}` }));
const INTERNAL_PEOPLE = [
  { id: "pe-int-1", email: `ann@${INTERNAL_DOMAIN}` },
  { id: "pe-int-2", email: `raj@${INTERNAL_DOMAIN}` },
  { id: "pe-int-3", email: `lee@${INTERNAL_DOMAIN}` },
];

const wrapClicks = (entries) => `{type=json, value=${JSON.stringify(entries)}, null=true}`;
const LINKS = {
  content: (n) => ({ url: "https://www.example.com/guide/getting-started", clickedCount: 1 + (n % 2), ip: `203.0.113.${n % 250}` }),
  unsub: (n) => ({ url: "https://mail.example.com/unsubscribe?t=abc", clickedCount: 1, ip: `203.0.113.${n % 250}` }),
  mailto: (n) => ({ url: "mailto:cs@acme.com", clickedCount: 1, ip: `203.0.113.${n % 250}` }),
  ownsite: (n) => ({ url: `${OWN_SITE_UNSUBSCRIBE}/topics?u=${n}`, clickedCount: 1, ip: `203.0.113.${n % 250}` }),
  // Content, on the same site: its path only BEGINS like the unsubscribe page's.
  lookalike: (n) => ({ url: `${OWN_SITE_UNSUBSCRIBE}-guide`, clickedCount: 1, ip: `203.0.113.${n % 250}` }),
};
const CONTENT_KINDS = new Set(["content", "lookalike"]);

/**
 * Build the tenant. Variants (all optional) reshape it for one scenario:
 *   cutoff          "YYYY-MM-DD" — sends on or after this day do not exist yet
 *   lateOpens       true — every unopened delivered send before 2026-07 is now opened
 *   token           {state: "valid"|"expired"|"none", seconds}
 *   dropSchemaField {object, field} — the schema (and so the filter) lacks it
 *   noSurveyObject  true — survey_participant has no schema at all
 *   listMax         number — `jo p list` returns at most this many rows a page
 *   serverMax       number — the row cap --page-size -1 resolves to (default 5000)
 *   rawClickJson    true — LinkClickedJson is a plain JSON array, no wrapper
 *   listNoEnvelope  true — `jo p list` repeats its rows on every page and says nothing about paging
 *   noClicksFrom    "YYYY-MM-DD" — no click is recorded on a send from this day on
 *   extraJoRow      true — the JO send log holds one send the delivery log lacks
 *   ownSiteUnsub    true — one more program, whose unsubscribe link is a page on acme's own site
 *   massDay         true — one more program, which sends to sixty accounts on a single day
 *   massMonth       "YYYY-MM" — the month of that day (default 2026-07)
 *   orphanClicks    true — the sends with no company link are clicked on a content link (F-473)
 */
export function buildTenant(variant = {}) {
  const log = [];
  const joLog = [];
  const participants = new Map();
  const surveyRows = [];
  let n = 0;
  const cutoff = variant.cutoff ?? "9999-12-31";

  const send = (program, step, month, { account, person, email, source = JO_SOURCE, addressType = "To", onDay = null }) => {
    n++;
    const day = onDay ?? pad((n % 27) + 1);
    const executed = `${month}-${day}T10:00:00.000Z`;
    if (executed.slice(0, 10) >= cutoff) return;
    const tpl = step.templateId;
    const sent = n % 11 !== 0;
    const bounced = sent ? n % 37 === 0 : n % 2 === 0;
    const rejected = !sent && !bounced;
    let opened = sent && n % 3 !== 0;
    if (variant.lateOpens && sent && month < "2026-07") opened = true;
    const mode = CLICK_MODE[tpl] ?? "none";
    let kinds = null;
    if (sent && opened && mode.startsWith("ownsite") && n % 2 === 0) {
      if (mode === "ownsite") kinds = ["ownsite"];
      else kinds = n % 3 === 0 ? ["content", "ownsite"] : n % 3 === 1 ? ["lookalike"] : ["ownsite"];
    } else if (sent && opened && n % 5 === 0 && mode !== "none" && !mode.startsWith("ownsite") && executed.slice(0, 10) < (variant.noClicksFrom ?? "9999-12-31")) {
      if (mode === "unsub") kinds = ["unsub"];
      else if (n % 15 === 0) kinds = ["unsub"];
      else if (n % 25 === 0) kinds = ["mailto"];
      else if (n % 35 === 0) kinds = ["content", "unsub"];
      else kinds = ["content"];
    }
    if (variant.orphanClicks && account == null && sent && opened && (program.id === "p-onboard" || program.id === "p-pilot")) kinds = ["content"];
    const links = kinds && kinds.map((k) => LINKS[k](n));
    const gsid = `log-${String(n).padStart(5, "0")}`;
    const row = {
      Gsid: gsid, Source: source, SourceId: program.id, SourceName: program.name, AddressType: addressType,
      EmailTemplateId: tpl, EmailTemplateName: tpl ? TEMPLATE_NAMES[tpl] : null,
      ExecutedDate: executed, SentDate: sent ? executed : null,
      IsSent: sent ? "YES" : "NO", IsOpened: opened ? "YES" : "NO", IsBounced: bounced ? "YES" : "NO",
      IsRejected: rejected ? "YES" : "NO", IsUnsubscribed: sent && n % 53 === 0 ? "YES" : "NO", IsSpam: sent && n % 97 === 0 ? "YES" : "NO",
      LowerCaseEmailId: email, GsCompanyId: account, GsPersonId: person,
      LinkClickedCount: links ? links.reduce((a, l) => a + l.clickedCount, 0) : 0,
      LinkClickedJson: links ? (variant.rawClickJson ? JSON.stringify(links) : wrapClicks(links)) : null,
      // Oracle-only (underscore keys are invisible to answer()): what the row's
      // clicks ARE, written by the generator that chose them.
      _contentClick: !!kinds && kinds.some((k) => CONTENT_KINDS.has(k)),
    };
    log.push(row);
    if (source !== JO_SOURCE || addressType !== "To") return;
    // The JO send log mirrors each To-row of a JO program, with the step and
    // variant the delivery log lacks. A person re-enters p-onboard every six
    // months, so participant records outnumber people.
    const entry = program.id === "p-onboard" ? Math.floor(program.months.indexOf(month) / 6) : 0;
    const parId = `par-${program.id}-${person}-${entry}`;
    participants.set(parId, { Gsid: parId, AdvancedOutreachId: program.id });
    const variantId = step.variants[n % step.variants.length];
    joLog.push({
      Gsid: `jo-${String(n).padStart(5, "0")}`, AdvancedOutreachId: program.id, StepId: step.stepId,
      EmailTemplateId: tpl, EmailTemplateVarianceId: variantId, EmailTemplateVarianceName: variantId ? `${variantId} name` : null,
      CreatedAt: executed, EmailSendTime: sent ? executed : null,
      EmailSend: sent, EmailOpened: opened, Bounce: bounced, Rejected: rejected,
      Unsubscribed: row.IsUnsubscribed === "YES", Spam: row.IsSpam === "YES", EmailClicked: !!links,
      AddressType: "To", ToAddress: email, EmailLogId: gsid, GsParticipantId: parId,
    });
    if (program.survey) {
      const responded = sent && n % 4 === 0;
      const partial = responded && n % 12 === 0;
      // One response in three lands the month AFTER the send.
      const respMonth = n % 3 === 0 ? monthsBetween(month, "2099-12")[1] : month;
      surveyRows.push({
        Gsid: `sp-${String(n).padStart(5, "0")}`, AOParticipantId: parId, Responded: responded,
        RespondedDate: responded ? `${respMonth}-${day}T12:00:00.000Z` : null,
        ResponseStatus: responded ? (partial ? "Partially Submitted" : "Submitted") : sent ? "Not Responded" : "Undelivered Or Bounced",
        SurveyOpened: responded || n % 2 === 0,
      });
    }
  };

  const listed = [...PROGRAMS, ...(variant.ownSiteUnsub ? [OWN_SITE] : []), ...(variant.massDay ? [BLAST] : [])];
  // A variant's program goes last, so every other send keeps its number.
  for (const program of [...PROGRAMS, UNLISTED, DELETED, ...(variant.ownSiteUnsub ? [OWN_SITE] : [])]) {
    for (const month of program.months) {
      for (const step of program.steps) {
        if (program.internalOnly) {
          for (const p of INTERNAL_PEOPLE) send(program, step, month, { account: null, person: p.id, email: p.email });
          continue;
        }
        for (const a of program.accounts) {
          for (let k = 0; k < program.perAccount; k++) {
            const person = `pe-${pad(a + 1)}-${k}`;
            send(program, step, month, { account: ACCOUNTS[a].Gsid, person, email: `user${k}@c${pad(a + 1)}.example.com` });
          }
        }
        // One internal recipient rides a customer program (the class split),
        // and one send has no company link at all (its own bucket).
        if (program.internalOn != null) send(program, step, month, { account: ACCOUNTS[program.internalOn].Gsid, person: INTERNAL_PEOPLE[0].id, email: INTERNAL_PEOPLE[0].email });
        if (program.id === "p-onboard") send(program, step, month, { account: null, person: "pe-orphan", email: "orphan@nolink.example.org" });
      }
      // CC copies and a non-JO source: both must be left out and counted.
      if (program.id === "p-onboard") {
        send(program, program.steps[0], month, { account: ACCOUNTS[0].Gsid, person: "pe-cc", email: "cc@c01.example.com", addressType: "CC" });
        send({ id: "cockpit-1", name: "Cockpit", months: [] }, { templateId: null, variants: [null] }, month, { account: ACCOUNTS[1].Gsid, person: "pe-02-0", email: "user0@c02.example.com", source: "COCKPIT" });
      }
    }
  }
  if (variant.massDay) {
    for (const [i, a] of BLAST_ACCOUNTS.entries()) send(BLAST, BLAST.steps[0], variant.massMonth ?? "2026-07", { account: a.Gsid, person: `pe-b${pad(i + 1)}`, email: `${BLAST_NAMES[i % BLAST_NAMES.length]}${i}@b${pad(i + 1)}.example.org`, onDay: "14" });
  }
  // A survey response that no JO program owns (another distribution channel).
  surveyRows.push({ Gsid: "sp-other", AOParticipantId: null, Responded: true, RespondedDate: "2026-07-09T12:00:00.000Z", ResponseStatus: "Submitted", SurveyOpened: true });

  // Responses to p-nps from before any window the suites pull: its all-time
  // counts are larger than any window's, as on a program older than the window.
  for (const [i, status] of ["Submitted", "Submitted", "Partially Submitted", null].entries()) {
    const parId = `par-p-nps-early-${i}`;
    participants.set(parId, { Gsid: parId, AdvancedOutreachId: "p-nps" });
    surveyRows.push({ Gsid: `sp-early-${i}`, AOParticipantId: parId, Responded: status != null, RespondedDate: status ? `2025-03-1${i}T12:00:00.000Z` : null, ResponseStatus: status ?? "Not Responded", SurveyOpened: true });
  }

  if (variant.extraJoRow) joLog.push({ ...joLog.find((r) => r.AdvancedOutreachId === "p-onboard" && r.CreatedAt.startsWith("2026-08")), Gsid: "jo-extra", EmailLogId: null });

  const fields = (names, types = {}) => names.map((fieldName) => ({ fieldName, dataType: types[fieldName] ?? "STRING", meta: { filterable: true, groupable: true, aggregatable: true } }));
  const schemas = {
    email_log_v2: fields(
      ["Gsid", "Source", "SourceId", "SourceName", "AddressType", "EmailTemplateId", "EmailTemplateName", "ExecutedDate", "SentDate", "IsSent", "IsOpened", "IsBounced", "IsRejected", "IsUnsubscribed", "IsSpam", "LowerCaseEmailId", "GsCompanyId", "GsPersonId", "LinkClickedCount", "LinkClickedJson"],
      { Gsid: "GSID", ExecutedDate: "DATETIME", SentDate: "DATETIME", LowerCaseEmailId: "EMAIL", GsCompanyId: "LOOKUP", GsPersonId: "LOOKUP", LinkClickedCount: "NUMBER" }
    ),
    ao_emails: fields(
      ["Gsid", "AdvancedOutreachId", "StepId", "EmailTemplateId", "EmailTemplateVarianceId", "EmailTemplateVarianceName", "CreatedAt", "EmailSendTime", "EmailSend", "EmailOpened", "Bounce", "Rejected", "Unsubscribed", "Spam", "EmailClicked", "AddressType", "ToAddress", "EmailLogId", "GsParticipantId"],
      { Gsid: "GSID", CreatedAt: "DATETIME", EmailSendTime: "DATETIME", EmailSend: "BOOLEAN", EmailOpened: "BOOLEAN", Bounce: "BOOLEAN", Rejected: "BOOLEAN", Unsubscribed: "BOOLEAN", Spam: "BOOLEAN", EmailClicked: "BOOLEAN", EmailLogId: "LOOKUP", GsParticipantId: "LOOKUP" }
    ),
    survey_participant: fields(
      ["Gsid", "AOParticipantId", "Responded", "RespondedDate", "ResponseStatus", "SurveyOpened"],
      { Gsid: "GSID", AOParticipantId: "LOOKUP", Responded: "BOOLEAN", RespondedDate: "DATETIME", SurveyOpened: "BOOLEAN" }
    ),
    company: fields(["Gsid", "Name"], { Gsid: "GSID" }),
  };
  if (variant.dropSchemaField) {
    const { object, field } = variant.dropSchemaField;
    schemas[object] = schemas[object].filter((f) => f.fieldName !== field);
  }
  if (variant.noSurveyObject) delete schemas.survey_participant;

  const tables = { email_log_v2: log, ao_emails: joLog, survey_participant: surveyRows, company: variant.massDay ? [...ACCOUNTS, ...BLAST_ACCOUNTS] : ACCOUNTS, ao_participants: [...participants.values()] };
  const byGsid = Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, new Map(rows.map((r) => /** @type {[string, *]} */ ([r.Gsid, r])))]));
  const token = variant.token ?? { state: "valid", seconds: 3200 };
  return {
    variant, tables, schemas, byGsid, token,
    baseUrl: "https://acme.gainsightcloud.com",
    listed,
    describable: new Map([...listed, UNLISTED].map((p) => [p.id, p])),
    serverMax: variant.serverMax ?? 5000,
    listMax: variant.listMax ?? 1000,
  };
}

// What `jo p describe` returns for a program, and what a KB doc embeds: the
// design as an embedded-JSON stepJson whose email action is embedded AGAIN.
export function programPayload(p) {
  const stepJson = p.steps.map((s) => ({
    stepId: s.stepId, stepName: s.stepName ?? null, order: s.order ?? null, stepType: "EMAIL",
    emailActionJson: JSON.stringify({ emailTemplateId: s.templateId, emailTemplateName: s.templateId ? TEMPLATE_NAMES[s.templateId] : null, variantMappings: [] }),
  }));
  return {
    result: true,
    requestId: "00000000-0000-4000-8000-000000000001",
    data: {
      advancedOutreach: {
        advancedOutreachId: p.id, advancedOutreachName: p.name, advancedOutreachModel: p.model, advancedOutreachModelName: p.modelName,
        advancedOutreachType: p.type, advancedOutreachStatus: p.statuses[0], folderId: p.folderId, stepJson: JSON.stringify(stepJson),
      },
      versions: [],
    },
  };
}
export const listedPrograms = () => PROGRAMS;

// A tenant KB folder, as writeFiles() input: the manifest plus one full program
// doc per listed program that has a design — except p-promo, which the KB has
// no doc for (its template gets no step name), and p-unlisted, which the list
// never showed setup.
export function kbFiles(slug = "acme-prod") {
  const files = {
    [`${slug}/_manifest.json`]: JSON.stringify({ slug, baseUrl: "https://acme.gainsightcloud.com", environment: "production", created: "2026-01-01T00:00:00.000Z", last_refresh: null, inventory: {} }, null, 2),
  };
  for (const p of PROGRAMS) {
    if (!p.steps.length || p.id === "p-promo") continue;
    files[`${slug}/journey/${p.id}.md`] = [
      `# ${p.name}`, "",
      "> Full describe doc — generated by describe-batch.mjs, captured 2026-01-15T00:00:00.000Z.", "",
      `- key: journey/${p.id}`, `- id: ${p.id}`, `- name: ${p.name}`, "",
      "```json", JSON.stringify(programPayload(p), null, 2), "```", "",
    ].join("\n");
  }
  return files;
}

// ── The stand-in CLI ─────────────────────────────────────────────────────────
const REQUEST_ID = "Request ID: 00000000-0000-4000-8000-000000000000";
export const FAULT_TEXT = {
  timeout: `Error: The query has timed out. Reduce data by applying filters.\n${REQUEST_ID}`,
  "not-found": `Error: Advanced Outreach not found\n${REQUEST_ID}`,
  auth: "Error: Access token has expired. Run `gs-admin login` to re-authenticate.",
  outage: `Error: The communication with the external API could not be established due to a network outage. Try again later. If the issue persists, contact Gainsight Support for further assistance.\n${REQUEST_ID}`,
  generic: `Error: The request could not be processed. Contact Gainsight Support for more information.\n${REQUEST_ID}`,
};
const WARN_TEXT = "[report] normalizeGroupByDedup: removed 1 showField(s) already present in groupByFields.";

const flagValue = (argv, name) => {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
};
const fail = (stderr, status = 1) => ({ status, stdout: "", stderr });
const ok = (payload, stderr = "") => ({ status: 0, stdout: typeof payload === "string" ? payload : JSON.stringify(payload), stderr });

const numCell = (v) => ({ k: v, v, s: "", fv: String(v) });
const monthCell = (iso) => {
  if (iso == null) return { fv: "" };
  const y = iso.slice(0, 4);
  const m = iso.slice(5, 7);
  return { k: `${y}-${m}-01`, v: `${m}-01-${y}`, fv: `${MON[Number(m) - 1]}-${y}` };
};
const plainCell = (v, type) => {
  if (v == null) return { fv: "" };
  if (type === "NUMBER") return numCell(v);
  if (type === "DATETIME") return { k: v, v, fv: v.slice(0, 10) };
  if (typeof v === "boolean") return { k: v, v, fv: v ? "Yes" : "No" };
  return { v, fv: String(v) };
};

function hopValue(tenant, row, fieldPath) {
  const hop = fieldPath.hops[0];
  const id = row[hop.through];
  if (id == null) return null;
  const target = tenant.byGsid[hop.to]?.get(id);
  if (target) return target[fieldPath.leaf] ?? null;
  // A lookup target this fixture does not materialise (person): its Gsid is
  // the id the row carries.
  return fieldPath.leaf === "Gsid" ? id : null;
}

function evalCond(row, c, types) {
  const name = c?.leftOperand?.fieldName;
  if (!types.has(name)) return true; // unknown field: the condition is silently dropped
  const x = row[name];
  const val = c?.rightOperand?.value;
  const day = (v) => String(v).slice(0, 10);
  switch (c.operator) {
    case "EQ": return x === val;
    case "NE": return x !== val; // keeps nulls
    case "IN": return Array.isArray(val) && val.includes(x);
    case "GT": return typeof x === "number" && x > val;
    case "GTE": return x == null ? true : day(x) >= val; // a null date acts as later than any date
    case "LT": return x == null ? false : day(x) < val;
    case "CONTAINS": return typeof x === "string" && x.includes(val);
    case "DOES_NOT_CONTAINS": return !(typeof x === "string" && x.includes(val));
    case "ENDS_WITH": return typeof x === "string" && x.endsWith(val);
    case "IS_NULL": return x == null;
    case "IS_NOT_NULL": return x != null;
    default: throw new Error(`Error: The filter operator cannot be left blank.\n${REQUEST_ID}`);
  }
}

function rpRun(argv, tenant) {
  const object = flagValue(argv, "--object");
  const schema = tenant.schemas[object];
  if (!schema) return fail(FAULT_TEXT.generic);
  const types = new Map(schema.map((f) => [f.fieldName, f.dataType]));
  const limit = flagValue(argv, "--limit");
  if (limit !== undefined && Number(limit) > 2000) return fail(`Error: --limit ${limit} exceeds the server cap of 2000. Reduce --limit to 2000 or lower.`);
  let show, group, where;
  try {
    show = JSON.parse(flagValue(argv, "--show-fields") ?? "[]");
    group = JSON.parse(flagValue(argv, "--group-by") ?? "[]");
    where = JSON.parse(flagValue(argv, "--where-filters") ?? '{"conditions":[]}');
  } catch {
    return fail("Error: whereFilters must be object");
  }
  if (!where || typeof where !== "object" || Array.isArray(where)) return fail("Error: whereFilters must be object");
  // The CLI's request normalizer, before anything is sent: keyed by object and
  // field name alone (a lookup path by its target object and leaf).
  const keyOf = (e) => (e.fieldPath ? `${e.fieldPath.hops[e.fieldPath.hops.length - 1].to}::${e.fieldPath.leaf}` : `${object}::${e.name}`);
  let dedupWarning = "";
  if (group.length) {
    const grouped = new Set(group.map(keyOf));
    const kept = show.filter((e) => !grouped.has(keyOf(e)));
    if (kept.length < show.length) dedupWarning = `[report] normalizeGroupByDedup: removed ${show.length - kept.length} showField(s) already present in groupByFields.`;
    show = kept;
  }
  if (!show.length) return fail(`${dedupWarning ? `${dedupWarning}\n` : ""}Error: Report must have at least one entry in showFields (spec §2.1, EMPTY_SHOW_ME_FIELDS).`);
  let rows;
  try {
    rows = tenant.tables[object].filter((r) => (where.conditions ?? []).every((c) => evalCond(r, c, types)));
  } catch (e) {
    return fail(e.message);
  }
  // A lookup path in a group-by or an aggregate is an inner join: a row whose
  // lookup is null is gone from the whole answer.
  for (const e of [...group, ...show.filter((x) => x.aggregation)]) {
    if (e.fieldPath) rows = rows.filter((r) => hopValue(tenant, r, e.fieldPath) != null);
  }

  const groupKeyAndCell = (g, row) => {
    if (g.fieldPath) {
      const hop = g.fieldPath.hops[0];
      const v = hopValue(tenant, row, g.fieldPath);
      return [`${hop.to}_${hop.through}__gr_${g.fieldPath.leaf}`, v == null ? { fv: "" } : { v, fv: String(v) }];
    }
    if (g.summarize === "Month") return [`summarize_month_of_${object}_${g.name}`, monthCell(row[g.name])];
    // Grouping on a LOOKUP resolves to the target's name field, which is empty:
    // no `v`, and every row lands in ONE group.
    if (types.get(g.name) === "LOOKUP") return [`${object}_${g.name}__gr_Name`, { fv: "" }];
    return [`${object}_${g.name}`, plainCell(row[g.name], types.get(g.name) === "NUMBER" ? "NUMBER" : null)];
  };
  const aggregate = (s, members) => {
    if (s.aggregation === "COUNT") return [`count_of_${object}_${s.name}`, numCell(members.length)];
    if (s.aggregation === "COUNT_DISTINCT") {
      if (s.fieldPath) {
        const hop = s.fieldPath.hops[0];
        const set = new Set(members.map((r) => hopValue(tenant, r, s.fieldPath)).filter((v) => v != null));
        return [`count_distinct_of_${hop.to}_${s.fieldPath.leaf}`, numCell(set.size)];
      }
      if (types.get(s.name) === "LOOKUP") return [`count_distinct_of_${object}_Name`, numCell(members.length ? 1 : 0)];
      return [`count_distinct_of_${object}_${s.name}`, numCell(new Set(members.map((r) => r[s.name]).filter((v) => v != null)).size)];
    }
    throw new Error(`Error: The aggregation function selected is not valid. Supported function is [SUM, MIN, MAX, COUNT, COUNT_DISTINCT, AVG, MEDIAN].\n${REQUEST_ID}`);
  };

  let out;
  try {
    if (group.length || show.every((s) => s.aggregation)) {
      const groups = new Map();
      for (const row of rows) {
        const cells = group.map((g) => groupKeyAndCell(g, row));
        const key = JSON.stringify(cells.map(([, c]) => ("k" in c ? c.k : "v" in c ? c.v : null)));
        if (!groups.has(key)) groups.set(key, { cells, members: [] });
        groups.get(key).members.push(row);
      }
      if (!group.length && !groups.size) groups.set("[]", { cells: [], members: [] });
      out = [...groups.values()].map(({ cells, members }) => Object.fromEntries(/** @type {Array<[string, *]>} */ ([...cells, ...show.map((s) => aggregate(s, members))])));
    } else {
      out = rows.map((row) =>
        Object.fromEntries(show.map((s) => (s.fieldPath ? groupKeyAndCell(s, row) : [`${object}_${s.name}`, plainCell(row[s.name], types.get(s.name))])))
      );
    }
  } catch (e) {
    return fail(e.message);
  }
  out.reverse(); // rows are not returned in any useful order
  const ps = flagValue(argv, "--page-size");
  const size = ps === undefined ? 50 : Number(ps) === -1 ? tenant.serverMax : Math.min(Number(ps), tenant.serverMax);
  return ok(out.slice(0, size), dedupWarning);
}

/**
 * Answer one invocation. `argv` is everything after the program word.
 * @param {string[]} argv
 * @param {ReturnType<typeof buildTenant>} tenant
 * @returns {{status: number, stdout: string, stderr: string}}
 */
export function answer(argv, tenant) {
  const words = argv.filter((t) => !t.startsWith("-"));
  if (words[0] === "whoami") {
    const t = tenant.token;
    const line = t.state === "valid" ? `Token: valid (expires in ${t.seconds}s)` : t.state === "expired" ? "Token: expired" : "Token: none — run 'gs-admin login'";
    return ok(`Base URL: ${tenant.baseUrl}\nAuth mode: not configured — run 'gs-admin login'\n${line}`);
  }
  if (tenant.token.state !== "valid") return fail(FAULT_TEXT.auth);
  if (words[0] === "rp" && words[1] === "run") return rpRun(argv, tenant);
  if (words[0] === "rp" && words[1] === "schema") {
    const object = flagValue(argv, "--object");
    const fields = tenant.schemas[object];
    return ok(fields ? { data: { objectName: object, fields } } : { data: {} });
  }
  if (words[0] === "jo" && words[1] === "p" && words[2] === "list") {
    const limit = Math.min(Number(flagValue(argv, "--limit") ?? 20), tenant.listMax);
    const page = Number(flagValue(argv, "--page") ?? 1);
    const all = tenant.listed;
    const rows = all.slice((page - 1) * limit, page * limit).map((p) => ({
      advancedOutreachId: p.id, advancedOutreachName: p.name, modified_date: 0, advancedOutreachModelName: p.modelName, folderId: p.folderId,
      advancedOutreachStatus: p.statuses, advancedOutreachType: p.type, advancedOutreachModel: p.model, gsid: `gs-${p.id}`, testrun: false,
    }));
    if (tenant.variant.listNoEnvelope) return ok({ result: true, requestId: "r", data: { advancedOutreaches: all.slice(0, limit).map((p) => ({ advancedOutreachId: p.id, advancedOutreachName: p.name, advancedOutreachStatus: p.statuses })) } });
    const totalPages = Math.ceil(all.length / limit);
    return ok({ result: true, requestId: "r", data: { advancedOutreaches: rows, pageNumber: page, limit, lastPage: page >= totalPages, totalPages, totalRecords: all.length } });
  }
  if (words[0] === "jo" && words[1] === "p" && words[2] === "describe") {
    const p = tenant.describable.get(flagValue(argv, "--id"));
    return p ? ok(programPayload(p)) : fail(FAULT_TEXT["not-found"]);
  }
  return fail(`Error: command ${words.join(" ")} is not faked`);
}

/**
 * Fault injection, shared by the spawned fake and the in-process transport.
 * A rule fires on the invocations whose space-joined argv contains `match`
 * (every string of it, when it is a list):
 * the first `skip` pass, the next `times` fail (default 1), the rest pass.
 * `counts` is the caller's state (a plain object the spawned fake persists).
 * @param {Array<{match: string | string[], kind: string, skip?: number, times?: number}>} rules
 * @param {Record<string, number>} counts
 * @param {string[]} argv
 * @returns {{status: number, stdout: string, stderr: string, warn?: boolean} | null}
 */
export function applyFaults(rules, counts, argv) {
  const line = argv.join(" ");
  for (const [i, rule] of rules.entries()) {
    if (![].concat(rule.match).every((m) => line.includes(m))) continue;
    const seen = (counts[i] = (counts[i] ?? 0) + 1);
    const skip = rule.skip ?? 0;
    if (seen <= skip || seen > skip + (rule.times ?? 1)) continue;
    if (rule.kind === "warn") return { status: 0, stdout: "", stderr: WARN_TEXT, warn: true };
    return fail(FAULT_TEXT[rule.kind]);
  }
  return null;
}
