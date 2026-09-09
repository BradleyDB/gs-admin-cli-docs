# CTA|DRIVE|CSM Low Health Score Risk Alert

- **Id:** `rul-4b7d10`
- **Domain:** rules-engine (Horizon rule, SOF)
- **Status:** active · scheduled daily 05:00 UTC (`0 0 5 * * ?`)
- **Folder:** CTAs

## Summary

Opens a **Risk** CTA assigned to the CSM when a company's overall health score drops below
40. Source object `company`; criteria `HealthScore__gc LESS_THAN 40 AND Csm IS_NOT_NULL`.
CTA action: type **Risk**, priority High, status New, reason **Health Concern**, playbook
"Risk Mitigation", due date +0 days (playbook drives dates), comments posted ONCE,
`check-open-cta: true` with default uniqueness identifiers (TypeId, ReasonId, Name).

## Key fields

| Direction | Object | Field |
|---|---|---|
| reads | `company` | `HealthScore__gc`, `Csm`, `Gsid` |
| writes | `call_to_action` | (new Risk CTA per matching company) |

## Raw (excerpt)

```json
{
  "ruleId": "rul-4b7d10",
  "name": "CTA|DRIVE|CSM Low Health Score Risk Alert",
  "tasksType": "SIMPLE",
  "schedule": { "cron": "0 0 5 * * ?", "timezone": "UTC" },
  "actions": [{
    "actionType": "CTA",
    "cta": { "type": "Risk", "priority": "High", "status": "New", "reason": "Health Concern",
             "playbook": "Risk Mitigation", "dueDatePlusDays": 0, "commentOption": "ONCE",
             "checkOpenCta": true, "uniqueIdentifiers": ["TypeId", "ReasonId", "Name"] }
  }]
}
```
