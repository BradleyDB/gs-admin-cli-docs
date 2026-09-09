<!-- GENERATED FILE — do not edit by hand. Regenerate with: npm run build:reference (build/build-reference.mjs). -->

# Rules Engine (`rules-engine` / `re`)

Rules Engine operations

**61 commands.** 

| Command | Summary | MCP tool |
|---------|---------|----------|
| [`gs-admin rules-engine chains debug`](#gs-admin-rules-engine-chains-debug) | Debug a rule chain | `rules_engine_debug_chain` |
| [`gs-admin rules-engine chains delete-schedule`](#gs-admin-rules-engine-chains-delete-schedule) | Delete the schedule for a rule chain | `rules_engine_chain_delete_schedule` |
| [`gs-admin rules-engine chains describe`](#gs-admin-rules-engine-chains-describe) | Describe a rule chain with its tasks | `rules_engine_describe_chain` |
| [`gs-admin rules-engine chains event-curl`](#gs-admin-rules-engine-chains-event-curl) | Show the cURL for a rule chain's event trigger | `rules_engine_chain_event_curl` |
| [`gs-admin rules-engine chains list`](#gs-admin-rules-engine-chains-list) | List rule chains (workflows) | `rules_engine_list_chains` |
| [`gs-admin rules-engine chains schedule-basic`](#gs-admin-rules-engine-chains-schedule-basic) | Set a Basic time-based schedule on a rule chain | `rules_engine_chain_schedule_basic` |
| [`gs-admin rules-engine chains schedule-event`](#gs-admin-rules-engine-chains-schedule-event) | Schedule a rule chain on an Events Framework event | `rules_engine_chain_schedule_event` |
| [`gs-admin rules-engine chains schedule-s3`](#gs-admin-rules-engine-chains-schedule-s3) | Schedule a rule chain on S3 file upload | `rules_engine_chain_schedule_s3` |
| [`gs-admin rules-engine rules add-action close-cta`](#gs-admin-rules-engine-rules-add-action-close-cta) | Add a Close-CTA action to a rule (Step 4 — Close CTA) | `rules_engine_add_rule_action_close_cta` |
| [`gs-admin rules-engine rules add-action cta`](#gs-admin-rules-engine-rules-add-action-cta) | Add a CTA action to a rule (Step 4 — CTA) | `rules_engine_add_rule_action_cta` |
| [`gs-admin rules-engine rules add-action external-action`](#gs-admin-rules-engine-rules-add-action-external-action) | Add an External Action (REST_API callout) onto a rule | `rules_engine_add_rule_action_external_action` |
| [`gs-admin rules-engine rules add-action load-to-company`](#gs-admin-rules-engine-rules-add-action-load-to-company) | Add a Load-to-Company (DATA_SYNC) action to a rule | `rules_engine_add_rule_action_load_to_company` |
| [`gs-admin rules-engine rules add-action load-to-gainsight`](#gs-admin-rules-engine-rules-add-action-load-to-gainsight) | Add a Load-to-Gainsight-Object (DATA_SYNC) action to a rule | `rules_engine_add_rule_action_load_to_gainsight` |
| [`gs-admin rules-engine rules add-action load-to-object`](#gs-admin-rules-engine-rules-add-action-load-to-object) | Add a Load-to-Object (DATA_SYNC) action to a rule | `rules_engine_add_rule_action_load_to_object` |
| [`gs-admin rules-engine rules add-action set-score`](#gs-admin-rules-engine-rules-add-action-set-score) | Add a Set-Score action to a rule (Step 4 — Set Score) | `rules_engine_add_rule_action_set_score` |
| [`gs-admin rules-engine rules add-action success-plan`](#gs-admin-rules-engine-rules-add-action-success-plan) | Add a Success Plan action to a rule (Step 4 — Success Plan) | `rules_engine_add_rule_action_success_plan` |
| [`gs-admin rules-engine rules add-action update-cta`](#gs-admin-rules-engine-rules-add-action-update-cta) | Add an Update-CTA action to a rule (Step 4 — Update CTA) | `rules_engine_add_rule_action_update_cta` |
| [`gs-admin rules-engine rules add-action update-success-plan`](#gs-admin-rules-engine-rules-add-action-update-success-plan) | Add an Update Success Plan action to a rule (Step 4 — Update Success Plan) | `rules_engine_add_rule_action_update_success_plan` |
| [`gs-admin rules-engine rules add-criteria`](#gs-admin-rules-engine-rules-add-criteria) | Add criteria to a rule (Step 3) | `rules_engine_add_rule_criteria` |
| [`gs-admin rules-engine rules create`](#gs-admin-rules-engine-rules-create) | Create a rule (Step 1 — basic details) | `rules_engine_create_rule_basics` |
| [`gs-admin rules-engine rules debug`](#gs-admin-rules-engine-rules-debug) | Debug a Rules Engine rule | `rules_engine_debug_rule` |
| [`gs-admin rules-engine rules delete-action`](#gs-admin-rules-engine-rules-delete-action) | Delete one or more actions from a rule | `rules_engine_delete_rule_action` |
| [`gs-admin rules-engine rules delete-schedule`](#gs-admin-rules-engine-rules-delete-schedule) | Delete the schedule for a rule | `rules_engine_delete_rule_schedule` |
| [`gs-admin rules-engine rules describe`](#gs-admin-rules-engine-rules-describe) | Describe a Rules Engine rule | `rules_engine_describe_rule` |
| [`gs-admin rules-engine rules describe-external-action`](#gs-admin-rules-engine-rules-describe-external-action) | Describe an External Action — target fields, URL, body template | `rules_engine_describe_external_action` |
| [`gs-admin rules-engine rules edit`](#gs-admin-rules-engine-rules-edit) | Edit a rule's basic details (name, description, folder) | `rules_engine_edit_rule_basics` |
| [`gs-admin rules-engine rules edit-action close-cta`](#gs-admin-rules-engine-rules-edit-action-close-cta) | Edit an existing Close-CTA action on a rule | `rules_engine_edit_rule_action_close_cta` |
| [`gs-admin rules-engine rules edit-action cta`](#gs-admin-rules-engine-rules-edit-action-cta) | Edit an existing CTA action on a rule (Step 4 — CTA) | `rules_engine_edit_rule_action_cta` |
| [`gs-admin rules-engine rules edit-action external-action`](#gs-admin-rules-engine-rules-edit-action-external-action) | Edit an existing External Action (REST_API callout) on a rule | `rules_engine_edit_rule_action_external_action` |
| [`gs-admin rules-engine rules edit-action load-to-company`](#gs-admin-rules-engine-rules-edit-action-load-to-company) | Update a Load-to-Company (DATA_SYNC) action on a rule | `rules_engine_edit_rule_action_load_to_company` |
| [`gs-admin rules-engine rules edit-action load-to-gainsight`](#gs-admin-rules-engine-rules-edit-action-load-to-gainsight) | Update a Load-to-Gainsight-Object (DATA_SYNC) action on a rule | `rules_engine_edit_rule_action_load_to_gainsight` |
| [`gs-admin rules-engine rules edit-action set-score`](#gs-admin-rules-engine-rules-edit-action-set-score) | Edit an existing Set-Score action on a rule | `rules_engine_edit_rule_action_set_score` |
| [`gs-admin rules-engine rules edit-action success-plan`](#gs-admin-rules-engine-rules-edit-action-success-plan) | Edit an existing Success Plan action on a rule | `rules_engine_edit_rule_action_success_plan` |
| [`gs-admin rules-engine rules edit-action update-cta`](#gs-admin-rules-engine-rules-edit-action-update-cta) | Edit an existing Update-CTA action on a rule | `rules_engine_edit_rule_action_update_cta` |
| [`gs-admin rules-engine rules edit-action update-success-plan`](#gs-admin-rules-engine-rules-edit-action-update-success-plan) | Edit an existing Update Success Plan action on a rule | `rules_engine_edit_rule_action_update_success_plan` |
| [`gs-admin rules-engine rules event-curl`](#gs-admin-rules-engine-rules-event-curl) | Show the cURL for a rule's event trigger | `rules_engine_event_curl` |
| [`gs-admin rules-engine rules events`](#gs-admin-rules-engine-rules-events) | List events published on a topic | `rules_engine_events` |
| [`gs-admin rules-engine rules execution`](#gs-admin-rules-engine-rules-execution) | Describe a single rule execution (with optional drilldown) | `rules_engine_describe_execution` |
| [`gs-admin rules-engine rules executions`](#gs-admin-rules-engine-rules-executions) | List execution history for a rule | `rules_engine_list_rule_executions` |
| [`gs-admin rules-engine rules folders list`](#gs-admin-rules-engine-rules-folders-list) | List Rules Engine folders | `rules_engine_list_folders` |
| [`gs-admin rules-engine rules list`](#gs-admin-rules-engine-rules-list) | List Rules Engine rules | `rules_engine_list_rules` |
| [`gs-admin rules-engine rules list-and-describe`](#gs-admin-rules-engine-rules-list-and-describe) | List all rules and fetch details for each | `rules_engine_list_and_describe_rules` |
| [`gs-admin rules-engine rules list-external-actions`](#gs-admin-rules-engine-rules-list-external-actions) | List configured External Actions (REST_API callouts) | `rules_engine_list_external_actions` |
| [`gs-admin rules-engine rules list-rest-connections`](#gs-admin-rules-engine-rules-list-rest-connections) | List configured REST_API connections (for External Actions) | `rules_engine_list_rest_connections` |
| [`gs-admin rules-engine rules list-task-outputs`](#gs-admin-rules-engine-rules-list-task-outputs) | List a rule's source fields — available for criteria and action mappings | `rules_engine_list_task_outputs` |
| [`gs-admin rules-engine rules relationship-types list`](#gs-admin-rules-engine-rules-relationship-types-list) | List relationship types | `rules_engine_list_relationship_types` |
| [`gs-admin rules-engine rules run-now`](#gs-admin-rules-engine-rules-run-now) | Trigger an immediate on-demand run of a rule | `rules_engine_run_now` |
| [`gs-admin rules-engine rules s3-tasks`](#gs-admin-rules-engine-rules-s3-tasks) | List a rule's S3 Dataset tasks | `rules_engine_s3_tasks` |
| [`gs-admin rules-engine rules schedule`](#gs-admin-rules-engine-rules-schedule) | Set or update a CRON schedule for a rule | `rules_engine_schedule_rule` |
| [`gs-admin rules-engine rules schedule-basic`](#gs-admin-rules-engine-rules-schedule-basic) | Set a time-based schedule using the Basic frequency picker | `rules_engine_schedule_rule_basic` |
| [`gs-admin rules-engine rules schedule-event`](#gs-admin-rules-engine-rules-schedule-event) | Schedule a rule on an Events Framework event | `rules_engine_schedule_event` |
| [`gs-admin rules-engine rules schedule-s3`](#gs-admin-rules-engine-rules-schedule-s3) | Schedule a rule on S3 file upload | `rules_engine_schedule_s3` |
| [`gs-admin rules-engine rules schedules`](#gs-admin-rules-engine-rules-schedules) | Show the schedules configured on a rule | `rules_engine_list_rule_schedules` |
| [`gs-admin rules-engine rules set-source`](#gs-admin-rules-engine-rules-set-source) | Set the source object for a rule (Step 2 — SOF) | `rules_engine_set_rule_source` |
| [`gs-admin rules-engine rules set-source-template`](#gs-admin-rules-engine-rules-set-source-template) | Attach a Data Designer template as a rule's source (Step 2 — COMPLEX flow) | `rules_engine_set_rule_source_template` |
| [`gs-admin rules-engine rules sources fields`](#gs-admin-rules-engine-rules-sources-fields) | List fields available on a source object | `rules_engine_list_source_fields` |
| [`gs-admin rules-engine rules sources list`](#gs-admin-rules-engine-rules-sources-list) | List available data source connections | `rules_engine_list_source_connections` |
| [`gs-admin rules-engine rules sources objects`](#gs-admin-rules-engine-rules-sources-objects) | List objects available in a source connection | `rules_engine_list_source_objects` |
| [`gs-admin rules-engine rules templates list`](#gs-admin-rules-engine-rules-templates-list) | List Data Designer templates available to back a rule | `rules_engine_list_design_templates` |
| [`gs-admin rules-engine rules test-schedule`](#gs-admin-rules-engine-rules-test-schedule) | Preview upcoming run times for a CRON expression | `rules_engine_test_schedule` |
| [`gs-admin rules-engine rules topics`](#gs-admin-rules-engine-rules-topics) | List Events Framework topics | `rules_engine_topics` |

---

### `gs-admin rules-engine chains debug`
*Short form:* `gs-admin re c debug`
*Path:* Rule chain operations

Debug a rule chain

Show chain task status (completed/running/pending/failed merged in display order), current execution state, recent run history, and trend metrics. Provide --id (workflowId from `re c list`) or --name. --recent controls how many recent executions to include (1–50, default 5).

**MCP tool:** `rules_engine_debug_chain` · **Mutating:** yes ⚠️ · **Output:** `detail` · **Endpoint(s):** `GET /v1/rulesengine/debug/chain/{{workflowId}}` _(fetch)_, `GET /v1/rulesengine/workflow/all` _(all)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` |  | — | Workflow/chain ID (workflowId from list-chains) |
| `--name` | `string` |  | — | Chain name — searches list and picks first match |
| `--recent` | `integer` |  | `5` | Number of recent executions to include (1–50) |

**Examples**

```bash
gs-admin re c debug
```

### `gs-admin rules-engine chains delete-schedule`
*Short form:* `gs-admin re c delete-schedule`
*Path:* Rule chain operations

Delete the schedule for a rule chain

Remove a rule chain's schedule. Event/S3 subscriptions are removed via event-unsubscribe; a time-based (CRON) schedule via the schedule endpoint. Provide --id (workflowId) or --name.

**MCP tool:** `rules_engine_chain_delete_schedule` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `GET /v1/rulesengine/workflow/all` _(all)_, `GET /v1/api/eventrule/{{workflowId}}/{{jobType}}/schedules` _(eventSchedules)_, `DELETE /v1/api/eventrule/{{workflowId}}/event-unsubscribe` _(eventUnsubscribe)_, `DELETE /v1/api/schedule/jobidentifier/{{workflowId}}` _(deleteTime)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` |  | — | Rule chain GUID / workflowId (from `re c list`) |
| `--name` | `string` |  | — | Rule chain name — searches list and picks first match (exact > contains) |

**Examples**

```bash
gs-admin re c delete-schedule
```

### `gs-admin rules-engine chains describe`
*Short form:* `gs-admin re c describe`
*Path:* Rule chain operations

Describe a rule chain with its tasks

Get full details for a rule chain including all tasks (type, rule ID, order, active status). Provide --id (workflowId from `re chains list`) or --name (searches and picks first match).

**MCP tool:** `rules_engine_describe_chain` · **Mutating:** no · **Output:** `detail` · **Endpoint(s):** `GET /v1/rulesengine/v2/{{ruleId}}` _(ruleDetail)_, `GET /v1/rulesengine/workflow/all` _(all)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` |  | — | Workflow/chain ID (workflowId from list-chains) |
| `--name` | `string` |  | — | Chain name — searches list and picks first match |

**Examples**

```bash
gs-admin re c describe
```

### `gs-admin rules-engine chains event-curl`
*Short form:* `gs-admin re c event-curl`
*Path:* Rule chain operations

Show the cURL for a rule chain's event trigger

Print the cURL command that publishes the Events Framework event a rule chain is subscribed to. Provide --id (workflowId) or --name.

**MCP tool:** `rules_engine_chain_event_curl` · **Mutating:** no · **Output:** `status` · **Endpoint(s):** `GET /v1/rulesengine/workflow/all` _(all)_, `GET /v1/api/eventrule/{{workflowId}}/event-curl` _(eventCurl)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` |  | — | Rule chain GUID / workflowId (from `re c list`) |
| `--name` | `string` |  | — | Rule chain name — searches list and picks first match (exact > contains) |

**Examples**

```bash
gs-admin re c event-curl
```

### `gs-admin rules-engine chains list`
*Short form:* `gs-admin re c list`
*Path:* Rule chain operations

List rule chains (workflows)

List all Rules Engine rule chains with their name, status, task count, last run, and next scheduled run.

**MCP tool:** `rules_engine_list_chains` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v1/rulesengine/workflow/all` _(all)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--page` | `integer` |  | `1` | Page number |
| `--name` | `string` |  | — | Filter by chain name (case-insensitive contains) |
| `--limit` | `integer` |  | — | Max number of results to return |
| `--sort-field` | `string` |  | — | Field to sort by |
| `--sort-dir` | `string` |  | `"DESC"` | Sort direction One of: `ASC`, `DESC`. |

**Examples**

```bash
gs-admin re c list
```

### `gs-admin rules-engine chains schedule-basic`
*Short form:* `gs-admin re c schedule-basic`
*Path:* Rule chain operations

Set a Basic time-based schedule on a rule chain

Saves a Basic time-based schedule for a rule chain (workflow). Rule chains support ONLY the Basic scheduler — the Advanced (raw cron) scheduler is not available for chains, so there is no `re c schedule` counterpart. Provide --id (workflowId) or --name plus --frequency and its options. Required: --frequency (DAILY|WEEKLY|MONTHLY) and --start-time. Time of day: --at HH:mm (default 00:00), OR a repeating window with --from HH:mm --to HH:mm --every-hours N. DAILY: --daily-mode (every-day|every-weekday|every-x-days) and --interval-days for every-x-days. WEEKLY: --days (e.g. MON,WED,FRI). MONTHLY: either --day-of-month (1-31 or L) OR --week-day + --week-number (1-4 or L), with optional --every-months. Optional common flags: --timezone, --end-time, --email, --email-success, --send-email, --skip-write-locks, --past-runs-also. To preview run times use `re r test-schedule`.

**MCP tool:** `rules_engine_chain_schedule_basic` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `GET /v1/rulesengine/workflow/all` _(all)_, `POST /v1/api/rules/schedule/{{workflowId}}` _(schedule)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` |  | — | Rule chain GUID / workflowId (from `re c list`) |
| `--name` | `string` |  | — | Rule chain name — searches list and picks first match (exact > contains) |
| `--frequency` | `string` | ✓ | — | Schedule frequency: DAILY, WEEKLY, or MONTHLY One of: `DAILY`, `WEEKLY`, `MONTHLY`, `daily`, `weekly`, `monthly`. |
| `--at` | `string` |  | — | Run time in 24-hour HH:mm (e.g. 09:30). Default 00:00. Ignored when --from/--to/--every-hours are used. |
| `--from` | `string` |  | — | Repeating window start time HH:mm (use with --to and --every-hours) |
| `--to` | `string` |  | — | Repeating window end time HH:mm (use with --from and --every-hours) |
| `--every-hours` | `integer` |  | — | Repeat every N hours within the --from/--to window. Allowed: 1-6 and must be ≤ the window size in hours (matches the UI's 'Every' options). |
| `--daily-mode` | `string` |  | — | DAILY only: every-day (default), every-weekday (Mon–Fri), or every-x-days (with --interval-days) One of: `every-day`, `every-weekday`, `every-x-days`. |
| `--interval-days` | `integer` |  | — | DAILY every-x-days only: run every N days |
| `--days` | `any` |  | — | WEEKLY only: weekday(s) to run on, e.g. MON,WED,FRI (or repeat --days). Valid: SUN MON TUE WED THU FRI SAT. |
| `--day-of-month` | `string` |  | — | MONTHLY 'particular date': day 1-31, or L for last day of month |
| `--week-day` | `string` |  | — | MONTHLY 'particular weekday': SUN–SAT (use with --week-number) |
| `--week-number` | `string` |  | — | MONTHLY 'particular weekday': which occurrence — 1-4, or L for last (use with --week-day) |
| `--every-months` | `integer` |  | — | MONTHLY only: run every N months (default 1) |
| `--timezone` | `string` |  | — | IANA timezone name (e.g. 'Asia/Kolkata', 'America/New_York'). Defaults to UTC. |
| `--start-time` | `string` | ✓ | — | Schedule window start — ISO date string (e.g. '2025-06-18') or epoch milliseconds |
| `--end-time` | `string` |  | — | Schedule window end — ISO date string (e.g. '2025-12-31') or epoch milliseconds |
| `--past-runs-also` | `boolean` |  | — | If true, also executes for past scheduled times that were missed |
| `--email` | `any` |  | — | Email address(es) to notify on failure. Repeat --email for multiple. Enables email notifications when provided. |
| `--email-success` | `any` |  | — | Email address(es) to notify on success. Repeat --email-success for multiple. |
| `--send-email` | `boolean` |  | — | Explicitly enable or disable email notifications. Auto-enabled when --email or --email-success are provided. |
| `--skip-write-locks` | `boolean` |  | `false` | Run mode: false = Optimise run with other Rules (default); true = Run independent of other Rules |

**Examples**

```bash
gs-admin re c schedule-basic --frequency <frequency> --start-time <start-time>
```

### `gs-admin rules-engine chains schedule-event`
*Short form:* `gs-admin re c schedule-event`
*Path:* Rule chain operations

Schedule a rule chain on an Events Framework event

Subscribe a rule chain (workflow) to an Events Framework event. Provide --id (workflowId) or --name, plus --topic and --event (discover with `re r topics` and `re r events --topic`). Pass --email / --email-success (repeatable) and --send-email to configure notifications.

**MCP tool:** `rules_engine_chain_schedule_event` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `GET /v1/rulesengine/workflow/all` _(all)_, `GET /v1/api/datahighway/events/topics` _(topics)_, `GET /v1/api/datahighway/events/events` _(events)_, `POST /v1/api/eventrule/event-subscribe` _(saveEvent)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` |  | — | Rule chain GUID / workflowId (from `re c list`) |
| `--name` | `string` |  | — | Rule chain name — searches list and picks first match (exact > contains) |
| `--topic` | `string` |  | — | Topic name (from `re r topics`) |
| `--event` | `string` |  | — | Event name (from `re r events --topic "<topic>"`) |
| `--email` | `any` |  | — | Email address(es) to notify on failure. Repeat --email for multiple. Enables email notifications when provided. |
| `--email-success` | `any` |  | — | Email address(es) to notify on success. Repeat --email-success for multiple. |
| `--send-email` | `boolean` |  | — | Explicitly enable email notifications. Auto-enabled when --email or --email-success are provided. |
| `--skip-write-locks` | `boolean` |  | `false` | Run mode: false = optimise run with other rules (default); true = run independent of other rules. |

**Examples**

```bash
gs-admin re c schedule-event
```

### `gs-admin rules-engine chains schedule-s3`
*Short form:* `gs-admin re c schedule-s3`
*Path:* Rule chain operations

Schedule a rule chain on S3 file upload

Trigger a rule chain (workflow) when a file is uploaded to an S3 Dataset task on one of its rules. S3 tasks live on a rule, so provide --rule <ruleId> (a rule in the chain, from `re c describe`) plus --task-id (from `re r s3-tasks --id <ruleId>`). Provide --id (workflowId) or --name for the chain. Pass --email / --email-success (repeatable) and --send-email for notifications.

**MCP tool:** `rules_engine_chain_schedule_s3` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `GET /v1/rulesengine/workflow/all` _(all)_, `GET /v1/rulesengine/v2/{{ruleId}}` _(ruleDetail)_, `GET /v1/bionicreporting/config-ui/{{ddConfigId}}/tasks` _(horizonTasks)_, `GET /v1/rulesengine/{{ruleId}}/tasks` _(bionicTasks)_, `POST /v1/api/eventrule/event-subscribe` _(saveEvent)_, `POST /v2/rulesengine/event-subscribe` _(saveS3)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` |  | — | Rule chain GUID / workflowId (from `re c list`) |
| `--name` | `string` |  | — | Rule chain name — searches list and picks first match (exact > contains) |
| `--rule` | `string` |  | — | Rule GUID within the chain that owns the S3 Dataset task (from `re c describe`). Alternative to --rule-name. |
| `--rule-name` | `string` |  | — | Name of a rule in the chain that owns the S3 Dataset task (from `re c describe`). Resolves to the rule GUID and is verified to be part of the chain. |
| `--task-id` | `string` |  | — | S3 Dataset task ID on the selected rule (from `re r s3-tasks --id <ruleId>`). Alternative to --task-name. |
| `--task-name` | `string` |  | — | S3 Dataset name on the selected rule (from `re r s3-tasks`). Resolves to the task ID; use when the rule has multiple S3 tasks. |
| `--email` | `any` |  | — | Email address(es) to notify on failure. Repeat --email for multiple. Enables email notifications when provided. |
| `--email-success` | `any` |  | — | Email address(es) to notify on success. Repeat --email-success for multiple. |
| `--send-email` | `boolean` |  | — | Explicitly enable email notifications. Auto-enabled when --email or --email-success are provided. |
| `--skip-write-locks` | `boolean` |  | `false` | Run mode: false = optimise run with other rules (default); true = run independent of other rules. |

**Examples**

```bash
gs-admin re c schedule-s3
```

### `gs-admin rules-engine rules add-action close-cta`
*Short form:* `gs-admin re r add-action close-cta`
*Path:* Rule operations › Add a typed action to a rule's task

Add a Close-CTA action to a rule (Step 4 — Close CTA)

Add a CTA_CLOSE action onto a rule's task. Two identification modes:

Mode 1 — closeUsingId=false (identify by type + reason + sources): Required: --type, --status, --reason, --sources, --company-id. --status must be a closed status (Closed Success, Closed No Action, Closed Invalid). --sources is a comma-separated list resolved against `GET /v1/cockpit/cta/ruleSources`.

Mode 2 — closeUsingId=true (identify by a source field that resolves to a CTA GSID): Provide --cta-id naming a field on the rule's source object that has meta.GAINSIGHT.key=GS_CALL_TO_ACTION_ID or looks up to call_to_action. For Company/Account entity rules, --company-id is required. For Relationship entity rules, --relationship-id is required instead. In this mode --type, --status, --reason, and --sources are not needed.

Optional in both modes: --comments (rich-text HTML), --comment-option (default ALWAYS, only applied in Mode 1), --description. Task/criteria scoping: --task-id/--task-name (defaults to t1 for SIMPLE rules), --criteria-id/--criteria-name.

**MCP tool:** `rules_engine_add_rule_action_close_cta` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `PUT /v3/rulesengine/{{ruleId}}/actions` _(update)_, `GET /v1/rulesengine/v2/{{ruleId}}` _(ruleDetail)_, `GET /v1/api/describe/mda/{{objectName}}` _(describeTargetObject)_, `GET /v1/api/reporting/describe/{{type}}/{{objectName}}` _(describeSourceObject)_, `POST /v1/cockpit/admin-v2/types/list` _(ctaTypesList)_, `GET /v1/cockpit/admin/cta/type/{{typeId}}/advancedInfo` _(ctaTypeAdvancedInfo)_, `GET /v1/cockpit/cta/ruleSources` _(ctaRuleSources)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--rule-id` | `string` |  | — | Rule GUID |
| `--rule-name` | `string` |  | — | Rule name — searches list and picks first match (exact > contains) |
| `--type` | `string` |  | — | CTA type — label or GSID. Required when --cta-id is absent. Resolved against `cockpit/admin-v2/types/list`. |
| `--status` | `string` |  | — | CTA close status — label or GSID. Required when --cta-id is absent. Only closed statuses are accepted (openStatusType=false — e.g. Closed Success, Closed No Action, Closed Invalid). Resolved against the chosen type's advancedInfo. |
| `--reason` | `string` |  | — | CTA reason — label or GSID. Required when --cta-id is absent. Resolved against the chosen type's advancedInfo. |
| `--comments` | `string` |  | — | CTA comments (rich-text HTML). Optional in both modes. |
| `--comment-option` | `string` |  | `"ALWAYS"` | When to apply the comment (Mode 1 only, default ALWAYS) One of: `ALWAYS`, `ONCE`, `NEVER`. |
| `--company-id` | `string` |  | — | Required for Company/Account entity rules. Source field on the rule's source object that supplies the company GSID. For an MDA company source, pass 'Gsid'. Supports lookup chains up to 3 hops (e.g. 'CompanyId -> Gsid'). |
| `--relationship-id` | `string` |  | — | Required for Relationship entity rules. Source field that supplies the relationship GSID (mapped to 'relationshipid' on call_to_action). |
| `--cta-id` | `string` |  | — | Optional. Field on the rule's source object that identifies the CTA to close (must have meta.GAINSIGHT.key=GS_CALL_TO_ACTION_ID or look up to call_to_action). When provided, sets closeUsingId=true and makes --type/--status/--reason/--sources unnecessary. |
| `--sources` | `string` |  | — | Comma-separated list of CTA sources to match (e.g. 'Manual,Rules'). Required when --cta-id is absent. Resolved against `GET /v1/cockpit/cta/ruleSources`. |
| `--description` | `string` |  | — | Action description (optional) |
| `--task-id` | `string` |  | — | Task ID to attach the action to (e.g. 't1'). Defaults to 't1' for SIMPLE/SOF rules. Mutually exclusive with --task-name. |
| `--task-name` | `string` |  | — | Task name — alternative to --task-id (case-insensitive). Mutually exclusive with --task-id. |
| `--criteria-id` | `string` |  | — | Optional — scope the action to a specific criteria (e.g. 'c1'). Mutually exclusive with --criteria-name. |
| `--criteria-name` | `string` |  | — | Optional — alternative to --criteria-id (case-insensitive). Mutually exclusive with --criteria-id. |

**Examples**

```bash
gs-admin re r add-action close-cta
```

### `gs-admin rules-engine rules add-action cta`
*Short form:* `gs-admin re r add-action cta`
*Path:* Rule operations › Add a typed action to a rule's task

Add a CTA action to a rule (Step 4 — CTA)

Add a Call-to-Action onto a rule's task. Required: --name, --type, --priority, --status, --reason — all four picklist values accept either a label or a GSID. --type is resolved against `cockpit/admin-v2/types/list`; --priority, --status, --reason are resolved against the chosen type's `cockpit/admin/cta/type/{typeId}/advancedInfo` (so each value is validated to be allowed for that type). Owner and Company are mapped from the rule's source object via --owner-source-field (default 'Csm') and --company-id (default 'Gsid'); both source fields must exist on the rule's configured source object. Optional --playbook accepts a label or GSID; resolved against `cockpit/admin-v2/playbook?ctaTypeId={typeId}&active=true`. CTA params (--due-date-plus-days, --due-date-skip-option, --comment-option, --time-frame-days, --check-open-cta, --do-time-frame-check, --unique-identifier) all carry sensible defaults that match the UI's defaults. For custom call_to_action fields not covered by a semantic flag, use --mapping (repeatable) or --mappings-file: each spec is `targetField=value:<literal>` or `targetField=field:<sourceField>`; reserved target fields (Name, TypeId, PriorityId, StatusId, ReasonId, OwnerId, CompanyId, Comments, PlaybookId) are managed by the corresponding semantic flag and rejected when mapped manually.

**MCP tool:** `rules_engine_add_rule_action_cta` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `PUT /v3/rulesengine/{{ruleId}}/actions` _(update)_, `GET /v1/rulesengine/v2/{{ruleId}}` _(ruleDetail)_, `GET /v1/api/describe/mda/{{objectName}}` _(describeTargetObject)_, `GET /v1/api/reporting/describe/{{type}}/{{objectName}}` _(describeSourceObject)_, `POST /v1/cockpit/admin-v2/types/list` _(ctaTypesList)_, `GET /v1/cockpit/admin/cta/type/{{typeId}}/advancedInfo` _(ctaTypeAdvancedInfo)_, `GET /v1/cockpit/admin-v2/playbook/` _(ctaPlaybookList)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--rule-id` | `string` |  | — | Rule GUID |
| `--rule-name` | `string` |  | — | Rule name — searches list and picks first match (exact > contains) |
| `--name` | `string` | ✓ | — | CTA name (literal value) |
| `--type` | `string` | ✓ | — | CTA type — label (e.g. 'Risk') or GSID. Resolved against `cockpit/admin-v2/types/list`. |
| `--priority` | `string` | ✓ | — | CTA priority — label (e.g. 'High') or GSID. Resolved against the chosen type's advancedInfo. |
| `--status` | `string` | ✓ | — | CTA status — label (e.g. 'New') or GSID. Resolved against the chosen type's advancedInfo. |
| `--reason` | `string` | ✓ | — | CTA reason — label or GSID. Resolved against the chosen type's advancedInfo. |
| `--description` | `string` |  | — | Action description (optional) |
| `--owner-source-field` | `string` |  | — | Optional. Source field on the rule's source object that supplies the CTA owner (a user GSID). Accepts a direct fieldName/label or a lookup chain up to 3 hops (e.g. 'Csm', 'CSM -> GSID'). When omitted, source.field is null but the owner mapping is always written. |
| `--default-owner` | `string` |  | — | Fallback owner user GSID applied when the owner source field is null at runtime |
| `--company-id` | `string` |  | — | Required for Company/Account entity rules. Source field on the rule's source object that supplies the CTA companyId (must resolve to a company GSID). For an MDA company source, pass 'Gsid'. |
| `--comments` | `string` |  | — | CTA comments (rich-text HTML) |
| `--playbook` | `string` |  | — | Playbook — label or GSID. Resolved against `cockpit/admin-v2/playbook?ctaTypeId={typeId}&active=true`. |
| `--due-date-plus-days` | `integer` |  | `5` | Due-date offset in days from rule run (default 5) |
| `--due-date-skip-option` | `string` |  | `"SKIP_ALL_WEEKENDS"` | Weekend handling for the due date One of: `SKIP_ALL_WEEKENDS`, `DO_NOT_SKIP`, `SKIP_SUNDAY`, `SKIP_SATURDAY`. |
| `--comment-option` | `string` |  | `"ALWAYS"` | When to apply the comment One of: `ALWAYS`, `ONCE`, `NEVER`. |
| `--time-frame-days` | `integer` |  | `7` | Time-frame check window in days (default 7) |
| `--check-open-cta` | `boolean` |  | `true` | Skip create when an open CTA already exists for the same identifiers |
| `--do-time-frame-check` | `boolean` |  | `true` | Run the time-frame uniqueness check |
| `--unique-identifier` | `array` |  | — | Field names used as uniqueness keys; repeat the flag (defaults: TypeId, ReasonId, Name) |
| `--task-id` | `string` |  | — | Task ID to attach the action to (e.g. 't1', 't2'). Defaults to 't1' for SIMPLE/SOF rules; required for COMPLEX rules unless --task-name is provided. Mutually exclusive with --task-name. |
| `--task-name` | `string` |  | — | Task name — alternative to --task-id; resolved against the rule's task list (case-insensitive). Mutually exclusive with --task-id. |
| `--criteria-id` | `string` |  | — | Optional — scope the action to a specific criteria within the task (e.g. 'c1', 'c2'). When set, the action runs only when this criteria evaluates true. Mutually exclusive with --criteria-name. |
| `--criteria-name` | `string` |  | — | Optional — alternative to --criteria-id; resolved against the rule's criteriaDetails for the chosen task (case-insensitive). Mutually exclusive with --criteria-id. |
| `--mapping` | `array` |  | — | Extra mapping spec for custom call_to_action fields; repeat the flag. Format: 'TargetField=value:<literal>' or 'TargetField=field:<sourceField>'. The source side accepts the same chain syntax as --owner-source-field, e.g. 'OwnerId=field:CSM -> GSID' (depth ≤ 3). Reserved target fields (Name, TypeId, PriorityId, StatusId, ReasonId, OwnerId, CompanyId, Comments, PlaybookId) are managed via semantic flags and cannot be set here. |
| `--mappings-file` | `string` |  | — | Path to a JSON file with extra mappings. Same shape as --mapping but as objects: [{"target":"FieldName","kind":"value","value":"..."}, {"target":"FieldName","kind":"field","source":"SrcField"}]. Combined with --mapping when both are passed. |
| `--relationship-id` | `string` |  | — | Required for Relationship entity rules. Source field that supplies the relationship GSID (mapped to 'relationshipid' on call_to_action). |

**Examples**

```bash
gs-admin re r add-action cta --name <name> --type <type> --priority <priority> --status <status> --reason <reason>
```

### `gs-admin rules-engine rules add-action external-action`
*Short form:* `gs-admin re r add-action external-action`
*Path:* Rule operations › Add a typed action to a rule's task

Add an External Action (REST_API callout) onto a rule

Attach an External Action (BE actionType REST_API, areaName callExternalAPI) to a rule's task or criteria. The callout itself is defined separately in the Gainsight External Actions admin; this command only wires its target fields up to source fields on the rule's task outputs. Required: --rule-id (or --rule-name), --external-action-id (or --external-action-name), at least one --mapping. Mapping syntax is simple `target=source` (literals are not allowed — the BE substitutes {{target}} tokens in the callout's body with the resolved source value at runtime). Validations: (V1) at least one mapping; (V2) every {{token}} in the callout body/url/headers must be a known field on the callout; (V3) every callout field must be covered by a --mapping; (V4) no duplicate target; (V5) every target must exist on the callout; (V6) every source must exist in the chosen task's output fields; (V7) --connection-id (if given) must match the callout's connection; (V8) deleted callouts are rejected; (V12) --description ≤ 500 chars. Soft warnings (W1–W4) print to stderr for dubious source/target dataType pairings (LOOKUP/GSID → number/boolean, BOOLEAN → number/date, aggregate/formula sources, etc.) but do not block. Action attaches to the task directly when --criteria-id/--criteria-name is omitted; otherwise it sits under that criteria.

**MCP tool:** `rules_engine_add_rule_action_external_action` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `PUT /v3/rulesengine/{{ruleId}}/actions` _(update)_, `GET /v1/rulesengine/v2/{{ruleId}}` _(ruleDetail)_, `GET /v1/api/callout/config/all` _(listCallouts)_, `GET /v2/rulesengine/{{ruleId}}/taskOutputs` _(taskOutputs)_, `GET /v1/api/reporting/describe/{{type}}/{{objectName}}` _(describeSourceObject)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--rule-id` | `string` |  | — | Rule ID (from `re r list`) |
| `--rule-name` | `string` |  | — | Rule name — searches list and picks first match |
| `--external-action-id` | `string` |  | — | Callout configId (from `re r list-external-actions`). Pass this OR --external-action-name. |
| `--external-action-name` | `string` |  | — | Callout display name (case-insensitive). Alternative to --external-action-id. |
| `--connection-id` | `string` |  | — | Optional sanity check — if set, must equal the callout's connectionId. |
| `--connection-name` | `string` |  | — | Optional advisory — currently informational only (use --connection-id for a hard check). |
| `--mapping` | `array` |  | — | Repeatable. Format: `<targetField>=<sourceField>`. Target must exist on the callout; source must exist on the chosen task's outputFields. Every callout field MUST be mapped (V3). |
| `--task-id` | `string` |  | — | Task to attach this action to (e.g. `t1`, `t2`). Auto-defaults to `t1` on SOF rules; required on COMPLEX rules. |
| `--task-name` | `string` |  | — | Alternative to --task-id (resolves against the rule's task list). |
| `--criteria-id` | `string` |  | — | Criteria ID (e.g. `c1`). Omit to attach the action directly to the task instead of nesting under a criteria. |
| `--criteria-name` | `string` |  | — | Alternative to --criteria-id (resolves against criteria on the chosen task). |
| `--description` | `string` |  | — | Optional free-form description (≤ 500 chars). |

**Examples**

```bash
gs-admin re r add-action external-action
```

### `gs-admin rules-engine rules add-action load-to-company`
*Short form:* `gs-admin re r add-action load-to-company`
*Path:* Rule operations › Add a typed action to a rule's task

Add a Load-to-Company (DATA_SYNC) action to a rule

Writes rule results into the Gainsight Company object via a DATA_SYNC action. Describes the Company object from the tenant (GET /v1/api/describe/mda/company) to resolve field names and the object UUID, validates field mappings, and PUTs a DATA_SYNC wire payload with areaName='loadToCompany'. Only UPSERT and UPDATE are supported (INSERT is not allowed). Both require at least one identifier (:id) mapping. Mapping specs: FIELD — 'Target=field:SrcField[:id[:default]]'; VALUE — 'Target=value:val[:type[:id]]' where type in {date,datetime,number,boolean,string}; LOOKUP — 'Target=lookup:IntermediateObjectName[srcAlias->intObjField,...][:firstmatch|markaserror[:nullable|error]]' for LOOKUP/GSID target fields (e.g. user/owner fields). LOOKUP mappings are saved as import-lookup configs first (POST /v1/api/importlookups/createlookup) and the returned importLookUpDetailId is wired into the action.

**MCP tool:** `rules_engine_add_rule_action_load_to_company` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `PUT /v3/rulesengine/{{ruleId}}/actions` _(update)_, `GET /v1/rulesengine/v2/{{ruleId}}` _(ruleDetail)_, `GET /v1/api/describe/mda/company` _(describeCompany)_, `GET /v1/api/reporting/describe/{{type}}/{{objectName}}` _(describeSourceObject)_, `GET /v1/api/describe/listobjects/mda` _(listMdaObjects)_, `GET /v1/api/describe/mda/{{objectName}}` _(describeMdaObject)_, `POST /v1/api/importlookups/createlookup` _(createImportLookup)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--rule-id` | `string` |  | — | Rule GUID |
| `--rule-name` | `string` |  | — | Rule name — searches list and picks first match |
| `--operation` | `string` | ✓ | — | Write mode — INSERT is not supported for Load-to-Company. Both UPSERT and UPDATE require at least one :id identifier mapping. One of: `UPSERT`, `UPDATE`, `upsert`, `update`. |
| `--mapping` | `any` |  | — | Repeatable mapping spec. FIELD: 'Target=field:SrcField[:id[:default]]'. VALUE: 'Target=value:val[:type[:id]]'. |
| `--mappings-file` | `string` |  | — | Path to a JSON file with an array of mapping objects: [{target,kind,source?,identifier?,default?,value?,valueType?}] |
| `--task-id` | `string` |  | — | Task ID (e.g. 't1'). Required for COMPLEX rules; defaults to 't1' for SIMPLE. |
| `--task-name` | `string` |  | — | Task name — fuzzy-matched against the rule's task list |
| `--criteria-id` | `string` |  | — | Criteria ID to scope the action to |
| `--criteria-name` | `string` |  | — | Criteria name — fuzzy-matched within the resolved task |
| `--description` | `string` |  | — | Optional description for this action |

**Examples**

```bash
gs-admin re r add-action load-to-company --operation <operation>
```

### `gs-admin rules-engine rules add-action load-to-gainsight`
*Short form:* `gs-admin re r add-action load-to-gainsight`
*Path:* Rule operations › Add a typed action to a rule's task

Add a Load-to-Gainsight-Object (DATA_SYNC) action to a rule

Writes rule results into any writable Gainsight (MDA) object. Always targets MDA — no --target-type or connection flags needed. Fetches loadable MDA objects, fuzzy-matches --target-object, describes the resolved object, filters out audit fields (GsIngestionSource, GsExecutionId) and formula fields, validates field type compatibility and MDA-specific constraints (GSID mapping rules, max 10 identifiers), then PUTs a DATA_SYNC wire payload with areaName='mda'. Mapping specs: FIELD — 'Target=field:SrcField[:id[:default]]'; VALUE — 'Target=value:val[:type[:id]]' where type in {date,datetime,number,boolean,string}. UPSERT and UPDATE require at least one identifier (:id) mapping. GSID can only be mapped in UPDATE and must always be an identifier.

**MCP tool:** `rules_engine_add_rule_action_load_to_gainsight` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `PUT /v3/rulesengine/{{ruleId}}/actions` _(update)_, `GET /v1/rulesengine/v2/{{ruleId}}` _(ruleDetail)_, `GET /v1/api/rulesloadableobject` _(loadableTargetObjects)_, `GET /v1/api/describe/{{areaName}}/{{objectId}}` _(describeTargetObject)_, `GET /v1/api/reporting/describe/{{type}}/{{objectName}}` _(describeSourceObject)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--rule-id` | `string` |  | — | Rule GUID |
| `--rule-name` | `string` |  | — | Rule name — searches list and picks first match |
| `--target-object` | `string` | ✓ | — | Target Gainsight object name or label — fuzzy-matched against loadable MDA objects |
| `--operation` | `string` | ✓ | — | Write mode. UPSERT and UPDATE require at least one :id identifier mapping. GSID can only be mapped in UPDATE. One of: `INSERT`, `UPSERT`, `UPDATE`, `insert`, `upsert`, `update`. |
| `--mapping` | `any` |  | — | Repeatable mapping spec. FIELD: 'Target=field:SrcField[:id[:default]]'. VALUE: 'Target=value:val[:type[:id]]'. |
| `--mappings-file` | `string` |  | — | Path to a JSON file with an array of mapping objects: [{target,kind,source?,identifier?,default?,value?,valueType?}] |
| `--task-id` | `string` |  | — | Task ID (e.g. 't1'). Required for COMPLEX rules; defaults to 't1' for SIMPLE. |
| `--task-name` | `string` |  | — | Task name — fuzzy-matched against the rule's task list |
| `--criteria-id` | `string` |  | — | Criteria ID to scope the action to |
| `--criteria-name` | `string` |  | — | Criteria name — fuzzy-matched within the resolved task |
| `--description` | `string` |  | — | Optional description for this action |

**Examples**

```bash
gs-admin re r add-action load-to-gainsight --target-object <target-object> --operation <operation>
```

### `gs-admin rules-engine rules add-action load-to-object`
*Short form:* `gs-admin re r add-action load-to-object`
*Path:* Rule operations › Add a typed action to a rule's task

Add a Load-to-Object (DATA_SYNC) action to a rule

Writes rule results into a target object via a configured connection (MDA/Gainsight, SFDC, Databricks, etc.). Resolves the connection by type + name/id, fuzzy-matches the target object from the loadable-objects list, fetches the target describe, validates field mappings, and PUTs a DATA_SYNC wire payload. Mapping specs: FIELD — 'Target=field:SrcField[:id[:default]]'; VALUE — 'Target=value:val[:type[:id]]' where type in {date,datetime,number,boolean,string}. UPSERT and UPDATE require at least one identifier (:id) mapping.

**MCP tool:** `rules_engine_add_rule_action_load_to_object` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `PUT /v3/rulesengine/{{ruleId}}/actions` _(update)_, `GET /v1/rulesengine/v2/{{ruleId}}` _(ruleDetail)_, `GET /v1/api/rulesloadableobject` _(loadableTargetObjects)_, `GET /v1/api/describe/{{areaName}}/{{objectId}}` _(describeTargetObject)_, `GET /v1/api/reporting/describe/{{type}}/{{objectName}}` _(describeSourceObject)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--rule-id` | `string` |  | — | Rule GUID |
| `--rule-name` | `string` |  | — | Rule name — searches list and picks first match |
| `--target-type` | `string` | ✓ | — | Target connection type: MDA, SFDC, DATABRICKS, etc. |
| `--connection-id` | `string` |  | — | Target connection GUID — disambiguates when multiple connections of the same type exist |
| `--connection-name` | `string` |  | — | Target connection name — fuzzy-matched; required when multiple connections of the same type exist |
| `--target-object` | `string` | ✓ | — | Target object name or label — fuzzy-matched against the loadable objects for the resolved connection |
| `--operation` | `string` | ✓ | — | Write mode. UPSERT and UPDATE require at least one :id identifier mapping. One of: `INSERT`, `UPSERT`, `UPDATE`, `insert`, `upsert`, `update`. |
| `--mapping` | `any` |  | — | Repeatable mapping spec. FIELD: 'Target=field:SrcField[:id[:default]]'. VALUE: 'Target=value:val[:type[:id]]'. |
| `--mappings-file` | `string` |  | — | Path to a JSON file with an array of mapping objects: [{target,kind,source?,identifier?,default?,value?,valueType?}] |
| `--task-id` | `string` |  | — | Task ID (e.g. 't1'). Required for COMPLEX rules; defaults to 't1' for SIMPLE. |
| `--task-name` | `string` |  | — | Task name — fuzzy-matched against the rule's task list |
| `--criteria-id` | `string` |  | — | Criteria ID to scope the action to |
| `--criteria-name` | `string` |  | — | Criteria name — fuzzy-matched within the resolved task |
| `--description` | `string` |  | — | Optional description for this action |

**Examples**

```bash
gs-admin re r add-action load-to-object --target-type <target-type> --target-object <target-object> --operation <operation>
```

### `gs-admin rules-engine rules add-action set-score`
*Short form:* `gs-admin re r add-action set-score`
*Path:* Rule operations › Add a typed action to a rule's task

Add a Set-Score action to a rule (Step 4 — Set Score)

Add a Set-Score (SET_SCOREV2) action onto a rule's task. Picks a single measure, then sets a value on one or more scorecards that include that measure. Each scorecard's value is interpreted by its scoring scheme — GRADE accepts 'A'..'F', COLOR accepts 'Red'/'Yellow'/'Green', NUMERIC accepts an integer in the scheme's range (e.g. '85' for a 0-100 scheme). All cockpit picklist values accept either a label or a GSID — measure resolves against `/v1/scorecards/measures/{entityType}/metrics`; scheme values resolve against `/v1/scorecards/schemes` (matched first by `name`, then by `label`, then by `gsid`). The account/relationship identifier is mapped from the rule's source object via --account-id (default 'Gsid'); same chain syntax (`'CSM -> GSID'`, depth ≤ 3) and BE-alias auto-detection as CTA.

**MCP tool:** `rules_engine_add_rule_action_set_score` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `PUT /v3/rulesengine/{{ruleId}}/actions` _(update)_, `GET /v1/rulesengine/v2/{{ruleId}}` _(ruleDetail)_, `GET /v1/api/reporting/describe/{{type}}/{{objectName}}` _(describeSourceObject)_, `GET /v1/scorecards/schemes` _(scorecardSchemes)_, `POST /v1/scorecards/measures/{{entityType}}/metrics` _(scorecardMeasures)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--rule-id` | `string` |  | — | Rule GUID |
| `--rule-name` | `string` |  | — | Rule name — searches list and picks first match (exact > contains) |
| `--measure` | `string` | ✓ | — | Measure (single-select) — label or GSID. Resolved against `/v1/scorecards/measures/{entityType}/metrics` for the rule's entity (ACCOUNT or RELATIONSHIP). |
| `--score` | `array` | ✓ | — | Score spec: 'ScorecardName=Value' (or 'ScorecardGsid=ValueGsid'). Repeat the flag for multi-scorecard. Value is matched against the scorecard's scheme (GRADE: A..F, COLOR: Red/Yellow/Green, NUMERIC: integer in range). Scorecard must be associated with the chosen --measure. |
| `--account-id` | `string` |  | — | Required for Company/Account entity rules. Source field that supplies the account identifier. For an MDA company source, pass 'Gsid'. |
| `--description` | `string` |  | — | Action description (optional) |
| `--task-id` | `string` |  | — | Task ID to attach the action to (e.g. 't1', 't2'). Defaults to 't1' for SIMPLE/SOF rules; required for COMPLEX rules unless --task-name is provided. Mutually exclusive with --task-name. |
| `--task-name` | `string` |  | — | Task name — alternative to --task-id; resolved against the rule's task list (case-insensitive). Mutually exclusive with --task-id. |
| `--criteria-id` | `string` |  | — | Optional — scope the action to a specific criteria within the task (e.g. 'c1', 'c2'). When set, the action runs only when this criteria evaluates true. Mutually exclusive with --criteria-name. |
| `--criteria-name` | `string` |  | — | Optional — alternative to --criteria-id; resolved against the rule's criteriaDetails for the chosen task (case-insensitive). Mutually exclusive with --criteria-id. |
| `--relationship-id` | `string` |  | — | Required for Relationship entity rules. Source field that supplies the relationship GSID (mapped to 'relationship' on the scorecard target object). |

**Examples**

```bash
gs-admin re r add-action set-score --measure <measure> --score <score>
```

### `gs-admin rules-engine rules add-action success-plan`
*Short form:* `gs-admin re r add-action success-plan`
*Path:* Rule operations › Add a typed action to a rule's task

Add a Success Plan action to a rule (Step 4 — Success Plan)

Add a Success Plan (SP_UPSERT) action to a rule's task. Required: --name, --type, --status, --company-id — type is resolved against `successPlan/admin-v2/types/list`; status is resolved from that same response's childPicklists scoped to the chosen type (no extra API call needed). Optional: --default-owner (user GSID written to source.value on the owner mapping; when omitted source.value is saved as []). Optional: --owner-source-field (source field supplying the SP owner; omit to map only the default), --template (label or GSID; type-scoped), --due-date-plus-days (default 5), --due-date-skip-option (default SKIP_ALL_WEEKENDS), --unique-identifier (repeatable; defaults: SuccessPlanTypeId, StatusId, Name).

**MCP tool:** `rules_engine_add_rule_action_success_plan` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `PUT /v3/rulesengine/{{ruleId}}/actions` _(update)_, `GET /v1/rulesengine/v2/{{ruleId}}` _(ruleDetail)_, `GET /v1/api/describe/mda/{{objectName}}` _(describeTargetObject)_, `GET /v1/api/reporting/describe/{{type}}/{{objectName}}` _(describeSourceObject)_, `POST /v1/successPlan/admin-v2/types/list` _(spTypesList)_, `GET /v1/successPlan/admin-v2/templates` _(spTemplatesList)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--rule-id` | `string` |  | — | Rule GUID |
| `--rule-name` | `string` |  | — | Rule name — searches list and picks first match (exact > contains) |
| `--name` | `string` | ✓ | — | Success Plan name (literal value) |
| `--type` | `string` | ✓ | — | Success Plan type — label (e.g. 'Project Plan') or GSID. Resolved against `successPlan/admin-v2/types/list`. |
| `--status` | `string` | ✓ | — | Success Plan status — label (e.g. 'Draft') or GSID. Must be a valid status for the chosen type (resolved from types/list childPicklists). |
| `--template` | `string` |  | — | Template to apply — label or GSID. Resolved against `successPlan/admin-v2/templates?spTypeId={typeId}` (type-scoped). Optional. |
| `--description` | `string` |  | — | Action description (optional) |
| `--owner-source-field` | `string` |  | — | Optional. Source field on the rule's source object that supplies the SP owner (a user GSID). Accepts a direct fieldName/label or a lookup chain up to 3 hops (e.g. 'Csm', 'CSM -> GSID'). Omit to create the SP without an owner source mapping. |
| `--default-owner` | `string` |  | — | Optional. Default owner user GSID written to source.value on the owner mapping. When omitted, source.value is saved as an empty array. |
| `--company-id` | `string` |  | — | Required for Company/Account entity rules. Source field on the rule's source object that supplies the SP companyId (must resolve to a company GSID). For an MDA company source, pass 'Gsid'. |
| `--due-date-plus-days` | `integer` |  | `5` | Due-date offset in days from rule run (default 5) |
| `--due-date-skip-option` | `string` |  | `"SKIP_ALL_WEEKENDS"` | Weekend handling for the due date One of: `SKIP_ALL_WEEKENDS`, `DO_NOT_SKIP`, `SKIP_SUNDAY`, `SKIP_SATURDAY`. |
| `--unique-identifier` | `array` |  | — | Field names used as uniqueness keys; repeat the flag (defaults: SuccessPlanTypeId, StatusId, Name) |
| `--task-id` | `string` |  | — | Task ID to attach the action to (e.g. 't1'). Defaults to 't1' for SIMPLE rules; required for COMPLEX rules unless --task-name is provided. |
| `--task-name` | `string` |  | — | Task name — alternative to --task-id; resolved case-insensitively. Mutually exclusive with --task-id. |
| `--criteria-id` | `string` |  | — | Optional — scope the action to a specific criteria (e.g. 'c1'). Mutually exclusive with --criteria-name. |
| `--criteria-name` | `string` |  | — | Optional — alternative to --criteria-id; resolved case-insensitively against the rule's criteria for the chosen task. |
| `--relationship-id` | `string` |  | — | Required for Relationship entity rules. Source field that supplies the relationship GSID (mapped to 'RelationshipId' on cta_group). |

**Examples**

```bash
gs-admin re r add-action success-plan --name <name> --type <type> --status <status>
```

### `gs-admin rules-engine rules add-action update-cta`
*Short form:* `gs-admin re r add-action update-cta`
*Path:* Rule operations › Add a typed action to a rule's task

Add an Update-CTA action to a rule (Step 4 — Update CTA)

Add a CTA_UPDATE action onto a rule's task. The rule matches existing CTAs by their GSID — supplied via --cta-id, a source field on the rule's source object that resolves to call_to_action (the sole match key; no --company-id) — and updates fields on them.

Updatable fields: --status, --reason, --priority, --playbook (all require --type, which scopes the picklist resolution), --comments (with --update-comment APPEND|REPLACE), plus custom --mapping/--mappings-file rows. Owner reassignment and due-date editing are not yet supported (ownerConfig/dueDateConfig are emitted at no-op defaults).

Task/criteria scoping: --task-id/--task-name (defaults to t1 for SIMPLE rules), --criteria-id/--criteria-name.

**MCP tool:** `rules_engine_add_rule_action_update_cta` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `PUT /v3/rulesengine/{{ruleId}}/actions` _(update)_, `GET /v1/rulesengine/v2/{{ruleId}}` _(ruleDetail)_, `GET /v1/api/describe/mda/{{objectName}}` _(describeTargetObject)_, `GET /v1/api/reporting/describe/{{type}}/{{objectName}}` _(describeSourceObject)_, `POST /v1/cockpit/admin-v2/types/list` _(ctaTypesList)_, `GET /v1/cockpit/admin/cta/type/{{typeId}}/advancedInfo` _(ctaTypeAdvancedInfo)_, `GET /v1/cockpit/admin-v2/playbook/` _(ctaPlaybookList)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--rule-id` | `string` |  | — | Rule GUID |
| `--rule-name` | `string` |  | — | Rule name — searches list and picks first match (exact > contains) |
| `--cta-id` | `string` | ✓ | — | Required. Source field on the rule's source object that identifies the CTA to update — must resolve to a CTA GSID (meta.GAINSIGHT.key=GS_CALL_TO_ACTION_ID, or a lookup to call_to_action). Supports lookup chains up to 3 hops (e.g. 'Gsid' or 'CtaLookup -> Gsid'). This is the sole match key; no --company-id is needed. |
| `--type` | `string` |  | — | CTA type — label or GSID. Required when setting --status/--reason/--priority/--playbook (they resolve within the type). When set, the type is also written to the matched CTAs. Resolved against `cockpit/admin-v2/types/list`. |
| `--status` | `string` |  | — | New CTA status — label or GSID. Requires --type. Resolved against the type's advancedInfo. |
| `--reason` | `string` |  | — | New CTA reason — label or GSID. Requires --type. Resolved against the type's advancedInfo. |
| `--priority` | `string` |  | — | New CTA priority — label or GSID. Requires --type. Resolved against the type's advancedInfo. |
| `--playbook` | `string` |  | — | New playbook — label or GSID. Requires --type. Resolved against the type's active playbooks. |
| `--owner-source-field` | `string` |  | — | Optional. Source field on the rule's source object that supplies the new CTA owner (a user GSID), written to the OwnerId field. Accepts a direct fieldName/label or a lookup chain up to 3 hops (e.g. 'Csm', 'CSM -> GSID'). When omitted, no owner mapping is written. |
| `--default-owner` | `string` |  | — | Fallback owner user GSID applied when the owner source field is null at runtime. Only used together with --owner-source-field. |
| `--comments` | `string` |  | — | CTA comments to apply (rich-text HTML). Combined with --update-comment. |
| `--update-comment` | `string` |  | `"APPEND"` | How --comments is applied to the existing CTA comment (default APPEND). Only used when --comments is set. One of: `APPEND`, `REPLACE`. |
| `--mapping` | `array` |  | — | Extra mapping spec for custom call_to_action fields; repeat the flag. Format: 'TargetField=value:<literal>' or 'TargetField=field:<sourceField>' (source chain depth ≤ 3). Reserved target fields (Gsid, TypeId, StatusId, ReasonId, PriorityId, PlaybookId, Comments) are managed via semantic flags and cannot be set here. |
| `--mappings-file` | `string` |  | — | Path to a JSON file with extra mappings. Same shape as --mapping but as objects: [{"target":"FieldName","kind":"value","value":"..."}, {"target":"FieldName","kind":"field","source":"SrcField"}]. Combined with --mapping when both are passed. |
| `--description` | `string` |  | — | Action description (optional) |
| `--task-id` | `string` |  | — | Task ID to attach the action to (e.g. 't1'). Defaults to 't1' for SIMPLE/SOF rules. Mutually exclusive with --task-name. |
| `--task-name` | `string` |  | — | Task name — alternative to --task-id (case-insensitive). Mutually exclusive with --task-id. |
| `--criteria-id` | `string` |  | — | Optional — scope the action to a specific criteria (e.g. 'c1'). Mutually exclusive with --criteria-name. |
| `--criteria-name` | `string` |  | — | Optional — alternative to --criteria-id (case-insensitive). Mutually exclusive with --criteria-id. |

**Examples**

```bash
gs-admin re r add-action update-cta --cta-id <cta-id>
```

### `gs-admin rules-engine rules add-action update-success-plan`
*Short form:* `gs-admin re r add-action update-success-plan`
*Path:* Rule operations › Add a typed action to a rule's task

Add an Update Success Plan action to a rule (Step 4 — Update Success Plan)

Add a Success Plan update (SP_UPDATE) action to a rule's task. Identifies the existing SP by its GSID. Required: --type, --status, --success-plan-id. --success-plan-id is a field on the rule's source object with meta.mappings.GAINSIGHT.key="GS_SUCCESS_PLAN_ID" or lookupDetail pointing to "cta_group". uniqueIdentifiers are always [SuccessPlanTypeId, StatusId]. Optional: --default-owner, --owner-source-field, --template.

**MCP tool:** `rules_engine_add_rule_action_update_success_plan` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `PUT /v3/rulesengine/{{ruleId}}/actions` _(update)_, `GET /v1/rulesengine/v2/{{ruleId}}` _(ruleDetail)_, `GET /v1/api/describe/mda/{{objectName}}` _(describeTargetObject)_, `GET /v1/api/reporting/describe/{{type}}/{{objectName}}` _(describeSourceObject)_, `POST /v1/successPlan/admin-v2/types/list` _(spTypesList)_, `GET /v1/successPlan/admin-v2/templates` _(spTemplatesList)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--rule-id` | `string` |  | — | Rule GUID |
| `--rule-name` | `string` |  | — | Rule name — searches list and picks first match (exact > contains) |
| `--type` | `string` | ✓ | — | Success Plan type — label or GSID. Resolved against `successPlan/admin-v2/types/list`. |
| `--status` | `string` | ✓ | — | Success Plan status — label or GSID. Must be a valid status for the chosen type. |
| `--success-plan-id` | `string` | ✓ | — | REQUIRED. Field on the rule's source object that stores the Success Plan GSID. Must have meta.GAINSIGHT.key="GS_SUCCESS_PLAN_ID" or look up to "cta_group". |
| `--template` | `string` |  | — | Template to apply — label or GSID. Resolved against `successPlan/admin-v2/templates?spTypeId={typeId}` (type-scoped). Optional. |
| `--description` | `string` |  | — | Action description (optional) |
| `--owner-source-field` | `string` |  | — | Optional. Source field on the rule's source object that supplies the SP owner (a user GSID). Accepts a direct fieldName/label or a lookup chain up to 3 hops. |
| `--default-owner` | `string` |  | — | Optional. Default owner user GSID written to source.value on the owner mapping. |
| `--task-id` | `string` |  | — | Task ID to attach the action to (e.g. 't1'). Defaults to 't1' for SIMPLE rules. |
| `--task-name` | `string` |  | — | Task name — alternative to --task-id; resolved case-insensitively. |
| `--criteria-id` | `string` |  | — | Optional — scope the action to a specific criteria (e.g. 'c1'). |
| `--criteria-name` | `string` |  | — | Optional — alternative to --criteria-id; resolved case-insensitively. |

**Examples**

```bash
gs-admin re r add-action update-success-plan --type <type> --status <status> --success-plan-id <success-plan-id>
```

### `gs-admin rules-engine rules add-criteria`
*Short form:* `gs-admin re r add-criteria`
*Path:* Rule operations

Add criteria to a rule (Step 3)

Add filter criteria onto a rule's source task. Provide --rule-id (or --rule-name) plus one or more --condition flags (or a --conditions-file JSON). Each condition is `alias:field:operator[:value]`. Field names are validated against the rule's source object via `re r sources fields` BEFORE the PUT — invalid fields fail fast with the available list. Operators: EQUALS, NOT_EQUALS, GREATER_THAN, LESS_THAN, GREATER_THAN_OR_EQUAL, LESS_THAN_OR_EQUAL, IS_NULL, IS_NOT_NULL, CONTAINS, STARTS_WITH, ENDS_WITH, IN, NOT_IN, BETWEEN, WITHIN_DAYS. Use --expression to combine 2+ conditions (e.g. 'A AND B', 'A AND (B OR C)'); single condition defaults to 'A'.

**MCP tool:** `rules_engine_add_rule_criteria` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `PUT /v1/rulesengine/{{ruleId}}/criteria` _(update)_, `GET /v1/rulesengine/v2/{{ruleId}}` _(ruleDetail)_, `GET /v1/api/reporting/describe/{{type}}/{{objectName}}` _(describeObject)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--rule-id` | `string` |  | — | Rule GUID |
| `--rule-name` | `string` |  | — | Rule name — searches list and picks first match (exact > contains) |
| `--expression` | `string` |  | — | Logical expression combining condition aliases (required for 2+ conditions). Examples: 'A', 'A AND B', 'A AND (B OR C)'. |
| `--condition` | `array` |  | — | Condition spec: 'alias:field:operator[:value]'. Repeat --condition for multiple. Examples: --condition 'A:Arr:GREATER_THAN:100000' --condition 'B:Status:IS_NULL'. |
| `--conditions-file` | `string` |  | — | Path to a JSON file with an array of condition objects [{alias, field, operator, value}, ...]. Wins over --condition when both are passed. |
| `--criteria-name` | `string` |  | — | Optional human-readable name for the criteria (auto-generated from the first condition when omitted) |
| `--task-id` | `string` |  | `"t1"` | Task ID (defaults to 't1' for SOF) |
| `--dd-config-id` | `string` |  | — | DD config ID — auto-resolved from the rule's source task when omitted |

**Examples**

```bash
gs-admin re r add-criteria
```

### `gs-admin rules-engine rules create`
*Short form:* `gs-admin re r create`
*Path:* Rule operations

Create a rule (Step 1 — basic details)

Create a new Horizon rule with name, optional description, entity, and folder. This is Step 1 of the rule wizard; the rule is created in active status with no source/criteria/actions yet — finish authoring in the UI or in subsequent steps. Validates: name 3–120 chars (must not start with a digit). When --entity Relationship, supply EITHER --relationship-type-id (Gsid) OR --relationship-type (name; resolved via `re r relationship-types list`). Folder defaults to 'Uncategorized' when --folder-id and --folder-name are both omitted; --folder-name is resolved via `re r folders list`.

**MCP tool:** `rules_engine_create_rule_basics` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `POST /v2/rulesengine/create` _(create)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--name` | `string` | ✓ | — | Rule name (3–120 chars; must not start with a digit) |
| `--description` | `string` |  | — | Rule description (optional) |
| `--entity` | `string` |  | `"Company"` | Entity the rule operates on (default: Company) One of: `Company`, `Relationship`. |
| `--relationship-type-id` | `any` |  | — | Relationship type Gsid(s) — repeatable; supply this and/or --relationship-type when --entity Relationship |
| `--relationship-type` | `any` |  | — | Relationship type name(s) — repeatable; resolved via `re r relationship-types list` (case-insensitive; exact match preferred, then contains) |
| `--folder-id` | `integer` |  | — | Folder ID (wins over --folder-name if both are given) |
| `--folder-name` | `string` |  | — | Folder name — resolved via `list-folders`; defaults to 'Uncategorized' |

**Examples**

```bash
gs-admin re r create --name <rule-name>
```

### `gs-admin rules-engine rules debug`
*Short form:* `gs-admin re r debug`
*Path:* Rule operations

Debug a Rules Engine rule

Show current execution state, recent run history, and trend metrics for a rule. Provide --id (ruleId from `re r list`) or --name (searches and picks first match). --recent controls how many recent executions to include (1–50, default 5).

**MCP tool:** `rules_engine_debug_rule` · **Mutating:** yes ⚠️ · **Output:** `detail` · **Endpoint(s):** `GET /v1/rulesengine/debug/{{ruleId}}` _(fetch)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` |  | — | Rule GUID (ruleId field from list-rules) |
| `--name` | `string` |  | — | Rule name — searches list and picks first match |
| `--recent` | `integer` |  | `5` | Number of recent executions to include (1–50) |

**Examples**

```bash
gs-admin re r debug
```

### `gs-admin rules-engine rules delete-action`
*Short form:* `gs-admin re r delete-action`
*Path:* Rule operations

Delete one or more actions from a rule

Delete one or more actions from a rule's action list. Provide --rule-id (or --rule-name) and one or more --action-id flags. Action IDs are validated against the rule's current action list before the DELETE is sent — unknown IDs fail fast with the available list. Use `re r describe --id <ruleId>` to find action IDs.

**MCP tool:** `rules_engine_delete_rule_action` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `DELETE /v2/rulesengine/{{ruleId}}/actions` _(delete)_, `GET /v1/rulesengine/v2/{{ruleId}}` _(ruleDetail)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--rule-id` | `string` |  | — | Rule GUID |
| `--rule-name` | `string` |  | — | Rule name — searches list and picks first match (exact > contains) |
| `--action-id` | `any` | ✓ | — | Action GUID(s) to delete — repeat the flag for multiple. Use `re r describe --id <ruleId>` to find action IDs. |

**Examples**

```bash
gs-admin re r delete-action --action-id <action-id>
```

### `gs-admin rules-engine rules delete-schedule`
*Short form:* `gs-admin re r delete-schedule`
*Path:* Rule operations

Delete the schedule for a rule

Removes the CRON schedule from a Bionic rule. Provide --id (rule GUID) or --name to identify the rule.

**MCP tool:** `rules_engine_delete_rule_schedule` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `GET /v1/api/eventrule/{{ruleId}}/{{jobType}}/schedules` _(eventSchedules)_, `DELETE /v1/api/eventrule/{{ruleId}}/event-unsubscribe` _(eventUnsubscribe)_, `DELETE /v1/api/schedule/jobidentifier/{{ruleId}}` _(delete)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` |  | — | Rule GUID (from `re r list`) |
| `--name` | `string` |  | — | Rule name — searches list and picks first match (exact > contains) |

**Examples**

```bash
gs-admin re r delete-schedule
```

### `gs-admin rules-engine rules describe`
*Short form:* `gs-admin re r describe`
*Path:* Rule operations

Describe a Rules Engine rule

Get full details for a single Rules Engine rule: metadata, source object, action type, and source→target field mapping table. Provide --id (ruleId from `re r list`) or --name (searches and picks first match).

**MCP tool:** `rules_engine_describe_rule` · **Mutating:** no · **Output:** `detail` · **Endpoint(s):** `GET /v1/rulesengine/v2/{{ruleId}}` _(fetch)_, `GET /v1/bionicreporting/config-ui/{{configId}}/tasks` _(configTasks)_, `GET /v1/bionicreporting/config-ui/{{configId}}/task/{{taskId}}` _(configTask)_, `GET /v2/rulesengine/{{ruleId}}/taskOutputs` _(taskOutputs)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` |  | — | Rule GUID (ruleId field from list-rules) |
| `--name` | `string` |  | — | Rule name — searches list and picks first match |
| `--task-id` | `string` |  | — | Scope output to a specific task ID |
| `--task-name` | `string` |  | — | Scope output to a task by name — resolved to its task ID (case-insensitive substring match) |
| `--criteria-id` | `string` |  | — | Scope to a specific criteria ID — also shows filter conditions |
| `--criteria-name` | `string` |  | — | Scope to a criteria by name — resolved to its criteria ID (case-insensitive substring match) |
| `--action-id` | `string` |  | — | Scope to a specific action ID — also shows field mappings |
| `--pivot-column` | `string` |  | — | Expand conditions for a pivot column by name (only applies when --task-id targets a pivot task; ignored for all other task types) |
| `--field` | `string` |  | — | Focus on ONE show field by name/alias/label — shows its metadata and, for a calculated field, the rendered formula. Requires --task-id. |

**Examples**

```bash
gs-admin re r describe
```

### `gs-admin rules-engine rules describe-external-action`
*Short form:* `gs-admin re r describe-external-action`
*Path:* Rule operations

Describe an External Action — target fields, URL, body template

Show one external-action callout's details so you know which target fields to map to in `re r add-action external-action --mapping`. Output includes: callout id/name, connection it lives on, HTTP method + URL, the body template (with {{token}} placeholders), headers (values masked by default), and a sub-table listing every target field (fieldName, dataType, label). Pass --external-action-id (configId, exact) or --external-action-name (case-insensitive contains). Header values are masked with **** unless --show-secrets is set; Content-Type is always shown in clear. Masking applies to both --table and --json output to prevent accidental log leaks.

**MCP tool:** `rules_engine_describe_external_action` · **Mutating:** no · **Output:** `detail` · **Endpoint(s):** `GET /v1/api/callout/config/all` _(fetch)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--external-action-id` | `string` |  | — | Callout configId (exact match) |
| `--external-action-name` | `string` |  | — | Callout display name (case-insensitive contains) |
| `--show-secrets` | `boolean` |  | `false` | Reveal raw header values (default: values are masked as ****). Use with care — output may end up in shell history or pipelines. |

**Examples**

```bash
gs-admin re r describe-external-action
```

### `gs-admin rules-engine rules edit`
*Short form:* `gs-admin re r edit`
*Path:* Rule operations

Edit a rule's basic details (name, description, folder)

Update the name, description, or folder of an existing rule. Fetches current ruleDetails via GET /v1/rulesengine/v2/<ruleId>, merges the supplied values, and saves via PUT /v1/rulesengine/<ruleId>/ruledetails. Provide --id (ruleId) or --name to identify the rule; pass --new-name to rename. At least one edit flag must be supplied.

**MCP tool:** `rules_engine_edit_rule_basics` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `GET /v1/rulesengine/v2/{{ruleId}}` _(fetch)_, `PUT /v1/rulesengine/{{ruleId}}/ruledetails` _(update)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` |  | — | Rule GUID (from `re r list`) |
| `--name` | `string` |  | — | Rule name — searches list and picks first match (exact > contains) |
| `--new-name` | `string` |  | — | New rule name (3–120 chars; must not start with a digit) |
| `--description` | `string` |  | — | New description (pass empty string to clear) |
| `--folder-id` | `integer` |  | — | New folder ID (wins over --folder-name if both are given) |
| `--folder-name` | `string` |  | — | New folder name — resolved via `re r folders list` |
| `--relationship-type-id` | `any` |  | — | New relationship type Gsid(s) — repeatable; only valid for Relationship entity rules. |
| `--relationship-type` | `any` |  | — | New relationship type name(s) — repeatable; resolved via `re r relationship-types list`. Only valid for Relationship entity rules. |

**Examples**

```bash
gs-admin re r edit
```

### `gs-admin rules-engine rules edit-action close-cta`
*Short form:* `gs-admin re r edit-action close-cta`
*Path:* Rule operations › Update a typed action already attached to a rule

Edit an existing Close-CTA action on a rule

Update a CTA_CLOSE action already attached to a rule. Requires --action-id (from `re r list-and-describe`). All other flags are identical to `re r add-action close-cta` — the full mapping set is rebuilt from the supplied values.

**MCP tool:** `rules_engine_edit_rule_action_close_cta` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `PUT /v3/rulesengine/{{ruleId}}/actions` _(update)_, `GET /v1/rulesengine/v2/{{ruleId}}` _(ruleDetail)_, `GET /v1/api/describe/mda/{{objectName}}` _(describeTargetObject)_, `GET /v1/api/reporting/describe/{{type}}/{{objectName}}` _(describeSourceObject)_, `POST /v1/cockpit/admin-v2/types/list` _(ctaTypesList)_, `GET /v1/cockpit/admin/cta/type/{{typeId}}/advancedInfo` _(ctaTypeAdvancedInfo)_, `GET /v1/cockpit/cta/ruleSources` _(ctaRuleSources)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--action-id` | `string` | ✓ | — | ID of the existing action to edit — visible in `gs-admin re r list-and-describe --rule-id <id>`. |
| `--rule-id` | `string` |  | — | Rule GUID |
| `--rule-name` | `string` |  | — | Rule name — searches list and picks first match (exact > contains) |
| `--type` | `string` |  | — | CTA type — label or GSID. Required when --cta-id is absent. |
| `--status` | `string` |  | — | CTA close status — label or GSID. Required when --cta-id is absent. Only closed statuses accepted. |
| `--reason` | `string` |  | — | CTA reason — label or GSID. Required when --cta-id is absent. |
| `--comments` | `string` |  | — | CTA comments (rich-text HTML). Optional in both modes. |
| `--comment-option` | `string` |  | `"ALWAYS"` | When to apply the comment (Mode 1 only, default ALWAYS) One of: `ALWAYS`, `ONCE`, `NEVER`. |
| `--company-id` | `string` |  | — | Required for Company/Account entity rules. Source field on the rule's source object that supplies the company GSID. For an MDA company source, pass 'Gsid'. Supports lookup chains up to 3 hops. |
| `--relationship-id` | `string` |  | — | Required for Relationship entity rules. Source field that supplies the relationship GSID (mapped to 'relationshipid' on call_to_action). |
| `--cta-id` | `string` |  | — | Optional. Source field that identifies the CTA to close. When provided, sets closeUsingId=true and makes --type/--status/--reason/--sources unnecessary. |
| `--sources` | `string` |  | — | Comma-separated CTA sources (e.g. 'Manual,Rules'). Required when --cta-id is absent. |
| `--description` | `string` |  | — | Action description (optional) |
| `--task-id` | `string` |  | — | Task ID (e.g. 't1'). Mutually exclusive with --task-name. |
| `--task-name` | `string` |  | — | Task name (case-insensitive). Mutually exclusive with --task-id. |
| `--criteria-id` | `string` |  | — | Optional — scope to a specific criteria. Mutually exclusive with --criteria-name. |
| `--criteria-name` | `string` |  | — | Optional — alternative to --criteria-id (case-insensitive). |

**Examples**

```bash
gs-admin re r edit-action close-cta --action-id <action-id>
```

### `gs-admin rules-engine rules edit-action cta`
*Short form:* `gs-admin re r edit-action cta`
*Path:* Rule operations › Update a typed action already attached to a rule

Edit an existing CTA action on a rule (Step 4 — CTA)

Update a Call-to-Action action already attached to a rule. Requires --action-id (from `re r list-and-describe`). All other flags are identical to `re r add-action cta` — the full mapping set is rebuilt from the supplied values. Omitting an optional flag (e.g. --playbook, --comments) removes the previous value.

**MCP tool:** `rules_engine_edit_rule_action_cta` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `PUT /v3/rulesengine/{{ruleId}}/actions` _(update)_, `GET /v1/rulesengine/v2/{{ruleId}}` _(ruleDetail)_, `GET /v1/api/describe/mda/{{objectName}}` _(describeTargetObject)_, `GET /v1/api/reporting/describe/{{type}}/{{objectName}}` _(describeSourceObject)_, `POST /v1/cockpit/admin-v2/types/list` _(ctaTypesList)_, `GET /v1/cockpit/admin/cta/type/{{typeId}}/advancedInfo` _(ctaTypeAdvancedInfo)_, `GET /v1/cockpit/admin-v2/playbook/` _(ctaPlaybookList)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--action-id` | `string` | ✓ | — | ID of the existing action to edit — visible in `gs-admin re r list-and-describe --rule-id <id>`. |
| `--rule-id` | `string` |  | — | Rule GUID |
| `--rule-name` | `string` |  | — | Rule name — searches list and picks first match (exact > contains) |
| `--name` | `string` | ✓ | — | CTA name (literal value) |
| `--type` | `string` | ✓ | — | CTA type — label (e.g. 'Risk') or GSID. Resolved against `cockpit/admin-v2/types/list`. |
| `--priority` | `string` | ✓ | — | CTA priority — label (e.g. 'High') or GSID. Resolved against the chosen type's advancedInfo. |
| `--status` | `string` | ✓ | — | CTA status — label (e.g. 'New') or GSID. Resolved against the chosen type's advancedInfo. |
| `--reason` | `string` | ✓ | — | CTA reason — label or GSID. Resolved against the chosen type's advancedInfo. |
| `--description` | `string` |  | — | Action description (optional) |
| `--owner-source-field` | `string` |  | — | Optional. Source field on the rule's source object that supplies the CTA owner (a user GSID). Accepts a direct fieldName/label or a lookup chain up to 3 hops (e.g. 'Csm', 'CSM -> GSID'). When omitted, source.field is null but the owner mapping is always written. |
| `--default-owner` | `string` |  | — | Fallback owner user GSID applied when the owner source field is null at runtime |
| `--company-id` | `string` |  | — | Required for Company/Account entity rules. Source field on the rule's source object that supplies the CTA companyId (must resolve to a company GSID). For an MDA company source, pass 'Gsid'. |
| `--comments` | `string` |  | — | CTA comments (rich-text HTML) |
| `--playbook` | `string` |  | — | Playbook — label or GSID. Resolved against `cockpit/admin-v2/playbook?ctaTypeId={typeId}&active=true`. |
| `--due-date-plus-days` | `integer` |  | `5` | Due-date offset in days from rule run (default 5) |
| `--due-date-skip-option` | `string` |  | `"SKIP_ALL_WEEKENDS"` | Weekend handling for the due date One of: `SKIP_ALL_WEEKENDS`, `DO_NOT_SKIP`, `SKIP_SUNDAY`, `SKIP_SATURDAY`. |
| `--comment-option` | `string` |  | `"ALWAYS"` | When to apply the comment One of: `ALWAYS`, `ONCE`, `NEVER`. |
| `--time-frame-days` | `integer` |  | `7` | Time-frame check window in days (default 7) |
| `--check-open-cta` | `boolean` |  | `true` | Skip create when an open CTA already exists for the same identifiers |
| `--do-time-frame-check` | `boolean` |  | `true` | Run the time-frame uniqueness check |
| `--unique-identifier` | `array` |  | — | Field names used as uniqueness keys; repeat the flag (defaults: TypeId, ReasonId, Name) |
| `--task-id` | `string` |  | — | Task ID to attach the action to (e.g. 't1', 't2'). Defaults to 't1' for SIMPLE/SOF rules; required for COMPLEX rules unless --task-name is provided. Mutually exclusive with --task-name. |
| `--task-name` | `string` |  | — | Task name — alternative to --task-id; resolved against the rule's task list (case-insensitive). Mutually exclusive with --task-id. |
| `--criteria-id` | `string` |  | — | Optional — scope the action to a specific criteria within the task (e.g. 'c1', 'c2'). When set, the action runs only when this criteria evaluates true. Mutually exclusive with --criteria-name. |
| `--criteria-name` | `string` |  | — | Optional — alternative to --criteria-id; resolved against the rule's criteriaDetails for the chosen task (case-insensitive). Mutually exclusive with --criteria-id. |
| `--mapping` | `array` |  | — | Extra mapping spec for custom call_to_action fields; repeat the flag. Format: 'TargetField=value:<literal>' or 'TargetField=field:<sourceField>'. The source side accepts the same chain syntax as --owner-source-field, e.g. 'OwnerId=field:CSM -> GSID' (depth ≤ 3). Reserved target fields (Name, TypeId, PriorityId, StatusId, ReasonId, OwnerId, CompanyId, Comments, PlaybookId) are managed via semantic flags and cannot be set here. |
| `--mappings-file` | `string` |  | — | Path to a JSON file with extra mappings. Same shape as --mapping but as objects: [{"target":"FieldName","kind":"value","value":"..."}, {"target":"FieldName","kind":"field","source":"SrcField"}]. Combined with --mapping when both are passed. |
| `--relationship-id` | `string` |  | — | Required for Relationship entity rules. Source field that supplies the relationship GSID (mapped to 'relationshipid' on call_to_action). |

**Examples**

```bash
gs-admin re r edit-action cta --action-id <action-id> --name <name> --type <type> --priority <priority> --status <status> --reason <reason>
```

### `gs-admin rules-engine rules edit-action external-action`
*Short form:* `gs-admin re r edit-action external-action`
*Path:* Rule operations › Update a typed action already attached to a rule

Edit an existing External Action (REST_API callout) on a rule

Update an existing REST_API action attached to a rule. Required: --action-id (UUID — from `re r describe --rule-id <id>` or `re r list-and-describe-rules`). All other flags mirror `re r add-action external-action` — the entire mapping set is rebuilt from the supplied values (full-replace, NOT a diff). Use this to (a) add or remove individual mappings, (b) switch the rule to a different external action via --external-action-name/--external-action-id, (c) change the connection via --connection-id, or (d) update the description. Connection is implicit from the chosen callout — passing --connection-id only asserts the callout lives on that connector. Validations: V1 (≥1 mapping), V2 (every {{token}} in callout body is a known field), V3 (every callout field is covered), V4 (no duplicate target), V5/V6 (target/source exist), V7 (callout's connectionId matches --connection-id if passed), V8 (callout not deleted), V12 (--description ≤500 chars). The existing actionType MUST be REST_API; the command refuses to edit a CTA/SetScore/etc. action as an external action — use the matching `edit-action <type>` command instead. actionIndex, taskId, criteriaId and status are preserved from the existing action.

**MCP tool:** `rules_engine_edit_rule_action_external_action` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `PUT /v3/rulesengine/{{ruleId}}/actions` _(update)_, `GET /v1/rulesengine/v2/{{ruleId}}` _(ruleDetail)_, `GET /v1/api/callout/config/all` _(listCallouts)_, `GET /v2/rulesengine/{{ruleId}}/taskOutputs` _(taskOutputs)_, `GET /v1/api/reporting/describe/{{type}}/{{objectName}}` _(describeSourceObject)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--rule-id` | `string` |  | — | Rule ID (from `re r list`) |
| `--rule-name` | `string` |  | — | Rule name — searches list and picks first match |
| `--action-id` | `string` |  | — | UUID of the existing REST_API action on the rule (from `re r describe --rule-id <id>` → gsRuleMetaActionDetails[].actionId). |
| `--external-action-id` | `string` |  | — | Callout configId (exact match). Pass this OR --external-action-name. |
| `--external-action-name` | `string` |  | — | Callout display name (case-insensitive). Alternative to --external-action-id. |
| `--connection-id` | `string` |  | — | Optional sanity check — if set, must equal the callout's connectionId. |
| `--connection-name` | `string` |  | — | Optional advisory — informational only (use --connection-id for a hard check). |
| `--mapping` | `array` |  | — | Repeatable. Format: `<targetField>=<sourceField>`. Edit is a FULL REPLACE — supply every mapping you want on the action, including unchanged ones. Every callout field MUST be mapped (V3). |
| `--task-id` | `string` |  | — | Task to attach this action to (only relevant when relocating the action). Defaults to the action's existing task. |
| `--task-name` | `string` |  | — | Alternative to --task-id (resolves against the rule's task list). |
| `--criteria-id` | `string` |  | — | Criteria ID (e.g. `c1`). Omit to attach directly to the task. |
| `--criteria-name` | `string` |  | — | Alternative to --criteria-id (resolves against criteria on the chosen task). |
| `--description` | `string` |  | — | Update the description. Omit to preserve the existing value. (≤ 500 chars.) |

**Examples**

```bash
gs-admin re r edit-action external-action
```

### `gs-admin rules-engine rules edit-action load-to-company`
*Short form:* `gs-admin re r edit-action load-to-company`
*Path:* Rule operations › Update a typed action already attached to a rule

Update a Load-to-Company (DATA_SYNC) action on a rule

Updates an existing DATA_SYNC action that writes into the Gainsight Company object. --operation is optional (defaults to existing); all other flags mirror add-action load-to-company. Full mapping replacement — all --mapping / --mappings-file entries replace the existing mapping set. LOOKUP mappings create new import-lookup configs (old IDs are replaced). Required Company field validation and MDA constraints are re-applied on every edit.

**MCP tool:** `rules_engine_edit_rule_action_load_to_company` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `PUT /v3/rulesengine/{{ruleId}}/actions` _(update)_, `GET /v1/rulesengine/v2/{{ruleId}}` _(ruleDetail)_, `GET /v1/api/describe/mda/company` _(describeCompany)_, `GET /v1/api/reporting/describe/{{type}}/{{objectName}}` _(describeSourceObject)_, `GET /v1/api/describe/listobjects/mda` _(listMdaObjects)_, `GET /v1/api/describe/mda/{{objectName}}` _(describeMdaObject)_, `POST /v1/api/importlookups/createlookup` _(createImportLookup)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--action-id` | `string` | ✓ | — | ID of the existing action to edit — visible in `gs-admin re r describe --rule-id <id>`. |
| `--rule-id` | `string` |  | — | Rule GUID |
| `--rule-name` | `string` |  | — | Rule name — searches list and picks first match |
| `--operation` | `string` |  | — | Write mode — INSERT is not supported for Load-to-Company. Both UPSERT and UPDATE require at least one :id identifier mapping. One of: `UPSERT`, `UPDATE`, `upsert`, `update`. |
| `--mapping` | `any` |  | — | Repeatable mapping spec. FIELD: 'Target=field:SrcField[:id[:default]]'. VALUE: 'Target=value:val[:type[:id]]'. |
| `--mappings-file` | `string` |  | — | Path to a JSON file with an array of mapping objects: [{target,kind,source?,identifier?,default?,value?,valueType?}] |
| `--task-id` | `string` |  | — | Task ID (e.g. 't1'). Required for COMPLEX rules; defaults to 't1' for SIMPLE. |
| `--task-name` | `string` |  | — | Task name — fuzzy-matched against the rule's task list |
| `--criteria-id` | `string` |  | — | Criteria ID to scope the action to |
| `--criteria-name` | `string` |  | — | Criteria name — fuzzy-matched within the resolved task |
| `--description` | `string` |  | — | Optional description for this action |

**Examples**

```bash
gs-admin re r edit-action load-to-company --action-id <action-id>
```

### `gs-admin rules-engine rules edit-action load-to-gainsight`
*Short form:* `gs-admin re r edit-action load-to-gainsight`
*Path:* Rule operations › Update a typed action already attached to a rule

Update a Load-to-Gainsight-Object (DATA_SYNC) action on a rule

Updates an existing DATA_SYNC action that writes into a Gainsight (MDA) object. Target object is fixed from the existing action and cannot be changed. --operation is optional (defaults to existing); all other flags mirror add-action load-to-gainsight. Full mapping replacement — all --mapping / --mappings-file entries replace the existing mapping set. GSID rules, identifier requirements, and audit-field exclusions are re-validated on every edit.

**MCP tool:** `rules_engine_edit_rule_action_load_to_gainsight` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `PUT /v3/rulesengine/{{ruleId}}/actions` _(update)_, `GET /v1/rulesengine/v2/{{ruleId}}` _(ruleDetail)_, `GET /v1/api/rulesloadableobject` _(loadableTargetObjects)_, `GET /v1/api/describe/{{areaName}}/{{objectId}}` _(describeTargetObject)_, `GET /v1/api/reporting/describe/{{type}}/{{objectName}}` _(describeSourceObject)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--action-id` | `string` | ✓ | — | ID of the existing action to edit — visible in `gs-admin re r describe --rule-id <id>`. |
| `--rule-id` | `string` |  | — | Rule GUID |
| `--rule-name` | `string` |  | — | Rule name — searches list and picks first match |
| `--operation` | `string` |  | — | Write mode. UPSERT and UPDATE require at least one :id identifier mapping. GSID can only be mapped in UPDATE. One of: `INSERT`, `UPSERT`, `UPDATE`, `insert`, `upsert`, `update`. |
| `--mapping` | `any` |  | — | Repeatable mapping spec. FIELD: 'Target=field:SrcField[:id[:default]]'. VALUE: 'Target=value:val[:type[:id]]'. |
| `--mappings-file` | `string` |  | — | Path to a JSON file with an array of mapping objects: [{target,kind,source?,identifier?,default?,value?,valueType?}] |
| `--task-id` | `string` |  | — | Task ID (e.g. 't1'). Required for COMPLEX rules; defaults to 't1' for SIMPLE. |
| `--task-name` | `string` |  | — | Task name — fuzzy-matched against the rule's task list |
| `--criteria-id` | `string` |  | — | Criteria ID to scope the action to |
| `--criteria-name` | `string` |  | — | Criteria name — fuzzy-matched within the resolved task |
| `--description` | `string` |  | — | Optional description for this action |

**Examples**

```bash
gs-admin re r edit-action load-to-gainsight --action-id <action-id>
```

### `gs-admin rules-engine rules edit-action set-score`
*Short form:* `gs-admin re r edit-action set-score`
*Path:* Rule operations › Update a typed action already attached to a rule

Edit an existing Set-Score action on a rule

Update a Set-Score (SET_SCOREV2) action already attached to a rule. Requires --action-id. All other flags are identical to `re r add-action set-score` — the full mapping set is rebuilt.

**MCP tool:** `rules_engine_edit_rule_action_set_score` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `PUT /v3/rulesengine/{{ruleId}}/actions` _(update)_, `GET /v1/rulesengine/v2/{{ruleId}}` _(ruleDetail)_, `GET /v1/api/reporting/describe/{{type}}/{{objectName}}` _(describeSourceObject)_, `GET /v1/scorecards/schemes` _(scorecardSchemes)_, `POST /v1/scorecards/measures/{{entityType}}/metrics` _(scorecardMeasures)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--action-id` | `string` | ✓ | — | ID of the existing action to edit — visible in `gs-admin re r list-and-describe --rule-id <id>`. |
| `--rule-id` | `string` |  | — | Rule GUID |
| `--rule-name` | `string` |  | — | Rule name — searches list and picks first match (exact > contains) |
| `--measure` | `string` | ✓ | — | Measure (single-select) — label or GSID. Resolved against `/v1/scorecards/measures/{entityType}/metrics` for the rule's entity (ACCOUNT or RELATIONSHIP). |
| `--score` | `array` | ✓ | — | Score spec: 'ScorecardName=Value' (or 'ScorecardGsid=ValueGsid'). Repeat the flag for multi-scorecard. Value is matched against the scorecard's scheme (GRADE: A..F, COLOR: Red/Yellow/Green, NUMERIC: integer in range). Scorecard must be associated with the chosen --measure. |
| `--account-id` | `string` |  | — | Required for Company/Account entity rules. Source field that supplies the account identifier. For an MDA company source, pass 'Gsid'. |
| `--description` | `string` |  | — | Action description (optional) |
| `--task-id` | `string` |  | — | Task ID to attach the action to (e.g. 't1', 't2'). Defaults to 't1' for SIMPLE/SOF rules; required for COMPLEX rules unless --task-name is provided. Mutually exclusive with --task-name. |
| `--task-name` | `string` |  | — | Task name — alternative to --task-id; resolved against the rule's task list (case-insensitive). Mutually exclusive with --task-id. |
| `--criteria-id` | `string` |  | — | Optional — scope the action to a specific criteria within the task (e.g. 'c1', 'c2'). When set, the action runs only when this criteria evaluates true. Mutually exclusive with --criteria-name. |
| `--criteria-name` | `string` |  | — | Optional — alternative to --criteria-id; resolved against the rule's criteriaDetails for the chosen task (case-insensitive). Mutually exclusive with --criteria-id. |
| `--relationship-id` | `string` |  | — | Required for Relationship entity rules. Source field that supplies the relationship GSID (mapped to 'relationship' on the scorecard target object). |

**Examples**

```bash
gs-admin re r edit-action set-score --action-id <action-id> --measure <measure> --score <score>
```

### `gs-admin rules-engine rules edit-action success-plan`
*Short form:* `gs-admin re r edit-action success-plan`
*Path:* Rule operations › Update a typed action already attached to a rule

Edit an existing Success Plan action on a rule

Update a Success Plan (SP_UPSERT) action already attached to a rule. Requires --action-id. All other flags are identical to `re r add-action success-plan` — the full mapping set is rebuilt.

**MCP tool:** `rules_engine_edit_rule_action_success_plan` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `PUT /v3/rulesengine/{{ruleId}}/actions` _(update)_, `GET /v1/rulesengine/v2/{{ruleId}}` _(ruleDetail)_, `GET /v1/api/describe/mda/{{objectName}}` _(describeTargetObject)_, `GET /v1/api/reporting/describe/{{type}}/{{objectName}}` _(describeSourceObject)_, `POST /v1/successPlan/admin-v2/types/list` _(spTypesList)_, `GET /v1/successPlan/admin-v2/templates` _(spTemplatesList)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--action-id` | `string` | ✓ | — | ID of the existing action to edit — visible in `gs-admin re r list-and-describe --rule-id <id>`. |
| `--rule-id` | `string` |  | — | Rule GUID |
| `--rule-name` | `string` |  | — | Rule name — searches list and picks first match (exact > contains) |
| `--name` | `string` | ✓ | — | Success Plan name (literal value) |
| `--type` | `string` | ✓ | — | Success Plan type — label (e.g. 'Project Plan') or GSID. Resolved against `successPlan/admin-v2/types/list`. |
| `--status` | `string` | ✓ | — | Success Plan status — label (e.g. 'Draft') or GSID. Must be a valid status for the chosen type (resolved from types/list childPicklists). |
| `--template` | `string` |  | — | Template to apply — label or GSID. Resolved against `successPlan/admin-v2/templates?spTypeId={typeId}` (type-scoped). Optional. |
| `--description` | `string` |  | — | Action description (optional) |
| `--owner-source-field` | `string` |  | — | Optional. Source field on the rule's source object that supplies the SP owner (a user GSID). Accepts a direct fieldName/label or a lookup chain up to 3 hops (e.g. 'Csm', 'CSM -> GSID'). Omit to create the SP without an owner source mapping. |
| `--default-owner` | `string` |  | — | Optional. Default owner user GSID written to source.value on the owner mapping. When omitted, source.value is saved as an empty array. |
| `--company-id` | `string` |  | — | Required for Company/Account entity rules. Source field on the rule's source object that supplies the SP companyId (must resolve to a company GSID). For an MDA company source, pass 'Gsid'. |
| `--due-date-plus-days` | `integer` |  | `5` | Due-date offset in days from rule run (default 5) |
| `--due-date-skip-option` | `string` |  | `"SKIP_ALL_WEEKENDS"` | Weekend handling for the due date One of: `SKIP_ALL_WEEKENDS`, `DO_NOT_SKIP`, `SKIP_SUNDAY`, `SKIP_SATURDAY`. |
| `--unique-identifier` | `array` |  | — | Field names used as uniqueness keys; repeat the flag (defaults: SuccessPlanTypeId, StatusId, Name) |
| `--task-id` | `string` |  | — | Task ID to attach the action to (e.g. 't1'). Defaults to 't1' for SIMPLE rules; required for COMPLEX rules unless --task-name is provided. |
| `--task-name` | `string` |  | — | Task name — alternative to --task-id; resolved case-insensitively. Mutually exclusive with --task-id. |
| `--criteria-id` | `string` |  | — | Optional — scope the action to a specific criteria (e.g. 'c1'). Mutually exclusive with --criteria-name. |
| `--criteria-name` | `string` |  | — | Optional — alternative to --criteria-id; resolved case-insensitively against the rule's criteria for the chosen task. |
| `--relationship-id` | `string` |  | — | Required for Relationship entity rules. Source field that supplies the relationship GSID (mapped to 'RelationshipId' on cta_group). |

**Examples**

```bash
gs-admin re r edit-action success-plan --action-id <action-id> --name <name> --type <type> --status <status>
```

### `gs-admin rules-engine rules edit-action update-cta`
*Short form:* `gs-admin re r edit-action update-cta`
*Path:* Rule operations › Update a typed action already attached to a rule

Edit an existing Update-CTA action on a rule

Update a CTA_UPDATE action already attached to a rule. Requires --action-id (from `re r list-and-describe`). All other flags are identical to `re r add-action update-cta` — the full mapping set is rebuilt from the supplied values. Omitting an optional flag (e.g. --status, --comments) removes the previous value.

**MCP tool:** `rules_engine_edit_rule_action_update_cta` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `PUT /v3/rulesengine/{{ruleId}}/actions` _(update)_, `GET /v1/rulesengine/v2/{{ruleId}}` _(ruleDetail)_, `GET /v1/api/describe/mda/{{objectName}}` _(describeTargetObject)_, `GET /v1/api/reporting/describe/{{type}}/{{objectName}}` _(describeSourceObject)_, `POST /v1/cockpit/admin-v2/types/list` _(ctaTypesList)_, `GET /v1/cockpit/admin/cta/type/{{typeId}}/advancedInfo` _(ctaTypeAdvancedInfo)_, `GET /v1/cockpit/admin-v2/playbook/` _(ctaPlaybookList)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--action-id` | `string` | ✓ | — | ID of the existing action to edit — visible in `gs-admin re r list-and-describe --rule-id <id>`. |
| `--rule-id` | `string` |  | — | Rule GUID |
| `--rule-name` | `string` |  | — | Rule name — searches list and picks first match (exact > contains) |
| `--cta-id` | `string` | ✓ | — | Required. Source field that identifies the CTA to update — must resolve to a CTA GSID (meta.GAINSIGHT.key=GS_CALL_TO_ACTION_ID, or a lookup to call_to_action). Supports lookup chains up to 3 hops. This is the sole match key; no --company-id is needed. |
| `--type` | `string` |  | — | CTA type — label or GSID. Required when setting --status/--reason/--priority/--playbook. |
| `--status` | `string` |  | — | New CTA status — label or GSID. Requires --type. |
| `--reason` | `string` |  | — | New CTA reason — label or GSID. Requires --type. |
| `--priority` | `string` |  | — | New CTA priority — label or GSID. Requires --type. |
| `--playbook` | `string` |  | — | New playbook — label or GSID. Requires --type. |
| `--owner-source-field` | `string` |  | — | Optional. Source field on the rule's source object that supplies the new CTA owner (a user GSID), written to the OwnerId field. Accepts a direct fieldName/label or a lookup chain up to 3 hops (e.g. 'Csm', 'CSM -> GSID'). When omitted, no owner mapping is written. |
| `--default-owner` | `string` |  | — | Fallback owner user GSID applied when the owner source field is null at runtime. Only used together with --owner-source-field. |
| `--comments` | `string` |  | — | CTA comments to apply (rich-text HTML). Combined with --update-comment. |
| `--update-comment` | `string` |  | `"APPEND"` | How --comments is applied to the existing CTA comment (default APPEND). Only used when --comments is set. One of: `APPEND`, `REPLACE`. |
| `--mapping` | `array` |  | — | Extra mapping spec for custom call_to_action fields; repeat the flag. Format: 'TargetField=value:<literal>' or 'TargetField=field:<sourceField>' (source chain depth ≤ 3). Reserved target fields (Gsid, TypeId, StatusId, ReasonId, PriorityId, PlaybookId, Comments) are managed via semantic flags and cannot be set here. |
| `--mappings-file` | `string` |  | — | Path to a JSON file with extra mappings. Same shape as --mapping but as objects. Combined with --mapping when both are passed. |
| `--description` | `string` |  | — | Action description (optional) |
| `--task-id` | `string` |  | — | Task ID (e.g. 't1'). Mutually exclusive with --task-name. |
| `--task-name` | `string` |  | — | Task name (case-insensitive). Mutually exclusive with --task-id. |
| `--criteria-id` | `string` |  | — | Optional — scope to a specific criteria. Mutually exclusive with --criteria-name. |
| `--criteria-name` | `string` |  | — | Optional — alternative to --criteria-id (case-insensitive). |

**Examples**

```bash
gs-admin re r edit-action update-cta --action-id <action-id> --cta-id <cta-id>
```

### `gs-admin rules-engine rules edit-action update-success-plan`
*Short form:* `gs-admin re r edit-action update-success-plan`
*Path:* Rule operations › Update a typed action already attached to a rule

Edit an existing Update Success Plan action on a rule

Update a Success Plan update (SP_UPSERT by GSID) action already attached to a rule. Requires --action-id. All other flags are identical to `re r add-action update-success-plan` — the full mapping set is rebuilt.

**MCP tool:** `rules_engine_edit_rule_action_update_success_plan` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `PUT /v3/rulesengine/{{ruleId}}/actions` _(update)_, `GET /v1/rulesengine/v2/{{ruleId}}` _(ruleDetail)_, `GET /v1/api/describe/mda/{{objectName}}` _(describeTargetObject)_, `GET /v1/api/reporting/describe/{{type}}/{{objectName}}` _(describeSourceObject)_, `POST /v1/successPlan/admin-v2/types/list` _(spTypesList)_, `GET /v1/successPlan/admin-v2/templates` _(spTemplatesList)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--action-id` | `string` | ✓ | — | ID of the existing action to edit — visible in `gs-admin re r list-and-describe --rule-id <id>`. |
| `--rule-id` | `string` |  | — | Rule GUID |
| `--rule-name` | `string` |  | — | Rule name — searches list and picks first match (exact > contains) |
| `--type` | `string` | ✓ | — | Success Plan type — label or GSID. Resolved against `successPlan/admin-v2/types/list`. |
| `--status` | `string` | ✓ | — | Success Plan status — label or GSID. Must be a valid status for the chosen type. |
| `--success-plan-id` | `string` | ✓ | — | REQUIRED. Field on the rule's source object that stores the Success Plan GSID. Must have meta.GAINSIGHT.key="GS_SUCCESS_PLAN_ID" or look up to "cta_group". |
| `--template` | `string` |  | — | Template to apply — label or GSID. Optional. |
| `--description` | `string` |  | — | Action description (optional) |
| `--owner-source-field` | `string` |  | — | Optional. Source field supplying the SP owner (user GSID). Accepts fieldName or lookup chain. |
| `--default-owner` | `string` |  | — | Optional. Default owner user GSID. |
| `--task-id` | `string` |  | — | Task ID (e.g. 't1'). Defaults to 't1' for SIMPLE rules. |
| `--task-name` | `string` |  | — | Task name — alternative to --task-id. |
| `--criteria-id` | `string` |  | — | Optional — scope the action to a specific criteria (e.g. 'c1'). |
| `--criteria-name` | `string` |  | — | Optional — alternative to --criteria-id. |

**Examples**

```bash
gs-admin re r edit-action update-success-plan --action-id <action-id> --type <type> --status <status> --success-plan-id <success-plan-id>
```

### `gs-admin rules-engine rules event-curl`
*Short form:* `gs-admin re r event-curl`
*Path:* Rule operations

Show the cURL for a rule's event trigger

Print the cURL command that publishes the Events Framework event a rule is subscribed to — useful for testing the trigger. Provide --id or --name.

**MCP tool:** `rules_engine_event_curl` · **Mutating:** no · **Output:** `status` · **Endpoint(s):** `GET /v1/api/eventrule/{{ruleId}}/event-curl` _(eventCurl)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` |  | — | Rule GUID (from `re r list`) |
| `--name` | `string` |  | — | Rule name — searches list and picks first match (exact > contains) |

**Examples**

```bash
gs-admin re r event-curl
```

### `gs-admin rules-engine rules events`
*Short form:* `gs-admin re r events`
*Path:* Rule operations

List events published on a topic

List the events published on an Events Framework topic, with their versions. Provide --topic (from `re r topics`). Use the event name with `re r schedule-event`.

**MCP tool:** `rules_engine_events` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v1/api/datahighway/events/events` _(events)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--topic` | `string` |  | — | Topic name (from `re r topics`) |

**Examples**

```bash
gs-admin re r events
```

### `gs-admin rules-engine rules execution`
*Short form:* `gs-admin re r execution`
*Path:* Rule operations

Describe a single rule execution (with optional drilldown)

Get full details for a single rule execution: task → criteria → action results. Provide --id (ruleId from `re r list`) or --name to identify the rule, plus --status-id (statusId from `re r executions`). Optional drilldown: pass --task-id, --criteria-id, or --action-id to filter the runtime view AND fetch the rule's configuration (tasks/criteria/actions/implicit) at execution time, scoped to the same target. --action-id auto-scopes the parent task and criterion.

**MCP tool:** `rules_engine_describe_execution` · **Mutating:** no · **Output:** `detail` · **Endpoint(s):** `GET /v1/rulesengine/executionHistory/{{ruleId}}/{{statusId}}` _(fetch)_, `GET /v1/rulesengine/executionHistory/{{ruleId}}/{{statusId}}/ruleState` _(state)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` |  | — | Rule GUID (ruleId field from list-rules) |
| `--name` | `string` |  | — | Rule name — searches list and picks first match |
| `--status-id` | `string` | ✓ | — | Execution status/job ID (statusId from `re r executions`) |
| `--task-id` | `string` |  | — | Drill down to a specific task; also fetches rule-state config |
| `--criteria-id` | `string` |  | — | Drill down to a specific criterion; also fetches rule-state config |
| `--action-id` | `string` |  | — | Drill down to a specific action; auto-scopes parent task + criterion and fetches rule-state config |

**Examples**

```bash
gs-admin re r execution --status-id <status-id>
```

### `gs-admin rules-engine rules executions`
*Short form:* `gs-admin re r executions`
*Path:* Rule operations

List execution history for a rule

Fetch the execution history for a single Rules Engine rule, ordered by createdDate DESC by default. Provide --id (ruleId from `re r list`) or --name (searches and picks first match). Each row carries status, processResult, trigger type, start/end time, and the statusId you can use to drill into a specific run.

**MCP tool:** `rules_engine_list_rule_executions` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v1/rulesengine/executionHistory/{{ruleId}}` _(list)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` |  | — | Rule GUID (ruleId field from list-rules) |
| `--name` | `string` |  | — | Rule name — searches list and picks first match |
| `--page` | `integer` |  | `1` | Page number (starts at 1) |
| `--size` | `integer` |  | `50` | Page size (max executions per page) |
| `--sort` | `string` |  | `"createdDate,DESC"` | Sort spec, e.g. createdDate,DESC |

**Examples**

```bash
gs-admin re r executions
```

### `gs-admin rules-engine rules folders list`
*Short form:* `gs-admin re r folders list`
*Path:* Rule operations › Rule folder operations

List Rules Engine folders

List all folders available in Rules Engine, including the default 'Uncategorized' folder. Used to look up folderId before `re r create` (or pass --folder-name on create and let resolution happen automatically).

**MCP tool:** `rules_engine_list_folders` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `POST /v3/bi/assetexplorer/getAssets` _(fetch)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--name` | `string` |  | — | Filter by folder name (case-insensitive contains) |
| `--limit` | `integer` |  | — | Max number of folders to return |

**Examples**

```bash
gs-admin re r folders list
```

### `gs-admin rules-engine rules list`
*Short form:* `gs-admin re r list`
*Path:* Rule operations

List Rules Engine rules

List Rules Engine rules with pagination and optional filters. Supports filtering by name (--search), status (--status active|inactive), folder (--folder-id), execution type, entity, area, dates, and more. Each row carries _ruleType and _statusText. Use `re r describe` for full details.

**MCP tool:** `rules_engine_list_rules` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `POST /v2/rulesengine/list` _(list)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--page` | `integer` |  | `1` | Page number |
| `--limit` | `integer` |  | `20` | Number of rules per page |
| `--search` | `string` |  | — | Filter rules by name (partial match) |
| `--status` | `string` |  | — | Filter by rule status One of: `active`, `inactive`. |
| `--folder-id` | `integer` |  | — | Filter by folder ID |
| `--filter-area` | `string` |  | — | Filter by action area name(s), comma-separated (e.g. 'CTAs,Tasks') |
| `--filter-created-by` | `string` |  | — | Filter by creator user ID(s), comma-separated |
| `--filter-created-date` | `string` |  | — | Filter by created date literal: TODAY, THIS_WEEK, LAST_WEEK, LAST_MONTH, LAST_QUARTER, THIS_YEAR, or last_N_days (e.g. last_30_days) |
| `--filter-execution-type` | `string` |  | — | Filter by execution type(s), comma-separated: SCHEDULE, EVENT, NONE |
| `--filter-modified-by` | `string` |  | — | Filter by modifier user ID(s), comma-separated |
| `--filter-modified-date` | `string` |  | — | Filter by modified date literal: TODAY, THIS_WEEK, LAST_WEEK, LAST_MONTH, LAST_QUARTER, THIS_YEAR, or last_N_days |
| `--filter-entity` | `string` |  | — | Filter by entity/object name(s), comma-separated |
| `--filter-chain` | `string` |  | — | Filter by rule chain name(s) or ID(s), comma-separated |
| `--filter-entity-type` | `string` |  | — | Filter by entity type (e.g. COMPANY, RELATIONSHIP) |
| `--filter-source` | `string` |  | — | Filter by source object name(s), comma-separated |
| `--filter-target-object` | `string` |  | — | Filter by action target object name(s), comma-separated |
| `--sort-field` | `string` |  | — | Field to sort by |
| `--sort-dir` | `string` |  | `"DESC"` | Sort direction One of: `ASC`, `DESC`. |

**Examples**

```bash
gs-admin re r list
```

### `gs-admin rules-engine rules list-and-describe`
*Short form:* `gs-admin re r list-and-describe`
*Path:* Rule operations

List all rules and fetch details for each

Fetch every Rules Engine rule and retrieve its full details (source object, action type, field mapping count). Supports the same filters as `re r list`. Returns a summary table; use --format json for full payloads.

**MCP tool:** `rules_engine_list_and_describe_rules` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `POST /v2/rulesengine/list` _(list)_, `GET /v1/rulesengine/v2/{{ruleId}}` _(fetch)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--search` | `string` |  | — | Filter rules by name (partial match) |
| `--limit` | `integer` |  | — | Max number of rules to describe (default: all matching) |
| `--status` | `string` |  | — | Filter by rule status One of: `active`, `inactive`. |
| `--folder-id` | `integer` |  | — | Filter by folder ID |
| `--filter-area` | `string` |  | — | Filter by action area name(s), comma-separated (e.g. 'CTAs,Tasks') |
| `--filter-created-by` | `string` |  | — | Filter by creator user ID(s), comma-separated |
| `--filter-created-date` | `string` |  | — | Filter by created date literal: TODAY, THIS_WEEK, LAST_WEEK, LAST_MONTH, LAST_QUARTER, THIS_YEAR, or last_N_days (e.g. last_30_days) |
| `--filter-execution-type` | `string` |  | — | Filter by execution type(s), comma-separated: SCHEDULE, EVENT, NONE |
| `--filter-modified-by` | `string` |  | — | Filter by modifier user ID(s), comma-separated |
| `--filter-modified-date` | `string` |  | — | Filter by modified date literal: TODAY, THIS_WEEK, LAST_WEEK, LAST_MONTH, LAST_QUARTER, THIS_YEAR, or last_N_days |
| `--filter-entity` | `string` |  | — | Filter by entity/object name(s), comma-separated |
| `--filter-chain` | `string` |  | — | Filter by rule chain name(s) or ID(s), comma-separated |
| `--filter-entity-type` | `string` |  | — | Filter by entity type (e.g. COMPANY, RELATIONSHIP) |
| `--filter-source` | `string` |  | — | Filter by source object name(s), comma-separated |
| `--filter-target-object` | `string` |  | — | Filter by action target object name(s), comma-separated |
| `--page` | `integer` |  | `1` | Page number |
| `--sort-field` | `string` |  | — | Field to sort by |
| `--sort-dir` | `string` |  | `"DESC"` | Sort direction One of: `ASC`, `DESC`. |

**Examples**

```bash
gs-admin re r list-and-describe
```

### `gs-admin rules-engine rules list-external-actions`
*Short form:* `gs-admin re r list-external-actions`
*Path:* Rule operations

List configured External Actions (REST_API callouts)

Tenant-wide list of External Actions — the named callouts you can attach to rule actions via `re r add-action external-action`. Each row shows the callout's configId, name, target URL (path/query masked by default; --show-secrets reveals), connection it lives on, and the count of fields the callout exposes (these are the targets you must cover with --mapping). Filter client-side by --connection-id and/or --name.

**MCP tool:** `rules_engine_list_external_actions` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v1/api/callout/config/all` _(fetch)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--connection-id` | `string` |  | — | Filter to callouts on this REST_API connection (client-side). |
| `--name` | `string` |  | — | Filter by callout name (case-insensitive contains, applied client-side). |
| `--limit` | `integer` |  | — | Max number of callouts to return |
| `--show-secrets` | `boolean` |  | `false` | Reveal raw URL path/query (default: masked as host/****). Use with care — output may end up in shell history or pipelines. |

**Examples**

```bash
gs-admin re r list-external-actions
```

### `gs-admin rules-engine rules list-rest-connections`
*Short form:* `gs-admin re r list-rest-connections`
*Path:* Rule operations

List configured REST_API connections (for External Actions)

Tenant-wide list of REST_API connections, used as the connection layer for External Actions. The returned `connectionId` is what each callout's `config.connectionId` points to.

**MCP tool:** `rules_engine_list_rest_connections` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v1/api/connector/connection/REST_API` _(fetch)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--name` | `string` |  | — | Filter by connection name (case-insensitive contains, applied client-side) |
| `--limit` | `integer` |  | — | Max number of connections to return |

**Examples**

```bash
gs-admin re r list-rest-connections
```

### `gs-admin rules-engine rules list-task-outputs`
*Short form:* `gs-admin re r list-task-outputs`
*Path:* Rule operations

List a rule's source fields — available for criteria and action mappings

Show every source field for every task on a rule. Use this BEFORE `re r add-criteria` or `re r add-action external-action --mapping <target>=<source>` to discover what's available on the source side. Works for both rule types: COMPLEX rules call `/taskOutputs` (which carries join-aware key prefixes from merge tasks); SOF (Single-Object-Flow) rules fall back to describing the source object directly (since /taskOutputs returns 'Invalid ruleType' for SOF). Output columns are uniform regardless: Field Name / Key / Data Type / Label / Object — exactly what the resolvers match against (case-insensitive on fieldName, key, or label). Optional --task-id narrows to one task on COMPLEX rules.

**MCP tool:** `rules_engine_list_task_outputs` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v2/rulesengine/{{ruleId}}/taskOutputs` _(fetch)_, `GET /v1/rulesengine/v2/{{ruleId}}` _(ruleDetail)_, `GET /v1/api/reporting/describe/{{type}}/{{objectName}}` _(describeSourceObject)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--rule-id` | `string` | ✓ | — | Rule ID (from `re r list`) |
| `--task-id` | `string` |  | — | Optional — narrow to one task (e.g. `t1`, `t2`). |
| `--name` | `string` |  | — | Filter by field name or label (case-insensitive contains) |
| `--limit` | `integer` |  | — | Max fields to return per task |

**Examples**

```bash
gs-admin re r list-task-outputs --rule-id <rule-id>
```

### `gs-admin rules-engine rules relationship-types list`
*Short form:* `gs-admin re r relationship-types list`
*Path:* Rule operations › Relationship type operations

List relationship types

List all relationship types defined in the tenant. Used to look up a relationship Type ID (Gsid) when creating a rule with --entity Relationship.

**MCP tool:** `rules_engine_list_relationship_types` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v1/galaxy/relationship/type` _(fetch)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--name` | `string` |  | — | Filter by relationship type name (case-insensitive contains) |
| `--limit` | `integer` |  | — | Max number of relationship types to return |

**Examples**

```bash
gs-admin re r relationship-types list
```

### `gs-admin rules-engine rules run-now`
*Short form:* `gs-admin re r run-now`
*Path:* Rule operations

Trigger an immediate on-demand run of a rule

Triggers an on-demand execution of a Bionic rule. Provide --id or --name to identify the rule. By default the run uses today's date and runs in live mode. Pass --test-run to execute in test mode (no writes). Pass --date to override the rule date (YYYY-MM-DD). Pass --email (repeatable) to receive completion notifications. Pass --non-peak-hours to defer the run until off-peak hours.

**MCP tool:** `rules_engine_run_now` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `POST /v1/rulesengine/{{ruleId}}` _(execute)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` |  | — | Rule GUID (from `re r list`) |
| `--name` | `string` |  | — | Rule name — searches list and picks first match (exact > contains) |
| `--test-run` | `boolean` |  | `false` | When true, executes in test mode — criteria are evaluated but no action writes are committed (default: false) |
| `--date` | `string` |  | — | Rule date to use for execution in YYYY-MM-DD format (default: today) |
| `--email` | `any` |  | — | Email address(es) to notify on completion. Repeat --email for multiple. |
| `--non-peak-hours` | `boolean` |  | `false` | When true, defers execution until off-peak hours (default: false) |

**Examples**

```bash
gs-admin re r run-now
```

### `gs-admin rules-engine rules s3-tasks`
*Short form:* `gs-admin re r s3-tasks`
*Path:* Rule operations

List a rule's S3 Dataset tasks

List the S3 Dataset (S3_EXTRACT) tasks on a rule that can trigger an S3 File Ingestion schedule. Provide --id (rule GUID) or --name. Use the Task ID with `re r schedule-s3` (or `re c schedule-s3 --rule <id>`).

**MCP tool:** `rules_engine_s3_tasks` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v1/rulesengine/v2/{{ruleId}}` _(ruleDetail)_, `GET /v1/bionicreporting/config-ui/{{ddConfigId}}/tasks` _(horizonTasks)_, `GET /v1/rulesengine/{{ruleId}}/tasks` _(bionicTasks)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` |  | — | Rule GUID (from `re r list`) |
| `--name` | `string` |  | — | Rule name — searches list and picks first match (exact > contains) |

**Examples**

```bash
gs-admin re r s3-tasks
```

### `gs-admin rules-engine rules schedule`
*Short form:* `gs-admin re r schedule`
*Path:* Rule operations

Set or update a CRON schedule for a rule

Saves a CRON-based schedule for a Bionic rule. Provide --id or --name to identify the rule and --cron with a Quartz 6-field cron expression (second minute hour day-of-month month day-of-week). Optional: --timezone (IANA, default UTC), --start-time, --end-time (ISO date or epoch ms), --past-runs-also, --email (failure notifications, repeatable), --email-success (success notifications, repeatable), --send-email, --skip-write-locks.

**MCP tool:** `rules_engine_schedule_rule` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `POST /v1/api/rules/schedule/{{ruleId}}` _(schedule)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` |  | — | Rule GUID (from `re r list`) |
| `--name` | `string` |  | — | Rule name — searches list and picks first match (exact > contains) |
| `--cron` | `string` | ✓ | — | Quartz 6-field cron expression, e.g. '0 0 0 * * ?' (daily at midnight). Fields: second minute hour day-of-month month day-of-week |
| `--timezone` | `string` |  | — | IANA timezone name (e.g. 'Asia/Kolkata', 'America/New_York'). Defaults to UTC. |
| `--start-time` | `string` | ✓ | — | Schedule window start — ISO date string (e.g. '2025-06-18') or epoch milliseconds |
| `--end-time` | `string` |  | — | Schedule window end — ISO date string (e.g. '2025-12-31') or epoch milliseconds |
| `--past-runs-also` | `boolean` |  | — | If true, also executes for past scheduled times that were missed |
| `--email` | `any` |  | — | Email address(es) to notify on rule failure. Repeat --email for multiple. Enables email notifications when provided. |
| `--email-success` | `any` |  | — | Email address(es) to notify on rule success. Repeat --email-success for multiple. |
| `--send-email` | `boolean` |  | — | Explicitly enable or disable email notifications. Auto-enabled when --email or --email-success are provided. |
| `--skip-write-locks` | `boolean` |  | `false` | Run mode: false = Optimise run with other Rules (default); true = Run independent of other Rules |

**Examples**

```bash
gs-admin re r schedule --cron <cron-expression> --start-time <start-time>
```

### `gs-admin rules-engine rules schedule-basic`
*Short form:* `gs-admin re r schedule-basic`
*Path:* Rule operations

Set a time-based schedule using the Basic frequency picker

Saves a time-based schedule for a Bionic rule using the Basic scheduler (a friendly DAILY/WEEKLY/MONTHLY frequency picker) instead of a raw cron. Mirrors the UI's Basic tab: the frequency is translated to a Quartz cron and saved, with jobContext.type='Basic' so the rule re-opens on the Basic tab. Provide --id or --name plus --frequency and its options. Required: --frequency (DAILY|WEEKLY|MONTHLY) and --start-time. Time of day: --at HH:mm (default 00:00), OR a repeating window with --from HH:mm --to HH:mm --every-hours N. DAILY: --daily-mode (every-day|every-weekday|every-x-days) and --interval-days for every-x-days. WEEKLY: --days (e.g. MON,WED,FRI). MONTHLY: either --day-of-month (1-31 or L) OR --week-day + --week-number (1-4 or L), with optional --every-months. Optional common flags: --timezone, --end-time, --email, --email-success, --send-email, --skip-write-locks, --past-runs-also. For a raw cron use `re r schedule`; to preview run times use `re r test-schedule`.

**MCP tool:** `rules_engine_schedule_rule_basic` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `POST /v1/api/rules/schedule/{{ruleId}}` _(schedule)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` |  | — | Rule GUID (from `re r list`) |
| `--name` | `string` |  | — | Rule name — searches list and picks first match (exact > contains) |
| `--frequency` | `string` | ✓ | — | Schedule frequency: DAILY, WEEKLY, or MONTHLY One of: `DAILY`, `WEEKLY`, `MONTHLY`, `daily`, `weekly`, `monthly`. |
| `--at` | `string` |  | — | Run time in 24-hour HH:mm (e.g. 09:30). Default 00:00. Ignored when --from/--to/--every-hours are used. |
| `--from` | `string` |  | — | Repeating window start time HH:mm (use with --to and --every-hours) |
| `--to` | `string` |  | — | Repeating window end time HH:mm (use with --from and --every-hours) |
| `--every-hours` | `integer` |  | — | Repeat every N hours within the --from/--to window. Allowed: 1-6 and must be ≤ the window size in hours (matches the UI's 'Every' options). |
| `--daily-mode` | `string` |  | — | DAILY only: every-day (default), every-weekday (Mon–Fri), or every-x-days (with --interval-days) One of: `every-day`, `every-weekday`, `every-x-days`. |
| `--interval-days` | `integer` |  | — | DAILY every-x-days only: run every N days |
| `--days` | `any` |  | — | WEEKLY only: weekday(s) to run on, e.g. MON,WED,FRI (or repeat --days). Valid: SUN MON TUE WED THU FRI SAT. |
| `--day-of-month` | `string` |  | — | MONTHLY 'particular date': day 1-31, or L for last day of month |
| `--week-day` | `string` |  | — | MONTHLY 'particular weekday': SUN–SAT (use with --week-number) |
| `--week-number` | `string` |  | — | MONTHLY 'particular weekday': which occurrence — 1-4, or L for last (use with --week-day) |
| `--every-months` | `integer` |  | — | MONTHLY only: run every N months (default 1) |
| `--timezone` | `string` |  | — | IANA timezone name (e.g. 'Asia/Kolkata', 'America/New_York'). Defaults to UTC. |
| `--start-time` | `string` | ✓ | — | Schedule window start — ISO date string (e.g. '2025-06-18') or epoch milliseconds |
| `--end-time` | `string` |  | — | Schedule window end — ISO date string (e.g. '2025-12-31') or epoch milliseconds |
| `--past-runs-also` | `boolean` |  | — | If true, also executes for past scheduled times that were missed |
| `--email` | `any` |  | — | Email address(es) to notify on rule failure. Repeat --email for multiple. Enables email notifications when provided. |
| `--email-success` | `any` |  | — | Email address(es) to notify on rule success. Repeat --email-success for multiple. |
| `--send-email` | `boolean` |  | — | Explicitly enable or disable email notifications. Auto-enabled when --email or --email-success are provided. |
| `--skip-write-locks` | `boolean` |  | `false` | Run mode: false = Optimise run with other Rules (default); true = Run independent of other Rules |

**Examples**

```bash
gs-admin re r schedule-basic --frequency <frequency> --start-time <start-time>
```

### `gs-admin rules-engine rules schedule-event`
*Short form:* `gs-admin re r schedule-event`
*Path:* Rule operations

Schedule a rule on an Events Framework event

Subscribe a rule to an Events Framework event (event-based trigger). Provide --id or --name, plus --topic and --event (discover with `re r topics` and `re r events --topic`). Pass --email / --email-success (repeatable) and --send-email to configure failure/success notifications.

**MCP tool:** `rules_engine_schedule_event` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `GET /v1/api/datahighway/events/topics` _(topics)_, `GET /v1/api/datahighway/events/events` _(events)_, `POST /v1/api/eventrule/event-subscribe` _(saveEvent)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` |  | — | Rule GUID (from `re r list`) |
| `--name` | `string` |  | — | Rule name — searches list and picks first match (exact > contains) |
| `--topic` | `string` |  | — | Topic name (from `re r topics`) |
| `--event` | `string` |  | — | Event name (from `re r events --topic "<topic>"`) |
| `--email` | `any` |  | — | Email address(es) to notify on rule failure. Repeat --email for multiple. Enables email notifications when provided. |
| `--email-success` | `any` |  | — | Email address(es) to notify on rule success. Repeat --email-success for multiple. |
| `--send-email` | `boolean` |  | — | Explicitly enable email notifications. Auto-enabled when --email or --email-success are provided. |
| `--skip-write-locks` | `boolean` |  | `false` | Run mode: false = optimise run with other rules (default); true = run independent of other rules. |

**Examples**

```bash
gs-admin re r schedule-event
```

### `gs-admin rules-engine rules schedule-s3`
*Short form:* `gs-admin re r schedule-s3`
*Path:* Rule operations

Schedule a rule on S3 file upload

Trigger a rule when a file is uploaded to one of its S3 Dataset tasks (S3 File Ingestion). Provide --id or --name and --task-id (discover with `re r s3-tasks --id <ruleId>`). Pass --email / --email-success (repeatable) and --send-email to configure notifications.

**MCP tool:** `rules_engine_schedule_s3` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `GET /v1/rulesengine/v2/{{ruleId}}` _(ruleDetail)_, `GET /v1/bionicreporting/config-ui/{{ddConfigId}}/tasks` _(horizonTasks)_, `GET /v1/rulesengine/{{ruleId}}/tasks` _(bionicTasks)_, `POST /v2/rulesengine/event-subscribe` _(saveS3)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` |  | — | Rule GUID (from `re r list`) |
| `--name` | `string` |  | — | Rule name — searches list and picks first match (exact > contains) |
| `--task-id` | `string` |  | — | S3 Dataset task ID (from `re r s3-tasks --id <ruleId>`). Alternative to --task-name. |
| `--task-name` | `string` |  | — | S3 Dataset name to schedule on (from `re r s3-tasks`). Resolves to the task ID; use when a rule has multiple S3 tasks. |
| `--email` | `any` |  | — | Email address(es) to notify on rule failure. Repeat --email for multiple. Enables email notifications when provided. |
| `--email-success` | `any` |  | — | Email address(es) to notify on rule success. Repeat --email-success for multiple. |
| `--send-email` | `boolean` |  | — | Explicitly enable email notifications. Auto-enabled when --email or --email-success are provided. |
| `--skip-write-locks` | `boolean` |  | `false` | Run mode: false = optimise run with other rules (default); true = run independent of other rules. |

**Examples**

```bash
gs-admin re r schedule-s3
```

### `gs-admin rules-engine rules schedules`
*Short form:* `gs-admin re r schedules`
*Path:* Rule operations

Show the schedules configured on a rule

Lists every schedule configured on a Bionic rule, classified and summarized by type: BASIC / ADVANCED (time-based CRON) and EVENT / S3_UPLOAD (event-based). The schedules endpoint returns all kinds, so a rule may show more than one. Provide --id (rule GUID) or --name.

**MCP tool:** `rules_engine_list_rule_schedules` · **Mutating:** no · **Output:** `status` · **Endpoint(s):** `GET /v1/api/eventrule/{{ruleId}}/{{jobType}}/schedules` _(eventSchedules)_, `GET /v1/rulesengine/workflow/getexternalids` _(chainExternalIds)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` |  | — | Rule GUID (from `re r list`) |
| `--name` | `string` |  | — | Rule name — searches list and picks first match (exact > contains) |

**Examples**

```bash
gs-admin re r schedules
```

### `gs-admin rules-engine rules set-source`
*Short form:* `gs-admin re r set-source`
*Path:* Rule operations

Set the source object for a rule (Step 2 — SOF)

Configure the data source on a rule using Single Object Flow. Provide --rule-id (from `re r list`) or --rule-name (case-insensitive contains). Required: --type (MDA or SFDC) and --object-name. For SFDC tenants with multiple connections, supply --connection-id or --connection-name; with a single SFDC connection or for MDA the connection is auto-resolved. The object name is validated against `re r sources objects` for the chosen connection before the PUT — invalid object names fail fast with the available list. Works on both freshly-created rules and existing rules being edited.

**MCP tool:** `rules_engine_set_rule_source` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `PUT /v1/rulesengine/{{ruleId}}/tasks/flow-update` _(update)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--rule-id` | `string` |  | — | Rule GUID (ruleId from list-rules) |
| `--rule-name` | `string` |  | — | Rule name — searches list and picks first match (exact > contains) |
| `--type` | `string` | ✓ | — | Source connection type (MDA or SFDC) One of: `MDA`, `SFDC`. |
| `--connection-id` | `string` |  | — | Connection ID — required for SFDC when 2+ connections exist (unless --connection-name is given). Auto-resolved for MDA and single-SFDC. |
| `--connection-name` | `string` |  | — | Connection name — alternative to --connection-id (case-insensitive: exact > contains) |
| `--object-name` | `string` | ✓ | — | Technical object name (e.g. 'company', 'Account'). Validated against `re r sources objects` for the resolved connection. |
| `--object-label` | `string` |  | — | Display label for the object — auto-resolved from the objects list when omitted |

**Examples**

```bash
gs-admin re r set-source --type <type> --object-name <object-name>
```

### `gs-admin rules-engine rules set-source-template`
*Short form:* `gs-admin re r set-source-template`
*Path:* Rule operations

Attach a Data Designer template as a rule's source (Step 2 — COMPLEX flow)

Attach a Design Template to a Horizon rule as its data-preparation source — the COMPLEX-flow alternative to `re r set-source` (which configures a single object via SOF). Provide --rule-id (or --rule-name) plus --template-id (or --template-name). The handler (1) fetches the rule to read its server-assigned ddConfigId, (2) POSTs the template-attach call which copies the template's data-prep config onto the rule, (3) marks the rule's tasksType as COMPLEX. Discover available templates with `re r templates list`. Templates without a saved data-prep config are filtered out at discovery time and cannot be attached. Works on freshly-created rules and on existing HORIZON rules being edited; fails fast for legacy MDA rules (no ddConfigId).

**MCP tool:** `rules_engine_set_rule_source_template` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `GET /v1/rulesengine/v2/{{ruleId}}` _(ruleDetail)_, `POST /v1/bionicreporting/designTemplates/save/config` _(attachTemplate)_, `PUT /v1/rulesengine/{{ruleId}}/tasks/flow-update` _(flowUpdate)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--rule-id` | `string` |  | — | Rule GUID (ruleId from `re r list`) |
| `--rule-name` | `string` |  | — | Rule name — searches list and picks first match (exact > contains) |
| `--template-id` | `string` |  | — | Design Template ID (templateId from `re r templates list`) |
| `--template-name` | `string` |  | — | Design Template name — resolved via `re r templates list` (case-insensitive: exact > contains) |

**Examples**

```bash
gs-admin re r set-source-template
```

### `gs-admin rules-engine rules sources fields`
*Short form:* `gs-admin re r sources fields`
*Path:* Rule operations › Source connection and object discovery

List fields available on a source object

List the fields exposed by a source object (MDA or SFDC). Use this BEFORE `re r add-criteria` to discover the exact field names, labels, and data types you can reference in conditions. Provide --object-name OR walk a lookup chain via --lookup-from + --lookup-field (dot-notation, up to 2 lookup hops, e.g. `--lookup-from company --lookup-field Csm.Manager`). Optional: --connection-id (defaults to type for MDA), --name filter, --limit.

**MCP tool:** `rules_engine_list_source_fields` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v1/api/reporting/describe/{{type}}/{{objectName}}` _(fetch)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--type` | `string` | ✓ | — | Source connection type One of: `MDA`, `SFDC`. |
| `--object-name` | `string` |  | — | Technical object name (e.g. 'company', 'Account'). Provide this OR --lookup-from + --lookup-field. |
| `--lookup-from` | `string` |  | — | Parent object name to start the lookup walk from (e.g. 'company'). Used together with --lookup-field. |
| `--lookup-field` | `string` |  | — | Dot-separated chain of lookup field names to walk from --lookup-from. E.g. 'Csm' (1 hop, returns User fields) or 'Csm.Manager' (2 hops). Max 2 hops. |
| `--connection-id` | `string` |  | — | Connection ID (defaults to the type itself for MDA) |
| `--name` | `string` |  | — | Filter by field name or label (case-insensitive contains) |
| `--limit` | `integer` |  | — | Max number of fields to return |

**Examples**

```bash
gs-admin re r sources fields --type <type>
```

### `gs-admin rules-engine rules sources list`
*Short form:* `gs-admin re r sources list`
*Path:* Rule operations › Source connection and object discovery

List available data source connections

List all configured data source connections for the tenant (MDA, SFDC, SNOWFLAKE, BIGQUERY, …). Used to look up connectionId before `re r set-source` and to discover supported source types.

**MCP tool:** `rules_engine_list_source_connections` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v1/bionicreporting/config-ui/listsources` _(fetch)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--type` | `string` |  | — | Filter by connection type (MDA, SFDC, SNOWFLAKE, …) |
| `--limit` | `integer` |  | — | Max number of connections to return |

**Examples**

```bash
gs-admin re r sources list
```

### `gs-admin rules-engine rules sources objects`
*Short form:* `gs-admin re r sources objects`
*Path:* Rule operations › Source connection and object discovery

List objects available in a source connection

List source objects exposed by a connection (MDA or SFDC). Required: --type. Optional: --connection-id (defaults to the type itself for MDA), --name filter. Used to look up objectName before `re r set-source`.

**MCP tool:** `rules_engine_list_source_objects` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v1/api/describe/listobjects/{{type}}` _(fetch)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--type` | `string` | ✓ | — | Source connection type (MDA or SFDC) One of: `MDA`, `SFDC`. |
| `--connection-id` | `string` |  | — | Connection ID (defaults to the type itself for MDA) |
| `--name` | `string` |  | — | Filter by object name or label (case-insensitive contains) |
| `--limit` | `integer` |  | — | Max number of objects to return |

**Examples**

```bash
gs-admin re r sources objects --type <type>
```

### `gs-admin rules-engine rules templates list`
*Short form:* `gs-admin re r templates list`
*Path:* Rule operations › Design Template operations (rule data preparation)

List Data Designer templates available to back a rule

List Design Templates that can be attached as the data source of a Horizon rule (the 'Design Templates' option in the rules-engine source picker). By default only templates with a saved data-prep config are returned (--non-empty true). Use --name-contains to filter case-insensitively (exact match preferred over contains). Pair with `re r set-source-template` to attach a chosen template to a rule.

**MCP tool:** `rules_engine_list_design_templates` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v1/bionicreporting/designTemplates/lite` _(fetch)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--name-contains` | `string` |  | — | Filter by template name (case-insensitive; exact match preferred over contains) |
| `--non-empty` | `boolean` |  | `true` | When true (default), exclude templates without a saved data-prep config — these cannot back a rule |
| `--limit` | `integer` |  | — | Max number of templates to return |

**Examples**

```bash
gs-admin re r templates list
```

### `gs-admin rules-engine rules test-schedule`
*Short form:* `gs-admin re r test-schedule`
*Path:* Rule operations

Preview upcoming run times for a CRON expression

Previews the next upcoming run times for a Quartz CRON expression WITHOUT saving a schedule to any rule. Calls the read-only schedule validate endpoint and prints the next runs in the requested timezone. Required: --cron (Quartz 6-field: second minute hour day-of-month month day-of-week). Optional: --timezone (IANA, default UTC), --start-time (ISO date or epoch ms; default now), --end-time, --count (default 5), --past-runs-also.

**MCP tool:** `rules_engine_test_schedule` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `POST /v1/api/schedule/validate` _(validate)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--cron` | `string` | ✓ | — | Quartz 6-field cron expression, e.g. '0 0 */4 ? * *' (every 4 hours). Fields: second minute hour day-of-month month day-of-week |
| `--timezone` | `string` |  | — | IANA timezone name (e.g. 'Asia/Kolkata', 'America/New_York'). Defaults to UTC. |
| `--start-time` | `string` |  | — | Window start for the preview — ISO date string (e.g. '2025-06-18') or epoch milliseconds. Defaults to now. |
| `--end-time` | `string` |  | — | Window end — ISO date string or epoch milliseconds. Optional. |
| `--count` | `integer` |  | — | Number of upcoming run times to preview (default 5) |
| `--past-runs-also` | `boolean` |  | — | If true, also includes past scheduled times in the window |

**Examples**

```bash
gs-admin re r test-schedule --cron <cron-expression>
```

### `gs-admin rules-engine rules topics`
*Short form:* `gs-admin re r topics`
*Path:* Rule operations

List Events Framework topics

List Data Highway event topics available for event-based rule scheduling. Use the topic name with `re r events --topic` to discover events, then `re r schedule-event`.

**MCP tool:** `rules_engine_topics` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v1/api/datahighway/events/topics` _(topics)_

**Flags**

_No flags._

**Examples**

```bash
gs-admin re r topics
```

