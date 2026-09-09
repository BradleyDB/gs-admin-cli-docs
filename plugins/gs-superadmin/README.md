# gs-superadmin

A Claude Code plugin that gives you a persistent, per-tenant Gainsight admin workspace.
One setup run bootstraps your environment; subsequent sessions pick up right where you
left off. In short:

- **A local knowledge base of your tenant** — every rule, journey, scorecard, report,
  connector, … indexed and documented as markdown Claude can cite.
- **Everyday admin skills** — drift detection, naming audits, deprecations, reviewable
  change plans, email/schedule reports, tenant-wide impact analysis, upstream bug reports.
- **A safety net** — every `gs-admin` command the CLI catalog marks mutating triggers a
  human approval prompt, and approved changes are journaled. Reads run freely;
  catalog-mutating commands ask (see [the gate you're relying on](#how-the-plugin-protects-your-tenant)
  for the commands the catalog mislabels).

> **Currency.** This document was last updated on 2026-09-08 (against
> `@gainsight/gs-admin-cli@1.0.9`) with reference to Gainsight's then-current pre-built and
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

**1. Prerequisites** — Node.js on your PATH, the `gs-admin` CLI installed globally, and a
login to your tenant:

```bash
npm i -g @gainsight/gs-admin-cli
gs-admin login
gs-admin whoami     # confirm you're on the right tenant
```

**2. Install the plugin** from this repo's marketplace:

```bash
claude plugin marketplace add BradleyDB/gs-admin-cli-docs
claude plugin install gs-superadmin@gs-admin-cli-docs
```

(Or interactively: `/plugin marketplace add BradleyDB/gs-admin-cli-docs`, then pick
**gs-superadmin** from `/plugin`. The marketplace add clones the repo over git — public
repos need no auth; while the repo is private, set up GitHub credentials first
(`gh auth login` or an SSH key). Developing locally instead?
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
> type `/gs-superadmin:audit`. Exactly two skills — `email-report` and `deps-report` —
> are also triggered by natural-language questions ("which emails mention X?",
> "what breaks if I change this field?"). The table's **Invoke** column marks each one.

| Skill | What it does | Invoke |
|-------|--------------|--------|
| [`/gs-superadmin:setup`](#set-up--grow-the-knowledge-base) | Bootstrap or resume the workspace: index every asset, document them in budgeted batches | slash only |
| [`/gs-superadmin:refresh`](#detect-changes) | Detect assets changed since the last run and mark them stale | slash only |
| [`/gs-superadmin:audit`](#audit-naming-conventions) | Check asset names against your naming convention; apply renames only after you approve | slash only |
| [`/gs-superadmin:deprecate`](#deprecate-an-asset) | Walk an asset through the deprecation checklist | slash only |
| [`/gs-superadmin:change-request`](#plan--execute-a-config-change) | Turn a ticket or request into a reviewable, KB-cited implementation plan | slash only |
| [`/gs-superadmin:email-report`](#report-on-jo-emails--schedules) | Read-only Journey Orchestrator email & schedule reports (4 modes) | slash + natural language |
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

The lifecycle, end to end — the key point is that **drafting is always safe**:

1. **Draft** — `/gs-superadmin:change-request ticket.md --ticket CSOPS-142` writes the
   plan file. Nothing is executed at drafting time, ever.
2. **Review** — open the plan, check the impact analysis, names, command sequence, and
   rollback. Edit or discard freely; it's just a markdown file.
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
CSV source shows its uploaded filename, and a Power List renders as honestly not
resolvable (no CLI surface exists). Everything is KB-cached and the report says so —
the JO-scoped sibling is `email-report deps`; this is the tenant-wide superset.
Read-only.

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
> prompt from the catalog. At v1.0.9, the **20** commands still flagged non-mutating with
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
>   flag and the payload (`bash -c -x '…'`, `bash -c -- '…'`)
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
  reports-adhoc/            email-report / deps-report output
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
  CONVENTIONS.md            Build standards entry point (yours to fill in)
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
