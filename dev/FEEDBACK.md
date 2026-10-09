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
dev/FEEDBACK-archive.md after each release (last move: 2026-10-07, after release 0.43.4, a hotfix cut from main — F-487; the 0.43.3 move took F-461 and F-466, leaving no live section; the 0.43.0 move took F-462, F-463, F-464, F-465, F-467 and F-468; the 0.42.0 move took F-448..F-460 with their round blocks and the four header Walk lines; the 0.37.0 move took
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


Under test: feat/jo-dash-s3b-health-batch · hb-20261007-03 · 2026-10-07
Blind spots (hb-20261007-03): S3b FIX ROUND, PR #43 (unmerged; merges after V2 on Bradley's go-ahead): no tenant pull was made with the new families (every read was a count, a schema read or a one-page sample on the maintainer's token); each health list is read true only by Bradley at V2 (Y6); the quiet-due-days default of 5 is his ruling, unmeasured against a tenant's cadence; --order-by on the participant object was not exercised (the samples read the refusal object only).
Walk (hb-20261007-02): 2026-10-07 (tester) — S3b verdict round, a RE-VERIFICATION of F-476, F-482, F-483 and F-484 and the V2 checks dev/VALIDATION.md section HLT-1 / DSH-1 / DSH-5 re-banked for the batch (Y1, Y2, Y6, Y13 to Y16), on the production tenant, reads only: six adapter runs (Y1's plan and run, the no-health pull, a one-program day-change run, the test-account pull, the categories pull resumed once after a token stop), two direct reads and two schema reads, all exit 0. F-476, F-482, F-483 VERIFIED; F-484 REOPENED (the participant-failure sample is the first page of a tenant-wide read and held no selected program); F-491 (normal: every silent alarm list reads false), F-492, F-493, F-494 (polish) logged. Y1, Y13 (the arms this tenant has), Y14, Y15, Y16 CLEARED; Y2 FAILED on its participant half; Y6 FAILED. Y4, Y5, Y7, Y8 not run (owed at V2 with Y9 to Y12). No SKILL.md changed, so no walk was owed. Guard-wiring: `gs-admin jo p pause --help` drew the guard's ask (both tenants named, production flagged; Bradley pasted the rendered text); Bradley declined. Detail in the tester comment below and in that VALIDATION section.
Walk (hb-20261004-04): 2026-10-05 (tester) — SHORT SPOT CHECK before the architecture review R1, on the production tenant, reads only: dev/VALIDATION.md section HLT-1 / DSH-1 / DSH-5, Y1 and Y3, and section DSH-2, Z0, Z1, Z2 and Z7 (feature items HLT-1 and DSH-2, no bus section carries them); every other Y and Z check stays at V2 and both sections stay OPEN. Z0 ruled by Bradley (all six choices; choice 2 is a deterministic command that R1 names); Y3 and Z2 CLEARED; Y1 FAILED (failed participants are order 10^6 rows and cannot be read as plain rows; the health pull ran 7.8x its estimated calls), Z1 FAILED on its second half (an on tab with nothing to draw), Z7 FAILED on size (an order-8 MB admin page; speed well inside). F-476 reopened; F-483 (polish), F-484 (normal), F-485 (polish) and F-486 (polish) logged. No SKILL.md changed and no skill was walked. Guard-wiring: `gs-admin jo p pause --help` drew the guard's ask (both tenants named, production flagged; Bradley confirmed the rendered text); Bradley declined. Detail in the tester comment below and in the two VALIDATION sections.
Walk (hb-20261004-03): 2026-10-04 (tester) — S2 re-verification round, F-479, F-480 and F-481 through dev/VALIDATION.md section ENG-3 / ENG-4, R1 to R3 only, on the production tenant, reads only: one walk of /gs-superadmin:email-engagement (invoked by the tester session; the skill is model-invocable) `report <picks> --by-template` with both internal domains and both unsubscribe links, every step as written: plan 8 calls / 43 s wall (estimate 35 calls / 327 s, under 8 minutes, so the pull ran in the foreground without an ask), pull 36 calls made and 7 reused, 269 s wall, exit 0, reconciled; report written; step 6 filled from the step-4 summary with nothing chosen. The prose made the walk stop or guess nowhere. R1, R2, R3 PASSED; F-479, F-480, F-481 VERIFIED; nothing logged; the section stays open (X2 to X9 owed at V2). Detail and blind spots in the tester comment below.
Walk (hb-20261003-05): 2026-10-03 (tester) — S1-V third re-run, a RE-VERIFICATION of F-473, F-474, F-475 and F-476 and of the checks dev/VALIDATION.md section ENG-2 re-banked for the third and fourth S1 fix batches (V1, V2, V3, V8, V11, V12 with its per-email half, V13 and V6, and the Delivered ruling), on the production tenant, reads only: all five runs completed (exit 0); every owed check passed; F-473..F-476 VERIFIED; F-477 logged and closed WONTFIX on Bradley's ruling (a null bounce flag, unreachable on the measured data); F-478 logged OPEN (normal) on Bradley's call: the cross-tenant carry the S1-fix round noticed, read from the code; VALIDATION section ENG-2 CLEARED; PR #36 ready to merge (the merge is Bradley's; an open normal finding gates the release, not this merge). No SKILL.md changed, so no walk was owed. Detail in the tester comment below and in VALIDATION section ENG-2.
Walk (hb-20261003-03): 2026-10-03 (tester) — S1-V second re-run, the first full verdict on ENG-1 and ENG-2 (feature items, no bus section carries them) and the re-verification of F-470, F-471 and F-472, against dev/VALIDATION.md section ENG-2 on the production tenant, reads only: all five runs completed (exit 0); F-470, F-471 and F-472 VERIFIED; V1 FAILED on F-473 and V11 on F-474, both logged with F-475 and F-476; Bradley ruled one metric definition (Delivered), a T-10 change for the builder before the merge; PR #36 stays unmerged. Detail in the tester comment below and in VALIDATION section ENG-2.
Walk (hb-20261003-02): 2026-10-03 (tester) — S1-V re-run, the verdict round for ENG-1 and ENG-2 (feature items, no bus section carries them) and F-470's re-verification, against dev/VALIDATION.md section ENG-2 on the production tenant, reads only: V0 confirmed by Bradley; run 1 (plan) ok; run 2 (full) ended partial, exit 4, so no snapshot was built; V8 FAILED, F-471 and F-472 logged; runs 3-5 not run, on Bradley's call; F-470 stays FIXED, V9 not measurable. Detail in the tester comment below and in VALIDATION section ENG-2.
Walk (hb-20261004-01): 2026-10-04 (tester) — S1b verdict round, a RE-VERIFICATION of F-478 (W0, offline: its repro through the real process and the stand-in CLI) and of dev/VALIDATION.md section ENG-2 / LTR-9 / F-478, W1 to W5 (feature items ENG-2 and LTR-9, no bus section carries them), on the production tenant, reads only: W0 passed on all three arms, F-478 VERIFIED; all six live plans and both runs completed (exit 0); every owed check passed; the accounts-off pull took 5.2 minutes against the plan's 327 s; nothing logged; VALIDATION section CLEARED; PR #37 ready to merge (the merge is Bradley's). No SKILL.md changed, so no walk was owed. Detail in the tester comment below and in that VALIDATION section.
Walk (hb-20261006-01): 2026-10-06 (tester) — F-487 acceptance round, dev/VALIDATION.md section F-487 P0 to P7, production tenant, reads only: /gs-superadmin:refresh typed by Bradley twice (first run documented every referenced Power List rule, order 10^2 describes, 0 failed; second run registered and described nothing); /gs-superadmin:deps-report and /gs-superadmin:email-report deps each invoked once by the tester. P0-P4 and P6 CLEARED, P5 and P7 FAILED; F-487 REOPENED (Power List object and field identities read from the payload's surface; no provenance cell for a matched dynamic program in email-report; the missing-doc caveat miscounts and names a remedy refresh skips). Setup Phase 5's Power List step not walked. Detail under F-487's verdict and in that VALIDATION section.
Walk (hb-20261006-02): 2026-10-06 (tester) — F-487 second verdict round (re-verification), dev/VALIDATION.md section F-487 P5, P7, P8 to P11, production tenant, reads only: /gs-superadmin:refresh typed by Bradley once (step 3b described nothing: every Power List doc readable); /gs-superadmin:email-report deps and /gs-superadmin:deps-report each invoked once by the tester; P10's three manifest states re-documented on a scratch copy of the KB (three describes). P5, P7, P9, P11 CLEARED; P8 and P10 FAILED; F-487 REOPENED a second time (system-name terms miss Gainsight objects because the registry reads the display-name bullet; dynamic-field rows bypass the registry; email-report omits a program matched only through an unreadable list, with no caveat). Rule 5: a Redesign: line before any third fix. Detail under F-487's verdict and in that VALIDATION section.
Walk (hb-20261006-03): 2026-10-06 (tester) — F-487 third verdict round (re-verification under the Redesign), dev/VALIDATION.md section F-487 P12 and P13 only, production tenant, reads only, no tenant call, refresh not run (no Power List doc changed): offline suites green at the stated counts; /gs-superadmin:deps-report and /gs-superadmin:email-report deps each invoked by the tester on a scratch copy of the KB (email-report's live sweep substituted by same-day pages; no live corroboration); no SKILL.md changed, so no walk was owed; no approval prompt rendered, per Bradley. P12 CLEARED (every data-management object a list, dynamic field or branch condition reads: identical sets, kinds and rows by `- id:`, GSID and label); P13 FAILED on the tenant-wide caveat (rule id and count, no program names, no not-evidence clause); F-487 REOPENED a third time — the valve, DEFERRED past 0.48.0, is Bradley's call. Amended the same day: Bradley ruled P13's tenant-wide names clause bar overreach (the Fix note claimed names on the JO surface only; round 2 accepted the aggregate text), so F-487 VERIFIED by ruling and the missing detail logged as F-488 (polish). Detail under F-487's verdict and in that VALIDATION section.
Walk (hb-20261007-03): 2026-10-08 (tester) — S3b FIX ROUND verdict @ hb-20261007-03 (V2), a RE-VERIFICATION of F-484, F-491, F-492, F-493, F-494, F-488, F-489, F-490 and dev/VALIDATION.md section HLT-1 / DSH-1 / DSH-5 Y2 (participant half), Y6, Y17, Y18 as re-banked, on the production tenant, reads only: the full health pull (207 calls with reuse, exit 0) and a three-program pull at --sample-programs 1 (exit 0), one live describe, one direct step-text read, five direct Y18 counts, one scratch-KB describe. F-488, F-489, F-490, F-493, F-494 VERIFIED; F-484 REOPENED a second time (sample picks ranked over the month window, read over the day window: empty picks counted as sampled; rule 5 and the born-this-release valve apply); F-491 REOPENED (the model after its Redesign: an ended job schedule read over the live participant sync, a two-valued expected flag over the three kinds Bradley ruled in session, a quarterly intake read as silence); F-492 REOPENED (the widened mask takes product text: 11 of 30 accepted wordings uncapturable; Bradley open to hosts unmasked). Y17, Y18 CLEARED; Y2 participant half and Y6 FAILED. Changed skill prose walked: refresh step 3b executed step by step on a scratch KB whose manifest lacks the rules describe command (the --command fallback documented the rule); setup's Power List pointer read (both skills slash-only, neither run end to end). Guard-wiring: `gs-admin jo p pause --help` drew the guard's ask (both tenants named, production flagged; Bradley pasted the rendered text); Bradley declined. Detail in the tester comment below and in that VALIDATION section.

<!-- tester 2026-10-08 (S3b FIX ROUND verdict @ hb-20261007-03, V2 — F-488, F-489, F-490, F-493, F-494 VERIFIED; F-484 REOPENED (second), F-491 REOPENED (the model, after its Redesign), F-492 REOPENED; Y17, Y18 CLEARED; Y2 (participant half) and Y6 FAILED; PR #43 stays unmerged; next free F-495):
     Under test: feat/jo-dash-s3b-health-batch, clean and level with origin at 244b0dc; the gs-superadmin:dev-canary skill read
       hb-20261007-03 in session, matching the Under test line; plugin loaded from the working tree (the workspace's plugin link
       resolves to it).
     Tenant: production, `gs-admin whoami` confirmed the host before the first call; reads only, one gs-admin call at a time (each
       pull one sequential process, nothing beside it); one re-login by Bradley when the token expired between calls (no call
       reached the tenant on the expired token).
     Round type: RE-VERIFICATION of the eight FIXED findings by their Judge lines plus VALIDATION Y2 (participant half), Y6, Y17,
       Y18 as re-banked at this token; pass bars written down before the first call. Calls: the full health pull, plan 16 and run
       191 made + 16 reused against an estimate of 196, exit 0, nothing failed, every health part read; a three-program pull at
       --sample-programs 1, plan 15 and run 141 + 16 reused, exit 0; one live `jo p describe` (Y6, on Bradley's request to check
       the KB live); one direct `rp run` of one program's uncategorised step text; Y18's five direct counts (the tenant-wide total
       timed out server-side once; scoped to the selected programs as the adapter scopes it, all five answered); F-489's one
       describe on a scratch KB; one declined guard probe.
     Results (detail under each section and in VALIDATION section HLT-1 / DSH-1 / DSH-5):
       F-484 REOPENED, second reopen: every sample call names one program and the cap names the rest, but the picks are ranked
         over the month window and read over the day window — 10 of 25 participant picks and 17 of 25 bounce picks returned 0 rows,
         were counted as sampled, and named nowhere. Rule 5 and the born-this-release valve now apply (the builder's and Bradley's
         call).
       F-491 REOPENED (first since its Redesign: the model): admitting-nobody, finished, ok, and one of two no-recent-sends read
         true to Bradley; schedule-ended reads false for 15 of 35 (the reader picks an ended job schedule over the live participant
         sync), step-errors false for 6 of 6 (a two-valued expected flag over Bradley's three kinds: business rule, bad-address
         error, program error — ruled in session), and a quarterly-intake program reads no-recent-sends.
       F-492 REOPENED: nothing the bar named survives, but the widened mask takes product text — 11 of the 30 accepted bounce
         wordings can no longer be captured from a sample (host rule 7, token class 4). Bradley is open to hosts unmasked so long as
         nothing reaches the public repo, and asked that the builder be shown the impact (recorded in the section).
       F-493, F-494, F-488, F-489, F-490 VERIFIED (F-494 on a patched copy of a real KB shape; F-488 over the previous day's list
         pages; F-489 with refresh step 3b executed on a scratch KB, the round's walk of the changed prose).
       VALIDATION: Y17 CLEARED (5 of 5 to the time; the field is the run's finish, per Bradley); Y18 CLEARED (95 of 95 cells; the
         platform-error month matches an outage Bradley knows); Y2's participant half FAILED (F-484); Y6 FAILED (F-491).
     Blind spots: F-494 has no natural instance in the selection (a patched copy of the real shape); F-488's index read the previous
       day's program-list pages, not a fresh sweep; Y17's overdue arm has no instance (ingest-overdue 0); the 10-per-rule cap of
       F-488 is unexercised; neither changed skill was run end to end (both slash-only; the changed steps were executed); the
       approval prompt is invisible to the tester: its text was pasted back by Bradley.
     Guard-wiring: `gs-admin jo p pause --help` drew the guard's ask ("Mutating Gainsight command: gs-admin journey programs pause …",
       both tenants named, production flagged; Bradley pasted the rendered text); Bradley declined it.
     Workspace (tenant data, never in the repo): snapshots <slug>/reports-adhoc/v3-health.json and v3-cap1.json with their health
       reads; run directories v3-health and v3-cap1; the live describe, the step-text read and Y18's counts in the workspace's tmp
       folder; the scratch KB in the session scratchpad; the round notes beside them.
     PR #43 stays unmerged: open normal findings (F-484, F-491) gate the release, not this merge; the merge is Bradley's. -->

<!-- builder 2026-10-07 (S3b FIX ROUND HANDED OFF — UNMERGED, riding the same branch; verdict at V2):
Branch feat/jo-dash-s3b-health-batch → PR #43 to dev (open, unmerged; merges on green CI plus its review round after V2). Token: hb-20261007-03.
F-484 (reopened once) FIXED, F-491 FIXED with a Redesign: line (the cadence rules and the live describe reads replaced by signals from the program's own data — Bradley's four conditions, ruled in session 2026-10-07 and recorded under HLT-1 in the plan), F-492, F-493, F-494 FIXED; the polish batch F-488, F-489, F-490 FIXED (named at kickoff). Each with Fix:, Judge:, a Sibling sweep line; F-484 and F-491 carry the mutation copy-out (8 of 8 as predicted, predictions written first). F-486 (polish) is carried to S4b, as its Expected says. Not touched: F-485 (FIXED, S4a's).
Ordering: the redesign of F-491 was taken BEFORE the second fix of F-484 was written, since the per-program samples read the counts the redesign introduces (entry-month); nothing pending re-arranges what V2 verifies.
Measured before building (production, reads only, one call at a time, on Bradley's token; shapes in dev/S3B-FIX-ROUND-BRIEF.md, nothing tenant-specific in the repo): the sources object's heartbeat on every Active program, the dead schedule run-state fields, the participant object's timestamps and filterable step-failure reason, the refusal object's moving ModifiedAt and working IN + date + order-by, the eight refusal wordings (seven expected), CONTAINS case-insensitive.
Verified offline: suites engagement 313 (the signals fixture), query 112, contract 284, page 103, report 52, groups 39, jo-report, audit-active, tenant-deps green; reader-shape trace green and data/reader-shapes.json regenerated (19 commands, 867 keys); typecheck clean; check-stale-facts and check-doc-drift green. The additive tables (sources, admissions, entryFailures, stepFailures, entrySamples) moved typedef, pin and goldens together; schemaVersion stays 1.
Banked: dev/VALIDATION.md § HLT-1 / DSH-1 / DSH-5 re-banked for V2 (Y2's participant half, Y6 replaced by the signals; Y17 heartbeat vs UI, Y18 step categories new), keyed to this token. Reload: /reload-plugins (scripts and skills only; no hook changed).
Blind spots: no tenant pull was made with the new families (every read was a count, a schema read or a one-page sample on the maintainer's token); each health list is read true only by Bradley at V2 (Y6); the quiet-due-days default of 5 is his ruling, unmeasured against a tenant's cadence; --order-by on the participant object was not exercised (the samples read the refusal object only). Next free F-495.
Mint: `dev-utils handoff` (0.5.1) REFUSED the same-day token on 2026-10-07 — the 0.43.4 housekeeping block names hb-20261007-01, a token minted BY HAND on dev that day (no handoff commit carries it), so to the loop it is a stale draft. Bradley RULED (2026-10-07, in session) to mint by hand today rather than wait: hb-20261007-03 is written to the Under test line, its Blind spots line, the canary and this block in ONE commit with the loop's subject (`handoff hb-20261007-03 (feat/jo-dash-s3b-health-batch)`), so the loop's reader finds its provenance in the commit log. The -01 record stands unchanged.
-->

<!-- tester 2026-10-07 (S3b verdict round @ hb-20261007-02 — F-476, F-482, F-483 VERIFIED; F-484 REOPENED; F-491..F-494 logged; Y1, Y13, Y14, Y15, Y16 CLEARED; Y2 and Y6 FAILED; PR #43 stays unmerged; next free F-495):
     Under test: feat/jo-dash-s3b-health-batch, clean and level with origin at 1f85444; the gs-superadmin:dev-canary skill
       read hb-20261007-02 in session, matching the Under test line; plugin loaded from the working tree (the workspace's
       plugin link resolves to it). CI on 1f85444 before the round, per job: GitGuardian pass; validate-plugin 37697004142
       changes, manifests, validate (ubuntu-latest) success; docs-drift 37697004198 drift (full) success.
     Tenant: production, `gs-admin whoami` confirmed the host before the first call (R11); reads only, one gs-admin call
       at a time (each pull one sequential process, nothing else run beside it); one re-login by Bradley after the
       categories pull stopped on the token (exit 3) and resumed with the same command.
     Round type: RE-VERIFICATION of the four findings by their Judge lines, plus the V2 checks the re-bank named; pass
       bars written down before the first call. Calls: Y1 plan 14 and run 71; the no-health pull 45; a one-program
       day-change run 10 + 36 and one refused resume (no call); the test-account pull 92; the categories pull 43 + 132;
       two direct program x day reads (the first sent a malformed filter shape and came back unfiltered: the tester's
       spelling, the known silent-drop class, re-run correctly); two `rp schema` reads; one declined guard probe.
     Results (detail under each section and in VALIDATION section HLT-1 / DSH-1 / DSH-5):
       F-476 VERIFIED: health 36 calls against 40 (0.90x, was 7.8x); the run 71 / 556 s against 75 / 546 s.
       F-482 VERIFIED: one stamp in meta, run.json, every row, live schedule rows and the report line, between the
         plan's end and the first fact call; the plan alone stamped nothing.
       F-483 VERIFIED: the day-change resume ran with no --today and kept the plan's day; a deliberate --today was
         refused naming "today moved". Made by setting the plan's day with a flag; no real midnight was crossed.
       F-484 REOPENED (first reopen): Y1's part, the sum check, the masking and the bounce capture all pass; the
         participant-failure sample is the first page of a TENANT-WIDE read, held one program outside the selection,
         and gave Y2 nothing to read or capture; the bounce sample covers about a third of the programs with bounces.
       F-491 normal: the silent alarm lists read false to Bradley — "Schedule run failed" from a default (no run result
         is recorded on any live-read schedule), ended schedules read failed, daily ingest crons read as send cadence,
         finished one-off campaigns read "No recent sends".
       F-492 polish (mask gaps in the terminal-only samples), F-493 polish (the provisional line names one month;
         the previous month's flags moved between pulls), F-494 polish (a CRON-type schedule with no cron reads not
         recurring).
       VALIDATION: Y1, Y14, Y15, Y16 CLEARED; Y13 CLEARED for the arms this tenant can exercise (its longest period
         is monthly, which Bradley confirmed is the least frequent; nothing lies beyond the window); Y2 FAILED on the
         participant half (F-484); Y6 FAILED (F-491). Y4, Y5, Y7, Y8 not run this round: owed at V2 with Y9 to Y12.
     Blind spots: no real midnight was crossed (F-483 by the flag-set day); Y13's beyond-window arm has no instance on
       this tenant; Y15's "external recipients fell by those accounts' people and no further" is bounded by the sends
       that moved and the per-program totals, not by a direct distinct count of the accounts' people; the "Possible
       silent failure" list was judged on the settled picks and Bradley's two-program read, not read by him row by
       row; the One-time, no-sends-in-window and cannot-judge lists were empty (nothing to read); whether the server's
       CONTAINS is case-sensitive is unmeasured (the capture was checked overlap-free both ways offline, and no
       overlap caveat fired); the approval prompt is invisible to the tester: its text was pasted back by Bradley.
     Guard-wiring: `gs-admin jo p pause --help` drew the guard's ask ("Mutating Gainsight command: gs-admin journey
       programs pause …", both tenants named, production flagged); Bradley declined it.
     Workspace (tenant data, never in the repo), kept for V2: snapshots <slug>/reports-adhoc/v2-health.json,
       v2-nohealth.json, v2-midnight.json, v2-test.json, v2-cats.json; run directories v2-health, v2-nohealth,
       v2-midnight, v2-test, v2-cats; the scratch spec <slug>/dashboards/v2-y14-recurring; the captured categories
       file and the round notes in the workspace's tmp folder; the test-account ids in the workspace picks file.
     PR #43 stays unmerged: an OPEN normal finding gates the release, not this merge; the merge is Bradley's. -->

<!-- builder 2026-10-07 (S3b health batch HANDED OFF — UNMERGED, riding a branch; verdict at V2):
Branch feat/jo-dash-s3b-health-batch → PR #43 to dev (open, unmerged; merges on green CI plus its review round; the branch's bus at 1f85444). Token: hb-20261007-02.
F-476 (reopened) FIXED, F-482 FIXED, F-483 FIXED, F-484 FIXED — on the branch, each with Fix:, Judge:, a mutation copy-out and a Sibling sweep line (AGENTS review-gate rules). Not touched: F-485 (FIXED, S4a's); F-486, F-488, F-489, F-490 (OPEN polish) are carried to the next round, as they were in this round's scope at kickoff.
What the branch carries (HLT-1 R1 rulings 1-3 and the 2026-10-04 rulings 3-4; ENG-2 items 1-5; DSH-5): failure reasons counted server-side by category with the ruled additive row shape (the shipped list empty until V2 captures the wordings; a tenant's own list and expected reasons as inputs); count-first sizing and a row budget (too-large); the pull time stamped at the first fact call and a run that resumes across midnight; the cadence-aware silent rules with a built-in cron day calculator and a capped live read of flagged programs' last-run result; the derived-lookback report; the schedule on every pull with a KB (the grouping resolver reads it there); step names as-of; test accounts excluded server-side; every all-time figure with a renderable reason. Plugin 0.47.0 (unreleased): the batch is folded into its CHANGELOG entry.
Two gating reads were made at kickoff on Bradley's offered live token (reads only, through the spike's catalog-checked runner; nothing tenant-specific written): the failed-participant reason field takes NO filter (CONTAINS, DOES_NOT_CONTAINS and STARTS_WITH refused; its schema says filterable false), so that part is the ruled per-program fallback; CONTAINS works on the bounce reason in the grouped shape; NOT_IN on the company lookup keeps the no-company rows. Bradley's standing instruction from the session: operators are measured on the object and field they are used on, never carried over.
Verified offline: suites engagement 305, query 112, groups 38, contract 281, page 103, report 52, spec 31 green; reader-shape trace green and data/reader-shapes.json regenerated; sweep 18 of 18 as predicted (16 killed, 2 predicted survivors), predictions written first; /code-review medium medium effort: two defects found and fixed with a check each (the bounce count-first read was skipped with health off, so the cost of adding health was priced from sends; a categories file with a misspelled key was accepted and counted nothing), one named and left (a tenant-wide failed-participant total cannot split past a page of programs), one no-change; local battery 47 of 48 steps green; the red is the known tsc error in the git-ignored handoffs/jo-dashboards/tools/run.mjs; npm run build reproduces committed output (date stamps only); typecheck clean but for the known git-ignored file.
Banked: dev/VALIDATION.md § HLT-1 / DSH-1 / DSH-5, re-banked for V2 (Y1, Y2, Y6 replaced; Y13-Y16 new), keyed to hb-20261007-02.
Blind spots: no tenant pull was made with the new families (the two reads were counts and schema reads); the category wordings are unmeasured until Y2; DOES_NOT_CONTAINS on a null bounce reason is unmeasured (nothing depends on it); the describe payload's schedule start/end dates are V2's read. Next free F-491.
-->

<!-- tester 2026-10-08 (S3b — POINTER RE-STAMPED after the fix-round verdict @ hb-20261007-03 (V2): F-488, F-489, F-490, F-493, F-494 VERIFIED; F-484 REOPENED (second), F-491 REOPENED (the model, after its Redesign), F-492 REOPENED; PR #43 stays unmerged; next free F-495):
     Branch: feat/jo-dash-s3b-health-batch at 4877abf (8214c50 the verdict commit; 4877abf dev merged in, clean). PR: #43 to dev,
       open, unmerged, MERGEABLE CLEAN.
     Status transitions riding the branch (re-stamps the builder pointer below, which says all eight FIXED):
       F-488, F-489, F-490, F-493, F-494 FIXED -> VERIFIED. F-484 FIXED -> OPEN (REOPENED, second reopen: the sample picks are
       ranked over the month window and read over the day window, so empty picks count as sampled and go unnamed; rule 5 and
       the born-this-release valve apply). F-491 FIXED -> OPEN (REOPENED, the model after its Redesign: an ended job schedule
       read over the live participant sync; a two-valued expected flag over the three kinds Bradley ruled in session; a
       quarterly intake read as silence). F-492 FIXED -> OPEN (REOPENED: the widened mask takes product text, 11 of 30 accepted
       wordings uncapturable; Bradley open to hosts unmasked). Nothing new logged; next free F-495.
     VALIDATION section HLT-1 / DSH-1 / DSH-5 (on the branch): Y17, Y18 CLEARED; Y2 (participant half) FAILED; Y6 FAILED.
     CI on the final head 4877abf, QUOTED per job after completion:
         validate-plugin 37864127361: changes success / manifests success / validate (ubuntu-latest) success
         docs-drift 37864127407: drift (full) success
         GitGuardian Security Checks: pass
     Open PRs to dev: #43 only. Open normal findings (F-484, F-491) gate the release, not this merge; the merge is Bradley's.
       Detail: the tester comment and the Walk (hb-20261007-03) line on the branch's bus. -->

<!-- builder 2026-10-07 (S3b — POINTER RE-STAMPED after the FIX ROUND: F-484 (second fix after one reopen), F-491 (REDESIGN — the cadence rules replaced by health signals from the program's own data, Bradley's four conditions ruled in session), F-492, F-493, F-494 FIXED on the branch; the polish batch F-488, F-489, F-490 FIXED there too; F-486 carried to S4b; PR #43 stays unmerged; next free F-495):
     Branch: feat/jo-dash-s3b-health-batch at 244b0dc → PR #43 to dev (open, unmerged; merges after V2 on Bradley's go-ahead; the tip is a
       content commit, so the PR suite runs on the head). The branch's bus carries every Fix:, Judge: and Sibling sweep line, the F-491
       Redesign: line, the two mutation copy-outs (8 of 8 as predicted, predictions written first) and the fix round's handoff block.
     Token: hb-20261007-03, minted BY HAND on Bradley's ruling (2026-10-07) after dev-utils refused the same-day mint (the 0.43.4
       block names the hand-minted hb-20261007-01); written in one commit with the loop's subject, 244b0dc on the branch. The branch's
       Under test line, Blind spots line and canary read hb-20261007-03. V2 runs on it.
     Rulings of record: the plan (handoffs/jo-dashboards/JO-DASHBOARDS-HANDOFF-PLAN.md) under HLT-1, "Rulings (Bradley, 2026-10-07)";
       the measurements as shapes in dev/S3B-FIX-ROUND-BRIEF.md (on the branch). VALIDATION § HLT-1 re-banked for V2 there (Y2, Y6, Y17, Y18). -->

<!-- tester 2026-10-07 (S3b — POINTER RE-STAMPED after the verdict round @ hb-20261007-02: F-476, F-482, F-483 VERIFIED; F-484 REOPENED; F-491, F-492, F-493, F-494 claimed and OPEN on the branch; PR #43 stays unmerged; next free F-495):
     Branch: feat/jo-dash-s3b-health-batch at 1d9bf6c (c4ec39d the verdict commit; 1d9bf6c dev merged in, the bus
       conflict resolved keeping both sides). PR: #43 to dev, open, unmerged, MERGEABLE CLEAN.
     Status transitions riding the branch (re-stamps the builder pointer above, which says all four FIXED):
       F-476 FIXED -> VERIFIED; F-482 FIXED -> VERIFIED; F-483 FIXED -> VERIFIED; F-484 FIXED -> OPEN (REOPENED,
       first reopen: the participant-failure sample is the first page of a tenant-wide read and held no selected
       program). New, claimed here at logging time: F-491 OPEN (normal: the cadence-aware silent lists read false),
       F-492 OPEN (polish), F-493 OPEN (polish), F-494 OPEN (polish). Next free F-495.
     VALIDATION section HLT-1 / DSH-1 / DSH-5 (on the branch): Y1, Y13 (the arms this tenant has), Y14, Y15, Y16
       CLEARED; Y2 FAILED on its participant half; Y6 FAILED; Y4, Y5, Y7, Y8 and Y9 to Y12 still owed at V2.
     CI on the final head 1d9bf6c, QUOTED per job after completion:
         validate-plugin 37707903994: changes success / manifests success / validate (ubuntu-latest) success
         docs-drift 37707903993: drift (full) success
         GitGuardian Security Checks: pass
     Open PRs to dev: #43 only. An OPEN normal finding (F-484, F-491) gates the release, not this merge; the merge
       is Bradley's. Detail: the tester comment and the Walk (hb-20261007-02) line on the branch's bus. -->

<!-- builder 2026-10-07 ([v]0.43.4 RELEASED — post-release housekeeping; a HOTFIX cut from main, not a release of dev):
     Payload: dependency answers now see Power List programs (F-487) — both deps surfaces resolve a QUERY_BUILDER source to the objects, connection and output fields its rule's tasks read; existing workspaces run /gs-superadmin:refresh once. Staged versions folded in: none (0.44.0–0.47.0, the dashboards work, stay staged on dev).
     Gate 1 (bus): scoped to the PAYLOAD — F-487 VERIFIED @ hb-20261006-03 (Bradley's ruling on P13); F-488 and F-489 OPEN polish on it by decision, riding the dashboards round. Step 0 ran on the payload only: nothing DEFERRED to re-open; the OPEN dashboards sections (F-476, F-484 normal; F-482, F-483, F-486 polish) are not in this release and were NOT auto-deferred (that would spend their one free pass on a release they are not in). Open PRs to dev: none (#41 merged, a5d8a0b).
     Gate 2 (review): /code-review medium over origin/dev...feat/f487-power-list-sources (the payload, on the source branch before its dev merge; #41 had no review round of its own) — 1 finding, low → F-489 (polish, not taken); /security-review — run, no findings; highest severity none. /code-review low over the conflict resolutions on the release branch — none.
     Cut: release/[v]0.43.4 from MAIN @ 5353b7f (not dev), FOUR commits beyond: the three F-487 code commits cherry-picked (1a2a910 ← c32da73, e26c6e3 ← 28ab1e3, 547af75 ← 663c035) and the release commit 4fce25b (version, the 0.43.4 retitles, reader-shapes regenerated on that tree: 16 commands, 720 keys); no strip commit (dev/ dropped from the picks, no dev-canary on the tree); release tree: both strict validates PASS; battery verbatim 43/45 — the two reds local-only (tsc over a git-ignored handoffs/ file; the no-dev-content step seeing an empty untracked dev/ directory on disk, since removed), absent from a clean checkout.
     CI on the release PR #42, QUOTED per job after completion:
         validate-plugin 37655735664: changes success / manifests success / validate (ubuntu-latest) success / validate (windows-latest) success / validate (macos-latest) success
         docs-drift 37655735894: drift (full) success
         pr-target-guard 37655736197: guard success
       (dev after the #41 merge, a5d8a0b: validate-plugin 37653856491 changes / manifests / validate (ubuntu-latest) success; docs-drift 37653856433 drift (full) success.)
     Merged by Bradley (main @ 736abda); tag [v]0.43.4 pushed; release branch deleted local+remote (GitHub removed the remote one at merge); checkout back on dev.
     Housekeeping: F-487 moved VERBATIM to the archive (live 21 → 20, archive 21 → 22, sum 42; block sha256 ef1d2acb5ed123aa8cb61bb5c6d9ced5db356dc276e6b1d283416fa26052f379); entry hint updated; Under test + canary → dev · hb-20261007-01. Next free number F-490. Released: 0.43.4; dev stages 0.44.0–0.47.0 (the consistency commit: plugin.json back to 0.47.0; the 0.43.4 entry sits below 0.44.0, retitled "(hotfix, released from main)"; the three "before 0.48.0" sentences → 0.43.4). dev/VALIDATION.md section F-487 heading marked CLEARED. Ledgers: one line in the JO-dashboards handoff plan's session ledger; no project-memory chronicle file exists in handoffs/ or the memory dir (recorded as none found).
     Now live from main: nothing (no .github change shipped).
     GitHub Release: https://github.com/BradleyDB/gs-admin-cli-docs/releases/tag/v0.43.4 (notes = the CHANGELOG entries since the previous tag — the 0.43.4 entry alone, behind .github/release-intro.md).
     Consumer refresh: claude plugin marketplace update gs-admin-cli-docs; claude plugin update gs-superadmin@gs-admin-cli-docs.
     Carried forward (not in this release): the JO-dashboards work 0.44.0–0.47.0 (R12: one release) with F-476 and F-484 (normal) open; polish F-482, F-483, F-486, F-488, F-489. The next dev→main release carries the three F-487 commits again (identical hunks; the CHANGELOG/version hunks are the ones to resolve). Procedure: the maintainer's hotfix plan; its "Hotfix from main" section is drafted into dev/RELEASE-CHECKLIST.md next (the GitHub Release and the § 6 housekeeping are explicit steps there — both were missing from the plan's first draft). -->
<!-- builder 2026-10-07 (F-487 CLOSED OUT on dev — PR #41 merged (a5d8a0b) after the third verdict (VERIFIED by Bradley's ruling @ hb-20261006-03) and the release-gate review; F-488 and F-489 OPEN polish, folded into the dashboards round; next free F-490):
     PR #41 (feat/f487-power-list-sources) was merged to dev on Bradley's go-ahead, on green CI plus its review round.
       Branch tip at merge: f7a65ef (c32da73 first batch, 28ab1e3 second batch, 663c035 third batch under the Redesign — the three CODE commits;
       the handoffs -01/-02/-03, the three verdicts, fcb16c8 the ruling, 9bdc02e the F-489 log, f7a65ef an empty non-skip commit that re-fired the
       PR suite after GitHub's 2026-10-07 outage dropped the pull_request events for 9bdc02e). CI on f7a65ef read per job: validate-plugin
       37648886984 changes, manifests and validate (ubuntu-latest) success; docs-drift 37648886924 drift (full) success; GitGuardian pass.
       The dev push runs on a5d8a0b (validate-plugin 37653856491, docs-drift 37653856433) were in progress at this stamp; their per-job
       conclusions are quoted in the 0.43.4 close-out note (F-340), never assumed here.
     Release-gate review (dev/RELEASE-CHECKLIST.md section 2, run on the SOURCE branch at fcb16c8 before the merge, since the payload ships
       as a hotfix cut from main, not a release of dev): /code-review medium over origin/dev...feat/f487-power-list-sources — 1 finding, low,
       logged as F-489 (polish; Bradley: not taken in the hotfix); /security-review over the same diff — no findings, highest severity none
       (filenames pass docBaseName, shell hints pass sq, the describe is spawned as an argv array). MEDIUM, not LOW, because #41 had no review
       round of its own before this one (PRs #38-#40 each had one).
     Status transitions: F-487 OPEN -> FIXED -> REOPENED @ -01 -> FIXED -> REOPENED @ -02 -> Redesign: + FIXED -> REOPENED @ -03 (P13) ->
       VERIFIED by Bradley's ruling 2026-10-06 (P13's tenant-wide clause ruled bar overreach; the measurements stand). Numbers consumed:
       F-488 (tester, polish — the tenant-wide caveat's program names), F-489 (builder, polish — refresh 3b-3's --command fallback).
       Live checks: dev/VALIDATION.md section F-487 — P0 to P13 CLEARED or ruled; nothing re-banked.
     Ships as HOTFIX 0.43.4 cut from main (Bradley, 2026-10-06): dev carries the UNRELEASED JO-dashboards work (0.44.0-0.47.0) which R12
       holds to ONE release with F-476 and F-484 open against it, so the three code commits above are cherry-picked onto release/v0.43.4
       from main; the version on dev stays the dashboards' staged 0.47.0 after a dev-side consistency commit (CHANGELOG entry retitled 0.43.4
       and moved below 0.44.0). Procedure: the maintainer's hotfix plan; its "Hotfix from main" section is drafted into RELEASE-CHECKLIST after.
     Polish carried, untouched (scheduled elsewhere): F-482, F-483, F-486 (S3b/S4b); normal F-476, F-484 (S3b); F-488, F-489 ride the
       dashboards round (Bradley, 2026-10-07).
     Dashboards work not touched: engagement*.mjs, dashboard-*.mjs, the email-engagement skill. -->
<!-- builder 2026-10-05 (JO-dashboards S4a CLOSED OUT — PR #40 merged (1eb993c) after R1; F-485 FIXED (verdict at V2); F-476, F-483, F-484 ride S3b with F-482, F-486 rides S4b; next free F-487):
     R1, the design review as something people use, ran today with Bradley in the session (no code, no PR, no tenant).
       Every finding was ruled; none asked for a change to PR #40's code, and none removes or re-types a T-10 or T-11
       field (F-484's categories are additive as ruled). The rulings live in the maintainer's plan under the items
       they govern; the S3b prompt was written and S4b and S5 regenerated there. Order from here: S3b, then S4b.
     PR #40 (feat/jo-dash-s4a-runtime) was merged to dev on Bradley's go-ahead, on green CI plus its review round.
       dev was first merged into the branch (79b9e27: the bus kept both sides, this pointer and the tester's spot-check
       block), and CI on 79b9e27 read per job: validate-plugin 37411566333 changes, manifests and validate (ubuntu-latest)
       pass; docs-drift 37411566246 drift (full) pass; GitGuardian pass. Its verdict is V2: dev/VALIDATION.md section
       DSH-2, Z0 to Z10, stays OPEN (Z0 ruled; Z2 CLEARED; Z1 and Z7 FAILED at the spot check, both carried by the
       findings below), keyed to hb-20261004-04.
     Contracts: nothing new frozen. The page runtime (DSH-2) is on dev for S3b and S4b to build on.
     Statuses: F-485 FIXED (polish; rides V2's one verdict). F-476 OPEN (reopened), F-482 OPEN, F-483 OPEN, F-484 OPEN:
       all four ride S3b, the health batch, whose prompt names them. F-486 OPEN rides S4b.
     Branch deleted, local and remote. Plugin 0.47.0 on dev, unreleased (one release for the whole program).
     CI on the merged tip 1eb993c: the push-triggered validate-plugin 37412212792 was cancelled (changes and manifests
       pass, validate cancelled), superseded by the dispatch 37412260347, which was in progress (changes and manifests
       pass, validate running) with docs-drift 37412212771 drift (full) running when this was written; a red one is a
       finding for the next session's kickoff, which reads the open PRs and the dev log.
     Open PRs to dev: none. Issues #11 and #12 unchanged. -->

<!-- builder 2026-10-05 (JO-dashboards S4a — POINTER re-stamped after processing the spot check's feedback; F-485 FIXED on the branch; F-476, F-483, F-484 scheduled for S3b and F-486 for S4b; next free F-487):
     Branch: feat/jo-dash-s4a-runtime at b9ed9fd. PR: #40 to dev, open, unmerged, HELD FOR R1 (CI on the head b9ed9fd, per job: validate-plugin changes, manifests and validate (ubuntu-latest) success; docs-drift drift (full) success — runs: validate-plugin 37398964876;docs-drift 37398964887).
     F-485 (polish) FIXED on the branch, with a check red with the fix reverted: the size report walks every embedded table (the health five included) and the warning names the largest tables and the remedy that follows from them. Verdict at V2 (polish rides the round's one verdict).
     Not taken, by design, before the architecture review: F-476 (reopened) and F-483 ride S3b with F-482 (the health families the estimate would price are the ones S3b replaces; the run clock is one mechanism); F-484 (normal) rides S3b as its Expected says, and raises two questions for R1 first: whether a category changes what a health message row means (T-10), and whether a page embeds health message tables at all or only their aggregates (the order-8 MB page of Z7); F-486 (polish) rides S4b, which decides what every tab shows. Each carries a dated Builder note on the branch.
     Open PRs to dev: #40 only. F-482 (polish) still OPEN, rides S3b. -->

<!-- tester 2026-10-05 (JO-dashboards SHORT SPOT CHECK @ hb-20261004-04 before R1 — Z0 RULED; Y3, Z2 CLEARED; Y1, Z1, Z7 FAILED; F-476 REOPENED; F-483..F-486 logged; PR #40 stays unmerged, held for R1; next free F-487):
     Under test: feat/jo-dash-s4a-runtime, clean and level with origin at ffdf08a; the gs-superadmin:dev-canary skill
       read hb-20261004-04 in session, matching the Under test line; plugin loaded from the working tree. CI on
       ffdf08a before the round, per job: GitGuardian pass; validate-plugin 37259978580 changes, manifests, validate
       (ubuntu-latest) pass; docs-drift 37259978568 drift (full) pass.
     Tenant: production, confirmed by Bradley after `gs-admin whoami`; reads only (R11), one call at a time. Scope as
       Bradley set it: VALIDATION section HLT-1 / DSH-1 / DSH-5, Y1 and Y3; section DSH-2, Z0, Z1, Z2 and Z7. Every
       other Y and Z check stays at V2, and both sections stay OPEN.
     Calls: the plan (11), two server-side counts and one five-row read through the spike's catalog-checked runner,
       the pull (226 made, 9 reused), and one declined guard probe. Z0, Z1, Z2 and Z7 made no gs-admin call.
     Results (detail in the two VALIDATION sections):
       Z0 ruled by Bradley, one question each; nothing changes what a page embeds, so nothing is owed before a page
         is built. Choice 2, the line to copy, is ruled a deterministic command that R1 names; the rest confirmed.
       Y1 FAILED: order 10^6 failed-participant rows, one program holding 89%, 9 programs over a page; the pull
         exit 0 and reconciled, the participant-failures part not read; health 187 calls / 1400 s against 24 / 204 s.
       Y3 CLEARED for the shape: plain text in `{v, fv}`, one sentence per cell.
       Z1 FAILED on its second half: the Health tab is a bare heading with the default panels (the notice mechanism
         holds once a panel lists the figure, checked offline). Z2 CLEARED (equal data; 5 of 5 programs equal).
       Z7 FAILED on size: the admin page with health is order 8 MB; it opens in about 0.15 s and redraws a status
         change in under 30 ms in a real browser engine.
     Findings: F-476 REOPENED (the estimate does not price the health families' splits; first reopen); F-483 polish
       (a plan before midnight cannot be run after it); F-484 normal (health failure text kept at the text's grain:
       participant failures unreadable, bounce reasons barely grouped, the page over budget; S3b's ruled categories are
       the remedy); F-485 polish (the size report omits the health tables; the warning names the wrong switch);
       F-486 polish (an on tab with nothing to draw is a bare pane). F-485 and F-486 are S4a's, for the builder on
       this branch; F-476, F-483 and F-484 are on merged code (ENG-2, HLT-1) and natural for S3b.
     Blind spots: Y3 saw five rows, none holding several reasons. Z7 ran in headless Chrome over the DevTools protocol
       on this machine, pages served on localhost, two runs each; no desktop browser was driven by hand, and the
       redraw was timed, not felt. The plan without `--health` was not re-run (arithmetic only). Z1 ran over a minimal
       saved spec with no group rules (Y9/Y10 not run), so its `ungrouped` line had nothing to match. Z2's five
       programs came from Bradley's settled picks, not a fresh choice. The approval prompt is invisible to the tester:
       its text was pasted back by Bradley, so it is measured by him. The masking (Y2) was not judged, only the
       distinct-message ratio recorded under F-484.
     Guard-wiring: `gs-admin jo p pause --help` drew the guard's ask ("Mutating Gainsight command: gs-admin journey
       programs pause …", both tenants named, production flagged); Bradley declined it.
     Workspace (tenant data, never in the repo): the snapshot at <slug>/reports-adhoc/spot-health.json, the run
       directory spot-health, the spot spec and its two page folders under <slug>/dashboards/spot/.
     PR #40 stays unmerged: it is held for R1, not for this round. -->

<!-- builder 2026-10-04 (JO-dashboards S4a — POINTER: plan item DSH-2 rides an UNMERGED branch; no finding logged; NO handoff token was minted; next free F-483):
     Branch: feat/jo-dash-s4a-runtime at 1275ba0. PR: #40 to dev, open, left unmerged. It is HELD OPEN until the
       architecture review (R1) has run (Bradley, 2026-10-04): green CI plus its review round do not merge it on
       their own. Its verdict is V2, after S4c. The review round ran on the branch: one /code-review at medium, four
       findings, each fixed with a check shown red with the fix reverted.
     Handoff: NOT DONE. `dev-utils handoff --branch feat/jo-dash-s4a-runtime --blind-spots "..."` refused to mint
       this round's token the way S3's did: this header names an earlier token of today in a pointer's text. By the
       standing precedent the refusal is recorded and not worked around: the Under test line, the Blind spots line
       and the canary are unchanged, here and on the branch, and still describe the S2 round. The handoff is owed on
       the branch on the next calendar day, with the blind spots below.
     Blind spots this round would have declared (for that handoff): built offline against the fictional tenant,
       the stand-in CLI and generated snapshots; no tenant read. Unmeasured, all banked in dev/VALIDATION.md section
       DSH-2 (Z0 to Z10, verdict at V2): (1) a page over a real snapshot: its size, a real browser on a real program
       list, what a spreadsheet makes of the CSV, whether real names render and export cleanly; (2) the three lacks
       on real data (accounts off in three places, an offered tab, the recipients toggle); the no-internal-domain
       case stays offline-only, no real pull without a domain exists; (3) the executor's choices under Z0. Owed
       elsewhere, not a blind spot: the page's line to copy names the `dashboard edit` and `refresh` modes S5
       builds, and nothing holds it to the skill's mode table until then. Offline: the full CI battery green (51
       steps; the two reds are CI-only plumbing and the known git-ignored file under tsc), the full build
       reproducing the tree except date stamps, plugin validate, typecheck; a vacuity sweep with predictions written
       first, 30 mutants, 29 as predicted, the mismatch and the predicted survivor pinned and re-run KILLED; the DOM
       wiring driven in a real browser on the fixture pages, a hostile-name page and a 400-program page, not under a
       committed test (the committed stand-in document covers storage, one filter change and the hash); the review
       was the builder's own single pass.
     On the branch (feature item DSH-2, tracked by plan ID, no bus section): scripts/dashboard-page.mjs (spec +
       snapshot → one self-contained latest-<page>.html per page: data embedded compactly, engagement-query.mjs and
       dashboard-runtime.mjs inlined byte for byte, the default view pre-rendered, a size report with the 5 MB
       warning and the 15 MB leaders'-page refusal, a tenant check), scripts/dashboard-runtime.mjs (import-free by
       gate: the filter bar, tabs in three states, the table panel that takes only the engine's result, column
       choices, the URL hash with ids only, one CSV builder, and the LACKS table with its one function and one
       renderer; NOT_LACKS and LACKS_LATER close the engine's REASONS both ways), four page-level ids added to the
       engine's REASONS, test/dashboard-page.mjs (102 checks), CI step, AGENTS.md battery line, the import gate's
       RESTRICTED row, the tracer's rule-outs (data/reader-shapes.json regenerated), MAINTAINERS.md, CHANGELOG,
       plugin 0.47.0 unreleased. T-10 and T-11 read, neither changed. dev/VALIDATION.md: Y0 marked ruled, Y1 / Y2 /
       Y6 extended and the spike arm added as the kickoff rulings ask; section DSH-2 banked for V2.
     CI on PR #40's head: changes success; drift (full), manifests and validate (ubuntu-latest) were running when
       this was written; quoted per job on the next re-stamp. F-482 (polish) still OPEN, not taken. Open PRs to dev:
       #40 only. -->

<!-- tester 2026-10-05 (JO-dashboards S4a — POINTER RE-STAMPED after the SHORT SPOT CHECK @ hb-20261004-04: Z0 ruled; Y3, Z2 CLEARED; Y1, Z1, Z7 FAILED; F-476 REOPENED and F-483, F-484, F-485, F-486 claimed by the branch; next free F-487; re-stamps the builder pointer above):
     Branch: feat/jo-dash-s4a-runtime at 548cc22 (the round's bus commit 611ec8c, then dev merged in with both sides of
       the bus kept, because the tester block and this pointer met at one spot and left PR #40 CONFLICTING). PR #40
       open, MERGEABLE / CLEAN, still HELD for R1; this round does not change that.
     Handoff: hb-20261004-04 was minted on the branch (ffdf08a) after the pointer above; the Under test line and the
       canary there read it, and the tester matched both in session.
     Statuses on the branch: F-476 OPEN again (first reopen: the estimate does not price the health families' splits);
       F-483 OPEN polish (a plan made before midnight cannot be run after it); F-484 OPEN normal (health failure text
       kept at the text's grain: participant failures unreadable at order 10^6 rows, bounce reasons barely grouped, the
       admin page with health order 8 MB); F-485 OPEN polish and F-486 OPEN polish, both S4a's (the size report omits the
       health tables; an on tab with nothing to draw is a bare pane). Detail in the branch's tester comment and Walk line.
     VALIDATION on the branch: section HLT-1 / DSH-1 / DSH-5, Y1 FAILED and Y3 CLEARED; section DSH-2, Z0 ruled and
       CLEARED, Z1 FAILED, Z2 CLEARED, Z7 FAILED; both sections OPEN, every other Y and Z check owed at V2.
     CI on PR #40's head 548cc22, per job: validate-plugin 37397625489 changes success, manifests success, validate
       (ubuntu-latest) success; docs-drift 37397625563 drift (full) success; GitGuardian pass. (On the round's own commit
       611ec8c only GitGuardian ran: the PR was conflicting.)
     Open PRs to dev: #40 only. F-482 (polish) still OPEN. -->

<!-- builder 2026-10-04 (JO-dashboards S3 CLOSED OUT — PR #39 merged (5910c24); T-11 FROZEN at schemaVersion 1; no finding logged; next free F-483):
     PR #39 (feat/jo-dash-s3-health-spec) was merged to dev on Bradley's go-ahead, on green CI plus its review round, as
       the plan's merge gate for this session has it. Its verdict is V2, after S4c: dev/VALIDATION.md section
       HLT-1 / DSH-1 / DSH-5, Y0 to Y12, is OPEN and carries no token.
     Contracts: T-11 (the dashboard spec, scripts/dashboard-spec.mjs) is frozen from this merge. T-10 gained its
       additive health fields (the failure count on every send row, facts.health, meta.health); schemaVersion 1.
     Handoff: still NOT minted. dev-utils handoff was tried again from dev after the merge and refused the same way
       (this header names an earlier token of today in another round's text). Recorded, not worked around. The
       Under test line still names the S2 round; the next build session's own handoff mints the next token.
     Owed: Bradley's rulings on S3's executor's choices (Y0), which the next build session asks for before any code.
     Branch deleted, local and remote. Plugin 0.46.0 on dev, unreleased (one release for the whole program).
     CI on the merged tip 5910c24: docs-drift 37243701141 and validate-plugin 37243701079 were running when this was
       written; a red one is a finding for the next session's kickoff, which reads the open PRs and the dev log.
     F-482 (polish) is still OPEN. Open PRs to dev: none. Issues #11 and #12 unchanged. -->

<!-- builder 2026-10-04 (JO-dashboards S3 — POINTER: plan items HLT-1, DSH-1 and DSH-5 ride an UNMERGED branch; no finding logged; NO handoff token was minted; next free F-483):
     Branch: feat/jo-dash-s3-health-spec at fa1d747. PR: #39 to dev, open, left unmerged. It merges on green CI plus its
       review round (done on the branch: one /code-review at medium, six findings, five fixed with a check each, one
       left to the refresh runner and recorded for it); its verdict is V2, after S4c.
     Handoff: NOT DONE. `dev-utils handoff --branch feat/jo-dash-s3-health-spec --blind-spots "..."` refused to mint
       this round's token: this header's S2 re-stamped pointer names an earlier token of today in its text, and that
       token's Blind spots line was replaced by the later same-day handoff. By the standing precedent the refusal is
       recorded and not worked around: the Under test line, the Blind spots line and the canary are unchanged, here
       and on the branch, and still describe the S2 round. The handoff is owed on the branch on the next calendar
       day, with the blind spots below.
     Blind spots this round would have declared (for that handoff): built offline against the fictional tenant and
       the stand-in CLI, no tenant read. Unmeasured, all banked: (1) the plain-row shape of a failed participant's
       FailureReasons is ASSUMED (the spike recorded it in words only); (2) what real bounce reasons hold beyond the
       five mask rules (address, UUID, IPv4 address, long id, digit run); (3) whether the participant object's
       group-by returns or times out at 50 programs a call, and so what the health pull costs; (4) the bounce-reason
       cell shape is reproduced from the spike's note, not from a captured payload; (5) no skill prose changed and
       none was walked; (6) the review was the builder's own single pass, not an independent frame; (7) the mutation
       sweep ran before the review fixes and was not repeated after them (each fix landed with its own check; the
       sweep's one mismatch got a pin and was re-run KILLED).
     On the branch (feature items, tracked by plan ID, no bus section):
       HLT-1: health facts in the engagement snapshot, additive on T-10 (typedef and pin moved together; schemaVersion
       stays 1). Every send row carries `failed` (bounced or rejected, once per attempt) and the registry gains the
       error rate (failed over sent). `engagement.mjs --health`, off unless passed, pulls bounce reasons, participant
       failures and states, each program's last send day and schedule last-run results (from the KB); error messages
       are masked when fetched and again in reduce; a health call that fails never fails the pull.
       DSH-1: scripts/dashboard-spec.mjs, the dashboard spec (T-11, typed and pinned; it freezes at the merge) and
       its one writer, with export and import (no machine path; another tenant refused).
       DSH-5: scripts/dashboard-groups.mjs, two-level program groups from rules, overrides first, Ungrouped last.
       No SKILL.md changed; the email-engagement report makes the same calls as before.
     A refresh that continues from a snapshot made before plugin 0.46.0 is a full one, once (its rows carry no
       failure count). V2's kept previous snapshot is such a snapshot.
     No F-number was claimed by the branch. F-482 (polish) is still OPEN on dev and was not taken by this round.
     dev/VALIDATION.md on the branch: a new section, HLT-1 / DSH-1 / DSH-5, Y0 to Y12, owed at V2. It carries no
       token yet and says why.
     Plugin 0.46.0 on the branch, unreleased (one release for the whole program).
     Local battery, 52 steps: 49 green on the first run; one real red fixed (a path literal in a test tripped
       check-instance-data), two known local reds (tsc on a git-ignored file; the full build's date stamp).
     sweep (source: the decision points of the functions added or changed, enumerated from the code; predictions
       written before the run): 36 of 37 as predicted, three predicted survivors (equivalent mutants), one MISMATCH
       (an unknown field holding an empty object or list was accepted by no check), pinned and re-run KILLED.
     CI on PR #39's head fa1d747, per job (re-stamped 2026-10-04 at close-out): validate-plugin 37241095032 changes /
       manifests / validate (ubuntu-latest) success; docs-drift 37241094937 drift (full) success. The PR reads
       MERGEABLE / CLEAN. The merge is Bradley's; the handoff is still owed (see above).
     Open PRs to dev: #39 only. Issues #11 and #12 unchanged. -->

<!-- builder 2026-10-04 (JO-dashboards S2 CLOSED OUT — PR #38 merged (bd27fed); F-479, F-480, F-481 VERIFIED; F-482 logged OPEN (polish); next free F-483):
     PR #38 (feat/jo-dash-s2-engine-report) was merged to dev by Bradley after the re-verification round passed R1 to
       R3. The branch is deleted, local and remote. The three S2 pointers below are history: nothing rides an unmerged
       branch now.
     On dev now (plan items ENG-4 and ENG-3): scripts/engagement-query.mjs (the one aggregation path over an engagement
       snapshot, import-free; the metric registry, the source facts the adapter builds its queries from, the T-10 read
       floor), scripts/engagement-report.mjs, and the email-engagement skill with its report mode. Plugin 0.45.0,
       unreleased (one release for the whole program). T-10 unchanged.
     Findings: F-479, F-480, F-481 VERIFIED at hb-20261004-03. F-482 OPEN, polish, logged in this commit: the tester's
       "noticed" item from that round (the snapshot's pull time is the plan's start), which an observation-only note
       would have lost. No normal or critical finding is open.
     dev/VALIDATION.md section ENG-3 / ENG-4: X0, X1 and R1 to R3 carry PASSED lines; X2 to X9 stay owed at V2. X6's
       pass bar is tightened in this commit: it compared the report's time with the field that carries F-482's defect.
     CI on PR #38's final head 9852e3c, per job: validate-plugin 37231151041 changes success / manifests success /
       validate (ubuntu-latest) success; docs-drift 37231151002 drift (full) success.
     CI on the merged dev tip bd27fed, per job: docs-drift 37231464344 (push) drift (full) success; validate-plugin 37231464332 (push) changes success / manifests success / validate (ubuntu-latest) success.
     Open PRs to dev: none. Issues #11 and #12 unchanged. Next build session: S3 (HLT-1, DSH-1, DSH-5), from dev. -->

<!-- tester 2026-10-04 (JO-dashboards S2 re-verification @ hb-20261004-03 — R1 TO R3 PASSED; F-479, F-480, F-481 VERIFIED; nothing logged; PR #38 ready to merge on Bradley's call; next free F-482):
     Provenance: the dev-canary skill read hb-20261004-03 in session, matching Under test; the workspace's plugin link
       resolves to this checkout's plugins/gs-superadmin; feat/jo-dash-s2-engine-report clean and level with origin at
       8c699d7. Production tenant, confirmed by `gs-admin whoami` and by Bradley; CLI 1.0.10; reads only, one call at a time.
     Round type: RE-VERIFICATION of three polish findings, R1 to R3 as written and nothing past them. Picks and inputs as
       settled; the walk passed both internal domains and both unsubscribe links.
     The walk: plan 8 calls / 43 s wall; estimate 35 calls / 327 s; pull 36 made, 7 reused, 0 retried, 269 s wall; exit 0
       and reconciled throughout. No step's prose made the walk stop or guess.
     R1 (F-479): live arm, the picks still reach a deleted program; no progress line says `failed`; both not-found lines
       word for word. PASS. R2 (F-480): the footer's code span, extracted by script and run through bash, exits 0 and
       writes a second report, no new pull working directory; explanation on the header's snapshot line. PASS.
       R3 (F-481): the Caveats line is caveatCount plus leadCaveats joined; a second step 4 over the same snapshot gives
       equal leadCaveats. PASS.
     Blind spots (this round's own): (1) whether any guard ask rendered is not visible to the tester; the session's own
       gs-admin calls were two `whoami`, and the scripts spawn the CLI outside the hook; Bradley's report of what he saw is
       the measurement, not taken here. (2) "Pulls nothing" for R2 is measured by the absence of a new pull working
       directory and the summary's snapshot path, not by a trace of CLI calls. (3) The step-3 summary was read filtered to
       its status keys, not whole. (4) R3's second run was step 4 alone over the snapshot, as R3 states, not a second
       full invocation of the skill with `--snapshot`. (5) Live, only the clean-pull branch of leadCaveats' order was
       reached; the unmatched-name, carried-month and failed-reconciliation arms rest on the builder's offline tests.
       (6) CI on this push's head is not quoted here.
     Noticed, not a finding (outside R1 to R3, already raised in the spot-check report): the report's "Data pulled" time
       is the plan's start, not the pull's; X6 at V2 judges it.
     Open PRs to dev: #38 (unmerged; the merge is Bradley's). -->

<!-- builder 2026-10-04 (JO-dashboards S2 — POINTER RE-STAMPED @ hb-20261004-03: F-479, F-480 and F-481 claimed by the branch and FIXED there; next free F-482; re-stamps the pointer below):
     Branch: feat/jo-dash-s2-engine-report at 8c699d7. PR: #38 to dev, open, unmerged.
     What moved since the pointer below: a tester's early spot check of X0 and X1 at hb-20261004-02 (production
       tenant, reads only) PASSED both and logged three polish findings on the branch: F-479 (progress lines said
       "failed" for a deleted program's describe beside a clean summary), F-480 (the report's Re-run code span held
       its explanation, so the copied command did not parse) and F-481 (the skill's final Caveats line was left to
       the reader's judgment). The builder fixed all three on the branch; each reads FIXED there, with Fix and Judge
       notes, and reads nothing in this file until PR #38 merges. The numbers F-479 to F-481 are taken.
     Handoff token: hb-20261004-03 (Under test line, Blind spots line and canary are on the branch).
     dev/VALIDATION.md on the branch, section ENG-3 / ENG-4: X0 and X1 carry the spot check's PASSED lines; R1 to R3
       are the three fixes' re-verification, owed by one tester round before the merge (Bradley's call); X2 to X9
       stay owed at V2.
     CI on PR #38's head 8c699d7: pending when this was written.
     Open PRs to dev: #38 only. Issues #11 and #12 unchanged. -->

<!-- builder 2026-10-04 (JO-dashboards S2 — POINTER: plan items ENG-4 and ENG-3 ride an UNMERGED branch; no finding logged; next free F-479):
     Branch: feat/jo-dash-s2-engine-report. PR: #38 to dev, open, left unmerged. It merges on green CI plus its review
       round (done on the branch: one /code-review at medium, three findings, all fixed); its verdict is V2, after S4c.
     Handoff token: hb-20261004-02 (the Under test line, the Blind spots line and the canary are on the branch, not here).
     On the branch (feature items, tracked by plan ID, no bus section): scripts/engagement-query.mjs, the one
       aggregation path over an engagement snapshot, import-free, holding the metric registry, the source facts the
       adapter now builds its queries from, and the T-10 read floor (moved out of engagement.mjs);
       scripts/engagement-report.mjs, the open-rate report; and a new skill, email-engagement, with one mode, report.
       T-10 is read, not changed. engagement.mjs --name also takes a program id.
     No F-number was claimed by the branch. No finding of any tier is OPEN.
     dev/VALIDATION.md on the branch: a new section, ENG-3 / ENG-4, X0 to X9, keyed to hb-20261004-02, owed at V2. The
       new skill was not walked live: X0, X4, X8 and X9 are its walk.
     Plugin 0.45.0 on the branch, unreleased (one release for the whole program).
     CI on PR #38's head: pending when this was written; quoted per job in a re-stamp of this pointer once it completes.
     Open PRs to dev: #38 only. Issues #11 and #12 unchanged. -->

<!-- builder 2026-10-04 (JO-dashboards S1b CLOSED OUT — PR #37 merged (3c967f1); F-478 VERIFIED; no finding open; next free F-479):
     Merged: feat/jo-dash-s1b-accounts-optional -> dev, PR #37, merge commit 3c967f1 (Bradley's go-ahead, 2026-10-04,
       after the verdict round passed every check). The branch is deleted, local and remote.
     On dev now: F-478's fix (one gate for every read of a previous snapshot) and the engagement adapter's optional
       account grain (off unless --accounts; meta.accounts, additive on T-10, typedef and pin together). Plugin 0.44.0
       stays unreleased (one release for the whole program).
     Findings: F-478 VERIFIED at hb-20261004-01. No finding of any tier is OPEN. dev/VALIDATION.md section
       ENG-2 / LTR-9 / F-478: CLEARED at hb-20261004-01.
     Under test stays feat/jo-dash-s1b-accounts-optional · hb-20261004-01 until the next handoff re-stamps it; that
       branch no longer exists, so a tester session loads dev.
     CI on dev after the merge (3c967f1), quoted per job after completion:
         docs-drift 37222462137 (push): drift (full) success
         validate-plugin 37222462068 (push): changes success / validate (ubuntu-latest) cancelled / manifests cancelled
           (cancelled, not failed: superseded by the dispatch below, started seconds later on the same commit)
         validate-plugin 37222472304 (workflow_dispatch): changes success / manifests success / validate (ubuntu-latest) success
     Open PRs to dev: none. Issues #11 and #12 unchanged. Released: nothing. -->

<!-- tester 2026-10-04 (JO-dashboards S1b verdict round @ hb-20261004-01 — W0 TO W5 ALL PASSED; F-478 VERIFIED; VALIDATION section ENG-2 / LTR-9 / F-478 CLEARED; nothing logged; PR #37 ready to merge; next free F-479):
     Provenance: the dev-canary skill read hb-20261004-01 in session, matching Under test; the workspace's plugin link
       resolves to this checkout's plugins/gs-superadmin; feat/jo-dash-s1b-accounts-optional clean and level with origin
       at 0cd7344. Production tenant, confirmed by `gs-admin whoami` and by Bradley; CLI 1.0.10; every tenant call a read,
       one at a time; one login, before W1.
     Round type: a RE-VERIFICATION of F-478 and of the six checks the section names, each against its stated pass bar and
       nothing past it. Picks and inputs as settled; every live line passed both internal domains and both unsubscribe links.
     W0 (offline): F-478's repro through the real process and the stand-in CLI, not the builder's suite. Other-host copy and
       drift-deleted copy each reduce equal to the no-previous reduce but for `why`; previousPulledAt null; the control
       (`--full`, host restored) reads the marked template `tracked`. F-478 FIXED -> VERIFIED.
     Live, estimate -> actual: W1 plans 35 calls / 327 s (accounts off; adds 264 / 1848 s) and 299 / 2175 s (on); W2 accounts
       off 35 / 327 s -> 36 / 313 s (5.2 minutes; LTR-9 guessed 5 to 8); W3 accounts switched on over W2's snapshot, full
       as designed, 299 / 2175 s -> 315 / 1962 s, of which 268 calls are the account grain's against 264 estimated. W4
       selective with no account family; W5 selective with --accounts over a pre-switch snapshot, full without.
     Guard-wiring: `gs-admin jo p pause --help` -> Bradley read the rendered ask: "Mutating Gainsight command: gs-admin
       journey programs pause. This workspace is read-only by default. Workspace manifests claim multiple tenants
       (<slug> (<host>); <slug> (<host>)) — confirm `gs-admin whoami` targets the intended one before approving. ⚠ At
       least one of these tenants is PRODUCTION (recorded at setup) — verify the target before approving." DECLINED.
     Walk: none owed. No SKILL.md changed this round; the round's Walk line is above.
     Blind spots: one tenant. Blind spot (4) of the handoff stands: whether the sandbox shares ids with production was not
       measured; F-478 is judged by construction and the offline differential. The internal-domain list is still the
       operator's knowledge.
     Session faults: none recorded; no gs-admin call ran while a run was in flight.
     PR #37: every owed check passed and nothing is open on the branch. Ready to merge; the merge is Bradley's. -->

<!-- tester 2026-10-04 (JO-dashboards S1b verdict round @ hb-20261004-01 — W0 TO W5 ALL PASSED; F-478 VERIFIED on the branch; PR #37 ready to merge; next free F-479; re-stamps the builder pointer below):
     Riding feat/jo-dash-s1b-accounts-optional -> PR #37, UNMERGED (ready to merge; the merge is Bradley's). Branch tip
       aade070, the verdict commit (bus statuses, Walk line, tester block; VALIDATION section ENG-2 / LTR-9 / F-478
       CLEARED), on the handoff at 0cd7344.
     Status on the branch: F-478 FIXED -> VERIFIED (W0: its repro through the real process and the stand-in CLI; the
       other-tenant and earlier-definitions snapshots each reduce equal to no previous at all, and the --full control
       still reads the history). It reads OPEN in this file until PR #37 merges. No finding logged; no number claimed.
     W1 to W5 (accounts optional, plan items ENG-2 and LTR-9): production tenant, reads only, every check passed; the
       accounts-off pull took 5.2 minutes. Guard-wiring ask rendered and declined. Detail in the tester comment on the branch.
     Open PRs to dev: #37 only.
     CI on PR #37's head aade070, quoted per job after completion:
         validate-plugin 37221387387 (pull_request): changes success / manifests success / validate (ubuntu-latest) success
         docs-drift 37221387383 (pull_request): drift (full) success -->

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
Reopened: 2026-10-05 (tester, spot check @ hb-20261004-04 on feat/jo-dash-s4a-runtime, clean and level with origin at ffdf08a, the dev-canary skill read hb-20261004-04 in session; production tenant, reads only; VALIDATION section HLT-1 / DSH-1 / DSH-5, Y1) — the Fix note's own class, in families it did not price: "an estimate that counts the units it plans, when the cost is in the calls each unit turns into". The fix priced the account grain only (its note: click and step families "are still priced at one call each"); the health families S3 added since are priced the same way. `plan --health` (no selector, 194 programs, both internal domains and both unsubscribe links) priced health at 24 calls / 204 s (`estimate.health`; by family: health-bounce 15, health-days 1, health-reasons 4, health-states 4). The pull made 187 / 1400 s for health (7.8x the calls, 6.9x the seconds): health-bounce 73 (29 units came back a full page and were split), health-reasons 109 (61 full pages; 9 units left with nothing to split on, F-484). The whole run: 59 calls / 531 s planned, 226 / 1954 s made. None of the cheap calls `plan` makes sizes either object; two server-side counts did (Y1's count-first check: order 10^6 failed-participant rows, one program holding 89%). This is the section's FIRST reopen; rule 5 counts it. Severity unchanged (normal): the pull still fit the token here, but the estimate is what a user decides on (R21).
Builder note: 2026-10-05 — rides S3b, the health batch, with F-483 and F-484: the health families it would price are the ones S3b replaces (failure reasons counted server-side by category), so the estimate is fixed against the new families, not the old. Not taken on feat/jo-dash-s4a-runtime, which is held for R1.
Fix: 2026-10-07 (builder, feat/jo-dash-s3b-health-batch, PR #43 unmerged) — Class, in one sentence: an estimate that counts the units it plans, when the cost is in the calls each unit turns into — now closed for every family that reads rows or splits, not the account grain alone. `plan` makes a server-side COUNT first for each such family (`count-clicks` and `count-bounces`, program × month, two cheap calls; the failed-participant totals read at plan) and `expectedRows` prices the family from it as data: the click families from the clicked sends, the bounce counts from the bounced attempts (a category at half the total's rows), the day buckets from the sends in the lookback (at most one row per program and day), the account grain as before. `expectedCalls` prices a span unit's splits as a balanced tree (2L - 1 calls for L half-page leaves; the account grain keeps its fitted model). The health families this batch replaced (the free-text reads) no longer exist to be mispriced. A row budget (`--max-pages`, 40 pages of `--page-size`) refuses a health part up front as `too-large` (a new REASONS id beside call-failed) and refuses a click detail over it at the plan, naming the count and what to narrow — never "nothing left to split on". `estimate.health` gains `describes` (the live reads at their cap), `lookback`, `failedParticipantRows` and `categories`; `estimate.rowBudget` says what exceeded it. A second review pass (medium) found two defects in the batch, both fixed with a check each: the bounce count-first read was skipped with health off, so the cost of adding health was priced from sends; a categories file with a misspelled key was accepted and counted nothing.
Judge: the fixture's own calls: at a 50-row page, where the day buckets and the bounce counts split, the estimate of the health calls must be within 2x of the health calls the pull made (read from the fetch log by family, independently of the estimate), where the measured tenant read 7.8x; and the pull without the mass-send day must be priced within 2x of the calls it took. The judge of record on a tenant is V2's Y1 (health calls against `estimate.health.addsCalls`, the whole run against `estimate.thisRun`).
Mutation copy-out — sweep (source: the decision points of this fix in scripts/engagement.mjs and scripts/engagement-query.mjs; a vacuity check on the committed checks, not closure); predictions written before the first run, the table from the sweep on the final code; suites = test/engagement.mjs + test/engagement-query.mjs + test/dashboard-page.mjs + test/contract-conformance.mjs:
    P10  KILLED pred:KILL
    P11  KILLED pred:KILL
  Both as predicted.
Sibling sweep: batched — normal; the only other reader of the estimate is the email-engagement skill's step 2, which prints `estimate.thisRun` and `estimate.health` and needs no change; `estimate.rowBudget` is new and read by nobody yet (S5's runner).
Pass bar (stated before measuring, from the Judge line and VALIDATION section HLT-1 / DSH-1 / DSH-5 as re-banked at hb-20261007-02, Y1): one `plan` then `run` with `--health --kb` and the same `--run`; the health calls (the fetch log's `health-` and `schedule-describe` records, counted by family and attempt) within 2x of `estimate.health.addsCalls`, and the whole run's calls and seconds within 2x of `estimate.thisRun`.
Verified: 2026-10-07 (tester, S3b verdict round @ hb-20261007-02, feat/jo-dash-s3b-health-batch clean and level with origin at 1f85444, the dev-canary skill read hb-20261007-02 in session; production tenant, reads only) — RE-VERIFICATION, the bar above. Plan: 14 calls, `failedParticipantRows` order 10^6, `rowBudget` 40 pages with nothing over it. Health calls 36 (35 in the run; `health-reasons-total` made at the plan's count-first read and priced in `addsCalls`) against `addsCalls` 40: 0.90x, where the spot check read 7.8x; health seconds about 153 against 219. By family, estimate -> made: bounce-total 3 -> 3, bounce-sample 1 -> 1, days 5 -> 1, reasons-total 1 -> 1, reasons-sample 1 -> 1, states 4 -> 4, schedule-describe 25 -> 25; nothing split, nothing retried in the run. Whole run 71 calls / 556 s against `estimate.thisRun` 75 / 546 s (0.95x calls, 1.02x seconds); the click families, now priced from a count, 7 -> 7. Corroborated on three more pulls of the round: the no-health pull 45 / 493 s against 35 / 327 s (1.29x, 1.51x); the test-account pull 92 made against 84; the categories pull 175 made across a token stop and resume against 165 (1.06x; health priced at 130 for the 30 categories). Pass.


## F-477 — WONTFIX
Reported: 2026-10-03 (tester, S1-V third re-run on feat/jo-dash-s1-facts @ hb-20261003-05; production tenant, reads only; VALIDATION section ENG-2, the Delivered ruling's checks V3 and V12)
Severity: polish — unreachable on the measured data: no send that went out carries a null bounce flag, so no figure differs; logged so that a deviation on some tenant has a record to point to
What: Bradley's Delivered ruling (2026-10-03) is "went out and did not bounce". Asked at this round whether a send that went out with a NULL bounce flag counts as delivered, he ruled that in practical terms it does not. The two readers decide it the other way round: `logFlags` in scripts/engagement.mjs counts a row delivered when `IsSent` is YES and `IsBounced` is not YES, and `joFlags` when `EmailSend` is true and `Bounce` is not true (the T-10 typedef says "not YES" / "not true" in words), so a went-out row whose bounce flag is null would count as delivered. Measured, through the spike's catalog-checked runner with the adapter's own filters: email_log_v2 over the 194 selected programs and the 13-month window, rows with `IsSent` YES and `IsBounced` null: 0; rows with `IsSent` null: 0. ao_emails: the P-multi month read, 0 with `Bounce` null; Bradley read the flag across the tenant and found every value set (his read, not a CLI count).
Repro: COUNT of `Gsid` on email_log_v2 with the adapter's filters, grouped by SourceId, IsSent and IsBounced: a group with IsSent YES and no `v` on IsBounced is the case. On ao_emails, the same with EmailSend and Bounce.
Expected: no change now. Decided: 2026-10-03 (Bradley) — WONTFIX: an unreachable state the adapter would be built for. If any tenant shows a went-out send with a null `IsBounced` or `Bounce`, log a new finding that points here; the fix is the two readers testing `IsBounced = NO` and `Bounce = false`, with the typedef text and the pin. After T-10's freeze that changes what a measure counts, which the contract-freeze rule governs.

## F-478 — VERIFIED
Reported: 2026-10-03 (tester, S1-V third re-run on feat/jo-dash-s1-facts @ hb-20261003-05, read from the code at f378505; first noticed by the builder in the S1-fix round and carried unlogged since; logged on Bradley's call)
Severity: normal — on a tenant pair that shares ids (a sandbox copied from production), a refresh given the other tenant's snapshot as --previous can mark a template's clicks `tracked`, so a 0% shows as a real 0%, from clicks recorded on the other tenant; unmerged and no skill calls the script yet, but the S2 report and any direct use of the adapter reach it before PUB-1's tenant refusal exists
Class: consumer-parity
What: when the previous snapshot is another tenant's, `decideRefresh` falls back to a full refresh ("the previous snapshot is another tenant's"), and on a full refresh no fact row and no step is carried. But reduce reads three lookups from the previous snapshot on EVERY refresh, full ones included, and none of them checks the tenant: (1) click history (scripts/engagement.mjs, `prevClick`, ~1831), gated only on the unsubscribe-link list matching — a template id the previous snapshot saw clicked reads `tracked` with its first and last click months; (2) template names (`prevTemplates`, ~1914), the fallback when this pull returns no name for an id; (3) account names (`names`, ~1925), the fallback when this pull's name lookup does not resolve an account (`--no-account-names` still blanks every name). Reachable only where ids collide across tenants: ids are normally unique per tenant, but a sandbox copied from production can share them, and a consumer workspace may hold exactly that pair. Not measured live: whether this workspace's sandbox shares ids with its production tenant.
Repro: offline — reduce a run whose `whoami.host` differs from the previous snapshot's `meta.tenantHost`, with a template id present in both and clicked only in the previous one; `meta.metricAvailability.clicks.templates[<id>]` reads `tracked` with the previous tenant's click months. The same shape with a template or account the current pull leaves unnamed shows the previous tenant's name.
Expected: the class, as an invariant: nothing from a previous snapshot reaches a new one unless the refresh would carry it, so every read of the previous snapshot passes the same tenant check (and any other full-refresh reason that changes what the lookup means) that `decideRefresh` applies to the facts. A falsifiable test that enumerates nothing: reduce the fixture against a previous snapshot whose `meta.tenantHost` differs and assert the new snapshot equals the one reduced with no previous at all. No T-10 change.
Fix: 2026-10-04 (builder, batch S1b on feat/jo-dash-s1b-accounts-optional, unmerged) — Class, in one sentence: one rule ("this snapshot cannot be continued from") had one consumer, the refresh decision, while every other reader of the previous snapshot went round it. The fix is one gate, not three checks. `unusableWhy(previous, tenantHost)` is now the single statement of the rule (another tenant's, or built under earlier metric definitions); `decideRefresh` gives its answer as the reason for the full refresh, and `usablePrevious` returns the snapshot or nothing. Fetch and reduce take the snapshot as given only to hand it to `decideRefresh`, then rebind the name `previous` to `usablePrevious(...)`: every later read (click history, template names, account names, the carried rows, the carried steps, a carried program's account selection) goes through the gated value because no other name for the snapshot is in scope where they sit. The count of hand-written tenant checks went from one beside three unguarded reads to one. The unsubscribe-link gate on click history stays where it was: it is a reason that lookup alone changes meaning, and it now applies on top of the gate. A sibling your report did not list, found by reading every use of the snapshot: `meta.refresh.previousPulledAt` carried the other tenant's pull date into the new snapshot on a full refresh. It is now null whenever the snapshot given cannot be continued from (it names the pull this one continues from); a full refresh over this tenant's own snapshot still names it. No T-10 change: the field was already nullable, and no field or measure moved. To pick it up: /reload-plugins is not needed (no skill, hook or MCP change); the script is read from the working tree on each run.
Judge: your Expected's differential, built before the fix was measured and independent of any list of lookups: a previous snapshot POISONED in every leaf (every number moved, every boolean flipped, every name changed, under the same ids), reduced against a pull that cannot name a template or an account itself, so each fallback is live. With the other tenant's host, and again with this tenant's host and `drift` deleted, the new snapshot must equal the one reduced with no previous at all, the stated reason (`meta.refresh.why`) aside. The same poisoned snapshot under this tenant's host with `--full` is the control: it must supply click history, template names, account names and its pull date, which proves the differential can see each leak. A fourth arm runs the whole pull, fetch included: the calls made and the snapshot equal a first pull's. The judge of record is your W0 (dev/VALIDATION.md, this batch's section): the repro through the real process and the stand-in CLI, not this suite.
Sibling sweep: node build/sweep-twins.mjs (about 1 s): no pair involves scripts/engagement.mjs. git grep for every read of the previous snapshot in the plugin's scripts: all are in engagement.mjs; the name `given` appears only in the two destructurings, the three `decideRefresh` calls (two that decide, one that prices the plan with accounts) and `usablePrevious`'s two call sites. Readers of the rule itself: `decideRefresh` and `usablePrevious`, both through `unusableWhy`. No other script reads a snapshot's `meta.tenantHost` today; PUB-1's tenant refusal (unbuilt) is a different check, on the spec.
Mutation copy-out — sweep (source: the decision points of the changed code in scripts/engagement.mjs, read from the code: unusableWhy, usablePrevious, decideRefresh, resolveParams, planUnits, fetch's guards and estimate, reduce's guards and marker, accountAvailability, loadRun, the CLI flags, reduceSummary; a vacuity check on the committed checks, not closure); predictions written to a file before the first mutant ran (M40 to M42 before the two review fixes were applied); suites = test/engagement.mjs + test/contract-conformance.mjs. The rows about F-478's gate:
    M01  usablePrevious lets every snapshot through  KILLED pred:KILL
    M02  unusableWhy: no tenant check  KILLED pred:KILL
    M03  unusableWhy: no earlier-definitions check  KILLED pred:KILL
    M04  reduce reads the snapshot as given  KILLED pred:KILL
    M05  fetch reads the snapshot as given  SURVIVED pred:SURVIVE
    M06  previousPulledAt from the snapshot as given  KILLED pred:KILL
    M29  click history ignores the unsubscribe links  KILLED pred:KILL
    M30  template names read from the snapshot as given  KILLED pred:KILL
    M31  account names read from the snapshot as given  KILLED pred:KILL
    M32  click history read from the snapshot as given  KILLED pred:KILL
    M33  carried steps read from the snapshot as given  SURVIVED pred:SURVIVE
    M34  carried template rows read from the snapshot as given  SURVIVED pred:SURVIVE
  12 of 12 as predicted; the whole sweep, with the accounts-optional rows, was 36 of 36. The three predicted survivors are equivalent on reachable inputs: each reads only what belongs to a carried program, and a snapshot that cannot be continued from always gives a full refresh with no carried program. The gate still covers them by construction.
Pass bar (stated before measuring, from VALIDATION section ENG-2 / LTR-9 / F-478, W0 as written): the finding's repro through the real process and the stand-in CLI. (a) A copy of a fresh fixture snapshot with `meta.tenantHost` changed and a template this pull never saw clicked marked clicked: `reduce --previous <copy>` equals `reduce` with no previous in everything but `meta.refresh.why`, so the template reads as it does with no previous and `meta.refresh.previousPulledAt` is null. (b) The same with the host restored and `drift` deleted from every reconciliation check. (c) Control: host restored, nothing deleted, `run --full --previous <copy>` on a fresh run: the template reads `tracked`.
Verified: 2026-10-04 (tester, S1b verdict round @ hb-20261004-01, feat/jo-dash-s1b-accounts-optional clean and level with origin at 0cd7344, the dev-canary skill read hb-20261004-01 in session) — RE-VERIFICATION round, the bar above and nothing past it. Offline, a scratch workspace over the fixture tenant's KB, every step a spawned `node scripts/engagement.mjs` with `--bin test/fixtures/engagement/fake-gs-admin.mjs --accounts --unsubscribe-link <the fixture's own link>` (the same links on every arm, so the unsubscribe-link gate on click history cannot be what refuses the history): one `run` (exit 0, reconciled), whose snapshot read `tpl-day7` `unknown` (never clicked) and `tpl-unlisted` `tracked` (2026-08); the copy gave `tpl-day7` `tpl-unlisted`'s tracked entry. (a) other host: exit 0, mode `full`, why "the previous snapshot is another tenant's"; a leaf-by-leaf diff against the no-previous reduce, `why` removed, found no differing path; `tpl-day7` `unknown`, as with no previous; `previousPulledAt` null. PASS. (b) host restored, `drift` deleted: why "the previous snapshot was built under earlier metric definitions"; no differing path; `tpl-day7` `unknown`; `previousPulledAt` null. PASS. (c) control, `--full` on a fresh run: why "a full refresh was asked for"; `tpl-day7` `tracked` with the copy's months, `previousPulledAt` the copy's pull time, so the differential sees the leak when the gate lets the snapshot through. PASS. VERIFIED.

## F-479 — VERIFIED
Reported: 2026-10-04 (tester, S2 early spot check of X0/X1 on feat/jo-dash-s2-engine-report @ hb-20261004-02, checkout clean and level with origin at cd03875; production tenant, reads only; VALIDATION section ENG-3 / ENG-4, X0)
Severity: polish — no number is wrong and the summary is right; the progress lines on stderr contradict it, and the walk stopped to find out which to believe
What: scripts/engagement.mjs prints each call's progress line (`onCall`, ~1346) from the transport's `r.ok` alone, before the failure is classified. A `describe` of a program that no longer exists is classified `not-found`, retried once by design (~1376), and then recorded as `status: "ok"` with `notFound: true` (~1380), so it never reaches `failed`. The two stderr lines still read `describe-<hash> failed (<ms> ms)`, twice, while the plan's summary says `status: ok`, `failed: []`. SKILL.md step 2 says to judge by exit code and then the summary, and says nothing about the per-call lines, so a reader who sees "failed" twice beside a clean summary has no rule for it.
Repro: on any tenant where a program with sends in the window has since been deleted (the plan's `programs.deleted` is 1 or more), run step 2 as written (`engagement.mjs plan --kb <slug> --run <run> --name ...`). Observed: stderr `describe-<hash> failed` on attempt 1 and on attempt 2; exit 0; summary `failed: []`; `fetch-log.jsonl` row `status: ok, notFound: true, attempt: 2`.
Expected: the progress line reports the call's recorded outcome, not the transport's: e.g. `describe-<hash> not found (recorded; the program was deleted)` on the attempt that settles it, and something like `retrying` on the first. Or, if the lines are meant as raw attempt logs, SKILL.md step 2 says so in one line.
Fix: 2026-10-04 (builder) — scripts/engagement.mjs prints a call's progress line once its outcome is decided, not from the transport's result: the first not-found reads 'not found: trying once more', the second 'not found twice: recorded as a deleted program, not a failure'; a timeout says it will be split; a call recorded as failed says 'failed: <kind>'. Both of the finding's Expected options were taken: SKILL.md step 2 also says the per-call lines are progress only and that the exit code and summary decide. Check: test/engagement.mjs 'F-479' (two arms), red with either line reverted to 'failed' (P1, P2 KILLED pred:KILL).
Judge: the tester's own repro on a tenant with a deleted program in the window (stderr of plan beside its summary), and offline the stand-in CLI's deleted program through the in-process transport
Pass bar (stated before measuring, from VALIDATION section ENG-3 / ENG-4, R1 as written): with `programs.deleted` 1 or more and `failed: []`, no progress line contains the word `failed`; the deleted program's describe reads `not found: trying once more` and then `not found twice: recorded as a deleted program, not a failure`; the skill's step 2 says the lines are progress only.
Verified: 2026-10-04 (tester, R1 @ hb-20261004-03, feat/jo-dash-s2-engine-report clean and level with origin at 8c699d7, the dev-canary skill read hb-20261004-03 in session; production tenant, reads only) — RE-VERIFICATION, the bar above and nothing past it. The live arm: the picks still reach a deleted program, so the offline arm was not needed. Step 2 run as written, stderr captured to a file: exit 0, `status: ok`, `failed: []`, `programs.deleted` non-zero; 8 progress lines, none containing `failed`; the deleted program's describe printed `not found: trying once more` on the first attempt and `not found twice: recorded as a deleted program, not a failure` on the second, word for word. Step 2's new paragraph says the lines are progress only and that the exit code and summary decide; the walk did not stop at them. VERIFIED.

## F-480 — VERIFIED
Reported: 2026-10-04 (tester, S2 early spot check of X0/X1 on feat/jo-dash-s2-engine-report @ hb-20261004-02, read from the code at cd03875; VALIDATION section ENG-3 / ENG-4, X0)
Severity: polish — the step-6 block's `Re-run:` takes the summary's `rerun`, which is clean; only the report file's own footer carries the broken command, and the report says it is the way to rebuild the report
What: scripts/engagement-report.mjs (~367) passes `rerun: `${rerun}  (rebuilds this report from the same snapshot; it pulls nothing)`` to the shared renderer, and scripts/jo-report.mjs (~631) renders `Re-run: \`${rerun}\``. The explanation therefore lands INSIDE the code span. Copying the code span, which is what a code span is for, copies a command that bash refuses: `syntax error near unexpected token '('` (checked with `bash -n` on the same shape). email-report's reports are unaffected: only the engagement report appends the parenthetical.
Repro: run step 4 as written; read the last line of `<slug>/reports-adhoc/engagement-<date>.md`. Observed: `Re-run: \`node '<plugin>/scripts/engagement-report.mjs' --snapshot ... --csv-dir ...  (rebuilds this report from the same snapshot; it pulls nothing)\``.
Expected: the code span holds only the command; the explanation follows it outside the backticks (for example `Re-run: \`<command>\` — rebuilds this report from the same snapshot; it pulls nothing`). A test that copies the footer's code span and parses it as a shell command would hold this.
Fix: 2026-10-04 (builder) — scripts/engagement-report.mjs passes the command alone to the shared renderer, so the code span holds nothing else; the explanation moved to the header's snapshot line, outside any code span. Check: test/engagement-report.mjs 'F-480' holds the span equal to the summary's rerun, red with the parenthetical restored (P3 KILLED pred:KILL). Shipped shape differs from the Expected example (explanation after the span on the same line): that line is rendered by jo-report.mjs's renderReport, shared with email-report, which was left untouched.
Judge: copy the Re-run code span from a report written on the tenant and run it: it must rebuild the report
Pass bar (stated before measuring, from VALIDATION section ENG-3 / ENG-4, R2 as written): in the walk's report, the footer's `Re-run:` code span holds a command and nothing else; copied exactly and run, it exits 0 and writes a second report beside the first, pulling nothing; the explanation that it pulls nothing is in the header's snapshot line.
Verified: 2026-10-04 (tester, R2 @ hb-20261004-03, same checkout and canary as F-479's verdict) — RE-VERIFICATION. The footer's last line was matched as exactly `Re-run: ` plus one code span; the span's bytes were extracted by script (not retyped) and passed to bash: `bash -n` parses it; run, exit 0; a second report was written beside the first under the next free name; no new pull working directory appeared (directory listing before and after), and the second summary names the same snapshot. The header's snapshot line carries the explanation (the Re-run command at the foot rebuilds the report from this file and pulls nothing). VERIFIED. The shipped shape differs from the finding's Expected example, as the Fix note says; the bar is R2's, which it meets.

## F-481 — VERIFIED
Reported: 2026-10-04 (tester, S2 early spot check of X0/X1 on feat/jo-dash-s2-engine-report @ hb-20261004-02; walked in session; VALIDATION section ENG-3 / ENG-4, X0, pass-bar clause "the final block is printed in the skill's literal shape with every placeholder filled")
Severity: polish — the block was filled, but one placeholder's content had to be chosen by judgment, so two walks of the same snapshot can print different Caveats lines
What: SKILL.md step 6 fills `<the one or two that most affect trust in this report>` by naming "a reconciliation failure first, then carried-forward months, then a missing internal domain". That is an order among three caveats that may be present. On a full pull that reconciles with internal domains given, the X0 shape and likely the common one, none of the three exists, and the prose gives no rule for what to name instead. The walk picked two of the report's caveats by judgment (the provisional current month, and clicks read "(tracking unknown)" so a 0 may not be a real 0). This is the one place in the X0 walk where the prose made the tester guess.
Repro: walk X0 as written (`report <picks> --by-template --xlsx`, both internal domains and both unsubscribe links), reach step 6 with `reconciliation.closedMonthsOk: true`, `pull.carriedMonths: []` and internal domains given.
Expected: step 6 states what to name when none of the three applies: either a fixed fallback order over caveats every report can carry (e.g. a provisional period, then clicks of unknown tracking, then left-out deleted programs), or "name none: write `<N>` alone". Either is reproducible; the choice is the builder's.
Fix: 2026-10-04 (builder) — The choice moved from prose to the script (A-8): the report summary gains leadCaveats, one or two entries in a fixed order (reconciliation failure; a --name that matched nothing; carried-forward months; no internal domain; deleted programs left out; the provisional period, which every snapshot has, so the list is never empty). SKILL.md step 6 fills '<N> — <lead>' from caveatCount and leadCaveats and tells the reader not to pick others. Checks: test/engagement-report.mjs 'F-481' (the clean-pull case, and every placeholder of the final block has a rule), plus the order held on the unmatched-name, selective and failed-reconciliation arms; red with the order reversed (P4 KILLED pred:KILL).
Judge: two walks over one snapshot print the same Caveats line, and it equals the step-4 summary's leadCaveats joined with '; '
Pass bar (stated before measuring, from VALIDATION section ENG-3 / ENG-4, R3 as written): the walk's step-6 `Caveats:` line is `<caveatCount> — ` followed by the summary's `leadCaveats` entries, as written, joined with `; `; the tester chose nothing. Step 4 run again on the same snapshot (`--snapshot`, no pull): the second summary's `leadCaveats` equals the first's.
Verified: 2026-10-04 (tester, R3 @ hb-20261004-03, same checkout and canary as F-479's verdict) — RE-VERIFICATION. The walk's step-4 summary carried two `leadCaveats` (the deleted-programs entry, then the provisional-period entry, the Fix note's order); the step-6 line was built from `caveatCount` and those entries alone, joined with `; `, with nothing chosen: the step's new wording left no placeholder to judge. Step 4 run again over the same snapshot as the skill's `--snapshot` path runs it: exit 0; `leadCaveats` and `caveatCount` equal to the first summary's, compared by script. (The R2 run over the same snapshot gave the same list too.) VERIFIED.

## F-482 — VERIFIED
Reported: 2026-10-04 (builder, at the S2 close-out; observed by the tester in the re-verification round @ hb-20261004-03 and recorded there as "noticed, not a finding"; logged on Bradley's call so it is not lost)
Severity: polish — the time is early by the length of the plan step and the gap before the pull (minutes on the walks so far); no count is affected
What: scripts/engagement.mjs fixes a run's pull time when the run's working directory is created: resolveParams stamps `pulledAt` and main writes it to `run.json`, and a resumed run keeps it by design. The email-engagement skill runs `plan` first and then `run` with the same `--run`, so the snapshot's `meta.pulledAt`, every row's `pulledAt`, and the report's "Data pulled" line all carry the time the PLAN started, not the time the facts were read. A pull resumed after a new login (exit 3, then the same command) is stamped earlier still, by however long the login took. R4 asks every view for a clear "data last pulled" date and time.
Repro: `engagement.mjs plan --run r1 ...`, wait, then `engagement.mjs run --run r1 ... --out s.json`; compare `meta.pulledAt` in s.json with the first fact call's time in the run's `fetch-log.jsonl` order (or the wall clock). Observed: `pulledAt` is the plan's start.
Expected: the snapshot's pull time is when the facts were read: stamped when the fetch reaches the fact calls (Phase C), or at reduce from the run's own record, and kept across a resume only from that point. This touches what T-10's `meta.pulledAt` records, by minutes and not by type, so it is Bradley's to confirm when the fix is picked up. dev/VALIDATION.md X6 was tightened in the same commit: as first written it compared the report with `meta.pulledAt` itself and would have passed.
Fix: 2026-10-07 (builder, feat/jo-dash-s3b-health-batch, PR #43 unmerged) — Class, in one sentence: a record stamped when its container is made, not when the thing it records happens. `resolveParams` no longer stamps the clock (`pulledAt: null` unless `--pulled-at` is given); fetch stamps `pulledAt` and the zone (`stampClock`) when Phase C's first fact call is about to be made, writes them into `run.json`, and a resume keeps them; a plan alone stamps nothing, and `reduce` refuses a run that never reached its fact calls. The snapshot's `meta.pulledAt`, every row's `pulledAt`, a live schedule row's `asOf` and the report's "Data pulled" line all read that one stamp. Bradley's confirmation at pickup (the time moves by minutes, not by type): taken as the bus wrote it; no question asked.
Judge: the fetch log: the stamp must be at or before the first fact call's record and after the plan's own calls; the process check in test/engagement.mjs stops a run on the token after the plan's calls and resumes it, and holds the snapshot, run.json and every row to ONE stamp made before the first fact call. On a tenant: V2's Y16 (X6 of the ENG-3 section already compares the report's line with the fetch log's order).
Mutation copy-out — sweep (source: the decision points of this fix in scripts/engagement.mjs and scripts/engagement-query.mjs; a vacuity check on the committed checks, not closure); predictions written before the first run, the table from the sweep on the final code; suites = test/engagement.mjs + test/engagement-query.mjs + test/dashboard-page.mjs + test/contract-conformance.mjs:
    P9  KILLED pred:KILL
  As predicted.
Sibling sweep: batched — polish; the email-engagement skill's plan-then-run with one --run is the path this fixes and needs no prose change; `--pulled-at` still pins the clock for the suites.
Pass bar (stated before measuring, from the Judge line and VALIDATION Y16): Y1's plan and run were one `--run`; one stamp in the snapshot's `meta.pulledAt`, `run.json` and every row, at or after the plan's end and at or before the first fact call; the report's "Data pulled" line reads it.
Verified: 2026-10-07 (tester, S3b verdict round @ hb-20261007-02, feat/jo-dash-s3b-health-batch clean and level with origin at 1f85444, canary hb-20261007-02 in session; production tenant, reads only) — RE-VERIFICATION, the bar above. After the plan alone, `run.json` read `pulledAt: null` (a plan stamps nothing). After the run: ONE stamp in `meta.pulledAt`, `run.json`, all order-10^3 fact rows' `pulledAt`, every live schedule row's `asOf` and the report's "Data pulled" line (`engagement-report.mjs` over the snapshot). The stamp falls 12 s after the plan process ended and before the first fact call started (the fetch log carries no times, so each call's start is read as its call file's mtime less its own logged duration: the stamp sits under one second before the first Phase C call began). Pass.


## F-483 — VERIFIED
Reported: 2026-10-05 (tester, spot check @ hb-20261004-04 on feat/jo-dash-s4a-runtime; production tenant, reads only; met at VALIDATION section HLT-1 / DSH-1 / DSH-5, Y1)
Severity: polish — a pull planned before midnight and run after it is refused with a hint that does not apply; no data is wrong, no call is made, and `--today <the plan's date>` or a new `--run` recovers it
What: scripts/engagement.mjs writes `today` into a run's parameters when its directory is made (`run.json`), and the resume check compares every parameter but `pulledAt` and `timeZone`. `today` is read from the clock again on the next invocation, so once the date turns it differs, and `run` with the same `--run` and the same flags exits 1: "the run at … was started with different parameters — pass the same flags to resume it, or a new --run". The flags were the same. The email-engagement skill runs `plan` and then `run` with one `--run`, so a plan just before midnight and its run just after hits this; so would a resume after a token stop that crosses midnight. Same mechanism as F-482: the run directory fixes the run's clock at the plan's start, and not consistently (`pulledAt` is kept, `today` is re-read and compared).
Repro: `engagement.mjs plan --kb <slug> --run r <flags>` before midnight local time; after midnight `engagement.mjs run --kb <slug> --run r <the same flags> --out s.json`. Observed: exit 1, the message above, nothing fetched. Adding `--today <the plan's date>` resumes it (measured).
Expected: a resumed run keeps the day it was planned on, the way it keeps its pull time (or, at least, the refusal names the parameter that moved and the flag that restores it). Natural to fix with F-482, which already owns the run's clock and rides S3b.
Builder note: 2026-10-05 — rides S3b with F-482 (one mechanism: the run directory's clock). Not taken on feat/jo-dash-s4a-runtime, which is held for R1.
Fix: 2026-10-07 (builder, feat/jo-dash-s3b-health-batch, PR #43 unmerged) — Class, in one sentence: a parameter re-read from the environment on resume and compared as if it had been given. On resume, when `--today` is not given, the parameters are re-resolved with the run's own `today` (so the window, the incomplete-from day and a `--sent-since` date derive the same as at the plan) before the comparison; a `--today` given on purpose is still a different run. The refusal names the parameters that moved ("different parameters (today, window, incompleteFrom moved)") instead of "pass the same flags". One mechanism with F-482: the run directory's clock is the plan day plus the fact-call stamp, both kept.
Judge: the process check in test/engagement.mjs plans a run with --today one day, runs it with no --today on another (the real clock), and holds the snapshot's day to the plan's; and a --today given on purpose is refused naming the parameter. On a tenant: V2's Y16's second clause, when the round crosses midnight (as the spot check did).
Mutation copy-out — sweep (source: the decision points of this fix in scripts/engagement.mjs and scripts/engagement-query.mjs; a vacuity check on the committed checks, not closure); predictions written before the first run, the table from the sweep on the final code; suites = test/engagement.mjs + test/engagement-query.mjs + test/dashboard-page.mjs + test/contract-conformance.mjs:
    P9  KILLED pred:KILL
  As predicted (the stamp and the day are one mechanism; the day's own check is the process check above, red with the re-resolve removed — not swept, the mutation would also red F-482's).
Sibling sweep: batched — polish; the only other parameter the run re-reads from the environment is the zone, which was already excluded from the comparison.
Pass bar (stated before measuring, from the Judge line and VALIDATION Y16's second clause): a run planned on one day resumes on another with no `--today`, and the snapshot's day is the plan's; a `--today` given on purpose is refused naming the parameter.
Verified: 2026-10-07 (tester, S3b verdict round @ hb-20261007-02, feat/jo-dash-s3b-health-batch clean and level with origin at 1f85444, canary hb-20261007-02 in session; production tenant, reads only) — RE-VERIFICATION, the bar above. The round did not cross midnight, so the crossing was made on the code path a crossing takes: a narrow run (one program, no health) PLANNED with `--today` set to the day before (`run.json` today = that day, `pulledAt` null), then `run` with the same `--run` and NO `--today` on today's clock: exit 0, `ok: true`, reconciled, 36 calls; `run.json` kept the plan's day and gained the one stamp; the snapshot's day-derived fields (window, `incompleteFrom`) are the plan's. The same command with `--today` set to today was refused before any call: "was started with different parameters (today moved)", exit 1, no snapshot written, the fetch log unchanged. Pass. Blind spot: a real midnight was not crossed; the simulation differs from it only in what set the plan's day (a flag, not the clock).


## F-484 — OPEN
Reported: 2026-10-05 (tester, spot check @ hb-20261004-04 on feat/jo-dash-s4a-runtime; production tenant, reads only; VALIDATION section HLT-1 / DSH-1 / DSH-5, Y1 and Y3, and section DSH-2, Z1 and Z7)
Severity: normal — on a real tenant the health pull shows no participant failures at all, and the bounce reasons it does keep barely group, which puts the snapshot and the admin page several times over the page budget
What: health reasons are kept per distinct masked message, read as text rows. Class, in one sentence: failure text is stored at the grain of the text, and on a real tenant that grain is close to one row per failure. Two instances, one pull: (1) Participant failures: `ao_failed_participants` holds order 10^6 rows for the 194 selected programs; 190 programs have rows, one holds 89% of them, and 9 have more than one 5000-row page. The plain-row read (50 programs a call, halved on a full page) made 109 calls / 748 s and left those 9 units with nothing to split on, so the part is not read and its table is empty. Its reason reads `call-failed`; the run's status file records the nine as `truncated`. (2) Bounce reasons: 43,056 rows carrying 39,285 distinct masked messages over 115,324 bounced attempts (0.34 distinct messages per bounce; Y2 calls grouping working when this is far below 1). `facts.health` is order 18 of the snapshot's 18.5 MB, and the admin page with the Health tab on is order 8 MB, 98% of it data, over the 5 MB budget (Z7). The failed-participant reason itself is plain text, one sentence per cell (Y3), so the reader is not the problem; the grain is.
Repro: Y1 as run: `engagement.mjs plan --kb <slug> --run r --health <every internal domain and unsubscribe link>`, then `run` with the same flags and `--out s.json`. Count first, through the spike's runner: COUNT of `ao_failed_participants` with `AdvancedOutreachId IN <the selected programs>`, then the same grouped by `AdvancedOutreachId`. Then `dashboard-page.mjs --spec <a saved spec> --snapshot s.json --out-dir <dir>` and read the size report.
Expected: what Bradley already ruled for S3b (plan, HLT-1, "Failure reasons get CATEGORIES", 2026-10-04): a pattern list as data, counting moved server-side with one filtered count per pattern, "Other" as the total less the categories with a small masked sample, and the same list for bounce reasons; plus the part's reason naming a too-large part rather than a failed call. A falsifiable test of the class: over a fixture where most failures share one category with a distinct value in each, the stored health rows scale with the number of categories, not the number of failures. Contract note for the builder: if categories change what a `participantFailures` or `bounceReasons` row's `message` means, that is a T-10 question to put to Bradley first (contract freeze), not a tuning edit.
Builder note: 2026-10-05 — rides S3b, as the Expected says (the categories Bradley ruled on 2026-10-04). The contract question it raises (does a category change what a `message` row means) goes to R1 before S3b starts; so does the page-side question Z7 exposes: whether a page embeds health message tables at all or only their aggregates. Not taken on feat/jo-dash-s4a-runtime, which is held for R1.
Fix: 2026-10-07 (builder, feat/jo-dash-s3b-health-batch, PR #43 unmerged) — Class, in one sentence: failure text stored at the grain of the text. Counting moved server-side, as ruled at R1 (the contract question answered there: a category does not change what a row's count means). Bounce reasons: `health-bounce-total` and one `health-bounce-cat` per category (CONTAINS on `BouncedReason`, which the measurement at kickoff showed works in the grouped shape), grouped by program, template, month and type with the class twins; "Other" per key is the total less the categories (a negative remainder is an overlapping list: stored, flagged by `failure-categories-overlap`, never clamped); a capped masked sample of the uncategorised text (`health-bounce-sample`, one page, DOES_NOT_CONTAINS per pattern, never split) lands in a sixth table `facts.health.failureSamples`, which `pageSnapshot` empties (terminal only). A categorised row keeps `message` = the label and gains `category`; the Other row has `category: "other"`, the count and no message. Participant failures: the reason field takes no filter on CLI 1.0.10 (measured: CONTAINS, DOES_NOT_CONTAINS and STARTS_WITH refused; `rp schema` declares it not filterable), so the part is the ruled fallback — one grouped call (COUNT of rows, SUM of occurrences, per program, tenant-wide) and the capped sample — with `meta.health.categories.participantFailures` reading `counted: false, reason: not-filterable` and a caveat; no row read beyond one page. The shipped category table is EMPTY (`FAILURE_CATEGORIES`; V2's Y2 captures the product wordings); `--failure-categories <file>` and `--expected-reason <text>` are a tenant's inputs, validated as data (ids and patterns unique, patterns not inside one another, "other" reserved). The falsifiable test the finding asked for: over the fixture with three hundred more failed participants in one wording, the failure rows do not grow, and the bounce rows per key are at most the categories plus one. Typedef, pin and golden moved together; `schemaVersion` stays 1.
Judge: the health oracle in test/engagement.mjs spells every expected category row by hand from the fixture's bounce KINDS (a hand-written kind → category table, never the pattern list), including a bounce whose address the mask cannot see and the category cuts; and the reconciliation check `bounce-reasons-sum-to-bounced`, which holds categories plus Other to the send tables' bounced per program × month. On a tenant: V2's Y1 (the part read, the rows per program, the sum check) and Y2 (the capture, then a second pull whose category rows carry the labels and whose Other share is recorded).
Mutation copy-out — sweep (source: the decision points of this fix in scripts/engagement.mjs and scripts/engagement-query.mjs; a vacuity check on the committed checks, not closure); predictions written before the first run, the table from the sweep on the final code; suites = test/engagement.mjs + test/engagement-query.mjs + test/dashboard-page.mjs + test/contract-conformance.mjs:
    P5  KILLED pred:KILL
    P6  KILLED pred:KILL
    P13  KILLED pred:KILL
    P15  KILLED pred:KILL
    P17  KILLED pred:KILL
  All as predicted.
Sibling sweep: batched — normal; the other readers of a reason row named at R1 are S4b's health views and query path, the report's --health section and PUB-1's delta, none of which exists yet; the dashboard runtime's LACKS_LATER gained the new reason ids so its "every reason classified once" check holds.
Pass bar (stated before measuring, from the Judge line and VALIDATION section HLT-1 / DSH-1 / DSH-5 as re-banked at hb-20261007-02): Y1 — `participantFailures` IS read (one row per program, category other, participants and occurrences; `meta.health.categories.participantFailures` counted false, reason not-filterable); `bounceReasons` all category other with no message and the sum check ok; `failureSamples` at most five masked texts per program and part. Y2 — the masking search; Bradley reads `failureSamples`, the bounce samples AND the participant-failure samples per program; the capture into a `--failure-categories` file; a second pull with it whose category rows carry the labels, the Other share per program recorded, no Other row below zero.
Verdict: REOPENED 2026-10-07 (tester, S3b verdict round) @ hb-20261007-02. Under test: branch feat/jo-dash-s3b-health-batch (PR #43 to dev, unmerged), clean and level with origin at 1f85444; the dev-canary skill read hb-20261007-02 in session; production tenant, reads only.
Reopened: 2026-10-07 (tester @ hb-20261007-02, S3b verdict round) — first reopen. What passed, measured: Y1's part is read (one row per program for every selected program with failures, order 10^2 programs, order 10^6 participants; every row category other with participants and occurrences, no message; the categories entry counted false, not-filterable; the `participant-failures-no-breakdown` caveat present); `bounceReasons` all category other, no message, `bounce-reasons-sum-to-bounced` ok with 0 mismatches; the masking search found zero addresses, five-digit runs or IPv4 addresses in the snapshot rows and both sample payloads (the local-address pattern 0; "Invalid value" once, in the participant sample payload only, which never reached the snapshot); Bradley accepted a 30-category capture drawn verbatim from the masked bounce samples (no pattern carries a value; the plugin's validator clean; 82 of 98 distinct samples matched by exactly one pattern, case-insensitively too); the second pull with it was a full refresh saying the categories changed, every category row carries its label, no Other row below zero, no overlap caveat, the Other share per program median 30% (quartiles 18% and 50%, range 0 to 100%), the sum check ok again. What failed: the participant half of Y2. The fix's own fallback for participant failures is "one grouped call ... and the capped sample", and the sample is the FIRST PAGE OF A TENANT-WIDE READ — `health-reasons-sample` has no where clause at all, not even the selected programs. On this tenant all 2000 rows of that page belong to ONE program outside the selection, so `failureSamples` holds no participant-failure sample for any selected program: there was nothing for Bradley to read, no participant wording to capture, and no expected reason that could be named from the data. The bounce sample is the same shape with the window and the bounced flag as its only filters: one page covered 54 of the 156 programs with bounces at the second pull (42 at the first). Class, in one sentence: a sample taken as the first page of a tenant-wide read, so whichever program dominates the object fills it. A falsifiable test of the class: over a fixture where one program outside the selection holds more failure rows than a page, every selected program with failures gets a sample (or the snapshot says which did not, and why). Severity unchanged (normal): the sample is what a user extends the category list from, and for participant failures it is the ONLY view of the text the breakdown cannot give.
Fix: 2026-10-07 (builder, second fix after one reopen, feat/jo-dash-s3b-health-batch, PR #43 unmerged) — Class, in one sentence: a sample taken as the first page of a tenant-wide read, so whichever program dominates the object fills it. A sample is now read PER PROGRAM: for every selected program with refusals in the window (the exact per-month count `health-entry-month`, a new count-first read) one small page (`SAMPLE_PAGE` 100) of that program alone (`AdvancedOutreachId IN [id]`, the day window on `ModifiedAt`, `--order-by` ModifiedAt DESC — measured 2026-10-07 to work), most refusals first, at most `--sample-programs` (`SAMPLE_PROGRAM_CAP` 25) a pull; the bounce text the same way per program with uncategorised bounces. A program whose window counts equal the previous snapshot's keeps that snapshot's sample at no call (a selective refresh only); the programs the cap left out are named in `meta.health.samples[part].notSampled` with a `failure-samples-capped` caveat that prices reading them, and `plan` prints `estimate.health.samples` (withFailures, planned, carried, beyondCap, secondsBeyondCap) so raising the cap is an informed choice (Bradley, 2026-10-07: "they just need to know the time cost"). Each page is read whole for the sampled split by category (`entrySamples`, labelled a SAMPLE; the shipped expected list is the eight product wordings measured that day), and `failureSamples` keeps the five most frequent texts per program with category, expected, count and pulledAt. The picks are a pure function (`sampleTargets`) fetch and reduce both run over the same counts, so nothing about the choice is stored. Sibling case the tester did not list: a program whose uncategorised bounces fall only in a CARRIED month of a selective refresh — its sample is carried, not dropped (found and fixed by the suite). The tester's falsifiable test is the committed check "F-484 (reopened) class test" (the draft program holds three pages of refusals; every selected program still gets its own sample, the draft none, every sample call names one program).
Judge: the fixture oracle (the sampled split per program equals a straight count of the fixture's refusals in the day window by the category the oracle assigns their kind, written by hand) and the stand-in's `--order-by`; on a tenant, Y2 as re-banked (every selected program with refusals has a sample or is named; Bradley reads the split).
Mutation copy-out — sweep (source: the decision points of this second fix in scripts/engagement.mjs; a vacuity check on the committed checks, not closure); predictions written to a scratch file before the first run, four of the round's eight mutants, run over test/engagement.mjs one mutant at a time:
    M3 sampleTargets: the cap cuts at cap → cap + 1  KILLED pred:KILL
    M4 sampleTargets: carried when the counts are equal → when they differ  KILLED pred:KILL
    M5 the sample query drops the one-program IN filter (a tenant-wide page again)  KILLED pred:KILL (the outsider check)
    M7 matchCategory case-folded → case-sensitive  KILLED pred:KILL
  All as predicted.
Sibling sweep: batched — normal; the other readers of a sample row (S4b's health views, the report's --health section) do not exist yet; the page suite proves no sample text reaches a page.
Pass bar (stated before measuring, from the Judge line, VALIDATION Y2 as re-banked at hb-20261007-03 and the kickoff): every selected program with refusals in the window has its own sample (one program per IN filter, `--order-by` ModifiedAt DESC, the day window) or is named under `meta.health.samples.participantFailures.notSampled` with reason cap; the plan prints withFailures / planned / beyondCap / secondsBeyondCap; a run at `--sample-programs 1` names the rest.
Verdict: REOPENED 2026-10-08 (tester, S3b fix-round verdict, V2) @ hb-20261007-03. Under test: feat/jo-dash-s3b-health-batch (PR #43 to dev, unmerged), clean and level with origin at 244b0dc; the dev-canary skill read hb-20261007-03 in session; plugin loaded from the working tree; production tenant, reads only, one gs-admin call at a time.
Reopened: 2026-10-08 (tester @ hb-20261007-03, S3b fix-round verdict) — SECOND reopen. What passed, measured: the plan printed `estimate.health.samples` (participant failures: withFailures order 10^2, planned 25, carried 0, beyondCap order 10^2, secondsBeyondCap order 10^3; the bounce twin the same shape); every sample call in the fetch log names ONE program and one day window, none outside the selection (25 + 25 calls); `notSampled` names every program the cap left out with reason cap; `failureSamples` holds at most five rows per program and part; a three-program run at `--sample-programs 1` sampled one and named the other two with reason cap, the `failure-samples-capped` caveat pricing them at 8 s each. What failed: the picks and the read use TWO windows. `sampleTargets` ranks programs by refusals over the MONTH window (the 13-month `health-entry-month` counts) and each sample page reads only the DAY window (the last 90 days). 10 of the 25 participant picks had every refusal in months before the day window, so their pages came back with 0 rows: no sample, not named in `notSampled`, still counted in `meta.health.samples.participantFailures.sampled: 25`, and each spent a cap slot ahead of programs whose refusals ARE in the day window (one of those, on the Working-as-expected list, holds a null-address refusal Bradley found in the UI and the pull never read). The bounce sample is the same: 17 of 25 picks empty, each with its uncategorised bounces only in months before the day window. Class, in one sentence: the sample's targets are chosen from one window and read from another, so a pick can return nothing and still count as sampled. A falsifiable test of the class: over a fixture where a program's refusals all fall inside the month window but before the day window, that program is never counted as sampled (it is not picked, or it is named with its reason), and every cap slot spent returns rows. Measured beside the bar, for the redesign rather than as a separate finding: a 100-newest page cannot see the wording that dominates order 10^6 refusals on one program (Bradley read a null-address wording, `Custom field contains Invalid value {null} for EMAIL data type`, as dominant in the UI; none of the 100 sampled rows carried it, and the shipped list matches only the `Recipient Email Address field` variant). Rule 5: reopened twice, so a third fix needs a `Redesign:` line naming the model replaced; the per-program sample is also a mechanism born this release in its second round of findings (the valve: redesign once, or DEFERRED past the version being cut, with a reopen trigger) — the builder's and Bradley's call, not the tester's. Severity unchanged (normal).


## F-485 — FIXED
Reported: 2026-10-05 (tester, spot check @ hb-20261004-04 on feat/jo-dash-s4a-runtime; no gs-admin call; VALIDATION section DSH-2, Z1 and Z7)
Severity: polish — the page is built correctly; the size report and its warning mislead whoever decides how to make a page smaller
What: scripts/dashboard-page.mjs `buildPage` fills the report's `rows` from the members of `facts` that are packed tables at the top level (`typeof t?.n === "number"`), so the five health tables, which sit one level down under `facts.health`, never appear. On the admin page over Y1's snapshot they are nearly all of 8 MB, and the report lists four small tables. The warning is fixed text, "Narrow the programs or the window, or turn customer lists off": on that page customer lists are already off and the Health tab, whose data makes the size, is not named.
Repro: `dashboard-page.mjs --spec <a saved spec with the admin page's Health tab on> --snapshot <a --health snapshot> --out-dir <dir>`; read `pages[0].rows` and `pages[0].warning` in the printed summary.
Expected: the size report counts every packed table the page embeds, the health five included (the As-shipped note says each is packed), and the warning names what is actually large, from that same report.
Fix: 2026-10-05 (builder, on feat/jo-dash-s4a-runtime) — Class, in one sentence: the size report read the top level of `facts` as the whole, when a packed table can sit one level down. `buildPage` now walks every member of the page's embedded `facts` at any depth and records each packed table's rows AND bytes (`report.tables`, with `report.rows` kept as the flat view: `health.bounceReasons` and its four siblings included). The warning and the refusal are built from that same report: they name the two largest tables with their megabytes, and the remedy follows from where the bytes are (a `health.*` table largest → "The Health tab's data makes the size: turn the tab off for this page, or narrow the programs or the window"; `byAccount` largest → customer lists; else narrow the programs or the window). No fixed text names a setting that is already off. Sibling case not in the report: a page large for a reason that is neither health nor accounts (the oversized generated fixture, byTemplate) now gets the narrow-the-window remedy alone. Folded into 0.47.0's CHANGELOG entry (unreleased).
Judge: the report against the page's own bytes — every packed table under `facts`, counted by walking the embedded data independently of the builder's list (the suite reads the real snapshot's `facts.health` lengths and holds `rows` to them); the warning text is judged against which table the independent byte count ranks largest.
Sibling sweep: batched — polish; the only other size-report consumer is the CLI's stderr line, which prints the same string.
Pass bar (for the verdict): `dashboard-page.mjs` over a `--health` snapshot: `pages[0].rows` lists the five health tables with their row counts and `pages[0].tables` their bytes; on the page Z7 measured (order 8 MB, health-heavy) the warning names `health.bounceReasons` with its megabytes and the Health-tab remedy, and does not mention customer lists.

## F-486 — OPEN
Reported: 2026-10-05 (tester, spot check @ hb-20261004-04 on feat/jo-dash-s4a-runtime; no gs-admin call; VALIDATION section DSH-2, Z1)
Severity: polish — reachable only until S4b and S4c give those tabs panels and data; no page reaches a user before the release
What: a tab that is on draws its panels and nothing else. When no panel sits on it (the interim default panel is on Engagement only, Z0 choice 6), or its data is something no pull holds yet (Templates: `TAB_DATA_HELD` says never, and the admin preset turns the tab on), the pane is a bare heading: no table, no statement, no line to copy. On both real admin pages, the Health and Templates tabs open to that, before and after the script runs (measured in a browser engine). Bradley's DSH-2 ruling of 2026-10-04 reads "anything the page cannot do itself says so at the spot where the data would be … Never an empty table, a zero, or a control that does nothing." It also makes Z1's second half unmeasurable on a default page: with a send-failures panel added, the same runtime draws the `measure-not-in-snapshot` notice and the refresh line, and no zero.
Repro: build any spec's admin page with the presets' panels (`panels: []`); open the Health or Templates tab.
Expected: an on tab with nothing to draw goes through the lacks plumbing like an offered one (Templates: its not-held lack; no panel: a statement), or the default panels cover every on tab and a check refuses an on tab with none. Either is the builder's call.
Builder note: 2026-10-05 — rides S4b (DSH-4), which decides what every tab shows; the Templates on-state before TPL-1 is S4c's. The interim content was confirmed at Z0 "until S4b". Not taken on feat/jo-dash-s4a-runtime, which is held for R1.

## F-488 — VERIFIED
Reported: 2026-10-06 (tester, F-487 third verdict round @ hb-20261006-03 on feat/f487-power-list-sources; production KB on a scratch copy, no gs-admin call; VALIDATION section F-487, P13)
Severity: polish — what ships is honest (the tenant-wide report says programs are missing, how many, why, and the remedy); only the detail of which program is absent
What: deps-report's (tenant-deps.mjs ~1945–1960) caveat for a referenced Power List rule whose KB doc is unreadable names the rule id and a per-rule program COUNT ("(1 program(s))") but not the referencing programs, and words the consequence as "an --object or --connection search cannot reach them through that source" rather than the JO surface's "their absence from the tables above is not evidence". email-report deps (jo-report-deps.mjs ~2213–2230) names each referencing program by name and id and carries that clause. The aggregate is deliberate ("one aggregate caveat per state, never one line per program on a tenant-wide scan"), so a reader of the tenant-wide report can tell a program is missing from the tables but not which one without running email-report deps for the same term. Ruled bar overreach on F-487 by Bradley; logged here as an improvement, not a defect of that fix.
Repro: on a scratch copy of a KB with Power List rule docs, move one referenced rule's doc out of rules-engine/ (leave the manifest entry); run `node .gs-superadmin/plugin/scripts/tenant-deps.mjs --kb <copy> --object '<any object>' --report <dir>` and `jo-report.mjs deps … --object '<same>' --kb <copy> --all`; compare the two "no readable KB doc" caveats.
Expected: the builder reviews and checks with Bradley whether to take it in the next substantive round or defer it. If taken: the tenant-wide caveat names each unresolved rule's referencing programs (name and id), capped, with the cap stated in the caveat (hundreds of programs can share a few dozen lists), and states that their absence from the tables is not evidence — the same facts as the JO surface, from the same scan. Under F-487's rule-5 state, this is the "next change to the Power List identity/caveat readers": the change itself is the fourth touch of that mechanism, so the builder's review should say how it is judged.
Fix: 2026-10-07 (builder, feat/jo-dash-s3b-health-batch; taken this round per Bradley's 2026-10-07 disposition that it rides the dashboards round) — Class, in one sentence: the tenant-wide caveat aggregated away the one fact the per-program surface states. tenant-deps.mjs keeps the program names it meets while scanning (`journeyNames`) and the aggregate caveat now names each unresolved rule's referencing programs by name and id, capped at 10 per rule with the cap stated ("… N more"), and carries the "their absence from the tables above is not evidence" clause — the same facts as email-report deps, from the same scan. Caveat text only; no identity reader touched, so rule 5's mechanism is not tuned.
Judge: a differential against the JO surface — the e2e check reads the program named in the tenant-wide caveat and holds it to the program email-report deps names for the same rule (the fixture's one orphan-list program).
Sibling sweep: batched — polish; the one other aggregate caveat of that block (objects not canonicalized) names no program by design.
Pass bar (stated before measuring, from the Judge line and the kickoff): for the same unresolved Power List rule, the tenant-wide deps caveat and email-report deps name the same programs.
Verified: 2026-10-08 (tester, S3b fix-round verdict, V2 @ hb-20261007-03, feat/jo-dash-s3b-health-batch at 244b0dc, canary hb-20261007-03 in session; no gs-admin call) — RE-VERIFICATION, the bar above. On a scratch copy of the KB with one referenced Power List rule's doc moved out (manifest entry kept): `tenant-deps.mjs --object <an object>` and `jo-report.mjs deps --object <same> --all` (its index built over the previous day's captured program-list pages, not a fresh sweep: the round's pull held the one call slot) both name the one referencing program by name and id, and both carry "their absence from the tables above is not evidence". The 10-per-rule cap is unexercised (one program per rule on this tenant).

## F-489 — VERIFIED
Reported: 2026-10-07 (builder, release-gate review of the F-487 payload — step R of the hotfix-0.43.4 plan — on feat/f487-power-list-sources at fcb16c8: `/code-review medium` over `origin/dev...feat/f487-power-list-sources`, one finding, this one; `/security-review` over the same diff, no findings — filenames pass docBaseName, shell hints pass sq, the describe is spawned as an argv array)
Severity: polish — the failure is loud (describe-batch exits 1 naming the missing flag) and cannot be reached from a workspace set up normally (setup indexes every domain and records each describe command at index time); only the remedy sentence is missing from the skill
What: refresh step 3b-3 (plugins/gs-superadmin/skills/refresh/SKILL.md, "the domain's recorded `re r describe --id {id}` is the default command") assumes the rules domain carries a recorded describeCommand. describe-batch.mjs requires `--command` for a domain with no recording ("Domains with no recording require --command, as before"), and the step gives no fallback — so on such a workspace step 3b-2 registers the Power List rules (upsert-batch --partial warns on the unlisted domain) and step 3b-3 refuses, the refresh stops there, and the "Power Lists:" report line is never reached. The deps reports on that workspace then name every referenced rule as unreadable with the refresh remedy, which sends the operator back into the same refusal. setup's Power List paragraph defers to refresh 3b and inherits the gap.
Repro: a workspace whose manifest has no `domains_indexed.<rules-domain>.describeCommand` (a legacy manifest, or one indexed for the journey domain only) with at least one documented program on a QUERY_BUILDER source. Run refresh step 3b-1 and 3b-2, then `node .gs-superadmin/plugin/scripts/describe-batch.mjs --manifest <slug>/_manifest.json --domain <rules-domain> --out-dir <slug>/<rules-domain> --keys-file .gs-superadmin/tmp/pl-gap-keys.json --limit 10` — exit 1, stderr names `--command`.
Expected: step 3b-3 states the fallback: when the rules domain has no recorded describe command (describe-batch refuses naming `--command`), re-run the same invocation with `--command "gs-admin --json re r describe --id {id}"`; setup's Power List paragraph points at that sentence. Disposition (Bradley, 2026-10-07): polish, not taken in hotfix 0.43.4 — rides the next substantive round (the JO-dashboards round) beside F-488.
Fix: 2026-10-07 (builder, feat/jo-dash-s3b-health-batch) — Class, in one sentence: a step that assumed a recording the workspace may not have. refresh SKILL.md step 3b-3 now states the fallback as the Expected spells it, and setup's Power List paragraph says the fallback is the same. Prose only (the script's refusal already names the flag).
Judge: the tester's walk of refresh step 3b on a workspace whose manifest lacks the rules domain's describe command (V2; no suite reads skill prose).
Sibling sweep: batched — polish; describe-batch's other callers (setup Phase 5) pass the recorded command and refuse the same way.
Pass bar (stated before measuring, from the Judge line and the kickoff): refresh step 3b-3 executed once for real on a workspace whose manifest lacks the rules domain's describe command: describe-batch refuses naming `--command`, and the step's fallback documents the rule; setup's Power List paragraph points at the fallback.
Verified: 2026-10-08 (tester, S3b fix-round verdict, V2 @ hb-20261007-03, feat/jo-dash-s3b-health-batch at 244b0dc, canary hb-20261007-03 in session; production tenant, reads only, one describe) — RE-VERIFICATION and the round's walk of the changed prose. Refresh step 3b executed by the tester, step by step as written, on a scratch copy of the KB with the rules domain's `describeCommand` deleted from the manifest and one referenced rule's doc moved out: 3b-1 `power-list-gaps.mjs` redoc 1, unreadable 1; 3b-2 missing 0 (no upsert), `mark --status stale` marked 1; 3b-3 as written: describe-batch refused, exit 1, naming `--command`; the step's fallback re-run verbatim with `--command "gs-admin --json re r describe --id {id}"`: exit 0, `commandSource: explicit`, 1 documented, 0 failed, `moreRemaining: false`; 3b-1 again: unreadable 0. Setup's Power List paragraph reads "and the same `--command` fallback when the rules domain has no recorded describe". Both skills are slash-only (`disable-model-invocation`): the changed steps were executed on the scratch workspace as the kickoff asked; neither skill was run end to end.

## F-490 — VERIFIED
Reported: 2026-10-07 (builder, /introspect after the 0.43.4 hotfix housekeeping)
Severity: polish — dev-only release tooling text; what ships is unaffected
What: dev/RELEASE-CHECKLIST.md § 6 ("Post-release housekeeping") lists "Ledgers that track this program: handoff plan session ledger line (if a program is in flight) and the project-memory chronicle tail". No "chronicle" exists: not under handoffs/ (the handoff-plan session ledger does, and got its line), and not in the project memory directory. The 0.43.4 close-out recorded it as "none found". The line is either stale (a file that was retired) or names a home the checklist never spelled out, so each release re-discovers that it cannot be done.
Repro: `grep -rli chronicle handoffs/ ~/.claude/projects/<this repo's memory dir>/` returns nothing; the checklist line stays unfillable.
Expected: the maintainer names the chronicle's home (and the checklist line says the path) or the clause is removed, leaving the session-ledger half. One-line edit on dev; rides the next substantive round's polish batch with F-488 and F-489.
Fix: 2026-10-07 (builder, feat/jo-dash-s3b-health-batch) — the clause is removed (no chronicle exists; the checklist line says so), leaving the session-ledger half. Dev-only text.
Judge: the next release's § 6 walk fills the line without re-discovering an unfillable clause.
Sibling sweep: batched — polish; no other checklist line names a file that does not exist (grep of the checklist's paths).
Pass bar (stated before measuring, from the Judge line and the kickoff): RELEASE-CHECKLIST § 6 carries no chronicle clause to fill.
Verified: 2026-10-08 (tester, S3b fix-round verdict, V2 @ hb-20261007-03, feat/jo-dash-s3b-health-batch at 244b0dc; prose read) — § 6's ledger line names only the handoff plan's session ledger; the chronicle clause is replaced by a note that it was removed (F-490). No unfillable clause remains.

## F-491 — OPEN
Reported: 2026-10-07 (tester, S3b verdict round @ hb-20261007-02 on feat/jo-dash-s3b-health-batch; production tenant, reads only; VALIDATION section HLT-1 / DSH-1 / DSH-5, Y6 as re-banked)
Severity: normal — on a real tenant every alarm list the silent rules produce reads false to the admin: every live read says "Schedule run failed" for schedules that run daily as expected, and finished one-off campaigns read "No recent sends"
What: the cadence-aware silent rules (HLT-1, S3b: `judgeSilence`, the capped live `jo p describe` read, `silentPrograms(...).lists`) read a program's SCHEDULE as its SEND cadence and a DEFAULT as a run result. Class, in one sentence: the rules infer when a program should send, and whether its last run failed, from schedule metadata that on this tenant describes participant ingest and carries no run result. Instances, one pull (Y1's snapshot at 30 days): (1) "Schedule run failed" holds all 25 programs read live (the cap; 31 flagged): on every live-read schedule `lastRunSuccess` is false while `lastSuccessTime`, `lastFailureTime` and `failingSince` are all 0 — no run result is recorded at all, and false is the default; the KB rows never read true either (order 10^2 false, order 10^1 null). Bradley checked two in the Gainsight UI: each runs daily as expected; its recent participants failed only because they were already in the program — "not what I would describe as failing". (2) Two of the 25 have a schedule whose end time passed 78 days ago, and read "Schedule run failed" (Y6's bar: an ended schedule must not read as broken). (3) The schedules are almost all daily (`1/1`) participant-ingest crons: a run that admits nobody sends nothing, and the rule expects a send after every due day, so "Possible silent failure" lists a program that the settled picks record as sending once a month on the 1st, six days after its send; a program Bradley says runs monthly by design but takes participants quarterly is judged monthly. (4) "No recent sends" lists three programs that Bradley reads as finished one-off campaigns left Active; the "One-time and ad-hoc programs" list is empty, so the rule has no way to tell a finished campaign from a late one. Measured besides: a direct program x day read of the last 90 days for two programs on the run-failed list matches the snapshot's last send day and shows no later send — the last-send data is right; the lists' labels are wrong.
Repro: Y1 as run (`engagement.mjs plan`, then `run`, `--health --kb <slug>` and the round's inputs); `silentPrograms(snapshot, {days: 30}).lists` from engagement-query.mjs over the snapshot (a node one-liner); in the run directory, parse each `schedule-describe` payload's `data.advancedOutreach.participantSourceConfigurations[].scheduleInfo` (a JSON string) and read `schedules[]`: `lastRunSuccess`, `lastSuccessTime`, `lastFailureTime`, `failingSince`, `startTime`, `endTime`.
Expected: a run result is read only where one is recorded (`lastRunSuccess` false with every run time 0 is "no run result recorded", never "failed"), and a schedule past its end time reads ended; send silence is judged against what the program actually sends, not against the ingest cron. Two reads from this round the redesign can use, shapes only: the describe's schedule objects carry `startTime` and `endTime` (epoch-millisecond numbers) and the run-state fields above; `ao_participant_source_configuration` is reportable tenant-wide and holds `LastSyncedOn` (DATETIME) per participant source, with `AdvancedOutreachId` (STRING), `GsAdvancedOutreachId` (LOOKUP), `ParticipantSourceType` (STRING) and `ActiveVersion` (BOOLEAN) — evidence that an ingest ran, independent of sends (no success or failure field; `participant_criteria_step_execution` was read too and holds branch evaluations, not runs). Which signal decides "stopped working" is Bradley's ruling (the HLT-1 ruling 3 this implements) before a fix; the falsifiable test is his read of each list on the next pull.
Redesign: 2026-10-07 (builder, with Bradley in session as the data expert; the model replaced: "a program's schedule is its send cadence and a default is a run result" — the cadence-aware rules of HLT-1 ruling 3 of 2026-10-04, with the capped live describe read). Ruled first (the plan, HLT-1, "Rulings (Bradley, 2026-10-07)"): "stopped working" is four conditions, each read from its own data, never inferred from the schedule — the schedule ended or its sync is disabled; it runs but admits nobody; the only participants arriving are refused for a reason NOT expected by design; the program errors (a participant who got in falls off at a step). Measured before building (production, reads only, the shapes in dev/S3B-FIX-ROUND-BRIEF.md): the sources object holds `LastSyncedOn` on every Active program (the heartbeat: 27 of 64 synced within a day), the schedule run-state fields are unset even on a program that synced that day, `ao_participants` carries `CreatedAt`/`ModifiedAt` and a filterable step-failure reason, the refusal object's `ModifiedAt` moves when the same key is refused again, stale programs have NO schedule (synced once at creation), REVIEW participants sit on drafts, and the server's CONTAINS is case-insensitive.
Fix: 2026-10-07 (builder, feat/jo-dash-s3b-health-batch, PR #43 unmerged) — Class, in one sentence: the rules inferred when a program should send, and whether its last run failed, from schedule metadata that describes participant ingest and carries no run result. Replaced by `programHealth` (alias `silentPrograms`; `judgeHealth` over plain inputs) in engagement-query.mjs: six signals per program, each from its own table with a "cannot tell" state where the table was not read — schedule (recurring, ended by its end date, not started, one-time, none, disabled by the list's flag), ingest (the newest active source's last sync against the cron's last due day: on-schedule, overdue, never-synced, cannot-judge, cadence-unreadable, stopped, one-time), admissions (participants created over the last `--quiet-due-days` due days, default 5; too few due days in the window is never an alarm), entry (exact refusals over the window with the sampled split by the shipped expected list), steps (step failures counted server-side by category per month — a step's action failed, the platform error state, a bounce drop and a record delete, the last two expected), sends (the program's OWN history for every program; the ingest cron says nothing about sends), and finished (a one-off with no participant ACTIVE or PAUSED). ONE list per program by precedence (`HEALTH_LISTS`): schedule-ended, sync-disabled, ingest-overdue, failing-entries, admitting-nobody, step-errors, finished, no-recent-sends, no-sends-in-window, cannot-judge, ok. The four instances the tester listed: (1) no run result is ever read from the schedule fields; (2) an ended schedule reads ended; (3) the monthly sender on a daily cron reads ok by its history; (4) finished campaigns left Active read finished when nothing is in flight. New tables `sources`, `admissions`, `entryFailures`, `stepFailures`, `entrySamples` (additive; typedef, pin and goldens moved together; `schemaVersion` 1); the live `jo p describe` reads are RETIRED (`HEALTH_DESCRIBE_CAP` gone; a run that logged them still reduces). Cost on the measured tenant: four tenant-wide calls plus the per-program samples against 25 describes retired.
Judge: Bradley's read of each list on the next pull (Y6 as re-banked) and the signals tenant in the fixture — one program per list, each list's cause written by hand (an ended schedule, a disabled flag, a sync older than the last due day, zero admissions over five due days with expected refusals, the same with the unexpected null-address refusal, a CTA-step failure and a platform error this month, a one-off with every participant completed); Y17 holds the heartbeat to the UI's last run; Y18 holds the step categories to direct counts.
Mutation copy-out — sweep (source: the decision points of the redesign in scripts/engagement-query.mjs; a vacuity check on the committed checks, not closure); predictions written to a scratch file before the first run, the other four of the round's eight mutants, run over test/engagement.mjs one mutant at a time:
    M1 judgeHealth: on-schedule when synced ON the due day (>=) → strict (>)  KILLED pred:KILL
    M2 judgeHealth: a schedule has ended when its end day is before as-of → after  KILLED pred:KILL
    M6 judgeHealth: failing-entries fires on an unexpected refusal → on expected-only  KILLED pred:KILL
    M8 provisionalSpan: the flags-from day clamped to the incomplete-from day → never clamped  SURVIVED pred:SURVIVE (no committed check has the re-pull horizon later than the incomplete-from day; a vacuity to note for V2's read of a 1-month re-pull, not a defect)
  All as predicted (7 killed, 1 predicted survivor).
Sibling sweep: batched — normal; the other readers of the lists (S4b's health views, the report's --health section) do not exist yet; the two names S4b's plan reads by (`silentPrograms`, `SILENT_LISTS`) still resolve.
Pass bar (stated before measuring, from the Judge line and VALIDATION Y6 as re-banked at hb-20261007-03): `programHealth(snapshot).lists` over the round's pull; every list reads true to Bradley; counts per list; the signals of two programs per alarm list; Bradley's read of the Gainsight UI for one program per alarm list, recorded verbatim; a second read with `--quiet-due-days 2` moves the admitting-nobody line as expected.
Verdict: REOPENED 2026-10-08 (tester, S3b fix-round verdict, V2) @ hb-20261007-03. Under test: feat/jo-dash-s3b-health-batch (PR #43, unmerged), clean and level with origin at 244b0dc; canary hb-20261007-03 in session; production tenant, reads only. The section carries a `Redesign:` line, so this reopen is of the model, not a tune.
Reopened: 2026-10-08 (tester @ hb-20261007-03, S3b fix-round verdict) — first reopen since the Redesign. Counts, order 10^1 Active programs judged: schedule-ended order 10^1 (35), sync-disabled 0, ingest-overdue 0, failing-entries 0, admitting-nobody 1, step-errors 6, no-recent-sends 2, finished order 10^1 (10), no-sends-in-window 0, cannot-judge 0, ok order 10^1 (11). Read TRUE by Bradley: admitting-nobody ("this does read true - in this case i know why no one is getting in. we stopped bringing in this customer type into the system. so it makes sense, and good to flag in either case, maybe i didn't know that"); finished, all of it ("those all look one and done yes"); ok, all of it (one program's newest refusal is a null address the sample cap left unread: F-484); no-recent-sends 1 of 2 ("it does look like [that program] is broken somehow. so that tracks"); schedule-ended 20 of 35 (every schedule the program carries has ended; "if the schedule was over, i would aggree"). Read FALSE: (1) schedule-ended 15 of 35. Each carries TWO schedule objects on one daily cron: the participant sync (`jobType` ADVANCED_OUTREACH_BIONIC_QUERY) ending years ahead, and a job schedule (ADVANCED_OUTREACH_SCHEDULE, a ONE-TIME job context) that ended years ago. `pickSchedule` (engagement.mjs ~2420) keeps the shortest-period recurring schedule and breaks the tie by position, so it reads the ended job schedule; the schedule signal then outranks the program's own heartbeat (ingest reads `stopped` on a source that synced that morning; 15 of the 35 sent within 30 days). Bradley's UI read of one: "Scheduled to sync from 5th May 2025 to 6th May 2030 at 9:30 am America/Los_Angeles Daily ... I saw it last run this morning at 9:30am pacific more or less. if the schedule was over, i would aggree, but this one is still going"; a live `jo p describe` the same day shows its participant source carrying ONLY the participant-sync schedule (ending 2030) and a `lastSyncedOn` that morning, so the KB doc (as of 2026-09-10) holds the job schedule besides, and the reader chose it. (2) step-errors 6 of 6. Each is on the list only through Send Email delivery drops the shipped step list does not name (`Email is Reject, participant is dropped from process at step 'Send Email'`; `Sending email failed with errors Email Failed: Recipient on Gainsight bounce list at step Send Email`; `... Recipient has opted out at step Send Email`), read by a direct `rp run` of one program's uncategorised step text (order 10^2 rows, all DROP). Bradley ruled the model in session (2026-10-08): THREE kinds, not two — business rules (already in list, unique criteria, advanced criteria, unsubscribed, Global Opt Out, the Send Email opt-out; "i do agree record delete is a business rule, if an odd one"), bad-address errors ("bounced is merely an 'expected' error, in the sense that if their email is bad we would expect it to bounce. again, it's not the same as 'participant with unique criteria exists' type thing"; "how does someone get on a bounce list? by their email bouncing right? aren't those basically the same?"; bounce, bounce list, reject, `Bounced recipient(to) email ... in Step 'Send Email'` and the null or invalid address wordings: "yes, they should be in type 2"), and program errors (a step's action failed; platform error). The shipped `expected` boolean holds two kinds: `bounce-drop` (the builder's choice) and `bounce-list` (ruling 2 of 2026-10-07) sit with the business rules, and reject and the Send Email twins fall to "other", which the list reads as a program error. The same gap misreads the entry split: `Bounced recipient(to) email ... in Step 'Send Email'` (the shipped list carries its GlobalOptOut twin only) splits as unexpected. (3) no-recent-sends 1 of 2: a monthly-cron program whose intake is quarterly by design ("the quarterly one runs monthly, but it will only every have participants on a quarterly basis"); at `--quiet-due-days 2` the same program moves to admitting-nobody (the list grows 1 -> 2, the expected direction, onto a false read). Class, in one sentence: the signals still decide a program's state from metadata that does not hold the fact — the schedule object a picker happens to choose, a two-valued expected flag over three kinds of failure, and a send cadence assumed from the cron — instead of the participant sync's own schedule and heartbeat, Bradley's three kinds, and the program's intake. A falsifiable test of the class: over this round's snapshot, no program whose participant-sync schedule is live and whose source synced inside its period reads schedule-ended, and no program reaches an error list through bad-address wordings alone. Severity unchanged (normal).

## F-492 — OPEN
Reported: 2026-10-07 (tester, S3b verdict round @ hb-20261007-02 on feat/jo-dash-s3b-health-batch; production tenant, reads only; VALIDATION Y2)
Severity: polish — what reaches a page is unaffected (`pageSnapshot` empties the samples and the categories cut the counted rows); the gap is in the terminal-only sample text the snapshot file keeps
What: the message mask leaves two kinds of value in `facts.health.failureSamples`. (1) A mail gateway's bracketed message id is masked to `<id>` when it is alphanumeric, but not when it contains `-` or `_`: in one page of bounce samples, three such ids came through verbatim beside order-10^1 siblings that read `<id>`. (2) Recipient mail-server host names are kept (an organisation's mail host, a relaying server's domain), which names the recipient's organisation. Class, in one sentence: the id rule's character class is narrower than the ids the gateways write, and host names are not a masked kind. The masking search Y2 runs (addresses, five-digit runs, IPv4) cannot see either, so both passed it.
Repro: Y1's snapshot; group `facts.health.failureSamples` by message and read the bracketed tails of the gateway-blocked rows (a bracket holding a mixed-case token with `-` or `_` and a short region suffix), and the rejections whose text begins with a host name.
Expected: the id rule masks a token with `-` and `_` the way it masks an alphanumeric one; whether host names are masked (to `<host>`) or left for the categories to cut is the builder's call with Bradley (ruling 5 chose categories over a wider mask for local addresses). A fixture row of each kind pins it.
Fix: 2026-10-07 (builder, feat/jo-dash-s3b-health-batch) — Class, in one sentence: the id rule's character class was narrower than the ids the gateways write, and host names were not a masked kind. The token rule's class is now letters, digits, `-`, `_`, `.`, `+`, `/`, `=` (12 or more, a letter and a digit, bounded by look-arounds instead of word boundaries, so a dotted or base64-style id is one token), and a new `host` rule (dotted labels ending in a top-level domain of letters) masks a mail host to `<host>` — the builder's call: a host names the recipient's organisation, and unlike the local-address gap this kind the mask CAN see (ruling 5 chose categories where it could not); Bradley may overrule at the verdict. Six rules, in order: email, uuid, ipv4, host, token, number. Fixture rows of each kind pin it (a mail host; a gateway id with dots, hyphens and underscores; a base64-style id).
Judge: the MASKS table — every rule has a case it is the first to change — plus the standing "what diagnoses the failure is kept" case (SMTP codes, enhanced status codes, short numbers untouched).
Sibling sweep: batched — polish; the one other masker is the same function (reduce's second pass).
Pass bar (stated before measuring, from the Judge line and the kickoff): the masked text captured at hb-20261007-02, run through the shipped mask (MASK_RULES, six rules), leaves no host name and no hyphen or underscore id; Bradley may overrule the builder's call that hosts are masked.
Verdict: REOPENED 2026-10-08 (tester, S3b fix-round verdict, V2) @ hb-20261007-03. Under test: feat/jo-dash-s3b-health-batch at 244b0dc, clean; canary hb-20261007-03 in session; no gs-admin call (the previous round's files).
Reopened: 2026-10-08 (tester @ hb-20261007-03, S3b fix-round verdict) — first reopen. The bar's own half passes: order 10^3 raw sample texts from the previous round's sample payloads, plus its masked texts and both snapshots' `failureSamples`, through `maskMessage` (email, uuid, ipv4, host, token, number), searched with detectors that are not the mask's own patterns: 0 host names, 0 addresses, 0 IPv4, 0 five-digit runs; one hyphenated token survived and it is SMTP continuation text (`2-Requested mail action`), not an id. What fails is the fix's own mechanism, by over-masking product text: 11 of the 30 bounce wordings Bradley accepted at hb-20261007-02 can no longer be captured from a sample. The host rule takes Microsoft 365 diagnostic codes (`RESOLVER.ADR.RecipientNotFound`, `RESOLVER.RST.*`, `STOREDRV.Deliver.Exception`, `TRANSPORT.RULES.RejectMessage`, `SMTPSEND.DNS.NonExistentDomain`: order 10^1 of the order 10^2 distinct strings it took are upper-case product codes) and vendor help-link hosts — 7 of the 11; the widened token class takes a vendor's help-URL path whole (`https:<id>#550`) — 4 of the 11, with the host rule removed. Class, in one sentence: the widened mask cannot tell product text shaped like a host or an id from a recipient's value, so the text that diagnoses the failure is masked with it. A falsifiable test of the class: every pattern of a captured category list, run through the mask, equals itself. Bradley on hosts (2026-10-08, in session, verbatim): "as long as they don't reach the public repo, i'm open to them unmasked. think about why we wanted them masked, and maybe just point out to the builder what the impact is if we do it, based on your remeasure. fair?" The remeasure, for the builder: masking hosts costs 7 of 30 capturable wordings; the samples stay terminal-only (`pageSnapshot` empties them) and in the workspace (the repo carries no tenant data by gate); a host names an organisation, not a person, beside account names a snapshot already carries with accounts on. The token-class part (4 of 30) is a defect whichever way hosts go. Severity unchanged (polish).

## F-493 — VERIFIED
Reported: 2026-10-07 (tester, S3b verdict round @ hb-20261007-02 on feat/jo-dash-s3b-health-batch; production tenant, reads only; VALIDATION Y15)
Severity: polish — the selective refresh already re-pulls the current and previous month, so the data recovers on the next refresh; only the report's sentence understates what moves
What: the report's freshness line says only sends on or after the first of the current month are provisional ("sends on or after <date> are provisional"). Between two full pulls of the same window 35 minutes apart (Y1, and Y15 whose test accounts move sends between classes but not the totals; total sends unchanged), the PREVIOUS, closed month moved: +2 bounced and -2 delivered, +1 unsubscribed, in a month of order 10^5 sends. Late bounces and unsubscribes arrive on sends from the month before. Class, in one sentence: the provisional statement names the window the opens keep arriving in, not the window the flags keep changing in.
Repro: two full pulls with the same flags, minutes apart, early in a month; sum `facts.byTemplate` delivered, bounced and unsubscribed per month in each and diff.
Expected: the line names what the refresh already knows (the last `repullMonths` months can still change, bounces and unsubscribes included), or the builder records why the previous month's drift is below the line's concern (WONTFIX).
Fix: 2026-10-07 (builder, feat/jo-dash-s3b-health-batch) — Class, in one sentence: the provisional statement named the window the opens keep arriving in, not the window the flags keep changing in. One statement, `provisionalSpan`/`provisionalText` in engagement-query.mjs, derived from the pull's own re-pull horizon (`meta.refresh.repullMonths` over `window.to`): "sends on or after <incompleteFrom> are provisional (opens keep arriving), and bounces and unsubscribes on sends since <horizon> can still change (the N months a refresh reads again)" — the second clause only when the horizon is earlier than the incomplete-from day. Every output reads it: the data-pulled line, the `incomplete-period` caveat, the report's lead caveats, the page's footnote. Goldens regenerated.
Judge: the query suite's exact line over the golden (horizon 2026-08-01 under a 2-month re-pull), and the report golden byte for byte.
Sibling sweep: batched — polish; the four readers of the old sentence were found by grep and all read the one function now.
Pass bar (stated before measuring, from the Judge line and the kickoff): on one snapshot, the data-pulled line, the incomplete-period caveat, the report's lead caveat and the page footnote state the same provisional span, and the flags clause appears only when the re-pull horizon is earlier than the incomplete-from day.
Verified: 2026-10-08 (tester, S3b fix-round verdict, V2 @ hb-20261007-03, feat/jo-dash-s3b-health-batch clean and level with origin at 244b0dc, canary hb-20261007-03 in session; production tenant, reads only) — RE-VERIFICATION, the bar above. One snapshot (the round's full pull, a 2-month re-pull): `dataPulledLine`, the report's freshness line, the report's `incomplete-period` caveat, the report summary's `leadCaveats` and the admin page's pre-rendered footnote all name the same span — provisional from the incomplete-from day (the first of the current month), bounces and unsubscribes changeable since the first of the month before. `provisionalSpan` with the re-pull set to 1 month drops the flags clause (its horizon equals the incomplete-from day) and with 3 moves it a month earlier. The surviving mutant M8's arm (a horizon later than the incomplete-from day) is unreachable while the window ends on the current month — recorded, as the builder predicted.

## F-494 — VERIFIED
Reported: 2026-10-07 (tester, S3b verdict round @ hb-20261007-02 on feat/jo-dash-s3b-health-batch; KB read only; met while preparing VALIDATION Y14)
Severity: polish — unreachable on this round's pulls (no such program was selected); a program carrying only such a schedule would group as "not recurring" on any dashboard once it sends
What: `pickSchedule` takes `classification` from `classifySchedule`, which returns the raw `scheduleType` when it is neither ONE-TIME nor RECURRING and the cron is unreadable. A schedule of type CRON whose cron the KB did not capture (`cronExpression` null) is therefore classified "CRON"; `programTraits` reads `recurring` as `classification === "recurring"`, so such a program's `recurring` is FALSE — not null (unknown), though a CRON-type schedule recurs by its type. The prod KB has order 10^1 schedules of this shape, on six program docs that carry no other kind. Class, in one sentence: a pass-through classification label read as a boolean trait.
Repro: in a run directory, `kb-steps.json` → `schedules[<id>].schedules[]` with `classification: "CRON"` and `cronExpression: null`; `pickSchedule` of that doc returns classification "CRON"; `dashboard-groups.mjs resolve` with a `recurring` rule puts the program under "is false".
Expected: a CRON-type schedule with no readable cron is recurring with the cron unknown (or `recurring` null with the reason stated), never false; a fixture doc of that shape pins it.
Fix: 2026-10-07 (builder, feat/jo-dash-s3b-health-batch) — Class, in one sentence: a pass-through classification label read as a boolean trait. Fixed at the reader, not the shipped parser: `programTraits.recurring` is true for "recurring", false for "one-time" and "no schedule captured", and null (unknown) for any pass-through label ("CRON", "unknown"), so such a program is Ungrouped by a recurring rule rather than "not recurring"; the suggestion input's note says so. The audit report's type column is unchanged.
Judge: the groups suite's check over a doc of that shape (classification "CRON", cron null → null; "one-time" → false; "recurring" → true).
Sibling sweep: batched — polish; the only other reader of the classification as a boolean was the retired cadence rule (judgeHealth reads it as a state).
Pass bar (stated before measuring, from the Judge line and the kickoff): a CRON-type program with no readable cron reads `recurring` null (Ungrouped) in dashboard-groups' suggestion input, never false.
Verified: 2026-10-08 (tester, S3b fix-round verdict, V2 @ hb-20261007-03, feat/jo-dash-s3b-health-batch at 244b0dc, canary hb-20261007-03 in session; no gs-admin call) — RE-VERIFICATION, the bar above. The KB holds order 10^0 programs whose only schedules are CRON-type with no cron; none sent in the window, so none is selected. A copy of the previous round's snapshot had one selected program's schedule replaced by that real KB shape (classification `CRON`, cron null): `suggest-input` reads its `recurring` null; `resolve` with the previous round's recurring spec moves it Recurring -1, Ungrouped +1, Not recurring unchanged. Never false. Blind spot: a patched copy, not a natural instance.
