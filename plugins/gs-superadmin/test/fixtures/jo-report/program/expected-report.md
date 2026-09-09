# JO report — program

- tenant: fixture-tenant (https://fixture-tenant.example.com, sandbox)
- generated: <generated>
- mode: program · args: --name prog-1
- freshness: statuses KB-cached; KB last_verified unknown

## Renewal Outreach | Enterprise (prog-1)

- status: PROCESSING (kb) — active: yes
- model: Email Chain (`DRIPV2`)
- start date: 2022-12-02T16:53:20.000Z
- KB doc: fixture-tenant/journey/prog-1.md

| # | type | step | detail | survey |
|---|---|---|---|---|
| 1 | START | Start |  |  |
| 2 | ACTION | Send Email | email: Main Template — subject: Hello there {Bound Label} (+1 variant template(s)) | Renewal Survey |
| 3 | TIMER | Wait | timer: 3 days |  |
| 4 | ACTION | Send Missing | email: Gone Template (no KB doc) |  |
| 5 | ACTION | Variant Only | email (variant-mapped only): Alt Template — subject: Alt subject |  |
| 6 | END | End |  |  |

## Caveats & data gaps

- 1 template doc(s) predate token metadata (no "## Tokens" section) — template-side token labels are unavailable for them (program-side bindings still resolve where a program is in context). Backfill via the skill's gap-fill flow (mark the docs stale → describe-batch re-fetches them).
- 1 referenced template(s) have no KB doc — bodies not available; fetch each with `gs-admin --json jo email template --id '<id>'` (ids: tpl-gone).
- 1 of 1 resolved program status(es) are KB-cached (no or partial live sweep) — verify before acting on active/inactive.
- shallow report (default): email bodies omitted — re-run with `--deep` for full subject/body/variant content.

---

Re-run: `node <jo-report> program --index <root>/er-index.json --name prog-1 --report <root>/lock-r --csv-dir <root>/lock-c`
