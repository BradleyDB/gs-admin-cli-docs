<!-- gs-superadmin relationships · field-to-rule · generated 2026-01-15 · relationships-build.mjs -->

# Field ↔ Rule

> **Coverage.** Built from full docs of: rules-engine (3/4 full), rules-engine-chains (1/1 full). No domains excluded for this map.
> rules-engine: 1 asset(s) failed describe and are not represented.

## Field population — target field ← rule(s) (confirmed)

Data-load/update actions (`DATA_SYNC`, `BULK_API`) grouped by target object, then field. Each field lists the rule(s) whose action writes it; inactive rules are flagged.

### → `Company` (1 field(s) written)
- **Health Score Trend** ← CS|Health|Compute Score Trend

### → `Survey` (1 field(s) written)
- **NPS Bucket** ← CS|Risk|Create Renewal CTA _(inactive)_

### → `acme_health_summary` (1 field(s) written)
- **trend_bucket** ← CS|Health|Compute Score Trend

## Rule chains → rules (confirmed)

Execution order from each chain's task list. Source: `rules-engine-chains/` docs.

### Acme Nightly Scoring
  1. CS|Health|Compute Score Trend
  2. CS|Ops|Sync Legacy Flags

## actionType accounting (verified live on CLI 1.0.4, re-verified statically at 1.0.6, 1.0.7, 1.0.8 and 1.0.9)

Every `_flatMappings` entry in the documented rules, by actionType — nothing is silently dropped. Dispositions: mapped above / in field-to-scorecard.md / in process-maps.md, or counted here.

- `BULK_API` × 1 — mapped — field population (above)
- `CONDITIONAL` × 1 — recognized — conditional-logic metadata, no field write to map
- `DATA_SYNC` × 2 — mapped — field population (above)
- `FLAG_SYNC_V9` × 2 — **UNKNOWN to this generator — not classified**
- `REST_API` × 3 — NativeCta entries mapped — process-maps.md; other verified areas (NativeSp, callExternalAPI, loadtoactivity) recognized, not mapped; unlisted areas are reported below
- `SET_SCOREV2` × 6 — mapped — field-to-scorecard.md

### ⚠ Unknown actionTypes — mappings NOT classified

These actionTypes are not part of the semantics this generator hardcodes (verified live on CLI 1.0.4, re-verified statically at 1.0.6, 1.0.7, 1.0.8 and 1.0.9). Their entries were counted but not mapped — inspect the rule docs directly, and update the generator (plugin repo) if a CLI upgrade added them.

- `FLAG_SYNC_V9` — carried by: CS|Ops|Sync Legacy Flags

### ⚠ Unrecognized REST_API areas — not classified

REST_API delivery areas outside the list this generator hardcodes (NativeCta, NativeSp, callExternalAPI, loadtoactivity; verified live on CLI 1.0.4, re-verified statically at 1.0.6, 1.0.7, 1.0.8 and 1.0.9). Their entries were counted but not mapped — inspect the rule docs directly, and update the generator if a CLI upgrade added them.

- `NativeEmailBlast` — carried by: CS|Risk|Create Renewal CTA _(inactive)_
