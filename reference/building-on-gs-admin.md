# Building on `gs-admin` — skills, agents, and a plugin

This is the composition layer: how `gs-admin` capabilities become reusable building
blocks that let Claude Code help you **operate Gainsight**. One such bundle already
ships from this repo — the **gs-superadmin plugin** — so read this as both a map for
building your own and a record of the choices that one made. Where they differ,
`plugins/gs-superadmin/README.md` and its `MAINTAINERS.md` are authoritative for what
that plugin actually does.

Everything below should be grounded in the generated catalog and reference:
`data/catalog.json`, [domains/index.md](domains/index.md), and the concept docs in this
folder. Treat those as the source of truth for exact command/tool names and flags.

## The three building blocks

### 1. Skills (procedural know-how)

A **skill** is a `SKILL.md` that teaches Claude *how* to accomplish a task with
`gs-admin` — the ordered steps, the flags that matter, the gotchas. Good first skills map
directly to the [workflows](workflows/) already written here:

- **build-jo-program** — wrap [workflows/02-build-jo-program.md](workflows/02-build-jo-program.md)
  (create → source → nodes → connect → validate → publish, honoring the local-cache/save model).
- **author-rule** — wrap [workflows/03-author-rule-with-cta.md](workflows/03-author-rule-with-cta.md).
- **report-builder** — encode the `report` domain's spec-notes (the date-literal/operator
  pairing, picklist-IDs-not-labels, server-populated fields) so report payloads are correct.
- **query-explorer** — quick `dm objects describe` → `q execute` loops.

Skills should reference whether to use the **CLI** (`gs-admin …`) or the **MCP tool**
(`journey_*`) depending on how the user runs Claude.

### 2. Agents (specialized operators)

A **subagent** is a focused persona with a tailored system prompt + tool scope. Natural
splits follow the domains:

- **JO Program Builder** — owns the journey lifecycle and the Lane-2 runtime
  (`runtime_*`) for validate-before-apply safety.
- **Rules Author** — rules-engine create/criteria/actions/schedule + debug.
- **Data/Report Analyst** — `query`, `report`, `data-management` describe/list.

Give each agent only the relevant MCP tools (or CLI permissions) and point its prompt at
the matching `reference/domains/<domain>.md`.

### 3. A plugin (the bundle)

A Claude Code **plugin** packages it all so a teammate installs one thing. The pieces
available to you:

- **`.claude-plugin/plugin.json`**, optionally declaring an `mcpServers` entry for
  `gs-admin` (the template lives in [mcp.md](mcp.md)),
- the **skills** above under `skills/`,
- **agents** under `agents/`,
- optionally **slash commands** (e.g. `/jo-build`, `/rule-new`) under `commands/`,
- **hooks** under `hooks/` — the safety lane: a `PreToolUse` hook sees a command before
  it runs and can prompt for approval.

**What gs-superadmin chose**, as one worked example: skills + hooks + templates +
zero-dependency scripts, and *no* `mcpServers` entry and no agents. It runs the CLI
through Bash rather than declaring the MCP server, because the safety story is a
`PreToolUse` guard that parses each `gs-admin` command against the catalog's `mutating`
flag and asks for approval; for teams that do wire the MCP server themselves, setup
merges the mutating tool names into `permissions.ask` instead. Bulk work goes through
sanctioned scripts so list payloads never enter model context. None of that is the only
valid shape — but if you are about to bundle skills that mutate a tenant, decide the
safety lane before the packaging.

## Recommended sequence

1. **Wire the MCP server** into *your* project (`.mcp.json`) and confirm `/mcp` lists
   `gs-admin` — now Claude can actually call the 182 MCP tools. (Needs a tenant login.)
   This repo deliberately does not wire it: everything here is generated from the
   installed package's manifests on disk, so no live connection is needed to build or
   verify anything.
2. **Author 1–2 skills** from the workflows and test them against a sandbox tenant.
3. **Add a domain agent** that uses those skills.
4. **Bundle** into a plugin once the pieces are proven.

## Keeping knowledge fresh

When the CLI is upgraded (`npm i -g @gainsight/gs-admin-cli@latest`), re-run
`npm run build` here to regenerate `data/catalog.json`, the domain references, the wiki,
and the plugin's bundled reference. Skills/agents that cite tool names stay correct
because they point back at the regenerated catalog.

A packaged plugin has a second freshness problem this repo's rebuild cannot solve: the
user's installed CLI may be newer than the snapshot you shipped. gs-superadmin's answer
is to generate the workspace's catalog from the *user's* installed CLI on every setup
run, and render its cheatsheet from that catalog, keeping the bundled copies only as a
fallback — so the guard's view of what mutates tracks the CLI in front of it rather than
your release cadence. Worth copying if your bundle also makes safety decisions from
catalog data.
