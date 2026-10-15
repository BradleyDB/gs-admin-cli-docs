# gs-superadmin

A Claude Code plugin that gives you a persistent, per-tenant Gainsight admin workspace.
One setup run bootstraps your environment; subsequent sessions pick up right where you
left off. In short:

- **A local knowledge base of your tenant** — every rule, journey, scorecard, report,
  connector, … indexed and documented as markdown Claude can cite.
- **Everyday admin skills** — drift detection, naming audits, deprecations, reviewable
  change plans, email/schedule reports, email engagement reports, tenant-wide impact
  analysis, upstream bug reports.
- **A safety net** — every `gs-admin` command the CLI catalog marks mutating triggers a
  human approval prompt, and approved changes are journaled. Reads run freely;
  catalog-mutating commands ask (see [the gate you're relying on](#how-the-plugin-protects-your-tenant)
  for the commands the catalog mislabels).

> **Currency.** This document was last updated on 2026-09-26 (against
> `@gainsight/gs-admin-cli@1.0.10`) with reference to Gainsight's then-current pre-built and
> generally available Admin CLI package. Gainsight may have updated its documentation and
> available Admin CLI package since then. You can always find the latest version of
> Gainsight's documentation and Admin CLI package at
> [support.gainsight.com](https://support.gainsight.com).
>
> Because this process wasn't built or endorsed by Gainsight, it's possible that a later
> update to the Admin CLI package will interfere with the intended function set forth in
> this document. You can always check [support.gainsight.com](https://support.gainsight.com)
> for the latest information and Admin CLI package.

## Quick start

**1. Prerequisites** — Node.js 20 or newer on your PATH, the `gs-admin` CLI installed
globally, and a login to your tenant (use the address you open Gainsight with):

```bash
npm i -g @gainsight/gs-admin-cli
gs-admin login --base-url https://YOUR_TENANT.gainsightcloud.com
gs-admin whoami     # confirm you're on the right tenant
```

New to the terminal, or to the tenant OAuth app the login needs? Start at the
[repo README's step 1](../../README.md#1-prerequisites), which begins from nothing installed.

**2. Install the plugin** from this repo's marketplace:

```bash
claude plugin marketplace add BradleyDB/gs-admin-cli-docs
claude plugin install gs-superadmin@gs-admin-cli-docs
```

(Or interactively: `/plugin marketplace add BradleyDB/gs-admin-cli-docs`, then pick
**gs-superadmin** from `/plugin`. Developing locally instead?
`claude --plugin-dir /path/to/gs-admin-cli-docs/plugins/gs-superadmin`, then
`/reload-plugins` inside the session.)

**Then turn on auto-update** — `/plugin` → **Marketplaces** → `gs-admin-cli-docs` → enable
auto-update. Third-party marketplaces ship with auto-update **off**, and there is no
new-version notification, so this one toggle is what actually delivers fixes to you —
including guard-hook fixes. To update by hand instead, take **both** steps — refreshing
the marketplace alone only re-reads the catalog, it does not upgrade an installed plugin:

```bash
claude plugin marketplace update gs-admin-cli-docs        # refresh the catalog
claude plugin update gs-superadmin@gs-admin-cli-docs      # actually install the new version
```

**3. Bootstrap a workspace** — `cd` into the directory you want to work from (a new empty
folder is fine), start Claude Code, and run:

```
/gs-superadmin:setup
```

Setup verifies the CLI and your login, confirms a workspace name for the tenant (e.g.
`acme-prod/`), then indexes your assets and documents the first 25. Re-run
`/gs-superadmin:setup` any time to keep documenting in batches.

**4. Use it** — ask questions ("which rules write to the Company object?"), or run any
skill from the catalog below, e.g.:

```
/gs-superadmin:email-report search --query 'renewal reminder' --active-only
```

## Skills at a glance

> **How invocation works — read this first.** Most skills fire **only** on their exact
> slash command: typing "audit my rule names" in plain English does nothing — you must
> type `/gs-superadmin:audit`. Exactly three skills — `email-report`, `email-engagement`
> and `deps-report` — are also triggered by natural-language questions ("which emails
> mention X?", "what's the open rate for program Y?", "what breaks if I change this
> field?"). The table's **Invoke** column marks each one.

| Skill | What it does | Invoke |
|-------|--------------|--------|
| [`/gs-superadmin:setup`](#set-up--grow-the-knowledge-base) | Bootstrap or resume the workspace: index every asset, document them in budgeted batches | slash only |
| [`/gs-superadmin:refresh`](#detect-changes) | Detect assets changed since the last run and mark them stale | slash only |
| [`/gs-superadmin:audit`](#audit-naming-conventions) | Check asset names against your naming convention; apply renames only after you approve | slash only |
| [`/gs-superadmin:deprecate`](#deprecate-an-asset) | Walk an asset through the deprecation checklist | slash only |
| [`/gs-superadmin:change-request`](#plan--execute-a-config-change) | Turn a ticket or request into a reviewable, KB-cited implementation plan | slash only |
| [`/gs-superadmin:email-report`](#report-on-jo-emails--schedules) | Read-only Journey Orchestrator email & schedule reports (4 modes) | slash + natural language |
| [`/gs-superadmin:email-engagement`](#report-on-email-engagement) | Read-only open-rate and engagement report across JO programs from the tenant's send log, an engagement dashboard built once and pulled again by hand whenever new numbers are wanted, and one account's email timeline by day | slash + natural language |
| [`/gs-superadmin:deps-report`](#tenant-wide-dependency-search) | Tenant-wide "what depends on this object/field/connection?" impact analysis | slash + natural language |
| [`/gs-superadmin:report-bug`](#report-a-cli-bug-upstream) | Capture a `gs-admin` CLI misbehavior as a vendor-ready bug report | slash only |

Every skill except `setup` expects a bootstrapped workspace — if you haven't run
`/gs-superadmin:setup` yet, they'll tell you to. `audit` and `deprecate` additionally
need a convention to check against (setup offers a bundled build-standards pack, or
bring your org's own — see below).

## Set up & grow the knowledge base

```
/gs-superadmin:setup
/gs-superadmin:setup --budget 50
/gs-superadmin:setup --all
```

Runs all 6 phases: precheck → identify → scaffold → index → document → synthesize. It
creates a managed `CLAUDE.md` block, the operating model, and the per-tenant KB folder;
indexes every Gainsight asset into a resumable local manifest; and documents assets in
budgeted batches (default 25 per run — re-run to continue). On every run, setup generates
the workspace catalog — and renders the cheatsheet from it — directly from the installed
CLI's own manifests (falling back to the plugin's bundled snapshot only if generation
fails), so the mutation guard never depends on plugin release cadence.

Documentation proceeds **one domain at a time** (smallest first), with an optional
pause-and-verify checkpoint after each domain. On the first documentation run, setup asks
**Shallow or deep crawl?** — shallow fully documents every domain with ≤ 100 assets and
writes metadata-only stubs (from the list payload, no describe calls) for larger ones,
e.g. a tenant with 1,300+ email templates; deep describes everything. Stubbed domains can
be fully ingested later, per domain and budget-respecting:

```
/gs-superadmin:setup --deep journey-email-templates --budget 200
```

**Build standards, opt-in**: setup offers a bundled build-standards pack (query building,
rule-naming syntax, report standards, deprecation process) copied to
`.gs-superadmin/conventions/` as an editable starting point. Decline it once and it never
asks again — orgs with their own guide just use their own files. Claude loads only the
topic relevant to the task at hand.

## Detect changes

```
/gs-superadmin:refresh
/gs-superadmin:refresh --document --days 14
```

Looks back to the last refresh and marks changed assets stale. Pass `--document` to also
re-document them (fingerprint-gated: unchanged payloads aren't rewritten).

## Audit naming conventions

```
/gs-superadmin:audit --domain rules
/gs-superadmin:audit --domain rules --deep
```

Checks names against the workspace convention (`.gs-superadmin/conventions/naming.md` or
your own `CONVENTIONS.md`) and writes a violation report with proposed fixes. Add `--deep`
to have flagged rules described and complete conforming names proposed. Renames are applied
**only after you approve the exact list** — and since CLI 1.0.8 both rename lanes are
catalog-mutating (`re r edit` for rules, `sc update` for scorecards), so expect one guard
prompt per rename on top of the skill's confirmation step, which remains the gate.

## Deprecate an asset

```
/gs-superadmin:deprecate 'DATA|USER|MODIFY Assign License' --ticket GAIN-1247
```

Runs the workspace deprecation checklist: date-prefix rename, description prefix, folder
move, and schedule removal (what the CLI supports — for **rules**; report edits have no
safe CLI write and are entirely UI-only), then lists the remaining UI-only steps
(rule-chain removal, deactivation, report rename/description/privacy, dashboard cleanup).

## Plan & execute a config change

```
/gs-superadmin:change-request ticket.md --ticket CSOPS-142
/gs-superadmin:change-request "add a risk CTA rule when NPS < 6 for Enterprise"
```

Accepts a Jira ticket (with or without its machine-readable handoff block), a request-event
JSON file, or a pasted ask. Reads the tenant KB for impact analysis (what else touches the
same objects/fields), applies the workspace naming convention, and writes a reviewable plan
— commands, verification, rollback — to `<slug>/changes/<date>-<change-slug>.md`. The
request-event schema and ticket anatomy are vendored frozen contracts (canonical:
`BradleyDB/CS_GTM_Tools`).

The plan also has a **Before building** section: what a good CS Ops admin would say about
the ticket if they had time to think it over — not just whether it can be built, but what
it does to the CS team's strategy, the CSMs who'll work it, the data it depends on, and
the customers on the other end. Where the build as asked doesn't fit, it says what would
and what that costs. Where the ticket left something open, it says which way the plan went
and asks the question, so you can confirm it in a glance or send it back to the requester.
When there's nothing to add, it says so in one line. The plan is written on the ask as
stated either way — nothing waits on you — and the chat summary shows the one line you
most need before you open the file.

The lifecycle, end to end — the key point is that **drafting is always safe**:

1. **Draft** — `/gs-superadmin:change-request ticket.md --ticket CSOPS-142` writes the
   plan file. Nothing is executed at drafting time, ever.
2. **Review** — open the plan, check the impact analysis, the *Before building* read, names,
   command sequence, and rollback. Edit or discard freely; it's just a markdown file.
3. **Execute** — a separate, explicit ask ("execute the CSOPS-142 plan"). Commands run
   one at a time, each catalog-mutating command behind the approval prompt. The plan's
   guard-coverage section names the steps that will run without one — your approval of
   the plan is their gate.
4. **Journal** — every executed guard-approved command lands in
   `<slug>/changes/JOURNAL.md` stamped with the plan's ticket key, a completion entry
   summarizes the plan, and for ticket-driven changes the skill drafts the ticket
   completion comment for your approval (posted via your own Jira access — never
   automatically). "What did CSOPS-142 touch?" is then answerable from the journal.

## Report on JO emails & schedules

```
/gs-superadmin:email-report search --query 'renewal reminder' --active-only
/gs-superadmin:email-report program --name 'Onboarding|Welcome Series' --deep
/gs-superadmin:email-report audit-active --include-paused
/gs-superadmin:email-report deps --object 'Company Person' --field 'Nominee Email' --scan-tokens
```

Also answers natural questions — "which emails mention the Q3 promo?", "what does the
onboarding journey send?", "what's scheduled right now?" — without the slash command.

Read-only reports over Journey Orchestrator email templates and programs, in four modes:

- **search** — every template containing a phrase, with the programs using each hit.
- **program** — one program's full email inventory; `--deep` adds bodies, variants, and
  a per-email token table.
- **audit-active** — schedule audit of everything PROCESSING: recurring vs one-time,
  cron schedules humanized.
- **deps** — object/field usage in participant sources, classified filter vs
  projected/show field; also captures Gainsight's own `dm deps check` answer per object
  and renders its dependents reconciled against the KB view.

Reports land in `<slug>/reports-adhoc/` with a mandatory "Caveats & data gaps" section;
add `--csv` or `--xlsx` for spreadsheet output (`--addbody` opts full body text into the
program CSV). Email `${...}` tokens render as their display names (`{Product Name}`) on
every surface — the program's own binding wins, the template's author label is the
fallback, and unresolvable ids stay raw. Each email step also names its bound survey.
Field matching is case-insensitive exact (never substring); when the workspace
`CONVENTIONS.md` declares a task-alias prefix, a prefixed field like `A_Some Field` also
matches `Some Field`, with near-misses listed but never counted. The skill refreshes
statuses with a live sweep and offers a budget-gated KB gap-fill first — single-quote
names (they contain `|`), and note the audit's per-step sends column is honestly
`not available via CLI`. Never mutates the tenant.

## Report on email engagement

```
/gs-superadmin:email-engagement report --sent-since 90d --internal-domain acme.com
/gs-superadmin:email-engagement report --name 'Onboarding|Welcome Series' --by-template --step-detail
/gs-superadmin:email-engagement report --accounts --xlsx
```

Also answers natural questions — "what's the open rate for the onboarding program?",
"which programs have low open rates?" — without the slash command.

Where `email-report` says what your emails say and when they run, this says how they
performed. It reads the tenant's send log through read-only `gs-admin` calls into one
snapshot file, then writes a report from it:

- **A headline by status** and **one row per program**: sent, unique recipients, accounts
  reached, delivered, opened and open rate side by side, then clicks and bounces.
- **Survey responses** for programs that sent a survey: submitted, partially submitted,
  any response, and the response rate.
- **`--by-template`** — one row per program and template, with the step it sits on and
  the template's subject as the knowledge base holds it; and one row per step and variant
  when the pull ran with `--step-detail`. The pull reads each template's current text from
  the knowledge base and offers to fetch the templates it lacks, through email-report's own
  gap-fill, so they land there too.
- **`--accounts`** — the customer lists across programs: the 25 most engaged, the 25
  least engaged (among accounts with at least 10 delivered; on a program that sends about
  once per contact, at least 3 delivered and no open) and the 25 most bounced, each with
  the programs it is on. Per-program lists are off unless you set their numbers. Account
  data is off unless you pass the flag, because ranking every account is most of a pull:
  on a large tenant it turned a pull of a few minutes into about half an hour. Without it
  the report says so where the lists would be; it never shows an empty list.
- **How each number is calculated** — for every metric shown: the Gainsight object it is
  read from, the fields and the value that counts, the filters every count carries, the
  date field, and the calculation. You can rebuild any figure in a Gainsight report and
  compare.
- **Caveats & data gaps**, always, with the date and time the data was pulled.

Things worth knowing before you read the numbers:

- **Sent is every attempt; Delivered is what went out and did not bounce.** Open rate and
  click rate divide by Delivered. The Gainsight program analytics page uses the same words
  for different counts, and the glossary says how they differ.
- **Clicks count content links only**, not unsubscribe or mailto links, so they will rarely
  match the Gainsight UI. If your unsubscribe link is a page on your own site, name it with
  `--unsubscribe-link`. Click tracking is often off: a click cell reads a number when
  clicks are tracked (a 0 is a real 0), `Not tracked` when no link is tracked, and a
  number marked `(tracking unknown)` when the data cannot tell.
- **Unique recipients and accounts reached are exact per program** and are never added
  across programs.
- **The current month is provisional**: opens keep arriving.
- **The pull takes minutes, not seconds.** The skill prints the estimate first and asks
  before a pull of more than about ten minutes. `--sent-since 90d` or `--name` narrows it.
  A pull the login expires under stops cleanly and continues where it stopped after
  `gs-admin login`. A call the server will not answer (a timeout that survives its retry)
  stops the pull the same way, naming the call: the next run retries it and continues.

Reports land in `<slug>/reports-adhoc/` beside the snapshot they were written from;
`--csv` or `--xlsx` adds spreadsheet output, and `--snapshot <file>` writes a report from
a snapshot you already have without pulling again. Program status never limits what is
pulled: the tables show Active programs unless you named programs, `--include-paused`
adds Paused ones, `--all` shows every status, and the report states how many it hides.
Never mutates the tenant. For one program's own numbers, Gainsight's analytics page for
that program is the place; this skill is for the comparisons the UI cannot make.

### The engagement dashboard

```
/gs-superadmin:email-engagement dashboard new program-health
/gs-superadmin:email-engagement dashboard new program-health --fast-path
/gs-superadmin:email-engagement dashboard edit program-health
/gs-superadmin:email-engagement dashboard list
/gs-superadmin:email-engagement refresh program-health
/gs-superadmin:email-engagement account 'Acme Corp' --last 6m
```

Set a dashboard up once and pull it again when needed, instead of calling a skill for every
question. `dashboard new` is an interview, one question at a time, in an admin's terms: it
opens by saying which tenant the dashboard is for, then asks which programs (those that sent
in the last 90 days by default), which months the pages cover (rolling, fixed, or since a
month, with this tenant's minutes per month), how to group the programs (proposed from
their characteristics, or by folder, or a naming convention), the company's own domains and
test accounts (company records, by name or GSID, never addresses), the unsubscribe link, two
health settings, the look (brand guidelines as a file or pasted values; a logo from a local
PNG or JPEG), the tabs per page with the minutes the Health tab adds, the customer lists
(off by default, with their cost) and, when they are on, whether the leaders' page may carry
them with names and how the lists are built, step detail with its minutes, the
tenant's own expected failure reasons, and where the leaders' copy goes. It closes with one step: the full refresh's calls
and minutes against your login, and the choice to save and refresh now, run a dry run
first (preview pages on real data), save only, or go back. Every option is a plain choice;
a value an option needs (a date, a number of months, a list of names) is asked for on its
own. `--fast-path` takes every question's default and goes straight to the closing step.
Everything mechanical runs through one command,
`node .gs-superadmin/plugin/scripts/dashboard.mjs`, with no model in the loop: the skill is
its front door, and the command works on its own.

The pages are self-contained HTML files under `<slug>/dashboards/<name>/` (`latest-admin.html`,
`latest-exec.html`), with global filters (months, a searchable program list, groups, status,
internal recipients), tabs (Engagement, Health, Templates, About), charts, sortable tables
with a CSV download, and an About tab that opens with what the dashboard is and is generated
from the dashboard's own settings. The header says when the data was pulled and how many
days ago, and that the pages are not live: they change only when the dashboard is refreshed,
by hand. Thirteen snapshots are kept beside them. The admin page also has a one-account view:
pick an account the customer lists kept (or View beside its name in a list) to see its sends
month by month, with the line that pulls its days.

**Pulling again.** A refresh checks that the CLI is on the dashboard's tenant before any
call (a production dashboard is never refreshed from a sandbox), says how many logins a
pull of this size takes, takes a lock so a second refresh is refused by name,
brings the knowledge base up to date for the dashboard's programs (the ones modified since
they were documented, and the never-documented, plus the email templates it lacks, up to 50
per pull with no model), pulls, keeps the snapshots, rebuilds the pages, and shows the change
since the last pull on the headline figures. The first pull is full and takes minutes to
tens of minutes on a large tenant; later ones are selective (the recent months only) and
shorter. A pull that stops (the login expired, a call failed) leaves the last good pages
untouched and continues on the next run, and a setting changed in between does not strand
it: the pull is then planned afresh for the new settings.

Every line below names the tenant's knowledge-base folder with `--kb <folder>` (here
`acme-prod`): a workspace can hold more than one tenant, and the command refuses to guess
which dashboard folder a bare slug means. The pages' own copy lines carry it the same way.

- **On demand:** `/gs-superadmin:email-engagement refresh program-health` in a session, or
  from a terminal in the workspace folder with no session at all, after `gs-admin login`
  if your last login was more than an hour ago:

  ```bash
  node .gs-superadmin/plugin/scripts/dashboard.mjs refresh program-health --kb acme-prod
  ```

- **A pull longer than one login.** The `gs-admin` login lasts about an hour, the CLI never
  refreshes it, and every login is a browser flow you complete by hand (see the operating
  model and `reference/auth.md`). A pull that needs longer is not refused: it runs as far
  as the login allows, stops cleanly with exit code 3 keeping every call it made, and the
  pages stay as they were. Log in again and run the same line: it continues where it
  stopped. The interview's closing step and the refresh itself say about how many logins a
  pull of that size takes; plan around that number. A first pull on a large tenant, and a
  selective one with Health on and several recipient classes, can each take two.
- **Health only, between full refreshes** (the current month and the health families are
  read again, the rest carried; on a tenant with many bounce categories the health calls
  are most of the time, so this is shorter than a full refresh but not by much):

  ```bash
  node .gs-superadmin/plugin/scripts/dashboard.mjs refresh program-health --health-only --kb acme-prod
  ```

- **Scheduled.** A task on your own machine can run the refresh for you, never a cloud
  routine (it cannot reach the keychain token). Because every login is by hand, a scheduled
  run succeeds only when you logged in within the hour before it fires: a firing with no
  recent login exits 3 and leaves the pages alone, and the next firing after you log in
  resumes it and finishes. So the schedule is a reminder with the run attached: log in
  shortly before it fires. The recipe is a runner script (it sets the working directory,
  runs the refresh line and keeps a log), one line to create the task, and one to delete it.

  Windows: save this as `refresh-program-health.cmd` in the workspace folder (replace the
  path and the folder name):

  ```bat
  @echo off
  cd /d C:\path\to\workspace
  node .gs-superadmin\plugin\scripts\dashboard.mjs refresh program-health --kb acme-prod >> dashboards-refresh.log 2>&1
  ```

  then create the task (monthly, the 1st at 09:00; `/SC WEEKLY /D MON` for weekly), run it
  once by hand to see it work, and delete it when the dashboard retires:

  ```bat
  schtasks /Create /TN "gs-dashboard program-health" /SC MONTHLY /D 1 /ST 09:00 /TR "C:\path\to\workspace\refresh-program-health.cmd" /F
  schtasks /Run /TN "gs-dashboard program-health"
  schtasks /Delete /TN "gs-dashboard program-health" /F
  ```

  From a Git Bash prompt put `MSYS_NO_PATHCONV=1` in front of each `schtasks` line: that
  shell otherwise rewrites `/Create` into a path. The task opens a console window while it
  runs (the scripts' `npm root -g` lookup and the refresh's progress lines); nothing in it
  needs a click, and the log holds what it printed.

  macOS and Linux: save this as `refresh-program-health.sh` in the workspace folder and
  `chmod +x` it:

  ```bash
  #!/bin/sh
  cd /path/to/workspace || exit 1
  node .gs-superadmin/plugin/scripts/dashboard.mjs refresh program-health --kb acme-prod >> dashboards-refresh.log 2>&1
  ```

  then add one line with `crontab -e` (monthly, the 1st at 09:00; `0 9 * * 1` for Monday
  mornings) and remove that line the same way when the dashboard retires:

  ```
  0 9 1 * * /path/to/workspace/refresh-program-health.sh
  ```

  A Claude desktop local task that runs the same runner script works the same way.
- **Changing one setting:** `node .gs-superadmin/plugin/scripts/dashboard.mjs change
  program-health accounts.pull=true --kb acme-prod --dry-run` says what the change costs (a
  rebuild with no pull, a re-selection of the customer lists, or the next pull with its
  minutes, priced for the dashboard as it will be after the change); without `--dry-run` it
  saves and does it. The value is JSON: a text setting goes in JSON quotes inside the
  shell's (`'pages.1.title="Leadership"'`). The lines the pages offer to copy are these.
- **Handing over to a backup refresher:** `… export program-health --out handover.json
  --with-snapshot --kb acme-prod`, then on their machine `… import --file handover.json --kb
  acme-prod`: their first pull is selective, with a change against yours. No lock is shared
  across machines.
- **The leaders' copy** is the leaders' page, `latest-exec.html`. It holds no account rows
  unless the dashboard opted in, and no internal domain or unsubscribe link values. It goes
  where the dashboard's `publish` setting says: the interview asks, and `change` sets it.

  *A shared folder, the default.* Every successful refresh and rebuild copies it into a
  folder synced to your machine (OneDrive, SharePoint, a network share), as
  `<dashboard>-leaders.html`, the SAME file every time: a leader bookmarks that one file,
  or the folder, once, and it is current after each refresh. Beside it, in
  `<dashboard>-leaders-data/`, go its tables as CSV files named with the dashboard's name
  (`<dashboard>-<table>.csv`) and a `<dashboard>-definitions.csv` (what each figure means,
  the caveats, the filters, when the data was pulled), overwritten the same way, so a file
  dragged out of the folder still says which dashboard it came from. A refresh that fails
  or stops copies nothing: the folder keeps the last copy, as the workspace keeps the last
  pages. A copy that fails (the folder gone, a file locked by the sync) is said in the
  summary and leaves the workspace's pages as they are; when it failed part-way, the
  summary reads `published: false` and its `partial` names the files this publish replaced
  and the ones still holding the previous publish, so run `publish` again once the file is
  free. The refresh's summary, and the scheduled run's log, say where the copy went.

  The folder lives on your machine, not in the dashboard: the dashboard names a target
  (`leaders`), and one line maps it to the folder, once per machine. A backup refresher who
  imports the dashboard runs it on theirs; until then each refresh says the copy was
  skipped and why.

  ```bash
  node .gs-superadmin/plugin/scripts/dashboard.mjs publish-target leaders 'C:\path\to\OneDrive - Acme\Leadership' --kb acme-prod
  ```

  Opening it: from File Explorer (or Finder) the synced file opens in the browser and works
  whole, filters, tabs and Download CSV included; on the OneDrive website it opened as a
  preview with an "open" option, no download step, where this was measured. SharePoint and
  Teams were not measured: they may download an HTML file rather than show it, and a leader
  then opens it in two clicks (download, open). Dated copies beside the same-name file are
  an option, off by default: `change program-health publish.config.datedCopies=true --kb
  acme-prod`.

  *Monthly by default, with your refresh, and by hand.* Each refresh publishes the leaders'
  copy (on demand or the scheduled recipe above); this line publishes it on its own, with
  no pull:

  ```bash
  node .gs-superadmin/plugin/scripts/dashboard.mjs publish program-health --kb acme-prod
  ```

  *What it costs.* Viewers pay nothing: the leaders' copy is a file or a page of files, so
  opening it runs no query and no session; the publish is a file copy, with no Claude
  session. The interview is one Claude session; a refresh is `gs-admin` calls only.
- **A program's failure text** (the masked messages and the "Other" samples) is shown by
  `… health program-health --program <id>` in the terminal, never on a page.
- **One account's timeline:** `/gs-superadmin:email-engagement account 'Acme Corp'` in a
  session, or `… account program-health --account-id <GSID> --kb acme-prod` (the line the
  admin page's one-account view offers to copy). It pulls that account's emails by program
  and day over the last 90 days (`--last 6m`, up to `24m`, for longer) into a page of its
  own: one lane per program, a mark per email and day, filled when opened, the account's open
  rate beside every recipient of the same programs over the same days, a table with its CSV.
  The account's contacts are added up and never named. A name that matches several accounts,
  or none exactly, lists the candidates with their GSIDs and pulls nothing (exit 6): give the
  GSID. With a dashboard named, its internal domains and test accounts decide who is internal,
  the timeline is checked against the dashboard's own rows of that account, and the files sit
  in `<slug>/dashboards/<name>/accounts/`; without one, in `<slug>/reports-adhoc/`. It needs
  a `gs-admin` login, so only an admin can run it; anyone else sees an account only through the
  page's one-account view.

Everything the dashboard shows is in the workspace: the spec, the snapshots and the pages
are tenant data under `<slug>/`, git-ignored like the rest of the knowledge base.

## Tenant-wide dependency search

```
/gs-superadmin:deps-report --object company_person --field 'ARR'
/gs-superadmin:deps-report --connection 'SNOWFLAKE' --csv
```

Also answers natural questions — "what breaks if I change the ARR field?", "what uses
the Snowflake connection?" — without the slash command.

Impact analysis before a schema or connection change, across every KB-documented
domain: which rules read or write the object/field (source objects, filter conditions,
write targets), which journeys reference it in participant sources, which reports show
or filter on it, which connector jobs map it, which data designers query it, and which
scorecard measures are set by the matching rules. `--connection` takes a connection
name, GUID, or type (SFDC / S3 / SNOWFLAKE, …); assets that record only a connection
type are matched honestly as `type-level`, never passed off as exact. For each
`--object` the skill also captures `dm deps check` (Gainsight's own dependency scan,
all areas) and renders it reconciled against the KB view. Every deps report also
resolves **participant-source provenance** — where each matched program's source data
comes from, to the resolvable ceiling: a Data Designer source resolves to its KB doc, a
CSV source shows its uploaded filename, and a **Power List** resolves to the objects,
connection and output fields its rule's tasks read (the rule is hidden from `re r list`
but described by its id; refresh and setup document it — so `--object Contact` or
`--connection <SFDC connection>` matches the journeys that read through a Power List).
What the CLI does not return is said: a Power List's filter criteria, and a dynamic
program's own participant query. The program's dynamic fields and branch conditions
are scanned too. Everything is KB-cached and the report says so —
the JO-scoped sibling is `email-report deps`; this is the tenant-wide superset.
Read-only. **Installed before 0.43.4?** Run `/gs-superadmin:refresh` once so your
workspace captures the Power List rules your programs reference.

## Report a CLI bug upstream

```
/gs-superadmin:report-bug 're r list --name errors with Nonexistent flag'
```

Captures a `gs-admin` misbehavior as a vendor-ready "prompt and problem" report at the
moment of encounter, while the verbatim commands, output, and the human ask are still in
the session (evidence quality decays once a session closes). Writes Summary, Environment,
the human ask + agent task context, verbatim commands and unedited output, minimal repro,
reliability, impact, and workaround to the report directory you chose once (default
`.gs-superadmin/upstream-reports/` — reports deliberately carry tenant identifiers, never
tokens or secrets). Deduped first against known issues and existing reports (a repeat
observation appends evidence instead of duplicating). The skill never sends, posts, or
commits the report anywhere — sending it to the vendor stays in your hands.

## How the plugin protects your tenant

**Mutation guard — asks, never blocks.** A PreToolUse hook (covering both the Bash and
PowerShell tools) checks every `gs-admin` command against the catalog's `mutating` flag
(any flag order or alias) and prompts for approval; mutating MCP tools prompt via
`permissions.ask`. Unknown commands also prompt (**fail-closed**) rather than passing
silently. Reads pass through untouched, and the hook is inert outside gs-superadmin
workspaces. The approval prompt names the workspace's tenants and flags **production**
targets. A small hand-maintained override list (`hooks/ask-overrides.json`) can
additionally force the prompt on commands whose catalog flag is a verified upstream
mislabel. The list is **empty as of CLI 1.0.8**: upstream fixed the entire verified
class (`re r run-now`, the scheduling-surface writers, `re r set-source-template` among
39 flipped commands), so those now prompt from the catalog itself. The mechanism stays —
overrides can only ever add prompts, never remove one, and the file's comment block is
the decision record, including for the retired entries.

> **Know the gate you're relying on**: the guard's decision comes from the catalog's
> `mutating` flag. Since CLI 1.0.8 that flag is a written contract in the CLI's own
> artifact schema — true iff the action can produce a server-side side effect,
> regardless of HTTP verb — and upstream closed the mislabel class this plugin tracked
> since 1.0.4: commands flagged non-mutating while declaring a PUT/DELETE/PATCH
> endpoint went **29 → 0** at 1.0.8 (39 commands flipped to mutating), so the whole
> `re r` rule-authoring surface, the scheduling writers, and `dd t` template edits now
> prompt from the catalog. At v1.0.10, the **20** commands still flagged non-mutating with
> a POST endpoint are read-shaped fetches (list/describe/fetch-data/validate RPCs), reviewed
> command-by-command upstream — the counting rule (catalog `mutating: false` plus a
> declared write-method endpoint) stays computable from the catalog if you want to
> re-check. What still carries risk is not a standing population of mislabels: it is
> the parsing boundary below, plus the possibility that a FUTURE action ships
> mislabeled. The guard fail-closes on unknown commands, the (currently empty)
> ask-override list is the mechanism that catches a verified mislabel, and every CLI
> upgrade is audited for exactly this class before the catalog pin moves. The guard
> also decides on the **union** of the workspace catalog and the plugin's bundled
> one: a workspace catalog that predates a label fix (setup regenerates it only when
> re-run) cannot silence a writer the bundled catalog already flags — the prompt
> then names both versions and points at `/gs-superadmin:setup` to refresh.
> To check any specific command yourself, look up its
> `mutating` value in `.gs-superadmin/catalog.json`. (`sc update` IS catalog-mutating and
> prompts normally. `rp update` would prompt too, and remains a definition-level PUT:
> since CLI 1.0.6 its `--object`/`--show-fields` are optional and the handler fetches
> the saved definition and merges explicit inputs over it. That merge is now verified
> live (1.0.7, throwaway report): a name-only call preserved 25 of 27 top-level fields
> byte-identical — only the name and its consumer-details mirror moved — so the old
> omitted-fields-reset failure mode is gone at this pin. What remains unverified is the
> FOLDER: the PUT body drops the report's folder id, and the folder is invisible to the
> CLI in both directions (`rp describe` returns no folder field; no `rp list` row
> carries one), so a silent re-folder could not be detected from the CLI. No skill uses
> it; report edits stay manual UI actions until the folder half is UI-verified.)

> **What the guard is, and is not**: a risk-reduction layer at the command-parsing level,
> not a guarantee. The CLI has no native safety layer of its own, and using it carries
> residual risk these safeguards cannot eliminate. The guard arbitrates the `gs-admin`
> binary spelling; the package-name spelling (`npx @gainsight/gs-admin-cli …`) is denied
> by a workspace permission rule setup merges instead, and node-path or shell-alias
> spellings are out of scope. Your judgment at the approval prompt is the real gate.
>
> **The parsing boundary, in full.** The guard finds `gs-admin` by reading the command
> text, so the boundary is a parsing boundary, and you should be able to see it rather
> than infer it. These spellings run a mutating command **without** the approval prompt
> and **without** a journal entry:
>
> - *Not spelled as the binary.* `npx @gainsight/gs-admin-cli …` (covered instead by the
>   workspace deny rule setup merges), a node path to the CLI's entry script, a shell
>   alias, a variable holding the name or its path that was set by an EARLIER command
>   (`$x jo p save` on a line that never mentions gs-admin), and quote- or escape-mangled
>   spellings of the name — `g""s-admin`, `gs\-admin`. A name the shell computes ON the
>   line is read: `$(which gs-admin) jo p save`, `` `which gs-admin` jo p save ``,
>   `"$(which gs-admin)" jo p save`, `$'gs-admin' jo p save`, `n=gs-admin; $n jo p save`
>   and PowerShell's `& (Get-Command gs-admin) jo p save` all ask.
> <!-- guard-residuals: encoded-command, nesting-depth, variable-payload, stdin-payload -->
> - *Command strings the parser cannot reach.* A mutation inside a nested interpreter's
>   payload **is** re-scanned — `bash|sh|zsh|dash|ksh -c '…'`, `powershell -Command "…"`,
>   a positional `powershell "…"`, `cmd /c "…"`, and both shells' eval — `eval '…'` and
>   `Invoke-Expression`/`iex '…'` — plus each of those with options sitting between the
>   flag and the payload (`bash -c -x '…'`, `bash -c -- '…'`), behind a PowerShell
>   assignment that takes the interpreter's output (`$x=iex '…'`, `$x=bash -c '…'`,
>   `$x=powershell "…"`, `$x=cmd /c '…'`), and a `-Command` standing behind a positional
>   (`powershell foo.ps1 -Command "…"`) as well as the first positional itself
>   — but not `-EncodedCommand` (base64, where the payload is not shell text at all), and
>   not past three levels of nesting.
> - *A payload stored in a variable.* The mutation is assigned first — a quoted string or
>   a PowerShell here-string (`$s = @'…'@`) — and evaluated later by name: `eval "$s"`,
>   `bash -c "$s"`, `iex $s`, `Invoke-Expression -Command $s`. A quoted assignment is data,
>   and the variable the eval names carries no text to re-scan; following that dataflow is
>   not a parsing problem, and the guard does not attempt it. Two neighbours are *not*
>   residuals: a heredoc fed straight to an interpreter (`bash <<'EOF' … EOF`) executes
>   its body and still asks, with the operand-position caveat (the same verify-direction
>   trade as `xargs gs-admin`), and a here-string piped into `iex` still draws the
>   shell-safety lint's deny below.
> - *Commands from a file or another program's output.* `bash script.sh`, `bash < script.sh`,
>   `cat script.sh | bash`, `curl … | sh`: the line names a file or an upstream program, not
>   the commands, so there is nothing to re-scan. The readable stdin shapes are covered — a
>   here-string's target (`bash <<< '…'`) and the words of the upstream pipeline stage
>   (`echo '…' | bash`) are re-scanned as the interpreter's payload, and a heredoc body is
>   data of the command that opened it. A bare `gs-admin` handed to another command as its
>   argument (`… | xargs gs-admin`, `parallel gs-admin`) asks fail-closed, since its
>   arguments come from elsewhere; `env -S '…'` and `watch '…'` run their string as a
>   command line and are re-scanned like a nested shell.
>
> These are measured, not assumed: each one is either pinned by a fixture in
> `test/guard-fixtures.mjs` or carries a stated reason it is not, so the list cannot quietly
> go stale as the hook changes. They are not exotic — a model composing a
> command, or one steered by asset names and KB text it has read, can write any of them
> without intending evasion. That is the reason the guard's posture is *ask, never block*
> and the reason the prompt matters: a spelling that slips the parser falls back to Claude
> Code's own permission flow, so nothing is silently granted — but the mutation-aware
> prompt (tenant label, PRODUCTION warning) and the journal entry are both lost.

**Shell-safety lint.** Gainsight asset names often contain literal pipes
(`Prefix|Domain|Subdomain|Description`), sometimes an `&` (`Sales & Marketing`), which an
unquoted shell command parses as operators. The same hook catches an unquoted `|` or lone
`&` whose right-hand side isn't a recognized program, blocks the broken command with a
quoting hint so Claude retries correctly, and escalates to a human approval prompt if it
recurs (`&&` chaining is never touched — though `&&` itself is bash/PowerShell 7+ syntax;
Windows PowerShell 5.1 rejects it at parse time, so chain with `;` or separate commands
there). Workspaces that pipe gs-admin JSON into their own
tools can accept extra consumer names via `.gs-superadmin/pipe-consumers.json` — additive
only. The same deny-then-ask coaching applies when a `gs-admin` subcommand hides in a
shell variable — the guard can't inspect what it expands to, so it asks for a literal
rewrite.

**Change journal.** The hook's PostToolUse half appends every executed guard-approved
`gs-admin` command to `<slug>/changes/JOURNAL.md`: timestamp, operator, command, reported
outcome (an approved command that then failed journals as a **FAILED attempt**), system
area, and — when run from an approved change plan — the source Jira ticket and plan file.
Denied commands never run, so they never appear. CLI lane only: mutating MCP tools prompt
but are not journaled. The journal is tenant data (git-ignored by default); orgs wanting
durable history can privately git-track the workspace.

## Two instances (Sandbox + Production)

One working directory can hold a KB per tenant. Install the CLI and the plugin once, then
run setup once per instance:

```bash
gs-admin login --base-url https://acme.gainsightcloud.com        # production
# /gs-superadmin:setup            → confirms slug, creates acme-prod/
gs-admin login --base-url https://acme--sbx.gainsightcloud.com   # sandbox
# /gs-superadmin:setup            → confirms slug, creates acme-sbx/
```

Day-to-day: tokens persist per tenant (both stay logged in), but the CLI's *active* tenant
is one global pointer. Switch with `gs-admin config --base-url <url>`; every skill re-checks
`gs-admin whoami` and picks the matching KB folder, so it always operates on the active
instance. The mutation guard's approval prompt names the workspace's tenants and flags
**production** targets — setup records each tenant's environment in its manifest, so the
flag is fact-based (workspaces created by older plugin versions fall back to a name
heuristic until setup is re-run). One caveat: don't switch instances while a `jo p cache`
editing session has unsaved changes (the Journey cache is keyed by program id, not tenant).

## Folder layout (created in your working directory)

```
<slug>/                     e.g. acme-sbx/ or acme-prod/
  _manifest.json            resume state + asset inventory
  overview.md
  journey/ journey-email-templates/ rules-engine/ data-management/ data-designer/
  connectors/ scorecard/ report/ …    one folder per indexed asset type (manifest domain)
  changes/                  change plans (change-request skill) + JOURNAL.md (change journal)
  reports-adhoc/            email-report / email-engagement / deps-report output
  relationships/
    field-to-rule.md
    field-to-scorecard.md
    process-maps.md
    program-to-template.md

.gs-superadmin/
  plugin                    Directory link to the installed plugin (junction on Windows,
                            symlink elsewhere) — every skill runs its scripts as
                            `node .gs-superadmin/plugin/scripts/<x>.mjs`; created by setup,
                            repointed at every plugin session start, never a copy
  operating-model.md        Claude's always-on instructions (yours to edit)
  CONVENTIONS.md            Build standards entry point (yours to fill in; workspace-wide —
                            a `<slug>/CONVENTIONS.md` beside a tenant's KB overrides it
                            for that tenant alone)
  conventions/              Opt-in build-standards pack (yours to edit or delete)
  catalog.json              Generated from the installed CLI's manifests (bundled
                            snapshot if generation fails)
  cheatsheet.md             Rendered from that catalog (same emitter as the bundled copy)
  ask-rules.json            Reference bundle copies (plugin's bundled CLI version)
  version.json
  ask-overrides.json

.claude/settings.json       npx @gainsight/gs-admin-cli* merged into permissions.deny (use
                            the gs-admin binary, which the guard can arbitrate);
                            mutating MCP tools merged into permissions.ask (existing rules
                            preserved); optional gs-admin read allow-rules, asked once at
                            setup — the guard hook still prompts for catalog-mutating and
                            unknown commands (hook "ask" overrides an allow rule); the
                            old mislabeled-write class is closed at CLI 1.0.8 (0 strict
                            cases), so the generic shell prompt is lost only on genuine
                            reads and read-shaped POSTs
CLAUDE.md                   managed block inserted (existing content preserved)
```

> **Local data note**: the KB under `<slug>/` contains real tenant metadata — asset names,
> owners, rule logic, and (for journeys fed by CSV sources) potentially customer names and
> email addresses. Setup git-ignores it, but it sits unencrypted on your disk: treat the
> working directory with the same care as any Gainsight export, and delete `<slug>/` when
> you no longer need it.

---

Version history: [CHANGELOG.md](CHANGELOG.md). Marketplace installs track the repo's
released branch — update with `claude plugin update gs-superadmin@gs-admin-cli-docs`.
Changing the plugin itself? See [MAINTAINERS.md](MAINTAINERS.md) and the repo's
[AGENTS.md](../../AGENTS.md).
