# Workflow: Author a Rules Engine rule with a CTA

Goal: build a rule that finds at-risk accounts and raises a **Call To Action (CTA)**. The
rules-engine commands are explicitly numbered **Step 1–4**, which makes the order obvious.

## Step 1 — Create the rule (basic details)

```bash
gs-admin re r create --name "ARR drop → Risk CTA" --description "Flag ARR drops"
```

## Step 2 — Set the data source

Simple (single object / SOF):

```bash
gs-admin re r set-source --rule-name "ARR drop → Risk CTA" --type MDA --object-name Company
```

Complex (prepared via a Data Designer template):

```bash
gs-admin re r set-source-template --rule-name "ARR drop → Risk CTA" --template-name "Risk_UDS"
```

Discover the fields you can use in criteria/actions:

```bash
gs-admin re r list-task-outputs --rule-name "ARR drop → Risk CTA"
```

## Step 3 — Add criteria

```bash
gs-admin re r add-criteria --rule-name "ARR drop → Risk CTA" --condition "A:Arr:LT:50000"
```

## Step 4 — Add the CTA action

```bash
gs-admin re r add-action cta --rule-name "ARR drop → Risk CTA" --type Risk --priority Medium --reason "ARR decline" --owner-field "CSM"
```

Other action types share the same `add-action <type>` shape — e.g. `set-score`,
`success-plan`, `close-cta`, `load-to-gainsight`, `load-to-company`, `load-to-object`,
`external-action`. Edit later with `re r edit-action <type> --action-id <id> …`, or remove
with `re r delete-action`.

## Schedule and/or run

```bash
gs-admin re r schedule --rule-name "ARR drop → Risk CTA" --cron "0 6 * * *"   # daily 06:00
gs-admin re r run-now  --rule-name "ARR drop → Risk CTA"                       # on-demand
```

## Inspect & debug

```bash
gs-admin re r describe   --name "ARR drop → Risk CTA"     # tasks, criteria, actions
gs-admin re r executions --name "ARR drop → Risk CTA"     # run history
gs-admin re r debug      --name "ARR drop → Risk CTA"     # current run, recent runs, trend
```

> Rule **chains** (ordered sets of rules) live under `re chains` —
> `re chains list|describe|debug`.

Full flag lists: [../domains/rules-engine.md](../domains/rules-engine.md).
