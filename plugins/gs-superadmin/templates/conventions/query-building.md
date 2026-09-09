# Query Building Standards

> Part of the bundled build-standards pack — **yours to edit or delete**. Applies to
> queries/datasets everywhere they appear: Rules, Data Designer, and Journey Orchestrator
> (Programs).

## Preface

While Gainsight has a number of generally flexible capabilities, we also need to acknowledge that it is not an extensible platform and has boundaries. We should be mindful of its limitations when it comes to setting expectations of the business. Often times we are able to come up with creative solutions to circumvent some of the limitations, however we want to try and avoid solutions that:

- Duplicate data
- Create customizations that conflict with upstream data structures
- Conflicts with other existing configuration/design
- Impacts other teams, Gainsight workflows, or paints us into a corner from which it would be hard to untangle in the future if or when GS product catches up

Following these best practices can reduce maintenance risk and overhead significantly.

## General Query Building Standards

> ⚠️ **When building a rule, ALWAYS select "Prepare Dataset" and not "Select an Object". Converting a "Select an Object" rule to Prepare Dataset later is possible (CLI-verified on 1.0.7) but lossy and unsafe to retry: the attached dataset replaces the original source outright — everything mapped to it must be re-pointed — and running the attach a second time stacks a disconnected second dataset onto the rule.**

## Query Structure and Naming Convention

With the Horizonization of Gainsight, it is visually easier to see the structure of a rule and the types of joins utilized in an overall query, be it for Rules, Data Designer, or Journey Orchestrator (Programs). However, the visualizations can become altered, and troubleshooting can be difficult for admins new to a process, when revisiting complex designs, or engaging with Gainsight Support.

For these reasons, it's important that rule tasks have a standard prefix-based naming convention so that the flow of a rule is always preserved.

Example task flow: `A_Fetch Active MDA Users` and `B_Fetch SFDC Managers` merge into
`C_Join MDA with SFDC`; alongside, `D_Fetch NXT Permissions` and the join both feed
`E_Join Prior Data to Permissions`, followed by `E1_Add Filters`.

- Each Task is lettered alphabetically (rules need to start with a letter) in sequence such as A_, B_, C_, etc.
- It is not necessary to prefix the final Transformation, unless you have multiple termination points for Rule Actions. In that case, prefixes or contextually relevant labels (e.g., Red, Green, Yellow for Scorecard Assignments) can be used.
- The ordering should be logical, so that if A and B merge, their Merge Task is C, etc.
- In general, derivative transformations will use a letter number pair like B1, B2, B3. Only when a new branch is created would you move to D.
- Always add a final transformation at the end of a query, even if all you are doing is fetching a single data set with no further manipulation (especially for something like exporting data). This makes it easier to retroactively make adjustments and, especially for Data Designer, ensure that the final set of Data labels are clean and consistent.

> 📌 Sometimes it's useful to add 'placeholder' transformations, as they generally take minimal processing time when unused, and might avoid needing to add them back in later. At least one per rule is recommended at minimum.

## Field Naming in Queries

For the same reasons it is important to label the Query tasks consistently, it is also important to label Display Names for fields for complex queries. If you have an SFDC User ID from two or more data fetches, having the prefix to your fields makes it easy to ensure you use the correct field in merges, consistently in downstream tasks, and helps with troubleshooting (especially when Gainsight Support is involved).

Example: in a task prefixed `A_`, the fields SFDC User Id, GSID, Name, Active, and User
Title get the Display Names `A_SFDC User Id`, `A_GSID`, `A_Name`, `A_Active`,
`A_User Title`.

> If you adopt this prefix standard, record its pattern in the `## Field aliasing` section
> of `.gs-superadmin/CONVENTIONS.md` (`- task-alias-prefix-regex:` — for `A_`-style
> prefixes, `` `^[A-Z]_` ``). The dependency and email reports read that bullet so a
> search for `GSID` also finds `A_GSID`; without it they match exactly and miss every
> aliased display name.

- For Data Design Sets that are being published, it makes it easier to troubleshoot and validate in Explorer before publishing.
- Create a Final Data Set transformation with prefixes removed, and fields consistent with other business processes prior to publication.

## Query Standards

Several functional areas of Gainsight permit the ability to query data in various ways and merge/transform data to produce virtual data sets. This section provides some general guidelines to creating and using data and objects for that purpose.

- In addition to the prefixes, try to include descriptive names for datasets - when creating datasets, we want to be able to easily get a high level idea of the intended use case.
  - For example, when naming a Dataset task in a Rule or Program to retrieve NPS Score CTAs, consider a descriptive name such as "A_Fetch NPS Score CTAs" vs. the more generic "A_Fetch CTAS."
- Include clear yet succinct descriptions wherever possible in Dataset tasks and Actions, especially in merges and transformations to help communicate the purpose of that task (i.e. Task Description, Action Descriptions)
  - Example: "Only Retain Users with Managed Package."
- When creating Datasets, keep the query as concise as possible, however think about any fields you may want to include in the Show Me fields that will be helpful in the event troubleshooting is needed (i.e. Account Name, BP Name, etc).
- Filter the data as far as possible to reduce the final data output results.
  - Tip: When possible complete filtering at the data task stage, not at the Action Stage. This will help reduce rule run times as the Actions will have fewer records to evaluate. This is true even if you have multiple actions filtering off of a single task. All records from the task will pass to each action, but only the filtered ones will be acted on. It is preferable to instead create multiple terminating transform steps, and having one Action per task, where the data is filtered at the task level.
- When it is possible to choose between a SFDC object or an MDA object as a source, always choose MDA when possible. For example, instead of using the SFDC User object to map a User ID, use the GS User object. This will enable us to be consistent.
- When choosing fields upon which to apply a Filter, try to identify fields that are 'static' or managed via automation vs. editable by end users.
  - For example, when attempting to query for a specific CTA, if you know that CTA will always have a Playbook attached, use the Playbook Name as the filter instead of the CTA Name. The Playbook Name is not editable by end users but the CTA Name is.

> ℹ️ The more you can reduce a query BEFORE later steps and especially before Rule action filters, the faster it will run. Processing time and filtering records during data prep will be faster. Additionally, if you have multiple actions, the rule will run faster if the each action has its own terminating task where the filtering is done, rather than using Rule Action filters.
