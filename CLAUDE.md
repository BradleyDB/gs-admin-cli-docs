# CLAUDE.md — gs-admin Explorer

This repo is a **knowledge base + interactive wiki** for the `@gainsight/gs-admin-cli`
npm package (the **Gainsight Admin CLI & MCP server**, invoked as `gs-admin`). Its purpose
is to (1) let a human explore every capability in a local HTML wiki, and (2) give you,
Claude, durable, accurate context for building skills/agents/a plugin on top of the CLI.

**Modifying this repo (not just using it)?** Read [AGENTS.md](AGENTS.md) first — the
rules of record for contributions (generated-vs-hand-maintained table, design tenets,
skill-writing rules, testing). Narrative version: [CONTRIBUTING.md](CONTRIBUTING.md).

## What `gs-admin` is (the one thing to internalize)

It is **artifact-driven**: the entire domain command surface is declared as data in **8 JSON
manifests** at `<global-npm>/@gainsight/gs-admin-cli/dist/artifacts/*.json`. Two generators
turn each manifest *action* into **both** a CLI command (`gs-admin <ns> <group…> <name>`)
and an MCP tool (`<namespace>_<actionKey>`, dashes→underscores). One action = one CLI
command + one MCP tool, same handler. So the manifests are the single source of truth, and
this repo parses them into `data/catalog.json`.

- Domains (8): `journey`/`jo`, `rules-engine`/`re`, `data-management`/`dm`,
  `data-designer`/`dd`, `connectors`/`cn`, `scorecard`/`sc`, `report`/`rp`, `query`/`q`.
- Two lanes: **Lane 1** = direct artifact actions (the 8 domains). **Lane 2** = a hidden
  `runtime:*` state machine (`create-draft → validate → plan → apply → resume`) exposed as
  `runtime_*` MCP tools; JO is the only full-lifecycle provider.
- Auth: OAuth 2.1 PKCE + auto-enrollment; tokens in OS keychain → encrypted file →
  plaintext; config at `~/.gs-admin/config.json`.
- Counts at the pinned version (v1.0.9): **188 CLI commands / 182 MCP tools / 10 domains**
  (170 artifact + 12 runtime + 6 static). Trust `data/catalog.json` (`meta.counts`) as
  the count of record. (Since 1.0.8 the package README agrees — it says 182, generated
  from the manifests at build time.)

## Where knowledge lives (read these, don't re-derive)

| Need | Path |
|---|---|
| Complete structured catalog (every command/flag/tool/endpoint) | `data/catalog.json` |
| Which payload keys the plugin's KB readers READ, per CLI command (the read surface — measured, generated; what the gs-fortress CLI audit walks) | `data/reader-shapes.json` |
| Per-domain command reference (grep-able markdown) | `reference/domains/*.md` (+ `index.md`) |
| Architecture, auth, MCP, Lane 2, output formats | `reference/architecture.md`, `auth.md`, `mcp.md`, `lane2-runtime.md`, `output-formats.md` |
| End-to-end task walkthroughs | `reference/workflows/*.md` |
| How to build skills/agents/a plugin on this | `reference/building-on-gs-admin.md` |
| Choosing gs-admin CLI+plugin vs M2M OAuth for AI/automation access | `reference/comparison-guide.md` |
| Human-facing interactive wiki | `wiki/index.html` (self-contained; open via `file://`) |

When you need a command's exact flags/tool-name/endpoint, prefer `data/catalog.json` or the
matching `reference/domains/<domain>.md` over guessing or scraping `--help`.

## Regenerating

Zero dependencies — Node built-ins only, **no `npm install`** to build or test. (The one
carve-out: `npm ci` installs two checker-only devDependencies, `typescript` +
`@types/node`, for `npm run typecheck` — the JSDoc-contract gate CI runs; nothing at
runtime needs them. AGENTS.md tenet 5.) Two distinct intents:

```bash
# Rebuild at the pinned version (verification; must reproduce committed output):
npm i -g @gainsight/gs-admin-cli@"$(node -p "require('./data/catalog.json').meta.cliVersion")"
npm run build   # extract-catalog → build-reference → build-wiki → build-comparison-html → build-plugin-gs-superadmin → emit-reader-shapes

# Deliberate upgrade of what the repo documents (expect large diffs everywhere):
npm i -g @gainsight/gs-admin-cli@latest
npm run build   # then: node build/check-stale-facts.mjs lists hand-written counts/versions to update
```

**Never install `@latest` just to rebuild** — that upgrades the documented CLI and dirties
the whole catalog/wiki/plugin. Use the pinned version from `data/catalog.json` `meta.cliVersion`.

`build/extract-catalog.mjs` resolves the package via `npm root -g` (override with the
`GS_ADMIN_PKG` env var or a git-ignored `gs-admin-explorer.config.json` — see
`gs-admin-explorer.config.example.json`). Individual steps:
`npm run build:catalog | build:reference | build:wiki | build:comparison | build:plugin:gs-superadmin | build:reader-shapes`
(the last one needs no CLI — it measures the plugin's KB readers over the committed catalog into
`data/reader-shapes.json`).
View the wiki: open `wiki/index.html` in a browser — it's self-contained (runs from `file://`, no server).

## Conventions worth remembering

- **Mutating** commands are flagged in the catalog/wiki; treat them as side-effectful.
- **Journey local cache**: mutating `jo` commands buffer locally; persist with `jo p save`
  or `jo p publish`. Don't assume a JO change hit the backend until saved.
- **Global flags go before the subcommand**: `gs-admin --json jo p list`.
- **The CLI's MCP server is deliberately not wired into this repo** (no `.mcp.json`).
  Everything here reads the installed package's manifests from disk, so no live MCP
  connection is needed to build or verify anything. Wiring it is an open option, not a
  missing step — don't add it as a drive-by fix.
- The **gs-superadmin plugin** (`plugins/gs-superadmin/`) shipped and is maintained here:
  a Claude Code plugin that bootstraps per-tenant Gainsight workspaces, with a PreToolUse
  mutation guard (asks, never blocks) and a pipe-safety lint. See its README and
  `reference/building-on-gs-admin.md`.

## Repo map

```
build/        lib.mjs — the lane's shared module (ROOT + BOM-tolerant readJsonFile +
              the T-9 markdown grammar both generators consume — the ONE block parser
              and the inline core, T-9 v4; which files are
              HELD import-free or builtins-only, and why, is declared as data in
              check-imports.mjs's RESTRICTED table — never listed here, and note that
              a file importing no lib.mjs is not thereby restricted) ·
              generators: extract-catalog.mjs · build-reference.mjs · build-wiki.mjs ·
              build-comparison-html.mjs · build-plugin-gs-superadmin.mjs (+ the shared
              render-cheatsheet.mjs emitter) · emit-reader-shapes.mjs (the plugin's
              measured read surface, from the tracer in the plugin's test/) · wiki-assets/
              guards + fixtures: check-{stale-facts,doc-drift,instance-data}.mjs ·
              defect-classes.mjs (the registry as data, W10) ·
              test-{wiki,comparison}-html.mjs · test-render-cheatsheet.mjs ·
              test-emit-reader-shapes.mjs ·
              instruments (a recipe runs them; never gates): sweep-twins.mjs ·
              sweep-fence-grammar.mjs
data/         catalog.json + reader-shapes.json (both generated)
reference/    concept docs + domains/ (generated) + workflows/
wiki/         index.html (generated, self-contained — ~500 KB; don't read it whole)
              + comparison-guide.html (generated from reference/comparison-guide.md)
plugins/      gs-superadmin/ — skills/hooks/templates/scripts/test are hand-maintained;
              reference/ and scripts/{extract-catalog,render-cheatsheet}.mjs are
              generated (CI-enforced)
test/         rig.mjs — the shared test rig (temp-dir + spawnSync plumbing ONLY,
              GP-B5 DS-22); rig-only by check — suites live in the two test homes above
dev/          dev-branch-only workflow state (feedback bus, deferred validations) —
              stripped at release, never on main
```

The generated-file table, tests, and contributor rules live in [AGENTS.md](AGENTS.md).

## Branching, releases, and the feedback bus

This repo develops on **`dev`** and releases to `main`. The contributor-facing narrative
is in [CONTRIBUTING.md](CONTRIBUTING.md) ("Submitting changes"); what a session working
in this repo must not get wrong:

- **Branch off `dev`, PR to `dev`.** Never push or PR `main` directly. Some clones also
  carry a local pre-push hook that rejects it outright.
- **`main` is reached only through a short-lived `release/vX.Y.Z` branch** cut from `dev`,
  on which dev-branch-only content is stripped first — the `dev/` directory and the
  `dev-canary` provenance skill. Never merge `main` back into `dev`. **Review and the
  version bump (with its CHANGELOG entry) happen on `dev` before that branch is cut** —
  never on the release branch. Do not improvise a release from this file: the bullets
  here are invariants, not a runbook, and the rest of the ceremony lives in the
  maintainer's release procedure. If you are contributing a change, open a PR to `dev`
  and stop there.
- **Cross-session feedback bus:** `dev/FEEDBACK.md` — findings move OPEN → FIXED →
  VERIFIED | WONTFIX. Checks that need a live tenant are banked in `dev/VALIDATION.md`.
  Both live only on `dev` and never ship to users; treat everything written there as
  public-safe (no tenant, org, or ticket specifics).
- **To exercise the working tree in a live Claude Code session:** start it with
  `claude --plugin-dir <path-to-this-repo>/plugins/gs-superadmin`, then `/reload-plugins`
  after each edit. A session testing the plugin this way reports findings to the bus
  rather than editing the branch under itself.
- **`version` lives only in `plugin.json`** — never add one to `marketplace.json`. Bump it
  on any user-visible plugin change (plus a CHANGELOG entry); documentation-only changes
  need neither.

The maintainer drives this loop with a personal Claude Code skill that automates the
ceremony (you'll see `/dev-loop` referenced in `dev/` files). You don't need it to
contribute: for landing a change on `dev`, the rules above plus CONTRIBUTING.md are the
whole contract. Releases are the exception — they follow that procedure, not this file.
