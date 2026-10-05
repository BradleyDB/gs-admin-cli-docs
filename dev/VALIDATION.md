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
Rig: the binding deadline must be the TOKEN, not the harness — run the batch from a terminal
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
Rig: the binding deadline is the TOKEN, not the harness — this check spans most of one token lifetime (~60 min), so
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
- Z1 (build over a real snapshot). `node .gs-superadmin/plugin/scripts/dashboard-page.mjs --spec
  <slug>/dashboards/v2-groups/spec.json --snapshot <Y1 snapshot> --out-dir <slug>/dashboards/v2-groups/pages`.
  Pass bar: exit 0; `latest-admin.html` and `latest-exec.html` written; the summary prints a size report per page
  (total bytes and the data, engine, runtime and pre-render shares) and `ungrouped` reads the same line Y10's
  `resolve` printed. Record each page's megabytes and the data share, as orders of magnitude; whether the warning
  fired. Then the same command over `s1b-on.json` (accounts on, no failure count) into a second folder: exit 0, and
  the admin page's Health tab shows no zero for send failures: the cells are blank and the table says the snapshot
  predates the figure, with the refresh line to copy.
- Z2 (the numbers are the engine's, through the embedded data). A node one-liner over the admin page: take the text
  of `<script id="gs-data">`, `JSON.parse` it, `unpackSnapshot` it (from `dashboard-runtime.mjs`) and compare with
  the page's own copy of the snapshot computed by `pageSnapshot` (from `dashboard-page.mjs`) with
  `util.isDeepStrictEqual`. Pass bar: equal. Then, with the status filter set to every status, the program table
  on the admin page shows, for five programs Bradley picks, the same sent, delivered, opened and open rate as the
  open-rate report X-walk wrote over the same snapshot (both come from `runQuery`; a difference is a packing or
  filter defect).
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
- Z8 (real names render inert). Pick the program, template and account names with the most punctuation on the
  tenant (an ampersand, angle brackets, quotes, an apostrophe). Pass bar: each shows literally in the list, the
  table, the badges and the CSV; no name changes the page's layout or opens a tag.
- Z9 (readable without JavaScript). Open the admin page in the built-in browser pane as a local file (a static
  picture, no script) or with JavaScript disabled. Pass bar: the default view is readable: the data-pulled line,
  the summary line with the status default, the first tab's table; the controls show as disabled.
- Z10 (column choices are remembered). Hide two columns on the program table, reload: still hidden; open the
  leaders' page: its own columns, untouched; a private window: the panel's own columns.
