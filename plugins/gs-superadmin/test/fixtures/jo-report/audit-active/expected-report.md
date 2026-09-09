# JO report — audit-active

- tenant: fixture-tenant (https://fixture-tenant.example.com, sandbox)
- generated: <generated>
- mode: audit-active
- freshness: statuses live as of 2026-07-12T00:00:00.000Z; KB last_verified unknown

## Summary

- scope: PROCESSING — 4 program(s) audited (of 6 in the index)
- schedule rows: 2 (1 recognized cron(s), 1 unrecognized, 2 program(s) without a schedule)
- multi-step programs (step tables below): 2

## Active programs — schedules

| program | status | type | schedule | next run | last success | last run success | running now |
|---|---|---|---|---|---|---|---|
| Daily Drip (prog-daily) | PROCESSING (live) | recurring | Daily at 08:00 Asia/Kolkata | 2026-07-13 08:00:00 Asia/Kolkata | 2026-07-12 08:00:00 Asia/Kolkata | true | false |
| No Schedule (prog-nosched) | PROCESSING (kb) | no schedule captured | — | — | — | — | — |
| Stub Program (prog-stub) | PROCESSING (kb) | no schedule captured | — | — | — | — | — |
| Weird Cron (prog-weird) | PROCESSING (kb) | CRON | `0 0 8 L * ? *` (raw cron - pattern not recognized) | 2026-07-13 02:30:00 UTC | 2026-07-12 02:30:00 UTC | true | false |

## Step detail (multi-step programs)



### Daily Drip (prog-daily) — steps

| order | step type | step name | email template | timer | Per-step sends |
|---|---|---|---|---|---|
| 1 | ACTION / OUTBOUND_CALL / SEND_EMAIL | Step 1 | Template 1 (+2 variant template(s)) | -- | not available via CLI |
| 2 | TIMER | Step 2 | — | DAYS 2 days | not available via CLI |
| 3 | ACTION / OUTBOUND_CALL / SEND_EMAIL | Step 3 | Template 3 | -- | not available via CLI |

### No Schedule (prog-nosched) — steps

| order | step type | step name | email template | timer | Per-step sends |
|---|---|---|---|---|---|
| 1 | ACTION / OUTBOUND_CALL / SEND_EMAIL | Step 1 | Template 1 | -- | not available via CLI |
| 2 | ACTION / OUTBOUND_CALL / SEND_EMAIL | Step 2 | Template 2 | -- | not available via CLI |

## Caveats & data gaps

- 5 of 6 program statuses are KB-cached (partial live sweep) — the audited set is scoped by status, so it may include stopped programs or miss newly-activated ones; verify before acting.
- 1 active program(s) exist live but have no KB doc (gaps.liveOnly) — not auditable here; gap-fill via `jo p describe` and re-index.
- 1 audited program doc(s) are stubs — schedules and steps unknown for those rows.
- 1 schedule row(s) carry a cron the humanizer does not recognize — shown raw and labeled, never guessed.
- 2 audited program(s) have no schedule captured in the KB payload.
- Recurring/one-time is derived from the cron expression (only `type:"CRON"` was observed in schedule data; literal ONE-TIME/RECURRING would be honored verbatim). Per-step send counts are not available via CLI.

---

Re-run: `node <jo-report> audit-active --index <root>/er-index.json --report <root>/lock-r --csv-dir <root>/lock-c`
