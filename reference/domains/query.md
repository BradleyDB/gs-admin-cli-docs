<!-- GENERATED FILE — do not edit by hand. Regenerate with: npm run build:reference (build/build-reference.mjs). -->

# Query (`query` / `q`)

Query Gainsight objects using the Query API

**1 command.** 

| Command | Summary | MCP tool |
|---------|---------|----------|
| [`gs-admin query execute`](#gs-admin-query-execute) | Query a Gainsight object by name and field list | `query_execute` |

---

### `gs-admin query execute`
*Short form:* `gs-admin q execute`

Query a Gainsight object by name and field list

Describes the object to resolve physical DB names, builds a GSQL query, and POSTs to POST /v2/queries. Appends ORDER BY and LIMIT to the query string when provided. Default limit is 50. Prints a table in CLI mode; returns a JSON array in MCP mode.

**MCP tool:** `query_execute` · **Mutating:** no · **Output:** `query` · **Endpoint(s):** `POST /v2/queries` _(fetch)_

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--object` | `string` | ✓ | — | Gainsight object name (e.g. 'Company'). The object is described first to resolve the physical DB name and field DB names. |
| `--select` | `array` | ✓ | — | Comma-separated field names to SELECT (e.g. 'Name,Arr,Status'). Each field is resolved to its physical dbName via the object schema. _(comma-separated)_ |
| `--limit` | `integer` |  | `50` | Appends LIMIT N to the query. Default: 50. |
| `--page` | `integer` |  | — | Page number (1-based). Appends OFFSET (page-1)*limit to the query. |
| `--order-by` | `string` |  | — | Appends ORDER BY <value> to the query. Example: 'Name ASC' or 'Arr DESC'. |
| `--timezone` | `string` |  | `"UTC"` | Timezone for date/time fields (e.g. America/Los_Angeles). Sent as 'tz' in the request body. |
| `--hp` | `boolean` |  | `false` | High-priority query execution. |
| `--cmode` | `string` |  | — | Compatibility mode (e.g. IGNORE). |
| `--include-picklist-system-name` | `boolean` |  | `false` | Return picklist system names instead of display labels. |
| `--use-cte` | `boolean` |  | `false` | Use CTE (Common Table Expression) when applicable. |
| `--skip-tz-offset` | `boolean` |  | `false` | Skip timezone offset adjustment in WHERE filters. |
| `--consumer-asset-type` | `string` |  | — | Consumer asset type context (e.g. GS_REPORTS). |

**Examples**

```bash
gs-admin q execute --object Company --select Name,Status
gs-admin q execute --object Company --select Name,Arr --limit 100 --order-by 'Arr DESC'
gs-admin q execute --object Company --select Name,Arr --limit 50 --page 2
gs-admin q execute --object Company --select Name,Arr --hp --cmode IGNORE
gs-admin q execute --object Company --select Name,Status --include-picklist-system-name
```

