<!-- gs-superadmin relationships · field-to-scorecard · generated 2026-01-15 · relationships-build.mjs -->

# Field ↔ Scorecard

> **Coverage.** Built from full docs of: rules-engine (3/4 full), scorecard (1/1 full). No domains excluded for this map.
> rules-engine: 1 asset(s) failed describe and are not represented.

## Measure ← scoring rule(s) (confirmed via SET_SCOREV2)

Rule→measure linkage from each rule's `SET_SCOREV2` action mappings (measure & scorecard GSIDs resolved against the scorecard docs' `levelType` trees).

### Acme Customer Health
- **Feature Adoption** (group: Usage) ← CS|Ops|Sync Legacy Flags
- **Login Frequency** (group: Usage) ← CS|Health|Compute Score Trend

## ⚠ Dangling measure references (tenant-hygiene signal)

1 SET_SCOREV2 reference(s) across 1 rule(s) target 1 measure GSID(s) that resolve to no documented scorecard measure — the measure was deleted, or its scorecard is not in the KB. Re-verify with `sc measures`.

- `m-gsid-acme-9999` ← CS|Ops|Sync Legacy Flags (scorecard context: Acme Customer Health)
