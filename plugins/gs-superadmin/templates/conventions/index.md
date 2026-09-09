# Build-Standards Pack — Index

> Part of the bundled build-standards pack — **yours to edit or delete**. Org-specific
> references (JIRA, Snowflake, folder names) are examples from the authoring org; adapt
> them to your own tooling. If your org has its own standards guide, replace these files
> with it.

Load **only** the file(s) relevant to the task at hand:

| When the task involves… | Load |
|---|---|
| Building or editing **any** query/dataset (Rules, Data Designer, JO Programs) — including choosing or altering a rule's data source (`re r set-source` / `re r set-source-template`) | `query-building.md` |
| Creating or modifying a **rule** (actions, CTAs via automation, test rules, scheduling) | `rules-engine.md` |
| **Naming or renaming** assets, folder organization, name audits | `naming.md` |
| **Data Designer** builds (when to use, MDA output cautions) | `data-designer.md` |
| Building or updating **reports** | `reports.md` |
| **Deactivating / deprecating** rules, Data Designers, reports, dashboards | `deprecation.md` |

Choosing or altering a rule's data source is dataset work — load `query-building.md` first.
Load the topic file **before** the decision it governs, not after.

General principle (applies everywhere): avoid solutions that duplicate data, conflict with
upstream data structures or existing configuration, or impact other teams and future
maintainability. See the Preface in `query-building.md`.
