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


Under test: dev · seed · 2026-09-09

## F-448 — FIXED
Reported: 2026-09-09 (builder, at the 2026-09-09 docs-only cut)
Severity: normal — the release path is blocked for any cut that changes no plugin path; no user-facing behaviour is wrong, but a release cannot merge without weakening the gate
What: the main ruleset requires manifests and validate (ubuntu-latest | windows-latest | macos-latest), but validate-plugin.yml's pull_request trigger carried a paths filter. A release PR whose diff touches none of those paths (PR #7: CONTRIBUTING, README, .gitattributes, .github/*) never starts the workflow; an unstarted workflow reports no check run; GitHub shows the four contexts as "Expected" and the PR is BLOCKED with every reported check green. Every earlier release changed plugin bytes, so the gap never fired on the private predecessor.
Repro: open a PR to main from a release/* branch whose changed files are outside the paths list; gh pr checks lists only drift (full), guard, GitGuardian; gh pr view --json mergeStateStatus reads BLOCKED.
Tried and refuted at this cut: gh workflow run validate-plugin.yml --ref <release branch> -f full_matrix=true. All four jobs succeeded on the same head sha (run 34401015130), but GitHub's PR rollup counts only check suites raised by the PR's own events — the dispatch suite never appears in gh pr checks and the PR stayed BLOCKED. The bus header's "release-grade recheck" dispatch is evidence, never a gate.
Fix: 2026-09-09 (builder) — GitHub's documented shape for a required check behind a path filter (docs: "Handling skipped but required checks" — a workflow skipped by paths leaves its checks Pending; a job skipped by a job-level if reports Success). The pull_request trigger loses its paths filter; a new first job `changes` decides from the PR's own diff (git diff --name-only HEAD~1 HEAD against the same pathspec list) and always answers run=true when the base is main or the event is not a pull_request; `validate` and `manifests` carry needs: changes + if: needs.changes.outputs.run == 'true'. Docs-only PRs to dev still start no runner for the battery (the jobs skip); PRs to main always run the full matrix. The push trigger keeps its paths filter (push events gate no merge, and not starting a run at all is F-266's point) — that list and the pathspec list in `changes` are the same fact in two homes, each commented to name the other. Cost of the root cause over a workaround: one CI-touching PR to dev and a recut of the release branch; the alternative (removing the four contexts from the ruleset for one merge) weakens the gate and leaves no trace in the repo.
Judge: the recut release PR's own required-check rollup — gh pr checks on the new head lists manifests and the three validate legs with the ruleset satisfied (mergeStateStatus not BLOCKED), or the fix is wrong; independent of anything the fixer asserts. Sibling: docs-drift.yml carries no paths filter (it always runs), pr-target-guard is branch-filtered to PRs targeting main, where it is the only place it is required — no other required context sits behind a trigger-level filter.
