# NPS Trend by Segment

- **Id:** `rep-5c19e4`
- **Domain:** report
- **Status:** active · on the "CS Leadership" dashboard

## Summary

Monthly NPS trend grouped by customer segment. Source object `company`; reads
`NPS_Score__gc`, `NPS_Response_Date__gc`, and the segment picklist `Segment__gc`
(values: Enterprise, Mid-Market, SMB).

## Key fields

| Direction | Object | Field |
|---|---|---|
| reads | `company` | `NPS_Score__gc`, `NPS_Response_Date__gc`, `Segment__gc` |

## Raw (excerpt)

```json
{
  "reportId": "rep-5c19e4",
  "name": "NPS Trend by Segment",
  "sourceObject": "company",
  "groupBy": ["Segment__gc"],
  "fields": ["NPS_Score__gc", "NPS_Response_Date__gc"]
}
```
