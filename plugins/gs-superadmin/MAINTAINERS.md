# gs-superadmin — maintainer notes

Internals for people changing the plugin, not using it. If you're here to *use* the
plugin, you want [README.md](README.md). Contribution rules live in the repo root:
[AGENTS.md](../../AGENTS.md) (rules of record, loaded into AI assistants) and
[CONTRIBUTING.md](../../CONTRIBUTING.md) (the narrative version).

## Reference bundle

The `reference/` directory is **generated** from the installed `gs-admin` CLI catalog and ships with the plugin:

| File | Purpose |
|------|---------|
| `reference/cheatsheet.md` | Compact domain→command→MCP-tool map |
| `reference/catalog.json` | Full structured catalog (every command, flag, endpoint); also drives the mutation-guard hook |
| `reference/ask-rules.json` | Mutating MCP tool names for `permissions.ask` in `.claude/settings.json` |
| `reference/version.json` | Pinned CLI version for the drift guard |

Workspace-lane note: at setup, `.gs-superadmin/catalog.json` and `cheatsheet.md` are
**generated fresh from the user's installed CLI** (`scripts/extract-catalog.mjs` +
`scripts/render-cheatsheet.mjs`); the bundled `reference/` copies of those two are the
fallback when generation fails. `ask-rules.json` and `version.json` are always copied
from the bundle.

## Scripts

These zero-dependency scripts ship alongside it in `scripts/` (plus two shared lib
modules they import, `doc-lib.mjs` and `journal-lib.mjs`):

| Script | Purpose |
|--------|---------|
| `scripts/manifest.mjs` | Deterministic `_manifest.json` operations (init / upsert-batch / mark / next / stub / crawl / report / remove / exclude / block) — atomic writes, schema-checked; the skills never hand-edit manifest JSON. `upsert-batch` records each domain's id field, describe recipe, list command (`--list-command`, matched by the candidate gate), and modified-date field (`--date-field` / `--no-date-field`) in `domains_indexed` and reuses the recordings on re-runs, guarded against contradiction (`--allow-rekey` / `--allow-redate` override deliberate scheme changes); its summary warns on probable under-pagination (incoming list smaller than the domain's non-failed inventory) and on mass-stale flips — it never removes entries itself; `--partial` declares a deliberate-subset registration (gap-fill flows, F-313), which skips the under-pagination warning and leaves the domain's coverage stamp untouched. `exclude` / `block` persist the candidate gate's per-command decisions ("looked and said no" vs "could not look" — F-108/F-218), keyed by canonical catalog path |
| `scripts/domain-candidates.mjs` | The setup Phase 4 candidate gate (F-108), read-only: `diff` derives every list-shaped tenant-wide command from the catalog and maps each to indexed / excluded / blocked / undecided against the manifest's recordings (`--require-decided` exits 1 while any candidate is undecided or a domain lacks a `listCommand` recording); `check` answers the GLOBAL "are these rows already indexed anywhere" overlap question over a captured list payload (fails loudly on unresolvable id fields, partial extractions, and — without `--allow-empty` — payloads with no items array) |
| `scripts/describe-batch.mjs` | Sanctioned describe→doc→mark loop for one domain: selects the batch via `manifest.mjs next`, runs the describes sequentially with `{id}`/`{name}` substituted as literal argv (no shell — pipe-bearing names are safe; resolves the CLI's JS entry, so no Windows `.cmd` traps), writes one structured doc per asset, and marks each as it lands, emitting a stderr progress line every few describes plus a `domainProgress` summary field (documented/total; on `--upgrade` runs `{ full, metadata, failed, total }`, since stubs already count as documented). `--command` defaults to the describe recipe the domain's index recorded (`manifest.mjs upsert-batch --describe-command`); an explicit `--command` wins. For the domain recorded from `jo email templates` it auto-selects its template doc-mode (`--doc-mode template`) and for the one recorded from `jo programs list` its program doc-mode (`--doc-mode program`) — the recording decides, the naming rule's `journey-email-templates` / `journey` only as the no-recording fallback (F-429; the lane table is doc-lib's `RECORDED_LANES`) — writing compact docs instead of raw-JSON docs — rendering shared with `template-doc.mjs`/`program-doc.mjs` via `scripts/doc-lib.mjs`. Records a content fingerprint of each documented payload (volatile modified/updated fields dropped), and `--if-changed` uses it as a re-document gate: an unchanged payload skips the doc write and is just re-marked documented (`skippedUnchanged` in the summary), so a platform event that bumps modified dates en masse doesn't rewrite every doc. Enforces read-only fail-closed against the catalog — mutating or unknown commands are refused, recorded or passed. For `data-designer` it auto-selects its designer doc-mode (`--doc-mode designer`, GP-B5 W9): three describe levels per template — the template, one `--task-id` drilldown per task, one `--field` detail per show-field label (labels derived from the drilldown's tables by doc-lib's `designerTaskFieldLabels`, aggregation suffix stripped per its enumerated vocabulary; both flag spellings verified against the catalog before any spawn) — composed into ONE doc by doc-lib's `renderDesignerDoc` (the template payload with the drilldowns under `_kb`, T-3 v5). Cost is bounded per invocation by `--spawn-budget` (default 30 calls) and the doc is rewritten after every call, so a run cut off mid-template leaves an INCOMPLETE doc that the next invocation resumes from (`designerDocProgress`); the entry is marked documented only when every item is ok, failed (doc kept, doc_path recorded) when any item failed after all were attempted, and `--if-changed` skips only a COMPLETE composite of unchanged content |
| `scripts/capture.mjs` | The shipped capture helper (GP-B5 DS-17): runs one read-only `gs-admin` command (argv array, no shell — the CLI's JS entry resolved the same way as `describe-batch.mjs`) and BYTE-copies its stdout to `--out` as UTF-8 **without a BOM** via temp+rename (no decode — the child's bytes are preserved exactly) — the redirect-encoding rule the capturing skills used to restate as prose, carried by construction; `--normalize <file>` re-encodes an existing capture in place, tolerant of what PS 5.1 redirects write (UTF-16LE/BE with BOM, BOM'd UTF-8) and REFUSING, file untouched, anything whose decode would be lossy (BOM-less non-UTF-8 console-codepage captures, lone-surrogate UTF-16). Spawns the CLI itself, so the mutation guard never sees the embedded command: it gates fail-closed through doc-lib's shared `assertPlainGsAdminCommand` + `assertReadOnlyCommand` (non-gs-admin / shell-operator / unknown / catalog-mutating / ask-override / read-shape / write-endpoint all refused) with a capture-shaped policy built on the shared `READ_VERB_EXACT`: list-shaped by verb, actionKey, or summary (both of `domain-candidates.mjs`'s prongs), describe-shaped, the known per-item reads, and `dm deps check`. A failed child propagates its exit code and writes nothing — an earlier capture at `--out` is left intact and named as earlier. `--wait` (GP-B5 DS-26) bounded-polls the async `dm deps check` scan: re-run every `--wait-interval` s (default 15, floor 1 — each attempt is a real tenant request) up to `--wait-timeout` s (default 120, honored in full), writing only a payload whose `data.progressStatus.overallStatus` is COMPLETED — the envelope requirement is exactly the readers' rule, differential-locked against `parseLiveDepsAreas` in the suite; on timeout NOTHING is written and the non-zero exit names the elapsed time and last status ("not ready after N s", never a confident zero). `--paginate` (GP-B5 DS-30) owns the list-sweep pagination doctrine: `--page-flag <name\|none>` (the command's paging flag, appended per round — never guessed; `none` = one reconciled fetch), a `{page}` placeholder in `--out` (one file per page), `--max-pages` safety stop; each page's envelope is scanned with doc-lib's `scanListEnvelope` (er-count's no-descend traversal + parse-don't-validate totals over the measured envelope variance) and the summary is the honesty report — pages fetched vs parsed, rows counted, every total with its path, and a verdict, with only `reconciled`/`unverified` exiting 0 (`mismatch`/`suspect`/`total-conflict`/`failed-page`/`safety-stop` exit non-zero; an unparseable page is a failed sweep page kept as evidence, never 0 entries). `build/check-doc-drift.mjs` check 14 enforces that skill captures route through this helper |
| `scripts/relationships-build.mjs` | Sanctioned Phase 6 map generator: derives `relationships/field-to-rule.md`, `field-to-scorecard.md`, `process-maps.md`, and `program-to-template.md` (program → email template via GSID co-occurrence; there is deliberately no journey→rule map — rules never feed program participants) from the KB's full-describe docs (`_flatMappings` semantics and their verification basis documented in the script header) — coverage headers per file, unknown actionTypes reported rather than dropped, dangling measure references flagged |
| `scripts/template-doc.mjs` | Converts captured `jo email template --id` describe payloads into compact KB docs (metadata + plain-text body; the ~50 KB HTML rendering is dropped) without passing payloads through model context — the standalone path for one-off payloads (e.g. UI-export id recovery); bulk runs use `describe-batch.mjs`'s template doc-mode, which imports the same renderer from `scripts/doc-lib.mjs` |
| `scripts/program-doc.mjs` | Converts captured `jo p describe --id` payloads (~287 KB/program, mostly flow-canvas geometry) into compact KB docs — the semantic flow skeleton (node types/names, branch conditions, participant source with PowerList config verbatim, template references, timers) with geometry dropped via a conservative 1.0.4-scoped drop-list; the standalone path mirroring `template-doc.mjs`; bulk runs use `describe-batch.mjs`'s program doc-mode (same renderer from `scripts/doc-lib.mjs`) |
| `scripts/jo-report.mjs` (+ `scripts/jo-report-search.mjs` / `scripts/jo-report-program.mjs` / `scripts/jo-report-audit-active.mjs` / `scripts/jo-report-deps.mjs`) | Engine behind `/gs-superadmin:email-report`: parses KB journey + email-template docs (both doc generations, both stepJson shapes; failures collected per doc, never fatal), builds the local index with optional live-status overlay (drift / live-only / KB-only detection) — including normalized token bindings + bound surveys per email step (both generations) and template token metadata — and dispatches to the four report modes by dynamic import; a shared token resolver renders `${...}` ids as display names on every surface, and shared markdown/CSV plumbing guarantees every report carries the "Caveats & data gaps" section and never overwrites an earlier one |
| `scripts/er-count.mjs` | Email-report page-entry counter (GP-B5 DS-29): prints the largest array length in a captured list-page payload — the step-2 sweep's stop signal — without the payload entering model context. Arrays are measured, never descended into (an entry's own nested arrays must not outvote the entry array). BOM-tolerant read; a missing/unreadable/malformed page refuses loudly with exit 1 naming the script, so it can never read as "0 entries" and end the sweep early. Formerly an inline transcription the email-report skill wrote to `.gs-superadmin/tmp/` on every run |
| `scripts/er-gaps.mjs` | Email-report gap work-list builder (GP-B5 DS-29): reads the step-3 index (`.gs-superadmin/tmp/er-index.json`) plus the workspace manifest and writes the step-4c work lists (`er-gap-stale/liveonly/templates/tokenless[-orphans].json`) in the exact shapes `manifest.mjs mark --keys-file` / `upsert-batch --file` consume — keyed by each domain's RECORDED idField, TTL-stale keys oldest-first so `--limit` cuts the budget in file order on disk, never through model context; the ER-15 tokenless list is joined against the manifest (orphan docs counted separately, never batched — mark's all-or-nothing contract must not refuse the whole backfill). Prints a one-line summary JSON (idFields + per-category counts + total); unreadable index/manifest or a bad TTL refuses loudly instead of emitting a confidently empty work list. Formerly an inline transcription in the same skill |
| `scripts/tenant-deps.mjs` | Engine behind `/gs-superadmin:deps-report`: scans the KB docs of all dependent domains directly (no index artifact) for object/field/connection usage — rules (task source objects + connection types, criteria filter conditions, `_flatMappings` write targets, action-mapping connection ids), journeys (via the jo-report parsers), reports (sourceDetails, show/group/order fields incl. calculated nesting, where/having filters), connector jobs, data designers, journey datasets — resolves connection terms through the connector docs' registry (name/id/type, exact vs `type-level` matches), links scorecard measures set by matching rules, and reconciles captured all-areas `dm deps check` payloads (`--live-deps`) against the KB view. Terms arrive as repeatable `--object`/`--field`/`--connection` flags or as `--terms-file <terms.json>` (GP-B5 DS-28) — the skill's shell-neutral on-disk work list (`{ "objects"?, "fields"?, "connections"? }`, BOM-tolerant, merged with inline flags; unknown keys and non-string entries refuse the whole file loudly). The field-aliasing convention is read from the workspace CONVENTIONS.md by the script itself (GP-B5 DS-27; `--alias-prefix` overrides, `''` disables). Data-designer docs written by the designer doc-mode (GP-B5 W9) yield per-field rows from their `_kb` composite — system field name, label, alias, the field's own source object and connection from the `--field` detail; criteria / join-condition rows resolved through the same details — with per-row honesty when a detail is missing (`fieldNamesUnavailable` + a reason from `DESIGNER_BLIND_REASONS`: summary shape, drilldown missing/failed, duplicate label, unparsed join field list, label-only carrier), and the report's caveat breaks the blind count down by reason |
| `scripts/journal.mjs` | Change attribution + completion journaling for the change-request skill (`change-start` / `change-end` / `journal-append`, kind literal `change-plan execution`) — validates ticket/plan/slug, stamps timestamps and operator itself, and writes `JOURNAL.md` through the shared emitters in `scripts/journal-lib.mjs`: the file header (a guard-fixtures check locks both writers' runtime headers equal) and the T-4 entry frame (contract-conformance's T-4 section pins every entry line through both writers) |
| `scripts/extract-catalog.mjs` | Generates the workspace catalog from the installed CLI's `dist/artifacts/*.json` — setup's primary catalog source on every run; the bundled `reference/catalog.json` is the fallback when generation fails (verbatim copy of the docs-repo extractor) |
| `scripts/plugin-link.mjs` | The workspace plugin-link writer (GP-B5 DS-43): maintains ONE directory link, `.gs-superadmin/plugin` → the loaded plugin's root (an NTFS junction on Windows, a directory symlink elsewhere — the one platform branch), through which every skill fence addresses bundled scripts as `node .gs-superadmin/plugin/scripts/<x>.mjs …`. Run by the `SessionStart` hook (`--hook`, exit 0 always, reports through `hookSpecificOutput.additionalContext`) at every plugin session start, and by setup's first-run fence (CLI mode: one stdout line naming the target, non-zero on failure). The target is derived from the script's OWN real path — never from `CLAUDE_PLUGIN_ROOT` in the environment or anything in the workspace; a stale or dangling link is repointed with `unlinkSync` (the only removal call), a real directory at the link path is refused, never deleted; inert without a `.gs-superadmin/` directory in cwd. Belt: reports (never fails) when the link is not git-ignored inside a git work tree; names a OneDrive-rooted workspace on Windows |
| `scripts/scaffold.mjs` | The workspace scaffold writer (bus F-396): every file under the plugin's `templates/` maps to `.gs-superadmin/<same path>` (the §2 pack only once adopted), and the pristine bytes of each template as the user last saw or decided it live under `.gs-superadmin/scaffold/<same path>` — the record that tells an edited copy from an unedited one without a manifest field or a version marker. `apply` copies what the workspace lacks (`fresh`), refreshes an unedited copy whose template moved (`refreshed`), records an unmodified legacy copy (`adopted`), and for an edited copy whose template moved writes the new template beside it as `<file>.new` and lists it under `offers` — never overwriting an edited file; a file the user removed stays removed. `accept` / `keep` / `defer <rel>` record the user's answer to an offer (all three advance the pristine copy, so an ask never repeats for a template version; `defer` leaves the `.new`). `check --json` is read-only and is what the SessionStart hook spawns for its one-sentence courtesy (`plugin-link.mjs` is builtins-only, so it spawns rather than imports). Hashes are BOM- and CRLF-insensitive (an editor's line-ending flip is not an edit); bytes written are the template's verbatim |
| `scripts/render-cheatsheet.mjs` | Renders `.gs-superadmin/cheatsheet.md` from the workspace catalog at setup — the same emitter `build/build-plugin-gs-superadmin.mjs` imports to write the bundled `reference/cheatsheet.md`, so the two outputs can never drift (verbatim copy of `build/render-cheatsheet.mjs`; only the banner/footer lines differ per lane) |

## Regenerating after a CLI upgrade

```bash
npm i -g @gainsight/gs-admin-cli@latest
npm run build:plugin:gs-superadmin   # in the gs-admin-cli-docs repo
```

Expect the entire reference bundle to change — that's a deliberate upgrade of what the
plugin documents, not a rebuild. (To rebuild *without* upgrading, install the pinned
version from `data/catalog.json` `meta.cliVersion` instead of `@latest`.) Then update the
counts/version cited in hand-written docs (`node build/check-stale-facts.mjs` lists them —
but it scans tracked `.md` ONLY, so also
`grep -rn "v[0-9]\+\.[0-9]\+\.[0-9]\+" plugins/gs-superadmin/scripts plugins/gs-superadmin/hooks`
— that `\+` is GNU BRE, so run it through the Bash tool (PowerShell ships no grep, and
BSD grep on macOS reads `\+` differently; the portable spelling is
`grep -rnE "v[0-9]+\.[0-9]+\.[0-9]+" …` with the same paths) —
and move any `v`-prefixed current-pin claim there by hand; `describe-batch.mjs` carries the
same write-surface figures as the skills and was missed once this way)
and bump `version` in `plugins/gs-superadmin/.claude-plugin/plugin.json` — marketplace
users update via `claude plugin update`.

No workspace needs re-running setup after a plugin upgrade for its scripts: every fence
runs through `.gs-superadmin/plugin`, the directory link `scripts/plugin-link.mjs`
repoints to the loaded plugin at each session start (the plugin cache keeps one
directory per version, so a link written once would otherwise keep running the old
one — GP-B5 DS-43). The reference bundle copies (`§3` of setup's scaffold mechanics)
still refresh only when setup re-runs.

## Designer drilldown grammar (re-derive at every CLI adoption)

The designer composite doc (`describe-batch.mjs` designer doc-mode; `doc-lib.mjs`
`renderDesignerDoc` / `designerDocProgress` / `designerTaskFieldLabels`;
`tenant-deps.mjs` `extractDesignerUsages`) rests on the shape of three read-only
calls, authored from the CLI's ROUTED handler at the pinned version and confirmed on
a live tenant (GP-B5 W9, keys only). Follow the manifest's handler pointer for
`data-designer templates describe` → the `handlers/data-designer.js` re-export →
`handlers/data-preparation/templates/describe/index.js` and `common/task-detail.js`
(`emptyTaskFields` / `projectTaskDetail` / `taskFieldLabel` / `buildJoinRows` /
`buildFieldDetail`), and re-check each item when the pin moves:

1. **Template** `--template-id <id>`: `{result, data}`; `data` = the header scalars +
   `_taskCount` + `_tasks[]` (summary rows: `taskId taskName taskType _object _connType
   _parents _fieldCount _filterCount _groupByCount`) + the 14 `_task*` tables EMPTY
   (`DESIGNER_TASK_TABLES` in doc-lib is that list as data; a closure fixture pins it).
   The script refuses the mode when `_taskCount` disagrees with the readable task ids.
2. **Task** `+ --task-id <t>`: `_tasks: []`; the tables populated per kind — extract
   (DetailRows incl. `Source` = `"<objectName> (<conn>)"`, ShowFields), join (DetailRows
   incl. `Fields (<srcTaskId>)` = `"<label>: f1, f2 (N)"`, JoinConditions,
   CriteriaConditions), freeForm (DetailRows incl. `Source Task`, ShowFields); pivot /
   union from source only until a tenant with one is seen. `_taskShowFields[]._field` is
   the DISPLAY label (`label || fieldAlias || fieldName`) plus one trailing `(KEY)`
   group for an aggregation or formula expression — `DESIGNER_FIELD_SUFFIX_KEYS` in
   doc-lib is that vocabulary (`aggregations.js` KNOWN_AGGS + `FormulaShowFieldUtil.js`
   DEFAULT_FUNCTIONS + `formula-structured-summary.js` STRUCTURED_KEYS + the
   `formula-renderer.js` `anonymous` / `CASE` wrappers); it only orders the two label
   spellings the script tries, so a missed key costs one extra spawn, never a failed
   template.
3. **Field** `+ --field <label>`: `_taskFieldDetail` `{_key, _value}` rows — `Field Name`
   (the system name) · `Display Name` · `Field Alias (output header)` · `Source Object`
   (`"Label (name)"` or bare) · `Connection` (type or id) · type / flags rows
   (`DESIGNER_FIELD_DETAIL_KEYS` in tenant-deps names the five the reader consumes).
   Resolves by label on extract, freeForm and join tasks; the SUFFIX-STRIPPED spelling
   resolves and the full `"Label (MAX)"` spelling does not; the CLI's refusal is the
   sentence `No field found on task "<t>" matching: "<label>"` — the script treats a
   refusal in those words under every spelling as a PERMANENT gap (recorded on the
   item, never retried until the template changes, never blocking), anything else as
   retryable. Duplicate labels on one task reach only the first field's detail.

The script gates the flag spellings against the catalog and the task count against the
payload before any spawn, so a changed grammar refuses loudly at the first designer
run of a new pin; the measured procedure and its tester arm live on the dev branch's
validation bank, not in the shipped plugin.
