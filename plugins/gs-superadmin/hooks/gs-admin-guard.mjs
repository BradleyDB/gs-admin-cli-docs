#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// gs-admin-guard.mjs — PreToolUse + PostToolUse hook (Bash|PowerShell matcher)
//
// PreToolUse: parses every `gs-admin` invocation in a shell command against the
// bundled catalog's `mutating` flag and returns permissionDecision "ask" for
// writes, so mutations always reach a human approval prompt — regardless of
// global-flag order (`gs-admin --json jo p create …`), domain aliases, or short
// paths. Also lints for unquoted shell metacharacters from asset names
// (Gainsight assets are often named `Prefix|Domain|Subdomain|Description`,
// sometimes with `&` too): a single unquoted `|` or lone `&` whose right-hand
// side is not a recognized program is near-certainly a name fragment — first
// offense per invocation per session is denied with a quoting hint so the
// model can self-correct; a repeat escalates to "ask" so the human decides.
// `&&` chaining is never touched. Workspaces can accept extra pipe consumers
// via `.gs-superadmin/pipe-consumers.json` (additive only — it can widen what
// the LINT accepts, never touch the mutation ask). A small hand-maintained,
// self-retiring override list (hooks/ask-overrides.json) additionally forces
// "ask" on commands whose catalog `mutating: false` is a verified upstream
// mislabel — overrides can only ever add asks.
//
// PostToolUse + PostToolUseFailure (the change journal, SA-2): both events only
// fire for a command that actually ran — i.e. the approval prompt above was
// approved (or the command needed none); a denied call fires neither, so denied
// commands never appear. PostToolUse fires on success, PostToolUseFailure on a
// failed tool call (journaled as a FAILED attempt, with the payload's
// tool_error clamped in). Harnesses that never emit PostToolUseFailure simply
// journal only successful calls — exactly the pre-0.12.0 behavior (graceful
// degradation; the exit-code fallback below still covers harnesses that report
// failure through PostToolUse payload exit codes instead). For every
// catalog-mutating (or unknown-to-catalog, fail-closed) gs-admin invocation in
// the executed command, append a structured
// entry to the tenant workspace's `<slug>/changes/JOURNAL.md`: timestamp,
// operator, command, action + system area (X-2 component vocabulary), source
// Jira ticket key + plan file (from the `.gs-superadmin/active-change.json`
// marker the change-request skill writes via `scripts/journal.mjs
// change-start` during plan execution, ≤ 24 h old),
// and the pre-change KB snapshot reference. Denied commands never execute, so
// they never appear. Journaling failures alert via systemMessage — the command
// already ran; the hook must never retroactively break it (fail-open).
//
// Inert (exit 0, no output) unless a `.gs-superadmin/` workspace exists at or
// above the session cwd, so the plugin never interferes with gs-admin use in
// unrelated projects. Read-only gs-admin commands pass through untouched.
//
// What this guard is, and is not. It is a risk-reduction layer at the
// command-parsing level, not a guarantee: the CLI has no native safety layer,
// and using it carries residual risk these safeguards cannot eliminate. Known
// limits, stated plainly: the contract is the `gs-admin` binary spelling (bare,
// path-prefixed, or with a Windows launcher suffix) — the package-name spelling
// `npx @gainsight/gs-admin-cli …` is out of scope here and is handled by a
// workspace deny rule that setup merges instead, and node-path, shell-alias,
// and quote- or escape-mangled spellings of the binary name (`g""s-admin`,
// `gs\-admin`, `$'gs-admin'` — F-196) are out of scope entirely. The catalog
// `mutating` flag is also not the same thing as "writes to the tenant": some
// commands write while flagged
// non-mutating (see the README's "Know the gate you're relying on"), and the
// ask-override list covers only those verified one by one.
//
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────

// ── T-5 · Guard harness payload ──────────────────────────────────────────────
/**
 * FROZEN (B5 P1, 2026-08-16; v2 B1, 2026-08-16). COMMENT-ONLY typedef: this
 * file imports no local module statically (tenet — node: builtins plus one
 * sanctioned lazy journal-lib load); the type documents, the code stays
 * defensive.
 * Producer: the Claude Code harness (multiple generations, shapes vary —
 * de-facto spec: test/guard-fixtures.mjs). ALL fields optional at parse time;
 * stdin may carry one leading BOM (F-112).
 *
 * @typedef {object} HookPayload
 * @property {string} [hook_event_name]  "PreToolUse"|"PostToolUse"|
 *   "PostToolUseFailure" — ABSENT on older harnesses (inferred from
 *   tool_response presence; unknown failure semantics → outcome "not verified")
 * @property {string} [tool_name]        matcher covers Bash|PowerShell
 * @property {{command?: string}} [tool_input]
 * @property {string} [cwd]              workspace walk-up root
 * @property {string} [session_id]      pipe-lint escalation key
 * @property {HookToolResponse} [tool_response]
 * @property {number|string} [exit_code] top-level home (harness variant)
 * @property {boolean} [is_error]        top-level home (harness variant)
 * @property {string} [tool_error]       PostToolUseFailure detail (untrusted — clamp)
 *
 * @typedef {object} HookToolResponse
 * @property {number|string} [exit_code] numeric STRINGS count ("1" observed live, F-039)
 * @property {number|string} [exitCode]  camelCase home
 * @property {boolean} [is_error]
 * @property {boolean} [interrupted]
 * @property {string} [stdout]
 * @property {string} [stderr]
 */
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, appendFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir, userInfo } from "node:os";

// Typed against the T-5 header above (GP-B5 DS-42): every field read below is
// checked against HookPayload by the repo's tsc gate. Comment-only — the code
// stays defensive (every field optional, every value clamped); the annotation
// catches a misspelled or undeclared field, never a live-payload variance.
/** @type {HookPayload} */
let input;
try {
  // Tolerate a leading UTF-8 BOM on the payload, the same way the
  // pipe-consumers loader below does for its (user-written) file. `JSON.parse`
  // throws on one, and the catch here exits 0 — so a single invisible byte
  // made the guard inert for that call: no ask, no journal, no diagnostic —
  // and for every call, wherever the transport BOM-prefixes each payload
  // (F-112 — fails open and silent, the direction the tenets forbid). Windows
  // toolchains emit it routinely (PowerShell's own pipe prepends it), so any
  // wrapper or harness that re-encodes the payload en route is enough to
  // trigger it. Stripping is single-leading-BOM only — anything weirder is
  // malformed input and keeps failing open silently — and cannot add a false
  // ask: a BOM-prefixed payload parses to the identical object.
  const raw = readFileSync(0, "utf8").replace(/^\uFEFF/, "");
  // Cheap gate before parsing: PostToolUse payloads carry the command's whole
  // output in tool_response (potentially MBs), and this hook now runs after
  // every Bash/PowerShell call in a workspace. A command that invokes gs-admin
  // always contains the substring; anything else exits without the full
  // parse. Case-insensitive like every other match site: Windows and macOS
  // filesystems are case-insensitive, so `GS-Admin jo p save` runs the same
  // CLI — a case-sensitive substring check here exits before the case-folded
  // scanners below ever see it (F-109). False positives (output that merely
  // mentions gs-admin) just fall through to the normal parse + regex gate.
  if (!/gs-admin/i.test(raw)) process.exit(0);
  input = JSON.parse(raw);
} catch {
  process.exit(0);
}
if (input.tool_name !== "Bash" && input.tool_name !== "PowerShell") process.exit(0);
// Absent hook_event_name (older harnesses, existing fixtures) means PreToolUse —
// unless the payload carries a tool_response, which only PostToolUse events have
// (emitting a post-hoc "ask" for an already-run command would be meaningless,
// and the journal would silently never fire). PostToolUseFailure (per current
// hooks docs) fires only when the tool actually EXECUTED and failed — never for
// a denied/blocked call — so journaling it keeps the "denied commands never
// appear" contract; its payload carries tool_error instead of tool_response.
const isFailure = input.hook_event_name === "PostToolUseFailure";
const isPost =
  isFailure ||
  input.hook_event_name === "PostToolUse" ||
  (input.hook_event_name == null && input.tool_response != null);

// Printable-ASCII clamp for untrusted values (design tenet 4) — one helper for
// every output path: approval-prompt tenant labels, journal entries, marker
// fields. Collapses whitespace so a hostile value can't smuggle line breaks.
const printable = (v, cap) =>
  String(v).replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim().slice(0, cap);

// BOM-tolerant JSON file read — the hook's one copy of the rule (F-118).
// Scripts share doc-lib's readJsonFile; this hook keeps its own because its
// PreToolUse path deliberately imports nothing (self-containedness). Same
// single-leading-BOM-only semantics as the stdin read above (the F-113
// contract). Fail DIRECTION stays each caller's — this only removes the BOM
// false-negative, which mattered most for the tenant-manifest scan (a BOM'd
// _manifest.json silently dropped the tenant label and the PRODUCTION warning
// from approval prompts).
const readJsonFileTolerant = (p) => JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, ""));

// Reparse-point-tolerant directory test for Dirent scans (F-134): a junction
// or symlink to a directory reports isDirectory() === false, so a tenant KB
// behind a OneDrive/Known-Folder junction was invisible to the tenant scans
// below — the approval prompt lost the tenant claim AND the PRODUCTION
// warning, and journal attribution fell to the unattributed catch-all. Follow
// the link with statSync; a dangling link counts as not-a-directory. Same
// rule as doc-lib's direntIsDirectory (the scripts' copy) — keep in sync.
// Accepted trades of following links (F-154 — do not "fix" either back):
// (a) a tenant-dir junction can point OUTSIDE the workspace tree, so paths
//     reached through it — including the journal file this hook appends to —
//     can land out-of-root, and journal attribution follows link placement.
//     That is the legitimate OneDrive/Known-Folder layout, and workspace
//     content is already trusted by design: the same posture the catalog
//     load below documents (a hostile workspace could plant a catalog just
//     as easily as a junction). (b) statSync on a DANGLING network-backed
//     junction blocks this synchronous path for the transport timeout —
//     zero-dep sync Node has no bounded probe, and the pre-wave behavior
//     (skip reparse points instantly) was itself the F-134 defect.
const direntIsDir = (parentDir, dirent) => {
  if (dirent.isDirectory()) return true;
  if (!dirent.isSymbolicLink()) return false;
  try {
    return statSync(join(parentDir, dirent.name)).isDirectory();
  } catch {
    return false;
  }
};

// Secret redaction for anything written to the change journal, which is a file
// an org may deliberately git-track for durable history. `printable()` clamps
// encoding and length; it does NOT redact. Flag-name denylist, applied to the
// name with its dashes stripped: anything containing secret/password/credential,
// plus anything ENDING in -key / -token (so `--client-secret`, `--api-key`,
// `--auth-token` are covered while `--token-mappings`,
// `--token-mappings-file` and `--skip-on-unavailable-tokens` — real v1.0.4
// flags carrying non-secret payloads — keep their journal fidelity). Two
// v1.0.4 flags are redacted without being secrets (`--action-key`,
// `--idempotency-key`); over-redaction is the safe direction here.
// A value is only consumed when it does not itself look like a flag, so the
// boolean `--show-secrets` cannot swallow the token after it.
const SECRET_FLAG_RE = /secret|password|passwd|credential|(^|-)(key|token)$/i;
const isSecretFlag = (t) =>
  typeof t === "string" && t.startsWith("-") && SECRET_FLAG_RE.test(t.split("=")[0].replace(/^-+/, ""));
const redactSecrets = (s) =>
  String(s).replace(
    /(^|\s)(-{1,2}[A-Za-z0-9][\w.-]*)(=\s*|\s+)("[^"]*"|'[^']*'|[^\s"'-][^\s]*)/g,
    (m, pre, flag, sep, val) => (isSecretFlag(flag) ? `${pre}${flag}${sep.includes("=") ? "=" : " "}***` : m)
  );

const command = String(input.tool_input?.command ?? "");
// The hook guards two tools with one lexer; the few places where the two
// shells' grammars differ (a `(` after `&`, a `$x` at statement start) read
// this rather than a per-character proxy.
const isPowerShell = input.tool_name === "PowerShell";
// Suffix-spelled invocations are the same CLI: on Windows the npm shims are
// gs-admin.cmd / gs-admin.ps1 (a packaged binary would be gs-admin.exe, a
// hand-rolled wrapper gs-admin.bat), so the gate and both word scanners must
// treat one optional launcher suffix exactly like the bare name, or a
// mutating `gs-admin.cmd jo p save` skips the ask AND the journal.
// Recognizing more spellings only ADDS asks (tenet 3).
//
// One rule for suffix + case normalization, shared by isGsAdminWord and
// normalizeProg (F-111: two hand-written copies had already drifted —
// normalizeProg knew only `.exe`). It case-folds the WHOLE name, not just
// the suffix: Windows and macOS filesystems are case-insensitive, so
// `GS-Admin jo p save` runs the same CLI, and a case-sensitive compare let
// it skip the ask AND the journal (F-109 — fails open, silent). The fold is
// UNCONDITIONAL — no process.platform branch: a platform branch fails open
// again wherever mount and filesystem semantics disagree (WSL, container
// mounts, case-insensitive ext4/APFS volumes) and cannot be exercised from a
// single CI lane. Worst case on Linux is one extra ask for a literal
// uppercase GS-ADMIN binary (asks, never blocks — tenet 1). Only the BINARY
// word is folded; catalog subcommand matching stays case-sensitive, so
// `gs-admin JO P SAVE` lands on the fail-closed unrecognized-command ask.
const stripLauncherSuffix = (name) =>
  name.toLowerCase().replace(/\.(?:exe|cmd|bat|ps1)$/, "");
// A PowerShell ASSIGNMENT prefix is stripped before matching (F-250):
// `$x=gs-admin jo p save` runs the mutation, but `=` is not a token boundary,
// so the tokenizer yields the single word `$x=gs-admin` and the match failed —
// silent on both lanes, while the SPACED `$x = gs-admin …` asked correctly.
// Stripping here rather than making `=` an operator of the lexer is deliberate
// and is the whole reason this is a helper and not a boundary: `=` appears in every
// `--flag=value`, and splitting on it would push a flag's VALUE into the
// subcommand words, which can stop a mutating command matching its catalog
// path — i.e. it could REMOVE an ask, the one direction tenet 3 forbids.
// Covers `$x=`, `${x}=`, and scoped/namespaced spellings (`$env:FOO=`,
// `$script:x=`). Only the `$`-prefixed form: a bash `FOO=gs-admin cmd` sets a
// variable and does NOT execute gs-admin, so stripping there would add noise
// for nothing. Accepted false ask, stated because it is real: `$x='gs-admin'`
// (assigning the literal string) tokenizes identically once quotes are
// stripped, so it now asks. Nothing executes, the human declines, and that is
// the safe direction.
// The variable part is OPTIONAL: the lexer reads `{` after `$` as a word
// character, so `${x}=gs-admin` reaches this helper as ONE word and strips
// through the variable arm, while a bare leading `=` (a word an older
// tokenizer produced, kept for safety) strips too — `--id=gs-admin` starts
// with `-` and is handled as a flag, never reaching here as a candidate
// binary word.
// The `$` itself is NOT optional on the variable arm: a bash `FOO=gs-admin cmd`
// sets a variable and does not execute gs-admin, so matching it would add asks
// for something that never runs.
const ASSIGNMENT_PREFIX = /^(?:\$\{?[A-Za-z_][\w:]*\}?)?=/;
const isGsAdminWord = (w) => {
  const base = stripLauncherSuffix(w.replace(ASSIGNMENT_PREFIX, ""));
  return base === "gs-admin" || base.endsWith("/gs-admin") || base.endsWith("\\gs-admin");
};
// The command-text gate decides only whether to keep looking: a false pass
// falls through the scanners and exits silently, a missed pass loses the ask
// AND the journal (tenet 3). It used to restate the WORD BOUNDARY as a
// character class on each side of the name — widened by instance (`{` for
// F-244, `=` for F-250) and still wrong after the lexer became table-driven:
// it required whitespace or the end of the text AFTER the name, so
// `gs-admin>f jo p save`, `gs-admin<<EOF jo p save`, `gs-admin'' jo p save`
// and a name closing a substitution (`$(which gs-admin) jo p save`) never
// reached a scanner — the mutation ran with no ask and no journal row, on
// every shipped version (F-440). What ends a word is the LEXER's decision,
// made once, below; the gate keeps only the fact it can state without any
// grammar: the text mentions the name. (The raw-payload test above already
// applied this to the whole event; this one is the command text alone.)
if (!/gs-admin/i.test(command)) process.exit(0);

// Workspace gate: only enforce where /gs-superadmin:setup has been run
let dir = input.cwd || process.cwd();
let inWorkspace = false;
for (;;) {
  if (existsSync(join(dir, ".gs-superadmin"))) { inWorkspace = true; break; }
  const up = dirname(dir);
  if (up === dir) break;
  dir = up;
}
if (!inWorkspace) process.exit(0);

// Catalog: prefer the workspace copy (regenerated from the installed CLI on
// version drift by setup) over the plugin's bundled snapshot, so the guard is
// as current as the installed CLI rather than the last plugin release.
// Trusted-by-design: the workspace catalog lives in the user's own working dir.
// A hostile directory could plant one that silences the guard, but that only
// reverts to Claude Code's default permission prompting — the hook can add an
// "ask", never grant an allow — so this stays a deliberate, documented trust.
// SANCTIONED COPY (F-232): the catalog search below and the alias/known-path
// resolution tables that follow are doc-lib.mjs's findWorkspaceCatalog /
// makeCommandResolver, copied because this PreToolUse path deliberately
// imports nothing (self-containedness tenet, top of this file). The two
// importing scripts (describe-batch.mjs, domain-candidates.mjs) share the
// doc-lib implementation — keep THIS copy in sync with doc-lib by hand.
const here = dirname(fileURLToPath(import.meta.url));
const WS_CATALOG_PATH = join(dir, ".gs-superadmin", "catalog.json");
const BUNDLED_CATALOG_PATH = join(here, "..", "reference", "catalog.json");
let catalog = null;
let catalogFromWorkspace = false;
for (const p of [WS_CATALOG_PATH, BUNDLED_CATALOG_PATH]) {
  try {
    const parsed = readJsonFileTolerant(p);
    // A file parsing to null/0/false is corrupt, not a catalog. Treat it exactly
    // like a parse failure and keep going, or the falsy check below would exit
    // the hook silently and the bundled fallback this loop promises would never
    // be tried — a corrupt-but-parseable workspace file must not disable the guard.
    if (!parsed) continue;
    catalog = parsed;
    catalogFromWorkspace = p === WS_CATALOG_PATH;
    break;
  } catch {
    // unreadable → try the next source
  }
}
if (!catalog) process.exit(0); // no catalog at all → normal permission flow

// Global flags: value-taking ones consume the next token
const valueFlags = new Set();
for (const gf of catalog.globalFlags ?? []) {
  if (gf.flag && /[<[]/.test(gf.flag)) valueFlags.add(gf.flag.split(/[\s=<[]/)[0]);
}

// Domain alias maps (jo ⇄ journey) so mixed forms like `journey p save` resolve
const aliasToNs = new Map();
const nsToAlias = new Map();
for (const d of catalog.domains ?? []) {
  for (const a of d.aliases ?? []) aliasToNs.set(a, d.namespace);
  if (d.aliases?.length) nsToAlias.set(d.namespace, d.aliases[0]);
}

// Known command paths (canonical + short) → mutating?
const known = new Map();
let maxWords = 1;
for (const cmd of catalog.commands ?? []) {
  for (const p of [cmd.path, cmd.shortPath]) {
    if (!p) continue;
    known.set(p, cmd);
    maxWords = Math.max(maxWords, p.split(" ").length);
  }
}

// Conservative catalog UNION (F-268). A workspace catalog can predate the
// plugin's bundled snapshot — setup regenerates it only when re-run, so after
// a CLI/plugin upgrade a workspace can still carry labels upstream has since
// corrected (the 1.0.8 flip of 39 mislabeled writers is the motivating case;
// with the ask-override list empty, those commands went fully SILENT on such
// a workspace). The workspace catalog stays PRIMARY for resolution — the
// trust-model comment above is unchanged — but the mutating DECISION is the
// union of every catalog the hook can see: a command the primary labels
// non-mutating is promoted when the bundled catalog flags it. The union can
// only ever ADD asks (tenet 3), in either skew direction, and is
// catalog-derived (tenet 6 — no hand list). When a promotion fires the
// prompt carries a catalog-version note naming both versions and pointing at
// setup, and the journal records the union basis. A missing/unreadable
// bundled catalog degrades to primary-only — identical to pre-union behavior
// (the isolated-copy fixtures rely on exactly that).
let bundledCliVer = null;
const unionPromoted = new Set();
// One stable key per catalog entry, whichever of path/shortPath it carries —
// promotion writes and every consumer read go through this, so a hand-trimmed
// entry with only a shortPath keeps its version note and journal basis.
const cmdKey = (c) => c.path ?? c.shortPath;
// Numeric X.Y.Z compare; null when either side isn't three numeric parts.
const verCompare = (a, b) => {
  const pa = String(a).split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  if (pa.length !== 3 || pb.length !== 3 || [...pa, ...pb].some(Number.isNaN)) return null;
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
};
if (catalogFromWorkspace) {
  // Cheap probe before the ~700 KB bundled parse: reference/version.json is a
  // few bytes and names the bundled catalog's cliVersion. When the workspace
  // catalog declares the SAME version its labels are the same vintage, the
  // union is a no-op, and this blocking hook (Pre + Post + failure events all
  // run it) skips the second parse. Any doubt — missing probe, missing
  // workspace version, mismatch — falls through to the full union. A
  // same-version catalog with hand-edited flags is a deliberate local edit,
  // outside the stale-workspace skew F-268 covers.
  let unionNeeded = true;
  try {
    const wsVer = catalog.meta?.cliVersion;
    if (wsVer) {
      const probe = readJsonFileTolerant(join(here, "..", "reference", "version.json"));
      if (probe?.cliVersion && probe.cliVersion === wsVer) unionNeeded = false;
    }
  } catch { /* probe unreadable → do the full union */ }
  if (unionNeeded) try {
    const bundled = readJsonFileTolerant(BUNDLED_CATALOG_PATH);
    if (bundled && Array.isArray(bundled.commands)) {
      bundledCliVer = bundled.meta?.cliVersion ?? "unknown";
      for (const bc of bundled.commands) {
        if (!bc?.mutating) continue;
        for (const p of [bc.path, bc.shortPath]) {
          if (!p) continue;
          const entry = known.get(p);
          if (entry && !entry.mutating) {
            entry.mutating = true; // both map keys share this object
            unionPromoted.add(cmdKey(entry));
          }
        }
      }
    }
  } catch { /* bundled unreadable → primary-only, pre-union behavior */ }
}

// Hand-maintained ask-overrides for VERIFIED upstream catalog `mutating`
// mislabels (hooks/ask-overrides.json — the one sanctioned exception to
// catalog-derived behavior, AGENTS.md tenet 6). Overrides can only ever ADD an
// ask: an entry is honored only when its `whileCatalogMutatingIs` is literally
// false (any shape that could suppress an ask is rejected at load), and it is
// consulted only for commands the catalog already lets pass. Self-retiring:
// when upstream fixes the flag, the catalog-mutating branch below takes the
// command first and this list is never consulted — the normal catalog ask
// takes over with no double prompt. Fail-open (file level only): a
// missing/unreadable/malformed file means no overrides — plain catalog
// behavior, exactly as before the file existed. A malformed `unlessArgPresent`
// on an otherwise-valid entry must NOT drop the entry (that would remove an
// ask); it is ignored at match time instead, degrading toward always-ask.
const askOverrides = [];
try {
  const raw = readJsonFileTolerant(join(here, "ask-overrides.json"));
  for (const o of Array.isArray(raw?.overrides) ? raw.overrides : []) {
    if (typeof o?.path === "string" && o.whileCatalogMutatingIs === false)
      askOverrides.push(o);
  }
} catch { /* no override file → catalog behavior as-is */ }

// The shell tokenizer is THE LEXER below (F-436, third pass) — grammar tables,
// one character loop. Two facts from its history still explain rules it
// carries: operators and nesting tokens need no surrounding space in either
// shell (`echo done;gs-admin jo p save` runs gs-admin; `gs-admin jo p save;
// echo x` must not read `save;` as an argument), and both braces are
// boundaries with no space (F-244: `{gs-admin …}` is the idiomatic PowerShell
// script block, and `{` is a CMD_KEYWORDS member so the word after it stands
// at command position). Recognizing more spellings only ever ADDS asks
// (tenet 3).

// A backtick immediately followed by a NEWLINE is PowerShell's line
// continuation, not a substitution opener — emitting it as a boundary token
// routed `gs-admin `⏎ --json …` to the substituted-subcommand coaching path
// with the real words elided from the message and journal (F-049). The
// tokenizers swallow the backtick AND its newline, so the continuation's words
// are scanned as the single command they are. Newline ONLY — not any
// whitespace: in PowerShell a backtick-space is an escaped space, and in bash
// a space-padded `` ` `` opens a substitution, so that backtick must stay a
// boundary token. (Pre-release review catch, F-052: the first cut of this rule
// dropped backtick-before-ANY-whitespace, which silenced
// `` gs-admin ` re rules list ` `` — the substitution's literal text matched a
// known read and the coaching deny was lost — and stripped the
// command-position marker from `` echo ` gs-admin … ` ``.)
const isContinuationBacktick = (s, i) =>
  s[i] === "`" && (s[i + 1] === "\n" || s[i + 1] === "\r");

// bash's line continuation is backslash-before-newline — the exact analogue of
// the backtick rule above, and unhandled it degraded a KNOWN mutation spelled
// `gs-admin \` ⏎ `  jo p save`: the lone `\` token landed in rest, no catalog
// prefix matched, so the prompt fell to the vague "Unrecognized" wording and
// the journal attributed the mutation to "unknown" instead of its X-2 area
// (F-195 — fails CLOSED, degraded fidelity). Swallowed by BOTH tokenizers,
// unconditionally: a literal trailing backslash before a newline is
// vanishingly rare in PowerShell text, and the failure direction stays an ask.
const isContinuationBackslash = (s, i) =>
  s[i] === "\\" && (s[i + 1] === "\n" || s[i + 1] === "\r");

// Set when the quote-aware pass ends mid-quote — see the quote-blind pass below.
let unbalancedQuote = false;

// ONE tokenizer, two modes (F-428 third pass). The quote-aware pass and the
// quote-blind pass differ only in what a quote character does, yet each used to
// carry its own copy of the newline / operator / continuation rules — so a
// grammar fact learned by one (here: heredocs) had to be taught twice, and the
// two could drift. Both modes return the same record (listed above tokenize):
// `starts` is the set of word indices that BEGIN a command segment — the first
// word, the word after an unquoted newline (each line of a multi-line shell
// command is its own command; pre-release review catch F-052: computing
// position from the previous token alone stamped every line-2+ invocation as
// operand-position and told the approver a real mutation "may be inert"), and
// the word after a control operator or an opener. A swallowed continuation
// backtick consumes its newline too, so a continuation line stays inside its
// segment. Operand-position detection (F-051) is keyed off this set plus the
// separator and keyword tokens, not off token adjacency alone.
// `inert` is the set of word indices that are HEREDOC BODY text (F-428, the
// balanced-quoting instance): `cmd <<DELIM` / `<<-DELIM` / `<<'DELIM'` /
// `<< DELIM` makes every following line up to the delimiter line the DATA of
// that command, not commands of its own — the shell never executes them, and
// their quotes and metacharacters are literal. Before this, a body line was
// tokenized like any other line: a new segment, its first word at command
// position, so `gs-admin dm o create` written into a notes file was journaled
// as a call that RAN; the fixture's heredoc bodies happened to carry an
// apostrophe, which made the whole command unbalanced and routed them through
// the quote-blind pass — so the suite was green on the shape and the live case
// missed. Body words are emitted whitespace-split, with no quote parsing and
// no segment start, and scanWords reads `inert` as operand position: a
// mutation-shaped string in a body still ASKS (fail-closed — `bash <<EOF` does
// run its body) and is journaled as unverified, with the note naming the
// heredoc body. `<<<` (a here-string) is a word, not a heredoc. An unterminated
// heredoc runs to the end of the text, which is what bash does (with a
// warning). Bodies are read identically in both modes.
//
// Quote-blind mode — the SECOND pass, used only when the quote-aware pass
// ended mid-quote. bash's `\"` and PowerShell's backtick-escaped `"` are not
// quote toggles in the real shells (an apostrophe inside a `#` comment used to
// be the third case; comments are grammar since F-442 and never reach the
// quote state), so one spurious toggle leaves `q` set and swallows the entire
// rest of the command — including a following mutation — into a single token. Rather than
// re-implement two shells' escaping rules here (where a mistake fails silently
// and open), scan the same text again treating quotes as ordinary separators
// and UNION the findings: a genuine mutation is caught either way, while a
// read-only command still passes silently, so a stray apostrophe in a comment
// costs nothing. Union-only, so this can only ever add asks (tenet 3).
// THE LEXER (F-436, third pass). One character loop driven by GRAMMAR TABLES —
// the shell's control operators, its redirection operators with the COMPLETE
// fd-prefix grammar, and the constructs that open and close a nested command
// (`(…)`, `{…}`, `$(…)`, ```…```, `>(…)`/`<(…)`, `$((…))`) — in place of a
// metacharacter set plus a clause per surprise. Three rounds found three
// mis-segmentations of the same kind (a heredoc word as a boundary, `|` split
// out of `>|`, `{` split out of `{varname}>`): each was a grammar fact the loop
// restated at one site. Here the facts are data, the loop is generic, and the
// three token readers downstream (the argument collector, segmentMasked, the
// pipe lint) read what this lexer RECORDED — never the word's text.
//
// The redirection vocabulary: bash §3.6 (`>`, `>>`, `>|`, `>&`, `<`, `<<`,
// `<<-`, `<<<`, `<&`, `<>`, `&>`, `&>>`) and PowerShell about_Redirection
// (`>`, `>>`, `n>&1`, `*` as an fd), one list, longest first. The fd that may
// precede an operator: bash digits or `{varname}`, PowerShell digits or `*` —
// FD_PREFIX, the second half of the same grammar (the second pass carried the
// operators here and left the prefix as digits-or-star, which is how
// `{v}>f` never formed a word). The hook guards the Bash and the PowerShell
// tool with one grammar, so both vocabularies are the union: an operator one
// shell lacks can only ADD an ask under it (tenet 3), never lose one.
const REDIR_OPS = ["&>>", "&>", "<<-", "<<<", "<<", ">>", ">|", ">&", "<&", "<>", ">", "<"];
const FD_PREFIX = "(?:\\d+|\\*|\\{[A-Za-z_][A-Za-z0-9_]*\\})?";
const REDIR_ALT = REDIR_OPS.map((o) => o.replace(/[|&<>]/g, "\\$&")).join("|");
const REDIR_OP_RE = new RegExp("^" + FD_PREFIX + "(?:" + REDIR_ALT + ")");
const BARE_REDIR_OP_RE = new RegExp("^(?:" + REDIR_ALT + ")");
const FD_PREFIX_RE = new RegExp("^" + FD_PREFIX);
/** Length of the redirection operator (fd prefix included) that `text` starts with; 0 when none. */
const redirOpLen = (text) => { const m = REDIR_OP_RE.exec(text); return m ? m[0].length : 0; };
/** Length of the redirection operator PROPER (no fd prefix) that `text` starts with; 0 when none. */
const bareRedirOpLen = (text) => { const m = BARE_REDIR_OP_RE.exec(text); return m ? m[0].length : 0; };
const HEREDOC_OPS = new Set(["<<", "<<-"]);
// Control operators (bash §2 "control operator"), longest first. `(` and `)`
// open and close nested commands and are read below; newline is read by the
// loop itself. Both shells: PowerShell's `;`, `|`, `&&`, `||` are the same tokens.
const CONTROL_OPS = ["&&", "||", ";;&", ";;", ";&", "|&", "|", "&", ";"];
const controlOpAt = (s, i) => CONTROL_OPS.find((op) => s.startsWith(op, i)) ?? null;
// The characters an operator can START with — DERIVED from the tables, so the
// per-character loop asks a table only where a table can answer (the MEDIUM
// review's efficiency finding: every character used to pay a slice and a
// regex, or nine startsWith probes, for a `null`).
const REDIR_STARTS = new Set(REDIR_OPS.map((o) => o[0]));
const CONTROL_STARTS = new Set(CONTROL_OPS.map((o) => o[0]));
const FD_PREFIX_STARTS = /^[\d*{]/; // a word that may still become an fd prefix begins with one of these
// Spans that are ONE WORD of the enclosing command (the command continues
// after their closer): the substitutions, and `expr` — a parenthesized
// expression right after `&`, PowerShell's call operator on an expression
// (`& (Get-Command gs-admin) jo p save`, F-441); the lexer emits `expr` only
// on the PowerShell lane (in bash `& (…)` is a background then a subshell).
const SUBSTITUTIONS = new Set(["cmdsub", "procsub", "bq", "expr"]);

// Returns { words, starts, inert, redirs, subs, spans, quoted, arith } — THE RECORD
// every reader downstream consults (F-443: a reader that re-derives any of
// this from a word's text or from the raw string is a second scanner, and the
// two disagree exactly where the grammar is subtle):
//   words  — the tokens: words, redirection words, control operators, and the
//            opener/closer tokens `(` `)` `{` `}` `$(` `>(` `<(` `\``;
//   starts — word indices that BEGIN a command segment (first word, after a
//            newline, after a control operator, after an opener);
//   inert  — word index → heredoc body line (DATA of the command that opened it);
//   redirs — word index → what the lexer read for every word of a redirection:
//            the operator word `{ op, glued }` (the operator without its fd
//            prefix, and the target or delimiter written onto it — "" when it
//            stands bare), a bare operator's target word `{ role: "target" }`,
//            a heredoc's delimiter word `{ role: "delim" }`;
//   spans  — opener index → { close, kind } for every nesting the loop closed:
//            a subshell `(…)`, a group `{…}`, a command substitution `$(…)` or
//            `\`…\``, a process substitution `>(…)`/`<(…)`;
//   subs   — the SUBSTITUTION subset of spans. A substitution is ONE word of
//            the enclosing command (the shell hands it text or a /dev/fd path)
//            whose inside is a command of its own; the enclosing command
//            CONTINUES after its closer. Subshells and groups end a command;
//   quoted — word indices whose FIRST character arrived inside quotes (the
//            pipe lint's "deliberate syntax" reading of `| "cmd"`, `& 'path'`);
//   arith  — word index → the interior of a bash arithmetic expansion the loop
//            consumed as ONE word (F-433); scanWords re-scans that text
//            additively, since a substitution nested inside it is expanded.
function tokenize(s, quoteBlind) {
  const out = [];
  const starts = new Set();
  const inert = new Map();
  const redirs = new Map();
  const spans = new Map(); // `subs` is derived from it at the return — one record, one write
  const quoted = new Set();
  const arith = new Map(); // word index → the interior of an arithmetic expansion consumed as one word
  let cur = "", q = null, newSeg = true, quotedFirst = false;
  // A word has BEGUN — set by the first character or the first quote of a
  // word, even an empty pair (`''#x` is the argument `#x`, not a comment: the
  // MEDIUM review's `echo ''#x; gs-admin jo p save` ran in silence when the
  // comment rule read `cur === ""` as "no word yet").
  let wordStarted = false;
  // `plain` — how many leading characters of `cur` arrived UNQUOTED. Only that
  // prefix is ever read for grammar (F-433): a quoted `<<EOF` never reaches it,
  // and an arithmetic `$((1<<8))` is consumed whole below, as one word.
  let plain = 0;
  let depth = 0; // `${` braces open inside the word in hand
  const pending = []; // heredoc delimiters announced on the current line, in order
  let awaitDelim = null; // a bare `<<` / `<<-` whose delimiter is the next word
  let awaitTarget = false; // a bare redirection operator whose target is the next word
  let bodyLine = 0;
  const stack = []; // open nestings: { kind: "subshell" | "group" | "cmdsub" | "procsub" | "bq", at }
  const add = (c) => { wordStarted = true; if (plain === cur.length) plain++; cur += c; };
  // Does the unquoted character `c` at `i` CONTINUE (or begin) the redirection
  // operator in hand? True exactly when the vocabulary — prefix included —
  // matches further into `cur + c …` than `cur` is long: `2` + `>`, `>` + `|`,
  // `2>` + `&`, "" + `&>`, "" + `{v}>`, `{v` + `}`. False for `&&`, `>(`, `2>&1|`,
  // `{ cmd`. One predicate for every character; no character has a clause.
  const extendsOp = (c, i) => plain === cur.length && redirOpLen(cur + c + s.slice(i + 1, i + 40)) > cur.length;
  // bash 3.6.6: the heredoc delimiter is the word after QUOTE REMOVAL. Quotes
  // never reach `cur` (the loop consumes them); an unquoted backslash escapes
  // the character after it, so `<<\EOF` names EOF and its terminator line is
  // found (F-442 — the lexer kept the backslash, and the body ran to the end
  // of the text, swallowing the command after the real terminator as data).
  // Applied only to a delimiter that arrived entirely unquoted: inside quotes
  // a backslash is literal.
  const delimiterOf = (word, unquoted) => (unquoted ? word.replace(/\\(.)/g, (m, ch) => ch) : word);
  const flush = () => {
    wordStarted = false;
    if (!cur) return;
    if (awaitDelim) {
      pending.push({ delim: delimiterOf(cur, plain === cur.length), stripTabs: awaitDelim === "<<-" });
      awaitDelim = null;
      redirs.set(out.length, { role: "delim" }); // the delimiter word belongs to the redirection
    } else if (awaitTarget) {
      redirs.set(out.length, { role: "target" }); // a bare operator's target word
      awaitTarget = false;
    } else {
      const n = redirOpLen(cur.slice(0, plain)); // the operator this word starts with, from its plain prefix only
      if (n) {
        const op = cur.slice(0, n).replace(FD_PREFIX_RE, "");
        const glued = cur.slice(n); // the target (or delimiter) written onto the operator
        if (HEREDOC_OPS.has(op)) {
          if (glued) pending.push({ delim: delimiterOf(glued, plain === cur.length), stripTabs: op === "<<-" });
          else awaitDelim = op;
        } else if (!glued) awaitTarget = true;
        redirs.set(out.length, { op, glued });
      }
    }
    if (newSeg) starts.add(out.length);
    if (quotedFirst) quoted.add(out.length);
    out.push(cur);
    cur = "";
    plain = 0;
    depth = 0;
    newSeg = false;
    quotedFirst = false;
  };
  // Consume the announced heredoc bodies starting at index i (the first
  // character after the line's newline); returns the index just past the last
  // terminator line. Body lines are whitespace-split literal words: no quote
  // parsing, no operator tokens, no segment starts.
  const readBodies = (i) => {
    while (pending.length && i < s.length) {
      const { delim, stripTabs } = pending[0];
      let end = s.indexOf("\n", i);
      if (end < 0) end = s.length;
      let line = s.slice(i, end);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      i = end + 1;
      if ((stripTabs ? line.replace(/^\t+/, "") : line) === delim) {
        pending.shift();
        continue;
      }
      bodyLine++;
      for (const w of line.split(/\s+/)) {
        if (!w) continue;
        inert.set(out.length, bodyLine);
        out.push(w);
      }
    }
    pending.length = 0; // an unterminated body ran to the end of the text
    return i;
  };
  // Operator and nesting tokens are pushed WITHOUT a segment start of their
  // own (the word after them gets it); a bare redirection's target mark lands
  // on a substitution opener when one follows it (`> >(cat)`).
  const opener = (text, kind) => {
    flush();
    if (awaitTarget) { redirs.set(out.length, { role: "target" }); awaitTarget = false; }
    // An opener standing where a command begins (first word, after a newline
    // or an operator) is itself a segment start: the substitution AT command
    // position is the command's name (F-441), and the name rule reads that
    // from `starts` — the MEDIUM review found `$(which gs-admin) jo p save`
    // losing its reading on line 2, where only the inner word had the start.
    if (newSeg) starts.add(out.length);
    stack.push({ kind, at: out.length });
    out.push(text);
    newSeg = true;
  };
  const control = (text) => { flush(); awaitTarget = false; out.push(text); newSeg = true; };
  const closer = (text, kinds) => {
    flush();
    awaitTarget = false;
    const top = stack[stack.length - 1];
    const open = top && kinds.has(top.kind) ? stack.pop() : null; // unbalanced input closes nothing
    out.push(text);
    if (open) spans.set(open.at, { close: out.length - 1, kind: open.kind });
    if (!(open && SUBSTITUTIONS.has(open.kind))) newSeg = true; // a substitution is one word: the enclosing command continues
  };
  const PAREN_KINDS = new Set(["subshell", "cmdsub", "procsub", "expr"]);
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      // Inside double quotes an escape keeps the quote OPEN: bash's `\"` (and
      // `\\`, `\$`, `` \` ``), PowerShell's `` `" ``. Read as a toggle, the
      // escaped quote closed the string early, and the comment rule below then
      // discarded the rest of the line — the real closing quote included, so
      // the quote-blind rescue never ran (the MEDIUM review: `echo "a \" #b" ;
      // gs-admin jo p save` executed in silence). Single quotes have no
      // escapes in either shell.
      if (q === '"' && ((c === "\\" && /["\\$`]/.test(s[i + 1] ?? "")) || (c === "`" && s[i + 1] === '"'))) {
        if (cur === "") quotedFirst = true;
        cur += s[i + 1]; // the escaped character, as the shell hands it on
        i++;
        continue;
      }
      if (c === q) q = null; else { if (cur === "") quotedFirst = true; cur += c; }
      continue;
    }
    if (c === '"' || c === "'") { wordStarted = true; if (quoteBlind) flush(); else q = c; continue; }
    if (c === "\n" || c === "\r") {
      flush();
      newSeg = true;
      awaitTarget = false; // a bare operator's target never crosses a line
      if (pending.length) {
        if (c === "\r" && s[i + 1] === "\n") i++;
        i = readBodies(i + 1) - 1; // the loop's i++ lands on the line after the last terminator
      }
      continue;
    }
    if (isContinuationBacktick(s, i) || isContinuationBackslash(s, i)) {
      flush();
      i++; // swallow the newline — the continuation is the SAME command (F-195)
      if (s[i] === "\r" && s[i + 1] === "\n") i++;
      continue;
    }
    if (/\s/.test(c)) { flush(); continue; }
    // A comment (bash 3.1.3, PowerShell about_Comments): `#` where no word has
    // begun discards the rest of the line — the shell never sees that text, so
    // no reader may either (a `# note` after a mutation was the journal's
    // `target:`, F-442). Mid-word `#` is a character (`$#`, `${#x}`, `a#b`,
    // `''#x`). The newline is left for the branch above: heredoc bodies
    // announced on this line still open there. PowerShell's block comment
    // `<# … #>` is read on both lanes: in PowerShell the words after `#>` are
    // commands (the review's `<# note #> gs-admin jo p save` ran in silence
    // when `#>` was read as a line comment); in bash `<#` is a redirection
    // from a file named `#` and `#>` a comment — no real spelling — so reading
    // the span as a comment there can only add an ask.
    if (c === "<" && s[i + 1] === "#" && !wordStarted) {
      const end = s.indexOf("#>", i + 2);
      i = end < 0 ? s.length - 1 : end + 1;
      continue;
    }
    if (c === "#" && !wordStarted) {
      while (i + 1 < s.length && s[i + 1] !== "\n" && s[i + 1] !== "\r") i++;
      continue;
    }
    // Arithmetic `$(( … ))` is ONE word: nothing inside is a command or a
    // redirection (`1<<8` is a shift — F-433), so it is consumed whole — where
    // the shell reads it as arithmetic at all. The release-gate
    // /security-review of 0.37.0 measured three ways the shells EXECUTE what
    // stands inside such a span, each silent while this branch swallowed the
    // words (asked under the tokenizer it replaced, where `(` and `;` were
    // boundaries): PowerShell has no arithmetic expansion — `$((gs-admin jo p
    // save))` is a subexpression around a grouped pipeline and runs the call —
    // so that lane never takes this branch (`$(` opens a command substitution
    // and `(` a subshell below, and the inner call stands at command
    // position); bash reads `$((` as arithmetic ONLY when the span closes with
    // an adjacent `))` — `$((cmd); true)`, `$((cmd) )`, `$((cmd)|cat)` are
    // `$( (cmd) …)` and run — so a span whose closer is a lone `)` falls
    // through to the same openers; and inside genuine arithmetic a nested
    // substitution is expanded first (`$((x=$(gs-admin jo p save)))` runs), so
    // the consumed word's interior is recorded in `arith` for scanWords'
    // additive re-scan.
    if (c === "(" && cur === "$" && s[i + 1] === "(" && !isPowerShell) {
      let d = 0, j = i;
      for (; j < s.length; j++) {
        if (s[j] === "(") d++;
        else if (s[j] === ")" && --d === 0) break;
      }
      if (j < s.length && s[j - 1] === ")") {
        arith.set(out.length, s.slice(i + 2, j - 1)); // the word's index once flushed → the text between `$((` and `))`
        cur += s.slice(i, j + 1);
        i = j;
        continue;
      }
      // not closed by `))`: a command substitution holding a subshell — the openers below
    }
    // Substitutions and nestings.
    if (c === "(" && cur === "$" && plain === 1) { cur = ""; plain = 0; opener("$(", "cmdsub"); continue; }
    if (c === "(" && (cur === ">" || cur === "<") && plain === 1) { const o = cur; cur = ""; plain = 0; opener(o + "(", "procsub"); continue; }
    if (c === "`") {
      const top = stack[stack.length - 1];
      if (top && top.kind === "bq") closer("`", new Set(["bq"]));
      else opener("`", "bq");
      continue;
    }
    // PowerShell only: `& (…)` is the call operator on an expression (one word
    // of the command); in bash `& (…)` is a background then a real SUBSHELL
    // whose inner command executes (the review's `sleep 1 & (gs-admin jo p
    // save)` — reading it as a name silenced the call).
    if (c === "(") { opener("(", isPowerShell && cur === "" && out[out.length - 1] === "&" ? "expr" : "subshell"); continue; }
    if (c === ")") { closer(")", PAREN_KINDS); continue; }
    // A redirection operator, or an fd prefix on its way to one — decided by
    // the vocabulary, before any character is read as an operator of its own.
    // Asked only where the vocabulary can answer — decided by the WORD IN HAND,
    // never by `c` (the review's first gate keyed on `c` and lost `>|`: the `|`
    // that continues an operator is not a character an operator starts with):
    // an empty word, a word that is an operator in progress, or one that may
    // still be an fd prefix.
    if ((cur === "" || REDIR_STARTS.has(cur[0]) || FD_PREFIX_STARTS.test(cur)) && extendsOp(c, i)) { add(c); continue; }
    // A redirection operator BEGINNING here ends the word in hand: the shell
    // reads `foo>bar` as `foo` then `>bar`, and `foo&>bar` as `foo` then
    // `&>bar` — asked of the same vocabulary, BEFORE the control-operator table
    // can read that `&` as a background (F-442: the clause this replaces
    // listed `<` and `>`, two of the three characters an operator can start
    // with, so `save&>f` lexed as `save` `&` `>f` and the row was journaled
    // "backgrounded"). Only an operator PROPER starts a word here — a digit or
    // `{` glued to a word is that word's tail (`save2>f` is the word `save2`),
    // which is why the prefix-less vocabulary is the one asked.
    if (cur !== "" && REDIR_STARTS.has(c) && bareRedirOpLen(s.slice(i, i + 3)) > 0) { flush(); add(c); continue; }
    // Braces: `{` opens a group (bash) or a script block (PowerShell) at a
    // word start — `{gs-admin …}` needs no space (F-244) — and is a word
    // character after `$` (`${name}`); `}` closes what its word opened, else
    // the block. A `{varname}` fd prefix never reaches here: extendsOp above.
    if (c === "{") {
      if (cur.endsWith("$")) { add(c); depth++; }
      else opener("{", "group");
      continue;
    }
    if (c === "}") {
      if (depth > 0) { add(c); depth--; }
      else closer("}", new Set(["group"]));
      continue;
    }
    const op = CONTROL_STARTS.has(c) ? controlOpAt(s, i) : null;
    if (op) { control(op); i += op.length - 1; continue; }
    add(c);
  }
  flush();
  if (q) unbalancedQuote = true;
  const subs = new Map([...spans].filter(([, span]) => SUBSTITUTIONS.has(span.kind))); // the substitution view of spans
  return { words: out, starts, inert, redirs, subs, spans, quoted, arith };
}
const shellWords = (s) => tokenize(s, false);
const shellWordsQuoteBlind = (s) => tokenize(s, true);

// The tokens that END a command unit for every token walk (F-436): the control
// operators and the nesting openers/closers — braces included (F-244: the
// lexer emits them as their own tokens, so a script block's closing `}` must
// terminate an argument collection rather than ride along as a trailing
// argument word — `--id 42 }` in the journal's `- target:` is a lie about what
// ran). Redirections are NOT in this set: a redirection word is stepped over
// (the lexer marked it — `redirs`), so the words standing past it are still
// this command's. Treating `>` like `|` let `gs-admin > out.txt jo p save` run
// a mutation unseen (F-436); and a second, hand-listed operator set that kept
// five redirection spellings (`>`, `>>`, `<`, `2>`, `2>&1`) let the nested
// payload locator stop at `bash -c > f '…'` and the escalation key read `>|f`
// as a subcommand word (F-447, the 0.37.0 Step 0 review) — every walk asks
// this set and the record, nothing else.
const SEPARATORS = new Set([...CONTROL_OPS, "(", ")", "`", "{", "}", "$(", ">(", "<("]);
const { words, starts: segStarts, inert: segInert, redirs: segRedirs, subs: segSubs, spans: segSpans, quoted: segQuoted, arith: segArith } = shellWords(command);

// Per-session deny memory, shared by the pipe lint and the variable-subcommand
// coaching below: first offense is denied with a self-correction hint, a repeat
// of the same invocation escalates to a human prompt instead of a denial loop.
// Accepted trade (F-135, WONTFIX): the parent dir lives under the SHARED OS
// temp dir, so on multi-user Linux the first user owns it and a second user's
// recordDeny() fails forever. That failure already degrades in the safe
// direction — recordDeny returns false and the caller asks NOW (the contract
// below) — so the cost is a weaker first-offense coaching lint, never a deny
// loop and never a missed ask. Do not "fix" this into a world-writable dir.
const sessionStateFile = join(
  tmpdir(),
  "gs-superadmin-pipe-guard",
  `${String(input.session_id ?? "no-session").replace(/[^\w.-]/g, "_")}.json`
);

function readDenied() {
  try {
    return readJsonFileTolerant(sessionStateFile).denied ?? [];
  } catch {
    return []; // first offense this session
  }
}

// True when the deny was durably recorded. A failed write means a repeat could
// never escalate — the caller must ask NOW instead of denying forever (the
// approval prompt is the guard's promised override path; deny loops are not).
function recordDeny(key, denied) {
  try {
    mkdirSync(dirname(sessionStateFile), { recursive: true });
    writeFileSync(sessionStateFile, JSON.stringify({ denied: [...denied, key] }));
    return true;
  } catch {
    return false;
  }
}

// ── Shell-safety lint: unquoted `|` / lone `&` from metachar-bearing names ───
// Gainsight asset names commonly contain literal pipes (Prefix|Domain|Subdomain|
// Description) and sometimes `&` (Sales & Marketing). Unquoted, the shell
// parses them as operators before gs-admin ever sees them. Scan the RAW
// command (quote-aware; shellWords can't see an operator with no surrounding
// spaces) for single unquoted pipes / lone ampersands whose right-hand side is
// not a plausible program — those are near-certainly name fragments.
const PIPE_CONSUMERS = new Set([
  // POSIX-ish filters
  "jq", "grep", "egrep", "fgrep", "rg", "head", "tail", "sort", "uniq", "wc",
  "awk", "sed", "cut", "tr", "tee", "cat", "less", "more", "xargs", "column",
  "node", "python", "python3", "findstr", "echo", "gs-admin",
  // PowerShell cmdlets + common aliases
  "select-string", "sls", "select-object", "select", "where-object", "where", "?",
  "foreach-object", "foreach", "%", "convertfrom-json", "convertto-json",
  "convertfrom-csv", "convertto-csv", "format-table", "ft", "format-list", "fl",
  "measure-object", "measure", "sort-object", "group-object", "group",
  "out-file", "out-null", "out-string", "out-host", "tee-object",
  "set-content", "add-content", "export-csv", "import-csv", "export-clixml",
  "write-host", "write-output", "get-content", "gc", "clip", "yq", "base64",
  "perl", "get-member", "gm", "compare-object", "join-string",
  // Clipboard writers beyond Windows' `clip` (F-110: their absence drew false
  // first-offense denies on macOS/Linux). Additive, lint-acceptance only —
  // widening this set never removes or downgrades a mutation ask; on a
  // mutating command it can only move the first-offense coaching deny (which
  // masked the mutation prompt entirely) to the standard mutation ask.
  "pbcopy", "xclip", "xsel", "wl-copy",
]);

// One normalization for program names, used both for matching a command's RHS
// word and for loading workspace-listed consumer names — the "matched like
// built-ins" guarantee is structural, not two copies kept in sync by hand.
// Suffix + case handling is stripLauncherSuffix, the same rule the gs-admin
// word matcher applies (F-111: this copy knew only `.exe`, so on Windows
// `| findstr.CMD x` missed the consumer list and drew a false deny).
// Deliberately stem-based: a local `select.ps1` unrelated to Select-Object
// also passes the lint. Accepted — the lint's fail direction is a missed
// quoting hint (back to the shell's own handling), never a missed ask, and a
// suffix whitelist here would re-split the rule this helper exists to unify.
const normalizeProg = (name) => stripLauncherSuffix(name.split(/[\\/]/).pop());

// Workspace-extendable consumers (.gs-superadmin/pipe-consumers.json, live
// Finding H: `… | dump` was denied because `dump` is a user-defined shell
// function the built-in list can't know about). Shape:
// `{ "consumers": ["dump", "my-filter"] }` — names are matched like built-ins
// (basename, case-folded, launcher suffix stripped: .exe/.cmd/.bat/.ps1 — the
// stripLauncherSuffix rule). ADDITIVE ONLY: entries can widen
// what the pre-execution quoting LINT accepts (worst case: back to Claude
// Code's normal permission flow) and can never touch the catalog mutation ask.
// Missing/unreadable/malformed file, or non-string entries → ignored, built-in
// consumers only (fail-open) — same trust posture as the workspace catalog.
// The file is user-written, so tolerate a UTF-8 BOM (PowerShell 5.1 adds one).
// An entry that normalizes to "" (e.g. a slash-terminated path) is rejected:
// adding "" would silently accept every empty-RHS `|` the lint exists to
// catch. Loaded only pre-execution — the lint never runs on Post events.
const pipeConsumers = new Set(PIPE_CONSUMERS);
if (!isPost) {
  try {
    const raw = readJsonFileTolerant(join(dir, ".gs-superadmin", "pipe-consumers.json"));
    for (const c of Array.isArray(raw?.consumers) ? raw.consumers : []) {
      if (typeof c !== "string") continue;
      const prog = normalizeProg(c.trim());
      if (prog) pipeConsumers.add(prog);
    }
  } catch { /* no workspace consumers → built-ins only */ }
}

// First suspicious `|` or lone `&` as { op, word }, else null — read from the
// LEXER's record, never from the raw text (F-443: this lint was a second
// scanner with its own quote loop, its own `||`/`&&`/`|&` character clauses
// and a text walk re-deriving the redirection vocabulary; it read heredoc
// BODY text as operators — `foo|bar` inside a heredoc drew a coaching deny
// on a line that also carried a real mutation — and disagreed with the lexer
// on `word&>file`). Everything it used to re-derive is recorded: a `|` or `&`
// inside a redirection operator is part of a redirection WORD (`>|`, `2>&1`,
// `<&0`, `&>log`), never a control token; `&&` and `||` are tokens of their
// own and are never flagged (`|&` IS flagged — bash pipes stdout+stderr, so
// the RHS still runs); body words are data; a quoted RHS is a quoted word.
// Skipped, as before: a trailing `&` (backgrounding — end of text, or before a
// closer), `&` before an opener (PowerShell's call operator on a script block
// or an expression — `&{…}`, `& (Get-Command …)`; in bash a background then a
// subshell — a deliberate spelling either way, never a name fragment, which
// always resumes with a literal word), and either operator followed by a
// quoted word or a `$`-word (deliberate syntax — `& "C:\…\tool"`, `| $pager`).
// The RHS word is the next TOKEN — `| %{ … }` yields `%`, on the consumer
// list, because the lexer split the brace off.
function findSuspiciousMeta(ws, quotedWords, redirWords, inertWords) {
  for (let k = 0; k < ws.length; k++) {
    const t = ws[k];
    if (inertWords.has(k)) continue; // a heredoc body word that happens to be `|` is data (the review's markdown-table body)
    if (t !== "|" && t !== "|&" && t !== "&") continue;
    const op = t === "&" ? "&" : "|";
    const next = ws[k + 1];
    const trailing = next === undefined || next === ")" || next === "}";
    if (op === "&" && (trailing || next === "{" || next === "(" || next === "$(" || next === "`")) continue;
    if (!trailing && (quotedWords.has(k + 1) || next.startsWith("$"))) continue; // deliberate syntax
    const word = trailing || SEPARATORS.has(next) || redirWords.has(k + 1) ? "" : next;
    if (!pipeConsumers.has(normalizeProg(word)))
      return { op, word: word || "(end of command)" };
  }
  return null;
}

// Escalation key: domain + group of the first gs-admin invocation ("re r",
// "journey programs", …) — stable across a still-broken retry of the same
// lookup even if the mangled name fragments differ.
function invocationKey(ws, redirWords) {
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i];
    if (!isGsAdminWord(w)) continue;
    const toks = [];
    for (let j = i + 1; j < ws.length && toks.length < 2; j++) {
      const t = ws[j];
      if (redirWords.has(j)) continue; // stepped over, as everywhere (F-447: `>|f` was read as a subcommand word here)
      if (SEPARATORS.has(t)) break;
      if (t.startsWith("-")) {
        if (valueFlags.has(t.split("=")[0]) && !t.includes("=")) j++;
        continue;
      }
      toks.push(t);
    }
    return toks.join(" ") || "gs-admin";
  }
  return "gs-admin";
}

// The lint is pre-execution advice; on PostToolUse the command already ran.
const suspicious = isPost ? null : findSuspiciousMeta(words, segQuoted, segRedirs, segInert);
// Set when the lint escalates to "ask": the text is carried into the single
// prompt assembled at the end rather than emitted on its own — see below.
let lintAskPart = null;
if (suspicious) {
  // The RHS word is attacker-influenceable text (it comes from whatever the
  // model wrote, which asset names and KB docs steer) — clamp it like every
  // other untrusted interpolation, per design tenet 4.
  const { op } = suspicious;
  const rhsWord = printable(suspicious.word, 60) || "(end of command)";
  const key = invocationKey(words, segRedirs);
  const denied = readDenied();

  // Repeat offense — or a deny we cannot record (a deny that can never
  // escalate would block forever) — goes to the human prompt. The `|` and `&`
  // lints share the deny memory: a still-broken retry of the same invocation
  // escalates no matter which metacharacter is caught first.
  // Shared coaching fragments — per-operator text carries only what differs
  // (operator noun, name pattern, intent phrasing), so a wording fix lands in
  // one place for both operators.
  const quoteFix =
    `Single-quote the whole value (single quotes are literal in both PowerShell and bash), ` +
    `e.g. ${op === "|" ? "--search 'CS|Risk|Renewal|Alert'" : "--search 'Sales & Marketing|EMEA|Renewals'"}, ` +
    `then retry.`;
  let reason = null;
  if (denied.includes(key) || !recordDeny(key, denied)) {
    lintAskPart =
      `This command contains an unquoted ${op === "|" ? "`|`" : "lone `&`"} whose right-hand ` +
      `side (\`${rhsWord}\`) is not a recognized ${op === "|" ? "filter program" : "program"}. ` +
      `If the \`${op}\` is part of a Gainsight asset name, the value must be single-quoted ` +
      `before running. Approve only if the ${op === "|" ? "pipe is intentional" : "`&` is intentional (`&&` chaining is never flagged)"}.`;
  } else {
    reason =
      (op === "|"
        ? `Unquoted \`|\` here will be parsed as a shell pipeline — \`${rhsWord}\` would run as a ` +
          `command. Gainsight asset names often contain literal pipes ` +
          `(Prefix|Domain|Subdomain|Description). `
        : `Unquoted lone \`&\` here will be parsed as a shell operator — \`${rhsWord}\` would run ` +
          `as a separate command. Gainsight asset names can contain a literal \`&\` ` +
          `(e.g. Sales & Marketing). `) +
      quoteFix +
      (op === "|"
        ? ` If you really meant to pipe into \`${rhsWord}\`, still quote the gs-admin argument ` +
          `values and retry.`
        : ` If you really meant a background/parallel \`&\`, still quote the gs-admin argument ` +
          `values and retry (\`&&\` chaining is never flagged).`);
  }

  // First offense: DENY and stop — the command is broken as written, so there is
  // nothing to approve and the mutation scan would only describe a command that
  // cannot run as typed. The repeat offense is the opposite case: that branch
  // exists so the human CAN run it, which means the prompt must carry the
  // mutation, tenant and PRODUCTION text too. So it falls through to the scan
  // below and its text is concatenated into the single ask assembled at the end,
  // rather than replacing it.
  if (reason !== null) {
    // Every stdout site — the three PreToolUse replies (F-363) and the two
    // PostToolUse journal alerts in journalMutations (F-372) — exits IN the
    // stdout write callback (the F-360 class fixed at the design): stdout is asynchronous when it is a pipe on
    // macOS — the harness transport — so `write(json); process.exit(0)` lost
    // everything past the first 8,192-byte chunk and the harness saw a reply
    // cut mid-JSON. The never-resolving awaited promise holds control flow
    // exactly where process.exit did (doc-lib finish()'s shape, hand-spelled:
    // this hook imports nothing, R-1). Same JSON, same decision — only when
    // the process exits changes.
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: reason,
        },
      }),
      () => process.exit(0)
    );
    await new Promise(() => {});
  }
}

const hits = [];
const overrideHits = [];
const unknowns = [];
const varSubs = [];
// Findings contributed ONLY by the quote-blind second pass (see below). The
// balanced parse never saw them, so the flagged text may be inert (quoted
// prose; a heredoc body is read by BOTH passes as operand text since the F-428
// third pass — see tokenize) — the ask prompt and the journal entry must say so
// rather than asserting a gs-admin invocation as fact. Object findings are
// tagged `.blind`; string findings (unknowns/varSubs) are tracked here.
const blindOnly = new Set();

// Operand-position findings (F-051, F-047's first-pass sibling): a `gs-admin`
// word standing as an ARGUMENT to another command or as echoed/redirected text
// (`echo gs-admin jo p save > notes.txt`, `which gs-admin`) scans exactly like
// a real invocation, asks (correct, fail-closed), and then journaled in the
// same shape as a genuine mutation with no caveat. The hook can tell the two
// apart from the matched token's position: a real invocation starts a command
// segment — a segment-start index from the lexer (first word, word after an
// unquoted newline, word after a control operator or an opener), or the word
// right after a `;` `|` `&` `(` / substitution-opener token, or after a shell
// keyword that introduces a command (`do`, `then`, `if`, `{`, …).
// Anything else is operand position and gets a BLIND_NOTE-style caveat on the
// prompt and the journal entry. Known accepted false-caveats (`FOO=1
// gs-admin …`, `xargs gs-admin …`, `sudo`/`nohup`/`timeout N` wrappers DO
// execute): the note asks the reader to verify, and the decision is still
// "ask" either way — a caveat can mislabel, never loosen. Object findings are
// tagged `.operand`; string findings are tracked here (text-keyed like
// blindOnly, so a string seen in both positions carries the caveat — same
// verify-direction trade; the `` `…` `` varSubs placeholder collides by
// construction, same accepted direction).
const CMD_SEPARATORS = new Set([...CONTROL_OPS, "(", "`", "$(", ">(", "<("]);
const CMD_KEYWORDS = new Set([
  "do", "then", "else", "elif", "if", "while", "until", "{", "!", "time",
]);
const operandOnly = new Set();
// Text-keyed like blindOnly/operandOnly: an unknown or variable-subcommand
// invocation that was not its command line's last stage (F-428's masked axis;
// the release-gate review found the axis wired only into catalog-matched hits).
const maskedText = new Map(); // text → "stage" | "enclosing"
// The command NAME was an expansion or a variable the shell resolves at run
// time (F-441) — the printable spelling, for the ask's caveat.
const expansionNames = new Set();

// Nested shell interpreters (F-194): a mutating command inside a nested
// shell's QUOTED payload — `bash -c 'gs-admin jo p save'`,
// `powershell -Command "gs-admin jo p save"` — was completely invisible. The
// cheap gate and the boundary regex both pass (the char before gs-admin is a
// quote, which both accept), but shellWords treats quotes as grouping, so the
// payload collapses to the single token "gs-admin jo p save", which
// isGsAdminWord rejects; quotes are balanced, so the quote-blind pass never
// ran. No ask AND no journal (the scan runs before the isPost branch) — the
// fail-open-and-silent direction the tenets forbid (cf. F-112). Fix: when a
// token is a known interpreter followed by its command-string flag, re-run
// scanWords over the quoted payload token's text. Interpreter names normalize
// through normalizeProg, so path prefixes and launcher suffixes
// (powershell.exe, C:\Windows\...\cmd.exe /c) match like the bare names.
// Flags per family: POSIX shells accept `-c` anywhere in a combined
// short-option cluster (-lc, -cx …; lowercase only — bash -C is noclobber);
// PowerShell accepts any prefix abbreviation of -Command (-c … -command;
// -EncodedCommand is base64 and stays out of scope); cmd takes /c and /k.
// Payloads can nest (`bash -c "bash -c '…'"`), so the re-scan recurses,
// bounded — nesting deeper than the bound falls back to today's behavior.
// Re-tokenizing a payload can flip unbalancedQuote (an odd quote INSIDE the
// payload), which triggers the top-level quote-blind pass — union-only, so it
// can only add asks. Recognizing more spellings only ever ADDS asks
// (tenet 3); a re-scanned read-only payload still passes silently.
//
// A THIRD family, `noflag` (F-245): the shape above is name-plus-flag, which
// structurally cannot express an interpreter that takes no command-string flag
// at all. `eval 'gs-admin jo p save'` is the common way a POSIX shell runs a
// command it holds as a string, and it was invisible for exactly the F-194
// reason — one collapsed token, balanced quotes, no ask and no journal. Its
// payload is simply the next non-operator word (flag-shaped tokens are skipped,
// so `eval -- '…'` re-scans too).
//
// BOTH shells' eval belong here (F-249): the family shipped POSIX-only, so
// PowerShell's `Invoke-Expression` and its `iex` alias — the same construct,
// on a hook registered for the PowerShell matcher — stayed invisible by the
// identical trace. `-Command` is a real parameter of Invoke-Expression, and
// the option-skipping payload rule below already handles `iex -Command '…'`
// with no extra case. Names normalize through normalizeProg, so the `IEX`
// spelling folds too.
// `command` remains deliberately EXCLUDED, and F-249 sharpens rather than
// weakens that call: `command` takes a command NAME plus args, so a quoted
// whole-command string is not a payload it would ever run, and listing it
// would assert an interpreter relationship that does not exist. The test is
// whether the interpreter runs a command STRING — which is exactly why
// Invoke-Expression is in and `command` is out. `dash` and `ksh` join the
// posix family for completeness.
//
// KNOWN RESIDUALS, all falling back to pre-F-194 behavior — this list is the
// tree's copy of record and must name every one the bus accepts (F-245: the
// F-194 record claimed the residuals were documented here while this comment
// named only three of them, so a reader of the CODE saw a narrower accepted set
// than the one actually accepted).
//
// THE LIST ITSELF IS NOT RESTATED HERE (F-246). It lives in exactly one place —
// hooks/guard-residuals.json — read by test/guard-fixtures.mjs (which derives
// the residual pins from it, so closing a residual reds the suite) and by
// build/check-doc-drift.mjs (which holds the plugin README's user-facing copy
// to the same set, both directions). That file is DOCUMENTATION DATA: this hook
// never reads it at runtime and the self-containedness tenet above is intact.
// Three hand-synced copies is what F-246 recorded and F-247 demonstrated live;
// a pointer is not a fourth copy.
//
// Four things that are NOT residuals, noted here because their absence from that
// file is deliberate rather than an oversight: bash's `-C` is noclobber, not a
// command flag, so nothing runs from it; an unquoted `cmd /c` payload draws
// the operand-position caveat (accepted F-051 class) but still ASKS; a heredoc
// fed straight to an interpreter (`bash <<'EOF' … EOF`) executes its body and
// asks with the same caveat (the verify-direction trade, same class as
// `xargs gs-admin`); and a here-string piped into `iex` is denied by the
// pipe-safety lint before any payload rule runs. A residual is a spelling where
// a mutation EXECUTES unseen — none of these qualifies. (The variable-fed eval
// that DOES qualify — `$s = @'…'@` then `iex $s`, `eval "$s"` — is in the file.)
//
// CLOSED and no longer residuals (F-247, Bradley-directed): option-after-flag
// spellings (`bash -c -x '…'`, `bash -c -- '…'`) and positional powershell
// payloads (`powershell "…"` with no -Command). Both were accepted by judgment
// rather than by constraint, and both were cheap to close — see the payload
// rule at the top of scanWords. Keep this paragraph: it is the record that the
// two were considered, closed, and are expected to STAY closed.
const NESTED_SHELLS = new Map([
  ["bash", "posix"], ["sh", "posix"], ["zsh", "posix"],
  ["dash", "posix"], ["ksh", "posix"],
  ["pwsh", "pwsh"], ["powershell", "pwsh"],
  ["cmd", "cmd"],
  ["eval", "noflag"],
  ["invoke-expression", "noflag"], ["iex", "noflag"],
  // Programs that run a STRING as a command line (the oracle's rows, F-436
  // third pass): `env -S '…'` splits its argument into a command line;
  // `watch '…'` hands its first non-option argument to sh -c, repeatedly.
  ["env", "env"], ["watch", "watch"],
]);
const NESTED_PAYLOAD_FLAG = {
  posix: /^-[A-Za-z]*c[A-Za-z]*$/,
  pwsh: /^-c(?:o(?:m(?:m(?:a(?:n(?:d)?)?)?)?)?)?$/i,
  cmd: /^\/[ck]$/i,
  env: /^(-S|--split-string)$/,
  noflag: null, // no command-string flag exists — payload is the next word
  watch: null,
};
// Options of a payload runner that TAKE A VALUE, so the value is never read as
// the payload (`watch -n 5 'gs-admin …'`: the payload is the string, not `5`).
const NESTED_VALUE_OPTIONS = { watch: /^(-n|--interval)$/ };
// Families whose reported status is the INTERPRETER's own, never the
// payload's code (F-438's class, the Step 0 review): PowerShell's -Command
// reports 0 or 1 for its last statement; watch re-runs its payload and exits
// on its own terms. bash/sh/zsh/dash/ksh -c, cmd /c, eval, env -S and iex
// propagate the code verbatim. A journal row for a call inside one of these
// is qualified "nested" — a fact of the family table, stated beside its
// flag and value-option tables rather than as a clause at the rescan.
const NESTED_REPORTS_OWN_STATUS = new Set(["pwsh", "watch"]);
const NESTED_SCAN_DEPTH = 3;

// Scan one tokenization for gs-admin invocations, appending to the shared
// result arrays. Factored out so the quote-blind fallback pass (below) can run
// the identical logic over a second tokenization without duplicating it, and
// so the nested-interpreter re-scan (F-194) can recurse into quoted payloads.
// Is the exit status of the segment starting at `idx` what the shell reports
// for the whole command line? (F-428.) The harness's PostToolUse event and any
// exit code it carries describe the LINE — `gs-admin … | head` succeeds when
// head does, `gs-admin …; echo done` exits with echo's status — so a journal
// row for a call that was not the line's last stage cannot say "completed"
// from those signals. The only boundary that preserves the call's failure is
// `&&` (a later stage runs only if this one succeeded, and a failure here IS
// the line's failure); every other boundary after the segment — `|`, `||`,
// `;`, `&`, a subshell close, a newline-separated next command — masks it.
// The lexer emits `&&` and `||` as single tokens and folds `2>&1` / `&>` into
// redirection words, so this reader never re-derives either from adjacency
// (F-436, third pass). Caveat direction: a construct read as a
// boundary that is not one (a `)` closing a subshell group) QUALIFIES a row
// that could have said "completed" — it never lets a masked row assert.
// Returns false, "stage" (a later pipeline stage or chained command on this
// line hides this call's status — F-428) or "enclosing" (this call ran INSIDE
// a substitution, so the harness reported the enclosing command's status, not
// this call's — F-438). Both are read from what the lexer recorded: segment
// starts, and the substitution spans. A substitution's inner command is not
// a later stage of the line it sits in (`cmd > >(cat)` reports cmd's own
// status), and a call inside one is never the line's status at all.
// …and two more shapes the shell-oracle test surfaced (F-438, third pass):
// "background" — the call's segment ends in `&`, so the line's status is never
// this call's; "negated" — the segment begins with `!`, so the line's status is
// the inverse of this call's. Both are read from the tokens, like the rest.
// "nested" (the Step 0 review's row `powershell -c '…'`, F-438's class): a
// call inside a nested PowerShell's payload — PowerShell's -Command reports
// success or failure of its last statement as 0 or 1, never a native command's
// own code, so the harness's status is the interpreter's. (bash -c, sh -c,
// cmd /c, eval, env -S and iex propagate the code verbatim and are not
// qualified for nesting alone.)
/** @typedef {false | "stage" | "enclosing" | "background" | "negated" | "nested"} MaskKind — why a line's status is not this call's, or false */
/**
 * @param {string[]} words
 * @param {Set<number>} segStartSet
 * @param {number} idx
 * @param {Map<number, {close: number, kind: string}>} [subs]
 * @returns {MaskKind}
 */
function segmentMasked(words, segStartSet, idx, subs = new Map()) {
  for (const [open, { close }] of subs) if (open < idx && idx < close) return "enclosing";
  let segStart = idx;
  while (segStart > 0 && !segStartSet.has(segStart)) segStart--;
  if (words[segStart] === "!") return "negated";
  for (let k = idx + 1; k < words.length; k++) {
    const sub = subs.get(k);
    if (sub) { k = sub.close; continue; } // a substitution is one word of this command, not a later stage
    if (words[k] === "&" && (k + 1 === words.length || segStartSet.has(k + 1))) return "background";
    if (!segStartSet.has(k)) continue;
    if (words[k - 1] === "&&") continue; // a later stage cannot hide this one's failure
    return "stage";
  }
  return false;
}

/** @typedef {{op: string, glued: string} | {role: "target" | "delim"}} RedirRecord — what the lexer read for a word of a redirection */
/**
 * @param {string[]} words
 * @param {Set<number>} segStartSet
 * @param {number} [depth]
 * @param {MaskKind} [outerMasked]
 * @param {Map<number, number>} [inert]
 * @param {Map<number, RedirRecord>} [redirs]
 * @param {Map<number, {close: number, kind: string}>} [subs]
 * @param {Map<number, {close: number, kind: string}>} [spans]
 * @param {Set<number>} [quoted]
 * @param {Map<number, string>} [arith]
 */
function scanWords(words, segStartSet, depth = 0, outerMasked = false, inert = new Map(), redirs = new Map(), subs = new Map(), spans = new Map(), quoted = new Set(), arith = new Map()) {
// Command position (F-051): the first word of a segment, or the word after a
// separator or a command-introducing keyword; a heredoc-body word (`inert`) is
// DATA of the command that opened the heredoc, whatever precedes it on its own
// line — read from what the lexer recorded, never from adjacency alone.
const cmdPosAt = (k) =>
  !inert.has(k) &&
  (k === 0 || segStartSet.has(k) || CMD_SEPARATORS.has(words[k - 1]) || CMD_KEYWORDS.has(words[k - 1]));
// Inner gs-admin words in OPERAND position of a span already read as an
// invocation's NAME (F-441, below): the `gs-admin` inside `$(which gs-admin)`
// is that name's spelling, not a second call. An inner gs-admin at command
// position (`$(gs-admin jo p save)`) is a call and is never claimed.
const claimedInner = new Set();
for (let i = 0; i < words.length; i++) {
  const w = words[i];
  // An arithmetic expansion's interior is re-scanned ADDITIVELY (the
  // release-gate /security-review of 0.37.0): the span stays one word for the
  // readers below (F-433), but bash expands a substitution nested inside
  // `$(( … ))` before evaluating it — `$((x=$(gs-admin jo p save)))` runs the
  // call — so its text is scanned as a nested command of its own, "enclosing"
  // (a call inside it ran inside a substitution). The bare `$((gs-admin jo p
  // save))` never runs in bash and draws an over-ask here: the safe direction.
  if (arith.has(i) && depth < NESTED_SCAN_DEPTH) {
    const sub = shellWords(arith.get(i));
    scanWords(sub.words, sub.starts, depth + 1, "enclosing", sub.inert, sub.redirs, sub.subs, sub.spans, sub.quoted, sub.arith);
  }
  // Nested-interpreter payload re-scan (F-194) — see the comment above. The
  // interpreter word itself can never be a gs-admin word, so flow just falls
  // through to the ordinary scan afterwards (an UNQUOTED payload's words are
  // separate tokens the ordinary scan already sees; its single-token re-scan
  // finds no subcommand words and adds nothing, so nothing double-counts).
  const shellKind = NESTED_SHELLS.get(normalizeProg(w));
  if (shellKind && depth < NESTED_SCAN_DEPTH) {
    // ONE payload-locating rule for every family (F-247). The payload used to
    // be read as the token immediately after the command-string flag, which
    // any intervening option defeated: `bash -c -x 'payload'` and
    // `bash -c -- 'payload'` both took the OPTION as the payload, re-scanned
    // two harmless characters, and gave up — the documented option-after-flag
    // residual. The payload is instead the first following token that is
    // neither an operator nor option-shaped, which is also what already made
    // `eval -- '…'` work.
    const isOption = (t) => t.startsWith("-") || (shellKind === "cmd" && t.startsWith("/"));
    const valueOpt = NESTED_VALUE_OPTIONS[shellKind];
    let payloadFound = false;
    const rescanText = (p) => {
      const sub = shellWords(p);
      // The interpreter's own position masks everything inside its payload
      // too (`bash -c 'gs-admin …' | cat`) — F-428. A nested PowerShell masks
      // by itself: its -Command reports 0 or 1, never the call's code ("nested").
      const payloadMasked = outerMasked || (NESTED_REPORTS_OWN_STATUS.has(shellKind) ? "nested" : segmentMasked(words, segStartSet, i, subs));
      scanWords(sub.words, sub.starts, depth + 1, payloadMasked, sub.inert, sub.redirs, sub.subs, sub.spans, sub.quoted, sub.arith);
      payloadFound = true;
    };
    const rescanFrom = (from) => {
      for (let k = from; k < words.length; k++) {
        const p = words[k];
        if (redirs.has(k)) continue; // a redirection word is never the payload (F-447: `bash -c > f '…'`)
        if (SEPARATORS.has(p)) return; // payload never crosses a command boundary
        if (isOption(p)) { if (valueOpt?.test(p)) k++; continue; } // an option, with its value when it takes one
        rescanText(p);
        return;
      }
    };
    // `noflag` interpreters (eval — F-245; watch) have no command-string flag
    // to find: the payload rule above applies straight from the next token.
    if (NESTED_PAYLOAD_FLAG[shellKind] === null) rescanFrom(i + 1);
    else {
      for (let j = i + 1; j < words.length; j++) {
        const t = words[j];
        if (redirs.has(j)) continue; // `bash > f -c '…'`: the redirection is not the flag and not the payload
        if (SEPARATORS.has(t)) break;
        if (NESTED_PAYLOAD_FLAG[shellKind].test(t)) {
          rescanFrom(j + 1);
          break;
        }
        // PowerShell runs a POSITIONAL first argument as a command string, so
        // `powershell "gs-admin jo p save"` with no -Command really executes —
        // the second closed residual (F-247). This is pwsh-only on purpose: a
        // positional argument to bash/sh/zsh/dash/ksh or to cmd is a SCRIPT PATH,
        // not a command string, so treating one as a payload there would assert
        // an execution that does not happen. Non-option tokens stay skipped for
        // those families, exactly as before.
        if (shellKind === "pwsh" && !isOption(t)) {
          rescanFrom(j);
          break;
        }
      }
    }
    // STDIN payloads the line CARRIES (F-436 third pass — the oracle's
    // `bash <<< '…'` and `echo '…' | bash` rows): an interpreter with no
    // command-string argument reads its commands from stdin, and when that
    // text is on the line — a here-string's target, or the words of the
    // upstream pipeline stage — it is re-scanned as the payload. A heredoc
    // body is already data of the command that opened it. Text the line does
    // NOT carry (a file, another program's output) is the documented
    // `stdin-payload` residual.
    if (!payloadFound) {
      for (let k = i + 1; k < words.length && !SEPARATORS.has(words[k]); k++) {
        // Which redirection a word is comes from the lexer's record — the
        // reader used to re-match the fd-prefix grammar on the word's text
        // (F-443, a second home for FD_PREFIX).
        const r = redirs.get(k);
        if (r && "op" in r && r.op === "<<<") { rescanText(r.glued !== "" ? r.glued : (words[k + 1] ?? "")); break; }
      }
    }
    if (!payloadFound && (words[i - 1] === "|" || words[i - 1] === "|&")) {
      let a = i - 2;
      while (a > 0 && !segStartSet.has(a)) a--;
      const upstream = [];
      for (let k = Math.max(a, 0); k < i - 1; k++) if (!redirs.has(k) && !SEPARATORS.has(words[k])) upstream.push(words[k]);
      if (upstream.length) rescanText(upstream.join(" "));
    }
  }
  if (claimedInner.has(i)) continue;
  // The command NAME the shell resolves when the line runs (F-441): a
  // substitution or an expression standing where the name goes — `$(which
  // gs-admin) jo p save`, `` `which gs-admin` jo p save ``, PowerShell's
  // `& (Get-Command gs-admin) jo p save` — a quoted expansion (`"$(which
  // gs-admin)" jo p save`), or a variable (`n=gs-admin; $n jo p save`, `& $c jo
  // p save`) on a line that names the binary (the command-text gate passed, so
  // it does). Keying on the bare word let every one of these run in silence.
  // At COMMAND position such a word IS the invocation: its name is unreadable,
  // its arguments are the words after it (after the span's closer), and the
  // ask carries the caveat — an unreadable name is never silence. An
  // assignment (`$s = …`, `$s=…`) sets a variable and runs nothing; skipped.
  // The rule is about NAMES the shell computes: a command substitution, a
  // backtick substitution, the call-operator expression, a variable, or a
  // word carrying an expansion. A subshell or a group at command position is
  // a compound command whose inner words are scanned on their own turn.
  // Which computed words NAME a command is the SHELL's grammar, read per tool
  // (the MEDIUM review's altitude finding — a "strength of evidence" knob had
  // stood in for it): in bash a substitution or a variable at command
  // position is the command name (`$(which gs-admin) jo p save`, `$n jo p
  // save`); in PowerShell a statement that begins with `$x` or `$(…)` is an
  // EXPRESSION and never invokes anything (`$env:PATH -split ';'`, `foreach
  // ($x in $ids)`), and the call operator `&` is the one way a computed value
  // becomes a command name (`& $c jo p save`, `& (Get-Command gs-admin) jo p
  // save`, `& ('gs-admin') jo p save`). The reading is ADDITIVE: the span's
  // inner words are still scanned on their own turn — `$(gs-admin jo p save)`
  // is an inner call, asked as one — and only an inner gs-admin word in
  // OPERAND position (`which gs-admin`, `Get-Command gs-admin`) is claimed as
  // the name's spelling rather than read as a second call.
  let argStart = i + 1;
  let nameFrom = null;
  if (!isGsAdminWord(w)) {
    const span = spans.get(i);
    // An assignment (`$s = …`, `$s=…`) sets a variable and runs nothing — never
    // a name, whatever else the word carries.
    const assignment = /^\$[^=\s]*=/.test(w) || words[i + 1] === "=";
    const computedWord = span
      ? span.kind === "cmdsub" || span.kind === "bq" || span.kind === "expr"
      : !assignment && (/[$`]/.test(w) || (quoted.has(i) && /gs-admin/i.test(w)));
    const namesCommand = computedWord && (isPowerShell ? words[i - 1] === "&" : cmdPosAt(i));
    if (!namesCommand) continue;
    nameFrom = printable(span ? words.slice(i, span.close + 1).join(" ") : w, 80);
    if (span) {
      for (let k = i + 1; k < span.close; k++) if (isGsAdminWord(words[k]) && !cmdPosAt(k)) claimedInner.add(k);
      argStart = span.close + 1;
    }
  }
  // Command position vs operand position — see the F-051 comment above (a name
  // read from an expansion is at command position by construction).
  const cmdPos = nameFrom !== null || cmdPosAt(i);

  // Collect this invocation's args, stripping global flags wherever they appear
  // (flag tokens are kept separately — ask-override exemption args like
  // `--test-run` live there, never among the subcommand words)
  const rest = [];
  const flags = [];
  // A backtick standing where the subcommand should be means the subcommand
  // itself comes from a command substitution (`gs-admin `echo jo` p save`) —
  // unreadable, so it belongs in the variable-subcommand coaching path, not
  // silently skipped. A backtick AFTER the subcommand words is just the close
  // of an enclosing substitution (`echo `gs-admin jo p save``) and must not
  // suppress the ordinary match. Splitting backticks into their own tokens is
  // what makes the second case visible at all; this keeps the first case from
  // regressing into silence.
  // masked (F-428): the line's exit status is not this call's — see segmentMasked.
  // Computed here, once, so every finding shape below (hit, override hit,
  // unknown, variable subcommand) carries it.
  // For a name read from a span the walk starts at the span's closer: the
  // span's inner words are the name, not later stages of the call.
  const masked = outerMasked || segmentMasked(words, segStartSet, argStart - 1, subs);
  let substitutedSubcommand = false;
  for (let j = argStart; j < words.length; j++) {
    const t = words[j];
    // `- target:` fidelity (F-431): an invocation's arguments never cross a
    // segment boundary (the next line is its own command — before this, a
    // two-line command journaled line 2 as line 1's target), never run into a
    // heredoc's data or out of it, and a body hit's text stays on its own body
    // line. Boundaries are read from what the tokenizer recorded, not from
    // adjacency.
    // A redirection is NOT a boundary (F-436): its words — the operator, a
    // bare operator's target, a heredoc's delimiter — are stepped over, and
    // collection continues, because the shell gives the words after them to
    // this command. F-431 made the heredoc word a boundary for the target's
    // sake and thereby emptied the collection whenever the redirection came
    // FIRST, and an empty collection reads as "no invocation" below — the
    // mutation in `gs-admin <<EOF jo p save` ran without an ask or a journal
    // row. Which words are redirections is the TOKENIZER's decision (it saw the
    // quotes; a quoted `'<<EOF'` is an argument), never a re-test of the word
    // here — the F-433 rule, applied to this walk.
    // A substitution — `$(…)`, `\`…\``, `>(…)`, `<(…)` — is ONE word of this
    // command (the shell hands it text or a /dev/fd path): the target when a
    // bare redirection precedes it, otherwise an argument — or, standing where
    // the subcommand should be (`gs-admin \`echo jo\` p save`), the
    // unreadable subcommand itself, which is the variable-subcommand coaching
    // path (F-244), not silence. Its inner command is a segment of its own,
    // scanned on its own turn, and stepped over here.
    if (subs.has(j)) {
      const { close, kind } = subs.get(j);
      if (redirs.has(j)) { /* the redirection's target */ }
      else if (!rest.length && kind !== "procsub") { substitutedSubcommand = true; break; }
      else rest.push(t + "…" + (kind === "bq" ? "`" : ")"));
      j = close;
      continue;
    }
    if (segStartSet.has(j)) break;
    if (inert.has(j) !== inert.has(i)) break;
    if (inert.has(i) && inert.get(j) !== inert.get(i)) break;
    if (redirs.has(j)) continue;
    // An UNCLOSED substitution opener where the subcommand should be (`gs-admin
    // \`jo p save` — PowerShell's backtick escape; a `$(` never closed): no span
    // was recorded, so it is the unreadable subcommand, coached, never silence
    // (the review's removed-behaviour finding — the old collector read a bare
    // backtick token this way).
    if (!rest.length && (t === "`" || t === "$(")) { substitutedSubcommand = true; break; }
    if (SEPARATORS.has(t)) break; // a control operator, a subshell/group boundary, or a substitution's CLOSER
    if (t.startsWith("-")) {
      flags.push(t);
      // Skip the flag's value: never a redirection word (the shell hands
      // `--format >f json` to the CLI as `--format json` — F-443), a
      // substitution whole.
      if (valueFlags.has(t.split("=")[0]) && !t.includes("=")) { do { j++; } while (j < words.length && redirs.has(j)); if (subs.has(j)) j = subs.get(j).close; }
      // Secret-bearing flag values must not land in `rest`: `rest` becomes the
      // journal's `- target:` field and the unknown-command prompt text, so a
      // value the catalog doesn't declare (hence not in valueFlags) would be
      // written out verbatim. Consumed wherever the flag stands — global flags
      // go BEFORE the subcommand in this CLI, and gating on a collected
      // subcommand word let `gs-admin --client-secret X jo p save` push X into
      // `rest`, unredacted, via the unknown branch. The only guard kept is that
      // the next token must not itself be flag-shaped; the accepted trade is
      // that a hypothetical BOOLEAN secret-named flag standing directly before
      // the subcommand would swallow it and land on the fail-closed unknown ask
      // (v1.0.4 ships no such flag; the failure direction is an ask, not a leak).
      else if (isSecretFlag(t) && !t.includes("=")) {
        let v = j + 1;
        while (v < words.length && redirs.has(v)) v++; // a redirection word is never the value (F-443)
        if (words[v] !== undefined && !words[v].startsWith("-")) { j = v; if (subs.has(j)) j = subs.get(j).close; }
      }
      continue;
    }
    rest.push(t);
  }
  if (substitutedSubcommand) {
    if (nameFrom !== null) expansionNames.add(nameFrom);
    varSubs.push("`…`");
    if (!cmdPos) operandOnly.add("`…`");
    if (masked) maskedText.set("`…`", masked);
    continue;
  }
  if (!rest.length) {
    // A bare `gs-admin` — no subcommand words on its line. At COMMAND position
    // that is the binary printing its help. As another command's ARGUMENT
    // (`… | xargs gs-admin`, `parallel gs-admin`) the words come from
    // elsewhere and nothing on this line can read them — fail closed (F-436
    // third pass, the oracle's xargs row). `which gs-admin` draws the same
    // ask; a spelling the guard cannot read is never silent.
    if (cmdPos) continue;
    const text = "(no subcommand words on this line — the enclosing command supplies them, as xargs and parallel do, or none run)";
    unknowns.push(text);
    operandOnly.add(text);
    if (masked) maskedText.set(text, masked);
    continue;
  }

  // Candidate token sequences: as written, plus first token swapped through the alias map
  const candidates = [rest];
  if (aliasToNs.has(rest[0])) candidates.push([aliasToNs.get(rest[0]), ...rest.slice(1)]);
  if (nsToAlias.has(rest[0])) candidates.push([nsToAlias.get(rest[0]), ...rest.slice(1)]);

  let matched = null;
  let matchedLen = 0;
  outer: for (const cand of candidates) {
    for (let n = Math.min(maxWords, cand.length); n >= 1; n--) {
      const cmd = known.get(cand.slice(0, n).join(" "));
      if (cmd) { matched = cmd; matchedLen = n; break outer; } // longest match wins
    }
  }
  if (matched && nameFrom !== null) expansionNames.add(nameFrom);
  if (matched?.mutating) hits.push({ cmd: matched, args: rest.slice(matchedLen), operand: !cmdPos, masked });
  // Ask-override: the catalog would let this command pass silently, but a
  // verified-mislabel entry matches — force an ask. Consulted only on this
  // catalog-passes branch, so an override can never alter a command the
  // catalog already asks on (it adds asks, nothing else) — which is also what
  // implements self-retirement: once upstream flips the flag, the mutating
  // branch above wins and the entry is dead code until deleted. Entries may
  // name the canonical or the short path. The exemption is the LITERAL
  // safe-mode token only — an `=`-glued form (`--test-run=false`) still asks,
  // because a valued form can just as well disable the safe mode; when in
  // doubt, ask. A malformed exemption field never exempts (see load comment).
  else if (matched) {
    const ov = askOverrides.find(
      (o) =>
        (o.path === matched.path || o.path === matched.shortPath) &&
        !(
          typeof o.unlessArgPresent === "string" &&
          o.unlessArgPresent.startsWith("-") &&
          flags.includes(o.unlessArgPresent)
        )
    );
    if (ov) overrideHits.push({ cmd: matched, args: rest.slice(matchedLen), ov, operand: !cmdPos, masked });
  }
  // Fail closed: a gs-admin command the catalog doesn't know could be a
  // mutating action added in a newer CLI — ask instead of passing silently.
  // An unmatched invocation with a shell variable/splat/substitution anywhere
  // in its subcommand words ($c, ${c}, jo $cmd, @args, `…`) is its own case:
  // the text can't be checked at all, so coach a literal rewrite instead of
  // the typo/newer-CLI message. (Matched commands never reach here — a
  // variable in a flag value like `--page $p` doesn't hide the subcommand.)
  else if (!matched) {
    const text = rest.join(" ");
    if (nameFrom !== null) expansionNames.add(nameFrom);
    (rest.some((t) => /^[$@`]/.test(t)) ? varSubs : unknowns).push(text);
    if (!cmdPos) operandOnly.add(text);
    if (masked) maskedText.set(text, masked);
  }
}
}

scanWords(words, segStarts, 0, false, segInert, segRedirs, segSubs, segSpans, segQuoted, segArith);

// Quote-blind second pass: only when the quote-aware tokenization ended
// mid-quote, i.e. the parse is untrustworthy (see shellWordsQuoteBlind).
// Findings are UNIONed, deduped, never subtracted — a mutation the first pass
// already saw is not double-prompted, and a read-only command that merely
// contained a stray apostrophe still produces nothing.
if (unbalancedQuote) {
  const before = {
    hits: new Set(hits.map((h) => JSON.stringify([h.cmd.path, h.args]))),
    overrideHits: new Set(overrideHits.map((h) => JSON.stringify([h.cmd.path, h.args]))),
    unknowns: new Set(unknowns),
    varSubs: new Set(varSubs),
  };
  const fresh = { hits: [], overrideHits: [], unknowns: [], varSubs: [] };
  const stash = [hits.length, overrideHits.length, unknowns.length, varSubs.length];
  const blindPass = shellWordsQuoteBlind(command);
  scanWords(blindPass.words, blindPass.starts, 0, false, blindPass.inert, blindPass.redirs, blindPass.subs, blindPass.spans, blindPass.quoted, blindPass.arith);
  // Everything appended by the second pass, minus what the first pass already had.
  for (const h of hits.splice(stash[0]))
    if (!before.hits.has(JSON.stringify([h.cmd.path, h.args]))) fresh.hits.push(h);
  for (const h of overrideHits.splice(stash[1]))
    if (!before.overrideHits.has(JSON.stringify([h.cmd.path, h.args]))) fresh.overrideHits.push(h);
  for (const u of unknowns.splice(stash[2])) if (!before.unknowns.has(u)) fresh.unknowns.push(u);
  for (const v of varSubs.splice(stash[3])) if (!before.varSubs.has(v)) fresh.varSubs.push(v);
  for (const h of fresh.hits) { h.blind = true; hits.push(h); }
  for (const h of fresh.overrideHits) { h.blind = true; overrideHits.push(h); }
  for (const u of fresh.unknowns) { blindOnly.add(u); unknowns.push(u); }
  for (const v of fresh.varSubs) { blindOnly.add(v); varSubs.push(v); }
}

// ── Change journal (PostToolUse): the command ran, so any mutation in it was
// approved — record it. Unknown-to-catalog commands are journaled too (same
// fail-closed reasoning as the ask above: they may have mutated).
if (isPost) {
  if (hits.length || overrideHits.length || unknowns.length || varSubs.length)
    await journalMutations();
  process.exit(0);
}

// ── Variable-subcommand coaching: `gs-admin $cmd` (loops, splats) hides the
// actual subcommand from the guard entirely, so even read-only batches would
// land on the fail-closed "unknown command" prompt. Mirror the pipe lint:
// deny the first offense per invocation per session with a rewrite hint so
// the model self-corrects to literal subcommands (which pass silently when
// read-only); a repeat escalates to a human "ask" — fail-closed, because the
// variable could expand to a mutation and this prompt is then the only gate.
let varAskPart = null;
if (varSubs.length) {
  // Bounded like its sibling clauses (unknowns, promoted — tenet 4): a loop
  // unrolled into 50 `gs-admin $cmd` segments must not print 50 entries into
  // the prompt (F-363). The one `shown` string feeds both the deny below and
  // the escalated ask, so both are bounded here.
  const shown =
    varSubs.slice(0, 5).map((u) => `\`gs-admin ${printable(u, 80)}\``).join(", ") +
    (varSubs.length > 5 ? ` (+${varSubs.length - 5} more)` : "");
  const key = "var:" + invocationKey(words, segRedirs);
  const denied = readDenied();
  // Repeat offense — or a deny we cannot record (see recordDeny) — escalates
  // to the human prompt instead of a denial loop.
  if (denied.includes(key) || !recordDeny(key, denied)) {
    varAskPart =
      `This command passes a gs-admin subcommand through a shell variable (${shown}) that the ` +
      `guard cannot inspect — if it expands to a mutating command, this prompt is the only gate. ` +
      `Approve only if you know exactly what it expands to.`;
  } else {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason:
            `The gs-admin subcommand here is a shell variable (${shown}), so the mutation guard ` +
            `cannot check it before it runs. Rewrite with the domain/group/command words spelled ` +
            `literally — variables are fine in flag values and paths, e.g. ` +
            "`gs-admin --json re rules list --page $p > $out` — then retry. " +
            `Literal read-only commands run without any prompt.`,
        },
      }),
      () => process.exit(0) // exit in the write callback (F-363 — see the lint deny above)
    );
    await new Promise(() => {});
  }
}

if (hits.length || overrideHits.length || unknowns.length || varAskPart || lintAskPart) {
  // F-284: cmdKey, not raw .path — a shortPath-only workspace entry must still
  // name the command in the headline (it already did in the journal via cmdKey).
  const names = [...new Set(hits.map((h) => `gs-admin ${cmdKey(h.cmd)}`))].join(", ");

  // Tenant awareness: the workspace manifests say which tenant(s) this dir documents,
  // but the CLI's *active* login may differ — make the human confirm the target.
  // Manifest fields are untrusted (a cloned repo could craft them to make this
  // prompt reassuring): clamp to printable ASCII + 80 chars and phrase as a claim.
  const clean = (v) => printable(v, 80);
  let tenantNote = "Confirm the active tenant (`gs-admin whoami`) is the intended target before approving.";
  try {
    const tenants = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (!direntIsDir(dir, e)) continue; // junction-tolerant (F-134)
      const mPath = join(dir, e.name, "_manifest.json");
      if (!existsSync(mPath)) continue;
      try {
        const m = readJsonFileTolerant(mPath); // BOM-tolerant (F-118) — a BOM'd manifest silently dropped this tenant
        tenants.push({
          slug: clean(m.slug ?? e.name),
          url: clean(m.baseUrl ?? "unknown URL"),
          env: m.environment === "production" || m.environment === "sandbox" ? m.environment : null,
        });
      } catch { /* unreadable manifest — skip */ }
    }
    // Production detection: trust the environment recorded in the manifest at
    // setup time. Manifests that predate the field fall back to whole-token
    // matching on slug+URL (a slug that says prod, or no sandbox-ish token
    // while a sibling tenant has one). Wording only; the decision stays "ask".
    const SBX_TOKENS = new Set(["sandbox", "sbx", "stg", "stag", "stage", "staging", "test", "dev", "uat", "qa"]);
    const tokensOf = (t) => `${t.slug} ${t.url}`.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const sbxLike = (t) =>
      t.env ? t.env === "sandbox" : tokensOf(t).some((w) => SBX_TOKENS.has(w));
    const anySbx = tenants.some(sbxLike);
    const prodKnown = tenants.some((t) => t.env === "production");
    const isProdLike = (t) => {
      if (t.env) return t.env === "production"; // recorded environment is exact — no guessing
      const words = tokensOf(t);
      if (words.includes("prod") || words.includes("production")) return true;
      return anySbx && !sbxLike(t);
    };
    const prodLike = tenants.some(isProdLike);
    // The list is capped at five names — the same per-list clamp unknowns and
    // promoted use in this prompt (tenet 4). Uncapped, a workspace of 100
    // tenant directories made a 17 KB reason (F-363: 165 bytes per directory,
    // unreadable in a permission prompt and, on a macOS pipe, cut mid-JSON).
    // When the list IS cut, production-like tenants lead the shown five so the
    // ⚠ warning below still names the tenant it is about; an uncut list keeps
    // directory order. The tail says how many are not shown — never hidden.
    const SHOWN_TENANTS = 5;
    const ordered =
      tenants.length > SHOWN_TENANTS
        ? [...tenants.filter(isProdLike), ...tenants.filter((t) => !isProdLike(t))]
        : tenants;
    const labels = ordered.slice(0, SHOWN_TENANTS).map((t) => `${t.slug} (${t.url})`);
    const moreTenants = tenants.length > SHOWN_TENANTS ? `; and ${tenants.length - SHOWN_TENANTS} more` : "";
    const prodWarn = prodLike
      ? prodKnown
        ? " ⚠ At least one of these tenants is PRODUCTION (recorded at setup) — verify the target before approving."
        : " ⚠ At least one of these tenants looks like PRODUCTION — verify the target before approving."
      : "";
    if (labels.length === 1) {
      tenantNote = `Workspace manifests claim tenant ${labels[0]} — confirm \`gs-admin whoami\` matches before approving.${prodWarn}`;
    } else if (labels.length > 1) {
      tenantNote = `Workspace manifests claim multiple tenants (${labels.join("; ")}${moreTenants}) — confirm \`gs-admin whoami\` targets the intended one before approving.${prodWarn}`;
    }
  } catch { /* keep generic note */ }

  const parts = [];
  // The escalated shell-safety lint leads, then the mutation/tenant text — the
  // human needs both to decide, and the lint alone would hide the write.
  if (lintAskPart) parts.push(lintAskPart);
  if (hits.length) parts.push(`Mutating Gainsight command: ${names}.`);
  // F-268 union note: when the ask exists only because the bundled catalog
  // flags a command the workspace catalog does not, say so — the operator sees
  // WHY the guard disagrees with the workspace copy, and how to refresh it.
  // One paragraph regardless of how many commands promoted (F-089 spirit).
  {
    const promoted = [...new Set(hits.filter((h) => unionPromoted.has(cmdKey(h.cmd))).map((h) => cmdKey(h.cmd)))];
    if (promoted.length) {
      const shown = promoted.slice(0, 5).map((p) => `\`gs-admin ${printable(p, 60)}\``).join(", ");
      const more = promoted.length > 5 ? ` (+${promoted.length - 5} more)` : "";
      // Direction-aware framing: "predates" plus a re-run-setup remedy is only
      // true when the workspace catalog is the OLDER one AND the installed CLI
      // has moved past it — setup regenerates from the installed CLI, so in
      // reverse skew (workspace newer than bundle) re-running setup reproduces
      // the same catalog and the old wording looped a false diagnosis forever.
      const wsVer = printable(catalog.meta?.cliVersion ?? "unknown", 20);
      const bnVer = printable(bundledCliVer ?? "unknown", 20);
      const cmp = verCompare(catalog.meta?.cliVersion, bundledCliVer);
      const framing =
        cmp !== null && cmp < 0
          ? `this workspace's catalog (v${wsVer}) predates the mutating flag on ${shown}${more} — ` +
            `the plugin's bundled catalog (v${bnVer}) carries it, and the guard asks on the union of both. ` +
            `Upgrade the installed CLI to v${bnVer} or newer if it is older, then re-run /gs-superadmin:setup ` +
            `to refresh the workspace catalog.`
          : cmp !== null && cmp > 0
            ? `this workspace's catalog (v${wsVer}) no longer carries the mutating flag on ${shown}${more} — ` +
              `the plugin's older bundled catalog (v${bnVer}) still does, and the guard asks on the union of ` +
              `both until the plugin ships a catalog at v${wsVer} or newer.`
            : `this workspace's catalog (v${wsVer}) and the plugin's bundled catalog (v${bnVer}) disagree on ` +
              `the mutating flag for ${shown}${more} — the guard asks on the union of both.`;
      parts.push(`Catalog-version note: ${framing}`);
    }
  }
  const ovSeen = new Set();
  for (const h of overrideHits) {
    // One paragraph per override COMMAND, not per invocation — a chained call
    // hitting the same entry twice must not print duplicate paragraphs (the
    // journal below still records every invocation separately, on purpose).
    if (ovSeen.has(h.cmd.path)) continue;
    ovSeen.add(h.cmd.path);
    // F-085: entries whose reason already ends a sentence must not get a second
    // "." (the clamp can also cut mid-sentence, in which case one is added).
    const ovReason = printable(h.ov.reason ?? "no reason recorded", 200);
    // The exemption suffix renders only for a VALID safe-mode flag — the same
    // validity rule the matcher applies (string, "-"-prefixed) — so a
    // malformed `unlessArgPresent`, which can never exempt, is never
    // advertised to the operator as an escape hatch either.
    const validExempt =
      typeof h.ov.unlessArgPresent === "string" && h.ov.unlessArgPresent.startsWith("-");
    parts.push(
      `Verified catalog mislabel: \`gs-admin ${h.cmd.path}\` is catalog-marked non-mutating, ` +
        `but was verified to mutate on CLI v${printable(h.ov.verifiedOnCli ?? "unknown", 20)} — ` +
        ovReason +
        (validExempt
          ? ` (\`${printable(h.ov.unlessArgPresent, 40)}\` skips this prompt).`
          : /[.!?]$/.test(ovReason) ? "" : ".")
    );
  }
  if (varAskPart) parts.push(varAskPart);
  if (unknowns.length) {
    const ver = catalog.meta?.cliVersion ?? "unknown";
    // Token text is untrusted: inside quotes it can carry newlines and bidi
    // overrides, and a long command made the reason string thousands of
    // characters. Clamp each entry and cap how many are listed, so this prompt
    // obeys the same rule as every other output path (design tenet 4).
    const shownUnknowns = unknowns.slice(0, 5).map((u) => `\`gs-admin ${printable(redactSecrets(u), 120)}\``).join(", ");
    const more = unknowns.length > 5 ? ` (+${unknowns.length - 5} more)` : "";
    parts.push(
      `Unrecognized gs-admin command (not in catalog v${printable(ver, 20)}): ` +
        shownUnknowns + more +
        ` — could be a typo, or a newer CLI than the catalog (re-run /gs-superadmin:setup to refresh it). Approve only if intended.`
    );
  }
  if (
    hits.some((h) => h.blind) || overrideHits.some((h) => h.blind) ||
    unknowns.some((u) => blindOnly.has(u)) || varSubs.some((v) => blindOnly.has(v))
  ) {
    parts.push(
      "Caveat: this command's quoting is unbalanced, and some or all of the flagged text was " +
        "found only by a quote-blind re-scan — it may be inert (quoted prose, a heredoc body). " +
        "Check whether it actually invokes gs-admin before approving."
    );
  }
  if (
    hits.some((h) => h.operand) || overrideHits.some((h) => h.operand) ||
    unknowns.some((u) => operandOnly.has(u)) || varSubs.some((v) => operandOnly.has(v))
  ) {
    parts.push(
      "Caveat: some or all of the flagged gs-admin text stands in operand position — as an " +
        "argument to another command, as a heredoc body, or as text being echoed/written — not at the start of " +
        "a command segment, so it may be inert. Check whether it actually invokes gs-admin " +
        "before approving."
    );
  }
  if (expansionNames.size) {
    parts.push(
      "Caveat: the command name is an expansion or a variable the shell resolves when the line runs (" +
        [...expansionNames].slice(0, 3).map((n) => `\`${printable(n, 80)}\``).join(", ") +
        ") — the line names gs-admin, so the words after it were read as a gs-admin invocation. " +
        "Check what the name resolves to before approving."
    );
  }
  parts.push(`This workspace is read-only by default. ${tenantNote}`);

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: parts.join(" "),
      },
    }),
    () => process.exit(0) // exit in the write callback (F-363 — see the lint deny above)
  );
  await new Promise(() => {});
}
process.exit(0); // the silent no-reply path — nothing was written, nothing to flush

// ── Change journal ────────────────────────────────────────────────────────────
// Declared after the main flow's process.exit calls, so everything the journal
// needs lives INSIDE the (hoisted) function — module-level consts down here
// would never be initialized when the PostToolUse branch calls it.
async function journalMutations() {
  // The command already ran: nothing here may fail the hook (fail-open), but a
  // journaling failure must not be silent either — alert via systemMessage.
  try {
    // Shared journal-file FORMAT: journal-lib owns the header emitter
    // (guard-fixtures pins both writers' runtime HEADERS equal) and the T-4
    // entry-frame emitter (contract-conformance's T-4 section pins every
    // entry line through both writers; scripts/journal.mjs is the file's
    // other writer). Imported lazily inside this try so the PreToolUse path
    // stays self-contained and a missing/corrupt module degrades to the
    // journaling alert below, never a crashed hook.
    const { journalHeader, composeJournalEntry, oneLine } = await import(
      new URL("../scripts/journal-lib.mjs", import.meta.url).href
    );
    // X-2 system-area vocabulary for the CLI domains it covers — must stay a
    // subset of the component table in the vendored jira-ticket-anatomy.md §2
    // (a fixture check enforces that, so a contract re-vendor that renames
    // components fails CI instead of drifting silently). Domains without an
    // X-2 component (data-management, query, runtime, auth) journal their
    // catalog namespace as-is — an honest namespace beats a forced mapping.
    const SYSTEM_AREAS = {
      journey: "gs-journey",
      "rules-engine": "gs-rules",
      scorecard: "gs-scorecard",
      report: "gs-reports",
      "data-designer": "gs-data-designer",
      connectors: "gs-connectors",
    };

    // Attribution marker, written by /gs-superadmin:change-request while an
    // approved plan executes. Untrusted input: clamp every value. Freshness:
    // started within the last 24 h — a forgotten marker must not mis-attribute
    // later, unrelated mutations to a spent plan. Small forward clock skew is
    // tolerated; a genuinely future-dated marker is as wrong as a stale one.
    let marker = null;
    try {
      const raw = readJsonFileTolerant(join(dir, ".gs-superadmin", "active-change.json")); // BOM-tolerant (F-118)
      const age = Date.now() - Date.parse(raw.started_at);
      if (Number.isFinite(age) && age > -5 * 60 * 1000 && age < 24 * 3600 * 1000) {
        marker = {
          ticket: printable(raw.ticket ?? "none", 40) || "none",
          plan: printable(raw.plan ?? "none", 200) || "none",
          slug: printable(raw.slug ?? "", 80),
        };
      }
    } catch { /* no active change plan */ }

    // Tenant attribution: the marker's slug when its manifest exists (matched
    // case-insensitively — the marker is LLM-written), else the only tenant in
    // the workspace. Ambiguous entries (multi-tenant workspace, no marker) go
    // to a workspace-level catch-all — never lost, but also never written into
    // the wrong tenant's journal.
    const slugs = readdirSync(dir, { withFileTypes: true })
      .filter((e) => direntIsDir(dir, e) && existsSync(join(dir, e.name, "_manifest.json"))) // junction-tolerant (F-134)
      .map((e) => e.name);
    const markerSlug = marker?.slug
      ? slugs.find((s) => s.toLowerCase() === marker.slug.toLowerCase()) ?? null
      : null;
    let slug = null;
    if (markerSlug) slug = markerSlug;
    else if (slugs.length === 1) slug = slugs[0];

    const journalPath = slug
      ? join(dir, slug, "changes", "JOURNAL.md")
      : join(dir, ".gs-superadmin", "JOURNAL-unattributed.md");

    let operator;
    try {
      operator = userInfo().username;
    } catch {
      operator = process.env.USERNAME || process.env.USER || "unknown";
    }

    const ts = new Date().toISOString();
    const cliVer = catalog.meta?.cliVersion ?? "unknown";
    // Redact before clamping: the journal is a durable file, and a secret typed
    // on a gs-admin command line would otherwise be recorded verbatim (the
    // `- target:` field is covered at token-collection time, above).
    const rawCommand = printable(redactSecrets(command), 1000);
    const ticket = marker?.ticket ?? "none";
    const plan = marker?.plan ?? "none";

    // Execution outcome. A journal entry records an approved ATTEMPT — when the
    // harness reports failure, the entry must say so, not read as an applied
    // change. Precedence:
    //   1. PostToolUseFailure → FAILED, with the payload's tool_error (untrusted
    //      text — clamp it) as detail. Current harnesses fire PostToolUse only
    //      on success and pass no exit code, so this event is the only failure
    //      signal there (live-validated: failed calls were previously never
    //      journaled at all).
    //   2. An exit code, wherever the harness puts it (tool_response.exit_code
    //      in the fixtures' shape, exitCode, top-level exit_code) — kept for
    //      harnesses that do report exit status through PostToolUse. Numeric
    //      STRINGS count too ("1" was observed live, F-039): a digit-shaped
    //      string must not fall through to the success branch.
    //   3. An `is_error: true` flag (tool_response or top level) — harnesses
    //      that report failure through PostToolUse instead of
    //      PostToolUseFailure (F-039). Checked after the exit code (an exit
    //      code is the more specific signal), but an exit-0-plus-error-flag
    //      conflict is journaled as unverified, never as a clean success.
    //   4. interrupted flag.
    //   5. An explicit PostToolUse event with none of the above IS the success
    //      signal on harnesses that split success/failure into two events —
    //      say "completed", not the alarming "not verified".
    //   6. Inferred PostToolUse (older harness, no hook_event_name): those
    //      harnesses' failure semantics are unknown, so keep the honest
    //      "not verified" — exactly the pre-0.12.0 wording.
    const tr = input.tool_response ?? /** @type {HookToolResponse} */ ({});
    const exitRaw = [tr.exit_code, tr.exitCode, input.exit_code].find(
      (v) =>
        typeof v === "number" ||
        (typeof v === "string" && /^-?\d+$/.test(v.trim()))
    );
    const exitCode = exitRaw === undefined ? undefined : Number(exitRaw);
    const errorFlag = tr.is_error === true || input.is_error === true;
    let outcome;
    if (isFailure) {
      const detail =
        input.tool_error == null ? "" : `: ${printable(input.tool_error, 200)}`;
      outcome = `FAILED (tool call failed${detail}) — this change likely did not apply`;
    } else if (typeof exitCode === "number") {
      outcome =
        exitCode === 0
          ? errorFlag
            ? "exit 0, but the harness reported an error flag — verify whether this change applied"
            : "exit 0"
          : `exit ${exitCode} — command FAILED; this change likely did not apply`;
    } else if (errorFlag) {
      outcome =
        "FAILED (harness reported an error flag; no exit code) — this change likely did not apply";
    } else if (tr.interrupted === true) {
      outcome = "interrupted — may not have completed";
    } else if (input.hook_event_name === "PostToolUse") {
      outcome = "completed (success event; no exit code reported)";
    } else {
      outcome = "not verified (harness reported no exit status)";
    }

    const kbRef = (domain) =>
      slug
        ? `${slug}/${domain ? `${domain}/` : ""} — pre-change KB docs where indexed ` +
          `(coverage + last_verified: ${slug}/_manifest.json)`
        : "unattributed (no single tenant workspace resolved)";

    const entries = [];
    // A journal line must not assert more than the parse established: findings
    // the quote-blind re-scan alone produced may be inert text (a heredoc body,
    // quoted prose), so their entries carry an explicit unverified note instead
    // of reading as an applied change.
    const BLIND_NOTE =
      "found only by the quote-blind re-scan (this command's quoting is unbalanced) — " +
      "the flagged text may not have executed as a gs-admin invocation; verify before " +
      "treating this entry as an applied change";
    // F-051, BLIND_NOTE's first-pass sibling: matched in operand position, so
    // the entry must not read as an applied change either. Composed with
    // BLIND_NOTE when both apply (a blind finding is usually also mid-text).
    const OPERAND_NOTE =
      "found in operand position (an argument to another command, a heredoc body, or text being " +
      "echoed/written — not the start of a command segment) — the flagged text may not " +
      "have executed as a gs-admin invocation; verify before treating this entry as an " +
      "applied change";
    const noteFor = (blind, operand) =>
      [blind && BLIND_NOTE, operand && OPERAND_NOTE].filter(Boolean).join(" Also: ") || null;
    // Entry FRAME from journal-lib's composeJournalEntry (T-4 canon — see
    // its header for the frame/integrity rules, incl. the F-132 operator
    // clamp). The fields below are this writer's content policy: clamps/
    // redaction applied above, the conditional note, and the hook-only
    // combined ticket·plan line (journal.mjs writes ticket on its own line).
    // One malformed hit (a hostile or degenerate workspace-catalog value the
    // frame rejects) must cost ONLY its own entry, never the invocation's
    // other approved mutations (F-291): before this, the throw escaped the
    // loop and the whole batch was lost. Failures collect here and surface as
    // ONE journaling alert after the good entries are appended.
    const entryFailures = [];
    // Per-hit outcome (F-428): the harness signals above describe the whole
    // command line. Two axes on which they entail nothing about THIS call, and
    // on both the outcome WORD is qualified in the outcome itself, not in a
    // parenthetical after a "completed" a ledger reader would scan past:
    //  - exit status (h.masked — piped, `;`-chained, `||`-chained, a non-last
    //    line): a success-shaped signal becomes "ran — exit status not
    //    visible", a failure-shaped one keeps its FAILED head (the safe
    //    direction) and says the failure may belong to a later stage;
    //  - detection confidence (h.blind / h.operand — found only by the
    //    quote-blind re-scan, or in operand position; F-428's adjacent
    //    instance): the text may never have executed as a gs-admin invocation
    //    at all, so a success-shaped signal becomes "not verified as
    //    executed", a failure-shaped one keeps FAILED and says the text may
    //    not have run at all. Detection doubt subsumes status masking (a
    //    piped heredoc is qualified once, on the stronger doubt); the note
    //    field still carries the full BLIND/OPERAND explanation.
    // Interruption is about the line and stays as is.
    const failureShaped = isFailure || (typeof exitCode === "number" && exitCode !== 0) || errorFlag;
    // The ways a status is not this call's (F-428, F-438; "nested" from the Step 0 review), read from the lexer's record:
    const MASKED_TAIL = (how) => ({
      enclosing: "this call ran inside a substitution, so the harness reported the enclosing command's status, not this call's",
      background: "this call was backgrounded with `&`, so the line's status is not this call's",
      negated: "this call was negated with `!`, so the line's status is the inverse of this call's",
      nested: "this call ran inside a nested interpreter's payload whose reported status is its own (PowerShell's -Command reports 0 or 1; watch exits on its own terms), never this call's code",
    })[how] ?? "this call was not the command line's last stage, so the shell reported the line's status, not this call's";
    const MASKED_FAIL = (how) => ({
      enclosing: "the reported failure is the enclosing command's — this call's own status was never reported",
      background: "the reported failure is the line's — this call's own status was never reported",
      negated: "a reported failure means this call SUCCEEDED — the status is inverted",
      nested: "the reported failure is the nested interpreter's — this call's own code was never reported",
    })[how] ?? "the failure may belong to a later stage";
    const doubtOf = (blind, operand) =>
      `found ${[blind && "only by the quote-blind re-scan", operand && "in operand position"].filter(Boolean).join(" and ")}`;
    // The base word decides what a qualifier may say (release-gate review of
    // 0.37.0): only a SUCCESS-shaped base ("completed …", "exit 0") is ever
    // rewritten to "ran — …" — a base that already reads "not verified" stays,
    // since masking cannot make an unverified call verified; and interruption is
    // read from the base word itself, not from the raw flag, because the base
    // precedence ranks an exit code above the flag (exit_code 0 + interrupted
    // used to bypass every qualifier and journal a bare "exit 0").
    const successShaped = /^(completed|exit 0)/.test(outcome);
    const outcomeFor = ({ masked = false, blind = false, operand = false } = {}) => {
      if (outcome.startsWith("interrupted")) return outcome;
      if (blind || operand) {
        const doubt = doubtOf(blind, operand);
        return failureShaped
          ? `${outcome} — NOTE: ${doubt}; the flagged text may not have executed as a gs-admin invocation at all — see note`
          : `not verified as executed (${doubt}; the harness's success signal is about the command line, not this text — see note); verify before treating this entry as an applied change`;
      }
      if (!masked) return outcome;
      if (failureShaped) return `${outcome} — NOTE: ${MASKED_TAIL(masked)}; ${MASKED_FAIL(masked)} — verify whether this change applied`;
      if (!successShaped) return outcome; // already "not verified …" — masking adds no claim
      return `ran — exit status not visible (${MASKED_TAIL(masked)}); read the tool output before treating this entry as an applied change`;
    };
    const entry = (area, action, target, domain, note, qualifiers = {}) => {
      try {
        entries.push(
          composeJournalEntry({
            ts,
            area,
            ticket,
            kind: "command (guard-approved)",
            operator,
            fields: [
              `- action: ${action}`,
              `- system-area: ${area}`,
              `- target: ${target || "(none stated)"}`,
              `- command: ${rawCommand}`,
              `- outcome: ${outcomeFor(qualifiers)}`,
              ...(note ? [`- note: ${note}`] : []),
              `- ticket: ${ticket} · plan: ${plan}`,
            ],
            kbSnapshot: kbRef(domain),
          })
        );
      } catch (e) {
        entryFailures.push(e?.message ?? String(e));
      }
    };

    // Catalog-mutating hits and ask-override hits journal identically except
    // for the action label — override hits ran with the guard's approval and
    // are verified to mutate, so leaving them out would be exactly the
    // silent-live-run gap the override exists to close.
    for (const h of [...hits, ...overrideHits]) {
      // oneLine + `||`, not bare `??` (F-291): an empty-string domain — and a
      // domain that is ONLY invisibles, which clamps to empty — must journal
      // as "unknown", not reach the frame as "" and throw. The clamp also
      // keeps the unclamped catalog value out of the `- system-area:` field
      // line below (F-293's guard-side half).
      const area = oneLine(SYSTEM_AREAS[h.cmd.domain] ?? h.cmd.domain ?? "", 80) || "unknown";
      const label = h.ov
        ? `${cmdKey(h.cmd)} (catalog v${cliVer}, non-mutating — ask-override: verified ` +
          `mutating on CLI v${printable(h.ov.verifiedOnCli ?? "unknown", 20)})`
        : unionPromoted.has(cmdKey(h.cmd))
          ? `${cmdKey(h.cmd)} (catalog v${cliVer}, mutating per bundled v${printable(bundledCliVer ?? "unknown", 20)})`
          : `${cmdKey(h.cmd)} (catalog v${cliVer}, mutating)`;
      entry(area, label, printable(h.args.join(" "), 200), h.cmd.domain, noteFor(h.blind, h.operand), {
        masked: h.masked || false,
        blind: h.blind === true,
        operand: h.operand === true,
      });
    }
    for (const u of [...unknowns, ...varSubs]) {
      // Redact before clamping, same as `- command:` above — an unresolvable
      // invocation's text can carry a secret value the collection pass declined.
      entry(
        "unknown",
        `not in catalog v${cliVer} (journaled fail-closed): gs-admin ${printable(redactSecrets(u), 200)}`,
        "",
        null,
        noteFor(blindOnly.has(u), operandOnly.has(u)),
        { blind: blindOnly.has(u), operand: operandOnly.has(u), masked: maskedText.get(u) || false }
      );
    }

    if (entries.length) {
      mkdirSync(dirname(journalPath), { recursive: true });
      // Header + entries in ONE append: a separate writeFileSync(header) after an
      // existsSync check can truncate a concurrent hook's just-appended entry
      // (parallel tool calls run this hook concurrently). appendFileSync creates
      // the file itself; the worst concurrent outcome is a duplicate header,
      // never a lost entry.
      const header = existsSync(journalPath) ? "" : journalHeader(slug);
      appendFileSync(journalPath, header + entries.join("\n") + "\n");
    }
    // At most ONE systemMessage per run: this write happens only after a
    // successful append (or an empty batch), and the catch below is reached
    // only when the append itself (or earlier plumbing) threw — the two
    // writes are mutually exclusive.
    // Both alerts exit IN the write callback with the awaited halt (F-372 —
    // the release-gate review found these two sites still write-then-exit
    // through the caller's process.exit(0) after this function returned: the
    // F-360 shape one site over from F-363, invisible to check 19's
    // stdout-then-exit row by its declared block-proxy boundary and pinned
    // by guard-fixtures' async-stdout case instead). The caller's exit stays
    // for the silent path: nothing written, nothing to flush.
    if (entryFailures.length) {
      process.stdout.write(
        JSON.stringify({
          systemMessage:
            `gs-superadmin change journal: ${entryFailures.length} of ` +
            `${entryFailures.length + entries.length} approved-mutation entries could not be ` +
            `composed (${entryFailures[0]}). The commands already ran — append the missing ` +
            `entr${entryFailures.length === 1 ? "y" : "ies"} to <slug>/changes/JOURNAL.md manually.` +
            (entries.length ? " The other entries were recorded." : ""),
        }),
        () => process.exit(0)
      );
      await new Promise(() => {});
    }
  } catch (e) {
    process.stdout.write(
      JSON.stringify({
        systemMessage:
          `gs-superadmin change journal: failed to record an approved gs-admin ` +
          `mutation (${e?.message ?? e}). The command already ran — append the ` +
          `entry to <slug>/changes/JOURNAL.md manually.`,
      }),
      () => process.exit(0)
    );
    await new Promise(() => {});
  }
}
