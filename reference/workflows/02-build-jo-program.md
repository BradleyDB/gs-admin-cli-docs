# Workflow: Build a Journey Orchestrator program

Goal: go from nothing to a **published** Dynamic Program with a participant source and an
email step. This is the flagship multi-step build and the best showcase of the CLI.

> **The cache/save model — read this first.** Every *mutating* `jo` command writes to a
> fast **local cache** (~5 ms), not the backend. Nothing is persisted until you run
> `jo p save` (manual) or `jo p publish` (which saves automatically). That's why a long
> build is fast — and why closing out without save/publish loses the work.

## 1. Create the program

```bash
gs-admin jo p create --name "Onboarding – EMEA"
# → returns the program id (a GUID). Use it as <id> below.
```

## 2. Attach a participant source (pick one)

CSV, one-shot (upload + attach + map + optional unique criteria):

```bash
gs-admin jo p src csv-setup --id <id> --file ./participants.csv --standard-mapping "gsAccountId,AccountId,recipientEmailAddress,Email"
```

> `--standard-mapping` is a flat comma-separated list alternating **fixed identity keys**
> (`gsAccountId`, `recipientEmailAddress`, optional `gsPersonId`) with the column that
> supplies each — not arbitrary `Header:field` pairs. Column names must match the CSV
> headers (or DD field labels); both identity keys are required, and the CLI rejects any
> other shape loudly (`gsAccountId is required in --standard-mapping`).

Data Designer source, one-shot:

```bash
gs-admin jo p src dd-setup --id <id> --object-name "Onboarding_UDS" --standard-mapping "gsAccountId,AccountId,recipientEmailAddress,Email"
```

Granular alternative (1.0.8 and later) — the same steps the composites bundle, split
apart. Useful when the mapping has to be computed between attaching the source and
mapping it (e.g. inspect what got attached first, then derive the mapping):

```bash
# CSV: upload the file, attach it as the source, then map
gs-admin jo p src upload-csv --id <id> --file ./participants.csv   # → returns the S3 URL
gs-admin jo p src csv-save --id <id> --csv-name "participants.csv" --csv-headers "AccountId,Email" --s3-url <s3-url>
gs-admin jo p src describe --id <id>                               # → participantSourceConfigurationId
gs-admin jo p src map --id <id> --source-id <source-id> --standard-mapping "gsAccountId,AccountId,recipientEmailAddress,Email"

# Data Designer: attach, then map
gs-admin jo p src dd-save --id <id> --object-name "Onboarding_UDS"
gs-admin jo p src describe --id <id>                               # → participantSourceConfigurationId
gs-admin jo p src map --id <id> --source-id <source-id> --standard-mapping "gsAccountId,AccountId,recipientEmailAddress,Email"
```

> **Requires 1.0.8.** Before that, this order failed inside one session: an attached
> source lives only in the local cache until `jo p save`, and `map`'s pre-edit peek
> always read the backend, so it never saw a cache-only source. Since 1.0.8 `map` reads
> the cache when one exists, so attach → map succeeds before any save. Like every other
> mutating `jo` step here, nothing persists until `jo p save`/`jo p publish` (step 5).

Verify what's attached:

```bash
gs-admin jo p src describe --id <id>
```

## 3. Add an email node

Fast path — a complete node from one JSON config:

```bash
gs-admin jo p n e add --id <id> --config-file ./email-node.json
```

Granular path (mirrors the required order — template first, then headers/tokens):

```bash
gs-admin jo p n e create --id <id> --name "Welcome email"
gs-admin jo p n e set-template --id <id> --node-id <node-id> --template-id <template-id>
gs-admin jo p n e set-global-headers --id <id> --node-id <node-id> --from-name "CS Team" --from-email "cs@acme.com"
gs-admin jo p n e map-standard-tokens --id <id> --node-id <node-id> --token-mappings '{"firstName":"FirstName"}'
```

Optional: a delay before/after, and an exit timer that branches Opened/Not-Opened:

```bash
gs-admin jo p n add-delay --id <id> --timer-value 2 --interval-unit DAYS
gs-admin jo p n e set-exit-timer --id <id> --node-id <node-id> --timer-value 3 --interval-unit DAYS
```

## 4. Wire the flow

```bash
# Connect node outPorts → inPorts. Get port ids from: gs-admin jo p describe --id <id>
gs-admin jo p n connect --id <id> --from-port <out-port> --to-port <in-port>

# …or set the entire connection set atomically:
gs-admin jo p n set-connections --id <id> --connections-json '[{"from":"<out>","to":"<in>"}]'
```

## 5. Validate, save, publish

```bash
gs-admin jo p validate --id <id>          # read-only pre-publish checks (no mutation)
gs-admin jo p save --id <id>              # flush the local cache to the backend
gs-admin jo p publish --id <id> --wait    # validate → save → publish, polling until done
gs-admin jo p publish-status --id <id>    # check status any time
```

## Lifecycle controls

```bash
gs-admin jo p pause  --id <id>     # PROCESSING → PAUSE
gs-admin jo p resume --id <id>     # PAUSE → PROCESSING (auto-saves cache first)
gs-admin jo p stop   --id <id>     # terminate (irreversible at the backend)
```

## Safer alternative: Lane 2 runtime

For validate-before-apply with resume/idempotency, the JO asset type supports the Lane-2
pipeline (`runtime_create_draft` → `validate_draft` → `plan_run` → `apply_run`). See
[../lane2-runtime.md](../lane2-runtime.md).

Full flag lists: [../domains/journey.md](../domains/journey.md).
