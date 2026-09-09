# Setup Phase 3 — scaffold mechanics

File-by-file mechanics for `/gs-superadmin:setup` Phase 3, in execution order.
The skill's Phase 3 outline says when to read each section, and its binding
invariants hold throughout this file. Catalog + cheatsheet generation and its
post-condition gate live in the skill itself, between §3 and §4 here — run them
there before starting §4. Every `.gs-superadmin/plugin/…` path below is the
workspace's link to the installed plugin (created in the skill's Phase 2), relative to
the working dir.
Facts here were verified against CLI v1.0.9 (this line is the stale-facts
checker's per-upgrade tripwire for this file).

## §1 User-editable template files — scaffolded with a vintage (bus F-396)

Run the scaffold writer:
```
node .gs-superadmin/plugin/scripts/scaffold.mjs apply
```
It maps every file under the plugin's `templates/` to `.gs-superadmin/<same path>` (the
`conventions/` pack only once adopted — §2) and keeps the pristine template of each under
`.gs-superadmin/scaffold/<same path>`, which is how it tells an edited copy from an
unedited one. Per file it does exactly one thing: copies a file the workspace lacks
(`copied`); refreshes an UNEDITED copy whose template moved (`refreshed`); records an
unmodified copy that predates tracking (`adopted`); or, for an EDITED copy whose template
moved (or an untracked copy that differs from the template), writes the new template
beside it as `<file>.new` and lists it under `offers` (`offered`). It never overwrites an
edited file, and a file the user removed stays removed. Relay the summary's `counts` in
one line (copied / refreshed / adopted / offered).

For EACH entry in `offers`, ask once, substituting the offer's `file` and `newFile`
values: "`<file>` has local edits and the plugin ships a newer template (a copy of the new
one is at `<newFile>`). **Replace** it with the new template, **keep** yours, or
**reconcile later**?" Then run the matching verb, substituting the offer's `rel` value
exactly as printed (e.g. `operating-model.md`, `conventions/naming.md`) — repeat the ask and
the command once per offer:
```
node .gs-superadmin/plugin/scripts/scaffold.mjs accept <rel>
```
```
node .gs-superadmin/plugin/scripts/scaffold.mjs keep <rel>
```
```
node .gs-superadmin/plugin/scripts/scaffold.mjs defer <rel>
```
`accept` = the new template replaces the file; `keep` = the file stays and the `.new` is
removed; `defer` = the file stays and the `.new` stays for the user to merge by hand. Every
answer is recorded (the pristine copy advances), so the question never repeats for that
template version. A first run after upgrading to a plugin with this step records the
workspace's existing files — unmodified ones silently, modified ones through the same ask.

## §2 Build-standards pack (opt-in, asked at most once per workspace)

Skip this step silently if `.gs-superadmin/conventions/` already exists **or** the marker
file `.gs-superadmin/conventions-pack-declined` exists **or** (a workspace declined before
plugin 0.36.2) `.gs-superadmin/CONVENTIONS.md` contains
`<!-- gs-superadmin: conventions-pack declined -->` — in that legacy case, also create the
marker file now, so the answer survives the next template refresh of CONVENTIONS.md.

Otherwise ask the user: "This plugin bundles a build-standards pack (query building, rule
naming syntax, report standards, deprecation process — editable starting point). Adopt it,
or start blank because your org has its own standards?"

- **Adopt** → run the scaffold writer once more with the pack flag; it creates
  `.gs-superadmin/conventions/` and copies the pack files (`copied`), and from then on the
  pack is in scope like every other scaffolded file — refreshed when unedited, offered when
  edited, left alone when the user deletes one:
```
node .gs-superadmin/plugin/scripts/scaffold.mjs apply --adopt-pack
```
- **Decline** → create the empty marker file `.gs-superadmin/conventions-pack-declined`
  (the same durable-marker shape as §5's `allow-rules-declined`) so future runs never ask
  again. Never record the answer inside `CONVENTIONS.md`: the scaffold writer owns that
  file and a later `accept` replaces it whole (bus F-403).

## §3 Reference bundle (always overwrite — must stay in sync with the installed plugin version)

- `.gs-superadmin/plugin/reference/ask-rules.json` → `.gs-superadmin/ask-rules.json`
- `.gs-superadmin/plugin/reference/version.json` → `.gs-superadmin/version.json`
- `.gs-superadmin/plugin/hooks/ask-overrides.json` → `.gs-superadmin/ask-overrides.json`
  (the guard's override list — commands whose catalog `mutating` flag is a verified
  upstream mislabel. Reference data only, never a control surface: the hook and
  `/gs-superadmin:change-request`'s guard-coverage step both read the plugin's own
  copy, and this always-overwrite step is what keeps a workspace's mirror from going
  stale across plugin upgrades — F-272.)

## §3b Generation fallbacks (only on a post-condition failure in the skill's generation step)

- Catalog **generation failure**: copy `.gs-superadmin/plugin/reference/catalog.json` →
  `.gs-superadmin/catalog.json` AND `.gs-superadmin/plugin/reference/cheatsheet.md` →
  `.gs-superadmin/cheatsheet.md`. Do not retry generation, and do not render a
  cheatsheet from the bundled catalog — that would only reproduce the bundled
  cheatsheet under a banner claiming it was generated; copy it instead. Show the user
  the failing script's error output, then report, substituting `<error summary>` with a
  one-line summary of that error (or "no error output — the script wrote nothing" when
  it failed silently): "Couldn't generate the catalog from the installed CLI
  (<error summary>). Using the plugin's bundled snapshot for both files instead — the
  mutation guard still works, against the bundled CLI version, and the copied files'
  headers name the docs repo's regeneration path; re-running setup replaces them with
  generated ones. Common fix: set `GS_ADMIN_PKG` to the CLI's install directory
  (bash: `export GS_ADMIN_PKG=/path/to/package`; PowerShell:
  `$env:GS_ADMIN_PKG = 'C:\path\to\package'`) if it isn't on the global npm root."
- Cheatsheet **render failure** (catalog generated fine): copy
  `.gs-superadmin/plugin/reference/cheatsheet.md` → `.gs-superadmin/cheatsheet.md` and
  tell the user the cheatsheet is the plugin's bundled snapshot while
  `.gs-superadmin/catalog.json` is generated — prefer the catalog for exact flags if the
  two disagree.

If a fallback **copy itself fails** (e.g. the destination is unwritable — the same cause
that can fail the render), do not retry or improvise: show the copy error, tell the user
the workspace is missing that file until the cause is fixed and setup is re-run, and
continue with the rest of setup.

## §4 Mutation guard (always merge — idempotent)

Mutating actions **prompt for approval** rather than being hard-blocked; the approval prompt
is the explicit per-action override path.

- **CLI lane — nothing to merge.** The plugin ships a PreToolUse hook
  (`hooks/gs-admin-guard.mjs`) that parses every `gs-admin` Bash command against the
  catalog's `mutating` flag and returns "ask" — regardless of global-flag order, domain
  aliases, or short paths. (The hook prefers the workspace catalog generated in the
  skill's generation step and falls back to the plugin's bundled snapshot, so its view
  matches the installed CLI.) It activates only in directories containing a
  `.gs-superadmin/` workspace, which this phase creates. The same hook also runs on
  PostToolUse and appends every executed guard-approved mutation to
  `<slug>/changes/JOURNAL.md` (the change journal), with its reported outcome.
- **Package-name spelling — deny rules** (same append-only merge as the MCP lane): add
  `Bash(npx @gainsight/gs-admin-cli*)` and `PowerShell(npx @gainsight/gs-admin-cli*)` to
  `permissions.deny` in `.claude/settings.json` (create the file/array if absent; add only
  entries not already present, never remove or rewrite existing ones). The guard arbitrates
  the `gs-admin` binary spelling; `npx @gainsight/gs-admin-cli …` runs the same CLI under a
  name the guard does not parse, so a mutation through it would reach only the harness's
  generic prompt, which cannot name the tenant. Denying it redirects to the sanctioned
  spelling instead. Deliberate limits: a flag-intervened form (`npx --yes @gainsight/…`)
  does not match a prefix rule, deny rules add no journal coverage, and settings entries
  are workspace-soft — cleaned settings or a setup that never re-runs drop them.
- **MCP lane**: read `.gs-superadmin/plugin/reference/ask-rules.json` and merge every
  `mcpTools` entry into `.claude/settings.json` under `permissions.ask` (create the
  file/array if absent). Append-only: add entries not already present; never remove or
  rewrite existing entries. If the bundle's MCP server name (the `mcpServer` key in the
  emitted `ask-rules.json`; set at build time via the build config's `mcpServerName`) was
  changed in a rebuilt bundle, any old `mcp__<old-server>__*` entries are harmless (they
  never match) — mention that the user may delete them, but do not do it automatically.

## §5 Read-lane allow rules (optional — ask once)

Reads dominate this plugin's workload (indexing, documenting), and without allow rules the
harness prompts for every shell command even though the guard passes reads silently.
Skip this entirely if both rules below are already in `permissions.allow` or the marker
file `.gs-superadmin/allow-rules-declined` exists. Otherwise ask the user once:

> Add `Bash(gs-admin:*)` and `PowerShell(gs-admin:*)` to this workspace's
> `permissions.allow`, so read-only gs-admin commands run without permission prompts?
> The mutation guard still prompts for every command the CLI catalog marks mutating, and
> for any command it doesn't recognize — a hook "ask" overrides an allow rule. Since
> CLI 1.0.8 the catalog's `mutating` flag is a written upstream contract and the old
> mislabeled-writer class is closed: every verified writer (the `re r` authoring
> surface, `dd t` template edits, the scheduling writers) is catalog-mutating and
> prompts. What you give up: genuine reads — including the ~20 non-mutating commands
> whose POST endpoints are read-shaped fetches, upstream-reviewed — lose the harness's
> generic shell prompt, and a FUTURE upstream mislabel would run without a prompt until
> the adoption audit or the ask-override mechanism catches it. The skills that issue
> writes (`audit`, `deprecate`, `change-request`) still get your explicit approval
> first; ad-hoc commands outside those skills would not. (Bulk captures route through
> the plugin's capture helper — a `node` script invocation these rules do not match —
> so those, like the plugin's other script runs, still prompt.)

- **Yes** → merge both rules into `.claude/settings.json` `permissions.allow` (create the
  array if absent; append-only, never remove existing entries).
- **No** → create the empty marker file `.gs-superadmin/allow-rules-declined` and don't
  ask again (the user can delete the marker to be re-asked on a later run).

## §6 `.gitignore` (append only if entries are absent)

Ensure the working-dir `.gitignore` (create if it does not exist) contains:

    # gs-superadmin KB — tenant-specific data, do not commit
    <slug>/
    .gs-superadmin/

Replace `<slug>` with the actual slug value. If an entry already exists, skip it.

## §7 CLAUDE.md managed block (write last — all scaffold files must exist before this fires)

Check for `<!-- gs-superadmin:start -->` in the working-dir `CLAUDE.md`.
- If absent: insert the block (create a minimal `CLAUDE.md` if the file does not exist).
- If present: replace only the contents between the markers, preserving everything outside.

Block content — render the **Known instances** list from *every* `*/_manifest.json`
found in the working dir, not just the tenant this run is setting up: repeat the
single `- \`<slug>/\` → <baseUrl>` line once per manifest (exactly as many lines as
manifests), substituting each manifest's values. Everything in the fenced block below
is literal output except the `<...>` placeholders — no annotations or placeholder text
may survive into the rendered CLAUDE.md. Re-running setup for a second tenant therefore
upgrades the block to list both.
```
<!-- gs-superadmin:start -->
## gs-superadmin workspace

**Read `.gs-superadmin/operating-model.md` now, before responding.**

- Known instances (KB folder → tenant):
  - `<slug>/` → <baseUrl>
- **Active instance = whatever `gs-admin whoami` reports.** Check it once when
  Gainsight work starts in a session (to pick the KB folder) and again after any
  instance switch — not before every command.
- Switch instances: `gs-admin config --base-url <url>` (tokens persist per tenant;
  re-login only if that tenant's token expired).
- Skills: `/gs-superadmin:setup` (bootstrap/resume) · `/gs-superadmin:refresh` (detect changes)
  · `/gs-superadmin:setup --deep <domain>` (full-ingest a metadata-stubbed shallow-crawl domain)
- Asset names may contain `|`, `&`, spaces, and other shell metacharacters — always
  single-quote free-text values in shell commands (`--search 'CS|Risk|Renewal|Alert'`).
<!-- gs-superadmin:end -->
```

## §8 Version agreement check (every run, after the generation step)

Compare `gs-admin --version` to `meta.cliVersion` in `.gs-superadmin/catalog.json`.
- If the catalog was **generated** this run, they match by construction; a mismatch means
  the extractor resolved a different install than the `gs-admin` on PATH — tell the user
  which two versions were found and that `GS_ADMIN_PKG` (or the PATH) needs untangling
  before the guard's view matches the CLI they're invoking.
- If the **fallback** copied the bundled snapshot, a mismatch is expected drift — the
  fallback report already told the user the remedy; nothing more to say here.

Whatever the catalog's provenance, `ask-rules.json` and `version.json` always reflect the
plugin's **bundled** CLI version. When the installed CLI is newer than the bundle, tell
the user: mutating MCP tools added by the newer CLI won't have `permissions.ask` entries
until the plugin updates — the CLI-lane guard is unaffected (it reads the generated
workspace catalog and fail-closed asks on anything it doesn't recognize). When the
installed CLI is *older* than the bundle, the generated catalog is honestly smaller:
commands this skill or others reference may not exist on the user's CLI, and
`describe-batch.mjs` will correctly refuse them — the remedy is upgrading the CLI, not
re-running setup.
