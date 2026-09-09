<!-- GENERATED FILE — do not edit by hand. Regenerate with: npm run build:reference (build/build-reference.mjs). -->

# Data Designer (`data-designer` / `dd`)

Data Designer — Design Templates (data preparation flows)

**10 commands.** 

| Command | Summary | MCP tool |
|---------|---------|----------|
| [`gs-admin data-designer sources fields`](#gs-admin-data-designer-sources-fields) | List fields available on a source object | `data_designer_list_source_fields` |
| [`gs-admin data-designer sources list`](#gs-admin-data-designer-sources-list) | List available data source connections | `data_designer_list_source_connections` |
| [`gs-admin data-designer sources objects`](#gs-admin-data-designer-sources-objects) | List objects available in a source connection | `data_designer_list_source_objects` |
| [`gs-admin data-designer templates add-task`](#gs-admin-data-designer-templates-add-task) | Add a task (extract or merge) to a Design Template | `data_designer_add_task` |
| [`gs-admin data-designer templates create`](#gs-admin-data-designer-templates-create) | Create a Design Template (Step 1 — basic details) | `data_designer_create_template` |
| [`gs-admin data-designer templates delete`](#gs-admin-data-designer-templates-delete) | Delete a Design Template | `data_designer_delete_template` |
| [`gs-admin data-designer templates describe`](#gs-admin-data-designer-templates-describe) | Describe a Design Template (header + tasks) | `data_designer_describe_template` |
| [`gs-admin data-designer templates edit-task`](#gs-admin-data-designer-templates-edit-task) | Edit an existing extract task on a Design Template | `data_designer_edit_task` |
| [`gs-admin data-designer templates list`](#gs-admin-data-designer-templates-list) | List Design Templates | `data_designer_list_templates` |
| [`gs-admin data-designer templates preview`](#gs-admin-data-designer-templates-preview) | Preview sample output for one or more tasks | `data_designer_preview_task_outputs` |

---

### `gs-admin data-designer sources fields`
*Short form:* `gs-admin dd sources fields`
*Path:* Source connection / object / field discovery (Data Designer)

List fields available on a source object

List the fields exposed by a source object (MDA, SFDC, or SNOWFLAKE). Use this BEFORE drafting a task spec file to discover the exact field names, labels, and data types — including which fields are LOOKUP (eligible for dot-notation paths). Provide --object-name OR walk a lookup chain via --lookup-from + --lookup-field (e.g. `--lookup-from company --lookup-field Csm` returns the User object's fields). Tenant-wide. Identical surface to `re r sources fields`.

**MCP tool:** `data_designer_list_source_fields` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v1/api/reporting/describe/{{type}}/{{objectName}}` _(fetch)_, `GET /v1/bionicreporting/describe/{{type}}/{{objectName}}` _(fetchWarehouse)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--type` | `string` | ✓ | — | Source connection type One of: `MDA`, `SFDC`, `SNOWFLAKE`. |
| `--object-name` | `string` |  | — | Technical object name (e.g. 'company', 'Account'). Provide this OR --lookup-from + --lookup-field. |
| `--lookup-from` | `string` |  | — | Parent object name to start the lookup walk from (e.g. 'company'). Used together with --lookup-field. |
| `--lookup-field` | `string` |  | — | Dot-separated chain of lookup field names to walk from --lookup-from. E.g. 'Csm' (1 hop, returns User fields) or 'Csm.Manager' (2 hops). Max 2 hops. |
| `--connection-id` | `string` |  | — | Connection ID (defaults to the type itself for MDA) |
| `--connection-name` | `string` |  | — | Connection name — alternative to --connection-id; resolved against `dd sources list` (exact match, else case-insensitive contains). |
| `--name` | `string` |  | — | Filter by field name or label (case-insensitive contains) |
| `--limit` | `integer` |  | — | Max number of fields to return |

**Examples**

```bash
gs-admin dd sources fields --type <type>
```

### `gs-admin data-designer sources list`
*Short form:* `gs-admin dd sources list`
*Path:* Source connection / object / field discovery (Data Designer)

List available data source connections

List configured data source connections (MDA, SFDC, SNOWFLAKE, …). Tenant-wide; used by `dd t add-task` and any future Data Designer surface. Identical surface to `re r sources list`.

**MCP tool:** `data_designer_list_source_connections` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v1/bionicreporting/config-ui/listsources` _(fetch)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--type` | `string` |  | — | Filter by connection type (MDA, SFDC, SNOWFLAKE, …) |
| `--limit` | `integer` |  | — | Max number of connections to return |

**Examples**

```bash
gs-admin dd sources list
```

### `gs-admin data-designer sources objects`
*Short form:* `gs-admin dd sources objects`
*Path:* Source connection / object / field discovery (Data Designer)

List objects available in a source connection

List source objects exposed by a connection (MDA, SFDC, or SNOWFLAKE). Required: --type. Optional: --connection-id, --name filter. Tenant-wide. Identical surface to `re r sources objects`.

**MCP tool:** `data_designer_list_source_objects` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v1/api/describe/listobjects/{{type}}` _(fetch)_, `GET /v1/bionicreporting/describe/listobjects/{{type}}` _(fetchWarehouse)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--type` | `string` | ✓ | — | Source connection type One of: `MDA`, `SFDC`, `SNOWFLAKE`. |
| `--connection-id` | `string` |  | — | Connection ID (defaults to the type itself for MDA) |
| `--connection-name` | `string` |  | — | Connection name — alternative to --connection-id; resolved against `dd sources list` (exact match, else case-insensitive contains). |
| `--name` | `string` |  | — | Filter by object name or label (case-insensitive contains) |
| `--limit` | `integer` |  | — | Max number of objects to return |

**Examples**

```bash
gs-admin dd sources objects --type <type>
```

### `gs-admin data-designer templates add-task`
*Short form:* `gs-admin dd t add-task`
*Path:* Design Template operations

Add a task (extract or merge) to a Design Template

Add a task to a Design Template via inline flags (preferred) OR a JSON spec file. INLINE mode: --type <type> + --name <name> + (extract: --object-name + --field … --filter …) or (merge: --left-task-id + --join … --field 'taskId:field'). FILE mode: --task-spec-file <path>. Pick one mode; passing both errors. Inline --field uses '<expr>[=<alias>]' for extract (expr can be a 'A -> B' lookup chain); '<taskId>:<field>[=<alias>]' for merge. Inline --join uses '<followerTaskId>:<joinType>:<l>=<r>,…' (use '~' for case-insensitive equality, '=' for case-sensitive). EXTRACT types fully wired: mdaExtract, sfdcExtract, s3Extract, snowflakeExtract. Aliases: MDA→mdaExtract, SFDC→sfdcExtract, S3→s3Extract, SNOWFLAKE→snowflakeExtract, merge→join. Per-type capability matrix gates which keys are allowed (e.g. s3Extract rejects groupBy/filters).

**MCP tool:** `data_designer_add_task` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `PUT /v1/bionicreporting/designTemplates/{{templateId}}/task` _(update)_, `GET /v1/bionicreporting/designTemplates/{{templateId}}/tasks` _(tasks)_, `GET /v1/bionicreporting/designTemplates/{{templateId}}` _(header)_, `GET /v1/api/reporting/describe/{{type}}/{{objectName}}` _(describeSourceObject)_, `GET /v1/bionicreporting/describe/{{type}}/{{objectName}}` _(describeSourceObjectWarehouse)_, `GET /v1/api/connector/connection/S3/all` _(listS3Connections)_, `POST /v1/bionicreporting/file-browser/browse` _(browseS3Files)_, `POST /v1/bionicreporting/file-browser/describe` _(describeS3File)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--template-id` | `string` |  | — | Template ID |
| `--template-name` | `string` |  | — | Template name — searches list and picks first match |
| `--task-spec-file` | `string` |  | — | FILE MODE: path to a JSON spec file. Mutually exclusive with --type/--name/--field/etc. |
| `--type` | `string` |  | — | INLINE: task type (mda, sfdc, merge, …). Drives the capability matrix. |
| `--name` | `string` |  | — | INLINE: task name shown in the DAG (e.g. "Company"). |
| `--task-id` | `string` |  | — | INLINE: explicit task ID like t5 (auto-assigned when omitted). |
| `--object-name` | `string` |  | — | INLINE (extract): source object name (e.g. company, Account). For S3, pass the S3 key — may include a folder prefix (e.g. "folder1/2024/accounts.csv"); the CLI splits the trailing filename from the folder path automatically. |
| `--connection-id` | `string` |  | — | INLINE (extract): connection ID — for SFDC tenants with multiple connections. |
| `--connection-name` | `string` |  | — | INLINE (extract): alternative to --connection-id; resolved against `dd sources list`. |
| `--left-task-id` | `string` |  | — | INLINE (merge): driver task ID (e.g. t1). |
| `--field` | `array` |  | — | INLINE: repeatable. Extract: '<expr>[=<alias>][:<aggregation>]' (expr supports 'A -> B' lookup chains; aggregation is COUNT, COUNT_DISTINCT, SUM, AVG, MIN, MAX). Merge: '<taskId>:<field>[=<alias>][:<aggregation>]'. When --group-by is set, all non-grouped fields must declare an aggregation. |
| `--group-by` | `array` |  | — | INLINE: repeatable. Each entry must also appear in --field. |
| `--filter` | `array` |  | — | INLINE: repeatable. Format: 'alias:field:operator[:value]' (same as `re r add-criteria`). |
| `--filter-expression` | `string` |  | — | INLINE: required when 2+ --filter; e.g. 'A AND B'. |
| `--join` | `array` |  | — | INLINE (merge): repeatable. Format: '<followerTaskId>:<joinType>:<cond1>,<cond2>,…' where each cond is '<l>=<r>' (case-sensitive) or '<l>~<r>' (case-insensitive). |
| `--task-description` | `string` |  | — | INLINE: optional task description. |
| `--cascade-add` | `boolean` |  | `false` | Cascade newly-added fields to sibling tasks |
| `--cascade-delete` | `boolean` |  | `false` | Cascade field deletions to sibling tasks |
| `--cascade-lookups` | `boolean` |  | `true` | Expand lookup relationships across the DAG (default true) |
| `--position-x` | `integer` |  | — | DAG layout X position (auto-computed when omitted) |
| `--position-y` | `integer` |  | — | DAG layout Y position (auto-computed when omitted) |
| `--delimiter` | `string` |  | — | INLINE (S3 only): CSV field delimiter (COMMA, TAB, PIPE, SEMICOLON). Default: COMMA. |
| `--encoding` | `string` |  | — | INLINE (S3 only): file encoding (UTF-8, ISO-8859-1, …). Default: UTF-8. |
| `--quote-char` | `string` |  | — | INLINE (S3 only): quote character (DOUBLE_QUOTE, SINGLE_QUOTE). Default: DOUBLE_QUOTE. |
| `--escape-char` | `string` |  | — | INLINE (S3 only): escape character (SINGLE_QUOTE, DOUBLE_QUOTE, BACKSLASH). Default: SINGLE_QUOTE. |
| `--date-format` | `string` |  | — | INLINE (S3 only): date format string (e.g. MM/dd/yyyy). Default: MM/dd/yyyy. |
| `--datetime-format` | `string` |  | — | INLINE (S3 only): datetime format string (e.g. MM/dd/yyyy HH:mm:ss). Default: MM/dd/yyyy HH:mm:ss. |
| `--timezone` | `string` |  | — | INLINE (S3 only): timezone ID (e.g. UTC, America/New_York). Default: UTC. |

**Examples**

```bash
gs-admin dd t add-task
```

### `gs-admin data-designer templates create`
*Short form:* `gs-admin dd t create`
*Path:* Design Template operations

Create a Design Template (Step 1 — basic details)

Create a new Design Template shell. Returns the new templateId, which subsequent steps (`dd t add-task`) thread through. Validates: name 3–120 chars, must not start with a digit. Description and folder are optional.

**MCP tool:** `data_designer_create_template` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `POST /v1/bionicreporting/designTemplates` _(create)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--name` | `string` | ✓ | — | Template name (3–120 chars; must not start with a digit) |
| `--description` | `string` |  | — | Template description (optional) |
| `--folder-id` | `string` |  | — | Folder ID (optional; empty when omitted) |

**Examples**

```bash
gs-admin dd t create --name <template-name>
```

### `gs-admin data-designer templates delete`
*Short form:* `gs-admin dd t delete`
*Path:* Design Template operations

Delete a Design Template

Delete a Design Template by ID or name. Requires --yes to confirm (this CLI is non-interactive). DESTRUCTIVE — deletes the template and all its tasks.

**MCP tool:** `data_designer_delete_template` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `DELETE /v1/bionicreporting/designTemplates/{{templateId}}` _(delete)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--template-id` | `string` |  | — | Template ID (from list-templates) |
| `--template-name` | `string` |  | — | Template name — searches list and picks first match |
| `--yes` | `boolean` |  | `false` | Confirm the destructive delete |

**Examples**

```bash
gs-admin dd t delete
```

### `gs-admin data-designer templates describe`
*Short form:* `gs-admin dd t describe`
*Path:* Design Template operations

Describe a Design Template (header + tasks)

Show a Design Template's metadata plus all its tasks (DAG nodes). Provide --template-id (from `dd t list`) or --template-name (case-insensitive contains).

**MCP tool:** `data_designer_describe_template` · **Mutating:** no · **Output:** `detail` · **Endpoint(s):** `GET /v1/bionicreporting/designTemplates/{{templateId}}` _(header)_, `GET /v1/bionicreporting/designTemplates/{{templateId}}/tasks` _(tasks)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--template-id` | `string` |  | — | Template ID (from list-templates) |
| `--template-name` | `string` |  | — | Template name — searches list and picks first match |
| `--task-id` | `string` |  | — | Drill into a specific task (e.g. t1) — shows type-aware Task Detail, join/pivot/union tables, task criteria, and Export-to-S3 config |
| `--pivot-column` | `string` |  | — | For a pivot task, expand one pivot column's conditions by name or # index (requires --task-id targeting a pivot task) |
| `--field` | `string` |  | — | Focus on ONE show field by name/alias/label — shows its metadata and, for a calculated field, the rendered formula. Requires --task-id. |

**Examples**

```bash
gs-admin dd t describe
```

### `gs-admin data-designer templates edit-task`
*Short form:* `gs-admin dd t edit-task`
*Path:* Design Template operations

Edit an existing extract task on a Design Template

Incrementally edit an extract task (MDA / SFDC / SNOWFLAKE / S3) in place — only what you pass changes; everything else is preserved. Identify the task with --task-id (or --task-name). Operations (all repeatable where noted): --add-field '<expr>[=<alias>][:<agg>]', --remove-field <fieldName|alias>, --rename-field '<fieldName|alias>=<newDisplayName>' (label only — fieldAlias is NEVER changed), --set-aggregation '<field>=<AGG|NONE>', --add-filter / --set-filter 'alias:field:op[:value]', --remove-filter <alias>, --clear-filters, --filter-expression 'A AND B', --add-group-by <field>, --clear-group-by, --description <text>. CRITICAL: fieldAlias is the child task's fieldName and is held stable across edits (identity = uiUniqueKey); renaming the display name does not change it. S3 tasks support remove/rename/description only (no add-field/filters/groupBy).

**MCP tool:** `data_designer_edit_task` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `PUT /v1/bionicreporting/designTemplates/{{templateId}}/task` _(update)_, `GET /v1/bionicreporting/designTemplates/{{templateId}}/tasks` _(tasks)_, `GET /v1/bionicreporting/designTemplates/{{templateId}}` _(header)_, `GET /v1/api/reporting/describe/{{type}}/{{objectName}}` _(describeSourceObject)_, `GET /v1/bionicreporting/describe/{{type}}/{{objectName}}` _(describeSourceObjectWarehouse)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--template-id` | `string` |  | — | Template ID |
| `--template-name` | `string` |  | — | Template name — searches list and picks first match |
| `--task-id` | `string` |  | — | Task ID to edit (e.g. t1). Provide this OR --task-name. |
| `--task-name` | `string` |  | — | Task name to edit (resolved against the template's tasks). |
| `--add-field` | `array` |  | — | Repeatable. Add a field: '<expr>[=<alias>][:<aggregation>]' (expr supports 'A -> B' lookup chains on types that allow lookups). New fields get a freshly generated fieldAlias. |
| `--remove-field` | `array` |  | — | Repeatable. Remove a field by source fieldName or current alias/display name. |
| `--rename-field` | `array` |  | — | Repeatable. '<fieldName\|alias>=<newDisplayName>'. Changes the display name only — the fieldAlias is preserved (child tasks stay intact). |
| `--set-aggregation` | `array` |  | — | Repeatable. '<field>=<AGG>' where AGG is COUNT, COUNT_DISTINCT, SUM, AVG, MIN, MAX (or NONE to clear). fieldAlias is preserved. |
| `--add-filter` | `array` |  | — | Repeatable. Add a filter condition: 'alias:field:operator[:value]'. Errors if the alias already exists. |
| `--set-filter` | `array` |  | — | Repeatable. Add or replace the condition with this alias: 'alias:field:operator[:value]'. Use this to change a filter value. |
| `--remove-filter` | `array` |  | — | Repeatable. Remove the filter condition with this alias. |
| `--clear-filters` | `boolean` |  | `false` | Remove all filter conditions from the task. |
| `--filter-expression` | `string` |  | — | Set the boolean filter expression (e.g. 'A AND B'). Required when 2+ conditions remain after edits. |
| `--add-group-by` | `array` |  | — | Repeatable. Move a field into group-by. When group-by is active, every non-grouped field must be aggregated (use --set-aggregation). |
| `--clear-group-by` | `boolean` |  | `false` | Remove all group-by fields (moves them back into the output). |
| `--description` | `string` |  | — | Set the task description. |
| `--cascade-add` | `boolean` |  | `false` | Cascade newly-added fields to sibling tasks |
| `--cascade-delete` | `boolean` |  | `false` | Cascade field deletions to sibling tasks |
| `--cascade-lookups` | `boolean` |  | `true` | Expand lookup relationships across the DAG (default true) |
| `--position-x` | `integer` |  | — | DAG layout X position (preserved when omitted) |
| `--position-y` | `integer` |  | — | DAG layout Y position (preserved when omitted) |

**Examples**

```bash
gs-admin dd t edit-task
```

### `gs-admin data-designer templates list`
*Short form:* `gs-admin dd t list`
*Path:* Design Template operations

List Design Templates

List Design Templates with optional name search. (Endpoint shape may need verification on first live call — best-guess REST pattern.)

**MCP tool:** `data_designer_list_templates` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v1/bionicreporting/designTemplates` _(list)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--name` | `string` |  | — | Filter by template name (case-insensitive contains, applied client-side) |
| `--limit` | `integer` |  | `50` | Max number of templates to return |

**Examples**

```bash
gs-admin dd t list
```

### `gs-admin data-designer templates preview`
*Short form:* `gs-admin dd t preview`
*Path:* Design Template operations

Preview sample output for one or more tasks

Fetch sample data rows for one or more task IDs in a Design Template. Provide --template-id (or --template-name) and --task-id (repeatable; if omitted, all tasks on the template are previewed).

**MCP tool:** `data_designer_preview_task_outputs` · **Mutating:** no · **Output:** `json` · **Endpoint(s):** `GET /v1/bionicreporting/designTemplates/{{templateId}}/tasks` _(tasks)_, `GET /v1/bionicreporting/designTemplates/{{templateId}}` _(header)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--template-id` | `string` |  | — | Template ID |
| `--template-name` | `string` |  | — | Template name — searches list and picks first match |
| `--task-id` | `array` |  | — | Task ID(s) to preview. Repeat --task-id for multiple. Omit to preview all tasks. |
| `--limit` | `integer` |  | `20` | Max sample rows to display per task |

**Examples**

```bash
gs-admin dd t preview
```

