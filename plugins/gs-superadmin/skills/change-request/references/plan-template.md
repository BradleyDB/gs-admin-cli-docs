# Change-plan template

Render rules — read before the fence:

- Everything inside the fenced block below is **literal output** except `⟨…⟩` placeholders.
  Substitute every placeholder; none may survive into the written plan file.
- `⟨ticket⟩` — the Jira key, or the word `none`. `⟨event-id⟩` — the request-event `id`, or
  `none` (plain-text input). `⟨requester⟩` — `name (role, team)` with `unknown` for missing
  parts, exactly as the input stated them.
- `⟨environment⟩` — `production` or `sandbox` from the workspace manifest; when
  `production`, keep the `**PRODUCTION**` emphasis. `⟨verification-mode⟩` — `live` when the
  CLI verified KB facts in step 4, else `KB-only (CLI unavailable)`.
- `⟨conventions-consulted⟩` — comma-separated workspace-relative paths of every conventions
  file actually loaded while drafting (e.g. `conventions/index.md, conventions/naming.md,
  conventions/query-building.md`), or exactly `none — pack not adopted` when
  `.gs-superadmin/conventions/` does not exist. Never list a file that was not read; a line
  that cannot be filled honestly means going back and loading the file first.
- The `Data-source mode:` line is **conditional**: it appears only in a plan that chooses or
  alters a rule's data source, and is deleted whole (the entire bullet) from every other
  plan.
  Choosing or altering a rule's data source is dataset work — load `query-building.md` first.
  The value is exactly one of the two forms shown — `set-source-template (Prepare
  Dataset)`, or `set-source (single-object — conversion is LOSSY, justification required):
  ⟨justification⟩` with the justification filled in — and must match the command sequence
  below. "Conversion is LOSSY" is the mode's risk label (verified live on 1.0.7): a
  single-object rule CAN be converted to a prepared dataset later via
  `set-source-template`, but the attach REPLACES the single-object source outright
  (mappings onto it must be re-pointed) and a re-run APPENDS a second, disconnected task
  graph — so the justification states why single-object is chosen despite the workspace
  standard and that lossy escape path.
- Repeating rows: the *Impacted assets* table gets **one row per impacted asset** found in
  step 4 (delete the table and write `No impacted assets found — ⟨why, e.g. "KB has no
  documented assets in gs-rules; run /gs-superadmin:refresh"⟩` when none). The *Assets to
  create/modify* list, *Command sequence* steps, *Manual (UI-only) steps*, and *Rollback*
  steps likewise repeat once per item, keeping their numbering continuous.
- In the command sequence, values that can only be resolved against the live tenant at
  execution time stay as `⟨resolve live: what and how⟩` — that is the one placeholder form
  that legitimately survives into the plan file (it is resolved at execution, not at
  drafting).
- Per-record values in a CTA comment or name are `${⟨alias⟩_⟨Field⟩}` tokens embedded
  literally in `--comments`/`--name` (validated live on 1.0.4: Gainsight stores the token
  with `isTokenBased`/`tokenFields` on the mapping and resolves it per record at run time;
  the field must come from the rule's dataset, and the alias prefix must match the
  dataset's task alias). Keep the whole value single-quoted so the shell never expands
  `${…}`, and verify token resolution with a test-mode run before scheduling.
- The Change record section is written exactly as shown — empty — at drafting time; it is
  filled only during/after execution.

```markdown
# Change plan — ⟨one-line summary of the change⟩

- **Status:** draft (nothing executed)
- **Revision:** 1
- **Date:** ⟨YYYY-MM-DD⟩
- **Ticket:** ⟨ticket⟩ · **Request event:** ⟨event-id⟩
- **Requested by:** ⟨requester⟩ on ⟨requested date⟩ · **wanted by** ⟨date | "no date given"⟩
- **Justification:** ⟨text | "none given"⟩ (⟨requester-stated | AI-inferred⟩)
- **Workspace:** ⟨slug⟩ (⟨baseUrl⟩) — **⟨environment⟩**
- **System area:** ⟨primary component, e.g. gs-rules⟩
- **Verification basis:** ⟨verification-mode⟩
- **Conventions consulted:** ⟨conventions-consulted⟩
- **Data-source mode:** ⟨set-source-template (Prepare Dataset) | set-source (single-object — conversion is LOSSY, justification required): ⟨justification⟩⟩

## Request

⟨the ask in plain language, then the requester's own words as a quote⟩

## Impact analysis

| Asset | Domain | Relationship to this change | KB source (last_verified) |
|---|---|---|---|
| ⟨name⟩ | ⟨domain⟩ | ⟨reads/writes same field, overlapping CTA identifiers, downstream consumer, …⟩ | ⟨kb path⟩ (⟨date⟩) |

⟨freshness caveats: docs past TTL, undocumented domains, refresh recommendation — or "KB fresh for all cited assets"⟩

## Assets to create / modify

1. **⟨CREATE | MODIFY⟩** ⟨asset type⟩: `⟨convention-compliant name⟩` — ⟨one line: what it does⟩
   ⟨naming note: convention applied / "(no workspace naming convention — unchecked)" / build-name with ticket prefix⟩

## Risk notes

- **Environment:** ⟨risk framing appropriate to production or sandbox⟩
- **Shared surface:** ⟨objects/fields/CTA types other assets rely on⟩
- **Blast radius on error:** ⟨what a misconfiguration would do, and which verification step catches it⟩
- **Guard coverage:** ⟨which commands below the mutation guard will NOT prompt on — derived from the workspace catalog's `mutating` flag, the bundled catalog's `mutating` flag, AND `ask-overrides.json` (the guard decides on the union of all three), per the skill's step 5 — and that approval of this plan is the gate for those; omit only if every command is guard-covered⟩

## Command sequence

⟨discovery reads first, then authoring, then test-mode verification before any schedule⟩

1. ⟨purpose⟩:
   `⟨exact gs-admin command, global flags before the subcommand, free-text values single-quoted⟩`

### Manual (UI-only) steps

1. ⟨step the CLI cannot do, stated as a concrete UI action⟩

## Verification

1. ⟨test-mode run / execution-history check / targeted describe — with the exact command and what output confirms success⟩

## Rollback

1. ⟨command or UI step returning the tenant to the pre-change state⟩

⟨point of no return, if one exists — e.g. "once the rule has loaded data to X, rollback requires a data correction, not just deletion"⟩

## Change record

_Filled at execution time — one line per applied step: date, operator, command run, created/changed asset IDs._
```
