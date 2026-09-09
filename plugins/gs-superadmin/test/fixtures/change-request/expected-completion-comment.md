# Expected completion comment — CSOPS-142

> Fixture note: this is the expected trace-back comment drafted by the "Executing an
> approved plan" step (rendered from `skills/change-request/references/
> completion-comment-template.md`) for [`ticket.md`](./ticket.md), assuming
> [`expected-plan.md`](./expected-plan.md) was approved and executed on 2026-07-03 by
> operator `cs-admin`, the test run matched 4 Enterprise detractors, and the created
> rule's GSID came back as `1P02GH7K3M9QRSTUVWX4YZAB`. Wording may vary between runs;
> the facts below (ticket key, asset + GSID, plan path, journal reference) are what the
> offline check verifies. Execution outputs are synthetic — nothing was run.

The comment, as it would be posted to CSOPS-142:

```
Change executed for this ticket — 2026-07-03, by cs-admin.

*Assets changed:*
* CREATE Rules Engine rule CTA|DRIVE|CSM Enterprise NPS Below 6 Risk Alert (1P02GH7K3M9QRSTUVWX4YZAB) — KB doc pending next /gs-superadmin:refresh

*Verification:* test run (`re r run-now --test-run`) matched 4 records, all Enterprise with NPS < 6; no CTA collisions with rul-4b7d10's alerts.

*Records:* plan `acme-prod/changes/2026-07-02-enterprise-nps-risk-cta.md` · journal `acme-prod/changes/JOURNAL.md (2026-07-03T16:20:00Z)`
```

The matching line appended under the ticket's `h2. Change record` section:

```
* 2026-07-03 — cs-admin: CREATE rule CTA|DRIVE|CSM Enterprise NPS Below 6 Risk Alert (KB doc pending next refresh) — journal ref: acme-prod/changes/JOURNAL.md (2026-07-03T16:20:00Z) · plan: acme-prod/changes/2026-07-02-enterprise-nps-risk-cta.md
```
