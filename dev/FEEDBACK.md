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
Dev-only: dev plugins/gs-superadmin/skills/dev-canary
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
dev/FEEDBACK-archive.md after each release (last move: 2026-09-28, after release 0.43.3 — F-461 and F-466, leaving no live section; the 0.43.0 move took F-462, F-463, F-464, F-465, F-467 and F-468; the 0.42.0 move took F-448..F-460 with their round blocks and the four header Walk lines; the 0.37.0 move took
F-414..F-447 with their round blocks; the 0.36.3 move took F-410..F-413; the 0.36.2 move took F-390, F-391,
F-396..F-409; the 0.36.1 move took F-387..F-389 and F-392..F-395;
the 0.35.4 move took F-360..F-386, the 0.35.0 move F-357..F-359, the 0.34.3 move F-224..F-356
and the older comment history; the sections a verdict cites may therefore live in the archive). The NEXT FREE NUMBER is the max
across BOTH files' '^## F-' section headers plus the numbers claimed in header
comments — a bus with zero live sections does not restart at F-001.
Seed note (2026-09-09): this bus was seeded EMPTY from the private predecessor repo; its
archive, which ended at F-447, is not carried, so dev/FEEDBACK-archive.md began fresh at the 0.42.0 move (F-448..F-460)
and the NEXT FREE NUMBER is F-448 — numbering continues rather than restarting, so new
findings never collide with the F-numbers cited in shipped code (CONTRIBUTING, "Reading the
citations in code comments").
Issues hint (2026-09-10): this bus is NOT the whole picture of open work. A finding a
stranger could act on without a design conversation first is filed as a GitHub Issue
instead of a bus section; issues consume no F-number, so the NEXT FREE NUMBER rule above
is unaffected by them. Read `gh issue list` alongside this file. Open from the 2026-09-10
multi-tenant round: #11 recover list-invisible email templates from program payloads (help
wanted); #12 deep-ingest performance — concurrent describes and batched marks, to bring a
full run inside one token lifetime (help wanted). Closed since (hint updated 2026-09-28):
#10 and #13 by #19 (d23f890, plugin 0.39.0); #28, the 2026-09-26 round's deps-report
corroborate-live caveat (re-homed from F-465, which closed on the bus as WONTFIX with a
Re-homed: line — the bus has no status for a move), by #31 (7a75662, plugin 0.43.1), its
live walk banked in dev/VALIDATION.md.
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


Under test: feat/jo-dash-s1-facts · hb-20261003-05 · 2026-10-03
Blind spots (hb-20261003-05): No tester run was made on hb-20261003-04; this handoff adds F-474's fix to it and everything that one declared still stands. Earlier this session the builder had a live token, at Bradley's offer, reads only: the six query shapes F-473 added or changed were accepted; has-a-company-link and GsCompanyId IS_NULL were measured an exact partition of the sends and of the clicked sends (difference 0 and 0); the new plan's estimates landed within 2x of the calls the hb-20261003-03 runs took. The token had expired before F-474's change, so that change was not run against the server. Unmeasured: (1) whether the server accepts TestParticipant EQ false on the three survey calls and the new resp-test count, and whether P-survey then reads the UI's program-analytics figures; V8 and V11. A row whose TestParticipant is null would be left out with the tests. (2) A full run of the new code: no snapshot has been built from it, so reconciliation over closed months (V1), the no-company-link rows and their clicks, and the drift split on a real current month are the tester's. (3) The estimate's constants were fitted to four pulls on one tenant. (4) Delivered against the UI's Delivered under the new definition (V3, V12), and step detail on the JO log (run 3). (5) Whether any survey participant names no program, and whether DOES_NOT_CONTAINS keeps a null address (0 such sends on this tenant). Offline: F-474's sweep 4 of 4 as predicted; the full local battery last ran two commits back (46 of 47, the red a git-ignored local file under tsc), and after F-474's change only the two engagement suites, the reader-shape trace and emitter test, the three doc gates and the tracked-tree typecheck were re-run; this change had no independent review. No SKILL.md changed, so no walk is owed; the guard-wiring line is the tester's.
Walk (hb-20261003-05): 2026-10-03 (tester) — S1-V third re-run, a RE-VERIFICATION of F-473, F-474, F-475 and F-476 and of the checks dev/VALIDATION.md section ENG-2 re-banked for the third and fourth S1 fix batches (V1, V2, V3, V8, V11, V12 with its per-email half, V13 and V6, and the Delivered ruling), on the production tenant, reads only: all five runs completed (exit 0); every owed check passed; F-473..F-476 VERIFIED; F-477 logged and closed WONTFIX on Bradley's ruling (a null bounce flag, unreachable on the measured data); F-478 logged OPEN (normal) on Bradley's call: the cross-tenant carry the S1-fix round noticed, read from the code; VALIDATION section ENG-2 CLEARED; PR #36 ready to merge (the merge is Bradley's; an open normal finding gates the release, not this merge). No SKILL.md changed, so no walk was owed. Detail in the tester comment below and in VALIDATION section ENG-2.
Walk (hb-20261003-03): 2026-10-03 (tester) — S1-V second re-run, the first full verdict on ENG-1 and ENG-2 (feature items, no bus section carries them) and the re-verification of F-470, F-471 and F-472, against dev/VALIDATION.md section ENG-2 on the production tenant, reads only: all five runs completed (exit 0); F-470, F-471 and F-472 VERIFIED; V1 FAILED on F-473 and V11 on F-474, both logged with F-475 and F-476; Bradley ruled one metric definition (Delivered), a T-10 change for the builder before the merge; PR #36 stays unmerged. Detail in the tester comment below and in VALIDATION section ENG-2.
Walk (hb-20261003-02): 2026-10-03 (tester) — S1-V re-run, the verdict round for ENG-1 and ENG-2 (feature items, no bus section carries them) and F-470's re-verification, against dev/VALIDATION.md section ENG-2 on the production tenant, reads only: V0 confirmed by Bradley; run 1 (plan) ok; run 2 (full) ended partial, exit 4, so no snapshot was built; V8 FAILED, F-471 and F-472 logged; runs 3-5 not run, on Bradley's call; F-470 stays FIXED, V9 not measurable. Detail in the tester comment below and in VALIDATION section ENG-2.

<!-- builder 2026-10-04 (JO-dashboards S1b — POINTER: F-478 FIXED and the accounts-optional switch ride an UNMERGED branch; next free F-479):
     Branch: feat/jo-dash-s1b-accounts-optional. PR: #37 to dev, open, left unmerged until its verdict round.
     Handoff token: hb-20261004-01 (the Under test line, the Blind spots line and the canary are on the branch, not here).
     F-478: FIXED on the branch (normal; Class consumer-parity), with its Fix, Judge and Sibling sweep notes there. It
       reads OPEN in this file until PR #37 merges. No new F-number was claimed by the branch.
     Also on the branch (plan items ENG-2 and LTR-9, no bus section): the engagement adapter's account grain is optional
       and off unless --accounts is passed; the snapshot gains meta.accounts (additive on T-10, typedef and pin together).
     dev/VALIDATION.md on the branch: a new section, W0 to W5, keyed to hb-20261004-01. W0 is F-478's verification
       (offline); W1 to W5 are live reads.
     Open polish findings: none. Plugin 0.44.0 stays unreleased; the batch is folded into its CHANGELOG entry.
     CI on PR #37's head 0cd7344, quoted per job after completion:
         validate-plugin 37216782425 (pull_request): changes success / manifests success / validate (ubuntu-latest) success
         docs-drift 37216782428 (pull_request): drift (full) success
     Open PRs to dev: #37 only (green, mergeable, held for the verdict round). Issues #11 and #12 unchanged. -->

<!-- builder 2026-10-04 (JO-dashboards S1 round CLOSED OUT — PR #36 merged (ecd928d); T-10 FROZEN at schemaVersion 1; F-478 OPEN; next free F-479):
     Merged: feat/jo-dash-s1-facts -> dev, PR #36, merge commit ecd928d (Bradley's go-ahead, 2026-10-04). Plan items ENG-1
       and ENG-2 are on dev: scripts/engagement.mjs, the T-10 typedef and its pin, the fixtures and the suites. The
       branch is deleted, local and remote. Plugin 0.44.0 stays unreleased (one release for the whole program).
     T-10, the engagement snapshot, is FROZEN from this merge: an additive field rides the change that needs it, typedef
       and pin together; removing or re-typing a field, or changing what a measure counts, bumps schemaVersion.
     Findings from the round: F-470 to F-476 VERIFIED; F-477 WONTFIX (Bradley's ruling); F-478 OPEN (normal): it gates the
       release, not this merge, and is the next builder batch's, with the accounts-optional switch (a fresh branch).
     dev/VALIDATION.md section ENG-2: CLEARED at hb-20261003-05.
     Under test stays feat/jo-dash-s1-facts · hb-20261003-05 until the next handoff re-stamps it; that branch no longer
       exists, so a tester session loads dev.
     CI on dev after the merge (ecd928d), quoted per job after completion:
         docs-drift 37184757257 (push): drift (full) success
         validate-plugin 37184757234 (push): changes success / validate (ubuntu-latest) cancelled / manifests cancelled
           (cancelled, not failed: superseded by the dispatch below, started seconds later on the same commit)
         validate-plugin 37184764956 (workflow_dispatch): changes success / manifests success / validate (ubuntu-latest) success
     Open PRs to dev: none. Issues #11 and #12 unchanged. Released: nothing. -->

<!-- tester 2026-10-03 (JO-dashboards S1-V third re-run @ hb-20261003-05 — ALL FIVE RUNS COMPLETE; EVERY OWED CHECK PASSED; F-473, F-474, F-475, F-476 VERIFIED; F-477 logged WONTFIX; F-478 logged OPEN; VALIDATION ENG-2 CLEARED; PR #36 ready to merge; next free F-479):
     Provenance: the dev-canary skill read hb-20261003-05 in session, matching Under test; the workspace's plugin link
       resolves to this checkout's plugins/gs-superadmin; feat/jo-dash-s1-facts clean and level with origin at 7cc5d79.
       Production tenant, confirmed by Bradley; CLI 1.0.10; every tenant call a read (the adapter's five runs, and 6 single
       reads through the spike's catalog-checked runner).
     Round type: a RE-VERIFICATION of F-473..F-476 and of the checks the last two Re-banked blocks of VALIDATION section
       ENG-2 name, each judged against its stated pass bar and nothing past it. New run names (s1v3-*), the same inputs on
       all five lines; run 4's --previous was this round's run 2 snapshot.
     V0: recorded as confirmed at hb-20261003-02. Delivered: Bradley read the typedef's delivered lines and confirmed they
       read as he ruled, then ruled that a went-out send with a null bounce flag does not count as delivered; measured 0
       such sends (F-477, WONTFIX on his ruling: unreachable, recorded so a deviation can point to it).
     Runs (estimate -> actual): 1 plan 299 / 2175 s, step detail +45 / +315 s; 2 full 315 calls / 2090 s; 3 step detail
       344 / 2490 s -> 369 / 2498 s; 4 selective 105 / 817 s -> 181 / 1096 s, mode selective (11 months carried); 5
       sent-since 90 days 187 / 1391 s -> 239 / 1658 s. Every run ok, failed [] in each, reconciled true in each; no token
       stop (two logins, both between runs).
     Status transitions on the branch, this round:
       F-473 FIXED -> VERIFIED (closed months reconcile; no-company-link sent and attributed clicked sends equal direct
         counts; both all-no-link programs selected).
       F-474 FIXED -> VERIFIED (P-survey reads the program page's 527 and 100; 92 test participants excluded).
       F-475 FIXED -> VERIFIED (every difference in the current month, reported as drift, reconciled true).
       F-476 FIXED -> VERIFIED (four estimate pairs, the worst 1.72x on calls).
       F-477 logged and closed WONTFIX (polish): the readers count a went-out send with a null bounce flag as delivered;
         Bradley ruled it unreachable and not to be built for.
     Verdicts (detail in VALIDATION section ENG-2 on the branch): V1, V2, V3, V8, V11, V12 (both halves), V13 and V6
       CLEARED; the Delivered ruling's readers equal a direct strict count (IsSent YES and IsBounced NO; EmailSend true
       and Bounce false) wherever read. Sent and Opened unchanged. The UI page's "Delivered" subtracts every bounce event,
       including those on attempts that never went out, so it is not the comparison where that basis differs; that is
       the R3 divergence ENG-4's registry documents.
     Guard-wiring: `gs-admin jo p pause --help` -> Bradley read the rendered ask: "Mutating Gainsight command: gs-admin
       journey programs pause. This workspace is read-only by default. Workspace manifests claim multiple tenants
       (<slug> (<host>); <slug> (<host>)) — confirm `gs-admin whoami` targets the intended one before approving. ⚠ At
       least one of these tenants is PRODUCTION (recorded at setup) — verify the target before approving." DECLINED.
     Walk: none owed. No SKILL.md changed this round; the round's Walk line is above.
     Blind spots: one tenant, as before. F-475's failure arm (a closed-month difference) did not occur live, so it rests on
       the offline pins. F-476's constants were fitted on this tenant; four runs here are not a second tenant. ao_emails
       null bounce flags were counted for one program-month by CLI; the tenant-wide read is Bradley's. The internal-domain
       list is still the operator's knowledge.
     Session faults: none recorded; no gs-admin call ran while a run was in flight.
       F-478 logged OPEN (normal), on Bradley's call after the round: the S1-fix round's "noticed, not changed"
         cross-tenant carry, read from the code at f378505 (click history, template names and account names read from
         the previous snapshot without a tenant check, on full refreshes too). Not measured live.
     Not logged on the bus, raised in the report to Bradley: the cost of a first pull on this tenant (35 to 42 minutes),
       a planning item he put in the plan's backlog.
     PR #36: every owed check passed; F-478 is open (normal), which gates the release, not this merge. Ready to merge,
       the merge is Bradley's. -->

<!-- tester 2026-10-03 (JO-dashboards S1-V second re-run @ hb-20261003-03 — ALL FIVE RUNS COMPLETE; F-470, F-471, F-472 VERIFIED; F-473..F-476 OPEN; V1 and V11 FAILED; one T-10 definition ruled; PR #36 stays unmerged; next free F-477):
     Provenance: the dev-canary skill read hb-20261003-03 in session, matching Under test; the workspace's plugin link
       resolves to this checkout's plugins/gs-superadmin; feat/jo-dash-s1-facts clean and level with origin at 96ed11e.
       Production tenant, confirmed by Bradley; CLI 1.0.10; every tenant call a read (the adapter's runs, and 14 single
       reads through the spike's catalog-checked runner).
     Round type: the first full verdict on ENG-1 and ENG-2, and a RE-VERIFICATION of F-470, F-471 and F-472 (each judged
       against its stated pass bar, nothing past it). Judged against dev/VALIDATION.md section ENG-2 as written; new run
       names (s1v2-*), the first re-run's directory left alone; the same inputs on all five lines.
     V0: recorded as confirmed at hb-20261003-02; the typedef did not change since.
     Ruling, a T-10 metric definition (Bradley, 2026-10-03, at V3/V12): Sent stays every attempt (R17). Delivered becomes
       the sends that went out and did not bounce (email_log_v2 IsSent = YES and IsBounced = NO; on the step table
       EmailSend true and Bounce false); only if that cannot be computed, the original definition with a tooltip. Found
       because the UI page read for the comparisons calls the went-out count "Sent" and subtracts every bounce event
       from it for "Delivered", although most bounce events are on attempts that never went out. T-10 is not frozen
       (it freezes at the merge), so this is the builder's change before the merge, recorded as its own item with every
       reader named; no schemaVersion bump. The flags it needs are already grouped together in the template, account
       and step pulls, so it costs no call.
     Runs (estimate -> actual): 1 plan ok; 2 full 139 / 1011 s -> 303 / 1909 s, ok; 3 step detail 184 / 1326 s -> 356 /
       2267 s, ok; 4 selective 29 / 241 s -> 168 / 1016 s, ok, mode selective; 5 sent-since 90 days 91 / 675 s -> 226 /
       1429 s, ok. Every snapshot built; failed [] in all; no token stop (two logins between runs, none mid-run).
     Status transitions on the branch, this round:
       F-470 FIXED -> VERIFIED (V9: echo, P-unsub 0 clicked on all rows with templates unknown, nonContentOnly 36,
         byUnsubscribeInput 59).
       F-471 FIXED -> VERIFIED (V8: every family ok in every run, click-attr and step-click included; no dedup warning).
       F-472 FIXED -> VERIFIED (V8: no truncated failure; V1: the address cut adds up exactly, judged against a direct
         count because the adapter's own check is red for F-473; null-address count 0).
       F-473 logged OPEN (normal): a lookup fieldPath in a group or an aggregate drops every row whose lookup is null,
         server side; the account table, click attribution and program selection lose the sends with no company link.
       F-474 logged OPEN (normal): the survey response denominator reads 2% above the UI on the parity program, unexplained.
       F-475 logged OPEN (normal): reconciliation reads current-month drift over a long pull as a failure.
       F-476 logged OPEN (normal): plan's estimate omits splits; the selective refresh ran 4.2x its estimate.
     Verdicts (detail and measurements in VALIDATION section ENG-2 on the branch): CLEARED V0, V2, V3, V4, V5, V6, V7,
       V8, V9, V10, V12, V13. FAILED V1 (F-473) and V11 (F-474). V2, V3, V5 and V10 cleared through a lifetime bridge:
       the UI page's figures for the pick are lifetime figures (its range control did not narrow them), so the adapter's
       own query shapes were run lifetime and equal the UI exactly on all seven counts, and the snapshot's window counts
       equal the send log's window sums.
     Spike arm (g2): answered, both halves (SPIKE-NOTES, local). Month row: no boundary or time-zone shift. Per email:
       opened equal on every email; delivered differs only by the label ruled above.
     V11's open question: SurveySentDate is set on every survey_participant row attributed to a program (0 null of
       every attributed row); unattributed rows can lack it. A month-grain denominator on it is an additive field.
     Guard-wiring: `gs-admin jo p pause --help` -> Bradley read the rendered ask: "Mutating Gainsight command: gs-admin
       journey programs pause. This workspace is read-only by default. Workspace manifests claim multiple tenants
       (<slug> (<host>); <slug> (<host>)) — confirm `gs-admin whoami` targets the intended one before approving. ⚠ At
       least one of these tenants is PRODUCTION (recorded at setup) — verify the target before approving." DECLINED.
     Walk: none owed. No SKILL.md changed this round (only the canary's stamp); the round's Walk line is above.
     Session fault, recorded again: one `gs-admin whoami` ran while run 2's calls were in flight (a local token read; run 2
       completed with no failed unit).
     Blind spots: the internal-domain list is still the operator's knowledge, not measured. The UI comparisons rest on one
       Email Chain, one classic CSAT and one Dynamic Program. F-474's 531 is one UI figure whose definition was not read.
       Whether F-473's drop also hits rows with a null person link (uniques' person path) was not separated from the
       company case: their sum is what was measured, and it equalled the company count exactly.
     Not mine to log, carried in the report to Bradley: the S1-fix ledger's cross-tenant carry on a forced full refresh.
     PR #36 stays unmerged: V1 failed, F-473 is open (normal), and the Delivered change is owed before the merge.
       CLEANUP-PLAN section S1 not run. -->

<!-- tester 2026-10-03 (JO-dashboards S1-V re-run @ hb-20261003-02 — STOPPED after run 2: V8 FAILED; F-471 and F-472 OPEN; F-470 stays FIXED; next free F-473):
     Provenance: the dev-canary skill read hb-20261003-02 in session, and the workspace's plugin link resolves to this
       checkout's plugins/gs-superadmin; feat/jo-dash-s1-facts clean and level with origin at 9482657 (matches Under
       test). Production tenant, confirmed by Bradley; CLI 1.0.10; every call a read.
     Round type: the first verdict on ENG-1 and ENG-2, which is also the adapter's first contact with a real tenant (the
       first round stopped at V0), and F-470's re-verification; judged against dev/VALIDATION.md section ENG-2 as written.
     V0: Bradley confirmed both contract changes landed as ruled (the typedef at engagement.mjs lines 126-130 and
       150-154, and readResponses at 1912-1936). Shapes 3 and 4 stand. Nothing below implies a contract change.
     Inputs on every line: both internal domains (Bradley: "all as far as I know") and two unsubscribe links, both pages
       on the company's own site, passed as the emails print them (host with www, then the page path).
     Run 1 (plan): ok. Estimate 139 calls and 1011 s; step detail adds 45 calls and 315 s; fits the token.
     Run 2 (full): exit 4, partial, 1305 s. 194 calls made, 9 reused, 28 splits, 0 retried. Reduce built no snapshot
       (every fact family is required). Two families failed:
         click-attr, 3 of 3 units (all, and one per internal domain), kind other; stderr as the fetch log records it:
         [report] normalizeGroupByDedup: removed 1 showField(s) already present in groupByFields. Error: Report must have at least one entry in showFields (spec 2.1, EMPTY_SHOW_ME_FIELDS).
         account, 5 units with "nothing left to split on": of 167 account calls, 32 returned a full page, 27 of them
         split further, and 5 one-day, flag-partitioned units still returned 5000 rows (3 programs).
       Every other family ended ok: template 15, account 162, both uniques families, classes, click-json, and the three
       survey calls (resp-month, resp-participants, resp-total).
     Verdicts: V8 FAILED (F-471, F-472). V13 partly measured: elapsed 1305 s against 1011 s estimated (1.29x, inside
       the 2x bar), calls 194 against 139; the privacy search over run 2's directory found, in 203 files, 0 with an @
       and 0 with an IPv4 pattern; step names need a snapshot. V1-V7 and V9-V12 not measurable: no snapshot. Runs 3-5
       not run, on Bradley's call: each hits both defects, and run 4 needs run 2's snapshot. Nothing CLEARED.
     F-470: stays FIXED, not verified, because V9's bar reads the snapshot. Diagnostic only, from run 2's click-json
       payload (classified at fetch time under the input): 1591 clicked sends, 59 carry a link the input named, and 36
       have only non-content links, all 36 of them input matches. So the input, as the emails print it, matches the
       links the log stores; P-unsub's attribution needs click-attr (F-471).
     UI figures for V2, V3, V5, V10, V11 and both halves of V12 were read by Bradley in this session and are kept in the
       consumer workspace for the next re-run (tenant data, never here).
     Guard-wiring: `gs-admin jo p pause --help` -> Bradley read the rendered ask: "Mutating Gainsight command: gs-admin
       journey programs pause. This workspace is read-only by default. Workspace manifests claim multiple tenants
       (<slug> (<host>); <slug> (<host>)) — confirm `gs-admin whoami` targets the intended one before approving. ⚠ At
       least one of these tenants is PRODUCTION (recorded at setup) — verify the target before approving." DECLINED.
     Walk: none owed. No SKILL.md changed this round (only the canary's stamp); the round's Walk line is above.
     Session fault, recorded: one `gs-admin whoami` was issued while run 2's calls were in flight. It is a local token
       read, and both failures are deterministic (a client-side refusal; row counts), so neither is attributable to it.
     Blind spots: the internal-domain list is the operator's knowledge, not measured. Never run: run 3's three ao_emails
       shapes and V10's participant cost, run 4's selective refresh, run 5's sent-since resolution. Whether step-click
       trips F-471's rule is unmeasured live (the static reading is in F-471). The UI view shows no spam figure, so V5's
       spam third has no UI side. The F-470 diagnostic above is not V9.
     PR #36 stays unmerged (V8). CLEANUP-PLAN section S1 not run: S1-V did not pass. -->

<!-- tester 2026-10-03 (JO-dashboards S1-V third re-run @ hb-20261003-05 — EVERY OWED CHECK PASSED; F-473..F-476 VERIFIED; F-477 and F-478 claimed here (F-477 WONTFIX, F-478 OPEN); PR #36 ready to merge; next free F-479; re-stamped):
     Riding feat/jo-dash-s1-facts -> PR #36, UNMERGED (ready to merge; the merge is Bradley's). Branch tip d8031fb, which
       logs F-478; the verdict commit is f378505 (bus statuses and VALIDATION section ENG-2 CLEARED), on the handoff at 7cc5d79.
     Status on the branch: F-470..F-476 VERIFIED; F-477 WONTFIX (polish: the readers count a went-out send with a null
       bounce flag as delivered; Bradley ruled it unreachable on the measured data, not to be built for); F-478 OPEN
       (normal: a refresh reads click history, template names and account names from the previous snapshot without the
       tenant check the facts pass; logged on Bradley's call, from the code). F-478 gates the release, not this merge.
     Production tenant, reads only; all five runs ok; detail in the tester comment on the branch.
     Open PRs to dev: #36 only.
     CI on PR #36's head d8031fb, quoted per job after completion:
         validate-plugin 37183947827 (pull_request): changes success / manifests success / validate (ubuntu-latest) success
         docs-drift 37183947798 (pull_request): drift (full) success -->


<!-- builder 2026-10-03 (JO-dashboards fourth S1 fix batch — HANDED OFF @ hb-20261003-05; F-474 FIXED on the branch; nothing OPEN; next free F-477):
     Riding feat/jo-dash-s1-facts -> PR #36, UNMERGED (it merges after the next S1-V re-run; the merge is Bradley's).
       Branch tip 7cc5d79, the handoff commit; the fix is 5285b2b. No tester run was made on hb-20261003-04; this token
       supersedes it and carries everything that handoff did (the block below).
     F-474: OPEN -> FIXED. Explained by two UI reads Bradley made, then ruled by him: the survey figures exclude test
       participants, so they equal the UI's program analytics; the survey's own page is a per-survey basis, already out
       of scope. The three survey calls carry the filter; one more call counts the rows left out. V11 judges it.
     Status on the branch: F-470, F-471, F-472 VERIFIED; F-473, F-474, F-475, F-476 FIXED. No polish finding is open.
     dev/VALIDATION.md section ENG-2 is re-banked for hb-20261003-05: what the block below lists, with V11's bar changed.
     Not run against the server: the token the builder used earlier had expired. Offline: sweep 4 of 4 as predicted; the
       two engagement suites, the doc gates and the tracked-tree typecheck re-run; no full local battery for this change.
     Open PRs to dev: #36 only. Issues #11 and #12 unchanged.
     CI on PR #36's head 7cc5d79, quoted per job after completion:
         validate-plugin 37175450173 (pull_request): changes success / manifests success / validate (ubuntu-latest) success
         docs-drift 37175450339 (pull_request): drift (full) success -->

<!-- builder 2026-10-03 (JO-dashboards third S1 fix batch — HANDED OFF @ hb-20261003-04; F-473, F-475, F-476 FIXED on the branch; F-474 stays OPEN; next free F-477):
     Riding feat/jo-dash-s1-facts -> PR #36, UNMERGED (it merges after the next S1-V re-run; the merge is Bradley's).
       Branch tip 9232cf2, the handoff commit; the fix is 1eae47d plus the review fixes in the commit before the handoff.
     The Delivered ruling landed: Delivered is the attempts that went out and did not bounce; Sent is unchanged. T-10 is
       typed and pinned and freezes at the merge; schemaVersion stays 1; the typedef and the pin moved together.
     F-473: OPEN -> FIXED. Program totals and selection come from a call that names no lookup; people and accounts are
       each counted through their own lookup; the sends with no company link, and their clicks, are read by their own
       IS_NULL calls; the stand-in CLI now drops null-lookup rows as the server does. V1 judges it.
     F-475: OPEN -> FIXED. Each reconciliation check separates closed months (a difference fails) from the incomplete
       period (drift, counted and shown; the pull still reconciles). Additive on T-10.
     F-476: OPEN -> FIXED. plan prices the splits a program-month too large for a page will force. V13 and V6 judge it.
     F-474: stays OPEN (normal), with a builder note listing what the UI's figure is not; one UI read by Bradley is
       banked. Whether it holds the merge is Bradley's call. No polish finding is open. No number consumed.
     This round the builder used the live token, at Bradley's offer, reads only: the new query shapes were accepted;
       has-a-company-link and IS_NULL were measured an exact partition of the sends and of the clicked sends; plan's
       estimates landed within 2x of the calls the hb-20261003-03 runs took. No snapshot was built from the new code.
     dev/VALIDATION.md section ENG-2 on the branch is re-banked for hb-20261003-04: owed again are V1, V2, V3, V8, V11,
       V12 and V13/V6; the rest stays cleared at hb-20261003-03.
     Offline evidence: mutation sweep 17 of 18 as predicted (the mismatch recorded under F-476); an independent
       read-only review, two findings, both fixed; local battery 46 of 47 (the red is a git-ignored local file under tsc).
     Open PRs to dev: #36 only. Issues #11 and #12 unchanged.
     CI on PR #36's head 9232cf2, quoted per job after completion:
         docs-drift 37173958472 (pull_request): drift (full) success
         validate-plugin 37173958507 (pull_request): changes success / manifests success / validate (ubuntu-latest) success -->

<!-- tester 2026-10-03 (JO-dashboards S1-V second re-run @ hb-20261003-03 — re-stamps the builder pointer below; F-470, F-471, F-472 VERIFIED; F-473..F-476 OPEN on the branch; PR #36 stays UNMERGED; next free F-477):
     Under test: feat/jo-dash-s1-facts -> PR #36, UNMERGED; checkout clean and level with origin at 96ed11e (matches Under
       test); the dev-canary skill read hb-20261003-03 in session. Production tenant, confirmed; reads only.
     All five runs completed (exit 0); every snapshot built. Verdict block, measurements and blind spots: the tester
       comment on the branch's bus at 1fae94a; per-check record: dev/VALIDATION.md section ENG-2 there (OPEN: V1 and V11
       FAILED, the other twelve CLEARED).
     Status transitions on the branch, this round:
       F-470 FIXED -> VERIFIED (V9).
       F-471 FIXED -> VERIFIED (V8, every family ok in every run, step-click included).
       F-472 FIXED -> VERIFIED (V8 and V1's cut, judged against a direct count; null-address count 0).
       F-473 logged OPEN (normal): a lookup fieldPath drops every row whose lookup is null, server side; the account table,
         click attribution and program selection lose the sends with no company link. Holds the merge (V1).
       F-474 logged OPEN (normal): the survey response denominator reads above the UI on the parity program (V11).
       F-475 logged OPEN (normal): reconciliation reads current-month drift over a long pull as a failure.
       F-476 logged OPEN (normal): plan's cost estimate omits splits (the selective refresh ran 4.2x its estimate).
     Ruled by Bradley this round, owed by the builder before the merge: Delivered = went out and did not bounce (Sent
       stays every attempt); a T-10 definition change, no schemaVersion bump (T-10 is not frozen).
     PR #36 stays unmerged. CLEANUP-PLAN section S1 not run. Open PRs to dev: #36 only.
     CI on PR #36's new head 1fae94a (pushed without [skip ci]), quoted per job after completion:
         docs-drift 37170758686 (pull_request): drift (full) success
         validate-plugin 37170758671 (pull_request): changes success / manifests success / validate (ubuntu-latest) success -->
<!-- builder 2026-10-03 (JO-dashboards second S1 fix batch — HANDED OFF @ hb-20261003-03; F-471 and F-472 FIXED on the branch; next free F-473):
     Riding feat/jo-dash-s1-facts -> PR #36, UNMERGED (it merges after the next S1-V re-run; the merge is Bradley's).
       Branch tip 96ed11e, the handoff commit; the fix is 30b69cb.
     F-471: OPEN -> FIXED. The click-attribution call no longer counts the field it groups by; validateQuery refuses any
       query that shows what it groups by, before it is spawned; the stand-in CLI applies the CLI's own rule. Judge: every
       query family through the installed CLI's normalizer (1.0.10, read from disk): the old shape refused, the rest unchanged.
     F-472: OPEN -> FIXED. The split ladder gains a last rung, a cut by the recipient's address (contains a character, or
       does not), on every family whose measures add up. A known limit is recorded in its section: the cut assumes no
       in-scope send lacks an address; that precondition is banked as one read beside V8.
     F-470: unchanged, FIXED; V9 still owed. No polish finding is open. No number consumed.
     dev/VALIDATION.md section ENG-2 on the branch is re-banked for hb-20261003-03: the list is unchanged; V8 judges both
       fixes and V1 judges F-472's cut. Nothing in it is cleared beyond V0, which Bradley confirmed at hb-20261003-02.
     Offline evidence: mutation sweep 10 of 10 as predicted (predictions first, re-run on the final code); an independent
       read-only review, no confirmed defect; local battery 46 of 47 (the red is a git-ignored local file under tsc).
     Open PRs to dev: #36 only. Issues #11 and #12 unchanged.
     CI on PR #36's head 96ed11e, quoted per job after completion:
         docs-drift 37163057132 (pull_request): drift (full) success
         validate-plugin 37163057134 (pull_request): changes success / manifests success / validate (ubuntu-latest) success -->

<!-- tester 2026-10-03 (JO-dashboards S1-V re-run @ hb-20261003-02 — STOPPED after run 2: V8 FAILED; claims F-471 and F-472, both OPEN on the branch; F-470 stays FIXED; next free F-473):
     Under test: feat/jo-dash-s1-facts -> PR #36, UNMERGED; checkout clean and level with origin at 9482657 (matches
       Under test); the dev-canary skill read hb-20261003-02 in session. Production tenant, confirmed; reads only.
     V0: Bradley confirmed both contract changes landed as ruled. Nothing observed implies a contract change; T-10 is
       still typed and pinned, not frozen (it freezes at the merge).
     Run 1 (plan) ran; run 2 (full) ended partial (exit 4), so no snapshot was built and every snapshot check is
       unmeasured. Runs 3-5 were not run, on Bradley's call. Verdict block, measurements and blind spots: the tester
       comment on the branch's bus at e97554b; per-check record: dev/VALIDATION.md section ENG-2 there (OPEN).
     Status transitions on the branch, this round:
       F-471 logged OPEN (normal): the click-attribution query groups by the field its COUNT shows, and the CLI's
         request normalizer drops that show field and refuses the empty request client-side, on every run.
       F-472 logged OPEN (normal): the account pull's split ladder bottoms out at one program-day, and mass-send days
         exceed the 5000-row page there.
       F-470: no transition, stays FIXED. V9 needs the snapshot. A diagnostic from run 2's click payload shows the
         unsubscribe input matching the stored links (detail in its section).
     V8 failed, so PR #36 stays unmerged. CLEANUP-PLAN section S1 was not run. Open PRs to dev: #36 only.
     CI on PR #36's new head e97554b (pushed without [skip ci]), quoted per job after completion:
         docs-drift 37161000488 (pull_request): drift (full) success
         validate-plugin 37161000594 (pull_request): changes success / manifests success / validate (ubuntu-latest) success -->

<!-- builder 2026-10-03 (JO-dashboards S1 fix batch — HANDED OFF @ hb-20261003-02; F-470 FIXED on the branch; next free F-471):
     Riding feat/jo-dash-s1-facts -> PR #36, UNMERGED (it merges after the S1-V re-run; the merge is Bradley's). Branch
       tip 9482657, the handoff commit; the fix is b763fcb plus the review fixes in 85dc54b.
     Landed, each as Bradley ruled at S1-V: (1) the per-program click roll-up is tracked only when every template is,
       not-tracked only when every one is, and any mix is unknown; (2) the response rate has one basis: all-time
       submitted and partially submitted beside the all-time denominator, and the read accessor never returns a window
       count beside that denominator; (3) F-470: a per-tenant unsubscribe link or host is an adapter input, a run
       parameter (echoed, part of the run's identity, a change forces a full refresh), and the generic patterns are
       unchanged. T-10 is typed and pinned and freezes at the merge; schemaVersion stays 1.
     F-470: OPEN -> FIXED on the branch (Fix, Judge and the mutation copy-out are in its section there). Its
       verification is V9 of the re-run. No other finding is open; no polish finding is open. No number consumed.
     dev/VALIDATION.md section ENG-2 on the branch is rewritten for the re-run and keyed to hb-20261003-02: V0 is a
       confirmation, V9 passes the new input, V11 compares all-time figures. Nothing in it is cleared.
     Offline evidence: mutation sweep 24 of 24 as predicted (predictions first); /code-review medium, two findings,
       both fixed with a check shown red first; local battery 46 of 47 (the red is a git-ignored local file under tsc).
     Open PRs to dev: #36 only. Issues #11 and #12 unchanged.
     CI on PR #36's head 9482657, quoted per job after completion:
         docs-drift 37147224135 (pull_request): drift (full) success
         validate-plugin 37147224088 (pull_request): changes success / manifests success / validate (ubuntu-latest) success -->

<!-- tester 2026-10-03 (JO-dashboards S1-V @ hb-20261003-01 — STOPPED AT V0; F-470 logged on the branch; next free F-471):
     Under test: feat/jo-dash-s1-facts -> PR #36, UNMERGED; checkout clean and level with origin at 30342f4 (one docs-only
       commit past the handoff); the dev-canary skill read hb-20261003-01 in session. Production tenant, confirmed.
     V0, the contract gate, came first: Bradley ruled on the four shapes. Two change before T-10 freezes, so per his
       kickoff the round stopped before any run of the adapter: (1) the per-program click roll-up is tracked only when
       every template is, not-tracked only when every one is, and any mix is unknown (R1b's "a 0 is real", held at
       program level); (2) the response rate gets one basis: all-time submitted and partially submitted beside the
       all-time denominator (additive). Shapes 3 and 4 stand as built. Both changes are the builder's, typedef and pin
       together, before the merge.
     F-470 (normal) is on the branch at ac9b6cf: the content-link classifier misses a tenant's own-site unsubscribe link,
       so unsubscribe clicks count as content. Bradley's ruling is in the section: a per-tenant input. It rides the same
       batch.
     Not run: V1-V13 and the spike arm (g2); they carry to the S1-V re-run on the builder's next token. The re-run's
       picks were settled with Bradley in this session and kept in the consumer workspace (tenant data, never here).
       Nothing in VALIDATION section ENG-2 was cleared; the round's guard-wiring line is owed by the re-run.
     CI on PR #36's new head ac9b6cf: started by the push, pending at this stamp. Quoted per job after completion, never
       asserted here first. -->

<!-- builder 2026-10-03 (JO-dashboards S1 — ENG-1 + ENG-2 HANDED OFF @ hb-20261003-01; UNMERGED, riding a branch):
     Branch feat/jo-dash-s1-facts -> PR #36, base dev, UNMERGED. It merges only after the tester round S1-V (the plan's
       merge gate); the merge is Bradley's.
     What rides it: plugin 0.44.0 — scripts/engagement.mjs (the jo-engagement adapter: plan / fetch / reduce / run) and
       the T-10 engagement snapshot contract, frozen in that script's header and pinned in test/contract-conformance.mjs;
       test/engagement.mjs (151 checks) over a fictional tenant; three new rows in data/reader-shapes.json (rp run,
       rp schema, jo p list). No skill calls the script yet, and no SKILL.md changed.
     No finding logged, no number consumed: the next free number stays F-470. Ruling (Bradley, 2026-10-03): this
       program's FEATURE items are tracked by their plan IDs (ENG-n and the rest: CONTRIBUTING, "Reading the citations
       in code comments"), never by an F-number. F-numbers stay for defects, including any a verdict round finds here.
       The feature's verdict list is dev/VALIDATION.md section ENG-2 on the branch (V0-V13), keyed to the token, and
       nothing is "noted on the verdict": an observation beside a pass bar becomes an F-section or an issue before the
       round closes.
     Under test on the branch: hb-20261003-01; blind spots = the Blind spots line in the branch's header.
     Owed by the tester round (S1-V, consumer workspace, reads only): the fourteen items of VALIDATION section ENG-2
       (V0 is Bradley's ruling on four contract shapes before T-10 freezes at merge), plus one guard-wiring line. No
       walk is owed.
     Ordering decision: nothing else pending touches what is verified. Open PRs to dev: #36 only. Issues #11 and #12
       (help wanted) are untouched.
     Local evidence on the tree committed as 522b9e7: both workflow step lists run verbatim, 43 of 45 steps green. The
       two reds are not defects in the change. `npm run typecheck` trips on one unused variable in a git-ignored local
       file CI never sees; the tracked tree type-checks clean. The full `npm run build` re-stamps the catalog's
       generatedAt, so its diff is 8 timestamp lines in 7 files; the derived generators CI's drift job runs reproduce
       the committed output exactly. /code-review medium on the working diff: 4 findings, all fixed with a check each,
       and the suites they touch re-run green. A mutation sweep over the engine's enforced rules, predictions written
       before any mutant ran: 24 of 24 mutants behaved as predicted. It ran before the review fixes.
     CI on PR #36's head 3ce590c: started by the push, pending at this stamp. Quoted per job after completion, never
       asserted here first. -->

<!-- builder 2026-09-29 (F-469 round CLOSED OUT — PR #35 merged (bc8deea); F-469 VERIFIED @ hb-20260929-01):
     Round: the acceptance round at hb-20260929-01 REOPENED F-469 on check 18: a strip path that is one segment
       plugin-relatively (a plugin-root file) is never matched. On Bradley's call the tester narrowed the claim by role
       inversion (5a386a7): check 18 is described as a best-effort lint, with its measured misses listed at the check,
       and no code path changed. The builder's verdict of record VERIFIED it (119a884): the comment lists every measured
       miss and claims nothing the probes contradicted, and the judge re-run on b03896b follows the line 10/10 on all
       three tree shapes.
     Now on dev: the header's `Dev-only: dev plugins/gs-superadmin/skills/dev-canary` line and build/dev-only.mjs, its
       one reader. RELEASE-CHECKLIST §3 cuts by hand, reading the line; §5 is dev-utils release-finish (Bradley,
       2026-09-29).
     Carried, not logged (polish, below the bus bar): check-doc-drift's pass line still reads "N shipped files name
       none of it"; qualifying it as check 18's search is a one-line follow-up.
     CI on PR #35's head 119a884, quoted per job after completion:
         docs-drift 36672861825 (pull_request): drift (full) success
         validate-plugin 36672861745 (pull_request): changes success / manifests success / validate (ubuntu-latest) success
     CI on dev after the merge (push-triggered on bc8deea), quoted per job after completion:
         docs-drift 36673845718 (push): drift (full) success
         validate-plugin 36673845727 (push): changes success / manifests success / validate (ubuntu-latest) success
     Open PRs to dev: none. Issues #11 and #12 unchanged. Next free F-470. Released: nothing (no plugin byte changed;
       dev stages nothing). Under test stays fix-f469-dev-only · hb-20260929-01 until the next handoff re-stamps it. -->

<!-- tester 2026-09-29 (acceptance round @ hb-20260929-01 — F-469, on branch fix-f469-dev-only, PR #35 unmerged):
     Provenance: dev-canary read hb-20260929-01 in session; fix-f469-dev-only, clean, level with origin at 8b8596c
       (matches Under test).
     Verdict: F-469 REOPENED (back to OPEN), pass bar (a): check 18 is silent when the line declares a one-segment
       plugin-relative path (a plugin-root file); (b) and (c) met. Detail, class and invariant test are on the entry.
     Then, the same day, a role inversion on Bradley's call: the claim is narrowed, not the matcher widened (check 18
       is a text search with no oracle, so one more patch invites one more spelling). 5a386a7 lists check 18's
       measured misses at the check, and F-469 is FIXED (tester). The verdict of record is the builder's, on the way out.
     Measured in a scratch clone only: 25 line values through the reader, dev-utils status (0.5.0) and check-doc-drift;
       21 shipped-content spellings through check 18; the strip, fetch and existence step bodies verbatim under
       bash -eo pipefail on the rehearsal and release shapes; RELEASE-CHECKLIST §3's strip and verify commands on a
       throwaway release/* branch with origin set to the clone itself (never pushed).
     Guard-wiring: `gs-admin jo p pause --help` → Bradley read the rendered ask: "Mutating Gainsight command: gs-admin
       journey programs pause. This workspace is read-only by default. Workspace manifests claim multiple tenants (…) —
       confirm `gs-admin whoami` targets the intended one before approving. ⚠ At least one of these tenants is PRODUCTION
       (recorded at setup) — verify the target before approving." DECLINED.
     Walk: none owed. No SKILL.md changed this round (only the canary's stamp).
     Blind spots: Actions itself was not run on a mutated line. The -e that makes a refusal fail a step was reproduced
       with bash -eo pipefail locally, and without it the existence body exits 0 on a refusal. The release shape used a
       local remote, not GitHub. Grammar parity was measured against dev-utils 0.5.0 through `status` only; `release`
       and `release-finish` did not run. The one-segment gap was measured for a file; a one-segment plugin-root
       directory mentioned bare (without a child) was not tried. No symlink fixture.
-->

<!-- tester 2026-09-29 (F-469 acceptance round @ hb-20260929-01 — pointer re-stamp; statuses live on the branch):
     Branch fix-f469-dev-only -> PR #35, base dev, UNMERGED. Status on the branch at 73e5bc3 (the tester's verdict
       commit, no skip marker): F-469 REOPENED (FIXED -> OPEN) @ hb-20260929-01. Check 18 does not follow a Dev-only
       line that declares a one-segment plugin-relative path (a plugin-root file). The rehearsal and release shapes,
       the refusals and grammar parity with dev-utils were met. Verdict, pass bar, class and invariant test are
       under the entry; the round's tester block (provenance, guard-wiring line, blind spots) sits under the
       branch's "Blind spots (hb-20260929-01)" line.
     RE-STAMPED 2026-09-29: now F-469 FIXED on the branch at b03896b (tester, role inversion on Bradley's call). The
       claim is narrowed, not the matcher widened: 5a386a7 calls check 18 a best-effort lint and lists its measured
       misses at the check, with no code path changed. The verdict of record is owed by the BUILDER, on the way out
       (Judge line on the entry), before PR #35 merges.
     On dev, F-469 still reads OPEN as logged at ffca105 until PR #35 merges. This comment is the pointer, not a
       second copy of the verdict.
     No finding logged, no number consumed; the next free number stays F-470. Written from a separate dev worktree;
       the tester checkout stayed on fix-f469-dev-only. -->

<!-- builder 2026-09-29 (F-469 round — HANDED OFF @ hb-20260929-01; UNMERGED, riding a branch):
     Branch fix-f469-dev-only -> PR #35, base dev, UNMERGED. Transition on the branch: F-469 OPEN -> FIXED (polish,
       Class: consumer-parity; Judge, Sibling sweep and a 17-row mutation copy-out, every row as predicted). The branch
       also carries the header's new `Dev-only:` line (dev-utils init, 0e5a0b1), which reaches dev with the merge.
       F-469 was logged here (ffca105); the branch consumes no other number, so the next free is F-470.
     Under test on the branch: hb-20260929-01; blind spots = the Blind spots line in the branch's header.
     Owed by the tester round (acceptance, a new mechanism): the F-469 verdict, measured in scratch copies only — sibling
       Dev-only values, the two workflow step bodies through bash, RELEASE-CHECKLIST §3 on a throwaway release branch in
       a clone, and a grammar comparison against `dev-utils status` — plus one guard-wiring line. No SKILL.md changed, so
       no walk is owed. Reload: no plugin byte changed; /reload-plugins picks up the canary's new stamp.
     Decision of record (Bradley, 2026-09-29): RELEASE-CHECKLIST §3 stays a hand cut whose strip reads the Dev-only line,
       and §5's tag, delete and switch steps become dev-utils release-finish.
     Ordering decision: nothing else pending touches what is verified. Open PRs to dev: #35 only. Issues #11 and #12
       (help wanted) are untouched.
     Local evidence on the branch: doc-drift suite 208/208 on the full tree (207/207 on the rehearsal and release
       shapes, before the M10 control pin); docs-drift's step list run verbatim on both stripped shapes in scratch
       clones; Validate, the four checks and typecheck green.
     CI on PR #35's head 8b8596c, quoted per job after completion:
         docs-drift 36667392177 (pull_request): drift (full) success
         validate-plugin 36667392152 (pull_request): changes success / manifests success / validate (ubuntu-latest) success
         docs-drift 36667397546 (workflow_dispatch): drift (full) success / drift (stripped) success — the stripped
           arm read the set from dev/FEEDBACK.md before its strip and from HEAD after it, and ran the suite 208/208
       PR #35: MERGEABLE, CLEAN.
     RE-STAMPED 2026-09-29 (builder): F-469 VERIFIED on the branch at 119a884, the builder's verdict of record on the
       tester's role-inverted fix (5a386a7; no code path changed). The check 18 comment lists every measured miss and
       claims nothing the probes contradicted, and the judge re-run on b03896b follows the line 10/10 on all three tree
       shapes. CI on PR #35's head 119a884, quoted per job after completion:
         docs-drift 36672861825 (pull_request): drift (full) success
         validate-plugin 36672861745 (pull_request): changes success / manifests success / validate (ubuntu-latest) success
       PR #35 reads MERGEABLE, CLEAN and is UNMERGED: the merge is Bradley's. On dev, F-469 reads OPEN until it merges.
       Carried, not logged (polish): check-doc-drift's pass line still reads "N shipped files name none of it". -->

<!-- tester 2026-09-28 (verdict round @ hb-20260928-02 — F-461 and F-466, on branch fix-f461-f466, PR #33 unmerged):
     Provenance: dev-canary read hb-20260928-02 in session; fix-f461-f466, clean, level with origin at c35273f (matches
       Under test); tenant (gs-admin whoami): the sandbox.
     Load check: the workspace's .gs-superadmin/plugin junction resolves into the repo's plugins/gs-superadmin working tree
       (not the 0.43.0 cache); the linked plugin.json reads 0.43.3. Session started after the hook's last commit.
     Arms:
       F-466 in place: P1-P6 meet the stated bar; nine own siblings (S1-S9, on the entry), S1 carrying the property — an
         operator its words cannot reach stays unjudged on a line that does run gs-admin. VERIFIED.
       F-466 live: the kickoff's archive | tar pipeline ran exit 0, no deny; Bradley, told before the run, saw no prompt
         (auto mode). An earlier two runs of it went unwatched and are not counted as the rendered measurement.
       F-461 walk (slash-typed by Bradley): a KB-built threshold ticket (90 → 120 days on an inactive sandbox CTA rule);
         Before building = two lines, both passing the per-line test; stopped at the plan, nothing executed. VERIFIED.
       F-461 offline arm: whoami's real lines read both ways in one session (`Token: valid (expires in 5s)` → live;
         `Token: expired` → offline); `Auth mode: not configured` printed in both states and rightly ignored.
     Guard-wiring: `gs-admin jo p pause --help` → Bradley read the rendered ask: "Mutating Gainsight command: gs-admin
       journey programs pause. This workspace is read-only by default. Workspace manifests claim multiple tenants (…) —
       confirm `gs-admin whoami` targets the intended one before approving. ⚠ At least one of these tenants is PRODUCTION
       (recorded at setup) — verify the target before approving." DECLINED.
     Blind spots: the offline branch was observed as whoami text only — the walk itself ran live (token refreshed before
       the reads), so a plan header reading `verification: KB-only (CLI unavailable)` was not produced this round; the
       walk exercised the two-line case, never the empty-line case; the live arm is one shape on bash only (PowerShell
       lane probed in place, not live); pwsh 7 and macOS remain CI's.
-->

<!-- tester 2026-09-28 (#28 walk round @ hb-20260928-01 — first live walk of #31/#32, no finding under test, on dev):
     Provenance: dev-canary read hb-20260928-01 in session; dev, clean, level with origin at 6a86219 (matches Under test);
       gs-admin --version 1.0.10; tenant: the sandbox.
     Load check: the workspace's .gs-superadmin/plugin junction resolves into the repo's plugins/gs-superadmin working tree
       (not the 0.43.0 cache), and the linked plugin.json reads 0.43.2. Both skills' base directories resolved there.
     Walks (object `Playbook` in every arm; verbatim caveats in dev/VALIDATION.md § PR #31 / PR #32 (#28)):
       A1 deps-report (tester-invoked, live): capture COMPLETED attempt 1 (1.5 s); 10 reports / 16 rows; live section
         RENDERED; 2 caveats, no "KB-derived view — corroborate live" line → PASS (#28 stays closed).
       A2 deps-report --no-live: same counts; 3 caveats, the third "KB-derived view — corroborate live … --name
         'Playbook' …" → PASS.
       B1 email-report deps (tester-invoked, live): sweep reconciled 1085/1085; gap 1754 → 4b ask rendered, Bradley chose
         Skip; JO capture COMPLETED attempt 1 (1.2 s); 0 field-usage rows, objectsTouched []; live section RENDERED (0 JO
         dependents); 2 caveats (scope, filter-conditions-only), no "KB-derived, JO-scoped view" line → PASS. Pre-#32
         source (7f66d40^) falls back to the --object terms when objectsTouched is empty, so the old code would have
         named Playbook: the arm discriminates.
       B2: SKIPPED. B1 lists no field-level rows.
     Guard-wiring: `gs-admin jo p save --id <nil uuid>` → Bradley read the rendered ask: "Mutating Gainsight command:
       gs-admin journey programs save. This workspace is read-only by default. Workspace manifests claim multiple tenants
       (…) — confirm `gs-admin whoami` targets the intended one before approving. ⚠ At least one of these tenants is
       PRODUCTION (recorded at setup) — verify the target before approving." DECLINED; no journal row written (checked
       both journals: no entry dated 2026-09-28/29).
     Blind spots: B2 unwalked, so the live JO-scoped caveat was never seen present-and-naming. Playbook has no JO usage on
       the sandbox, and choosing an object with participant-source field rows would have exercised B2 (the object was
       fixed by A1/A2 before B1 showed this). B1 exercises the --object-term fallback only, not a non-empty
       touched-objects list. The partly covered and never-COMPLETED cases stay offline-only, as banked. deps-report's
       touched-objects fallback is still unwalked (off-skill). Both captures completed first try, so the --wait poll
       path went unexercised. A report's date suffix follows UTC (2026-09-29 files on a 2026-09-28 local evening), and
       that is not a finding. -->

<!-- tester 2026-09-26 (0.43.0-gate-V @ hb-20260926-03 — acceptance round for F-464, F-467 and F-468, on branch release-gate-0-43-0):
     Provenance: dev-canary read hb-20260926-03 in session; checkout release-gate-0-43-0, clean, level with origin at 8950478
       (matches Under test); gs-admin --version 1.0.10; tenant: the sandbox.
     Verdicts: F-464 VERIFIED, F-467 VERIFIED, F-468 VERIFIED (pass bars and measurements on each section). Two polish
       observations noted on the verdicts, not logged: the operating model's auth line omits the `Base URL: (not set)` state
       (F-464's; a candidate for F-461's round), and check 16's cascade "no such bullet" message on the unindented-
       continuation refusal (F-468's).
     Walks (every SKILL.md the round changed, once, for real):
       setup --budget 1 (slash, typed by Bradley): Phase 1 decided on whoami's `Token: valid (expires in 3252s)` line, with the
         `Auth mode: not configured — run 'gs-admin login'` line beside it read as normal, exit code not an input; pre-flight
         1.0.10 rule, usable ≈ 3192 s. Phase 2 reused the manifest slug (init: existed, environment sandbox), plugin link
         "(current)". Phase 3: scaffold 0 copied / 1 refreshed (operating-model.md) / 0 adopted / 0 offered; pack present (§2
         skipped); bundle copied; catalog + cheatsheet regenerated at 1.0.10 (188 commands; the cheatsheet header cites
         v1.0.10 — post-condition held); §4-§7 already in place (87 of 87 MCP ask entries, both deny and both allow rules,
         .gitignore entries, the CLAUDE.md block listing both instances; 0 entries added); §8 versions agree (catalog,
         ask-rules and version.json at 1.0.10). STOPPED at the Phase 4 boundary per the round's prompt.
       No other SKILL.md changed this round (F-467's prose moved in setup's references/index-scope-notes.md, read on the verdict).
     Guard-wiring: `gs-admin jo p save --id <nonexistent>` → Bradley read the rendered ask: "Hook PreToolUse:Bash requires
       confirmation for this command: Mutating Gainsight command: gs-admin journey programs save. This workspace is read-only
       by default. Workspace manifests claim multiple tenants (<prod-slug> (<prod-url>); <slug> (<sandbox-url>)) — confirm
       `gs-admin whoami` targets the intended one before approving. ⚠ At least one of these tenants is PRODUCTION (recorded at
       setup) — verify the target before approving." DECLINED; no journal row written (the sandbox journal's newest entry
       is 2026-09-08).
     Blind spots (tester): setup Phases 4-6 not executed; the `Token: expired` / `none` and `Base URL: (not set)` branches read
       from whoami.js, not run (the one expired reading this session was a reset in progress, not banked); F-467 on a
       constructed catalog stamped 1.0.9, never a real 1.0.9 install, and its data-designer scope row unexercised (no such
       domain in the sandbox's manifest); change-request's offline-mode sentence unwalked (carried to F-461); the macOS leg
       and pwsh 7 unmeasured here.
     CI on PR #29 at the handoff head 8950478, quoted per job after completion (gh pr checks 29):
         validate-plugin 36276549562: changes pass / manifests pass / validate (ubuntu-latest) pass
         docs-drift 36276549561: drift (full) pass
         GitGuardian Security Checks: pass
       No macOS or Windows validate leg ran on this PR. This commit (no skip marker) starts new runs. -->

<!-- tester 2026-09-26 (1.0.10-V @ hb-20260926-01 — acceptance round for F-462 and F-463, on branch adopt-cli-1-0-10):
     Provenance: dev-canary read hb-20260926-01 in session; checkout adopt-cli-1-0-10, clean, level with origin at 75e3fd8
       (matches Under test); gs-admin --version 1.0.10; tenant: the sandbox.
     Verdicts: F-463 VERIFIED. F-462 REOPENED (check 16 held the canon to presence — U1 formula swap read "2 of 2"; CP-6 (b)
       BROKEN) and re-FIXED by the tester in a ROLE INVERSION at Bradley's instruction (check 16 parses the canon's bullets;
       paraphrases refuse any arithmetic spelling; CP-3 entries say the symptom persists on 1.0.10) — THE BUILDER OWES
       ITS VERDICT: re-run the F-462 mutation copy-out (M1, U1-U5) and test-check-doc-drift (135), read the two CP-3 edits.
       Local battery after the inversion: 40/40 green (the AGENTS.md fence verbatim, typecheck and both strict validates
       included, minus the bundle rebuild — only a checker changed in build/, no generator or catalog).
     VALIDATION: CP-6 (a) FIXED, (b) BROKEN, (c) FIXED, (d) FIXED; § F-463 FIXED (no CORS field on the sandbox's OAuth app
       form; auth.md's CORS clause is the owed polish drop). All CLEARED.
     Walks (every SKILL.md the round changed, once, for real):
       setup --budget 1 (slash, typed by Bradley): Phase 1 picked "CLI 1.0.10 and later", usable ≈ 3091 − 60 = 3031 s; whoami
         printed "Auth mode: not configured — run 'gs-admin login'" beside "Token: valid" (enrollment path) — decided on the
         Token line; Phase 2 reused the manifest slug, plugin link "(current)"; Phase 3: scaffold 0 copied / 1 refreshed
         (operating-model.md) / 0 adopted / 0 offered, pack present, bundle copied, catalog + cheatsheet regenerated at
         1.0.10 (188 commands, post-condition held), §4-§7 already in place (0 entries added), §8 versions agree. STOPPED at
         the Phase 4 boundary on Bradley's call: Phases 4-6 unchanged this round, and a full re-index would have run beside
         the CP-6 (a) loop on the same token (parallel calls unmeasured on 1.0.10). The Phase 5 batch-sizing parenthetical
         (the only other setup change) was read, not executed.
       refresh (slash, typed by Bradley): pre-flight stated "on 1.0.10 and later nearly all of it" of 2940 s (canon: 2880 s)
         — covers; environment recorded, no backfill; first list read `re rules list --filter-modified-date last_11_days`
         → 0 rows, exit 0; stopped there as planned (no upsert).
       email-report search (tester-invoked, one phrase): pre-flight "on 1.0.10 and later nearly all of it" of 3363 s;
         paginate sweep reconciled 1085/1085; index 1075 programs; gap 1754 → the 4b ask rendered (tester's own
         AskUserQuestion; Bradley chose Skip); report written, 3 caveats.
       deps-report (tester-invoked, one object): pre-flight same wording, 3273 s; live dm deps check COMPLETED on attempt 2
         (17.6 s); 10 reports / 16 rows matched, live section rendered. Noticed, out of scope: the report's third caveat
         still says to corroborate live via --live-deps although a capture was passed.
       change-request: two version stamps only — structurally determined, not walked (no prose or step changed).
     Guard-wiring: `gs-admin jo p save --id <nonexistent>` → Bradley read the rendered ask: "Mutating Gainsight command:
       gs-admin journey programs save. This workspace is read-only by default. Workspace manifests claim multiple
       tenants (…) — confirm `gs-admin whoami` targets the intended one before approving. ⚠ At least one of these tenants
       is PRODUCTION (recorded at setup) — verify the target before approving." DECLINED; no journal row written.
     Also observed: the guard's pipe lint fired on `git -C <path containing "gs-admin"> archive HEAD | tar -x …` (a
       non-gs-admin command whose path contains the word) — worked around with `git archive -o`; not logged.
     Blind spots (tester): setup Phases 4-6 not executed; the desktop app's "Add from repo" form and its auto-update toggle
       unconfirmed (no desktop walk); no newcomer dry run from a machine with nothing installed; the macOS leg and pwsh 7
       unmeasured here; the CP-6 (a) failure point measured at ~13 s resolution; the F-462 inversion is unverified by the
       other role until the builder's pass; dist/artifacts byte-identity still rests on the gs-fortress audit.
     CI on PR #27 at the handoff head 75e3fd8, quoted per job after completion (gh pr checks 27):
         validate-plugin 36266783083: changes pass / manifests pass / validate (ubuntu-latest) pass
         docs-drift 36266783226: drift (full) pass
         GitGuardian Security Checks: pass
       No macOS or Windows validate leg ran on this PR. This commit (no skip marker) starts new runs. -->

<!-- builder 2026-09-28 ([v]0.43.3 RELEASED — post-release housekeeping):
     Payload: deps-report, and email-report's deps mode, stop telling you to corroborate objects that a completed live
       capture already covers (0.43.1, #31, an outside contribution; 0.43.2, #32); the guard's pipe lint judges only
       what a gs-admin call's words can reach (0.43.3, F-466); change-request's offline-mode condition and step 4
       sentence corrected (0.43.3, F-461). Staged versions folded in: 0.43.1, 0.43.2, 0.43.3.
     Gate 1 (bus): terminal — F-461 and F-466 VERIFIED @ hb-20260928-02 (step 0: nothing to re-open, no open polish);
       open PRs to dev: none. VALIDATION § PR #31 / PR #32 (#28) CLEARED @ hb-20260928-01.
     Gate 2 (review): /code-review medium over origin/main...dev — 1 finding (the 0.43.3 CHANGELOG entry overstated
       "no approval prompt is removed"), fixed on dev in 39fedc5, docs-only. /security-review — run, no findings;
       highest severity none. Notes, not findings: the lint's chain walk costs more on a ~200 KB command (excluded as
       DoS); the npx and node-path spellings run unguarded, as the README already documents.
     Cut: release/[v]0.43.3 from dev @ 39fedc5, ONE commit beyond (the strip, a3a6c21); stripped tree: both strict
       validates PASS; battery verbatim 42/42 (and 41/41 on the dev tip 545d730 first).
     CI on the release PR #34, QUOTED per job after completion:
         validate-plugin 36529805162: manifests success / ubuntu success / macos success / windows success (changes success)
         docs-drift 36529805180: drift (full) success
         pr-target-guard 36529805157: guard success
         GitGuardian Security Checks: pass
     Merged by Bradley (main @ 5353b7f); tag [v]0.43.3 pushed; release branch deleted local + remote (the remote by
       GitHub's delete-on-merge); checkout back on dev. dev-utils release-finish refused, since from the stripped
       release checkout it found no bus, so §5 ran by hand.
     Housekeeping: F-461 and F-466 moved VERBATIM to the archive (live 2 → 0, archive 19 → 21, sum 21; block sha256
       04046a4a05a06defe69cf3c100b46404bc72f9e34b338fc924bc067bacd2a61a); entry hint updated. Under test and canary
       NOT re-stamped: dev-utils handoff refused twice today, before the cut and again after the archive. The header's
       tester block names today's hb-20260928-01, and no provenance line has carried it since the hb-20260928-02
       handoff replaced its Blind spots line: the same guard gap as the 0.43.0 close-out, not bypassed. The line keeps
       naming the merged and deleted fix-f461-f466 · hb-20260928-02; the next handoff re-stamps it (from 2026-09-29
       that mention is another day's token). Next free number F-469. Released: 0.43.3; dev stages nothing.
     Now live from main: nothing (no workflow or Dependabot policy change in the payload).
     GitHub Release: https://github.com/BradleyDB/gs-admin-cli-docs/releases/tag/v0.43.3 (notes = the CHANGELOG entries
       since the previous tag, newest first, after the fixed intro).
     Consumer refresh: claude plugin marketplace update gs-admin-cli-docs; claude plugin update
       gs-superadmin@gs-admin-cli-docs.
     Carried forward (not in this release): VALIDATION's `re r executions` production arm; issues #11 and #12
       (enhancements). -->

<!-- builder 2026-09-28 (F-461 + F-466 release-prep round CLOSED OUT — MERGED):
     PR #33 merged to dev by merge commit (1d8f880, on Bradley's call); its head was 8edcea6, the tester's verdict
       commit. Verdicts of record (tester @ hb-20260928-02, now on dev): F-461 VERIFIED, F-466 VERIFIED. No finding
       logged.
     CI on PR #33, quoted per job after completion (gh run view), both heads:
         c35273f (the handoff) validate-plugin 36524543170: changes success / manifests success / validate (ubuntu-latest) success
         c35273f (the handoff) docs-drift 36524543040: drift (full) success
         8edcea6 (the verdicts) validate-plugin 36525671205: changes success / validate (ubuntu-latest) success / manifests success
         8edcea6 (the verdicts) docs-drift 36525671201: drift (full) success
         GitGuardian Security Checks on 8edcea6: pass
     Builder read of the verdicts: pass bars stated before measuring, the Fix notes' properties tested with the
       tester's own siblings (F-466 S1-S9; S1 is the property itself), the live arm and the rendered guard-wiring ask
       attributed by Bradley, not inferred. Not taken: step 4's "gets that line" is singular where the walked ticket
       got two lines; the tester read it per fact and logged nothing, and rewording would owe another walk.
     Branch fix-f461-f466 deleted local + remote. Next: the 0.43.3 release (dev/RELEASE-CHECKLIST.md §1). Next free
       F-469. -->

<!-- tester 2026-09-28 (F-461 + F-466 verdict round @ hb-20260928-02 — pointer re-stamp; statuses live on the branch):
     Branch fix-f461-f466 -> PR #33, base dev, UNMERGED (merging stays Bradley's call). Statuses on the branch, at
       8edcea6 (the tester's verdict commit, no skip marker): F-461 VERIFIED, F-466 VERIFIED, both @ hb-20260928-02.
       Verdicts, pass bars and the round's tester block (provenance, load check, arms, guard-wiring line, blind spots)
       are in the branch's dev/FEEDBACK.md under each entry and under the "Blind spots (hb-20260928-02)" line.
     On dev, F-461 and F-466 still read as the builder's handoff left them until PR #33 merges; this comment is the
       pointer, not a second copy of the verdicts.
     CI on PR #33's head 8edcea6: started by the push; at this stamp changes and GitGuardian pass, drift (full),
       manifests and validate (ubuntu-latest) pending — per-job conclusions are the builder's to quote after completion.
     No finding logged. Written from a separate dev worktree; the tester checkout stayed on fix-f461-f466. -->

<!-- builder 2026-09-28 (F-461 + F-466 release-prep round — HANDED OFF @ hb-20260928-02; UNMERGED, riding a branch):
     Branch fix-f461-f466 -> PR #33, base dev, UNMERGED. Transitions on the branch: F-461 and F-466 DEFERRED (past
       0.43.0) -> Reopened -> FIXED. Both Reopen triggers named the next release ceremony, and Bradley chose fix-now
       for a clean release. F-466 carries Class: second-scanner, a Judge line (the shell: guard-oracle's new mustNotLint
       rows, 59 red on the pre-fix hook, 0 on the fix), a vacuity-check copy-out (8 KILLED, 1 SURVIVED, all as
       predicted) and a Sibling sweep. F-461 also carries F-464's offline-mode sentence. No F-number consumed; next free
       F-469.
     Under test on the branch: hb-20260928-02; blind spots = the Blind spots line in the branch's header.
     Owed by the tester round: verdicts on F-461 and F-466; the change-request walk (slash-only, so Bradley types it);
       for F-466, the repro rows P1-P6 driven through the hook in place, plus one harmless pipeline carrying the name
       issued live in the tester session; one guard-wiring line. Reload: restart the session (a hook change).
     Ordering decision: nothing else pending touches what is verified. Not in this round: the operating model's auth
       line omitting `Base URL: (not set)` (0.43.0-gate-V's unlogged observation), because setup Phase 1 owns that
       pre-setup state and an always-on line would cost every session.
     Local evidence on the branch: the full battery ran green except typecheck, which failed on an em dash in a new
       @param description (TS1127); after that one-character fix, typecheck, guard-fixtures and the three doc gates
       re-ran green. guard-oracle: 768 lines, 0 bypass, 0 pipe-lint deny on a line that ran no gs-admin. CI on
       PR #33's head: started by the push, pending at this stamp — quoted after completion, never asserted here first.
     After the verdicts and the merge: the release resumes at dev/RELEASE-CHECKLIST.md §1. -->

<!-- builder 2026-09-28 (#28 walk round CLOSED OUT — CLEARED @ hb-20260928-01):
     Verdict of record: the tester's (e370d88). dev/VALIDATION.md § PR #31 / PR #32 (#28) is CLEARED: A1, A2 and B1 PASS;
       B2 SKIPPED (the walked object has no JO field-level rows on the sandbox), which the banked pass bar allowed. No
       finding logged.
     Builder read: the tester's discrimination claim checks out against source. At 7f66d40^ the JO list was
       `objectsTouched.length ? objectsTouched : opts.objectTerms`, so B1's empty touched list would have named the
       object before #32. #32's JO change is one filter over whichever list is chosen, and B1 ran it live, including
       the termKey fold (the capture's objectName came back lowercase against a capitalised term); A1 ran #31's eqTerm
       fold the same way. What stays unwalked live is the unchanged list-choice and emission code: a non-empty JO
       touched list, the JO caveat present and naming (B2), the partly covered and never-COMPLETED cases, and
       deps-report's off-skill fallback. All of it is pinned offline (K1-K4 in the handoff block below). Accepted
       without a second arm.
     CI on the handoff tip 6a86219, quoted per job after completion (gh run view):
         docs-drift 36520507827: drift (full) success
         validate-plugin 36520507822: changes success / validate (ubuntu-latest) success / manifests success
       The tester's tip e370d88 carries [skip ci]; no runs started on it.
     Next: the release carrying 0.43.1 and 0.43.2 (dev/RELEASE-CHECKLIST.md §1). Step 0 re-opens F-461 and F-466, both
       deferred past 0.43.0, an older version. Each needs a fix, a WONTFIX, or a fresh manual Defer before the gate.
       Next free number F-469. -->

<!-- builder 2026-09-28 (#28 walk round — HANDED OFF @ hb-20260928-01; MERGED, on dev):
     Round type: first live walk of shipped behaviour (the PR #17 precedent). No finding is under test. #31 (outside
       contributor, issue #28, deps-report's corroborate-live caveat) merged to dev @ 7a75662 as plugin 0.43.1; #32
       (maintainer follow-up: the same rule for email-report's deps mode and deps-report's touched-objects fallback)
       @ 7f66d40 as 0.43.2. Both shipped walked on fixture KBs only; #28 is closed by hand (dev is not the default
       branch).
     Owed by the tester round: dev/VALIDATION.md § PR #31 / PR #32 (#28), arms A1/A2 (deps-report) and B1/B2
       (email-report deps). Both skills are model-invocable, so the tester invokes them; the live dm deps check needs
       the operator's logged-in CLI. Plus one guard-wiring line.
     Load check owed before any arm: the workspace's .gs-superadmin/plugin link must resolve into this working tree,
       not an installed cache. The skills run their scripts through that link, so a cached 0.43.0 target would pass
       the canary and walk the pre-fix scripts.
     Ordering decision: nothing pending re-arranges what is walked. F-461 (polish) and F-466 (normal) stay DEFERRED
       past 0.43.0 and are not in this round; step 0 of the next release reopens both.
     Evidence: local battery green on 61307bf (every test runner, check-stale-facts / doc-drift / imports /
       instance-data, typecheck, bundle rebuild with no drift, both strict validates); 61307bf's tree equals 7f66d40's.
       Vacuity check, not closure: the mutants come from #32's own decision points (which list is filtered, the
       COMPLETED guard, the fallback filter, its fold), and no predictions were recorded before the run, so the
       results below carry no pred: column. K1 JO filter on the touched list only, K2 JO filter on the --object
       fallback only, K3 JO coverage set counting INIT captures and K4 tenant-deps fallback left unfiltered were each
       killed by a #28 pin. K5, the tenant-deps fallback compare without its fold, survived: every fixture object
       name is already lowercase, so the fold is defensive. Disclosed on PR #32 and left unpinned.
       CI on PR #32's head 61307bf, quoted per job after completion (gh pr checks 32):
         validate-plugin 36519731729: changes pass / manifests pass / validate (ubuntu-latest) pass
         docs-drift 36519731799: drift (full) pass
         GitGuardian Security Checks: pass
       CI on the handoff tip: started by the handoff push, pending at this stamp — quoted after completion, never
       asserted here first. No macOS or Windows validate leg ran; the next release PR's 3-OS matrix covers them.
     Next free number F-469. -->

<!-- builder 2026-09-26 ([v]0.43.0 RELEASED — post-release housekeeping):
     Payload: CLI pin 1.0.9 → 1.0.10 (gs-fortress audit-1.0.10, CP-1..CP-7) — the token pre-flight version-conditional
       (the 1.0.7–1.0.9 half-life rule kept, 1.0.10 and later remaining − 60s), the sc measures --id entries scoped and
       re-measured (the symptom persists on 1.0.10, cause unknown), reference/auth.md for 1.0.10; the README beginner path
       (§1–3 from nothing installed; the plugin README Quick start and setup's first-run login give --base-url); the
       per-CLI facts table at every verified version (1.0.9 and 1.0.10); setup decides auth on whoami's lines. Staged
       versions folded in: 0.43.0.
     Gate 1 (bus): terminal — F-462, F-463, F-464, F-467, F-468 VERIFIED; F-465 WONTFIX (re-homed to issue #28); F-461 and
       F-466 DEFERRED past 0.43.0 (Bradley, reopen triggers on the sections); open PRs to dev: none.
     Gate 2 (review): /code-review medium over origin/main...dev — 2 findings (F-467 normal, F-468 polish), both fixed on dev
       through the loop (PR #29, tester-verified @ hb-20260926-03); /code-review low over the fix delta — 0 findings;
       /security-review — run, no findings; highest severity none.
     Cut: release/[v]0.43.0 from dev @ b3e0e52, ONE commit beyond (the strip, 78155ea); stripped tree: both strict
       validates PASS; battery verbatim 42/42. The dev tip was not re-run in full: only bus text changed after the 41/41
       run on 8950478 (the non-bus diff to the tip is empty), and the bus-reading gates re-ran green on the tip.
     CI on the release PR #30, QUOTED per job after completion:
         validate-plugin 36278358201: changes success / manifests success / ubuntu success / windows success / macos success
         docs-drift 36278358194: drift (full) success
         pr-target-guard 36278358210: guard success
     Merged on Bradley's approval (main @ efef1a5); tag [v]0.43.0 pushed; release branch deleted local+remote (GitHub
       auto-deleted the remote at merge); checkout back on dev.
     Housekeeping: F-462..F-465, F-467, F-468 moved VERBATIM to the archive by dev-utils archive (live 8 → 2, archive
       13 → 19, sum 21; block sha256 8b1918cbaa0157c482209f83ca03f463984e3d48ce164befca93c3053695939c — the bus copy differed only in where one separator blank line sat); entry hint
       updated. Under test + canary stay dev · hb-20260926-04 (on dev since the gate round's close-out): dev-utils handoff refused a fresh mint as a stale header draft, because its guard (profiles.header_drafts) counts provenance on the bus only while its mint reads the archive too, so the tester's 0.43.0-gate-V comment naming hb-20260926-03 reads stale once that token's Verified lines are archived; not bypassed, and the tester's text is not rewritten; the dev-utils fix is flagged in its own repo. Next free number F-469. Released: 0.43.0; dev stages nothing.
     Now live from main: nothing new — no .github change since [v]0.42.0.
     GitHub Release: https://github.com/BradleyDB/gs-admin-cli-docs/releases/tag/v0.43.0 (notes = the CHANGELOG entry since
       [v]0.42.0).
     Consumer refresh: claude plugin marketplace update gs-admin-cli-docs; claude plugin update
       gs-superadmin@gs-admin-cli-docs.
     Carried forward (not in this release): F-461, F-466 (DEFERRED past 0.43.0); issues #11, #12, #28; the tester's two
       unlogged polish notes (the operating model's auth line does not name Base URL: (not set); check 16's cascade
       "no such bullet" message); gs-fortress F1 (CP-8) and B1 (CP-9). -->

<!-- builder 2026-09-21 ([v]0.42.0 RELEASED — post-release housekeeping):
     Payload: the guard closes the PowerShell assignment / positional / value-option spellings and its repeat ask names the
       remedy; the describe loop aborts within a run and gates reads by actionKey; report truth (byDepth / domainCounts /
       changeDetection / docPathsUnknown, reconcile-docs); evidence-bound exclusions; one home per fact + the scope relay;
       change-request's Before building section and the operating model's Role passage; KI-018. Staged versions folded in:
       0.37.1, 0.38.0, 0.39.0, 0.40.0, 0.41.0, 0.41.1, 0.41.2, 0.42.0.
     Gate 1 (bus): terminal — F-448..F-460 all VERIFIED; F-461 (polish) auto-deferred past 0.42.0 at step 0 (e66507d);
       open PRs to dev: none. VALIDATION § PR #17 CLEARED on both arms @ hb-20260921-01.
     Gate 2 (review): /code-review low over origin/main...dev — 0 findings; /security-review — run, no findings;
       highest severity none.
     Cut: release/[v]0.42.0 from dev @ e66507d, ONE commit beyond (the strip, 496a9ab); stripped tree: both strict
       validates PASS; battery verbatim 42/42 (and 42/42 on the dev tip first).
     CI on the release PR #26, QUOTED per job after completion:
         validate-plugin 35693101588: changes pass / manifests pass / ubuntu pass / macos pass / windows pass
         docs-drift 35693101605: drift (full) pass
         pr-target-guard 35693101612: guard pass
     Merged on Bradley's instruction (main @ 7daa116); tag [v]0.42.0 pushed; release branch deleted local+remote
       (GitHub auto-deleted the remote at merge); checkout back on dev.
     Housekeeping: F-448..F-460 moved VERBATIM to the archive by dev-utils archive (live 14 → 1, archive 0 → 13, sum 14;
       block sha256 17968653d688bfff90640cea7e0f1fdc526c5c2fd43b811cce04543ffb44edb8 — the bus copy differed only by one
       trailing blank line), plus the four header Walk lines (hb-20260914-01, -15-01, -15-02, -16-01) to its Walks section;
       entry hint updated; Under test + canary → dev · hb-20260921-02. Next free number F-462. Released: 0.42.0; dev stages
       nothing.
     Now live from main: the validate-plugin and pr-target-guard workflow edits since v0.37.0 (path-filtered push trigger,
       the changes/manifests split, the PowerShell oracle lane) — no Dependabot policy change shipped.
     GitHub Release: https://github.com/BradleyDB/gs-admin-cli-docs/releases/tag/v0.42.0 (notes = the CHANGELOG entries
       since v0.37.0).
     Consumer refresh: claude plugin marketplace update gs-admin-cli-docs; claude plugin update
       gs-superadmin@gs-admin-cli-docs.
     Carried forward (not in this release): F-461 (step 4 "gets exactly that" sentence; a SKILL.md change, walk owed);
       VALIDATION's `re r executions` production arm (finding only if production is empty too); issues #11, #12
       (enhancements). -->

<!-- builder 2026-09-26 (0.43.0 release-gate round CLOSED OUT — MERGED):
     PR #29 (release-gate-0-43-0) merged to dev at 9f1c606 on Bradley's instruction ("continue with release process if
       all checks out"); the branch deleted; checkout on dev. F-464, F-467, F-468 VERIFIED @ hb-20260926-03 (tester);
       the tester's verdict commit changed only the bus, so nothing role-inverted awaits a builder verdict.
     CI on PR #29's head e9629cf (pull_request), quoted per job after completion: validate-plugin 36277286009: changes
       success / validate (ubuntu-latest) success / manifests success; docs-drift 36277286010: drift (full) success;
       MERGEABLE / CLEAN at merge.
     Release gate §2, recorded: /code-review medium over origin/main...dev — 2 findings (F-467 normal, F-468 polish),
       both fixed on dev through the loop (PR #29, tester-verified); /code-review low over the fix delta
       (origin/dev...release-gate-0-43-0) — 0 findings; /security-review over origin/main...release-gate-0-43-0 — no
       findings (guard untouched; generated files stamp-only; the pin-facts change advisory, its interpolated version
       bounded to the verified list); highest severity none.
     Tester observations noted on the verdicts, not logged: the operating model's auth-error line does not name the
       Base URL: (not set) state (F-464's class; a candidate for F-461's round); check 16's cascade "no such bullet"
       message beside the unindented-continuation refusal (F-468's; the check fails closed and names the real miss
       first). Next free number F-469. Under test + canary move to dev with this close-out; the cut follows. -->

<!-- builder 2026-09-26 (0.43.0 release gate — review fixes HANDED OFF; UNMERGED, riding a branch):
     Branch release-gate-0-43-0 -> PR #29, base dev, UNMERGED. The release-gate /code-review (medium, origin/main...dev)
       found F-467 (normal: the per-CLI facts table stamped for 1.0.10 only, so 1.0.9 workspaces lost it) and F-468
       (polish: check 16's canon parser, a second list grammar found by raw-text search); Bradley added F-464 (polish:
       setup Phase 1 waits for whoami to fail; it exits 0 in every state) and kept F-461, F-466 and issue #28 out.
     Transitions on the branch: F-464, F-467, F-468 OPEN -> FIXED (F-468 with Redesign: check 16 onto lib.mjs's
       parseBlocks). Mutation proof 15 of 15 as predicted (copy-outs under F-467 and F-468 on the branch). The release's
       local step-0 commit (F-464's auto-defer) was dropped unpushed when F-464 joined the round; step 0 re-runs at the cut.
     Under test on the branch: hb-20260926-03; blind spots = the Blind spots line in the branch's header (no CLI 1.0.9 on
       the host — F-467's 1.0.9 path measured on a constructed catalog; setup Phase 1 read, not run; change-request's
       offline-mode sentence carried to F-461's round).
     Owed by the tester round: verdicts on F-464, F-467, F-468; the walk of setup Phase 1 (slash-typed by Bradley); one
       guard-wiring line.
     Local battery on the handoff tip 8950478: 41/41 green, verbatim from both workflow YAMLs. CI on the PR head: pending
       at this stamp — quoted after completion, never asserted here first.
     After the verdicts and the merge: the 0.43.0 release resumes at dev/RELEASE-CHECKLIST.md §1 (step 0 + gate), then
       §2 is satisfied by this round. Next free number F-469. -->

<!-- tester 2026-09-26 (0.43.0-gate-V @ hb-20260926-03 — re-stamps the PR #29 pointer above; UNMERGED, riding a branch):
     Branch release-gate-0-43-0 -> PR #29, head e9629cf (bus: 0.43.0-gate-V —, no skip marker). Verdicts recorded on the
       branch, not here: F-464 VERIFIED, F-467 VERIFIED, F-468 VERIFIED — none reopened. Two polish observations noted on
       the verdicts, not logged (the operating model's auth line omits the Base URL (not set) state — a candidate for
       F-461's round; check 16's cascade "no such bullet" message on the unindented-continuation refusal).
     Walk (setup --budget 1, slash-typed by Bradley, stopped at the Phase 4 boundary), guard-wiring line (ask rendered,
       declined), blind spots and the handoff head 8950478's CI quoted per job (all pass): the tester block under the
       branch header's Blind spots (hb-20260926-03) line.
     CI on e9629cf: started by the push, pending at this stamp — quoted per job on PR #29 after completion, never asserted
       here first. Merge stays Bradley's call; the 0.43.0 release then resumes at dev/RELEASE-CHECKLIST.md §1. -->

<!-- builder 2026-09-26 (CLI 1.0.10 adoption round CLOSED OUT — MERGED):
     PR #27 (adopt-cli-1-0-10) merged to dev by Bradley at 6acd1e4; the remote branch was deleted at merge, the local one
       after; this checkout is back on dev. On dev now: CLI pin 1.0.10, plugin 0.43.0 staged (CHANGELOG), F-462 and F-463
       VERIFIED, VALIDATION CP-6 (a)-(d) and § F-463 CLEARED.
     gs-fortress close-out.mjs 1.0.10 --session E1,V1,E2 --pr 27 --commit ran (gs-fortress 929578b, pushed): ledger lines
       E1 (CP-2..CP-5), V1 (CP-6), E2 (CP-1, CP-7) → PR #27 (merge 6acd1e4), unreleased; decisions.1.0.10.execution done.
     Post-merge CI on 6acd1e4 (push), quoted per job after completion: docs-drift 36273009099: drift (full) success;
       validate-plugin 36273009116: changes success / manifests success / validate (ubuntu-latest) success.
     Logged after the merge, on Bradley's call: the three tester observations from 1.0.10-V — F-464 (polish: setup Phase 1
       branches on whoami "failing"; 1.0.10 whoami always exits 0), F-465 (polish: deps-report's corroborate-live caveat
       ignores passed --live-deps captures; reproduced offline on the e2e fixture), F-466 (normal: the guard's pipe-safety
       lint first-offense-denies non-gs-admin pipelines whenever "gs-admin" appears anywhere in the command; reproduced on
       the hook). Next free number F-467.
     Release note for 0.43.0: F-466 is an OPEN normal finding on dev, so it gates the release until fixed, or deferred past
       0.43.0 by Bradley with a reason and a reopen trigger; F-464 and F-465 (polish) take the one-time auto-defer at the
       release ceremony. F-461 (polish) is DEFERRED past 0.42.0 by the auto-defer, so step 0 re-opens it and, its one free
       pass spent, it also gates 0.43.0 until fixed, WONTFIX, or manually deferred with a real reopen trigger.
     Released: nothing (dev stages 0.43.0). Next: the 0.43.0 release through the maintainer's procedure, then close-out
       --release v0.43.0. Under test + canary move to dev with this close-out. -->

<!-- builder 2026-09-26 (CLI 1.0.10 adoption — VERDICTS IN; UNMERGED, riding a branch, ready to merge on Bradley's call; re-stamps the PR #27 pointers below):
     Branch adopt-cli-1-0-10 -> PR #27, base dev, UNMERGED. Transitions on the branch since the tester's re-stamp:
       F-462 FIXED -> VERIFIED (builder verdict on the tester's role-inversion fix @ hb-20260926-01: the reopen's repro
       U1-U3 and siblings V1-V9 against the fixed and the pre-inversion checker, 13 of 13 as predicted; checker mutants C1-C3 KILLED by arms 16i / 16j / 16k;
       V3, a paraphrase spelling "seconds", survives outside the Fix note's claim — recorded, not reopened).
       F-463 stays VERIFIED (tester). VALIDATION § F-463's owed polish applied: the CORS clause dropped from
       reference/auth.md, and its sibling in reference/workflows/01-authenticate.md reworded; wiki regenerated.
     Live checks: CP-6 (a) FIXED, (b) BROKEN (sc measures --id fails every time on 1.0.10 — folded into F-462's reopen and
       its CP-3 wording), (c) FIXED, (d) FIXED; § F-463 FIXED. All CLEARED. Walks recorded by the tester.
     Upstream: the sc measures --id failure on 1.0.10 is already reported (Bradley, 2026-09-26).
     To log AFTER this PR merges (Bradley, 2026-09-26) — three tester observations, deliberately kept off this branch so a
       possibly-normal finding does not gate 0.43.0: setup Phase 1 should branch on whoami's Token: line (1.0.10 whoami
       always exits 0) — polish; deps-report's third caveat asks for --live-deps although a capture was passed — polish;
       the guard's pipe lint fired on a non-gs-admin command whose path contained "gs-admin" — severity to be declared
       at logging (a first-offense deny on a legitimate command reads normal), its own round.
     No OPEN finding on the branch; F-461 (polish) stays DEFERRED past 0.42.0. Next free number F-464.
     CI on the verdict tip: 4a288ef (the builder verdict commit, no skip marker) — its pull_request runs had not concluded at this stamp,
       so nothing is asserted for them here; the 128340e runs, quoted after completion: validate-plugin 36271463848
       changes success / validate (ubuntu-latest) success / manifests success; docs-drift 36271463921 drift (full) success.
     Merge is Bradley's call; then gs-fortress close-out.mjs 1.0.10 --session E1,V1,E2 --pr 27 --commit. -->

<!-- builder 2026-09-26 (CLI 1.0.10 adoption + README beginner path — HANDED OFF; UNMERGED, riding a branch; re-stamps the claim comment below):
     Branch adopt-cli-1-0-10 -> PR #27, base dev, UNMERGED. Payload: gs-fortress build-kickoffs-1.0.10.md sessions X0 + E1 +
       V1 + E2 (CP-1..CP-7) plus the README beginner path, one PR (Bradley, 2026-09-26); plugin 0.43.0 (CHANGELOG).
     Transitions on the branch: F-462 OPEN -> FIXED (Fix / Judge / mutation copy-out / Sibling sweep); F-463 logged (the
       number the claim comment below reserved) and FIXED (Class consumer-parity; Judge; Sibling sweep — setup's first-run
       not-authenticated message added to scope by Bradley mid-round). Numbers consumed: F-463. Next free number F-464.
     CP-1: the catalog differs from the pre-regen snapshot only in meta.cliVersion / generatedAt; counts 10 / 188 / 182;
       diff-catalogs hasChanges false, non-mutating writes strict 0 -> 0 and withPost 20 -> 20 on the same ids; reader-shapes
       moves only its cliVersion. Check 16 mutation proof 13 of 13 as predicted (copy-out under F-462 on the branch).
     Ordering decision (work order is not severity order): E1's prose (CP-2 / CP-3) landed before the regen, so CP-7's
       version pass re-checked the rewritten canon, not the old one; the README landed after CP-7 (it touched neither the
       Requirements line nor the currency stamps, so nothing needed rebasing); one bump after every shipped-byte change. No
       known-pending change re-arranges what is under test — F-461 (DEFERRED) touches change-request step 4 prose only.
     Under test on the branch: hb-20260926-01; blind spots = the Blind spots line in the branch's header (no tenant or
       operator: CP-6 and the CORS check banked; skill prose read, not run; no newcomer README dry run; artifacts
       byte-identity carried on the gs-fortress audit).
     Owed by the tester round: verdicts on F-462 and F-463; the walk of setup, refresh and change-request (slash-typed by
       Bradley) and of deps-report and email-report (tester-invoked); one guard-wiring line; dev/VALIDATION.md sections
       F-462 / CP-6 (a)-(d) and F-463 where a live tenant and CLI 1.0.10 are available (this host's global CLI is 1.0.10).
     Local battery on the handoff tip 75e3fd8: 47/47 green (AGENTS.md list verbatim plus the four jo-report siblings).
     CI on the PR head 75e3fd8 (the handoff commit, no skip marker): pending at this stamp — quoted per job on PR #27 after
       completion, never asserted here first.
     Merge is Bradley's call after the tester round; then gs-fortress close-out.mjs 1.0.10 --session E1,V1,E2 --pr 27
       --commit (the PR title names CP-1..CP-7 individually and nothing else — close-out reads the title first).
     Carried, not in scope: F-461 (polish, DEFERRED past 0.42.0); issues #11, #12. -->

<!-- tester 2026-09-26 (1.0.10-V @ hb-20260926-01 — re-stamps the PR #27 pointer above; UNMERGED, riding a branch):
     Branch adopt-cli-1-0-10 -> PR #27, head 128340e (bus: 1.0.10-V —, no skip marker). Verdicts recorded on the branch,
       not here: F-463 VERIFIED; F-462 REOPENED (check 16 held the canon to presence — a formula swap read "2 of 2"; CP-6 (b)
       BROKEN: sc measures --id fails every time on 1.0.10, fresh token included) and re-FIXED by the tester in a ROLE
       INVERSION at Bradley's instruction — the builder owes F-462's verdict before merge.
     VALIDATION on the branch: CP-6 (a) FIXED, (b) BROKEN, (c) FIXED, (d) FIXED; F-463 FIXED (no CORS field — auth.md's
       CORS clause is the owed polish drop). Walks, guard-wiring line, blind spots and the handoff head's CI quoted per job:
       the tester block under the branch header's Blind spots (hb-20260926-01) line.
     CI on 128340e: started by the push, pending at this stamp — quoted per job on PR #27 after completion, never asserted
       here first. Merge stays Bradley's call, after the builder's F-462 verdict. -->

<!-- builder 2026-09-26 (CLI 1.0.10 adoption + README beginner path; UNMERGED, riding a branch):
     Branch adopt-cli-1-0-10 (off dev @ this commit; PR to dev to follow, re-stamped here with its number). One
       branch, one PR for gs-fortress sessions X0 + E1 + V1 + E2 (plan build-kickoffs-1.0.10.md, CP-1..CP-7) plus the
       README beginner path (Bradley, 2026-09-26). Not in scope: CP-8 (gs-fortress repo), CP-9 (upstream memo).
     Works under F-462 (the X0 emission, logged on dev at fb8f9ab; gs-fortress X0 status derived spent by close-out).
     Numbers claimed by the branch: F-463 (the README beginner-path change, logged on the branch as its own finding so
       the tester round covers it). Next free number F-464.
     Carried, not in scope: F-461 (polish, DEFERRED past 0.42.0; reopens at the next release ceremony). Open PRs to
       dev at kickoff: none. -->

<!-- builder 2026-09-21 (Session F round CLOSED OUT — on dev, no branch):
     Payload: none of the builder's — the round was the owed walk of PR #17's shipped prose (plugin 0.42.0, merged
       at 0cbcc12) plus the operating-model refresh's second arm. Both recorded in dev/VALIDATION.md § PR #17:
       first arm CLEARED @ hb-20260921-01 (PASS on all four points; ask A's line 1 ruled rig-caused), second arm KEPT
       (operating model refreshed in place, scaffold 9/9 current; ask B 6 → 5 bullets, all paired, slightly better;
       attribution confounded — the arm was not blind to the first).
     Processed: F-461 (polish, builder-logged, OPEN) — step 4's closing sentence overstates what a well-formed ticket
       "gets"; a SKILL.md change owes a walk, so it rides the next substantive round. The `re r executions` observation
       is banked in dev/VALIDATION.md (production arm, read-only); a finding opens only if production is empty too.
     Open PRs to dev: none. No OPEN normal/high; one OPEN polish (F-461) — auto-defers once at the release ceremony.
     Under test stays dev · hb-20260921-01 (nothing FIXED to hand off; no new token minted). Next free number F-462.
     Released: nothing (dev stages 0.37.1, 0.38.0, 0.39.0, 0.40.0, 0.41.0, 0.41.1, 0.41.2, 0.42.0).
     Next: the release gate on dev — /code-review over origin/main...dev and /security-review (0.41.2 touched the
       guard) — then cut release/v0.42.0. -->

<!-- tester 2026-09-21 (Session F-V walk round — on dev, no branch):
     Under test: dev @ 5dd23b3 (handoff commit, clean); canary matched hb-20260921-01, loaded from
       <repo>\plugins\gs-superadmin. Round type: first walk of PR #17's shipped prose; no finding under test.
     Walked (slash-typed by Bradley, sandbox, CLI logged in, plans `Verification basis: live`):
       /gs-superadmin:change-request on ask A (WALK-1, a one-value criteria edit) and ask B (WALK-2, a new CTA rule
       on a field with a CTA-creating rule already on it). Both plans written; no mutating command proposed or run
       while drafting (reads only: re r describe / schedules / executions, jo cta options, via capture.mjs).
     Verdict: dev/VALIDATION.md § PR #17 CLEARED @ hb-20260921-01 — PASS on all four points. Ask A's section ran two
       lines; line 1 (never run on this tenant vs. the ask's "last quarter's firings") was ruled rig-caused and
       discounted by Bradley; the remaining line is one. Ask B: 6 bullets, each paired to a plan line or a
       requester question; cites the existing 90-day CTA and close rules with the cost of that route;
       Justification tagged AI-inferred. The two sections and Heads-up lines are quoted there.
     Rig deviation: no real Jira tickets — both asks authored from the sandbox KB; ask B's vagueness is deliberate
       silences. Workspace operating-model.md lacks "The admin's job, and yours" and has no .new (setup not re-run
       since 0.42.0) — the skill carried the thinking alone.
     Guard wiring: `gs-admin jo p save --id 'walk-guard-probe-nonexistent'` drew the ask naming
       gs-admin journey programs save, both workspace tenants + the PRODUCTION warning (text relayed by Bradley) —
       DECLINED.
     Second arm: (Session F-V2, dev @ e3e9300) VALIDATION § PR #17 KEPT @ hb-20260921-01. Operating model
       refreshed in place (passage present, no .new, scaffold check 9/9 current). Ask B re-run as WALK-2B: 6
       bullets → 5 (type/priority and CTA name merged, both halves kept), all paired; the duplicate line now says
       "has" not "runs" and asks whether production runs the 90-day rules (unscheduled here); Heads-up keeps the
       duplicate-CTA line; Justification still AI-inferred. Slightly better, attribution confounded (arm not
       blind to arm 1). Noted: `re r executions` returns no rows on this sandbox for every rule checked, chained
       imports included, so "0 executions" is not evidence here.
     Numbers claimed: none (bus has no OPEN section; none opened). -->

<!-- tester 2026-09-16 (Session E-V verdict round — UNMERGED; re-stamps the Session E builder comment on dev):
     Branch round-e-guard-normalizer -> PR #23, base dev, still UNMERGED; verdict committed [skip ci] on top of 58b1330.
       Status on the branch: F-460 VERIFIED @ hb-20260916-02 (the only live section this round).
     Measured (no tenant): seven PowerShell-tool shapes — $x=bash -c, $x=iex, powershell foo.ps1 -Command, $1=,
       $x.y=iex, powershell -ExecutionPolicy Bypass "…", $x=powershell "…" — each drew the ask naming
       gs-admin journey programs save (text relayed by Bradley, both tenants + PRODUCTION warning), all DECLINED.
       Oracle, this host (one lane, powershell 5.1.26100.9444): 709 lines / 0 bypass / 62 over-ask, lane 98 rows /
       0 bypass / 7 over-ask, all checks passed — the Fix note's counts. pwsh 7 lane (CI run 35147717941, job
       validate (ubuntu-latest), pwsh 7.6.5): 98 rows / 0 bypass / 20 over-ask; line totals 709 / 0 / 78; passed.
     Walk: none owed (no SKILL.md changed but the canary). Blind spots on the verdict.
     Numbers claimed: none (next free F-461). Issue #2 closes on the merge (Closes #2); counts commented on the issue.
     Next: merging PR #23 is Bradley's call. -->

<!-- tester 2026-09-16 (Session D-V verdict round — UNMERGED; re-stamps the builder comment below):
     Branch round-d-prose -> PR #22, base dev, still UNMERGED; head now a9bf2a1 (the verdict commit, no [skip ci],
       so the PR suite runs on the head). Statuses on the branch: F-457 VERIFIED, F-453 VERIFIED @ hb-20260916-01.
     Measured (dev/VALIDATION.md § F-457 / F-453, CLEARED on the branch): no metadata stub exists on either tenant, so
       the walk took the rig's fallback — `/gs-superadmin:setup --deep connectors --budget 3` on the sandbox, slash-typed
       by Bradley: Phases 1-2, then no scaffold, no sweep, no upsert, no diff; lookback.connectors days 1 vs
       lookbackDefault 7 quoted; branch fired = list-only explain-and-stop before Phase 5 (0 of 3 spent, no write).
       The report-objects maps question drew the five-lane boundary and deps-report. Guard wiring (F-453): the
       variable-built read loop denied once, then the repeat's ask rendered — read by Bradley, carrying "spelled
       literally" and "flag values and paths" — declined.
     Blind spots (tester, hb-20260916-01), on F-457's verdict: the lookback relay branch and the --upgrade describe path
       unproduced (no stubs on either tenant); a --deep run over an UNRECORDED domain is unspecified by the flag doc
       (connectors stopped by type); no Phase 6 relay reached; no session restart (the hook's new text stood in).
     CI on the head a9bf2a1 (quoted after conclusion): run 35115107142 validate-plugin: success — changes=success,
       validate (ubuntu-latest)=success, manifests=success; run 35115107251 docs-drift: success — drift (full)=success;
       PR #22 mergeStateStatus CLEAN.
     Numbers claimed: none (next free F-460). Issue #1 closes on the merge, not by hand. Next: merging PR #22 is
       Bradley's call. -->

<!-- builder 2026-09-16 (Session E round CLOSED OUT — MERGED):
     Payload: GD-1, GD-2, GD-3 of the September round plan (issue #2, all eight items) — F-460 (normal, Class
       second-scanner): ONE word→program-name normalizer in the guard, the assignment grammar as one grammar
       ($1=, ${1}=, $x.y=, $a[0]= admitted), the pwsh positional loop re-scanning a positional that carried nothing
       AND a later -Command, a pwsh entry in the value-option table (the review round's live bypass), one execution
       journaling once; the oracle's combination matrix with every PowerShell on the host as a lane (ruled); check 11
       items 4, 5, 7 fixed with fixtures, item 6 measured not a defect. Plugin 0.41.2.
     Verdict: F-460 VERIFIED @ hb-20260916-02 (tester, Session E-V, consumer workspace, no tenant) — seven
       PowerShell-tool shapes drew the `journey programs save` ask (all declined, text relayed by Bradley); the tester's
       oracle run reproduced the Fix note's counts (709 / 0 bypass / 62 over-ask; 5.1 lane 98 / 0 / 7) and quoted the
       pwsh 7.6.5 lane from CI (98 / 0 / 20). Tester blind spots carry on F-460.
     PR #23 MERGED to dev by the builder on Bradley's instruction 2026-09-16 (dev @ 9549d7b, merge commit); branch
       round-e-guard-normalizer deleted local + remote; #2 CLOSED by comment with the oracle's counts (a merge to dev
       does not auto-close; `Closes #2` fires again, harmlessly, at the release to main).
     Post-merge dispatches on dev, QUOTED per job after completion:
       (the first pair, dispatched on the merge commit 9549d7b, was CANCELLED by the handoff push — the workflows
       cancel in-progress runs on the same ref — and re-dispatched on the tip 6308661):
         validate-plugin 35153484484: changes success / manifests success / validate (ubuntu-latest) success
         docs-drift 35153486487: drift (full) success / drift (stripped) success
     Under test + canary → dev · hb-20260916-03. Next free number F-461. Released: nothing (dev stages 0.37.1,
       0.38.0, 0.39.0, 0.40.0, 0.41.0, 0.41.1, 0.41.2).
     Open PRs to dev at close-out: draft PR #17 (change-request prose; stages 0.39.0 — rebases its bump against
       0.41.2) — the NEXT task, reviewed in its own session. No OPEN findings; no polish carried.
     Sibling named, not closed (F-460 sweep): the oracle's positive claims for the exotic assignment prefixes are
       asserted on the 5.1 lane only (`on:` gate); pwsh 7 measured 0 bypass in CI. -->

<!-- builder 2026-09-16 (Session E, RE-STAMPED after E-V; UNMERGED, riding a branch):
     Branch round-e-guard-normalizer -> PR #23, base dev, UNMERGED. Transition on the branch since the comment below:
       E-V (tester @ hb-20260916-02) — F-460 FIXED -> VERIFIED (verdict commit 579c85f [skip ci]): seven PowerShell-tool
       shapes (the issue's own three, the two assignment siblings, the review round's value-option bypass, the Fix note's
       repro) each drew the `journey programs save` ask, text relayed by Bradley, all declined, nothing executed; the
       tester's own oracle run reproduced the Fix note's counts on one lane (709 / 0 bypass / 62 over-ask; 5.1 lane
       98 / 0 / 7) and quoted the pwsh 7.6.5 lane from CI run 35147717941 (98 / 0 / 20, all passed). Tester blind spots:
       pwsh 7 in CI only (ubuntu); no PostToolUse row measured live (every ask declined); GD-3 on the PR's suite only.
     Merge tip: the [skip ci] verdict commit left the PR BLOCKED on dev's required drift (full); the first empty
       commit (d914965) QUOTED the skip marker in its own message and was skipped too — GitHub honours the marker
       anywhere in the message; a second empty commit (963897d, tip) re-ran the PR suites — QUOTED after completion:
         validate-plugin 35151743764 (pull_request, 963897d): changes success / validate (ubuntu-latest) success / manifests success
         docs-drift 35151743840 (pull_request, 963897d): drift (full) success
       PR #23 reads MERGEABLE / CLEAN.
     PR #23 is verdict-complete; merge is the maintainer's call. #2 closes on merge (Closes #2 in the body; the tester
       commented the counts). Carried, not in scope: draft PR #17 (stages 0.39.0 — rebases its bump against 0.41.2). -->

<!-- builder 2026-09-16 (Session E — the mutation guard's one normalizer, the oracle's matrix and lanes, check 11; UNMERGED, riding a branch):
     Payload: GD-1, GD-2, GD-3 of the September round plan — issue #2 items 1–3 and 8, and check 11's items 4–7.
       F-460 (normal, Class second-scanner): ONE word→program-name normalizer in hooks/gs-admin-guard.mjs (normalizeProg;
       isGsAdminWord derives from it), so every interpreter behind a PowerShell assignment ($x=iex '…', $x=bash -c '…',
       $x=powershell "…", $x=cmd /c '…') asks; sibling from the sweep: the assignment grammar admits every spelling
       PowerShell runs ($1=, ${1}=, $x.y=, $a[0]= — measured on 5.1) as ONE grammar shared with the computed-name branch;
       the pwsh positional loop re-scans a positional that carried nothing AND a later -Command (item 1, with a measured
       deviation from the issue's flag-first order: the first positional IS 5.1's command text, so that order would have
       dropped a real ask); the review round's live bypass — a value-taking option before the payload
       (powershell -ExecutionPolicy Bypass "…") read as the positional — closed through a pwsh entry in the value-option
       table; one execution journals once. Oracle (GD-2, ruled: the generator is the matrix home, and every PowerShell on
       the host is a lane — powershell.exe 5.1 + pwsh 7, so the ubuntu leg a dev PR runs judges the PowerShell rows for
       the first time): 51 PowerShell matrix rows per lane + 8 bash, `on:` gate for claims measured on 5.1 only. Check 11
       (GD-3): items 4, 5, 7 reproduced by fixtures and fixed; item 6 measured not a defect (CommonMark), pinned as the
       decision; the block is on lib.mjs's QUOTE_RE, refusing an unterminated anchor and one outside the callout.
       Plugin 0.41.2 (CHANGELOG). README parsing-boundary bullet extended; no residual closed.
     Branch round-e-guard-normalizer -> PR #23, base dev, UNMERGED (Closes #2 — all eight items addressed). Transitions on
       the branch: F-460 logged (this branch consumes F-460; next free number F-461) and OPEN -> FIXED (Fix / Class /
       Judge / Sibling sweep lines). Review: /code-review medium, 8 finders + 3 file-batched verifiers — 9 confirmed,
       1 plausible, all fixed on the branch; 8 dismissed with reasons in the PR body.
     Judge, this host (bash 5.x + Windows PowerShell 5.1, one lane): pre-fix hook 709 generated lines / 44 bypass / 80
       failures; fixed hook 709 / 0 bypass / 62 over-ask / 0 failures; PowerShell lane 98 rows. guard-fixtures 697 green,
       17 of the 20 new pins red against the pre-fix hook (the dev tree at PR #22's merge). test-check-doc-drift 129 green,
       fixtures 11b–11f red against the pre-change checker.
     Under test on the branch: hb-20260916-02; blind spots = no pwsh 7 on this host (the PR's ubuntu suite is that lane's
       first judge; a red there is real information), no operator for the rendered asks until E-V, the value-option table
       exercised for three parameters, the macOS bash 3.2 leg unmeasured locally.
     Dispatch evidence (F-340), on the branch tip 58b1330 (the handoff commit), QUOTED after completion:
         validate-plugin 35147717941 (pull_request): changes success / validate (ubuntu-latest) success / manifests success
         docs-drift 35147717956 (pull_request): drift (full) success
         validate-plugin 35147785798 (dispatch): changes success / validate (ubuntu-latest) success / manifests success
         docs-drift 35147788662 (dispatch): drift (full) success / drift (stripped) success
       The pwsh 7 lane's FIRST measurement, quoted from run 35147717941's job log: "709 generated lines run (611 bash 5.x;
         98 PowerShell rows × 1 lane(s) — pwsh 7.6.5: 98 rows, 0 bypass, 20 over-ask); 0 bypass, 78 over-ask, 44
         over-qualified, 9 documented residual(s) held — All guard-oracle checks passed"; the two PowerShell residual rows
         printed "unmeasured on this lane (safe) … executed=true" (so the residual holds on 7 as well), and the 13 extra
         over-asks are the positional shapes 7 reads as a file path — the version difference the lanes exist to measure.
     Carried, not in scope: draft PR #17 (stages 0.39.0 — rebases its bump against 0.41.2); no OPEN polish findings.
     Next: Session E-V (tester, consumer workspace, no tenant) on the branch per handoffs/SESSION-PROMPTS.md — run the
       oracle and quote its lane line; read the ubuntu run's pwsh lane counts from the job log. -->

<!-- builder 2026-09-16 (Session D round HANDED OFF — UNMERGED):
     Payload: DC-1, DC-2, DC-3 of the September round plan — F-457 (setup: --deep runs Phases 1-2 then goes STRAIGHT
       to Phase 5, Phases 3-4 never re-run and nothing re-lists; before spending budget the run reads one report's
       lookback.<domain> and relays the list's age when older than lookbackDefault, pointing at refresh; Phase 4's
       heading no longer says "runs every time"; Phase 6 states its five lanes are the builder's ONLY inputs — the
       subset of doc-lib's RECORDED_LANES, pointed at, not copied — and names deps-report as where a non-lane deep
       ingest pays off), F-453 (the guard's repeat-offense ask on a shell-variable subcommand carries the same
       "spelled literally — variables belong in flag values and paths" remedy the deny names; guard-fixtures pins it
       on the repeat path, red over the pre-fix hook), and issue #1 (AGENTS.md § Review-gate rules: "Work order is
       not severity order", marked not mechanically checkable; closes on merge). Rulings (Bradley, 2026-09-16) in the
       plan's As-shipped notes: NOT the plan's re-list-when-stale (next --upgrade selects metadata stubs only, so a
       re-list never feeds the --deep queue — a statement, not a mechanism); the ordering rule ALSO lands in the
       /dev-loop skill by its own PR to gs-admin-superfriends (PR #8 there — the personal skill is a symlink into that
       checkout). Plugin 0.41.1 staged (CHANGELOG; the ask text ships).
     Branch round-d-prose -> PR #22, base dev, UNMERGED. Statuses on the branch: F-457 FIXED, F-453 FIXED (Fix /
       Judge lines; F-453 Sibling sweep: batched). Review: /code-review low — 1 finding (the null-days substitution
       rule read ungrammatically), fixed on the branch.
     Under test on the branch: hb-20260916-01; blind spots = no tenant and no operator in the builder session (the
       --deep walk's lookback branch and the absence of a list sweep, the rendered repeat ask), skill prose read not
       run, the superfriends PR reviewed in its own repo.
     Owed: dev/VALIDATION.md § F-457 / F-453 (one setup --deep run to its first batch, slash-typed by Bradley; the
       guard-wiring line = a variable-built read loop issued twice, the repeat's rendered ask read by the operator).
       Numbers claimed by the branch: none (no new findings logged). Next free number F-460. Carried, not in scope:
       draft PR #17 (stages 0.39.0 — rebases its bump against 0.41.1 when it lands).
     CI on the PR head fc8673e (the handoff commit, no [skip ci]), QUOTED after conclusion: run 35113354708
       validate-plugin — changes pass, manifests pass, validate (ubuntu-latest) pass; run 35113354630 docs-drift —
       drift (full) pass; PR #22 mergeStateStatus CLEAN. Unmerged — merge is the maintainer's call after D-V.
     Re-stamped 2026-09-16 (builder, after Session D-V): F-457 and F-453 VERIFIED @ hb-20260916-01 on the branch
       (verdict commit a9bf2a1); dev/VALIDATION.md § F-457 / F-453 CLEARED; walk: setup --deep on the sandbox
       (slash-typed by Bradley; the list-only explain-and-stop branch fired; the maps question drew the five-lane
       boundary and deps-report); guard wiring recorded (the repeat ask rendered with the remedy, read by Bradley,
       declined). Tester blind spots carried: the lookback RELAY branch and the --upgrade describe path unproduced
       (no metadata stub on either tenant); the flag doc does not say how --deep treats an UNRECORDED domain (the
       sandbox's connectors records describeCommand null; the run decided list-only by domain type) — side
       observation, no number claimed; no Phase 6 relay reached; no hook restart (the rendered text stood in).
       CI on the verdict tip a9bf2a1, QUOTED after conclusion: run 35115107142 validate-plugin — changes pass,
       manifests pass, validate (ubuntu-latest) pass; run 35115107251 docs-drift — drift (full) pass; CLEAN.
       UNMERGED — merge is Bradley's call.
     Folded in before the merge (Bradley, 2026-09-16, from the D-V blind spot): the flag doc says a --deep over an
       UNRECORDED domain is decided by the recording, never by domain type — say Phase 4 has not recorded a template
       or `none` yet and stop (doc-only, rides 0.41.1; unwalked — the tester's list-only stop was the same outcome
       by another route). CI on that tip 59c5c87, QUOTED: run 35116163245 validate-plugin — changes pass, manifests
       pass, validate (ubuntu-latest) pass; run 35116163254 docs-drift — drift (full) pass; CLEAN.
     MERGED 2026-09-16 by the builder on Bradley's instruction: PR #22 -> dev @ cec8fb8 (merge commit); branch
       round-d-prose deleted local + remote; issue #1 closed by comment (auto-close does not fire on a PR to dev);
       superfriends PR #8 MERGED to that repo's dev (d7848b6). Dispatch evidence (F-340), on dev after the merge,
       QUOTED after completion:
         validate-plugin 35116668890: changes success / manifests success / validate (ubuntu-latest) success
         docs-drift 35116672502: drift (stripped) success / drift (full) success
       Open PRs to dev at close-out: #17 (draft, stages 0.39.0 — rebases its bump against 0.41.1). Next free number
       F-460. Every live section VERIFIED. -->

<!-- tester 2026-09-15 (Session C2-V verdict round — UNMERGED; re-stamps the builder comment below):
     Branch round-c2-fact-homes -> PR #21, base dev, still UNMERGED; head now b714ecd (the verdict commit, no [skip ci],
       so the PR suite runs on the head). Statuses on the branch: F-450 VERIFIED, F-452 VERIFIED @ hb-20260915-04.
     Measured (dev/VALIDATION.md § F-450 / F-452, all four steps, CLEARED on the branch): step 1 read-only over both
       manifests — scope on the two journey domains only, notEnumerableBare 4 with inert records, gate green, sha256
       unchanged; step 2 the sandbox setup walk's Phase 4 relay — two scope lines quoted verbatim from that run's report,
       before the totals question; step 3 the tenant CONVENTIONS.md override read for the sandbox only (deps-report and
       email-report), prod on the workspace file, override deleted; step 4 the one write — sandbox connectors-chains
       blankDatesCleared 4, then --no-date-field --allow-redate and report changeDetection none, datelessEntries 4.
     Guard wiring: a mutating jo p pause drew the plugin's PreToolUse ask in the consumer-workspace session (declined).
     Blind spots: on F-450's verdict — slash-only audit / change-request / deprecate / refresh not typed; the scaffold
       refresh of the workspace CONVENTIONS.md unmeasured against a filled-in value; the guard's silent direct-stdin exit.
     CI on the head b714ecd (quoted after conclusion): run 35025828196 validate-plugin: success — changes=success,
       manifests=success, validate (ubuntu-latest)=success; run 35025828203 docs-drift: success — drift (full)=success.
     Numbers claimed: none (next free F-460). Next: merging PR #21 is Bradley's call. -->

<!-- builder 2026-09-15 (Session C2 round HANDED OFF — UNMERGED):
     Payload: FH-1 and RP-4 of the September round plan — F-450 (one home per kind of fact: doc-lib CLI_PIN_FACTS,
       a version-stamped, self-retiring per-pin table keyed by catalog id; domain-candidates diff buckets the four
       re rules sublists as notEnumerableBare with inert tenant records; report DERIVES domains.<d>.scope + pinFacts
       from each stamp's recorded listCommand — T-2 v4, additive, no backfill; CONVENTIONS.md workspace-wide by
       default with a <slug>/CONVENTIONS.md override, precedence tenant file > adopted pack > workspace file; a
       blank date string is not a date — the connectors-chains cause, fixed across upsert/newerThan/baseline/report)
       and F-452 (the Phase 4 relay names every scope-limited domain from scope, with its limit, before the totals
       question). Rulings (Bradley, 2026-09-15) in the F-450 Fix note and the plan's As-shipped notes: (c) DERIVED,
       not the plan's stamp field. Plugin 0.41.0 staged (CHANGELOG).
     Branch round-c2-fact-homes -> PR #21, base dev, UNMERGED. Statuses on the branch: F-450 FIXED, F-452 FIXED
       (Fix / Judge lines; F-450 additionally a Sibling sweep line by hand, no registry key). Review: /code-review
       medium, 8 finders + 5 file-batched verifiers — 14 candidates, 8 confirmed and fixed on the branch, 2 refuted.
     Under test on the branch: hb-20260915-04; blind spots = no tenant in the builder session (deps-report override
       walk, the relay's rendering, the sandbox connectors-chains redate), the per-pin table under a non-1.0.9
       workspace catalog rests on the fixture, the sublists' runtime errors quoted from the tenants' recorded reasons.
     Owed: dev/VALIDATION.md § F-450 / F-452 (four steps; the scope arm needs NO tenant read — both manifests read
       locally; the one write is the sandbox redate). Numbers claimed by the branch: none (no new findings logged).
       Next free number F-460. Carried, not in scope: OPEN polish F-453 and OPEN normal F-457 (Session D); draft
       PR #17 (stages 0.39.0 — rebases its bump against 0.41.0 when it lands).
     Re-stamped 2026-09-15 (builder, after Session C2-V): F-450 and F-452 VERIFIED @ hb-20260915-04 on the branch
       (both manifests read-only for the scope/diff arm; the sandbox connectors-chains redated to changeDetection
       none — the one write); dev/VALIDATION.md § F-450 / F-452 CLEARED; walks setup (to the relay) and email-report;
       guard wiring recorded (ask rendered, declined). PR #21 all checks green (drift full / validate / manifests /
       changes) on the verdict tip b714ecd; UNMERGED — merge is the maintainer's call. Tester blind spots carried:
       audit / change-request / deprecate / refresh prose unwalked; a filled-in workspace conventions value under the
       scaffold refresh unmeasured; two untriaged observations (a stdin guard probe from the REPO cwd exited 0 with
       no decision — tenet 7, the guard is inert outside a .gs-superadmin workspace; a first Phase 4 sweep passed
       --page-flag page-number before re-running with --page).
     MERGED 2026-09-15 by the builder on Bradley's instruction: PR #21 -> dev @ f6f8d86 (merge commit); branch
       round-c2-fact-homes deleted local + remote. Dispatch evidence (F-340), on dev after the merge, QUOTED after
       completion:
         validate-plugin 35028354676: changes success / manifests success / validate (ubuntu-latest) success
         docs-drift 35028356629: drift (full) success / drift (stripped) success
     Released: nothing (dev stages 0.37.1, 0.38.0, 0.39.0, 0.40.0, 0.41.0). Next free number F-460.
     Next: Session D (DC-1, DC-2, DC-3; carries OPEN polish F-453 and OPEN normal F-457; walks the four skills C2-V
       left unwalked — audit, change-request, deprecate, refresh). -->

<!-- builder 2026-09-15 (Session C1 round CLOSED OUT — MERGED):
     Payload: RP-1, RP-2, RP-3, RP-5 of the September round plan — F-455 (report carries byDepth in total and per
       domain; every setup completeness statement quotes ONE quiescent report), F-454 (domainCounts; the Phase 4
       relay quotes indexed and names emptyDomains), F-451 (per-domain changeDetection + datelessEntries; refresh's
       Not-checked block, derived from a fresh post-step-3 report), F-459 (mark refuses a pathless documented mark;
       docPathsUnknown over ever-documented entries in report and remove; reconcile-docs backfills doc_path through
       doc-lib's docNameMatcher on the one resolveStem core, recording only the counted set). T-2 v3 GsReport
       pinned. Plugin 0.40.0 staged (CHANGELOG). Rulings (Bradley, 2026-09-15) in the Fix notes.
     Branch round-c1-report-truth -> PR #20, base dev, MERGED by the builder on Bradley's instruction 2026-09-15
       (dev @ 9d52e9f, merge commit); branch deleted local + remote. Review: /code-review medium, 8 finders + 5
       file-batched verifiers — 16 findings, all fixed on the branch (F-459 Fix note).
     Verdicts: F-454 and F-455 VERIFIED @ hb-20260915-01; F-451 and F-459 REOPENED there (one invariant each) and
       VERIFIED @ hb-20260915-02 after the second round — all four VERIFIED; both dev/VALIDATION.md Session C1
       sections CLEARED. Walks (both tokens' Walk lines): setup (Phases 1-5, first ask = the Phase 4 totals relay),
       refresh (twice); guard wiring recorded both rounds (ask rendered and DECLINED). Tester blind spots, all
       fixture-only now: the positive stale-with-doc direction, remove's count, a non-zero docsForUndocumented, the
       three legacy-stamp block lines, setup's Depth / Not-complete lines and the --deep relay (no metadata stubs on
       either tenant).
     Merge mechanics learned (recorded on the ledger and in the builder's memory; the /dev-loop skill is the home for
       the rule): dev requires drift (full) from the PULL-REQUEST suite on the head, so a [skip ci] verdict commit at
       the tip reads BLOCKED; dispatch runs do not join the rollup, and neither an empty commit nor a close/reopen
       created a suite — a one-line dev-only content commit did. End a verdict commit without [skip ci] when it will
       be the merge tip.
     Dispatch evidence (F-340), on dev after the merge, tip 9d52e9f, QUOTED after completion:
         validate-plugin 35006314368: changes success / manifests success / validate (ubuntu-latest) success
         docs-drift 35006314462: drift (full) success
     Under test + canary -> dev · hb-20260915-03. Next free number F-460. Released: nothing (dev stages 0.37.1, 0.38.0,
       0.39.0, 0.40.0). Carried, not in scope: PR #17 (draft; stages 0.39.0 against a dev now at 0.40.0— rebases its
       bump and CHANGELOG entry); OPEN polish F-453 (Session D); OPEN normal F-450, F-452 (Session C2), F-457
       (Session D). Named, not closed: upsert-batch's `unchanged` folds dateless rows in (F-451 sweep); a manifest
       quiescence sequence for F-455's "quoted at a quiescent point".
     Next: Session C2 (FH-1, RP-4) per handoffs/SESSION-PROMPTS.md (local-only, untracked). -->

<!-- builder 2026-09-15 (Session C1 — merge-tip evidence addendum; UNMERGED):
     PR #20 tip is now 6d6e1a6 (two CI-only commits after the verdicts: an empty commit that fired nothing, then a
       one-line dev/VALIDATION.md CI note — dev's ruleset requires drift (full) from the PULL-REQUEST suite on the
       head, and the tester's [skip ci] verdict commit carried none; dispatch runs do not join the PR rollup, and
       neither an empty commit nor a close/reopen created a suite). No plugin or doc byte changed after 2c42de8.
     PR-suite evidence on 6d6e1a6, QUOTED after completion: docs-drift 35005417091 drift (full) success;
       validate-plugin 35005417133 changes success / manifests success / validate (ubuntu-latest) success.
       mergeStateStatus CLEAN. Lesson for the next verdict round: end a verdict commit WITHOUT [skip ci] when it
       will be the merge tip (the /dev-loop skill's ceremony is the home for that rule — outside this repo). -->

<!-- builder 2026-09-15 (Session C1 — VERDICTS IN; UNMERGED, riding a branch, ready to merge on Bradley's call):
     Branch round-c1-report-truth -> PR #20, base dev, UNMERGED; tip 2c42de8 (the tester's second verdict commit).
       Transitions on the branch since the re-stamp below: F-451 FIXED -> VERIFIED and F-459 FIXED -> VERIFIED
       (tester, Session C1-V second round @ hb-20260915-02); F-454 and F-455 VERIFIED @ hb-20260915-01 stand.
       All four of the round's findings are VERIFIED; both dev/VALIDATION.md Session C1 sections CLEARED.
     Measured by the tester: F-459's invariant (dry-run recorded <= docPathsUnknown) held on all 36 domains of both
       manifests at 0 <= 0, both files byte-identical, and an independent raw-inventory tally read every remaining
       pathless entry as never documented; F-451's refresh walk held every Not-checked line to its domain's fresh
       changeDetection, report-objects on the first line. Tester blind spots (fixture-only now): the positive
       stale-with-doc direction, remove's count, a non-zero docsForUndocumented, the three legacy-stamp block lines.
     PR #20 is MERGEABLE / CLEAN, every check green. Merge is the maintainer's call; nothing else is owed by C1.
     Carried, not in scope: unchanged (PR #17; F-453 -> Session D; F-450, F-452 -> C2; F-457 -> D). -->

<!-- builder 2026-09-15 (Session C1, RE-STAMPED after C1-V — second round; UNMERGED, riding a branch):
     Branch round-c1-report-truth -> PR #20, base dev, UNMERGED; tip 75b5633. Transitions on the branch since the
       comment below: C1-V (tester @ hb-20260915-01) — F-454 FIXED -> VERIFIED, F-455 FIXED -> VERIFIED, F-451 and
       F-459 FIXED -> REOPENED, each on one named invariant; second round (builder) — F-451 and F-459 back to FIXED.
     F-459 reopen: docPathsUnknown gated on status, so a stale entry with its July doc on disk and no doc_path was
       invisible (the sandbox scorecard domain reconciled 4 paths against a count of 3). Fixed: one predicate,
       everDocumented (documented now, or last_verified / depth present), decides the count in report and remove, and
       reconcile-docs records a path only for that set — so per domain dry-run recorded <= docPathsUnknown by
       construction; a never-documented entry's stray file is reported as docsForUndocumented, claimed, not recorded.
       Measured read-only over both real manifests from the workspace root: 36 domains, 0 violations, files untouched.
     F-451 reopen: the refresh block's legacy-stamp line said "detection starts next refresh" for a domain the run had
       just recorded as having NO date field. Fixed (prose): the block is derived from a FRESH report after step 3,
       compared with step 1's, one literal line per transition (explicit-none now reads "outside change detection
       from now on"), with the tester's check as an instruction — each line's state word must equal the domain's
       fresh changeDetection.
     Arms: manifest-ops "c1 reopen" (+6; 4 red against the pre-fix script). Second arm banked: dev/VALIDATION.md
       (F-459 / F-451, read-only — the invariant over both manifests + the refresh walk held to a fresh report).
     Under test on the branch: hb-20260915-02; blind spots = the live stale-with-doc case can no longer be produced
       on the sandbox (C1-V's reconcile recorded it — fixture-only now), the fresh-report block is unwalked, the win32
       folder-case and CWD-mismatch refusals are fixture-only, setup's Depth / Not-complete lines and the --deep relay
       are unwalked (no metadata stubs on either tenant).
     Dispatch evidence (F-340), on the branch tip 75b5633, QUOTED after completion:
         validate-plugin 35002383860: changes success / manifests success / validate (ubuntu-latest) success
         docs-drift 35002384483: drift (full) success
     Carried, not in scope: unchanged from the comment below (PR #17; F-453; F-450, F-452, F-457).
     Next: C1-V second verdict round (tester, consumer workspace, no tenant call) on the branch. -->

<!-- builder 2026-09-15 (Session C1 — the report is the account of KB state; UNMERGED, riding a branch):
     Payload: RP-1, RP-2, RP-3, RP-5 of the September round plan — F-455 (manifest.mjs report carries byDepth
       { full, metadata, listOnly, unrecorded } over documented entries, in total and per domain under a new
       domains.<d> row; describeStateOf shared by the stub banner and the report; setup's Phase 5 close, --deep relay,
       Phase 6 precondition, final report and the §4 shapes quote ONE report at a quiescent point), F-454
       (domainCounts { indexed, withAssets, empty }; the Phase 4 relay quotes indexed and names emptyDomains and a
       stamped:false domain), F-451 (per-domain changeDetection date|none|unrecorded + datelessEntries; refresh's
       report ends with a Not-checked-for-change block, never silence), F-459 (mark refuses a pathless documented
       mark and a blank --doc-path; report and remove carry docPathsUnknown; new verb reconcile-docs backfills
       doc_path through doc-lib's docNameMatcher — the claimer's read-side twin on ONE resolveStem core; docPathFor
       is the one doc_path spelling). Report's output is T-2 v3 (GsReport, additive), pinned by contract-conformance.
       Plugin 0.40.0 staged (CHANGELOG). Rulings (Bradley, 2026-09-15) recorded in the Fix notes and the plan's
       As-shipped notes: four-state byDepth in a per-domain block; refuse in mark, count in report/remove, backfill
       as its own verb (report stays read-only).
     Branch round-c1-report-truth -> PR #20, base dev, UNMERGED. Transitions on the branch: F-455 OPEN -> FIXED,
       F-454 OPEN -> FIXED, F-451 OPEN -> FIXED, F-459 OPEN -> FIXED (all Class: outcome-from-proxy, with Judge and
       Sibling sweep lines). Claims no new F-number. Review: /code-review medium, 8 finders + 5 file-batched
       verifiers — 16 findings, all fixed on the branch (F-459 Fix note lists them; the one real bug: the matcher
       skipped its claim on a null read, orphaning a deleted doc's collision partner).
     Measured locally, read-only, over both real manifests: prod 6 list-only domains read listOnly (722), none
       metadata, report 1754 dateless under none; sandbox domainCounts 18/17/1, five legacy stamps unrecorded,
       templates 557 dateless under date, docPathsUnknown 20 (3 + 14 + 3; the B-V #13 arm re-marked five since 25).
     Under test on the branch: hb-20260915-01; blind spots = the one manifest write (the tester's reconcile over the
       sandbox's three legacy domains, dev/VALIDATION.md F-459 section), the setup and refresh walks (slash-only),
       the mark refusal and the CWD-mismatch refusal (fixture-only), the win32 folder-case arm (this host only).
     Dispatch evidence (F-340), on the branch tip 4598121 (the [skip ci] handoff/bank commits suppress the PR suite),
       QUOTED after completion:
         validate-plugin 34994813724: changes success / manifests success / validate (ubuntu-latest) success
         docs-drift 34994817096: drift (full) success / drift (stripped) success
       PR-event runs on 3d556ba (the review-round tip): validate-plugin 34994653331 success (all three jobs);
       docs-drift 34994653222 drift (full) success.
     Carried, not in scope: PR #17 (draft, stages 0.39.0 — rebases its bump on merge); OPEN polish F-453 (Session D);
       OPEN normal F-450, F-452 (Session C2), F-457 (Session D). Sibling named, not closed: upsert-batch's `unchanged`
       folds dateless rows in (F-451 sweep line). Carried design: a manifest quiescence sequence for F-455.
     Next: Session C1-V (tester, consumer workspace, no tenant call) on the branch per handoffs/SESSION-PROMPTS.md. -->

<!-- builder 2026-09-14 (Session B round CLOSED OUT — MERGED):
     Payload: DB-1..DB-4 of the September round plan — #10 ({page} quoted in every paginate fence; capture's refusal names
       the shell cause; check-doc-drift check 14 holds the quoting, mutant 14j), F-456 (one exported read-shape predicate,
       doc-lib isDescribeRead, composed by describe-batch and capture; cn chain and the unlisted sibling re r execution
       admitted; catalog sweep pins the admitted set at the pin), #13 + F-458 (describe-batch aborts after 5 consecutive
       failed marks, and on the FIRST auth death with nothing marked — doc-lib isAuthDeath, version-stamped; one additive
       summary field aborted { reason, after, lastError }); KI-017's exit code corrected to the raw Windows status
       0xC0000409 beside the shell-displayed codes (tester side observation, folded in before the merge). Plugin 0.39.0
       staged (CHANGELOG). Rulings (Bradley, 2026-09-14) recorded in the Fix notes.
     Branch round-b-describe-loop -> PR #19, base dev, MERGED by the builder on Bradley's instruction 2026-09-14
       (dev @ d23f890); branch deleted local + remote. Review: /code-review medium, 8 finders + 3 file-batched verifiers
       — 8 findings, all fixed on the branch (F-458 Fix note).
     Verdict: F-456 VERIFIED and F-458 VERIFIED @ hb-20260914-01 (tester, Session B-V, sandbox) — both banked
       dev/VALIDATION.md sections CLEARED (F-456: the recorded cn chain describe admitted by both scripts, no fallback;
       F-458: a token death past the half-life aborted with reason auth, failures empty, zero auth-failed marks, resume
       after login; #13 confirmed live — a mismatched describe stopped at exactly 5 spawns). Walk (hb-20260914-01) on
       the header line: setup (Phases 1-4; Phase 5 prose exercised through the arms, not walked in setup), audit,
       deprecate, refresh, email-report; guard wiring recorded (ask rendered and DECLINED). Tester blind spots (fixture-
       only): F-456's --upgrade selection and refuse direction; F-458's designer mid-drilldown death, the three sibling
       literals, an oversized-batch rig — carried on the hb-20260914-02 Blind spots line.
     Issues: #10 and #13 CLOSED by comment (a Closes keyword fires only on a merge into main; the fix is on dev).
     Bus repair: F-459 (documented entries with no doc_path) logged today as OPEN — the A-V round claimed the number in
       its close-out comment but never appended the section; Session C1 (RP-5) expects it.
     Dispatch evidence (F-340), on dev after the merge, tip d8a4c5f, QUOTED after completion:
         validate-plugin 34938967980: changes success / manifests success / validate (ubuntu-latest) success
         docs-drift 34938970568: drift (full) success / drift (stripped) success
     Under test + canary -> dev · hb-20260914-02. Next free number F-460. Released: nothing (dev stages 0.37.1, 0.38.0,
       0.39.0). Carried, not in scope: PR #17 (draft, also stages 0.39.0 — rebases its bump); OPEN polish F-453 (Session D)
       and F-454 (Session C1); OPEN normal F-450, F-451, F-452, F-455, F-457, F-459 with their scheduled rounds.
     Next: Session C1 per handoffs/SESSION-PROMPTS.md (local-only, untracked). -->

<!-- tester 2026-09-14 (Session B-V — verdict round @ hb-20260914-01; UNMERGED, riding a branch):
     Branch round-b-describe-loop -> PR #19, base dev, UNMERGED; verdicts pushed on the branch at 7779664.
       Transitions on the branch: F-456 FIXED -> VERIFIED, F-458 FIXED -> VERIFIED (#13 confirmed live in the same arm).
       Both Session B sections of dev/VALIDATION.md CLEARED @ hb-20260914-01 on the branch. Claims no new F-number.
     Load: consumer workspace, --plugin-dir on the working tree (measured by process path), canary hb-20260914-01 matched,
       checkout clean at 2686ae5 before the verdict commit. Tenant: sandbox, CLI 1.0.9.
     Measured: F-456 — the recorded cn chain describe admitted by describe-batch (documented 3, commandSource recorded) and
       by capture (exit 0, no BOM). F-458 — a token death past the half-life aborted with reason auth, failures [], zero
       auth-failed marks, the in-flight entry unmarked and documented on the resume after login; #13 — a mismatched describe
       stopped after exactly 5 spawns (five distinct request ids), marks restored.
     Rig deviations (Bradley, before the runs): F-456 used --statuses documented (no metadata-depth chain on either tenant);
       F-458 used a timed start (no domain holds ~600 eligible entries); step 6 used rules-engine-chains (scorecard has 4).
     Walks + guard wiring: the branch bus's Walk (hb-20260914-01) line — email-report, audit, deprecate, refresh fences ran
       verbatim on Windows PowerShell 5.1; setup walked to Phase 4's first refusal (scorecard-schemes generated date,
       declined), Phase 5 not walked in setup; guard ask rendered on a delete-schedule probe and was declined.
     Blind spots (tester): no refusal exercised live on the read-shape gate (fixtures only); the designer lane's auth death
       and the three sibling auth literals not produced live; one auth death on one domain; deprecate step 4's schedule
       fence unwalked (declined at approval); prod not run.
     Noticed, not logged (not in this round's scope): the live auth sentence reads "re-authenticate" with backticks, not the
       Fix note's "(re-)authenticate" literal, and matched anyway; the libuv abort exits 3221226505 here, not the 127 the
       operating model's KI-017 text states; the candidate diff holds 4 undecided sources-fields/objects commands. -->

<!-- builder 2026-09-14 (Session B — describe loop and its fences; UNMERGED, riding a branch):
     Payload: DB-1..DB-4 of the September round plan — #10 ({page} quoted in every paginate fence, capture's refusal names
       the shell cause, check-doc-drift check 14 holds the quoting), F-456 (one exported read-shape predicate, doc-lib
       isDescribeRead, admitting a describe-shaped actionKey — cn chain and the unlisted sibling re r execution — composed
       by describe-batch AND capture; catalog sweep test pins the admitted set at the pin), #13 + F-458 (describe-batch
       aborts after 5 consecutive failed marks, and on the FIRST auth death with nothing marked — doc-lib isAuthDeath on the
       CLI's re-login sentence, version-stamped; one additive summary field aborted { reason, after, lastError }). Plugin
       0.39.0 staged (CHANGELOG). Rulings recorded in the Fix notes (Bradley, 2026-09-14).
     Branch round-b-describe-loop -> PR #19, base dev, UNMERGED. Transitions on the branch: F-456 OPEN -> FIXED,
       F-458 OPEN -> FIXED (both with Class/Judge/Sibling sweep). Claims no new F-number. #10 and #13 close on merge.
     Review: /code-review medium, 8 finders + 3 file-batched verifiers — 8 findings, all fixed on the branch (F-458 Fix note).
     Under test on the branch: hb-20260914-01; blind spots = the two live arms banked in dev/VALIDATION.md (Session B
       sections) plus the skill walks (setup slash-only; fence-only edits in audit, deprecate, email-report, refresh).
     Carried, not in scope: PR #17 (draft, also stages 0.39.0 — the second to merge rebases its bump); OPEN polish F-453
       (Session D) and F-454 (Session C1) stay with their scheduled rounds.
     Next: Session B-V (tester, consumer workspace) on the branch; then C1/C2 per handoffs/ (local-only). -->

<!-- builder 2026-09-14 (bus pointer fix — no handoff; nothing under test changed):
     Payload: the four pointers to the rounds B-E handoff set (Blind spots line above, 09-11 block below) named a
       tracked-looking dev/handoff/ that a fresh clone does not have — the set was untracked on 2026-09-11. They now name
       handoffs/, where the set was moved on the owner's machine: the public-repo home under the handoff-plan skill's
       convention (ignored in public repos, tracked under dev/handoff/ in private ones). The set is working notes, never
       repo content. Token hb-20260911-04 unchanged; the ignore rules for both paths stay.
     Carried, not in scope: PR #17 (admin-as-strategic-partner, checks green, awaiting merge); OPEN polish F-453
       (Session D) and F-454 (Session C1) stay with their scheduled rounds. -->

<!-- builder 2026-09-11 (F-449 round CLOSED OUT — MERGED):
     Payload: F-449 (high) — the Phase 4 exclusion verdict bound to the overlap check's numbers (manifest.mjs exclude
       --check/--no-check/--covered-by/--recheck-after; domain-candidates.mjs check --command --out; diff kinds), plugin 0.38.0
       staged (CHANGELOG), the rounds B-E handoff set (round plan, session prompts, cleanup plan — untracked 2026-09-11,
       local-only in handoffs/), dev/VALIDATION.md.
     Branch f449-evidence-bound-exclusions -> PR #16, base dev, MERGED by Bradley 2026-09-11 (dev @ e919333); branch deleted
       local + remote. Review: /code-review medium, 8 finders — 7 CONFIRMED fixed on the branch, 1 PLAUSIBLE skipped with
       mitigation (--no-check stays free text, now its own kind).
     Verdict: F-449 VERIFIED @ hb-20260911-03 (tester, Session A-V, sandbox) — both banked arms PASS (refuse path 253 of 588
       refused then adopted as report-objects; accept path 69 of 69 excluded as coverage); both dev/VALIDATION.md sections
       CLEARED; setup and refresh walked; guard wiring recorded (ask rendered, accepted by the user). Ruling recorded on the
       Sibling sweep line: the journey-side dataset list is a duplicate view of data-management (prod was right).
     Logged by the round: F-459 (normal) — documented entries with no doc_path; scheduled as RP-5 in Session C1 (handoffs/, local-only).
     Carried, OPEN polish in this round's scope at kickoff: F-453 (Session D), F-454 (Session C1).
     Dispatch evidence (F-340), on dev after the merge, tip 2130d59, QUOTED after completion:
         validate-plugin 34655779573: changes success / manifests success / validate (ubuntu-latest) success
         docs-drift 34655781022: drift (stripped) success / drift (full) success
       (two earlier dispatches on e919333 and the push-event runs on 2130d59 were cancelled by concurrency as later
       pushes landed; the pair above is the evidence that was read.)
     Under test + canary -> dev · hb-20260911-04. Next free number F-460. Released: nothing (dev stages 0.37.1, 0.38.0).
     Next: Session B per handoffs/SESSION-PROMPTS.md (local-only, untracked). -->

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

## F-469 — VERIFIED
Reported: 2026-09-29 (builder, consumer follow-up (b) of dev-utils F-026, which shipped the `Dev-only:` bus header line in dev-utils 0.5.0)
Severity: polish — release tooling, CI and checks only; what ships is correct (every copy names the same two paths today)
Class: consumer-parity
What: the release strip set (dev/ plus the dev-canary skill) has no declaration: each place that asks "is this dev-only?" answers from its own hand list. build/check-doc-drift.mjs holds four (check 17's DEV_ONLY_STRIP_PATHS; check 18's SHIPPED_STRIP_REF needle and its canary-dir scope exclusion; check 4's CANARY_ALLOWED; DEV_ONLY_SKILLS, the skill filter checks 1-3 run on). .github/workflows/docs-drift.yml holds two (the stripped rehearsal arm's `git rm -r -q --ignore-unmatch dev plugins/gs-superadmin/skills/dev-canary`; the "No dev-only content on main" step's two existence tests). dev/RELEASE-CHECKLIST.md §3 holds one, build/test-check-doc-drift.mjs five skill picks plus its check 17/18 probes, and CLAUDE.md and CONTRIBUTING.md carry prose copies. dev-utils 0.5.0's `Dev-only:` line (what `dev-utils release` strips with the canary) is absent here, and writing it alone would add one more copy.
Repro: `git grep -n -e 'skills/dev-canary' -e 'DEV_ONLY' -- build .github dev/RELEASE-CHECKLIST.md`; then add a third path to the strip in one copy (the stripped arm's `git rm`, say): check 17's scope, check 18's needle and the main existence step still answer from their own lists, and nothing goes red.
Expected: one declaration: the bus header's `Dev-only:` line, written by `dev-utils init --dev-only`, beside the `Canary:` line (dev-utils strips the canary with the declared paths). Every reader derives the set from those two lines. Change the line and checks 1-4, 17 and 18, the stripped arm and the main existence step all follow with no second edit; prose points at the line. A tree the strip already ran on (no dev/FEEDBACK.md) still gets the set.
Fix: 2026-09-29 (builder) — Class confirmed: consumer-parity — one fact, the release strip set, held by eight readers that each kept their own copy. The declaration is now the bus header's `Dev-only: dev plugins/gs-superadmin/skills/dev-canary`, written by `dev-utils init --dev-only` (0e5a0b1; `dev-utils status` lists both paths with no `!!`), read together with the `Canary:` line because dev-utils strips the canary with the declared paths. build/dev-only.mjs is the one reader and a CLI (`node build/dev-only.mjs` prints the set). Its grammar is dev-utils' check_dev_only; it is stricter only toward refusing (a missing line, or a second one, is refused: the checks anchor on the line). Every reader moved onto it: check-doc-drift checks 1-3 (the skill filter), 4 (the canary's name, from Canary:, and its allowance), 17, and 18 (needles derived per path, repo-relative and plugin-relative; a one-segment path needs a child and never heads an absolute path, so /dev/null stays green and ../dev/X does not). Also docs-drift.yml's stripped arm (`git rm` of the CLI's output) and its no-dev-only-content step (a loop over it, now also run on the rehearsal arm as the survivor check dev-utils release makes), and test-check-doc-drift's six skill picks and its check 17/18 probes (generated per path). New check 24 holds both workflow steps to the reader: each must run it and spell no strip path itself. Prose points at the line: CLAUDE.md (repo map, release bullet), CONTRIBUTING.md, and RELEASE-CHECKLIST §3, whose strip is `git rm … $(node build/dev-only.mjs)` plus two verify commands (one commit beyond dev; no declared path survives). §5 is `dev-utils release-finish`. The cut stays by hand: Bradley's decision 2026-09-29 over `dev-utils release`, because nothing is pushed until the stripped tree is green, and a red leg after the push is recut onto the same branch, so the PR stays open. Where a tree the strip already ran on gets the set (kickoff item 2): the working-tree bus when there is one; else HEAD's (the rehearsal arm strips the worktree and index and commits nothing); else origin/dev's (a release branch, the release PR, main — release-finish's own answer); none is refused, never read as an empty set. docs-drift.yml fetches dev shallowly (`git fetch --no-tags --depth=1 origin +refs/heads/dev:refs/remotes/origin/dev`) only when the tree has no bus. Judged not "is this dev-only?" questions, so left alone: check-stale-facts' FLAG_EXCLUDE and CITATION_EXCLUDE, and check-doc-drift's check 13 dev/ exclusion, LC_EXCLUDE and BOM_EXCLUDE. Each keys on dev/ as the loop's record (a frozen archive, bus prose quoting old spellings), which would hold even if dev/ shipped. Found by the rehearsal before handoff: the suite's first run on a stripped shape crashed (a refusal case left a malformed bus in the rig's HEAD and the stripped-only arm read it); fixed in the suite, and re-run on all three shapes. The mutation sweep below left one unpinned arm (M10), now pinned by a control case. Reload: nothing to reload — no plugin byte changed (build, CI and docs only; no version bump).
Judge: the kickoff's mutation, built before the fix and run red first on dev's hand copies, with predictions written before either run. A scratch judge changes the Dev-only line in a copy of the tree (adds a path, drops `dev`). Check 17, check 18, and docs-drift.yml's stripped-arm and main-existence step bodies (run verbatim through real bash) must follow, on three shapes: the full tree, the rehearsal shape (bus only in HEAD) and the release shape (strip committed, bus only on origin/dev). 0/10 arms followed on ffca105's hand copies and 10/10 on the fix, every arm as predicted. The grammar is judged by a differential against dev-utils' own check_dev_only (0.5.0): 12342 vectors (49 branch vectors, plus a separator census of every code point to U+3000 and U+FEFF), all agreeing. Three grammar mutants each disagreed on exactly the predicted vectors: a JS whitespace split (6), no .git refusal (3), a case-sensitive none (2). A first G1 run, malformed because it lost its backslash, is not counted. The tester's live arm is this acceptance round.
Sibling sweep: consumer-parity recipe, about a minute. `node build/sweep-twins.mjs` finds 9 runs, 2 of them undeclared; both are pre-existing, in plugin scripts this round did not touch (manifest.mjs:756 = :1634; relationships-build.mjs:372 = tenant-deps.mjs:411), and none involves a changed file. `git grep -e 'skills/dev-canary' -e 'DEV_ONLY' -e 'dev plugins/gs-superadmin'` outside the bus leaves three kinds of hit, none a copy of the declaration: check-doc-drift's grammar-comment examples and DEV_ONLY_CONSUMERS; the reader's in-memory grammar fixtures in test-check-doc-drift (synthetic bus text); and test-check-stale-facts' CANARY_PATH (the Canary: rule's fixture). Every consumer of the set reaches the one reader: `git grep -l dev-only.mjs` lists check-doc-drift, test-check-doc-drift, docs-drift.yml (2 steps), CLAUDE.md, CONTRIBUTING.md and RELEASE-CHECKLIST §3.
Mutation copy-out — sweep (source: the fix's own decision points in build/dev-only.mjs and check-doc-drift checks 1-4, 17, 18 and 24 — a vacuity check on the committed pins, not closure); predictions written before the run; suite = build/test-check-doc-drift.mjs; shapes: F full tree, A rehearsal (bus only in HEAD), B release (bus only on origin/dev):
    M1  F  the canary no longer joins the set from Canary:            KILLED pred:KILL
    M2  F  a second Dev-only: line accepted                           KILLED pred:KILL
    M3  F  tracked-ness validation removed                            KILLED pred:KILL
    M4  F  BUS_REFS drops HEAD                                        SURVIVED pred:SURVIVE
    M4  A  BUS_REFS drops HEAD                                        KILLED pred:KILL
    M5  F  BUS_REFS drops origin/dev                                  SURVIVED pred:SURVIVE
    M5  A  BUS_REFS drops origin/dev                                  SURVIVED pred:SURVIVE
    M5  B  BUS_REFS drops origin/dev                                  KILLED pred:KILL
    M6  F  check 18's absolute-path exclusion removed                 KILLED pred:KILL (the baseline itself: the guard's /dev/fd comments)
    M7  F  a one-segment spelling needs no child                      KILLED pred:KILL
    M8  F  a name character after a multi-segment spelling passes     KILLED pred:KILL
    M9  F  check 24's spells-a-strip-path test removed                KILLED pred:KILL
    M10 F  check 24 scans comment lines in a run: body                SURVIVED pred:SURVIVE (unpinned arm)
    M10 F  the same, re-run on the control case pinned for it         KILLED pred:KILL
    M11 F  check 4's strip-set allowance removed                      KILLED pred:KILL
    M12 F  checks 1-3 stop filtering dev-only skills                  KILLED pred:KILL
    M13 F  a reader refusal no longer exits                           SURVIVED pred:SURVIVE (ledgered: behaviour-equivalent — still exit 1, the refusal printed first)
  17 of 17 as predicted. M4 and M5 die only in the shape that reads that ref: docs-drift's stripped arm kills M4 in CI, and only the release shape kills M5 — in CI, first at the next release PR.
Verdict: REOPENED 2026-09-29 (tester, F-469 acceptance round) @ hb-20260929-01. Under test: branch fix-f469-dev-only (PR #35, unmerged), checkout clean and level with origin at 8b8596c (the handoff commit); the dev-canary skill's description read hb-20260929-01 in session. Round type: ACCEPTANCE — the first verdict on a new mechanism (the Dev-only: line as the one declaration, read by build/dev-only.mjs). Every measurement ran in a scratch clone of the branch; the repo's working tree was not edited until this verdict.
Pass bar (stated before measuring, from the Fix note): (a) change the Dev-only line (add a path, drop one) and every reader follows with no second edit — check-doc-drift checks 1-4, 17, 18 and 24, `node build/dev-only.mjs`, and docs-drift.yml's two strip-set step bodies; (b) a tree the strip already ran on gets the set from HEAD (rehearsal shape) or origin/dev (release shape), and a missing or malformed declaration is refused loudly, never read as an empty set; (c) the reader's grammar agrees with dev-utils' check_dev_only (the reader's documented extra strictness — no line, or a second line — excepted).
Measured (a): 25 Dev-only values through the reader, `dev-utils status` and check-doc-drift. Dropping the canary dir from the line still strips it (Canary: joins); `none`, `NONE` and a dropped `dev` turn dev/ into shipped docs and check 4 reds on the archive's canary mentions (it follows); adding a shipped skill dir (skills/audit) is stripped by both workflow bodies and the stripped tree reds on the README's /gs-superadmin:audit references (it follows). What fails: adding a FILE at the plugin root — `plugins/gs-superadmin/MAINTAINERS.md` — leaves check-doc-drift exit 0 ("112 shipped files name none of it"), while 7 mentions in 5 shipped files (README, CHANGELOG, describe-batch.mjs x2, doc-lib.mjs, setup's document-domain-notes.md) are the dangling pointers check 18 exists to catch. Check 18 derives a plugin-relative spelling per path, and that spelling is ONE segment (`MAINTAINERS.md`), so the rule built for the repo-root word `dev` — a one-segment spelling needs a child after it — applies and no mention of a file can ever have one. The repo-relative spelling is still derived, but shipped text addresses plugin files plugin-relatively.
Class (the invariant, not an instance list): for every declared strip path P, a shipped-file mention of P in the spelling shipped text actually uses for it (plugin-relative when P lies inside the plugin, repo-relative otherwise) reds check 18. The child requirement is a property of a one-segment spelling that is also an English word, not of every one-segment spelling. Falsifiable test that enumerates nothing: for each path P on a mutated line and each tracked file F under P, append a Markdown link to F's plugin-relative path to a shipped .md; check 18 must red naming P. Measured violated for P = a plugin-root file; the same test holds for every multi-segment P tried and for dev/.
Measured (b): all green. Rehearsal shape (mutated line committed, adding skills/audit): the strip body, run verbatim under bash -eo pipefail, removed the three paths; the reader then named HEAD:dev/FEEDBACK.md; the existence body exited 0, and 1 naming skills/audit once that dir alone was restored. Release shape (origin = the clone itself, dev = a branch carrying the mutated line, a throwaway release/* branch): RELEASE-CHECKLIST §3's strip and commit ran verbatim; its verify printed 1 and nothing; the fetch and existence bodies read origin/dev:dev/FEEDBACK.md and exited 0. Refusals: a malformed line (`dev ../x`) in the worktree bus, in HEAD's and an origin/dev bus with no line each exit 1 through the step bodies; no bus anywhere is refused naming `git fetch origin dev`; §3's strip with a refused reader dies at git rm (No pathspec, 128).
Measured (c): the 25 values agree refused-vs-accepted with `dev-utils status`, apart from the documented second line (a column-0 Dev-only: inside a header comment block: the reader refuses, dev-utils reads the first). Tab, NBSP, U+001C, a trailing backslash, ./dev, dev/, CRLF and a missing space after the colon split and normalize alike; U+FEFF is refused by both as untracked. One framing divergence the value-level differential cannot see: dev-utils reads the bus with universal newlines, so a lone CR is a line break there and not in the reader. `Dev-only: dev<CR>plugins/gs-superadmin/skills/email-report` makes the reader strip email-report while dev-utils strips dev alone, and `Load-x: y<CR>Dev-only: dev` is refused by the reader while dev-utils reads it. Recorded as evidence, not as a reopen: no editor or dev-utils verb writes a lone CR.
Not reopened by: checks 1-4, 17 and 24, the reader's grammar and its three bus sources, the workflow bodies, §3's strip. Noted, not reopening (pre-existing, same as dev's SHIPPED_STRIP_REF): check 18 does not see a backslash spelling (dev\VALIDATION.md) or a bare dir mention (the dev/ folder). §3's second verify loop prints the refusal on stderr but exits 0 when the reader refuses, so its "prints nothing" pass signal is carried only by what the operator reads.
Reopened: 2026-09-29 (tester @ hb-20260929-01, F-469 acceptance round, fix-f469-dev-only @ hb-20260929-01) — check 18 does not follow a Dev-only line that declares a one-segment plugin-relative path: plugins/gs-superadmin/MAINTAINERS.md added to the line leaves check-doc-drift exit 0 while 7 shipped mentions in 5 files would dangle after the strip, because the child-required rule built for the word dev applies to every one-segment spelling. Pass bar (a) fails; (b) and (c) met. Verdict, class and invariant test above.
Fix: 2026-09-29 (tester, role inversion @ hb-20260929-01, on Bradley's call) — the claim is narrowed, not the matcher widened. Check 18 is a text search with no oracle, so patching the one-segment case would invite a reopen on the next spelling. Bradley's decision 2026-09-29: narrow the claim. Change (the commit before this bus flip): check-doc-drift's check 18 comment and its line in the header list call it a best-effort lint, list its measured misses (a one-segment plugin-relative strip path such as a plugin-root file, a backslash spelling, a bare dir mention, another letter case, a path built in code), and place the guarantee of what the release strips, and that none of it survives, in build/dev-only.mjs and docs-drift's two strip-set steps. Those are the parts this round measured green on all three shapes. The Fix note's pass bar (a) now reads: every reader that DECIDES the strip follows a changed line, and check 18 follows it for dev/, the canary and multi-segment paths. No code path changed; doc-drift 208/208, check-doc-drift, check-stale-facts and check-instance-data green. The verdict of record is the builder's, per role inversion. Reload: none (build comment only).
Judge: the builder, on the way out: read the check 18 comment against the Verdict block's measured misses (each one listed, nothing claimed that the probe matrix showed green-when-it-should-red), and re-run one Dev-only line mutation through the reader and the two step bodies
Verified: 2026-09-29 (builder, fix-f469-dev-only @ hb-20260929-01) — builder verdict of record on the tester's role-inverted fix (5a386a7, flipped at b03896b). Pass bar, from the Judge line the tester wrote before this run: (1) check 18's comment lists every miss the acceptance round measured and claims nothing its probe matrix showed green where it should red; (2) no code path changed; (3) every reader that decides the strip still follows a changed Dev-only line. Measured: (1) the comment names the three misses the verdict measured (the plugin-root file MAINTAINERS.md, the backslash spelling, the bare dir mention), plus three true by construction (a plugin-root dir named bare, another letter case, a path built in code). Its only positive claim is the forward-slash spellings, which the judge's J2, J8 and J9 exercise. (2) git diff 8b8596c b03896b -- build changes comment lines only. (3) the builder's scratch judge, re-run on b03896b: 10/10 arms follow (add a path, drop dev; check 17, check 18, and the strip and existence step bodies through bash; full, rehearsal and release shapes). check-stale-facts, check-doc-drift and check-instance-data green. Observed, not reopening (polish, outside the Judge's scope): check-doc-drift's pass line still reads 'N shipped files name none of it', the wording the acceptance round quoted from a run with 7 dangling mentions; qualifying it as check 18's search is a one-line follow-up.

## F-470 — VERIFIED
Reported: 2026-10-03 (tester, S1-V on feat/jo-dash-s1-facts @ hb-20261003-01; production tenant, reads only; found while choosing V9's P-unsub program, before any run of the adapter)
Severity: normal — on a tenant whose unsubscribe link carries none of the classifier's wording, the adapter counts unsubscribe clicks as content clicks: the click rate R18 defines is overstated, and a template can read `tracked` on unsubscribe clicks alone
What: `classifyLink` (plugins/gs-superadmin/scripts/engagement.mjs, `NON_CONTENT_LINK_RULES`) calls a clicked link content unless it is `mailto:` or matches `unsubscribe | opt-out | email-preferences | manage-preferences`. On the measured tenant the emails' unsubscribe link is not a Gainsight URL: it is a preferences-center page on the company's own website, and its path words it as `<word>-preferences-center` (once as `<word>-<word>-preferences-email`). The pattern matches neither, so every such click classifies as content. Over the 13-month window ~10^1 clicked sends carried that link, one program's only clicked send among them; in a 5000-row sample of the year before the window it was the most-clicked link of all (~10^3 sends). No clicked URL in either read classified as unsubscribe or mailto.
Repro: one catalog-checked read of `email_log_v2` plain rows (`SourceId`, `EmailTemplateId`, `ExecutedDate`, `LinkClickedJson`) with `Source EQ "Advanced Outreach"`, `AddressType EQ "To"`, a two-sided `ExecutedDate` window, `LinkClickedCount GT 0` and `--page-size 5000`. Unwrap each row's entries, reduce every URL to host plus path skeleton (ids masked, query values dropped) and classify each with `classifyLink`: every skeleton reads content, the site's preferences-center page included.
Expected: Bradley's ruling (2026-10-03): the unsubscribe link is a per-tenant input. Set-up asks whether an external domain or link is used for unsubscribes, and the classifier treats a match as not content, beside its generic patterns. Tenant specifics are spec parameters, never hardcoded (the plan's house rule 13); where the question is asked (workspace setup or the dashboard interview), the spec field and the adapter input are the builder's to settle with Bradley. It rides the S1 builder batch with the V0 changes; V9 at the S1-V re-run verifies it on the chosen P-unsub, its run lines passing the new input.
Fix: 2026-10-03 (builder, S1 fix batch on feat/jo-dash-s1-facts, PR #36 unmerged) — Class, in one sentence: a fact about ONE tenant (which page its recipients unsubscribe on) was carried by a wording pattern applied to EVERY tenant, so the pattern is right only where the tenant happens to use its words. The fix is the input Bradley ruled, not a wider pattern. Three decisions he took at this batch's kickoff: (1) the input is a link or a host and it repeats; (2) the generic patterns do NOT widen (a wider built-in pattern runs unchecked on every tenant and would drop real content clicks); (3) the dashboard interview asks for it, beside internal domains. What changed in scripts/engagement.mjs: a new flag, `--unsubscribe-link <link|host>`, repeatable. A value with a path names that host (or a subdomain of it) and that path or anything under it, by whole path segments; scheme, query, letter case and a trailing slash are ignored. A value with no path names the whole host. It is parsed as a URL, never matched as a substring, and a value that names no web host is refused at the command line. `classifyLink` treats a match as not content, after `NON_CONTENT_LINK_RULES`, which are unchanged and still decide first. It is a run parameter: echoed in `meta.params.unsubscribeLinks` (normalized, sorted; empty when none is given); part of the run's identity, so a run directory resumes only with the input it started with; and a change to it, in either direction, forces a full refresh in `decideRefresh` ("the unsubscribe links changed"), as a change of internal domains does. One thing the report did not list and the class reaches: click EVIDENCE. Reduce merged each template's click history from the previous snapshot on every refresh, full ones included, so a template the old input called tracked on unsubscribe clicks would have stayed tracked after the input was set. History now carries only from a snapshot classified under the same input. Added for the tester: `honesty.clicks.byUnsubscribeInput`, the clicked sends with at least one link the input named; 0 means the input matched nothing. Sibling built, not in the report: another page of the same site whose path only BEGINS like the named page (the fixture's look-alike) must stay content, and does; so does the site's home page, and the same path on another host. Where the fact lives: nowhere in the repo; it is the tenant's, so no table gained a row. Other tenant-shaped constants in the adapter were read for the same class and left: the JO source name and the two response-status labels are product values the spike matched against the UI, and internal domains were already an input. What the tester does: this is verified by V9 of the S1-V re-run (dev/VALIDATION.md § ENG-2, rewritten for it): pass the tenant's unsubscribe link on every run line; P-unsub must read zero content clicks, its templates `unknown`, `nonContentOnly` above zero and `byUnsubscribeInput` above zero. Reload: /reload-plugins (a script changed; no hook, no skill).
Judge: offline, the engagement suite's oracle: the fixture generator records which of each send's clicked links are content when it writes them, and the snapshot's clicked counts must equal a straight count of that record, with no classifier and no reducer in the count. With the input passed they are equal on the own-site fixture; without it they are not, which is the defect reproduced. The judge of record is the tester's live arm, V9, on the tenant's real links: the fixture's link is one this session wrote, so it cannot show that the real link's shape is covered.
Mutation copy-out — sweep (source: the decision points of this batch's three changes in scripts/engagement.mjs — the F-470 input, and the two contract changes riding with it; a vacuity check on the committed checks, not closure); predictions written before the run; suites = test/engagement.mjs + test/contract-conformance.mjs:
    M1   roll-up: tracked when ANY template is  KILLED pred:KILL
    M2   roll-up: not-tracked when ANY template is  KILLED pred:KILL
    M3   roll-up: the empty-program guard dropped (0 === 0 reads tracked)  SURVIVED pred:SURVIVE
    M4   resp-total: the Responded filter dropped  SURVIVED pred:SURVIVE
    M5   the all-time response call is never planned  KILLED pred:KILL
    M6   all-time Partially submitted counted as Submitted  KILLED pred:KILL
    M7   readResponses(months) hands back the all-time denominator  KILLED pred:KILL
    M8   readResponses() all-time counts read from responseParticipants swapped  KILLED pred:KILL
    M9   classifyLink ignores the tenant's links  KILLED pred:KILL
    M10  matcher: the path segment boundary dropped  KILLED pred:KILL
    M11  matcher: subdomain test without its dot  KILLED pred:KILL
    M12  matcher: path compared case-sensitively  KILLED pred:KILL
    M13  decideRefresh: a changed input no longer forces a full refresh  KILLED pred:KILL
    M14  reduce: click history carried whatever the input  KILLED pred:KILL
    M15  fetch: click payloads classified without the run's links  KILLED pred:KILL
    M16  meta.params no longer echoes the input  KILLED pred:KILL
    M17  resolveParams: values not sorted  KILLED pred:KILL
    M18  parseUnsubscribeLink: a word with no dot accepted as a host  KILLED pred:KILL
    M19  parseUnsubscribeLink: a link with a user part accepted  KILLED pred:KILL
    M20  byInput never counted  KILLED pred:KILL
    M21  the tenant's links decide before the generic rules  KILLED pred:KILL
    M22  run identity: the input left out of the resume comparison  KILLED pred:KILL
    M23  resolveParams: duplicate values kept  KILLED pred:KILL
    M24  reduce: all-time counts kept for programs outside the selection (guard dropped) SURVIVED pred:SURVIVE
  24 of 24 as predicted. The three predicted survivors are equivalent on any reachable state, not unpinned arms: M3 (a selected program always has at least one send, so it always counts a template), M4 (a row with a Submitted or Partially Submitted status is a responded row; the filter mirrors the monthly call's), M24 (the row list is built from the denominator's programs, which are already limited to the selection).
Pass bar (stated before measuring, from VALIDATION section ENG-2's V9 and this Fix note): with both unsubscribe links passed on every run line, `meta.params.unsubscribeLinks` echoes them; P-unsub reads `clicked` 0 on every one of its rows and its templates read `unknown`; `honesty.clicks.nonContentOnly` > 0 and `honesty.clicks.byUnsubscribeInput` > 0.
Not verified: 2026-10-03 (tester, S1-V re-run @ hb-20261003-02, feat/jo-dash-s1-facts clean at 9482657, production tenant, reads only) — the bar could not be measured, so the status stays FIXED: every quantity in it reads the snapshot, and run 2 built none (F-471 and F-472 left it partial; runs 3-5 were not run, on Bradley's call). The input passed was the tenant's two unsubscribe pages, both on the company's own site, as the emails print them (host with www, page path, trailing slash). Diagnostic, not the bar: run 2's click-json payload, which the fetch classifies under the run's input, holds 1591 clicked sends; 59 carry at least one link the input named, and 36 have only non-content links, every one of them an input match. So for those 59 sends, blind spot (1) of this handoff (a stored tracking redirect that would not match) did not occur: the log stored the page links themselves, and the host-and-path matcher caught them in the form the emails print; a wrapped link elsewhere would read as content and is not excluded by this count. P-unsub's rows and template states need the click attribution that F-471 blocks. V9 carries to the next re-run with the same inputs.
Verified: 2026-10-03 (tester, S1-V second re-run @ hb-20261003-03, feat/jo-dash-s1-facts clean and level with origin at 96ed11e, the dev-canary skill read hb-20261003-03 in session; production tenant, reads only) — RE-VERIFICATION round: the verdict against the pass bar above, stated before measuring, and nothing past it. Same inputs as the first re-run on every run line (both unsubscribe pages as the emails print them). Measured on run 2's snapshot (full refresh, completed): `meta.params.unsubscribeLinks` echoes both, normalized to host/path and sorted; P-unsub has 6 rows, `clicked` 0 on every one, and its 3 templates read `unknown` (program roll-up `unknown`, templates {tracked 0, notTracked 0, unknown 3}); `honesty.clicks.nonContentOnly` 36 and `honesty.clicks.byUnsubscribeInput` 59. Runs 3, 4 and 5 read the same echo and both counts above zero. Pass. Beside the bar, logged on its own: F-473 (clicked sends with no company link never reach attribution), a different mechanism from this input.

## F-471 — VERIFIED
Reported: 2026-10-03 (tester, S1-V re-run on feat/jo-dash-s1-facts @ hb-20261003-02; production tenant, reads only; VALIDATION section ENG-2, V8, run 2)
Severity: normal — the adapter cannot finish any run through the real CLI: its click-attribution call is refused before it is sent, so the run ends partial and reduce builds no snapshot. No skill calls the script yet and PR #36 is unmerged, so no user reaches it; V8's failure already holds the merge.
What: the `click-attr` family (plugins/gs-superadmin/scripts/engagement.mjs, `FAMILIES`) groups by `Gsid` (with program, template, month and the company path) and shows only `countOf`, which is COUNT of `Gsid`. CLI 1.0.10 normalizes every `rp run` request before sending it (its dist/artifacts/validators/report.js, `normalizeGroupByDedup`): it drops each show field whose key equals a group-by field's key, and the key is `objectName::fieldName`, with the aggregation ignored. So COUNT of email_log_v2.Gsid reads as a duplicate of the grouped email_log_v2.Gsid and is dropped; the show list is then empty, and `assertShowFieldsNonEmpty` refuses the request client-side. The adapter classifies that failure `other`, correctly neither retried nor split, so all three click-attr units (all, and one per internal domain) fail on every run, on any tenant, whatever its click volume: the call is always planned. The stand-in CLI (test/fixtures/engagement/acme-tenant.mjs) does not model the normalizer, so the suites stay green. The spike recorded the rule's warning text (SPIKE-NOTES' error list: exit 0, with another show field left); the refusal case was never exercised.
Repro: from a consumer workspace with the plugin loaded from this branch, `node .gs-superadmin/plugin/scripts/engagement.mjs run --kb <slug> --internal-domain '<domain>' --run <id> --out <file>` exits 4 with status partial, and its fetch-log.jsonl records each click-attr unit `failed`, kind `other`, with this stderr (as the log records it):
    [report] normalizeGroupByDedup: removed 1 showField(s) already present in groupByFields. Error: Report must have at least one entry in showFields (spec 2.1, EMPTY_SHOW_ME_FIELDS).
Expected: the clicked-sends attribution reaches the server, and a run with no other failure completes. The class, as an invariant rather than a list: no family's built query shows a field whose objectName::fieldName, keyed as the CLI keys it, equals one of its group-by fields', because the CLI deletes such a show field silently when another remains and refuses the call when none does. A falsifiable test that enumerates nothing: put the CLI's own normalization in front of the stand-in CLI, or run every family's built query through `normalizeGroupByDedup` and `assertShowFieldsNonEmpty` keyed exactly as the CLI keys, and require every family in `FAMILIES`, default and step detail, to pass through unchanged. Unmeasured live, because run 3 did not run: `step-click` groups by a lookup path whose leaf is `Gsid` and shows COUNT of `Gsid` on ao_emails; whether the CLI keys that path with the log's object or the hop target decides whether it collides, and the test above settles it offline. The CLI's aggregation-blind comparison is arguably an upstream quirk, worth a /gs-superadmin:report-bug report, but the adapter is pinned to 1.0.10 and has to work with it.
Fix: 2026-10-03 (builder, second S1 fix batch on feat/jo-dash-s1-facts, PR #36 unmerged) — Class, in one sentence: the adapter asked for a request shape the CLI rewrites before sending, and the stand-in CLI answered the request as written, so the suites certified a query the real CLI never sends. Three changes. (1) The query: `click-attr` still groups by the send's id, and now counts a field it does not group by (COUNT of LinkClickedCount, which its own filter guarantees is set); its reader never read the count, only the group columns, so nothing downstream moved. (2) The invariant, by construction: `validateQuery`, which every `rp run` already passes through before it is spawned, now refuses any query that shows a field it also groups by, keyed as the CLI keys (object and field name; a lookup path by the object its last hop lands on and its leaf; aggregation and date bucket ignored). A future family with the collision fails offline, naming the field, instead of at a tenant. (3) The stand-in CLI now applies the CLI's rule before answering: it drops the colliding show field with the CLI's warning, and refuses with the CLI's error text when none is left. That is your first falsifiable test, and it is what makes the suites able to see this class. Your open question, settled offline: `step-click` does NOT collide. The handler keys a lookup path by the hop target, so its group is email_log_v2::Gsid and its count is ao_emails::Gsid. Not done here, and yours or Bradley's to decide: the upstream report (/gs-superadmin:report-bug) on the aggregation-blind comparison. What the tester does: /reload-plugins, then the re-run from run 1 on the new token; V8 judges this (every family ends ok, click-attr included, with no dropped-show-field warning on any call).
Judge: the installed CLI's own code, not this session's model of it: a scratch script imported `normalizeGroupByDedup` and `assertShowFieldsNonEmpty` from the pinned CLI's dist/artifacts/validators/report.js (1.0.10, read from disk; no tenant call) and ran every family's built query through them, all 16 families in every recipient class they are built for. Every one came back unchanged, and the click-attr shape as handed off at hb-20261003-02 was refused with the message you recorded, so the judge reproduces the defect before it passes the fix. Its one hand-derived input is how a field spec becomes the object and field name the CLI keys on; that was read from the handler (the aggregation and the date bucket keep the field's own key, a lookup path takes the last hop's object). The judge of record is V8 on the tenant.
Sibling sweep: every family in FAMILIES was run through the judge above, which is the class's whole population in this adapter (no other script issues `rp run`: `git grep -l '"rp", "run"' plugins/gs-superadmin/scripts` lists engagement.mjs alone). 0 other collisions.
Mutation copy-out — sweep (source: the decision points of this fix in scripts/engagement.mjs; a vacuity check on the committed checks, not closure); predictions written before the run; suites = test/engagement.mjs + test/contract-conformance.mjs:
    N1   click-attr counts Gsid again (the shape the tester ran)  KILLED pred:KILL
    N2   validateQuery: the shown-and-grouped check removed  KILLED pred:KILL
    N3   fieldKey: a lookup path keyed by the base object, not the hop target  KILLED pred:KILL
  3 of 3 as predicted.
Pass bar (stated before measuring, from VALIDATION section ENG-2's V8 as re-banked at hb-20261003-03): every call family ends `ok`, click-attr included; no unit in `failed`; and no call's record carries a `normalizeGroupByDedup` warning.
Verified: 2026-10-03 (tester, S1-V second re-run @ hb-20261003-03, feat/jo-dash-s1-facts clean at 96ed11e, canary matched; production tenant, reads only) — RE-VERIFICATION round, the bar above and nothing past it. Over all four adapter runs (303, 356, 168 and 226 calls): each summary reads `status: ok` with `failed: []`; every family's final record is `ok`; click-attr 3 of 3 units ok in each of runs 2-5; `step-click` 4 of 4 ok in run 3, so the open question in this section's Expected is settled on the server too (no collision); 0 lines carrying `normalizeGroupByDedup` in any run's stderr. Pass.

## F-472 — VERIFIED
Reported: 2026-10-03 (tester, S1-V re-run on feat/jo-dash-s1-facts @ hb-20261003-02; production tenant, reads only; VALIDATION section ENG-2, V8, run 2)
Severity: normal — on a tenant with a mass-send day, every full run ends partial, so it builds no snapshot. No user reaches it today (unmerged; no skill calls the script), and V8's failure already holds the merge.
What: the `account` family's split ladder is programs, then day, then the IsOpened and IsSent flags, and `runUnit` fails a unit with "nothing left to split on" when the last rung still returns a full page. At account grain the row count grows with the distinct accounts a program reaches inside one partition, not with time, so a program-day reaching more than 5000 accounts in one opened/sent partition can never fit, whatever the ladder does. Measured: of 167 account calls, 32 returned a full 5000-row page; 27 of them split further and completed, and 5 units, each one program on one day in one opened/sent partition, still returned exactly 5000 rows. They cover three programs (one program-day in three of its four partitions, two others in one each; two of the three days are the last day of one month and the first of the next). These are the tenant's mass-send days: one Email Chain sent ~3 x 10^5 emails in a single month, observed at the first S1-V round. The fictional tenant has no program-day that large, so the suites cannot see it. The truncated payloads stay on disk but are unusable: the unit is failed, and reduce refuses a partial run.
Repro: the run line in F-471 on a tenant with such a day. The run's summary lists each unit under `failed` with kind `truncated` and "nothing left to split on"; fetch-log.jsonl shows each one with one program id, a one-day window, two flag partitions and 5000 rows.
Expected: the class, as an invariant: a family whose grain carries an entity key (account, send, participant) can cut a unit by that key, or by some other dimension that bounds the rows per call, below one program-day; time and flags bound the rows only for families whose grain is time-shaped. A falsifiable test: a fixture program-day whose distinct accounts exceed the page in every flag partition completes, with totals equal to the oracle's. Siblings with the same floor, not tripped on this tenant: `click-attr` and `click-json` (a row per clicked send; ladder programs, then day) and `step-click` (a row per clicked send). The measured tenant's 1591 clicked sends over 13 months fit in one click-json call, so the click families are far from it today.
Fix: 2026-10-03 (builder, second S1 fix batch on feat/jo-dash-s1-facts, PR #36 unmerged) — Class, as you stated it: a split ladder whose rungs bound the rows only for time-shaped grains, under a family whose rows grow with an entity count. The fix adds one last rung, taken from your "some other dimension that bounds the rows per call": the unit is cut by the RECIPIENT'S ADDRESS. A unit still full at one program, one day and one flag partition splits into the sends whose address contains a character and the sends whose address does not, then again on the next character, down a fixed list of 36 (letters and digits; no punctuation, which a server could read as a pattern wildcard). Why this dimension: the measures are additive, so any cut of the SENDS that puts each send in exactly one half adds up to the same account rows (an account with recipients in both halves gets a row in each, and reduce sums them); CONTAINS and DOES_NOT_CONTAINS on the same character are each other's complement; and both operators are ones the spike measured on this exact field, which the internal and external class filters already rely on. A cut by the account key itself would need an operator on the lookup field that nothing has measured. Only a single character ever reaches a filter; no address does. The rung is on every family with your floor: account, click-attr, click-json, template, and step and step-click on the JO log's own address field. Distinct counts (the uniques and participant families) are never cut by it: they do not add up across a cut. The ladder still ends: when the characters run out the unit fails as before, and the run is partial. Cost: each extra level re-asks a full page, so a mass-send day adds a few calls per level; your run 2 would have added calls only under the 5 failed units. What the tester does: /reload-plugins, then the re-run from run 1 on the new token. Start a NEW --run name rather than resuming run 2's directory: a resume would work (the kept truncated units now split further), but it would reduce calls pulled hours apart, and opens arriving in between can make the template and account tables disagree for a reason that is not a defect. V8 judges this (no `truncated` unit in `failed`), and V1's reconciliation judges the cut itself.
Judge: offline, your falsifiable test, built as a fixture: a program that sends to sixty accounts on one day, pulled at a 20-row page, so one opened-and-sent partition of that day holds more accounts than the page. The run completes, and the suite's oracle (a straight count of the fixture's rows, no query and no reducer) must equal the template table and the account table's totals. What decides it on a real tenant, independently of this session, is the adapter's own reconciliation: `accounts-sum-to-program` compares the account table with the template table per program, month and measure, and the template table with the cheap tenant-wide count. If the two operators are not exact complements on real addresses (a null address, a case rule), a send is lost or counted twice and that check goes red, naming the program and month. So V1 on the re-run is the judge of record, with V8.
Sibling sweep: the split ladders of all 16 families were read for the same floor. Given the rung: account, template, click-attr, click-json, step, step-click (every family whose rows are sends or grow with an entity count and whose measures add up). Not given it, with the reason: uniques-month, uniques-window, participants-month, participants-window (distinct counts); sent-since and classes (a handful of rows per program or per source); resp-month, resp-participants and resp-total (survey_participant carries no address; rows are programs times statuses); account-names (cut by its key list already).
Mutation copy-out — sweep (source: the decision points of this fix in scripts/engagement.mjs; a vacuity check on the committed checks, not closure); predictions written before the run; suites = test/engagement.mjs + test/contract-conformance.mjs:
    N4   account: no address rung  KILLED pred:KILL
    N5   address rung: both halves CONTAINS (no complement)  KILLED pred:KILL
    N6   address rung: the character is picked by the whole partition's length  KILLED pred:KILL
    N7   the JO send log cut on the delivery log's address field  KILLED pred:KILL
    N8   click-json: no address rung  KILLED pred:KILL
    N9   account: the address rung tried before the flags  SURVIVED pred:SURVIVE
    N10  the cut list shortened to one character  KILLED pred:KILL
  7 of 7 as predicted. N9, the predicted survivor, is a cost choice, not a correctness one: either order of the last two rungs yields the same totals.
Known limit: 2026-10-03 (builder, from an independent read of this fix before handoff) — the cut covers every send only if a send with NO address at all lands in the does-not-contain half. The stand-in CLI puts it there; nothing measured says the real server does, and if it does not, that send is in neither half. For the template and account families the reconciliation checks would go red. For the click families nothing would: a clicked send with no address would simply not be counted. The same assumption already sits under the external-recipient filter, which the first build shipped. It is not patched here, because the exact fix needs an is-null filter shape nothing has measured either, and a wrong one would fail the very runs this fix exists to complete. Instead the precondition is banked as one read in dev/VALIDATION.md section ENG-2: the count of in-scope sends whose address is null. Zero makes the limit moot on that tenant; above zero, reopen this section with the count.
Pass bar (stated before measuring, from VALIDATION section ENG-2 as re-banked at hb-20261003-03): V8, no unit in `failed` is `truncated`; V1, a unit cut by the recipient's address still adds up (the account and template tables agree on every measure of every program and month the cut touched); and the banked read for the known limit, the count of in-scope sends with a null address: zero, nothing more; above zero, reopen.
Verified: 2026-10-03 (tester, S1-V second re-run @ hb-20261003-03, feat/jo-dash-s1-facts clean at 96ed11e, canary matched; production tenant, reads only) — RE-VERIFICATION round, the bar above and nothing past it. V8: `failed: []` in all four runs; run 2's account family made 265 calls, 76 of them full pages that split further, and none was left truncated (run 3: the same, plus `step` 25 of 25 ok on the JO log's own address field). V1: the adapter's `accounts-sum-to-program` is red, so the cut was judged on its own, against a count that does not go through the adapter: in all 561 program-months of run 2, template-table sent minus account-table sent equals that program-month's count of sends with no company link, from one direct grouped read (561 of 561 equal, 0 differ), the mass-send month the cut split deepest included. Every other measure's mismatch sits in those same program-months, apart from two in the current month on one mass-send program where sent agrees and delivered (6) and opened (1) differ: status changing between calls minutes apart (F-475), not the cut, which would move sent. So the red is F-473 (a send with no company link leaves the account table entirely), a different mechanism, logged on its own; the cut adds every send exactly once. Known limit: COUNT of in-scope sends with `LowerCaseEmailId IS_NULL` over the window = 0 (the filter applied: a dropped filter returns the total), so the limit is moot on this tenant. Pass.

## F-473 — VERIFIED
Reported: 2026-10-03 (tester, S1-V second re-run on feat/jo-dash-s1-facts @ hb-20261003-03; production tenant, reads only; VALIDATION section ENG-2, V1, run 2)
Severity: normal — on a tenant with sends that carry no company link, a full run silently under-counts the account table, the clicked sends and the program list, and nothing but one reconciliation check says so. No user reaches it yet (unmerged; no skill calls the script), and V1's failure holds the merge.
What: every `rp run` that names a lookup `fieldPath` (`PATH.company`, `PATH.person`) as a group-by or an aggregate drops, on the server, every row whose lookup is null: they come back neither as a null group nor in the count. The adapter assumes the opposite (the plan's "a row with no company link gets its own bucket", T-10's `no-company-link` row, the stand-in CLI's behaviour), and S0 never measured it: S0 measured that a lookup path resolves real values and that a PLAIN null field comes back as a group with no `v`, not what a null LOOKUP does. Three consequences on run 2, measured:
  1. `account` (groups by the company path): the account table is short by exactly the sends with no company link. In all 561 program-months, template-table sent minus account-table sent equals that program-month's count of in-scope sends with `GsCompanyId IS_NULL` (one grouped read; 561 of 561 equal, 0 differ); 25 program-months differ, 24,863 sends, 2.3% of the window. `honesty.noCompanyLink.sent` reads 0 and no `no-company-link` row carries a send.
  2. `click-attr` (groups by the company path): of 1,220 clicked sends in selected programs (one grouped read), the snapshot attributes 806; the 414 missing are exactly the clicked sends with no company link. No check sees this: `clicked-within-delivered` cannot, and `honesty.clicks.clickedSends` reports the attributed count. Clicked counts and click rates are understated, and a template whose only clicks are on such sends reads `unknown` instead of `tracked`.
  3. `uniques-month` (counts through both paths) is the program total that `decidePrograms` resolves "programs with sends" from and that `templates-sum-to-program` compares against. A program whose EVERY send lacks a company link is absent from it, so it is never selected, never counted as deleted or unselected, and its sends are in no honesty field: one listed program, 730 sends in the window's template payloads, 16 clicked sends.
Repro: the VALIDATION ENG-2 run 2 line. Its summary reads `reconciled: false`, `templates-sum-to-program` and `accounts-sum-to-program` not ok, with examples where the template table exceeds the program total and the account table. Then one read: COUNT of `Gsid` on `email_log_v2` with the adapter's `logWhere` (Source, AddressType, the window's two ExecutedDate bounds) plus `GsCompanyId IS_NULL`, grouped by `SourceId` and month: each program-month's count equals its template-minus-account gap.
Expected: the class, as an invariant: no send leaves the snapshot without landing in a fact row or an honesty count. A lookup path may decide which account or person a send belongs to, never whether the send is counted. A falsifiable test that enumerates nothing: a stand-in CLI that drops every row whose lookup path is null from any call naming that path (the measured server behaviour), plus a fixture with sends lacking a company link, one program whose every send lacks it, and a clicked send among them; the oracle (a straight count of the fixture's rows) must equal the snapshot's template, account and clicked totals, and that program must be selected. Two shapes the fix can take (the builder's call): read the null-link sends with a separate `IS_NULL` call per family (measured working here: the operator, on this field, in a grouped call), or move selection and program totals to a call that names no lookup. Also on the builder's list: the stand-in CLI should claim only server behaviour that has been measured; F-471 and this section are both a stand-in answering a shape the server answers differently. No T-10 change: `no-company-link` already exists.
Fix: 2026-10-03 (builder, third S1 fix batch on feat/jo-dash-s1-facts, PR #36 unmerged) — Class, in one sentence, yours: a lookup decided whether a send was counted, where it may only decide which account or person the send belongs to. Both shapes you named were needed, one per consequence. (1) Program totals and selection moved to a call that names no lookup: a new family, `totals` (program by month, COUNT, nothing else), is what `decidePrograms` reads "programs with sends" from and what `templates-sum-to-program` compares against. A program whose every send lacks a company link is now selected like any other. (2) The distinct counts are each asked through their own lookup alone: the uniques calls took people and accounts in one call, which dropped the sends lacking EITHER link from both counts. They are now two calls each, one through the person lookup and one through the company lookup, so people is exact over the sends that have a person and accounts over the sends that have a company. (3) The sends with no company link are read by their own calls, `GsCompanyId IS_NULL`: `account-nolink` (program by month by the six flags) fills the `no-company-link` rows T-10 already had, and `click-attr-nolink` (the clicked-sends attribution without the company path) attributes their clicks; each has its internal-domain twin, since internal recipients are the sends most likely to have no company. (4) The same drop sat under the survey calls: rows no program owns never came back, so `honesty.responses.unattributed` read 0 by construction. One more call counts them (`AOParticipantId IS_NULL`). Cost: 11 more calls on a pull with two internal domains. Not changed, with the reason: `step-click` joins through the JO log's link to the delivery log, and a JO row with no such link has no send to attribute a click to; the participant counts are distinct counts through their own lookup alone. The stand-in CLI: it now drops every row whose lookup is null from any call that groups or aggregates through that lookup, which is your falsifiable test, and it turned 23 of the suite's checks red before the fix. Its header now says, for each behaviour, that it was measured; the one it still assumes without a measurement on a non-empty case is that DOES_NOT_CONTAINS keeps a null address (F-472's known limit; 0 such sends on this tenant). No T-10 change. What the tester does: /reload-plugins, then the re-run; V1 judges this.
Judge: the real server, in this session (Bradley offered the live token; reads only, every command through the adapter's gate; 2026-10-03). Two things were measured that the fix rests on. (a) The new shapes are accepted and answer: `totals`, both single-lookup uniques calls, `account-nolink`, `click-attr-nolink` and `resp-unattributed` each ended ok with the columns their readers read; over one closed month `totals` and the template call sum to the same number. (b) "Has a company link" and "`GsCompanyId IS_NULL`" are an exact partition of the sends: over the 13-month window, tenant-wide, all sends minus (sends counted through the company path plus sends with IS_NULL) = 0, and the same for clicked sends = 0; IS_NOT_NULL equals the count through the path, so no send points at a company that is gone. Without (b) the fix would have traded one silent loss for another. The judge of record is V1 at the re-run: `templates-sum-to-program` and `accounts-sum-to-program` read ok over the closed months, `honesty.noCompanyLink.sent` equals your direct IS_NULL count for the selected programs, and the program your round found unselected is in the snapshot. Offline: the oracle (a straight count of the fixture's rows) equals the template, account and clicked totals under a stand-in that behaves as the server does, with a program whose every send lacks the link and with clicked sends lacking it, internal and external.
Sibling sweep: every family in FAMILIES was read for a lookup path in a group-by or an aggregate. account and click-attr: given a no-link twin. uniques-month, uniques-window: one lookup per call. resp-month, resp-participants, resp-total (through the participant lookup): the dropped rows are the unattributed ones, now counted by resp-unattributed. step-click, participants-month, participants-window: left, reasons in the Fix note. totals, template, classes, sent-since, click-json, account-nolink, click-attr-nolink, step, account-names, resp-unattributed: no lookup. A suite check now refuses any delivery-log call that counts sends, or asks two distinct counts, through a lookup.
Mutation copy-out — sweep (source: the decision points of this fix in scripts/engagement.mjs; a vacuity check on the committed checks, not closure); predictions written before the first run, the table from the re-run on the final code; suites = test/engagement.mjs + test/contract-conformance.mjs:
    P3   both distinct counts asked through the person lookup  KILLED pred:KILL
    P4   the no-company-link sends are never read (account table)  KILLED pred:KILL
    P5   the no-company-link clicked sends are never read  KILLED pred:KILL
    P6   the internal no-company-link clicked sends are never read  KILLED pred:KILL
    P7   the internal no-company-link sends are never read (account table)  KILLED pred:KILL
    P8   the unattributed survey rows are never counted  KILLED pred:KILL
    P9   program totals: a split unit's leaves overwrite each other  KILLED pred:KILL
    P15  monthly unique rows emitted only where the people call has the program-month  SURVIVED pred:SURVIVE
  8 of 8 as predicted. P15, the predicted survivor, is equivalent on the fixture: every program-month with sends has at least one send with a person.
Pass bar (stated before measuring, from VALIDATION section ENG-2 as re-banked at hb-20261003-04 and carried to hb-20261003-05): over the closed months `templates-sum-to-program` and `accounts-sum-to-program` read ok; `honesty.noCompanyLink.sent` equals a direct count of the selected programs' in-scope sends with `GsCompanyId IS_NULL`; the clicked sends attributed (`honesty.clicks.clickedSends`) equal a direct count of the selected programs' clicked sends; and the listed program whose every send lacks a company link is in the snapshot.
Verified: 2026-10-03 (tester, S1-V third re-run @ hb-20261003-05, feat/jo-dash-s1-facts clean and level with origin at 7cc5d79, the dev-canary skill read hb-20261003-05 in session; production tenant, reads only) — RE-VERIFICATION round, the bar above and nothing past it. Run 2 (full): `reconciled: true`; templates-sum-to-program ok, 563 compared, 0 mismatches; accounts-sum-to-program ok, 4504 compared, 0 mismatches (its 3 differences are current-month drift, F-475). Both checks also read ok with 0 mismatches in runs 3, 4 and 5. Direct reads through the spike's catalog-checked runner, with the adapter's own filters (Source, AddressType, the window's two ExecutedDate bounds), grouped by SourceId and summed over the snapshot's 194 programs: `GsCompanyId IS_NULL` 25867 = `honesty.noCompanyLink.sent` 25867; `LinkClickedCount GT 0` 1236 = `honesty.clicks.clickedSends` 1236. Programs whose every in-window send lacks a company link (their IS_NULL count equals their total): 2, both in the snapshot; `excluded.unselectedPrograms` reads 0 programs (1 program, 730 sends, at hb-20261003-03). Pass.

## F-474 — VERIFIED
Reported: 2026-10-03 (tester, S1-V second re-run on feat/jo-dash-s1-facts @ hb-20261003-03; production tenant, reads only; VALIDATION section ENG-2, V11)
Severity: normal — the response rate's denominator on the parity program reads 2% above the figure the UI shows, unexplained; R3 wants it equal or documented.
What: V11's program, an Active Dynamic Program: `facts.responseParticipants` reads participants 542, submitted 65, partially submitted 35. The UI reads 531 "surveys sent", 67 submitted, 35 partial (all time). Submitted is explained: the operator identified 2 of the UI's 67 as internal test responses; `survey_participant` holds 65 Submitted rows, none flagged `TestParticipant`. Partial is equal. The denominator is not explained by any field read: the program's 542 rows break down as 158 Email Opened, 236 + 13 test Not Responded, 31 + 2 test Survey Opened, 2 Undelivered Or Bounced, 65 Submitted, 35 Partially Submitted; every one has a `SurveySentDate`; the count is the same in three pulls hours apart (542 at the first re-run, 542 and 542 today), so it is not growth. Excluding the 15 test rows gives 527, excluding the 2 undelivered gives 540; neither is 531. S0 measured this denominator equal to the UI's participant count on both of its parity programs.
Repro: the VALIDATION ENG-2 run 2 line; read the program's `facts.responseParticipants` row. Then COUNT of `survey_participant.Gsid` grouped by the fieldPath to `ao_participants.AdvancedOutreachId`, `ResponseStatus`, `Responded`, `TestParticipant`, `InternallySubmitted`.
Expected: either the rows the UI leaves out are identified and the denominator follows the UI, or the difference is documented as an R3 divergence with its cause. Not determinable from the CLI side alone: the next step is reading which UI figure 531 is (its label, and whether it counts test participants or distinct people) beside the breakdown above.
Builder note: 2026-10-03 (third S1 fix batch) — NOT fixed, and left OPEN: nothing on the CLI side explains the UI's figure, so there is no change to make yet. Read in this session on the same tenant (Bradley offered the live token; reads only), for the program whose rows total 542: `Deleted` is false on all 542; `TestParticipant` false 527, true 15; `InternallySubmitted` false on all; one distribution channel; distinct `Email` 487, distinct person 487, distinct company 385; `Token` and `LinkId` distinct on every row. The send log's side of the same program, all time, per email: the first email has 527 attempts, 523 that went out and 521 that went out and did not bounce; no email and no sum reads 531. So 531 is not: the rows, the rows less test participants (527), the rows less undelivered (540), distinct people, or any send-log count. What is left is the UI's own definition, which only the UI can show: the figure's label and tooltip, whether its page has a date or test-participant toggle, and whether the survey has been sent by more than this program (R20's caveat is that the UI's survey analytics counts every program that ever sent the survey). That read is banked in dev/VALIDATION.md section ENG-2 for V11. Until it is made this stays OPEN as a documented, unexplained 2% difference; by this loop's rules an open normal finding gates the release, not this branch's merge, and V11 is not one of the checks whose failure holds the branch. Bradley decides whether it holds the merge anyway.
Fix: 2026-10-03 (builder, fourth S1 fix batch on feat/jo-dash-s1-facts, PR #36 unmerged) — Explained by two reads Bradley made in the UI, then ruled by him. The 531 is the SURVEY's own page: 531 participants, 102 responded, 427 not responded, 2 undelivered, test responses included. The PROGRAM's analytics page reads 527 participants and 100 responded. The adapter's 542 rows are that 527 plus the 15 rows flagged `TestParticipant`; its 100 responded already equalled the program page (none of the 15 responded). The survey page is a different basis, per survey rather than per program, which the plan already rules out of scope (program-level responses only, with a caveat that the survey's analytics counts every program and channel that sent it). Class, in one sentence: a count taken over every row of an object where the UI's figure leaves a flagged subset out. Bradley's ruling (2026-10-03): the survey figures EXCLUDE test participants, so they equal the UI's program analytics. Change: the three survey calls that feed facts (`resp-participants`, `resp-total`, `resp-month`) carry `TestParticipant EQ false`, so the denominator, the all-time counts and the monthly rows are all on one basis; one more call, `resp-test`, counts the test rows left out per program, and the snapshot reports the selected programs' total as `honesty.responses.testParticipantsExcluded`. T-10: no field changes; the typedef's note on `responseParticipants` says test participants are not counted (a definition, before the freeze). Sibling checked: the send log has no test flag (the spike's finding), so the send measures have no such subset; internal and test RECIPIENTS there are the internal-domain class. What the tester does: /reload-plugins; V11 on the new token.
Judge: V11 at the re-run, against the UI's PROGRAM analytics (not the survey page): P-survey's `facts.responseParticipants` row reads participants 527, submitted plus partially submitted 100, and `honesty.responses.testParticipantsExcluded` counts that program's 15 among the selected programs' total. Not measured by the builder: the token had expired, so whether the server accepts `TestParticipant EQ false` is the tester's (the same operator on a boolean of this object, `Responded EQ true`, has run in every pull; the tester grouped by `TestParticipant` last round). A row whose flag is null would be left out with the tests: last round's breakdown of this program showed only true and false.
Mutation copy-out — sweep (source: the decision points of this fix in scripts/engagement.mjs; a vacuity check on the committed checks, not closure); predictions written before the run; suites = test/engagement.mjs + test/contract-conformance.mjs:
    R1  the denominator counts test participants  KILLED pred:KILL
    R2  the all-time counts include test participants  KILLED pred:KILL
    R3  the monthly rows include test participants  KILLED pred:KILL
    R4  the excluded test participants are never counted  KILLED pred:KILL
  4 of 4 as predicted.
Pass bar (stated before measuring, from VALIDATION section ENG-2 as re-banked at hb-20261003-05, V11 and V8): P-survey's `facts.responseParticipants` row equals the UI's PROGRAM analytics page (participants 527; submitted plus partially submitted 100), and `honesty.responses.testParticipantsExcluded` is above zero; the survey's own page (531 and 102) is not the comparison; a failing survey family, resp-test included, is V8's finding with its stderr text.
Verified: 2026-10-03 (tester, S1-V third re-run @ hb-20261003-05, feat/jo-dash-s1-facts clean and level with origin at 7cc5d79, the dev-canary skill read hb-20261003-05 in session; production tenant, reads only) — RE-VERIFICATION round, the bar above and nothing past it. Run 2: P-survey's row reads participants 527, submitted 65, partially submitted 35 (100), equal to the program page; `testParticipantsExcluded` 92 over the selected programs. Run 3 reads the same. resp-participants, resp-total and resp-month (each now with `TestParticipant EQ false`) and the new resp-test ended ok in all four runs, as did resp-unattributed (813 unattributed rows). Pass.

## F-475 — VERIFIED
Reported: 2026-10-03 (tester, S1-V second re-run on feat/jo-dash-s1-facts @ hb-20261003-03; production tenant, reads only; VALIDATION section ENG-2, run 3)
Severity: normal — a correct snapshot can carry `reconciliation-mismatch` and `reconciled: false`, so the one signal that separates a defect from a healthy pull is noisy on every long pull that covers the current month.
What: the fact families are pulled one at a time over tens of minutes, and the current month is still being written (late sends, delivery status, opens). Run 3 (38 minutes, step detail on) reported three mismatches beyond F-473's, all in the current month: `internal-within-all` (one send counted internal but not in the all-recipients table, a send that arrived between the two calls), `steps-sum-to-template` (delivered 17 apart on a mass-send program, ao_emails pulled minutes after email_log_v2) and one more template-vs-program pair. Every closed month reconciled as in run 2. Run 2 (32 minutes) carries the same effect inside F-473's red: on one mass-send program in the current month, the account and template tables agree on sent and differ on delivered (6) and opened (1). The builder anticipated the effect for resumed runs (F-472's Fix note) but nothing in the adapter tells it apart from a defect.
Repro: any run that covers the current month while the tenant is sending; compare its reconciliation examples' months with `meta.incompleteFrom`.
Expected: reconciliation separates the incomplete period from closed months: a mismatch on or after `incompleteFrom` is reported as drift with its size, not as `reconciled: false`, or the families for that period are pulled close enough together that they cannot drift. A closed-month mismatch stays a failure.
Fix: 2026-10-03 (builder, third S1 fix batch on feat/jo-dash-s1-facts, PR #36 unmerged) — Class, in one sentence: one verdict over two periods that cannot be held to the same standard, the closed months and the month still being written. The first shape you named: every reconciliation check now separates them. A difference in a month before `meta.incompleteFrom`'s month fails the check, as before (`ok`, `mismatches`, `examples`). A difference in that month or later is DRIFT: counted in the check's new `drift` field with up to ten `driftExamples`, and it leaves `ok` and `reconciled` true. A snapshot with drift carries the caveat `incomplete-period-drift` (the boundary day, and the drift count per check); `reconciliation-mismatch` now means a closed month disagrees. The run summary prints `drift` per check. The second shape, pulling the families close together, was not taken: the calls run one at a time and a mass-send month alone takes minutes. T-10: the two fields are additive on the reconciliation checks; the typedef and the pin moved together. One check was renamed in passing because the Delivered ruling made it false: `clicked-within-delivered` is now `clicked-within-sent` (an attempt that went out, was clicked and then bounced is clicked and not delivered). What the tester does: /reload-plugins; at the re-run, a pull covering the current month reads `reconciled: true` with its drift counted, if every closed month agrees.
Judge: your repro, at the re-run: compare each run's reconciliation examples' months with `meta.incompleteFrom`. A closed-month mismatch must still read `ok: false`; that is what keeps this from hiding a defect, and F-473's fix is what should make the closed months agree. Offline: the same two-send difference seeded into the current month reads as drift with reconciled true, and seeded into the month before reads as a failure; the boundary follows `--incomplete-from`.
Mutation copy-out — sweep (source: the decision points of this fix in scripts/engagement.mjs; a vacuity check on the committed checks, not closure); predictions written before the first run, the table from the re-run on the final code; suites = test/engagement.mjs + test/contract-conformance.mjs:
    P10  reconciliation: every difference is a closed-month failure (no drift)  KILLED pred:KILL
    P11  reconciliation: the incomplete month itself counts as closed  KILLED pred:KILL
    P12  reconciliation: every difference is drift (nothing fails)  KILLED pred:KILL
  3 of 3 as predicted.
Pass bar (stated before measuring, from VALIDATION section ENG-2 as re-banked at hb-20261003-04 and carried to hb-20261003-05): on the run summaries, any difference in the current month is reported as `drift` on its check with `reconciled: true`; a difference in a closed month still reads `ok: false`, and that is a finding.
Verified: 2026-10-03 (tester, S1-V third re-run @ hb-20261003-05, feat/jo-dash-s1-facts clean and level with origin at 7cc5d79, the dev-canary skill read hb-20261003-05 in session; production tenant, reads only) — RE-VERIFICATION round, the bar above and nothing past it. All four runs read `reconciled: true`, with 0 closed-month mismatches on every check. Every drift example is in 2026-10 (`meta.incompleteFrom` 2026-10-01), on one mass-send program: run 2 accounts-sum-to-program 3 (sent 1, delivered 27, opened 1); run 3 accounts-sum-to-program 2 and steps-sum-to-template 2 (delivered 11, opened 2 each); runs 4 and 5 accounts-sum-to-program 2 each. Each of those snapshots carries the caveat `incomplete-period-drift`. No closed month differed, so the failure arm was not exercised live (it is pinned offline by P10-P12). Pass.

## F-476 — VERIFIED
Reported: 2026-10-03 (tester, S1-V second re-run on feat/jo-dash-s1-facts @ hb-20261003-03; production tenant, reads only; VALIDATION section ENG-2, V6 and V13, runs 2-5)
Severity: normal — the cost a user is shown before a pull (R21: "the cost must be clear up front") is low by a factor that grows on exactly the pulls users run most, the monthly selective refresh, and on a mass-send tenant it decides whether a pull fits the one-hour token.
What: `plan` prices each family by its unsplit units (seconds per call times calls) and cannot see the address-cut and day splits a mass-send program-day forces. Measured, estimate against actual: run 2 (full) 139 calls / 1011 s against 303 / 1909 s (1.89x elapsed, inside V13's 2x bar); run 3 (step detail) 184 / 1326 s against 356 / 2267 s (1.71x); run 4 (selective, the two re-pull months) 29 / 241 s against 168 / 1016 s (4.2x elapsed, 5.8x calls); run 5 (`--sent-since 90d`, 67 programs) 91 / 675 s against 226 / 1429 s (2.1x). The selective refresh re-pulls the current and previous month, which on this tenant hold the two mass-send months, so most of its calls are splits the estimate never counts. Its estimate said a refresh takes four minutes; it took seventeen.
Repro: the VALIDATION ENG-2 lines for runs 1-5; compare each run's `estimate.thisRun` with `calls.made` and the elapsed time.
Expected: the estimate prices the splits it will meet. The previous snapshot's run directory records how many calls each family and month actually took (fetch-log.jsonl), and the cheap tenant-wide program × month call already gives rows per program and month; either one predicts the split depth before the first expensive call. A falsifiable test: over the fixture's mass-send tenant variant, `plan` against a previous run's directory estimates the selective run's calls within the 2x bar V13 holds the full run to.
Fix: 2026-10-03 (builder, third S1 fix batch on feat/jo-dash-s1-facts, PR #36 unmerged) — Class, in one sentence: an estimate that counts the units it plans, when the cost is in the calls each unit turns into. `plan` now prices the split tree of every account-grain unit from the cheap tenant-wide calls it already makes, the second of the two sources you named (the first, a previous run's fetch log, exists only for a refresh and only on the machine that made it). The model, in `expectedCalls`: a program-month is expected to hold about one and a half rows per account it reaches, never more rows than sends; when that is a page or more, the unit costs the call that comes back full, two calls for every rung the ladder climbs before the address cut (the window halved down to one day, then the two flags), and two calls per half-page leaf. Every estimate `plan` prints uses it: this run, a full run, what step detail adds, and whether the run fits the token. `estimate.thisRun` gains `units`, the count of planned units, beside `calls`. The click and step families are still priced at one call each: none of them split on the measured tenant. What the tester does: /reload-plugins; at the re-run compare each run's estimate with its calls and seconds, as V13 and V6 already do.
Judge: the tester's own measurements, against the new `plan` run on the same tenant in this session (Bradley offered the live token; reads only, the cheap calls `plan` makes, every one through the adapter's gate; 2026-10-03). Estimate, then the calls the round's runs took plus the 11 calls this batch adds to every pull: full 298 against 314 (seconds 2168 against 1909); step detail 343 against 367; selective 107 against 179 (831 s against 1016 s); sent-since 90 days 186 against 237. All four inside the 2x bar, where the selective run was 5.8x. The constants were set against these four pulls, so this is a fit, not a prediction: the judge of record is the next re-run's own estimate-against-actual, on runs made after this change, and a tenant whose mass sends are spread over many days will be over-estimated. Offline: the fixture's mass-send day at a 50-row page, full and selective, each within 2x.
Mutation copy-out — sweep (source: the decision points of this fix in scripts/engagement.mjs; a vacuity check on the committed checks, not closure); predictions written before the first run, the table from the re-run on the final code; suites = test/engagement.mjs + test/contract-conformance.mjs:
    P13  the estimate prices no split  KILLED pred:KILL
    P14  the estimate's rows are not capped by the sends  KILLED pred:KILL
    P18  the estimate prices no rung before the address cut  KILLED pred:KILL
    P17  the plan's first calls skip the accounts count (row estimates fall back to sends)  KILLED pred:SURVIVE MISMATCH
  3 of 4 as predicted. P17 MISMATCH: predicted to survive (without the accounts count the row estimate falls back to the sends, which the fixture's mass day equals), killed because a check pins how many calls `plan` makes. The prediction missed an existing pin; no mechanism is misunderstood.
Pass bar (stated before measuring, from VALIDATION section ENG-2 as re-banked at hb-20261003-04 and carried to hb-20261003-05, V13 and V6 as written): each run's estimate against its calls and seconds, the selective run included, inside the 2x bar; all four pairs recorded.
Verified: 2026-10-03 (tester, S1-V third re-run @ hb-20261003-05, feat/jo-dash-s1-facts clean and level with origin at 7cc5d79, the dev-canary skill read hb-20261003-05 in session; production tenant, reads only) — RE-VERIFICATION round, the bar above and nothing past it. Each run's own `estimate.thisRun` against its `calls.made` and elapsed seconds: run 2 (full) 299 / 2175 s -> 315 / 2090 s (1.05x calls, 0.96x seconds); run 3 (step detail) 344 / 2490 s -> 369 / 2498 s (1.07x, 1.00x); run 4 (selective) 105 / 817 s -> 181 / 1096 s (1.72x, 1.34x; it was 5.8x and 4.2x); run 5 (sent-since 90 days) 187 / 1391 s -> 239 / 1658 s (1.28x, 1.19x). All four inside 2x. These are the first runs made after the constants were fitted, so this is the prediction the Judge line asked for, still on one tenant. Pass.

## F-477 — WONTFIX
Reported: 2026-10-03 (tester, S1-V third re-run on feat/jo-dash-s1-facts @ hb-20261003-05; production tenant, reads only; VALIDATION section ENG-2, the Delivered ruling's checks V3 and V12)
Severity: polish — unreachable on the measured data: no send that went out carries a null bounce flag, so no figure differs; logged so that a deviation on some tenant has a record to point to
What: Bradley's Delivered ruling (2026-10-03) is "went out and did not bounce". Asked at this round whether a send that went out with a NULL bounce flag counts as delivered, he ruled that in practical terms it does not. The two readers decide it the other way round: `logFlags` in scripts/engagement.mjs counts a row delivered when `IsSent` is YES and `IsBounced` is not YES, and `joFlags` when `EmailSend` is true and `Bounce` is not true (the T-10 typedef says "not YES" / "not true" in words), so a went-out row whose bounce flag is null would count as delivered. Measured, through the spike's catalog-checked runner with the adapter's own filters: email_log_v2 over the 194 selected programs and the 13-month window, rows with `IsSent` YES and `IsBounced` null: 0; rows with `IsSent` null: 0. ao_emails: the P-multi month read, 0 with `Bounce` null; Bradley read the flag across the tenant and found every value set (his read, not a CLI count).
Repro: COUNT of `Gsid` on email_log_v2 with the adapter's filters, grouped by SourceId, IsSent and IsBounced: a group with IsSent YES and no `v` on IsBounced is the case. On ao_emails, the same with EmailSend and Bounce.
Expected: no change now. Decided: 2026-10-03 (Bradley) — WONTFIX: an unreachable state the adapter would be built for. If any tenant shows a went-out send with a null `IsBounced` or `Bounce`, log a new finding that points here; the fix is the two readers testing `IsBounced = NO` and `Bounce = false`, with the typedef text and the pin. After T-10's freeze that changes what a measure counts, which the contract-freeze rule governs.

## F-478 — OPEN
Reported: 2026-10-03 (tester, S1-V third re-run on feat/jo-dash-s1-facts @ hb-20261003-05, read from the code at f378505; first noticed by the builder in the S1-fix round and carried unlogged since; logged on Bradley's call)
Severity: normal — on a tenant pair that shares ids (a sandbox copied from production), a refresh given the other tenant's snapshot as --previous can mark a template's clicks `tracked`, so a 0% shows as a real 0%, from clicks recorded on the other tenant; unmerged and no skill calls the script yet, but the S2 report and any direct use of the adapter reach it before PUB-1's tenant refusal exists
What: when the previous snapshot is another tenant's, `decideRefresh` falls back to a full refresh ("the previous snapshot is another tenant's"), and on a full refresh no fact row and no step is carried. But reduce reads three lookups from the previous snapshot on EVERY refresh, full ones included, and none of them checks the tenant: (1) click history (scripts/engagement.mjs, `prevClick`, ~1831), gated only on the unsubscribe-link list matching — a template id the previous snapshot saw clicked reads `tracked` with its first and last click months; (2) template names (`prevTemplates`, ~1914), the fallback when this pull returns no name for an id; (3) account names (`names`, ~1925), the fallback when this pull's name lookup does not resolve an account (`--no-account-names` still blanks every name). Reachable only where ids collide across tenants: ids are normally unique per tenant, but a sandbox copied from production can share them, and a consumer workspace may hold exactly that pair. Not measured live: whether this workspace's sandbox shares ids with its production tenant.
Repro: offline — reduce a run whose `whoami.host` differs from the previous snapshot's `meta.tenantHost`, with a template id present in both and clicked only in the previous one; `meta.metricAvailability.clicks.templates[<id>]` reads `tracked` with the previous tenant's click months. The same shape with a template or account the current pull leaves unnamed shows the previous tenant's name.
Expected: the class, as an invariant: nothing from a previous snapshot reaches a new one unless the refresh would carry it, so every read of the previous snapshot passes the same tenant check (and any other full-refresh reason that changes what the lookup means) that `decideRefresh` applies to the facts. A falsifiable test that enumerates nothing: reduce the fixture against a previous snapshot whose `meta.tenantHost` differs and assert the new snapshot equals the one reduced with no previous at all. No T-10 change.
