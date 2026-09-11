# gs-superadmin bug rounds, September 2026 — per-session kickoff prompts

One prompt per session-map row in
[ROUNDS-2026-09-HANDOFF-PLAN.md](./ROUNDS-2026-09-HANDOFF-PLAN.md). Paste the block into a
fresh session opened in the named checkout. `<repo>` is this repo's checkout path and
`<workspace>` the consumer workspace's; substitute both before pasting (real machine paths
are never committed — the instance-data gate refuses them). Build sessions (B, C1, C2, D, E) open in the
repo; verdict sessions (`*-V`) open in the consumer workspace with the plugin loaded from
the working tree. Dependent sessions assume the prior round's PR is merged to `dev` and its
finding VERIFIED — each prompt tells the agent to stop and report if not.

**Ordering:** A-V first (an OPEN `high` blocks every feature merge), then B → B-V, then C1
and C2 (independent of B), D, E. D may be folded into B or C2; say so in the ledger.

**Every build prompt restates:** plan path; scope lock; repo + dependency gate; branch off
`dev`; offline discipline with the fixtures named and live arms banked in
`dev/VALIDATION.md`; settle the open design questions with the user BEFORE code; repo
housekeeping (bus lines, CHANGELOG, version); `/code-review` medium; PR to `dev`
unmerged; `dev-utils handoff`; ledger + As-shipped.

---

## Session A-V — verify EX-1 (F-449) — LIVE REQUIRED (sandbox, reads only)

Open in the consumer workspace: `claude --plugin-dir <repo>\plugins\gs-superadmin`, with the repo checkout ON the branch named on the bus `Under test:` line.

```
/dev-loop recheck feedback. Read
<repo>\dev\handoff\ROUNDS-2026-09-HANDOFF-PLAN.md
(the full file, including the Session ledger). This is verdict session A-V for work
item EX-1 (bus finding F-449) ONLY — do not verify or log anything else; anything
else you notice goes in your report to me, not on the bus.

Hard prerequisite: this session must be loaded from the dev working tree. Run the
canary check per the bus header (the gs-superadmin:dev-canary skill's token must
match the Under test line of dev/FEEDBACK.md in the repo); if it is absent or
stale, stop and tell me. Then `git -C <repo> status -sb` and report branch + dirty
state. Confirm the SANDBOX tenant is the one logged in (gs-admin whoami) and show
me which tenant it is; do not run anything until I confirm. Prod cannot host this
arm — it already adopted the command.

State the pass bar BEFORE measuring: F-449's Fix note claim plus the banked check
in dev/VALIDATION.md § F-449. Run that section's five steps exactly as written
(tenant READS only; the manifest writes are local). The verdict is: step 4 exits 1
quoting the fresh "<matched> of <unique>" numbers → VERIFIED; step 4 exits 0 →
REOPENED (back to OPEN, dated note). Record the fresh numbers; a count different
from 253 of 586 is expected. Also read the manifest afterwards and confirm the
diff reads the new entry as kind judgment/coverage, never legacy. Walk the changed
skill prose once: setup Phase 4 steps 2–3 (the check --out fence and the two
exclude fences) — setup is slash-only, so I type /gs-superadmin:setup when you ask
and you record the first artifact or first ask. Record one guard-wiring line
(issue one catalog-mutating gs-admin command in the scratch workspace, decline the
ask). Ask me what I saw for any prompt — never infer that a prompt rendered.

Write the verdict under F-449 on dev/FEEDBACK.md with `Verdict: VERIFIED @ <token>`
(or REOPENED), the pass bar, the measurements, and the walk; mark the
dev/VALIDATION.md § F-449 check CLEARED with date + token, or leave it OPEN with
what failed. Commit on the branch under test with a [skip ci] bus commit
("bus: F-449 <verdict> — …"). Do not switch branches. Finish by appending one
ledger line to the plan file. Then tell me whether the F-449 gate is clear for
Session B's merge.
```

---

## Session B — DB-1, DB-2, DB-3, DB-4 (the describe loop and its fences)

Open in the repo checkout.

```
Read <repo>\dev\handoff\ROUNDS-2026-09-HANDOFF-PLAN.md
(the full file, including the Session ledger at the bottom for prior-session
state). You are executing work items DB-1, DB-2, DB-3, DB-4 ONLY — do not start
any other items. BL-2 (concurrency, batched marks) is out of scope even though it
touches the same loop; FH-1 and RP-* are Session C.

Repo: this checkout (BradleyDB/gs-admin-cli-docs). Read CLAUDE.md, then AGENTS.md
(generated-vs-hand-maintained table; Writing skills; Testing) first. This session
depends on Session A being merged to dev AND F-449 reading VERIFIED on
dev/FEEDBACK.md (an OPEN high blocks every feature merge): run `git fetch`, check
`gh pr list --base dev`, and grep the bus; if either is not so, stop and tell me.
Create branch `round-b-describe-loop` off dev.

Before writing code, settle the plan's open design questions for DB-3 and DB-4 with
me in ONE AskUserQuestion call (the abort-on-first-sighting auth class, the single
`aborted` object with a reason enum, and whether a stderr match alone classifies an
auth death — read the CLI's top-level error handler in the installed package first
so the question carries the measured answer). DB-1 and DB-2 are ruled; build them
straight away.

Live systems are NOT connected: build to every "done when" verifiable offline —
test/describe-batch.mjs's fake CLI (--bin) for DB-2/DB-3/DB-4 (add: a cn chain
catalog entry with actionKey describe-job-chain, a trimmed entry with no actionKey,
an every-describe-fails run that must stop after exactly 5 spawns, 4-failures-then-
success that runs to completion, and a fake that emits the exact token-expiry
literal on stderr); a catalog sweep test over data/catalog.json for DB-2; real
PowerShell 5.1 on this machine for DB-1. Bank the two live arms (deep-ingest of the
connectors-chains lane with no manual fallback; one batch run past the token
half-life reading summary + manifest) in dev/VALIDATION.md, keyed to the handoff
token, one section per item. Fixtures before fix, and construct at least one
sibling case the finding did not list. The describe-batch summary shape is a
CONTRACT the setup skill branches on: `aborted` is ADDITIVE; do not remove or
re-type budgetExhausted/moreRemaining/failures.

Housekeeping: bus sections F-456 and F-458 flipped FIXED with Fix:/Class:/Judge:/
Sibling sweep: lines (never edit tester text; append); CHANGELOG entry and version
bump in plugins/gs-superadmin/.claude-plugin/plugin.json (this is a behaviour
change); setup/SKILL.md stop-rule and batch-sizing paragraphs per the plan; issue
#10 and #13 closed from the PR body (Closes #10, Closes #13). Run the verbatim
battery from .github/workflows/validate-plugin.yml and docs-drift.yml step lists,
`claude plugin validate plugins/gs-superadmin`, and `npm run build` with a clean
`git diff` afterwards.

Before committing: run /code-review at medium effort on the working diff and fix or
explicitly dismiss every finding, then show me a summary of the full diff. Commit
referencing DB-1..DB-4 and the findings, push, open a PR to dev with gh (body:
per-item purpose/value + the banked live arms). Leave the PR unmerged. Then run
`dev-utils handoff --branch round-b-describe-loop --blind-spots "<the two live
arms>"` (mints the token into the bus and the dev-canary skill), add the bus
comment on dev naming the branch and PR number, and leave the checkout on the
branch. Finish by appending one line to the Session ledger in the plan file and an
"As shipped (B)" note under each of DB-1..DB-4, and give me the A-V-style tester
prompt for B-V with the skills to walk (setup: slash-only; the fences changed in
audit, deprecate, email-report, refresh) listed from the frontmatter census.
```

---

## Session B-V — verify B — LIVE REQUIRED (a deep ingest; one batch past the token half-life)

Open in the consumer workspace with the plugin loaded from the working tree, on the branch the bus names.

```
/dev-loop recheck feedback. Read
<repo>\dev\handoff\ROUNDS-2026-09-HANDOFF-PLAN.md
(full file, including the ledger). This is verdict session B-V for DB-1..DB-4
(bus F-456, F-458; issues #10, #13) ONLY. This is a RE-VERIFICATION round: deliver
the verdict on those, and stop — anything else goes in your report to me.

Canary check first (token on the dev-canary skill must match the bus Under test
line; absent or stale → stop). Report `git status -sb` for the repo. Tell me which
tenant is logged in and wait for my confirmation; either tenant works for this
round. Reads and describe-batch runs only; decline any mutation ask.

State each pass bar before measuring (the finding's repro + the Fix note's claim).
Run the two arms banked in dev/VALIDATION.md for this round: (1) the connectors-
chains lane deep-ingested through describe-batch with the recorded `cn chain`
command and no manual fallback (F-456); (2) one batch sized past the token's usable
half-life, then read the summary's `aborted` object and confirm no entry was
marked failed by the auth death (F-458, #13). Run one paginated capture fence
verbatim in PowerShell (#10). Walk once each changed skill: the user types the
slash-only ones (/gs-superadmin:setup and the others the kickoff lists) and you
record the first artifact or ask. One guard-wiring line. Ask me what I saw for any
prompt.

Write verdicts on the bus (`Verdict: VERIFIED @ <token>` or REOPENED with a dated
note), mark the two VALIDATION.md sections CLEARED or leave them OPEN with what
failed, commit [skip ci] on the branch under test, append a ledger line, and tell
me whether B is clear to merge.
```

---

## Session C1 — RP-1, RP-2, RP-3 (report carries depth, domain counts, dateless honesty)

```
Read <repo>\dev\handoff\ROUNDS-2026-09-HANDOFF-PLAN.md
(the full file, including the Session ledger). You are executing work items RP-1,
RP-2, RP-3 ONLY — do not start any other items. FH-1 and RP-4 are Session C2;
fingerprint-based staleness is BL-2 and is NOT built here.

Repo: this checkout (BradleyDB/gs-admin-cli-docs). Read CLAUDE.md, then AGENTS.md
first. This session depends on Session A merged to dev with F-449 VERIFIED; verify
with git fetch + gh pr list --base dev + the bus, else stop and tell me. It does
NOT depend on B. Create branch `round-c1-report-truth` off dev.

Settle RP-1's one open question with me in a single AskUserQuestion call (the
four-state byDepth shape — the plan recommends it and says why); RP-2 and RP-3 are
ruled. Then build.

Live systems are NOT connected: build against test/manifest-ops.mjs (add a fixture
manifest carrying full / metadata / list-only ("none" describeCommand) / legacy
(no describeCommand) / pending entries, and domains with recorded-none dateField,
null dates under a recorded field, and healthy dates) and against LOCAL reads of
the two real manifests in <workspace>\<slug>\_manifest.json
(read-only; never write there): the prod report must read every list-only domain
as listOnly and none as metadata; the counts in the bus entries for F-451 (prod
report 1754 dateless, sandbox templates 557) must reproduce. The report's output
shape is a CONTRACT (T-2, manifest.mjs header + test/contract-conformance.mjs):
byDepth / domainCounts / changeDetection / datelessEntries are ADDITIVE — update the
typedef and the conformance pin in this PR; remove nothing.

Then the prose: every setup and refresh statement that documentation is complete
or a domain fully ingested quotes ONE report invocation at a quiescent point;
the Phase 4 relay quotes domainCounts and names emptyDomains; refresh names every
domain with changeDetection none and every dateless count as not checked this run.

Housekeeping: F-455, F-454, F-451 flipped FIXED with Fix:/Class:/Judge:/Sibling
sweep: lines; CHANGELOG + version bump; verbatim battery; plugin validate; npm run
build clean diff. /code-review medium, fix or dismiss every finding, show the diff
summary. Commit, push, PR to dev unmerged, `dev-utils handoff --branch
round-c1-report-truth --blind-spots "…"`, bus comment on dev with branch + PR,
checkout left on the branch. Ledger line + "As shipped (C1)" notes. Give me the
C1-V tester prompt (no tenant call needed: report over the real manifests, and the
setup/refresh walks — both slash-only).
```

---

## Session C1-V — verify C1 (no tenant call needed)

```
/dev-loop recheck feedback. Read the plan
(<repo>\dev\handoff\ROUNDS-2026-09-HANDOFF-PLAN.md,
full file). Verdict session C1-V for RP-1, RP-2, RP-3 (bus F-455, F-454, F-451)
ONLY; re-verification round — verdict, then stop.

Canary check; `git status -sb`; no tenant call is needed this round. Pass bars from
each Fix note. Run `manifest.mjs report` over BOTH real manifests in this workspace
and hold the output to the claims: every list-only domain listOnly, the F-454
domain counts explicit (the sandbox reads 18 indexed / 17 with assets / 1 empty),
the F-451 dateless counts named. Walk setup and refresh once (I type the slash
commands; you record the first artifact or ask and decline any mutation). One
guard-wiring line. Write verdicts on the bus with `@ <token>`, commit [skip ci] on
the branch under test, ledger line, and tell me whether C1 is clear to merge.
```

---

## Session C2 — FH-1, RP-4 (where each kind of fact lives; the relay names scope limits)

```
Read <repo>\dev\handoff\ROUNDS-2026-09-HANDOFF-PLAN.md
(the full file, including the Session ledger). You are executing work items FH-1
and RP-4 ONLY — do not start any other items. F-450 is ONE bus entry with three
instances (a)(b)(c): it flips FIXED only when all three have a home.

Repo: this checkout (BradleyDB/gs-admin-cli-docs). Read CLAUDE.md, then AGENTS.md
first (Review-gate rules: "contracts as data", "decisions live where enforcement
lives", the rung table). Depends on Session A merged with F-449 VERIFIED; if C1
has merged, build on it (report already carries the new fields), otherwise do not
wait for it. Create branch `round-c2-fact-homes` off dev.

Settle FH-1's three open questions with me in ONE AskUserQuestion call before any
code: (a) the CONVENTIONS.md home, (b) the per-pin unrunnable-bare list vs per-
tenant exclusions, (c) the stamp's scope key grammar. The plan carries the
measured facts and recommendations — quote them in the question. Then build.

Live systems are NOT connected: fixtures in test/domain-candidates.mjs (the four
`re rules` sublists must read not-enumerable-bare from the shipped list WITHOUT a
tenant exclusion; the enum pair must keep its existing requiredEnumFlags path),
test/manifest-ops.mjs (the scope field round-trips upsert-batch → report),
test/jo-report-deps.mjs (the conventions lookup under the ruled home, with the
fallback notice), and LOCAL read-only runs of the diff over both real manifests
in <workspace>. The stamp
typedef (T-2) gains a field ADDITIVELY — update the typedef and the conformance
pin in this PR. Check-stale-facts must gain a tripwire for the per-pin list at CLI
adoption (the same pattern as READ_VERB_EXACT's version stamp). Bank any live arm
(a re-list needed to backfill the scope stamp on an existing workspace) in
dev/VALIDATION.md. Also name, in F-450's Fix note, the connectors-chains date-field
disagreement between the two tenants as the same class and fix its cause if it
lies in upsert-batch.

Then RP-4: the Phase 4 relay names each scope-limited domain from the stamp's scope
with its limit — paraphrase-plus-pointer to index-scope-notes.md, never a second
copy.

Housekeeping: F-450 and F-452 FIXED with the four bus lines; CHANGELOG + version;
verbatim battery; plugin validate; npm run build clean diff. /code-review medium,
fix or dismiss, diff summary. Commit, push, PR to dev unmerged, dev-utils handoff
with --blind-spots, bus comment on dev, checkout on the branch. Ledger line +
"As shipped (C2)" notes. Give me the C2-V prompt naming whether a tenant read is
needed for the scope backfill.
```

---

## Session C2-V — verify C2

```
/dev-loop recheck feedback. Read the plan (full path as above). Verdict session
C2-V for FH-1 and RP-4 (bus F-450, F-452) ONLY; re-verification round. Canary
check; git status; tell me which tenant is logged in if the round's Blind spots
line names a re-list, and wait for my confirmation. Pass bars from the Fix notes.
Run the diff over both real manifests and confirm the four `re rules` sublists
need no tenant decision; confirm the conventions lookup resolves per the ruled home
on both tenants; walk setup Phase 4's relay once (I type /gs-superadmin:setup; you
record the relay's scope-limited lines). One guard-wiring line. Verdicts on the bus
`@ <token>`, [skip ci] commit on the branch, ledger line, merge-clear statement.
```

---

## Session D — DC-1, DC-2, DC-3 (prose and one message; may ride B or C2)

```
Read <repo>\dev\handoff\ROUNDS-2026-09-HANDOFF-PLAN.md
(the full file, including the Session ledger). You are executing work items DC-1,
DC-2, DC-3 ONLY. If the ledger says a prior session folded any of them in, skip
those and tell me.

Repo: this checkout. Read CLAUDE.md then AGENTS.md (Writing skills; the rung table
— a second prose copy of an existing rule is never a fix). Depends on Session A
merged with F-449 VERIFIED; verify, else stop. Create branch `round-d-prose` off
dev.

Settle DC-1's open question (what `--deep` does about Phases 3–4 — the plan
recommends straight to Phase 5 unless the domain's list stamp is older than the
report's lookback window) and DC-3's (AGENTS.md only) with me in one
AskUserQuestion call. Then edit: setup/SKILL.md for F-457 (both statements; point
at doc-lib's RECORDED_LANES rather than copying the lane list), the guard's
repeat-offense ask text for F-453 with a guard-fixtures pin, and the AGENTS.md
review-gate bullet for #1. Live systems are NOT connected and nothing here needs
them; the tester walks setup --deep once.

Housekeeping: F-457 and F-453 FIXED with Fix:/Judge: lines (F-453 is polish —
say "batched" on its sibling sweep); no version bump unless DC-2's message change
is judged user-visible (it is: the ask text ships — bump patch + CHANGELOG line);
close #1 from the PR body. check-doc-drift, check-stale-facts, guard-fixtures,
plugin validate. /code-review low is acceptable for this docs-heavy round; fix or
dismiss, diff summary. Commit, push, PR to dev unmerged, dev-utils handoff,
bus comment on dev, ledger + "As shipped (D)" notes, and the D-V prompt.
```

---

## Session D-V — verify D

```
/dev-loop recheck feedback. Read the plan (full path as above). Verdict session
D-V for DC-1..DC-3 (bus F-457, F-453; issue #1) ONLY. Canary; git status; no
tenant needed except one `--deep` walk that reads a small domain (tell me the
tenant; wait for confirmation). Pass bars from the Fix notes: the two F-457
statements present where the plan names them; the guard's repeat-offense ask
carries the remedy (repeat a variable-built read twice in the scratch workspace
and quote the second prompt's text — ask me what rendered). Verdicts `@ <token>`,
[skip ci] commit, ledger line, merge-clear statement.
```

---

## Session E — GD-1, GD-2, GD-3 (the mutation guard; its own round)

```
Read <repo>\dev\handoff\ROUNDS-2026-09-HANDOFF-PLAN.md
(the full file, including the Session ledger). You are executing work items GD-1,
GD-2, GD-3 ONLY. This round touches the safety surface: nothing else rides it.

Repo: this checkout. Read CLAUDE.md, AGENTS.md, and the guard's own header plus the
F-436 / F-441 / F-443 rows in build/defect-classes.mjs (name-spelling,
second-scanner) BEFORE reading the issue — this is the second-scanner class, and a
section reopened twice demands a Redesign: line, so design the ONE normalizer
first. Depends on Session A merged with F-449 VERIFIED; verify, else stop. Create
branch `round-e-guard-normalizer` off dev.

Settle GD-2's open question (matrix home: the oracle's generator vs stdin fixtures
— the plan recommends the oracle) with me in one AskUserQuestion call. GD-1 and
GD-3 are ruled.

Live systems are NOT connected and none are needed: the judge is
test/guard-oracle.mjs — REAL bash and REAL PowerShell on this machine running
generated lines through the recording shim. Add the assignment-prefixed
interpreter shapes ($x=bash -c, $x=eval, $x=iex, $x=powershell "…") and the
positional-then--Command shape to the GENERATOR, prove the pre-fix guard fails them
(run the suite against a stash of the fix), then make them pass with the shared
normalizer. For GD-3, reproduce each of check 11's four items with a fixture in
build/test-check-doc-drift.mjs before fixing; drop any that do not reproduce and
say so in the PR. The guard's journal grammar (T-4) is a CONTRACT — additive only.

Housekeeping: log the guard finding on the bus as ONE section (next free F-number
per the header rule) naming the class, flip it FIXED in the same PR with
Fix:/Class:/Judge:/Sibling sweep: lines (the judge is the oracle's counts); the
plugin README's residual list per check 11 if a residual closes; CHANGELOG +
version bump; verbatim battery (guard-fixtures, guard-oracle, the doc gates);
plugin validate. /code-review medium, fix or dismiss, diff summary. Commit, push,
PR to dev unmerged (body: the oracle's before/after counts; "Closes #2" only if
all eight items closed, else comment on #2 with what shipped), dev-utils handoff,
bus comment on dev, ledger + "As shipped (E)" notes, and the E-V prompt.
```

---

## Session E-V — verify E

```
/dev-loop recheck feedback. Read the plan (full path as above). Verdict session
E-V for GD-1..GD-3 (the bus section Session E logged; issue #2) ONLY. Canary; git
status; no tenant needed. Pass bar: the Fix note's claim plus issue #2's own
examples — in the scratch workspace issue `$x=bash -c 'gs-admin jo p save'`,
`$x=iex 'gs-admin jo p save'`, and `powershell foo.ps1 -Command "gs-admin jo p
save"` and record the ask each drew (decline every one; ask me what rendered). Run
test/guard-oracle.mjs yourself and quote its counts. Verdict `@ <token>`, [skip
ci] commit, ledger line, merge-clear statement.
```
