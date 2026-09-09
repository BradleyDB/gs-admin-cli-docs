# AGENTS.md — rules of record for AI-assisted contributions

Terse and imperative by design: this file is meant to be loaded into an AI coding
assistant's context. The narrative version (why these rules exist, setup, PR process)
is [CONTRIBUTING.md](CONTRIBUTING.md). Repo orientation is [CLAUDE.md](CLAUDE.md).

## Mental model (one paragraph)

`gs-admin` is an **artifact-driven** CLI: 8 JSON manifests in the installed npm package
declare every domain action, and each action becomes both a CLI command and an MCP tool
with the same handler. This repo extracts those manifests into `data/catalog.json` (the
**single source of truth**), generates human docs and a wiki from it, and ships
`plugins/gs-superadmin/` — a Claude Code plugin whose mutation guard, cheatsheet, and
ask-rules all derive from that same catalog.

## Generated vs hand-maintained — check before editing ANY file

| Path | Status | Regenerate with |
|------|--------|-----------------|
| `data/catalog.json` | GENERATED | `npm run build:catalog` (needs the pinned CLI installed globally) |
| `reference/domains/*.md` | GENERATED | `npm run build:reference` |
| `wiki/index.html` (~500 KB — never read it whole) | GENERATED | `npm run build:wiki` |
| `wiki/comparison-guide.html` | GENERATED (from the hand-maintained `reference/comparison-guide.md`) | `npm run build:comparison` |
| `plugins/gs-superadmin/reference/*` | GENERATED | `npm run build:plugin:gs-superadmin` |
| `plugins/gs-superadmin/scripts/extract-catalog.mjs` | GENERATED (verbatim copy of `build/extract-catalog.mjs`) | same |
| `plugins/gs-superadmin/scripts/render-cheatsheet.mjs` | GENERATED (verbatim copy of `build/render-cheatsheet.mjs` — the one cheatsheet emitter, shared with the repo build) | same |
| `data/reader-shapes.json` | GENERATED — the plugin's READ SURFACE: per CLI command, the payload keys the KB readers dereference, MEASURED by running every reader over the shared fixture corpus under a recording Proxy (`plugins/gs-superadmin/test/trace-reader-shapes.mjs`); a cross-repo contract the gs-fortress CLI-watch audit reads (`schemaVersion` bumps on any structural change). A reader that reads a new key or drops one changes this file in the same PR — regenerate, never hand-edit | `npm run build:reader-shapes` (no CLI needed — it reads the committed catalog) |
| Everything else — `build/`, the repo-root `test/` (the shared test rig — plumbing only, GP-B5 DS-22), plugin `skills/` `hooks/` `templates/` `test/` and plugin `scripts/` (every script except the two verbatim copies in the rows above), `reference/` concept docs + `workflows/`, READMEs + the plugin's `MAINTAINERS.md` | hand-maintained | — |

Generated files carry a "GENERATED FILE — do not edit by hand" banner, and CI rejects
hand-edits via a rebuild-and-diff check. To change generated content, edit the generator
in `build/` and regenerate.

**Version-citation convention in hand-maintained prose** (established at the 1.0.6
adoption, 2026-07-28): a `v`-prefixed CLI version (`vX.Y.Z`) asserts a CURRENT-version
claim — `build/check-stale-facts.mjs` requires it to equal the pinned `meta.cliVersion`,
so every such citation trips CI on the next upgrade and forces a human re-check. A BARE
version (`X.Y.Z`) records historical vintage ("observed on 1.0.4") and is deliberately
invisible to the checker — it stays true as written forever. Consequences: date a live
observation with the bare form, but keep at least one `v`-prefixed citation on any doc
or section whose claims must be re-verified per upgrade (e.g. the operating-model
known-issues header). Per-fact upgrade review is owned by the external CLI-watch audit
(the gs-fortress repo), which diffs every release against the pin; the checker's tripwire
is the belt to that suspenders.

Inside a **verbatim quotation** — an archived prompt string, a quoted file line, a captured
program output — do NOT demote the prefix to make the checker pass. That silently rewrites
what the quoted source actually said, and where the surrounding text reasons about the
prefix it leaves the record self-contradictory (F-103: an archive paragraph ended up
quoting a bare literal and then certifying that the `v`-anchored pattern matched it).
Demotion remains right for descriptions that merely *name* a version ("citing 1.0.4").
Two cases, because the demotion pass runs at EVERY CLI adoption:

- **`dev/FEEDBACK-archive.md` is exempt from the citation checks entirely**
  (`CITATION_EXCLUDE` in the checker). It is append-only frozen evidence and cannot hold a
  current-pin claim by construction, so quote it exactly as recorded — prefix and all — and
  never edit an archived version or count to make a guard pass. That exemption exists so
  the file can keep the promise its own header makes.
- **Everywhere still scanned** (the live `dev/FEEDBACK.md` bus, tracked docs), write a
  quoted version as `[v]X.Y.Z`: the brackets are an editorial marker, and the checker's
  pattern requires a digit straight after the `v`, so it does not match while the quotation
  stays faithful. Use it ONLY inside a quotation — it suppresses the tripwire for any
  literal, including a current one, so outside quotations it is a way to hide real drift.
  Note the bracket only defeats the `vX.Y.Z` pattern. The count patterns (`N CLI commands`,
  `N MCP tools`, `N named operations`, `N defined tools`) and `pkg@X.Y.Z` have **no** marker,
  so in a scanned file a verbatim quote of an old count or install command has to be
  reworded out of the literal form — describe the phrase instead of spelling it. Both this
  file and the bus have had to do exactly that; it is friction, not a defect, and the
  alternative (a marker per pattern) would widen the blind spot for no real gain.

## Design tenets — deliberate decisions that look like bugs. Do not "fix" them.

1. The mutation guard **asks, never blocks**. Never return `permissionDecision: "deny"`
   for a mutating command — the approval prompt IS the override path. (Two coaching
   exceptions deny a *first* offense with a rewrite hint and escalate to ask on repeat:
   the shell-safety lint (unquoted `|` / lone `&` from asset-name fragments; `&&` is
   never touched) — the command is broken as written — and the variable-subcommand
   coaching — `gs-admin $cmd` can't be inspected. A deny that can't be durably recorded
   asks instead, so nothing is ever denied forever.)
2. Error-handling asymmetry in the guard hook is deliberate: **fail-open on the hook's
   own failures** (never break plain `gs-admin` use), **fail-closed on unrecognized
   gs-admin commands** (ask — a newer CLI's mutation must not slip through silently).
3. The hook may only ever **add** an "ask" — never grant an allow. The trust model for
   the workspace catalog depends on this.
4. **`_manifest.json` values are untrusted input.** Clamp anything from them (printable
   ASCII, 80 chars) before it reaches a permission prompt.
5. **Zero dependencies.** Node built-ins only, everywhere: build scripts, hook, manifest
   script, tests. Never add a package. One ratified carve-out (Bradley, 2026-09-01,
   GP-B5 DS-42): two CHECKER-ONLY direct devDependencies, `typescript` + `@types/node`
   — what the two pins pull, measured (W8.5/DS-51, TypeScript 7.0.2 + @types/node
   20.19.43): `@types/node` one transitive typings package (`undici-types`);
   `typescript` its own per-platform compiler binaries as optional dependencies
   (`@typescript/typescript-<platform>`, all in the lock, one installed per host);
   nothing else, and nothing direct — behind the `tsc --noEmit`
   JSDoc-contract gate (`tsconfig.json`, `npm run typecheck`, the docs-drift
   workflow). Bright lines: the checker is invoked-only (CI + on demand); nothing in
   `build/`, `scripts/`, or `hooks/` may import from it; uninstalling it changes
   nothing but the gate. `build/check-imports.mjs` enforces both halves as data — bare
   specifiers are forbidden tree-wide, and package.json may declare exactly those two
   devDependencies and no `dependencies`. The gate is NON-STRICT by decision: it checks
   what is annotated or inferable — an unannotated parameter is `any` and unchecked,
   and `?string` nullability is documentation except where the **strictNullChecks
   ratchet** has reached (started 2026-09-02, GP-B5 W8/DS-46): `tsconfig.strict.json`
   extends the base with `strictNullChecks: true` over an explicit `files` list —
   `doc-lib.mjs`, `capture.mjs` and `journal-lib.mjs` (capture's import) first — and
   `npm run typecheck` runs the base config, then `build/check-strict-list.mjs`, which
   runs the strict program once and proves the list IS the surface: tsc checks every
   file a listed one imports, so the program's local files must EQUAL the list (a
   transitive file is admitted by naming it, never by accident), and every file in
   the gate's `STRICT_FLOOR` must still be listed. Ratchet rule: **a file enters the
   strict list and never leaves** — the floor is that rule as data; the list only
   grows, one file per small change, each admission re-verifying that file's T-1/T-2
   nullability claims against the emitter (house rule 13); the base config is never
   flipped tree-wide. "tsc green" means green where annotated, not shape-safe — and
   null-safe only inside the strict list.
6. New behavior derives from **the catalog**, never from hardcoded command lists. One
   sanctioned exception (approved by Bradley, 2026-07-11): `hooks/ask-overrides.json`, a
   hand-maintained list that forces "ask" on commands whose catalog `mutating` flag is a
   **verified upstream mislabel** — each entry is version-scoped to the CLI version it was
   verified on and self-retiring (it applies only while the live catalog still shows the
   mislabel), and overrides can only ever ADD an ask, never remove or downgrade one
   (tenet 3 applies).
7. The plugin — the guard hook and the link script alike — is **inert outside
   `.gs-superadmin/` workspaces** and must never countermand `gs-admin` used on its
   own. (`scripts/plugin-link.mjs`, run by the `SessionStart` hook, touches nothing
   when cwd has no `.gs-superadmin/` directory — GP-B5 DS-43.)

### Architecture principles (A-1..A-11)

Adopted at the GP-B5 architecture program's C1 review (2026-08-16, Bradley;
maintainer archive holds the full arguments). Condensed by design — each line is
the rule plus why it exists.

- **A-1 · Define once, derive everywhere.** The fix-one-copy-miss-the-sibling
  class dominated the finding corpus and is design-preventable; every
  consolidation cites it. Its limit is A-2.
- **A-2 · Deliberate duplication names its sync mechanism.** A copy that must
  exist (self-containedness tenets, dual-lane byte-identity) is registered with
  the mechanism keeping it honest — comment-only sync is the weakest tier:
  promote it or accept the risk explicitly (`build/check-doc-drift.mjs` check 9
  is the pattern).
- **A-3 · Parse, don't validate — with honesty stats.** Every JSON boundary
  parses defensively and reports seen-vs-parsed counts instead of silently
  skipping (F-228); typedef headers are the static half of this rule.
- **A-4 · No silent anything.** Fail loud; withhold rather than guess; record
  "could not look" as its own state (F-218); structured parts over prose blobs;
  null-prototype folds for model-authored keys (F-225).
- **A-5 · Construction > checking > prose, where tenets allow.** A rule carried
  by code structure beats a CI check, which beats prose teaching — shared-code
  portability rules stopped recurring; prose-taught rules kept regressing.
- **A-6 · Output-identity locks; differential test before any collapse.** A
  refactor proves byte-identical output (rebuild + `git diff --exit-code`);
  collapsing hand-synced copies requires a differential test proving agreement
  BEFORE the collapse.
- **A-7 · Contracts live at the producer, as checkable artifacts.** A shape
  consumed in N places is written once, at the file that produces it — the
  FROZEN typedef headers (catalog, manifest, KB docs, journal, hook payload)
  are this rule executed.
- **A-8 · Prose = judgment · scripts = mechanics · hooks = enforcement · CI =
  consistency.** A SKILL.md walking the model through a deterministic procedure
  is a script wearing prose; move it.
- **A-9 · Parse the grammar, don't tune the pattern.** A matcher needing its
  second boundary tune has the wrong model — redesign, don't widen.
- **A-10 · Single-writer ownership for durable state.** Any durable record gets
  exactly one writer from birth (`scripts/manifest.mjs`'s atomic-write monopoly
  is the precedent).
- **A-11 · Already-law reaffirmations.** Mutation-proof gate, checked
  time-sensitivity, mechanical-check closure, guard fail-open/fail-closed
  asymmetry, bulk-data-never-in-context: every change preserves all five.

### Considered and rejected — do not re-propose without new evidence

Adjudicated at the same C1 review; each row records what was rejected, why, and
the kernel kept instead.

| Rejected | Why | Kept kernel |
|---|---|---|
| Class hierarchies / OOP-first design | zero corpus findings with an OOP cure | factory functions + plain data + typedef contracts |
| DI containers / injected-double architecture | the no-import tenets forbid imports exactly where DI would inject | parameter-level injection |
| Runtime deps, frameworks, or an in-house general validator | zero-dependency tenet 5; no-install deployment | typedef contracts + runtime honesty stats (A-3) |
| Full TypeScript (any compile-step shape) | breaks dual-lane byte-identity and ship-as-source | JSDoc + `tsc --noEmit` `checkJs` shape, gated separately |
| "Design can buy test honesty" | the fixture-gap finding class is 0% design-preventable | the procedural mutation-proof gate; a shared test rig priced as maintenance only |
| Consolidating tenet-locked duplicates | the tenets ARE the design; the copies are the cost of self-containedness | strengthening a copy's sync mechanism stays fair game |
| A separate ADR directory | a second decision home drifts from the enforced one | decisions live where their enforcement lives (Review-gate rules) |
| Schema files + a validator artifact | a third artifact nothing executes | contracts-as-data inside the enforcing check/script |

## Writing skills (SKILL.md files are executed by an LLM — ambiguity is a bug)

- Fenced blocks are **literal output**. No annotations, arrows, or meta-instructions
  inside them; render rules go in the prose above the fence.
- Every placeholder needs an explicit substitution rule, including how it repeats for
  N items.
- The operating model, the managed CLAUDE.md block, and the cheatsheet are loaded into
  the same session: statements about the same topic must agree. Grep for the topic
  across `templates/`, `skills/`, and the cheatsheet renderer before editing any one.
- Bulk JSON goes through `scripts/manifest.mjs` / `scripts/describe-batch.mjs` and files
  on disk — never through model context.
- Ask-once interactions need a durable marker (manifest field or marker comment) so
  re-runs stay idempotent and never re-ask.
- **Paraphrase-plus-pointer — one canon per rule** (GP-B5 C1, 2026-08-16): when the
  same rule must appear in several skills, exactly one site carries the canonical
  statement; every other site carries a one-line paraphrase plus a pointer to the
  canon — never a full second copy (it drifts), never a bare pointer (context-blind).
- **Address bundled scripts as `.gs-superadmin/plugin/…`, never the placeholder**
  (GP-B5 DS-43, 2026-09-04): `node .gs-superadmin/plugin/scripts/<x>.mjs …` — a
  relative forward-slash path every tool shell resolves, through the directory link
  `scripts/plugin-link.mjs` maintains (created by setup, refreshed by the
  `SessionStart` hook to whatever plugin the loader actually loaded). The
  `${CLAUDE_PLUGIN_ROOT}` placeholder is substituted by the plugin loader only and
  expands to empty in bash AND PowerShell when a literal survives (F-175); it has
  exactly two homes — `hooks/hooks.json` and setup's first-run link fence — and
  `build/check-doc-drift.mjs` check 10 reds it anywhere else by name, and reds any
  REFERENCE to the retired warning by its vocabulary (the check's phrase list is the
  data; F-387 reopen: a rewrite that deletes a canon by its token leaves the sentences
  that point at it, and those then instruct the opposite of the link bullet). Reference
  files and prose paths for the model to READ use the same link path.

## Testing — never against real state

- **Never run `gs-admin login`, `gs-admin config`, or any mutating command against a
  real tenant or the real `~/.gs-admin/` during development.** Use the fixture harness;
  it builds fake workspaces in the OS temp dir.
- Verification commands (run all that apply before opening a PR):

```bash
node plugins/gs-superadmin/test/guard-fixtures.mjs
node plugins/gs-superadmin/test/guard-oracle.mjs
node plugins/gs-superadmin/test/manifest-init.mjs
node plugins/gs-superadmin/test/manifest-ops.mjs
node plugins/gs-superadmin/test/domain-candidates.mjs
node plugins/gs-superadmin/test/describe-batch.mjs
node plugins/gs-superadmin/test/relationships-build.mjs
node plugins/gs-superadmin/test/template-doc.mjs
node plugins/gs-superadmin/test/program-doc.mjs
node plugins/gs-superadmin/test/journal-ops.mjs
node plugins/gs-superadmin/test/change-request-fixtures.mjs
node plugins/gs-superadmin/test/report-bug-fixtures.mjs
node plugins/gs-superadmin/test/jo-report.mjs   # + test/jo-report-<mode>.mjs siblings as modes land (CI globs jo-report*.mjs)
node plugins/gs-superadmin/test/tenant-deps.mjs
node plugins/gs-superadmin/test/er-count.mjs # email-report page-entry counter (GP-B5 DS-29 — shipped from the skill's inline transcription)
node plugins/gs-superadmin/test/er-gaps.mjs  # email-report gap work-list builder (same DS-29 pair)
node plugins/gs-superadmin/test/capture.mjs # the shipped capture helper: clean-write + normalize encodings, failure honesty, and the shared read-only gate in its capture parameterization (DS-17)
node plugins/gs-superadmin/test/doc-lib-fixtures.mjs # DIRECT suite for the portability layer + shared helpers (kills the F-113 mutant class at the definition site)
node plugins/gs-superadmin/test/contract-conformance.mjs # executes T-1/T-2/T-3/T-4 against produced artifacts (manifest verbs + catalog key sets + stub-marker pins + journal entry grammar through both real writers)
node plugins/gs-superadmin/test/plugin-link.mjs # the workspace plugin-link writer (DS-43): create / no-op / repoint stale + dangling / refuse a real directory untouched / target survives removal / target from self never from env / check-ignore belt reports never fails / hook-mode JSON exit 0 on failure / CLI failure non-zero / the SessionStart hooks.json entry
node plugins/gs-superadmin/test/scaffold.mjs # the workspace scaffold writer (F-396): fresh / current / refreshed (unedited, template moved) / offer (edited, template moved → .new beside it, never overwritten) / accept-keep-defer record the answer once / legacy adopt / removed stays removed / pack only when adopted / check is read-only / CRLF-insensitive hashing
node plugins/gs-superadmin/test/trace-reader-shapes.mjs # the reader-shape MEASUREMENT (CLI-adoption arm): engine self-tests with their mutants, then every KB reader traced over the shared corpus — every command observes keys, every finding-backed floor key is still read, the JSON-parsing-script enumeration closes both ways (row or rule-out; every named file exists)
node build/test-comparison-html.mjs   # comparison-HTML generator parsing fixtures + fail-loudly + byte-stability
node build/test-emit-reader-shapes.mjs # the read-surface emitter: committed data/reader-shapes.json equals a fresh emission, byte-stable, catalog-joined, floors present; refuses an unknown command; the tracer's floor / enumeration / dropped-reader reds driven from outside
node build/test-wiki-html.mjs         # wiki generator rendering fixtures + outbound-anchor resolution + byte-stability + the T-9 v4 grammar pins (the ONE block parser + inline core in build/lib.mjs, each pin mutation-proved in memory — run it after any edit to lib.mjs's grammar or either generator's renderer)
node build/test-render-cheatsheet.mjs # the one cheatsheet emitter: repo/workspace lane parity + rendering fixtures
node build/test-check-instance-data.mjs # the instance-data gate itself: UTF-16 files are decoded and scanned, skipped-binary accounting
node build/test-check-stale-facts.mjs # the stale-facts gate itself: bus code-context exemption (F-275/F-328) — indented quotes exempt, line-leading fences refused, prose stays checked, bus-only; the W10 handoff conventions (Blind spots line, pred: rows, Class: keys, Sibling sweep)
node build/test-extract-catalog.mjs   # the dual-lane catalog emitter: fixture-package derivations + T-1 conformance on the committed catalog
node build/test-defect-classes.mjs    # the defect-class DETECTORS in memory (milliseconds): detectRow/callClose over every mechanical row, exact hits per decision point (F-364, F-365)
node build/test-check-doc-drift.mjs   # the doc-drift gate itself: green baseline on the real tree, then per-check mutants must go red (incl. check 19's CONSUMER pins: the F-365 site, allowances, unreadable files, the scope floor)
node build/test-check-imports.mjs     # the import-graph gate itself: lexer + declaration tables (the W0 mutation battery, committed)
npm run typecheck                     # the JSDoc-contract type gate (tsc --noEmit, checkJs): T-1..T-9 checked wherever a consumer is annotated — needs `npm ci` once (the tenet-5 carve-out's two checker-only devDependencies); then build/check-strict-list.mjs runs the strictNullChecks ratchet (tsconfig.strict.json) once and proves its two invariants — the strict program's files EQUAL the list, and no floor file has left it
node build/test-check-strict-list.mjs # the strict-list gate itself: a listed file pulling in an unlisted import, and a floor file dropped from the list, both go red (needs `npm ci`, like the gate)
node build/build-plugin-gs-superadmin.mjs   # rebuild the plugin bundle… (two lines, not `&&`: PS 5.1 can't parse `&&`)
git diff --exit-code plugins/gs-superadmin  # …then: the rebuild produced no drift
claude plugin validate ./plugins/gs-superadmin --strict
claude plugin validate . --strict
node build/check-stale-facts.mjs   # hand-written docs cite the current CLI version/counts, spell flags as the catalog does, and relationships-build's SEMANTICS_BASIS cites the pin; the live bus carries the W10 handoff conventions
node build/check-doc-drift.mjs     # skill lists + invocation labels in READMEs match the plugin; dev-only content contained; test suites all listed here; defect-class rows swept tree-wide (check 19, build/defect-classes.mjs)
node build/check-imports.mjs       # every real import edge matches the declared layer graph (lanes, zero-import files, dual-lane import-free rule — the declaration lives in the check as data)
node build/check-instance-data.mjs # nothing tenant/instance/org-specific committed
npm run build   # only when build/ scripts or the catalog changed (needs the pinned CLI).
                # Editing docs a generator EMBEDS (reference concept docs + workflows → wiki;
                # comparison-guide.md → its HTML) also changes generated output: run the five
                # derived generators CI's drift job runs (no pinned CLI needed — they read the
                # committed catalog): build-reference, build-wiki, build-comparison-html,
                # build-plugin-gs-superadmin, emit-reader-shapes. This list, CLAUDE.md's and
                # README.md's are held to package.json's build script by check-doc-drift
                # check 21 (F-407) — edit package.json first, then the prose it reds.
```

- **Probing the guard hook directly** (tester sessions, bus verifications — the recipe
  every session otherwise re-derives from the hook source): drive it with Node
  `spawnSync(process.execPath, [hook], { input: JSON.stringify(payload), encoding:
  "utf8" })` — never by piping a string from PowerShell: its pipe re-encodes stdin
  (BOM + CRLF prepended/appended), which silently no-opped every payload until the hook
  learned to tolerate the BOM, and the lane remains untrustworthy for byte-exact
  probes. The payload's `cwd` must
  sit inside a directory containing `.gs-superadmin/` (throwaway temp dir), which may
  omit `catalog.json` to exercise the plugin's bundled fallback; the PRODUCTION half of
  a prompt expectation needs a sibling tenant dir whose `_manifest.json` records
  `"environment": "production"`; and ask reasons cite the resolved canonical catalog
  path (`journey programs save`), not the alias spelling the probe used.
  If the probe includes the PostToolUse/journal half, the hook is NOT self-contained
  there: it imports `../scripts/journal-lib.mjs` at runtime, so a hook-only scratch
  copy answers PreToolUse correctly but can never write a journal — an absence that
  reads exactly like a journaling defect (F-212: it faked the pre-fix F-194 symptom
  during a verification round). Copy the plugin's `scripts/` dir alongside the copied
  hook, or drive the hook in place. The failure IS loud — stdout carries a
  `systemMessage` naming the missing module, pinned by the guard-fixtures
  "missing journal-lib degrades to systemMessage alert" check — so read the probe's
  raw stdout before concluding "no journal".

- To rebuild, install the **pinned** CLI version from `data/catalog.json`
  `meta.cliVersion` — never `@latest`, which upgrades what the repo documents and
  dirties every generated artifact.

- Bump `plugins/gs-superadmin/.claude-plugin/plugin.json` `version` on any user-visible
  plugin change, and add a matching entry to `plugins/gs-superadmin/CHANGELOG.md`.
  Documentation-only changes need neither — unless they change SHIPPED plugin bytes
  (a comment edit inside a shipped plugin file counts): any shipped-byte change bumps
  and logs, however doc-only it reads (decree, Bradley 2026-08-16, GP-B5 W0; precedent
  0.31.3 / 0.31.4 / 0.31.8, each a header-or-comment-only shipped change).

## Review-gate rules (closing findings durably — F-160)

- **Contracts as data** (GP-B5 C1, 2026-08-16): a site list or enforcement table a
  check consumes is carried as data inside the check (or a file the check reads),
  never as prose the check re-parses — prose lists go stale (the F-159 class).
  `build/check-imports.mjs`'s layer declaration is the pattern.
- **Decisions live where their enforcement lives** (GP-B5 C1, 2026-08-16): a design
  decision is recorded at the site that enforces it — a tenet line in this file, a
  register/declaration entry inside the enforcing check, a WONTFIX ruling on the bus —
  never in a separate decision directory, and not in a generated index either (the
  DS-21 part 3 index was measured and cut 2026-09-07: the homes below hold about fifty
  entries, most of them in this file, and a rendered table would re-list them for no
  consumer). Discovery hint — enumerate by home, each greppable by its own shape:
  the numbered items of "Design tenets" (a dated exception inside one reads
  "approved by …, date" or "ratified … (Bradley, date)"); the `A-n ·` bullets of
  "Architecture principles"; the rows of the "Considered and rejected" table; the
  `Class: <key>` bullets under "Defect classes are registered where a check reads
  them" below; and the register tables inside the checks — any `const` in
  `build/*.mjs` whose rows carry an `id`/`why` or whose name reads `SANCTIONED_*`
  or `*_FLOOR` — e.g. `RESTRICTED`, `SANCTIONED_DYNAMIC` and `LAYERS` in
  `check-imports.mjs`, `SANCTIONED_PORTABILITY_COPIES` in `check-doc-drift.mjs`,
  `STRICT_FLOOR` in `check-strict-list.mjs`, `DECLARED` in `sweep-twins.mjs`, the rows of
  `build/defect-classes.mjs`; examples, never the roster — the tester's shape sweep at
  the 0.36.3 gate found two the first hand list omitted, so enumerate by the shape. WONTFIX rulings are the seventh home — sections whose
  header matches `^## F-.*WONTFIX` on `dev/FEEDBACK*.md` (the dash is em or hyphen
  by era, so never anchor on one: an em-dash-only pattern finds 4 of 13) — and
  dev-branch only: the public tree's bus starts empty, so finding none there is
  expected.
- **Shared prose sits on the highest rung that fits it — and rung 0 is to remove the
  cause** (GP-B5 DS-43, 2026-09-04): a rule several skills must carry lives at one of
  these places, chosen top-down; "can't import at runtime" is a fact, not a limit.

  | Rung | Mechanism | Fits when | In the tree |
  |---|---|---|---|
  | 0 Remove the cause | change the mechanism so the rule has nothing to say | the rule warns about a failure the design can make impossible | the workspace plugin link retired the seven-skill surviving-literal family (DS-43) |
  | 1 Enforcement | a hook checks it at the tool-call boundary | decidable from the command, and the plugin is loaded when it matters | the mutation guard, the pipe-safety lint |
  | 2 Code | a script every skill calls | a deterministic procedure | GP-B3: `--paginate` retired 5 prose sites |
  | 3 Session-global doc | one statement every session reads | applies session-wide and the doc exists by then | `templates/operating-model.md`, the managed CLAUDE.md block |
  | 4 Build-time expansion | one fragment rendered into each file | text must be physically present per independently loaded file | shelved with a trigger (DS-43 note §8): a prose family with a recorded drift finding that cannot move to rungs 0–3 |
  | 5 Checking | hand copies held to a shape by a check | copies must differ per site | check 16 (token pre-flight) |
  | 6 Prose discipline | paraphrase-plus-pointer | small, judgment-laden, low churn | the ground-rules blocks (2 sites, 0 findings) |

- A finding whose What is a **doc-vs-tree contradiction** is not closed by correcting
  the prose: land the mechanical check that locks the claim to the tree in the same
  fix, or state in the Fix note why the claim is not mechanically checkable.
  (`build/check-doc-drift.mjs` checks 5 and 9 are the pattern; the F-151/F-158 pair —
  the same sentence stale twice, the second time inside the commit that rewrote it —
  is what prose-only closure produces.)
- A verification probe that **discovers a defect** or **verifies a whole-tree claim**
  is a guard prototype, not scratch: the Fix/Verified note must record whether the
  probe should be promoted to a committed check, and log a finding when it should.
  (The tree sweep that found F-158 became check 9.)
- A round is **assessed from open PRs as well as the dev log** (`git log` plus
  `gh pr list`) — a fix riding an unmerged branch is invisible from dev alone. And the
  role that lands a fix on an unmerged PR says so **in a bus comment on dev** — branch
  and PR number — not only inside the entry's Fix note on that branch. (F-161: a fix
  recorded only on its own unmerged branch was re-implemented from scratch, with a
  reworked PR, by the next session.) The pointer covers **every status transition, not
  just FIXED** — it is re-stamped whenever the branch's statuses change: a verdict
  (VERIFIED, or back to OPEN), a WONTFIX — so the dev view never lags a transition
  behind the branch. (F-223: three verdicts riding PR #76 read OPEN from dev under a
  pointer still saying FIXED — the F-161 hazard reproduced one transition later.) The
  same pointer **claims the finding number(s) its branch consumes, at logging time,
  not at merge**; and a session picking a next number takes the max across both
  `^## F-` section headers and the numbers claimed in header comments, after a fresh
  pull. (The F-215 collision: two concurrent branches each took the same announced
  next number, and the losing entry had to be re-logged as F-223.)
- **Every open PR to `dev` is named at a session's kickoff and close-out, bot PRs
  included** (`gh pr list --base dev`), each with its check state, and a red one is
  DISPOSITIONED — merged, closed with a reason, or carried forward explicitly in the
  handoff — never left unmentioned. `dev` has no branch protection, so a red PR blocks
  nothing and alerts no one: it just sits. (B12, 2026-09-02: Dependabot's first npm PR
  opened two minutes after a release, red on the type gate, and sat through a whole
  wave whose first command had listed it. The bump was a TypeScript major whose
  strict-by-default setting silently reversed the recorded NON-STRICT decision —
  which is why `tsconfig.json` now states `strict` explicitly, and why majors arrive
  as their own PRs to be adopted deliberately rather than bundled or ignored.)
- An **"Actions isn't running" symptom is a mergeability check first**, not a platform
  outage: a PR in CONFLICTING state gets no `pull_request` check suite at all — the
  merge ref cannot be computed, so GitHub silently creates no suite, no run, no
  failure. `gh pr view <n> --json mergeable,mergeStateStatus` answers it in one call;
  resolve the conflict (the bus's section format merges by keeping both sides) and the
  suites fire on the next push. (The 2026-08-09 round spent an empty-commit nudge and
  a close/reopen theory on what was a conflicted bus file.)
- A guard or fixture landed to close a finding is **not accepted until it is
  mutation-proved to FAIL** on the defect it claims to catch, and the Fix note records
  the mutant. A guard design proposed in a bus entry or a review comment is a
  **hypothesis to validate, not a spec to implement literally** — where the shipped
  shape differs from the proposed one, the Fix note says so and why. Same standard for
  coverage: **"no existing suite catches X" is a mutation-test result**, not an
  inference from reading the suites. (F-188 proposed a fixture whose every pass saw the
  same two ids in the same order, so a writer regressed to an in-run-only Set passes all
  four of its assertions — readable, green, and locking nothing; the same entry's
  coverage claim named a regression the existing unit checks already caught while
  missing the arrangement that genuinely escaped every suite. F-189 is what that pair
  cost, and it was caught only because the implementing session mutation-tested the
  draft instead of trusting the design.)
- CI evidence for an **advisory or canary leg is read per JOB, not from the run
  conclusion**. A leg running `continue-on-error` cannot fail its run, so
  `gh run list` reports `success` for a run whose canary leg went red; verify a
  rollout with `gh run view <run-id> --json jobs` and read each leg's own
  conclusion. (Wave 5's matrix canary: the windows leg was red on two commits of
  PR #71 while both runs' conclusions read `success` — and that red leg was the
  entire point of the canary, being the F-191 defect it was rolled out to catch.)
- **Verification must be able to surprise** (GP-B5 W10 / B14, 2026-09-03 — derived from
  the record, not the ideas: across F-300..F-359, 20 of 31 tester findings were a NAMED
  class recurring one site over, and 23 fix rounds were verified from the arms just
  written and had their hole found on the next verdict; every chain that switched to an
  independent frame closed in one round). The test for any verification claim is the
  **deletion test**: delete the sentence stating the property — does the property still
  hold by construction (a tool, a gate, a generator)? If not, the claim is
  judgment-selected and says so; it is never "complete". Four rules — two are STRUCTURE
  the live bus carries and `build/check-stale-facts.mjs` refuses, two are obligations
  with a greppable hook:
  1. **Enumeration source** (obligation). What-to-test derives from the ARTIFACT — the
     code's decision points (`build/sweep-fence-grammar.mjs --census` for the fence
     core; an in-process differential over the changed function elsewhere), a spec
     oracle, or an independent frame such as prior rounds' repros (the F-351 acceptance
     table) — never from the arms, messages, or fix scope just written. Every copy-out
     names its generator on its header line (`sweep (source: …)`); a sweep whose mutants
     come from the arm list is labelled a vacuity check on the arms, never closure.
     (F-326: three hand-picked mutants over seven arms; F-329→F-337: five rounds of
     enumerating from the previous round's failure.)
  2. **Prediction first** (structure). Expected kill/survive is written per point
     BEFORE the run and copied out beside the measurement: every indented copy-out row
     recording KILLED or SURVIVED carries `pred:KILL` or `pred:SURVIVE`; a
     disagreement is marked `MISMATCH` and IS the information — killed when expected to
     survive means the mechanism is not understood. Sections from F-360 on; the sweep
     tool prints the tokens. A verbatim quote of an older table is introduced by a line
     saying "quoted verbatim" and is exempt — a quoted record is never edited for a gate. The timing is the obligation the check cannot see; its
     only tell is a table that never mismatches. (F-358, F-359: predicted = measured
     closed each round in one verdict.)
  3. **Declared blind spots** (structure). Every handoff writes
     `Blind spots (<token>): …` directly under the bus's `Under test:` line — the
     frames not used, the measurements skipped with the argument stated, or
     `none — <reason>`. Keyed by the token, so a fresh handoff with a stale line is red
     by construction. The tester states its own the same way in its verdict comment
     (obligation — there is no tester token to key on). The next role aims there first:
     division of labour, not a race. (F-338/F-339 declared theirs; both closed in one
     round.) A blind spot is for what the round CANNOT measure — no CLI at the version,
     no host, no tenant. A claim about a shipped script's behaviour that a fixture can
     execute offline in minutes is measured, never declared: F-388 round 1 declared two
     migration-note claims as blind spots (3) and (5); both were false, both were one
     `upsert-batch` run on a scratch manifest away, and the round ping-ponged for it.
  4. **Budget by uncertainty** (obligation). A measurement whose outcome is
     structurally determined — re-running mutants a suite already killed after only
     ADDING arms; red cannot go green — is skipped and its argument written on the
     blind-spots line, never re-measured; the energy goes to what can surprise.
     (F-336, F-338.)
- **Defect classes are registered where a check reads them** (GP-B5 W10). A defect that
  recurs by CLASS gets a key in `build/defect-classes.mjs`: a MECHANICAL row when its
  detector is a pattern with zero false positives at gate cost — swept by
  `build/check-doc-drift.mjs` check 19 on every run, with an allowance ledger (sanctioned
  files, each with a reason) checked both ways so a stale allowance reds too — or a
  MANUAL entry (key only) whose recipe and cost are one of the `Class:` bullets below,
  cross-checked with the key list both ways. Graduation is that property, never a count
  (a detector with a knob, like `build/sweep-twins.mjs`, is an instrument a recipe runs,
  not a row). INSTANCES live on the bus: a finding of a registered class carries
  `Class: <key>` after `Severity:`, and its FIXED note carries `Sibling sweep:` — the
  check-19 pass line for a mechanical class, the recipe's copy-out with its cost for a
  manual one, or `batched — <reason>` on a polish finding (the valve). From F-436 on,
  its FIXED note also carries `Judge:` — what decides the fix's correctness INDEPENDENTLY
  of the fixer's list (an oracle, a differential against the real shell or tool, the
  tester's live arm) — and a section reopened twice is not FIXED again without
  `Redesign:`, naming the model replaced (the F-436 arc: two boundary tunes judged
  against the fixer's own lists, both reopened by the next spelling bash accepted; the
  lexer plus the shell-as-oracle test closed it). check-stale-facts refuses both;
  `grep -n '^Class: <key>' dev/FEEDBACK*.md` enumerates a class, and no file copies the
  list. The class list is human input and nothing claims it complete: a new class arrives
  as a finding and gets a row or a bullet then. (F-328's sibling sweep ran BY EYE and
  cleared scanFenceMarkers as "not this class"; F-329 was that site, the same day — a
  recipe is not a mechanism.) Keys are append-only — archived instances are frozen
  text and the enumeration grep spans both bus files. Manual classes, recipe · cost:
  - `Class: reader-shape` — a reader assumes the producer's shape or value format and
    the fixture certifies the reader (F-342, F-343, F-345, F-353, F-355, F-358). Recipe:
    the fixture is CAPTURED output or derived from the producer's source at the pin, the
    keys read are a declared typedef under the tsc gate (F-343's M5), and every external
    reader gets one captured payload per pin adoption (dev/VALIDATION.md arms). Cost: one
    read-only call per reader.
  - `Class: consumer-parity` — one rule with N consumers or copies, and a fix that lands
    in one of them (F-306, F-310, F-311, F-320, F-349, F-354/F-355). Recipe:
    `node build/sweep-twins.mjs` (identical line-runs across production modules, ~1 s;
    an instrument, not a gate) plus `git grep '<symbol>('` for every consumer of a shared
    symbol the fix touched — the fix reaches all of them or the note says why not. Cost:
    seconds.
  - `Class: unpinned-arm` — a decision point of new code that no committed arm kills
    (F-314, F-315, F-324, F-326, F-327, F-332, F-335..F-337). Recipe: enumerate the
    changed function's decision points from the CODE at token granularity (every
    conjunct, quantifier bound, branch, loop bound, return field), predict each, mutate
    each in an in-process differential (seconds — F-338), pin the survivors or ledger
    them with reasons compared both ways. Cost: minutes per function.
  - `Class: malformed-shape-readers` — two readers of one user-editable file disagree
    on a malformed shape (F-357). Recipe: `git grep` every reader of the file the fix
    touched and drive each with the same malformed value. Cost: seconds.
  - `Class: fence-grammar-copy` — a new copy of a fence-delimiter grammar that
    re-decides pairing on its own (F-323, F-328, F-329 — three rounds per copy).
    Demoted from a mechanical row in the W10 review round: a needle list caught two
    spellings and missed six, and a 3-backtick-run token matches the emitters — no
    zero-false-positive pattern exists. Recipe: `git grep` the in-scope lanes for
    triple-backtick / triple-tilde runs and run-quantifier regexes on non-comment
    lines, and name the homes (scanFenceMarkers, BUS_FENCE_DELIM_RE,
    readAliasConvention, extractFencedJson, jo-report's fence parse, the T-9 block
    parser in build/lib.mjs — one home since T-9 v4, formerly two renderers);
    `build/sweep-fence-grammar.mjs` is the census for the core. Cost: seconds.
  - `Class: false-rationale` — a shipped note states a false REASON for correct advice,
    so the failure the note promises cannot occur and any drift check resting on that
    promise is dead (F-416: audit's "`id` yields `undefined`" while `id` exists and differs;
    deprecate's "the catalog has no schedule read command" while two exist). Recipe: for
    every explanatory clause in a skill's payload-shape or CLI-surface notes, check the
    REASON — not the instruction it supports — against the installed catalog or one
    captured payload; write what the command does, never what it is presumed not to be.
    Cost: one read per note.
  - `Class: recording-blind-lookup` — a consumer keys per-workspace RECORDED data by a
    hardcoded default or a namespace spelling instead of reading the recording, so the
    lookup is right on the workspace it was written against and silently empty or forked
    on any other (F-429: tenant-deps' folder-name constants read 0 connection, report and
    connector-job docs on a workspace that recorded `connections` / `report-reports` /
    `connector-jobs`, with no caveat; refresh's 1.0.9 example passed `--domain connectors`
    into such a workspace and forked the inventory). The recording of record for a domain
    is `domains_indexed[<name>].listCommand`, resolved through the catalog (doc-lib
    `recordedDomainsByPath`). The doc half is MECHANICAL since the fourth pass: the lane
    vocabulary has one home (doc-lib `RECORDED_LANES`, which every reader derives its lanes
    and defaults from), and `build/check-doc-drift.mjs` check 22 reads the folder literals
    out of that source and refuses any RUNNABLE line in a skill or template — a fence
    line, or an inline command span — that names one as a `--domain` value, an
    `--out-dir` segment or a `<slug>/<folder>` path; prose that merely mentions a folder
    passes. Three hand sweeps each missed one shape (a lookup, a `--domain`, an
    `--out-dir`) before the enumeration was made mechanical. Recipe for the code half:
    grep the shipped scripts for literal
    domain names used as lookups (`DOMAINS`-style constant maps, `opt("--x-domain",
    "<literal>")` defaults, `--domain <literal>` in runnable skill examples); each either
    resolves from the manifest with the literal as the no-recording fallback, or is a
    placeholder the reader fills from `report`'s `byDomain`. Cost: minutes.
  - `Class: outcome-from-proxy` — a ledger or report field asserts an OUTCOME from a
    proxy signal that describes a larger unit than the thing the row is about (F-428: the
    change journal wrote "completed" from the harness's success event for a mutating call
    that sat before a `|` — the pipeline succeeded, the call exited 1). Recipe: for every
    field that states an outcome, name the signal it is derived from and the unit that
    signal describes; where the units differ, the word is qualified IN the field (not in
    a trailing parenthetical), and the qualifier says which signal was missing. Cost: one
    read per outcome-writing site (the guard's journal, journal.mjs, report-bug's
    template).
  - `Class: field-from-adjacency` — a ledger or report field is filled by scanning ADJACENT
    tokens past the boundary that defines it, so it states as fact words the parser never
    attributed to that row's unit (F-431: the change journal's `- target:` collected words
    until the next operator token, so a two-line command journaled line 2 as line 1's
    target, a heredoc opener carried its redirection word and body, and a body hit swallowed
    the rest of the body and the command after the terminator). Recipe: for every field
    assembled by walking tokens, name the boundary that defines the field's unit (segment
    start, redirection, heredoc data, body line) and stop at it from what the tokenizer
    RECORDED, never from operator adjacency alone; pin one arm per boundary plus the
    controls that must keep collecting (a redirect after ordinary arguments, a backslash
    continuation). Cost: one read per token-walking field writer (the guard's argument
    collector; any report that quotes "the rest of the line").
  - `Class: quote-erased-grammar` — a grammar decision (is this word an operator, a
    redirection, a heredoc delimiter) is made on the ASSEMBLED word after quote removal, so
    quoted or arithmetic text is read as shell syntax (F-433: the tokenizer matched `<<` on
    the finished word, so `grep '<<EOF' f.md` and `$((1<<8))` opened a phantom heredoc that
    swallowed the next line's real mutation as inert body). Recipe: decide syntax where the
    quotes are still visible — in the character loop, with a per-word flag the assembler
    consults — never on the joined word; pin the quoted, the arithmetic and the spaced
    spellings beside the real one. Cost: one read per operator the tokenizer recognizes by
    word shape.
  - `Class: redirection-as-boundary` — a token walk stops at a REDIRECTION as if it were a
    command separator, so a redirection standing before the words the walk needs empties it,
    and an empty walk is read as "no invocation" (silence) rather than "an invocation whose
    words stand past the redirection" (F-436: the guard's argument collector broke at a
    heredoc word and at every operator token, redirections included, so
    `gs-admin <<EOF jo p save` and `gs-admin > out.txt jo p save` ran a mutation with no
    prompt and no journal row — the first a regression of the F-431 target boundary, the
    second older than it). Recipe: for every token walk, split its stop set into separators
    (they end the unit) and redirections (step over the operator word and, when it stands
    bare, its target word — from what the tokenizer RECORDED, never from the word's text).
    Which characters FORM a redirection is read from ONE vocabulary the tokenizer owns (the
    operator list, longest first, fd-optional) through ONE predicate — never a clause per
    metacharacter: the first F-436 fix wrote an `&` clause for `2>&1` and left `|` in
    `>|` for the tester to find, the same defect one layer down. Pin the leading position
    of every operator in that vocabulary GENERATED from it (glued, spaced, fd-prefixed),
    the constructs beyond it (process substitution as a redirect target, as an argument,
    and with a mutation inside), the trailing controls, and a quoted look-alike that must
    stay an argument. Cost: one read per token walk that consults an operator set, plus one
    per tokenizer that decides an operator character by character. End state (F-436, third
    pass, after bash's `{varname}` fd prefix reopened it): the whole character loop runs on
    grammar tables — control operators, redirection operators with the COMPLETE fd-prefix
    grammar, the nesting openers and closers — and the proof is a shell-as-oracle
    differential (`test/guard-oracle.mjs`: generated lines through real bash and PowerShell
    with a recording shim; the guard must ask on every line the shell executed), not a list
    the fixer wrote.
  - `Class: unread-anchor-line` — a header line that a rule ANCHORS on is not itself read by
    any gate, so a hand edit can delete or replace it and every gate stays green (F-439: a
    builder's round-block script REPLACED the bus header's Under test line with the Blind
    spots line; the Blind spots rule keys on that line, and with no line there was nothing
    to key on — the tester compared the canary against a commit instead). Recipe: for every
    structural rule a gate enforces, name the line or field the rule anchors on and assert
    its presence, uniqueness, and the fact it carries (here: exactly one Under test line,
    and the canary at the declared location names the same handoff); pin the deleted, the
    duplicated and the mismatched shapes in the rig. Cost: one read per rule in
    build/check-stale-facts.mjs's bus block.
  - `Class: name-spelling` — the binary is spelled on the line in a form the word scanner
    never matches, so the invocation drops out of the scan: a substitution, an expression
    or a variable standing where the command name goes, a quoted or glued spelling (F-441:
    `$(which gs-admin) jo p save`, `` `which gs-admin` jo p save ``, `"$(which gs-admin)"
    jo p save`, PowerShell's `& (Get-Command gs-admin) jo p save` and `n=gs-admin; $n jo
    p save` all ran a mutation in silence; F-109 case, F-111 launcher suffix, F-244 the
    brace-glued name and F-250 the assignment prefix were instances closed one at a time).
    Recipe: for every scanner keyed on a literal name, read the shell's expansion grammar
    for the ways a command NAME is computed and treat each as an unreadable spelling of
    the name at command position — fail closed, with the arguments after it; generate
    every such form in the shell-oracle suite (`test/guard-oracle.mjs`) so a spelling the
    scanner does not match is measured against the real shell, never against the fixer's
    list. Cost: one read per name-keyed scanner, plus the oracle rows.
  - `Class: second-scanner` — a reader re-derives grammar from the text — its own quote
    loop, its own operator clauses, a regex over a word's text — instead of consulting the
    tokenizer's record, so the two disagree exactly where the grammar is subtle (F-443:
    the guard's pipe-safety lint scanned the raw command with its own quote state and
    `||`/`&&`/`|&` clauses and a text walk re-deriving the redirection vocabulary, so a
    `|` inside heredoc DATA drew a coaching deny on a line carrying a real mutation, and it
    read `word&>file` as a redirection where the lexer read a background; the here-string
    payload reader re-matched the fd-prefix grammar on the word). Recipe: `git grep` every
    function that receives the raw command text or tests a word with a grammar regex; each
    consumes the tokenizer's record (words, starts, redirs, subs, spans, quoted) or the
    record grows a field it needs — the tokenizer is the ONE place a quote or an operator
    is decided. Cost: one read per reader of the command text.

## Data hygiene — nothing instance-specific, ever

This repo may be open-sourced. Nothing tenant-, instance-, or org-specific may be
committed anywhere — code, test fixtures, docs, **commit messages, and PR bodies**.
Concretely: no real tenant slugs or URLs, no live asset names/ids/counts, no local
user paths (`C:\Users\<name>` style), no personal email addresses — security reports
go through GitHub private advisories (SECURITY.md), not an email address.

- Fixtures and doc examples use **fictional tenants** — the `acme-prod` /
  `acme.gainsightcloud.com` pattern already used throughout `test/` and the docs.
- Live findings and upstream bug reports are **archived locally, outside any git
  repo** — never committed here, not even under `docs/`.
- CI enforces the committed-file part on every PR: `build/check-instance-data.mjs`
  (docs-drift workflow). Its patterns are generic by design — the check itself must
  never contain a sensitive string. Org-specific strings to detect go in the
  git-ignored `gs-admin-explorer.config.json` (`privateInstancePatterns` — see the
  `.example.json`), never in the repo.

## Reading order before touching…

- …anything: `CLAUDE.md`, then the table above.
- …the plugin: `plugins/gs-superadmin/README.md`, then `reference/building-on-gs-admin.md`.
- …the guard hook: `hooks/gs-admin-guard.mjs` top comment + `test/guard-fixtures.mjs`.
- …a skill: that SKILL.md end to end, plus `templates/operating-model.md` for anything
  the skill's output must agree with.
- …exact CLI flags/tool names: `data/catalog.json` (or `reference/domains/<domain>.md`)
  — never guess from memory; the upstream package README's tool count is stale.
- …a comment citing `F-nnn`, `DS-nn`, `Wn`, `ER-nn`: those are provenance tokens, not
  links — the reasoning is in the comment beside them (CONTRIBUTING.md, "Reading the
  citations in code comments"). On this repo's `dev` branch an `F-nnn` resolves to a
  `## F-nnn` section in `dev/FEEDBACK.md` or `dev/FEEDBACK-archive.md`; on `main` and in
  the public repository it resolves to nothing, by design.
- …a PR body: `.github/pull_request_template.md` — the shape every PR reproduces;
  `gh pr create --body-file` never pre-fills it, so read it before composing.
