# gs-superadmin Operating Model

> This file was scaffolded by `/gs-superadmin:setup`. It is **yours to edit** — treat it as
> living documentation that Claude reads at the start of every session in this working directory.

---

## Role

- **CLI (`gs-admin`) = source of truth.** Run it for every read; never guess at API responses.
- **This KB (`<slug>/`) = memory/map.** Documented assets here save re-fetching; they are inputs to reasoning, not authoritative without verification.

---

## Instance awareness

When Gainsight work starts in a session — and again after any instance switch — confirm
the active tenant. Do **not** re-run `whoami` before every command in between.
1. Run `gs-admin whoami` to identify the active tenant.
2. Derive the `slug`: scan the working dir for any `*/_manifest.json` whose `baseUrl` matches
   the `whoami` output — that folder's name is the slug. The manifest is the source of truth;
   never invent a slug from the hostname. If no manifest matches, this tenant has no workspace
   yet — tell the user to run `/gs-superadmin:setup` (it confirms the slug once and records it).
3. All KB reads/writes go into **that slug folder only**. Never mix instances.

One exception to the cadence: before running a **mutation**, if there is any chance the
active tenant changed outside this session (e.g. the user ran `gs-admin config --base-url`
in another terminal), re-run `whoami` first.

If `whoami` fails → auth error → run `gs-admin login` and wait for confirmation.

### Multiple instances (e.g. Sandbox + Production)

One working dir can hold a KB folder per tenant (e.g. `acme-prod/` and `acme-sbx/`) —
run `/gs-superadmin:setup` once per instance. How the CLI models this:

- **Tokens are stored per tenant**; both instances can stay logged in at once. Re-login
  (`gs-admin login --base-url <url>`) is per instance, when that instance's token expires.
- **The *active* tenant is a single global pointer** (`base_url` in `~/.gs-admin/config.json`),
  shared with the MCP server when it's wired up. Per-command resolution:
  `--base-url` flag > `GS_BASE_URL` env > config file.
- **Switch**: `gs-admin config --base-url <url>` — then re-run `gs-admin whoami` and
  re-derive the slug before touching the KB. For a one-off read against the other
  instance, prefer the per-command override (`gs-admin --base-url <url> …`) over
  flipping the global pointer.
- **Journey cache hazard**: the `jo p cache` session store is keyed by program id, not
  tenant. Never switch instances while a JO editing session has unsaved changes —
  `jo p save`/`publish` or `jo p cache discard` first.
- The mutation guard's approval prompt names the tenant(s) this workspace documents and
  flags production targets (from the `environment` recorded in each manifest; manifests
  created before that field existed fall back to a name heuristic until `/gs-superadmin:setup`
  or `/gs-superadmin:refresh` backfills it) — read it and confirm the target instance
  before approving any write.

---

## Read-only by default

All actions are **read-only** unless the user explicitly says otherwise in this conversation turn.

To override for a single action, the user must state it clearly (e.g., "go ahead and create that rule"). Do not infer intent. Do not batch multiple writes without explicit approval for each.

Mutating actions are guarded on both surfaces, and both **prompt** rather than block:
- **CLI**: the plugin's PreToolUse hook checks every `gs-admin` command against the catalog's
  `mutating` flag (any flag order or alias) and asks for approval. Approved mutations are
  then **journaled** automatically to `<slug>/changes/JOURNAL.md` (timestamp, operator,
  command, reported outcome, system area; plus ticket + plan when run from an approved
  change plan) — denied commands never run, so they never appear. The outcome line records
  what the harness reported: an exit status where one is passed;
  `FAILED (tool call failed…)` when the harness emits the tool-failure event for an
  approved command that then failed;
  `completed (success event; no exit code reported)` on harnesses whose success event
  carries no exit status. Older harnesses that emit neither a failure event nor an exit
  status journal only successful calls, as
  `not verified (harness reported no exit status)`.
- **MCP**: mutating tool names (see `.gs-superadmin/ask-rules.json`) are listed under
  `permissions.ask` in `.claude/settings.json`. MCP-lane mutations are **not** journaled —
  prefer the CLI for writes when change history matters.

The explicit-override path is the approval prompt itself: state the intended write, run the
command, and let the user approve or reject it there.

**Limits of the safeguards.** The guard and the permission rules reduce risk at the
command-parsing layer; they are not a guarantee and cannot be exhaustive. The CLI itself
has no native confirmation on writes, and only the `gs-admin` spelling of the CLI can be
arbitrated. Since CLI 1.0.8 the catalog's `mutating` flag is a written upstream contract
(true iff the action can produce a server-side side effect, regardless of HTTP verb) and
the old mislabeled-writer class is closed — the `re r` authoring surface and the
scheduling writers prompt from the catalog, and the residual non-mutating POSTs are
read-shaped fetches reviewed upstream. What remains is the parsing boundary and the
possibility of a future mislabel: the guard fail-closes on unknown commands, the
plugin's (currently empty) ask-override list is the mechanism that catches a verified
one, and the guard decides on the union of the workspace and bundled catalogs — a
workspace catalog that predates a label fix cannot silence a writer the plugin
already knows about (still re-run `/gs-superadmin:setup` after CLI upgrades to keep
the workspace copy current). Using the CLI carries residual risk that these safeguards do not
remove — the user's own judgment at the approval prompt remains the real gate. One
practical consequence: the package-name spelling (`npx @gainsight/gs-admin-cli …`) is
**denied** by a workspace permission rule rather than guarded, because a denial can point
you at the spelling the guard understands. Use the installed `gs-admin` binary.

---

## How to drive gs-admin

- **Action-first**: decide what you want (list / get / create / update / …), find the command in the cheatsheet or catalog, then run it.
- **CLI by default**: `gs-admin [global-flags] <ns> <group> <name>`. Prefer MCP tools when `gs-admin` MCP server is connected (same action, less shell escaping).
- **Global flags go before the subcommand**: `gs-admin --json jo p list`, not `gs-admin jo p list --json`.
- **JSON output for parsing**: always pass `--json` (or `--format json`) when you need to process the result.
- **Schedule crons are Quartz format** — 6 or 7 fields (`second minute hour day-of-month
  month day-of-week [year]`), e.g. `'0 0 0 * * ?'` for daily at midnight. A 5-field Unix
  cron (`'0 0 * * *'`) is rejected by the CLI with an "expected 6 or 7 fields" error.
  Verify any schedule expression with `re r test-schedule` (validation-only, no write)
  before using it in a schedule command.
- **Shell quoting for asset names**: asset names commonly contain shell metacharacters —
  `|` and spaces above all (e.g. `CS|Risk|Renewal|Alert`), but `& ; ( ) $` appear too
  (e.g. `Sales & Marketing`) — and unquoted, the shell parses them as operators before
  gs-admin sees them. Single quotes neutralize ALL of them; never leave a free-text value
  (name, description, filter) unquoted:
  `gs-admin --json re r list --search 'CS|Risk|Renewal|Alert'`. Single quotes are literal in
  both PowerShell and bash. The guard lints unquoted `|` and lone `&` whose right-hand side
  isn't a recognized program (a first offense is denied with a quoting hint; a repeat asks;
  `&&` chaining is never touched — but note `&&` itself is bash/PowerShell 7+ syntax:
  Windows PowerShell 5.1 rejects it at parse time, so chain with `;` or separate
  commands there). Workspaces that pipe gs-admin JSON into their own
  functions or wrappers can list extra accepted consumer names in
  `.gs-superadmin/pipe-consumers.json` (`{ "consumers": ["dump"] }`) — additive only: the
  file can widen what the lint accepts, never affect the mutation approval prompt, and a
  malformed file is ignored.
- **Run mutations unchained**: the change journal records the whole executed command
  line, and its `target` field is parsed from the mutating invocation's own words —
  chaining a mutating command with other shell commands (`gs-admin logout; echo done`)
  pollutes that parse with shell tokens (observed live). One mutation per command line
  when a clean journal entry is wanted.
- **Spell subcommands literally**: the mutation guard checks command *text*, so a
  subcommand hidden in a shell variable (`gs-admin --json $c` in a loop) can't be verified
  and triggers approval prompts even for reads. Keep the domain/group/command words
  literal; variables belong only in flag values and paths (`--page $p`, `--out $out`).
- **From node scripts, don't spawn `gs-admin` directly**: on Windows it's a `.cmd` shim,
  and `spawn` without a shell fails with ENOENT. Use the plugin's scripts (they resolve
  the CLI's real JS entry — `capture.mjs` for file captures, `describe-batch.mjs` for
  describe loops) or plain shell commands instead of writing an orchestrator.
- **Capture command output through the shipped helper**: what a shell's `>` writes is
  the shell's choice — Windows PowerShell's redirect breaks JSON either way, emitting
  UTF-16 or UTF-8 **with a BOM** depending on profile/host configuration (the encoding
  is a profile/host setting, not a version trait: a live Windows PowerShell 5.1 was
  observed emitting UTF-8-with-BOM, 2026-07-25), and JSON parsers (including the
  plugin's scripts) reject both; `Out-File -Encoding utf8` is no safe alternative on
  5.1, which still adds a BOM. The plugin ships the capture helper for exactly this:
  `node <plugin>/scripts/capture.mjs --out <file> -- gs-admin --json …` runs the
  read-only command itself and writes the file as clean UTF-8 with no BOM on every
  shell, and its `--normalize <file>` re-encodes a capture that was made by hand with
  a redirect (refusing, rather than corrupting, anything it cannot decode).
- **Read script stdout through the Bash tool too**: the redirect trap above has a
  decode-side twin with no error at all. Capturing a native command's stdout in
  Windows PowerShell 5.1 — into a variable, through a pipe, or as the tool result
  you read — first decodes the process's UTF-8 bytes via the console codepage
  (`[Console]::OutputEncoding`, OEM by default), so non-ASCII in a script's stdout
  summary (tenant asset names in warnings and samples) is silently replaced with
  wrong characters before any file encoding or BOM strip is involved, and no
  `-Encoding` parameter reaches that step. Run the plugin's scripts through the
  Bash tool and the summary arrives intact; files the scripts write themselves
  (reports, CSVs) are unaffected either way.
- **Plugin commands run through `.gs-superadmin/plugin`** — a directory link to the
  installed plugin's root (a junction on Windows, a symlink elsewhere), created by
  `/gs-superadmin:setup` and refreshed by the plugin at every session start, so
  `node .gs-superadmin/plugin/scripts/<x>.mjs …` always runs the loaded plugin's own
  scripts, and nothing is copied into the workspace. An ENOENT there (`Cannot find
  module '….gs-superadmin/plugin/…'`) means the link is missing or stale — run
  `/gs-superadmin:setup` to recreate it. (Hook commands are unaffected — they run by the
  plugin's own absolute path.)
- **Scaffolded files carry a vintage.** `.gs-superadmin/operating-model.md`,
  `.gs-superadmin/CONVENTIONS.md` and an adopted `.gs-superadmin/conventions/` pack are
  yours to edit; `/gs-superadmin:setup` keeps the pristine template of each under
  `.gs-superadmin/scaffold/` so it can tell an edited copy from an unedited one. When the
  plugin ships a newer template, setup refreshes an UNEDITED copy in place and, for an
  EDITED one, writes the new template beside it as `<file>.new` and asks once — replace,
  keep yours, or reconcile later — recording the answer so the question never repeats for
  that template version. The plugin's session-start line names how many scaffolded files
  are behind (or have a `.new` waiting for you) and points at setup; apart from the
  `plugin` link above, nothing under `.gs-superadmin/` is written outside a setup run.

## Known CLI issues (observed live on 1.0.4; statically re-checked at v1.0.9 — the run-now catalog mislabel below was fixed upstream at 1.0.8, the rest still stand: from 1.0.8 to 1.0.9 only the two connectors artifacts changed, core/config and the scorecard and rules-engine handlers are byte-identical; two NEW issues observed live at 1.0.9 are listed below (`sc scheme list`, ledger KI-016; the libuv error-path abort, ledger KI-017) — recheck after CLI upgrades)

When a `gs-admin` command misbehaves in a Known-CLI-issue-like way that this list does
**not** cover (wrong/missing flag, false auth error, silent truncation, mislabeled
mutating flag, state left behind), suggest `/gs-superadmin:report-bug` to the user
right away — it captures a vendor-ready "prompt and problem" report while the verbatim
commands and output are still in this session.

- **`sc measures --id` fails with a false "No stored token found"** once the stored token
  is past half its lifetime, even though `gs-admin whoami` shows it valid. Cause: the CLI
  refreshes tokens with no single-flight guard, and this is its only command whose *first*
  authenticated call is a concurrent fan-out — the concurrent refresh corrupts the
  credential read, which is then misreported as a missing token. **Use
  `sc measures --name '<scorecard name>'` instead** (resolves name→id sequentially, which
  primes auth first — unaffected).
- **`sc measures` flattens only one level of the measures tree**, so on rollup-enabled
  scorecards its rows are measure *groups* presented as measures (the real measures stay
  nested in each row's `children`; `_groupName` is the rollup's display name). Classify
  and count nodes by `levelType` (`GROUP`/`MEASURE`), recursing `children` — never by
  position. No-rollup scorecards return the measures directly (their group nodes are
  dropped — recover groups as distinct `_groupName` values). If a newer CLI returns a
  different shape, trust `levelType` and the payload over this note.
- **`re rules list` caps each page at 200 rows** even when `--limit` asks for more
  (other list commands honor larger limits). A page shorter than requested therefore
  isn't proof of the last page — reconcile the running total against the payload's
  `totalRecords` and keep paging at the size actually returned.
- **`re r run-now` defaults to a LIVE rule execution** — the rule's actions write to
  the tenant (verified live on 1.0.4 and again on 1.0.6). It was catalog-labeled
  non-mutating until upstream fixed the label at CLI 1.0.8; the guard now prompts on it
  from the catalog itself, along with the rest of the once-mislabeled class (the
  scheduling writers and `re r set-source-template`, whose attach replaces the rule's
  source graph and appends a disconnected second one on a re-run — verified live on
  1.0.7, and unchanged in behavior at 1.0.8: only the label moved). The plugin's
  hand-maintained ask-override list (`hooks/ask-overrides.json`) that carried these
  until 1.0.8 is now empty; it remains in place as the mechanism for any future
  verified mislabel (overrides are self-retiring once upstream fixes a flag). Both
  lanes can prompt now, by different mechanisms: the CLI lane from the guard hook
  reading the catalog's `mutating` flag, the MCP lane from this workspace's
  `permissions.ask` entries in `.claude/settings.json` — the MCP protocol itself
  carries no mutating hint, so that protection lives only in the settings entries
  that `/gs-superadmin:setup` merges from the plugin's `ask-rules.json`. The old
  "run it through the CLI, not MCP" restriction is lifted only in a workspace whose
  setup ran at plugin 0.31.0 or newer: a plugin upgrade alone does NOT deliver the
  ask entries for the 39 tools flagged at CLI 1.0.8 — re-run setup after upgrading,
  or the MCP lane prompts nothing for them. CLI-lane writes remain preferable where
  change history matters, since MCP-lane mutations are not journaled. Prefer
  `--test-run` (evaluate-only) for
  verification steps — it prompts too now that the catalog flag governs — and schedule
  or run live only per an approved plan.
- **`re r debug` is catalog-labeled mutating but is read-only in effect** (verified on
  1.0.4: it registers a debug-telemetry run and reads state — executions stay at 0; it
  does not execute the rule). The guard prompts on it anyway. This is an **accepted
  over-ask**: the hook may only ever add asks, never remove one — approve it freely.
  It also **writes a local run-state file per invocation** (verified on 1.0.4) —
  `~/.gs-admin/runs/` accumulates silently, including for calls that failed (e.g.
  "ruleId required"). Local only, no tenant impact; sweep the directory when cleaning
  up after debug-heavy work (bash: `rm -rf ~/.gs-admin/runs`; Windows PowerShell:
  `Remove-Item -Recurse -Force "$HOME\.gs-admin\runs"` — PowerShell resolves `~` in
  provider paths too; what fails is transliterating the bash line, because `rm`
  aliases `Remove-Item` and `-rf` is not a parameter it knows).
- **`re r list` has no `--name` flag** (1.0.4 errors `Nonexistent flag: --name`, though
  sibling commands like `re r create` and `sc measures` do take `--name`). Filter the
  rules list by name with `--search '<fragment>'` (partial match).
- **`re r set-source` is the UI's "Select an Object" — a single-object mode whose only
  escape is a LOSSY in-place conversion**: verified live on 1.0.7 (F-104/PV-5),
  `re r set-source-template` converts an existing Horizon rule in place (same `ruleId`
  and `ddConfigId`, `tasksType` SIMPLE → COMPLEX), but the attached template's task graph
  REPLACES the single-object extract rather than merging with it (anything mapped to the
  old source must be re-pointed), and a second attach APPENDS beside the first
  (disconnected task graphs — a corrupted dataset), so the conversion must never be
  scripted as retryable. The
  UI's "Prepare Dataset" equivalent is
  `re r set-source-template`, which attaches a Data Designer template as the rule's
  data-prep source — there is no inline prepare-dataset builder in 1.0.4. Change plans
  must disclose which mode they pick (the change-request plan header's `Data-source mode:`
  line).
- **Describe commands don't always accept the list payload's `id`**: `re rules describe`
  wants `ruleId`, `re chains describe` wants `workflowId`, and dm objects describe by
  object *name*. The manifest keys each asset by the describe identifier (recorded per
  domain in `domains_indexed`) — check there before assuming `id`. In `describe-batch.mjs`
  command templates: the describe identifier is always `{id}` — the manifest is keyed by
  it. `{name}` substitutes the display label and is only for commands that address by
  label (e.g. `sc measures --name`). dm objects therefore take `--name {id}`, not
  `--name {name}`.
- **List commands silently truncate at small defaults** (20–50 items, no warning in the
  output). The capture helper's paginate mode owns the page loop and reconciles the
  captured rows against the payload's own total, flagging suspect round counts (rule
  canon: setup Phase 4's "List exhaustively" — including matching `--page-flag` to the
  command, and `none` with a large explicit `--limit` where there is no page flag). A
  sweep that exits non-zero is never presented as the inventory — the summary's
  verdict and flags name why. Payload totals are themselves
  post-filter/post-flatten (next bullet) — reconciliation proves paging completeness,
  never inventory completeness. Never present a single default list call as the full
  inventory.
- **Report fetches hard-cap `--limit` at 2000** (`rp run` / `rp run-saved`;
  client-enforced since CLI 1.0.6 — a larger value errors loudly rather than silently
  truncating, and there is no page-number flag on these fetches). Plan an extract above
  2000 rows around narrower `--where-filters` slices instead. Also since 1.0.6, ad-hoc
  report fetches (`rp run`) send `requestSource: GS_ADMIN_CLI` — before 1.0.6 they
  carried the UI report-builder's identity — so CLI-driven ad-hoc report reads appear
  distinctly attributed in the tenant's `gs_asset_usage`, visible to tenant-side
  admins rather than anonymous. (`rp run-saved` re-sends the saved definition's own
  attribution unchanged.)
- **Some list commands can NEVER see the whole tenant — scope filters are hardcoded in
  the CLI's own artifact manifests**, with no flag to lift them, and reported totals are
  *post-filter* (so `returned == totalAfterFilters` proves paging completeness, not
  inventory completeness). Known cases: `jo email templates` reaches only part of the
  library (validated on a live tenant 2026-07: 619 of 1,336 reachable) — two causes:
  its handler flattens ONE level of the folder tree, so templates inside nested
  subfolders are dropped (642 on that tenant) and the subfolders surface as field-less
  rows carrying only a `folderName` (no id — skip them); plus a residual filter that
  hides some top-level templates too (~75 on that tenant; suspected `source=COMMS`
  scope or template state — unconfirmed). **Workaround (validated live)**: the gap is
  discovery-only — `jo email template --id <id>` uses a different endpoint and returns
  list-invisible templates fine, so any template whose id is known (e.g. from a UI
  export) is fully documentable. KB docs for email templates store metadata + the
  plain-text body only (written by `describe-batch.mjs`'s template doc-mode on bulk runs,
  or standalone `scripts/template-doc.mjs` for one-off payloads — shared rendering); the
  HTML rendering is intentionally dropped and re-fetchable via `jo email template --id`. `jo surveys list` hardcodes
  `states:["PUBLISH"]` (closed surveys are invisible — a tenant whose surveys are all
  closed lists 0); `jo data-designer list` pins `ds=UNIVERSAL_DATA_SET`; Data Designer
  *designs* have no list command at all (only `dd templates list`) — and their output
  objects hide among `dm` objects where `group=System` is a **superset** (some System
  objects are DD outputs, some are not; no 1.0.4 describe field distinguishes them),
  so "which dm objects are Data Designers" is not determinable from CLI data — never
  equate `group=System` with "the data designers" (`dataStore=REDSHIFT` and
  `copy`/`view` `dbName` prefixes are weak hints only). When a CLI count runs below the UI count in these areas,
  cite this limitation and record the gap — do not chase it with pagination or re-auth.
- **`sc scheme list` returns a `modifiedAt` generated per call**, not a stored modification
  date: two read-only calls seconds apart return values that differ by exactly the elapsed
  interval, each within milliseconds of its own call, spelled as epoch-millisecond numbers
  stamped row by row. A domain indexed on this field flips 100% stale on every refresh
  forever. **Record the `scorecard-schemes` domain `--no-date-field`** — there is no
  alternative modification-date key on the row; the manifest script refuses the generated
  signature on a full list, and an already-recorded workspace re-dates once with
  `--no-date-field --allow-redate`. Sibling `sc list` / `sc m list` / measure-group lists
  are unaffected (observed live on 1.0.9; ledger KI-016).
- **Every error path aborts on a libuv assertion instead of exiting cleanly.** After
  printing a correct API error, the process aborts with
  `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 94`
  and exits **127** — conventionally "command not found", so a caller cannot tell a
  missing CLI from a rejected request. Not specific to auth, malformed JSON or `login`
  (where it was previously noticed as a side-observation of a different bug): it
  reproduces on a plain read-only `re r describe --id <nonexistent>`, 3 of 3, with and
  without `--json`. The success path exits 0 cleanly. **Parse stderr for the `Error:`
  line rather than trusting the exit code**; treat exit 127 from `gs-admin` as "check
  stderr", never as "the CLI is not installed" (observed live on 1.0.9; ledger KI-017).
- **General rule**: any "No stored token found" while `whoami` succeeds is this bug class,
  not a logged-out state. Prefer a sequential variant of the command or `gs-admin login`
  to mint a fresh token; do not conclude auth is broken or loop on re-login.

---

## Journey Orchestrator local cache

Mutating `jo` commands **buffer to a local cache** — they do NOT reach the backend until
persisted with `gs-admin jo p save` (or `jo p publish`). Consequences:

- Never report a Journey change as applied until the `save`/`publish` has run **and succeeded**.
- A multi-step JO edit (create → sources → map → …) is one logical change: it isn't real until saved.
- `jo p cache discard` throws away unsaved changes; `jo p cache start` begins an editing session.
- When in doubt, `jo p publish-status` / a fresh `describe` is the truth, not the cache.

---

## Hybrid reference

| Resource | When to use |
|----------|-------------|
| `.gs-superadmin/cheatsheet.md` | Quick lookup — domain→command→MCP-tool map |
| `.gs-superadmin/catalog.json` | Exact flags, endpoints, mutating flag |
| Live `gs-admin <cmd> --help` | Drift guard (see below); unfamiliar flags |

### Drift guard

On each session, compare `gs-admin --version` output to `meta.cliVersion` in
`.gs-superadmin/catalog.json`. If they differ:
- Tell the user to re-run `/gs-superadmin:setup` — it regenerates the workspace catalog
  **and cheatsheet** directly from the installed CLI's manifests, which also keeps the
  mutation guard current. (Setup generates both on every run; a version gap means either
  the CLI changed since the last setup run, or the last run fell back to the plugin's
  bundled snapshot because generation failed.)
- Until then, prefer live `--help` over the workspace cheatsheet for exact flag names.
- The mutation guard prompts on any command it doesn't recognize (fail-closed), so a
  newer CLI's commands ask for approval instead of slipping through.
- One thing re-running setup does NOT refresh: `ask-rules.json` (and `version.json`)
  always carry the plugin's bundled CLI version, so mutating MCP tools added by a newer
  CLI have no `permissions.ask` entries until the plugin itself updates. This affects
  the MCP lane only; the CLI-lane guard reads the regenerated catalog. The mirror
  image holds too: a plugin upgrade ships new ask-rules entries, but they reach this
  workspace's `permissions.ask` only when setup is re-run — until then the MCP lane
  prompts at the old vintage.

---

## Freshness & verification

| Asset type | TTL |
|------------|-----|
| Rules / Jobs / Journeys | ~14 days |
| Scorecards / Connectors / Data Designer / Reports | ~30 days |
| Objects / Schema | ~90 days |

Before relying on a KB doc, check `last_verified` in the manifest. If it exceeds the TTL, run `/gs-superadmin:refresh` or fetch live via CLI.

Always **separate confirmed (from CLI output) from assumed (inferred)**. Label accordingly when presenting information to the user.

---

## Cite sources

When answering a question about the tenant:
- Cite the KB file (e.g., `acme-sbx/rules/churn-alert.md`) and its `last_verified` date, **or**
- State that you're fetching live via `gs-admin` and show the command.

---

## Updating the KB

When you discover new relationships (e.g., a rule writes to a field that a scorecard reads):
- Record it in `<slug>/overview.md`, noting it as `inferred` until confirmed by
  `gs-admin` CLI output. Never edit the four maps in `<slug>/relationships/` inline —
  they are generated and overwritten on every setup Phase 6 run (next bullet).
- The four relationship maps themselves are **generated** by the plugin's
  `relationships-build.mjs` (setup Phase 6). Three derive from each rule's
  `_flatMappings` describe payload — an undocumented CLI internal, verified on 1.0.4
  and documented in the script's header: entries map
  `srcObject.srcField → tgtObject.tgtField` keyed by `actionType`, and `SET_SCOREV2`
  carries scorecard/measure GSIDs in `srcField` (sometimes as a JSON-map string). The
  fourth, `program-to-template.md`, derives program → email template edges from GSID
  co-occurrence between journey program docs and the email-template inventory. The
  script reports actionTypes it doesn't recognize inside the maps (never silently
  dropped) and flags **dangling measure references** (rule→measure GSIDs resolving to
  no documented scorecard — a tenant hygiene signal worth relaying).
- **There is no journey → rule participant edge to discover**: Rules Engine rules do
  not load participants into JO programs — programs draw participants from Power
  Lists (CSV uploads, ad-hoc queries, or Data Designer / DD-template datasets), never
  a rule. Trace program → Power List → source from the PowerList config in each
  program doc instead of hunting for rule references.

---

## Build standards

Refer to `.gs-superadmin/CONVENTIONS.md` before authoring or modifying any Gainsight asset
(rules, journeys, reports, scorecards). If `.gs-superadmin/conventions/` exists (the adopted
build-standards pack), consult `conventions/index.md` and load **only** the topic file
relevant to the current task — `naming.md` for names/renames/audits, `query-building.md`
for any dataset work (building or editing a query in Rules, Data Designer, or JO Programs;
picking a rule's source object or source template; restructuring tasks or fields),
`rules-engine.md` / `reports.md` / `data-designer.md` when building in
those areas, `deprecation.md` when retiring assets.
Choosing or altering a rule's data source is dataset work — load `query-building.md` first.
Load the topic file **before** the decision it governs, not after. Update these files when
new patterns are established.

---

## Auth errors

If any `gs-admin` command returns an auth error:
1. Run `gs-admin login` and follow the browser flow.
2. Re-run the original command.
3. If it persists, check `gs-admin whoami` to confirm the right tenant is active.
