# Lane 2 — the runtime asset-lifecycle engine

Lane 1 actions are direct ("create a program", "add an action"). **Lane 2** wraps
asset creation in a **stateful, resumable pipeline** so that complex, multi-step builds
are safe to validate, preview, execute, and recover. It lives in
`<pkg>/dist/core/runtime/**` and is exposed primarily as **MCP tools** (`runtime_*`);
the CLI equivalents (`runtime:*`) exist but are hidden from `--help`.

## The state machine

```
describe-asset-type ─► select-template ─► create-draft ─► validate-draft ─► plan-run ─► apply-run ─► get-run-status
                                              │                                            │
                                              └──────────── (edit inputs) ◄────────────────┤
                                                                          resume-run ◄─────┘ (on block/failure)
```

A **run** is identified by a `runId` from `create-draft` and persisted locally
(`run-store.js`), so you can validate/plan/apply/resume across separate calls. Results
come back as a `RuntimeEnvelope` (`{ ok, status, … }`); `ok:false` signals failure.

## The 12 verbs

| Verb (`runtime …` / `runtime_*`) | Purpose | Mutates? |
|---|---|:--:|
| `describe-asset-type` | Capabilities + supported verbs for an asset type | |
| `describe-asset-schema` | Input schema to create/manage an asset (read-only providers proxy via `--action-key`) | |
| `select-template` | Pick the best template for a new asset (optional `--hints`) | |
| `create-draft` | Initialize local run state; returns `runId` (no API call) | ✓ (local) |
| `validate-draft` | Check a draft's inputs; returns errors or `draft_valid` | |
| `plan-run` | Show the ordered execution plan | |
| `apply-run` | Execute — create the asset; persists after each step; `--idempotency-key` | ✓ |
| `resume-run` | Continue a blocked/failed run from where it stopped | ✓ |
| `get-run-status` | Completed/pending steps and blockers | |
| `list-runs` | All stored runs (filter by `--asset-type` / `--status`) | |
| `clone-asset` | Copy an asset across environments — **not yet implemented** for any provider | ✓ |
| `export-support-bundle` | Run state + trace + created IDs (no secrets) for debugging | |

## Asset types & providers

Registered in `dist/commands/index.js` via `AssetRegistry`:

| Asset type | Provider | Capability |
|---|---|---|
| `JO` | `JoProvider` | **full** create/apply lifecycle (Journey Orchestrator programs) |
| `CONNECTORS` | `ReadOnlyProvider` | describe/read only |
| `DATA_MANAGEMENT` | `ReadOnlyProvider` | describe/read only |
| `RULES_ENGINE` | `ReadOnlyProvider` | describe/read only |
| `SCORECARD` | `ReadOnlyProvider` | describe/read only |

Read-only providers still answer `describe-asset-type` / `describe-asset-schema`
(proxying to the matching Lane-1 artifact action via `--action-key`), but they don't
create assets — use the Lane-1 commands for those domains directly.

## When to use Lane 2 vs Lane 1

- **Lane 1** for everything you can express as a single action (the 8 domains). Fast,
  simple, scriptable.
- **Lane 2** when an asset build benefits from **validate-before-apply**, **idempotent
  retries**, **resume after failure**, or a **support bundle** — today that's
  primarily **JO program** creation. Think of it as a guard-railed wrapper around the
  same handlers.

See [architecture.md](architecture.md) for how the lanes share the core, and the
[Build a JO program workflow](workflows/02-build-jo-program.md) for the Lane-1 path.
