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
dev/FEEDBACK-archive.md after each release (last move: 2026-09-21, after release 0.42.0 — F-448..F-460 with their round blocks and the four header Walk lines; the 0.37.0 move took
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


Under test: dev · hb-20260921-02 · 2026-09-21
Blind spots (hb-20260921-02): post-release housekeeping after 0.42.0, nothing new under test: F-461 (polish) DEFERRED past 0.42.0 — its step-4 sentence fix is a SKILL.md change and owes a walk when it lands; the `re r executions` production arm is banked in dev/VALIDATION.md, unmeasured; the PR #17 second arm was not blind to the first (attribution confounded) — carries as recorded

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

## F-461 — DEFERRED (past 0.42.0)
Reported: 2026-09-21 (builder, from the Session F-V walk's "noted for the builder" line under VALIDATION § PR #17)
Severity: polish — skill prose overstates a rule the per-line test, the pass bar and CHANGELOG 0.42.0 already state correctly; the plan a user gets is right
What: change-request SKILL.md step 4 closes with "If nothing passes, the section is the template's one empty line; a ticket that says what it's for and asks for the right thing gets exactly that." Measured on the walk (VALIDATION § PR #17, ask A): a ticket that stated its purpose and asked for the right thing got ONE line — a true tenant fact (the CTA Name literal "2022 or Earlier" going stale after the threshold edit) that passes the per-line test and pairs with a rename offer to the requester. The test decides the section; the sentence reads as if the ticket's shape decides it. CHANGELOG 0.42.0 already says such a ticket "gets one line saying so".
Repro: read the sentence (SKILL.md step 4, last paragraph) beside the walk's ask A quote in dev/VALIDATION.md § PR #17 — they disagree on what a well-formed ticket "gets".
Expected: the sentence says what the test decides, e.g. "…the section is the template's one empty line. A ticket that says what it's for and asks for the right thing usually gets exactly that — unless one tenant fact passes the test, and then it gets that one line." Skill prose only; bump per the repo's prose precedent (0.41.1). A SKILL.md change owes a walk (bus header walk hint), so this rides the next substantive round rather than a round of its own; ask A's first-arm quote is the measurement the reworded sentence must agree with.
Defer: 2026-09-21 (auto, release ceremony) - past 0.42.0. Why not now: OPEN polish at release. Reopen: next release ceremony.

## F-462 — OPEN
Reported: 2026-09-21 (carried from gs-fortress ledger/reports/audit-1.0.10.md §1.12 and
§1.14 by the watch's kickoffs step; DECOUPLED from the adopt decision per that audit's §5)
Severity: normal — shipped behaviour is wrong for a user whose installed CLI is 1.0.10:
the F-221 token pre-flight tells the agent usable token life is remaining minus 1800s,
but at 1.0.10 the half-life defect is gone and usable life is remaining minus about 60s,
so every long-batch skill asks for a re-login roughly half an hour early and cites an
error message the CLI no longer prints
What: CLI 1.0.10 removes token refresh on every auth path. Its token-store now treats a
token as expired only 60 s before expires_at (1.0.9 fired at the lifetime midpoint), and
the enrollment path's failure text becomes "Access token has expired. Run gs-admin login
to re-authenticate." instead of "Token expired and silent refresh failed". The pre-flight
canon in skills/setup/SKILL.md, its three paraphrases (refresh, deps-report,
email-report) and check-doc-drift check 16's TOKEN_PREFLIGHT data all encode the
1.0.7-1.0.9 arithmetic unconditionally. Second site, same cause: operating-model.md and
setup/references/document-domain-notes.md attribute the sc measures --id false "No
stored token found" to a concurrent refresh, which 1.0.10 no longer performs. Third,
unrelated: README.md's quick-start install line says Node 18 or later, while the
unpinned install now gets a CLI whose engines field says Node 20 or later. The error is
conservative (nothing breaks, nothing is silently wrong) and the current text is still
right for users on 1.0.9 - so the repair is version-conditional, never a replacement.
Repro (no tenant needed): read the canon's formula line and the audit's §0 item 1
(token-store tokenIsExpired at expires_at minus 60 s); for a fresh 3600 s token the canon
computes 1800 s usable where 1.0.10 gives about 3540 s.
Expected: CP-2 (canon names both version ranges and both failure texts, the agent picks
by gs-admin --version; paraphrases version-qualified; check 16's data moved in step),
CP-3 (the sc measures --id mechanism scoped to 1.0.9 and earlier, workaround kept), CP-4
(install line Node 20), CP-5 (bump + CHANGELOG); CP-6's four live checks banked in
dev/VALIDATION.md on the same branch. Lock: check 16's existing mutants still go red, and
a mutant that deletes the 1.0.10 clause from the canon must produce a COUNTED, REPORTED
miss.
Not in scope: adopting 1.0.10 (catalog regen, version prose, reference/auth.md, the
README Requirements line, and the three check-stale-facts fact-carrier stamps in
plugins/gs-superadmin/scripts/doc-lib.mjs that go red at the regen — the gated session
E2 in gs-fortress ledger/reports/build-kickoffs-1.0.10.md, on Bradley's clock). Also
not in scope: the AUTH_DEATH classifier in doc-lib.mjs — it matches the CLI's shared
re-login sentence, which 1.0.10 still prints, so it keeps working untouched.
Plan: gs-fortress ledger/reports/build-kickoffs-1.0.10.md, session E1 (CP-2, CP-3,
CP-4, CP-5) + V1 (CP-6).
