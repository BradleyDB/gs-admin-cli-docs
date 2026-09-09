# CSOPS-142 · Add risk-CTA rule for Enterprise accounts with NPS < 6

Synthetic Jira ticket input for the change-request skill's offline check — a config-change
ticket rendered per the vendored ticket anatomy (`skills/change-request/references/
jira-ticket-anatomy.md`), carrying the handoff block from `request-event.json`. Scenario and
event are shared with `BradleyDB/CS_GTM_Tools` → `fixtures/config-change-routing/` (the
producer-side fixture for the same request).

Labels: `src-slack`, `cat-config-change`, `claude-created` · Component: `gs-rules`

---

h2. Request

Add a Rules Engine rule that opens a risk CTA whenever an Enterprise account's NPS drops
below 6, so at-risk accounts surface while there is still time to act.

h2. Source & requester

* *Requested by:* Dana Whitfield (VP Customer Success, CS Leadership) on 2026-07-02 — [Slack #cs-ops|https://acme.slack.com/archives/C0CSOPS/p1751451300987654]
* *Wanted by:* 2026-07-20
* *Justification:* "We keep finding these in the churn retro instead of while we can still act." (requester-stated)
* *Requester context:* exec

h2. Acceptance criteria

* An NPS score below 6 on an Enterprise account opens a risk CTA within one rule-run cycle. (AI-drafted — confirm)
* Non-Enterprise accounts and NPS ≥ 6 open nothing; existing CTAs are not duplicated. (AI-drafted — confirm)

h2. Handoff block

The structured request for the admin plugin (or a human admin — it reads fine either way):

{code:json}
{
  "schema": "request-event/v1",
  "id": "req-slack-20260702-npsr",
  "source": "slack",
  "source_link": "https://acme.slack.com/archives/C0CSOPS/p1751451300987654",
  "requester": { "name": "Dana Whitfield", "role": "VP Customer Success", "team": "CS Leadership" },
  "requested_at": "2026-07-02T10:15:00Z",
  "wanted_by": "2026-07-20",
  "summary": "Add risk-CTA rule for Enterprise accounts with NPS < 6",
  "body": "Can we add a rule that opens a risk CTA whenever an Enterprise account's NPS drops below 6? We keep finding these in the churn retro instead of while we can still act.",
  "justification": {
    "text": "We keep finding these in the churn retro instead of while we can still act.",
    "stated_by": "requester"
  },
  "accounts": [],
  "category": "config-change",
  "repeat_of": [],
  "requester_context": {
    "role_tier": "exec",
    "book_arr_band": null,
    "segment": null
  },
  "status": "ticketed"
}
{code}
