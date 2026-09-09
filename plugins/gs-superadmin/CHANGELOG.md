# gs-superadmin — changelog

One entry per released plugin version (`.claude-plugin/plugin.json` `version`). The
marketplace doesn't pin versions — users get main — so entries describe what changed for a
user who updates, not internal refactors. Entries before 0.8.0 were reconstructed from git
history when this file was introduced.

## 0.37.0 — 2026-09-08

CLI pin 1.0.8 → 1.0.9 (gs-fortress audit-1.0.9, kickoff E2: CP-1 + CP-5). What a user gets by
updating: the reference bundle (catalog, cheatsheet, ask-rules, version) regenerated from
1.0.9. The only catalog change is the connectors list — `cn list` loses `--from`/`--to`
(flags its handler never applied) and `cn list` / `cn jobs` name the v2 duct connections
endpoint; counts unchanged (188 commands / 182 MCP tools / 10 domains), no mutating flag
moves, the guard untouched, the 20 non-mutating POST fetches the same list. The
shape-tolerant connectors reading, refresh's migration note and setup's id-path guidance
already shipped in 0.36.1 (F-388).

Version prose across the skills, references and the operating model re-checked at 1.0.9:
measured at this adoption, exactly four package files differ from 1.0.8 (the two connectors
artifacts, the CHANGELOG, package.json), so every 1.0.8 claim carries over — the scorecard
`_total`, the rules-engine mapper semantics, the designer drilldown grammar, the known-issues
list. The live arms this pin owes (the F-388 `cn list` captures with the 1.0.8 baseline
taken before the upgrade, the designer drilldown, list-envelope and paginate standing arms)
are the maintainer's tester round, measured before the next pin moves (MAINTAINERS.md,
"Regenerating after a CLI upgrade").

Also in this version, from the adoption's tester round (a full walk of all eight skills
on a sandbox tenant at 1.0.9):

- **Refresh derives each domain's change window from that domain's own list stamp**
  (`report` now emits `lookback`, per indexed domain: days since `domains_indexed.<domain>.at`)
  instead of a workspace-wide `last_refresh`. The `touch-refresh` verb is retired: it stamped
  "now" regardless of how many domains an interrupted crawl reached, so every unreached domain
  silently lost its window on the next run (F-417). `last_refresh` stays in the manifest as a
  legacy field nothing reads.
- **`upsert-batch` refuses a per-call generated timestamp as a date field** — every row of a
  full list sharing one value within ten minutes of now (`sc scheme list`'s `modifiedAt` at
  1.0.9; F-418): recorded, such a field flipped the whole domain stale on every refresh
  forever. Remedy `--no-date-field --allow-redate`; `--allow-generated-date` overrides. The
  scorecard domain note names the command; setup's date-field rule names the signature.
- **The under-pagination warning names the third expected case** — a scope-limited domain
  such as `jo email templates`, whose shortfall is permanent and points at
  `references/index-scope-notes.md` (F-419).
- **Two notes stated a false reason for correct advice** and now state what the command does
  (F-416): audit's `re r list` note (an `id` key exists and differs from `ruleId`) and
  deprecate's schedule note (`re r schedules` and `re r test-schedule` exist; the former reads
  empty on a tenant whose rules are chain-scheduled).
- Setup's token half-life sentence now cites 1.0.7 through 1.0.9 (re-measured at the pin).

From the second tester round on the same adoption:

- **The generated-timestamp refusal reads the real payload** (F-418, reopened and fixed
  again): `sc scheme list` carries `modifiedAt` as epoch-millisecond numbers stamped row by
  row, so the guard now parses ISO strings and epoch numbers alike and treats "all values
  within two seconds of each other, within ten minutes of now" as the signature, not "one
  identical value". The operating model's Known CLI issues list names the command (ledger
  KI-016).
- **A `--name-field` no row carries is refused** the way the id and date fields are, and an
  unchanged row whose stored name is null takes the incoming name (`namesBackfilled` in the
  summary), so a domain indexed with the wrong name field is repaired by one re-run with the
  right one plus `stub` to re-title its stub docs — refresh documents the two-step repair
  (F-421; on one workspace hundreds of rules were nameless with no path back).
- Refresh's `--days` line describes the per-domain default it actually has (F-420).
- report-bug's template puts only the installed CLI version inside the `**CLI:**` backticks —
  the ledger's `register` verb lifts `observedOn` from exactly that — and states a catalog
  discrepancy in the Environment section instead (F-422).

From the third tester round on the same adoption:

- **The under-pagination warning's remedy is derived from the flags the run passed** (F-425):
  a re-list that passed `--list-command` (every refresh upsert) was told to "declare itself
  with `--partial`", and following that hit the script's own refusal — `--partial` cannot
  combine with a recording flag. The warning now names the flag it passed and says
  `--partial` is not the remedy there; the general `--partial` sentence stays for a run that
  passed none.
- **The `--name-field` refusal derives its hint from the offending rows** — the first row's
  keys — instead of a fixed rules-engine example that advised `ruleName` for template rows
  carrying `title` (F-426). The scorecard domain note now describes the generated-timestamp
  signature the guard actually tests: values within a couple of seconds of each other and of
  now, one shared value or a millisecond apart.
- **`report` echoes `environment`**, so refresh step 1's backfill branch is decided from the
  command step 1 prescribes — `environment: null` is the trigger — instead of "read it"
  pointing at a manifest the skill says never to open by hand (F-427).

From the fourth tester round on the same adoption:

- **KB domain folders are resolved from the manifest's recordings, not from default names**
  (F-429). A domain's name is per-workspace data — one workspace built by this plugin records
  `connections` / `connector-jobs` / `report-reports`, another `connectors` / `connectors-jobs`
  / `report` — and deps-report's lanes were keyed on the defaults, so on the first workspace
  it read zero connection docs, zero reports and zero connector jobs with no caveat. Every
  reader now resolves "the domain for `cn list`" from `domains_indexed`'s recorded list
  command through the catalog (deps-report's nine lanes, the relationships builder's five
  defaults, the candidate gate's diff — one table in doc-lib). deps-report reports which
  folder each lane read (`domainDirs` / `domainDirBasis`) and warns when that differs from
  the defaults.
- **Every honesty signal that resolver produces reaches every surface a reader is told to
  open** (F-429, second pass): a lane read from a non-default folder, two domains recording one
  list, a no-catalog fallback are in deps-report's stdout summary, its markdown "Caveats & data
  gaps" section AND its caveats CSV (the first pass left them on stdout only); the
  relationships builder reports `domainDirs` / `domainDirBasis` and carries them in every
  map's coverage header; email-report's index records them (`domains`, `warnings`), so the
  four report modes built from it days later carry them as "index build:" caveats; the gap
  work-list emits its basis and warnings. The run-level warnings of deps-report and the JO
  report modes (a duplicate term dropped, an alias prefix with nothing to apply to, a `--name`
  that matched several programs) lead the Caveats section and the caveats CSV the same way.
  When two domains record one list, the reader picks the one holding inventory entries, else
  the one whose folder holds docs on disk, else the first by name — and says which rung
  decided, instead of silently reading whichever sorts first.
- **`upsert-batch` refuses a renamed or misspelled domain** (F-429): an unrecorded `--domain`
  whose `--list-command` or `--describe-command` is the command another domain was indexed
  from — alias spellings included — is refused instead of silently forking the inventory
  under a second key prefix. Refresh's 1.0.9 migration example passed `--domain connectors`
  literally; it now names the recorded connections domain and says where to read it.
- **The change journal no longer writes "completed" for a mutating call whose exit status the
  harness could not see** (F-428): a call that was not the command line's last stage (piped,
  `;`- or `||`-chained, a non-last line, or inside a nested shell that is itself piped) is
  journaled "ran — exit status not visible (…)"; a failure-shaped signal keeps its FAILED head
  and says the failure may belong to a later stage. `&&` keeps the unqualified word, since a
  later stage cannot hide this one's failure. The same rule covers detection confidence: a call
  found only by the quote-blind re-scan (quoted prose) or in operand position (text being
  echoed or written) is journaled "not verified as executed (…)" rather than "completed" with
  the doubt in the note alone. And the guard's tokenizer now knows a heredoc: the lines after
  `cmd <<DELIM` up to the delimiter are that command's data, not commands of their own, so a
  gs-admin line written into a notes file asks with the operand caveat (naming the heredoc
  body) and journals "not verified as executed" — before, a body whose quoting happened to be
  balanced was read as a new command line and journaled as a call that ran. `<<-`, quoted
  and spaced delimiters, CRLF, several heredocs on one line and an unterminated body read the
  same way; a here-string (`<<<`) is not a heredoc. The two tokenizer passes are one function
  in two modes, so the grammar cannot drift between them again.
- **The change journal's `target:` field carries only the invocation's own arguments**
  (F-431): it was assembled by walking tokens to the next operator, so a two-line command
  journaled line 2 as line 1's target, a heredoc opener carried its redirection word and body,
  and a gs-admin line inside a heredoc body swallowed the rest of the body and the command
  after the terminator. Arguments now stop at a line boundary, at heredoc data and at a
  heredoc word, exactly as they always did at `>`.

From the release-gate review of this version (every finding fixed before the cut):

- **A domain's identity is its list command** (F-432): the renamed-domain refusal treated any
  `--describe-command` as identity too, so the `none` sentinel every list-only domain records
  made setup's SECOND list-only domain a "rename" with no override. A describe command shared
  with another domain now warns and names it; only a list-command match refuses.
- **A heredoc is announced only by an unquoted `<<`** (F-433): a quoted `<<EOF` or an arithmetic
  shift used to open a phantom heredoc that swallowed every following line as inert body, so
  a real mutation on the next line was journaled "not verified as executed".
- **An arithmetic expansion is one word only where the shell reads it as one** (the release-gate
  security review of this version; fixed inside the gate, no bus number): the F-433 rule above
  consumed `$((` … `)` whole by paren depth, and nothing read inside it. PowerShell has no
  arithmetic expansion, so `$((gs-admin jo p save))` is a subexpression around a grouped
  pipeline and ran the call; bash reads `$((` as arithmetic only when the span closes with an
  adjacent `))`, so `$((gs-admin jo p save); true)` ran it too; and a substitution nested inside
  real arithmetic is expanded first. Each ran with no ask and no journal row on the unreleased
  tree (never on a shipped version). Now the PowerShell lane never takes the arithmetic
  reading, a bash span closed by a lone `)` is the substitution it is, and a real arithmetic
  span's interior is re-scanned, so the inner call asks and is journaled "enclosing".
- **The journal's qualifiers hold on every finding shape and every signal** (F-428, third
  instances): a piped unknown or variable-subcommand row is masked like a catalog-known one; a
  row whose harness reported no status stays "not verified" instead of being upgraded to
  "ran"; an exit code plus an interruption flag no longer bypasses every qualifier.
- **The resolver decides what a flag overrode** (F-434): relationships-build's map headers no
  longer claim a lane was "resolved from the recordings" after `--<lane>-domain` overrode it,
  and the email gap work-list reads the KB folders under the slug directory, so its tie-break
  agrees with the other readers.
- **email-report's gap-fill lines name the recorded domains** (F-429, third instance): the
  step-4c commands passed `--domain journey` and `--domain journey-email-templates` literally
  with `--partial`, the one path the renamed-domain refusal cannot see; they now take the
  names from the gap summary's `domains` field.
- **No runnable line in any skill or template names a default domain folder literally**
  (F-429, fourth pass — the class made mechanical after a fourth instance surfaced in
  setup's document-domain notes, whose one-off recovery lines wrote under `<slug>/journey`
  and `<slug>/journey-email-templates` while every reader followed the recording). The lane
  vocabulary now has one home (doc-lib's `RECORDED_LANES`, which every reader derives its
  lanes and no-recording defaults from), those two lines take `<journey-domain>` /
  `<templates-domain>`, and the doc-drift gate sweeps every runnable line in the shipped
  skills and templates against that table, so the shape cannot come back unnoticed.
- **A redirection before the subcommand no longer hides the command** (F-436, the release's
  security review): the guard's argument collector stopped at a heredoc word and at every
  redirection as if it ended the invocation, so `gs-admin <<EOF jo p save` (silent since the
  F-431 target fix above) and `gs-admin > out.txt jo p save` (silent on 0.36.3 as well) ran a
  mutation with no approval prompt and no journal row. The guard's tokenizer is now a lexer
  driven by the shell's grammar as data: the control operators; the redirection operators —
  bash's `>`, `>>`, `>|`, `>&`, `<`, `<<`, `<<-`, `<<<`, `<&`, `<>`, `&>`, `&>>` and
  PowerShell's `*>` / `n>&1` — behind the complete fd-prefix grammar (digits, `*`, bash's
  `{varname}`); and the constructs that nest a command (`(…)`, `{…}`, `$(…)`, backticks,
  `>(…)`/`<(…)`, `$((…))`). A redirection word, glued, spaced or fd-prefixed, is stepped
  over by the argument collector, which stops only at a command separator; a substitution is
  one word of the enclosing command whose inside is still scanned as its own; a `${name}`
  flag value before the subcommand is a word. The arguments after a redirection are the
  command's own, in the prompt and in the journal's `target:`. The pins are generated from
  the vocabulary, and a shell-as-oracle test runs generated lines through real bash and
  PowerShell with a recording shim, requiring the guard to ask on every line the shell
  executed. That test found two more silent shapes, both closed: a bare `gs-admin` handed to
  another command as its argument (`… | xargs gs-admin`) now asks fail-closed, since its
  arguments come from elsewhere; and a string run as a command line by `env -S` or `watch` is
  re-scanned like a nested shell, as are the stdin payloads a line carries — a here-string's
  target (`bash <<< '…'`) and the words of the upstream pipeline stage (`echo '…' | bash`).
  What reaches an interpreter from a file or another program's output (`bash script.sh`,
  `cat script.sh | bash`) is the new documented residual, `stdin-payload`.
- **The journal's outcome says WHOSE status it reports** (F-438): on a line with a
  substitution the qualifier was inverted — `gs-admin … > >(cat)` warned that the failure
  "may belong to a later stage" though bash reports the command's own status, while a
  mutation INSIDE `>(…)`, `$(…)` or backticks was journaled from the outer command's success
  event with no caveat at all. Both now follow what the lexer recorded: a call inside a
  substitution is "ran — exit status not visible (this call ran inside a substitution, so the
  harness reported the enclosing command's status, not this call's)", and a substitution on
  the call's own line is not a later stage. The same test surfaced two more shapes whose line
  status is not the call's: a backgrounded call (`… &`) and a negated one (`! …`) are now
  qualified too. A call inside a nested `powershell -Command '…'` payload is qualified as
  well ("nested"): PowerShell reports 0 or 1 for its last statement, never the call's code.
- **An operator glued to the binary name no longer hides the command** (F-440, the
  release's Step 0 review of the fix above): the guard's command-text gate required
  whitespace or the end of the text after the name, so `gs-admin>f jo p save`,
  `gs-admin<<EOF jo p save`, `gs-admin&>f jo p save`, `gs-admin'' jo p save` and every
  other operator or empty quote glued to the name ran a mutation with no prompt and no
  journal row — on every shipped version. The gate now states only that the text mentions
  the name; what ends a word is the lexer's decision.
- **A command name the shell computes is read as the invocation** (F-441): a substitution,
  a call-operator expression or a variable standing where the command name goes was never
  a candidate name, so `$(which gs-admin) jo p save`, `` `which gs-admin` jo p save ``,
  `"$(which gs-admin)" jo p save`, `n=gs-admin; $n jo p save`, bash's `$'gs-admin' jo p
  save` (until now a documented residual) and PowerShell's `& (Get-Command gs-admin) jo p
  save` ran in silence. Such a word is the invocation where the shell's grammar makes it
  one — at command position in bash, after the call operator `&` in PowerShell (where a
  statement beginning with `$x` or `$(…)` is an expression) — its arguments are the words
  after it, and the prompt carries a caveat naming the computed spelling; an assignment is
  never a name, and the reading is additive (`$(gs-admin jo p save)` is an inner call and
  asks as one). A variable set by an EARLIER command stays the documented
  not-spelled-as-the-binary residual.
- **A redirection between an interpreter and its payload no longer hides the payload**
  (F-447, the release's second review): `bash -c > f 'gs-admin jo p save'`, `bash > f -c
  '…'`, `bash -c 2>&1 '…'` and `eval > f '…'` ran the mutation in silence — the payload
  locator stopped at a hand-listed operator set that still carried five redirection
  spellings, one layer above the lexer that had just stopped doing so. Every token walk now
  asks the one separator set and the lexer's record. The same review closed four shapes the
  Step 0 batch itself had opened before they shipped: an escaped `\"` inside a string (and
  PowerShell's `` `" ``) keeps the quote open, `''#x` is an argument and not a comment,
  PowerShell's block comment `<# … #>` is grammar, and a pipe inside a heredoc body's
  markdown table is data to the lint.
- **The lexer asks the redirection vocabulary before the control-operator table**
  (F-442): `save&>f` was read as `save` `&` `>f` and the journal row said the call was
  backgrounded; a heredoc delimiter kept its backslash (`<<\EOF` never found its
  terminator, and the command after it was journaled as inert data); the text of a `#`
  comment was the row's `target:`; and a redirection between a global flag and its value
  was taken as the value. Comments are discarded as the shell discards them, and the
  delimiter is the word after quote removal.
- **The shell-safety lint reads the lexer's tokens** (F-443): it was a second scanner over
  the raw text with its own quote state and operator clauses, so a `|` inside heredoc
  DATA drew a coaching deny on a line that also carried a real mutation, and it disagreed
  with the lexer on `word&>file`. The lint, the here-string payload reader and the
  flag-value skip now consult what the lexer recorded; nothing re-derives an operator from
  a word's text. The shell-oracle test generates the positions these came from (an
  operator glued to the name and to the word before it, the computed names, comments,
  quoted delimiters), asserts that a plain command's row is bare and that a row the
  generator knows executes is seen executing, and gives every run its own session ids.

Documented at the cut, measured on the hook with a synthetic payload: the guard's known
residual set gains **a payload stored in a variable** — the mutation assigned first (a quoted
string or a PowerShell here-string) and evaluated later by name (`eval "$s"`, `bash -c "$s"`,
`iex $s`, `Invoke-Expression -Command $s`) runs without the prompt and without a journal entry,
in both shells. A literal payload to the same eval asks; a here-string piped into `iex` is
denied by the shell-safety lint; a heredoc fed straight to an interpreter asks with the
operand caveat — those three are not residuals. The README's parsing-boundary block, the
residual ledger and its fixture pin carry it together, as the other residuals are carried.

Repo-side, not shipped: the instance-data checker resolves its private-pattern config from
the main checkout when run from a worktree and warns on its own line when none loaded; the
dev-branch pre-push hook runs it on every ref, and is now tracked (F-423). The checker also
asserts its own coverage (F-424): an empty index or a tracked file missing from disk fails
the run as a named coverage shortfall instead of passing "0 of 0 tracked files scanned",
and a file HEAD commits that the index lacks is named on its own warning line. The stale-facts
gate now reads the bus header's Under test line itself — present, single, and naming the same
handoff as the canary skill at the declared location (F-439: a round-block script replaced
the line and every gate stayed green). The Step 0 review found that gate reading proxies
(F-444): the canary match was a substring test (a description carrying a stale stamp beside
the fresh one passed), and the reopen count behind bus rule 5 read one verdict wording. The
stamp is now compared whole, and a reopen is counted from a verdict saying REOPENED or "back
to OPEN" and from the section's Fix notes — a third one is a second reopen.

## 0.36.3 — 2026-09-07

Shipped-byte housekeeping — nothing a user runs behaves differently (bus F-410, F-411,
F-412, F-413; the shipped-byte decree of 2026-08-16 is why this is a version at all).
What changed inside the plugin:

- **`scripts/manifest.mjs` is now under the strictNullChecks ratchet** (the fourth
  file; GP-B2). Type-narrowing rewrites only — every guard keeps its condition and
  message, measured across the `mark` verb's argv cases. `load()`/`save()` carry the
  T-2 manifest typedef, and the three enumerations (`status`, `depth`, `crawl_mode`)
  are typed against it, so a member added to a Set but not the typedef fails
  `npm run typecheck` under both configs (F-412: the release-gate review found the
  first admission asserted that equivalence without checking it).
- **The reader-shapes tracer (`test/trace-reader-shapes.mjs`) runs one manifest init
  per sweep instead of one per probe** (F-410): 106 fewer Node cold starts, the
  emission byte-identical.

Repo-side, not shipped: the AGENTS.md decision-discovery hint was rewritten after the
DS-21 part 3 index was measured and cut, then corrected at this gate (F-411: an
em-dash-only WONTFIX header shape that found 4 of 13, and three register tables the
hint omitted).

## 0.36.2 — 2026-09-05

Six small things a user gets, plus housekeeping (bus F-391, F-397, F-398, F-400, F-403 and
F-404; the going-public backlog's lint item closed on measurement rather than built):

- **Declining the build-standards pack now sticks.** Setup used to record the decline as a
  comment inside your `.gs-superadmin/CONVENTIONS.md`, and accepting a later template
  refresh of that file replaced it whole, so setup asked again. The decline is now the
  marker file `.gs-superadmin/conventions-pack-declined`; a workspace that declined before
  this version is migrated the moment it accepts a refresh (bus F-403).
- **A scaffolded file you deleted stays deleted.** Answering `accept` or `defer` on a file
  you had removed used to re-create it (and `defer` left a `.new` beside it that the
  session-start line reported forever). The decision verbs now refuse a removed file and
  say how to get it back (bus F-404).

- **A wrong `--id-field` on a rules or journey domain no longer lectures you about
  connections.** The zero-resolve failure of `manifest.mjs upsert-batch` and of
  `domain-candidates.mjs check` used to append the connection-shape hint (nested
  `pnpConnectionsInfo.connectionId` at one CLI version, top-level `connectionId` at
  another) to every typo'd id path. It now appears only where the payload looks
  connection-shaped — the connectors domain, or rows carrying `pnpConnectionsInfo` /
  `connectionId` — and every other domain gets a domain-neutral sentence; the operative
  advice (inspect a row, pass the dot-path the installed CLI emits) is unchanged, and so
  is the connectors-domain message the refresh skill's migration note quotes (bus F-391).
- **`/gs-superadmin:report-bug` dedups against the gs-fortress known-issues ledger** when
  the workspace names a checkout in the git-ignored marker `.gs-superadmin/fortress-dir`:
  step 1 reads the ledger's `title` / `howToTest` first, names the matching KI id and
  offers to register the report against it, and the closing block prints the ledger's
  register command. Plugin users without a gs-fortress checkout have no marker and skip
  the check — nothing asks for one. The output-directory prompt now warns off *public*
  repos rather than repos (a private repo's folder is a fine destination) (bus F-400).

- **JO report workbooks carry the caveats.** Every `email-report` mode written with
  `--csv`/`--xlsx` now also writes `<mode>-caveats.csv` (one column, one row per caveat,
  header-only when there are none), so a workbook reader sees the same "Caveats & data
  gaps" the markdown report carries. The `deps-report` workbook has had this since 0.36.1;
  the four JO modes gain it from the shared report tail, so none carries its own copy.
- **A renamed or moved bundled script can no longer ship behind a fence.** A repo check now
  holds every `.gs-superadmin/plugin/<path>` in the skills, references and templates to a
  tracked plugin file (and reds the `plugins/` typo), so a path that would fail live with
  MODULE_NOT_FOUND — which the operating model's link bullet would misread as a stale link
  — is caught at the gate instead of in your session.
- **Your scaffolded files stop going stale silently.** Setup used to copy the operating
  model and the conventions files once and never look at them again, so a workspace set
  up before 0.36.0 still described the old placeholder rule. Setup now keeps the pristine
  template of each scaffolded file under `.gs-superadmin/scaffold/` and, when the plugin
  ships a newer template, refreshes an unedited copy in place; an edited copy is never
  overwritten — the new template is written beside it as `<file>.new` and you are asked
  once (replace, keep yours, or reconcile later). Every plugin session start says how many
  scaffolded files are behind or have a `.new` waiting, and points at setup. The first
  setup run after this upgrade records your existing files (bus F-396). Where more than one
  of those conditions holds at once, that line separates the sentences instead of running
  them together (bus F-401).
- Housekeeping: two unused imports removed from shipped scripts (`journal.mjs`,
  `jo-report-deps.mjs`) as the repo's type gate gained `noUnusedLocals`; a handful of
  one-token lint cleanups; and the repo's CONTRIBUTING.md now explains the `F-nnn` /
  `DS-nn` citation tokens in the scripts' comments (provenance, not links).

## 0.36.1 — 2026-09-05

A user whose installed `gs-admin` is 1.0.9 gets their connector dependencies back (bus
F-388, Class: reader-shape — gs-fortress audit-1.0.9 §1.11–§1.13; decoupled from
adopting 1.0.9: the repo pin stays 1.0.8 and no catalog changes). What a user gets:

- **Both connection row shapes are read.** At CLI 1.0.9 `cn list` moved to the v2 duct
  route and its rows flattened — the fields that sat under `pnpConnectionsInfo` are
  top-level. `deps-report`'s connection registry read only the nested shape, so every
  connector doc a 1.0.9 CLI captured parsed to nothing: the named connection's own
  Connections row, every type-level rule row (rules record only the connection type,
  which the registry expands from the name), and every id-to-name resolution
  disappeared, while connector-job rows carrying the name inline survived — which made
  the report look plausible. The reader now walks a declared shape list, nested first
  (still the shape of `re r list-rest-connections` and the data-preparation S3 discovery
  at 1.0.9), then flat, so a KB holding docs from both CLI vintages resolves every
  connection.
- **A registry shortfall is reported, with its remedy.** A connector (or External Action,
  or scorecard) doc that parses to no registry entry is counted and named in the
  report's Caveats — "N of M connectors doc(s) parsed to no connection — … Re-capture the
  connectors domain with the installed CLI …, or inspect a doc's payload shape" — not only
  when ALL of a lane's docs fail (that caveat stays, and now names the remedy too). The
  partial case is the common one: a long-lived workspace refreshed after a CLI upgrade
  holds old-shape docs that still parse beside new-shape docs that did not, so the
  registry looked healthy and nothing said otherwise. The summary JSON carries per-lane
  `…Docs` / `…Unparsed` counts, and `--csv-dir` now also writes `tenant-deps-caveats.csv`,
  so the `--xlsx` workbook carries every caveat the markdown report does (it carried none).
- **The id-path guidance names both paths.** `domain-candidates.mjs check`'s zero-resolve
  message and setup's Phase 4 sentence say where a connection row's id lives per endpoint
  and CLI version — nested `pnpConnectionsInfo.connectionId` from `cn list` at 1.0.8 and
  from `re r list-rest-connections`, top-level `connectionId` from `cn list` at 1.0.9 —
  and that the recorded `idField` must match the shape the installed CLI emits.
- **`upsert-batch` refuses a dead id or date path instead of accounting for it.** An
  `--id-field` that resolved on none of the rows used to exit 0 with `added 0`, a
  skipped-row warning that mis-read the drop as under-pagination, and a stamped domain
  (the F-333 phantom); it now fails before writing anything, names the shape hint
  `domain-candidates check` already taught, and — when the field is the domain's own
  recording, as it is on the first refresh after a CLI upgrade — the one-run
  `--allow-rekey` route. A `--date-field` (recorded or explicit) that resolves on none of
  the rows used to read every row `unchanged` forever with an empty warnings array —
  change detection silently dead; it now fails the same way and asks for the
  `--allow-redate` decision. Found by the F-388 tester round on the connectors domain
  after a CLI 1.0.9 upgrade; both refusals are generic. Bounds from the release-gate
  review (F-392): the date refusal fires only when the date KEY is absent on every row —
  rows carrying the key with a null value are data and pass; a declared subset
  (`--partial`, the email-report gap-fill lists) is exempt; and a full list where some
  rows lack the key gets a counted warning (`N of M incoming row(s) carry no <field> key`),
  with `datePresentRows` / `dateResolvedRows` in the summary.
- **Plugin link: quieter and more exact** (release-gate review, F-395). The SessionStart
  hook runs on `startup` and `resume` only (no re-run on compact or clear); the OneDrive
  advisory names a workspace only when it is the OneDrive root or sits under it (a sibling
  folder such as `OneDriveBackup` no longer triggers it); and running the link script by
  hand in a folder with no `.gs-superadmin/` prints `(nothing linked) …` on stdout instead
  of exiting silently, so setup's first-run fence cannot read a missing directory as
  success.
- **Refresh: connectors fetch exhaustively, and the first post-upgrade refresh is
  explained by quoting the script.** `cn list` leaves the recency-filter lane: its
  `--from`/`--to` never filtered anything at 1.0.8 and do not exist at 1.0.9 (`cn chains`
  / `cn jobs` keep theirs, which do filter). The operator note for the first refresh of an
  existing KB against a 1.0.9 CLI quotes the two refusals above verbatim (a doc-drift check
  holds the quotes to the script) and gives the one command that answers both: the flat
  `--id-field connectionId --name-field connectionName --allow-rekey --orphans-file` (id
  values unchanged, orphans empty) plus `--no-date-field --allow-redate` or
  `--date-field <f> --allow-redate`, depending on what a flat row carries.

## 0.36.0 — 2026-09-04

Every skill's execution path changes, and every existing workspace gains a link at
its next plugin session start (GP-B5 DS-43 — the design note's E1–E7, ratified
2026-09-04). What a user gets:

- **The workspace plugin link.** `/gs-superadmin:setup` now creates
  `.gs-superadmin/plugin`, a directory link to the loaded plugin's root (an NTFS
  junction on Windows — no elevation, no Developer Mode — a directory symlink on macOS
  and Linux), and a new `SessionStart` hook repoints it at every plugin session start
  to whatever plugin the loader actually loaded. Nothing is copied into the workspace;
  the link's target comes from the link script's own real path, never from an
  environment variable or workspace data; a stale or dangling link is repointed, a real
  directory at the link path is refused and never deleted; the script is inert outside
  a `.gs-superadmin/` workspace and never blocks a session (a failure arrives as one
  session-start note naming the remedy). Existing workspaces need no re-setup: the
  hook creates the link on their next session.
- **Every fenced plugin command runs through the link.** The seven skills that used to
  address bundled scripts through the `CLAUDE_PLUGIN_ROOT` placeholder — which only the
  plugin loader substitutes, and which expanded to empty in both shells whenever a
  skill was read outside a plugin session — now run
  `node .gs-superadmin/plugin/scripts/<x>.mjs …`, a relative path every shell resolves.
  The six per-skill surviving-literal warnings are gone; setup keeps one, above the one
  first-run fence that still needs the placeholder (no link exists yet). Setup's
  reference files, the operating model's bullet, and the workspace cheatsheet's
  regenerate line use the same path.
- **Belt.** Inside a git work tree the link script reports (never fails) when
  `.gs-superadmin/plugin` is not git-ignored — on Windows git would otherwise track the
  plugin's contents through the junction; setup's `.gitignore` entry already covers it.
- **Declared residual (OneDrive).** A Windows workspace under `%OneDrive%` is named as
  such in the session-start note. The junction was measured to work with the sync
  engine running over a short window; longer-window behaviour is unmeasured.

## 0.35.5 — 2026-09-04

Documentation only, shipped bytes changed (the plugin README), so it bumps.

- **Currency notice.** The plugin README (and the repo README) now carry Gainsight's
  requested notice: the document was last updated on the date the pinned catalog was
  generated, against the pinned `@gainsight/gs-admin-cli` version; Gainsight may have
  updated its documentation and package since, and support.gainsight.com is where the
  latest lives. The notice's date is held to `data/catalog.json` `meta.generatedAt` by
  `build/check-stale-facts.mjs`, so it can only move on a CLI adoption.

## 0.35.4 — 2026-09-04

The release-gate review of 0.35.1–0.35.3 (F-372..F-381). What a user gets:

- **macOS: the change journal's failure alert is never lost.** After an approved
  `gs-admin` mutation, the guard journals it; if that append fails (a locked file, a
  missing or stale journal-lib beside a hand-vendored hook) the hook tells you so in a
  `systemMessage` — and that message was written and then exited past, the same
  macOS-pipe shape 0.35.2 fixed for the three permission replies. Both alert sites now
  exit in the write callback. The 0.35.2 note said "all three reply sites"; it was
  three of five. Nothing changes on Linux or Windows.
- **Contracts and diagnostics tidied, no behaviour change:** the shared KB-identity
  reader's type contract is attached to its function again (the type gate had bound it
  to nothing); `program-doc` / `template-doc` now say `--out-dir requires a value` like
  every other script when the flag is left bare; this CHANGELOG's 0.35.1 entry names
  `validate-request-event.mjs` (change-request skill), whose exit path got the same
  macOS fix in that release, and the 0.35.3 entry's byte-identity claim is scoped to
  the refactor it describes.

## 0.35.3 — 2026-09-03

Internal only (GP-B5 W10 — F-362): the four JO report modes (search, program,
audit-active, deps) share one report-writing tail instead of four hand-copied ones.
The refactor itself changes no bytes — every report, CSV and summary from the hoisted
tail is byte-identical to 0.35.2, pinned by fixtures captured before the change — with
two deliberate exceptions, both below: the widened caveat trigger and the caveat's
reworded sentence. The one edge that moved: search and
audit-active now draw the PowerShell-quoting caveat when the report body itself
carries the bash apostrophe escape, as program and deps already did.

That caveat's own wording was corrected to match (F-371). It used to open "Command
hints on this report quote values with…", naming a cause that need not be there once
the scan reaches quoted content: it now reads "This report carries the bash apostrophe
escape … in a command hint, in quoted content, or both". The advice is unchanged.

## 0.35.2 — 2026-09-03

The mutation guard's approval prompt stays readable and whole in a workspace with many
tenants (GP-B5 W10, the sanctioned guard wave — F-363). A safety-boundary change to the
hook: no ask became a deny or disappeared; every reply carries the same decision as before.

- **The prompt names at most five tenants.** The guard lists the tenant directories
  whose `_manifest.json` it found so you can confirm `gs-admin whoami` targets the
  right one. Uncapped, that list grew by about 165 bytes per directory — a workspace of
  100 tenant directories produced a 17 KB reason nobody could read in a permission
  prompt. It now shows the first five and ends the list with "; and N more". When the
  list is cut, production tenants (recorded at setup, or production-looking under the
  legacy heuristic) are listed first, so the "⚠ At least one of these tenants is
  PRODUCTION" warning still names the tenant it is about. Workspaces with five or fewer
  tenants read exactly as before. The shell-variable coaching (`gs-admin $cmd`) lists at
  most five variable subcommands the same way, with "(+N more)".
- **macOS: the reply is never cut mid-JSON.** The hook wrote its JSON reply and then
  called `process.exit`; on a macOS pipe stdout is asynchronous, so a reply over 8 KB
  (the uncapped list at roughly 48 tenant directories) lost everything past the first
  chunk and the harness received unparseable JSON instead of an "ask". All three reply
  sites now exit in the write callback, so the whole reply reaches the harness whatever
  its size. Linux and Windows behaviour is unchanged (their pipes are synchronous).

## 0.35.1 — 2026-09-03

Summaries survive a macOS pipe, and the two deps surfaces read one identity (GP-B5 W10,
the verification-doctrine wave's seeding sweep — F-360, F-361):

- **program-doc / template-doc / capture / manifest never lose the tail of their
  stdout summary on macOS.** Each ended with a stdout write followed by
  `process.exit`; on a macOS pipe (the Bash tool every skill runs them in) stdout is
  asynchronous, so everything past the first ~8 KB chunk was dropped on exit — a
  doc-generator summary listing 60+ written docs was cut mid-JSON (the mechanism
  F-356 measured in the test fakes, now closed in the shipped scripts). The doc
  generators share one main in doc-lib and end on `process.exitCode`; capture's
  normalize/paginate summaries and manifest's early exits go through
  `makeCliHelpers`' new `finish()` (exit in the write callback). Linux and Windows
  behaviour is unchanged.
- **deps-report and email-report deps mode read the KB's identity through one
  copy** (`readKbIdentity` in doc-lib): the two hand-copied reads had drifted by a
  word in their warning and by whether a malformed `inventory` was tolerated — the
  stricter guard now applies to both.
- **domain-candidates' summary is written the same way** (it printed the whole
  candidate table and then exited — the same truncation on macOS).
- **The change-request skill's `validate-request-event.mjs` ends on
  `process.exitCode`** instead of `process.exit` after its per-file result lines, so a
  long validation run keeps its tail on macOS too (same fix, same class; exit codes
  unchanged). Added to this entry in the release-gate review — it shipped in 0.35.1
  without a line here.
- Internal, no behavior change: the scorecard measure walk lives once, in doc-lib
  (relationships-build and tenant-deps both import it).

## 0.35.0 — 2026-09-02

Data-designer field names reach the deps report (GP-B5 W9 — the F-344
hand-forward). At CLI 1.0.8 `dd t describe` returns each task as a summary row
with field COUNTS, so a `--field` term could never match a designer task and
every report said so in a caveat. Now:

- **setup / refresh: data designers are described in three levels.** The batch
  script's new designer doc-mode (auto-selected whenever the describe command
  resolves to `dd t describe`) runs the template describe, one `--task-id`
  drilldown per task, and one `--field` detail per show-field label, and writes
  ONE composite doc — the template payload with every drilldown verbatim under
  a `_kb` key (KB doc format T-3 v5). Cost is bounded per invocation
  (`--spawn-budget`, default 30 calls ≈ 75 s) and the doc is rewritten after
  every call: a run cut off mid-template leaves an INCOMPLETE doc that the next
  run resumes from, exactly like the rest of setup's budgeted loop. Existing
  summary-only designer docs upgrade on the next re-run (`--if-changed` skips
  only a complete composite). The drilldown flags and the template's task count
  are verified before any call; a label the CLI refuses under every spelling is
  recorded as a permanent gap on that field (never retried, never blocking)
  rather than failing the whole template on every run.
- **deps-report: designer fields match by SYSTEM NAME.** The per-field detail
  carries Field Name, Display Name, alias, and the field's own Source Object and
  Connection, so designer rows now match `--field Arr__gc` and attribute each
  field to its object (join tasks included). Criteria and join conditions are
  resolved through the same details. Where a detail is missing the row says why
  — summary-only doc, drilldown failed or not yet run, a field the CLI could not
  resolve, a detail with no Field Name (calculated fields), a duplicate label
  (the CLI's `--field` reaches only the first match), an unparsed join field
  list, a label-only column — and the report's caveat breaks the blind count
  down by reason instead of one number.
- **T-3 typedefs were invisible to the type gate** since the freeze: a line in
  doc-lib's header began with a code-fence marker, which opened a JSDoc code
  block and hid KbDocMeta / KbDocDepth from `tsc`. Respelled (v5); the header's
  typedefs are now checked.

## 0.34.5 — 2026-09-02

Shipped bytes from adopting TypeScript 7.0.2 as the repo's checker (GP-B5
W8.5/DS-51 — the checker is a devDependency of the repo, never of the plugin;
nothing at runtime resolves from it). One dead default removed, the rest
annotation-only (each logged per the shipped-bytes decree):

- **deps-report: a dead `?? null` removed from the external-action connection
  read** (tenant-deps.mjs). The nested `config.connectionId` read defaulted to
  null before falling through to the top-level `connectionId` — a default the
  fall-through already supplied, since `??` treats null and undefined alike.
  TypeScript 7's syntactic nullishness check (TS2871) names exactly that shape.
  Output is identical for every input class (78-case differential, 0 differing);
  the F-228 fixtures still pin all three payload shapes.
- **strictNullChecks-ratchet annotations in capture.mjs and doc-lib.mjs** (the
  DS-46 list; TypeScript 7 keeps a `let x = null` at `null` where 5.9 widened
  the initializer to `any` under the non-strict base — 29 sites): the paginate sweep's `verdict` is now typed as its
  eight-value vocabulary, `stopped` / `firstSignals` / `requestedSize` carry their
  nullable types; doc-lib's name-claimer map, the ask-overrides JSON read (cast
  at the boundary) and the deps-capture readiness status likewise. No behavior
  change.

## 0.34.4 — 2026-09-02

GP-B5 W8 post-release cleanup — three behavior changes in shipped scripts and
skills, plus annotation-only shipped bytes (each logged per the shipped-bytes
decree):

- **deps-report: a label-only data-designer source object never shows a display
  value in the identifier column** (DS-45, the W7 round-4 deferred observation).
  The CLI's task summary prints a source object as `Label (name)`, as the bare
  system name, or — for a task carrying an object label but no object name — as
  the label ALONE. The reader used to file that lone label as the row's object
  NAME, so the object cell showed a display value and a term spelled as the
  system name could never match. The reader now parses the value together with
  the task's type, the way the CLI builds it: on a derived task (join / merge /
  pivot / …) a parenthesis-free value can only be the label, so the row carries
  it as the label and its name cell reads `—`; on an extract it stays the bare
  name (an extract with a label but no object name prints the same bytes and
  cannot be told apart — the format's one collapsed branch, stated in the
  reader's comment instead of guessed at from the spelling). A `--object` term
  spelled as the label matches such a row; one spelled as a system name does
  not, because the summary shape carries none for it. The RULES reader gets the
  same split (found by this release's review): a rule's 1.0.8 task row is the
  same CLI summary (`_object`, `_connType`), and it was still read whole — a
  rule on a labelled source object matched neither spelling and lost its
  connection type. The CLI 1.0.4 "hybrid" designer docs still in KBs (raw task
  plus summary keys, whose summarizer copied a derived task's upstream task id
  into `_object`) are named as a real generation in the reader's contract and
  pinned to render exactly as before (tester round).
- **email-report index: an empty program name is "no name"** — the rule the KB
  doc metadata reader (`docMeta`) already applies, now applied by the program
  index too: a `- name:` bullet with nothing after it falls back to the doc's
  H1, an empty `advancedOutreachName` in a program payload keeps the
  doc-derived name instead of overwriting it with an empty string, and an empty
  name in a live `jo p list` row is recorded as null — the row itself is still
  a program (a name key's presence, not its value, is what admits it), and a
  filled second key spelling is no longer hidden by an empty first one.
  Invisible on every fixture the suites carry (measured); bumped because
  shipped bytes changed.
- **deprecate: live lookups sweep every page** (DS-47). Step 2's rules
  `--search` fallback and reports lookup, and step 4's SCHEDULE-filtered
  schedule search, now run through the capture helper's paginate mode — one
  `deprecate-<list>-{page}.json` file per page, the `rp list` sweep stating its
  rows path — instead of the hand-paged `--page <n>` instructions, so a name
  with more matches than one page holds, or a report beyond the first page, is
  no longer missed. The sweep's verdict, read per the setup Phase 4 canon,
  decides what the pages prove.
- **JSDoc annotations in doc-lib.mjs and capture.mjs** for the repo's new
  strictNullChecks ratchet (annotations only, no behavior change):
  `makeCliHelpers` declares its `fail` as never-returning and `opt`'s two call
  signatures; capture.mjs re-binds `fail` with an explicit type and types its
  byte buffers.

## 0.34.3 — 2026-09-01

GP-B5 DS-42, the JSDoc-contract type gate (entry per the shipped-bytes decree —
annotations only, no behavior change):

- **JSDoc annotations in shipped scripts** so the repo's new `tsc --noEmit`
  gate is green over the plugin: `renderTemplateDoc` / `renderProgramDoc`
  option bags typed, `domain-candidates`' decision-map loader marks
  `extraFields` optional, spawn-error `code` reads typed, the catalog
  emitter's runtime/static command tables typed, and `tenant-deps` declares
  its usage-row and match-hit shapes where they are produced. The guard hook's
  stdin payload is annotated against its T-5 `HookPayload` typedef —
  comment-only: the guard still imports nothing, every field stays optional
  and clamped, and its 6-way outcome precedence is unchanged (now
  fixture-pinned as a union).
- **T-3 header amended (v4)**: the envelope-rule homes are cited by symbol and
  enumerated complete (doc-drift check 9 keeps the list exact), and the reader
  roster names the DS-24 semantic layer.
- **deps-report now reports data-designer dependencies** (F-342 + F-343, found
  by this release's review and tester rounds; both pre-existing). Two reads
  were wrong: the data-designer describe payload arrives wrapped one level
  (`{ result, data: { templateId, name, _tasks } }`) and the extractor read the
  wrapper (F-342); and each `_tasks[]` entry is the CLI's SUMMARY row (source
  object, connection type, field/filter counts) with no nested query block,
  while the extractor read only the older nested shape (F-343). So every
  full-depth data-designer KB doc contributed zero rows — a Data Designer wired
  to the object or connection you searched for was reported as not depending
  on it. The extractor now reads all three task generations (legacy nested,
  live summary, live full) with one precedence rule per fact. Field NAMES are
  not in the summary shape, so a `--field` term cannot match those tasks; the
  report says so in a caveat and marks the rows instead of staying silent. The
  summary shape's object key is a display value — `Label (name)` when the
  source object carries a label — and is now split back into name and label so
  an `--object` term spelled either way matches (F-345; taken whole, a labelled
  source object matched neither spelling).
- **deps-report yield honesty (every domain).** The summary table gains a
  "docs yielding usages" column, and a domain whose parsed docs ALL yield zero
  usage rows now carries a loud caveat ("the payload shape is probably not the
  one this reader expects") instead of a confident zero — the class both
  findings above belong to, closed for the next payload change too.

Release-gate review round (F-346..F-353, all found by the medium review over
this release's full delta; fixed before the release cut):

- **Stub banners now carry a three-state completeness claim** (F-346). A
  domain's recorded describe command has three states — a template, the new
  `--describe-command none` (the recorded decision that no usable per-item
  describe exists), and unrecorded — and the stub banner says exactly what the
  recording knows: "full ingest" with the `--deep` pointer, "list-only
  (complete)", or "completeness UNKNOWN" naming both ways to resolve it. The
  0.34.1 rule read "unrecorded" as list-only, so a describable domain indexed
  without the flag had every stub stamped complete. `describe-batch` refuses to
  run a recorded `none` as a template; `stub`'s summary reports
  `describeState`; setup's Phase 4 instructs `none` for list-only domains. The
  catalog cannot make this call (scorecards describe through another command
  group, connector jobs through a flag), so it stays a recorded decision.
- **`capture.mjs --paginate` counts rows only on the envelope spine** (F-351,
  F-348): the entry array is the largest array at the root, a root child, or a
  `data` child — where all 31 list commands runnable without a per-asset flag
  keep their rows (read-only census on a live tenant at 1.0.8) — never an
  array nested elsewhere, which could inflate the running count and certify a
  truncated sweep `reconciled`. The rows array is decided, never guessed: a
  page with arrays only OFF the spine, or with several spine arrays of
  different lengths, is the new non-zero verdict `unrecognized-shape`
  (nothing counted, candidates largest first) instead of a silent pick, and
  the new `--items-path <dotted>` names the rows array explicitly — the same
  spelling `manifest.mjs upsert-batch` records. A `pageInfo` nested under a
  facet no longer masquerades as a reconciliation total. The decision itself
  lives once, in doc-lib (`decideEntryArray`), and `er-count` shares it, not
  just the rule: it refuses the same shapes (exit 1, the same reason) and
  takes the same `--items-path` (F-354, F-355 — the first cut left the
  decision in the page loop and `er-count` printed a silent 0 where the loop
  refused, and 98 on the one bundle-shaped envelope the census holds,
  `jo cta options`). The decision never ranks: a page decides only when its
  spine carries one distinct non-empty length (a single candidate, or
  equal-length echoes); anything else — a list with a filled side block, a
  bundle, a CLI view disagreeing with the payload — is refused the same way,
  because no structural rule can tell them apart (four were tried and each
  decided an unmeasured shape silently). The rows path is STATED instead:
  the audit skill's `rp list` fence passes `--items-path data.data` (its
  root `alerts` block fills on a tenant with something to report), and
  setup/refresh say when to state it. The scan reports empty spine arrays
  too, so the census can see such latent triggers.
- **Paginate honesty report no longer flags the normal empty last page**
  (F-347): the entry-array drift check ran before the empty-page stop, so every
  no-total sweep whose row count was a multiple of the page size ended with a
  spurious "counts may not be comparable" flag.
- **deps-report: the scorecard registry gets the all-unparseable caveat**
  (F-349): the three registry lanes (external actions, connectors, scorecards)
  are one table, so a scorecard domain whose docs all fail to parse says so
  instead of rendering every measure `(unresolved)` in silence.
- **One atomic file write** (F-352): `manifest.mjs`'s manifest and
  `--orphans-file` list, `capture.mjs`'s captures and `--normalize`, and
  `journal.mjs`'s change marker all write through doc-lib's
  `writeFileAtomicSync` (parent directory created, temp + rename with the
  Windows retry). The orphan list — the one record that cannot be regenerated —
  was a bare write that crashed on a missing directory.
- **relationships-build reads the journey `- key:` bullet through the shared
  parser** (F-353), so a backtick-quoted key resolves like every other bullet
  instead of skipping the stub/full depth gate.
- Build side (F-350): doc-drift check 14 enumerates a skill's reference files
  from the tracked tree like every sibling check, so an untracked scratch file
  can no longer red the pre-push gate.

## 0.34.2 — 2026-09-01

GP-B5 DS-24 consolidation (entry per the shipped-bytes decree) plus one
report fix its review round confirmed:

- **tenant-deps reports now caveat an all-unparseable connectors domain**
  (the one user-visible change). The connection registry's docs-vs-parsed
  pair was computed and discarded — the only registry with no F-228
  parse-honesty caveat, so a tenant whose connector docs all failed to
  parse got a confident "nothing depends on this connection" with no
  warning. The report now carries the same "parsed to 0 registry entries"
  caveat External Actions already had.
- Internal, no behavior change: the KB-doc fence-parse guard and KbDocMeta
  resolution that tenant-deps.mjs, relationships-build.mjs, and
  jo-report-deps.mjs each hand-synced are now single copies in doc-lib.mjs
  (`parseDocJson`, `docMeta`), proved in agreement by a differential
  fixture corpus BEFORE the collapse. One nuance absorbed by design:
  relationships-build's docMeta copy resolved missing id/name to
  `undefined` where the shared copy resolves the contract's `null` —
  invisible in every report (all consumers read through `??`/truthiness),
  pinned by the corpus.
- Internal, no behavior change: the `(none recorded)` no-name sentinel is
  single-sourced as doc-lib's `NO_NAME` (writer, readers, and display
  fillers import it; the value itself is KB format and pinned by fixture).
- **Scorecards documented in the KB now resolve by title in deps-report's
  Scorecards section and in relationships-build's scorecard hints** (F-341,
  found by the B10 smoke round). Four domains' KB docs write their `- id:`
  bullet as an inline code span (`` `SC-1` ``); the bullet reader returned
  the backticks with the value, so the id never matched the bare GSID a
  rule's scoring action carries and a documented scorecard rendered as a
  backticked id marked "(unresolved)". `topBullets` now parses a
  whole-value code span once, for every reader — the one reader that had
  tolerated it privately (jo-report-deps' key check) consumes the shared
  rule. Rows unresolved because their measure appears in no scorecard doc
  are unchanged (that is the correct answer for them).

## 0.34.1 — 2026-09-01

Three fixes from the W6/DS-32 full-setup tester round (F-331, F-333, F-334):

- **Setup Phase 2 no longer infers `environment` from the hostname** (F-331).
  The old rule — "hostname contains `sandbox` → sandbox, otherwise
  production" — recorded real sandboxes (the common `sb-<org>--<n>` naming
  family spells no "sandbox") as `environment: production` in the manifest
  and named their KB folder `-prod`. First run now asks one combined
  production-or-sandbox + folder-name question; hostname markers are a hint
  in the ask, never the decider. Still asked exactly once per tenant.
- **`manifest.mjs remove --domain <name>`** (F-333): the sanctioned exit for
  a phantom `domains_indexed` stamp — a typo'd `--domain`, or an upsert whose
  `--id-field` matched no row, exits 0 and stamps a domain that then pollutes
  `emptyDomains` and the candidate gate, with hand-editing barred. Refuses
  while the domain still holds inventory entries unless `--allow-populated`
  (stamp only; entries stay); cannot combine with `--key`/`--keys-file`;
  idempotent on an absent stamp.
- **`manifest.mjs stub` no longer advertises `--deep` in list-only domains'
  docs** (F-334). The banner now branches on the domain's recorded
  `describeCommand`: recorded → the `--deep` full-ingest pointer as before; a
  modern stamp with none recorded (list-only — connections, jobs) → a
  "list-only (complete)" banner stating the stub is the asset's complete doc,
  with no `--deep` line. Both variants keep the `Metadata-only stub` marker
  (parsers key stub depth on it). A legacy bare-timestamp stamp cannot tell
  the two apart and keeps the `--deep` banner.

## 0.34.0 — 2026-08-31

The setup skill restructures into a judgment-and-gates skeleton plus four
reference files (GP-B5 W6/DS-32) — same procedure, loaded in layers:
- `setup/SKILL.md` shrinks from 905 to 539 lines. Every gate is preserved
  verbatim: the three-part generation post-condition, the candidate
  adopt/exclude gate, the crawl-mode/checkpoint asks, the date-field
  inspection rule, every stop rule, and the canonical capture/pagination
  and token pre-flight statements other skills point at.
- Detailed mechanics move to `setup/references/`, read when their phase
  runs: `scaffold-mechanics.md` (Phase 3 file-by-file mechanics, ask
  texts, generation fallbacks, version agreement),
  `index-scope-notes.md` (describe-identifier cases, scope-limited
  domains, list-invisible template recovery),
  `document-domain-notes.md` (scorecard/email-template/journey-program
  payload semantics and doc modes), and `document-mechanics.md` (stub,
  `--deep` selection, the manual describe path, report shapes,
  hand-chaining rules). Reference files spell the plugin root as a
  `<plugin-root>` placeholder — the loader substitutes variables in
  SKILL.md only, and each file says so.
- Restated script contracts (the upsert-batch id/date recording guards,
  rekey/redate flows) shrink to the judgment plus "on failure read the
  script's message" — and the messages were made complete enough to carry
  that weight (review round): the rekey guard's remedies now name
  `--orphans-file` (it must be passed on the rekey run itself; the
  stranded-key list cannot be regenerated afterwards), and the rekey
  summary's hint says when the capture opportunity was missed.
- `setup/SKILL.md` line count: 550. The review round restored teachings the
  first cut over-trimmed: the scorecard `--name {name}` describe-template
  exemplar (the one domain whose recorded template uses `{name}`), the
  "domains with no recording still require `--command`" clause, the content
  fingerprint / `--if-changed` explanation, per-domain chunk sizing (journey
  programs take the generic ~10–15, never the template-scale ~50), and the
  `cn jobs` has-a-describe-but-too-ambiguous qualifier.

## 0.33.0 — 2026-08-31

The pagination doctrine moves from prose into the capture helper (GP-B5
W6/DS-30): `capture.mjs --paginate` now owns the page loop, the
short-page/total reconciliation, and the suspect-round-count honesty the
five co-loaded sites (setup Phase 4, refresh, audit, email-report, the
operating-model template) each used to restate:
- `--page-flag <name|none>` states the command's paging flag (never
  guessed; `none` = one reconciled fetch for limit-only and flag-less
  commands), `{page}` in `--out` writes one file per page, `--max-pages`
  (default 50) is the safety stop.
- Envelope parsing is parse-don't-validate over the measured variance:
  `pageInfo` under `data` / at top level / absent, `pageSize` vs `limit`,
  rows at `data.liteObjects[]`, top-level `_total`, totals as direct
  children of `data`, bare `data[]` with no total. Disagreeing totals are
  a `total-conflict`, never a silent pick.
- The summary is the honesty report: pages fetched vs parsed, rows
  counted, every total with its path, per-page entry counts, and a
  verdict — only `reconciled` and `unverified` (count disclaimed as the
  CLI-reachable set) exit 0; `mismatch`, `suspect` (a count landing
  exactly on a common server default or the requested limit with nothing
  to reconcile), `total-conflict`, `failed-page` (an unparseable page is
  a failed sweep page kept as evidence, never 0 entries), and
  `safety-stop` exit non-zero.
- The entry-count traversal is shared with `er-count.mjs` via doc-lib's
  new `scanListEnvelope` (er-count's exact no-descend contract, defined
  once); er-count remains the count-one-page tool.
- The five prose sites shrink to the invocation plus judgment: setup
  Phase 4 stays the canonical pagination statement; the others carry a
  paraphrase and pointer.

## 0.32.9 — 2026-08-30

Gate-2 verdict-round follow-ups (bus F-323..F-325) — all three findings sat
in the 0.32.8 round's self-review periphery, so this round gives that
periphery the same discipline the primary fixes got:
- The convention read's fence mask is now the CommonMark fence GRAMMAR, not
  a column-0-backtick spelling toggle: tilde fences, info strings, and
  up-to-3-space-indented fences all mask; a closer must match the opener's
  character at at least its length; an unclosed fence masks to end-of-file.
  Pre-fix, a tilde-fenced or 3-space-indented example bullet silently drove
  field matching credited to "the tenant conventions" (F-323).
- The never-listed `--partial` warning's landed-conditional is pinned both
  ways: an all-skipped or empty items file warns the state WITHOUT the
  "entries are in the manifest now" claim (F-324, coverage only), and the
  never-listed shape-guard remedy clause from F-317's self-review gets its
  committed check.
- The full-path/partial-path warning asymmetry on never-listed domains is
  ratified in a comment at the stamp write — a full upsert IS the
  registration mechanism, so "never listed" is every legitimate first
  registration's precondition there, not an anomaly (F-325).

## 0.32.8 — 2026-08-30

Gate-2 release-review fix round (bus F-316..F-322) — the staged 0.32.x
delta reviewed as a whole before release; six confirmed findings fixed at
their mechanisms:
- `upsert-batch --partial` on a NEVER-listed domain now proceeds (still
  writing no coverage stamp) with a warning naming the state and the
  typo/remove-verb exit, instead of refusing — the refusal broke
  email-report's template gap-fill and setup's list-invisible recovery on
  exactly the tenants those flows exist for (F-316, a 0.32.6 regression).
- The re-index guard and shape heuristic keep firing under `--partial`,
  but their remedy text is now partial-aware: re-run with the recorded
  field; a key-scheme change is a full-list operation — they no longer
  advise `--allow-rekey`, which `--partial` refuses (F-317). setup's
  recovery instructs the domain's RECORDED idField instead of hardcoding
  `id`.
- The field-aliasing convention read: "declared" now implies COMPILED — a
  whitespace-only inline-code value classifies malformed instead of
  rendering a self-contradictory report claiming active stripping while
  matching ran exact-only (F-318); and the section ends at the next
  level-1/level-2 heading, so a bullet under a later `# Appendix` is never
  read as the declaration (### subsections stay in-section; F-319 — the
  template documents the rule).
- `capture.mjs --wait` now gates on the deps readers' own acceptance rule:
  `parseLiveDepsAreas` moved to doc-lib with a `depsCaptureReadiness`
  predicate beside it, imported by capture — a COMPLETED payload the
  readers would reject keeps polling and times out non-zero instead of
  being written as success and skipped downstream; the timeout names the
  mismatch. A valid payload with no JOURNEY_ORCHESTRATOR area now reads as
  ZERO JO dependents (an answer) instead of "not recognizable — skipped"
  (F-320).
- An invalid explicit `--alias-prefix` refuses at flag parse again, before
  the (up to ~100 MB) index load (F-321).
- doc-drift check 16's failure text claims only what it enforces, and the
  token pre-flight family's ratified scoping is documented at the
  declaration (F-322).

## 0.32.7 — 2026-08-30

The `--partial` recording-flags refusal now names the offending flag(s) in
its failure message (bus F-314). The 0.32.6 guard was a four-way disjunction
whose test coverage pinned only two arms — a future edit dropping the
`--describe-command` or `--no-date-field` disjunct would have shipped with a
green suite. The guard now collects the passed recording flags as data and
fails naming exactly the ones present, so the operator sees which flag to
remove and each arm carries its own suite check asserting its own flag name
(the `--no-date-field` check runs against a domain recorded `--no-date-field`,
where the redate guard cannot mask a dropped arm). Behavior was already
correct for all four flags; this hardens regression detection and improves
the error text.

## 0.32.6 — 2026-08-30

`manifest.mjs upsert-batch` gains `--partial` — a deliberate-subset
declaration for gap-fill and targeted registrations (bus F-313). The
under-pagination warning assumed every incoming list is a full-inventory
snapshot, so email-report step 4c's gap-fill registrations (smaller than
the domain by construction) tripped it on every run, and the warning's
own text told the operator to take the wrong action (re-page a list that
is deliberately a subset). With `--partial`: the under-pagination warning
is skipped, and the domain's `domains_indexed` coverage stamp is left
untouched — a subset is not list-coverage evidence, so `at` keeps saying
when the domain was last actually listed. The declaration cannot degrade
the index: it refuses never-indexed domains (subset of nothing), the
recording flags (`--list-command`/`--describe-command`/`--date-field`/
`--no-date-field` — index-time facts), and `--allow-rekey` (the orphan
diff needs the full list). The undeclared warning now routes future call
sites to the flag, and the skipped-row + mass-stale warnings stay live
under `--partial`. Call sites updated: email-report step 4c (both
registrations), setup's list-invisible template recovery; refresh
explicitly must NOT pass it (its re-lists are full snapshots — the
warning is the point there). Summary JSON gains a `partial` field.

## 0.32.5 — 2026-08-27

Token pre-flight family promoted to the checking tier (GP-B5 W5/DS-31;
bus F-312, per the C1 one-canon direction). The F-221 pre-flight — a
token's USABLE life is far less than `whoami` prints, per the CLI's
half-life defect, so check before any long sequential batch — existed
as two full hand-synced prose copies (setup + refresh) that had already
diverged in wording, while the other two long-batch skills had no
pre-flight at all. Now: setup Phase 1 carries the one canonical
statement (absorbing refresh's stronger clauses); refresh, email-report
(sweep + gap-fill), and deps-report (`--wait` captures) each carry a
one-line paraphrase naming their own batch shape plus a pointer to the
canon. A new doc-drift check (check 16) holds the family with the site
list as data: the canon must keep the formula, paraphrase sites must
keep headline + pointer and never regrow a full copy, and no skill
outside the family may teach the pre-flight — five committed mutants
prove every arm goes red. Skill prose + CI check only; no script, hook,
or behavior-code changes.

## 0.32.4 — 2026-08-27

Email-report's two inline script transcriptions ship as real plugin
scripts (GP-B5 W5/DS-29): `scripts/er-count.mjs` (the step-2 page-entry
counter — largest array length in a captured list page, arrays measured
but never descended into) and `scripts/er-gaps.mjs` (the step-4a gap
work-list builder — TTL-stale/liveOnly/missing-template/ER-15-tokenless
lists written on disk in the exact shapes `manifest.mjs` consumes). The
skill used to fence ~90 lines of JS for the model to write to
`.gs-superadmin/tmp/` on every run, under a keep-in-sync warning tying
the transcription to the producer shapes in `jo-report.mjs` and
`manifest.mjs` — the weakest sync tier (A-2), now retired: the skill
invokes both helpers by `${CLAUDE_PLUGIN_ROOT}` path, the transcription
prose and the warning are deleted, and the shape contract lives once, in
`er-gaps.mjs`'s own header, at the consumer.

Both scripts get the standard treatment: direct fixture suites
(`test/er-count.mjs`, `test/er-gaps.mjs` — selection/ordering/keying
contracts plus failure honesty), MAINTAINERS.md Scripts-table rows
(check 12 enforces them), battery + CI wiring. Behavior is the
transcriptions' own, plus deliberate hardening at the CLI boundary:
BOM-tolerant reads via doc-lib's `readJsonFile`, and loud refusals
naming the script (F-306 convention) for a missing/unreadable payload
(er-count must never report a failed page as "0 entries" — that ends
the sweep early and reports a subset of PROCESSING programs as all of
them), an unreadable index/manifest, or a non-numeric TTL (er-gaps must
never emit a confidently empty work list).

## 0.32.3 — 2026-08-26

`tenant-deps.mjs --terms-file` (GP-B5 W5/DS-28; F-162 lineage): the
deps-report skill's terms now travel as an on-disk work list — a JSON
object `{ "objects"?: […], "fields"?: […], "connections"?: […] }` — instead
of repeated single-quoted argv flags, so multi-term requests (names
carrying `|`, spaces, or quotes) never touch shell quoting. The file is
read BOM-tolerantly (PS 5.1 Out-File writes one) and merges with any
inline flags; validation is loud (A-4): an empty or unparseable file, an
unknown key (e.g. the singular `connection` typo), or a non-string entry
refuses the whole file — a typo'd kind silently dropped would be a
confidently narrower report. Report re-run footers keep spelling the
effective terms inline (deliberate: the scratch file may be gone at
re-run time). The skill's ~12-line argv ordering/quoting spec is deleted.

Verdict-round fix, same wave (bus F-306): `tenant-deps.mjs` diagnostics —
the `--terms-file` refusals above, usage errors, `--help` — now name the
script the operator invoked. They used to borrow `jo-report.mjs`'s shared
`fail`, whose hardcoded prefix blamed a script the operator never ran (a
pre-existing latent defect this surface made visible). Both scripts now
draw the one `fail` implementation from doc-lib's `makeCliHelpers`, with
the script name a parameter — no hardcoded prefix literal survives to be
re-imported.

Second verdict round (bus F-310, pre-existing — reachable before this
wave): `tenant-deps.mjs` now REFUSES a `--kb` directory that does not
exist — exit 1, `--kb <dir>: directory not found`, nothing written. It
used to accept one and exit 0 with `ok: true`, `0/0` scanned in every
domain, and a written report asserting nothing depends on the terms, with
no caveat naming the cause — for an impact-analysis tool, a mistyped slug
was indistinguishable from a genuine no-dependents answer, and the report
still claimed "impact analysis never narrows silently". The gate is
jo-report deps mode's existing check, hoisted to doc-lib as the one
shared `requireKbDir` (single-owner rule) — both deps surfaces now run
the same copy, and the refusal names the script the operator invoked.

Same round (bus F-311, preventive): the `--live-deps` file-intake loop —
until now a hand-copied twin in each deps script, an undeclared
keep-in-sync pair of the same genus that produced F-310 — is one shared
`readLiveDepsCaptures` in jo-report-deps. The warn-and-skip contract
(unreadable/unrecognizable files warn and skip, a non-COMPLETED capture
warns loudly, an off-term object warns) now cannot drift between
surfaces; each caller keeps its own documented parser variant and term
compare as parameters. tenant-deps's suite gains the warning-arm
coverage that previously existed only on the sibling.

## 0.32.2 — 2026-08-26

The deps reports read the tenant's field-aliasing convention themselves
(GP-B5 W5/DS-27; bus F-304). `jo-report-deps.mjs` gains
`readAliasConvention` — the one parse of the workspace's
`.gs-superadmin/CONVENTIONS.md` `## Field aliasing` section (its
`- task-alias-prefix-regex:` bullet, one inline-code value; walk-up from
the KB dir, BOM/CRLF-tolerant) — and `resolveAliasPrefix`, the shared
resolution rule: an explicit `--alias-prefix` overrides; otherwise, with
field terms present, the declared convention. The guardrail that used to be
skill prose is script behavior now (A-4): a missing or unset declaration
runs exact-only with the no-convention caveat, a MALFORMED one (bare
value, uncompilable regex, ambiguous duplicate bullets) runs exact-only
with a loud warning + caveat naming why — a pattern is never inferred from
tenant data. Both skills' duplicated ~14-line parse specs are deleted
(one override line remains); report re-run footers stay argv-faithful (a
conventions-supplied pattern is re-read on re-run, never injected as a
flag).

Review round, same wave: an explicit `--alias-prefix ''` is the exact-only
**opt-out** (the first version let a blank explicit fall through to the
conventions read, leaving no flag value that could disable a declared
convention); the exact-only caveat now names the SPECIFIC unset reason —
"could not look" (no workspace, unreadable file) is never reported as
"looked and found nothing declared"; jo-report deps mode falls back to
the cwd for the workspace walk-up when no KB dir resolves; a near-grammar
declaration (`*` marker, indented bullet) is loudly MALFORMED instead of
silently unset; a malformed declared pattern's error names the pattern,
not the `--alias-prefix` flag; and the workspace walk-up is one shared
`findWorkspaceDir` export in doc-lib (it was about to become the F-232
walk's third hand copy).

Verdict-round fixes, same wave (bus F-305, F-307): the `## Field aliasing`
heading match anchors on the TITLE, not the whole line — real workspaces
(provisioned by earlier rounds of these skills) suffix the heading, and a
present section was reported as absent, silently dropping alias-matched
dependents. A heading-like line at the wrong level or spacing is now loudly
MALFORMED (the near-grammar arm the bullet already had), and an ambiguous
pair of title-matching headings refuses rather than guessing. And the
report's Summary `terms:` line now renders from the alias resolution result
— one owner for the reason — so a malformed declaration or an explicit
`--alias-prefix ''` opt-out is never summarized as "no field-aliasing
convention supplied".

Second verdict round, same wave (bus F-308, F-309): the Summary line's
ACTIVE arm now renders the pattern's provenance from the resolution
result too — an explicit `--alias-prefix` is credited to the flag, never
to "the tenant conventions" (which it was even when no conventions
section existed, and when it overrode a valid declaration — the same
false-provenance class F-307 closed for the inactive states; one shared
renderer, so both deps surfaces are fixed at once). And when several
headings match the `## Field aliasing` title, the bare-title tiebreak
stands (shape, not content — preferring a filled-in suffixed section
could activate a stale pattern from e.g. a history heading), but every
withheld outcome now DISCLOSES the skipped title-matching headings by
line number, so the reported reason describes the file rather than only
the section that won; the template documents the one-section rule.

## 0.32.1 — 2026-08-26

`capture.mjs --wait` (GP-B5 W5/DS-26): the capture helper now owns the poll
for the async dependency scan (`dm deps check`), which the deps-report and
email-report skills used to re-run by hand every ~15 s as conversation
turns. With `--wait`, the helper re-runs the command every
`--wait-interval` seconds (default 15, floor 1 — each attempt is a real
tenant request, so an unthrottled spin loop is unspellable) until the
captured JSON reports `data.progressStatus.overallStatus: COMPLETED` —
the `data` envelope is REQUIRED, exactly as the report readers require,
and the agreement is differential-locked in the suite (both
implementations driven over the same stub payloads) — up to
`--wait-timeout` seconds (default 120, honored in full: the last sleep is
clamped to the remaining budget). A stderr heartbeat names each retry.
Only a COMPLETED payload is ever written to `--out`; on timeout **nothing
is written** and the exit is non-zero, naming how long it waited and the
last status seen ("not ready after N s") — never a confident zero, and
with no claim about *why* the scan isn't COMPLETED (a terminal failure
status is the server's to name). A poll attempt that fails outright keeps
the single-shot failure contract (the child's exit code, nothing written).
The `--normalize` mode guard now rejects every stray capture-mode knob
(`--bin`, `--timeout-ms`, the wait knobs), not just `--out`/`--wait`.
Both skills' capture fences pass `--wait`, and their hand-poll
instructions shrink to the honesty rule.

## 0.32.0 — 2026-08-25

The shipped capture helper (GP-B5 W4/DS-17): bulk captures no longer depend
on what a shell's `>` happens to write.

**Scripts (new: capture.mjs).** `node scripts/capture.mjs --out <file> --
gs-admin <args…>` runs one read-only gs-admin command (argv array, no shell)
and writes its stdout to the file as UTF-8 **without a BOM** on every shell,
via temp+rename — a failed command propagates its exit code and writes
nothing, so a stale or truncated capture can never read as complete.
`--normalize <file>` re-encodes an existing capture in place, tolerant of
what Windows PowerShell 5.1 redirects actually write (UTF-16LE/BE with BOM,
BOM'd UTF-8); anything it cannot decode losslessly is refused with the file
untouched — console-codepage bytes, lone surrogates, UTF-16 with an odd
byte length (a capture truncated mid-code-unit; release-gate round — the
LE decode used to silently drop the trailing byte and rewrite the file
shorter at exit 0, and the BE path crashed raw), and BOM-less content
carrying NUL bytes, the shape a BOM-less UTF-16 capture takes (F-297: an
ASCII-payload UTF-16 file is byte-wise valid UTF-8, so it used to pass
through certified as clean while still failing a JSON parse). The argv
operator refusal now names the leading-operator-value case (an asset name
beginning `|` fed to `--search` is refused fail-closed, with the
guard-arbitrated direct run as the stated workaround). Because the
helper spawns the CLI itself (invisible to the
mutation guard), it gates every command fail-closed — unknown, mutating,
ask-override, non-capture-shaped, and write-endpoint commands are all
refused; run those directly, where the guard can arbitrate.

**Scripts (doc-lib).** The read-only command gate and the CLI-entry
resolution are hoisted out of describe-batch.mjs into shared exports
(`assertReadOnlyCommand`, `resolveCliArgv`) consumed by both spawn-capable
scripts — one gate, two callers, no hand-synced sibling copy (the F-284
class). describe-batch behavior is unchanged (its suite pins every refusal
message through the hoist). The T-7 portability header executes scheduled
amendment A2: the capture convention now reads "route through the shipped
capture helper; check 14 enforces routing".

**Skills (audit, change-request, deprecate, deps-report, email-report,
refresh, setup) + operating-model template.** Every capture site now routes
through the helper instead of a raw `gs-admin … > file` redirect, and the
per-skill restatements of the redirect-encoding rule shrink to a one-line
paraphrase pointing at the canonical statement in setup Phase 4 — the helper
carries the rule; the pagination, reconciliation, and async-completion
judgment caveats stay. `build/check-doc-drift.mjs` check 14 narrows
accordingly: any raw gs-admin redirect capture in a skill is now a failure
outright, and the set of helper-routing skills is pinned as data (routing is
recognized by the invocation grammar — `capture.mjs … --out … -- gs-admin` —
not the script's name). The read-lane allow-rules ask now says plainly that
helper captures, like the plugin's other `node` script runs, are not covered
by the gs-admin allow rules.

**Review round (same PR).** The helper's capture path is a byte copy (no
decode — a 40 MB capture no longer round-trips through a JS string), and
`--normalize` refuses lossy decodes with the file untouched instead of
silently rewriting undecodable bytes to U+FFFD. The capture read-shape gained
domain-candidates' summary prong (so `dm deps config`, a genuine setup
candidate, captures). The argv-hygiene check (first-token gs-admin + shell
operators, now the guard's superset list, with an unsubstituted-placeholder
hint) and the exact read-verb allowlist are shared doc-lib exports consumed
by both spawn-capable scripts.

## 0.31.9 — 2026-08-25

Journal hardening: one bad value can no longer cost the batch, the frame
rejects every line terminator, and the append verb fails loud (release-gate
review findings F-291 / F-292 / F-293).

**Hooks (guard).** A workspace-catalog command whose `domain` is empty (or
clamps to empty) journals under `unknown` instead of throwing at the frame —
and a frame-rejected entry now costs ONLY itself: the invocation's other
approved mutations still land, with one alert naming how many entries could
not be composed (before, the throw escaped the loop and the whole batch
vanished from the append-only record). The clamped area is also what reaches
the `- system-area:` field line, so an unclamped catalog value no longer
rides into the entry body.

**Scripts (journal-lib).** `composeJournalEntry` rejects every ECMAScript
LineTerminator in field lines — a lone CR is a line ending to CommonMark and
`/^## /m` alike, so it could forge an entry heading past the old `\n`-only
test — and strips control/format characters from field lines the way it
already does for the scalar slots: an unclamped caller value cannot land a
bidi override in the entry body.

**Scripts (journal).** `journal-append` validates `--system-area` AFTER the
printable clamp: a value with no printable ASCII now gets the script's
`fail()` one-liner instead of an uncaught frame stack trace (the operator
name gets the same clamp-to-empty fallback).

## 0.31.8 — 2026-08-24

Doc-only byte change in a shipped script (bump per the W0 decree — shipped
bytes changed, behavior did not). `doc-lib.mjs`'s sanctioned-duplicates
enumeration now names `build/lib.mjs`'s `readJsonFile` as the strip copy
every other build-lane reader imports — the dual-lane emitter
`build/extract-catalog.mjs` keeps its own tenet-locked copy — replacing the
two per-reader copies it retired (GP-B5 W3/DS-16, F-204). No plugin code
path changed; the dual-lane scripts the plugin ships (`extract-catalog.mjs`,
`render-cheatsheet.mjs`) remain standalone by contract and do not import the
new module. *(Amended 2026-08-25, F-295: the entry originally called
`build/lib.mjs` "the build lane's single sanctioned copy" — the exact claim
the DS-16 review round corrected in the shipped comment after this entry was
written; it now describes the final wording.)*

## 0.31.7 — 2026-08-17

Journal emitters clamp every slot by construction; the journal-kind prose
nickname is always taught beside its literal (GP-B5 W2 tester findings
F-288 / F-290).

**Scripts (journal-lib).** `composeJournalEntry` now `oneLine`-clamps ALL six
scalar slots — before, only `operator` and `kb-snapshot` were clamped, so the
four heading slots (`ts`, `area`, `ticket`, `kind`) relied on their callers'
field lists to stop a newline-bearing value from forging a second `##` entry
heading. `journalHeader` gets the same treatment for the tenant slug (the same
untrusted directory-name input): a newline or a bidi override can no longer
land in the shipped journal's first line. Legitimate values are byte-for-byte
unchanged (the T-4 conformance section still pins both real writers), non-ASCII
still survives (F-132), and a value consisting only of invisible characters now
fails loudly instead of landing a blank heading segment.

**Docs (change-request skill, journal script headers).** Everywhere the prose
calls the completion record a "plan-completion" entry, the emitter literal
`change-plan execution` now sits beside it — the unpaired nickname is what
produced the 0.31.6 contract defect, and a repo check now holds every site to
the pairing.

## 0.31.6 — 2026-08-16

Journal entry frame single-sourced; T-4 contract corrected from captured output
(GP-B5 wave W2, item DS-15 — safety-boundary change, journal path only).

**Scripts (journal-lib / journal) + guard hook.** The change journal's two
writers — the guard hook's PostToolUse journaling and `journal.mjs
journal-append` — hand-matched their entry FRAME (heading with the no-ticket
substitution, kind/operator opening bullets, kb-snapshot terminator, spacing);
it is now one `composeJournalEntry` emitter in `journal-lib.mjs` that both
writers call, with each writer keeping its own field content. Journal output is
byte-for-byte unchanged — a new conformance section executes both real writers
and pins every entry line, and it was landed BEFORE the hoist as the
differential lock. The T-4 header is amended to what the writers actually
emit (contract v4: `journal.mjs` entries carry `- kind: change-plan execution`
and their own field list — the old text carried a prose nickname). Guard
safety surfaces are untouched: the PreToolUse mutation gate is not modified,
no ask is removed or downgraded, and the missing-journal-lib degraded mode
(systemMessage alert, never a crashed hook) is unchanged and still pinned.

## 0.31.5 — 2026-08-16

Stub-marker single-sourcing: the `Metadata-only stub` marker becomes one exported
constant (GP-B5 wave W2, item DS-13).

**Scripts (doc-lib / manifest / jo-report).** The stub-doc marker that the manifest
`stub` verb writes and `jo-report`'s journey-doc parser detects was a hand-synced
string literal in two files; it is now `STUB_MARKER` / `STUB_MARKER_RE` exported
from `doc-lib.mjs`, consumed by both sites. Detection behavior and the marker text
are byte-for-byte unchanged (round-trip and literal back-compat fixtures pin both),
so existing KB stubs parse exactly as before. The T-3 header's stub-marker
paragraph now points at the constant (scheduled amendment A1). Review round:
the regex-literal escape expression, hand-copied in three report scripts, is
now one exported `escapeRe` in doc-lib (same behavior, suites green).

## 0.31.4 — 2026-08-16

Catalog contract v3: the bundled `extract-catalog.mjs` header now matches what the
emitter has always written (GP-B5 wave W1, session B2).

**Bundled extract-catalog only, comment-only.** Two corrections to the frozen T-1
typedef, found by executing the contract against the produced catalogs: endpoint
entries are documented with their `name` key (`"default"` when the manifest
supplies its singular `endpoint` field, the `endpoints`-map key otherwise — the
key was always written, and entry count is not the discriminator),
and `char` is documented as artifact-lane-only (present and null-valued on
artifact flags at the current pin; absent from runtime/static flags). No runtime
behavior differs and no catalog byte changes — the header describes reality more
precisely.

## 0.31.3 — 2026-08-16

Contract documentation: frozen typedef headers land in the shipped scripts (GP-B5
wave W0, item DS-12).

**Scripts (manifest / doc-lib / journal-lib) + guard hook + bundled extract-catalog.**
The cross-file data contracts that previously lived nowhere (or in scattered prose) are
now JSDoc typedef blocks at their producer/authority files: the `_manifest.json` shape
(`manifest.mjs`), the KB doc formats and read contract plus the IO-boundary portability
surface and argv conventions (`doc-lib.mjs`), the journal entry grammar and 6-way
outcome-basis union (`journal-lib.mjs`), the harness hook payload (`gs-admin-guard.mjs`,
comment-only — the hook still imports no local module statically; node: builtins
and its sanctioned lazy journal-lib load are unchanged), and the catalog shape +
dual-lane emitter contract (bundled `extract-catalog.mjs`). Comment-only change — no runtime
behavior differs; the headers are inert JSDoc, valid under a later `checkJs` gate.

## 0.31.2 — 2026-08-15

Scorecard truncation doctrine catches up with CLI 1.0.8 (audit-1.0.8 CP-9a; bus F-285).

**Skills (setup / refresh / audit) + operating-model template.** The four scorecard
list commands (`sc sch list`, `sc list`, `sc m list`, `sc mg list`) return a top-level
`_total` — the true pre-truncation count — since CLI 1.0.8. The truncation rules that
previously taught the `sc *` family as "no total anywhere in the payload — confirm
completeness by re-issuing with a larger limit" now reconcile captured rows against
`_total` (page or refetch until they match) on 1.0.8 and later, keeping the double-fetch
heuristic for older CLIs and for `sc` commands that still carry no total. Setup
additionally records any scorecard list that cannot be reconciled to its total in the
domain's KB file (`captured N of M` / `total unverified`) instead of presenting the
capture as complete, so downstream reports (`deps-report`, `audit`) stop quietly
under-counting. No script, hook, or behavior-code changes.

## 0.31.1 — 2026-08-15

Post-review hardening of the 0.31.0 catalog union (findings from the PR #89 code
review; bus F-276..F-284).

**Guard (catalog union).** Promotion now keys on whichever of `path`/`shortPath` a
workspace-catalog entry carries, so a hand-trimmed entry keeps its catalog-version
note and journal basis instead of silently dropping them. The mutation-ask
HEADLINE now uses the same key fallback: a workspace entry carrying only
`shortPath` names the command it asks about instead of rendering
`gs-admin undefined` (the ask itself always fired — this fixes what it says). The catalog-version note
is direction-aware: it distinguishes a workspace catalog that predates the bundled
one (remedy: upgrade the installed CLI if needed, then re-run setup) from one that
is NEWER than the bundle (the old wording claimed the newer catalog "predated" the
flag and prescribed a setup re-run that could never clear it), with a neutral
wording when the versions are unparseable. And the hook now probes the tiny
`reference/version.json` first: when the workspace catalog declares the same CLI
version as the bundle, the ~700 KB bundled-catalog parse is skipped on every hook
event — same-vintage labels make the union a no-op.

**Docs.** `templates/operating-model.md` no longer claims the MCP tool
`rules_engine_run_now` "carries the catalog's mutating hint" — the MCP protocol
carries no such hint at CLI 1.0.8; MCP-lane prompting comes entirely from the
`permissions.ask` entries setup merges into the workspace, and the doc now says
so, including that a plugin upgrade alone does not deliver the 39 new entries
(re-run `/gs-superadmin:setup`). The README's guard section re-anchors its
current-state claims to the pinned CLI version, and the generated cheatsheet
banner no longer asserts the override list's state (it names the mechanism and
the file instead).

**Tests.** The union×override interaction (promotion wins; an override's
`unlessArgPresent` exemption stops applying to a promoted command) and the
version-probe short-circuit are pinned by new fixtures; the stale-workspace union
assertion derives the bundled catalog version from the tree instead of hardcoding
it; and a shortPath-only entry is now exercised on the ask lane (previously every
synthetic entry carried both keys, which is how the headline defect stayed green).

## 0.31.0 — 2026-08-15

Adoption of gs-admin CLI 1.0.8 — the release where upstream fixed the catalog's
`mutating` mislabel class this plugin has guarded against since 1.0.4. Counts are
unchanged (188 commands / 182 MCP tools); what changes is who does the labeling.

**All 39 mislabeled writers now ask from the catalog itself.** Upstream flipped
`mutating: false → true` on the entire class — the `re r` authoring surface
(create/edit/add-action/edit-action/delete-action/set-source/add-criteria), the
scheduling and subscribe commands, `re r run-now`, and the `dd t` template edits.
The bundled catalog regenerated at 1.0.8 carries those flags, so the guard's plain
approval prompt now covers every one of them. Expect rule-authoring sessions to
prompt substantially more than before — that is the correct behavior (these commands
write), newly enforced by the catalog rather than documentation.

**The hand-maintained ask-override list is empty.** All eleven entries self-retired
(every overridden path is in the 1.0.8 flip set) and were deleted. The file, its
schema, and the guard's override mechanism remain — upstream can still mislabel a
future action, and the machinery that catches it costs nothing empty. The decision
record in `hooks/ask-overrides.json` now documents the closure and preserves the
history. One user-visible wording change: the former override commands now show the
plain "Mutating Gainsight command" prompt instead of the "Verified catalog mislabel"
paragraph.

**`re r run-now --test-run` now prompts.** The safe-mode exemption lived on the
override entry; with the entry retired, the catalog ask applies unconditionally.
An added ask, never a removed one.

**The guard now decides on the union of the workspace catalog and the bundled one.**
The workspace catalog (`.gs-superadmin/catalog.json`) is regenerated only when setup
is re-run, so after this upgrade a workspace could still carry pre-1.0.8 labels — and
with the override list empty, the once-mislabeled writers would have run silently
there (caught in tester verification before release). The workspace catalog remains
primary for command resolution, but a command it labels non-mutating now prompts
whenever the plugin's bundled catalog flags it mutating; the prompt names both
catalog versions and points at `/gs-superadmin:setup` to refresh, and the journal
records the union basis. Asks can only increase, in either version-skew direction —
and this holds for every future label fix, not just the 1.0.8 batch. Re-running
setup after a CLI upgrade is still recommended (it refreshes the whole KB toolchain),
but it is no longer safety-critical for the guard.

**`--folder-id` on `re r create/edit/list/list-and-describe` is an integer** in the
regenerated reference and catalog (upstream retyped it, matching live behavior).

**The "29 mislabeled writers / 59 with POSTs" doctrine is retired everywhere it was
taught.** The README's "Know the gate you're relying on" callout, the setup skill's
allow-rule consent prompt, the change-request skill's guard-coverage step, the
operating-model template, the cheatsheet's Mutating-column note, and describe-batch's
refusal message all now state the 1.0.8 position: the `mutating` flag is a written
upstream contract, the mislabel class is closed (0 strict cases; the ~20 residual
non-mutating POSTs are read-shaped fetches reviewed upstream), and what still carries
risk is the parsing boundary plus the possibility of a future mislabel — covered by the
fail-closed prompt on unknown commands and the kept override mechanism. The
operating-model's MCP-lane restriction on `rules_engine_run_now` ("run it through the
CLI, not MCP") is lifted: the tool carries the catalog's mutating hint at 1.0.8 —
CLI-lane writes are still preferred where change history matters, since MCP-lane
mutations are not journaled.

## 0.30.1 — 2026-08-13

Close-out of the OS-portability candidate bank (bus F-254..F-258): the four items
slotted to waves 3 and 4 that no wave took, plus one defect found while proving the
guards that lock them.

**Two more skills tell you what a PowerShell `>` does to a capture file.** `deprecate`
and `deps-report` both instruct a redirect of `--json` output to a file and then parse
it, but neither said that Windows PowerShell 5.1 writes UTF-16 (or BOM'd UTF-8) there —
the rule `audit`, `refresh`, `setup` and `email-report` have carried for releases. On
Windows the parse step failed, or (through the BOM-tolerant readers) quietly dropped a
report's "Live dependents" section. Both now state it at the capture, and a new
doc-drift check holds every capturing skill to it, so the next skill that gains a
capture cannot ship without the rule (bus F-257).

**The relationships fixture-refresh instruction is spelled for both shells.** The only
documented way to refresh the expected maps set `RELATIONSHIPS_EXPECTED_REFRESH` with a
bash-only inline prefix, which PowerShell fails on at runtime — the refresh simply did
not happen. Both the generator and the test now give the `$env:` spelling beside the
bash one (bus F-255).

Repo-side, not user-facing: the workflow docs' backslash line continuations are
collapsed (five were on mutating commands — bus F-256), the instance-data leak gate now
catches UNC, WSL and drive-less spellings of a local user path rather than only
drive-letter ones (bus F-254), and `check-doc-drift`'s failure gate moved below every
check, with a self-check that keeps it there — checks appended after it reported their
findings and still exited 0 (bus F-258).

## 0.30.0 — 2026-08-08

Pre-release hardening from the wave-5 code review (bus F-192, F-194..F-209),
the pre-release review round (bus F-224..F-243), the pre-release security
review (bus F-244, F-245), and the tester verdict round (bus F-249, F-251).

**The mutation guard now sees brace-glued PowerShell script blocks.** A
`gs-admin` invocation written with no space after an opening brace — the
idiomatic spelling in `1..3 | %{gs-admin jo p save}`, `if ($x){gs-admin …}`,
`foreach (…){gs-admin …}`, `&{gs-admin …}` — was invisible to the guard: the
brace was not a word boundary, so the hook exited before any scanner ran. A
mutating command written that way reached execution with no approval prompt, no
tenant/PRODUCTION warning, and no change-journal entry, while every *spaced*
form asked correctly. Braces are now boundaries in both the entry gate and the
tokenizers, and PowerShell's `&{…}` call operator is recognized as deliberate
syntax rather than drawing the quoting lint's coaching deny (bus F-244).

**`eval` no longer hides a mutation from the guard.** The nested-interpreter
re-scan added earlier in this release keys on an interpreter name followed by a
command-string flag, a shape that cannot express an interpreter which takes no
such flag — so `eval 'gs-admin jo p save'`, the common way a shell runs a
command it holds as a string, stayed silent on both the approval and journal
lanes. `eval` payloads are now re-scanned, and `dash`/`ksh` join the POSIX
family. The hook's own list of known, accepted residuals is now complete, so
the code states the same coverage boundary the review record does (bus F-245).

**PowerShell's `eval` is covered too.** The no-flag interpreter family added
earlier in this release shipped POSIX-only, so `Invoke-Expression` and its
`iex` alias — the same construct, on a hook that is registered for the
PowerShell matcher — went on hiding a mutation exactly as bare `eval` had:
`iex 'gs-admin jo p save'` reached execution with no approval prompt, no
tenant/PRODUCTION warning, and no change-journal entry. Both spellings are now
re-scanned, including the `IEX` case-fold and `Invoke-Expression -Command '…'`.
A read-only payload still passes silently (bus F-249).

**A PowerShell assignment no longer hides a mutation.** `$x=gs-admin jo p save`
runs the command, but `=` was not a word boundary, so the guard saw a single
token it did not recognize and stayed silent on both the approval and journal
lanes — while the spaced `$x = gs-admin …` asked correctly. The assignment
prefix is now stripped before matching, and `=` is a boundary for the *entry
gate only*: deliberately not for the tokenizer, because splitting on `=` would
push a `--flag=value` value into the subcommand words and could stop a mutating
command matching its catalog path — removing an ask rather than adding one
(bus F-250).

**Two long-accepted guard blind spots are closed rather than documented.** An
option sitting between a nested shell's command flag and its payload defeated
the re-scan entirely — `bash -c -x '…'` and `bash -c -- '…'` took the *option*
as the payload — and a positional PowerShell payload (`powershell "…"` with no
`-Command`) was never treated as a command string at all, though PowerShell
runs it as one. Both had been written down as accepted residuals rather than
fixed. The payload is now the first following token that is neither an operator
nor option-shaped, and PowerShell's positional first argument is re-scanned;
the positional rule is deliberately PowerShell-only, because a positional
argument to a POSIX shell is a script path, not a command string. What remains
uncovered is now stated in full in the README's "What the guard is, and is not"
(bus F-247).

**A zero-row candidate check can no longer earn a domain a ledger decision.**
The candidate gate's overlap check treated any payload it couldn't locate an
items array in as an empty list, so a typo'd `--items-path` or a captured error
body produced `rows: 0` with a confident `noneIndexed: true` at exit 0 — and
setup Phase 4 maps that flag straight to the ADOPT branch. The check now fails
by default when no items array is found (`--allow-empty` opts into answering,
exactly the `upsert-batch` contract), and however zero rows are reached the
decision flags are withheld with a loud warning: inspect the capture, then
decide from the payload itself (bus F-224).

**Prototype-member names can't corrupt the accounting.** The `__proto__` check
on domain names left the rest of the family through — a domain named
`constructor` or `toString` silently vanished from `report`'s per-domain counts
and `emptyDomains` while mutating a JavaScript global. The whole
prototype-member family is now rejected at the door (derived mechanically,
never hand-listed), and every accumulator fold is hardened independently so
pre-fix manifests still report correctly (bus F-225).

**Enum-gated list commands join the candidate universe.** Commands runnable
tenant-wide only through a small required enum flag (`--type MDA|SFDC|…`) were
silently dropped from the candidate set — never posed, and an exclusion
recorded against one sat inert. They now surface as candidates carrying a
`requiredEnumFlags` marker (run the list once per value to evaluate or adopt),
and a decision recorded against any path outside the candidate universe warns
INERT instead of sitting silent (bus F-226).

**A typo'd exclusion is diagnosed as a typo, not an upstream rename.** The
diff's warning for a decision key that doesn't resolve in the catalog names the
typo possibility first and suggests the nearest candidate by edit distance —
the old wording confidently misdiagnosed operator error as a CLI rename,
inviting a second phantom decision. The `exclude`/`block` path-shape ceiling
also rises from 5 words (exactly the catalog's current maximum — a future
6-word command would have been undecidable) to a bound only garbage can reach
(bus F-227, F-239).

**External Actions resolve on stub-crawled tenants.** The registry reader
understood only describe-shaped docs, so on a tenant whose
`rules-engine-external-actions` domain was stubbed by the shallow crawl, every
doc parsed to null and an External Action's name as a `--connection` term found
nothing — silently. Stub-shaped docs now parse, and a registry domain whose
docs all fail to parse surfaces a caveat instead of an empty registry with no
signal (bus F-228).

**Action-step rows are labeled by evidence.** A rule step whose `params` carry
a `connectionId` but no `configId` is a real rule→connection edge of unproven
kind — it now reports as `action-step connection reference` instead of wearing
the `external action callout` label; rows with a `configId` keep it. Callout
detail text is rendered from structured parts after name resolution, so an
External Action name containing `$`-patterns lands verbatim instead of being
expanded by the string-replace machinery (bus F-229, F-230). The report's
"read from N sites" coverage caveat is now derived from the same table the
fixture suite asserts against the parser (bus F-236).

**Long batches check token life before starting.** Refresh and setup now read
the remaining token life from `whoami` at their pre-flight step and state the
half-life arithmetic out loud (at CLI 1.0.7 a token stops working at half its
lifetime, so usable life ≈ remaining − 1800s — the number `whoami` prints is
not the number that matters), directing a `gs-admin login` before a batch that
would outlive it instead of failing wholesale mid-crawl (bus F-221).

**The candidate gate predicts runtime-required sublists.** The filter's
"no required flags" prong can only see flags the catalog declares required —
the CLI enforces some only at runtime, so per-asset sublists ("List execution
history for a rule") surfaced as ordinary candidates and cost a wasted run
each. Such candidates are now flagged `likelyPerAsset` (advisory — never a
silent drop, which could bury a real domain), the docs state the prong's
actual reach, and setup says what the flag predicts and how to record the
exclusion when the prediction holds (bus F-219).

**A row the upsert cannot key is now a warning, not a silent drop.** A real
tenant asset whose row lacks the domain's id field (live case: a connection
stuck in INIT that never finished initialising) used to vanish with
`"skipped": 1` buried in the summary and no warning — invisible to the count
guard, which only sees rows that survived id extraction. `upsert-batch` now
warns whenever rows are dropped, naming the count against the full incoming
list and sampling the dropped rows' names (or keys), with the honest posture
spelled out: inspect before accepting the drop (bus F-220).

**Impact analysis sees External Action callouts.** `deps-report` read a rule's
connection references only from per-field action mappings — but a rule that
calls an external system through an External Action records the action's
`configId` and its REST connection in the action's `params` block, which the
mapping walk never visits (those mappings reference only internal sources). So
"what breaks if I re-point this connection" answered a confident, wrong
"nothing" for exactly the rules that reach outside — live, rules calling an
external system read as zero. The rules lane now parses callout `params` (usage
`external action callout`), the `rules-engine-external-actions` KB domain is a
registry so an External Action can be named as a `--connection` term by name
or configId, the report gains an External actions section, and a caveat names
the three parsed reference sites so a zero can never again read as a tenant
fact about sites nobody scanned (bus F-217).

**A candidate that cannot be evaluated can now be recorded honestly.** Setup
Phase 4's gate had three states — indexed, excluded, undecided — so a candidate
whose list command fails server-side (a deterministic HTTP 500, say) left the
operator a choice between a forever-failing gate and a false permanent
exclusion. A new `manifest.mjs block` verb records the fourth state: "could not
look", with the observed error and an optional `--recheck-after` date. A block
satisfies `--require-decided` — Phase 4 can report — but unlike an exclusion it
never goes quiet: every diff surfaces the candidate by name with its reason,
the gate's pass message lists it on stderr, and a passed re-check date warns.
Excluding a blocked command lifts the block in the same write; blocking an
excluded command is refused (a block is not a decision and cannot overwrite
one) (bus F-218).

**Exclusion and block reasons have room to explain themselves.** The `--reason`
length cap was 300 characters, which turned out to sit inside the range real
reasons occupy: on the first live tenant ledger, well-written reasons ran
269-292 characters, and the two needing the most explanation — a judgment call
and a ten-group payload — were rejected by 2-3 characters, so the limit bit
hardest exactly where the nuance mattered. The cap is now 1000, well clear of
that range and still a hard bound (bus F-222).

**The domain-candidate overlap check refuses to answer over a partial reading.**
Setup Phase 4's candidate gate decides index-or-exclude from whether a candidate
list's rows are already indexed. When the id field resolved on only some rows —
a payload of mixed row shapes — the answer silently covered the resolvable rows
only, so a handful of already-indexed rows could read as "all indexed" and earn
the whole list a permanent exclusion, leaving the untested rows undocumented
forever. That case now fails as loudly as a field that resolves on no row at
all, naming how many rows went unresolved; `--allow-partial` opts into an answer
for lists whose rows genuinely carry no id, and withholds the two decision flags
when it does (bus F-216).

**The mutation guard sees mutating commands inside nested shells.** A mutating
gs-admin command wrapped in a quoted `bash -c '…'` / `powershell -Command "…"` /
`cmd /c` payload was completely invisible — no approval prompt AND no journal
entry (balanced quotes collapsed the payload to one token the matcher rejected).
The guard now re-scans quoted payloads behind a known interpreter + command flag
(recursively, depth 3; interpreter names get the same path/suffix/case
normalization as the binary word). Recognizing more spellings only ever ADDS
asks. Bash's backslash-newline line continuation is also swallowed like the
PowerShell backtick was, so a continued mutation draws the specific
mutating-command prompt and correct journal attribution instead of the vague
unrecognized-command ask. The guard header now names quote/escape-mangled
binary spellings as out of scope.

**Impact-analysis reports stop giving silently wrong answers in two corners.**
Case-colliding asset ids (docs stored with the `-dup` suffix) no longer come
back attributed to the WRONG asset with `resolved: true` — the reader verifies
the doc's own key bullet and reports an honest "doc on disk belongs to a
different id (case collision)" instead; real filesystem errors on the KB folder
are reported as errors, not as missing docs. NFD/NFC or padded spellings no
longer make a completed `--live-deps` capture read as missing coverage (false
caveat + false warning in the same report): every term compare/dedup now routes
through one shared fold (`termKey` in doc-lib).

**Scripts fail loudly instead of silently doing the wrong thing.** A valued flag
left bare at the end of a command line is refused by journal.mjs and
relationships-build.mjs (matching the other scripts) — previously a trailing
`--rules-domain` built relationship maps against the DEFAULT domain at exit 0.
Case-ambiguous tenant-slug resolution (two case-variant dirs on a
case-sensitive filesystem) is refused instead of readdir-order-dependent.
`manifest.mjs remove` dedupes its key list, ending the "removed AND missing"
phantom. describe-batch resolves the CLI lazily, so a bounded no-op
(`--limit 0`) exits 0 on every OS with no CLI installed — and a genuinely
missing install now fails loudly at first spawn on POSIX too, instead of dying
per-asset. Its ask-overrides read (and the repo's config readers) tolerate a
leading BOM.

Also: repo CI guards hardened (full-path sanctioned-copy lock, per-arm test
enumeration floors, binary-aware invisible-codepoint sweep with honest skip
accounting, recursive skill-references sweep, the instance-data gate now scans
itself), and new regression fixtures pin the `--preserve-symlinks-main` CLI
entry and stripBom's single-leading-BOM contract.

**Setup can no longer silently under-index a tenant (F-108).** Which list
commands could be KB domains used to be decided by model recall at first index —
a list nobody thought of stayed invisible forever, and a deliberate skip was
indistinguishable from an oversight. A new read-only script
(`scripts/domain-candidates.mjs`) derives the candidate set mechanically from
the workspace catalog (non-mutating, tenant-wide, list-shaped commands) and
diffs it against the manifest; setup's Phase 4 now gates its report on every
candidate being explicitly indexed or excluded, and refresh surfaces new
candidates by name after a CLI upgrade. Decisions are durable: exclusions
persist in a new manifest map, `domains_excluded` (`manifest.mjs exclude`
verb — command, reason, decidedAt), and each `domains_indexed` entry now also
records the `listCommand` that produced the domain (carry-forward like
`describeCommand`; legacy manifests backfill on their next refresh). Adoption
of a new domain runs a global overlap check — "are these rows already indexed
ANYWHERE" — so a filtered view of an already-indexed list (rows matching under
a *different* domain) is caught as subsumed instead of duplicated, and a
suggested non-colliding domain name ships with each candidate.
**Single-object rules are no longer called IRREVERSIBLE — the truth is worse in
a different way (F-104, live-verified on CLI 1.0.7).** `re r set-source-template`
against an existing Horizon rule converts it in place (same rule and dataset
config ids, `tasksType` SIMPLE → COMPLEX), so "cannot be changed later / must be
rebuilt from scratch" was false — but the conversion is LOSSY (the attached
template's task graph REPLACES the single-object extract; anything mapped to the
old source must be re-pointed) and NOT idempotent (a second attach APPENDS a
disconnected second graph, corrupting the dataset). The change-request plan
header's `Data-source mode:` literal is now `set-source (single-object —
conversion is LOSSY, justification required)`, the justification requirement
stays (the workspace standard still mandates Prepare Dataset), and the bundled
query-building standard keeps its always-Prepare-Dataset policy with the
rationale corrected to the verified facts.

**`re r set-source-template` now draws the guard's approval prompt (F-213).**
The catalog labels it non-mutating; the live run proved it a destructive tenant
write with no safe mode whose re-run is not a no-op. It joins
`hooks/ask-overrides.json` as the eleventh entry — the first from the authoring
surface, on exactly that re-run-corrupts ground (the rest of the authoring
surface stays documented-not-overridden; the README's write-surface callout now
names it explicitly).

**`rp update`'s destructive framing softened to the verified facts; report
edits stay manual-UI for a narrower reason (F-214, live-verified on CLI
1.0.7).** A name-only `rp update` preserved 25 of 27 top-level fields
byte-identical (only the name and its consumer-details mirror moved), so the
"omitted fields reset to defaults" failure mode is gone at this pin. Reports
stay on the audit/deprecate manual-UI lists because the report's FOLDER is
invisible to the CLI in both directions (the PUT drops the folder id;
`rp describe`/`rp list` expose no folder field), so a silent re-folder could
not be detected — that UI check is banked in dev validation.

## 0.29.0 — 2026-08-06

**One doc-filename collision rule for every doc writer (F-156).** Distinct asset ids
that collide as filenames on case-folding filesystems ("Company" vs "company") were
handled by two different conventions: the manifest stub verb appended `~` while the
doc writers appended `-dup`, each pass checking only its own run — so a stub pass
followed by a deep pass over a colliding pair could orphan a stub doc, and rerunning
batches could silently overwrite one id's doc with another's. All four writers
(manifest stub, describe-batch, program-doc, template-doc) now share doc-lib's
`docNameClaimer`: one `-dup` suffix rule keyed on the files **already on disk** as
well as the current run, so the first writer of a name keeps it across passes and
runs, an id's own doc is reused on rerun, and a colliding id is suffixed
deterministically whatever order the passes ran in. Stub filenames on collision
change from `name~.md` to `name-dup.md`.

Also: the email-report skill's staleness-triage snippet pins its sort to an explicit
`"en"` locale (F-141 — behavior-identical for its ASCII timestamps), and the repo's
CI guards widened (invisible-codepoint sweep beyond bare BOMs, a repo-wide
explicit-locale check, hardened test skip-guards) — no other user-facing behavior
change.

## 0.28.0 — 2026-08-04

OS-portability hardening, accumulated across the plan's pre-release waves. Wave 1:
guard case-fold hardening (hook + guard fixtures). Wave 2: a shared portability layer
in `scripts/doc-lib.mjs` with every script, both journal writers, and the hook's file
reads migrated onto it. No catalog changes.

**The mutation guard now matches the `gs-admin` binary word case-insensitively.** Windows
and macOS filesystems are case-insensitive, so `GS-Admin jo p save` (or `GS-ADMIN.CMD
…`) runs the real CLI — but the guard's binary-word compare and its cheap pre-parse gate
were both case-sensitive, so those spellings drew no approval prompt and left no journal
entry: a silent fail-open on the two OSes where the casing can differ. The whole binary
word now case-folds, unconditionally on every OS (a platform branch would fail open again
under WSL/container mounts and be untestable from one CI lane), and the launcher-suffix
set gains `.bat`. Catalog *subcommand* matching deliberately stays case-sensitive —
`gs-admin JO P SAVE` lands on the fail-closed unrecognized-command ask, pinned by a
fixture. On Linux the cost is one extra ask for a literal uppercase `GS-ADMIN` binary
(asks, never blocks).

**The pipe lint recognizes POSIX clipboard consumers.** `pbcopy` (macOS), `xclip`/`xsel`
(X11) and `wl-copy` (Wayland) join the built-in consumer list, whose clipboard coverage
was Windows-only (`clip`) — ending false first-offense denies when piping read-only
output to the clipboard on macOS/Linux. Additive, lint-acceptance only: no mutation ask
is removed or downgraded — on a mutating command piped to a listed consumer, the
first-offense lint deny (which masked the mutation prompt entirely) becomes the standard
approval prompt.

**Consumer names normalize through the same launcher-suffix rule as the binary matcher.**
The suffix rule previously lived as two hand-maintained copies that had drifted — the
consumer-side copy stripped only `.exe`, so `… | findstr.CMD x` drew a false deny on
Windows. One shared helper now serves both matchers.

**A UTF-8 BOM on the hook payload no longer silences the guard.** The payload parse had
no BOM strip: a leading BOM made it throw, and the surrounding fail-open catch exited
quietly, so one invisible byte disabled the guard — no prompt, no journal entry, no
diagnostic — for that call, and for every call wherever the transport BOM-prefixes each
payload. Windows toolchains emit a BOM routinely, so any wrapper that re-encoded the
payload en route was enough. The parse now tolerates exactly one leading BOM, as the
workspace `pipe-consumers.json` loader already did; anything weirder stays malformed
input and fails open as before. Stripping cannot produce a false prompt: the payload
parses to the same object either way.

**Wave 2 — one portability layer, every consumer migrated.** `scripts/doc-lib.mjs` now
owns each rule that exists because operating systems disagree, as named exported
helpers; the scripts import them instead of re-encoding the rule per file (six
hand-copies of the shell-quoting rule alone were consolidated). What changes for a
user:

- **Report scripts no longer no-op through junctions/symlinks.** `jo-report.mjs` and
  `tenant-deps.mjs` invoked via a linked path (marketplace installs, OneDrive
  junctions, macOS temp) used to exit 0 with no output and no report — read by a
  session as "tenant has no data". Their CLI-entry test now realpaths both sides,
  the same rule `render-cheatsheet.mjs` already applied.
- **CSVs open correctly in Excel on Windows.** `toCsv()` emits a UTF-8 BOM (Excel
  decodes BOM-less CSV as ANSI, so non-ASCII tenant names rendered as mojibake and
  were frozen into XLSX by the report skills), and the plugin's own rendered
  labels and placeholders in CSV-destined cells are pure ASCII now (cron labels,
  the unrecognized-timezone fallback, placeholders, snippet ellipses, day-range
  joiners). Direction arrows in the deps reports' free-text detail stay
  deliberately — the BOM decodes them correctly — and the report skills' workbook
  step now reads the BOM'd CSVs with a BOM-aware decode so sheet headers never
  carry an invisible prefix.
- **Emitted command hints tell PowerShell users what to do.** Re-run and re-fetch
  hints stay bash-quoted (the alternative silently corrupts in bash), and whenever a
  hint actually carries the bash apostrophe escape the report's caveats section says
  to run it through the Bash tool or swap the escape for doubled quotes in
  PowerShell.
- **Matching survives Unicode normalization and report order survives locales.**
  Search/deps term matching NFC-folds both sides (an NFD spelling — routine from
  macOS tooling — no longer produces a clean false "no hits"), all report sorts pin
  the `en` locale so output is diffable across machines, and text truncation never
  splits an emoji into U+FFFD.
- **Captured files with a UTF-8 BOM parse everywhere.** PowerShell redirects prepend
  one; the BOM-tolerant read now covers the enumerated JSON-file sites: `--live-deps`
  captures (previously the live section silently dropped out of the deps report),
  template/program payload files, manifests, workspace catalogs, and the hook's own
  file reads — where a BOM'd `_manifest.json` used to silently drop the tenant label
  and the PRODUCTION warning from approval prompts.
- **Tenant KBs behind junctions are seen.** The guard's tenant scan and journal
  attribution, and `journal.mjs` slug resolution, follow directory links instead of
  treating reparse points as non-directories; `journal.mjs` also folds the case of
  the `changes/` path segment (recording the canonical spelling) and preserves
  accented operator names in journal attribution instead of blanking them.
- **Windows file-lock windows don't abort batches.** The manifest and marker saves
  retry briefly on EPERM/EBUSY (AV/sync-client locks) before failing loudly.
- **`describe-batch` fails helpfully instead of opaquely.** A `--bin` pointing at a
  `.cmd`/`.bat`/`.ps1` shim is refused up front with the JS-entry hint (previously
  every asset was marked failed with an opaque `spawn EINVAL` at exit 0), and a
  recorded describe command spelled `GS-Admin.CMD …` now matches instead of
  hard-failing every batch run.
- **Doc filenames are legal and collision-safe on every OS.** `docBaseName` hash-
  suffixes Windows-reserved device names (`NUL`, `CON`, …, with or without an
  extension) and caps length at 80; per-run filename dedup is case-insensitive, so
  ids differing only by case get distinct files on Windows/macOS instead of silently
  overwriting.

**Post-merge review-gate hardening (rides this same staged version).** A
three-finder review gate over the merged wave-2 diff confirmed a batch of
follow-on defects in the layer above; the behavioral fixes land here:

- Emitted command hints single-quote backslash-bearing values — bash eats
  unquoted backslashes silently, so a Windows path in a re-run line used to
  collapse to a different, still-plausible path with no caveat.
- The pinned report comparators gained a code-unit tiebreaker (collation
  treats NUL/soft-hyphen as completely ignorable, so distinct composite sort
  keys could tie arbitrarily), and the tenant-deps scorecard sort is pairwise
  instead of NUL-joined.
- `--if-changed` skipped entries still register in the case-collision dedup,
  so a case-colliding id later in the same batch takes the duplicate suffix
  instead of overwriting the skipped entry's doc.
- The journal's non-ASCII-preserving clamp strips the entire Unicode format
  category — ALM, word joiner, soft hyphen, interlinear annotation and astral
  tag characters previously survived the hand-listed ranges into journal lines.
- The scripts' CLI-entry test realpaths both sides, closing a
  `--preserve-symlinks-main` lane where a junction invocation silently exited 0.
- `describe-batch --bin` also refuses the extensionless npm shim on Windows
  (direct spawn ENOENTs per asset — the same opaque-failure class as the
  `.cmd`/`.bat`/`.ps1` refusal).
- The NFC fold now covers every tenant-deps compare path (connection id/type
  compares, term prep, the live-deps object cross-check), not just the shared
  term matchers.
- `journal.mjs` fails loudly when `changes/` and a differently-cased sibling
  both exist as distinct directories, instead of silently recording the
  canonical directory's same-named file.

**Wave 3 — skills run on any shell (rides this same staged version).** The skill
surface no longer assumes bash:

- **`manifest.mjs mark` marks batches from a work list.** New `--keys-file
  <json-array-of-full-keys>` (mutually exclusive with `--key`; BOM-tolerant, same
  reader as `remove`'s) plus `--limit <N>` (first N keys in file order; 0 is valid
  and marks nothing, so a computed budget of zero needs no shell special-casing).
  All-or-nothing: one unknown key means zero writes — a work list that disagrees
  with the manifest fails loudly instead of shrinking the batch silently.
  `--fingerprint`/`--doc-path` are per-asset recordings and are refused in batch
  mode.
- **email-report's gap-fill loops are gone.** The two bash-only
  `head | while read` fences (unrunnable in Windows PowerShell 5.1, and inviting a
  50-id budget to be chained through model context) are each one shell-neutral
  `mark --keys-file … --limit <budget>` call; the gap helper writes the stale and
  token-backfill work lists as JSON arrays of full manifest keys.
- **Every skill warns about an unresolved plugin-root placeholder.** All 7 skills
  that fence `${CLAUDE_PLUGIN_ROOT}` commands carry a warning line before the first
  such fence, and the operating model the matching bullet (the skills carry the
  line themselves because setup runs before the workspace docs exist). The
  mechanism of record, corrected during the pre-release review gate: the plugin
  loader substitutes the plugin's absolute path into skill content before a
  session reads it, so fences normally arrive with a real path in ANY shell — but
  a literal placeholder that survives (a repo-tree read, a pasted snippet) is
  unset in bash and PowerShell tool shells alike, silently expands to empty, and
  breaks the script path; such a command must not be run as-is. The four
  trailing-backslash bash line continuations in setup/refresh fences are collapsed
  to single lines.
- **A flag left without its value is an error, not a shrug.** `manifest.mjs` and
  `describe-batch.mjs` read every value-taking flag through the same argv helper,
  which treated a flag in the LAST position — `--limit` with nothing after it — as
  if it had never been passed. That is exactly what a skill fence renders when a
  budget placeholder substitutes empty, and it made the budget silently stop
  bounding the run: `mark` marked the entire work list and exited 0 reporting the
  full count as success. Both scripts now reject a valueless flag.
- **Prose stops nudging Windows PowerShell 5.1 into parse errors.** The
  "`&&` chaining is never touched" lint descriptions (operating model + README) now
  note `&&` is bash/PowerShell 7+ syntax and 5.1 needs `;`, and the debug run-state
  sweep advice spells the cleanup for both shells (with the caveat corrected during
  the review gate: PowerShell resolves `~` in provider paths too — what fails is
  transliterating bash's `rm -rf`).

**Pre-release review gate (rides this same staged version).** Three finder agents
over the whole wave diff, every surviving finding verified against the tree
before fixing:

- **Batch work-list keys are validated with real membership checks.** A key like
  `__proto__` or `toString` — inherited from `Object.prototype`, never a real
  entry — used to pass `mark`'s all-or-nothing presence check, "mark" nothing,
  and exit 0 reporting success (assigning onto the prototype on the way);
  `remove` counted the same no-op as removed. Both verbs now test own-property
  membership, so a malformed work list fails loudly.
- **Duplicate work-list keys collapse before the budget cut**, so a repeated key
  can neither consume a `--limit` slot nor inflate the `marked` count.
- **`describe-batch --limit 0` is a bounded no-op** (nothing selected, exit 0),
  matching `mark`'s contract — the email-report gap-fill fences feed the same
  computed budget placeholder to both scripts, so a zero budget no longer needs
  the model to special-case one line of the pair.
- **A duplicated flag whose trailing repeat is bare is rejected** in both
  scripts (`--limit 1 --limit` used to silently ignore the bare repeat).
- **email-report's token-backfill work list is joined against the manifest**
  before it becomes a batch: template ids in the index are doc-derived, so one
  orphaned doc (rekey cleanup, list-invisible recovery) used to put an unknown
  key in the list and — under `mark`'s all-or-nothing contract — zero the whole
  ER-15 backfill on every run. Orphan docs are now excluded, counted in the 4a
  summary, and reported as a caveat instead.

## 0.27.0 — 2026-07-30

The CLI 1.0.7 adoption (audit change-plan items CP-1/CP-2/CP-3). Documentation and
bundled-reference only — no behavior changes anywhere.

**The bundled reference now describes 1.0.7.** `reference/catalog.json`, `cheatsheet.md`,
`ask-rules.json` and `version.json` were regenerated against the new pin. Nothing
structural moved: 1.0.7 is a metadata-only upstream release whose `dist/` is byte-identical
to its predecessor, verified by hash-comparing the two installed trees — 171 files each,
exactly two differing (the package version line and the README). The command surface is
unchanged at 188 CLI commands / 182 MCP tools / 10 domains, and every `mutating` flag,
endpoint and flag spelling is identical, so **no guard decision changes**. The upstream
change is the removal of the README's open-beta notice; nothing replaced it, so the
posture of pinning a version and diffing each release is unchanged.

**`hooks/ask-overrides.json` deliberately still records verification at the previous
version.** The live check behind the `re r run-now` override was performed there, and
1.0.7's identical `dist/` keeps it valid — but the field records where a live run
happened, so it does not move without a new live run.

**Documentation corrections found by the pre-release review.** `describe-batch.mjs`'s
comments and its refusal message cited an older pin for the same write-surface figures the
skills and README cite, so one plugin stated one fact two ways; they now agree.
`relationships-build.mjs`'s schema block restated the semantics basis inline instead of
citing the shared constant, so it silently fell behind — it now cites the constant, and the
duplication is gone. The change-request skill and operating-model template gained an
explicit unresolved caveat on the claim that a single-object rule must be rebuilt to gain a
joined dataset: the manifest describes attaching a Design Template to an existing Horizon
rule as a supported in-place conversion, and neither reading is live-verified yet.

## 0.26.0 — 2026-07-28

The CLI 1.0.6 adoption rider (audit change-plan items CP-3/CP-4/CP-5/CP-7 — the
doc-and-tooling follow-through to 0.25.0's catalog + guard release).

**`describe-batch` can index the new 1.0.6 read surface (CP-4).** The read-verb
allowlist admits `schedules`, `topics`, `events`, `s3-tasks` and `event-curl` (all pure
GET, catalog-non-mutating) — previously the fail-safe gate refused them, blocking
indexing of the new scheduling/Events-Framework reads. Write siblings stay refused: the
schedule/subscribe POSTs are caught by the ask-override gate, and fixtures pin both
directions.

**The "about 31" write-count is replaced by computed figures (CP-3).** Every site that
said "about 31 commands write while flagged non-mutating" now states a computable rule
and its figures at CLI 1.0.6: catalog `mutating: false` plus a declared PUT/DELETE/PATCH
endpoint = 29 commands; 59 counting POST endpoints (an upper bound — a few POSTs are
read-shaped fetches). Sites updated: the plugin README (write-surface callout and folder
layout), the setup skill's allow-rule consent prompt, the operating model, both
describe-batch comment blocks and its refusal message, and the repo's comparison guide.

**`_flatMappings` semantics re-verified at 1.0.6 (CP-5).** relationships-build's schema
note records the 1.0.6 mapper delta, verified against the package's own mapper source
and path-scoped at the pre-release review gate: on the `re r list-and-describe` path,
external-action (`callExternalAPI`) and task-id (`t1`-style) targets now arrive with a
blank `tgtObject` and drop out of the write index instead of minting bogus target
objects — the per-item `re r describe` path (where most KB docs come from) still emits
the old unfiltered form at 1.0.6, so docs from it index exactly as before; the
`_criteriaCount`/`_areaNames` row fields are gone upstream on both paths (never read
here). Fixtures cover both payload shapes. The setup skill's scorecard-semantics note
is statically re-verified — the scorecard domain's catalog entries are byte-identical
across the upgrade.

**Doc enrichment (CP-7).** The cheatsheet header warns that the Mutating column is the
catalog's own flag and a blank cell is not proof of safety (the ask-override list covers
the verified mislabels); the operating model documents the report-fetch `--limit` hard
cap of 2000 and the `requestSource: GS_ADMIN_CLI` attribution on ad-hoc `rp run`
fetches, visible tenant-side in `gs_asset_usage`; the README's `rp update` caveat — and the deprecate/audit skills'
Reports notes — are reworded for 1.0.6's now-optional `--object`/`--show-fields` and
the handler's fetch-then-merge shape (a static source read: a naive rename one-liner
now executes instead of failing on required flags; still treat the command as capable
of overwriting definition state until live-verified).

## 0.25.0 — 2026-07-28

The documented CLI moves 1.0.4 → 1.0.6 (the "scheduling release": 15 new commands, no
removals, no renames — 188 CLI commands / 182 MCP tools across the same 10 domains), and
the mutation guard's ask surface is extended to cover the new writers in the same
release, so none of them lands in the guard's silent zone.

**Nine new ask-override entries (`hooks/ask-overrides.json`) — ten total.** Every one of
the 15 new 1.0.6 commands ships catalog-`mutating:false`, including seven that write: the
six schedule/subscribe POSTs (`re r`/`re c` `schedule-basic`, `schedule-event`,
`schedule-s3`) and `re c delete-schedule` (two DELETE calls). All seven now force the
guard's approval prompt, verified against the 1.0.6 manifests' own endpoints. The
pre-release review gate added two more (F-088): `re r schedule` — it POSTs the identical
endpoint as `schedule-basic`, and ask-or-silent must not depend on which synonymous
spelling an agent picks — and `re r delete-schedule`, whose endpoint set grew at 1.0.6 to
the same two DELETEs as its chains sibling (existing workspaces: re-run
`/gs-superadmin:setup` so the workspace copy of `ask-overrides.json` that the
change-request skill reads for planning catches up; the guard itself always uses the
plugin's own copy and needs no refresh). The run-now entry is live-verified on 1.0.6: the
banked PV-3 check ran against a sandbox tenant — bare run-now executed a rule live and
journaled with the override wording, `--test-run` journaled nothing — so its
`verifiedOnCli` moved 1.0.4 → 1.0.6 in the same release. Deliberate non-entries, recorded
in the file: `re r test-schedule` (validation-only POST), `rp run-saved` (read-shaped
fetch POST), the wider pre-1.0.6 documented write class (0.23.x-era decision), and a
general write-endpoint guard rule (considered, deferred as its own design item;
blast-radius recounted per F-084/F-088: 27 newly flipped of 29 strict, two already
overridden). New fixture coverage pins all of it (`test/guard-fixtures.mjs`).

**Also in 1.0.6, affecting existing commands** (no plugin change needed, worth knowing):
`rp run` no longer POSTs a report-create call (its create endpoint was removed upstream;
fetch-data moved paths), and `re r delete-schedule` gained the event-unsubscribe DELETE
described above.

**Override prompt rendering fixed (F-085, F-087, F-089).** Entries without a safe-mode
flag no longer render a doubled sentence-ending period (the guard appends "." only when
the clamped reason lacks terminal punctuation); reason strings are pure ASCII so the
printable clamp no longer swallows their separators; a chained call hitting the same
override twice renders one mislabel paragraph instead of duplicates (the journal still
records every invocation); and a malformed `unlessArgPresent` — which never exempts — is
no longer advertised in the prompt as an escape hatch. The `describe-batch` refusal
message clamp was widened so override reasons render whole. Cosmetic-to-minor, but it is
a security prompt; regression fixtures added for each.

**Bundled reference regenerated at 1.0.6.** `reference/catalog.json`, `cheatsheet.md`,
`ask-rules.json` and `version.json` now describe 1.0.6, including the new scheduling
surface, `rp run-saved`, and the `re r describe`/`dd t describe` drilldown flags.

**Version prose refreshed.** Skills, templates and README no longer cite 1.0.4 as
current; live observations made on 1.0.4 are now dated as such (the known-issues list is
unchanged — the 1.0.6 audit found no upstream fixes to any logged issue). The
change-request skill and README write-surface callout name the new override entries.

## 0.24.0 — 2026-07-26

Setup now builds your workspace reference from **your** CLI, not the plugin's snapshot
(the going-public plan's GP-1/GP-2). One behavior change, one new shipped script; the
mutation guard itself is untouched.

**The workspace catalog is generated, not copied (GP-1).** `/gs-superadmin:setup` now
always runs the bundled `scripts/extract-catalog.mjs` against your installed CLI's own
manifests to write `.gs-superadmin/catalog.json`, so the catalog — and the mutation
guard, which prefers the workspace catalog — always matches the CLI version you actually
have. Previously the bundled snapshot was copied first and regeneration only fired on a
detected version drift. The bundled `reference/catalog.json` is now the fallback, used
only when generation fails (setup tells you when that happens and how to fix it). The
guard's catalog resolution order is unchanged: workspace copy first, bundled second,
no catalog → normal permission flow.

**The cheatsheet is rendered from your workspace catalog (GP-2).** A new shipped script,
`scripts/render-cheatsheet.mjs`, renders `.gs-superadmin/cheatsheet.md` from the
generated workspace catalog — it is the exact emitter the docs repo uses to produce the
bundled `reference/cheatsheet.md` (imported by the repo build, shipped verbatim into the
plugin), so the two can never drift; only the banner/footer naming the regeneration path
differ. Your cheatsheet therefore describes your CLI version instead of the plugin's
bundled one, closing the gap where setup had to warn that the cheatsheet might lag the
catalog. `ask-rules.json` and `version.json` still ship at the plugin's bundled CLI
version, and setup now says exactly that — with the guard's fail-closed ask covering
commands newer than the bundle.

## 0.23.5 — 2026-07-26

Documentation only — no skill, hook, or template behavior changes, so nothing about what
the plugin does or what it asks you to approve is different in this release.

**Guard-scope accuracy in the comparison guide.** `reference/comparison-guide.md` claimed
that with the plugin "every write" is gated behind an approval prompt and that "writes
always ask first" — the same claim that was removed from this plugin's README in 0.23.3
(F-019) because it is not true: the guard follows the catalog's `mutating` flag, and at CLI
1.0.4 about 31 commands write to the tenant while flagged non-mutating. The guide now
scopes every guard, journal, and audit-trail claim to what the guard actually prompts on,
names the exception with its version, and points at the README section that lists the
affected commands. Its prompt-injection example, which had used a rule deletion — a command
the catalog does not flag as mutating — now uses a command that genuinely prompts, and says
plainly which deletions do not. The typed-tool-surface security argument is now split
between MCP mode, where it holds, and the shell path the plugin actually uses, where the
constraint is the AI host's permission model instead. The "using both together" section no
longer describes the plugin as an MCP server.

**New community files** (repo-level, not shipped in the plugin): issue templates, a Code of
Conduct, an unaffiliated-community-project disclaimer, and install instructions that tell
you to enable marketplace auto-update — which is how any of these fixes reach you.

## 0.23.4 — 2026-07-25

The sweep's deferred LOW batch plus one MEDIUM from the post-release tester pass
(F-051). Three guard refinements and a set of doc/skill accuracy fixes; nothing changes
what the plugin can do or what is asked — the changes are in what the journal and the
guard's messages assert, and in instructions that previously described behavior the
code does not have.

**The change journal no longer records inert text as an applied change (F-051).** A
`gs-admin` word standing as an *argument* to another command — `echo gs-admin jo p save
> notes.txt`, `which gs-admin`, a command line written into a plan file — was journaled
in exactly the same shape as a genuine mutation. The guard now tells command position
from operand position (first word of a command segment vs anything else) and stamps
operand-position findings with a verify-before-trusting note on both the approval
prompt and the journal entry, the same treatment quote-blind findings got in 0.23.3.
Real invocations, including all the glued-separator and `$(…)` spellings, stay unnoted.

**Journal outcomes stop misreporting failures as success (F-039).** A harness reporting
failure through `PostToolUse` with a string exit code (`"1"`) or an `is_error: true`
flag journaled as `completed`. Both shapes are now recognized; an exit-0-plus-error-flag
conflict is journaled as unverified rather than clean.

**PowerShell line continuation parses as the command it is (F-049).** A backtick before
a newline is line continuation, not substitution; it was routed to the
substituted-subcommand path, so the deny message and journal showed `` `…` `` in place
of the real words. Continuation-spelled reads now pass silently, continuation-spelled
mutations ask with the real command named, and glued backtick substitutions still reach
the coaching path.

**Skill/doc accuracy (F-030, F-031, F-032, F-034, F-040, F-041).** `deprecate --domain
data-designer` now says where its Current values come from (user-supplied UI values —
designs have no describe surface) instead of dead-ending, and its example schedule row
matches what step 2 actually captures; setup's one positional-argument instruction is
corrected to `--id <id>` (no gs-admin command takes positionals); the KB doc-naming
prose defers to the manifest's recorded `doc_path` instead of restating (incorrectly)
the scripts' sanitization rule, and `audit` reads `doc_path` rather than composing
`<id>.md`; the deps-report/email-report capture-numbering text no longer claims flag
order is what pairs captures to objects (the scripts pair by payload `objectName`);
change-request's mid-plan-failure path now explicitly routes into step 6's bookkeeping
with `--outcome partial` instead of ending with no stale marks and no journal entry;
plus the six batched F-041 nits (refresh's recency-filter list completed, the
no-paging-flags list-command branch added to setup/refresh/operating-model, the
`mcpServer` key name corrected, the change-request test fixture's rule-doc excerpt
reshaped to the real `data.ruleDetails`/`ruleName` envelope, email-report's budget
placeholders disambiguated, and its final-report status line's alternation properly
bracketed). Also: the F-046 gate fixture now uses `jo dd get`'s real `--name` flag, and
the operating model attributes PowerShell redirect encodings to shell configuration
rather than versions.

**Pre-release review pass (F-052).** The release review caught defects in this
release's own fixes before the cut. The operand-position detector computed position
from the previous token alone, so a real invocation on line 2+ of a multi-line command
— the most common multi-command shape — was stamped "may be inert" on the prompt and
journal of a genuine mutation; position now comes from tokenizer-tracked segment
starts, plus command-introducing shell keywords (`do`, `then`, `if`, `{`, …). The
line-continuation rule was narrowed to backtick-before-**newline** only: dropping any
whitespace-followed backtick had silenced a space-padded substituted subcommand whose
literal text matched a known read (a lost coaching deny — the one direction the guard
must never move) and stripped command position from space-padded substitutions.
Doc corrections in the same pass: refresh no longer calls `cn chains`/`cn jobs`
`--from`/`--to` modified-date filters (they filter by created date and last-run date —
only `cn list` is modified-date) and states the date substitution; setup's manual
describe step defers to the recorded `describeCommand` and names the domains that
address by `--name`; deprecate's plan table gains the null-`nextScheduledRun` render
rule and scopes the folder-existence check to rules; audit's `doc_path` preference
handles metadata-era entries with no recorded path; deps-report drops a leftover claim
that `--live-deps` order pairs captures to objects.

## 0.23.3 — 2026-07-25

The rest of the post-0.23.1 security & correctness sweep: the open findings the sweep
logged (F-014..F-028 plus F-035..F-038), the round-2 fixes from the live tester pass
that verified them (F-029, F-033, F-042..F-045), and three fixes from the pre-release
review of this diff (F-046..F-048). Nothing here changes what the plugin can do — it
changes what it claims, what it checks, and what it writes down.

**`audit` now audits the whole domain, not page one.** `audit` was the one list-issuing
skill with no pagination rule: `re r list` truncates at 20 rows and `rp list` at 25, so on
a real tenant it checked the first page and reported the count as domain coverage (F-014,
HIGH). It now pages to exhaustion with the same short-page-plus-total reconciliation the
other skills use, and the final report states whether pagination was exhausted. Alongside
that: the rules list-payload keys are stated (`data.data[]`, `ruleId`/`ruleName` — reading
`id`/`name` yielded `undefined` for every row, F-015); the deprecation prefix is matched as
a digits **pattern** rather than the literal placeholder text, so an already-deprecated
asset can no longer be renamed in a way that destroys its retention date (F-016); and
convention coverage is decided per domain, so `--domain scorecards` is skipped with a note
instead of being audited against a rules-only naming syntax (F-017).

**"Catalog non-mutating" no longer reads as "safe".** At 1.0.4 about 31 commands write to
the tenant while the catalog flags them non-mutating — most of the `re r` authoring and
scheduling surface, plus `dd t` template edits. Several docs promised a gate that does not
exist for those commands. The setup consent prompt now states the real trade before you
grant the allow rules (F-018); the README says "catalog-mutating commands ask" and gives
the real scope of the exception instead of "writes always ask" (F-019); and
`change-request` derives its plan's guard-coverage section from the catalog **and** the
ask-override list, which setup now copies into the workspace (F-021).

**`describe-batch.mjs` really is read-only now.** Its gate was `if (matched.mutating)`,
which those 31 commands pass — and this lane is invisible to the guard by design, so the
gate was the only control. It now also refuses anything on the ask-override list (without
honoring the override's safe-mode exemption), requires a describe-shaped read verb, and
refuses any command declaring a PUT/DELETE/PATCH endpoint (F-020).

**Guard hardening.**
- Secrets typed on a `gs-admin` command line were journaled in cleartext, twice per entry.
  Secret-bearing flag values are now redacted in both journal fields (F-024). The four
  OAuth flags the catalog advertised on `config` — which 1.0.4 does not accept, and which
  are what let a model construct such a command — are gone (F-035).
- The escalated shell-safety prompt used to **replace** the mutation prompt, so approving
  a repeat offense on a mutating command showed only quoting advice: no command name, no
  tenant, no production warning. It now carries both (F-026).
- Two prompt interpolations skipped the printable-ASCII clamp, so untrusted text could put
  raw newlines into an approval prompt and push it past 5,000 characters. Both are clamped
  and capped (F-025).
- A workspace `catalog.json` containing literally `null`, `0` or `false` parsed fine, then
  tripped a falsy check — the bundled catalog fallback was skipped and the guard went
  silent. A falsy parse is now treated as a parse failure (F-036).
- Pipe-lint tuning: PowerShell's `| %{ … }` / `| ?{ … }` and several standard consumers
  (`Export-Csv`, `Get-Content`, `Write-Host`, `clip`, `yq`, `base64`, `perl`, …) no longer
  trigger a false denial (F-037), and bash's `|&` is linted rather than treated as
  deliberate syntax (F-038).

**Other fixes.** Setup's Phase 5 exit gate no longer blocks Phase 6 on permanently
`failed` entries, which meant `<slug>/relationships/` was never built through any
documented flow (F-022). `templates/CONVENTIONS.md` gained the `## Field aliasing` section
both report skills read but no shipped template provided (F-023). `email-report`'s page-stop
rule now reconciles against the payload total like its siblings (F-027).

**Round-2 fixes from the live tester pass.** The deprecation prefix is now recognized
with a two- **or** four-digit year on read — on the verification tenant 23 of 41 really-
deprecated rules used the two-digit form the documented `D.MM.DD.YYYY` pattern missed,
in both the audit exemption and deprecate's already-deprecated guard, risking the same
irreversible retention-date loss (F-042). The scorecard list family returns no
pagination metadata at all and `sc m list` silently truncates at a server default of 20;
setup, refresh and audit now state the only safe fetch practice — large explicit
`--limit`, confirmed by a larger re-issue returning the same count (F-043).
Capture-then-parse recipes survive Windows PowerShell: strip a leading BOM before
`JSON.parse`, and write processing steps to a scratch `.mjs` file instead of a `node -e`
one-liner (F-044). The audit reports-domain instruction conflict introduced by the
F-017 fix is resolved: a convention that explicitly exempts a domain counts as not
governing it, and the domain is skipped with a note (F-045). Deprecate's
schedule-survival check treats the `--search` fallback as the primary path — live,
`nextScheduledRun` was null on all 67 SCHEDULE-type rules including 32 active, because
it means "a run is pending", not "a schedule exists" — and the fallback now pages and
requires `ruleId` equality (F-029). Deprecate's shape block gains the live-verified
`rp list` / `rp describe` shapes (`reportId`/`reportName`/`reportDescription`), so the
report path no longer probes an "undocumented" envelope (F-033). One template-doc
internal: the survey-token read in `doc-lib.mjs` is pinned to the live-verified
`tokenMappings.<store>.<tokenKey>.surveyToken` nesting instead of walking any depth —
output is identical on the verified shape.

**Pre-release review fixes.** The rebuilt describe-batch gate was refusing four
legitimate catalog reads — `jo dd get` and `jo s get` (pure-GET per-item describes for
two setup-indexed domains) and the two `list-and-describe` combos; the verb allowlist
now admits all 17 read actions, with the write-endpoint check still backstopping
(F-046). Findings only the guard's quote-blind re-scan produced (a mutation-shaped
string inside a heredoc body or quoted prose) were journaled as applied changes and
prompted as fact — both surfaces now carry an explicit unverified caveat, while
first-pass findings are unchanged (F-047). And a secret-bearing flag placed **before**
the subcommand — the documented global-flag position — escaped redaction and downgraded
the command to the unknown branch; the value is now consumed and redacted wherever the
flag stands, and the unknown-branch texts are redacted as defense in depth (F-048).

**Package-name spelling.** `npx @gainsight/gs-admin-cli …` runs the same CLI under a name
the guard does not parse. Setup now merges `Bash(npx @gainsight/gs-admin-cli*)` and
`PowerShell(npx @gainsight/gs-admin-cli*)` **deny** rules, so the model is redirected to
the `gs-admin` spelling the guard can arbitrate rather than reaching a tenant-blind generic
prompt (F-028). The hook header, the README and the operating-model template now state the
contract plainly: the guard is a risk-reduction layer at the command-parsing level, not a
guarantee.

## 0.23.2 — 2026-07-24

Fix a **mutation-guard bypass** (F-012, found by the post-0.23.1 security sweep). A
`gs-admin` invocation with a shell metacharacter glued directly to it — no separating
space — was never scanned, so a mutating command produced **neither an approval prompt
nor a journal entry**. Affected spellings included `echo done;gs-admin jo p save`,
`out=$(gs-admin jo p save)`, `(gs-admin jo p save)`, and the `|`, `&`, `&&` and backtick
forms; all are ordinary in both bash and PowerShell, and command substitution is a
natural thing for a model to write. The gate regex already accepted those separators —
only the word splitter disagreed, so the guard passed the command through and then went
blind.

- `shellWords` now emits `;` `|` `&` `(` `)` and backticks as their own tokens even when
  glued to a word, so the invocation is found and matched against the catalog as usual.
- The mirror case is fixed too: a *trailing* glued operator (`gs-admin jo p save; echo x`)
  left `save;` unmatched, which downgraded a known mutation to the vaguer "Unrecognized
  command" prompt and journaled it under system-area `unknown`. It now names the command
  and maps the area correctly.
- An unbalanced quote (bash `\"`, PowerShell backtick-`"`, or just an apostrophe in a `#`
  comment) used to swallow the rest of the command — including a following mutation —
  into one token. The command is now re-scanned quote-blind and the findings are
  **unioned**, so the mutation is caught while read-only commands with a stray apostrophe
  still pass silently.
- A command substitution standing where the *subcommand* belongs (`gs-admin \`echo jo\` p
  save`) still reaches the variable-subcommand coaching path rather than falling silent.

All three are ask-only changes: the guard still never blocks a mutation, and it still only
ever adds prompts (design tenets 1 and 3). 16 regression fixtures added to
`test/guard-fixtures.mjs`.

## 0.23.1 — 2026-07-22

Fix **`/gs-superadmin:deprecate` step 2 asset resolution** (F-005): the old flow dumped
a single unfiltered `re r list` page (~20 rows) and filtered it locally, so on a
full-size tenant the target rule was usually missing — a verbatim run reported "no
match" for a rule that exists, or risked matching a same-page lookalike.

- Resolution is now KB-first: one grep of `<slug>/_manifest.json` `inventory{}`
  (keys `<domain>/<id>`, entries carry `name`) yields the exact id, confirmed live
  with `re r describe --id`.
- Live fallback uses the server-side name filter that was there all along —
  `re r list --search '<name>'` (the flag is `--search`, not `--name`) — with
  pagination notes; reports paginate `rp list` to exhaustion; Data Designer
  designs aren't indexable at all (the `data-designer/` inventory holds Design
  Templates, a different asset) — the skill asks for the design id.
- Post-review hardening: an id argument short-circuits straight to
  `re r describe --id` (name matching is skipped); the shell-quoting rule moved
  to the top of step 2 and now also requires fixed-string (non-regex) matching;
  step 6's stale-mark is scoped to rules/reports; an asset whose live name
  already carries the rename prefix is reported as already deprecated instead
  of getting a second prefix; and the schedule-removal gate cross-checks
  `re r list --filter-execution-type SCHEDULE` when `nextScheduledRun` is null
  (paused/expired schedules survive with no next fire time).
- Step 2 now documents the actual `--json` shapes (`data.data[]` with
  `ruleId`/`ruleName`; `data.ruleDetails` with numeric `folderId` and
  `nextScheduledRun`) so sessions stop burning probe calls, and step 4's
  `delete-schedule` is gated on the captured `nextScheduledRun`.
- Tester-verified follow-ups from live runs (F-006–F-008): the describe shape
  names `ruleName` — there is no `name` key on `data.ruleDetails`, so the
  already-deprecated guard had been reading an undefined field; the manifest
  grep is documented as `grep -F -B2` (the manifest is pretty-printed — the
  `"<domain>/<id>":` key sits exactly 2 lines above `"name"`); and the
  description template appends ` — <old description>` only when the old
  description is non-empty, so undocumented assets get `Deactivated <ticket>`
  with no dangling separator.
- Pre-release review pass: reports now get their own describe (`rp describe --id`)
  so the plan table and already-deprecated check have real inputs;
  the already-deprecated guard runs on describe's live name (rules: `ruleName`),
  after the describe, and matches a date-shaped instance of the rename prefix
  rather than the literal `D.MM.DD.YYYY` placeholder; substring-match caveat on
  the manifest grep and `--search` (exact-name confirmation required); Bash-tool
  note for grep; step 6's KB-mark is skipped for live-search-resolved assets.
- **Report deprecation edits are now UI-only** (F-009, caught in pre-release
  retest): the old Reports step documented a bare
  `rp update --new-name --description` one-liner, but `rp update` is a
  full-definition PUT — `--object`/`--show-fields` are required and every
  omitted flag resets its field to a default — so the documented command failed
  outright and its obvious repair would silently reshape the report (display
  type, page size, filters, drill-downs). Rename/description/folder/private all
  moved to the manual UI checklist; `rp describe` stays as the read-only capture
  path. Also (F-010): the exact-name match now accepts a candidate that matches
  after stripping a date-shaped `D.MM.DD.YYYY ` prefix, so a live-search-only
  already-deprecated asset resolves to the guard instead of "no match".
- The same `rp update` one-liner survived in `audit` step 6 (F-011) — its
  Reports row is likewise manual-UI now, its guard warning distinguishes
  `re r edit` (catalog-non-mutating, no prompt) from `sc update`
  (catalog-mutating, prompts; a safe targeted edit), and the plugin README's
  "non-mutating edit commands" list was corrected — it had wrongly included
  `rp update` and `sc update`, both of which the catalog marks mutating.

Skill-doc only — no script, hook, or contract changes.

## 0.23.0 — 2026-07-17

Phase 6 concludes (S9): **participant-source provenance in `email-report deps`**
(ER-20) — every deps report now says where each matched program's participant source
gets its data, resolved at REPORT time from the C1 v2 pointers 0.22.0 started
persisting (`participantSourceCollectionId` / `participantSourceType` /
`participantOperationType`). **No guard/hook/catalog changes; no contract bumps**
(C1 v2 / C2 v2 / C3 unchanged — `--kb` on deps is a C3-permitted mode addition).

- New report section **"Participant-source provenance"** + `deps-sources.csv`
  (with `--csv-dir`), covering every source named by the usage/object-level rows:
  - **DATA_DESIGNER** → resolved to the KB docs whose filename IS the collectionId
    (`journey-data-designer/` field dictionary + `data-management/` label,
    description, data store), with matched mapping columns tied to the DD's field
    dictionary (alias-aware in both directions — a task prefix on the mapping
    column or on the DD output column still ties; never substring). A missing DD
    doc is a **caveat naming the exact fetches** (`jo dd get --name …`,
    `dm o describe --name …`), never an empty column.
  - **CSV** → the collectionId IS the uploaded filename — displayed as
    "CSV upload: <name>".
  - **QUERY_BUILDER** → "Power List `<id>` — not resolvable via CLI" (power lists
    have no CLI surface; collectionId == ruleId).
  - Anything else (e.g. the rare `QUERY` type) renders its pointers verbatim with
    an honest "no resolution rule" label.
- A **standing caveat states exactly where resolution stops and why**: the
  external-connection hop is unreachable (DD designs have no CLI describe; dataset
  columns carry no lookup provenance) — the feeding system is never inferred from
  payload text.
- New deps flag `--kb <slugDir>` for the KB location; without it the KB dir is
  derived from the index slug relative to the working directory (the skill's normal
  layout). A `--kb` pointing nowhere exits 1. Indexes built before 0.22.0 carry no
  pointers — the report says to rebuild instead of showing empty provenance.
- Summary JSON gains `provenanceSources` / `ddResolved` / `ddDocsMissing` /
  `csvSources` / `powerListSources` counts.

## 0.22.0 — 2026-07-17

Phase 6 continues (S8): token display names on every report surface (ER-15), survey
identity on email steps (ER-17), a working `deps --scan-tokens` (ER-19), and opt-in
full bodies in the program CSV (ER-18). **No guard/hook/catalog changes.**
**TWO CONTRACT BUMPS ship in this release** (both approved P-2, 2026-07-16):

- **Contract C1 v1 → v2 (index schema — additive only; v1 readers unaffected):**
  - template entry gains `tokens[]` (`{tokenKey, displayName, defaultValue,
    tokenType, variant, survey{surveyId, surveyName}|null}`) — persisted by a new
    `## Tokens` section `template-doc.mjs`/`describe-batch.mjs` now write into
    template docs (from the payload's `_tokens[]` + `tokenMappings`); docs written
    before this release parse `tokens: null` ("predates token metadata").
  - step entry gains `tokens[]` — the program-side token bindings, ONE normalized
    shape (`{tokenKey, kind: field|literal|survey|calc, label, objectName,
    fieldName, fieldId, survey}`) covering BOTH program generations (classic
    `variantMappings[].variantTokenMapping` object AND flow-canvas array) — and
    `boundAssets[]` (`{type, id, name}`; SURVEY populated now, future types
    additive), reconciled from `surveyIdFromEmailActionV2` + `surveyInfo`
    (flow-canvas) + `surveyTokenMappings` (classic); a source disagreement keeps
    both entries (named source first) and is flagged.
  - source entry gains `participantSourceCollectionId`, `participantSourceType`,
    `participantOperationType` — verbatim payload passthrough (the ER-20 handles;
    resolution logic ships in a later release).
- **Contract C2 v1 → v2 (output conventions):** the program-mode body rule is now
  "`body_chars` + `kb_doc_path` ALWAYS; the new **`--addbody`** flag (default off)
  additionally writes a full-text `body` column into `program-emails.csv` (variant
  rows included, token-resolved)". A run without the flag emits exactly the columns
  it would have without ER-18. Search snippet columns are untouched. Note:
  `body_chars` keeps measuring the RAW KB body (its v1 meaning) — the `body` column
  is token-resolved, so the two differ whenever a token resolves.
- **Tokens render as display names everywhere template text renders** (ER-15,
  Design A): `${subj::gs-…}`-style ids resolve to `{Product Name}`-style labels in
  search (markdown, CSVs, summary), program mode (step table, deep sections, both
  CSVs), and deps token rows. Precedence: the **program's own binding wins** where a
  program is in context; the template's author label is the fallback (search is
  template-centric and says so in a standing caveat). Fallback ladder: survey tokens
  → `{Survey: <name>}`; `unsubscribeText` → `{unsubscribe link}`; `${%us}`/`${%s}`
  and `[image::…]`/`[cid:…]` stay as-is; anything unresolvable keeps its raw id
  verbatim — never an invented placeholder. `program --deep` adds a per-email
  **Tokens table** (token id → label → bound source → default) so raw-id forensics
  survive resolution. Token-less docs are a new gap class the skill's budgeted
  gap-fill can backfill (lowest priority — never a mass re-fetch), and reports carry
  an "N template docs predate token metadata" caveat until then.
- **Email steps name their survey** (ER-17): the program step table gains a `survey`
  column, `--deep` sections show `Survey: <name> (<id>)`, `program-emails.csv` gains
  the `survey_bound`/`survey_name`/`survey_id` trio, and search program-context rows
  (markdown + `search-template-programs.csv` `survey_name`) show the survey name.
  No survey URLs anywhere; multiple surveys on one step comma-join.
- **`deps --scan-tokens` can now actually fire** (ER-19; it was structurally inert on
  GUID-token tenants): tokens resolve through the program's own bindings before
  matching, so a `--field` term matches the binding's label OR field API name OR
  objectName-qualified spelling (exact-ci, composing with `--alias-prefix` and
  separator equivalence). Every row reports WHICH handle hit (new `matched via`
  column in markdown + `deps-tokens.csv`) and keeps the raw token id + location as
  evidence; calc-bound tokens match by label only and are flagged; survey/literal
  tokens are never candidates; the literal token-text compare is kept as a secondary
  path. The old "0 token hits is NOT evidence" caveat is **replaced** by the true
  coverage limit.

## 0.21.0 — 2026-07-17

Phase 6 report fixes from the first real uses of `email-report` (ER-13/ER-14/ER-16) and
the alias-blindness correctness fix shared by both deps surfaces (ER-21/ER-22, governed
by ER-23's conventions ruling). **No guard/hook/catalog changes**; contracts C1/C2/C3
untouched (search-hits columns and summary `counts{}` keys are not contract-enumerated;
`--alias-prefix` is a C3-permitted mode-flag addition with default behavior unchanged).

- **search — `search-hits.csv` is now one row per matched template** (ER-13; was one
  row per template×field×term): per-field match booleans (title/subject/body/variants),
  a snippet column per field (`[term]`-prefixed on multi-term runs), and a
  `terms_matched` column. `search-template-programs.csv` is unchanged.
- **search — the template subject is always present** (ER-14): a plain `subject`
  attribute column on every CSV row (matched or not) and a `hitTemplates`
  id/title/subject sample in the summary JSON; markdown already showed it.
- **search — link counts can't read as program counts** (ER-16): summary counts now
  report `templateProgramLinks` and `distinctProgramsReferenced` (replacing the
  ambiguous `programsReferenced`), and the markdown summary states both numbers.
- **deps + deps-report — alias-aware field matching via `--alias-prefix '<regex>'`**
  (ER-21/ER-22; ONE shared implementation in `jo-report-deps.mjs`, imported by
  `tenant-deps.mjs`): a candidate field name whose leading task-alias prefix matches
  the tenant-conventions regex also matches its unprefixed spelling, and space and
  underscore are equivalent separators — still case-insensitive exact, **never
  substring**. The full prefixed name stays in every row (it names the originating
  task) and the match column/CSV say how each hit happened (`exact` / `task-alias` /
  `separator-equivalent`). Near-miss field names (share the term's words, matched
  nothing) are listed in a "possible related fields (NOT counted)" caveat. Without the
  flag, matching is exactly the previous exact-only behavior plus a caveat that no
  aliasing convention was supplied; the report header always names the matching rules
  in force. The pattern itself is **tenant data** (ER-23): both skills' SKILL.md now
  read a machine-readable "Field aliasing" section from the workspace's
  `.gs-superadmin/CONVENTIONS.md` and pass the regex through — nothing tenant-specific
  is compiled into plugin code, and an invalid regex fails loudly.

## 0.20.0 — 2026-07-16

New read-only skill: **`/gs-superadmin:deps-report`** — tenant-wide dependency search
(ER-11 of the email-report program). Given objects, fields, and/or external connections
(by name, id, or type — the KB's connector docs resolve any spelling), it reports every
KB-documented asset that depends on them: rules (source objects + connection types,
filter conditions, write targets, action-mapping connections), journey programs (via
the email-report parsers), reports (source object/connection, show/group/order fields,
where/having filters), connector jobs (connection, target object, field mappings), data
designers and journey datasets, and scorecard measures set by the matching rules.
Per-asset rows grouped by domain, per-domain CSVs, optional XLSX; captured all-areas
`dm deps check` payloads render reconciled against the KB view (`--live-deps`). New
engine script `scripts/tenant-deps.mjs` + mirror test; the report renderer in
`jo-report.mjs` gained an optional `title` (JO reports unchanged), and the dm-deps-check
payload parser in `jo-report-deps.mjs` was split into an all-areas primitive
(`parseLiveDepsAreas`) with the JO-scoped `parseLiveDeps` as a filtered view of it
(public shape unchanged). **No guard/hook/catalog changes**; contracts C1/C2/C3
untouched; the JO-scoped `email-report deps` mode's behavior is untouched by design.

## 0.19.1 — 2026-07-16

S5-V live-validation of the email-report family against a sandbox tenant — every
deferred check executed read-only, zero mutation-guard prompts. **With this release the
skill is validated and production-ready** (Bradley, 2026-07-16); the remaining
VALIDATION.md items are live-usage watch points, not defects. No guard/hook/catalog
changes; contracts C1/C2/C3 untouched. Changes:

- **audit-active**: cron humanizer now recognizes ascending day-of-week ranges
  (`2-6`/`MON-FRI` → "Weekly on Monday–Friday …"), nth-weekday forms (`TUE#3` →
  "Monthly on the 3rd Tuesday …"), and month `1/1` as every-month — all observed live;
  descending/wrap ranges (`FRI-MON`) still render raw, never guessed. Epoch-0/negative
  schedule timestamps ("never ran" sentinels) now render as absent (`—`) instead of a
  fake 1969/1970 datetime, in the report and CSVs.
- **search**: default snippet radius is now ±50 chars (was ±80; `--snippet <n>`
  unchanged); stray blank line after "## Hits" removed.
- **search/program**: "KB doc:" lines render the full absolute path when it exists from
  the invoking directory (directly openable), falling back to the stored
  workspace-relative path otherwise (new shared `kbDocDisplayPath` helper).
- **deps — new `--live-deps <file>` flag (repeatable)**: pass captured
  `gs-admin --json dm deps check --name '<object>' --areas JOURNEY_ORCHESTRATOR`
  payloads (the check is async — re-capture until `progressStatus.overallStatus` is
  COMPLETED; the email-report skill's step 5 now does this per `--object` term). The
  report gains a "Live dependents" section per object — Gainsight's own dependency
  answer, including the mapping/SELECT-side usage the participant-source scan
  structurally cannot see (live validation showed that can be ALL of an object's real
  usage) — reconciled row-by-row against the KB scan, plus a
  `deps-live-dependents.csv`. Without the flag, the `--object` caveat now names the
  uncovered objects and the exact capture command; a new `--scan-tokens` caveat warns
  that GUID-addressed tokens (`${subj::<id>}`) can never match field-name terms.
- **Fix — `manifest.mjs upsert-batch` no longer degrades the recorded `itemsPath`**:
  an upsert that doesn't pass `--items-path` (e.g. gap-fill work files, which are bare
  arrays) now keeps the domain's previous recording instead of overwriting it with
  `null` — the same carry-forward rule `describeCommand` already follows (explicit-null pattern; `dateField` carries forward too but with an absent-key pattern).
  `itemsPath` now means "the domain's known list shape"; the only way to change it is
  to pass the flag again (auto-detection never writes it — see the CALLOUT comment at
  the stamp site in `manifest.mjs`).
- **Fix — program doc-mode works on real JO payloads** (`doc-lib.mjs`
  `renderProgramDoc`): real `jo p describe` payloads carry the program under
  `data.advancedOutreach` (id `advancedOutreachId`), which the renderer didn't unwrap —
  every real program describe-batch doc-mode run failed with "no data.programId/id in
  payload". The renderer now unwraps the JO envelope for the id/name and metadata
  bullets (synthetic `data.programId` payloads keep their id/name and doc structure; `programName` no longer renders as a separate metadata bullet); verified live
  against the sandbox (real describes → compacted docs → index parses them with no
  errors).

## 0.19.0 — 2026-07-16

Four findings from 2026-07-13 test sessions (plugin 0.17.0, CLI 1.0.4), all in the
setup/refresh staleness machinery. No guard-hook or ask-semantics changes: the mutation
guard, ask-overrides, and journal are untouched, and `describe-batch.mjs`'s read-only
fail-closed catalog gate is intact.

- **The date field is now recorded at index time and reused by refresh** — `manifest.mjs
  upsert-batch` records the domain's modified-date field in `domains_indexed` alongside
  `idField`/`describeCommand`: `--date-field <f>` records the field, new `--no-date-field`
  records an explicit null ("this list output genuinely has none"), and a re-run that
  omits both reuses the recording (`dateFieldSource: "recorded"` in the summary). Refresh
  previously re-derived the field by eyeballing the first list item; any mismatch against
  what setup used flipped the whole domain falsely stale (`newerThan(value, null)` is true
  for every null-stored entry; a different field name string-compares unequal), and
  domains recorded date-less could never detect modifications at all. Guard rails mirror
  the 0.9.10 idField guard: an explicit flag contradicting the recording on a populated
  domain hard-fails, naming both fields and the consequence (**redate guard**;
  `--allow-redate` overrides a deliberate scheme change). Adopting a real field over
  entries stored without one **baselines** instead of staling — null stored dates are
  backfilled with no status change (`baselined` in the summary) and change detection
  starts on the next refresh, which is what makes legacy manifests safe to upgrade.
  Legacy stamps that omit both flags keep the `dateField` key absent (never materialized
  as null — "unknown" must not become "explicitly none"). Setup Phase 4 now requires
  exactly one of the two flags per new domain and checks 2–3 more items before concluding
  a domain has no date field (a null on item 1 means "this item", not "this domain");
  refresh Step 3 reads the recording back from `report` instead of re-deriving.
- **`newerThan` orders epoch-ms values numerically** — `Date.parse` of a numeric string
  is NaN, so epoch-millisecond dates fell through to string inequality: change was
  detected, but an *older* incoming date (out-of-order pages, restored backups) also
  flipped stale. Both values numeric now compares numerically (`""` guarded — `Number("")`
  is 0). Deliberate behavior change, locked by a fixture: an older epoch date no longer
  marks an entry stale.
- **Refresh fetches exhaustively; a shortfall is never read as deletion** — CLI list
  defaults silently truncate (first page of 20–50, no warning), and refresh Step 3 said
  "run the full list command" once: a truncated fetch made every asset beyond the first
  page look missing. Step 3 now restates setup Phase 4's load-bearing stop rules
  (page until a short page, reconcile against the payload's total field, large `--limit`
  where there's no `--page`, exact-default-size counts are suspect) and cross-references
  the full rules. `upsert-batch` backs it with a warn-only under-count guard: the summary
  gains `incomingCount`/`existingEntries`/`warnings`, warning when the incoming list is
  smaller than the domain's non-failed inventory — the default reading is "probable
  under-pagination → re-page", and deletions are only inferable from provably complete
  pagination plus explicit operator confirmation before `remove`. `upsert-batch` still
  never removes entries. A mass-stale advisory warns when a large fraction of a domain
  flips stale in one upsert (wrong date field or platform event, not that many edits).
- **Content fingerprints gate re-documentation** — a newer modified date proves something
  touched an asset, not that its content changed: platform events bump modified dates en
  masse, and `--document` re-described and overwrote docs for no content change (token
  trap; destroys the docs as a "what changed?" record). `doc-lib.mjs` gains
  `canonicalFingerprint()` (parsed payload, volatile modified/updated keys dropped at any
  depth, keys sorted, sha1 — never the rendered doc, so renderer changes don't read as
  tenant changes); `describe-batch.mjs` records it on every documented mark
  (`manifest.mjs mark --fingerprint`, strict 40-hex validation) and gains `--if-changed`:
  equal fingerprint with the recorded doc still present on disk → doc write skipped,
  entry re-marked documented with no `--depth`/`--doc-path` (metadata-era entries are
  never silently promoted out of the `--upgrade` queue), counted as `skippedUnchanged`;
  a different or missing fingerprint — or a deleted doc file (the operator's way of
  forcing regeneration) — documents normally, so the flag is safe on any re-document
  invocation. Omit it on a deliberate doc-format conversion (`--doc-mode` change /
  regenerating raw docs compact): unchanged content would skip the re-render.
  Refresh Step 5 now states the
  detect-only posture (run without `--document` first; a tight timestamp cluster across
  the stale set is a platform event) and its `--document` path always passes
  `--if-changed`.

## 0.18.0 — 2026-07-15

One new **read-only** reporting skill and its script family (the email-report program,
sessions S1–S4). Explicitly **no guard-hook, ask-semantics, or catalog changes** — the
mutation guard, ask-overrides, journal, and `reference/` bundle are untouched, and every
command the new skill issues is catalogued non-mutating.

- **`/gs-superadmin:email-report <mode>`** — reports over Journey Orchestrator email
  templates and programs, built from the tenant KB plus a fresh live status sweep.
  Four modes: **search** (phrase search across template titles/subjects/bodies/variants,
  with the programs using each hit; `--all-terms`, `--whole-word`, `--snippet N`),
  **program** (a program's email inventory — shallow step-flow table by default,
  `--deep` for full bodies and variants; ambiguous names are listed, never guessed),
  **audit-active** (schedule audit of PROCESSING programs: cron humanized or shown raw
  and labeled, datetimes in each program's own timezone, per-step sends honestly
  `not available via CLI`), and **deps** (object/field usage in participant sources,
  classified filter vs projected/show field; `--scan-tokens` adds `${...}` email-body
  token hits). "Active" always means PROCESSING; PAUSE joins via `--include-paused`.
  Output: a markdown report with a mandatory "Caveats & data gaps" section under
  `<slug>/reports-adhoc/` (never overwrites), optional per-table CSVs (`--csv`) and a
  one-workbook conversion (`--xlsx`). Gap-fill is budget-gated: the skill measures the
  exact KB gap first and asks full/partial/skip when it exceeds 50 fetches
  (`--budget N` bypasses; `--budget 0` skips). The skill is model-invocable (no
  `disable-model-invocation`), read-only throughout, and keeps every bulk payload in
  `.gs-superadmin/tmp/` files — never in model context.
- **`scripts/jo-report.mjs`** + four mode modules (`jo-report-search/-program/
  -audit-active/-deps.mjs`) — the zero-dependency engine behind the skill: KB doc
  parsers (both raw and compacted doc generations, both stepJson shapes), the C1 index
  builder with live-status overlay and drift/gap detection, shared report/CSV plumbing,
  and the four report modes. Each ships with its own standalone `test/jo-report*.mjs`
  runner (in CI).

## 0.17.0 — 2026-07-12

Five findings from the 2026-07-12 live `--deep` runs (CLI 1.0.4). No guard-hook or
ask-semantics changes: the mutation guard, ask-overrides, and journal are untouched, and
`describe-batch.mjs`'s read-only fail-closed catalog gate is intact — it now also
validates recorded describe commands, exactly as it validates passed ones.

- **Describe recipes recorded at index time** — `manifest.mjs upsert-batch` gains
  `--describe-command "gs-admin … {id}"`, stored per domain in `domains_indexed`
  (alongside `{at, idField, itemsPath}`; a re-index that omits the flag keeps the
  recording). `describe-batch.mjs` defaults to the recorded template when `--command`
  is omitted; an explicit `--command` always wins, domains with no recording still
  require one, and a recorded mutating/unknown command is refused by the same
  fail-closed gate. This is the structural half of the `{id}`-vs-`{name}` trap fixed
  in 0.16.0: the skill composes the describe command per domain at index time anyway —
  recording it then removes the substitution guesswork from every later deep run.
  Setup Phase 4 records it; Phase 5's batch fence documents the default.
- **Depth-aware progress on `--upgrade` runs** — on a `--deep` run of a fully-stubbed
  domain, `domainProgress` read `documented: N/N` from the first chunk and never moved
  (metadata stubs already count as documented), so drivers watching it for a
  no-progress stop condition couldn't see progress or false-triggered. With
  `--upgrade`, `domainProgress` now reports `{ full, metadata, failed, total }` and the
  stderr progress line shows `full/total` (`… — domain 380/473 full`). Non-upgrade
  runs are unchanged; skill text and script output stay in agreement.
- **Phase 6 relationship truth: there is no journey→rule map** — the old note framed
  journey → rule linkage as a prose-synthesis gap, inviting a map that architecturally
  cannot exist: Rules Engine rules do not load participants into JO programs; programs
  draw participants from Power Lists, backed by CSV uploads, ad-hoc queries, or Data
  Designer / DD-template datasets — never a rule (Gainsight product architecture,
  tenant-agnostic; live-confirmed by a full GSID cross-reference finding zero
  shared-id edges). `process-maps.md`, the setup skill, and the operating model now
  state this and name the edges that ARE derivable: program → email template
  (automated, next bullet) and program → Power List → source (manual, from the
  PowerList config in step JSON).
- **`program-to-template.md` — a fourth first-class relationships map** —
  `relationships-build.mjs` derives program → email template edges from GSID
  co-occurrence between journey program docs and the email-template inventory
  (token-boundary matching, 1.0.4-scoped; works identically on raw and compacted
  program docs, locked by a fixture that extracts the edge from a compacted doc).
  Honesty conventions carried over: coverage header per file, unparseable docs
  reported never skipped, metadata-stub program docs excluded by manifest depth, a
  stubbed journey domain gets the pending-deep-ingest note, and the template side
  says plainly that inventory ids match at any depth. New `--journey-domain` /
  `--templates-domain` flags mirror the existing domain overrides.
- **Journey program doc compactor** — `jo p describe` payloads run ~287 KB/program,
  dominated by flow-canvas geometry (node coordinates, transforms, UI state); a large
  tenant's deep ingest writes hundreds of MB of mostly non-semantic layout.
  Generalizing the 0.16.0 email-template flow: `doc-lib.mjs` gains a program renderer
  keeping the semantic skeleton (node types/names, branch conditions, participant
  source with the PowerList config preserved VERBATIM, email-template GSID references,
  timers/waits) and dropping only an enumerated geometry/UI key list — conservative by
  construction: unknown keys are always kept, embedded JSON strings (stepJson) are
  parsed so their geometry is stripped too, and the full payload stays re-fetchable by
  id (stated in the doc header, like template docs). Payload-shape assumptions are
  1.0.4-scoped (undocumented CLI internals — same rationale as `_flatMappings`).
  Wired as `describe-batch.mjs --doc-mode program`, auto-selected for the `journey`
  domain (mirroring template mode), plus standalone `scripts/program-doc.mjs` for
  one-off payloads (fixture locks batch ≡ standalone byte-for-byte). Compaction
  provably preserves what the relationships map needs. Setup Phase 5 documents the
  flow, the once-per-run user disclosure, and that regenerating existing raw docs
  (`--statuses documented`) is a workspace-side choice — the plugin never deletes
  docs on its own. New CI-wired `test/program-doc.mjs` suite.
- **Two doc caveats** (1.0.4-cited): (a) dm `group=System` is a SUPERSET — some
  System objects are Data Designer outputs and some are not, no describe field
  distinguishes them, and there is no DD design list command, so "which dm objects
  are Data Designers" is not determinable from CLI data (`dataStore=REDSHIFT` and
  `copy`/`view` `dbName` prefixes are weak hints only) — stated in setup Phase 4 and
  the operating model's known-limitations bullet. (b) Forward-compat naming: if a
  future CLI ships a general Data Designer *designs* list, it must be indexed under a
  NEW domain name (suggest `data-designer-designs`) — `journey-data-designer` is
  taken by the JO-scoped `ds=UNIVERSAL_DATA_SET` subset and `data-designer` by
  `dd templates` — one sentence in the skill's domain-naming rule.

## 0.16.0 — 2026-07-11

Two findings from the 2026-07-11 live `--deep` runs (data-management and
journey-email-templates domains, CLI 1.0.4). Neither change touches the guard hook or
its ask semantics, and `describe-batch.mjs`'s read-only fail-closed catalog gate is
unchanged (`jo email template --id` is non-mutating and passes it like any other
describe).

- **Sanctioned batch driver for email-template docs** — `describe-batch.mjs` gains a
  template doc-mode (`--doc-mode raw|template`, auto-selected as `template` when
  `--domain journey-email-templates`): the existing selection / sequential-describe /
  mark / retry / progress loop now writes the compact template docs (metadata + the
  plain-text body, ~30× smaller; the ~50 KB entity-escaped HTML is dropped and stays
  re-fetchable by id) instead of raw-JSON docs for that domain. Previously the skill
  mandated `template-doc.mjs` for email templates but offered no batch runner for it, so
  a live `--deep` run hand-assembled the describe → file → render → mark loop — the same
  improvised-orchestrator signal that justified shipping `describe-batch.mjs` in the
  first place. The rendering (and the doc-filename rule, formerly three "keep in sync"
  copies) moved to a shared `scripts/doc-lib.mjs` imported by `describe-batch.mjs`,
  `template-doc.mjs`, and `manifest.mjs` (precedent: `journal-lib.mjs`); a fixture locks
  batch and standalone output identical for the same payload. `template-doc.mjs` stays
  the standalone path for one-off payloads (e.g. recovering list-invisible templates
  from UI-exported ids). Chunk sizing: template describes are fast and the docs small —
  the setup skill now cites `--limit` ~50 per invocation for this domain (observed safe
  on CLI 1.0.4), leaving the generic ~10–15 raw-JSON guidance for other domains
  unchanged. The batch summary now reports `docMode`, and the once-per-run user
  disclosure line (metadata + plain text stored; HTML re-fetchable) is unchanged.
- **`{id}` vs `{name}` disambiguated everywhere placeholder semantics are stated** — a
  live `--deep` data-management run failed 15 describes with `--name {name}`: the docs
  said "dm objects describe by object *name*", so the executing model substituted the
  display label, but the object's system name IS the manifest key. The rule, now stated
  identically in the setup skill (id-field paragraph + batch-execution section), the
  operating model, and `describe-batch.mjs`'s header, and locked by a text-agreement
  fixture: the describe identifier is always `{id}` — the manifest is keyed by it;
  `{name}` substitutes the display label and is only for commands that address by label
  (e.g. `sc measures --name`); dm objects therefore take `--name {id}`, not
  `--name {name}`.

## 0.15.0 — 2026-07-11

Guard-hook fix (follow-up noted at the end of the S3 session, outside the PV batch
scope). This is a **safety-boundary change** to the guard hook, strictly ask-adding:
no ask became a deny or disappeared — the hook only recognizes more spellings of the
same CLI.

- **Suffix-spelled invocations reach the guard.** On Windows the npm shims are
  `gs-admin.cmd` / `gs-admin.ps1` (a packaged binary would be `gs-admin.exe`), and a
  suffixed spelling invokes exactly the same CLI — but the hook's cheap command gate
  and its word scanners matched only the bare `gs-admin` token, so a mutating
  `gs-admin.cmd jo p save` (or `C:\tools\gs-admin.exe jo p save`) ran with no approval
  prompt, no tenant warning, and no change-journal entry: a discoverable way around the
  guard. The gate regex and both word-scan sites (the mutation scan and the escalation
  key) now accept one optional `.exe`/`.cmd`/`.ps1` launcher suffix, case-insensitively
  (Windows filenames are), via a shared helper. Suffixed mutations get the same ask +
  tenant warning, approved ones journal identically, suffixed read-only commands still
  pass silently, and unrelated words that merely end in gs-admin-like text
  (`backup-gs-admin.cmd`) stay unmatched as before.

## 0.14.0 — 2026-07-11

Post-validation batch S3 (PV-6, PV-7, PV-8; findings E, F, H, I from the SA-1/SA-2 live
validation). The shell-safety lint changes are **safety-boundary changes** to the guard
hook: no ask became a deny or disappeared — the new lint and the workspace consumer list
only produce the same deny-with-hint → repeat-ask coaching the pipe lint already used,
`&&` chaining is never touched, and a malformed workspace file fails open to today's
behavior.

- **Shell-safety hardening in the guard hook** (PV-6, live Finding H + broader quoting):
  - **Workspace-configurable pipe consumers** — piping gs-admin JSON into a user-defined
    shell function (`… | dump`) was denied because the built-in consumer list can't know
    org-local names. Workspaces can now accept extra names via
    `.gs-superadmin/pipe-consumers.json` (`{ "consumers": ["dump"] }`; matched like
    built-ins — basename, case-folded, `.exe` stripped). **Additive only:** the file can
    widen what the pre-execution quoting lint accepts (worst case: Claude Code's normal
    permission flow), never touch the catalog mutation ask; a missing, malformed, or
    wrong-shaped file is ignored (built-ins only, fail-open). Review-hardened: a UTF-8
    BOM (PowerShell 5.1's default) is tolerated; an entry that normalizes to the empty
    string (e.g. a slash-terminated path) is rejected — it would otherwise silently
    accept every empty-right-hand-side pipe the lint exists to catch.
  - **Lone-`&` lint** — asset names can carry `&` (Sales & Marketing) just like `|`; a
    single unquoted `&` whose right-hand side is not a recognized program now gets the
    same first-offense deny with a quoting hint and repeat-offense escalation to a human
    ask, sharing the pipe lint's session deny-memory. `&&` chaining is **never** flagged;
    neither are `2>&1`/`&>`, a trailing `&` (backgrounding — bare or closing a
    subshell/group, `(cmd &)`), or either operator followed by a quote or `$`
    (deliberate syntax — PowerShell's call operator `& "C:\…\tool"`, a `| $pager`
    variable filter — an unquoted name fragment always resumes with a literal word).
  - **Quoted invocations reach the guard** (review-found gap adjacent to the call-operator
    exemption): the hook's cheap command gate rejected a quoted `gs-admin` token
    (`& "C:\…\gs-admin" jo p save`, `'gs-admin' jo p save`), silently skipping both the
    mutation ask and the journal for those forms. The gate now accepts quote boundaries —
    strictly ask-adding.
  - **Quoting guidance sharpened everywhere it appears** (operating model, cheatsheet
    header via the renderer, setup's managed CLAUDE.md block, README): asset names can
    carry `| & ; ( ) $` and spaces — single quotes neutralize all of them; never leave a
    free-text value unquoted.
- **Docs / known-issues batch** (PV-7, findings E, F, I + validation micro-learnings),
  all 1.0.4-scoped where CLI-version-dependent:
  - `re r list` has **no `--name` flag** — the name filter is `--search` (partial match).
    New Known CLI issues bullet; every quoting example that used `re r list --name` now
    uses `--search` (operating model, cheatsheet header renderer, guard hint, fixtures).
  - `re r debug` (the documented accepted over-ask) also **writes a local run-state file
    per invocation** — `~/.gs-admin/runs/` accumulates silently, including for calls that
    failed arg validation; sweep it when cleaning up after debug-heavy work.
  - **Run mutations unchained** — chaining a mutating command with other shell commands
    pollutes the journal entry's parsed `target` field (observed live); one mutation per
    command line when a clean journal entry is wanted.
  - **CTA per-record tokens** (validated live): per-record values in a CTA comment/name
    are `${⟨alias⟩_⟨Field⟩}` tokens embedded literally in `--comments`/`--name` (stored
    with `isTokenBased`/`tokenFields` on the mapping) — new plan-template reference
    bullet, with the single-quoting and test-run-verification requirements.
- **VALIDATION.md trimmed to the live results** (PV-8): the checks the 2026-07-11 live
  validation passed are deleted per the file's protocol; still open are the TM-4 ticket
  end-to-end test, completion-comment posting, the multi-tenant unattributed-journal
  check, and the PV-2/PV-3 revalidation items (failure-event journaling; live
  ask-override behavior).

## 0.13.0 — 2026-07-11

Post-validation batch S2 (PV-4, PV-5, PV-10). No hook or ask-rules changes — the
mutation guard, ask-overrides, and journal are untouched by this release.

- **Sanctioned Phase 6 relationship-map generator** (new
  `scripts/relationships-build.mjs`; PV-4). Two live E2E runs in a row hand-rolled
  their own `_flatMappings` parsers for relationship synthesis — the same signal that
  produced describe-batch — and Phase 6 was the only phase with no sanctioned tooling.
  The script derives `relationships/field-to-rule.md` (field population + chain
  execution order), `field-to-scorecard.md` (measure ← scoring rules via `SET_SCOREV2`,
  GSIDs resolved against the scorecard docs' `levelType` trees), and `process-maps.md`
  (rule → CTA) from the KB's full-describe docs, with no CLI calls and no payloads in
  model context. The undocumented `_flatMappings` payload semantics are hardcoded,
  version-scoped **verified on CLI 1.0.4**, and documented in the script header (plus
  a short operating-model note — not the cheatsheet, which stays catalog-generated).
  Honesty guarantees: every output file opens with the Phase 6 coverage header
  (built-from full-doc counts, stub-excluded domains with their `--deep` re-run
  command, failed-describe counts — a rules domain with no full docs gets a "pending
  deep ingest" note instead of a thin map); actionTypes the generator doesn't recognize
  are **reported in the output and the JSON summary, never silently dropped**; and
  rule→measure references that resolve to no documented scorecard are flagged as
  **dangling refs** (a real tenant-hygiene signal). The same honesty rule extends to
  the edges: an unlisted `REST_API` delivery area is reported like an unknown
  actionType (never absorbed); unresolved measure refs with no parseable scorecard
  docs are labeled a **coverage gap**, not tenant hygiene; an all-failed domain is
  never mislabeled "metadata stubs"; and manifest-full docs whose payload can't be
  parsed are called out in the header. Setup Phase 6 now names the script
  as the default mechanics — prose synthesis remains for what it can't derive
  (journey → rule linkage). New fixture suite (`test/relationships-build.mjs`,
  fictional acme data) locks the three maps byte-for-byte and the coverage-degradation
  paths, CI-wired.
- **describe-batch progress output** (PV-5): long `--deep --all` loops are no longer
  silent — the script emits a stderr progress line every few describes
  (`[describe-batch] 45/120 in batch — domain 380/473 documented`) and the summary JSON
  gains `domainProgress` (documented/total for the domain). Progress reads are
  best-effort: a failed manifest read drops the domain half of the line, never the
  batch. The setup skill mentions the progress output where it sets `--limit`
  expectations.
- **New `/gs-superadmin:report-bug` skill** (PV-10, approved 2026-07-11): captures a
  `gs-admin` CLI misbehavior as a vendor-ready "prompt and problem" report at the
  moment of encounter, while the verbatim commands, unedited output, and the human ask
  are still in the session. Ships the proven report template as a reference file
  (Summary · Environment · Prompt & task context · Commands run · Expected vs actual ·
  Reproduction · Reliability · Impact · Workaround). Dedup-first: a misbehavior already
  in the operating model's Known CLI issues stops with a citation, and a repeat of an
  existing report appends an evidence section instead of a new file. The output
  directory is asked **once** per workspace and recorded in a durable marker
  (`.gs-superadmin/upstream-reports-dir`; default `.gs-superadmin/upstream-reports/`) —
  reports deliberately carry tenant identifiers (vendor-bound, the user's own tenant)
  but never tokens, secrets, or auth headers, and the skill never sends, posts, or
  commits anything. A new confirmed report ends with a *proposed* Known-CLI-issues
  bullet for the operating model, applied only on an explicit yes. User-invoked only;
  the operating model now tells sessions to *suggest* it when a command misbehaves in a
  Known-CLI-issue-like way. Skill-text fixture suite CI-wired.

## 0.12.0 — 2026-07-11

Post-validation batch S1 (findings J, D, C from the SA-1/SA-2 live validation). The two
guard-hook changes are **safety-boundary changes**: no ask became a deny or disappeared —
both only add asks or journal entries.

- **Build-standards enforcement in change-request planning** (live Finding J: a run loaded
  `rules-engine.md` but not `query-building.md` before choosing a rule's data source,
  picked the irreversible single-object mode the workspace standard forbade, and thereby
  also skipped the downstream task/field-naming standards). The skill now carries an
  explicit conventions trigger at the scoping step — load the topic file for each asset
  type touched *before* the decision it governs, with the rule "Choosing or altering a
  rule's data source is dataset work — load `query-building.md` first" stated verbatim in
  the skill, the plan template, the operating model, and the conventions index (a fixture
  keeps the four in agreement). The plan header gains two mandatory lines as the forcing
  function: `Conventions consulted:` (the files actually read, or an honest
  "none — pack not adopted") and, for any plan touching a rule's data source,
  `Data-source mode:` — `set-source-template (Prepare Dataset)` or `set-source
  (single-object — IRREVERSIBLE, justification required)`. Plugin-level CLI fact recorded
  (1.0.4-scoped, independent of any org's conventions): `re r set-source` is the UI's
  "Select an Object" and cannot be changed later; `re r set-source-template` (attach a
  Data Designer template) is the CLI's only Prepare-Dataset equivalent — there is no
  inline prepare-dataset builder.
- **Failed attempts are journaled** (live Finding D: this harness passes no exit status to
  PostToolUse and never fires it for failed calls, so failures were either dropped or
  masked). The guard hook now also registers for `PostToolUseFailure` (fires only for
  commands that actually executed and failed — denied commands still never appear): an
  approved mutating/unknown command that fails journals as
  `FAILED (tool call failed: <error>) — this change likely did not apply`, with the
  payload's `tool_error` clamped like every untrusted value. Success-path rewording: an
  explicit PostToolUse event with no exit code is itself the success signal, so the
  outcome now reads `completed (success event; no exit code reported)` instead of the
  alarming "not verified". Graceful degradation: harnesses that never emit the failure
  event behave exactly as before (successful calls journal; the multi-location exit-code
  fallback and `interrupted` handling are unchanged, and inferred PostToolUse on older
  harnesses keeps the honest "not verified"). Journal file header untouched
  (byte-identical between both writers, as before).
- **Self-retiring ask-overrides for verified catalog mislabels** (live Finding C:
  `re r run-now` is catalog-labeled non-mutating but defaults to a LIVE rule execution — a
  tenant write slipped past the guard silently). New hand-maintained
  `hooks/ask-overrides.json` — the one sanctioned exception to catalog-derived guard
  behavior (AGENTS.md tenet 6, approved 2026-07-11): entries force an approval prompt on
  catalog-non-mutating commands verified to mutate, citing the upstream mislabel in the
  prompt. Seeded with exactly `re r run-now` (verified on CLI 1.0.4; `--test-run`, the
  safe mode, skips the prompt). Overrides can only ever ADD asks — entries are honored
  only with `whileCatalogMutatingIs: false`, they are consulted only for commands the
  catalog lets pass, and a missing/malformed file fails open to plain catalog behavior.
  Self-retiring: once upstream fixes the flag, the entry stops matching and the normal
  catalog ask takes over — no double prompt. Approved override hits are journaled with the
  override called out in the action line. `re r debug`'s inverse mislabel (catalog-mutating
  but read-only in effect) gets NO override — the hook cannot remove asks; it is documented
  as an accepted over-ask in the operating model instead.

## 0.11.0 — 2026-07-10

Findings batch from the second live E2E run (fresh-workspace setup on 0.10.0):

- **Sanctioned batch-describe script** (new `scripts/describe-batch.mjs`, zero-dep,
  CI-tested — 24 checks). Two live runs in a row saw the model improvise its own
  describe→doc→mark orchestrator (hitting `.cmd`-spawn ENOENT, UTF-16 redirects, and
  quoting traps on the way). The script owns that loop now: batch selection via
  `manifest.mjs next`, sequential describes (the CLI's token-refresh race forbids
  parallel calls), one structured doc per asset, per-doc `mark` so interruptions lose
  at most one asset, resumable until `moreRemaining: false`. `{id}`/`{name}` are
  substituted as literal argv — no shell, so pipe-bearing names need no quoting — and
  the CLI's real JS entry is resolved, sidestepping Windows shim spawning. Because the
  embedded command hides inside a quoted argument the guard hook can't inspect, the
  script enforces read-only itself, fail-closed against the catalog: mutating or
  unknown commands are refused with a pointer to run them directly. Setup Phase 5
  names it the default execution path; hand-chained literal describes remain the
  manual fallback.
- **List-only domains are indexed, not skipped.** The E2E run dropped connections and
  connector jobs from the manifest because they have no per-item describe command.
  Setup Phase 4 now defines the category (asset lists without a describe — e.g.
  `cn list`, `cn jobs`, whose `--describe` resolves by first-name-match only) and
  requires indexing them; Phase 5 stubs them whatever the crawl mode — the stub is the
  complete doc — and they never enter `--deep` expectations or block Phase 6. Activity
  feeds (`cn activity`, `cn px`) stay out. Refresh mirrors the rule.
- **Empty domains are stamped, always.** The run left an empty domain out of the
  manifest ("no items to key on"), losing the listed-vs-never-listed evidence the
  coverage map exists for. Phase 4 now says to `upsert-batch` every list run, and a new
  `--allow-empty` flag handles empty payloads that carry no items array at all.
- **`manifest.mjs remove` verb + rekey-orphan capture.** A live wrong-key index fixed
  with `--allow-rekey` stranded the old-key entries, and with no removal verb the
  manifest had to be hand-edited — the exact thing the script exists to prevent.
  `upsert-batch` now reports orphaned keys on a rekey (full list to `--orphans-file`),
  and `remove --key`/`--keys-file` drops entries, reporting their `doc_path`s for file
  cleanup (never deleting docs itself). manifest-ops suite now 56 checks.
- **Pre-release review hardening** (same 0.11.0, applied before merge):
  - Rekey-orphan capture now also fires on legacy bare-timestamp manifests (the
    shape-heuristic path) — previously `--orphans-file` was silently skipped there,
    stranding old-key entries.
  - `mark` gains `--doc-path`, and `describe-batch.mjs` records each doc's path as it
    marks — so `remove`'s `docPaths` cleanup report covers describe-batch-documented
    entries, not just stubs.
  - `next` sorts `failed` entries after pending/stale (persistent failures can't
    starve untried assets out of a `--limit` batch), and `--upgrade` keeps failed
    metadata stubs selectable so `--deep` retries them instead of silently dropping
    them from the queue; the setup skill adds an explicit stop rule for repeating
    failures.
  - `upsert-batch`/`stub`/`remove` tolerate a UTF-8 BOM on input files (PowerShell
    5.1's `Out-File -Encoding utf8` writes one), and the operating model no longer
    recommends `Out-File` as the UTF-8 remedy; `--allow-empty` refuses an
    `--items-path` that resolves to a real non-array value instead of stamping a
    data-bearing domain as empty.
  - `describe-batch.mjs` refuses a path-prefixed binary in `--command` (it would have
    been silently ignored — use `--bin`), and its catalog lookup now uses the same
    first-workspace-then-bundle search as the guard hook.
- **Phase 6 gets a shallow-crawl mode.** Instead of an all-or-nothing precondition,
  synthesis on a stub-bearing inventory builds only what full docs support, with an
  explicit coverage header per relationships file and "pending deep ingest" notes where
  a map's primary inputs are still stubs.
- **Known CLI issues additions** (operating model, 1.0.4-scoped): `re rules list` caps
  pages at 200 regardless of `--limit` (short page ≠ last page — reconcile against
  `totalRecords`); describe identifiers that differ from the payload `id` (`ruleId`,
  `workflowId`, dm object name); plus Windows guidance — never `spawn` the `.cmd` shim
  from node, and never write JSON files with PowerShell's UTF-16 `>` redirect.

## 0.10.0 — 2026-07-10

- **Change attribution + plan-completion journaling moved from prose to script verbs**
  (new `scripts/journal.mjs`, zero-dep, CI-tested). `<slug>/changes/JOURNAL.md` has two
  writers — the guard hook and the change-request skill's execution steps — and the
  skill's half was SKILL.md fences an executing LLM had to transcribe by hand: the
  `.gs-superadmin/active-change.json` marker JSON (with a hand-written ISO timestamp),
  the plan-completion entry, and a file header that had to stay byte-identical to the
  hook's. A fixture compared the hook's header to the SKILL fence, but nothing checked
  what a real session actually transcribed. Three verbs own that now:
  - `change-start --ticket <KEY|none> --plan <path> --slug <slug>` — validates all three
    (Jira-key shape; the plan file must exist under `<slug>/changes/` with no `.`/`..`/
    empty path segments, so the drafting date is copied from disk, never re-derived; the
    slug must have a `_manifest.json` and is normalized to on-disk casing), stamps
    `started_at` itself, and writes the marker atomically.
  - `change-end` — deletes the marker (idempotent), on both the abort and completion
    paths.
  - `journal-append --outcome executed|partial --system-area … --asset … (repeatable)` —
    appends the plan-completion entry with a script-computed timestamp and operator
    (same value the hook writes), creating the file with the exact hook header.
  The header emitter is now shared (`scripts/journal-lib.mjs`, imported by the hook
  lazily inside its fail-open journal path — PreToolUse stays self-contained), and
  guard-fixtures' header-vs-SKILL-fence check became a header-vs-script-output check:
  both writers' *runtime* output must be byte-identical. The change-request SKILL's
  execution steps now invoke the verbs instead of transcribing fences (the
  completion-comment drafting stays prose — user-facing Jira markup, approval-gated).
  Marker/journal formats are unchanged; existing journals need no migration. New
  CI-wired `test/journal-ops.mjs` suite (38 checks), including an end-to-end check
  that the hook attributes commands to a `change-start` marker; guard-fixtures also
  proves the fail-open promise directly (a copy of the hook with journal-lib missing
  degrades to the systemMessage alert, never a crash).

## 0.9.10 — 2026-07-10

- **Re-index guard hardened: the id field is now recorded, not inferred.** The 0.9.8
  guard's shape heuristic (zero key overlap AND a different majority id shape) was blind
  to a wrong field with the *same* shape as the right one — two uuid columns, or
  `folderId` vs `templateId` both numeric — which passed silently and duplicated the
  whole domain as pending; domains under 3 entries had no protection at all.
  `upsert-batch` now records `{at, idField, itemsPath}` in `domains_indexed[domain]`
  (previously a bare timestamp) and hard-fails a re-index whose `--id-field` differs
  from the recorded one, whatever the shape and from the very first entry.
  `--allow-rekey` still overrides a deliberate key-scheme change (and re-records the new
  field); a mismatch on a domain with zero inventory entries is allowed and re-recorded —
  the original field was never validated by data and there is nothing to duplicate.
  **Backward compatible with existing manifests**: a pre-0.9.10 bare-timestamp stamp
  falls back to the 0.9.8 shape heuristic and is upgraded to the recorded shape on its
  next successful upsert; old scripts reading `domains_indexed` keys (report
  `emptyDomains`, Phase 4's coverage cross-check) are unaffected. Setup Phase 4 and
  refresh describe the recorded-field rule. 8 new fixture checks (manifest-ops now 39).

## 0.9.9 — 2026-07-10

- **Pre-merge review hardening** (cold-eyes pass over the accumulated 0.8.0→0.9.8
  branch before PR #13 merges — fixes only, no new features):
  - **`stub` no longer downgrades stale full docs.** Refresh flips documented entries to
    `stale` without touching depth, and the old skip guard only protected
    `status === "documented"` — so a shallow-crawl re-run after a refresh would overwrite
    deep-ingested docs with metadata stubs. Any entry that has (or ever had) a full doc
    is now skipped whatever its status, including pre-depth-era entries.
  - **`mark --status documented` keeps an existing `metadata` depth** instead of silently
    promoting the stub to `full` (which dropped it from the `--deep` upgrade queue with
    no full doc written). Pass `--depth full` explicitly after a deep ingest, as Phase 5
    already instructs.
  - **Domain naming rule stated where it was only implied**: one manifest domain per list
    command — the catalog namespace for a domain's primary asset list, a suffixed name
    for additional asset types (`journey-email-templates`, exactly: the `--deep`
    examples, stub folders, and template-doc generator all key on it). Setup Phase 4/5,
    refresh, and the README now say so; Phase 4's bare "catalog namespace" wording sent
    email templates into `journey/`, which would break `--deep journey-email-templates`,
    the generated docs' key lines, and (by mixing id shapes in one domain) trip the
    0.9.8 re-index guard on legitimate indexing.
  - **Guard: path-prefixed invocations (`./gs-admin …`, `C:\tools\gs-admin …`) are
    guarded and journaled** — the cheap command gate dropped them before the word
    scanner (which already supported them) ever ran.
  - **Guard: `gs-admin jo $c` gets the variable-subcommand coaching too** — any unmatched
    invocation with a `$var`/`@splat`/backtick token among its subcommand words is now
    coached; previously only a variable in the first position was, and namespace-literal
    loops got the misleading typo/newer-CLI prompt instead.
  - **Guard: a deny that cannot be durably recorded asks instead of denying forever.**
    The pipe lint and variable coaching share one deny-memory helper now; if the
    session-state write fails persistently, the old code repeated the first-offense deny
    on every retry with no path to a human prompt. AGENTS.md tenet 1 records the two
    deny-then-ask coaching exceptions.
  - **Journal: header + entries written in one append** — the old
    existsSync→write(header)→append(entries) sequence let a concurrent hook (parallel
    tool calls) truncate a just-appended entry while creating the file; worst case is
    now a duplicate header, never a lost entry.
  - **Journal: exit status read from `tool_response.exit_code`, `exitCode`, or top-level
    `exit_code`** (harness versions differ on the payload shape; the live VALIDATION
    check still confirms end-to-end). PostToolUse is also inferred from a present
    `tool_response` when `hook_event_name` is absent, and the hook gates on a raw
    substring check before JSON-parsing potentially huge PostToolUse payloads.
  - **Deterministic doc filenames for sanitized ids** (`stub` + `template-doc.mjs`): ids
    that need sanitizing get a short raw-id hash suffix, so distinct ids that clean to
    the same base (`t 1` vs `t_1`) can never collide across separate runs; clean ids —
    the normal case — keep their plain names. Setup Phase 5 step 2 states the sanitize
    rule for hand-written docs.
  - **Docs reconciled**: the operating-model truncation bullet no longer claims
    `pageInfo.totalAfterFilters` "reveals the real count" for `jo email templates` — it
    is post-filter/post-flatten, proving paging completeness only (0.8.7's entry
    annotated); the completion-comment `⟨date⟩` placeholder now distinguishes the
    plan-file path (drafting date — copy the path as it exists) from the completion
    date; the plugin README catches up on `manifest.mjs` verbs, `template-doc.mjs`, and
    the KB folder layout; Phase 5's domain-completes paragraph defers to the checkpoint
    preference instead of restating it.
  - Fixtures: guard 56 checks (+5), manifest-ops 31 (+5); all five suites CI-wired and
    green.

## 0.9.8 — 2026-07-09

- **Re-index guard in `upsert-batch`** (eighth live-E2E finding, caught by the executing
  session before it bit): manifest keys are `<domain>/<id>`, and the correct id field is
  whatever the domain's *describe* command accepts — not always the payload's `id`
  (dm objects describe by object name; rules keys are UUIDs while the payload also
  carries a mongo-style id). A re-index that picks a different `--id-field` would match
  nothing and silently duplicate every asset as pending next to its documented twin.
  `upsert-batch` now hard-fails when an established domain (≥3 entries) gets incoming
  ids with zero overlap AND a different id shape (uuid/hex24/numeric/text) — zero
  overlap alone stays legal, since a later page of a paged list is legitimately all-new.
  `--allow-rekey` overrides a deliberate key-scheme change; output now includes
  `matchedExisting` for sanity-checking overlap. Phase 4 states the
  reproduce-existing-keys rule. 5 new fixture checks (manifest-ops now 26).

## 0.9.7 — 2026-07-09

- **Compact email-template docs: new `scripts/template-doc.mjs`** (zero-dep,
  CI-tested). Template describe payloads carry ~50 KB of entity-escaped HTML each
  (`htmlContent`/`editorContent`); KB docs that embedded them averaged 88 KB — unreadable
  and unaffordable at 1,336 templates (~67 MB). The script converts captured describe
  payloads into compact docs deterministically: metadata bullets + the **plain-text body
  verbatim** (searchable, ~1.7 KB avg — a 30× reduction), a strip-HTML fallback when the
  plain body is empty, a variants section when present, and a re-fetch pointer
  (`jo email template --id`) since the tenant remains the source of truth for HTML.
  Payloads never pass through model context. Phase 5 directs template documentation
  through the script and tells the user once per run that HTML is dropped. New
  `test/template-doc.mjs` suite (14 checks) wired into CI.

## 0.9.6 — 2026-07-09

- **List-invisible email templates are recoverable by id** (validated live): describe
  (`jo email template --id`) uses a different endpoint than the broken list and returns
  subfolder templates fine — the flatten gap is discovery-only. Phase 4 now documents
  the recovery flow: user-exported ids → JSON items array → `upsert-batch --id-field
  id` → standard Phase 5 describe loop. Workaround also recorded in the
  operating-model limitation note.

## 0.9.5 — 2026-07-09

- **Email-template flatten bug validated in the live UI** (follow-up to 0.9.4): CSAT's
  7 subfolders match the 7 ghost rows exactly; a named subfolder template is absent
  from the CLI list; the user's top-level census closes the arithmetic — of 1,336
  templates, 642 live in subfolders (dropped by the one-level flatten) and ~75 are
  missing even at the top level (residual `source=COMMS`/state filter, cause still
  unconfirmed). Limitation notes updated from "pending validation" to validated, with
  the two-cause split.

## 0.9.4 — 2026-07-09

- **Email-template under-count re-diagnosed: one-level folder flatten, not (only) a
  server filter.** Aggregate analysis of the live tenant's 647 list rows showed 28 rows
  carrying *only* a `folderName` — no id, no fields — under 8 parent folders: these are
  nested **subfolder nodes** the handler's one-level flatten (folders → children)
  mangles into ghost rows, dropping every template inside them (619 real templates
  reached vs 1,336 in the UI ≈ 25.6 per subfolder — same bug class as the scorecard
  measures flatten). Limitation notes in the operating model and setup Phase 4 updated:
  ghost rows have no id and must be skipped (upsert-batch already skips them), and the
  gap is a CLI flatten bug layered on the `source=COMMS` scope. Pending UI validation
  of subfolder contents on the live tenant.

## 0.9.3 — 2026-07-09

- **Documented hardcoded scope filters in CLI list endpoints** (seventh live-E2E
  finding): several list commands can never see the whole tenant because scope filters
  are baked into the CLI's artifact manifests with no flag to lift them — verified in
  `journey.json` 1.0.4: `jo email templates` queries `/v1/journey/assets?source=COMMS`
  (live tenant: 647 of 1,336 UI templates reachable), `jo surveys list` hardcodes
  `states:["PUBLISH"]` (closed surveys invisible; an all-closed tenant lists 0),
  `jo data-designer list` pins `ds=UNIVERSAL_DATA_SET`, and Data Designer *designs*
  have no list command at all. Reported totals are post-filter, so
  `returned == totalAfterFilters` proves paging completeness only. Phase 4 now
  annotates these domains as "CLI-reachable subset", records UI-vs-CLI gaps in
  `<slug>/overview.md` instead of chasing them, and the operating-model "Known CLI
  issues" section carries the limitation for ad-hoc use (weird email/survey counts now
  have a citable explanation). Upstream asks filed with Gainsight separately.

## 0.9.2 — 2026-07-09

- **Index coverage evidence: `domains_indexed`** — an indexed-but-empty domain and a
  never-indexed domain used to leave identical manifests (no entries), so a coverage hole
  was indistinguishable from a genuinely empty tenant domain. `upsert-batch` now stamps
  `domains_indexed[domain]` with a timestamp **even when the list result is empty**, and
  `report` returns the map plus a computed `emptyDomains` list ("listed, tenant has
  none"). The Phase 4 relay must now show empty domains explicitly and treat any
  cheatsheet list command missing from `domains_indexed` as not-yet-run. Also pays off in
  refresh: "checked and unchanged" is now distinct from "never checked."

## 0.9.1 — 2026-07-09

- **Crawl modes renamed `basic`/`full` → `shallow`/`deep`** for consistency with the
  `--deep <domain>` flag (shallow crawl → deep ingest). Renamed before any tenant
  recorded a mode, so no migration path is needed; `crawl --set` rejects the old names.

## 0.9.0 — 2026-07-09

- **Tiered documentation: Basic/Full crawl + per-domain flow + `--deep`** (designed with
  the user after the 0.8.7 truncation fix revealed ~2,000 real assets, 1,336 of them
  email templates). Setup's first documentation run asks **Basic or Full crawl?** —
  Basic fully documents domains ≤ 100 assets and writes deterministic metadata-only
  stubs for larger domains (one file per asset from the Phase 4 list payload, zero
  describe calls, zero budget cost); Full describes everything. The choice is recorded
  per tenant (`manifest.mjs crawl`). Phase 5 now processes **one domain at a time**
  (smallest first), with an opt-in pause-and-verify checkpoint after each domain, and
  the exhaustive Phase 4 inventory is a hard gate before any budget is spent.
  Stubbed domains upgrade later via `/gs-superadmin:setup --deep <domain>` (budgeted,
  resumable, per domain) — advertised in the stub files themselves, the completion
  report, and the managed CLAUDE.md block.
- **manifest.mjs**: new `crawl` (get/set crawl mode) and `stub` verbs (stub writing +
  depth-aware marking in one atomic pass; never downgrades a full doc), `mark --depth
  metadata|full` (documented defaults to full), `next --domain` filter and `next
  --upgrade` (stubs awaiting deep ingest). New CI-wired test suite
  `test/manifest-ops.mjs` (16 checks).

## 0.8.7 — 2026-07-09

- **Exhaustive listing in setup Phase 4** (sixth live-E2E finding — silent inventory
  truncation): the first live index captured exactly one default page per list command
  (20–50 items, matching each handler's verified default) and reported 191 assets on a
  tenant with ~2,000+. CLI list commands truncate silently; `jo email templates` fetches
  the full tree server-side then caps client-side at 50 (and has no `--page` flag — only
  `--limit`), though its JSON `pageInfo.totalAfterFilters` reveals the real count
  (as later established in 0.9.3–0.9.5: real count of the *CLI-reachable, post-flatten
  subset* — not of the tenant's library).
  Phase 4 now prescribes: page until a short page (never accept page 1 alone), pass an
  explicit large `--limit` where there is no `--page`, and reconcile captured counts
  against `pageInfo`/`totalRecords`-style fields when the payload carries them. The
  post-index relay now reports per-domain counts, flags any count landing exactly on a
  default page size (20/25/50) as suspect, and asks the user to confirm totals against
  their sense of the tenant before Phase 5 spends budget. Truncation rule also added to
  the operating-model "Known CLI issues" section for ad-hoc listing.

## 0.8.6 — 2026-07-09

- **Opt-in read-lane allow rules** (fifth live-E2E finding — permission-prompt fatigue):
  reads dominate the plugin's workload, but setup configured only the ask lane, so the
  harness prompted for every shell command even though the guard passes reads silently —
  and chunked batching (0.8.5) multiplied the visible prompts. Setup now asks once
  whether to add `Bash(gs-admin:*)` + `PowerShell(gs-admin:*)` to the workspace's
  `permissions.allow` (append-only merge; decline recorded in
  `.gs-superadmin/allow-rules-declined`, never re-asked). This costs no write safety:
  a hook "ask" overrides an allow rule, so mutating/unknown commands still prompt.
  Phase 5's batching guidance now composes chunks as semicolon-chained literal commands
  (allow rules match per chained segment; loop constructs always prompt) with skips
  decided at composition time instead of shell-level `test -f` guards.

## 0.8.5 — 2026-07-09

- **Execution batching guidance for larger documentation budgets** (fourth live-E2E
  finding): a `--budget 50` run batched all describes into one shell loop and was killed
  by the harness's 2-minute default command timeout (SIGTERM) — a ceiling that belongs to
  Claude Code, not the CLI or the plugin. Phase 5 now says: chunk batched describes to
  ~10–15 per shell command, skip output files that already exist (describes are read-only
  and idempotent — interrupted chunks re-run safely), `mark` as each doc is written so
  resume state never trails by more than a chunk, keep describes sequential (parallel
  `gs-admin` processes can hit the 1.0.4 token-refresh race across processes), and
  prefer a per-call timeout raise over global config when one command truly needs longer.

## 0.8.4 — 2026-07-09

- **Scorecard semantics hardened for durability** (follow-up to 0.8.3): Phase 5 now
  detects the payload shape per scorecard instead of assuming rollups — top-level GROUP
  nodes mean recurse `children` for the measures; top-level MEASURE nodes (no overall
  rollup, whose group nodes the one-level flatten drops entirely) mean the measures are
  already flat and measure groups are recovered as distinct `_groupName` values. The
  note is now version-scoped ("verified on CLI 1.0.4"), which puts it on
  `check-stale-facts`' radar so a CLI upgrade forces re-verification, and it states the
  precedence rule for a future fixed CLI: `levelType` and the observed payload win over
  the note. The interpretation rule is also in the operating-model "Known CLI issues"
  section, covering ad-hoc `sc measures` use outside setup/refresh.

## 0.8.3 — 2026-07-09

- **Scorecard doc-generation semantics in setup Phase 5** (third live-E2E finding): the
  first live run reported the measure-group count as the *measure* count (7 for a
  scorecard that actually has 33 measures in 7 measure groups) — the group number came
  out right and the measures went missing, which is the fingerprint of the cause.
  Verified: `getScorecardMeasures` flattens exactly one tree level, so with an overall
  rollup the CLI's top-level "rows" really are the measure *groups* (enriched as if they
  were measures, real measures still nested one level deeper in `children`, `_groupName`
  holding the rollup's display name). Phase 5 now instructs: classify nodes
  by `levelType` (GROUP/MEASURE) recursing `children`, never by position or top level;
  `overallRollup`/`groupRollup` in the list config are enable booleans, not names; KB
  docs state levelType-tallied counts and combine the config row (Phase 4 list output)
  with the measure tree. Refresh's `--document` pass reuses Phase 5, so it inherits the
  fix. Deliberately NOT encoded in the generated cheatsheet/catalog (generated files stay
  pure catalog derivations) nor the conventions pack (org standards, declinable).

## 0.8.2 — 2026-07-09

- **Workaround for a CLI 1.0.4 auth race on `sc measures --id`** (second live-E2E
  finding): the CLI refreshes tokens with no single-flight guard, and
  `sc measures --id` is its only command whose first authenticated call is a concurrent
  fan-out (`Promise.all` — verified as the sole exposed handler in 1.0.4) — past token
  half-life it fails with a false "No stored token found" even though `whoami` shows the
  token valid. Setup Phase 5 (and refresh's `--document` pass, which reuses it) now
  describes scorecards via `sc measures --name '<name>'` (sequential, unaffected), with
  an `--id` retry + tagged-failure path for ambiguous names. New "Known CLI issues"
  section in the operating-model template records the workaround and the general rule
  ("No stored token found" + working `whoami` = this bug class, not a logged-out state)
  — version-scoped so it's rechecked on CLI upgrades.

## 0.8.1 — 2026-07-09

- **Variable-subcommand coaching in the guard** (first live-E2E finding): models batching
  reads as shell loops (`for c in "re rules list" …; do gs-admin --json $c …; done`) hid
  the subcommand from the guard, which fail-closed every iteration onto the generic
  "unrecognized command" approval prompt. The guard now recognizes a subcommand that
  starts as a shell variable/splat (`$c`, `${c}`, `@args`, backtick substitution) and —
  mirroring the pipe lint — denies the first offense per invocation per session with a
  rewrite hint (spell subcommand words literally; variables only in flag values/paths),
  escalating a repeat to a human "ask" that says plainly the prompt is the only gate.
  Approved-anyway variable commands journal fail-closed, as before. New rule stated in
  the operating-model template and cheatsheet header.

## 0.8.0 — 2026-07-06

- **Change journal (SA-2).** The guard hook now also runs on PostToolUse: every executed
  guard-approved (catalog-mutating or unknown) `gs-admin` command is appended to
  `<slug>/changes/JOURNAL.md` with timestamp, operator, command, reported execution
  outcome (failed commands journal as failed attempts), system area (X-2 component
  vocabulary), source Jira ticket + plan file (when run from an approved change plan,
  via the `.gs-superadmin/active-change.json` marker), and a pre-change KB snapshot
  reference. Denied commands never run, so they never appear. Multi-tenant workspaces
  without an active plan journal to `.gs-superadmin/JOURNAL-unattributed.md` rather than
  guessing a tenant. Journaling failures surface a warning — never silent, and never
  retroactively breaking the command. CLI lane only; MCP mutations are not journaled.
- **Ticket trace-back.** `/gs-superadmin:change-request`'s execution step writes/clears
  the attribution marker, appends a plan-completion journal entry (covering the plan's
  catalog-non-mutating authoring commands), and drafts the ticket completion comment from
  the new `references/completion-comment-template.md` (approval-gated, posted via the
  user's own Jira access) — closing the ticket ⇄ change loop from both ends.

## 0.7.0 — 2026-07-02

- New `/gs-superadmin:change-request` skill (SA-1): turns a change request (Jira ticket
  with request-event handoff block, request-event JSON, or pasted text) into a reviewable
  implementation plan — KB-cited impact analysis, convention-checked names, risk notes,
  exact command sequence with test-mode verification, rollback. Vendors the frozen
  request-event schema + Jira ticket anatomy from `BradleyDB/CS_GTM_Tools`.

## 0.6.1 — 2026-06

- Review fixes: `stag` sandbox token regression, environment backfill in refresh, CI step
  order, generated-banner key.

## 0.6.0 — 2026-06

- Multi-instance (sandbox + production) hardening: per-manifest `environment` recorded at
  setup, production warnings in the guard prompt, instance-switch guidance.

## 0.5.0 — 2026-06

- Opt-in build-standards pack (`.gs-superadmin/conventions/`) + `/gs-superadmin:audit`
  and `/gs-superadmin:deprecate` skills.

## 0.4.0 — 2026-06

- Pipe-safety lint in the guard (unquoted `|` in Gainsight asset names); PowerShell tool
  covered alongside Bash.

## 0.3.0 — 2026-06

- Stale-catalog fail-open closed (workspace catalog regenerated on CLI drift); manifest
  state moved to `scripts/manifest.mjs`.

## 0.2.0 — 2026-06

- Deny-rules replaced with the catalog-driven ask guard (PreToolUse hook +
  `permissions.ask` for MCP tools).

## 0.1.0 — 2026-06

- Initial scaffold: setup/refresh skills, per-tenant KB workspaces.
