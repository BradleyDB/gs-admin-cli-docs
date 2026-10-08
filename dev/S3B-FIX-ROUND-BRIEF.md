# S3b fix round — brief (F-484 reopen, F-491 redesign, F-488, F-489, F-490, F-492, F-493, F-494)

Written 2026-10-07 mid-build so a compaction or a fresh session loses nothing. Branch
`feat/jo-dash-s3b-health-batch` (PR #43, unmerged). Round token to mint at handoff:
`hb-20261007-03` (the next free; mint LAST, via `dev-utils handoff`). Next free F-number: F-495.
Tenant specifics stay out of this file; the measurement outputs live only in the session
scratchpad and are summarized here as shapes and orders of magnitude.

## Rulings of record (Bradley, 2026-10-07, in the build session) — record under HLT-1 in the plan

1. **"Stopped working" is four conditions, each read from its own data, never inferred from
   the schedule:** (a) the schedule has ended (schedules have end dates) or participant sync
   is disabled; (b) it runs but admits nobody; (c) the only participants arriving are refused
   for a reason that is NOT expected by design; (d) the program itself errors (a participant
   who got in falls off at a step; SYSTEM_ERROR participants are this: "they did not fail to
   get in, they show as dropped off", an outage or a maintenance window).
2. **Expected refusals (ship as the default list, product wordings, no tenant value):** already
   in participant list; unique criteria already exists; met the advanced criteria (added by
   Bradley); unsubscribed from categories; Global Opt Out; Bounce list; the Send Email step's
   opt-out hit (builder's reading, unchallenged). NOT expected: null recipient email (a data
   problem). "It would still be worth noting if your only participants coming in are the
   'working as expected' filters — at a certain point nobody new is getting in." → the
   `admitting-nobody` list.
3. **Finished campaign:** a one-off (no recurring schedule) whose participants have all
   "made it through the final step or dropped" — nothing in flight (ACTIVE or PAUSED). REVIEW
   is a never-published draft's state (measured: all but a few hundred of a million REVIEW
   participants sit on NEW programs; no Active program holds one) → not in flight.
4. **Admitting nobody threshold:** "something to ask during setup, with a defaulted fallback
   of 5 days" → `--quiet-due-days` (default 5), and a DSH-3 interview question for S5.
5. **Sample scope and cost:** failure text is re-read only where it can have changed — a
   draft never, a stopped program never again, a one-and-done once; the builder's
   implementation keys it on counts: a program whose window failure count equals the
   previous snapshot's keeps its sample. Cap 25 programs per kind as a guard rail;
   `--sample-programs` raises it; the PLAN prints how many programs have failures, how many
   the cap covers, and the seconds the rest would cost ("they just need to know the time
   cost"). This is the shipped default for anyone running the pull.
6. **F-492 host names:** builder's call — mask recipient mail hosts to `<host>`; Bradley can
   overrule at the verdict.

## Measurements (production tenant, reads only, 2026-10-07, build session)

- `ao_participants`: `CreatedAt`, `ModifiedAt` DATETIME, filterable + groupable (month/day);
  `FailureReasons` is a STRING here, filterable, CONTAINS works; `ParticipantState` values
  seen: ACTIVE, COMPLETED, DROP, KNOCKED_OFF, PAUSED, REVIEW, SYSTEM_ERROR. Step-failure
  wordings: "cta creation failed at step - Create CTA 1, reason - The following fields have
  invalid IDs : OwnerId" / "CTA creation failed at step 'Create CTA', Reason: 'Found invalid
  IDs in fields : OwnerId'" (DROP); "Email is Bounce, participant is dropped from process at
  step '<step>'" (DROP); "Participant was dropped from the journey as part of Record Delete
  operation. The base object record that got deleted was of type: <type>" (KNOCKED_OFF, all
  of them); SYSTEM_ERROR: "Failed to evaluate condition, Reason: null" (330 of 336) plus two
  orchestration-engine errors; clustered on a few dates (incidents), mostly 2023–2025.
- **Server CONTAINS is case-insensitive:** four casings of one wording returned one count.
- `ao_failed_participants`: `ModifiedAt` DATETIME filterable/groupable and it MOVES when the
  same key is refused again (records with OccurrenceCount > 1 modified that day); `IN` on the
  program id plus a date filter works per program; `--order-by [{"name":"ModifiedAt",
  "order":"DESC"}]` works on `rp run` (the field must be in show-fields). `UniqueCriteria` is
  populated on every row (a value, high cardinality) — NOT a reason split. Refusal wordings
  (8 distinct in 500 recent rows): the seven expected above plus "Recipient Email Address
  field contains Invalid value {null} for EMAIL data type".
- `ao_participant_source_configuration`: one page tenant-wide (order 10^3 rows); every
  Active program has an active source row (one program has 300); `LastSyncedOn` is the
  heartbeat: of 64 Active programs 27 synced ≤1 day, 4 ≤7, 11 ≤35, 18 ≤120, 4 older. The
  describe payload carries the same `lastSyncedOn` per source and a `syncConfig` with NO run
  result.
- Schedule run-state fields are DEAD on this tenant: `lastRunSuccess` false with all times 0
  and `nextRunTime` in 2024 on a survey program that synced today. `startTime`/`endTime`
  present (epoch ms). Stale DRIPV2 programs have NO schedule: synced once at creation, Active
  since (finished campaigns).
- `jo p list` rows carry `participantSyncScheduleDisabled` (0 of 64 Active) and
  `participantSourceType`.
- Tenant-wide group-by on `ao_participants` timed out once (no date filter) and succeeded on
  retry; with a date filter it answered.

## Design (built)

Per program, six signals in `programHealth(snapshot)` (engagement-query.mjs; alias
`silentPrograms`): schedule (recurring/ended/not-started/one-time/none/disabled), ingest
(last sync vs cron last due), admissions (created per day over the last N due days), entry
(exact refusals per month + sampled split by category), steps (counted by category per
month; platform error by state), sends (own-history rule for every program), finished.
ONE list per program (`HEALTH_LISTS`): schedule-ended, sync-disabled, ingest-overdue,
failing-entries, admitting-nobody, step-errors, finished, no-recent-sends,
no-sends-in-window, cannot-judge, ok. Live `jo p describe` reads RETIRED.

New health tables (T-10 additive): `sources`, `admissions`, `entryFailures`, `stepFailures`,
`entrySamples`; `failureSamples` rows gain category/expected/count/pulledAt; `schedules`
rows gain startTime/endTime; `dimensions.programs[].schedule` gains startTime/endTime;
`dimensions.programs[].syncScheduleDisabled`; `meta.health.samples`; `meta.params.health`
gains `samplePrograms`, `quietDueDays`. New families: health-sources, health-admissions,
health-entry-month, health-step-total/-cat/-state; samples per program (`programs: [id]`,
day window, order-by newest) picked by pure `sampleTargets` in fetch AND reduce.
`splitUnit` cuts a tenant-wide unit by its `scope`. STEP_FAILURE_CATEGORIES in
engagement-query.mjs (text categories + the SYSTEM_ERROR state). Mask: host rule + wider id
class (F-492). `provisionalSpan/provisionalText` (F-493) used by dataPulledLine, the
incomplete-period caveat, engagement-report leadCaveats, dashboard-runtime footnote.
programTraits.recurring null for pass-through labels (F-494).

## Build checklist (every item done 2026-10-07; the round is handed off — see the bus header's Under test line for the token)

State after the round (2026-10-07, build session, post-compaction): every item below is DONE and committed on
feat/jo-dash-s3b-health-batch (PR #43). The mutation sweep ran with predictions written first: 8 mutants, 7 killed,
M8 (the provisional flags-from clamp) survived AS PREDICTED — no committed check has the re-pull horizon later than
the incomplete-from day; a vacuity for V2 to read on a 1-month re-pull, not a defect. The bus carries the Fix notes,
the two copy-outs (F-484, F-491) and the handoff block; dev's pointer comment is re-stamped after the mint. What is
left is the TESTER's: V2 on this token (Y2, Y6, Y17, Y18), then the merge of PR #43 on Bradley's go-ahead. The plan's
DSH-3 carries the two interview questions (quiet due days, sample cap) for S5.

- [x] engagement-query.mjs: SOURCES, MASK_RULES, FAILURE_CATEGORIES defaults,
      STEP_FAILURE_CATEGORIES, CAVEATS (incomplete-period, schedules-from-kb,
      failure-samples-capped, failure-samples-sampled), judgeHealth/programHealth,
      dueDaysBefore, provisionalSpan/provisionalText.
- [x] engagement.mjs: header, typedefs, imports, readers, families, rpRunArgv orderBy,
      validateQuery orderBy, splitUnit scope, params (samplePrograms, quietDueDays),
      listedPrograms syncScheduleDisabled, planUnits, sampleTargets + count helpers,
      estimate.health.samples, Phase E per-program samples, pickSchedule start/end,
      matchCategory, reduce (new tables, samples, caveats, meta.health.samples), loadRun, CLI.
- [x] jo-report.mjs normSchedule startTime/endTime; dashboard-groups.mjs recurring (F-494);
      engagement-report.mjs + dashboard-runtime.mjs provisional text.
- [x] engagement-report.mjs: add `provisionalText` to its engagement-query import.
- [x] Fixture acme-tenant.mjs: `ao_participant_source_configuration` table + schema
      (ActiveVersion, Deleted, LastSyncedOn, ParticipantSourceType, ParticipantOperationType,
      AdvancedOutreachId); participants gain CreatedAt/ModifiedAt/FailureReasons (step
      failures for DROP/KNOCKED_OFF/SYSTEM_ERROR rows with the product wordings above);
      failed participants gain ModifiedAt; list rows gain participantSyncScheduleDisabled;
      schedules gain startTime/endTime (one ENDED schedule variant; one one-off synced-once
      program; an "outsider" draft program holding more refusals than a page — F-484's class
      test); rpRun honors `--order-by`; the FAILURE_REASONS texts should include the shipped
      expected wordings so the sample split has expected rows.
- [x] Tests: test/engagement.mjs (replace the silent/live-read checks with signal checks;
      F-484 class test: every selected program with failures gets a sample or is named;
      samples per program, order-by, cap + carry; step categories oracle; sources/admissions
      oracles; mask F-492 cases; `MASK_RULES.length` 6), test/engagement-query.mjs
      (programHealth over GOLD; MASK_RULES 6; dataPulledLine string; FAILURE_CATEGORIES no
      longer empty for participantFailures), test/contract-conformance.mjs (PARTS list of 11;
      basis "at-pull"; program keys + syncScheduleDisabled; schedule keys + startTime/endTime;
      meta.health keys + samples; meta.params.health keys + quietDueDays,samplePrograms;
      failureSamples/entrySamples/sources/admissions/entryFailures/stepFailures row keys;
      PINNED list; schedules "live" assertion removed), test/dashboard-groups.mjs (a CRON
      pass-through program → recurring null), test/dashboard-page.mjs provisional footnote,
      test/engagement-report.mjs freshness line, test/tenant-deps.mjs (F-488 caveat names
      programs). Regenerate goldens: `node test/engagement.mjs --write-golden`,
      `node test/engagement-query.mjs --write-golden` (+ report golden if the suite has one).
- [x] F-488 tenant-deps.mjs: the aggregate caveat names each unresolved rule's referencing
      programs (name + id, capped at 10 per rule, cap stated) and the "not evidence" clause.
- [x] F-489 refresh SKILL.md step 3b-3 fallback sentence (`--command "gs-admin --json re r
      describe --id {id}"` when the domain has no recorded describe) + setup SKILL.md pointer.
- [x] F-490 dev/RELEASE-CHECKLIST.md: drop the "project-memory chronicle tail" clause.
- [x] CHANGELOG 0.47.0 health bullets rewritten (signals, samples per program, flags).
- [x] Plan: HLT-1 "Rulings (Bradley, 2026-10-07)" block + As-shipped (S3b fix round);
      DSH-3: the quiet-due-days interview question; session ledger line.
- [x] dev/VALIDATION.md § HLT-1 re-bank for V2: Y2 participant half → per-program samples;
      Y6 replaced by the signals (each list read true by Bradley; the admitting-nobody
      threshold; a finished campaign reads finished); new Y17 sources heartbeat vs UI; Y18
      step categories; CONTAINS case-insensitivity banked as measured.
- [x] Bus: F-484 Fix (second fix after one reopen; Judge; Sibling sweep; mutation copy-out),
      F-491 Fix + Redesign: line (first fix, but the mechanism is being replaced — name the
      model replaced), F-492/F-493/F-494/F-488/F-489/F-490 Fix notes; F-486 carried to S4b.
      Then `dev-utils handoff --blind-spots "..."` on the branch; pointer comment on dev.
- [x] Run: `node plugins/gs-superadmin/test/engagement.mjs`, engagement-query, dashboard-groups,
      dashboard-page, engagement-report, contract-conformance, tenant-deps,
      trace-reader-shapes; `npm run build:reader-shapes`; `npm run typecheck`;
      `node build/check-stale-facts.mjs`; mutation sweep with predictions written first.
