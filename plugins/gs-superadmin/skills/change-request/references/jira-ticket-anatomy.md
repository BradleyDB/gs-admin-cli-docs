<!-- VENDORED COPY — do not edit here. Canonical: BradleyDB/CS_GTM_Tools main → task_mgr/references/jira-ticket-anatomy.md (v1, vendored 2026-07-02). This is a frozen contract: changes bump the version upstream first, then every vendored copy re-syncs. -->

# Jira Ticket Anatomy & System-Area Taxonomy — v1

How request events ([`request-event-schema.md`](./request-event-schema.md)) materialize as Jira
tickets, and the labeling that makes the board a **queryable change history** of the CS system —
"what have we changed in Journey Orchestrator this quarter and why" becomes a 10-second JQL query
instead of archaeology. Referenced by the sweep's extraction rubric, the digest format, and (in
`gs-admin-cli-docs`) the change-request/journal skills.

## 1 · Description template

Every sweep-created (or sweep-enriched-to-standard) ticket uses these sections, in order:

```
h2. Request
{summary sentence, then the ask in plain language — from the event's summary + body}

h2. Source & requester
* *Requested by:* {requester.name} ({role}, {team}) on {requested_at date} — [{source description}|{source_link}]
* *Wanted by:* {wanted_by | "no date given" | "ASAP"}
* *Justification:* {justification.text | "none given"} {(requester-stated | AI-inferred)}
* *Requester context:* {role_tier · book_arr_band · segment | "unknown"}
* *Repeat:* 🔁 ×{N} — previously asked {date(s)}: {links to prior asks/tickets}   ← only when repeats exist
{additional "Requested by" lines accumulate here when repeat requests merge — every requester is kept}

h2. Acceptance criteria
* {testable statement of done — drafted by the sweep/groomer when the requester gave none, marked "(AI-drafted — confirm)"}

h2. Handoff block          ← config-change tickets only
The structured request for the admin plugin (or a human admin — it reads fine either way):
{code:json}
{ the full request-event JSON }
{code}

h2. Change record          ← appended at completion, config-change tickets (SA-2 drafts it)
* {date} — {operator}: {assets changed, each linked to its KB doc} — journal ref: {changes/JOURNAL.md anchor or plan file}
```

Rules:
- **Source & requester is never omitted.** A ticket with no visible requester/date/source is a
  formatting bug (same rule as the digest).
- Merged repeat requests **accumulate all requesters** — several people asking is prioritization
  signal, and each of them is an interested party for loop-close later.
- The handoff block is the machine-readable copy; the human-readable sections above it always carry
  the same facts (degraded form — house rule).

## 2 · Labels & components

### Labels

| Label | Applied when | Applied by |
|---|---|---|
| `src-slack` / `src-email` / `src-meeting` / `src-field` / `src-manual` | Event `source` (`gainsight-skill` → `src-field`) | Sweep, at creation |
| `cat-config-change` / `cat-report` / `cat-data-quality` / `cat-feature-ask` / `cat-process` / `cat-question` | Event `category` — mapping below | Sweep at triage (approval-gated; classification guidance: the sweep's extraction rubric, "Classification" section) |
| `repeat-x2`, `repeat-x3`, … | Repeat count ≥ 2 (replace the old label when N grows) | Sweep, on repeat detection |
| `claude-created` | Every ticket the sweep auto-creates (existing convention — `jira.managed_label`) | Sweep |

Category → label: `config-change`→`cat-config-change`, `report-request`→`cat-report`,
`data-quality`→`cat-data-quality`, `feature-ask`→`cat-feature-ask`, `process`→`cat-process`,
`question`→`cat-question`. Unclassified events get no `cat-*` label rather than a wrong one.

### Components = system areas

Jira **components** answer "which part of the CS system does this ticket touch?" Default vocabulary
(renamable per org via the `taxonomy:` config block — keep the *meanings* stable):

| Component | Covers |
|---|---|
| `gs-rules` | Gainsight Rules Engine / Horizon rules |
| `gs-journey` | Journey Orchestrator programs |
| `gs-scorecard` | Scorecards & measures |
| `gs-reports` | Gainsight reports & dashboards |
| `gs-data-designer` | Data Designer objects & datasets |
| `gs-connectors` | Gainsight connectors / integrations |
| `sfdc` | Salesforce objects, fields, reports |
| `jira-board` | The ops board itself (workflow, automation) |
| `process` | Human process / policy, no system change |
| `docs` | Documentation & enablement |

Applied at triage by the sweep (**approval-gated**, corrected by humans). One primary component per
ticket; add a second only when a change genuinely spans systems.

### Provisioning

`task-sweep-setup` learns or creates the components and labels on the configured board. Component
creation needs project-admin rights — without them, setup **degrades to labels-only**
(`taxonomy.components_mode: labels-only`), notes it in the recap, and the sweep records the system
area as a `sys-{area}` label instead so the taxonomy stays queryable.

## 3 · Traceability rule (the superadmin link)

When a change is executed for ticket `KEY-123`:

1. The change journal entry (`changes/JOURNAL.md` in the gs-superadmin tenant workspace — SA-2)
   records **the ticket key** alongside timestamp, operator, command, and target asset + system area.
2. The ticket receives a **completion comment** (drafted by the admin skill, approval-gated): assets
   changed with KB links, and the journal/plan reference. It also fills the *Change record* section.

Result, queryable from both ends: `project = CSOPS AND component = gs-journey` lists every ticket
that ever touched journeys; grepping the journal for `KEY-123` shows exactly what that ticket
changed. Neither half depends on the other plugin being installed — a journal without tickets and a
board without a journal each still tell their half of the story.

## 4 · Worked example — a swept config-change ticket

Summary: `[Enterprise] Add churn-reason field to C360 offboarding section`
Labels: `src-slack`, `cat-config-change`, `repeat-x2`, `claude-created` · Component: `gs-data-designer`

```
h2. Request
Add a churn-reason picklist to the C360 offboarding section so CSMs can record why an account
churned at the moment they process the offboarding.

h2. Source & requester
* *Requested by:* Priya Nair (CSM Manager, Enterprise CS) on 2026-06-30 — [Slack #cs-ops|https://acme.slack.com/archives/C0CSOPS/p1751284800123456]
* *Requested by:* Sam Ortiz (CSM, Mid-Market) on 2026-06-12 — [Slack #cs-ops|https://acme.slack.com/archives/C0CSOPS/p1749720000456789]
* *Wanted by:* 2026-07-10
* *Justification:* "Churn retros keep stalling because nobody recorded the reason at offboarding time." (requester-stated)
* *Requester context:* manager · $5M–$10M book · Enterprise
* *Repeat:* 🔁 ×2 — previously asked 2026-06-12 (see second requester line)

h2. Acceptance criteria
* A required churn-reason picklist appears in the C360 offboarding section. (AI-drafted — confirm)
* Existing offboarding flows are unaffected for non-churn account states. (AI-drafted — confirm)

h2. Handoff block
{code:json}
{ "schema": "request-event/v1", "id": "req-slack-20260630-c360", "source": "slack", … }
{code}
```

(Full JSON for this example: [`examples/request-event.config-change.sample.json`](./examples/request-event.config-change.sample.json).)

## Versioning

v1, versioned with the request-event schema — a `category` enum change there is a label change here.
Canonical copy lives in this repo; sibling repos vendor it with source + version noted.
