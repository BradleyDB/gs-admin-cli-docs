<!-- GENERATED FILE — do not edit by hand. Regenerate with: npm run build:reference (build/build-reference.mjs). -->

# Scorecard (`scorecard` / `sc`)

Scorecard operations

**10 commands.** 

| Command | Summary | MCP tool |
|---------|---------|----------|
| [`gs-admin scorecard create`](#gs-admin-scorecard-create) | Create a new scorecard | `scorecard_create_scorecard` |
| [`gs-admin scorecard list`](#gs-admin-scorecard-list) | List all scorecards | `scorecard_list_scorecards` |
| [`gs-admin scorecard measure assign`](#gs-admin-scorecard-measure-assign) | Assign measures / measure groups to a scorecard | `scorecard_assign_measures` |
| [`gs-admin scorecard measure create`](#gs-admin-scorecard-measure-create) | Create a new scorecard measure | `scorecard_create_measure` |
| [`gs-admin scorecard measure list`](#gs-admin-scorecard-measure-list) | List all scorecard measures (levelType: MEASURE) | `scorecard_list_measures` |
| [`gs-admin scorecard measure-group create`](#gs-admin-scorecard-measure-group-create) | Create a new scorecard measure group | `scorecard_create_measure_group` |
| [`gs-admin scorecard measure-group list`](#gs-admin-scorecard-measure-group-list) | List all scorecard measure groups (levelType: GROUP) | `scorecard_list_measuregroups` |
| [`gs-admin scorecard measures`](#gs-admin-scorecard-measures) | Show measures and score weights for a scorecard | `scorecard_get_scorecard_measures` |
| [`gs-admin scorecard scheme list`](#gs-admin-scorecard-scheme-list) | List all scorecard scoring schemes | `scorecard_list_schemes` |
| [`gs-admin scorecard update`](#gs-admin-scorecard-update) | Update an existing scorecard | `scorecard_update_scorecard` |

---

### `gs-admin scorecard create`
*Short form:* `gs-admin sc create`

Create a new scorecard

Create a new scorecard. Requires --name and either --scheme-id (GSID from `sc scheme list`) or --scheme-name (searches and picks first match). Entity type defaults to ACCOUNT. Overall and group rollups are enabled by default. The scorecard is created inactive by default.

**MCP tool:** `scorecard_create_scorecard` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `POST /v1/scorecards/save` _(create)_, `GET /v1/scorecards/schemes` _(schemes)_, `GET /v1/meta/v10/gdm/objects/{{objectName}}` _(describe)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--name` | `string` | ✓ | — | Scorecard name |
| `--scheme-id` | `string` |  | — | Scoring scheme GSID (from `sc scheme list`) |
| `--scheme-name` | `string` |  | — | Scoring scheme name — searches and picks first match |
| `--entity-type` | `string` |  | `"ACCOUNT"` | Entity type: ACCOUNT (default) or RELATIONSHIP One of: `ACCOUNT`, `RELATIONSHIP`. |
| `--description` | `string` |  | `""` | Optional description |
| `--active` | `boolean` |  | `false` | Activate the scorecard immediately (default: false) |
| `--make-default` | `boolean` |  | `false` | Make this the default scorecard (default: false) |
| `--overall-rollup` | `boolean` |  | `true` | Enable overall rollup (default: true) |
| `--group-rollup` | `boolean` |  | `true` | Enable group rollup (default: true) |
| `--history` | `boolean` |  | `false` | Enable score history tracking (default: false) |
| `--filter` | `string` |  | — | Filter conditions as a JSON array string: [{"field":"Industry","op":"EQ","value":"Retail"},{"field":"Employees","op":"GTE","value":10}]. Supported ops: EQ, NE, EQ_CIS, NE_CIS, LT, GT, LTE, GTE, BTW, IN, NOT_IN, IS_NULL, IS_NOT_NULL, CONTAINS, DOES_NOT_CONTAINS, STARTS_WITH, ENDS_WITH, CONTAINS_CS, DOES_NOT_CONTAINS_CS, STARTS_WITH_CS, ENDS_WITH_CS, INCLUDES, EXCLUDES. For picklist fields pass the picklist item value as the right-hand side. |

**Examples**

```bash
gs-admin sc create --name <name>
```

### `gs-admin scorecard list`
*Short form:* `gs-admin sc list`

List all scorecards

List all Scorecards with their entity type, active status, measure/rollup counts, and last modified info.

**MCP tool:** `scorecard_list_scorecards` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v1/scorecards` _(all)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--name` | `string` |  | — | Filter by name (case-insensitive contains) |
| `--limit` | `integer` |  | — | Max number of results to return |
| `--page` | `integer` |  | `1` | Page number |
| `--sort-field` | `string` |  | — | Field to sort by |
| `--sort-dir` | `string` |  | `"DESC"` | Sort direction One of: `ASC`, `DESC`. |

**Examples**

```bash
gs-admin sc list
```

### `gs-admin scorecard measure assign`
*Short form:* `gs-admin sc m assign`
*Path:* Measure operations

Assign measures / measure groups to a scorecard

Assign one or more measures or measure groups to a scorecard. Existing assignments are preserved — only new IDs are added. Weights are redistributed equally across all top-level items unless --weights is provided. Provide --scorecard-id or --scorecard-name to identify the scorecard.

**MCP tool:** `scorecard_assign_measures` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `GET /v1/scorecards` _(list)_, `GET /v1/scorecards/measures` _(measures)_, `GET /v1/scorecards/measures/{{scorecardId}}/mapping` _(mapping)_, `POST /v1/scorecards/measures/{{scorecardId}}/mapping` _(save)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--scorecard-id` | `string` |  | — | Scorecard GSID (from `sc list`) |
| `--scorecard-name` | `string` |  | — | Scorecard name — searches and picks first match |
| `--measures` | `array` | ✓ | — | Comma-separated measure or measure-group IDs to assign (from `sc measure list` / `sc group list`) _(comma-separated)_ |
| `--weights` | `array` |  | — | Comma-separated integer weights for ALL top-level mapped items (existing + new), must sum to 100. If omitted, weights are distributed equally. _(comma-separated)_ |

**Examples**

```bash
gs-admin sc m assign --measures <measures>
```

### `gs-admin scorecard measure create`
*Short form:* `gs-admin sc m create`
*Path:* Measure operations

Create a new scorecard measure

Create a new scorecard measure. Entity type defaults to ACCOUNT (pass --entity-type RELATIONSHIP to override). Input type defaults to MANUAL (pass --input-type CALCULATED to override). Level type is always MEASURE.

**MCP tool:** `scorecard_create_measure` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `POST /v1/scorecards/measures/save` _(create)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--name` | `string` | ✓ | — | Measure name |
| `--entity-type` | `string` |  | `"ACCOUNT"` | Entity type: ACCOUNT (default) or RELATIONSHIP One of: `ACCOUNT`, `RELATIONSHIP`. |
| `--input-type` | `string` |  | `"MANUAL"` | Input type: MANUAL (default) or CALCULATED One of: `MANUAL`, `CALCULATED`. |
| `--description` | `string` |  | `""` | Optional description |

**Examples**

```bash
gs-admin sc m create --name <name>
```

### `gs-admin scorecard measure list`
*Short form:* `gs-admin sc m list`
*Path:* Measure operations

List all scorecard measures (levelType: MEASURE)

List all scorecard measures (levelType: MEASURE) defined on this tenant. Each entry includes name, entity type, input type (MANUAL/CALCULATED), active status, which scorecards use it, and modified info.

**MCP tool:** `scorecard_list_measures` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v1/scorecards/measures` _(all)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--name` | `string` |  | — | Filter by name (case-insensitive contains) |
| `--limit` | `integer` |  | — | Max number of results to return |
| `--page` | `integer` |  | `1` | Page number |
| `--sort-field` | `string` |  | — | Field to sort by |
| `--sort-dir` | `string` |  | `"DESC"` | Sort direction One of: `ASC`, `DESC`. |

**Examples**

```bash
gs-admin sc m list
```

### `gs-admin scorecard measure-group create`
*Short form:* `gs-admin sc mg create`
*Path:* Measure group operations

Create a new scorecard measure group

Create a new scorecard measure group (levelType: GROUP). Provide --children as a comma-separated list of measure IDs (from `sc measure list`). Display order is assigned in the order IDs are given.

**MCP tool:** `scorecard_create_measure_group` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `POST /v1/scorecards/measures/save` _(create)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--name` | `string` | ✓ | — | Measure group name |
| `--entity-type` | `string` |  | `"ACCOUNT"` | Entity type: ACCOUNT (default) or RELATIONSHIP One of: `ACCOUNT`, `RELATIONSHIP`. |
| `--input-type` | `string` |  | `"CALCULATED"` | Input type: CALCULATED (default) or MANUAL One of: `MANUAL`, `CALCULATED`. |
| `--description` | `string` |  | `""` | Optional description |
| `--no-active` | `boolean` |  | `true` | Create the group as active (default: true) |
| `--children` | `array` |  | `[]` | Comma-separated measure IDs to include (from `sc measure list`) _(comma-separated)_ |

**Examples**

```bash
gs-admin sc mg create --name <name>
```

### `gs-admin scorecard measure-group list`
*Short form:* `gs-admin sc mg list`
*Path:* Measure group operations

List all scorecard measure groups (levelType: GROUP)

List all scorecard measure groups (levelType: GROUP) defined on this tenant. Each entry includes name, entity type, input type, active status, which scorecards use it, and modified info.

**MCP tool:** `scorecard_list_measuregroups` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v1/scorecards/measures` _(all)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--name` | `string` |  | — | Filter by name (case-insensitive contains) |
| `--limit` | `integer` |  | — | Max number of results to return |
| `--page` | `integer` |  | `1` | Page number |
| `--sort-field` | `string` |  | — | Field to sort by |
| `--sort-dir` | `string` |  | `"DESC"` | Sort direction One of: `ASC`, `DESC`. |

**Examples**

```bash
gs-admin sc mg list
```

### `gs-admin scorecard measures`
*Short form:* `gs-admin sc measures`

Show measures and score weights for a scorecard

Get measure details and score weights for a scorecard. Provide --id (scorecardId from `sc list`) or --name (searches and picks first match). Returns rollup groups with their child measures and weights.

**MCP tool:** `scorecard_get_scorecard_measures` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v1/scorecards` _(list)_, `GET /v1/scorecards/measures/{{scorecardId}}/mapping` _(fetch)_, `GET /v1/scorecards/schemes` _(schemes)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--id` | `string` |  | — | Scorecard GSID (id field from list-scorecards) |
| `--name` | `string` |  | — | Scorecard name — searches list and picks first match |

**Examples**

```bash
gs-admin sc measures
```

### `gs-admin scorecard scheme list`
*Short form:* `gs-admin sc sch list`
*Path:* Scoring scheme operations

List all scorecard scoring schemes

List all scorecard scoring schemes with their type, range, status, display order, and number of score definitions.

**MCP tool:** `scorecard_list_schemes` · **Mutating:** no · **Output:** `table` · **Endpoint(s):** `GET /v1/scorecards/schemes` _(all)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--name` | `string` |  | — | Filter by name (case-insensitive contains) |
| `--limit` | `integer` |  | — | Max number of results to return |
| `--page` | `integer` |  | `1` | Page number |
| `--sort-field` | `string` |  | — | Field to sort by |
| `--sort-dir` | `string` |  | `"DESC"` | Sort direction One of: `ASC`, `DESC`. |

**Examples**

```bash
gs-admin sc sch list
```

### `gs-admin scorecard update`
*Short form:* `gs-admin sc update`

Update an existing scorecard

Update an existing scorecard. Identify it with --scorecard-id or --scorecard-name. Only pass the fields you want to change — name, description, scheme, and filter. All other properties (active, rollup settings, entityType, etc.) are preserved from the current scorecard.

**MCP tool:** `scorecard_update_scorecard` · **Mutating:** yes ⚠️ · **Output:** `status` · **Endpoint(s):** `GET /v1/scorecards` _(list)_, `PUT /v1/scorecards/update` _(update)_, `GET /v1/scorecards/schemes` _(schemes)_, `GET /v1/meta/v10/gdm/objects/{{objectName}}` _(describe)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--scorecard-id` | `string` |  | — | Scorecard GSID to update (from `sc list`) |
| `--scorecard-name` | `string` |  | — | Scorecard name — searches and picks first match |
| `--name` | `string` |  | — | New name for the scorecard |
| `--scheme-id` | `string` |  | — | New scoring scheme GSID (from `sc scheme list`) |
| `--scheme-name` | `string` |  | — | New scoring scheme name — searches and picks first match |
| `--description` | `string` |  | — | New description |
| `--filter` | `string` |  | — | New filter conditions as a JSON array string (replaces existing filter). Same format as `sc create --filter`. |

**Examples**

```bash
gs-admin sc update
```

