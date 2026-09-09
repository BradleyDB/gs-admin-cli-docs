<!-- gs-superadmin relationships · process-maps · generated 2026-01-15 · relationships-build.mjs -->

# Process Maps (rule → CTA)

> **Coverage.** Built from full docs of: rules-engine (3/4 full). No domains excluded for this map.
> rules-engine: 1 asset(s) failed describe and are not represented.

## Rule → CTA (confirmed via NativeCta actions)

Rules whose actions create a Call To Action, from each rule's `NativeCta` mappings (the CTA name source is the `Name` mapping's srcField).

- **CS|Risk|Create Renewal CTA _(inactive)_** → CTA: `Renewal risk review`

## Journey ↔ Rules Engine — no participant edge exists

Rules Engine rules do **not** load participants into Journey Orchestrator programs — there is no journey → rule map to build. Programs draw participants from **Power Lists**, backed by CSV uploads, ad-hoc queries, or Data Designer / DD-template datasets — never a rule (Gainsight product architecture, tenant-agnostic; live-confirmed by a full GSID cross-reference between rule and program docs finding zero shared-id edges). The journey-side edges that ARE derivable from deep docs: **program → email template** (generated as `program-to-template.md` alongside this file) and **program → Power List → source** (CSV / query / Data Designer), parseable from the PowerList config block in each program's step JSON but not yet automated — trace it by hand in Phase 6 prose synthesis and label each edge `confirmed` (read from a program doc's PowerList config) or `inferred`.
