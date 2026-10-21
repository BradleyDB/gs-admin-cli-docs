---
description: Read-only Journey Orchestrator email engagement from the tenant's send log, for comparisons across programs and periods — "every program that sent since a date", which programs have low open rates, the cross-program customer lists (most engaged, least engaged, most bounced) — as a one-off report or as a dashboard built once and pulled again by hand whenever new numbers are wanted. Use when asked "how are our email programs performing", "which programs have low open rates", "which customers aren't opening our emails", "build (or edit) a dashboard of our email engagement", "update the engagement dashboard" (/gs-superadmin:email-engagement refresh <slug>), or "what have we emailed this customer" (one account's timeline by day). For ONE program's numbers, Gainsight's own analytics page for that program is the place; this skill is for the comparisons the UI cannot make. Pairs with email-report, which says what the emails say and when they run. Writes a markdown report, optionally CSVs/XLSX, or self-contained HTML pages. Never mutates the tenant.
argument-hint: "report [--name p]… [--ids-file f] [--sent-since d] [--from YYYY-MM] [--to YYYY-MM] [--internal-domain d]… [--unsubscribe-link l]… [--test-account id]… [--accounts] [--step-detail] [--previous f] [--snapshot f] [--by-template] [--exclude-internal] [--include-paused|--all] [--csv] [--xlsx] [--slug name] | dashboard new <slug> [--fast-path] | dashboard edit <slug> | dashboard list | /gs-superadmin:email-engagement refresh <slug> [--full] [--health-only] | publish <slug> | account [<dash>] '<name>' [--last Nd|Nm]"
# model-invocable by design (no disable-model-invocation): a plain "open rate for program X" routes to `report` (email-report precedent)
---

# /gs-superadmin:email-engagement

How Journey Orchestrator emails performed, read from the tenant's send log. Its modes:

- **report** — pulls the send log for a period into one snapshot file, then writes a
  report from it: a headline by status, one row per program (sent, unique recipients,
  accounts reached, delivered, opened and open rate side by side), survey responses,
  optionally one row per template and step, the cross-program customer lists when
  account data was pulled, a glossary that says how every number is calculated, and
  the caveats.
- **dashboard new | edit | list** — builds a dashboard once (an interview, one question
  at a time), saves its spec, and pulls it; the pages are self-contained HTML files, one
  per audience, with global filters and tabs.
- **/gs-superadmin:email-engagement refresh <slug>** — pulls a saved dashboard again and
  rebuilds its pages, with no model in the loop; the leaders' copy is published at its end.
- **publish <slug>** — publishes the leaders' copy of a saved dashboard as its pages stand,
  with no pull: into the shared folder the dashboard names.
- **account '<name>'** — one account's emails by program and day over the last N days or
  months, in a page of its own (its contacts added up, never named).

`/gs-superadmin:email-report` answers what the emails say and when they run, from the KB.
This skill answers how they performed, from the send log. **For one program's own
numbers, send the user to Gainsight's analytics page for that program**: this skill is for
comparisons across programs and periods, every program that sent since a date, and the
customer lists across programs, which the UI cannot make.

## Ground rules

Each is a one-line reminder; the full rule lives where the pointer says.

- **Read-only tenant.** The pull issues only catalogued non-mutating commands (`whoami`,
  `rp run`, `rp schema`, `jo p list`, `jo p describe`, `jo email template`) and its scripts
  refuse any other (rule canon: operating model, "Read-only by default").
- **One `gs-admin` call at a time.** The scripts make their calls one after another;
  never start a second `gs-admin` command while one is running (rule canon:
  `/gs-superadmin:email-report`, Ground rules).
- **Single-quote every name and value** you pass (rule canon: operating model, "How to
  drive gs-admin", shell quoting).
- **Bulk JSON stays on disk.** Payloads, snapshots and specs are files; read only the
  scripts' stdout summaries and the finished report, and run the scripts through the Bash
  tool (rule canon: operating model, "How to drive gs-admin", reading script stdout).
- **Confirmed data only.** Every figure is a count of send-log rows for the period. It
  says what was sent, not whether a scheduled send has finished: email-report's
  audit-active column `not available via CLI` is unaffected by anything this skill
  reports. Never restate a number from memory, estimate one, or fill a blank cell: a
  dash, "Not tracked" and "(tracking unknown)" each mean what the report's caveats say.
- **The scripts decide; the prose judges.** Every mechanical step — what to ask next,
  what an answer must look like, what a change costs, the pull, the pages — is the entry
  command's. Exactly two questions are judgment and are answered here in prose: the
  group proposal and the brand tokens.
- **A lock left behind is said on every verb.** Any summary that carries `lockLeft` — a
  pull's, a rebuild's, a change's `done`, a re-ranking's — is relayed with its `text` as
  written, one sentence: the next pull takes the lock over on its own, and nothing needs
  doing. Step P shows the pull's case; the rule is the same wherever the key appears.

## Arguments

First argument: the mode. `report` when the ask is a plain question about open rates,
engagement or email performance across programs; `dashboard` when the user wants a
dashboard built, changed or listed; the pull-again mode when a saved dashboard should be
brought up to date (`/gs-superadmin:email-engagement refresh <slug>`); `publish` when the
leaders' copy should be published again without a pull ("publish the leaders' page", "copy
it to the shared folder"); `account` when the ask is what one customer was sent. Native
Gainsight reports made from a dashboard are not offered in this release (Gainsight's report
builder cannot finish them); if asked for them, say so and stop.

Pull flags (report mode) — passed to the pull script exactly as written here (steps R2
and R3):

| Flag | Meaning |
|---|---|
| `--name <name-or-id>` (repeatable) | Pull only these programs, by exact name or by id. Default: every program with sends in the window, whatever its status. |
| `--ids-file <file>` | Pull only the program ids listed in this file, one per line. |
| `--sent-since <date\|Nd\|Nm>` | Pull only programs with at least one send since a date (`2026-06-01`), a number of days (`90d`) or of months (`3m`). The cheapest way to narrow a large tenant. |
| `--from <YYYY-MM>` · `--to <YYYY-MM>` | The reporting window, in whole months. Default: the last 12 full months plus the current one. |
| `--internal-domain <domain>` (repeatable) | The company's own email domains. Recipients on them are classed internal, so `--exclude-internal` can leave them out. |
| `--unsubscribe-link <link\|host>` (repeatable) | The tenant's unsubscribe link when it is a page on the company's own site or on an outside host: its clicks then do not count as content clicks. Give the page's link, never a bare company domain (a bare host names every page on it). |
| `--test-account <company id>` (repeatable) | A test account: a company record whose sends count as internal. An id, never an address. |
| `--accounts` | Also pull per-account data, for the customer lists. Off by default: it is most of a pull's cost. |
| `--step-detail` | Also pull per-step and per-variant rows and participant records. Off by default: it adds calls. |
| `--previous <snapshot.json>` | Continue from an earlier snapshot of this tenant: only the most recent two months are read again and older months are taken from that file. With `--accounts`, the account store beside that snapshot (`<name>.accounts.json`, written with it) is read too; a snapshot with no store beside it (one made before the store, or copied without it) makes the pull a full one, and `pull.why` says so. The report's caveats then say which months were carried forward. |

Report flags — passed to the report script (step R4):

| Flag | Meaning |
|---|---|
| `--by-template` | Add one row per program and template, with the step it sits on; and one row per step and variant when the snapshot was pulled with `--step-detail`. |
| `--exclude-internal` | Leave internal recipients out of every send figure. |
| `--include-paused` | Show Paused programs beside Active ones in the per-program tables. |
| `--all` | Show every status. Not with `--include-paused`. |

Skill-level flags (handled by these steps, not passed to a script):

- `--snapshot <file>` — write the report from this existing snapshot: skip steps R2 and R3.
- `--csv` — also write the report's tables as CSVs
- `--xlsx` — convert those CSVs into one workbook (implies `--csv`)
- `--slug <name>` — override the derived slug

Dashboard flags: `--fast-path` on `dashboard new` (the standard program-health dashboard:
every question takes its default, then the closing step); `--full` and `--health-only` on
the pull-again mode. Every dashboard verb takes `--kb <slug>`, always (a workspace can hold
more than one tenant, and the command never guesses); the lines the pages offer to copy
carry it too.

"Active" means status **PROCESSING** only, as in `/gs-superadmin:email-report`. Status
never limits what is pulled; it decides which programs the per-program tables show, and
the report states how many it hides. A pull that named its programs (`--name`,
`--ids-file`) shows them whatever their status.

---

## Step 1 — Identify the instance (every mode)

Run `gs-admin whoami`. Derive the slug from the `*/_manifest.json` whose `baseUrl`
matches (or use `--slug`). If no workspace manifest exists, tell the user to run
`/gs-superadmin:setup` first and stop. If `whoami` does not show `Token: valid`, ask the
user to run `gs-admin login`, then continue.

Then go to the mode's steps: R (report), D (dashboard), P (the pull-again mode), L (publish
the leaders' copy), or A (one account's timeline).

---

## R — the report

### R2 — Plan the pull

With `--snapshot`, go to step R4. Before planning, read the dashboard rule below: a saved
dashboard of this tenant may already answer the question.

**A dashboard answers first.** `node .gs-superadmin/plugin/scripts/dashboard.mjs list
--kb <slug>` shows each saved dashboard with `holds`: its last pull's time, `window`
(`from`, `to`), `selection` (which programs it took, in words) and how many `programs`.
When one holds the months the question is about, run its report instead of a fresh pull:

```
node .gs-superadmin/plugin/scripts/dashboard.mjs report <dashboard slug> --kb <slug> <report flags>
```

When the user asked for `--csv` or `--xlsx`, also append `--csv-dir
<slug>/reports-adhoc/engagement-<YYYY-MM-DD>-csv` (today's date), as step R4 does; step R5
then converts those CSVs.

Read its summary. Check every program the question names against `held.programs` (each
with its `id`, `name`, `statuses` and `shown`), by name or id:

- Held and `shown`: answer from the report.
- Held but `shown` is false: the report's status filter hides it (a Paused program, say).
  Run the report again with `--include-paused` (or `--all` for any other status) and answer
  from that.
- Not held: the dashboard does not hold it (its `held.selection` or its `held.window` left
  it out). Say so, naming the program and what the dashboard holds; never answer it with a
  blank. Then go on to the plan below with `--name <that program>` for the programs the
  dashboard does not hold, or stop if the user would rather not pull.

`unmatchedNames` is something else: names the dashboard's OWN selection lists that matched
no program. A question with no program named (every program, or a status) is answered from
the report as it is.

Answer from that report and SAY THE DATE (`pulledAt`) and the age (`snapshotAgeDays`,
"pulled N days ago") in the answer: the dashboard is not live, and its numbers are as of
that pull. When `snapshotAgeDays` is above 7, first say the date and the age, then ask
whether to run `/gs-superadmin:email-engagement refresh <dashboard slug>` first or to answer
from the older numbers; never answer from an old snapshot quietly. The ask prices that
pull, a routine one: "about M minutes", M being the summary's price of
`/gs-superadmin:email-engagement refresh <dashboard slug>`, `refreshMinutes`. When that pull
is a full one this once (`refreshFullOnce` of `/gs-superadmin:email-engagement refresh <dashboard slug>`
says why: the dashboard's last pull has no account store to rank the customer lists from),
say so with that reason; the price is then the full pull's. When the routine price is null
(no routine pull has been priced yet: the dashboard has had only its first, full pull),
say instead "a routine pull re-reads only the recent months, so it is shorter than the
first pull, which took about F minutes", F being the full pull's price,
`fullRefreshMinutes` of `/gs-superadmin:email-engagement refresh <dashboard slug> --full`.
When `fullRefreshMinutes` of `/gs-superadmin:email-engagement refresh <dashboard slug> --full`
is null as well (a dashboard imported here, with no pull made here yet, has no plan to
price from), give no minutes: say the pull's time is known once its first pull here is planned.

Otherwise the plan makes a handful of cheap calls and prints what the full pull will
cost. Nothing is pulled yet.

```
node .gs-superadmin/plugin/scripts/engagement.mjs plan --kb <slug> --run <run> <pull flags>
```

- `<slug>` is the slug from step 1.
- `<run>` names this pull's working directory. Build it once, here, from the current local
  date and time as `report-<YYYYMMDD>-<HHMM>` (for example `report-20260915-0930`), and use
  the same value in step R3 and in any re-issue of either command.
- `<pull flags>` is every pull flag the user gave, from the table above, unchanged; a
  repeatable flag appears once per value. Omit it when the user gave none.

The script prints one progress line per call on stderr, here and in step R3. They are
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
- `estimate.token.fits` — whether the pull alone finishes before the login expires;
  `estimate.token.withProposals.fits` — whether the pull PLUS the re-documentation and the
  template gap-fill the plan proposes (the seconds `estimate.kb` and `estimate.templates`
  quote) still fit it; `estimate.token.afterPullSeconds` — what the login has left once the
  pull is made, the budget any gap-fill has to fit.
- `estimate.accounts.addsSeconds` and `estimate.stepDetail.addsSeconds` — what `--accounts`
  and `--step-detail` add, printed whether or not they are on.
- `programs.selected` — how many programs the pull covers.

Tell the user the estimate in one line (programs, calls, minutes). Then:

- `estimate.token.fits` is `false`: ask the user to run `gs-admin login` again, then
  re-issue the plan command unchanged. `fits` is the pull alone: a gap-fill or a
  re-documentation is offered below against `afterPullSeconds`, never started on a login
  the pull was judged to fit.
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
  knowledge base now. The ask says when it would outlive the login: when the seconds
  `estimate.kb` quotes are more than `estimate.token.afterPullSeconds` (what the login has
  left after the pull), say so in the ask, with both numbers in minutes, and that
  a login first (`gs-admin login`, then the plan command unchanged) makes room for it. On
  yes, run the three commands below, then re-issue the plan command
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
node .gs-superadmin/plugin/scripts/describe-batch.mjs --manifest <slug>/_manifest.json --domain <journey-domain> --command "gs-admin --json jo p describe --id {id}" --doc-mode program --out-dir <slug>/<journey-domain> --keys-file <estimate.kb.keysFile> --limit 25
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
  When `planned` is 50 or fewer AND `estimate.templates.seconds` fits
  `estimate.token.afterPullSeconds`, fill the gap without asking. Otherwise ask with the
  count and the seconds `estimate.templates` quotes (the same ask as
  `/gs-superadmin:email-report` step 4b): fill all of it, the first 50 (the keys file's
  order: missing first, then behind, then unread), or none. Price each choice against
  what the login has left after the pull (`afterPullSeconds`; a choice costs its count
  times `estimate.templates.secondsEach`) and say in the ask which choices would outlive
  the login, so the user can log in first (`gs-admin login`, then the plan command
  unchanged) or take a smaller budget. On a fill, run the three
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

### R3 — Pull the snapshot

```
node .gs-superadmin/plugin/scripts/engagement.mjs run --kb <slug> --run <run> <pull flags> --out <slug>/reports-adhoc/engagement-<run>.json
```

`<slug>`, `<run>` and `<pull flags>` are exactly the values used in step R2: the pull
continues the plan's working directory and makes none of its calls again.

Start it in the background when the estimate is over 8 minutes (a foreground command is
cut off at 10), and wait for it to finish. Do nothing else with `gs-admin` meanwhile. Its
`progress:` lines on stderr (step P gives their shape; here they are prefixed
`engagement.mjs:` with no `pull` word) answer "how long is left"; an ad-hoc pull keeps no
pace file, so they quote the plan's price until this run's own pace is measured.

Read the summary JSON, never the snapshot file. By exit code:

- `0` — the snapshot is written. Go to step R4.
- `3` — the login expired during the pull. Ask the user to run `gs-admin login`, then
  re-issue the same command: answered calls are not made again.
- `4` — a call failed. The summary's `failed` list names each call (its family, the
  programs it covered, the cause, and in how many runs it has failed so far). Re-issue the
  same command once: the next run retries what failed and continues where it stopped. If
  it exits 4 again, stop and report the `failed` list; no report is written from a partial
  pull.
- `1` — the script refused or failed. Show its message and stop.

### R4 — Write the report

```
node .gs-superadmin/plugin/scripts/engagement-report.mjs --snapshot <snapshot> --kb <slug> --report <slug>/reports-adhoc <report flags>
```

- `<snapshot>` is `<slug>/reports-adhoc/engagement-<run>.json` from step R3, or the user's
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

### R5 — Workbook (only with `--xlsx`)

Convert the CSVs in the csv-dir into ONE workbook at
`<slug>/reports-adhoc/engagement-<YYYY-MM-DD>.xlsx` with the xlsx skill, under the rules
of `/gs-superadmin:email-report` step 6 (their home): one sheet per CSV named the file
minus `.csv`, the CSVs' leading BOM read BOM-aware, and no hand-rolled writer when the
skill is unavailable — deliver the CSVs and say so.

### R6 — Final report

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

Substitute from the step-R4 summary JSON:

- `<pulledAt>`, `<incompleteFrom>` — the fields of those names; `<from>` and `<to>` —
  `window.from` and `window.to`.
- `<shown>`, `<inSnapshot>`, `<hidden>` — `counts.programsShown`,
  `counts.programsInSnapshot`, `counts.programsHiddenByStatus`.
- `<accounts line>` — when `accountData.pulled` is `true`: `<n> customer list(s) across
  programs`, with `<n>` = `counts.crossProgramLists`, then `, per-program lists for <m>
  program(s)` with `<m>` = `counts.watchListPrograms` when it is above 0. When it is
  `false`: `not pulled — run again with --accounts to add the customer lists`.
- `<report path>` — `report`. `<extras>` — nothing when no CSV was written; ` + CSVs in <csvDir>`
  (with `<csvDir>` = `csvDir`) when `csvDir` is not null; and, after that, ` + <workbook>` with the
  workbook's path when step R5 wrote one. `<snapshot path>` — `snapshot`.
- If `unmatchedNames` is not empty, add one line under `Programs:` in the same indentation:
  `Not found:   <names>`, with `<names>` = the entries of `unmatchedNames`, each in double
  quotes, comma-separated. Omit the line when it is empty.
- `<N>` — `caveatCount`. `<lead>` — the entries of `leadCaveats`, as written, joined with `; `.
  The script chooses them (one or two, in a fixed order); do not pick others.
- `<rerun>` — `rerun`. It rebuilds the report from the same snapshot and pulls nothing.

Then answer the user's question from the finished report's own rows, quoting its numbers
as written. Report, then stop — no follow-on actions without being asked.

---

## D — the dashboard

Everything here runs through ONE command, whose verbs each print one JSON summary. Read
the summary, never a spec, snapshot or page file. `<slug>` below is the tenant's KB slug
from step 1; `<dash>` is the dashboard's own name (lower-case letters, digits and
hyphens), chosen by the user or proposed from what they called it.

### D1 — `dashboard list`

```
node .gs-superadmin/plugin/scripts/dashboard.mjs list --kb <slug>
```

Relay each dashboard: its title, whether it is saved, its last pull (`lastPull`), the
pages on disk, and — for a draft — who holds it (`draftBy`) and when it was last changed
(`draftUpdatedAt`). Stop.

### D2 — `dashboard new <dash> [--fast-path]` and `dashboard edit <dash>`

Start, or resume, the draft (the same command for both: over a saved dashboard it starts
an edit from the saved spec):

```
node .gs-superadmin/plugin/scripts/dashboard.mjs new <dash> --kb <slug> --title '<title>' --owner '<owner>'
```

`<title>` is the dashboard's title as the user called it (the page header shows it) and
`<owner>` is the name of the person who owns the dashboard, as the About tab's settings
list it under Owner; take both from what the user said, and omit a flag the user gave
nothing for (the title then defaults to the slug, the owner to none). Append `--fast-path`
when the user asked for the standard program-health dashboard, or said they want the
defaults: every question then takes its own default (the one its wording names) and the
interview goes straight to the closing step (on an edit or a resumed draft the flag does
nothing, and the summary's `fastPathIgnored` says so: relay it). If the summary's `ok` is
`false` and its `error` names another holder ("held by …"), tell the user who holds the
draft and since when, and ask whether to take it over; on yes re-issue the command with
`--take-over`, otherwise stop.

**An edit** (the summary's `state` is `editing-saved`) starts from the saved dashboard, so
every setting already counts as answered: the next `next` returns the closing step
directly, which states what the edit changes against the saved dashboard and what that
costs (a new pull with its minutes, a re-ranking of the customer lists, or a rebuild with
no pull; "nothing changed" until a setting moves). Nothing is re-asked. To change one
setting, ask for that question again with `next <dash> --question <id>` (the ids are the
questions' own; the summary's `hint` lists them), ask it as in D3 and pass the answer, then
`next` again for the closing step.

### D3 — The questions, one at a time

Ask for the next question:

```
node .gs-superadmin/plugin/scripts/dashboard.mjs next <dash> --kb <slug>
```

Read the summary. When it carries `said`, say that sentence to the user first, as it is
(the tenant statement: which tenant the dashboard is for and whose knowledge base it
reads); it comes once, when the tenant was checked. When `done` is `true`, go to D4.
Otherwise `question` holds the one to ask: its `id`, its `ask` (the wording, in the
user's terms, with this tenant's minutes already in it), its `kind`, its `options` (each
`{id, text}`, some with `followUps`), and whether it is a `judgment` node. The script
decided the order, what is skipped and what was already answered; never ask a question
it did not return, never skip one it did, and never reword an `ask` or an option.

**A question that is not a judgment node:** ask it with AskUserQuestion, the `ask` as the
question and the `options` verbatim as the choices (one option per entry, `text` as the
label). An option whose `id` holds `<…>` carries `followUps`, one per value it needs: once
the user picks it, ask each follow-up in turn as a plain question (its `ask`; free text, no
options), then COMPOSE the value by replacing every `<key>` in the option's `id` with that
follow-up's answer — a `list` follow-up's lines as a JSON list (`["acme.com", "acme.co.uk"]`;
"none" is `[]`), a `boolean` as `true` or `false`, a `number` or `text` as written. The
user never sees the option's `id` or the composed value. Pass the user's choice back as
the option's `id`, or the composed value:

```
node .gs-superadmin/plugin/scripts/dashboard.mjs answer <dash> <question id> <value> --kb <slug>
```

A value with spaces, JSON or commas goes in single quotes. The script validates the
answer through the spec writer: if `ok` is `false`, relay `error` (it names the field or
the options) and ask the question again. If `ok` is `true`, relay `notes` when present
(for example a name resolved to a company GSID), then ask for the next question.

**A question with more than four options** (the programs question has six) is not asked
with AskUserQuestion, which shows four choices at most: ask it in chat instead, as the
`ask` followed by a numbered list of the `options`' `text` verbatim, in the script's order,
ending "Reply with the number." Match the reply (a number, or the option's own words) to
one option and continue as above, its follow-ups included; a reply that matches none is
asked again. Never offer "Other" or a "more choices" entry, and never leave an option out:
the admin decides with every choice in view.

**The two judgment nodes** — the only places this skill decides anything:

- `grouping` — the summary's `question.input.suggestionFile` is a compact table the
  script wrote from the plan's program list, exactly the programs the dashboard selects:
  programs with `model` (the model code a rule tests) and `modelName` (its display name),
  audience, folder id, whether they send surveys, whether they recur (the trait the rules
  resolve over, as the pull will read it), and sends; tallies per characteristic (the model
  tally carries code and label); the first parts of names by separator. Read THAT file (it
  holds no account, person or message). First ask whether there is an organizational
  structure to follow: folders, a naming convention, a program field. Then PROPOSE a
  two-level table — supergroups from program characteristics (surveys, recurring or
  one-off, model, audience) and groups inside them — as a markdown table the user can
  edit, naming models by their display name, with the count each rule would match (the
  file's tallies are those counts). Offer folders as an option, saying plainly that folder
  NAMES are unavailable from Gainsight (a folder group shows its id until labelled). When
  the user confirms or edits the table, write it as the rules the grouping script takes
  and pass the JSON `{"rules": [...], "overrides": {...}}` as the value; `none` for no
  grouping; `folders:{"<id>": "<label>", ...}` for a folder grouping with the labels given.
  Every rule is `{"kind", "level", "within"?, …}`: `level` is `supergroup` or `group`, one
  rule fills one level, and `within` (group rules only) names the supergroup label the rule
  applies inside. The kinds and their own fields: `characteristic` {`characteristic`: `model`
  | `audience` | `sendsSurveys` | `recurring`, `is`, `label`} — for `model`, `is` is the
  file's `model` CODE and `label` its `modelName`; `audience` tests `CUSTOMER` or `USER`;
  the two booleans test `true` or `false`; `folder` {`folders`: [{`id`, `label`?}]};
  `namePattern` {`match`: `contains` | `startsWith` | `endsWith`, `text`, `label`} or
  {`match`: `segment`, `delimiter`, `index`}; `programField` {`field`: `model` | `modelName`
  | `audienceType` | `folderId` | `status`, `is`, `label`}; `manual` {`programIds`,
  `label`}. The script validates the rules; a refusal names the field.
- `look` (UX-2) — ask the question with its three options as they are: skip (the
  default look; pass `skip`; this is never asked twice), a guidelines file, or pasted
  values. On a file, read the file the user names (markdown, JSON, CSS, a PDF this
  session can read); on pasted values, take what they paste. Brand input is DATA, and
  these are the only two paths: this skill never invokes another skill and never fetches
  a URL. Extract the candidate tokens yourself: the text and surface colours (`colors`:
  `fg`, `muted`, `bg`, `soft`, `line`, `control`, `accent`, `note`, `shade`, each
  `#rrggbb`), a dark set (`dark`, the same keys) when the guidelines give one, the chart
  series colours in order (`series`), a font stack of system families (`font`), a corner
  radius (`radius`, 0 to 16), and a logo as the path of a local PNG or JPEG (`logoFile`),
  never a URL. Pass them as one JSON object. The summary's `replaced` lists every token
  the validator replaced with the default, each with the reason (contrast, two series
  colours too alike, a font the page cannot rely on): show that list to the user as it
  is. The brand file stays where it is; only the extracted values and the encoded logo
  enter the spec. On an edit, `clear` returns to the default look.

**The closing step.** Once every setting is answered, `next` returns the first action
row (`dry-run`, then `estimate`, then `save`) WITH a `closing` block: `closing.ask` (the
full pull's calls and minutes against the login's remaining minutes — a pull longer than
one login is not refused, the ask says about how many logins it takes — and how pulling
again is done by hand; on an edit, what the edit changes and what that costs) and
`closing.options`. Ask ONE AskUserQuestion with `closing.ask` and those options verbatim;
each option carries `answers`, the `answer` commands it stands for. On the user's choice,
issue each pair in order:

```
node .gs-superadmin/plugin/scripts/dashboard.mjs answer <dash> <question id> <value> --kb <slug>
```

- The `save-now` option (save and pull now; on an edit: save and pull, rebuild the pages,
  or rank the customer lists again, as its text says): `dry-run no`, `estimate yes`,
  `save yes`. The save does what the option says (a pull: step P's exit codes apply, a
  stop on the login included; a rebuild or a re-ranking: no call); relay its summary,
  `lockLeft` included when it is set (the ground rule).
- The `dry-run` option (a dry run first; on an edit, a preview rebuilt from the last pull
  with the draft's settings, no call): `dry-run yes` renders preview pages in the theme (on a
  new dashboard it makes a cheap pull first, minutes, the login must be valid): relay
  `preview.pages` (their paths and sizes) and `preview.note` when present, and invite the
  user to open the admin page in a browser; then call `next` again and present the closing
  step it returns (without the preview option).
- The `save-only` option (save only, pull or rebuild later; or close an edit that changed
  nothing): `dry-run no`, `estimate yes`, `save later`.
- The `go-back` option ("Go back and change a setting"): ask which setting (the questions'
  ids, in the user's words), then `next <dash> --question <id>` returns that question with
  its options and follow-ups; ask it as above and pass the answer; then `next` again for
  the closing step.

`estimate yes` confirms the cost the summary quotes (its `token` is the login as read at
that moment, with `loginsNeeded`); on `no` the summary says which setting to answer again.

By exit code on any verb: `3` is the login (ask for `gs-admin login`, then run the line in
the summary's `remedy.line` when it has one, else the same command); `5` is the wrong tenant (the CLI is on another tenant than the dashboard's:
say both and stop); `4` is a stopped pull (`error` names the call that failed and says the
next run retries it: run the summary's `remedy.line` once, exactly as written, as step P
does — never re-issue the verb that started the pull: a `change` or an `answer … save yes`
has already saved, so the same command again finds nothing to change or no draft; if the
line exits 4 again, report `error`); `1` is a refusal (show `error`).

### D4 — Final report (dashboard)

```
✓ gs-superadmin email-engagement (dashboard) complete
  Dashboard:   <dash> — <title>
  Saved:       <spec path>
  Pages:       <pages>
  Last pull:   <pulledAt or "none yet">
  Pulling again: <pullAgainText>
```

`<pages>` lists each page's path from the save's pull summary (or the preview's, marked
"preview"), one per line in the same indentation. `<pullAgainText>` is the save summary's
`pullAgainText`, as written: how pulling again is done, in the admin's terms (where the
command is typed, the login, the slash command, what a pull longer than the login does).
Then stop.

**Changing one setting later** (the user says "turn customer lists on", "make it
quarterly", "rename the leaders' page"): no interview. Run the change verb with the
setting's path and value (the grammar below), first with `--dry-run` to see the consequence:

```
node .gs-superadmin/plugin/scripts/dashboard.mjs change <dash> <path>=<value> --kb <slug> --dry-run
```

`<value>` is JSON when it parses (`true`, `45`); otherwise a bare value read by the
setting's kind, one form per kind:

| Kind | Settings | Form | Example |
|---|---|---|---|
| a list of texts | the four list questions (`internalDomains`, `testAccounts`, `unsubscribeLinks`, `expectedReasons`, under `sources.0.params.`), the programs selector's `selector.names` and `selector.ids`, `pinnedAccounts`, a page's `statusDefault` | the items separated by commas; `none` empties it | `"sources.0.params.internalDomains=acme.com,acme.co.uk"`, `"sources.0.params.selector.ids=p1,p2"` |
| yes/no | `accounts.pull` | `yes` or `no` | `accounts.pull=yes` |
| text, number | a page's `title`, the dashboard's `purpose`, `selector.sentSince`, `health.silentDays` | the text itself; the number | `"pages.1.title=Leadership page"`, `sources.0.params.selector.sentSince=90d`, `health.silentDays=7` |
| an object-valued setting | the window, the groups, `accounts.lists`, `publish` | JSON from a file: `<path>=@<file>` | `publish=@publish.json` |

Put the whole pair in double quotes when the value holds a space, a comma or `<`: that
one spelling runs as written in Git Bash, PowerShell 5.1 and cmd, where a JSON string's
own quotes survive none of them — which is why an object goes through a file. A page's
copy line carries a placeholder in the value
(`"…internalDomains=<domains>"`): put the value in its place and keep the quotes. Relay
`changed` (each setting with its cost) and `consequenceText` as the script wrote it
("rebuild only", or the next pull with its minutes). Ask the user to confirm; on yes
re-issue without `--dry-run`: the script saves
and DOES the consequence (a rebuild, a re-selection of the customer lists, or the pull);
relay `done`, and `done.lockLeft`'s `text` as written when it is set (the ground rule: a
lock left behind is said on every verb). For a customer-list change, relay `done.text` as written: the lists are
ranked again now from the account store beside the last pull, with no pull. On a dashboard
whose last pull has no account store of its own (one pulled before 0.55.0, or its store
gone) they are ranked by the next pull of `/gs-superadmin:email-engagement refresh <dash>`, a
full one this once, and `done.remedy.line` is that pull's line (offer it; never run it unasked). The paths are the ones the pages' copy lines use and the ones
`node .gs-superadmin/plugin/scripts/dashboard.mjs costs` lists.

---

## P — the pull-again mode (`/gs-superadmin:email-engagement refresh <dash>`)

A saved dashboard, pulled again and rebuilt, with no model in the loop beyond this step.
Check the login first (step 1); then:

```
node .gs-superadmin/plugin/scripts/dashboard.mjs refresh <dash> --kb <slug>
```

Append `--full` when the user asked for everything to be read again, `--health-only` when
they asked for the health figures alone (the current month and the health families are
read again; the rest is carried). Start it in the background and wait for it to finish; do
nothing else with `gs-admin` meanwhile.

While it runs, the script says its progress on stderr — `pull progress: <made> of about
<planned> calls made this run · <elapsed> elapsed · about <left> left`, at the first fact
call and every tenth made call after; the first lines quote the plan's price, and once
enough of the plan has run the "left" figure is this run's own pace — and keeps the same
figures in the run's `progress.json`. When the user asks how long is left, run
`node .gs-superadmin/plugin/scripts/dashboard.mjs status <dash> --kb <slug>` and quote its
`progress` as it stands (`made` of about `planned` calls, `leftSeconds` said in minutes,
`at`); never price it from the plan or the run directory yourself, and never from an
earlier line. `progress` is null until the first fact call: the plan's reads and the
re-documentation of what the knowledge base lacks run first (minutes, when it lacks a lot)
— say that the pull is being planned and re-documenting, and ask again in a minute. The
"left" figure is an estimate from the plan's remainder and tends to read high near the end. The minutes a pull is priced at come from this dashboard's last finished
pull (its `pace.json`, written beside the spec at the end of every pull): a first pull
here is priced from the plan's own figures.

By exit code:

- `0` — relay the summary: `pull.mode` and `pull.why`, `pull.programs`, `redocumented`
  (how many programs and templates the knowledge base gained, and what is still behind),
  `delta` (the change since the last pull, or null on a first one), the pages' paths and
  sizes, `lockTakenOver` when a stale lock was taken over, `lockLeft` when the pull's lock
  could not be removed at its end (relay its `text` as written: the next pull takes it over
  on its own, and nothing needs doing), `abandoned` when a pull
  stopped earlier was left behind because a setting changed since (the pull was planned
  afresh), and `restarted` when a resumed pull started again in a fresh run directory
  because the derived health lookback moved since the run was planned (its `from` and
  `run` name the two directories, its `lookbackDays` the move): say that none of the calls
  already made applied.
- `3` — the login expired, before the pull or during it. A pull longer than one login is
  expected and keeps every call it made: relay the summary's `error` (it says how many
  calls were made and about how many more logins the pull needs), ask the user to run
  `gs-admin login` (a browser flow they complete by hand), then run the summary's
  `remedy.line` exactly as written (it carries this run's own `--full` or
  `--health-only`, which the pull needs to continue); it continues where it stopped, and
  the last good pages are untouched.
- `4` — a call failed: `error` names the call (its family, the programs it covered, the
  cause, and in how many runs it has failed so far) and says the next run retries it.
  Run the summary's `remedy.line` once; if it exits 4 again, report `error` (a cause that
  recurs run after run is the server's, not a transient); the pages are untouched.
- `5` — the CLI is on another tenant than the dashboard's: say both tenants and stop.
- `1` — refused (another pull of it is running, its holder and time named; an earlier pull
  stopped with other flags and waits, its `remedy.line` the one to run; the knowledge
  base's manifest is locked by another writer — another dashboard's pull, or a describe, is
  re-documenting it, and the lock clears on its own once that process finishes or is gone;
  or the script's own reason): relay `error` and stop.

On exit 0 the summary's `publish` says what became of the leaders' copy; relay it with the
final report's Leaders line, and when its `target` is `claude-artifact` and `ready` is
true, do step L2 now.

```
✓ /gs-superadmin:email-engagement refresh <dash> complete
  Dashboard:   <dash>
  Pull:        <pull.mode> (<pull.why>) · <pull.programs> programs · pulled <pull.pulledAt>
  Knowledge base: <redocumented.programs.documented> programs and <redocumented.templates.documented> templates documented; <redocumented.programs.remaining + redocumented.templates.remaining> left for next time
  Change:      <delta line>
  Pages:       <pages>
  Leaders:     <leaders line>
```

`<leaders line>` follows step L's rule for the summary's `publish`.
`<delta line>` is "first pull, nothing to compare with" when `delta` is null; otherwise
`since <delta.previousPulledAt> over <delta.closedMonths> closed month(s)`. `<pages>` lists
each page's path, one per line in the same indentation. Then stop.

---

## L — the leaders' copy (`publish <dash>`, and after every pull)

The leaders' page goes where the dashboard's `publish` setting says, with no pull. Every
pull and rebuild publishes it at its end; this step does it on its own, for a monthly
publish by hand or after a setting changed:

```
node .gs-superadmin/plugin/scripts/dashboard.mjs publish <dash> --kb <slug>
```

Read the summary's `publish` and say it in one line (the final report's Leaders line):

- `target` `file-copy`, `published` true — "copied to `<file>` (the same file each
  time)", plus the dated copy and the data folder (`datasets.folder`, its CSV files) when
  present. A leader opens that one file, or the folder, whenever they want the latest.
- `target` `file-copy`, `published` false — relay `why` as written. With a `remedy`,
  the folder is not set on this computer: ask the user for the folder's full path (a
  OneDrive, SharePoint or network folder synced to this computer), then run the
  `remedy.line` with `<folder>` replaced by it, single-quoted, and then `publish` again.
  The folder is kept on this computer only, never in the dashboard. With a `partial`, the
  copy is NOT whole: say "the copy is not whole" and list `partial.notReplaced` (those
  files still hold the previous publish), then ask the user to close whatever holds them
  open and run the `publish` line again.
- `target` `claude-artifact` with `ready` true — step L2.
- `target` `none` — "kept in the workspace only".

### L2 — Publish the artifact (not offered; only for a dashboard already set to it)

The interview and the README no longer offer this target: the Artifact tool reads the
whole of a file it did not write before publishing it, and a real leaders' page takes
several turns to read, every publish. This step is reached only when a dashboard was set to
`claude-artifact` before; say so, and offer the shared folder instead: write the publish
setting as JSON to a file in the workspace's `.gs-superadmin/tmp/` folder (its content
`{"target":"file-copy","config":{"to":"leaders","file":"<dash>-leaders.html","datedCopies":false,"datasets":true}}`),
run `change <dash> publish=@<that file>` (an object-valued setting takes its JSON from a
file: inline JSON survives no Windows shell), then `publish-target`. If the user still wants the artifact,
publish the file the summary names (`publish.file`) with the Artifact tool, once:
`file_path` that file, `title` the summary's `publish.title`, `capabilities` exactly
the summary's `publish.capabilities` (`{"downloads": true}`: without it the page's
Download CSV is refused inside the artifact), and `url` the summary's `publish.url` when
it is set, so the same link is updated and the leaders' bookmark holds. When `publish.url`
was null, record the new link once with the line the summary's `next` names (a
`change` of `publish.config.url`: a rebuild with no pull, which writes the artifact file again but publishes nothing, since only this step can); never publish a
second time in the same request. Say what the artifact is: a private link, opened by
people in the organization with their Claude account once it is shared with them from the
artifact's Share menu; a filtered view cannot be bookmarked there (the address bar keeps no
filters); viewers pay nothing.

---

## A — one account's timeline (`/gs-superadmin:email-engagement account '<name>'`)

Every Journey Orchestrator email one account received over the last N days or months, by
program and day, in a page of its own. Use it when the user asks what a customer was sent
("what have we emailed Acme Corp lately?", "show me Acme's email history"). The account is
the finest grain: its contacts are added up and never named, and no contact-level ask is
answered here. Check the login first (step 1); then:

```
node .gs-superadmin/plugin/scripts/dashboard.mjs account --account-name '<name>' --kb <slug>
```

Substitute `<name>` with the company's name as the user gave it, single-quoted (rule canon:
operating model, shell quoting); when the user gave the company's GSID instead, write
`--account-id <gsid>` in place of `--account-name '<name>'`. Add `--last <Nd|Nm>` when the
user named a period (`--last 6m`; 90 days unless asked, at most 24 months). When the ask
names a saved dashboard (or came from a dashboard page's copied line), put its name right
after `account` (`account <dash> --account-id …`): the dashboard then decides who is
internal, the timeline is checked against the dashboard's latest pull of the same account,
and the page sits beside the dashboard's pages. Without a dashboard, pass the company's
own domains and test accounts the way the report mode does (`--internal-domain`,
`--test-account`), when the user named them.

Start it in the background and wait for it to finish; do nothing else with `gs-admin`
meanwhile. By exit code:

- `0` — relay the summary: `account.name`, `window` (its `last`, `start` and `end`), `sent`,
  `programs`, `reconciled` (and, when a dashboard was named, `against`: compared, or the
  reason it was not), and the `page` path.
- `6` — the name matched several accounts, or none exactly (`resolution.candidates`, each
  with its `key` and its `sent` over the same days). Nothing was pulled and nothing is
  guessed. When there are candidates, show them as a numbered list (name, GSID, sends) and
  ask which one; then re-issue the command with `--account-id <the chosen key>`. When
  `resolution.candidates` is empty (no account has that name, or no account has that GSID),
  relay `error` and ask the user for the company's exact spelling or its GSID; re-issue
  with what they give.
- `3` — the login expired: relay `error`, ask the user to run `gs-admin login`, then
  re-issue the same command; it continues where it stopped.
- `4` — a call failed: relay `error`, re-issue once, then report.
- `5` — the CLI is on another tenant than the knowledge base's (or the dashboard's): say
  both tenants and stop.
- `1` — refused: relay `error` and stop.

```
✓ /gs-superadmin:email-engagement account complete
  Account:   <account.name> (<account.key>)
  Days:      <window.start> to <window.end> (the last <window.last>)
  Sends:     <sent> from <programs> program(s)
  Checks:    <checks line>
  Page:      <page>
```

`<checks line>` is "ok" when `reconciled` is true and no dashboard was named; "ok; not
compared with the dashboard: it has no pull yet" when a dashboard was named and
`againstSnapshot` is null; "ok, and
equal to the dashboard's own rows of this account" when `against.compared` is above 0;
"not compared with the dashboard: <againstText.reason>" when `against.reason` is set; after
either dashboard line, each `againstText.notCompared` entry, if any, as "not compared:
<programs, comma-separated>: <reason>"; and
"FAILED: <the failed checks' ids>" when `reconciled` is false (then also say the figures are
unreliable and suggest pulling again). Then stop. Only someone with a `gs-admin` login can
run this; anyone else sees an account only through a dashboard page's one-account view.
