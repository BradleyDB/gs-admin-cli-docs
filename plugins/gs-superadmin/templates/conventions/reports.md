# Report Standards

> Part of the bundled build-standards pack — **yours to edit or delete**.

- When building a tabular report, always freeze the first column unless there is a specific reason not to. The first column of a report should typically be the name/subject or similar field for that record/object.
- Always configure drill downs on reports before publishing.
- Always include a field either in a table or the drill down that is a direct link to the record in question.
  - In Gainsight, this is often a "Name" or "Subject" field
  - If one is not available see if you can find out why, and create a ticket with the appropriate team to create one.
    - If it is a report based on a Data Designer, it is possible the incorrect fields were added and the design needs updating
    - If it is an SFDC report, we may not have permission to the field, or one may not yet exist
    - There might be cases in Gainsight, like for custom low volume objects, where a unique link to a given record is not possible.
- Make sure to review any field names used in a report, and alias them so they are consistent throughout all reports, or at least make sense in the context of the specific report
  - For example CSM Name or Name would be the default value when adding CSM or CSM>Name, respectively.
