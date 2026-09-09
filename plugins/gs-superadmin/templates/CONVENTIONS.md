# Build Standards & Conventions

> **Tenant-specific** — fill in as patterns emerge. This file is yours to edit.
> It is loaded by Claude when authoring or modifying Gainsight assets in this workspace.

## Standards library

If `.gs-superadmin/conventions/` exists, it holds the adopted build-standards pack —
start at `conventions/index.md` and load **only** the topic file relevant to the current
task (naming for renames/audits, query-building for any dataset work, and so on). Those
files are yours to edit; replace or delete them if your org has its own standards guide.
The sections below override the pack wherever they conflict.

## Naming

_Example formats below — replace with your org's actual conventions (or rely on
`conventions/naming.md` if you adopted the pack). Until replaced, these are placeholders,
not adopted standards._

- **Programs / Journeys**: `[Team] – [Purpose] – [Audience]`
- **Rules**: `[Trigger type]: [Object] [Action]` (e.g. `Scheduled: Account Health Score Update`)
- **Scorecards**: `[Segment] [Period]` (e.g. `Enterprise Monthly`)
- **Reports**: `[Team] | [Subject] | [Timeframe]`

## Journey Structure

_Document recurring patterns: typical entry sources, branching logic, exit criteria._

## Rule Categories

_Document rule types in use and their naming/ownership conventions._

## Report Conventions

_Document report naming, shared folders, standard filters._

## Data Objects

_Document custom objects, field naming standards, key lookup fields._

## Field aliasing

_If your build standards prefix task-built field display names with a task alias (e.g.
`A_GSID` for a field whose underlying name is `GSID`), record the prefix pattern as a
regex below, as one inline-code value. The `/gs-superadmin:deps-report` and
`/gs-superadmin:email-report` report scripts read this bullet themselves (`--alias-prefix`
overrides it), so a search for `GSID` also matches the aliased
display names. Leave the value empty if your org does not alias fields — the reports then
match exactly and say so. Keep exactly ONE section with this title: if several headings
match it, the scripts read only the bare `## Field aliasing` one (and disclose the ones
they skipped); two suffixed headings with no bare one are ambiguous and none is read.
The section ends at the next `#` or `##` heading — a bullet under a later top-level
section (an appendix, say) is never read as this declaration, while `###` subsections
inside this section remain part of it._

- task-alias-prefix-regex: 

_Example value (delete this line once the bullet above is filled in): `` `^[A-Z]_` ``._
