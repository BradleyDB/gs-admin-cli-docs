---
description: Bootstrap the gs-superadmin workspace for a Gainsight tenant — precheck, identify, scaffold, index, and document assets.
disable-model-invocation: true
argument-hint: "[--budget N] [--all] [--slug name] [--deep domain]"
---

# /gs-superadmin:setup

Set up (or resume) the gs-superadmin workspace for the active Gainsight tenant.
Idempotent — safe to re-run; only the cheap phases repeat on subsequent runs. This
skill is the judgment-and-gates skeleton: detailed mechanics live in reference files
under this skill's `references/` directory, read when a phase directs you to one —
not up front.

## Arguments

- `--budget N` — max assets to document in Phase 5 (default: 25)
- `--all` — document all pending/stale/failed assets (ignores budget)
- `--slug <name>` — override the derived slug (useful for unusual hostnames)
- `--deep <domain>` — fully ingest a shallow-crawled domain: describe its metadata-stub
  entries and upgrade them to full docs (respects `--budget`/`--all`; repeatable per
  domain, resumable — already-upgraded entries are never redone). Does not apply to
  **list-only domains** (no per-item describe command, e.g. connections/jobs): their
  stubs already carry everything the CLI can say — explain that and stop.

---

## Phase 1 — Precheck

Run `gs-admin --version` to confirm the CLI is installed. If it fails (command not
found), tell the user: "gs-admin is not installed. Run: `npm i -g @gainsight/gs-admin-cli`"
— then stop; do not proceed until re-run after installation.

Run `gs-admin whoami` to confirm authentication. If it fails (auth error or no
tenant), tell the user: "Not authenticated. Run: `gs-admin login`" — then stop; do
not proceed until re-run after login.

If both pass, continue. **Do not reinstall or re-authenticate if already set up.**

**Token pre-flight (F-221) — rule canon** for every long sequential `gs-admin` batch
(here: the Phase 3 crawl and Phase 4's candidate runs; the other batching skills
paraphrase and point back to this statement — the family list lives as data in
`build/check-doc-drift.mjs` check 16, not here):
before starting one, read the remaining-seconds figure from `whoami`'s `Token:` line.
At CLI 1.0.7 through v1.0.9 (re-measured live at each pin) a token stops working at HALF its lifetime (the known half-life defect —
commands fail with "Token expired and silent refresh failed" once remaining life
crosses 1800s of 3600s while `whoami` still reports it valid), so
**usable life ≈ remaining − 1800s**, not the number printed. If that is less than the
batch you are about to start, have the user re-run `gs-admin login` FIRST — an
interrupted batch is consistent (writes are atomic per call) but must be re-run, and a
mid-batch blanket auth failure masks real per-command errors in the same batch, so a
pre-flight login is cheaper than it looks.

---

## Phase 2 — Identify

From the `whoami` output, extract the `baseUrl` (or equivalent tenant URL field).

Derive `slug`, in this order:
1. If `--slug` was provided, use that value directly.
2. Scan the working dir for any `*/_manifest.json` whose `baseUrl` matches the `whoami`
   output — reuse that folder's slug (same slug every session once the workspace
   exists; never derive a second slug for a tenant that already has a manifest).
3. **First run only** (no `--slug`, no matching manifest): ask ONE combined question —
   "Tenant <baseUrl> — is this tenant **production or sandbox**? Workspace folder will
   be `<org-name>-prod/` or `<org-name>-sbx/` accordingly (or type a different folder
   name)." — where `org-name` = the first DNS label of the tenant hostname
   (`acme.gainsightcloud.com` → `acme`). Hostname markers (a `sandbox` substring, an
   `sb-` prefix, a `--<n>` sandbox-copy suffix) may be mentioned in the ask as a hint,
   but never decide the answer: no hostname convention is guaranteed, a wrong guess
   lands in the manifest and the folder name as durable fact, and the expected path is
   that the user simply accepts what was proposed (F-331: `sb-<org>--<n>` sandboxes
   spell no "sandbox" and were being recorded as production). The accepted folder name
   is recorded in `_manifest.json`, so this question is asked exactly once per tenant.

`environment` (`production` or `sandbox`) is the production-or-sandbox answer just
given — recorded in the manifest so the mutation guard flags production writes from
the user's own statement, never from name-guessing (F-331). A custom or `--slug`
folder name does not change it: with `--slug`, ask the same production-or-sandbox
question on its own. An existing manifest's `environment` is used as-is, never
re-asked (if an older plugin version left the field missing, ask once — `init` below
backfills it).

**Workspace directory and plugin link (first run and every run).** Create the
`.gs-superadmin/` directory in the working dir if it does not exist, then create the
plugin link: `.gs-superadmin/plugin`, a directory link to this plugin's installation
directory (a junction on Windows, a symlink elsewhere), through which every later fenced
command in this skill and every other skill runs the plugin's scripts as
`node .gs-superadmin/plugin/scripts/<x>.mjs …`. The plugin refreshes the link at every
session start; this fence is the one place the plugin's own path is spelled, because no
link exists yet on a first run. If it still shows a literal CLAUDE_PLUGIN_ROOT placeholder,
do not run it as-is: outside a plugin session the variable is unset, and bash and
PowerShell alike expand it to empty — substitute the plugin's root directory first.
```
node "${CLAUDE_PLUGIN_ROOT}/scripts/plugin-link.mjs"
```
It prints one line naming the linked plugin directory — relay it (that is the plugin
this workspace now runs). If the line instead begins `(nothing linked)`, the directory
step above did not run in this folder: create `.gs-superadmin/` and re-run the fence
before going on. A non-zero exit means the link could not be created: show its
message and stop, nothing below can run without it. On a first run inside a git
repository it may also report that the link is not yet git-ignored — expected until
Phase 3 §6 writes the `.gs-superadmin/` entry.

Ensure the workspace folder and manifest exist (idempotent — never clobbers an existing
manifest; backfills a missing `environment`):
```
node .gs-superadmin/plugin/scripts/manifest.mjs init --manifest <slug>/_manifest.json --slug <slug> --base-url <baseUrl> --environment <production|sandbox>
```
All manifest reads/writes in later phases go through this script — never hand-edit `_manifest.json`.

---

## Phase 3 — Scaffold

Plugin files below are addressed as `.gs-superadmin/plugin/…` — the link Phase 2 created
to the plugin's installation directory — relative to the working dir.

Work through `references/scaffold-mechanics.md` (in this skill's directory) in
section order — it carries the full file-by-file mechanics and the exact ask texts
(relay every ask as written): §1 template copies, §2 build-standards pack ask, §3
reference bundle, then the generation step below, then §4 mutation-guard merges (the
plugin's hook already covers the CLI lane — it asks, never blocks, and journals
approved mutations), §5 read-lane allow-rules ask, §6 workspace `.gitignore`, §7
CLAUDE.md managed block (written LAST, after everything above exists; rendered
exactly per the reference's template), §8 version agreement check. Binding
invariants, stated once here and assumed there: user-editable files are never overwritten once edited (an
unedited scaffolded copy is refreshed in place when its template moves, an edited one is
offered a `.new` beside it — scaffold-mechanics §1); the reference bundle always is (it must match the installed plugin —
F-272); every `.claude/settings.json` merge is append-only (add missing entries,
never remove or rewrite existing ones); every ask happens at most once per
workspace, recorded with its durable marker.

**Workspace catalog + cheatsheet** (generate from the installed CLI — every run: the
catalog is generated from the installed CLI's own manifests, not copied from the
plugin, so it — and the mutation guard, which prefers the workspace catalog — always
matches the CLI version the user actually has). Run, in order:
```
node .gs-superadmin/plugin/scripts/extract-catalog.mjs --out .gs-superadmin/catalog.json
```
```
node .gs-superadmin/plugin/scripts/render-cheatsheet.mjs --catalog .gs-superadmin/catalog.json --out .gs-superadmin/cheatsheet.md
```
The second command renders the cheatsheet from the catalog the first one just wrote,
with the same emitter that produced the plugin's bundled copy — whether that actually
happened is exactly what the post-condition below verifies; never assume it.

**Post-condition (check every run, before moving on).** Generation *succeeded* only if
all three hold. A zero exit alone is not enough — and the reverse is just as binding: a
**non-zero exit from either command is that command's failure even when a file from an
earlier run is still on disk** (a leftover must never stand in for this run's output):
1. the extract command exited zero, `.gs-superadmin/catalog.json` exists, and its
   `meta.cliVersion` is readable;
2. its `commands` array is non-empty;
3. the render command exited zero, and `.gs-superadmin/cheatsheet.md`'s
   `> Generated from CLI v…` header line cites the **same version** as the catalog's
   `meta.cliVersion` — freshness, not existence: a cheatsheet left by an earlier run
   fails this check whenever the CLI has moved since.
If 1 or 2 fails (including when a command's output was never written, was blocked, or
the command couldn't run at all), treat it as catalog **generation failure**; if only 3
fails, treat it as cheatsheet **render failure**. Then apply the matching fallback from
`references/scaffold-mechanics.md` §3b — including its user report, and its rule for a
fallback copy that itself fails (no retries, no improvisation).

---

## Phase 4 — Index (cheap; runs every time)

Create `.gs-superadmin/tmp/` for raw list output.

For each indexable domain, run its list command(s) with `--json` before the subcommand,
**captured to files** through the shipped capture helper's **paginate mode** — one
invocation per list command; the mode owns the whole page loop, the short-page/total
reconciliation, and the suspect-round-count honesty (this and the next paragraph are
the canonical statements of the capture and pagination rules — the other capturing and
sweeping skills carry a one-line paraphrase pointing here):
```
node .gs-superadmin/plugin/scripts/capture.mjs --paginate --page-flag page --out .gs-superadmin/tmp/<ns>-<list-cmd>-{page}.json -- gs-admin --json <ns> <list-cmd> --limit 200
```
`{page}` is literal — the SCRIPT substitutes it (one file per page; keep every page
file). The helper spawns the CLI itself (argv, no shell) and writes clean UTF-8 with no
BOM on every shell — never capture with a bare shell redirect, whose encoding is the
shell's choice (an ill-encoded file is one the manifest script's JSON parser rejects).
If a payload was ever captured by hand with a redirect, re-encode it before parsing:
`node .gs-superadmin/plugin/scripts/capture.mjs --normalize <file>`. Put any
processing beyond a trivial expression in a scratch `.mjs` file under
`.gs-superadmin/tmp/` rather than a `node -e` one-liner — Windows PowerShell re-parses `-e` strings and errors on `[`, `||` and `}`.

**List exhaustively — CLI defaults silently truncate.** Many list commands return only a
small first page by default (20–50 items) with **no truncation warning** — and even the
ones that don't give no signal either way — so a single default call is never trusted as
the full inventory; that is what the paginate mode above exists for. It appends the page
flag each round, stops per the doctrine (a short page ends the sweep only once the
running count reconciles with the payload's own total — some handlers cap the page size
below what `--limit` asked for; an empty page, or a short page when the payload carries
no total, stops it), and prints the honesty report: pages fetched vs parsed, rows
counted, every total it found with its path, and a verdict. Exit 0 = `reconciled`, or
`unverified` (no payload total exists — the count is the CLI-reachable set; carry that
disclaimer wherever the sweep is reported). Any other verdict exits non-zero —
`mismatch`, `suspect` (a count landing exactly on a common server default or the
requested limit, with nothing to reconcile), `total-conflict`, `unrecognized-shape`
(the rows array could not be decided — no array where every known list envelope
keeps one (root, a root child, or a `data` child) while arrays exist elsewhere, or
more than one candidate array of different lengths there — the loop never guesses
between them: nothing was counted; state the rows array with `--items-path <dotted>`,
the same spelling Phase 4 records, or inspect the page file and report the shape),
`failed-page` (an
unreadable page is a failed sweep page, never 0 entries), `safety-stop` — read the
summary's flags and act; never report a non-zero sweep as domain coverage. Judgment the
script cannot make:

- State the rows array with `--items-path <dotted>` for any command whose envelope
  carries a second array beside the rows — the same path you record with
  `--items-path` on `upsert-batch`. Known at 1.0.8: `rp list` carries a root `alerts`
  block that is empty on a quiet tenant and fills on one with something to report, so
  its fence always passes `--items-path data.data` (the audit skill's fence is the
  precedent). A sweep that stops with `unrecognized-shape` is telling you the page has
  more than one candidate: read the candidates it names and re-run with the path stated.
- Match `--page-flag` to the command: `page` for commands that declare `--page`
  (the scorecard family included); `none` (one reconciled fetch) for limit-only
  commands — pass an explicitly large limit (e.g. `--limit 10000`; `jo email templates`
  fetches its whole already-scope-filtered result server-side, then caps **client-side
  at 50** by default) — and for commands with no paging flags at all (`jo surveys
  list`, `jo data-designer list`: there is no larger fetch to issue, and both are also
  scope-limited — next bullet). The scorecard family works either way; the audit
  skill's `sc list --limit 10000` single fetch is the precedent (its bare defaults
  truncate — `sc m list` serves 20 rows by default, measured on 1.0.4; since CLI
  1.0.8 (re-checked at v1.0.9) the four `sc` list commands return a top-level `_total` the mode reconciles
  against).
- On `suspect`, re-verify with a larger limit captured to a **separate** file (never
  overwrite the baseline being compared against); where no larger fetch exists (the
  no-paging-flags commands), record the count as the CLI-reachable set WITH the
  suspect caveat spelled out. A domain that still cannot be reconciled to a total is
  recorded in its KB file as `captured N of M` (or `total unverified` where no total
  exists) — never presented as complete.
- Reconciliation proves **paging** completeness against the payload's own post-filter
  total — never inventory completeness (scope-limited domains, next bullet).
- **Scope-limited domains — paging cannot fix these.** Several journey-side list
  commands cannot see the whole tenant (`jo email templates`, `jo surveys list`,
  `jo data-designer list`; Data Designer *designs* have no list command at all, and
  are not identifiable among dm objects). Before indexing any of those — or reasoning
  about their coverage, or recovering list-invisible templates from user-supplied
  ids — read `references/index-scope-notes.md`: the per-command limits, the
  "CLI-reachable subset" annotation and UI-vs-CLI gap rules, and the recovery flow.

Consult `.gs-superadmin/cheatsheet.md` for the exact commands. Skip `query` (no list
command — only `q execute`) and `runtime` (CLI-hidden). For domains with multiple asset
types (e.g., `rules-engine` has both `re rules list` and `re chains list`), run each list
command separately.

**What counts as an indexable domain**: every list command whose rows are owned or
configured assets — **including asset types with no per-item describe command**
(connections from `cn list`, jobs from `cn jobs`); never skip a domain because it
can't be deep-documented — Phase 5's stub is its complete doc. Skip only pure
activity/history feeds (`cn activity`, `cn px`, audit logs — execution records, not
assets), **and record each skip as an exclusion at the candidate gate below**, so a
re-run can tell "considered and declined" from "nobody ever looked". Run
`upsert-batch` for **every** list you ran, including one that returned zero items
(`--allow-empty` if the payload carries no items array at all): the empty stamp in
`domains_indexed` is the only evidence distinguishing "listed, tenant has none"
from "never listed".

Inspect only the **first item** of each file (first ~40 lines is enough) to identify that
domain's id, name, and modified-date field names — **except when the candidate date field
is null on item 1**: a null there means "this item has no date", not "this domain has no
date field", so check 2–3 more items before concluding the domain has none (several
domains carry a real modified-date field that happens to be null on the first row; recording
those domains as date-less blinds every future refresh to their modifications). The opposite
trap is a field that resolves on EVERY row and is not a modification date at all: a timestamp
generated per call — every row's value within a second or two of the others and all of them
equal to the moment of the list call, whether spelled as an ISO string or an epoch-millisecond
number (`sc scheme list` at CLI 1.0.9 is the known case: epoch numbers stamped row by row;
F-418). Recorded, it flips the whole domain stale on every refresh forever. The manifest script
refuses that signature on a full list of two or more rows (`--no-date-field` is the record for
such a command; `--allow-generated-date` overrides only when every row genuinely was modified in
those same seconds). The same script also refuses a `--name-field` no row carries (F-421) —
inspect a row for the key it actually uses (`ruleName`, not `name`, on rules). Then hand
the whole file to the manifest script, which does the bookkeeping deterministically:
```
node .gs-superadmin/plugin/scripts/manifest.mjs upsert-batch --manifest <slug>/_manifest.json --file <tmp-file> --domain <ns> --id-field <idField> --name-field <nameField> --date-field <dateField> --describe-command "gs-admin --json <ns> <describe-cmd> --id {id}" --list-command "gs-admin --json <ns> <list-cmd>"
```
The script keys entries as `<domain>/<id>`, adds new assets as `pending`, flips entries
with a newer modified date to `stale`, leaves the rest untouched, and saves atomically
(dot paths for nested field names; `--items-path <dot.path>` if the items array needs
locating). Four recordings are made at index time, stored in `domains_indexed` and
reused by every later run; the script GUARDS the id-field and date-field recordings —
a re-index that contradicts one hard-fails with the remedy in its message (deliberate
rekey/redate flows and orphan cleanup included): read the message and follow it;
never hand-edit `_manifest.json`. The judgment per recording: **`--list-command`** is
what makes the candidate gate's diff mechanical (passing it on any re-index backfills
a legacy manifest); **`--describe-command`** is composed NOW, while choosing the id
field it must match — substitution rules and known identifier cases are
`references/index-scope-notes.md`'s first section; read it before composing. For a
**list-only** domain pass `--describe-command none` — that records the decision, and
the domain's stubs then say "complete"; a domain indexed with NEITHER a template nor
`none` is UNRECORDED, and its stubs say "completeness UNKNOWN" until one is recorded
(an omitting re-index keeps any existing recording);
**`--id-field`** must reproduce the existing keys on a re-index — spot-check 2–3
known manifest keys against the new file's extracted ids before upserting (a
key-scheme change is a deliberate, full-list operation, never a workaround for a
guard failure); and every NEW domain passes **exactly one of `--date-field <f>` or
`--no-date-field`**, decided only after the multi-item null check above — never omit
both on a first index (an unrecorded field forces every refresh to re-derive it, and
a re-derived mismatch flips the whole domain falsely stale); omitting both on a
re-index reuses the recording, and adopting a real field over entries stored without
one **baselines** instead of staling (`baselined` in the summary).

**`<domain>` is one name per list command** and the same name is the KB doc folder
(`<slug>/<domain>/`): the catalog namespace for the primary asset list (`rules-engine`
from `re rules list`), a suffixed domain per additional asset type (`re chains list` →
`rules-engine-chains`, `jo email templates` → `journey-email-templates` — exact names:
`--deep` examples, stub folders, and the template-doc generator all key on them).
Re-runs and refresh must reuse the exact names already in `report`'s `byDomain` — a
renamed domain would re-add the whole inventory under a new key prefix. `upsert-batch`
refuses that when the run's own recording flags identify the existing domain (an
unrecorded `--domain` whose `--list-command` / `--describe-command` is the command another
domain was indexed from, alias spellings included — F-429); a name passed with no
recording flag declares nothing and is taken as new, so always pass `--list-command`.
The name is per-workspace data: every reader that needs "the connections domain"
(deps-report's lanes, the relationships builder's defaults) resolves it from
`domains_indexed`'s recorded list command, never from the namespace spelling. New CLI lists get
NEW names (a future Data Designer *designs* list → suggest `data-designer-designs`;
`journey-data-designer` and `data-designer` are already taken).

**Candidate gate — every list command decided, or Phase 4 does not report.** After all
domains, derive the candidate set and diff it against the manifest:
```
node .gs-superadmin/plugin/scripts/domain-candidates.mjs diff --manifest <slug>/_manifest.json
```
The script derives every candidate mechanically from the workspace catalog (artifact-lane,
non-mutating, tenant-wide list commands — never from recall) and maps each against the
manifest: **indexed** (a `domains_indexed` entry's recorded `listCommand` matches),
**excluded** (recorded in `domains_excluded`), or **undecided**. Surface the undecided
candidates to the user **by name** — the decisions are tenant policy, not bookkeeping —
then work through them in the order printed. A candidate flagged `likelyPerAsset: true`
is probably a per-asset sublist whose required flag the catalog does not declare (the
filter drops only *declared* required flags): expect its tenant-wide run to fail with a
runtime "X is required" error, and when it does, exclude it as a per-asset sublist
citing that error — the flag is advisory, so still run it once rather than excluding on
the hint alone. A candidate carrying a non-null `requiredEnumFlags` is runnable
tenant-wide only through those enum flags (e.g. `--type` over `MDA|SFDC`): to evaluate
or adopt it, run the list once per enum value and combine the captures — a decision on
such a candidate covers every value, and its reason should say so.

1. Run the candidate's list exhaustively (rules above), captured to a tmp file through
   the capture helper (Phase 4's invocation shape).
   **If the command itself fails server-side** (HTTP 5xx, "Server Error") — retry twice;
   deterministic failure with distinct request IDs means the candidate **cannot be
   evaluated**, which is neither adopt (no payload, so step 2's overlap question is
   unanswerable) nor exclude (exclusions are permanent; "returns 500 today" is not a
   durable reason). Record a **block** instead, with the observed error as the reason and
   a re-check date:
   ```
   node .gs-superadmin/plugin/scripts/manifest.mjs block --manifest <slug>/_manifest.json --command "<path>" --reason "<observed error>" --recheck-after <YYYY-MM-DD>
   ```
   A block satisfies the step-4 gate but is NOT a decision: the diff keeps naming the
   candidate on every run (and warns once the re-check date passes), and a later run
   whose retry succeeds decides it normally — adopt or exclude — which lifts the block
   (an `exclude` lifts it automatically; an adoption leaves a stale-block warning until
   `block --remove`). Never record an exclusion whose real reason is "the command
   errored": that permanently buries a possibly-real domain as considered-and-declined.
2. Ask the global overlap question — **"are these rows already indexed ANYWHERE in the
   inventory?"**, never "does a domain of this name exist" (a filtered view of an
   already-indexed list matches under a *different* domain than its namespace suggests):
   ```
   node .gs-superadmin/plugin/scripts/domain-candidates.mjs check --manifest <slug>/_manifest.json --file <tmp-file> --id-field <idField> --out <check-file>
   ```
   `<check-file>` is a tmp path of your choosing (e.g. `.gs-superadmin/tmp/check-<n>.json`,
   one per candidate): the script writes the same JSON it prints, and step 3's `exclude`
   takes that file as the decision's evidence.
   `<idField>` is a dot path into each row (pass `--items-path <dot.path>` when the items
   array needs locating, as for `upsert-batch`). A connection-shaped payload's id path
   follows the endpoint and the CLI version that captured it — `cn list` nests it
   (`pnpConnectionsInfo.connectionId`) at CLI 1.0.8 and puts it top-level (`connectionId`)
   from 1.0.9, while `re r list-rest-connections` keeps the nested path — and the script
   fails loudly on a field that resolves to nothing on every row: inspect a row first,
   never assume either shape, and the `idField` you record must match the shape the
   installed CLI emits (a later CLI upgrade re-keys the domain through refresh's
   migration note, never silently).
   It fails the same way when the field resolves on only **some** rows: the overlap answer
   would then cover the resolvable subset only, and a decision made from it silently
   excludes the rows nobody tested. Fix the dot-path, or narrow a mixed array with
   `--items-path`. `--allow-partial` exists for rows that genuinely carry no id, and it
   **withholds `allIndexed`/`noneIndexed`** — a partial extraction yields counts, never a
   decision flag, so step 3 below cannot be run off it.
3. Decide, using the check's numbers — and only when the extraction was complete
   (`unresolvedRows: 0`; a `partial: true` result answers neither of the first two
   branches and must be resolved, not worked around). A `rows: 0` check likewise
   withholds both flags: the script fails by default when it can't locate an items
   array (`--allow-empty` opts into answering, exactly as for `upsert-batch`), and a
   0-row answer must be decided from the payload itself — inspect the capture first
   (a typo'd `--items-path` and a captured error body both look like "empty"), and
   only if the tenant's list is genuinely empty, adopt it as an empty domain
   (`upsert-batch --allow-empty`, stamp-only) or exclude it with a reason:
   - `noneIndexed` and the rows are owned/configured assets (the "What counts" rule
     above) → **adopt**: `upsert-batch` it under the diff's `suggestedName` — or another
     non-colliding name when `nameCollision` is flagged — never a bare namespace, never
     an existing domain's name (naming rule above). A tiny row count is not a failed
     crawl: some real domains are small, config-shaped lists.
   - `allIndexed` → a filtered view of an already-indexed list: **exclude as covered**,
     naming the covering domain (the check's `matchedByDomain`) as the `--covered-by` flag:
   ```
   node .gs-superadmin/plugin/scripts/manifest.mjs exclude --manifest <slug>/_manifest.json --command "<path>" --reason "<why>" --check <check-file> --covered-by <domain>
   ```
   - Otherwise — partial overlap, activity/history feeds, execution records,
     lookup/reference data, organizational containers with no dependency surface —
     **exclude as a judgment call** with the item's own specific reason (a blanket
     "reference data" is often wrong; record what a future re-run needs in order to not
     re-litigate the call). A **partial overlap is never "covered"**: rows the covering
     domain does not hold are indexed nowhere, and `deps-report` answers "nothing depends
     on this" for every one of them — so 253 of 586 is an adopt, not an exclude:
   ```
   node .gs-superadmin/plugin/scripts/manifest.mjs exclude --manifest <slug>/_manifest.json --command "<path>" --reason "<why>" --check <check-file>
   ```
   The verb binds the verdict to the check's numbers, not to the prose: `--covered-by` is
   refused unless every unique id is indexed under that one domain, and a check that
   proves exactly that is refused without `--covered-by`. A candidate no check could run
   for (the payload carries no items array, as `journey cta options`) passes
   `--no-check "<why>"` in place of `--check`. Add `--recheck-after <YYYY-MM-DD>` when the
   reason rests on a tenant state that can change (a 0-row list, "empty on this tenant")
   rather than on the payload's shape — the diff surfaces the exclusion by name once the
   date passes, as it does a block's.
   `<path>` is the exact `path` value the diff printed for the candidate; `<why>` is the
   specific reason just decided.
4. Re-run the diff with `--require-decided` — it must exit 0 before Phase 4 reports:
   ```
   node .gs-superadmin/plugin/scripts/domain-candidates.mjs diff --manifest <slug>/_manifest.json --require-decided
   ```
   It also fails while any already-indexed domain lacks a `listCommand` recording (a
   manifest indexed before the recording existed): backfill by re-running that domain's
   `upsert-batch` with `--list-command` — adoption under a new name is never the fix for
   a legacy domain.

   The gate passes with blocked candidates, and says so on stderr by name — the Phase 4
   report must carry them the same way (name, reason, re-check date), never fold them
   into "all candidates decided".

Exclude-vs-block semantics are defined once, in step 1 above; the gate's own stderr
restates them at the moment they matter.

Then:
```
node .gs-superadmin/plugin/scripts/manifest.mjs report --manifest <slug>/_manifest.json
```
Relay the **per-domain counts** from the report, not just the total: "Indexed N assets
across M domains (domain: count, …). X pending, Y stale, Z documented." Include the
report's `emptyDomains` explicitly ("domain: 0 — listed, tenant has none") and the
exclusion ledger ("K list commands deliberately excluded — reasons recorded in
`domains_excluded`"). Treat any domain whose count lands exactly on a common default
page size (20, 25, 50) as **suspect** — re-verify its pagination was exhausted before
continuing — and ask the user whether the totals match their sense of the tenant
before Phase 5 spends the documentation budget.

---

## Phase 5 — Document (budgeted, resumable)

**Crawl mode (ask once per tenant)** — read the recorded mode first:
```
node .gs-superadmin/plugin/scripts/manifest.mjs crawl --manifest <slug>/_manifest.json
```
If unset, ask the user (recommend **shallow** whenever any domain exceeds 100 assets):

> **Shallow or deep crawl?** Shallow fully documents every domain with ≤ 100 assets, and
> writes metadata-only stubs (one file per asset, generated from the list payload — no
> describe calls) for any domain above 100. Deep describes everything. Any shallow domain
> can be fully ingested later with `/gs-superadmin:setup --deep <domain>`.

Record the answer: `… crawl --manifest <slug>/_manifest.json --set shallow|deep`.

**Checkpoint preference (ask once per run, before the first domain)**: ask whether to
pause after each completed domain for verification — report written-vs-inventory counts,
show one sample doc, and wait for a go-ahead — or run straight through. Honor the answer
for the rest of the run.

**Process one domain at a time**, smallest remaining (non-documented) inventory first —
ascending order from `report`'s `byDomain`. Per domain, take its batch from the shared
budget:
```
node .gs-superadmin/plugin/scripts/manifest.mjs next --manifest <slug>/_manifest.json --domain <domain> --limit <remaining budget>
```
(For `--all`, pass a limit larger than the inventory, e.g. `--limit 100000`.)

**Stubbing** — a shallow-mode domain over 100 assets is stubbed deterministically
(no describes; stubs consume no documentation budget), and a **list-only** domain
(no usable per-item describe: connections; jobs, whose `--describe` is too
ambiguous for bulk use — §1 has the why) is stubbed whatever the crawl
mode or size — the list payload is everything the CLI can say, so its stub is that
asset's **complete** doc; these domains never enter the `--deep` queue and never
block Phase 6, and the report names them "list-only (complete)", never
"metadata-only (shallow)". The `stub` invocation and its rules are
`references/document-mechanics.md` §1; run it, then continue to the next domain.

**`--deep <domain>` runs** — select the stubs awaiting full ingest with the
`next --upgrade` invocation (`references/document-mechanics.md` §2), then follow
the standard describe path below, overwriting each stub file (the entry's
`doc_path`) and marking `--status documented --depth full`.

**All other domains (and deep crawl) — describe each entry in the batch.** Default
execution is the sanctioned batch script (below); the manual per-asset path it
automates (describe → doc → `mark`: the doc shape, the `doc_path`-is-truth rule, the
failure mark — for one-off or special-cased assets) and the hand-chaining rules are
`references/document-mechanics.md` §3 and §5.
**Domain-specific payload semantics live in `references/document-domain-notes.md` —
read the matching section BEFORE documenting `scorecard` (describe by name, not id —
a known CLI auth race; `levelType` measures-tree semantics), `journey-email-templates`,
`journey` (compact-doc domains the batch script auto-selects doc-modes for — raw
payloads must never be embedded in KB docs or read into context; each has a first-run
user notice to relay and its own `--limit` sizing), or `data-designer` (the batch
script's designer doc-mode describes three levels per template — template, per-task
drilldown, per-field detail — under a per-invocation spawn budget and resumes from
the doc; `--limit` 1–2, its own first-run notice). Applies to `--deep` runs too.**

**Batch execution — use the sanctioned script.** The describe→doc→mark loop is
deterministic work; run it through `describe-batch.mjs` rather than improvising an
orchestrator or hand-chaining every call. It selects the batch (same `next` semantics
as above), runs the describes **sequentially** (parallel `gs-admin` calls can trip
the token-refresh race under "Known CLI issues"), writes one structured doc per
asset, and marks each entry as its doc lands, so an interruption never loses more
than one asset:
```
node .gs-superadmin/plugin/scripts/describe-batch.mjs --manifest <slug>/_manifest.json --domain <domain> --command "gs-admin --json <ns> <describe-cmd> --id {id}" --out-dir <slug>/<domain> --limit <chunk>
```
`--command` may be omitted when Phase 4 recorded the domain's describe recipe: the
recording is the default, an explicit `--command` always wins, and the script's
read-only fail-closed catalog gate validates either the same way — it **refuses
anything mutating or unknown** (run those directly, where the mutation guard can
arbitrate). Domains with no recording still require `--command`. `{id}`/`{name}`
substitute per entry as literal argv — no shell, so pipes and spaces in names are
safe unquoted (substitution rules and identifier cases:
`references/index-scope-notes.md`'s first section). The script also records a
content fingerprint per documented entry, which `/gs-superadmin:refresh
--document` passes `--if-changed` against so a later re-describe rewrites a doc
only when the payload genuinely changed. Size `--limit` so one invocation
finishes inside the harness's ~2-minute shell timeout (**~10–15 describes** is
the norm, journey programs included; `journey-email-templates` alone runs ~50;
`data-designer` runs **1–2** templates because each costs 1 + tasks + fields calls
under the script's own per-invocation spawn budget — sizing rationale in the
domain reference; for a bigger chunk raise that one call's timeout parameter,
never a global setting) and re-invoke until the summary reports
`moreRemaining: false` — already-documented entries are never re-selected, failed
ones retry after the untried, and stderr progress plus the summary's
`domainProgress` keep a long `--deep --all` loop visible (on `--upgrade` runs
depth is the metric — watch `full`, not documented/total).
**Stop rule for persistent failures**: if a re-invocation documents 0 assets and
its `failures` list names the same NON-EMPTY set of keys as the run before it,
stop re-invoking — those failures are deterministic; report the failed keys with
their recorded errors instead of looping. A run that documents 0 with an EMPTY
`failures` list and `budgetExhausted: true` (the designer doc-mode's spawn budget
ran out mid-template) is progress — its doc grew on disk — so re-invoke.
On `--deep` runs add `--upgrade` (a failed stub keeps depth `metadata`, stays in the
upgrade queue, and is retried the same way). Email templates, journey programs, and
data designers run through this same batch script — it writes compact docs for the
first two and the three-level composite doc for designers.

**When a domain completes** (no non-documented entries left in it): honor the checkpoint
preference from the top of this phase — if the user opted in, pause and verify before
starting the next domain.

After hitting the budget limit, report per the shapes in
`references/document-mechanics.md` §4 — keep documented / remaining / permanently
failed as separate counts (`failed` is a terminal state the skill deliberately
produces, not work still queued), and never advertise `--deep` for a list-only
domain.

**If any `pending` or `stale` entries remain, stop here.** Skip Phase 6 — relationship synthesis from partial data would produce misleading maps. Phase 6 runs automatically on the run that clears them, which is the same condition Phase 6 states as its precondition. Persistent `failed` entries do **not** block Phase 6: they are terminal, the `next` selection re-offers them so the remaining count would never clear on its own, and the maps' coverage headers report them ("N asset(s) failed describe and are not represented").

---

## Phase 6 — Synthesize

**Precondition**: only run if all inventory entries are `documented` or `failed` (no `pending` or `stale` remaining). Metadata stubs count as documented — they never block this phase.

Build or refresh `<slug>/relationships/` — **default mechanics is the sanctioned
script** (same rationale as describe-batch: deterministic parsing work, and the bulk
describe payloads never enter model context):
```
node .gs-superadmin/plugin/scripts/relationships-build.mjs --manifest <slug>/_manifest.json --out-dir <slug>/relationships
```
It derives the four maps from the KB docs: `field-to-rule.md`,
`field-to-scorecard.md` (with a flagged section for **dangling measure references**
— a real tenant-hygiene signal, not an error), `process-maps.md` (rule → CTA), and
`program-to-template.md` (program → email template from GSID co-occurrence; raw and
compacted program docs both work). **There is no journey → rule map to build**:
Rules Engine rules do not load participants into JO programs — programs draw
participants from Power Lists (CSV uploads, ad-hoc queries, Data Designer datasets),
never a rule (Gainsight product architecture, tenant-agnostic; live-confirmed by a
full GSID cross-reference finding zero shared-id edges). process-maps.md states
this — never hand-build a program→rule map.

The builder reads each lane's folder name from the manifest's recordings (the domain
whose recorded `listCommand` is that lane's list — `re rules list`, `re chains list`,
`sc list`, `jo programs list`, `jo email templates`; F-429), falling back to the
defaults (`rules-engine`, `rules-engine-chains`, `scorecard`, `journey`,
`journey-email-templates`) only for a lane with no recording. Pass `--rules-domain` /
`--chains-domain` / `--scorecard-domain` / `--journey-domain` / `--templates-domain`
only to override that, with the actual names from `report`'s `byDomain`.

**Coverage and shallow crawls are handled by the script**: each file opens with a
coverage header (full-doc counts, stub-excluded domains with their `--deep` re-run
command, failed-describe counts), and a rules domain with no full docs gets a
"pending deep ingest" note instead of a thin map built from stub metadata. Relay
three things from the script's JSON summary: any `unknownActionTypes`, a non-zero
`danglingMeasureRefs` count, and the program→template result (or that the map is
pending the journey domain's deep ingest).

**Prose synthesis (after the script)** — add what the script cannot derive: program →
Power List → source chains (CSV upload / ad-hoc query / Data Designer dataset) traced
from each program doc's PowerList config block (preserved verbatim in compacted
docs), and any cross-domain relationships you can ground in documented KB entries —
never a program→rule participant map (above). Label hand-added edges `confirmed`
(from CLI output) or `inferred` (derived by reasoning across docs); assert nothing
not grounded in CLI output or documented KB entries. The script **overwrites** the
four files on every run — hand-written synthesis goes in `<slug>/overview.md` (with
a pointer from the relationships file if useful), never inline in generated files.

---

## Final report

```
✓ gs-superadmin setup complete
  Tenant:     <slug> (<baseUrl>)
  Documented: N assets
  Remaining:  M pending/stale
  KB folder:  <slug>/
  Next steps: /gs-superadmin:refresh to detect changes
```
