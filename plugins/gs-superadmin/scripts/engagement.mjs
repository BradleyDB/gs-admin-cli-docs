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
//   - Health facts (HLT-1) are optional and OFF unless --health is passed: an
//     output that shows no health table should not pay for their calls. Without
//     them every health table is empty and the snapshot says why (meta.health).
//     The failure count on every send row is not part of that switch: it is
//     counted from the flags the pull reads anyway. Turning health on over a
//     snapshot that holds none is a full refresh.
//   - Health facts are diagnostic and never fail a pull: a part whose
//     call does not return is recorded as not read, with the reason, and a
//     reader shows it as missing, never as "no failures". An error message is
//     masked (addresses, ids, long numbers) when it is FETCHED, so the raw text
//     never reaches disk, and again when the snapshot is built. A program's
//     last send is read from day buckets: there is no "latest date" aggregate
//     to ask for.
//   - Failure reasons are COUNTED server-side by category, never read at the
//     grain of the text (F-484): one filtered count per category (CONTAINS on
//     the bounce reason, grouped by program, template, month and type), the
//     total beside them, "Other" = total less the categories, and a capped
//     masked sample of the uncategorised text for discovery. The failed
//     participant's reason field takes no filter at all on CLI 1.0.10 (its
//     schema says so, and every operator tried was refused), so that part is
//     a per-program total with no breakdown, and says so; the breakdown by
//     reason is a per-program SAMPLE of the most REPEATED refusals still
//     happening in the day window (F-484, redesigned 2026-10-08).
//   - A sample is read PER PROGRAM, never as the first page of a tenant-wide
//     read (F-484, reopened: one program outside the selection filled it):
//     one small page per selected program with failures, most failures
//     first, at most --sample-programs a pull (the plan prices the rest), and
//     a program whose failure counts did not move since the previous snapshot
//     keeps that snapshot's sample. What was not sampled is named.
//   - A program's health is read from signals, each from its own data (F-491):
//     the participant sources' last sync time (the one heartbeat an ingest
//     leaves; the schedule's run-state fields are unset even on healthy daily
//     programs), participants admitted per day, refusals per month with the
//     sampled split, step failures per month counted by category, and sends
//     against the program's own history. The lists are derived by the reader
//     (programHealth); the pull stores facts, never a judgment.
//   - A field a query filters or groups on must be declared filterable or
//     groupable by `rp schema`: a filter on a field that is not is refused by
//     the server with an "unrecognized data type" text, so validateQuery
//     refuses it first.
//   - Before any family that reads plain rows or splits on a count, plan makes
//     one server-side COUNT of what it would read (clicked sends; failed
//     participants) and prices the family from it; a family that cannot be
//     read within the row budget is refused up front (a health part with the
//     reason `too-large`; the click detail with a refusal naming the count).
//   - The pull time (meta.pulledAt) is stamped when the fact calls start, not
//     when the run directory is made (F-482), and a resumed run keeps the day
//     it was planned on (F-483): a plan before midnight and its run after it
//     are one run.
//   - With a KB, every program's schedule (classification, cron, zone, start
//     and end, as-of) rides the program dimension whether or not health is
//     pulled; the health signals and the grouping resolver read it there. No
//     live describe is made for it: the run state comes from the sync
//     heartbeat above.
//   - Test accounts (--test-account, company ids) are excluded server-side
//     like internal domains: one IN call per month unit, one for the overlap
//     with each domain, and they join the internal class; external distinct
//     counts carry NOT_IN, which keeps rows with no company (measured).
//   - Nothing is read from a previous snapshot that the refresh could never
//     carry facts from (another tenant's, or one built under earlier metric
//     definitions): usablePrevious is the one gate, and fetch and reduce see
//     the previous snapshot only through it.
//
// Where each number is read from (objects, standing filters, date fields, the
// flag fields and the value that counts) is stated ONCE, in
// engagement-query.mjs's SOURCES and METRICS: the queries below are built from
// those tables and the rows are counted with them, so the glossary a report
// shows is the formula this file ran. That module is import-free (every
// dashboard page inlines it), which is why the facts live there and are
// imported here, and why the T-10 read floor lives there too.
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
 *   failed          attempts that bounced OR were rejected, each counted once
 *                   even when both flags are set: the error rate's numerator
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
 * @property {number} failed            bounced or rejected, once per attempt (HLT-1; absent on a snapshot made before it was counted)
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
 * @property {T10Health} [health]                 health facts (HLT-1); every table empty when they were not pulled (meta.health); absent on a snapshot made before they existed
 *
 * @typedef {object} T10Health
 *   Every table is an array, empty when its part was not read (meta.health.parts
 *   says why). Every message is MASKED (no address, id, host or long number) or is a
 *   category LABEL (the product wording up to the value, the tail cut; S3b).
 *   `category` on a reason row (additive, S3b): the category's id when the row
 *   was counted server-side under a category and `message` is its label;
 *   "other" on the per-key remainder row, which has NO message (its count is
 *   the total less every category, and reads below zero only when the
 *   category list overlaps, which the failure-categories-overlap caveat flags);
 *   null (or absent, on a snapshot made before categories) on a row read as
 *   masked text. A category never changes what a row's count means.
 * @property {Array<{programId: string, templateId: ?string, month: string, recipientClass: RecipientClass, bounceType: ?string, message: ?string, category?: ?string, count: number, provenance: RowProvenance, pulledAt: string}>} bounceReasons
 *   bounced attempts by the reason the mail service gave (null message with
 *   category "other" = not in any category, or no reason recorded);
 *   additive, and per program × month they sum to the send tables' bounced
 * @property {Array<{programId: string, message: ?string, category?: ?string, expected?: boolean, participants: number, occurrences: number}>} participantFailures
 *   participants a program could not admit (refused at entry), all time. A
 *   participant with two reasons is counted under each. `expected` (additive,
 *   S3b) marks a category the pull was told is expected by design (a page
 *   leaves it out of headline counts, never hides it). On CLI 1.0.10 the
 *   reason field takes no filter, so each program has ONE row, category
 *   "other", and meta.health.categories.participantFailures says why; the
 *   split by reason is `entrySamples`, a sample.
 * @property {Array<{programId: string, state: ?string, participants: number}>} participantStates
 *   the program's participants by state (ACTIVE, COMPLETED, DROP, KNOCKED_OFF,
 *   PAUSED, REVIEW, SYSTEM_ERROR), all time
 * @property {Array<{programId: string, name: ?string, statuses: string[], selected: boolean, lastSendDay: ?string, lastSendMonth: ?string}>} lastSends
 *   each program's last send: the day, when it falls inside meta.health.dayWindow;
 *   else the month, when it falls inside the pull's window; else neither.
 *   selected false = a listed Active program the pull holds no sends for.
 *   Which programs are on which health list is a reader's rule
 *   (programHealth), not stored.
 * @property {Array<{programId: string, asOf: ?string, source?: "kb"|"live", scheduleType: ?string, classification: string, cronExpression: ?string, timeZoneName: ?string, startTime?: ?number, endTime?: ?number, lastRunSuccess: ?boolean, lastSuccessTime: ?number, nextRunTime: ?number, runningNow: ?boolean}>} schedules
 *   each schedule as the tenant KB's program doc records it, as of the date
 *   the doc was last verified (source "kb"; "live" only on a snapshot made
 *   while the capped live read existed, 0.47.0 unreleased). startTime and
 *   endTime (additive, F-491; epoch milliseconds) bound the schedule: a
 *   schedule past its end has ended. The run-state fields are stored as
 *   documented and are NEVER read as a run result (unset on the measured
 *   tenant even where runs succeed daily). A documented program with no
 *   schedule has ONE row, classification "no schedule captured"; a program
 *   the KB has no full doc for has none.
 * @property {Array<{programId: string, part: "bounceReasons"|"participantFailures", message: string, category?: ?string, kind?: ?string, expected?: boolean, count?: number, occurrences?: number, pulledAt?: string}>} [failureSamples]
 *   a capped sample of the masked text per program and part, for extending the
 *   category list (S3b), read one small page per program over the window its
 *   count was made over (F-484, redesigned 2026-10-08): the refusals still
 *   happening in meta.health.dayWindow, the most repeated first; the
 *   uncategorised bounce text of the pull's window, newest first. `category`
 *   and `expected` (additive, F-491) are the category the text matched
 *   client-side and whether it is a business rule; `kind` (additive, F-491
 *   2026-10-08) its FAILURE_KINDS kind. A text NO category matches is category
 *   "unclassified", kind "unknown" (F-484, redesigned 2026-10-08) — never null
 *   (null only on a snapshot made before that); `count` is how many rows of
 *   the page carried the text (participants) and `occurrences` (additive,
 *   F-484 2026-10-08) how many times those participants were refused in all;
 *   `pulledAt` the pull that read it (a program whose failure counts over the
 *   same window did not move keeps the earlier pull's sample). SNAPSHOT
 *   ONLY: shown by the terminal, never embedded in a page. Absent on a
 *   snapshot made before it existed.
 * @property {Array<{programId: string, category: string, kind?: string, expected: boolean, participants: number, occurrences?: number, sampleRows: number, pulledAt: string}>} [entrySamples]
 *   the refusals of each program's sample by category, with its kind (additive,
 *   F-491): a SAMPLE of the most repeated refusals still happening in the day
 *   window, never a count — `sampleRows` is the page it was taken from, and
 *   `occurrences` (additive, F-484 2026-10-08) the refusals in all behind the
 *   `participants` rows; the exact totals are `participantFailures` and
 *   `entryFailures`. Text no category matches is category "unclassified", kind
 *   "unknown" (F-484, redesigned 2026-10-08; "other" on an earlier snapshot).
 *   A page may show it, labelled as a sample.
 * @property {Array<{programId: string, sourceType: ?string, lastSyncedOn: ?string, operation: ?string}>} [sources]
 *   each selected program's active participant sources and when each last
 *   synced (additive, F-491): the ingest heartbeat, read tenant-wide at the
 *   pull. null lastSyncedOn = never synced.
 * @property {Array<{programId: string, day: string, participants: number}>} [admissions]
 *   participants admitted (created) per program and day inside
 *   meta.health.dayWindow (additive, F-491). A day with none has no row.
 * @property {Array<{programId: string, month: string, participants: number, occurrences: number}>} [entryFailures]
 *   refusals per program and month over the pull's window, exact (additive,
 *   F-491): rows of the failed-participants object by the month they were last
 *   refused in, and the SUM of their occurrences.
 * @property {Array<{programId: string, month: string, category: string, kind?: string, expected: boolean, participants: number}>} [stepFailures]
 *   participants who got in and fell off at a step, per program and month,
 *   counted server-side by category (STEP_FAILURE_CATEGORIES; additive, F-491):
 *   a text category by CONTAINS on the participant's failure reason, the
 *   platform error by its state, "unclassified" (kind "unknown"; "other" on a
 *   snapshot made before F-484's 2026-10-08 redesign) = the total with a reason
 *   less every category: wordings the shipped list does not name, a failure
 *   needing investigation (below zero only when categories overlap; flagged,
 *   never clamped).
 *
 * @typedef {object} T10Dimensions
 * @property {Array<{id: string, name: ?string, statuses: string[], model: ?string, modelName: ?string, audienceType: ?string, supergroup: ?string, group: ?string, folderId: ?string, schedule?: ?{classification: string, cronExpression: ?string, timeZoneName: ?string, startTime?: ?number, endTime?: ?number, asOf: ?string}, syncScheduleDisabled?: ?boolean, modifiedAt?: ?string}>} programs
 *   statuses is a LIST (a Dynamic Program edited while live carries two);
 *   supergroup and group are null until the grouping resolver fills them (DSH-5).
 *   schedule (additive, S3b) rides every pull made with a KB, whether or not
 *   health was pulled: the program's schedule from its KB doc (the recurring
 *   one with the shortest period when it has several), classification as the
 *   schedule audit classifies it, with its start and end (additive, F-491;
 *   epoch milliseconds), as of the doc's last verified date; "no schedule
 *   captured" for a documented program with none; null for a program the KB
 *   has no full doc for, and on every program of a pull made without a KB.
 *   The grouping resolver's `recurring` and the health signals read it here.
 *   syncScheduleDisabled (additive, F-491): what `jo p list` says of the
 *   program's participant sync; null when the list did not say.
 *   modifiedAt (additive, F-491 redesigned 2026-10-08; ISO): when the list said
 *   the program was last modified; null when it did not say (a program the
 *   list lacked, described live). A doc written before it is behind the
 *   tenant: honesty.kb names those programs and the undocumented ones.
 * @property {Array<{id: string, name: ?string, uses: Array<{programId: string, stepName: ?string, stepOrder: ?number, stepCount: number, asOf?: ?string}>}>} templates
 *   stepName and stepOrder are set only when the template sits on exactly ONE
 *   step of that program's design (stepCount 1); 0 = no design in the KB.
 *   asOf (additive, S3b): the date the program's doc was last verified, which
 *   the step name is as of; null with no design
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
 * @property {{pulled: boolean, reason: ?string, asOf: ?string, dayWindow: ?{start: string, endExclusive: string}, parts: Object<string, {pulled: boolean, reason: ?string, basis?: string}>, categories?: Object<string, {counted: boolean, reason: ?string, ids: string[]}>, samples?: Object<string, {cap: number, sampled: number, carried: number, notSampled: Array<{programId: string, reason: string}>, programs?: string[], window?: {start: string, endExclusive: string}, counts?: Object<string, number>}>}} [health]
 *   whether facts.health was read (the run's choice: reason "health-off" when
 *   it was not), and then part by part (bounceReasons, participantFailures,
 *   participantStates, lastSends, schedules, failureSamples, entrySamples,
 *   sources, admissions, entryFailures, stepFailures). asOf is the
 *   day silence is counted back from, and dayWindow the days a last send is
 *   known to the day. A part's `basis` (additive, S3b) says what its figures
 *   are over: "window", "lookback", "all-time" (the REASONS id a page renders
 *   as the tooltip of an all-time figure), "as-documented", "sample" or
 *   "at-pull". `categories` (additive, S3b), per reason part: whether its rows
 *   were counted by category, the reason when they could not be (REASONS
 *   "not-filterable"), and the category ids counted. `samples` (additive,
 *   F-491), per sampled part: the cap, how many programs were sampled at this
 *   pull, how many keep an earlier pull's sample, which were not sampled and
 *   why, and (additive, F-484 2026-10-08) the `window` the samples were read
 *   over with the `counts` (program → failures in it) they were picked from.
 *   ABSENT on a snapshot made before health facts existed: read it
 *   through healthAvailability, never directly.
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
import { readFileSync, appendFileSync, existsSync, mkdirSync, statSync } from "node:fs";
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
import { classifySchedule } from "./jo-report-audit-active.mjs";
import {
  SOURCES, NON_CONTENT_LINK_RULES, SEND_MEASURES, T10_SCHEMA_VERSION, measuresCounted, rollUpTracking, openSnapshot, accountAvailability, healthAvailability, maskMessage,
  categoryTable, validateCategories, OTHER_CATEGORY, UNCLASSIFIED_CATEGORY, UNKNOWN_KIND, FAILURE_CATEGORIES, STEP_FAILURE_CATEGORIES, cronLastDue, QUIET_DUE_DAYS_DEFAULT, kindOf, isExpectedKind,
} from "./engagement-query.mjs";

const here = dirname(fileURLToPath(import.meta.url));

// The objects read, and what every count on them carries: one statement, in SOURCES.
const { log: LOG_SRC, steps: JO_SRC, survey: SURVEY_SRC, failedParticipants: FAILED_SRC, participants: PARTICIPANT_SRC, sources: PSC_SRC } = SOURCES;
const LOG = LOG_SRC.object;
const JO_LOG = JO_SRC.object;
const SURVEY = SURVEY_SRC.object;
const COMPANY = LOG_SRC.lookups.company.to;
const FAILED = FAILED_SRC.object;
const PARTICIPANTS = PARTICIPANT_SRC.object;
const PSC = PSC_SRC.object;
const standingValue = (src, field) => src.standing.find((c) => c.field === field)?.value;
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
// R18: click rate counts content links. The rules are data
// (NON_CONTENT_LINK_RULES, in engagement-query.mjs beside the metric they
// define); a link no rule names is content. A link that cannot be read counts
// as neither.
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

// ── Failure reasons: one participant's FailureReasons, masked ───────────────
/**
 * The reasons a participant could not be processed, as masked texts. The field
 * is JSON-typed, and the spike recorded its plain-row value only as "a short
 * product message", so this takes what it is given: a text, a JSON array or
 * object (bare, or inside the `{type=json, value=…, null=…}` wrapper another
 * JSON field arrives in), or an already-parsed value. Text that does not parse
 * is one reason. No reason at all is [null].
 * @param {unknown} raw
 * @returns {Array<?string>}
 */
export function readFailureReasons(raw) {
  let value = raw;
  if (typeof value === "string") {
    const text = value.trim();
    const body = /^\{type=json, value=([\s\S]*), null=(?:true|false)\}$/.exec(text)?.[1] ?? text;
    value = body;
    if (/^[[{"]/.test(body)) {
      try {
        value = JSON.parse(body);
      } catch { /* not JSON after all: the text is the reason */ }
    }
  }
  const texts = [];
  const take = (v) => {
    if (v == null || v === "") return;
    if (Array.isArray(v)) v.forEach(take);
    else if (typeof v === "object") {
      const named = [v.message, v.reason, v.failureReason, v.errorMessage].find((t) => typeof t === "string" && t);
      texts.push(named ?? JSON.stringify(v));
    } else texts.push(String(v));
  };
  take(value);
  const masked = [...new Set(texts.map(maskMessage).filter((t) => t != null))];
  return masked.length ? masked : [null];
}

// ── Field specs, aliases and cells ───────────────────────────────────────────
const cond = (fieldName, operator, value) => ({ leftOperand: { fieldName }, operator, rightOperand: { value } });
const hop = ({ leaf, through, to }) => ({ fieldPath: { leaf, hops: [{ through, to }] } });
const standing = (src) => src.standing.map((c) => cond(c.field, c.op, c.value));
const byMonth = (name) => ({ name, summarize: "Month" });
const countOf = { name: "Gsid", aggregation: "COUNT" };
const distinct = (path) => ({ ...path, aggregation: "COUNT_DISTINCT" });
const PATH = {
  company: hop(LOG_SRC.lookups.company),
  person: hop(LOG_SRC.lookups.person),
  surveyProgram: hop(SURVEY_SRC.lookups.program),
  participant: hop(JO_SRC.lookups.participant),
  logRow: hop(JO_SRC.lookups.logRow),
};
// How the CLI names result columns (read off the response samples).
const col = {
  field: (obj, name) => `${obj}_${name}`,
  month: (obj, name) => `summarize_month_of_${obj}_${name}`,
  day: (obj, name) => `summarize_day_of_${obj}_${name}`,
  count: (obj) => `count_of_${obj}_Gsid`,
  sum: (obj, name) => `sum_of_${obj}_${name}`,
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
// Day buckets carry the same sortable `k`.
const cellDay = (cell) => {
  const k = cell && typeof cell === "object" ? cell.k : null;
  return typeof k === "string" && /^\d{4}-\d{2}-\d{2}/.test(k) ? k.slice(0, 10) : null;
};
// A free-text cell: a bounce reason comes back in `fv`, and in `v` too on only
// some rows. A null group has neither (`fv` is then the empty string).
const cellRaw = (cell) => (cell && typeof cell === "object" ? cell.v ?? (cell.fv === "" ? null : cell.fv) ?? null : null);
// A DATETIME cell: `k` is the sortable "YYYY-MM-DD HH:MM:SS"; `v` and `fv` are display forms. Null when unset.
const cellTime = (cell) => {
  const k = cell && typeof cell === "object" ? cell.k ?? cell.v : null;
  return typeof k === "string" && /^\d{4}-\d{2}-\d{2}/.test(k) ? k : null;
};
const str = (v) => (v == null ? null : String(v));
// A row's flags, as SOURCES names them: set when the field holds the value that
// counts (email_log_v2 flags are YES/NO strings; ao_emails flags are booleans),
// and not set on anything else, a null included. Which measures a flag
// combination adds to is the registry's rule (measuresCounted), not this file's.
const flagsOf = (src) => (row) => Object.fromEntries(Object.entries(src.flags).map(([flag, def]) => [flag, cellValue(row[col.field(src.object, def.field)]) === def.value]));
const logFlags = flagsOf(LOG_SRC);
const joFlags = flagsOf(JO_SRC);
const logKey = (row) => ({ programId: str(cellValue(row[col.field(LOG, LOG_SRC.programField)])), month: cellMonth(row[col.month(LOG, LOG_SRC.dateField)]), n: cellNumber(row[col.count(LOG)]) });
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
  "click-json": (row, unsubscribeLinks = []) => ({ id: str(cellValue(row[col.field(LOG, "Gsid")])), ...readLinkClicks(cellValue(row[col.field(LOG, LOG_SRC.clicks.detailField)]), unsubscribeLinks) }),
  "resp-month": (row) => ({ programId: str(cellValue(row[col.hop(PATH.surveyProgram)])), month: cellMonth(row[col.month(SURVEY, SURVEY_SRC.dateField)]), status: cellValue(row[col.field(SURVEY, SURVEY_SRC.statusField)]), n: cellNumber(row[col.count(SURVEY)]) }),
  "resp-participants": (row) => ({ programId: str(cellValue(row[col.hop(PATH.surveyProgram)])), n: cellNumber(row[col.count(SURVEY)]) }),
  "resp-unattributed": (row) => ({ n: cellNumber(row[col.count(SURVEY)]) }),
  "resp-test": (row) => ({ programId: str(cellValue(row[col.hop(PATH.surveyProgram)])), n: cellNumber(row[col.count(SURVEY)]) }),
  "resp-total": (row) => ({ programId: str(cellValue(row[col.hop(PATH.surveyProgram)])), status: cellValue(row[col.field(SURVEY, SURVEY_SRC.statusField)]), n: cellNumber(row[col.count(SURVEY)]) }),
  "account-names": (row) => ({ key: str(cellValue(row[col.field(COMPANY, "Gsid")])), name: str(cellValue(row[col.field(COMPANY, "Name")])) }),
  step: (row) => ({
    programId: str(cellValue(row[col.field(JO_LOG, JO_SRC.programField)])), month: cellMonth(row[col.month(JO_LOG, JO_SRC.dateField)]), n: cellNumber(row[col.count(JO_LOG)]),
    stepId: str(cellValue(row[col.field(JO_LOG, "StepId")])), templateId: str(cellValue(row[col.field(JO_LOG, "EmailTemplateId")])),
    variantId: str(cellValue(row[col.field(JO_LOG, "EmailTemplateVarianceId")])), variantName: str(cellValue(row[col.field(JO_LOG, "EmailTemplateVarianceName")])), flags: joFlags(row),
  }),
  "step-click": (row) => ({ sendId: str(cellValue(row[col.hop(PATH.logRow)])), stepId: str(cellValue(row[col.field(JO_LOG, "StepId")])), variantId: str(cellValue(row[col.field(JO_LOG, "EmailTemplateVarianceId")])) }),
  "participants-month": (row) => ({ programId: str(cellValue(row[col.field(JO_LOG, JO_SRC.programField)])), month: cellMonth(row[col.month(JO_LOG, JO_SRC.dateField)]), participants: cellNumber(row[col.distinct(PATH.participant)]) }),
  "participants-window": (row) => ({ programId: str(cellValue(row[col.field(JO_LOG, JO_SRC.programField)])), participants: cellNumber(row[col.distinct(PATH.participant)]) }),
  // The count-first reads (S3b): clicked and bounced attempts per program × month, which price the click and bounce-count families.
  "count-clicks": (row) => logKey(row),
  "count-bounces": (row) => logKey(row),
  // Health (HLT-1). The two that carry a message are read at FETCH time: what
  // reaches disk is the masked text, never the address or id it named.
  // Bounce reasons are COUNTED by category (S3b): the total and each category
  // share one reader, per program × template × month × type.
  "health-bounce-total": (row) => ({ ...logKey(row), templateId: str(cellValue(row[col.field(LOG, LOG_SRC.templateField)])), bounceType: str(cellValue(row[col.field(LOG, LOG_SRC.bounce.typeField)])) }),
  "health-bounce-cat": (row) => ({ ...logKey(row), templateId: str(cellValue(row[col.field(LOG, LOG_SRC.templateField)])), bounceType: str(cellValue(row[col.field(LOG, LOG_SRC.bounce.typeField)])) }),
  "health-bounce-sample": (row) => {
    const raw = cellRaw(row[col.field(LOG, LOG_SRC.bounce.reasonField)]);
    return { programId: str(cellValue(row[col.field(LOG, LOG_SRC.programField)])), message: maskMessage(raw == null ? null : String(raw)) };
  },
  // Failed participants: a per-program total (rows and occurrences), the one read the object allows (S3b).
  "health-reasons-total": (row) => ({ programId: str(cellValue(row[col.field(FAILED, FAILED_SRC.programField)])), n: cellNumber(row[col.count(FAILED)]), occurrences: cellNumber(row[col.sum(FAILED, FAILED_SRC.occurrencesField)]) }),
  "health-reasons-sample": (row) => ({ programId: str(cellValue(row[col.field(FAILED, FAILED_SRC.programField)])), messages: readFailureReasons(cellRaw(row[col.field(FAILED, FAILED_SRC.reasonField)])), occurrences: cellNumber(row[col.field(FAILED, FAILED_SRC.occurrencesField)]) }),
  "health-states": (row) => ({ programId: str(cellValue(row[col.field(PARTICIPANTS, PARTICIPANT_SRC.programField)])), state: str(cellValue(row[col.field(PARTICIPANTS, PARTICIPANT_SRC.stateField)])), n: cellNumber(row[col.count(PARTICIPANTS)]) }),
  "health-days": (row) => ({ programId: str(cellValue(row[col.field(LOG, LOG_SRC.programField)])), day: cellDay(row[col.day(LOG, LOG_SRC.dateField)]), n: cellNumber(row[col.count(LOG)]) }),
  // The health signals' own reads (F-491): the sync heartbeat per source, admissions per day, refusals per
  // month, and step failures per month (the total, each text category and the error state share one reader).
  "health-sources": (row) => ({ programId: str(cellValue(row[col.field(PSC, PSC_SRC.programField)])), sourceType: str(cellValue(row[col.field(PSC, PSC_SRC.typeField)])), lastSyncedOn: cellTime(row[col.field(PSC, PSC_SRC.syncedField)]), operation: str(cellValue(row[col.field(PSC, PSC_SRC.operationField)])) }),
  "health-admissions": (row) => ({ programId: str(cellValue(row[col.field(PARTICIPANTS, PARTICIPANT_SRC.programField)])), day: cellDay(row[col.day(PARTICIPANTS, PARTICIPANT_SRC.createdField)]), n: cellNumber(row[col.count(PARTICIPANTS)]) }),
  "health-entry-month": (row) => ({ programId: str(cellValue(row[col.field(FAILED, FAILED_SRC.programField)])), month: cellMonth(row[col.month(FAILED, FAILED_SRC.dateField)]), n: cellNumber(row[col.count(FAILED)]), occurrences: cellNumber(row[col.sum(FAILED, FAILED_SRC.occurrencesField)]) }),
  "health-entry-window": (row) => ({ programId: str(cellValue(row[col.field(FAILED, FAILED_SRC.programField)])), n: cellNumber(row[col.count(FAILED)]), occurrences: cellNumber(row[col.sum(FAILED, FAILED_SRC.occurrencesField)]) }),
  "health-step-total": (row) => ({ programId: str(cellValue(row[col.field(PARTICIPANTS, PARTICIPANT_SRC.programField)])), month: cellMonth(row[col.month(PARTICIPANTS, PARTICIPANT_SRC.dateField)]), n: cellNumber(row[col.count(PARTICIPANTS)]) }),
  "health-step-cat": (row) => ({ programId: str(cellValue(row[col.field(PARTICIPANTS, PARTICIPANT_SRC.programField)])), month: cellMonth(row[col.month(PARTICIPANTS, PARTICIPANT_SRC.dateField)]), n: cellNumber(row[col.count(PARTICIPANTS)]) }),
  "health-step-state": (row) => ({ programId: str(cellValue(row[col.field(PARTICIPANTS, PARTICIPANT_SRC.programField)])), month: cellMonth(row[col.month(PARTICIPANTS, PARTICIPANT_SRC.dateField)]), n: cellNumber(row[col.count(PARTICIPANTS)]) }),
});

// ── Queries, as data ─────────────────────────────────────────────────────────
// A unit descriptor says WHAT is asked: family, class, window, program batch.
// buildQuery turns it into a field-spec; rpRunArgv turns that into argv.
// The last rung of the split ladder (F-472): the address field of each send
// log, and the characters a unit is cut on, one per level. CONTAINS and
// DOES_NOT_CONTAINS on the same character are each other's complement, so the
// two halves hold every send once. Only a character ever reaches a filter.
const ADDRESS_FIELD = { [LOG]: LOG_SRC.addressField, [JO_LOG]: JO_SRC.addressField };
// Letters and digits only: a punctuation mark could read as a pattern wildcard.
const ADDRESS_CUTS = [..."aeiornsltmcdhupbgkyfwvjzxq0123456789"];
const flagFields = (src) => Object.values(src.flags).map((f) => f.field);
const LOG_FLAGS = flagFields(LOG_SRC);
const JO_FLAGS = flagFields(JO_SRC);
// The two flags a full unit is cut on, in this order (opened first: it halves a sent-heavy unit best).
const cutFlags = (src) => [src.flags.opened.field, src.flags.wentOut.field];
const flagValue = (src, field) => Object.values(src.flags).find((f) => f.field === field)?.value;
const sourceOf = (object) => (object === JO_LOG ? JO_SRC : LOG_SRC);
const suffix = (domain) => (domain.startsWith("@") ? domain : `@${domain}`);

// The recipient classes a unit reads (S3b adds the test accounts, which join
// the internal class): "all"; "internal" (one domain); "external" (every
// domain left out, and the test accounts left out with NOT_IN, which keeps
// the sends with no company); "test" (the test accounts' sends); and
// "test-internal" (a test account's sends on an internal domain: counted in
// both calls, so subtracted once).
const COMPANY_FIELD = LOG_SRC.lookups.company.through;
function logWhere(d, { source = true } = {}) {
  if (!d.window?.start || !d.window?.end) throw new Error(`engagement: ${d.family} has no two-sided window`);
  const w = [];
  if (source) w.push(...standing(LOG_SRC));
  w.push(cond(LOG_SRC.dateField, "GTE", d.window.start), cond(LOG_SRC.dateField, "LT", d.window.end));
  if (d.programs) w.push(cond(LOG_SRC.programField, "IN", d.programs));
  if (d.cls === "internal" || d.cls === "test-internal") w.push(cond(LOG_SRC.addressField, "ENDS_WITH", suffix(d.domain)));
  if (d.cls === "external") {
    for (const dom of d.domains) w.push(cond(LOG_SRC.addressField, "DOES_NOT_CONTAINS", suffix(dom)));
    if (d.testAccounts?.length) w.push(cond(COMPANY_FIELD, "NOT_IN", d.testAccounts));
  }
  if (d.cls === "test" || d.cls === "test-internal") w.push(cond(COMPANY_FIELD, "IN", d.testAccounts));
  for (const p of d.partition ?? []) w.push(cond(p.field, p.op, p.value));
  return w;
}
function joWhere(d) {
  if (!d.window?.start || !d.window?.end) throw new Error(`engagement: ${d.family} has no two-sided window`);
  const w = [...standing(JO_SRC), cond(JO_SRC.dateField, "GTE", d.window.start), cond(JO_SRC.dateField, "LT", d.window.end)];
  if (d.programs) w.push(cond(JO_SRC.programField, "IN", d.programs));
  if (d.cls === "internal") w.push(cond(JO_SRC.addressField, "ENDS_WITH", suffix(d.domain)));
  if (d.cls === "external") for (const dom of d.domains) w.push(cond(JO_SRC.addressField, "DOES_NOT_CONTAINS", suffix(dom)));
  for (const p of d.partition ?? []) w.push(cond(p.field, p.op, p.value));
  return w;
}
// One lookup per call (F-473): a call that counts through two lookups drops the
// sends that lack either one, so each distinct count is asked on its own.
const uniqueShow = (d) => [distinct(d.of === "accounts" ? PATH.company : PATH.person)];
const noCompany = () => cond(LOG_SRC.lookups.company.through, "IS_NULL");
const clickedOnly = () => cond(LOG_SRC.clicks.countField, "GT", 0);
const clickCount = { name: LOG_SRC.clicks.countField, aggregation: "COUNT" };
const logMonth = byMonth(LOG_SRC.dateField);
const joMonth = byMonth(JO_SRC.dateField);
const logProgram = { name: LOG_SRC.programField };
const joProgram = { name: JO_SRC.programField };
const logTemplate = { name: LOG_SRC.templateField };
// Survey figures leave out test participants, as the UI's program analytics
// does (F-474). EQ on a boolean is the filter shape measured on this object
// (Responded EQ true); a row whose flag is null would be left out with the tests.
const notTest = () => standing(SURVEY_SRC);
const testOnly = () => SURVEY_SRC.standing.map((c) => cond(c.field, c.op, !c.value));
const responded = () => cond(SURVEY_SRC.responded.field, SURVEY_SRC.responded.op, SURVEY_SRC.responded.value);
const surveyStatus = { name: SURVEY_SRC.statusField };

// family → {object, how it may be split, the query}. `split` is the order a
// truncated or twice-timed-out unit is cut in; uniques are distinct counts, so
// they are never cut inside a month, and a whole-window count never by time.
const FAMILIES = {
  // The program totals: every send, through no lookup. Which programs have
  // sends, and what the template table must sum to, are read from this.
  totals: { object: LOG, split: ["programs", "day"], query: (d) => ({ group: [logProgram, logMonth], show: [countOf], where: logWhere(d) }) },
  "uniques-month": { object: LOG, split: ["programs", "month"], query: (d) => ({ group: [logProgram, logMonth], show: uniqueShow(d), where: logWhere(d) }) },
  "uniques-window": { object: LOG, split: ["programs"], query: (d) => ({ group: [logProgram], show: uniqueShow(d), where: logWhere(d) }) },
  "sent-since": { object: LOG, split: ["programs", "day"], query: (d) => ({ group: [logProgram], show: [countOf], where: logWhere(d) }) },
  classes: { object: LOG, split: ["day"], query: (d) => ({ group: LOG_SRC.standing.map((c) => ({ name: c.field })), show: [countOf], where: logWhere(d, { source: false }) }) },
  template: {
    object: LOG, split: ["programs", "day", "flags", "address"], flags: cutFlags(LOG_SRC),
    query: (d) => ({
      group: [logProgram, logTemplate, { name: "EmailTemplateName" }, logMonth, ...LOG_FLAGS.map((name) => ({ name }))],
      show: [countOf], where: logWhere(d),
    }),
  },
  account: {
    object: LOG, split: ["programs", "day", "flags", "address"], flags: cutFlags(LOG_SRC),
    query: (d) => ({ group: [logProgram, PATH.company, logMonth, ...LOG_FLAGS.map((name) => ({ name }))], show: [countOf], where: logWhere(d) }),
  },
  // The sends with no company link, which the account call above never returns.
  "account-nolink": {
    object: LOG, split: ["programs", "day", "flags", "address"], flags: cutFlags(LOG_SRC),
    query: (d) => ({ group: [logProgram, logMonth, ...LOG_FLAGS.map((name) => ({ name }))], show: [countOf], where: [...logWhere(d), noCompany()] }),
  },
  // Clicked sends, twice: who and when (grouped, so the month is the server's
  // bucket like every other fact), and what was clicked (plain rows, the one
  // shape LinkClickedJson is known to come back in). Joined on the row's Gsid.
  // The count is of a field the query does not group by: COUNT of Gsid beside
  // a group on Gsid is dropped by the CLI, which then refuses the call (F-471).
  "click-attr": {
    object: LOG, split: ["programs", "day", "address"],
    query: (d) => ({ group: [logProgram, logTemplate, logMonth, PATH.company, { name: "Gsid" }], show: [clickCount], where: [...logWhere(d), clickedOnly()] }),
  },
  "click-attr-nolink": {
    object: LOG, split: ["programs", "day", "address"],
    query: (d) => ({ group: [logProgram, logTemplate, logMonth, { name: "Gsid" }], show: [clickCount], where: [...logWhere(d), clickedOnly(), noCompany()] }),
  },
  "click-json": {
    object: LOG, split: ["programs", "day", "address"], sanitize: "clicks",
    query: (d) => ({ group: [], show: [{ name: "Gsid" }, { name: LOG_SRC.clicks.detailField }], where: [...logWhere(d), clickedOnly()] }),
  },
  "resp-month": {
    object: SURVEY, split: ["day"],
    query: (d) => ({
      group: [PATH.surveyProgram, byMonth(SURVEY_SRC.dateField), surveyStatus], show: [countOf],
      where: [responded(), ...notTest(), cond(SURVEY_SRC.dateField, "GTE", d.window.start), cond(SURVEY_SRC.dateField, "LT", d.window.end)],
    }),
  },
  "resp-participants": { object: SURVEY, split: [], query: () => ({ group: [PATH.surveyProgram], show: [countOf], where: notTest() }) },
  // The test participants left out, per program: an honesty count.
  "resp-test": { object: SURVEY, split: [], query: () => ({ group: [PATH.surveyProgram], show: [countOf], where: testOnly() }) },
  // Survey rows no program owns: the calls above go through the participant
  // lookup, so they never return these.
  "resp-unattributed": { object: SURVEY, split: [], query: () => ({ group: [], show: [countOf], where: [cond(SURVEY_SRC.lookups.program.through, "IS_NULL")] }) },
  // All time, like the denominator above: resp-month's query without its month
  // bucket and its window, so the two count a response the same way.
  "resp-total": { object: SURVEY, split: [], query: () => ({ group: [PATH.surveyProgram, surveyStatus], show: [countOf], where: [responded(), ...notTest()] }) },
  "account-names": { object: COMPANY, split: ["keys"], query: (d) => ({ group: [], show: [{ name: "Gsid" }, { name: "Name" }], where: [cond("Gsid", "IN", d.keys)] }) },
  // Step detail only (R21): the JO send log, windowed on CreatedAt.
  step: {
    object: JO_LOG, split: ["programs", "day", "flags", "address"], flags: cutFlags(JO_SRC),
    query: (d) => ({
      group: [joProgram, { name: "StepId" }, { name: JO_SRC.templateField }, { name: "EmailTemplateVarianceId" }, { name: "EmailTemplateVarianceName" }, joMonth, ...JO_FLAGS.map((name) => ({ name }))],
      show: [countOf], where: joWhere(d),
    }),
  },
  "step-click": {
    object: JO_LOG, split: ["programs", "day", "address"],
    query: (d) => ({ group: [joProgram, { name: "StepId" }, { name: "EmailTemplateVarianceId" }, PATH.logRow], show: [countOf], where: [...joWhere(d), cond(JO_SRC.clicks.flagField, "EQ", true)] }),
  },
  "participants-month": { object: JO_LOG, split: ["programs", "month"], query: (d) => ({ group: [joProgram, joMonth], show: [distinct(PATH.participant)], where: joWhere(d) }) },
  "participants-window": { object: JO_LOG, split: ["programs"], query: (d) => ({ group: [joProgram], show: [distinct(PATH.participant)], where: joWhere(d) }) },
  // The count-first read (S3b): clicked sends per program × month, one cheap call, which prices the three click families.
  "count-clicks": { object: LOG, split: ["programs", "day"], query: (d) => ({ group: [logProgram, logMonth], show: [countOf], where: [...logWhere(d), clickedOnly()] }) },
  "count-bounces": { object: LOG, split: ["programs", "day"], query: (d) => ({ group: [logProgram, logMonth], show: [countOf], where: [...logWhere(d), bouncedOnly()] }) },
  // Health (HLT-1). `health` names the part of facts.health a family fills; a
  // health call that fails marks that part as not read and never fails the pull.
  // Bounced attempts, COUNTED (S3b, F-484): the total per program × template ×
  // month × type, then one call per category with its CONTAINS filter on the
  // reason; counts, so any cut of the sends adds up. The text is never grouped.
  "health-bounce-total": {
    object: LOG, split: ["programs", "day"], health: "bounceReasons",
    query: (d) => ({ group: [logProgram, logTemplate, logMonth, { name: LOG_SRC.bounce.typeField }], show: [countOf], where: [...logWhere(d), bouncedOnly()] }),
  },
  "health-bounce-cat": {
    object: LOG, split: ["programs", "day"], health: "bounceReasons",
    query: (d) => ({ group: [logProgram, logTemplate, logMonth, { name: LOG_SRC.bounce.typeField }], show: [countOf], where: [...logWhere(d), bouncedOnly(), cond(LOG_SRC.bounce.reasonField, "CONTAINS", d.category.pattern)] }),
  },
  // A SAMPLE of the bounce text no category names, masked at fetch: plain rows, one small page PER PROGRAM
  // (d.programs names the one), newest first, never split (F-484: a tenant-wide page is one program's).
  "health-bounce-sample": {
    object: LOG, split: [], sample: true, sanitize: "messages", health: "failureSamples",
    query: (d) => ({ group: [], show: [logProgram, { name: LOG_SRC.bounce.reasonField }, { name: LOG_SRC.dateField }], where: [...logWhere(d), bouncedOnly(), ...(d.excludePatterns ?? []).map((p) => cond(LOG_SRC.bounce.reasonField, "DOES_NOT_CONTAINS", p))], orderBy: [{ name: LOG_SRC.dateField, order: "DESC" }] }),
  },
  // Program × day over a recent window: a program's last send day. The server has no latest-date aggregate.
  "health-days": { object: LOG, split: ["programs", "day"], health: "lastSends", query: (d) => ({ group: [logProgram, { name: LOG_SRC.dateField, summarize: "Day" }], show: [countOf], where: logWhere(d) }) },
  // Failed participants: the per-program total (rows and occurrences), tenant-wide in one grouped call. The
  // reason field takes no filter on this CLI (its schema says so), so there is no breakdown and no row read
  // beyond the per-program samples below (S3b; the row read F-484 measured at order 10^6 is retired).
  "health-reasons-total": {
    object: FAILED, split: ["programs"], health: "participantFailures",
    query: (d) => ({ group: [{ name: FAILED_SRC.programField }], show: [countOf, { name: FAILED_SRC.occurrencesField, aggregation: "SUM" }], where: programsIn(FAILED_SRC, d) }),
  },
  // One program's refusals still happening in the day window (d.programs names the one; d.window IS the window
  // object of the health-entry-window count the program was picked from, F-484): a small page, the most
  // REPEATED first (measured 2026-10-08 on the largest program: the newest page held only its Send Email step's
  // wordings, the most repeated page the null-address wording that dominates it), never split.
  "health-reasons-sample": {
    object: FAILED, split: [], sample: true, sanitize: "messages", health: "failureSamples",
    query: (d) => ({ group: [], show: [{ name: FAILED_SRC.programField }, { name: FAILED_SRC.reasonField }, { name: FAILED_SRC.dateField }, { name: FAILED_SRC.occurrencesField }], where: [...datedWhere(FAILED_SRC, d), ...programsIn(FAILED_SRC, d)], orderBy: [{ name: FAILED_SRC.occurrencesField, order: "DESC" }] }),
  },
  // Cut by program only when a page comes back full, never on a timeout: this
  // object's group-bys time out unpredictably, and halving a batch down to
  // single programs after each pair of timeouts could cost more than the rest
  // of the pull. A batch that times out twice is recorded as not read.
  "health-states": { object: PARTICIPANTS, split: ["programs"], timeoutSplit: false, health: "participantStates", query: (d) => ({ group: [{ name: PARTICIPANT_SRC.programField }, { name: PARTICIPANT_SRC.stateField }], show: [countOf], where: [cond(PARTICIPANT_SRC.programField, "IN", d.programs)] }) },
  // The health signals' reads (F-491), each tenant-wide first (d.scope names the selected programs, so a
  // full page or a double timeout is cut by program): the active participant sources with their last sync,
  // admissions per program × day over the day window, refusals per program × month over the window, and
  // step failures per program × month over the window — the total with a reason, one CONTAINS call per text
  // category, and the platform's error state.
  "health-sources": {
    object: PSC, split: ["programs"], health: "sources",
    query: (d) => ({ group: [], show: [{ name: PSC_SRC.programField }, { name: PSC_SRC.typeField }, { name: PSC_SRC.syncedField }, { name: PSC_SRC.operationField }], where: [...standing(PSC_SRC), ...programsIn(PSC_SRC, d)] }),
  },
  "health-admissions": {
    object: PARTICIPANTS, split: ["programs", "day"], health: "admissions",
    query: (d) => ({ group: [{ name: PARTICIPANT_SRC.programField }, { name: PARTICIPANT_SRC.createdField, summarize: "Day" }], show: [countOf], where: [...datedWhere({ dateField: PARTICIPANT_SRC.createdField }, d), ...programsIn(PARTICIPANT_SRC, d)] }),
  },
  "health-entry-month": {
    object: FAILED, split: ["programs"], health: "entryFailures",
    query: (d) => ({ group: [{ name: FAILED_SRC.programField }, byMonth(FAILED_SRC.dateField)], show: [countOf, { name: FAILED_SRC.occurrencesField, aggregation: "SUM" }], where: [...datedWhere(FAILED_SRC, d), ...programsIn(FAILED_SRC, d)] }),
  },
  // The refusals still happening in the DAY window, per program: the count-first read the per-program samples
  // are picked from, over the very window object each sample page reads (F-484, redesigned 2026-10-08: picks
  // ranked over the month window and pages read over the day window returned empty pages that counted as
  // sampled). Measured 2026-10-08: 64 programs, one page, 5 seconds.
  "health-entry-window": {
    object: FAILED, split: ["programs"], health: "entryFailures",
    query: (d) => ({ group: [{ name: FAILED_SRC.programField }], show: [countOf, { name: FAILED_SRC.occurrencesField, aggregation: "SUM" }], where: [...datedWhere(FAILED_SRC, d), ...programsIn(FAILED_SRC, d)] }),
  },
  "health-step-total": {
    object: PARTICIPANTS, split: ["programs"], health: "stepFailures",
    query: (d) => ({ group: [{ name: PARTICIPANT_SRC.programField }, byMonth(PARTICIPANT_SRC.dateField)], show: [countOf], where: [cond(PARTICIPANT_SRC.reasonField, "IS_NOT_NULL"), ...datedWhere(PARTICIPANT_SRC, d), ...programsIn(PARTICIPANT_SRC, d)] }),
  },
  "health-step-cat": {
    object: PARTICIPANTS, split: ["programs"], health: "stepFailures",
    query: (d) => ({ group: [{ name: PARTICIPANT_SRC.programField }, byMonth(PARTICIPANT_SRC.dateField)], show: [countOf], where: [cond(PARTICIPANT_SRC.reasonField, "CONTAINS", d.category.pattern), ...datedWhere(PARTICIPANT_SRC, d), ...programsIn(PARTICIPANT_SRC, d)] }),
  },
  "health-step-state": {
    object: PARTICIPANTS, split: ["programs"], health: "stepFailures",
    query: (d) => ({ group: [{ name: PARTICIPANT_SRC.programField }, byMonth(PARTICIPANT_SRC.dateField)], show: [countOf], where: [cond(PARTICIPANT_SRC.stateField, "EQ", d.category.state), ...datedWhere(PARTICIPANT_SRC, d), ...programsIn(PARTICIPANT_SRC, d)] }),
  },
};
const isHealth = (d) => !!FAMILIES[d.family]?.health;
const bouncedOnly = () => cond(LOG_SRC.flags.bounced.field, "EQ", LOG_SRC.flags.bounced.value);
// The program filter of a unit cut by program, on the object's own program field; none on a tenant-wide unit.
const programsIn = (src, d) => (d.programs ? [cond(src.programField, "IN", d.programs)] : []);
// A two-sided window on the object's date field.
const datedWhere = (src, d) => {
  if (!d.window?.start || !d.window?.end) throw new Error(`engagement: ${d.family} has no two-sided window`);
  return [cond(src.dateField, "GTE", d.window.start), cond(src.dateField, "LT", d.window.end)];
};
// The objects only health reads. Any may be missing on a tenant; a part read from a missing one says no-schema.
const HEALTH_OBJECTS = { participantFailures: FAILED, participantStates: PARTICIPANTS, sources: PSC };
// Which of those objects each health part is read from (the parts read from the delivery log name none).
const PART_OBJECT = Object.freeze({ participantFailures: "participantFailures", entryFailures: "participantFailures", participantStates: "participantStates", admissions: "participantStates", stepFailures: "participantStates", sources: "sources" });
// The classification of the one row a documented program with no schedule keeps (the schedule audit's wording).
export const NO_SCHEDULE = "no schedule captured";
export const HEALTH_PARTS = Object.freeze(["bounceReasons", "participantFailures", "participantStates", "lastSends", "schedules", "failureSamples", "entrySamples", "sources", "admissions", "entryFailures", "stepFailures"]);
// What each part's figures are over (meta.health.parts[].basis; "all-time" is the REASONS id a page renders).
const PART_BASIS = Object.freeze({ bounceReasons: "window", participantFailures: "all-time", participantStates: "all-time", lastSends: "lookback", schedules: "as-documented", failureSamples: "sample", entrySamples: "sample", sources: "at-pull", admissions: "lookback", entryFailures: "window", stepFailures: "window" });
// A sample read is one page of at most this many rows per program, newest first, and is never split (it is a sample).
export const SAMPLE_PAGE = 100;
// How many masked texts the snapshot keeps per program and part (the most frequent in the page).
export const SAMPLES_PER_PROGRAM = 5;
// How many programs a pull samples per part, most failures first (--sample-programs raises it; the plan
// prices the rest). A program whose failure counts did not move since the previous snapshot keeps its sample.
export const SAMPLE_PROGRAM_CAP = 25;
// The row budget: a family whose count-first read says it holds more rows than
// this many pages is not read (a health part: reason too-large; the click
// detail: the plan refuses and says what to narrow).
export const MAX_PAGES = 40;
// The retired live family of `jo p describe` reads (S3b; F-491 retired it): a run made under 0.47.0
// unreleased may still log it, and loadRun ignores it.
const SCHEDULE_DESCRIBE = "schedule-describe";
/**
 * The days a program's last send is read to the day: the lookback, counted
 * back from today (or from the window's last day, when the window ends
 * earlier), never reaching before the window.
 * @param {*} params
 * @returns {{asOf: string, start: string, end: string}}
 */
export function healthDayWindow(params) {
  const lastDay = addDays(params.window.endExclusive, -1);
  const asOf = [params.today < lastDay ? params.today : lastDay, params.window.start].sort().pop();
  const start = [addDays(asOf, -(params.health.lookbackDays - 1)), params.window.start].sort().pop();
  return { asOf, start, end: addDays(asOf, 1) };
}

/** @returns {{object: string, show: Array<*>, group: Array<*>, where: Array<*>, orderBy?: Array<*>}} */
export function buildQuery(d) {
  const fam = FAMILIES[d.family];
  if (!fam) throw new Error(`engagement: unknown call family "${d.family}"`);
  return { object: fam.object, ...fam.query(d) };
}

/**
 * The ONE builder of `rp run` argv: --page-size is always passed, because
 * without it the CLI returns 50 rows and says nothing.
 * @param {{object: string, show: Array<*>, group: Array<*>, where: Array<*>, orderBy?: Array<*>}} q
 * @param {number} pageSize
 * @returns {string[]}
 */
export function rpRunArgv(q, pageSize) {
  const argv = ["--json", "rp", "run", "--object", q.object, "--show-fields", JSON.stringify(q.show)];
  if (q.group.length) argv.push("--group-by", JSON.stringify(q.group));
  if (q.where.length) argv.push("--where-filters", JSON.stringify({ conditions: q.where }));
  // A sample reads newest first (measured 2026-10-07: --order-by on a shown DATETIME field, DESC).
  if (q.orderBy?.length) argv.push("--order-by", JSON.stringify(q.orderBy));
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
 * silently, widening the query), a filter or group-by field must be declared
 * filterable or groupable by the schema (the server refuses a filter on one
 * that is not, whatever the operator: measured S3b), nothing may group or
 * aggregate on a LOOKUP by name (it resolves to an empty name and collapses
 * the groups), and nothing may be shown that is also grouped by (the CLI
 * drops that show field, whatever its aggregation, and refuses the call when
 * none is left).
 * @param {{object: string, show: Array<*>, group: Array<*>, where: Array<*>, orderBy?: Array<*>}} q
 * @param {Map<string, string>} types fieldName → dataType, from `rp schema`
 * @param {?Map<string, {filterable: boolean, groupable: boolean}>} [flags] fieldName → what the schema allows (schemaFlags); null = not checked
 * @returns {string[]} problems; empty when the query is safe to run
 */
export function validateQuery(q, types, flags = null) {
  const problems = [];
  const need = (name, role) => {
    if (!types.has(name)) problems.push(`${q.object}.${name} (${role}) is not in the object's schema`);
  };
  for (const c of q.where) {
    need(c.leftOperand.fieldName, "filter");
    if (flags?.get(c.leftOperand.fieldName)?.filterable === false) problems.push(`${q.object}.${c.leftOperand.fieldName} is declared not filterable by the object's schema — the server refuses a filter on it whatever the operator`);
  }
  for (const [role, entries] of /** @type {Array<[string, Array<*>]>} */ ([["group-by", q.group], ["show", q.show]])) {
    for (const e of entries) {
      if (e.fieldPath) {
        for (const h of e.fieldPath.hops) need(h.through, `${role} lookup hop`);
        continue;
      }
      need(e.name, role);
      if (types.get(e.name) === "LOOKUP" && (role === "group-by" || e.aggregation))
        problems.push(`${q.object}.${e.name} is a LOOKUP and may not be grouped or aggregated by name — use a fieldPath to the target's Gsid`);
      if (role === "group-by" && flags?.get(e.name)?.groupable === false) problems.push(`${q.object}.${e.name} is declared not groupable by the object's schema`);
    }
  }
  const grouped = new Set(q.group.map((e) => fieldKey(q.object, e)));
  for (const e of q.show) {
    if (grouped.has(fieldKey(q.object, e)))
      problems.push(`${fieldKey(q.object, e).replace("::", ".")} is shown and grouped by — the CLI drops a show field that a group-by field names, whatever its aggregation; show a field the query does not group by`);
  }
  // An order-by entry must be a shown or grouped field (the CLI's spec, §10.14).
  const named = new Set([...q.show, ...q.group].map((e) => fieldKey(q.object, e)));
  for (const e of q.orderBy ?? []) {
    if (!named.has(fieldKey(q.object, e))) problems.push(`${q.object}.${e.name} is ordered by but neither shown nor grouped by — the CLI refuses an order-by entry that is not in showFields or groupBy`);
  }
  return problems;
}

/** `rp schema` payload → fieldName → dataType, or null when the object has no schema. */
export function schemaTypes(payload) {
  const fields = payload?.data?.fields;
  if (!Array.isArray(fields) || !fields.length) return null;
  return new Map(fields.filter((f) => f && typeof f.fieldName === "string").map((f) => [f.fieldName, String(f.dataType ?? "")]));
}
/** `rp schema` payload → fieldName → what the schema allows (a flag the schema does not state reads as allowed). */
export function schemaFlags(payload) {
  const fields = payload?.data?.fields;
  if (!Array.isArray(fields) || !fields.length) return null;
  return new Map(fields.filter((f) => f && typeof f.fieldName === "string").map((f) => [f.fieldName, { filterable: f.meta?.filterable !== false, groupable: f.meta?.groupable !== false }]));
}

// A sample unit reads one page of at most SAMPLE_PAGE rows.
const unitPageSize = (d, pageSize) => (FAMILIES[d.family]?.sample ? Math.min(pageSize, SAMPLE_PAGE) : pageSize);
function unitArgv(d, pageSize) {
  if (d.family === "whoami") return ["whoami"];
  if (d.family === "programs") return ["--json", "jo", "p", "list", "--limit", "1000", "--page", String(d.page)];
  if (d.family === "schema") return ["--json", "rp", "schema", "--object", d.object];
  if (d.family === "describe") return ["--json", "jo", "p", "describe", "--id", d.programId];
  return rpRunArgv(buildQuery(d), unitPageSize(d, pageSize));
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
    // A tenant-wide unit that names its scope (the selected programs) is first cut into two program halves.
    if (how === "programs" && !d.programs && d.scope && d.scope.length > 1) {
      const mid = Math.ceil(d.scope.length / 2);
      const { scope: _s, ...rest } = d;
      return [{ ...rest, programs: d.scope.slice(0, mid) }, { ...rest, programs: d.scope.slice(mid) }];
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
        const yes = flagValue(sourceOf(fam.object), field);
        const rest = typeof yes === "boolean" ? { field, op: "EQ", value: false } : { field, op: "NE", value: yes }; // NE keeps nulls
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
  // The row budget, in pages: a family whose count-first read exceeds it is not read (S3b).
  const maxPages = raw.maxPages ?? MAX_PAGES;
  if (!Number.isInteger(maxPages) || maxPages < 1) throw new Error(`--max-pages must be a whole number >= 1 (got ${raw.maxPages})`);
  const incompleteFrom = raw.incompleteFrom ?? monthStart(today.slice(0, 7));
  if (!isDay(incompleteFrom)) throw new Error(`--incomplete-from must be YYYY-MM-DD (got "${incompleteFrom}")`);
  // Test accounts (S3b): company ids, never addresses; de-duplicated and sorted, so the same set in any order is the same run.
  const testAccounts = [...new Set((raw.testAccounts ?? []).map((s) => String(s).trim()).filter(Boolean))].sort();
  // The failure categories a pull counts with: the shipped list plus the tenant's own (--failure-categories),
  // and the expected reasons (--expected-reason) as participant categories flagged expected. Validated here
  // (every field text, ids unique, patterns disjoint as far as text can tell), so a bad list is refused before any call.
  const given = raw.health?.categories ?? {};
  // An expected reason the shipped list already names (its pattern, case folded) is already expected: not a second category.
  const shippedPatterns = new Set(FAILURE_CATEGORIES.participantFailures.map((c) => c.pattern.toLowerCase()));
  const expectedReasons = [...new Set((raw.health?.expectedReasons ?? []).map((s) => String(s).trim()).filter(Boolean))].sort().filter((s) => !shippedPatterns.has(s.toLowerCase()));
  const table = (part, extra) => {
    const problems = validateCategories(extra);
    if (problems.length) throw new Error(`--failure-categories (${part}): ${problems.join("; ")}`);
    try {
      return categoryTable(part, extra);
    } catch (e) {
      throw new Error(`--failure-categories (${part}): ${e instanceof Error ? e.message : e}`);
    }
  };
  const categories = {
    bounceReasons: table("bounceReasons", Array.isArray(given.bounceReasons) ? given.bounceReasons : []),
    participantFailures: table("participantFailures", [
      ...(Array.isArray(given.participantFailures) ? given.participantFailures : []),
      ...expectedReasons.map((text, i) => ({ id: `expected-${i + 1}`, label: text, pattern: text, definition: "Named as an expected failure for this pull (--expected-reason): by design, not a defect.", expected: true })),
    ]),
  };
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
    testAccounts,
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
    health: {
      // Health facts: off unless asked for (an output that shows no health table should not pay for their calls).
      pull: raw.health?.pull === true,
      // How many days back a program's last send is read to the day.
      lookbackDays: (() => {
        const n = raw.health?.lookbackDays ?? 90;
        if (!Number.isInteger(n) || n < 1 || n > 366) throw new Error(`--health-lookback-days must be a whole number from 1 to 366 (got ${raw.health?.lookbackDays})`);
        return n;
      })(),
      categories,
      expectedReasons,
      // How many programs a pull samples per part, most failures first (F-484): the rest are named, not read.
      samplePrograms: (() => {
        const n = raw.health?.samplePrograms ?? SAMPLE_PROGRAM_CAP;
        if (!Number.isInteger(n) || n < 0) throw new Error(`--sample-programs must be a whole number >= 0 (got ${raw.health?.samplePrograms})`);
        return n;
      })(),
      // Due days with no admission before an ingest that runs reads "admitting nobody" (F-491; a setup question).
      quietDueDays: (() => {
        const n = raw.health?.quietDueDays ?? QUIET_DUE_DAYS_DEFAULT;
        if (!Number.isInteger(n) || n < 1) throw new Error(`--quiet-due-days must be a whole number >= 1 (got ${raw.health?.quietDueDays})`);
        return n;
      })(),
    },
    incompleteFrom,
    repullMonths,
    forceFull: !!raw.forceFull,
    pageSize,
    maxPages,
    timeoutMs,
    tokenMarginSeconds: raw.tokenMarginSeconds ?? 30,
    // The pull time is stamped when the fact calls start (F-482), unless given; null until then.
    pulledAt: raw.pulledAt ?? null,
    timeZone: raw.timeZone ?? null,
  };
}
/** The clock a pull is stamped with when its fact calls start: the local time with its offset, and the zone. */
export const stampClock = (ms) => ({ pulledAt: localIsoWithOffset(new Date(ms)), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null });

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
        // What the list says of the program's participant sync (F-491); null when it does not say.
        syncScheduleDisabled: typeof p.participantSyncScheduleDisabled === "boolean" ? p.participantSyncScheduleDisabled : null,
        // When the list says the program was last modified (epoch ms → ISO; 0 and absent are "not said"): a KB doc
        // written before it is behind the tenant (F-491, redesigned 2026-10-08).
        modifiedAt: typeof p.modified_date === "number" && p.modified_date > 0 ? new Date(p.modified_date).toISOString() : null,
      });
    }
  }
  return out;
}
/**
 * Where the KB is behind the tenant for the pull's programs (F-491, redesigned
 * 2026-10-08): the KB is the ONE source of schedules, so a program it does not
 * document is named (its schedule is unknown to the pull, never guessed), and a
 * documented program the list says was modified after its doc was written is
 * named as behind. Both are what a narrow refresh re-documents; the plan prices
 * it. With no KB at all every program is undocumented by construction, and that
 * is said once (source "none"), not per program.
 * @param {Map<string, {id: string, modifiedAt?: ?string}>} selected
 * @param {?{schedules?: Object<string, {asOf: ?string}>}} kbSteps
 * @returns {{source: "kb"|"none", undocumented: string[], behind: Array<{programId: string, asOf: ?string, modifiedAt: string}>}}
 */
export function kbGap(selected, kbSteps) {
  if (!kbSteps?.schedules) return { source: "none", undocumented: [], behind: [] };
  const undocumented = [];
  const behind = [];
  for (const p of [...selected.values()].sort((a, b) => cmpKey(a.id, b.id))) {
    const doc = kbSteps.schedules[p.id];
    if (!doc) undocumented.push(p.id);
    else if (p.modifiedAt != null && doc.asOf != null && String(p.modifiedAt) > String(doc.asOf)) behind.push({ programId: p.id, asOf: doc.asOf, modifiedAt: p.modifiedAt });
  }
  return { source: "kb", undocumented, behind };
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
    syncScheduleDisabled: null, modifiedAt: null,
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
  // Clicked and bounced attempts per program-month (the count-first reads), for the estimates only.
  for (const [family, key] of [["count-clicks", "clicked"], ["count-bounces", "bounced"]]) {
    for (const u of units) {
      if (u.family !== family || u.cls !== "all") continue;
      for (const row of u.rows) {
        const r = ROW_READERS[family](row);
        const b = base.get(JSON.stringify([r.programId, r.month]));
        if (b && r.n != null) b[key] = (b[key] ?? 0) + r.n;
      }
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
    // --name takes a name or an id, as it does in email-report: one flag vocabulary across the report skills.
    (!wantNames.size && !wantIds.size ? true : wantIds.has(p.id) || wantNames.has(termKey(p.id)) || (p.name != null && wantNames.has(termKey(p.name)))) &&
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
  // Send rows made before failures were counted carry no failure count: none of them can sit beside this build's.
  if (previous.meta.health === undefined) return full("the previous snapshot was made before send failures and health facts were counted, so every table is pulled again");
  if (!sameList(pp.internalDomains ?? [], params.internalDomains)) return full("the internal domains changed");
  if (!sameUnsubscribeLinks(previous, params)) return full("the unsubscribe links changed");
  // Test accounts join the internal class: a different set is a different class split.
  if (!sameList(pp.testAccounts ?? [], params.testAccounts ?? [])) return full("the test accounts changed");
  if (!!pm.stepDetail !== params.stepDetail) return full("the step-detail switch changed");
  // An account table is whole or absent: its rows are never carried beside months that have none.
  if (accountAvailability(previous).pulled !== params.accounts.pull)
    return full(params.accounts.pull ? "accounts were switched on and the previous snapshot holds none, so every table is pulled again" : "accounts were switched off, so every table is pulled again without them");
  if (params.accounts.pull && !sameList(accountSelection(pp.accounts), accountSelection(params.accounts))) return full("the account selection changed");
  // Bounce reasons carry by month like the facts: a snapshot that holds none has none to give the carried months.
  if (params.health?.pull && !healthAvailability(previous).pulled) return full("health was switched on and the previous snapshot holds none, so every table is pulled again");
  // Carried bounce rows were counted under the previous pull's category list (or read as text, before categories):
  // rows of two lists cannot sit beside each other.
  if (params.health?.pull && healthAvailability(previous).pulled && !sameList(pp.health?.categories?.bounceReasons ?? null, params.health.categories?.bounceReasons ?? []))
    return full("the bounce-reason categories changed, so the bounce reasons are counted again for every month");
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
export function planUnits({ params, base, selectedIds, refresh, surveyAvailable, health = null }) {
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
  const tests = params.testAccounts ?? [];
  const sentIn = (id, m) => base.get(JSON.stringify([id, m]))?.sent ?? 0;
  // The internal class's calls for a family over a span: one per domain, and with test accounts the test call
  // plus one overlap call per domain (a test contact on an internal domain is in both and is counted once).
  const classTwins = (family, window, extra = {}) => {
    for (const domain of domains) units.push({ family, cls: "internal", domain, window, ...extra });
    if (tests.length) {
      units.push({ family, cls: "test", testAccounts: tests, window, ...extra });
      for (const domain of domains) units.push({ family, cls: "test-internal", domain, testAccounts: tests, window, ...extra });
    }
  };
  const external = { domains, ...(tests.length ? { testAccounts: tests } : {}) };

  units.push({ family: "uniques-month", cls: "all", of: "people", window: whole });
  for (const of of ["people", "accounts"]) units.push({ family: "uniques-window", cls: "all", of, window: whole });
  units.push({ family: "classes", cls: "all", window: smallSpan });
  for (const of of domains.length || tests.length ? ["people", "accounts"] : []) {
    units.push({ family: "uniques-window", cls: "external", of, ...external, window: whole });
    units.push({ family: "uniques-month", cls: "external", of, ...external, window: smallSpan });
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
  classTwins("template", smallSpan);
  if (accounts) {
    classTwins("account", smallSpan);
    // A send with no company link is on no test account: the domain twin alone.
    for (const domain of domains) units.push({ family: "account-nolink", cls: "internal", domain, window: smallSpan });
  }
  classTwins("click-attr", smallSpan);
  for (const domain of domains) units.push({ family: "click-attr-nolink", cls: "internal", domain, window: smallSpan });
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
  // Health (HLT-1, counted by category since S3b): bounce reasons are the
  // total plus one call per category over the pulled span (rows are bounded
  // by program × template × month × type, so a span fits a page; a full page
  // splits by day), old months only for the programs the previous snapshot did
  // not hold, and the class twins; one sample read; the rest is small, has no
  // month, and is read again on every pull.
  if (health) {
    const cats = params.health.categories?.bounceReasons ?? [];
    const bounce = (extra) => {
      units.push({ family: "health-bounce-total", ...extra });
      for (const category of cats) units.push({ family: "health-bounce-cat", category, ...extra });
    };
    bounce({ cls: "all", window: pulledSpan });
    if (!isFull && oldSpan) for (const b of batches(fullPrograms)) bounce({ cls: "all", window: oldSpan, programs: b });
    for (const domain of domains) bounce({ cls: "internal", domain, window: smallSpan });
    if (tests.length) {
      bounce({ cls: "test", testAccounts: tests, window: smallSpan });
      for (const domain of domains) bounce({ cls: "test-internal", domain, testAccounts: tests, window: smallSpan });
    }
    const dayWindow = { start: health.dayWindow.start, end: health.dayWindow.end };
    units.push({ family: "health-days", cls: "all", window: dayWindow });
    // The signals' reads (F-491): tenant-wide, each naming the selected programs as its scope for the cut.
    if (health.objects.sources) units.push({ family: "health-sources", cls: "all", scope: selectedIds });
    if (health.objects.participantFailures) {
      units.push({ family: "health-reasons-total", cls: "all", scope: selectedIds });
      units.push({ family: "health-entry-month", cls: "all", window: whole, scope: selectedIds });
      units.push({ family: "health-entry-window", cls: "all", window: dayWindow, scope: selectedIds });
    }
    if (health.objects.participantStates) {
      for (const b of batches(selectedIds)) units.push({ family: "health-states", cls: "all", programs: b });
      units.push({ family: "health-admissions", cls: "all", window: dayWindow, scope: selectedIds });
      units.push({ family: "health-step-total", cls: "all", window: whole, scope: selectedIds });
      for (const category of STEP_FAILURE_CATEGORIES) units.push({ family: category.state ? "health-step-state" : "health-step-cat", cls: "all", window: whole, scope: selectedIds, category });
    }
    // The per-program samples are not planned here: fetch picks the programs from what the reads above
    // return (sampleTargets), after them.
  }
  return units;
}

/**
 * Which programs a pull samples for a part, most failures first, and which it
 * does not (F-484): every selected program whose failures in the SAMPLE'S OWN
 * window are above zero, less those whose counts equal the previous snapshot's
 * over the same window (its sample is kept), capped. Pure, so fetch and reduce
 * pick the same programs. The counts come from the count-first read made over
 * the very window object each sample page reads (health-entry-window for the
 * refusals; the bounce total and category rows over the pull's window for the
 * uncategorised bounce text), so a pick has rows by construction — redesigned
 * 2026-10-08 after picks ranked over the month window and read over the day
 * window returned empty pages that counted as sampled.
 * @param {{counts: Map<string, number>, previousCounts: ?Map<string, number>, previousSampled: Set<string>, cap: number}} args
 *   counts: program → failures in the sample's window (this pull); previousCounts: the same from the previous
 *   snapshot over the SAME window, or null; previousSampled: the programs the previous snapshot holds a sample for
 * @returns {{sample: string[], carried: string[], notSampled: Array<{programId: string, reason: string}>}}
 */
export function sampleTargets({ counts, previousCounts, previousSampled, cap }) {
  const withFailures = [...counts].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || cmpKey(a[0], b[0])).map(([id]) => id);
  const carried = withFailures.filter((id) => previousCounts?.get(id) === counts.get(id) && previousSampled.has(id));
  const fresh = withFailures.filter((id) => !carried.includes(id));
  return { sample: fresh.slice(0, cap), carried, notSampled: fresh.slice(cap).map((programId) => ({ programId, reason: "cap" })) };
}
/** Refusals per selected program still happening in the day window, from the entry-window units (fetch and reduce share it). */
function entryCountsFrom(units, selected) {
  const counts = new Map();
  for (const u of units) {
    for (const row of u.rows) {
      const r = ROW_READERS["health-entry-window"](row);
      if (r.programId == null || r.n == null || !selected.has(r.programId)) continue;
      counts.set(r.programId, (counts.get(r.programId) ?? 0) + r.n);
    }
  }
  return counts;
}
// The window a part's samples are read over, as the snapshot records it (meta.health.samples[part].window): the
// day window for the refusals, the pull's whole window for the bounce text. Both ends are days; the end is exclusive.
const sampleWindowOf = (unitWindow) => ({ start: unitWindow.start, endExclusive: unitWindow.end });
/**
 * The previous snapshot's counts for a part, for the carry test, over the window THIS pull samples: the refusals
 * from the counts that snapshot stored, only when it sampled over the same day window (a sample of another window
 * is of other refusals, and is not kept; null for a snapshot made before the counts were stored); the bounce text
 * from that snapshot's own rows over this window's months (it stores them per month, so like is compared with like
 * whatever the window was).
 */
function previousSampleCounts(previous, part, window) {
  if (part === "bounceReasons") return previous?.facts?.health ? previousOtherBounceCounts(previous, new Set(monthsBetween(window.start.slice(0, 7), addDays(window.endExclusive, -1).slice(0, 7)))) : null;
  const s = previous?.meta?.health?.samples?.[part];
  if (!s?.counts || !s.window || s.window.start !== window.start || s.window.endExclusive !== window.endExclusive) return null;
  return new Map(Object.entries(s.counts));
}
/** Uncategorised ("Other") bounces per selected program over the window, from the bounce total and category units. */
function otherBounceCountsFrom(units, selected, inWindow) {
  const counts = new Map();
  for (const u of units) {
    if (u.cls !== "all") continue;
    for (const row of u.rows) {
      const r = ROW_READERS[u.family](row);
      if (r.programId == null || r.month == null || r.n == null || !selected.has(r.programId) || !inWindow.has(r.month)) continue;
      counts.set(r.programId, (counts.get(r.programId) ?? 0) + (u.family === "health-bounce-total" ? r.n : -r.n));
    }
  }
  return counts;
}
/** The previous snapshot's uncategorised bounces per program over a set of months, from its own rows (the carried months of a selective refresh). */
function previousOtherBounceCounts(previous, inWindow) {
  const counts = new Map();
  for (const r of previous?.facts?.health?.bounceReasons ?? []) if (inWindow.has(r.month) && r.category === OTHER_CATEGORY) counts.set(r.programId, (counts.get(r.programId) ?? 0) + r.count);
  return counts;
}
/** Two program → count maps added together. */
function addCounts(a, b) {
  const out = new Map(a);
  for (const [k, v] of b ?? []) out.set(k, (out.get(k) ?? 0) + v);
  return out;
}
/**
 * Uncategorised bounces per selected program over the WHOLE window, for the carry test: this pull's rows over
 * the months it read, plus the previous snapshot's rows over the months a selective refresh carries (those
 * rows ARE the previous snapshot's, so the sum is what the new snapshot will hold).
 */
function otherBounceCountsOverWindow(units, selected, refresh, previous) {
  const pulled = otherBounceCountsFrom(units, selected, new Set(refresh.pulledMonths));
  return refresh.mode === "selective" ? addCounts(pulled, previousOtherBounceCounts(previous, new Set(refresh.carriedMonths))) : pulled;
}
// The programs the previous snapshot holds a sample for: the ones its meta names (sampled or carried; a sample
// whose page held only null reasons stored no text and still counts), else the ones with stored text.
const previousSampledPrograms = (previous, part) => new Set(previous?.meta?.health?.samples?.[part]?.programs ?? (previous?.facts?.health?.failureSamples ?? []).filter((r) => r.part === part).map((r) => r.programId));

// Seconds per call, by family: medians measured on CLI 1.0.10, rounded up. An
// estimate, printed as one; the token check before each call is what decides.
const CALL_SECONDS = { whoami: 1, programs: 2, schema: 2, describe: 3, "uniques-month": 13, "uniques-window": 23, "account-names": 4, "health-states": 16, "health-reasons-total": 9, "health-entry-window": 6, "health-reasons-sample": 12, "health-bounce-sample": 8, "health-admissions": 16, "health-step-total": 10, "health-step-cat": 10, "health-step-state": 10 };
// Rows per program-month a bounce-count unit is expected to hold (templates × bounce types), never more than the bounces.
const BOUNCE_ROWS_PER_MONTH = 6;
const monthsOf = (u) => (u.window ? monthsBetween(u.window.start.slice(0, 7), addDays(u.window.end, -1).slice(0, 7)) : []);
/**
 * How many rows a planned unit is expected to return, from the cheap calls
 * (the base call's sends, accounts reached and clicked sends per
 * program-month), or null for a unit priced at one call. S3b: the count-first
 * rule, as data per family.
 * @param {*} u a planned unit
 * @param {Map<string, {sent: number, accounts: ?number, clicked?: ?number}>} base
 * @returns {?number}
 */
export function expectedRows(u, base) {
  if (u.cls !== "all" || !u.window) return null;
  const months = monthsOf(u);
  const sum = (f) => {
    let rows = 0;
    for (const [k, b] of base) {
      const [id, m] = JSON.parse(k);
      if (!months.includes(m) || (u.programs && !u.programs.includes(id))) continue;
      rows += f(b);
    }
    return rows;
  };
  switch (u.family) {
    case "account": return u.programs ? sum((b) => Math.min(b.sent, Math.ceil(Math.max(1, b.accounts ?? b.sent) * 1.5))) : null;
    case "click-attr":
    case "click-attr-nolink":
    case "click-json": return sum((b) => b.clicked ?? 0);
    // The total's rows: the keys (templates × types) with a bounce, never more than the bounces themselves (the count-first
    // read; the sends when it was not made). A category's rows are at most the total's: half of it is the price.
    case "health-bounce-total": return sum((b) => Math.min(b.bounced ?? b.sent, BOUNCE_ROWS_PER_MONTH));
    case "health-bounce-cat": return Math.ceil(sum((b) => Math.min(b.bounced ?? b.sent, BOUNCE_ROWS_PER_MONTH)) / 2);
    case "health-days": { // one row per program and day with a send: at most the days of the window per program
      const days = daysBetween(u.window.start, u.window.end);
      const perProgram = new Map();
      for (const [k, b] of base) {
        const [id, m] = JSON.parse(k);
        if (months.includes(m)) perProgram.set(id, (perProgram.get(id) ?? 0) + b.sent);
      }
      return [...perProgram.values()].reduce((s, n) => s + Math.min(n, days), 0);
    }
    default: return null;
  }
}
/**
 * How many calls a planned unit is expected to take. One, unless its rows will
 * not fit a page: a unit whose rows exceed the page is split until every leaf
 * fits, and each split costs the call that came back full. The tree is priced
 * from the cheap tenant-wide calls (expectedRows): leaves half a page full,
 * two calls per leaf, and two more for every rung the ladder climbs (the
 * window halved down to one day, plus the two flags on the account grain), as
 * when the sends sit on one day. Measured against four real pulls, the
 * account grain lands within 2x of the calls made; the click and health
 * families are priced the same way from their own counts (S3b, F-476).
 * @param {*} u a planned unit
 * @param {Map<string, {sent: number, accounts: ?number, clicked?: ?number}>} base
 * @param {number} pageSize
 * @returns {number}
 */
export function expectedCalls(u, base, pageSize) {
  if (FAMILIES[u.family]?.sample) return 1;
  const rows = expectedRows(u, base);
  if (rows == null) return 1;
  // The account grain is batched by program, and a mass-send program-month sits on one day: the call that
  // comes back full, two per rung down to the address cut, two per half-page leaf (fitted to four real pulls).
  if (u.family === "account" && u.programs) {
    const rungs = Math.ceil(Math.log2(Math.max(2, daysBetween(u.window.start, u.window.end)))) + 2;
    const month = u.window.start.slice(0, 7);
    let calls = 0;
    let fits = false;
    for (const id of u.programs) {
      const b = base.get(JSON.stringify([id, month]));
      const n = b ? Math.min(b.sent, Math.ceil(Math.max(1, b.accounts ?? b.sent) * 1.5)) : 0;
      if (n >= pageSize) calls += 1 + 2 * rungs + 2 * Math.ceil(n / (pageSize / 2));
      else fits = true;
    }
    return calls + (fits || !calls ? 1 : 0);
  }
  // A tenant-wide unit over a span is cut by day and its rows spread over the days: a balanced tree whose
  // leaves are half a page full, so a tree of L leaves is 2L - 1 calls (S3b: the click and health families).
  return rows >= pageSize ? 2 * Math.ceil(rows / (pageSize / 2)) - 1 : 1;
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
// How a first failure that gets one more try reads in a progress line.
const PROGRESS_KIND = { timeout: "timed out", outage: "no answer", "not-found": "not found" };
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
  const flags = new Map(); // object → Map(field → {filterable, groupable}) | null
  const readSchema = (object, payload) => {
    types.set(object, schemaTypes(payload));
    flags.set(object, schemaFlags(payload));
  };

  const execute = (d, id, argv) => {
    const refusal = gate(argv);
    if (refusal) throw new EngagementRefusal(refusal);
    if (isRpRun(d)) {
      const problems = validateQuery(buildQuery(d), types.get(FAMILIES[d.family].object) ?? new Map(), flags.get(FAMILIES[d.family].object) ?? null);
      if (problems.length) throw new EngagementRefusal(`refusing to run the ${d.family} query: ${problems.join("; ")}`);
    }
    for (let attempt = 1; ; attempt++) {
      if (deadline != null && now() + params.tokenMarginSeconds * 1000 > deadline) {
        stop = { reason: "token-expired", detail: "the token would expire before the next call returns" };
        return null;
      }
      const r = transport.run({ id, argv, timeoutMs: params.timeoutMs });
      counts.made++;
      // The progress line says what was RECORDED for the call, once that is
      // decided: a not-found that is retried and then settled as a deleted
      // program never failed, and a line reading "failed" beside a summary
      // with no failure leaves the reader to guess which to believe (F-479).
      const say = (what) => onCall(`${id} ${what} (${r.ms} ms)`);
      // Non-empty stderr is not a failure: the CLI warns there and exits 0.
      if (r.ok) {
        const file = `calls/${id}.${TEXT_FAMILIES.has(d.family) ? "txt" : "json"}`;
        if (TEXT_FAMILIES.has(d.family)) {
          say("ok");
          writeFileAtomicSync(join(runDir, file), r.stdout);
          return record({ ...d, id, status: "ok", file, attempt });
        }
        let payload;
        try {
          payload = JSON.parse(r.stdout);
        } catch {
          say("failed: the answer is not JSON");
          failed.push({ id, family: d.family, kind: "unparseable" });
          record({ ...d, id, status: "failed", kind: "unparseable", attempt });
          return null;
        }
        const rows = Array.isArray(payload) ? payload.length : null;
        // As long as the page: the server cut it and said nothing. A sample is one page by design.
        const truncated = isRpRun(d) && !FAMILIES[d.family]?.sample && rows != null && rows >= params.pageSize;
        say(truncated ? "ok, a full page: it will be split" : "ok");
        // What must not reach disk is taken out here: a click's IP and URL, and the names in an error message.
        if (FAMILIES[d.family]?.sanitize && Array.isArray(payload)) {
          payload = payload.map((row) => ROW_READERS[d.family](row, params.unsubscribeLinks));
        }
        writeFileAtomicSync(join(runDir, file), JSON.stringify(payload));
        return record({ ...d, id, status: "ok", file, rows, truncated, attempt, ...(r.stderr.trim() ? { warning: printable(r.stderr, 200) } : {}) });
      }
      const kind = classifyFailure(r);
      if (kind === "auth-expired") {
        say("stopped: the token expired");
        stop = { reason: "token-expired", detail: "the CLI reported the token expired" };
        return null;
      }
      // Once more, on its own, before anything is concluded from it.
      if (attempt === 1 && (kind === "timeout" || kind === "outage" || kind === "not-found")) {
        say(`${PROGRESS_KIND[kind]}: trying once more`);
        counts.retried++;
        continue;
      }
      if (kind === "timeout") {
        say("timed out twice: it will be split");
        return record({ ...d, id, status: "split", kind, attempt });
      }
      if (kind === "not-found" && d.family === "describe") {
        say("not found twice: recorded as a deleted program, not a failure");
        const file = `calls/${id}.json`;
        writeFileAtomicSync(join(runDir, file), JSON.stringify({ notFound: true }));
        return record({ ...d, id, status: "ok", file, notFound: true, attempt });
      }
      const failure = { id, family: d.family, kind: kind === "outage" ? "shape-error" : kind, stderr: printable(r.stderr, 300) };
      say(`failed: ${failure.kind}`);
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
    const kids = rec.status === "split" && FAMILIES[d.family]?.timeoutSplit === false ? null : splitUnit(d);
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
  // Health parts whose calls did not all return: part → what went wrong. Never a failed pull.
  /** @type {Object<string, Array<{family: string, kind: string}>>} */
  const healthUnread = {};
  // Run something for health: whatever fails inside is moved out of the pull's failures.
  const forHealth = (part, run) => {
    const before = failed.length;
    let got = [];
    try {
      got = run();
    } catch (e) {
      if (!(e instanceof EngagementRefusal)) throw e;
      failed.push({ id: part, family: part, kind: "refused", stderr: printable(e.message, 300) });
    }
    for (const f of failed.splice(before)) (healthUnread[part] ??= []).push({ family: f.family, kind: f.kind });
    return got;
  };
  const conclude = (extra) => {
    const status = stop ? stop.reason : failed.length ? "partial" : "ok";
    const summary = { status, ...(stop ? { stopped: stop.detail } : {}), calls: counts, failed, health: { unread: healthUnread }, pulledAt: params.pulledAt, ...extra };
    writeFileAtomicSync(join(runDir, "status.json"), JSON.stringify({ status, phase, failed, health: { unread: healthUnread }, calls: counts }, null, 2));
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
    if (got.length) readSchema(object, load(got[0]));
  }
  // The two objects only health reads: one that is missing, or whose schema call fails, costs that part and nothing else.
  /** @type {Object<string, boolean>} */
  const healthObjects = {};
  if (params.health.pull && !stop && !failed.length) {
    for (const [part, object] of Object.entries(HEALTH_OBJECTS)) {
      const got = forHealth(part, () => runUnit({ family: "schema", object }));
      if (got.length) readSchema(object, load(got[0]));
      healthObjects[part] = !!types.get(object);
    }
  }
  if (stop || failed.length) return conclude({ whoami });
  if (!types.get(LOG)) throw new EngagementRefusal(`${LOG} has no schema on this tenant — the delivery log cannot be read`);
  if (params.stepDetail && !types.get(JO_LOG)) throw new EngagementRefusal(`${JO_LOG} has no schema on this tenant — step detail cannot be pulled`);
  const surveyAvailable = !!types.get(SURVEY);

  const whole = monthWindow(params.window.from, params.window.to);
  // The cheap tenant-wide calls, the count-first read among them (S3b): sends, accounts reached and clicked
  // sends per program × month, from which every family that reads rows is priced before it is read.
  const baseUnits = [
    ...rowsOf(runUnit({ family: "totals", cls: "all", window: whole })),
    ...(stop ? [] : rowsOf(runUnit({ family: "uniques-month", cls: "all", of: "accounts", window: whole }))),
    ...(stop ? [] : rowsOf(runUnit({ family: "count-clicks", cls: "all", window: whole }))),
    ...(stop ? [] : rowsOf(runUnit({ family: "count-bounces", cls: "all", window: whole }))),
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
  const health = params.health.pull ? { dayWindow: healthDayWindow(params), objects: healthObjects } : null;
  const units = planUnits({ params, base, selectedIds, refresh, surveyAvailable, health });
  // The failed-participant totals are read NOW, as the count-first read of that object (S3b): the plan prints
  // the rows behind the samples, and the fact calls reuse the answer. A failure costs that part only. The
  // refusals per month (F-491) are read beside it: the plan prices the per-program samples from them.
  const unitOf = (family) => units.find((u) => u.family === family);
  if (health?.objects.participantFailures && !stop) {
    forHealth("participantFailures", () => runUnit(unitOf("health-reasons-total")));
    if (!stop) forHealth("entryFailures", () => runUnit(unitOf("health-entry-month")));
    if (!stop) forHealth("entryFailures", () => runUnit(unitOf("health-entry-window")));
  }
  const okUnits = (family) => rowsOf([...records.values()].filter((r) => r.family === family && r.status === "ok" && !r.truncated));
  const failedRows = (() => {
    const recs = okUnits("health-reasons-total");
    if (!recs.length) return null;
    let rows = 0;
    for (const u of recs) for (const row of u.rows) rows += ROW_READERS["health-reasons-total"](row).n ?? 0;
    return rows;
  })();
  // The step names and schedules from the KB, read once and kept with the run (reduce reads the file) — unless the
  // KB moved since (its manifest's stamp differs: a narrow refresh between a plan and its run, F-491), when it is
  // read again, so a run never judges from the copy a refresh just superseded.
  const kbStamp = kbDir ? kbManifestStamp(kbDir) : null;
  const kbCached = kbDir && existsSync(join(runDir, "kb-steps.json")) ? readJsonFile(join(runDir, "kb-steps.json")) : null;
  const kbSteps = kbDir ? (kbCached && kbCached.stamp === kbStamp ? kbCached : readKbSteps(kbDir, params.today)) : null;
  if (kbDir && kbSteps !== kbCached) writeFileAtomicSync(join(runDir, "kb-steps.json"), JSON.stringify(kbSteps));
  // The row budget (S3b): a unit whose count-first read says it exceeds MAX_PAGES pages is not read.
  const rowBudget = params.pageSize * (params.maxPages ?? MAX_PAGES);
  const tooLarge = (u) => (expectedRows(u, base) ?? 0) > rowBudget;
  const overBudget = units.filter(tooLarge).map((u) => ({ family: u.family, rows: expectedRows(u, base) }));
  const clickOver = overBudget.find((o) => ["click-attr", "click-attr-nolink", "click-json"].includes(o.family));
  if (clickOver)
    throw new EngagementRefusal(`the click detail of this pull is about ${clickOver.rows} clicked sends, more than the ${rowBudget} rows (${params.maxPages ?? MAX_PAGES} pages of ${params.pageSize}) a pull reads: narrow the programs (--name, --sent-since) or the window (--from/--to), or raise --page-size`);

  // The estimates plan prints: this run, a full one, and what step detail and the account grain each add.
  const fullUnits = refresh.mode === "full" ? units : planUnits({ params, base, selectedIds, refresh: decideRefresh({ params, previous: null, tenantHost: whoami.host, selectedIds }), surveyAvailable, health });
  const without = planUnits({ params: { ...params, stepDetail: false }, base, selectedIds, refresh, surveyAvailable, health });
  const withStep = planUnits({ params: { ...params, stepDetail: true }, base, selectedIds, refresh, surveyAvailable, health });
  // The account grain's cost: this run's plan without it, against the plan WITH it. Turning it on over a
  // previous snapshot that holds none is a full refresh, so that side is planned under the refresh it would get.
  const withAccounts = { ...params, accounts: { ...params.accounts, pull: true } };
  const accountsOff = planUnits({ params: { ...params, accounts: { ...params.accounts, pull: false } }, base, selectedIds, refresh, surveyAvailable, health });
  const accountsOn = planUnits({ params: withAccounts, base, selectedIds, refresh: decideRefresh({ params: withAccounts, previous: given, tenantHost: whoami.host, selectedIds }), surveyAvailable, health });
  // The health facts' cost, the same way: this run's plan without them, against the plan WITH them under the
  // refresh it would get (on over a snapshot that holds none is a full refresh). With health off the two
  // objects only health reads were not looked up, so both are assumed to exist.
  const withHealth = { ...params, health: { ...params.health, pull: true } };
  const healthOff = planUnits({ params, base, selectedIds, refresh, surveyAvailable, health: null });
  const healthOn = planUnits({
    params: withHealth, base, selectedIds, refresh: decideRefresh({ params: withHealth, previous: given, tenantHost: whoami.host, selectedIds }), surveyAvailable,
    health: health ?? { dayWindow: healthDayWindow(params), objects: Object.fromEntries(Object.keys(HEALTH_OBJECTS).map((part) => [part, true])) },
  });
  // Calls and seconds include the splits a program-month too large for a page will force.
  const calls = (list) => estimateCalls(list, base, params.pageSize);
  const seconds = (list) => estimateSeconds(list, base, params.pageSize);
  // The per-program samples (F-484), priced from the count-first reads: how many selected programs have
  // refusals in the window (read above) and how many have uncategorised bounces (from the bounce count-first
  // read: every bounce, until the categories are counted), against the cap; what the cap leaves out, and what
  // reading it all would cost, so raising --sample-programs is an informed choice. A program whose counts did
  // not move since the previous snapshot keeps its sample and costs no call, so this is an upper bound.
  const inWindowMonths = new Set(monthsBetween(params.window.from, params.window.to));
  // A sample is carried only by a SELECTIVE refresh: a full one reads everything again, samples included. Each
  // part's counts are compared with the previous snapshot's over the SAME window (the refusals over the day
  // window; the bounces over the pull's window: this pull's months plus the carried months' rows).
  const carryFrom = refresh.mode === "selective" ? previous : null;
  const selectedSet = new Set(selectedIds);
  // The window each part's samples are read over: the refusals' is the health-entry-window unit's own window
  // object (the page reads what the count counted); the bounce text's is the pull's whole window.
  const sampleWindows = { participantFailures: health ? unitOf("health-entry-window")?.window ?? { start: health.dayWindow.start, end: health.dayWindow.end } : null, bounceReasons: whole };
  const sampleCounts = {
    participantFailures: entryCountsFrom(okUnits("health-entry-window"), selectedSet),
    // At plan time the categories are not counted yet: every bounce in the window is priced as uncategorised (an upper bound).
    bounceReasons: new Map([...new Set([...base.values()].filter((b) => selectedSet.has(b.programId) && inWindowMonths.has(b.month) && (b.bounced ?? 0) > 0).map((b) => b.programId))].map((id) => [id, [...base.values()].filter((b) => b.programId === id && inWindowMonths.has(b.month)).reduce((s, b) => s + (b.bounced ?? 0), 0)])),
  };
  const samplePlan = (part) => {
    const family = part === "participantFailures" ? "health-reasons-sample" : "health-bounce-sample";
    // With health off the refusals per month were not read, so how many programs would be sampled is unknown (null), not 0.
    if (part === "participantFailures" && !params.health.pull) return { withFailures: null, planned: 0, carried: 0, beyondCap: 0, secondsEach: CALL_SECONDS[family], secondsBeyondCap: 0, family, note: "counted once health is on" };
    const t = sampleTargets({ counts: sampleCounts[part], previousCounts: carryFrom ? previousSampleCounts(carryFrom, part, sampleWindowOf(sampleWindows[part])) : null, previousSampled: previousSampledPrograms(carryFrom, part), cap: params.health.samplePrograms });
    return { withFailures: [...sampleCounts[part].values()].filter((n) => n > 0).length, planned: t.sample.length, carried: t.carried.length, beyondCap: t.notSampled.length, secondsEach: CALL_SECONDS[family], secondsBeyondCap: t.notSampled.length * CALL_SECONDS[family], family };
  };
  const samples = { cap: params.health.samplePrograms, participantFailures: samplePlan("participantFailures"), bounceReasons: samplePlan("bounceReasons") };
  const sampleReads = params.health.pull ? samples.participantFailures.planned + samples.bounceReasons.planned : 0;
  const sampleSeconds = (n) => n * CALL_SECONDS["health-reasons-sample"];
  const schedules = kbSteps?.schedules ?? {};
  const scheduleOf = (id) => pickSchedule(schedules[id], params.today);
  const ownReads = sampleReads;
  const describeSeconds = sampleSeconds;
  // The lookback the health facts read by day, against the longest schedule period among the programs (ENG-2, S3b):
  // a program whose period is longer than the window cannot be judged by its cadence, and the runner derives the flag from this.
  const periods = selectedIds.map((id) => scheduleOf(id)).filter((s) => s?.classification === "recurring").map((s) => cronLastDue(s.cronExpression, params.today).periodDays).filter((p) => p != null);
  const lookback = {
    days: params.health.lookbackDays,
    longestPeriodDays: periods.length ? Math.max(...periods) : null,
    programsBeyondWindow: periods.filter((p) => p > params.health.lookbackDays).length,
    unreadableCrons: selectedIds.map((id) => scheduleOf(id)).filter((s) => s?.classification === "recurring" && !cronLastDue(s.cronExpression, params.today).readable).length,
  };
  const plannedSamples = samples.participantFailures.planned + samples.bounceReasons.planned;
  const sampleFamilies = { ...(samples.participantFailures.planned ? { "health-reasons-sample": samples.participantFailures.planned } : {}), ...(samples.bounceReasons.planned ? { "health-bounce-sample": samples.bounceReasons.planned } : {}) };
  const gap = kbGap(decision.selected, kbSteps);
  const refreshable = [...gap.undocumented.filter((id) => listed.has(id)), ...gap.behind.map((b) => b.programId)];
  const kbPlan = {
    source: gap.source, undocumented: gap.undocumented.length, behind: gap.behind.length, unlisted: gap.undocumented.filter((id) => !listed.has(id)).length,
    programs: refreshable, refreshSeconds: refreshable.length * CALL_SECONDS.describe,
    keysFile: refreshable.length ? join(runDir, KB_GAP_KEYS_FILE) : null, listFile: refreshable.length ? join(runDir, KB_GAP_LIST_FILE) : null,
  };
  const estimate = {
    mode: refresh.mode, why: refresh.why,
    thisRun: { calls: calls(units) + ownReads, seconds: seconds(units) + describeSeconds(ownReads), units: units.length, byFamily: { ...familyCounts(units, base, params.pageSize), ...(ownReads ? sampleFamilies : {}) } },
    full: { calls: calls(fullUnits) + ownReads, seconds: seconds(fullUnits) + describeSeconds(ownReads) },
    stepDetail: { on: params.stepDetail, addsCalls: calls(withStep) - calls(without), addsSeconds: seconds(withStep) - seconds(without) },
    // What the account grain costs, printed whether it is on or off (its name lookups are not counted: how many depends on the selection).
    accounts: { on: params.accounts.pull, addsCalls: calls(accountsOn) - calls(accountsOff), addsSeconds: seconds(accountsOn) - seconds(accountsOff) },
    // What the health facts cost, printed whether they are on or off; the per-program samples against their cap,
    // the lookback against the schedules, and the failed-participant rows the count-first read found.
    health: {
      on: params.health.pull, addsCalls: calls(healthOn) - calls(healthOff) + plannedSamples, addsSeconds: seconds(healthOn) - seconds(healthOff) + sampleSeconds(plannedSamples),
      samples, lookback, failedParticipantRows: failedRows,
      categories: { bounceReasons: (params.health.categories?.bounceReasons ?? []).length, participantFailures: (params.health.categories?.participantFailures ?? []).length },
    },
    // The row budget and what exceeds it (a health part over it is not read; the click detail refused above).
    rowBudget: { rows: rowBudget, pages: params.maxPages ?? MAX_PAGES, overBudget },
    token: { expiresInSeconds: whoami.expiresInSeconds, fits: seconds(units) + describeSeconds(ownReads) + params.tokenMarginSeconds <= whoami.expiresInSeconds },
    // Where the KB is behind the tenant for the selected programs (F-491, redesigned 2026-10-08), priced as the
    // narrow refresh that closes it (one describe per program), with its inputs written beside this plan: the
    // manifest keys of every such program, and the list rows of the undocumented ones (what registers them).
    // A program the list itself lacks (described live) has no row to register and is counted apart.
    kb: kbPlan,
  };
  const programs = { listed: listed.size, selected: selectedIds.length, deleted: decision.deleted.size, unselected: decision.unselected.size };
  if (kbPlan.undocumented + kbPlan.behind) {
    const listRows = pages.flatMap((pg) => (Array.isArray(pg?.data?.advancedOutreaches) ? pg.data.advancedOutreaches : [])).filter((r) => gap.undocumented.includes(str(r?.advancedOutreachId)));
    writeFileAtomicSync(join(runDir, KB_GAP_KEYS_FILE), JSON.stringify(kbPlan.programs.map((id) => `journey/${id}`), null, 2));
    writeFileAtomicSync(join(runDir, KB_GAP_LIST_FILE), JSON.stringify({ result: true, data: { advancedOutreaches: listRows } }, null, 2));
  }
  writeFileAtomicSync(join(runDir, "plan.json"), JSON.stringify({ estimate, programs, refresh: { ...refresh, carriedPrograms: [...refresh.carriedPrograms] } }, null, 2));
  if (phase === "plan") return conclude({ whoami, estimate, programs });

  // Phase C: the facts. The pull time is stamped HERE, when the first fact call is about to be made (F-482),
  // and kept with the run: a resume continues under the same stamp, and a plan alone stamps nothing.
  if (params.pulledAt == null) {
    Object.assign(params, { ...stampClock(now()), ...(params.timeZone ? { timeZone: params.timeZone } : {}) });
    const runFile = join(runDir, "run.json");
    if (existsSync(runFile)) {
      const run = readJsonFile(runFile);
      run.params = { ...run.params, pulledAt: params.pulledAt, timeZone: params.timeZone };
      writeFileAtomicSync(runFile, JSON.stringify(run, null, 2));
    }
  }
  const accountRecs = [];
  for (const d of units) {
    if (isHealth(d)) continue; // Phase E
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

  // Phase E: health, after every fact call. A token that runs out here stops the run like anywhere else (resumable; nothing made is made again).
  // A part whose count-first read says it exceeds the row budget is not read at all (reason too-large).
  const refusedParts = new Set();
  for (const d of units) {
    if (stop) break;
    if (!isHealth(d)) continue;
    const part = FAMILIES[d.family].health;
    if (refusedParts.has(part)) continue;
    if (tooLarge(d)) {
      refusedParts.add(part);
      (healthUnread[part] ??= []).push({ family: d.family, kind: "too-large" });
      continue;
    }
    forHealth(part, () => runUnit(d));
  }
  // The per-program samples (F-484), after the counts they are picked from: one small page of the most repeated
  // refusals still happening in the day window per program with such refusals, and one of the uncategorised
  // bounce text per program with uncategorised bounces in the pull's window — most first, at most the cap each,
  // skipping a program whose counts did not move since the previous snapshot over the same window (reduce
  // keeps that snapshot's sample). Each page reads the WINDOW OBJECT its count was made over, so a pick has rows
  // by construction. reduce re-derives the same picks from the same counts (sampleTargets is pure); the counts
  // and their window are stored with the snapshot (meta.health.samples) for the next pull's carry test.
  if (health && !stop && !refusedParts.has("failureSamples")) {
    const picks = (part) => sampleTargets({ counts: part === "participantFailures" ? entryCountsFrom(okUnits("health-entry-window"), selectedSet) : otherBounceCountsOverWindow([...okUnits("health-bounce-total"), ...okUnits("health-bounce-cat")], selectedSet, refresh, previous), previousCounts: carryFrom ? previousSampleCounts(carryFrom, part, sampleWindowOf(sampleWindows[part])) : null, previousSampled: previousSampledPrograms(carryFrom, part), cap: params.health.samplePrograms });
    if (health.objects.participantFailures) {
      for (const id of picks("participantFailures").sample) {
        forHealth("failureSamples", () => runUnit({ family: "health-reasons-sample", cls: "all", programs: [id], window: sampleWindows.participantFailures }));
        if (stop) break;
      }
    }
    const cats = params.health.categories?.bounceReasons ?? [];
    for (const id of stop ? [] : picks("bounceReasons").sample) {
      forHealth("failureSamples", () => runUnit({ family: "health-bounce-sample", cls: "all", programs: [id], window: sampleWindows.bounceReasons, excludePatterns: cats.map((c) => c.pattern) }));
      if (stop) break;
    }
  }
  return conclude({ whoami, estimate, programs });
}

// Step names and order per program, from the KB's program docs through the one
// parser of that payload (jo-report). Only email steps are kept.
// What the KB's manifest file looks like on disk (size and mtime): every KB write
// (a refresh, a describe-batch) rewrites it, so a run directory's kb-steps.json is
// re-read when this changes (F-491). Null when the file is missing.
function kbManifestStamp(kbDir) {
  try {
    const s = statSync(join(kbDir, "_manifest.json"));
    return `${s.size}:${Math.floor(s.mtimeMs)}`;
  } catch {
    return null;
  }
}
// The manifest keys of the programs the KB is behind on, and the list rows of
// those it has never documented, written by plan beside plan.json: what a
// narrow refresh (manifest upsert-batch --partial, mark --status stale,
// describe-batch --keys-file) takes as its inputs (F-491, redesigned 2026-10-08).
export const KB_GAP_KEYS_FILE = "kb-gap-keys.json";
export const KB_GAP_LIST_FILE = "kb-gap-list.json";
function readKbSteps(kbDir, today = null) {
  const { index, warnings } = buildIndex({ kbDir });
  const programs = {};
  // Each program's schedules as the same parser normalizes them for the
  // schedule audit (lastRunSuccess and the times beside it), classified
  // recurring or one-time by that audit's own rule; as of the doc's last check.
  const schedules = {};
  for (const p of Object.values(index.programs)) {
    if (p.depth !== "full") continue;
    schedules[p.id] = { asOf: p.lastVerified ?? null, schedules: p.schedules.map((sc) => ({ ...sc, classification: classifySchedule(sc) })) };
    programs[p.id] = p.steps
      .filter((s) => s.emailTemplateId != null || s.variantTemplateIds.length)
      .map((s) => ({ stepId: str(s.stepId), stepName: s.stepName ?? null, order: typeof s.order === "number" ? s.order : null, templateIds: [...new Set([s.emailTemplateId, ...s.variantTemplateIds].filter(Boolean))] }));
  }
  return { source: "kb", programs, schedules, warnings: warnings.length, today, stamp: kbManifestStamp(kbDir) };
}
/**
 * A program's ONE schedule for the program dimension (S3b): with several, the
 * recurring one with the shortest period (the most frequent decides what "due"
 * means); the classification is recurring when any is, else one-time when any
 * is, else the first's. A documented program with none says so.
 * @param {?{asOf: ?string, schedules: Array<*>}} doc
 * @param {string} today
 * @returns {?{classification: string, cronExpression: ?string, timeZoneName: ?string, startTime: ?number, endTime: ?number, asOf: ?string}}
 */
export function pickSchedule(doc, today) {
  if (!doc) return null;
  const list = doc.schedules ?? [];
  if (!list.length) return { classification: NO_SCHEDULE, cronExpression: null, timeZoneName: null, startTime: null, endTime: null, asOf: doc.asOf ?? null };
  const recurring = list.filter((s) => s.classification === "recurring");
  let chosen = list[0];
  if (recurring.length) {
    // A LIVE schedule (no end, or an end not yet passed) decides before an ended one, whatever its position:
    // the measured tenant's programs carry an ended job schedule BESIDE their live participant sync, and the
    // ended one read as the program's (F-491, 2026-10-08: 15 of 35 "Schedule ended" reads). Among live ones the
    // shortest period decides; among ended ones (none live) the latest end.
    const endDay = (s) => (typeof s.endTime === "number" && s.endTime > 0 ? new Date(s.endTime).toISOString().slice(0, 10) : null);
    const live = recurring.filter((s) => endDay(s) == null || endDay(s) >= today);
    chosen = live.length
      ? live.map((s) => ({ s, period: cronLastDue(s.cronExpression, today).periodDays ?? Infinity })).sort((a, b) => a.period - b.period)[0].s
      : recurring.map((s) => ({ s, end: endDay(s) ?? "" })).sort((a, b) => (a.end < b.end ? 1 : a.end > b.end ? -1 : 0))[0].s;
  }
  const classification = recurring.length ? "recurring" : list.some((s) => s.classification === "one-time") ? "one-time" : String(chosen.classification ?? "unknown");
  const time = (t) => (typeof t === "number" && t > 0 ? t : null);
  return { classification, cronExpression: chosen.cronExpression ?? null, timeZoneName: chosen.timeZoneName ?? null, startTime: time(chosen.startTime), endTime: time(chosen.endTime), asOf: doc.asOf ?? null };
}
/** Each program's last send from the day buckets and the base call: the lastSends table. */
function lastSendsFrom({ dayUnits, base, listed, selected, params, inWindow }) {
  const later = (map, id, v) => { if (!(map.get(id) >= v)) map.set(id, v); };
  const lastDay = new Map();
  let unreadable = 0;
  for (const u of dayUnits) {
    for (const row of u.rows) {
      const { programId, day: d, n } = ROW_READERS["health-days"](row);
      if (programId == null || d == null) { unreadable++; continue; }
      if (n) later(lastDay, programId, d);
    }
  }
  const lastMonth = new Map();
  for (const b of base.values()) if (b.sent > 0 && inWindow.has(b.month)) later(lastMonth, b.programId, b.month);
  // Every program in the pull, and, unless the pull named its programs,
  // every other listed Active program: one that sent nothing is the most
  // silent of all, and the pull holds no row for it.
  const named = params.selector.names.length > 0 || params.selector.ids.length > 0;
  const others = named ? [] : [...listed.values()].filter((p) => !selected.has(p.id) && p.statuses.includes("PROCESSING"));
  const rows = [...[...selected.values()].map((p) => [p, true]), ...others.map((p) => [p, false])]
    .map(([p, isSelected]) => ({ programId: p.id, name: p.name, statuses: p.statuses, selected: isSelected, lastSendDay: lastDay.get(p.id) ?? null, lastSendMonth: lastMonth.get(p.id) ?? null }))
    .sort((a, b) => cmpKey(a.programId, b.programId));
  return { rows, unreadable };
}
/**
 * A masked sample text → the category it matches, by CONTAINS folded to lower
 * case (the server's CONTAINS is case-insensitive: measured 2026-10-07, four
 * casings of one wording returned one count). Null when none matches.
 * @param {string} message
 * @param {ReadonlyArray<{id: string, pattern: string, kind?: string, expected?: boolean}>} categories
 */
export function matchCategory(message, categories) {
  const text = String(message).toLowerCase();
  return categories.find((c) => text.includes(c.pattern.toLowerCase())) ?? null;
}

// ── Reduce ───────────────────────────────────────────────────────────────────
const zero = () => Object.fromEntries(SEND_MEASURES.map((k) => [k, 0]));
const anyNonZero = (m) => SEND_MEASURES.some((k) => m[k] !== 0);
// What a row's flags add to is the metric registry's rule, stated once there.
function addFlags(m, n, f) {
  for (const k of measuresCounted(f)) m[k] += n;
}
// Which slot of a cell a unit's class adds to, and with what sign: "all"; the
// internal class is the domain calls plus the test-account call, less each
// overlap call (a test contact on an internal domain is in both).
const slotOf = (cls) => (cls === "all" ? "all" : "internal");
const signOf = (cls) => (cls === "test-internal" ? -1 : 1);
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
 * @param {{params: *, whoami: *, programPages: Array<*>, describes: Map<string, *>, units: Array<*>, kbSteps?: *, previous?: ?T10Snapshot, linkSettings?: *, surveyAvailable: boolean, healthState?: ?{unread: Object<string, Array<*>>, objects: Object<string, boolean>}, calls?: *, cliVersion?: ?string, pluginVersion?: ?string}} input
 *   healthState: which health parts were not read whole, and whether the objects only health reads exist on the tenant
 * @returns {T10Snapshot}
 */
export function reduceEngagement(input) {
  const { params, whoami, programPages, describes, units, kbSteps = null, previous: given = null, linkSettings = null, surveyAvailable, healthState = null, calls = {}, cliVersion = null, pluginVersion = null } = input;
  const pulledAt = params.pulledAt;
  if (typeof pulledAt !== "string") throw new Error("engagement reduce: the run carries no pull time — its fact calls never started");
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
  let testSent = 0;
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
      addFlags(cellOf(tplTable, [p, t, m])[slotOf(u.cls)], n * signOf(u.cls), flags);
      if (u.cls === "test") testSent += n;
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
      addFlags(cellOf(accTable, [p, accountKey, m])[slotOf(u.cls)], n * signOf(u.cls), flags);
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
  // A clicked send is in exactly one of the two families: with a company link, or without. The internal
  // class is a SET of send ids here, so a test contact on an internal domain is in it once.
  const clickFamilies = ["click-attr", "click-attr-nolink"];
  for (const family of clickFamilies) for (const cls of ["internal", "test"]) for (const u of of(family, cls)) for (const row of u.rows) internalSends.add(ROW_READERS[family](row).sendId);
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
  // With no internal domain and no test account declared, nobody is known to be internal.
  const noDomains = !params.internalDomains.length && !(params.testAccounts ?? []).length;
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
      if (status === SURVEY_SRC.statuses.submitted) respTable.get(k).submitted += n;
      else if (status === SURVEY_SRC.statuses.partiallySubmitted) respTable.get(k).partiallySubmitted += n;
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
      if (status === SURVEY_SRC.statuses.submitted) totalsByProgram.get(p).submitted += count ?? 0;
      else if (status === SURVEY_SRC.statuses.partiallySubmitted) totalsByProgram.get(p).partiallySubmitted += count ?? 0;
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
    clickPrograms[p] = { state: rollUpTracking(tally), templates: tally };
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

  // ── Health (HLT-1; counted by category since S3b) ──
  // Every table is an array; a part that was not read is empty and says why.
  // Messages were masked at fetch time and are masked again here, so nothing
  // unmasked reaches a snapshot whatever a payload file holds.
  const emptyHealth = () => /** @type {T10Health & Object<string, Array<*>>} */ (/** @type {any} */ (Object.fromEntries(HEALTH_PARTS.map((name) => [name, []]))));
  const healthFacts = emptyHealth();
  /** @type {{pulled: boolean, reason: ?string, asOf: ?string, dayWindow: ?{start: string, endExclusive: string}, parts: Object<string, {pulled: boolean, reason: ?string, basis?: string}>, categories?: Object<string, {counted: boolean, reason: ?string, ids: string[], configured: string[]}>, samples?: Object<string, *>}} */
  let healthMeta = { pulled: false, reason: "health-off", asOf: null, dayWindow: null, parts: {} };
  const healthStats = { otherPrograms: 0, unreadableRows: 0, schedules: { programsWithDoc: 0, programsWithout: 0 }, samples: { bounceReasons: 0, participantFailures: 0 }, categories: { overlapRows: 0 } };
  const cats = params.health?.categories ?? { bounceReasons: [], participantFailures: [] };
  if (params.health?.pull) {
    const day = healthDayWindow(params);
    const unread = healthState?.unread ?? {};
    const objectState = healthState?.objects ?? {};
    const part = (name) => {
      // A sample unit that failed costs that program's sample only, never the part (the others stand).
      const failures = (unread[name] ?? []).filter((f) => name !== "failureSamples" || !FAMILIES[f.family]?.sample);
      const reason = failures.some((f) => f.kind === "too-large") ? "too-large" : failures.length ? "call-failed" : name in PART_OBJECT && !objectState[PART_OBJECT[name]] ? "no-schema" : null;
      return { pulled: reason == null, reason, basis: PART_BASIS[name] };
    };
    const parts = Object.fromEntries(HEALTH_PARTS.map((name) => [name, part(name)]));
    // The sampled split rides the same reads as the samples.
    parts.entrySamples = { ...parts.failureSamples, basis: PART_BASIS.entrySamples };
    const prevHealth = previous ? healthAvailability(previous) : null;
    // Carried months take their bounce reasons from the previous snapshot: one that read none has none to give.
    if (parts.bounceReasons.pulled && refresh.mode === "selective" && !prevHealth?.parts.bounceReasons?.pulled) parts.bounceReasons = { pulled: false, reason: "not-in-previous", basis: PART_BASIS.bounceReasons };
    // Which parts were counted by category: bounce reasons are; the failed participant's reason field takes no filter on this CLI (SOURCES says so).
    const categories = {
      bounceReasons: { counted: true, reason: null, ids: cats.bounceReasons.map((c) => c.id), configured: cats.bounceReasons.map((c) => c.id) },
      participantFailures: FAILED_SRC.reasonFilterable === false
        ? { counted: false, reason: "not-filterable", ids: [], configured: cats.participantFailures.map((c) => c.id) }
        : { counted: true, reason: null, ids: cats.participantFailures.map((c) => c.id), configured: cats.participantFailures.map((c) => c.id) },
    };

    if (parts.bounceReasons.pulled) {
      // Per program × template × month × type: the total and each category, in the all and internal slots; "Other" is the remainder.
      const table = new Map();
      const addTo = (key, cls, n) => {
        const k = JSON.stringify(key);
        if (!table.has(k)) table.set(k, { key, all: 0, internal: 0 });
        table.get(k)[slotOf(cls)] += n * signOf(cls);
      };
      for (const family of ["health-bounce-total", "health-bounce-cat"]) {
        for (const u of of(family)) {
          for (const row of u.rows) {
            const r = ROW_READERS[family](row);
            if (r.programId == null || r.month == null || r.n == null) { healthStats.unreadableRows++; continue; }
            if (!accept(r.programId, r.month)) continue;
            addTo([r.programId, r.templateId ?? null, r.month, r.bounceType ?? null, family === "health-bounce-total" ? null : u.category.id], u.cls, r.n);
          }
        }
      }
      const byLabel = new Map(cats.bounceReasons.map((c) => [c.id, c.label]));
      const groups = new Map();
      for (const e of table.values()) {
        const [programId, templateId, month, bounceType, category] = e.key;
        const g = JSON.stringify([programId, templateId, month, bounceType]);
        if (!groups.has(g)) groups.set(g, { total: { all: 0, internal: 0 }, cats: new Map() });
        if (category == null) groups.get(g).total = { all: e.all, internal: e.internal };
        else groups.get(g).cats.set(category, { all: e.all, internal: e.internal });
      }
      const emitReason = (key, category, message, counts) => {
        const [programId, templateId, month, bounceType] = key;
        const row = { programId, templateId, month, bounceType, message, category };
        // A class deficit is clamped like every send row's (internal-within-all); a negative REMAINDER is not: it is a list defect.
        const internal = category === OTHER_CATEGORY ? counts.internal : Math.min(counts.internal, counts.all);
        const external = counts.all - internal;
        if (internal) healthFacts.bounceReasons.push({ ...row, recipientClass: "internal", count: internal, ...provenance });
        if (external) healthFacts.bounceReasons.push({ ...row, recipientClass: "external", count: external, ...provenance });
        if (category === OTHER_CATEGORY && (internal < 0 || external < 0)) healthStats.categories.overlapRows++;
      };
      for (const [g, { total, cats: counted }] of groups) {
        const key = JSON.parse(g);
        let catAll = 0;
        let catInternal = 0;
        for (const [id, c] of counted) {
          emitReason(key, id, byLabel.get(id) ?? id, c);
          catAll += c.all;
          catInternal += Math.min(c.internal, c.all);
        }
        emitReason(key, OTHER_CATEGORY, null, { all: total.all - catAll, internal: total.internal - catInternal });
      }
      healthFacts.bounceReasons.push(...carried(previous?.facts?.health?.bounceReasons));
      healthFacts.bounceReasons.sort(byKeys("programId", "month", "templateId", "bounceType", "category", "message", "recipientClass"));
    }
    if (parts.participantFailures.pulled) {
      // One row per program, category "other": the per-program total is the one read the object allows.
      const table = new Map();
      for (const u of of("health-reasons-total")) {
        for (const row of u.rows) {
          const r = ROW_READERS["health-reasons-total"](row);
          if (r.programId == null || r.n == null) { healthStats.unreadableRows++; continue; }
          if (!selected.has(r.programId)) { healthStats.otherPrograms++; continue; }
          const have = table.get(r.programId) ?? { programId: r.programId, message: null, category: OTHER_CATEGORY, expected: false, participants: 0, occurrences: 0 };
          have.participants += r.n;
          have.occurrences += r.occurrences ?? 0;
          table.set(r.programId, have);
        }
      }
      healthFacts.participantFailures = [...table.values()].sort(byKeys("programId", "category", "message"));
    }
    if (parts.participantStates.pulled) {
      const table = new Map();
      for (const u of of("health-states")) {
        for (const row of u.rows) {
          const { programId, state, n } = ROW_READERS["health-states"](row);
          if (programId == null || n == null) { healthStats.unreadableRows++; continue; }
          if (!selected.has(programId)) continue;
          const k = JSON.stringify([programId, state]);
          table.set(k, { programId, state, participants: (table.get(k)?.participants ?? 0) + n });
        }
      }
      healthFacts.participantStates = [...table.values()].sort(byKeys("programId", "state"));
    }
    if (parts.lastSends.pulled) {
      const { rows, unreadable } = lastSendsFrom({ dayUnits: of("health-days"), base, listed, selected, params, inWindow });
      healthStats.unreadableRows += unreadable;
      healthFacts.lastSends = rows;
    }
    if (!kbSteps?.schedules) parts.schedules = { pulled: false, reason: "no-kb", basis: PART_BASIS.schedules };
    else {
      for (const p of [...selected.keys()].sort(cmpKey)) {
        const doc = kbSteps.schedules[p];
        if (!doc) { healthStats.schedules.programsWithout++; continue; }
        healthStats.schedules.programsWithDoc++;
        const list = doc.schedules ?? [];
        // A documented program with no schedule keeps ONE row that says so (as the schedule audit does): "documented, none" is not "not documented".
        for (const sc of list.length ? list : [null]) {
          healthFacts.schedules.push({
            programId: p, asOf: doc.asOf ?? null, source: "kb", scheduleType: sc?.scheduleType ?? null, classification: sc ? String(sc.classification ?? "unknown") : NO_SCHEDULE, cronExpression: sc?.cronExpression ?? null, timeZoneName: sc?.timeZoneName ?? null,
            startTime: typeof sc?.startTime === "number" && sc.startTime > 0 ? sc.startTime : null, endTime: typeof sc?.endTime === "number" && sc.endTime > 0 ? sc.endTime : null,
            lastRunSuccess: typeof sc?.lastRunSuccess === "boolean" ? sc.lastRunSuccess : null, lastSuccessTime: sc?.lastSuccessTime ?? null, nextRunTime: sc?.nextRunTime ?? null, runningNow: typeof sc?.runningNow === "boolean" ? sc.runningNow : null,
          });
        }
      }
    }
    // The signals' own tables (F-491): selected programs only, each from its family's rows.
    if (parts.sources.pulled) {
      for (const u of of("health-sources")) {
        for (const row of u.rows) {
          const r = ROW_READERS["health-sources"](row);
          if (r.programId == null) { healthStats.unreadableRows++; continue; }
          if (!selected.has(r.programId)) continue;
          healthFacts.sources.push({ programId: r.programId, sourceType: r.sourceType, lastSyncedOn: r.lastSyncedOn, operation: r.operation });
        }
      }
      healthFacts.sources.sort(byKeys("programId", "sourceType", "lastSyncedOn"));
    }
    if (parts.admissions.pulled) {
      const table = new Map();
      for (const u of of("health-admissions")) {
        for (const row of u.rows) {
          const r = ROW_READERS["health-admissions"](row);
          if (r.programId == null || r.day == null || r.n == null) { healthStats.unreadableRows++; continue; }
          if (!selected.has(r.programId) || r.day < day.start || r.day >= day.end) continue;
          const k = JSON.stringify([r.programId, r.day]);
          table.set(k, { programId: r.programId, day: r.day, participants: (table.get(k)?.participants ?? 0) + r.n });
        }
      }
      healthFacts.admissions = [...table.values()].sort(byKeys("programId", "day"));
    }
    if (parts.entryFailures.pulled) {
      const table = new Map();
      for (const u of of("health-entry-month")) {
        for (const row of u.rows) {
          const r = ROW_READERS["health-entry-month"](row);
          if (r.programId == null || r.month == null || r.n == null) { healthStats.unreadableRows++; continue; }
          if (!selected.has(r.programId) || !inWindow.has(r.month)) continue;
          const k = JSON.stringify([r.programId, r.month]);
          const have = table.get(k) ?? { programId: r.programId, month: r.month, participants: 0, occurrences: 0 };
          have.participants += r.n;
          have.occurrences += r.occurrences ?? 0;
          table.set(k, have);
        }
      }
      healthFacts.entryFailures = [...table.values()].sort(byKeys("programId", "month"));
    }
    if (parts.stepFailures.pulled) {
      // Per program × month: the total with a reason, each category, and "other" = the remainder (flagged below zero, never clamped).
      const totals = new Map();
      const byCat = new Map();
      for (const family of ["health-step-total", "health-step-cat", "health-step-state"]) {
        for (const u of of(family)) {
          for (const row of u.rows) {
            const r = ROW_READERS[family](row);
            if (r.programId == null || r.month == null || r.n == null) { healthStats.unreadableRows++; continue; }
            if (!selected.has(r.programId) || !inWindow.has(r.month)) continue;
            const k = JSON.stringify([r.programId, r.month]);
            if (family === "health-step-total") totals.set(k, (totals.get(k) ?? 0) + r.n);
            else {
              if (!byCat.has(k)) byCat.set(k, new Map());
              byCat.get(k).set(u.category.id, (byCat.get(k).get(u.category.id) ?? 0) + r.n);
            }
          }
        }
      }
      // Each row carries its category's KIND (F-491, 2026-10-08) and the flag derived from it. The remainder — text
      // the shipped list does not name — is UNCLASSIFIED, kind unknown (F-484, redesigned 2026-10-08): the same
      // label an unmatched refusal wording carries, and the lists treat it as a failure needing investigation.
      const kindOfStep = new Map(STEP_FAILURE_CATEGORIES.map((c) => [c.id, kindOf(c)]));
      for (const k of new Set([...totals.keys(), ...byCat.keys()])) {
        const [programId, month] = JSON.parse(k);
        let counted = 0;
        for (const [category, n] of byCat.get(k) ?? []) {
          counted += n;
          if (n) healthFacts.stepFailures.push({ programId, month, category, kind: kindOfStep.get(category) ?? "program-error", expected: isExpectedKind(kindOfStep.get(category)), participants: n });
        }
        const other = (totals.get(k) ?? 0) - counted;
        if (other) healthFacts.stepFailures.push({ programId, month, category: UNCLASSIFIED_CATEGORY, kind: UNKNOWN_KIND, expected: false, participants: other });
        if (other < 0) healthStats.categories.overlapRows++;
      }
      healthFacts.stepFailures.sort(byKeys("programId", "month", "category"));
    }
    // The samples (F-484): one small page per program, picked by sampleTargets from the same counts fetch used, so the
    // picks are the same; a program the previous snapshot sampled whose counts did not move keeps that sample; the rest
    // are named. Each page is read whole for the split by category (entrySamples); the snapshot keeps the
    // SAMPLES_PER_PROGRAM most frequent texts per program and part.
    const samplesMeta = {};
    if (parts.failureSamples.pulled) {
      const sampleUnitsOf = (family) => of(family).filter((u) => u.programs?.length === 1);
      const previousRows = (part) => (previous?.facts?.health?.failureSamples ?? []).filter((r) => r.part === part);
      const previousSplit = (programId) => (previous?.facts?.health?.entrySamples ?? []).filter((r) => r.programId === programId);
      for (const [partName, family, categories] of /** @type {Array<["bounceReasons"|"participantFailures", string, ReadonlyArray<*>]>} */ ([["participantFailures", "health-reasons-sample", cats.participantFailures], ["bounceReasons", "health-bounce-sample", []]])) {
        // A sample is carried only by a SELECTIVE refresh, when the previous snapshot's counts over the SAME window
        // equal this pull's (fetch decides the same way, from the same counts).
        const carryFrom = refresh.mode === "selective" ? previous : null;
        const window = partName === "participantFailures" ? { start: day.start, endExclusive: day.end } : sampleWindowOf(monthWindow(params.window.from, params.window.to));
        const counts = partName === "participantFailures" ? entryCountsFrom(of("health-entry-window"), selected) : otherBounceCountsOverWindow([...of("health-bounce-total"), ...of("health-bounce-cat")], selected, refresh, previous);
        const targets = sampleTargets({ counts, previousCounts: carryFrom ? previousSampleCounts(carryFrom, partName, window) : null, previousSampled: previousSampledPrograms(carryFrom, partName), cap: params.health.samplePrograms });
        const read = new Set();
        for (const u of sampleUnitsOf(family)) {
          const programId = u.programs[0];
          if (!selected.has(programId)) continue;
          read.add(programId);
          const texts = new Map();
          const split = new Map();
          let rows = 0;
          // A text no category matches is UNCLASSIFIED, kind unknown — one label here, in the split and in every
          // list, never null and never a known kind (F-484, redesigned 2026-10-08). Each text carries the rows
          // (participants) that bore it and their occurrences (how many times those participants were refused in
          // all): a reader asking "what keeps people out" wants the second; "how many people" the first.
          const take = (raw, occurrences) => {
            const message = maskMessage(raw);
            if (message == null) return;
            rows++;
            const t = texts.get(message) ?? { count: 0, occurrences: 0 };
            texts.set(message, { count: t.count + 1, occurrences: t.occurrences + occurrences });
            const c = matchCategory(message, categories);
            const key = c?.id ?? UNCLASSIFIED_CATEGORY;
            const kind = c ? kindOf(c) : UNKNOWN_KIND;
            const s = split.get(key);
            split.set(key, { category: key, kind, expected: isExpectedKind(kind), participants: (s?.participants ?? 0) + 1, occurrences: (s?.occurrences ?? 0) + occurrences });
          };
          for (const r of u.rows) {
            if (family === "health-bounce-sample") take(r?.message, 1);
            else for (const m of Array.isArray(r?.messages) ? r.messages : []) take(m, Number.isFinite(r?.occurrences) && r.occurrences > 0 ? r.occurrences : 1);
          }
          const top = [...texts].sort((a, b) => b[1].count - a[1].count || cmpKey(a[0], b[0])).slice(0, SAMPLES_PER_PROGRAM);
          healthStats.samples[partName] += top.length;
          for (const [message, t] of top) {
            const c = matchCategory(message, categories);
            healthFacts.failureSamples.push({ programId, part: partName, message, category: c?.id ?? UNCLASSIFIED_CATEGORY, kind: c ? kindOf(c) : UNKNOWN_KIND, expected: c ? isExpectedKind(kindOf(c)) : false, count: t.count, occurrences: t.occurrences, pulledAt });
          }
          if (partName === "participantFailures") for (const s of split.values()) healthFacts.entrySamples.push({ programId, ...s, sampleRows: rows, pulledAt });
        }
        // A pick that was not read (the token ran out, or the call failed) is named, never silently absent.
        const unreadPicks = targets.sample.filter((id) => !read.has(id)).map((programId) => ({ programId, reason: "not-read" }));
        for (const programId of targets.carried) {
          healthFacts.failureSamples.push(...previousRows(partName).filter((r) => r.programId === programId));
          if (partName === "participantFailures") healthFacts.entrySamples.push(...previousSplit(programId));
        }
        // The window the samples were read over and the counts they were picked from (programs with failures only),
        // so the next pull's carry test compares like with like (F-484).
        samplesMeta[partName] = { cap: params.health.samplePrograms, sampled: read.size, carried: targets.carried.length, notSampled: [...targets.notSampled, ...unreadPicks].sort(byKeys("programId")), programs: [...read, ...targets.carried].sort(cmpKey), window, counts: Object.fromEntries([...counts].filter(([, n]) => n > 0).sort(([a], [b]) => cmpKey(a, b))) };
      }
      healthFacts.failureSamples.sort(byKeys("programId", "part", "message"));
      healthFacts.entrySamples.sort(byKeys("programId", "category"));
    }
    for (const name of HEALTH_PARTS) if (!parts[name].pulled) healthFacts[name] = [];
    healthMeta = { pulled: true, reason: null, asOf: day.asOf, dayWindow: { start: day.start, endExclusive: day.end }, parts, categories, samples: samplesMeta };
    // Every bounced attempt is in exactly one category or in "Other", so the two must agree.
    if (parts.bounceReasons.pulled) {
      const byPm = new Map();
      for (const r of pulledOnly(healthFacts.bounceReasons)) byPm.set(JSON.stringify([r.programId, r.month]), (byPm.get(JSON.stringify([r.programId, r.month])) ?? 0) + r.count);
      checks.push(check("bounce-reasons-sum-to-bounced", [...tplByPm].map(([k, m]) => ({ key: JSON.parse(k), month: JSON.parse(k)[1], measure: "bounced", left: byPm.get(k) ?? 0, right: m.bounced }))));
    }
  }
  const reconciliation = { ok: checks.every((c) => c.ok), checks };

  // ── Dimensions ──
  const design = kbSteps?.programs ?? {};
  const pickName = (names) => [...(names ?? [])].sort((a, b) => b[1] - a[1] || cmpKey(a[0], b[0]))[0]?.[0] ?? null;
  const prevTemplates = new Map((previous?.dimensions?.templates ?? []).map((t) => [t.id, t]));
  const templateIds = [...new Set(byTemplate.map((r) => r.templateId).filter((t) => t != null))].sort(cmpKey);
  // The date a program's doc was last verified: what its step names and schedule are as of.
  const docAsOf = (programId) => kbSteps?.schedules?.[programId]?.asOf ?? null;
  const templates = templateIds.map((id) => ({
    id,
    name: pickName(tplNames.get(id)) ?? prevTemplates.get(id)?.name ?? null,
    uses: [...new Set(byTemplate.filter((r) => r.templateId === id).map((r) => r.programId))].sort(cmpKey).map((programId) => {
      const steps = (design[programId] ?? []).filter((s) => s.templateIds.includes(id));
      const one = steps.length === 1 ? steps[0] : null;
      return { programId, stepName: one?.stepName ?? null, stepOrder: one?.order ?? null, stepCount: steps.length, asOf: design[programId] ? docAsOf(programId) : null };
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
    // The schedule rides every pull made with a KB (S3b): null without one, and for a program the KB has no full doc for.
    programs: [...selected.values()].sort(byKeys("id")).map((p) => ({ ...p, schedule: kbSteps ? pickSchedule(kbSteps.schedules?.[p.id], params.today) : null })),
    templates,
    ...(params.stepDetail ? { steps: [...stepRows.values()].sort(byKeys("programId", "stepId", "variantId")) } : {}),
    accounts: accountKeys.map((key) => ({ key, name: params.accounts.names ? names.get(key) ?? null : null })),
    months: windowMonths,
  };

  // ── Honesty and this snapshot's own caveats ──
  for (const u of of("classes")) {
    for (const row of u.rows) {
      const { source, addressType, n } = ROW_READERS.classes(row);
      if (source !== standingValue(LOG_SRC, "Source")) excluded.nonJoSources += n ?? 0;
      else if (addressType !== standingValue(LOG_SRC, "AddressType")) excluded.ccCopies += n ?? 0;
    }
  }
  const withDesign = [...selected.keys()].filter((p) => design[p]).length;
  const gap = kbGap(selected, kbSteps);
  const honesty = {
    excluded,
    rows: rowStats,
    calls,
    noTemplateId: { sent: noTemplateSent },
    // Counted from the account grain: not known when that grain was not pulled.
    noCompanyLink: { sent: !params.accounts.pull ? null : byAccount.filter((r) => r.bucket === "no-company-link" && r.provenance === "pulled").reduce((s, r) => s + r.sent, 0) },
    stepNames: { source: kbSteps ? "kb" : "none", programsWithDesign: withDesign, programsWithout: selected.size - withDesign },
    // Where the KB is behind the tenant (F-491, redesigned 2026-10-08): the programs it does not document and the
    // ones modified after their doc. The health signals read it; the caveat names it; a narrow refresh closes it.
    kb: gap,
    accountNames: { requested: params.accounts.names ? accountKeys.length : 0, resolved: namesResolved },
    clicks,
    responses: { available: surveyAvailable, ...respStats },
    health: healthStats,
    // The test accounts' sends over the pulled months (they are counted in the internal class).
    testAccounts: { accounts: (params.testAccounts ?? []).length, sent: testSent },
  };
  const caveats = [];
  if (refresh.mode === "selective") caveats.push({ id: "carried-forward-months", detail: { months: refresh.carriedMonths, repullMonths: params.repullMonths, previousPulledAt: refresh.previousPulledAt } });
  if (deleted.size) caveats.push({ id: "deleted-programs-excluded", detail: excluded.deletedPrograms });
  if (!params.stepDetail) caveats.push({ id: "participant-records-not-pulled", detail: { reason: "step-detail-off" } });
  if (!params.accounts.pull) caveats.push({ id: "accounts-not-pulled", detail: { reason: "accounts-off" } });
  if (noDomains) caveats.push({ id: "recipient-class-not-configured", detail: {} });
  if (selected.size - withDesign) caveats.push({ id: "step-names-unavailable", detail: { programs: selected.size - withDesign, source: kbSteps ? "kb" : "none" } });
  if (withDesign) caveats.push({ id: "step-names-as-of", detail: { oldest: [...selected.keys()].filter((p) => design[p]).map(docAsOf).filter(Boolean).sort()[0] ?? null, programs: withDesign } });
  if ((params.testAccounts ?? []).length && params.stepDetail) caveats.push({ id: "test-accounts-not-on-steps", detail: { accounts: params.testAccounts.length } });
  if (!surveyAvailable) caveats.push({ id: "responses-unreadable", detail: { object: SURVEY } });
  if (!reconciliation.ok) caveats.push({ id: "reconciliation-mismatch", detail: { checks: checks.filter((c) => !c.ok).map((c) => c.id) } });
  const healthMissing = Object.entries(healthMeta.parts).filter(([, p]) => !p.pulled).map(([name, p]) => ({ part: name, reason: p.reason }));
  if (healthMissing.length) caveats.push({ id: "health-incomplete", detail: { parts: healthMissing } });
  if (healthFacts.schedules.length) caveats.push({ id: "schedules-from-kb", detail: { oldest: healthFacts.schedules.map((r) => r.asOf).filter(Boolean).sort()[0] ?? null } });
  if (gap.source === "kb" && gap.undocumented.length + gap.behind.length) caveats.push({ id: "kb-behind-tenant", detail: { undocumented: gap.undocumented.length, behind: gap.behind.length, programs: [...gap.undocumented, ...gap.behind.map((b) => b.programId)], keysFile: KB_GAP_KEYS_FILE, refreshSeconds: (gap.undocumented.length + gap.behind.length) * CALL_SECONDS.describe } });
  {
    // Wordings no category knows (F-484, redesigned 2026-10-08): the unclassified sample texts and the step remainder.
    const unc = healthFacts.failureSamples.filter((r) => r.category === UNCLASSIFIED_CATEGORY);
    const stepUnc = healthFacts.stepFailures.filter((r) => r.category === UNCLASSIFIED_CATEGORY && r.participants > 0).reduce((s, r) => s + r.participants, 0);
    if (unc.length || stepUnc) caveats.push({ id: "unclassified-wordings", detail: { wordings: new Set(unc.map((r) => r.message)).size, programs: new Set(unc.map((r) => r.programId)).size, participants: unc.reduce((s, r) => s + r.count, 0), occurrences: unc.reduce((s, r) => s + (r.occurrences ?? r.count), 0), stepParticipants: stepUnc } });
  }
  const allTime = HEALTH_PARTS.filter((name) => healthMeta.parts[name]?.pulled && PART_BASIS[name] === "all-time");
  if (allTime.length) caveats.push({ id: "health-all-time", detail: { parts: allTime, reason: "all-time" } });
  if (healthMeta.parts.participantFailures?.pulled && healthMeta.categories?.participantFailures.counted === false) caveats.push({ id: "participant-failures-no-breakdown", detail: { reason: healthMeta.categories.participantFailures.reason, expectedReasons: (params.health?.expectedReasons ?? []).length } });
  if (healthStats.categories.overlapRows) caveats.push({ id: "failure-categories-overlap", detail: { rows: healthStats.categories.overlapRows, parts: [...(healthFacts.bounceReasons.some((r) => r.category === OTHER_CATEGORY && r.count < 0) ? ["bounceReasons"] : []), ...(healthFacts.stepFailures.some((r) => r.category === OTHER_CATEGORY && r.participants < 0) ? ["stepFailures"] : [])] } });
  for (const [part, s] of Object.entries(healthMeta.samples ?? {})) if (s.notSampled.length) caveats.push({ id: "failure-samples-capped", detail: { part, notSampled: s.notSampled.length, cap: s.cap, secondsEach: CALL_SECONDS[part === "participantFailures" ? "health-reasons-sample" : "health-bounce-sample"] } });
  if (healthFacts.entrySamples.length) caveats.push({ id: "failure-samples-sampled", detail: { programs: new Set(healthFacts.entrySamples.map((r) => r.programId)).size } });
  if (checks.some((c) => c.drift)) caveats.push({ id: "incomplete-period-drift", detail: { from: params.incompleteFrom, checks: checks.filter((c) => c.drift).map((c) => ({ id: c.id, drift: c.drift })) } });

  const facts = { byTemplate, ...(byStep ? { byStep } : {}), byAccount, responses, responseParticipants, uniques, health: healthFacts };
  return {
    schemaVersion: T10_SCHEMA_VERSION,
    kind: "engagement",
    meta: {
      source: "jo-engagement",
      params: {
        window: { from: params.window.from, to: params.window.to }, selector: params.selector, internalDomains: params.internalDomains, unsubscribeLinks: params.unsubscribeLinks, testAccounts: params.testAccounts ?? [],
        stepDetail: params.stepDetail, accounts: params.accounts, repullMonths: params.repullMonths, pageSize: params.pageSize, health: params.health ?? null,
      },
      pulledAt,
      timeZone: params.timeZone,
      tenantHost: whoami.host,
      cliVersion,
      pluginVersion,
      window: params.window,
      incompleteFrom: params.incompleteFrom,
      dateBasis: { object: LOG, field: LOG_SRC.dateField, grain: "month", stepDetail: params.stepDetail ? { object: JO_LOG, field: JO_SRC.dateField } : null },
      stepDetail: params.stepDetail,
      accounts: { pulled: params.accounts.pull, reason: params.accounts.pull ? null : "accounts-off" },
      participantRecords: { pulled: params.stepDetail, reason: params.stepDetail ? null : "step-detail-off" },
      health: healthMeta,
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
  // A run started before health facts existed pulled none; one from before categories and test accounts had none;
  // one from before the per-program samples and the quiet-days setting takes their defaults.
  if (!params.health) params.health = { pull: false, lookbackDays: 90 };
  params.health.categories ??= { bounceReasons: [], participantFailures: [] };
  params.health.expectedReasons ??= [];
  params.health.samplePrograms ??= SAMPLE_PROGRAM_CAP;
  params.health.quietDueDays ??= QUIET_DUE_DAYS_DEFAULT;
  params.testAccounts ??= [];
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
    // The retired live describe family (SCHEDULE_DESCRIBE) is not a FAMILIES member, so a run that logged it reduces without it.
    units: ok.filter((r) => r.family in FAMILIES && r.family !== SCHEDULE_DESCRIBE).map((r) => ({ ...r, rows: read(r) })),
    kbSteps: existsSync(kbPath) ? readJsonFile(kbPath) : null,
    previous: opts.previous ?? null,
    linkSettings: opts.linkSettings ?? null,
    surveyAvailable: !!(survey && schemaTypes(read(survey))),
    // Which health parts were not read whole, and whether the two objects only health reads exist here.
    healthState: {
      unread: status.health?.unread ?? {},
      objects: Object.fromEntries(Object.entries(HEALTH_OBJECTS).map(([part, object]) => {
        const rec = one("schema").find((r) => r.object === object);
        return [part, !!(rec && schemaTypes(read(rec)))];
      })),
    },
    // Counted from the log, so a run resumed three times reads like one that never stopped.
    calls: { answered: ok.length, split: [...records.values()].filter((r) => r.truncated || r.status === "split").length, retried: [...records.values()].filter((r) => r.attempt > 1).length },
    cliVersion: opts.cliVersion ?? null,
    pluginVersion: opts.pluginVersion ?? null,
  };
}

// The T-10 read floor (openSnapshot, clickAvailability, readClicked,
// accountAvailability, programClickAvailability, readResponses) lives in
// engagement-query.mjs, the module every reader of a snapshot loads. This file
// imports the two it uses itself.

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
  "[--name <program-name-or-id>]... [--ids-file <file>] [--sent-since <date|Nd|Nm>] [--internal-domain <domain>]... [--unsubscribe-link <link|host>]... [--test-account <company id>]... [--step-detail] [--accounts] " +
  "[--health [--health-lookback-days <N>] [--failure-categories <file.json>] [--expected-reason <text>]... [--sample-programs <N>] [--quiet-due-days <N>]] " +
  "[--page-size <N>] [--max-pages <N>] [--previous <snapshot.json>] [--full] [--out <snapshot.json>]  |  engagement.mjs reduce --run-dir <dir> --out <snapshot.json> [--previous <file>] [--link-settings <file>]";
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
  const healthFlags = ["--health-lookback-days", "--failure-categories", "--expected-reason", "--sample-programs", "--quiet-due-days"].filter((f) => argv.includes(f));
  if (healthFlags.length && !argv.includes("--health")) fail(`${healthFlags.join(", ")} only applies with --health (health facts are off unless asked for; plan prints what they add)`);
  const categoriesFile = opt("--failure-categories");
  let categories = {};
  if (categoriesFile) {
    try {
      categories = readJsonFile(resolve(categoriesFile));
    } catch (e) {
      fail(`--failure-categories ${categoriesFile}: ${e instanceof Error ? e.message : e}`);
    }
    if (!categories || typeof categories !== "object" || Array.isArray(categories)) fail(`--failure-categories ${categoriesFile}: the file must hold an object {bounceReasons: [...], participantFailures: [...]}`);
    const stray = Object.keys(categories).filter((k) => !["bounceReasons", "participantFailures"].includes(k));
    if (stray.length) fail(`--failure-categories ${categoriesFile}: unknown key(s) ${stray.join(", ")} — the file holds bounceReasons and participantFailures only`);
  }
  const rawParams = (today) => ({
    today, from: opt("--from"), to: opt("--to"),
    names: all("--name"), ids: idsFile ? parseIdList(readFileSync(resolve(idsFile), "utf8")) : [], sentSince: opt("--sent-since"),
    internalDomains: all("--internal-domain"), unsubscribeLinks: all("--unsubscribe-link"), testAccounts: all("--test-account"), stepDetail: argv.includes("--step-detail"),
    accounts: {
      busiest: int("--accounts-busiest"), lowEngagement: int("--accounts-low"), mostBounces: int("--accounts-bounce"), lowEngagementMinDelivered: int("--accounts-low-min-delivered"),
      pinned: pinFile ? parseIdList(readFileSync(resolve(pinFile), "utf8")) : [], names: !argv.includes("--no-account-names"), pull: argv.includes("--accounts"),
    },
    incompleteFrom: opt("--incomplete-from"), repullMonths: int("--repull-months"), forceFull: argv.includes("--full"),
    pageSize: int("--page-size"), maxPages: int("--max-pages"), timeoutMs: int("--timeout-ms"), pulledAt: opt("--pulled-at"), timeZone: opt("--time-zone"),
    health: { pull: argv.includes("--health"), lookbackDays: int("--health-lookback-days"), categories, expectedReasons: all("--expected-reason"), samplePrograms: int("--sample-programs"), quietDueDays: int("--quiet-due-days") },
  });
  let params;
  try {
    params = resolveParams(rawParams(opt("--today")));
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }
  if (mode === "run" && !opt("--out")) fail(`run needs --out <snapshot.json> — ${USAGE}`);
  const prevPath = opt("--previous") ? resolve(opt("--previous")) : null;
  const previous = prevPath ? readSnapshot(prevPath) : null;
  const runId = opt("--run") ?? stampClock(Date.now()).pulledAt.replace(/[^0-9]/g, "").slice(0, 14);
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) fail(`--run must be a plain name (letters, digits, . _ -), got "${printable(runId, 40)}"`);
  const runDir = join(wsDir, ".gs-superadmin", "tmp", "engagement", runId);
  const runFile = join(runDir, "run.json");
  // A resumed run keeps the parameters it started with: the day it was planned on (F-483: a plan before
  // midnight and its run after it are one run, so `today` is re-read from the run unless --today says
  // otherwise) and the pull time, stamped when its fact calls started (F-482). What differs is named.
  const stableOf = (p) => { const { pulledAt: _a, timeZone: _b, ...rest } = p; return rest; };
  if (existsSync(runFile)) {
    const started = readJsonFile(runFile);
    if (opt("--today") === undefined && started.params?.today && started.params.today !== params.today) {
      try {
        params = resolveParams(rawParams(started.params.today));
      } catch (e) {
        fail(e instanceof Error ? e.message : String(e));
      }
    }
    const was = stableOf(started.params);
    const now = stableOf(params);
    const moved = [...new Set([...Object.keys(was), ...Object.keys(now)])].filter((k) => JSON.stringify(was[k]) !== JSON.stringify(now[k]));
    if (moved.length) fail(`the run at ${runDir} was started with different parameters (${moved.join(", ")} moved) — pass the same flags to resume it, or a new --run`);
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
    rows: Object.fromEntries(Object.entries(s.facts).map(([k, v]) => [k, Array.isArray(v) ? v.length : Object.fromEntries(Object.entries(v).map(([part, rows]) => [part, rows.length]))])),
    // Which health parts were read; a part that was not says why, and its table is empty.
    health: healthAvailability(s),
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
