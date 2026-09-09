---
description: Read-only tenant-wide dependency search over the KB — given objects, fields, and/or external connections (Salesforce, S3, Snowflake, …), report every documented asset that depends on them (rules, journey programs, reports, connector jobs, data designers, scorecards) with the dependency kind and asset status. Use when asked "what breaks if I change object/field X", "what uses this connection", "impact analysis before a schema change", or "which rules/reports/journeys depend on Y". Writes a markdown report, optionally CSVs/XLSX. Never mutates the tenant.
argument-hint: "[--object o]… [--field f]… [--connection c]… [--alias-prefix re] [--no-live] [--csv] [--xlsx] [--slug name]"
# model-invocable by design (email-report precedent — Bradley, S4 2026-07-15; applied to S6)
---

# /gs-superadmin:deps-report

One read-only report answering the tenant-wide impact question — "what exactly depends
on this object / field / external connection, and how?" — from the KB docs on disk,
optionally corroborated by live `dm deps check` captures. The tenant-wide superset of
`/gs-superadmin:email-report deps`, which stays scoped to JO participant sources.

Covered domains (all KB-parsed, no live calls needed): Rules Engine (source objects,
filter conditions, write targets, action-mapping connections, External Action
callouts), Journey programs
(participant-source mappings/conditions — the email-report parsers), Reports (source
object + connection, show/group/order fields, where/having filters), Connector jobs
(connection, target object, per-field mappings), Data designers + journey datasets, and
Scorecards (measures set by matching rules' scoring actions).

## Ground rules (restated from the build plan — non-negotiable)

- **Read-only tenant.** Every `gs-admin` command this skill issues is catalogued
  non-mutating (`whoami`, `dm deps check`). The scan itself reads only KB markdown.
- **Sequential `gs-admin` calls only** — parallel calls trip the CLI's token-refresh race.
- **Single-quote every name/filter value** — Gainsight names contain `|` and spaces.
- **Bulk JSON never enters model context.** `dm deps check` captures go to files under
  `.gs-superadmin/tmp/`; you read only script stdout summaries and finished reports.
  Run the report script through the Bash tool: capturing stdout in Windows PowerShell
  5.1 decodes it via the OEM console codepage and silently mangles non-ASCII asset
  names in the summary (warnings, row samples) — no error is raised.
- **Confirmed data only.** The report's status columns are KB-cached — never upgrade
  them to "live" wording; the freshness line and caveats say exactly what they are.

## Arguments

Terms (repeatable; **at least one of the three kinds required** — if none can be read
from the ask, ask the user before doing anything):

- `--object <o>` — object system name or label (e.g. `company_person`, `Company Person`)
- `--field <f>` — field system name or label (aliases and mapping columns also match)
- `--connection <c>` — external connection **name, id, or type** (e.g. a connection's
  display name, its GUID, or `SNOWFLAKE`); the KB's connector docs resolve any spelling
  to the same assets. MDA / GAINSIGHT_API are the internal platform — passing them
  works but the report will say they're not external connections. An **External
  Action** (name or configId) is also a valid term here (F-217): the KB's
  `rules-engine-external-actions` docs resolve it, and the report lists every rule
  calling it (usage `external action callout`) — the same rows a term naming the REST
  connection those callouts ride on will surface.

Matching is case-insensitive **exact** (system name OR label — no substring), the same
rule as email-report's deps mode. When the workspace declares a field-aliasing
convention, field terms ALSO match candidate names whose leading task-alias
prefix (per that convention's regex) strips away, with space/underscore as equivalent
separators — still exact, never substring; the report header names the pattern in use
and the full prefixed names stay in the output.

- `--alias-prefix <regex>` — an explicit override only: the report script reads the
  tenant's field-aliasing convention from the workspace's `.gs-superadmin/CONVENTIONS.md`
  itself (missing or malformed → exact-only matching with a caveat in the report — it
  never infers a pattern from tenant data; an empty value `''` disables aliasing
  outright). Carry the report's conventions caveat into step 5.

Skill-level flags (handled by these steps, not passed to the script):

- `--no-live` — skip the `dm deps check` captures (KB-only report)
- `--csv` — also write the per-domain CSVs
- `--xlsx` — convert those CSVs into one workbook (implies `--csv`)
- `--slug <name>` — override the derived slug

---

## Steps

### 1 — Identify instance

Same as `/gs-superadmin:refresh` step 1: run `gs-admin whoami`, derive the slug from
`*/_manifest.json` (or `--slug`). If no workspace manifest exists, tell the user to run
`/gs-superadmin:setup` first and stop.

**Token pre-flight (F-221):** step 2's live captures run as one sequential batch and
`--wait` can hold up to 2 minutes per object — check `whoami`'s remaining token life
first and have the user re-run `gs-admin login` if the USABLE life (far less than the
number printed, per the known half-life defect) won't cover the batch (rule canon:
setup Phase 1).

### 2 — Capture live dependents (skip with `--no-live` or when no `--object` terms)

The KB scan sees only what describe payloads record; Gainsight's own dependency scan is
the object-level truth across ALL areas (including ones the KB does not document). For
each `--object` term, sequentially:

Capture through the shipped capture helper — clean UTF-8, no BOM, any shell; never a
bare shell redirect (rule canon: setup Phase 4). An ill-encoded capture is one the
report script's `JSON.parse` rejects: it is then reported as skipped, silently
dropping the report's "Live dependents" section.

```
node .gs-superadmin/plugin/scripts/capture.mjs --wait --out .gs-superadmin/tmp/td-deps-<n>.json -- gs-admin --json dm deps check --name '<object>'
```

`<n>` is the 1-based position of the `--object` term (first term → `td-deps-1.json`,
second → `td-deps-2.json`, …) — a naming convenience only. The report script identifies
each capture from its own payload (`data.objectName`), never from flag position, so
`--live-deps` order affects only the display order of the "Live dependents" sections,
and a capture that never completed can simply be omitted without misassigning the rest.

The check is **async**; `--wait` owns the poll (up to 2 min per object) and writes the
capture only once the scan reports COMPLETED — on a non-zero "not ready after N s"
exit, proceed without that capture and tell the user it didn't complete. If the very
first call fails (auth expired, network down), proceed
KB-only and say so in step 5 — the report's caveats already carry the corroboration
command for the user to run later.

### 3 — Run the scan

Write the user's terms to a scratch work list — `.gs-superadmin/tmp/td-terms.json` —
using a file-writing tool, never a shell echo, and pass it as `--terms-file`
(shell-neutral by design: names carrying `|`, spaces, or quotes never touch shell
quoting, and the script refuses a malformed or mis-keyed file loudly instead of
narrowing the scan). The file is one JSON object with up to three keys — `objects`,
`fields`, `connections` — where each `--object` term the user gave becomes one string
in `objects` (verbatim, in the user's order), each `--field` term one string in
`fields`, each `--connection` term one string in `connections`, and a kind with no
terms omits its key entirely. Two objects and one field, no connections →

```
{"objects": ["Company Person", "renewal_summary"], "fields": ["ARR"]}
```

After the `--terms-file` flag, append
`--alias-prefix '<regex>'` only
when the user supplied one (the script reads the workspace convention itself), then one
`--live-deps .gs-superadmin/tmp/td-deps-<n>.json` per completed step-2 capture (any
order — the report keys each file by its payload's `objectName`; step 2's numbering is
a naming convenience only). When the user asked for `--csv` or `--xlsx` (and only
then), also
append `--csv-dir <slug>/reports-adhoc/tenant-deps-<YYYY-MM-DD>-csv`:

```
node .gs-superadmin/plugin/scripts/tenant-deps.mjs --kb <slug> --terms-file .gs-superadmin/tmp/td-terms.json --report <slug>/reports-adhoc
```

- `--report` takes the **directory**; the script names the file
  `tenant-deps-<YYYY-MM-DD>[-N].md` and never overwrites.
- Read the stdout summary JSON only (per-domain scanned/matched/row counts, warnings).
- Every report carries a mandatory "Caveats & data gaps" section — read it in the
  finished report and carry the trust-relevant ones into step 5. If the freshness line
  shows stale capture dates, recommend `/gs-superadmin:refresh` (or a deep crawl of the
  stale domains) and offer to re-run after.
- Data designers match `--field` terms by system name only where their KB doc carries
  the per-field drilldown (setup's designer doc-mode; `references/document-domain-notes.md`
  in the setup skill is the canon). A "carry no system field name" caveat breaks the
  blind rows down by reason — summary-only doc (re-run setup on the domain to upgrade),
  a failed or not-yet-run drilldown (re-invoke the batch), a duplicate label, an unparsed
  join field list, a label-only column — and a label spelling still matches those rows;
  relay the reason, never a bare count.

### 4 — Workbook (only with `--xlsx`)

Convert the CSVs in the csv-dir into **one** workbook at
`<slug>/reports-adhoc/tenant-deps-<YYYY-MM-DD>.xlsx` — one sheet per CSV, sheet name =
file name minus `.csv` — using the xlsx skill. If the xlsx skill is unavailable in this
session, deliver the CSVs and say so; never hand-roll a workbook writer.
The CSVs start with a UTF-8 BOM (deliberate — Excel needs it): read them with a
BOM-aware decode (`utf-8-sig` in Python) or strip a leading BOM before parsing, so the
first column header never enters the workbook BOM-prefixed.

### 5 — Final report

```
✓ gs-superadmin deps-report complete
  Terms:     <the object/field/connection terms as matched>
  Matches:   <per-domain "N assets / M rows" from the summary JSON, non-zero domains only>
  Live:      <K of L dm-deps-check captures completed | skipped (--no-live) | unavailable>
  Report:    <slug>/reports-adhoc/tenant-deps-<date>.md (+ CSVs / .xlsx where written)
  Caveats:   N — <the one or two that most affect trust in this report>
  Re-run:    <the re-run command from the report footer>
```

Report, then stop — no follow-on actions without being asked.
