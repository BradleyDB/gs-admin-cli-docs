<!-- GENERATED FILE — do not edit by hand. Regenerate with: npm run build:plugin:gs-superadmin (build/build-plugin-gs-superadmin.mjs). -->

# gs-admin Cheatsheet

> Generated from CLI v1.0.9 · 188 commands / 182 MCP tools
> **Global flags go before the subcommand**: `gs-admin --json <ns> <cmd>`
> **Single-quote every free-text value** — asset names carry `|` `&` spaces and other shell metacharacters (`;` `(` `)` `$`); single quotes neutralize all of them: `--search 'CS|Risk|Renewal|Alert'`
> **Spell subcommands literally** — the guard can't inspect `gs-admin $cmd`; variables only in flag values/paths
> **Switch instances**: `gs-admin config --base-url <url>` (tokens persist per tenant) · one-off override: `gs-admin --base-url <url> <ns> <cmd>`
> **Mutating column = the catalog's own flag** — a written upstream contract since CLI 1.0.8 (side effect iff flagged, regardless of HTTP verb; the old mislabeled-writer class — `re r run-now`, the schedule/subscribe writers, `re r set-source-template` — was closed there and flagged from then on). A blank cell still is not blanket safety: the residual non-mutating POSTs are read-shaped fetches, and a future release can mislabel — the guard fail-closes on unknown commands and the plugin's ask-override list (`hooks/ask-overrides.json`) forces the prompt on any verified mislabel

## Global Flags

| Flag | Description |
|------|-------------|
| `--base-url <url>` | Override the GS_BASE_URL / saved tenant URL. |
| `--format <fmt>` | Output format: table \| json \| detail \| compact \| ids \| status. |
| `--json` | Shortcut for --format json (wins over --format). |
| `--fields <a,b,c>` | Select output columns (matched against each action's fieldsCatalog). |
| `--debug` | Enable framework debug output. |
| `--skip-version-check` | Skip the CLI/server version compatibility check. |

## Journey Orchestrator (alias: `jo`)

_Journey Orchestrator tools_

| Command | Short form | MCP tool | Mutating |
|---------|------------|----------|:--------:|
| `gs-admin journey programs list` | `gs-admin jo p list` | `journey_list_programs` |  |
| `gs-admin journey programs describe` | `gs-admin jo p describe` | `journey_describe_program` |  |
| `gs-admin journey programs publish` | `gs-admin jo p publish` | `journey_publish_program` | ⚠️ yes |
| `gs-admin journey programs pause` | `gs-admin jo p pause` | `journey_pause_program` | ⚠️ yes |
| `gs-admin journey programs resume` | `gs-admin jo p resume` | `journey_resume_program` | ⚠️ yes |
| `gs-admin journey programs stop` | `gs-admin jo p stop` | `journey_stop_program` | ⚠️ yes |
| `gs-admin journey programs create` | `gs-admin jo p create` | `journey_create_program` | ⚠️ yes |
| `gs-admin journey programs sources upload-csv` | `gs-admin jo p src upload-csv` | `journey_upload_csv_participants` | ⚠️ yes |
| `gs-admin journey programs sources csv-save` | `gs-admin jo p src csv-save` | `journey_save_csv_source` | ⚠️ yes |
| `gs-admin journey programs sources map` | `gs-admin jo p src map` | `journey_save_mapping` | ⚠️ yes |
| `gs-admin journey programs validate` | `gs-admin jo p validate` | `journey_validate` |  |
| `gs-admin journey programs cache start` | `gs-admin jo p cache start` | `journey_start_program_cache` |  |
| `gs-admin journey programs save` | `gs-admin jo p save` | `journey_save_program` | ⚠️ yes |
| `gs-admin journey programs cache discard` | `gs-admin jo p cache discard` | `journey_discard_program_cache` |  |
| `gs-admin journey programs publish-status` | `gs-admin jo p publish-status` | `journey_publish_status` |  |
| `gs-admin journey programs sources unique-criteria` | `gs-admin jo p src unique-criteria` | `journey_save_unique_criteria` | ⚠️ yes |
| `gs-admin journey programs exclusion-list` | `gs-admin jo p exclusion-list` | `journey_save_exclusion_list` | ⚠️ yes |
| `gs-admin journey programs sources csv-setup` | `gs-admin jo p src csv-setup` | `journey_setup_csv_source` | ⚠️ yes |
| `gs-admin journey programs sources dd-save` | `gs-admin jo p src dd-save` | `journey_save_dd_source` |  |
| `gs-admin journey programs sources dd-setup` | `gs-admin jo p src dd-setup` | `journey_setup_dd_source` |  |
| `gs-admin journey programs sources describe` | `gs-admin jo p src describe` | `journey_describe_program_source` |  |
| `gs-admin journey programs nodes email create` | `gs-admin jo p n e create` | `journey_create_email_node` | ⚠️ yes |
| `gs-admin journey programs nodes email set-template` | `gs-admin jo p n e set-template` | `journey_set_email_node_template` | ⚠️ yes |
| `gs-admin journey programs nodes email set-global-headers` | `gs-admin jo p n e set-global-headers` | `journey_set_email_node_global_headers` | ⚠️ yes |
| `gs-admin journey programs nodes email set-local-headers` | `gs-admin jo p n e set-local-headers` | `journey_set_email_node_local_headers` | ⚠️ yes |
| `gs-admin journey programs nodes email map-standard-tokens` | `gs-admin jo p n e map-standard-tokens` | `journey_map_email_node_standard_tokens` | ⚠️ yes |
| `gs-admin journey programs nodes email set-flags` | `gs-admin jo p n e set-flags` | `journey_set_email_node_flags` | ⚠️ yes |
| `gs-admin journey programs nodes email add` | `gs-admin jo p n e add` | `journey_add_email_node` | ⚠️ yes |
| `gs-admin journey programs nodes survey create` | `gs-admin jo p n s create` | `journey_create_survey_node` | ⚠️ yes |
| `gs-admin journey programs nodes survey set-template` | `gs-admin jo p n s set-template` | `journey_set_survey_node_template` | ⚠️ yes |
| `gs-admin journey programs nodes survey set-survey` | `gs-admin jo p n s set-survey` | `journey_set_survey_node_survey` | ⚠️ yes |
| `gs-admin journey programs nodes survey set-global-headers` | `gs-admin jo p n s set-global-headers` | `journey_set_survey_node_global_headers` | ⚠️ yes |
| `gs-admin journey programs nodes survey set-local-headers` | `gs-admin jo p n s set-local-headers` | `journey_set_survey_node_local_headers` | ⚠️ yes |
| `gs-admin journey programs nodes survey map-survey-tokens` | `gs-admin jo p n s map-survey-tokens` | `journey_map_survey_node_tokens` | ⚠️ yes |
| `gs-admin journey programs nodes survey set-flags` | `gs-admin jo p n s set-flags` | `journey_set_survey_node_flags` | ⚠️ yes |
| `gs-admin journey programs nodes survey add` | `gs-admin jo p n s add` | `journey_add_survey_node` | ⚠️ yes |
| `gs-admin journey email templates` | `gs-admin jo e templates` | `journey_list_email_templates` |  |
| `gs-admin journey email template` | `gs-admin jo e template` | `journey_get_email_template` |  |
| `gs-admin journey email connectors` | `gs-admin jo e connectors` | `journey_list_email_connectors` |  |
| `gs-admin journey email configure` | `gs-admin jo e configure` | `journey_configure_email_step` | ⚠️ yes |
| `gs-admin journey data-designer list` | `gs-admin jo dd list` | `journey_list_data_designer_objects` |  |
| `gs-admin journey data-designer get` | `gs-admin jo dd get` | `journey_get_data_designer_object` |  |
| `gs-admin journey cta options` | `gs-admin jo cta options` | `journey_list_cta_options` |  |
| `gs-admin journey surveys list` | `gs-admin jo s list` | `journey_list_surveys` |  |
| `gs-admin journey surveys get` | `gs-admin jo s get` | `journey_get_survey` |  |
| `gs-admin journey programs nodes survey map-standard-tokens` | `gs-admin jo p n s map-standard-tokens` | `journey_map_survey_node_standard_tokens` | ⚠️ yes |
| `gs-admin journey programs nodes connect` | `gs-admin jo p n connect` | `journey_connect_nodes` |  |
| `gs-admin journey programs nodes disconnect` | `gs-admin jo p n disconnect` | `journey_disconnect_nodes` |  |
| `gs-admin journey programs nodes set-connections` | `gs-admin jo p n set-connections` | `journey_set_connections` |  |
| `gs-admin journey programs nodes remove` | `gs-admin jo p n remove` | `journey_remove_node` | ⚠️ yes |
| `gs-admin journey programs nodes add-delay` | `gs-admin jo p n add-delay` | `journey_add_delay_node` |  |
| `gs-admin journey programs nodes create-cta create` | `gs-admin jo p n cc create` | `journey_create_create_cta_node` |  |
| `gs-admin journey programs nodes create-cta set-fields` | `gs-admin jo p n cc set-fields` | `journey_set_create_cta_fields` |  |
| `gs-admin journey programs nodes create-cta set-flags` | `gs-admin jo p n cc set-flags` | `journey_set_create_cta_flags` |  |
| `gs-admin journey programs nodes create-cta set-exit-timer` | `gs-admin jo p n cc set-exit-timer` | `journey_set_create_cta_exit_timer` |  |
| `gs-admin journey programs nodes create-cta add` | `gs-admin jo p n cc add` | `journey_add_create_cta_node` |  |
| `gs-admin journey programs nodes close-cta create` | `gs-admin jo p n xc create` | `journey_create_close_cta_node` |  |
| `gs-admin journey programs nodes close-cta set-fields` | `gs-admin jo p n xc set-fields` | `journey_set_close_cta_fields` |  |
| `gs-admin journey programs nodes close-cta add` | `gs-admin jo p n xc add` | `journey_add_close_cta_node` |  |
| `gs-admin journey programs nodes email set-exit-timer` | `gs-admin jo p n e set-exit-timer` | `journey_set_email_node_exit_timer` |  |
| `gs-admin journey programs nodes survey set-exit-timer` | `gs-admin jo p n s set-exit-timer` | `journey_set_survey_node_exit_timer` |  |

## Rules Engine (alias: `re`)

_Rules Engine operations_

| Command | Short form | MCP tool | Mutating |
|---------|------------|----------|:--------:|
| `gs-admin rules-engine rules folders list` | `gs-admin re r folders list` | `rules_engine_list_folders` |  |
| `gs-admin rules-engine rules relationship-types list` | `gs-admin re r relationship-types list` | `rules_engine_list_relationship_types` |  |
| `gs-admin rules-engine rules sources list` | `gs-admin re r sources list` | `rules_engine_list_source_connections` |  |
| `gs-admin rules-engine rules sources objects` | `gs-admin re r sources objects` | `rules_engine_list_source_objects` |  |
| `gs-admin rules-engine rules sources fields` | `gs-admin re r sources fields` | `rules_engine_list_source_fields` |  |
| `gs-admin rules-engine rules templates list` | `gs-admin re r templates list` | `rules_engine_list_design_templates` |  |
| `gs-admin rules-engine rules create` | `gs-admin re r create` | `rules_engine_create_rule_basics` | ⚠️ yes |
| `gs-admin rules-engine rules edit` | `gs-admin re r edit` | `rules_engine_edit_rule_basics` | ⚠️ yes |
| `gs-admin rules-engine rules set-source` | `gs-admin re r set-source` | `rules_engine_set_rule_source` | ⚠️ yes |
| `gs-admin rules-engine rules set-source-template` | `gs-admin re r set-source-template` | `rules_engine_set_rule_source_template` | ⚠️ yes |
| `gs-admin rules-engine rules add-criteria` | `gs-admin re r add-criteria` | `rules_engine_add_rule_criteria` | ⚠️ yes |
| `gs-admin rules-engine rules add-action cta` | `gs-admin re r add-action cta` | `rules_engine_add_rule_action_cta` | ⚠️ yes |
| `gs-admin rules-engine rules add-action set-score` | `gs-admin re r add-action set-score` | `rules_engine_add_rule_action_set_score` | ⚠️ yes |
| `gs-admin rules-engine rules add-action success-plan` | `gs-admin re r add-action success-plan` | `rules_engine_add_rule_action_success_plan` | ⚠️ yes |
| `gs-admin rules-engine rules add-action load-to-object` | `gs-admin re r add-action load-to-object` | `rules_engine_add_rule_action_load_to_object` | ⚠️ yes |
| `gs-admin rules-engine rules add-action load-to-gainsight` | `gs-admin re r add-action load-to-gainsight` | `rules_engine_add_rule_action_load_to_gainsight` | ⚠️ yes |
| `gs-admin rules-engine rules add-action load-to-company` | `gs-admin re r add-action load-to-company` | `rules_engine_add_rule_action_load_to_company` | ⚠️ yes |
| `gs-admin rules-engine rules add-action close-cta` | `gs-admin re r add-action close-cta` | `rules_engine_add_rule_action_close_cta` | ⚠️ yes |
| `gs-admin rules-engine rules add-action external-action` | `gs-admin re r add-action external-action` | `rules_engine_add_rule_action_external_action` | ⚠️ yes |
| `gs-admin rules-engine rules list-rest-connections` | `gs-admin re r list-rest-connections` | `rules_engine_list_rest_connections` |  |
| `gs-admin rules-engine rules list-external-actions` | `gs-admin re r list-external-actions` | `rules_engine_list_external_actions` |  |
| `gs-admin rules-engine rules describe-external-action` | `gs-admin re r describe-external-action` | `rules_engine_describe_external_action` |  |
| `gs-admin rules-engine rules list-task-outputs` | `gs-admin re r list-task-outputs` | `rules_engine_list_task_outputs` |  |
| `gs-admin rules-engine rules edit-action close-cta` | `gs-admin re r edit-action close-cta` | `rules_engine_edit_rule_action_close_cta` | ⚠️ yes |
| `gs-admin rules-engine rules add-action update-cta` | `gs-admin re r add-action update-cta` | `rules_engine_add_rule_action_update_cta` | ⚠️ yes |
| `gs-admin rules-engine rules edit-action update-cta` | `gs-admin re r edit-action update-cta` | `rules_engine_edit_rule_action_update_cta` | ⚠️ yes |
| `gs-admin rules-engine rules edit-action cta` | `gs-admin re r edit-action cta` | `rules_engine_edit_rule_action_cta` | ⚠️ yes |
| `gs-admin rules-engine rules edit-action set-score` | `gs-admin re r edit-action set-score` | `rules_engine_edit_rule_action_set_score` | ⚠️ yes |
| `gs-admin rules-engine rules edit-action success-plan` | `gs-admin re r edit-action success-plan` | `rules_engine_edit_rule_action_success_plan` | ⚠️ yes |
| `gs-admin rules-engine rules add-action update-success-plan` | `gs-admin re r add-action update-success-plan` | `rules_engine_add_rule_action_update_success_plan` | ⚠️ yes |
| `gs-admin rules-engine rules edit-action update-success-plan` | `gs-admin re r edit-action update-success-plan` | `rules_engine_edit_rule_action_update_success_plan` | ⚠️ yes |
| `gs-admin rules-engine rules edit-action external-action` | `gs-admin re r edit-action external-action` | `rules_engine_edit_rule_action_external_action` | ⚠️ yes |
| `gs-admin rules-engine rules edit-action load-to-gainsight` | `gs-admin re r edit-action load-to-gainsight` | `rules_engine_edit_rule_action_load_to_gainsight` | ⚠️ yes |
| `gs-admin rules-engine rules edit-action load-to-company` | `gs-admin re r edit-action load-to-company` | `rules_engine_edit_rule_action_load_to_company` | ⚠️ yes |
| `gs-admin rules-engine rules delete-action` | `gs-admin re r delete-action` | `rules_engine_delete_rule_action` | ⚠️ yes |
| `gs-admin rules-engine rules list` | `gs-admin re r list` | `rules_engine_list_rules` |  |
| `gs-admin rules-engine rules describe` | `gs-admin re r describe` | `rules_engine_describe_rule` |  |
| `gs-admin rules-engine rules executions` | `gs-admin re r executions` | `rules_engine_list_rule_executions` |  |
| `gs-admin rules-engine rules execution` | `gs-admin re r execution` | `rules_engine_describe_execution` |  |
| `gs-admin rules-engine chains list` | `gs-admin re c list` | `rules_engine_list_chains` |  |
| `gs-admin rules-engine chains describe` | `gs-admin re c describe` | `rules_engine_describe_chain` |  |
| `gs-admin rules-engine rules debug` | `gs-admin re r debug` | `rules_engine_debug_rule` | ⚠️ yes |
| `gs-admin rules-engine chains debug` | `gs-admin re c debug` | `rules_engine_debug_chain` | ⚠️ yes |
| `gs-admin rules-engine rules list-and-describe` | `gs-admin re r list-and-describe` | `rules_engine_list_and_describe_rules` |  |
| `gs-admin rules-engine rules schedule` | `gs-admin re r schedule` | `rules_engine_schedule_rule` | ⚠️ yes |
| `gs-admin rules-engine rules schedule-basic` | `gs-admin re r schedule-basic` | `rules_engine_schedule_rule_basic` | ⚠️ yes |
| `gs-admin rules-engine rules test-schedule` | `gs-admin re r test-schedule` | `rules_engine_test_schedule` |  |
| `gs-admin rules-engine rules run-now` | `gs-admin re r run-now` | `rules_engine_run_now` | ⚠️ yes |
| `gs-admin rules-engine rules delete-schedule` | `gs-admin re r delete-schedule` | `rules_engine_delete_rule_schedule` | ⚠️ yes |
| `gs-admin rules-engine rules schedules` | `gs-admin re r schedules` | `rules_engine_list_rule_schedules` |  |
| `gs-admin rules-engine rules topics` | `gs-admin re r topics` | `rules_engine_topics` |  |
| `gs-admin rules-engine rules events` | `gs-admin re r events` | `rules_engine_events` |  |
| `gs-admin rules-engine rules s3-tasks` | `gs-admin re r s3-tasks` | `rules_engine_s3_tasks` |  |
| `gs-admin rules-engine rules schedule-event` | `gs-admin re r schedule-event` | `rules_engine_schedule_event` | ⚠️ yes |
| `gs-admin rules-engine rules schedule-s3` | `gs-admin re r schedule-s3` | `rules_engine_schedule_s3` | ⚠️ yes |
| `gs-admin rules-engine chains schedule-basic` | `gs-admin re c schedule-basic` | `rules_engine_chain_schedule_basic` | ⚠️ yes |
| `gs-admin rules-engine chains schedule-event` | `gs-admin re c schedule-event` | `rules_engine_chain_schedule_event` | ⚠️ yes |
| `gs-admin rules-engine chains schedule-s3` | `gs-admin re c schedule-s3` | `rules_engine_chain_schedule_s3` | ⚠️ yes |
| `gs-admin rules-engine rules event-curl` | `gs-admin re r event-curl` | `rules_engine_event_curl` |  |
| `gs-admin rules-engine chains event-curl` | `gs-admin re c event-curl` | `rules_engine_chain_event_curl` |  |
| `gs-admin rules-engine chains delete-schedule` | `gs-admin re c delete-schedule` | `rules_engine_chain_delete_schedule` | ⚠️ yes |

## Data Management (alias: `dm`)

_Data Management tools_

| Command | Short form | MCP tool | Mutating |
|---------|------------|----------|:--------:|
| `gs-admin data-management objects list` | `gs-admin dm o list` | `data_management_list_objects` |  |
| `gs-admin data-management objects describe` | `gs-admin dm o describe` | `data_management_describe_object` |  |
| `gs-admin data-management dependencies config` | `gs-admin dm deps config` | `data_management_dependency_config` |  |
| `gs-admin data-management dependencies check` | `gs-admin dm deps check` | `data_management_object_dependencies` |  |
| `gs-admin data-management dropdowns list` | `gs-admin dm dd list` | `data_management_list_dropdowns` |  |
| `gs-admin data-management dropdowns add-item` | `gs-admin dm dd add-item` | `data_management_add_dropdown_item` | ⚠️ yes |
| `gs-admin data-management dropdowns upload-csv` | `gs-admin dm dd upload-csv` | `data_management_upload_csv_dropdown_items` | ⚠️ yes |
| `gs-admin data-management dropdowns describe` | `gs-admin dm dd describe` | `data_management_describe_dropdown` |  |
| `gs-admin data-management objects list-and-describe` | `gs-admin dm o list-and-describe` | `data_management_list_and_describe_objects` |  |
| `gs-admin data-management objects create` | `gs-admin dm o create` | `data_management_create_object` | ⚠️ yes |
| `gs-admin data-management objects add-field` | `gs-admin dm o add-field` | `data_management_add_object_fields` | ⚠️ yes |
| `gs-admin data-management objects update` | `gs-admin dm o update` | `data_management_update_object` | ⚠️ yes |

## Data Designer (alias: `dd`)

_Data Designer — Design Templates (data preparation flows)_

| Command | Short form | MCP tool | Mutating |
|---------|------------|----------|:--------:|
| `gs-admin data-designer templates create` | `gs-admin dd t create` | `data_designer_create_template` | ⚠️ yes |
| `gs-admin data-designer templates list` | `gs-admin dd t list` | `data_designer_list_templates` |  |
| `gs-admin data-designer templates describe` | `gs-admin dd t describe` | `data_designer_describe_template` |  |
| `gs-admin data-designer sources list` | `gs-admin dd sources list` | `data_designer_list_source_connections` |  |
| `gs-admin data-designer sources objects` | `gs-admin dd sources objects` | `data_designer_list_source_objects` |  |
| `gs-admin data-designer sources fields` | `gs-admin dd sources fields` | `data_designer_list_source_fields` |  |
| `gs-admin data-designer templates add-task` | `gs-admin dd t add-task` | `data_designer_add_task` | ⚠️ yes |
| `gs-admin data-designer templates edit-task` | `gs-admin dd t edit-task` | `data_designer_edit_task` | ⚠️ yes |
| `gs-admin data-designer templates preview` | `gs-admin dd t preview` | `data_designer_preview_task_outputs` |  |
| `gs-admin data-designer templates delete` | `gs-admin dd t delete` | `data_designer_delete_template` | ⚠️ yes |

## Connectors (alias: `cn`)

_Connector operations — iPaaS connections, jobs, and field mappings_

| Command | Short form | MCP tool | Mutating |
|---------|------------|----------|:--------:|
| `gs-admin connectors list` | `gs-admin cn list` | `connectors_list_connectors` |  |
| `gs-admin connectors jobs` | `gs-admin cn jobs` | `connectors_list_connector_jobs` |  |
| `gs-admin connectors activity` | `gs-admin cn activity` | `connectors_list_activity` |  |
| `gs-admin connectors px` | `gs-admin cn px` | `connectors_list_px_activity` |  |
| `gs-admin connectors audit` | `gs-admin cn audit` | `connectors_audit_connector` |  |
| `gs-admin connectors chains` | `gs-admin cn chains` | `connectors_list_job_chains` |  |
| `gs-admin connectors chain` | `gs-admin cn chain` | `connectors_describe_job_chain` |  |

## Scorecard (alias: `sc`)

_Scorecard operations_

| Command | Short form | MCP tool | Mutating |
|---------|------------|----------|:--------:|
| `gs-admin scorecard scheme list` | `gs-admin sc sch list` | `scorecard_list_schemes` |  |
| `gs-admin scorecard list` | `gs-admin sc list` | `scorecard_list_scorecards` |  |
| `gs-admin scorecard measure list` | `gs-admin sc m list` | `scorecard_list_measures` |  |
| `gs-admin scorecard measure-group list` | `gs-admin sc mg list` | `scorecard_list_measuregroups` |  |
| `gs-admin scorecard measure create` | `gs-admin sc m create` | `scorecard_create_measure` | ⚠️ yes |
| `gs-admin scorecard measure-group create` | `gs-admin sc mg create` | `scorecard_create_measure_group` | ⚠️ yes |
| `gs-admin scorecard update` | `gs-admin sc update` | `scorecard_update_scorecard` | ⚠️ yes |
| `gs-admin scorecard measure assign` | `gs-admin sc m assign` | `scorecard_assign_measures` | ⚠️ yes |
| `gs-admin scorecard create` | `gs-admin sc create` | `scorecard_create_scorecard` | ⚠️ yes |
| `gs-admin scorecard measures` | `gs-admin sc measures` | `scorecard_get_scorecard_measures` |  |

## Report (alias: `rp`)

_Build, run, save and fetch Gainsight BI reports (GSReportMaster). All actions share the same report body structure. showFields, groupBy, orderBy, and drillDownFields are arrays of structured field-spec objects — see item schemas and docs/GSReportMaster-Create-Payload-Spec.md (the authoritative spec). Use run-report to execute ad-hoc without saving; use create-report only when the user explicitly says save/create/build._

| Command | Short form | MCP tool | Mutating |
|---------|------------|----------|:--------:|
| `gs-admin report list` | `gs-admin rp list` | `report_list_reports` |  |
| `gs-admin report describe` | `gs-admin rp describe` | `report_describe_report` |  |
| `gs-admin report list-objects` | `gs-admin rp list-objects` | `report_list_objects` |  |
| `gs-admin report schema` | `gs-admin rp schema` | `report_get_object_schema` |  |
| `gs-admin report run` | `gs-admin rp run` | `report_run_report` |  |
| `gs-admin report create` | `gs-admin rp create` | `report_create_report` | ⚠️ yes |
| `gs-admin report update` | `gs-admin rp update` | `report_update_report` | ⚠️ yes |
| `gs-admin report run-saved` | `gs-admin rp run-saved` | `report_run_saved_report` |  |

## Query (alias: `q`)

_Query Gainsight objects using the Query API_

| Command | Short form | MCP tool | Mutating |
|---------|------------|----------|:--------:|
| `gs-admin query execute` | `gs-admin q execute` | `query_execute` |  |

## Lane 2 Runtime

_Lane 2 — a stateful asset-lifecycle engine (create-draft → validate → plan → apply → resume) with run persistence, idempotency, support bundles, and cross-environment cloning. CLI commands are hidden (runtime:*); primarily consumed as MCP tools._

| Command | Short form | MCP tool | Mutating |
|---------|------------|----------|:--------:|
| `gs-admin runtime describe-asset-type` | — | `runtime_describe_asset_type` |  |
| `gs-admin runtime describe-asset-schema` | — | `runtime_describe_asset_schema` |  |
| `gs-admin runtime select-template` | — | `runtime_select_template` |  |
| `gs-admin runtime create-draft` | — | `runtime_create_draft` | ⚠️ yes |
| `gs-admin runtime validate-draft` | — | `runtime_validate_draft` |  |
| `gs-admin runtime plan-run` | — | `runtime_plan_run` |  |
| `gs-admin runtime apply-run` | — | `runtime_apply_run` | ⚠️ yes |
| `gs-admin runtime resume-run` | — | `runtime_resume_run` | ⚠️ yes |
| `gs-admin runtime get-run-status` | — | `runtime_get_run_status` |  |
| `gs-admin runtime list-runs` | — | `runtime_list_runs` |  |
| `gs-admin runtime clone-asset` | — | `runtime_clone_asset` | ⚠️ yes |
| `gs-admin runtime export-support-bundle` | — | `runtime_export_support_bundle` |  |

## Auth & Config

_Authentication and configuration. OAuth 2.1 PKCE with browser auto-enrollment; tokens are stored in the OS keychain, falling back to an AES-256-GCM encrypted file, then plaintext. Config lives at ~/.gs-admin/config.json._

| Command | Short form | MCP tool | Mutating |
|---------|------------|----------|:--------:|
| `gs-admin login` | — | — | ⚠️ yes |
| `gs-admin logout` | — | — | ⚠️ yes |
| `gs-admin config` | — | — | ⚠️ yes |
| `gs-admin whoami` | — | — |  |
| `gs-admin tokens migrate` | — | — | ⚠️ yes |
| `gs-admin tokens backends` | — | — |  |

---
_Regenerate: `npm run build:plugin:gs-superadmin` in the gs-admin-cli-docs repo._
