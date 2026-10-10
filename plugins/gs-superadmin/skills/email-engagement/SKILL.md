---
description: Read-only Journey Orchestrator email engagement report from the tenant's send log — how each program's emails performed over a period (sent, unique recipients, accounts reached, delivered, opened, open rate, clicks with their tracking state, survey responses), optionally per template and step and with an account watch list. Use when asked "what's the open rate for program X", "how are our email programs performing", "which programs have low open rates", or "which accounts aren't opening our emails". Pairs with email-report, which says what the emails say and when they run. Writes a markdown report, optionally CSVs/XLSX. Never mutates the tenant.
argument-hint: "report [--name p]… [--ids-file f] [--sent-since d] [--from YYYY-MM] [--to YYYY-MM] [--internal-domain d]… [--unsubscribe-link l]… [--accounts] [--step-detail] [--previous f] [--snapshot f] [--by-template] [--exclude-internal] [--include-paused|--all] [--csv] [--xlsx] [--slug name]"
# model-invocable by design (no disable-model-invocation): a plain "open rate for program X" routes to `report` (email-report precedent)
---

# /gs-superadmin:email-engagement

How Journey Orchestrator emails performed, read from the tenant's send log. One mode:

- **report** — pulls the send log for a period into one snapshot file, then writes a
  report from it: a headline by status, one row per program (sent, unique recipients,
  accounts reached, delivered, opened and open rate side by side), survey responses,
  optionally one row per template and step, an account watch list when account data was
  pulled, a glossary that says how every number is calculated, and the caveats.

`/gs-superadmin:email-report` answers what the emails say and when they run, from the KB.
This skill answers how they performed, from the send log.

## Ground rules

Each is a one-line reminder; the full rule lives where the pointer says.

- **Read-only tenant.** The pull issues only catalogued non-mutating commands (`whoami`,
  `rp run`, `rp schema`, `jo p list`, `jo p describe`) and its script refuses any other
  (rule canon: operating model, "Read-only by default").
- **One `gs-admin` call at a time.** The pull script makes its calls one after another;
  never start a second `gs-admin` command while a pull is running (rule canon:
  `/gs-superadmin:email-report`, Ground rules).
- **Single-quote every name and value** you pass (rule canon: operating model, "How to
  drive gs-admin", shell quoting).
- **Bulk JSON stays on disk.** Payloads and the snapshot are files; read only the scripts'
  stdout summaries and the finished report, and run the scripts through the Bash tool
  (rule canon: operating model, "How to drive gs-admin", reading script stdout).
- **Confirmed data only.** Every figure is a count of send-log rows for the period. It
  says what was sent, not whether a scheduled send has finished: email-report's
  audit-active column `not available via CLI` is unaffected by anything this skill
  reports. Never restate a number from memory, estimate one, or fill a blank cell: a
  dash, "Not tracked" and "(tracking unknown)" each mean what the report's caveats say.

## Arguments

First argument: the mode. `report` is the only one; when the ask is a plain question
about open rates, engagement or email performance, the mode is `report`.

Pull flags — passed to the pull script exactly as written here (steps 2 and 3):

| Flag | Meaning |
|---|---|
| `--name <name-or-id>` (repeatable) | Pull only these programs, by exact name or by id. Default: every program with sends in the window, whatever its status. |
| `--ids-file <file>` | Pull only the program ids listed in this file, one per line. |
| `--sent-since <date\|Nd\|Nm>` | Pull only programs with at least one send since a date (`2026-06-01`), a number of days (`90d`) or of months (`3m`). The cheapest way to narrow a large tenant. |
| `--from <YYYY-MM>` · `--to <YYYY-MM>` | The reporting window, in whole months. Default: the last 12 full months plus the current one. |
| `--internal-domain <domain>` (repeatable) | The company's own email domains. Recipients on them are classed internal, so `--exclude-internal` can leave them out. |
| `--unsubscribe-link <link\|host>` (repeatable) | The tenant's unsubscribe link when it is a page on the company's own site or on an outside host: its clicks then do not count as content clicks. Give the page's link, never a bare company domain (a bare host names every page on it). |
| `--accounts` | Also pull per-account data, for the account watch list. Off by default: it is most of a pull's cost. |
| `--step-detail` | Also pull per-step and per-variant rows and participant records. Off by default: it adds calls. |
| `--previous <snapshot.json>` | Continue from an earlier snapshot of this tenant: only the most recent two months are read again and older months are taken from that file. The report's caveats then say which months were carried forward. |

Report flags — passed to the report script (step 4):

| Flag | Meaning |
|---|---|
| `--by-template` | Add one row per program and template, with the step it sits on; and one row per step and variant when the snapshot was pulled with `--step-detail`. |
| `--exclude-internal` | Leave internal recipients out of every send figure. |
| `--include-paused` | Show Paused programs beside Active ones in the per-program tables. |
| `--all` | Show every status. Not with `--include-paused`. |

Skill-level flags (handled by these steps, not passed to a script):

- `--snapshot <file>` — write the report from this existing snapshot: skip steps 2 and 3.
- `--csv` — also write the report's tables as CSVs
- `--xlsx` — convert those CSVs into one workbook (implies `--csv`)
- `--slug <name>` — override the derived slug

"Active" means status **PROCESSING** only, as in `/gs-superadmin:email-report`. Status
never limits what is pulled; it decides which programs the per-program tables show, and
the report states how many it hides. A pull that named its programs (`--name`,
`--ids-file`) shows them whatever their status.

---

## Steps

### 1 — Identify the instance

Run `gs-admin whoami`. Derive the slug from the `*/_manifest.json` whose `baseUrl`
matches (or use `--slug`). If no workspace manifest exists, tell the user to run
`/gs-superadmin:setup` first and stop. If `whoami` does not show `Token: valid`, ask the
user to run `gs-admin login`, then continue.

With `--snapshot`, go to step 4.

### 2 — Plan the pull

The plan makes a handful of cheap calls and prints what the full pull will cost. Nothing
is pulled yet.

```
node .gs-superadmin/plugin/scripts/engagement.mjs plan --kb <slug> --run <run> <pull flags>
```

- `<slug>` is the slug from step 1.
- `<run>` names this pull's working directory. Build it once, here, from the current local
  date and time as `report-<YYYYMMDD>-<HHMM>` (for example `report-20260915-0930`), and use
  the same value in step 3 and in any re-issue of either command.
- `<pull flags>` is every pull flag the user gave, from the table above, unchanged; a
  repeatable flag appears once per value. Omit it when the user gave none.

The script prints one progress line per call on stderr, here and in step 3. They are
progress only: a line that says a call is being tried once more, or was not found, is not
a failure. The exit code and the summary decide.

By exit code, before reading anything else:

- `3` — the login is missing or expired (`status` is `token-expired`; there is no estimate).
  Ask the user to run `gs-admin login`, then re-issue the plan command unchanged.
- `4` — one of the plan's calls failed. Re-issue the plan command once; if it exits 4 again,
  stop and report the `failed` list from the summary.
- `1` — the script refused. Show its message and stop.

On exit 0, read the summary JSON on stdout:

- `estimate.thisRun.calls` and `estimate.thisRun.seconds` — the pull's cost.
- `estimate.token.fits` — whether the pull finishes before the login expires.
- `estimate.accounts.addsSeconds` and `estimate.stepDetail.addsSeconds` — what `--accounts`
  and `--step-detail` add, printed whether or not they are on.
- `programs.selected` — how many programs the pull covers.

Tell the user the estimate in one line (programs, calls, minutes). Then:

- `estimate.token.fits` is `false`: ask the user to run `gs-admin login` again, then
  re-issue the plan command unchanged.
- The estimate is over 10 minutes: ask before pulling. Offer to pull as planned, to narrow
  with `--sent-since 90d`, or to stop. Otherwise go on without asking.
- The user asked about accounts ("which accounts aren't opening") and did not pass
  `--accounts`: say what it adds (`estimate.accounts.addsSeconds`, in minutes) and ask
  whether to include it. A pull planned with a changed flag needs a new `<run>`.
- `estimate.kb.undocumented + estimate.kb.behind` is above 0: the knowledge base is behind
  the tenant for that many of the pull's programs (new programs it has no doc for, and
  programs modified after their doc was written). Their schedules are unknown to the pull,
  so they would read "Cannot judge yet" on the health lists. Tell the user the two counts and
  the seconds `estimate.kb` quotes, and ask whether to re-document those programs in the
  knowledge base now. On yes, run the three commands below, then re-issue the plan command
  unchanged (same `<run>`: the plan re-reads the knowledge base it moved) and read the
  summary again. On no, go on; the report's caveat names the programs and the remedy.
  Never re-document anything beyond these programs here: bringing the whole knowledge
  base up to date is the knowledge-base skill's own job, not this one's.

The narrow re-documentation, from `estimate.kb` (three commands, in this order;
`<journey-domain>` is the manifest's journey programs domain as `domains_indexed` names
it, and the files are the ones the plan wrote beside `plan.json`):

```
node .gs-superadmin/plugin/scripts/manifest.mjs upsert-batch --manifest <slug>/_manifest.json --domain <journey-domain> --file <estimate.kb.listFile> --id-field advancedOutreachId --name-field advancedOutreachName --partial
node .gs-superadmin/plugin/scripts/manifest.mjs mark --manifest <slug>/_manifest.json --keys-file <estimate.kb.keysFile> --status stale
node .gs-superadmin/plugin/scripts/describe-batch.mjs --manifest <slug>/_manifest.json --domain <journey-domain> --out-dir <slug>/<journey-domain> --keys-file <estimate.kb.keysFile> --limit 25
```

The first registers the undocumented programs as a declared subset (`--partial` is
mandatory; skip it when `estimate.kb.undocumented` is 0); the second marks every named
program stale so the batch selects it; the third re-documents exactly those programs,
one describe each, and nothing else (re-invoke until `moreRemaining` is false). A
program the list itself lacks (`estimate.kb.unlisted`) cannot be registered this way and
stays "Cannot judge yet"; say so.

- `estimate.templates.planned` is above 0: the knowledge base lacks the text of that many
  of the email templates the pull's programs send (`estimate.templates.missing` have no
  doc at all, `.behind` a doc older than the template's last send, `.unread` are
  never-clicked templates whose doc carries no link-tracking reading, so their click
  tracking would read unknown). Without them the report's Subject column shows a dash
  for those templates and the dashboard's Templates tab has no text to show or search.
  When `planned` is 50 or fewer, fill the gap without asking. Above that, ask with the
  count and the seconds `estimate.templates` quotes (the same ask as
  `/gs-superadmin:email-report` step 4b): fill all of it, the first 50 (the keys file's
  order: missing first, then behind, then unread), or none. On a fill, run the three
  commands below with the chosen budget, then re-issue the plan command unchanged (same
  `<run>`: the plan re-reads the knowledge base it moved) and read the summary again. On
  none, go on; the report's caveats name the gap. The pull itself never fetches a
  template: this is email-report's own gap-fill (its step 4c, item 5: register, then
  describe), driven from the files the plan wrote.

The template gap-fill, from `estimate.templates` (three commands, in this order;
`<templates-domain>` is `estimate.templates.domain`, the manifest's email-templates
domain as `domains_indexed` names it; `<budget>` is the number chosen above; the files are
the ones the plan wrote beside `plan.json`):

```
node .gs-superadmin/plugin/scripts/manifest.mjs upsert-batch --manifest <slug>/_manifest.json --domain <templates-domain> --file <estimate.templates.listFile> --id-field <estimate.templates.idField> --partial
node .gs-superadmin/plugin/scripts/manifest.mjs mark --manifest <slug>/_manifest.json --keys-file <estimate.templates.staleKeysFile> --status stale
node .gs-superadmin/plugin/scripts/describe-batch.mjs --manifest <slug>/_manifest.json --domain <templates-domain> --command "gs-admin --json jo email template --id {id}" --doc-mode template --out-dir <slug>/<templates-domain> --keys-file <estimate.templates.keysFile> --limit <budget>
```

Skip the first when `estimate.templates.listFile` is null (nothing is missing) and the
second when `staleKeysFile` is null (nothing to read again); the third fetches the named
templates one at a time, within the budget, and files each in the knowledge base as it
lands (re-invoke it until `moreRemaining` is false, or the budget is spent). A template
whose fetch fails stays marked `failed` in the manifest; the report's caveats count it
among the missing.

### 3 — Pull the snapshot

```
node .gs-superadmin/plugin/scripts/engagement.mjs run --kb <slug> --run <run> <pull flags> --out <slug>/reports-adhoc/engagement-<run>.json
```

`<slug>`, `<run>` and `<pull flags>` are exactly the values used in step 2: the pull
continues the plan's working directory and makes none of its calls again.

Start it in the background when the estimate is over 8 minutes (a foreground command is
cut off at 10), and wait for it to finish. Do nothing else with `gs-admin` meanwhile.

Read the summary JSON, never the snapshot file. By exit code:

- `0` — the snapshot is written. Go to step 4.
- `3` — the login expired during the pull. Ask the user to run `gs-admin login`, then
  re-issue the same command: answered calls are not made again.
- `4` — a call failed. Re-issue the same command once. If it exits 4 again, stop and
  report the `failed` list from the summary; no report is written from a partial pull.
- `1` — the script refused or failed. Show its message and stop.

### 4 — Write the report

```
node .gs-superadmin/plugin/scripts/engagement-report.mjs --snapshot <snapshot> --kb <slug> --report <slug>/reports-adhoc <report flags>
```

- `<snapshot>` is `<slug>/reports-adhoc/engagement-<run>.json` from step 3, or the user's
  `--snapshot` file.
- `<report flags>` is every report flag the user gave, unchanged. Omit it when the user
  gave none.
- When the user asked for `--csv` or `--xlsx` (and only then), also append
  `--csv-dir <slug>/reports-adhoc/engagement-<YYYY-MM-DD>-csv`, with today's date.

`--report` takes the directory; the script names the file `engagement-<YYYY-MM-DD>.md`
and never overwrites an earlier one. Read the summary JSON, then the finished report's
"Caveats & data gaps" section.

If `reconciliation.closedMonthsOk` is `false`, the pull's tables do not add up in months
that are closed: say so first, before any number, and recommend pulling again. A non-empty
`reconciliation.incompletePeriodDrift` alone is not a failure; the report's caveats
explain it.

### 5 — Workbook (only with `--xlsx`)

Convert the CSVs in the csv-dir into one workbook at
`<slug>/reports-adhoc/engagement-<YYYY-MM-DD>.xlsx`, one sheet per CSV, with the xlsx
skill; if that skill is unavailable, deliver the CSVs and say so (rule canon:
`/gs-superadmin:email-report` step 6, including the BOM-aware read).

### 6 — Final report

```
✓ gs-superadmin email-engagement (report) complete
  Data pulled: <pulledAt> · window <from> to <to> · provisional from <incompleteFrom>
  Programs:    <shown> shown of <inSnapshot> pulled · <hidden> hidden by status
  Accounts:    <accounts line>
  Report:      <report path><extras>
  Snapshot:    <snapshot path>
  Caveats:     <N> — <lead>
  Re-run:      <rerun>
```

Substitute from the step-4 summary JSON:

- `<pulledAt>`, `<incompleteFrom>` — the fields of those names; `<from>` and `<to>` —
  `window.from` and `window.to`.
- `<shown>`, `<inSnapshot>`, `<hidden>` — `counts.programsShown`,
  `counts.programsInSnapshot`, `counts.programsHiddenByStatus`.
- `<accounts line>` — when `accountData.pulled` is `true`: `watch list for <n> program(s)`,
  with `<n>` = `counts.watchListPrograms`. When it is `false`: `not pulled — run again with
  --accounts to add the watch list`.
- `<report path>` — `report`. `<extras>` — nothing when no CSV was written; ` + CSVs in <csvDir>`
  (with `<csvDir>` = `csvDir`) when `csvDir` is not null; and, after that, ` + <workbook>` with the
  workbook's path when step 5 wrote one. `<snapshot path>` — `snapshot`.
- If `unmatchedNames` is not empty, add one line under `Programs:` in the same indentation:
  `Not found:   <names>`, with `<names>` = the entries of `unmatchedNames`, each in double
  quotes, comma-separated. Omit the line when it is empty.
- `<N>` — `caveatCount`. `<lead>` — the entries of `leadCaveats`, as written, joined with `; `.
  The script chooses them (one or two, in a fixed order); do not pick others.
- `<rerun>` — `rerun`. It rebuilds the report from the same snapshot and pulls nothing.

Then answer the user's question from the finished report's own rows, quoting its numbers
as written. Report, then stop — no follow-on actions without being asked.
