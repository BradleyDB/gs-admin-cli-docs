# Rules Engine Standards

> Part of the bundled build-standards pack — **yours to edit or delete**. Org-specific
> references (JIRA, Staging) are examples from the authoring org. Read alongside
> `query-building.md`, which applies to all rule datasets.

Queries are very powerful, with the ability to do multiple things, merges, calculations, etc within the context of a single rule action.

_But just because we can, doesn't always mean we should. What seems possible to create within a single rule can quickly become something that is a nightmare to troubleshoot._

In addition to the guidelines put forth in the Query Standards section (`query-building.md`), here are some additional standards related to Rules:

- Keep rules as clean and as simple as possible.
- Dataset creation within a rule should be kept to a minimum. Whatever is required to trigger a single action (or multiple actions that rely on the same core criteria) should be the focus of a single rule. We should try not to force multiple sets of criteria into the same rule through multiple merges, transformations etc. unless absolutely necessary. If it is possible to split into separate rules without having to create unnecessary/"staging" data tables and fields, we should do it.
- When making modifications to an existing rule, always copy the existing rule, make/test the changes in the copy, then replace the existing rule at the appropriate time (i.e. release day)
- When developing a new rule or a copy of an existing rule, please add the JIRA Ticket number to the beginning of the rule and move to Staging so that as we are working on the build/release, we know which items are associated with which JIRA tickets.

> ℹ️ These general guidelines should also be applied when creating Journey Orchestrator Programs as well.

## Test Rules

- TEST rules are ok to create and run in test mode in Production but please be sure to delete the rule when it is no longer needed.

> ⚠️ Remember: Rules with an S3 or API Action will STILL fire when running in test mode.

## When creating CTAs via Automation

- Always check the Include in identifiers flag (unless there is a viable reason not to)
- Do not skip weekend (unless there is a viable reason to do so)
- Never Post update to chatter
- Post update to comments ONCE unless there is a use case that requires repeatedly updating
- Due Date should always be set to 0 if there is a Playbook attached, so that Playbook dates supersede the rule date
- Unless otherwise requested, ensure CTAs only trigger where the target user type is populated (i.e. CSM != NULL, CSA (TAM) != NULL, etc.)

## Rule Scheduling

- When scheduling rules, try to align to an existing Rule Chain if possible unless:
  - The rule needs to run more frequently than once per day
  - The rule needs to run at a specific time/frequency not accounted for by current rule chains
  - The rule chain is full
