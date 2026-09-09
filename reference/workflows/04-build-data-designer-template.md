# Workflow: Build a Data Designer template

Goal: assemble a **Design Template** (a data-preparation flow) that extracts from objects
and merges them — the prepared dataset many other features (JO sources, COMPLEX rules)
consume.

## 1. Create the template (basic details)

```bash
gs-admin dd t create --name "Risk_UDS" --description "Accounts + usage for risk"
```

## 2. Add tasks (extract, then merge)

Extract from a source object:

```bash
gs-admin dd t add-task --template-name "Risk_UDS" --type extract --name "Companies" --object-name Company
```

Add a second extract, then merge/join the two:

```bash
gs-admin dd t add-task --template-name "Risk_UDS" --type extract --name "Usage" --object-name Usage_Data
gs-admin dd t add-task --template-name "Risk_UDS" --type merge --name "Company+Usage" --join-on "Company.Gsid=Usage_Data.CompanyId"
```

> Edit an extract task later with `dd t edit-task`. Field/operator details for tasks are
> in the domain reference.

## 3. Preview the output

```bash
gs-admin dd t preview --template-name "Risk_UDS"
```

## 4. Inspect / clean up

```bash
gs-admin dd t describe --template-name "Risk_UDS"   # header + all tasks
gs-admin dd t list                                  # all templates
gs-admin dd t delete --template-name "Risk_UDS"     # remove it
```

## Where it's used

- As a **JO participant source**: `jo p src dd-setup --object-name "Risk_UDS"`
  (see [02-build-jo-program.md](02-build-jo-program.md)).
- As a **COMPLEX rule source**: `re r set-source-template --template-name "Risk_UDS"`
  (see [03-author-rule-with-cta.md](03-author-rule-with-cta.md)).

Full flag lists: [../domains/data-designer.md](../domains/data-designer.md).
