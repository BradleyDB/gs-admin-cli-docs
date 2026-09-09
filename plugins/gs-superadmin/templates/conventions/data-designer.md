# Data Designer Standards

> Part of the bundled build-standards pack — **yours to edit or delete**. Read alongside
> `query-building.md` and `naming.md`, which apply to Data Designers exactly as they do
> to rules.

The gaps now between the Rules Engine, Data Designer, and soon Journey Orchestrator, are closing.
The main key difference with Data Designer, is that the output is a new MDA table after publication. They can also be saved as templates, which is useful but should be used with caution.

- Data Designs should only be used to create a new MDA as a last resort:
  - Data Designer dependencies are hard to track and can create problematic tech debt.
  - Note: As of the last 2025 release DD can be supported in Home filters if a lookup to Company is added from the in-task feature (not to be confused with simply adding a Company join), which is a new capability.
- If a Data Designer is required, it should answer as many questions with its data as possible, and not merely provide a single data point.
- In general build standards, naming conventions, etc., otherwise apply exactly to Data Designers as they do to rules.
