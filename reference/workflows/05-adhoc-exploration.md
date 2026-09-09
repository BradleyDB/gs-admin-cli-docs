# Workflow: Ad-hoc data exploration

Goal: answer "what's in my tenant?" quickly — discover objects and fields, run a query,
and pull a report. Great for sanity checks and for feeding IDs into other commands.

## 1. Discover objects and fields

```bash
gs-admin dm objects list --search Company           # find objects
gs-admin dm objects describe --name Company         # full field metadata (names, types)
gs-admin dm dropdowns list                          # picklist categories
gs-admin dm dropdowns describe --name "Stage"       # values in a picklist
```

## 2. Query data ad-hoc

```bash
gs-admin q execute --object Company --select Name,Arr,Status --limit 50
gs-admin q execute --object Company --select Name,Arr --order-by 'Arr DESC' --limit 100
# Scriptable JSON:
gs-admin --json q execute --object Company --select Name,Arr --limit 100
```

`q execute` describes the object first to resolve physical field names, builds GSQL, and
posts to the Query API. Default `--limit` is 50; paginate with `--page`.

## 3. Work with reports

```bash
gs-admin rp list                                    # saved reports
gs-admin rp describe --name "Quarterly ARR"         # columns, sort, filters
gs-admin rp run --name "Quarterly ARR"              # execute and return rows (nothing saved)
gs-admin report list-objects                        # BI source objects
gs-admin report schema --object Company             # BI fields/lookups for one object
```

> Building/saving a report payload is intricate — the `report` domain ships a detailed
> spec digest (date-literal/operator pairing, picklist **IDs not labels**, server-populated
> fields to omit). Read it before `report create`/`update`:
> [../domains/report.md](../domains/report.md).

## 4. Check dependencies before you change things

```bash
gs-admin dm dependencies check --name Company       # what references this object
```

## Handy combinations

```bash
# Pull just IDs to feed the next command (when the action supports the ids format)
gs-admin --format ids re r list

# Bulk list + describe in one shot
gs-admin dm objects list-and-describe --search Account
```

Full flag lists: [../domains/data-management.md](../domains/data-management.md),
[../domains/query.md](../domains/query.md), [../domains/report.md](../domains/report.md).
