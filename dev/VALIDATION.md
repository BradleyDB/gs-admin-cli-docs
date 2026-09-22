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
