# VALIDATION — deferred live checks

Dev-branch-only. Each section is one check a builder round could not run (no tenant
token in the builder session, or a walk only a tester session can perform), banked here
so it is measured before the next release rather than forgotten. The round's Blind spots
line on dev/FEEDBACK.md names the section by its heading and token. When a check runs,
append its verdict here with the date and the token, and copy the measurement into the
finding's verdict on the bus; a spent check is marked CLEARED (or retired, with why).

## F-449 — sandbox live arm: re-decide `report list-objects` through the evidence-bound verb (banked 2026-09-11, builder — CLEARED 2026-09-11 @ hb-20260911-03)

CLEARED 2026-09-11 (tester, Session A-V) @ hb-20260911-03 — PASS. Fresh capture 588 rows;
check: uniqueIds 588, alreadyIndexed 253, matchedByDomain data-management 253 (plus the
duplicate journey-side domain 69, since removed by the second arm); step 4 EXITED 1 quoting
"253 of 588"; adopted as `report-objects`. Full record on the bus under F-449 (Verified:
line). Builder note: step 3 as banked lacked `--command "report list-objects"`, which the
review round made mandatory after the arm was written — the verb refused the banked form
and the tester re-ran with the flag (the shipped fence carries it). Corrected below so the
record is runnable as written.

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
3. `node .gs-superadmin/plugin/scripts/domain-candidates.mjs check --manifest <sandbox-slug>/_manifest.json --file <tmp> --id-field objectName --command "report list-objects" --out .gs-superadmin/tmp/check-report-list-objects.json`
   (objectName is the key data-management is indexed by — the recorded reason's own
   basis; a check by objectId reads 0 matched, as the reason says).
4. Attempt the 2026-08-09 decision: `manifest.mjs exclude … --command "report list-objects" --reason "covered by data-management" --check .gs-superadmin/tmp/check-report-list-objects.json --covered-by data-management`.
5. Adopt it: `upsert-batch` under the diff's `suggestedName` (prod named it `report-objects`;
   list-only, `--describe-command none`), then `diff --require-decided`.

Pass bar: step 4 exits 1 with "NOT covered by data-management" quoting the fresh
`<matched> of <unique>` numbers — the ratio is the claim (43% in August; a different count
today is expected, the sandbox is in use). Step 5 leaves the diff reading the command as
indexed. A verdict that step 4 exited 0 REOPENS F-449. Record the fresh numbers on the bus.

Blind spot this arm does not cover: the ADOPT direction — ruled 2026-09-11 (Bradley) and
banked as the second section below.

## F-449 sibling — sandbox re-decision of `journey data-designer list` through the coverage-ACCEPT path (banked 2026-09-11, builder — CLEARED 2026-09-11 @ hb-20260911-03)

CLEARED 2026-09-11 (tester, Session A-V) @ hb-20260911-03 — PASS. Steps 1–4 de-registered
the duplicate domain through the plugin's verbs (`removed: 69`); fresh capture 69 rows; check:
allIndexed true, data-management 69 (and the newly adopted `report-objects` 69 — the
symmetry rule decided coverage on the named domain); step 7 exited 0 with kind coverage;
step 8's diff lists it as coverage with evidence. `deps-report` still answers for one of the
69 names through data-management. Surfaced F-459: step 2's `docPaths` read 0 on this
domain because its July entries carry no `doc_path` — the docs were deleted by folder.
Step 2's sentence below is therefore not reliable on legacy domains until F-459 lands.

Owed by: the same tester round as the section above (Session A-V).
Ruling (Bradley, 2026-09-11; measured by the builder on the sandbox KB): the rows are Data
Designer output datasets, which live in data management and appear under the journey
namespace only because a program can use one as a participant source. The `jo data-designer
get` payload (objectName, label, fieldCount, fields) is a strict subset of `dm objects
describe`; the dataset's lineage lives in its design (the `data-designer` domain), never
here. Prod's exclusion as covered by data-management was correct; the sandbox's 69-asset
`journey-data-designer` domain is a duplicate view and is re-decided here. This exercises
the verb's ACCEPT path on real data, complementing the refuse path above.
Reads only against the tenant (one list capture); the writes are to the local workspace.

Steps (from the consumer workspace, plugin loaded from the working tree):
1. Build the keys file from the manifest — a JSON array of the domain's inventory keys
   (`journey-data-designer/<id>`), written to `.gs-superadmin/tmp/jdd-keys.json` with a
   one-line node read of `<sandbox-slug>/_manifest.json` (read the manifest; never hand-edit it).
2. `node .gs-superadmin/plugin/scripts/manifest.mjs remove --manifest <sandbox-slug>/_manifest.json --keys-file .gs-superadmin/tmp/jdd-keys.json`
   — expect `removed: 69`; the summary's `docPaths` lists the stub docs to delete.
3. `node .gs-superadmin/plugin/scripts/manifest.mjs remove --manifest <sandbox-slug>/_manifest.json --domain journey-data-designer`
   — de-registers the coverage stamp (no `--allow-populated` needed once the entries are gone).
4. Delete the listed docs (the `<sandbox-slug>/journey-data-designer/` folder).
5. Capture `gs-admin --json jo data-designer list` fresh through the capture helper to a tmp file.
6. `node .gs-superadmin/plugin/scripts/domain-candidates.mjs check --manifest <sandbox-slug>/_manifest.json --file <tmp> --id-field objectName --command "journey data-designer list" --out .gs-superadmin/tmp/check-jo-dd.json`
   (the rows are keyed by objectName, the key data-management is indexed by).
7. `node .gs-superadmin/plugin/scripts/manifest.mjs exclude --manifest <sandbox-slug>/_manifest.json --command "journey data-designer list" --reason "Data Designer output datasets: filtered view of data-management (the get payload is a strict subset of dm objects describe; lineage lives in the data-designer domain)" --check .gs-superadmin/tmp/check-jo-dd.json --covered-by data-management`
8. `node .gs-superadmin/plugin/scripts/domain-candidates.mjs diff --manifest <sandbox-slug>/_manifest.json --require-decided`

Pass bar: step 6 reads `allIndexed: true` with data-management holding every id (a count
different from 69 is expected — the sandbox is in use); step 7 exits 0 with `kind:
"coverage"`; step 8 exits 0 and lists the command as excluded with `kind: "coverage"` and
the evidence. If step 6 reads fewer than all ids under data-management, STOP: the ruling's
premise (every dataset is a dm object) does not hold on today's sandbox — record the
numbers on the bus and do not exclude. Relationship maps are unaffected (the domain is
not one of the five lanes); note in the verdict whether `deps-report` on the sandbox still
answers for one of the 69 names through data-management.
