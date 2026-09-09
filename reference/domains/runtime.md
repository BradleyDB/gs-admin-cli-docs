<!-- GENERATED FILE — do not edit by hand. Regenerate with: npm run build:reference (build/build-reference.mjs). -->

# Lane 2 Runtime (`runtime`)

Lane 2 — a stateful asset-lifecycle engine (create-draft → validate → plan → apply → resume) with run persistence, idempotency, support bundles, and cross-environment cloning. CLI commands are hidden (runtime:*); primarily consumed as MCP tools.

**12 commands.** _Lane 2 runtime — CLI-hidden, MCP-facing._

| Command | Summary | MCP tool |
|---------|---------|----------|
| [`gs-admin runtime apply-run`](#gs-admin-runtime-apply-run) | Execute the run — create the asset in Gainsight by running all pipeline steps. Persists progress after each step for resume capability. | `runtime_apply_run` |
| [`gs-admin runtime clone-asset`](#gs-admin-runtime-clone-asset) | Clone an asset from one environment to another. (Currently not implemented for any provider.) | `runtime_clone_asset` |
| [`gs-admin runtime create-draft`](#gs-admin-runtime-create-draft) | Create a draft run for a new asset. Returns a runId that subsequent verbs reference. Does not call the Gainsight API — just initializes local run state. | `runtime_create_draft` |
| [`gs-admin runtime describe-asset-schema`](#gs-admin-runtime-describe-asset-schema) | Describe the input schema for creating/managing an asset. For read-only providers, pass --action-key to proxy to an artifact action. | `runtime_describe_asset_schema` |
| [`gs-admin runtime describe-asset-type`](#gs-admin-runtime-describe-asset-type) | Describe a Gainsight asset type's capabilities and supported Lane 2 verbs. | `runtime_describe_asset_type` |
| [`gs-admin runtime export-support-bundle`](#gs-admin-runtime-export-support-bundle) | Export a support bundle for a run — includes run state, trace, and created IDs (no secrets). | `runtime_export_support_bundle` |
| [`gs-admin runtime get-run-status`](#gs-admin-runtime-get-run-status) | Get the current status of a run — completed steps, pending steps, blockers. | `runtime_get_run_status` |
| [`gs-admin runtime list-runs`](#gs-admin-runtime-list-runs) | List all stored runs, optionally filtered by asset type or status. | `runtime_list_runs` |
| [`gs-admin runtime plan-run`](#gs-admin-runtime-plan-run) | Show the execution plan for a run — what steps will be executed and in what order. | `runtime_plan_run` |
| [`gs-admin runtime resume-run`](#gs-admin-runtime-resume-run) | Resume a blocked/failed run from where it left off. | `runtime_resume_run` |
| [`gs-admin runtime select-template`](#gs-admin-runtime-select-template) | Select the best template for creating a new asset of the given type. | `runtime_select_template` |
| [`gs-admin runtime validate-draft`](#gs-admin-runtime-validate-draft) | Validate a draft run's inputs. Returns validation errors or draft_valid status. | `runtime_validate_draft` |

---

### `gs-admin runtime apply-run`

Execute the run — create the asset in Gainsight by running all pipeline steps. Persists progress after each step for resume capability.

**MCP tool:** `runtime_apply_run` · **Mutating:** yes ⚠️ · **Output:** `json` · **CLI:** _hidden_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--run-id` | `string` | ✓ | — | Run ID |
| `--idempotency-key` | `string` |  | — | Idempotency key for safe retries |

**Examples**

```bash
gs-admin runtime apply-run --run-id <run-id>
```

### `gs-admin runtime clone-asset`

Clone an asset from one environment to another. (Currently not implemented for any provider.)

**MCP tool:** `runtime_clone_asset` · **Mutating:** yes ⚠️ · **Output:** `json` · **CLI:** _hidden_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--asset-type` | `string` | ✓ | — | Asset type |
| `--source-id` | `string` | ✓ | — | Source asset ID |
| `--target-base-url` | `string` |  | — | Target environment base URL |

**Examples**

```bash
gs-admin runtime clone-asset --asset-type <asset-type> --source-id <source-id>
```

### `gs-admin runtime create-draft`

Create a draft run for a new asset. Returns a runId that subsequent verbs reference. Does not call the Gainsight API — just initializes local run state.

**MCP tool:** `runtime_create_draft` · **Mutating:** yes ⚠️ · **Output:** `json` · **CLI:** _hidden_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--asset-type` | `string` | ✓ | — | Asset type (e.g. JO) |
| `--category` | `string` |  | — | Category (e.g. DynamicProgram) |
| `--template` | `string` |  | — | Template (e.g. csv-email) |
| `--inputs` | `string` |  | — | JSON string or @file path with draft inputs |

**Examples**

```bash
gs-admin runtime create-draft --asset-type <asset-type>
```

### `gs-admin runtime describe-asset-schema`

Describe the input schema for creating/managing an asset. For read-only providers, pass --action-key to proxy to an artifact action.

**MCP tool:** `runtime_describe_asset_schema` · **Mutating:** no · **Output:** `json` · **CLI:** _hidden_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--asset-type` | `string` | ✓ | — | Asset type |
| `--category` | `string` |  | — | Category (e.g. DynamicProgram) |
| `--template` | `string` |  | — | Template (e.g. csv-email) |
| `--action-key` | `string` |  | — | Artifact action key (read-only providers) |

**Examples**

```bash
gs-admin runtime describe-asset-schema --asset-type <asset-type>
```

### `gs-admin runtime describe-asset-type`

Describe a Gainsight asset type's capabilities and supported Lane 2 verbs.

**MCP tool:** `runtime_describe_asset_type` · **Mutating:** no · **Output:** `json` · **CLI:** _hidden_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--asset-type` | `string` | ✓ | — | Asset type: JO, CONNECTORS, DATA_MANAGEMENT, RULES_ENGINE, SCORECARD |

**Examples**

```bash
gs-admin runtime describe-asset-type --asset-type <asset-type>
```

### `gs-admin runtime export-support-bundle`

Export a support bundle for a run — includes run state, trace, and created IDs (no secrets).

**MCP tool:** `runtime_export_support_bundle` · **Mutating:** no · **Output:** `json` · **CLI:** _hidden_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--run-id` | `string` | ✓ | — | Run ID |
| `--out` | `string` |  | — | Output path (default: stdout as JSON) |

**Examples**

```bash
gs-admin runtime export-support-bundle --run-id <run-id>
```

### `gs-admin runtime get-run-status`

Get the current status of a run — completed steps, pending steps, blockers.

**MCP tool:** `runtime_get_run_status` · **Mutating:** no · **Output:** `json` · **CLI:** _hidden_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--run-id` | `string` | ✓ | — | Run ID |

**Examples**

```bash
gs-admin runtime get-run-status --run-id <run-id>
```

### `gs-admin runtime list-runs`

List all stored runs, optionally filtered by asset type or status.

**MCP tool:** `runtime_list_runs` · **Mutating:** no · **Output:** `json` · **CLI:** _hidden_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--asset-type` | `string` |  | — | Filter by asset type |
| `--status` | `string` |  | — | Filter by status |

**Examples**

```bash
gs-admin runtime list-runs
```

### `gs-admin runtime plan-run`

Show the execution plan for a run — what steps will be executed and in what order.

**MCP tool:** `runtime_plan_run` · **Mutating:** no · **Output:** `json` · **CLI:** _hidden_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--run-id` | `string` | ✓ | — | Run ID |

**Examples**

```bash
gs-admin runtime plan-run --run-id <run-id>
```

### `gs-admin runtime resume-run`

Resume a blocked/failed run from where it left off.

**MCP tool:** `runtime_resume_run` · **Mutating:** yes ⚠️ · **Output:** `json` · **CLI:** _hidden_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--run-id` | `string` | ✓ | — | Run ID of a resumable run |

**Examples**

```bash
gs-admin runtime resume-run --run-id <run-id>
```

### `gs-admin runtime select-template`

Select the best template for creating a new asset of the given type.

**MCP tool:** `runtime_select_template` · **Mutating:** no · **Output:** `json` · **CLI:** _hidden_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--asset-type` | `string` | ✓ | — | Asset type |
| `--category` | `string` |  | — | Category |
| `--hints` | `string` |  | — | Free-text hints about what you're building |

**Examples**

```bash
gs-admin runtime select-template --asset-type <asset-type>
```

### `gs-admin runtime validate-draft`

Validate a draft run's inputs. Returns validation errors or draft_valid status.

**MCP tool:** `runtime_validate_draft` · **Mutating:** no · **Output:** `json` · **CLI:** _hidden_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--run-id` | `string` | ✓ | — | Run ID from create-draft |

**Examples**

```bash
gs-admin runtime validate-draft --run-id <run-id>
```

