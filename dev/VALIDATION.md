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

## F-456 — live deep-ingest of the connectors-chains lane through the RECORDED describe, no manual fallback (banked 2026-09-14, builder, Session B @ hb-20260914-01)

CLEARED 2026-09-14 (tester, Session B-V) @ hb-20260914-01 — PASS, with one rig deviation. Precondition held:
domains_indexed["connectors-chains"].describeCommand is `gs-admin --json cn chain --id {id}` on both tenants.
Step 1 as written selects 0 — all 4 chains are depth full on the sandbox and on prod — so --statuses documented
replaced --upgrade (Bradley, before the run); the gate decision under test is unchanged. Steps 1–2: commandSource
recorded, selected 3, documented 3, failed 0, failures [], no aborted; each of the 3 entries carries doc_path, the
doc on disk, and a fingerprint. Step 3: capture exit 0, 1447 bytes, no BOM, no --normalize, no redirect. Chain id
shape: 36-character UUID (the payload's jobExecutionSetId). Verdict on the bus: F-456 VERIFIED.

Owed by: the tester round @ hb-20260914-01 (Session B-V; branch round-b-describe-loop, PR #19).
Tenant: either; the sandbox is preferred (fewer chains). Reads only against the tenant; the
writes are to the local workspace manifest and the domain's KB folder.
Precondition: the workspace's connectors-chains domain records `describeCommand` as
`gs-admin --json cn chain --id {id}` (the lane the finding measured) — confirm with a local
read of `<slug>/_manifest.json` `domains_indexed`. If the July fallback left it recorded as
`none`, re-record the template first: `manifest.mjs upsert-batch --describe-command
"gs-admin --json cn chain --id {id}"` over a fresh list capture of that domain.

Steps (from the consumer workspace, plugin loaded from the working tree; token pre-flight per
setup Phase 1 first):
1. `node .gs-superadmin/plugin/scripts/describe-batch.mjs --manifest <slug>/_manifest.json --domain <chains-domain> --out-dir <slug>/<chains-domain> --limit 3 --upgrade`
   — with NO `--command`: the recorded template must clear the gate on its own merits.
2. Read the summary: `commandSource: "recorded"`, `documented ≥ 1`, no `aborted`; one chain's
   doc under `<slug>/<chains-domain>/` with `doc_path` recorded on its entry (local read).
3. The other sanctioned route, one chain through the capture helper:
   `node .gs-superadmin/plugin/scripts/capture.mjs --out .gs-superadmin/tmp/chain-probe.json -- gs-admin --json cn chain --id <one id from the manifest>`
   — exit 0 and a JSON file, with no `--normalize` and no bare redirect anywhere.

Pass bar: both scripts admit the lane; no manual per-asset path, no redirect-then-normalize.
A gate refusal on either ("not a describe-shaped read" / "not a capture-shaped read")
REOPENS F-456. Record the documented count and the chain id shape on the bus.

## F-458 / #13 — one batch run PAST the token half-life: summary + manifest (banked 2026-09-14, builder, Session B @ hb-20260914-01)

CLEARED 2026-09-14 (tester, Session B-V) @ hb-20260914-01 — PASS on steps 3–5 and on step 6 (run), with two rig
deviations decided by Bradley before the runs. Rig: no sandbox domain holds ~600 eligible entries, so the batch was a
TIMED start — a background shell (no harness timeout) ran describe-batch --domain report --statuses documented
--if-changed --limit 200 (recorded describe) at 23:26:06 with whoami at 1913s; it stopped at 23:28:02 with whoami
still reading valid (1797s). Step 3: aborted.reason auth, after 80, lastError carrying the CLI's re-login sentence
(live wording: "Run `gs-admin login` to re-authenticate"), documented 79, failed 0, failures []; stderr
"ABORTED after 80 entries (auth)". Step 4 (against a manifest copy taken before any live arm): 79 report entries
re-verified, 0 status changes, the in-flight 80th entry still documented at its July last_verified, 0 failed entries
tenant-wide, 0 carrying the re-login sentence. Step 5: after gs-admin login the same command resumed; the in-flight
entry documented normally (documented/full, new last_verified, doc on disk, fingerprint, no error). Step 6: the
scorecard domain holds only 4 selectable entries, so rules-engine-chains (19) took the mismatched
`re r describe --id {id}`: aborted consecutive-failures after 5, failed 5, five distinct server Request IDs, entries
6–10 untouched; restored with the recorded command (19 of 19 documented, 0 failed). Verdict on the bus: F-458 VERIFIED;
#13 confirmed live.

Owed by: the same tester round @ hb-20260914-01 (Session B-V; branch round-b-describe-loop, PR #19).
Tenant: the sandbox. Reads only against the tenant; the writes are the local manifest and docs.
Rig: the binding deadline must be the hb-20261011-02, not the harness — run the batch from a terminal
(not the tool shell's ~2-minute timeout) on a domain with more undocumented or
`--upgrade`-eligible assets than the token's usable life covers at the observed rate (setup
Phase 1's pre-flight formula; at ~3 s/asset a fresh token's usable life covers roughly 600
describes, so `--limit 800` on the largest stub domain runs past it).

Steps:
1. `gs-admin login` fresh; note `whoami`'s remaining seconds.
2. Run describe-batch on that domain with the oversized `--limit` and let it stop on its own.
3. Read the summary: `aborted.reason: "auth"`, `aborted.lastError` carrying the CLI's
   re-login sentence, `failures: []`, `failed: 0`, `documented: N`; stderr showed
   `ABORTED after <N+1> entries (auth)`.
4. Read the manifest locally: every entry the run reached is `documented` or at its prior
   status; the count of entries with `status === "failed"` whose `error` contains
   `gs-admin login` is 0.
5. `gs-admin login`, re-invoke the same command: the run resumes; the entry that was in
   flight documents normally.
6. (#13's live confirmation, optional, harmless) on a SMALL domain, run describe-batch with
   `--command` naming a describe whose id space cannot match — e.g. `gs-admin --json re r
   describe --id {id}` over the scorecard domain, `--limit 10`: the run must stop after
   exactly 5 spawns with `aborted.reason: "consecutive-failures"`, `after: 5`, five entries
   marked `failed`; then restore them (`manifest.mjs mark --status stale` on each key, or
   re-run the domain with its recorded command).

Pass bar: steps 3–5 as stated (step 6 as stated if run). Any entry marked `failed` whose
recorded error is the re-login sentence REOPENS F-458; a walk of the asset list past five
consecutive identical failures REOPENS #13.

## F-459 — reconcile-docs over the sandbox's three legacy domains, plus the report reads for F-455 / F-454 / F-451 (banked 2026-09-15, builder, Session C1 @ hb-20260915-01 — OPEN after C1-V @ hb-20260915-01)

Owed by: the tester round @ hb-20260915-01 (Session C1-V; branch round-c1-report-truth, PR #20).
Tenant: none needed — no gs-admin call in this arm. The sandbox WORKSPACE is written (its
`_manifest.json`, `doc_path` fields only); prod is read as a control. Plugin loaded from
the working tree; every command below runs from the workspace root with a RELATIVE
`--manifest <slug>/_manifest.json` (reconcile-docs refuses a working directory the
recorded paths do not resolve from — that refusal, if it fires, is the arm's first
finding, not a rig problem).
Precondition (local read, before anything): the sandbox's `report` shows
`docPathsUnknown` 20 in total, spread over three July-crawled domains (the data-designer
domain 3, the rules-engine-chains domain 14, the scorecard domain 3 at the builder's
read on 2026-09-15 — the B-V round had re-marked five chain entries since the 25 logged);
prod shows 0. A different total is not a failure — record it — but a domain outside those
three is.

Steps:
1. `node .gs-superadmin/plugin/scripts/manifest.mjs report --manifest <slug>/_manifest.json`
   on BOTH tenants; hold the output to the Fix notes' claims: prod — every `none`
   domain reads `describeState: list-only` with its stubs under `byDepth.listOnly`,
   `byDepth.metadata` 0 and `byDepth.unrecorded` 0 tenant-wide, `domains.report`
   reads `changeDetection: none` with `datelessEntries` 1754; sandbox — `domainCounts`
   18 / 17 / 1 with the surveys domain in `emptyDomains`, five legacy stamps reading
   `describeState: unrecorded`, the templates domain `changeDetection: date` with
   `datelessEntries` 557, `byDomain` rows numbers-only, `docPathsUnknown` per the
   precondition. Quote the numbers on the bus.
2. For each of the three domains, `manifest.mjs reconcile-docs --manifest
   <slug>/_manifest.json --domain <d> --dry-run --out .gs-superadmin/tmp/reconcile-<d>.json`
   — read `recorded`, `recordedMissing`, `unmatchedDocumented`, `orphanFiles`; the
   manifest is byte-identical after a dry run.
3. The same three without `--dry-run`. Expected: `recorded` sums to the precondition's
   total, `unmatchedDocumented` 0 (every legacy stub is still on disk), `orphanFiles`
   named if any (a rekey or a removed entry left them — list them, delete nothing).
4. `report` again: `docPathsUnknown` 0 on the sandbox, and for one of the three domains
   read its `domains.<d>` row and its entries' `doc_path` values (local read of the
   manifest) — every documented entry now names a file that exists.
5. Re-run step 3 once more: `recorded` 0, `alreadyRecorded` = step 3's `recorded`,
   manifest byte-identical (idempotent).

Pass bar: `docPathsUnknown` reaches 0 on the sandbox with every difference explained
by `unmatchedDocumented` or `orphanFiles` by name; prod reads 0 before and needs no
reconcile; the report reads in step 1 hold. A `docPathsUnknown` that does not reach 0
without such an explanation, a reconcile that writes a `doc_path` pointing at no file,
or a report row that contradicts step 1's claims REOPENS the matching entry (F-459 /
F-455 / F-454 / F-451).
Walks (slash-only, the user types them): `/gs-superadmin:setup` — the Phase 4 relay
must quote `domainCounts.indexed` and name `emptyDomains`; if the run reaches Phase 5's
close or the final report it must quote ONE `report`'s `byDepth` with the `Depth:` and
`Not complete:` lines, never a narrative; decline any ask. `/gs-superadmin:refresh` —
its report must end with the `Not checked for change this run:` block naming the
`none` domains and the dateless count (or `none`), never silently at "Unchanged".

Result (tester, Session C1-V, 2026-09-15 @ hb-20260915-01) — OPEN. Steps 1-5 ran as
written from the workspace root with a relative `--manifest`: step 1 holds on both tenants
(numbers quoted on the bus under F-455 / F-454 / F-451 / F-459); steps 2-3 recorded
3 / 14 / 4 = 21 against the precondition's 20, `unmatchedDocumented` 0, `orphanFiles` 0,
no CWD refusal; step 4 `docPathsUnknown` 0 and all 26 `doc_path` values resolve; step 5
recorded 0 with the manifest byte-identical. What failed: the extra path is a `stale`
scorecard entry with its doc on disk, which `docPathsUnknown` (counting `documented`
only) never declared — F-459 REOPENED. Walks: setup's Phase 4 relay and Phase 5 close
pass (F-454, F-455 VERIFIED); refresh's block is present but its legacy-stamp line says
"detection starts next refresh" on a `none` recording — F-451 REOPENED. Rig deviation
(Bradley): the walks ran to their judged artifacts, adding their own sandbox manifest
writes beyond the one reconcile. Still owed at the next C1 handoff: F-459's invariant
(per domain, reconcile `recorded` ≤ report `docPathsUnknown`) and F-451's line held to the
next report's `changeDetection`; unreached this round: the final report's `Depth:` /
`Not complete:` lines (setup stops at Phase 5 on pending).

## F-459 / F-451 — second arm after the C1-V reopens: the doc-existence invariant over both manifests, and the refresh block held to a fresh report (banked 2026-09-15, builder, Session C1 second round — CLEARED 2026-09-15 @ hb-20260915-02)

Owed by: the next tester round on branch round-c1-report-truth (PR #20). No tenant call;
no manifest write — both steps are read-only (`--dry-run` writes nothing; pinned).
1. F-459 invariant, from the workspace root with a RELATIVE `--manifest`, on BOTH tenants:
   `manifest.mjs report --manifest <slug>/_manifest.json`, then for EVERY domain in its
   `domains` map `manifest.mjs reconcile-docs --manifest <slug>/_manifest.json --domain <d>
   --dry-run`. Pass bar: on every row `recorded` ≤ `domains.<d>.docPathsUnknown`; a
   refusal, or a row where `recorded` exceeds the count, REOPENS F-459. The builder's own
   run read 18 + 18 domains, 0 violations, both files byte-identical before and after;
   record your counts. (The sandbox's stale-with-doc entry was recorded by C1-V's
   reconcile, so that live case rests on the fixture now: `docsForUndocumented` and the
   stale arm in test/manifest-ops.mjs.)
2. F-451, the refresh walk (slash-only, the user types it): after step 3, take the fresh
   `report` step 4 now prescribes and hold every `Not checked for change this run:` line to
   that domain's fresh `changeDetection` — `none` ↔ "outside change detection", `date` ↔
   "detection starts next refresh", `unrecorded` ↔ "still unrecorded". The sandbox's
   report-objects domain (recorded none by the C1-V walk) must land on the first line. A
   state word that disagrees with the fresh report REOPENS F-451.

CLEARED 2026-09-15 (tester, Session C1-V second round) @ hb-20260915-02 — PASS on both steps.
Step 1: prod 18 and sandbox 18 domains, 0 violations, 0 refusals, every row `recorded` 0 ≤
`docPathsUnknown` 0, both manifests byte-identical before and after; the positive direction
rests on the fixture (no pathless ever-documented entry remains live). Step 2: the refresh
walk's fresh report after step 3 agreed with every `Not checked` line — connectors, report
and report-objects on the first line (fresh `none`), journey-email-templates on the dateless
line (fresh `date`, 557 of 1180), journey-surveys no line (empty); the legacy-stamp lines
were not produced (no `unrecorded` domain left on either tenant). Deviation: the walk's step
3 read the tenant (18 lists) and wrote the sandbox manifest (33 upserts, no status change),
under the C1-V ruling that walks run to their judged artifact. Full record on the bus under
F-459 and F-451 (Verified: lines).
CI note (2026-09-15, builder, after the second verdict): dev's ruleset requires `drift (full)` from
the PULL-REQUEST suite on the PR head; a `[skip ci]` verdict commit at the tip reads BLOCKED, a
`gh workflow run` dispatch does not join the PR rollup, and neither an empty commit nor a
close/reopen fired the suite (no check suite was created for a commit with no file changes).
This line is the content change that re-runs the suite on the head; nothing else moved.

## F-450 / F-452 — the C2 arms: scope with no backfill, inert per-pin records, the tenant conventions override, and the sandbox connectors-chains redate (banked 2026-09-15, builder, Session C2 — CLEARED 2026-09-15 @ hb-20260915-04)

Owed by: the tester round on the token the C2 handoff mints (branch round-c2-fact-homes,
PR #21). Tenant reads: NONE for the scope arm — `scope` is
derived from each manifest's recorded list commands and the shipped per-pin table, so both
workspaces read it today without re-listing anything. The walks (setup to the Phase 4
relay; deps-report; refresh if run) read the tenant the way walks always do. The ONE
manifest write is step 4, sandbox only.
1. Read-only, both tenants, from the workspace root: `manifest.mjs report --manifest
   <slug>/_manifest.json` — `pinFacts.applied` true; `domains.<d>.scope` non-null on exactly
   the domains recorded from `jo email templates` and `jo surveys list` (builder's local
   read: two per tenant, journey-email-templates and journey-surveys; no domain recorded
   from `jo data-designer list` remains on either), each `{ key, path, limit }` with `path`
   naming a `###` subsection of setup's index-scope-notes.md; every other row `scope: null`.
   Then `domain-candidates.mjs diff --manifest <slug>/_manifest.json --require-decided`:
   exit 0, `notEnumerableBareCount` 4 (the four `re rules` sublists), each
   `tenantRecord: "excluded"` with one inert warning apiece, `undecidedCount` 0,
   `excludedCount` 17 (the six per-CLI records no longer counted — 21 before). Both
   manifests byte-identical before and after (sha256). A scope on any other domain, a
   sublist under `undecided`, or a changed manifest REOPENS F-450.
2. Setup walk (slash-only, Bradley types it) on the sandbox, to the Phase 4 relay: the
   relay carries the exclusion ledger with the diff's `excludedCount`, names
   `notEnumerableBareCount` separately, and lists one scope line per non-null `scope` row —
   limit and path quoted from THAT run's report — BEFORE the totals question. A relay that
   asks first, restates a limit from memory, or names a limit for a row whose `scope` is null
   REOPENS F-452.
3. deps-report walk with the override, one tenant only: copy the workspace
   `.gs-superadmin/CONVENTIONS.md` to `<sandbox-slug>/CONVENTIONS.md` and declare a
   task-alias prefix THERE only; run deps-report with a `--field` term on the sandbox (the
   header reads "from the tenant conventions — the tenant's own CONVENTIONS.md override")
   and on prod (exact-only caveat naming the workspace file, or the workspace's own pattern
   if one is declared there — never the sandbox's); delete the copy afterwards. A prod run
   adopting the sandbox's pattern REOPENS F-450 (a).
4. The connectors-chains redate (sandbox; the one write). First a plain re-upsert of a
   fresh `cn chains` capture with the recorded field (no flags): summary
   `blankDatesCleared: 4`, `dateResolvedRows: 0`, one warning naming the all-blank shape
   and the remedy — the builder measured all four rows carrying `modifiedDateStr: ""` on
   three captures (July, August, September). Then `--no-date-field --allow-redate` on the
   same capture, and `report`: `domains.connectors-chains.changeDetection` `none`,
   `datelessEntries` 4. Prod needs nothing (already recorded none). A summary without
   `blankDatesCleared`, or a chain still reading dated after the first upsert, REOPENS
   F-450.

Cleared: 2026-09-15 @ hb-20260915-04 (tester, Session C2-V) — all four steps measured and
held: step 1 on both manifests (scope on the two journey domains, notEnumerableBare 4 inert,
gate green, sha256 unchanged); step 2 the setup relay's two scope lines verbatim before the
totals question; step 3 the override read for the sandbox only, prod on the workspace file,
override deleted; step 4 the sandbox chains `blankDatesCleared` 4 then `changeDetection:
none`, `datelessEntries` 4. Verdicts of record on F-450 and F-452; the unwalked slash-only
skills are on F-450's Blind spots line.

## F-457 / F-453 — the D-V walk: one `setup --deep` run to its first Phase 5 batch, and the guard's repeat ask read by the operator (banked 2026-09-16, builder, Session D @ hb-20260916-01 — CLEARED 2026-09-16 @ hb-20260916-01)

Owed by: the tester round on the token the Session D handoff mints (Under test line).
Tenant: either; the sandbox is fine. No tenant WRITE beyond what `--deep` itself does
(a `describe-batch --upgrade` over one domain, `--budget` small — 3 is enough); the
walk stops at the first batch's summary. NO new manifest state is required: pick a
domain whose `domains.<d>.byDepth.metadata` is non-zero in `report` (if none exists on
either tenant, pick a list-only domain — the flag doc says to explain and stop, and
that branch is the walk; record which).

Steps (consumer workspace, plugin loaded from the working tree, `/reload-plugins` then a
session RESTART for the hook):
1. Bradley types `/gs-superadmin:setup --deep <domain> --budget 3` (slash-only skill).
2. Read the transcript: after Phase 2 the run must go to Phase 5 with NO Phase 3
   scaffold step and NO Phase 4 list sweep (no `capture.mjs --paginate` spawn, no
   `upsert-batch`, no candidate diff).
3. Before the first `describe-batch`, the run runs `manifest.mjs report` once and
   reads `lookback.<domain>`: when `days` is null or above `lookbackDefault` it relays
   the one-line age notice naming `/gs-superadmin:refresh`; when within the window it
   says nothing. Record `days`, `lookbackDefault`, and which branch fired.
4. If the run reaches a Phase 6 relay (unlikely with `--budget 3`), or if Bradley asks
   "would deep-ingesting <non-lane domain> improve the maps?", the answer states the
   five-lane boundary and names deps-report as where the value lands.
5. Guard wiring for F-453 (this round's guard-wiring line): in the consumer-workspace
   session issue a variable-built READ loop once, e.g.
   `for c in "re rules list" "sc list"; do gs-admin --json $c; done` — the first
   is DENIED with the rewrite hint; issue the SAME command again — the repeat renders
   an ASK. Bradley reads the rendered ask (never inferred from the transcript, F-437)
   and it must carry "spelled literally" and "flag values and paths". Decline it.

Pass bar: step 2 shows no list sweep and no scaffold; step 3 quotes the `lookback`
row and the branch that fired; step 5's rendered repeat ask carries the remedy. A
`--deep` run that re-lists REOPENS F-457; a repeat ask without the remedy REOPENS F-453.

Cleared: 2026-09-16 @ hb-20260916-01 (tester, Session D-V) — all five steps measured and
held, on the rig's own fallback branch: no metadata stub exists on either tenant, so the
walk ran `--deep connectors` (sandbox, list-only by type); step 2 no scaffold, no sweep, no
upsert, no diff; step 3 `lookback.connectors` `days` 1 against `lookbackDefault` 7 quoted,
branch fired = list-only explain-and-stop before Phase 5 (no describe-batch, 0 of 3 spent);
step 4 the report-objects maps question drew the five lanes and deps-report; step 5 deny
then a rendered ask carrying "spelled literally" and "flag values and paths", declined.
Verdicts of record on F-457 and F-453; the unproduced lookback-relay and `--upgrade` path
are on F-457's Blind spots line, and re-bank here the first time a tenant holds a
metadata stub.

## PR #17 — change-request walk: the Before building section on a real ticket (banked 2026-09-21, maintainer, merged to dev @ 0cbcc12 as plugin 0.42.0 — CLEARED 2026-09-21 @ hb-20260921-01)

Owed by: the next tester round, in a consumer session with the working tree loaded.
The contributor had no tenant, so the skill shipped unwalked (CONTRIBUTING, "Skill prose
has no automated test"); the fixture suite and every CI gate were green on the merge.
Tenant: either. Drafting a plan is read-only against the tenant (KB reads plus the CLI
discovery reads the skill already makes); nothing is executed at drafting time.

Steps (from the consumer workspace):
1. Pick two real tickets: one small and well specified (a single criteria change, a
   rename), and one that touches a shared field or opens CTAs.
2. `/gs-superadmin:change-request <ticket> --ticket <KEY>` for each (slash only — the
   operator types it; that is the walk).
3. Read each plan's *Before building* section and the chat summary's `Heads-up:` line.

Pass bar (the three measurements the PR itself named, plus the empty-line case):
- The small ticket's section is one line or exactly the template's empty line — not a
  memo. The section on the larger ticket is proportionate: every bullet points at a line
  of the plan, or a thing the admin would say to the requester, that changes.
- `Heads-up:` carries the one line the operator would actually want first, or reads
  "nothing to add" when the section is the empty line.
- Both plans are drafted on the ask as stated; any question sits beside the default the
  plan took, and nothing waits on an answer.
- If the section names a way the tenant can already do this, it cites the KB doc and
  says what that way gives up.
Record the verdict here with the token, and copy it to the bus under the round's Blind
spots line.

CLEARED 2026-09-21 (tester, Session F-V) @ hb-20260921-01 — PASS, with one rig deviation and
one line of ask A's section discounted as rig-caused (Bradley's ruling, below).
Under test: dev @ 5dd23b3 (the handoff commit, clean); canary matched (dev-canary description
hb-20260921-01), loaded from <repo>\plugins\gs-superadmin. Tenant: the sandbox, CLI logged in,
so both plans read `Verification basis: live`. Round type: first walk of shipped prose (PR #17).
Rig deviation: no real Jira tickets. Both asks were authored from the sandbox KB from the round's
templates, so every asset named exists. Ask B's requester vagueness is stood in for by
deliberate silences (CTA type/priority, first-run treatment, segment, purpose, the existing
rule on the same field). Ask A's template justification ("last quarter's firings") is fiction
that the tenant contradicts, which is where the discounted line comes from.
Step 2 (workspace): the workspace operating-model.md does NOT contain "The admin's job, and
yours", and there is no operating-model.md.new beside it — setup not re-run since 0.42.0 (the
session-start line reported 1 scaffolded file behind). The skill carried the thinking alone.
Step 3 (assets, KB doc names only): ask A — the rule "MarketPay - Survey Year 2022 or Earlier"
(criterion Survey_Year LTE 2022 → 2021). Ask B — the field ACCOUNT_LAST_LOGIN on Product Usage
Attributes, read by "Close CTA: No Logins > 90 Days - April 2024", "Load to Company:
ACCOUNT_LAST_LOGIN", ~10 reports ("Account last login in Period", "Last Login Date", …) and the
journey "Digital CS - Login Campaign". The CTA-creating rule the section had to find unprompted:
"v2 CTA: No Logins > 90 Days - April 2024" (same object, CSM-owned Risk CTA). Its KB doc and
the live describe carry no criteria (a task-level filter, `_filterCount: ?`), so the overlap is
measurable through its name, its source object and its close sibling's
`ACCOUNT_LAST_LOGIN < 90 days` condition, not through a documented filter of its own.
No mutating gs-admin command was proposed or run during drafting. The skill's reads were
`re r describe`, `re r schedules`, `re r executions` and `jo cta options`, each captured
through capture.mjs.

Ask A (WALK-1) — Before building, verbatim:

    - This rule has never run on this tenant — no schedule, no chain, 0 executions (live, 2026-09-21) — so "last quarter's firings" came from another tenant and "same schedule" means none here: ask the requester which tenant they reviewed; on this one the edit changes nothing until someone schedules it.
    - The CTA's Name mapping is the literal "MarketPay - Survey Year 2022 or Earlier", so after the edit CSMs will see "2022 or Earlier" on CTAs that fire only for 2021 or earlier; the plan keeps the name as asked ("no other change") — offer the requester a rename of the rule and CTA Name to "…2021 or Earlier".

    Heads-up:  This rule has never run on this tenant (no schedule, no chain, 0 executions) — "last quarter's firings" came from another tenant, and on this one the edit changes nothing until someone schedules it.

Ask B (WALK-2) — Before building, verbatim (KB doc ids shortened to <doc>):

    - The tenant already runs this at 90 days: "v2 CTA: No Logins > 90 Days - April 2024" (rules-engine/<doc>) opens a Risk / Usage Drop CTA to the CSM from the same object, and "Close CTA: No Logins > 90 Days" (rules-engine/<doc>) closes it when logins resume. Built as asked, every account past 90 days gets **two** open no-login CTAs, because the names differ and so do the identifiers. The plan builds the new rule as asked and excludes accounts that already have an open "No Logins > 90 Days" CTA. The other route is to lower the existing rule from 90 to 60 days. That keeps one CTA per account and keeps the close path, but it costs the 90-day CTA as it stands: its name literal "> 90 Days" would be wrong, and the close rule matches on that name, so renaming it breaks closing. Ask the requester which one they want (the purpose is our guess — see the header).
    - Nothing closes the new CTAs when the customer logs back in; the 90-day route has a close rule, the ask doesn't. Plan default: no close rule (as asked) — CSMs close them by hand; offer a matching close rule (a copy of <doc> at 60 days).
    - First run: every account already more than 60 days without a login gets a CTA on day one. The count is unknown until the test run (Verification 3). Plan default: fire for all of them, as asked. The alternative is to fire only on the day an account crosses the line (last login exactly 61 days ago), which avoids a day-one backlog but never catches the accounts already past it.
    - Segment: the ask names no account filter, while other CTA rules on this object filter to customers (e.g. rules-engine/<doc> filters on Account_Type and product). Plan default: every record with a CSM populated (conventions/rules-engine.md) and a non-null ACCOUNT_LAST_LOGIN — accounts that never logged in are excluded. Ask whether it is customers only, and whether never-logged-in counts.
    - CTA type/priority: not stated. Plan default mirrors the 90-day rule — Type Risk, Reason Usage Drop, Priority Medium, Status New — with no playbook (the 90-day playbook is not assumed to fit 60 days).
    - "ACCOUNT_LAST_LOGIN alert" is the raw field label; as the CTA name, that is what CSMs see in Cockpit. Plan default: the CTA name stays as asked, and the rule gets the naming-convention name below. Suggest to the requester a CSM-readable CTA name, e.g. "No login in 60+ days".

    Heads-up:  The tenant already runs this at 90 days ("v2 CTA: No Logins > 90 Days", with a close rule), so built as asked every account past 90 days gets two open no-login CTAs. The plan excludes those accounts; lowering the existing rule to 60 is the alternative, but its "> 90 Days" name and the name-matching close rule break.

Point by point:
- Proportionality — PASS (ruled). Ask A's section is two lines, not one. Bradley ruled
  2026-09-21 to discount line 1: the skill correctly caught a contradiction the rig planted
  (the fictional run history against a rule with 0 executions on this tenant). The remaining
  line — the CTA Name literal that goes stale — is one line, and it pairs with something the
  admin says (the rename offer). Noted for the builder, not a finding: the skill prose says a
  ticket that states its purpose and asks for the right thing "gets exactly" the empty line,
  but the per-line test admits a real tenant fact such as a stale name literal. On a real
  ticket the section would have been one line, not empty. Ask B: 6 bullets, each paired —
  (1) the C_Exclude merge task (Assets 1, Command sequence 6–7) plus the route question to
  the requester; (2) the offered close rule; (3) Command 5's filter (no crossing window) plus
  the backlog question; (4) Command 5's null and CSM filters plus the customers-only
  question; (5) Command 11's --type/--reason/--priority/--status; (6) Command 11's --name
  plus the rename suggestion. No bullet is commentary.
- Heads-up — PASS. A carries one line from its section (the never-run line; with that line
  discounted as rig-caused, it is still the line an admin on this tenant wants first). B
  carries the duplicate-CTA line, which is the one I would have picked first — match.
- Drafted on the ask as stated — PASS. Both plans are complete, with no question held for an
  answer. Ask B's silences each sit beside the default the plan took: CTA type/priority
  (bullet 5), first-run (bullet 3), segment (bullet 4). Its header reads
  `Justification: … (AI-inferred)`.
- Existing way, with its cost — PASS. Ask B cites both 90-day rule docs by path. It says what
  lowering the existing rule gives up: the "> 90 Days" name literal goes wrong, and the close
  rule's name match breaks. Ask A names no existing route; none was owed.
Guard wiring: `gs-admin jo p save --id 'walk-guard-probe-nonexistent'` in the consumer
workspace drew the PreToolUse ask naming `gs-admin journey programs save`, both workspace
tenants and the PRODUCTION warning (text relayed by Bradley) — DECLINED.

Second arm (tester, Session F-V2, 2026-09-21) @ hb-20260921-01 — KEPT.
Under test: dev @ e3e9300 (clean, 2 ahead of origin); canary matched hb-20260921-01. Ask B only
(re-run as WALK-2B, slash-typed by Bradley); Ask A not re-run. Sandbox, CLI live, `Verification
basis: live`. No mutating gs-admin command was proposed or run while drafting (reads: `re r
schedules`, `re r executions`, `jo p list`, `jo p describe`, all through capture.mjs).
Step 2 (refresh): refreshed IN PLACE. The workspace operating-model.md now carries "The admin's
job, and yours" (line 14), with no operating-model.md.new beside it. `scaffold.mjs check` reports
9/9 scaffolded files current (behind 0, untracked 0, pendingNew 0). The session-start hook,
re-run by hand, prints no scaffold line.
Arm confound, stated before the result: this arm is not blind to the first. The tester session
drafted the plan itself, and it had read the first arm's Ask B quote (above) before drafting.
Skill step 6 also updates a same-day same-ask plan in place (Revision 2), which means reading
revision 1 first. What changed is measurable; how much of the change the refreshed passage caused
is not.
Live fact found this arm: `re r executions` returns `data: []` on this sandbox for every rule
checked, including the chained SNOW import and Load-to-Company rules that must run. Execution
history is therefore not evidence on this tenant. The first arm's "0 executions" wording in both
asks leaned on it (Ask A is not re-run, so that is noted, not re-judged); "no schedule, not in a
chain" still holds.

Ask B (WALK-2B) — Before building, verbatim (KB doc ids shortened to <doc>):

    - The tenant already has this at 90 days: "v2 CTA: No Logins > 90 Days - April 2024" (rules-engine/<doc>) opens a Risk / Usage Drop CTA to the CSM from the same object, and "Close CTA: No Logins > 90 Days" (rules-engine/<doc>) closes it when logins resume. Built as asked, an account past 90 days gets **two** open no-login CTAs — the names and identifiers differ. The plan excludes accounts with an open "No Logins > 90 Days" CTA (Command sequence 6–7). The other route is to lower the existing rule to 60 days: one CTA per account and the close path kept, but its "> 90 Days" name goes wrong and the close rule matches on that name, so a rename breaks closing. Ask the requester which they want (the purpose is our guess — see the header). On this sandbox the 90-day rules are active but unscheduled; ask whether production runs them, since that decides whether the exclusion does anything there.
    - Nothing closes the new CTAs when the login comes back. Plan default: no close rule, as asked — CSMs close them by hand. Offer a copy of <doc> at 60 days.
    - Day one: every account already past 60 days gets a CTA at once; the count comes from the test run (Verification 3). Plan default: fire for all, as asked. The alternative — fire only when an account crosses day 61 — avoids the backlog but never catches accounts already past it.
    - Who: the ask names no segment, while other CTA rules on this object filter to customers (e.g. rules-engine/<doc> on Account_Type and product). Plan default: CSM populated (conventions/rules-engine.md) and ACCOUNT_LAST_LOGIN not null, so never-logged-in accounts are excluded (Command sequence 5). Ask: customers only? Does never-logged-in count?
    - CTA fields, not stated: the plan mirrors the 90-day rule — Risk, Usage Drop, Medium, New — with no playbook (Command sequence 11). "ACCOUNT_LAST_LOGIN alert" is the raw field label, and as the CTA name it is what CSMs see in Cockpit; the plan keeps it as asked. Suggest "No login in 60+ days".

    Heads-up:  The tenant already has this at 90 days ("v2 CTA: No Logins > 90 Days", with a close rule), so built as asked an account past 90 days gets two open no-login CTAs; the plan excludes those accounts. Lowering the existing rule to 60 is the alternative, but its "> 90 Days" name and the name-matching close rule break.

Against the first arm, bullet by bullet:
- (1) Duplicate CTA: REWORDED + one sentence ADDED. "Already runs" became "already has". A
  pointer to Command sequence 6–7 was added. New: the 90-day rules are active but unscheduled
  here, so ask whether production runs them. Pairs: the C_Exclude merge (Command sequence 6–7)
  and two requester questions, which route and whether production runs the 90-day rule. The
  second question decides whether that merge does anything.
- (2) No close rule: REWORDED (shorter), same content. Pairs: the offered 60-day close-rule copy.
- (3) First run: REWORDED (shorter), same default and alternative. Pairs: Command sequence 5's
  filter (no crossing window) and the backlog question.
- (4) Segment: REWORDED; a pointer to Command sequence 5 was added. Pairs: Command sequence 5's
  CSM and not-null filters, plus the customers-only and never-logged-in questions.
- (5)+(6) CTA type/priority and CTA name: MERGED into one bullet, both halves kept. Pairs:
  Command sequence 11's --type/--reason/--priority/--status and its --name, plus the rename
  suggestion. This is the judgement call against the reopen rule. Six bullets became five, but
  no paired content was lost: every default and every requester line of the first arm's (5) and
  (6) is still present.
- Checked and correctly kept out (impact table only): the customer-facing login journey is live
  status NEW (nothing goes to customers), a second active copy of the 90-day rule is caught by
  the same name exclusion, and the Account Scorecard's login measure reads different login
  fields. None changes a plan line or a requester question.
- Heads-up: still carries the duplicate-CTA line (same wording apart from "runs"→"has" and
  "every account"→"an account"). Justification: still `… (AI-inferred)`.
Judgement: slightly better. The same pairs are there in fewer words, and one overclaim
("already runs") became a requester question that decides whether a plan step does anything.
How much of that the refreshed passage caused is unmeasured (confound above).

## Sandbox `re r executions` — empty for every rule checked (observed 2026-09-21, tester Session F-V2; banked 2026-09-21, builder)

Owed by: the next tester round with the PRODUCTION tenant active. Read-only.
What was seen: on the sandbox, `re r executions` returned `data: []` for every rule checked, including the chained
import and Load-to-Company rules that must run for the tenant to function. The first arm's ask A plan leaned on it
("0 executions", "never run on this tenant"); the second arm noted that "no schedule, not in a chain" still holds on
its own. Whether the list is empty because the sandbox retains no execution history, or because the command returns
nothing on every tenant, is not known — and the two outcomes land in different homes.

Steps (consumer workspace, plugin loaded from the working tree):
1. `gs-admin whoami` reads production.
2. From the production KB, pick two rules documented as scheduled and active (a rules-engine doc with a schedule, or a
   chain member), plus one the KB says is inactive.
3. `gs-admin --json re r executions <id>` for each, through capture.mjs. No other command.
4. Record per rule: rows returned (count, newest date) or `data: []`, and for an empty result the raw payload shape.

Outcome rule:
- Rows on production for the scheduled rules → sandbox-only. The fact's home is the sandbox slug's tenant conventions
  (one home per kind of fact, F-450): "this tenant retains no rule execution history — an empty `re r executions` is
  not evidence a rule never ran; read schedules and chain membership instead." No skill line, no finding.
- `data: []` on production too → open a finding (normal: a plan that asserts "never run" from a list that is always
  empty is wrong for the user), with a Known CLI issue candidate (KI-019) for the operating model — re-check the
  endpoint the catalog names for `rules-engine rules executions` (reference/domains/rules-engine.md) — and one
  change-request step 4 line: an empty executions list is unknown, not zero.
Record the verdict here with the token, and copy it to the bus under the round's Blind spots line.

## F-462 / CP-6 (a) — KI-012 closed live: a token works past the old half-life point on CLI 1.0.10 (banked 2026-09-26, builder, 1.0.10 adoption round — CLEARED 2026-09-26 @ hb-20260926-01)

CLEARED 2026-09-26 (tester, 1.0.10-V) @ hb-20260926-01 — FIXED (KI-012 closed live; the canon's 1.0.10-and-later rule
holds). Rig: one background Git Bash loop on one fresh token (login 19:44 UTC, `whoami` 3591 s), each iteration
`whoami` → `gs-admin --json sc list --limit 1` → `whoami`; every ~5 min above 1900 s, ~2 min to 300 s, 30 s to 180 s,
then every ~13 s (10 s sleep + the calls). 31 iterations. Step 2: reads at 1737, 1481, 1228 and 1104 s remaining all
exit 0 (1.0.9's first failure was at 1772 s). Last success: `whoami` 62 s before / 60 s after the read. First failure:
49 s before / 47 s after — stderr exactly "Error: Access token has expired. Run `gs-admin login` to re-authenticate.",
exit 1 (Git Bash), and `whoami` immediately after still printed `Token:        valid (expires in 47s)`. No
"Token expired and silent refresh failed" anywhere in the run. The failure lands inside the 60 s margin at the loop's
~13 s resolution.

Owed by: a tester session on a machine whose `gs-admin --version` prints 1.0.10, with a live tenant, before the next
release (named on the round's Blind spots line). Plan item: gs-fortress build-kickoffs-1.0.10.md CP-6 (a).
Tenant: the sandbox. Reads only.
Rig: the binding deadline is the hb-20261011-02, not the harness — this check spans most of one token lifetime (~60 min), so
run the reads from a terminal or a background loop, not the tool shell's ~2-minute timeout (the F-458 / #13 rig).
Checks (b) and (c) below ride the same token; plan them into this run.

Steps:
1. `gs-admin --version` prints 1.0.10. `gs-admin login`; note `whoami`'s remaining seconds (expect about 3600).
2. Once `whoami` reads under 1800 s remaining (1.0.9's first failure was at 1772 s, measured 2026-09-07, ledger
   KI-012), run `gs-admin --json sc list --limit 1`. It must succeed.
3. Repeat the same read paired with `gs-admin whoami` — every few minutes, then every 10 s inside the last three
   minutes — until the read fails.
4. Record: `whoami`'s figure at the last success and at the first failure, the failure's exact text, and its exit
   code as each shell reports it (the exit code is check (c)'s measurement).

FIXED (KI-012 closed live; the setup Phase 1 canon's 1.0.10-and-later rule holds): step 2 succeeds, and the first
failure comes at about 60 s remaining — `whoami` still printing the token valid — with "Access token has expired.
Run `gs-admin login` to re-authenticate."
BROKEN: any read fails with more than about 120 s remaining, or the failure text is "Token expired and silent
refresh failed" (the 1.0.9 refresh path is still live). Either REOPENS F-462: the canon's 1.0.10 formula is wrong.

## F-462 / CP-6 (b) — `sc measures --id` past the old half-life point on CLI 1.0.10 (banked 2026-09-26, builder, 1.0.10 adoption round — CLEARED 2026-09-26 @ hb-20260926-01, BROKEN)

CLEARED 2026-09-26 (tester, 1.0.10-V) @ hb-20260926-01 — BROKEN (symptom persists; worse than on 1.0.9). On (a)'s token,
one KB scorecard id, through the capture helper: `whoami` 1737 s → exit 1, stderr "Error: No stored token found. Run
`gs-admin login` to authenticate.", nothing written; 1481 s → same; 1228 s → same. Controls in the same minutes: the
loop's `sc list` reads all exit 0; the same `--id` call issued directly (no helper) at 1057 s → same error; `sc measures
--name` on the same scorecard through the helper → exit 0, 35 KB captured. Discriminator beyond this section's steps:
after a FRESH login (`whoami` 3589 s) `--id` failed 3 of 3 and on all four KB scorecards — on 1.0.10 it fails every time,
not only past half-life. Static reading of the 1.0.10 handler (unconfirmed): with `--id` the name lookup is skipped, so
the first authenticated call is a Promise.all pair (fetch + schemes) reaching TokenOnlyProvider's lazy token load at
once; with `--name` a sequential list call primes it. Per the kickoff this reopened F-462 (CP-3 is its section) rather
than minting a finding; both entries now say the symptom persists on 1.0.10 with the cause unknown (tester role
inversion, see F-462). Upstream via /gs-superadmin:report-bug: Bradley's call.

Owed by: the same session as (a), on (a)'s token. Plan item: CP-6 (b) — it decides the final wording of the two
race entries F-462 scoped to 1.0.9 and earlier (templates/operating-model.md "Known CLI issues", and
skills/setup/references/document-domain-notes.md's scorecard exception).
Tenant: the sandbox. Reads only.

Steps:
1. With `whoami` under 1800 s remaining on 1.0.10, take one scorecard id from the sandbox KB (the scorecard domain's
   manifest entries).
2. Run `gs-admin --json sc measures --id '<id>'` through the capture helper (setup Phase 4's capture fence). Record
   the exit code and whether stderr carries "No stored token found".
3. Repeat twice more, a few minutes apart, while `whoami` still reads valid.

FIXED (symptom gone on 1.0.10): all three succeed. The two entries then drop "not yet measured live" and say the
symptom does not occur on 1.0.10; the `--name` workaround stays for 1.0.9 users (polish; rides the next round).
BROKEN (symptom persists): any false "No stored token found" while `whoami` reads valid — the concurrent-refresh
mechanism cannot be the cause on 1.0.10, so log a normal finding: both entries must say the cause is unknown on
1.0.10, and the symptom goes upstream through /gs-superadmin:report-bug.

## F-462 / CP-6 (c) — KI-017 on the new expired-token error path (banked 2026-09-26, builder, 1.0.10 adoption round — CLEARED 2026-09-26 @ hb-20260926-01)

CLEARED 2026-09-26 (tester, 1.0.10-V) @ hb-20260926-01 — FIXED (KI-017 does not reach this path). At (a)'s first
failure the full stderr was the one "Access token has expired …" line — no UV_HANDLE_CLOSING assertion, no
`src\win\async.c` line — and the exit code was 1 under Git Bash. The same read repeated at once from Windows
PowerShell 5.1 (`powershell.exe -NoProfile`, spawned by the loop): the same message (wrapped as a NativeCommandError
by 5.1's stderr handling), no assertion, `$LASTEXITCODE` 1. A clean non-zero exit in both shells.

Owed by: the same session as (a) — measured at (a)'s first failure, no extra run. Windows host (the assertion is in
the CLI's Windows event loop). Plan item: CP-6 (c).
Tenant: the sandbox. Reads only.

Steps:
1. At (a)'s first failure, keep the full output: does stderr end with the UV_HANDLE_CLOSING assertion
   (`src\win\async.c`, line 94) after the "Access token has expired" message?
2. Record the exit code under Git Bash and under PowerShell (repeat the failing read once in the other shell).

FIXED (KI-017 does not reach this path): a clean non-zero exit, the message on stderr, no assertion.
BROKEN (KI-017 reaches this path too): the message, then the assertion; exit 127 under Git Bash / 255 under
PowerShell (raw 0xC0000409). Record for the gs-fortress ledger's KI-017; no plugin change is owed — describe-batch's
auth-death classifier reads the re-login sentence in the output, not the exit code, and the operating model's
KI-017 entry already says a crash code is not an auth status.

## F-462 / CP-6 (d) — KI-005 retry: `re r sources fields` in isolation on CLI 1.0.10 (banked 2026-09-26, builder, 1.0.10 adoption round — CLEARED 2026-09-26 @ hb-20260926-01)

CLEARED 2026-09-26 (tester, 1.0.10-V) @ hb-20260926-01 — FIXED (KI-005 resolved at 1.0.10). Fresh `gs-admin login`
(browser flow, exit 0), then as the FIRST command after it, alone:
`gs-admin --json re r sources fields --type MDA --object-name company --limit 5` — exit 0, `result: true`, fields
returned (Git Bash). In the same minute, `gs-admin --json re r sources objects --type MDA --limit 1` — exit 0, one
object returned. No auth text on either stderr. `whoami` right after: valid, 3591 s. Same token as (a)-(c).

Owed by: a tester session on 1.0.10 with a live tenant; any time inside a token's usable life (it need not ride
(a)). Plan item: CP-6 (d). A refresh-timing interaction was one candidate cause of KI-005, and 1.0.10 removed refresh.
Tenant: the sandbox. Reads only.

Steps:
1. `gs-admin login` fresh (or confirm well over 60 s of usable life).
2. As the FIRST command after that, alone: `gs-admin --json re r sources fields --type MDA --object-name company --limit 5`.
3. In the same minute, a sibling read: `gs-admin --json re r sources objects --type MDA --limit 1` (or any rules-engine
   list). Record both exit codes and any auth text.

FIXED (KI-005 resolved at 1.0.10): step 2 returns fields.
BROKEN (still open): step 2 fails auth in isolation while step 3 succeeds — record the exact text for the ledger's
KI-005; no plugin change is owed.

## F-463 — does the tenant OAuth app need the CORS origin reference/auth.md lists? (banked 2026-09-26, builder, 1.0.10 adoption round — CLEARED 2026-09-26 @ hb-20260926-01)

CLEARED 2026-09-26 (Bradley, relayed by tester 1.0.10-V) @ hb-20260926-01 — FIXED (the README is right, auth.md
over-states). Step 1: Bradley opened the sandbox's OAuth Applications page and the app the CLI enrolls against — there is
no CORS-origin field on the form ("nothing new from the first time I set this up"). Step 2 is moot (nothing to clear);
no tenant change was made. The same session's `gs-admin login` against that app succeeded (CP-6 (d) above). Owed: drop
the CORS clause from reference/auth.md "One-time login" (polish, doc-only, per this section).
Applied 2026-09-26 (builder, adopt-cli-1-0-10): the clause is dropped from reference/auth.md, and its one sibling —
reference/workflows/01-authenticate.md's troubleshooting line "CORS / callback errors → the tenant OAuth app needs
origin …" — now names only PKCE and the callback; `git grep -i cors` outside dev/ and the regenerated wiki finds
nothing left. Wiki regenerated (it embeds both docs).

Owed by: a tester session, or Bradley, with super-admin access to the SANDBOX tenant's OAuth Applications page and a
CLI that can log in. Nothing here is a gs-admin mutation; the tenant change is an admin-UI edit, reversible, and
Bradley's call to make.
What is in question: reference/auth.md ("One-time login") lists "CORS origin `http://localhost:19876`" beside the
scopes, PKCE and callback URL. Gainsight's Configure Admin CLI page and its OAuth for Gainsight APIs article list
scopes, PKCE and the callback URL only, and the README beginner path F-463 lands leaves CORS out. Static expectation
(prediction, not a measurement): the login is a browser redirect to the loopback callback followed by a token
exchange from Node, and neither is a cross-origin browser request, so CORS should not apply.

Steps:
1. In the sandbox (Administration > User Management > Authentication > OAuth Applications), open the app the CLI
   enrolls against. Record whether the form has a CORS-origin field at all, and what it holds.
2. If it holds `http://localhost:19876` and Bradley approves: clear it, run `gs-admin login` and `gs-admin whoami`,
   then restore the field.

FIXED (the README is right, auth.md over-states): there is no CORS field, or login succeeds with it cleared — drop the
clause from reference/auth.md (polish, doc-only).
BROKEN (the README under-states): login fails with the field cleared — README §1's prerequisite list gains the CORS
origin (normal: a beginner following the README cannot log in), worded the same way in README and auth.md.

## PR #31 / PR #32 (#28) — deps-report and email-report deps walks: the corroborate-live caveat drops objects a completed capture covers (banked 2026-09-28, maintainer — #31 merged to dev @ 7a75662 as plugin 0.43.1, #32 @ 7f66d40 as 0.43.2 — CLEARED 2026-09-28 @ hb-20260928-01)

CLEARED 2026-09-28 (tester) @ hb-20260928-01 — A1 PASS, A2 PASS, B1 PASS, B2 SKIPPED (B1 lists no field-level rows).
Provenance: dev-canary read hb-20260928-01; dev clean at 6a86219; the workspace plugin link resolved into the repo's
plugins/gs-superadmin working tree (junction, not the 0.43.0 cache) and its plugin.json read 0.43.2; gs-admin
--version 1.0.10; tenant: the sandbox. Object in every arm: `Playbook` (the 1.0.10-V walk's object).
A1 (`deps-report --object 'Playbook'`, skill-invoked): `dm deps check` capture COMPLETED on attempt 1 (1.5 s, 27724 B);
  scan 10 reports / 16 rows, liveCaptures 1, caveatCount 2. "Live dependents of `playbook` (dm deps check)" RENDERED.
  Caveats, verbatim:
    - All statuses and payloads are KB-cached (see the freshness line) — nothing here was fetched live; re-crawl stale domains before acting on status columns.
    - JO participant-source mapping rows carry no object names (C1 fact, inherited from the deps mode) — a journey using a matched object only via mappings shows under --field terms or in the live section, never under --object.
  No "KB-derived view — corroborate live …" line. #28 stays closed.
A2 (`--no-live`): same 10 / 16, liveCaptures 0, caveatCount 3; no live section (none expected). Caveats: the two above,
  plus:
    - KB-derived view — corroborate live and cross-area with `gs-admin --json dm deps check --name 'Playbook'` (async — re-capture until COMPLETED), then pass each capture back via `--live-deps <file>`.
  Present and names the object.
B1 (`email-report deps --object 'Playbook'`, skill-invoked): sweep reconciled 1085/1085 over 6 pages; index 1075
  programs; gap total 1754 → the 4b ask rendered (the tester's AskUserQuestion; Bradley chose Skip); JO-scoped capture
  COMPLETED on attempt 1 (1.2 s); 79 active programs scanned, 0 field-usage rows, objectsTouched [], caveatCount 2.
  "Live dependents of `playbook` (dm deps check)" RENDERED (0 JO dependents). Caveats, verbatim:
    - Scope: active programs only — 996 of 1075 program(s) NOT scanned. A schema change can still break inactive programs someone later reactivates; re-run with --all for full coverage.
    - The participant-source table above is FILTER-CONDITIONS-ONLY (C1 mappings carry no object names); the "Live dependents" section(s) supply the mapping/SELECT-side usage from `dm deps check` — read them together.
  No "KB-derived, JO-scoped view — corroborate live …" line. Discrimination, read from source rather than run: at
  7f66d40^, jo-report-deps.mjs built the list as `objectsTouched.length ? objectsTouched : opts.objectTerms`, so
  with objectsTouched [] the pre-#32 code would have named `Playbook`. This arm measures the --object-term fallback,
  not a touched-objects list.
B2: SKIPPED. B1 lists no field-level usage rows, so there was no field to pass. The JO-scoped caveat's presence and
  naming are unmeasured live this round and remain pinned offline.

Owed by: the next tester round, in a consumer session with the working tree loaded (dev at or after 7f66d40).
Neither fix has been walked live. #31 (outside contributor, no tenant) fixed deps-report's caveat for `--object`
terms; #32 (maintainer follow-up) applied the same rule to email-report's deps mode (the JO-scoped caveat) and to
deps-report's touched-objects fallback. Both shipped walked on fixture KBs only: seven new pins across
test/tenant-deps.mjs and test/jo-report-deps.mjs, each cover pin mutation-checked, with every local gate and every
CI gate green on both merges. The defect was first seen live in the 1.0.10-V deps-report walk ("the report's third
caveat still says to corroborate live via --live-deps although a capture was passed"), logged as F-465 and
re-homed to issue #28.
Tenant: either. Read-only: `dm deps check` is not mutating (reference/domains/data-management.md), and both scans
read the KB only.

Steps (from the consumer workspace; one object the KB documents, used in every step — the 1.0.10-V walk's object
is fine):
A1. `/gs-superadmin:deps-report --object '<object>'`, letting step 2 capture live. The capture must complete:
    `--wait` writes it only on COMPLETED.
A2. `/gs-superadmin:deps-report --object '<object>' --no-live` (the KB-only control).
B1. `/gs-superadmin:email-report deps --object '<object>'`, letting step 5 capture live
    (`--areas JOURNEY_ORCHESTRATOR`, also written only on COMPLETED).
B2. `/gs-superadmin:email-report deps --field '<field>'`, where `<field>` is one B1's report lists in its
    field-level usage rows (the KB-only control: step 5 captures `--object` terms only, so this run passes no
    capture, and a field with usage rows makes the scan touch the object). If B1 lists no field-level rows, skip
    B2 and record that; the touched-objects list is pinned offline.

Pass bar:
- A1: the report renders its "Live dependents of `<object>`" section, and its caveats carry NO
  "KB-derived view — corroborate live …" line.
- A2: that caveat is present and names the object. A KB-only run still carries the corroboration command
  (deps-report step 2: "the report's caveats already carry the corroboration command").
- B1: the report renders its "Live dependents of `<object>`" section, and its caveats carry NO
  "KB-derived, JO-scoped view — corroborate live …" line, or, if the scan touched other objects too, a line
  naming only those.
- B2: the JO-scoped caveat is present and names the touched object(s).
- Not walked here, pinned offline instead: a partly covered run names only the uncovered object, and a capture
  that never reached COMPLETED leaves its object in the caveat (the #28 checks in both suites). The skills' own
  flows cannot produce either on demand, because `--wait` writes no capture for an incomplete check.
An A1 caveat that still names the object reopens #28; a B1 caveat that still names it is a finding against #32.
Record the verdict here with the token, and copy it to the bus under the round's Blind spots line.

## ENG-2 — the engagement adapter on a real tenant: the contract gate and thirteen live checks (banked 2026-10-03, builder, Session S1 @ hb-20261003-01; re-banked the same day for the re-run, S1 fix batch @ hb-20261003-02 — CLEARED at the S1-V third re-run @ hb-20261003-05: every check CLEARED)

Owed by: the S1-V re-run, the tester round on hb-20261003-02, in the consumer workspace with the plugin loaded
from branch `feat/jo-dash-s1-facts`. The branch does not merge before this section is cleared.
The first S1-V round (hb-20261003-01) stopped at V0, before any tenant call: Bradley ruled two contract shapes
changed, and the tester logged F-470 while choosing V9's program. The S1 fix batch landed all three; this section
is rewritten for the re-run and is keyed to its token. Nothing below was run in the first round.
Why it is banked: the adapter (`scripts/engagement.mjs`, plan items ENG-1 and ENG-2) was built offline against a
fictional tenant whose stand-in CLI reproduces the response shapes a spike recorded. Whether the real CLI answers
the adapter's queries the same way, and whether the numbers match the Gainsight UI, cannot be measured without a
tenant.
Tenant: either; production reads are allowed once the tenant is confirmed (`gs-admin whoami`). Every call is a
read: the adapter refuses a catalog-mutating command before spawning it.

THIS LIST IS COMPLETE. It is everything S1-V judges, the frozen contract included; a check that is not here is
not owed, and a thing S1-V thinks should be here is a finding. And nothing is "noted on the verdict": anything
observed beside a pass bar becomes an F-section on the bus, or a GitHub issue, before the round closes. (Both
rules come from the record: observations left on verdicts became F-464, F-465 and F-466 only after a merge, and
the #28 walk skipped an arm because its test object was chosen before anyone saw it could not exercise it.)

Pick these BEFORE the first call, with Bradley, so no arm is skipped for want of the right program. The first
round settled the picks; they are tenant data and stay in the consumer workspace, never here. Settle only what
this list adds or changes:
- P-busy: an Active program with sends in each of the last three months, whose analytics Bradley can open in the UI.
- P-survey: a program that sends a survey and has responses.
- T-history: a template with content-link clicks in an earlier month and none in the latest full month (the
  spike's notes say which query finds one). If the tenant has none, V4's first bar is recorded as not measurable
  and the reason is logged as a finding.
- T-never: a template with sends and no recorded click of any kind.
- P-unsub: a program whose only recorded clicks are on the unsubscribe link (about one program in seven with
  clicks, on the spike tenant).
- P-multi: a program that sends more than one email, for V12's per-email half (P-busy may send only one).
- The tenant's internal email domains, every one of them.
- The tenant's unsubscribe link, or the external host it lives on: the link a recipient clicks to unsubscribe,
  read from a real email. If the tenant uses more than one, all of them (F-470).
- One calendar month for the single-month UI comparison (V12).

Run (from the consumer workspace; `<slug>` is the tenant's KB folder; outputs stay under `.gs-superadmin/tmp/`,
which the workspace ignores; the script prints counts and verdicts, never rows). Two inputs ride EVERY line
below, written once here as `<inputs>`:
- `--internal-domain <domain>`, repeated once per internal domain: pass every one.
- `--unsubscribe-link <link or host>`, repeated once per unsubscribe link. A link is matched by host and path
  (that page and anything under it); a bare host names the whole host. Single-quote each value.
A run resumes only with the inputs it started with, and a change to either one forces a full refresh, so keep
`<inputs>` identical across the five lines.
1. `node .gs-superadmin/plugin/scripts/engagement.mjs plan --kb <slug> <inputs> --run s1v-full`
   and keep its estimate (calls, seconds, what step detail adds, whether it fits the token).
2. `node .gs-superadmin/plugin/scripts/engagement.mjs run --kb <slug> <inputs> --run s1v-full --out .gs-superadmin/tmp/engagement/s1v-full.json`,
   timed. If it exits 3 (token), log in and run the same line again: it resumes.
3. The same `run` with `--step-detail --run s1v-steps --out .gs-superadmin/tmp/engagement/s1v-steps.json`, timed.
4. `run --kb <slug> <inputs> --previous .gs-superadmin/tmp/engagement/s1v-full.json --run s1v-selective --out .gs-superadmin/tmp/engagement/s1v-selective.json`.
5. `run --kb <slug> <inputs> --sent-since 90d --run s1v-since --out .gs-superadmin/tmp/engagement/s1v-since.json`.
Read a snapshot with node one-liners that print one program's figures or a count, never the file.

Pass bars (stated before measuring; counts are compared, not rates, because the UI views round differently):
- V0 · The contract gate, now a confirmation. Before any run, Bradley confirms that the two changes he ruled at
  the first round's V0 landed as ruled, reading the typedef at the head of `scripts/engagement.mjs`:
  (1) the per-program click roll-up is `tracked` only when every template is, `not-tracked` only when every
  one is, and any mix is `unknown`, with the `{tracked, notTracked, unknown}` counts kept; (2) each
  `facts.responseParticipants` row carries the program's all-time `submitted` and `partiallySubmitted` beside
  its all-time `participants`, the monthly `responses` rows stay, and `readResponses` gives the all-time pair
  with no months and counts without a denominator when months are passed. Shapes 3 and 4 stand as built. No
  run starts until he has confirmed; a further change he asks for lands before the merge, typedef and pin
  together.
- V1 · Reconciliation and the excluded classes. Run 2's summary reads `reconciled: true`, every check `ok` with
  `compared` above zero. A mismatch is a finding; its `examples` name the program and month. The summary's
  `excluded` counts are plausible against the spike: CC copies a fraction of a percent of the rows, deleted
  programs a few percent of sends, and one deleted id, described by hand, answers "not found".
- V2 · Uniques against the UI (R3), P-busy, all time or the UI's own range: unique recipients (`people`) is
  within one percent of the UI's Contacts, and accounts reached is plausible against the UI's account list.
  The spike measured a ratio of 0.998 for people; a larger gap is a finding.
- V3 · The class split. With `<domain>` given, the snapshot has internal and external rows, the
  `internal-within-all` check is `ok`, and for P-busy internal plus external `sent` equals the UI's sent count.
- V4 · Tracking state by R19's history rule, on real data: T-history reads `tracked` and its latest full month's
  rows read 0 clicked (a real 0); T-never reads `unknown` (the link-settings reading arrives in a later
  session); no template reads `not-tracked`.
- V5 · Rejected, unsubscribed and spam-complaint counts for P-busy equal the UI's counts for the same range.
- V6 · Selective refresh. Run 4's summary reads `refresh.mode: selective`, makes fewer calls than run 2 (record
  both counts and both elapsed times), and its template totals per program and month equal run 2's for every
  carried month.
- V7 · `--sent-since`. Run 5's programs are exactly the programs with a send in the last 90 days: compare its
  program ids with `jo p list` plus one direct count of the send log since that day, per program.
- V8 · Query shapes the spike did not run in this exact form. In each run's `fetch-log.jsonl`, every call
  family ends `ok` with no `shape-error` and no `unparseable`: the clicked-sends attribution grouped by the
  send's id; the plain `LinkClickedJson` rows; company names by `Gsid IN`; `SourceId IN` with up to fifty ids;
  the Source × AddressType count; the survey month × status call; and, in run 3, the three `ao_emails` shapes
  (step grain on `CreatedAt`, the click join through `EmailLogId`, distinct participants through a fieldPath).
  `honesty.rows.unreadable` is 0 and `honesty.clicks.unreadable` is 0. A failing family is a finding with its
  stderr text.
- V9 · Content links on real URLs, and F-470's verification. With the unsubscribe input passed on every run
  line: `meta.params.unsubscribeLinks` echoes it; P-unsub reads zero content clicks (`clicked` 0 on every one of
  its rows) and its templates read `unknown`, not `tracked`; `honesty.clicks.nonContentOnly` is above zero, and
  so is `honesty.clicks.byUnsubscribeInput` (0 there means the input matched no clicked link: check the value
  against a real email before calling it a defect). This bar is the verdict on F-470: pass flips it to VERIFIED,
  fail sends it back to OPEN with the measurement. If some unsubscribe link still reads as content with the
  input passed, that is a reopen naming the link's shape (host plus path skeleton, ids masked; no URL is ever
  on disk: read one with the spike's runner).
- V10 · Participant records, run 3, P-busy: the window's `participantRecords` equals the UI's Participants.
  Record the calls and seconds the two participant families took: Bradley's ruling of 2026-10-03 keeps the
  count behind the step-detail switch until this cost is measured.
- V11 · Responses, P-survey: the all-time Submitted, Partially submitted and participant denominator, read from
  the program's `facts.responseParticipants` row, equal the UI's figures for that program. Compare those three,
  not a sum over the window's months: a program older than the window has more responses than the monthly rows
  hold. The all-time counts come from a call the first build did not make (the survey rows by program and
  status, with no date window): if its family, `resp-total`, does not end `ok`, that is V8's finding. Also answer the open question: is there a date field
  present on EVERY `survey_participant` row? If so, name it on the bus; a month-grain denominator is an
  additive field a later session can add.
- V12 · Month boundaries and time zone (the spike arm g2 rides here): for P-busy and the chosen month, the UI's
  sent, delivered and opened for that month equal the snapshot's month row. A one-day shift at either edge is
  a finding that names the direction. The arm's other half, per-email parity, uses run 3: one program's step
  rows against the UI's per-email delivered and opened. Both answers also go into the spike notes.
- V13 · Cost and privacy. Run 2's elapsed time against the estimate from step 1 (record both; an estimate off by
  more than a factor of two is a finding). Step names: `honesty.stepNames` on the real KB, and whether the
  programs without a design are the ones the KB holds only stubs for. And one search of every file under the
  three run directories and the three snapshots for an `@`, and for an IPv4 pattern: none may be found. If a
  run stops on the token (exit 3), the same line resumes it: record the calls it reused. That path is pinned
  offline, so it is recorded when it happens, not forced.

A verdict that any of V1, V3, V4, V8 or V13's privacy search fails keeps the branch unmerged. Record each verdict
here with the token, and copy the measurements to the bus under the round's Blind spots line.

Result (tester, S1-V re-run, 2026-10-03 @ hb-20261003-02) — OPEN; nothing CLEARED; the branch stays unmerged on V8.
Under test: feat/jo-dash-s1-facts at 9482657, clean, canary matched; production tenant, confirmed; CLI 1.0.10; reads
only. The picks were confirmed with Bradley before the first call, plus the re-run's inputs (both internal domains,
"all as far as I know"; the two unsubscribe pages on the company's own site, passed as the emails print them) and
P-multi; all kept in the consumer workspace. Run 1 (plan) ran; run 2 (full) ended partial, exit 4, after 1305 s, so
no snapshot exists. Runs 3-5 were not run, on Bradley's call: each would hit both defects, and run 4 needs run 2's
snapshot. Bradley's UI figures for every UI comparison below were read in this session and are kept with the picks.
- V0: CONFIRMED by Bradley (both contract changes landed as ruled; shapes 3 and 4 stand).
- V1: not measurable (no snapshot). Seen on the way: run 1 counted 1 deleted program id, and the adapter's own
  describe of it read "not found" on its solo re-check (attempt 2); the by-hand describe the bar names was not made.
- V2, V3, V4, V5, V6, V7, V10, V11, V12: not measurable (no snapshot; V6, V7, V10 and V12's per-email half also need
  runs 3-5). V5's spam third has no UI side: the UI view shows no spam figure.
- V8: FAILED. click-attr, 3 of 3 units, refused client-side by the CLI's request normalizer (F-471); account, 5 units
  truncated with nothing left to split on (F-472). Every other run-2 family ended ok, resp-total included. Run 3's
  three ao_emails shapes never ran.
- V9: not measurable (no snapshot), so F-470 stays FIXED. Diagnostic only: run 2's click-json payload, classified
  under the input, holds 1591 clicked sends; 59 carry a link the input named, and 36 have only non-content links, all
  36 of them input matches.
- V13: partly measured. Elapsed 1305 s against the plan's 1011 s (1.29x, inside the 2x bar); calls 194 against 139
  (28 splits). Privacy search over run 2's directory: 203 files, 0 with an @, 0 with an IPv4 pattern. Step names need
  a snapshot. Not observed: a token stop (no exit 3).
- Spike arm (g2): not answered (needs a snapshot and run 3); carried with V12.
Owed by the next re-run, after F-471 and F-472 are fixed: every check above except V0, from run 1, with the same inputs.
Run 2's directory is kept in the consumer workspace (resume is the builder's call: the fixes change the failed units'
argv, and the kept calls were pulled on 2026-10-03).

Re-banked (builder, second S1 fix batch, 2026-10-03 @ hb-20261003-03): F-471 and F-472 are FIXED on the branch. The
list above is unchanged and is still the complete list; it is owed by the next S1-V re-run on hb-20261003-03, from
run 1, with the same inputs. The builder's call on run 2's directory: start NEW `--run` names (for example
`s1v2-full`, `s1v2-steps`, `s1v2-selective`, `s1v2-since`) and leave the old directory alone. A resume would work,
but it would reduce calls pulled hours apart. Two bars read differently after the fixes, and no bar changed:
- V8 judges F-471 and F-472: every family ends `ok`, click-attr included; no unit in `failed` is `truncated`; and no
  call's record carries a `normalizeGroupByDedup` warning.
- V1 judges F-472's cut: a unit cut by the recipient's address must still add up, so `accounts-sum-to-program` and
  `templates-sum-to-program` read `ok`. A mismatch there names the program and month, and is a reopen of F-472.
- One read beside V8, for F-472's known limit (the address cut assumes no in-scope send lacks an address): through the
  spike's catalog-checked runner, COUNT of `Gsid` on `email_log_v2` with `Source EQ "Advanced Outreach"`,
  `AddressType EQ "To"`, the window's two `ExecutedDate` bounds and `LowerCaseEmailId IS_NULL`. Record the count.
  Zero: nothing more. Above zero: reopen F-472 with the count (no address, no id).
- V13's estimate: the plan cannot foresee splits, so expect more calls than estimated on the mass-send days, as in
  run 2 (194 against 139). The 2x bar on elapsed time stands.

Result (tester, S1-V second re-run, 2026-10-03 @ hb-20261003-03) — OPEN: V1 and V11 FAILED; every other check CLEARED; the
branch stays unmerged.
Under test: feat/jo-dash-s1-facts at 96ed11e, clean, canary matched; production tenant, confirmed; CLI 1.0.10; reads only.
Picks, inputs and UI figures as settled at the first re-run, confirmed with Bradley before the first call; new run names
(s1v2-full, s1v2-steps, s1v2-selective, s1v2-since) with identical inputs on every line. All five runs completed, exit 0.
Runs, estimate -> actual: 1 plan ok (139 calls / 1011 s; step detail +45 / +315 s); 2 full 303 calls / 1909 s; 3 step
detail 184 / 1326 s -> 356 / 2267 s; 4 selective 29 / 241 s -> 168 / 1016 s; 5 --sent-since 90d 91 / 675 s -> 226 / 1429 s.
How the UI comparisons were made: the UI page Bradley read for P-busy reports lifetime figures (its date-range control did
not narrow them), and it calls the went-out count (IsSent = YES) "Sent" and that count minus every bounce event
"Delivered". The adapter's own query shapes, run over the program's lifetime through the spike's catalog-checked runner,
equal that page exactly on all seven counts (went-out, attempts, distinct people, bounces, rejects, unsubscribes,
distinct participant records), and each snapshot's window counts equal the send log's window sums. Bradley then ruled
the dashboard's terms (T-10, the builder's change before the merge): Sent = every attempt (R17 unchanged); Delivered =
went out and did not bounce (IsSent = YES and IsBounced = NO), falling back to the original definition with a tooltip
only if it cannot be computed.
- V0: CLEARED @ hb-20261003-02 (Bradley's confirmation; the typedef has not changed since).
- V1: FAILED (F-473). Run 2 reads reconciled false: templates-sum-to-program 25 of 561, accounts-sum-to-program 93 of 4488;
  internal-within-all ok (185978 compared), clicked-within-delivered ok. Cause, measured: every send with no company link
  is missing from the account table and from the program total (a lookup fieldPath drops rows whose lookup is null);
  template-minus-account sent equals the no-company count in 561 of 561 program-months. F-472's address cut adds up
  (verdict under F-472). Excluded classes plausible: CC copies 287 of 357530 rows (0.08%); 1 deleted program, 27860 sends
  (2.6%), whose id described by hand answers "Advanced Outreach not found".
- V2: CLEARED, through the lifetime bridge. People (distinct person) for P-busy equals the UI's Contacts exactly over the
  page's lifetime basis (ratio 1.000); the window's 3942 people and 1485 accounts are plausible against it.
- V3: CLEARED, through the lifetime bridge. Internal and external rows present; internal-within-all ok; for P-busy internal
  16 + external 18014 = 18030 = the send log's window attempts; the UI's "Sent" equals the lifetime went-out count exactly.
- V4: CLEARED. Template states: 27 tracked, 229 unknown, 0 not-tracked. T-history reads tracked (history Jan-May 2026) and
  its September rows read clicked 0 on 15 sends, a real 0. T-never reads unknown.
- V5: CLEARED, through the lifetime bridge. P-busy's rejected and unsubscribed equal the UI's exactly over its basis (and
  bounced too). Spam: the UI shows no figure, so that third has no UI side; the snapshot reads 0.
- V6: CLEARED. Run 4: refresh.mode selective (carried 11 months, re-pulled 2), 168 calls / 1016 s against run 2's 303 /
  1909 s; all 632 carried program x month x class template rows equal run 2's on every measure, none missing or extra.
  Its own estimate ran 4.2x short (F-476).
- V7: CLEARED. Run 5 resolved 2026-07-05 onward to 67 programs; a direct send-log count since that day, per program, finds
  exactly 67 programs, all in jo p list, and they are run 5's 67 (none missing, none extra); 125 counted unselected.
- V8: CLEARED. Every family ended ok in every run, failed [] in each summary; run 3's three ao_emails shapes ok (step 25,
  step-click 4, participants 8 + 8); no normalizeGroupByDedup line in any stderr; rows.unreadable 0, clicks.unreadable 0.
  The banked read for F-472's known limit: in-scope sends with a null address = 0.
- V9: CLEARED (F-470 VERIFIED). meta.params.unsubscribeLinks echoes both pages; P-unsub's 6 rows read clicked 0 and its 3
  templates unknown; nonContentOnly 36; byUnsubscribeInput 59.
- V10: CLEARED, through the lifetime bridge. Run 3's window participantRecords for P-busy 18030 (= its window attempts);
  lifetime distinct participant records through the adapter's own shape equal the UI's Participants exactly. Cost of the
  two participant families on run 3: participants-month 8 calls / 88 s, participants-window 8 calls / 59 s (16 calls /
  146 s, about 6% of the run).
- V11: FAILED (F-474). P-survey's facts.responseParticipants: participants 542, submitted 65, partially submitted 35. UI:
  531, 67, 35. Submitted: Bradley identified 2 of the UI's 67 as internal test responses, and the CLI's 65 holds no test
  row. Partial equal. The denominator's 11 is not explained by status, test flag, internal submission or sent date, and is
  stable across three pulls. resp-total ended ok. Open question answered: SurveySentDate is set on every survey_participant
  row attributed to a program (0 null); 798 of 257838 rows lack it, all among the rows attributed to none.
- V12: CLEARED, both halves (spike arm g2 answered in SPIKE-NOTES). Month: P-busy's August row equals the UI's month on
  went-out (1953) and opened (184); the UI's other two figures differ only by the labels ruled above; no one-day shift at
  either edge. Per email (P-multi, run 3, August): opened equal on all three emails; the UI's delivered equals each email's
  went-out minus its bounces; the UI's third email is two steps of the program.
- V13: CLEARED. Run 2 elapsed 1909 s against 1011 s estimated (1.89x, inside 2x); 303 calls against 139 (77 splits). Step
  names: honesty.stepNames source kb, 181 programs with a design, 11 without; the KB holds no stubs (556 journey docs, all
  full depth, indexed 2026-09-10) and the 11 are absent from it, every one first sending in 2026-09 or later, after that
  index, two of them the mass-send programs. Privacy search: 0 files with an @ and 0 with an IPv4 pattern across the four
  run directories (1077 files) and four snapshots. No token stop occurred.
Logged this round: F-473, F-474, F-475 (reconciliation reads current-month drift over a long pull as a failure; runs 2-5),
F-476 (plan's estimate omits splits; runs 2-5). Owed by the next re-run, after the builder's batch: V1 (F-473's fix) and
V11 (F-474), the Delivered definition's readers, F-475 and F-476 per their Fix notes; the CLEARED checks stand unless the
batch moves what they read.

Re-banked (builder, third S1 fix batch, 2026-10-03 @ hb-20261003-04): F-473, F-475 and F-476 are FIXED on the branch,
F-474 stays OPEN, and the Delivered ruling landed (went out and did not bounce; the T-10 typedef and its pin moved
together). The list above is unchanged and still complete. Owed by the next S1-V re-run on hb-20261003-04, with the same
inputs and NEW run names (s1v3-full, s1v3-steps, s1v3-selective, s1v3-since):
- Run 4's `--previous` must be THIS round's run 2 (s1v3-full.json). A snapshot from an earlier round holds the old
  Delivered and lacks the no-company-link sends in its carried months; carrying from it would mix two definitions.
- V1 judges F-473: over the closed months `templates-sum-to-program` and `accounts-sum-to-program` read ok;
  `honesty.noCompanyLink.sent` equals a direct count of the selected programs' in-scope sends with
  `GsCompanyId IS_NULL`; clicked sends attributed (`honesty.clicks.clickedSends`) equal a direct count of the selected
  programs' clicked sends; and the listed program whose every send lacks a company link is in the snapshot.
- F-475 is judged on the same summaries: any difference in the current month is reported as `drift` on its check
  with `reconciled: true`; a difference in a closed month still reads `ok: false` and is a finding.
- F-476 is judged by V13 and V6 as written: each run's estimate against its calls and seconds, the selective run
  included, inside the 2x bar.
- The Delivered change is judged by V3, V12 and the per-email half: with the new definition the snapshot's delivered
  should now equal the UI's "Delivered" where the UI's page is lifetime and the program's sends sit inside the window,
  and otherwise equal a direct count of went-out-and-not-bounced. Opened and Sent are unchanged.
- V11 and F-474, one read in the UI, by Bradley: what the 531 is. Its label and tooltip; whether the page has a date
  range or a test-participant toggle; and whether the survey has been sent by more than this one program. The CLI side
  is exhausted (the builder's note under F-474 lists what 531 is not). Record the answer; the fix, or the R3
  divergence note, follows from it.
Everything else was CLEARED at hb-20261003-03 and is not owed again, except where a fix above changes what a cleared
check read: V2 (people and accounts now come from separate calls) and V8 (six new or changed call families: totals,
the two single-lookup uniques shapes, account-nolink, click-attr-nolink, resp-unattributed) are re-read from the new runs.

Re-banked (builder, fourth S1 fix batch, 2026-10-03 @ hb-20261003-05): F-474 is FIXED on the branch, by Bradley's
ruling after he read both UI pages: the survey figures exclude test participants, so they equal the UI's PROGRAM
analytics. Everything in the block above is still owed, on hb-20261003-05 instead of -04 (no run was made on -04),
with one bar changed and one read dropped:
- V11 now judges F-474: P-survey's `facts.responseParticipants` row equals the UI's program analytics page
  (participants 527; submitted plus partially submitted 100), and `honesty.responses.testParticipantsExcluded` is
  above zero. The survey's own page (531 and 102) is a per-survey basis and is not the comparison.
- The UI read banked for V11 is done (Bradley, 2026-10-03); it is not owed again.
- V8 gains one changed shape and one new family: the three survey calls now carry `TestParticipant EQ false`, and
  `resp-test` counts the rows left out. A failing survey family is a finding with its stderr text.

Result (tester, S1-V third re-run, 2026-10-03 @ hb-20261003-05) — CLEARED: every check owed by the two blocks above passed;
F-473, F-474, F-475 and F-476 VERIFIED; the branch is ready to merge.
Under test: feat/jo-dash-s1-facts at 7cc5d79, clean, canary matched; production tenant, confirmed; CLI 1.0.10; reads only.
Picks, inputs and UI figures as settled, confirmed with Bradley before the first call; V11 compared with the program
analytics page as re-banked. New run names (s1v3-full, s1v3-steps, s1v3-selective, s1v3-since), identical inputs on every
line; run 4's --previous was s1v3-full.json. All five runs completed, exit 0, failed [] and reconciled true in each.
Runs, estimate -> actual: 1 plan ok (299 calls / 2175 s; step detail +45 / +315 s); 2 full 299 / 2175 s -> 315 / 2090 s;
3 step detail 344 / 2490 s -> 369 / 2498 s; 4 selective 105 / 817 s -> 181 / 1096 s; 5 --sent-since 90d 187 / 1391 s ->
239 / 1658 s. Six direct reads through the spike's catalog-checked runner, with the adapter's own filters, were the
independent counts below. Pass bars as stated in the blocks above, written into the round before the first run.
- Delivered (Bradley's ruling, read by V3, V12 and the per-email half): Bradley confirmed the typedef's delivered lines read
  as he ruled, and ruled that a went-out send with a null bounce flag does not count; there are none (F-477, WONTFIX on his
  ruling). Run 2's delivered equals a direct strict count (IsSent YES and IsBounced NO) for 193 of 194 programs over the
  window; the one other program's only month is the current one, where the direct read, taken minutes later, was 32
  higher (incomplete-period drift, F-475). Went-out rows with a null IsBounced: 0; rows with a null IsSent: 0.
- V1: CLEARED (F-473 VERIFIED). templates-sum-to-program 563 compared, accounts-sum-to-program 4504, internal-within-all
  186009, clicked-within-sent 1125, all 0 closed-month mismatches; the same in runs 3-5 (steps-sum-to-template 4148 in
  run 3). noCompanyLink.sent 25867 = direct IS_NULL count; clickedSends 1236 = direct clicked count; both programs whose
  every send lacks a company link are in the snapshot; unselected programs 0. Excluded classes as before: CC copies 288,
  1 deleted program (27860 sends), non-JO sources 677.
- F-475: VERIFIED. Every difference in every run is in 2026-10, reported as drift (run 2: 3; run 3: 2 and 2; runs 4 and 5:
  2 each), reconciled true, caveat incomplete-period-drift; no closed-month difference occurred.
- V2: CLEARED. P-busy: window people 3942, accounts 1485 (each now from its own call); lifetime distinct people through the
  new single-lookup shape 5106 = the UI's Contacts exactly.
- V3: CLEARED. Internal and external rows present, internal-within-all ok; delivered as above.
- V8: CLEARED. Every family ended ok in every run, including totals, both single-lookup uniques shapes, account-nolink,
  click-attr-nolink, resp-unattributed, the three survey calls with TestParticipant EQ false and the new resp-test; run 3's
  ao_emails shapes ok (step 25, step-click 4, participants 8 + 8); no normalizeGroupByDedup line in any stderr; no
  shape-error or unparseable; rows.unreadable 0, clicks.unreadable 0. The deleted program's describe failed twice, its
  designed not-found and solo re-check.
- V11: CLEARED (F-474 VERIFIED). P-survey: participants 527, submitted 65, partially submitted 35 (100) = the program
  analytics page; testParticipantsExcluded 92.
- V12: CLEARED. P-busy, August: sent 1992, delivered 1952 = the direct strict count (1953 went out, 1 of them bounced),
  opened 184 = the UI. The UI's 1913 is went-out less every bounce event (40), a basis the ruling does not use. Per email
  (P-multi, run 3, August): step delivered 660, 634, 9 and 9 = the direct strict counts on ao_emails; every bounce event
  that month (20) is on an attempt that never went out, and no Bounce is null; opened 84, 81 and 6 = the UI's three
  emails.
- V13 and V6: CLEARED (F-476 VERIFIED). Estimate pairs above, the worst 1.72x on calls (run 4), all inside 2x. Run 4:
  refresh.mode selective, 11 months carried, 181 calls / 1096 s against run 2's 315 / 2090 s; all 993 carried template rows
  equal run 2's on every measure, none missing or extra. Step names: source kb, 183 programs with a design, 11 without.
  Privacy search: 0 files with an @ and 0 with an IPv4 pattern across the four run directories (1128 files) and the four
  snapshots. No token stop occurred.
Everything else stands as CLEARED at hb-20261003-03. Logged this round: F-477 (polish, WONTFIX on Bradley's ruling) and, after the checks, F-478 (normal, OPEN: the cross-tenant carry, from the code; not one of this section's checks). Section
CLEARED; PR #36's merge is Bradley's.

## ENG-2 / LTR-9 / F-478 — accounts optional on a real tenant, and F-478's repro (banked 2026-10-04, builder, Session S1b @ hb-20261004-01 — CLEARED 2026-10-04 @ hb-20261004-01: every check CLEARED)

Owed by: the S1b verdict round, the tester round on hb-20261004-01, with the plugin loaded from branch
`feat/jo-dash-s1b-accounts-optional`. W0 is offline. W1 to W5 are live, reads only, in the consumer workspace.
Why it is banked: the batch was built offline against the fictional tenant. What the account grain costs on a real
tenant, and whether a pull without it finishes in the time the plan estimated, cannot be measured without one. W0
is here because the verdict of record on F-478 is the tester's, from the finding's own repro, not the builder's suite.
Tenant: the S1-V tenant (production reads are allowed once `gs-admin whoami` confirms it). Every call is a read.

THIS LIST IS COMPLETE. It is everything this round judges; a check that is not here is not owed, and a thing the
round thinks should be here is a finding. Nothing is "noted on the verdict": anything observed beside a pass bar
becomes an F-section on the bus, or a GitHub issue, before the round closes.

Picks and inputs: already settled, in the consumer workspace (`.gs-superadmin/tmp/s1v-picks.md`: both internal
domains and the tenant's unsubscribe links). Nothing new is picked. Every live run line passes every internal
domain and every unsubscribe link, as the ENG-2 section's lines did. `<prev>` below is the snapshot kept from the
S1-V third re-run, `.gs-superadmin/tmp/engagement/s1v3-full.json`, made before the switch existed.

- W0 (offline; F-478's verification). The finding's repro through the real process and the stand-in CLI, not the
  builder's suite: one `run` over the fixture tenant (`--bin plugins/gs-superadmin/test/fixtures/engagement/fake-gs-admin.mjs`,
  `--accounts`) to get a run directory and a snapshot; copy the snapshot, change its `meta.tenantHost`, and mark a
  template this pull never saw clicked as clicked in `meta.metricAvailability.clicks.templates`; then
  `reduce --run-dir <dir> --previous <the copy>` and `reduce --run-dir <dir>` with no previous.
  Pass bar: the two snapshots are equal in everything but `meta.refresh.why` (which names the reason), so the
  template reads as it does with no previous and `meta.refresh.previousPulledAt` is null. The same with the copy's
  host restored and `drift` deleted from each of its reconciliation checks (a snapshot built under earlier
  definitions). And the control: with the host restored and nothing deleted, `--full` on a fresh run, the template
  reads `tracked`: this tenant's own snapshot still gives its history.
- W1 (live; the cost up front). `plan` twice over the 13-month window: with nothing said about accounts, and with
  `--accounts`.
  Pass bar: both print `estimate.accounts` with the same `addsCalls` and `addsSeconds`, `on` false then true; the
  difference between the two plans' `thisRun.calls` equals `addsCalls`; and the plan without accounts fits the token.
  Record both plans' calls and seconds.
- W2 (live; one timed pull with accounts off). `run` with nothing said about accounts, no `--previous`, timed.
  Pass bar: exit 0, `reconciled: true`; the fetch log holds no `account`, `account-nolink` or `account-names` call
  and no call on `company`; the snapshot's `meta.accounts` is `{pulled: false, reason: "accounts-off"}`,
  `facts.byAccount` and `dimensions.accounts` are empty, no `accounts-sum-to-program` check is present, the caveat
  `accounts-not-pulled` is, and the summary prints `accounts: null`; every program still carries accounts reached in
  `facts.uniques`; `sent` per program and closed month in `facts.byTemplate` equals `<prev>`'s. Cost: calls and
  seconds within 2x of W1's estimate for that plan (the F-476 bar). Record the wall time beside the plan's 5 to 8
  minute estimate (LTR-9); a pull over 16 minutes is a finding.
- W3 (live; accounts added on a later pass). `run --accounts --previous <W2's snapshot>`, timed. `plan` first: if it
  does not fit the token, log in again before the run.
  Pass bar: `meta.refresh.mode` is `full` and `why` says accounts were switched on and every table is pulled again;
  exit 0, `reconciled: true`, with `accounts-sum-to-program` present and ok over the closed months;
  `meta.accounts` is `{pulled: true, reason: null}` and `facts.byAccount` holds all three buckets. Cost: W3's calls
  minus W2's is within 2x of W1's `addsCalls` (the name lookups are not in that figure; count them out).
- W4 (live, plan only; accounts stay off). `plan --previous <W2's snapshot>` with nothing said about accounts.
  Pass bar: `estimate.mode` is `selective`, and `thisRun.byFamily` names no account family.
- W5 (live, plan only; a snapshot from before the switch). `plan --accounts --previous <prev>` with the account
  selection `<prev>` was made with, then the same without `--accounts`.
  Pass bar: the first is `selective` (a snapshot with no marker counts as having pulled accounts); the second is
  `full`, and its `why` says accounts were switched off.

No SKILL.md changed in this batch, so no walk is owed; the round's guard-wiring line is the tester's.

### Result — S1b verdict round @ hb-20261004-01 (tester, 2026-10-04)

Under test: feat/jo-dash-s1b-accounts-optional at 0cd7344, clean and level with origin; the dev-canary skill read
hb-20261004-01 in session; the workspace's plugin link resolves to this checkout's plugins/gs-superadmin. Production
tenant, confirmed by `gs-admin whoami` and by Bradley (one login, before W1); CLI 1.0.10 = the catalog's; every tenant
call a read, one at a time. Round type: RE-VERIFICATION, each check against the pass bar above, written into the round
before its first measurement. Picks and inputs as settled: every live line passed both internal domains and both
unsubscribe links. Run names s1b-off (W1's first plan and W2), s1b-w1-on, s1b-on (W3's plan and run), s1b-w4, s1b-w5-on,
s1b-w5-off. Every plan and run exit 0 with failed []; the deleted program's describe failed twice in each, its designed
not-found and solo re-check.
- W0: CLEARED (F-478 VERIFIED; detail in its Verified note). Real process and stand-in CLI, a scratch workspace over the
  fixture KB: the other-host copy and the drift-deleted copy each reduce to a snapshot equal to the no-previous reduce
  in every leaf but `meta.refresh.why`; the template the copy marked clicked reads `unknown`, as with no previous;
  `previousPulledAt` null. Control (`--full`, host restored, nothing deleted): the template reads `tracked`.
- W1: CLEARED. Accounts off: thisRun 35 calls / 327 s, `estimate.accounts` {on: false, addsCalls 264, addsSeconds 1848},
  token fits. With `--accounts`: 299 calls / 2175 s, {on: true, 264, 1848}. 299 - 35 = 264 = addsCalls.
- W2: CLEARED. Exit 0, reconciled true; the fetch log holds no account, account-nolink or account-names call, and no
  call on `company` (the six payloads with a company column are email_log_v2 calls through the company lookup: the
  accounts-reached distinct counts and the per-send click attribution, families both plans list). `meta.accounts`
  {pulled: false, reason: "accounts-off"}; facts.byAccount and dimensions.accounts empty; no accounts-sum-to-program
  check; caveat accounts-not-pulled present; summary `accounts: null`. All 194 programs carry accounts reached in
  facts.uniques. `sent` per program and closed month in facts.byTemplate equals the kept snapshot's: no program-month
  differs, none missing or extra. Cost: 36 calls / 313 s wall against the plan's 35 / 327 s (1.03x, 0.96x); 5.2 minutes,
  inside LTR-9's 5 to 8 minute guess and far under the 16-minute finding line.
- W3: CLEARED. `plan` first: full, 299 calls / 2175 s, fits with 3085 s left; no login needed. Run: `meta.refresh.mode`
  full, why "accounts were switched on and the previous snapshot holds none, so every table is pulled again"; exit 0,
  reconciled true; accounts-sum-to-program present, ok, 4504 compared, 0 mismatches (its 2 drift entries are both in
  2026-10, the open month); `meta.accounts` {pulled: true, reason: null}; facts.byAccount holds the account, other and
  no-company-link buckets. Cost: 315 calls / 1962 s wall (the plan said 299 / 2175 s); minus the 11
  account-names calls and W2's 36 that is 268 (267 with the company schema read the names use also counted out),
  against addsCalls 264: 1.02x.
- W4: CLEARED. `estimate.mode` selective (months before 2026-09 carried from W2's snapshot); thisRun.byFamily names no
  account family.
- W5: CLEARED. The kept snapshot has no `meta.accounts` marker. With `--accounts` (its selection, the defaults):
  selective, 105 calls / 817 s. Without: full, why "accounts were switched off, so every table is pulled again without
  them", 35 calls / 327 s.
Guard-wiring: `gs-admin jo p pause --help` -> Bradley read the rendered ask: "Mutating Gainsight command: gs-admin journey
programs pause. This workspace is read-only by default. Workspace manifests claim multiple tenants (<slug> (<host>);
<slug> (<host>)) — confirm `gs-admin whoami` targets the intended one before approving. ⚠ At least one of these tenants
is PRODUCTION (recorded at setup) — verify the target before approving." DECLINED; the command never ran.
Walk: none owed (no SKILL.md changed); the round's Walk line is on the bus header.
Section CLEARED. PR #37's merge is Bradley's.

## ENG-3 / ENG-4 — the open-rate report walked on a real tenant, at program level and at account level (banked 2026-10-04, builder, Session S2 @ hb-20261004-02; verdict at V2)

Owed by: V2, the batched verdict session after S4c, in the consumer workspace with the plugin loaded from `dev`
(PR for `feat/jo-dash-s2-engine-report` merges on green CI plus its review round, before V2).
Why it is banked: the query engine and the report were built offline against the fictional tenant and the stand-in
CLI. Whether the skill's prose drives the three scripts without improvising, whether the report's numbers can be
rebuilt in Gainsight from its own glossary, and how the report reads on real program and account names cannot be
measured without a tenant.
Tenant: the S1-V tenant (production reads are allowed once `gs-admin whoami` confirms it). Every call is a read.

THIS LIST IS COMPLETE. It is everything this round judges for ENG-3 and ENG-4; a check that is not here is not owed,
and a thing the round thinks should be here is a finding. Nothing is "noted on the verdict": anything observed beside
a pass bar becomes an F-section on the bus, or a GitHub issue, before the round closes.

Picks and inputs, settled before the first call: the three programs the S1-V rounds used (P-busy, P-multi, P-survey)
and the tenant's internal domains and unsubscribe links, all in the consumer workspace
(`.gs-superadmin/tmp/s1v-picks.md`; tenant data, never copied here). Every line below passes every internal domain
(`--internal-domain`, once each) and every unsubscribe link (`--unsubscribe-link`, once each); `<picks>` stands for
`--name '<P-busy>' --name '<P-multi>' --name '<P-survey>'`. One closed month, `<M>`, is picked for X2 before any call.

- X0 (the skill walk at program level: accounts off, the default, with `--xlsx`). In a fresh session:
  `/gs-superadmin:email-engagement report <picks> --by-template --xlsx`.
  Pass bar: the skill runs its steps as written. It plans first and states the estimate in one line before pulling;
  it pulls with the same `--run` it planned with; the snapshot lands at `<slug>/reports-adhoc/engagement-<run>.json`
  and the report at `<slug>/reports-adhoc/engagement-<date>.md`; the workbook holds one sheet per CSV written (five:
  status, programs, templates, glossary, caveats); the final block is printed in the skill's literal shape with every
  placeholder filled from the summary; every `gs-admin` call was a read and none drew the guard; and no payload,
  snapshot or CSV content was read into the session. Record the plan's calls and seconds and the pull's wall time.
  - Early spot check, tester, 2026-10-04 @ hb-20261004-02: PASSED. Plan: 9 calls made (2 of them retries), 94 s wall;
    estimate 35 calls / 327 s, so pulled in the foreground without an ask. Pull: 36 calls made (the 35 planned plus its
    own whoami), 7 reused from the plan, 0 retried, 272 s wall, exit 0, reconciled. Each clause: plan before pull, the
    estimate stated in one line first; the same `--run` on both; snapshot and report at the stated paths; workbook with
    the five named sheets; final block in the literal shape, every placeholder from the step-4 summary; no gs-admin call
    drew the guard; no payload, snapshot or CSV read (the run's fetch log and status file, both metadata, were read to
    explain F-479's stderr). One guess, at step 6's Caveats line: F-481. Logged: F-479, F-480, F-481, all polish.
    Not a fresh session in the strict sense: the kickoff had the tester read SKILL.md before invoking it.
- X1 (accounts off: the reason where the watch list would be). Read X0's report.
  Pass bar: the "Account watch list" section says it is not included, gives the reason the snapshot's marker carries
  (`meta.accounts.reason`, `accounts-off`) in words, and says how to turn it on (`--accounts`); it holds no table, no
  empty list and no zero. The Programs table still shows a number under Accounts reached for every program. The
  Participant records column is a dash for every program, and the note under the table says why and how to turn it
  on (`--step-detail`). The caveats block carries both.
  - Early spot check, tester, 2026-10-04 @ hb-20261004-02: PASSED, read from X0's report. Watch list: "Not included",
    the accounts-off reason in words, `--accounts` named; no table, list or zero. Accounts reached: a number on every
    program row (the total row a dash, as the note under the table says). Participant records: a dash on every row,
    with the note giving why and `--step-detail`. Caveats: both present (participant records blank; no account data,
    with accounts reached counted either way). Nothing logged.
- X2 (a number rebuilt from the glossary alone). `/gs-superadmin:email-engagement report --name '<P-busy>' --from <M> --to <M>`,
  then, using ONLY what that report's "How each number is calculated" section states for Sent, Delivered, Opened and
  Unique recipients (object, fields and values, filters, date field), build each count as one direct read through
  the spike's catalog-checked runner.
  Pass bar: all four direct counts equal the report's Programs row for P-busy, and the open rate equals
  Opened ÷ Delivered to one decimal. A count that cannot be built from the glossary text alone is a finding.
- X3 (template and step names). In X0's "Emails by template" table, Bradley reads P-multi's emails in the Gainsight
  UI.
  Pass bar: every row names the template and the step the UI shows for it (order and name); a template that sits on
  two or more steps reads "(on N steps)"; no row shows a raw id where the UI shows a name, unless the report's
  caveats say that program has no full KB doc.
- X4 (the skill walk at account level, with `--xlsx`). In a fresh session:
  `/gs-superadmin:email-engagement report <picks> --accounts --step-detail --by-template --xlsx`.
  Pass bar: the plan's estimate is stated before the pull. The report holds an "Account watch list" with, for each
  program that has qualifying accounts, a low-engagement table and a deliverability table; every low-engagement
  account has at least the stated minimum delivered; neither table lists "All other accounts" or "No company link".
  One account from P-busy's low-engagement table, picked before looking: its Sent, Delivered and Opened equal a
  direct count for that company and program over the window (one read through the runner, filtered on the company).
  The "Emails by step" table is present, with step and variant names; Participant records are numbers; the workbook
  holds seven sheets (the five of X0 plus steps and watch-list). Record the pull's calls and wall time.
- X5 (survey responses). In X0's report, the "Survey responses (all time)" row for P-survey.
  Pass bar: Survey participants and Any response equal the figures of the program's analytics page that the S1-V
  third re-run recorded for V11 (kept with the picks); the section says the figures are all time.
- X6 (data pulled, tracking states, caveats). Read X0's and X4's reports.
  Pass bar: the header's "Data pulled" time is when the pull's fact calls ran, judged against the wall clock the
  tester notes when the `run` step starts and ends, NOT against the snapshot's `meta.pulledAt` alone (amended
  2026-10-04 at the S2 close-out: the two agree with each other even when both carry the plan's start; F-482. Until
  F-482 is fixed this clause FAILS by the length of the plan step, and the verdict cites F-482 rather than logging
  it again), with the window and the provisional date; each click cell reads as the snapshot's click state for that template or program says (a plain
  number when tracked, "Not tracked", or a number marked "(tracking unknown)"); the caveats block names the
  incomplete period, the opens caveat, the content-links caveat, and what the pull left out (CC copies, other
  sources) with counts.
- X7 (a pull that continues from an earlier snapshot). `/gs-superadmin:email-engagement report <picks> --previous <X0's snapshot>`.
  Pass bar: the plan's `estimate.mode` is `selective`; the report's header says the pull was selective; the caveats
  block carries the carried-forward caveat, naming the carried months and X0's pull time; the Programs numbers for
  the carried months equal X0's (compare one closed month with `--from`/`--to` reports from both snapshots via
  `--snapshot`, which pulls nothing).
- X8 (a plain question). In a fresh session, with no slash command: "what's the open rate for <P-busy>?".
  Pass bar: this skill is the one that runs (not email-report), in `report` mode, with `--name` for the program; it
  plans and states the estimate before pulling; it answers from the finished report's Programs row, quoting the
  figures as written.
- X9 (the ask before a long pull; plan only). `/gs-superadmin:email-engagement report --accounts`, with no selector.
  Pass bar: after the plan, the skill states the estimate and asks before pulling (the estimate is over ten minutes
  on this tenant), offering to narrow with `--sent-since`. The tester answers stop; no pull is made.

Also owed at V2, from the ledger: the round's guard-wiring line is the tester's.

### F-479 / F-480 / F-481 — re-verification before the merge of PR #38 (banked 2026-10-04, builder @ hb-20261004-03)

Owed by: one tester round on hb-20261004-03, with the plugin loaded from branch `feat/jo-dash-s2-engine-report`, in
the consumer workspace. Live, reads only. It gates the merge of PR #38 on Bradley's call; X2 to X9 above are NOT part
of it and stay owed at V2.
THIS LIST IS COMPLETE for this round. An observation beside a pass bar becomes an F-section or an issue before the
round closes.
Picks and inputs: as for X0, from `.gs-superadmin/tmp/s1v-picks.md`. One walk feeds all three checks:
`/gs-superadmin:email-engagement report <picks> --by-template`, with every internal domain and every unsubscribe link.

- R1 (F-479). Read the stderr of the walk's plan beside its summary.
  Pass bar: with `programs.deleted` 1 or more and `failed: []`, no progress line contains the word `failed`; the
  deleted program's describe reads `not found: trying once more` and then `not found twice: recorded as a deleted
  program, not a failure`. The skill's step 2 says the lines are progress only. If the picks no longer reach a
  deleted program (`programs.deleted` is 0), say so and judge R1 on the offline arm instead: the same plan through
  `--bin plugins/gs-superadmin/test/fixtures/engagement/fake-gs-admin.mjs` in a scratch workspace, window from 2026-01.
  - Tester, 2026-10-04 @ hb-20261004-03: PASSED, on the live arm (the picks still reach a deleted program). Plan exit 0,
    `failed: []`, 8 calls / 43 s wall; no progress line contains `failed`; both not-found lines word for word; step 2
    says the lines are progress only. F-479 VERIFIED.
- R2 (F-480). In the walk's report, copy the footer's `Re-run:` code span exactly and run it.
  Pass bar: the span holds a command and nothing else; it runs (exit 0) and writes a second report beside the first,
  pulling nothing; the explanation that it pulls nothing is in the header's snapshot line.
  - Tester, 2026-10-04 @ hb-20261004-03: PASSED. The footer is `Re-run: ` plus one code span; its bytes, extracted by
    script and run through bash, parse and exit 0, writing a second report beside the first; no new pull working
    directory; the header's snapshot line carries the explanation. F-480 VERIFIED.
- R3 (F-481). Read the walk's step-6 block and the step-4 summary.
  Pass bar: the `Caveats:` line is `<caveatCount> — ` followed by the summary's `leadCaveats` entries, as written,
  joined with `; `; the tester chose nothing. Run step 4 again on the same snapshot (`--snapshot`, no pull): the
  second summary's `leadCaveats` equals the first's.
  - Tester, 2026-10-04 @ hb-20261004-03: PASSED. The step-6 Caveats line was `caveatCount` plus the two `leadCaveats`
    joined with `; `, nothing chosen; step 4 run again over the same snapshot gave equal `leadCaveats` and
    `caveatCount` (compared by script). Walk: plan 8 calls / 43 s, pull 36 calls / 269 s wall against an estimate of
    35 calls / 327 s; no step made the walk stop or guess. F-481 VERIFIED.

### Result — V2 first sitting @ hb-20261010-01 (tester, 2026-10-10; dev clean and level at c758021, the S4c branch merged; canary matched; production tenant, reads only, one call at a time; paused by Bradley to finish in V2.5, which continues from this block)

Section status: CLEARED (second sitting, 2026-10-11 @ hb-20261010-01: X4, X7, X8, X9 PASSED; results below the first sitting's). Inputs as banked, except the pull's program set: Bradley chose the FULL set
(every program with sends in the window, 195) over the three picks for the skill walk, so T1's gap-fill ran over the real referenced
set and the dashboard's snapshot has text for every template.
- X0 PASSED (deviation: the full set; the workbook written with openpyxl rather than the xlsx skill, five sheets). The skill planned first
  (35 calls / 267 s, stated in one line), raised the template gap-fill ask (278 planned, 834 s), ran email-report's three commands on
  Bradley's "fill all" (278 documented, 0 failed, 556 s), re-issued the plan (planned 0), pulled with the same run (36 made + 10 reused,
  exit 0, reconciled), wrote the report and the final block in the literal shape; every call a read; no payload read into the session.
- X1 PASSED: "Not included", the accounts-off reason in words, `--accounts` named; no table, list or zero; Accounts reached on every
  row; Participant records a dash on 65 of 65 rows with the note and `--step-detail`; both caveats present.
- X2 PASSED: four direct counts through the spike's runner from the glossary alone (object, standing filters, date field, the flag values,
  the distinct person path) equal the one-program one-month report row on Sent, Delivered, Opened and Unique recipients; the open rate
  equals Opened ÷ Delivered to one decimal.
- X3 PASSED: Bradley's UI read of the program's four email steps (survey, reminder, send, send 4) against the report's three template
  rows: the two named steps match by name and order and the third template reads "(on 2 steps)", the two send steps.
- X4 NOT RUN (V2.5): the account-level walk with `--accounts --step-detail --xlsx` (about 40 minutes of token).
- X5 PASSED: Survey participants, Submitted and Partially submitted equal the program's analytics page as Bradley read it today
  (548 / 67 / 36); the page's 2 extra submissions are internal test responses, which the rule leaves out; the section says all time.
- X6 PASSED: the report's Data pulled time sits inside the run step's wall clock (one second after the step began; the plan ran 20
  minutes earlier), so the F-482 clause holds; every click cell equals the snapshot's state (65 program rows, 119 template rows: a
  number when tracked, "Not tracked", a number with "(tracking unknown)"); the caveats name the incomplete period, opens, content links,
  CC copies, other sources and the deleted program with counts.
- X7 NOT RUN (V2.5): `--previous` over this sitting's report snapshot.
- X8 NOT RUN (V2.5): the plain question in a fresh session.
- X9 NOT RUN (V2.5): the ask before a long pull, plan only.
- Also measured: the plan's `token.fits` judges the pull alone, not the gap-fill it quotes beside it (F-507).

Second sitting (2026-10-11, the same token; the session resumed in a terminal with --plugin-dir, cwd the repo; two re-logins):
- X9 PASSED on its bar: with no selector and --accounts the plan read 195 programs / 299 calls / 2115 s; the skill stated it in one line
  and asked before pulling, offering the pull as planned, --sent-since 90d, or stop. Deviation of record: Bradley chose the pull over
  the banked stop; it ran in the background as the skill says (315 made + 11 reused, 76 split, 0 retried, 2080 s wall against 2115
  planned, exit 0, four reconciliation checks ok, pulled-at one second after the run began; 65 shown of 195; a watch list for 55
  programs). Every call a read; no guard drawn (see the Walk line: unguarded by cwd).
- X7 PASSED: `estimate.mode` selective ("months before 2026-09 are carried from the snapshot pulled <X0's time>"); the report header
  says selective and names that time; the caveats block lists the eleven carried months and the time; for one closed carried month
  Sent, Unique recipients, Delivered, Opened and Open rate are equal on every cell for the three picks across the two snapshots, the
  new rows marked carried; the two re-read months equal as well. 25 made + 10 reused, 0 retried, 188 s, exit 0. Bar defect: the
  comparison names --from/--to reports via --snapshot, but the report script takes no month window (those are pull flags); the month
  was compared through the engine's runQuery over both snapshot files, Z3's method.
- X8 PASSED, in a fresh workspace session Bradley opened, the question typed with no slash command: this skill ran (not email-report),
  report mode, 1 of 573 programs selected, "Plan: 1 program, 25 calls, ~3 minutes. Pulling now." stated before the pull (Bradley's
  report), and the answer quoted the report's Programs row as written (the row read from the file).
- X4 PASSED (invoked by the tester session, as X0 was; not a fresh session in the strict sense): the estimate stated before the pull
  (3 programs, 75 calls, 547 s, background); the watch list present for all three programs with a low-engagement and a deliverability
  table each; the minimum delivered (10) stated; every low-engagement row at 40 delivered or more; no "All other accounts" or "No
  company link" row (the one hit is the glossary's sentence); the pick, fixed before reading as the first row of P-busy's low-engagement
  table, equal to three direct counts through the spike's runner filtered on the company over the window (Sent, Delivered, Opened);
  Emails by step present with step and variant names (10 rows); Participant records numbers on all three rows; the workbook holds
  seven sheets (openpyxl under the xlsx skill; the first sitting's script). 77 made + 12 reused, 0 retried, 480 s, exit 0, five
  reconciliation checks ok; the pulled-at one second after the run began (X6's clause on X4's report holds).


## HLT-1 / DSH-1 / DSH-5 — health facts on a real tenant with masking holding on real messages, grouping by program characteristics and by folder or name, and a spec export / import round trip (banked 2026-10-04, builder, Session S3; verdict at V2)

Owed by: V2, the batched verdict session after S4c, in the consumer workspace with the plugin loaded from `dev`
(the PR for `feat/jo-dash-s3-health-spec` merges on green CI plus its review round, before V2).
Token: none yet. `dev-utils handoff` refused to mint one for this branch on 2026-10-04 (the bus header names an
earlier token of the same day in another round's text), and the refusal was recorded, not worked around. This
section is keyed to the token the branch's next handoff mints; the PR is #39.
Why it is banked: the health facts, the spec writer and the grouping resolver were built offline against the
fictional tenant and the stand-in CLI. What a real mail service writes into a bounce reason, what shape a failed
participant's reason arrives in, whether the participant object's group-by returns or times out, and whether the
grouping rules read sensibly on real program names and folders cannot be measured without a tenant.
Tenant: the S1-V tenant (production reads are allowed once `gs-admin whoami` confirms it). Every call is a read.

THIS LIST IS COMPLETE. It is everything this round judges for HLT-1, DSH-1 and DSH-5; a check that is not here is
not owed, and a thing the round thinks should be here is a finding. Nothing is "noted on the verdict": anything
observed beside a pass bar becomes an F-section on the bus, or a GitHub issue, before the round closes.

Picks and inputs, settled before the first call: the tenant's internal domains and unsubscribe links, P-busy and
P-survey from the S1-V rounds, and one closed month `<M>` (all in the consumer workspace,
`.gs-superadmin/tmp/s1v-picks.md`; tenant data, never copied here). Before Y9, Bradley names two folder ids with the
label each should carry, and says whether program names follow a separator convention. `<common>` stands for every
`--internal-domain` and `--unsubscribe-link`, once each. No pick, id, name, count or message text is copied into
this file or the bus: results are recorded as passed or failed, ratios and orders of magnitude.

- Y0 (the contract, before any call). Bradley reads the executor's choices in the plan's As-shipped (S3) notes
  under HLT-1, DSH-1 and DSH-5 and rules on each: health facts off unless `--health` is passed; messages at
  template grain even with step detail on; schedules read from the KB, not live; participant failures all time;
  the spec's `health.silentDays`, `purpose` and `tenantHost` fields and its `save` and `list` verbs; one rule per
  level with `within`.
  Pass bar: each is confirmed or overruled before T-11 has a second reader (S4a). An overrule that removes or
  re-types a field is the builder's change before S4a starts.
  RULED (Bradley, 2026-10-04, at S4a's kickoff, before any S4a code): every choice is confirmed or refined, and
  none removes or re-types a T-10 or T-11 field. The rulings are in the maintainer's plan, each headed "Rulings
  (Bradley, 2026-10-04, at S4a's kickoff)" under HLT-1, DSH-1, DSH-5 and DSH-2; this file points there and copies
  none of it. One is an additive overrule (the reporting window may also be fixed, or since a date). What the
  rulings add to this round is in Y1, Y2, Y6 and the spike arm below; what they ask of later builds is in the plan.
- Y1 (health facts on a real tenant). `engagement.mjs plan <common> --health --kb <slug> --run v2-health`, then
  `run` with the same flags and `--out <slug>/reports-adhoc/v2-health.json`.
  Pass bar: exit 0 with `ok: true`; `health.pulled` true; every part of `health.parts` is either pulled or carries
  a reason, and a part that is not pulled has an empty table and a `health-incomplete` caveat naming it. The pull's
  health calls are within 2x of `estimate.health.addsCalls` (read both from the summary and the fetch log's
  `health-` records). Record the health calls made, their seconds, how many split, and which parts were not read.
  The same pull without `--health` (plan only) plans exactly `addsCalls` fewer calls.
  Added by the Y0 rulings, BEFORE the pull: one server-side COUNT of `ao_failed_participants` rows for the
  selected programs (no rows read), through the spike's catalog-checked runner. The pull reads that object as
  plain rows, 50 programs a call, and its size on a real tenant has never been measured. Pass bar: the count's
  order of magnitude is recorded, and the pull's `health-reasons` calls and seconds are in proportion to it (pages
  of 5000). A count that makes the plain-row read a matter of minutes or more is a finding, not a pass.
  FAILED (spot check @ hb-20261004-04, tester, 2026-10-05; production, reads only; pass bar as written above).
  Count first, through the spike's runner, before the pull: `ao_failed_participants` holds order 10^6 rows for the
  194 selected programs. A second count, grouped by program (same object, same filter), shows 190 programs with
  rows, one holding 89% of them and 9 over one 5000-row page, so the plain-row read takes minutes and cannot
  finish (F-484). The pull (run `spot-health`, the plan's flags; resumed once with `--today` set to the plan's
  date after the day turned, F-483): exit 0, `ok: true`, reconciled, 226 calls (82 split, 2 retried), 1954 s.
  `health.pulled` true; four parts read; `participantFailures` not read, its table empty, the `health-incomplete`
  caveat naming it (its reason reads `call-failed`; the run's status file records the nine units as truncated).
  Health calls 187 / 1400 s against `estimate.health` 24 calls / 204 s (7.8x the calls): `health-bounce` 73
  against 15 (29 full pages split), `health-reasons` 109 against 4 (61 full pages; 9 units with nothing left to
  split on), `health-days` 1, `health-states` 4 (no timeout). Outside the 2x bar: F-476 reopened. Not measured:
  the plan without `--health` was not re-run (the plan's own by-family list gives 59 - 24 = 35, the figure S1b's
  W1 measured; arithmetic, not this clause's measurement).
- Y2 (masking holds on real messages). Over Y1's snapshot and Y1's run directory, by script: search every
  `facts.health` message, and every payload file of a `health-bounce` or `health-reasons` call, for an `@`, a run
  of five or more digits, and an IPv4 address.
  Pass bar: zero hits in the snapshot and zero in the payload files (the raw text never reached disk). Then Bradley
  reads the twenty most frequent masked bounce messages and every participant-failure message: none names a
  person, an address or a record, and each still says what went wrong. Record the ratio of distinct masked bounce
  messages to bounced attempts (grouping works when it is far below 1) and any text a rule should have caught and
  did not (a finding, with the pattern described, never quoted).
  Added by the Y0 rulings (failure categories and the "expected" class): Bradley marks the most frequent reasons,
  bounce reasons and participant-failure reasons alike, each as one of: a reason whose text carries a value and so
  needs collapsing to a category; a failure that is expected by design; a real failure that is already clean. For
  every reason marked for collapsing, its EXACT wording up to the value is captured into the consumer workspace
  (tenant data: never into this file, the bus or the repo), because the category patterns are written from the
  captured text and never from memory. Pass bar: the marked list exists in the workspace with the wording of each
  candidate category complete (none cut off), and the count of rows the "expected" reasons account for is
  recorded as an order of magnitude.
- Y3 (the failed-participant reason's shape, which the build assumed). One direct read of five plain rows of
  `ao_failed_participants` showing `FailureReasons`, through the spike's catalog-checked runner, scrubbed: record
  the cell's SHAPE only (text; JSON array; an object; the `{type=json, value=…}` wrapper).
  Pass bar: Y1's `participantFailures` messages are sentences a person can act on, not JSON text and not a key
  dump. A shape `readFailureReasons` reads as one opaque blob is a finding.
  CLEARED for the shape (spot check @ hb-20261004-04, tester, 2026-10-05; production, reads only): five plain rows
  through the spike's runner (scrubbed copy kept with the maintainer's spike shapes). Each `FailureReasons` cell is
  PLAIN TEXT in the usual `{v, fv}` pair: not JSON, no `{type=json, value=…}` wrapper, no array, one reason per
  cell in all five. `readFailureReasons` over the five raw cells returns one product sentence each, a person can act
  on every one (two carry a `{null}` value marker). The half judged on Y1's `participantFailures` messages is
  unmeasured: that part was not read (F-484). Blind spot: five rows; a cell holding several reasons was not seen.
- Y4 (bounce reasons reconcile). In Y1's snapshot the reconciliation check `bounce-reasons-sum-to-bounced` is ok
  with no closed-month mismatch. For P-busy and `<M>`, one direct count of `IsBounced = YES` attempts equals the
  sum of that program-month's `bounceReasons` counts.
- Y5 (send failures, counted once). For P-busy and `<M>`: three direct counts (`IsBounced = YES`; `IsRejected =
  YES`; both) give bounced + rejected - both, which must equal the snapshot's `failed` for that program-month, and
  the report's error rate is that over Sent. Record whether any attempt on the tenant carries both flags (if none
  does, say so: the union is then unexercised here).
- Y6 (silent programs). `silentPrograms` over Y1's snapshot at 30 days (a node one-liner over the snapshot file).
  Pass bar: Bradley recognises the list: every program on it is Active and has not sent in 30 days, and no Active
  program he knows to be silent is missing. For two programs on it, a direct program x day read of the last 90
  days shows no later send. An Active program with no send in the window at all is on the list with no dates.
  Added by the Y0 rulings (what "stopped working" means). Over the build that carries the cadence-aware rule:
  Bradley reads each list it produces, and every one must read true to him: "Possible silent failure" (a recurring
  schedule was due and nothing was sent since; a quarterly program is not on it at 30 days), "Schedule run failed",
  "No recent sends" (a program judged against its own history: the starting rule, which this read is the judge
  of), "One-time and ad-hoc programs" (never on a silent list, each with its last send, the months it sent in and
  its templates), and Active programs with no send in the window, listed apart from the alarms. Two reads besides:
  whether a schedule's start and end dates are in the `jo p describe` payload (an ended schedule must not read
  as broken; record the field names and shapes only), and whether any tenant-wide reportable object holds
  schedule or query run results (record its API name and field types, or that none was found).
- Y7 (participant states and failures). For P-survey: a direct group-by of `ao_participants` by `ParticipantState`
  equals the snapshot's `participantStates` rows, and a direct count of its `ao_failed_participants` rows equals
  the sum of its `participantFailures` rows' participants when every row carries one reason (when rows carry
  several, the sum is larger: record which holds). Record whether any `health-states` batch timed
  out, and that a timed-out batch made exactly two attempts and left the part marked not read.
- Y8 (schedules, from the KB). For one program whose schedule Bradley can see failing or healthy in the Gainsight
  UI: the snapshot's `schedules` row reads the same `lastRunSuccess`, with `asOf` the date its KB doc was last
  verified, and the `schedules-from-kb` caveat is present. A program with no full KB doc has no row. If the KB is
  stale against the UI, that is the caveat working, not a failure; record the age.
- Y9 (grouping by program characteristics). `dashboard-spec.mjs draft --kb <slug> --slug v2-groups`, then `set`
  `groups.rules` to: a supergroup rule on `sendsSurveys` true, one on `audience` USER, one on `recurring` true and
  one on `recurring` false; a group rule on each survey model inside the survey supergroup. `save`, then
  `dashboard-groups.mjs suggest-input --snapshot <Y1> --out <tmp>` and `resolve --snapshot <Y1> --spec <saved>`.
  Pass bar: the summary line and counts print and no program name reaches stdout; Bradley checks ten assignments
  against the Gainsight UI, a Dynamic Program that sends a survey among them (it must read as sending surveys);
  the count of programs whose `recurring` is unknown equals the programs with no full KB doc; nothing is assigned
  on a guess. The suggestion file is small enough to read (record its size) and holds no account or address.
- Y10 (grouping by the tenant's folder ids, or by a naming pattern). `draft` again over the saved spec; `set` a
  folder rule with Bradley's two folder ids and labels, and, if names follow a convention, a name-segment rule;
  `save`; `resolve` with `--previous <an earlier snapshot>`.
  Pass bar: every program of those two folders is in the labelled group and no other program is; a folder given
  no label reads "Folder <id>"; the line reads "N new programs ungrouped" with N the ungrouped programs the
  earlier snapshot did not hold; a program no rule reaches is in "Ungrouped".
- Y11 (a spec export / import round trip). `export --slug v2-groups --out <tmp>/v2-groups.export.json`; copy the
  prod KB's `_manifest.json` into a scratch folder and `import` there; then `import` into the sandbox's KB folder.
  Pass bar: the imported `spec.json` is byte for byte the original; the export file holds no path of the machine
  (search it for the user profile path and a drive letter); the sandbox import is refused naming both tenants and
  writes nothing; a second import over the first is refused without `--replace`.
- Y12 (the spec in words). `show --slug v2-groups`.
  Pass bar: every setting reads as a sentence a person who has not seen the spec can follow; the group rules read
  in their order with their labels; nothing is described that the spec does not hold. Wording Bradley would
  change is a polish finding with the sentence's label, not its text.

Spike arm (added by the Y0 rulings; reads only, shapes and orders of magnitude only, through the catalog-checked
runner; answers go to the maintainer's spike notes, never here). Whether participant failures can be dated, tried
in this order, stopping at the first that holds:
- (p1) A failed-participants HISTORY object: one row per occurrence, with a date. Confirm its API name, its field
  types, whether its failed-participant id is a declared LOOKUP that walks to the program, its row count for the
  dashboard's window, and how far back it keeps rows. It is usable only COUNTED server-side and windowed (never
  read as rows): one count by month, and by program through the lookup with the null-lookup rows counted apart.
  If the id is plain text, only tenant-wide counts by month and type are possible; record which.
- (p2) Else `ao_failed_participants`' last-updated date as a "last seen": is it on every row, does it move with
  `OccurrenceCount`, and was it ever set in bulk (one date on most rows)?
- (p3) Else participant failures stay all time, with the page saying so wherever the figure shows.
Participant states (`ao_participants`) are expected to stay all time whichever holds.

### Re-banked for V2 after the S3b health batch (builder, 2026-10-07, feat/jo-dash-s3b-health-batch @ hb-20261007-02, PR #43)

Y0 was RULED at S4a's kickoff and Y3 CLEARED at the spot check; both stand. Y4, Y5, Y7, Y8, Y9, Y10, Y11 and Y12
stay owed as written above. Y1, Y2 and Y6 are REPLACED by the versions below (the S3b batch changed what they
measure: failure reasons are counted by category, the silent rules are cadence-aware, the schedule rides the program
dimension). Y13 to Y16 are new. The two reads the batch was gated on were made in the build session on 2026-10-07
with Bradley's live token (reads only, through the spike's catalog-checked runner); their results are stated where
the check depends on them, and V2 re-measures nothing it does not need to.

- Y1 (health facts on a real tenant, count first). `engagement.mjs plan <common> --health --kb <slug> --run v2-health`,
  then `run` with the same flags and `--out <slug>/reports-adhoc/v2-health.json`. The shipped category list is
  empty, so pass none; the read that gates categories was made at S3b: a CONTAINS, DOES_NOT_CONTAINS or
  STARTS_WITH filter on `ao_failed_participants.FailureReasons` is refused by the server ("Unrecognized data type
  found in Filter or Ranking fields"), and `rp schema` declares the field (every JSON-path field of that object)
  `filterable: false, groupable: false`; CONTAINS on `email_log_v2.BouncedReason` returned in a plain count and in the
  grouped shape the batch uses, with DOES_NOT_CONTAINS its complement (one month, no null reason among its
  bounces). FIRST clause, before the pull: the plan's own count-first reads replace the spike-runner count of the
  spot check — record `estimate.health.failedParticipantRows` (an order of magnitude) and `estimate.rowBudget`.
  Pass bar: exit 0 with `ok: true`; `health.pulled` true; every part of `health.parts` is either pulled or
  carries a reason (`too-large`, `call-failed`, `no-schema`, `no-kb`, `not-in-previous`), with its `basis`;
  `participantFailures` IS read (one row per program, category other, participants and occurrences; its
  `meta.health.categories` entry reads `counted: false, reason: not-filterable`); `bounceReasons` rows are all
  category `other` with no message (no list was passed) and sum to the send tables' bounced (the check is ok in
  closed months); `failureSamples` holds at most five masked texts per program and part. The pull's health calls
  are within 2x of `estimate.health.addsCalls` (read both from the summary and the fetch log's `health-` and
  `schedule-describe` records); record the health calls made, their seconds, how many split, which parts were not
  read, and the whole run's calls against `estimate.thisRun` (the click families are now priced from a count).
  A health part refused as `too-large` is recorded with the rows the estimate saw; it is a pass only if the rows
  really exceed `rowBudget.rows`.
  CLEARED (S3b verdict round @ hb-20261007-02, tester, 2026-10-07; production, reads only; pass bar as written above).
  First clause: `estimate.health.failedParticipantRows` order 10^6; `estimate.rowBudget` 40 pages of 5000, nothing
  over it. Plan 14 calls; run exit 0, `ok: true`, reconciled (all four checks, 0 mismatches), 71 calls made and 13
  reused, 0 split, 556 s. `health.pulled` true; all six parts pulled with their basis (window, all-time, all-time,
  lookback, as-documented, sample); none refused. `participantFailures` read: one row per selected program with
  failures (order 10^2), every row category other with participants and occurrences and no message; the categories
  entry reads `counted: false, reason: not-filterable`. `bounceReasons` order 10^2 rows, all category other, no message;
  `bounce-reasons-sum-to-bounced` ok. `failureSamples` at most 5 per program and part (bounce part only: see Y2).
  Health calls 36 (35 in the run plus the count-first `health-reasons-total` made at the plan) against
  `estimate.health.addsCalls` 40 (0.90x); about 153 s against 219; nothing split; no part unread. Whole run 71 / 556 s
  against `estimate.thisRun` 75 / 546 s; the click families 7 against 7. F-476 VERIFIED.
- Y2 (masking holds on real messages; the category capture). Over Y1's snapshot and run directory, by script:
  search every `facts.health` message and sample, and every payload file of a `health-bounce-sample` or
  `health-reasons-sample` call, for an `@`, a run of five or more digits, an IPv4 address, a word with an `@` and
  NO dot after it (the gap the email rule has: `bob@localhost`, a bare login), and the value after "Invalid value".
  Pass bar: zero hits of the first three in the snapshot's rows and the payload files; hits of the last two are
  recorded as counts (they are what the categories exist to cut) and are a finding only if they reach a row that
  is not a sample. Then Bradley reads `facts.health.failureSamples` (the terminal, never a page): the bounce
  samples and the participant-failure samples per program. THE CAPTURE: for every sample that carries a value
  (an address, a field name, a number), Bradley marks it, and its EXACT wording up to the value is captured into
  the consumer workspace as a `--failure-categories` file ({id, label, pattern, definition}; tenant data until it
  is judged product text); for every sample that is expected by design, its wording goes to `--expected-reason`.
  Pass bar: the file exists with no wording cut off; a second pull with it passed (Y1's flags plus
  `--failure-categories <file>`) is a full refresh that says the categories changed, its category rows carry the
  labels, the "Other" share per program is recorded as a percentage, and no "Other" row counts below zero (a
  negative one is the overlap caveat and a list defect). What of the captured list is product text with no
  tenant value is Bradley's call; only that may ship.
  FAILED on the participant half (S3b verdict round @ hb-20261007-02, tester, 2026-10-07; production, reads only).
  Search, over Y1's snapshot and run directory and again over the second pull's: zero addresses, five-digit runs and
  IPv4 addresses in the snapshot rows and in both sample payload files; the local-address pattern 0; "Invalid value"
  once, in the participant sample PAYLOAD only (its program never reached the snapshot). The bounce samples: order
  10^2 rows over a quarter to a third of the programs with bounces (first and second pull), read in the terminal by Bradley; 98 distinct texts. THE
  CAPTURE: a 30-category file drawn verbatim from those texts (each pattern the wording up to the first value; none
  holds a value or a placeholder; the plugin's validator clean; 82 of the 98 matched by exactly one pattern, checked
  case-sensitively and case-insensitively), accepted by Bradley as his marking; in the workspace, tenant data until
  judged. Second pull with it: a full refresh saying the categories changed; every category row's message is its
  label; no Other row below zero and no overlap caveat; 29 of 30 categories counted; the Other share per program
  median 30%, quartiles 18% and 50%, range 0 to 100% (overall about 44%); the sum check ok. The participant half
  FAILED: `failureSamples` held no participant-failure sample for any selected program (the sample is one tenant-wide
  page, and all of it was one program outside the selection), so there was nothing to read, no participant wording to
  capture and no `--expected-reason` to name; F-484 REOPENED. Which of the captured list is product text that may
  ship is not yet ruled (Bradley's call; the file stays in the workspace).
- Y6 (the silent lists). `silentPrograms` over Y1's snapshot at 30 days (a node one-liner over the snapshot file),
  printing `lists` by id. Pass bar: Bradley reads each list and every one must read true to him: "Possible silent
  failure" (a recurring schedule was due and nothing was sent since; a quarterly program is not on it at 30 days;
  each row names its last due day and the live last-run result, "last run succeeded" where it was); "Schedule run
  failed" (the live read said so); "No recent sends" (event-driven, hand-fed and unknown programs against their
  own history — THE STARTING RULE, which this read is the judge of: a program that sends fewer than half the
  closed months is late only past its longest gap between send months, one that sends most months or has under
  three months of history is late at the flat threshold); "One-time and ad-hoc programs" (never on a silent list,
  each with its last send, the months it sent in and its templates); "Cannot judge: period longer than the
  window"; and "Active, no sends in this window", apart from the alarms. For two programs on an alarm list a direct
  program x day read of the last 90 days shows no later send. `honesty.health.schedules` records how many were
  flagged and read live (the cap is 25); the `schedules-from-kb` caveat names the same figures. Two reads besides:
  whether a schedule's start and end dates are in the `jo p describe` payload (an ended schedule must not read
  as broken; record the field names and shapes only), and whether any tenant-wide reportable object holds
  schedule or query run results (record its API name and field types, or that none was found).
  FAILED (S3b verdict round @ hb-20261007-02, tester, 2026-10-07; production, reads only): the lists do not read
  true. At 30 days: possible-silent-failure 6, schedule-run-failed 25, no-recent-sends 3, ok 30, one-time 0,
  no-sends-in-window 0, cannot-judge 0; `honesty.health.schedules` flagged 31, read live 25 (the cap), 0 failed, and
  the `schedules-from-kb` caveat names the same. "Schedule run failed" holds every program read live, and on every
  live-read schedule the run-state is unset (`lastRunSuccess` false with `lastSuccessTime`, `lastFailureTime` and
  `failingSince` 0); Bradley checked two in the UI — each runs daily as expected, its recent participants failed only
  as already in the program. Two schedules ended weeks ago and read failed. "No recent sends": Bradley reads all three
  as finished one-off campaigns left Active. "Possible silent failure" includes a program the settled picks record
  as sending monthly on the 1st, six days after its send (daily ingest crons read as send cadence). Two programs on
  the run-failed list, read direct (program x day, last 90 days): the last send day equals the snapshot's, no later
  send. Describe payload: the schedule objects sit in `data.advancedOutreach.participantSourceConfigurations[]
  .scheduleInfo`, a JSON STRING holding `schedules[]`, each with `startTime` and `endTime` (epoch-ms numbers) beside
  `lastRunSuccess` (boolean), `lastSuccessTime`, `lastFailureTime`, `failingSince` and `nextRunTime` (numbers); not
  every describe carries it. Tenant-wide run results: `ao_participant_source_configuration` holds `LastSyncedOn`
  (DATETIME) per participant source, with `AdvancedOutreachId` (STRING), `GsAdvancedOutreachId` (LOOKUP),
  `ParticipantSourceType` (STRING), `RefreshPowerlistFlag` and `ActiveVersion` (BOOLEAN) — a last-sync time, no
  success or failure field; `participant_criteria_step_execution` holds branch evaluations, not runs. F-491 logged.
- Y13 (the lookback, derived). `estimate.health.lookback` from Y1's plan: `longestPeriodDays` among the selected
  programs' schedules, `programsBeyondWindow` and `unreadableCrons`. Pass bar: the longest period reads as the
  program Bradley knows to run least often (quarterly on this tenant); with the default 90 days that program is
  on the "cannot judge" list; a second plan with `--health-lookback-days` above its period plans the same calls
  plus the longer day read and, after its pull, judges that program by its cadence. `unreadableCrons` is 0, or
  each unreadable expression is recorded (shape only) as a finding for the calculator.
  CLEARED for the arms this tenant has (S3b verdict round @ hb-20261007-02, tester, 2026-10-07): `lookback` = days 90,
  `longestPeriodDays` 30, `programsBeyondWindow` 0, `unreadableCrons` 0. Every cron in the KB is daily, weekday,
  weekly or monthly; the program named as quarterly carries a monthly cron, and Bradley confirmed it runs monthly by
  design and takes participants quarterly, and that monthly is the least frequent schedule he knows. The pull judged
  that program by its monthly cadence (rule cadence, period 30). NOT measurable here: a program beyond the 90-day
  window on the cannot-judge list, and the second plan above its period (no period exceeds the default window);
  owed to a tenant that schedules something less often than the window. (That a monthly ingest cron is judged as a
  monthly send cadence is F-491's, not this check's.)
- Y14 (the schedule rides every pull with a KB). A pull WITHOUT `--health` but with `--kb` (the open-rate report's
  own pull): every `dimensions.programs[].schedule` is filled for a program with a full KB doc (classification,
  cron, zone, as of the doc's date), "no schedule captured" for a documented program with none, and null for a
  program the KB has no doc for; `dashboard-groups.mjs resolve` over that snapshot with a `recurring` rule assigns
  the same programs as over Y1's snapshot (Y9's rule). `dimensions.templates[].uses[].asOf` is the doc's date and
  the `step-names-as-of` caveat names the oldest. Pass bar: the counts of programs per schedule classification
  equal those of Y1's snapshot, and the program with no doc reads null, never "no schedule".
  CLEARED (S3b verdict round @ hb-20261007-02, tester, 2026-10-07; production, reads only). The pull with `--kb` and no
  `--health`: exit 0, reconciled, 45 calls / 493 s against its plan's 35 / 327 s (exactly `addsCalls` 40 below Y1's
  75). Classification counts identical to Y1's (recurring, "no schedule captured" and null: order 10^2, 10^1 and
  10^1), and every program's `schedule` object identical between the two snapshots; the null count equals
  `honesty.health.schedules.programsWithout`, the other two sum to `programsWithDoc`. `dashboard-groups.mjs resolve`
  with a recurring-true and a recurring-false supergroup rule (a scratch spec in the workspace): identical supergroup
  counts over both snapshots, the no-doc programs Ungrouped. `uses[].asOf`: every use on a program with a full doc
  equals that doc's `last_verified` (order 10^2 uses), every other use null; the `step-names-as-of` caveat names the
  oldest `last_verified` of the selected full docs and their count.
- Y15 (test accounts, server-side). Bradley names one or two test COMPANY records by id (tenant data: the
  workspace picks file). Y1's flags plus `--test-account <id>` each, a full refresh (the snapshot says the test
  accounts changed). Pass bar: the test accounts' sends are in the internal class (the program's internal rows
  grew by `honesty.testAccounts.sent`, the external rows shrank by the same, the totals unchanged), a test contact
  on an internal domain is counted once (the overlap call is in the fetch log), external unique recipients fell
  by the people of those accounts and no further, the no-company-link rows are unchanged (NOT_IN keeps them: the
  read made at S3b over the whole window, IN plus NOT_IN equal to the plain count with order 10^4 null rows), and
  `meta.params.testAccounts` echoes the ids sorted.
  CLEARED (S3b verdict round @ hb-20261007-02, tester, 2026-10-07; production, reads only; two company ids named by
  Bradley, kept in the workspace picks file). Y1's flags plus both `--test-account`s and `--previous` Y1's snapshot:
  the plan says mode full, "the test accounts changed"; exit 0, reconciled, 92 calls against 84. `meta.params.
  testAccounts` echoes both ids, sorted. Sends moved between classes exactly: internal grew and external shrank by the
  same order-10^3 count, total sent unchanged, and per program x template x month (order 10^3 keys) internal growth
  equals external shrink on every key with no total changed. The overlap calls (`test-internal`, one per internal
  domain, for the send and click families and the bounce total) are in the fetch log, and a test contact on an
  internal domain is counted once: `honesty.testAccounts.sent` counts ALL the accounts' sends, and the internal rows
  grew by that less the overlap calls' sum (order 10^2) — the bar's "grew by `honesty.testAccounts.sent`" holds once
  its own counted-once clause is applied. External distinct counts: accounts fell by at most 1 per program, every program's all-recipients people count unchanged, external people fell by a
  figure within 1% of the sends moved, which bounds out any loss of the order-10^4 no-company rows NOT_IN keeps.
  Totals beside sends: the previous, closed month moved by a handful of bounces and one unsubscribe between the two
  pulls (late flags, tenant data; F-493).
- Y16 (the run clock). Y1's plan and run were one `--run`: the snapshot's `meta.pulledAt` is at or after the plan's
  end and at or before the first fact call's record in the fetch log (the day buckets and templates, not the
  cheap calls), and `run.json` holds the same stamp; the report's "Data pulled" line reads it. If the round
  crosses midnight between plan and run (or resumes after a login past midnight), the run continues with no
  `--today` and the snapshot's day is the plan's. Pass bar: one stamp everywhere, inside the fact calls' span; a
  resume across midnight needs no flag.
  CLEARED (S3b verdict round @ hb-20261007-02, tester, 2026-10-07; production, reads only). After Y1's plan `run.json`
  read `pulledAt: null`; after the run one stamp sits in `meta.pulledAt`, `run.json`, all order-10^3 fact rows, the
  live schedule rows' `asOf` and the report's "Data pulled" line, 12 s after the plan ended and before the first
  fact call began (the fetch log has no times: a call's start is its call file's mtime less its logged duration).
  The round did not cross midnight; the crossing's code path was driven instead: a one-program run planned with
  `--today` set to the day before, then run with no `--today` — exit 0, the plan's day kept, its day-derived fields
  the plan's; the same with `--today` set to today refused before any call ("today moved"). F-482, F-483 VERIFIED.

### Re-banked for V2 after the S3b fix round (builder, 2026-10-07, feat/jo-dash-s3b-health-batch; the branch's next handoff token)

Y2's participant half and Y6 are REPLACED by the versions below (F-484's second fix reads the samples per program;
F-491's redesign replaced the cadence rules with signals). Y17 and Y18 are new. The build session measured the
shapes on 2026-10-07 (brief: `dev/S3B-FIX-ROUND-BRIEF.md`); V2 re-measures nothing it does not need to.

- Y2 (participant half, re-banked). Y1's flags: `failureSamples` holds participant-failure rows for EVERY selected
  program with refusals in the window (`entryFailures`), each read by its own call (`--order-by` ModifiedAt DESC,
  one program in the IN filter, the day window), never a tenant-wide page; `entrySamples` splits each program's
  sample by the shipped expected categories; `meta.health.samples.participantFailures` names what the cap left out
  (none at 25 on this tenant, or the exact programs with reason cap) and the plan printed `withFailures`,
  `planned`, `beyondCap` and `secondsBeyondCap`. Bradley reads the samples and the split per program: the
  expected ones read as business rules working, the null-address ones as data problems. Pass bar: no selected
  program with refusals lacks a sample unless named; the "Other" (uncategorised) share per program is small and
  its texts are product wordings not yet in the list (capture them into `--failure-categories`).
  FAILED (S3b fix-round verdict @ hb-20261007-03, tester, 2026-10-08; production, reads only), on F-484 (reopened a
  second time). The plan printed withFailures, planned, carried, beyondCap and secondsBeyondCap; every sample call
  names one program and one day window; `notSampled` names what the cap left out with reason cap; a three-program pull
  at `--sample-programs 1` named the other two. But the picks are ranked over the month window and read over the day
  window: 10 of 25 participant picks (17 of 25 bounce picks) came back with 0 rows, were counted as sampled and named
  nowhere, so programs with refusals in the window lack a sample without being named. Bradley read the 15 real
  samples' split (one program: the GlobalOptOut wording expected, the Bounced-recipient wording at Send Email misread
  as unexpected, F-491) and found a null-address wording dominant in the UI that no 100-newest page carried. Detail
  under F-484.
- Y6 (the lists, re-banked). `programHealth(snapshot).lists` over Y1's snapshot. Pass bar: Bradley reads each list
  and every one must read true to him — Schedule ended (a schedule past its end date; none expected on this tenant
  unless one exists), Participant sync disabled (the list's flag), Participant sync overdue (a daily ingest whose
  source last synced before its last due day — read the two programs with sync ages over 120 days measured at the
  build), Admitting nobody (zero admissions over the last 5 due days with an ingest that runs), Only refused
  participants arriving, Step errors this period (the programs whose participants carry the CTA-step wording or a
  SYSTEM_ERROR this month or last), No recent sends (own history), Finished campaign (one-offs with nothing in
  flight: the DRIPV2 programs synced once at creation), Working as expected. Record the counts per list and the
  signals of two programs per alarm list; for one program on each alarm list, Bradley's read of the Gainsight UI.
  The threshold: a second read of the lists with `--quiet-due-days 2` moves the admitting-nobody line as expected.
  FAILED (S3b fix-round verdict @ hb-20261007-03, tester, 2026-10-08; production, reads only), on F-491 (reopened: the
  model). Counts: schedule-ended 35, admitting-nobody 1, step-errors 6, no-recent-sends 2, finished 10, ok 11, every
  other list 0, order 10^1 Active programs judged. Read true by Bradley: admitting-nobody, finished, ok, one of two
  no-recent-sends, and the 20 schedule-ended programs whose every schedule has ended. Read false: 15 schedule-ended
  (an ended job schedule read over the live participant sync; Bradley's UI read and a live describe agree the sync
  runs to 2030), all 6 step-errors (bad-address drops at Send Email, which Bradley ruled a kind of their own: business
  rule, bad-address error, program error), and a quarterly-intake program on no-recent-sends. `--quiet-due-days 2`:
  admitting-nobody 1 -> 2, the expected direction, onto that same quarterly program (a false read). Bradley's words
  are recorded verbatim under F-491.
- Y17 (the heartbeat is the ingest). For five Active programs with a daily cron: `facts.health.sources[].lastSyncedOn`
  against the program's last run in the UI (date and time). Pass bar: equal to the day for every one; a program
  whose sync is older than its cron's last due day shows no newer run in the UI.
  CLEARED (S3b fix-round verdict @ hb-20261007-03, tester, 2026-10-08; production, reads only). Five Active daily-cron
  programs: `sources[].lastSyncedOn` equals the Gainsight UI's last run on 5 of 5, to the day and to the time (one
  also by a live describe the same day); Bradley: "these all look correct and are when execution finished, not
  started" — the field is the run's finish time. The second arm (a sync older than its last due day shows no newer
  run) has no instance: ingest-overdue is 0 on this pull; unexercised.
- Y18 (step failures by category). `facts.health.stepFailures` for the current and previous month, against a direct
  `rp run` COUNT of `ao_participants` with `FailureReasons IS_NOT_NULL` grouped by program and month (total), one
  CONTAINS per shipped pattern and the SYSTEM_ERROR state. Pass bar: identical per program and month; "other" is
  the remainder and never below zero; the platform-error months match the incident dates Bradley knows.
  CLEARED (S3b fix-round verdict @ hb-20261007-03, tester, 2026-10-08; production, reads only). Direct `rp run` COUNTs
  of `ao_participants` over the selected programs, grouped by program and month for the current and previous month
  (FailureReasons IS_NOT_NULL; one CONTAINS per shipped pattern; ParticipantState SYSTEM_ERROR): 95 of 95 cells (19
  program x month keys x 5 categories) equal `facts.health.stepFailures`; "other" never below zero. The tenant-wide
  total timed out server-side once; scoped to the selected programs, as the adapter scopes it, every count answered.
  The only platform-error month in the window matches an outage Bradley knows ("there was a huge outage in nov/dec of
  last year. programs had a lot of issues and most just were hard shut off"). The categories themselves are F-491's:
  the counts are right, the expected flag over them is not.
- Banked as measured, not owed: the server's CONTAINS is case-insensitive (four casings of one wording returned
  one count, 2026-10-07).

### Re-banked for V3 after the S3b fix round 2 (builder, 2026-10-08, feat/jo-dash-s3b-health-batch; the branch's next handoff token)

Y2's participant half and Y6 are REPLACED again by the versions below (F-484 redesigned: one window for the pick and the
page, the most repeated refusals first; F-491 tuned: the live schedule, a stale doc, three kinds, a too-new program).
Y19 is new (F-492's class test on the live wordings). The build session measured first on 2026-10-08 (three reads on
the live token, the rest offline over V2's snapshot; shapes in `dev/S3B-FIX-ROUND-BRIEF.md` § Round 2). Round type:
RE-VERIFICATION of F-484, F-491 and F-492 by their Judge lines plus these checks; nothing else is owed.

- Y2 (participant half, re-banked for V3). Y1's flags, a full pull. Pass bar, from F-484's Judge line: the plan prints
  `estimate.health.samples.participantFailures` with `withFailures` equal to the number of selected programs whose
  refusals have a ModifiedAt in the day window (a direct COUNT grouped by program over that window confirms it: 64 on
  2026-10-08); EVERY program in `meta.health.samples.participantFailures.programs` has `failureSamples` rows (no empty
  pick: the sample page and the count share one window object, so the fetch log's sample calls carry the SAME two
  ModifiedAt bounds as the `health-entry-window` call); `meta.health.samples.participantFailures.window` equals
  `meta.health.dayWindow` and `.counts` names exactly the programs with such refusals; a program with refusals in the
  per-month table but none in the day window is in neither `programs` nor `notSampled` and its entry signal reads
  `none-recent`; each sample call orders by `OccurrenceCount DESC`. Bradley reads the dominant program's split: the
  null-address wording he saw in the UI is now in its `failureSamples` (the most repeated page carried it on 75 of 100
  rows at the build) and its `entrySamples` split names it under `no-email` as a bad address.
  FAILED (S3b fix round 2 verdict @ hb-20261008-01, tester, 2026-10-08; production, reads only), on F-484 (reopened a third
  time; Bradley ruled it not deferred). Every structural arm held: `withFailures` 64 equals a direct COUNT grouped by program
  over the plan's day window and the selected programs, 64 of 64 with equal counts; `.window` equals `meta.health.dayWindow`;
  `.counts` names exactly those programs; every one of the 25 picks has `failureSamples` rows, the other 39 named with reason
  cap; month-only programs in neither list; the 25 sample calls carry the entry-window call's ModifiedAt bounds, one program
  each, ordered by `OccurrenceCount` DESC. The dominant program's sample carries the null-address wording Bradley saw (76 of
  100 rows), but as `Custom field contains Invalid value {null} for EMAIL data type`, which the shipped `no-email` pattern
  (`Recipient Email Address field contains Invalid value`) does not match: kind null in `failureSamples`, `other` /
  `program-error` in `entrySamples`. Detail and Bradley's words under F-484.
- Y6 (the lists, re-banked for V3). `programHealth(snapshot).lists` over Y2's pull. Pass bar, from F-491's Judge line:
  Schedule ended holds ONLY programs whose every documented schedule has ended AND whose source has not synced since
  (the 20 Bradley read true at V2), none of the 15 that carry a live participant sync beside an ended job schedule
  (each now reads by the live one: `dimensions.programs[].schedule.cronExpression` is the sync's cron and `endTime`
  its 2028–2034 end); a program whose documented schedule ended before its source's last sync is on Cannot judge yet
  with `signals.why` = doc-stale (none expected on this tenant after the refresh; if one appears, Bradley reads it);
  Step errors holds only programs with a program-error kind this period (`signals.steps.byCategory` names
  step-action-failed, platform-error or other, never a Send Email drop) — expected 0 or the platform-error programs
  of the current and previous month; the six V2 programs read `steps.state` none with `byKind` naming bad-address and
  business-rule; the quarterly-intake program is on Cannot judge yet with `signals.why` = too-new and
  `sends.firstSendMonth` 2026-08, NOT on No recent sends, and at `--quiet-due-days 2` it still reads admitting-nobody
  (the knob's definition: two monthly runs that admitted nobody; recorded, not a defect); every other list reads as
  at V2 (admitting-nobody 1, finished 10, no-recent-sends 1 — the weekly program Bradley called broken — ok the
  rest). Record the counts per list and Bradley's read of each list that changed.
  CLEARED on its bar (S3b fix round 2 verdict @ hb-20261008-01, tester, 2026-10-08; production, reads only); F-491 REOPENED
  nonetheless, on the Fix note's own claim. Counts: schedule-ended 19, admitting-nobody 5, step-errors 0, no-recent-sends 2,
  finished 15, cannot-judge 3, ok 21, every other list 0. Every list read true by Bradley: Schedule ended holds the programs
  whose one documented schedule ended with no sync since and none of the 15 live syncs (each now on its participant-sync
  schedule, ends 2028–2034); the doc-stale program reads No recent sends (precedence) and Bradley read it true; Step errors 0,
  the six V2 programs `steps.state` none with `byKind` bad-address (two with business-rule); the quarterly program on Cannot
  judge yet, too-new, first send 2026-08, and on Admitting nobody at `--quiet-due-days 2`; the lists that changed since V2
  (Admitting nobody 1 -> 5, Finished 10 -> 15, Cannot judge yet 0 -> 3, ok 11 -> 21) read true, Admitting nobody after one
  extra direct read of the new members' refusals. The reopen: a program with no KB doc reads ingest `one-time` and counts as a
  one-off for Finished from a default (a live describe shows a daily cron). Bradley's words under F-491.
- Y19 (the mask on the live wordings, F-492). The 30 bounce wordings Bradley accepted at hb-20261007-02 (the workspace
  file, never the repo) run through `maskMessage`: pass bar, every one equals itself (the leading-space entry trims,
  nothing else changes) — 11 of 30 changed at V2, 12 counting the trim; and the previous round's order-10^3 raw sample
  texts through the mask searched with the tester's own detectors (addresses, five-digit runs, IPv4): 0 addresses, 0
  five-digit runs, 0 IPv4; host names and URL paths are EXPECTED to appear (ruling 8). Bradley confirms or overrules
  hosts unmasked.
  CLEARED (S3b fix round 2 verdict @ hb-20261008-01, tester, 2026-10-08; workspace files, no gs-admin call). The 30 wordings:
  29 equal, 1 trim-only, 0 changed (rules email, uuid, ipv4, token, number). The hb-20261007-02 texts through the mask, the
  tester's own detectors: 0 addresses, 0 `@`, 0 IPv4, 0 five-digit runs; hosts and URL paths appear as ruled. A host with a
  digit in a label still masks whole to `<id>` (accepted in the Fix note). Bradley confirmed hosts unmasked as shipped; F-492
  VERIFIED.

### Re-banked for V4 after the S3b fix round 3 (builder, 2026-10-08, feat/jo-dash-s3b-health-batch; the branch's next handoff token)

Y2's participant half and Y6 are REPLACED again by the versions below (F-484 redesigned a second time: the invariant
core of a product wording, and "unclassified" as one explicit state; F-491 redesigned: the KB is the one source of
schedules, what it lacks is named and a narrow refresh is offered). Y20 is new (the ask and the narrow refresh, walked
in the email-engagement skill — its SKILL.md changed this round and it is model-invocable, so the tester session
invokes it). The build session measured first on 2026-10-08 (six reads on Bradley's token: two `rp schema`, one
`jo p list` page, two 2000-row refusal pages over the day window; shapes in `dev/S3B-FIX-ROUND-BRIEF.md` § Round 3).
Round type: RE-VERIFICATION of F-484 and F-491 by their Judge lines plus these checks; nothing else is owed. Every
other check of this section stands as last re-banked.

- Y2 (participant half, re-banked for V4). Y1's flags, a full pull, no --previous. Pass bar, from F-484's Judge line:
  every structural arm of V3 still holds (withFailures equals the direct count, one window object for the count and
  every page, no empty pick, OccurrenceCount DESC); the dominant program's `failureSamples` row for `Custom field
  contains Invalid value {null} for EMAIL data type` reads category `invalid-field-value`, kind `bad-address`,
  with `occurrences` far above `count` (one key was refused order 10^4 times at the build), and its `entrySamples`
  row carries the same category and kind; the five programs whose refusals carry the `Recipient Email Address field`
  spelling land in the SAME category; no `failureSamples` or `entrySamples` row carries category null, kind null or
  `other`; every row that reads `unclassified` reads kind `unknown` in both tables, is counted in the
  `unclassified-wordings` caveat (wordings, programs, participants, occurrences) and in its program's
  `signals.entry.sample.unclassified`, and a program kept from admitting anyone by such a wording is on Only refused
  participants arriving. Bradley reads the dominant program's split and EVERY unclassified wording (none is expected:
  the build's two 2000-row pages matched every other wording; one that appears is reported through report-bug as the
  caveat says, and recorded here with its masked text).
  CLEARED (S3b fix round 3 verdict @ hb-20261008-02, tester, 2026-10-09; production, reads only). The pull: the
  email-engagement skill's plan then run (Y1's flags, full, no --previous), exit 0, 196 calls made + 20 reused, none
  failed. Structural arms: `withFailures` 64 equals a direct COUNT grouped by program over the day window and the
  selected programs (64 programs; 63 per-program counts equal, one +4: the direct count ran about 40 minutes after the
  pull, and a narrow count of that program's refusals modified that day returned exactly 4 — accrual in an open window);
  one window object for the count and all 25 sample calls, one program each, 25 of 25 picks with rows, every page
  non-increasing in occurrences. The dominant program's `failureSamples` row for `Custom field contains Invalid value
  {null} for EMAIL data type` reads `invalid-field-value` / `bad-address` with occurrences about 650 times its count
  (order 10^4 against order 10^1); its `entrySamples` row the same category, kind and counts. The `Recipient Email
  Address field` spelling (6 programs) and the `Manager Email Address field` spelling (1 program) land in the same
  category in both tables. No participant-failure row in either table carries category null, kind null or `other`;
  occurrences >= count on every row; 0 participant-failure rows read unclassified. Bradley read the split: "that seems
  right". Beyond the expectation ("none is expected"): the `unclassified-wordings` caveat fired on 28 wordings in 25
  programs, every one from the BOUNCE part's samples (all 124 bounce sample rows read unclassified / unknown, null / null
  at V3; none matches the tenant's 30 patterns), plus a step remainder of order 10^2 participants, all in months before
  the period. Bradley read all 28 as bad-address variants and ruled the flag working as intended (ruling 12); they were
  added to the tenant's category file in the workspace (masked texts there, never here). Words and the residual under
  F-484's verdict.
- Y6 (the lists, re-banked for V4). Pass bar, from F-491's Judge line: BEFORE any refresh, `plan` prints
  `estimate.kb` naming every selected program the KB has no doc for (12 at V3: eleven DRIPV2 one-offs and the daily
  program Bradley read in the UI) and every documented program modified after its doc, `refreshSeconds` 3 per program,
  `unlisted` the programs the list itself lacks, and the two files beside plan.json (`kb-gap-keys.json`: the
  manifest keys; `kb-gap-list.json`: the list rows of the undocumented ones in the list's envelope); a run WITHOUT
  the refresh reads every undocumented program as Cannot judge yet with `signals.why` no-doc, `schedule.state`
  undocumented, `ingest.state` cannot-judge and `finished` false — none on Finished, none with ingest one-time —
  and `honesty.kb` and the `kb-behind-tenant` caveat name them; a documented program the list says was modified
  after its doc reads with `signals.schedule.docBehind` true and is judged from the doc. The eleven one-offs moving
  from Finished (true at V3) to Cannot judge yet is EXPECTED before the refresh and is the ask's reason; record the
  counts per list before and after. AFTER Y20's refresh and the re-plan, the formerly undocumented daily program
  reads by its own cron (recurring; ingest on-schedule or overdue by its heartbeat) and the one-offs read Finished
  again; Bradley reads each list that changed, his words verbatim. With a plain `--quiet-due-days` change nothing
  here moves.
  CLEARED by Bradley's ruling (S3b fix round 3 verdict @ hb-20261008-02, tester, 2026-10-09; production, reads only).
  Before: `estimate.kb` 12 undocumented (eleven DRIPV2 one-offs and the daily dynamic program), 8 behind, `unlisted` 0,
  `refreshSeconds` 60 (3 per program); `kb-gap-keys.json` the 20 manifest keys in `estimate.kb.programs` order,
  `kb-gap-list.json` the 12 undocumented rows in the list envelope. The run without the refresh: all 12 on Cannot judge
  yet, `signals.why` no-doc, `schedule.state` undocumented, `ingest.state` cannot-judge, `finished` false; none on
  Finished, none with ingest one-time; `honesty.kb` (12, 8) and the `kb-behind-tenant` caveat name the same 20; 5 of the
  8 behind are judged (the other 3 are Paused, which no list judges) and all 5 read `docBehind` true, judged from the doc.
  Counts per list before (V3 -> now): schedule-ended 19 -> 19, admitting-nobody 5 -> 5, no-recent-sends 2 -> 2,
  finished 15 -> 4, cannot-judge 3 -> 14, ok 21 -> 21, every other list 0; the move is the eleven one-offs. Bradley: "that
  seems right". After Y20's refresh (same run, exit 0, 213 calls reused, 1 made): the daily program reads by its own cron
  (recurring, period 1 day, ingest on-schedule) and stays on Cannot judge yet for too-new, no longer no-doc. The
  one-offs: 2 of 11 read Finished (no schedule in the doc); 9 read Schedule ended — their docs carry a daily cron windowed
  to one run (24 h or 0 h), the shape of every program on that list (29) and of 208 of 568 documented programs — and one
  re-documented behind program moved Finished -> Schedule ended for the same reason. Counts after: schedule-ended 29,
  finished 5, cannot-judge 3, admitting-nobody 5, no-recent-sends 2, ok 21, every other list 0. Bradley read the nine as
  one-offs, then ruled the rules correct on the data available (a single-run window cannot be told from a program meant to
  run on with a limited schedule); an admin acknowledgement is a backlog item, not this round's. Words under F-491.
- Y20 (the ask and the narrow refresh, new; the walk of the changed SKILL.md). In the tester session, the
  email-engagement skill invoked on the production tenant with Y1's flags: at step 2 the skill tells the user the two
  counts (undocumented, behind) and `estimate.kb.refreshSeconds` and ASKS; the tester records the ask's text
  verbatim. Bradley says yes: the three commands run once for real, in order, exactly as the skill spells them
  (upsert-batch --partial over `kb-gap-list.json`, skipped only if undocumented is 0; mark --status stale over
  `kb-gap-keys.json`; describe-batch --keys-file over the same, `moreRemaining` false), each exit 0 and its summary
  recorded; the re-issued plan (same run) reads `estimate.kb.undocumented` 0 and `behind` 0 (or names what it
  could not register: `unlisted`), and the run's `kb-steps.json` carries a different `stamp` from before the
  refresh. Guard-wiring for the round: the describe-batch step is reads only; the KB writes are workspace files. If
  Bradley says no, the walk records the ask and the caveat's text on the report instead, and Y6's "after" half is
  banked, not failed.
  CLEARED (S3b fix round 3 verdict @ hb-20261008-02, tester, 2026-10-09; production, reads only). The tester session
  invoked the skill with Y1's flags. At step 2 the skill quoted the two counts (12, 8) and the seconds (60) and asked; the
  ask's text is verbatim on the bus's Walk (hb-20261008-02) line. It was held unanswered while the run without it was
  measured (Y6's before half). Bradley: "yes redocument". The three commands, once each, in order, as the skill spells
  them: upsert-batch --partial exit 0 (12 matched existing manifest entries, 0 added: registered, never documented;
  warnings 0); mark --status stale exit 0 (20 marked); describe-batch --keys-file exit 0 (20 selected, 20 documented,
  0 failed, `moreRemaining` false). The re-issued plan on the same run: `estimate.kb` undocumented 0, behind 0,
  unlisted 0; `kb-steps.json`'s stamp moved. The token expired before the refresh and Bradley logged in again; no call
  reached the tenant on the expired token. Guard-wiring for the round: see the Walk line.

### Result — V2 first sitting @ hb-20261010-01 (tester, 2026-10-10; dev clean and level at c758021, the S4c branch merged; canary matched; production tenant, reads only, one call at a time; paused by Bradley to finish in V2.5, which continues from this block)

Section status: CLEARED. Every check judged; Y2's payload clause logged (F-510), Y12's wording logged (F-508); the spike arm answered.
- Y1 stands CLEARED (S3b rounds). This sitting's full pull with health, the KB, the tenant's 55-pattern category file and two test
  accounts: plan 449 calls / 3473 s (95 s inside the token), run 443 made + 19 reused, 0 split, 0 retried, exit 0, reconciled, all
  eleven parts read with their basis, 1757 s wall; health calls 404 against 408 planned (within 2x; the seconds 2x high); the bounce
  categories 330 of the calls (55 x 6 classes: F-504).
- Y2 re-read on this pull: the snapshot's 2740 health texts carry 0 addresses, 0 five-digit runs, 0 IPv4, 0 local addresses, 0 values
  after "Invalid value"; distinct masked bounce texts to bounced attempts order 10^-4. The sample PAYLOAD files' message fields (3148
  messages, 50 files): 5 messages carry an address whose domain the server wrote with a space (the email rule misses it) plus its bare
  local part, 2 carry a bare `@domain`, 3 carry five-digit URL paths (protected by design); none of the 5 reached the snapshot. Payload
  clause FAILED on those 5: F-510 (polish, proposed WONTFIX under ruling 5 with the category remedy; Bradley's call at V2.5).
- Y4 CLEARED: `bounce-reasons-sum-to-bounced` ok with 0 closed-month mismatches; for the pick and the closed month one direct count of
  bounced attempts equals the program-month's bounceReasons rows summed (16 category rows) and the send table's bounced.
- Y5 CLEARED: direct bounced, rejected and both-flags counts for the pick's month give bounced + rejected - both = the snapshot's `failed`;
  no attempt on that program-month carries both flags (0), so the union is unexercised here; the report's error rate is failed over Sent.
- Y7 CLEARED: the survey program's direct group-by of participant state equals the snapshot's three state rows exactly; the direct
  COUNT of its refused rows and SUM of occurrences equal its per-program `participantFailures` row (one row per program since S3b).
  No `health-states` batch timed out (4 calls).
- Y8 CLEARED on its as-of and caveat clauses: every documented program has a schedules row with `asOf` the doc's `last_verified` and
  the `schedules-from-kb` caveat is present (195 with a doc, 0 without). The `lastRunSuccess` clause is moot since F-491: the run-state
  fields are unset on this tenant and the live-read was retired; schedules are read as configuration.
- Y9 CLEARED: the spec's rules (surveys; internal users; recurring; one-off; the survey models inside Surveys) resolved with counts
  only on stdout (0 ungrouped at supergroup level; the group level 157 Ungrouped before the folder and name rules); `recurring`
  unknown for 0 programs = 0 without a full doc; the suggestion file is order 60 KB with no address. Bradley checked ten assignments:
  8 read right (a Dynamic Program that sends a survey among them), the 2 "Recurring" he first disputed he then read as recurring by
  hand / unsure (a daily cron boxed into one day, re-run through repeated windows). Not a wrong assignment; the one-run-window
  classification is F-502's.
- Y10 CLEARED: two folders labelled by Bradley hold exactly their programs (28 and 16; the UI folder holds more, the others sent
  nothing in the window), a third unlabelled folder reads "Folder <id>" (11); names follow a deliberate prefix convention (84 programs,
  tenant-specific), kept as a startsWith rule for one family (25) after a generic segment rule produced a tail of one-program groups;
  with `--previous` an earlier snapshot of the same programs the line reads "0 new programs ungrouped"; 85 programs Ungrouped at
  group level.
- Y11 CLEARED: the export holds no machine path (order 5 KB, keys kind / exportVersion / exportedAt / tenantHost / spec); the import
  into a scratch copy of the KB is byte-identical (`cmp`); a second import is refused without `--replace`; the sandbox import is refused
  naming both tenants and writes nothing.
- Y12 CLEARED: every setting reads as a sentence; the group rules in order with labels; the pages' panels described. One wording
  logged (F-508: a lowest-N sort described as "the top N").
- Y13 to Y20 stand as CLEARED in the earlier rounds.
- Spike arm (p1) ANSWERED (SPIKE-NOTES): the history object exists (5 fields: a reason STRING that is filterable, groupable and
  sortable; source name and type; a created-at DATETIME; the Gsid), with no failed-participant id and no lookup to the program, so
  program-level history is impossible and tenant-wide counts by month, source type and reason are what it supports; order 10^6 rows
  over the dashboard's window (10^4 to 10^6 a month; one source type carries nearly all), retention back to 2022-05. (p2) stands as
  measured at S3b (`ModifiedAt` moves per refusal); (p3) stays the shipped basis.


## DSH-2 — the dashboard page built over a real snapshot: filtered in a browser, its size measured, a CSV export opened in a spreadsheet (banked 2026-10-04, builder, Session S4a; verdict at V2)

Owed by: V2, the batched verdict session after S4c, in the consumer workspace with the plugin loaded from `dev`
(the PR for `feat/jo-dash-s4a-runtime` is held open until the architecture review R1 has run, then merges on green
CI plus its review round, before V2).
Token: none yet. `dev-utils handoff --branch feat/jo-dash-s4a-runtime` refused to mint one on 2026-10-04 (the bus header
names an earlier token of the same day in another round's text: the same refusal S3 met), and the refusal was recorded,
not worked around. This section is keyed to the token the branch's next handoff mints; the PR is #40.
Why it is banked: the page builder, the runtime every page inlines and the suite were built offline against the
fictional tenant, the stand-in CLI and generated snapshots. How big a page is over a real pull, how a real browser
handles a real program list, what a real spreadsheet makes of the CSV, and whether real program and account names
render and export cleanly cannot be measured without a tenant. No gs-admin call is made in this section: every
step reads files the earlier sections' pulls wrote.
Tenant data stays in the workspace: pages, CSVs and snapshots live under the workspace's ignored paths; no name,
count, size beyond an order of magnitude, or message text is copied into this file or the bus.

THIS LIST IS COMPLETE. It is everything this round judges for DSH-2; a check that is not here is not owed, and a
thing the round thinks should be here is a finding. Nothing is "noted on the verdict": anything observed beside a
pass bar becomes an F-section on the bus, or a GitHub issue, before the round closes.

Inputs: Y1's snapshot (health on, accounts off) and the saved `v2-groups` spec from Y9/Y10; W3's `s1b-on.json`
(accounts on, pulled before the failure count existed) where a step names it. A browser that runs the page's
script: the built-in browser pane shows a local file as a static picture (that is Z9's point), so for Z3 to Z6
either serve the page's folder on localhost or open the file in a desktop browser.

- Z0 (the contract, before anything is built). Bradley reads the executor's choices in the plan's As-shipped (S4a)
  note under DSH-2 and rules on each: the account filter as a per-page control that appears only when a page lists
  accounts (not a T-11 global filter); the line to copy naming the `dashboard edit` and `refresh` modes S5 builds;
  a page keyed on `accountNames` (not the preset) for dropping account data; the health tables dropped from a page
  whose Health tab is off; the About tab's content until DSH-4; the one default table a preset shows until DSH-4.
  Pass bar: each is confirmed or overruled; an overrule that changes what a page embeds is the builder's change
  before V2 builds a page.
  CLEARED (spot check @ hb-20261004-04, tester, 2026-10-04, before any call; one question per choice): all six
  ruled, none changes what a page embeds, so nothing is owed by the builder before a page is built. (1) the account
  control per page: confirmed. (2) the line to copy: ruled a deterministic command built from the LACKS row's
  setting path, not a skill mode; R1 names the entry command and a later build respells `COPY_LINES`; the
  skill-mode text stays as a placeholder until then, with no change to PR #40. (3) `pages[].accountNames` decides,
  the preset only sets its default: confirmed. (4) health tables dropped from a page whose Health tab is off:
  confirmed. (5) the interim About tab: confirmed until S4b. (6) the interim default Programs table: confirmed until
  S4b. Detail in the maintainer's plan, as an addendum under the As-shipped (S4a) note.
- Z1 (build over a real snapshot). `node .gs-superadmin/plugin/scripts/dashboard-page.mjs --spec
  <slug>/dashboards/v2-groups/spec.json --snapshot <Y1 snapshot> --out-dir <slug>/dashboards/v2-groups/pages`.
  Pass bar: exit 0; `latest-admin.html` and `latest-exec.html` written; the summary prints a size report per page
  (total bytes and the data, engine, runtime and pre-render shares) and `ungrouped` reads the same line Y10's
  `resolve` printed. Record each page's megabytes and the data share, as orders of magnitude; whether the warning
  fired. Then the same command over `s1b-on.json` (accounts on, no failure count) into a second folder: exit 0, and
  the admin page's Health tab shows no zero for send failures: the cells are blank and the table says the snapshot
  predates the figure, with the refresh line to copy.
  FAILED on its second half (spot check @ hb-20261004-04, tester, 2026-10-05; no gs-admin call). Built with a minimal
  saved spec in place of `v2-groups` (the spec writer's draft, one set of the internal domains and unsubscribe
  links, save; no group rules, so `ungrouped` counts every program and there is no Y10 line to compare). Over Y1's
  snapshot: exit 0 in under a second, both pages written, a size report per page with the four shares; admin order
  8 MB, data 98% of it, the 5 MB warning fired; exec order 0.5 MB. Over `s1b-on.json`: exit 0; admin order 1 MB, exec
  order 0.5 MB. The admin page's Health tab (on) is a bare heading before and after the script runs: no table, no
  statement, no line to copy, because the interim default panel sits on Engagement only (Z0 choice 6). It shows no
  zero, but not the statement this bar asks for. With a send-failures panel added in memory, the same runtime over
  the same page data gives every `failed` cell null with `measure-not-in-snapshot`, the compact notice and the
  refresh line, and no zero: the mechanism holds where a panel draws it. Findings: F-485 (the size report and its
  warning), F-486 (an on tab with nothing to draw).
- Z2 (the numbers are the engine's, through the embedded data). A node one-liner over the admin page: take the text
  of `<script id="gs-data">`, `JSON.parse` it, `unpackSnapshot` it (from `dashboard-runtime.mjs`) and compare with
  the page's own copy of the snapshot computed by `pageSnapshot` (from `dashboard-page.mjs`) with
  `util.isDeepStrictEqual`. Pass bar: equal. Then, with the status filter set to every status, the program table
  on the admin page shows, for five programs Bradley picks, the same sent, delivered, opened and open rate as the
  open-rate report X-walk wrote over the same snapshot (both come from `runQuery`; a difference is a packing or
  filter defect).
  CLEARED (spot check @ hb-20261004-04, tester, 2026-10-05; no gs-admin call): over the admin page built on Y1's
  snapshot, the unpacked `gs-data` and `pageSnapshot` of the grouped snapshot are `isDeepStrictEqual`. The five
  programs are the ones Bradley named in the picks file (P-busy, P-survey, P-unsub, P-multi and the mass-send Email
  Chain); with every status, the page's program table and the open-rate report written offline over the same
  snapshot (`engagement-report.mjs --snapshot … --all`) show the same sent, delivered, opened and open rate on 5 of 5.
- Z3 (filtered in a browser). Open the admin page. Pass bar, each in turn, with the table and the summary line
  changing accordingly and no console error: the month range narrowed to one closed month (the incomplete mark
  disappears); the program search for a word that matches a handful, then Select none, then two programs ticked
  ("2 of N selected"); a supergroup then a group inside it from Y9's rules; a status added and removed (the "hidden
  by status" count moves); internal recipients left out (the figures fall or hold, never rise); Reset filters. For
  two of these states Bradley records the figures of one program and a node one-liner runs `runQuery` with the
  same filters over the snapshot file: equal.
- Z4 (the address). After Z3's two states: reload the page with its hash and the same view is drawn; the hash holds
  program ids, status codes, months and positions only (no program name, group label or account name, checked by
  eye and by `decodeURIComponent`); open the page in a private window with the hash and the view is the same.
- Z5 (what the page cannot do, on real data). On the admin page over Y1's snapshot: the Health tab is on (the spec
  turned it on) and its panel draws; the Templates tab is off in every spec so far, so it shows dimmed as "(off)"
  and opening it shows the notice with "new pull" and the line to copy; the recipients toggle is enabled (the pull
  named internal domains). Over `s1b-on.json` with the spec's account panels, the account filter lists accounts
  and the watch-list panel draws; over Y1's snapshot the same spec shows the accounts-off notice in the three
  places (watch list, account table, account filter) and no empty table. On the leaders' page: no Health or
  Templates tab at all; an account panel, if the spec lists one, shows the statement with no line to copy;
  `grep -c` of two account names from the admin page returns 0 on the leaders' page file.
- Z6 (a CSV export opened in a spreadsheet). On the admin page, with a filter applied (one month, external
  recipients), Columns with two hidden, Download CSV on the program table. Open the file in Excel or an equivalent.
  Pass bar: one row per table row, the header names the visible columns only, program names with commas, quotes or
  accents arrive intact, rates are fractions (0.6123, not 61.23%), a blank cell is blank, the tracking column reads
  tracked, not-tracked or unknown; no cell is evaluated as a formula (if a program name starts with =, +, - or @,
  the cell shows the name as text with a leading apostrophe; if none does, say so: the neutralisation is then
  unexercised here, the offline fixture covers it); the file's name carries the dashboard, the page, the table and
  the pull's date and time. The browser's network log shows the page's own load and nothing else, the download
  included.
- Z7 (size and speed). Record, as orders of magnitude: the admin page's megabytes over Y1's snapshot and over
  `s1b-on.json`; the time to open each (DOMContentLoaded from the browser's performance entry) and the time a
  status change takes to redraw (by feel, under about a second). Pass bar: both pages under 5 MB with accounts off;
  with accounts on, the page opens and filters in seconds and the size is recorded against R24's estimate.
  FAILED on size (spot check @ hb-20261004-04, tester, 2026-10-05; no gs-admin call). Measured in a real browser
  engine: headless Chrome over the DevTools protocol, the pages served on localhost (no browser pane), two runs
  each. Admin over Y1's snapshot (accounts off): order 8 MB, over the 5 MB bar; DOMContentLoaded 127 to 153 ms; a
  status change redrawn in 14 to 29 ms. Admin over `s1b-on.json` (accounts on): order 1 MB; DOMContentLoaded 32 to
  53 ms; redraw 13 to 26 ms. Exec over Y1's snapshot: order 0.5 MB, 20 ms, 21 to 25 ms. Each page requested itself
  and nothing else (the browser's own favicon probe aside), with no console error from the page. Account data on the
  accounts-on page is about 0.55 MB (admin data less exec data), about 2x R24's 0.3 MB estimate, order 10^4 account
  rows. Speed passes by a wide margin; the size failure is the health tables (order 18 of the snapshot's 18.5 MB),
  F-484 and F-485.
- Z8 (real names render inert). Pick the program, template and account names with the most punctuation on the
  tenant (an ampersand, angle brackets, quotes, an apostrophe). Pass bar: each shows literally in the list, the
  table, the badges and the CSV; no name changes the page's layout or opens a tag.
- Z9 (readable without JavaScript). Open the admin page in the built-in browser pane as a local file (a static
  picture, no script) or with JavaScript disabled. Pass bar: the default view is readable: the data-pulled line,
  the summary line with the status default, the first tab's table; the controls show as disabled.
- Z10 (column choices are remembered). Hide two columns on the program table, reload: still hidden; open the
  leaders' page: its own columns, untouched; a private window: the panel's own columns.

### Result — V2 first sitting @ hb-20261010-01 (tester, 2026-10-10; dev clean and level at c758021, the S4c branch merged; canary matched; production tenant, reads only, one call at a time; paused by Bradley to finish in V2.5, which continues from this block)

Section status: CLEARED. Every check judged; F-503 and F-505 logged from it.
- Z0 stands RULED (spot check).
- Z1 CLEARED, both halves: over this sitting's dashboard snapshot both pages written (admin 2.33 MB, data 1.05 MB of it; exec 0.70
  MB), the size report per page with the four shares and every non-empty packed table's rows and bytes, `ungrouped` the same line
  `resolve` printed, no warning; over the kept accounts-on pre-failure snapshot (1.84 MB / 0.65 MB) the Health tab's error-rate tile
  reads a dash with the predates tooltip, the error-rate table draws, and the `measure-not-in-snapshot` notices carry the refresh line;
  no zero anywhere.
- Z2 stands CLEARED (spot check) and re-read: the unpacked `gs-data` of both pages is `isDeepStrictEqual` to `pageSnapshot` of the
  grouped snapshot; with every status the Programs table equals the report written over the same snapshot on 5 of 5 picked programs.
- Z3 CLEARED (headless Chrome over localhost, then Bradley by hand): one closed month removes the incomplete marks (26 -> 0); a
  search word narrows the list to 50 of 195 by partial match; Select none reads 0 of 195, two ticked "2 of 195 selected"; a
  supergroup narrows to 64 and a group inside it to 22; removing one status hides 123 "(showing Active, Draft, Stopped)" and
  restoring it returns; external recipients only lowers the pick's sends and the total row and never raises; Reset returns the
  default. Two recorded states (one month; external) re-run through `runQuery` over the snapshot file: equal on every figure. No
  console error.
- Z4 CLEARED: the hash holds months, codes, ids and positions only (`#m=…`, `#rc=external`, `#p=…`), reloads to the same view in a
  fresh tab.
- Z5 CLEARED: Health on draws; a build with the Templates tab off shows "Templates (off)" and opens to the tab-off notice with needs
  rebuild and a copy line; the recipients toggle is enabled (internal domains named); the three customer-list panels and the account
  filter show the accounts-off notice over this snapshot, and over the accounts-on snapshot the account control lists order 10^3
  accounts and the most-engaged list draws; the leaders' page has no Health or Templates tab, no account names (none pulled: the grain
  was off on every pull this round), and the account panels are absent by preset.
- Z6 CLEARED: the Programs CSV under one month and external recipients with two columns hidden: 39 rows = the table's rows, the
  header Status plus the visible metrics, rates as fractions, opened in Excel with 0 formula cells; no name starts with an operator, so
  the neutralisation is unexercised here; the filename carries the dashboard, page, panel and the pull's time; no request after the
  click.
- Z7 CLEARED: admin 2.33 MB, exec 0.70 MB (both under 5 MB with accounts off); DOMContentLoaded 211 ms; a status change redraws
  sub-second by the driver and by Bradley's feel.
- Z8 CLEARED: three names with an ampersand, bars and commas show literally in the list, the table and the badges; 0 stray tags.
- Z9 CLEARED: with scripts disabled the default view is readable (the data-pulled line, the summary, 195 rows) and the controls are
  disabled.
- Z10 CLEARED: two hidden columns survive a reload (the panel's localStorage key); the leaders' page's own columns untouched.


## F-487 — Power List sources on a real tenant: the refresh capture and both deps surfaces (banked 2026-10-06, builder, feat/f487-power-list-sources; verdict at the branch's handoff token — CLEARED 2026-10-06 @ hb-20261006-03, by Bradley's ruling on P13; shipped as plugin 0.43.4)

Owed by: the F-487 verdict round, in the consumer workspace with the plugin loaded from the branch (the token the
branch's handoff mints; written with a placeholder here and keyed to that token at the handoff).
Why it is banked: the readers were built against seven live rule payloads and six program payloads captured on
2026-10-06 and then against fixtures derived from them, and Bradley checked those programs against the UI the same
day — but the whole path through the workspace (refresh step 3b registering and documenting the rules into the
rules folder, both reports resolving through the KB docs, the connection named from the connectors lane) has not
run on a real KB. Every call below is read-only; the only tenant calls are refresh step 3b's `re r describe`s.
Tenant data stays in the workspace: no object, list or program name, no connection name and no count beyond an
order of magnitude is copied into this file or the bus.

THIS LIST IS COMPLETE. It is everything this round judges for F-487; a check that is not here is not owed, and a
thing the round thinks should be here is a finding (an instance of the same mechanism REOPENS F-487; a new
mechanism is a new number).

- P0 — provenance: the dev-canary token matches the Under test line (the branch's handoff token); `report` shows
  the journey domain at depth full for the programs the round will name (a shallow KB has no Power List sources to
  find — say so and stop, it is not a failure of the fix).
  CLEARED (F-487 acceptance round @ hb-20261006-01, tester, 2026-10-06; production, reads only). The dev-canary token read hb-20261006-01 in session, equal to the Under test line; report: journey documented at depth full from the deep crawl, order 10^2 Power List programs among them.
- P1 — refresh step 3b, first run: `/gs-superadmin:refresh` (the user types it). Pass bar: the step's
  `power-list-gaps.mjs` summary names the recorded rules folder and `ruleId`; `missing` equals the number of
  distinct Power List rules the documented programs reference minus any already documented; the partial upsert
  reports `added` equal to `missing` with no recording flag and no under-pagination warning; the describe loop ends
  with `moreRemaining: false` and the rules folder holds one new raw doc per registered rule whose fence carries
  `ruleType: ADVANCED_OUTREACH_QUERY_BUILDER`; the report carries the "Power Lists:" line with "still missing" 0 (or
  names the stop rule / auth abort that left some). Record the order of magnitude of calls and the elapsed time.
  CLEARED (F-487 acceptance round @ hb-20261006-01, tester, 2026-10-06; production, reads only). Bradley typed the refresh; step 3 ran as written first (on his ruling). Summary: rules folder and ruleId from the manifest recording; distinctRules order 10^2, documented 0, missing equal to it, the list equal id-for-id to an independent count from the program docs. Partial upsert: added = missing, no recording flag, no warning, the domain's list stamp untouched. Describe loop: 26 invocations of at most 15, moreRemaining false, 0 failed, no aborted; one new raw doc per registered rule, every fence ADVANCED_OUTREACH_QUERY_BUILDER (checked independently over every doc). Report line: still missing 0. Cost: order 10^2 calls (one describe per rule), about 21 minutes, plus step 3's order 10^1 list calls. Note (the bus verdict's instance 4): "still missing" read from a re-run of 3b-1 is 0 by construction once 3b-2 has registered, so it cannot report a describe that never landed.
- P2 — refresh step 3b, second run, same workspace: `missing: 0`, nothing registered, no describe spawned. The
  "pleasant surprise" is a one-time cost.
  CLEARED (F-487 acceptance round @ hb-20261006-01, tester, 2026-10-06; production, reads only). Second refresh, same workspace: missing 0, an empty work list, no upsert, no describe; the rules folder unchanged. Step 3's rules re-list raised only the recency-filtered shortfall warning it raised before the Power List entries existed.
- P3 — deps-report, tenant-wide: `/gs-superadmin:deps-report --object <the SFDC object most lists read>
  --connection <the SFDC connection name>` (the tester invokes it). Pass bar: the Journey programs section lists
  the Power List programs with usage "Power List source object" / "Power List output field", the detail naming the
  list and the task, the connection column carrying the connection's NAME and type (resolved from the connectors
  lane, not the bare GUID), and `connection` matches on the name; the Rules Engine section lists no Power List as
  a rule and the caveat "N doc(s) under <rules folder>/ are Power List rules … read through the journey programs"
  is present; the summary's journeyPowerListRulesMissing is 0 after P1 and the "have no readable KB doc" caveat is
  absent; the caveat "a match means the list reads the object, never how it filters it" is present; no row and
  no caveat says "no CLI surface". The four programs Bradley checked on 2026-10-06 are among the matches with the
  objects the UI showed.
  CLEARED (F-487 acceptance round @ hb-20261006-01, tester, 2026-10-06; production, reads only) for its terms (the SFDC object most lists read, the SFDC connection's name): usages "Power List source object" / "Power List output field"; detail names the list and the task; the connection column carries the connection's name and type from the connectors lane; connection matched on the name; no Power List listed as a rule, the "N doc(s) under rules-engine/ are Power List rules" caveat present; journeyPowerListRulesMissing 0, no missing-doc caveat; the filter sentence present; no "no CLI surface" text. Differential against the raw rule docs: order 10^2 programs expected, the same set reported, 0 missing, 0 extra. The UI programs: the three in the KB match with the UI's objects; two are post-crawl and unmeasured. Gainsight-object terms, which this check's terms do not reach, fail: the bus verdict's instance 1.
- P4 — email-report deps mode: `/gs-superadmin:email-report` deps with `--object <that object>` and `--kb <slug>`
  (the tester invokes it). Pass bar: the same programs match; the provenance table's cell reads "Power List
  **<name>** (rule `<id>`) — reads <objects> via <connection|Gainsight>; filters not returned by the CLI — see
  detail below"; a "### Power List detail" block lists each task with its object, where it reads it and its output
  fields, derived tasks naming their upstream task, and "filters: not returned by the CLI"; deps-sources.csv (when
  `--csv` is passed) carries the `rule_id` column; the standing caveat carries the Power List sentence.
  CLEARED (F-487 acceptance round @ hb-20261006-01, tester, 2026-10-06; production, reads only). Same programs as P3's object half; provenance cell "Power List **<name>** (rule <id>) — reads <objects> via connection <GUID> | via Gainsight; filters not returned by the CLI — see detail below" (the connection is a GUID on this surface, which the Fix note scopes naming away from); the Power List detail block lists each task with its object, where it reads it and its output fields, derived tasks naming their upstream task id, and "filters: not returned by the CLI"; deps-sources.csv carries rule_id; the standing caveat carries the Power List sentence.
- P5 — a dynamic program: both reports over `--object <the object a dynamic program's dynamic field reads>`
  (one of the two dynamic programs checked on 2026-10-06). Pass bar: the program matches through a "dynamic
  field" and/or "branch condition" row; its provenance cell reads "Dynamic query `<id>` — dynamic program — its
  participant query is not returned by any CLI command"; the standing caveat carries the dynamic-program sentence.
  FAILED (F-487 acceptance round @ hb-20261006-01, tester, 2026-10-06; production, reads only). The dynamic program matches on both surfaces through "dynamic field" and "branch condition" rows, and the tenant-wide report carries the dynamic-program caveat. Email-report renders no provenance cell for it and its standing caveat has no dynamic-program sentence (summary querySources 0): program-level rows carry no sourceRef and provenance is built from sourceRef rows only, so the cell is unreachable on an --object match. Measured on one of the two dynamic programs Bradley checked (the other is post-crawl).
  CLEARED (F-487 second verdict round @ hb-20261006-02, tester, 2026-10-06; production, reads only). Both dynamic programs (one of them Bradley's UI-checked one) match on both surfaces through "dynamic field" and "branch condition" rows; email-report renders each one's cell "Dynamic query <id> — dynamic program — its participant query is not returned by any CLI command" (summary querySources 2) and its standing caveat carries the dynamic-program sentence; the tenant-wide report carries its caveat.
- P6 — a lookup-path field: `--field <an SFDC field a list reads through a relationship, e.g. the related
  Account's 18-digit id field>` matches exactly on the field's own API name (the relationship prefix stripped),
  on the related object.
  CLEARED (F-487 acceptance round @ hb-20261006-01, tester, 2026-10-06; production, reads only) for the one-hop path named here: --field <the related object's 18-digit id field> matches on that field's own API name, on the related object, on both surfaces; differential against the raw docs: order 10^2 programs expected, the same set reported. A multi-hop path keeps a prefix and misses: the bus verdict's instance 2.
- P7 — the honesty arm: delete (or rename) ONE Power List rule doc from the rules folder, re-run P3. Pass bar: that
  program's rows through the list disappear, and ONE aggregate caveat names the rule id, the program count, the
  resolved ratio and `/gs-superadmin:refresh` as the remedy; restore the doc (or re-run refresh, which re-registers
  it — P2's "nothing registered" no longer holds for that one, say so).
  FAILED (F-487 acceptance round @ hb-20261006-01, tester, 2026-10-06; production, reads only). With one rule doc moved out (and restored after): that program's Power List rows disappear and ONE aggregate caveat names the rule id, the resolved ratio and /gs-superadmin:refresh — but its program count is every Power List program in the KB, not the one that references the rule; and refresh's 3b-1 on that state prints missing 0 (the manifest says documented), so the named remedy re-registers nothing. Refresh was not re-run against the tenant; its deterministic first step was.
  CLEARED (F-487 second verdict round @ hb-20261006-02, tester, 2026-10-06; production, reads only), on a scratch copy of the KB: with one Power List rule doc removed, that program's Power List rows disappear and ONE aggregate caveat names the rule id, "1 program(s)" (the programs that reference it), the resolved ratio and /gs-superadmin:refresh, worded as what refresh's step now does; refresh's 3b re-documents the rule from that state (P10).
Section FAILED (F-487 acceptance round @ hb-20261006-01, tester, 2026-10-06; production, reads only): P5 and P7 failed, F-487 reopened; P0 to P4 and P6 cleared. The section stays the live arm of F-487's next round.

### Re-banked for the F-487 second round (builder, 2026-10-06, feat/f487-power-list-sources; the branch's next handoff token)

P5 and P7 stay owed as written above; their fixes are the program-level provenance entry (P5) and the
doc-readability classification plus the per-rule program count (P7). The class the verdict named — identities
canonical, not payload-shaped — adds four checks, the verdict's own falsifiable tests (i) to (iv), each run
on the production KB after one `/gs-superadmin:refresh`:

- P8 (class test i) — for every object in the `data-management` lane that any Power List reads (take the three
  the verdict measured: a custom `__gc` object, a scorecard fact object, a standard object read through lookups),
  `/gs-superadmin:deps-report --object <GSID>`, `--object <system name>` and `--object <label>` return the SAME
  set of journey programs; every row carries the system name with the label beside it; the summary's
  objectRegistrySize is the lane's object count. Pass bar: three identical sets per object, zero rows
  carrying a bare GSID as the object name.
  FAILED (F-487 second verdict round @ hb-20261006-02, tester, 2026-10-06; production, reads only). Over every Gainsight object any Power List reads (order 10^1, all present in the lane): GSID and label agree, system name does not — --object <system name> returns 0 journey programs for nearly every object whose system name differs from its label, because the registry reads the doc's first "- name:" bullet (on real docs the display name; the system name is "- id:"); 579 of 594 production docs carry that shape. A standard object read through dynamic fields: GSID misses the programs that read it only that way (dynamic-field rows bypass the registry). Zero Power List rows carry a bare GSID; objectRegistrySize 594 = the docs on disk (the lane holds three newer pending entries with no doc).
- P9 (class test ii) — a standard SFDC field that programs read only through multi-hop paths (the verdict's
  instance 2): `--field <its API name>` returns every program whose list reads it, on both surfaces, the row's
  detail carrying the full path. Pass bar: the set equals an independent count over the raw rule docs (every
  originalFieldName whose last segment is the name).
  CLEARED (F-487 second verdict round @ hb-20261006-02, tester, 2026-10-06; production, reads only). --field <the standard SFDC field read only through multi-hop paths in round 1> returns order 10^1 programs on both surfaces, the same set on each and equal to an independent count over the raw rule docs (every originalFieldName whose last segment is the name), including every program round 1 missed; the row detail carries the full path.
- P10 (class test iii) — on a scratch copy of the KB, for each manifest state of ONE referenced rule whose doc
  is removed — documented, pending, failed — `power-list-gaps.mjs` classifies it (redoc / queued / queued),
  lists it in pl-gap-keys.json (and pl-gap-redoc.json for the documented case), and refresh step 3b documents
  it (the mark, then the keys-file batch); meanwhile both deps reports' caveat names exactly the programs that
  reference it (count 1 here) and `/gs-superadmin:refresh` as the remedy. Pass bar: three states, three
  re-documentations; the caveat's program count equals the referencing programs, never the KB's Power List
  program count.
  FAILED (F-487 second verdict round @ hb-20261006-02, tester, 2026-10-06; production, reads only) on its caveat half. Scratch copy, one referenced rule's doc removed, three manifest states: documented → redoc 1 (keys and redoc files list it; 3b-2 marks it stale; the batch re-documents it), pending → queued 1, failed → queued 1 (the batch re-documents each) — three states, three re-documentations, three live describes. Tenant-wide caveat: correct (1 referencing program, refresh). Email-report deps: no caveat at all — the program whose only match runs through the unreadable list drops out of the report silently (powerListRulesMissing 0). The live refresh on the real workspace described nothing (unreadable 0), as owed; a truncated doc is classified redoc.
- P11 (class test iv) — over `--object <the object a dynamic program's dynamic field reads>` in email-report
  deps mode, every program in the usage table has a provenance row; the dynamic program's cell reads
  "Dynamic query `<id>` — dynamic program — its participant query is not returned by any CLI command" and the
  standing caveat carries the dynamic-program sentence (P5's bar, restated as the class test).
  CLEARED (F-487 second verdict round @ hb-20261006-02, tester, 2026-10-06; production, reads only). Email-report deps over the two objects the dynamic programs' fields read: every program in the usage table (order 10^2) has a provenance row; the dynamic program's cell and the standing sentence render as P5 states.
Section FAILED (F-487 second verdict round @ hb-20261006-02, tester, 2026-10-06; production, reads only): P8 and P10 failed, F-487 reopened a second time; P5, P7, P9 and P11 cleared (P0 to P4 and P6 cleared at hb-20261006-01).

### Re-banked for the F-487 third round, under the Redesign (builder, 2026-10-06, feat/f487-power-list-sources; the branch's next handoff token)

P5, P7, P9 and P11 CLEARED @ hb-20261006-02 and are not re-run. P8 and P10 are replaced by the verdict's sharper
class tests, one per invariant:

- P12 (invariant A, class test i) — for EVERY object in the `data-management` lane that any Power List, dynamic field
  or branch condition reads (enumerate them from the raw docs, never a sample): `/gs-superadmin:deps-report --object
  <the doc's "- id:">`, `--object <GSID>` and `--object <label>` return identical sets of journey programs AND identical
  row kinds per program; every row carries the `- id:` value as the object name with the label beside it; the
  summary's objectRegistrySize equals the lane's doc count. Pass bar: identical sets and kinds for every object, zero
  rows carrying a GSID or a display name as the object name. Note the case the verdict found: an object whose
  `- id:` differs from its label (579 of 594 docs on this KB) — those are the ones that decide it.
  CLEARED (F-487 third verdict round @ hb-20261006-03, tester, 2026-10-06; production, reads only, no tenant call). Enumerated independently from the raw docs (a tester script over every Power List rule doc's taskDetails[].schemaObject and outputFields[].meta.originalObjectName, every program doc's dynamicFields[].fieldInfo.objectName with their filter conditions, and every canvas outPorts[].conditions[].left.fieldConfig.objectName), resolved against every data-management doc's `- id:` / `- objectId:` / `- label:` / `- dbName:`: order 10^1 objects, no ambiguous reference, nearly all with `- id:` different from the label; the unresolved references are SFDC objects and derived-task aliases, outside the lane. For EVERY one, tenant-deps over the live KB with `--object <- id:>`, `<GSID>` and `<label>` (three runs per object): identical program sets, identical row kinds per program, and identical journey rows (object, label, field, connection, detail) on all three spellings; every row's object column is the `- id:` value with the doc's label beside it, zero rows carrying a GSID or a display name; every row kind the raw docs show reading the object (Power List source object / output field, dynamic field, dynamic-field filter, branch condition) appears in that object's rows, including the objects read only through branch conditions or only through dynamic fields. objectRegistrySize = objectRegistryDocs = the lane's doc count. The deps-report skill was walked once (P13); the per-object runs drove its script directly.
- P13 (invariant B, class test ii) — on a scratch copy of the KB, with ONE referenced Power List rule's doc unreadable
  (moved out), run `/gs-superadmin:email-report` deps mode and `/gs-superadmin:deps-report` each with a term that
  matches nothing (an object no program reads) and again with the SFDC object that list reads. Pass bar: all four
  runs carry a caveat naming the rule id, its referencing programs (count and names) and `/gs-superadmin:refresh` as
  the remedy, with "their absence from the tables above is not evidence"; powerListRulesMissing 1 on the JO surface
  and journeyPowerListRulesMissing 1 on the tenant-wide one, whatever the terms. Restore the doc.
  FAILED (F-487 third verdict round @ hb-20261006-03, tester, 2026-10-06; production, reads only, no tenant call) on its tenant-wide half. Scratch copy of the KB; one Power List rule referenced by exactly one program, whose list reads the SFDC Contact object, had its doc moved out (manifest entry left as documented). Terms: a real data-management object no program reads (journey rows 0 on both surfaces), and Contact. JO surface (email-report deps, --all, --kb the scratch copy; index rebuilt over it from the session's earlier program-list pages): both runs PASS — fieldUsageRows 0 on the first, order 10^3 on the second, powerListRulesMissing 1 on both, and the caveat names the rule id, its source, "referenced by 1 in-scope program(s): <name> (<id>)", "their absence from the tables above is not evidence" and /gs-superadmin:refresh with its real behaviour. Tenant-wide surface (deps-report, --no-live): journeyPowerListRulesMissing 1 on both runs and the caveat names the rule id, "(1 program(s))" and refresh as the remedy — but neither the referencing program's name nor the "absence … is not evidence" clause (it says "an --object or --connection search cannot reach them through that source"). tenant-deps.mjs did not change this round; its aggregate caveat ("one aggregate caveat per state, never one line per program on a tenant-wide scan") is the text round 2 judged correct on P10's count-only bar. Doc restored byte-identical; the scratch copy then resolves every Power List source, missing 0.
  Ruled (Bradley, 2026-10-06, after the run): the tenant-wide "count and names" and "not evidence" clauses are bar overreach — the third Fix note claimed names on the JO surface only, and round 2 accepted the aggregate tenant-wide text. P13 CLEARED by ruling on the measurements above (unchanged); the missing tenant-wide detail is F-488 (polish).
Section FAILED (F-487 third verdict round @ hb-20261006-03, tester, 2026-10-06; production, reads only): P12 CLEARED, P13 FAILED on the tenant-wide caveat's content; F-487 reopened a third time (the valve: DEFERRED past 0.48.0 is Bradley's call, see the bus).
Section CLEARED by ruling (F-487 third verdict round @ hb-20261006-03, Bradley's ruling the same day): P12 CLEARED; P13 CLEARED by ruling; F-487 VERIFIED; F-488 (polish) carries the tenant-wide detail.

## DSH-4 — the views and presets built over a real snapshot: both presets opened in the browser pane in light and dark, the leaders' page checked for account names and for recipients values, the admin page's size with health on (banked 2026-10-09, builder, Session S4b; verdict at V2)

Owed by: V2, the batched verdict session after S4c, in the consumer workspace with the plugin loaded from `dev`
(the PR for `feat/jo-dash-s4b-views` merges on green CI plus its review round, before V2).
Token: hb-20261009-01 (minted by `dev-utils handoff --branch feat/jo-dash-s4b-views` on 2026-10-09; the bus's Under
test line names it; this section is keyed to it). PR #44 to dev, unmerged at banking.
Why it is banked: the panel types, the four typed health views, the About tab, the banners and the presets were built
offline against the fictional tenant, the stand-in CLI (the signals variant, one program per health list) and edits of
the committed fixture snapshot. How the pages read over a real pull — real program and account names in the charts and
lists, real failure categories against a tenant's category file, a real health day window, the size of an admin page
whose health tables are aggregates only — cannot be measured without a tenant. No gs-admin call is made in this section:
every step reads files the earlier sections' pulls wrote (Y1's snapshot with health on, or V2's own re-pull).
Tenant data stays in the workspace: pages and snapshots live under the workspace's ignored paths; no name, count, size
beyond an order of magnitude, or message text is copied into this file or the bus.

THIS LIST IS COMPLETE. It is everything this round judges for DSH-4; a check that is not here is not owed, and a
thing the round thinks should be here is a finding. Nothing is "noted on the verdict": anything observed beside a
pass bar becomes an F-section on the bus, or a GitHub issue, before the round closes.

Inputs: a snapshot pulled with `--health --kb` and the tenant's `--failure-categories` file (Y1's, or V2's own
re-pull); a saved spec whose pages list NO panels (the presets draw) with the admin page's `statusDefault` left at
the writer's default (null) and `pages[].dateDefault` at the presets' (the writer fills both; a spec saved before
S4b opens as it is and takes the presets' months). The browser pane: served from localhost so the page's script runs
(a local file renders as a static picture), once in light and once in dark (the pane's colour-scheme emulation).

- D0 (the contract, before anything is built). Bradley reads the As-shipped (S4b) note under DSH-4 and rules on the
  executor's choices listed there (the kpi tile's "usual"; three customer-list panels rather than one; the one-time
  view's `months` meaning; the `health-off` and `templates-not-pulled` rows; the About tab's How-to prose as the one
  hand-written part; the leaders' About naming the tenant host). Pass bar: each confirmed or overruled; an overrule
  that changes what a page embeds is the builder's change before V2 builds a page.
- D1 (both presets built over a real snapshot). `node .gs-superadmin/plugin/scripts/dashboard-page.mjs --spec <spec>
  --snapshot <snapshot> --out-dir <pages>`. Pass bar: exit 0; both pages written; the summary's size report per page;
  the admin page's health tables, by the report's `tables` rows, hold NO sample table and no text rows
  (`health.failureSamples` absent; every `health.bounceReasons` row carries a category); the admin page with health
  on is well under 1 MB of health data (the `health.*` entries of `tables` summed; record the order of magnitude and
  the share of `bytes.data`); no warning fires on either page.
- D2 (the admin page in the browser pane, light). Serve the pages folder on localhost and open the admin page. Pass
  bar, each in turn, with no console error: the page opens on every program that sent, status badges on every row,
  "Running now" narrows to Active and the address carries `s=PROCESSING`; the headline tiles show the usual and "no
  previous pull to compare with"; the open-rate trend and the sends-by-month bars draw with the current month shaded
  and a table under each; the Programs, Emails, Steps (the notice when step detail is off) and Survey tables draw;
  the three customer lists draw with each account's programs underneath when accounts were pulled, or the
  accounts-off notice in each; the Health tab's six panels draw: send health against the usual, the program-health
  lists with the alarms first and the threshold chips moving the lists (14 / 30 / 60 / 90 beside the spec's), the
  failure reasons with each category's definition as its tooltip and expected failures behind the toggle, the "Other"
  signal and its terminal line where uncategorised bounces exceed a few percent, the schedules with the stale mark,
  the one-time programs with their mini bars, the error rate by program; the About tab's six parts; the caveats
  footer.
- D3 (the same page, dark). The pane's dark colour scheme: every panel, chart, badge and banner legible; the series
  colours distinguishable; no white block. Pass bar: nothing unreadable; a judgment call Bradley records, not a
  measurement (UX-1 owns the aesthetic; a "feels wrong" note here goes to S4d, never a finding).
- D4 (the leaders' page, light and dark). Pass bar: it opens on the closed months with "Include <month> (provisional)"
  one click away, and the click shows the current month; headline figures, the two charts, By group, the top and
  lowest ten, with Sent beside every rate; no Health tab, no customer list; `grep -c` of two account names from the
  admin page returns 0 on the leaders' page file; the About tab holds NO internal domain value and NO unsubscribe link
  value (`grep -c` of each on the file returns 0) while its recipients sentences read with counts; definitions show
  the plain definition and formula only.
- D5 (the figures are the engine's). For two programs Bradley picks: the admin page's Programs table and the open-rate
  report written over the same snapshot show the same sent, delivered, opened and open rate; one kpi tile's figure
  equals the Programs table's total row; the Health tab's program-health alarm rows equal `programHealth(snapshot,
  {days})` run in a node one-liner over the snapshot file for the same threshold (ids and lists; a difference is a
  filter or packing defect).
- D6 (the lists read true). Bradley reads the admin page's program-health lists and the failure-reasons panel on the
  real tenant: each alarm names a program he recognises as such, or the row is a finding; the category definitions
  read as product wording, never a tenant's text; the "Other" share and its terminal line match what the snapshot's
  `failureSamples` show (the `health` verb is S5's).
- D7 (the stale banner and the page-level health banner). Open a page built from a snapshot older than the spec's
  freshness: the stale banner shows the age, the cadence and the threshold. Build from a snapshot whose health pull
  lost a part (Y1's, if any part read `call-failed`, else one edited offline): the admin page's banner names the part;
  the leaders' page carries none.
- D8 (CSV from a health view). Download CSV on the program-health panel and on the failure-reasons panel; open each in
  a spreadsheet. Pass bar: one row per judged program with its list and why; one row per category with its table; no
  formula evaluated; the file names carry the dashboard, the page, the panel and the pull's time.

### Result — V2 first sitting @ hb-20261010-01 (tester, 2026-10-10; dev clean and level at c758021, the S4c branch merged; canary matched; production tenant, reads only, one call at a time; paused by Bradley to finish in V2.5, which continues from this block)

Section status: CLEARED (second sitting, 2026-10-11: D0's six remaining choices ruled with the pages open; D1 to D8 CLEARED at the first).
- D0: the leaders' About naming the host CONFIRMED; the kpi "usual" (the window's finished months) CONFIRMED with a backlog note.
  Bradley asked for visuals before the rest; owed to V2.5 with the page open: the three customer-list panels, the one-time view's
  months, the health notices' refresh-only line, the About "How to use" prose, Sent not hideable beside a rate, the 5% threshold.
  Second sitting, with the round's admin page and the accounts-on scratch build open: (2) three panels CONFIRMED, the parenthetical
  dropped from all three titles; (3) the months knob CONFIRMED as a display width (the Health tab ignores the month filter by design;
  the layout ruling, tabs above a per-tab filter bar, goes to UX-1); (4) refresh-only notices CONFIRMED; (5) generated prose CONFIRMED as
  the mechanism, wording to UX-1; (7) Sent locked beside a rate CONFIRMED, the Columns control's presentation a UX-1 discussion item;
  (8) 5% fixed CONFIRMED. Backlog from (2): a confidence-adjusted engagement score column (LTR-17).
- D1 CLEARED: both pages built; the admin page's health tables hold no sample table (failureSamples absent) and every bounce row carries
  a category (2705 rows, 0 null; "other" never negative); health bytes 0.21 MB, 20% of the data share; no warning on either page.
- D2 CLEARED (headless Chrome, light): the page opens on every program with status badges on every row; "Running now" narrows to
  Active; the headline tiles show the usual ("Usual a month: …") and the no-previous-pull line; the trend and the bars draw with the
  current month shaded and a table under each; Programs, Emails, Steps (the step-detail-off notice) and Survey responses draw; the
  three customer lists show the accounts-off notice; the Health tab's six panels draw: send health against the usual, program health
  with the alarms first and the chips 14 / 30* / 60 / 90 moving the lists (one program to Working as expected at 90), the failure
  reasons with the expected toggle, the "Other" signal (8% of bounces, over a few percent) with the terminal line, the schedules
  (225 rows), the one-time programs (68), the error rate by program (195); the About tab's seven parts; the caveats footer.
- D3 CLEARED on Bradley's read (dark: "seems ok to me right now with a cursory overview"); the designer's pass is S4d.
- D4 CLEARED: the leaders' page opens on the closed months with "Include <month> (provisional)" one click away (the click shows the
  current month); headline, two charts, By group (14), the ten highest and ten lowest with Sent beside the rate; no Health or Templates
  tab; 0 occurrences of either internal domain, either unsubscribe link or any template subject in the file; the recipients sentences
  read with counts ("the company's own 2 email domains"); definitions carry no source detail.
- D5 CLEARED: 5 of 5 picked programs equal the report over the same snapshot on sent, unique recipients, delivered, opened and open
  rate; the Sent tile equals the total row; the Program health rows equal `programHealth(snapshot, {days: 30})` over the file
  (schedule-ended 29, admitting-nobody 5, no-recent-sends 2, finished 5, cannot-judge 3, ok 21).
- D6 CLEARED with a finding: the lists "in general seem right" to Bradley; his question why identical one-and-done campaigns sit on
  Finished (no schedule documented) and on Schedule ended (a daily cron boxed into one day) is F-502, ruled normal by him after the
  two-day case was named; the category definitions read as product wording; the "Other" share and its terminal line match the
  snapshot (8%).
- D7 CLEARED: a build over the Oct-3 snapshot with a 3-day freshness shows the stale banner (age, cadence, threshold) with the refresh
  line on the admin page and without it on the leaders'; a build over the spot snapshot whose participant-failures part read
  call-failed shows the admin banner naming the part and none on the leaders' page.
- D8 CLEARED: the Program health CSV (65 rows: Program, Status, List, Last send, Days silent, Why) and the failure-reasons CSV (70 rows:
  Table, Reason, Kind, Expected, Count, Usual a month, Change) open in Excel with 0 formula cells; names carry the dashboard, page, panel
  and the pull's time.


## TPL-1 / TPL-2 — the templates line on a real tenant: template text in the snapshot and the gap-fill into the knowledge base, the Templates tab's search against email-report `search`, the drawer, the page size with text, and the click tracking state read from each template's own link settings (banked 2026-10-10, builder, Session S4c; verdict at V2)

Owed by: V2, the batched verdict session after S4c, in the consumer workspace with the plugin loaded from `dev`
(the PR for `feat/jo-dash-s4c-templates` merges on green CI plus its review round, before V2).
Token: hb-20261010-01 (minted by `dev-utils handoff --branch feat/jo-dash-s4c-templates` on 2026-10-10; the bus's
Under test line names it; this section is keyed to it). PR #45 to dev, unmerged at banking.
Why it is banked: template content, the gap-fill, the Templates tab and its search were built offline against the
fictional tenant's template payloads and a fixture knowledge base of five docs (one legacy). How a real tenant's
templates read — a knowledge base that lacks most of the referenced templates (the spike measured ~60% absent), real
subjects and bodies with real tokens, real link maps with their stale entries, a template Bradley knows was edited
after it last sent, the size of an admin page carrying a tenant's template text — cannot be measured without a
tenant. The gap-fill makes `jo email template --id` calls (reads), one at a time, within the budget the skill asks
for; nothing else in this section calls the tenant beyond the pull itself.
Tenant data stays in the workspace: snapshots, pages and the knowledge base live under the workspace's ignored
paths; no subject, body, template name, count beyond an order of magnitude, or link is copied into this file or the
bus.

THIS LIST IS COMPLETE. It is everything this round judges for TPL-1 and TPL-2; a check that is not here is not
owed, and a thing the round thinks should be here is a finding. Nothing is "noted on the verdict": anything observed
beside a pass bar becomes an F-section on the bus, or a GitHub issue, before the round closes.

Inputs: the workspace's knowledge base (templates documented by email-report's gap-fill before S4c carry no
`- linkTracking:` bullet: that is the "unread" case by construction); a plan and pull of
`/gs-superadmin:email-engagement report --by-template` with `--kb`; the dashboard spec from DSH-4's inputs with
the admin page's Templates tab on (the preset's) and the exec page's off (the preset's); the browser pane served
from localhost, light.

- T0 (the contract, before anything is pulled). Bradley reads the As-shipped (S4c) notes under TPL-1 and TPL-2 and
  rules on the executor's choices listed there (the month-grain "edited after last send" flag; a doc with no capture
  date judged behind; the gap-fill driven by the skill from the plan's files rather than by the pull; the Templates
  tab's columns; the drawer's wording; the title searched only for a template whose text the snapshot holds). Pass
  bar: each confirmed or overruled; an overrule that changes what a snapshot or page embeds is the builder's change
  before V2 pulls.
- T1 (every referenced template resolves, and the gap lands in the knowledge base). Run the skill's plan. Pass bar:
  `estimate.templates` names the referenced count (sends over the window plus the selected programs' designs), the
  missing, behind and unread counts, the seconds, the domain and id field the manifest records, and the three files
  beside plan.json; the skill asks when `planned` is over 50 (or fills without asking at 50 or fewer) with the counts
  and seconds, and the three commands run as written with placeholders substituted (upsert-batch --partial for the
  missing, mark --status stale for the rest, describe-batch --keys-file --limit within the budget, re-invoked while
  `moreRemaining`); each fetched template lands as a doc under the templates domain carrying the `- linkTracking:`
  bullet, with its manifest entry documented and a fresh capture date; the plan re-issued unchanged reads
  `planned` 0 (or the remainder past the budget); the run then reports `honesty.templates.missing` 0 for a full fill
  and the Subject column reads for every row of the report's per-template table. Record the order of magnitude of
  the referenced count and of the gap.
- T2 (the "edited after last send" flag). For two templates Bradley knows were edited after their last send, and
  two he knows were not (one recently sent): the admin page's Templates tab row says yes with the modified day, no,
  or "within its last send month" as the case is; the drawer agrees. Pass bar: each reads as he knows it, or the row
  is a finding (note the month grain: an edit inside the last send month reads neither yes nor no, by design).
- T3 (the in-page search against email-report `search`). For three terms Bradley picks — one plain word, one
  two-word phrase run as two words with "all the words", one he expects to hit a token's label (a field name such as
  the product name) — run `/gs-superadmin:email-report search` with the same options over the same knowledge base
  and search the admin page's Templates tab with the global filters cleared (every status, the whole window, every
  program). Pass bar: the same templates match in both, except a template the page holds no text for (not in the
  pull's programs, or missing from the knowledge base) which email-report may list, and except a term inside a raw
  token key, which email-report sees and the page does not (the documented divergence; the token's label matches on
  the page and not there); the page's snippets name the field and mark the hit.
- T4 (the drawer, and the page size with text). Open Text on a template Bradley knows: the subject, the body as the
  knowledge base holds it with tokens as field labels, the day it is as of, the caveat, the variants. Pass bar: he
  recognises the text; no HTML, no image, no script reaches the page (view-source: the body sits in a `<pre>` as
  text). The build's size report: `tables["dimensions.templates"]` bytes and share of `bytes.data` on the admin page;
  the exec page's entry smaller with the text withheld; `grep -c` of two subjects from the admin page returns 0 on
  the exec page file. Record both orders of magnitude; a warning naming template text is a finding to size, not a
  defect.
- T5 (the click tracking state from the template's own link settings, R19). For a template Bradley knows has link
  tracking ON in the editor and has never recorded a content click, and one he knows has it OFF: after the
  gap-fill their docs' `- linkTracking:` bullets read tracked-link-present and links-none-tracked, with the present,
  tracked, system and stale counts; the snapshot's click availability reads tracked (a real 0%) and not-tracked
  ("Not tracked" on the page and in the report); the plan's `unread` count dropped by those re-read. Pass bar: both
  as he knows them; a template whose editor shows one tracked link but whose bullet reads unreadable or stale-only
  is a finding naming the link map's shape (the reading is defensive on field spellings the spike did not record).
- T6 (completeness after the split, before T1). S4c ran as two sittings: the first stopped early with ONE unreviewed
  WIP commit (761958c) and a local carry-over file listing what was left; the second finished from that list. Before
  pulling anything, V2 confirms the branch holds every part the carry-over named, from the tree alone (on `dev` once
  PR #45 is merged, else on the branch):
  - the adapter: `grep -c "template-months\|templatesReferenced\|templateGap\|templateContentOf\|TEMPLATE_GAP_" plugins/gs-superadmin/scripts/engagement.mjs` reads at least 20; `estimate.templates` and `meta.templates` both named in it;
  - the engine: `grep -c "templatesView\|searchTemplateContent\|templateContent\|templateAvailability\|LINK_READINGS" plugins/gs-superadmin/scripts/engagement-query.mjs` reads at least 12;
  - the spec: `TEMPLATE_PANEL_TYPES`, `KNOBBED_PANEL_TYPES`, `pageTemplateContent` and the templates panel in BOTH presets in `dashboard-spec.mjs`; the F-486 loop names `"templates"`;
  - the builder and runtime: `templates-not-on-page` in `dashboard-runtime.mjs`'s LACKS and in `dashboard-page.mjs`'s `pageSnapshot`; `renderTemplatesPanel`, `data-search`, `data-open-template`, `data-tsort`, `tpl-close` in the runtime; `dimensions.templates` in the builder's size walk;
  - the report: `"Subject"` in both tables of `engagement-report.mjs` and `subject` in both CSV headers;
  - the doc path: `readLinkTracking` and `linkTrackingBullet` in `doc-lib.mjs`; `renderTemplateDoc` taking `linkRules`; `NON_CONTENT_LINK_RULES` imported by `template-doc.mjs` and `describe-batch.mjs`; `modified`, `linkTracking`, `lastVerified` on jo-report's template entry;
  - the fixtures and goldens: `templatePayload`, `TEMPLATES_DOMAIN`, a `noSends` step and the legacy `tpl-day7` doc in `acme-tenant.mjs`; `jo email template` answered by `answer()`; the snapshot golden's template rows carry `content` and `lastSendMonth`; the query golden holds the three "templates view" cases; the fixture spec lists a templates panel; the two page goldens embed `data-type="templates"`;
  - the suites: `node plugins/gs-superadmin/test/engagement.mjs` names "TPL-1" in at least 8 PASS lines; `engagement-query.mjs` prints "A-6 differential"; `dashboard-page.mjs` prints "the Templates tab draws"; `contract-conformance.mjs` prints "templateAvailability reads the marker"; `template-doc.mjs` prints "linkTracking bullet"; the tracer passes with `template-months` in its unit table and `data/reader-shapes.json` naming `builderMetadata.links`;
  - the prose: SKILL.md step 2 carries the `estimate.templates.planned` ask and the three `<templates-domain>` lines; the README's `--by-template` bullet names the knowledge base; CHANGELOG 0.49.0 and plugin.json 0.49.0 agree;
  - the ceremony: the bus's Under test line reads hb-20261010-01 with its Blind spots line; the builder comment of 2026-10-10 is on the bus; this section is keyed to the token; the plan's ledger carries the 2026-10-10 S4c line and both As-shipped (S4c) notes.
  Pass bar: every item present; an absent one is a finding (a "part 2" that never landed), fixed before T1 runs.

### Result — V2 first sitting @ hb-20261010-01 (tester, 2026-10-10; dev clean and level at c758021, the S4c branch merged; canary matched; production tenant, reads only, one call at a time; paused by Bradley to finish in V2.5, which continues from this block)

Section status: CLEARED (second sitting, 2026-10-11: T0's last choice ruled with the scratch build open; T1 to T6 CLEARED at the first).
- T0: TPL-1's six choices CONFIRMED (the month grain with a backlog note on a later day-grain option; the orphan doc as missing; the
  orchestrator drives the gap-fill, after three rounds of scenarios, with the S5 runner's template branch recorded under PUB-1; the
  sends-referenced set; unreadable not re-read; 3 s a template). TPL-2 with the page open: the columns OVERRULED (an edited-after-last-
  send state column yes / no / unclear / unknown beside a separate last-modified column, both sortable, a filter as a maybe; the flag
  words fold into it), the drawer wording KEPT, the Text button in the Emails and Steps tables KEPT (open in place noted for S4d), the
  search OVERRULED to cover a template's name whether or not its text is on the page; the text-less leaders' Templates tab owed to
  V2.5 (a scratch build is ready for it). Second sitting: (5) the tab KEPT on a text-less leaders' page, its notice REMOVED (names and
  figures only; naming an absent search invites a request for it); subjects shown but not searchable on a leaders' page is backlog
  (LTR-16); the About tab's text-less sentence drops its "no search" clause with it (UX-1 wording).
- T1 CLEARED: `estimate.templates` named the referenced count (278: 259 from sends plus 19 design-only), missing 164, behind 10,
  unread 104, 834 s, the domain and id field the manifest records, and the three files beside plan.json; the skill asked (planned over
  50) with the counts and seconds; the three commands ran as written with the placeholders substituted (register 164: 153 added, 11
  matched existing; mark 114 stale; describe-batch 278 selected, 278 documented, 0 failed, `moreRemaining` false), each doc carrying the
  `- linkTracking:` bullet (220 links-none-tracked, 24 tracked-link-present, 34 unreadable); the plan re-issued unchanged read planned
  0; the run reports `honesty.templates.missing` 0 and the Subject column reads on 119 of 119 template rows. Orders of magnitude: the
  referenced set 10^2, the gap about 59% (the spike measured ~60%). Wall time 556 s against 834 estimated.
- T2 CLEARED: two templates Bradley knows were edited after their last send read "yes, on <day>" (one confirmed, one "mostly true");
  two he knows were not read "no (text as of <day>)", one of them sent this month; the drawer agrees with the rows.
- T3 CLEARED: three terms against `/gs-superadmin:email-report search` typed by Bradley over the same KB (its sweep reconciled on 3
  pages; its gap-fill skipped on his word, 738 gaps across the whole KB): a plain word 20 = 20 in scope (7 more out of scope); two
  words with all the words 56 = 56 (5 out of scope); the token-label term 35 on the page against 1 in scope from email-report, the 34
  extra every one a merge-field label (both words only inside `{…}` labels in the rendered text), the documented divergence; the
  page's snippets name the field and mark the hits.
- T4 CLEARED: the drawer's subject, body with tokens as field labels, the as-of day, the caveat and the modified / last-send line
  recognised by Bradley; the body sits in a `<pre>`; 0 images, scripts or anchors in it; the leaders' page carries none of the text.
  The admin page's template text is 0.53 MB, 51% of its data share; the exec entry 0.07 MB with the text withheld; a warning did not
  fire. Bradley's readability note on the plain-text rendering goes to the backlog.
- T5 CLEARED: a never-clicked template whose editor shows tracked links reads tracked-link-present in its doc and a real 0% on the page
  and in the report; a template whose three content links are all untracked reads links-none-tracked and "Not tracked"; a template
  with no readable link list reads "(tracking unknown)"; the plan's unread count fell from 104 to 0 after the fill.
- T6 CLEARED, first, from the tree: every item present; six suites green (engagement 338, query 134, page 159, contract 293,
  template-doc, the tracer); two bank proxies read differently than written with nothing absent behind them (the engine identifier
  line count 7 against "at least 12", all five names defined once each; the exec golden carries no Templates panel because the fixture's
  exec tab is off; the contract and tracer checks live in the suites' source, which prints summaries).


## DSH-3 — the dashboard interview walked by Bradley on a real tenant (banked 2026-10-12, builder, Session S5 @ hb-20261011-02; verdict at S5-V)

Owed by: S5-V, the verdict session for S5, in the consumer workspace with the plugin loaded from the working tree
(`claude --plugin-dir <repo>\plugins\gs-superadmin`, started FROM the workspace so the guard is armed; LTR-19), on
the production tenant, reads only.
Token: hb-20261011-02 (minted by `dev-utils handoff --branch feat/jo-dash-s5-entry-command`; the bus's Under test line names
it; this section is keyed to it). PR to dev, unmerged at banking.
Why it is banked: the interview was built and walked offline against the fictional tenant and the stand-in CLI
(test/dashboard.mjs, 55 checks). How its questions READ to the person they are for, whether the proposed groups make
sense on a tenant with hundreds of programs, whether the estimate's minutes hold, and whether the skill's prose makes
the model stop or guess anywhere, can only be judged by Bradley walking it himself. Tenant data stays in the workspace:
the spec, the preview, the snapshots and the pages live under `<slug>/dashboards/` (git-ignored); no program, account
or message text is copied into this file or the bus.

THIS LIST IS COMPLETE. It is everything this round judges for DSH-3; a check that is not here is not owed, and a
thing the round thinks should be here is a finding. Nothing is "noted on the verdict": anything observed beside a
pass bar becomes an F-section on the bus, or a GitHub issue, before the round closes.

Inputs: a workspace with the tenant's KB (every program documented as far as V2 left it); a valid login; Bradley at
the keyboard; a dashboard name he chooses (`<dash>`); for I9, a file with the company's brand values (or pasted values)
and a local PNG or JPEG logo.

- I0 (the questions table, before anything runs). `node .gs-superadmin/plugin/scripts/dashboard.mjs questions` and
  `… costs`. Pass bar: 22 questions in the order the plan lists (tenant, purpose, audiences, programs, grouping, the
  recipients three, the failure settings, the window, the cadence, the metrics, the look, the tabs, the leaders'
  names, the customer lists and their detail, step detail, the expected reasons, the dry run, the estimate, the save);
  exactly three judgment nodes (purpose, grouping, look); every setting the spec writer describes has one cost.
  Bradley reads the `ask` wordings and rules on any that is not in his terms (a finding each, polish).
- I1 (the skill as the front door). Bradley types `/gs-superadmin:email-engagement dashboard new <dash>` in the
  workspace session (the skill is model-invocable, so the tester may also invoke it). Pass bar: the model runs
  `dashboard.mjs new`, then `next`, and asks the FIRST question with AskUserQuestion using the summary's `ask` and
  `options` verbatim; the tenant pre-flight was automatic (stderr names the host); no question the script did not
  return is asked, none it returned is skipped.
- I2 (the purpose, a judgment node). Pass bar: the prose pushes back on a vague answer once, then passes the agreed
  sentence through `answer <dash> purpose`; the About tab of the built page shows it.
- I3 (programs, sent-since first). Pass bar: the sent-since options come first; Bradley's pick lands in the spec
  (`show`/the About tab's Programs line).
- I4 (grouping, a judgment node). Pass bar: `next` makes the plan (cheap calls; seconds to a minute) and hands over
  the suggestion file; the prose FIRST asks whether a structure exists (folders, a naming convention, a field), then
  proposes a two-level TABLE from the characteristics with the count each rule would match; folders offered with the
  plain statement that names are unavailable; Bradley edits or confirms; the rules are written and the About tab's
  Groups part shows each rule with its match count; "N new programs ungrouped" in the refresh summary.
- I5 (internal domains, test accounts as company records, the unsubscribe link). Pass bar: the test-account question
  speaks of company records by id or name, never addresses; a name Bradley gives is looked up ONCE (one `rp run` on
  the company object in the fake-state-free session: the guard shows no ask, a read) and its id lands; the unsubscribe
  question explains F-470 and that a bare host names every page.
- I6 (the window and the cadence). Pass bar: the window question quotes the first pull's minutes for the current
  months and says it scales; the cadence question shows "stale after N days, from your cadence" per option; the
  chosen cadence's freshness is in the spec.
- I7 (the Health tab's minutes, customer lists in Bradley's wording with their cost, step detail with its minutes).
  Pass bar: each quotes minutes read from the plan (`estimate.health.addsSeconds`, `estimate.accounts.addsSeconds`,
  `estimate.stepDetail.addsSeconds`), the customer-lists option text is the plan's wording ("Do you want this dashboard
  to tell you the top customers that aren't opening or are bouncing, or only how each program is doing?"), with how to
  add them later and who can look a company up; "May the leaders' copy name customers? Default no" is asked.
- I8 (the dry run). Pass bar: `answer <dash> dry-run yes` makes a pull with customer lists, health and step detail off
  (minutes; the summary's calls), writes preview pages under `<dash>/preview/`, and Bradley opens the admin preview in a
  browser: real program names, the filters working, the About tab's purpose and groups.
- I9 (the look): see § UX-2 below (the brand walk is banked there and judged in the same sitting).
- I10 (the estimate and the save). Pass bar: the estimate names the full refresh's calls and minutes against the
  token's remaining life and the knowledge-base gap priced; `answer <dash> save yes` saves and runs the first refresh
  (§ PUB-1 R1 judges the refresh itself); `dashboard list` shows the dashboard saved with its last pull.
- I11 (the fast path). On a second name: `… dashboard new <dash2> --fast-path`. Pass bar: `next` goes straight to the
  estimate after the tenant check; the look was not asked; the resulting spec is the defaults.
- I12 (the draft holder). Bradley starts an edit (`… new <dash>` over the saved spec) and, in a second terminal as
  another user name (`--by other`), asks for `next`. Pass bar: refused naming the holder and the time; `--take-over`
  continues it and records whom it was taken from; `list` shows the draft with its holder.

S5-V first sitting (2026-10-12, tester @ hb-20261011-02, the branch at dee1403; the desktop-app session read no canary and was resumed in a terminal FROM THE WORKSPACE with --plugin-dir, where the canary matched and the guard is armed; production, reads only) — SPLIT ON BRADLEY'S RULING: I1 to I10, with I9's B1 to B4, are deferred to the second sitting after the builder's fix round, because I0's read ruled most of the wording and four questions away (F-511); walking the as-built interview would re-find what is already ruled.
- I0 PASSED on its mechanical bars (22 rows in the plan's order; three judgment nodes; the cost table covers the 81 described setting paths exactly: 46 rebuild, 24 pull, 5 in-page, 5 identity, 1 reselect) and RULED on its wording bar: one polish finding, F-511, 20 instances (four questions dropped, two moved, every placeholder option given a follow-up ask, the rest reworded); the rulings and the revised wordings are in the maintainer's plan under DSH-3.
- I11 PASSED: `next` went straight to the estimate after the tenant check (20 answered, 2 remaining); the look never asked; the draft holds the writer's defaults — which are not the questions' labelled defaults (F-512: the selector took every program with a send in the window, 195 selected of 573 listed, where the question labels 90 days as the default; no group rule, so every program ungrouped). The plan took 2 min 54 s: 150 calls / 1132 s estimated, the login covering it, 0 programs behind.
- I12 PASSED: `next --by other` refused, naming the holder and the time; `--take-over` continued it and the draft records whom it was taken from; `list` shows the draft with its holder and time beside the saved dashboard.
Re-banked for the second sitting after the S5 fix round (builder, 2026-10-12, feat/jo-dash-s5-entry-command @ hb-20261012-01, PR #47): I1–I10 on the NEW table (F-511's rulings applied; F-512's fast path). I0, I11 and I12 stay as passed at the first sitting; I11's bar is now "next arrives at the closing step with every question defaulted (the fast-path spec equals the by-hand defaults)" and was judged offline by the suite, not re-owed. Pass bars, the token being the fix round's:
- I1 (the skill as the front door). Bradley types `/gs-superadmin:email-engagement dashboard new <dash>`. Pass bar: the model runs `new`, then `next`, SAYS the tenant statement from the summary's `said` ("This dashboard is for <tenant>, the CLI's active tenant, whose knowledge base it reads.") before anything else, then asks the programs question (the FIRST question: no purpose, no audiences) with AskUserQuestion using the summary's `ask` and `options` verbatim; no question the script did not return is asked, none it returned is skipped; every `ask` read to Bradley is the ruled wording (a departure is a finding on F-511).
- I2 (the programs and the follow-ups). Pass bar: the six options as ruled; Bradley picks "since a date you give" or "named programs" once: ONE follow-up ask per value, in plain words, and the composed value lands in the spec (`show`) without Bradley ever seeing an option id or a grammar; then he answers the default (or 180 days) for the real dashboard.
- I3 (the window, directly after the programs). Pass bar: the ask quotes this tenant's per-month minutes, the 13-month total and the two-year total from a plan made here (seconds to a minute of cheap calls); the default option carries the minutes; a "last N months" pick asks "How many months?" as its own question; the kind and the months land in the spec.
- I4 (grouping, a judgment node, on ONE plan). Pass bar: `next` at grouping makes NO second plan (the window answer moved the window only); the prose FIRST asks whether a structure exists, then proposes the two-level table from the characteristics with the count each rule would match; folders offered with the plain statement that names are unavailable; Bradley edits or confirms; the rules are written and the About tab's Groups part shows each rule with its match count.
- I5 (internal domains, test accounts, the unsubscribe link). Pass bar: the three asks as ruled (a few minutes per domain, test accounts as company records with the "Acme Test" example and GSIDs named as such, the standard link recognised on its own with the `email-settings` example); the list follow-ups ("Which domains? One per line") asked as their own questions; a name Bradley gives is looked up ONCE (one `rp run` on the company object; the guard shows no ask, a read) and its GSID lands; none/none/none accepted as "none".
- I6 (the failure settings). Pass bar: one ask, two questions in it, each ending in its question, with this tenant's count of programs with failures and the minutes to read them all; "keep both defaults" lands 5 and 25; the change path asks each value on its own and "keep" keeps one.
- I7 (the look, the tabs, the customer lists and the leaders' names). Pass bar: the look's three options as ruled (skip, a file, pasted values) and NO brand-skill path (I9 walks the file or pasted values: § UX-2); the tabs ask with one bullet per tab, Health's minutes from the plan with the categories' share and K4's category-cost sentence (56 categories × 6 classes on this tenant), the shared-pull sentence, Templates adding no time; the customer-lists ask in Bradley's words with the first pull's minutes with and without the lists; with the lists ON, "May the leaders' page carry the customer lists, with account names?" is asked next and then the lists' detail (the three lists with the floor; "per segment" defined); with the lists OFF, neither is asked; step detail's ask with its minutes; the expected reasons naming the six shipped ones.
- I8 (the closing step: the dry run). Pass bar: once every setting is answered, the skill asks ONE question with the closing ask (the full refresh's calls and minutes, the login's remaining minutes, the manual-refresh statement) and the four options verbatim; "Run a dry run first" makes a pull with customer lists, health and step detail off (minutes; the summary's calls), writes preview pages under `<dash>/preview/`, and Bradley opens the admin preview in a browser: real program names, the filters working, the About tab opening with the fixed statement and the groups; the closing step is then asked again without the dry-run option.
- I9 (the look): see § UX-2 (the brand walk is banked there and judged in the same sitting).
- I10 (save and the first refresh). Pass bar: "Save and run the first refresh now" issues `dry-run no` (already answered), `estimate yes`, `save yes`; the save's refresh CONTINUES the closing step's plan (the summary's `pull.calls.reused` above 0; no second plan of cheap calls before the pull); `dashboard list` shows the dashboard saved with its last pull; the final report's Refreshes line says refreshes are manual with the command and the README recipe; the admin page's header reads "Data pulled <time>, N days ago, from <host> … These pages are not live …" in a browser (the age painted from the clock), with no stale banner anywhere, and its About tab lists neither Freshness nor Refresh among the settings and ends with "How to refresh" carrying the manual statement.
- Re-verification of F-511 and F-512 on their Fix lines: every departure from a ruled wording is an instance on F-511 (the class, never a new number); the fast path's spec on a second name (`--fast-path`) carries `sentSince: 90d` and the Recurring / One-off and model rules (`show`), and `next` on it arrives at the closing step with `defaulted` naming twelve questions.
S5-V second sitting (2026-10-12, tester @ hb-20261012-01, the branch at 75d9a19, clean and level; the session launched from the workspace with --plugin-dir, canary matched; production, reads only, one call at a time; three logins: at the start, before the save, before R8). Bradley typed `/gs-superadmin:email-engagement dashboard new Digital Outreach Health` and answered as the admin; every `ask` at I1–I10 read to him verbatim as ruled; the prose made the tester GUESS twice (what `--owner` is: nothing in the skill says; the rule fields a characteristic rule takes: the prose names the kinds, so the grouping script's source was read) and stop nowhere.
- I1 PASSED on its bars, with one departure logged as F-514 (normal): the tenant statement was returned as `said` and said first; the first question was programs (no purpose, no audiences); but the programs question carries SIX options and AskUserQuestion holds four, so the skill's "options verbatim as the choices" could not be followed (asked with four; the last two reachable through Other).
- I2 PASSED on the wording (ruling 4 verbatim; the six options); Bradley chose "The last year" (191 of 573 programs; 1 deleted, recorded), so the programs follow-up was not exercised there; follow-ups were exercised on internal-domains, test-accounts, unsubscribe-links (each asked as its own plain question, the value composed, no id seen). F-511 instance 21: the test-accounts option asks BOTH follow-ups (GSIDs, then names) — Bradley, having given GSIDs, asked why names were wanted.
- I3 PASSED: directly after programs; the ask quoted this tenant's 1.5 minutes a month, 19 minutes for the 13 months, 35 for two years, from one plan (about 3 minutes of cheap calls); the default option carries the minutes; four options; `rolling:13` landed.
- I4 FAILED on its match-count bar → F-515 (normal). `next` at grouping made NO second plan (the estimate block identical, the token seconds unchanged); the prose asked for a structure first, proposed the two-level table from the suggestion file with counts (Recurring 127 / One-off 68; a model group each), folders offered with the names-unavailable statement; Bradley confirmed; the rules were accepted — but the file names the model by its display name and the rule tests the code, so the About tab read "Recurring / Ungrouped" for all 191 and the refresh summary said "0 new programs ungrouped". Repaired live by `change groups=<json>` with the codes (rebuild only): the About tab then lists every rule with its count (Recurring 70, One-off 121; Email chains 33 / 113, CSAT 27 / 2, Dynamic 9 / 6, Generic 1) — the proposal's recurring split (plan, KB) is not the snapshot's; the rules read "programs whose model is DRIPV2" (instance d).
- I5 PASSED: the three asks as ruled; "Which domains? One per line" and the link's follow-up asked as their own questions; two domains, two GSIDs (`{"ids": [...], "names": []}`), one link landed; no lookup (GSIDs given, the name path unexercised); "none" accepted as `[]` on names.
- I6 PASSED: one ask, two questions in it, 153 programs with failures and 21 minutes to read them all; "keep both defaults" landed 5 and 25 (the change path unexercised).
- I7 PASSED: the look's three options and no brand-skill path; the tabs ask with one bullet per tab, Health 31 minutes with the categories' 17 and K4's sentence ("The 56 bounce categories … 336 counted calls … 56 × 6 recipient classes …"), the shared-pull and Templates sentences; the customer-lists ask in Bradley's words with 67 and 36 minutes (priced after the domains and test accounts moved the plan; the window ask's 19 was priced before); lists ON → leaders' names asked next (no), then the lists' detail (keep; its most-bounced follow-up reads "at least 0 delivered": instance 23); step detail 5 minutes (yes); the six expected reasons named (none).
- I8 (the closing step, the dry run): the closing step came after the exact re-plan with the ruled ask (763 calls, 72 minutes, "your login has about 30 minutes left: not enough …"), four options verbatim with their `answers`; Bradley chose SAVE NOW, so the dry run and the go-back ran on an EDIT of the saved dashboard instead (below), and the "closing step asked again without the dry-run option" bar FAILED there → F-516 (normal): an edit's `next` goes back to the programs question (3 answered, 15 remaining). Unmeasured on the new flow.
- I9: § UX-2 (below): B1–B4 PASSED on a PROXY brand file (Bradley had none handy); the real brand input is a blind spot.
- I10 FAILED twice before passing, both logged: `save yes` saved the dashboard and its first refresh stopped at the budget gate before any call (73 minutes needed, 60 of login) → F-513 (normal; Bradley's ruling: checkpoint across logins); narrowed on his call (`change accounts.pull=false`, priced "about 72 minutes" from the old plan: instance 24), its pull was refused as a resumed plan with moved parameters, `refresh` likewise, `refresh --full` named the remedy (remove `refresh-state.json`) → F-512 REOPENED (re-declared normal). After the state file was removed: a fresh plan (the "continues the closing step's plan" bar MOOT here: that plan was the lists-on one), the pull stopped on the expired token after 433 calls (exit 3, resumable: R5's mid-pull variant measured), resumed after a login (80 made + 436 reused, exit 0; full, "no previous snapshot"; lookbackDays 30 from the longest period, the tie now named); `dashboard list` shows it saved with its last pull; the final report's Refreshes line as the skill writes it; Bradley's eye on the admin page: "Data pulled … today, from <host> … These pages are not live …" PASS; no stale banner PASS (the word survives only on the Health schedules panel's doc-age mark, kept for Bradley's ruling); the About opens with the fixed statement PASS; Groups with counts PASS (shown twice: a UX-3 note); neither Freshness nor Refresh listed PASS; "How to refresh" present, but Bradley: "I'm honestly not sure how I would run that given those instructions" → F-511 instance 26, and its copy line omits `--kb`, refused in this two-KB workspace → F-503 REOPENED.
- Re-verification: F-511 — every `ask` verbatim as ruled, but six departures (instances 21–26: the names follow-up after GSIDs; `cadence` on `list`; "at least 0 delivered"; the dry run's old-plan minutes; the estimate's stale token seconds; the How to refresh wording) → by this bar's own rule the section REOPENS with the instances (first reopen; tier polish stands unless Bradley re-declares). F-512 — the fast-path half VERIFIED on a second name (`defaulted` twelve, `sentSince: 90d`, Recurring / One-off plus a model group per model by code, no `<slug>`, the closing step reached, the look never asked); the section stays OPEN on its reopen (the save-continues-plan mechanism).
Section status: I1, I2, I3, I5, I6, I7 CLEARED; I4 FAILED (F-515); I8 FAILED on the edit (F-516) and unmeasured on the new flow; I9 CLEARED on a proxy; I10 CLEARED on its page bars after two logged failures (F-513, F-512 reopen); I0, I11, I12 stand. Not every arm passed: the section stays OPEN for the fix round of F-512, F-513, F-514, F-515, F-516 and F-503, with I4, I8 (new flow) and I10's first-refresh half re-owed.
Re-banked for the THIRD sitting after the S5 fix round 2 (builder, 2026-10-12, feat/jo-dash-s5-fix2 merged into feat/jo-dash-s5-entry-command @ hb-20261012-02, PR #47): the arms the second sitting failed or left unmeasured, on the new flow. I0, I1, I2, I3, I5, I6, I7, I9, I11 and I12 stand as passed; nothing they measured is redone. THIS LIST IS COMPLETE for the third sitting. Every `ask` read is still held to the ruled wording (a departure is an instance on F-511); the programs question is asked as a NUMBERED LIST in chat (F-514, ruled 2026-10-12), never through "Other".
- I4 (grouping, re-owed; F-515). On a new dashboard with the customer lists and Health on: `next` at grouping hands over the suggestion file; the prose proposes the two-level table FROM it (models by their display name, the rule's `is` the file's `model` code). Pass bar: the file's `programs` are exactly the programs the dashboard selects (the plan's selection: the count equals the saved dashboard's program count after the pull, unselected programs absent); each program row carries `model` (a code) and `modelName` (a name); the file's notes name which a rule tests; after the pull the About tab's Groups part lists every rule ONCE with the count the file's tally gave it (Recurring / One-off and each model group), describes a model rule by its display name ("Email Chain", never `DRIPV2`), and the refresh summary's `ungrouped` line counts a program with a supergroup and no group ("(K inside a supergroup with no group)") — with the proposal confirmed as written, 0 unless the file itself called a program's `recurring` unknown.
- I8 (the closing step after a dry run, on the NEW flow; re-owed). Pass bar: once every setting is answered the skill asks ONE question with the closing ask and the four options verbatim; "Run a dry run first" pulls with the lists, Health and step detail off, writes preview pages under `<dash>/preview/`, Bradley opens the admin preview (real program names, the filters working, the About tab opening with the fixed statement and the groups); the closing step is then asked again WITHOUT the dry-run option; its login clause says the logins a pull of this size takes when the login does not cover it ("about N logins of an hour: it runs as far as each login allows, stops, and continues when you log in and run it again"), never "log in again before it runs".
- I10 (save and the first refresh across logins; re-owed; F-513, F-512). On a pull priced above one login (the lists and Health on, this tenant: about 70 minutes). Pass bar: "Save and run the first refresh now" is NOT refused at a gate: the pull starts (stderr says it will take about N logins of an hour), runs as far as the login allows, stops with exit 3 keeping its calls (the summary's `error` names the calls made, "run gs-admin login, then run refresh <dash> again: it continues where it stopped", and about how many more logins), the pages untouched, `status` showing the resumable run; after a by-hand login the SAME command (the skill's P mode, or the refresh line with `--kb`) continues it (`resumed: true`, `pull.calls.reused` above 0) to exit 0; `dashboard list` shows the dashboard saved with its last pull and no `cadence`. F-512's half: between the stop and the resume, `change <dash> accounts.pull=false` (or any pull setting) is accepted, its pull ABANDONS the pending run (the summary's `done.abandoned {run, why}` names it, stderr said so) and plans afresh to a completed pull; no state file is removed by hand; the change's dry run prices "about M minutes" for the dashboard AFTER the change (the lists' minutes removed, not the old plan's figure).
- I13 (the edit; F-516). On the saved dashboard: `/gs-superadmin:email-engagement dashboard edit <dash>`. Pass bar: nothing is re-asked; the closing step comes first, saying "Nothing changed against the saved dashboard" with no save-and-pull option; `next --question tabs` (the Templates tab off on the admin page) is asked as one question through its follow-ups; the closing step then states "changes 1 setting (pages[].tabs[].enabled): the pages are rebuilt from the data already pulled, no pull" and its first option is "Save and rebuild the pages now (no pull)"; choosing it rebuilds (no tenant call) and the saved spec carries the change; a second edit that flips a pull setting prices the pull on a plan and offers "Save and run the refresh now".
- I14 (the copy lines; F-503). On the real workspace (two tenant KB folders): every line the admin page offers to copy, the About tab's How to refresh line among them, ends in `--kb <this tenant's folder>`; the How to refresh steps name the folder and say where to type the command, the login, the slash command and what a pull longer than the login does; each line pasted as drawn into a terminal in the workspace folder runs (a `change` line with `--dry-run` appended; the refresh line for real, or the health line) — none refused for the folder. Bradley reads the How to refresh statement: the bar is that he can say what he would do (instance 26).
- I15 (the scheduled recipe; F-517). From the README's Windows recipe alone: the runner `.cmd` written as printed (the path and folder substituted), the `schtasks /Create` line (with the Git Bash prefix when typed there) and `schtasks /Run`. Pass bar: the task fires and the runner's log holds the refresh's progress lines and summary; with no login within the hour the run exits 3 and leaves the pages; after a by-hand login the next firing (or `/Run`) resumes and exits 0; `schtasks /Delete` removes it; nothing the admin had to do is missing from the recipe (a missing step is a finding on F-517).
- Re-verification of the FIXED sections on their Fix lines: F-503 (I14), F-506 (the admin page's caveats footer holds BOTH `failure-samples-capped` sentences when both parts were capped: one naming refused participants, one bounce text), F-511 (every ask verbatim as ruled, the test-accounts question's three options with one follow-up each, `list` without `cadence`, "with no delivered floor" on the most-bounced follow-up, the estimate's confirmation quoting the login as read then, the How to refresh statement), F-512 (I10's half, and the fast path on a second name as before), F-513 (I10), F-514 (the numbered list on the programs question, the reply matched, no "Other"), F-515 (I4), F-516 (I13), F-517 (I15).
Section status (THIRD sitting, 2026-10-13 @ hb-20261012-02, tester): I4, I8 (new flow), I10, I13, I14 CLEARED; I15 CLEARED on the recipe (create, fire without a login exit 3, fire after a login, delete) and FAILED on its resume arm — F-519 (normal), a new mechanism (the adapter's resume replays a split row as final), not the recipe's; the Fix-line re-verification: F-503, F-506, F-512, F-513, F-514, F-515, F-516, F-517 VERIFIED; F-511 DEFERRED past 0.51.0 on Bradley's ruling (instance 27: his read of the ruled How to refresh statement did not reach what he would do; the five gaps and the tester's answers on the bus). F-518 (polish) logged beside. The section is CLEARED as banked; F-519 is its open finding for the next fix round, with I15's resume arm re-owed under it.

Re-banked for the FOURTH sitting after the S5 fix round 3 (builder, 2026-10-13, feat/jo-dash-s5-fix3 merged into feat/jo-dash-s5-entry-command @ hb-20261013-01, PR #47): the resume arm the third sitting failed, the ruled wording read once more, and the polish set on the real pages and a real plan. Every arm the third sitting cleared stands; nothing it measured is redone. THIS LIST IS COMPLETE for the fourth sitting. Production, reads only; Bradley present for the one read that is his.
- I15 resume (F-519). The scheduled task from the README's Windows recipe (or the refresh line by hand) on the real dashboard. Pass bar, the measured path: a firing (or run) that stops PARTIAL on a call the server did not answer (exit 4) names the call in its summary's `error` — the family, the programs it covered when the call named any, "timed out on the server twice (a server timeout)" — says the next run "retries what failed and continues where it stopped", and has no empty slot before "run refresh"; the run's status.json entry carries `runs: 1`; after a login the next firing (or the same line) RE-RUNS that call as a fresh attempt (its progress line is made, not reused: `calls.retried` above 0 when the stand-in or the server answers on the retry, or `calls.made` counting it) and, when the server answers, exits 0 with a new snapshot and the pages moved; a second partial on the same call says "in 2 runs so far". If no call times out on the sitting (the measured timeout was the server's), the arm is a HAND-STOPPED run with a failed row: stop a refresh after any call has failed (or edit a `split` row of an unsplittable family into the pending run's fetch-log, the tester's own repro) and run the line again — it must make that call again (one more `rp run` on that family in the log), never stop within seconds with the same `failed` entry and `calls.made: 1`. No state file is removed by hand. The pull's status is read from the run directory the state file names, or its `-lb<days>` twin.
- The How to refresh statement, read by Bradley once more (F-511 instance 27). On the real About tab (the admin page), at a new or edited dashboard's closing step, and in the save summary's `pullAgainText` relayed by the skill's final report: the ruled wording of 2026-10-13 verbatim with the real folder and slug filled in — the lead, the three numbered steps (the folder that CONTAINS the knowledge-base folder, the login with the browser, the refresh line with Copy and "Nothing else is needed"), the "What you will see" paragraph, the session and schedule paragraph; the leaders' page keeps its one sentence. The bar is the one the third sitting set: he says what he would do (which folder, whether to go there before the login, whether anything beyond the one line is needed, how done or another login shows, whether the terminal says so) — with no "ask Claude".
- F-518's two lines on the real dashboard. (a) Stop a refresh on the login (or take the third sitting's stop), log in, run the refresh line: the first stderr line reads "continuing the refresh of <dash> (run …): about N minutes of its M minutes remain, the calls already made are reused; the login has L minutes left, …" with N below M, and the summary's `budget` carries `continuing: true`, `neededSeconds` below `planSeconds`, `loginsNeeded` for the remainder (1 where the remainder fits one login). (b) `new <saved dash>`, `next --question step-detail`, answer yes (or any pull-cost flip), `next`: the closing ask reads "… the next refresh pulls everything again, about M minutes; your login has about T minutes left, …" with the logins clause ("so the refresh will take about N logins of an hour: it runs as far as each login allows, stops, and continues when you log in and run it again") when the pull outlasts the login, "enough for it" when it does not — the same clause as a new dashboard's closing step. Save only after.
- F-505 on the real admin page. The count line above the program list reads "N programs sent in this window, M selected" (N the pulled set, the About tab's count); pick one closed month: programs with no sends in it are dimmed in the list with "no sends in these months", the summary reads "K programs shown (J selected programs with no sends in these months)" where K equals the Programs table's row count under that month, the selection unchanged; "Running now" dims the paused and draft programs with "hidden by status" and the summary's hidden-by-status count agrees; Reset clears every dim.
- F-507 on a real plan. `/gs-superadmin:email-engagement` report mode (or the plan verb) on a login with less than the gap-fill plus the pull remaining (or read the plan's numbers on any login): the summary's `estimate.token` carries `fits` (the pull alone), `afterPullSeconds` and `withProposals {seconds, fits}` with `withProposals.seconds` equal to `thisRun.seconds` + `kb.refreshSeconds` + `templates.seconds`; when a gap-fill or re-documentation is offered, the skill's ask says in minutes what the login has left after the pull and which budget would outlive it (fill all, the first 50, none), and offers the login first. No gap-fill is started on a login the pull alone was judged to fit.
- F-508 on the real pages. The About tab's settings list and `dashboard-spec.mjs show --saved` read "the 10 lowest by Open rate" for the leaders' Lowest open rates panel and "the 25 lowest by Open rate" for Least engaged customers, "the top N by …" for the descending ones; the in-page ranking note under a full list says "the 25 lowest" or "the top 25" the same way.
- F-509 on the real snapshot. The admin page's caveats (and `caveatText` over the snapshot's `unclassified-wordings` detail): with 0 unclassified entry wordings and step participants on an unnamed reason, the sentence starts at the step part ("N participant(s) fell off at a step …") with no "0 entry-refusal wording(s)" clause; with both parts, the entry clause then "plus N participant(s) who fell off …".
- Re-verification of the FIXED sections on their Fix lines: F-519 (I15 resume), F-518 (the two lines), F-511 (the statement, by Bradley), F-505, F-507, F-508, F-509 (above).

Section status (FOURTH sitting, 2026-10-13 @ hb-20261013-01, tester; the branch at 008d1d1, clean and level; production, reads only; three by-hand logins; Bradley present for his read and the filters): I15's resume arm CLEARED on the fallback path the bar allows (no unsplittable call timed out on the server this sitting; one split row in the third sitting's evidence shape, planted for a `uniques-window` unit the adapter cannot cut, was re-made by the next firing; the README's task fired three times — the stop on the login after 61 calls, the resume that re-made the call and ran to the login's end with every call made, the finish with exit 0, a snapshot and the pages moved — then deleted; no state file touched by hand); the How to refresh statement CLEARED (instance 27 PASSED: Bradley said what he would do — the statement's own Claude Code route — with none of the five gaps raised); F-518's two lines: (b) CLEARED on the real edit, (a) FAILED — the resume after the short first run priced the remainder ABOVE the whole ("about 53 minutes of its 45 minutes remain"; the resume's plan.json `remaining` 601 calls / 3178 s against `thisRun` 524 / 2698, 399 of 410 units still counted after 61 calls), sane once every call was on disk ("about 11 minutes of its 45"; the completed `budget` 630 below 2728, `continuing` true, `loginsNeeded` 1) — F-518 REOPENED (polish); F-505, F-508 and F-509 CLEARED on the real pages and the real snapshot; F-507 CLEARED on what this tenant can measure (the token fields hold on a real plan; no KB gap, so the two asks did not fire and stay judged by the suite). F-519, F-511, F-505, F-507, F-508, F-509 VERIFIED; F-518 REOPENED. The section is CLEARED as banked; F-518 (polish) is its one open finding.

## PUB-1 — the refresh runner on a real tenant: twice for the delta, the lock, the tenant refusal, the expired token, health-only, re-documentation (banked 2026-10-12, builder, Session S5 @ hb-20261011-02; verdict at S5-V)

Owed by: S5-V, as above; the production tenant, reads only (the refresh issues only the adapter's reads and
describe-batch's `jo p describe` / `jo email template` reads: every one catalogued non-mutating; the guard should ask
on none of them).
Token: hb-20261011-02. Why it is banked: the refresh was built against the stand-in CLI. The lock, the tenant refusal, the
token stop and resume, the health-only timing and the re-documentation of a program Bradley edits need a real tenant,
a real login that expires, and a second tenant on the CLI. No tenant data leaves the workspace.

THIS LIST IS COMPLETE (the same rule as above).

Inputs: the dashboard I10 saved; a sandbox login beside the production one (the two-tenant workspace); a program
Bradley can edit harmlessly in the UI (a description change is enough: it moves modified_date).

- R1 (the first refresh, from I10 or `… refresh <dash>`). Pass bar: exit 0; the summary's `pull.mode` full with its
  why; `pull.lookbackDays` at least the spec's silentDays and `lookbackDerivedFrom` the longest schedule period when
  one exists; `redocumented` names how many programs and templates the knowledge base gained and what is left for
  next time (cap 50); a snapshot under `<dash>/snapshots/`; both pages built; the admin page's headline says "none
  yet, this is the first pull"; wall time within 2x of the estimate's seconds.
- R2 (the second refresh, for the delta; the next day or after a change). Pass bar: `pull.mode` selective (or full
  with a stated why); `delta.previousPulledAt` names R1's pull and `delta.closedMonths` the months both hold; the
  admin and leaders' pages show "Change since the last refresh (pulled <R1's time>) over N closed months" and each
  headline tile a "Since last pull" line; the figures on one tile agree with a direct comparison of the two snapshots
  through the engine (`runQuery` over the common closed months in a node one-liner).
- R3 (the lock). While R2 (or a third refresh) runs, a second `… refresh <dash>` from another terminal. Pass bar:
  refused, exit 1, naming the holder and the time; no second run directory; the running refresh unaffected. After
  it ends, the lock file is gone. Then a hand-written stale lock (an `at` three hours old): the next refresh takes it
  over and the summary's `lockTakenOver` names the earlier holder.
- R4 (the tenant refusal). `gs-admin config --base-url <the sandbox>`, then `… refresh <dash>`. Pass bar: exit 5,
  status wrong-tenant, both tenants named; `whoami` alone was called (no run directory created, no snapshot, no page
  touched: compare the pages' bytes before and after); switch back.
- R5 (the expired token). Start a `… refresh <dash> --full` with a login near its end, or let one run past the hour.
  Pass bar: exit 3, status token-expired; no snapshot written; both pages byte-identical to before; `status` shows
  the resumable run; after `gs-admin login`, the same command resumes it (`resumed: true`, `pull.calls.reused` above
  0) and finishes with exit 0.
- R6 (`--health-only`, timed). `… refresh <dash> --health-only` over the latest snapshot. Pass bar: `pull.mode`
  selective, carrying every month but the current one (and the previous pull's month); the health families read
  again; wall time recorded (the plan's expectation on the S1-V tenant: about three minutes with customer lists off);
  the pages rebuilt.
- R7 (re-documentation of a program Bradley edits). Bradley edits one of the dashboard's programs in the UI (a
  description), waits for the list to show the new modified_date, then `… refresh <dash>` (or `--health-only`). Pass
  bar: `redocumented.programs.documented` counts it; the program's manifest entry carries a fresh last_verified and its
  doc the edit; `kbBehind.behind` is empty after the pull; the describe was ONE `jo p describe` for that program
  (the guard shows no ask). Then set `kb.redocument.enabled` false (`… change <dash> kb.redocument.enabled=false
  --dry-run`, then without): the consequence reads rebuild, and a later refresh after another edit leaves the KB alone
  and names the program in `kbBehind.behind` and the page's caveat.
- R8 (the scheduled run, semi-attended). Bradley creates an OS-scheduler task (or a Claude desktop local task) that
  runs `node .gs-superadmin/plugin/scripts/dashboard.mjs refresh <dash>` from the workspace, logs in, and lets it fire
  within the hour. Pass bar: the task's run exits 0 and the pages move; a second firing after the login expired exits
  3 and leaves the pages; the README recipe matched what he had to do (a finding otherwise).
- R9 (the hand-over). `… export <dash> --out <file> --with-snapshot`, then in a second workspace of the same tenant
  (or a copy) `… import --file <file>` and `… refresh <dash>`. Pass bar: the import lands the spec and the snapshot;
  the refresh is selective with a delta against the exported pull.

S5-V first sitting (2026-10-12 @ hb-20261011-02; the fast-path dashboard of I11; production, reads only, one call at a time; the tenant answered 5 to 7 s a call in the morning and 14 to 19 s in the afternoon):
- R1 PASSED: exit 0; `pull.mode` full, why "no previous snapshot"; `lookbackDays` 30 with `lookbackDerivedFrom` null — the longest schedule period read 30 as well, a tie with the spec's silent threshold, so the spec's value stands (the builder may want the tie said); `redocumented` 0 behind / 0 documented / 0 remaining under the cap of 50 (V2 had documented everything); one snapshot; both pages built (admin 2.48 MB, leaders 0.75 MB, no warning); the admin headline reads "Change since the last refresh: none yet, this is the first pull."; wall 1315 s against 1132 s estimated (1.16×); 149 made + 19 reused, 0 split, 1 retried. NOTICED, reported to Bradley and not logged: the save re-plans from scratch (the estimate step's plan of 20 minutes earlier is not reused: a second run directory and about 3 minutes of cheap calls).
- R2 PASSED (the resumed `--full` of R5, half an hour after R1): mode full with the why "a full refresh was asked for"; `delta.previousPulledAt` R1's pull; 12 closed months; both pages carry "Change since the last refresh (pulled <R1's time>), over 12 closed months both pulls hold." and every tile "Since last pull: level with the last pull"; the delta's open-rate change (0.00028 points) equals the engine's `runQuery` over the 12 closed months of both snapshots (two late opens landed in a closed month between the pulls); `programs {added 0, gone 0}`.
- R3 PASSED: a second `refresh` while R1 ran was refused with exit 1, naming the holder and the start time; no second run directory (30 before and after); the running refresh unaffected; the lock gone once it ended. A hand-written stale lock (three hours old) was taken over by the next refresh, whose completed summary's `lockTakenOver` names the earlier holder and time. NOTICED: when the taking-over run is then refused on budget (R5's first half), the takeover goes unrecorded — no summary field, no stderr line; polish at most, reported.
- R5 PASSED by the budget gate: a `--full` started with 6 minutes of login left stopped with exit 3, status token-expired, the message naming the minutes needed and that the next run resumes; no snapshot written; both pages byte-identical (md5); `status` showed the resumable run and no lock; after `gs-admin login` the same command resumed (`resumed: true`, 19 calls reused) and finished with exit 0 (wall 1449 s). The mid-pull expiry variant was not reached: the gate catches it first.
- R9 IMPORT HALF PASSED: `export --with-snapshot` wrote the envelope (3.6 KB, no machine path) and the snapshot as a sidecar file beside it, naming both and the import hint; `import --file --snapshot` into a second KB folder of the same tenant (a copy of the KB without its dashboards) landed the spec byte-identical and the snapshot beside it. R9 REFRESH HALF PASSED: `refresh` in the copy ran selective ("months before <the month before the current> are carried from the snapshot pulled <the exported pull's time>"; 131 made + 19 reused, 1232 s), its delta against the exported pull over 12 closed months, the strip on the copy's pages; the copy also re-documented the edited program once (its own KB, its own switch still on). The copy was removed after the arm. R9 PASSED.
- R4 PASSED: with the CLI switched to the sandbox (`config --base-url`, catalogued mutating: the guard asked and Bradley approved, two journal entries for the two switches on one line), `refresh` exited 5 with status wrong-tenant naming both hosts and "nothing was called", before the token check (the sandbox held no token at all); no run directory (33 before and after), both pages byte-identical (md5), no lock; switched back, production active, its token intact. The journal entries landed in the unattributed journal because the R9 KB copy made the workspace "resolve no single tenant" — a side effect of the copy, gone with it.
- R6 PASSED on its bars, with the time recorded: `--health-only` ran selective ("months before <the current month> are carried from the snapshot pulled <R2's time>"; `repullMonths` 1; only the current month re-pulled, 12 carried, every carried row marked so), the health families read again (56 bounce-category calls, 43 sample calls, the states, sources, admissions, the step families), the pages rebuilt (admin 2.92 MB, leaders 0.77 MB). Wall 1410 s (130 made + 23 reused, 2 split, 1 retried) on a tenant answering 14–19 s a call that afternoon, against the plan's "about three minutes" from the S1-V tenant: the health-only mode still makes the whole health family's calls, so its saving over a full refresh is the non-health months only; on this tenant with 56 categories it is a 20-minute refresh. No README or skill sentence promises three minutes (grepped), so recorded as a measurement, not a defect; it belongs on LTR-9's list (levers 5 and 6 are the category cost).
- R7 PASSED: after Bradley's first edit (a program on the dashboard, Active, its doc from 2026-09-10), the `--health-only` refresh read `redocumented.programs {behind 1, documented 1, remaining 0}` with `calls: 1` (one describe); the program's manifest entry carries a fresh `last_verified` and `kbBehind.behind` is empty after the pull. No ask on the describe: it is spawned by the script, not issued through the Bash tool (by design; Bradley saw no prompt during any refresh, and the journal holds none). Then `change kb.redocument.enabled=false --dry-run` priced rebuild and the real change applied it; after Bradley's second edit on the same program, the next refresh (selective, 112 made + 19 reused, 1053 s) documented nothing (`calls: 0`, `remaining: 1`), named the program in `kbBehind.behind` with the doc's date against the new modified time, left the manifest date unchanged, and the admin page's caveat reads "knowledge base is behind the tenant for 1 selected program(s) … 1 was modified …" (`kb-behind-tenant`). The switch is left OFF on the saved dashboard for the second sitting to flip back.
- R8 DEFERRED to the second sitting on Bradley's ruling: a mechanical arm that needs an hour's clock with the tenant otherwise idle.
- Guard-wiring: `gs-admin jo p pause --help` drew the guard's ask (the mutating command named, both tenants named, production flagged; the R9 KB copy made the production tenant appear twice, since the guard reads every manifest in the workspace); Bradley pasted the rendered text and declined it. The R4 tenant switch drew a second ask (`config`, catalogued mutating) which Bradley approved; it is journaled. No other prompt rendered that day, by Bradley's account and the journal.
Section status: IN PROGRESS — R1 to R7 and R9 PASSED at the first sitting; R8 owed at the second sitting. The saved dashboard's `kb.redocument.enabled` is left false (R7's switch-off) for the second sitting to flip back.

S5-V second sitting (2026-10-12 @ hb-20261012-01; production, reads only): `jo-program-dash`'s `kb.redocument.enabled` flipped back to true at the start (`change … --kb payscale-prod`, rebuild only; the verb refuses without `--kb` in this two-KB workspace). R8 ran on Bradley's real dashboard (`digital-outreach-health`, Health on, two internal domains, two test accounts, step detail, lists off).
- R8 PASSED on both bars, in inverted order, with the recipe gap logged as F-517 (polish). The README's recipe gave no command, so the tester wrote a runner `.cmd` (cd to the workspace; the refresh line with `--kb`; a log) and Bradley created the task with one `schtasks /Create … /SC ONCE /ST 18:05` line (`MSYS_NO_PATHCONV=1` needed from the Git Bash prompt) after a fresh login at 17:58. First firing 18:05:01: the task's console window opened (the scripts' `npm root -g`), the selective refresh ran 423 calls and stopped at 18:56:55 on the expired login, exit 3, the message naming the resume, both pages byte-identical (md5) — "a firing after the login expired exits 3 and leaves the pages". Bradley logged in (a browser flow by hand) and fired the task by `schtasks /Run` at 19:01:24: `resumed: true`, selective ("months before 2026-09 are carried from the snapshot pulled <R1's time>"), 56 made + 426 reused, exit 0 at 19:11:09, a new snapshot, `delta` against R1 over 12 closed months, both pages moved (new md5) — "the run exits 0 and the pages move". The recipe did NOT match what he had to do: F-517.
- Also measured here, for F-513: even this selective refresh (6 recipient classes × 56 categories) is longer than one login on this tenant, and every login is the admin's by-hand browser flow.
- R1 on this dashboard (the first sitting's R1 was the fast-path one): see § DSH-3 I10 — the first pull across two logins after the gate and the stranded plan were worked around; `lookbackDerivedFrom` 30 (the tie now named: the first sitting's note taken).
Section status: CLEARED on R1–R9 as measured (R8 at the second sitting); F-513, F-512's reopen and F-517 are the section's open findings for the fix round; the third sitting re-owes R1's first-pull half under the checkpoint (a pull priced above one login).
Release pre-flight (builder, 2026-10-14, R12 release 0.54.0): the re-owed half SPENT — R1's first pull under the checkpoint is § DSH-3 I10, CLEARED at the third sitting @ hb-20261012-02. Nothing owed here.

## UX-2 — the brand walk with Bradley's real brand input (banked 2026-10-12, builder, Session S5 @ hb-20261011-02; verdict at S5-V)

Owed by: S5-V, in the same sitting as DSH-3 I9. Token: hb-20261011-02. Why it is banked: the brand step was exercised only
over hand-written tokens and a 1x1 fixture PNG (test/dashboard.mjs). A real guidelines file, a real logo and Bradley's
eye on the themed page cannot be had offline. The brand file stays in the workspace; only the extracted values and the
encoded logo enter the spec; nothing of it is copied here.

THIS LIST IS COMPLETE (the same rule as above).

- B1 (the input is data). At the `look` question Bradley names a brand guidelines file (markdown, JSON, CSS or a PDF
  the session can read), or pastes values, or runs his own brand skill himself and pastes its output. Pass bar: the
  prose reads the material and proposes the candidate tokens (colours as #rrggbb, series, a system font stack, a
  radius, the logo as a local PNG or JPEG path) before storing anything; it never invokes another plugin's skill and
  never fetches a URL.
- B2 (the validator's notes shown). Pass bar: `answer <dash> look <json>` returns `replaced` for every token the
  validator replaced (contrast, two series colours too alike, a font the page cannot rely on) and the prose shows each
  with its reason; a token that passed is stored as given; the About tab's Look part lists the replacements.
- B3 (the themed preview). `answer <dash> dry-run yes` (or the first refresh). Pass bar: the admin and leaders' pages
  carry the brand colours and the logo (one image element, a data URI; no network request), the status colours
  unchanged; Bradley judges it reads along the company's lines (a presentation finding goes to UX-3, not here).
- B4 (clear and skip). `answer <dash> look clear` returns the default look; on the fast-path dashboard the look was
  never asked. Pass bar: both as stated.

S5-V first sitting (2026-10-12): B1 to B4 DEFERRED to the second sitting with I9 (the interview walk waits for F-511's fix round). Ruled at I0: the brand-skill path leaves the question and the skill prose (F-511 instance 13; backlog LTR-21), so B1's third input shape is out of scope when walked; the file and pasted-values paths stand.
Re-banked for the second sitting after the S5 fix round (builder, 2026-10-12, feat/jo-dash-s5-entry-command @ hb-20261012-01, PR #47): B1–B4 as banked, with the brand-skill path out of scope by F-511's ruling 13: B1's input is a guidelines file Bradley names (markdown, JSON, CSS or a PDF the session can read) OR pasted values, the look question's three options read verbatim as ruled ("Do you have brand guidelines to apply to the pages? If not, the default look is used. …", naming what a theme changes and what it does not); the prose never offers to read a brand skill's output and never invokes another skill or fetches a URL. B2, B3 unchanged. B4: `answer <dash> look clear` on an edit returns the default look; on the fast-path dashboard the look was never asked (the first sitting's I11 showed it answered by default: stands).

S5-V second sitting (2026-10-12 @ hb-20261012-01; on an EDIT of the saved dashboard, reached through `next --question look`, the go-back path, `again: true`): Bradley had no brand file handy and asked for a proxy, so B1–B3 ran on a stand-in guidelines markdown and a generated 96×32 PNG under the workspace's tmp folder; the real brand input is a BLIND SPOT (the mechanism is measured, the eye on real material is not).
- B1 PASSED: the look question read as ruled with its three options and no brand-skill path; the prose read the file and proposed the tokens (nine colours, six series, a system font stack, radius 6, the local PNG path) in a table BEFORE storing; no other skill invoked, no URL fetched.
- B2 PASSED: `answer look <json>` returned `replaced` for six tokens, each with its reason (muted 3.92:1 on note; note; the control border 1.17:1 on the page; dark.control derived 1.83:1; series 2 and 3 alike, distance 0.32 of 15; series 3 and 2 under colour-blind vision, 4.01 of 6), the rest stored as given, the logo embedded (under 200 KB); the list shown to Bradley as returned. The About tab's Look part listing the replacements was not read on the preview (unmeasured, minor).
- B3 PASSED on the proxy: `answer dry-run yes` wrote preview/latest-admin.html (2.12 MB) and latest-exec.html (0.75 MB), `themed: true`, 53 calls; one logo image as a data URI, the accent and the replaced series colours in the page, zero `http` requests, the status colours untouched; Bradley: "looks on brand, logo and navy accents are there".
- B4 PASSED: `answer look clear` on the edit returned "the default look" and the draft's theme is gone; the saved spec's theme was never touched; on the fast-path dashboard (s5v-fastpath) the look was defaulted, never asked.
Section status: CLEARED on a proxy; the real brand walk a blind spot owed whenever Bradley has his file. The edit itself exposed F-516 (an edit re-asks the interview) — logged under § DSH-3 I8.
Release pre-flight (builder, 2026-10-14, R12 release 0.54.0): standing-arm — the real-brand walk stays owed whenever Bradley has his brand file; a blind spot, not a release gate. Nothing else owed here.

## F-502 / F-503 / F-504 — the S5 kickoff batch on a real tenant: the one-day schedules, the copy lines, the category cost (banked 2026-10-11, builder, Session S5 @ hb-20261011-02; verdict at S5-V)

Offline the three fixes are checked over the fictional tenant (the signals programs p-oneday, p-twoday, p-rerun; the built pages' copy lines; a priced plan). What only the real tenant can show: the 68 one-day programs V2 counted, Bradley's own two-day example if one exists, the copy lines against the saved spec, and the category refresh's wall time against the re-fitted plan. Reads only; one gs-admin call at a time; the F-502 arms need no new pull when a snapshot from this round exists (the lists and the grouping are read over it); K4 needs one plan and, if Bradley wants the timing, one refresh with Health on.

- K1 (F-502, the lists). Over the round's snapshot: `programHealth(snapshot, {days: 30})`, or the Health tab's Program health panel. Pass bar: no program on the Schedule ended list has a schedule with `oneRunWindow: true` (`dimensions.programs[].schedule`); the one-day programs V2 saw there (29 rows, 14 of one family) that have ended with nobody active or paused sit on Finished campaign, each row's Why ending "(one-day schedule, ended <day>)"; a one-day program with participants still in flight is on another list, never Schedule ended. If Bradley names a program meant to recur whose window was set for about two days, it stays on Schedule ended once ended (its `oneRunWindow` is false).
- K2 (F-502, the grouping). The Recurring / One-off supergroups over the same snapshot (the About tab's groups, or `dashboard-groups.mjs resolve`). Pass bar: no one-day program is in Recurring unless it sent in two or more months; Bradley names one program he re-runs by hand through one-day windows, and it sits in Recurring (its trait `recurring` true), not One-off.
- K3 (F-503). On the admin page: open an offered tab (Templates off on a copy of the spec if every tab is on) and the Steps panel's notice (step detail off), and the About tab's internal-domain notice on a copy with no domain. Copy each line as drawn and run it through the entry command (a `--dry-run` where it would pull). Pass bar: each line names a page index, a tab index or `sources.0` (no `[]`), and the command accepts it — or refuses it with the writer's own message naming the panels, never "not a field path"; `change --dry-run` prices the tab line as the Health pull or a rebuild as the tab decides.
- K4 (F-504). `dashboard.mjs next` at the failure-settings question (or the plan's JSON) over the tenant's category file (55 entries) with the two internal domains and the two test accounts. Pass bar: the question quotes "55 bounce categories … 330 counted calls a refresh (55 × 6 recipient classes …)" with the minutes at 3 s a call (about 17 minutes for the categories), and `estimate.health.categoryCalls.bounce` reads {categories 55, classes 6, calls 330}; if a refresh with Health on is run, its wall time against `estimate.thisRun.seconds` is within 1.5× (V2 measured 2×; the category family was the over-pricing).
- K5 (the metrics restore). On a saved dashboard: `dashboard.mjs new <slug>`, `answer <slug> metrics '{"clicks": false}'`, then `answer <slug> metrics default`. Pass bar: after the first answer the draft's pages carry panels without the click metrics; after the second the pages' panels are empty again (the preset's) and the note says every optional metric is shown; on a page whose panels were changed by hand through `change` the second answer keeps them and the note names `change <slug> pages.N.panels=[]`.

THIS LIST IS COMPLETE.

S5-V first sitting (2026-10-12 @ hb-20261011-02; the fast-path dashboard's R1 snapshot and spec; production, reads only; K4's plan the one new tenant call, K1 to K3 and K5 offline over the snapshot and the built pages):
- K1 CLEARED on its data half: `programHealth(snapshot, {days: 30})` gives an EMPTY Schedule ended list (V2 had 29 rows there); 68 programs carry `schedule.oneRunWindow: true` (V2's count exactly), every one classified one-time; 30 of them, Active and ended with nobody in flight, sit on Finished campaign with the row's Why ending "(one-day schedule, ended <day>)" (31 such notes on the admin page); the other 38 are Paused or Stopped and unjudged; none is on any alarm list. The two-day case is unmeasured: Bradley knows no such program on this tenant (the ones he found were fixed or turned off); a blind spot, the fixture program the only measurement.
- K2 CLEARED: `programTraitsOf` over the snapshot with the months-with-sends map: of the 68 one-run programs, 12 sent in two or more months and read `recurring: true`, 56 read false; resolved with a Recurring / One-off characteristic rule (offline, no spec change) the 12 land in Recurring and the 56 in One-off, so no one-run program sits in Recurring without the two-month history; Bradley named one program he re-runs by hand through one-day windows (Paused, three send months) and it is among the 12, in Recurring. Ten of the 12 share the tenant's naming for manual runs.
- K3 CLEARED: the built admin page's copy lines are `accounts.pull=true`, `sources.0.params.stepDetail=true`, `sources.0.params.internalDomains=`, `refresh <slug>` and `health <slug> --program <id>`; a scratch build with the Templates tab off adds `pages.0.tabs.2.enabled=true` — no `[]` anywhere. Through `change --dry-run`: accounts.pull and stepDetail price pull; the Templates line prices rebuild both ways (turning it off, then on again from the offered tab's own line); internalDomains with a value prices pull; Health off prices pull (the adapter's refresh rule: a changed health switch is a full pull); the bracketed control `pages[].tabs[].enabled=true` is refused with the writer's own list message ("pages" is a list of 2; "tabs" is not an index into it), never "not a field path".
- K4 CLEARED: a plan with the two internal domains, the two test accounts and the tenant's category file (56 entries since V2.5's remedy) reads `estimate.health.categoryCalls.bounce` {categories 56, classes 6, calls 336, seconds 1008, secondsEach 3} (455 calls / 2171 s for the run); the failure-settings question quotes "The 56 bounce categories in the workspace's category file cost 336 counted calls a refresh (56 × 6 recipient classes: all, each internal domain, the test accounts, and the test accounts on each domain; about 17 minutes)" and the tabs question carries the same sentence; R1, a Health refresh on one class, ran at 1.16× its `estimate.thisRun.seconds` (and R2's full at 1.28× on a slower afternoon), inside 1.5×. NOTE for the fix round: F-511 moves the category-cost quote to the tabs question; this bar moves with it.
- K5 CLEARED: on the saved dashboard, `metrics {"clicks": false}` left the draft's admin page with 17 panels carrying no click metric and the leaders' page 6; `metrics default` emptied both to the preset's with the note "every optional metric shown"; with the admin page's panels changed by hand through `change` (the preset minus one engagement panel), both answers kept its 16 panels and the note named `change <slug> pages.0.panels=[]` (the literal `<slug>` is F-512 (c)), while the preset-derived leaders' page followed the answers (6, then the preset's).
- K4 bar moved with F-511 (builder, 2026-10-12 @ hb-20261012-01): the category-cost quote now lives on the tabs question alone ("The 56 bounce categories in the workspace's category file cost 336 counted calls a refresh …" after Health's minutes and the shared-pull sentence); the failure-settings question no longer carries it, and the internal-domains and test-accounts asks say "a few minutes per domain / per test account" instead of counted calls. Already CLEARED on the figures at the first sitting; the second sitting reads the sentence on the tabs question at I7 and owes nothing else here.
Section status: CLEARED (first sitting); the two-day case a blind spot. F-502, F-503 and F-504 flip FIXED → VERIFIED on the bus with these as their live half.

## ACC — the account timeline and the in-page account view on a real tenant (banked 2026-10-13, builder, Session S6 @ hb-20261013-02; verdict at S6-V)

Owed by: S6-V, its own session (the tail's batching, ruled 2026-10-12, withdrawn 2026-10-13), in the consumer
workspace with the plugin loaded from this branch; the production tenant,
reads only (the timeline issues only the adapter's reads: `whoami`, `jo p list`, `rp schema`, `rp run`, and
`jo p describe` for a program the list lacks; every one catalogued non-mutating, so the guard asks on none of them).
Token: hb-20261013-02. Why it is banked: the account path was built against the stand-in CLI. Whether the server takes EQ and
CONTAINS on the company object's `Name` (and with what letter case), what a real account's day rows cost, and whether a
timeline equals a real dashboard's rows of the same account need a real tenant. No tenant data leaves the workspace:
the picks, the timelines and the pages stay under the KB folder.

THIS LIST IS COMPLETE (the same rule as above).

Pick before the first call (kept in the workspace, never here): two accounts of the dashboard the S5-V sittings kept
(v2) that its customer lists KEPT, each with sends in the last 90 days on two or more programs (one of them sent to by
an internal recipient, if one exists); one company name the tenant holds on two or more company records, if Bradley
knows one; one account with no JO send in the last 90 days.

- A0 (measured first, before anything rests on it: Bradley's rule, operators per object and field). `rp schema
  --object company` declares `Name` filterable; one `rp run` on `company` with `Name EQ '<an exact name>'` returns that
  account; one with `Name CONTAINS '<a fragment>'` returns the accounts holding it; the same two in another letter case
  say whether each operator folds case. Pass bar: both operators run (no refusal); the case behaviour of each recorded in
  SPIKE-NOTES as a one-line addendum (no values). If CONTAINS is refused, the timeline's no-exact-match path fails
  loudly: log a finding, do not guess a fix.
- A1 (two timelines: `/gs-superadmin:email-engagement account '<account 1>'` by name, and `… dashboard.mjs account v2
  --account-id <account 2's GSID> --kb <kb>` through the dashboard). Pass bar: each exits 0; the summary's `sent`,
  `programs` and `window` (90 days to today); each page opens from file:// in a browser with its lanes, marks, summary
  and table; the data-pulled line names the pull's time and tenant; the account's open rate stands beside "every
  recipient of these programs over the same days"; wall time and the number of calls recorded (order 10 calls).
- A2 (reconciliation against the dashboard's facts: the second timeline of A1, run with the dashboard named). Pass
  bar: `against.reason` null, `against.basis` class, `matches-dashboard` ok with `compared` above 0, every closed whole
  month the two hold equal on sent, delivered, opened and bounced per program and class; a program named in
  `notCompared` is one the dashboard's selection did not keep the account on (read its `honesty.accountSelection`); then
  three direct counts of the account on one program and one closed month (email_log_v2, the standing filters,
  GsCompanyId EQ the GSID, ExecutedDate inside the month) equal the timeline's month row.
- A3 (the in-page account view against the timeline). On v2's admin page, View beside account 2 in a customer list (or
  the Account filter): the one-account view shows it month by month; for every whole month inside the timeline's days
  its rows equal the timeline's per program (sum of days); its copy line is `… account v2 --account-id <GSID> --kb <kb>`
  and runs as drawn from the workspace folder (that is A1's second run); the sentence beside it says the line needs a
  gs-admin login. The leaders' page has no account view.
- A4 (no guess). The duplicated name (if one exists) and a fragment no account carries exactly: each exits 6 with a
  pick list naming every candidate's GSID and sends, and nothing beyond the company search and one count was called
  (the fetch log). A GSID that does not exist exits 6 saying so.
- A5 (account is the finest grain). In A1's run directories and timeline files and pages: no address (a search for `@`
  followed by a domain), no person or participant id, no send id. Pass bar: none found.
- A6 (escaping and the account with no sends). The no-send account's page says nothing reached it, with no table and
  no chart; a page for an account whose name holds an ampersand, quote or angle bracket (if the tenant has one) renders
  the name as text.
- A7 (resume). One timeline pull stopped on an expired login (start it with a few minutes left, or after the hour) exits
  3 and the same line after `gs-admin login` continues it (the summary's `calls.reused` above 0).

Carried, not this section's: F-518 (polish, OPEN) rides the tail's first fix round, with S8's kickoff as its fail-safe.
Section status (banked): OPEN — owed at S6-V.
S6-V (2026-10-13 @ hb-20261013-02; feat/jo-dash-s6-account-timeline at 1c2754e, clean and level; a terminal in the workspace with --plugin-dir, canary matched; production, reads only, one call at a time; picks chosen by the tester from the kept dashboard's lists at Bradley's request, kept in the workspace):
- A0 PASSED: `rp schema --object company` declares `Name` STRING, filterable; EQ on an exact name returned that name's records (the name is held by two records — it became A4's duplicated case), and the same name in lower case returned the same two; CONTAINS on a fragment returned 20 records, the same 20 in lower case; CONTAINS on the full name 3; STARTS_WITH 12. Both operators fold letter case. SPIKE-NOTES addendum written (no values). Probe fault, recorded: the tester's first row counter read a `data.records` envelope on a bare-array payload and printed 0 for every call after the first, which read as "CONTAINS matches nothing" for six calls until a control on the adapter's own successful lookup exposed it; every count above is recounted from the payload files.
- A1 PASSED: account 1 by name through the skill's account command, no dashboard: exit 0, 90 days to today, 264 sent, 9 programs, 10 templates, 8 calls (one timeout retried, answered), 88 s; account 2 by GSID through the dashboard's copy line: exit 0, 1188 sent, 13 programs, 18 templates, 14 calls, 96 s. Both pages open from file:// in headless Chrome with the script running (the root fieldset enabled): lanes, marks (13 and 22) with tooltips, the summary tiles, one table (15 and 24 rows), the data-pulled line naming the time and the tenant, the account's open rate beside "every recipient of these programs over the same days" (each its own denominator). Bradley read both program lists ("seems fine"); independently, every program the dashboard shows sending to the account in the whole months is on its timeline and no timeline program is absent from the dashboard's rows for those months. Hover: each mark reads day, program, step, the template's subject and the counts; 18 of 18 subjects on account 2's page equal their KB template docs, each with its as-of day. Bradley's note on the page: F-522 (polish).
- A2 PASSED on its figures, FAILED on its notCompared clause: `against.reason` null, `basis` class, `matches-dashboard` ok with `compared` 11 and 0 mismatches; an independent recount from the timeline file and the snapshot (the two whole months, per program and class) gave 11 equal, 0 different; three direct counts of the account on one program and one closed month (email_log_v2, the standing filters, GsCompanyId EQ, ExecutedDate inside the month) read sent, delivered and opened equal to the timeline's month row. `notCompared` named 3 programs as `account-not-kept-on-program`; the snapshot holds the account's rows on all 3 (their timeline days fall in the window's partial first month or the provisional month): F-520 (normal).
- A3 PASSED: v2's pages predated S6 (built 13:38, the feature commit 17:44) and were rebuilt (`rebuild`, no call); on the admin page with the account chosen (the hash's `a=`), the one-account view reads month by month; 11 of 11 whole-month cells equal the timeline per program (sum of days); its copy line is the exact command A1's second run made (exit 0); the sentence beside it says the line needs a gs-admin login. The leaders' page has no account view (its About's settings text names the admin page's panel, the S4b behaviour).
- A4 PASSED: the duplicated name exited 6 with both records (GSID and sends over the days), match EQ, nothing pulled; a fragment exited 6 with its one candidate, match CONTAINS; a GSID that does not exist exited 6 "no account has the GSID …; nothing was pulled". The fetch logs hold the preliminaries (whoami, the program list, two schema reads), the company search and at most one count: no send row read. A name that is itself a company's exact name resolves to that account (a fragment of other names is not a pick list then): correct by the rule, noted.
- A5 PASSED: 93 files (seven account run directories, A7's included, and three timeline files and pages, account 2's as rewritten by A7's 12-month pull) searched: no address, no person or participant id field, no send id; the hits were field names in the two schema reads, the word "Email" in step names, and the inlined engine's source; each page's embedded data block has 0.
- A6 PASSED: the no-send account's page says no Journey Orchestrator email reached it in the 90 days, with no chart and no table; an account name with an ampersand is `&` in the data and `&amp;` in the markup, read as text. Not tried: a name with a quote or an angle bracket.
- A7 HALF MEASURED: a 12-month timeline of account 2 through the dashboard, started with 47 seconds of login left, stopped with exit 3, status token-expired, "the login ran out before the pull did … run gs-admin login, then run the same line again; it continues where it stopped" (two calls: the login check answered, the program list stopped); after Bradley's login the same line continued the SAME run directory (one fetch log, both runs) to exit 0 in 204 s: 17 calls made, one account-tenant call timed out twice and was split and answered, 25 programs, internal-within-all, account-within-tenant and matches-dashboard ok (45 compared, 0 mismatches). The summary's `calls.reused` read 1, but it is NOT a call carried across the login: the first run answered only the login check, which every run makes afresh, so no answered data call was on disk to reuse (a reuse is counted only for a record on disk when its unit is reached). The bar's intent (answered calls not made again after a login) is UNMEASURED: a probe-timing fault, the stopping pull started too late. Owed at the re-check sitting.
- Guard-wiring: `gs-admin jo p pause --help` drew the guard's ask (the mutating command named, both tenants named, production flagged); Bradley pasted the rendered text and declined it.
- Found beside the arms: F-521 (normal): a selective refresh records empty customer lists and the dashboard's report then says no account met any list's floor.
Section status: OPEN — A0, A1, A3, A4, A5, A6 PASSED; A2 FAILED on its notCompared clause (F-520); A7's reuse half owed. Ruled by Bradley at the close: one S6 fix round on PR #48's branch takes F-520, F-521, F-522 and F-518, then an S6-V re-check sitting re-owes A2's clause and A7's reuse half beside the fixes' own arms; PR #48 stays unmerged until it passes.

### Re-banked for the S6-V re-check after the S6 fix round (builder, 2026-10-13, feat/jo-dash-s6-fix merged into feat/jo-dash-s6-account-timeline @ hb-20261013-03; PR #48 unmerged)

Owed by: the S6-V re-check sitting, in the consumer workspace with the plugin loaded from this branch (canary hb-20261013-03);
the production tenant, reads only, one call at a time. What the fix round changed and why each arm exists: F-520 (the
comparison's "kept" read over the snapshot's window), F-521 (a selective refresh carries the last full ranking of the
customer lists), F-522 (a shortened chart label opens whole), F-518 (the remainder priced from each planned unit's own
price), plus A7's reuse half, owed since S6-V. A0, A1, A3, A4, A5, A6 stand PASSED and are not re-run. No tenant data
leaves the workspace.

THIS LIST IS COMPLETE.

- R1 (A2's notCompared clause, F-520). The same account 2 through the dashboard's copy line (`dashboard.mjs account v2
  --account-id <GSID> --kb <kb>`). Pass bar: every program `against.notCompared` names is either one the snapshot holds
  NO row of the account on (`account-not-kept-on-program`, read in `facts.byAccount`) or one it holds rows of whose
  timeline days fall only outside the whole months compared (`no-send-in-months-compared`: the window's partial first
  month or the provisional month); the three programs S6-V found read the second reason, not the first; the page's
  About line "Against the dashboard" names each reason with its programs in words (never "did not keep this account
  there" of a program it kept); the skill's checks line relays the same (the summary's `againstText`).
- R2 (F-521, a lists-on dashboard). v2's latest snapshot is the PRE-FIX selective one (its lists recorded empty), so:
  (1) `refresh v2 --full --kb <kb>` (a full pull: the lists ranked, each record `rankedAt` this pull, `carriedFrom`
  null); (2) `refresh v2 --kb <kb>` (selective: read `meta.refresh.mode`); (3) `report v2 --kb <kb>`. Pass bar: the
  selective snapshot's `honesty.accountSelection.lists[].kept` equal the full one's (same accounts, same order) with
  `rankedAt` the full pull's time and `carriedFrom` set; the report prints the three lists' accounts under the sentence
  "These lists were ranked by the full pull of …", and nowhere "No account met this list's floor" for a list whose
  accounts are in the snapshot. If the full pull outlasts the login, R5 rides it. Optional, if Bradley wants it seen:
  a selective refresh straight from the pre-fix snapshot reads each list "Not ranked on this pull" with the sentence
  naming a full refresh (the state v2 is in now).
- R3 (F-522, read by Bradley). On a timeline page whose programs carry names over 28 characters (account 2's, pulled
  again by R1), and on a dashboard bar chart whose tick labels are cut. The presets' bar charts are by month (never
  cut), so the bar chart is a panel by program on a SCRATCH copy, never v2 itself: `export v2 --out <file>
  --with-snapshot`, `import --file <file> --slug <scratch>` (with `--snapshot` if the export wrote one apart),
  `change <scratch> pages.0.panels=…` listing a bar panel grouped by program on the engagement tab and one panel for
  each other tab that is on (the spec refuses a list that leaves an on tab with none; `--dry-run` says which, and its
  printed consequence must read rebuild, no pull: stop if it says pull), open the scratch admin page; remove the
  scratch dashboard at the close. Pass bar: hovering, focusing (Tab) or clicking / tapping a shortened label shows its whole
  name over the chart; a second click or tap closes it; Escape or a click elsewhere closes it; Bradley reads both
  ("the full name is reachable").
- R4 (F-518, the resume line). Any pull of v2 that stops on the login and is resumed (R2's full refresh is the likely
  one; else start one with a few minutes of login left). Pass bar: the stop's message says about N more logins (or
  that every call is made) consistent with the run's `plan.json` `estimate.thisRun.remaining`; the resume's opening
  stderr "continuing the refresh of v2 (run …): about N minutes of its M minutes remain …" has N at or below M, and N
  below the stop before it when the same run is stopped twice. Read N, M and `remaining` against `thisRun` in the run
  directory's plan.json.
- R5 (A7's reuse half, owed since S6-V). A timeline pull through the dashboard (`dashboard.mjs account v2 --account-id
  <GSID> --last 12m --kb <kb>`) started with a few MINUTES of login left (not seconds), so that answered data calls
  are on disk when it stops on the login (exit 3); after `gs-admin login`, the same line continues the same run
  directory to exit 0. Pass bar: the second run's summary `calls.reused` counts the answered data calls of the first
  (above 1: the login check is always made afresh, so 1 is not a reuse), and its fetch log shows each of those ids
  once as `ok` (not made again).

Carried, not this section's: nothing (F-518 rides R4).
Section status (re-banked): OPEN — R1–R5 owed at the S6-V re-check, hb-20261013-03.
S6-V re-check (2026-10-13 21:06 to 2026-10-14 00:28 @ hb-20261013-03; feat/jo-dash-s6-account-timeline at 6471f8c, clean and level; a terminal in the workspace with --plugin-dir, canary matched; production, reads only, one call at a time, three logins; the pass bar stated before each arm):
- R1 PASSED (F-520 VERIFIED): account 2 through the copy line, exit 0 (1 made, 14 reused: S6-V's same-day directory, the same data under the fixed comparison); `matches-dashboard` ok 11/0; the three programs read `no-send-in-months-compared`, confirmed from the two files (held by the snapshot; timeline days only in the partial first month or the provisional month); the About line names them with the kept-there reason; `againstText` carries the same group for the skill's checks line.
- R2 PASSED (F-521 VERIFIED): the full refresh ranked 25/25/25 (`rankedAt` that pull, `carriedFrom` null); the selective refresh after it (2 months pulled, 11 carried) recorded the same three lists exactly (kind, n, floor, per, segment, the same accounts in the same order) with `rankedAt` the full pull's and `carriedFrom` its snapshot; the report printed the three lists of 25 under "These lists were ranked by the full pull of …" and no floor-miss line. The optional not-ranked arm not run.
- R3 PASSED on the timeline's lanes (Bradley: hover shows the whole name, click opens and closes, Escape closes; "functional if not super pretty", plan backlog LTR-22) and FAILED on the bar chart: a scratch import with a bar panel by program (`change` printed rebuild only; no pull) — the opened name's second wrapped line is painted under the later tick labels (F-522 REOPENED), and the chart is unreadable at 197 rows: labels, scale, provisional stripes (F-524, normal, Bradley's tier). The scratch dashboard removed at the close.
- R4 PASSED (F-518 VERIFIED): the full refresh's stop said "about 1 more login"; its resume "about 34 minutes of its 67 minutes remain … enough for it" (`remaining` 2007 s of 4012) and completed in that login; the selective refresh's stop the same, its resume "about 18 minutes of its 44" (1067 s of 2614), completed. The resume run as the first stop printed it was refused for the missing --full: F-523 (polish).
- R5 PASSED (A7's reuse half): a 12-month timeline through the dashboard started with 125 s of login left stopped (exit 3) after 13 answered calls, 9 of them data calls; after the login the same line continued the same run directory to exit 0 in 12 s with `calls.made` 2 and `calls.reused` 13, each answered id once `ok` in the fetch log (only the login check twice). A7's finished directory of S6-V was moved aside first, or the pull would have reused it whole and never stopped.
- Guard-wiring: the pause ask rendered (command named, both tenants, production flagged); Bradley declined.
Section status: CLEARED with one arm carried — R1, R2, R4, R5 PASSED and A0, A1, A3–A6 stood; R3's bar-chart half FAILED and is carried, on Bradley's ruling at the re-check, as S7's kickoff fix batch (F-522 reopened, F-524, with F-523), re-checked at S7-V with no pull. PR #48 merges on this sitting.

## PUB-3 / PUB-4 — the leaders' copy published from a real dashboard (a shared folder, a claude.ai artifact) and the kickoff batch's charts, on a scratch import with no pull (banked 2026-10-14, builder, Session S7 @ hb-20261014-01; verdict at S7-V)

Owed by: S7-V, its own session, in the consumer workspace with the plugin loaded from feat/jo-dash-s7-publish (a
terminal in the workspace with --plugin-dir, canary matched). No pull is needed for any arm: every one runs on a
SCRATCH import of the kept dashboard v2 made with its snapshot (`export v2 --out <file> --with-snapshot`, `import --file
<file> --slug <scratch>`), so no tenant call is made beyond the tester's own `whoami` (Bradley's aim: a round well
under four hours; the plan's LTR-9 sizing note). Token: hb-20261014-01. Why it is banked: the file-copy target was built against
a temp folder and the artifact target's publish is a skill step only a Claude session can make; a synced folder, the
OneDrive website, the artifact viewer and Bradley's eye are not on the builder's machine. Tenant data stays in the
workspace and in the test folder Bradley names; the artifact is private, titled `[VAL-TEST] …`, and deleted at cleanup
unless Bradley keeps it.

THIS LIST IS COMPLETE (the same rule as above).

- K0 (the kickoff batch by eye, about five minutes; F-524's repro, F-522's reopen). On the scratch: `change <scratch>
  'pages.0.panels=[{"id":"b","tab":"engagement","type":"bar","title":"By program","query":{"groupBy":["program"],"metrics":["sent"]}},{"id":"h","tab":"health","type":"health-schedules","title":"S","knobs":{"staleAfterDays":30}}]'
  --kb <kb>` (prints rebuild only), open the scratch admin page. Pass bar (Bradley's eye): the bar panel is drawn across
  with the names in a column, no two labels overlap; 25 rows drawn with the note naming how many of how many; the
  mass sends run past the scale with a break mark and their figures beside them, every other bar visible; no stripes:
  a provisional name carries *; hover, click and Tab to a shortened name: the whole name shows over everything, no
  label or bar over it (its second line included); narrowing the months to one keeps it readable. The lanes (optional: a
  timeline page is built at its pull, so this one costs a short account pull, about ten reads): `account <scratch>
  --account-id <a GSID with long program names> --kb <kb>`, hover and click a long lane name: shown whole, nothing over
  it. F-523 is held offline by the class
  check (no live stop is needed); a stop met during the round is read against it (the printed line runs as printed).
- P1 (the shared folder, Bradley's condition: "how to get the file there and update to that location"). Bradley names a
  test folder inside his synced OneDrive (a `VAL-TEST-s7` subfolder). `dashboard.mjs publish-target leaders '<folder>'
  --kb <kb>`, then `dashboard.mjs publish <scratch> --kb <kb>`. Pass bar: the summary prints the destination;
  `<scratch>-leaders.html` and `<scratch>-leaders-data/` (the CSVs and `definitions.csv`) are in the folder; from File
  Explorer the file opens in the browser and works whole (filters, tabs, column toggles, Download CSV); on the OneDrive
  website: record what it shows (preview with "open", or a download), and whether the preview runs the filters. A
  second `publish` (or a `rebuild`) replaces the SAME file (one file in the folder, its modified time moved, OneDrive
  shows one item, no "(1)" copy). One CSV opened in Excel: the last column "Data pulled", the definitions file's first
  row the pull's time. The dashboard's spec holds no path (read `spec.json`: `publish.config.to` is "leaders").
- P2 (a failure leaves the pages). Rename the test folder; `publish <scratch>`: exit 0, the summary says the folder is
  not there and how to set another; `latest-*.html` in the workspace unchanged (their modified times); rename it back.
- P3 (the artifact: one short Claude session). `change <scratch> 'publish={"target":"claude-artifact","config":{"url":null}}'
  --kb <kb>` (publish-cost: no pull, no rebuild), then `/gs-superadmin:email-engagement publish <scratch>` in the
  session. Pass bar: the skill publishes the summary's file with `capabilities {downloads: true}` and records the new
  link through `change … publish.config.url=…`, publishing once; Bradley opens it signed in: the page reads as the
  local one (one title, no doubled document: the frame's source has one doctype), the data-pulled line, the months
  filter, About and a column toggle work; Download CSV asks him to confirm and saves a file; the address bar does not
  keep filters (recorded, the known limit). A second `publish` in a new ask updates the SAME link (the version moves,
  the URL does not). Optional: a viewer outside the org sees the sign-in wall.
- P4 (the interview's new question, Bradley's read of its wording): `node .gs-superadmin/plugin/scripts/dashboard.mjs
  questions` and read the `leaders-copy` ask and its four options aloud. Pass bar: Bradley rules the wording (as
  drafted, or his edits, applied by the builder at the fix round), the F-511 practice.
- P5 (optional: SharePoint or Teams, if Bradley has one to hand): open the copy from there and record download vs
  preview (the README states it as unmeasured).

Cleanup at the close: the scratch dashboard and its pages, the test folder in OneDrive, the `leaders` entry in
`.gs-superadmin/publish-targets.json`, the export file; the `[VAL-TEST]` artifact deleted unless Bradley keeps it.
Section status (banked): OPEN — owed at S7-V.

S7-V (2026-10-14 12:30 to 14:15 @ hb-20261014-01; feat/jo-dash-s7-publish at cb73661, clean and level; a terminal in the workspace with --plugin-dir, canary matched; production KB, NO tenant call beyond the tester's `whoami` (token expired all sitting, no login needed); Bradley present for every eye arm; the pass bar stated before each arm):
- Setup PASSED: `export <v2> --out <f> --with-snapshot` (exit 0; its hint names `import --file <f> --snapshot <snap>`, which this section's `import` line omits — the hint was followed), `import … --snapshot … --slug <scratch>` (exit 0, the snapshot carried), the title set to a `[VAL-TEST]` name through `change` (rebuild only), `rebuild` (exit 0, 2 pages); the scratch's `publish` stayed `none` (saved before S7).
- K0 PASSED (F-524 VERIFIED, F-522 VERIFIED; Bradley's eye, two screenshots read): the `change` dry run printed "rebuild only (no pull)" (cost kind in-page). The bar panel by program drawn across, names in a column, no overlap; "The 25 largest by Sent of <n> are drawn …" with every row in the table; in the all-months view no bar is 4× the next, so none is cut (checked against the rule by hand on the snapshot: the ratios run 1.2, 3.3, 2.4), every bar visible down to the smallest; narrowed to Sept–Oct the two mass sends run past the scale with the break mark and their figures beside them, the other bars filling the scale (the rule, run per month over the snapshot, cuts one bar in 4 of 13 months); no stripes, provisional names carry *; a shortened name opened whole by hover, click and Tab, its second line included, nothing over it (the reveal's look "a bit janky … serviceable": LTR-22, unchanged); one month readable. Noticed: the tab foot's "About these figures" explains * and never †, and a † inside a chart name cannot be hovered for its tip (the name's reveal takes the hover) — F-525 (normal, routed to S8; pre-dates S7: UX-1). The optional lanes arm not run (it costs a pull).
- F-523 VERIFIED offline and twice live: the entry-command suite on this checkout 111/111, its F-523 check executing every provoked refresh remedy as printed; live, the no-folder remedy (`publish-target leaders <folder>`, the folder filled in) and the locked-copy remedy (`publish <scratch> …` "to try again") were each run as printed and accepted. No stopped refresh met (no pull this sitting).
- P1 PASSED (Bradley's condition met: the file lands in the named folder under the same name every time): the target set to file-copy by `change` (rebuild only; no folder mapped yet, so the rebuild exited 0 saying why, with the `publish-target` line as remedy, nothing copied); `publish-target leaders '<the test folder>'` (exit 0); `publish <scratch>` (exit 0): the destination printed on stdout and stderr, "(the same file each time)"; the page and `<stem>-data/` with 7 CSVs (6 tables + definitions) in the folder; the copy byte-identical to the workspace's `latest-exec.html`; from File Explorer the page works whole (tabs, a filter, a column toggle, Download CSV); OneDrive web previews it in place with an "open" option and the filters run in the preview (as X1); a second `publish` replaced the same file (8 files before and after, the modified time moved, OneDrive web one item, no "(1)"); one CSV in Excel: last column "Data pulled" on every row (the ISO time with its offset — Bradley "not a huge fan … can live with it"), every CSV BOM-prefixed, `definitions.csv` opening with the "Data pulled" row; the spec's `publish.config.to` "leaders", no path-like text in it.
- P2 PASSED: with the folder renamed, `publish` exited 0, "the folder for "leaders" is not there … Set another with `publish-target …`; the pages in the workspace are untouched", the workspace's two pages unchanged (modified time and checksum), the folder not recreated; renamed back, the retry line restored the folder whole (all 8 files from one publish, no temporary file). Probe fault, recorded: the first attempt chained the publish after a rename that FAILED (a CSV open in Excel locked the folder) with `;`, so the publish ran against the locked folder — it measured the locked-copy branch instead: exit 0, the page and the four CSVs before the locked one replaced, that one and the two after it left from the previous publish, no temporary file, the workspace pages untouched, the message naming the lock and the retry line — but the summary read `published: true` on that partial copy: F-527 (polish, Bradley's ruling on executor's choice 2).
- P3 STOPPED by a platform limit (F-526, normal, routed to S8): the target switched to claude-artifact by `change` (rebuild only; the bank's "no rebuild" is stale: the review made a publish change a rebuild); `/gs-superadmin:email-engagement publish <scratch>` walked by the tester: mode L's script exit 0, `ready`, the artifact form correct offline (no doctype, no html/body element, `<title>` and `<style>` first; `capabilities {downloads: true}`; title `[VAL-TEST] …`). Step L2 cannot run in one short session: the session's Artifact tool must read the whole of a file it did not write before publishing it, the file is about 870 KB (about 250k tokens: a pre-render, the embedded data, the engine and runtime), and one turn reads at most tens of thousands of tokens, so a publish needs several of the operator's messages, every time. Not published; no artifact exists. The viewer arms (one document, data-pulled line, filters, About, a column toggle, the downloads confirm, the same link on a second publish, the address bar) are unmeasured and go with the backlog item. Bradley's ruling: withdraw the artifact offer (the interview's option and ask sentence, the README recipe) at S8, keep the code, skill step L2 and T-11's `claude-artifact` value (no contract change), and backlog artifact support (plan LTR-23).
- P4 RULED: the `leaders-copy` ask and its four options read verbatim; Bradley: "as drafted, minus the artifact parts" (with F-526 at S8).
- P5 not run (Bradley: skip): SharePoint and Teams stay unmeasured, as the README states.
- Executor's choices, ruled one question each: (1) the default spec's target file-copy — KEEP; (2) exit 0 on a copy failure — KEEP exit 0, with the summary's flag fixed so a partial or failed copy never reads `published: true` (F-527); (3) the stable data names `<panel>.csv` in `<stem>-data/` — CHANGED: prefix each file with the dashboard's name (S8 applies it; recorded under PUB-3's S7-V rulings); (4) a publish change priced as a rebuild — KEEP. The leaders' copy as the first exec-preset page and "Data pulled" as `pulledAt` were not put (not in the sitting's list; the second accepted at P1's read).
- Walk: the changed SKILL.md (email-engagement) walked once in mode L by the tester (model-invocable); its step 1 asks for a login in every mode though mode L makes no call (noted, not logged: polish, the publish ran on an expired token).
- Guard-wiring: `gs-admin jo p pause --help` drew the guard's ask (the command named, both tenants, production flagged); Bradley declined.
- Noted, not logged: the page did not work when opened from inside a zip archive (Bradley, earlier the same day; not a delivery path, cause unmeasured).
Section status: CLEARED with one arm stopped — Setup, K0, P1, P2 PASSED, P4 ruled, P5 skipped; P3 STOPPED by the platform limit (F-526, the offer withdrawn at S8, artifact support backlogged); F-522, F-523, F-524 VERIFIED; F-525 (normal), F-526 (normal) and F-527 (polish) logged and routed to S8's kickoff batch with the CSV-name ruling.

## S7-V batch — F-525, F-526, F-527 and the dataset-name prefix on a scratch import, with no pull (banked 2026-10-14, builder, Session S8 @ hb-20261014-02; verdict at S8-V)

Owed by: S8-V, in the consumer workspace with the plugin loaded from feat/jo-dash-s8-native (a terminal in the
workspace with --plugin-dir, canary matched). NO PULL and NO tenant call beyond the tester's own `whoami`: every arm
runs on a SCRATCH import of the kept dashboard v2 made with its snapshot, as S7-V did: `export v2 --out <file>
--with-snapshot --kb <kb>`, then `import --file <file> --snapshot <snap> --slug <scratch> --kb <kb>` (the export's hint
names the `--snapshot`; S7-V found the line without it). Token: hb-20261014-02. Why it is banked: the batch was built on the
fictional fixtures; Bradley's eye on a real tab foot, the interview's real wording and a real synced folder are not on
the builder's machine. Tenant data stays in the workspace and the test folder Bradley names.

THIS LIST IS COMPLETE (the same rule as above).

- B1 (F-525: every mark a tab shows is explained at its foot, about five minutes). On the scratch (its latest snapshot is
  v2's selective one, so months are carried): `change <scratch> 'pages.0.panels=[{"id":"b","tab":"engagement","type":"bar","title":"By program","query":{"groupBy":["program"],"metrics":["sent"]}},{"id":"t","tab":"engagement","type":"table","title":"Programs","query":{"groupBy":["program"],"metrics":["sent","openRate"]}},{"id":"h","tab":"health","type":"health-schedules","title":"S","knobs":{"staleAfterDays":30}}]' --kb <kb>`
  (prints rebuild only), open the scratch admin page. Pass bar (Bradley's eye): the Engagement tab's foot, "About these
  figures", has a † line in the table tip's words ("Includes months carried forward from an earlier pull: their
  figures were read by that pull and may have moved since.") beside the * line; the bar chart's own note under it
  says what a † in a name means; a name carrying † is explained without hovering the mark (the foot and the note); a
  tab with no carried figure (Health) has no † line. Optional: narrow the months to the closed ones only — the *
  line goes when no * is drawn.
- B2 (F-526: the artifact offer withdrawn). `node .gs-superadmin/plugin/scripts/dashboard.mjs questions` and read the
  `leaders-copy` ask and its options aloud. Pass bar: three options (a shared folder now, a shared folder later — the
  default — the workspace only), no artifact option and no artifact sentence; the ask otherwise as drafted at S7-V
  (P4's ruling: "as drafted, minus the artifact parts"). `answer <scratch draft> leaders-copy artifact` (on a draft
  from `new <x>`) is refused naming the three options. The plugin README's "The leaders' copy" bullet has no artifact
  recipe and its cost sentence no "one short session". Bradley rules the wording (the F-511 practice).
- B3 (the dataset-name prefix and F-527, a test folder Bradley names inside his synced OneDrive, `VAL-TEST-s8`).
  `publish-target leaders '<folder>' --kb <kb>`, `change <scratch> 'publish={"target":"file-copy","config":{"to":"leaders","file":"<scratch>-leaders.html","datedCopies":false,"datasets":true}}' --kb <kb>`
  (a rebuild, which publishes at its end). Pass bar: `<scratch>-leaders-data/` holds `<scratch>-<panel>.csv` files and
  `<scratch>-definitions.csv`, every name starting with the dashboard's; the summary's `published` true. Then open ONE
  of the CSVs in Excel (it locks the file) and `publish <scratch> --kb <kb>` again. Pass bar: exit 0; the summary reads
  `published: false` with `partial` naming the replaced files (the page first) and the locked one with every file after
  it as not replaced; `why` starts "the copy is not whole"; no temporary file left in the folder; close Excel, `publish`
  again: `published: true`. Optional, if the test folder held S7-V's unprefixed `<panel>.csv` files: they are gone after
  the publish (the stale-file pruning).
- B4 (the skill's mode L Leaders line). On the locked-file publish of B3 walked through `/gs-superadmin:email-engagement
  publish <scratch>` (the tester invokes it: model-invocable): the Leaders line says the copy is not whole, lists the
  files still holding the previous publish and asks to close what holds them and publish again.

Cleanup at the close: the scratch dashboard and its pages, the test folder's contents, the `leaders` entry in
`.gs-superadmin/publish-targets.json`, the export file.
Section status (banked): OPEN — owed at S8-V.

S8-V (2026-10-14 @ hb-20261014-02; feat/jo-dash-s8-native at 5d74a44, clean and level; a terminal in the workspace with --plugin-dir, canary matched; production KB, NO pull and no tenant call beyond the tester's `whoami`; Bradley present for every eye arm; the pass bar stated before each arm):
- Setup PASSED: `export <v2> --out <f> --with-snapshot` (exit 0), `import --file <f> --snapshot <snap> --slug <scratch>` (exit 0, the snapshot carried: selective, months carried), the title set to a `[VAL-TEST]` name through `change` (rebuild, exit 0).
- B1 PASSED (F-525 VERIFIED): the `change` printed "rebuild only (no pull)"; the scratch admin page's markup: the Engagement tab's "About these figures" holds the * line and a † line in the table tip's words, the bar chart drawn across carries its own † note, the Health pane has no notes block; Bradley's eye on the page: "Passes as described". The optional closed-months-only check not run.
- B2 PASSED (F-526 VERIFIED): `questions`: `leaders-copy` has three options (a shared folder now with its follow-up, a shared folder later — the default — the workspace only), no artifact sentence in its ask, and no question in the table mentions an artifact (0 occurrences); `answer <draft> leaders-copy artifact` and `… claude-artifact` each exit 1 naming the three options; the plugin README's leaders' copy bullet holds no artifact recipe and its cost sentence reads "the publish is a file copy, with no Claude session". Bradley read the ask and its options verbatim: "Reads right" (P4's ruling held).
- B3 PASSED (F-527 VERIFIED; the dataset-name prefix CLEARED): a `VAL-TEST-s8` folder in Bradley's synced OneDrive; `publish-target leaders '<folder>'`; the B3 `change` (a rebuild, which published at its end): `published: true`, the data folder 7 files, every name starting with the dashboard's (6 tables + `<scratch>-definitions.csv`); the workspace's `latest-exec-data/` prefixed the same. One CSV (the 4th data file in the publish's order) held open by Excel: `publish` exit 0, `published: false`, `partial.replaced` = the page and the 3 data files before it, `partial.notReplaced` = the locked file and the 3 after it, `why` opening "the copy is not whole: 4 of 8 files were replaced and 4 still hold the previous publish (…)" with the retry line, no temporary file, the modified times confirming the split. Excel closed; S7's unprefixed `headline.csv` and `definitions.csv` planted in the data folder; `publish` exit 0, `published: true`, `partial` null, both planted files pruned. Noted, not logged: the `why` repeats the error code ("EPERM: EPERM:"), cosmetic.
- B4 PASSED: the changed SKILL.md (email-engagement, model-invocable) walked by the tester in mode L (`publish <scratch>`) on the locked folder (step 1's whoami, then the script: the same partial): its Leaders line said the copy is not whole, named the four files still holding the previous publish and asked to close what holds them and publish again.
- Cleanup done: the scratch dashboard and the draft made for B2, the export and snapshot files, `publish-targets.json` (it held only `leaders`), the OneDrive test folder (made by the tester, removed whole); v2 and the other kept dashboard untouched.
Section status: CLEARED — B1–B4 PASSED; F-525, F-526, F-527 VERIFIED; the dataset-name prefix CLEARED.

## NAT-2 — native Gainsight reports created from a dashboard, on the SANDBOX only (banked 2026-10-14, builder, Session S8 @ hb-20261014-02; verdict at S8-V)

Owed by: S8-V, in the consumer workspace with the plugin loaded from feat/jo-dash-s8-native (a terminal in the
workspace with --plugin-dir, canary matched). SANDBOX ONLY: `rp create` and `rp update` are mutating and write
reports into the tenant; production is never used for this section. Every report is named `ZZ|TEST|…` (the
`--test-prefix` flag). Token: hb-20261014-02. Why it is banked: the build ran offline against the stand-in CLI, whose `rp create`
/ `describe` / `run-saved` are modelled on the CLI's report handler at the pin; what `rp create` prints, the server's
acceptance of each payload, the UI's calculated-column grammar and run-saved's real labels are unmeasured.

Pick before the first call (the tester, with Bradley): a sandbox dashboard. The sandbox KB has none saved today, so the
cheapest is the fast path on the sandbox KB with lists off (`dashboard new zz-native --fast-path --kb <sandbox kb>`, then
the closing step's save and first refresh: a small pull on a sandbox). A `whoami` names the sandbox before anything else.

THIS LIST IS COMPLETE (the same rule as above).

- N0 (the guard on the mutating lines, before anything is created). Pass bar: `native-plan <dash> --test-prefix --kb
  <sandbox kb>` exits 0 with `schemaChecked: true` (its one schema read and the whoami are the only calls in the fake-free
  run: count them on stderr/journal); the summary's `reports` each carry a `command` starting `gs-admin --json rp
  create --name 'ZZ|TEST|`; issuing the FIRST one as its own command draws the guard's ask naming `report create` and
  the sandbox (Bradley approves this one); no script ran any of them (the change journal holds one row per approved
  command, none from a script).
- N1 (the plan reads right to Bradley). Bradley reads the summary: the verdicts (native, partial with what is left out
  and why, not native with why), the shared panels, and the dashboard steps. Pass bar: his read; a wording he would
  change is logged (F-511 practice).
- N2 (create and record each, one at a time, through the skill's mode N). `/gs-superadmin:email-engagement native <dash>
  --test-prefix` walked by Bradley typing it (or the tester invoking it: model-invocable): the plan shown, one approval ask,
  then each `command` issued as its own Bash command (one guard ask each), each followed by `native-record <dash>
  --panel <panel>`. Pass bar: every create exits 0; every record finds the report by its exact name and writes
  `native.reports[]` with the panel, id, name and an eight-digit fingerprint (read `spec.json`); the shared panels are
  recorded under the same id. Record what `rp create` printed (its shape, for the stand-in), without values.
- N3 (read back). `native-verify <dash> --kb <sandbox kb>`. Pass bar: every report `ok`, `rows` above 0, `missing` empty
  (the group and count labels came back as planned: record the real labels if they differ from `Program`, `Program
  id`, `Month`, `Sent`), every value a string; `uiPending` names the UI columns. One program's Sent equals the
  dashboard snapshot's sent for the same program over the same months once a Months dashboard filter is set (or
  equals a direct `rp run` count with the same standing filters and no date filter).
- N4 (one formula column in the UI, Bradley's hands). On one partial report (the admin headline or "Programs"), Bradley
  adds the UI steps' calculated column "Delivered" and the formula column "Open rate" in Gainsight's report builder,
  then `native-verify` again. Pass bar: that report's `uiPending` no longer names them; the open rate read back as a
  formatted string equals the dashboard's to the display's rounding for one program over the same months. Record the
  UI's own grammar for the condition if the steps' wording ("the SUM of a field that is 1 when …") does not map onto
  it one to one.
- N5 (re-run and update). `native-plan` again: every report `unchanged`, nothing to create. Change one panel's title
  (`change <dash> 'pages.0.panels=…'` or a preset title through a hand-written panel list), `native-plan`: that panel
  `update` with its `warning`; issue the update line (one guard ask), `native-record`, `native-verify`. Pass bar: the
  report keeps its id with the new name; the warning held (the UI columns of N4 are gone after an update of that
  report — measure it on the N4 report only if Bradley agrees, else on another).
- N6 (cleanup, by hand in the UI: the CLI cannot delete a report). The skill's final report lists every report it created
  with its id and name. Pass bar: the list matches `native.reports[]`; Bradley deletes each `ZZ|TEST|` report in the
  Gainsight UI (Reports, search "ZZ|TEST|"); the tester records the count deleted. A dashboard of the reports, if one
  was arranged, is deleted the same way.

Cleanup at the close: the ZZ|TEST| reports deleted in the sandbox UI (N6), the scratch sandbox dashboard and its
pages/snapshots under the sandbox KB, the `native/` folder beside it.
Section status (banked): OPEN — owed at S8-V.

S8-V (2026-10-14 @ hb-20261014-02; feat/jo-dash-s8-native at 5d74a44, clean and level; a terminal in the workspace with --plugin-dir, canary matched; the SANDBOX tenant (`whoami` named it before the first call; the switch and the login typed by Bradley), one call at a time, two logins; every report `ZZ|TEST|…`; the only writes the nine `rp create` and one `rp update` lines `native-plan` printed, each its own command, each approved by Bradley at the guard's ask; the pass bar stated before each arm):
- Ruled at the start (Bradley, "ok making updates to our testing here, as long as we can still reasonably verify what we need to"): the sandbox dashboard is SAVED WITH NO PULL — a native report carries no date filter and `native-plan` reads only the saved spec, the whoami and one schema read — so N3 and N4 compare against direct `rp run` counts (the alternative N3's bar already allows), never a snapshot. A sandbox sends nothing; its log holds copied history (49 months read back).
- Pick: the fast path on the sandbox KB (`zz-test-native`, customer lists off, a `[VAL-TEST]` title); the closing step's plan made 17 reads (one timed out and answered on its retry) and priced a full refresh at about 40 calls; `save later` exit 0, nothing pulled.
- N0 PASSED: `native-plan <dash> --test-prefix` exit 0, `schemaChecked: true`; 24 panels: 6 native, 6 partial, 12 not; 9 to create, 3 shared; every `command` starts `gs-admin --json rp create --name 'ZZ|TEST|`. Calls: the whoami and one `rp schema` (read from the verb's code: it prints no progress line and reads are not journaled, so the count was not observed). Every create drew the guard's ask; its text (Bradley's paste, creates 2–4): "Mutating Gainsight command: gs-admin report create … Workspace manifests claim multiple tenants (<both named>) — confirm `gs-admin whoami` targets the intended one before approving. ⚠ At least one of these tenants is PRODUCTION …" — the action and both workspace tenants, not which one is active (the guard's documented multi-tenant shape). The first create's ask was seen, not captured. The journal: 9 `report create` rows, guard-approved, none from a script, in the workspace's unattributed journal (two tenants and no change marker: by design).
- N1 READ by Bradley, F-528 logged (normal): the plan never states what a report IS — object, columns, group-by, filters — which lives only inside each line's JSON ("if this is intended to be instructional, you'd want to include the name of the table the report needs, field names, and if there's any group by … as well as any filters that are needed/logic").
- N2 PASSED: mode N walked by the tester (model-invocable): step 1's whoami, the plan again (the same 9 lines), its ONE approval ask (AskUserQuestion: create 9, update 0; Bradley: yes), then each line issued exactly as written as its own Bash command, `native-record` after each: every create `result: true` with a report id, every record "found by its exact name"; `spec.json` `native.reports[]` 12 records over 9 distinct ids (the leaders' three shared panels under their admin report's id), every name `ZZ|TEST|…`, every `planHash` eight hex digits. What `rp create` printed, for the stand-in (keys, no values): `{result, requestId, data: {createdDate, modifiedDate, deleted, reportId, reportName, reportDescription, sourceDetails{objectName, objectLabel, connectionId, connectionType, dataStoreType}, showFields[{fieldName, dbName, label, fieldAlias, dataType, objectName, objectDBName, properties{meta, required, aggregatable, pathLabel, columnCalculationConfigs[]}, displayOrder, fieldType, displayName, rowGrouped, pivoted, scale, groupable, sortable, filterable, expressionDetails{expressionType, expression{tokenType, key, outputDataType}}}], drillDownFields[], groupByFields[], whereFilters{conditions[{filterAlias, comparisonOperator, rightOperandType, filterValue{value[]}, global, globalFilter, anyAtGlobal, stateFilter, leftOperand{…}}], expression}, havingFilters{conditions[]}, teamFilters{conditions[], expression}, orderByFields[], pageSize, reportDisplayType, reportOptions{…}, properties{}, reportTypes[], offset, requestSource, folderId, currentRowGroupLevel, createdBy, modifiedBy, createdByName, modifiedByName, createdDateStr, modifiedDateStr}, duration, alerts[]}`; `rp update` prints the same envelope.
- N3 PASSED: `native-verify` 9 of 9 `ok`, rows above 0 (1 on the two ungrouped reports; 49 on the two by month; a full 50-row page on the five by program or email: the verify reads one `--page-size 50` page by design), `missing` empty, the labels as planned (`Program`, `Program id`, `Month`, `Sent`, and `Email`, `Email id` on Emails), every value a display-formatted string (thousands separators, `Mon-YYYY`), `uiPending` naming each report's UI columns. Direct counts with the same two standing filters and no date filter: one program's Sent equal (a count under 10), the headline's total equal (order 10^6).
- Executor's choices, ruled one question each: (1) GRID only — KEPT ("all tables is fine"; trend panels as charts to the backlog, plan LTR-24); (2) one report per panel — KEPT (premise reopened by N4, F-528); (3) no order-by / having / limit through the CLI — KEPT (to the backlog, LTR-25); (4) the naming — KEPT; (5) sharing — KEPT; (6) an update confirmed by name — KEPT; (7) 0.54.0 with its own entry — KEPT. Bradley asked what the native reports are for; answered: admins viewing the figures inside Gainsight, not feeding the page (the report-fed idea is IDEA-1).
- N4 FAILED (F-528's second instance): in the sandbox's report builder (Bradley's hands, the headline report) the steps' calculated columns ("the SUM of a field that is 1 when …") cannot be built — "there is no case/if logic"; "Add Formula Field" offers only the object's own numeric fields (link clicked count, number of opens, total responded), so no rate can be built in a report. Measured UI path for the counts: group or pivot the report on the flag fields (two screenshots: Sent grouped by Bounced and Opened; "Switch Pivot" with Opened in columns). Bradley's proposal for the rates: a Data Designer with CASE statements. Not saved; the second `native-verify` not run (nothing added).
- N5 PASSED: `native-plan` again: 9 unchanged, 3 shared, nothing to create. Send health retitled through `change pages.0.panels=<the admin preset with that title changed>` (rebuild only; "no snapshot yet", as saved with no pull); `native-plan`: exactly that panel `update` with its `warning`; the line issued (its own guard ask, "Mutating Gainsight command: gs-admin report update", the same two-tenant text, Bradley's paste) → `result: true`, the SAME report id, the new name; `native-record` "its name is the planned one (…)"; `native-verify` ok, rows 1; `native-plan` after it: 9 unchanged. The warning's half (UI columns dropped by an update) unmeasured: the report had none, and N4 found none can be built.
- N6 PASSED: the skill's list and `native.reports[]` matched (9 reports); Bradley deleted the 9 in the sandbox UI (they sit in the UI's trash); a fully paged `gs-admin --json rp list` (200 a page, the last page short) holds 9 fewer reports than before and no `[VAL-TEST] S8-V` name. One older `ZZ|TEST|` report from a pre-program verification round remains, not this round's: left for the program wind-down's sweep. No Gainsight dashboard was arranged.
- Guard-wiring: the ten real mutating lines (above), each ask rendered and approved; the tenant switch was typed by Bradley.
- Cleanup done: the sandbox dashboard folder (spec, `native/`, plan and verify payloads; the sandbox KB had no `dashboards/` before this round), the closing step's run directory, the session's scratch payloads.
Section status: CLEARED with one arm failed — N0, N2, N3, N5, N6 PASSED, N1 read (F-528), N4 FAILED (F-528's second instance: the UI steps cannot be performed; counts by a pivot, no rate in a report). F-528 (normal, OPEN) gates the release, not the merge (the S6-V and S7-V precedent). Ruled at the close (Bradley): PR #51 merges on green CI; mode N is WITHDRAWN as an offer for now (F-526's pattern; code, verbs and T-11's `native` kept), native reports backlogged with the measured routes (plan LTR-26) — the withdrawal is F-528's fix round.

## F-528 — the withdrawal read (banked 2026-10-14, builder, F-528 fix round @ hb-20261014-03; verdict at F-528-V)

Owed by: F-528-V, in the consumer workspace with the plugin loaded from feat/jo-dash-f528-withdraw-native (a terminal in
the workspace with --plugin-dir, canary matched). NO PULL and NO tenant call: nothing here reads the tenant. Token:
hb-20261014-03. Why it is banked: the withdrawal is prose (a skill mode, two READMEs, a CHANGELOG entry), and no suite runs
skill prose; the check (W3) reads the text, but only a walk shows what the skill does when asked.

THIS LIST IS COMPLETE.

- W1 (the skill read and walked once; email-engagement is model-invocable, so the tester invokes it). Read the skill's
  description, argument hint, mode list, ground rules and Arguments. Then ask the session for native reports
  ("make Gainsight reports from the program-health dashboard"). Pass bar: the skill says native Gainsight reports are
  not offered in this release (Gainsight's report builder cannot finish them) and stops, with no `native-plan` run and
  no `rp create` line; the description ends "Never mutates the tenant."; no mode N anywhere in the skill.
- W2 (the READMEs and the CHANGELOG read). The plugin README's email-engagement section ("Never mutates the tenant." with
  no exception) and its dashboard section (no native-reports recipe); the repo README's email-engagement bullet (no
  native clause); the CHANGELOG's 0.54.0 entry (its title names no native reports; the one line saying the verbs ship
  in the entry command but are not offered, F-528). Pass bar: no shipped prose offers native reports; Bradley rules
  the wording.
- W3 (the check's run). `node plugins/gs-superadmin/test/dashboard.mjs` in the repo. Pass bar: the "F-528 native
  reports are not offered" check passes (and the suite with it); the native suite (`test/dashboard-native.mjs`) still
  passes (the code is kept).

Results (F-528-V, 2026-10-14 @ hb-20261014-03, tester; feat/jo-dash-f528-withdraw-native at d9677b2, clean and level;
canary matched; no tenant call):
- W1 PASSED: the skill invoked by the tester session with "make native Gainsight reports from the digital-outreach-health
  dashboard" replied that native Gainsight reports made from a dashboard are not offered in this release (Gainsight's
  report builder cannot finish them) and stopped: no `native-plan`, no `rp create`, no command at all. The description
  ends "Never mutates the tenant."; no `## N`, no `native` in the hint or the mode list, the ground rule "Read-only
  tenant." with no exception; the skill's only "native" is the Arguments sentence.
- W2 FAILED: the plugin README's dashboard section, its email-engagement sentence ("Never mutates the tenant."), the repo
  README's bullet and the CHANGELOG's 0.54.0 entry (title "Four fixes to the leaders' copy and the page's marks.", the one
  not-offered bullet) match the bar; but the plugin README's skill catalog row for email-engagement still reads "(its
  panels also creatable as Gainsight reports, each behind the guard)" — an offer the withdrawal missed (added by the S8
  commit; no "native" in it). Bradley's wording ruling not asked: the section goes back to the builder first.
- W3 PASSED as a run, not as a judge: `test/dashboard.mjs` 124/124 (the F-528 check PASS), `test/dashboard-native.mjs`
  23/23 — with the catalog row present. The tester's own mutant (Step 1's router restored to "N (native Gainsight
  reports)") SURVIVED, predicted: the check reads chosen spans, not the router or the Arguments.
Section status: OPEN — W1 and W3 passed, W2 failed; F-528 REOPENED (bus, first reopen). Owed at the next verdict round:
  W1–W3 again, Bradley's wording read included.

Re-banked 2026-10-14 (tester, role inversion on Bradley's word; the fix at cc83ea6, F-528's second Fix line): the verdict
of record is the BUILDER's, at the close-out (the tester authored this fix and may not verify it). Owed by the builder:
- C1 (the differential). Revert each -U0 prose hunk of 1f7593a (the skill, both READMEs, the CHANGELOG) and cc83ea6's row
  hunk alone on the branch and run the committed F-528 check: every one fails it, on its own clause. Pass bar: 13 of 13.
- C2 (the read). The plugin README's skill-table row for email-engagement carries no Gainsight-reports clause; W1's skill
  reply stands (the skill is unchanged since F-528-V). Bradley's wording read of W2: DONE 2026-10-14 at F-528-V (the
  four places quoted to him as they stand at hb-20261014-04): "fine as is, i can probably clean later if needed" — the
  wording stands; nothing owed on it at the close-out.
- C3 (the run). `test/dashboard.mjs` (the F-528 check included) and `test/dashboard-native.mjs` pass; CI green on PR #52.

Results (builder close-out, 2026-10-14 @ hb-20261014-04; feat/jo-dash-f528-withdraw-native at 531a9b5, clean and level):
- C1 PASSED: 13 of 13 hunks KILLED pred:KILL, each on its own clause (the builder's harness: the committed F-528 block run
  verbatim, predictions written first, the tree asserted clean after each); the builder's sibling probe S1 (the row's offer
  reworded with neither key word) SURVIVED pred:SURVIVE, a limit of any word-keyed check, recorded on the bus, not logged.
- C2 PASSED: the skill-table row reads its pre-S8 words; the differential against 2268d66 finds no surviving S8 line about
  native reports in the skill, either README or the CHANGELOG; the wording read stands (Bradley, above).
- C3 PASSED locally: test/dashboard.mjs 124/124, test/dashboard-native.mjs 23/23; CI on PR #52 at the merge, named in the
  close-out comment on dev.
Section status: CLEARED — F-528 VERIFIED (builder, the verdict of record for the role-inversion fix).

## R12-A — the release gate's fixes (banked 2026-10-15, builder, R12 fix round A @ hb-20261015-01; verdict at the R12-A verdict round)

Owed by: the R12-A verdict round, in the consumer workspace with the plugin loaded from `dev` once PR (R12-A) is merged
(a terminal in the workspace with --plugin-dir, canary hb-20261015-01 matched). NO PULL: every arm runs on the stand-in, on the
repo's suites, or on a SCRATCH import of the kept dashboard (digital-outreach-health-v2: `export … --with-snapshot`, then
`import --file … --slug r12a-scratch`), never on the kept dashboard itself. The only tenant call allowed is `whoami`; arm
V7's account lines are optional and read the tenant (a login), and are skipped without one (say so). The publish arms
point a NEW publish target at a temp folder (`publish-target r12a-temp <a new empty folder>` and
`change r12a-scratch 'publish.config.to="r12a-temp"'`), never the leaders' shared folder. Token: hb-20261015-01. Why it is
banked: the fixes are judged by the suites, but three of them change what an admin reads (the change summary's words,
the tiles, the skill's route), and no suite reads skill prose.

THIS LIST IS COMPLETE.

- V1 (F-529 narrow, on the scratch import). `change r12a-scratch accounts.lists=[{"kind":"most-bounced","n":5,"floor":0}]
  --kb <kb> --dry-run`, then the same line without `--dry-run`. Pass bar: `consequenceText` says the pages are rebuilt
  with no pull and the changed lists are ranked at the next full refresh, with the line `… refresh r12a-scratch --kb <kb>
  --full` and the reason (a routine refresh, or the rows no longer in the workspace: an import carries no run
  directory); the change exits 0 with `done.ranked` false, `done.rebuilt` true and `done.text` saying the same in a
  sentence; the scratch's admin page is rebuilt (its file time moves) and no call is made (nothing pulled).
  Read `done.text` to Bradley: is it what an admin should read? (Running the `--full` line is NOT part of this round: it
  is a pull.) Then `new r12a-scratch`, `next r12a-scratch --question customer-list-detail`, answer it with one size
  changed, `next r12a-scratch`: the closing ask says the same, and its first option reads "Save and rebuild the pages now
  (no pull; the customer lists are ranked at the next full refresh)"; close with `save-only` answers (or discard the
  draft).
- V2 (F-531, the tile, on the scratch import with no pull). `rebuild r12a-scratch`, open the admin page in a browser.
  Pass bar: each count tile's change reads against the usual over the closed months shown, with "(over the N closed
  months shown; the current month is left out until it closes)"; pick only the last closed month in the filter bar: the
  change is that month against the usual, with no note; pick only the current month: "no closed month shown to compare
  with it". The Health tab's bounce-reason table's Change column reads "(closed months)". Bradley's eye: in the default
  whole-window view the change now reads level (the window's closed months ARE the usual): keep that, or rule another
  default comparison (the builder's call was closed months, stated in F-531's Fix note).
- V3 (F-532 / F-540, on the scratch import, the temp target). (a) The import of V1's setup said
  `publishRenamed` (to `r12a-scratch-leaders.html`). (b) `change r12a-scratch
  'publish.config.file="digital-outreach-health-v2-leaders.html"' --kb <kb>`: refused, naming the kept dashboard,
  nothing saved. (c) `publish r12a-scratch`, then `change r12a-scratch 'publish.config.file="r12a-renamed.html"'`: the
  summary's `done.publish.noLongerUpdated` names the earlier page and its data folder, both still in the temp folder.
  (d) Into the temp target's data folder drop a file `other-dashboard.csv`, then `publish r12a-scratch`: it is still there
  (the prune removes only what this dashboard wrote). (e) An import with `--snapshot` pointing at a file that is not a
  snapshot (any JSON file): refused "nothing was imported", and no new dashboard folder.
- V4 (the stand-in suites, run once in the repo at the merged dev). `node plugins/gs-superadmin/test/dashboard.mjs`,
  `test/engagement-query.mjs`, `test/dashboard-page.mjs`, `test/jo-report.mjs`, `test/engagement-report.mjs`. Pass bar: all
  pass; read the R12-A checks by name (F-529 ×6, F-531, F-532 ×4, F-533, F-534, F-535 ×2, F-537, F-538, F-539, F-540, F-543,
  F-544, F-547 ×2) and that each provokes its section's reported scenario (the Judge lines on the bus).
- V5 (F-547, a CSV opened). `node .gs-superadmin/plugin/scripts/dashboard.mjs report r12a-scratch --kb <kb> --csv-dir
  <a temp folder>`; open `engagement-programs.csv` in Excel. Pass bar: it opens with no formula warning; a cell that
  starts with `-` (the "--" placeholders, if any) shows as text. Optional: the jo-report goldens' apostrophes read by
  Bradley as acceptable in Excel.
- V6 (the changed skill walked once: email-engagement is model-invocable, so the tester invokes it). Ask "what's the
  open rate for <a program the scratch dashboard does not hold — one that last sent before its window>?". Pass bar: the
  skill runs `dashboard list` (reads `holds`), the dashboard report, then says the program is not on the dashboard (its
  selection or window) and goes on to the plan with `--name <that program>`, stopping at the plan's ask (decline it; the
  plan itself is a handful of cheap reads: run it only with a login, else stop before it and say so). Then ask about a
  program the dashboard holds but whose status is Paused, if the scratch holds one: the report re-run with
  `--include-paused`. If the scratch snapshot is older than 7 days, the ask prices the routine pull from
  `refreshMinutes` (or, null, the null wording with `fullRefreshMinutes`). With `--csv`, the report line carries
  `--csv-dir`. Read the exit-4 rule (F-533), the R2 describe-batch line (F-538) and mode A's two new rules (F-539) as
  written.
- V7 (F-539, optional, a login). `account r12a-scratch --account-id <a GSID> --kb <kb>` on a scratch whose snapshot was
  removed (`rm -r <kb>/dashboards/r12a-scratch/snapshots`): the summary's `againstSnapshot` is null and the skill's
  Checks line reads "ok; not compared with the dashboard: it has no pull yet"; `--account-id co-nobody`: exit 6 with no
  candidates, the skill relays `error` and asks for the spelling or the GSID.

Cleanup: `rm -r <kb>/dashboards/r12a-scratch`, the temp folders, and the `r12a-temp` publish target
(`.gs-superadmin/publish-targets.json`: remove the key by hand or leave it pointing at the deleted folder).

Results (R12-A-V, 2026-10-15 @ hb-20261015-01, tester; dev at d9bdb99 (PR #53 merged), clean and level; a terminal in the
workspace with --plugin-dir, canary matched; production KB, no pull; tenant reads: whoami, then on Bradley's login (asked:
the closing step's pre-flight needed one) V6's plan and V7's two account lines):
- V1 PASSED: the dry run and the change as the bar says (done false, ranked false, rebuilt true, the `--full` line and the
  reason, a routine refresh); done.text read to Bradley: "Yes, as written". The edit screen's closing ask and first option
  as the bar says. Probe faults: the closing step's token pre-flight (a login, not foreseen here); V3's changes on the same
  scratch replaced the open draft, so the edit was redone with another size.
- V2 PASSED by Bradley's eye: the default view level on all five tiles with the closed-months note; September alone with no
  note; October alone "no closed month shown to compare with it"; September to October "over the 1 closed month shown";
  the Health column "Change (closed months)". Bradley's ruling on the default comparison: "Polish, after 0.54.0" (the
  plan's backlog).
- V3 PASSED with a SUBSTITUTION: the kept dashboard publishes nowhere, so (a) and (b) ran on a second import of the scratch
  after giving it a file-copy target (r12a-scratch2): (a) publishRenamed said; (b) the exact and a mixed-case name refused,
  naming r12a-scratch, the spec byte-equal; (c) noLongerUpdated named the old page and data folder, both left; (d) the
  planted CSV survived; (e) a non-snapshot JSON refused, "nothing was imported", no folder, and under --replace the spec
  byte-equal.
- V4 PASSED: test/dashboard.mjs 143/143, test/engagement-query.mjs 144/144, test/dashboard-page.mjs 212/212,
  test/jo-report.mjs all passed, test/engagement-report.mjs 56/56; every R12-A check named above present and passing.
- V5 PASSED on what the data holds: five CSVs, 2,836 cells, none starting with a formula character (none needed the
  apostrophe); engagement-programs.csv in hidden Excel: no formula, no error cell. The adversarial arm rests on V4.
- V6 FAILED on F-534 (reopened, two instances on its own fields: held/holds selection prints "[object Object]"; a stale
  import is priced "about null minutes"); the route itself passed by Bradley's eye; the walk stopped before the pull. The
  exit-4 rule (F-533), the R2 describe line (F-538) and mode A's two rules (F-539) read as written: PASSED.
- V7 PASSED (with the login): againstSnapshot null on a scratch with no snapshot; co-nobody exit 6, no candidates, an error
  to relay.
Section status: OPEN on F-534 only (fixed by the tester's role inversion the same day; the close-out below owes the
verdict of record); the twelve other sections VERIFIED on the bus.
Section status: CLEARED (release prep, 2026-10-15, builder) — F-534 VERIFIED by the close-out below (PR #54 merged at 13293c3), so every R12-A section is VERIFIED; V2's default-comparison question ruled by Bradley "Polish, after 0.54.0" (the plan's backlog). Spent for 0.54.0.

## R12-A-V close-out — the builder's verdict on the tester's F-534 role-inversion fix (banked 2026-10-15, tester, @ hb-20261015-02)

Owed by: the BUILDER (the tester authored the fix and may not verify it), on fix/r12a-v-f534-held-words before its PR
merges. No tenant call. Token: hb-20261015-02.

THIS LIST IS COMPLETE.

- C1 (the class). On the branch: `node plugins/gs-superadmin/test/dashboard.mjs` passes, its two new F-534 checks among them
  (the "[object ...]" scan over every verb's output; the sent-since words from a selector built by resolveParams). Revert
  the dashboard.mjs hunk alone: both fail. Pass bar: both checks pass on the fix and fail on the revert.
- C2 (the read). SKILL.md R2's new sentence (both prices null: no minutes, the pull's time known once its first refresh
  here plans it) reads right against the summary a fresh import's report returns (refreshMinutes and fullRefreshMinutes
  both null). Pass bar: the sentence covers that case and no other case changed.
- C3 (the run). CI green on the fix PR at its head.

Results (builder close-out, 2026-10-15, fix/r12a-v-f534-held-words at e1c2c1f; no tenant call):
- C1 PASSED: the branch head 145/145 with both new F-534 checks passing; the dashboard.mjs hunk reverted alone 2 FAILED of 145,
  exactly the two new checks (the words check and the [object] scan), each naming "[object Object]" — predicted.
- C2 PASSED: a fresh import's report has refreshMinutes and fullRefreshMinutes both null (no run directory of its own), the
  sentence's case; no other R2 case changed. The sentence was reworded by the builder for C3 (meaning unchanged; F-534's
  Builder amendment line), so Bradley's read of its words is the one item still open, and it does not gate the merge.
- C3 FAILED at 1aa9b49 (validate-plugin run 38769298383: engagement-report's bare-word prose check), PASSED at e1c2c1f
  after the amendment (validate-plugin run 38770931304, docs-drift run 38770931245; CLEAN).
Section status: CLEARED — F-534 VERIFIED (builder, the verdict of record).

## F-548 — ranking on every refresh (banked 2026-10-15, builder, Session B @ hb-20261015-04; verdict at the F-548 verdict round)

Owed by: the F-548 verdict round, in the consumer workspace (Gainsight_Workspace) with the plugin loaded from the branch
under test (a terminal in the workspace with --plugin-dir, canary hb-20261015-04 matched). LIVE: about two hours of pulls on
the KEPT dashboard (digital-outreach-health-v2), production, reads only, one call at a time, as many logins as the pulls
take (the runner checkpoints across them). Order matters: L1 runs while the kept dashboard's latest snapshot is still
the one 0.54.0 made (no account store beside it, no meta.accountStore), so the migration arm is first. L3 runs on a
SCRATCH import (f548-scratch), never a list change on the kept dashboard. Token: hb-20261015-04. Why it is banked: the suites
judge the store over the fixture tenant and the stand-in; what only the kept dashboard can show is the migration on a
real 0.54.0 snapshot, the store's real size and time, a selective refresh's lists against a full one's on real data,
and the skill relaying the new words (no suite reads skill prose).

THIS LIST IS COMPLETE.

- L0 (provenance). `git -C <repo> status -sb` on the branch under test; the dev-canary token equals hb-20261015-04. Before any
  pull: the kept dashboard's latest snapshot has no `meta.accountStore` and no `<stamp>.accounts.json` beside it in
  `payscale-prod/dashboards/digital-outreach-health-v2/snapshots/`. Record its three lists' kept counts (25/25/25).
- L1 (the migration, the full pull; the skill walk). In the tester session, invoke `/gs-superadmin:email-engagement`
  (model-invocable: the session invokes it itself) to refresh digital-outreach-health-v2, the plain refresh with NO
  `--full`. Before it runs, `dashboard.mjs report digital-outreach-health-v2 --kb payscale-prod` returns
  `refreshFullOnce` (the latest snapshot "was made before the account store: the customer lists need one full pull to
  start ranking on every refresh …") and `refreshMinutes` equal to `fullRefreshMinutes`. Pass bar: the refresh exits 0
  (across logins if it must: each stop says exit 3, `gs-admin login`, the line again, and continues); `pull.mode` full and
  `pull.why` the sentence above, relayed by the skill in its Pull line; no `--full` was typed and nothing was done by
  hand; `accountStore` names `snapshots/<stamp>.accounts.json`, the only store in the folder, beside the new snapshot;
  the store is plain JSON with one cell per line (open it), its `pulledAt` the snapshot's, its size about 4.6 MB (record
  bytes, cells and accounts: the snapshot's `meta.accountStore` holds the same counts); the pull's minutes (record them,
  about 67 expected). Record the three lists (kind, n, floor, kept in order).
- L2 (a selective refresh's lists against the full one's). Right after L1, the same plain refresh again. Pass bar:
  `pull.mode` selective (record the minutes, about 44 expected); its three lists equal L1's in kind, n, floor, per,
  segment and kept IN ORDER, each `rankedAt` its OWN pull time and `carriedFrom` null; one store in the folder (the new
  one). If a list differs, compare the two snapshots' byTemplate totals over the months L2 pulled (meta.refresh
  .pulledMonths): unchanged totals with different lists is a FAIL; moved totals make the difference legitimate only if a
  full pull agrees, so then run `refresh … --full` (a third pull) and compare its lists with L2's: equal is a pass.
- L3 (a list change with no pull, the page, the report and the About tab; on a scratch import). `export
  digital-outreach-health-v2 --out <tmp>/f548.json --with-snapshot --kb payscale-prod` (the summary names
  `accountStore`, and its hint says the import's first pull is selective), `import --file <tmp>/f548.json --slug
  f548-scratch --kb payscale-prod` (`accountStore` copied beside the imported snapshot), then `change f548-scratch
  accounts.lists=[{"kind":"most-bounced","n":5,"floor":0}] --kb payscale-prod --dry-run` and the same without
  `--dry-run`. Pass bar: the consequence says the lists are ranked again from the account store (a rebuild, no pull);
  the change exits 0, `done.ranked` true, no call made (no login needed); f548-scratch's admin page's Most bounced
  customers panel lists exactly 5 accounts with the note "The 5 most bounced across programs over the whole window, as
  the pull of <date> ranked them."; `report f548-scratch` lists the same 5 in the same order; the page's About tab
  says "the 5 most bounced". Read the panel and the done.text to Bradley: is it what an admin should read? Then the edit
  screen: `new f548-scratch`, `next f548-scratch --question customer-list-detail`, one size changed, `next`: the closing
  ask says the lists are ranked again from the account store, and its first option reads "Save and rank the customer
  lists again now (no pull)"; discard the draft. Remove f548-scratch and the export files at the end.
- L4 (the page on the kept dashboard, F-530). Open the kept dashboard's latest-admin.html after L2. Pass bar: each of the
  three customer-list panels lists the snapshot's kept accounts in the record's order (spot-check the first five of
  each against `honesty.accountSelection.lists`), with the note naming its size and floor; pick a two-month range in the
  filter bar: the note adds "re-ranked here over what is shown" and only the list's own accounts appear.

Results (B-V, 2026-10-15 @ hb-20261015-04, tester; feat/f548-ranking-every-refresh at cc7a69a, clean and level; a terminal in
the workspace with --plugin-dir, canary matched; production, reads only, one call at a time, three by-hand logins; PR #57's
five checks green):
- L0 PASSED with a NOTE: the latest snapshot (20261013T230929) had no meta.accountStore and no `*.accounts.json` beside it;
  its lists 25/25/25 (most-engaged 25/10, least-engaged 25/10, most-bounced 25/0, rankedAt = carriedFrom = the
  2026-10-13 21:12 full pull). Note: it was made by plugin 0.52.0, not 0.54.0 — a snapshot from before the store either
  way, which is the contract.
- L1 PASSED: before it, `report` returned refreshFullOnce ("the latest snapshot (…) was made before the account store: the
  customer lists need one full pull to start ranking on every refresh, and the next refresh is that pull") and
  refreshMinutes 72 = fullRefreshMinutes 72. The plain refresh, no `--full` (the run state full:false), invoked through
  the skill: exit 3 at 284 calls (the token), Bradley's login, the remedy line as printed, exit 0. pull.mode full, pull.why
  "the customer lists need one full pull to start ranking on every refresh (the previous snapshot was made before they
  could)", relayed in the skill's Pull line; nothing by hand. accountStore `snapshots/20261015T162212.accounts.json`, the
  only store, beside the new snapshot; plain JSON, a header line then one cell per line; its pulledAt the snapshot's.
  STORE: 5,192,723 bytes, 185,996 cells, 15,438 accounts (24 no-link cells), 191 programs, 13 months; meta.accountStore
  {schema 1, cells 185996, accounts 15438}, the same (larger than the 4.56 MB measured: nine measures and the internal
  class, one cell per line). MINUTES: 105 of pulling (55.5 before the stop, 49.7 after; 743 calls, 76 split, 1 retried)
  against 72 priced. Lists: most-engaged 25/10, least-engaged 25/10, most-bounced 25/0, per and segment null, rankedAt
  their own pull, carriedFrom null; each the same 25 accounts in the same order as the 2026-10-13 full ranking.
- L2 PASSED: the same plain refresh (a login first, then exit 3 at 423 calls, a login, the remedy line, exit 0): pull.mode
  selective, pull.why "months before 2026-09 are carried from the snapshot pulled 2026-10-15T16:22:12-07:00", pulled
  2026-09 and 2026-10. MINUTES: 80.5 of pulling (58.8 + 21.7; 598 calls, 62 split, 2 retried) against 43 planned. All
  three lists equal L1's in kind, n, floor, per, segment and kept IN ORDER (25/25 each); rankedAt 2026-10-15T18:23:42 (its
  own pull), carriedFrom null; one store in the folder (20261015T182342.accounts.json, 5,192,723 bytes, cells and accounts
  as L1's); L1's store gone (the summary's `pruned` read [] — it names snapshots only).
- L3 PASSED on its bar: export named accountStore and hinted "its first refresh is then selective" (its import line
  carries `--snapshot`, which this list's line lacks: followed the hint); import copied accountStore beside the imported
  snapshot; the dry run's consequence "the customer lists are ranked again from the account store beside the last pull (a
  rebuild, no pull)"; the change exit 0 in 3 s, no progress line (no call), done.ranked true, done.text "The change is
  saved and the customer lists were ranked again from the account store beside the last pull (2026-10-15T18:23:42-07:00),
  with no pull; the pages were rebuilt."; the Most bounced panel exactly the record's 5 in its order with the note "The 5
  most bounced across programs over the whole window, as the pull of 2026-10-15 ranked them."; the dropped lists' panels
  "This dashboard keeps no most engaged list: …" / "… no least engaged list: …"; `report f548-scratch` the same 5 in the
  same order; the About tab's Accounts entry "the 5 most bounced". Bradley on the panel, done.text and dropped-list notes:
  "the wording seems fine". Edit screen: the closing ask "…changes 1 setting (accounts.lists[]): the customer lists are
  ranked again from the account store beside the last pull (a rebuild, no pull)…", first option "Save and rank the
  customer lists again now (no pull)". Draft not saved; f548-scratch and the export files removed. PROBED PAST THE BAR (F-530
  reopened, its Reopened line): the About tab's Pages entry "the top 25 by Bounced" beside the panel of 5; the report's
  intro naming all three lists' meanings over one list; the edit question stating the 25s and re-adding the two dropped
  lists on keep|keep|6 0.
- L4 PASSED (Bradley's eye, three screenshots): each of the three panels lists all 25 of the record's kept accounts in its
  order (all 25 checked from the page file, not five), the note naming size and floor; with August–September 2026 in the
  filter bar each note adds "re-ranked here over what is shown", and every account visible is in its own list only.
Section status: OPEN on F-530 (reopened, three instances of consumer-parity); F-548 VERIFIED.
Section status (release prep, 2026-10-16, builder): CLEARED — F-530 VERIFIED at the re-verification round (the section below, N0–N5; tester @ hb-20261015-06), so every arm here is judged. Spent for 0.56.1.

## F-530 reopened — the customer lists in words, on every surface (banked 2026-10-15, builder, Session B's F-530 round @ hb-20261015-06; verdict at the F-530 re-verification round)

Owed by: the F-530 re-verification round, in the consumer workspace with the plugin loaded from feat/f548-ranking-every-refresh
(a terminal in the workspace with --plugin-dir, canary hb-20261015-06 matched). NO PULL (Bradley's scoping, 2026-10-15): every arm runs on a
SCRATCH import of the kept dashboard (it now carries its account store from B-V's pulls) or on the repo's suites. No refresh arm: this
round's fix touches no ranking or store code (selectionOver, rankFromStore, carriedAccountCells, decideRefresh and the store's writer
are unchanged; the handoff note says so). Token: hb-20261015-06.

THIS LIST IS COMPLETE.

- N0 (setup and provenance). Canary matched; `export digital-outreach-health-v2 --out <tmp>/f530.json --with-snapshot --kb payscale-prod`
  (its `accountStore` named), `import --file <tmp>/f530.json --slug f530-scratch --kb payscale-prod` (its `accountStore` copied).
- N1 (the change). `change f530-scratch accounts.lists=[{"kind":"most-bounced","n":5,"floor":0}] --kb payscale-prod`. Pass bar: exit 0,
  `done.ranked` true, no call made.
- N2 (the page and its About tab). Open f530-scratch's latest-admin.html. Pass bar: the Most bounced customers panel lists exactly the
  record's 5 in its order with the note "The 5 most bounced across programs over the whole window, as the pull of <date> ranked them.";
  the About tab's Pages entries for the three list panels read "… the 5 most bounced, as the pull ranked it." for Most bounced and
  "… no most engaged list is kept …" / "… no least engaged list is kept …" for the other two (never "the top 25" or "the 25 lowest");
  its Accounts entry names "the 5 most bounced" and no other list.
- N3 (the report). `report f530-scratch --kb payscale-prod`. Pass bar: the Account watch list opens "Across programs over the whole
  window, the accounts this pull kept: the 5 most bounced. Possible bad contacts: never a verdict on a customer." — no "advocates", no
  "disengagement", no low-cadence sentence — and its one table lists the same 5 in the same order.
- N4 (the edit screen). `new f530-scratch`, `next f530-scratch --question customer-list-detail`. Pass bar: the ask says "This dashboard
  makes 1 list across programs: the 5 most bounced." with no 25 anywhere; the first option reads "Keep the lists as they are (the
  default)"; the size option has ONE follow-up, for the 5 most bounced. Answer keep (through the size option), then `default`: the
  draft's lists stay [most-bounced 5/0] each time; answer "6 0": the draft holds [most-bounced 6/0] alone, and `next` (the closing ask)
  says it changes 1 setting (accounts.lists[]). Read the question's wording to Bradley: is it what an admin should read? Discard the
  draft (do not save).
- N5 (the suites). On the branch: `node plugins/gs-superadmin/test/dashboard.mjs` (147, the class check among them),
  dashboard-spec.mjs (47), dashboard-page.mjs (214), engagement-report.mjs (56) pass. CI green on PR #57 at its head.
- Cleanup: remove f530-scratch and the export files.

Results:
(F-530 re-verification round, 2026-10-15 @ hb-20261015-06, tester; feat/f548-ranking-every-refresh at 14e46a6, clean and level; a
terminal in the workspace with --plugin-dir, canary matched; the production KB, NO PULL. The only tenant read was the closing step's
whoami, after one by-hand login. Pages were read as a headless Chrome DOM dump of the rendered page, scripts stripped.)
- N0 PASS. `export digital-outreach-health-v2 --with-snapshot` named its `accountStore`; `import --slug f530-scratch` copied it
  (the snapshot and its `.accounts.json` side by side).
- N1 PASS. `change f530-scratch accounts.lists=[{"kind":"most-bounced","n":5,"floor":0}]`: exit 0, `done.ranked` true,
  `done.lists` [most-bounced, kept 5], done.text "…ranked again from the account store beside the last pull (…), with no pull; the
  pages were rebuilt." No call was made: the token was expired at the time, and the verb exited 0.
- N2 PASS. The Most bounced customers panel lists exactly the record's 5 kept accounts, in the record's order, with the note "The 5
  most bounced across programs over the whole window, as the pull of 2026-10-15 ranked them." The other two panels read "This
  dashboard keeps no most engaged list: …" / "… no least engaged list: …". The About tab's Pages entries: "…: the 5 most bounced, as the
  pull ranked it.", "…: no most engaged list is kept (the customer lists name the lists the pull ranks).", "…: no least engaged list is
  kept (…)". Accounts entry: "Customer lists are on: across programs over the whole window, the 5 most bounced; …", and no other list.
  No "top 25", "25 lowest" or "the 25" in the rendered text. The leaders' copy's one "the 25 least engaged" is listPhrase's doc
  comment inside its script, not rendered.
- N3 PASS. The report's Account watch list reads, verbatim: "Across programs over the whole window, the accounts this pull kept: the 5
  most bounced. Possible bad contacts: never a verdict on a customer." No advocates, no disengagement, no low-cadence sentence. Its
  one table ("Most bounced customers") lists the same 5 in the same order.
- N4 PASS, with one sentence ruled out. The ask: "How should the customer lists be built? This dashboard makes 1 list across
  programs: the 5 most bounced. On a program that sends about once per contact, a least-engaged list uses at least 3 delivered and no
  open instead of its floor. You can change …" No 25 anywhere. Options: "Keep the lists as they are (the default)" · "Change a list's
  size or floor" (ONE follow-up: "The 5 most bounced accounts, with no delivered floor: …") · "Add per-segment lists". The draft's
  lists: keep through the size option → [most-bounced 5/0]; `default` → [most-bounced 5/0]; "6 0" → [most-bounced 6/0] alone.
  The closing ask: "Compared with the saved dashboard it changes 1 setting (accounts.lists[]): the customer lists are ranked again
  from the account store beside the last pull (a rebuild, no pull)." (The first try stopped exit 3 on the expired token; it ran
  after a login.) Wording read to Bradley: the low-cadence sentence describes a least-engaged list on a dashboard that keeps none,
  which is the rule the Fix gave the report (instance 2) but not the question. Bradley's ruling: one line of prose, drop it, no
  reopen; the tester makes it (role inversion). Made at dashboard.mjs's customer-list-detail ask: the sentence prints only when a
  least-engaged list is among the lists. Re-read: on the scratch draft the sentence is gone; on a sibling draft with
  [most-bounced 5/0, least-engaged 10/5] it is present. The draft was not saved (it was removed with the scratch).
- N5 PASS. On 14e46a6: dashboard 147, dashboard-spec 47, dashboard-page 214, engagement-report 56, all pass. PR #57's five checks
  (drift (full), changes, validate (ubuntu-latest), manifests, GitGuardian) are green at 14e46a6. After the role-inverted edit:
  dashboard 147, dashboard-spec 47, dashboard-page 214, engagement-report 56, all pass.
- Not read (the builder's named gap): mutant N4 (the report's intro naming a per-segment list once per segment) survived by
  prediction, and no arm here puts a per-segment list in the report. A per-segment list over a field the last pull did not read
  needs a pull.
- Cleanup: f530-scratch and the export files were removed.
Section status (release prep, 2026-10-16, builder): CLEARED — N0–N5 PASSED as recorded above, the role-inverted line confirmed by the builder (PR #57 merged at df5dfec); F-530 VERIFIED on the bus; N4's mutant stays the builder's named gap. Spent for 0.56.1.

## F-549 / CP-6 — six live checks on CLI 1.0.11 or later: what the 1.0.11 fixes the doctrine now names actually do on a tenant (banked 2026-10-15, builder, session E1+V1 on doctrine-cli-1-0-11-plus; verdict at the branch's handoff token — CLEARED 2026-10-15 @ hb-20261015-07: all six FIXED at 1.0.12; KI-030 persists)

CLEARED 2026-10-15 (tester, F-550 verdict round on claude/adopt-cli-1-0-12-483229) @ hb-20261015-07. `gs-admin
--version`: 1.0.12 (win32-x64, Node 24.16.0). Tenant: the sandbox, on a fresh `gs-admin login --base-url <sandbox>`
made for this round (the host's saved config pointed at production; reads only, every command checked `mutating:
false` in the catalog first, the four (f) calls refused client-side). Order: (a) first, because its bar is the fresh
login; then (c), (b), (e), (d), (f). Every verdict is per its own FIXED/BROKEN lines below; no BROKEN path fired, so
nothing reopens F-549. Owed from the FIXED paths (polish, riding the next round per each check's text): (a) drop "live
confirmation pending" at its three sites; (b) CP-3's follow-up scoping of the crash codes; (c) the two scope notes take
the measured count and `CLI_PIN_FACTS`' `journey:email:templates` entry is rewritten from (c)'s result — NOT removed,
the list is not complete (residual 3); (d) the header's "live confirmation pending" and LEDGER fact 3's note; (f) the
real stderr copied into the engagement fixture (its wording differs; the regex still matches).
Every check below is read-only and runs on a workspace whose installed CLI is **1.0.11 or later** (1.0.12 ships the
same `dist/`; its one change is a dependency pin). Each verdict line RECORDS the version `gs-admin --version` prints —
the entries are per-version measurements, not per-release ones. On a 1.0.10 CLI none of these is owed: every (a)–(f)
is a 1.0.10-and-earlier defect the plugin already documents. Plan: gs-fortress ledger/reports/build-kickoffs-1.0.12.md
CP-6 (a)–(f), banked from audit-1.0.12 §0, §1.12, §1.15, §2 and §6. The doctrine the branch ships (CP-2, CP-3, CP-4)
is version-conditional and says "live confirmation pending" where a check below decides it; a FIXED verdict lifts that
clause, a BROKEN one reopens F-549 with the wording to restore. Nothing here mutates the tenant.

Owed by: the tester round on this branch's token, or the first session with a 1.0.11-or-later CLI and a tenant token.
Tenant: the sandbox. Reads only. Windows host for (b) (the assertion is in the CLI's Windows event loop).

### (a) KI-028 — `sc measures --id` on a fresh login (decides CP-2's "live confirmation pending")

CLEARED 2026-10-15 @ hb-20261015-07 — FIXED (KI-028 resolved live at 1.0.12). Fresh login, `whoami` valid (3578 s),
`--version` 1.0.12; three scorecard ids from the sandbox KB's scorecard domain, two of them rollup-enabled. Each
`gs-admin --json sc measures --id '<id>'` (each its own process, the first measures call after login): exit 0,
`result: true`, no "No stored token found". Each `--name` call on the same scorecard: exit 0. Compared by
`levelType` + `measureMapId` + `measureId`, recursing `children`: identical sets, 38 (7 GROUP, 31 MEASURE), 9 (4, 5)
and 9 (2, 7) nodes, nothing on one side only.

Steps:
1. `gs-admin login` (fresh token; `gs-admin whoami` reads valid), then `gs-admin --version` — record it.
2. Take three scorecard ids from the sandbox KB (the scorecard domain's manifest entries), one of them a
   rollup-enabled scorecard.
3. For each: `gs-admin --json sc measures --id '<id>'` immediately after login, as the FIRST authenticated call of a
   fresh process. Then `gs-admin --json sc measures --name '<the same scorecard's name>'`.
4. Compare the two payloads per scorecard: the same set of `MEASURE` and `GROUP` nodes by id (recurse `children`;
   order may differ).

FIXED (KI-028 resolved live at <version>): 3 of 3 `--id` calls exit 0 with no "No stored token found", and each returns
the measures tree `--name` returns. The operating model's entry, its General rule and setup's scorecard exception drop
"live confirmation pending" (polish; rides the next round); the gs-fortress ledger's KI-028 closes on the measurement.
BROKEN (KI-028 persists at <version>): any `--id` call fails with "No stored token found" while `whoami` reads valid.
REOPEN F-549: the 1.0.11-and-later clauses in those three sites are wrong and revert to the 1.0.10 wording for every
version; the gs-fortress ledger's KI-028 flips back to open, with the version.

### (b) KI-017 — an error exit with no libuv assertion, under Git Bash and PowerShell (decides CP-3's crash-code scoping)

CLEARED 2026-10-15 @ hb-20261015-07 — FIXED (KI-017 resolved live at 1.0.12). Git Bash, `--json`: stderr "Error: Rule
does not exist" plus a Request ID line, exit 1. Git Bash without `--json`: "Error: HTTP 500" plus a Request ID, exit
1. Windows PowerShell 5.1 (`powershell.exe -NoProfile`), `--json`: "Error: HTTP 500" plus a Request ID,
`$LASTEXITCODE` 1. No `Assertion failed` and no `src\win\async.c` in any stderr. Control `re r list --limit 1`: exit
0. The server's own message varied between the three calls (one "Rule does not exist", two "HTTP 500") — a server
answer, not the exit path; the exit code was 1 every time.

Steps:
1. Under Git Bash: `gs-admin --json re r describe --id 'no-such-rule-id'; echo "exit=$?"`. Keep the full stderr.
2. Under Windows PowerShell 5.1 (`powershell.exe -NoProfile`): the same command, then `$LASTEXITCODE`.
3. Repeat step 1 without `--json` once.
4. Control: the success path — `gs-admin --json re r list --limit 1` exits 0.

FIXED (KI-017 resolved live at <version>): each run prints the API error on stderr (an `Error:` line, with a Request ID),
exits **1** in both shells, and stderr carries no `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` and no
`src\win\async.c` line. CP-3's follow-up then lands: the operating model's entry scopes the crash codes (127 under Git
Bash, 255 under PowerShell, raw 0xC0000409) to 1.0.10 and earlier and keeps "parse stderr" as advice, not as the only
safe reading; the gs-fortress ledger's KI-017 closes on the measurement. The KI-018 entry's "both also abort on the
libuv assertion" sentence takes the same scope.
BROKEN (KI-017 persists at <version>): the error, then the assertion; exit 127 / 255. REOPEN F-549: the "expect a clean
exit 1" clause is wrong — upstream's `process.exit()` removal is not the whole cause — and the entry says so for every
version; the gs-fortress ledger's KI-017 stays open with the version and the shell.

### (c) KI-003 / KI-030 — the email-template list descends nested folders (feeds CP-3's numbers and the gated CP-7's `CLI_PIN_FACTS` entry)

CLEARED 2026-10-15 @ hb-20261015-07 — FIXED (KI-003 resolved live at 1.0.12); KI-030 persists. Step 1: 1239 rows,
`pageInfo` returned 1239 / totalAfterFilters 1239, 0 rows without `templateId` (the 1.0.10 field-less rows are gone;
rows key the id as `templateId`, not `id`), 1239 distinct ids, 62 distinct `folderName` values. Step 2: (i) the
sandbox KB holds 1180 templates; 1177 are in the list and 3 are not; (ii) 1239 against 1.0.10's 648 on this tenant.
The six largest folders that were wholly missing at 1.0.10 (84, 80, 68, 41, 35 and 30 templates — the nesting
signature) are now listed in full. Residual gap: 3. Each one opens with `jo email template --id` (`result: true`).
Each sits in a folder whose other templates ARE listed (two in the default folder, one in a 10-template folder with 9
listed). So the gap is per template, not per folder: it fits the "hides some templates" clause, not a second nesting
defect. No field in the describe payload separates the 3 from listed siblings (`source` and state absent from both).
Seen beside the bar: the list holds 62 templates the KB has never had (modified 2022-05 to 2025-10, none after the KB's
last verify) — the KB was built while 1.0.10 hid them; a refresh picks them up. Step 3: a subfolder that was wholly
missing at 1.0.10 (35 templates): `--folder '<its own name>'` returns all 35, its known template included. A parent
whose 1.0.10 payload carried a field-less child-folder row: `--folder '<the parent's name>'` returns 10 rows, every one
`folderName` equal to the parent's name, none from a nested folder. KI-030: name only — the parent's name reaches only
its direct templates, and no row carries a folder path (as the 1.0.11 handler reads: `folderName: folder.name` of the
immediate folder, `--folder` a case-insensitive contains match). It stays open at 1.0.12.

Steps:
1. `gs-admin --json jo email templates --limit 10000 > templates.json` on the sandbox. Record the row count, the count
   of rows with no `id` (the 1.0.10 field-less folder rows), and the distinct `folderName` values.
2. Compare the row count with (i) the sandbox KB's template count (the `journey-email-templates` domain's manifest
   entries, plus the gap list the engagement refresh keeps, if one exists) and (ii) 1.0.10's count on the same
   tenant — 648 at the last live measurement. Record the residual gap: templates the KB or the UI knows that the list
   still lacks, and whether every one of them sits at the top level (the `source=COMMS` / state suspicion) or in a
   folder (a second nesting defect).
3. Pick a template inside a SUBFOLDER (a `folderName` that is not a top-level folder). `gs-admin --json jo email
   templates --folder '<the subfolder's own name>' --limit 10000` must return it; `--folder '<its parent folder's
   name>' --limit 10000` is the KI-030 read — record whether the parent's name returns the nested template (a path
   or a descent) or only the parent's own direct templates (name only, as the 1.0.11 handler reads).

FIXED (KI-003 resolved live at <version>): zero field-less rows; the count is at least 1.0.10's and every template the
KB holds from a subfolder is in the list; the residual gap is recorded with its size and where it sits. The two
scope notes (templates/operating-model.md's scope-filter entry; setup's index-scope-notes.md `### journey email
templates`) take the measured count in place of "not yet measured live" (polish; rides the next round), and E2's
`CLI_PIN_FACTS` `journey:email:templates` scope entry is rewritten from this result (or the pair is removed if the
list proves complete — check 23 holds them together). KI-030's verdict is recorded beside it, whichever way it reads.
BROKEN (KI-003 persists at <version>): field-less folder rows still present, or a subfolder's templates still absent
from the full list. REOPEN F-549: the "descends into subfolders" clauses are wrong and revert to the 1.0.10 wording
for every version; the gs-fortress ledger's KI-003 stays open with the version.

### (d) KI-022 — a LOOKUP group-by returns real names (decides CP-4's "live confirmation pending" on the LOOKUP rule)

CLEARED 2026-10-15 @ hb-20261015-07 — FIXED (KI-022 resolved live at 1.0.12). Window: the sandbox's send log ends in
2026-06, so the week of Monday 2026-05-04 was used. That week's step 1 filled the 2000-row page (4557 sends), so the
comparison ran on ONE day, 2026-05-04 to 2026-05-05 (250 sends), where every group fits. Filters as written (Source
"Advanced Outreach", AddressType "To"). Step 1, group-by `[{"name":"GsCompanyId"}]`: exit 0, 233 groups, column
`company_GsCompanyId__gr_Name`, every label a real company name, 0 empty labels, counts summing to 250. Step 2, the
adapter's own shape (`fieldPath: {leaf: "Gsid", hops: [{through: "GsCompanyId", to: "company"}]}` — the step's
`"fieldPath":"GsCompanyId.Gsid"` is a sketch, not the CLI's shape): 233 groups, sum 250. Keyed by the company Gsid
both carry: 233 of 233 per-group counts equal, none on one side only. (The full week through both shapes also
returned named groups; it was not compared because the page truncated it.)

Steps:
1. One week of sends, grouped by the company lookup's NAME (the shape the adapter refuses on every version — issue it
   by hand, once): `gs-admin --json rp run --object email_log_v2 --show-fields '[{"name":"Gsid","aggregation":"COUNT"}]'
   --group-by '[{"name":"GsCompanyId"}]' --where-filters '{"conditions":[<ExecutedDate GTE <monday>>, <ExecutedDate LT
   <next monday>>, <Source EQ "Advanced Outreach">, <AddressType EQ "To">]}' --page-size 2000`.
2. The adapter's own shape for the same week: the same call with `--group-by '[{"name":"GsCompanyId","fieldPath":
   "GsCompanyId.Gsid"}]'` (and, for the names, a show of `GsCompanyId.Name` through the same path).
3. Compare: the number of groups, the group labels, and the per-group counts.

FIXED (KI-022 resolved live at <version>): step 1 returns one group per company with the company's real name as the
label (no single empty-name group collapsing them), and its per-group counts equal step 2's. The adapter's LOOKUP rule
stays (it is a guard, not a workaround — the comment says so), and the header's "live confirmation pending" and the
test LEDGER's fact 3 note take the verdict (polish); the gs-fortress ledger's KI-022 closes on the measurement.
BROKEN (KI-022 persists at <version>): step 1 collapses to one group with an empty label, or its counts differ from
step 2's. REOPEN F-549: the "1.0.11 and later join the lookup object's key" clause is wrong; it reverts to the 1.0.10
wording for every version; KI-022 stays open with the version.

### (e) KI-013 / KI-014 — `dm o list --search` works and `--sort-field` sorts server-side

CLEARED 2026-10-15 @ hb-20261015-07 — FIXED (KI-013 and KI-014 resolved live at 1.0.12). Step 1: exit 0, 35 rows
(`totalNumberOfObjects` 35) of the tenant's 593. 33 contain the term in label or name; the other 2 contain it only in
`description`. The server's search covers description too, so the bar's "label or name" is narrower than what the
server matches — recorded, not a BROKEN reading (BROKEN is every object coming back). Step 2: ASC p1 starts with a
digit-led label, ASC p2 continues it (no overlap); DESC p1 starts with a lowercase-led label, DESC p2 continues it. ASC
p1 ≠ DESC p1, and each page is ordered by label in code-point order (uppercase before lowercase — server-side
collation, not a locale sort), so the sort spans pages.

Steps:
1. `gs-admin --json dm o list --search 'Company' --limit 50`: exit 0, every row's label or name contains the term.
2. `gs-admin --json dm o list --sort-field label --sort-dir ASC --limit 20 --page 1` and the same with `DESC`; then
   `--page 2` of each. Record the first and last labels of each page.

FIXED (KI-013 and KI-014 resolved live at <version>): step 1 exits 0 with matching rows only (on 1.0.10 the search was
not sent, so every object came back); the ASC and DESC first pages differ, each is ordered by label, and page 2
continues the order (the sort spans pages — server-side, not a per-page local sort). The gs-fortress ledger's KI-013
and KI-014 close on the measurement; no plugin text names either defect, so nothing is owed on the branch.
BROKEN: step 1 returns every object, or the two orders are equal, or page 2 restarts the order. Record which, with the
version; the two KI entries stay open. No plugin change is owed either way.

### (f) The 1.0.11 refusals — one call each for KI-021, KI-023, KI-024 and KI-029: exit 1 with the named error, no request, no assertion

CLEARED 2026-10-15 @ hb-20261015-07 — FIXED (the four refusals present at 1.0.12): each exits 1, the refusal on
stderr, NO Request ID, no assertion. Two deviations from the steps as written, both forced by the tenant or the
shape:
  1 (KI-021): `email_log_v2` carries no opaque-typed field on the sandbox (`LinkClickedJson` is STRING, so a COUNT_DISTINCT
  of it went to the server and came back as a server error with a Request ID — not this check). Run instead on
  `company.Summary` (RICHTEXTAREA):
    Error: COUNT_DISTINCT is not supported on "Summary" (RICHTEXTAREA): reports can't aggregate JSON or rich-text fields. […]
  2 (KI-023): the step's formula sketch leaves out `kind` on `lhs`/`rhs`; the CLI refuses that client-side ("Unknown
  formula kind "undefined""). With `lhs {kind: aggregation, fn: COUNT, field: Gsid}` and `rhs {kind: field, name:
  LinkClickedCount}`:
    Error: Formula "ratio" puts an aggregation inside arithmetic. Reports only accept an aggregation as the whole formula […]
  3 (KI-024), as written:
    Error: Filter field "NoSuchField" not found on email_log_v2. List the object's fields with `rp schema email_log_v2`.
  4 (KI-029), as written:
    Error: COUNT of "EmailTemplateId" can't be combined with grouping by "EmailTemplateId": reports can't aggregate a field they group by. […]
CP-4's fixture against the real text: it DIFFERS. The real refusal carries no Request ID line, where both fixture
lines append one. Its suggestion form is `Did you mean "Name"?` plus the `rp schema` pointer (measured with a show
field "Nmae": "Error: Field "Nmae" not found on email_log_v2. Did you mean "Name"? List the object's fields with `rp
schema email_log_v2`."), where the fixture has `Did you mean: Name?`. And the fixture's filter case, a case-only miss
(`GsCompanyID`), is ACCEPTED at 1.0.12 (exit 0: the filter field resolves case-insensitively). `FIELD_REFUSAL_RE`
matches the real stderr, measured directly against the captured text, so nothing reopens. The fixture copy and the
`test/engagement.mjs` re-run are owed (builder, polish): the fixture's filter-field example needs a name that is
really unknown, not a case variant.

Steps (each on `email_log_v2`, `--page-size 10`, the week window of (d); record stderr and the exit code of each):
1. KI-021 — a distinct count of a JSON-typed field: `--show-fields '[{"name":"LinkClickedJson","aggregation":
   "COUNT_DISTINCT"}]'`.
2. KI-023 — an aggregation nested in a formula: a `--show-fields` entry of the documented formula shape (reference
   `rp create` example: `{"name":"ratio","formula":{"kind":"arithmetic","operator":"/","lhs":…,"rhs":…}}`) whose `lhs`
   is an aggregated field (`COUNT` of `Gsid`) and whose `rhs` a plain field — the shape the engagement adapter's test
   LEDGER fact 7 records as a generic error on 1.0.10.
3. KI-024 — an unknown filter field: `--where-filters '{"conditions":[{"leftOperand":{"fieldName":"NoSuchField"},
   "operator":"EQ","rightOperand":{"value":"x"}}]}'` with a plain `--show-fields '[{"name":"Gsid","aggregation":"COUNT"}]'`.
4. KI-029 — an aggregate of a grouped field: `--show-fields '[{"name":"EmailTemplateId","aggregation":"COUNT"}]'
   --group-by '[{"name":"EmailTemplateId"}]'`.

FIXED (the four refusals present at <version>): each exits 1 with the refusal on stderr naming the field or the shape
(`Field "NoSuchField" not found on email_log_v2` / `Filter field … not found on …` with a "did you mean" list for 3;
the opaque-type refusal for 1; the nested-aggregation refusal for 2; the grouped-aggregate refusal for 4), and the
stderr carries NO Gainsight Request ID — the CLI refused before any request — and no libuv assertion. CP-4's
classification of 3 as `shape-error` is then measured against the real text: if the real wording differs from the
fixture's two lines in `test/fixtures/engagement/acme-tenant.mjs` (`FAULT_TEXT["field-refused"]`,
`["filter-field-refused"]`), copy the real stderr into the fixture (masked of ids) and re-run `test/engagement.mjs`
(the regex `FIELD_REFUSAL_RE` must still match; a miss REOPENS F-549). The gs-fortress ledger's four KI entries close
on the measurement.
BROKEN (a refusal absent at <version>): a call exits 0 (the 1.0.10 silent drop, for 3; a server answer for 1, 2 or 4),
or fails with a Request ID (the server refused, not the CLI). Record which; that KI stays open with the version, and
the matching version-conditional clause in the engagement adapter's header reverts to the 1.0.10 wording for every
version (REOPEN F-549 for that clause only).

## R13 polish round — live arms for F-536 and F-546, and the walk (banked 2026-10-15, builder, claude/polish-pre-release-r13-6bdd49; verdict at hb-20261015-10)

Owed by: the tester round on hb-20261015-10 (a terminal in the workspace with --plugin-dir, canary matched; the
production KB, reads only; NO PULL beyond what R2 makes). R3 has no live arm: the stand-in suite is its judge, and the
verdict says so.

### R1 (F-536) — the page's no-internal-domain line in the three real shells

On a dashboard whose page shows the no-internal-domain notice — the notice reads the snapshot's
`recipient-class-not-configured` caveat, which a PULL writes only with no internal domain AND no test account, so a
scratch dashboard pulled with both emptied (the builder's first wording, "domains emptied then rebuild", draws nothing:
corrected from the tester's R1 at hb-20261015-10) — open the admin page's About tab
and copy the line as printed (`… change <scratch> "sources.0.params.internalDomains=<domains>" --kb <kb>`). Put two
domains in place of `<domains>` (keep the quotes), append ` --dry-run`, and paste it from the workspace folder in
Git Bash, Windows PowerShell 5.1 and cmd in turn. Record each shell's exit code and the `changed` row.
FIXED: each shell exits 0 with `changed` naming `sources[].params.internalDomains[]` and two example paths — the pair
arrived whole. BROKEN: any shell refuses, or one item arrives → REOPEN F-536 naming the shell and what node received
(`node -e "console.log(process.argv)"` with the same words shows the arrival).

### R2 (F-546) — two dashboards of one KB refreshed at once: SMALL, or none (re-scoped 2026-10-16, Bradley)

NEVER a refresh of the kept dashboard (an hour of production pull each; a polish lock does not buy that). The judge of
record is test/manifest-ops.mjs "F-546" (a held lock refused naming the holder, a released lock landed, a stale lock
taken over); this arm is optional and cheap or it is skipped: two SCRATCH dashboards (`new <a>` / `new <b>` with a
`names:` selector of one program each, Health off, customer lists off, re-documentation on), each a refresh of a few
calls. In two terminals start `refresh <a>` and `refresh <b>` within a second of each other. Record both summaries.
FIXED: both finish (exit 0, or 3 on the token — the lock is not the stop) and neither prints "manifest is locked by
another writer". BROKEN: that line → log it under F-546 with how long the holder ran; a lost mark (a program one run
documented reads pending or stale after the other finished) is the F-546 defect again → REOPEN. SKIPPED: say so on the
verdict ("R2 not run; the suite's judge stands") — a FIXED → VERIFIED on the suite alone is the expected reading here.
Remove the two scratch dashboards after.

### R3 (F-541, F-542, F-545) — no live arm

No tenant can produce the F-541 spec (a validator tightening between versions), F-542 needs a schedule change between
a stop and its resume, and F-545 a second refresh during a live one on a tenant pull: each is judged by the stand-in
suite's scenario (test/dashboard.mjs "F-541", "F-542", "F-545") and the verdict states it.

### Walk — email-engagement, the change grammar

The skill is model-invocable (no disable-model-invocation): the tester invokes it with a one-setting change ("rename
the leaders' page of <scratch> to …") and records the `change` line the model composed (bare value, or the pair in
double quotes), the shell it ran in, and whether it ran as written with `--dry-run` first and the consequence relayed.

Section status (release prep, 2026-10-16, builder): CLEARED — R1 measured in the three shells on the page's own line (F-536), R2 run small (two one-program scratch pulls; the lock's bar held vacuously, the manifest suite the judge of record, F-546), R3 by the stand-in suite as banked (F-541, F-542, F-545), the walk done (the tester @ hb-20261015-10; the bus's Walk and Blind spots lines keyed to that token carry the record); F-536, F-541, F-542, F-545, F-546, F-551 VERIFIED. Spent for 0.56.1.

## R14 fix round — the release gate's reopens, live arms and the walk (banked 2026-10-16, builder, fix/r14-release-gate; verdict at hb-20261016-02)

Owed by: the tester round on hb-20261016-02 (a terminal in the workspace with --plugin-dir on the worktree, canary matched;
the production KB, reads only; a SCRATCH dashboard of one program for every arm — never the kept dashboard). The
suites are the judge of record for every arm; these are the live halves the suites cannot see.

### R1 (F-545, F-546; Windows) — a held handle at release, and a killed writer

In PowerShell, while a scratch dashboard's refresh runs, open its `refresh.lock` with a handle that forbids delete
(`[IO.File]::Open($path, "Open", "Read", "ReadWrite")`) and keep it until the refresh ends. FIXED: either the refresh
still removed the lock (the retry outlasted the handle) or, once the handle is closed, the NEXT refresh of that
dashboard runs at once (the holder's process is gone, so the lock is taken over, said as `lockTakenOver`), never
"already running" for two hours. Then: start a refresh of the scratch dashboard with re-documentation on and interrupt
it (Esc) while the manifest is being marked (the "redocument" lines on stderr); then run `node
.gs-superadmin/plugin/scripts/manifest.mjs report --manifest <kb>/_manifest.json`. FIXED: exit 0 at once, no
"locked by another writer" wait. BROKEN: a wait of 30 s or the locked refusal → REOPEN F-546 with the holder it named.

### R2 (F-552) — a rebuild during a live refresh

While the scratch dashboard refreshes, run `rebuild <scratch>` in a second terminal. FIXED: exit 1, "already running:
started by … — run rebuild again when it finishes"; after the refresh, the same line exits 0. BROKEN: the rebuild runs
→ REOPEN F-552.

### R3 (F-530, the window) — a list change with no store

Remove the `.accounts.json` beside the scratch dashboard's latest snapshot, then `change <scratch>
accounts.lists=@<file>` with one most-bounced list of 3 (the JSON in a file). FIXED: the admin page's About tab
names the lists the last pull ranked and says "A change of the customer lists is waiting for the next refresh: the 3
most bounced. Until then …", the panels show the old lists; after `refresh <scratch>` (a full pull this once, said)
the waiting line is gone and the About tab names the 3 most bounced alone. BROKEN: the About tab names the 3 most
bounced beside panels showing 25 → REOPEN F-530 (its third reopen is a defer under the valve).

### R4 (F-536) — the @<file> line in PowerShell 5.1

Write `{"target":"file-copy","config":{"to":"leaders","file":"<scratch>-leaders.html","datedCopies":false,"datasets":true}}`
to a file and run `change <scratch> publish=@<that file> --kb <kb> --dry-run` from Windows PowerShell 5.1. FIXED:
exit 0, `changed` naming publish[]. BROKEN: a refusal naming publish.target → REOPEN F-536 with what node received.

### No live arm (F-541, F-542)

No tenant produces a spec a tightened rule refuses, and the base-directory restart needs a knowledge base whose longest
schedule period falls to the floor between a stop and its resume: the stand-in suite is the judge (test/dashboard.mjs
"F-541 (reopened)", "F-542 (reopened)"), and the verdict says so.

### Walk — email-engagement (model-invocable) and setup (slash-only)

The tester invokes email-engagement to move the scratch dashboard's leaders' copy to the shared folder ("publish the
scratch dashboard to the leaders folder"): record whether the model wrote the publish JSON to a file under
`.gs-superadmin/tmp/` and ran `change <scratch> publish=@<file>` (the L2 offer's spelling), and whether a refresh's
summary relay names `restarted` only when the summary carries it. setup's changed sentence (the pin-facts warning
relayed as written) is reached only on a workspace whose CLI is not 1.0.12 — cannot be walked here; banked as a blind
spot.

Section status (tester @ hb-20261016-02, 2026-10-16; recorded by the builder at the post-merge re-stamp): CLEARED — run on the SANDBOX KB as the kickoff ruled (this section's "production KB" followed the R13 precedent and was not a requirement): R1 the held handle and a dead-pid lock taken over at once (the kill-to-lock path itself laid by hand, the suite's), R2 the rebuild refused during a refresh, R3 the About tab's waiting line in the no-store window and gone after the full pull, R4 the @<file> publish line in PowerShell 5.1; F-541 and F-542 by the stand-in suite; the email-engagement walk done. F-530, F-536, F-541, F-542, F-545, F-546, F-552, F-553, F-554, F-555 VERIFIED. Spent for the release carrying 0.56.2.

## LB-1 — long-branch rehearsal: the landed docs followed end to end on a throwaway branch (banked 2026-10-17, builder, docs/long-lived-branch-prep @ hb-20261017-01; verdict at the rehearsal round, after the PR merges and before the first real long-lived branch opens)

Why: the round at hb-20261017-01 wrote the long-lived-branch rules into CONTRIBUTING
("Submitting changes"), CLAUDE.md ("Branching, releases, and the feedback bus") and
AGENTS.md (§ Review-gate rules, the F-161/F-223 bullet), and locked check 7's
`## Unreleased` convention with two test cases — but no long branch exists, so none of
it ran end to end (the round's Blind spots line). A rule found wrong by the first REAL
long branch interrupts weeks of work mid-program, which is what the branch exists to
avoid. So the rules are rehearsed once on a throwaway branch that lands nothing.
Decided 2026-10-17 (Bradley): "I want this locked in as best we can before we need to
use it."

Owed by: a tester session, after PR #<n> (docs/long-lived-branch-prep) merges to dev.
Tenant: none. Writes: a throwaway branch, worktree and draft PR, all removed at the end;
on dev only the rehearsal's pointer comment and its Walk line.
Precondition: F-556, F-557 and F-558 exist as `## F-` sections on dev. The 2026-10-16
header comment claimed the numbers without writing sections, and `dev-utils log` reads
sections only (measured: it minted F-556 under that comment), so step 2 would collide
until they are written from the R14 tester's report-only notes.
Role: the tester follows the three landed docs and the /dev-loop skill § Long-lived
branches AS WRITTEN. Every point where the text is not enough to act, or where a verb
refuses something the text said to do, is a finding (normal) against the doc that lacked
it, fixed on a short branch before the first real long branch opens. Record the F-number
minted, each verb's output, and each CI run id with its conclusion.

Steps:
1. `git worktree add <a path outside PROJECTS_ROOT/*> -b feat/rehearsal dev`; push;
   `gh pr create --draft --base dev`; the ONE pointer comment on dev (branch, draft PR
   number, worktree path) pushed to dev — AGENTS.md's long-branch pointer, as written.
2. In the worktree: `dev-utils log "rehearsal: a finding of the throwaway branch"
   --severity polish --why "rehearsal, never to land" --commit`. EXPECTED: F-559 (above
   dev's F-556..F-558 sections). Record the number.
3. Commit a CHANGELOG draft: an `## Unreleased` heading above the newest entry with one
   body line; push; `node build/check-doc-drift.mjs` in the worktree, then the draft PR's
   docs-drift run. EXPECTED: check 7 green both places (plugin.json still 0.56.2).
4. `dev-utils catch-up` in the worktree (dev holds step 1's pointer commit, so there is
   something to merge); push. EXPECTED: one merge commit; the branch's Under test, Blind
   spots lines and canary unchanged; `dev-utils status` shows `branch gate:` and
   `landing:` lines — record both.
5. `dev-utils handoff --blind-spots "rehearsal"` in the worktree (the branch's own
   token); then `dev-utils flip F-559 WONTFIX --note "rehearsal finding, never to land"
   --commit`. EXPECTED: the branch's bus carries its own Under test line and no OPEN or
   FIXED section.
6. `dev-utils catch-up --landing`. EXPECTED: REFUSED, naming hb-20261017-01 — dev's
   handed-off token with no verdict. This is the mid-program interruption the rehearsal
   exists to meet once. Close it the way the skill names: on dev (the main checkout),
   `dev-utils walk "LB-1 rehearsal steps 1-5: <what each verb did>" --commit`, push dev;
   then `catch-up --landing` again in the worktree. EXPECTED: passes.
7. The landing commit, by CONTRIBUTING's bump paragraph: plugin.json to the next version
   above the last release tag (0.56.2 at banking), the `## Unreleased` heading renamed
   to `## <that version> — <date>`, one commit; push. EXPECTED: check 7 green locally
   and on the draft PR's run. Do NOT `gh pr ready`, do NOT merge.
8. Tear down: close the draft PR with the comment "LB-1 rehearsal — never to merge";
   `git worktree remove <path>`; delete feat/rehearsal locally, then try the remote delete.
   EXPECTED (ruleset 25315908 `feat/**`, created 2026-10-17 on Bradley's yes: deletion +
   non_fast_forward, no bypass): `git push origin --delete feat/rehearsal` is REFUSED —
   record the refusal text; Bradley deletes the branch in the GitHub UI. Then on dev
   `dev-utils log --help` is enough — do not log; instead note here that a deleted
   branch's numbers are no longer counted (README § Long-lived branches), so F-559 is
   free again: the NEXT real finding takes it.

Pass bar: steps 1-7 done from the docs as written; the refusal at step 6 appeared and
was closed by the Walk line; check 7 green at steps 3 and 7; step 2 minted above dev's
sections. CLEARED here with the date and the branch's token, copied into the pointer
comment on dev. Findings, if any, are the round's output and gate the first real long
branch, not a release.
