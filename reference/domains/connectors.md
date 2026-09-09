<!-- GENERATED FILE — do not edit by hand. Regenerate with: npm run build:reference (build/build-reference.mjs). -->

# Connectors (`connectors` / `cn`)

Connector operations — iPaaS connections, jobs, and field mappings

**7 commands.** 

| Command | Summary | MCP tool |
|---------|---------|----------|
| [`gs-admin connectors activity`](#gs-admin-connectors-activity) | List connector job execution activity | `connectors_list_activity` |
| [`gs-admin connectors audit`](#gs-admin-connectors-audit) | Audit connector configuration changes | `connectors_audit_connector` |
| [`gs-admin connectors chain`](#gs-admin-connectors-chain) | Describe a job execution chain set | `connectors_describe_job_chain` |
| [`gs-admin connectors chains`](#gs-admin-connectors-chains) | List job execution chain sets | `connectors_list_job_chains` |
| [`gs-admin connectors jobs`](#gs-admin-connectors-jobs) | List jobs for a connector | `connectors_list_connector_jobs` |
| [`gs-admin connectors list`](#gs-admin-connectors-list) | List all iPaaS connector connections | `connectors_list_connectors` |
| [`gs-admin connectors px`](#gs-admin-connectors-px) | List PX connector job activity | `connectors_list_px_activity` |

---

### `gs-admin connectors activity`
*Short form:* `gs-admin cn activity`

List connector job execution activity

List batch or real-time execution activity for connector jobs. Defaults to batch (executionActivities). Pass --realtime to switch to Salesforce real-time activity (realtimeExecutionActivities). Handler normalises both response shapes into the same columns.

**MCP tool:** `connectors_list_activity` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `POST /v1/api/connector/ipaas/executionActivities` _(batch)_, `POST /v1/api/connector/ipaas/realtimeExecutionActivities` _(realtime)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--realtime` | `boolean` |  | — | Query real-time activity (Salesforce) instead of batch activity |
| `--search` | `string` |  | — | Free-text search across job and connection names |
| `--name` | `string` |  | — | Filter by connection name (case-insensitive contains) |
| `--type` | `string` |  | — | Filter by connector type (case-insensitive contains, e.g. SFDC, S3) |
| `--id` | `string` |  | — | Filter by connection ID (real-time only) |
| `--job-id` | `string` |  | — | Filter by job ID |
| `--job-name` | `string` |  | — | Filter by job name (case-insensitive contains; batch only) |
| `--status` | `string` |  | — | Filter by execution status One of: `SUCCESS`, `FAILED`, `IN_PROGRESS`. |
| `--from` | `string` |  | — | Filter activity on or after this date (YYYY-MM-DD) |
| `--to` | `string` |  | — | Filter activity on or before this date (YYYY-MM-DD); must be >= --from |
| `--show-deleted` | `boolean` |  | — | Include runs for deleted jobs (batch only) |
| `--query` | `string` |  | — | API-level free-text search (real-time only) |
| `--gsid` | `string` |  | — | Filter by Gainsight customer GSID (real-time only) |
| `--limit` | `integer` |  | `20` | Page size |
| `--page` | `integer` |  | `1` | Page number |
| `--sort-field` | `string` |  | — | Field to sort by |
| `--sort-dir` | `string` |  | `"DESC"` | Sort direction One of: `ASC`, `DESC`. |

**Examples**

```bash
gs-admin cn activity
```

### `gs-admin connectors audit`
*Short form:* `gs-admin cn audit`

Audit connector configuration changes

List connector update/audit activity from /v1/api/connector/ipaas/updateActivities. Shows who changed what and when.

**MCP tool:** `connectors_audit_connector` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `POST /v1/api/connector/ipaas/updateActivities` _(audit)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--search` | `string` |  | — | Free-text search across connector names and actions |
| `--id` | `string` |  | — | Filter by connector ID |
| `--name` | `string` |  | — | Filter by connector name (case-insensitive contains) |
| `--type` | `string` |  | — | Filter by connector type (case-insensitive contains, e.g. S3, GAINSIGHT_API) |
| `--from` | `string` |  | — | Filter audit entries on or after this date (YYYY-MM-DD) |
| `--to` | `string` |  | — | Filter audit entries on or before this date (YYYY-MM-DD); must be >= --from |
| `--limit` | `integer` |  | `20` | Page size |
| `--page` | `integer` |  | `1` | Page number |
| `--sort-field` | `string` |  | — | Field to sort by |
| `--sort-dir` | `string` |  | `"DESC"` | Sort direction One of: `ASC`, `DESC`. |

**Examples**

```bash
gs-admin cn audit
```

### `gs-admin connectors chain`
*Short form:* `gs-admin cn chain`

Describe a job execution chain set

Show full details of a job chain — metadata, notification recipients, and the ordered list of jobs. Resolve by chain ID (--id) or name (--name).

**MCP tool:** `connectors_describe_job_chain` · **Mutating:** no · **Output:** `detail` · **Endpoint(s):** `GET /v1/api/connector/ipaas/jobExecutionSets` _(all)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` |  | — | Job execution set ID |
| `--name` | `string` |  | — | Chain name — searches list and picks first match |

**Examples**

```bash
gs-admin cn chain
```

### `gs-admin connectors chains`
*Short form:* `gs-admin cn chains`

List job execution chain sets

List all iPaaS job execution sets (job chains), showing chain name, number of jobs, creator, and dates. GET /v1/api/connector/ipaas/jobExecutionSets.

**MCP tool:** `connectors_list_job_chains` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v1/api/connector/ipaas/jobExecutionSets` _(all)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--search` | `string` |  | — | Free-text search across chain names |
| `--name` | `string` |  | — | Filter by chain name (case-insensitive contains) |
| `--type` | `string` |  | — | Filter by connector type of jobs in the chain (case-insensitive contains) |
| `--from` | `string` |  | — | Filter chains created on or after this date (YYYY-MM-DD) |
| `--to` | `string` |  | — | Filter chains created on or before this date (YYYY-MM-DD); must be >= --from |
| `--limit` | `integer` |  | `20` | Page size |
| `--page` | `integer` |  | `1` | Page number |
| `--sort-field` | `string` |  | — | Field to sort by |
| `--sort-dir` | `string` |  | `"DESC"` | Sort direction One of: `ASC`, `DESC`. |

**Examples**

```bash
gs-admin cn chains
```

### `gs-admin connectors jobs`
*Short form:* `gs-admin cn jobs`

List jobs for a connector

List jobs for a specific connector (by connectorId or connectorName). Returns job name, status, schedule, object/file config, and last run info. Omit both params to list all jobs across all connectors.

**MCP tool:** `connectors_list_connector_jobs` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v2/api/duct/connection/connections` _(connections)_, `GET /v1/api/connector/job` _(jobs)_, `GET /v1/api/connector/job/{{jobId}}` _(fetch)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--search` | `string` |  | — | Free-text search across job and connector names |
| `--id` | `string` |  | — | Connector ID (id field from list-connectors) |
| `--name` | `string` |  | — | Connector name — searches list and picks first match |
| `--type` | `string` |  | — | Filter by connector type (case-insensitive contains, e.g. SFDC, DYNAMICS) |
| `--job-name` | `string` |  | — | Filter by job name (case-insensitive contains); used with --describe to target a specific job |
| `--status` | `string` |  | — | Filter by last run status One of: `SUCCESS`, `FAILED`, `IN_PROGRESS`, `NEVER_RUN`. |
| `--from` | `string` |  | — | Filter by last run date on or after (YYYY-MM-DD) |
| `--to` | `string` |  | — | Filter by last run date on or before (YYYY-MM-DD); must be >= --from |
| `--limit` | `integer` |  | `20` | Page size |
| `--page` | `integer` |  | `1` | Page number |
| `--sort-field` | `string` |  | — | Field to sort by |
| `--sort-dir` | `string` |  | `"DESC"` | Sort direction One of: `ASC`, `DESC`. |
| `--describe` | `boolean` |  | — | Fetch and show full job details (field mappings, tasks) for the first matched job |

**Examples**

```bash
gs-admin cn jobs
```

### `gs-admin connectors list`
*Short form:* `gs-admin cn list`

List all iPaaS connector connections

List all iPaaS connector connections with their name, type, status, and configuration details.

**MCP tool:** `connectors_list_connectors` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v2/api/duct/connection/connections` _(all)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--search` | `string` |  | — | Free-text search across connector names and types |
| `--name` | `string` |  | — | Filter by connector name (case-insensitive contains) |
| `--type` | `string` |  | — | Filter by connector type (case-insensitive contains, e.g. SFDC, S3) |
| `--status` | `string` |  | — | Filter by connection status One of: `ACTIVE`, `INACTIVE`. |
| `--limit` | `integer` |  | `20` | Page size |
| `--page` | `integer` |  | `1` | Page number |
| `--sort-field` | `string` |  | — | Field to sort by |
| `--sort-dir` | `string` |  | `"DESC"` | Sort direction One of: `ASC`, `DESC`. |

**Examples**

```bash
gs-admin cn list
```

### `gs-admin connectors px`
*Short form:* `gs-admin cn px`

List PX connector job activity

List PX connector job execution activity from /v1/data-podium/activities. Filters are query parameters.

**MCP tool:** `connectors_list_px_activity` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `POST /v1/data-podium/activities` _(activity)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--search` | `string` |  | — | Free-text search across job and connection names |
| `--name` | `string` |  | — | Filter by connection name (case-insensitive contains) |
| `--type` | `string` |  | — | Filter by connector type (case-insensitive contains, e.g. PX) |
| `--status` | `string` |  | — | Filter by job execution status One of: `SUCCESS`, `FAILED`, `IN_PROGRESS`. |
| `--from` | `string` |  | — | Filter activity on or after this date (YYYY-MM-DD) |
| `--to` | `string` |  | — | Filter activity on or before this date (YYYY-MM-DD); must be >= --from |
| `--limit` | `integer` |  | `20` | Page size |
| `--page` | `integer` |  | `0` | Page number (0-based); handler computes offset = page * limit |
| `--sort-field` | `string` |  | `"date"` | Field to sort by |
| `--desc` | `boolean` |  | `true` | Sort descending (use --sort-dir DESC/ASC for consistent interface) |

**Examples**

```bash
gs-admin cn px
```

