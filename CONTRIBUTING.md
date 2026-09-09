# Contributing

Thanks for helping build the gs-admin knowledge base and the gs-superadmin plugin. This
guide is the narrative version: why things are the way they are, how to get set up, and
how to land a change. The terse rules-of-record — written to be pasted into an AI coding
assistant — live in [AGENTS.md](AGENTS.md); if you use an LLM to develop (most
contributors here do), load that file into its context before it touches anything.

## The one thing to internalize

Everything in this repo derives from one artifact: `data/catalog.json`, extracted from
the installed `@gainsight/gs-admin-cli` package's own manifests. The reference docs, the
wiki, the plugin's cheatsheet, its mutation guard, and its `permissions.ask` rules are
all **generated from the catalog**. That has two consequences:

1. A large fraction of the repo's files must never be hand-edited. Each generated file
   carries a "GENERATED FILE — do not edit by hand" banner naming its regenerate
   command, and CI enforces the split by rebuilding and diffing. The full table is in
   [AGENTS.md](AGENTS.md).
2. New behavior should derive from the catalog too. The guard hook knows what's mutating
   because the catalog says so — if you find yourself hardcoding a command list, you're
   probably at the wrong altitude.

## Setup

**Documentation and plugin changes** need nothing but Node ≥ 18 (CI runs 20) and a
clone — the build
reads the committed `data/catalog.json`, and there are **zero npm dependencies** (no
`npm install`, ever, to build or test; this is a deliberate tenet, not an oversight).
The only entries in package.json's devDependencies are the checker-only
`typescript` and `@types/node` behind `npm run typecheck` — the JSDoc-contract type
gate CI runs (`npm ci` first); nothing at runtime resolves from them (AGENTS.md
tenet 5).

**Regenerating the catalog itself** additionally needs the pinned CLI installed globally
— install the exact version the repo documents, not `@latest`:

```bash
npm i -g @gainsight/gs-admin-cli@"$(node -p "require('./data/catalog.json').meta.cliVersion")"
npm run build   # catalog → reference → wiki → plugin bundle; must reproduce committed output
```

(`@latest` is only for a *deliberate upgrade* of what the repo documents — that's a real
change with large diffs everywhere, plus updates to the hand-written counts/versions that
`node build/check-stale-facts.mjs` flags.)

**Developing the plugin** against a live Claude Code session:

```bash
claude --plugin-dir /path/to/this-repo/plugins/gs-superadmin
# then inside the session: /reload-plugins after each edit
```

## Design tenets (deliberate decisions that look like bugs)

Well-meaning PRs — especially LLM-drafted ones — tend to "fix" these. The rules
themselves are stated exactly once, in [AGENTS.md](AGENTS.md) (Design tenets section) —
what follows is only the *why* behind each:

- **Ask, never block** — because the governing requirement is that the plugin never
  countermands the CLI; the human approval prompt is itself the override mechanism.
  (The pipe-lint's deny is different in kind: that command is broken as written, and
  denying with a quoting hint lets the model self-correct.)
- **Fail-open on hook errors, fail-closed on unknown commands** — because plain
  `gs-admin` users must never be broken by the plugin, while an unrecognized command
  could be a mutation from a newer CLI, and silence there would be a safety hole.
- **The hook only adds restrictions** — because that is what makes trusting the
  workspace-local catalog copy acceptable at all.
- **Manifests are untrusted** — because `_manifest.json` files arrive with cloned repos.
- **Zero dependencies** — because the supply-chain surface of a tool that guards
  production tenants should be nil. (The two checker-only devDependencies behind
  `npm run typecheck` never load at runtime — AGENTS.md tenet 5's one carve-out.)

## Writing skills: SKILL.md files are executable specs

The plugin's skills are **instructions executed by an LLM**, which makes ambiguity a bug
class with real consequences. Rules, each learned from an actual bug:

- **Fenced blocks are literal output.** A meta-instruction placed inside a template
  block ("← one line per manifest; omit if only one") can be rendered verbatim into a
  user's CLAUDE.md forever. Render rules go in prose above the fence.
- **Placeholders need explicit repeat rules.** Show one repeatable line and state "one
  line per X", not numbered placeholders that stop at 2.
- **Cross-document consistency is load-bearing.** The operating model, the managed
  CLAUDE.md block, and the cheatsheet are all loaded into the same session; two of them
  once gave opposite `whoami` cadences, and an LLM will anchor on whichever suits it.
  Before editing a statement, grep for the same topic across `templates/`, `skills/`,
  and the cheatsheet renderer in `build/render-cheatsheet.mjs` (the shared emitter
  `build/build-plugin-gs-superadmin.mjs` imports).
- **Bulk data never enters model context.** List output goes to files; the files go to
  `scripts/manifest.mjs`, which owns manifest integrity (atomic writes, shape checks).
- **Ask-once means marker-backed.** Any "ask the user once" interaction needs a durable
  marker (a manifest field, a marker comment) so re-runs are idempotent.
- **Bundled scripts are addressed through the workspace link.** A fence runs
  `node .gs-superadmin/plugin/scripts/<x>.mjs …` — `.gs-superadmin/plugin` is a directory
  link to the loaded plugin's root that `scripts/plugin-link.mjs` creates at setup and
  refreshes at every session start. Never spell the `${CLAUDE_PLUGIN_ROOT}` placeholder in
  a skill: only the plugin loader substitutes it, so a literal that survives (a skill read
  from the repo tree, a pasted snippet) expands to empty in both shells. Its two homes are
  `hooks/hooks.json` and setup's first-run link fence; `build/check-doc-drift.mjs` check 10
  rejects it anywhere else.

## Testing

**The hard rule: never test against real state.** No `gs-admin login`, no `gs-admin
config`, no mutating command against a real tenant or the real `~/.gs-admin/` during
development. The fixture harness exists precisely for this — it builds throwaway
workspaces in the OS temp dir and pipes hook input over stdin. (This rule is written in
the blood of one review session where an agent's live `gs-admin config` overwrote the
machine's real CLI config.)

Before opening a PR, run whatever applies. The authoritative, always-current list of
every fixture suite and checker lives in [AGENTS.md](AGENTS.md) (Testing section) — run
the ones covering what you touched. The three that apply to almost every change:

```bash
node plugins/gs-superadmin/test/guard-fixtures.mjs        # guard hook (mutations, environment, pipe lint, journal)
node build/build-plugin-gs-superadmin.mjs                 # rebuild the plugin bundle…
git diff --exit-code plugins/gs-superadmin                # …then: no drift vs the committed output
node build/check-stale-facts.mjs   # hand-written docs cite the right CLI version/counts
```

CI runs the full set on PRs that touch plugin-affecting paths (see the `paths` filter
in `.github/workflows/validate-plugin.yml`). A lighter job
(`.github/workflows/docs-drift.yml`) runs on **every** PR, including docs-only ones: it
rebuilds everything derived from the committed catalog and fails on any diff, so a
hand-edit to a GENERATED file can't slip through unchecked. If you changed the guard
hook, extend `test/guard-fixtures.mjs` to cover the new behavior — the suite is the
hook's safety net, and a hook change without a fixture change is a red flag in review.

**Skill prose has no automated test.** Every CI suite is script-level: a PR that changes
only a `SKILL.md` passes every check green whether or not the skill still works. A change
to a skill's steps, rules, or asks therefore needs a tester round — a session that loads
the working tree (the `claude --plugin-dir` command in the bus header), runs the changed
skill for real, and records the verdict on `dev/FEEDBACK.md`. Six of the shipped skills
carry `disable-model-invocation: true` (the plugin README's catalog table marks them
"slash only"): Claude Code refuses to run those from the Skill tool, so the person in the
tester session types the slash command themselves — that is the documented and only way
such a skill runs, and it counts as the walk. Say in the PR which skill
was walked and in which session. If the walk needs a tenant you do not have, say so; the
maintainer banks it in `dev/VALIDATION.md` and runs it before the next release.

**Windows notes:** single quotes are literal in both PowerShell and bash — always
single-quote asset names (they contain `|`). For multiline strings to native commands
(commit messages), prefer a bash heredoc; PowerShell here-strings are easy to get
subtly wrong. The rebuild-and-drift check above is two separate lines deliberately:
`&&` is bash/PowerShell 7+ syntax that Windows PowerShell 5.1 rejects at parse time
(chain with `;` there if you must).

## Submitting changes

This repo runs a two-branch dev-loop: day-to-day work lands on `dev`, and `main` is the
released surface that marketplace users clone.

- **Branch off `dev`, PR to `dev`.** Never push or PR `main` directly — releases reach
  `main` only via a short-lived `release/vX.Y.Z` branch cut from `dev`, on which
  dev-branch-only content (the `dev-canary` skill, the `dev/` directory) is stripped
  first. Never merge `main` back into `dev`. CI flags the targeting rule: a PR
  aimed at `main` from anything but a `release/*` branch fails the `pr-target-guard`
  workflow with a pointer back to this section (advisory until the repo's branch
  protections mark that check required).
- Cross-session feedback (tester findings, fix status) flows through `dev/FEEDBACK.md`
  (statuses OPEN → FIXED → VERIFIED | WONTFIX); deferred live checks are banked in
  `dev/VALIDATION.md`.
- Every PR runs the generated-file drift check and the doc-drift checker
  (`docs-drift.yml`); PRs touching plugin-affecting paths additionally run strict
  validation and every fixture suite (`validate-plugin.yml`).
- Shape the PR body per `.github/pull_request_template.md` — `## What` / `## Why` /
  `## Review notes`, then the short checklist of judgments CI cannot make (version bump
  or not, safety boundary, skill cross-document consistency, no real state touched).
  `gh pr create --body-file` never pre-fills the template — GitHub does that only in the
  web form and gh's interactive editor — so a body composed in a file reproduces it.
- **Bump the plugin version** (`plugins/gs-superadmin/.claude-plugin/plugin.json`) on
  any user-visible plugin change, and add a matching entry to
  `plugins/gs-superadmin/CHANGELOG.md`; docs-only changes need neither. The marketplace
  doesn't pin versions.
- **Changes to `hooks/gs-admin-guard.mjs` or to the ask-rules generation are
  safety-boundary changes.** Say so explicitly in the PR description; they get extra
  review scrutiny, and "asks became denies" or "asks disappeared" are the specific
  regressions reviewers look for.
- Skill edits should note in the PR that the cross-document consistency check was done
  (what you grepped, what agrees with what).
- **Nothing tenant-, instance-, or org-specific is ever committed** — real tenant data
  once got as far as a pushed branch here; the rule (and the CI check that now enforces
  it on every PR) lives in AGENTS.md, "Data hygiene".
- **Found a guard bypass or other security hole?** Report it privately per
  [SECURITY.md](SECURITY.md) — don't open a public issue or a PR whose diff documents
  the bypass.

## Reading the citations in code comments

Comments across `build/`, `plugins/gs-superadmin/scripts/`, the test suites, and the guard
hook cite tokens such as `F-268`, `GP-B5 DS-43`, `W9`, `ER-15`, or `T-3`. They are
provenance, not links — the reasoning you need is in the comment beside them:

- **`F-nnn`** is a finding number on the maintainer's cross-session feedback bus
  (`dev/FEEDBACK.md`, dev-branch only — see "Submitting changes"). The number is a stable
  id for the incident that motivated the code; the comment carries the why. The bus
  history is not published — the public repository's `dev` branch starts with an empty
  bus — so a number you cannot look up is expected, not a broken reference.
- **Planning-record tokens** cite the maintainer's unpublished planning notes: `GP-n` /
  `GP-Bn` (the going-public plan); `DS-nn`, `A-n`, `X-n`, `R-n`, `G-n`, `D-n`, `C-n`,
  `S-n`, `En`, and the `Wn` / `Bn` / `P1` / `C1` wave-and-session labels (the GP-B5
  architecture program); `ER-nn` (the email-report program); `PV`, `CP-n`, `SA-n` (earlier
  programs); and `Mn` mutant labels inside test suites. Every decision they produced is
  recorded where it is enforced — `AGENTS.md`'s design tenets, architecture principles
  (`A-1..A-11`) and considered-and-rejected table, or the check or fixture that carries it.
- **`T-1` … `T-9`** are the FROZEN typedef contracts and do resolve in-tree: T-1 and T-6
  in `build/extract-catalog.mjs`, T-2 in `scripts/manifest.mjs`, T-3 / T-7 / T-8 in
  `scripts/doc-lib.mjs`, T-4 in `scripts/journal-lib.mjs`, T-5 in
  `hooks/gs-admin-guard.mjs`, T-9 in `build/build-wiki.mjs` (plugin paths relative to
  `plugins/gs-superadmin/`).

A comment whose reasoning does not stand without its citation is a documentation bug —
fix the comment (or open an issue) rather than hunting for the record.

## Code of Conduct

Participation here — issues, pull requests, review comments — is covered by the
[Code of Conduct](CODE_OF_CONDUCT.md) (Contributor Covenant). Reporting routes are
GitHub-only and described in its Enforcement section; this project publishes no contact
email address.
