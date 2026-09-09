# Setup Phase 5 — per-domain documentation notes

Read the matching section here BEFORE documenting the `scorecard`,
`journey-email-templates`, `journey`, or `data-designer` domain (Phase 5 and `--deep`
runs alike).
Each section carries that domain's payload semantics, doc mode, batch sizing, and
the first-run notice to relay to the user. Domains not named here take the generic
describe→doc→mark path in the skill.

Every `.gs-superadmin/plugin/…` path below is the workspace's link to the installed
plugin (created in the skill's Phase 2), relative to the working dir.

## Scorecards (`scorecard`)

- **Scorecard exception (CLI 1.0.4 auth race)**: describe scorecards by *name*, not id
  — `gs-admin --json sc measures --name '<name>'` (single-quoted; the name is in the
  manifest entry). `sc measures --id` makes its first authenticated call a concurrent
  fan-out, and a CLI token-refresh race fails it with a false "No stored token found"
  once the token passes half-life (see "Known CLI issues" in the operating model). If
  two scorecards share a name, try `--id` once (a freshly refreshed token usually
  survives); if it fails that way, mark the entry failed with error
  "known CLI auth race (sc measures --id)".
- **Scorecard output semantics (verified live on CLI 1.0.4; statically re-checked at
  v1.0.9 — the scorecard handler is byte-identical from 1.0.8 to 1.0.9, and the 1.0.8 handler change only adds a `_total` count on the four
  list responses and touches nothing in the measures-tree shape, so the note stands
  as written; re-verify after the next CLI upgrade)**:
  the CLI flattens exactly one level of the measures tree, so the shape of
  `data` depends on the scorecard. Inspect `levelType` on the returned nodes and
  classify by it — never by array position:
  - Top-level `GROUP` nodes carrying `children` (scorecards with an overall rollup):
    the measures are the `MEASURE` nodes found by recursing `children`; the measure
    groups are the `GROUP` nodes; `_groupName` on a top-level node is the *overall
    rollup's* display name, and each measure's group is its parent node's name.
  - Top-level all `MEASURE` nodes (no overall rollup — or a future CLI that flattens
    correctly): these are the measures; the flatten drops the group nodes, so recover
    measure groups as the distinct `_groupName` values (plus any explicit `GROUP`
    nodes, e.g. empty groups).
  `sc scheme list` carries NO modification date: its `modifiedAt` is generated per
  call — epoch-millisecond numbers stamped row by row as the response serialises, so
  every row lands within a couple of seconds of the others and of now, whether as one
  shared value or a millisecond apart (measured live at CLI 1.0.9; F-418, whose first fix
  looked for one identical value and missed the live case). That cluster is the
  signature the manifest script's generated-date guard refuses on a full list, so the
  `scorecard-schemes` domain is recorded `--no-date-field` (an already-recorded workspace
  re-dates once with `--no-date-field --allow-redate`).
  The other three scorecard lists (`sc list`, measures, measure groups) carry real,
  stable modification dates.
  In the `sc list` config payload, `overallRollup`/`groupRollup` are enable
  **booleans**, not names. The KB doc states counts tallied this way (N measure groups
  / M measures) and combines the scorecard's config row from the Phase 4 list file
  (entityType, scheme, rollup flags, modified date) with the measure tree — the
  describe output alone carries no scorecard config. If a newer CLI returns a shape
  this note doesn't describe, trust `levelType` and the observed payload over the
  note, document accordingly, and flag the note for update.

## Email templates (`journey-email-templates`) — compact docs, never raw JSON

Describe payloads carry ~50 KB of entity-escaped HTML per template
(`htmlContent`/`editorContent`) that must never be embedded in a KB doc or read into
context. The batch script handles this itself: with
the domain recorded from `jo email templates` (the naming rule's
`journey-email-templates`) it auto-selects its template doc-mode (same as
passing `--doc-mode template`) and writes one compact doc per template (metadata +
the plain-text body, ~30× smaller; HTML dropped) instead of a raw-JSON doc — the
selection, sequential-describe, mark, and retry loop is unchanged, so run this
domain through `describe-batch.mjs` like any other. Template describes are fast and
the docs are small: size `--limit` at **~50** per invocation for this domain
(observed safe on CLI 1.0.4), not the generic ~10–15 raw-JSON guidance. For
one-off payloads captured outside the batch (e.g. recovering list-invisible
templates from UI-exported ids), the standalone path remains: save the describe
output to a file, run
`node ".gs-superadmin/plugin/scripts/template-doc.mjs" --out-dir <slug>/<templates-domain> <file …>`
(same rendering, shared with the batch script), then `mark` each asset documented
as usual — `<templates-domain>` is the folder the workspace RECORDED for `jo email
templates` (`report`'s `byDomain`; `journey-email-templates` on a workspace this
setup built), never a literal: the readers resolve it from the recording, so a doc
written under any other name is one no reader consults (F-429). **The first time a run documents email templates, tell the user**:
"Template docs store metadata + the plain-text body; the HTML rendering
(~50 KB/template) is dropped and re-fetchable with `jo email template --id`."
Applies to `--deep` runs too.

## Journey programs (`journey`) — compact docs, never raw JSON

`jo p describe --id` payloads run ~287 KB per program, dominated by flow-canvas
geometry in the step JSON (node coordinates, transforms, UI state) with no admin
meaning — a large tenant would write hundreds of MB of mostly non-semantic layout.
The batch script auto-selects its program doc-mode for the domain recorded from
`jo programs list` (the naming rule's `journey`) (same as
passing `--doc-mode program`) and writes one compact doc per program: the semantic
skeleton — node types/names, branch conditions, participant source with the
PowerList config verbatim, email-template references, timers/waits — with the
geometry dropped (conservative 1.0.4-scoped drop-list; unknown keys are kept).
The full payload stays re-fetchable by id (stated in the doc header, like
template docs), and template GSIDs + PowerList config survive compaction, so
Phase 6's program→template map derives from compacted docs identically. For
one-off payloads captured outside the batch, the standalone path is
`node ".gs-superadmin/plugin/scripts/program-doc.mjs" --out-dir <slug>/<journey-domain> <file …>`
(same rendering, shared with the batch script), then `mark` each asset as usual —
`<journey-domain>` is the folder the workspace RECORDED for `jo programs list`
(`report`'s `byDomain`; `journey` on a workspace this setup built), as above.
**The first time a run documents journey programs, tell the user**: "Program docs
store the semantic flow skeleton; canvas geometry (most of the ~287 KB payload)
is dropped and the full payload is re-fetchable with `jo p describe --id`."
Existing raw program docs from earlier plugin versions stay as they are — the
operator MAY regenerate them compact by re-running the domain through
`describe-batch.mjs` with `--statuses documented` (a workspace-side choice; the
plugin never deletes or rewrites existing docs unasked). Omit `--if-changed` on
such a conversion run: the content fingerprint sees unchanged tenant content and
would skip the re-render, leaving the old-format doc in place. Applies to
`--deep` runs too.

Chunk sizing for this domain: the generic **~10–15** per invocation applies —
the written doc is compact, but each describe still FETCHES ~287 KB, so
template-scale chunks (~50) blow the shell timeout.

## Data designers (`data-designer`) — three describe levels per template, resumable

`dd t describe --template-id` alone returns each task as a SUMMARY row (source
object, connection type, field/filter COUNTS) — no field names. The names live one
level down (`--task-id`, one call per task: the task's show-field / criteria / join
tables, spelled as display LABELS) and the system names one level further
(`--field`, one call per show field: Field Name, Display Name, Source Object,
Connection). The batch script's **designer doc-mode** (auto-selected whenever the
recorded or explicit describe command resolves to `dd t describe`, whatever the
domain is named; same as passing `--doc-mode designer`) runs all three levels per
template and writes ONE composite doc: the template payload with every drilldown
kept verbatim under its `_kb` key, so `/gs-superadmin:deps-report` can match
designer fields by system name and attribute each field to its own source object.
Observed on CLI 1.0.8: ~1.5–3 s per call (two tenants), and a template costs 1 + tasks +
show-fields calls (a 3-task, 8-field template ≈ 12 calls ≈ 30 s).

**Budget and resume — the setup loop one level down.** The cost is bounded per
INVOCATION, not per template: `--spawn-budget N` (default 30 calls ≈ 75 s) counts
every call the run makes, and the composite doc is rewritten after each one. When
the budget runs out mid-template the doc on disk says INCOMPLETE, the entry keeps
its status, and the summary reports `budgetExhausted: true` with `moreRemaining:
true` — re-invoke exactly as for any other domain and the next run resumes from
the doc (skips what is captured, retries what failed). Size `--limit` at **1–2**
templates per invocation and keep re-invoking until `moreRemaining: false`; the
stderr progress line shows `(spawns used/budget)`. A budget-cut run reports
`documented: 0` with an EMPTY `failures` list — that is progress, not the stop
rule's "same failures twice" signal; the stop rule keys on named failures only. A
template with a RETRYABLE failure (timeout, transport, unexpected output) after
every item was attempted is marked `failed` with the count (its doc stays on disk
and still yields its summary rows) and the stop rule applies as usual; a field the
CLI refuses with its own not-found sentence under every spelling of its label is a
PERMANENT gap — recorded on the item, never retried until the template changes,
never blocking (the template is marked documented and the deps report says which
rows it left blind). `--if-changed` is safe on this domain: it skips a template
only when its doc is already a COMPLETE composite of unchanged content, so
summary-only docs written by earlier plugin versions upgrade on the next re-run —
to upgrade an existing KB deliberately, run the domain once with `--statuses
documented`. The mode verifies the drilldown flags and the template's task count
against the catalog and payload before spawning anything and refuses if either no
longer matches (a CLI adoption re-derives the drilldown grammar — the plugin's
`MAINTAINERS.md`, "Designer drilldown grammar"). **The first time a run documents
data designers, tell the user**: "Designer docs store the template describe plus
one `--task-id` drilldown per task and one `--field` detail per show field (1 +
tasks + fields calls per template, resumable across runs); a duplicate field label
on one task reaches only the first field's detail, and the deps report says so per
row."
