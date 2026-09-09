# MCP server — drive `gs-admin` from any AI assistant

The same binary that runs as a CLI also **is** an MCP (Model Context Protocol) server.
When launched over stdio it serves tools instead of parsing argv — no separate install.

## Tool inventory

- **182 MCP tools** on this install: 170 artifact tools (every Lane-1 action) +
  12 `runtime_*` Lane-2 tools. (Count of record: `data/catalog.json`
  `meta.counts.mcpTools`; since 1.0.8 the package README carries the same figure,
  generated from the manifests at build time.)
- **Naming:** `<namespace>_<actionKey>` with dashes → underscores
  (e.g. `journey_create_program`, `data_management_list_objects`,
  `rules_engine_add_action_cta`). Lane-2 tools are `runtime_<verb>`.
- Every artifact action is exposed (none are `mcp.hidden` in v1.0.9); the static
  `login`/`config`/etc. commands are **CLI-only** (not MCP tools).

The full tool list with input schemas is in [domains/index.md](domains/index.md) — the
`MCP tool` column of each domain file is the exact tool name.

## Pre-flight

Authenticate once per machine (the server has no interactive login):

```bash
gs-admin login          # or: gs-admin --base-url https://… login
```

Verify the server boots (it should hang silently on stdin; `Ctrl+C` to stop):

```bash
GS_BASE_URL=https://your-company.gainsightcloud.com gs-admin --mcp
```

The inline `VAR=value command` prefix is bash-only syntax. In PowerShell, set the
variable first: `$env:GS_BASE_URL = 'https://your-company.gainsightcloud.com'`, then
run `gs-admin --mcp`.

## Host setup

### Claude Code

Add to `.mcp.json` in a project root (or `~/.claude.json` for user-global). After a
global install you can use the `gs-admin` command directly:

```json
{
  "mcpServers": {
    "gs-admin": {
      "command": "gs-admin",
      "env": { "GS_BASE_URL": "https://your-company.gainsightcloud.com" }
    }
  }
}
```

Restart Claude Code and run `/mcp` to confirm `gs-admin` appears.

> Deliberately not wired up in this repo (there is no `.mcp.json`): everything here is
> generated from the installed package's manifests on disk, so no live MCP connection is
> needed to build or verify anything. Wiring it is an open option, not a missing step —
> don't add it as a drive-by fix. The block above is the template for *your* project (see
> [building-on-gs-admin.md](building-on-gs-admin.md)).

### Claude Desktop

Edit `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/`;
Windows: `%APPDATA%\Claude\`; Linux: `~/.config/Claude/`), same `mcpServers` shape,
then relaunch.

### Cursor / Windsurf / Zed

Paste the same `mcpServers` entry into each app's MCP settings.

## CLI vs MCP — same logic, two surfaces

| | CLI | MCP |
|---|---|---|
| Invocation | `gs-admin jo p list --json` | tool `journey_list_programs` |
| Output | formatted (table/detail/…) or JSON | always JSON text content |
| Version mismatch | **blocks** | warns, continues |
| Auth | shared `~/.gs-admin` + keychain | shared `~/.gs-admin` + keychain |

Because they share handlers, anything you can do in the CLI you can do as a tool call,
and vice-versa. See [architecture.md](architecture.md).
