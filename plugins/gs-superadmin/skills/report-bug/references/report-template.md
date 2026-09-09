# Upstream bug report template ("prompt and problem")

This is the proven report format for `gs-admin` CLI bugs. The two fenced blocks below
are **literal output**: render them exactly, substituting only the `⟨…⟩` placeholders
per the rules here. Nothing else — no annotations, section reordering, or extra
headings — may be added inside a rendered report, except that a section with truly
nothing to say keeps its heading with the single line `None found.` (Workaround) or
`Not attempted.` (Reproduction steps, when reproduction was not safe to attempt).

## Substitution rules

- `⟨one-line title⟩` — the bug in one clause, symptom first (e.g. "`re r list --name`
  errors \"Nonexistent flag\" — name-filter flag is inconsistent across list
  commands"). Also the source of the file's `⟨bug-slug⟩`.
- `⟨reporter context⟩` — who/what hit the bug: the workspace and driver (e.g.
  "acme-sbx sandbox admin session, AI agent (Claude) in Claude Code").
- `⟨cli version⟩` — the INSTALLED CLI's version, from live `gs-admin --version`, and
  nothing else inside the backticks: the ledger's `register` verb lifts `observedOn` from
  exactly `` `@gainsight/gs-admin-cli@x.y.z` `` (a backtick right after the version), and
  observedOn means the CLI the bug was seen on. Cross-check it against `meta.cliVersion`
  in `.gs-superadmin/catalog.json` (the CLI the workspace reference was generated from);
  if they differ, say so in the Environment section as its own line ("workspace catalog
  generated from ⟨catalog⟩; installed ⟨live⟩") — never inside the CLI line's backticks
  (F-422: a report rendered with both versions there was refused by `register`).
- `⟨platform⟩` — OS and Node version (e.g. "win32-x64, Node v24").
- `⟨severity⟩` — one of `low` / `medium` / `high`, with a clause justifying it in terms
  of data risk and agent-workflow cost.
- `⟨status⟩` — reproducibility in one clause (e.g. "deterministic; confirmed live" or
  "intermittent — 2 of 5 attempts").
- `⟨summary⟩` — one paragraph: what was run, what happened, what was expected, and the
  working equivalent if one exists.
- `⟨environment lines⟩` — one `- ⟨fact⟩` line per environment fact, in this order: CLI
  package and version, platform, auth mode (if relevant), tenant base URL, date, and
  always ending with the line `- Driven by an **AI agent (Claude) in Claude Code**.`
- `⟨prompt and task context⟩` — the "prompt" half: quote the relevant human ask from
  the session, then state what the agent was doing when the CLI misbehaved and why it
  reached for the failing command.
- `⟨commands⟩` — every relevant command verbatim, one per line, in the order run;
  when a working equivalent was found, include it last under a `# working equivalent:`
  comment line.
- `⟨expected⟩` / `⟨actual⟩` — expected behavior in prose; actual output **unedited**
  in a fenced block (note elisions explicitly as `…⟨N lines elided⟩…`).
- `⟨repro steps⟩` — numbered minimal steps, one `1.`-style line each, repeated for as
  many steps as needed; each step is a command plus its observed result clause.
- `⟨reliability⟩` — attempts made, what varied, and whether it reproduces
  deterministically. State plainly if reproduction was not attempted and why (e.g.
  mutating command, no approval to re-run).
- `⟨impact⟩` — what this costs an AI-agent admin workflow (wasted turns, wrong
  conclusions, silent gaps) and any data-risk angle.
- `⟨workaround⟩` — the working alternative, or `None found.`
- `⟨date⟩` — today, `YYYY-MM-DD`.

````
# Handoff → Gainsight: ⟨one-line title⟩

**Reporter:** ⟨reporter context⟩
**CLI:** `@gainsight/gs-admin-cli@⟨cli version⟩` (⟨platform⟩)
**Severity:** ⟨severity⟩
**Status:** ⟨status⟩

---

## Summary

⟨summary⟩

## Environment

⟨environment lines⟩

## Prompt & task context (the "prompt" half)

⟨prompt and task context⟩

## Commands run (verbatim, in order)

```
⟨commands⟩
```

## Expected vs actual

**Expected:** ⟨expected⟩

**Actual (verbatim):**
```
⟨actual⟩
```

## Reproduction steps (minimal)

⟨repro steps⟩

## Reliability

⟨reliability⟩

## Impact (AI-agent admin workflow)

⟨impact⟩

## Workaround

⟨workaround⟩
````

## Additional occurrence (dedup append)

When step 1 of the skill matched an existing report, append this block to that file
instead of creating a new one. Substitute `⟨date⟩`, `⟨occurrence context⟩` (one
sentence: what task hit the bug this time), and `⟨commands⟩`/`⟨actual⟩` as above; end
with one sentence saying whether the new observation changes the Reliability section
(and update that section in place if it does).

````

---

## Additional occurrence — ⟨date⟩

⟨occurrence context⟩

```
⟨commands⟩
```

**Actual (verbatim):**
```
⟨actual⟩
```
````
