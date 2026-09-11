# gs-superadmin bug rounds, September 2026 — cleanup plan

*Companion to [ROUNDS-2026-09-HANDOFF-PLAN.md](./ROUNDS-2026-09-HANDOFF-PLAN.md). Each
section runs once, after the named milestone passes. The rounds create no artifacts in a
live tenant (tester rounds are reads plus local manifest writes), so the live-system
sweeps collapse to the workspace-manifest notes below.*

---

## Principle 0 — make cleanup a query, not archaeology

1. **Live tenants are read-only for every session in this program.** The only writes
   are to the consumer workspace's local manifests and KB folders, made through the
   plugin's own verbs (`exclude --remove`, `upsert-batch`, `describe-batch`) so the
   manifest's own record is the audit trail. Never hand-edit a manifest to validate.
2. **Validate on the sandbox where a choice exists** (A-V must; B-V may use either).
3. **`dev/VALIDATION.md` holds open checks and their verdicts.** A check that ran is
   marked CLEARED (date + token + the one-line measurement, which also goes into the
   finding's bus verdict). The file stays on `dev` (stripped at release) and never
   lists a tenant slug, org name, or asset id.
4. **Evidence hygiene:** bus text, VALIDATION.md, fixtures, commit messages and PR bodies
   are public-safe — counts and ratios are fine; slugs, hostnames, asset ids, names of
   real assets, request ids and tokens are not. Fixtures stay synthetic.

---

## Section A — after A-V passes (F-449 VERIFIED)

**Repo:**
- [ ] Merge the Session A PR to `dev` (Bradley); delete `f449-evidence-bound-exclusions`
      local + remote.
- [ ] Re-stamp or retire the bus comment on `dev` that named the branch + PR.
- [ ] `dev/VALIDATION.md` § F-449: CLEARED with the fresh numbers, or still OPEN with why.
- [ ] Dispatch `validate-plugin.yml` once on the merged `dev` tip (handoff-point rule in
      the bus header) and quote the per-job conclusions in the bus comment.

**Consumer workspace (sandbox manifest):**
- [ ] The re-decided `report list-objects` entry stands as an adoption (or a judgment
      exclusion with evidence) — never left removed.
- [ ] The journey-data-designer decision (EX-1's open question) recorded on whichever
      tenant was wrong, through the plugin's verbs.

**Graduation:**
- [ ] F-449 no longer blocks feature merges — ledger line says so.

## Section B — after B-V passes

- [ ] Merge the Session B PR; delete `round-b-describe-loop`.
- [ ] Issues #10 and #13 closed by the merge (Closes lines) — confirm on GitHub.
- [ ] VALIDATION.md § DB-2 and § DB-4 CLEARED.
- [ ] Any workspace manifest entry the token-half-life arm marked is left in the state
      the new code produced (nothing marked failed by an auth death); the connectors-
      chains lane reads full depth.

## Section C — after C1-V and C2-V pass

- [ ] Merge both PRs; delete `round-c1-report-truth`, `round-c2-fact-homes`.
- [ ] If FH-1(a) moved CONVENTIONS.md per tenant: the workspace-scope file is either
      the ruled fallback or removed — one home, per the ruling.
- [ ] If FH-1(c) requires a re-list to backfill scope stamps on existing workspaces, the
      banked arm is CLEARED or carried explicitly in the next Blind spots line.
- [ ] Stale-facts tripwire for the per-pin unrunnable list is green at the current pin.

## Section D and E — after D-V and E-V pass

- [ ] Merge; delete `round-d-prose`, `round-e-guard-normalizer`.
- [ ] Issues #1 and #2 closed or commented with what shipped.
- [ ] Plugin README residual list matches `hooks/` residuals (check 11 green).

## Section R — release (the maintainer's ceremony, not a session here)

- [ ] `dev/RELEASE-CHECKLIST.md` and /dev-loop Step 4 are the procedure; this plan only
      says: all rounds' findings VERIFIED / WONTFIX / DEFERRED past the version cut;
      staged versions (0.37.1, 0.38.0, and whatever B–E stage) fold into one release;
      polish findings still OPEN auto-defer once.

## Program wind-down

- [ ] Every round branch merged and deleted; `gh pr list --base dev` empty of round PRs.
- [ ] `dev/VALIDATION.md` holds no OPEN sections from this program.
- [ ] Backlog items BL-1 and BL-2 either scheduled in a new plan or left as the GitHub
      issues they already are (#11, #12) — this plan's ledger closes with a final line.
- [ ] `dev/handoff/` stays on `dev` as the archive (it is stripped at release with the
      rest of `dev/`).
