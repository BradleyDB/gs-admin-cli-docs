---
description: Audit Gainsight asset names against the workspace naming conventions and (with explicit approval) apply renames.
disable-model-invocation: true
argument-hint: "[--domain rules|reports|scorecards|all] [--syntax|--deep] [--folder name] [--budget N] [--slug name]"
---

# /gs-superadmin:audit

Check asset names against this workspace's naming conventions, report violations with
proposed fixes, and — only after explicit user approval — apply renames via the CLI.

## Arguments

- `--domain <d>` — what to audit: `rules` (default), `reports`, `scorecards`, or `all`
- `--syntax` — quick mode: validate names against the convention pattern only
- `--deep` — thorough mode: also describe flagged rules and propose complete conforming names
- `--folder <name>` — limit the audit to assets in one folder (where the list output has folder info)
- `--budget N` — max describe calls in deep mode (default: 25)
- `--slug <name>` — override the derived slug

---

## Steps

### 1 — Identify instance

Same as `/gs-superadmin:refresh` step 1: run `gs-admin whoami`, derive the slug from
`*/_manifest.json` (or `--slug`). If no workspace manifest exists, tell the user to run
`/gs-superadmin:setup` first and stop.

### 2 — Load the naming convention

Read, in order of preference:
1. `.gs-superadmin/conventions/naming.md` (adopted build-standards pack)
2. The **Naming** section of `.gs-superadmin/CONVENTIONS.md` — but only if it has been
   filled in; ignore content still marked as placeholder/example formats.

If neither defines a real convention, tell the user: "No naming convention is defined for
this workspace — edit `.gs-superadmin/CONVENTIONS.md` (or re-run `/gs-superadmin:setup` and
adopt the bundled standards pack) and re-run." **Stop.** Never audit against a convention
the org has not adopted.

Also read `.gs-superadmin/conventions/deprecation.md` if it exists, for the deprecation
rename prefix format used by step 4's exemption rule. If it does not exist, the workspace
has no deprecation prefix — apply only the exemptions the naming convention itself defines.

**Then check coverage per domain, not once for the workspace.** A convention file governs
specific asset types: the bundled pack's `naming.md`, for example, defines organization and
syntax under a `## Rules` heading and says nothing about scorecards. For each domain
`--domain` selected (`rules`, `reports`, `scorecards`), decide whether the loaded
convention actually states a naming rule for **that** domain:

- Governed → audit it in step 4.
- Not governed → **skip it and say so.** Do not evaluate its names against another
  domain's syntax, do not flag them, and do not propose names for them. Record it as
  `<domain>: skipped — no naming convention defined` in both the step 5 report and the
  step 7 summary.
- A convention that **explicitly exempts** a domain — e.g. the bundled pack's statement
  that reports are user-facing and deliberately carry no admin naming pattern — counts
  as *not governed* here: skip it with the same note. The skip **is** how the exemption
  is honored; do not audit the domain against an empty rule set.

If every selected domain is ungoverned, tell the user which domains were requested and that
the convention covers none of them, and stop.

### 3 — Choose depth

If neither `--syntax` nor `--deep` was passed, ask the user:
- **Syntax check** — validate each name against the convention's pattern (segment count,
  known Rule Type keywords, recognized prefixes). Fast, list calls only, no proposals
  beyond the obvious.
- **Deep audit** — additionally fetch each flagged rule's definition and infer the correct
  `Type|Sub-Type|Operation` segments from its actual actions, proposing a complete
  conforming name. Slower; respects `--budget` (default 25 describes per run).

### 4 — Fetch and evaluate

Audit only the domains step 2 marked as governed. For each of those, run the list command
with `--json`, captured **to a file** through the shipped capture helper (bulk payloads
never enter context; the helper writes clean UTF-8 — no BOM — on any shell; never a
bare shell redirect. Rule canon: setup Phase 4):
```
node .gs-superadmin/plugin/scripts/capture.mjs --paginate --page-flag page --out .gs-superadmin/tmp/audit-rules-{page}.json -- gs-admin --json re r list --limit 200
node .gs-superadmin/plugin/scripts/capture.mjs --paginate --page-flag page --items-path data.data --out .gs-superadmin/tmp/audit-reports-{page}.json -- gs-admin --json rp list --limit 200
node .gs-superadmin/plugin/scripts/capture.mjs --paginate --page-flag none --out .gs-superadmin/tmp/audit-scorecards.json -- gs-admin --json sc list --limit 10000
```

**Page each domain to exhaustion — a single default call is never the inventory.** The
CLI truncates silently and with no warning (`re r list` defaults to `--limit 20`,
`rp list` to `--limit 25` — a bare call checks the first 20–25 assets while step 7
reports the result as domain coverage). The paginate mode above owns the page loop and
the short-page/total reconciliation and prints a verdict per sweep (rule canon: setup
Phase 4's "List exhaustively"; `{page}` is literal — the script substitutes it, one
file per page; keep every page file for the scan script below). Exit 0 = `reconciled`,
or `unverified` — no payload total exists (the scorecard family on an older CLI): treat
that count as complete only after a larger-limit re-issue captured to a **separate**
file (e.g. `audit-scorecards-verify.json`, so it cannot overwrite the baseline it is
compared against) returns the same count. On any non-zero verdict, or if you cannot
exhaust a domain (an unpaged cap, an error), say so explicitly in the step 5 report and
in step 7's `Checked:` line rather than reporting a partial count as the domain.

Process the files by writing a small scratch script to `.gs-superadmin/tmp/` (e.g.
`audit-scan.mjs`) and running it with `node` — **not** a `node -e` one-liner, which
Windows PowerShell re-parses and breaks on `[`, `||` and `}`. The capture helper wrote
each page as clean UTF-8 with no BOM; if a page was ever captured by hand with a shell
redirect instead, re-encode it before parsing:
`node .gs-superadmin/plugin/scripts/capture.mjs --normalize <file>`. The script
extracts each row's id, name and folder fields; then evaluate each name against the
convention.

JSON shapes, so you don't spend calls probing (`--json` envelope) — the three domains use
**three different key conventions** (live-verified 2026-07-25):
- `re r list` rows are `data.data[]`, keyed **`ruleId` / `ruleName`** — read those. An
  `id` key IS present on every row (measured at CLI 1.0.9: a 24-character record id,
  disjoint from the 36-character `ruleId` GUID on every row) and `name` is absent, so the
  cheap drift check is "confirm you read `ruleId`", never "watch for `undefined`": the wrong
  key yields a plausible-looking id that matches no rule (step 6's `re r edit --id` then
  fails rather than renaming a different rule). `data.pageInfo` carries
  `totalRecords`/`totalPages`/`nextAvailable`.
- `rp list` rows are `data.data[]`, keyed **`reportId` / `reportName`** (plus
  `reportDescription`); **no folder key of any kind**, so `--folder` cannot be honored for
  reports — say so and audit unfiltered, or skip. `data.pageInfo` carries `totalRecords`
  and `pageSize` (note: `pageSize`, not `limit`).
- `sc list` rows are a bare `data[]`, keyed **`id` / `name`** (plus `gsid`); no folder key
  (same `--folder` rule) and no `pageInfo`/total — the step 4 large-limit rule above is
  the only completeness check.
Still print the keys of the first row of each captured file once (`Object.keys(...)` on
one element) as a cheap drift check — a CLI upgrade can reshape any of these — and state
the keys you used in the step 5 report.

Treat as **exempt** (skip, do not flag): names carrying the convention's own status
prefixes — the deprecation prefix, maintenance prefixes (`OneTime:`, `As Needed:`),
in-flight ticket prefixes (e.g. a JIRA key), and any exemptions the workspace convention
defines. The deprecation prefix format loaded in step 2 (e.g. `D.MM.DD.YYYY `) is a
**format, not a string**: match the digits pattern it describes, accepting the year as
**two or four digits** (`D.\d{2}\.\d{2}\.(\d{4}|\d{2}) ` — real names read
`D.07.01.2026 …` and `D.03.15.24 …`; live tenants mostly carry the two-digit form even
where the documented format shows four) — and **never match the literal placeholder
text**. `OneTime:` and
`As Needed:` by contrast are genuine literals, matched verbatim. Stripping a deprecation
prefix in a proposed name destroys the deprecation date that starts the retention clock,
and it is not recoverable from the CLI — when a name is exempt, propose nothing for it.

**Deep mode**, for each flagged rule (up to `--budget`): get the rule definition — prefer
the KB doc at the manifest entry's recorded `doc_path` (do not compose the path from the
id) when that entry is `documented`, carries a `doc_path` (metadata-era entries may
lack one — treat those like undocumented), and
`last_verified` is within the freshness TTL (see operating model); otherwise run
`gs-admin --json re r describe --id <id>` captured to a tmp file via the capture helper
(step 4's invocation shape) and read only what is needed. Infer the segments from the rule's actions (per the convention's dictionary — e.g.
CTA actions → `CTA`, load-to-object → `DATA` + object name + operation) and compose a
proposed conforming name. If the actions are ambiguous, say so rather than guessing.

### 5 — Report (dry run — no writes yet)

Write the findings to `<slug>/audit-<YYYY-MM-DD>.md`:

| Domain | Current name | Issue | Proposed name |
|---|---|---|---|

Above the table, record the coverage of the run, one line per requested domain:
- governed and exhausted — `rules: 474 assets, pagination exhausted (3 pages), keys ruleId/ruleName`
- governed but not exhausted — `reports: 200 assets, PARTIAL — page cap not exhausted`
- ungoverned — `scorecards: skipped — no naming convention defined`

Summarize in chat: assets checked / conforming / flagged per domain, whether each domain
was paged to exhaustion, which domains were skipped for lack of a convention, and where the
full table was written. **Stop here and wait for the user** — never proceed to renames in
the same breath.

### 6 — Apply renames (only on explicit user approval)

> ⚠️ Since CLI 1.0.8 both rename lanes are catalog-mutating: expect one guard prompt per
> rule rename (`re r edit`) and per scorecard rename (`sc update`). The guard prompt is
> confirmation of each command, not the approval itself — the user's explicit approval of
> the specific rename list in this conversation is the gate. Do not rename anything that
> was not approved.

Apply one at a time, **single-quoting every name** (names contain `|`):

- Rules: `gs-admin re r edit --id <id> --new-name '<proposed>'`
- Scorecards: `gs-admin sc update --scorecard-id <id> --name '<proposed>'` (safe: a
  targeted edit — only the fields passed change)
- Reports: **kept manual-UI for a FOLDER reason** — `rp update` PUTs a whole report
  definition; its fetch-then-merge is verified live (1.0.7: a bare `--new-name` call
  preserved every other field), but the PUT drops the folder id and the report's
  folder is invisible to the CLI in both directions, so a rename that silently moved
  the report between folders could not be detected
  (see `/gs-superadmin:deprecate` step 4's Reports note). List report renames in the
  audit report as manual UI actions.
- Data Designer templates and JO Programs have **no CLI rename** — list them in the report
  as manual UI actions instead.

After each successful rename, mark the asset stale so the KB re-documents it:
```
node .gs-superadmin/plugin/scripts/manifest.mjs mark --manifest <slug>/_manifest.json --key <domain>/<id> --status stale
```

### 7 — Final report

Render rules for the block below. `Checked:` states coverage honestly: substitute
`<coverage>` with `all pages` when every audited domain was paged to exhaustion, or with
`PARTIAL — <domain> not exhausted` naming each domain that was not. Include the `Skipped:`
line only when at least one requested domain was ungoverned; substitute `<skipped>` with
those domain names, comma-separated.

```
✓ gs-superadmin audit complete
  Checked:  N assets (<domains>) · <coverage>
  Skipped:  <skipped> — no naming convention defined
  Flagged:  X (see <slug>/audit-<date>.md)
  Renamed:  Y (approved) · Z left for manual/UI action
  Next:     /gs-superadmin:refresh --document to re-document renamed assets
```
