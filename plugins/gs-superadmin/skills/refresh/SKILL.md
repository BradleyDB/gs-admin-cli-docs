---
description: Detect recently changed Gainsight assets and mark them stale for re-documentation.
disable-model-invocation: true
argument-hint: "[--days N] [--document] [--budget N] [--slug name]"
---

# /gs-superadmin:refresh

Check for changes since the last refresh and update the KB for any modified assets.
Cheap and roughly constant cost regardless of org size — only fetches recently modified assets.

## Arguments

- `--days N` — look back N days for changes, for every domain (default: per domain, the days since that domain's own list stamp — `report`'s `lookback`; `lookbackDefault` 7 where a stamp is missing or unparseable; step 2)
- `--document` — also re-document all newly stale assets (respects `--budget`)
- `--budget N` — max assets to document when `--document` is passed (default: 25)
- `--slug <name>` — override the derived slug (required if setup was run with `--slug`)

---

## Steps

### 1 — Identify instance

Run `gs-admin whoami`.

**Token pre-flight (F-221):** a refresh crawl is tens of minutes of back-to-back
calls — check `whoami`'s remaining token life first and have the user re-run
`gs-admin login` if the USABLE life (far less than the number printed, per the known
half-life defect) won't cover the batch (rule canon: setup Phase 1).

Derive the slug:
- If `--slug` is provided, use that value directly.
- Otherwise, scan the working dir for any `*/_manifest.json` whose `baseUrl` matches
  the `whoami` output — that folder's name is the slug.
- Fallback: derive from hostname (same logic as `/gs-superadmin:setup` Phase 2).

Check the workspace state (all manifest access goes through the script — never hand-edit):
```
node .gs-superadmin/plugin/scripts/manifest.mjs report --manifest <slug>/_manifest.json
```
If the manifest does not exist, or `total` is 0 with `last_refresh` null (setup was
interrupted before Phase 4 completed), tell the user to run `/gs-superadmin:setup` first and stop.

**Environment backfill** (once per legacy manifest): if `report` above shows
`environment: null` (a manifest that predates the field, or one initialised without it),
ask the user once ("Is <slug> production or sandbox?") and backfill it, so the mutation
guard flags production from fact instead of name-guessing:
```
node .gs-superadmin/plugin/scripts/manifest.mjs init --manifest <slug>/_manifest.json --environment <production|sandbox>
```
(`init` on an existing manifest only backfills a missing `environment`; it never
overwrites anything. If the field is already present, skip — never re-ask.)

### 2 — Determine the lookback window, per domain

If `--days` is provided, use that value for every domain.

Otherwise read `report`'s `lookback` block (step 1's output): one entry per indexed
domain, `{ at, days }`, where `days` is the days since THAT domain's own list stamp
(`domains_indexed.<domain>.at`, written by the upsert itself on every full list;
minimum 1). Use each domain's own `days` in step 3; a domain whose `days` is `null`
(a legacy stamp with no parseable `at`) uses `lookbackDefault` (7).

The window is per domain on purpose: a crawl interrupted after two of seventeen
domains leaves the other fifteen with their older stamps, so the next run asks each of
them for the right span. There is no workspace-wide "last refresh" to update and no
step that stamps one — the stamp a domain carries is the one its own upsert wrote, so it
cannot claim coverage the crawl did not achieve (`last_refresh` in the manifest is a
legacy field nothing derives from).

### 3 — Fetch recently modified assets

Use two strategies based on whether the domain supports a modified-date filter:

**Domains with a recency filter** — `re rules list` and `re r list-and-describe` take
`--filter-modified-date` (the `last_<N>_days` literal, `<N>` = that domain's `days` from step 2). Nothing else
does: `cn list` belongs in the exhaustive lane below — its `--from`/`--to` never filtered
anything at CLI 1.0.8 (the handler applied no date bound, so the flags over-fetched the
full list, which is what the staleness comparison needs anyway) and they do not exist
from 1.0.9 (the command errors out on them). (`cn chains` and `cn jobs` do take
`--from`/`--to`, and those handlers apply them — but they filter by **created** date and
**last run** date respectively, not modification, so they cannot drive the staleness
comparison; fetch those two exhaustively like everything else.) Example:
```
node .gs-superadmin/plugin/scripts/capture.mjs --out .gs-superadmin/tmp/re-rules.json -- gs-admin --json re rules list --filter-modified-date last_<N>_days
```

**All other domains** — **fetch each domain exhaustively**, captured to files through
the shipped capture helper (clean UTF-8, no BOM, any shell; never a bare shell
redirect — rule canon: setup Phase 4; prefer a scratch `.mjs` file over a `node -e`
one-liner when processing the files):
```
node .gs-superadmin/plugin/scripts/capture.mjs --paginate --page-flag page --out .gs-superadmin/tmp/<ns>-<list-cmd>-{page}.json -- gs-admin --json <ns> <list-cmd> --limit 200
```
Add `--items-path <dotted>` for a command whose envelope carries a second array beside
the rows (`rp list`: `--items-path data.data` — its root `alerts` block fills on a
tenant with something to report); a sweep that stops with `unrecognized-shape` names
the candidates — re-run with the rows path stated (rule canon: setup Phase 4).
The paginate mode owns the page loop, the short-page/total reconciliation, and the
suspect-round-count honesty — CLI list defaults return only a small first page (20–50
items) with **no truncation warning**, and a single default call fed to the comparison
reads every truncated-away asset as missing (rule canon: setup Phase 4's "List
exhaustively", including the per-command `--page-flag` matching). `{page}` is literal —
the script substitutes it (one file per page; keep them all). Adjust the trailing
command per domain: `page` for commands declaring `--page`; `none` for limit-only
commands with a large explicit `--limit` (e.g. `--limit 10000`); for commands with no
paging flags at all, `none` with the bare command — drop `--limit` too, there is no
larger fetch to issue. Exit 0 = `reconciled`, or `unverified` with the count disclaimed
as the CLI-reachable set; a sweep exiting non-zero is acted on per its summary flags —
never fed to the comparison as a domain's inventory.

Skip `query` (no list command) and `runtime` (CLI-hidden). Include **list-only domains**
(asset types with no describe command — connections, jobs): re-run their `stub` step
(setup Phase 5) for any new/stale entries, since the list payload is their whole doc.
Run `upsert-batch` even when a list comes back empty (`--allow-empty` if the payload has
no items array) so the domain's coverage stamp stays current.

Then read each domain's recorded `idField` and `dateField` back from `report`'s
`domains_indexed` — **never re-derive them by eyeballing list items**: the index-time
recording is authoritative, and a re-derived mismatch flips the whole domain falsely
stale. The upsert invocation **omits `--date-field`** (the script applies the recording;
`"dateFieldSource": "recorded"` — or `"recorded-none"` — in its output confirms), one
call per page file, and the script does the comparison deterministically (new →
`pending`, newer `modified_date` → `stale`, unchanged → untouched):
```
node .gs-superadmin/plugin/scripts/manifest.mjs upsert-batch --manifest <slug>/_manifest.json --file <tmp-file> --domain <ns> --id-field <idField> --name-field <nameField> --list-command "gs-admin --json <ns> <list-cmd>"
```
**Pass `--list-command` with the command you actually ran** (substitute the same
`<ns> <list-cmd>` this step fetched with): on a domain indexed before the recording
existed this backfills it — setup's candidate gate cannot compute its diff without it —
and on an already-recorded domain it is harmless (omitting the flag would equally keep
the recording, which carries forward like `describeCommand`).

**Legacy manifests** (indexed before the date field was recorded): a `domains_indexed`
stamp with no `dateField` key — or a bare-timestamp stamp — predates the recording.
Derive the field once, per setup Phase 4's rule (check 2–3 more items when the candidate
is null on item 1), and pass exactly one of `--date-field <f>` / `--no-date-field`: the
first pass adopts and stamps the choice without tripping the guard, and entries stored
`modified_date: null` are `baselined` (dates backfilled, nothing marked stale — change
detection starts on the next refresh). Never pass a field that differs from an existing
recording: `--allow-redate` is a deliberate date-scheme change, not a refresh action.

**First refresh after a CLI upgrade — the connectors domain at CLI 1.0.9.** `cn list` rows
flattened at 1.0.9: every field that sat under `pnpConnectionsInfo` is top-level, and the
`Modified` column is gone with no top-level replacement. A KB whose connectors domain was
indexed by an earlier CLI records `idField` `pnpConnectionsInfo.connectionId` and a
`dateField` under the same key, so this step's `upsert-batch` — run exactly as written
above, reusing the recording — stops with exit 1 and writes nothing (the same words
`domain-candidates.mjs check` uses for a wrong id path; the re-index guard is a different
check and stays silent here, because the field you passed IS the recording):

    manifest.mjs: --id-field pnpConnectionsInfo.connectionId resolves to no value on any of the N row(s) — nothing was written. … This field is the recorded idField of domain connectors, so the list's row shape has moved under it …

The list is not broken and no connection changed identity: `connectionId` is the same value
at a different dot-path, so re-keying is a path change, not an identity change, and existing
entries do not duplicate. Re-run that one upsert on the FULL connector list with the flat
paths, `--allow-rekey` and an orphans file — and decide the date field in the same command,
because the recorded `dateField`'s KEY is absent from every flat row (the `Modified` column
was dropped, not nulled — a null value would count as present) and the script refuses to
compare against a dead path rather than reading every connection as unchanged forever:

    manifest.mjs: --date-field pnpConnectionsInfo.modifiedDateStr (the recording for domain connectors) resolves to no value on any of the N row(s) — the key is absent on every row (a null value would count as present) — change detection would be dead: every row would read unchanged forever and nothing could ever go stale, so nothing was written. …

Inspect one flat row first: if it carries a modified-date field, pass `--date-field <that
field> --allow-redate`; if it carries none, pass `--no-date-field --allow-redate`. One run:
```
node .gs-superadmin/plugin/scripts/manifest.mjs upsert-batch --manifest <slug>/_manifest.json --file <tmp-file> --domain <connections-domain> --id-field connectionId --name-field connectionName --allow-rekey --orphans-file <slug>/tmp/connectors-rekey-orphans.json --no-date-field --allow-redate --list-command "gs-admin --json cn list"
```
Substitute `--date-field <field> --allow-redate` for `--no-date-field --allow-redate` when the
row carries a modified date; that run compares the new field's values against the dates
stored from the old one — equal timestamps read unchanged, a later value flips that row
stale, and on this first run such a flip is the redate, not tenant change. Expect
`unchanged` to equal the domain's entry count (minus any such flips), `added` 0,
and the orphans file to be an empty list (unchanged id values); a non-empty one means the v2
route issued different ids — stop and treat it as the id-identity live check the maintainers
bank (audit-1.0.9 CP-6), not as a refresh. Whether a v2 row carries any modified date is
unknowable from the package and is a banked maintainer live check (audit-1.0.9 CP-6). A KB
whose connectors domain was first indexed by a 1.0.9 CLI already records the flat paths and
needs none of this; a KB still refreshed by a 1.0.8 CLI keeps its nested recording untouched.
The `deps-report` reader accepts both row shapes, so already-captured nested docs and newly
captured flat docs resolve side by side — and its Caveats name any connector doc that parsed
to no connection, with this re-capture as the remedy.

The script's per-domain output gives you the changed/new/unchanged counts for the report.
`--domain` must reuse the exact domain names already recorded in the manifest (setup
Phase 4's naming rule — e.g. `journey-email-templates`, not `journey`; `<connections-domain>`
above is whatever name the workspace recorded for `cn list` — `connectors` under the
naming rule, `connections` on older workspaces; read it from `report`'s `byDomain` or
`domains_indexed`, never from the namespace), and `--id-field` must reproduce the
existing keys — the re-index guard in `upsert-batch` hard-fails on any id field that
differs from the one the domain was indexed with (recorded in `domains_indexed`). A
renamed or misspelled domain is caught by the run's own recording flags (F-429): an
unrecorded `--domain` whose `--list-command` (or `--describe-command`) is the command
another domain was indexed from is refused, alias spellings included — that is why
step 3 passes `--list-command` on every upsert. A name passed with no recording flag
declares nothing and is taken as new, so never omit the flag on a refresh.

**Count guard — shortfall means under-fetch, never deletion.** After upserting a domain,
compare the total you fetched against `report`'s `byDomain` count, and read the script's
`incomingCount` / `existingEntries` / `warnings`: it warns when the incoming list is
smaller than the domain's non-failed inventory (expected and ignorable only for a single
page of a multi-page fetch, a recency-filtered list, or a **scope-limited domain** — a
list command that cannot see the whole tenant, named in setup's
`references/index-scope-notes.md`; `jo email templates` is one, and its shortfall is
permanent: re-paging cannot close it, and the same warning returns on every refresh —
read it as the known scope limit, not as under-fetch). **The default reading of any
other shortfall is "probable under-pagination → re-page and re-upsert"** — `upsert-batch`
never removes entries. Never pass `--partial` on a refresh re-list: that flag declares
a deliberate-subset registration (gap-fill flows), and here it would silence exactly
this warning. Also heed the script's mass-stale advisory before documenting: a
large fraction of a domain flipping stale at once usually means a wrong date field or a
platform event, not that many real edits.

**Nameless entries are repaired by the upsert, not by a re-describe.** A domain indexed with
a `--name-field` no row carried is refused outright now (F-421), but a workspace indexed
before that guard can hold entries whose `name` is null (the sign: stub docs titled with a
bare id). The repair is two script runs, no tenant describe: re-run that domain's
`upsert-batch` with the field the rows actually carry (`re r list` rows carry `ruleName`) —
unchanged rows take the incoming name and the summary reports `namesBackfilled` — then run
`stub` over the same list file with the same `--name-field`, which re-writes the domain's
stub docs under their names (full docs are never touched). Report both counts.

**Deletions are only inferable from provably complete pagination** — the running total
matched the payload's total field, or the short-page rule was exhausted with totals
reconciled. Even then, surface the candidate keys to the operator and get explicit
confirmation before `remove --keys-file`; never auto-prune from a count difference.

**New-candidate surfacing (cheap, read-only).** After the upserts, run:
```
node .gs-superadmin/plugin/scripts/domain-candidates.mjs diff --manifest <slug>/_manifest.json
```
Report any `undecided` candidates **by name** in the refresh report — a CLI upgrade's
new or renamed list command lands here as a new candidate rather than as silence.
Report `blocked` candidates by name too, with their recorded reasons: a block means
"could not be evaluated" (the list command fails server-side), not "decided", and a
refresh is exactly the later run that should retry — if the command now succeeds, say
so and direct the user to setup to decide it and lift the block.
Deciding index-or-exclude is setup work (describe recipes, stubs, documentation):
direct the user to run `/gs-superadmin:setup`, whose Phase 4 gates its report on zero
undecided — never silently skip them, and never adopt a new domain from a refresh run.
`legacyDomains` in the output names domains still lacking a `listCommand` recording;
passing `--list-command` on this refresh's upserts (above) is the backfill.

### 4 — Report

```
✓ gs-superadmin refresh complete
  Lookback:  <N> days
  Changed:   X assets marked stale
  New:       Y assets added as pending
  Unchanged: Z assets
```

**Detect-only is the default posture — staleness detection is cheap; re-documenting is
not.** A newer modified date proves *something* touched the asset, not that its content
changed: platform events bump modified dates en masse, and a mass re-document burns the
documentation budget overwriting docs whose content didn't change (and destroys the
docs' value as a "what actually changed?" record). When a large share of a domain flips
stale at once — or the upsert output's mass-stale advisory fired — eyeball the stale
set for a tight timestamp cluster (many assets sharing nearly the same modified date =
a platform event, not that many real edits), report that reading to the user, and only
then decide to document.

If `--document` was passed, continue with `/gs-superadmin:setup` Phase 5 logic (budgeted
documentation of stale/pending assets only), adding **`--if-changed`** to every
`describe-batch.mjs` invocation. Its content-fingerprint gate makes a bulk re-document
safe: one describe per stale asset, and the doc is rewritten (fingerprint re-recorded)
only when the payload's content actually changed — a timestamp-only bump re-marks the
entry documented without touching the doc file (`skippedUnchanged` / `unchangedKeys` in
the summary). Entries documented before fingerprints existed have none recorded, so they
document normally once and get one. One domain-specific exception: a `data-designer`
doc is skipped only when it is already a COMPLETE three-level composite — a
summary-only doc from an earlier plugin version, or a budget-cut partial, is
re-described (1 + tasks + fields calls under the batch script's spawn budget) and
upgraded; the setup skill's domain reference is the canon.

Otherwise: "Run `/gs-superadmin:setup` (or pass `--document`) to re-document changed assets."
