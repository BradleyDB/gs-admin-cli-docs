# Asset Deprecation Process

> Part of the bundled build-standards pack — **yours to edit or delete**. Org-specific
> references (JIRA/ESC tickets, folder names like "Deactivated Rules Pending Delete") are
> examples from the authoring org.

To reduce tech debt and dependencies, we should regularly remove unused Rules, Data Designs, Reports, Etc. Below is how each element should be updated and retained for a few months, then deleted when it is clear it no longer needs to be referenced.

> **Prefix year width.** Write new deprecation prefixes with the four-digit year exactly
> as shown (`D.MM.DD.YYYY`). Tools *reading* names must accept a two-digit year as well
> (`D.MM.DD.YY`) — live tenants carry both widths, and treating a two-digit-year name as
> not-deprecated strips a real retention date that cannot be recovered from the CLI.

## Rules

When the decision is made to deactivate a rule, and you've done due diligence to remove any dependencies, follow this process:

- Remove the rule from Rule Chain (if applicable)
- If the rule is being replaced, add in the new rule in the correct dependency order first, or ensure it is documented so it can be adequately replaced
- Add "D.MM.DD.YYYY" to the beginning of the rule name.
  - For example: D.08.26.2020 DATA SFDC MODIFY C360 Layout Assignment
- Add "Deactivated [JIRA/ESC Ticket Number]" to the beginning of the Description.
  - For example: Deactivated GAIN-1247
- Move rule to Deactivated Rules Pending Delete folder
- Deactivate rule
- After 3 months, deactivated rules may be removed, as well as purged from the trash bin

## Data Designer

- Unschedule the Data Designer (DD)
- If possible, turn off the MDA for it as well
- Add "D.MM.DD.YYYY" to the beginning of the DD name
- Add "Deactivated [JIRA/ESC Ticket Number]" to the beginning of the Description
- Move DD to the Deactivated DD Pending Deletion Folder
- After 3 months, deactivated DDs may be removed, as well as purged from the trash bin (if applicable)

## Reports/Dashboards

- Remove the report from any existing dashboards, 360 layouts, etc
- Set to Private
- Add "D.MM.DD.YYYY" to the beginning of the report name
- Add "Deactivated [JIRA/ESC Ticket Number]" to the beginning of the Description
- Move the report to the 1. To Be Deleted Folder
- After 3 months, the marked reports may be deleted, as well as purged from the trash bin

## JO Programs

_(WIP — no content yet)_
