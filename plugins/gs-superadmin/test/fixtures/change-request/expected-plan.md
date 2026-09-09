# Change plan — Open a Risk CTA for Enterprise accounts when NPS drops below 6

> Fixture note: this is the expected output of `/gs-superadmin:change-request` run against
> [`ticket.md`](./ticket.md) with the synthetic KB in [`kb/acme-prod/`](./kb/acme-prod/) and
> the bundled build-standards pack adopted, drafted offline (no CLI). In a real workspace
> this file would be written to `acme-prod/changes/2026-07-02-enterprise-nps-risk-cta.md`.
> Wording may vary between runs; the facts, citations, command sequence, and structure below
> are what the offline check verifies.

- **Status:** draft (nothing executed)
- **Revision:** 1
- **Date:** 2026-07-02
- **Ticket:** CSOPS-142 · **Request event:** req-slack-20260702-npsr
- **Requested by:** Dana Whitfield (VP Customer Success, CS Leadership) on 2026-07-02 · **wanted by** 2026-07-20
- **Justification:** "We keep finding these in the churn retro instead of while we can still act." (requester-stated)
- **Workspace:** acme-prod (https://acme.gainsightcloud.com) — **PRODUCTION**
- **System area:** gs-rules
- **Verification basis:** KB-only (CLI unavailable)
- **Conventions consulted:** conventions/index.md, conventions/naming.md, conventions/rules-engine.md, conventions/query-building.md
- **Data-source mode:** set-source (single-object — conversion is LOSSY, justification required): every criteria field (`NPS_Score__gc`, `Segment__gc`, `Csm`) lives on the one object `company` — no join, so there is no dataset to prepare and no Data Designer template to attach. Flagged for the reviewer: the workspace standard (`query-building.md`) mandates Prepare Dataset, and switching this rule to a multi-object source later is a lossy one-shot conversion (`set-source-template` replaces the single-object source outright; anything mapped to it must be re-pointed).

## Request

Add a Rules Engine rule that opens a risk CTA whenever an Enterprise account's NPS drops
below 6, so at-risk accounts surface while there is still time to act.

> "Can we add a rule that opens a risk CTA whenever an Enterprise account's NPS drops below
> 6? We keep finding these in the churn retro instead of while we can still act."

## Impact analysis

| Asset | Domain | Relationship to this change | KB source (last_verified) |
|---|---|---|---|
| `DATA\|COMPANY\|IMPORT NPS from Survey Responses` (`rul-9f3e21`) | rules-engine | **Writes the field the new rule reads** (`company.NPS_Score__gc`), nightly at 02:00 UTC — the new rule must run after it or it evaluates yesterday's score | `rules-engine/rul-9f3e21.md` (2026-06-28) |
| `CTA\|DRIVE\|CSM Low Health Score Risk Alert` (`rul-4b7d10`) | rules-engine | **Existing Risk-type CTA rule on the same companies** (reason: Health Concern, uniqueness on TypeId/ReasonId/Name). The new rule must use a distinct reason + name so `check-open-cta` deduplication neither suppresses nor duplicates across the two rules | `rules-engine/rul-4b7d10.md` (2026-06-28) |
| `Customer Health Scorecard` (`sc-72aa08`) | scorecard | Downstream context: its NPS measure already turns red at ≤ 6 from the same field — the new CTA gives that red state an owner and action | `scorecard/sc-72aa08.md` (2026-06-28) |
| `NPS Trend by Segment` (`rep-5c19e4`) | report | Confirms the segment picklist `company.Segment__gc` (Enterprise/Mid-Market/SMB) used in the new rule's criteria | `report/rep-5c19e4.md` (2026-06-28) |

KB fresh for all cited assets (last refresh 2026-06-28, within TTL). Field names
`NPS_Score__gc` / `Segment__gc` are KB-confirmed but must be re-verified live at execution
time (step 1 below) since this plan was drafted without CLI access.

## Assets to create / modify

1. **CREATE** Rules Engine rule: `CTA|DRIVE|CSM Enterprise NPS Below 6 Risk Alert` — opens a
   Risk CTA on the CSM when an Enterprise company's NPS falls below 6.
   Naming: workspace convention applied (`CTA|Sub-Type|Assignee Description`, matching
   `rul-4b7d10`'s pattern). Per the rules-engine build standard, the rule is **created as**
   `CSOPS-142 CTA|DRIVE|CSM Enterprise NPS Below 6 Risk Alert` in the Staging folder while
   under build, and renamed/moved to `CTAs` at release.

## Risk notes

- **Environment:** this workspace is **production** — there is no sandbox pass; every
  authoring step below lands in the live tenant. Verification runs in test mode before the
  rule is scheduled.
- **Shared surface:** `company.NPS_Score__gc` is read by the health scorecard and a
  leadership dashboard report; the Risk CTA type is shared with `rul-4b7d10`. This plan only
  reads the field and adds CTAs — no shared asset is modified.
- **Blast radius on error:** a wrong criteria (e.g. `LESS_THAN 6` on the wrong field, or a
  missing segment condition) would open CTAs for the whole book. Caught by step 8's
  `--test-run` (criteria evaluated, no writes) before any schedule exists.
- **Guard coverage:** every authoring, execution, and scheduling `re r` command below —
  create, set-source, add-criteria, add-action, run-now (including `--test-run`),
  schedule, delete-schedule, delete-action — is catalog-marked **mutating** (CLI 1.0.8;
  workspace and bundled catalogs agree, no override entries) — expect one guard prompt
  per command. The discovery reads (`sources fields`, `folders list`, `list`, `describe`,
  `executions`) are catalog-non-mutating and pass silently. Those prompts confirm each
  command; explicit user approval of this plan is the gate. Commands are run one at a
  time, only after that approval, only from this list.
- **Open decision for the reviewer:** attach the existing "Risk Mitigation" playbook (then
  due date +0 days per convention) or run playbook-less with the default +5-day due date?
  The request doesn't say; the plan assumes **no playbook** until the reviewer decides.

## Command sequence

Discovery reads first (re-verify KB facts live), then authoring, then test-mode
verification. Nothing is scheduled until the test run is reviewed.

1. Confirm field names on `company` (expect `NPS_Score__gc`, `Segment__gc`, `Csm`):
   `node .gs-superadmin/plugin/scripts/capture.mjs --out .gs-superadmin/tmp/cr-fields-nps.json -- gs-admin --json re r sources fields --type MDA --object-name company --name nps`
   `node .gs-superadmin/plugin/scripts/capture.mjs --out .gs-superadmin/tmp/cr-fields-seg.json -- gs-admin --json re r sources fields --type MDA --object-name company --name segment`
2. Confirm the Staging folder exists (no CLI folder creation — if missing, create it in the
   UI first or approve building in `CTAs` directly):
   `node .gs-superadmin/plugin/scripts/capture.mjs --out .gs-superadmin/tmp/cr-folders.json -- gs-admin --json re r folders list --name Staging`
3. Create the rule (build name carries the ticket key per the workspace build standard):
   `gs-admin re r create --name 'CSOPS-142 CTA|DRIVE|CSM Enterprise NPS Below 6 Risk Alert' --description 'CSOPS-142: opens a Risk CTA when an Enterprise company NPS drops below 6. Requested by Dana Whitfield (VP CS).' --folder-name 'Staging'`
4. Capture the new rule's GUID for the steps below:
   `node .gs-superadmin/plugin/scripts/capture.mjs --out .gs-superadmin/tmp/cr-rules.json -- gs-admin --json re r list` — filter for the build name; ⟨resolve live: the returned ruleId, used as `<rule-id>` below⟩
5. Set the source object (single-object mode — see the `Data-source mode` header line;
   conversion is LOSSY: switching to a Prepare-Dataset source later replaces this source
   wholesale — mappings must be re-pointed, and the attach must never be re-run):
   `gs-admin re r set-source --rule-id <rule-id> --type MDA --object-name company`
6. Add criteria — NPS below 6, Enterprise segment only, and (per the CTA build standard)
   only where a CSM is assigned:
   `gs-admin re r add-criteria --rule-id <rule-id> --condition 'A:NPS_Score__gc:LESS_THAN:6' --condition 'B:Segment__gc:EQUALS:Enterprise' --condition 'C:Csm:IS_NOT_NULL' --expression 'A AND B AND C'`
7. Add the CTA action — Risk type, assigned to the CSM, deduplicated:
   `gs-admin re r add-action cta --rule-id <rule-id> --name 'Enterprise NPS Detractor — act on risk' --type 'Risk' --priority 'High' --status 'New' --reason '⟨resolve live: pick a reason distinct from "Health Concern" from the Risk type's allowed reasons, e.g. an NPS/sentiment reason — labels resolve via the command itself; keep the resolved label single-quoted⟩' --owner-source-field 'Csm' --company-id 'Gsid' --comment-option ONCE --check-open-cta true`
   (per the CTA build standard: comments once, dedupe on; uniqueness stays on the default
   TypeId/ReasonId/Name, which — with a distinct reason and name — cannot collide with
   `rul-4b7d10`.)
8. **Test run — no writes** (see Verification):
   `gs-admin re r run-now --id <rule-id> --test-run`
9. Only after the test run is reviewed and this step is separately confirmed — schedule
   daily at 04:00 UTC, after the 02:00 NPS load (`rul-9f3e21`) and before the 05:00 health
   rule, aligning to an existing rule chain if one covers that window
   (⟨resolve live: `gs-admin --json re c list` — use the chain instead of a cron if
   a suitable one exists⟩):
   `gs-admin re r schedule --id <rule-id> --cron '0 0 4 * * ?' --timezone UTC --start-time '⟨resolve live: release date, YYYY-MM-DD⟩'`

### Manual (UI-only) steps

1. At release: rename the rule to drop the `CSOPS-142 ` build prefix (CLI: `re r edit
   --new-name` may be used instead) and move it from Staging to the `CTAs` folder.
2. If the reviewer opts into the "Risk Mitigation" playbook: attach it by re-running the
   CTA action with `--playbook 'Risk Mitigation' --due-date-plus-days 0`, or set it in the
   UI.

## Verification

1. `gs-admin re r run-now --id <rule-id> --test-run` — then
   `node .gs-superadmin/plugin/scripts/capture.mjs --out .gs-superadmin/tmp/cr-exec.json -- gs-admin --json re r executions --id <rule-id>`:
   the matched-record count should be plausibly small (Enterprise detractors only), not the
   whole book. Spot-check a few matched companies' `NPS_Score__gc` and `Segment__gc` values.
2. After the first scheduled live run: `gs-admin re r debug --id <rule-id>` (note: this
   command is catalog-marked mutating, so the guard will prompt) and confirm in Cockpit that
   CTAs carry the right owner, reason, and no duplicates against `rul-4b7d10`'s CTAs.

## Rollback

1. Remove the schedule: `gs-admin re r delete-schedule --id <rule-id>`
2. Delete the CTA action: `gs-admin re r describe --id <rule-id>` to get the action id, then
   `gs-admin re r delete-action --rule-id <rule-id> --action-id <action-id>`
3. Deactivate/delete the rule itself in the UI (no CLI verb), or run
   `/gs-superadmin:deprecate` against it.

Point of no return: none until step 9 (test mode writes nothing). Once the rule has run
live, any CTAs it created must be closed manually (or via an `As Needed:` bulk-close rule)
— deleting the rule does not retract them.

## Change record

_Filled at execution time — one line per applied step: date, operator, command run, created/changed asset IDs._
