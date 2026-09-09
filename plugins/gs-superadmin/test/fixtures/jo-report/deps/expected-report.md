# JO report — deps

- tenant: fixture-tenant (https://fixture-tenant.example.com, sandbox)
- generated: <generated>
- mode: deps · args: --object Company --field ARR --scan-tokens
- freshness: statuses KB-cached; KB last_verified unknown

## Summary

- terms: object `Company`, field `ARR` — case-insensitive exact match on system name or label (field aliasing not in force: no .gs-superadmin workspace at or above the KB directory)
- scope: active programs (PROCESSING) — 3 program(s) scanned (of 5 in the index)
- field-level usage rows: 2 · email-token rows: 0
- programs with object-level-only matches: 1
- distinct objects touched: Company

## Usage (participant sources)

| program | status | source | usage | object | field | matched term | detail |
|---|---|---|---|---|---|---|---|
| Filter Program (prog-filter) | PROCESSING (kb) | Src A | filter | Company | Arr__gc ("ARR") | ARR | operator GREATER_THAN, alias F1 |
| Filter Program (prog-filter) | PROCESSING (kb) | Src A | filter | Company | Status__gc ("Company Status") | Company | operator EQUALS, alias A |

## Email-token usage (--scan-tokens)

_no ${...} tokens matched the field terms_

## Object-level matches (no field-term hit)

These programs filter on a matched object but none of the given field terms — the object is in use even though the specific fields were not found.

| program | status | object(s) | fields its filters actually reference |
|---|---|---|---|
| Object Only (prog-objonly) | PROCESSING (kb) | Company | Industry__gc |

## Caveats & data gaps

- Scope: active programs only — 2 of 5 program(s) NOT scanned. A schema change can still break inactive programs someone later reactivates; re-run with --all for full coverage.
- 5 of 5 program statuses are KB-cached (no live sweep) — the scope and every status shown may rely on stale statuses; verify before acting.
- --object matching is FILTER-CONDITIONS-ONLY: C1 mappings carry no object names (only filter conditions do), so query-SELECT/mapping usage of an object is INVISIBLE here — and in practice that can be the dominant usage kind (S5-V live validation found every JO dependent of the acceptance object was mapping-side: `dm deps check` named them all while this view showed none, because few programs use query filters). Treat an empty --object result as "no FILTER usage found", never "no usage". Objects without live coverage in this run: `Company` — capture each with the corroboration command below and pass it back via `--live-deps <file>` to render the object-level truth in this report. A rendered live section whose payload objectName differs from the term does NOT count as its coverage (the term may be the object's label — re-capture with the exact system name), and neither does an incomplete capture.
- Field matching ran EXACT-ONLY — no tenant field-aliasing convention is in force (no .gs-superadmin workspace at or above the KB directory), so fields carrying a task-alias prefix (a tenant build standard can prefix every task-built field, e.g. `X_<field>`) did NOT match their unprefixed names and real dependents may be missing from this report. If the tenant aliases fields, declare the pattern in the workspace CONVENTIONS.md `## Field aliasing` section — this report reads it itself — or re-run with `--alias-prefix '<regex>'`.
- --scan-tokens resolves each program's own token bindings to their bound field (both program generations) and also matches literal token text. Coverage limit: token rows fire only for programs whose journey docs are full-depth in the KB, and locations come from templates with captured KB docs — bindings in stub program docs are invisible, and missing/metadata-only template docs are counted in their own caveats when present.
- --scan-tokens: 1 referenced template(s) have no KB doc — their tokens could not be scanned (fetch each with `gs-admin --json jo email template --id '<id>'`).
- --scan-tokens: 1 scanned template doc(s) are metadata-only (no captured body) — subjects were scanned but body/variant tokens could not be seen; a token miss there is silent.
- Participant-source provenance could NOT be resolved: no source in this index carries provenance pointers (the `participantSourceCollectionId` field is absent) — the index was likely built by a plugin older than 0.22.0 (C1 v2). Re-run `jo-report.mjs index` with the current plugin.
- KB-derived, JO-scoped view — corroborate live and cross-area with `gs-admin --json dm deps check --name 'Company' --areas JOURNEY_ORCHESTRATOR`; discrepancies belong in this section.

---

Re-run: `node <jo-report> deps --index <root>/er-index.json --object Company --field ARR --scan-tokens --report <root>/lock-r --csv-dir <root>/lock-c`
