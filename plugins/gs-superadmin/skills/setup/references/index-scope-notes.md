# Setup Phase 4 — indexing notes: describe identifiers, scope limits, recovery

Read the first section when composing a domain's `--describe-command` recording;
the rest before indexing the journey-side domains (`jo email templates`,
`jo surveys list`, `jo data-designer list`) or reasoning about Data Designer
coverage. Pagination proves paging completeness only — the scope limits below are
about what the CLI can SEE, and paging cannot fix them.
Facts here were verified against CLI v1.0.9 (this line is the stale-facts
checker's per-upgrade tripwire for this file; the bare versions below date the
original observations).

## Describe-identifier substitution rules and known cases

In `describe-batch.mjs` command templates the describe identifier is always `{id}` —
the manifest is keyed by it. `{name}` substitutes the display label and is only for
commands that address by label (e.g. `sc measures --name`). The identifier a
domain's *describe* command accepts is NOT always the list payload's `id` — known
cases on CLI 1.0.4: `re rules describe` takes the payload's `ruleId`, `re chains
describe` takes `workflowId`, and dm objects describe by object *name*, which is
therefore their manifest key; dm objects therefore take `--name {id}`, not
`--name {name}`. Scorecards are the ONE domain whose recorded template genuinely
uses `{name}`: `sc measures` addresses by display label while the manifest stays
keyed by the id, so scorecards record `gs-admin --json sc measures --name {name}`
(the Phase 5 domain notes carry the describe-by-name auth-race rationale). Where a
domain's addressing flag differs from `--id`, the recorded template carries the
real flag (`gs-admin --json dm objects describe --name {id}`, `jo dd get --name`).
No `gs-admin` command accepts a bare positional argument.

## Scope-limited domains (1.0.4) — paging cannot fix these

Some list commands cannot see the whole tenant: `jo email templates` flattens only
one level of the folder tree (templates in nested subfolders are dropped — validated
live; subfolder nodes appear as field-less rows carrying only `folderName` — skip
them, they have no id) and additionally hides some top-level templates (residual
`source=COMMS`/state filter, cause unconfirmed); `jo surveys list` hardcodes
`states:["PUBLISH"]` (closed surveys invisible); `jo data-designer list` pins
`ds=UNIVERSAL_DATA_SET`; Data Designer *designs* have no list command — and their
output objects hide among `dm` objects where `group=System` is a **superset** (some
System objects are DD outputs, some are not; no 1.0.4 describe field distinguishes
them), so "which dm objects are Data Designers" is not determinable from CLI data —
never equate `group=System` with "the data designers" (`dataStore=REDSHIFT` and
`copy`/`view` `dbName` prefixes are weak hints only). Totals are
post-filter/post-flatten. Index what the CLI returns, annotate these domains as
"CLI-reachable subset" in the relay, and if the user reports a higher UI count,
record the gap (UI vs CLI-reachable, date, suspected cause) in `<slug>/overview.md`
as a known limitation — do not chase it.

## Recovering list-invisible email templates

Describe-by-id works where the list cannot see (`jo email template --id` — validated
live). If the user supplies exported ids (CSV or pasted), first read the domain's
recorded idField from `report`'s `domains_indexed` (journey-email-templates is
typically `templateId`; a never-listed domain has no recording — use `id`), convert
the export to a JSON items array keyed by THAT field
(`[{"<idField>":"…","name":"…"}]`), and `upsert-batch` it with
`--id-field <idField> --partial` (a targeted registration, not fresh list coverage —
`--partial` skips the under-pagination warning and leaves the `domains_indexed` stamp
untouched; on a never-listed domain it registers the entries and warns instead of
stamping). Never hardcode `id`: registering under a field other than the recorded one
trips the re-index guard, and a key-scheme change is a full-list operation, not a
recovery step. The standard Phase 5 describe loop then documents them like any other
entry.
