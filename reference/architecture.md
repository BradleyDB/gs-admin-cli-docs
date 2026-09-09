# Architecture — how `gs-admin` is built

`@gainsight/gs-admin-cli` is **one binary with two front-ends** (a CLI and an MCP
server) over a single shared core. Understanding its shape makes every capability
predictable and makes it easy to build skills/agents/plugins on top.

```
                ┌──────────────────────────────────────────┐
                │              bin/gs-admin.js               │
                │  stdio? → MCP server   else → oclif CLI     │
                └───────────────┬───────────────┬────────────┘
                                │               │
        interfaces/cli.js ◄─────┘               └─────► interfaces/mcp.js
                                │               │
                 ┌──────────────┴───────────────┴──────────────┐
                 │                  SHARED CORE                  │
                 │  auth · api-client · config · formatters ·    │
                 │  artifact loader/runner · runtime kernel      │
                 └───────────────────────────────────────────────┘
```

## The big idea: artifact-driven, not hand-written

The entire domain command surface is **declared as data**, not coded by hand. Eight
JSON **manifests** live at `<pkg>/dist/artifacts/*.json` (one per domain). Each
manifest lists **actions**; each action declares its summary, long description, CLI
shape (command name, aliases, nested groups), input schema (JSON-Schema + `x-cli`
flag hints), output formatting, REST endpoint(s), a handler name, and a `mutating`
flag.

Two generators turn each action into a front-end:

| Generator (`dist/core/artifact/…`) | Produces |
|---|---|
| `cli-generator.js` | an oclif `Command` class → `gs-admin <namespace> <group…> <name>` |
| `mcp-generator.js` | an MCP tool named `<namespace>_<actionKey>` (dashes → underscores) |

So **one action = one CLI command + one MCP tool**, both backed by the same handler.
This is why the CLI and MCP never drift, and why this repo can parse those 8 manifests
to regenerate a complete catalog (`data/catalog.json`) any time the CLI is upgraded.

- Manifest schema (authoritative field reference): `<pkg>/dist/core/artifact/artifact.meta.schema.json`
- Handlers (the actual logic): `<pkg>/dist/artifacts/handlers/**`
- Validators: `<pkg>/dist/artifacts/validators/**`

### Counts (this install, v1.0.9)

- **170 artifact commands** across 8 domains, **all** also exposed as MCP tools.
- **12 Lane 2 runtime** verbs (CLI-hidden; MCP tools `runtime_*`).
- **6 static** auth/config commands (`login`, `logout`, `config`, `whoami`, `tokens migrate`, `tokens backends`).
- **= 188 CLI commands / 182 MCP tools.** (Count of record: `data/catalog.json`. Since 1.0.8 the package README matches — its tool count is generated from the manifests at build time.)

**Upstream status.** 1.0.7 deleted the README's "Open Beta" section — the notice that
command flags, output shapes and MCP tool names may change between releases, and that
support was best-effort. Nothing replaced it: no GA statement, no compatibility policy,
and still no changelog. Read it as upstream having stopped warning rather than as a
stability contract; pinning a version and diffing each release stays the right posture.
(1.0.7 is otherwise a metadata-only release — its `dist/` is byte-identical to 1.0.6, so
the counts above are unchanged.)

## Two lanes

The product is organized into two cooperating layers ("lanes"):

- **Lane 1 — artifact actions.** Direct, single-purpose operations that map (roughly)
  to one API call: list/describe/create/update/add-action/etc. This is the bulk of the
  surface (the 8 domains). Each is independently callable from CLI or MCP.

- **Lane 2 — the runtime kernel** (`dist/core/runtime/**`). A *stateful* asset-lifecycle
  engine that composes Lane-1 work into a safe `create-draft → validate → plan → apply →
  resume` pipeline with run persistence, idempotency, support bundles, and (planned)
  cross-environment cloning. See [lane2-runtime.md](lane2-runtime.md).

## Request path (Lane 1)

1. oclif parses flags → `oclifProjectInput` maps them back to the action's input schema.
2. `trackedRunAction` (`dist/core/artifact/run-tracker.js`) runs the action's handler,
   recording mutating actions for Lane 2 run history.
3. The handler calls the Gainsight API via `api-client.js` against the action's
   `endpoint`/`endpoints` (URL templates with `{{param}}` substitution).
4. `formatters.js` renders the result using the action's `format` block (table/detail/…),
   honoring `--format`, `--json`, and `--fields`. See [output-formats.md](output-formats.md).

## Notable design details

- **Custom help** (`dist/core/help.js`) renders the topic tree you see in `gs-admin --help`.
- **Global flags** live on `BaseCommand` and go **before** the subcommand
  (`gs-admin --json jo p list`). See [output-formats.md](output-formats.md).
- **Journey local cache** (`dist/core/program-cache.js`): every mutating JO command
  buffers changes locally (~5 ms) instead of saving to the backend each call (~800 ms);
  the cache is flushed by `jo p save` or automatically by `jo p publish`. This is why a
  20-step program build is fast — and why you must `save`/`publish` to persist.
- **Version check** (`version-check.js`): the CLI **blocks** if it's older than the
  deployed Gainsight server; the MCP server **warns but continues**. Bypass with
  `--skip-version-check` or `GS_SKIP_VERSION_CHECK=1`.

## Where to look next

- Per-domain command detail → [domains/index.md](domains/index.md)
- Auth & token storage → [auth.md](auth.md)
- MCP server & host setup → [mcp.md](mcp.md)
- Output formats & global flags → [output-formats.md](output-formats.md)
- Building skills/agents/a plugin on top → [building-on-gs-admin.md](building-on-gs-admin.md)
