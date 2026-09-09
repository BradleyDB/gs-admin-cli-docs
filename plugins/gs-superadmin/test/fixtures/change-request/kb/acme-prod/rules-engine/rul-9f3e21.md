# DATA|COMPANY|IMPORT NPS from Survey Responses

- **Id:** `rul-9f3e21`
- **Domain:** rules-engine (Horizon rule, SOF)
- **Status:** active · scheduled daily 02:00 UTC (`0 0 2 * * ?`)
- **Folder:** Data Loads

## Summary

Nightly load of the latest NPS survey response onto the Company object. Reads the
`survey_response` MDA object (most recent response per company), writes
`NPS_Score__gc` (number) and `NPS_Response_Date__gc` (date) on `company` via a
load-to-company action.

## Key fields

| Direction | Object | Field |
|---|---|---|
| reads | `survey_response` | `Score`, `RespondedAt`, `CompanyId` |
| writes | `company` | `NPS_Score__gc`, `NPS_Response_Date__gc` |

## Raw (excerpt)

```json
{
  "data": {
    "ruleDetails": {
      "ruleId": "rul-9f3e21",
      "ruleName": "DATA|COMPANY|IMPORT NPS from Survey Responses",
      "tasksType": "SIMPLE",
      "schedule": { "cron": "0 0 2 * * ?", "timezone": "UTC" },
      "actions": [{ "actionType": "LOAD_TO_COMPANY", "fields": ["NPS_Score__gc", "NPS_Response_Date__gc"] }]
    }
  }
}
```
