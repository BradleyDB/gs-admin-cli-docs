<!-- GENERATED FILE — do not edit by hand. Regenerate with: npm run build:reference (build/build-reference.mjs). -->

# Journey Orchestrator (`journey` / `jo`)

Journey Orchestrator tools

**61 commands.** 

| Command | Summary | MCP tool |
|---------|---------|----------|
| [`gs-admin journey cta options`](#gs-admin-journey-cta-options) | List every defaulted CTA field with searchable values: types / priorities / statuses / reasons / snooze reasons (live picklists) + dueDateSkipOption / commentOption / entityType (static enums) + users (opt-in) + user pools (live) | `journey_list_cta_options` |
| [`gs-admin journey data-designer get`](#gs-admin-journey-data-designer-get) | Describe a Data Designer object: list its fields with data types and field types | `journey_get_data_designer_object` |
| [`gs-admin journey data-designer list`](#gs-admin-journey-data-designer-list) | List Data Designer (Universal Data Set) objects available for use as participant sources | `journey_list_data_designer_objects` |
| [`gs-admin journey email configure`](#gs-admin-journey-email-configure) | Configure email action step for a program | `journey_configure_email_step` |
| [`gs-admin journey email connectors`](#gs-admin-journey-email-connectors) | List email connectors | `journey_list_email_connectors` |
| [`gs-admin journey email template`](#gs-admin-journey-email-template) | Get email template details including tokens | `journey_get_email_template` |
| [`gs-admin journey email templates`](#gs-admin-journey-email-templates) | List available email templates | `journey_list_email_templates` |
| [`gs-admin journey programs cache discard`](#gs-admin-journey-programs-cache-discard) | Drop the local cache for a program without flushing | `journey_discard_program_cache` |
| [`gs-admin journey programs cache start`](#gs-admin-journey-programs-cache-start) | Force-refresh the local cache for a program from the BE | `journey_start_program_cache` |
| [`gs-admin journey programs create`](#gs-admin-journey-programs-create) | Create a new Dynamic Program | `journey_create_program` |
| [`gs-admin journey programs describe`](#gs-admin-journey-programs-describe) | Get full program details including step structure | `journey_describe_program` |
| [`gs-admin journey programs exclusion-list`](#gs-admin-journey-programs-exclusion-list) | Upload an exclusion list CSV and attach it to a program | `journey_save_exclusion_list` |
| [`gs-admin journey programs list`](#gs-admin-journey-programs-list) | List JO programs | `journey_list_programs` |
| [`gs-admin journey programs nodes add-delay`](#gs-admin-journey-programs-nodes-add-delay) | Add a delay (TIMER) node to the program flow | `journey_add_delay_node` |
| [`gs-admin journey programs nodes close-cta add`](#gs-admin-journey-programs-nodes-close-cta-add) | One-shot: create a fully-configured CLOSE_CTA node from a JSON config | `journey_add_close_cta_node` |
| [`gs-admin journey programs nodes close-cta create`](#gs-admin-journey-programs-nodes-close-cta-create) | Create a CLOSE_CTA action-node skeleton | `journey_create_close_cta_node` |
| [`gs-admin journey programs nodes close-cta set-fields`](#gs-admin-journey-programs-nodes-close-cta-set-fields) | Override CLOSE_CTA fields (partial-merge) | `journey_set_close_cta_fields` |
| [`gs-admin journey programs nodes connect`](#gs-admin-journey-programs-nodes-connect) | Wire one node's outPort to another node's inPort | `journey_connect_nodes` |
| [`gs-admin journey programs nodes create-cta add`](#gs-admin-journey-programs-nodes-create-cta-add) | One-shot: create a fully-configured CREATE_CTA node from a JSON config | `journey_add_create_cta_node` |
| [`gs-admin journey programs nodes create-cta create`](#gs-admin-journey-programs-nodes-create-cta-create) | Create a CREATE_CTA action-node skeleton (shape A: 1 outPort "CTA Created") | `journey_create_create_cta_node` |
| [`gs-admin journey programs nodes create-cta set-exit-timer`](#gs-admin-journey-programs-nodes-create-cta-set-exit-timer) | Set the exit timer on a CREATE_CTA node (expands shape A → B) | `journey_set_create_cta_exit_timer` |
| [`gs-admin journey programs nodes create-cta set-fields`](#gs-admin-journey-programs-nodes-create-cta-set-fields) | Override CREATE_CTA fields (partial-merge) | `journey_set_create_cta_fields` |
| [`gs-admin journey programs nodes create-cta set-flags`](#gs-admin-journey-programs-nodes-create-cta-set-flags) | Set behavior flags on a CREATE_CTA node (canonical state) | `journey_set_create_cta_flags` |
| [`gs-admin journey programs nodes disconnect`](#gs-admin-journey-programs-nodes-disconnect) | Remove a wired connection between two nodes | `journey_disconnect_nodes` |
| [`gs-admin journey programs nodes email add`](#gs-admin-journey-programs-nodes-email-add) | Create a complete email node from a JSON config (one-shot) | `journey_add_email_node` |
| [`gs-admin journey programs nodes email create`](#gs-admin-journey-programs-nodes-email-create) | Create a bare email node skeleton | `journey_create_email_node` |
| [`gs-admin journey programs nodes email map-standard-tokens`](#gs-admin-journey-programs-nodes-email-map-standard-tokens) | Map template tokens to participant fields | `journey_map_email_node_standard_tokens` |
| [`gs-admin journey programs nodes email set-exit-timer`](#gs-admin-journey-programs-nodes-email-set-exit-timer) | Set the exit timer on an email node | `journey_set_email_node_exit_timer` |
| [`gs-admin journey programs nodes email set-flags`](#gs-admin-journey-programs-nodes-email-set-flags) | Set behavior flags on the email node (canonical state) | `journey_set_email_node_flags` |
| [`gs-admin journey programs nodes email set-global-headers`](#gs-admin-journey-programs-nodes-email-set-global-headers) | Set or update global email headers (partial merge) | `journey_set_email_node_global_headers` |
| [`gs-admin journey programs nodes email set-local-headers`](#gs-admin-journey-programs-nodes-email-set-local-headers) | Set or update per-variant email headers (partial merge) | `journey_set_email_node_local_headers` |
| [`gs-admin journey programs nodes email set-template`](#gs-admin-journey-programs-nodes-email-set-template) | Attach a template to the email node | `journey_set_email_node_template` |
| [`gs-admin journey programs nodes remove`](#gs-admin-journey-programs-nodes-remove) | Remove a node from a program; cascades connection cleanup by default | `journey_remove_node` |
| [`gs-admin journey programs nodes set-connections`](#gs-admin-journey-programs-nodes-set-connections) | Replace ALL connections in a program with the given list (canonical state) | `journey_set_connections` |
| [`gs-admin journey programs nodes survey add`](#gs-admin-journey-programs-nodes-survey-add) | Create a complete survey-email node from a JSON config (one-shot) | `journey_add_survey_node` |
| [`gs-admin journey programs nodes survey create`](#gs-admin-journey-programs-nodes-survey-create) | Create a bare survey-email node skeleton | `journey_create_survey_node` |
| [`gs-admin journey programs nodes survey map-standard-tokens`](#gs-admin-journey-programs-nodes-survey-map-standard-tokens) | Map STANDARD-typed template tokens (text placeholders) to participant fields on a survey node | `journey_map_survey_node_standard_tokens` |
| [`gs-admin journey programs nodes survey map-survey-tokens`](#gs-admin-journey-programs-nodes-survey-map-survey-tokens) | Map template tokens to (language, surveyType) pairs on a survey node | `journey_map_survey_node_tokens` |
| [`gs-admin journey programs nodes survey set-exit-timer`](#gs-admin-journey-programs-nodes-survey-set-exit-timer) | Set the exit timer on a survey node | `journey_set_survey_node_exit_timer` |
| [`gs-admin journey programs nodes survey set-flags`](#gs-admin-journey-programs-nodes-survey-set-flags) | Set behavior flags on the survey node (canonical state) | `journey_set_survey_node_flags` |
| [`gs-admin journey programs nodes survey set-global-headers`](#gs-admin-journey-programs-nodes-survey-set-global-headers) | Set or update global email headers on a survey node (partial merge) | `journey_set_survey_node_global_headers` |
| [`gs-admin journey programs nodes survey set-local-headers`](#gs-admin-journey-programs-nodes-survey-set-local-headers) | Set or update per-variant email headers on a survey node (partial merge) | `journey_set_survey_node_local_headers` |
| [`gs-admin journey programs nodes survey set-survey`](#gs-admin-journey-programs-nodes-survey-set-survey) | Attach a survey + pick the inline question + (optional) context field | `journey_set_survey_node_survey` |
| [`gs-admin journey programs nodes survey set-template`](#gs-admin-journey-programs-nodes-survey-set-template) | Attach a template to the survey node | `journey_set_survey_node_template` |
| [`gs-admin journey programs pause`](#gs-admin-journey-programs-pause) | Pause a running program (PROCESSING → PAUSE) | `journey_pause_program` |
| [`gs-admin journey programs publish`](#gs-admin-journey-programs-publish) | Publish a program | `journey_publish_program` |
| [`gs-admin journey programs publish-status`](#gs-admin-journey-programs-publish-status) | Get publish status for a program | `journey_publish_status` |
| [`gs-admin journey programs resume`](#gs-admin-journey-programs-resume) | Resume a paused program (PAUSE → PROCESSING), auto-saves cached mutations first | `journey_resume_program` |
| [`gs-admin journey programs save`](#gs-admin-journey-programs-save) | Commit all cached mutations for a program to the BE in one save | `journey_save_program` |
| [`gs-admin journey programs sources csv-save`](#gs-admin-journey-programs-sources-csv-save) | Attach a CSV participant source to a program (program must have no existing sources) | `journey_save_csv_source` |
| [`gs-admin journey programs sources csv-setup`](#gs-admin-journey-programs-sources-csv-setup) | Upload CSV, attach as source, map columns, and optionally set unique criteria in one step | `journey_setup_csv_source` |
| [`gs-admin journey programs sources dd-save`](#gs-admin-journey-programs-sources-dd-save) | Attach a Data Designer (DD/UDS) participant source to a program (program must have no existing sources) | `journey_save_dd_source` |
| [`gs-admin journey programs sources dd-setup`](#gs-admin-journey-programs-sources-dd-setup) | One-shot: attach a Data Designer source, map columns, and optionally set unique criteria | `journey_setup_dd_source` |
| [`gs-admin journey programs sources describe`](#gs-admin-journey-programs-sources-describe) | Show the participant source attached to a program (works for CSV and DD sources) | `journey_describe_program_source` |
| [`gs-admin journey programs sources map`](#gs-admin-journey-programs-sources-map) | Set column mapping for a participant source (auto-detects CSV vs Data Designer) | `journey_save_mapping` |
| [`gs-admin journey programs sources unique-criteria`](#gs-admin-journey-programs-sources-unique-criteria) | Set uniqueCriteria for a program (fields used to deduplicate participants) | `journey_save_unique_criteria` |
| [`gs-admin journey programs sources upload-csv`](#gs-admin-journey-programs-sources-upload-csv) | Upload a CSV file as participants | `journey_upload_csv_participants` |
| [`gs-admin journey programs stop`](#gs-admin-journey-programs-stop) | Stop a program (PROCESSING\|PAUSE → STOP) — terminates execution | `journey_stop_program` |
| [`gs-admin journey programs validate`](#gs-admin-journey-programs-validate) | Run all pre-publish validations against a Dynamic Program (read-only — no mutation) | `journey_validate` |
| [`gs-admin journey surveys get`](#gs-admin-journey-surveys-get) | Fetch survey details — inline questions and supported languages | `journey_get_survey` |
| [`gs-admin journey surveys list`](#gs-admin-journey-surveys-list) | List available surveys (PUBLISH state, DISTRIBUTE action) | `journey_list_surveys` |

---

### `gs-admin journey cta options`
*Short form:* `gs-admin jo cta options`
*Path:* CTA configuration discovery (read-only)

List every defaulted CTA field with searchable values: types / priorities / statuses / reasons / snooze reasons (live picklists) + dueDateSkipOption / commentOption / entityType (static enums) + users (opt-in) + user pools (live)

Single discovery tool that resolves every CTA field an agent might need to fill. Picklists (--type-id / --priority-id / --status-id / --reason-id) come from the live tenant. Enums (--due-date-skip-option / --comment-option / --entity-type) come from baked-in tables with HAR-verified defaults flagged via isDefault:true. Users (--owner-id) come from a search-driven user lookup, opt-in via --user-search or --include-users. User pools (--owner-pool-id) come from a live fetch (typically <50 entries per tenant). Every bucket is uniformly shaped {name, value, ...} so the agent searches by name and passes value to the corresponding flag.

**MCP tool:** `journey_list_cta_options` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `POST /v1/cockpit//admin-v2/types/list` _(picklists)_, `POST /v1/users/search` _(users)_, `POST /v1/users/user-pools/search` _(userPools)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--category` | `string` |  | `"all"` | Filter to one bucket. user implies --include-users. One of: `type`, `priority`, `status`, `reason`, `snooze`, `due-date-skip`, `comment`, `entity`, `user`, `pool`, `all`. |
| `--user-search` | `string` |  | — | Substring match on user Name+Email (also enables user fetch) |
| `--include-users` | `boolean` |  | — | Fetch first page of all users (no filter) — opt-in |
| `--user-limit` | `integer` |  | `25` | Max users to fetch |
| `--user-page` | `integer` |  | `0` | 0-based page number for users |

**Examples**

```bash
gs-admin jo cta options
```

### `gs-admin journey data-designer get`
*Short form:* `gs-admin jo dd get`
*Path:* Data Designer (Universal Data Set) operations

Describe a Data Designer object: list its fields with data types and field types

**MCP tool:** `journey_get_data_designer_object` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v1/journey/object/describe/{{objectName}}` _(describe)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--name` | `string` | ✓ | — | Data Designer object name (e.g. company_aperson_add) |

**Examples**

```bash
gs-admin jo dd get --name <object-name>
```

### `gs-admin journey data-designer list`
*Short form:* `gs-admin jo dd list`
*Path:* Data Designer (Universal Data Set) operations

List Data Designer (Universal Data Set) objects available for use as participant sources

**MCP tool:** `journey_list_data_designer_objects` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v1/journey/object/list` _(list)_

**Flags**

_No flags._

**Examples**

```bash
gs-admin jo dd list
```

### `gs-admin journey email configure`
*Short form:* `gs-admin jo e configure`
*Path:* Email template and connector operations

Configure email action step for a program

STEP 3b/4 of program creation. Configures the email step with a template and token mappings. tokenMappings maps template tokens to CSV column display names; the handler resolves display names to custom-field IDs.

**MCP tool:** `journey_configure_email_step` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `POST /v1/journey/program/{{programId}}/fetch` _(fetch)_, `PATCH /v1/journey/program/{{programId}}/aoConfiguration` _(updateConfig)_, `PUT /v1/journey/program/{{programId}}/step/action/configuration` _(updateStepAction)_, `PUT /v1/journey/program/{{programId}}/step` _(updateStepName)_, `PUT /v1/api/journeyorchestrator/dependency/updateRelationship` _(updateRelationship)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--program-id` | `string` | ✓ | — | Program ID (GUID) |
| `--template-id` | `string` | ✓ | — | Email template UUID |
| `--template-name` | `string` |  | — | Display name of the template (auto-fetched if omitted) |
| `--from-name` | `string` | ✓ | — | Sender display name |
| `--from-email` | `string` | ✓ | — | Sender email address |
| `--token-mappings` | `string` | ✓ | — | JSON mapping template tokens to participant fields |
| `--program-name` | `string` |  | — | Program name (auto-fetched if omitted) |

**Examples**

```bash
gs-admin jo e configure --program-id <program-id> --template-id <email-template-id> --from-name <from-name> --from-email <from-email> --token-mappings <token-mappings>
```

### `gs-admin journey email connectors`
*Short form:* `gs-admin jo e connectors`
*Path:* Email template and connector operations

List email connectors

**MCP tool:** `journey_list_email_connectors` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v1/journey/engagement/connectors`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--type` | `string` |  | `"COMPANY"` | Connector type |

**Examples**

```bash
gs-admin jo e connectors
```

### `gs-admin journey email template`
*Short form:* `gs-admin jo e template`
*Path:* Email template and connector operations

Get email template details including tokens

**MCP tool:** `journey_get_email_template` · **Mutating:** no · **Output:** `detail` · **Endpoint(s):** `GET /v1/api/templates/{{templateId}}` _(fetch)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Email template UUID |

**Examples**

```bash
gs-admin jo e template --id <template-id>
```

### `gs-admin journey email templates`
*Short form:* `gs-admin jo e templates`
*Path:* Email template and connector operations

List available email templates

STEP 3a/4 of program creation. Lists email templates from the COMMS source as a slim view (id, title, folder, type, transactional flag). Use journey_get_email_template with --id for full body, variants, and tokens. Defaults cap the response to 50 templates; pass --limit to override.

**MCP tool:** `journey_list_email_templates` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v1/journey/assets` _(list)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--name` | `string` |  | — | Filter by template title (case-insensitive contains) |
| `--folder` | `string` |  | — | Filter by folder name (case-insensitive contains) |
| `--limit` | `integer` |  | `50` | Max templates to return (default: 50, prevents oversized MCP responses) |

**Examples**

```bash
gs-admin jo e templates
```

### `gs-admin journey programs cache discard`
*Short form:* `gs-admin jo p cache discard`
*Path:* Program operations › Cache

Drop the local cache for a program without flushing

Delete ~/.gs-admin/cache/<programId>.json. Returns the pending-mutation log so the agent can decide whether to replay anything. No-op if no cache exists for the program.

**MCP tool:** `journey_discard_program_cache` · **Mutating:** no · **Output:** `detail`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID (GUID) |

**Examples**

```bash
gs-admin jo p cache discard --id <program-id>
```

### `gs-admin journey programs cache start`
*Short form:* `gs-admin jo p cache start`
*Path:* Program operations › Cache

Force-refresh the local cache for a program from the BE

JO mutations auto-create a local cache on first use, so this command is rarely needed. Use it to FORCE-refresh: fetches the program fresh from the BE and resets ~/.gs-admin/cache/<programId>.json (capturing the new documentVersionNo as `baseVersion` for drift detection at save time). Refuses if the cache has pending mutations — call 'jo p save' or 'jo p cache discard' first. Useful when you know the BE was edited externally and your local cache is stale.

**MCP tool:** `journey_start_program_cache` · **Mutating:** no · **Output:** `detail`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID (GUID) |

**Examples**

```bash
gs-admin jo p cache start --id <program-id>
```

### `gs-admin journey programs create`
*Short form:* `gs-admin jo p create`
*Path:* Program operations

Create a new Dynamic Program

Creates a Dynamic Program in Journey Orchestrator. Returns the new program ID.

**MCP tool:** `journey_create_program` · **Mutating:** yes ⚠️ · **Output:** `detail` · **Endpoint(s):** `POST /v1/journey/program` _(create)_, `POST /v1/api/journeyorchestrator/dependency/createResource` _(createResource)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--name` | `string` | ✓ | — | Program name |
| `--folder-id` | `string` |  | `"2"` | Folder ID |
| `--description` | `string` |  | — | Program description |

**Examples**

```bash
gs-admin jo p create --name <name>
```

### `gs-admin journey programs describe`
*Short form:* `gs-admin jo p describe`
*Path:* Program operations

Get full program details including step structure

Fetch full details of a Journey Orchestrator program including its step structure. Provide either programId or programName.

**MCP tool:** `journey_describe_program` · **Mutating:** no · **Output:** `detail` · **Endpoint(s):** `POST /v1/journey/program/{{programId}}/fetch` _(fetch)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` |  | — | Program ID (GUID) |
| `--name` | `string` |  | — | Program name (searches + picks first match) |
| `--no-cache` | `boolean` |  | `true` | Serve from local cache when one exists for this programId. Pass --no-cache to bypass and fetch fresh from BE. |

**Examples**

```bash
gs-admin jo p describe
```

### `gs-admin journey programs exclusion-list`
*Short form:* `gs-admin jo p exclusion-list`
*Path:* Program operations

Upload an exclusion list CSV and attach it to a program

**MCP tool:** `journey_save_exclusion_list` · **Mutating:** yes ⚠️ · **Output:** `detail` · **Endpoint(s):** `POST /v1/journey/participants/uploadCSV` _(uploadCsv)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Program ID (GUID) |
| `--file` | `string` | ✓ | — | Path to exclusion list CSV file |
| `--unique-identifier-exclusion-list` | `string` | ✓ | — | CSV column to use as the exclusion identifier |

**Examples**

```bash
gs-admin jo p exclusion-list --id <program-id> --file <file> --unique-identifier-exclusion-list <unique-identifier-exclusion-list>
```

### `gs-admin journey programs list`
*Short form:* `gs-admin jo p list`
*Path:* Program operations

List JO programs

List Journey Orchestrator programs with pagination, search, and sorting. Returns program names, statuses, types, modification dates, and IDs.

**MCP tool:** `journey_list_programs` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `POST /v1/journey/program/list`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--limit` | `integer` |  | `20` | Page size |
| `--page` | `integer` |  | `1` | Page number |
| `--search` | `string` |  | — | Filter by name |
| `--sort-field` | `string` |  | `"modified_date"` | Sort field |
| `--sort-dir` | `string` |  | `"DESC"` | Sort direction One of: `ASC`, `DESC`. |

**Examples**

```bash
gs-admin jo p list
```

### `gs-admin journey programs nodes add-delay`
*Short form:* `gs-admin jo p n add-delay`
*Path:* Program operations › Build nodes in the program flow

Add a delay (TIMER) node to the program flow

Creates an unconnected TIMER node with valueType=STATIC. Pass the value + unit (DAYS, HOURS, or MINUTES). Wire it with jo p n connect afterwards. Multiple delay nodes are allowed.

**MCP tool:** `journey_add_delay_node` · **Mutating:** no · **Output:** `detail`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |
| `--name` | `string` |  | — | Node display name (default: Delay) |
| `--timer-value` | `integer` | ✓ | — | Numeric delay amount (positive integer) |
| `--interval-unit` | `string` | ✓ | — | Time unit One of: `DAYS`, `HOURS`, `MINUTES`. |

**Examples**

```bash
gs-admin jo p n add-delay --id <program-id> --timer-value <timer-value> --interval-unit <interval-unit>
```

### `gs-admin journey programs nodes close-cta add`
*Short form:* `gs-admin jo p n xc add`
*Path:* Program operations › Build nodes in the program flow › Close-CTA node operations

One-shot: create a fully-configured CLOSE_CTA node from a JSON config

Single API call that creates the node + populates actionConfig with comments + statusId mappings. Mandatory config key: srcCreateCtaNodeId (must be an existing CREATE_CTA in this program). Optional: nodeName, comments (tokenizable), statusId, flags.duplicateCheck.

**MCP tool:** `journey_add_close_cta_node` · **Mutating:** no · **Output:** `detail`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |
| `--config-file` | `string` |  | — | Path to JSON config file |
| `--config-json` | `string` |  | — | Inline JSON config |

**Examples**

```bash
gs-admin jo p n xc add --id <program-id>
```

### `gs-admin journey programs nodes close-cta create`
*Short form:* `gs-admin jo p n xc create`
*Path:* Program operations › Build nodes in the program flow › Close-CTA node operations

Create a CLOSE_CTA action-node skeleton

Creates a new CLOSE_CTA node paired to a sibling CREATE_CTA via --src-create-cta-node-id. The close node has 1 outPort (no branching). Mandatory: --src-create-cta-node-id (must reference an existing CREATE_CTA in this program). Optional: --node-name (default "Close CTA"), --comments (tokenizable; default empty), --status-id (default Closed Success).

**MCP tool:** `journey_create_close_cta_node` · **Mutating:** no · **Output:** `detail`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |
| `--src-create-cta-node-id` | `string` | ✓ | — | ID of the paired CREATE_CTA node in this program |
| `--node-name` | `string` |  | — | Node display label (default Close CTA) |
| `--comments` | `string` |  | — | Comments to set when closing the CTA (tokenizable) |
| `--status-id` | `string` |  | — | Close status GSID (default Closed Success) |

**Examples**

```bash
gs-admin jo p n xc create --id <program-id> --src-create-cta-node-id <src-create-cta-node-id>
```

### `gs-admin journey programs nodes close-cta set-fields`
*Short form:* `gs-admin jo p n xc set-fields`
*Path:* Program operations › Build nodes in the program flow › Close-CTA node operations

Override CLOSE_CTA fields (partial-merge)

Pass any subset of --comments / --status-id. Only the flags you pass are rewritten. The srcStepId (paired CREATE_CTA reference) cannot be changed via set-fields.

**MCP tool:** `journey_set_close_cta_fields` · **Mutating:** no · **Output:** `detail`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |
| `--node-id` | `string` | ✓ | — | CLOSE_CTA node ID |
| `--comments` | `string` |  | — | Comments (tokenizable) |
| `--status-id` | `string` |  | — | Close status GSID |

**Examples**

```bash
gs-admin jo p n xc set-fields --id <program-id> --node-id <node-id>
```

### `gs-admin journey programs nodes connect`
*Short form:* `gs-admin jo p n connect`
*Path:* Program operations › Build nodes in the program flow

Wire one node's outPort to another node's inPort

Creates a real edge in stepJson.connections from a source outPort to a target inPort. Both port IDs are required (look them up via jo p describe). Validates: source must be an outPort, target an inPort, source.depth <= target.depth (no upward), source outPort has no existing real edge (one outgoing per outPort), no self-loops.

**MCP tool:** `journey_connect_nodes` · **Mutating:** no · **Output:** `detail`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |
| `--from-port` | `string` | ✓ | — | Source outPort ID |
| `--to-port` | `string` | ✓ | — | Target inPort ID |

**Examples**

```bash
gs-admin jo p n connect --id <program-id> --from-port <from-port> --to-port <to-port>
```

### `gs-admin journey programs nodes create-cta add`
*Short form:* `gs-admin jo p n cc add`
*Path:* Program operations › Build nodes in the program flow › Create-CTA node operations

One-shot: create a fully-configured CREATE_CTA node from a JSON config

Single API call that creates the node + populates actionConfig (params + 7 mappings) + optionally applies an exit timer (config.exitTimer triggers immediate shape A → B). Mandatory config keys: name (CTA record name; tokenizable) and typeId (activity type). Everything else (nodeName, priorityId, statusId, reasonId, ownerId, dueDays, dueDateSkipOption, commentOption, entityType, exitTimer, flags.duplicateCheck) is optional and defaults from HAR.

**MCP tool:** `journey_add_create_cta_node` · **Mutating:** no · **Output:** `detail`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |
| `--config-file` | `string` |  | — | Path to JSON config file |
| `--config-json` | `string` |  | — | Inline JSON config |

**Examples**

```bash
gs-admin jo p n cc add --id <program-id>
```

### `gs-admin journey programs nodes create-cta create`
*Short form:* `gs-admin jo p n cc create`
*Path:* Program operations › Build nodes in the program flow › Create-CTA node operations

Create a CREATE_CTA action-node skeleton (shape A: 1 outPort "CTA Created")

Creates a new CREATE_CTA node. Mandatory: --node-name (display label), --cta-name (the tokenizable CTA-record name; supports ${tokenId}), --type-id (activity type GSID). Owner has two flags: --default-owner-id is a literal user GSID (always set in the saved payload — defaults to the program's createdBy when omitted), and --owner-id is OPTIONAL and selects a routing override that's polymorphic: pass a user-pool GSID (1UP…) for round-robin assignment, or a participant fieldId (gsAccountId / recipientEmailAddress / gsPersonId / a custom-fieldId) to resolve the owner per participant via IF formula. The two routing shapes (pool / field) are mutually exclusive — --owner-id is single-valued, you pick one. All other CTA fields (priority, status, reason, dueDays, dueDateSkipOption, commentOption, entityType) auto-default from HAR. To expand to the 2-outPort branched shape (CTA Not Closed / CTA Closed), run cc set-exit-timer afterwards.

**MCP tool:** `journey_create_create_cta_node` · **Mutating:** no · **Output:** `detail`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |
| `--node-name` | `string` | ✓ | — | Node display label in the program flow |
| `--cta-name` | `string` | ✓ | — | CTA record name (the actual call_to_action.name); may contain ${tokenId} |
| `--type-id` | `string` | ✓ | — | Activity type GSID (e.g. 1I00650WACZ7F0X9HR3Z9Q14SQ7JV8L8LT1I for Activity) |
| `--default-owner-id` | `string` |  | — | Literal user GSID (1P0…) — always written to the saved payload (BE-mandatory). Defaults to the program's createdBy. Doubles as the empty-pool fallback / IF-formula null-fallback when --owner-id is set. |
| `--owner-id` | `string` |  | — | Optional polymorphic routing override. Either a user-pool GSID (1UP…; round-robin) or a participant fieldId (recipientEmailAddress / gsAccountId / gsPersonId / a custom DD/CSV fieldId; resolved per participant via IF formula). The two shapes are alternatives — pass exactly one. Discover pools via: jo cta options --category pool. |

**Examples**

```bash
gs-admin jo p n cc create --id <program-id> --node-name <node-name> --cta-name <cta-name> --type-id <type-id>
```

### `gs-admin journey programs nodes create-cta set-exit-timer`
*Short form:* `gs-admin jo p n cc set-exit-timer`
*Path:* Program operations › Build nodes in the program flow › Create-CTA node operations

Set the exit timer on a CREATE_CTA node (expands shape A → B)

Updates node.exitTimer = { timerValue, intervalUnit } and migrates the single "CTA Created" outPort to two branched outPorts (CTA Not Closed / CTA Closed). Idempotent on already-expanded nodes — only the timer changes; outPorts and connections are preserved.

**MCP tool:** `journey_set_create_cta_exit_timer` · **Mutating:** no · **Output:** `detail`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |
| `--node-id` | `string` | ✓ | — | CREATE_CTA node ID |
| `--timer-value` | `integer` | ✓ | — | Exit-timer amount (positive integer) |
| `--interval-unit` | `string` | ✓ | — | Time unit One of: `DAYS`, `HOURS`, `MINUTES`. |

**Examples**

```bash
gs-admin jo p n cc set-exit-timer --id <program-id> --node-id <node-id> --timer-value <timer-value> --interval-unit <interval-unit>
```

### `gs-admin journey programs nodes create-cta set-fields`
*Short form:* `gs-admin jo p n cc set-fields`
*Path:* Program operations › Build nodes in the program flow › Create-CTA node operations

Override CREATE_CTA fields (partial-merge)

Pass any subset of --cta-name / --type-id / --priority-id / --status-id / --reason-id / --owner-id / --due-days / --due-date-skip-option / --comment-option / --entity-type. Only the flags you pass are rewritten; everything else is preserved. Re-validates token expansion in --cta-name against the program's customFieldsMeta.

**MCP tool:** `journey_set_create_cta_fields` · **Mutating:** no · **Output:** `detail`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |
| `--node-id` | `string` | ✓ | — | CREATE_CTA node ID |
| `--cta-name` | `string` |  | — | CTA record name (tokenizable) |
| `--type-id` | `string` |  | — | Activity type GSID |
| `--priority-id` | `string` |  | — | Priority GSID (default Medium) |
| `--status-id` | `string` |  | — | Status GSID (default New) |
| `--reason-id` | `string` |  | — | Reason GSID (default Other) |
| `--default-owner-id` | `string` |  | — | Literal user GSID (1P0…). Default = program createdBy. Always written to the saved payload; doubles as the fallback for pool/field owner shapes. |
| `--owner-id` | `string` |  | — | Polymorphic routing override: user-pool GSID (1UP…) for round-robin, OR a participant fieldId (recipientEmailAddress / gsPersonId / custom DD-fieldId) for IF-formula resolution. The two shapes are alternatives. Pass empty string to clear an existing pool/field-ref. |
| `--due-days` | `integer` |  | — | dueDatePlusDays (default 5) |
| `--due-date-skip-option` | `string` |  | — | Due-date skip option (default SKIP_ALL_WEEKENDS) |
| `--comment-option` | `string` |  | — | Comment option (default ONCE) |
| `--entity-type` | `string` |  | — | Entity type COMPANY\|RELATIONSHIP\|PERSON (default COMPANY) |

**Examples**

```bash
gs-admin jo p n cc set-fields --id <program-id> --node-id <node-id>
```

### `gs-admin journey programs nodes create-cta set-flags`
*Short form:* `gs-admin jo p n cc set-flags`
*Path:* Program operations › Build nodes in the program flow › Create-CTA node operations

Set behavior flags on a CREATE_CTA node (canonical state)

Toggle node-level behavior flags. Currently only duplicateCheck is meaningful for CTA nodes. Pass --no-duplicate-check to skip duplicate sends (default: enabled).

**MCP tool:** `journey_set_create_cta_flags` · **Mutating:** no · **Output:** `detail`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |
| `--node-id` | `string` | ✓ | — | CREATE_CTA node ID |
| `--no-duplicate-check` | `boolean` |  | `true` | Skip duplicate sends (--no-duplicate-check disables) |

**Examples**

```bash
gs-admin jo p n cc set-flags --id <program-id> --node-id <node-id>
```

### `gs-admin journey programs nodes disconnect`
*Short form:* `gs-admin jo p n disconnect`
*Path:* Program operations › Build nodes in the program flow

Remove a wired connection between two nodes

Drops the real edge from a source outPort to a target inPort and restores the trailing-open edge on the freed source outPort. Both port IDs are required.

**MCP tool:** `journey_disconnect_nodes` · **Mutating:** no · **Output:** `detail`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |
| `--from-port` | `string` | ✓ | — | Source outPort ID |
| `--to-port` | `string` | ✓ | — | Target inPort ID |

**Examples**

```bash
gs-admin jo p n disconnect --id <program-id> --from-port <from-port> --to-port <to-port>
```

### `gs-admin journey programs nodes email add`
*Short form:* `gs-admin jo p n e add`
*Path:* Program operations › Build nodes in the program flow › Email node operations

Create a complete email node from a JSON config (one-shot)

Builds and saves a full email node end-to-end. Pass exactly one of --config-file <path> or --config-json '<json>'. Validates template, variants, tokens, fields, headers all up-front.

**MCP tool:** `journey_add_email_node` · **Mutating:** yes ⚠️ · **Output:** `detail` · **Endpoint(s):** `GET /v1/api/templates/{{templateId}}` _(fetchTemplate)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |
| `--config-file` | `string` |  | — | Path to JSON config file |
| `--config-json` | `string` |  | — | Inline JSON config |

**Examples**

```bash
gs-admin jo p n e add --id <program-id>
```

### `gs-admin journey programs nodes email create`
*Short form:* `gs-admin jo p n e create`
*Path:* Program operations › Build nodes in the program flow › Email node operations

Create a bare email node skeleton

Adds an empty SEND_EMAIL ACTION node to stepJson. No actionConfig yet — call set-template next. Returns the generated nodeId. Validates that name is unique across all nodes.

**MCP tool:** `journey_create_email_node` · **Mutating:** yes ⚠️ · **Output:** `detail`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |
| `--name` | `string` |  | — | Node display name (default: Email) |

**Examples**

```bash
gs-admin jo p n e create --id <program-id>
```

### `gs-admin journey programs nodes email map-standard-tokens`
*Short form:* `gs-admin jo p n e map-standard-tokens`
*Path:* Program operations › Build nodes in the program flow › Email node operations

Map template tokens to participant fields

Sets variantTokenMapping for a variant. --variant-template-id is optional; defaults to the default variant. Pass mappings as inline JSON via --token-mappings or via --token-mappings-file.

**MCP tool:** `journey_map_email_node_standard_tokens` · **Mutating:** yes ⚠️ · **Output:** `detail` · **Endpoint(s):** `GET /v1/api/templates/{{templateId}}` _(fetchTemplate)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |
| `--node-id` | `string` | ✓ | — | Email node ID |
| `--variant-template-id` | `string` |  | — | Variant template UUID (defaults to default variant) |
| `--token-mappings` | `string` |  | — | Inline JSON: {"tokenId":"fieldId",...} |
| `--token-mappings-file` | `string` |  | — | Path to a JSON file containing the mappings |

**Examples**

```bash
gs-admin jo p n e map-standard-tokens --id <program-id> --node-id <node-id>
```

### `gs-admin journey programs nodes email set-exit-timer`
*Short form:* `gs-admin jo p n e set-exit-timer`
*Path:* Program operations › Build nodes in the program flow › Email node operations

Set the exit timer on an email node

Updates node.exitTimer = { timerValue, intervalUnit }. The BE-side condition for an email exit timer is "open" — i.e. the timer expires either when the email is opened (EMAIL_OPENED event) or when the timer runs out (whichever comes first). Pass DAYS / HOURS / MINUTES.

**MCP tool:** `journey_set_email_node_exit_timer` · **Mutating:** no · **Output:** `detail`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |
| `--node-id` | `string` | ✓ | — | Email/Survey node ID |
| `--timer-value` | `integer` | ✓ | — | Exit-timer amount (positive integer) |
| `--interval-unit` | `string` | ✓ | — | Time unit One of: `DAYS`, `HOURS`, `MINUTES`. |

**Examples**

```bash
gs-admin jo p n e set-exit-timer --id <program-id> --node-id <node-id> --timer-value <timer-value> --interval-unit <interval-unit>
```

### `gs-admin journey programs nodes email set-flags`
*Short form:* `gs-admin jo p n e set-flags`
*Path:* Program operations › Build nodes in the program flow › Email node operations

Set behavior flags on the email node (canonical state)

Sets node-level (duplicateCheck, hasLinkTracking) and email-level booleans. Calling this command resets every flag to the value you pass (or its natural default if you don't pass it). For default-true flags, use --no-X to disable; for default-false flags, use --X to enable.

**MCP tool:** `journey_set_email_node_flags` · **Mutating:** yes ⚠️ · **Output:** `detail`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |
| `--node-id` | `string` | ✓ | — | Email node ID |
| `--no-duplicate-check` | `boolean` |  | `true` | Skip duplicate sends |
| `--link-tracking` | `boolean` |  | `false` | Track link clicks |
| `--skip-on-unavailable-tokens` | `boolean` |  | `false` | Skip when tokens missing |
| `--no-send-default-template` | `boolean` |  | `true` | Fall back to default variant |
| `--log-to-timeline` | `boolean` |  | `false` | Log to Gainsight timeline |
| `--group-email` | `boolean` |  | `false` | Group email mode |
| `--no-add-unsubscribe-footer` | `boolean` |  | `true` | Add unsubscribe footer |
| `--no-send-text-content` | `boolean` |  | `true` | Include plain-text body |
| `--no-transactional` | `boolean` |  | `true` | Mark as transactional |
| `--log-to-ms-dynamics` | `boolean` |  | `false` | Log to MS Dynamics |

**Examples**

```bash
gs-admin jo p n e set-flags --id <program-id> --node-id <node-id>
```

### `gs-admin journey programs nodes email set-global-headers`
*Short form:* `gs-admin jo p n e set-global-headers`
*Path:* Program operations › Build nodes in the program flow › Email node operations

Set or update global email headers (partial merge)

Sets emailInfo.emailHeaders and flips isLocalHeadersEnabled=false. Strips any per-variant emailHeaders. Each call MERGES — only fields you pass are updated; omitted fields keep their previous values. On the first call (no existing headers), --from-name and --from-email are required. Header values: plain string = VALUE, "field:<fieldId>" = FIELD reference. Note: --cc sets isCC=true; if not passed, isCC is left unchanged on follow-up calls.

**MCP tool:** `journey_set_email_node_global_headers` · **Mutating:** yes ⚠️ · **Output:** `detail`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |
| `--node-id` | `string` | ✓ | — | Email node ID |
| `--from-name` | `string` |  | — | Sender display name (or 'field:<id>') |
| `--from-email` | `string` |  | — | Sender email (or 'field:<id>') |
| `--reply-to` | `string` |  | — | Reply-to (defaults to fromEmail) |
| `--recipient-field` | `string` |  | — | Recipient field reference (default: field:recipientEmailAddress) |
| `--to-name` | `string` |  | — | Recipient display name (or 'field:<id>') |
| `--cc` | `boolean` |  | — | Send as CC |

**Examples**

```bash
gs-admin jo p n e set-global-headers --id <program-id> --node-id <node-id>
```

### `gs-admin journey programs nodes email set-local-headers`
*Short form:* `gs-admin jo p n e set-local-headers`
*Path:* Program operations › Build nodes in the program flow › Email node operations

Set or update per-variant email headers (partial merge)

Sets variantMappings[i].emailHeaders for the given variant; flips isLocalHeadersEnabled=true. Errors if the template has only one variant. Each call MERGES — only fields you pass are updated. On the first call (no existing headers), --from-name and --from-email are required.

**MCP tool:** `journey_set_email_node_local_headers` · **Mutating:** yes ⚠️ · **Output:** `detail`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |
| `--node-id` | `string` | ✓ | — | Email node ID |
| `--variant-template-id` | `string` |  | — | Variant template UUID (defaults to the default variant) |
| `--from-name` | `string` |  | — | Sender display name (or 'field:<id>') |
| `--from-email` | `string` |  | — | Sender email (or 'field:<id>') |
| `--reply-to` | `string` |  | — | Reply-to (defaults to fromEmail) |
| `--recipient-field` | `string` |  | — | Recipient field reference (default: field:recipientEmailAddress) |
| `--to-name` | `string` |  | — | Recipient display name |
| `--cc` | `boolean` |  | — | Send as CC |

**Examples**

```bash
gs-admin jo p n e set-local-headers --id <program-id> --node-id <node-id>
```

### `gs-admin journey programs nodes email set-template`
*Short form:* `gs-admin jo p n e set-template`
*Path:* Program operations › Build nodes in the program flow › Email node operations

Attach a template to the email node

Mandatory step before headers/tokens. Fetches the template, builds variantMappings (one per variant), no headers or token mappings yet.

**MCP tool:** `journey_set_email_node_template` · **Mutating:** yes ⚠️ · **Output:** `detail` · **Endpoint(s):** `GET /v1/api/templates/{{templateId}}` _(fetchTemplate)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |
| `--node-id` | `string` | ✓ | — | Node ID returned by create |
| `--template-id` | `string` | ✓ | — | Email template UUID (main/default variant) |

**Examples**

```bash
gs-admin jo p n e set-template --id <program-id> --node-id <node-id> --template-id <template-id>
```

### `gs-admin journey programs nodes remove`
*Short form:* `gs-admin jo p n remove`
*Path:* Program operations › Build nodes in the program flow

Remove a node from a program; cascades connection cleanup by default

Delete one node from stepJson.nodes. By default also removes every connection where the node's inPort or any outPort appears — this matches the user-intuitive 'I no longer want this step.' Trailing-open placeholder edges are re-seeded on any OTHER node whose outPort lost its target so the BE keeps tracking it. Refuses to remove START. Refuses to remove a CREATE_CTA whose nodeId is referenced by a CLOSE_CTA's srcStepId — remove the close-CTA(s) first. Pass --require-disconnected to opt out of cascade and force an explicit teardown order. Atomic via saveProgram, so cache mode works the same as any other mutation.

**MCP tool:** `journey_remove_node` · **Mutating:** yes ⚠️ · **Output:** `detail`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |
| `--node-id` | `string` | ✓ | — | ID of the node to remove |
| `--require-disconnected` | `boolean` |  | `false` | Refuse to remove if the node still has any real connection (forces explicit disconnect first) |

**Examples**

```bash
gs-admin jo p n remove --id <program-id> --node-id <node-id>
```

### `gs-admin journey programs nodes set-connections`
*Short form:* `gs-admin jo p n set-connections`
*Path:* Program operations › Build nodes in the program flow

Replace ALL connections in a program with the given list (canonical state)

Wipes every existing connection and applies the new list atomically — every standard guard rail still fires per pair (outPort→inPort, no self-connect, no upward edge, no double-fanout). CLOSE_CTA reachability is checked once at the end across all close-CTA targets, so pairs may be supplied in any order. Use this when conflicts make incremental connect/disconnect awkward. Pass an empty array ([]) to clear every real edge — trailing-open placeholders are kept so the BE keeps tracking each outPort. Atomic: any per-pair error rolls the whole save back.

**MCP tool:** `journey_set_connections` · **Mutating:** no · **Output:** `detail`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |
| `--connections-json` | `string` |  | — | Inline JSON: [{"from":"<outPortId>","to":"<inPortId>"}, …] |
| `--connections-file` | `string` |  | — | Path to JSON file with the same shape |

**Examples**

```bash
gs-admin jo p n set-connections --id <program-id>
```

### `gs-admin journey programs nodes survey add`
*Short form:* `gs-admin jo p n s add`
*Path:* Program operations › Build nodes in the program flow › Survey-email node operations

Create a complete survey-email node from a JSON config (one-shot)

Builds and saves a full survey-email node end-to-end. Pass exactly one of --config-file or --config-json. Validates template + survey + tokens + languages + surveyType + context-id up-front.

**MCP tool:** `journey_add_survey_node` · **Mutating:** yes ⚠️ · **Output:** `detail` · **Endpoint(s):** `GET /v1/api/templates/{{templateId}}` _(fetchTemplate)_, `GET /v1/surveys/{{surveyId}}/questions/inline` _(fetchSurvey)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |
| `--config-file` | `string` |  | — | Path to JSON config file |
| `--config-json` | `string` |  | — | Inline JSON config |

**Examples**

```bash
gs-admin jo p n s add --id <program-id>
```

### `gs-admin journey programs nodes survey create`
*Short form:* `gs-admin jo p n s create`
*Path:* Program operations › Build nodes in the program flow › Survey-email node operations

Create a bare survey-email node skeleton

Adds an empty SURVEY ACTION node to stepJson. No actionConfig yet — call set-template + set-survey next. Validates name uniqueness + single-step rule.

**MCP tool:** `journey_create_survey_node` · **Mutating:** yes ⚠️ · **Output:** `detail`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |
| `--name` | `string` |  | — | Node display name (default: Survey) |

**Examples**

```bash
gs-admin jo p n s create --id <program-id>
```

### `gs-admin journey programs nodes survey map-standard-tokens`
*Short form:* `gs-admin jo p n s map-standard-tokens`
*Path:* Program operations › Build nodes in the program flow › Survey-email node operations

Map STANDARD-typed template tokens (text placeholders) to participant fields on a survey node

Mirrors jo p n e map-standard-tokens for survey nodes. Sets variantTokenMapping[].tokenType="STANDARD" entries while preserving existing SurveyToken entries. JSON map of tokenId→fieldId.

**MCP tool:** `journey_map_survey_node_standard_tokens` · **Mutating:** yes ⚠️ · **Output:** `detail` · **Endpoint(s):** `GET /v1/api/templates/{{templateId}}` _(fetchTemplate)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |
| `--node-id` | `string` | ✓ | — | Survey-node ID |
| `--variant-template-id` | `string` |  | — | Variant template UUID |
| `--token-mappings` | `string` |  | — | Inline JSON: {"tokenId":"fieldId"} |
| `--token-mappings-file` | `string` |  | — | Path to a JSON file with the mappings |

**Examples**

```bash
gs-admin jo p n s map-standard-tokens --id <program-id> --node-id <node-id>
```

### `gs-admin journey programs nodes survey map-survey-tokens`
*Short form:* `gs-admin jo p n s map-survey-tokens`
*Path:* Program operations › Build nodes in the program flow › Survey-email node operations

Map template tokens to (language, surveyType) pairs on a survey node

JSON map of tokenId to either a language string ("en_us") or {language, surveyType?:"INLINE"}. Validates language ∈ survey languages, surveyType matches template marker. Defaults to default variant when --variant-template-id is omitted.

**MCP tool:** `journey_map_survey_node_tokens` · **Mutating:** yes ⚠️ · **Output:** `detail` · **Endpoint(s):** `GET /v1/api/templates/{{templateId}}` _(fetchTemplate)_, `GET /v1/surveys/{{surveyId}}/questions/inline` _(fetchSurvey)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |
| `--node-id` | `string` | ✓ | — | Survey-node ID |
| `--variant-template-id` | `string` |  | — | Variant template UUID |
| `--token-mappings` | `string` |  | — | Inline JSON of tokenId mappings |
| `--token-mappings-file` | `string` |  | — | Path to a JSON file with tokenId mappings |

**Examples**

```bash
gs-admin jo p n s map-survey-tokens --id <program-id> --node-id <node-id>
```

### `gs-admin journey programs nodes survey set-exit-timer`
*Short form:* `gs-admin jo p n s set-exit-timer`
*Path:* Program operations › Build nodes in the program flow › Survey-email node operations

Set the exit timer on a survey node

Updates node.exitTimer = { timerValue, intervalUnit }. The BE-side condition for a survey exit timer is "survey_open" — i.e. the timer expires when the survey is responded to (SURVEY_RESPONDED event) or when the timer runs out. Pass DAYS / HOURS / MINUTES.

**MCP tool:** `journey_set_survey_node_exit_timer` · **Mutating:** no · **Output:** `detail`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |
| `--node-id` | `string` | ✓ | — | Email/Survey node ID |
| `--timer-value` | `integer` | ✓ | — | Exit-timer amount (positive integer) |
| `--interval-unit` | `string` | ✓ | — | Time unit One of: `DAYS`, `HOURS`, `MINUTES`. |

**Examples**

```bash
gs-admin jo p n s set-exit-timer --id <program-id> --node-id <node-id> --timer-value <timer-value> --interval-unit <interval-unit>
```

### `gs-admin journey programs nodes survey set-flags`
*Short form:* `gs-admin jo p n s set-flags`
*Path:* Program operations › Build nodes in the program flow › Survey-email node operations

Set behavior flags on the survey node (canonical state)

Same flag set as the email-node version. Default-true flags use --no-X to disable; default-false use --X to enable.

**MCP tool:** `journey_set_survey_node_flags` · **Mutating:** yes ⚠️ · **Output:** `detail`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |
| `--node-id` | `string` | ✓ | — | Survey-node ID |
| `--no-duplicate-check` | `boolean` |  | `true` | Skip duplicate sends |
| `--link-tracking` | `boolean` |  | `false` | Track link clicks |
| `--skip-on-unavailable-tokens` | `boolean` |  | `false` | Skip when tokens missing |
| `--no-send-default-template` | `boolean` |  | `true` | Fall back to default variant |
| `--log-to-timeline` | `boolean` |  | `false` | Log to Gainsight timeline |
| `--group-email` | `boolean` |  | `false` | Group email mode |
| `--no-add-unsubscribe-footer` | `boolean` |  | `true` | Add unsubscribe footer |
| `--no-send-text-content` | `boolean` |  | `true` | Include plain-text body |
| `--no-transactional` | `boolean` |  | `true` | Mark as transactional |
| `--log-to-ms-dynamics` | `boolean` |  | `false` | Log to MS Dynamics |

**Examples**

```bash
gs-admin jo p n s set-flags --id <program-id> --node-id <node-id>
```

### `gs-admin journey programs nodes survey set-global-headers`
*Short form:* `gs-admin jo p n s set-global-headers`
*Path:* Program operations › Build nodes in the program flow › Survey-email node operations

Set or update global email headers on a survey node (partial merge)

Same merge semantics as the email-node version. Sets emailInfo.emailHeaders.

**MCP tool:** `journey_set_survey_node_global_headers` · **Mutating:** yes ⚠️ · **Output:** `detail`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |
| `--node-id` | `string` | ✓ | — | Survey-node ID |
| `--from-name` | `string` |  | — | Sender display name (string or 'field:<id>') |
| `--from-email` | `string` |  | — | Sender email (string or 'field:<id>') |
| `--reply-to` | `string` |  | — | Reply-to (string or field:<id>) |
| `--recipient-field` | `string` |  | — | Recipient field reference (default field:recipientEmailAddress) |
| `--to-name` | `string` |  | — | Recipient display name |
| `--cc` | `boolean` |  | — | Send as CC |

**Examples**

```bash
gs-admin jo p n s set-global-headers --id <program-id> --node-id <node-id>
```

### `gs-admin journey programs nodes survey set-local-headers`
*Short form:* `gs-admin jo p n s set-local-headers`
*Path:* Program operations › Build nodes in the program flow › Survey-email node operations

Set or update per-variant email headers on a survey node (partial merge)

Same merge semantics as the email-node version. Errors if the template has only one variant.

**MCP tool:** `journey_set_survey_node_local_headers` · **Mutating:** yes ⚠️ · **Output:** `detail`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |
| `--node-id` | `string` | ✓ | — | Survey-node ID |
| `--variant-template-id` | `string` |  | — | Variant template UUID (defaults to default variant) |
| `--from-name` | `string` |  | — | Sender display name (string or 'field:<id>') |
| `--from-email` | `string` |  | — | Sender email (string or 'field:<id>') |
| `--reply-to` | `string` |  | — | Reply-to (string or field:<id>) |
| `--recipient-field` | `string` |  | — | Recipient field reference (default field:recipientEmailAddress) |
| `--to-name` | `string` |  | — | Recipient display name |
| `--cc` | `boolean` |  | — | Send as CC |

**Examples**

```bash
gs-admin jo p n s set-local-headers --id <program-id> --node-id <node-id>
```

### `gs-admin journey programs nodes survey set-survey`
*Short form:* `gs-admin jo p n s set-survey`
*Path:* Program operations › Build nodes in the program flow › Survey-email node operations

Attach a survey + pick the inline question + (optional) context field

Validates the surveyId, optionally picks an inlineQuestionId (auto-picked when survey has only one), enforces --context-id when the survey is transactional. Stores under globalConfigInfo.surveyInfo.

**MCP tool:** `journey_set_survey_node_survey` · **Mutating:** yes ⚠️ · **Output:** `detail` · **Endpoint(s):** `GET /v1/surveys/{{surveyId}}/questions/inline` _(fetchSurvey)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |
| `--node-id` | `string` | ✓ | — | Survey-node ID |
| `--survey-id` | `string` | ✓ | — | Survey GUID |
| `--inline-question-id` | `string` |  | — | Inline question to render (required when survey has multiple inline questions) |
| `--inline-question-template-id` | `string` |  | `"template1"` | Inline-question rendering template |
| `--context-id` | `string` |  | — | Context field id (standard or in customFieldsMeta) — required for transactional surveys |

**Examples**

```bash
gs-admin jo p n s set-survey --id <program-id> --node-id <node-id> --survey-id <survey-id>
```

### `gs-admin journey programs nodes survey set-template`
*Short form:* `gs-admin jo p n s set-template`
*Path:* Program operations › Build nodes in the program flow › Survey-email node operations

Attach a template to the survey node

Mandatory before headers/tokens. Fetches the email template, builds variantMappings (one per variant). Surfaces whether the template carries inline-survey tokens.

**MCP tool:** `journey_set_survey_node_template` · **Mutating:** yes ⚠️ · **Output:** `detail` · **Endpoint(s):** `GET /v1/api/templates/{{templateId}}` _(fetchTemplate)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |
| `--node-id` | `string` | ✓ | — | Survey-node ID returned by create |
| `--template-id` | `string` | ✓ | — | Email template UUID |

**Examples**

```bash
gs-admin jo p n s set-template --id <program-id> --node-id <node-id> --template-id <template-id>
```

### `gs-admin journey programs pause`
*Short form:* `gs-admin jo p pause`
*Path:* Program operations

Pause a running program (PROCESSING → PAUSE)

Halts a program currently in PROCESSING state. Fetches the program first to verify status — refuses with a clear error if the program is in any state other than PROCESSING (e.g. already PAUSE, STOP, or DRAFT). Cache is intentionally NOT touched; pause is a runtime control, so any queued design mutations remain valid for a later save. POSTs to /v1/journey/program/changeStatus with advancedOutreachStatus=PAUSE.

**MCP tool:** `journey_pause_program` · **Mutating:** yes ⚠️ · **Output:** `detail`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |

**Examples**

```bash
gs-admin jo p pause --id <program-id>
```

### `gs-admin journey programs publish`
*Short form:* `gs-admin jo p publish`
*Path:* Program operations

Publish a program

STEP 4/4 of program creation. Publishes immediately. Set wait=true to poll until validated and published.

**MCP tool:** `journey_publish_program` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `POST /v1/journey/program/execute` _(publish)_, `POST /v1/journey/program/joprocess/status/{{programId}}` _(joprocessStatus)_, `POST /v1/journey/program/{{programId}}/fetch` _(fetch)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Program ID (GUID) |
| `--wait` | `boolean` |  | `false` | Wait for publish to complete |
| `--max-wait` | `integer` |  | `60` | Max seconds to wait |

**Examples**

```bash
gs-admin jo p publish --id <program-id>
```

### `gs-admin journey programs publish-status`
*Short form:* `gs-admin jo p publish-status`
*Path:* Program operations

Get publish status for a program

**MCP tool:** `journey_publish_status` · **Mutating:** no · **Output:** `detail` · **Endpoint(s):** `GET /v1/journey/program/publishStatus/{{programId}}`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Program ID (GUID) |

**Examples**

```bash
gs-admin jo p publish-status --id <program-id>
```

### `gs-admin journey programs resume`
*Short form:* `gs-admin jo p resume`
*Path:* Program operations

Resume a paused program (PAUSE → PROCESSING), auto-saves cached mutations first

Resumes a paused program. Fetches the program first to verify the current state is PAUSE — refuses otherwise. By default, any pending cached mutations are auto-saved to the BE before the resume call (analogous to publish's validate→save→publish chain, minus validate). Pass --without-update to skip the save step and just change the runtime status; cached mutations are left in place for a later 'jo p save'. POSTs to /v1/journey/program/changeStatus with advancedOutreachStatus=PROCESSING.

**MCP tool:** `journey_resume_program` · **Mutating:** yes ⚠️ · **Output:** `detail`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |
| `--without-update` | `boolean` |  | `false` | Skip the auto-save step. Default is to save any pending cached mutations before changing status. |

**Examples**

```bash
gs-admin jo p resume --id <program-id>
```

### `gs-admin journey programs save`
*Short form:* `gs-admin jo p save`
*Path:* Program operations

Commit all cached mutations for a program to the BE in one save

JO mutations always buffer in a local cache; this command pushes the entire working state to the BE in one round-trip. Called automatically by 'jo p publish' (after validate); call it manually whenever you want to commit changes without publishing. On success the cache file is deleted. If the BE returns AO_DOCUMENT_VERSION_MISMATCH (another actor saved the program since cache start), the cache is hard-reset: pending mutations are dropped and the cache is refreshed with the BE's latest state. The dropped-mutation log is returned so the agent can replay if needed. Other BE errors leave the cache untouched.

**MCP tool:** `journey_save_program` · **Mutating:** yes ⚠️ · **Output:** `detail`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID (GUID) |

**Examples**

```bash
gs-admin jo p save --id <program-id>
```

### `gs-admin journey programs sources csv-save`
*Short form:* `gs-admin jo p src csv-save`
*Path:* Program operations › Participant source operations

Attach a CSV participant source to a program (program must have no existing sources)

**MCP tool:** `journey_save_csv_source` · **Mutating:** yes ⚠️ · **Output:** `detail`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Program ID (GUID) |
| `--csv-name` | `string` | ✓ | — | CSV file name (used as source name and collection ID) |
| `--csv-headers` | `string` | ✓ | — | Comma-separated CSV column headers |
| `--s3-url` | `string` | ✓ | — | S3 URL of the uploaded CSV |

**Examples**

```bash
gs-admin jo p src csv-save --id <program-id> --csv-name <csv-name> --csv-headers <csv-headers> --s3-url <s3-url>
```

### `gs-admin journey programs sources csv-setup`
*Short form:* `gs-admin jo p src csv-setup`
*Path:* Program operations › Participant source operations

Upload CSV, attach as source, map columns, and optionally set unique criteria in one step

**MCP tool:** `journey_setup_csv_source` · **Mutating:** yes ⚠️ · **Output:** `detail` · **Endpoint(s):** `POST /v1/api/participant/uploadCSV` _(uploadCsv)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Program ID (GUID) |
| `--file` | `string` | ✓ | — | Path to CSV file |
| `--standard-mapping` | `string` | ✓ | — | Pairs: gsAccountId,col,recipientEmailAddress,col[,gsPersonId,col] |
| `--unique-ids` | `string` |  | — | Optional. Comma-separated fieldIds to use as unique criteria; omit to leave uniqueCriteria empty |

**Examples**

```bash
gs-admin jo p src csv-setup --id <program-id> --file <file> --standard-mapping <standard-mapping>
```

### `gs-admin journey programs sources dd-save`
*Short form:* `gs-admin jo p src dd-save`
*Path:* Program operations › Participant source operations

Attach a Data Designer (DD/UDS) participant source to a program (program must have no existing sources)

**MCP tool:** `journey_save_dd_source` · **Mutating:** no · **Output:** `detail` · **Endpoint(s):** `GET /v1/journey/object/describe/{{objectName}}` _(describe)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Program ID (GUID) |
| `--object-name` | `string` | ✓ | — | Data Designer object name (collection ID) |
| `--source-name` | `string` |  | — | Optional. User-facing source label. Defaults to the DD object's display label (from describe), or objectName if describe has no label. |

**Examples**

```bash
gs-admin jo p src dd-save --id <program-id> --object-name <object-name>
```

### `gs-admin journey programs sources dd-setup`
*Short form:* `gs-admin jo p src dd-setup`
*Path:* Program operations › Participant source operations

One-shot: attach a Data Designer source, map columns, and optionally set unique criteria

**MCP tool:** `journey_setup_dd_source` · **Mutating:** no · **Output:** `detail` · **Endpoint(s):** `GET /v1/journey/object/describe/{{objectName}}` _(describe)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Program ID (GUID) |
| `--object-name` | `string` | ✓ | — | Data Designer object name |
| `--source-name` | `string` |  | — | Optional. User-facing source label. Defaults to the DD object's display label (from describe), or objectName if describe has no label. |
| `--standard-mapping` | `string` | ✓ | — | Pairs: gsAccountId,ddCol,recipientEmailAddress,ddCol[,gsPersonId,ddCol] |
| `--unique-ids` | `string` |  | — | Optional. Comma-separated fieldIds to use as unique criteria |

**Examples**

```bash
gs-admin jo p src dd-setup --id <program-id> --object-name <object-name> --standard-mapping <standard-mapping>
```

### `gs-admin journey programs sources describe`
*Short form:* `gs-admin jo p src describe`
*Path:* Program operations › Participant source operations

Show the participant source attached to a program (works for CSV and DD sources)

**MCP tool:** `journey_describe_program_source` · **Mutating:** no · **Output:** `detail`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Program ID (GUID) |

**Examples**

```bash
gs-admin jo p src describe --id <program-id>
```

### `gs-admin journey programs sources map`
*Short form:* `gs-admin jo p src map`
*Path:* Program operations › Participant source operations

Set column mapping for a participant source (auto-detects CSV vs Data Designer)

**MCP tool:** `journey_save_mapping` · **Mutating:** yes ⚠️ · **Output:** `detail` · **Endpoint(s):** `GET /v1/journey/object/describe/{{objectName}}` _(describe)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Program ID (GUID) |
| `--source-id` | `string` | ✓ | — | participantSourceConfigurationId (from `jo p src describe`) |
| `--standard-mapping` | `string` | ✓ | — | Pairs: gsAccountId,col,recipientEmailAddress,col[,gsPersonId,col] — column names refer to CSV headers or DD field labels depending on the source type |

**Examples**

```bash
gs-admin jo p src map --id <program-id> --source-id <source-id> --standard-mapping <standard-mapping>
```

### `gs-admin journey programs sources unique-criteria`
*Short form:* `gs-admin jo p src unique-criteria`
*Path:* Program operations › Participant source operations

Set uniqueCriteria for a program (fields used to deduplicate participants)

**MCP tool:** `journey_save_unique_criteria` · **Mutating:** yes ⚠️ · **Output:** `detail`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Program ID (GUID) |
| `--unique-ids` | `string` | ✓ | — | Comma-separated field IDs (standard or custom) to use as unique criteria |

**Examples**

```bash
gs-admin jo p src unique-criteria --id <program-id> --unique-ids <unique-ids>
```

### `gs-admin journey programs sources upload-csv`
*Short form:* `gs-admin jo p src upload-csv`
*Path:* Program operations › Participant source operations

Upload a CSV file as participants

**MCP tool:** `journey_upload_csv_participants` · **Mutating:** yes ⚠️ · **Output:** `detail` · **Endpoint(s):** `POST /v1/api/participant/uploadCSV` _(uploadCsv)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Program ID (GUID) |
| `--file` | `string` |  | — | Path to CSV file |
| `--csv-content` | `string` |  | — | Raw CSV content |
| `--filename` | `string` |  | `"upload.csv"` | Upload filename |
| `--entity-type` | `string` |  | `"CUSTOMER"` | Entity type One of: `CUSTOMER`, `RELATIONSHIP`, `USER`. |

**Examples**

```bash
gs-admin jo p src upload-csv --id <program-id>
```

### `gs-admin journey programs stop`
*Short form:* `gs-admin jo p stop`
*Path:* Program operations

Stop a program (PROCESSING|PAUSE → STOP) — terminates execution

Terminates a program in PROCESSING or PAUSE state. Fetches the program first to verify status. Cache is intentionally NOT touched — stop is irreversible at the BE level, but the user's queued design mutations may still be useful (e.g. to clone into a new program); 'jo p cache discard' is the explicit teardown. Emits a stderr warning when cached mutations are unsaved at stop time. POSTs to /v1/journey/program/changeStatus with advancedOutreachStatus=STOP.

**MCP tool:** `journey_stop_program` · **Mutating:** yes ⚠️ · **Output:** `detail`

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID |

**Examples**

```bash
gs-admin jo p stop --id <program-id>
```

### `gs-admin journey programs validate`
*Short form:* `gs-admin jo p validate`
*Path:* Program operations

Run all pre-publish validations against a Dynamic Program (read-only — no mutation)

Read-only validator that runs every pre-publish rule and returns a structured issue list. Called automatically by `jo p publish` before save; can also be invoked manually as a pre-flight check. Rules currently checked: (1) mandatory standard fields gsAccountId + recipientEmailAddress mapped to source columns, (2) uniqueCriteria present and resolvable, (3) exclusion-list identifier exists in CSV headers, (4) every email/survey node's STANDARD tokens are mapped to known fields, (5) every email/survey node's recipientField/fromEmail/fromName headers are present + valid (email-format check on VALUE shape, fieldId resolve check on FIELD shape, applies to both global and local headers), (6) every node's emailTemplateId still resolves on the BE, (7) every survey node's SURVEY tokens are mapped, surveyId resolves, inline-survey questionId is set when needed, transactional surveys have a contextId, (8) no node is unconnected (every non-START node has at least one inbound real edge; every CLOSE_CTA reaches its paired CREATE_CTA), (9) every CREATE_CTA node has typeId + defaultOwnerId set, (10) program has at least one non-START node. Future rules will be added to the same array — extending is one-line. Returns { status: 'ok'|'fail', issueCount, issues, rules } so an agent can stop publishing on errors and surface warnings without blocking.

**MCP tool:** `journey_validate` · **Mutating:** no · **Output:** `detail` · **Endpoint(s):** `POST /v1/journey/program/{{programId}}/fetch` _(fetchProgram)_, `GET /v1/api/templates/{{templateId}}` _(fetchTemplate)_, `GET /v1/surveys/{{surveyId}}/questions/inline?langId=all` _(fetchSurvey)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Dynamic Program ID (GUID) |
| `--skip-remote-fetches` | `boolean` |  | `false` | Skip rules that require live API fetches (templates / surveys). Useful for fast pre-flight in CI; defaults to false so a real publish-readiness check covers everything. |
| `--no-cache` | `boolean` |  | `true` | Validate against the cached WORKING state when one exists. Pass --no-cache to bypass and fetch fresh from BE. |

**Examples**

```bash
gs-admin jo p validate --id <program-id>
```

### `gs-admin journey surveys get`
*Short form:* `gs-admin jo s get`
*Path:* Survey assets

Fetch survey details — inline questions and supported languages

**MCP tool:** `journey_get_survey` · **Mutating:** no · **Output:** `detail` · **Endpoint(s):** `GET /v1/surveys/{{surveyId}}/questions/inline` _(fetchSurvey)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` | ✓ | — | Survey GUID |

**Examples**

```bash
gs-admin jo s get --id <survey-id>
```

### `gs-admin journey surveys list`
*Short form:* `gs-admin jo s list`
*Path:* Survey assets

List available surveys (PUBLISH state, DISTRIBUTE action)

**MCP tool:** `journey_list_surveys` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `POST /v1/surveys/list` _(list)_

**Flags**

_No flags._

**Examples**

```bash
gs-admin jo s list
```

