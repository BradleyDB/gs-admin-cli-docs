<!-- GENERATED FILE — do not edit by hand. Regenerate with: npm run build:reference (build/build-reference.mjs). -->

# Data Management (`data-management` / `dm`)

Data Management tools

**12 commands.** 

| Command | Summary | MCP tool |
|---------|---------|----------|
| [`gs-admin data-management dependencies check`](#gs-admin-data-management-dependencies-check) | Get dependencies for a Gainsight object | `data_management_object_dependencies` |
| [`gs-admin data-management dependencies config`](#gs-admin-data-management-dependencies-config) | List available dependency areas | `data_management_dependency_config` |
| [`gs-admin data-management dropdowns add-item`](#gs-admin-data-management-dropdowns-add-item) | Add a single value to an existing dropdown | `data_management_add_dropdown_item` |
| [`gs-admin data-management dropdowns describe`](#gs-admin-data-management-dropdowns-describe) | Describe a Gainsight dropdown (picklist) category and its values | `data_management_describe_dropdown` |
| [`gs-admin data-management dropdowns list`](#gs-admin-data-management-dropdowns-list) | List Gainsight dropdown (picklist) categories | `data_management_list_dropdowns` |
| [`gs-admin data-management dropdowns upload-csv`](#gs-admin-data-management-dropdowns-upload-csv) | Bulk-create dropdown values from a CSV file | `data_management_upload_csv_dropdown_items` |
| [`gs-admin data-management objects add-field`](#gs-admin-data-management-objects-add-field) | Add fields to an existing custom object | `data_management_add_object_fields` |
| [`gs-admin data-management objects create`](#gs-admin-data-management-objects-create) | Create a new custom Gainsight object | `data_management_create_object` |
| [`gs-admin data-management objects describe`](#gs-admin-data-management-objects-describe) | Describe a Gainsight object with full field metadata | `data_management_describe_object` |
| [`gs-admin data-management objects list`](#gs-admin-data-management-objects-list) | List Gainsight objects | `data_management_list_objects` |
| [`gs-admin data-management objects list-and-describe`](#gs-admin-data-management-objects-list-and-describe) | List all objects and describe each one | `data_management_list_and_describe_objects` |
| [`gs-admin data-management objects update`](#gs-admin-data-management-objects-update) | Update an existing object or its fields | `data_management_update_object` |

---

### `gs-admin data-management dependencies check`
*Short form:* `gs-admin dm deps check`
*Path:* Object dependency operations

Get dependencies for a Gainsight object

Get all dependencies for a Gainsight object — shows where the object is used across reports, rules, connectors, layouts, etc.

**MCP tool:** `data_management_object_dependencies` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `POST /v1/meta/dependency/async/{{objectName}}` _(fetch)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--name` | `string` | ✓ | — | Object name |
| `--refresh` | `boolean` |  | `false` | Refresh dependency cache |
| `--areas` | `array` |  | `["REPORT","RELATIONSHIP","S3_CONNECTOR","MIXPANEL_V2","SEGMENT_IO_V2","GS_BULK_API","SFDC_V2","GAINSIGHT_PX_V2","MULTI_CONNECTION","COCKPIT","DYNAMICS_V2","C360","R360","SEARCH","ES_C360","ES_R360","UPDATE_KEY","IMPORT_LOOKUP","CALCULATED_FIELDS","MDA_LOOKUP","SELF_LOOKUP","HUBSPOT_V2","DATA_DESIGNER","CDP","RENEWAL_CENTER","PORTFOLIO","GS_USERS","RULE","PRODUCT_REQUESTS","SUCCESS_SNAPSHOT","SC_REPORT","SCORECARD","JOURNEY_ORCHESTRATOR","SEGMENTS","SUCCESS_PLAN","MATCH_CRITERIA","SPACES","CX_CENTER","SURVEY","CUSTOMER_GOALS","PORTFOLIO_PEOPLE_WIDGET","PERSON_LIST","ARCHIVAL_POLICY","GS_ASSIST","BIGQUERY","AHA","FRESHDESK","DATABRICKS","ECOSYSTEM","EVENTS_CONNECTOR","INTERCOM","PRODUCTBOARD","PIPEDRIVE","JIRA","GONG_IO","SAP_DATASPHERE","SNOWFLAKE","SERVICENOW","ZOOM","ZUORA","ZOHO","ZENDESK"]` | Dependency areas to check _(comma-separated)_ |
| `--fields` | `array` |  | — | Filter to only show dependencies that reference these field names _(comma-separated)_ |

**Examples**

```bash
gs-admin dm deps check --name <object-name>
```

### `gs-admin data-management dependencies config`
*Short form:* `gs-admin dm deps config`
*Path:* Object dependency operations

List available dependency areas

**MCP tool:** `data_management_dependency_config` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v1/meta/dependency/config`

**Flags**

_No flags._

**Examples**

```bash
gs-admin dm deps config
```

### `gs-admin data-management dropdowns add-item`
*Short form:* `gs-admin dm dd add-item`
*Path:* Dropdown (picklist) operations

Add a single value to an existing dropdown

**MCP tool:** `data_management_add_dropdown_item` · **Mutating:** yes ⚠️ · **Output:** `detail` · **Endpoint(s):** `POST /v1/meta/gdm/filteredPicklists` _(search)_, `GET /v1/meta/gdm/picklists/{{gsid}}` _(fetch)_, `PUT /v1/meta/gdm/picklists` _(save)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--name` | `string` |  | — | Dropdown name — required if --id not provided (resolved to GSID automatically) |
| `--id` | `string` |  | — | Dropdown GSID — required if --name not provided |
| `--item-name` | `string` | ✓ | — | Name of the new value |
| `--item-short` | `string` |  | — | Short name / abbreviation (defaults to item name) |
| `--item-desc` | `string` |  | `""` | Description |
| `--item-color` | `string` |  | `""` | Hex color (e.g. #bed6a8) |
| `--item-order` | `integer` |  | — | Display order (appended last if omitted) |
| `--item-active` | `boolean` |  | `true` | Whether the value is active |
| `--item-default` | `boolean` |  | `false` | Whether this is the default selected value |

**Examples**

```bash
gs-admin dm dd add-item --item-name <item-name>
```

### `gs-admin data-management dropdowns describe`
*Short form:* `gs-admin dm dd describe`
*Path:* Dropdown (picklist) operations

Describe a Gainsight dropdown (picklist) category and its values

Fetch full details and all values for a dropdown by GSID (--id) or name (--name). Name lookup resolves via the filtered-picklists search API.

**MCP tool:** `data_management_describe_dropdown` · **Mutating:** no · **Output:** `detail` · **Endpoint(s):** `GET /v1/meta/gdm/picklists/{{gsid}}` _(fetch)_, `POST /v1/meta/gdm/filteredPicklists` _(search)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--name` | `string` |  | — | Dropdown name (resolved to GSID automatically) |
| `--id` | `string` |  | — | Dropdown GSID |

**Examples**

```bash
gs-admin dm dd describe
```

### `gs-admin data-management dropdowns list`
*Short form:* `gs-admin dm dd list`
*Path:* Dropdown (picklist) operations

List Gainsight dropdown (picklist) categories

List all dropdown/picklist categories with optional search, type, and variant filtering. Supports server-side pagination and search, plus client-side sorting.

**MCP tool:** `data_management_list_dropdowns` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `POST /v1/meta/gdm/filteredPicklists` _(all)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--search` | `string` |  | `""` | Search text to filter dropdowns by name |
| `--limit` | `integer` |  | `25` | Max results per page |
| `--page` | `integer` |  | `1` | Page number |
| `--types` | `array` |  | `[]` | Filter by type (SYSTEM, CUSTOM) _(comma-separated)_ |
| `--variants` | `array` |  | `[]` | Filter by variant (SINGLE_SELECT, MULTI_SELECT) _(comma-separated)_ |
| `--sort-field` | `string` |  | — | Field to sort by (name, type, variant, count) |
| `--sort-dir` | `string` |  | `"ASC"` | Sort direction One of: `ASC`, `DESC`. |

**Examples**

```bash
gs-admin dm dd list
```

### `gs-admin data-management dropdowns upload-csv`
*Short form:* `gs-admin dm dd upload-csv`
*Path:* Dropdown (picklist) operations

Bulk-create dropdown values from a CSV file

Reads a CSV file and creates all rows as new values in the target dropdown in a single PUT request. Required CSV column: name. Optional: shortName, description, color, displayOrder, active (default true), default (default false).

**MCP tool:** `data_management_upload_csv_dropdown_items` · **Mutating:** yes ⚠️ · **Output:** `table` · **Endpoint(s):** `POST /v1/meta/gdm/filteredPicklists` _(search)_, `GET /v1/meta/gdm/picklists/{{gsid}}` _(fetch)_, `PUT /v1/meta/gdm/picklists` _(save)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--name` | `string` |  | — | Dropdown name (resolved to GSID automatically) |
| `--id` | `string` |  | — | Dropdown GSID |
| `--file` | `string` | ✓ | — | Path to CSV file |

**Examples**

```bash
gs-admin dm dd upload-csv --file <file>
```

**Notes**

```
CSV format:
  Columns (header row required):
    name*         Display name of the dropdown value  [required]
    shortName     Short label (defaults to name)
    description   Optional description text
    color         Hex color string, e.g. #FF0000
    displayOrder  Integer sort order
    active        true/false  (default: true)
    default       true/false  (default: false)

  Example:
    name,shortName,description,color,displayOrder,active,default
    "Open","O","Ticket is open","#00AA00",1,true,false
    "Closed","C","Ticket is closed","#FF0000",2,true,false
```

### `gs-admin data-management objects add-field`
*Short form:* `gs-admin dm o add-field`
*Path:* Gainsight object operations

Add fields to an existing custom object

Adds new fields to an existing GDM custom object. Field definitions are read from a CSV file (same format as dm o create).

**MCP tool:** `data_management_add_object_fields` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `GET /v1/meta/v10/gdm/objects/{{name}}` _(fetch)_, `PUT /v1/meta/v10/gdm/objects` _(update)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--name` | `string` | ✓ | — | Object name (e.g. "Test_Object__gc") |
| `--file` | `string` | ✓ | — | Path to CSV or JSON file defining fields to add |

**Examples**

```bash
gs-admin dm o add-field --name <name> --file <file>
```

**Notes**

```
Field file format — same as dm o create. CSV or JSON (.json extension auto-detected).
  See: gs-admin dm o create --help
```

### `gs-admin data-management objects create`
*Short form:* `gs-admin dm o create`
*Path:* Gainsight object operations

Create a new custom Gainsight object

Creates a new custom GDM object. Object name is derived from label (spaces → underscores, __gc suffix). Requires a CSV file defining at least one initial field.

**MCP tool:** `data_management_create_object` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `POST /v1/meta/v10/gdm/objects` _(create)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--label` | `string` | ✓ | — | Display name for the object (e.g. "My Object") |
| `--description` | `string` |  | — | Optional description |
| `--low-volume` | `boolean` |  | `true` | Low-volume object (≤ ~1M rows, stored in HAPOSTGRES). Use --no-low-volume for REDSHIFT. |
| `--file` | `string` | ✓ | — | Path to CSV or JSON file defining initial fields |

**Examples**

```bash
gs-admin dm o create --label <label> --file <file>
```

**Notes**

```
Field file format — CSV or JSON (.json extension auto-detected):

  CSV columns (header row required):
    label*             Display name of the field                       [required]
    type*              Field type: string, number, date, dateTime, boolean, gsid,
                       currency, email, url, richTextArea, picklist,
                       multiSelectDropdownList                         [required]
    description        Optional description
    defaultValue       Default field value
    hidden             true/false  (default: false)
    required           true/false  (default: false)
    maxLength          Max length for richTextArea fields
                       (HAPOSTGRES ≤ 150000, REDSHIFT ≤ 15000; defaults to store limit)
    dropdownId         Dropdown GSID for picklist / multiSelectDropdownList  [required unless dropdownName set]
    dropdownName       Dropdown display name — resolved to GSID automatically  [alternative to dropdownId]
    lookupObjectName   Object name this field looks up (e.g. "Company") — creates a lookup field
    lookupColumnName   Column in the referenced object                  [required when lookupObjectName set]
    referenceOperation DELETE | SET_NULL | NONE                         (default: NONE)

  JSON format — array of objects with the same keys as CSV columns:
    [{"label": "...", "type": "...", ...}, ...]

  Field name is derived from label (spaces → underscores, __gc suffix).

  CSV example:
    label,type,dropdownId,lookupObjectName,lookupColumnName,referenceOperation
    Customer Name,string,,,,,
    Status,picklist,1I00RJ83KO16YVZWZ36LV2IXESXEHKIBA4ZG,,,
    Account,string,,,Company,Name,DELETE

  JSON example:
    [{"label": "Customer Name", "type": "string"},
     {"label": "Status", "type": "picklist", "dropdownName": "Status List"},
     {"label": "Account", "type": "string", "lookupObjectName": "Company", "lookupColumnName": "Name"}]
```

### `gs-admin data-management objects describe`
*Short form:* `gs-admin dm o describe`
*Path:* Gainsight object operations

Describe a Gainsight object with full field metadata

**MCP tool:** `data_management_describe_object` · **Mutating:** no · **Output:** `detail` · **Endpoint(s):** `GET /v1/meta/v10/gdm/objects/{{objectName}}` _(fetch)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--name` | `string` | ✓ | — | Object name (e.g. 'Company') |

**Examples**

```bash
gs-admin dm o describe --name <object-name>
```

### `gs-admin data-management objects list`
*Short form:* `gs-admin dm o list`
*Path:* Gainsight object operations

List Gainsight objects

List all Gainsight Data Management objects (custom, standard, system). Returns paginated object list.

**MCP tool:** `data_management_list_objects` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `POST /v1/meta/objectViews/executeFilter` _(all)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--page` | `integer` |  | `1` | Page number |
| `--size` | `integer` |  | `25` | Page size |
| `--types` | `array` |  | `["custom","standard","system"]` | Object group types to include _(comma-separated)_ |
| `--search` | `string` |  | — | Optional search text to filter objects |
| `--limit` | `integer` |  | — | Max number of results to return |
| `--sort-field` | `string` |  | — | Field to sort by |
| `--sort-dir` | `string` |  | `"DESC"` | Sort direction One of: `ASC`, `DESC`. |

**Examples**

```bash
gs-admin dm o list
```

### `gs-admin data-management objects list-and-describe`
*Short form:* `gs-admin dm o list-and-describe`
*Path:* Gainsight object operations

List all objects and describe each one

**MCP tool:** `data_management_list_and_describe_objects` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `POST /v1/meta/objectViews/executeFilter` _(list)_, `GET /v1/meta/v10/gdm/objects/{{name}}` _(describe)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--types` | `array` |  | `["custom","standard","system"]` | Object group types to include _(comma-separated)_ |
| `--search` | `string` |  | — | Optional search text |
| `--limit` | `integer` |  | — | Max number of objects to describe |
| `--page` | `integer` |  | `1` | Page number |
| `--sort-field` | `string` |  | — | Field to sort by |
| `--sort-dir` | `string` |  | `"DESC"` | Sort direction One of: `ASC`, `DESC`. |

**Examples**

```bash
gs-admin dm o list-and-describe
```

### `gs-admin data-management objects update`
*Short form:* `gs-admin dm o update`
*Path:* Gainsight object operations

Update an existing object or its fields

Updates object metadata (label, description) and/or patches existing fields. Field changes are read from a CSV file where each row identifies a field by name and specifies only the columns to change.

**MCP tool:** `data_management_update_object` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `GET /v1/meta/v10/gdm/objects/{{name}}` _(fetch)_, `PUT /v1/meta/v10/gdm/objects` _(update)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--name` | `string` | ✓ | — | Object system name (e.g. "Test_Object__gc") |
| `--new-label` | `string` |  | — | New display label for the object |
| `--description` | `string` |  | — | New description for the object |
| `--file` | `string` |  | — | Path to CSV file with field updates |

**Examples**

```bash
gs-admin dm o update --name <name>
```

**Notes**

```
Field update file format — CSV or JSON (.json extension auto-detected):

  Columns (header row required for CSV):
    name*         Field system name (e.g. Customer_Name__gc)  [required — identifies the field]
    label         New display label
    description   New description
    defaultValue  New default value
    hidden        true/false
    required      true/false

  Only columns that are present and non-empty are applied; omitted columns retain their current values.

  CSV example:
    name,label,description,defaultValue,hidden,required
    Customer_Name__gc,Customer Name,Primary contact name,Default,false,true
    Deal_Value__gc,Deal Value,,,false,false

  JSON example:
    [{"name": "Customer_Name__gc", "label": "Customer Name", "required": true},
     {"name": "Deal_Value__gc", "hidden": false}]
```

