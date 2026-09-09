---
description: Read-only Journey Orchestrator email & schedule reports from the tenant KB — search every email template for a phrase (with program context), inventory a program's emails end-to-end, audit active programs' schedules, or trace object/field usage in participant sources. Use when asked "which emails mention X", "what does program Y send", "what's running or scheduled right now", or "which journeys use object/field Z". Writes a markdown report, optionally CSVs/XLSX. Never mutates the tenant.
argument-hint: "<search|program|audit-active|deps> [--query t]… [--name p]… [--object o]… [--field f]… [--deep] [--addbody] [--all-terms] [--whole-word] [--snippet N] [--alias-prefix re] [--kb dir] [--scan-tokens] [--live-deps f]… [--active-only|--all] [--include-paused] [--csv] [--xlsx] [--budget N] [--slug name]"
# model-invocable by design (no disable-model-invocation) — Bradley, S4 2026-07-15
---

# /gs-superadmin:email-report

Four read-only report modes over Journey Orchestrator email templates and programs, built
from the tenant KB plus a fresh live status sweep:

- **search** — every email template containing the given phrase(s): matched field,
  snippet, and the programs using each template (name + status + bound survey).
  `${...}` tokens render as their author display names (`{Product Name}`).
- **program** — one program's email inventory: step-flow table (with each step's
  bound survey) by default; `--deep` adds every email's subject, full plain-text
  body, variants, and a per-email token table. Tokens resolve through the
  program's own bindings (`{Customer Tier}`), falling back to the template's
  author label; unresolvable ids stay raw.
- **audit-active** — schedule audit of all PROCESSING programs: recurring vs one-time,
  humanized cron, next run / last success / running-now in each program's own timezone.
- **deps** — object/field usage across participant sources, classified **filter** vs
  **projected/show field** (`--scan-tokens` adds `${...}` email-body token hits).

## Ground rules (restated from the build plan — non-negotiable)

- **Read-only tenant.** Every `gs-admin` command this skill issues is catalogued
  non-mutating (`whoami`, `jo p list`, `jo p describe`, `jo email template`). Gap-fill
  writes only KB markdown + manifest entries in the workspace — never tenant state.
- **Sequential `gs-admin` calls only** — parallel calls trip the CLI's token-refresh race.
- **Single-quote every name/filter value** — Gainsight names contain `|` and spaces.
- **Bulk JSON never enters model context.** List/describe payloads and the index live
  under `.gs-superadmin/tmp/`; you read only script stdout summaries and finished reports.
  Run the report scripts through the Bash tool: capturing stdout in Windows PowerShell
  5.1 decodes it via the OEM console codepage and silently mangles non-ASCII asset
  names in the summary (warnings, gap samples, ambiguity lists) — no error is raised.
- **Confirmed data only.** Never infer email send-completion: audit-active's
  "Per-step sends" column is the hard-coded literal `not available via CLI`. Leave it —
  never "fill it in" from schedules, timestamps, or any other signal.

## Arguments

First argument (required): the mode — `search` | `program` | `audit-active` | `deps`.
If missing or unclear from the ask, ask the user which mode before doing anything.

Mode flags (passed through to the script — this is the shipped surface):

| Mode | Flags |
|---|---|
| `search` | `--query <t>` (repeatable, ≥1 required) · `--all-terms` (AND; default OR) · `--whole-word` · `--snippet <n>` (default 50) · `--active-only` · `--include-paused` |
| `program` | `--name <name-or-id>` (repeatable, ≥1 required) · `--deep` (full bodies; default is the shallow step-flow table) · `--addbody` (adds a full-text `body` column to program-emails.csv — only meaningful with `--csv`/`--xlsx`) · `--include-paused` |
| `audit-active` | `--include-paused` only — it **rejects** `--all`/`--active-only` by design |
| `deps` | `--object <o>` / `--field <f>` (repeatable, ≥1 of either required) · `--alias-prefix <regex>` (explicit override only — the script reads the workspace convention itself) · `--kb <slugDir>` (participant-source provenance; step 5 supplies it) · `--scan-tokens` · `--live-deps <file>` (repeatable; step 5 captures these) · `--all` \| `--active-only` (active is the default) · `--include-paused` |

Skill-level flags (handled by these steps, not passed to the script):

- `--csv` — also write the mode's per-table CSVs
- `--xlsx` — convert those CSVs into one workbook (implies `--csv`)
- `--budget N` — gap-fill fetch budget; `0` skips gap-fill; omitted → gap-aware ask (step 4)
- `--slug <name>` — override the derived slug

"Active" everywhere means status **PROCESSING** only; PAUSE joins only via
`--include-paused`.

---

## Steps

### 1 — Identify instance

Same as `/gs-superadmin:refresh` step 1: run `gs-admin whoami`, derive the slug from
`*/_manifest.json` (or `--slug`). If no workspace manifest exists, tell the user to run
`/gs-superadmin:setup` first and stop.

**Token pre-flight (F-221):** the step-2 sweep and a step-4c gap-fill are long
sequential batches (a full gap-fill can be hundreds of back-to-back calls) — check
`whoami`'s remaining token life first and have the user re-run `gs-admin login` if the
USABLE life (far less than the number printed, per the known half-life defect) won't
cover the batch; re-check before 4c when the chosen budget is large (rule canon: setup
Phase 1).

### 2 — Live status sweep

Run the program-list sweep through the capture helper's **paginate mode** — it owns the
page loop, the short-page/total reconciliation, and the suspect-round-count honesty,
without a payload ever entering context (rule canon: setup Phase 4's "List
exhaustively"; clean UTF-8, no BOM, any shell; never a bare shell redirect):

```
node .gs-superadmin/plugin/scripts/capture.mjs --paginate --page-flag page --out .gs-superadmin/tmp/er-plist-{page}.json -- gs-admin --json jo p list --limit 200
```

`{page}` is literal — the script substitutes it, one file per page (`er-plist-1.json`
through the last page fetched — keep every page file; step 3 consumes them all). Exit
0 = `reconciled` (`jo p list` carries its totals as direct children of `data`), or
`unverified` — no payload total: say in the report that the sweep's completeness could
not be reconciled. On any non-zero verdict (rule canon: setup Phase 4's "List
exhaustively") — stop and ask the user rather than sweeping on: a truncated sweep
would report a subset of PROCESSING programs as "all" of them.
(To count one captured page by hand later, the shipped
`node .gs-superadmin/plugin/scripts/er-count.mjs <page.json>` prints its entry count
without reading the payload into context.)

**If the sweep fails** (auth expired, network down): stop and ask the user — continue
with KB-cached statuses (the report's freshness line and caveats will say so) or abort.
Never continue silently; audit-active in particular is status-derived.

### 3 — Build the index

Repeat the `--live-list` flag once per page file from step 2 (`er-plist-1.json` through
the last page fetched):

```
node .gs-superadmin/plugin/scripts/jo-report.mjs index --kb <slug> --live-list .gs-superadmin/tmp/er-plist-<N>.json --out .gs-superadmin/tmp/er-index.json
```

Read only the stdout summary (counts, gap samples, warnings). The index file runs
~100 MB at real scale — **never read it**. If the summary warns the live overlay was
skipped (pages parsed to zero entries), treat that as a step-2 sweep failure: same ask.

### 4 — Budgeted gap-fill

**4a — measure the gap.** The TTL argument is the workspace's **Journeys freshness TTL
in days** from the operating model's TTL table (default `14` if the workspace hasn't
tuned it). Run the shipped gap work-list builder — it reads the step-3 index
(`.gs-superadmin/tmp/er-index.json`) plus the manifest, and its own header documents
the shapes it rides on:

```
node .gs-superadmin/plugin/scripts/er-gaps.mjs <slug>/_manifest.json <ttl-days>
```

Read only the one-line summary JSON it prints: the recorded `idFields` (used by 4c's
substitutions), the per-category counts (`stalePrograms`, `stubPrograms`,
`liveOnlyPrograms`, `missingTemplates`, `tokenlessTemplates`,
`tokenlessOrphanDocs`), and `total` (4b's decision input; orphan docs are excluded
from it by design — they are a step-7 caveat, not work). The work lists land on disk
next to the index — `er-gap-stale.json`, `er-gap-liveonly.json`,
`er-gap-templates.json`, `er-gap-tokenless.json`, `er-gap-tokenless-orphans.json` —
already in the exact shapes and order 4c's commands consume, so the budget cut
happens on disk via `--limit` (file order), never through model context. A non-zero
exit (unreadable index or manifest) means 4a did NOT run: fix what it names — it
must never be read as "no gaps".

**4b — decide the budget** (Bradley-confirmed UX, S4 2026-07-15):

- `--budget N` passed → use it silently (`0` → skip to step 5).
- Otherwise, if `total` ≤ 50 → fill everything, no question.
- Otherwise ask the user (AskUserQuestion): **Full** (~`total` sequential calls),
  **Partial** (first 50 — priority: stale + stub programs first, then missing
  templates, then token-metadata backfill), or **Skip gap-fill**.
- `tokenlessTemplates` (ER-15) is the LOWEST priority: those docs already hold
  subject/body — re-describing only adds token display names. Never run a mass
  re-fetch for it outside this budgeted flow; until backfilled, reports resolve
  program-side bindings and carry a "predate token metadata" caveat.

**4c — fill, programs first, through the sanctioned batch loop** (sequential,
doc-per-asset, marks as each doc lands — an interruption never loses more than one
asset). Split the budget: program budget = min(budget, stalePrograms + stubPrograms +
liveOnlyPrograms); template budget = the remainder. Then spend it in this order,
skipping any empty category. `<journey-domain>` and `<templates-domain>` below are the workspace's RECORDED names for
`jo programs list` and `jo email templates` — read them from the 4a summary's `domains`
field (`domains.journey`, `domains.templates`); on a workspace built by the naming rule
they are `journey` and `journey-email-templates`, but a workspace that recorded other
names uses those. Substitute them in EVERY line below: a `--partial` registration passes
no recording flag, so `upsert-batch`'s renamed-domain refusal cannot catch a wrong
literal here and the inventory would fork under a second key prefix in silence (the
F-429 class; release-gate review of 0.37.0):

1. Register liveOnly programs (not yet in the manifest; use the `journey` idField the
   4a summary printed). `--partial` on both registrations in this step: a gap list is a
   deliberate subset, so it must not raise the under-pagination warning or refresh the
   domain's list-coverage stamp:
   ```
   node .gs-superadmin/plugin/scripts/manifest.mjs upsert-batch --manifest <slug>/_manifest.json --domain <journey-domain> --file .gs-superadmin/tmp/er-gap-liveonly.json --id-field <journey idField> --name-field name --partial
   ```
2. Mark TTL-stale programs stale so the batch selects them — the first
   `<program-budget>` keys of `er-gap-stale.json` (already oldest-first; `--limit`
   cuts in file order), where `<program-budget>` is the program share computed
   above. (Each budget placeholder below names the quantity it means — never carry
   one item's number into another.) One call, shell-neutral — the key list stays
   on disk. The mark is all-or-nothing: a `no inventory entry` failure means the
   index and the manifest disagree — re-run step 3 rather than editing the list:
   ```
   node .gs-superadmin/plugin/scripts/manifest.mjs mark --manifest <slug>/_manifest.json --keys-file .gs-superadmin/tmp/er-gap-stale.json --status stale --limit <program-budget>
   ```
3. Describe stale + liveOnly (pending) programs — compact program docs, auto:
   ```
   node .gs-superadmin/plugin/scripts/describe-batch.mjs --manifest <slug>/_manifest.json --domain <journey-domain> --command "gs-admin --json jo p describe --id {id} --no-cache" --out-dir <slug>/<journey-domain> --limit <program-budget>
   ```
4. Upgrade stub programs (same command plus `--upgrade`, remaining program budget).
5. Missing referenced templates — register, then fetch (compact template docs, auto):
   ```
   node .gs-superadmin/plugin/scripts/manifest.mjs upsert-batch --manifest <slug>/_manifest.json --domain <templates-domain> --file .gs-superadmin/tmp/er-gap-templates.json --id-field <journey-email-templates idField> --partial
   node .gs-superadmin/plugin/scripts/describe-batch.mjs --manifest <slug>/_manifest.json --domain <templates-domain> --command "gs-admin --json jo email template --id {id}" --out-dir <slug>/<templates-domain> --limit <template-budget>
   ```
6. Token-metadata backfill (ER-15, last priority) — template docs predating
   token persistence (`er-gap-tokenless.json`): mark the first `<remaining-budget>`
   (what is left of the template budget after item 5) stale so the batch re-describes
   them — the re-render adds the `## Tokens` section. The 4a helper already joined
   this list against the manifest, so a `no inventory entry` failure here means the
   manifest changed since 4a ran — re-run 4a (not step 3) and retry once. If the 4a
   summary reported `tokenlessOrphanDocs` > 0, those docs have no manifest entry
   (rekey cleanup or list-invisible recovery docs); they are excluded from this
   batch by design — report the count as a step-7 caveat instead of retrying:
   ```
   node .gs-superadmin/plugin/scripts/manifest.mjs mark --manifest <slug>/_manifest.json --keys-file .gs-superadmin/tmp/er-gap-tokenless.json --status stale --limit <remaining-budget>
   node .gs-superadmin/plugin/scripts/describe-batch.mjs --manifest <slug>/_manifest.json --domain <templates-domain> --command "gs-admin --json jo email template --id {id}" --out-dir <slug>/<templates-domain> --limit <remaining-budget>
   ```

Read each batch's stdout summary only. A batch may also pick up entries already
pending/stale/failed from earlier sessions — that's correct, they're gaps too. Failed
entries stay marked `failed` in the manifest; report them in step 7, don't retry in-run.

**4d — re-index**: repeat step 3 verbatim (same `--live-list` files, same `--out`).
Skip only if nothing was fetched.

### 5 — Run the mode

**deps mode — field aliasing.** The report script reads the tenant's
field-aliasing convention from the workspace's `.gs-superadmin/CONVENTIONS.md`
itself (missing or malformed → exact-only matching with a caveat in the report
— it never infers a pattern from tenant data; an empty `--alias-prefix ''`
disables aliasing outright); pass `--alias-prefix '<regex>'`
only when the user supplied an explicit override, and carry the report's
conventions caveat into step 7.

**deps mode only — pass the KB directory.** Append `--kb <slug>` (the same slug
directory step 3 indexed) so the report can resolve participant-source
provenance: Data Designer sources resolve to their KB docs (asset name,
description, matched columns tied to the DD's field dictionary), CSV sources
show their uploaded filename, and Power Lists render as honestly not
resolvable. Running from the workspace root the script can also derive the KB
dir from the index slug, but pass the flag anyway — explicit beats derived. If
the report caveats that a Data Designer's KB doc is missing, the caveat names
the exact fetch commands; offer them to the user as a follow-up, don't run
them unprompted mid-report.

**deps mode only — capture live dependents first.** `--object` matching in the KB scan
is filter-conditions-only; the live capture supplies the mapping/SELECT-side usage
(usually the dominant kind). For each `--object` term, sequentially:

```
node .gs-superadmin/plugin/scripts/capture.mjs --wait --out .gs-superadmin/tmp/er-deps-<n>.json -- gs-admin --json dm deps check --name '<object>' --areas JOURNEY_ORCHESTRATOR
```

`<n>` is the 1-based position of the `--object` term (first term -> `er-deps-1.json`,
second -> `er-deps-2.json`, ...) — a naming convenience only. The report script
identifies each capture from its own payload (`data.objectName`), never from flag
position, so `--live-deps` order affects only the display order of the "Live
dependents" sections, and a capture that never completed can simply be omitted without
misassigning the rest.

The check is **async**; `--wait` owns the poll (up to 2 min per object) and writes the
capture only once the scan reports COMPLETED — on a non-zero "not ready after N s"
exit, proceed without that capture and tell the user it didn't complete. Then append
`--live-deps .gs-superadmin/tmp/er-deps-<n>.json` (one per
object) to the mode flags below — the report renders a "Live dependents" section per
object, reconciled against the KB scan.

Substitute `<mode flags>` with the user's mode flags from the Arguments table. When the
user asked for `--csv` or `--xlsx` (and only then), also append
`--csv-dir <slug>/reports-adhoc/<mode>-<YYYY-MM-DD>-csv`:

```
node .gs-superadmin/plugin/scripts/jo-report.mjs <mode> --index .gs-superadmin/tmp/er-index.json <mode flags> --report <slug>/reports-adhoc
```

- `--report` takes the **directory**; the script names the file
  `<mode>-<YYYY-MM-DD>[-N].md` and never overwrites.
- Read the stdout summary JSON. **program mode:** if `ambiguities[]` is non-empty, show
  the user each query's candidates (id, name, status) and re-run with the chosen
  `--name '<id>'` — never guess.
- Every report carries a mandatory "Caveats & data gaps" section — read it in the
  finished report and carry the trust-relevant ones into step 7.

### 6 — Workbook (only with `--xlsx`)

Convert the CSVs in the csv-dir into **one** workbook at
`<slug>/reports-adhoc/<mode>-<YYYY-MM-DD>.xlsx` — one sheet per CSV, sheet name = file
name minus `.csv` — using the xlsx skill. If the xlsx skill is unavailable in this
session, deliver the CSVs and say so; never hand-roll a workbook writer.
The CSVs start with a UTF-8 BOM (deliberate — Excel needs it): read them with a
BOM-aware decode (`utf-8-sig` in Python) or strip a leading BOM before parsing, so the
first column header never enters the workbook BOM-prefixed.

### 7 — Final report

```
✓ gs-superadmin email-report (<mode>) complete
  Statuses: <live sweep, N programs (<sweep date>) | KB-cached (sweep declined/failed)>
  Gap-fill: X of Y gap fetches done (budget B) · F failed
  Report:   <slug>/reports-adhoc/<mode>-<date>.md (+ CSVs / .xlsx where written)
  Caveats:  N — <the one or two that most affect trust in this report>
  Re-run:   <the re-run command from the report footer>
```

Report, then stop — no follow-on actions without being asked.
