# gs-superadmin bug rounds, September 2026 — Build Plan v1 (Builder-session Handoff)

*Self-contained handoff for a fresh session (any model). v1 written 2026-09-11 after
Bradley's review of the round plan; supersedes nothing.*
*Background for HUMANS: the bus (`dev/FEEDBACK.md`) and the GitHub issues carry the full
findings. Executor sessions read the bus SECTIONS named in their work items and the issue
bodies named there — never the whole bus history, never this plan's authoring
conversation (it is gone).*

---

## Context for the executing agent (read first)

This repo is the knowledge base for the `gs-admin` CLI plus the **gs-superadmin** Claude
Code plugin (`plugins/gs-superadmin/`), which bootstraps per-tenant Gainsight workspaces:
setup indexes a tenant's assets into a manifest, describes them into a KB, and synthesizes
relationship maps; refresh, deps-report, email-report, audit and deprecate read that KB. The
plugin is hand-maintained Node (built-ins only, no `npm install`) with fixture suites under
`plugins/gs-superadmin/test/`. The repo runs the **/dev-loop** builder/tester workflow: a
builder session fixes findings on a branch off `dev`, hands off with a token, and a tester
session loaded from the working tree issues the verdict of record.

| Repo | Owner | What it is today |
|---|---|---|
| `<repo>` (BradleyDB/gs-admin-cli-docs, public) | Bradley | plugin 0.38.0 staged on `dev` (0.37.0 released; 0.37.1 and 0.38.0 unreleased). Read `CLAUDE.md` then `AGENTS.md` before touching anything — several files are generated (table in AGENTS.md). CLI pinned at 1.0.9. |
| Consumer workspace `<workspace>` | Bradley | two tenants indexed (a sandbox and a prod). Tester sessions run here with `claude --plugin-dir <repo>\plugins\gs-superadmin`. Builder sessions read its manifests locally for design facts and never write to it. |

**House rules (follow them):**
1. **Branch off `dev`, PR to `dev`, never `main`** (CLAUDE.md; a local pre-push hook
   refuses main). Releases are the maintainer's ceremony, not any executor session's.
2. **The bus is the record.** Every finding fixed gets its section flipped `OPEN → FIXED`
   with a `Fix:` note that names the CLASS behind the instances, a `Judge:` line (what
   decides correctness independently of the fixer — an oracle, a differential, the
   tester's live arm), and, when it names a `Class:` from `build/defect-classes.mjs`, a
   `Sibling sweep:` line. `build/check-stale-facts.mjs` refuses a FIXED section that
   names a class without those lines. Never edit tester-authored text; append below it.
   A transition landing on an unmerged branch is announced in a bus comment ON `dev`
   (branch + PR number), re-stamped when statuses change (bus header, Round-assessment hint).
3. **Hand off, don't just PR.** A round ends with `dev-utils handoff --branch <branch>`
   (mints the `hb-<date>-<nn>` token into the bus `Under test:` line and the dev-canary
   skill, one commit) plus a `--blind-spots` sentence naming what the round could not
   measure; live checks the builder cannot run are banked in `dev/VALIDATION.md` keyed to
   that token. The checkout is left ON the branch under test.
4. **Version lives only in `plugins/gs-superadmin/.claude-plugin/plugin.json`** with a
   CHANGELOG entry for any user-visible plugin change (script or skill behaviour). Prose-
   only rounds bump nothing. Staged versions fold at release.
5. **Never run `gs-admin login`, `config`, or any mutating command against a real tenant
   or the real `~/.gs-admin/`** (AGENTS.md). Build against the fixture suites; read the
   consumer workspace's `_manifest.json` files for shape facts only.
6. **Don't guess on design (Bradley, 2026-09-11).** Each work item lists its OPEN
   DESIGN QUESTIONS with the planner's recommendation. The executor settles them with the
   user at kickoff (AskUserQuestion, one call) BEFORE writing code — and records the
   ruling in the As-shipped note. A ruling the user already made is marked *(ruled)*.
7. **Severity has teeth** (/dev-loop Proportionality): an OPEN `high` finding blocks every
   feature-branch merge — F-449 (Session A) must be VERIFIED before B–E merge. `polish`
   findings ride a substantive round and never get their own ceremony.
8. **Generated vs hand-maintained** (AGENTS.md table): `plugins/gs-superadmin/reference/`
   and `scripts/{extract-catalog,render-cheatsheet}.mjs` are generated — edit the
   generator, never the output. Skills, hooks, templates, scripts (the rest), and tests
   are hand-maintained. `npm run build` must reproduce committed output (CI diffs it).
9. **Rung discipline** (AGENTS.md § Review-gate rules, shared-prose table): a rule goes to
   the highest rung that fits — remove the cause, enforce in a hook, put it in a script,
   then one session-global doc, then checked copies, then paraphrase-plus-pointer. Adding a
   second prose copy of an existing rule is never a fix (F-453 measured this).
10. **Skill prose is executed by an LLM** (AGENTS.md § Writing skills): fenced blocks are
    literal output; every placeholder has a substitution rule; bulk JSON goes through
    scripts and files, never model context.

## Work items

IDs: `EX-*` Phase 4 decisions, `DB-*` describe loop, `RP-*` report/manifest truth, `FH-*`
fact homes, `DC-*` prose, `GD-*` guard, `BL-*` backlog. Each item: **What / Purpose /
Value / Build notes / Done when / Open design questions.**

### Phase 1 — Phase 4 decisions bound to evidence (Session A — DONE in the planning session)

#### EX-1 · F-449: exclusion verdict bound to the overlap check's numbers *(foundation — shipped)*
- **What:** `manifest.mjs exclude` takes exactly one of `--check <file>` (written by the new
  `domain-candidates.mjs check --out <file>`) or `--no-check "<why>"`; `--covered-by <domain>`
  is the coverage claim, refused unless every unique id is indexed under that one domain,
  and a check proving that is refused without the flag; `--recheck-after` on exclusions; the
  diff reports `kind` (coverage | judgment | legacy), the evidence, and `recheckDue`.
- **Purpose:** the wrong-answer surface in deps-report (buried assets read "nothing depends
  on this") came from a prose rule the model executed; the rule now lives in the verb.
- **Value:** `high` on the bus — blocks every other merge until VERIFIED.
- **Build notes:** shipped on branch `f449-evidence-bound-exclusions`; see the bus F-449
  Fix/Judge lines and `dev/VALIDATION.md` § F-449 for the live arm.
- **Done when:** tester round verdict VERIFIED (live arm: the sandbox's `report list-objects`
  re-decided through the new verb; step 4 of the banked check exits 1 on fresh numbers).
- **Open design questions:** none — *(ruled 2026-09-11, Bradley)* the journey-data-designer
  instance: the rows are Data Designer output datasets (data management; listed under
  journey because a program can source from one); `jo data-designer get` is a strict subset
  of `dm objects describe`, measured on the sandbox KB. Prod's coverage exclusion was
  right; the sandbox's re-decision through the ACCEPT path is banked in
  `dev/VALIDATION.md` (second F-449 section) and rides Session A-V.
- **As shipped (A, 2026-09-11):** as described in What; plugin 0.38.0; contract T-2
  (GsExclusion) extended in manifest.mjs's header and pinned by
  `test/contract-conformance.mjs`. Adoption (`upsert-batch`) is NOT bound to the check —
  recorded as the sibling, not closed (would touch Phase 3's first-time indexing).

### Phase 2 — the describe loop and its fences (Session B — highest new-user value)

#### DB-1 · #10: `{page}` placeholder eaten by PowerShell in nine capture fences
- **What:** every `capture.mjs --paginate` fence in the skills spells `--out …-{page}.json`
  unquoted. Windows PowerShell 5.1 drops everything from the brace (measured 2026-09-11:
  argv arrives as `.gs-superadmin/tmp/audit-rules-`); single AND double quotes both
  preserve it, and single quotes are also correct in bash. Quote the placeholder
  uniformly in all nine fences: `audit/SKILL.md` (2), `deprecate/SKILL.md` (4),
  `email-report/SKILL.md` (1), `refresh/SKILL.md` (1), `setup/SKILL.md` Phase 4 (1).
- **Purpose:** the first Phase 4 command a Windows newcomer runs fails otherwise.
- **Value:** rank 1 new-user deterrent; a `bug` + `good first issue` on GitHub.
- **Build notes:** one fact in nine places — apply the same quoting form to all; run
  `build/sweep-fence-grammar.mjs` and `build/check-doc-drift.mjs` after (a check may pin
  fence shapes). No CI executes skill prose: the judge is a real PowerShell run of one
  fence (`node -e "console.log(process.argv.slice(2))" -- --out '…-{page}.json'` proves the
  shell side; a fake `--bin` proves capture's substitution). Close issue #10 from the PR
  body (`Closes #10`).
- **Done when:** `grep -rn -- "-{page}" plugins/gs-superadmin/skills` shows every hit inside
  quotes; a PowerShell 5.1 run of one fence writes one file per page.
- **Open design questions:** none — *(ruled)* single quotes, measured.

#### DB-2 · F-456: read-verb gate keys on the path's trailing noun, refusing `cn chain`
- **What:** `describe-batch.mjs:295` `isReadVerb` tests the resolved path's LAST WORD; the
  shared gate (`doc-lib.mjs` `assertReadOnlyCommand`, ~line 1830) already passes the
  catalog entry as the predicate's second argument. Change the predicate to test
  `matched.actionKey` when present (`describe-job-chain` passes on its own merits), falling
  back to the trailing word for hand-trimmed catalogs that carry no actionKey. `capture.mjs`
  composes the same gate and inherits the fix. Add a test that sweeps EVERY catalog
  command whose actionKey starts with `describe` (and every recorded describe lane shape)
  through the predicate, so a refused per-item read is named by the suite, never
  discovered mid-run.
- **Purpose:** a catalog-declared per-item read is refused, and both sanctioned capture
  paths refuse it, leaving no legal route to document the domain (bus F-456, third note).
- **Value:** rank 3; every tenant with connectors has this lane.
- **Build notes:** do NOT key on `mutating: false` (F-456 explains: two upstream mislabelled
  writers). `READ_VERB_EXACT` stays as the composed allowlist; it simply stops being
  load-bearing for describe-* actions. The tester measured the blast radius at this pin:
  exactly one of eighteen recorded lanes (`cn chain`). Fixture: `test/describe-batch.mjs`
  already refuses `re r frobnicate` and admits `re r describe`; add `cn chain` with a
  workspace catalog entry carrying `actionKey: "describe-job-chain"`, and a trimmed-catalog
  entry (no actionKey) to pin the fallback.
- **Done when:** `cn chain --id {id}` is admitted by describe-batch AND capture; the catalog
  sweep test passes at 1.0.9 and would name any future refusal; F-456 flipped FIXED with
  `Judge:` = the sweep over the shipped catalog plus the tester's live deep-ingest of the
  connectors-chains lane with no manual fallback.
- **Open design questions:** none — *(ruled by the tester's amendment)* argument change,
  not new matching.

#### DB-3 · #13: abort a domain after 5 consecutive retryable failures
- **What:** in `describe-batch.mjs`'s per-entry loop (~line 624), count consecutive
  `markFailed` outcomes of the RETRYABLE classes (timeout, transport, unexpected output —
  the classes already marked `failed`); a success resets; PERMANENT gaps (the
  `FIELD_NOT_FOUND` class, non-blocking, entry still documented) do not count; budget
  exhaustion is not a failure. At 5, break the loop, leave every mark exactly as written,
  and report `aborted: { after: 5, reason: "<last error>" }` in the summary, distinct from
  `budgetExhausted` and from normal completion; `moreRemaining` stays true.
- **Purpose:** a dead token or a wrong `describeCommand` otherwise spawns through the whole
  asset list (a live run: 17 consecutive token-expired failures, all marked `failed`).
- **Value:** rank 2 with DB-4; routine for any tenant whose ingest exceeds 30 minutes.
- **Build notes:** the skill's stop rule (`setup/SKILL.md` ~line 529) is the BETWEEN-
  invocation rule and stays; add one sentence that the script enforces a within-run limit
  and the summary names an abort. Designer doc-mode has its own drilldown budget — the
  counter is per top-level entry outcome, not per drilldown spawn. Fixtures: every-describe-
  fails must stop after exactly 5 spawns (count them via the fake CLI's recording); 4
  failures then a success must run to completion (the boundary). Close issue #13.
- **Done when:** both fixtures pass; an aborted summary and a budget-exhausted summary are
  distinguishable by field, and the skill prose quotes the field.
- **Open design questions:** (a) *(recommend yes)* 5 is the limit named in the issue; keep
  it a constant, not a flag. (b) See DB-4 for the auth class — decide the two together.

#### DB-4 · F-458: a deadline-ended batch records that fact distinctly from a describe failure
- **What:** the CLI's token-expiry error is ONE literal thrown from
  `dist/core/auth/index.js` in the installed 1.0.9 package: `Token expired and silent
  refresh failed (<cause>). Run gs-admin login to re-authenticate.` Classify a spawn whose
  stderr/stdout matches the leading phrase as an AUTH death: do not mark the entry (it
  keeps its status, like the budget-exhaustion path), stop the loop immediately, and
  report `aborted: { reason: "auth", … }` in the summary. Pin the phrase as a constant
  with a stale-facts tripwire naming the CLI file (the pattern `FIELD_NOT_FOUND` already
  uses). Second half, prose: the batch-sizing paragraph (`setup/SKILL.md` ~lines 519–527)
  names the binding deadline as whichever is nearest — the harness shell timeout OR the
  token's usable life (Phase 1's pre-flight: `remaining − 1800s`) — and says to size
  against the SLOW end of observed rates because a small sample under-predicts (measured:
  2.36 s/asset over 25, 3.09 over 311).
- **Purpose:** `failed` should mean "the CLI could not describe this asset", never "the
  run ended while this asset was in flight"; 17 healthy assets carried a wrong durable state.
- **Value:** rank 2; independent of which deadline is binding.
- **Build notes:** the two mechanisms are the same loop branch — build DB-3 and DB-4 in one
  change with one summary shape: `aborted: { reason: "auth" | "consecutive-failures",
  after: <n>, lastError: <printable> }`. Entries already marked before the abort stay
  marked (they were real describe failures) — except under an auth death nothing is
  marked. Fixture: fake CLI emits the exact literal on stderr with exit 1 after N
  successes → summary aborted.reason auth, the entry unmarked, `domainProgress` unchanged.
- **Done when:** fixtures pass; F-458 and #13 flipped/closed with `Judge:` = the tester's
  live arm running one batch past the token half-life and reading the summary + manifest.
- **Open design questions:** (a) *(recommend: abort on FIRST sighting, no mark)* an auth
  death is systemic, and every describe after it fails identically — counting it toward
  5 would write up to 5 wrong marks. (b) *(recommend: one `aborted` object with a reason
  enum)* rather than two booleans, so the skill branches on one field. (c) Whether a
  stderr match is enough or the exit code must also be non-zero — read the CLI's top-level
  error handler to answer; do not assume.

### Phase 3 — the report is the account of state (Sessions C1 and C2)

#### RP-1 · F-455: `manifest.mjs report` carries depth, so "documented" stops reading as "complete"
- **What:** add a per-domain and total breakdown derived from the `depth` the manifest
  already stores: `byDepth` = `{ full, metadata, listOnly, unrecorded }` where a `metadata`
  entry in a domain whose recorded `describeCommand` is the `none` sentinel counts as
  `listOnly` (complete by definition), a domain with NO describeCommand recording (legacy
  stamps — five on the sandbox manifest) counts as `unrecorded` (completeness unknown,
  never assumed), and entries with no `depth` (pending/stale, never documented) are
  reported under their status, not a depth. Then every skill statement that documentation
  is complete or a domain is fully ingested derives from ONE quoted `report` invocation at
  a quiescent point (`setup/SKILL.md` Phase 5 close, Phase 6 precondition, `--deep` relay;
  `refresh/SKILL.md` its close).
- **Purpose:** the user was told the deep crawl was finished while eight domains were
  entirely stubs; the report contained no fact that could contradict the claim.
- **Value:** rank 4; the completion signal is what the user acts on.
- **Build notes:** measured facts (2026-09-11): prod carries `depth` on all 5,076 entries and
  `describeCommand: "none"` on all six list-only domains; the sandbox has five legacy
  stamps with no describeCommand and pending/stale entries with no depth. The "list-only
  (complete)" vocabulary already exists in `manifest.mjs`'s stub verb (F-334/F-346) — reuse
  it. Phase 6's "stubs count as documented" precondition is deliberate and stays.
  Fixtures: `test/manifest-ops.mjs` report section; add a manifest with all four states.
- **Done when:** report over the fixture reads the four states per domain; over the real
  prod manifest (local read) every list-only domain reads `listOnly`, none reads `metadata`;
  each named skill site quotes `byDepth` rather than narrating.
- **Open design questions:** *(recommend the four-state shape above)* whether `unrecorded`
  should instead be folded into `metadata` — no: that is the F-346 false-complete class.

#### RP-2 · F-454: relayed domain count disagrees with the manifest's
- **What:** report emits explicit `domainCounts: { indexed, withAssets, empty }` (the
  sandbox reads 18 / 17 / 1 with `journey-surveys` empty); the Phase 4 relay quotes
  `indexed` and names `emptyDomains`.
- **Purpose / Value:** `polish` — a reporting discrepancy; rides Session C1.
- **Build notes:** the relay counted `byDomain` keys. Two fields, one prose line.
- **Done when:** fixture with one empty domain reads 2/1/1; relay prose quotes the field.
- **Open design questions:** none.

#### RP-3 · F-451: dateless entries are invisible to change detection, silently
- **What:** three measured shapes: (i) a domain recorded `dateField: null` (recorded-none) —
  on prod five domains, 2,362 of 5,076 entries; (ii) a recorded date field under which every
  entry is null (sandbox `journey-data-designer`, 69 — the field resolves to nothing on
  rows; newer upsert guards refuse to RECORD this, legacy stamps carry it); (iii) entries
  registered by the recovery path with no name and no date under a recorded field
  (sandbox `journey-email-templates`, 557 of 1,180). Report emits per domain
  `changeDetection: "date" | "none"` and `datelessEntries: <n>`; refresh's report names
  every domain with `none` and every count of dateless entries under a recorded field as
  "not checked for change this run" — never silence.
- **Purpose:** the KB looks current and is not; the refresh report must say what it could
  not check.
- **Value:** rank 6; nearly half of prod's inventory sits outside change detection.
- **Build notes:** honest statement only in this round; fingerprint-based staleness (re-
  describe with `--if-changed`) is BL-2 territory and is NOT built here. `refresh/SKILL.md`
  lines ~119–165 carry the date-field mechanics; add the relay sentence beside step 1's
  report read. Fixtures: one domain recorded-none, one with null dates under a recorded
  field, one healthy.
- **Done when:** report over the fixture reads the three shapes; refresh prose quotes the
  fields; F-451 FIXED with `Judge:` = report over both real manifests (local) reproducing
  the counts in the bus entry (prod report 1754, sandbox templates 557).
- **Open design questions:** *(ruled 2026-09-11, Bradley: honest statement now)* none open.

#### FH-1 · F-450: three facts stored at the wrong scope — one decision per kind of fact
- **What:** (a) `.gs-superadmin/CONVENTIONS.md` is declared tenant-specific but read at
  workspace scope (`jo-report-deps.mjs:188`, `deps-report/SKILL.md:60`); (b) required-flag
  exclusions (`re rules events/executions/s3-tasks/schedules`, the `sources fields` pair)
  are per-CLI-version facts stored per tenant — both tenants re-derived the identical set;
  (c) scope limits (`jo email templates` flattens one folder level, hides some templates;
  `jo surveys list` PUBLISH only; `jo data-designer list` one dataset type) exist only as
  prose in `setup/references/index-scope-notes.md`, so the manifest presents a scope-
  limited count as complete.
- **Purpose:** readers derive each fact from its one home instead of three placements.
- **Value:** rank 4 cluster with RP-4; the second tenant is where these went live.
- **Build notes (measured 2026-09-11):** for (b), the catalog does NOT declare a required
  flag for the four `re rules …` sublists (they fail at runtime) — derivation from the
  catalog is impossible; the `sources` pair DO declare `type[enum]` and the existing
  `requiredEnumFlags` path already handles them. So (b)'s home is a plugin-shipped,
  per-pin list keyed by actionKey (a `const` in `domain-candidates.mjs` or a small JSON
  the diff reads), with a check-stale-facts tripwire at CLI adoption, and the diff marks
  those candidates "not enumerable bare — needs a per-item flag" WITHOUT a tenant decision.
  For (c), a `scope` field on the domain stamp written by `upsert-batch --scope <key>`
  where the key names a section of index-scope-notes.md (the canon stays prose; the stamp
  is the pointer), read by `report` and by the Phase 4 relay (RP-4). For (a), see the
  question. Also measured: `connectors-chains` records a date field on the sandbox and
  none on prod at the same pin — one recording is wrong; name it in the Fix note as the
  same class and fix the recording rule if the cause is in upsert-batch.
- **Note (from A, 2026-09-11):** `index-scope-notes.md` says which data-management objects
  are Data Designer outputs is "not determinable from CLI data". `jo data-designer list`
  IS that determination for the status it filters on (measured: its rows are the DD
  output datasets, keyed by objectName, all present in data-management). Correct the
  note under (c) and say the list is a membership signal, not a domain.
- **Done when:** each of (a)(b)(c) has one home; the diff on both real manifests (local)
  shows the four `re rules` sublists as not-enumerable without a per-tenant exclusion; the
  stamp's `scope` round-trips through report; F-450 FIXED as ONE entry (all three instances).
- **Open design questions:** (a) *(recommend: `<slug>/CONVENTIONS.md` per tenant, with the
  workspace file as fallback and a one-time notice when the fallback is used)* vs. keeping
  the workspace file with per-tenant sections. (b) *(recommend the per-pin list above)*
  vs. leaving per-tenant exclusions and accepting re-derivation. (c) *(recommend the stamp
  field)* — confirm the key grammar with the user.

#### RP-4 · F-452: the Phase 4 relay asks the user to validate totals that cannot match
- **What:** at the end of Phase 4, the relay names each scope-limited domain (from the
  stamp's `scope`, FH-1c) with its limit and the fact that the remainder can be added
  later, before asking "do these totals look right?".
- **Purpose:** the one question Phase 4 asks the user is unanswerable otherwise.
- **Value:** rank 4; depends on FH-1c, so it rides Session C2.
- **Build notes:** `setup/SKILL.md` ~lines 428–436 (the relay); the words come from the
  scope note section the stamp points at — paraphrase-plus-pointer, never a second copy.
- **Done when:** the relay fence/prose quotes report's scope field; F-452 FIXED.
- **Open design questions:** none beyond FH-1c.

### Phase 4 — prose and one message (Session D — may ride B or C instead of standing alone)

#### DC-1 · F-457: `--deep` and Phase 6 do not state their boundaries
- **What:** (a) `--deep <domain>` says whether Phases 3–4 re-run before Phase 5. (b) Phase 6
  states that domains outside the five lanes (`rules-engine`, `rules-engine-chains`,
  `scorecard`, `journey`, `journey-email-templates`) do not affect the maps, and names where
  a non-lane deep ingest pays off (`deps-report`).
- **Purpose:** four `--deep` runs improvised the same deviation; several login cycles went
  to deep-ingesting a non-lane domain to improve maps that came back byte-identical.
- **Value:** rank 7; prose only.
- **Build notes:** `setup/SKILL.md` lines ~20 (flag doc), ~168 (Phase 4 "runs every time"),
  ~478 (`--deep` runs), ~554–575 (Phase 6). The lane list is data in doc-lib's
  `RECORDED_LANES` — point at it, do not copy it.
- **Done when:** both statements present; tester walk of setup `--deep` once.
- **Open design questions:** (a) *(recommend: `--deep` goes straight to Phase 5 unless the
  domain's list stamp `at` is older than report's `lookback` window, in which case it
  re-lists THAT domain only)* vs. always straight to Phase 5.

#### DC-2 · F-453: the guard's repeat-offense ASK omits the remedy the DENY names
- **What:** `hooks/gs-admin-guard.mjs` ~line 1748 (the ask text on a repeated shell-
  variable subcommand) gains the same remedy sentence the deny at ~1758 already carries:
  "spell the domain/group/command words literally; variables belong in flag values and
  paths". The deny message is already correct and pinned (`test/guard-fixtures.mjs:401`).
- **Purpose / Value:** `polish`; the tester's own amendment found the rule IS documented
  and the deny names it; only the ask variant does not.
- **Build notes:** one sentence; add a fixture asserting the ask text carries "spelled
  literally" on the repeat path. No version bump if it rides a bumping round.
- **Done when:** fixture pins it; F-453 FIXED.
- **Open design questions:** none.

#### DC-3 · #1: AGENTS.md § Review-gate rules gains the work-ordering bullet
- **What:** one bullet: a finding whose fix removes an unreliable manual step is worked
  before the next change that performs that step by hand and before any tester handoff,
  regardless of severity label; nothing is handed to a tester while a known-pending change
  will re-arrange what is verified. Say it is not mechanically checkable.
- **Purpose / Value:** enhancement; the rule was learned at 0.30.0 and lost with the
  private bus.
- **Build notes:** AGENTS.md § Review-gate rules (~line 311). Close issue #1.
- **Done when:** bullet present; `build/check-doc-drift.mjs` green.
- **Open design questions:** *(recommend AGENTS.md only)* whether the maintainer's dev-loop
  skill also carries it — that skill is outside this repo; note it in the PR body instead.

### Phase 5 — the mutation guard (Session E — its own round; the guard has rule-5 history)

#### GD-1 · #2 items 1–3: one shared word-normalizer; assignment-prefixed interpreters and positional pwsh
- **What:** `normalizeProg` (`gs-admin-guard.mjs:961`) and `isGsAdminWord` (:264) are two
  independent normalizers; the assignment strip (`ASSIGNMENT_PREFIX`, :263) lives in only
  one, so `$x=bash -c '…'`, `$x=eval`, `$x=iex`, `$x=powershell "…"` are silent while
  `$x=gs-admin …` asks. Unify on ONE normalizer (item 3), then the pwsh positional branch
  tries the `-Command` flag path first and falls back to positional only when no command-
  string flag is in the segment (item 1); item 2 closes with 3.
- **Purpose:** silent misses on the safety surface, measured by mutation.
- **Value:** `normal`; not a newcomer path, real debt.
- **Build notes:** the judge is `test/guard-oracle.mjs` — REAL bash and REAL PowerShell
  run generated command lines through a recording shim and hold the guard to
  "executed ⇒ guarded". Add the assignment-prefixed interpreter shapes and the positional-
  then-`-Command` shape to its generator so the oracle, not a hand list, judges (bus rule:
  the fixer cannot judge the fixer's completeness). Read the F-436/F-441/F-443 history in
  `build/defect-classes.mjs` (`name-spelling`, `second-scanner`) — this IS the
  `second-scanner` class, and a second reopen would demand a `Redesign:` line.
- **Done when:** the oracle's new generated shapes pass; the pre-fix guard fails them (run
  the suite against `git stash` to prove the mutation); issue #2 items 1–3 closed by comment.
- **Open design questions:** none — the issue's recommended order (3, then 1/2) stands.

#### GD-2 · #2 item 8: a cross-rule combination matrix
- **What:** fixtures combine already-fixtured rules (braces × assignment × eval/iex ×
  positional pwsh × option-after-flag) instead of testing each in isolation.
- **Purpose:** items 1 and 2 were found in minutes by combining fixtured rules.
- **Value:** `polish`; rides Session E.
- **Build notes:** home is the oracle's generator (it already composes nestings, chains,
  quoting); a matrix over the guard-fixtures stdin cases is the fallback.
- **Done when:** the matrix runs in CI; count of combinations named in the PR.
- **Open design questions:** *(recommend the oracle)* fixtures vs oracle as the home.

#### GD-3 · #2 items 4–7: check 11 brittleness
- **What:** `build/check-doc-drift.mjs` check 11 (~line 1271): the universal-pin-claim test
  matches one literal phrase; the anchor is located twice with different patterns; the
  residual block ends at the first non-`>` line; the block starts AT the anchor.
- **Purpose / Value:** `polish`; low, from reading not probing — verify each by
  constructing the input before fixing.
- **Build notes:** `build/test-check-doc-drift.mjs` is the fixture home; add one fixture per
  item that fails before and passes after; drop any item that does not reproduce and say so.
- **Done when:** reproduced items fixed with fixtures; non-reproducing ones closed with the
  measurement.
- **Open design questions:** none.

### Backlog — defined, not scheduled (need design + live measurement first)

#### BL-1 · #11: recover list-invisible email templates from program payloads in the KB
- **What:** a pass that extracts template ids from program describe payloads, diffs them
  against the `journey-email-templates` inventory, and registers the unmatched via
  `upsert-batch --partial`; update index-scope-notes.md's "do not chase it" instruction.
- **Value:** on the mature workspace 557 templates (47% of the domain) exist only because
  of a hand recovery in July; 400 of 400 sampled ids appear in program docs.
- **Build notes:** runs after Phase 5 (needs journey deep-ingested). Recovered entries
  carry `name: null`, `modified_date: null` (measured) — RP-3's dateless statement covers
  them; a recovery pass should backfill `name` from the payload when it is there.
- **Open design questions:** whether one transitive pass covers surveys and data-designer
  datasets too (program nodes reference them the same way) — UNMEASURED; the live
  measurement is a local grep of the journey docs for ids from one `jo surveys list`
  capture. Settle before building.

#### BL-2 · #12: deep-ingest performance — concurrent describes, in-process and batched marks
- **What:** bounded worker pool over describes (N flag, backoff on 429), marks in-process
  instead of spawning `manifest.mjs`, batched marks with a reconcile-on-resume step (scan
  `<slug>/<domain>/*.md` against the inventory and mark what is already written).
- **Value:** a full ingest is ~2 hours across 4–5 re-logins; the goal is one token life.
- **Build notes:** single writer, in-order domain completion with at most two domains in
  flight (issue comment), `--budget`/`--all` semantics unchanged. **BL-2a, the reconcile-
  on-resume step, is standalone and safe and may be built first.**
- **Open design questions:** rate limits per service vs per tenant (unmeasured; probe at
  N=4 on the sandbox only, never prod); concurrent token refresh behaviour (unmeasured).

---

## Handoff protocol (how to run this plan)

**The plan file is the interface — never hand off a chat transcript.** Each session starts
fresh in the repo checkout, reads this file (including the Session ledger), and is named
its work-item IDs. The bus sections and issue bodies an item names are the item's spec;
the rest of the bus is history and is not loaded.

**Build vs. validate.** Every item here is buildable offline against the fixture suites and
local reads of the consumer workspace's manifests. What needs a live tenant is the
tester's verdict round (the `*-V` rows): the builder banks each live arm in
`dev/VALIDATION.md` keyed to the handoff token, and the tester session runs it.

**Session map** — one session ≈ one row:

| # | Items | Repo / where | Live needed to build? | Session output |
|---|---|---|---|---|
| A | EX-1 | repo (DONE 2026-09-11) | No | PR to dev, handoff token, VALIDATION § F-449 |
| A-V | verify EX-1 | consumer workspace, plugin from the working tree, sandbox logged in | YES (sandbox reads) | F-449 VERIFIED or REOPENED; fresh numbers on the bus |
| B | DB-1, DB-2, DB-3, DB-4 | repo | No (PowerShell 5.1 locally for DB-1) | PR to dev, token, VALIDATION arms for DB-2/DB-4 |
| B-V | verify B | consumer workspace | YES (a deep ingest of the connectors-chains lane; one batch past the token half-life) | verdicts on F-456, F-458; #10, #13 confirmed live |
| C1 | RP-1, RP-2, RP-3 | repo | No | PR to dev, token |
| C1-V | verify C1 | consumer workspace | No tenant call needed (report over the real manifests; walk setup/refresh once) | verdicts on F-455, F-454, F-451 |
| C2 | FH-1, RP-4 | repo | No | PR to dev, token |
| C2-V | verify C2 | consumer workspace | YES if the scope stamp is backfilled by re-listing | verdicts on F-450, F-452 |
| D | DC-1, DC-2, DC-3 | repo | No | PR to dev (prose + one message); may ride B or C |
| D-V | verify D | consumer workspace | No | verdicts on F-457, F-453; #1 closed |
| E | GD-1, GD-2, GD-3 | repo | No (real bash + PowerShell locally for the oracle) | PR to dev, token |
| E-V | verify E | consumer workspace | No | #2 closed by comment with the oracle's counts |

**Ordering (Bradley, 2026-09-11 — bugs first, by new-user deterrence).** A is done and
A-V comes first because an OPEN `high` blocks every feature merge. Then B (rank 1–3), C1
and C2 (rank 4–6), D, E. D may be folded into B or C2 by whichever builder starts first —
say so in the ledger. Backlog items start only when their open questions are settled.

**Frozen contracts (once any session builds against them).** In this repo a contract is
a typedef in a script's header plus its pin in `plugins/gs-superadmin/test/contract-
conformance.mjs` (T-1 catalog, T-2 manifest, T-3 stub marker, T-4 journal grammar). The
rounds touch T-2 (RP-1/RP-2/RP-3 add report fields — ADDITIVE; FH-1c adds a stamp field)
and the describe-batch summary shape (DB-3/DB-4 add `aborted` — ADDITIVE; the setup skill
branches on it). **Contract-freeze rule:** additive fields ride the round with the typedef
and the conformance pin updated in the same PR. A change that REMOVES or RE-TYPES a field
another skill or script reads is not a tuning edit: stop, report to the user, and record
the change as its own item with every reader named. Never diverge a reader from the writer.
Not frozen: thresholds (the 5-failure limit, lookback days), message wording, prose.

**Session ledger** — the executing agent appends one line per session
(`date · items · branch/PR · token · deferred validations`).

- 2026-09-11 · EX-1 · `f449-evidence-bound-exclusions` → [PR #16](https://github.com/BradleyDB/gs-admin-cli-docs/pull/16) (unmerged) · token on the bus Under test line · 1 deferred validation
  (dev/VALIDATION.md § F-449) · plugin 0.38.0 · open for Bradley: the journey-data-designer
  verdict (EX-1 question).

## Sequencing & deployment options

**Dependency spine:** A → A-V (unblocks merges) → B → B-V; C1 and C2 independent of B;
RP-4 depends on FH-1c (same session); D independent; E independent.

**Per-session checklist for the executing agent:** read CLAUDE.md and AGENTS.md; settle
the item's open design questions with the user before code; branch off `dev`; fixtures
before fix, then the sibling case the tester did not list; run the verbatim battery
(`.github/workflows/validate-plugin.yml` and `docs-drift.yml` step lists) locally;
`claude plugin validate plugins/gs-superadmin`; `npm run build` reproduces committed
output; bus Fix/Class/Judge/Sibling-sweep lines; CHANGELOG + version when behaviour moves;
`/code-review` medium; PR to `dev` unmerged; `dev-utils handoff --branch <branch>
--blind-spots "…"`; bus comment on `dev` naming the branch and PR; ledger line + As-shipped
notes here.
