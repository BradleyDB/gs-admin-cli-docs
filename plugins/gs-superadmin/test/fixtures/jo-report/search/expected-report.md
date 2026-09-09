# JO report — search

- tenant: fixture-tenant (https://fixture-tenant.example.com, sandbox)
- generated: <generated>
- mode: search · args: --query zebra
- freshness: statuses KB-cached; KB last_verified unknown

## Summary

- terms: `zebra` — substring, case-insensitive
- templates searched: 4 (of 4 in the index)
- templates matched: 2
- programs referenced: 2 distinct program(s), via 2 template→program link(s)

## Hits

### Stopped Template (tpl-stopped)

- subject: subj
- used by 1 program(s): Stopped Program (STOP)
- KB doc: fixture-tenant/journey-email-templates/tpl-stopped.md

| field | term | snippet |
|---|---|---|
| body | zebra | zebra appears here too |

### Welcome Hello (tpl-hello)

- subject: Your renewal is due
- used by 1 program(s): Active Program (PROCESSING, active)
- KB doc: fixture-tenant/journey-email-templates/tpl-hello.md

| field | term | snippet |
|---|---|---|
| variant "Variant B" body | zebra | the zebra keyword lives in this variant body only. |

## Caveats & data gaps

- 4 template doc(s) predate token metadata (no "## Tokens" section) — template-side token labels are unavailable for them (program-side bindings still resolve where a program is in context). Backfill via the skill's gap-fill flow (mark the docs stale → describe-batch re-fetches them).
- 2 template id(s) referenced by programs have no KB doc and were NOT searched — fetch each with `gs-admin --json jo email template --id '<id>'` (first 2: tpl-missing-1, tpl-missing-2; full list in the index under gaps.referencedTemplatesMissing).
- 1 KB template doc(s) are metadata-only (no captured body) — searched on title/subject only.
- 1 program doc(s) are stubs (steps unknown) — "used by" program lists may be incomplete.
- KB scope: only the 4 template(s) with KB docs were searched — tenant templates never captured by a crawl are invisible here except via program references.

---

Re-run: `node <jo-report> search --index <root>/er-index.json --query zebra --report <root>/lock-r --csv-dir <root>/lock-c`
