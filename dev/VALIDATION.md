# VALIDATION — deferred live checks

Dev-branch-only. Each section is one check a builder round could not run (no tenant
token in the builder session, or a walk only a tester session can perform), banked here
so it is measured before the next release rather than forgotten. The round's Blind spots
line on dev/FEEDBACK.md names the section by its heading and token. When a check runs,
append its verdict here with the date and the token, and copy the measurement into the
finding's verdict on the bus; a spent check is marked CLEARED (or retired, with why).

## F-449 — sandbox live arm: re-decide `report list-objects` through the evidence-bound verb (banked 2026-09-11, builder — OPEN)

Owed by: the tester round on the token the F-449 handoff mints (see the Under test line).
Tenant: the sandbox, which still carries the 2026-08-09 exclusion
whose reason reads "253 match by objectName … more completely". Prod cannot host this arm:
it already adopted the command as `report-objects`, so the overlap check there reads
allIndexed under that very domain.
Reads only against the tenant; the writes are to the local workspace manifest.

Steps (from the consumer workspace, plugin loaded from the working tree):
1. `node .gs-superadmin/plugin/scripts/manifest.mjs exclude --manifest <sandbox-slug>/_manifest.json --command "report list-objects" --remove`
2. Capture `gs-admin --json report list-objects` fresh through the capture helper
   (Phase 4's invocation shape) to a tmp file.
3. `node .gs-superadmin/plugin/scripts/domain-candidates.mjs check --manifest <sandbox-slug>/_manifest.json --file <tmp> --id-field objectName --out .gs-superadmin/tmp/check-report-list-objects.json`
   (objectName is the key data-management is indexed by — the recorded reason's own
   basis; a check by objectId reads 0 matched, as the reason says).
4. Attempt the 2026-08-09 decision: `manifest.mjs exclude … --command "report list-objects" --reason "covered by data-management" --check .gs-superadmin/tmp/check-report-list-objects.json --covered-by data-management`.
5. Adopt it: `upsert-batch` under the diff's `suggestedName` (prod named it `report-objects`;
   list-only, `--describe-command none`), then `diff --require-decided`.

Pass bar: step 4 exits 1 with "NOT covered by data-management" quoting the fresh
`<matched> of <unique>` numbers — the ratio is the claim (43% in August; a different count
today is expected, the sandbox is in use). Step 5 leaves the diff reading the command as
indexed. A verdict that step 4 exited 0 REOPENS F-449. Record the fresh numbers on the bus.

Blind spot this arm does not cover: the ADOPT direction (the journey-data-designer
instance on the F-449 Sibling sweep line) — a decision for Bradley, not a measurement.
