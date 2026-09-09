# Setup Phase 5 — documentation mechanics

The stub, `--deep` selection, manual per-asset path, report shapes, and
hand-chaining rules the skill's Phase 5 defers here. Every `.gs-superadmin/plugin/…`
path below is the workspace's link to the installed plugin (created in the skill's
Phase 2), relative to the working dir.
Facts here were verified against CLI v1.0.9 (this line is the stale-facts
checker's per-upgrade tripwire for this file).

## §1 Stubbing (shallow domains > 100 assets, and every list-only domain)

```
node ".gs-superadmin/plugin/scripts/manifest.mjs" stub --manifest <slug>/_manifest.json --file <phase-4 list file> --domain <domain> --id-field <f> --name-field <f> --out-dir <slug>/<domain>
```
One call per Phase 4 list file for the domain. The script writes one metadata stub per
asset, marks entries `documented` at depth `metadata`, and never touches an entry
already documented in full. Stubs are script output and do **not** consume the
documentation budget. (List-only detail the skill's rule rests on: `cn jobs` has a
`--describe` flag, but it resolves by first-name-match — too ambiguous for bulk
documentation, which is why jobs are stubbed rather than described.) The banner the
script writes is the doc's own completeness claim and follows the domain's recorded
describe command (three states — the summary's `describeState`): a recorded template
→ "full ingest" with the `--deep` pointer; a recorded `none` → "list-only (complete)";
nothing recorded → "completeness UNKNOWN", naming both ways to resolve it. A domain
whose stubs say UNKNOWN was indexed without the recording: re-run its Phase 4
`upsert-batch` with `--describe-command <template>` or `--describe-command none`, then
re-run `stub` — never edit the banner by hand.

## §2 `--deep` selection

Select the stubs awaiting full ingest instead of the normal batch:
```
node ".gs-superadmin/plugin/scripts/manifest.mjs" next --manifest <slug>/_manifest.json --domain <domain> --upgrade --limit <budget>
```

## §3 Manual per-asset path (what the batch script automates; for one-offs)

1. Run the domain's describe with the identifier passed as a flag — the recorded
   `describeCommand` in `domains_indexed` is the authoritative recipe; where none is
   recorded, `gs-admin --json <ns> <describe-cmd> --id <id>`, swapping `--id` for the
   domain's own addressing flag where it differs (the identifier cases are
   `index-scope-notes.md`'s first section; no `gs-admin` command accepts a bare
   positional argument). Capture the output to a file through the capture helper —
   Phase 4's invocation shape.
2. Write the output to `<slug>/<domain>/<id>.md` (structured markdown: name, id,
   summary, key fields, raw JSON in a code block; `<domain>` = the entry's manifest
   domain — the inventory key prefix, per Phase 4's naming rule). Every id shape
   1.0.4 payloads produce is filename-safe as-is; if an id ever carries a character
   outside `A-Za-z0-9._-`, don't improvise a sanitization — the scripts' rule
   (`doc-lib.mjs`, replacement plus a hash suffix) is deliberately not restated
   here, and **step 3's `--doc-path` is the recorded truth of where the doc
   landed**: readers resolve a doc from the manifest entry's `doc_path`, never by
   recomposing the name from `<id>`. Skip this step for email templates, journey
   programs, and data designers: the compact doc the batch script's
   template/program doc-mode (or the standalone renderers in
   `document-domain-notes.md`) writes IS the doc, and a designer doc is the
   three-level composite only the batch script's designer doc-mode writes — a
   hand-written designer doc has no `_kb` and reads as summary-only.
3. Flip the status — the script saves atomically, which is what makes interruption
   safe:
   `node ".gs-superadmin/plugin/scripts/manifest.mjs" mark --manifest <slug>/_manifest.json --key <key> --status documented --doc-path <the step-2 file path>`
   (`--doc-path` records where the doc landed, so a later rekey's `remove` can
   report the stale file for cleanup — the batch script records it automatically.)

If the describe command fails for an asset:
`… mark --manifest <slug>/_manifest.json --key <key> --status failed --error "<short message>"` — then continue with the next asset.

## §4 Budget-report shapes (after Phase 5 hits the budget limit)

- "Documented N assets. M remaining (pending/stale). F permanently failed. Re-run
  `/gs-superadmin:setup` to continue, or use `--budget N` / `--all`." Keep the two
  counts separate: `failed` entries are a terminal state this skill deliberately
  produces (un-describable assets, the known scorecard auth race), not work still
  queued.
- On a shallow crawl, also list the stubbed domains that have a describe command:
  "Metadata-only (shallow): <domain> (<count> stubs) — full ingest:
  `/gs-superadmin:setup --deep <domain>`." List list-only domains separately as
  "List-only (complete): <domain> (<count>)" — never advertise `--deep` for them.

## §5 Hand-chaining several describes

If you chain several by hand, compose **semicolon-chained literal commands** —
never a `for`/`foreach` loop (a chain shows every literal command for approval; a loop
construct hides them and always prompts) — decide skips at
composition time by checking which output files exist, never with shell-level `test -f`
guards inside the chain (they break the allow-rule prefix match and force prompts), and
keep the describes sequential.
