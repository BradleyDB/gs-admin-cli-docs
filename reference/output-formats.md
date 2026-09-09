# Global flags & output formats

## Global flags (go BEFORE the subcommand)

```bash
gs-admin --json jo p list
gs-admin --format table dm objects list
```

| Flag | Purpose |
|---|---|
| `--base-url <url>` | Override `GS_BASE_URL` / the saved tenant URL |
| `--format <fmt>` | One of `table` · `json` · `detail` · `compact` · `ids` · `status` |
| `--json` | Shortcut for `--format json` (wins if both are set) |
| `--fields <a,b,c>` | Select output columns (matched against the action's `fieldsCatalog`) |
| `--debug` | Framework debug output |
| `--skip-version-check` | Skip the CLI/server version compatibility check |

These are defined on `BaseCommand` (`dist/commands/base.js`) and apply to every command.

## Output formats

Each action declares a **default format** in its manifest (`format.default`); you can
override per call with `--format`. Rendering is done by
`dist/core/artifact/formatters.js`.

| Format | What you get | Typical use |
|---|---|---|
| `table` | Columnar rows (selected by the action's `table` spec) | lists |
| `detail` | Labeled field view of one record, optional sub-tables | describe |
| `json` | Raw JSON payload | scripting / piping |
| `compact` | Condensed one-liners | quick scans |
| `ids` | Just the IDs at a configured JSONPath | piping IDs into the next command |
| `status` | A templated status line | publish/run progress |
| `query` | Query-result table (Query API shape) | `q execute` |

In **MCP mode**, output is always JSON text content regardless of the default format.

## `--fields` and `fieldsCatalog`

Many list/detail actions define a `fieldsCatalog` — a friendly-named set of selectable
columns. `--fields name,arr,status` picks those columns; when an action has no catalog,
`--fields` falls back to matching column headers/labels. The available field names for a
given command appear in its flags/spec — check the per-command page in
[domains/index.md](domains/index.md).

## Examples

```bash
# Pick specific columns as a table
gs-admin --fields Name,Arr,Status dm objects list

# Get raw JSON for scripting
gs-admin --json q execute --object Company --select Name,Arr --limit 100

# Just the IDs (when the action supports the `ids` format)
gs-admin --format ids re r list
```

See [architecture.md](architecture.md) for where formatting sits in the request path.
