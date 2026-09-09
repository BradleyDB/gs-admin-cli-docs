# RELEASE CHECKLIST — gs-superadmin (human-readable, fill-in template)

Dev-branch-only file (stripped at release with the rest of dev/). This is the
repo-specific companion to the maintainer's release procedure (the /dev-loop skill,
Step 4 — that skill stays the procedure of record; this file is the order, the
repo's own gates, and the traps that have actually fired here). Copy the "Release
note" block at the bottom into the bus close-out comment and fill in every blank.

Conventions in this file: X.Y.Z is the plugin version being cut (a DEFERRED header
spells it bare: `DEFERRED (past 0.36.0)`). On the LIVE bus,
spell a plugin tag as [v]X.Y.Z — a bare v-prefixed literal there trips
check-stale-facts (it expects the CLI pin). Quote rendered output as 4-space-indented
lines, never fenced blocks (F-328).

## 0 · Should this be a release at all?

- [ ] Something user-visible is staged: plugin.json `version` on dev is ahead of the
      released version, and CHANGELOG.md has an entry for every staged version.
      (Doc-only or test-only rounds need neither — no bump, no release.)
- [ ] Released version (tag on main) ....... :
- [ ] Staged on dev (all unreleased) ........ :
- [ ] What a user gets by updating (one line) :

## 1 · Pre-flight on dev

- [ ] `git fetch --prune` FIRST, then fast-forward the local `main` ref. A stale local
      main makes the payload look larger than it is (the 0.27.0 trap, fired again at
      the last cut). Always diff `origin/main...dev`, never `main...dev`.
- [ ] Step 0 of the ceremony, BEFORE the bus-terminal check: re-open every live section
      `DEFERRED (past <an older version>)` to OPEN with a dated `Reopened:` note naming
      this release, and re-decide each one (fix / WONTFIX / defer again with a real
      trigger). Deferral is decided once per release, never inherited.
- [ ] Auto-defer open polish, once: each OPEN `Severity: polish` section that has never
      been auto-deferred becomes `DEFERRED (past X.Y.Z)` with
      `Defer: <date> (auto, release ceremony) - past X.Y.Z. Why not now: OPEN polish at
      release. Reopen: next release ceremony.` One already carrying an `(auto` Defer line
      has spent its free pass and blocks like a normal finding. Commit these bus edits
      on dev before cutting anything - they are decisions of record even if the gate
      then fails. (`dev-utils release X.Y.Z --gate-only` does step 0 + the gate.)
- [ ] Bus terminal: every live `## F-` section is VERIFIED, WONTFIX, or
      `DEFERRED (past X.Y.Z)` for THIS version; the Under test line points at dev. (An
      OPEN normal/high finding gates a release, not a feature merge; a section deferred
      past an OLDER version is a blocker, not a pass.)
- [ ] Every open PR to dev is NAMED and dispositioned (`gh pr list --base dev`), bot
      PRs included — merged, closed with a reason, or carried forward in this note.
- [ ] Spent dev/VALIDATION.md checks for what merged are flipped (CLEARED / retired /
      standing-arm) — no stale banked checks for shipped items.
- [ ] Local battery green on the dev tip, run VERBATIM from both workflow YAMLs
      (validate-plugin.yml + docs-drift.yml step lists). This is the mid-wave
      evidence; CI on the release PR is the release-grade run.
- [ ] Both strict validates pass: `claude plugin validate plugins/gs-superadmin` and
      the repo build reproduces committed output (rebuild diff clean).

## 2 · Release-gate review (on dev, never on the release branch)

- [ ] `/code-review` at the agreed effort over `origin/main...dev` (LOW when every
      shipped hunk was already reviewed at merge time, MEDIUM otherwise). Findings
      are fixed ON DEV and go through the loop (handoff + tester verdict) like any
      other change. Record: effort · findings · disposition.
- [ ] `/security-review` when the payload touches the guard, hooks, scripts that
      spawn, or anything reading tenant data. Record the highest severity found.
- [ ] Tie-break, stated BEFORE any gate fix is designed: when "clean release" and "the
      smallest change" conflict, root cause wins and its cost is named in the Fix note.
      The 0.37.0 gate paid two extra tester rounds for two boundary tunes that a one-hour
      rewrite replaced. A fix of a registered class names its `Judge:` (never the fixer's
      own list); a section reopened twice gets a `Redesign:`, not a third tune (bus rules
      4 and 5; check-stale-facts refuses both).

## 3 · Cut the release branch

- [ ] Version bump + CHANGELOG entry (with the date) are ALREADY on dev — never on the
      release branch.
- [ ] `git switch -c release/vX.Y.Z dev` from the dev tip; note the tip sha.
- [ ] ONE commit beyond dev, the strip: delete `dev/` and
      `plugins/gs-superadmin/skills/dev-canary/`. Verify both are gone from the tree
      being PR'd. Anything else that seems to need changing belongs on dev — recut.
- [ ] On the STRIPPED tree: both strict validates + the full battery verbatim from both
      YAMLs. The stripped tree is a different tree — a tree-shape assumption in a
      check or test surfaces here first (F-356: test fakes flushing on exit went red on
      macOS only; fixed test-only on dev, recut).
- [ ] Push; `gh pr create --base main --head release/vX.Y.Z`. Do NOT merge — hand the
      URL to Bradley. pr-target-guard must pass (it permits release/* only).

## 4 · CI on the release PR — the verdict is the 3-OS matrix

- [ ] Wait for completion, then QUOTE each run's conclusion per job (F-340 — run id +
      verdict pasted after the run finishes, never asserted before):
          validate-plugin <run id>: manifests / ubuntu / macos / windows — each verdict
          docs-drift <run id>: drift (full) — verdict
          pr-target-guard <run id>: guard — verdict
- [ ] One red OS leg = recut after a dev-side fix, not a merge with a note.

## 5 · Merge, tag, tidy (after Bradley says merged, or `gh pr view --json state`)

- [ ] `git fetch && git tag vX.Y.Z origin/main && git push origin vX.Y.Z`
- [ ] Delete `release/vX.Y.Z` local + remote. (A release branch left behind is a
      stranded-branch finding at the next sweep.)
- [ ] Checkout back on dev. Never merge main into dev.
- [ ] GitHub Release for the tag — decided 2026-09-04 (Bradley, at the [v]0.35.4 cut):
      every release, always. Notes = the CHANGELOG entries a user gets by updating from
      the PREVIOUS released tag (all staged versions, newest first, verbatim), with a
      the fixed intro from `.github/release-intro.md` (what the plugin is; the two
      consumer-refresh commands) — cat the file, never re-compose it:
          { cat .github/release-intro.md; echo; awk '/^## X.Y.Z/{p=1} /^## <previous released version>/{exit} p' plugins/gs-superadmin/CHANGELOG.md; } > notes.md
          gh release create vX.Y.Z --title "vX.Y.Z" --notes-file notes.md --verify-tag
      Then `gh release view vX.Y.Z` — not a draft, not a prerelease. Quote the URL in
      the release note below.

## 6 · Post-release housekeeping on dev (one `bus:` commit, [skip ci])

- [ ] Archive every section released in X.Y.Z VERBATIM to dev/FEEDBACK-archive.md
      (prefix bytes untouched). Commit message carries: live count before → after,
      archive count before → after, the sum, and the moved block's sha256.
- [ ] Entry hint in the bus header: update the "last move" date and F-range.
- [ ] Under test + canary re-stamped to `dev · hb-YYYYMMDD-NN · date` (both the bus
      line and the dev-canary skill description, same commit).
- [ ] Bus close-out comment = the filled-in Release note below.
- [ ] Next free F-number stated (max across BOTH files' `## F-` headers + header
      claims).
- [ ] Ledgers that track this program: handoff plan session ledger line (if a program
      is in flight) and the project-memory chronicle tail.
- [ ] Consumer refresh reminder — BOTH commands, in order:
          claude plugin marketplace update <marketplace>
          claude plugin update gs-superadmin@<marketplace>
- [ ] Anything that reads its config from main is now live (Dependabot reads
      dependabot.yml from the default branch — a policy change on dev activates only
      at this point; say so if one shipped).

## Release note (copy into the bus close-out comment, fill every blank)

    <!-- builder YYYY-MM-DD ([v]X.Y.Z RELEASED — post-release housekeeping):
         Payload: <one line — what a user gets>. Staged versions folded in: <list>.
         Gate 1 (bus): terminal — <F-range> all VERIFIED/WONTFIX; open PRs to dev: <none | list + disposition>.
         Gate 2 (review): /code-review <effort> over origin/main...dev — <n findings, disposition>;
           /security-review — <run | skipped: reason>; highest severity <x>.
         Cut: release/[v]X.Y.Z from dev @ <sha>, ONE commit beyond (the strip, <sha>);
           stripped tree: both strict validates PASS; battery verbatim <n/n>.
         CI on the release PR #<n>, QUOTED per job after completion:
             validate-plugin <run id>: <manifests / ubuntu / macos / windows verdicts>
             docs-drift <run id>: drift (full) <verdict>
             pr-target-guard <run id>: guard <verdict>
         Merged by Bradley (main @ <sha>); tag [v]X.Y.Z pushed; release branch deleted
           local+remote; checkout back on dev.
         Housekeeping: <F-range> moved VERBATIM to the archive (live a → b, archive c → d,
           sum e; block sha256 <hash>); entry hint updated; Under test + canary →
           dev · hb-YYYYMMDD-NN. Next free number F-<n>. Released: X.Y.Z; dev stages
           <nothing | versions>.
         Now live from main: <Dependabot policy / workflow change | nothing>.
         GitHub Release: <url> (notes = the CHANGELOG entries since the previous tag).
         Consumer refresh: claude plugin marketplace update <mp>; claude plugin update
           gs-superadmin@<mp>.
         Carried forward (not in this release): <items, or none>. -->
