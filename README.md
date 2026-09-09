# gs-admin Explorer

An **interactive HTML wiki** and an **in-repo knowledge base** for the
[`@gainsight/gs-admin-cli`](https://www.npmjs.com/package/@gainsight/gs-admin-cli) package —
the Gainsight Admin CLI & MCP server (`gs-admin`).

Everything here is **generated from the installed CLI's own manifests**, so it stays
accurate and is regenerable when the CLI is upgraded. **No build dependencies** — Node
built-ins only, no `npm install` to build or test (the `npm run typecheck` gate CI runs
installs two checker-only devDependencies; nothing runs from them).

> **Unaffiliated community project.** This project is not affiliated with, endorsed by, or
> supported by Gainsight, Inc. "Gainsight", `gs-admin`, and `@gainsight/gs-admin-cli` are
> products and/or trademarks of Gainsight, Inc., named here only to describe what this
> project documents and drives. It is not a copy of the CLI and does nothing on its own:
> everything here works against the `@gainsight/gs-admin-cli` package that *you* install,
> license, and authenticate, and the reference material is generated from that installed
> package's own command manifests.
>
> **Support expectations.** One maintainer, best-effort, no SLA. Issues and pull requests
> are welcome, but this is not a support channel for Gainsight products: defects in the
> CLI itself go to Gainsight, not here.
>
> **Currency.** This document was last updated on 2026-09-08 (against
> `@gainsight/gs-admin-cli@1.0.9`) with reference to Gainsight's then-current pre-built and
> generally available Admin CLI package. Gainsight may have updated its documentation and
> available Admin CLI package since then. You can always find the latest version of
> Gainsight's documentation and Admin CLI package at
> [support.gainsight.com](https://support.gainsight.com).
>
> Because this process wasn't built or endorsed by Gainsight, it's possible that a later
> update to the Admin CLI package will interfere with the intended function set forth in
> this document. You can always check [support.gainsight.com](https://support.gainsight.com)
> for the latest information and Admin CLI package.

## What's inside

- **`wiki/index.html`** — a self-contained, offline, searchable explorer for all
  **188 CLI commands / 182 MCP tools** across 10 domains, with per-command flags, examples,
  MCP tool names, REST endpoints, plus guide pages and end-to-end workflows.
- **`reference/`** — the same knowledge as markdown: concept docs (architecture, auth, MCP,
  Lane 2 runtime, output formats), generated per-domain command references
  (`reference/domains/`), task workflows (`reference/workflows/`), and a
  [guide to choosing the gs-admin CLI + plugin vs M2M OAuth](reference/comparison-guide.md)
  for giving an AI or automation access to your tenant (also generated as a shareable
  standalone page: [wiki/comparison-guide.html](wiki/comparison-guide.html)).
- **`data/catalog.json`** — the normalized catalog that drives both of the above.
- **`plugins/gs-superadmin/`** — a **Claude Code plugin** that turns any directory into a
  persistent, per-tenant Gainsight admin workspace (setup walkthrough below).
- **`CLAUDE.md`** — durable context for Claude Code sessions in this repo: what `gs-admin`
  is, where the knowledge lives, and the conventions that matter.

## The gs-superadmin plugin (Claude Code)

The [gs-superadmin plugin](plugins/gs-superadmin/README.md) lets Claude Code operate your
Gainsight tenant through `gs-admin`: it indexes and documents every asset (rules, journeys,
scorecards, reports, connectors, …) into a local knowledge base, and guards every mutating
command behind a human approval prompt — reads run freely, writes always ask.

### 1. Prerequisites

```bash
npm i -g @gainsight/gs-admin-cli   # the CLI itself (Node ≥ 18)
gs-admin login                     # OAuth browser flow for your tenant
gs-admin whoami                    # confirm you're on the right tenant
```

### 2. Install the plugin

From this repo's marketplace:

```bash
claude plugin marketplace add BradleyDB/gs-admin-cli-docs
claude plugin install gs-superadmin@gs-admin-cli-docs
```

(Or interactively inside Claude Code: `/plugin marketplace add BradleyDB/gs-admin-cli-docs`,
then pick **gs-superadmin** from `/plugin`.)

The marketplace add clones this repo over git, so your machine needs GitHub access: for a
public repo that's automatic; while the repo is private, authenticate first (`gh auth login`,
or an SSH key on your GitHub account).

Then **enable auto-update** for the marketplace — `/plugin` → **Marketplaces** →
`gs-admin-cli-docs`. Third-party marketplaces default to auto-update off and there is no
new-version notification, so this is what makes fixes reach you; the
[plugin README](plugins/gs-superadmin/README.md#quick-start) has the same step plus the
two commands for updating by hand.

### 3. First run — bootstrap a workspace

`cd` into the directory you want to work from (a new empty folder is fine), start Claude
Code, and run:

```
/gs-superadmin:setup
```

Setup verifies the CLI and your login, confirms a workspace name for the tenant (e.g.
`acme-prod/`), then indexes your assets and documents the first 25 of them. It creates:

- `<slug>/` — the per-tenant knowledge base (git-ignored; contains real tenant metadata)
- `.gs-superadmin/` — the operating model, build conventions, and command catalog
- a managed block in `CLAUDE.md` so every future session picks the workspace up automatically

Re-run to keep documenting in batches: `/gs-superadmin:setup --budget 50` or
`/gs-superadmin:setup --all`.

### 4. Everyday use

- **Just ask** — "which rules write to the Company object?", "describe the renewal-risk
  journey", "find the rule named 'CS|Risk|Renewal|Alert'". Claude answers from the KB and
  verifies against the live CLI.
- **`/gs-superadmin:refresh`** — detect assets changed since the last run and mark them
  stale (add `--document` to re-document them immediately).
- **`/gs-superadmin:audit`** — check asset names against your naming convention and apply
  renames after you approve the list (setup offers an editable bundled standards pack, or
  bring your org's own).
- **`/gs-superadmin:deprecate`** — walk an asset through your deprecation checklist
  (date-prefix rename, description prefix, folder move, unschedule) plus the UI-only steps.
- **`/gs-superadmin:change-request`** — turn a change request (Jira ticket, request-event
  JSON, or pasted text) into a reviewable implementation plan: KB-cited impact analysis,
  convention-checked names, exact commands, verification, rollback. Nothing executes at
  drafting time.
- **`/gs-superadmin:email-report`** — read-only Journey Orchestrator reports: which emails
  mention a phrase, a program's full email inventory, a schedule audit of everything
  active, or object/field usage in participant sources. Also answers natural questions
  like "which emails mention the renewal reminder?".
- **`/gs-superadmin:deps-report`** — tenant-wide impact analysis: every documented asset
  (rules, journeys, reports, connector jobs, data designers, scorecards) that depends on
  a given object, field, or external connection. Also triggered by questions like "what
  breaks if I change this field?".
- **`/gs-superadmin:report-bug`** — capture a `gs-admin` CLI misbehavior as a vendor-ready
  bug report while the evidence is still in the session; never sent or committed anywhere
  by the skill.
- **Note on invoking skills**: most of these run **only** via their exact slash command —
  see the [skill catalog in the plugin README](plugins/gs-superadmin/README.md#skills-at-a-glance)
  for which ones also respond to natural language.
- **Safety model** — read-only by default. Every mutating `gs-admin` command (and MCP tool)
  triggers an approval prompt naming the command and the target tenant; unknown commands
  prompt too (fail-closed). Approved CLI mutations are journaled to
  `<slug>/changes/JOURNAL.md` (timestamp, operator, command, system area, source ticket)
  for a grep-able change history. Asset names containing `|` are caught by a shell-safety
  lint so they're never mangled into shell pipelines.

### 5. Two instances (Sandbox + Production)

Install once, then run `gs-admin login --base-url <url>` + `/gs-superadmin:setup` once per
instance — each tenant gets its own KB folder in the same working directory, and setup
records which one is production so write-approval prompts flag it. Switching, per-tenant
tokens, and the Journey-cache caveat are covered in the
[plugin README](plugins/gs-superadmin/README.md#two-instances-sandbox--production).

Full details — folder layout, the mutation guard, regeneration after CLI upgrades — in the
[plugin README](plugins/gs-superadmin/README.md).

## View the wiki

It's a single self-contained file — **no server required**. Just open it in any browser:

```
wiki/index.html        # double-click, or open via file:// in your browser
```

Everything (the catalog, docs, CSS, and JS) is inlined, so it runs entirely offline from
the local file with no network and nothing to install or run.

## Regenerate

Two different intents — don't mix them up:

**Rebuild at the pinned version** (verify your changes; what CI does). Install the exact
version the repo documents — it's recorded in `data/catalog.json` under `meta.cliVersion`:

```bash
npm i -g @gainsight/gs-admin-cli@"$(node -p "require('./data/catalog.json').meta.cliVersion")"
npm run build          # should reproduce the committed output byte-for-byte
```

**Deliberately upgrade what the repo documents** (a real change, not a rebuild):

```bash
npm i -g @gainsight/gs-admin-cli@latest
npm run build          # extract-catalog → build-reference → build-wiki →
                       # build-comparison-html → build-plugin-gs-superadmin → emit-reader-shapes
```

Expect large diffs across `data/`, `reference/domains/`, `wiki/`, and the plugin bundle —
that's the point. Then update the version/counts cited in hand-written docs;
`node build/check-stale-facts.mjs` (run by CI on every PR) lists every spot that needs it.

Steps can be run individually: `npm run build:catalog`, `build:reference`, `build:wiki`,
`build:comparison`, `build:plugin:gs-superadmin`, `build:reader-shapes` (the last needs no
CLI: it measures which payload keys the plugin's knowledge-base readers dereference, into
`data/reader-shapes.json`, the read-surface contract the gs-fortress CLI audit consumes).

The extractor locates the installed CLI via `npm root -g` (works out of the box when
`gs-admin` is installed globally). If it lives somewhere non-standard, override the path with
either the `GS_ADMIN_PKG` env var (bash: `export GS_ADMIN_PKG=/path/to/package`;
PowerShell: `$env:GS_ADMIN_PKG = 'C:\path\to\package'`) or a local
`gs-admin-explorer.config.json` (copy
`gs-admin-explorer.config.example.json` — it's git-ignored, so it stays on your machine).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). If you develop with an AI assistant (most
contributors do), load [AGENTS.md](AGENTS.md) into its context first — it's the terse
rules-of-record: which files are generated, the design tenets that look like bugs, and
the verification commands. Security issues (e.g. a guard-hook bypass) go through
[SECURITY.md](SECURITY.md) — privately, not as public issues.

Pull requests target `dev`, never `main`. From a fork, start from
[this compare link](https://github.com/BradleyDB/gs-admin-cli-docs/compare/dev...?quick_pull=1) — it
pre-selects `dev` as the base branch, which GitHub's own "Contribute" button does not.

Bug reports, documentation corrections, and feature asks each have their own issue form
under **New issue**; the doc form asks for your CLI version, because the reference here is
generated from one pinned version and a mismatch is often a version difference. Everyone
taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Requirements

- **Node.js ≥ 18** (developed against v24).
- **`@gainsight/gs-admin-cli` installed globally** (`npm i -g @gainsight/gs-admin-cli`) —
  this project reads its bundled manifests to generate the docs. It does **not** call the
  Gainsight API, so no login/tenant is needed just to build the wiki.

## How it works

The CLI is *artifact-driven*: its commands and MCP tools are declared in 8 JSON manifests
inside the installed package. `build/extract-catalog.mjs` parses those (plus the 12 Lane-2
runtime verbs and 6 static auth commands) into `data/catalog.json`; `build-reference.mjs`
and `build-wiki.mjs` render the markdown and the HTML, `build-comparison-html.mjs`
renders the standalone comparison guide, `build-plugin-gs-superadmin.mjs` writes the
plugin's bundled reference, and `emit-reader-shapes.mjs` records which payload keys the
plugin's readers dereference (`data/reader-shapes.json`). See `reference/architecture.md`.
