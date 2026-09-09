<!-- See CONTRIBUTING.md (narrative) and AGENTS.md (rules of record).

     `gh pr create --body-file` bypasses this file: GitHub pre-fills it only in the web
     compare form and in gh's interactive editor. A body composed in a file reproduces
     the three sections and the checklist below by hand. -->

> **Base branch must be `dev`, not `main`.** If the base dropdown above says `main`,
> change it now (**Edit** next to the title → base: `dev`); a PR to `main` from anything
> but a `release/*` branch fails the required `guard` check.
>
> **Regenerated output committed?** Nothing under `data/`, `reference/domains/`,
> `wiki/*.html`, or `plugins/gs-superadmin/reference/` is hand-edited; if your change
> touches a generator or a doc a generator embeds, run the build (`npm run build`, or the
> derived generators AGENTS.md lists — no CLI needed) and commit the result, or CI's
> rebuild-and-diff fails the PR.

## What

<!-- What changed, in a paragraph or a short list. Link issues / bus entries if any. -->

## Why

<!-- The reason, and the measurement or finding that motivated it. -->

## Review notes

<!-- What a reviewer should look at first; anything verified locally beyond CI. -->

CI already fails the PR on the mechanical gates: generated-file drift and "was
`npm run build` run" (`check-doc-drift`, rebuild-and-diff), new dependencies
(`check-imports`), tenant/instance data anywhere in the tree (`check-instance-data`),
and the guard's fixture verdicts (`test/guard-fixtures.mjs`). The boxes here are the
judgments only a human can make:

- [ ] Plugin version bumped in `.claude-plugin/plugin.json` with a CHANGELOG entry
      (user-visible plugin change) / not needed (docs-only).
- [ ] **Safety boundary**: this PR does / does not touch `hooks/gs-admin-guard.mjs` or
      ask-rules generation. If it does: no "ask" became a "deny" or disappeared, and
      `test/guard-fixtures.mjs` was extended to cover the change.
- [ ] Skill edits: cross-document consistency checked (operating model, managed
      CLAUDE.md block, cheatsheet renderer all agree on any statement this PR touches),
      **and** the changed skill was walked for real in a live session — no CI check reads
      skill behaviour (CONTRIBUTING.md, "Skill prose has no automated test").
      Session / verdict: ____
- [ ] No test or dev step touched real gs-admin state (`~/.gs-admin/`, live tenants).
- [ ] No tenant/instance/org-specific data in commit messages or this PR body — CI
      scans the tree, not these. See "Data hygiene" in AGENTS.md.
