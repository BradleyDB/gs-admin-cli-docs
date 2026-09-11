# FEEDBACK — gs-superadmin

> Bus file for the /dev-loop workflow (user-level skill; formerly /plugin-loop).
> Tester appends findings at the BOTTOM of this file, below the comment history — a section
> runs from its heading to the next, and check-stale-facts reads every copy-out row inside
> it (next F-number); builder flips statuses
> and adds Fix: notes. Statuses: OPEN → FIXED → VERIFIED | WONTFIX |
> DEFERRED (past X.Y.Z). Severity: polish | normal | high on every entry.
> Never renumber, delete, or rewrite another role's text.

Profile: plugin
Load: claude --plugin-dir <repo>\plugins\gs-superadmin
Reload: /reload-plugins (restart for MCP/hooks)
Validate: claude plugin validate plugins/gs-superadmin
Version: plugins/gs-superadmin/.claude-plugin/plugin.json
Canary: plugins/gs-superadmin/skills/dev-canary/SKILL.md description
Hooks: dev/hooks/pre-push is the tracked source of this clone's .git/hooks/pre-push (install: cp dev/hooks/pre-push .git/hooks/pre-push — LF, executable); it blocks main, runs the three doc gates on dev, and runs check-instance-data on EVERY ref (F-423). A worktree shares the hooks and the checker reads the main checkout's private-pattern config from there.
Release checklist: dev/RELEASE-CHECKLIST.md (repo-specific gates + the fill-in close-out note; the /dev-loop skill Step 4 remains the procedure of record)
Walk hint (DS-44, 2026-09-07; procedure fixed by F-415, 2026-09-08): no CI suite executes
skill prose — a SKILL.md-only change passes every check green. So every SKILL.md a round
changes is walked ONCE, for real, in the tester session, and the walk is recorded under
the finding's verdict. WHO invokes it derives from the skill's frontmatter, never from
the kickoff's wording: a skill WITHOUT `disable-model-invocation` (the plugin README's
catalog table: "slash + natural language") is invoked by the tester session itself; a
skill WITH it ("slash only" — six of the eight shipped) is refused by the Skill tool by
design, so the USER types its slash command once in the tester session and the tester
records the first artifact or first ask it produced. A walk stops at a mutating skill's
first ask (decline it). The round's kickoff prompt lists both sets from the frontmatter
census, so "walked" and "cannot be walked" are never conflated: a walk the session cannot
run (no tenant token, no user present to type) is banked in dev/VALIDATION.md and named
on the round's Blind spots line, keyed by the token. Each tester round also records ONE
guard-wiring line: a catalog-mutating gs-admin command issued in the scratch workspace and
the ask it drew (decline it) — the hook's wiring in the real loader is otherwise assumed,
never measured; a session that auto-approves asks records the hook's decision object and
says the rendered prompt is unmeasured.
Entry hint: read this header for the Under test line, then grep '^## F-' for the live
findings and read at those offsets. Released sections are moved to
dev/FEEDBACK-archive.md after each release (last move: 2026-09-09, after release 0.37.0 —
F-414..F-447 with their round blocks; the 0.36.3 move took F-410..F-413; the 0.36.2 move took F-390, F-391,
F-396..F-409; the 0.36.1 move took F-387..F-389 and F-392..F-395;
the 0.35.4 move took F-360..F-386, the 0.35.0 move F-357..F-359, the 0.34.3 move F-224..F-356
and the older comment history; the sections a verdict cites may therefore live in the archive). The NEXT FREE NUMBER is the max
across BOTH files' '^## F-' section headers plus the numbers claimed in header
comments — a bus with zero live sections does not restart at F-001.
Seed note (2026-09-09): this bus was seeded EMPTY from the private predecessor repo; its
archive, which ended at F-447, is not carried, so dev/FEEDBACK-archive.md does not exist yet
and the NEXT FREE NUMBER is F-448 — numbering continues rather than restarting, so new
findings never collide with the F-numbers cited in shipped code (CONTRIBUTING, "Reading the
citations in code comments").
Issues hint (2026-09-10): this bus is NOT the whole picture of open work. A finding a
stranger could act on without a design conversation first is filed as a GitHub Issue
instead of a bus section; issues consume no F-number, so the NEXT FREE NUMBER rule above
is unaffected by them. Read `gh issue list` alongside this file. Open from the 2026-09-10
multi-tenant round: #10 unquoted page placeholder in the capture fences, which PowerShell
eats (good first issue); #11 recover list-invisible email templates from program payloads
(help wanted); #12 deep-ingest performance — concurrent describes and batched marks, to
bring a full run inside one token lifetime (help wanted); #13 abort a domain after 5
consecutive retryable failures (good first issue).
Round-assessment hint (F-161, extended by F-223): ANY status transition — a fix, a
verdict, a WONTFIX, a flip back to OPEN — may ride an UNMERGED PR. Assess a round with
`gh pr list` as well as the dev log. The role landing a transition on an unmerged
branch says so in a bus comment ON DEV (branch + PR number), not only in the entry's
note on that branch, and RE-STAMPS that comment whenever the branch's statuses change.
The same comment claims any finding NUMBER the branch consumes, at logging time — and
a session picking a next number takes the max across both '^## F-' section headers and
header-comment claims, after a fresh pull. Rule of record: AGENTS.md § Review-gate rules.
CI-dispatch hint (CI-cost round 2026-08-27; the repo has been PUBLIC since 2026-09-09, so
Actions minutes are free — the discipline stands because the 3-OS matrix is slow and its
signal is per handoff, not per edit): the local verbatim battery is the mid-wave evidence, NOT CI.
Dispatch workflows only at HANDOFF POINTS — once on the tip a tester round will load
(because a [skip ci] bus commit at the head suppresses the PR suite) and once on dev
after a merge — never per fix batch. A bare `gh workflow run` is ubuntu-only by
design; the full 3-OS matrix runs on release PRs and the weekly cron, or on an
explicit `-f full_matrix=true` dispatch reserved for release-grade rechecks
(CI-1-style banked arcs). Cross-OS drift between full runs is bounded by the cron.
Dispatch-evidence rule (F-340): a handoff note QUOTES each dispatch's conclusion
- run id + verdict pasted verbatim AFTER the run finishes - never asserts it.
A dispatch whose conclusion is not quoted in the note counts as evidence nobody
read; "green" written before the run concluded is the F-340 failure verbatim.

Quoting hint (F-328 round 3): quote rendered output as 4-space-indented
lines. Fenced code blocks are NOT this file's quoting convention — a
line-leading run of 3-plus backticks or tildes is refused by
check-stale-facts at that line (a wrapped prose line is indistinguishable
from a fence, so the checker keeps no fence state at all).
Version literals (F-389): the checker holds EVERY v-prefixed three-part version in prose to
the pinned CLI version — it cannot tell a Node, Claude Code or git version from a CLI
claim. Record another tool's version bare (24.16.0) or on an indented line; both are the
encoded convention, not workarounds.

Token hint (F-390 round 3, tester): a handoff token hb-<yyyymmdd>-<nn> is minted from the MAX
<nn> for today present across BOTH bus files and every live branch's bus after a fresh pull —
not from a per-session count. Two concurrent branches minting from one day-counter collide
(hb-20260905-05 was minted on dev's release-gate round AND on reader-shapes-emitter in the same
hour), and this header keys Blind-spots lines BY TOKEN, so a shared token is not a key. Same
shape as the NEXT FREE NUMBER rule above.

Proportionality hint (IDEAS "Dev-loop proportionality valve", banked 2026-09-01 after
the F-332..F-337 arc ran five full ceremonies for a lint helper; landed in the /dev-loop
skill 2026-09-03): every entry declares Severity: polish | normal | high, right after
Reported. One question decides it - is shipped behaviour wrong for a user? no (battery,
tooling, tests, docs, lint) = polish; yes = normal; yes and it must not reach anyone
before the fix = high; unsure = normal. Either role may re-declare by APPENDING a dated
Severity line (latest wins; never rewrite). Entries logged before this hint read as
normal (legacy, undeclared). Teeth: polish findings ACCUMULATE - no handoff token, no
dispatch of their own; the builder names every OPEN polish finding at kickoff and they
ride the next substantive round's ONE handoff and ONE verdict round; a polish-only batch
on the build lane with the local battery green skips the per-round dispatch (unless it
touches CI). high = its own round now, blocks a feature-branch merge as well as a release.
Release-scoped status DEFERRED (past X.Y.Z) = real, agreed, not for that release; header
form is the status plus the version in parentheses, and the body MUST carry
Defer: <date> (<who decided>) - past <version>. Why not now: <reason>. Reopen: <trigger>.
WONTFIX now means decided against, not coming back (F-192 / F-240 / F-246 / F-248 were
the improvised deferrals that motivated this; F-248 stays archived as WONTFIX). At
release: step 0 re-opens every finding deferred past an OLDER version, then auto-defers
each OPEN polish finding ONCE (Defer line stamped "auto, release ceremony"); a polish
finding already auto-deferred once blocks like a normal one. Gate: every live section
is VERIFIED, WONTFIX, or DEFERRED past the version being cut. DEFERRED sections are
never moved to the archive. Procedure of record: /dev-loop skill Steps 2-4;
repo order: dev/RELEASE-CHECKLIST.md section 1.

Verification-doctrine hint (GP-B5 W10 / B14, 2026-09-03; rule of record AGENTS.md
§ Review-gate rules, "Verification must be able to surprise" + "Defect classes are
registered where a check reads them"; check-stale-facts refuses the structure):
(1) every handoff writes `Blind spots (<token>): …` directly under Under test — what this
round's verification could NOT see (frames not used, measurements skipped with the
argument), or `none — <reason>`; keyed by the token, so a re-stamped token needs its own
line. A tester verdict comment states its own blind spots the same way — and never infers the session's approval
mode or a prompt's absence from its own transcript (prompts are invisible in tool results, F-437): it ASKS the
operator what rendered, or records the attribution as unmeasured and says why. (2) Every
mutation copy-out row (indented, KILLED/SURVIVED) carries pred:KILL or pred:SURVIVE
written BEFORE the run (MISMATCH where they differ), and the table's header line names its
enumeration source (`sweep (source: …)`); a table whose mutants come from the fix's own
arms is labelled a vacuity check, never closure. build/sweep-fence-grammar.mjs prints
the tokens. A verbatim quote of an older table is introduced by a line saying "quoted
verbatim" and is exempt. (3) A finding of a registered class carries `Class: <key>`
after Severity — the key alone on the line (keys in build/defect-classes.mjs,
append-only); its FIXED note carries `Sibling sweep: …` — the check-19 pass line for a
mechanical class, the recipe's copy-out and cost for a manual one, or
`batched — <reason>` on polish. (4) From F-436 on, that FIXED note also carries
`Judge: …` — what decides the fix's correctness independently of the fixer's list (an
oracle, a differential against the real shell, the tester's live arm) — and (5) a section
reopened twice is not FIXED again without `Redesign: …` naming the model replaced. A
reopening verdict's `Verdict:` line says REOPENED (or "back to OPEN") — that vocabulary is
what the gate counts (F-444). The gate refuses both. Sections from F-360 on; the Class: key
rule also reads the archive.


Under test: dev · hb-20260909-01 · 2026-09-09
Blind spots (hb-20260909-01): the skipped-path arm of F-448 (a docs-only PR to dev where validate and manifests report Skipped) was not exercised — nothing is required on dev besides drift (full), so it gates nothing today; it is measured the first time a docs-only PR to dev opens. No tester round ran this cut (docs-only payload, zero live findings before F-448; the release PR's own required-check rollup was F-448's judge).

<!-- builder 2026-09-09 (docs-only promotion to main RELEASED — post-release housekeeping):
     Payload: the contributor-onboarding surfaces (#6: compare link, guard message, PR template,
       linguist-generated, CODEOWNERS), the GP-14 CONTRIBUTING bullet (#4), and the F-448 CI fix (#8).
       No plugin bytes changed: no version bump, no tag, no GitHub Release (AGENTS.md docs-only rule);
       plugin stays 0.37.0. Staged versions folded in: none.
     Gate 1 (bus): zero live sections before the cut (seeded empty); F-448 logged and FIXED during the
       cut; open PRs to dev: none.
     Gate 2 (review): /code-review low over origin/main...dev — 0 findings; /security-review skipped:
       no hook, spawn, or tenant-reading path touched, the workflow change is a literal inside an
       existing echo. Tie-break applied: the first cut (032d645) was BLOCKED on main's required
       validate-plugin contexts; the full_matrix dispatch was tried and refuted; root cause fixed on
       dev (#8, F-448) and the branch recut rather than the ruleset loosened for one merge.
     Cut: release/2026-09-09-contributor-surfaces from dev @ 198f40e, ONE commit beyond (the strip,
       19349c9); stripped tree: both strict validates PASS; battery verbatim 52/52 on the first strip
       (032d645), and on the recut 7/7 for the gates that read the only files that changed since
       (validate-plugin.yml, the stripped bus) plus both validates.
     CI on the release PR #7, QUOTED per job after completion:
         validate-plugin 34402673242: changes success / manifests success / validate ubuntu success /
           windows success / macos success
         docs-drift 34402673243: drift (full) success
         pr-target-guard 34402673241: guard success
     Merged by Bradley (main @ 756579e); no tag (docs-only); release branch deleted local+remote;
       checkout back on dev.
     Housekeeping: nothing archived (F-448 stays live, FIXED, awaiting the other role's verdict);
       Under test + canary → dev · hb-20260909-01. Next free number F-449. Released: nothing versioned;
       dev stages nothing.
     Now live from main: validate-plugin.yml's pull_request trigger without its paths filter (the
       changes job gate, F-448); .github/CODEOWNERS for PRs targeting main; the PR template callouts;
       the guard's rewritten message; README/CONTRIBUTING compare link. Dependabot policy: unchanged.
     GitHub Release: none (docs-only; the release rule applies to plugin versions).
     Consumer refresh: nothing to refresh — plugin bytes identical to 0.37.0.
     Carried forward (not in this release): F-448 verdict by the other role; the skipped-path arm
       (Blind spots above). -->

## F-448 — FIXED
Reported: 2026-09-09 (builder, at the 2026-09-09 docs-only cut)
Severity: normal — the release path is blocked for any cut that changes no plugin path; no user-facing behaviour is wrong, but a release cannot merge without weakening the gate
What: the main ruleset requires manifests and validate (ubuntu-latest | windows-latest | macos-latest), but validate-plugin.yml's pull_request trigger carried a paths filter. A release PR whose diff touches none of those paths (PR #7: CONTRIBUTING, README, .gitattributes, .github/*) never starts the workflow; an unstarted workflow reports no check run; GitHub shows the four contexts as "Expected" and the PR is BLOCKED with every reported check green. Every earlier release changed plugin bytes, so the gap never fired on the private predecessor.
Repro: open a PR to main from a release/* branch whose changed files are outside the paths list; gh pr checks lists only drift (full), guard, GitGuardian; gh pr view --json mergeStateStatus reads BLOCKED.
Tried and refuted at this cut: gh workflow run validate-plugin.yml --ref <release branch> -f full_matrix=true. All four jobs succeeded on the same head sha (run 34401015130), but GitHub's PR rollup counts only check suites raised by the PR's own events — the dispatch suite never appears in gh pr checks and the PR stayed BLOCKED. The bus header's "release-grade recheck" dispatch is evidence, never a gate.
Fix: 2026-09-09 (builder) — GitHub's documented shape for a required check behind a path filter (docs: "Handling skipped but required checks" — a workflow skipped by paths leaves its checks Pending; a job skipped by a job-level if reports Success). The pull_request trigger loses its paths filter; a new first job `changes` decides from the PR's own diff (git diff --name-only HEAD~1 HEAD against the same pathspec list) and always answers run=true when the base is main or the event is not a pull_request; `validate` and `manifests` carry needs: changes + if: needs.changes.outputs.run == 'true'. Docs-only PRs to dev still start no runner for the battery (the jobs skip); PRs to main always run the full matrix. The push trigger keeps its paths filter (push events gate no merge, and not starting a run at all is F-266's point) — that list and the pathspec list in `changes` are the same fact in two homes, each commented to name the other. Cost of the root cause over a workaround: one CI-touching PR to dev and a recut of the release branch; the alternative (removing the four contexts from the ruleset for one merge) weakens the gate and leaves no trace in the repo.
Judge: the recut release PR's own required-check rollup — gh pr checks on the new head lists manifests and the three validate legs with the ruleset satisfied (mergeStateStatus not BLOCKED), or the fix is wrong; independent of anything the fixer asserts.
Judge fired 2026-09-09 (builder): PR #7 recut head 19349c9 — gh pr checks listed changes, manifests, validate (ubuntu-latest | windows-latest | macos-latest), drift (full), guard, all SUCCESS (validate-plugin run 34402673242); mergeStateStatus CLEAN; merged by Bradley as 756579e. Live arm on the fix PR itself (#8, run 34402234627): the changes job printed "run: plugin-affecting paths changed:" and validate (ubuntu-latest) + manifests ran rather than skipped. Verdict of record still owed by the other role. Sibling: docs-drift.yml carries no paths filter (it always runs), pr-target-guard is branch-filtered to PRs targeting main, where it is the only place it is required — no other required context sits behind a trigger-level filter.

## F-449 — OPEN
Reported: 2026-09-10 (tester — first live multi-tenant setup, a second tenant added to an existing workspace)
Severity: high — a wrong-answer surface in deps-report, which exists to answer "what breaks if I change object X"; buried assets return a confident "nothing depends on this"
What: Phase 4's candidate gate measures overlap correctly and then permits a conclusion its own measurement refutes. On the sandbox tenant, `report list-objects` was excluded 2026-08-09 with this recorded reason:

    Redundant plus schema reference. 0 of 586 rows match by objectId, but 253 match by
    objectName against data-management, which indexes 591 objects keyed by name. The BI
    source-object schema surface is already covered there, and more completely.

253 of 586 is 43%. "More completely" appears to rest on 591 > 586, which says nothing about overlap. Result: roughly 333 MDA objects indexed nowhere on that tenant since 2026-08-09. The prod tenant hit the same shape this round (246 of 589) and correctly adopted the command as a `report-objects` domain of 589 assets — the same skill reaching opposite verdicts on near-identical evidence, which locates the defect in the decision rule, not the measurement.
A threshold pass over all 38 exclusions across both tenants found this is the only failure. Every other exclusion either accounts for 100% of rows (4 of 4, 3 of 3, 59 of 59), accounts for the remainder explicitly (3 of 6 indexed plus 3 named sentinel ids), or declares itself a judgment call (0 of 33 folders, "recorded not to be reopened").
Second half, same root: exclusions carry only `decidedAt` while blocks carry `recheckAfter`. The reversible decision gets a review date; the permanent one does not. The sandbox tenant's block `recheckAfter: 2026-09-09` also lapsed with nothing surfacing it.
Evidence basis — INFERRED, not re-measured: the refutation rests entirely on the two numbers written into the exclusion reason itself (253 matched of 586 rows, against a 591-object domain). The sandbox tenant's `report list-objects` was NOT re-run live this round, so "roughly 333 buried" is arithmetic on the record rather than a fresh count. A live re-run is the confirming measurement and has not happened.
Expected: an exclusion whose stated ground is "covered by another domain" cannot be recorded unless the recorded match count supports it — a rule binding the verdict to the number, not prose that cites one. And a permanent exclusion carries at least the review affordance a temporary block does.

## F-450 — OPEN
Reported: 2026-09-10 (tester — first live multi-tenant setup)
Severity: normal — all three were invisible on a single-tenant workspace and went live the moment a second tenant existed
What: three facts are stored at a scope that does not match what they describe. One class, three instances.
(a) `.gs-superadmin/CONVENTIONS.md` declares itself "Tenant-specific — fill in as patterns emerge" but lives at workspace scope, shared by every tenant. `jo-report-deps.mjs:188` hardcodes `join(wsDir, ".gs-superadmin", "CONVENTIONS.md")`, and `deps-report/SKILL.md:60` states both halves in one sentence — "the tenant's field-aliasing convention from the workspace's `.gs-superadmin/CONVENTIONS.md`". Fill it in for one tenant and the other's deps-report, email-report and audit silently adopt it. Nothing was lost this round only because the file is still the pristine template.
(b) Hard-required-flag exclusions (`--topic is required`, `ruleId or ruleName is required`, `--object-name … is required`) and the two server-side blocks are properties of the pinned CLI, not of a tenant, yet they live in `<slug>/_manifest.json`. The second tenant re-derived every one by live-failing three attempts per blocked domain, and the two tenants now disagree about what is physically enumerable.
(c) Scope limits are absent from the manifest entirely: `domains_indexed["journey-email-templates"]` carries the same six fields as a fully-enumerable domain, so any consumer reading the manifest sees the count as complete. The limitation exists only as prose in `skills/setup/references/index-scope-notes.md`.
Expected: one decision about where each kind of fact lives — per-tenant, per-workspace, or per-CLI-version — with readers deriving from that home rather than three independent placements.

## F-451 — OPEN
Reported: 2026-09-10 (tester — first live multi-tenant setup)
Severity: normal — silently removes assets from change detection; the KB looks current and is not
What: on the sandbox tenant, 557 of 1,180 `journey-email-templates` entries carry no `modified_date` and 560 carry no `name` — the entries registered by the list-invisible recovery path. /refresh detects change by comparing dates, so those entries have nothing to compare and are permanently invisible to staleness: documented once in July, never flagged again. The missing `name` means inventory-side name lookups return null for them.
The reach is wider than the recovery path, and this is the part that needs answering before a fix is scoped. Entries with no `modified_date`:

    report                    1696 (sandbox) / 1754 (prod)
    journey-email-templates    557 (sandbox)
    journey-data-designer       69 (sandbox)
    connectors-chains            4 (sandbox)

The whole `report` domain is dateless on both tenants. The manifest supports an explicit-none `dateField`, so this may be a handled state with a documented fallback — or it may mean the entire report inventory sits outside change detection.
Expected: either a documented fallback /refresh applies to dateless entries, or an honest statement in the refresh report naming what it could not check — never silence.

## F-452 — OPEN
Reported: 2026-09-10 (tester — first live multi-tenant setup)
Severity: normal — the confusion lands on the one question Phase 4 asks the user to answer
What: Phase 4's closing relay instructs the model to ask "whether the totals match the user's sense of the tenant before Phase 5 spends the documentation budget" — while several relayed counts structurally cannot match, and nothing in the relay says so. A `journey-email-templates` count reads as a tenant total; it is a CLI-reachable subset (the list flattens one folder level and hides some top-level templates). The scope facts exist in `skills/setup/references/index-scope-notes.md` but are never surfaced at the moment the user is asked to validate the numbers.
Expected: at the end of Phase 4, scope-limited domains are named in the relay with their limit and the fact that the remainder can be added later — so the "do these totals look right?" question is answerable.

## F-453 — OPEN
Reported: 2026-09-10 (tester — first live multi-tenant setup)
Severity: polish — correct fail-closed behaviour; the cost is friction and an undocumented workaround
What: a Phase 4 loop that built its `gs-admin` subcommand from a shell variable was refused by the mutation guard, which cannot verify a command it cannot read. The refusal is correct. But it fired on a read-only enumeration loop during setup, and the resolution — spell the subcommands literally — appears nowhere in the skills; the session derived it. A user without that instinct is stuck on a correct refusal with no stated remedy.
Expected: wherever the skills instruct building a list of commands to run, the literal-spelling requirement is stated, so the guard's refusal is anticipated rather than debugged.

## F-454 — OPEN
Reported: 2026-09-10 (tester — first live multi-tenant setup)
Severity: polish — a reporting discrepancy, no data effect observed
What: the Phase 4 relay reported "4,487 assets across 16 domains" while the manifest held 17 `domains_indexed` at that moment, and the inventory carried 17 domains with at least one asset (18 after a further adoption later in the same run). Unexplained — possibly an empty-adopted domain counted differently by `report` than by `domains_indexed`, which is exactly the distinction the empty stamp exists to preserve.
Expected: the relayed domain count and the manifest's domain count agree, or the report states which one it is counting.

## F-455 — OPEN
Reported: 2026-09-10 (tester — first live multi-tenant setup, during a shallow crawl with per-domain deep ingests)
Severity: normal — no stored data is wrong and no stub misrepresents itself; what is wrong is the completion signal the user is asked to act on, and downstream decisions (rebuilding relationship maps, trusting a deps-report answer) rest on it
What: `manifest.mjs report` is the deterministic account of KB state, and its schema carries no depth at all. A metadata stub and a full describe are both counted as `documented`, in `byStatus` and in every `byDomain` row, so the report cannot distinguish a documented domain from an ingested one:

    "byStatus": { "documented": 5076 }
    "byDomain": { "rules-engine": { "documented": 497 },
                  "report": { "documented": 1754 }, ... }

Zero pending, zero stale, everything "documented" — while a tally of the `depth` field the manifest already stores, taken at 2026-09-10 17:08 local, read 1381 full against 3695 stubs across the same 5076 entries, `crawl_mode` shallow.
Consequence observed live: after one domain's deep ingest completed, the user was told the deep crawl was finished and that every domain was at full depth except the list-only ones and `journey-email-templates`. Eight further domains were entirely stubs at that moment, and a further domain's deep ingest began afterwards. This was not a careless relay — the report contains no fact that could have contradicted the claim, so the model had nothing to check itself against and the user had nothing to check the model against.
Note the same conflation is deliberate and correct elsewhere: Phase 6's precondition counts stubs as documented on purpose, because a stub never blocks synthesis. The defect is that the one mechanical statement of state offers no depth anywhere, so a human-facing completion claim cannot be grounded in it.
Second, smaller point found while measuring this: the manifest is rewritten continuously during a run, so a tally taken mid-ingest is a snapshot of a moving target and will disagree with one taken a minute later. A completeness check is only meaningful at a quiescent point. (The reporter made exactly this mistake while drafting the entry — a mid-run sample showed one asset short of a domain's full ingest, which the next read showed complete.)
Expected: depth is part of the mechanical account, not something a reader reconstructs. `report` (or a sibling verb) carries a per-domain full/stub/list-only breakdown derived from the `depth` the manifest already stores, with list-only domains reported complete by definition rather than as stubs, so the three states stay distinguishable. And every place a skill states that documentation is complete, or that a domain is fully ingested, derives that statement from the script's output rather than from its own narrative — one invocation, quoted, at a point where nothing is still writing.

## F-456 — OPEN
Reported: 2026-09-10 (tester — first live multi-tenant setup, deep-ingesting a connectors domain)
Severity: normal — a catalog-declared read is refused, costing a manual fallback per affected domain; nothing is corrupted and the refusal is loud, but it is discoverable only by hitting it mid-run
What: `describe-batch.mjs`'s read-verb gate decides whether a describe command is a safe per-item read by matching the **command path's trailing word** against `READ_VERB_EXACT` in `doc-lib.mjs` (plus a describe-shape regex). The trailing word is an arbitrary noun, so a legitimate per-item read whose path ends in something unlisted is refused. Live: `cn chain` was refused and the domain had to be documented through the manual per-asset path instead. The catalog already carries two fields that both say it is safe:

    {"path":"connectors chain","shortPath":"cn chain","actionKey":"describe-job-chain",
     "mutating":false,"summary":"Describe a job execution chain set"}

`actionKey` is literally `describe-job-chain`. Neither field is consulted; the gate reads only the path's last token.
The set is maintained by hand — its own comment says it "is re-audited by hand at each CLI adoption" — so every CLI upgrade can add a per-item read the gate will refuse, and the cost lands on whoever next ingests that domain.
Not the fix, and the reason matters: keying the gate on the catalog's `mutating: false` looks obvious and is wrong. Two upstream known issues were precisely that flag being false on commands that mutate — a run-now action that triggers a live rule execution, and a class of write commands labelled non-mutating. Both are resolved upstream, but a gate whose failure mode is executing a write should not start trusting a flag with that history. The shape that closes the gap without trusting it: match on `actionKey` (generated from the manifests, semantically stable) rather than the path's trailing noun, so `describe-job-chain` passes on its own merits and the hand-maintained exception list stops being load-bearing.
Provenance — why this survived four CLI adoptions: it is not an upstream-watch miss. The watcher's impact checklist audits this exact set as its item 3, and answered correctly every time (1.0.6 affected, five verbs added; 1.0.7, 1.0.8, 1.0.9 not affected). The question item 3 asks is a DELTA question — did this release change the set — and `describe-job-chain` appears in no audited delta, so no correct answer to that question could ever surface it. The watcher already identified this class in its own F-008 (2026-07-31): five tenant-wide list commands that existed at 1.0.4 and were never indexed, with the finding stating explicitly that the differ did its job and the class, not the five, was the point. That fix added a new checklist item for the COVERAGE class. Item 3 sits immediately beside it and was left delta-only, so the same blind spot still applies to the read-verb gate. A companion baseline sweep on the watcher side is the durable fix for the provenance; this entry is the gate itself.
Expected: the gate admits a per-item read on evidence the catalog already carries, without depending on a hand-maintained list of path-trailing nouns and without trusting `mutating`. Any command the gate would refuse should be enumerable from the catalog ahead of time rather than discovered by a run failing — a one-off sweep of every recorded `describeCommand` against the gate would say today which domains are affected.
