# Completion-comment template (ticket trace-back)

The board-side half of the traceability rule in the vendored anatomy §3: when a
ticket-driven change finishes executing, the ticket gets a comment naming what changed,
and its description's *Change record* section gets the durable copy. Grepping the journal
for the ticket key finds the change from the workspace side; this comment closes the loop
from the ticket side.

Render rules — read before the fences:

- Drafted only when an executed plan has a ticket key (end of "Executing an approved plan",
  step 6). Show the draft to the user for approval; it is posted via the user's own Jira
  access (Atlassian connector or manual paste). **Never post it without approval.**
- Everything inside each fence is literal Jira wiki markup except `⟨…⟩` placeholders;
  no placeholder may survive into the draft.
- `⟨date⟩` — the date the plan's last executed step finished, `YYYY-MM-DD` (same day the
  plan-completion journal entry — kind `change-plan execution` — is stamped
  with). **Exception**: inside the plan-file path
  `⟨slug⟩/changes/⟨date⟩-⟨change-slug⟩.md`, use the plan file's actual name as it exists
  on disk (its filename carries the *drafting* date, which may be earlier) — copy the
  path, never re-derive it. `⟨operator⟩` — the OS username of the
  person who ran the execution, exactly as it appears in the journal's `operator` field,
  so the comment and the journal cross-reference cleanly.
- The asset line repeats **once per created/modified asset**, in plan order, using the
  names and GSIDs recorded in the plan's Change record. `⟨KB doc⟩` is the asset's KB path
  (e.g. `acme-prod/rules-engine/rul-4b7d10.md`); for assets created by this change, write
  `KB doc pending next /gs-superadmin:refresh` instead.
- `⟨journal ref⟩` — the journal path plus the plan-completion entry's (kind
  `change-plan execution`) timestamp heading so
  the entry is findable, e.g. `acme-prod/changes/JOURNAL.md (2026-07-03T16:20:00Z)`. The
  journal and plan file live in the private workspace, not in Jira — reference them by
  path; hyperlink them only if the org tracks the workspace somewhere linkable.
- `⟨verification⟩` — one line stating what confirmed success, from the plan's Verification
  steps as actually run (e.g. the test-run's matched-record count and the spot-check).

The comment:

```
Change executed for this ticket — ⟨date⟩, by ⟨operator⟩.

*Assets changed:*
* ⟨CREATE | MODIFY⟩ ⟨asset name⟩ (⟨GSID⟩) — ⟨KB doc | KB doc pending next /gs-superadmin:refresh⟩

*Verification:* ⟨verification⟩

*Records:* plan `⟨slug⟩/changes/⟨date⟩-⟨change-slug⟩.md` · journal `⟨journal ref⟩`
```

The line to append under the ticket description's `h2. Change record` section (anatomy §1
format — create the section if the ticket predates it), asset list inline:

```
* ⟨date⟩ — ⟨operator⟩: ⟨assets changed, comma-separated, each with its KB doc or "KB doc pending next refresh"⟩ — journal ref: ⟨journal ref⟩ · plan: ⟨slug⟩/changes/⟨date⟩-⟨change-slug⟩.md
```
