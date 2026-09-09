---
description: Capture a gs-admin CLI bug as a vendor-ready "prompt and problem" report at the moment of encounter — verbatim commands and output, the human ask and agent task context, repro steps, reliability, impact — deduped against known issues and existing reports.
disable-model-invocation: true
argument-hint: "[<short bug description>] [--dir <path>]"
---

# /gs-superadmin:report-bug

Write an upstream bug report for a `gs-admin` CLI misbehavior **while the evidence is
still in this session** — the exact commands, their unedited output, and what the human
actually asked for. Evidence quality decays the moment a session closes; this skill
exists to capture it at the point of encounter, in the "prompt and problem" format the
vendor asked for (the human ask + the agent's task context + verbatim commands and
results).

Reports are **local files for the user to send** — this skill never transmits anything,
never posts anywhere, and never commits a report to a git repo (reports deliberately
carry tenant identifiers; see the scrub rule in step 5).

## Arguments

- `<short bug description>` — optional; seeds the report slug and Summary. If absent,
  derive both from the misbehavior being reported.
- `--dir <path>` — one-run override of the report output directory. Does **not**
  rewrite the recorded directory choice (step 2).

## Steps

### 1 — Dedup first (before drafting anything)

A repeat observation strengthens an existing report; a duplicate file dilutes it.
Check, in order:

1. **The known-issues ledger of a gs-fortress checkout**, when the workspace names one:
   if the git-ignored marker file `.gs-superadmin/fortress-dir` exists, its single line
   is the path of a gs-fortress checkout; read every entry's `id`, `title`, and
   `howToTest` from `<that path>/ledger/known-issues.json` and compare them with the
   misbehavior being reported. On a match, **name the KI id** (e.g. "this is KI-003"),
   say whether the ledger shows it resolved, and offer to register the new report
   against that KI instead of opening a new one (the register command is in the
   closing block, step 7). The marker is the maintainer's: a plugin user without a
   gs-fortress checkout has no marker and **skips this check** — do not ask for one.
   A marker whose path or ledger file does not resolve is reported once ("marker names
   a path with no ledger") and then skipped, never treated as a match.
2. **Known CLI issues** in `.gs-superadmin/operating-model.md` — if the misbehavior is
   already documented there as expected 1.0.4 behavior (e.g. the `sc measures --id`
   auth race, list truncation, the `run-now` mislabel), tell the user it's a known
   issue, cite the bullet, and stop unless they want new evidence recorded anyway.
3. **Existing report files** in the output directory (step 2) — read their `# Handoff`
   title lines and Summary sections. If one covers the same bug, **append an evidence
   section to that file** (the `Additional occurrence` block in
   `references/report-template.md`) instead of creating a new report, and update its
   Reliability section if the new observation changes it.

Only a genuinely new misbehavior gets a new file.

### 2 — Resolve the output directory (ask once, durable marker)

Reports carry tenant data, so the destination is the user's choice, made **exactly
once per workspace**:

- If `--dir` was passed, use it for this run (no marker changes).
- Else if the marker file `.gs-superadmin/upstream-reports-dir` exists, use the path on
  its single line — **do not re-ask, ever**.
- Else ask: "Where should upstream bug reports be written? Default:
  `.gs-superadmin/upstream-reports/` (stays inside the git-ignored workspace folder).
  Reports contain tenant identifiers — pick somewhere that is never a public repo (a
  private repo's folder is fine)." Write the accepted path as the single line of
  `.gs-superadmin/upstream-reports-dir`, then use it. Re-runs read the marker and skip
  the question — the user can delete the marker file to be re-asked.

Create the directory if it does not exist.

### 3 — Gather the evidence (from this session, verbatim)

- **The human ask** — quote the relevant request from this conversation, and state what
  the agent was doing when the CLI misbehaved (the "prompt" half of prompt-and-problem).
- **Commands run** — every relevant `gs-admin` invocation, verbatim, in the order run.
  Include the working variant when one was found.
- **Actual output** — unedited, from the session transcript. Never paraphrase error
  text; if output is long, keep the failing part verbatim and note what was elided.
- **Environment** — CLI version from `.gs-superadmin/catalog.json` (`meta.cliVersion` —
  the CLI the workspace reference was generated from; `version.json` carries only the
  plugin's bundled pin), cross-checked against live `gs-admin --version` when the CLI is
  available (report both if they differ); OS and Node version; auth mode if relevant;
  tenant base URL;
  and the line "driven by an AI agent (Claude) in Claude Code".
- **Reliability** — how many attempts, what varied, whether it reproduces
  deterministically. **Reproduction must respect the read-only-by-default rule**: never
  re-run a mutating or unknown command just to reproduce a bug without the user's
  explicit go-ahead (the guard will prompt; prefer `--test-run` where it exists), and
  never reproduce against production when a sandbox shows the same behavior.
- **Impact** — what the misbehavior costs an AI-agent admin workflow (wasted turns,
  wrong conclusions, silent gaps), and any workaround found.

### 4 — Render and write the report

Render `references/report-template.md` (all substitution rules are defined there) and
write it to `<dir>/<YYYY-MM-DD>-<bug-slug>.md`, where `<bug-slug>` is 3–6 lowercase
hyphenated words naming the bug (e.g. `2026-01-15-rules-list-name-flag`). For a dedup
append (step 1), add the rendered `Additional occurrence` block to the existing file
instead.

### 5 — Scrub check (before finishing)

Read the draft once more with this rule:

- **Allowed**: tenant identifiers — base URL, slug, asset names/GSIDs, counts. The
  report goes to the vendor about the user's own tenant; that context is what makes it
  actionable.
- **Never**: tokens, secrets, passwords, API keys, `Authorization`/cookie headers, or
  keychain/credential-store contents — redact as `⟨redacted⟩` if any command output
  included one.

### 6 — Propose the Known CLI issues bullet (never auto-apply)

For a new, confirmed report, draft a matching bullet for the **Known CLI issues**
section of `.gs-superadmin/operating-model.md` (same style as the existing bullets:
what misbehaves, the workaround, version-scoped "observed on v⟨version⟩"). Show the
exact bullet text and ask whether to add it — **do not edit the operating model without
a yes**. A declined bullet is fine; the report file stands alone.

### 7 — Report and stop

Render the block below, substituting: `⟨dir⟩`, `⟨YYYY-MM-DD⟩`, and `⟨bug-slug⟩` from
the path step 4 actually wrote to, and `⟨dedup outcome⟩` with the words `new report` —
or, when step 1 appended to an existing report, with `appended to` followed by that
file's name — or, when the fortress ledger matched, with `matches` followed by the KI id.

```
✓ bug report written — nothing has been sent
  Report:  ⟨dir⟩/⟨YYYY-MM-DD⟩-⟨bug-slug⟩.md
  Dedup:   ⟨dedup outcome⟩
  Sending it (and any vendor follow-up) is yours to do.
```

When the `.gs-superadmin/fortress-dir` marker resolved (step 1), add the register line
below the block — the fortress ledger is the tracker whose loop closes, and the
report's `sent` / `acknowledged` record lives there. Substitute `⟨fortress⟩` with the
marker's path and `⟨report path⟩` with the file written; use `--ki ⟨KI id⟩` when step 1
named a match, else `--new --how-to-test "⟨one public-safe sentence⟩"`. The ledger's
register verb accepts a report only from under `⟨fortress⟩/ledger/upstream-feedback/reports/`,
so say so when the output directory is elsewhere (the user moves the file first):

```
  Register: node ⟨fortress⟩/plugins/gs-fortress/scripts/known-issues.mjs register ⟨report path⟩ --ki ⟨KI id⟩
```
