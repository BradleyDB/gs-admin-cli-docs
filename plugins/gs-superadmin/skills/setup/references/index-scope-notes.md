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

## Scope-limited domains — paging cannot fix these

Some list commands cannot see the whole tenant: their handlers hardcode a filter or
flatten a tree, so the count they yield is a CLI-reachable SUBSET, post-filter and
post-flatten. These are facts about the pinned CLI, not about a tenant, so no tenant
records them: the plugin ships them once, as data, in doc-lib's `CLI_PIN_FACTS` (keyed
by the catalog command id, version-stamped, self-retiring at the next pin), and
`manifest.mjs report` derives `domains.<domain>.scope` — `{ key, path, limit }` — for
every domain whose recorded `listCommand` resolves to one of them (F-450; `null` when no
limit is known at the pin, and the report's `pinFacts.applied` says whether the table
applied at all). The subsections below are the canon, one per limited command, each
headed by the command's canonical path — a report row's `scope.path` names its
subsection — and `build/check-doc-drift.mjs` holds these headings and that table to
each other both ways. Index what the CLI returns; the Phase 4 relay names every
scope-limited domain from `scope`, with its limit and the fact that the remainder can be
added later (the recovery flow in the last section); and if the user reports a higher
UI count, record the gap (UI vs CLI-reachable, date, suspected cause) in
`<slug>/overview.md` as a known limitation — do not chase it.

### journey email templates

Flattens only one level of the folder tree — templates in nested subfolders are
dropped (validated live on 1.0.4; subfolder nodes appear as field-less rows carrying
only `folderName` — skip them, they have no id) — and additionally hides some
top-level templates (residual `source=COMMS`/state filter, cause unconfirmed). The
command fetches its whole already-scope-filtered result server-side and caps
client-side at 50 by default, so pass a large `--limit` (Phase 4's paging bullets).
Templates the list cannot see are recoverable by id — the last section.

### journey surveys list

Hardcodes `states:["PUBLISH"]`: closed surveys are invisible. The command has no
paging flags — one fetch is the whole reachable set.

### journey data-designer list

Pins `ds=UNIVERSAL_DATA_SET`, one dataset type, with no paging flags. Its rows are
Data Designer OUTPUT datasets keyed by `objectName`, every one of them also present in
`data-management` (measured on a sandbox KB, 2026-09-11, Session A) — so the list is a
MEMBERSHIP SIGNAL over `data-management` for the status it filters on, not a domain of
its own: decide it as a coverage exclusion over `data-management` through the
evidence-bound verb (Phase 4 step 3), never as a separate domain (one workspace carried
a `journey-data-designer` domain for exactly this and it was removed). Data Designer
*designs* have no list command, and their output objects hide among `dm` objects where
`group=System` is a **superset** (some System objects are DD outputs, some are not; no
1.0.4 describe field distinguishes them): beyond what this list returns, "which dm
objects are Data Designers" is not determinable from CLI data — never equate
`group=System` with "the data designers" (`dataStore=REDSHIFT` and `copy`/`view`
`dbName` prefixes are weak hints only).

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
