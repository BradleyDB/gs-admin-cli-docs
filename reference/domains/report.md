<!-- GENERATED FILE — do not edit by hand. Regenerate with: npm run build:reference (build/build-reference.mjs). -->

# Report (`report` / `rp`)

Build, run, save and fetch Gainsight BI reports (GSReportMaster). All actions share the same report body structure. showFields, groupBy, orderBy, and drillDownFields are arrays of structured field-spec objects — see item schemas and docs/GSReportMaster-Create-Payload-Spec.md (the authoritative spec). Use run-report to execute ad-hoc without saving; use create-report only when the user explicitly says save/create/build.

> **Domain notes (guidance for AI/agent consumers)**
>
> - **Spec is authoritative** — docs/GSReportMaster-Create-Payload-Spec.md is the complete create-payload spec. Every enum, every conditional rule, every shape, every naming convention is documented there. These notes are a short digest; the spec is the source of truth.
> - **Projection inputs are arrays of objects** — showFields / groupBy / orderBy / drillDownFields are JSON arrays of structured entries — never comma-separated strings. Each entry carries one of: { name }, { formula }, { fieldPath } plus optional per-entry overrides. _(spec: item schema in this file; spec §4)_
> - **Pivot rules** — Any groupByFields[i].pivoted=true REQUIRES reportDisplayType=GRID, groupByFields.length>=2, exactly one pivoted=true. Handler enforces (throws on violation). _(spec: §10.5)_
> - **KPI / Gauge cardinality** — KPI: groupByFields=[] AND showFields.length<=1. Gauge: (1 gb + 1 sf) OR (0 gb + 1..6 aggregated sf). _(spec: §10.6, §10.7)_
> - **Chart eligibility** — Non-GRID display types have strict per-shape (showFields, groupBy) count requirements. Handler validates and throws. _(spec: §10.22)_
> - **Filter operators per dataType** — comparisonOperator MUST come strictly from the per-dataType supported-operators list. PICKLIST/MULTISELECTDROPDOWNLIST: IN/NOT_IN/IS_NULL/IS_NOT_NULL only (no EQ/NE). LOOKUP with SEARCH_CONTROLLER=PICKLIST is treated as PICKLIST. INCLUDES/EXCLUDES are never valid for MDA. _(spec: §4.7)_
> - **filterValue.value is ALWAYS an array** — Never omit. Use [] for IS_NULL/IS_NOT_NULL/CURRENT_USER/ALL_USERS/fixed-period date literals (TODAY/THIS_WEEK/…). BTW/NOT_BTW: 2 values. IN/NOT_IN: >=1. All other single-value ops: exactly 1. _(spec: §7.5, §6.3)_
> - **Picklist filter values are option IDs** — For PICKLIST / MULTISELECTDROPDOWNLIST: filterValue.value entries are picklist option IDs from schema options[].value, NEVER labels. Resolve label→ID before sending. _(spec: §4.10, §13.9)_
> - **Date-literal × operator pairing (CRITICAL — easy to get wrong)** — Relative N-period literals (LAST_N_DAYS, NEXT_N_DAYS, LAST_N_WEEKS/MONTHS/QUARTERS/YEARS/FISCAL_*, CURRENT_AND_*_N_*): use comparisonOperator='EQ' with filterValue.value=[N]. NEVER use BTW — BTW with [N] is silently interpreted as 'between epoch (1970) and unset', producing a broken filter. Fixed-period literals (TODAY, YESTERDAY, THIS_WEEK, THIS_MONTH, CURRENT_CYQ/CY/FYQ/FY, etc.): use EQ with value=[]. Only dateLiteral='CUSTOM' uses BTW (with value=[fromDate,toDate]) or EQ/NE/LT/GT/LTE/GTE (with value=[date]). _(spec: §7.2, §7.5, §7.6)_
> - **Formula field-leaf required keys** — Inside expressionDetails.expression.arguments[*] of tokenType='field', each leaf MUST carry: fieldName, dbName, objectName, objectDBName, dataType, key (=fieldAlias), group:'group', matchedKey:'label'. Missing any breaks the formula compiler. _(spec: §5.7, §10.28)_
> - **fieldAlias naming** — Plain: <object>_<field>. Aggregated: <fn>_of_<object>_<field>. Summarize: summarize_<unit>_of_<object>_<field>. Lookup chain: <leafObj>_<hop1>__gr_..._<leaf>. Formula: anonymous_<name>. _(spec: §11)_
> - **Server-populated fields — DO NOT SEND on create** — Omit: id, tenantId, reportId, createdDate, modifiedDate, createdBy, modifiedBy, deleted, accessLevel, folderPath, pageNumber, requestSource. reportId is regenerated on insert; send it only on update. _(spec: §1)_

**8 commands.** 

| Command | Summary | MCP tool |
|---------|---------|----------|
| [`gs-admin report create`](#gs-admin-report-create) | Save a new GSReportMaster report permanently to BI | `report_create_report` |
| [`gs-admin report describe`](#gs-admin-report-describe) | Fetch a saved report definition by ID or name | `report_describe_report` |
| [`gs-admin report list`](#gs-admin-report-list) | List all saved reports with pagination | `report_list_reports` |
| [`gs-admin report list-objects`](#gs-admin-report-list-objects) | List BI source objects (MDA) | `report_list_objects` |
| [`gs-admin report run`](#gs-admin-report-run) | Execute an ad-hoc report and return rows — nothing is saved | `report_run_report` |
| [`gs-admin report run-saved`](#gs-admin-report-run-saved) | Execute an existing saved report (by --id or --name) — nothing is saved or updated | `report_run_saved_report` |
| [`gs-admin report schema`](#gs-admin-report-schema) | Describe the fields, lookups, and properties for one BI object | `report_get_object_schema` |
| [`gs-admin report update`](#gs-admin-report-update) | Update an existing GSReportMaster report (PUT) | `report_update_report` |

---

### `gs-admin report create`
*Short form:* `gs-admin rp create`

Save a new GSReportMaster report permanently to BI

ONLY call when the user explicitly says 'save', 'create', or 'build'. Do NOT call for 'run'. Resolves field-specs from the object schema, validates per spec §10 (pivot/KPI/Gauge/chart eligibility), and persists via POST /v3/bi/reporting. See docs/GSReportMaster-Create-Payload-Spec.md for the complete payload contract.

**MCP tool:** `report_create_report` · **Mutating:** yes ⚠️ · **Output:** `detail` · **Endpoint(s):** `POST /v3/bi/reporting` _(create)_, `GET /v3/bi/reporting/describe/listobjects/MDA` _(listObjects)_, `GET /v3/bi/reporting/describe/MDA` _(describe)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--name` | `string` | ✓ | — | Report name (unique per tenant; spec §10.11). |
| `--object` | `string` | ✓ | — | Source object logical name. Handler resolves sourceDetails (spec §3). |
| `--description` | `string` |  | `""` | Free-form description. |
| `--show-fields` | `array` | ✓ | — | Required. Array of field-spec entries. Each: { name \| formula \| fieldPath } + optional displayName/scale/currencyCode/numericalSummarization/hyperlink/dataLabels/aggregation/summarize. Auto-aggregates when groupBy non-empty (spec §4.7). |
| `--group-by` | `array` |  | — | Optional. Group-by entries with pivoted/rowGrouped/sort. Pivot rules per spec §10.5. |
| `--order-by` | `array` |  | — | Optional. Sort entries with order+nulls; aliases must exist in showFields/groupBy (spec §10.14). |
| `--drill-down-fields` | `array` |  | — | Optional. KPI drill-down columns. |
| `--where-filters` | `object` |  | — | Pre-aggregation filters. Shape: { conditions:[{leftOperand:{fieldName:'X'}, operator:'EQ', rightOperand:{value:'Y'}}, ...] }. Do NOT pass alias/expression — CLI assigns. |
| `--having-filters` | `object` |  | — | Post-aggregation filters. Same shape as whereFilters. Do NOT pass alias/expression — CLI assigns. |
| `--display-type` | `string` | ✓ | `"GRID"` | Visual display type. Spec §2.1, §10.22. One of: `PIE`, `BAR`, `COLUMN`, `GRID`, `LINE`, `AREA`, `STACKED_BAR`, `STACKED_COLUMN`, `BUBBLE`, `D3BUBBLE`, `SCATTER`, `CHART`, `COLUMN_LINE`, `HEATMAP`, `DONUT`, `KPI`, `WIDGET`, `FUNNEL`, `GAUGE`. |
| `--limit` | `integer` |  | — | Max rows (cap 2000). Ranking N when enableRanking=true. |
| `--page-size` | `integer` |  | `50` | Rows per page. -1 = max read limit. |
| `--folder-id` | `integer` |  | `2` | Folder ID. Cannot be a system folder (spec §10.13). |
| `--report-types` | `array` |  | `["adhoc"]` | Classification tags (spec §9.1). |
| `--report-options` | `object` |  | — | Chart/grid behavior toggles (spec §8). |
| `--properties` | `object` |  | — | Top-level extension bag (spec §9.2). Commonly { USE_EPOCH:true, RESET:{ MILLI_OF_SECOND:true } }. |

**Examples**

```bash
gs-admin rp create --name "Open Cases" --object Case --show-fields '[{"name":"CaseNumber"},{"name":"Status"},{"name":"OwnerId"}]'
gs-admin rp create --name "Pipeline by Stage" --object opportunity --show-fields '[{"name":"Amount"}]' --group-by '[{"name":"StageName"}]' --display-type BAR
gs-admin rp create --name "CTAs by Type x Reason" --object call_to_action --show-fields '[{"name":"Id","aggregation":"COUNT"}]' --group-by '[{"name":"ReasonId"},{"name":"TypeId","pivoted":true}]' --display-type GRID
gs-admin rp create --name "NPS Ratio" --object company --show-fields '[{"name":"ratio","formula":{"kind":"arithmetic","operator":"/","lhs":{"kind":"field","name":"AverageNps"},"rhs":{"kind":"field","name":"Arr"}},"displayName":"NPS/ARR"}]'
gs-admin rp create --name "CTA + Company Name" --object call_to_action --show-fields '[{"name":"Name"},{"fieldPath":{"leaf":"Name","hops":[{"through":"CompanyId","to":"company"}]}}]'
```

### `gs-admin report describe`
*Short form:* `gs-admin rp describe`

Fetch a saved report definition by ID or name

Returns the full GSReportMaster definition for inspection.

**MCP tool:** `report_describe_report` · **Mutating:** no · **Output:** `detail` · **Endpoint(s):** `GET /v3/bi/integrations/list/reports` _(list)_, `GET /v3/bi/integrations/report` _(fetch)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` |  | — | Report ID (preferred). |
| `--name` | `string` |  | — | Report name fragment. |
| `--consumer-type` | `string` |  | `"REPORT_BUILDER"` | Default REPORT_BUILDER. |

**Examples**

```bash
gs-admin rp describe --id abc123
gs-admin rp describe --name "Open Cases"
```

### `gs-admin report list`
*Short form:* `gs-admin rp list`

List all saved reports with pagination

Returns all persisted reports from /v3/bi/integrations/list/reports.

**MCP tool:** `report_list_reports` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v3/bi/integrations/list/reports` _(list)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--limit` | `integer` |  | `25` | Page size (default 25). |
| `--page` | `integer` |  | `1` | 1-based page number. |

**Examples**

```bash
gs-admin rp list
gs-admin rp list --limit 50 --page 2
```

### `gs-admin report list-objects`
*Short form:* `gs-admin rp list-objects`

List BI source objects (MDA)

Returns objects available for building reports.

**MCP tool:** `report_list_objects` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v3/bi/reporting/describe/listobjects/MDA` _(listObjects)_

**Flags**

_No flags._

**Examples**

```bash
gs-admin rp list-objects
```

### `gs-admin report run`
*Short form:* `gs-admin rp run`

Execute an ad-hoc report and return rows — nothing is saved

DEFAULT for any 'run', 'get', or 'show me' report request. Resolves field-specs against the object schema, builds the GSReportMaster body, and POSTs it to the admin fetch-data endpoint. Body-only — no reportId is generated, no shell record is created, nothing is persisted server-side. Server-side access is restricted to reporting admins. Use create-report only when the user explicitly says 'save/create/build'.

**MCP tool:** `report_run_report` · **Mutating:** no · **Output:** `json` · **Endpoint(s):** `GET /v3/bi/reporting/describe/listobjects/MDA` _(listObjects)_, `GET /v3/bi/reporting/describe/MDA` _(describe)_, `POST /v3/bi/integrations/report/admin/fetch-data` _(fetchData)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--object` | `string` | ✓ | — | Required. Source object logical name (e.g. company, call_to_action, opportunity, Case). Handler resolves sourceDetails via list-objects. |
| `--show-fields` | `array` |  | — | Required in practice. Array of field-spec entries to project as columns. Each entry: { name \| formula \| fieldPath } + optional displayName/scale/currencyCode/numericalSummarization/hyperlink/dataLabels/aggregation/summarize. When groupBy is non-empty and an entry has no explicit aggregation/formula, the handler auto-aggregates per dataType default (spec §4.7). |
| `--group-by` | `array` |  | — | Optional. Group-by entries. Same shape as showFields plus pivoted, rowGrouped, sort:{order,nulls}. Pivot rules: GRID + >=2 entries + exactly one pivoted=true (spec §10.5). |
| `--order-by` | `array` |  | — | Optional. Sort entries. Same shape as showFields plus flat order (ASC\|DESC) and nulls (FIRST\|LAST). Entry MUST also exist in showFields or groupBy (spec §10.14). |
| `--drill-down-fields` | `array` |  | — | Optional. KPI/chart drill-down columns. Same shape as showFields. |
| `--where-filters` | `object` |  | — | Optional. Pre-aggregation filters. Shape: { conditions:[{leftOperand:{fieldName:'X'}, operator:'EQ', rightOperand:{value:'Y'}}, ...] }. Do NOT pass `alias` or `expression` — the CLI assigns aliases (A, B, C, …) and generates the expression as `A AND B AND …`. For OR/nested expressions, save the filter via `rp update --where-filters` then run with `rp run-saved`. |
| `--having-filters` | `object` |  | — | Optional. Post-aggregation filters. Same shape as whereFilters (leftOperand.key = aggregated fieldAlias, conditions[].aggregateFunction required). Do NOT pass `alias` or `expression` — CLI-assigned. |
| `--display-type` | `string` |  | `"GRID"` | Visual display type. Default GRID. Eligibility per spec §10.22; handler validates (showFields, groupBy) counts. One of: `PIE`, `BAR`, `COLUMN`, `GRID`, `LINE`, `AREA`, `STACKED_BAR`, `STACKED_COLUMN`, `BUBBLE`, `D3BUBBLE`, `SCATTER`, `CHART`, `COLUMN_LINE`, `HEATMAP`, `DONUT`, `KPI`, `WIDGET`, `FUNNEL`, `GAUGE`. |
| `--limit` | `integer` |  | — | Max rows (cap 2000). |
| `--page-size` | `integer` |  | `50` | Rows per page. -1 = max read limit. |
| `--report-options` | `object` |  | — | Chart/grid behavior toggles (spec §8). |
| `--properties` | `object` |  | — | Top-level extension bag (spec §9.2). Commonly { USE_EPOCH:true, RESET:{ MILLI_OF_SECOND:true } }. |
| `--name` | `string` |  | `""` | Temp shell report name. |
| `--description` | `string` |  | `""` | Temp shell description. |

**Examples**

```bash
gs-admin rp run --object company --show-fields '[{"name":"Name"},{"name":"Arr"},{"name":"Stage"}]'
gs-admin rp run --object opportunity --show-fields '[{"name":"Amount"}]' --group-by '[{"name":"StageName"}]' --display-type BAR
gs-admin rp run --object call_to_action --show-fields '[{"name":"Id","aggregation":"COUNT"}]' --group-by '[{"name":"ReasonId"},{"name":"TypeId","pivoted":true}]' --display-type GRID
```

### `gs-admin report run-saved`
*Short form:* `gs-admin rp run-saved`

Execute an existing saved report (by --id or --name) — nothing is saved or updated

Use this to run a report that's already saved in BI. Fetches the saved GSReportMaster definition via describe, applies any caller-supplied overrides, and POSTs to /v3/bi/integrations/report/fetch-data. NOTHING IS CREATED OR UPDATED server-side. Override rules: --where-filters and --having-filters use locked+append+AND merge — saved filters (locked or not) are ALWAYS preserved, caller conditions are appended, and the expression becomes `(<saved_expr>) AND (<user_expr>)`; caller aliases are renamed if they collide with saved aliases, and any `locked: true` on caller-supplied conditions is stripped. --limit / --page-size / --order-by are top-level replaces. Inputs that would change the saved shape (--object / --show-fields / --group-by / --display-type / --drill-down-fields) are rejected — use rp run for a fresh ad-hoc, or rp update to change the saved shape.

**MCP tool:** `report_run_saved_report` · **Mutating:** no · **Output:** `json` · **Endpoint(s):** `GET /v3/bi/integrations/list/reports` _(list)_, `GET /v3/bi/integrations/report` _(fetch)_, `GET /v3/bi/reporting/describe/MDA` _(describe)_, `POST /v3/bi/integrations/report/fetch-data` _(fetchData)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` |  | — | Report ID (preferred). Either --id or --name is required, mutually exclusive. |
| `--name` | `string` |  | — | Exact report name. Fragment matches are rejected — the resolver will list substring hits so the caller can re-run with --id or the exact name. |
| `--where-filters` | `object` |  | — | Extra pre-aggregation filters. Shape: { conditions:[{leftOperand:{fieldName:'X'}, operator:'EQ', rightOperand:{value:'Y'}}, ...] }. Do NOT pass alias/expression. Saved conditions are carried through unchanged; caller conditions are appended with fresh aliases (starting after the saved set) and joined with AND. Final expression = `(<saved>) AND (A AND B AND …)`. |
| `--having-filters` | `object` |  | — | Extra post-aggregation filters. Same append+AND semantics as whereFilters. Conditions must reference aggregated aliases already present in the saved report's showFields. Do NOT pass alias/expression. |
| `--limit` | `integer` |  | — | Max rows (cap 2000). Replaces the saved limit. |
| `--page-size` | `integer` |  | — | Rows per page. -1 = max read limit. Replaces the saved pageSize. |
| `--order-by` | `array` |  | — | Sort entries. Replaces the saved orderByFields wholesale. Field aliases must resolve against the saved report's object schema. |
| `--consumer-type` | `string` |  | `"REPORT_BUILDER"` | Consumer type used on both describe and fetch-data query params. |

**Examples**

```bash
gs-admin rp run-saved --id 324f08a3-5572-40f9-8877-d89cf5fcab05
gs-admin rp run-saved --name "Open Cases"
gs-admin rp run-saved --name "Open Cases" --where-filters '{"conditions":[{"filterAlias":"A","comparisonOperator":"EQ","leftOperand":{"fieldName":"Status"},"filterValue":{"value":["Open"]}}],"expression":"A"}'
gs-admin rp run-saved --id abc-123 --limit 100 --page-size 100 --order-by '[{"name":"ModifiedDate","order":"DESC"}]'
```

### `gs-admin report schema`
*Short form:* `gs-admin rp schema`

Describe the fields, lookups, and properties for one BI object

Returns the full schema (fields, lookupDetails, picklist options) for the named object.

**MCP tool:** `report_get_object_schema` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v3/bi/reporting/describe/MDA` _(describe)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--object` | `string` | ✓ | — | Object name. Use list-objects to discover valid names. |

**Examples**

```bash
gs-admin rp schema --object company
gs-admin rp schema --object call_to_action
```

### `gs-admin report update`
*Short form:* `gs-admin rp update`

Update an existing GSReportMaster report (PUT)

Updates a saved report identified by --id (or --name). Fetches the existing definition, applies top-level overrides for any keys the caller passed, and PUTs the merged body to /v3/bi/reporting/{reportId}. Keys not supplied by the caller are preserved from the existing report (including reportType, reportTypes, properties, folder assignment). Structural inputs (--show-fields / --group-by / --order-by / --drill-down-fields / --where-filters / --having-filters) require --object + --show-fields together — they always resolve against the target object's live schema. Filter overrides replace the block wholesale (no locked-filter merge on update). Use this when the user explicitly says 'update', 'edit', or 'modify' an existing report.

**MCP tool:** `report_update_report` · **Mutating:** yes ⚠️ · **Output:** `detail` · **Endpoint(s):** `GET /v3/bi/reporting/describe/MDA` _(describe)_, `GET /v3/bi/integrations/list/reports` _(list)_, `GET /v3/bi/integrations/report` _(fetch)_, `PUT /v3/bi/reporting/{{id}}` _(update)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` |  | — | Report ID to update (preferred). Either --id or --name is required. |
| `--name` | `string` |  | — | Report name (used to resolve --id when not given). |
| `--new-name` | `string` |  | — | New report name. Omit to keep the existing name. |
| `--object` | `string` |  | — | Source object logical name (e.g. gsuser, company). |
| `--description` | `string` |  | — | New description. |
| `--show-fields` | `array` |  | — | Array of field-spec entries — see create-report. |
| `--group-by` | `array` |  | — | Optional. Group-by entries. |
| `--order-by` | `array` |  | — | Optional. Sort entries. |
| `--drill-down-fields` | `array` |  | — | Optional. Drill-down columns. |
| `--where-filters` | `object` |  | — | Pre-aggregation filters. |
| `--having-filters` | `object` |  | — | Post-aggregation filters. |
| `--display-type` | `string` |  | `"GRID"` | One of: `PIE`, `BAR`, `COLUMN`, `GRID`, `LINE`, `AREA`, `STACKED_BAR`, `STACKED_COLUMN`, `BUBBLE`, `D3BUBBLE`, `SCATTER`, `CHART`, `COLUMN_LINE`, `HEATMAP`, `DONUT`, `KPI`, `WIDGET`, `FUNNEL`, `GAUGE`. |
| `--limit` | `integer` |  | — | Max rows (cap 2000). Ranking N when enableRanking=true. |
| `--page-size` | `integer` |  | `50` | Rows per page. -1 = max read limit. |
| `--report-options` | `object` |  | — | Chart/grid behavior toggles (spec §8). |
| `--properties` | `object` |  | — | Top-level extension bag (spec §9.2). |
| `--consumer-type` | `string` |  | `"REPORT_BUILDER"` | Used only when resolving --name to --id. |

**Examples**

```bash
gs-admin rp update --id 324f08a3-5572-40f9-8877-d89cf5fcab05 --new-name "Renamed Report"
gs-admin rp update --id 324f08a3 --object gsuser --show-fields '[{"name":"Name"}]' --where-filters '{"conditions":[{"filterAlias":"A","comparisonOperator":"EQ","filterValue":{"value":[true]},"leftOperand":{"fieldName":"IsActiveUser"}}],"expression":"A"}'
gs-admin rp update --id 324f08a3-5572-40f9-8877-d89cf5fcab05 --object gsuser --show-fields '[{"name":"CreatedDate"},{"name":"AllSolutionVisibilityRegion__gc"}]'
```

