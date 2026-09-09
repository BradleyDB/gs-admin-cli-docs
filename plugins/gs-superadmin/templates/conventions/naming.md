# Organization and Naming Conventions

> Part of the bundled build-standards pack — **yours to edit or delete**. Org-specific
> references (Snowflake `SNOW`/`SF` prefixes, folder names) are examples from the
> authoring org.

The following naming conventions are intended to help maintain consistency and ensure ease of identification at a glance. While the functions of each product feature vary in what you can do, we should strive to use as many of the same naming conventions and standards across the product as possible. In other words, the naming conventions for a Rule should follow the same pattern as Data Designers, JO Programs, Email Templates, etc.

The main exception to this is user facing assets - Report, Dashboard and CTA names do not have an "admin" and "end user" name, so whatever the name is set at, the users will see. They will likely have different needs than admins, and instead we may need to rely more on folder structure organization and other cues.

## Rules

### Organization

The first level of organization is the folder structure. While rules should be logically grouped, there are a few different ways we do this, and there isn't a hard and fast rule to adhere to:

- Generally, rules are grouped by process, such as "CTAs" where all of the rules are related to Implementations, even if they are across different Rule Actions like Creating/Updating Relationships, Setting Scores, etc.
- Processes may also be subdivided, like with S3 Exports. We have a top level folder grouping them all together, and then a sub-folder for each system that the files are picked up by.

### Rule Naming

In cases where multiple Rule Types (CTA, SCORECARD, DATA OPERATIONS) may be taking place within a single rule, the primary goal of the Rule should take precedence: 1. CTA, 2. SCORECARD, 3. DATA OPERATIONS, except for when the rule is for Maintenance or Testing.

When using Horizon Rules, add an external prefix to the start of the rule name if data from that system is imported at any point in the query:

- Add SF to the start for Snowflake Data

Unscheduled rules that are needed for maintenance should still be in the relevant folder, but also have one of the below prefixes:

- **OneTime:** A rule that is unlikely to be used again but may still be useful. For example, something that sets the default value for Boolean records for a new field on existing records as part of a new process.
- **As Needed:** Similar to the above, but likely to be used again, just without the regularity of a scheduled rule. Like bulk closing CTAs, or Success Plans no longer needed, for a certain process.

### Rule Name Syntax

A consistent and repeatable naming syntax helps with searching for rules, organizing them beyond the folder structure, and quickly being able to tell at a glance what a rule does without having to read all about it.

The below format should be followed when naming a rule:

> **Rule Type | Operation/Sub-Type Contextual Reference | Brief Description**

#### Definitions

|  | External Prefix | Rule Type | Sub-Type | Contextual Reference/Operation | Brief Description |
|---|---|---|---|---|---|
| **Definition** | Quick name of the external source involved in the rule | Where the action generally takes place | What is acted on by the Rule | What Action is taking place | Describing the type of action taking place |
| **Context** | Useful for identifying rules importing Snowflake data, or exporting data to external tools | This is loosely aligned with Rule Actions or Gainsight feature areas, but can be more broad, like with the DATA Rule Type | For most rules, this will be the type of CTA, Success Plan, or Type of relationship. In other cases the name of the MDA object, or some other component like S3 | For the most part, this will be general CRUD like action, but may differ depending on the rule type | A short description of what is happening to the data in the rule, that in addition to the other sections should give a general idea of what is happening |

#### Dictionary

|  | Rule Type | Sub-Type | Contextual Reference/Operation |
|---|---|---|---|
| **Scorecard Rules** | Scorecard | Scorecard_Name | Measure_Name |
| **CTA Rules** | CTA | DRIVE, VO | Assignee Type: CSM, Pooled, Scaled |
| **General Data Rules** | DATA | MDA Object Name, SFDC, S3 | MODIFY, IMPORT, EXPORT, DELETE, CREATE |
| **Relationship Rules** | Relationship | Relationship Type Name | MODIFY, IMPORT, EXPORT, DELETE, CREATE |
| **Success Plan** | SuccessPlan | Success Plan Type Name | ASSIGN, MODIFY, CLOSE, DELETE |

#### Examples

- DATA|USER|MODIFY Assign License to MDA User
- DATA|PERSON|MODIFY Update Email Optout from SFDC
- SNOW|DATA|COMPANY|IMPORT Product Usage Data
