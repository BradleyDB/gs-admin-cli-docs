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
dev/FEEDBACK-archive.md after each release (last move: 2026-10-15, after release 0.54.0 — F-469..F-547, 72 sections, with 25 header Walk lines; the seven DEFERRED past 0.54.0 stay live: F-530, F-536, F-541, F-542, F-545, F-546, F-548; the 0.43.4 move (a hotfix cut from main) took F-487; the 0.43.3 move took F-461 and F-466, leaving no live section; the 0.43.0 move took F-462, F-463, F-464, F-465, F-467 and F-468; the 0.42.0 move took F-448..F-460 with their round blocks and the four header Walk lines; the 0.37.0 move took
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
(1) every handoff writes `Blind spots (hb-20261015-01): …` directly under Under test — what this
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


Under test: doctrine-cli-1-0-11-plus · hb-20261015-05 · 2026-10-15
Blind spots (hb-20261015-05): no CLI 1.0.11 or 1.0.12 and no tenant token in this builder session, so every version-conditional clause rests on the audit's static reading and the six CP-6 checks in dev/VALIDATION.md § F-549 / CP-6 (a)-(f) are owed live; the two 1.0.11 refusal texts in the engagement fixture are paraphrases of the handler's two throw sites, to be replaced by the real stderr at CP-6 (f); the setup references changed are prose (walked by the tester, no CI reads them); the rebase against PR #57 (session B, 0.55.0) is not performed — whichever merges second takes the next number


<!-- builder 2026-10-15 (E1+V1 of gs-fortress build-kickoffs-1.0.12.md HANDED OFF — UNMERGED, riding doctrine-cli-1-0-11-plus (PR #58 to dev, open); F-549 (normal) OPEN -> FIXED -> VERIFIED on that branch (tester @ hb-20261015-05, 4b7914d: bar (1)-(5) pass, the six CP-6 live checks owed on a 1.0.11-or-later CLI; #57 reads MERGEABLE/CLEAN again at 28f1630); token hb-20261015-05; plugin 0.54.1 on the branch; no number claimed; next free F-550):
     Kickoff: open PRs to dev — #57 (Session B, F-548/F-530, green on its five checks, CONFLICTING against dev since the F-549
     emission landed on the tail of this file; keep both sides) and now #58; no OPEN polish (the five DEFERRED past 0.54.0 stay).
     Content: CP-2 (sc measures --id: cause named, fixed at 1.0.11, --name the default), CP-3 (libuv abort and the one-level
     template-folder flattening scoped to 1.0.10 and earlier, parse-stderr kept on every version, the ### heading untouched),
     CP-4 (engagement.mjs header facts version-stamped, one-at-a-time rule and every validateQuery guard kept, classifyFailure
     reads a 1.0.11+ field refusal as shape-error before the not-found class — mutation-proved: 3 FAILED of 380 with the branch
     removed), CP-5 (0.54.0 -> 0.54.1 + CHANGELOG), CP-6 (six live checks banked in dev/VALIDATION.md § F-549 / CP-6 (a)-(f)).
     Battery 60 steps 0 red locally; npm run build NOT run (ungated leg; the regen is the gated session E2).
     Ordering vs #57: both edit scripts/engagement.mjs and test/engagement.mjs and both bump from 0.54.0 (#57 -> 0.55.0, #58 ->
     0.54.1); whichever merges second rebases and takes the next number — Bradley's call. Close-out after the merge: gs-fortress
     close-out.mjs 1.0.12 --session E1,V1 --pr 58 (never typed). -->
<!-- builder 2026-10-15 (Session B — F-548 redesign round HANDED OFF — UNMERGED, riding feat/f548-ranking-every-refresh (PR #57 to dev, open); F-548 and F-530 (both normal) OPEN -> FIXED on that branch, re-opened from DEFERRED (past 0.54.0) by their defers' trigger; token hb-20261015-04; plugin 0.55.0; no number claimed; next free F-549):
     Kickoff: no open PR to dev; no OPEN polish (F-536, F-541, F-542, F-545, F-546 stay DEFERRED past 0.54.0, auto, and
       block the next release ceremony as the skill says: carried, not in this round).
     Step 1 (measured, then ruled): the account store measured offline on the kept dashboard's full run directory
       (15,436 accounts, 185,675 cells, 4.56 MB plain JSON; the full pull's lists reproduced in order); Bradley ruled
       BUILD, plain JSON (no zipped file), one store for the latest snapshot only (F-548's Measured: and Ruling: lines).
     Built: every refresh ranks the customer lists over every account and month (stored months + pulled months); a list
       change ranks from the store with no pull (F-529's narrow path replaced); a 0.54.0 snapshot is continued by one
       full pull, said and priced, no hand step; the page's list panels show the pull's ranking (F-530); T-10 additive
       (meta.accountStore). Redesign: carry-the-last-ranking (F-521) replaced.
     Judge: engagement 384, dashboard 146, dashboard-page 214, engagement-report 56, contract-conformance 318; 13
       mutants KILLED pred:KILL (M7 after its check was strengthened); /code-review medium 6 findings (3 fixed, 2
       polish skipped, 1 no change); local battery on a temp worktree (quoted on the branch's Fix note).
     Owed: the verdict round, LIVE on the kept dashboard (VALIDATION § F-548 — ranking on every refresh, L0-L4: the
       migration first, then a full and a selective pull, about two hours; a list change on a scratch import; the
       skill's changed lines walked). Ordering: nothing pending re-arranges what is verified.
-->

<!-- builder 2026-10-15 ([v]0.54.0 RELEASED — post-release housekeeping; R12, the JO-dashboards release, one folded entry; next free F-549):
     Payload: email engagement, from a one-off report to a dashboard refreshed with one command — the new
       /gs-superadmin:email-engagement skill (report, dashboards from an interview, refresh with no model in the loop,
       the leaders' copy published, one account's timeline; read-only on the tenant) and the CSV formula hardening.
       Staged versions folded in: 0.44.0–0.53.0, as ONE CHANGELOG entry (78f9919, amended by R12-A).
     Gate 1 (bus): terminal — step 0 at 96905a7 (F-530, F-548 DEFERRED past 0.54.0 to Session B; polish F-536, F-541,
       F-542, F-545, F-546 auto-deferred once); every other live section VERIFIED or WONTFIX; open PRs to dev: none.
       VALIDATION §§ R12-A and R12-A-V close-out CLEARED before the cut.
     Gate 2 (review): spent at the first R12 session — /code-review medium over origin/main...dev: 7 decision-wrong
       classes F-529..F-535 (normal) and 12 polish F-536..F-547; /security-review: highest severity Low (F-547). The fix
       batch was judged by its verdict round (R12-A-V; F-534 by the builder's close-out), never re-reviewed.
     Cut: release/[v]0.54.0 from dev @ 73ec81a — first-parent TWO commits beyond: the strip (d42f233) and
       `git merge -s ours origin/main` (a1634c6; Bradley 2026-10-14), its tree byte-identical to the strip's.
       `git rev-list --count dev..HEAD` read 15, not the checklist's 1: the strip, the merge, and main's 13 commits dev
       never had (the 0.43.4 hotfix and its release merge, reachable through the merge's second parent);
       --first-parent read 2; `git merge-tree --write-tree origin/main HEAD` conflict-free. Line audit: every line the
       hotfix added (5353b7f..736abda, 28 files) is in the release tree, or is an adjust line (the 0.43.4 version, the
       CHANGELOG heading dev retitles "(hotfix, released from main)", reader-shapes' generated runs count), or was
       carried by dev's F-487 merge a5d8a0b and later rewritten on dev (S3b's F-488/F-489, a2f6a80) — no hotfix code
       lost. Battery verbatim from both YAMLs, in temp worktrees: 52/52 on the dev tip, 53/53 on the stripped tree
       (strict validates and no-dev-content included; the one skip the global CLI install).
     CI on the release PR #55, first cut, QUOTED per job after completion:
         validate-plugin 38787822945: changes success / manifests success / validate (ubuntu-latest) success /
           validate (windows-latest) success / validate (macos-latest) FAILURE
         docs-drift 38787822986: drift (full) success
         pr-target-guard 38787822857: guard success
       The macOS red, test-only: test/dashboard.mjs 1 FAILED of 145, F-533's "the remedy line run as printed finishes
       the pull" (resumed false). macOS's temp dir /var/folders/... is a symlink into /private/var/...; the suite passed
       the temp path as --workspace to one run and ran the printed line from a cwd under it, so the second run spelled
       the snapshot path differently and planned afresh instead of resuming. Unreachable by a user: no printed line or
       recipe passes --workspace. Class: a suite comparing two spellings of one temp directory; its one home is the rig.
       Fix on dev, PR #56 (0b1e732, merged 4f03995 on Bradley's "merge if green"): test/rig.mjs makeTempDir returns
       the real path. Judge: a full-matrix validate-plugin dispatch on the branch, run 38789683815 — changes /
       manifests / validate (ubuntu-latest) / validate (windows-latest) / validate (macos-latest) success; the 19
       rig-using suites green locally on Windows. No bus section claimed (test-only; the 3-OS run is the verdict).
     Recut from dev @ 4f03995: the strip (e197d71) and the ours-merge (ede0981); the tree differs from the first cut by
       test/rig.mjs alone (outside the hotfix's files: the line audit stands); stripped battery 53/53; force-pushed.
     CI on the release PR #55, recut ede0981, QUOTED per job after completion:
         validate-plugin 38796062032: changes success / manifests success / validate (ubuntu-latest) success /
           validate (windows-latest) success / validate (macos-latest) success
         docs-drift 38796061769: drift (full) success
         pr-target-guard 38796079806: guard success
       GitGuardian: neutral both times, "Pull request too large to scan" (~38k added lines). Backstops: all 14 PRs merged
       to dev since 0.43.4 (#40, #41, #43–#54) scanned "No secrets detected"; the only direct dev commits touching
       shipped files are prose (78f9919, a2f6a80); a secret-pattern sweep over the release diff's 38,319 added lines
       found nothing; the pre-push instance-data gate passed with the private patterns loaded.
     Merged by Bradley (main @ bb95a20); tag [v]0.54.0 pushed by `dev-utils release-finish`; release branch deleted
       local+remote; checkout back on dev.
     Housekeeping: F-469..F-547 (72 sections) moved VERBATIM to the archive by `dev-utils archive`, with 25 header Walk
       lines into its Walks block (live 79 → 7, archive 22 → 94, sum 101; 1,152 non-blank lines removed equal the 1,152
       added; block sha256 c444e7665193166b12372ed80c36cfac813801c3a2e9d5864998cb87ca7dc659). NOT archived: F-530, F-548
       and the auto-deferred F-536, F-541, F-542, F-545, F-546. Entry hint updated. Under test + canary → dev ·
       hb-20261015-03 by `dev-utils handoff` (1c4659d; a post-release re-stamp, not a round). Next free number F-549.
       Released: 0.54.0; dev stages nothing.
     Trap, recorded: the stripped-tree battery's docs-drift step ("Fetch dev's bus header", `git fetch --depth=1`) made
       the SHARED repo shallow at the dev tip — a temp worktree shares the object store; repaired by
       `git fetch --unshallow origin` (pushed refs unaffected; the release merge's parents intact on GitHub).
     Now live from main: the two workflow files changed since 0.43.4 (docs-drift.yml, validate-plugin.yml) now drive
       main's own and the weekly scheduled runs; no Dependabot change shipped.
     GitHub Release: https://github.com/BradleyDB/gs-admin-cli-docs/releases/tag/v0.54.0 (notes = .github/release-intro.md
       and the ONE 0.54.0 entry, the entries since the previous tag; not a draft, not a prerelease; Latest).
     Consumer refresh: claude plugin marketplace update gs-admin-cli-docs; claude plugin update
       gs-superadmin@gs-admin-cli-docs.
     Carried forward (not in this release): Session B, THE FAST FOLLOW — F-548 (lists re-ranked on every refresh, the
       list mechanism's redesign) with F-530 and F-529's root under it; its kickoff is in the handoffs' SESSION-PROMPTS.md.
       Polish F-536, F-541, F-542, F-545, F-546 (auto-deferred once: each blocks the next release like a normal finding
       until fixed, WONTFIX or deferred by hand). LTR-27 (F-531's level default). The program wind-down
       (CLEANUP-PLAN.md) opens after Session B: VALIDATION holds no OPEN program section without a reason (checked);
       the [VAL-TEST] / zz-test-* sweep, the ideas notes, shapes/ and the folder's fate are Bradley's. -->
<!-- builder 2026-10-15 (R12-A-V CLOSE-OUT — the verdict of record for the tester's F-534 role-inversion fix, on fix/r12a-v-f534-held-words, PR #54, UNMERGED pending Bradley's word; no number claimed; next free F-549):
     C1 PASSED (145/145; the code hunk reverted alone fails exactly the two new checks, predicted); C2 PASSED by reading;
       C3 RED at 1aa9b49 (the skill wrote its pull-again mode's name bare; engagement-report's prose check), fixed by a
       builder rewording at e1c2c1f and GREEN there (validate-plugin 38770931304, docs-drift 38770931245; CLEAN).
       F-534 VERIFIED. The rewording is the builder's: Bradley's read of that one sentence is open, not a gate.
     Bus after PR #54 merges: twelve R12-A sections VERIFIED plus F-534; F-530 and F-548 DEFERRED (session B); F-536,
       F-541, F-542, F-545, F-546 OPEN polish (auto-defer once at the recut). Next: merge PR #54, then the 0.54.0 recut. -->
<!-- builder 2026-10-15 (R12-A fix round HANDED OFF and MERGED — PR #53 merged to dev at d2cfd08 on Bradley's standing word ("if this comes back clean, go ahead and merge the pr, and do the closeout to prep for the validation session"); token hb-20261015-01, Under test: dev; no number claimed; next free F-549):
     Kickoff: no open PR to dev. Scope as ruled: F-529 (narrow), F-531..F-535, folded polish F-537, F-538, F-539, F-540,
       F-543, F-544, F-547 — all FIXED on feat/r12-fix-a with Fix, Judge, a mutation copy-out (predictions written first:
       27 mutants, every one matching its prediction; M23 first SURVIVED, a mismatch that gave the report refreshSeconds)
       and a Sibling sweep. CHANGELOG 0.54.0 amended in place (no bump), with the customer-lists line and F-547's hardening.
     Clean, as defined before merging: suites green (dashboard 143/143), check-doc-drift / check-stale-facts /
       check-instance-data / check-imports pass, claude plugin validate pass, typecheck 0 errors, the local battery 0 failed
       suites (temp worktree, no strip steps), /code-review low over this diff 0 findings; CI on PR #53 at 329a67b, per job:
       GitGuardian pass; validate-plugin run 38717380030 changes, manifests, validate (ubuntu-latest) pass; docs-drift run
       38717380114 drift (full) pass; mergeStateStatus CLEAN. Branch deleted; checkout on dev.
     Carried, not in scope (auto-defer at the recut): F-536, F-541, F-542, F-545, F-546 (polish). Deferred to session B:
       F-530, F-548.
     Next: the R12-A verdict round — dev/VALIDATION.md § R12-A, V1–V7, on dev with --plugin-dir (canary hb-20261015-01),
       no pull; then the 0.54.0 recut. Bradley's eye is owed on F-531's default view (V2) and F-529's done.text (V1). -->

<!-- builder 2026-10-14 (F-528 fix round CLOSED — PR #52 MERGED to dev (665bf1e) after F-528-V @ hb-20261014-03/-04 and the builder's close-out; F-528 VERIFIED; no number claimed; next free F-529):
     F-528-V (tester @ hb-20261014-03): W1 and W3 passed; W2 failed — the plugin README's skill-table row still offered
       the panels as Gainsight reports (no "native" in it, so the sibling grep missed it), and a router mutant survived
       the span-bounded check. F-528 REOPENED once. Fixed by ROLE INVERSION on Bradley's word (tester, cc83ea6): the row
       back to its pre-S8 words, the check reading whole files; handoff hb-20261014-04; Bradley's wording read "fine as is".
     Builder close-out (the verdict of record, f07f9fa): C1 13 of 13 hunks KILLED pred:KILL with the builder's own
       harness; sibling probe S1 (an offer worded with neither key word) SURVIVED pred:SURVIVE — a word-keyed check's
       limit, recorded, not logged (the check's second round: not tuned a third time); C2 the row and the S8 differential
       read (53 surviving S8 lines, none about native reports); C3 test/dashboard.mjs 124/124, dashboard-native 23/23.
     CI on f07f9fa, per job: GitGuardian pass; validate-plugin run 38690510173 changes, manifests, validate
       (ubuntu-latest) success; docs-drift run 38690510311 drift (full) success; PR #52 CLEAN → merge commit 665bf1e on
       Bradley's go-ahead; branch deleted local and remote; checkout on dev.
     Open PRs to dev: none. Bus: every section VERIFIED or WONTFIX. Next: the release round (R12); its prompt now runs
       /code-review MEDIUM scoped to the shipped scripts, skills and hooks, with the standing rulings handed over. -->

<!-- builder 2026-10-14 (F-528 fix round HANDED OFF — UNMERGED, riding feat/jo-dash-f528-withdraw-native (PR #52 to dev, open); F-528 (normal) FIXED on that branch: mode N withdrawn as an OFFER, the code kept; token hb-20261014-03; no number claimed; next free F-529):
     Kickoff: one open PR to dev, Dependabot #50 (actions/setup-node 7.0.0 -> 7.1.0), checks green (GitGuardian,
       changes, drift (full), manifests, validate) and CLEAN: merged to dev at 14a53f0 (merge commit, on Bradley's
       go-ahead for that one PR). No OPEN polish on the bus. The branch cut from dev at 14a53f0.
     Commits: 1f7593a (the withdrawal + the F-528 check), 92ef8ee (bus Fix / Judge / mutation copy-out / Sibling sweep,
       VALIDATION § F-528 W1–W3), 6c99601 (handoff: header + canary), then the placeholders keyed to the token; pushed,
       not skip-tagged, so PR #52's CI runs on the head. Plugin 0.54.0 unchanged (folded into its unreleased entry).
     Withdrawn: the skill's mode N (section, argument hint, mode list, description and ground-rule exceptions, router,
       Arguments routing → one "not offered in this release; say so and stop" sentence), the plugin README's native
       recipe and mutation exception, the repo README's native clause, the CHANGELOG's native bullets (one not-offered
       line). KEPT: dashboard-native.mjs, the three verbs, the stand-in, their suites, T-11's `native` (no contract change).
     Judge: the entry-command suite's F-528 check (beside F-526's); M1–M4 KILLED pred:KILL. Run: test/dashboard.mjs
       124/124, the three doc gates, plugin validate; /code-review low: 0 findings. No full battery (CI runs it).
     Ordering: nothing pending re-arranges what is verified; R12 (wait for the tail) follows F-528-V.
     Tester: /reload-plugins; VALIDATION § F-528 (W1 the skill walked asked for native reports, W2 the READMEs and the
       CHANGELOG read by Bradley, W3 the check's run). PR #52 merges on F-528-V. -->

<!-- tester 2026-10-14 (JO-dashboards S8 MERGED — PR #51 merged to dev (477a19e) after S8-V @ hb-20261014-02, on green CI, on Bradley's go-ahead at the sitting ("merge on green"); F-525, F-526, F-527 VERIFIED; the dataset-name prefix CLEARED; F-528 (normal) logged OPEN and ruled: withdraw mode N for now; next free F-529):
     Merged as a merge commit (as #36 to #49 were) at the verified head a3d7846 (S8-V's ruling commit, after the
       verdict commit 456d9b9; neither [skip ci]); feat/jo-dash-s8-native deleted local and remote. CI on the head
       a3d7846, per job: GitGuardian Security Checks pass; validate-plugin run 38682888297 — changes pass, manifests
       pass, validate (ubuntu-latest) pass; docs-drift run 38682888171 — drift (full) pass. Open PR to dev at close:
       #50 (Dependabot setup-node bump), folded into the F-528 fix round's kickoff on Bradley's word.
       Plugin 0.54.0 now on dev, unreleased.
     VALIDATION § S7-V batch CLEARED (B1–B4 PASSED). § NAT-2 CLEARED with one arm failed: N0, N2, N3, N5, N6 PASSED on
       the sandbox (nine creates and one update, each approved at the guard's ask; the reports deleted in the UI, a paged
       rp list shows none); N1 read and N4 FAILED, both F-528: the plan never states a report's definition, and its
       calculated-column steps cannot be built in Gainsight's report builder (no CASE logic; formula fields take only
       the object's numeric fields), so nothing past Sent, and no rate, can be finished in a report.
     Ruled (Bradley): mode N WITHDRAWN as an offer for now on F-526's pattern (the skill's mode, README recipe and
       CHANGELOG lines out; the code, verbs and T-11's native record kept: no contract change); native reports
       backlogged with the measured routes. The seven executor's choices KEPT. The S8 pointer note below (handed off)
       is retired by this one. Next: the F-528 fix round (with PR #50) and its short check, then the release
       ceremony (R12 to be re-asked once F-528 closes). -->

<!-- builder 2026-10-14 (JO-dashboards S8 HANDED OFF — UNMERGED, riding feat/jo-dash-s8-native (PR #51 to dev, open); NAT-1, NAT-2 built; S7-V's kickoff batch F-525 (normal), F-526 (normal), F-527 (polish) FIXED on that branch with the dataset-name prefix ruling; F-518 untouched (VERIFIED on dev at kickoff); token hb-20261014-02; no number claimed; next free F-528):
     Cut from dev at 6976b97 (S7 merged): 2268d66 (the feature), the handoff 89efb16 (bus header + canary) and the
       bus commit 5d74a44 (Fix / Judge notes, VALIDATION § S7-V batch B1–B4 and § NAT-2 N0–N6 banked), pushed; the head
       is not skip-tagged, so PR #51's CI runs on it. Plugin 0.54.0, unreleased, its own CHANGELOG entry.
     No design question was asked: S0 (e) and the CLI's report handler at the pin settle the payload (a GRID COUNT
       report on the delivery log; the CLI keeps no date literal, so the months are a dashboard filter in the UI).
     NAT-1: scripts/dashboard-native.mjs (pure) — each panel native, partial (figures left out with reasons) or not
       native; one COUNT column per report, every other count a calculated column and every rate a formula column the
       admin adds in the UI (conditions from the engine's registry); the tenant's schema read first; the rp create /
       rp update line printed as text. NAT-2: dashboard.mjs native-plan / native-record / native-verify through a gate
       of whoami, rp schema, rp describe and rp run-saved only; the skill's mode N issues each line as its own command
       (the guard asks); T-11 native.reports[].planHash additive (typedef, validator, pin); cleanup of unneeded reports
       listed for the UI. Executor's choices for S8-V: GRID only, no order-by / having / limit through the CLI (UI
       steps), two panels with one shape share one report, an update confirmed by the report's new name.
     Verified offline: dashboard-native 23 (new, in CI), dashboard 123, page 212, contract 318, spec 47, report 55,
       engagement 377; the verbatim battery 47 pass / 3 fail (two fixed and re-run green: the skill's --test renamed
       --test-prefix, a dashboards path literal; the third the known git-ignored file under tsc); plugin validate
       (both); plugin build reproduced. Mutations with predictions written first, every one as predicted: F-525 5,
       F-527 5, F-526 4, NAT-1 16, NAT-2 verbs 6, review fixes 5. /code-review: 7 findings, 6 fixed with a check each,
       1 skipped (an update that keeps its name is confirmed by name only; S8-V's N5 reads the real describe shape).
     Next: S8-V (its own session, sandbox only for § NAT-2; PR #51 merges on it). -->

<!-- tester 2026-10-14 (JO-dashboards S7 MERGED — PR #49 merged to dev (5fa4620) after S7-V @ hb-20261014-01, on green CI, on Bradley's go-ahead at the sitting ("Merge on green CI"); F-522, F-523, F-524 VERIFIED; F-525 (normal), F-526 (normal), F-527 (polish) logged OPEN and routed to S8's kickoff batch; next free F-528):
     Merged as a merge commit (as #36 to #48 were) at the verified head f2fb508 (S7-V's bus commit, not
       [skip ci]); feat/jo-dash-s7-publish deleted local and remote; no PR open to dev at close. CI on the head
       f2fb508, per job: GitGuardian Security Checks pass; validate-plugin run 38639182509 — changes success,
       manifests success, validate (ubuntu-latest) success; docs-drift run 38639182527 — drift (full) success.
       Plugin 0.53.0 now on dev, unreleased (R12 stands at WAIT FOR THE TAIL).
     VALIDATION § PUB-3 / PUB-4 CLEARED with one arm stopped: Setup, K0, P1, P2 PASSED; P4 ruled; P5 skipped;
       P3 STOPPED by a platform limit (the session's Artifact tool reads a whole file before publishing a file it did
       not write; the leaders' page is far past one turn's read) — Bradley ruled the artifact offer withdrawn at S8 and
       artifact support backlogged (F-526; the code, L2 and T-11's value kept: no contract change). The S7 pointer
       note below (handed off) is retired by this one.
     Carried to S8's kickoff batch: F-525 (the † mark unexplained at the tab foot and unhoverable in a chart name),
       F-526 (withdraw the artifact offer), F-527 (`published: true` on a partial copy), and the executor's-choice
       ruling that dataset CSVs are prefixed with the dashboard's name. Next: S8 (NAT-1, NAT-2 and that batch). -->

<!-- builder 2026-10-14 (JO-dashboards S7 HANDED OFF — UNMERGED, riding feat/jo-dash-s7-publish (PR #49 to dev, open); PUB-3, PUB-4 built; F-524 (normal), F-522 (polish, reopened once; Redesign line), F-523 (polish) FIXED on that branch; token hb-20261014-01; no number claimed; next free F-525):
     Cut from dev at e1589c9 (S6 merged): 57db8ad (the feature), the handoff 34dca83 (bus header + canary) and the
       bus commit cb73661 (Fix / Judge notes, VALIDATION § PUB-3 / PUB-4 banked: K0, P1–P5), pushed; the head is not
       skip-tagged, so PR #49's CI runs on it. Plugin 0.53.0, unreleased, its own CHANGELOG entry.
     Ruled at kickoff (Bradley, one question each): the shared folder's path lives in a per-machine workspace file
       (.gs-superadmin/publish-targets.json; the spec names only the target); the dataset emitter is a PUB-3 item with
       stable file names, the pull's time in a "Data pulled" column and the definitions file's first row.
     PUB-3: the leaders' page copied after every refresh and rebuild (and by a new publish verb) into the mapped
       folder, the same file each time; a stopped refresh copies nothing; a failed copy is said, the pages untouched;
       the CSV tables beside it. The artifact target: the page's content form for the skill's publish step, and the
       CSV save through the downloads capability inside an artifact. T-11 publish additive; the default spec's target
       is file-copy. PUB-4: the README recipes and the cost sentence; the skill's mode L.
     Verified offline: dashboard (every check, after the review fixes), dashboard-page 210, spec 47, contract 317, report 55, query 143, groups 42,
       theme 24; the verbatim battery 48 pass / 2 fail (both npm run typecheck, red only on the git-ignored handoffs
       tools file; the tracked tree type-checks clean); plugin validate; npm run build reproduced (stamps only);
       headless Chrome on the dense fixture (screenshots read); /code-review medium (run at the skill's high level):
       7 findings, 6 fixed, 1 skipped (an unquoted folder path; every documented line quotes it). Mutations with
       predictions written first: charts 11 of 11 killed, remedies 4 killed plus 1 predicted survivor, publish 9 of 9
       killed. Next: S7-V (its own session; PR #49 merges on it), then S8. -->

<!-- tester 2026-10-14 (JO-dashboards S6 MERGED — PR #48 merged to dev (5787456) after the S6-V re-check @ hb-20261013-03, on green CI, on Bradley's go-ahead at the re-check ("we go ahead and do the merge tonight/morning anyways"); F-520, F-521, F-518 VERIFIED; F-522 REOPENED (polish), F-523 (polish) and F-524 (normal) OPEN, carried as S7's kickoff fix batch; next free F-525):
     Merged as a merge commit (as #36 to #47 were) at the verified head 7fbce78 (the re-check's bus commit, not
       [skip ci]); feat/jo-dash-s6-account-timeline deleted local and remote (the remote by GitHub's auto-delete),
       with feat/jo-dash-s6-fix (local, already in it); no PR open to dev at close. CI on the head 7fbce78, per job:
       GitGuardian Security Checks pass; validate-plugin run 38528785035 — changes success, manifests success,
       validate (ubuntu-latest) success; docs-drift run 38528785055 — drift (full) success. Plugin 0.52.0 now on dev,
       unreleased (R12 stands at WAIT FOR THE TAIL).
     VALIDATION § ACC CLEARED with R3's bar half carried (R1, R2, R4, R5 PASSED; A0, A1, A3–A6 stood). The three S6
       pointer notes below (handed off, S6-V verdict, fix round) are retired by this one: nothing they name is
       unmerged now.
     Carried: F-522 (the bar chart's opened name painted under later ticks; the lanes hold), F-524 (a bar panel by
       program unreadable at real program counts) and F-523 (a stopped --full prints a remedy without the flag) are
       S7's kickoff fix batch on Bradley's ruling, judged first on a dense fixture and re-checked at S7-V with no pull.
     Next: S7 (PUB-3, PUB-4 and that batch) from dev, then S8. -->

<!-- builder 2026-10-13 (JO-dashboards S6 FIX ROUND HANDED OFF — UNMERGED, riding feat/jo-dash-s6-account-timeline (PR #48 to dev, still open); F-520, F-521 (normal), F-522, F-518 (polish; F-518 with a Redesign line) FIXED on that branch; token hb-20261013-03; no number claimed; next free F-523):
     Built in a worktree on feat/jo-dash-s6-fix (cut by the tester from 385b391), fast-forwarded into
       feat/jo-dash-s6-account-timeline: 814e966 (F-520, F-521, F-522), f9bb777 (F-518), bc6327e (the review's findings,
       CHANGELOG 0.52.0 amended), the handoff 991eba4 (bus header + canary) and the bus commit 6471f8c (Fix / Judge
       notes, VALIDATION § ACC re-banked R1–R5 for the S6-V re-check), pushed; the head is not [skip ci], so PR #48's
       CI runs on it. Plugin 0.52.0, unreleased (no bump: the round folds into its entry).
     F-520: "kept" read over the snapshot's window, a kept program with no send in the compared months named
       no-send-in-months-compared, every reason in words. F-521 (S5's code, so dev carries the defect until PR #48
       merges): a selective refresh carries the last full ranking of the customer lists (rankedAt, carriedFrom,
       notRanked: T-10 additive) — the builder's call, carry, not re-rank, reason in the Fix note. F-522: a shortened
       chart label opens whole on hover, focus, click or tap (one helper, svgLabel). F-518: the remainder priced from
       each planned unit's own price less the calls made in its split tree, never above the whole; the stop line reads it.
     Verified offline: engagement 377, dashboard-page 200, dashboard 98, engagement-report 55, engagement-query 143,
       contract 317, spec 47, groups 42; the verbatim battery on the committed tree 49 pass / 0 fail (7 skipped by
       design: the dev-only strip, the clean-tree diffs, the installs); typecheck; plugin validate; /code-review medium
       10 findings, 8 fixed, 1 half (one remainder function; the samples stay an upper bound), 1 dismissed with a
       comment (a stop before the plan point prices from the plan's remainder, which nothing has moved). Mutations with
       predictions written first: 5 killed, 1 recorded MISMATCH (F-518's first check, default fixture; moved to the
       mass-send day). Next: the S6-V re-check sitting (PR #48 merges on it), then S7 or S8. -->

<!-- tester 2026-10-13 (JO-dashboards S6-V VERDICT — ON AN UNMERGED BRANCH; feat/jo-dash-s6-account-timeline → PR #48, token hb-20261013-02; claims F-520, F-521, F-522; next free F-523):
     Branch commits 1652880 (F-520, F-521, F-522 logged; F-518 routed) and 385b391 (VALIDATION § ACC results, the Walk
       line), both [skip ci]: the S6 fix round's handoff pushes the next head CI runs on. Production tenant, reads only.
     Verdict against § ACC: A0, A1, A3, A4, A5, A6 PASSED; A2 PASSED on its figures and FAILED its notCompared clause
       (F-520, normal); A7 half measured (the reuse of an answered data call across a login unmeasured: owed at the
       re-check). Logged beside the arms: F-521 (normal, S5's code on dev too: a selective refresh records empty
       customer lists and the report says no account met any floor), F-522 (polish, Bradley's note: shortened program
       names with no reachable full text). No contract change implied.
     Ruled by Bradley at the close: ONE S6 fix round on PR #48's branch (worktree branch feat/jo-dash-s6-fix, merged
       back at the handoff) takes F-520, F-521, F-522 and F-518 before PR #48 merges; then an S6-V re-check sitting.
       F-518's S8 fail-safe applies only if that round leaves it OPEN. PR #48 stays OPEN and UNMERGED until then. -->

<!-- builder 2026-10-13 (JO-dashboards S6 HANDED OFF — UNMERGED; ACC-1 and ACC-2 built on feat/jo-dash-s6-account-timeline → PR #48 to dev; token hb-20261013-02; no bus section rode this session; VALIDATION § ACC banked for the tail's batched verdict round; F-518 (polish) carried; next free F-520):
     Branch feat/jo-dash-s6-account-timeline, cut from dev at 8cf4251 (gates: S5's PR #47 merged at f2895bb; SPIKE (m)
       go); the feature commit 82d51e0, the handoff commit 19a71a1 (bus header + canary, on the branch as S5's were),
       the validation commit 48bc85e (§ ACC keyed to the token). PR #48 is left open: its merge gate is S6-V, batched
       with S7-V and S8-V (R12: wait for the tail). Plugin 0.52.0 on the branch, unreleased (0.51.0 beneath it on dev).
     What shipped (the plan's As-shipped (S6) notes under ACC-1 and ACC-2 have the detail): ACC-1, the adapter's
       account-history path — `engagement.mjs account (--account-id | --account-name) [--last]`, one account's JO email
       by program, template and day (email_log_v2, GsCompanyId EQ, day grain) beside every recipient of the same
       programs over the same days; a NEW T-10 snapshot kind, account-timeline (typedef + contract pin, nothing existing
       changed); the account is the finest detail; a name is looked up EQ then CONTAINS and anything but one exact
       match is a pick list, exit 6, nothing pulled; reconciliation within the timeline and, with --against, against a
       dashboard snapshot's rows of the same account over whole months. ACC-2, `dashboard.mjs account [<slug>] …`: a
       self-contained timeline page (lanes, marks by state, the account against every recipient, table, CSV, data
       pulled) and on the admin preset an account panel (month grain, last in the preset) with View buttons in the
       customer lists and the copyable per-account line, said to need a gs-admin login; the static page never pulls.
     Verified offline: the verbatim battery on the staged tree (every suite and drift gate green; the reds local only:
       a workflow `defaults:` block the local runner misread, `npm i -g` blocked by the running claude.exe, and the
       known git-ignored handoffs run.mjs under tsc — the six type errors the battery found were fixed and re-run);
       plugin validate --strict (plugin and marketplace); `npm run build` reproduced committed output (stamps only);
       `/code-review` inline over eight angles: 5 findings, 3 fixed, 2 dismissed with reasons (in the PR body).
     Blind spots: on the header's line. The one to read first: EQ and CONTAINS on the company object's Name are
       unmeasured live, so § ACC's A0 measures them before anything rests on the name lookup (Bradley's rule:
       operators per object and field).
     Carried, not this session's: F-518 (polish, OPEN; the handoff warned of it, as expected) rides the tail's first fix
       round and the batched verdict round, per the S5-V fourth sitting's ruling. -->

<!-- builder 2026-10-13 (JO-dashboards S5 MERGED — PR #47 merged to dev (f2895bb) after S5-V's four sittings, on green CI, on Bradley's R12 ruling at the fourth sitting's close ("PR #47 can merge"); F-518 (polish, REOPENED) carried; next free F-520):
     Merged on Bradley's go-ahead, as a merge commit (as #36 to #46 were), at the verified head 7dca63c (the fourth
       sitting's bus commit, not [skip ci]); the branch deleted, local and remote (the remote by GitHub's
       auto-delete), with feat/jo-dash-s5-fix3 (local, already in the branch); no PR open to dev at close. CI on the
       head 7dca63c, per job: GitGuardian Security Checks pass; validate-plugin run 38465038466 — changes success,
       manifests success, validate (ubuntu-latest) success; docs-drift run 38465038458 — drift (full) success.
       Plugin 0.51.0 now on dev, unreleased (nothing above the v0.43.4 tag is released; the release is the maintainer's,
       and R12 stands at WAIT FOR THE TAIL).
     VALIDATION § PUB-1, § DSH-3, § UX-2 and § F-502 / F-503 / F-504 all read CLEARED (UX-2 on a proxy, the real
       brand input a blind spot; F-502's two-day case a blind spot). F-502..F-517 and F-519 VERIFIED, F-510 WONTFIX.
     Carried: F-518 (polish, REOPENED at the fourth sitting: the resume after a short first run prices the
       remainder above the whole) rides the tail's first fix round and the batched verdict round; its evidence, the
       fourth sitting's run directory in the workspace, stays until it is VERIFIED.
     Next: X1 (PUB-2, the exec-host exploration; reads the repo, no branch or PR), then the tail builds S6, S7, S8
       from dev.
-->

<!-- builder 2026-10-13 (JO-dashboards S5 FIX ROUND 3 HANDED OFF — UNMERGED, riding feat/jo-dash-s5-entry-command (PR #47 to dev, still open); F-519 (normal), F-518, F-511 (instance 27, second reopen: Redesign line), F-505, F-507, F-508, F-509 FIXED on that branch; token hb-20261013-01; next free F-520):
     Built in a worktree on feat/jo-dash-s5-fix3 (cut from 386f6a0) and merged (fast-forward) into feat/jo-dash-s5-entry-command
       in the main checkout: the batch e46a0da, the review's findings 8f4fe50, the house-rule-18 wording 3934148, the handoff
       fb47fc6 (bus header + canary), then this comment with the token filled into the Fix notes and the re-bank. Plugin stays
       0.51.0, unreleased; the round is folded into its CHANGELOG entry.
     Root cause first (F-519): the adapter's resume counted a prior "split" record as reused whatever the family; for a unit
       with nothing left to cut on (the whole survey family, the samples) that record WAS the failed attempt, so one server
       timeout was replayed as final by every later run. A split record is now reused only as the decision to cut a unit
       that can be cut (`cutsOf`, shared with the plan's remainder); a failed or unsplittable-split record is made afresh,
       with the runs it failed in carried (`runs`), and the partial stop names what failed and says the next run retries it.
       The tester's evidence was read in the workspace, never copied.
     F-518: the plan prices its remainder (`thisRun.remaining`, the units whose answers are not on disk, a cut unit by its
       unanswered halves) and the refresh's budget and resume line read it; the closing ask's login clause is one function,
       the edit's pull carries it. F-511 instance 27: the ruled wording verbatim, held ONCE as data (`HOW_TO_REFRESH` in the
       runtime beside `COPY_LINES`), drawn stepped on the About tab and as the paragraph the closing step and the save summary
       carry; `MANUAL_REFRESH_TEXT` is gone (the alias the review flagged). F-505: "N programs sent in this window, M
       selected", rows dimmed by status or no sends in the months (the months and statuses alone), the summary counting
       programs with rows (`scope.programsWithRows`). F-507: `token.withProposals` and `token.afterPullSeconds`, the skill's
       two asks pricing a budget against them. F-508: the direction in `describePanel` and the in-page ranking note. F-509:
       each caveat clause on its own count.
     Ordering decision: nothing re-arranges what the fourth sitting verifies; no ruling was owed (the DSH-3 block's wording
       applied verbatim). No open polish is left behind: F-505, F-507, F-508, F-509 ride this token.
     Verified offline: suites dashboard 91, dashboard-page 181 (goldens regenerated twice: the About tab's new section, then
       the review's runtime fixes), engagement 349, engagement-query 135 (its golden gained `programsWithRows`),
       dashboard-spec 46, engagement-report 55; typecheck clean (the checker devDependencies installed in the worktree);
       the verbatim battery on 8f4fe50: 47 green of 49 real steps, 7 skipped (the dev-only strip, the build diff, the
       no-dev-content check, npm ci, the bus-header fetch, the path decision), the one red the report suite's bare-word
       check on the F-507 prose, fixed at 3934148 and re-run green with the three doc gates; a second red was the runner
       misreading a YAML expression. `/code-review medium`: 9 findings, 6 applied (the dim reason ignoring group filters;
       the search lost on a status repaint; a cut unit priced whole; the `not-found` wording; the no-folder page warning;
       the alias), 3 recorded and skipped: the paragraph form's period after the command (the ruled wording verbatim; the
       About tab carries the Copy button), the top/lowest phrase in two modules (the runtime cannot import the spec writer;
       the spec suite pins both), the `<kb>` placeholder on a page built by hand with no folder (the builder's warning now
       says so). Mutation sweep: vacuity check, no predictions recorded.
     Owed: the fourth sitting (VALIDATION § DSH-3, re-banked under hb-20261013-01: I15's resume arm, the statement read by
       Bradley, F-518's two lines, F-505/F-507/F-508/F-509 on the real pages and a real plan); CI on the pushed head 6d42f19, per job: validate-plugin run 38441017569 changes, manifests, validate (ubuntu-latest) success; docs-drift run 38441017557 drift (full) success; the worktree removed at close.
-->

<!-- builder 2026-10-13 (PR #47 CI RED ON d364297, FIXED AFTER S5-V's THIRD SITTING CLOSED — UNMERGED, riding feat/jo-dash-s5-entry-command; next free F-520):
     validate (ubuntu-latest) failed on d364297: the F-512 walk's abandoned run and its replacement were named by the
       same second-stamp (`dash-<slug>-<yyyymmddThhmmss>`), so on a fast runner the fresh run landed in the abandoned
       run's directory. Timing-only; unreachable on a tenant, where the two events are minutes apart. Class: a run or
       snapshot name stamped to the second is not unique; fix: the first of `base`, `base-2`, ... that no directory or
       file holds (`freshName` in dashboard.mjs), and the walk forces the collision through `--now` so it is
       deterministic. Built on feat/jo-dash-s5-fix2b (d9d7bcf) while the third sitting ran, held off the branch until
       its close-out (9a7b5b9, 8422399) was pushed, merged as 6fb51c5. Not covered by the third sitting's verdict;
       pinned by the entry-command suite (85 checks). CI on the head 6fb51c5, per job: validate-plugin run
       38429444954 changes, manifests, validate (ubuntu-latest) success; docs-drift run 38429445059 drift (full) success.
-->

<!-- builder 2026-10-12 (JO-dashboards S5 FIX ROUND 2 HANDED OFF — UNMERGED, riding feat/jo-dash-s5-entry-command (PR #47 to dev, still open); F-503, F-506, F-511, F-512, F-513, F-514, F-515, F-516, F-517 FIXED on that branch; token hb-20261012-02; VALIDATION § DSH-3 re-banked for S5-V's third sitting keyed to it; F-505, F-507, F-508, F-509 (polish) carried; next free F-518):
     Built in a worktree on feat/jo-dash-s5-fix2 and merged (fast-forward) into feat/jo-dash-s5-entry-command in the main
       checkout: the batch f6e7095 (on the checkpoint 5a46626), the review's findings 8f0942e, the tester's second-sitting
       commits merged in on the way (0848d69, 959eb47), the handoff 1550a72 (bus header + canary), then this comment with the
       Fix notes and the re-bank. Plugin stays 0.51.0, unreleased; the round is folded into its CHANGELOG entry.
     Scope, as the kickoff and the tester's update named it: F-513 (the budget gate gone: the pull checkpoints across
       logins and says how many; the login dying under re-documentation is the same stop), F-512 (a pending run whose
       settings moved is abandoned and planned afresh), F-515 (the proposal from the plan's selection with the reducer's
       traits, the model code beside its name, ungrouped at both levels, the About tab by display name and once), F-516
       (an edit goes to the closing step with its consequence; a preview from the last pull with no call), F-514 (Bradley's
       ruling at kickoff: a numbered list in chat for any question over four options, never "Other"), F-503 (every copy
       line, the About tab's refresh line and the README's recipes carry --kb; dashboard-page takes --kb), F-517 (the
       scheduled recipe per OS), F-511 instances 21–26 with the two prose guesses, F-506 (one caveat entry per part).
       Builder's calls named: F-506 taken; the Groups part shown twice fixed here (trivial), not UX-3's; the `stale` word
       on the schedules panel's doc-age mark kept (not freshness; no ruling against it).
     Ordering decision: nothing re-arranges what the third sitting verifies; the one ruling owed (F-514) was taken at
       kickoff before any code. Work order was root cause first (F-513's gate, F-512's abandon rule, F-515's traits), then
       the edit, then prose.
     Verified offline: suites dashboard 85, dashboard-page 180 (goldens regenerated), dashboard-groups 42, dashboard-spec
       46, engagement 348, engagement-query 134, engagement-report 55, contract 300, theme 24; the verbatim battery on the
       committed tree 55 green of 55 (battery #1 on the mid-review tree 54 of 55, its red the git-diff step over the
       then-uncommitted review fixes); /code-review medium over the branch's diff: 10 findings, 9 applied (the
       group-level-only spec's ungrouped count, the login dying under re-documentation, the "1 more login" floor, the
       change pricing's scale order, the edit context and the model-name map computed once, --fast-path on an edit said,
       the edit's dry run from the last pull, dashboard-page --kb), 1 skipped and recorded (`show` says a model rule by
       its code: the spec holds no display names and T-11 is frozen). Mutation sweep: none this round (vacuity check, no
       predictions recorded).
     For the third sitting (SESSION-PROMPTS.md "S5-V, third sitting"): VALIDATION § DSH-3 I4, I8 (new flow), I10 (a pull
       above one login, F-512's change between stop and resume), I13 (the edit), I14 (the copy lines with --kb), I15 (the
       scheduled recipe from the README alone), and the re-verification of each FIXED section on its Fix line. Blind
       spots on the header's line. CI on the head 0aa1c85, per job: GitGuardian pass; validate-plugin run 38342118878
       changes, manifests, validate (ubuntu-latest) success; docs-drift run 38342118894 drift (full) success.
-->

<!-- builder 2026-10-12 (JO-dashboards S5 FIX ROUND HANDED OFF — UNMERGED, riding feat/jo-dash-s5-entry-command; F-511 and F-512 FIXED on that branch (PR #47 to dev, still open); token hb-20261012-01; S5-V's first sitting is on the branch at 6fcf7d3; next free F-513):
     Branch commits: the batch 73c85a0 (the questions table as Bradley ruled at S5-V's I0, the fast path through each
       question's own default, the four first-sitting notes), the handoff d4c2032 (bus + canary), the bus commit 1254525
       (the Fix notes, VALIDATION § DSH-3 I1–I10 re-banked on the new table, § UX-2 B1–B4 with the file and pasted-values
       paths, K4's bar moved to the tabs question) and ef381cd (battery #2 quoted). Plugin stays 0.51.0 on the branch,
       unreleased; the round is folded into its CHANGELOG entry.
     Statuses that ride the branch: F-511 FIXED, F-512 FIXED (both polish; their Fix and Judge lines are on the branch's
       bus). F-505..F-509 (polish) carried, not this round's scope. No new number claimed.
     Next: S5-V's second sitting from the workspace with --plugin-dir (SESSION-PROMPTS.md): I1–I10 on the new table,
       B1–B4, R8, the re-verification of F-511 and F-512, then the release-scope ruling. CI on ef381cd owed as a per-job
       quote on the branch's bus once it completes.
-->

<!-- builder 2026-10-12 (JO-dashboards S5 FIX ROUND HANDED OFF — UNMERGED; F-511 and F-512 FIXED on feat/jo-dash-s5-entry-command → PR #47 to dev; token hb-20261012-01; VALIDATION § DSH-3 and § UX-2 re-banked for S5-V's second sitting keyed to it; F-505..F-509 carried; next free F-513):
     Scope: F-511 (the questions table and the skill prose as Bradley ruled at I0: the tenant statement, four questions dropped with their fields left in T-11 unread, the window after the programs with one plan serving both, the leaders' names after the customer lists and skipped while the lists are off, one follow-up ask per placeholder value with the skill composing the id, the closing step, the stale banner and cadence gone with "Data pulled <time>, N days ago" and the not-live sentence in the header, the brand-skill path removed, K4's category-cost quote on the tabs question) and F-512 (the fast path through each question's own default, the characteristic group rules, no placeholder slug). The four first-sitting notes taken: the save continues the closing step's plan; a budget-refused stale-lock takeover is recorded; the lookback tie says derivedFrom; the unsubscribe rule reads the singular. Contract freeze held: T-10 and T-11 unchanged; no field removed (cadence and freshness stay, unread).
     Battery: battery #1 on the working tree, 50 green of 55 run (3 skipped): the reds are the known tsc error in the git-ignored handoffs tools/run.mjs, the full build's date stamps, and three clean-tree checks that are CI-only (red on any uncommitted tree; one of them, docs-drift's release-tree strip, git-rm'd dev/ and the canary from the checkout and was restored from HEAD before any bus edit); battery #2 on the committed tree: 48 green of 51 run (7 skipped: CI plumbing, the release-tree strip and the clean-tree diffs); the reds are the two known local ones only, the tsc error in the git-ignored handoffs tools/run.mjs and the full build re-stamping generatedAt (date stamps only, reverted). Suites: dashboard 70, dashboard-page 179, dashboard-spec 46, engagement 348, engagement-query 134, engagement-report 55, contract 300; two page goldens and the report golden regenerated (the link rule's text; the header and About). /code-review medium (inline, eight angles): 7 findings — 3 fixed before the commit (an unused binding and an unused import under the type gate; a bare renameSync the drift gate refused, replaced by reusing the plan directory under its own name), 4 recorded and skipped (orphaned plan directories accumulate per re-plan; the programs-with-failures count is the larger of the two sample parts, no union in the plan; a whoami per closing-step `next`; the loose plan key still moves for a window shorter than the silent threshold).
     For the second sitting: I1–I10 on the new table (I2 and I6 as re-banked: no purpose, no cadence; the closing step is I10), B1–B4 with the file and pasted-values paths only, R8, the re-verification of F-511 and F-512 on their Fix lines. Polish carried: F-505..F-509 (not this round's scope). CI on the head ef381cd, per job: GitGuardian pass; validate-plugin run 38316958569 changes, manifests, validate (ubuntu-latest) success; docs-drift run 38316958510 drift (full) success.
-->

<!-- tester 2026-10-12 (S5-V FIRST SITTING @ hb-20261011-02 — UNMERGED, riding feat/jo-dash-s5-entry-command; PR #47 stays open until the second sitting passes; next free F-513):
     Launch: the desktop-app session loaded the marketplace copy (no canary); resumed in a terminal from the workspace
       folder with --plugin-dir, the canary matched and the guard armed (the V2.5 resume from the repo had left it inert).
     The round split at I0 on Bradley's ruling: the as-built interview would re-find what his read of the 22 wordings
       already ruled (F-511), so I1–I10 and B1–B4 run once at a second sitting after the builder's fix round, and the
       mechanical arms ran today on a fast-path dashboard (one saved dashboard, four refreshes, one priced plan, one
       export/import into a KB copy since removed). I0, I11, I12; R1–R7, R9; K1–K5: all PASSED; R8 deferred.
     F-502, F-503, F-504 VERIFIED (the Verified: lines carry the live half). Logged: F-511 (polish, the interview
       wordings with every ruling), F-512 (polish, the fast path's defaults). Not logged, for the builder's call (and in
       the fix-round prompt): the save re-plans from scratch (about 3 minutes of cheap calls repeated); a stale-lock
       takeover by a run then refused on budget leaves no record; the lookback tie (longest period = silentDays) reads
       derivedFrom null; the "manage-preferences" link term wants the plural; --health-only still makes the whole health
       family's calls (1410 s here).
     Bus: 6edf411 (interim) and this close-out commit on the branch; CI on the pushed head owed as a per-job quote.
     Next: the builder's fix round on the same branch from the plan's DSH-3 rulings block (the prompt is in the
       maintainer's SESSION-PROMPTS.md beside the plan), a new token, then S5-V's second sitting (its prompt beside it):
       the interview and the brand step walked by Bradley, R8, the re-verification of F-511 and F-512, CLEANUP § S5 and
       the RELEASE-SCOPE ruling. The saved dashboard keeps kb.redocument.enabled false until then.
-->

<!-- builder 2026-10-11 (JO-dashboards S5 HANDED OFF — UNMERGED; PUB-1, DSH-3 and UX-2 built on feat/jo-dash-s5-entry-command → PR #47 to dev; token hb-20261011-02; no bus section rode this session; three VALIDATION sections banked for S5-V, where Bradley walks the interview himself; F-502..F-509 carried; next free F-511):
     Branch feat/jo-dash-s5-entry-command, cut from dev at 386dc36; the feature commit cddc02e (one squash), the handoff
       commit f78eda2 (bus + canary), the validation commit f9a64a1 (the three sections keyed to the token). PR #47 is
       left open: it merges after S5-V's verdict on green CI plus the session's /code-review round. Plugin 0.51.0 on the
       branch, unreleased (0.50.0, 0.49.0 and 0.48.0 unreleased beneath it; the release is the maintainer's).
     What shipped (the plan's As-shipped (S5) notes under PUB-1, DSH-3, UX-2, DSH-1, DSH-2, ENG-3 and ENG-2 have the
       detail): PUB-1, the ONE deterministic entry command scripts/dashboard.mjs — verbs new / next / answer / change /
       save / list / status / refresh / rebuild / report / export / import / health / costs / questions; it imports the
       five scripts (the spec writer's verbs became specStore() functions, the report's writeReport, the adapter's
       prepareRun; A-10 holds: dashboard.mjs never writes a spec file) and spawns only manifest.mjs and
       describe-batch.mjs for re-documentation; refresh = whoami pre-flight (exit 5 wrong-tenant before any tenant call,
       exit 3 token-expired, resumable), a workspace lock stale after two hours, the plan with the lookback derived
       from the longest schedule period, the budget against the token, re-documentation under kb.redocument.cap (50,
       off-switchable; ONE predicate, the adapter's kbGap; ONE re-documenter, the existing manifest/describe-batch
       scripts, so /gs-superadmin:refresh is untouched), the pull, applyGroups, retention 13, the delta to the exec
       strip, pages all-or-nothing (a partial or failed run leaves every last good page), exit 4 partial. DSH-3, the
       QUESTIONS table as data (22 rows; about 20 asked on the main path, the fast path answers all but the estimate
       and the save) with next / answer as the interview's two verbs and the skill as the thin front door (three
       judgment nodes the only deciding prose; house rule 18 holds). UX-2, the look question: brand input as data the
       prose reads, tokens through S4d's validator with replacements noted, a logo from a local PNG/JPEG only, skip the
       fast-path default and never asked twice. DSH-2 ruling 4 in the adapter (accounts.lists[] / fields[], the
       low-cadence rule, cross-program selection in reduce, R24 off by default) with the snapshot, query, report and
       page goldens regenerated; T-11 additive (window kind, quietDueDays / samplePrograms / expectedReasons,
       kb.redocument, the draft holder with --take-over, spec.json.previous); README recipes (on demand, --health-only,
       an OS scheduler or a Claude desktop local task — never a cloud routine — with the hour-long login stated, the
       hand-over export/import, the leaders' copy as a file copy with the SharePoint/OneDrive download note).
     Deviations, recorded in the plan: the grouping node's input comes from the cheap plan, not a dry-run snapshot;
       expected-QUIET programs not asked (nothing reads such a field; the expected failure reasons are); the question
       count is ~20, not the plan's "about 12" (every ruled addition is its own row); F-502..F-504 (normal) NOT taken
       (the kickoff scoped the session to the three items; the ledger's "ride S5" line is superseded for this session).
     Verified offline only, by the kickoff: the verbatim CI battery 48 of 51 on the checkpoint (the three reds: the
       tracer's enumeration of the new script, fixed with a rule-out row; the emitter, re-emitted; the known
       git-ignored handoffs tools file under tsc), re-run green where touched; suites dashboard 57 (new: the whole
       interview and refresh as a real process over the fictional tenant and the stand-in CLI), dashboard-spec 46,
       engagement 345, engagement-query 134, engagement-report 55, dashboard-page 177, contract 300; plugin validate
       clean; the build reproduces committed output (stamps only); typecheck clean but the known file.
     Review: /code-review medium, eight findings — seven FIXED with a check each where a check fits (the metrics
       "default" answer keeps the panels; the silent-threshold change cost refined by the longest period; the
       cross-program lists not status-filtered in the report; the preview snapshot read lazily; the change verb's
       JSON-quoting rule documented; a resume with other flags refused naming the run; lastPlan's ordering), one
       SKIPPED and recorded (the hand-listed boolean flags in the argv split).
     Noticed, not changed: the adapter writes KB-gap keys as journey/<id> whatever the domain folder is called
       (pre-existing); F-507 untouched in the adapter (the runner budgets the gap-fill itself); the page has no
       per-segment customer-list view yet (the selection is in the snapshot for one); on an edit the metrics question
       cannot restore a metric left off earlier (that is `change pages.N.panels=[]`).
     Carried: F-505..F-509 (polish) stay OPEN for the next builder round. AMENDED 2026-10-11, the same session: F-502, F-503
       and F-504 FIXED on the branch on Bradley's call (the kickoff prompt had scoped them out; the plan's ruling that they
       ride S5 stood), with a check each (the F-502 fixture programs p-oneday, p-twoday, p-rerun on the signals tenant;
       the T-10 program dimension gains schedule.oneRunWindow, additive), plus the metrics question restoring a metric
       left off earlier on a preset-derived page; the goldens regenerated; banked as VALIDATION § F-502 / F-503 / F-504
       K1–K5 for S5-V. The three sections carry Fix and Judge lines (on the branch's bus until the merge).
     CI on PR #47's head f9a64a1, per job: GitGuardian Security Checks pass; validate-plugin run 38205208768 — changes
       success, manifests success, validate (ubuntu-latest) success; docs-drift run 38205208777 — drift (full) success.
       The S4d-owed validate-plugin dispatch on the merged tip (run 38191969253): changes, manifests, validate
       (ubuntu-latest) all success.
     Next: S5-V (Bradley walks the interview: § DSH-3 I0–I12, § PUB-1 R1–R9, § UX-2 B1–B4), then PR #47 merges; UX-3
       waits for his confirmation in the plan.
-->

<!-- builder 2026-10-11 (JO-dashboards S4d MERGED — PR #46 merged to dev (c6bf65b) on green CI plus the session's review round plus Bradley's sign-off on the final screenshots; nothing logged; next free F-511):
     Merged on Bradley's go-ahead, as a merge commit (as #36 to #45 were); the branch deleted, local and remote; no PR
       open to dev at close. CI on the head 7ce1db3, per job: GitGuardian Security Checks pass; validate-plugin run
       38190646273 — changes success, manifests success, validate (ubuntu-latest) success; docs-drift run 38190646284 —
       drift (full) success. The /code-review medium round (five findings: one fixed, one recorded for UX-2, three
       dismissed in the PR body) is the review half of the gate. Plugin 0.50.0 now on dev, unreleased (0.49.0 and
       0.48.0 unreleased beneath it; the release is the maintainer's). A validate-plugin dispatch on the merged tip was
       started at close (run 38191969253); its per-job result is owed here by the next session.
     Carried to the next builder round, as the handoff comment said: F-502..F-504 (normal) and F-505..F-509 (polish).
     Next: S5 (PUB-1, DSH-3, UX-2) from dev; UX-2 reads the theme section of the plan's As-shipped (S4d) note. The
       proposed UX-3 slot waits for Bradley's confirmation in the plan.
-->

<!-- builder 2026-10-11 (JO-dashboards S4d HANDED OFF — UNMERGED; UX-1 built on feat/jo-dash-s4d-ux → PR #46 to dev; token hb-20261011-01; no bus section rode this session; Bradley signed off on the final screenshots in the session; next free F-511):
     Branch feat/jo-dash-s4d-ux, cut from dev at 7481c46; the feature commit 6269dae, the handoff commit 7ce1db3 (bus +
       canary). PR #46 merges on green CI plus the session's /code-review round plus the sign-off already given. Plugin
       0.50.0 on the branch, unreleased.
     What shipped (UX-1; the plan's As-shipped (S4d) note has the detail): presentation only, every visual value a token.
       Two design rounds with Bradley over the fictional fixtures in the browser pane. Round 1: tabs above a per-tab
       filter bar (the headline first), the program picker, lacks pointers in the bar with the notice where the data
       would be, the Health tab grouped by what the months reach, Show columns + Download current view (CSV), the
       Templates nesting folded with kind labels and the text drawer in place, charts tidied, About reordered, AA
       contrast in both schemes, print on light tokens. Round 2 (his second list): name-on-top filters, a status picker,
       switches for the binary filters, values on every point and bar, sortable scrolling tables with Default order,
       marks and info icons as hover/focus/click tips, cron in words. The T-11 `theme` section (additive; T-11 stays
       schemaVersion 1) and scripts/dashboard-theme.mjs: the default theme as data, the validator (AA text, 3:1 control
       border, distinguishable series under simulated colour-blind vision, a derived dark set, per-token fallback with
       notes), four theme fixtures, a 24-check suite. Golden pages re-baselined twice (once per round). CI steps:
       AGENTS.md and validate-plugin.yml list the new suite; a MAINTAINERS row.
     Review: /code-review medium inline, five findings — the picker popover off-screen under 600 px FIXED; a partial
       light palette with a dark background replaced token by token recorded for UX-2 (the interview collects full
       sets); three dismissed with reasons in the PR body.
     Carried, not this session's scope (UX-1 only, by the kickoff): the V2 polish F-505..F-509 stay OPEN for the next
       builder round; F-502..F-504 (normal) likewise. Proposed to Bradley at sign-off and recorded in the plan: a second
       UI/UX session (UX-3) on real data after S5-V's fix round, before the release scope is set.
     CI on PR #46's head 7ce1db3 was running at close (3 checks green, 2 pending): owed as a per-job quote here.
     Next: S5 (PUB-1, DSH-3, UX-2) from dev once PR #46 merges.
-->

<!-- tester 2026-10-11 (V2 SECOND SITTING "V2.5" @ hb-20261010-01 — X4, X7, X8, X9 PASSED; ENG-3 / ENG-4, DSH-4, TPL-1 / TPL-2 CLEARED; the owed T0 / D0 rulings recorded; F-510 WONTFIX by ruling; nothing logged; next free F-511):
     Under test: dev, clean and level with origin at 2a6ff17 (the first sitting's bus commit; no plugin file changed). Canary: the session
       resumed from the desktop app read no dev-canary (the app loads the marketplace's 0.43.4 copy), so it was resumed in a terminal with
       --plugin-dir; the gs-superadmin:dev-canary skill then reported hb-20261010-01, matching the Under test line. Its cwd is the repo.
     Tenant: production, whoami shown and confirmed by Bradley before the first call (R11); reads only, one call at a time; two re-logins
       at the tester's request ahead of X7 and X4 (no call reached the tenant on an expired token).
     Round type: the continuation of V2 (acceptance): nothing the first sitting did was redone.
     ENG-3 / ENG-4 (CLEARED): X9 PASSED on its bar (plan 195 programs / 299 calls / 2115 s; the skill stated it in one line and asked,
       offering the pull, --sent-since 90d or stop); deviation of record: Bradley chose the pull over the banked stop ("a more comprehensive
       view"): 315 made + 11 reused, 76 split, 0 retried, 2080 s wall, exit 0, four reconciliation checks ok, the pulled-at one second after
       the run began; 65 shown of 195, a watch list for 55 programs. X7 PASSED: estimate.mode selective; the header says selective and names
       the earlier pull's time; the caveat lists the eleven carried months; the closed carried month equal on every cell for the three
       picks across the two snapshots through runQuery, the new rows marked carried; the re-read month equal too. X8 PASSED in a fresh
       workspace session typed by Bradley: Skill(gs-superadmin:email-engagement) ran, report mode, 1 of 573 programs selected, "Plan: 1
       program, 25 calls, ~3 minutes. Pulling now." before the pull, the answer the Programs row's figures as written. X4 PASSED: the
       estimate before the pull (75 calls / 547 s); a watch list for all three programs with both tables; the minimum delivered stated (10)
       and every low-engagement row at 40 or more; no all-other or no-company row (the one hit is the glossary's sentence); the pick
       (the first row of P-busy's low-engagement table, fixed before reading) equal to three direct counts filtered on the company over
       the window; Emails by step present with step and variant names (10 rows); Participant records numbers; the workbook's seven
       sheets (openpyxl under the xlsx skill). Bar defect noted on X7: the report script takes no --from/--to.
     TPL-1 / TPL-2 (CLEARED): T0 choice (5) with the scratch text-less leaders' build open: the Templates tab KEPT on a text-less leaders'
       page, the notice REMOVED (names and figures only; naming an absent search invites a request for it); a later option, subjects shown
       but not searchable on a leaders' page, is backlog (LTR-16); Bradley's open question on how the email nesting reads parks for S4d.
     DSH-4 (CLEARED): D0 (2) three panels CONFIRMED, the parenthetical dropped from the three titles; (3) the one-time months knob CONFIRMED
       as a display width, with the layout ruling for UX-1 that the tab strip sits above a per-tab filter bar (the Health tab ignores the
       month filter by design and only one panel says so); (4) refresh-only notices CONFIRMED; (5) the generated How-to-use prose CONFIRMED
       as the mechanism, wording to UX-1 (its first sentence claims the filters narrow every panel, and "every table has Columns"
       overstates: the customer lists and health tables have none); (7) Sent locked beside a rate CONFIRMED, the Columns control's
       presentation a UX-1 discussion item; (8) 5% fixed CONFIRMED (the Other row is always counted; 5% only arms the notice). Backlog
       from (2): a confidence-adjusted engagement score column on the customer lists (LTR-17; the delivered floor of 10 holds).
     F-510: WONTFIX on Bradley's ruling; the category entry appended to the tenant's workspace file (56 bounce entries, the plugin's
       validator clean) with a dated copy beside it; from the next health pull the sample's exclusion filter drops those rows. The
       cross-tenant residue (the mask misses a domain written with a space) is backlog LTR-18. DSH-3 note: a hand-written definition is
       extra ceremony for an admin; the interview should default it from the label.
     Guard-wiring: see the Walk line. The hooks ARE registered here (/hooks lists the plugin's PreToolUse entry); the guard is inert
       outside a workspace by design, and this session's cwd is the repo. Backlog LTR-19: whether the guard should arm on any gs-admin
       invocation rather than only under a workspace.
     Blind spots: every gs-admin call this sitting made from this session ran unguarded (all reads); the approval prompts are invisible
       to the tester (Bradley pasted the fresh session's ask and reported none here); X8's estimate line is Bradley's report; the
       accounts-on full pull's 55 watch lists were not read beyond the summary; D3 stays a cursory read; the sort flip stays unmeasured.
     CLEANUP § V2: repo side done; validate-plugin run 38176231687 on 2a6ff17 (conclusion in the ledger); workspace deletions deferred to
       § S4d on Bradley's say-so (the real pages are wanted for UX-1); the 278 gap-filled template docs confirmed registered through the
       manifest (278 entries documented 2026-10-10 of 810). Rulings, addenda, backlog and notes recorded in the maintainer's plan. -->
<!-- tester 2026-10-10 (V2 FIRST SITTING @ hb-20261010-01 — the batched verdict after S4c, paused by Bradley to finish in a second sitting V2.5; ten FIXED findings VERIFIED; F-502..F-504 normal and F-505..F-510 polish logged; next free F-511):
     Under test: dev, clean and level with origin at c758021 (the S4c branch merged at a4c01a6 and deleted; no plugin file changed after the
       handoff commit); the gs-superadmin:dev-canary skill read hb-20261010-01 in session, matching the Under test line; plugin loaded from
       the working tree (the workspace's plugin link resolves to it).
     Tenant: production, `whoami` shown to Bradley and confirmed before the first call (R11); reads only, one call at a time. The token
       expired once mid-round (before an email-report sweep); Bradley logged in again; no call reached the tenant on an expired token.
       Bradley re-logged twice more ahead of long batches at the tester's request.
     Round type: ACCEPTANCE for the feature items (first verdicts) and RE-VERIFICATION for the ten FIXED findings (on Bradley's call at
       kickoff). T6 (the two-sitting completeness check) ran first, from the tree: every part present; six suites green in the tree;
       two bank proxies read differently than written (an identifier line count of 7 against "at least 12", all five names defined once
       each; the exec golden carries no Templates panel because the fixture's exec tab is off) — nothing absent, no finding.
     Contract rulings (T0, D0): TPL-1's six executor's choices confirmed (one with a backlog note; the gap-fill driver after three rounds of
       scenarios). Bradley then asked for visuals before ruling on the rest; those were put to him with the real pages: TPL-2 columns
       overruled (a state column yes/no/unclear/unknown beside a separate last-modified column, both sortable), the drawer wording kept,
       the Text button kept (open in place noted), names searched regardless of text (overruled); D0 host confirmed, the kpi "usual"
       confirmed with a backlog note. Owed to V2.5: TPL-2's text-less leaders' tab; D0's customer-list panels, one-time months, health
       notices, About prose, Sent-not-hideable, the 5% threshold. All recorded in the maintainer's plan.
     Calls: the skill walk over every program with sends (plan 35 / 267 s; gap-fill 278 templates in 556 s against 834 estimated, 0 failed;
       re-plan planned 0; pull 36 made + 10 reused, exit 0, reconciled); the adapter refresh with health, the KB, the tenant's category
       file and two test accounts (plan 449 / 3473 s with 95 s of token to spare; run 443 made + 19 reused, 0 split, 0 retried, exit 0,
       all eleven parts, 1757 s; health calls 404 against 408 planned); X2's one-program one-month pull; 12 direct reads through the
       spike's runner (X2, Y4, Y5, Y7, the (p1) arm); one email-report sweep (3 pages, reconciled); the KB writes were the gap-fill's
       (278 template docs through the plugin's own verbs, the manifest recording them) and the round's spec, snapshots and pages.
     Results (detail per check in the five VALIDATION sections):
       ENG-3 / ENG-4: X0 PASSED (deviation: the full set, not the three picks, on Bradley's call; the workbook written with openpyxl rather
         than the xlsx skill), X1, X2 (four direct counts equal the report row, open rate to one decimal), X3 (Bradley's UI read of the
         four email steps against the three template rows, one "(on 2 steps)"), X5 (548 / 67 / 36 equal the analytics page; the 2 internal
         test responses are the ones the rule leaves out), X6 PASSED (data-pulled inside the run step's wall clock; click cells equal the
         snapshot's state on 65 program and 119 template rows; the caveats present). X4, X7, X8, X9 NOT RUN: V2.5.
       HLT-1 / DSH-1 / DSH-5: Y4, Y5 (both-flags unexercised: 0 on the pick's month), Y7, Y9 (8 of 10 read right; the two disputed read
         by Bradley as hand-fed recurring / unsure — not a wrong assignment), Y10 (two labelled folders exact, an unlabelled one reads
         "Folder <id>", a startsWith name rule for the tenant's convention), Y11, Y12 (one wording polish, F-508) CLEARED; Y2 re-read
         clean on the snapshot (0 addresses / five-digit runs / IPv4 in 2740 texts), the payload shape logged F-510; Y8 CLEARED on its
         as-of and caveat clauses (its run-state clause moot since F-491: those fields are unset on this tenant). Spike arm (p1)
         ANSWERED (SPIKE-NOTES). The section is CLEARED.
       DSH-2: Z1 (both halves), Z3 (every filter, the engine equal on both recorded states), Z4, Z5 (offered tab, accounts-off in the
         three places and the filter, the recipients toggle), Z6 (Excel: 0 formula cells, rates as fractions, visible columns only;
         neutralisation unexercised, no name starts with an operator), Z7 (2.33 / 0.70 MB; 211 ms to load; sub-second redraws, by
         Bradley's feel too), Z8, Z9, Z10 CLEARED. The section is CLEARED; F-503 and F-505 logged from it.
       DSH-4: D1 (health 0.21 MB on the page, no sample table, every bounce row categorised), D2 (six panels; the chips move the lists;
         the Other signal; the expected toggle), D3 (dark: "seems ok"), D4 (0 domain values, 0 link values, 0 template text, no Health
         or Templates tab, definitions without source detail), D5 (5 of 5 rows equal the report; a tile equals the total row; the lists
         equal programHealth), D6 (lists read right; the Finished / Schedule ended split questioned: F-502), D7 (stale and lost-part
         banners on the admin pages, none on the leaders'), D8 (two health CSVs open clean) CLEARED. OPEN only on D0's remaining choices.
       TPL-1 / TPL-2: T1 (the gap-fill end to end; 278 docs with their link readings: 220 none-tracked, 24 tracked, 34 unreadable; the
         Subject column on 119 of 119 rows), T2 (two edited, two not, one recently sent, as Bradley knows them), T3 (three terms against
         email-report: 20 = 20 and 56 = 56 in scope; the token-label term 35 against 1, the 34 extra all merge-field labels — the
         documented divergence), T4 (Bradley recognised the text; a readability note to backlog), T5 (a tracked never-clicked template
         reads a real 0%, a links-none-tracked one "Not tracked", an unreadable one "(tracking unknown)"; the plan's unread 104 -> 0),
         T6 CLEARED. OPEN only on T0's one remaining choice.
       FIXED set: F-485, F-486, F-492, F-495, F-496, F-497, F-498, F-499, F-500, F-501 VERIFIED (verdict lines under each).
     Logged: F-502 normal (an ended one-run cron window with nothing in flight reads Schedule ended, not Finished; the grouping trait
       follows; Bradley's ruling after the two-day case was named); F-503 normal (copy lines for list-nested settings carry `[]`
       placeholders and miss the writer's dotted-path grammar); F-504 normal (refresh cost scales with categories x classes: 330 calls
       for 55 categories; the seconds estimate 2x high); F-505 polish (the program list and its count say neither what set they hold nor
       follow the month and status filters); F-506 polish (two caveats share one id; the page keeps one); F-507 polish (token.fits
       ignores the gap-fill it quotes); F-508 polish (a panel description reads "the top N" for a lowest-N sort); F-509 polish (the
       unclassified caveat fires with "0 ... of 0" when only the step part has unknowns); F-510 polish, proposed WONTFIX (an address
       whose domain the server wrote with a space reaches the terminal-only sample payloads; the ruled remedy is a tenant category).
     Rulings and notes in the maintainer's plan: R10's drill level answered (program and email suffice); the one-day-window shape under
       LTR-11 and as a DSH-3 trait hint; six "feels wrong" notes for UX-1 / DSH-3 (status quick-pick back to "sent in this window",
       the program list on click, the filter bar's layout and Reset placement, the two notices in the filter bar); backlog items for a
       day-grain edited flag, the tile basis, and a formatted plain-text drawer.
     Blind spots:
       - The mutating-command guard path was not probed this sitting (owed to V2.5), and the approval prompts are invisible to the
         tester (Bradley pasted none this sitting).
       - X4 (accounts and step detail), X7 (selective refresh), X8 (a plain question in a fresh session) and X9 (the ask before a long
         pull) are unmeasured; the account grain was pulled by no run this round.
       - D3 is Bradley's cursory read; the designer's pass is S4d.
       - The driver's name-sort second click hit a detached header (a probe fault); the sort flip is unmeasured by the driver.
       - The template gap-fill was measured on one tenant where every fetch succeeded; the failed-fetch path is the suite's only.
     Workspace (tenant data, never in the repo): the zz-test spec with its saved copy and export; the report snapshot and the dashboard
       snapshot in <slug>/reports-adhoc; the two pages and three scratch builds; the round notes, driver, direct reads and checks in the
       workspace's tmp folder; the 278 new template docs stay in the KB (CLEANUP-PLAN: kept). CLEANUP-PLAN section V2 NOT run.
     Owed by V2.5: X4, X7, X8, X9; the remaining T0 / D0 rulings; the guard-wiring line; Bradley's call on F-510's remedy; then
       CLEANUP-PLAN section V2 and the verdict addenda. -->
<!-- builder 2026-10-10 (JO-dashboards S4c MERGED — PR #45 merged to dev (a4c01a6) on green CI plus its review round, the plan's gate; no tester round before the merge; nothing logged; VALIDATION section TPL-1 / TPL-2 T0..T6 owed by V2 as banked; next free F-502):
     Merged on Bradley's go-ahead, as a merge commit (as #36 to #44 were); the branch deleted, local and remote. CI on the
       head 2a18433, per job: GitGuardian Security Checks pass; validate-plugin run 38091510476 — changes success,
       manifests success, validate (ubuntu-latest) success; docs-drift run 38091510563 — drift (full) success. The
       /code-review medium round (seven findings: three fixed, four dismissed in the PR body) is the review half of the
       gate. Plugin 0.49.0 now on dev, unreleased (0.48.0 unreleased beneath it; the release is the maintainer's).
     V2 runs next: T6 (the completeness check for the two-sitting build) first, from the tree, then T1..T5 on the tenant
       with the DSH-4 D0..D8, DSH-2, HLT-1 / DSH-1 / DSH-5 and ENG-3 / ENG-4 sections as banked. The local carry-over
       file the first sitting wrote is spent and removed.
-->
<!-- builder 2026-10-10 (JO-dashboards S4c HANDED OFF — UNMERGED; TPL-1 and TPL-2 built on feat/jo-dash-s4c-templates → PR #45 to dev; token hb-20261010-01; no bus section rode this session; verdict at V2; next free F-502):
     Branch feat/jo-dash-s4c-templates, cut from dev at 0b8f4b9 (S4b merged, 3de74e1); one WIP commit 761958c from the
       first sitting (stopped early on Bradley's request), the feature commit da34bdf, then the handoff commit f6a6081
       (bus + canary), then this comment. PR #45 to dev, open and UNMERGED: it merges on green CI plus its review
       round, before V2 (the batched verdict after S4c). Plugin 0.49.0 on the branch, unreleased.
     What shipped (TPL-1, TPL-2; the plan's As-shipped (S4c) notes have the detail): the adapter reads each referenced
       template's current text from the KB doc into dimensions.templates[].content (tokens rendered through
       jo-report's renderer; asOf, modified, the month-grain "edited after last send" flag; never HTML) and its
       link-tracking reading from the doc's new linkTracking bullet (doc-lib readLinkTracking with the engine's link
       rules; the --link-settings file still overrides); one new cheap base read (template-months) gives the plan the
       referenced set; the plan prices the template gap (missing, behind, unread) and writes the three files
       email-report's gap-fill commands take; the skill asks (fill at 50 or fewer without asking, else all / first 50
       / none) and runs register, mark, describe-batch within the budget, then re-issues the plan; the pull never
       fetches a template. T-10 additive (content, lastSendMonth, meta.templates, honesty.templates, four caveats);
       T-11 additive (the templates panel type with a snippet knob, pages[].templateContent, both presets' Templates
       panel, the F-486 refusal now covering the templates tab). The engine's templatesView, searchTemplateContent
       (mirroring email-report search; the A-6 differential over the fixture KB agrees on ten term sets with the two
       documented divergences: a term inside a raw token key, and a token's label) and templateContent; the runtime's
       Templates tab (sortable table, program and step drill, search form with marked snippets, the content drawer,
       CSV, the Emails and Steps tables' Text links; hash q/qa/qw/ts/td/tpl); a leaders' page carries no text unless
       the spec opts in; the size report counts the text's share; the ENG-3 report's Subject column.
     Verified offline: the verbatim battery, every suite green (engagement 338, query 134, page 159, spec 39, report
       54, contract 293, doc-lib 294, template-doc, describe-batch, jo-report, the tracer; data/reader-shapes.json
       moved as the renderer now observes the link maps), the four gates, plugin validate, npm run typecheck (the one
       red is the known git-ignored handoffs file), the plugin bundle rebuilt with no drift, npm run build at the
       pinned CLI reproducing the committed output (date stamps only, reverted). /code-review medium: seven findings,
       three fixed (an orphan template doc with no inventory entry routed to register-then-describe rather than to
       mark, which refuses such a key; the plan's referenced count carries designOnly beside it; a design-only
       template joined the fixture and the tests), four dismissed with reasons in the PR body.
     Banked for V2: dev/VALIDATION.md section TPL-1 / TPL-2, T0 to T5, keyed to hb-20261010-01 (the executor's choices
       for Bradley at T0 are listed in the As-shipped notes). Nothing logged on the bus; next free F-502.
-->
<!-- builder 2026-10-09 (JO-dashboards S4b MERGED — PR #44 merged to dev (3de74e1) on green CI plus its review round, the plan's gate; no tester round before the merge; F-486, F-492, F-495..F-501 stay FIXED for V2; VALIDATION section DSH-4 D0..D8 owed by V2 as banked; next free F-502):
     PR #44 (feat/jo-dash-s4b-views) was merged to dev on Bradley's go-ahead. The gate for S2 to S4c is green CI plus
       a completed /code-review round, with the one batched verdict at V2 after S4c (SESSION-PROMPTS header); Bradley
       asked whether a tester round was owed first, was told it was optional under that gate, and chose the gate as
       written. Merge commit, as #36 to #43 were; the branch is deleted, local and remote.
     CI on the PR head d48d863, QUOTED per job after completion: GitGuardian pass; validate-plugin 37998834674 changes
       success / manifests success / validate (ubuntu-latest) success; docs-drift 37998834652 drift (full) success
       (the push-triggered pair on 6caeaeb, 37998524693 and 37998524737, cancelled when the bus commit superseded them).
     CI on the merged tip 3de74e1, QUOTED per job after completion (re-stamped the same day): validate-plugin
       37999766315 changes success / manifests success / validate (ubuntu-latest) success — success; docs-drift
       37999766279 drift (full) cancelled (superseded by the bus commit bb4d205 pushed minutes later, whose docs-drift
       37999876437 drift (full) success — success; validate-plugin did not run on bb4d205, a bus-only change outside
       its paths). The dev tip bb4d205 therefore carries drift (full) success and the merged tip's validate suite.
     Statuses: unchanged from the handoff block below — the nine FIXED findings are verified at V2 by their Judge
       lines; F-495 (normal) gates the release, not the merge (the same ruling as the S3b close-out). The Under test
       line and canary keep hb-20261009-01 (a merged branch's last token, as after S4a's and S3b's merges); S4c's
       handoff re-stamps them.
     Plugin 0.48.0 on dev, unreleased (one release for the whole program). Open PRs to dev: none. Issues #11 and #12
       unchanged. Next: S4c (TPL-1 + TPL-2) from dev. -->

<!-- builder 2026-10-09 (JO-dashboards S4b HANDED OFF — UNMERGED; DSH-4 built on feat/jo-dash-s4b-views → PR #44 to dev; token hb-20261009-01; F-486, F-492 (third fix, with its Redesign line), F-495..F-501 FIXED; verdict at V2; next free F-502):
     Branch feat/jo-dash-s4b-views, cut from dev at 600326f; one feature commit 6caeaeb, then the handoff commit 729ab8c
       (bus + canary), then this comment and the flips. PR #44 to dev, open and UNMERGED: it merges on green CI plus
       its review round, before V2 (the batched verdict after S4c). Plugin 0.48.0 on the branch, unreleased.
     What shipped (DSH-4, the plan's As-shipped (S4b) note has the detail): the presets carry their panels (admin 16,
       exec 6; option A, Bradley's one design answer this session, from a rendered wireframe); five panel types (kpi,
       bar, line, table, watchlist) and four typed health views (health-silent {days}, health-reasons {showExpected},
       health-schedules {staleAfterDays}, health-one-time {months}) checked per type at change; T-11 additive
       (pages[].dateDefault, the health types, knobs optional); one engine function per view kind in
       engagement-query.mjs, the runtime laying out results only (PAGE_MODEL_VERSION 2); hand-drawn SVG from tokens
       with a table fallback; the About tab (R26); stale, health and caveats banners; the copy lines are the entry
       command's (change / refresh); the actions seam null on every page; a leaders' page without health or account
       names unless opted in, its recipients values withheld (keyed on the covers path).
     The kickoff batch, each with a Judge line: F-486 (presets cover every on tab; a listed set leaving one empty is
       refused; Templates draws its lack), F-492 (Redesign: the span suppressing the token and number rules only; the
       email, uuid and ipv4 rules over the whole text; the class test gained the URL-path address case), F-495 (bounce
       kind from the kind alone), F-496 (bounce samples labelled other; the caveat split by part), F-497
       (STEP_REMAINDER), F-498 (why on cannot-judge alone), F-499 (one pass), F-500 (comments), F-501 (kindOf with
       stored).
     Verified offline, the fictional acme fixtures and the signals KB variant only, no gs-admin call: dashboard-page
       148 checks (goldens page-golden-admin/exec.html), dashboard-spec 37, engagement-query 123, contract-conformance
       289, engagement 324, engagement-report 52, dashboard-groups 39, trace- and emit-reader-shapes; check-doc-drift,
       check-stale-facts, check-imports, check-instance-data green; npm run typecheck clean but for the git-ignored
       handoffs tool; claude plugin validate pass; the CI battery 43 pass with 4 known-cause reds (the date-stamp
       re-stamps of a full build and the same tsc line). /code-review medium on the tip: six findings, all fixed
       before the commit (knobs optional as the typedef says; the About redaction keyed on the covers path, not the
       label; one rate predicate in the engine; the caveats computed once per page; the threshold-over-window fallback
       pinned on a shortened fixture window; the cross-program watch list's CSV carrying its per-program rows, R27).
       Both presets looked at in a browser, light and dark.
     Banked: dev/VALIDATION.md section DSH-4, D0..D8, keyed to hb-20261009-01, owed by V2 (D0 is Bradley's reading of
       the As-shipped note: the executor's choices — the kpi usual as the closed months per month, the one-time months
       knob default 6, the 5% Other threshold, the chip set 14/30/60/90 beside the spec's own).
     Reload: /reload-plugins (scripts, tests and fixtures only; no skill, hook or MCP change, so no walk is owed).
     Blind spots (hb-20261009-01): on the header's line — no tenant pull; no mutation sweep over the new renderers;
       the kpi usual and the months knob are executor's choices; the About How-to prose is hand-written; light and
       dark judged by eye; the threshold fallback unmeasured on a short tenant pull.
     Noticed, not changed (for Bradley): a leaders' About describes the admin page's panels too (describeSpec lists
       every page's panels; the About reads the spec's own words); an admin Engagement tab over a pull with accounts
       off shows three accounts-off notices (one per customer list); the page suite's no-network check now allows a
       URL as TEXT (the About names vendor help links in prose, never as a request).
     CI on PR #44's head 6caeaeb: not quoted here — the runs were pending at close; quoted per job after completion in
       a re-stamp (F-340 rule). Open PRs to dev: #44 only. Issues #11 and #12 unchanged. -->

<!-- builder 2026-10-09 (JO-dashboards S3b CLOSED OUT — PR #43 merged (cb56423) after V4; F-484, F-491 VERIFIED; F-492 REOPENED (second), F-495 OPEN (normal), F-496..F-501 OPEN (polish) from the close-out review; F-486 still rides S4b; next free F-502):
     PR #43 (feat/jo-dash-s3b-health-batch) was merged to dev on Bradley's go-ahead, on green CI plus its review round.
       CI on the verified head f21733f (V4 at d52bebb, the pointer re-stamp after it) read per job: validate-plugin
       changes, manifests and validate (ubuntu-latest) pass; docs-drift drift (full) pass; GitGuardian pass (the tester's
       pointer comment above quotes the run ids). Merge commit, as #36 to #40 were; the branch is deleted, local and remote.
     The review round: the original batch (a5787bc) had its /code-review at the first handoff; the three fix rounds
       (30d69b9, f55d942, 3ee6d27 — about 1,400 lines in engagement.mjs and engagement-query.mjs) had none, so one ran
       today over a5787bc..f21733f at medium before the merge was recommended. Eight findings, none a merge blocker:
       the mask's protected URL span suppresses the email rule too (F-492 reopened, its second: polish, the samples are
       terminal-only and 0 addresses were measured on the tenant's texts at V2 and V3; rule 5 owes a Redesign: line);
       a bounce category written `expected: false` reads kind program-error (F-495, normal: a tenant's file is read
       wrong); the bounce samples are matched against an empty list, so every one reads unclassified and the
       unclassified-wordings caveat misdirects (F-496, the mechanism behind V4's two-labels residual); the overlap
       caveat's parts test (F-497); signals.why on judged programs (F-498, V4's residual); plan-time rescans of base
       (F-499); two stale "newest first" comments (F-500, V3's residual); rowKind duplicating kindOf (F-501).
       Bradley's call on the mask gap, asked before the merge: merge as verified now and fix at S4b's kickoff — the
       reach is his own workspace snapshots, nothing ships before S4b (0.47.0 unreleased), and an OPEN normal finding
       gates the release, not a feature merge.
     Backlog (the maintainer's plan, LTR-11 and LTR-12, from Bradley's V4 rulings): an admin's acknowledgement of a
       program the lists flag correctly on the data (the nine one-run cron windows on Schedule ended; a known false
       alarm for a time), and a way to propose invariant cores from novel wordings into the tenant's category file
       (ruling 12 stands: a wording no category knows is one explicit state, working as intended). Both are backlog,
       not findings, on his word; F-496 carries only the caveat and label defect that is fixable now.
     Statuses: F-484 VERIFIED, F-491 VERIFIED by ruling (both archived at the next release). F-485 FIXED (S4a's; V2).
       F-486 OPEN rides S4b. F-492 OPEN (reopened), F-495..F-501 OPEN: S4b's kickoff batch, named in its prompt.
     VALIDATION § HLT-1 / DSH-1 / DSH-5 stays OPEN for V2 (Y4, Y5, Y7 to Y12 owed; Y0 to Y3, Y6, Y13 to Y20 settled).
       The Under test line and canary still read the merged branch's last token (hb-20261008-02), as after S4a's merge;
       S4b's handoff re-stamps them.
     Plugin 0.47.0 on dev, unreleased (one release for the whole program).
     CI on the merged tip cb56423, QUOTED per job after completion:
         validate-plugin 37976806147 (dispatch): changes success / manifests success / validate (ubuntu-latest) success → success
         docs-drift 37976810200 (dispatch): drift (stripped) success / drift (full) success → success
         the push-triggered pair, superseded by the dispatches: validate-plugin 37976782145 changes success, manifests and
           validate cancelled → cancelled; docs-drift 37976781942 drift (full) cancelled → cancelled
         GitGuardian: no check run on cb56423 (it ran on the PR head f21733f, pass, quoted above); 9 check runs on the commit in all.
     Open PRs to dev: none. Issues #11 and #12 unchanged. -->

<!-- tester 2026-10-09 (S3b FIX ROUND 3 verdict @ hb-20261008-02, V4 — F-484 VERIFIED; F-491 VERIFIED by Bradley's ruling; Y2, Y20 CLEARED, Y6 CLEARED by ruling; PR #43 stays unmerged; next free F-495):
     Under test: feat/jo-dash-s3b-health-batch, clean and level with origin at ceca718; the gs-superadmin:dev-canary skill read
       hb-20261008-02 in session, matching the Under test line; plugin loaded from the working tree (the workspace's plugin link
       resolves to it).
     Tenant: production, `gs-admin whoami` shown to Bradley and confirmed before the first call (R11); reads only, one call at a
       time, each pull one sequential process with nothing beside it. The token expired twice (once before the first call, once
       before the refresh); Bradley logged in both times, and no call reached the tenant on an expired token.
     Round type: RE-VERIFICATION of F-484 and F-491 by their Judge lines plus VALIDATION Y2 (participant half), Y6, Y20 as
       re-banked for V4. The pass bars were told to Bradley before the first call. Calls:
         - the skill's plan and run without the refresh (plan 19 calls; run 196 made + 20 reused; exit 0);
         - Y2's direct grouped COUNT (a server timeout, retried once, exit 0);
         - one narrow count for the drifted program;
         - after the refresh, the re-plan (1 call) and run (1 made, 213 reused), exit 0.
       The only writes were the workspace KB, through the skill's three commands (20 programs, nothing else), plus the tenant's
       category file and the local ideas file, both on Bradley's word and outside the repo.
     Results (detail under each section and in VALIDATION section HLT-1 / DSH-1 / DSH-5):
       F-484 VERIFIED.
         - Every bar item holds.
         - The 28 unclassified wordings, all bounce text, were read by Bradley as bad-address variants.
         - He ruled novel wordings flagged as unknown to be working as intended (ruling 12).
         - My reopen recommendation, made on the typedef's narrower line, was withdrawn.
       F-491 VERIFIED by Bradley's ruling.
         - Items 1 to 5 PASS.
         - Item 6 ("one-offs read Finished again") held for 2 of 11; 9 read Schedule ended, because their documented
           schedule is a single-run cron window.
         - Bradley: correct on the data available; an admin acknowledgement is a future backlog item.
       VALIDATION: Y2, Y20 CLEARED; Y6 CLEARED by ruling.
     Noticed, not findings (in the report to Bradley):
       - the bounce remainder's two labels (`other` in the bounce table, `unclassified` in the samples), and the
         `unclassified-wordings` caveat's report-bug remedy, which cannot teach a shipped bounce list that is empty by design;
       - the skill's step-2 ask says the behind programs "would read Cannot judge yet", while they are judged from their doc
         and flagged;
       - a Finished or Schedule ended row can carry `signals.why` too-new, a cannot-judge reason, where no list uses it;
       - the guard asks on a non-invoking mention of the CLI's name (both asks carried the inert-operand caveat).
     Tester slip, workspace only: a dry run of the round's check script over the V3 snapshot overwrote V3's derived lists file.
       It was regenerated from the V3 head's own code over the V3 snapshot, and its counts match V3's record.
     Blind spots:
       - Step 4 (the report) was not run, so the caveats' rendered text was read from code, not a report.
       - The 3 Paused behind programs carry `docBehind` in `honesty.kb` only; no list judges them.
       - The 25 added bounce patterns were measured on order 10^3 sampled raw texts, not a tenant-wide census (the reason
         field takes no filter or group).
       - The mutating-command guard path was not probed this round.
       - The approval prompts are invisible to the tester: Bradley pasted both.
     Workspace (tenant data, never in the repo): the snapshots and their lists in <slug>/reports-adhoc
       (engagement-report-20261009-0817, -after); run directory report-20261009-0817; the round notes, direct reads and check
       scripts in the workspace's tmp folder; the tenant's category file (30 -> 55 bounce categories, backup beside it).
     PR #43 stays unmerged: no open normal finding remains on F-484 or F-491; the merge is Bradley's. -->

<!-- tester 2026-10-09 (S3b — POINTER RE-STAMPED after the fix-round-3 verdict @ hb-20261008-02 (V4): F-484 VERIFIED, F-491 VERIFIED by Bradley's ruling; PR #43 stays unmerged; next free F-495):
     Branch: feat/jo-dash-s3b-health-batch at d52bebb (the verdict commit). PR: #43 to dev, open, unmerged, MERGEABLE CLEAN.
     Status transitions riding the branch (re-stamps the builder's round-3 handoff block below, which says both REDESIGNED; their
       headers read OPEN at the handoff): F-484 OPEN -> VERIFIED; F-491 OPEN -> VERIFIED (by ruling). Nothing new logged; next free F-495.
     VALIDATION section HLT-1 / DSH-1 / DSH-5 (on the branch): Y2 (participant half), Y20 CLEARED; Y6 CLEARED by ruling.
     CI on d52bebb, QUOTED per job after completion:
         validate-plugin 37973628515: changes pass / manifests pass / validate (ubuntu-latest) pass
         docs-drift 37973628529: drift (full) pass
         GitGuardian Security Checks: pass
     Open PRs to dev: #43 only. The merge is Bradley's. Detail: the tester comment above and the Walk (hb-20261008-02) line. -->

<!-- tester 2026-10-08 (S3b FIX ROUND 2 verdict @ hb-20261008-01, V3 — F-492 VERIFIED; F-484 REOPENED (third), F-491 REOPENED (second since its Redesign); Bradley ruled NEITHER deferred; Y19 CLEARED, Y6 CLEARED on its bar, Y2 (participant half) FAILED; PR #43 stays unmerged; next free F-495):
     Under test: feat/jo-dash-s3b-health-batch, clean and level with origin at b434add; the gs-superadmin:dev-canary skill read
       hb-20261008-01 in session, matching the Under test line; plugin loaded from the working tree (the workspace's plugin link
       resolves to it).
     Tenant: production, `gs-admin whoami` shown to Bradley and confirmed before the first call (R11); reads only, one gs-admin
       call at a time, the pull one sequential process with nothing beside it; one re-login by Bradley when the token expired
       between calls (the refused call never reached the tenant).
     Round type: RE-VERIFICATION of F-484, F-491, F-492 by their Judge lines plus VALIDATION Y2 (participant half), Y6, Y19 as
       re-banked for V3; pass bars written down and told to Bradley before the first call. Calls: the full health pull with Y1's
       flags and the workspace category file, no --previous (plan 17, run 194 made + 18 reused, exit 0, nothing failed); one direct
       grouped COUNT of the refusals over the day window (Y2); on Bradley's request, one direct read of four Admitting-nobody
       programs' refusals and one live `jo programs describe` of an undocumented program (Y6); one declined guard probe.
     Results (detail under each section and in VALIDATION section HLT-1 / DSH-1 / DSH-5):
       F-484 REOPENED, third reopen: the redesign's window and order hold on every structural arm (withFailures = the direct
         count, 64 of 64 per program; one window object for the count and every page; no empty pick; OccurrenceCount DESC), and
         the dominant wording now reaches the sample; but `Custom field contains Invalid value {null} for EMAIL data type` matches
         no pattern (the shipped `no-email` spells the standard field's name), so it reads kind null in failureSamples and
         program-error in entrySamples. Bradley: unknown wordings flagged as needing investigation; the repo able to classify them.
       F-491 REOPENED, second since its Redesign: every list read true by Bradley (Schedule ended 19 and none of the 15 live
         syncs; Step errors 0; the quarterly program too-new; the doc-stale program and the four newly visible Admitting-nobody
         programs read true on his knowledge); but a program with no KB doc reads ingest `one-time` and counts as a one-off for
         Finished from a default (live: a daily cron); 12 programs on this pull have no doc. Bradley also: three closed months
         is long for a daily program.
       Disposition: Bradley ruled both NOT deferred ("reopen but not deffered"; "don't defer"); rule 5 and the valve leave a
         redesign as the only next FIXED for each.
       F-492 VERIFIED: 30 of 30 captured wordings are their own mask (one trims); 0 addresses, IPv4 or five-digit runs in the
         earlier rounds' texts; Bradley confirmed hosts unmasked (nothing reaches the repo or a page).
       VALIDATION: Y19 CLEARED; Y6 CLEARED on its bar (the lists; F-491 reopened on the Fix note's own claim); Y2's participant
         half FAILED (F-484).
     Noticed, not a finding (in the report to Bradley): his idea to dismiss an Admitting-nobody flag for a time when it is a
       known false alarm; engagement.mjs ~1092's comment still says a sample reads newest first (the code orders by
       OccurrenceCount).
     Blind spots: the four newly visible Admitting-nobody programs and the undocumented program were read beyond the 25 sampled
       only by the two extra calls; the digit-host masking was measured on earlier rounds' texts, not this pull's; the approval
       prompt is invisible to the tester: its text was pasted back by Bradley.
     Guard-wiring: `gs-admin jo p pause --help` drew the guard's ask ("Mutating Gainsight command: gs-admin journey programs pause",
       both tenants named, production flagged; Bradley pasted the rendered text); Bradley declined it.
     Workspace (tenant data, never in the repo): snapshot <slug>/reports-adhoc/hb1008-health.json with its lists; run directory
       hb1008-health; the direct reads, the live describe and the round notes in the workspace's tmp folder.
     PR #43 stays unmerged: open normal findings (F-484, F-491) gate the release, not this merge; the merge is Bradley's. -->

<!-- builder 2026-10-08 (S3b FIX ROUND 3 HANDED OFF — UNMERGED, riding the same branch; verdict at V4):
Branch feat/jo-dash-s3b-health-batch → PR #43 to dev (open, unmerged; merges on green CI plus its review round after V4, on Bradley's go-ahead). Token: hb-20261008-02.
F-484 REDESIGNED a second time (third reopen; the model replaced: literal whole-sentence matching with per-table defaults for a miss — now the invariant core of a product wording, and "unclassified" / kind "unknown" as one explicit state everywhere) and F-491 REDESIGNED (second reopen since its first Redesign; the model replaced: the schedule read from the KB doc only with a missing doc read as a one-off — now the KB is the ONE source, what it lacks is named and judged as unknown, and the email-engagement skill OFFERS a narrow refresh of exactly those programs). Both were taken from the problem statement up with Bradley in session; neither deferred (his ruling). Each carries Redesign:, Fix:, Judge:, a mutation copy-out (8 of 8 as predicted, predictions written first) and a Sibling sweep line. F-486 (polish) stays carried to S4b; F-485 (FIXED, S4a's) untouched.
Ordering: nothing pending re-arranges what V4 verifies. The SKILL.md of email-engagement changed (step 2: the ask and the narrow refresh), so V4 owes its walk (Y20); the skill is model-invocable, so the tester session invokes it.
Measured before building (production, reads only, six calls on Bradley's token; shapes in dev/S3B-FIX-ROUND-BRIEF.md § Round 3, nothing tenant-specific in the repo): the refusal reason field is a JSON-path field with no filter, group or sort (no census possible); the sources object and the program list carry no cron (the list carries modified_date); the null-address wording has three field labels live, one refused 49,467 times on the dominant program; every other wording on two 2000-row pages matched a shipped category.
Rulings applied: Bradley's of 2026-10-08 in this session, recorded under HLT-1 in the plan as rulings 11–13 (the invariant core; unclassified as one explicit, actionable state; the KB as the one source with the narrow refresh offered on a build or a refresh).
Verified offline: suites engagement 323, query 112, contract 284, page 103, groups 39, spec 31, report 52 green; goldens regenerated (snapshot, query, report); reader shapes regenerated (19 commands, 871 keys); typecheck clean but for the git-ignored handoffs tool (known); check-stale-facts and check-doc-drift green. Additive fields (kind "unknown", category "unclassified", occurrences on failureSamples and entrySamples, dimensions.programs[].modifiedAt, honesty.kb, estimate.kb, two caveats) moved typedef, pin and goldens together; schemaVersion stays 1. Renamed on this unreleased branch: the category id no-email → invalid-field-value.
Banked: dev/VALIDATION.md § HLT-1 / DSH-1 / DSH-5 re-banked for V4 (Y2's participant half and Y6 replaced again; Y20 new: the ask and the narrow refresh walked), keyed to this token. Reload: /reload-plugins (scripts and one skill changed; no hook). -->

<!-- builder 2026-10-08 (S3b FIX ROUND 2 HANDED OFF — UNMERGED, riding the same branch; verdict at V3):
Branch feat/jo-dash-s3b-health-batch → PR #43 to dev (open, unmerged; merges on green CI plus its review round after V3, on Bradley's go-ahead). Token: hb-20261008-01.
F-484 REDESIGNED under rule 5 (second reopen; a `Redesign:` line names the model replaced: picks ranked over one window and pages read over another, newest first — the per-program sample is a mechanism born this release, and this is its one redesign; what remains on it after V3 is deferred past the version being cut, never patched a third time), F-491 FIXED (a tune of the redesigned model after its first reopen: the live schedule, a stale doc, three kinds, a too-new program), F-492 FIXED (hosts unmasked on Bradley's lean; a URL's path protected). Each with Fix:, Judge:, a Sibling sweep line; F-484 and F-491 carry the mutation copy-out (8 of 8 as predicted, predictions written first). F-486 (polish) stays carried to S4b; F-485 (FIXED, S4a's) untouched.
Ordering: nothing pending re-arranges what V3 verifies; the F-492 fix was taken last because the F-484 samples it masks are what V3 reads.
Measured before building (production, reads only, three calls on Bradley's token, the rest offline over V2's snapshot in the consumer workspace; shapes in dev/S3B-FIX-ROUND-BRIEF.md § Round 2, nothing tenant-specific in the repo): 64 programs with refusals still happening in the day window; --order-by OccurrenceCount works; the newest page of the largest program hides its dominant wording, the most repeated page shows it on 75 of 100 rows; the 15 false Schedule ended reads each carry a live participant sync beside an ended job schedule; the 6 Step errors programs are all "other"; the false No recent sends has one month of history.
Rulings applied: Bradley's of 2026-10-08 as the tester recorded them under F-491 and F-492 (three kinds; hosts unmasked; a schedule over with the sync running is not over; a quarterly intake on a monthly cron is not silent), recorded under HLT-1 in the plan as rulings 7–10.
Verified offline: suites engagement 319, query 112, contract 284, page 103, report 52, groups 39, jo-report, audit-active, tenant-deps green; reader-shape trace green and data/reader-shapes.json regenerated (19 commands, 867 keys); typecheck clean; check-stale-facts and check-doc-drift green. The additive fields (`kind` on failureSamples, entrySamples and stepFailures rows; `meta.health.samples[part].window` and `.counts`) moved typedef, pin and goldens together; `schemaVersion` stays 1.
Banked: dev/VALIDATION.md § HLT-1 / DSH-1 / DSH-5 re-banked for V3 (Y2's participant half and Y6 replaced again; Y19 new), keyed to this token. Reload: /reload-plugins (scripts only; no skill or hook changed, so no walk is owed).
Blind spots: no tenant pull was made with the redesigned samples (the three reads were counts and two sample pages on the largest program); the lists are re-read true only by Bradley at V3 (Y6); hosts unmasked is his lean, not yet his verdict (Y19); a host carrying a digit still masks as an id (accepted, unmeasured on the tenant's wordings beyond the 30). Next free F-495.
-->

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

<!-- tester 2026-10-08 (S3b — POINTER RE-STAMPED after the fix round 2 verdict @ hb-20261008-01 (V3): F-492 VERIFIED; F-484 REOPENED (third), F-491 REOPENED (second since its Redesign); Bradley ruled NEITHER deferred; PR #43 stays unmerged; next free F-495):
     Branch: feat/jo-dash-s3b-health-batch at 906745c (the verdict commit, a content commit without [skip ci], so the PR suite ran on
       the head). PR: #43 to dev, open, unmerged, MERGEABLE CLEAN.
     Status transitions riding the branch (re-stamps the builder pointer below, which says F-484 REDESIGNED and F-491, F-492 FIXED):
       F-492 FIXED -> VERIFIED (30 of 30 captured wordings are their own mask; hosts unmasked confirmed by Bradley). F-484 FIXED -> OPEN
       (REOPENED, third: the redesign's window and order hold; an entry refusal's kind is decided by a literal substring that includes
       text the platform varies per program, and an unmatched wording reads kind null in failureSamples and program-error in
       entrySamples instead of being flagged as unclassified). F-491 FIXED -> OPEN (REOPENED, second since its Redesign: every list read
       true by Bradley, but a signal whose input was not read, the schedule of a program the KB does not document, reports a default,
       one-time and a one-off, instead of cannot-tell). Bradley ruled neither deferred: under rule 5 and the valve each next FIXED owes a
       redesign. Nothing new logged; next free F-495.
     VALIDATION section HLT-1 / DSH-1 / DSH-5 (on the branch): Y19 CLEARED; Y6 CLEARED on its bar; Y2 (participant half) FAILED.
     CI on the final head 906745c, QUOTED per job after completion:
         validate-plugin 37886289793: changes pass / manifests pass / validate (ubuntu-latest) pass
         docs-drift 37886289881: drift (full) pass
         GitGuardian Security Checks: pass
     Open PRs to dev: #43 only. Open normal findings (F-484, F-491) gate the release, not this merge; the merge is Bradley's.
       Detail: the tester comment and the Walk (hb-20261008-01) line on the branch's bus. -->

<!-- builder 2026-10-08 (S3b — POINTER RE-STAMPED after the FIX ROUND 2: F-484 REDESIGNED (second reopen; the model replaced named — one window for the pick and the page, the most repeated refusals first), F-491 FIXED (a tune of the redesigned model: the live schedule, a stale doc, three kinds of failure, a too-new program), F-492 FIXED (hosts unmasked on Bradley's lean; a URL's path protected); F-486 (polish) carried to S4b; PR #43 stays unmerged; next free F-495):
     Branch: feat/jo-dash-s3b-health-batch at b434add → PR #43 to dev (open, unmerged; merges after V3 on Bradley's go-ahead; the tip is a
       content commit, so the PR suite runs on the head). The branch's bus carries the Redesign:, Fix:, Judge: and Sibling sweep lines, the
       two mutation copy-outs (8 of 8 as predicted, predictions written first) and the round's handoff block.
     Token: hb-20261008-01, minted by dev-utils handoff (7604a0e, one commit for the Under test line, its Blind spots line and the canary).
       V3 runs on it: dev/VALIDATION.md § HLT-1 re-banked (Y2's participant half, Y6 replaced again; Y19 new), on the branch.
     Measured before building (production, reads only, three calls on Bradley's token; the rest offline over V2's snapshot in the consumer
       workspace): shapes in dev/S3B-FIX-ROUND-BRIEF.md § Round 2 (on the branch); Bradley's 2026-10-08 rulings recorded under HLT-1 in
       the plan as rulings 7–10. -->

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

## F-530 — DEFERRED (past 0.54.0)
Reported: 2026-10-14 (builder, R12 release-gate review, verifier reproduced over test/fixtures/engagement/snapshot-acme.json)
Severity: normal — a reader of the admin page acts on a customer list that is not the one the dashboard says it holds
Class: consumer-parity
What: Class, in one sentence: the customer-list rule has two consumers, the report (the pull's selection record: the spec's n, floor and per segment) and the page (preset panels: limit 25, delivered >= 10, every account row re-ranked, alphabetical tie-break), and only the report reads the spec. dashboard-spec.mjs's ACCOUNT_LIST presets never read accounts.lists; the page includes accounts kept by another list or pinned; per-segment lists never reach the page; the About tab states the spec's n and floor above a panel applying 25 and 10. No ruling covers it (VALIDATION DSH-4 D0 ruled the three-panel shape and titles).
Repro: set the snapshot's selection record (or the spec through `change`) to least-engaged n 3 floor 3, build both: the report lists three accounts, the page's panel under the same title lists all ten in its preset order.
Expected: the page's list panels take n, floor, per and the kept set from the same source as the report, so the two and the About tab agree.
Routing: the R12 fix round, before the recut.
Defer: 2026-10-15 (Bradley, R12 release gate) - past 0.54.0. Why not now: it bites only when an admin changes a list from its defaults (25, at least 10 delivered), and its natural fix (the page reads the pull's kept set) belongs to F-548's redesign of where list membership comes from. Reopen: session B (F-548), the fast follow after 0.54.0.

## F-536 — DEFERRED (past 0.54.0)
Reported: 2026-10-14 (builder, R12 release-gate review, verifier reproduced in Git Bash, PowerShell 5.1 and cmd)
Severity: polish — every failure is a refusal and nothing is written (the verifier tiered it normal: it blocks filling internal domains from a Windows terminal; logged polish on the release rule, re-declare if that matters more)
What: the no-internal-domain copy line ends at `sources.0.params.internalDomains=` and asks for a JSON value; typed after the = in PowerShell 5.1 or cmd (or bare in bash) the embedded quotes are stripped, node refuses "the value is not JSON", and the refusal's own advice (quote text ("Renewals")) fails the same way; the skill's single-quoted form fails in PowerShell 5.1.
Repro: paste the page's line in PowerShell 5.1 and type ["acme.com"] after the =: refused.
Expected: the printed line carries a value form that survives each shell (a pre-quoted pair, or a value read from a file / stdin), and the refusal's advice runs as given.
Defer: 2026-10-15 (auto, release ceremony) - past 0.54.0. Why not now: OPEN polish at release. Reopen: next release ceremony.

## F-541 — DEFERRED (past 0.54.0)
Reported: 2026-10-14 (builder, R12 release-gate review, verifier reproduced; unreachable for a released user: no dashboard code was ever released before this version)
Severity: polish — a spec only an unreleased dev build plus a hand-written panel list can produce
What: a spec validated under S4b (templates on, preset panels written out) fails the S4c rule "lists no panel for the templates tab", and every repair path goes through startDraft's validation, so only a hand edit fixes a saved spec a later validator tightening rejects. The 0.54.0 writer cannot produce a spec its own validator refuses.
Expected: a validation tightening between versions leaves a repair path through the writer (draft from an invalid saved spec, refusing only the save).
Defer: 2026-10-15 (auto, release ceremony) - past 0.54.0. Why not now: OPEN polish at release. Reopen: next release ceremony.

## F-542 — DEFERRED (past 0.54.0)
Reported: 2026-10-14 (builder, R12 release-gate review, verifier traced)
Severity: polish — bounded (one restart per rise of the derived lookback); the numbers are right
What: on a resume after re-documentation moved the KB stamp, the derived health lookback can rise (30 → 90) and the pull moves to a fresh -lb<N> run directory with nothing reused, while the resume line still says "the calls already made are reused".
Expected: the resume says it starts the pull again and why, or carries the answered calls the new lookback does not change.
Defer: 2026-10-15 (auto, release ceremony) - past 0.54.0. Why not now: OPEN polish at release. Reopen: next release ceremony.

## F-545 — DEFERRED (past 0.54.0)
Reported: 2026-10-14 (builder, R12 release-gate review, verifier traced)
Severity: polish — misleading text, recoverable
What: refresh's resume checks run before takeLock, so a second `refresh --full` during a live refresh is told "a stopped refresh … is waiting to resume … or remove refresh-state.json to start over" instead of "already running"; takeLock is check-then-write (no exclusive create) and release deletes unconditionally.
Expected: take the lock before reading or removing the state file; "already running" first.
Defer: 2026-10-15 (auto, release ceremony) - past 0.54.0. Why not now: OPEN polish at release. Reopen: next release ceremony.

## F-546 — DEFERRED (past 0.54.0)
Reported: 2026-10-14 (builder, R12 release-gate review, verifier traced)
Severity: polish — self-healing (a lost mark is re-documented next refresh); not a normal flow
What: the refresh lock is per dashboard, but re-documentation writes the KB-wide _manifest.json (manifest.mjs has no lock), so two dashboards of one KB refreshed at once can lose each other's documented / stale marks. The same property holds for every manifest writer.
Expected: a KB-level lock around re-documentation, or the manifest's writes made merge-safe.
Defer: 2026-10-15 (auto, release ceremony) - past 0.54.0. Why not now: OPEN polish at release. Reopen: next release ceremony.

## F-548 — DEFERRED (past 0.54.0)
Reported: 2026-10-15 (builder, R12 release gate — Bradley's question at F-529's ruling: with lists on, does a routine refresh update them?)
Severity: normal — with customer lists on, list membership is frozen at the last full pull: a routine (selective) refresh updates the kept accounts' figures but never who is on a list, so current membership costs a full pull every time (on the kept dashboard about 67 minutes against a selective refresh's 44)
What: Class, in one sentence: the cross-program lists are ranked only from data a full pull holds and the snapshot then folds away. A full pull reads every account's figures for every month, ranks, and keeps per-account rows only for the kept (listed, pinned) accounts; every other account's months become one "all other accounts" row per program and month. A selective refresh re-reads every account for the months it pulls (account units are planned per program per pulled month for all accounts), but the older months of the non-kept accounts are gone, so it cannot rank and carries the last full ranking (F-521, by design: rankedAt and carriedFrom say so). F-529's reselect is the same limit met at edit time.
Expected: the snapshot (or a sidecar beside the pages, never embedded in a page) keeps compact per-account totals by program and month for every account, so every refresh re-ranks exactly: stored months plus pulled months give the full pull's ranking (the judge: over unchanged data, a selective refresh's lists equal a full pull's, kind, n, floor, per, segment, kept, in order); a list change re-ranks from the store at no pull; the low-cadence quiet rule (per program) and per-segment lists (company fields for newly listed accounts) are kept. Contract: a 0.54.0 snapshot without the store is detected and the next refresh goes full, priced and said, with no hand step and no refusal. The store's size is measured on the kept dashboard's run directories before building, and the design stops if it is prohibitive.
Defer: 2026-10-15 (Bradley, R12 release gate) - past 0.54.0. Why not now: shipping 0.54.0 sooner is worth more than current membership on routine refreshes — a day-1 adopter's build is a full pull, most will not refresh for a month, the staleness is dated on the page and stated in the release notes, and the cost of waiting is one extra full refresh after session B. Reopen: session B, the fast follow after the 0.54.0 release (with F-530 and F-529's root).

## F-549 — VERIFIED
Reported: 2026-10-15 (carried from gs-fortress ledger/reports/audit-1.0.12.md §1.12,
§1.15, §1.16 and §1.18 by the watch's kickoffs step; DECOUPLED from the adopt decision
per that audit's §5; this emission supersedes the 1.0.11 audit's, which was never
pasted)
Severity: normal — shipped behaviour is wrong for a user whose installed CLI is 1.0.11
or 1.0.12 (the same dist; 1.0.12 is npm latest since 2026-10-15): the operating model
and the setup scope notes tell the agent that jo email templates cannot see nested
subfolders and that sc measures --id fails for an unknown cause, and the engagement
adapter files 1.0.11's named field refusals as not-found, all on the strength of 1.0.10
behaviour that 1.0.11 changed
What: CLI 1.0.11 changes no command or payload shape the plugin reads (measured at dev
efe5caf and at the shipped [v]0.54.0 alike), and 1.0.12 is 1.0.11's dist with one
dependency pin moved; but 1.0.11 fixes several defects the plugin documents as
standing. sc measures --id: its two concurrent first requests each built a token store
and the second missed the OS keychain; 1.0.11 shares one load and one store, so --id
works (gs-fortress KI-028, resolved statically). jo email templates: the handler now
recurses into child folders instead of emitting them as field-less rows (KI-003, live
confirmation pending). Error exits: the shared handler, the runtime envelope printer and
the version gate no longer call process.exit(), upstream's account of the libuv
UV_HANDLE_CLOSING abort (KI-017, live confirmation pending). rp run: unknown fields and
filter fields, JSON and rich-text fields where the server cannot use them, aggregations
nested in formulas and an aggregate of a grouped field are refused by name before any
request, and the LOOKUP auto-join now joins the lookup object's key. The doctrine sites:
templates/operating-model.md (the sc measures --id entry and the General rule; the libuv
entry; the jo email templates sentences of the scope-filter entry),
skills/setup/references/document-domain-notes.md (Scorecard exception),
skills/setup/references/index-scope-notes.md (journey email templates), and
scripts/engagement.mjs (header facts; classifyFailure's not-found pattern, which also
matches 1.0.11's 'Field "X" not found on <object>' refusal) with test/engagement.mjs's
LEDGER facts 3, 7 and 9. The adapter's one-at-a-time rule is NOT retired: it is a
cross-process observation and KI-028's fix is in-process. Nothing breaks - validateQuery
already refuses every shape 1.0.11 newly refuses, and the 0.54.0 engagement families and
the native-report payload send none of them - and every current sentence stays right for
1.0.10 users, so the repair is version-conditional ("1.0.11 and later"), never a
replacement. Session B (F-548, F-530) edits scripts/engagement.mjs too: order the two
branches here.
Repro (no tenant needed): read the scope note's "flattens one level of the folder tree"
beside the 1.0.11 listEmailTemplates recursion quoted in the audit's §0; feed
classifyFailure the stderr 'Error: Field "Nmae" not found on email_log_v2.' and observe
"not-found".
Expected: CP-2 (sc measures --id version-conditional, cause named), CP-3 (libuv and
nested-folder sentences scoped to 1.0.10 and earlier, workarounds kept, the ### heading
untouched), CP-4 (engagement facts version-stamped, guards and the sequential rule kept,
the field refusal not retried as not-found), CP-5 (bump + CHANGELOG); CP-6's live checks
banked in dev/VALIDATION.md on the same branch, on a 1.0.11-or-later CLI. Lock: a mutant
that restores the not-found classification of a field refusal must produce a COUNTED,
REPORTED miss in the engagement suite.
Not in scope: adopting 1.0.12 (catalog regen, version prose, the three check-stale-facts
fact-carrier stamps in plugins/gs-superadmin/scripts/doc-lib.mjs, and CLI_PIN_FACTS'
journey:email:templates entry - the gated session E2 in gs-fortress
ledger/reports/build-kickoffs-1.0.12.md, on Bradley's clock). Also not in scope: removing
any validateQuery guard or the one-at-a-time rule.
Plan: gs-fortress ledger/reports/build-kickoffs-1.0.12.md, session E1 (CP-2, CP-3, CP-4,
CP-5) + V1 (CP-6).
Fix: 2026-10-15 (builder, session E1+V1 of gs-fortress build-kickoffs-1.0.12.md; branch doctrine-cli-1-0-11-plus,
PR #58 to dev, UNMERGED; plugin 0.54.1). The class, in one sentence: a doctrine statement about a CLI defect that
carries no version bound becomes false for every user on the CLI that fixed it while staying needed by every user
on the CLI that has it — so the repair is a version condition on each such statement ("1.0.10 and earlier" keeps
today's wording, "1.0.11 and later" gets the new behaviour), never a replacement, and never "1.0.12" (the same dist).
  CP-2: the operating model's "sc measures --id" entry and General rule, setup's document-domain-notes.md Scorecard
  exception — the 1.0.9 and 1.0.10 clauses kept, the cause named (a keychain-load race between the two concurrent
  first requests; gs-fortress KI-028), --id works on 1.0.11 and later ("live confirmation pending": CP-6 a), --name
  the default on every version, the duplicate-name fallback records the race failure only on 1.0.10 and earlier.
  CP-3: the libuv entry scoped to 1.0.10 and earlier with what 1.0.11 changed, "parse stderr on every version" kept
  until CP-6 (b) clears; the scope-filter entry's jo email templates sentences and index-scope-notes.md's body scoped
  to 1.0.10 and earlier, the residual top-level filter on every version, the reachable count "not yet measured live"
  (CP-6 c); the ### heading untouched (check 23: 3 scope entries match 3 subsections both ways).
  CP-4: engagement.mjs's header facts version-stamped (the LOOKUP rule, the silent filter drop, show∩group, the
  "network outage", the participant reason filter, "unrecognized data type"); "Calls run one at a time" untouched
  (cross-process; KI-028's fix is in-process); classifyFailure reads FIELD_REFUSAL_RE before the not-found class and
  returns shape-error — the call is not retried and a describe never settles it as a deleted program; validateQuery
  untouched (frozen contract). test/engagement.mjs: three F-549 checks, LEDGER facts 3, 7 and 9 version-stamped plus
  one new ledger line; the fixture's FAULT_TEXT gains the two 1.0.11 refusal texts (fictional field names).
  CP-5: plugin.json 0.54.0 → 0.54.1 with a CHANGELOG entry naming the effect (correct on 1.0.11 and later, unchanged
  on 1.0.10). CP-6 (V1): six live checks banked in dev/VALIDATION.md § "F-549 / CP-6" (a)–(f), each recording the
  CLI version it runs on, with FIXED / BROKEN lines and the reopen a BROKEN verdict causes.
  Siblings the finding did not list, checked with zero new code: the KI-018 entry's "both also abort on the libuv
  assertion above" now reads against a version-scoped entry and is named in CP-6 (b)'s FIXED line as the sentence
  that takes the same scope when (b) clears; report-bug's SKILL.md names the sc measures --id entry only as an
  example of a documented issue (no version claim) — untouched; doc-lib's AUTH_DEATH literal list and
  describe-batch's fake-CLI literals are 1.0.12's own two throw texts, unchanged (audit §1.12) — untouched.
Judge: for the code, a mutation differential rather than the fixer's list — the pre-fix classification restored on a
copy of the tree must make the engagement suite red (below); for the doctrine, the live checks of CP-6 (a)–(f) on a
1.0.11-or-later CLI, each banked with the verdict that reopens this section, since no fixture can decide what a CLI
does on a tenant.
Mutation copy-out (source: the classifier's one new decision point, deleted on a copy of plugins/ + test/):
    mutant classifyFailure without `if (FIELD_REFUSAL_RE.test(stderr)) return "shape-error";` (the old /\bnot found\b/
    class first again) — pred:KILL → KILLED: 3 FAIL (the three F-549 checks: the classifier; an rp run refusal retried
    as a not-found; a describe refusal settled as a deleted program) — the suite's own line `engagement: 3 FAILED of 380`, exit 1. On the tree: 0 FAIL, exit 0.
Battery: 60 steps, 0 red — the AGENTS.md list verbatim, plus the five no-CLI generators with `git diff --exit-code` on
their outputs (no drift), on this worktree. `npm run build` NOT run (house rule 7: nothing here regenerates).
Ordering against session B (F-548 / F-530, feat/f548-ranking-every-refresh, PR #57, open and green on its five
checks but CONFLICTING against dev since this emission landed — both touch the tail of dev/FEEDBACK.md; the
section format resolves it by keeping both sides): both branches edit scripts/engagement.mjs and test/engagement.mjs
and both bump from 0.54.0 (B to 0.55.0, this one to 0.54.1). Whichever merges second rebases and takes the next
number (this branch becomes 0.55.1 if #57 lands first; #57 stays 0.55.0 if this lands first). CP-4's hunks are the
header comment block, classifyFailure, the test's fault block and its LEDGER — none of them in B's diff — so the
rebase is expected to be mechanical. Which lands first is Bradley's call; neither PR is merged by its author.
Reload: /reload-plugins does not reach a shipped template — the operating model is copied into a workspace at setup
or refresh — so the tester reads the branch's files, and walks setup's references as prose (no CI reads them).
Verified: 2026-10-15 (tester, F-549 re-verification @ hb-20261015-05; branch doctrine-cli-1-0-11-plus at 179a27e, PR #58 to
dev unmerged, clean and level with origin; the dev-canary skill read hb-20261015-05 in session, loaded from this worktree;
installed CLI 1.0.10, no tenant call made) — pass bar stated in the kickoff before measuring: (1) the four doctrine sites
never say --id fails on 1.0.11 or later, keep the 1.0.10 failure and the 1.0.9 half-life clause, scope the nested-folder
and libuv claims to 1.0.10 and earlier with the workarounds kept on every version, leave the ### heading unchanged, and
use bare version numbers; (2) every validateQuery guard and "Calls run one at a time" unchanged, the header facts naming
their version; (3) the Fix note's mutant reproduced; (4) the gates green on the tree; (5) CP-6 (a)–(f) banked complete;
(6) the live arm only on a 1.0.11-or-later CLI with a token. Class measured, not a list: a statement about a CLI defect
carries the version bound of the CLI that has it while its workaround holds on every version, and a query-shape refusal
whose words say "not found" is never filed as a missing asset.
  (1) PASS — the diff against the dev merge-base d95a2b7 on operating-model.md (the sc measures --id entry, the General
  rule, the scope-filter entry's jo email templates sentences, the libuv entry), document-domain-notes.md's Scorecard
  exception and index-scope-notes.md: every 1.0.11-and-later clause says works / descends / clean exit with "live
  confirmation pending" or "not yet measured live"; the 1.0.10 every-time failure and the 1.0.9 half-life race stand;
  `--name` stays the default, the template-by-id recovery and "parse stderr on every version" are unscoped; the heading
  reads `### journey email templates`; no vX.Y.Z and no 1.0.12 on any added line.
  (2) PASS — validateQuery has no hunk; "Calls run one at a time (parallel calls produced false errors)" is an unchanged
  context line; the header opens on the 1.0.10 measurements and each 1.0.11 note names its version.
  (3) PASS — predictions written to a scratch file before any run. Copy-out on a copy of plugins/ + test/ (+ README.md,
  package.json):
    M1 classifyFailure without `if (FIELD_REFUSAL_RE.test(stderr)) return "shape-error";` — pred:KILL → KILLED: the three
    F-549 checks FAIL, the suite's line `engagement: 3 FAILED of 380`, exit 1. Tree: `engagement: all 380 checks passed`,
    exit 0.
  A judge past the fixture: the published 1.0.12 dist (npm pack, read only) throws `Field "<name>" not found on <object>.`
  (handlers/report.js:289) and `Filter field "<name>" not found on <object>.` (:644), each with an optional ` Did you mean
  "a" / "b"?` and a closing `rp schema` pointer — FIELD_REFUSAL_RE matches both, so the fixture's paraphrases are
  shape-faithful; CP-6 (f) still owes the real stderr.
  (4) PASS — check-doc-drift exit 0 ("check 23: 3 scope-limit entries in CLI_PIN_FACTS match the 3 canon subsections both
  ways"); check-stale-facts exit 0; test/engagement.mjs 380 of 380, exit 0.
  (5) PASS — (a)–(f) each carry Steps, a FIXED line and a BROKEN line with `<version>`, under a preamble that has the
  version recorded on every verdict; (a)–(d) and (f) name the F-549 reopen, (e) names none and says why (no plugin text
  names KI-013 or KI-014 — a grep of plugins/gs-superadmin confirms).
  (6) NOT RUN — the installed CLI reports 1.0.10; no partial run was improvised.
  Walk (prose, setup Phase 5): both references read as the agent would read them; the 1.0.10-and-earlier and
  1.0.11-and-later instructions are unambiguous, and setup's first step prints `gs-admin --version` and takes "the rule
  for the installed CLI", so the split is actionable.
  Guard-wiring: in a scratch workspace (an untracked `.gs-superadmin/` marker inside the worktree, removed after — this
  session's cwd cannot leave the worktree) `gs-admin jo p pause --help` drew the plugin's PreToolUse ask; Bradley read the
  rendered text: "Mutating Gainsight command: gs-admin journey programs pause. This workspace is read-only by default.
  Confirm the active tenant (`gs-admin whoami`) is the intended target before approving. [plugin:gs-superadmin]" —
  declined, not run.
  Blind spots: all six CP-6 live checks stay OWED on a 1.0.11-or-later CLI with a sandbox token — (a) KI-028, (b) KI-017,
  (c) KI-003/KI-030, (d) KI-022, (e) KI-013/KI-014, (f) the four 1.0.11 refusals; until they run, the "live confirmation
  pending" clauses stand, and a BROKEN verdict there reopens this section as each entry names.
  Open PRs to dev: #58 (this branch, 0.54.1) MERGEABLE/CLEAN with five checks green at 179a27e before this verdict
  commit; #57 (session B, F-548/F-530, 0.55.0) reads MERGEABLE/CLEAN with five checks green at 28f1630 (no longer
  CONFLICTING). Neither merged by the tester; the Fix note's numbering rule for whichever lands second stands.
  Verdict: VERIFIED.

## F-550 — FIXED
Reported: 2026-10-15 (builder, session E2 of gs-fortress ledger/reports/build-kickoffs-1.0.12.md — the gated
adoption, CP-1 + CP-7, spawned on the adopt decision recorded in the gs-fortress ledger on 2026-10-15; audit:
ledger/reports/audit-1.0.12.md §0, §1.3, §1.5, §1.8, §1.10, §1.12, §1.14, §5)
Severity: normal — shipped behaviour is wrong for a user whose installed CLI is 1.0.11 or 1.0.12 (npm latest since
2026-10-15, so every new install): the plugin's bundled catalog, cheatsheet and ask-rules document 1.0.10, and the
per-pin CLI facts table (doc-lib CLI_PIN_FACTS) is withdrawn from such a workspace with its "not applied —
re-verify" warning, so setup's candidate gate stops bucketing the four `re rules` per-asset reads and report stops
relaying the scope limits (audit §1.14's interim effect) — while every one of those facts still holds there
What: the pin is 1.0.10 and the documented CLI is three releases behind what a user installs. The range 1.0.10 ->
1.0.12 moves no command, flag or tool (audit §0: counts 10 / 188 = 170+12+6 / 182 unchanged, zero adds, removes,
renames or mutating flips; nonMutatingWrites strict 0 and withPost 20 on the identical id list; the full catalog
walk finds one difference beyond the meta stamps, the `dm o list --sort-field` description), and 1.0.12 is 1.0.11's
dist byte for byte plus one dependency pin — so the adoption is a regen plus the version prose and the three
check-stale-facts fact carriers, each cleared by re-verification. One entry of CLI_PIN_FACTS is known changed from
the handler diff (journey:email:templates: 1.0.11's listEmailTemplates descends subfolders), and its rewrite is
specified from the live count CP-6 (c) banks (dev/VALIDATION.md § F-549 / CP-6 (c)) — still owed at this round.
Repro (no tenant needed): `node plugins/gs-superadmin/scripts/domain-candidates.mjs diff` over a scratch workspace
whose .gs-superadmin/catalog.json carries meta.cliVersion "1.0.12" (or "1.0.11"): pinFacts.applied false, the
"stamped for 1.0.10 (also verified on 1.0.9)" warning, notEnumerableBareCount 0; `gs-admin --version` on a fresh
install prints 1.0.12 while plugins/gs-superadmin/reference/version.json says 1.0.10.
Expected: CP-1 — the global CLI at 1.0.12 and a full npm run build; counts unchanged, nonMutatingWrites 0 strict /
20 withPost on the same id list, data/catalog.json differing from 1.0.10's ONLY in meta.cliVersion, generatedAt and
the dm o list --sort-field description, data/reader-shapes.json only in cliVersion (anything else: stop and log
here). CP-7 — check-stale-facts drives the bulk version pass; SEMANTICS_BASIS records 1.0.11 and 1.0.12 (never
re-derived: rules-engine handler and manifest byte-identical); the CLAUDE.md counts line; the operating model's
Known CLI issues header restated for 1.0.12; the three FACT_CARRIERS stamps in doc-lib.mjs cleared by
re-verification, never by loosening a pattern: (a) the auth-death literals re-read from 1.0.12's
dist/core/auth/index.js (AUTH_DEATH untouched — narrowing it is a frozen-contract violation), (b) READ_VERB_EXACT
re-audited (zero commands moved), (c) every CLI_PIN_FACTS entry hand re-verified, the stamp 1.0.12, the templates
entry rewritten from CP-6 (c) or removed with its index-scope-notes.md heading (check 23), alsoVerifiedOn per F-467
as written. Plugin bump + CHANGELOG. check-stale-facts and check-doc-drift green; the full battery green.
Not in scope: the live checks themselves (CP-6, owed on a 1.0.11-or-later CLI with a token); CP-8 (gs-fortress);
CP-9 (Bradley's memo); any doctrine sentence (E1, merged in PR #58).
Plan: gs-fortress ledger/reports/build-kickoffs-1.0.12.md, session E2 (CP-1, CP-7); close-out after the merge:
close-out.mjs 1.0.12 --session E2 --pr 59 --commit, and again with --release once tagged (never typed by hand).
Fix: 2026-10-15 (builder, session E2; branch claude/adopt-cli-1-0-12-483229, PR #59 to dev, UNMERGED; plugin
0.55.0). The class, in one sentence: a current-version claim is a fact with a pin stamp, and an adoption moves
every stamp together — the regen, the prose the checker pins, and the three code carriers — each by re-reading the
new package, never by editing the pattern that holds it.
  CP-1: global @gainsight/gs-admin-cli 1.0.10 -> 1.0.12; npm run build. Measured against the pre-regen snapshot
  with a full JSON walk: catalog 3 differences (meta.cliVersion, meta.generatedAt, commands[17].flags[5].description
  — `dm o list --sort-field`, now naming the nine server-sortable keys), reader-shapes 1 (cliVersion); command id
  list, mutating flags and the 20-strong withPost id list identical; strict 0. Generated outputs: reference/domains
  (the one description + the stamp), the plugin bundle (version.json, cheatsheet header, catalog), the wiki and the
  comparison page (version stamps only).
  CP-7: the bulk pass — 19 v-prefixed/package citations in 15 files plus the two README Currency dates (the checker
  pins them to meta.generatedAt) — each read in context before moving: the scorecard handler is byte-identical from
  1.0.8 through 1.0.12 (document-domain-notes, setup SKILL.md), the rules-engine surface identical (change-request's
  two set-source claims), the token lifecycle identical (reference/auth.md: token-store.js byte-identical), no
  artifact action mcp.hidden (reference/mcp.md). Known CLI issues header: what 1.0.11 changed (report,
  data-management and journey handlers, error exits, token-store loading; the entries say which version each holds
  for) and that 1.0.11 -> 1.0.12 changed nothing in dist. SEMANTICS_BASIS gains 1.0.11 and 1.0.12 as a record; the
  four expected-map lines refreshed through the test's own refresh flag (diff reviewed: the string only).
  Carrier (a): 1.0.12's dist/core/auth/index.js throws exactly the two literals the comment lists (lines 28 and 31:
  "No stored token found. Run `gs-admin login` to authenticate." / "Access token has expired. Run `gs-admin login`
  to re-authenticate."); no other `gs-admin login` sentence in dist/core/auth is a throw; AUTH_DEATH unchanged.
  Carrier (b): over the 1.0.12 catalog, 97 non-mutating commands, 60 with a trailing verb outside the describe/list
  shapes, and the set admits exactly the ones it did at 1.0.10 — template, measures, get (x2), schedules, topics,
  events, s3-tasks, event-curl (x2) — on the identical command id list; unchanged.
  Carrier (c): the four rules-engine notEnumerableBare entries and the two other scope entries re-verified unchanged
  (manifests and handlers byte-identical through 1.0.12); stamp 1.0.12. alsoVerifiedOn: F-467 as written — "the
  table applies at every CLI version its entries were verified on", and "an adoption that finds an entry changed
  drops the older versions" — so 1.0.10 and 1.0.9 drop (the templates entry is changed from 1.0.11), and 1.0.11 IS
  a version the entries are verified on, by the same reading that verifies them at 1.0.12 (dist byte-identical) —
  recorded as ["1.0.11"] with that basis in the comment, per audit §1.14; no per-entry version scoping was
  improvised, and no bus finding is needed since the repo's own rule permits it. The journey:email:templates entry
  KEEPS the 1.0.10 wording: CP-6 (c) is not CLEARED (the tester's CLI was 1.0.10; all six live checks owed), so
  the rewrite — or the removal with its heading — waits for the count; a comment beside the entry says so; the
  canon subsection (index-scope-notes.md) already says which version each clause holds for. Consequence, stated: a
  1.0.11/1.0.12 workspace's report relays the 1.0.10 scope line for that one domain until (c) clears, in exchange
  for the four still-true per-asset facts and the two other scope limits coming back.
  Plugin 0.54.1 -> 0.55.0 (a CLI adoption was a minor at 0.43.0) with a CHANGELOG entry naming the effect; the
  number collides with #57's 0.55.0 on purpose (the PR template: never rebase to chase a number — whichever merges
  second takes the next one).
Judge: for CP-1, a differential rather than the audit's word — the full JSON walk of the pre-regen snapshot against
the regen, and the id-list / mutating-flag / withPost equalities computed from both catalogs (the predicted set
held exactly); for CP-7, the checker is the judge of completeness (23 reds at the regen, 0 after, none cleared by
a pattern edit — `git diff build/check-stale-facts.mjs` is empty) and the installed 1.0.12 package is the judge of
each carrier (the literals grepped from its dist, the allowlist re-derived from its catalog, the pin facts read
against its manifests and handlers); the one judgment the fixer could not make — the templates entry's new
scope — is left to CP-6 (c)'s live count, not guessed.
Sibling sweep: every other version-keyed carrier a stale-facts red would not reach — hooks/ask-overrides.json
(entries retire on catalog content, verifiedOnCli feeds prompt text only; its two counts 0 / 20 unchanged, pinned
by FACT_CARRIERS), the guard's catalog-version union (equality, by design), the token pre-flight canon ("1.0.10 and
later" — true at 1.0.12, token-store.js byte-identical), describe-batch's fake-CLI literals (1.0.12's own two throw
texts) — none moves. Bare "1.0.10" prose outside the checker's patterns grepped across CLAUDE.md, the READMEs,
CONTRIBUTING and building-on-gs-admin: no current-pin claim in the bare form.
Battery: 62 steps, 62 pass, 0 red (20:48 to 21:39 local, 51 minutes on this host) — both workflow step lists verbatim (validate-plugin.yml validate + manifests; docs-drift.yml
full arm) on this worktree.
Ordering against #57 (session B, F-548 / F-530, feat/f548-ranking-every-refresh, CONFLICTING against dev again since
PR #58's bus lines landed): no file overlap beyond the tail of dev/FEEDBACK.md and plugin.json/CHANGELOG (both bump
to 0.55.0); whichever merges second rebases and takes the next number — Bradley's call; neither PR merged by its
author.
Reload: the regen reaches a workspace through setup Phase 3 / refresh (the bundled catalog is the fallback); the
pin facts through any domain-candidates or manifest report run; /reload-plugins for the skill references.
