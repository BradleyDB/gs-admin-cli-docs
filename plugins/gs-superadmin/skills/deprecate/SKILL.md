---
description: Walk a Gainsight asset through the workspace's deprecation checklist — rename, description prefix, folder move, unschedule — applying what the CLI supports and listing the manual UI steps.
disable-model-invocation: true
argument-hint: "<name-or-id> [--domain rules|data-designer|reports] [--ticket REF] [--slug name]"
---

# /gs-superadmin:deprecate

Deprecate an asset per this workspace's deprecation process (default source:
`.gs-superadmin/conventions/deprecation.md`; fall back to any deprecation guidance in
`.gs-superadmin/CONVENTIONS.md`). If neither defines a process, tell the user and stop —
never invent a deprecation convention.

## Arguments

- `<name-or-id>` — the asset to deprecate (required)
- `--domain <d>` — `rules` (default), `data-designer`, or `reports`
- `--ticket REF` — ticket reference for the description prefix (e.g. `GAIN-1247`); if
  omitted, ask the user (the process requires one)
- `--slug <name>` — override the derived slug

---

## Steps

### 1 — Identify instance and load the process

Same slug resolution as `/gs-superadmin:refresh` step 1 (`gs-admin whoami` +
`*/_manifest.json`). Load the deprecation process file and extract: the rename prefix
format (e.g. `D.MM.DD.YYYY `), the description prefix format (e.g.
`Deactivated [ticket]`), and the target folder name per domain.

### 2 — Resolve the asset

Resolve name → id from the KB manifest first. **Never trust a single page** — list
endpoints are paginated (`re r list` defaults to 20 rows, `rp list` to 25), so on a
full-size tenant a one-page dump silently misses almost every asset; every live list
below runs through the capture helper's paginate mode, which owns the page loop and the
short-page/total reconciliation (canon: setup Phase 4 "List exhaustively"). Asset names
carry `|`, `&`, and other shell metacharacters: single-quote them in every shell command,
and match them as literal strings (fixed-string mode), never as regex patterns.

Given an **id** instead of a name, skip the name matching entirely: confirm it directly
with the domain describe (rules: `re r describe --id <id>`) — the manifest keys are
`<domain>/<id>` if you want the KB entry too.

1. **KB manifest (primary).** Grep `<slug>/_manifest.json` `inventory{}` for the name —
   keys are `<domain>/<id>` and each entry carries `name`. The manifest is pretty-printed,
   so a bare grep for the name returns only the `"name": …` line, which contains no id —
   grep with context: `grep -F -B2 '<name>' <slug>/_manifest.json` (the `"<domain>/<id>":`
   key line sits exactly 2 lines above `"name"`; run greps with the Bash tool — `grep` is
   not a PowerShell command). The key's prefix is whatever domain name the workspace
   recorded for that asset's list command — `rules-engine/` for `--domain rules` and
   `report/` for `reports` under setup's naming rule, but older workspaces carry other
   spellings (`report-reports/`); the name grep finds the key whatever the prefix, and
   `report`'s `byDomain` lists the names in use (F-429).
2. **Live search (fallback if not in the KB — e.g. the asset postdates the last refresh).**
   - Rules: `node .gs-superadmin/plugin/scripts/capture.mjs --paginate --page-flag page --out .gs-superadmin/tmp/deprecate-list-{page}.json -- gs-admin --json re r list --search '<name>' --limit 200`
     (`--search` is a server-side partial name match; the paginate mode exhausts the
     pages, so a name with more matches than one page holds is never truncated —
     `{page}` is literal, the script substitutes it, one file per page; read every
     page file). The capture helper writes the files as clean UTF-8 with no BOM on any
     shell — never capture with a bare shell redirect (rule canon: setup Phase 4).
   - Reports: no name filter on `rp list` — sweep the whole list through the same
     paginate mode, stating the rows path (the envelope carries a root `alerts` block
     beside the rows; canon: setup Phase 4):
     `node .gs-superadmin/plugin/scripts/capture.mjs --paginate --page-flag page --items-path data.data --out .gs-superadmin/tmp/deprecate-reports-{page}.json -- gs-admin --json rp list --limit 200`
     then match the name against every page file locally. The sweep's verdict decides
     what the pages prove (canon: setup Phase 4): `reconciled` is the complete list;
     `unverified` (also exit 0 — no payload total) is the CLI-reachable set, and its
     disclaimer travels with the answer; a non-zero verdict proves nothing — never a
     "no match".
   - Data Designer: designs are not indexed in the KB (the `data-designer/` inventory
     holds Design *Templates*, a different asset) and have no live list command — and no
     describe command either, so the CLI cannot read a design's current state at all.
     Ask the user for the design id **and its current name, description, and schedule as
     shown in the UI**: those user-supplied values are the only possible source for the
     already-deprecated guard and step 3's Current column.

Exactly one match → continue. Multiple → show them and ask the user which one — the
manifest grep and `--search` both match substrings, so a longer name containing yours
(or the asset's own already-deprecated `D.`-prefixed copy) also hits; trust a match only
when its `name` equals the requested name exactly — or equals it after stripping a
leading date-shaped rename prefix (e.g. `D.07.22.2026 ` or `D.07.22.26 ` — both year
widths occur live), which is the already-deprecated
case: resolve to that asset and let the guard below report it, rather than discarding the
row and claiming no match. None (KB and live) → report and stop.

Then describe it (rules: `gs-admin --json re r describe --id <id>`; reports:
`gs-admin --json rp describe --id <id>` — shapes below), captured to a tmp file via the
capture helper (step 2's invocation shape; `<tmp-file>` is
`.gs-superadmin/tmp/deprecate-describe-<id>.json`, one file per described asset, distinct
from step 2's `deprecate-list-{page}.json` sweep, and a single-shot capture, no
`--paginate`: `--out <tmp-file>`, command after `--`), to
capture the current name, description, folder, and schedule state, and confirm the
KB-resolved id is live. Data Designer: skip — there is no describe surface; the
user-supplied UI values from above stand in for this capture, and the plan must say the
id could not be confirmed live.

**Already-deprecated guard** — run it on the live name from that describe (rules:
`ruleName`; Data Designer: the user-supplied current UI name, the only name available),
never the KB name, which may predate a rename: if the live name starts with
a date-shaped instance of the rename prefix — for `D.MM.DD.YYYY ` match the digits
pattern with the year as **two or four digits** (`D.\d{2}\.\d{2}\.(\d{4}|\d{2}) `, e.g.
`D.07.01.2026 ` or `D.07.01.26 `; live tenants mostly deprecate with the two-digit form
even where the documented format shows four), never the literal placeholder string —
the asset is already deprecated. Report that and ask the user how to proceed instead of
proposing a second prefix.

JSON shapes, so you don't spend calls probing (`--json` envelope):
- `re r list` rows are `data.data[]`, keyed `ruleId` / `ruleName` (not `id`/`name`).
- `re r describe` returns `data.ruleDetails`: `ruleName` (NOT `name` — same trap as list;
  there is no `name` key, though `id` is present here alongside `ruleId`), `description`,
  `active`, a numeric
  `folderId` (resolve to a folder name via `re r folders list`), and `nextScheduledRun` —
  capture it now (an epoch-ms number when set, else null). Non-null proves a pending
  future run; **null does not prove no schedule** — step 4's search decides.
- `rp list` rows are `data.data[]`, keyed `reportId` / `reportName` (plus
  `reportDescription`; **no folder key of any kind**). `data.pageInfo` carries
  `totalRecords` and `pageSize` — note `pageSize`, not `limit`.
- `rp describe` returns `data` keyed `reportId` / `reportName` / `reportDescription`
  (the only description-shaped key), alongside the definition fields (`sourceDetails`,
  `showFields`, `groupByFields`, …). Live-verified 2026-07-25.

### 3 — Present the plan and get approval

Show the user exactly what will change, e.g. for a rule deprecated on 2026-07-01 with
ticket GAIN-1247:

| Field | Current | After |
|---|---|---|
| Name | `DATA\|USER\|MODIFY Assign License` | `D.07.01.2026 DATA\|USER\|MODIFY Assign License` |
| Description | `…` | `Deactivated GAIN-1247 — …` |
| Folder | `CTAs` | `Deactivated Rules Pending Delete` |
| Schedule | pending run (`nextScheduledRun` 1785360300000) | removed |

(The Description row follows step 4's joining rule: when the old description is empty,
the After value is just `Deactivated GAIN-1247` — no trailing ` — `. The Schedule row
renders what step 2 captured: the `nextScheduledRun` value when non-null, as shown;
when null — the live norm even for scheduled rules — render
`none pending (null); step 4's search decides` with After `removed if step 4 finds
one`, since the schedule search runs only after this plan is approved.)

> ⚠️ Since CLI 1.0.8 `re r edit` and `re r delete-schedule` are catalog-mutating — expect
> a guard prompt per command when the plan executes. Those prompts confirm each command;
> the user's explicit approval of this plan is the gate. **Stop and wait for it.**

Before applying — rules domain only — verify the target folder exists
(`gs-admin --json re r folders list`). There is no CLI folder creation — if it's
missing, ask the user to create it in the UI first (or approve proceeding without the
folder move). Skip this check for reports and Data Designer: their folder moves are
UI-only manual steps (step 5), and `re r folders list` is the rules-engine namespace.

### 4 — Apply (per domain)

Description template: the ` — <old description>` half (em-dash separator included) is
appended **only when the old description is non-empty** after trimming whitespace. An
undocumented asset gets just `Deactivated <ticket>` — never a dangling `Deactivated
<ticket> — `. (The separator is this skill's joining convention, not part of the process
file's prefix format.) Build step 3's plan table the same way.

**Rules** (fullest CLI support):
1. If step 2's describe showed a non-null `nextScheduledRun` — or the rule appears in
   the SCHEDULE-filtered list, swept through the paginate mode (canon: setup Phase 4 —
   the mode exhausts the pages, so a full page is never where the evidence ends):
   `node .gs-superadmin/plugin/scripts/capture.mjs --paginate --page-flag page --out .gs-superadmin/tmp/deprecate-schedule-{page}.json -- gs-admin --json re r list --search '<name>' --filter-execution-type SCHEDULE --limit 200`
   with a returned row (any page file) whose **`ruleId` equals `<id>`** — run
   `gs-admin re r delete-schedule --id <id>`. This search is the **primary** detection
   path, not an edge case: `nextScheduledRun` means "a future run is pending", not "a
   schedule object exists" (measured live 2026-07-25: null on all 67 SCHEDULE-type rules
   of one tenant, 32 of them active). The catalog DOES carry two schedule read commands —
   `re r schedules --id` (the schedules configured on a rule) and `re r test-schedule` (a
   CRON preview) — but `re r schedules` returned an EMPTY list for every rule tested at CLI
   1.0.9, including active SCHEDULE-type rules (measured on one tenant; a tenant whose rules
   carry individual non-chain schedules may differ), so the filter is the read surface that
   actually answers the question. `--search` matches substrings — ignore
   rows whose `ruleId` differs — and only a sweep that ends `reconciled` (or `unverified`
   with its disclaimer carried, per the canon; `re r list` carries a total, so expect
   `reconciled`) has searched every page; a non-zero verdict has not proved the rule
   unscheduled.
2. `gs-admin re r edit --id <id> --new-name 'D.MM.DD.YYYY <old name>' --description 'Deactivated <ticket> — <old description>' --folder-name '<target folder>'`

**Reports** (UI-only — kept manual for a FOLDER reason, not a merge reason): do **not**
use `rp update` for deprecation. It PUTs a whole GSReportMaster body, but the old fear
is retired: its fetch-then-merge is verified live (1.0.7, throwaway report — a name-only
call preserved 25 of 27 top-level fields byte-identical; before CLI 1.0.6 the required
`--object`/`--show-fields` meant omitted fields reset to defaults, which no longer
occurs at this pin). What keeps reports on the manual list is the folder: the PUT body
drops the report's folder id, and the folder is invisible to the CLI in both directions
(`rp describe` returns no folder field; no `rp list` row carries one), so an edit that
silently re-foldered the report could not be detected from the CLI — and deprecation
moves reports between folders by design. Rename, description prefix, folder move, and
Set-to-Private all go on step 5's manual list until the folder behavior is verified in
the UI. `rp describe --id` (read-only) remains
the capture path for the plan table and the already-deprecated check.

**Data Designer** (no CLI support for rename/unschedule): print the process checklist for
the user to execute in the UI; nothing to apply.

### 5 — Manual steps (always print)

End with the checklist of what the CLI cannot do, drawn from the process file, e.g.:
- Remove the rule from its Rule Chain (UI)
- **Deactivate the rule** (UI — no CLI verb)
- Rename the report (`D.MM.DD.YYYY ` prefix) and prefix its description (UI — the
  report's folder is CLI-invisible; see step 4's Reports note)
- Remove the report from dashboards / 360 layouts; set report to Private (UI)
- Diary note: after the retention period (e.g. 3 months), delete and purge from trash

### 6 — Update the KB

Mark the manifest entry stale so the KB reflects the deprecation:
```
node .gs-superadmin/plugin/scripts/manifest.mjs mark --manifest <slug>/_manifest.json --key <domain>/<id> --status stale
```
(Rules and reports only — Data Designer designs have no inventory entry to mark. Also
skip this when the asset was resolved via live search only, i.e. step 2 found no KB
entry: there is no manifest key to mark.)

Report what was applied, what remains manual, and the retention date.
